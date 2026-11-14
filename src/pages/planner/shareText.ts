// "Copy for Discord": the plan as a short message, in Discord's markdown.
import type { PlannerResult } from "../../lib/planner/plan";
import { REALM_MATERIALS } from "../../lib/planner/plan";
import { formatXpShort } from "../../lib/xp";
import type { PlannerForm, SlotForm } from "./form";

const SITE = "https://sxs.lmthings.com/";
const fmt = (x: number) => Math.round(x).toLocaleString("en-US");

/** "125–126" or "140" from a list of slot levels. */
function range(levels: number[], plus: boolean): string {
  const p = plus ? "+" : "";
  if (!levels.length) return "?";
  const lo = Math.min(...levels), hi = Math.max(...levels);
  return lo === hi ? `${p}${lo}` : `${p}${lo}–${hi}`;
}

const num = (v: string) => Number(v.replace(/^\+/, ""));
function system(label: string, rows: SlotForm[], floor: number, plus: boolean): string | null {
  const now = rows.map((r) => Math.max(floor, num(r.current) || floor));
  const plan = rows.map((r, i) => (r.planned.trim() === "" ? now[i] : Math.max(now[i], num(r.planned) || now[i])));
  const a = range(now, plus), b = range(plan, plus);
  return a === b ? `${label} ${a}` : `${label} ${a} → ${b}`;
}

export function shareText(result: PlannerResult, form: PlannerForm, level: string): string {
  const { score, rule, character } = result;
  const lines: string[] = [];
  lines.push(`**My Season ${rule.season} plan**`);
  if (character.ok) lines.push(`Lv ${level} → about ${character.decimalLevel.toFixed(1)} by season end`);
  const goal = score.goal > 0 ? ` · goal ${fmt(score.goal)} ${score.difference >= 0 ? "✅" : `(${fmt(-score.difference)} short)`}` : "";
  lines.push(`Primostars: ${fmt(score.projectedTotal - score.earned)} now → ${fmt(score.projectedTotal)} projected (+${fmt(score.earned)})${goal}`);
  const systems = [
    system("Gear", form.gear, rule.floor, false),
    system("Skills", form.skills, rule.floor, false),
    system("Fantomons", form.fantomons, rule.floor, false),
    system("Relics", form.relics, rule.relicFloor, true),
  ].filter(Boolean);
  lines.push(`Levels: ${systems.join(" · ")}`);
  const split = REALM_MATERIALS.map((k) => Number(form.refreshes[k]) || 0);
  if (split.some((n) => n > 0)) lines.push(`Realms (Ore/Rola/Essence/Sand): ${split.join("/")} · ${fmt(result.dawniumPerDay)} Dawnium a day`);
  const short = result.materials.filter((m) => m.balance < -0.5).map((m) => `${m.label.replace(" (White eq.)", "")} −${formatXpShort(Math.round(-m.balance))}`);
  lines.push(short.length ? `Still short: ${short.join(", ")}` : "Materials: enough for the plan");
  lines.push(`<${SITE}>`);
  return lines.join("\n");
}
