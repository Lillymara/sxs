// Astral Pact: why a Primostar total matters. A summary line with a button that opens the full
// bonus table, marked with what's unlocked now, what this season adds and the goal.
import { useEffect, useRef, useState } from "react";
import { GameIcon } from "../../components/GameIcon";
import { ASTRAL_PACT, PACT_BONUSES, pactProgress, pactTotals, type PactBonus } from "../../data/astralPact";
import { rich, useT } from "../../i18n";
import type { MessageKey } from "../../i18n/en";

/** Game icon beside each bonus: the gem for each stat, and the season badges for EXP and gear. */
const PACT_ICON: Partial<Record<PactBonus, string>> = { ATK: "ruby", DEF: "sapphire", HP: "beryl", SPD: "citrine", GEM: "moonstone", EXP: "character", GEAR: "gear" };
const BonusIcon = ({ b }: { b: PactBonus }) => (PACT_ICON[b] ? <GameIcon name={PACT_ICON[b]!} /> : null);
const fmt = (x: number) => Math.round(x).toLocaleString();
const ORDER: PactBonus[] = ["ATK", "DEF", "HP", "SPD", "EXP", "GEM", "GEAR", "X2"];
type T = ReturnType<typeof useT>["t"];
/** Short bonus names: the stat names stay as in game, the rest are translated. */
const short = (t: T, b: PactBonus) => (["ATK", "DEF", "HP", "SPD"].includes(b) ? b : t(`ap.${b}` as MessageKey));
const bonusText = (t: T, b: PactBonus) => `${short(t, b)} +${PACT_BONUSES[b].amount}%`;

interface Props {
  /** Primostars filled before this season. */
  have: number;
  /** Total projected by season end. */
  projected: number;
  goal: number;
  /** Makes a tier's total the planner goal. */
  onPickGoal?: (stars: number) => void;
}

export function AstralPactSummary(props: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const { projected } = props;
  const { unlocked, next } = pactProgress(projected);
  return (
    <div className="pact-line">
      <p>
        <span aria-hidden>🌌</span> {rich(t("ap.line", { n: fmt(projected), unlocked, total: ASTRAL_PACT.length }))}
        {next && (
          <>
            {" "}
            {rich(t("ap.next", { n: fmt(next[0]), bonus: bonusText(t, next[1]), more: fmt(next[0] - projected) }))}
          </>
        )}
      </p>
      <button type="button" className="link-button" onClick={() => setOpen(true)}>
        {t("ap.seeAll")}
      </button>
      {open && <AstralPactDialog {...props} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** The goal field's hint: the next bonus at or above the goal. */
export function pactGoalHint(goal: number, t: T): string | null {
  if (!(goal > 0)) return null;
  const at = ASTRAL_PACT.find(([s]) => s >= goal);
  if (!at) return t("ap.past");
  return at[0] === goal ? t("ap.unlocks", { bonus: bonusText(t, at[1]) }) : t("ap.nextAt", { n: fmt(at[0]), bonus: bonusText(t, at[1]) });
}

function AstralPactDialog({ have, projected, goal, onPickGoal, onClose }: Props & { onClose: () => void }) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    d.showModal();
    // Start at the first tier this season doesn't reach.
    d.querySelector(".pact-row.next")?.scrollIntoView({ block: "center" });
  }, []);
  const now = pactTotals(have);
  const end = pactTotals(projected);
  const firstMissing = ASTRAL_PACT.findIndex(([s]) => s > projected);

  return (
    <dialog
      ref={ref}
      className="pact-dialog"
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop closes it.
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <div className="pact-inner">
        <div className="pact-head">
          <h2>
            <span aria-hidden>🌌</span> Astral Pact
          </h2>
          <button type="button" className="link-button" onClick={() => ref.current?.close()}>
            {t("ap.close")}
          </button>
        </div>
        <p className="hint">{t("ap.intro")}</p>
        <div className="pact-totals">
          {ORDER.map((b) => (
            <div key={b}>
              <span><BonusIcon b={b} /> {short(t, b)}</span>
              <b>
                +{end[b]}%{end[b] > now[b] && <small> {t("ap.thisSeasonPlus", { n: end[b] - now[b] })}</small>}
              </b>
            </div>
          ))}
        </div>
        <p className="pact-key">
          <span className="pact-dot have" /> {t("ap.yours", { n: fmt(have) })} <span className="pact-dot season" /> {t("ap.season", { n: fmt(projected) })}
          {goal > 0 && (
            <>
              <span className="pact-dot goal" /> {t("ap.goal", { n: fmt(goal) })}
            </>
          )}
        </p>
        <div className="pact-scroll">
          <table className="pact-table">
            <thead>
              <tr>
                <th scope="col" title={t("ap.totalTitle")}>{t("ap.total")}</th>
                <th scope="col">{t("ap.bonus")}</th>
                <th scope="col">
                  <span className="sr-only">{t("ap.status")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ASTRAL_PACT.map(([stars, b], i) => {
                const state = stars <= have ? "have" : stars <= projected ? "season" : goal > 0 && stars <= goal ? "goal" : "";
                return (
                  <tr key={stars} className={`pact-row ${state}${i === firstMissing ? " next" : ""}`}>
                    <td>{fmt(stars)}</td>
                    <td>
                      <BonusIcon b={b} /> {PACT_BONUSES[b].label} <b>+{PACT_BONUSES[b].amount}%</b>
                    </td>
                    <td>
                      {state === "have" ? (
                        "✓"
                      ) : state === "season" ? (
                        t("ap.thisSeason")
                      ) : onPickGoal ? (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => {
                            onPickGoal(stars);
                            ref.current?.close();
                          }}
                        >
                          {stars === goal ? t("ap.goalWord") : t("ap.aim")}
                        </button>
                      ) : (
                        t("ap.more", { n: fmt(stars - projected) })
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="hint">{t("ap.foot")}</p>
      </div>
    </dialog>
  );
}
