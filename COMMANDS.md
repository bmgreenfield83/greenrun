# Commands

Run commands from the repository root unless noted. On Windows, use `npm.cmd` because PowerShell may block the `npm.ps1` shim.

## Install

```powershell
npm.cmd install
npm.cmd --prefix frontend install
py -3.12 -m pip install -e "backend[dev]"
```

## Develop

```powershell
npm.cmd run dev
npm.cmd run dev:frontend
npm.cmd run dev:backend
```

The clickable Windows launcher is `start-dev.ps1`.
The Command Prompt launcher is `start-dev.bat`.

Windows development commands intentionally use `py -3.12` so installing a newer Python
or changing `PATH` cannot silently select an interpreter without the backend dependencies.

Both Vite and Uvicorn bind to `0.0.0.0` in development. Local access remains:

```text
http://localhost:5174
http://localhost:8000/docs
```

For Tailscale access, add the development computer's Tailscale IP or MagicDNS name to
the root `.env` (never hardcode or commit it):

```dotenv
FRONTEND_ORIGINS=http://localhost:5174,http://127.0.0.1:5174,http://100.x.y.z:5174
VITE_API_BASE_URL=http://100.x.y.z:8000/api
# Only for MagicDNS hostname access:
VITE_ALLOWED_HOSTS=my-computer.example-tailnet.ts.net
```

Restart both services, then open `http://100.x.y.z:5174` from another device on the
tailnet. IP addresses need no Vite host entry; a MagicDNS name must be listed as a bare
hostname in `VITE_ALLOWED_HOSTS`. If it cannot connect, allow inbound TCP ports 5174 and 8000 through Windows
Firewall for the Tailscale network. CORS origins are exact: include the scheme and port,
omit paths and trailing slashes, and list multiple origins with commas.

Test MongoDB connectivity without printing the connection string:

```powershell
Set-Location backend
py -3.12 -m app.db.check
```

Create required indexes and the default application-settings document:

```powershell
npm.cmd run init:database
```

The API documentation is available at `http://localhost:8000/docs` while the backend runs, or at `http://100.x.y.z:8000/docs` over Tailscale after firewall access is allowed.

The generated training-plan JSON Schema and blank import template are available at:

```text
http://localhost:8000/api/plans/schema
http://localhost:8000/api/plans/export-blank
```

## Verify

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run build
npm.cmd --prefix frontend run test:e2e
```

Install the Chromium runtime once before the first browser-test run:

```powershell
Set-Location frontend
npx.cmd playwright install chromium
```

## Database backup and restore

Set `MONGODB_URI` and `MONGODB_DATABASE` in the terminal without printing them:

```powershell
./scripts/backup_database.ps1
$env:CONFIRM_RESTORE="YES"
./scripts/restore_database.ps1 -Archive ./backups/<archive>.archive.gz
```

For a differently named source database, set `BACKUP_DATABASE` before restoring. Restore uses `--drop`; read [docs/database-backup.md](docs/database-backup.md) first.

## Optional Docker

```powershell
docker compose config
docker compose up --build
docker compose down
```

## Beelink (production)

Run from `/srv/apps/greenrun` on the Beelink. See [docs/deployment.md](docs/deployment.md).

```sh
./deploy/greenrun.sh start
./deploy/greenrun.sh update
./deploy/greenrun.sh status
./deploy/greenrun.sh logs
./deploy/greenrun.sh stop
```

## Schema and indexes

```powershell
Invoke-WebRequest http://localhost:8000/api/plans/schema
npm.cmd run init:database
npm.cmd run check:database
```
