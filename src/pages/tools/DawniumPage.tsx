// Where to spend Dawnium. Structure lives in src/data/dawnium.ts, words in src/i18n (dw.*); Realm prices come from the client data.
import { CountUp } from "../../components/CountUp";
import { GameIcon } from "../../components/GameIcon";
import { AVOID, LEFTOVER_PULLS, PRIORITIES, REALM_PRESETS, REMINDER_PARAGRAPHS, ROLA_TIPS } from "../../data/dawnium";
import { DAWNIUM_REFRESH_COSTS, ENTRIES_PER_REFRESH } from "../../data/seasons";
import { usePersistentState } from "../../lib/storage";
import { formatLocale } from "../../i18n/format";
import { useT } from "../../i18n";
import type { MessageKey } from "../../i18n/en";

const k = (key: string) => key as MessageKey;
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

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
  const { t, tn } = useT();
  const n = (x: number) => x.toLocaleString(formatLocale());
  const [plan, setPlan] = usePersistentState<Record<Realm, number>>("sxs.dawnium", { ore: 2, rola: 2, essence: 2, sand: 2 });
  const perDay = REALMS.reduce((a, [k]) => a + costOf(plan[k]), 0);
  const entries = REALMS.reduce((a, [k]) => a + plan[k] * ENTRIES_PER_REFRESH, 0);
  const pick = (k: Realm, n: number) => setPlan((p) => ({ ...p, [k]: p[k] === n ? n - 1 : n }));

  return (
    <section className="card realm-planner">
      <div className="realm-head">
        <div>
          <p className="eyebrow">{t("dw.calc.eyebrow")}</p>
          <h2 className="subhead">{t("dw.calc.title")}</h2>
        </div>
        <div className="filter-row" role="group" aria-label={t("dw.calc.presetsAria")}>
          {REALM_PRESETS.map((p) => {
            const on = REALMS.every(([k]) => plan[k] === p.plan[k]);
            return (
              <button key={p.label} type="button" aria-pressed={on} onClick={() => setPlan({ ...p.plan })}>
                {t(`preset.${p.label}`)}
              </button>
            );
          })}
        </div>
      </div>
      <p className="hint">{t("dw.calc.hint", { n: ENTRIES_PER_REFRESH })}</p>

      <div className="realm-grid">
        <span className="realm-corner" aria-hidden>{t("dw.calc.cost")}</span>
        {DAWNIUM_REFRESH_COSTS.map((c, i) => (
          <span key={i} className={`realm-bar ${band(c)}`} title={t("dw.calc.barTitle", { i: i + 1, c: n(c), per: n(c / ENTRIES_PER_REFRESH) })}>
            <i style={{ height: `${(c / MAX_COST) * 100}%` }} />
            <b>{c}</b>
          </span>
        ))}
        <span className="realm-corner" aria-hidden />

        {REALMS.map(([k, label]) => (
          <div key={k} className="realm-row" role="group" aria-label={t("dw.calc.rowAria", { realm: label })}>
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
                aria-label={tn("dw.calc.pipAria", i + 1, { realm: label, c: n(costOf(i + 1)) })}
                onClick={() => pick(k, i + 1)}
              />
            ))}
            <span className="realm-cost">
              <CountUp text={n(costOf(plan[k]))} />
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
        <span><i className="cheap" /> {t("dw.calc.cheap")}</span>
        <span><i className="mid" /> {t("dw.calc.mid")}</span>
        <span><i className="steep" /> {t("dw.calc.steep")}</span>
      </div>

      <dl className="realm-totals">
        <div><dt>{t("dw.calc.perDay")}</dt><dd><CountUp text={n(perDay)} /></dd></div>
        <div><dt>{t("dw.calc.perWeek")}</dt><dd><CountUp text={n(perDay * 7)} /></dd></div>
        <div><dt>{t("dw.calc.entries")}</dt><dd><CountUp text={n(entries)} /></dd></div>
      </dl>
      <p className="hint">{t("dw.calc.free")}</p>
    </section>
  );
}

export function DawniumPage() {
  const { t } = useT();
  return (
    <div className="tool dawnium">
      <section className="card">
        <p className="eyebrow">{t("dw.uses.eyebrow")}</p>
        <h2 className="subhead">{t("dw.uses.title")}</h2>
        <ol className="dawn-uses">
          {PRIORITIES.map((u, i) => (
            <li key={u.id}>
              <span className="dawn-rank" aria-hidden>{i + 1}</span>
              <div>
                <div className="dawn-title">
                  <h3>{t(k(`dw.use.${u.id}.title`))}</h3>
                  <span className="chip">{t(k(`dw.use.${u.id}.cost`))}</span>
                </div>
                <p className="deal-verdict">{t(k(`dw.use.${u.id}.advice`))}</p>
                <ul>
                  {range(u.points).map((p) => <li key={p}>{t(k(`dw.use.${u.id}.p${p}`))}</li>)}
                </ul>
                {u.link && <p className="hint deal-link"><a href={u.link}>{t(k(`dw.use.${u.id}.link`))} →</a></p>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <RealmPlanner />

      <section className="card leftover">
        <p className="eyebrow">{t("dw.left.eyebrow")}</p>
        <h2 className="subhead">{t("dw.left.title")}</h2>
        <ol className="pull-order">
          {LEFTOVER_PULLS.map((p, i) => (
            <li key={p.id}>
              <span className="pull-icon">
                <GameIcon name={p.icon} />
                <span className="dawn-rank small" aria-hidden>{i + 1}</span>
              </span>
              <b>{t(k(`dw.pull.${p.id}.title`))}</b>
              {p.note && <small>{t(k(`dw.pull.${p.id}.note`))}</small>}
            </li>
          ))}
        </ol>
        <div className="pulls-reminder">
          <span aria-hidden>💜</span>
          <div>
            <h3>{t("dw.remind.title")}</h3>
            {range(REMINDER_PARAGRAPHS).map((b) => <p key={b}>{t(k(`dw.remind.p${b}`))}</p>)}
          </div>
        </div>
      </section>

      <div className="tool-grid dawn-grid">
        <section className="card dawn-tips">
          <h2 className="subhead"><GameIcon name="rola" /> {t("dw.rola.title")}</h2>
          <ul>
            {range(ROLA_TIPS).map((a) => <li key={a}>{t(k(`dw.rola${a}`))}</li>)}
          </ul>
        </section>
        <section className="card dawn-tips avoid">
          <h2 className="subhead"><span className="avoid-mark" aria-hidden>✕</span> {t("dw.avoid.title")}</h2>
          <ul>
            {range(AVOID).map((a) => <li key={a}>{t(k(`dw.avoid${a}`))}</li>)}
          </ul>
        </section>
      </div>
      <p className="hint spending-fine-print">{t("dw.fine")}</p>
    </div>
  );
}
