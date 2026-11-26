import type { CalcOutcome } from "../lib/xp";
import { formatDuration, formatEta, formatXpShort } from "../lib/xp";
import type { Character } from "./CharacterForm";
import { ProgressRing } from "./ProgressRing";
import { CountUp } from "./CountUp";
import { rich, useT } from "../i18n";
import type { MessageKey } from "../i18n/en";
import { fixed, formatLocale } from "../i18n/format";

interface Props {
  character: Character;
  outcome: CalcOutcome | undefined;
  now: Date;
}

const fmt = (n: number) => Math.ceil(n).toLocaleString(formatLocale());

/** Your XP rate keeps climbing as you level, so estimates past this many levels drift badly. */
const RELIABLE_LEVELS = 5;

export function Results({ character, outcome, now }: Props) {
  const { t } = useT();
  // Nothing to show until the form is filled in: no placeholder box taking up the top of the page.
  if (!outcome) return null;

  if (!outcome.ok) {
    return (
      <section className="card results" aria-live="polite">
        <p className="error" role="alert">{outcome.key ? t(outcome.key as MessageKey, outcome.vars) : outcome.error}</p>
      </section>
    );
  }

  const r = outcome.result;
  const pct = Math.min(100, r.progress * 100);
  const b = r.banked;

  if (b?.pastData) {
    return (
      <section className="card results" aria-live="polite">
        <div className="banked">
          <p className="eyebrow">{t("res.capBanked")}</p>
          <p>{rich(t("res.pastData", { capped: b.cappedLevel, xp: formatXpShort(b.xp), level: b.level }))}</p>
          <p className="banked-warn">{t("res.bankWarn")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card results" aria-live="polite">
      {b && (
        <div className="banked">
          <p className="eyebrow">🔓 {t("res.capBanked")}</p>
          <p className="banked-jump">
            {t("res.levelN", { n: b.cappedLevel })} <span aria-hidden>→</span> <b>{b.level}</b>
          </p>
          <p>{rich(t("res.jump", { capped: b.cappedLevel, xp: formatXpShort(b.xp), level: b.level, pct: fixed(pct, 1), next: r.nextLevel }))}</p>
          <p className="banked-warn">{t("res.bankWarn")}</p>
        </div>
      )}
      <div className="timer-head">
        <ProgressRing value={pct / 100}>
          <small>{t("res.levelWord")}</small>
          <b>{r.nextLevel}</b>
          <small>{t("res.there", { pct: fixed(pct, 0) })}</small>
        </ProgressRing>
        <div className="timer-text">
          <p className="eyebrow">
            {character.name ? `${character.name} → ` : ""}
            {t(b ? "res.levelJump" : "res.levelN", { n: r.nextLevel })}
          </p>
          <p className="big-time">
            <CountUp text={formatDuration(r.hoursToNext)} />
          </p>
          <p className="eta">
            {b ? t("res.bankedAround", { n: r.nextLevel, eta: formatEta(r.hoursToNext, now) }) : t("res.around", { eta: formatEta(r.hoursToNext, now) })}
          </p>
          {r.unboostedHoursToNext !== undefined && r.unboostedHoursToNext - r.hoursToNext >= 1 / 60 && (
            <p className="boost-saved">{t("res.boostSaved", { time: formatDuration(Math.round((r.unboostedHoursToNext - r.hoursToNext) * 60) / 60) })}</p>
          )}
        </div>
      </div>
      <dl className="stats">
        <div>
          <dt>{t("res.progress")}</dt>
          <dd>{fixed(pct, 1)}%</dd>
        </div>
        <div>
          <dt>{t("res.xpToGo")}</dt>
          <dd title={fmt(r.xpRemaining)}>{formatXpShort(r.xpRemaining)}</dd>
        </div>
        <div>
          <dt>{t("res.levelNeeds")}</dt>
          <dd title={fmt(r.xpRequired)}>{formatXpShort(r.xpRequired)}</dd>
        </div>
      </dl>

      {r.goal && (
        <div className="goal">
          <h3>{t("res.goalHead", { n: r.goal.level, time: formatDuration(r.goal.hours) })}</h3>
          <p className="eta">{t("res.goalEta", { xp: formatXpShort(r.goal.xpRemaining), eta: formatEta(r.goal.hours, now) })}</p>
          <p className="note">{t("res.note", { n: RELIABLE_LEVELS })}</p>
          <div className="table-wrap">
            <table className="level-table">
              <thead>
                <tr>
                  <th scope="col">{t("res.colLevel")}</th>
                  <th scope="col">{t("res.colXp")}</th>
                  <th scope="col">{t("res.colTime")}</th>
                  <th scope="col">{t("res.colReached")}</th>
                </tr>
              </thead>
              <tbody>
                {r.goal.steps.map((s, i) => (
                  <tr key={s.level} className={i >= RELIABLE_LEVELS ? "rough" : undefined}>
                    <td>{s.level}</td>
                    <td title={fmt(s.xpRemaining)}>{formatXpShort(s.xpRemaining)}</td>
                    <td>{formatDuration(s.hours)}</td>
                    <td>
                      <span className="eta-long">{formatEta(s.cumulativeHours, now)}</span>
                      <span className="eta-short">{formatEta(s.cumulativeHours, now, true)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
