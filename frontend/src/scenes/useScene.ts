// Runs a scene on a canvas: 10 frames per second while the page is visible, one still frame when the viewer
// prefers reduced motion, and nothing at all when canvases are unavailable. Returns whether it is running.
import { useEffect, useState, type RefObject } from "react";
import type { SceneData, SceneDefinition } from "./types";

const TICK_MS = 100;
const RESIZE_SETTLE_MS = 150;

export function useScene(
  canvas: RefObject<HTMLCanvasElement | null>,
  scene: SceneDefinition,
  data: RefObject<SceneData>,
): boolean {
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!canvas.current) return;
    const instance = scene.create(canvas.current, () => data.current);
    if (!instance) return;
    setRunning(true);
    const still =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rebuild = () => {
      instance.layout();
      instance.paint();
    };
    rebuild();
    // Rebuilding redraws every layer, so wait until the window stops changing size.
    let pending = 0;
    const resize = () => {
      window.clearTimeout(pending);
      pending = window.setTimeout(rebuild, RESIZE_SETTLE_MS);
    };
    window.addEventListener("resize", resize);
    const timer = window.setInterval(
      () => {
        if (document.hidden) return;
        if (!still) instance.tick();
        instance.paint();
      },
      still ? 5000 : TICK_MS,
    );
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(pending);
      window.removeEventListener("resize", resize);
    };
  }, [canvas, scene, data]);
  return running;
}
