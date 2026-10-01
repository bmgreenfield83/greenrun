import { describe, expect, it } from "vitest";
import { painter } from "./pixel";

// Rasterizes every fillRect into a set of covered pixels.
function recorder() {
  const covered = new Set<string>();
  const ctx = {
    fillStyle: "",
    fillRect(x: number, y: number, w: number, h: number) {
      for (let i = 0; i < w; i++)
        for (let j = 0; j < h; j++) covered.add(`${x + i},${y + j}`);
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, covered };
}

describe("painter.ellipse", () => {
  it("fills exactly the pixels of the per-pixel reference", () => {
    for (let rx = 0; rx <= 20; rx++)
      for (let ry = 0; ry <= 20; ry++) {
        const { ctx, covered } = recorder();
        painter(ctx, {}).ellipse(5, 7, rx, ry, "#000");
        const expected = new Set<string>();
        for (let y = -ry; y <= ry; y++)
          for (let x = -rx; x <= rx; x++)
            if ((x * x) / (rx * rx || 1) + (y * y) / (ry * ry || 1) <= 1)
              expected.add(`${5 + x},${7 + y}`);
        expect(covered).toEqual(expected);
      }
  });
});
