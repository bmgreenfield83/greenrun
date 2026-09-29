import { afterEach, describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "../api/calendar";
import { lab } from "./lab";
import { trail } from "./trail";
import {
  EMPTY_SCENE_DATA,
  type Gait,
  type LoadBand,
  type SceneData,
} from "./types";
import { gaitFor } from "./useSceneData";

const event = (changes: Partial<CalendarEvent> = {}): CalendarEvent =>
  ({
    id: "e",
    kind: "planned_session",
    title: "Easy aerobic",
    date: "2026-09-29",
    status: "planned",
    ...changes,
  }) as CalendarEvent;

describe("gaitFor", () => {
  it("follows today's plan and marks a finished run as done", () => {
    expect(gaitFor([], "2026-09-29")).toBe("rest");
    expect(gaitFor([event()], "2026-09-29")).toBe("easy");
    expect(
      gaitFor(
        [{ ...event(), title: "10 x 200 m relaxed fast running" }],
        "2026-09-29",
      ),
    ).toBe("fast");
    expect(gaitFor([{ ...event(), title: "Long easy" }], "2026-09-29")).toBe(
      "long",
    );
    expect(gaitFor([{ ...event(), kind: "activity" }], "2026-09-29")).toBe(
      "done",
    );
    expect(gaitFor([{ ...event(), status: "skipped" }], "2026-09-29")).toBe(
      "rest",
    );
    expect(gaitFor([{ ...event(), date: "2026-09-30" }], "2026-09-29")).toBe(
      "rest",
    );
  });
});

describe("scenes", () => {
  afterEach(() => vi.restoreAllMocks());
  it("animate every gait and load band without invalid drawing calls", () => {
    let bad = 0;
    const ctx = new Proxy(
      {},
      {
        get: (_t, key) =>
          key === "fillRect" || key === "drawImage"
            ? (...args: unknown[]) => {
                if (
                  args
                    .slice(key === "drawImage" ? 1 : 0)
                    .some((n) => typeof n === "number" && !Number.isFinite(n))
                )
                  bad++;
              }
            : () => {},
        set: () => true,
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as never,
    );
    const data: SceneData = {
      ...EMPTY_SCENE_DATA,
      weekMiles: 12,
      weekPlannedMiles: 24,
      heartRateTrace: [120, 150, 170, 185],
      zoneFloors: [124, 138, 152, 166, 180],
      weekZoneMinutes: [10, 20, 30, 5, 1],
    };
    for (const scene of [trail, lab]) {
      const instance = scene.create(
        document.createElement("canvas"),
        () => data,
      )!;
      for (const [w, h] of [
        [1440, 900],
        [390, 844],
      ]) {
        Object.assign(window, { innerWidth: w, innerHeight: h });
        instance.layout();
        for (const gait of ["easy", "fast", "long", "done", "rest"] as Gait[])
          for (const band of [
            "low",
            "typical",
            "elevated",
            "spike",
            null,
          ] as (LoadBand | null)[]) {
            data.gait = gait;
            data.loadBand = band;
            for (let i = 0; i < 40; i++) {
              instance.tick();
              instance.paint();
            }
          }
      }
    }
    expect(bad).toBe(0);
  });
  it("return null when the canvas cannot be drawn", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(
      trail.create(document.createElement("canvas"), () => EMPTY_SCENE_DATA),
    ).toBeNull();
    expect(
      lab.create(document.createElement("canvas"), () => EMPTY_SCENE_DATA),
    ).toBeNull();
  });
});
