import { Box, Stack, Typography } from "@mui/material";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { WeeklyVolumeWeek } from "../../api/analytics";
import { AnalyticsCard } from "./AnalyticsCard";
import { ChartLegend } from "./ChartLegend";
import {
  axisTick,
  cursorFill,
  gridStroke,
  seriesColors,
  tooltipStyle,
} from "./chartTheme";
import { formatMiles, shortDate } from "./format";
import { niceTicks } from "./format";

type WeeklyVolumeCardProps = {
  weeks: WeeklyVolumeWeek[] | undefined;
  thresholdPercent: number | undefined;
  loading: boolean;
  error: string | null;
};

function WeekTooltip({
  week,
  threshold,
}: {
  week: WeeklyVolumeWeek;
  threshold: number;
}) {
  return (
    <Box sx={tooltipStyle}>
      <Typography variant="body2" fontWeight={700}>
        {shortDate(week.week_start)} – {shortDate(week.week_end)}
        {week.is_partial ? " (in progress)" : ""}
      </Typography>
      <Typography variant="body2">
        {formatMiles(week.miles)} · {week.run_count} run
        {week.run_count === 1 ? "" : "s"}
      </Typography>
      {week.planned_miles != null && (
        <Typography variant="body2">
          Planned {formatMiles(week.planned_miles)}
        </Typography>
      )}
      {week.trailing_4_week_average_miles != null && (
        <Typography variant="body2">
          4-week average {formatMiles(week.trailing_4_week_average_miles)}
        </Typography>
      )}
      {week.exceeds_prior_average && (
        <Typography
          variant="body2"
          sx={{ color: seriesColors.warning, fontWeight: 700 }}
        >
          ▲ More than {threshold}% above the prior 4-week average (
          {formatMiles(week.prior_4_week_average_miles)})
        </Typography>
      )}
    </Box>
  );
}

/** 16 Monday-based weeks: miles, planned miles, 4-week average, and jump flags. */
export function WeeklyVolumeCard({
  weeks,
  thresholdPercent = 15,
  loading,
  error,
}: WeeklyVolumeCardProps) {
  const data = weeks ?? [];
  const flagged = data.filter((week) => week.exceeds_prior_average);
  const hasPlanned = data.some((week) => week.planned_miles != null);
  const mileTicks = niceTicks(
    0,
    Math.max(
      5,
      ...data.flatMap((week) => [
        week.miles,
        week.planned_miles ?? 0,
        week.trailing_4_week_average_miles ?? 0,
      ]),
    ),
    5,
  );
  return (
    <AnalyticsCard
      title="Weekly volume"
      description="Running miles per Monday–Sunday week for the last 16 weeks."
      loading={loading}
      error={error}
    >
      <Box>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 8, bottom: 0, left: -12 }}
          >
            <CartesianGrid
              stroke={gridStroke}
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="week_start"
              tickFormatter={shortDate}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: gridStroke }}
              minTickGap={18}
            />
            <YAxis
              ticks={mileTicks}
              domain={[0, mileTicks[mileTicks.length - 1]]}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={44}
              unit=""
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: cursorFill }}
              content={({ active, payload }) => {
                const week = payload?.[0]?.payload as
                  WeeklyVolumeWeek | undefined;
                return active && week ? (
                  <WeekTooltip week={week} threshold={thresholdPercent} />
                ) : null;
              }}
            />
            <Bar
              dataKey="miles"
              name="Miles"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
              isAnimationActive={false}
            >
              {data.map((week) => (
                <Cell
                  key={week.week_start}
                  fill={
                    week.is_partial
                      ? seriesColors.primaryLight
                      : seriesColors.primary
                  }
                  stroke={week.is_partial ? seriesColors.primary : "none"}
                  strokeDasharray={week.is_partial ? "4 3" : undefined}
                  strokeWidth={week.is_partial ? 1.5 : 0}
                />
              ))}
              <LabelList
                dataKey="exceeds_prior_average"
                position="top"
                content={({ x, y, width, value }) =>
                  value ? (
                    <text
                      x={Number(x) + Number(width) / 2}
                      y={Number(y) - 6}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={700}
                      fill={seriesColors.warning}
                    >
                      ▲
                    </text>
                  ) : null
                }
              />
            </Bar>
            {hasPlanned && (
              <Line
                dataKey="planned_miles"
                name="Planned"
                type="step"
                stroke={seriesColors.reference}
                strokeDasharray="5 4"
                strokeWidth={1.75}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            <Line
              dataKey="trailing_4_week_average_miles"
              name="4-week average"
              stroke={seriesColors.secondary}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <ChartLegend
          items={[
            { label: "Miles", color: seriesColors.primary },
            {
              label: "Current week (in progress)",
              color: seriesColors.primary,
              kind: "hatched",
            },
            ...(hasPlanned
              ? [
                  {
                    label: "Planned (active plan)",
                    color: seriesColors.reference,
                    kind: "dashed" as const,
                  },
                ]
              : []),
            {
              label: "4-week average",
              color: seriesColors.secondary,
              kind: "line",
            },
          ]}
        />
        <Stack spacing={0.5} sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            <Box
              component="span"
              sx={{ color: seriesColors.warning, fontWeight: 700 }}
            >
              ▲
            </Box>{" "}
            marks a completed week more than {thresholdPercent}% above the
            average of the four weeks before it — a prompt to check the jump,
            not a rule.
            {flagged.length > 0
              ? ` Flagged: ${flagged.map((week) => shortDate(week.week_start)).join(", ")}.`
              : " No weeks are flagged."}
          </Typography>
        </Stack>
      </Box>
    </AnalyticsCard>
  );
}
