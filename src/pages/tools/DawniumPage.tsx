// Where to spend Dawnium. Advice lives in src/data/dawnium.ts; Realm prices come from the client data.
import { CountUp } from "../../components/CountUp";
import { GameIcon } from "../../components/GameIcon";
import { AVOID, LEFTOVER_PULLS, PRIORITIES, PULLS_REMINDER, REALM_PRESETS, ROLA_TIPS } from "../../data/dawnium";
import { DAWNIUM_REFRESH_COSTS, ENTRIES_PER_REFRESH } from "../../data/seasons";
import { usePersistentState } from "../../lib/storage";
import { formatLocale } from "../../i18n/format";

const REALMS = [
  ["ore", "Ore"],
  ["rola", "Rola"],
  ["essence", "Essence"],
  ["sand", "Sand"],
] as const;
type Realm = (typeof REALMS)[number][0];

/** Dawnium for the first `n` refreshes of one Realm in a day. */
const costOf = (n: number) => DAWNIUM_REFRESH_COSTS.slice(0, n).reduce((a, b) => a + b, 0);
const MAX_COST = Math.max(...DAWNIUM_REFRESH_COSTS);
/** Value band of one refresh, by Dawnium per entry. */
const band = (cost: number) => {
  const per = cost / ENTRIES_PER_REFRESH;
  return per <= 12 ? "cheap" : per >= 50 ? "steep" : "mid";
};

/** Realm refreshes: the price ladder and a per-Realm picker in one grid. */
function RealmPlanner() {
  const [plan, setPlan] = usePersistentState<Record<Realm, number>>("sxs.dawnium", { ore: 2, rola: 2, essence: 2, sand: 2 });
  const perDay = REALMS.reduce((a, [k]) => a + costOf(plan[k]), 0);
  const entries = REALMS.reduce((a, [k]) => a + plan[k] * ENTRIES_PER_REFRESH, 0);
  const pick = (k: Realm, n: number) => setPlan((p) => ({ ...p, [k]: p[k] === n ? n - 1 : n }));

  return (
    <section className="card realm-planner">
      <div className="realm-head">
        <div>
          <p className="eyebrow">Calculator</p>
          <h2 className="subhead">Your daily Realm refreshes</h2>
        </div>
        <div className="filter-row" role="group" aria-label="Presets">
          {REALM_PRESETS.map((p) => {
            const on = REALMS.every(([k]) => plan[k] === p.plan[k]);
            return (
              <button key={p.label} type="button" aria-pressed={on} onClick={() => setPlan({ ...p.plan })}>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="hint">
        Each Realm can be refreshed up to 10 times a day for {ENTRIES_PER_REFRESH} more entries. Tap a box to set how far you go; the price
        climbs with every refresh.
      </p>

      <div className="realm-grid">
        <span className="realm-corner" aria-hidden>Cost</span>
        {DAWNIUM_REFRESH_COSTS.map((c, i) => (
          <span key={i} className={`realm-bar ${band(c)}`} title={`Refresh #${i + 1}: ${c} Dawnium, ${c / ENTRIES_PER_REFRESH} per entry`}>
            <i style={{ height: `${(c / MAX_COST) * 100}%` }} />
            <b>{c}</b>
          </span>
        ))}
        <span className="realm-corner" aria-hidden />

        {REALMS.map(([k, label]) => (
          <div key={k} className="realm-row" role="group" aria-label={`${label} Realm refreshes`}>
            <span className="realm-name">
              <GameIcon name={k} />
              <span>{label}</span>
            </span>
            {DAWNIUM_REFRESH_COSTS.map((c, i) => (
              <button
                key={i}
                type="button"
                className={`realm-pip ${band(c)}${i < plan[k] ? " on" : ""}`}
                aria-pressed={i < plan[k]}
                aria-label={`${label}: ${i + 1} refresh${i ? "es" : ""}, ${costOf(i + 1)} Dawnium`}
                onClick={() => pick(k, i + 1)}
              />
            ))}
            <span className="realm-cost">
              <CountUp text={costOf(plan[k]).toLocaleString(formatLocale())} />
            </span>
          </div>
        ))}

        <span className="realm-corner" aria-hidden />
        {DAWNIUM_REFRESH_COSTS.map((_, i) => (
          <span key={i} className="realm-num" aria-hidden>#{i + 1}</span>
        ))}
        <span className="realm-corner" aria-hidden />
      </div>

      <div className="realm-legend hint">
        <span><i className="cheap" /> 12 per entry, best value</span>
        <span><i className="mid" /> 20–40 per entry</span>
        <span><i className="steep" /> 50+ per entry</span>
      </div>

      <dl className="realm-totals">
        <div><dt>Dawnium / day</dt><dd><CountUp text={perDay.toLocaleString(formatLocale())} /></dd></div>
        <div><dt>Per week</dt><dd><CountUp text={(perDay * 7).toLocaleString(formatLocale())} /></dd></div>
        <div><dt>Extra entries</dt><dd><CountUp text={String(entries)} /></dd></div>
      </dl>
      <p className="hint">On top of the 5 free entries per Realm from the daily quest.</p>
    </section>
  );
}

export function DawniumPage() {
  return (
    <div className="tool dawnium">
      <section className="card">
        <p className="eyebrow">Every day</p>
        <h2 className="subhead">Best uses, in order</h2>
        <ol className="dawn-uses">
          {PRIORITIES.map((u, i) => (
            <li key={u.title}>
              <span className="dawn-rank" aria-hidden>{i + 1}</span>
              <div>
                <div className="dawn-title">
                  <h3>{u.title}</h3>
                  <span className="chip">{u.cost}</span>
                </div>
                <p className="deal-verdict">{u.advice}</p>
                <ul>
                  {u.points.map((p) => <li key={p}>{p}</li>)}
                </ul>
                {u.link && <p className="hint deal-link"><a href={u.link.href}>{u.link.label} →</a></p>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <RealmPlanner />

      <section className="card leftover">
        <p className="eyebrow">Anything left over?</p>
        <h2 className="subhead">Pulls, in this order</h2>
        <ol className="pull-order">
          {LEFTOVER_PULLS.map((p, i) => (
            <li key={p.title}>
              <span className="pull-icon">
                <GameIcon name={p.icon} />
                <span className="dawn-rank small" aria-hidden>{i + 1}</span>
              </span>
              <b>{p.title}</b>
              {p.note && <small>{p.note}</small>}
            </li>
          ))}
        </ol>
        <div className="pulls-reminder">
          <span aria-hidden>💜</span>
          <div>
            <h3>{PULLS_REMINDER.title}</h3>
            {PULLS_REMINDER.body.map((b) => <p key={b}>{b}</p>)}
          </div>
        </div>
      </section>

      <div className="tool-grid dawn-grid">
        <section className="card dawn-tips">
          <h2 className="subhead"><GameIcon name="rola" /> Rola tips</h2>
          <ul>
            {ROLA_TIPS.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </section>
        <section className="card dawn-tips avoid">
          <h2 className="subhead"><span className="avoid-mark" aria-hidden>✕</span> Don't spend it on</h2>
          <ul>
            {AVOID.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </section>
      </div>
      <p className="hint spending-fine-print">Advice, not official. Costs other than the Realm prices can change, so check in game.</p>
    </div>
  );
}
