import { describe, expect, it } from "vitest";
import { getRule } from "../../data/seasons";
import { planForGoal } from "./optimize";

const s1 = getRule(1)!;
const at = (n: number, level: number) => Array.from({ length: n }, () => ({ current: level, planned: level }));
const plenty = { ore: 1e12, rola: 1e12, essence: 1e12, sand: 1e12, fantomonExp: 1e12 };
const caps = { gear: null, skill: 130, fantomon: 140, relic: 14 };
const base = { gear: at(5, 140), skills: at(8, 115), fantomons: at(4, 120), relics: at(20, 12), caps };

describe("planning the cheapest route to a goal", () => {
  it("reaches the goal and never passes a cap", () => {
    const plan = planForGoal(s1, { ...base, pointsNeeded: 3000, budget: plenty });
    expect(plan.pointsShort).toBe(0);
    expect(plan.pointsAdded).toBeGreaterThanOrEqual(3000);
    expect(Math.max(...plan.planned.skill)).toBeLessThanOrEqual(130);
    expect(Math.max(...plan.planned.fantomon)).toBeLessThanOrEqual(140);
    expect(Math.max(...plan.planned.relic)).toBeLessThanOrEqual(14);
  });

  it("stays within each material", () => {
    const budget = { ...plenty, essence: 0, sand: 0 };
    const plan = planForGoal(s1, { ...base, pointsNeeded: 2000, budget });
    expect(plan.planned.skill).toEqual(Array(8).fill(115));
    expect(plan.planned.relic).toEqual(Array(20).fill(12));
    expect(plan.spent.essence).toBe(0);
    for (const k of ["ore", "rola", "fantomonExp"] as const) expect(plan.left[k]).toBeGreaterThanOrEqual(0);
  });

  it("says what stopped it short", () => {
    const plan = planForGoal(s1, { ...base, pointsNeeded: 1e9, budget: plenty });
    expect(plan.pointsShort).toBeGreaterThan(0);
    expect(plan.limitedBy).not.toBeNull();
  });

  it("adds nothing when current levels already reach the goal", () => {
    const plan = planForGoal(s1, { ...base, pointsNeeded: 0, budget: plenty });
    expect(plan.pointsAdded).toBe(0);
    expect(plan.planned.gear).toEqual(Array(5).fill(140));
  });
});
