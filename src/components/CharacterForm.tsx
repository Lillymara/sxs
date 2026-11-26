import type { ReactNode } from "react";
import type { SeasonTable } from "../lib/xp";
import { seasons } from "../lib/xp";
import { useT } from "../i18n";

export interface Character {
  name: string;
  season: string;
  level: string;
  progressMode: "xp" | "percent";
  currentXp: string;
  percent: string;
  rate: string;
  goalLevel: string;
  /** Count the free daily bed boost (2 hours of EXP) in the Level Timer. */
  bedBoost?: boolean;
  /** Whether today's bed boost is still unused (counts it now). Defaults to true. */
  bedToday?: boolean;
  /** Temporal Crystals to use now, 2 hours of EXP each. */
  crystals?: string;
}

interface Props {
  character: Character;
  onChange: (character: Character) => void;
  onReset: () => void;
  table: SeasonTable | undefined;
  /** Hide the name and goal-level fields (used inside the Season Planner). */
  compact?: boolean;
  /** When bed boosts happen, shown under the boost options. */
  resetNote?: ReactNode;
}

export function CharacterForm({ character, onChange, onReset, table, compact, resetNote }: Props) {
  const { t } = useT();
  const set = <K extends keyof Character>(key: K, value: Character[K]) =>
    onChange({ ...character, [key]: value });

  return (
    <section className={compact ? undefined : "card"} aria-labelledby={compact ? undefined : "form-heading"}>
      {!compact && (
        <div className="card-head">
          <h2 id="form-heading">{t("char.title")}</h2>
          <button type="button" className="link-button" onClick={onReset}>
            {t("char.clear")}
          </button>
        </div>
      )}

      <form className="fields" onSubmit={(e) => e.preventDefault()}>
        {!compact && (
          <label className="field span-2">
            <span>{t("char.name")} <em>{t("common.optional")}</em></span>
            <input
              value={character.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={t("char.namePh")}
              maxLength={40}
            />
          </label>
        )}

        <label className="field">
          <span>{t("char.season")}</span>
          <select value={character.season} onChange={(e) => set("season", e.target.value)}>
            {seasons.map((s) => (
              <option key={s.season} value={s.season}>
                {t("common.seasonN", { n: s.season })}
              </option>
            ))}
          </select>
          {table && (
            <small>{t("char.levels", { min: table.minLevel, max: table.maxLevel })}</small>
          )}
        </label>

        <label className="field">
          <span>{t("char.level")}</span>
          <input
            inputMode="numeric"
            value={character.level}
            onChange={(e) => set("level", e.target.value)}
            placeholder={table ? String(table.minLevel) : ""}
          />
        </label>

        <fieldset className="field span-2">
          <legend>{t("char.progress")}</legend>
          <div className="with-toggle">
            {character.progressMode === "xp" ? (
              <input
                inputMode="text"
                aria-label={t("char.xpAria")}
                value={character.currentXp}
                onChange={(e) => set("currentXp", e.target.value)}
                placeholder={t("char.xpPh")}
              />
            ) : (
              <input
                inputMode="decimal"
                aria-label={t("char.pctAria")}
                value={character.percent}
                onChange={(e) => set("percent", e.target.value)}
                placeholder={t("char.pctPh")}
              />
            )}
            <div className="segmented" role="group" aria-label={t("char.unit")}>
              <button
                type="button"
                aria-pressed={character.progressMode === "xp"}
                onClick={() => set("progressMode", "xp")}
              >
                XP
              </button>
              <button
                type="button"
                aria-pressed={character.progressMode === "percent"}
                onClick={() => set("progressMode", "percent")}
              >
                %
              </button>
            </div>
          </div>
        </fieldset>

        <label className="field span-2">
          <span>{t("char.rate")}</span>
          <input
            inputMode="text"
            value={character.rate}
            onChange={(e) => set("rate", e.target.value)}
            placeholder={t("char.ratePh")}
          />
          <small>{t("char.rateHint")}</small>
        </label>

        {!compact && (
          <fieldset className="field span-2 boosts">
            <legend>{t("char.boosts")} <em>{t("common.optional")}</em></legend>
            <label className="check boost-row">
              <input type="checkbox" checked={!!character.bedBoost} onChange={(e) => set("bedBoost", e.target.checked)} />
              <span className="boost-icon" aria-hidden>🛏️</span>
              <span>
                {t("char.bed")}
                <small>{t("char.bedHint")}</small>
              </span>
            </label>
            {character.bedBoost && (
              <label className="check boost-sub">
                <input type="checkbox" checked={character.bedToday !== false} onChange={(e) => set("bedToday", e.target.checked)} />
                <span>
                  {t("char.bedToday")}
                  <small>{t("char.bedTodayHint")}</small>
                </span>
              </label>
            )}
            <label className="boost-row crystals">
              <img src={`${import.meta.env.BASE_URL}art/items/item_120.png`} alt="" className="boost-icon" />
              <span>
                {t("char.crystals")}
                <small>{t("char.crystalsHint")}</small>
              </span>
              <input
                inputMode="numeric"
                aria-label={t("char.crystals")}
                value={character.crystals ?? ""}
                onChange={(e) => set("crystals", e.target.value)}
                placeholder="0"
              />
            </label>
            {resetNote && <p className="hint boost-note">{resetNote}</p>}
          </fieldset>
        )}

        {!compact && (
          <label className="field span-2">
            <span>{t("char.goal")} <em>{t("common.optional")}</em></span>
            <input
              inputMode="numeric"
              value={character.goalLevel}
              onChange={(e) => set("goalLevel", e.target.value)}
              placeholder={t("char.goalPh")}
            />
            <small>{t("char.goalHint")}</small>
          </label>
        )}
      </form>
    </section>
  );
}
