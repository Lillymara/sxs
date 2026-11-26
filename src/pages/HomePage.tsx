// Home: what the site is, the player's own season at a glance, what's coming up on their server, and every tool.
import type { ReactNode } from "react";
import { Icon, type IconName } from "../components/Icon";
import { GameIcon } from "../components/GameIcon";
import { ProgressRing } from "../components/ProgressRing";
import { hrefOf } from "../components/Nav";
import { RESET_UTC_HOUR } from "../data/calendar";
import { buildEntries } from "../lib/calendar";
import { countdown, daysAway, localTime, unlockStatus } from "../lib/unlockTime";
import { rich, useT } from "../i18n";
import type { MessageKey } from "../i18n/en";
import type { PlannerResult } from "../lib/planner/plan";
import { formatDuration, type CalcOutcome } from "../lib/xp";
import { CHANGES } from "./tools/ChangesPage";
import { DISCORD_URL } from "../data/site";
import { formatLocale } from "../i18n/format";

const BASE = import.meta.env.BASE_URL;
/** Companions lined up in the hero. */
const HERO = ["figure_10503", "figure_10608", "figure_10702", "figure_10507"];
const fmt = (x: number) => Math.round(x).toLocaleString(formatLocale());
const DAY = 86_400_000;

/** Game art for each tool tile: a GameIcon name, or a path under public/art. */
const TILE_ART: Record<string, string> = {
  timer: "character",
  planner: "primostar",
  loadouts: "skill",
  fantomons: "fantomons/pet_1622.webp",
  companions: "companions/icon_10503.webp",
  map: "items/item_742.png",
  spending: "items/Money_4.png",
  dawnium: "items/Money_2.png",
};

export interface HomeTile {
  id: string;
  label: string;
  icon: IconName;
  blurb: string;
  group: string;
}

interface Props {
  tiles: HomeTile[];
  level: string;
  outcome: CalcOutcome | undefined;
  plan: PlannerResult | null;
  server: {
    name: string;
    season: number;
    day1: Date;
    seasonEnds: Date | null;
    dayOfSeason: number;
    /** Display time zone from the calendar settings ("" = the device's). */
    timezone: string;
    seasonDays: number | null;
  } | null;
  now: Date;
}

/** Time until the next 13:00 UTC daily reset. */
function nextReset(now: Date) {
  const r = new Date(now);
  r.setUTCHours(RESET_UTC_HOUR, 0, 0, 0);
  if (r <= now) r.setTime(r.getTime() + DAY);
  return r;
}

type T = ReturnType<typeof useT>;
const shortDate = (d: Date, locale: string) => d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
/** "Unlocks in 2h 14m", "Live now", "Tomorrow, 5:00 AM PST": everything unlocks at reset, not midnight. */
function whenText(start: Date, end: Date | null, now: Date, timeZone: string, { t, tn }: T) {
  const u = unlockStatus(start, now, end, timeZone);
  if (u.state === "soon") return t("when.unlocksIn", { time: countdown(start.getTime() - now.getTime()) });
  if (u.state === "live") return t("when.liveNow");
  if (u.state === "past") return u.label;
  const days = daysAway(start, now, timeZone);
  return `${days <= 1 ? t("when.tomorrow") : tn("when.inDays", days)}, ${localTime(start, timeZone)}`;
}
/** The headline of a changelog line: the part before its first colon. */
const headline = (t: string) => (t.indexOf(":") > 0 && t.indexOf(":") < 70 ? t.slice(0, t.indexOf(":")) : t.length > 90 ? `${t.slice(0, 88)}…` : t);

function Stat({ href, ring, label, value, sub, empty, cta, center }: { href: string; ring: number | null; label: string; value: ReactNode; sub?: ReactNode; empty?: string; cta?: string; center?: ReactNode }) {
  if (ring === null)
    return (
      <a className="dash-cell empty" href={href}>
        <ProgressRing value={0} size={84} stroke={8}>
          <small>—</small>
        </ProgressRing>
        <span className="dash-text">
          <small>{label}</small>
          <span className="dash-empty">{empty}</span>
          <b className="dash-cta">{cta} →</b>
        </span>
      </a>
    );
  return (
    <a className="dash-cell" href={href}>
      <ProgressRing value={ring} size={84} stroke={8}>
        {center ?? <b className="dash-pct">{Math.round(ring * 100)}%</b>}
      </ProgressRing>
      <span className="dash-text">
        <small>{label}</small>
        <b className="dash-value">{value}</b>
        {sub && <span className="dash-sub">{sub}</span>}
      </span>
    </a>
  );
}

function TileArt({ id, icon }: { id: string; icon: IconName }) {
  const art = TILE_ART[id];
  if (!art) return <Icon name={icon} size={26} />;
  return art.includes("/") ? <img src={`${BASE}art/${art}`} alt="" loading="lazy" /> : <GameIcon name={art} />;
}

export function HomePage({ tiles, level, outcome, plan, server, now }: Props) {
  const i18n = useT();
  const { t, locale } = i18n;
  const next = outcome?.ok ? outcome.result : null;
  const reset = nextReset(now);
  const resetHours = (reset.getTime() - now.getTime()) / 3_600_000;
  const seasonLeft = server?.seasonEnds ? Math.max(0, (server.seasonEnds.getTime() - now.getTime()) / 3_600_000) : null;
  const upcoming = server
    ? buildEntries(server.day1, null)
        .filter((e) => (e.end ?? new Date(e.date.getTime() + DAY)) > now && e.date.getTime() - now.getTime() < 21 * DAY)
        .slice(0, 5)
    : [];
  const changes = CHANGES.slice(0, 2).flatMap((c) => c.items.map((it) => ({ ...it, date: c.date }))).slice(0, 5);
  const groups = [...new Set(tiles.map((t) => t.group))];

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">Sword x Staff Tools</p>
          <h1>
            {t("home.title1")} <span className="grad">{t("home.title2")}</span>
          </h1>
          <p className="lede">{t("home.lede")}</p>
          <div className="hero-actions">
            <a className="spin-button" href={hrefOf("planner")}>
              {t("home.openPlanner")}
            </a>
            <a className="hero-link" href={hrefOf("timer")}>
              {t("home.timerLink")}
            </a>
          </div>
        </div>
        <div className="hero-art" aria-hidden>
          {HERO.map((f) => (
            <img key={f} src={`${BASE}art/companions/${f}.webp`} alt="" loading="lazy" />
          ))}
        </div>
      </section>

      <section className="card dash" aria-label={t("home.yourSeason")}>
        <div className="dash-head">
          <h2 className="card-title">
            <Icon name="star" /> {t("home.yourSeason")}
          </h2>
          {server && (
            <span className="dash-server">
              {server.name || t("home.yourServer")} · {t("home.seasonN", { n: server.season })}
              {server.seasonDays ? ` · ${t("home.dayOf", { day: server.dayOfSeason, total: server.seasonDays })}` : ""}
            </span>
          )}
        </div>
        <div className="dash-grid">
          <Stat
            href={hrefOf("timer")}
            ring={next ? Math.min(1, next.progress) : null}
            label={level ? t("home.level", { level }) : t("home.levelPlain")}
            value={next ? (next.hoursToNext > 0 ? formatDuration(next.hoursToNext) : t("home.ready")) : null}
            sub={next ? t("home.toLv", { n: Number(level) + 1 }) : undefined}
            empty={t("home.levelEmpty")}
            cta={t("home.fillScreens")}
          />
          <Stat
            href={hrefOf("calendar")}
            ring={server?.seasonDays ? Math.min(1, server.dayOfSeason / server.seasonDays) : null}
            label={t("home.seasonLeft")}
            value={seasonLeft !== null ? formatDuration(seasonLeft) : null}
            sub={server?.seasonEnds ? t("home.ends", { date: shortDate(server.seasonEnds, locale) }) : undefined}
            empty={t("home.seasonLeftEmpty")}
            cta={t("home.pickServer")}
          />
          <Stat
            href={hrefOf("planner")}
            ring={plan && plan.score.goal > 0 ? Math.min(1, plan.score.projectedTotal / plan.score.goal) : null}
            label={t("home.primostars")}
            value={
              plan ? (
                <>
                  <GameIcon name="primostar" /> {fmt(plan.score.projectedTotal)}
                </>
              ) : null
            }
            sub={plan && plan.score.goal > 0 ? t("home.ofGoal", { goal: fmt(plan.score.goal) }) : undefined}
            empty={t("home.primostarsEmpty")}
            cta={t("home.setGoal")}
          />
          <Stat
            href={hrefOf("calendar")}
            ring={1 - resetHours / 24}
            label={t("home.dailyReset")}
            center={<Icon name="timer" size={24} />}
            value={formatDuration(resetHours)}
            sub={t("home.at", { time: reset.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }) })}
          />
        </div>
      </section>

      <div className="home-grid">
        <section className="card coming-up">
          <h2 className="card-title">
            <Icon name="calendar" /> {t("home.comingUp")}
          </h2>
          {upcoming.length ? (
            <ol className="up-list">
              {upcoming.map((e) => (
                <li key={`${e.title}${e.date.getTime()}`} className={`up-${e.type}`}>
                  <span className="up-date">
                    <b>{e.date.toLocaleDateString(locale, { day: "numeric" })}</b>
                    <small>{e.date.toLocaleDateString(locale, { month: "short" })}</small>
                  </span>
                  <span className="up-text">
                    <b>{e.title}</b>
                    <small>
                      {whenText(e.date, e.end, now, server?.timezone ?? "", i18n)}
                      {e.meta ? ` · ${e.meta}` : ""}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="glance-empty">
              <p>{t("home.comingUpEmpty")}</p>
              <a className="fill-btn" href={hrefOf("calendar")}>
                {t("home.pickServer")}
              </a>
            </div>
          )}
          {upcoming.length > 0 && (
            <a className="hero-link" href={hrefOf("calendar")}>
              {t("home.fullCalendar")}
            </a>
          )}
        </section>

        <section className="card whats-new">
          <h2 className="card-title">
            <Icon name="changes" /> {t("home.whatsNew")}
          </h2>
          <ol className="new-list">
            {changes.map((it) => (
              <li key={it.text}>
                <time dateTime={it.date}>{new Date(`${it.date}T12:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric" })}</time>
                {it.href ? (
                  <a href={it.href} title={it.text} {...(it.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
                    {headline(it.text)}
                  </a>
                ) : (
                  <span title={it.text}>{headline(it.text)}</span>
                )}
              </li>
            ))}
          </ol>
          <a className="hero-link" href={hrefOf("changes")}>
            {t("home.allChanges")}
          </a>
        </section>
      </div>

      {groups.map((g) => (
        <section key={g} className="tool-group">
          <h2 className="home-heading">{t(`home.group.${g}` as MessageKey)}</h2>
          <div className="tile-grid">
            {tiles
              .filter((t) => t.group === g)
              .map((t) => (
                <a key={t.id} className={`tile tile-${t.id}`} href={hrefOf(t.id)}>
                  <span className="tile-art">
                    <TileArt id={t.id} icon={t.icon} />
                  </span>
                  <span className="tile-text">
                    <b>{t.label}</b>
                    <small>{t.blurb}</small>
                  </span>
                  <span className="tile-go" aria-hidden>→</span>
                </a>
              ))}
          </div>
        </section>
      ))}

      <section className="card community">
        <div className="community-text">
          <h2 className="card-title">
            <Icon name="chat" /> {t("home.community")}
          </h2>
          <p>{rich(t("home.communityText"))}</p>
        </div>
        <div className="community-actions">
          <a className="spin-button" href={DISCORD_URL} target="_blank" rel="noreferrer">
            {t("home.joinDiscord")}
          </a>
        </div>
      </section>
    </div>
  );
}
