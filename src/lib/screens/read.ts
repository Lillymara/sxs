// Runs text recognition on game screenshots in the browser. Nothing leaves the device: the
// recognizer (Tesseract.js) downloads once when first used and runs locally.
import type { PSM, Worker } from "tesseract.js";
import {
  CART_ROWS,
  cartRowCentres,
  classify,
  levelFromNeed,
  parseBed,
  parseCartValue,
  parseCharacterXp,
  parseGearBadges,
  parseProgression,
  parseSeason,
  type ScreenKind,
  type SeasonLevels,
  type Word,
} from "./parse";
import { BAG_ITEMS, THUMB, findIcons, findPlate, firstAmount, identify, trimNumber, whiteInk, type BagItem, type Ink } from "./backpack";
import { parseAmount } from "../xp";

export interface ScreenRead {
  file: string;
  kind: ScreenKind;
  season?: number;
  level?: number;
  xp?: string;
  /** EXP the level needs, kept so the level can be worked out once the season is known. */
  need?: string;
  rate?: number;
  cart?: Partial<Record<(typeof CART_ROWS)[number], number>>;
  /** Character screen: each gear piece's level, when all five badges read. */
  gear?: number[];
  levels?: SeasonLevels;
  /** Backpack: amounts of the items the planner uses. */
  bag?: Partial<Record<BagItem, number>>;
  /** Backpack top bar: Rola on hand. */
  rola?: number;
}

const WIDTH = 1200;
// Page segmentation mode by value, so the recognizer itself only loads when first used.
const SINGLE_LINE = "7" as unknown as PSM;
const SPARSE = "11" as unknown as PSM;

/** The screenshot scaled to a fixed width, which keeps text sizes (and our thresholds) consistent. */
async function loadCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = Math.round((bitmap.height * WIDTH) / bitmap.width);
  const ctx = canvas.getContext("2d")!;
  // Smooth downscaling keeps thin digits intact on large screenshots.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/**
 * Black text on white: keeps only light, uncoloured pixels. The game draws most numbers in
 * off-white with a dark outline over coloured panels, which plain recognition struggles with.
 */
function masked(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const img = src.getContext("2d")!.getImageData(0, 0, src.width, src.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lo = Math.min(d[i], d[i + 1], d[i + 2]);
    const hi = Math.max(d[i], d[i + 1], d[i + 2]);
    const v = lo >= 200 && hi - lo < 36 ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  out.getContext("2d")!.putImageData(img, 0, 0);
  return out;
}

/**
 * The gear area of the Character screen (20–60% down), at the screenshot's own resolution with only
 * the light mint-green badge text kept: bright, and at least as green as it is red or blue.
 */
async function gearBand(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / bitmap.width);
  const top = Math.round(bitmap.height * 0.2), height = Math.round(bitmap.height * 0.4);
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(height * scale);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, top, bitmap.width, height, 0, 0, c.width, c.height);
  bitmap.close();
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const v = (r + g + b) / 3 >= 160 && g - r >= 8 && g >= b ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function crop(src: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number): HTMLCanvasElement {
  // Whole pixels and no smoothing: a fractional offset blurs the black-and-white text.
  const left = Math.round(x0), top = Math.round(y0);
  const w = Math.max(1, Math.round(x1) - left);
  const h = Math.max(1, Math.round(y1) - top);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, left, top, w, h, 0, 0, w, h);
  return c;
}

let workerPromise: Promise<Worker> | null = null;
let rowWorkerPromise: Promise<Worker> | null = null;
/** The page reader, loaded on first use. */
export function getWorker(): Promise<Worker> {
  workerPromise ??= import("tesseract.js").then(({ createWorker }) => createWorker("eng"));
  workerPromise.catch(() => (workerPromise = null));
  return workerPromise;
}
/**
 * A second reader for digits only, so the page reader's settings never change. Every use sets both
 * of its settings first, so it never relies on defaults.
 */
const DIGIT_MODES = {
  cartRow: { tessedit_char_whitelist: "+0123456789/h", tessedit_pageseg_mode: SINGLE_LINE },
  gearBadges: { tessedit_char_whitelist: "+0123456789", tessedit_pageseg_mode: SPARSE },
  count: { tessedit_char_whitelist: "0123456789.KMB", tessedit_pageseg_mode: SINGLE_LINE },
  topBar: { tessedit_char_whitelist: "0123456789.KMB+", tessedit_pageseg_mode: SINGLE_LINE },
};
async function getDigitWorker(mode: keyof typeof DIGIT_MODES): Promise<Worker> {
  rowWorkerPromise ??= import("tesseract.js").then(({ createWorker }) => createWorker("eng"));
  rowWorkerPromise.catch(() => (rowWorkerPromise = null));
  const w = await rowWorkerPromise;
  await w.setParameters(DIGIT_MODES[mode]);
  return w;
}

async function recognize(worker: Worker, canvas: HTMLCanvasElement): Promise<{ text: string; words: Word[] }> {
  const { data } = await worker.recognize(canvas, {}, { blocks: true, text: true });
  const words: Word[] = [];
  for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const w of l.words) words.push({ text: w.text, bbox: w.bbox });
  return { text: data.text ?? "", words };
}

/** The screenshot at its own resolution (capped at 2000 px wide), for reading small text. */
async function fullCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / bitmap.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  return c;
}

/** Icon finding works on a smooth copy this wide: enough detail for exact boxes, small enough to be quick. */
const ICON_WORK = 600;
function smoothDraw(dst: HTMLCanvasElement, src: HTMLCanvasElement) {
  const ctx = dst.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, dst.width, dst.height);
}

const pixels = (c: HTMLCanvasElement) => c.getContext("2d")!.getImageData(0, 0, c.width, c.height);

/** A 12×12 thumbnail of an area, lightly blurred first so devices with different scaling compare alike. */
function thumbnail(src: CanvasImageSource, x: number, y: number, w: number, h: number): Uint8ClampedArray {
  const blurred = document.createElement("canvas");
  blurred.width = Math.round(w);
  blurred.height = Math.round(h);
  const bctx = blurred.getContext("2d")!;
  bctx.filter = `blur(${(w / 60).toFixed(2)}px)`;
  bctx.drawImage(src, x, y, w, h, 0, 0, blurred.width, blurred.height);
  const small = document.createElement("canvas");
  small.width = small.height = THUMB;
  const sctx = small.getContext("2d")!;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(blurred, 0, 0, THUMB, THUMB);
  return sctx.getImageData(0, 0, THUMB, THUMB).data;
}

let templatesPromise: Promise<Partial<Record<BagItem, Uint8ClampedArray>>> | null = null;
/** Reference icons for each Backpack item the planner uses (public/art/bag). */
function bagTemplates() {
  templatesPromise ??= Promise.all(
    BAG_ITEMS.map(
      (item) =>
        new Promise<[BagItem, Uint8ClampedArray]>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve([item, thumbnail(img, 0, 0, img.naturalWidth, img.naturalHeight)]);
          img.onerror = reject;
          img.src = `${import.meta.env.BASE_URL}art/bag/${item}.png?v=${__BUILD_ID__}`;
        }),
    ),
  ).then((pairs) => Object.fromEntries(pairs));
  templatesPromise.catch(() => (templatesPromise = null));
  return templatesPromise;
}

/** Ink as a black-on-white canvas with its text scaled to about 36 px tall, which suits the reader. */
function inkCanvas(ink: Ink): HTMLCanvasElement {
  const scale = 36 / Math.max(1, ink.height);
  const pad = 12;
  const src = document.createElement("canvas");
  src.width = ink.width;
  src.height = ink.height;
  const sctx = src.getContext("2d")!;
  const img = sctx.createImageData(ink.width, ink.height);
  for (let i = 0; i < ink.ink.length; i++) {
    const v = ink.ink[i] ? 0 : 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(ink.width * scale)) + pad * 2;
  out.height = 36 + pad * 2;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, pad, pad, out.width - pad * 2, 36);
  return out;
}

/**
 * Backpack: find every item icon, identify the ones the planner uses, and read each one's count from
 * its corner plate. Rola comes from the first number in the top bar.
 */
async function readBackpack(full: HTMLCanvasElement): Promise<Pick<ScreenRead, "bag" | "rola">> {
  const work = document.createElement("canvas");
  work.width = ICON_WORK;
  work.height = Math.round((full.height * ICON_WORK) / full.width);
  smoothDraw(work, full);
  const scale = full.width / work.width;
  const icons = findIcons(pixels(work)).map((b) => ({ x: b.x * scale, y: b.y * scale, w: b.w * scale, h: b.h * scale }));
  const templates = await bagTemplates();

  // Identify first; if two icons look like the same item, keep the closer match.
  const best = new Map<BagItem, { distance: number; icon: (typeof icons)[number] }>();
  for (const icon of icons) {
    const match = identify(thumbnail(full, icon.x, icon.y, icon.w, icon.h), templates);
    if (match && (!best.has(match.item) || match.distance < best.get(match.item)!.distance)) best.set(match.item, { distance: match.distance, icon });
  }

  const counter = await getDigitWorker("count");
  const bag: Partial<Record<BagItem, number>> = {};
  for (const [item, { icon }] of best) {
    const corner = crop(full, icon.x + icon.w * 0.2, icon.y + icon.h * 0.6, icon.x + icon.w * 0.99, icon.y + icon.h * 0.97);
    const plate = findPlate(pixels(corner));
    if (!plate) continue;
    const plateCanvas = crop(corner, plate.x, plate.y, plate.x + plate.w, plate.y + plate.h);
    // Enlarge before picking out the text, as the counts are small.
    const big = document.createElement("canvas");
    big.width = plateCanvas.width * 3;
    big.height = plateCanvas.height * 3;
    const bctx = big.getContext("2d")!;
    bctx.imageSmoothingQuality = "high";
    bctx.drawImage(plateCanvas, 0, 0, big.width, big.height);
    const number = trimNumber(whiteInk(pixels(big)));
    if (!number) continue;
    const text = (await counter.recognize(inkCanvas(number))).data.text.replace(/\s/g, "");
    const value = parseAmount(text);
    if (Number.isFinite(value)) bag[item] = value;
  }

  const top = crop(full, full.width * 0.4, full.height * 0.025, full.width, full.height * 0.1);
  const rolaText = firstAmount((await (await getDigitWorker("topBar")).recognize(top)).data.text);
  const rola = rolaText ? parseAmount(rolaText) : NaN;
  return { bag, rola: Number.isFinite(rola) ? rola : undefined };
}

/** Reads one screenshot. `seasonHint` is used to turn EXP into a level when the screenshot set has no season screen. */
export async function readScreenshot(file: File, seasonHint: number): Promise<ScreenRead> {
  const worker = await getWorker();
  const canvas = await loadCanvas(file);
  const sharpCanvas = masked(canvas);
  const plain = await recognize(worker, canvas);
  const sharp = await recognize(worker, sharpCanvas);
  const text = `${plain.text}\n${sharp.text}`;
  let kind = classify(text);
  // The Backpack has almost no words, so look for its grid of item icons instead.
  let full: HTMLCanvasElement | null = null;
  if (kind === "unknown") {
    full = await fullCanvas(file);
    const work = document.createElement("canvas");
    work.width = ICON_WORK;
    work.height = Math.round((full.height * ICON_WORK) / full.width);
    smoothDraw(work, full);
    if (findIcons(pixels(work)).length >= 12) kind = "backpack";
  }
  const out: ScreenRead = { file: file.name, kind };
  if (kind === "backpack" && full) Object.assign(out, await readBackpack(full));

  if (kind === "bed") Object.assign(out, parseBed(plain.text).rate ? parseBed(plain.text) : parseBed(sharp.text));

  if (kind === "character") {
    // The plain pass reads these digits more faithfully than the cleaned one.
    const xp = parseCharacterXp(plain.text).need ? parseCharacterXp(plain.text) : parseCharacterXp(sharp.text);
    Object.assign(out, xp);
    if (xp.need) out.level = levelFromNeed(seasonHint, xp.need);
    const badges = await recognize(await getDigitWorker("gearBadges"), await gearBand(file));
    out.gear = parseGearBadges(badges.words);
  }

  if (kind === "progression") {
    out.season = parseSeason(text);
    const season = out.season ?? seasonHint;
    const a = parseProgression(sharp.words, season);
    const b = parseProgression(plain.words, season);
    out.levels = { ...b, ...Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)) };
  }

  if (kind === "cart") {
    const words = [...sharp.words, ...plain.words];
    const rows = cartRowCentres(words);
    if (rows) {
      const rowWorker = await getDigitWorker("cartRow");
      out.cart = {};
      for (let k = 0; k < CART_ROWS.length; k++) {
        const y = rows.centres[k];
        // A value already read cleanly from the whole panel ("+10854/h") wins.
        const clean = words.find((w) => /^\+\d[\d,]*\/h$/.test(w.text) && Math.abs((w.bbox.y0 + w.bbox.y1) / 2 - y) < rows.pitch * 0.4);
        if (clean) {
          out.cart[CART_ROWS[k]] = parseCartValue(clean.text);
          continue;
        }
        // Otherwise read the row on its own, digits only. A crop edge that clips the next bar can
        // spoil a read, so try a few heights and keep the first that reads as "+N/h".
        let fallback: number | undefined;
        for (const share of [0.4, 0.34, 0.46]) {
          const half = rows.pitch * share;
          if (y + half > sharpCanvas.height) continue;
          const piece = crop(sharpCanvas, Math.max(0, rows.valueX - 15), y - half, sharpCanvas.width * 0.75, y + half);
          const text = (await rowWorker.recognize(piece)).data.text.replace(/\s/g, "");
          const m = text.match(/\+?(\d[\d,]*)\/h/);
          if (m) {
            out.cart[CART_ROWS[k]] = Number(m[1].replace(/,/g, ""));
            fallback = undefined;
            break;
          }
          fallback ??= parseCartValue(text);
        }
        if (out.cart[CART_ROWS[k]] === undefined && fallback !== undefined) out.cart[CART_ROWS[k]] = fallback;
      }
    }
  }

  return out;
}
