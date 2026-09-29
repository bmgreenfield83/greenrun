import { Stack, Typography } from "@mui/material";

import type { AnalyticsSummary } from "../../api/analytics";
import { LinkRow } from "../../components/common/LinkRow";
import { localDateLabel } from "../activities/format";
import { AnalyticsCard } from "./AnalyticsCard";
import { formatMiles, formatPace, formatPreciseClock } from "./format";

/** Exact-distance best efforts, longest run, and highest week. */
export function RecordsCard({
  summary,
  loading,
  error,
}: {
  summary: AnalyticsSummary | null;
  loading: boolean;
  error: string | null;
}) {
  const efforts = summary?.best_efforts ?? [];
  return (
    <AnalyticsCard
      title="Best efforts and records"
      description="Fastest exact-distance efforts in elapsed time, from any window within a run's samples or from an exact-distance lap."
      loading={loading}
      error={error}
    >
      <Stack spacing={0.25} sx={{ mx: -1.5 }}>
        {efforts.length === 0 && (
          <Typography color="text.secondary" sx={{ px: 1.5 }}>
            No exact-distance efforts yet.
          </Typography>
        )}
        {efforts.map((effort) => (
          <LinkRow
            key={effort.distance_label}
            href={`/activities/${effort.activity_id}`}
            primary={effort.distance_label}
            secondary={`${localDateLabel(effort.local_date)} · ${
              effort.source === "lap"
                ? `lap ${effort.lap_index}`
                : "within a run"
            }${effort.category ? ` · ${effort.category.replaceAll("_", " ")}` : ""}`}
            trailing={`${formatPreciseClock(effort.elapsed_seconds)} · ${formatPace(effort.pace_seconds_per_mile)}`}
          />
        ))}
        {summary?.longest_run && (
          <LinkRow
            href={`/activities/${summary.longest_run.activity_id}`}
            primary="Longest run"
            secondary={localDateLabel(summary.longest_run.local_date)}
            trailing={formatMiles(summary.longest_run.distance_miles, 2)}
          />
        )}
        {summary?.highest_week && (
          <LinkRow
            href={`/calendar?date=${summary.highest_week.week_start}`}
            primary="Highest week"
            secondary={`Week of ${localDateLabel(summary.highest_week.week_start)}`}
            trailing={formatMiles(summary.highest_week.miles)}
          />
        )}
      </Stack>
    </AnalyticsCard>
  );
}
