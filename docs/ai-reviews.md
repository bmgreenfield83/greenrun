# AI track-session reviews

On a track, tempo, race, or progression activity, **Review with AI** asks a model to assess the
session against the plan and propose changes to the sessions that follow. Brett can reply to the
review, see exactly what was sent, and apply the changes he agrees with. Nothing in the plan changes
until he applies a change.

The feature is optional. With `GREEN_AI_URL` empty, the section does not appear and the rest of the app
is unaffected.

## How it fits together

```
Browser ──► Greenrun backend (/api/ai-reviews) ──► green-ai service ──► OpenAI
                    │                                   │
                    └── applies approved changes        └── reads Greenrun's API (read-only)
```

- **Greenrun never calls an AI provider.** The separate green-ai service (its own repository) builds
  the request from Greenrun's read endpoints, calls the model, validates the answer, and stores the
  review with its cost.
- **green-ai never writes to Greenrun.** Greenrun's backend applies approved changes through its own
  session service.
- The browser only talks to Greenrun. green-ai is reachable only on the private `green` Docker network.

## What is sent

For the reviewed session: its laps, 5-second samples (heart rate, pace, cadence, elevation; no GPS),
notes and subjective ratings. For context: the last six weeks of quality sessions (laps and notes),
every run from the last four weeks with notes, weekly mileage, max and resting heart rate, and the plan
outline with goals. **See what was sent** shows the exact text for each review.

## What can change

- Only planned sessions after the reviewed run, through the end of the following week.
- Only title, distance, duration, instructions, and justification. Dates never move.
- Each proposal has its own checkbox. **Apply selected** re-checks every session first and skips it,
  with a reason, if it is no longer planned or was edited after the review was written.

## Replies

Replies continue the same review: the model answers and revises only what changes. Replies are much
cheaper than a new review because the context is already cached. Brett has the final say: if he
disagrees with a change, the model withdraws it so the plan stands as written, without restating the
concern.

## How conservative the coach is

The plan stands by default. Niggles, including soreness, tightness, intermittent numbness, low HRV and
poor sleep, are noted but do not change sessions: no cut mileage, no removed strides, no slower pace
targets. Sessions change only after a clearly failed comparable workout, illness, or a red flag (pain
that changes gait or stops a run, sharp or worsening pain, or symptoms Brett says are getting worse).
This is set in green-ai's prompt (`v6`); a review keeps the prompt it started with, so start a new
review to get the current behavior.

## Cost and time

With GPT-6.1 Sol, a review takes about 25 seconds and costs about 5–6 cents; a reply takes about
10 seconds and costs about 1 cent. The review shows its running cost.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/ai-reviews/status` | `{"enabled": bool}` |
| GET | `/api/ai-reviews?activity_id=` | Reviews for an activity, newest first |
| POST | `/api/ai-reviews` | Run a review (`{"activity_id"}`); about 25 seconds |
| GET | `/api/ai-reviews/{id}` | The review, proposals, conversation, and cost |
| GET | `/api/ai-reviews/{id}/context` | Exactly what was sent, as plain text |
| POST | `/api/ai-reviews/{id}/replies` | Reply (`{"message"}`) |
| POST | `/api/ai-reviews/{id}/apply` | Apply proposals (`{"session_ids"}`); returns applied and skipped |

Errors from green-ai or OpenAI return HTTP 502 with a readable message; an unconfigured server returns
503 `ai_reviews_disabled`.

## Configuration

`GREEN_AI_URL` in the root `.env`: `http://green-ai:8000` on the Beelink, or the local green-ai address
in development. Deployment steps are in [deployment.md](deployment.md#ai-reviews-green-ai).
