export type SceneName = "trail" | "lab";

/** The lab scene sits behind Analytics; every other page gets the trail. */
export function sceneForPath(path: string): SceneName {
  return path === "/analytics" || path.startsWith("/analytics/")
    ? "lab"
    : "trail";
}
