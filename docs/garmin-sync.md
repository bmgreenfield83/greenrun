# Garmin Connect sync

The Import page's **Sync from Garmin** button pulls one day's runs straight from Garmin Connect. It is
manual only: nothing syncs on a schedule, in the background, or automatically.

## How it works

1. The page sends the chosen date (default: today) to `POST /api/activities/garmin-sync`.
2. The backend asks Garmin Connect for that day's activities and keeps the runs. Running includes
   Garmin's running subtypes (trail, treadmill, track, indoor). The day is matched against each
   activity's local start time as recorded by the watch, which is the date Garmin Connect shows.
3. Each run is checked against Greenrun by its Garmin activity ID. Runs already imported are reported as
   such and not downloaded again.
4. For each new run, the backend downloads Garmin's "original" ZIP, extracts the FIT file in memory (no
   temporary files), and passes it to the existing FIT import preview with the Garmin activity ID
   attached. That ID is stored on the activity (`source.garmin_activity_id`).
5. The previews join the Import page's existing queue and behave exactly like uploaded FIT files:
   straightforward runs save automatically, while duplicates (by checksum, Garmin ID, or
   start/duration/distance) and possible planned-session links open the usual review dialog.

Several runs on one day each get their own queue row. A run whose download fails is reported in the
queue while the others carry on. The manual FIT upload flow is unchanged.

### Responses

`POST /api/activities/garmin-sync` with `{"date": "YYYY-MM-DD"}` returns:

| `status` | Meaning |
| --- | --- |
| `ready` | At least one new run was downloaded and previewed (`items[].preview`) |
| `no_activities` | Garmin has no runs on that date |
| `already_imported` | Every run that day is already in Greenrun (`items[].activity_id`) |
| `failed` | Runs were found but none could be downloaded or read (`items[].error`) |

Each item has a `status` of `ready`, `already_imported`, or `error`. Problems with the Garmin session
itself stop the whole sync and use the standard error shape, `{"error": {"code", "message"}}`:

| HTTP | `code` | Meaning |
| --- | --- | --- |
| 503 | `garmin_setup_required` | No usable saved sign-in, or Garmin wants MFA: run the setup command |
| 502 | `garmin_auth_failed` | Garmin rejected the credentials |
| 429 | `garmin_rate_limited` | Garmin is throttling requests; wait a few minutes |
| 502 | `garmin_unavailable` | Garmin Connect could not be reached |

## Configuration

Set these in the server's `.env`. They are read only by the backend and never sent to the browser.

| Variable | Purpose |
| --- | --- |
| `GARMIN_EMAIL` | Garmin Connect account email |
| `GARMIN_PASSWORD` | Garmin Connect account password |
| `GARMIN_TOKEN_DIR` | Where sign-in tokens are saved. The Docker images set `/data/garmin`; local development defaults to `~/.garminconnect` |

Tokens are saved as `garmin_tokens.json` (owner-only permissions) in `GARMIN_TOKEN_DIR`. In Docker that
directory is a named volume (`garmin-tokens` in `compose.prod.yml`), so tokens survive rebuilds,
updates, and restarts. The token file grants access to the Garmin account: never commit or share it.

## One-time sign-in (and MFA)

Sync requests never wait for an MFA code. Sign in once from a terminal, which saves tokens that later
syncs reuse and refresh on their own:

On the Beelink (production container):

```sh
cd /srv/apps/greenrun
docker compose -f compose.prod.yml exec -w /app/backend app python -m app.services.garmin.setup
```

Locally (from `backend/`, with the root `.env` filled in):

```sh
py -3.12 -m app.services.garmin.setup
```

Enter the code Garmin sends when prompted for `Garmin MFA code:`. Run the command again with `--force`
to discard the saved tokens and sign in from scratch, for example after changing the Garmin password or
when the Import page reports `garmin_setup_required`.

## The `garminconnect` library

Garmin has no public API for personal accounts, so the backend uses the community
[`python-garminconnect`](https://github.com/cyberjunky/python-garminconnect) library, confined to
`backend/app/services/garmin/client.py`. It is pinned to an exact version (`garminconnect==0.3.17`)
whose source was reviewed before adoption: it only contacts Garmin's own domains and stores tokens
safely. Review the source again before bumping the pin.

The library signs in the way Garmin's mobile app does. It is unofficial and can break when Garmin
changes its sign-in; frequent fresh logins can also trigger Garmin's rate limits. Saved tokens keep
full sign-ins rare.
