import { describe, expect, it } from "vitest";
import { decodeLoadout, emptyLoadout, encodeLoadout } from "./loadout";

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
