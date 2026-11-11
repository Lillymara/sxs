// "Fill from screenshots": reads game screenshots on the player's device and fills the planner
// after they check what was found.
import { useState } from "react";
import type { ScreenRead } from "../../lib/screens/read";
import { CART_KEYS, mergeReads, type CartKey, type Found } from "./fromScreens";

const KIND_LABELS: Record<ScreenRead["kind"], string> = {
  bed: "Bed",
  cart: "Cart",
  progression: "Season progression",
  character: "Character",
  unknown: "Not recognised",
};
const CART_LABELS: Record<CartKey, string> = { rola: "Rola", ore: "Ore", essence: "Essence", sand: "Sand", treats: "Treats" };
const LEVEL_LABELS = { gear: "Gear", skill: "Skills", fantomon: "Fantomons", relic: "Relics" } as const;

type Status = { file: string; state: "waiting" | "reading" | "done" | "failed"; read?: ScreenRead };

export function ScreenshotImport({ season, onApply }: { season: number; onApply: (found: Found) => void }) {
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState("");
  const busy = statuses.some((s) => s.state === "waiting" || s.state === "reading");

  const read = async (files: File[]) => {
    if (!files.length) return;
    setError("");
    setFound(null);
    setStatuses(files.map((f) => ({ file: f.name, state: "waiting" })));
    try {
      const { readScreenshot } = await import("../../lib/screens/read");
      const reads: ScreenRead[] = [];
      for (let i = 0; i < files.length; i++) {
        setStatuses((s) => s.map((x, j) => (j === i ? { ...x, state: "reading" } : x)));
        try {
          const r = await readScreenshot(files[i], season);
          reads.push(r);
          setStatuses((s) => s.map((x, j) => (j === i ? { ...x, state: "done", read: r } : x)));
        } catch {
          setStatuses((s) => s.map((x, j) => (j === i ? { ...x, state: "failed" } : x)));
        }
      }
      setFound(mergeReads(reads, season));
    } catch {
      setError("The text reader couldn't load. Check your connection and try again.");
      setStatuses([]);
    }
  };

  if (!open) {
    return (
      <button type="button" className="shot-open" onClick={() => setOpen(true)}>
        <span aria-hidden>📷</span> Fill from screenshots
      </button>
    );
  }

  const field = (label: string, value: string | undefined, onEdit: (v: string) => void, hint?: string) => (
    <label className="shot-field" key={label}>
      <span>{label}</span>
      <input value={value ?? ""} onChange={(e) => onEdit(e.target.value)} placeholder="not found" />
      {hint && <small>{hint}</small>}
    </label>
  );
  const count = found
    ? [found.season, found.level, found.xp, found.rate, ...Object.values(found.cart), ...Object.values(found.levels)].filter((v) => v !== undefined).length
    : 0;

  return (
    <section className="card shot-card">
      <div className="pcard-head">
        <h2>
          <span aria-hidden>📷</span>Fill from screenshots
        </h2>
        <button type="button" className="link-button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <p className="hint">
        Pick screenshots of these screens. They're read on your device and never uploaded. You check everything before it fills in.
      </p>
      <ul className="shot-list">
        <li>
          <b>Character</b> (home screen): level and EXP
        </li>
        <li>
          <b>Bed</b>: EXP per hour
        </li>
        <li>
          <b>Cart</b>: hourly income
        </li>
        <li>
          <b>Season → Progression</b>: season and system levels
        </li>
      </ul>
      <label className={`shot-drop${busy ? " busy" : ""}`}>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={(e) => {
            void read([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <span>{busy ? "Reading… the first time takes a little longer while the reader downloads." : "Choose screenshots"}</span>
      </label>
      {error && <p className="error">{error}</p>}

      {statuses.length > 0 && (
        <ul className="shot-status">
          {statuses.map((s, i) => (
            <li key={i}>
              <span className="shot-file">{s.file}</span>
              <span className={s.state === "done" && s.read?.kind !== "unknown" ? "ok-text" : s.state === "failed" || s.read?.kind === "unknown" ? "bad" : "hint"}>
                {s.state === "waiting" ? "Waiting" : s.state === "reading" ? "Reading…" : s.state === "failed" ? "Couldn't read" : KIND_LABELS[s.read!.kind]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {found && !busy && (
        <div className="shot-review">
          <h3 className="subhead">Check what was found ({count})</h3>
          {count === 0 ? (
            <p className="note warn">Nothing could be read. Try uncropped screenshots of the screens listed above.</p>
          ) : (
            <>
              <div className="shot-grid">
                {field("Season", found.season, (v) => setFound({ ...found, season: v }))}
                {field("Level", found.level, (v) => setFound({ ...found, level: v }))}
                {field("EXP into level", found.xp, (v) => setFound({ ...found, xp: v }))}
                {field("EXP per hour", found.rate, (v) => setFound({ ...found, rate: v }))}
                {CART_KEYS.map((k) => field(`Cart ${CART_LABELS[k]} / hr`, found.cart[k], (v) => setFound({ ...found, cart: { ...found.cart, [k]: v } })))}
                {(Object.keys(LEVEL_LABELS) as (keyof typeof LEVEL_LABELS)[]).map((k) =>
                  field(
                    `${LEVEL_LABELS[k]} season level`,
                    found.levels[k],
                    (v) => setFound({ ...found, levels: { ...found.levels, [k]: v } }),
                    "Total above the floor, spread evenly over slots",
                  ),
                )}
              </div>
              <p className="hint">Blank fields are left as they are. Edit anything that was misread.</p>
              <button
                type="button"
                className="spin-button"
                onClick={() => {
                  // Treat blanks as "leave alone".
                  const clean = (v?: string) => (v && v.trim() ? v.trim() : undefined);
                  onApply({
                    season: clean(found.season),
                    level: clean(found.level),
                    xp: clean(found.xp),
                    rate: clean(found.rate),
                    cart: Object.fromEntries(Object.entries(found.cart).filter(([, v]) => clean(v))),
                    levels: Object.fromEntries(Object.entries(found.levels).filter(([, v]) => clean(v))),
                  });
                  setOpen(false);
                  setStatuses([]);
                  setFound(null);
                }}
              >
                Fill the planner
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
