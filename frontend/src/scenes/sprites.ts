// Character sprites, drawn in side view with feet at (x, y). Colors that belong to a character live here;
// scene palettes provide only the outline and shadow.
import { shade, type Painter } from "./pixel";

const OWNER = {
  skin: "#e2b18c",
  skinShade: "#c48f6c",
  stubble: "#a88468",
  cap: "#1c1f22",
  capBill: "#2c3136",
  glasses: "#1a1d20",
  glint: "#cfe6f0",
  shirt: "#26292c",
  shirtShade: "#17191b",
  shorts: "#1d2024",
  shoe: "#3a5da8",
  sole: "#e8e8e0",
  watch: "#111316",
};

// Thick line for limbs.
function limb(
  p: Painter,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c: string,
  w = 2,
) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let k = 0; k <= n; k++) {
    const f = k / n;
    p.px(
      Math.round(x0 + (x1 - x0) * f),
      Math.round(y0 + (y1 - y0) * f),
      w,
      w === 2 ? 2 : 1,
      c,
    );
  }
}

// Leg and arm key positions for a four-frame run cycle (and a two-frame walk), relative to the hip.
// Six-frame jog: contact, midstance, flight on each side. Both feet leave the ground on flight frames.
const RUN = [
  // [near knee, near foot, far knee, far foot, near elbow, near hand, far elbow, far hand]
  [
    [2, 3],
    [4, 7],
    [-3, 2],
    [-5, 4],
    [-3, 2],
    [-2, 5],
    [1, 3],
    [4, 1],
  ],
  [
    [1, 3],
    [0, 7],
    [2, 1],
    [0, 4],
    [-1, 3],
    [1, 5],
    [0, 3],
    [2, 4],
  ],
  [
    [-1, 4],
    [-4, 6],
    [3, 2],
    [4, 5],
    [0, 3],
    [3, 3],
    [-2, 3],
    [-1, 5],
  ],
  [
    [-3, 2],
    [-5, 4],
    [2, 3],
    [4, 7],
    [1, 3],
    [4, 1],
    [-3, 2],
    [-2, 5],
  ],
  [
    [2, 1],
    [0, 4],
    [1, 3],
    [0, 7],
    [0, 3],
    [2, 4],
    [-1, 3],
    [1, 5],
  ],
  [
    [3, 2],
    [4, 5],
    [-1, 4],
    [-4, 6],
    [-2, 3],
    [-1, 5],
    [0, 3],
    [3, 3],
  ],
] as const;
const RUN_LIFT = [0, 0, 1, 0, 0, 1];
const WALK = [
  [
    [1, 3],
    [2, 7],
    [-1, 3],
    [-2, 7],
    [-1, 3],
    [-1, 6],
    [1, 3],
    [1, 6],
  ],
  [
    [0, 4],
    [0, 7],
    [0, 4],
    [0, 7],
    [0, 3],
    [0, 6],
    [0, 3],
    [0, 6],
  ],
] as const;

export type OwnerPose = "run" | "walk" | "stand" | "stretch";

// The owner: black running cap, glasses, a trimmed beard shadow, dark tee and shorts, blue shoes, a watch.
// About 12x23 pixels. `frame` advances the cycle; `bob` lifts the body on flight frames.
export function owner(
  p: Painter,
  outline: string,
  x: number,
  y: number,
  pose: OwnerPose,
  frame: number,
) {
  const O = OWNER;
  const keys =
    pose === "run"
      ? RUN[frame % 6]
      : pose === "walk"
        ? WALK[frame % 2]
        : WALK[1];
  const bob = pose === "run" ? RUN_LIFT[frame % 6] : 0;
  const hipX = x,
    hipY = y - 8 - bob;
  p.px(x - 5, y - 1, 11, 2, "rgba(0,0,0,.18)");
  // Far limbs first, a shade darker.
  const [nk, nf, fk, ff, ne, nh, fe, fh] = keys;
  limb(p, hipX, hipY, hipX + fk[0], hipY + fk[1], O.skinShade);
  limb(p, hipX + fk[0], hipY + fk[1], hipX + ff[0], hipY + ff[1], O.skinShade);
  p.px(hipX + ff[0] - 1, hipY + ff[1] + 1, 4, 2, shade(O.shoe, 0.75));
  const shoulderX = x,
    shoulderY = hipY - 6;
  if (pose !== "stretch") {
    limb(
      p,
      shoulderX,
      shoulderY,
      shoulderX + fe[0],
      shoulderY + fe[1],
      O.shirtShade,
    );
    limb(
      p,
      shoulderX + fe[0],
      shoulderY + fe[1],
      shoulderX + fh[0],
      shoulderY + fh[1],
      O.skinShade,
    );
  }
  // Torso and shorts.
  p.px(x - 3, hipY - 8, 6, 8, outline);
  p.px(x - 2, hipY - 8, 5, 7, O.shirt);
  p.px(x - 2, hipY - 2, 5, 3, O.shorts);
  // Near leg.
  limb(p, hipX, hipY, hipX + nk[0], hipY + nk[1], O.skin);
  limb(p, hipX + nk[0], hipY + nk[1], hipX + nf[0], hipY + nf[1], O.skin);
  p.px(hipX + nf[0] - 1, hipY + nf[1] + 1, 4, 2, O.shoe);
  p.px(hipX + nf[0] - 1, hipY + nf[1] + 2, 4, 1, O.sole);
  // Head: cap with the bill forward, ear, glasses, beard.
  const hx = x - 2,
    hy = hipY - 15;
  p.px(hx - 1, hy - 1, 7, 8, outline);
  p.px(hx, hy + 1, 6, 6, O.skin);
  p.px(hx, hy - 1, 6, 3, O.cap);
  p.px(hx + 5, hy + 1, 3, 1, O.capBill);
  p.px(hx - 1, hy + 2, 1, 5, O.skinShade);
  p.px(hx + 1, hy + 3, 1, 2, O.skinShade);
  p.px(hx + 3, hy + 3, 3, 1, O.glasses);
  p.px(hx + 4, hy + 3, 1, 1, O.glint);
  p.px(hx + 1, hy + 5, 5, 1, O.stubble);
  p.px(hx + 2, hy + 6, 4, 1, O.stubble);
  p.px(hx + 4, hy + 5, 1, 1, O.skinShade);
  p.px(x - 1, hy + 7, 2, 1, O.skin);
  // Near arm with the watch.
  if (pose === "stretch") {
    limb(p, shoulderX, shoulderY, shoulderX + 1, shoulderY - 5, O.shirt);
    limb(
      p,
      shoulderX + 1,
      shoulderY - 5,
      shoulderX + 2,
      shoulderY - 10,
      O.skin,
    );
  } else {
    limb(
      p,
      shoulderX,
      shoulderY,
      shoulderX + ne[0],
      shoulderY + ne[1],
      O.shirt,
    );
    limb(
      p,
      shoulderX + ne[0],
      shoulderY + ne[1],
      shoulderX + nh[0],
      shoulderY + nh[1],
      O.skin,
    );
    p.px(shoulderX + nh[0], shoulderY + nh[1], 2, 1, O.watch);
  }
}

// A generic passer-by in side view. `look` picks colors; `dir` is 1 facing right, -1 facing left.
export function stranger(
  p: Painter,
  outline: string,
  x: number,
  y: number,
  look: number,
  dir: 1 | -1,
  frame: number,
  running: boolean,
) {
  const skins = ["#e8c09a", "#a8764f", "#d8a77f", "#7a5236"];
  const shirts = [
    "#c0392b",
    "#2e86c1",
    "#f1c40f",
    "#8e44ad",
    "#16a085",
    "#e67e22",
  ];
  const hairs = ["#2b1d14", "#6b4a2b", "#141414", "#c9a15a"];
  const skin = skins[look % skins.length],
    shirt = shirts[(look >> 1) % shirts.length],
    hair = hairs[(look >> 2) % hairs.length];
  const stride = running ? [3, -3, 0, 0][frame % 4] : [1, -1][frame % 2];
  const hipY = y - 8;
  p.px(x - 4, y - 1, 9, 2, "rgba(0,0,0,.15)");
  limb(p, x, hipY, x - stride * dir, y - 1, shade(skin, 0.8));
  p.px(x - 3, hipY - 8, 6, 9, outline);
  p.px(x - 2, hipY - 8, 5, 8, shirt);
  p.px(x - 2, hipY - 1, 5, 2, running ? "#23272b" : "#3b4a5c");
  limb(p, x, hipY, x + stride * dir, y - 1, skin);
  p.px(x - 3, hipY - 15, 7, 7, outline);
  p.px(x - 2, hipY - 14, 5, 5, skin);
  p.px(x - 2, hipY - 15, 5, 2, hair);
  p.px(dir > 0 ? x - 2 : x + 2, hipY - 13, 1, 3, hair);
  p.px(dir > 0 ? x + 1 : x - 1, hipY - 12, 1, 1, outline);
  limb(
    p,
    x,
    hipY - 6,
    x + (running ? 2 : 1) * dir * (frame % 2 ? 1 : -1),
    hipY - 2,
    skin,
    1,
  );
}

export function dog(
  p: Painter,
  x: number,
  y: number,
  dir: 1 | -1,
  frame: number,
) {
  const fur = "#b5793e",
    dark = "#7a4f28";
  p.px(x - 5, y - 6, 9, 4, fur);
  p.px(dir > 0 ? x + 3 : x - 7, y - 9, 4, 4, fur);
  p.px(dir > 0 ? x + 5 : x - 7, y - 10, 1, 2, dark);
  p.px(dir > 0 ? x + 6 : x - 7, y - 7, 1, 1, "#111");
  p.px(dir > 0 ? x - 6 : x + 4, y - 7 - (frame % 2), 2, 1, fur);
  const f = frame % 2;
  p.px(x - 4 + f, y - 2, 1, 2, dark);
  p.px(x + 2 - f, y - 2, 1, 2, dark);
}

export function heron(p: Painter, x: number, y: number, frame: number) {
  const grey = "#8d9aa6",
    dark = "#4c5660";
  p.px(x, y - 4, 1, 4, dark);
  p.px(x + 2, y - 4, 1, 4, dark);
  p.px(x - 2, y - 9, 6, 5, grey);
  p.px(x + 3, y - 14 + (frame % 2), 1, 6, grey);
  p.px(x + 3, y - 15 + (frame % 2), 3, 2, grey);
  p.px(x + 6, y - 14 + (frame % 2), 3, 1, "#d9a23b");
  p.px(x - 3, y - 8, 3, 2, dark);
}

export function goose(p: Painter, x: number, y: number, frame: number) {
  p.px(x - 2, y, 5, 2, "#5d5146");
  p.px(x + 3, y - 1, 3, 1, "#1b1b1b");
  const up = frame % 2 === 0;
  p.px(x - 1, up ? y - 2 : y + 2, 3, 1, "#7a6b5d");
}

export function deer(
  p: Painter,
  x: number,
  y: number,
  dir: 1 | -1,
  look: boolean,
) {
  const coat = "#9b6a3c",
    dark = "#6c4523";
  p.px(x - 6, y - 12, 12, 6, coat);
  for (const dx of [-5, -3, 3, 5]) p.px(x + dx, y - 6, 1, 6, dark);
  const nx = dir > 0 ? x + 5 : x - 8;
  p.px(nx, y - 17 + (look ? 0 : 3), 3, 6, coat);
  p.px(nx + (dir > 0 ? 2 : -1), y - 18 + (look ? 0 : 3), 3, 3, coat);
  p.px(nx + (dir > 0 ? 4 : -1), y - 17 + (look ? 0 : 3), 1, 1, "#111");
  p.px(nx, y - 20 + (look ? 0 : 3), 1, 2, dark);
  p.px(dir > 0 ? x - 7 : x + 6, y - 12, 1, 2, "#f2e6d0");
}
