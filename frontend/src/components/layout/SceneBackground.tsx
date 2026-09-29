import { Box } from "@mui/material";
import { useRef, useState } from "react";

import { lab } from "../../scenes/lab";
import { trail } from "../../scenes/trail";
import { useScene } from "../../scenes/useScene";
import { useSceneData } from "../../scenes/useSceneData";
import { sceneForPath } from "./sceneForPath";

const SCENES = { trail, lab };

/**
 * Full-viewport pixel-art scene behind all content: the Quiet Waters trail on
 * most pages and the lab on Analytics. It reacts to today's plan, this week's
 * miles, training load, and the last run's heart rate, and is purely
 * decorative (hidden from assistive technology, never clickable).
 */
export function SceneBackground({ path }: { path: string }) {
  const scene = sceneForPath(path);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const data = useSceneData(running);
  const started = useScene(canvas, SCENES[scene], data);
  if (started !== running) setRunning(started);
  return (
    <Box
      aria-hidden
      data-scene={scene}
      data-testid="scene-background"
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        overflow: "hidden",
        "& canvas": {
          display: "block",
          imageRendering: "pixelated",
        },
      }}
    >
      <canvas ref={canvas} />
    </Box>
  );
}
