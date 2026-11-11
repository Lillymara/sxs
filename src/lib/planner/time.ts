const HOUR_MS = 3_600_000;

/** Parses "HH:MM" into hours and minutes; defaults to 16:00 (the usual server reset). */
export function parseResetTime(value: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  return m ? [Number(m[1]), Number(m[2])] : [16, 0];
}

/** Daily reset moments strictly after `start` and strictly before `end`. */
export function resetsBetween(start: Date, end: Date, resetTime: string): Date[] {
  if (!(end > start)) return [];
  const [h, m] = parseResetTime(resetTime);
  const cursor = new Date(start);
  cursor.setHours(h, m, 0, 0);
  if (cursor <= start) cursor.setDate(cursor.getDate() + 1);
  const out: Date[] = [];
  // A reset exactly at season end belongs to the next season.
  while (cursor < end && out.length < 10_000) {
    out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export interface TimeInput {
  start: Date;
  end: Date;
  resetTime: string;
  /** Free production hours granted at each daily reset (the bed/cart speed-up). */
  boostHoursPerReset: number;
  /** Save the last N natural bed hours for next season (0 = off). */
  saveBedHours: number;
  /** Leave the last N hours of Cart output unclaimed for next season (0 = off). */
  saveCartHours?: number;
}

export interface TimeSummary {
  realHours: number;
  realDays: number;
  resets: Date[];
  boostHours: number;
  /** Real hours plus boosts, less any Cart hours saved for next season: what the Cart gives this season. */
  productionHours: number;
  /** Cart hours held back for next season. */
  savedCartHours: number;
  cartSaveStart: Date | null;
  /** Natural bed hours held back for next season. */
  savedBedHours: number;
  saveStart: Date | null;
  /** Hours of character EXP that count this season. */
  xpHours: number;
}

export function summarizeTime(t: TimeInput): TimeSummary {
  const realHours = Math.max(0, (t.end.getTime() - t.start.getTime()) / HOUR_MS);
  const resets = resetsBetween(t.start, t.end, t.resetTime);
  const boostHours = resets.length * Math.max(0, t.boostHoursPerReset);
  const savedBedHours = Math.min(Math.max(0, t.saveBedHours), realHours);
  const savedCartHours = Math.min(Math.max(0, t.saveCartHours ?? 0), realHours);
  return {
    realHours,
    realDays: realHours / 24,
    resets,
    boostHours,
    productionHours: realHours - savedCartHours + boostHours,
    savedCartHours,
    cartSaveStart: savedCartHours > 0 ? new Date(t.end.getTime() - savedCartHours * HOUR_MS) : null,
    savedBedHours,
    saveStart: savedBedHours > 0 ? new Date(t.end.getTime() - savedBedHours * HOUR_MS) : null,
    // Boosts inside the save window can still be claimed without touching the saved bed EXP.
    xpHours: realHours - savedBedHours + boostHours,
  };
}
