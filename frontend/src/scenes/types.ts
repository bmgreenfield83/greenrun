// Contract between the app and its pixel-art background scenes.

// What today's plan asks of the runner, which sets his gait.
export type Gait = "rest" | "easy" | "long" | "fast" | "done";
export type LoadBand = "low" | "typical" | "elevated" | "spike";

export interface SceneData {
  gait: Gait;
  weekMiles: number | null;
  weekPlannedMiles: number | null;
  loadBand: LoadBand | null;
  // The most recent run's heart rate, downsampled; the lab monitor replays it.
  heartRateTrace: number[];
  // Heart-rate-reserve zone boundaries (lower bound of Z1..Z5) for coloring the trace.
  zoneFloors: number[];
  // This week's minutes in Z1..Z5 for the lab whiteboard.
  weekZoneMinutes: number[];
}

export const EMPTY_SCENE_DATA: SceneData = {
  gait: "easy",
  weekMiles: null,
  weekPlannedMiles: null,
  loadBand: null,
  heartRateTrace: [],
  zoneFloors: [],
  weekZoneMinutes: [],
};

export interface SceneInstance {
  layout(): void; // size to the window and regenerate
  tick(): void; // advance animation by one step
  paint(): void; // draw the current frame
}

export interface SceneDefinition {
  // Returns null when the canvas cannot be drawn (tests, very old browsers); the app works without it.
  create(
    canvas: HTMLCanvasElement,
    data: () => SceneData,
  ): SceneInstance | null;
}
