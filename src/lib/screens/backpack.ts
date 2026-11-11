// Backpack screenshots: finding item icons, telling which item each one is, and isolating the
// count in its corner. Pure functions over pixel data, so they can be tested without a browser.

/** RGBA pixels, as a canvas's getImageData returns them. */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Items the planner can use, by what they fill in. */
export const BAG_ITEMS = [
  "ore",
  "essence",
  "sand",
  "rareSand",
  "epicSand",
  "basicTreats",
  "premiumTreats",
  "deluxeTreats",
  "hammer",
  "pickaxe",
  "knuckles",
  "shovel",
] as const;
export type BagItem = (typeof BAG_ITEMS)[number];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const rgb = (p: Pixels, x: number, y: number) => {
  const i = (y * p.width + x) * 4;
  return [p.data[i], p.data[i + 1], p.data[i + 2]] as const;
};

/**
 * Item icons: round, dark shapes on the Backpack's light grey page. Works on a small copy of the
 * screenshot (about 600 px wide); returns boxes in that copy's pixels.
 */
export function findIcons(p: Pixels): Box[] {
  const { width: w, height: h } = p;
  const fg = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = rgb(p, x, y);
      const lo = Math.min(r, g, b), hi = Math.max(r, g, b);
      fg[y * w + x] = lo >= 200 && hi - lo < 20 ? 0 : 1;
    }
  }
  const seen = new Uint8Array(w * h);
  const boxes: Box[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!fg[start] || seen[start]) continue;
    seen[start] = 1;
    stack.push(start);
    let x0 = w, x1 = 0, y0 = h, y1 = 0, n = 0;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i / w) | 0;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= w * h || seen[j] || !fg[j]) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const fill = n / (bw * bh);
    // A filled circle covers about 79% of its box.
    if (bw >= w * 0.08 && bw <= w * 0.3 && bw / bh >= 0.8 && bw / bh <= 1.25 && fill > 0.6) boxes.push({ x: x0, y: y0, w: bw, h: bh });
  }
  return boxes;
}

/** Icons are compared as 12×12 thumbnails, inside the circle and away from the count corner. */
export const THUMB = 12;
const THUMB_MASK: number[] = (() => {
  const m: number[] = [];
  for (let y = 0; y < THUMB; y++) {
    for (let x = 0; x < THUMB; x++) {
      const inCircle = Math.hypot(x - (THUMB - 1) / 2, y - (THUMB - 1) / 2) <= THUMB * 0.47;
      const countCorner = y >= THUMB * 0.55 && x >= THUMB * 0.2;
      if (inCircle && !countCorner) m.push(y * THUMB + x);
    }
  }
  return m;
})();

/** Average colour difference between two thumbnails (RGBA, THUMB×THUMB). */
export function thumbDistance(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  for (const i of THUMB_MASK) for (let c = 0; c < 3; c++) sum += Math.abs(a[i * 4 + c] - b[i * 4 + c]);
  return sum / THUMB_MASK.length / 3;
}

/**
 * How close a thumbnail must be to count as a match. Across two devices, genuine matches scored 16 or
 * less, apart from Battle Essence (about 18), whose nearest other item is 20+ away. Look-alike items
 * score 17–19 but always have a close runner-up. So: 16 or less, or up to 19 when clearly ahead.
 */
export const MATCH_LIMIT = 16;
export const LOOSE_LIMIT = 19;
export const CLEAR_LEAD = 15;

export function identify(thumb: Uint8ClampedArray, templates: Partial<Record<BagItem, Uint8ClampedArray>>): { item: BagItem; distance: number } | undefined {
  const scores = (Object.entries(templates) as [BagItem, Uint8ClampedArray][])
    .map(([item, t]) => ({ item, distance: thumbDistance(thumb, t) }))
    .sort((a, b) => a.distance - b.distance);
  const [best, next] = scores;
  if (!best) return undefined;
  if (best.distance <= MATCH_LIMIT) return best;
  if (best.distance <= LOOSE_LIMIT && (!next || next.distance - best.distance >= CLEAR_LEAD)) return best;
  return undefined;
}

/** Black-and-white image: 1 where there's ink. */
export interface Ink {
  width: number;
  height: number;
  ink: Uint8Array;
}

/**
 * The count's dark plate inside the bottom-right of an icon: the columns and rows that are mostly
 * dark. `p` is that corner of the icon. Returns the plate in `p`'s pixels.
 */
export function findPlate(p: Pixels): Box | null {
  const dark = (x: number, y: number) => {
    const [r, g, b] = rgb(p, x, y);
    return (r + g + b) / 3 < 95;
  };
  const cols: number[] = [], rows: number[] = [];
  for (let x = 0; x < p.width; x++) {
    let n = 0;
    for (let y = 0; y < p.height; y++) n += dark(x, y) ? 1 : 0;
    if (n / p.height > 0.45) cols.push(x);
  }
  for (let y = 0; y < p.height; y++) {
    let n = 0;
    for (let x = 0; x < p.width; x++) n += dark(x, y) ? 1 : 0;
    if (n / p.width > 0.35) rows.push(y);
  }
  if (!cols.length || !rows.length) return null;
  const x = Math.min(...cols), y = Math.min(...rows);
  return { x, y, w: Math.max(...cols) - x + 1, h: Math.max(...rows) - y + 1 };
}

/** The count's white text as ink: light, uncoloured pixels. */
export function whiteInk(p: Pixels): Ink {
  const ink = new Uint8Array(p.width * p.height);
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      const [r, g, b] = rgb(p, x, y);
      const lo = Math.min(r, g, b), hi = Math.max(r, g, b);
      ink[y * p.width + x] = lo >= 175 && hi - lo < 45 ? 1 : 0;
    }
  }
  return { width: p.width, height: p.height, ink };
}

interface Blob {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  n: number;
  pixels: number[];
}

function blobs(img: Ink): Blob[] {
  const { width: w, height: h, ink } = img;
  const seen = new Uint8Array(w * h);
  const out: Blob[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!ink[start] || seen[start]) continue;
    seen[start] = 1;
    const stack = [start];
    const b: Blob = { x0: w, y0: h, x1: 0, y1: 0, n: 0, pixels: [] };
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i / w) | 0;
      b.n++;
      b.pixels.push(i);
      b.x0 = Math.min(b.x0, x);
      b.x1 = Math.max(b.x1, x);
      b.y0 = Math.min(b.y0, y);
      b.y1 = Math.max(b.y1, y);
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= w * h || seen[j] || !ink[j]) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    out.push(b);
  }
  return out;
}

/**
 * Just the number. Counts are right-aligned, so start from the rightmost character-sized shape in
 * the lower part, then walk left along the same baseline (keeping small shapes like the decimal
 * point) until a wide gap, which is where the icon's art begins.
 */
export function trimNumber(img: Ink): Ink | null {
  const H = img.height;
  const all = blobs(img).filter((b) => b.n >= 12);
  const tall = all.filter((b) => {
    const bh = b.y1 - b.y0;
    return bh > H * 0.18 && bh < H * 0.8 && b.y1 >= H * 0.55;
  });
  if (!tall.length) return null;
  const anchor = tall.reduce((a, b) => (b.x1 > a.x1 ? b : a));
  const h = anchor.y1 - anchor.y0;
  const base = anchor.y1;
  const fits = (b: Blob) => {
    const bh = b.y1 - b.y0, bw = b.x1 - b.x0;
    return b.x1 <= anchor.x1 && Math.abs(b.y1 - base) <= 0.18 * h && (bh >= 0.55 * h || (bh <= 0.35 * h && bw <= 0.4 * h));
  };
  const kept: Blob[] = [anchor];
  let left = anchor.x0;
  for (const b of all.filter((b) => b !== anchor && fits(b)).sort((a, b) => b.x1 - a.x1)) {
    if (left - b.x1 > 0.7 * h) break;
    kept.push(b);
    left = Math.min(left, b.x0);
  }
  const x0 = Math.min(...kept.map((b) => b.x0)), y0 = Math.min(...kept.map((b) => b.y0));
  const x1 = Math.max(...kept.map((b) => b.x1)), y1 = Math.max(...kept.map((b) => b.y1));
  const width = x1 - x0 + 1, height = y1 - y0 + 1;
  const ink = new Uint8Array(width * height);
  for (const b of kept) {
    for (const i of b.pixels) {
      const x = i % img.width, y = (i / img.width) | 0;
      ink[(y - y0) * width + (x - x0)] = 1;
    }
  }
  return { width, height, ink };
}

/** First number in the top bar, e.g. "529K+36.3K+112" -> "529K" (Rola). */
export function firstAmount(text: string): string | undefined {
  const m = text.replace(/\s/g, "").match(/\d[\d.,]*[KMB]?/);
  return m ? m[0] : undefined;
}
