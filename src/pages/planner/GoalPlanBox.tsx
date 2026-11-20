import { STAMINA_PER_GATHER } from "../../data/gameConfig";
// "Plan my goal": shows the cheapest route to the Primostar goal across every system and fills it in.
import type { PlannerResult } from "../../lib/planner/plan";
import { GameIcon } from "../../components/GameIcon";
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
            ? ", with the upgrade levels this plan can use."
            : `: ${SPEND_LABELS[plan.limitedBy as Spend] ?? "materials"} runs out first. This is what the suggested upgrades reach.`}
      </p>
      {!reaches && onSetGoal && (
        <LowerGoal reachable={plan.reachableTotal} goal={result.score.goal} onSetGoal={onSetGoal} />
      )}
      {changed.length > 0 ? (
        <ul className="goal-plan-list">
          {changed.map((k) => (
            <li key={k}>
              <span><GameIcon name={k} /> {SYSTEM_LABELS[k]}</span>
              <span>
                {range(current[k], k === "relic")} → <b>{range(plan.planned[k], k === "relic")}</b>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">{reaches ? "Your current levels already reach it." : "This route adds no upgrades with the current inputs."}</p>
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

export function StaminaGoalBox({ result }: { result: PlannerResult | null }) {
  const plan = result?.staminaPlan;
  const targets = (["ore", "rola", "essence", "sand"] as const).filter((key) => (plan?.gathers[key] ?? 0) > 0);
  const gathersUsed = targets.reduce((total, key) => total + (plan?.gathers[key] ?? 0), 0);

  return (
    <section className={`goal-plan${plan ? (plan.pointsShort > 0 ? " short" : " ok") : ""}`}>
      <h3 className="subhead">Stamina plan for your goal</h3>
      {!plan ? (
        <p className="hint">{result && result.score.goal > 0 ? "Your projected score already covers this goal without gathering." : "Enter a Primostar goal and season details to get gathering recommendations."}</p>
      ) : (
        <>
          <p className="goal-plan-head">
            <b>{plan.capped
              ? "Your goal is above the maximum score allowed by your projected level caps."
              : plan.pointsShort > 0
              ? `No route found to your goal. This route projects ${plan.reachableTotal.toLocaleString()} of ${(result?.score.goal ?? 0).toLocaleString()} Primostars.`
              : gathersUsed > 0 ? "This gathering plan can reach your goal." : "You can reach your goal without spending stamina on gathering."}</b>
          </p>
          {targets.length > 0 && (
            <ul className="goal-plan-list">
              {targets.map((key) => (
                <li key={key}>
                  <span>{SPEND_LABELS[key]}</span>
                  <span><b>{plan.gathers[key].toLocaleString()} gathers</b> · {(plan.gathers[key] * STAMINA_PER_GATHER).toLocaleString()} stamina</span>
                </li>
              ))}
            </ul>
          )}
          <p className="hint">
            Uses <b>{(gathersUsed * STAMINA_PER_GATHER).toLocaleString()}</b> of <b>{(plan.available * STAMINA_PER_GATHER).toLocaleString()}</b> stamina available for whole gathers by season end.
            Each gather costs {STAMINA_PER_GATHER}.
          </p>
          {plan.pointsAdded > 0 && (
            <p className="hint">
              Target levels for this route{" "}
              {ORDER.map((key) => `${SYSTEM_LABELS[key]} ${range(plan.planned[key], key === "relic")}`).join(" · ")}
            </p>
          )}
          <p className="hint">
            Uses your projected income and configured Realm runs, with expected gathering yields. This estimate uses its own stamina split and leaves out extra Home Shop purchases.
            {plan.pointsShort > 0 && !plan.capped && " Other upgrade combinations or income may still close the gap."}
          </p>
        </>
      )}
    </section>
  );
}

/** When the goal is out of reach: lower it to the most the materials reach, or the best Astral Pact tier below that. */
function LowerGoal({ reachable, goal, onSetGoal }: { reachable: number; goal: number; onSetGoal: (stars: number) => void }) {
  const tier = [...ASTRAL_PACT].reverse().find(([s]) => s <= reachable && s < goal);
  return (
    <div className="goal-lower">
      <p className="hint">
        This route reaches about <b>{reachable.toLocaleString()}</b> Primostars.
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
            Lower goal to {reachable.toLocaleString()} (this route)
          </button>
        )}
      </div>
    </div>
  );
}
