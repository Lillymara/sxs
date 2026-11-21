import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import serverRows from "../data/servers.json";
import { loadServers, searchServers, type Server } from "../lib/calendar";
import { CUSTOM_PREFIX, makeCustomServer, rosterMatch, useCustomServers, withCustom } from "../lib/customServers";
import type { ServerChoice } from "../pages/calendar/server";

/** Where the roster comes from (scripts/sync-servers.mjs pulls it); credited under the search box. */
const ROSTER_SHEET_URL = "https://docs.google.com/spreadsheets/d/1uZqmE-71qg2JbEEeBKQXppDToqo4UwQ1zdMFs75UyrU/htmlview#gid=730102442";

export const SERVERS = loadServers(serverRows as Parameters<typeof loadServers>[0]);

/** The community roster plus servers added in this browser. */
export function useServers() {
  const custom = useCustomServers();
  const servers = useMemo(() => withCustom(SERVERS, custom.list), [custom.list]);
  return { servers, custom };
}

/** The picked server; a custom pick the roster has since caught up with resolves to the roster's entry. */
export function findServer(servers: Server[], choice: ServerChoice, customList: Server[] = []): Server | null {
  if (!choice.serverId) return null;
  const found = servers.find((s) => s.id === choice.serverId);
  if (found || !choice.serverId.startsWith(CUSTOM_PREFIX)) return found ?? null;
  const saved = customList.find((s) => s.id === choice.serverId) ?? { name: choice.name, nexus: "", number: 0 };
  return rosterMatch(SERVERS, saved) ?? null;
}

const where = (s: Server) => (s.nexus ? `Nexus ${s.nexus}${s.number ? ` #${s.number}` : ""}` : "");

/** Typo-tolerant search over the server roster; picking one sets the saved server. Players can add missing servers. */
export function ServerSearch({ choice, onChange, className = "" }: { choice: ServerChoice; onChange: (c: ServerChoice) => void; className?: string }) {
  const { servers, custom } = useServers();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<{ name: string; opened: string; nexus: string; number: string } | null>(null);
  const listId = useId();
  const formId = useId();
  const matches = useMemo(() => searchServers(servers, query), [servers, query]);
  const exact = matches.some((s) => s.name.toLowerCase() === query.trim().toLowerCase());
  const picked = findServer(servers, choice, custom.list);

  // A server added here that has since reached the roster: switch the saved pick to the roster's entry.
  useEffect(() => {
    if (picked && !picked.custom && choice.serverId.startsWith(CUSTOM_PREFIX)) {
      onChange({ ...choice, serverId: picked.id, name: picked.name, day1: picked.opened || choice.day1 });
    }
  }, [picked, choice, onChange]);

  // And forget saved servers the roster now has, once nothing points at them.
  useEffect(() => {
    for (const c of custom.list) if (c.id !== choice.serverId && rosterMatch(SERVERS, c)) custom.remove(c.id);
  }, [custom, choice.serverId]);

  const pick = (s: Server) => {
    onChange({ ...choice, serverId: s.id, name: s.name, day1: s.opened, offset: 0 });
    setQuery("");
    setOpen(false);
  };

  const startAdding = () => {
    setAdding({ name: query.trim(), opened: choice.serverId ? "" : choice.day1, nexus: "", number: "" });
    setQuery("");
    setOpen(false);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!adding?.name.trim()) return;
    const server = makeCustomServer({ name: adding.name, opened: adding.opened, nexus: adding.nexus.trim(), number: Number(adding.number) || 0 });
    const existing = rosterMatch(SERVERS, server);
    if (existing) pick(existing);
    else {
      custom.add(server);
      pick(server);
    }
    setAdding(null);
  };

  const remove = (s: Server) => {
    custom.remove(s.id);
    // Keep the dates the player set, just no longer tied to a saved server.
    if (choice.serverId === s.id) onChange({ ...choice, serverId: "" });
  };

  return (
    <div className={`field search ${className}`}>
      <span>Find your server</span>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter") matches[0] ? pick(matches[0]) : query.trim() && startAdding();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={choice.name ? choice.name : "Start typing a server name"}
        role="combobox"
        aria-expanded={open && !!query}
        aria-controls={listId}
        aria-label="Find your server"
      />
      {open && query && (
        <ul className="search-results" id={listId} role="listbox">
          {matches.map((s) => (
            <li key={s.id} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}>
                <b>{s.name}</b>
                <small>
                  {[s.opened ? `Opened ${s.opened}` : "Opening date unknown", where(s), s.custom ? "Added by you" : ""].filter(Boolean).join(" · ")}
                </small>
              </button>
            </li>
          ))}
          {!exact && (
            <li role="option" aria-selected={false}>
              <button type="button" className="add-server" onMouseDown={(e) => e.preventDefault()} onClick={startAdding}>
                <b>+ Add “{query.trim()}” as a new server</b>
                <small>{matches.length ? "Not listed? " : "Not in the roster yet? "}Saved only in this browser.</small>
              </button>
            </li>
          )}
        </ul>
      )}

      {adding && (
        <form className="add-server-form" id={formId} onSubmit={save} aria-label="Add a server">
          <label className="field">
            <span>Server name</span>
            <input value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} required autoFocus />
          </label>
          <label className="field">
            <span>Day 1 (opening date)</span>
            <input type="date" value={adding.opened} onChange={(e) => setAdding({ ...adding, opened: e.target.value })} />
          </label>
          <label className="field">
            <span>Nexus <em>(optional)</em></span>
            <input inputMode="numeric" pattern="\d{5}" placeholder="70048" value={adding.nexus} onChange={(e) => setAdding({ ...adding, nexus: e.target.value.replace(/\D/g, "").slice(0, 5) })} />
          </label>
          <label className="field">
            <span>Server # <em>(optional)</em></span>
            <input type="number" min={1} max={99} placeholder="1" value={adding.number} onChange={(e) => setAdding({ ...adding, number: e.target.value })} />
          </label>
          <small className="span-all">Saved only in this browser. When the community roster adds this server, it switches over on its own.</small>
          <div className="add-server-actions span-all">
            <button type="submit" className="secondary">Save server</button>
            <button type="button" className="link-button" onClick={() => setAdding(null)}>Cancel</button>
          </div>
        </form>
      )}

      {picked?.custom && !adding && (
        <small>
          {picked.name} is saved only in this browser.{" "}
          <button type="button" className="link-button" onClick={() => remove(picked)}>Remove it</button>
        </small>
      )}
      <small>
        {SERVERS.length} servers, from the community's{" "}
        <a href={ROSTER_SHEET_URL} target="_blank" rel="noreferrer">
          SxS All In One Database
        </a>{" "}
        sheet. Thanks to everyone who keeps it up to date.
        {servers.length > SERVERS.length && ` Plus ${servers.length - SERVERS.length} you added.`}
      </small>
    </div>
  );
}
