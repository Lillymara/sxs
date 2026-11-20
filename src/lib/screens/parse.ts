// Reads planner values out of text recognized from game screenshots. Pure functions over
// recognized words, so they can be tested without running the recognizer.
import { getRule } from "../../data/seasons";
import { getSeason, parseAmount } from "../xp";

export interface Word {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export type ScreenKind = "bed" | "cart" | "progression" | "character" | "backpack" | "unknown";

/** Which game screen this is, from its words. */
export function classify(text: string): ScreenKind {
  const t = text.toLowerCase();
  if (/exp\s*\/?\s*hr/.test(t) || /base exp yield/.test(t)) return "bed";
  if (/season (gear|skill|relic|fantomon|character) level/.test(t)) return "progression";
  if (/cart/.test(t) && /\/h\b/.test(t)) return "cart";
  // The season's Gear tab also lists ATK/DEF/SPD bonuses, but isn't the Character screen.
  if (/gear rating|total bonus stats/.test(t)) return "unknown";
  if (/\batk\b/.test(t) && /\bdef\b/.test(t) && /\bspd\b/.test(t)) return "character";
  return "unknown";
}

const midY = (w: Word) => (w.bbox.y0 + w.bbox.y1) / 2;
const midX = (w: Word) => (w.bbox.x0 + w.bbox.x1) / 2;
/** Common misreads in game fonts: S read as $ or 5, O as 0, l/I as 1. */
const digits = (s: string) => s.replace(/[oO]/g, "0").replace(/[lI|]/g, "1").replace(/[^\d]/g, "");

/** Bed: EXP per hour. */
export function parseBed(text: string): { rate?: number } {
  const m = text.match(/EXP\s*\/?\s*Hr\s*[:|]?\s*([\d,.\s]{3,})/i);
  const rate = m ? Number(digits(m[1].trim().split(/\s+/)[0])) : NaN;
  return Number.isFinite(rate) && rate > 0 ? { rate } : {};
}

/** Character screen: EXP into the level and EXP the level needs, e.g. "438K/1.53M". */
export function parseCharacterXp(text: string): { xp?: string; need?: string } {
  for (const m of text.matchAll(/(\d[\d.,]*\s*[KMB]?)\s*\/\s*(\d[\d.,]*\s*[KMB])\b/gi)) {
    const need = m[2].replace(/\s/g, "");
    if (Number.isFinite(parseAmount(need))) return { xp: m[1].replace(/\s/g, ""), need };
  }
  return {};
}

/**
 * The level whose EXP requirement shows as `need` (e.g. "1.53M", rounded to 3 figures).
 * Only one level of a season's table rounds to a given figure, which is more reliable than
 * reading the big stylized level number.
 */
export function levelFromNeed(season: number, need: string, hint?: number): number | undefined {
  const table = getSeason(season);
  const target = parseAmount(need);
  if (!table || !Number.isFinite(target)) return undefined;
  // The game cuts to three figures (1,486,091 shows as 1.48M); allow rounding too, just in case.
  const shown = (x: number, round: boolean) => {
    for (const u of [1e9, 1e6, 1e3]) {
      if (x >= u) {
        const v = x / u;
        const places = Math.max(0, 3 - String(Math.floor(v)).length);
        const f = 10 ** places;
        return ((round ? Math.round(v * f) : Math.floor(v * f)) / f) * u;
      }
    }
    return x;
  };
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6 * Math.max(1, b);
  let matches: number[] = [];
  for (const round of [false, true]) {
    table.expToNext.forEach((e, i) => {
      if (near(shown(e, round), target)) matches.push(table.minLevel + i);
    });
    if (matches.length) break;
    matches = [];
  }
  if (!matches.length) return undefined;
  if (matches.length === 1 || hint === undefined) return matches[0];
  return matches.reduce((a, b) => (Math.abs(b - hint) < Math.abs(a - hint) ? b : a));
}

/** Season number from the progression screen title, "S1. Witching Hours" (often read as "$1."). */
export function parseSeason(text: string): number | undefined {
  const m = text.match(/(?:^|\s)[S$5]\s?([1-9])\s*[.,]\s*[A-Z]/);
  const s = m ? Number(m[1]) : NaN;
  return getRule(s) ? s : undefined;
}

export interface SeasonLevels {
  character?: number;
  gear?: number;
  skill?: number;
  fantomon?: number;
  relic?: number;
}

/**
 * Progression screen: season levels per system, from each system's points (which read far more
 * reliably than the green level numbers). Layout: Character on top; Gear and Skill below it, left
 * and right; Fantomon and Relic at the bottom, left and right. Each total must divide by the
 * system's points per level, which also confirms the read.
 */
export function parseProgression(words: Word[], season: number): SeasonLevels {
  const rule = getRule(season);
  if (!rule) return {};
  const pts: { value: number; x: number; y: number }[] = [];
  words.forEach((w, i) => {
    if (!/^pts/i.test(w.text) && !/\dpts\W*$/i.test(w.text)) return;
    const own = w.text.match(/^(\d+)pts\W*$/i);
    const prev = words[i - 1];
    const raw = own ? own[1] : prev && /^\d{2,6}$/.test(digits(prev.text)) ? digits(prev.text) : "";
    if (raw) pts.push({ value: Number(raw), x: midX(w), y: midY(w) });
  });
  if (pts.length < 2) return {};
  // Group into rows by height: top row is Character, then Gear/Skill, then Fantomon/Relic.
  const sorted = [...pts].sort((a, b) => a.y - b.y);
  const rows: (typeof pts)[] = [];
  for (const p of sorted) {
    const row = rows.find((r) => Math.abs(r[0].y - p.y) < 40);
    if (row) row.push(p);
    else rows.push([p]);
  }
  rows.forEach((r) => r.sort((a, b) => a.x - b.x));
  const out: SeasonLevels = {};
  const fit = (value: number | undefined, weight: number) =>
    value !== undefined && value % weight === 0 ? value / weight : undefined;
  const w = rule.weights;
  const charRow = rows.find((r) => r.length === 1);
  const pairs = rows.filter((r) => r.length === 2);
  if (charRow) out.character = charRow[0].value / w.character;
  if (pairs[0]) {
    out.gear = fit(pairs[0][0].value, w.gear);
    out.skill = fit(pairs[0][1].value, w.skill);
  }
  if (pairs[1]) {
    out.fantomon = fit(pairs[1][0].value, w.fantomon);
    out.relic = fit(pairs[1][1].value, w.relic);
  }
  return out;
}

/** Cart rows, top to bottom, as the Cart screen lists them. */
export const CART_ROWS = ["rola", "wood", "stone", "ore", "essence", "gear", "sand", "treats"] as const;

/**
 * Where each Cart row sits: the first row's centre is 0.93 row-pitches below the "Cart" title, and
 * rows are evenly spaced. The pitch comes from the rows already read, so a missed row can still be
 * found and read on its own.
 */
/** Cart rows are ~100–130 px apart at the reader's 1200 px width; two readings closer than this are one line. */
const MIN_ROW_GAP = 45;

export function cartRowCentres(words: Word[]): { centres: number[]; pitch: number; valueX: number } | null {
  const title = words.find((w) => /cart$/i.test(w.text));
  // Values from both passes, with readings of the same line (a few dozen pixels apart at most) merged.
  const raw = words.filter((w) => /^\+\d/.test(w.text)).map(midY).sort((a, b) => a - b);
  const values: number[] = [];
  for (const y of raw) if (!values.length || y - values[values.length - 1] >= MIN_ROW_GAP) values.push(y);
  if (!title || values.length < 2) return null;
  const top = midY(title);
  // Fit evenly spaced rows to every value found: the first row sits about 0.93 rows below the title,
  // and each value belongs to the nearest of the eight rows. A misplaced reading costs a little; a
  // value that would fall outside the eight rows costs a lot.
  let best = { cost: Infinity, first: 0, pitch: 0 };
  for (let pitch = 60; pitch <= 170; pitch += 0.5) {
    for (let lead = 0.75; lead <= 1.1; lead += 0.01) {
      const first = top + pitch * lead;
      let cost = Math.abs(lead - 0.93) * pitch * 0.5;
      for (const y of values) {
        const k = Math.round((y - first) / pitch);
        cost += k < 0 || k > CART_ROWS.length - 1 ? pitch : Math.abs(y - (first + k * pitch));
      }
      if (cost < best.cost) best = { cost, first, pitch };
    }
  }
  const { pitch } = best;
  const xs = words.filter((w) => /^\+\d/.test(w.text)).map((w) => w.bbox.x0);
  // Predicted centres drift a little down the list, so snap each to a value already read near it.
  const centres = CART_ROWS.map((_, k) => {
    const guess = best.first + pitch * k;
    const near = values.find((y) => Math.abs(y - guess) < pitch * 0.4);
    return near ?? guess;
  });
  return { centres, pitch, valueX: Math.min(...xs) };
}

/**
 * Character screen: each gear piece's "+140" badge, read from the gear area. Only trusted when all
 * five pieces are found, so a partial read never fills in a wrong set.
 */
export function parseGearBadges(words: Word[]): number[] | undefined {
  const levels = words
    .filter((w) => /^\+[1-9]\d{0,2}$/.test(w.text))
    .sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0)
    .map((w) => Number(w.text.slice(1)));
  return levels.length === 5 ? levels : undefined;
}

/**
 * The Cart's rows straight from the panel's text: every "+N/h" in order from top to bottom. Two reads
 * of the same row (plain and masked image) are merged by height. Only used when exactly one value per
 * row was found, so a missed or extra line never shifts the rows.
 */
export function cartValuesInOrder(words: Word[]): Partial<Record<(typeof CART_ROWS)[number], number>> | undefined {
  const hits = words
    .filter((w) => /^\+\d[\d,]*\/h$/.test(w.text))
    .map((w) => ({ y: midY(w), h: w.bbox.y1 - w.bbox.y0, v: Number(w.text.slice(1, -2).replace(/,/g, "")) }))
    .sort((a, b) => a.y - b.y);
  const rows: { y: number; v: number }[] = [];
  for (const hit of hits) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(hit.y - last.y) < Math.max(hit.h, 8)) continue;
    rows.push(hit);
  }
  if (rows.length !== CART_ROWS.length) return undefined;
  return Object.fromEntries(CART_ROWS.map((k, i) => [k, rows[i].v]));
}

/** A Cart row's value, from its own recognized text like "+9315/h". */
export function parseCartValue(text: string): number | undefined {
  const m = text.replace(/\s/g, "").match(/\+?(\d[\d,]*)/);
  const v = m ? Number(m[1].replace(/,/g, "")) : NaN;
  return Number.isFinite(v) ? v : undefined;
}
