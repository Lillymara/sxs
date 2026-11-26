import { STAMINA_PER_GATHER } from "../../data/gameConfig";
// "Plan my goal": shows the cheapest route to the Primostar goal across every system and fills it in.
import type { PlannerResult } from "../../lib/planner/plan";
import { GameIcon } from "../../components/GameIcon";
import type { Spend } from "../../lib/planner/optimize";
import type { SlotCategory } from "../../lib/planner/score";
import { formatXpShort } from "../../lib/xp";
import { ASTRAL_PACT, PACT_BONUSES } from "../../data/astralPact";
import { rich, useT } from "../../i18n";
import type { MessageKey } from "../../i18n/en";

const SPEND_LABELS: Record<Spend, string> = { ore: "Ore", rola: "Rola", essence: "Essence", sand: "Sand", fantomonExp: "Fantomon EXP" };
/** System names in the chosen language (the planner summary's keys). */
const sysLabel = (t: ReturnType<typeof useT>["t"], k: SlotCategory) => t(`sum.cat.${k}` as MessageKey);
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
  const { t } = useT();
  const plan = result?.goalPlan;
  if (result && !plan && result.score.goal > 0) {
    return (
      <div className="goal-plan ok">
        <p className="goal-plan-head">
          {rich(t("gp.covered"))}
        </p>
      </div>
    );
  }
  if (!result || !plan) {
    return (
      <div className="goal-plan muted">
        <p className="hint">
          {rich(t("gp.enter"))}
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
        {rich(
          reaches
            ? t("gp.reach")
            : plan.limitedBy === "caps"
              ? t("gp.shortCaps", { n: Math.ceil(plan.pointsShort / star) })
              : t("gp.shortMat", { n: Math.ceil(plan.pointsShort / star), mat: SPEND_LABELS[plan.limitedBy as Spend] ?? t("gp.materials") }),
        )}
      </p>
      {!reaches && onSetGoal && (
        <LowerGoal reachable={plan.reachableTotal} goal={result.score.goal} onSetGoal={onSetGoal} />
      )}
      {changed.length > 0 ? (
        <ul className="goal-plan-list">
          {changed.map((k) => (
            <li key={k}>
              <span><GameIcon name={k} /> {sysLabel(t, k)}</span>
              <span>
                {range(current[k], k === "relic")} → <b>{range(plan.planned[k], k === "relic")}</b>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">{reaches ? t("gp.alreadyReach") : t("gp.noUpgrades")}</p>
      )}
      <p className="hint">
        {t("gp.spends", {
          list:
            (Object.keys(plan.spent) as Spend[])
              .filter((k) => plan.spent[k] > 0)
              .map((k) => `${formatXpShort(plan.spent[k])} ${SPEND_LABELS[k]}`)
              .join(", ") || t("gp.nothing"),
          lv: level,
          skill: caps.skill ?? "—",
          fantomon: caps.fantomon ?? "—",
          relic: caps.relic ?? "—",
        })}
      </p>
      {changed.length > 0 &&
        (ORDER.every((k) => plan.planned[k].every((v, i) => v === planned[k][i])) ? (
          <p className="hint ok-text">{t("gp.inUse")}</p>
        ) : (
          <button type="button" className="spin-button" onClick={() => onApply(plan.planned)}>
            {t("gp.use")}
          </button>
        ))}
    </div>
  );
}

export function StaminaGoalBox({ result }: { result: PlannerResult | null }) {
  const { t, locale } = useT();
  const plan = result?.staminaPlan;
  const targets = (["ore", "rola", "essence", "sand"] as const).filter((key) => (plan?.gathers[key] ?? 0) > 0);
  const gathersUsed = targets.reduce((total, key) => total + (plan?.gathers[key] ?? 0), 0);

  return (
    <section className={`goal-plan${plan ? (plan.pointsShort > 0 ? " short" : " ok") : ""}`}>
      <h3 className="subhead">{t("gp.stTitle")}</h3>
      {!plan ? (
        <p className="hint">{result && result.score.goal > 0 ? t("gp.stCovered") : t("gp.stEnter")}</p>
      ) : (
        <>
          <p className="goal-plan-head">
            <b>{plan.capped
              ? t("gp.stCapped")
              : plan.pointsShort > 0
              ? t("gp.stNoRoute", { n: plan.reachableTotal.toLocaleString(locale), goal: (result?.score.goal ?? 0).toLocaleString(locale) })
              : gathersUsed > 0 ? t("gp.stCan") : t("gp.stNoNeed")}</b>
          </p>
          {targets.length > 0 && (
            <ul className="goal-plan-list">
              {targets.map((key) => (
                <li key={key}>
                  <span>{SPEND_LABELS[key]}</span>
                  <span>{rich(t("gp.gathers", { n: plan.gathers[key].toLocaleString(locale), stamina: (plan.gathers[key] * STAMINA_PER_GATHER).toLocaleString(locale) }))}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="hint">
            {rich(t("gp.stUses", { used: (gathersUsed * STAMINA_PER_GATHER).toLocaleString(locale), avail: (plan.available * STAMINA_PER_GATHER).toLocaleString(locale), n: STAMINA_PER_GATHER }))}
          </p>
          {plan.pointsAdded > 0 && (
            <p className="hint">
              {t("gp.targets", { list: ORDER.map((key) => `${sysLabel(t, key)} ${range(plan.planned[key], key === "relic")}`).join(" · ") })}
            </p>
          )}
          <p className="hint">
            {t("gp.stNote")}
            {plan.pointsShort > 0 && !plan.capped && t("gp.stGap")}
          </p>
        </>
      )}
    </section>
  );
}

/** When the goal is out of reach: lower it to the most the materials reach, or the best Astral Pact tier below that. */
function LowerGoal({ reachable, goal, onSetGoal }: { reachable: number; goal: number; onSetGoal: (stars: number) => void }) {
  const { t, locale } = useT();
  const tier = [...ASTRAL_PACT].reverse().find(([s]) => s <= reachable && s < goal);
  return (
    <div className="goal-lower">
      <p className="hint">
        {rich(t("gp.reaches", { n: reachable.toLocaleString(locale) }))}
        {tier && (
          <>
            {" "}
            {rich(t("gp.tier", { n: tier[0].toLocaleString(locale), bonus: `${PACT_BONUSES[tier[1]].label} +${PACT_BONUSES[tier[1]].amount}%` }))}
          </>
        )}
      </p>
      <div className="goal-lower-buttons">
        {tier && (
          <button type="button" className="fill-btn" onClick={() => onSetGoal(tier[0])}>
            {t("gp.lowerPact", { n: tier[0].toLocaleString(locale) })}
          </button>
        )}
        {(!tier || tier[0] !== reachable) && reachable < goal && (
          <button type="button" className="fill-btn" onClick={() => onSetGoal(reachable)}>
            {t("gp.lowerRoute", { n: reachable.toLocaleString(locale) })}
          </button>
        )}
      </div>
    </div>
  );
}
