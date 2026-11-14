// Primostars on a track: what you have, what this season adds, your goal, and the Astral Pact tiers
// along the way, so it's clear how far the next bonus is.
import { ASTRAL_PACT, PACT_BONUSES } from "../../data/astralPact";

const fmt = (x: number) => Math.round(x).toLocaleString();

export function PrimoBar({ have, projected, goal }: { have: number; projected: number; goal: number }) {
  // The track runs from a little below what you have to a little past the furthest of goal and next tier.
  const nextTier = ASTRAL_PACT.find(([s]) => s > projected)?.[0] ?? projected;
  const end = Math.max(projected, goal, nextTier) * 1.04;
  const prevTier = [...ASTRAL_PACT].reverse().find(([s]) => s <= have)?.[0] ?? 0;
  const start = Math.max(0, Math.min(have, prevTier) * 0.96);
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - start) / Math.max(1, end - start)) * 100))}%`;
  const ticks = ASTRAL_PACT.filter(([s]) => s > start && s < end);
  const reached = goal > 0 && projected >= goal;

  return (
    <div className="primo-bar" role="img" aria-label={`${fmt(have)} Primostars now, ${fmt(projected)} projected${goal > 0 ? `, goal ${fmt(goal)}` : ""}`}>
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
        {goal > 0 && <span className={`primo-goal${reached ? " reached" : ""}`} style={{ left: pos(goal) }} title={`Goal ${fmt(goal)}`} />}
      </div>
      <div className="primo-legend">
        <span>
          <i className="dot have" /> {fmt(have)} now
        </span>
        <span>
          <i className="dot season" /> {fmt(projected)} by season end
        </span>
        {goal > 0 && (
          <span>
            <i className={`dot goal${reached ? " reached" : ""}`} /> goal {fmt(goal)}
          </span>
        )}
        <span>
          <i className="dot tick" /> Astral Pact tier
        </span>
      </div>
    </div>
  );
}
