// Servers players add themselves, for ones the community roster doesn't have yet.
// Saved only in this browser. Once the roster has the same server, the roster's entry wins.

import { useCallback, useSyncExternalStore } from "react";
import type { Server } from "./calendar";

const KEY = "sxs.customServers";
const EVENT = "sxs-custom-servers";
export const CUSTOM_PREFIX = "custom-";

const nameKey = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Validates whatever is in storage; anything malformed is dropped rather than breaking the page. */
export function parseCustomServers(raw: string | null): Server[] {
  try {
    const list: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(list)) return [];
    return list.flatMap((x) => {
      if (!x || typeof x !== "object") return [];
      const { id, name, opened, nexus, number } = x as Record<string, unknown>;
      if (typeof id !== "string" || !id.startsWith(CUSTOM_PREFIX) || typeof name !== "string" || !name.trim()) return [];
      return [{
        id,
        name: name.trim(),
        opened: typeof opened === "string" && /^\d{4}-\d{2}-\d{2}$/.test(opened) ? opened : "",
        nexus: typeof nexus === "string" && /^\d{5}$/.test(nexus) ? nexus : "",
        number: typeof number === "number" && Number.isInteger(number) && number > 0 ? number : 0,
        merges: [[], [], [], []],
        custom: true,
      } satisfies Server];
    });
  } catch {
    return [];
  }
}

export function makeCustomServer(fields: { name: string; opened: string; nexus?: string; number?: number }, now = Date.now()): Server {
  return parseCustomServers(JSON.stringify([{ ...fields, id: `${CUSTOM_PREFIX}${now.toString(36)}` }]))[0];
}

/** The roster's entry for a custom server, matched by Nexus and number, or by name. */
export function rosterMatch(roster: Server[], custom: Pick<Server, "name" | "nexus" | "number">): Server | undefined {
  return (
    (custom.nexus && custom.number ? roster.find((s) => s.nexus === custom.nexus && s.number === custom.number) : undefined) ??
    roster.find((s) => nameKey(s.name) === nameKey(custom.name))
  );
}

/** Roster plus the custom servers the roster hasn't caught up with yet. */
export const withCustom = (roster: Server[], custom: Server[]) => [...roster, ...custom.filter((c) => !rosterMatch(roster, c))];

// ---- Storage, shared live between every picker on the page and other tabs ----

let cache: { raw: string | null; list: Server[] } = { raw: null, list: [] };

function read(): Server[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage blocked: behave as if nothing was saved.
  }
  if (raw !== cache.raw) cache = { raw, list: parseCustomServers(raw) };
  return cache.list;
}

function write(list: Server[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.map(({ id, name, opened, nexus, number }) => ({ id, name, opened, nexus, number }))));
  } catch {
    // Can't save (private mode or full storage); the server just won't persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const empty: Server[] = [];

export function useCustomServers() {
  const list = useSyncExternalStore(subscribe, read, () => empty);
  const add = useCallback((server: Server) => write([...read(), server]), []);
  const update = useCallback((id: string, patch: Partial<Pick<Server, "name" | "opened">>) => write(read().map((s) => (s.id === id ? { ...s, ...patch } : s))), []);
  const remove = useCallback((id: string) => write(read().filter((s) => s.id !== id)), []);
  return { list, add, update, remove };
}
