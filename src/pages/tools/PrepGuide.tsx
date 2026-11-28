// One Season Prep guide (an island opening, a season change), all laid out the same way:
// a summary of the key times, the one rule to remember, then "Before…" / "When…" phases of short, tagged steps.
import type { ReactNode } from "react";
import { formatLocale, unitText } from "../../i18n/format";
import { useT } from "../../i18n";
import type { MessageKey } from "../../i18n/en";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;
type Tn = (key: string, n: number, vars?: Record<string, string | number>) => string;

const HOUR = 3_600_000;
/** Exact time in the saved server timezone (device zone when none is set), with the zone name. */
export const when = (d: Date, timeZone?: string) =>
  d.toLocaleString(formatLocale(), { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
export const left = (d: Date, now: Date, t: T, tn: Tn) => {
  const h = (d.getTime() - now.getTime()) / HOUR;
  if (h <= 0) return t("pr.passed");
  return h >= 48 ? tn("pr.inDays", Math.floor(h / 24)) : t("pr.inTime", { time: `${unitText("h", Math.floor(h))} ${unitText("m", Math.round((h % 1) * 60))}` });
};
export const hoursBefore = (d: Date, h: number) => new Date(d.getTime() - h * HOUR);

/** What a guide needs to know about the reader's server. */
export interface GuideContext {
  /** Server name, or "Your server". */
  name: string;
  tz: string | undefined;
  now: Date;
  t: T;
  tn: Tn;
}

export interface GuideStep {
  title: string;
  /** When or where this step happens: "Last 36h", "First run". */
  tag: string;
  /** Short instructions, one action each. */
  items: ReactNode[];
  /** The exact window for this server, when the step is timed. */
  timed?: ReactNode;
  link?: { href: string; label: string };
}

export interface GuidePhase {
  title: string;
  /** Exact time this phase is due, for the heading. */
  at?: Date | null;
  note?: ReactNode;
  steps?: GuideStep[];
  /** Anything that isn't a step list, such as a table. */
  extra?: ReactNode;
  foot?: ReactNode;
}

export interface Guide {
  /** The moment the guide is built around, for this server. */
  at: Date | null;
  /** "Aqualis opens", "Season 1 ends". */
  event: string;
  /** The same, once it has happened: "Aqualis opened". */
  eventPast: string;
  /** Shown when no server is picked. */
  pickHint: string;
  /** Times leading up to the event, in order. A timeline entry without `at` shows `when` text instead. */
  timeline: { at?: Date; whenText?: string; label: string }[];
  rule: { icon: string; title: string; text: ReactNode };
  phases: GuidePhase[];
}

export function PrepGuide({ guide, ctx }: { guide: Guide; ctx: GuideContext }) {
  const { at, event } = guide;
  const { tz, now } = ctx;
  const { t, tn } = useT();
  return (
    <>
      <section className="card">
        {at ? (
          <>
            <p className="eyebrow">{ctx.name}</p>
            <p className="prep-end">
              {at > now ? event : guide.eventPast} <b>{when(at, tz)}</b> {at > now && <span className="hint">({left(at, now, t, tn)})</span>}
            </p>
            <ol className="prep-timeline">
              {guide.timeline.map((e) => (
                <li key={e.label}>
                  <b>{e.at ? when(e.at, tz) : e.whenText}</b>
                  {e.at && e.at > now && <span className="hint"> ({left(e.at, now, t, tn)})</span>} · {e.label}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="hint">{guide.pickHint}</p>
        )}
      </section>

      <div className="pulls-reminder">
        <span aria-hidden>{guide.rule.icon}</span>
        <div>
          <h3>{guide.rule.title}</h3>
          <p style={{ fontStyle: "normal" }}>{guide.rule.text}</p>
        </div>
      </div>

      {guide.phases.map((p) => (
        <section key={p.title} className="card">
          <div className="prep-phase">
            <h2 className="subhead">{p.title}</h2>
            {p.at && <span className="hint">{when(p.at, tz)}</span>}
          </div>
          {p.note && <p className="hint">{p.note}</p>}
          {p.steps && (
            <ol className="dawn-uses">
              {p.steps.map((s, i) => (
                <li key={s.title}>
                  <span className="dawn-rank" aria-hidden>
                    {i + 1}
                  </span>
                  <div>
                    <div className="dawn-title">
                      <h3>{s.title}</h3>
                      <span className="chip">{s.tag}</span>
                    </div>
                    <ul>
                      {s.items.map((it, j) => (
                        <li key={j}>{it}</li>
                      ))}
                    </ul>
                    {s.timed && <p className="hint prep-timed">{s.timed}</p>}
                    {s.link && (
                      <p className="hint deal-link">
                        <a href={s.link.href}>{s.link.label} →</a>
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {p.extra}
          {p.foot && <p className="hint">{p.foot}</p>}
        </section>
      ))}
    </>
  );
}
