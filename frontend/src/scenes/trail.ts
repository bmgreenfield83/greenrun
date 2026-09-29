// Trail: the paved path through the woods at Quiet Waters Park, with the South River beyond the trees and
// the South River Overlook on the bank. Side view with parallax layers. The sky follows the clock, the
// trees follow the season, the owner's gait follows today's plan, and a mile marker shows this week's miles.
import {
  chance,
  context,
  painter,
  pixelScale,
  seeded,
  shade,
  sizeCanvas,
  type Painter,
} from "./pixel";
import { deer, dog, goose, heron, owner, stranger } from "./sprites";
import type { Gait, SceneDefinition } from "./types";

const OUTLINE = "#1b2420";
const SPEED: Record<Gait, number> = {
  rest: 0,
  easy: 0.8,
  long: 0.7,
  fast: 1.6,
  done: 0.8,
};

interface Sky {
  top: string;
  bottom: string;
  tint: string | null;
  night: boolean;
}
function skyFor(hour: number): Sky {
  if (hour < 5 || hour >= 20.5)
    return {
      top: "#0d1630",
      bottom: "#2b3a63",
      tint: "rgba(10,18,45,.5)",
      night: true,
    };
  if (hour < 7.5)
    return {
      top: "#44508a",
      bottom: "#f4a47c",
      tint: "rgba(255,150,110,.10)",
      night: false,
    };
  if (hour >= 17.5)
    return {
      top: "#4b4f86",
      bottom: "#f1a25c",
      tint: "rgba(255,120,60,.12)",
      night: false,
    };
  return { top: "#6fb3e3", bottom: "#d4ecf4", tint: null, night: false };
}

// Canopy colors by month; null means bare branches (pines stay green).
function canopyFor(month: number): string[] | null {
  if (month === 11 || month <= 1) return null;
  if (month <= 4) return ["#7fbf5a", "#95cc6b", "#6aa84f", "#f0b8c8"];
  if (month <= 7) return ["#3f7f3a", "#4f9444", "#35702f"];
  if (month === 8) return ["#4a8a3e", "#5c9440", "#c9a13a", "#d9812f"];
  return ["#d9812f", "#c9502f", "#e0b040", "#8a6a2a", "#6b8a3a"];
}
const grassFor = (month: number) =>
  month === 11 || month <= 1 ? "#8a8f6a" : month >= 8 ? "#7c9a4f" : "#6a9a4f";

interface Walker {
  kind: "runner" | "walker";
  x: number;
  dir: 1 | -1;
  speed: number;
  look: number;
  step: number;
  dog: boolean;
}
interface Leaf {
  x: number;
  y: number;
  c: string;
  life: number;
}

export const trail: SceneDefinition = {
  create(canvas, data) {
    const ctx = context(canvas);
    if (!ctx) return null;
    let W = 0,
      H = 0,
      P = 0,
      t = 0,
      scroll = 0,
      frame = 0;
    let riverY = 0,
      bankY = 0,
      pathY = 0,
      runnerX = 0;
    let far: HTMLCanvasElement | null = null,
      mid: HTMLCanvasElement | null = null,
      woods: HTMLCanvasElement | null = null,
      near: HTMLCanvasElement | null = null,
      path: HTMLCanvasElement | null = null;
    let skyCanvas: HTMLCanvasElement | null = null,
      markerKey = "",
      overlookX = 0,
      heronX = 0,
      deerX = 0;
    let stars: [number, number][] = [],
      walkers: Walker[] = [],
      leaves: Leaf[] = [];
    let geese: { x: number; y: number } | null = null,
      deerShown = false;

    const now = () => new Date();
    const strip = (w: number, draw: (p: Painter) => void) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = H;
      const x = context(c);
      if (x) draw(painter(x, { outline: OUTLINE }));
      return c;
    };

    function tree(
      p: Painter,
      x: number,
      base: number,
      h: number,
      rnd: () => number,
      colors: string[] | null,
      pine: boolean,
    ) {
      const trunk = "#5b4331",
        R = Math.round;
      if (pine) {
        p.px(x - 1, R(base - h * 0.3), 2, R(h * 0.3), trunk);
        for (let k = 0; k < 4; k++) {
          const w = Math.round((h / 3) * (1 - k * 0.2)),
            y = Math.round(base - h * 0.3 - k * (h * 0.18));
          p.px(x - w, y - 6, w * 2, 6, shade("#2f5d45", 1 - k * 0.05));
          p.px(x - w + 2, y - 8, w * 2 - 4, 2, "#3b6f53");
        }
        return;
      }
      p.px(x - 1, R(base - h * 0.55), 3, R(h * 0.55), trunk);
      if (!colors) {
        for (let k = 0; k < 5; k++)
          p.ray(
            x + 1,
            R(base - h * 0.45),
            -Math.PI / 2 + (rnd() - 0.5) * 1.8,
            0,
            R(h * 0.4),
            trunk,
          );
        return;
      }
      const cy = base - h * 0.62,
        r = h * 0.32;
      for (let k = 0; k < 6; k++) {
        const c = colors[Math.floor(rnd() * colors.length)];
        p.ellipse(
          Math.round(x + (rnd() - 0.5) * r * 1.2),
          Math.round(cy + (rnd() - 0.5) * r * 0.9),
          Math.round(r * (0.55 + rnd() * 0.3)),
          Math.round(r * (0.5 + rnd() * 0.25)),
          c,
        );
      }
    }

    function buildStrips() {
      const month = now().getMonth(),
        colors = canopyFor(month),
        grass = grassFor(month);
      const rnd = seeded(7);
      far = strip(P, (p) => {
        for (let x = 0; x < P; x++) {
          const h =
            6 + Math.round(Math.sin(x / 37) * 3 + Math.sin(x / 13) * 1.5);
          p.px(x, riverY - h, 1, h, "#7d9c93");
        }
        p.px(0, riverY, P, bankY - riverY, "#4f7f99");
        p.px(0, riverY, P, 1, "#86b2c8");
      });
      mid = strip(P, (p) => {
        p.px(0, bankY, P, H - bankY, grass);
        p.px(0, bankY, P, 1, shade(grass, 1.15));
        for (let x = 20; x < P; x += 14 + Math.floor(rnd() * 24)) {
          if (Math.abs(x - overlookX) < 45) continue;
          tree(
            p,
            x,
            bankY + 4 + Math.floor(rnd() * 6),
            22 + Math.floor(rnd() * 16),
            rnd,
            colors,
            rnd() < 0.3,
          );
        }
        // South River Overlook: a wooden deck with railing and a bench, jutting out over the bluff.
        const ox = overlookX,
          deck = bankY - 1,
          wood = "#8a6440",
          dark = "#5e4229";
        for (const dx of [-26, -8, 10, 26]) p.px(ox + dx, deck, 2, 10, dark);
        p.px(ox - 30, deck - 2, 60, 3, wood);
        p.px(ox - 30, deck - 2, 60, 1, shade(wood, 1.2));
        p.px(ox - 30, deck - 9, 60, 1, wood);
        for (let dx = -30; dx <= 28; dx += 6)
          p.px(ox + dx, deck - 9, 1, 7, dark);
        p.px(ox - 10, deck - 5, 12, 1, dark);
        p.px(ox - 9, deck - 4, 1, 2, dark);
        p.px(ox, deck - 4, 1, 2, dark);
        p.px(ox + 34, deck - 12, 1, 12, dark);
        p.box(ox + 20, deck - 20, 33, 7, "#3e5c3a");
        p.text("OVERLOOK", ox + 22, deck - 19, "#e8e0c8");
      });
      // The woods between the river bank and the path: nearer trees stand lower and grow taller.
      woods = strip(P, (p) => {
        const trees: [number, number][] = [];
        for (let k = 0; k < P / 9; k++)
          trees.push([
            Math.floor(rnd() * P),
            bankY + 14 + Math.floor(rnd() * Math.max(1, pathY - bankY - 24)),
          ]);
        trees.sort((a, b) => a[1] - b[1]);
        for (const [x, base] of trees) {
          const h = Math.max(
            16,
            Math.min(56, Math.round((base - bankY) * 0.95)),
          );
          p.ellipse(x, base, 5, 2, shade(grass, 0.85));
          tree(p, x, base, h, rnd, colors, rnd() < 0.3);
        }
        for (let x = 0; x < P; x += 6 + Math.floor(rnd() * 10))
          p.ellipse(
            x,
            pathY - 5,
            3 + Math.floor(rnd() * 3),
            2,
            shade(grass, 0.8 + rnd() * 0.25),
          );
      });
      near = strip(P, (p) => {
        for (
          let x = 60 + Math.floor(rnd() * 60);
          x < P - 30;
          x += 110 + Math.floor(rnd() * 90)
        )
          tree(
            p,
            x,
            pathY - 1,
            48 + Math.floor(rnd() * 28),
            rnd,
            colors,
            rnd() < 0.25,
          );
      });
      markerKey = "";
    }

    function buildPath() {
      const d = data();
      const label =
        d.weekMiles === null
          ? "WEEK"
          : d.weekPlannedMiles
            ? `${Math.round(d.weekMiles)}/${Math.round(d.weekPlannedMiles)} MI`
            : `${Math.round(d.weekMiles)} MI`;
      markerKey = label;
      const grass = grassFor(now().getMonth());
      path = strip(P, (p) => {
        p.px(0, pathY - 4, P, 4, shade(grass, 0.9));
        p.px(0, pathY, P, 12, "#6f7275");
        p.px(0, pathY, P, 1, "#8c8f91");
        p.px(0, pathY + 11, P, 1, "#55585a");
        p.px(0, pathY + 12, P, H - pathY - 12, shade(grass, 0.8));
        const rnd = seeded(11);
        for (let k = 0; k < P / 6; k++)
          p.px(
            Math.floor(rnd() * P),
            pathY + 1 + Math.floor(rnd() * 10),
            1,
            1,
            rnd() < 0.5 ? "#7d8083" : "#636668",
          );
        for (let x = 0; x < P; x += 3 + Math.floor(rnd() * 5))
          p.px(x, pathY + 12 + Math.floor(rnd() * 3), 1, 2, shade(grass, 1.1));
        // The weekly mile marker: a post with this week's miles against the plan.
        const mx = Math.round(P * 0.55),
          w = label.length * 4 + 3;
        p.px(mx, pathY - 14, 2, 14, "#5e4229");
        p.box(mx - Math.round(w / 2) + 1, pathY - 21, w, 7, "#2f4a36");
        p.text(label, mx - Math.round(w / 2) + 3, pathY - 20, "#f2e9cf");
      });
    }

    function buildSky() {
      const hour = now().getHours() + now().getMinutes() / 60;
      const sky = skyFor(hour);
      skyCanvas = strip(W, (p) => {
        const top = parseInt(sky.top.slice(1), 16),
          bottom = parseInt(sky.bottom.slice(1), 16);
        for (let y = 0; y < riverY; y++) {
          const f = y / Math.max(1, riverY - 1),
            mix = (s: number) =>
              Math.round(
                ((top >> s) & 255) * (1 - f) + ((bottom >> s) & 255) * f,
              );
          p.px(0, y, W, 1, `rgb(${mix(16)},${mix(8)},${mix(0)})`);
        }
        const arc = (hour - 6) / 14;
        if (!sky.night && arc > 0 && arc < 1)
          p.ellipse(
            Math.round(W * (0.15 + arc * 0.7)),
            Math.round(riverY * (0.75 - Math.sin(arc * Math.PI) * 0.55)),
            5,
            5,
            hour > 17 || hour < 8 ? "#ffcf7a" : "#fff3c4",
          );
        if (sky.night) {
          for (const [sx, sy] of stars) p.px(sx, sy, 1, 1, "#e8ecff");
          p.ellipse(
            Math.round(W * 0.8),
            Math.round(riverY * 0.25),
            4,
            4,
            "#f2f0dc",
          );
          p.ellipse(
            Math.round(W * 0.8) + 2,
            Math.round(riverY * 0.25) - 1,
            3,
            3,
            sky.top,
          );
        }
      });
    }

    const screenX = (worldX: number, k: number) => {
      let x = (((worldX - scroll * k) % P) + P) % P;
      if (x > W + 40) x -= P;
      return x;
    };
    const blit = (c: HTMLCanvasElement | null, k: number) => {
      if (!c) return;
      const off = (((scroll * k) % P) + P) % P;
      ctx.drawImage(c, -off, 0);
      ctx.drawImage(c, P - off, 0);
    };

    return {
      layout() {
        const S = pixelScale();
        W = Math.ceil(window.innerWidth / S);
        H = Math.ceil(window.innerHeight / S);
        sizeCanvas(canvas, W, H, S);
        P = Math.max(W + 240, 700);
        riverY = Math.round(H * 0.4);
        bankY = riverY + Math.max(12, Math.round(H * 0.07));
        pathY = H - 34;
        runnerX = Math.max(16, Math.min(34, Math.round(W * 0.05) + 8));
        overlookX = Math.round(P * 0.3);
        heronX = Math.round(P * 0.62);
        deerX = Math.round(P * 0.85);
        const r = seeded(3);
        stars = Array.from(
          { length: Math.round(W / 6) },
          () =>
            [Math.floor(r() * W), Math.floor(r() * riverY * 0.9)] as [
              number,
              number,
            ],
        );
        buildStrips();
        buildPath();
        buildSky();
        walkers = [];
        leaves = [];
      },
      tick() {
        t++;
        const d = data(),
          speed = SPEED[d.gait];
        // On a rest day the owner stands at the Overlook; otherwise the world scrolls past.
        if (d.gait === "rest")
          scroll += (overlookX / 0.35 - runnerX / 0.35 - scroll) * 0.05;
        else scroll += speed;
        frame = t;
        if (t % 600 === 0) buildSky();
        walkers = walkers.filter((w) => w.x > -30 && w.x < W + 30);
        for (const w of walkers) {
          w.x += w.speed - speed;
          w.step++;
        }
        if (walkers.length < 2 && chance(0.004)) {
          const runner = chance(0.5);
          walkers.push(
            runner
              ? {
                  kind: "runner",
                  x: -12,
                  dir: 1,
                  speed: speed + 0.8,
                  look: Math.floor(Math.random() * 64),
                  step: 0,
                  dog: false,
                }
              : {
                  kind: "walker",
                  x: W + 12,
                  dir: -1,
                  speed: -0.35,
                  look: Math.floor(Math.random() * 64),
                  step: 0,
                  dog: chance(0.6),
                },
          );
        }
        if (!geese && chance(0.0015))
          geese = { x: W + 20, y: 10 + Math.random() * riverY * 0.4 };
        if (geese) {
          geese.x -= 0.7;
          if (geese.x < -60) geese = null;
        }
        const dx = screenX(deerX, 0.35);
        if (dx > W || dx < -20) deerShown = chance(0.5);
        const colors = canopyFor(now().getMonth());
        if (
          colors &&
          now().getMonth() >= 8 &&
          leaves.length < 12 &&
          chance(0.08)
        )
          leaves.push({
            x: Math.random() * W,
            y: bankY + Math.random() * (pathY - bankY) * 0.4,
            c: colors[Math.floor(Math.random() * colors.length)],
            life: 120,
          });
        for (const l of leaves) {
          l.y += 0.4;
          l.x += Math.sin((t + l.life) / 6) * 0.4 - speed * 0.7;
          l.life--;
        }
        leaves = leaves.filter((l) => l.life > 0 && l.y < H);
      },
      paint() {
        const d = data(),
          p = painter(ctx, { outline: OUTLINE }),
          hour = now().getHours() + now().getMinutes() / 60,
          sky = skyFor(hour);
        const label =
          d.weekMiles === null
            ? "WEEK"
            : d.weekPlannedMiles
              ? `${Math.round(d.weekMiles)}/${Math.round(d.weekPlannedMiles)} MI`
              : `${Math.round(d.weekMiles)} MI`;
        if (label !== markerKey) buildPath();
        if (skyCanvas) ctx.drawImage(skyCanvas, 0, 0);
        blit(far, 0.12);
        for (let k = 0; k < W / 9; k++) {
          const x = (k * 37 + t) % W,
            y = riverY + 2 + ((k * 7) % Math.max(1, bankY - riverY - 3));
          p.px(Math.floor(x), y, 3, 1, "rgba(200,230,240,.35)");
        }
        blit(mid, 0.35);
        const hx = screenX(heronX, 0.35);
        if (hx > -10 && hx < W + 10)
          heron(p, Math.round(hx), bankY - 2, (t >> 4) % 2);
        const dx = screenX(deerX, 0.35);
        if (deerShown && dx > -10 && dx < W + 10)
          deer(p, Math.round(dx), bankY + 8, -1, (t >> 5) % 3 !== 0);
        if (geese)
          for (let k = 0; k < 5; k++)
            goose(
              p,
              Math.round(geese.x + k * 8),
              Math.round(geese.y + Math.abs(k - 2) * 4),
              (t >> 2) + k,
            );
        blit(woods, 0.5);
        blit(near, 0.7);
        blit(path, 1);
        const feet = pathY + 8;
        for (const w of walkers) {
          if (w.kind === "runner")
            stranger(
              p,
              OUTLINE,
              Math.round(w.x),
              feet + 2,
              w.look,
              1,
              w.step >> 1,
              true,
            );
          else {
            stranger(
              p,
              OUTLINE,
              Math.round(w.x),
              feet - 2,
              w.look,
              -1,
              w.step >> 3,
              false,
            );
            if (w.dog) {
              dog(p, Math.round(w.x) - 12, feet - 1, -1, w.step >> 2);
              p.px(Math.round(w.x) - 9, feet - 12, 6, 1, "#8a2d2d");
            }
          }
        }
        const pose =
          d.gait === "rest" ? ((t >> 5) % 2 ? "stretch" : "stand") : "run";
        owner(p, OUTLINE, runnerX, feet, pose, frame);
        for (const l of leaves)
          p.px(Math.round(l.x), Math.round(l.y), 2, 1, l.c);
        if (sky.tint) p.px(0, 0, W, H, sky.tint);
        if (sky.night && [5, 6, 7].includes(now().getMonth()))
          for (let k = 0; k < 8; k++)
            if ((t + k * 13) % 40 < 20)
              p.px(
                (k * 53 + (t >> 3)) % W,
                pathY - 8 - ((k * 17) % 30),
                1,
                1,
                "#fff27a",
              );
        p.px(0, 0, W, H, "rgba(246,241,227,.12)");
      },
    };
  },
};
