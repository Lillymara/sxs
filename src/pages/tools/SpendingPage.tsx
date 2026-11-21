// What's worth buying in the in-game shop. Content lives in src/data/spending.ts.
import { useState } from "react";
import { CHECKLIST, COSMETICS, DEALS, TIERS, TIPS, type Tier } from "../../data/spending";

const ORDER: Tier[] = ["best", "good", "situational", "skip"];
/** Bars lit on the value meter for each tier. */
const BARS: Record<Tier, number> = { best: 4, good: 3, situational: 2, skip: 1 };

function ValueMeter({ tier }: { tier: Tier }) {
  return (
    <span className={`value-meter tier-${tier}`} role="img" aria-label={`Value: ${TIERS[tier].label}`}>
      {[1, 2, 3, 4].map((n) => <i key={n} className={n <= BARS[tier] ? "on" : undefined} />)}
    </span>
  );
}

/** The four "before you buy" questions as a quick yes/no check with a verdict. */
function DealCheck() {
  const [answers, setAnswers] = useState<(boolean | null)[]>(() => CHECKLIST.map(() => null));
  const answered = answers.filter((a) => a !== null).length;
  const flags = CHECKLIST.filter((q, i) => answers[i] !== null && answers[i] !== q.good);
  const verdict =
    answered < CHECKLIST.length
      ? { cls: "", title: `${CHECKLIST.length - answered} to go`, text: "Answer each question about the deal you're looking at." }
      : flags.length === 0
        ? { cls: "ok", title: "Reasonable buy", text: "It fixes a real need and nothing better covers it. Buy the smallest tier that does the job." }
        : flags.length === 1
          ? { cls: "maybe", title: "Think twice", text: "One red flag:" }
          : { cls: "no", title: "Skip it", text: `${flags.length} red flags:` };
  return (
    <section className="card deal-check">
      <div className="deal-check-head">
        <div>
          <p className="eyebrow">Deal check</p>
          <h2 className="subhead">Looking at a pack right now?</h2>
        </div>
        {answered > 0 && (
          <button type="button" className="link-button" onClick={() => setAnswers(CHECKLIST.map(() => null))}>
            Start over
          </button>
        )}
      </div>
      <ol className="check-qs">
        {CHECKLIST.map((q, i) => {
          const a = answers[i];
          const flag = a !== null && a !== q.good;
          return (
            <li key={q.q} className={a === null ? undefined : flag ? "flag" : "fine"}>
              <span className="check-q">{q.q}</span>
              <span className="yn" role="group" aria-label={q.q}>
                {[true, false].map((v) => (
                  <button key={String(v)} type="button" aria-pressed={a === v} onClick={() => setAnswers((s) => s.map((x, j) => (j === i ? v : x)))}>
                    {v ? "Yes" : "No"}
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
            {flags.map((q) => <li key={q.q}>{q.flag}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

export function SpendingPage() {
  const [tier, setTier] = useState<Tier | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const path = DEALS.filter((d) => d.tier === "best" || d.tier === "good");
  const shown = DEALS.filter((d) => tier === "all" || d.tier === tier).sort((a, b) => ORDER.indexOf(a.tier) - ORDER.indexOf(b.tier));

  return (
    <div className="tool spending">
      <section className="card honest-answer">
        <span className="salt" aria-hidden>🧂</span>
        <div>
          <p className="eyebrow">Read this first</p>
          <h2>The honest answer to "Is this worth it?"</h2>
          <p>
            <strong>No.</strong> Nothing in the shop is truly <em>worth</em> it. Sword x Staff is fully playable and fun without spending a
            cent. Most players won't still be playing three to six months from now, so whatever you buy may not matter for long.
          </p>
          <p>
            Gacha games are built around the same reward loops as slot machines, designed to make spending feel good. So take this guide,
            and any spending guide, with a grain of salt.
          </p>
          <p className="honest-next">If you do decide to spend, here's how to get the most for your money.</p>
        </div>
      </section>

      <section className="card spend-path">
        <p className="eyebrow">If you spend at all</p>
        <h2 className="subhead">Buy in this order</h2>
        <ol>
          {path.map((d, i) => (
            <li key={d.name} className={`tier-${d.tier}`}>
              <span className="path-step" aria-hidden>{i + 1}</span>
              <div>
                <b>{d.name}</b>
                <small>{d.verdict}</small>
              </div>
            </li>
          ))}
        </ol>
        <p className="hint">Stop wherever your budget runs out. Everything past this list is "only if you need it" or worse.</p>
      </section>

      <section className="card deal-board">
        <div className="deal-board-head">
          <h2 className="subhead">Every deal, rated</h2>
          <div className="filter-row" role="group" aria-label="Filter by value">
            <button type="button" aria-pressed={tier === "all"} onClick={() => setTier("all")}>All</button>
            {ORDER.map((t) => (
              <button key={t} type="button" className={`tier-chip tier-${t}`} aria-pressed={tier === t} onClick={() => setTier(t)}>
                {TIERS[t].label}
              </button>
            ))}
          </div>
        </div>
        {tier !== "all" && <p className="hint">{TIERS[tier].blurb}</p>}
        <ul className="deal-list">
          {shown.map((d) => {
            const isOpen = open === d.name;
            return (
              <li key={d.name} className={`deal-row tier-${d.tier}${isOpen ? " open" : ""}`}>
                <button type="button" className="deal-row-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : d.name)}>
                  <ValueMeter tier={d.tier} />
                  <span className="deal-name">
                    <b>{d.name}</b>
                    <small>{d.verdict}</small>
                  </span>
                  <span className={`tier-badge tier-${d.tier}`}>{TIERS[d.tier].label}</span>
                  <span className="deal-caret" aria-hidden>▾</span>
                </button>
                {isOpen && (
                  <div className="deal-body">
                    <ul>
                      {d.why.map((w) => <li key={w}>{w}</li>)}
                    </ul>
                    {d.bestFor && <p className="hint"><b>Best for:</b> {d.bestFor}</p>}
                    {d.link && <p className="hint deal-link"><a href={d.link.href}>{d.link.label} →</a></p>}
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
          <p className="eyebrow">Cosmetics</p>
          <h2 className="subhead">{COSMETICS.title}</h2>
          {COSMETICS.body.map((t) => <p key={t}>{t}</p>)}
        </div>
      </section>

      <DealCheck />

      <section className="card">
        <h2 className="subhead">Good to know</h2>
        <div className="tip-tiles">
          {TIPS.map((t) => <p key={t}>{t}</p>)}
        </div>
      </section>

      <p className="hint spending-fine-print">
        Community advice, not official. Pack contents and prices change and vary by region, so always check what's inside before you buy.
      </p>
    </div>
  );
}
