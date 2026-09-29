# Setup and operations

## Required software

- Node.js 22.12 or newer
- Python 3.12 or newer
- MongoDB Atlas or standard local MongoDB
- MongoDB Database Tools when backup or restore is needed

Install dependencies from the repository root:

```powershell
npm.cmd install
npm.cmd --prefix frontend install
py -3.12 -m pip install -e "backend[dev]"
```

Copy `.env.example` to the repository-root `.env`, then provide `MONGODB_URI` and `MONGODB_DATABASE`. The backend resolves that exact root file regardless of its working directory. Do not commit or share it.

## MongoDB Atlas

1. Create an Atlas project and cluster.
2. Create a database user with access to the application database.
3. Add the machine's current IP address to Atlas Network Access.
4. Copy the driver connection string into root `.env` as `MONGODB_URI` and set `MONGODB_DATABASE`.
5. Run `npm.cmd run check:database` without printing the URI.
6. Run `npm.cmd run init:database` to create indexes and default settings.

Start the application with `npm.cmd run dev` or double-click `start-dev.ps1`. Windows development commands use `py -3.12` deliberately, preventing a newer Python installation or `PATH` change from selecting an interpreter without the backend dependencies. The frontend is at `http://localhost:5174`; API documentation is at `http://localhost:8000/docs`.

## Tailscale access

Vite and Uvicorn listen on all interfaces during development. To use the application
from another device on the same tailnet, add that computer's Tailscale address only to
the repository-root `.env`:

```dotenv
FRONTEND_ORIGINS=http://localhost:5174,http://127.0.0.1:5174,http://100.x.y.z:5174
VITE_API_BASE_URL=http://100.x.y.z:8000/api
# Only for MagicDNS hostname access:
VITE_ALLOWED_HOSTS=my-computer.example-tailnet.ts.net
```

Replace the placeholder with the host's Tailscale IPv4 address. If you use a MagicDNS
name instead, use it in both URLs and add the bare hostname to `VITE_ALLOWED_HOSTS`, then
restart both services. Browse to the corresponding port 5174 URL. Keep the localhost
origins in the allowlist so local use continues to work. Windows Firewall must permit
inbound TCP ports 5174 and 8000 for traffic arriving through Tailscale.

## Optional Docker environment

Docker is not required. For an isolated local MongoDB and containerized application:

```powershell
docker compose up --build
docker compose down
```

The Compose stack stores MongoDB data in the named `running-tracker-mongo` volume. It does not mount or copy the repository `.env`. The normal non-Docker workflow remains the primary development path.

See [COMMANDS.md](../COMMANDS.md) for verification, schema, backup, restore, and service-specific commands.

## Browser regression tests

Phase 13 includes Playwright coverage for primary navigation, calendar visibility controls, and automatic FIT import. Install Chromium once with `npx.cmd playwright install chromium` from `frontend`, then run `npm.cmd --prefix frontend run test:e2e` from the repository root. The suite starts its own Vite server and mocks API responses; it does not read or modify personal MongoDB data.
