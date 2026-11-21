import { describe, expect, it } from "vitest";
import type { Server } from "./calendar";
import { makeCustomServer, parseCustomServers, rosterMatch, withCustom } from "./customServers";

const roster: Server[] = [{ id: "70047-12", name: "Faerie Inn", opened: "2026-11-15", nexus: "70047", number: 12, merges: [[], [], [], []] }];

describe("custom servers", () => {
  it("builds a custom server from the form, ignoring bad optional fields", () => {
    expect(makeCustomServer({ name: "  Moon Harbor ", opened: "2026-11-20", nexus: "7004", number: 3 }, 0)).toEqual({
      id: "custom-0",
      name: "Moon Harbor",
      opened: "2026-11-20",
      nexus: "",
      number: 3,
      merges: [[], [], [], []],
      custom: true,
    });
  });

  it("drops malformed saved entries instead of failing", () => {
    expect(parseCustomServers("not json")).toEqual([]);
    expect(parseCustomServers(JSON.stringify([{ id: "x", name: "No prefix" }, { id: "custom-1", name: " " }, null]))).toEqual([]);
    expect(parseCustomServers(JSON.stringify([{ id: "custom-1", name: "Ok", opened: "soon" }]))[0].opened).toBe("");
  });

  it("hides a custom server once the roster has it, by Nexus and number or by name", () => {
    const byNumber = makeCustomServer({ name: "Fairy Inn", opened: "", nexus: "70047", number: 12 }, 1);
    const byName = makeCustomServer({ name: "faerie  inn", opened: "" }, 2);
    const fresh = makeCustomServer({ name: "Moon Harbor", opened: "2026-11-20" }, 3);
    expect(rosterMatch(roster, byNumber)?.id).toBe("70047-12");
    expect(rosterMatch(roster, byName)?.id).toBe("70047-12");
    expect(withCustom(roster, [byNumber, byName, fresh]).map((s) => s.id)).toEqual(["70047-12", fresh.id]);
  });
});
