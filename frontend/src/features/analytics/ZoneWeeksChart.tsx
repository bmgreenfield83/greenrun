import { Box, Typography } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ZoneWeek } from "../../api/analytics";
import { ChartLegend } from "./ChartLegend";
import { axisTick, gridStroke, tooltipStyle, zoneColors } from "./chartTheme";
import { hoursMinutes, shortDate } from "./format";
import { niceTicks } from "./format";

type Row = { week: ZoneWeek } & Record<string, number | ZoneWeek>;

function zoneRows(weeks: ZoneWeek[], mode: "minutes" | "percent"): Row[] {
  return weeks.map((week) => {
    const row: Row = { week, week_start: week.week_start } as unknown as Row;
    week.zone_seconds.forEach((seconds, index) => {
      row[`z${index + 1}`] =
        mode === "minutes"
          ? +(seconds / 60).toFixed(1)
          : week.total_seconds
            ? +((seconds / week.total_seconds) * 100).toFixed(1)
            : 0;
    });
    return row;
  });
}

/** Weekly stacked time in Z1..Z5, as minutes or as a share of the week's time. */
export function ZoneWeeksChart({
  weeks,
  mode,
  height = 240,
}: {
  weeks: ZoneWeek[];
  mode: "minutes" | "percent";
  height?: number;
}) {
  const rows = zoneRows(weeks, mode);
  const ticks =
    mode === "percent"
      ? [0, 25, 50, 75, 100]
      : niceTicks(
          0,
          Math.max(10, ...weeks.map((week) => week.total_seconds / 60)),
          5,
        );
  return (
    <Box>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows}
          margin={{
            top: 8,
            right: 8,
            bottom: 0,
            left: mode === "percent" ? -4 : -12,
          }}
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
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={[0, ticks[ticks.length - 1]]}
            ticks={ticks}
            tickFormatter={(value: number) =>
              mode === "percent" ? `${value}%` : `${value}`
            }
          />
          <Tooltip
            cursor={{ fill: "rgba(23,74,91,.06)" }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as Row | undefined;
              if (!active || !row) return null;
              const week = row.week as ZoneWeek;
              return (
                <Box sx={tooltipStyle}>
                  <Typography variant="body2" fontWeight={700}>
                    Week of {shortDate(week.week_start)}
                    {week.is_partial ? " (in progress)" : ""}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="p"
                  >
                    {week.run_count} run{week.run_count === 1 ? "" : "s"} ·{" "}
                    {hoursMinutes(week.total_seconds)}
                  </Typography>
                  {[...week.zone_seconds]
                    .reverse()
                    .map((seconds, reversedIndex) => {
                      const zone = 5 - reversedIndex;
                      return (
                        <Typography variant="body2" key={zone}>
                          Z{zone}: {hoursMinutes(seconds)}
                          {week.total_seconds
                            ? ` (${Math.round((seconds / week.total_seconds) * 100)}%)`
                            : ""}
                        </Typography>
                      );
                    })}
                </Box>
              );
            }}
          />
          {zoneColors.map((color, index) => (
            <Bar
              key={color}
              dataKey={`z${index + 1}`}
              name={`Z${index + 1}`}
              stackId="zones"
              fill={color}
              stroke="#fff"
              strokeWidth={1}
              maxBarSize={36}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend
        items={zoneColors.map((color, index) => ({
          label: `Z${index + 1}`,
          color,
        }))}
      />
    </Box>
  );
}
