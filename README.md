# Greenrun

Greenrun is a single-user endurance-training application for training plans, Garmin FIT activities, analytics, and structured JSON exports.

## Requirements

- Node.js 22.12 or newer
- Python 3.12 or newer
- MongoDB Atlas or a standard local MongoDB deployment

## Setup

1. Install the root and frontend packages with `npm.cmd install` and `npm.cmd --prefix frontend install`.
2. Install the backend with `py -3.12 -m pip install -e "backend[dev]"`. Windows development commands pin Python 3.12 so a newer Python installation or `PATH` change cannot select the wrong environment.
3. Create the root `.env` from `.env.example` and provide `MONGODB_URI` and `MONGODB_DATABASE`.
4. Start both services with `npm.cmd run dev` or double-click `start-dev.ps1`.

The backend resolves `.env` from the repository root regardless of the current working directory. Never commit that file. See [COMMANDS.md](COMMANDS.md) for all commands.

The frontend uses `http://localhost:5174` so it can run alongside Cache on port 5173.
If port 5174 is occupied, startup fails instead of silently choosing another port.

## Beelink deployment

Greenrun runs on the Beelink as a single Docker container behind Tailscale Serve, using MongoDB Atlas.
See [docs/deployment.md](docs/deployment.md).

## Tailscale development access

Development servers bind to `0.0.0.0`, so localhost access continues to work and other
devices can connect through the host computer's Tailscale address. Do not put a personal
Tailscale IP in source files. Add it only to the repository-root `.env`:

```dotenv
FRONTEND_ORIGINS=http://localhost:5174,http://127.0.0.1:5174,http://100.x.y.z:5174
VITE_API_BASE_URL=http://100.x.y.z:8000/api
# Only needed when using a MagicDNS hostname instead of an IP:
VITE_ALLOWED_HOSTS=my-computer.example-tailnet.ts.net
```

Replace `100.x.y.z` with the development computer's Tailscale IPv4 address. You may use
its MagicDNS hostname in both URLs and list that bare hostname in `VITE_ALLOWED_HOSTS`.
Origins must include the scheme and frontend port but
must not include a path or trailing slash. Restart the development servers after changing
`.env`; Vite reads its API URL when the frontend starts.

On another Tailscale device, open `http://100.x.y.z:5174`. On the development computer,
`http://localhost:5174` remains available. The host firewall must allow inbound TCP 5174
and 8000 on the Tailscale network. Binding to all interfaces does not bypass Windows
Firewall and does not itself expose a port through the internet or your router.

## Current scope

The application includes Garmin FIT upload, integrity validation, preview-before-save, duplicate choices, exact lap extraction, and five-second sample persistence. It also includes strict plan import, a Monday-first training calendar, activity linking, full activity details, lap tables, synchronized charts, subjective editing, settings, storage statistics, analytics, and GPS-safe analysis exports. Database backup/restore scripts and optional Docker support are included; neither Docker nor manual activity entry is required.

No FIT files, original route data, latitude, or longitude will be stored by the application.

Detailed installation and Atlas guidance is in [docs/setup.md](docs/setup.md). Backup and portability procedures are in [docs/database-backup.md](docs/database-backup.md). Architectural guardrails for intentionally deferred work are collected in [docs/future-enhancements.md](docs/future-enhancements.md).

## Importing a FIT activity

Open **Import** and select or drag one or more `.fit` activities. Straightforward files save automatically; duplicates and possible planned-workout links pause individually for review. The preview expires after 30 minutes or when the backend restarts. Only normalized activity data is held during preview; original uploaded bytes are released immediately after parsing.

## Importing a training plan

Open **Plans**, download the blank template or use the documented example, and validate the JSON. Plans can carry actual dates. For an undated plan, optionally choose a Monday override; otherwise it begins on the current week's Monday. Review the resolved dates and mileage before importing. If another plan is active, the confirmation explicitly archives it without deleting its sessions or completed activities.
