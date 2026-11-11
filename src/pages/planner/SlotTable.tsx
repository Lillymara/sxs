import { useState } from "react";
import type { SlotForm } from "./form";

interface Props {
  names: string[];
  rows: SlotForm[];
  onChange: (rows: SlotForm[]) => void;
  /** Shown as placeholders: the season baseline, e.g. "130" or "+13". */
  baseline: string;
  /** Highest planned level the character can reach; null when there is no known cap. */
  cap: number | null;
  prefix?: string;
  /** Inputs that can't happen in the game, as "index:current" / "index:planned". */
  invalid?: Set<string>;
  /** What one slot is called, for the "Set every …" label (e.g. "skill"). */
  noun?: string;
  /** A one-tap current level for every slot, e.g. the character's level for skills. */
  quick?: { label: string; value: string };
}

/** Current → planned levels for a group of slots, with "set all" shortcuts. */
export function SlotTable({ names, rows, onChange, baseline, cap, prefix = "", invalid, noun = "slot", quick }: Props) {
  const [allCurrent, setAllCurrent] = useState("");
  const [allPlanned, setAllPlanned] = useState("");

  const update = (i: number, key: keyof SlotForm, value: string) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  /** Fills every slot with whichever levels were typed; a blank box leaves that column alone. */
  const applyAll = () => {
    if (!allCurrent.trim() && !allPlanned.trim()) return;
    onChange(
      rows.map((r) => ({
        current: allCurrent.trim() ? allCurrent.trim() : r.current,
        planned: allPlanned.trim() ? allPlanned.trim() : r.planned,
      })),
    );
  };
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyAll();
    }
  };

  return (
    <div className="slots">
      <div className="slot-all">
        <span className="slot-all-label">Set every {noun}</span>
        <input aria-label={`Every ${noun}: current level`} value={allCurrent} onChange={(e) => setAllCurrent(e.target.value)} onKeyDown={onEnter} placeholder={`now · ${prefix}${baseline}`} />
        <span aria-hidden>→</span>
        <input aria-label={`Every ${noun}: planned level`} value={allPlanned} onChange={(e) => setAllPlanned(e.target.value)} onKeyDown={onEnter} placeholder="plan" />
        <button type="button" className="set-all" onClick={applyAll} disabled={!allCurrent.trim() && !allPlanned.trim()}>
          Set all
        </button>
      </div>
      {quick && (
        <button type="button" className="link-button slot-quick" onClick={() => onChange(rows.map((r) => ({ ...r, current: quick.value })))}>
          {quick.label}
        </button>
      )}
      <div className="slot-grid">
        {rows.map((r, i) => {
          const over = cap !== null && r.planned !== "" && Number(r.planned.replace(/^\+/, "")) > cap;
          const badCurrent = invalid?.has(`${i}:current`);
          const badPlanned = invalid?.has(`${i}:planned`);
          return (
            <div className="slot-row" key={i}>
              <span>{names[i]}</span>
              <input aria-label={`${names[i]} current`} aria-invalid={badCurrent || undefined} className={badCurrent ? "silly" : undefined} value={r.current} onChange={(e) => update(i, "current", e.target.value)} placeholder={`${prefix}${baseline}`} />
              <span aria-hidden>→</span>
              <input
                aria-label={`${names[i]} planned`}
                aria-invalid={over || badPlanned || undefined}
                className={badPlanned ? "silly" : over ? "over-cap" : undefined}
                value={r.planned}
                onChange={(e) => update(i, "planned", e.target.value)}
                placeholder="same"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
