# AGENTS.md

## Project

This repository contains a personal endurance-training application built with:

- React
- TypeScript
- Vite
- Material UI
- FullCalendar
- Recharts
- FastAPI
- Python
- MongoDB

## Source of truth

Before making architectural or implementation decisions, read:

- `docs/PRODUCT_REQUIREMENTS.md`

That document is the authoritative product specification.

If implementation details conflict with the product requirements, follow the product requirements unless the user explicitly approves a change.

## Working method

1. Inspect the repository before modifying files.
2. Create and maintain a clear implementation plan.
3. Implement the application in the phases described in the product requirements.
4. Do not attempt the entire application as one uncontrolled change.
5. Keep frontend and backend concerns separated.
6. Do not place the entire frontend in `App.tsx`.
7. Write tests alongside important functionality.
8. Run relevant tests, linting, and type checks before reporting a phase complete.
9. Update documentation when commands, architecture, schemas, or behavior change.
10. Never commit credentials, `.env` files, private FIT files, or personal activity data.

## Product decisions

Do not silently change product requirements.

When an unavoidable ambiguity materially affects the architecture or user experience:

- Explain the ambiguity.
- Recommend the simplest maintainable option.
- Ask for approval before implementing that decision.

For routine implementation details, choose a sensible best-practice approach without requesting unnecessary confirmation.

## Database

The application must work with MongoDB Atlas and standard local MongoDB by changing environment configuration only.

Never hardcode database credentials.

## Current task

Begin by:

1. Reading `docs/PRODUCT_REQUIREMENTS.md`.
2. Proposing the final directory structure.
3. Summarizing the database model.
4. Listing any unavoidable assumptions.
5. Producing a phased implementation plan.
6. Waiting for approval before beginning Phase 1.