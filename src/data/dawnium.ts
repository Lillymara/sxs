// Dawnium guide structure: the site owner's recommendations plus the Realm presets. The words live in
// src/i18n/en.ts under "dw." (and the other language files), so each line can be translated.

export interface Use {
  /** Keys: dw.use.<id>.title / .cost / .advice / .p1… / .link */
  id: string;
  points: number;
  /** A page on this site to point to (label in dw.use.<id>.link). */
  link?: string;
}

/** Where Dawnium does the most good, best first. */
export const PRIORITIES: Use[] = [
  { id: "dungeon", points: 2 },
  { id: "realm", points: 2, link: "/planner" },
  { id: "guild", points: 2 },
  { id: "arena", points: 3 },
];

/** Where any Dawnium left over after the best uses can go, best first (dw.pull.<id>.title / .note). */
export const LEFTOVER_PULLS: { id: string; icon: string; note?: boolean }[] = [
  { id: "relic", icon: "relic" },
  { id: "skill", icon: "skill" },
  { id: "fantomon", icon: "fantomon", note: true },
];

/** The reminder shown with the pulls (dw.remind.*). Kept in the site owner's words. */
export const REMINDER_PARAGRAPHS = 2;

/** Realm refresh presets for the calculator, per Realm. Labels are translated as preset.<label>. */
export const REALM_PRESETS: { label: "Free to play" | "Spender" | "Whale"; plan: Record<"ore" | "rola" | "essence" | "sand", number> }[] = [
  { label: "Free to play", plan: { ore: 2, rola: 2, essence: 2, sand: 2 } },
  { label: "Spender", plan: { ore: 4, rola: 2, essence: 4, sand: 4 } },
  { label: "Whale", plan: { ore: 10, rola: 10, essence: 10, sand: 10 } },
];

/** Rola budgeting tips (dw.rola1…) and things to avoid spending Dawnium on (dw.avoid1…). */
export const ROLA_TIPS = 2;
export const AVOID = 3;
