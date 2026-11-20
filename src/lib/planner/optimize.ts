// "Plan my goal": the upgrades across every system that reach a score goal for the least of the
// materials a player will have by season end, never past a cap or a material budget.
import type { SeasonRule } from "../../data/seasons";
import { fantomonStepExp, gearStepCost, relicStepCost, skillStepCost, type Slot } from "./costs";
import type { SlotCategory } from "./score";

/** What upgrades spend. Treats are counted as Fantomon feed EXP. */
export type Spend = "ore" | "rola" | "essence" | "sand" | "fantomonExp";
export const SPENDS: Spend[] = ["ore", "rola", "essence", "sand", "fantomonExp"];

type GatherMaterial = Exclude<Spend, "fantomonExp">;
type GatherCounts = Record<GatherMaterial, number>;

interface Gathering {
  available: number;
  yieldPerGather: GatherCounts;
  refinedOre: number;
}

export interface GoalPlan {
  /** Planned level for each slot, by system. */
  planned: Record<SlotCategory, number[]>;
  gathers: GatherCounts;
  /** Points the plan adds over current levels, and points it still lacks (0 when it reaches the goal). */
  pointsAdded: number;
  pointsShort: number;
  /** Materials the plan spends, and what it leaves of each budget. */
  spent: Record<Spend, number>;
  left: Record<Spend, number>;
  /** The material that ran out first, when the goal can't be reached. */
  limitedBy: Spend | "caps" | null;
}

interface System {
  key: SlotCategory;
  slots: Slot[];
  /** Where costs start, and the level above which a level scores. */
  floor: number;
  scoreFloor: number;
  weight: number;
  cap: number | null;
  /** Cost of raising one slot to level L, or null when the data has none. */
  step: (L: number) => Partial<Record<Spend, number>> | null;
}

/**
 * Greedy plan: repeatedly buy the next level that gives the most points for the smallest share of
 * what's left of each material. Each system raises its lowest slot first, since costs rise with level.
 * Shares are of what's *left*, so a material that's running low gets more expensive to spend.
 */
export function planForGoal(
  rule: SeasonRule,
  p: {
    gear: Slot[];
    skills: Slot[];
    fantomons: Slot[];
    relics: Slot[];
    caps: Record<SlotCategory, number | null>;
    /** Points still needed above what current levels and the character already score. */
    pointsNeeded: number;
    budget: Record<Spend, number>;
    gathering?: Gathering;
  },
): GoalPlan {
  const w = rule.weights;
  const systems: System[] = [
    {
      key: "gear",
      slots: p.gear,
      floor: rule.floor,
      scoreFloor: rule.floor,
      weight: w.gear,
      cap: p.caps.gear,
      step: (L) => {
        const ore = gearStepCost(rule, L);
        return ore === null ? null : { ore, rola: ore * 2 };
      },
    },
    { key: "skill", slots: p.skills, floor: rule.floor, scoreFloor: rule.floor, weight: w.skill, cap: p.caps.skill, step: (L) => nullable(skillStepCost(rule, L), "essence") },
    { key: "fantomon", slots: p.fantomons, floor: rule.floor, scoreFloor: rule.floor, weight: w.fantomon, cap: p.caps.fantomon, step: (L) => nullable(fantomonStepExp(rule, L), "fantomonExp") },
    {
      key: "relic",
      slots: p.relics,
      floor: rule.relicBase,
      scoreFloor: rule.relicFloor,
      weight: w.relic,
      cap: p.caps.relic,
      step: (L) => {
        const c = relicStepCost(rule, L);
        return c === null ? null : { sand: c.white, rola: c.rola };
      },
    },
  ];

  const levels = Object.fromEntries(systems.map((s) => [s.key, s.slots.map((sl) => Math.max(s.floor, Math.floor(sl.current)))])) as Record<
    SlotCategory,
    number[]
  >;
  const left = { ...p.budget };
  const gathering = p.gathering;
  const gathers: GatherCounts = { ore: 0, rola: 0, essence: 0, sand: 0 };
  let gathersLeft = gathering?.available ?? 0;
  let refinedLeft = gathering?.refinedOre ?? 0;
  const spent = Object.fromEntries(SPENDS.map((k) => [k, 0])) as Record<Spend, number>;
  let added = 0;
  let limitedBy: GoalPlan["limitedBy"] = null;

  while (added < p.pointsNeeded) {
    let best: { sys: System; slot: number; cost: Partial<Record<Spend, number>>; value: number; target: number; extra: GatherCounts; refined: number } | null = null;
    let blocked: Spend | null = null;
    for (const sys of systems) {
      if (!(sys.weight > 0)) continue;
      const lv = levels[sys.key];
      // The lowest slot that can still go up.
      let slot = -1;
      const refinedFor = (target: number) =>
        gathering && sys.key === "gear" && (target - rule.floor) % 5 === 0 ? rule.costs?.forgeStone ?? 0 : 0;
      lv.forEach((v, i) => {
        if (refinedFor(v + 1) > refinedLeft) return;
        if ((sys.cap === null || v < sys.cap) && (slot < 0 || v < lv[slot])) slot = i;
      });
      if (slot < 0) continue;
      // Levels that don't score yet are bought together with the first one that does.
      const target = Math.max(lv[slot] + 1, sys.scoreFloor + 1);
      if (sys.cap !== null && target > sys.cap) continue;
      let cost: Partial<Record<Spend, number>> | null = {};
      for (let L = lv[slot] + 1; L <= target && cost; L++) {
        const c = sys.step(L);
        if (!c) cost = null;
        else for (const k of SPENDS) cost[k] = (cost[k] ?? 0) + (c[k] ?? 0);
      }
      if (!cost) continue;
      const refined = refinedFor(target);
      const extra: GatherCounts = { ore: 0, rola: 0, essence: 0, sand: 0 };
      let gatherCount = 0;
      let share = 0;
      let affordable = true;
      for (const k of SPENDS) {
        const c = cost[k] ?? 0;
        if (c <= 0) continue;
        const yieldPerGather = gathering && k !== "fantomonExp" ? gathering.yieldPerGather[k] : 0;
        if (c > left[k] && yieldPerGather > 0 && k !== "fantomonExp") {
          extra[k] = Math.ceil((c - left[k]) / yieldPerGather);
          gatherCount += extra[k];
        }
        if ((c > left[k] && yieldPerGather <= 0) || gatherCount > gathersLeft) {
          affordable = false;
          blocked ??= k;
          break;
        }
        share += c / Math.max(c, left[k] + gathersLeft * yieldPerGather);
      }
      if (!affordable) continue;
      share += gatherCount / Math.max(1, gathersLeft);
      const value = sys.weight / Math.max(share, 1e-12);
      if (!best || value > best.value) best = { sys, slot, cost, value, target, extra, refined };
    }
    if (!best) {
      limitedBy = blocked ?? "caps";
      break;
    }
    levels[best.sys.key][best.slot] = best.target;
    added += best.sys.weight;
    refinedLeft -= best.refined;
    if (gathering) {
      for (const k of Object.keys(gathers) as GatherMaterial[]) {
        const extra = best.extra[k];
        gathers[k] += extra;
        gathersLeft -= extra;
        left[k] += extra * gathering.yieldPerGather[k];
      }
    }
    for (const k of SPENDS) {
      const c = best.cost[k] ?? 0;
      left[k] -= c;
      spent[k] += c;
    }
  }

  return { planned: levels, pointsAdded: added, pointsShort: Math.max(0, p.pointsNeeded - added), spent, left, limitedBy, gathers };
}

const nullable = (v: number | null, k: Spend): Partial<Record<Spend, number>> | null => (v === null ? null : { [k]: v });
