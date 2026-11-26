// Primostars on a track: what you have, what this season adds, your goal, and the Astral Pact tiers
// along the way, so it's clear how far the next bonus is.
import { ASTRAL_PACT, PACT_BONUSES } from "../../data/astralPact";
import { useT } from "../../i18n";
import { formatLocale } from "../../i18n/format";

const fmt = (x: number) => Math.round(x).toLocaleString(formatLocale());

export function PrimoBar({ have, projected, goal }: { have: number; projected: number; goal: number }) {
  const { t } = useT();
  // The track runs from a little below what you have to a little past the furthest of goal and next tier.
  const nextTier = ASTRAL_PACT.find(([s]) => s > projected)?.[0] ?? projected;
  const end = Math.max(projected, goal, nextTier) * 1.04;
  const prevTier = [...ASTRAL_PACT].reverse().find(([s]) => s <= have)?.[0] ?? 0;
  const start = Math.max(0, Math.min(have, prevTier) * 0.96);
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - start) / Math.max(1, end - start)) * 100))}%`;
  const ticks = ASTRAL_PACT.filter(([s]) => s > start && s < end);
  const reached = goal > 0 && projected >= goal;

  return (
    <div className="primo-bar" role="img" aria-label={goal > 0 ? t("pb.ariaGoal", { have: fmt(have), projected: fmt(projected), goal: fmt(goal) }) : t("pb.aria", { have: fmt(have), projected: fmt(projected) })}>
      <div className="primo-track">
        <span className="primo-have" style={{ width: pos(have) }} />
        <span className="primo-season" style={{ left: pos(have), width: `calc(${pos(projected)} - ${pos(have)})` }} />
        {ticks.map(([s, b]) => (
          <span
            key={s}
            className={`primo-tick${s <= projected ? " got" : ""}`}
            style={{ left: pos(s) }}
            title={`${fmt(s)}: ${PACT_BONUSES[b].label} +${PACT_BONUSES[b].amount}%`}
          />
        ))}
        {goal > 0 && <span className={`primo-goal${reached ? " reached" : ""}`} style={{ left: pos(goal) }} title={t("pb.goalTitle", { n: fmt(goal) })} />}
      </div>
      <div className="primo-legend">
        <span>
          <i className="dot have" /> {t("pb.now", { n: fmt(have) })}
        </span>
        <span>
          <i className="dot season" /> {t("pb.byEnd", { n: fmt(projected) })}
        </span>
        {goal > 0 && (
          <span>
            <i className={`dot goal${reached ? " reached" : ""}`} /> {t("pb.goal", { n: fmt(goal) })}
          </span>
        )}
        <span>
          <i className="dot tick" /> {t("pb.tier")}
        </span>
      </div>
    </div>
  );
}
