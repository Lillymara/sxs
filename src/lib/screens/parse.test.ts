import { describe, expect, it } from "vitest";
import { firstAmount } from "./backpack";
import { cartRowCentres, parseGearBadges, classify, levelFromNeed, parseBed, parseCartValue, parseCharacterXp, parseProgression, parseSeason, type Word } from "./parse";

const word = (text: string, x: number, y: number): Word => ({ text, bbox: { x0: x, y0: y, x1: x + 60, y1: y + 30 } });

// Recognized text from real screenshots, trimmed to what matters.
describe("screenshot parsing", () => {
  it("tells the screens apart", () => {
    expect(classify("Bed @ Quick Claim | Base EXP Yield 66120 | EXP/Hr 76567")).toBe("bed");
    expect(classify("(Q] Cart © Quick Claim | +554/h | +546/h")).toBe("cart");
    expect(classify("S1. Witching Hours | Season Gear Level Season Skill Level | 7600 pts")).toBe("progression");
    expect(classify("438K/1.53M | ATK DEF HP SPD | 278K 296K")).toBe("character");
    expect(classify("Item 378K 27.4K")).toBe("unknown");
  });

  it("reads the Bed's EXP per hour", () => {
    expect(parseBed("Production Bonus 15.8% | EXP/Hr 76567 | EXP Reserve 2.75M")).toEqual({ rate: 76567 });
  });

  it("reads character EXP and works out the level from what it needs", () => {
    expect(parseCharacterXp("16/100 438K/1.53M go); Sxpert")).toEqual({ xp: "438K", need: "1.53M" });
    expect(levelFromNeed(1, "1.53M")).toBe(116);
    expect(levelFromNeed(1, "1.48M")).toBe(115);
  });

  it("reads the season, even when S is read as $", () => {
    expect(parseSeason("$1. Witching Hours paving 13176")).toBe(1);
    expect(parseSeason("S2. Crossed Paths")).toBe(2);
  });

  it("reads season levels from each system's points", () => {
    const words = [
      word("1632", 560, 869), word("pts", 640, 869),
      word("7600", 250, 1094), word("pts", 330, 1094), word("1664", 820, 1097), word("pts", 900, 1097),
      word("1120", 300, 1455), word("pts", 380, 1455), word("2280pts", 720, 1443),
    ];
    expect(parseProgression(words, 1)).toEqual({ character: 16.32, gear: 200, skill: 128, fantomon: 80, relic: 40 });
  });

  it("reads all five gear badges, or none", () => {
    // From the second device: right column, left column, interleaved by height.
    const words = [word("+135", 1433, 244), word("4", 1213, 257), word("+140", 443, 350), word("+135", 1504, 497), word("+137", 443, 707), word("+135", 1456, 764)];
    expect(parseGearBadges(words)).toEqual([135, 140, 135, 137, 135]);
    expect(parseGearBadges(words.slice(0, 4))).toBeUndefined();
  });

  it("finds every Cart row from the title and the rows already read", () => {
    const words = [word("Cart", 161, 860), word("+554/h", 313, 1107), word("+546/h", 313, 1233), word("+874/h", 313, 1736)];
    const rows = cartRowCentres(words)!;
    expect(rows.pitch).toBeCloseTo(125.7, 0);
    // Row 2 (Stone) is where +546/h was read.
    expect(Math.abs(rows.centres[2] - 1248)).toBeLessThan(15);
    expect(parseCartValue("+9315/h")).toBe(9315);
    expect(parseCartValue("+1,029/h")).toBe(1029);
  });

  it("takes Rola from the start of the Backpack top bar", () => {
    expect(firstAmount("529K+136.3K+11124")).toBe("529K");
    expect(firstAmount("378K+ 43.82K+")).toBe("378K");
  });
});
