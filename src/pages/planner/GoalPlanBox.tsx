// "Plan my goal": shows the cheapest route to the Primostar goal across every system and fills it in.
import type { PlannerResult } from "../../lib/planner/plan";
import type { Spend } from "../../lib/planner/optimize";
import type { SlotCategory } from "../../lib/planner/score";
import { formatXpShort } from "../../lib/xp";
import { ASTRAL_PACT, PACT_BONUSES } from "../../data/astralPact";

const SPEND_LABELS: Record<Spend, string> = { ore: "Ore", rola: "Rola", essence: "Essence", sand: "Sand", fantomonExp: "Fantomon EXP" };
const SYSTEM_LABELS: Record<SlotCategory, string> = { gear: "Gear", skill: "Skills", fantomon: "Fantomons", relic: "Relics" };
const ORDER: SlotCategory[] = ["gear", "skill", "fantomon", "relic"];

const range = (levels: number[], plus: boolean) => {
  const lo = Math.min(...levels), hi = Math.max(...levels);
  const p = plus ? "+" : "";
  return lo === hi ? `${p}${lo}` : `${p}${lo}–${hi}`;
};

export function GoalPlanBox({
  result,
  current,
  planned,
  onApply,
  onSetGoal,
}: {
  /** Lowers the Primostar goal. */
  onSetGoal?: (stars: number) => void;
  result: PlannerResult | null;
  /** Planned levels now in the form, to tell when this plan is already in use. */
  planned: Record<SlotCategory, number[]>;
  /** Current levels by system, to show what changes. */
  current: Record<SlotCategory, number[]>;
  onApply: (planned: Record<SlotCategory, number[]>) => void;
}) {
  const plan = result?.goalPlan;
  if (result && !plan && result.score.goal > 0) {
    return (
      <div className="goal-plan ok">
        <p className="goal-plan-head">
          <b>Your goal is already covered</b> by the Primostars you have and the season's fixed ones.
        </p>
      </div>
    );
  }
  if (!result || !plan) {
    return (
      <div className="goal-plan muted">
        <p className="hint">
          Enter <b>Primostars you have</b> and the <b>Total you want</b> above, and the planner will work out the cheapest way to get there with
          the materials you'll have by season end.
        </p>
      </div>
    );
  }
  const star = result.rule.pointsPerStar;
  const reaches = plan.pointsShort === 0;
  const changed = ORDER.filter((k) => plan.planned[k].some((v, i) => v > (current[k][i] ?? 0)));
  const caps = result.caps;
  const level = Math.floor(result.character.level);

  return (
    <div className={`goal-plan ${reaches ? "ok" : "short"}`}>
      <p className="goal-plan-head">
        <b>{reaches ? "You can reach your goal" : `${Math.ceil(plan.pointsShort / star)} Primostars short of your goal`}</b>
        {reaches
          ? " with the materials you'll have by season end."
          : plan.limitedBy === "caps"
            ? ", even with every system at its cap."
            : `: ${SPEND_LABELS[plan.limitedBy as Spend] ?? "materials"} runs out first. This is the most your materials reach.`}
      </p>
      {!reaches && onSetGoal && (
        <LowerGoal reachable={plan.reachableTotal} goal={result.score.goal} onSetGoal={onSetGoal} />
      )}
      {changed.length > 0 ? (
        <ul className="goal-plan-list">
          {changed.map((k) => (
            <li key={k}>
              <span>{SYSTEM_LABELS[k]}</span>
              <span>
                {range(current[k], k === "relic")} → <b>{range(plan.planned[k], k === "relic")}</b>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Your current levels already reach it.</p>
      )}
      <p className="hint">
        Spends{" "}
        {(Object.keys(plan.spent) as Spend[])
          .filter((k) => plan.spent[k] > 0)
          .map((k) => `${formatXpShort(plan.spent[k])} ${SPEND_LABELS[k]}`)
          .join(", ") || "nothing"}
        . Caps at your season-end level (Lv {level}): Skills {caps.skill ?? "—"}, Fantomons {caps.fantomon ?? "—"}, Relics +{caps.relic}.
      </p>
      {changed.length > 0 &&
        (ORDER.every((k) => plan.planned[k].every((v, i) => v === planned[k][i])) ? (
          <p className="hint ok-text">✓ This plan is in use. Change it below if you like.</p>
        ) : (
          <button type="button" className="spin-button" onClick={() => onApply(plan.planned)}>
            Use this plan
          </button>
        ))}
    </div>
  );
}

/** When the goal is out of reach: lower it to the most the materials reach, or the best Astral Pact tier below that. */
function LowerGoal({ reachable, goal, onSetGoal }: { reachable: number; goal: number; onSetGoal: (stars: number) => void }) {
  const tier = [...ASTRAL_PACT].reverse().find(([s]) => s <= reachable && s < goal);
  return (
    <div className="goal-lower">
      <p className="hint">
        The most you can reach is about <b>{reachable.toLocaleString()}</b> Primostars.
        {tier && (
          <>
            {" "}
            The highest Astral Pact bonus within that is at <b>{tier[0].toLocaleString()}</b> ({PACT_BONUSES[tier[1]].label} +{PACT_BONUSES[tier[1]].amount}%).
          </>
        )}
      </p>
      <div className="goal-lower-buttons">
        {tier && (
          <button type="button" className="fill-btn" onClick={() => onSetGoal(tier[0])}>
            Lower goal to {tier[0].toLocaleString()} (Astral Pact)
          </button>
        )}
        {(!tier || tier[0] !== reachable) && reachable < goal && (
          <button type="button" className="fill-btn" onClick={() => onSetGoal(reachable)}>
            Lower goal to {reachable.toLocaleString()} (most I can reach)
          </button>
        )}
      </div>
    </div>
  );
}
