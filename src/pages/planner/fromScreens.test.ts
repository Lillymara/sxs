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
      { season: "1", level: "116", xp: "438K", rate: "76567", cart: { rola: "9315" }, gearPieces: "140, 140, 140, 140, 140", levels: { gear: "200", relic: "40" } },
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

  it("keeps saved gear when the screenshot only provides a total or an incomplete read", () => {
    const gear = [141, 132, 135, 130, 139].map((level) => ({ current: String(level), planned: "145" }));
    const form = { ...DEFAULT_PLANNER, gear };
    for (const gearPieces of [undefined, "141, 132, 135, 130", "141, 132, 135, -130, 139"]) {
      const result = applyFound({ gearPieces, cart: {}, levels: { gear: "27", relic: "20" } }, character, form);
      expect(result.form.gear).toEqual(gear);
      expect(result.form.relics[0].current).toBe("14");
    }
  });

  it("turns Backpack amounts into planner materials and saved Realm tools", () => {
    const found = mergeReads(
      [
        {
          file: "bag",
          kind: "backpack",
          rola: 529000,
          bag: { ore: 191000, refinedOre: 17600, essence: 551000, sand: 55100, rareSand: 2220, epicSand: 15300, basicTreats: 30800, premiumTreats: 90, deluxeTreats: 32, hammer: 41, pickaxe: 182, knuckles: 343, shovel: 392 },
        },
      ],
      1,
    );
    // Sand: 55,100 + 5 x 2,220 + 25 x 15,300; treats: (30,800 x 50 + 90 x 400 + 32 x 2,000) / 50
    expect(found.have).toEqual({ rola: "529000", ore: "191000", essence: "551000", sand: "448700", treats: "32800" });
    expect(found.tools).toEqual({ ore: "41", rola: "182", essence: "343", sand: "392" });
    expect(found.refinedOre).toBe("17600");
    const { form: f } = applyFound(found, character, DEFAULT_PLANNER);
    expect(f.refinedOre).toBe("17600");
    expect(f.income.sand.have).toBe("448700");
    expect(f.savedEntries).toEqual({ ore: "41", rola: "182", essence: "343", sand: "392" });
  });

  it("combines several Backpack pages before working out totals", () => {
    const found = mergeReads(
      [
        { file: "p1", kind: "backpack", rola: 378000, bag: { shovel: 464, knuckles: 395, pickaxe: 91, hammer: 111 } },
        { file: "p2", kind: "backpack", rola: 378000, bag: { rareSand: 8840, sand: 824000, ore: 9380, essence: 63700, basicTreats: 73 } },
        { file: "p3", kind: "backpack", bag: { epicSand: 100 } },
      ],
      1,
    );
    expect(found.have).toMatchObject({ sand: String(824000 + 5 * 8840 + 25 * 100), treats: "73", ore: "9380" });
    expect(found.tools).toEqual({ ore: "111", rola: "91", essence: "395", sand: "464" });
  });
});
