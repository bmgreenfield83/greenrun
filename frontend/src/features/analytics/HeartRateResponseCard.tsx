import { Alert, Box, Button, Chip, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { Link } from "wouter";

import type { HeartRateResponseResult } from "../../api/analytics";
import { AnalyticsCard } from "./AnalyticsCard";
import { CategoryFilter } from "./CategoryFilter";
import { formatTemperature, shortDate, type TemperatureUnit } from "./format";
import { HeartRateResponseChart } from "./HeartRateResponseChart";
import { intervalOf, isStale } from "./heartRateResponse";

type HeartRateResponseCardProps = {
  /** Oldest first, as returned by the summary API. */
  history: HeartRateResponseResult[] | undefined;
  algorithmVersion: number | undefined;
  unit: TemperatureUnit;
  loading: boolean;
  error: string | null;
  recalculating: boolean;
  onRecalculate: () => void;
};

const confidenceColor = (confidence: HeartRateResponseResult["confidence"]) =>
  confidence === "high"
    ? "success"
    : confidence === "moderate"
      ? "warning"
      : "default";

function ResultRow({
  result,
  stale,
  unit,
}: {
  result: HeartRateResponseResult;
  stale: boolean;
  unit: TemperatureUnit;
}) {
  const interval = intervalOf(result);
  return (
    <Button
      component={Link}
      href={`/activities/${result.activity_id}`}
      sx={{
        flexShrink: 0,
        justifyContent: "flex-start",
        p: 1.25,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        color: "text.primary",
        "&:hover": { bgcolor: "primary.light" },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        columnGap={2}
        rowGap={0.5}
        width="100%"
      >
        <Stack sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700}>
            {shortDate(result.local_date)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {(result.category ?? "uncategorized").replaceAll("_", " ")} ·{" "}
            {formatTemperature(result.temperature_fahrenheit, unit)}
          </Typography>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Box sx={{ textAlign: "right" }}>
            <Typography
              color="primary.dark"
              sx={{ fontWeight: 750, fontVariantNumeric: "tabular-nums" }}
            >
              {result.adjusted_change_bpm_per_hour?.toFixed(1)} bpm/hr
            </Typography>
            {interval && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                90%: {interval[0].toFixed(1)} to {interval[1].toFixed(1)}
              </Typography>
            )}
          </Box>
          {result.confidence && (
            <Chip
              size="small"
              label={`${result.confidence} confidence`}
              color={confidenceColor(result.confidence)}
              variant="outlined"
            />
          )}
          {stale && (
            <Chip
              size="small"
              label={`stale · v${result.algorithm_version}`}
              color="warning"
            />
          )}
        </Stack>
      </Stack>
    </Button>
  );
}

/** Workload-adjusted HR response: dated chart, category filter, and per-run list. */
export function HeartRateResponseCard({
  history,
  algorithmVersion = 4,
  unit,
  loading,
  error,
  recalculating,
  onRecalculate,
}: HeartRateResponseCardProps) {
  const [selected, setSelected] = useState<string[] | null>(null);
  const results = history ?? [];
  const categories = [
    ...new Set(results.map((item) => item.category ?? "uncategorized")),
  ].sort();
  const active = selected ?? categories;
  const filtered = results
    .filter((item) => active.includes(item.category ?? "uncategorized"))
    .sort((left, right) => left.local_date.localeCompare(right.local_date));
  const staleCount = results.filter((item) =>
    isStale(item, algorithmVersion),
  ).length;
  return (
    <AnalyticsCard
      title="Workload-adjusted heart-rate response"
      description="Estimated heart-rate change per hour of running after accounting for grade-adjusted speed and stops. Weather, hydration, wind, fatigue, and sensor error remain possible influences; this is descriptive, not a diagnosis."
      loading={loading}
      error={error}
    >
      <Stack spacing={2}>
        {staleCount > 0 && (
          <Alert
            severity="warning"
            action={
              <Button
                color="inherit"
                size="small"
                disabled={recalculating}
                onClick={onRecalculate}
              >
                {recalculating ? "Recalculating…" : "Recalculate"}
              </Button>
            }
          >
            {staleCount} of {results.length} results were computed with an older
            algorithm (before version {algorithmVersion}) and have no 90%
            interval. Use <strong>Recalculate HR response</strong> to rebuild
            them.
          </Alert>
        )}
        {categories.length > 0 && (
          <CategoryFilter
            categories={categories}
            selected={active}
            onChange={setSelected}
          />
        )}
        {filtered.length > 1 && (
          <HeartRateResponseChart results={filtered} unit={unit} />
        )}
        <Stack spacing={1} sx={{ maxHeight: 380, overflowY: "auto", pr: 0.5 }}>
          {filtered.length === 0 && (
            <Typography color="text.secondary">
              No qualifying heart-rate response results match these categories.
            </Typography>
          )}
          {[...filtered].reverse().map((result) => (
            <ResultRow
              key={result.activity_id}
              result={result}
              stale={isStale(result, algorithmVersion)}
              unit={unit}
            />
          ))}
        </Stack>
      </Stack>
    </AnalyticsCard>
  );
}
