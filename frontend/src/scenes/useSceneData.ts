// Gathers what the background scenes react to from the existing API. Failures are ignored: the scene keeps
// its defaults and the app is unaffected. Refreshes every ten minutes.
import { useEffect, useRef } from "react";
import { getActivitySamples, listActivities } from "../api/activities";
import { getAnalytics, getHeartRateZones } from "../api/analytics";
import { fetchCalendar, type CalendarEvent } from "../api/calendar";
import { EMPTY_SCENE_DATA, type Gait, type SceneData } from "./types";

const REFRESH_MS = 10 * 60 * 1000;
const FAST =
  /(\d+\s*x\s*\d+)|track|interval|tempo|threshold|fast|stride|hill|speed|race/i;

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Today's gait: done once today's run is recorded, otherwise from the planned session's title.
export function gaitFor(events: CalendarEvent[], today: string): Gait {
  const todays = events.filter((event) => event.date === today);
  if (
    todays.some(
      (event) => event.kind === "activity" || event.status === "completed",
    )
  )
    return "done";
  const planned = todays.find(
    (event) => event.kind === "planned_session" && event.status !== "skipped",
  );
  if (!planned) return "rest";
  if (FAST.test(planned.title)) return "fast";
  if (/long/i.test(planned.title)) return "long";
  return "easy";
}

function downsample(values: number[], size: number) {
  if (values.length <= size) return values;
  const step = values.length / size;
  return Array.from({ length: size }, (_, i) => values[Math.floor(i * step)]);
}

async function load(): Promise<Partial<SceneData>> {
  const now = new Date(),
    today = isoDate(now),
    tomorrow = isoDate(new Date(now.getTime() + 86_400_000));
  const [calendar, summary, zones, recent] = await Promise.allSettled([
    fetchCalendar(today, tomorrow),
    getAnalytics(),
    getHeartRateZones(),
    listActivities({ limit: 1 }),
  ]);
  const result: Partial<SceneData> = {};
  if (calendar.status === "fulfilled")
    result.gait = gaitFor(calendar.value, today);
  if (summary.status === "fulfilled") {
    const week = summary.value.weekly_volume.at(-1);
    if (week) {
      result.weekMiles = week.miles;
      result.weekPlannedMiles = week.planned_miles;
    }
  }
  if (zones.status === "fulfilled" && zones.value.status === "ok") {
    result.loadBand = zones.value.training_load?.ratio_band ?? null;
    result.zoneFloors = zones.value.zones.map((zone) => zone.lower_bpm);
    const week = zones.value.weekly_time_in_zones.at(-1);
    result.weekZoneMinutes = week
      ? week.zone_seconds.map((seconds) => seconds / 60)
      : [];
  }
  const latest =
    recent.status === "fulfilled" ? recent.value.items[0] : undefined;
  if (latest) {
    try {
      const samples = await getActivitySamples(latest.id);
      result.heartRateTrace = downsample(
        samples.flatMap((s) => (s.heart_rate ? [s.heart_rate] : [])),
        240,
      );
    } catch {
      /* keep the monitor empty */
    }
  }
  return result;
}

// Returns a stable getter so the scene reads the latest data every frame without re-rendering React.
// Loading starts only when `enabled` (the scene actually runs), so no requests are made without a canvas.
export function useSceneData(enabled: boolean) {
  const ref = useRef<SceneData>({ ...EMPTY_SCENE_DATA });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const refresh = () =>
      load()
        .then((data) => {
          if (alive) ref.current = { ...ref.current, ...data };
        })
        .catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [enabled]);
  return ref;
}
