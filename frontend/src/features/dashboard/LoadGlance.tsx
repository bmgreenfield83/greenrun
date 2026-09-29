import { Chip, Skeleton, Stack, Typography } from "@mui/material";

import type { HeartRateZoneAnalytics, LoadBand } from "../../api/analytics";
import { StatValue } from "../../components/common/StatValue";
import { LoadRatioScale } from "../analytics/LoadRatioScale";
import { GlanceCard } from "./GlanceCard";

const bandLabel: Record<LoadBand, string> = {
  low: "Low",
  typical: "Typical",
  elevated: "Elevated",
  spike: "Spike",
};

const bandChipColor: Record<
  LoadBand,
  "default" | "success" | "warning" | "error"
> = {
  low: "default",
  typical: "success",
  elevated: "warning",
  spike: "error",
};

/** Compact acute:chronic training-load gauge with its band. */
export function LoadGlance({
  zones,
  loading,
}: {
  zones: HeartRateZoneAnalytics | null;
  loading: boolean;
}) {
  const load = zones?.training_load ?? null;
  const missing = zones?.status === "heart_rate_settings_missing";
  return (
    <GlanceCard
      label="Training load"
      href={missing ? "/settings" : "/analytics"}
      linkLabel={
        missing
          ? "Training load: open settings"
          : "Training load: open analytics"
      }
    >
      {loading ? (
        <Skeleton variant="rounded" height={56} />
      ) : missing ? (
        <Typography color="text.secondary" variant="body2">
          Add your max and resting heart rate in Settings to see training load.
        </Typography>
      ) : load ? (
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <StatValue
              size="sm"
              value={load.acute_chronic_ratio?.toFixed(2) ?? "—"}
            />
            {load.ratio_band && (
              <Chip
                size="small"
                color={bandChipColor[load.ratio_band]}
                label={bandLabel[load.ratio_band]}
              />
            )}
            <Typography variant="caption" color="text.secondary">
              acute : chronic
            </Typography>
          </Stack>
          {load.acute_chronic_ratio != null ? (
            <LoadRatioScale load={load} compact />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Building history: the ratio needs a few weeks of heart-rate runs.
            </Typography>
          )}
        </Stack>
      ) : (
        <Typography color="text.secondary" variant="body2">
          Training load is unavailable.
        </Typography>
      )}
    </GlanceCard>
  );
}
