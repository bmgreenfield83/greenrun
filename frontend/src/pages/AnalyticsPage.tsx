import RefreshRounded from "@mui/icons-material/RefreshRounded";
import {
  Alert,
  Button,
  Grid,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { useState } from "react";

import {
  getAnalytics,
  getEasyPaceHeartRate,
  getGoalProgress,
  getHeartRateZones,
  recalculateHeartRateResponse,
} from "../api/analytics";
import { PageHeader } from "../components/common/PageHeader";
import { EasyPaceHeartRateCard } from "../features/analytics/EasyPaceHeartRateCard";
import { GoalCard } from "../features/analytics/GoalCard";
import { HeartRateResponseCard } from "../features/analytics/HeartRateResponseCard";
import { HeartRateZonesCard } from "../features/analytics/HeartRateZonesCard";
import { PlanProgressCard } from "../features/analytics/PlanProgressCard";
import { RecordsCard } from "../features/analytics/RecordsCard";
import { TrainingLoadCard } from "../features/analytics/TrainingLoadCard";
import { useAsync } from "../features/analytics/useAsync";
import { useTemperatureUnit } from "../features/analytics/useTemperatureUnit";
import { WeeklyVolumeCard } from "../features/analytics/WeeklyVolumeCard";

export function AnalyticsPage() {
  const summary = useAsync(getAnalytics);
  const goal = useAsync(getGoalProgress);
  const zones = useAsync(getHeartRateZones);
  const easyPace = useAsync(getEasyPaceHeartRate);
  const [unit, setUnit] = useTemperatureUnit();
  const [recalculating, setRecalculating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const recalculate = () => {
    setRecalculating(true);
    setActionError(null);
    void recalculateHeartRateResponse()
      .then(summary.reload)
      .catch((reason: Error) => setActionError(reason.message))
      .finally(() => setRecalculating(false));
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Analytics"
        description="Transparent summaries of recorded runs and the active plan. Heart-rate figures are estimates with stated limits."
        actions={
          <>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={unit}
              onChange={(_event, value: "F" | "C" | null) =>
                value && setUnit(value)
              }
              aria-label="Temperature unit"
            >
              <ToggleButton value="F" aria-label="Fahrenheit">
                °F
              </ToggleButton>
              <ToggleButton value="C" aria-label="Celsius">
                °C
              </ToggleButton>
            </ToggleButtonGroup>
            <Button
              startIcon={<RefreshRounded />}
              disabled={recalculating}
              onClick={recalculate}
            >
              {recalculating ? "Recalculating…" : "Recalculate HR response"}
            </Button>
          </>
        }
      />
      {actionError && <Alert severity="error">{actionError}</Alert>}
      <GoalCard
        goal={goal.data}
        loading={goal.loading && !goal.data}
        error={goal.error}
      />
      <Grid container spacing={3}>
        <Grid
          size={{ xs: 12, lg: summary.data?.plan_progress === null ? 12 : 8 }}
        >
          <WeeklyVolumeCard
            weeks={summary.data?.weekly_volume}
            thresholdPercent={
              summary.data?.weekly_volume_increase_threshold_percent
            }
            loading={summary.loading && !summary.data}
            error={summary.error}
          />
        </Grid>
        {summary.data?.plan_progress !== null && (
          <Grid size={{ xs: 12, lg: 4 }}>
            <PlanProgressCard
              progress={summary.data?.plan_progress}
              loading={summary.loading && !summary.data}
              error={summary.error}
            />
          </Grid>
        )}
      </Grid>
      <TrainingLoadCard
        zones={zones.data}
        loading={zones.loading && !zones.data}
        error={zones.error}
      />
      <HeartRateZonesCard
        zones={zones.data}
        loading={zones.loading && !zones.data}
        error={zones.error}
      />
      <EasyPaceHeartRateCard
        data={easyPace.data}
        loading={easyPace.loading && !easyPace.data}
        error={easyPace.error}
        unit={unit}
      />
      <HeartRateResponseCard
        history={summary.data?.heart_rate_response_history}
        algorithmVersion={summary.data?.heart_rate_response_algorithm_version}
        unit={unit}
        loading={summary.loading && !summary.data}
        error={summary.error}
        recalculating={recalculating}
        onRecalculate={recalculate}
      />
      <RecordsCard
        summary={summary.data}
        loading={summary.loading && !summary.data}
        error={summary.error}
      />
    </Stack>
  );
}
