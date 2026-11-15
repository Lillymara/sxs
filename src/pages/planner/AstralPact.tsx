// Astral Pact: why a Primostar total matters. A summary line with a button that opens the full
// bonus table, marked with what's unlocked now, what this season adds and the goal.
import { useEffect, useRef, useState } from "react";
import { GameIcon } from "../../components/GameIcon";
import { ASTRAL_PACT, PACT_BONUSES, pactProgress, pactTotals, type PactBonus } from "../../data/astralPact";

/** Game icon beside each bonus: the gem for each stat, and the season badges for EXP and gear. */
const PACT_ICON: Partial<Record<PactBonus, string>> = { ATK: "ruby", DEF: "sapphire", HP: "beryl", SPD: "citrine", GEM: "moonstone", EXP: "character", GEAR: "gear" };
const BonusIcon = ({ b }: { b: PactBonus }) => (PACT_ICON[b] ? <GameIcon name={PACT_ICON[b]!} /> : null);
const fmt = (x: number) => Math.round(x).toLocaleString();
const ORDER: PactBonus[] = ["ATK", "DEF", "HP", "SPD", "EXP", "GEM", "GEAR", "X2"];
const SHORT: Record<PactBonus, string> = {
  ATK: "ATK",
  DEF: "DEF",
  HP: "HP",
  SPD: "SPD",
  EXP: "EXP gain",
  GEM: "Gem drops",
  GEAR: "Gear ascension",
  X2: "2x rating reward",
};

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
  const [open, setOpen] = useState(false);
  const { projected } = props;
  const { unlocked, next } = pactProgress(projected);
  return (
    <div className="pact-line">
      <p>
        <span aria-hidden>🌌</span> <b>Astral Pact:</b> {fmt(projected)} Primostars unlock <b>{unlocked}</b> of {ASTRAL_PACT.length} bonuses.
        {next && (
          <>
            {" "}
            Next at <b>{fmt(next[0])}</b> ({SHORT[next[1]]} +{PACT_BONUSES[next[1]].amount}%), {fmt(next[0] - projected)} more.
          </>
        )}
      </p>
      <button type="button" className="link-button" onClick={() => setOpen(true)}>
        See all bonuses
      </button>
      {open && <AstralPactDialog {...props} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** The goal field's hint: the next bonus at or above the goal. */
export function pactGoalHint(goal: number): string | null {
  if (!(goal > 0)) return null;
  const at = ASTRAL_PACT.find(([s]) => s >= goal);
  if (!at) return "Past the last Astral Pact bonus.";
  return at[0] === goal
    ? `Unlocks the Astral Pact's ${SHORT[at[1]]} +${PACT_BONUSES[at[1]].amount}%.`
    : `The next Astral Pact bonus is at ${fmt(at[0])} (${SHORT[at[1]]} +${PACT_BONUSES[at[1]].amount}%).`;
}

function AstralPactDialog({ have, projected, goal, onPickGoal, onClose }: Props & { onClose: () => void }) {
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
            Close
          </button>
        </div>
        <p className="hint">
          Permanent bonuses for the total Primostars you've filled across every season. This is why some totals are worth aiming for: the
          bonus only arrives once the whole amount is filled.
        </p>
        <div className="pact-totals">
          {ORDER.map((b) => (
            <div key={b}>
              <span><BonusIcon b={b} /> {SHORT[b]}</span>
              <b>
                +{end[b]}%{end[b] > now[b] && <small> (+{end[b] - now[b]} this season)</small>}
              </b>
            </div>
          ))}
        </div>
        <p className="pact-key">
          <span className="pact-dot have" /> Already yours ({fmt(have)}) <span className="pact-dot season" /> This season (to {fmt(projected)})
          {goal > 0 && (
            <>
              <span className="pact-dot goal" /> Your goal ({fmt(goal)})
            </>
          )}
        </p>
        <div className="pact-scroll">
          <table className="pact-table">
            <thead>
              <tr>
                <th scope="col" title="Total Primostars filled">Total</th>
                <th scope="col">Bonus</th>
                <th scope="col">
                  <span className="sr-only">Status</span>
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
                        "This season"
                      ) : onPickGoal ? (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => {
                            onPickGoal(stars);
                            ref.current?.close();
                          }}
                        >
                          {stars === goal ? "Goal" : "Aim for this"}
                        </button>
                      ) : (
                        `${fmt(stars - projected)} more`
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="hint">From the game's Astral Pact screen. Tap "Aim for this" to make that total your planner goal.</p>
      </div>
    </dialog>
  );
}
