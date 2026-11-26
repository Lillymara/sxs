// Spots planner inputs that can't happen in the game, so the planner can say why
// instead of quietly working out nonsense.
import type { SeasonRule } from "../../data/seasons";
import { parseAmount, type SeasonTable } from "../../lib/xp";
import type { Character } from "../../components/CharacterForm";
import { GEAR_NAMES, type PlannerForm, type SlotForm } from "./form";
import { en, type MessageKey } from "../../i18n/en";

/** Translates a message; the page passes the chosen language, and English is the default (and what the tests check). */
export type Tr = (key: MessageKey, vars?: Record<string, string | number>) => string;
const english: Tr = (key, vars) => (en[key] as string).replace(/\{(\w+)\}/g, (m, k: string) => (vars && k in vars ? String(vars[k]) : m));

export type SlotField = "gear" | "skills" | "fantomons" | "relics";

export interface Problems {
  /** Plain-language reasons, one per kind of mistake. */
  messages: string[];
  /** Inputs to outline, as "index:current" / "index:planned" per section. */
  slots: Record<SlotField, Set<string>>;
}

/** A level as typed: blank, a number (a leading "+" is fine), or junk. */
export function readLevel(value: string): number | null | "junk" {
  const v = value.trim().replace(/^\+/, "");
  if (v === "") return null;
  const x = parseAmount(v);
  return Number.isFinite(x) ? x : "junk";
}

const list = (names: string[], tr: Tr) =>
  names.length <= 3 ? names.join(", ") : tr("va.more", { list: names.slice(0, 3).join(", "), n: names.length - 3 });

export function findProblems(
  character: Character,
  form: PlannerForm,
  rule: SeasonRule | undefined,
  table: SeasonTable | undefined,
  tr: Tr = english,
): Problems {
  const messages: string[] = [];
  const slots: Problems["slots"] = { gear: new Set(), skills: new Set(), fantomons: new Set(), relics: new Set() };
  if (!rule) return { messages, slots };
  const season = rule.season;

  // Character
  const level = readLevel(character.level);
  if (level === "junk" || (level !== null && !Number.isInteger(level))) {
    messages.push(tr("va.levelNotWhole", { v: character.level }));
  } else if (level !== null && table && (level < table.minLevel || level > table.maxLevel)) {
    messages.push(tr("va.levelRange", { lv: level, season, min: table.minLevel, max: table.maxLevel }));
  } else if (level !== null && table) {
    if (character.progressMode === "xp" && character.currentXp.trim() !== "") {
      const xp = parseAmount(character.currentXp);
      // More EXP than the level needs is fine: it's banked behind a level cap.
      if (!Number.isFinite(xp)) messages.push(tr("va.xpNaN", { v: character.currentXp }));
    }
    if (character.progressMode === "percent" && character.percent.trim() !== "") {
      const pct = parseAmount(character.percent.replace(/%$/, ""));
      if (!Number.isFinite(pct) || pct >= 100) messages.push(tr("va.pctOver", { v: character.percent }));
    }
  }
  if (character.rate.trim() !== "" && !Number.isFinite(parseAmount(character.rate)))
    messages.push(tr("va.rateNaN", { v: character.rate }));

  // Gear, skills, Fantomons, relics
  // Planning past a level cap is left to the red outline on the slot tables: the cap
  // depends on the projected season-end level, so it isn't impossible in itself.
  const sections: { field: SlotField; names: string[]; start: number; plus: string }[] = [
    { field: "gear", names: GEAR_NAMES, start: rule.floor, plus: "" },
    { field: "skills", names: form.skills.map((_, i) => tr("pl.skillN", { n: i + 1 })), start: rule.floor, plus: "" },
    { field: "fantomons", names: form.fantomons.map((_, i) => tr("va.fantomonN", { n: i + 1 })), start: rule.floor, plus: "" },
    { field: "relics", names: form.relics.map((_, i) => tr("va.relicN", { n: i + 1 })), start: rule.relicBase, plus: "+" },
  ];
  for (const s of sections) {
    const junk: string[] = [], low: string[] = [], down: string[] = [];
    const rows: SlotForm[] = form[s.field];
    rows.forEach((r, i) => {
      const name = s.names[i] ?? `#${i + 1}`;
      const cur = readLevel(r.current);
      const plan = readLevel(r.planned);
      if (cur === "junk") junk.push(name), slots[s.field].add(`${i}:current`);
      if (plan === "junk") junk.push(name), slots[s.field].add(`${i}:planned`);
      if (typeof cur === "number" && cur < s.start) low.push(name), slots[s.field].add(`${i}:current`);
      if (typeof plan === "number" && plan < s.start) low.push(name), slots[s.field].add(`${i}:planned`);
      const from = typeof cur === "number" ? cur : s.start;
      if (typeof plan === "number" && plan >= s.start && plan < from) down.push(name), slots[s.field].add(`${i}:planned`);
    });
    const uniq = (xs: string[]) => [...new Set(xs)];
    if (junk.length) messages.push(tr("va.junk", { single: tr(`va.single.${s.field}`), list: list(uniq(junk), tr) }));
    if (low.length)
      messages.push(tr("va.low", { plural: tr(`va.pluralCap.${s.field}`), start: `${s.plus}${s.start}`, season, list: list(uniq(low), tr) }));
    if (down.length) messages.push(tr("va.down", { plural: tr(`va.plural.${s.field}`), list: list(uniq(down), tr) }));
  }

  // Everything else that has to be a positive number
  const plain: [string, string][] = [
    [tr("pl.have"), form.primostarsNow],
    [tr("va.goal"), form.primostarGoal],
    [tr("pl.boostHours"), form.boostHours],
    [tr("va.hoursToSave"), form.saveBedHours],
    [tr("va.statues"), form.statues],
    [tr("va.statuesDay"), form.statuesPerDay],
  ];
  const bad = plain.filter(([, v]) => v.trim() !== "" && !Number.isFinite(parseAmount(v))).map(([l]) => l);
  if (bad.length) messages.push(tr("va.plain", { list: list(bad, tr) }));
  if (form.saveBed && parseAmount(form.saveBedHours) > 36) messages.push(tr("va.bed36"));
  const boost = parseAmount(form.boostHours);
  if (Number.isFinite(boost) && boost > 24) messages.push(tr("va.boost24"));

  return { messages, slots };
}

