# Architecture

The application is a monorepo with a React/TypeScript frontend and FastAPI/Python backend. The browser uses a typed API layer. FastAPI routes delegate to services, services coordinate business rules, and repositories isolate MongoDB access. FIT parsing will be behind a parser protocol and independent of HTTP and persistence.

MongoDB Atlas is the initial store, but no Atlas-specific data access is permitted. Changing `MONGODB_URI` and optionally `MONGODB_DATABASE` is sufficient to use local MongoDB.

The backend loads the repository-root `.env` using a path derived from `app/core/config.py`, never from the process working directory. Secret values are represented with Pydantic `SecretStr` and must not be logged.

## Phase 2 request flow

API routes validate transport models and delegate to services. Services enforce cross-document rules such as one active plan, immutable imported objective data, session date bounds, and linked deletion cleanup. Repositories are the only layer that converts public string IDs to MongoDB `ObjectId` values or accesses collections.

Startup attempts idempotent index creation. A database outage does not expose credentials or a stack trace through the API. Indexes can also be initialized explicitly with `npm.cmd run init:database`.

FIT uploads are decoded through an adapter in a worker thread. An in-memory bounded preview cache bridges parsing and confirmation without retaining original file bytes. Confirmation coordinates activity, sample-chunk, duplicate, and planned-session repositories.

Plan imports use the same preview/confirm pattern. A strict Pydantic template resolves relative week/day positions from a Monday start date. Calendar reads consolidate an attached activity into its planned session while leaving unplanned activities independent. FIT imports suggest a plan relationship only for an exact same-day session.

Activity details read the canonical activity document and flatten sample chunks only at the API boundary. The browser renders samples with Recharts and never requests or displays GPS coordinates. The canonical model retains a `manual` source type for compatibility, although manual creation is not exposed in the user interface.

Analytics are computed by a dedicated service from canonical activities, samples, plans, and planned sessions. Summary reads aggregate mileage, adherence, conservative personal bests, comparable runs, and temperature bands without creating duplicate reporting collections. Workload-adjusted heart-rate response is the exception: its versioned result and explicit ineligibility reason are persisted in each activity's `derived_metrics`, allowing imports and later batch recalculation to share the same algorithm.

## Compatibility policy

The current interface intentionally omits manual activity creation and historical
session-rescheduling controls. Their backend fields and endpoints remain available
for existing records and API compatibility; no destructive migration is required.
New calendar behavior treats planned sessions, attached completions, and independent
activities as separate canonical cases.
