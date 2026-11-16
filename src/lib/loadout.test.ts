import { describe, expect, it } from "vitest";
import { decodeLoadout, decodeShort, emptyLoadout, encodeLoadout, encodeShort } from "./loadout";

describe("loadout links", () => {
  it("round-trips a build, keeping slot order, gaps and unicode notes", () => {
    const l = { ...emptyLoadout("Mishushi"), skills: [10500, null, 10012, 10013], charms: [null, 10600, null, null], pet: 1622, title: "Heal Arcanist", notes: "Rotate 1→3, keep shield up ✨" };
    const code = encodeLoadout(l);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeLoadout(code)).toEqual(l);
  });

  it("rejects junk and trims oversized fields", () => {
    expect(decodeLoadout("not-a-link")).toBeNull();
    expect(decodeLoadout("")).toBeNull();
    const long = encodeLoadout({ ...emptyLoadout(), title: "x".repeat(200) });
    expect(decodeLoadout(long)?.title.length).toBe(60);
  });
});

describe("short loadout links", () => {
  it("packs a full build into a short code and back", () => {
    const l = { ...emptyLoadout("Zhangkongzhe7"), skills: [10500, 10012, null, 10681], charms: [10000, null, 10601, 10602], pet: 1622, title: "DUNGEON-TANK", notes: "" };
    const code = encodeShort(l);
    expect(code.length).toBeLessThanOrEqual(36);
    expect(decodeShort(code)).toEqual(l);
  });

  it("keeps unicode names and notes, and an empty build is 16 characters", () => {
    const l = { ...emptyLoadout("Fashi"), title: "Heal ✨", notes: "1→3" };
    expect(decodeShort(encodeShort(l))).toEqual(l);
    expect(encodeShort(emptyLoadout("Fashi"))).toHaveLength(16);
    expect(decodeShort("abc")).toBeNull();
  });

  it("carries skill ranks only when some are set", () => {
    const base = { ...emptyLoadout("Zhangkongzhe7"), skills: [10000, 10012, null, null], charms: [10500, null, null, null] };
    const ranked = { ...base, ranks: { "10000": 19, "10500": 28 } };
    expect(decodeShort(encodeShort(ranked))).toEqual(ranked);
    expect(encodeShort(ranked).length).toBeGreaterThan(encodeShort(base).length);
    // A rank for a skill that isn't slotted is dropped.
    expect(decodeShort(encodeShort({ ...base, ranks: { "10681": 30 } }))?.ranks).toEqual({});
  });
});
