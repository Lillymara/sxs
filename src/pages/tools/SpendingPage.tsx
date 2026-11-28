// What's worth buying in the in-game shop. Structure lives in src/data/spending.ts, words in src/i18n (sp.*).
import { useState } from "react";
import { CHECKLIST, COSMETICS_PARAGRAPHS, DEALS, TIERS, TIPS, type Deal, type Tier } from "../../data/spending";
import { rich, useT } from "../../i18n";
import type { MessageKey } from "../../i18n/en";

const ORDER = TIERS;
const k = (key: string) => key as MessageKey;
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
/** A deal's name: game names like Monthly Pass stay in English unless a language has its own. */
const dealKey = (d: Deal, field: string) => k(`sp.deal.${d.id}.${field}`);
/** Bars lit on the value meter for each tier. */
const BARS: Record<Tier, number> = { best: 4, good: 3, situational: 2, skip: 1 };

function ValueMeter({ tier }: { tier: Tier }) {
  const { t } = useT();
  return (
    <span className={`value-meter tier-${tier}`} role="img" aria-label={t("sp.valueAria", { tier: t(k(`sp.tier.${tier}.label`)) })}>
      {[1, 2, 3, 4].map((n) => <i key={n} className={n <= BARS[tier] ? "on" : undefined} />)}
    </span>
  );
}

/** The four "before you buy" questions as a quick yes/no check with a verdict. */
function DealCheck() {
  const { t, tn } = useT();
  const [answers, setAnswers] = useState<(boolean | null)[]>(() => CHECKLIST.map(() => null));
  const answered = answers.filter((a) => a !== null).length;
  const flags = CHECKLIST.map((_, i) => i + 1).filter((n) => answers[n - 1] !== null && answers[n - 1] !== CHECKLIST[n - 1].good);
  const verdict =
    answered < CHECKLIST.length
      ? { cls: "", title: tn("sp.check.toGo", CHECKLIST.length - answered), text: t("sp.check.toGoText") }
      : flags.length === 0
        ? { cls: "ok", title: t("sp.check.okTitle"), text: t("sp.check.okText") }
        : flags.length === 1
          ? { cls: "maybe", title: t("sp.check.maybeTitle"), text: t("sp.check.maybeText") }
          : { cls: "no", title: t("sp.check.noTitle"), text: tn("sp.check.noText", flags.length) };
  return (
    <section className="card deal-check">
      <div className="deal-check-head">
        <div>
          <p className="eyebrow">{t("sp.check.eyebrow")}</p>
          <h2 className="subhead">{t("sp.check.title")}</h2>
        </div>
        {answered > 0 && (
          <button type="button" className="link-button" onClick={() => setAnswers(CHECKLIST.map(() => null))}>
            {t("sp.check.reset")}
          </button>
        )}
      </div>
      <ol className="check-qs">
        {CHECKLIST.map((q, i) => {
          const a = answers[i];
          const flag = a !== null && a !== q.good;
          const question = t(k(`sp.chk${i + 1}.q`));
          return (
            <li key={i} className={a === null ? undefined : flag ? "flag" : "fine"}>
              <span className="check-q">{question}</span>
              <span className="yn" role="group" aria-label={question}>
                {[true, false].map((v) => (
                  <button key={String(v)} type="button" aria-pressed={a === v} onClick={() => setAnswers((s) => s.map((x, j) => (j === i ? v : x)))}>
                    {v ? t("sp.check.yes") : t("sp.check.no")}
                  </button>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
      <div className={`check-verdict ${verdict.cls}`} aria-live="polite">
        <b>{verdict.title}</b>
        <span>{verdict.text}</span>
        {answered === CHECKLIST.length && flags.length > 0 && (
          <ul>
            {flags.map((n) => <li key={n}>{t(k(`sp.chk${n}.flag`))}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

export function SpendingPage() {
  const { t } = useT();
  const [tier, setTier] = useState<Tier | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const path = DEALS.filter((d) => d.tier === "best" || d.tier === "good");
  const shown = DEALS.filter((d) => tier === "all" || d.tier === tier).sort((a, b) => ORDER.indexOf(a.tier) - ORDER.indexOf(b.tier));
  const tierLabel = (x: Tier) => t(k(`sp.tier.${x}.label`));

  return (
    <div className="tool spending">
      <section className="card honest-answer">
        <span className="salt" aria-hidden>🧂</span>
        <div>
          <p className="eyebrow">{t("sp.honest.eyebrow")}</p>
          <h2>{t("sp.honest.title")}</h2>
          <p>{rich(t("sp.honest.p1"))}</p>
          <p>{t("sp.honest.p2")}</p>
          <p className="honest-next">{t("sp.honest.next")}</p>
        </div>
      </section>

      <section className="card spend-path">
        <p className="eyebrow">{t("sp.path.eyebrow")}</p>
        <h2 className="subhead">{t("sp.path.title")}</h2>
        <ol>
          {path.map((d, i) => (
            <li key={d.id} className={`tier-${d.tier}`}>
              <span className="path-step" aria-hidden>{i + 1}</span>
              <div>
                <b>{t(dealKey(d, "name"))}</b>
                <small>{t(dealKey(d, "verdict"))}</small>
              </div>
            </li>
          ))}
        </ol>
        <p className="hint">{t("sp.path.hint")}</p>
      </section>

      <section className="card deal-board">
        <div className="deal-board-head">
          <h2 className="subhead">{t("sp.board.title")}</h2>
          <div className="filter-row" role="group" aria-label={t("sp.board.filterAria")}>
            <button type="button" aria-pressed={tier === "all"} onClick={() => setTier("all")}>{t("sp.board.all")}</button>
            {ORDER.map((x) => (
              <button key={x} type="button" className={`tier-chip tier-${x}`} aria-pressed={tier === x} onClick={() => setTier(x)}>
                {tierLabel(x)}
              </button>
            ))}
          </div>
        </div>
        {tier !== "all" && <p className="hint">{t(k(`sp.tier.${tier}.blurb`))}</p>}
        <ul className="deal-list">
          {shown.map((d) => {
            const isOpen = open === d.id;
            return (
              <li key={d.id} className={`deal-row tier-${d.tier}${isOpen ? " open" : ""}`}>
                <button type="button" className="deal-row-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : d.id)}>
                  <ValueMeter tier={d.tier} />
                  <span className="deal-name">
                    <b>{t(dealKey(d, "name"))}</b>
                    <small>{t(dealKey(d, "verdict"))}</small>
                  </span>
                  <span className={`tier-badge tier-${d.tier}`}>{tierLabel(d.tier)}</span>
                  <span className="deal-caret" aria-hidden>▾</span>
                </button>
                {isOpen && (
                  <div className="deal-body">
                    <ul>
                      {range(d.why).map((n) => <li key={n}>{t(dealKey(d, `why${n}`))}</li>)}
                    </ul>
                    {d.bestFor && <p className="hint"><b>{t("sp.bestFor")}</b> {t(dealKey(d, "best"))}</p>}
                    {d.link && <p className="hint deal-link"><a href={d.link}>{t(dealKey(d, "link"))} →</a></p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card cosmetics-note">
        <span className="cosmetics-icon" aria-hidden>👗</span>
        <div>
          <p className="eyebrow">{t("sp.cos.eyebrow")}</p>
          <h2 className="subhead">{t("sp.cos.title")}</h2>
          {range(COSMETICS_PARAGRAPHS).map((n) => <p key={n}>{t(k(`sp.cos.p${n}`))}</p>)}
        </div>
      </section>

      <DealCheck />

      <section className="card">
        <h2 className="subhead">{t("sp.tips.title")}</h2>
        <div className="tip-tiles">
          {range(TIPS).map((n) => <p key={n}>{t(k(`sp.tip${n}`))}</p>)}
        </div>
      </section>

      <p className="hint spending-fine-print">{t("sp.fine")}</p>
    </div>
  );
}
