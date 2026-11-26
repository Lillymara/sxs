// Sync src/data/servers.json with the community server roster: the "Copy of Servers" tab of the
// "SxS All In One Database" Google Sheet, which players keep up to date as new servers open.
//
//   node scripts/sync-servers.mjs              update servers.json and print what changed
//   node scripts/sync-servers.mjs --dry-run    print what would change, write nothing
//   node scripts/sync-servers.mjs --summary=FILE   also write the change list as Markdown (for a PR body)
//
// The sheet only ever adds to our roster: new servers are appended, and blank opening dates and
// blank merge lists are filled in. Names and dates we already have are never overwritten, because
// some were corrected by hand from player reports (e.g. nexus 70004, 70019, 70024). Where the
// sheet disagrees with us, it's listed under "Sheet disagrees" so a person can decide.
//
// Rows are [name, opened YYYY-MM-DD or "", nexus, number, [season1, season2, season3, season4+ merges]].

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SHEET_ID = "1uZqmE-71qg2JbEEeBKQXppDToqo4UwQ1zdMFs75UyrU";
const TAB_GID = "730102442";
// The gviz endpoint serves the tab as CSV without sign-in (the plain /export link is blocked on this sheet).
export const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${TAB_GID}`;
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview#gid=${TAB_GID}`;

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SERVERS_PATH = path.join(ROOT, "src/data/servers.json");
// Servers added by hand before the sheet has them; merged into servers.json once it does.
const MANUAL_PATH = path.join(ROOT, "src/data/servers-manual.json");

/** Sheet values we've already compared with ours and chose to keep ours over, keyed "id field".
 *  They aren't reported again unless the sheet changes them. Ours came from player reports. */
const sheetDates = (nexus, date, from, to) =>
  Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [`${nexus}-${from + i} opened`, date]));
export const REVIEWED = {
  ...sheetDates("70004", "2026-05-19", 1, 16),
  ...sheetDates("70019", "2026-05-29", 1, 16),
  ...sheetDates("70024", "2026-06-10", 5, 8),
  ...sheetDates("70024", "2026-06-11", 9, 16),
  "70008-14 name": "Light Reaver",
  "70018-4 name": "Demiurge Waltz",
};

const COLUMNS = {
  nexus: "NEXUS",
  number: "SERVER #",
  name: "SERVER NAME",
  start: "START DATE",
  merges: ["SEASON 1", "SEASON 2", "SEASON 3", "SEASON 4 +"],
};

/** Minimal RFC 4180 CSV parser (quoted fields, doubled quotes, newlines inside quotes). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(field), (field = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field), rows.push(row), (row = []), (field = "");
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  return rows;
}

const squash = (s) => s.replace(/\s+/g, " ").trim();
/** Spreadsheet error values (#REF!, #N/A, #VALUE!, #NAME?, #ERROR!, #DIV/0!) mean "no data here", not a name. */
const isSheetError = (s) => /^#(REF!|N\/A|VALUE!|NAME\?|ERROR!|DIV\/0!|NUM!|NULL!)$/i.test(s);
/** A cell's text, or "" for blanks and spreadsheet errors. */
const cell = (s) => {
  const v = squash(s ?? "");
  return isSheetError(v) ? "" : v;
};
const key = (s) => squash(s).toUpperCase();

/** "FAERIE INN" → "Faerie Inn", "SKY-REACH" → "Sky-Reach", "PIER OF YORE" → "Pier of Yore". */
export function titleCase(s) {
  const small = new Set(["of", "the", "and", "as", "a", "an", "in", "on", "to"]);
  return squash(s)
    .toLowerCase()
    .split(" ")
    .map((word, i) =>
      i > 0 && small.has(word) ? word : word.replace(/(^|[-'’(])([a-z])/g, (_, p, ch) => p + ch.toUpperCase()),
    )
    .join(" ");
}

/** "11/15/2026 9:00 AM" → "2026-11-15" (the 9:00 AM US Eastern opening is the 13:00 UTC reset day). */
export function sheetDate(value) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(squash(value || ""));
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : "";
}

/** Read the roster tab into {id, name, opened, nexus, number, merges} records (names still in sheet casing). */
export function readSheet(csvText) {
  const rows = parseCsv(csvText);
  const header = rows[0]?.map(key) ?? [];
  const col = (name) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`Sheet column "${name}" is missing. Headers are: ${header.filter(Boolean).join(", ")}`);
    return i;
  };
  const at = {
    nexus: col(COLUMNS.nexus),
    number: col(COLUMNS.number),
    name: col(COLUMNS.name),
    start: col(COLUMNS.start),
    merges: COLUMNS.merges.map(col),
  };
  const servers = [];
  for (const r of rows.slice(1)) {
    const nexus = squash(r[at.nexus] ?? "");
    const number = Number(squash(r[at.number] ?? ""));
    const name = cell(r[at.name]);
    // A blank name is kept (as ""): the sheet's editors sometimes clear names while the rest of the row is still good.
    if (!/^\d{5}$/.test(nexus) || !Number.isInteger(number) || number < 1) continue;
    servers.push({
      id: `${nexus}-${number}`,
      name,
      opened: sheetDate(cell(r[at.start])),
      nexus,
      number,
      merges: at.merges.map((i) => (r[i] ?? "").split(",").map(cell).filter(Boolean)),
    });
  }
  return servers;
}

/**
 * Merge the sheet into our rows without overwriting anything we already have.
 * Returns the new rows plus a change report.
 */
export function mergeRoster(ourRows, sheetServers) {
  const rows = ourRows.map(([name, opened, nexus, number, merges]) => [name, opened, nexus, number, merges.map((g) => [...g])]);
  const byId = new Map(rows.map((r) => [`${r[2]}-${r[3]}`, r]));
  const report = { added: [], datesFilled: [], mergesFilled: [], conflicts: [], missingFromSheet: [], waitingForName: [] };

  // Names in our spelling where we have them; new names get title case.
  const spelling = new Map(rows.map((r) => [key(r[0]), r[0]]));
  for (const s of sheetServers) if (s.name && !spelling.has(key(s.name))) spelling.set(key(s.name), titleCase(s.name));
  const spell = (n) => spelling.get(key(n)) ?? titleCase(n);
  const groups = (merges) => merges.map((g) => g.map(spell));

  const seen = new Set();
  for (const s of sheetServers) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const mine = byId.get(s.id);
    if (!mine) {
      // A new server with no name yet: wait for the sheet to name it rather than add a nameless row.
      if (!s.name) {
        report.waitingForName.push({ id: s.id, opened: s.opened });
        continue;
      }
      const row = [spell(s.name), s.opened, s.nexus, s.number, groups(s.merges)];
      rows.push(row);
      byId.set(s.id, row);
      report.added.push({ id: s.id, name: row[0], opened: row[1] });
      continue;
    }
    if (s.name && key(mine[0]) !== key(s.name)) report.conflicts.push({ id: s.id, field: "name", ours: mine[0], sheet: titleCase(s.name) });
    if (!mine[1] && s.opened) {
      mine[1] = s.opened;
      report.datesFilled.push({ id: s.id, name: mine[0], opened: s.opened });
    } else if (mine[1] && s.opened && mine[1] !== s.opened) {
      report.conflicts.push({ id: s.id, field: "opened", ours: mine[1], sheet: s.opened });
    }
    const theirs = groups(s.merges);
    const oursEmpty = mine[4].every((g) => g.length === 0);
    if (oursEmpty && theirs.some((g) => g.length)) {
      mine[4] = theirs;
      report.mergesFilled.push({ id: s.id, name: mine[0] });
    } else if (!oursEmpty && theirs.some((g) => g.length)) {
      const norm = (gs) => JSON.stringify(gs.map((g) => g.map(key).sort()));
      if (norm(mine[4]) !== norm(theirs)) report.conflicts.push({ id: s.id, field: "merges", ours: mine[4], sheet: theirs });
    }
  }
  for (const id of byId.keys()) if (!seen.has(id)) report.missingFromSheet.push(id);
  report.conflicts = report.conflicts.filter((c) => REVIEWED[`${c.id} ${c.field}`] !== c.sheet);

  rows.sort((a, b) => Number(a[2]) - Number(b[2]) || a[3] - b[3]);
  return { rows, report };
}

/**
 * Like mergeRoster, but also handles the hand-added list (servers-manual.json): servers we added before
 * the sheet had them. Once the sheet lists one with the same Nexus and number, it moves into the roster
 * (our date and name kept, blanks filled from the sheet). If the sheet lists the same name under a
 * different Nexus/number, the sheet's entry replaces ours. The rest stay in the hand-added list.
 */
export function mergeWithManual(ourRows, manualRows, sheetServers) {
  const id = (r) => `${r[2]}-${r[3]}`;
  const manualIds = new Set(manualRows.map(id));
  const { rows, report } = mergeRoster([...ourRows, ...manualRows.filter((r) => !ourRows.some((o) => id(o) === id(r)))], sheetServers);
  const sheetIds = new Set(sheetServers.map((s) => s.id));
  const sheetByName = new Map(sheetServers.filter((s) => s.name).map((s) => [key(s.name), s]));
  report.manualMoved = [];
  report.manualReplaced = [];
  const roster = [];
  const manual = [];
  for (const r of rows) {
    if (!manualIds.has(id(r))) roster.push(r);
    else if (sheetIds.has(id(r))) {
      roster.push(r);
      report.manualMoved.push({ id: id(r), name: r[0] });
    } else if (sheetByName.has(key(r[0]))) {
      report.manualReplaced.push({ id: id(r), name: r[0], sheetId: sheetByName.get(key(r[0])).id });
    } else manual.push(r);
  }
  report.missingFromSheet = report.missingFromSheet.filter((x) => !manualIds.has(x));
  return { rows: roster, manual, report };
}

/** One server per line, so changes show up as readable diffs. */
export const formatRows = (rows) => `[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`;


export function describe(report) {
  const lines = [];
  const list = (title, items, fmt) => {
    if (!items.length) return;
    lines.push(`### ${title} (${items.length})`, "", ...items.map((x) => `- ${fmt(x)}`), "");
  };
  list("New servers", report.added, (x) => `\`${x.id}\` ${x.name}${x.opened ? `, opened ${x.opened}` : ", opening date not in the sheet yet"}`);
  list("Opening dates filled in", report.datesFilled, (x) => `\`${x.id}\` ${x.name}: ${x.opened}`);
  list("Merge lists filled in", report.mergesFilled, (x) => `\`${x.id}\` ${x.name}`);
  list("Sheet disagrees (kept ours, check by hand)", report.conflicts, (x) =>
    `\`${x.id}\` ${x.field}: ours ${JSON.stringify(x.ours)}, sheet ${JSON.stringify(x.sheet)}`,
  );
  list("In our roster but not the sheet (kept)", report.missingFromSheet, (x) => `\`${x}\``);
  list("New in the sheet but not named yet (skipped until it has a name)", report.waitingForName ?? [], (x) => `\`${x.id}\`${x.opened ? `, opened ${x.opened}` : ""}`);
  list("Hand-added servers now in the sheet (moved into the roster)", report.manualMoved ?? [], (x) => `\`${x.id}\` ${x.name}`);
  list(
    "Hand-added servers the sheet lists under a different Nexus/number (replaced by the sheet's; check SERVER_SHIFT_DAYS)",
    report.manualReplaced ?? [],
    (x) => `${x.name}: ours \`${x.id}\`, sheet \`${x.sheetId}\``,
  );
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const summaryPath = args.find((a) => a.startsWith("--summary="))?.slice("--summary=".length);

  const res = await fetch(SHEET_CSV_URL, { headers: { "User-Agent": "sxs-tools server sync" } });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.includes("text/csv")) throw new Error(`Couldn't download the roster (HTTP ${res.status}, ${type}). Is the sheet still shared?`);
  const sheet = readSheet(await res.text());

  const ourText = await readFile(SERVERS_PATH, "utf8");
  const ours = JSON.parse(ourText);
  const manualText = await readFile(MANUAL_PATH, "utf8").catch(() => "[]");
  const manualRows = JSON.parse(manualText);
  // Guard against a renamed tab or a half-empty sheet wiping nothing but still misleading us.
  if (sheet.length < ours.length * 0.9) {
    throw new Error(`The sheet has only ${sheet.length} servers but we have ${ours.length}. Not syncing; check ${SHEET_URL}`);
  }

  const { rows, manual, report } = mergeWithManual(ours, manualRows, sheet);
  const text = describe(report);
  console.log(`Sheet: ${sheet.length} servers. Ours: ${ours.length} → ${rows.length}. Hand-added: ${manualRows.length} → ${manual.length}.\n`);
  console.log(text || "Nothing to report.");

  if (summaryPath) {
    const body = [`Synced from the community roster: ${SHEET_URL}`, "", text || "No data changes."].join("\n");
    await writeFile(summaryPath, body + "\n");
  }
  for (const [file, before, after] of [
    [SERVERS_PATH, ourText, formatRows(rows)],
    [MANUAL_PATH, manualText, formatRows(manual)],
  ]) {
    const name = path.relative(ROOT, file);
    if (after === before) console.log(`\n${name} is already up to date.`);
    else if (dryRun) console.log(`\n(dry run, ${name} not written)`);
    else {
      await writeFile(file, after);
      console.log(`\nWrote ${name}.`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
