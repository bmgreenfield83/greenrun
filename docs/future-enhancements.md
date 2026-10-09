# Future enhancement notes

This document records architectural guardrails for work intentionally deferred beyond
v1.1. These are implementation notes, not commitments or active requirements.

## General rules

- Keep imported objective FIT data immutable. New interpretations belong in versioned
  derived metrics, not destructive rewrites of source-normalized fields.
- Add a schema version and migration or backward-compatible reader before changing a
  persisted document or export shape.
- Preserve the current privacy boundary: no GPS coordinates, route geometry, original
  FIT bytes, credentials, or personal exports in source control.
- Keep Atlas and local MongoDB interchangeable through configuration alone.
- Retain exact Garmin laps even if future views add inferred workout segments.

## AI-assisted coaching

AI track-session reviews are now implemented; see [ai-reviews.md](ai-reviews.md). The
guardrails below still apply to any further AI features.

AI coaching would require separate API credentials and usage billing; a ChatGPT
subscription does not provide application API credits. Any future integration should
be opt-in, keep its key only in the root environment configuration, show exactly what
data will leave the computer, and provide a usable export-only workflow when no key is
configured. Prefer sending the existing analysis exports over granting an AI service
direct database access. Do not transmit GPS or silently run analysis in the background.

Generated coaching should be presented as advisory text with model, prompt, generation
time, and source-export version recorded. It should not overwrite training plans or
subjective data without explicit confirmation.

## Garmin synchronization

Automatic synchronization is materially different from FIT-file import. It would need
an approved Garmin integration path, secure token storage, refresh/revocation handling,
incremental sync cursors, rate-limit handling, and idempotency based on Garmin activity
IDs plus checksums. Synced activities should pass through the same normalization,
privacy filtering, duplicate detection, and derived-metric pipeline as uploaded files.
Do not create a second canonical activity model for synchronized data.

## Weather enrichment

FIT sensor temperature and third-party historical weather must remain distinguishable.
Future weather values should store provenance, provider, observation time, lookup
location precision, retrieval time, units, and whether the value was measured or
estimated. Never replace recorded FIT temperature with enriched weather.

Because the application deliberately discards GPS, enrichment needs a separately
consented location source, such as a configured home area or a per-activity location.
The interface must disclose the timestamp and location data sent to a provider and
continue working when enrichment is disabled, rate-limited, or unavailable.

## Structured workouts and interval analysis

Add structured planned-workout segments as an optional, versioned extension. Preserve
the existing freeform instructions as the human-readable source of truth. Automatic
classification of Garmin laps into warmup, work, recovery, and cooldown should retain
the original laps and attach confidence and algorithm-version metadata to inferred
segments. Never silently relabel or merge recorded laps.

## Analytics evolution

Derived algorithms should remain versioned and recalculable. A recalculation should be
explicit, report how many activities changed, and retain enough metadata to explain an
old export. Trend lines and weather comparisons must remain descriptive rather than
being presented as causal findings, readiness scores, injury predictions, or medical
guidance.

The current workload-adjusted heart-rate response supports varied terrain and running
workouts while explicitly rejecting cases where workload and elapsed time cannot be
separated. If future work adds cycling or sport-specific physiological analysis,
implement separate models with their own eligibility rules rather than reusing the
running coefficients.

## Timezone support

Timezone settings should be implemented end to end: FIT local-date normalization,
calendar queries, plan date resolution, labels, exports, and daylight-saving behavior.
Changing the display timezone must not mutate stored UTC timestamps. Decide explicitly
whether an existing activity's historical `local_date` remains fixed or is recomputed
before exposing a user-facing timezone control.

## State, scale, and multi-user preparation

TanStack Query remains the preferred server-state cache. Add broader client-state
management only when state spans unrelated routes or must persist across reloads; avoid
duplicating canonical MongoDB data in a client store. If activity volume makes offset
pagination slow, migrate list endpoints to stable cursor pagination.

Before multi-user support, add ownership fields and compound owner-scoped indexes to
every collection, scope all repository methods, and design authentication and data
migration together. Do not bolt authentication onto globally scoped queries.

## Data migrations and release safety

Before changing sample resolution or persisted schemas, provide a dry run, counts,
backup instructions, resumability, and idempotent execution. Large sample migrations
should operate in bounded batches and never require original FIT files. Continue using
the release checklist and desktop/mobile browser smoke tests for cross-workflow changes.
