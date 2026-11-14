import { useState } from "react";
import type { PlannerResult } from "../../lib/planner/plan";
import { formatXpShort } from "../../lib/xp";
import { AstralPactSummary } from "./AstralPact";

const fmt = (x: number) => Math.round(x).toLocaleString();
const ICONS: Record<string, string> = { character: "🛏️", gear: "⚔️", skill: "✨", fantomon: "🐾", relic: "💎" };
const short = (x: number) => formatXpShort(Math.round(x));
const when = (d: Date | null, now: Date) =>
  d === null
    ? "not by season end"
    : d <= now
      ? "now"
      : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function Summary({
  result,
  now,
  onPickGoal,
  share,
}: {
  result: PlannerResult | null;
  now: Date;
  onPickGoal?: (stars: number) => void;
  /** The plan as a message for Discord. */
  share?: string;
}) {
  if (!result) {
    return (
      <section className="card results empty">
        <p>Enter your season and character level to see your plan.</p>
      </section>
    );
  }

  const { score, costs, materials, rule } = result;
  const goalSet = score.goal > 0;
  const short_ = -score.difference;

  return (
    <section className="card results" aria-live="polite">
      <p className="eyebrow">Season {rule.season} projection</p>
      <div className="proj-big">
        <span className="proj-num">+{fmt(score.earned)}</span>
        <span className="proj-label">
          Primostars
          <small>a floor, not a forecast</small>
        </span>
      </div>
      <p className="eta">
        {score.fixedStars} fixed + {fmt(score.starsFromScore)} earned · total {fmt(score.projectedTotal)}
        {score.rating && <> · rating {score.rating}</>}
      </p>
      {share && <CopyButton text={share} />}
      <AstralPactSummary have={score.projectedTotal - score.earned} projected={score.projectedTotal} goal={score.goal} onPickGoal={onPickGoal} />
      {goalSet &&
        (score.difference >= 0 ? (
          <p className="note good">Goal of {fmt(score.goal)} reached, with {fmt(score.difference)} to spare.</p>
        ) : (
          <p className="note warn">
            {fmt(short_)} short of {fmt(score.goal)}. About {fmt(short_ * rule.pointsPerStar)} more points needed.
          </p>
        ))}

      <ul className="proj-systems">
        {score.categories.map((c) => (
          <li key={c.key}>
            <span>
              <span aria-hidden>{ICONS[c.key]}</span> {c.label}
            </span>
            <span className="proj-lv">{c.key === "character" ? c.seasonLevels.toFixed(1) : fmt(c.seasonLevels)} lv</span>
            <span className="proj-pts">{fmt(c.points)} pts</span>
          </li>
        ))}
        <li className="proj-total">
          <span>Total</span>
          <span />
          <span className="proj-pts">{fmt(score.total)} pts</span>
        </li>
      </ul>
      <p className="hint">Levels above the season floor, times each system's points per level. 1 Primostar per {rule.pointsPerStar} points.</p>

      <h3 className="subhead">Upgrade costs</h3>
      <dl className="stats two">
        <div><dt>Ore</dt><dd>{short(costs.ore)}</dd></div>
        <div><dt>Rola</dt><dd>{short(costs.rola)}</dd></div>
        <div><dt>Refined Ore</dt><dd>{fmt(costs.forgeStones)}</dd></div>
        <div><dt>Essence</dt><dd>{short(costs.essence)}</dd></div>
        <div><dt>Fantomon EXP</dt><dd>{short(costs.fantomonExp)}</dd></div>
        <div>
          <dt>{costs.blueSand ? "Blue Sand" : "Purple Sand"}</dt>
          <dd>{fmt(costs.blueSand || costs.purpleSand)}</dd>
        </div>
      </dl>
      {Object.entries(costs.unknownFrom).some(([, v]) => v !== undefined) && (
        <p className="note warn">
          Some planned levels have no cost data yet (
          {Object.entries(costs.unknownFrom)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `${k} from ${v}`)
            .join(", ")}
          ). Those steps aren't counted.
        </p>
      )}

      <h3 className="subhead">Material balance by season end</h3>
      <div className="table-wrap flat">
        <table className="balance">
          <thead>
            <tr>
              <th scope="col"></th>
              <th scope="col">Need</th>
              <th scope="col">Income</th>
              <th scope="col">Realms</th>
              <th scope="col">Shop</th>
              <th scope="col">Left</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.key}>
                <th scope="row">{m.label.replace(" (White eq.)", "")}</th>
                <td>{m.unknownCost ? `${short(m.need)}+?` : short(m.need)}</td>
                <td>{short(m.passive)}</td>
                <td>{m.fromRealm > 0 ? short(m.fromRealm) : "—"}</td>
                <td>{m.fromShop > 0 ? short(m.fromShop) : "—"}</td>
                <td className={m.balance < -0.5 ? "bad" : "ok"}>{m.balance < -0.5 ? `−${short(-m.balance)}` : `+${short(m.balance)}`}</td>
              </tr>
            ))}
            {result.refinedOre.need > 0 && (
              <tr>
                <th scope="row">Refined Ore</th>
                <td>{short(result.refinedOre.need)}</td>
                <td>{short(result.refinedOre.have + result.refinedOre.gathered)}</td>
                <td>—</td>
                <td>—</td>
                <td className={result.refinedOre.left < -0.5 ? "bad" : "ok"}>
                  {result.refinedOre.left < -0.5 ? `−${short(-result.refinedOre.left)}` : `+${short(result.refinedOre.left)}`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="hint">
        Income is what you have plus Cart, gathering and daily Rola. What's still short is covered by the Realm runs you'll have, then the Home
        Shop, which only spends Rola you have spare. Green is spare; red still needs finding. Sand is in White Sand. Refined Ore counts what you have plus 4 map gathers a day (about 117 each); Ore Realms give more, so it's rarely short.
        {(() => {
          const shopRola = materials.reduce((a, m) => a + m.shopRola, 0);
          return shopRola > 0 || result.shopRefreshRolaPerDay > 0 ? (
            <>
              {" "}
              Rola need includes <b>{short(shopRola)}</b> for shop buys
              {result.shopRefreshRolaPerDay > 0 && <> and {short(result.shopRefreshRolaPerDay * result.time.resets.length)} for refreshes</>}
.
            </>
          ) : null;
        })()}
      </p>

      {(() => {
        const realmLines = materials.filter((m) => m.realmEntriesNeeded !== null && m.realmEntriesNeeded > 0);
        const treats = materials.find((m) => m.key === "treats");
        return (
          <>
            {result.realmEntriesNeeded === null ? (
              <p className="note warn">Realm yields are unknown for this season, so Realm runs can't be worked out.</p>
            ) : realmLines.length === 0 ? (
              <p className="note good">No Material Realm runs needed. Income covers the plan.</p>
            ) : (
              <ul className="ready-list">
                {realmLines.map((m) => (
                  <li key={m.key}>
                    <span>{m.label.replace(" (White eq.)", "")} Realm runs</span>
                    <span className={m.entriesLeft !== null && m.entriesLeft < 0 ? "bad" : undefined}>
                      {fmt(m.realmEntriesNeeded ?? 0)} needed / {fmt(m.entriesAvailable ?? 0)} tools
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {treats && treats.balance < -0.5 && <p className="note warn">{fmt(-treats.balance)} more treats needed for the Fantomon plan.</p>}
          </>
        );
      })()}

      {materials.some((m) => m.need > 0 && !m.unknownCost) && (
        <>
          <h3 className="subhead">Covered by passive income</h3>
          <ul className="ready-list">
            {materials
              .filter((m) => m.need > 0 && !m.unknownCost)
              .map((m) => (
                <li key={m.key}>
                  <span>{m.label}</span>
                  <span>{when(m.readyAt, now)}</span>
                </li>
              ))}
          </ul>
        </>
      )}

      <dl className="stats two">
        <div><dt>Dawnium / day</dt><dd>{fmt(result.dawniumPerDay)}</dd></div>
        <div><dt>Stamina this season</dt><dd>{fmt(result.stamina)}</dd></div>
        {result.rolaBoughtPerDay > 0 && <div><dt>Rola bought / day</dt><dd>{short(result.rolaBoughtPerDay)}</dd></div>}
        {result.shopRefreshRolaPerDay > 0 && <div><dt>Shop refreshes / day</dt><dd>{short(result.shopRefreshRolaPerDay)} Rola</dd></div>}
      </dl>
    </section>
  );
}

/** Copies the plan, then says so for a moment. */
function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState<"" | "copied" | "failed">("");
  return (
    <div className="share-row">
      <button
        type="button"
        className="fill-btn"
        onClick={() => {
          navigator.clipboard
            ?.writeText(text)
            .then(() => setDone("copied"))
            .catch(() => setDone("failed"))
            .finally(() => setTimeout(() => setDone(""), 2500));
        }}
      >
        📋 Copy my plan for Discord
      </button>
      {done === "copied" && <span className="ok-text">Copied. Paste it into Discord.</span>}
      {done === "failed" && <span className="bad">Couldn't copy here. Select the text below instead.</span>}
      {done === "failed" && <textarea className="share-text" readOnly value={text} rows={7} />}
    </div>
  );
}
