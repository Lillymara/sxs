import { getRule } from "../../data/seasons";
import type { Slot } from "../../lib/planner/costs";
import { REALM_MATERIALS, type Material, type PlannerInput, type RealmMaterial } from "../../lib/planner/plan";
import { parseAmount } from "../../lib/xp";
import type { Character } from "../../components/CharacterForm";

export interface SlotForm {
  current: string;
  planned: string;
}

type Triple = { rola: string; ore: string; sand: string };
type StaminaSplit = Triple & { essence?: string };

/** Everything the planner asks for beyond the shared character fields; kept as typed text. */
export interface PlannerForm {
  /** Simple asks for one level per system and Cart income only; Full shows every slot and stockpile. */
  mode: "simple" | "full";
  seasonEnd: string;
  resetTime: string;
  boostHours: string;
  saveBed: boolean;
  saveBedHours: string;
  /** Leave the Cart's last hours unclaimed for next season. Missing in old saves. */
  saveCart?: boolean;
  saveCartHours?: string;
  statues: string;
  statuesPerDay: string;
  primostarsNow: string;
  primostarGoal: string;
  gear: SlotForm[];
  skills: SlotForm[];
  fantomons: SlotForm[];
  relics: SlotForm[];
  income: Record<Material, { have: string; cartPerHour: string; perDay: string }>;
  staminaSplit: StaminaSplit;
  bigNodes: Triple;
  staminaYield: Triple;
  dungeonOrePerDay: string;
  refreshes: Record<RealmMaterial, string>;
  savedEntries: Record<RealmMaterial, string>;
  realmTier: "auto" | "1" | "2" | "3";
  expPerTreat: string;
  /** Count the daily tasks' Stamina, Realm tools and Rola. Missing in old saves = on. */
  dailyTasks?: boolean;
  /** Home Shop refreshes a day. */
  shopRefreshes?: string;
  /** Rola bought with Dawnium a day. */
  rolaBuys?: string;
  /** Refined Ore on hand. */
  refinedOre?: string;
}

const blankSlots = (n: number): SlotForm[] => Array.from({ length: n }, () => ({ current: "", planned: "" }));
const blankRealm = (): Record<RealmMaterial, string> => ({ ore: "", rola: "", essence: "", sand: "" });
const blankIncome = () => ({ have: "", cartPerHour: "", perDay: "" });

export const DEFAULT_PLANNER: PlannerForm = {
  mode: "simple",
  seasonEnd: "",
  resetTime: "",
  boostHours: "2",
  saveBed: true,
  saveBedHours: "36",
  saveCart: true,
  saveCartHours: "36",
  statues: "",
  statuesPerDay: "",
  primostarsNow: "",
  primostarGoal: "",
  gear: blankSlots(5),
  skills: blankSlots(8),
  fantomons: blankSlots(4),
  relics: blankSlots(20),
  income: { ore: blankIncome(), rola: blankIncome(), essence: blankIncome(), sand: blankIncome(), treats: blankIncome() },
  staminaSplit: { rola: "", ore: "", sand: "", essence: "" },
  bigNodes: { rola: "", ore: "", sand: "" },
  staminaYield: { rola: "", ore: "", sand: "" },
  dungeonOrePerDay: "",
  refreshes: blankRealm(),
  savedEntries: blankRealm(),
  realmTier: "auto",
  expPerTreat: "",
  dailyTasks: true,
  shopRefreshes: "",
  rolaBuys: "",
};

export const GEAR_NAMES = ["Helmet", "Armor", "Boots", "Main Hand", "Off Hand"];

export const DEFAULT_EXP_PER_TREAT = 50;

/** Blank or unreadable -> fallback; otherwise the parsed number. A leading "+" (as relics show) is fine. */
export const n = (value: string, fallback = 0) => {
  const v = parseAmount(value.trim().replace(/^\+/, ""));
  return Number.isFinite(v) ? v : fallback;
};

/** Default season end when none is set: 14 days out at the reset time. */
export function defaultSeasonEnd(now: Date, resetTime: string): string {
  const d = new Date(now.getTime() + 14 * 86_400_000);
  const [h, m] = resetTime.split(":").map(Number);
  d.setHours(h || 16, m || 0, 0, 0);
  return toLocalInput(d);
}

export function toLocalInput(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function toSlots(rows: SlotForm[], floor: number): Slot[] {
  return rows.map((r) => {
    const current = n(r.current, floor);
    return { current, planned: n(r.planned, current) };
  });
}

/** What the planner uses when a time field is left blank. */
export interface TimeDefaults {
  /** Season end from the player's server calendar, if known. */
  seasonEnd: Date | null;
  /** Local "HH:MM" of the daily reset. */
  resetTime: string;
}

export function effectiveSeasonEnd(f: PlannerForm, d: TimeDefaults, now: Date): string {
  return f.seasonEnd || (d.seasonEnd ? toLocalInput(d.seasonEnd) : defaultSeasonEnd(now, f.resetTime || d.resetTime));
}

/** `xpIntoLevel` comes from the character card, which may be in XP or % mode. */
export function toPlannerInput(c: Character, xpIntoLevel: number, f: PlannerForm, d: TimeDefaults, now: Date): PlannerInput | null {
  const season = Number(c.season);
  const rule = getRule(season);
  if (!rule) return null;
  const level = n(c.level, NaN);
  if (!Number.isInteger(level)) return null;
  const end = new Date(effectiveSeasonEnd(f, d, now));
  if (!Number.isFinite(end.getTime())) return null;

  // Saved forms from before a field existed may lack it, so read every key defensively.
  const triple = (t: Partial<Triple> | undefined) => ({ rola: n(t?.rola ?? ""), ore: n(t?.ore ?? ""), sand: n(t?.sand ?? "") });
  const realm = (r: Record<RealmMaterial, string>) =>
    Object.fromEntries(REALM_MATERIALS.map((k) => [k, n(r[k])])) as Record<RealmMaterial, number>;

  return {
    season,
    start: now,
    end,
    resetTime: f.resetTime || d.resetTime,
    boostHoursPerReset: n(f.boostHours, 2),
    saveBedHours: f.saveBed ? n(f.saveBedHours, 36) : 0,
    saveCartHours: f.saveCart !== false ? n(f.saveCartHours ?? "", 36) : 0,
    level,
    xpIntoLevel,
    xpPerHour: n(c.rate),
    statues: n(f.statues),
    statuesPerDay: n(f.statuesPerDay),
    primostarsNow: n(f.primostarsNow),
    primostarGoal: n(f.primostarGoal),
    gear: toSlots(f.gear, rule.floor),
    skills: toSlots(f.skills, rule.floor),
    fantomons: toSlots(f.fantomons, rule.floor),
    relics: toSlots(f.relics, rule.relicFloor),
    income: Object.fromEntries(
      Object.entries(f.income).map(([k, v]) => [k, { have: n(v.have), cartPerHour: n(v.cartPerHour), perDay: n(v.perDay) }]),
    ) as PlannerInput["income"],
    overworld: {
      split: { ...triple(f.staminaSplit), essence: n(f.staminaSplit?.essence ?? "") },
      bigNodesPerWeek: triple(f.bigNodes),
      yieldPerStamina: triple(f.staminaYield),
      dungeonOrePerDay: n(f.dungeonOrePerDay),
    },
    refreshes: realm(f.refreshes),
    savedEntries: realm(f.savedEntries),
    realmTier: f.realmTier === "auto" ? 3 : Number(f.realmTier),
    expPerTreat: n(f.expPerTreat, DEFAULT_EXP_PER_TREAT),
    dailyTasks: f.dailyTasks !== false,
    shopRefreshes: n(f.shopRefreshes ?? ""),
    rolaBuys: n(f.rolaBuys ?? ""),
    refinedOre: n(f.refinedOre ?? ""),
  };
}
