import FlagRounded from "@mui/icons-material/FlagRounded";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";

import { updatePlanGoal, type TrainingPlan } from "../../api/plans";
import { formatPreciseClock } from "../analytics/format";
import {
  describeGoal,
  GOAL_DISTANCE_PRESETS,
  parseTargetTime,
  UNIT_METERS,
  type DistanceUnit,
} from "./goalTarget";

const CUSTOM = "custom";

function initialDistance(plan: TrainingPlan) {
  const meters = plan.goal_target?.distance_meters;
  if (meters == null)
    return {
      preset: GOAL_DISTANCE_PRESETS[0].label as string,
      custom: "",
      unit: "mi" as DistanceUnit,
    };
  const preset = GOAL_DISTANCE_PRESETS.find(
    (item) => Math.abs(item.meters - meters) <= 1,
  );
  if (preset)
    return {
      preset: preset.label as string,
      custom: "",
      unit: "mi" as DistanceUnit,
    };
  return {
    preset: CUSTOM,
    custom: String(+(meters / UNIT_METERS.mi).toFixed(3)),
    unit: "mi" as DistanceUnit,
  };
}

/** Shows a plan's structured goal and edits it via PATCH /api/plans/{id} goal_target. */
export function GoalTargetEditor({
  plan,
  onSaved,
}: {
  plan: TrainingPlan;
  onSaved: (plan: TrainingPlan) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [preset, setPreset] = useState(() => initialDistance(plan).preset);
  const [custom, setCustom] = useState(() => initialDistance(plan).custom);
  const [unit, setUnit] = useState<DistanceUnit>(
    () => initialDistance(plan).unit,
  );
  const [time, setTime] = useState(() =>
    plan.goal_target
      ? formatPreciseClock(plan.goal_target.target_time_seconds)
      : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const customValue = Number(custom);
  const distanceMeters =
    preset === CUSTOM
      ? custom.trim() && customValue > 0
        ? customValue * UNIT_METERS[unit]
        : null
      : (GOAL_DISTANCE_PRESETS.find((item) => item.label === preset)?.meters ??
        null);
  const seconds = parseTargetTime(time);
  const distanceError =
    distanceMeters == null ? "Enter a distance greater than zero." : null;
  const timeError =
    seconds == null ? "Use m:ss or h:mm:ss, e.g. 6:00 or 1:45:00." : null;

  const submit = async (goal: TrainingPlan["goal_target"]) => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await updatePlanGoal(plan.id, goal ?? null));
      setEditing(false);
      setAttempted(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The goal could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };

  const startEditing = () => {
    const distance = initialDistance(plan);
    setPreset(distance.preset);
    setCustom(distance.custom);
    setUnit(distance.unit);
    setTime(
      plan.goal_target
        ? formatPreciseClock(plan.goal_target.target_time_seconds)
        : "",
    );
    setError(null);
    setEditing(true);
  };

  if (!editing)
    return (
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        <FlagRounded color="secondary" fontSize="small" />
        <Typography fontWeight={700}>
          {plan.goal_target
            ? `Goal: ${describeGoal(plan.goal_target)}`
            : "No structured goal"}
        </Typography>
        <Button size="small" onClick={startEditing}>
          {plan.goal_target ? "Edit goal" : "Set goal"}
        </Button>
      </Stack>
    );

  return (
    <Box
      component="form"
      aria-label={`Goal for ${plan.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        setAttempted(true);
        if (distanceMeters != null && seconds != null)
          void submit({
            distance_meters: distanceMeters,
            target_time_seconds: seconds,
          });
      }}
      sx={{
        p: 2,
        border: 1,
        borderColor: "divider",
        borderRadius: "6px",
        bgcolor: "#f5eddb",
      }}
    >
      <Stack spacing={2}>
        <Typography fontWeight={800}>
          Structured goal (time at a distance)
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            select
            label="Distance"
            value={preset}
            onChange={(event) => setPreset(event.target.value)}
            sx={{ minWidth: 180 }}
            size="small"
          >
            {GOAL_DISTANCE_PRESETS.map((item) => (
              <MenuItem key={item.label} value={item.label}>
                {item.label}
              </MenuItem>
            ))}
            <MenuItem value={CUSTOM}>Custom…</MenuItem>
          </TextField>
          {preset === CUSTOM && (
            <Stack direction="row" spacing={1}>
              <TextField
                label="Custom distance"
                size="small"
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                error={attempted && Boolean(distanceError)}
                helperText={attempted ? distanceError : undefined}
                slotProps={{ htmlInput: { inputMode: "decimal" } }}
                sx={{ width: 150 }}
              />
              <TextField
                select
                label="Unit"
                size="small"
                value={unit}
                onChange={(event) =>
                  setUnit(event.target.value as DistanceUnit)
                }
                sx={{ width: 90 }}
              >
                <MenuItem value="mi">mi</MenuItem>
                <MenuItem value="km">km</MenuItem>
                <MenuItem value="m">m</MenuItem>
              </TextField>
            </Stack>
          )}
          <TextField
            label="Target time"
            size="small"
            placeholder="6:00"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            error={attempted && Boolean(timeError)}
            helperText={attempted && timeError ? timeError : "m:ss or h:mm:ss"}
            sx={{ minWidth: 160 }}
          />
        </Stack>
        {distanceMeters != null && seconds != null && (
          <Typography variant="body2" color="text.secondary">
            {describeGoal({
              distance_meters: distanceMeters,
              target_time_seconds: seconds,
            })}
          </Typography>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button type="submit" variant="contained" disabled={busy}>
            Save goal
          </Button>
          <Button onClick={() => setEditing(false)} disabled={busy}>
            Cancel
          </Button>
          {plan.goal_target && (
            <Button
              color="warning"
              onClick={() => void submit(null)}
              disabled={busy}
            >
              Clear goal
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
