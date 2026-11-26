import { useMemo, useState } from "react";
import { RESET_UTC_HOUR, type EventType } from "../../data/calendar";
import { findServer, ServerSearch, useServers } from "../../components/ServerSearch";
import { buildEntries, dungeonDifficulties, seasonStatus, type Entry } from "../../lib/calendar";
import { effectiveDay1, type ServerChoice } from "./server";
import { countdown, localTime, serverClockTime, serverZoneLabel, unlockStatus, type Unlock } from "../../lib/unlockTime";
import { rich, useT } from "../../i18n";
import type { MessageKey } from "../../i18n/en";


const FILTERS: (EventType | "all")[] = ["all", "season", "dungeon", "feature", "weekly", "global"];
const ICONS: Record<EventType, string> = { season: "🏁", dungeon: "⚔️", weekly: "🎁", feature: "✦", global: "✨" };

interface Props {
  choice: ServerChoice;
  onChange: (c: ServerChoice) => void;
  now: Date;
}

function zones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC", "America/Los_Angeles", "America/New_York", "Europe/London", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];
  }
}
const deviceZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

type T = ReturnType<typeof useT>;

export function CalendarPage({ choice, onChange, now }: Props) {
  const i18n = useT();
  const { t, tn, locale } = i18n;
  const [filter, setFilter] = useState<EventType | "all">("all");
  const [full, setFull] = useState(false);
  const tz = choice.timezone || deviceZone();

  const { servers, custom } = useServers();
  const server = findServer(servers, choice, custom.list);
  const day1 = effectiveDay1(choice);
  const status = day1 ? seasonStatus(day1, now) : null;
  const day1Time = day1?.getTime();
  const entries = useMemo(() => (day1Time !== undefined ? buildEntries(new Date(day1Time), server) : []), [day1Time, server]);

  const fmtDate = (d: Date, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" }) =>
    new Intl.DateTimeFormat(locale, { timeZone: tz, ...opts }).format(d);
  const dateKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const resetLocal = new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 13)),
  );
  const daysUntil = (d: Date) => Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  const relative = (days: number) => (days <= 0 ? t("cal.today") : days === 1 ? t("cal.tomorrow") : tn("cal.inDays", days));

  // Timeline: group by local date, limited to a week back and 100 days ahead unless "full".
  const today = status?.day ?? 0;
  const visible = entries.filter(
    (e) => (filter === "all" || e.type === filter) && (full || (e.serverDay >= today - 7 && e.serverDay <= today + 100)),
  );
  const groups = new Map<string, { date: Date; day: number; events: Entry[] }>();
  for (const e of visible) {
    const key = dateKey(e.date);
    if (!groups.has(key)) groups.set(key, { date: e.date, day: e.serverDay, events: [] });
    groups.get(key)!.events.push(e);
  }
  const todayKey = dateKey(now);
  // Always mark today so the timeline has an anchor, even with no events.
  if (status && status.day > 0 && !groups.has(todayKey)) groups.set(todayKey, { date: now, day: status.day, events: [] });
  const ordered = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  // Next thing that hasn't unlocked yet (everything unlocks at reset, not midnight).
  const next = entries.find((e) => e.date.getTime() > now.getTime());
  const nextUnlock = next ? unlockStatus(next.date, now, null, choice.timezone) : null;
  const todayReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), RESET_UTC_HOUR));

  return (
    <div className="calendar">
      <section className="card" aria-labelledby="server-heading">
        <div className="card-head">
          <h2 id="server-heading">{t("cal.yourServer")}</h2>
          {server?.nexus ? (
            <span className="chip">{t("cal.nexus", { nexus: server.nexus })}{server.number ? ` · #${server.number}` : ""}</span>
          ) : server?.custom ? (
            <span className="chip">{t("cal.addedByYou")}</span>
          ) : null}
        </div>
        <div className="fields">
          <ServerSearch choice={choice} onChange={onChange} className="span-2" />

          <label className="field">
            <span>{t("cal.day1")}</span>
            <input
              type="date"
              value={choice.day1}
              onChange={(e) => {
                const day1 = e.target.value;
                // A server added in this browser keeps its pick; the new date is saved with it.
                if (server?.custom) {
                  custom.update(server.id, { opened: day1 });
                  onChange({ ...choice, day1 });
                } else {
                  onChange({ ...choice, day1, serverId: server && day1 === server.opened ? server.id : "", name: server && day1 === server.opened ? server.name : choice.name });
                }
              }}
            />
            <small>
              {server?.custom
                ? t("cal.day1Saved")
                : server
                  ? server.opened
                    ? t("cal.day1Roster")
                    : t("cal.day1NotInRoster")
                  : t("cal.day1Custom")}
            </small>
          </label>

          <div className="field">
            <span>{t("cal.adjust")}</span>
            <div className="stepper">
              <button type="button" onClick={() => onChange({ ...choice, offset: Math.max(-30, choice.offset - 1) })} aria-label={t("cal.earlier")}>−</button>
              <output>{tn("cal.offsetDays", Math.abs(choice.offset), { n: `${choice.offset > 0 ? "+" : choice.offset < 0 ? "−" : ""}${Math.abs(choice.offset)}` })}</output>
              <button type="button" onClick={() => onChange({ ...choice, offset: Math.min(30, choice.offset + 1) })} aria-label={t("cal.later")}>+</button>
            </div>
            <small>{t("cal.adjustHint")}</small>
          </div>

          <label className="field span-2">
            <span>{t("cal.timezone")}</span>
            <select value={choice.timezone} onChange={(e) => onChange({ ...choice, timezone: e.target.value })}>
              <option value="">{t("cal.deviceZone", { zone: deviceZone() })}</option>
              {zones().map((z) => (
                <option key={z} value={z}>{z.replaceAll("_", " ")}</option>
              ))}
            </select>
            <small>{t("cal.resetHint", { time: resetLocal })}</small>
          </label>
        </div>
      </section>

      {status && day1 ? (
        <>
          <section className="status-grid" aria-label={t("cal.status")}>
            <div className="card status-tile">
              <p className="eyebrow">{choice.name || t("cal.yourServer")}</p>
              <p className="tile-big">{status.day > 0 ? t("cal.dayN", { n: status.day }) : t("cal.notOpen")}</p>
              <p className="eta">{t("cal.day1Date", { date: fmtDate(day1, { month: "short", day: "numeric", year: "numeric" }) })}</p>
            </div>
            <div className="card status-tile">
              <p className="eyebrow">{t("cal.season")}</p>
              <p className="tile-big">S{status.season.number}</p>
              <p className="eta">{t("cal.seasonDay", { name: status.season.name, n: status.dayOfSeason })}</p>
            </div>
            <div className="card status-tile">
              <p className="eyebrow">{t("cal.seasonEnds")}</p>
              <p className="tile-big small">{status.seasonEnds ? fmtDate(status.seasonEnds, { month: "short", day: "numeric" }) : t("cal.notConfirmed")}</p>
              <p className="eta">
                {status.seasonEnds && status.nextSeason
                  ? t("cal.startsAt", { n: status.nextSeason.number, when: relative(daysUntil(status.seasonEnds)), time: localTime(status.seasonEnds, choice.timezone) })
                  : t("cal.noLater")}
              </p>
            </div>
            <div className="card status-tile">
              <p className="eyebrow">{t("cal.nextUp")}</p>
              <p className="tile-big small">
                {!nextUnlock ? "—" : nextUnlock.state === "soon" ? t("cal.inTime", { time: countdown(nextUnlock.ms) }) : nextUnlock.days <= 1 ? t("when.tomorrow") : tn("when.inDays", nextUnlock.days)}
              </p>
              <p className="eta">{next ? t("cal.nextEta", { day: next.serverDay, title: next.title, time: localTime(next.date, choice.timezone) }) : ""}</p>
            </div>
          </section>

          <section className="card">
            <div className="card-head wrap">
              <h2>{t("cal.timeline")}</h2>
              <div className="filter-row" role="group" aria-label={t("cal.filter")}>
                {FILTERS.map((f) => (
                  <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                    {t(`cal.f.${f}` as MessageKey)}
                  </button>
                ))}
                <button type="button" className="range" aria-pressed={full} onClick={() => setFull(!full)}>
                  {full ? t("cal.full") : t("cal.range")}
                </button>
              </div>
            </div>
            <p className="hint reset-note">
              {rich(t("cal.resetNote", { local: localTime(todayReset, choice.timezone), server: serverClockTime(), zone: serverZoneLabel() }))}
            </p>

            {groups.size === 0 ? (
              <p className="hint">{t("cal.noMatch")}</p>
            ) : (
              <ol className="timeline">
                {ordered.map(([key, g]) => (
                  <li key={key} className={key === todayKey ? "today" : key < todayKey ? "past" : undefined}>
                    <h3>
                      <span>{t("cal.dayN", { n: g.day })}</span> {fmtDate(g.date)}
                      {key === todayKey && <em>{t("cal.todayTag")}</em>}
                    </h3>
                    {g.events.length === 0 && <p className="event-meta">{t("cal.noEvents")}</p>}
                    {g.events.map((e, i) => (
                      <EventCard key={i} e={e} serverName={choice.name} fmtDate={fmtDate} when={unlockStatus(e.date, now, e.end, choice.timezone)} i18n={i18n} />
                    ))}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : (
        <section className="card results empty">
          <p>{t("cal.empty")}</p>
        </section>
      )}
    </div>
  );
}

function EventCard({ e, serverName, fmtDate, when, i18n }: { e: Entry; serverName: string; fmtDate: (d: Date, o?: Intl.DateTimeFormatOptions) => string; when: Unlock; i18n: T }) {
  const { t, tn } = i18n;
  const difficulties = e.type === "dungeon" ? dungeonDifficulties(e.meta) : [];
  const meta = e.type === "dungeon" ? tn("cal.dungeonRelease", difficulties.length) : e.meta;
  // A tag from the event data (e.g. "Outfit pack") stays as written; the built-in kinds are translated.
  const tag = e.major ? t("cal.tag.major") : e.tag ?? t(`cal.tag.${e.type}` as MessageKey);
  const whenAt = t("cal.whenAt", { local: when.localAt, server: serverClockTime() });
  return (
    <article className={`event event-${e.type}${e.major ? " major" : ""}`}>
      <header>
        <span className="event-icon" aria-hidden>{ICONS[e.type]}</span>
        <div>
          <p className="event-tag">{tag}</p>
          <p className="event-title">{e.title}</p>
          <p className="event-meta">
            {meta}
            {e.end && <> · {t("cal.through", { date: fmtDate(e.end, { month: "short", day: "numeric" }) })}</>}
          </p>
          {when.state !== "past" && (
            <p className={`event-when ${when.state}`}>
              <b>{when.state === "later" ? t("cal.atReset") : when.state === "live" ? t("when.liveNow") : t("when.unlocksIn", { time: countdown(when.ms) })}</b>
              <span>{when.state === "live" ? t("cal.sinceReset", { time: when.localAt }) : whenAt}</span>
            </p>
          )}
        </div>
      </header>
      {e.mergeServers?.length ? (
        <div className="event-body">
          <p className="event-label">{serverName ? t("cal.joiningWith", { nexus: e.nexus ?? "", server: serverName }) : t("cal.joining", { nexus: e.nexus ?? "" })}</p>
          <div className="chips">{e.mergeServers.map((s) => <span key={s} className="reward">{s}</span>)}</div>
        </div>
      ) : difficulties.length ? (
        <div className="event-body">
          <dl className="difficulties">
            {difficulties.map((d) => (
              <div key={d.name}>
                <dt>{d.name}</dt>
                <dd>{d.requirement}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : e.rewards?.length ? (
        <div className="event-body">
          <p className="event-label">{e.rewardLabel ?? t("cal.rewards")}</p>
          <div className="chips">
            {e.rewards.map((r) => {
              const m = /^(.*?)\s((?:×|≈).*)$/.exec(r);
              return (
                <span key={r} className="reward">
                  {m ? <>{m[1]} <b>{m[2]}</b></> : <b>{r}</b>}
                </span>
              );
            })}
          </div>
          {e.tasks?.length ? <div className="chips tasks">{e.tasks.map((t) => <span key={t}>{t}</span>)}</div> : null}
          {e.note && <p className="event-meta">{e.note}</p>}
        </div>
      ) : null}
    </article>
  );
}
