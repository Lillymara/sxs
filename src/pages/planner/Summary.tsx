import { useState } from "react";
import { GameIcon } from "../../components/GameIcon";
import type { PlannerResult } from "../../lib/planner/plan";
import { formatXpShort } from "../../lib/xp";
import { AstralPactSummary } from "./AstralPact";
import { PrimoBar } from "./PrimoBar";
import { CountUp } from "../../components/CountUp";
import { rich, useT } from "../../i18n";
import type { MessageKey } from "../../i18n/en";

const fmt = (x: number) => Math.round(x).toLocaleString();
const short = (x: number) => formatXpShort(Math.round(x));
const when = (d: Date | null, now: Date, { t, locale }: ReturnType<typeof useT>) =>
  d === null
    ? t("sum.notByEnd")
    : d <= now
      ? t("sum.nowWord")
      : d.toLocaleString(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const noWhite = (label: string) => label.replace(" (White eq.)", "");

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
  const i18n = useT();
  const { t } = i18n;
  if (!result) return null;

  const { score, costs, materials, rule } = result;
  const goalSet = score.goal > 0;
  const short_ = -score.difference;

  return (
    <section className="card results" aria-live="polite">
      <p className="eyebrow">{t("sum.projection", { n: rule.season })}</p>
      <div className="proj-big">
        <span className="proj-num">
          <CountUp text={`+${fmt(score.earned)}`} />
        </span>
        <span className="proj-label">
          <span><GameIcon name="primostar" /> Primostars</span>
          <small>{t("sum.floor")}</small>
        </span>
      </div>
      <p className="eta">
        {t("sum.breakdown", { fixed: score.fixedStars, earned: fmt(score.starsFromScore), total: fmt(score.projectedTotal) })}
        {score.rating && <> · {t("sum.rating", { r: score.rating })}</>}
      </p>
      <PrimoBar have={score.projectedTotal - score.earned} projected={score.projectedTotal} goal={score.goal} />
      {share && <CopyButton text={share} />}
      <AstralPactSummary have={score.projectedTotal - score.earned} projected={score.projectedTotal} goal={score.goal} onPickGoal={onPickGoal} />
      {goalSet &&
        (score.difference >= 0 ? (
          <p className="note good">{t("sum.goalReached", { goal: fmt(score.goal), n: fmt(score.difference) })}</p>
        ) : (
          <p className="note warn">{t("sum.goalShort", { n: fmt(short_), goal: fmt(score.goal), points: fmt(short_ * rule.pointsPerStar) })}</p>
        ))}

      <ul className="proj-systems">
        {score.categories.map((c) => (
          <li key={c.key}>
            <span>
              <GameIcon name={c.key} /> {t(`sum.cat.${c.key}` as MessageKey)}
            </span>
            <span className="proj-lv">{t("sum.lv", { n: c.key === "character" ? c.seasonLevels.toFixed(1) : fmt(c.seasonLevels) })}</span>
            <span className="proj-pts">{t("sum.pts", { n: fmt(c.points) })}</span>
          </li>
        ))}
        <li className="proj-total">
          <span>{t("sum.total")}</span>
          <span />
          <span className="proj-pts">{t("sum.pts", { n: fmt(score.total) })}</span>
        </li>
      </ul>
      <p className="hint">{t("sum.scoreHint", { n: rule.pointsPerStar })}</p>

      <h3 className="subhead">{t("sum.costs")}</h3>
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
          {t("sum.noCostData", {
            list: Object.entries(costs.unknownFrom)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => t("sum.fromLv", { name: k, lv: String(v) }))
              .join(", "),
          })}
        </p>
      )}

      <h3 className="subhead">{t("sum.balance")}</h3>
      <div className="table-wrap flat">
        <table className="balance">
          <thead>
            <tr>
              <th scope="col"></th>
              <th scope="col">{t("sum.need")}</th>
              <th scope="col">{t("sum.income")}</th>
              <th scope="col">{t("sum.realms")}</th>
              <th scope="col">{t("sum.shop")}</th>
              <th scope="col">{t("sum.left")}</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.key}>
                <th scope="row">
                  <GameIcon name={m.key} /> {m.label.replace(" (White eq.)", "")}
                  <Covered have={m.passive + m.fromRealm + m.fromShop} need={m.need} />
                </th>
                <td>{m.unknownCost ? `${short(m.need)}+?` : short(m.need)}</td>
                <td>{short(m.passive)}</td>
                <td>{m.fromRealm > 0 ? short(m.fromRealm) : "—"}</td>
                <td>{m.fromShop > 0 ? short(m.fromShop) : "—"}</td>
                <td className={m.balance < -0.5 ? "bad" : "ok"}>{m.balance < -0.5 ? `−${short(-m.balance)}` : `+${short(m.balance)}`}</td>
              </tr>
            ))}
            {result.refinedOre.need > 0 && (
              <tr>
                <th scope="row">
                  <GameIcon name="refinedOre" /> Refined Ore
                  <Covered have={result.refinedOre.have + result.refinedOre.gathered} need={result.refinedOre.need} />
                </th>
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
        {t("sum.balanceHint")}
        {(() => {
          const shopRola = materials.reduce((a, m) => a + m.shopRola, 0);
          return shopRola > 0 || result.shopRefreshRolaPerDay > 0 ? (
            <>
              {" "}
              {rich(
                result.shopRefreshRolaPerDay > 0
                  ? t("sum.shopRolaRefresh", { n: short(shopRola), refresh: short(result.shopRefreshRolaPerDay * result.time.resets.length) })
                  : t("sum.shopRola", { n: short(shopRola) }),
              )}
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
              <p className="note warn">{t("sum.realmUnknown")}</p>
            ) : realmLines.length === 0 ? (
              <p className="note good">{t("sum.noRealms")}</p>
            ) : (
              <ul className="ready-list">
                {realmLines.map((m) => (
                  <li key={m.key}>
                    <span>{t("sum.realmRuns", { name: noWhite(m.label) })}</span>
                    <span className={m.entriesLeft !== null && m.entriesLeft < 0 ? "bad" : undefined}>
                      {t("sum.neededTools", { need: fmt(m.realmEntriesNeeded ?? 0), tools: fmt(m.entriesAvailable ?? 0) })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {treats && treats.balance < -0.5 && <p className="note warn">{t("sum.moreTreats", { n: fmt(-treats.balance) })}</p>}
          </>
        );
      })()}

      {materials.some((m) => m.need > 0 && !m.unknownCost) && (
        <>
          <h3 className="subhead">{t("sum.passive")}</h3>
          <ul className="ready-list">
            {materials
              .filter((m) => m.need > 0 && !m.unknownCost)
              .map((m) => (
                <li key={m.key}>
                  <span>{m.label}</span>
                  <span>{when(m.readyAt, now, i18n)}</span>
                </li>
              ))}
          </ul>
        </>
      )}

      <dl className="stats two">
        <div><dt>{t("sum.dawniumDay")}</dt><dd>{fmt(result.dawniumPerDay)}</dd></div>
        <div><dt>{t("sum.stamina")}</dt><dd>{fmt(result.stamina)}</dd></div>
        {result.rolaBoughtPerDay > 0 && <div><dt>{t("sum.rolaBought")}</dt><dd>{short(result.rolaBoughtPerDay)}</dd></div>}
        {result.shopRefreshRolaPerDay > 0 && <div><dt>{t("sum.shopRefreshes")}</dt><dd>{short(result.shopRefreshRolaPerDay)} Rola</dd></div>}
      </dl>
    </section>
  );
}

/** Copies the plan, then says so for a moment. */
function CopyButton({ text }: { text: string }) {
  const { t } = useT();
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
        {t("sum.copy")}
      </button>
      {done === "copied" && <span className="ok-text">{t("sum.copied")}</span>}
      {done === "failed" && <span className="bad">{t("sum.copyFailed")}</span>}
      {done === "failed" && <textarea className="share-text" readOnly value={text} rows={7} />}
    </div>
  );
}

/** A thin bar under a material: how much of what the plan needs is covered. */
function Covered({ have, need }: { have: number; need: number }) {
  const { t } = useT();
  if (!(need > 0)) return null;
  const share = Math.min(1, have / need);
  return (
    <span className={`covered${share < 0.999 ? " short" : ""}`} title={t("sum.covered", { n: Math.round(share * 100) })}>
      <span style={{ width: `${Math.round(share * 100)}%` }} />
    </span>
  );
}
