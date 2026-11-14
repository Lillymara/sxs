// Home: what the site is, the player's own numbers at a glance, the season clock, and every tool.
import { Icon, type IconName } from "../components/Icon";
import { hrefOf } from "../components/Nav";
import type { PlannerResult } from "../lib/planner/plan";
import { formatDuration, type CalcOutcome } from "../lib/xp";
import { CHANGES } from "./tools/ChangesPage";

const ART = `${import.meta.env.BASE_URL}art/companions/`;
/** Companions lined up in the hero. */
const HERO = ["figure_10503", "figure_10608", "figure_10702", "figure_10507"];
const fmt = (x: number) => Math.round(x).toLocaleString();

export interface HomeTile {
  id: string;
  label: string;
  icon: IconName;
  blurb: string;
}

interface Props {
  tiles: HomeTile[];
  level: string;
  outcome: CalcOutcome | undefined;
  plan: PlannerResult | null;
  server: { name: string; season: number; seasonEnds: Date | null; dayOfSeason: number; seasonDays: number | null } | null;
  now: Date;
}

export function HomePage({ tiles, level, outcome, plan, server, now }: Props) {
  const next = outcome?.ok ? outcome.result : null;
  const latest = CHANGES[0];

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">Sword x Staff Tools</p>
          <h1>
            Plan your season. <span className="grad">Time every level.</span>
          </h1>
          <p className="lede">
            Season planner, level timer, server calendar and guides, all filled in from your game screenshots. Free, no ads, nothing to sign up
            for.
          </p>
          <div className="hero-actions">
            <a className="spin-button" href={hrefOf("planner")}>
              Open the Season Planner
            </a>
            <a className="hero-link" href={hrefOf("timer")}>
              Level Timer →
            </a>
          </div>
        </div>
        <div className="hero-art" aria-hidden>
          {HERO.map((f) => (
            <img key={f} src={`${ART}${f}.webp`} alt="" loading="lazy" />
          ))}
        </div>
      </section>

      <div className="home-grid">
        <section className="card glance">
          <h2 className="card-title">
            <Icon name="star" /> At a glance
          </h2>
          {next ? (
            <ul className="glance-list">
              <li>
                <span>Level</span>
                <b>{level}</b>
              </li>
              <li>
                <span>Next level</span>
                <b>{next.hoursToNext > 0 ? `in ${formatDuration(next.hoursToNext)}` : "ready"}</b>
              </li>
              <li className="glance-bar">
                <span className="bar">
                  <span style={{ width: `${Math.round(Math.min(1, next.progress) * 100)}%` }} />
                </span>
                <small>{Math.round(Math.min(1, next.progress) * 100)}% through Lv {level}</small>
              </li>
              {plan && (
                <li>
                  <span>Primostars by season end</span>
                  <b>
                    {fmt(plan.score.projectedTotal)}
                    {plan.score.goal > 0 && <small> / {fmt(plan.score.goal)} goal</small>}
                  </b>
                </li>
              )}
            </ul>
          ) : (
            <div className="glance-empty">
              <p>Your level, next level-up and Primostars appear here once you've entered them.</p>
              <a className="fill-btn" href={hrefOf("timer")}>
                <Icon name="camera" size={16} /> Fill from screenshots
              </a>
            </div>
          )}
        </section>

        <section className="card season-clock">
          <h2 className="card-title">
            <Icon name="calendar" /> Season clock
          </h2>
          {server?.seasonEnds ? (
            <>
              <p className="clock-name">
                {server.name || "Your server"} · Season {server.season}
              </p>
              <p className="clock-big">{formatDuration(Math.max(0, (server.seasonEnds.getTime() - now.getTime()) / 3_600_000))}</p>
              <p className="hint">
                left · ends {server.seasonEnds.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
              {server.seasonDays && (
                <span className="bar">
                  <span style={{ width: `${Math.round(Math.min(1, server.dayOfSeason / server.seasonDays) * 100)}%` }} />
                </span>
              )}
              <a className="hero-link" href={hrefOf("prep")}>
                Getting ready for next season →
              </a>
            </>
          ) : (
            <div className="glance-empty">
              <p>Pick your server to see how long the season has left, and your reset time.</p>
              <a className="fill-btn" href={hrefOf("calendar")}>
                Pick your server
              </a>
            </div>
          )}
        </section>

        <section className="card whats-new">
          <h2 className="card-title">
            <Icon name="changes" /> What's new
          </h2>
          <ul>
            {latest.items.slice(0, 3).map((it) => (
              <li key={it.text}>{it.href ? <a href={it.href}>{it.text}</a> : it.text}</li>
            ))}
          </ul>
          <a className="hero-link" href={hrefOf("changes")}>
            All changes →
          </a>
        </section>
      </div>

      <h2 className="home-heading">Tools</h2>
      <div className="tile-grid">
        {tiles.map((t) => (
          <a key={t.id} className="tile" href={hrefOf(t.id)}>
            <span className="tile-icon">
              <Icon name={t.icon} size={22} />
            </span>
            <span className="tile-text">
              <b>{t.label}</b>
              <small>{t.blurb}</small>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
