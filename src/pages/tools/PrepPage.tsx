// Season prep: one tab per big moment (a new island opening, a season change), each timed for the picked server.
// To add a guide, write a function that returns a Guide (see PrepGuide.tsx) and add it to `guides` below, in game order.
import { useEffect, useId, useState } from "react";
import { ServerSearch } from "../../components/ServerSearch";
import { seasonStatus } from "../../lib/calendar";
import { effectiveDay1, type ServerChoice } from "../calendar/server";
import { aqualisGuide, aqualisOpens, AQUALIS_DAY } from "./AqualisRun";
import { hoursBefore, left, PrepGuide, when, type Guide, type GuideContext } from "./PrepGuide";
import type { ToolProps } from "./props";
import { formatLocale } from "../../i18n/format";
import { rich, useT } from "../../i18n";
import type { MessageKey } from "../../i18n/en";

/** Season 2 levels worth spending Speed-Ups to reach, from eog.gg's Season 2 prep guide (what each unlocks: pr.s2.lv<level>). */
const SPEEDUP_LEVELS = [106, 108, 116, 130];
const SOURCE = "https://eog.gg/games/sword-x-staff/guides/season-2-prep/";

/** Steps before the season ends: [id, tag, link label key, timed window ("hold" = last 36h, "lastDay")]. Each has i1 and i2. */
const BEFORE_END: [string, string, string?, ("hold" | "lastDay")?][] = [
  ["pact", "beforeEnd", "pr.s2.linkBonuses"],
  ["upgrades", "beforeEnd", "pr.s2.linkGoal"],
  ["bed", "last36", undefined, "hold"],
  ["cart", "last36", undefined, "hold"],
  ["stamina", "last36", undefined, "hold"],
  ["dungeon", "lastDay", undefined, "lastDay"],
];
/** Launch-day steps: [id, tag, number of items]. */
const LAUNCH: [string, string, number][] = [
  ["rewards", "atReset", 1],
  ["primostars", "atReset", 1],
  ["statues", "firstRun", 2],
  ["newDungeon", "dayOne", 1],
  ["relics", "beforeDayOneEnds", 1],
];

function season2Guide(end: Date | null, { name, tz, now, t, tn }: GuideContext): Guide {
  const k = (key: string) => t(key as MessageKey);
  const hold = end ? hoursBefore(end, 36) : null;
  const lastDay = end ? hoursBefore(end, 24) : null;
  /** "Your server: from … until …, <what>." for a step that runs up to the season end. */
  const window = (from: Date | null, what: string) =>
    from && end && rich(t("pr.window", { name, from: when(from, tz), left: left(from, now, t, tn), to: when(end, tz), what }));
  return {
    at: end,
    event: t("pr.s2.event"),
    eventPast: t("pr.s2.eventPast"),
    pickHint: t("pr.s2.pickHint"),
    timeline: end
      ? [
          { at: hold!, label: t("pr.s2.tlHold") },
          { at: lastDay!, label: t("pr.s2.tlDungeon") },
          { at: end, label: t("pr.s2.tlStart") },
        ]
      : [],
    rule: { icon: "⏳", title: t("pr.s2.ruleTitle"), text: t("pr.s2.ruleText") },
    phases: [
      {
        title: t("pr.s2.before"),
        steps: BEFORE_END.map(([id, tag, link, timed]) => ({
          title: k(`pr.s2.${id}.title`),
          tag: k(`pr.tag.${tag}`),
          items: [k(`pr.s2.${id}.i1`), k(`pr.s2.${id}.i2`)],
          timed: timed && window(timed === "hold" ? hold : lastDay, k(`pr.s2.${id}.window`)),
          link: link ? { href: "/planner", label: k(link) } : undefined,
        })),
        foot: t("pr.s2.foot", { bed: t("pl.saveBed"), cart: t("pl.saveCart") }),
      },
      {
        title: t("pr.s2.when"),
        at: end,
        note: end ? t("pr.inOrderNamed", { name }) : t("pr.inOrder"),
        steps: LAUNCH.map(([id, tag, n]) => ({
          title: k(`pr.s2.${id}.title`),
          tag: k(`pr.tag.${tag}`),
          items: Array.from({ length: n }, (_, i) => k(`pr.s2.${id}.i${i + 1}`)),
        })),
      },
      {
        title: t("pr.s2.speedTitle"),
        note: t("pr.s2.speedNote"),
        extra: (
          <>
            <div className="table-wrap flat">
              <table>
                <thead>
                  <tr>
                    <th>{t("pr.s2.thLevel")}</th>
                    <th>{t("pr.s2.thUnlocks")}</th>
                  </tr>
                </thead>
                <tbody>
                  {SPEEDUP_LEVELS.map((level) => (
                    <tr key={level}>
                      <td>
                        <b>{t("pr.lv", { n: level })}</b>
                      </td>
                      <td>{k(`pr.s2.lv${level}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint">{t("pr.s2.holdAll")}</p>
          </>
        ),
        foot: (
          <>
            {t("pr.s2.srcBefore")}{" "}
            <a href={SOURCE} target="_blank" rel="noreferrer">
              {t("pr.s2.srcLink")}
            </a>
            {t("pr.s2.srcAfter")}
          </>
        ),
      },
    ],
  };
}

/** Which server the times are for, with a search to change it. Folds to one line on phones, like the Fantomons page. */
function PrepServer({ choice, onChange }: { choice: ServerChoice; onChange: (c: ServerChoice) => void }) {
  const { t } = useT();
  const day1 = effectiveDay1(choice);
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const name = day1 ? choice.name || t("av.custom") : t("av.notPicked");
  const sub = day1
    ? choice.timezone
      ? t("pr.server.subTz", { tz: choice.timezone.replace(/_/g, " ") })
      : t("pr.server.sub")
    : t("pr.server.pick");
  return (
    <section className={`card availability-bar${open ? " open" : ""}`}>
      <button type="button" className="availability-summary" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
        <span className="availability-summary-text">
          <span className="eyebrow">{t("cal.yourServer")}</span>
          <b>{name}</b>
          <small>{sub}</small>
        </span>
        <span className="availability-action">{open ? t("av.done") : day1 ? t("av.change") : t("av.pick")}</span>
      </button>
      <div className="availability-body" id={bodyId}>
        <p className="server-now">
          <span className="eyebrow">{t("cal.yourServer")}</span>
          <b>{name}</b>
          <small>{sub}</small>
        </p>
        <ServerSearch choice={choice} onChange={onChange} />
      </div>
    </section>
  );
}

export function PrepPage({ choice, onServerChange, now }: ToolProps) {
  const { t, tn } = useT();
  const day1 = effectiveDay1(choice);
  const ctx: GuideContext = { name: choice.name || t("cal.yourServer"), tz: choice.timezone || undefined, now, t, tn };
  const shortDate = (d: Date) => d.toLocaleDateString(formatLocale(), { timeZone: ctx.tz, month: "short", day: "numeric" });

  /** Every guide, in the order they happen on a server. */
  const guides: { id: string; label: string; fallback: string; guide: Guide }[] = [
    { id: "aqualis", label: t("pr.aq.label"), fallback: t("pr.serverDay", { n: AQUALIS_DAY }), guide: aqualisGuide(day1 ? aqualisOpens(day1) : null, ctx) },
    { id: "season-2", label: t("pr.s2.label"), fallback: t("pr.s2.fallback"), guide: season2Guide(day1 ? seasonStatus(day1, now).seasonEnds : null, ctx) },
  ];
  // Open on the guide in the link, else the next one coming up on this server, else the latest.
  const pick = () => {
    const fromHash = guides.find((g) => `#${g.id}` === window.location.hash);
    return (fromHash ?? guides.find((g) => g.guide.at && g.guide.at > now) ?? guides[guides.length - 1]).id;
  };
  const [tab, setTab] = useState(pick);
  useEffect(() => {
    const onHash = () => setTab(pick());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  });
  const current = guides.find((g) => g.id === tab) ?? guides[0];
  const choose = (id: string) => {
    setTab(id);
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="tool prep">
      <PrepServer choice={choice} onChange={onServerChange} />
      <div className="prep-tabs" role="tablist" aria-label={t("pr.guidesAria")}>
        {guides.map((g) => {
          const at = g.guide.at;
          return (
            <button key={g.id} type="button" role="tab" id={`tab-${g.id}`} aria-selected={g.id === current.id} aria-controls="prep-panel" onClick={() => choose(g.id)}>
              <span>{g.label}</span>
              <small>{at ? (at > now ? `${shortDate(at)} · ${left(at, now, t, tn)}` : t("pr.tabDone", { date: shortDate(at) })) : g.fallback}</small>
            </button>
          );
        })}
      </div>
      <div className="prep-panel" id="prep-panel" role="tabpanel" aria-labelledby={`tab-${current.id}`}>
        <PrepGuide guide={current.guide} ctx={ctx} />
      </div>
    </div>
  );
}
