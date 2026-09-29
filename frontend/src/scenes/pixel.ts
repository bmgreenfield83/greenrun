// Pixel-art toolkit shared by the scenes (ported from Greenhome): a 3x5 font, seeded randomness, and drawing helpers.

export type Palette = Record<string, string>;
export type Painter = ReturnType<typeof painter>;

const FONT: Record<string, string> = {
  A: "010101111101101",
  B: "110101110101110",
  C: "011100100100011",
  D: "110101101101110",
  E: "111100110100111",
  F: "111100110100100",
  G: "011100101101011",
  H: "101101111101101",
  I: "111010010010111",
  J: "001001001101010",
  K: "101101110101101",
  L: "100100100100111",
  M: "101111111101101",
  N: "110101101101101",
  O: "010101101101010",
  P: "110101110100100",
  Q: "010101101110011",
  R: "110101110101101",
  S: "011100010001110",
  T: "111010010010010",
  U: "101101101101111",
  V: "101101101101010",
  W: "101101111111101",
  X: "101101010101101",
  Y: "101101010010010",
  Z: "111001010100111",
  0: "111101101101111",
  1: "010110010010111",
  2: "110001010100111",
  3: "110001010001110",
  4: "101101111001001",
  5: "111100110001110",
  6: "011100111101111",
  7: "111001010010010",
  8: "111101111101111",
  9: "111101111001110",
  ".": "000000000000010",
  "/": "001001010100100",
  ":": "000010000010000",
  "-": "000000111000000",
  ">": "100010001010100",
  "%": "101001010100101",
  "!": "010010010000010",
  "?": "111001010000010",
  " ": "000000000000000",
  // Symbols for cartoon swearing.
  "@": "010101111100011",
  "#": "101111101111101",
  $: "011110010011110",
  "&": "010101010101011",
  "*": "000101010101000",
};
export const FONT_CHARS = new Set(Object.keys(FONT));

export const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let v = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
  return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
};
export const chance = (p: number) => Math.random() < p;
export const pick = <T>(list: T[], r: () => number = Math.random): T =>
  list[Math.floor(r() * list.length)];
export const shade = (hex: string, f: number) =>
  "#" +
  [1, 3, 5]
    .map((i) =>
      Math.round(parseInt(hex.slice(i, i + 2), 16) * f)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
// Shuffled deck: every kind appears once before any repeats.
export function deck<T>(rnd: () => number, kinds: T[]) {
  let pool: T[] = [];
  return () => {
    if (!pool.length) pool = [...kinds].sort(() => rnd() - 0.5);
    return pool.pop() as T;
  };
}

export function painter(ctx: CanvasRenderingContext2D, C: Palette) {
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  const text = (s: string, x: number, y: number, c: string) =>
    [...s.toUpperCase()].forEach((ch, i) => {
      const g = FONT[ch] ?? FONT[" "];
      for (let b = 0; b < 15; b++)
        if (g[b] === "1") px(x + i * 4 + (b % 3), y + ((b / 3) | 0), 1, 1, c);
    });
  const box = (x: number, y: number, w: number, h: number, fill: string) => {
    px(x - 1, y - 1, w + 2, h + 2, C.outline);
    px(x, y, w, h, fill);
  };
  // Three-quarter block: top face above a front face, outlined, with a floor shadow.
  const block = (
    x: number,
    base: number,
    w: number,
    h: number,
    d: number,
    face: string,
    top: string,
  ) => {
    px(x + 2, base, w, 2, C.shadow);
    px(x - 1, base - h - d - 1, w + 2, h + d + 2, C.outline);
    px(x, base - h - d, w, d, top);
    px(x, base - h, w, h, face);
    px(x, base - h, w, 1, C.outline);
  };
  const ellipse = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    c: string,
    ring = false,
  ) => {
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx || 1) + (y * y) / (ry * ry || 1);
        if (ring ? d <= 1 && d > 0.62 : d <= 1) px(cx + x, cy + y, 1, 1, c);
      }
  };
  const ray = (
    cx: number,
    cy: number,
    a: number,
    r0: number,
    r1: number,
    c: string,
    sy = 1,
  ) => {
    for (let r = r0; r <= r1; r++)
      px(
        Math.round(cx + Math.cos(a) * r),
        Math.round(cy + Math.sin(a) * r * sy),
        1,
        1,
        c,
      );
  };
  return { ctx, px, text, box, block, ellipse, ray };
}

// Canvas sized in logical pixels and scaled up by a whole number for crisp pixels.
export function sizeCanvas(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  scale: number,
) {
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w * scale}px`;
  canvas.style.height = `${h * scale}px`;
}
export const pixelScale = () => (window.innerWidth < 760 ? 2 : 3);
export function context(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}
