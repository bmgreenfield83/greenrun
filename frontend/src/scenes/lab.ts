// Lab: the Analytics page's scene. The owner runs on a treadmill under a wall monitor that replays the
// last run's heart rate (colored by zone); the coach by the whiteboard reacts to training load. The
// whiteboard shows this week's miles against the plan and minutes per zone. The room is furnished like a
// runner's lab: medals and trophies on the shelf, a framed race bib, a zone poster, a park map, a window
// onto the trail. The room is drawn once per layout; only the moving parts are drawn every frame.
import {
  context,
  painter,
  pixelScale,
  seeded,
  shade,
  sizeCanvas,
  type Painter,
} from "./pixel";
import { owner } from "./sprites";
import type { SceneData, SceneDefinition } from "./types";

const OUTLINE = "#1b2420";
export const ZONE_COLORS = [
  "#3b7dd8",
  "#3fa34d",
  "#e3b62b",
  "#e8832a",
  "#d64541",
];
const C = {
  wall: "#dfe3d6",
  wallLow: "#c9d1bf",
  trim: "#9aa58f",
  floorA: "#b9a88a",
  floorB: "#ab9a7c",
  wood: "#8a6440",
  woodDark: "#5e4229",
  metal: "#7c878d",
  metalDark: "#4f5a60",
  belt: "#2a2f33",
  screen: "#0c1512",
  board: "#f7f7f2",
  ink: "#2d3a33",
  gold: "#e0b040",
};

function zoneOf(bpm: number, floors: number[]) {
  let z = 0;
  floors.forEach((f, i) => {
    if (bpm >= f) z = i;
  });
  return z;
}

function coach(
  p: Painter,
  x: number,
  y: number,
  frame: number,
  mood: SceneData["loadBand"],
) {
  const skin = "#a8764f",
    polo = "#2f6b4f",
    pants = "#3b4048";
  p.px(x - 4, y - 1, 9, 2, "rgba(0,0,0,.15)");
  p.px(x - 2, y - 6, 2, 5, pants);
  p.px(x + 1, y - 6, 2, 5, pants);
  p.px(x - 3, y - 15, 7, 10, OUTLINE);
  p.px(x - 2, y - 15, 5, 9, polo);
  p.px(x - 3, y - 22, 7, 7, OUTLINE);
  p.px(x - 2, y - 21, 5, 5, skin);
  p.px(x - 2, y - 22, 5, 2, "#d8d8d8");
  p.px(x + 2, y - 21, 1, 3, "#d8d8d8");
  p.px(x - 2, y - 19, 1, 1, OUTLINE);
  p.px(x - 2, y - 13, 1, 3, "#c0392b");
  p.box(x - 7, y - 13, 4, 5, "#f4f1e4");
  p.px(x - 6, y - 14, 2, 1, C.metalDark);
  if (mood !== "spike")
    p.px(x - 6 + (frame % 3), y - 11 + ((frame >> 2) % 2), 1, 1, OUTLINE);
  else p.px(x + 3, y - 20 + (frame % 3), 1, 1, "#7fb8e0");
  p.px(x - 3, y - 12, 2, 1, skin);
}

function bubble(p: Painter, x: number, y: number, ch: string, color: string) {
  p.box(x - 2, y - 8, 5, 7, "#ffffff");
  p.px(x, y - 1, 1, 1, "#ffffff");
  p.text(ch, x - 1, y - 7, color);
}

// Wall and floor decor, placed across the room from a fixed seed.
function furnish(
  p: Painter,
  W: number,
  floorY: number,
  left: number,
  right: number,
) {
  const rnd = seeded(5),
    shelfY = floorY - 76;
  // A long shelf of trophies, medals, books and a spare pair of shoes.
  p.px(0, shelfY, W, 2, C.wood);
  p.px(0, shelfY + 2, W, 1, C.woodDark);
  for (let x = 20; x < W; x += 48) p.px(x, shelfY + 3, 2, 4, C.woodDark);
  for (let x = 4; x < W - 8; x += 7 + Math.floor(rnd() * 7)) {
    const kind = Math.floor(rnd() * 4);
    if (kind === 0) {
      p.px(x + 1, shelfY - 2, 4, 2, C.woodDark);
      p.px(x + 2, shelfY - 4, 2, 2, C.gold);
      p.ellipse(x + 3, shelfY - 7, 3, 2, C.gold);
    } else if (kind === 1) {
      p.px(x, shelfY - 9, 1, 5, "#c0392b");
      p.px(x + 4, shelfY - 9, 1, 5, "#2e86c1");
      p.ellipse(x + 2, shelfY - 3, 2, 2, rnd() < 0.5 ? C.gold : "#b8c0c8");
    } else if (kind === 2)
      for (let k = 0; k < 3; k++)
        p.px(
          x + k * 2,
          shelfY - 6 - (k % 2),
          2,
          6 + (k % 2),
          ["#2e6b8a", "#8a3b2e", "#3f6f3f"][k],
        );
    else {
      p.px(x, shelfY - 3, 6, 3, "#3a5da8");
      p.px(x, shelfY - 1, 6, 1, "#e8e8e0");
    }
  }
  // Posters between the window/monitor column and the whiteboard: zones, the Ironman bib, a park map.
  const posterY = shelfY + 10;
  for (
    let x = left + 10, k = 0;
    x < right - 30;
    x += 40 + Math.floor(rnd() * 20), k++
  ) {
    const kind = k % 3;
    if (kind === 0) {
      p.box(x, posterY, 24, 18, "#fbfaf4");
      p.text("ZONES", x + 2, posterY + 1, C.ink);
      ZONE_COLORS.forEach((c, i) =>
        p.px(x + 2 + i * 4, posterY + 15 - (i + 1) * 2, 3, (i + 1) * 2, c),
      );
    } else if (kind === 1) {
      p.box(x, posterY, 22, 16, C.woodDark);
      p.px(x + 2, posterY + 2, 18, 12, "#fbfaf4");
      p.px(x + 2, posterY + 2, 18, 3, "#2e4a8a");
      p.text("347", x + 5, posterY + 7, C.ink);
    } else {
      p.box(x, posterY, 24, 18, "#e8efe0");
      p.ellipse(x + 12, posterY + 10, 9, 6, "#8fbf7a");
      p.px(x + 17, posterY + 4, 6, 12, "#7fb2cc");
      for (let a = 0; a < 6.28; a += 0.5)
        p.px(
          Math.round(x + 12 + Math.cos(a) * 6),
          Math.round(posterY + 10 + Math.sin(a) * 4),
          1,
          1,
          "#8a6440",
        );
      p.text("QWP", x + 2, posterY + 1, C.ink);
    }
  }
  // Floor furniture along the back wall.
  for (let x = left + 6; x < right - 24; x += 26 + Math.floor(rnd() * 26)) {
    const kind = Math.floor(rnd() * 4),
      base = floorY + 3;
    if (kind === 0) {
      p.px(x, base - 12, 22, 2, C.wood);
      p.px(x + 1, base - 10, 2, 10, C.woodDark);
      p.px(x + 19, base - 10, 2, 10, C.woodDark);
      p.box(x + 6, base - 21, 10, 7, "#d6ceb6");
      p.px(x + 7, base - 20, 8, 5, C.screen);
      p.px(x + 8, base - 19, 5, 1, "#58c585");
      p.px(x + 10, base - 14, 2, 2, C.metalDark);
    } else if (kind === 1) {
      p.px(x + 2, base - 12, 8, 12, "#e8ecef");
      p.ellipse(x + 6, base - 16, 4, 4, "#7fb8e0");
      p.px(x + 5, base - 21, 2, 2, "#5a9ac8");
    } else if (kind === 2) {
      p.px(x + 2, base - 5, 8, 5, "#8a5a3a");
      p.ellipse(x + 6, base - 10, 6, 5, "#3f7f3a");
      p.ellipse(x + 3, base - 13, 3, 3, "#4f9444");
    } else {
      p.px(x, base - 6, 24, 2, C.wood);
      p.px(x + 2, base - 4, 2, 4, C.woodDark);
      p.px(x + 20, base - 4, 2, 4, C.woodDark);
      p.px(x + 14, base - 8, 7, 2, "#e07a2f");
      p.ellipse(x + 5, base - 2, 2, 2, "#333");
      p.ellipse(x + 9, base - 2, 2, 2, "#333");
    }
  }
}

export const lab: SceneDefinition = {
  create(canvas, data) {
    const ctx = context(canvas);
    if (!ctx) return null;
    let W = 0,
      H = 0,
      t = 0,
      floorY = 0,
      belt = 0,
      trace = 0;
    let room: HTMLCanvasElement | null = null;

    function buildRoom() {
      room = document.createElement("canvas");
      room.width = W;
      room.height = H;
      const rctx = context(room);
      if (!rctx) return;
      const p = painter(rctx, { outline: OUTLINE });
      p.px(0, 0, W, floorY, C.wall);
      p.px(0, floorY - 16, W, 16, C.wallLow);
      p.px(0, floorY - 17, W, 1, C.trim);
      for (let y = floorY; y < H; y += 8)
        for (let x = ((y - floorY) / 8) % 2 ? 0 : 8; x < W; x += 16) {
          p.px(x, y, 8, 8, C.floorA);
          p.px(x + 8, y, 8, 8, C.floorB);
        }
      p.px(0, floorY, W, 1, OUTLINE);
      // Window onto the trail, following the time of day.
      const hour = new Date().getHours(),
        night = hour < 6 || hour >= 20,
        dusk = hour >= 17 && !night;
      const wx = 6,
        wy = 8,
        ww = 38,
        wh = 26;
      p.box(wx, wy, ww, wh, night ? "#1a2448" : dusk ? "#f0a35e" : "#8cc6ea");
      p.px(wx, wy + wh - 10, ww, 4, "#4f7f99");
      for (let k = 0; k < ww; k += 7)
        p.ellipse(
          wx + k + 3,
          wy + wh - 10,
          4,
          3,
          night ? "#1e3326" : "#3f7f3a",
        );
      p.px(wx, wy + wh - 6, ww, 6, night ? "#2e3a2e" : "#7c9a4f");
      p.px(wx, wy + wh - 4, ww, 2, "#6f7275");
      p.px(wx + ww / 2, wy, 1, wh, C.trim);
      p.px(wx - 1, wy + wh + 1, ww + 2, 2, C.trim);
      furnish(p, W, floorY, 50, W - 56);
      // Hanging lamps and a string of race bibs across the upper wall.
      for (let x = 70; x < W - 40; x += 90) {
        p.px(x, 0, 1, 10, C.metalDark);
        p.px(x - 5, 10, 11, 3, C.metalDark);
        p.px(x - 3, 13, 7, 1, "#fff3c4");
      }
      const garland = 44,
        rb = seeded(9);
      for (let x = 56; x < W - 30; x++)
        p.px(
          x,
          garland + Math.round(Math.sin((x - 56) / 18) * 2),
          1,
          1,
          C.woodDark,
        );
      for (let x = 62; x < W - 40; x += 22) {
        const y = garland + Math.round(Math.sin((x - 56) / 18) * 2) + 1;
        p.box(x, y, 14, 9, "#fbfaf4");
        p.px(
          x,
          y,
          14,
          2,
          ["#c0392b", "#2e4a8a", "#e07a2f", "#3f7f3a"][Math.floor(rb() * 4)],
        );
        p.text(
          x === 62 ? "347" : String(100 + Math.floor(rb() * 900)),
          x + 1,
          y + 3,
          C.ink,
        );
      }
    }

    return {
      layout() {
        const S = pixelScale() + 1;
        W = Math.ceil(window.innerWidth / S);
        H = Math.ceil(window.innerHeight / S);
        sizeCanvas(canvas, W, H, S);
        floorY = H - 24;
        buildRoom();
      },
      tick() {
        t++;
        const g = data().gait;
        belt += g === "rest" ? 0 : g === "fast" ? 2 : 1;
        if (t % 2 === 0) trace++;
        if (t % 6000 === 0) buildRoom();
      },
      paint() {
        const d = data(),
          p = painter(ctx, { outline: OUTLINE });
        if (room) ctx.drawImage(room, 0, 0);
        const x0 = 4,
          xr = W - 4;
        // Wall monitor replaying the last run's heart rate, colored by zone.
        const mx = x0 + 2,
          my = floorY - 60,
          mw = 38,
          mh = 20;
        p.box(mx, my, mw, mh, C.screen);
        p.px(mx + mw / 2 - 1, my + mh + 1, 2, 4, C.metalDark);
        const series = d.heartRateTrace,
          colorOf = (bpm: number) =>
            d.zoneFloors.length === 5
              ? ZONE_COLORS[zoneOf(bpm, d.zoneFloors)]
              : "#58c585";
        if (series.length > 1) {
          const lo = Math.min(...series),
            hi = Math.max(...series),
            span = Math.max(10, hi - lo);
          let prev: number | null = null;
          for (let i = 0; i < mw - 2; i++) {
            const bpm = series[(trace + i) % series.length];
            const y = Math.round(my + mh - 2 - ((bpm - lo) / span) * (mh - 9));
            const a = prev ?? y;
            p.px(
              mx + 1 + i,
              Math.min(a, y),
              1,
              Math.abs(a - y) + 1,
              colorOf(bpm),
            );
            prev = y;
          }
          const current = series[(trace + mw - 3) % series.length];
          p.text(String(Math.round(current)), mx + 2, my + 1, colorOf(current));
          p.text("BPM", mx + 16, my + 1, "#6d8a7c");
        } else p.text("NO DATA", mx + 5, my + 8, "#6d8a7c");
        // Treadmill and the owner.
        const tx = x0 + 2,
          feet = floorY + 12;
        p.px(tx, feet - 1, 36, 4, C.metalDark);
        p.px(tx + 1, feet - 3, 34, 2, C.belt);
        for (let k = 0; k < 5; k++)
          p.px(
            tx + 1 + ((((k * 7 - Math.floor(belt)) % 34) + 34) % 34),
            feet - 3,
            1,
            2,
            C.metal,
          );
        p.px(tx + 32, feet - 24, 2, 22, C.metal);
        p.px(tx + 28, feet - 27, 8, 4, C.metalDark);
        p.px(tx + 29, feet - 26, 3, 2, "#58c585");
        p.px(tx + 22, feet - 18, 11, 1, C.metal);
        const g = d.gait;
        const pose =
          g === "rest" ? ((t >> 5) % 2 ? "stretch" : "stand") : "run";
        owner(p, OUTLINE, tx + 15, feet - 3, pose, t);
        // Whiteboard: week miles against plan, and minutes per zone.
        const bw = 46,
          bx = xr - bw - 2,
          by = floorY - 62,
          bh = 36;
        p.box(bx, by, bw, bh, C.board);
        p.px(bx, by + bh + 1, bw, 2, C.metal);
        p.text("WEEK", bx + 2, by + 2, C.ink);
        if (d.weekMiles !== null) {
          const plan = d.weekPlannedMiles ?? 0,
            full = Math.max(plan, d.weekMiles, 1),
            barW = bw - 4;
          p.px(bx + 2, by + 9, barW, 3, shade(C.board, 0.85));
          p.px(
            bx + 2,
            by + 9,
            Math.round((d.weekMiles / full) * barW),
            3,
            "#2f6b4f",
          );
          if (plan)
            p.px(
              bx + 2 + Math.round((plan / full) * barW) - 1,
              by + 8,
              1,
              5,
              "#e07a2f",
            );
          p.text(
            `${Math.round(d.weekMiles)}/${plan ? Math.round(plan) : "-"}`,
            bx + 20,
            by + 2,
            C.ink,
          );
        }
        const mins = d.weekZoneMinutes,
          top = Math.max(1, ...mins);
        mins.forEach((m, i) => {
          const h = Math.round((m / top) * 16);
          p.px(bx + 5 + i * 8, by + bh - 3 - h, 6, h, ZONE_COLORS[i]);
          p.px(bx + 5 + i * 8, by + bh - 3, 6, 1, C.ink);
        });
        // Clock with the real time.
        const cx = xr - 12,
          cy = 16,
          now = new Date();
        p.ellipse(cx, cy, 7, 7, OUTLINE);
        p.ellipse(cx, cy, 6, 6, "#fbfaf4");
        p.ray(
          cx,
          cy,
          ((now.getHours() % 12) + now.getMinutes() / 60) * (Math.PI / 6) -
            Math.PI / 2,
          0,
          3,
          OUTLINE,
        );
        p.ray(
          cx,
          cy,
          now.getMinutes() * (Math.PI / 30) - Math.PI / 2,
          0,
          5,
          OUTLINE,
        );
        // Coach: writing when load is typical, worried when it spikes, dozing when it's low.
        const kx = xr - 26,
          ky = floorY + 12;
        coach(p, kx, ky, t >> 2, d.loadBand);
        const phase = t % 60;
        if (d.loadBand === "spike" && phase < 30)
          bubble(p, kx, ky - 23, "!", "#d64541");
        else if (d.loadBand === "elevated" && phase < 20)
          bubble(p, kx, ky - 23, "?", OUTLINE);
        else if (d.loadBand === "low" && phase < 20)
          bubble(p, kx, ky - 23, "Z", "#6d8a7c");
      },
    };
  },
};
