// Material Realm refreshes: a suggested daily split for the current plan, plus the usual presets,
// each with its Dawnium cost. The player picks; nothing changes until they do.
import { REALM_PRESETS } from "../../data/dawnium";
import { DAILY_TASKS } from "../../data/gameConfig";
import { DAWNIUM_REFRESH_COSTS } from "../../data/seasons";
import { REALM_MATERIALS, type PlannerResult, type RealmMaterial } from "../../lib/planner/plan";

type Split = Record<RealmMaterial, number>;
const fmt = (x: number) => Math.round(x).toLocaleString();
const costOf = (split: Split) => REALM_MATERIALS.reduce((a, k) => a + DAWNIUM_REFRESH_COSTS.slice(0, split[k]).reduce((x, y) => x + y, 0), 0);
const label = (split: Split) => REALM_MATERIALS.map((k) => split[k]).join("/");
const same = (a: Split, b: Split) => REALM_MATERIALS.every((k) => a[k] === b[k]);

export function RealmSuggest({ result, current, onPick }: { result: PlannerResult | null; current: Split; onPick: (split: Split) => void }) {
  const s = result?.realmSuggestion;
  const g = result?.goalRealms;
  const resets = result?.time.resets.length ?? 0;
  const options: { name: string; split: Split; note?: string }[] = [
    ...(g ? [{ name: "To reach your goal", split: g.perDay }] : []),
    ...(s && !(g && same(g.perDay, s.perDay)) ? [{ name: "For your planned levels", split: s.perDay }] : []),
    ...REALM_PRESETS.map((p) => ({ name: p.label, split: p.plan })),
  ];

  return (
    <div className="realm-suggest">
      <p className="hint">
        Refreshes a day for each Realm, written <b>Ore/Rola/Essence/Sand</b>. Your split now: <b>{label(current)}</b> ·{" "}
        {fmt(costOf(current))} Dawnium a day.
      </p>
      {g && (
        <p className="realm-suggest-head">
          {g.reachable ? (
            <>
              To reach your goal: <b>{label(g.perDay)}</b>, {fmt(g.dawniumPerDay)} Dawnium a day. Then tap <b>Use this plan</b> in System levels
              again, so the levels match.
            </>
          ) : (
            <span className="bad">Your goal is out of reach even with 10 refreshes on every Realm. The split shown is the most it can use.</span>
          )}
        </p>
      )}
      {s && !g && (
        <p className="realm-suggest-head">
          {REALM_MATERIALS.every((k) => s.perDay[k] === 0) ? (
            <>
              <b>No refreshes needed</b> for your planned levels: Cart, gathering, saved tools and the daily tasks' free runs cover it.
            </>
          ) : (
            <>
              Your planned levels need <b>{label(s.perDay)}</b>: the fewest refreshes that cover what's still short after Cart, gathering,
              saved tools and the daily tasks' free runs.
            </>
          )}
          {s.capped.length > 0 && (
            <span className="bad">
              {" "}
              Even 10 a day isn't enough for {s.capped.map((k) => k[0].toUpperCase() + k.slice(1)).join(" and ")}: lower that plan or find more
              elsewhere.
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
                {fmt(perDay)} Dawnium a day
                {resets > 0 && perDay > 0 && <> · {fmt(perDay * resets)} by season end</>}
              </span>
              {inUse && <span className="ok-text">✓ In use</span>}
            </button>
          );
        })}
      </div>
      <p className="hint">
        The daily tasks give {DAILY_TASKS.dawnium} Dawnium a day. Each Realm's first two refreshes cost {DAWNIUM_REFRESH_COSTS[0]}; later ones
        cost more. Pick a split, or set each Realm below.
      </p>
    </div>
  );
}
