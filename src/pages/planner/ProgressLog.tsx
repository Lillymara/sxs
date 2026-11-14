// Season progress: a snapshot of points (and level) each time the planner is filled or logged, drawn
// against a steady pace from the first snapshot to the goal at season end.
import type { PlannerResult } from "../../lib/planner/plan";

export interface Snapshot {
  /** ISO date-time. */
  at: string;
  season: number;
  points: number;
  level: number;
}

const DAY = 86_400_000;
const fmt = (x: number) => Math.round(x).toLocaleString();
const dateLabel = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Adds a snapshot, replacing one from the same day, and keeping only this season's. */
export function addSnapshot(log: Snapshot[], s: Snapshot): Snapshot[] {
  const localDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
  const day = localDay(s.at);
  return [...log.filter((x) => x.season === s.season && localDay(x.at) !== day), s].sort((a, b) => a.at.localeCompare(b.at));
}

export function ProgressLog({ result, log, onLog, onClear }: { result: PlannerResult | null; log: Snapshot[]; onLog: () => void; onClear: () => void }) {
  if (!result) return null;
  const season = result.rule.season;
  const entries = log.filter((s) => s.season === season);
  const goalPoints = result.score.scoreNeeded;
  const end = Date.now() + result.time.realHours * 3_600_000;

  // Steady pace: a straight line from the first snapshot to the goal's points at season end.
  const first = entries[0];
  const last = entries[entries.length - 1];
  const paceAt = (t: number) =>
    first && goalPoints > 0 && end > Date.parse(first.at)
      ? first.points + ((goalPoints - first.points) * (t - Date.parse(first.at))) / (end - Date.parse(first.at))
      : null;
  const pace = last ? paceAt(Date.parse(last.at)) : null;
  const diff = pace !== null && last ? last.points - pace : null;

  // Chart.
  const W = 320, H = 140, P = 26;
  const t0 = first ? Date.parse(first.at) : Date.now();
  const t1 = Math.max(end, t0 + DAY);
  const yMax = Math.max(goalPoints, ...entries.map((e) => e.points), 1) * 1.05;
  const yMin = Math.min(...entries.map((e) => e.points), goalPoints || Infinity) * 0.95 || 0;
  const x = (t: number) => P + ((t - t0) / (t1 - t0)) * (W - P - 8);
  const y = (v: number) => H - P + 4 - ((v - yMin) / Math.max(1, yMax - yMin)) * (H - P - 10);

  return (
    <section className="card progress-log">
      <div className="pcard-head">
        <h2>
          <span aria-hidden>📈</span>Season progress
        </h2>
        <button type="button" className="fill-btn" onClick={onLog}>
          Log today
        </button>
      </div>
      <p className="hint">
        Each time you fill the planner from screenshots (or tap Log today), today's points are saved here, so you can see if you're keeping
        pace with your goal. One entry per day; kept in this browser.
      </p>
      {entries.length === 0 ? (
        <p className="hint">
          Nothing logged yet. Right now you're on <b>{fmt(result.scoreNow)}</b> points.
        </p>
      ) : (
        <>
          {diff !== null && entries.length > 1 && (
            <p className={`note ${diff >= 0 ? "good" : "warn"}`}>
              {diff >= 0 ? (
                <>
                  <b>{fmt(diff)} points ahead</b> of a steady pace to your goal.
                </>
              ) : (
                <>
                  <b>{fmt(-diff)} points behind</b> a steady pace to your goal. Upgrades often come in bursts, so this can catch up.
                </>
              )}
            </p>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} className="progress-chart" role="img" aria-label="Season points over time">
            <line x1={P} y1={H - P + 4} x2={W - 8} y2={H - P + 4} className="axis" />
            {goalPoints > 0 && first && (
              <>
                <line x1={x(t0)} y1={y(first.points)} x2={x(t1)} y2={y(goalPoints)} className="pace" />
                <text x={W - 10} y={y(goalPoints) - 5} textAnchor="end" className="label">
                  Goal {fmt(goalPoints)}
                </text>
              </>
            )}
            <polyline points={entries.map((e) => `${x(Date.parse(e.at))},${y(e.points)}`).join(" ")} className="actual" />
            {entries.map((e) => (
              <circle key={e.at} cx={x(Date.parse(e.at))} cy={y(e.points)} r={3.5} className="dot">
                <title>
                  {dateLabel(Date.parse(e.at))}: {fmt(e.points)} points, Lv {e.level.toFixed(1)}
                </title>
              </circle>
            ))}
            <text x={P} y={H - 6} className="label">
              {dateLabel(t0)}
            </text>
            <text x={W - 10} y={H - 6} textAnchor="end" className="label">
              Season end {dateLabel(t1)}
            </text>
          </svg>
          <ul className="progress-list">
            {entries
              .slice()
              .reverse()
              .slice(0, 6)
              .map((e) => (
                <li key={e.at}>
                  <span>{dateLabel(Date.parse(e.at))}</span>
                  <span>Lv {e.level.toFixed(1)}</span>
                  <b>{fmt(e.points)} pts</b>
                </li>
              ))}
          </ul>
          <button type="button" className="link-button" onClick={() => window.confirm("Delete this season's progress log?") && onClear()}>
            Clear log
          </button>
        </>
      )}
    </section>
  );
}
