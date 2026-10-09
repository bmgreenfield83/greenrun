import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import type { Activity } from "../../api/activities";
import {
  applyAiReview,
  createAiReview,
  getAiReview,
  getAiReviewContext,
  getAiReviewStatus,
  listAiReviews,
  replyToAiReview,
  type AiReview,
  type AiReviewApplyResult,
  type AiReviewSession,
  type AiSessionChange,
} from "../../api/aiReviews";
import { SectionTitle } from "../../components/common/SectionTitle";

const REVIEWABLE = new Set(["track", "tempo", "race", "progression"]);
const METERS_PER_MILE = 1609.344;

const EXECUTION_LABELS: Record<AiReview["review"]["execution"], string> = {
  as_prescribed: "As prescribed",
  partly_as_prescribed: "Partly as prescribed",
  not_as_prescribed: "Not as prescribed",
  unclear: "Unclear",
};

type Busy = "loading" | "reviewing" | "replying" | "applying" | null;

function changedFields(change: AiSessionChange, session: AiReviewSession) {
  const miles = (meters: number | null) =>
    meters == null ? "—" : `${(meters / METERS_PER_MILE).toFixed(1)} mi`;
  const minutes = (seconds: number | null) =>
    seconds == null ? "—" : `${Math.round(seconds / 60)} min`;
  return [
    ["Title", session.title, change.title],
    [
      "Distance",
      miles(session.planned_distance_meters),
      change.planned_distance_miles == null
        ? null
        : `${change.planned_distance_miles} mi`,
    ],
    [
      "Duration",
      minutes(session.planned_duration_seconds),
      change.planned_duration_minutes == null
        ? null
        : `${change.planned_duration_minutes} min`,
    ],
    ["Instructions", session.instructions ?? "—", change.instructions],
    ["Purpose", session.justification ?? "—", change.justification],
  ].filter((row): row is [string, string, string] => row[2] != null);
}

function money(value: number | null) {
  return value == null ? "unknown cost" : `$${value.toFixed(3)}`;
}

/**
 * For quality runs when green-ai is configured: run an AI review, discuss it, and apply the
 * proposed changes to upcoming sessions. Nothing changes in the plan until Brett applies it.
 */
export function AiReviewSection({ activity }: { activity: Activity }) {
  const reviewable =
    activity.sport === "run" && REVIEWABLE.has(activity.category ?? "");
  const [enabled, setEnabled] = useState(false);
  const [review, setReview] = useState<AiReview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [applyResult, setApplyResult] = useState<AiReviewApplyResult | null>(
    null,
  );
  const [context, setContext] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);

  const show = (value: AiReview) => {
    setReview(value);
    setSelected(
      new Set(
        value.review.proposed_changes
          .map((change) => change.session_id)
          .filter((id) => !value.applied[id]),
      ),
    );
  };

  useEffect(() => {
    if (!reviewable) return;
    let cancelled = false;
    setReview(null);
    setApplyResult(null);
    getAiReviewStatus()
      .then(async ({ enabled: isEnabled }) => {
        if (cancelled) return;
        setEnabled(isEnabled);
        if (!isEnabled) return;
        setBusy("loading");
        const reviews = await listAiReviews(activity.id);
        if (!cancelled && reviews.length > 0)
          show(await getAiReview(reviews[0].id));
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [reviewable, activity.id]);

  if (!reviewable || !enabled) return null;

  const run = async (kind: Busy, action: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const startReview = () =>
    run("reviewing", async () => {
      setApplyResult(null);
      setContext(null);
      show(await createAiReview(activity.id));
    });

  const sendReply = () =>
    run("replying", async () => {
      if (!review) return;
      show(await replyToAiReview(review.id, message.trim()));
      setMessage("");
    });

  const applySelected = () =>
    run("applying", async () => {
      if (!review) return;
      const result = await applyAiReview(review.id, [...selected]);
      setApplyResult(result);
      show(result.review);
    });

  const openContext = () => {
    setContextOpen(true);
    if (review && context == null)
      getAiReviewContext(review.id)
        .then(setContext)
        .catch((reason: Error) =>
          setContext(`Could not load: ${reason.message}`),
        );
  };

  const sessions = new Map(
    (review?.editable_sessions ?? []).map((session) => [session.id, session]),
  );

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <SectionTitle
            action={
              <Button
                variant={review ? "outlined" : "contained"}
                disabled={busy != null}
                onClick={() => void startReview()}
              >
                {review ? "New review" : "Review with AI"}
              </Button>
            }
          >
            AI review
          </SectionTitle>
          {error && <Alert severity="error">{error}</Alert>}
          {busy === "reviewing" && (
            <Stack spacing={1}>
              <LinearProgress />
              <Typography color="text.secondary">
                Reviewing this session against your plan. This usually takes
                20–30 seconds.
              </Typography>
            </Stack>
          )}
          {!review && busy == null && (
            <Typography color="text.secondary">
              Sends this session, your runs and notes from the last few weeks,
              and your plan to OpenAI, then suggests changes to the rest of this
              week and next week. Nothing changes until you apply it. A review
              costs a few cents.
            </Typography>
          )}
          {review && busy !== "reviewing" && (
            <Stack spacing={2}>
              <Typography fontWeight={700}>
                {review.review.recommendation}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="baseline">
                <Chip
                  size="small"
                  label={EXECUTION_LABELS[review.review.execution]}
                />
                <Typography>{review.review.verdict}</Typography>
              </Stack>
              {review.review.health_flags.length > 0 && (
                <Alert severity="warning">
                  {review.review.health_flags.map((flag) => (
                    <div key={flag}>{flag}</div>
                  ))}
                </Alert>
              )}
              {review.review.observations.length > 0 && (
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {review.review.observations.map((item) => (
                    <li key={item}>
                      <Typography>{item}</Typography>
                    </li>
                  ))}
                </Box>
              )}

              <Typography variant="h6" component="h3">
                Proposed changes
              </Typography>
              {review.review.proposed_changes.length === 0 && (
                <Typography color="text.secondary">
                  No changes proposed. Keep the plan as it is.
                </Typography>
              )}
              {review.review.proposed_changes.map((change) => {
                const session = sessions.get(change.session_id);
                if (!session) return null;
                const applied = Boolean(review.applied[change.session_id]);
                return (
                  <Box
                    key={change.session_id}
                    sx={{ border: 1, borderColor: "divider", p: 1.5 }}
                  >
                    <Stack spacing={1}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <FormControlLabel
                          disabled={applied || busy != null}
                          control={
                            <Checkbox
                              checked={
                                applied || selected.has(change.session_id)
                              }
                              onChange={(event) => {
                                const next = new Set(selected);
                                if (event.target.checked)
                                  next.add(change.session_id);
                                else next.delete(change.session_id);
                                setSelected(next);
                              }}
                            />
                          }
                          label={
                            <Typography fontWeight={700}>
                              {session.scheduled_date} · {session.title}
                            </Typography>
                          }
                        />
                        {applied && (
                          <Chip size="small" color="success" label="Applied" />
                        )}
                      </Stack>
                      <Typography color="text.secondary">
                        {change.reason}
                      </Typography>
                      {changedFields(change, session).map(
                        ([label, before, after]) => (
                          <Box key={label}>
                            <Typography
                              variant="overline"
                              color="text.secondary"
                            >
                              {label}
                            </Typography>
                            <Typography
                              sx={{ textDecoration: "line-through" }}
                              color="text.secondary"
                            >
                              {before}
                            </Typography>
                            <Typography>{after}</Typography>
                          </Box>
                        ),
                      )}
                    </Stack>
                  </Box>
                );
              })}
              {review.review.proposed_changes.length > 0 && (
                <Box>
                  <Button
                    variant="contained"
                    disabled={selected.size === 0 || busy != null}
                    onClick={() => void applySelected()}
                  >
                    Apply selected ({selected.size})
                  </Button>
                </Box>
              )}
              {applyResult && (
                <Alert
                  severity={applyResult.skipped.length ? "warning" : "success"}
                >
                  {applyResult.applied.length > 0 &&
                    `Applied ${applyResult.applied.length} change${applyResult.applied.length === 1 ? "" : "s"}. `}
                  {applyResult.skipped.map((item) => (
                    <div key={item.session_id}>
                      {sessions.get(item.session_id)?.title ?? item.session_id}:{" "}
                      {item.reason}
                    </div>
                  ))}
                </Alert>
              )}

              {review.review.later_week_flags.length > 0 && (
                <Stack spacing={0.5}>
                  <Typography variant="h6" component="h3">
                    Later weeks
                  </Typography>
                  {review.review.later_week_flags.map((flag) => (
                    <Typography key={`${flag.week_number}-${flag.concern}`}>
                      <strong>Week {flag.week_number}:</strong> {flag.concern}{" "}
                      {flag.suggestion}
                    </Typography>
                  ))}
                </Stack>
              )}

              {review.conversation.length > 0 && (
                <Stack spacing={1}>
                  <Typography variant="h6" component="h3">
                    Conversation
                  </Typography>
                  {review.conversation.map((turn, index) => (
                    <Stack key={index} spacing={0.5}>
                      <Typography>
                        <strong>You:</strong> {turn.message}
                      </Typography>
                      <Typography>
                        <strong>Coach:</strong> {turn.reply}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
              <Stack spacing={1}>
                <TextField
                  label="Reply to the coach"
                  placeholder="e.g. The calf has felt fine since Tuesday; I'd rather trim the session than cancel it."
                  multiline
                  minRows={2}
                  value={message}
                  disabled={busy != null}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <Stack direction="row" spacing={2} alignItems="center">
                  <Button
                    variant="outlined"
                    disabled={!message.trim() || busy != null}
                    onClick={() => void sendReply()}
                  >
                    Send reply
                  </Button>
                  {busy === "replying" && (
                    <Typography color="text.secondary">
                      Revising… about 10 seconds.
                    </Typography>
                  )}
                </Stack>
              </Stack>
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                flexWrap="wrap"
              >
                <Typography variant="caption" color="text.secondary">
                  {review.model} · {money(review.total_cost_usd)} so far
                </Typography>
                <Button size="small" onClick={openContext}>
                  See what was sent
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      </CardContent>
      <Dialog
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Sent to OpenAI for this review</DialogTitle>
        <DialogContent>
          <Typography
            component="pre"
            sx={{
              whiteSpace: "pre-wrap",
              fontFamily: "monospace",
              fontSize: 12,
            }}
          >
            {context ?? "Loading…"}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContextOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
