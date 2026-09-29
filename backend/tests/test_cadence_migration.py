from copy import deepcopy
from types import SimpleNamespace
from typing import Any

import pytest
from bson import ObjectId

from app.db.migrations.double_running_cadence import CadenceMigrationReport, main, migrate


def _get(document: dict[str, Any], path: str) -> Any:
    value: Any = document
    for part in path.split("."):
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    return value


def _matches(document: dict[str, Any], query: dict[str, Any]) -> bool:
    for path, condition in query.items():
        value = _get(document, path)
        if isinstance(condition, dict) and "$ne" in condition:
            if value == condition["$ne"]:
                return False
        elif value != condition:
            return False
    return True


def _set(document: dict[str, Any], path: str, value: Any) -> None:
    *parents, leaf = path.split(".")
    target = document
    for part in parents:
        target = target.setdefault(part, {})
    target[leaf] = value


class AsyncCursorFake:
    def __init__(self, documents: list[dict[str, Any]]) -> None:
        self.documents = documents

    def __aiter__(self) -> "AsyncCursorFake":
        self.iterator = iter(self.documents)
        return self

    async def __anext__(self) -> dict[str, Any]:
        try:
            return next(self.iterator)
        except StopIteration as error:
            raise StopAsyncIteration from error


class CollectionFake:
    def __init__(self, documents: list[dict[str, Any]]) -> None:
        self.documents = documents
        self.writes = 0

    def find(self, query: dict[str, Any], _projection: dict[str, Any]) -> AsyncCursorFake:
        return AsyncCursorFake([deepcopy(item) for item in self.documents if _matches(item, query)])

    async def count_documents(self, query: dict[str, Any]) -> int:
        return sum(1 for item in self.documents if _matches(item, query))

    async def update_one(self, query: dict[str, Any], update: dict[str, Any]) -> SimpleNamespace:
        for item in self.documents:
            if _matches(item, query):
                for path, value in update["$set"].items():
                    _set(item, path, deepcopy(value))
                self.writes += 1
                return SimpleNamespace(modified_count=1)
        return SimpleNamespace(modified_count=0)


def run_activity(identifier: ObjectId, **changes: Any) -> dict[str, Any]:
    return {
        "_id": identifier,
        "sport": "run",
        "source": {"type": "fit"},
        "summary": {"average_cadence_spm": 83.0, "maximum_cadence_spm": 90, "calories": 300},
        "laps": [
            {"index": 1, "average_cadence_spm": 82.0, "maximum_cadence_spm": 88.0},
            {"index": 2, "average_cadence_spm": None, "maximum_cadence_spm": None},
        ],
    } | changes


def database() -> tuple[dict[str, CollectionFake], dict[str, ObjectId]]:
    ids = {name: ObjectId() for name in ("legacy", "done", "bike", "manual", "odd")}
    activities = CollectionFake(
        [
            run_activity(ids["legacy"]),
            run_activity(ids["done"], source={"type": "fit", "cadence_scale_version": 2}),
            run_activity(ids["bike"], sport="bike"),
            run_activity(ids["manual"], source={"type": "manual"}),
            run_activity(ids["odd"], summary={"average_cadence_spm": 170.0}),
        ]
    )
    legacy_chunks = [
        {
            "_id": ObjectId(),
            "activity_id": ids["legacy"],
            "chunk_index": index,
            "samples": [
                {"elapsed_seconds": index * 600, "cadence_spm": 80.0},
                {"elapsed_seconds": index * 600 + 5, "cadence_spm": None},
            ],
        }
        for index in range(2)
    ]
    other_chunks = [
        {
            "_id": ObjectId(),
            "activity_id": ids[name],
            "chunk_index": 0,
            "samples": [{"elapsed_seconds": 0, "cadence_spm": 80.0}],
        }
        for name in ("done", "bike", "manual", "odd")
    ]
    samples = CollectionFake(legacy_chunks + other_chunks)
    return {"activities": activities, "activity_samples": samples}, ids


def by_id(collection: CollectionFake, key: str, identifier: ObjectId) -> list[dict[str, Any]]:
    return [item for item in collection.documents if item[key] == identifier]


@pytest.mark.asyncio
async def test_dry_run_reports_counts_without_writing() -> None:
    fake, ids = database()
    before = deepcopy(fake["activities"].documents), deepcopy(fake["activity_samples"].documents)

    report = await migrate(fake, apply=False)

    assert report.activities_to_correct == 1
    assert report.activities_corrected == 0
    assert report.activities_already_corrected == 1
    assert report.sample_chunks == 2
    assert report.samples_with_cadence == 2
    assert report.laps_with_cadence == 1
    assert report.activities_skipped_suspicious == [str(ids["odd"])]
    assert fake["activities"].writes == fake["activity_samples"].writes == 0
    assert (fake["activities"].documents, fake["activity_samples"].documents) == before


@pytest.mark.asyncio
async def test_apply_doubles_legacy_runs_once_and_marks_them() -> None:
    fake, ids = database()

    report = await migrate(fake, apply=True)

    assert report.activities_corrected == 1
    legacy = by_id(fake["activities"], "_id", ids["legacy"])[0]
    assert legacy["summary"] == {
        "average_cadence_spm": 166.0,
        "maximum_cadence_spm": 180,
        "calories": 300,
    }
    assert legacy["laps"][0]["average_cadence_spm"] == 164.0
    assert legacy["laps"][0]["maximum_cadence_spm"] == 176.0
    assert legacy["laps"][1]["average_cadence_spm"] is None
    assert legacy["source"]["cadence_scale_version"] == 2
    chunks = by_id(fake["activity_samples"], "activity_id", ids["legacy"])
    assert [chunk["samples"][0]["cadence_spm"] for chunk in chunks] == [160.0, 160.0]
    assert all(chunk["samples"][1]["cadence_spm"] is None for chunk in chunks)
    assert all(chunk["cadence_scale_version"] == 2 for chunk in chunks)
    for name in ("done", "bike", "manual", "odd"):
        untouched = by_id(fake["activities"], "_id", ids[name])[0]
        assert untouched["summary"]["average_cadence_spm"] in {83.0, 170.0}
        chunk = by_id(fake["activity_samples"], "activity_id", ids[name])[0]
        assert chunk["samples"][0]["cadence_spm"] == 80.0

    rerun = await migrate(fake, apply=True)

    assert rerun.activities_to_correct == 0
    assert rerun.activities_corrected == 0
    assert rerun.activities_already_corrected == 2
    assert legacy["summary"]["average_cadence_spm"] == 166.0
    assert [chunk["samples"][0]["cadence_spm"] for chunk in chunks] == [160.0, 160.0]


@pytest.mark.asyncio
async def test_interrupted_apply_does_not_double_marked_chunks_again() -> None:
    fake, ids = database()
    chunk = by_id(fake["activity_samples"], "activity_id", ids["legacy"])[0]
    chunk["samples"][0]["cadence_spm"] = 160.0
    chunk["cadence_scale_version"] = 2

    report = await migrate(fake, apply=True)

    assert report.sample_chunks == 1
    chunks = by_id(fake["activity_samples"], "activity_id", ids["legacy"])
    assert [item["samples"][0]["cadence_spm"] for item in chunks] == [160.0, 160.0]


def test_command_defaults_to_dry_run(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[bool] = []

    async def fake_run(apply: bool) -> CadenceMigrationReport:
        calls.append(apply)
        return CadenceMigrationReport(applied=apply)

    monkeypatch.setattr("app.db.migrations.double_running_cadence.run", fake_run)

    assert main([]) == 0
    assert main(["--apply"]) == 0
    assert calls == [False, True]
