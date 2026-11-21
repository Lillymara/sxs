import { describe, expect, it } from "vitest";
import { formatRows, mergeRoster, parseCsv, readSheet, sheetDate, titleCase } from "./sync-servers.mjs";

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

  it("writes one server per line", () => {
    expect(formatRows([["A", "", "70001", 1, [[], [], [], []]]])).toBe(`[\n["A","","70001",1,[[],[],[],[]]]\n]\n`);
  });
});
