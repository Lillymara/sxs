// When each Fantomon and companion can be obtained, and what that means for a given server.
import { publicServerDay } from "../data/calendar";
import { dayDate, parseDay } from "./calendar";
import { formatLocale } from "../i18n/format";
import { english, type Tr } from "../i18n/tr";

export type Rule =
  /** Not in the global game yet. */
  | { kind: "unreleased"; note: string }
  /** Arrives on a server-relative day (the calendar's day numbering). */
  | { kind: "serverDay"; day: number; label: string }
  /** Only obtainable during a fixed-date global event. */
  | { kind: "event"; start: string; end: string; label: string }
  /** Limited or event-only, but the dates aren't known. */
  | { kind: "limited"; label: string };

/** Fantomon id → rule. Fantomons without a rule are part of the regular roster. */
export const FANTOMON_RULES: Record<number, Rule> = {
  1611: { kind: "serverDay", day: 92, label: "Pandarial release" },
  // Matched by name to the calendar's "Rainbow Star Spirit" Fantomon release.
  1614: { kind: "serverDay", day: 160, label: "Rainbow Star Spirit release" },
  1613: { kind: "event", start: "2026-09-07", end: "2026-09-23", label: "Skill Up or Shut Up (Cabbage Dog collab)" },
  1612: { kind: "limited", label: "KonoSuba collaboration" },
  1615: { kind: "limited", label: "Spring 2026 event" },
  1616: { kind: "unreleased", note: "Future collaboration" },
  1617: { kind: "unreleased", note: "Future event" },
  // From Purrwikimania (not in the client extract yet): Halloween 2026 Fantomons.
  1620: { kind: "limited", label: "Halloween 2026 event" },
  1622: { kind: "limited", label: "Halloween 2026 event" },
};

const SLIME = { kind: "event", start: "2026-12-01", end: "2026-12-11", label: "That Time I Got Reincarnated collab" } as const;
const AEPERIS = { kind: "unreleased", note: "Aeperis region, not open yet" } as const;
const KONOSUBA = { kind: "limited", label: "KonoSuba collaboration" } as const;

/** Companion id → rule, on top of the client's own "unreleased" / "TW / future" flags. */
export const COMPANION_RULES: Record<number, Rule> = {
  11015: SLIME, 11016: SLIME, 11017: SLIME, 11018: SLIME,
  11001: KONOSUBA, 11002: KONOSUBA, 11003: KONOSUBA, 11004: KONOSUBA,
  11005: { kind: "limited", label: "Luo Tianyi collaboration" },
  11006: { kind: "limited", label: "Crossover event" },
  11042: { kind: "limited", label: "Crossover event" },
  10110: { kind: "limited", label: "Starfrost (winter) event" },
  10111: { kind: "limited", label: "Starfrost (winter) event" },
  10206: { kind: "limited", label: "Crossover event" },
  10412: { kind: "limited", label: "Crossover event" },
  // From Purrwikimania (not in the client extract yet).
  10709: { kind: "serverDay", day: 316, label: "Ignis opens (Season 5)" },
  10801: AEPERIS, 10802: AEPERIS, 10803: AEPERIS, 10804: AEPERIS, 10805: AEPERIS, 10806: AEPERIS,
};

/** A companion's rule, using the client's availability flag when there's no specific one. */
export function companionRule(id: number, availability: string): Rule | undefined {
  if (availability === "TW / future") return { kind: "unreleased", note: "TW / future content" };
  if (availability !== "Global client") return { kind: "unreleased", note: "In the global client but not released" };
  return COMPANION_RULES[id];
}

export type State = "available" | "unreleased" | "upcoming" | "missed" | "limited";

export interface Availability {
  state: State;
  /** Short tag for cards. */
  tag?: string;
  /** Longer explanation. */
  detail?: string;
}

const fmt = (d: Date) => d.toLocaleDateString(formatLocale(), { month: "short", day: "numeric", year: "numeric" });

/**
 * What a rule means for a server that opened on `day1` (null if no server is chosen), as of `now`.
 * Event items count as missed only if the event ended before the server opened.
 */
export function availabilityFor(rule: Rule | undefined, day1: Date | null, now: Date, tr: Tr = english): Availability {
  if (!rule) return { state: "available" };
  switch (rule.kind) {
    case "unreleased":
      return { state: "unreleased", tag: tr("avl.unreleased"), detail: tr("avl.unreleasedDetail", { note: ruleText(rule.note, tr) }) };
    case "limited":
      return { state: "limited", tag: tr("avl.limited"), detail: tr("avl.limitedDetail", { label: ruleText(rule.label, tr) }) };
    case "serverDay": {
      const day = publicServerDay(rule.day);
      const tag = tr("avl.day", { n: day });
      if (!day1) return { state: "available", tag, detail: tr("avl.dayNoServer", { n: day, label: ruleText(rule.label, tr) }) };
      const date = dayDate(day1, day);
      return date > now
        ? { state: "upcoming", tag, detail: tr("avl.dayUpcoming", { n: day, date: fmt(date) }) }
        : { state: "available", tag, detail: tr("avl.dayArrived", { n: day, date: fmt(date) }) };
    }
    case "event": {
      const start = parseDay(rule.start)!;
      const end = parseDay(rule.end)!;
      const vars = { label: ruleText(rule.label, tr), when: `${fmt(start)} – ${fmt(end)}` };
      if (now < start) return { state: "upcoming", tag: tr("avl.event"), detail: tr("avl.eventSoon", vars) };
      if (day1 && day1 > end) return { state: "missed", tag: tr("avl.missed"), detail: tr("avl.eventMissed", vars) };
      return { state: "available", tag: tr("avl.event"), detail: tr("avl.eventOn", vars) };
    }
  }
}

/** Rule notes and labels in the chosen language. Event and collaboration names stay as the game writes them. */
const RULE_TEXT: Record<string, Parameters<Tr>[0]> = {
  "Future collaboration": "avr.futureCollab",
  "Future event": "avr.futureEvent",
  "Aeperis region, not open yet": "avr.aeperis",
  "TW / future content": "avr.tw",
  "In the global client but not released": "avr.notReleased",
  "Crossover event": "avr.crossover",
  "Starfrost (winter) event": "avr.starfrost",
  "Spring 2026 event": "avr.spring",
  "Halloween 2026 event": "avr.halloween",
  "Ignis opens (Season 5)": "avr.ignis",
};
function ruleText(text: string, tr: Tr): string {
  if (RULE_TEXT[text]) return tr(RULE_TEXT[text]);
  const m = text.match(/^(.+) (release|collaboration)$/);
  if (m) return tr(m[2] === "release" ? "avr.release" : "avr.collab", { name: m[1] });
  return text;
}

/** Hidden when the player asks to see only what their server can get. */
export const isObtainable = (a: Availability) => a.state === "available" || a.state === "limited";

/** Looser check for Fantomons: also keeps ones still coming to the server. */
export const isStillObtainable = (a: Availability) => a.state !== "missed" && a.state !== "unreleased";
