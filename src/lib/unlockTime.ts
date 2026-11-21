// Everything on a server's calendar unlocks at the daily reset (13:00 UTC), not at midnight.
// These helpers say when, in the player's time zone and in the game's server time, and whether it's live yet.

import { RESET_UTC_HOUR, SERVER_UTC_OFFSET_HOURS } from "../data/calendar";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "5:00 AM PST" for a moment, in a time zone ("" = the device's). */
export function localTime(at: Date, timeZone = ""): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  try {
    return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: timeZone || undefined }).format(at);
  } catch {
    return new Intl.DateTimeFormat(undefined, opts).format(at);
  }
}

/** The reset in server time: "8:00 AM server time". */
export function serverResetTime(): string {
  const hour = (RESET_UTC_HOUR + SERVER_UTC_OFFSET_HOURS + 24) % 24;
  const label = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(Date.UTC(2026, 0, 1, hour));
  return `${label} server time`;
}

/** "UTC−5" for the server clock. */
export const serverZoneLabel = () => `UTC${SERVER_UTC_OFFSET_HOURS < 0 ? "−" : "+"}${Math.abs(SERVER_UTC_OFFSET_HOURS)}`;

/** "2h 14m", "45m", "under a minute". */
export function countdown(ms: number): string {
  if (ms < MINUTE) return "under a minute";
  const h = Math.floor(ms / HOUR);
  const m = Math.floor((ms % HOUR) / MINUTE);
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

/** Calendar days from now to a moment, counted in a time zone (0 = same local day). */
export function daysAway(at: Date, now: Date, timeZone = ""): number {
  const key = (d: Date) => {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || undefined, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    } catch {
      return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    }
  };
  return Math.round((Date.parse(key(at)) - Date.parse(key(now))) / DAY);
}

export type UnlockState = "live" | "soon" | "later" | "past";

export interface Unlock {
  state: UnlockState;
  /** Short status: "Live now", "Unlocks in 2h 14m", "Tomorrow", "In 3 days". */
  label: string;
  /** When, both ways: "5:00 AM PST · 8:00 AM server time". */
  at: string;
}

/**
 * Where an event stands. "soon" means it unlocks within the next 24 hours (shown as a countdown).
 * A one-day event stays live until the next reset; one with an end stays live until then.
 */
export function unlockStatus(start: Date, now: Date, end: Date | null = null, timeZone = ""): Unlock {
  const at = `${localTime(start, timeZone)} · ${serverResetTime()}`;
  const until = start.getTime() - now.getTime();
  if (until > 0) {
    if (until < DAY) return { state: "soon", label: `Unlocks in ${countdown(until)}`, at };
    const days = daysAway(start, now, timeZone);
    return { state: "later", label: days <= 1 ? "Tomorrow" : `In ${days} days`, at };
  }
  const over = end ? end.getTime() : start.getTime() + DAY;
  return now.getTime() < over ? { state: "live", label: "Live now", at } : { state: "past", label: "Done", at };
}
