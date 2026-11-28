// How to use the Season Planner: step by step, in the order of the planner's cards.
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GameIcon } from "../../components/GameIcon";
import { rich, useT } from "../../i18n";
import type { MessageKey } from "../../i18n/en";

/** One step of the guide. Words live in src/i18n (gd.<id>.title / short / intro / p1… / f1… / tip). */
interface Step {
  id: string;
  /** A game icon (public/art/icons) or an emoji. */
  icon: string;
  points: number;
  /** Extra fields that only Full mode asks for. */
  full?: number;
  tip?: boolean;
}

const STEPS: Step[] = [
  { id: "mode", icon: "⚙️", points: 3 },
  { id: "screenshots", icon: "📷", points: 5, tip: true },
  { id: "goal", icon: "primostar", points: 4, full: 1 },
  { id: "character", icon: "character", points: 3, full: 1 },
  { id: "systems", icon: "gear", points: 5, full: 1 },
  { id: "income", icon: "ore", points: 3, full: 1 },
  { id: "daily", icon: "essence", points: 3, full: 2 },
  { id: "results", icon: "relic", points: 5 },
];

/** Every button and link worth knowing, and where it sits (gd.w.<id>.what / where / does). */
const WHERE: { id: string; href?: string }[] = [
  { id: "planner", href: "/planner" },
  { id: "guide" },
  { id: "clear" },
  { id: "mode" },
  { id: "shots" },
  { id: "how" },
  { id: "more" },
  { id: "fill" },
  { id: "calendar", href: "/calendar" },
  { id: "goal" },
  { id: "lower" },
  { id: "fillMin" },
  { id: "realms" },
  { id: "dawnium", href: "/dawnium" },
  { id: "bonuses" },
  { id: "jump" },
  { id: "timer", href: "/timer" },
];

/** The quick start, as a path (gd.q1…). Each stop links to the step that explains it. */
const QUICK: { step: string; icon: string }[] = [
  { step: "goal", icon: "🗓️" },
  { step: "screenshots", icon: "📷" },
  { step: "goal", icon: "primostar" },
  { step: "systems", icon: "gear" },
  { step: "daily", icon: "essence" },
];

const SHOTS = ["character", "bed", "cart", "progression", "backpack"] as const;
const NOTES = 4;

type T = ReturnType<typeof useT>["t"];
const k = (key: string) => key as MessageKey;

/** The planner's own button and field names, filled into the guide so it always matches what's on screen. */
function labels(t: T): Record<string, string> {
  const pick = (map: Record<string, string>) => Object.fromEntries(Object.entries(map).map(([n, key]) => [n, t(k(key))]));
  return {
    ...pick({
      simple: "pl.simple", full: "pl.full",
      goalStep: "pl.step.goal", charStep: "pl.step.character", levelsStep: "pl.step.levels", matStep: "pl.step.materials", dailyStep: "pl.step.daily",
      fillShots: "si.open", howShots: "si.how", fillPlanner: "si.fillPlanner", addMore: "si.addMore", startOver: "si.startOver",
      shotCharacter: "si.g.character.title", shotBed: "si.g.bed.title", shotCart: "si.g.cart.title", shotProgression: "si.g.progression.title", shotBackpack: "si.g.backpack.title",
      goalCard: "pl.goalCard", charCard: "pl.charCard", levelsCard: "pl.levelsCard", cartCard: "pl.cartCard", dailyCard: "pl.dailyCard",
      have: "pl.have", want: "pl.want", seasonEnds: "pl.seasonEnds", saveBed: "pl.saveBed", saveCart: "pl.saveCart", pickServer: "pl.pickServer",
      season: "char.season", level: "char.level", rate: "char.rate", boostHours: "pl.boostHours",
      now: "pl.now", plan: "pl.plan", use: "gp.use", fillMin: "pl.fillMinShort",
      cartHr: "pl.cartHr", haveNow: "pl.haveNow", refined: "pl.refined", shopOther: "pl.shopOther",
      realms: "pl.realms", homeShop: "pl.homeShop", tools: "pl.toolsSaved", stamina: "pl.stamina", byEnd: "pl.col.byEnd",
      seeAll: "ap.seeAll", aim: "ap.aim", costs: "sum.costs", balance: "sum.balance", need: "sum.need", income: "sum.income", realm: "sum.realms", shop: "sum.shop", left: "sum.left",
      clear: "planner.clear",
      plannerPage: "page.planner.label", calendarPage: "page.calendar.label", dawniumPage: "page.dawnium.label", timerPage: "page.timer.label",
      groupPlan: "group.Plan", groupInfo: "group.Info", tabPlanner: "tab.planner", tabCalendar: "tab.calendar", tabTimer: "tab.timer", tabMore: "tab.more",
    }),
    projected: t("pl.projected", { lv: "…" }).replace(/<\/?b>/g, ""),
    setEvery: t("sl.setEvery", { noun: "…" }),
  };
}

/** A guide line: <b> becomes bold, and {calendarLink} / {dawniumLink} become links named in the chosen language. */
function line(text: string, t: T): ReactNode {
  const links: Record<string, [string, string]> = {
    "{calendarLink}": ["/calendar", t("page.calendar.label")],
    "{dawniumLink}": ["/dawnium", t("page.dawnium.label")],
  };
  return text.split(/(\{calendarLink\}|\{dawniumLink\})/).map((part, i) =>
    links[part] ? <a key={i} href={links[part][0]}>{links[part][1]}</a> : <Fragment key={i}>{rich(part)}</Fragment>,
  );
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

function StepIcon({ icon }: { icon: string }) {
  return /^[a-z]/i.test(icon) ? <GameIcon name={icon} /> : <span className="guide-emoji" aria-hidden>{icon}</span>;
}

/** The planner's own Simple/Full choice, so the guide opens the way the planner is set. */
function plannerMode(): "simple" | "full" {
  try {
    return JSON.parse(localStorage.getItem("sxs.planner") || "{}").mode === "full" ? "full" : "simple";
  } catch {
    return "simple";
  }
}

export function PlannerGuidePage() {
  const { t, tn } = useT();
  const L = useMemo(() => labels(t), [t]);
  /** A guide string with the planner's own names filled in. */
  const g = (key: string, vars?: Record<string, string | number>) => t(k(key), { ...L, ...vars });
  const [mode, setMode] = useState<"simple" | "full">(plannerMode);
  const [active, setActive] = useState(STEPS[0].id);
  const [query, setQuery] = useState("");

  // Highlight the step being read in the step menu.
  useEffect(() => {
    const els = STEPS.map((st) => document.getElementById(`guide-${st.id}`)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (seen) setActive(seen.target.id.replace("guide-", ""));
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  // Keep the highlighted step visible when the step menu is a sideways strip.
  const rail = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const ol = rail.current;
    const a = ol?.querySelector<HTMLElement>("[aria-current]");
    if (!ol || !a || ol.scrollWidth <= ol.clientWidth) return;
    ol.scrollTo({ left: a.offsetLeft - ol.clientWidth / 2 + a.offsetWidth / 2, behavior: "smooth" });
  }, [active]);

  const q = query.trim().toLowerCase();
  const where = WHERE.map((w) => ({ ...w, what: g(`gd.w.${w.id}.what`), where: g(`gd.w.${w.id}.where`), does: g(`gd.w.${w.id}.does`) }));
  const found = q ? where.filter((w) => `${w.what} ${w.where} ${w.does}`.toLowerCase().includes(q)) : where;

  return (
    <div className="tool guide">
      <section className="card guide-hero">
        <div className="guide-hero-head">
          <div>
            <p className="eyebrow">{g("gd.heroEyebrow")}</p>
            <h2>{g("gd.heroTitle")}</h2>
          </div>
          <a className="spin-button" href="/planner">
            {g("gd.open")}
          </a>
        </div>
        <ol className="guide-path">
          {QUICK.map((qk, i) => (
            <li key={i}>
              <a href={`/guide?${qk.step}`} onClick={(e) => jump(e, qk.step)}>
                <span className="guide-path-icon">
                  <StepIcon icon={qk.icon} />
                  <b aria-hidden>{i + 1}</b>
                </span>
                <span>{g(`gd.q${i + 1}`)}</span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <div className="guide-body">
        <nav className="guide-rail" aria-label={g("gd.stepsAria")}>
          <div className="guide-view" role="group" aria-label={g("gd.viewAria")}>
            <span>{g("gd.showMe")}</span>
            <span className="yn">
              <button type="button" aria-pressed={mode === "simple"} onClick={() => setMode("simple")}>{L.simple}</button>
              <button type="button" aria-pressed={mode === "full"} onClick={() => setMode("full")}>{L.full}</button>
            </span>
          </div>
          <ol ref={rail}>
            {STEPS.map((st, i) => (
              <li key={st.id}>
                <a href={`/guide?${st.id}`} aria-current={active === st.id ? "step" : undefined} onClick={(e) => jump(e, st.id)}>
                  <b>{i + 1}</b>
                  {g(`gd.${st.id}.short`)}
                </a>
              </li>
            ))}
            <li>
              <a href="/guide?where" onClick={(e) => jump(e, "where")}>
                <b>?</b>
                {g("gd.findButton")}
              </a>
            </li>
          </ol>
        </nav>

        <div className="guide-main">
          {STEPS.map((st, i) => (
            <section key={st.id} id={`guide-${st.id}`} className="card guide-step">
              <header>
                <span className="guide-step-icon">
                  <StepIcon icon={st.icon} />
                </span>
                <div>
                  <p className="eyebrow">{g("gd.stepOf", { i: i + 1, n: STEPS.length })}</p>
                  <h2>{g(`gd.${st.id}.title`)}</h2>
                </div>
              </header>
              <p className="guide-intro">{g(`gd.${st.id}.intro`)}</p>
              {st.id === "screenshots" && (
                <ul className="guide-shots">
                  {SHOTS.map((file) => (
                    <li key={file}>
                      <img src={`${import.meta.env.BASE_URL}art/screens/${file}.jpg`} alt={g("gd.exampleShot", { name: t(k(`si.g.${file}.title`)) })} loading="lazy" />
                      <span>{t(k(`si.g.${file}.title`))}</span>
                    </li>
                  ))}
                </ul>
              )}
              <ul className="guide-points">
                {range(st.points).map((j) => (
                  <li key={j}>{line(g(`gd.${st.id}.p${j}`), t)}</li>
                ))}
              </ul>
              {st.full &&
                (mode === "full" ? (
                  <div className="guide-full">
                    <span className="guide-full-tag">{g("gd.fullAdds")}</span>
                    <ul className="guide-points">
                      {range(st.full).map((j) => (
                        <li key={j}>{line(g(`gd.${st.id}.f${j}`), t)}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <button type="button" className="guide-full-more" onClick={() => setMode("full")}>
                    {tn("gd.moreFields", st.full, L)}
                  </button>
                ))}
              {st.tip && <p className="guide-tip">💡 {g(`gd.${st.id}.tip`)}</p>}
            </section>
          ))}

          <section className="card" id="guide-where">
            <div className="guide-where-head">
              <div>
                <p className="eyebrow">{g("gd.whereEyebrow")}</p>
                <h2 className="subhead">{g("gd.whereTitle")}</h2>
              </div>
              <input type="search" placeholder={g("gd.searchPh")} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={g("gd.searchAria")} />
            </div>
            <ul className="guide-finder">
              {found.map((w) => (
                <li key={w.id}>
                  <b>{w.href ? <a href={w.href}>{w.what}</a> : w.what}</b>
                  <span className="guide-finder-where">📍 {w.where}</span>
                  <span>{w.does}</span>
                </li>
              ))}
              {!found.length && <li className="hint">{g("gd.noMatch", { query })}</li>}
            </ul>
          </section>

          <section className="card">
            <h2 className="subhead">{g("gd.notesTitle")}</h2>
            <div className="tip-tiles">
              {range(NOTES).map((n) => <p key={n}>{rich(g(`gd.n${n}`))}</p>)}
            </div>
            <p className="guide-links">
              <a className="spin-button" href="/planner">
                {g("gd.open")}
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Section links scroll within the page without changing the route. */
function jump(e: React.MouseEvent, id: string) {
  e.preventDefault();
  document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
