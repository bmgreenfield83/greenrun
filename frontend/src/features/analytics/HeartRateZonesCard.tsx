import { Box, Grid, Stack, Tooltip, Typography } from "@mui/material";

import type { HeartRateZoneAnalytics, ZoneWeek } from "../../api/analytics";
import { AnalyticsCard } from "./AnalyticsCard";
import { zoneColors } from "./chartTheme";
import { categoryLabel, hoursMinutes } from "./format";
import { HeartRateSettingsMissing } from "./HeartRateSettingsMissing";
import { ZoneTable } from "./ZoneTable";
import { ZoneWeeksChart } from "./ZoneWeeksChart";

/** Sums zone time over the last `count` weeks. */
function recentDistribution(weeks: ZoneWeek[], count: number) {
  const recent = weeks.slice(-count);
  const seconds = [0, 1, 2, 3, 4].map((index) =>
    recent.reduce((sum, week) => sum + (week.zone_seconds[index] ?? 0), 0),
  );
  const total = seconds.reduce((sum, value) => sum + value, 0);
  const runs = recent.reduce((sum, week) => sum + week.run_count, 0);
  return { seconds, total, runs };
}

/** One horizontal 100% bar with a percentage label per zone. */
function DistributionBar({
  seconds,
  total,
}: {
  seconds: number[];
  total: number;
}) {
  return (
    <Stack spacing={0.75}>
      <Stack
        direction="row"
        sx={{ height: 22, borderRadius: 1.5, overflow: "hidden", gap: "2px" }}
        role="img"
        aria-label={seconds
          .map(
            (value, index) =>
              `Z${index + 1} ${Math.round((value / total) * 100)}%`,
          )
          .join(", ")}
      >
        {seconds.map((value, index) =>
          value > 0 ? (
            <Tooltip
              key={index}
              title={`Z${index + 1}: ${hoursMinutes(value)}`}
            >
              <Box sx={{ flex: value, bgcolor: zoneColors[index] }} />
            </Tooltip>
          ) : null,
        )}
      </Stack>
      <Stack direction="row" flexWrap="wrap" columnGap={1.5} rowGap={0.25}>
        {seconds.map((value, index) => (
          <Typography
            key={index}
            variant="caption"
            color="text.secondary"
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            <Box
              component="span"
              sx={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "2px",
                bgcolor: zoneColors[index],
                mr: 0.5,
              }}
            />
            Z{index + 1} {Math.round((value / total) * 100)}%
          </Typography>
        ))}
      </Stack>
    </Stack>
  );
}

/** HR-reserve zones, weekly time in zones, and the easy-run zone distribution. */
export function HeartRateZonesCard({
  zones,
  loading,
  error,
}: {
  zones: HeartRateZoneAnalytics | null;
  loading: boolean;
  error: string | null;
}) {
  const missing = zones?.status === "heart_rate_settings_missing";
  const easy = zones
    ? recentDistribution(zones.easy_run_weekly_distribution, 4)
    : null;
  const easyLabel =
    zones?.easy_run_categories.map(categoryLabel).join(" and ") ??
    "easy and recovery";
  return (
    <AnalyticsCard
      title="Heart-rate zones"
      description={
        zones && !missing
          ? `Heart-rate-reserve zones from max ${zones.max_heart_rate_bpm} and resting ${zones.resting_heart_rate_bpm} bpm. Stops and gaps over 15 s are excluded.`
          : "Heart-rate-reserve (Karvonen) zones from your max and resting heart rate."
      }
      loading={loading}
      error={error}
    >
      {missing ? (
        <HeartRateSettingsMissing message={zones?.message} />
      ) : zones ? (
        <Stack spacing={3}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 5 }}>
              <ZoneTable zones={zones.zones} />
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Typography variant="h6" component="h3">
                Weekly time in zones
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
              >
                Minutes per week, all runs. The last week is in progress.
              </Typography>
              <ZoneWeeksChart
                weeks={zones.weekly_time_in_zones}
                mode="minutes"
              />
            </Grid>
          </Grid>
          <Box>
            <Typography variant="h6" component="h3">
              Easy runs: time by zone
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              How time on {easyLabel} runs splits across zones — a distribution
              to watch, not a pass/fail test.
            </Typography>
            {easy && easy.total > 0 ? (
              <Stack spacing={2}>
                <Box>
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    component="p"
                  >
                    Last 4 weeks · {easy.runs} run{easy.runs === 1 ? "" : "s"} ·{" "}
                    {hoursMinutes(easy.total)}
                  </Typography>
                  <DistributionBar seconds={easy.seconds} total={easy.total} />
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="p"
                  >
                    Share of each week's easy-run time
                  </Typography>
                  <ZoneWeeksChart
                    weeks={zones.easy_run_weekly_distribution}
                    mode="percent"
                    height={200}
                  />
                </Box>
              </Stack>
            ) : (
              <Typography color="text.secondary">
                No {easyLabel} runs with heart rate in the last 4 weeks.
              </Typography>
            )}
          </Box>
        </Stack>
      ) : null}
    </AnalyticsCard>
  );
}
