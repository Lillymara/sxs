// Next-season prep: what to do as a season ends, timed from the saved server's season end.
import { seasonStatus } from "../../lib/calendar";
import { effectiveDay1 } from "../calendar/server";
import type { ToolProps } from "./props";

const HOUR = 3_600_000;
/** Exact time in the saved server timezone (device zone when none is set), with the zone name. */
const when = (d: Date, timeZone?: string) =>
  d.toLocaleString(undefined, { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const left = (d: Date, now: Date) => {
  const h = (d.getTime() - now.getTime()) / HOUR;
  if (h <= 0) return "passed";
  return h >= 48 ? `in ${Math.floor(h / 24)} days` : `in ${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
};

/** What to do before a season ends, in order. Each item is advice players have confirmed in game. */
const STEPS: { title: string; body: string; hoursBefore?: number; link?: { href: string; label: string } }[] = [
  {
    title: "Aim for an Astral Pact tier",
    body: "Your season levels turn into Primostars when the season ends, and the Astral Pact's permanent bonuses unlock at set Primostar totals. Check which tier you'll land on and whether a little more gets you to the next one.",
    link: { href: "/planner", label: "Season Planner → See all bonuses" },
  },
  {
    title: "Finish your upgrades",
    body: "Season levels are scored at the end of the season, so an upgrade only counts if it's done before then. Use the planner to see what your materials can still reach.",
    link: { href: "/planner", label: "Season Planner → Plan my goal" },
  },
  {
    title: "Stop claiming the bed",
    body: "In the last 36 hours, leave the bed unclaimed. The EXP it builds up carries into next season, a head start on day one.",
    hoursBefore: 36,
  },
  {
    title: "Stop claiming the Cart",
    body: "Do the same with the Cart for the last 36 hours: its resources carry into next season, ready for the new upgrades.",
    hoursBefore: 36,
  },
];

/** Launch-day order, from eog.gg's Season 2 prep guide. */
const LAUNCH: { title: string; body: string }[] = [
  { title: "Claim your Seasonal Rewards", body: "Collect what Season 1 earned you as soon as you log in." },
  { title: "Spend every Primostar in the Astral Pact", body: "Your season levels have just turned into Primostars. Put them all into the Astral Pact's permanent bonuses." },
  { title: "Progress before you speed up", body: "Push as far as you can on normal progress first: it's free EXP. Keep Speed-Ups and Temporal Crystals for when you actually stall." },
  { title: "Do your Relic pulls", body: "Don't let launch day end without them." },
];

/** Season 2 levels worth spending Speed-Ups to reach, from the same guide. */
const MILESTONES: { level: number; unlocks: string }[] = [
  { level: 106, unlocks: "Tier 4, your next power tier" },
  { level: 108, unlocks: "Your Fantomon grows into its Adult form" },
  { level: 116, unlocks: "The Tower opens (Gem drops)" },
  { level: 130, unlocks: "Second dungeon, with the first seasonal gear drops" },
];

const SOURCE = "https://eog.gg/games/sword-x-staff/guides/season-2-prep/";

export function PrepPage({ choice, now }: ToolProps) {
  const day1 = effectiveDay1(choice);
  const status = day1 ? seasonStatus(day1, now) : null;
  const end = status?.seasonEnds ?? null;
  const tz = choice.timezone || undefined;

  return (
    <div className="tool prep">
      <section className="card">
        {end ? (
          <>
            <p className="eyebrow">
              {choice.name || "Your server"} · Season {status!.season.number}
            </p>
            <p className="prep-end">
              Season ends <b>{when(end, tz)}</b> <span className="hint">({left(end, now)})</span>
            </p>
            <ol className="prep-timeline">
              {STEPS.filter((s) => s.hoursBefore).map((s) => {
                const at = new Date(end.getTime() - s.hoursBefore! * HOUR);
                return (
                  <li key={s.title}>
                    <b>{when(at, tz)}</b> <span className="hint">({left(at, now)})</span> · {s.title}
                  </li>
                );
              })}
              <li>
                <b>{when(end, tz)}</b> · Season ends: levels turn into Primostars
              </li>
            </ol>
          </>
        ) : (
          <p className="hint">
            <a href="/calendar">Pick your server</a> to see your season's end date and when to stop claiming the bed and the Cart.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="subhead">Before the season ends</h2>
        <ol className="dawn-uses">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="dawn-rank" aria-hidden>
                {i + 1}
              </span>
              <div>
                <div className="dawn-title">
                  <h3>{s.title}</h3>
                  {s.hoursBefore && <span className="chip">Last {s.hoursBefore}h</span>}
                </div>
                <p className="deal-verdict">{s.body}</p>
                {s.hoursBefore && end && (() => {
                  const at = new Date(end.getTime() - s.hoursBefore * HOUR);
                  return (
                    <p className="hint">
                      {choice.name || "Your server"}: last claim before <b>{when(at, tz)}</b> ({left(at, now)}), then leave it until the season ends <b>{when(end, tz)}</b>.
                    </p>
                  );
                })()}
                {s.link && (
                  <p className="hint deal-link">
                    <a href={s.link.href}>{s.link.label} →</a>
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="hint">The Season Planner's "Save bed EXP" and "Save Cart resources" options (on by default) already leave those last 36 hours out.</p>
      </section>

      <section className="card">
        <h2 className="subhead">When Season 2 starts</h2>
        <p className="hint">
          {end ? (
            <>
              {choice.name || "Your server"}: <b>{when(end, tz)}</b>. Work through these in order on your first login.
            </>
          ) : (
            "Work through these in order on your first login."
          )}
        </p>
        <ol className="dawn-uses">
          {LAUNCH.map((s, i) => (
            <li key={s.title}>
              <span className="dawn-rank" aria-hidden>
                {i + 1}
              </span>
              <div>
                <div className="dawn-title">
                  <h3>{s.title}</h3>
                </div>
                <p className="deal-verdict">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2 className="subhead">When to spend Speed-Ups</h2>
        <p className="hint">
          Once you stall, spend Speed-Ups and Temporal Crystals only to cross a level that unlocks something.
        </p>
        <div className="table-wrap flat">
          <table>
            <thead>
              <tr>
                <th>Level</th>
                <th>Unlocks</th>
              </tr>
            </thead>
            <tbody>
              {MILESTONES.map((m) => (
                <tr key={m.level}>
                  <td>
                    <b>Lv. {m.level}</b>
                  </td>
                  <td>{m.unlocks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Or hold all of them until the end of the season: if you're chasing extra Primostars, cashing them in after every new statue is unlocked gets the most
          EXP out of each one.
        </p>
        <p className="hint">
          Launch-day order and milestones from{" "}
          <a href={SOURCE} target="_blank" rel="noreferrer">
            eog.gg's Season 2 prep guide
          </a>
          .
        </p>
      </section>
    </div>
  );
}
