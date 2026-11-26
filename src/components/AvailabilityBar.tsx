import { useId, useState } from "react";
import { effectiveDay1, type ServerChoice } from "../pages/calendar/server";
import { ServerSearch } from "./ServerSearch";
import { useT } from "../i18n";

interface Props {
  choice: ServerChoice;
  onServerChange: (c: ServerChoice) => void;
  onlyObtainable: boolean;
  onToggle: (v: boolean) => void;
  hiddenCount: number;
  /** What the filter hides, e.g. "Hides unreleased Fantomons and ...". */
  description: string;
  label?: string;
  hideLimited: boolean;
  onToggleLimited: (v: boolean) => void;
  limitedCount: number;
}

/** Server picker plus the "only what my server can get" filter for Fantomons and companions.
 *  On phones it folds into a one-line summary so the collection starts near the top of the page. */
export function AvailabilityBar({ choice, onServerChange, onlyObtainable, onToggle, hiddenCount, description, label, hideLimited, onToggleLimited, limitedCount }: Props) {
  const { t, tn, locale } = useT();
  const day1 = effectiveDay1(choice);
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const filtersOn = Number(onlyObtainable) + Number(hideLimited);
  const day1Text = day1 ? t("cal.day1Date", { date: day1.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" }) }) : "";

  return (
    <div className={`availability-bar${open ? " open" : ""}`}>
      <button type="button" className="availability-summary" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
        <span className="availability-summary-text">
          <span className="eyebrow">{t("cal.yourServer")}</span>
          <b>{day1 ? choice.name || t("av.custom") : t("av.notPicked")}</b>
          <small>
            {day1 ? day1Text : t("av.pickHint")}
            {filtersOn ? ` · ${tn("av.filtersOn", filtersOn)}` : ""}
          </small>
        </span>
        <span className="availability-action">{open ? t("av.done") : day1 ? t("av.change") : t("av.pick")}</span>
      </button>

      <div className="availability-body" id={bodyId}>
        <div className="availability-server">
          {day1 ? (
            <p className="server-now">
              <span className="eyebrow">{t("cal.yourServer")}</span>
              <b>{choice.name || t("av.custom")}</b>
              <small>{day1Text}</small>
            </p>
          ) : (
            <p className="hint">{t("av.pickLong")}</p>
          )}
          <ServerSearch choice={choice} onChange={onServerChange} />
        </div>
        <label className="toggle">
          <input type="checkbox" checked={onlyObtainable} onChange={(e) => onToggle(e.target.checked)} />
          <span className="toggle-track" aria-hidden />
          <span>
            <b>{label ?? t("av.only")}</b>
            <small>
              {description}
              {onlyObtainable && hiddenCount ? ` · ${t("av.hidden", { n: hiddenCount })}` : ""}.
            </small>
          </span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={hideLimited} onChange={(e) => onToggleLimited(e.target.checked)} />
          <span className="toggle-track" aria-hidden />
          <span>
            <b>{t("av.hideLimited")}</b>
            <small>
              {t("av.hideLimitedDesc")}
              {hideLimited && limitedCount ? ` · ${t("av.hidden", { n: limitedCount })}` : ""}.
            </small>
          </span>
        </label>
      </div>
    </div>
  );
}
