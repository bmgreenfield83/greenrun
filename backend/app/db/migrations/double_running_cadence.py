"""Convert stored Garmin running cadence from per-leg (strides/min) to steps/min.

Garmin FIT files record running cadence per leg. Imports made before cadence scale version 2 stored
that value unchanged, so run cadence appears roughly half of the familiar steps-per-minute figure.
This migration doubles `summary.average_cadence_spm`, `summary.maximum_cadence_spm`, each lap's
average/maximum cadence, and every sample's `cadence_spm` for FIT-imported runs.

Idempotency: each corrected sample chunk and activity is marked with `cadence_scale_version: 2`
(chunks at the top level, activities under `source`). Every write is guarded by that marker, so a
rerun, or a rerun after an interruption, never doubles a value twice. New FIT imports are already
marked by the parser and are skipped.

The fractional part of cadence was not stored by earlier imports and cannot be recovered.

Usage from `backend/` (dry run by default; nothing is written without `--apply`):

    py -3.12 -m app.db.migrations.double_running_cadence
    py -3.12 -m app.db.migrations.double_running_cadence --apply

Back up the database before applying (see docs/database-backup.md).
"""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass, field
from typing import Any

from app.db.collections import ACTIVITIES, ACTIVITY_SAMPLES

TARGET_VERSION = 2
MARKER_NOT_SET = {"$ne": TARGET_VERSION}
# Per-leg running cadence is typically 70-100. A stored average above this is probably already in
# steps/min (for example from a manual edit), so the activity is reported and left untouched.
SUSPICIOUS_AVERAGE_CADENCE = 130

ACTIVITY_QUERY = {
    "sport": "run",
    "source.type": "fit",
    "source.cadence_scale_version": MARKER_NOT_SET,
}


@dataclass
class CadenceMigrationReport:
    applied: bool
    activities_already_corrected: int = 0
    activities_to_correct: int = 0
    activities_corrected: int = 0
    activities_skipped_suspicious: list[str] = field(default_factory=list)
    sample_chunks: int = 0
    samples_with_cadence: int = 0
    laps_with_cadence: int = 0

    def lines(self) -> list[str]:
        mode = "APPLIED" if self.applied else "DRY RUN (no changes written; pass --apply to write)"
        return [
            f"Mode: {mode}",
            f"Run activities already at cadence scale version {TARGET_VERSION}: "
            f"{self.activities_already_corrected}",
            f"Run activities needing correction: {self.activities_to_correct}",
            f"Run activities corrected: {self.activities_corrected}",
            f"Sample chunks {'doubled' if self.applied else 'to double'}: {self.sample_chunks}",
            f"Samples with cadence: {self.samples_with_cadence}",
            f"Laps with cadence: {self.laps_with_cadence}",
            "Skipped (average cadence already above "
            f"{SUSPICIOUS_AVERAGE_CADENCE}): {len(self.activities_skipped_suspicious)}"
            + (
                f" -> {', '.join(self.activities_skipped_suspicious)}"
                if self.activities_skipped_suspicious
                else ""
            ),
        ]


def _double(value: Any) -> Any:
    return value * 2 if isinstance(value, (int, float)) and not isinstance(value, bool) else value


def _has_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def doubled_laps(laps: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    result: list[dict[str, Any]] = []
    with_cadence = 0
    for lap in laps:
        updated = dict(lap)
        if _has_number(lap.get("average_cadence_spm")) or _has_number(
            lap.get("maximum_cadence_spm")
        ):
            with_cadence += 1
        for key in ("average_cadence_spm", "maximum_cadence_spm"):
            if key in updated:
                updated[key] = _double(updated[key])
        result.append(updated)
    return result, with_cadence


def doubled_samples(samples: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    result: list[dict[str, Any]] = []
    with_cadence = 0
    for sample in samples:
        updated = dict(sample)
        if _has_number(sample.get("cadence_spm")):
            with_cadence += 1
            updated["cadence_spm"] = sample["cadence_spm"] * 2
        result.append(updated)
    return result, with_cadence


async def migrate(database: Any, *, apply: bool) -> CadenceMigrationReport:
    activities = database[ACTIVITIES]
    chunks = database[ACTIVITY_SAMPLES]
    report = CadenceMigrationReport(applied=apply)
    report.activities_already_corrected = await activities.count_documents(
        {"sport": "run", "source.type": "fit", "source.cadence_scale_version": TARGET_VERSION}
    )
    candidates = [
        item
        async for item in activities.find(
            ACTIVITY_QUERY, {"_id": 1, "summary": 1, "laps": 1, "source": 1}
        )
    ]
    for activity in candidates:
        summary = activity.get("summary") or {}
        average = summary.get("average_cadence_spm")
        if _has_number(average) and average > SUSPICIOUS_AVERAGE_CADENCE:
            report.activities_skipped_suspicious.append(str(activity["_id"]))
            continue
        report.activities_to_correct += 1

        async for chunk in chunks.find(
            {"activity_id": activity["_id"], "cadence_scale_version": MARKER_NOT_SET},
            {"_id": 1, "samples": 1},
        ):
            samples, with_cadence = doubled_samples(chunk.get("samples") or [])
            report.sample_chunks += 1
            report.samples_with_cadence += with_cadence
            if apply:
                await chunks.update_one(
                    {"_id": chunk["_id"], "cadence_scale_version": MARKER_NOT_SET},
                    {"$set": {"samples": samples, "cadence_scale_version": TARGET_VERSION}},
                )

        laps, laps_with_cadence = doubled_laps(activity.get("laps") or [])
        report.laps_with_cadence += laps_with_cadence
        changes: dict[str, Any] = {
            "laps": laps,
            "source.cadence_scale_version": TARGET_VERSION,
        }
        for key in ("average_cadence_spm", "maximum_cadence_spm"):
            if _has_number(summary.get(key)):
                changes[f"summary.{key}"] = summary[key] * 2
        if apply:
            result = await activities.update_one(
                {"_id": activity["_id"], "source.cadence_scale_version": MARKER_NOT_SET},
                {"$set": changes},
            )
            report.activities_corrected += result.modified_count
    return report


async def run(apply: bool) -> CadenceMigrationReport:
    from app.core.config import get_settings
    from app.db.client import create_mongo_resources

    settings = get_settings()
    resources = create_mongo_resources(settings)
    try:
        print(f"Database: {settings.mongodb_database}")
        return await migrate(resources.database, apply=apply)
    finally:
        await resources.client.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Double stored Garmin running cadence (per leg -> steps/min). Dry run by default."
        )
    )
    parser.add_argument(
        "--apply", action="store_true", help="write changes (back up the database first)"
    )
    arguments = parser.parse_args(argv)
    report = asyncio.run(run(arguments.apply))
    for line in report.lines():
        print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
