import { describe, expect, it } from "vitest";
import { formatRows, mergeRoster, mergeWithManual, parseCsv, readSheet, sheetDate, titleCase } from "./sync-servers.mjs";

const HEADER = `"NEXUS","SERVER #","SERVER NAME","STATUS","SERVER CREATION TIME","START DATE","SEASON STATUS","DAYS LIVE","PROGRESS","NEXUS UNIFIED DATE","SEASON 1","SEASON 2","SEASON 3","SEASON 4 +"`;
const row = (nexus, n, name, start, s1 = "", s2 = "") => `"${nexus}","${n}","${name}","FULL","","${start}","","","","","${s1}","${s2}","",""`;

describe("server roster sync", () => {
  it("parses quoted CSV with commas inside fields", () => {
    expect(parseCsv(`"a","b, c"\n"d ""e""",f\n`)).toEqual([["a", "b, c"], ['d "e"', "f"]]);
  });

  it("converts sheet dates and names", () => {
    expect(sheetDate("11/15/2026 9:00 AM")).toBe("2026-11-15");
    expect(sheetDate("")).toBe("");
    expect(titleCase("PIER OF YORE")).toBe("Pier of Yore");
    expect(titleCase("SKY-REACH")).toBe("Sky-Reach");
    expect(titleCase(" ELYNDOR ")).toBe("Elyndor");
  });

  it("reads columns by header name and skips non-server rows", () => {
    const csv = [HEADER, row("70047", 12, "FAERIE INN", "11/15/2026 9:00 AM", "KOI RIVER"), `"","","","","","","","","","","","","",""`].join("\n");
    expect(readSheet(csv)).toEqual([
      { id: "70047-12", name: "FAERIE INN", opened: "2026-11-15", nexus: "70047", number: 12, merges: [["KOI RIVER"], [], [], []] },
    ]);
  });

  it("fails loudly when a column is renamed", () => {
    expect(() => readSheet(HEADER.replace("START DATE", "OPENED") + "\n")).toThrow(/START DATE/);
  });

  it("adds and fills in, but never overwrites what we have", () => {
    const ours = [
      ["Runestone", "2026-05-20", "70001", 2, [["First Dawn"], [], [], []]],
      ["Koi River", "", "70047", 11, [[], [], [], []]],
    ];
    const sheet = readSheet(
      [
        HEADER,
        row("70001", 2, "RUNESTONE", "05/19/2026 9:00 AM", "SOLARIA"),
        row("70047", 11, "KOI RIVER", "11/15/2026 9:00 AM", "FAERIE INN"),
        row("70047", 12, "FAERIE INN", "11/15/2026 9:00 AM", "KOI RIVER"),
      ].join("\n"),
    );
    const { rows, report } = mergeRoster(ours, sheet);
    expect(rows).toEqual([
      ["Runestone", "2026-05-20", "70001", 2, [["First Dawn"], [], [], []]],
      ["Koi River", "2026-11-15", "70047", 11, [["Faerie Inn"], [], [], []]],
      ["Faerie Inn", "2026-11-15", "70047", 12, [["Koi River"], [], [], []]],
    ]);
    expect(report.added.map((x) => x.id)).toEqual(["70047-12"]);
    expect(report.datesFilled.map((x) => x.id)).toEqual(["70047-11"]);
    expect(report.conflicts.map((x) => `${x.id} ${x.field}`)).toEqual(["70001-2 opened", "70001-2 merges"]);
  });

  it("moves hand-added servers into the roster once the sheet has them", () => {
    const ours = [["Faerie Inn", "2026-11-15", "70047", 12, [[], [], [], []]]];
    const manual = [
      ["Moonmoth Vale", "2026-11-18", "70048", 2, [[], [], [], []]], // sheet lists it at the same spot
      ["Kite Meadow", "2026-11-20", "70048", 5, [[], [], [], []]], // sheet has it under another number
      ["Starshard Cove", "2026-11-21", "70048", 7, [[], [], [], []]], // sheet doesn't have it yet
    ];
    const sheet = readSheet(
      [
        HEADER,
        row("70047", 12, "FAERIE INN", "11/15/2026 9:00 AM"),
        row("70048", 2, "MOONMOTH VALE", "11/19/2026 9:00 AM", "AURORA TUNDRA"),
        row("70048", 1, "KITE MEADOW", "11/18/2026 9:00 AM"),
      ].join("\n"),
    );
    const { rows, manual: left, report } = mergeWithManual(ours, manual, sheet);
    expect(rows.map((r) => r.slice(0, 4))).toEqual([
      ["Faerie Inn", "2026-11-15", "70047", 12],
      ["Kite Meadow", "2026-11-18", "70048", 1],
      ["Moonmoth Vale", "2026-11-18", "70048", 2],
    ]);
    expect(rows[2][4]).toEqual([["Aurora Tundra"], [], [], []]);
    expect(left.map((r) => r[0])).toEqual(["Starshard Cove"]);
    expect(report.manualMoved.map((x) => x.id)).toEqual(["70048-2"]);
    expect(report.manualReplaced).toEqual([{ id: "70048-5", name: "Kite Meadow", sheetId: "70048-1" }]);
    expect(report.conflicts.map((x) => `${x.id} ${x.field}`)).toEqual(["70048-2 opened"]);
    expect(report.missingFromSheet).toEqual([]);
  });

  it("keeps working when the sheet clears server names", () => {
    const ours = [["Runestone", "", "70001", 2, [[], [], [], []]]];
    const sheet = readSheet(
      [
        HEADER,
        row("70001", 2, "#REF!", "05/19/2026 9:00 AM", "FIRST DAWN", "#REF!"), // ours, name broken: still fills the date and merges
        row("70048", 3, "", "11/20/2026 9:00 AM"), // new and unnamed: wait for a name
      ].join("\n"),
    );
    expect(sheet).toHaveLength(2);
    const { rows, report } = mergeRoster(ours, sheet);
    expect(rows).toEqual([["Runestone", "2026-05-19", "70001", 2, [["First Dawn"], [], [], []]]]);
    expect(report.conflicts).toEqual([]);
    expect(report.added).toEqual([]);
    expect(report.waitingForName).toEqual([{ id: "70048-3", opened: "2026-11-20" }]);
  });

  it("writes one server per line", () => {
    expect(formatRows([["A", "", "70001", 1, [[], [], [], []]]])).toBe(`[\n["A","","70001",1,[[],[],[],[]]]\n]\n`);
  });
});
