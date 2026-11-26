// Material Realm refreshes: a suggested daily split for the current plan, plus the usual presets,
// each with its Dawnium cost. The player picks; nothing changes until they do.
import { REALM_PRESETS } from "../../data/dawnium";
import { DAILY_TASKS } from "../../data/gameConfig";
import { DAWNIUM_REFRESH_COSTS } from "../../data/seasons";
import { REALM_MATERIALS, type PlannerResult, type RealmMaterial } from "../../lib/planner/plan";
import { rich, useT } from "../../i18n";
import type { MessageKey } from "../../i18n/en";
import { formatLocale } from "../../i18n/format";

type Split = Record<RealmMaterial, number>;
const fmt = (x: number) => Math.round(x).toLocaleString(formatLocale());
const costOf = (split: Split) => REALM_MATERIALS.reduce((a, k) => a + DAWNIUM_REFRESH_COSTS.slice(0, split[k]).reduce((x, y) => x + y, 0), 0);
const label = (split: Split) => REALM_MATERIALS.map((k) => split[k]).join("/");
const same = (a: Split, b: Split) => REALM_MATERIALS.every((k) => a[k] === b[k]);

export function RealmSuggest({ result, current, onPick }: { result: PlannerResult | null; current: Split; onPick: (split: Split) => void }) {
  const { t, locale } = useT();
  const s = result?.realmSuggestion;
  const g = result?.goalRealms;
  const resets = result?.time.resets.length ?? 0;
  const options: { name: string; split: Split; note?: string }[] = [
    ...(g ? [{ name: t("rs.toGoal"), split: g.perDay }] : []),
    ...(s && !(g && same(g.perDay, s.perDay)) ? [{ name: t("rs.forPlanned"), split: s.perDay }] : []),
    ...REALM_PRESETS.map((p) => ({ name: t(`preset.${p.label}` as MessageKey), split: p.plan })),
  ];

  return (
    <div className="realm-suggest">
      <p className="hint">
        {rich(t("rs.intro", { split: label(current), n: fmt(costOf(current)) }))}
      </p>
      {g && (
        <p className="realm-suggest-head">
          {g.reachable ? (
            <>{rich(t("rs.goal", { split: label(g.perDay), n: fmt(g.dawniumPerDay) }))}</>
          ) : (
            <span className="bad">{t("rs.outOfReach")}</span>
          )}
        </p>
      )}
      {s && !g && (
        <p className="realm-suggest-head">
          {REALM_MATERIALS.every((k) => s.perDay[k] === 0) ? (
            <>{rich(t("rs.none"))}</>
          ) : (
            <>{rich(t("rs.need", { split: label(s.perDay) }))}</>
          )}
          {s.capped.length > 0 && (
            <span className="bad">
              {" "}
              {t("rs.capped", { list: new Intl.ListFormat(locale, { type: "conjunction" }).format(s.capped.map((k) => k[0].toUpperCase() + k.slice(1))) })}
            </span>
          )}
        </p>
      )}
      <div className="realm-options">
        {options.map((o) => {
          const perDay = costOf(o.split);
          const inUse = same(o.split, current);
          return (
            <button key={o.name} type="button" className={`realm-option${inUse ? " in-use" : ""}`} onClick={() => onPick(o.split)} disabled={inUse}>
              <span className="realm-option-name">{o.name}</span>
              <b>{label(o.split)}</b>
              <span>
                {t("rs.perDay", { n: fmt(perDay) })}
                {resets > 0 && perDay > 0 && <> · {t("rs.byEnd", { n: fmt(perDay * resets) })}</>}
              </span>
              {inUse && <span className="ok-text">{t("rs.inUse")}</span>}
            </button>
          );
        })}
      </div>
      <p className="hint">
        {t("rs.foot", { daily: DAILY_TASKS.dawnium, first: DAWNIUM_REFRESH_COSTS[0] })}
      </p>
    </div>
  );
}
