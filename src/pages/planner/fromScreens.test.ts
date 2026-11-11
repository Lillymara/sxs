import { describe, expect, it } from "vitest";
import type { Character } from "../../components/CharacterForm";
import { DEFAULT_PLANNER } from "./form";
import { applyFound, mergeReads, spread } from "./fromScreens";

const character: Character = { name: "", season: "2", level: "", progressMode: "percent", currentXp: "", percent: "", rate: "", goalLevel: "" };

describe("filling the planner from screenshots", () => {
  it("spreads a season total over slots", () => {
    expect(spread(182, 5, 100)).toEqual([137, 137, 136, 136, 136]);
    expect(spread(40, 20, 10)).toEqual(Array(20).fill(12));
  });

  it("merges reads, taking the season from the season screen and the level from the EXP needed", () => {
    const found = mergeReads(
      [
        { file: "a", kind: "progression", season: 1, levels: { character: 16.32, gear: 200, skill: 128, fantomon: 80, relic: 40 } },
        { file: "b", kind: "character", xp: "438K", need: "1.53M" },
        { file: "c", kind: "bed", rate: 76567 },
        { file: "d", kind: "cart", cart: { rola: 9315, wood: 554, ore: 1108, essence: 1029, sand: 874, treats: 68 } },
      ],
      2,
    );
    expect(found).toEqual({
      season: "1",
      level: "116",
      xp: "438K",
      rate: "76567",
      cart: { rola: "9315", ore: "1108", essence: "1029", sand: "874", treats: "68" },
      levels: { gear: "200", skill: "128", fantomon: "80", relic: "40" },
    });
  });

  it("fills the character and planner, clearing planned levels now below current", () => {
    const form = { ...DEFAULT_PLANNER, gear: DEFAULT_PLANNER.gear.map(() => ({ current: "", planned: "120" })) };
    const { character: c, form: f } = applyFound(
      { season: "1", level: "116", xp: "438K", rate: "76567", cart: { rola: "9315" }, levels: { gear: "200", relic: "40" } },
      character,
      form,
    );
    expect(c).toMatchObject({ season: "1", level: "116", progressMode: "xp", currentXp: "438K", rate: "76567" });
    expect(f.income.rola.cartPerHour).toBe("9315");
    expect(f.gear.map((g) => g.current)).toEqual(["140", "140", "140", "140", "140"]);
    expect(f.gear[0].planned).toBe(""); // 120 is below the new 140
    expect(f.relics[0]).toEqual({ current: "12", planned: "" });
  });

  it("uses each gear piece's exact level from the Character screen", () => {
    const found = mergeReads([{ file: "a", kind: "character", gear: [140, 137, 135, 135, 135] }], 1);
    expect(found.gearPieces).toBe("140, 137, 135, 135, 135");
    const { form: f } = applyFound({ ...found, season: "1", levels: { gear: "182" } }, character, DEFAULT_PLANNER);
    expect(f.gear.map((g) => g.current)).toEqual(["140", "137", "135", "135", "135"]);
  });
});
