import { parseDay } from "../../lib/calendar";

/** The player's server, saved so the planner can use its season dates too. */
export interface ServerChoice {
  /** Roster id ("nexus-number"), or "" for a custom server. */
  serverId: string;
  name: string;
  /** Calendar Day 1 (YYYY-MM-DD). */
  day1: string;
  /** Manual correction in days (−30 to +30). */
  offset: number;
  /** IANA timezone for display, or "" for the device's. */
  timezone: string;
}

export const DEFAULT_SERVER: ServerChoice = { serverId: "", name: "", day1: "", offset: 0, timezone: "" };

/** Servers whose timeline runs a day behind their opening date (Season 1 lasts a day longer), by roster id.
 *  Confirmed by players on Godspire; its launch batch (Crimson Fort, Ancient Ruin, Mistwaste) is the same. */
export const SERVER_SHIFT_DAYS: Record<string, number> = {
  "70043-13": 1,
  "70043-14": 1,
  "70043-15": 1,
  "70043-16": 1,
};

export function effectiveDay1(c: ServerChoice): Date | null {
  const base = parseDay(c.day1);
  const shift = (c.serverId && SERVER_SHIFT_DAYS[c.serverId]) || 0;
  return base ? new Date(base.getTime() + (c.offset + shift) * 86_400_000) : null;
}

/** The 13:00 UTC daily reset in local "HH:MM". */
export function localResetTime(): string {
  const d = new Date();
  d.setUTCHours(13, 0, 0, 0);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
