import { Alert, Box, Chip, Grid, Stack, Typography } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  HeartRateZoneAnalytics,
  LoadBand,
  TrainingLoad,
  TrainingLoadDay,
} from "../../api/analytics";
import { AnalyticsCard, Figure } from "./AnalyticsCard";
import { axisTick, gridStroke, seriesColors, tooltipStyle } from "./chartTheme";
import { HeartRateSettingsMissing } from "./HeartRateSettingsMissing";
import { shortDate } from "./format";
import { niceTicks } from "./format";

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

/** Horizontal band scale (0–2.0) with a marker at the current ratio. */
function RatioScale({ load }: { load: TrainingLoad }) {
  const max = 2;
  const ratio = load.acute_chronic_ratio;
  const colors: Record<LoadBand, string> = {
    low: "#d6e4e6",
    typical: "#cfe7da",
    elevated: "#fbe3c1",
    spike: "#f6cfc9",
  };
  return (
    <Box sx={{ position: "relative", pt: 2.5 }} aria-hidden>
      <Stack
        direction="row"
        sx={{ height: 10, borderRadius: 999, overflow: "hidden" }}
      >
        {load.bands.map((band) => {
          const lower = band.lower ?? 0;
          const upper = Math.min(band.upper ?? max, max);
          return (
            <Box
              key={band.label}
              sx={{
                width: `${((upper - lower) / max) * 100}%`,
                bgcolor: colors[band.label],
              }}
            />
          );
        })}
      </Stack>
      <Stack direction="row" sx={{ mt: 0.5, position: "relative", height: 16 }}>
        {load.bands
          .filter((band) => band.lower != null)
          .map((band) => (
            <Typography
              key={band.label}
              variant="caption"
              color="text.secondary"
              sx={{
                position: "absolute",
                left: `${(band.lower! / max) * 100}%`,
                transform: "translateX(-50%)",
                lineHeight: 1,
              }}
            >
              {band.lower!.toFixed(1)}
            </Typography>
          ))}
      </Stack>
      {ratio != null && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: `${(Math.min(ratio, max) / max) * 100}%`,
            transform: "translateX(-50%)",
            textAlign: "center",
          }}
        >
          <Typography variant="caption" fontWeight={800} sx={{ lineHeight: 1 }}>
            {ratio.toFixed(2)}
          </Typography>
          <Box
            sx={{
              width: 3,
              height: 16,
              bgcolor: "text.primary",
              mx: "auto",
              borderRadius: 1,
            }}
          />
        </Box>
      )}
    </Box>
  );
}

/** Acute vs chronic TRIMP load with the ratio shown as guidance, plus daily TRIMP. */
export function TrainingLoadCard({
  zones,
  loading,
  error,
}: {
  zones: HeartRateZoneAnalytics | null;
  loading: boolean;
  error: string | null;
}) {
  const load = zones?.training_load;
  const band = load?.ratio_band
    ? load.bands.find((item) => item.label === load.ratio_band)
    : undefined;
  const days = load?.days ?? [];
  const trimpTicks = niceTicks(
    0,
    Math.max(10, ...days.map((day) => day.trimp)),
    4,
  );
  const acuteStart = days.at(-(load?.acute_days ?? 7))?.day;
  return (
    <AnalyticsCard
      title="Training load"
      description="Edwards TRIMP: minutes in each heart-rate zone weighted 1–5. Acute = last 7 days; chronic = average week over the last 28 days."
      loading={loading}
      error={error}
    >
      {zones?.status === "heart_rate_settings_missing" ? (
        <HeartRateSettingsMissing message={zones.message} />
      ) : load ? (
        <Stack spacing={2.5}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Figure
                label="Acute (7 days)"
                value={Math.round(load.acute_load)}
                detail="TRIMP"
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Figure
                label="Chronic (avg week)"
                value={Math.round(load.chronic_load)}
                detail="TRIMP"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="overline" color="text.secondary">
                    Acute : chronic ratio
                  </Typography>
                  {load.ratio_band && (
                    <Chip
                      size="small"
                      variant="outlined"
                      color={bandChipColor[load.ratio_band]}
                      label={bandLabel[load.ratio_band]}
                    />
                  )}
                </Stack>
                <Typography
                  color="primary.dark"
                  sx={{
                    fontWeight: 750,
                    fontSize: { xs: "1.2rem", sm: "1.4rem" },
                    lineHeight: 1.2,
                  }}
                >
                  {load.acute_chronic_ratio == null
                    ? "Not enough history"
                    : load.acute_chronic_ratio.toFixed(2)}
                </Typography>
                {band && (
                  <Typography variant="body2" color="text.secondary">
                    {band.description}
                  </Typography>
                )}
                <RatioScale load={load} />
              </Stack>
            </Grid>
          </Grid>
          <Alert severity="info" variant="outlined">
            <strong>Guidance, not a rule.</strong> {load.guidance}
            {!load.chronic_history_complete &&
              " Recorded history is shorter than 28 days, so no ratio is shown yet."}
          </Alert>
          <Box>
            <Typography variant="h6" component="h3">
              Daily TRIMP
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p">
              Last {days.length} days. The shaded span is the 7-day acute
              window.
              {zones && zones.runs_without_heart_rate > 0
                ? ` ${zones.runs_without_heart_rate} run${zones.runs_without_heart_rate === 1 ? "" : "s"} without heart rate count as zero.`
                : ""}
            </Typography>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={days}
                margin={{ top: 12, right: 8, bottom: 0, left: -12 }}
                barCategoryGap={1}
              >
                <CartesianGrid
                  stroke={gridStroke}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                {acuteStart && (
                  <ReferenceArea
                    x1={acuteStart}
                    x2={days.at(-1)!.day}
                    fill={seriesColors.secondary}
                    fillOpacity={0.1}
                    strokeOpacity={0}
                  />
                )}
                <XAxis
                  dataKey="day"
                  tickFormatter={shortDate}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={{ stroke: gridStroke }}
                  minTickGap={28}
                />
                <YAxis
                  ticks={trimpTicks}
                  domain={[0, trimpTicks[trimpTicks.length - 1]]}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(23,74,91,.06)" }}
                  content={({ active, payload }) => {
                    const day = payload?.[0]?.payload as
                      TrainingLoadDay | undefined;
                    return active && day ? (
                      <Box sx={tooltipStyle}>
                        <Typography variant="body2" fontWeight={700}>
                          {shortDate(day.day)}
                        </Typography>
                        <Typography variant="body2">
                          TRIMP {Math.round(day.trimp)} · {day.run_count} run
                          {day.run_count === 1 ? "" : "s"}
                        </Typography>
                      </Box>
                    ) : null;
                  }}
                />
                <Bar
                  dataKey="trimp"
                  name="TRIMP"
                  fill={seriesColors.primary}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Stack>
      ) : (
        <Typography color="text.secondary">
          No training load is available yet.
        </Typography>
      )}
    </AnalyticsCard>
  );
}
