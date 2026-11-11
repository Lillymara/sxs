// Turns values read from screenshots into planner inputs.
import type { Character } from "../../components/CharacterForm";
import { getRule } from "../../data/seasons";
import type { ScreenRead } from "../../lib/screens/read";
import { levelFromNeed, type SeasonLevels } from "../../lib/screens/parse";
import type { BagItem } from "../../lib/screens/backpack";
import type { PlannerForm, SlotForm } from "./form";

export type CartKey = "rola" | "ore" | "essence" | "sand" | "treats";
export const CART_KEYS: CartKey[] = ["rola", "ore", "essence", "sand", "treats"];

/** Everything found across a set of screenshots. Values are kept as text so players can edit them. */
export interface Found {
  season?: string;
  level?: string;
  xp?: string;
  rate?: string;
  cart: Partial<Record<CartKey, string>>;
  levels: Partial<Record<Exclude<keyof SeasonLevels, "character">, string>>;
  /** Each gear piece's level from the Character screen, like "140, 137, 135, 135, 135". */
  gearPieces?: string;
  /** Backpack: amounts on hand (Sand in White Sand, treats as Basic Treats). */
  have?: Partial<Record<CartKey, string>>;
  /** Backpack: saved Realm tools, by the Realm they're for. */
  tools?: Partial<Record<Exclude<CartKey, "treats">, string>>;
}

/** Treat EXP by grade, as the game's feed values. Totals are given in Basic Treats (50 EXP). */
const TREAT_EXP = { basicTreats: 50, premiumTreats: 400, deluxeTreats: 2000 } as const;

/** Five gear levels from text like "140, 137, 135, 135, 135", or undefined. */
export function readGearPieces(text?: string): number[] | undefined {
  const levels = (text ?? "").split(/[^\d]+/).filter(Boolean).map(Number);
  return levels.length === 5 && levels.every((v) => v > 0) ? levels : undefined;
}

/** Combines several screenshots' reads; the season screen's season wins over the planner's. */
export function mergeReads(reads: ScreenRead[], seasonHint: number): Found {
  const found: Found = { cart: {}, levels: {} };
  const bag: Partial<Record<BagItem, number>> = {};
  const seasonRead = reads.find((r) => r.season)?.season;
  const season = seasonRead ?? seasonHint;
  if (seasonRead) found.season = String(seasonRead);
  for (const r of reads) {
    if (r.rate) found.rate = String(r.rate);
    if (r.xp) found.xp = r.xp;
    if (r.need) {
      const level = levelFromNeed(season, r.need) ?? r.level;
      if (level) found.level = String(level);
    }
    if (r.gear) found.gearPieces = r.gear.join(", ");
    if (r.rola !== undefined) (found.have ??= {}).rola = String(r.rola);
    // Backpack pages are combined first, since one screen rarely holds every item.
    if (r.bag) Object.assign(bag, r.bag);
    if (r.cart) for (const k of CART_KEYS) if (r.cart[k] !== undefined) found.cart[k] = String(r.cart[k]);
    if (r.levels) {
      for (const k of ["gear", "skill", "fantomon", "relic"] as const) {
        const v = r.levels[k];
        if (v !== undefined) found.levels[k] = String(v);
      }
    }
  }
  if (Object.keys(bag).length) {
    const b = bag;
    const have = (found.have ??= {});
    if (b.ore !== undefined) have.ore = String(b.ore);
    if (b.essence !== undefined) have.essence = String(b.essence);
    // Sand counts as White Sand: Rare is 5, Epic 25.
    if (b.sand !== undefined || b.rareSand !== undefined || b.epicSand !== undefined) {
      have.sand = String(Math.round((b.sand ?? 0) + 5 * (b.rareSand ?? 0) + 25 * (b.epicSand ?? 0)));
    }
    if (b.basicTreats !== undefined || b.premiumTreats !== undefined || b.deluxeTreats !== undefined) {
      const exp = (Object.keys(TREAT_EXP) as (keyof typeof TREAT_EXP)[]).reduce((a, k) => a + (b[k] ?? 0) * TREAT_EXP[k], 0);
      have.treats = String(Math.round(exp / TREAT_EXP.basicTreats));
    }
    const tools = (found.tools ??= {});
    if (b.hammer !== undefined) tools.ore = String(b.hammer);
    if (b.pickaxe !== undefined) tools.rola = String(b.pickaxe);
    if (b.knuckles !== undefined) tools.essence = String(b.knuckles);
    if (b.shovel !== undefined) tools.sand = String(b.shovel);
  }
  return found;
}

/** A season total spread over slots: e.g. 182 over 5 gear pieces -> +37, +37, +36, +36, +36. */
export function spread(total: number, slots: number, floor: number): number[] {
  const each = Math.floor(total / slots);
  const extra = total - each * slots;
  return Array.from({ length: slots }, (_, i) => floor + each + (i < extra ? 1 : 0));
}

/** Applies the chosen values to the character and planner. Planned levels below the new current ones are cleared. */
export function applyFound(found: Found, character: Character, form: PlannerForm): { character: Character; form: PlannerForm } {
  const c = { ...character };
  if (found.season) c.season = found.season;
  if (found.level) c.level = found.level;
  if (found.xp !== undefined) {
    c.progressMode = "xp";
    c.currentXp = found.xp;
  }
  if (found.rate) c.rate = found.rate;

  const f: PlannerForm = { ...form, income: { ...form.income } };
  for (const k of CART_KEYS) {
    const v = found.cart[k];
    if (v !== undefined) f.income[k] = { ...f.income[k], cartPerHour: v };
  }
  for (const k of CART_KEYS) {
    const v = found.have?.[k];
    if (v !== undefined) f.income[k] = { ...f.income[k], have: v };
  }
  if (found.tools) {
    f.savedEntries = { ...f.savedEntries };
    for (const k of ["ore", "rola", "essence", "sand"] as const) {
      const v = found.tools[k];
      if (v !== undefined) f.savedEntries[k] = v;
    }
  }
  const rule = getRule(Number(c.season));
  if (rule) {
    const fields = { gear: "gear", skill: "skills", fantomon: "fantomons", relic: "relics" } as const;
    for (const [key, field] of Object.entries(fields) as [keyof typeof fields, (typeof fields)[keyof typeof fields]][]) {
      const floor = key === "relic" ? rule.relicFloor : rule.floor;
      // Exact gear levels from the Character screen beat an even spread of the season total.
      const pieces = key === "gear" ? readGearPieces(found.gearPieces) : undefined;
      const total = Number(found.levels[key]);
      if (!pieces && (found.levels[key] === undefined || !Number.isFinite(total))) continue;
      const levels = pieces ?? spread(Math.max(0, Math.round(total)), f[field].length, floor);
      f[field] = f[field].map((slot: SlotForm, i) => {
        const planned = Number(slot.planned.replace(/^\+/, ""));
        return { current: String(levels[i]), planned: slot.planned !== "" && planned < levels[i] ? "" : slot.planned };
      });
    }
  }
  return { character: c, form: f };
}
