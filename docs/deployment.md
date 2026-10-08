# Deploying Greenrun on the Beelink

Greenrun runs on the Beelink as one Docker container: FastAPI serves both the API and the built
frontend from the same origin, so no CORS or API-URL configuration is needed. The database stays in
MongoDB Atlas. The container listens only on `127.0.0.1:8440`; Tailscale Serve publishes it privately
over HTTPS on port 8444 (beside Cache on 443, Greenbook on 8443, and Greenhome on 10000).

## Pieces

| File | Purpose |
| --- | --- |
| `Dockerfile` | Builds the frontend with `VITE_API_BASE_URL=/api`, then runs Uvicorn with `FRONTEND_DIST` set |
| `compose.prod.yml` | Compose project `greenrun`, service `app` (container `greenrun-app-1`), loopback port |
| `.env.production.example` | Template for the Beelink `.env` (Atlas URI, database name, port) |
| `deploy/greenrun.sh` | `start`, `update`, `stop`, `status`, `logs` |

Uvicorn runs a single worker because FIT and plan import previews live in process memory.

`compose.yaml` remains an optional local stack with its own MongoDB container; it is not used on the Beelink.

## First install

1. On the PC, push this repository to a private GitHub repository (like Cache and Greenbook).
   `.env`, `atlas-credentials.env`, FIT files, and backups are ignored and must never be committed.
2. On the Beelink:

   ```sh
   sudo mkdir -p /srv/apps/greenrun && sudo chown "$USER": /srv/apps/greenrun
   git clone git@github.com:bmgreenfield83/greenrun.git /srv/apps/greenrun
   cd /srv/apps/greenrun
   cp .env.production.example .env && chmod 600 .env
   nano .env                     # paste the Atlas MONGODB_URI
   ./deploy/greenrun.sh start
   ./deploy/greenrun.sh status   # expect {"status":"ok"} and {"status":"ready","database":"connected"}
   sudo tailscale serve --bg --https=8444 http://127.0.0.1:8440
   tailscale serve status        # https://bretts-beelink....ts.net:8444 -> http://127.0.0.1:8440
   ```

3. Open `https://<beelink MagicDNS name>:8444` from any tailnet device.

If `/api/ready` reports the database unavailable, check Atlas **Network Access**: the Beelink's public
IP must be allowed. It normally matches the PC's home IP.

To remove the route later: `sudo tailscale serve --https=8444 off`.

## Updating

Push changes from the PC, then on the Beelink run `./deploy/greenrun.sh update` (or use Greenhome's
Update button once Greenrun is registered there). The container restarts automatically after a reboot
(`restart: unless-stopped`).

## Garmin Connect sync

Add `GARMIN_EMAIL` and `GARMIN_PASSWORD` to the Beelink `.env`, run `./deploy/greenrun.sh update`, then
sign in once (this is where Garmin's MFA code is entered):

```sh
docker compose -f compose.prod.yml exec -w /app/backend app python -m app.services.garmin.setup
```

Sign-in tokens are kept in the `garmin-tokens` Docker volume, so updates and restarts keep them. Details
and troubleshooting are in [garmin-sync.md](garmin-sync.md).

## Health endpoints

- `GET /api/health` returns `{"status":"ok"}` when the process is up (used by the Docker `HEALTHCHECK`).
- `GET /api/ready` returns `{"status":"ready","database":"connected"}`, or HTTP 503 when Atlas is unreachable.

## Backups

Greenrun relies on Atlas for storage durability. The free tier has no automated snapshots; the manual
scripts in [database-backup.md](database-backup.md) still work if a copy is ever wanted.
