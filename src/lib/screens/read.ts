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
  parseProgression,
  parseSeason,
  type ScreenKind,
  type SeasonLevels,
  type Word,
} from "./parse";

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
  levels?: SeasonLevels;
}

const WIDTH = 1200;
// Page segmentation mode by value, so the recognizer itself only loads when first used.
const SINGLE_LINE = "7" as unknown as PSM;

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
/** A second reader set up once for single lines of Cart digits, so the page reader's settings never change. */
function getRowWorker(): Promise<Worker> {
  rowWorkerPromise ??= import("tesseract.js").then(async ({ createWorker }) => {
    const w = await createWorker("eng");
    await w.setParameters({ tessedit_char_whitelist: "+0123456789/h", tessedit_pageseg_mode: SINGLE_LINE });
    return w;
  });
  rowWorkerPromise.catch(() => (rowWorkerPromise = null));
  return rowWorkerPromise;
}

async function recognize(worker: Worker, canvas: HTMLCanvasElement): Promise<{ text: string; words: Word[] }> {
  const { data } = await worker.recognize(canvas, {}, { blocks: true, text: true });
  const words: Word[] = [];
  for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const w of l.words) words.push({ text: w.text, bbox: w.bbox });
  return { text: data.text ?? "", words };
}

/** Reads one screenshot. `seasonHint` is used to turn EXP into a level when the screenshot set has no season screen. */
export async function readScreenshot(file: File, seasonHint: number): Promise<ScreenRead> {
  const worker = await getWorker();
  const canvas = await loadCanvas(file);
  const sharpCanvas = masked(canvas);
  const plain = await recognize(worker, canvas);
  const sharp = await recognize(worker, sharpCanvas);
  const text = `${plain.text}\n${sharp.text}`;
  const kind = classify(text);
  const out: ScreenRead = { file: file.name, kind };

  if (kind === "bed") Object.assign(out, parseBed(plain.text).rate ? parseBed(plain.text) : parseBed(sharp.text));

  if (kind === "character") {
    // The plain pass reads these digits more faithfully than the cleaned one.
    const xp = parseCharacterXp(plain.text).need ? parseCharacterXp(plain.text) : parseCharacterXp(sharp.text);
    Object.assign(out, xp);
    if (xp.need) out.level = levelFromNeed(seasonHint, xp.need);
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
      const rowWorker = await getRowWorker();
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
