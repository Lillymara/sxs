// Turns values read from screenshots into planner inputs.
import type { Character } from "../../components/CharacterForm";
import { getRule } from "../../data/seasons";
import type { ScreenRead } from "../../lib/screens/read";
import { levelFromNeed, type SeasonLevels } from "../../lib/screens/parse";
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
}

/** Combines several screenshots' reads; the season screen's season wins over the planner's. */
export function mergeReads(reads: ScreenRead[], seasonHint: number): Found {
  const found: Found = { cart: {}, levels: {} };
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
    if (r.cart) for (const k of CART_KEYS) if (r.cart[k] !== undefined) found.cart[k] = String(r.cart[k]);
    if (r.levels) {
      for (const k of ["gear", "skill", "fantomon", "relic"] as const) {
        const v = r.levels[k];
        if (v !== undefined) found.levels[k] = String(v);
      }
    }
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
  const rule = getRule(Number(c.season));
  if (rule) {
    const fields = { gear: "gear", skill: "skills", fantomon: "fantomons", relic: "relics" } as const;
    for (const [key, field] of Object.entries(fields) as [keyof typeof fields, (typeof fields)[keyof typeof fields]][]) {
      const total = Number(found.levels[key]);
      if (found.levels[key] === undefined || !Number.isFinite(total)) continue;
      const floor = key === "relic" ? rule.relicFloor : rule.floor;
      const levels = spread(Math.max(0, Math.round(total)), f[field].length, floor);
      f[field] = f[field].map((slot: SlotForm, i) => {
        const planned = Number(slot.planned.replace(/^\+/, ""));
        return { current: String(levels[i]), planned: slot.planned !== "" && planned < levels[i] ? "" : slot.planned };
      });
    }
  }
  return { character: c, form: f };
}
