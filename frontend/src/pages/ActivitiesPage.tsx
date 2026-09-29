import FilterAltOffRounded from "@mui/icons-material/FilterAltOffRounded";
import {
  Alert,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

import { listActivities, type Activity } from "../api/activities";
import { PageHeader } from "../components/common/PageHeader";
import {
  activityType,
  duration,
  localDateLabel,
  metersToMiles,
  pace,
  speed,
} from "../features/activities/format";
import {
  getActivityListState,
  rememberActivityListScroll,
  setActivityListState,
} from "../features/activities/activityListState";

const PAGE_SIZE = 25;
const sports = ["run", "walk", "bike", "swim", "strength", "hike", "other"];

export function ActivitiesPage() {
  const initialState = useRef(getActivityListState()).current;
  const [activities, setActivities] = useState<Activity[]>(
    initialState?.activities ?? [],
  );
  const [total, setTotal] = useState(initialState?.total ?? 0);
  const [sport, setSport] = useState(initialState?.sport ?? "");
  const [startDate, setStartDate] = useState(initialState?.startDate ?? "");
  const [endDate, setEndDate] = useState(initialState?.endDate ?? "");
  const [loading, setLoading] = useState(!initialState);
  const [error, setError] = useState<string | null>(null);
  const initialFilterKey = `${initialState?.sport ?? ""}|${initialState?.startDate ?? ""}|${initialState?.endDate ?? ""}`;
  const loadedFilterKey = useRef<string | null>(
    initialState ? initialFilterKey : null,
  );

  const load = async (skip: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listActivities({
        skip,
        limit: PAGE_SIZE,
        sport,
        startDate,
        endDate,
      });
      setActivities((current) => {
        const next = append ? [...current, ...result.items] : result.items;
        setActivityListState({
          activities: next,
          total: result.total,
          sport,
          startDate,
          endDate,
          scrollY: append ? (getActivityListState()?.scrollY ?? 0) : 0,
          loadedAt: Date.now(),
        });
        return next;
      });
      setTotal(result.total);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Activities could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const filterKey = `${sport}|${startDate}|${endDate}`;
    if (loadedFilterKey.current === filterKey) return;
    loadedFilterKey.current = filterKey;
    void load(0, false);
    // Reload from the beginning whenever a filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, startDate, endDate]);

  useEffect(() => {
    if (!initialState?.scrollY) return;
    const frame = window.requestAnimationFrame(() =>
      window.scrollTo({ top: initialState.scrollY }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [initialState]);

  const filtered = Boolean(sport || startDate || endDate);
  const activityGroups = activities.reduce<
    Array<{ date: string; activities: Activity[] }>
  >((groups, activity) => {
    const current = groups.at(-1);
    if (current?.date === activity.local_date)
      current.activities.push(activity);
    else groups.push({ date: activity.local_date, activities: [activity] });
    return groups;
  }, []);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Activities"
        description="Browse imported training activities from newest to oldest."
      />

      <Card variant="outlined">
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                fullWidth
                label="Sport"
                value={sport}
                onChange={(event) => setSport(event.target.value)}
              >
                <MenuItem value="">All sports</MenuItem>
                {sports.map((value) => (
                  <MenuItem value={value} key={value}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                fullWidth
                type="date"
                label="From"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                fullWidth
                type="date"
                label="Through"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                sx={{ minHeight: 56 }}
                startIcon={<FilterAltOffRounded />}
                disabled={!filtered}
                onClick={() => {
                  setSport("");
                  setStartDate("");
                  setEndDate("");
                }}
              >
                Clear
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && activities.length > 0 && (
        <Typography variant="body2" color="text.secondary" aria-live="polite">
          Showing {activities.length} of {total} activities
        </Typography>
      )}
      {activityGroups.map((group) => (
        <Card
          variant="outlined"
          key={group.date}
          component="section"
          aria-label={localDateLabel(group.date)}
        >
          <Typography
            variant="overline"
            color="text.secondary"
            component="h2"
            sx={{
              display: "block",
              px: { xs: 2, sm: 3 },
              py: 0.75,
              bgcolor: "#f7faf9",
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            {localDateLabel(group.date, {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Typography>
          {group.activities.map((activity, index) => (
            <CardActionArea
              component={Link}
              href={`/activities/${activity.id}`}
              key={activity.id}
              onClick={() => rememberActivityListScroll(window.scrollY)}
              sx={{
                borderTop: index ? "1px solid" : "none",
                borderColor: "divider",
                borderRadius: 0,
              }}
            >
              <CardContent>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  gap={{ xs: 0.5, sm: 2 }}
                >
                  <div>
                    <Typography variant="h6" component="h3">
                      {activityType(activity)}
                    </Typography>
                    {activity.planned_session_id && (
                      <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        sx={{ color: "success.main", mt: 0.25 }}
                      >
                        <CheckCircleRounded sx={{ fontSize: 17 }} />
                        <Typography variant="body2" fontWeight={700}>
                          Planned workout completed
                        </Typography>
                      </Stack>
                    )}
                  </div>
                  <Typography
                    fontWeight={700}
                    color="primary.dark"
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {[
                      activity.distance_meters !== null
                        ? metersToMiles(activity.distance_meters)
                        : null,
                      duration(
                        activity.moving_time_seconds ??
                          activity.elapsed_time_seconds,
                      ),
                      ["run", "walk", "hike"].includes(activity.sport)
                        ? pace(activity.summary.average_speed_mps ?? null)
                        : activity.sport === "bike"
                          ? speed(activity.summary.average_speed_mps ?? null)
                          : null,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </Typography>
                </Stack>
              </CardContent>
            </CardActionArea>
          ))}
        </Card>
      ))}
      {!activities.length && !loading && !error && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6">
              {filtered
                ? "No activities match these filters"
                : "No activities yet"}
            </Typography>
            <Typography color="text.secondary">
              {filtered
                ? "Clear or adjust the filters to broaden the results."
                : "Import a FIT file to add your first activity."}
            </Typography>
          </CardContent>
        </Card>
      )}
      {loading && (
        <Stack spacing={1.5} aria-busy="true">
          <Typography variant="body2" color="text.secondary" role="status">
            {activities.length
              ? "Loading more activities..."
              : "Loading activities..."}
          </Typography>
          {!activities.length &&
            [0, 1, 2].map((key) => (
              <Skeleton key={key} variant="rounded" height={96} />
            ))}
        </Stack>
      )}
      {activities.length < total && !loading && (
        <Button
          variant="outlined"
          onClick={() => void load(activities.length, true)}
          sx={{ alignSelf: "center" }}
        >
          Load more
        </Button>
      )}
    </Stack>
  );
}
