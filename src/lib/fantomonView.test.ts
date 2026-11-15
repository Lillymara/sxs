import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createExplorer } from "./explorer";
import type { GameData } from "./gamedata";
import { buildFantomons, PROFILES, pwmLines } from "./fantomonView";

const data = JSON.parse(readFileSync("public/data/gamedata.json", "utf8")) as GameData;
const explorer = createExplorer(data);
const views = buildFantomons(explorer);

/** First number in a line ("39.2% + 6,764" → [39.2, 6764]). */
const nums = (t: string) => (t.match(/[\d,.]+/g) ?? []).map((x) => Number(x.replace(/,/g, "")));

describe("Purrwikimania skill values", () => {
  it("match the client calculation for a Fantomon both sources have", () => {
    // Falko's Golden Feather at Mythic, level 100: same DMG % and flat part from both paths.
    const falko = views.find((v) => v.id === 1600)!;
    const feather = falko.battle.find((s) => s.name === "Golden Feather")!;
    const client = feather.lines("Gold", 100)[0];
    const pwm = PROFILES["1600"].skills.battle.find((s) => s.name === "Golden Feather")!.values!;
    const ours = pwmLines(explorer, pwm, "Gold", 100)[0];
    const [cp, cf] = nums(client.text);
    const [pp, pf] = nums(ours.text);
    expect(pp).toBeCloseTo(cp, 0);
    if (cf) expect(Math.abs(pf - cf) / cf).toBeLessThan(0.01);
  });

  it("add Mumpkin and Hexitty with their skills", () => {
    const mumpkin = views.find((v) => v.name === "Mumpkin")!;
    expect(mumpkin.isNew).toBe(true);
    expect(mumpkin.quality).toBe("Orange");
    const support = mumpkin.support[0].lines("Purple", 100);
    // As Purrwikimania lists it at Epic, level 100: "39.2% + 6,764", healing "1.7% + 4,811".
    expect(support[0].text).toBe("39.2% + 6,764");
    expect(support[1].text).toBe("1.7% + 4,811");
    const hexitty = views.find((v) => v.name === "Hexitty")!;
    expect(hexitty.quality).toBe("Gold");
    expect(hexitty.battle).toHaveLength(3);
    expect(hexitty.fantasmia?.cap).toBe(400);
  });
});
