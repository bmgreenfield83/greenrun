import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Checkbox,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";

import type { ConfirmFitImport, FitImportPreview } from "../../api/fitImports";

type Props = {
  preview: FitImportPreview;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (payload: ConfirmFitImport) => void;
};

function miles(meters: number | null): string {
  return meters === null ? "—" : `${(meters / 1609.344).toFixed(2)} mi`;
}

function duration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${String(
    Math.round(seconds % 60),
  ).padStart(2, "0")}`;
}

function pace(activity: FitImportPreview["activity"]): string {
  if (!activity.distance_meters) return "—";
  const seconds =
    activity.elapsed_time_seconds / (activity.distance_meters / 1609.344);
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}/mi`;
}

function averageSpeed(activity: FitImportPreview["activity"]): string {
  return activity.summary.average_speed_mps === null
    ? "Not recorded"
    : `${(activity.summary.average_speed_mps * 2.23694).toFixed(1)} mph`;
}

export function FitImportPreviewDialog({
  preview,
  saving,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const activity = preview.activity;
  const usesPace = ["run", "walk", "hike"].includes(activity.sport);
  const showsRate = usesPace || activity.sport === "bike";
  const [title, setTitle] = useState(activity.title ?? "");
  const [category, setCategory] = useState(activity.category ?? "other");
  const [effort, setEffort] = useState(
    activity.subjective.effort?.toString() ?? "",
  );
  const [feel, setFeel] = useState(activity.subjective.feel ?? "");
  const [sleepScore, setSleepScore] = useState(
    activity.subjective.sleep_score?.toString() ?? "",
  );
  const [sleepLabel, setSleepLabel] = useState(
    activity.subjective.sleep_label ?? "",
  );
  const [pain, setPain] = useState(
    activity.subjective.pain_soreness_notes ?? "",
  );
  const [notes, setNotes] = useState(activity.subjective.notes ?? "");
  const [weather, setWeather] = useState(activity.weather_notes ?? "");
  const [duplicateAction, setDuplicateAction] = useState<
    ConfirmFitImport["duplicate_action"]
  >(preview.duplicate_matches.length ? "replace" : "create");
  const [linkSuggestion, setLinkSuggestion] = useState(
    Boolean(preview.suggested_planned_session),
  );

  const confirm = () => {
    const metadata: Record<string, unknown> = {};
    if (title !== (activity.title ?? "")) metadata.title = title || null;
    if (
      activity.sport === "run" &&
      category !== (activity.category ?? "other")
    ) {
      metadata.category = category;
    }
    if (weather !== (activity.weather_notes ?? ""))
      metadata.weather_notes = weather || null;
    const plannedSessionId = linkSuggestion
      ? activity.planned_session_id
      : null;
    if (plannedSessionId !== activity.planned_session_id) {
      metadata.planned_session_id = plannedSessionId;
    }
    const subjective: Record<string, unknown> = {};
    const effortValue = effort ? Number(effort) : null;
    const sleepScoreValue = sleepScore ? Number(sleepScore) : null;
    if (effortValue !== activity.subjective.effort)
      subjective.effort = effortValue;
    if ((feel || null) !== activity.subjective.feel)
      subjective.feel = feel || null;
    if (sleepScoreValue !== activity.subjective.sleep_score)
      subjective.sleep_score = sleepScoreValue;
    if ((sleepLabel || null) !== activity.subjective.sleep_label) {
      subjective.sleep_label = sleepLabel || null;
    }
    if ((pain || null) !== activity.subjective.pain_soreness_notes) {
      subjective.pain_soreness_notes = pain || null;
    }
    if ((notes || null) !== activity.subjective.notes)
      subjective.notes = notes || null;
    if (Object.keys(subjective).length) metadata.subjective = subjective;
    onConfirm({
      preview_token: preview.preview_token,
      duplicate_action: duplicateAction,
      duplicate_activity_id:
        duplicateAction === "replace"
          ? preview.duplicate_matches[0]?.activity_id
          : undefined,
      metadata,
    });
  };

  return (
    <Dialog
      open
      fullWidth
      maxWidth="md"
      onClose={saving ? undefined : onCancel}
    >
      <DialogTitle>Review Garmin FIT activity</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}
          {preview.duplicate_matches.length > 0 && (
            <Alert severity="warning" icon={<WarningAmberRounded />}>
              A likely duplicate activity was found. Choose how to continue.
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography color="text.secondary">Date</Typography>
              <Typography>{activity.local_date}</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography color="text.secondary">Distance</Typography>
              <Typography>{miles(activity.distance_meters)}</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography color="text.secondary">Duration</Typography>
              <Typography>{duration(activity.elapsed_time_seconds)}</Typography>
            </Grid>
            {showsRate && (
              <Grid size={{ xs: 6, md: 3 }}>
                <Typography color="text.secondary">
                  {usesPace ? "Average pace" : "Average speed"}
                </Typography>
                <Typography>
                  {usesPace ? pace(activity) : averageSpeed(activity)}
                </Typography>
              </Grid>
            )}
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography color="text.secondary">Average HR</Typography>
              <Typography>
                {activity.summary.average_heart_rate ?? "—"}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography color="text.secondary">Maximum HR</Typography>
              <Typography>
                {activity.summary.maximum_heart_rate ?? "—"}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography color="text.secondary">
                Cadence ({activity.sport === "bike" ? "RPM" : "SPM"})
              </Typography>
              <Typography>
                {activity.summary.average_cadence_spm
                  ? `${Math.round(activity.summary.average_cadence_spm)} ${
                      activity.sport === "bike" ? "rpm" : "spm"
                    }`
                  : "—"}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography color="text.secondary">Elevation gain</Typography>
              <Typography>
                {activity.summary.elevation_gain_meters === null
                  ? "—"
                  : `${Math.round(activity.summary.elevation_gain_meters * 3.28084)} ft`}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography color="text.secondary">Temperature</Typography>
              <Typography>
                {activity.summary.temperature_celsius === null
                  ? "—"
                  : `${Math.round((activity.summary.temperature_celsius * 9) / 5 + 32)}°F`}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography color="text.secondary">Humidity</Typography>
              <Typography>
                {activity.summary.humidity_percent === null
                  ? "—"
                  : `${Math.round(activity.summary.humidity_percent)}%`}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography color="text.secondary">Laps</Typography>
              <Typography>{activity.laps.length}</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography color="text.secondary">Stored samples</Typography>
              <Typography>{preview.sample_count}</Typography>
            </Grid>
          </Grid>
          {preview.suggested_planned_session && (
            <Alert severity="info">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={linkSuggestion}
                    onChange={(event) =>
                      setLinkSuggestion(event.target.checked)
                    }
                  />
                }
                label={`Link to ${preview.suggested_planned_session.title} on ${preview.suggested_planned_session.scheduled_date}`}
              />
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                label="Title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                fullWidth
              />
            </Grid>
            {activity.sport === "run" && (
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="category-label">Category</InputLabel>
                  <Select
                    labelId="category-label"
                    label="Category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    {[
                      "easy",
                      "long",
                      "track",
                      "tempo",
                      "recovery",
                      "race",
                      "trail",
                      "progression",
                      "run_club",
                      "other",
                    ].map((value) => (
                      <MenuItem key={value} value={value}>
                        {value.replace("_", " ")}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                label="Effort (0–10)"
                type="number"
                value={effort}
                onChange={(e) => setEffort(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField
                label="Feel"
                value={feel}
                onChange={(e) => setFeel(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                label="Sleep score"
                type="number"
                value={sleepScore}
                onChange={(e) => setSleepScore(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel id="sleep-label">Sleep</InputLabel>
                <Select
                  labelId="sleep-label"
                  label="Sleep"
                  value={sleepLabel}
                  onChange={(e) => setSleepLabel(e.target.value)}
                >
                  <MenuItem value="">Not recorded</MenuItem>
                  {["poor", "fair", "good", "great"].map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Pain / soreness"
                value={pain}
                onChange={(e) => setPain(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                fullWidth
                multiline
                minRows={3}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Weather notes"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>
          {preview.duplicate_matches.length > 0 && (
            <FormControl>
              <RadioGroup
                value={duplicateAction}
                onChange={(event) =>
                  setDuplicateAction(
                    event.target.value as ConfirmFitImport["duplicate_action"],
                  )
                }
              >
                <FormControlLabel
                  value="replace"
                  control={<Radio />}
                  label="Replace existing activity"
                />
                <FormControlLabel
                  value="import_duplicate"
                  control={<Radio />}
                  label="Import as duplicate"
                />
              </RadioGroup>
            </FormControl>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={confirm} disabled={saving}>
          {saving ? "Saving…" : "Save activity"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
