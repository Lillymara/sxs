// "Fill from screenshots": reads game screenshots on the player's device and fills the planner
// after they check what was found.
import { useState } from "react";
import type { ScreenRead } from "../../lib/screens/read";
import { getRule } from "../../data/seasons";
import { CART_KEYS, mergeReads, readGearPieces, type CartKey, type Found } from "./fromScreens";

const KIND_LABELS: Record<ScreenRead["kind"], string> = {
  bed: "Bed",
  cart: "Cart",
  progression: "Season progression",
  character: "Character",
  backpack: "Backpack",
  unknown: "Not recognised",
};
const CART_LABELS: Record<CartKey, string> = { rola: "Rola", ore: "Ore", essence: "Essence", sand: "Sand", treats: "Treats" };
const TOOL_LABELS = { ore: "Iron Hammers", rola: "Gold Pickaxes", essence: "Worn Knuckles", sand: "Sand Shovels" } as const;
const LEVEL_LABELS = { gear: "Gear", skill: "Skills", fantomon: "Fantomons", relic: "Relics" } as const;

const ART = `${import.meta.env.BASE_URL}art/screens/`;
/** Example image URL, stamped with the build so an updated example isn't hidden behind the browser cache. */
const example = (img: string) => `${ART}${img}?v=${__BUILD_ID__}`;

/** One example per screen the reader understands. Example images have every number blurred. */
const GUIDE = [
  {
    key: "character",
    title: "Character",
    img: "character.jpg",
    where: "your home screen: tap Character in the bottom bar.",
    fills: "level, EXP into the level, and each gear piece's level.",
    reads: "Reads the EXP figure beside the level bar (like 438K/1.53M) and works your level out from it, plus the +level badge on all five gear pieces.",
  },
  {
    key: "bed",
    title: "Bed",
    img: "bed.jpg",
    where: "tap Home (the house icon in the middle of the bottom bar), then tap the Bed.",
    fills: "EXP per hour.",
    reads: "Reads the EXP/Hr line.",
  },
  {
    key: "cart",
    title: "Cart",
    img: "cart.jpg",
    where: "tap Home (the house icon in the middle of the bottom bar), then tap the Cart.",
    fills: "hourly Rola, Ore, Essence, Sand and Treats.",
    reads: "Reads every row's +amount/h. Rows are matched by their place in the list, so keep the whole Cart panel in view.",
  },
  {
    key: "progression",
    title: "Season → Progression",
    img: "progression.jpg",
    where: "tap the Thrilling Event chest in the top right, choose the Season event (for example S1. Witching Hours), then tap Progression at the bottom.",
    fills: "the season and your Gear, Skill, Fantomon and Relic levels.",
    reads: "Reads the points under each Season level (and the season from the title), then turns points into levels.",
  },
  {
    key: "backpack",
    title: "Backpack",
    img: "backpack.jpg",
    where: "open your Backpack (the Item screen). Scroll so your materials and Realm tools show; take more than one screenshot if they don't fit.",
    fills: "Rola, Ore, Essence, Sand and Treats on hand, plus saved Realm tools (Full mode).",
    reads: "Recognises the outlined items by their icons and reads each count. Chrono Sand grades are added as White Sand, and treat grades as Basic Treats.",
  },
];

type Status = { file: string; state: "waiting" | "reading" | "done" | "failed"; read?: ScreenRead };

export function ScreenshotImport({ season, onApply }: { season: number; onApply: (found: Found) => void }) {
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState("");
  const busy = statuses.some((s) => s.state === "waiting" || s.state === "reading");

  /** Each pick adds to the screenshots already read, so they can be chosen one at a time (as phones tend to). */
  const read = async (files: File[]) => {
    if (!files.length) return;
    setError("");
    const start = statuses.length;
    const earlier = statuses.flatMap((s) => (s.read ? [s.read] : []));
    setStatuses((s) => [...s, ...files.map((f): Status => ({ file: f.name, state: "waiting" }))]);
    try {
      const { readScreenshot } = await import("../../lib/screens/read");
      const reads: ScreenRead[] = [...earlier];
      for (let i = 0; i < files.length; i++) {
        const at = start + i;
        setStatuses((s) => s.map((x, j) => (j === at ? { ...x, state: "reading" } : x)));
        try {
          const r = await readScreenshot(files[i], season);
          reads.push(r);
          setStatuses((s) => s.map((x, j) => (j === at ? { ...x, state: "done", read: r } : x)));
        } catch {
          setStatuses((s) => s.map((x, j) => (j === at ? { ...x, state: "failed" } : x)));
        }
      }
      setFound(mergeReads(reads, season));
    } catch {
      setError("The text reader couldn't load. Check your connection and try again.");
      setStatuses((s) => s.slice(0, start));
    }
  };
  const startOver = () => {
    setStatuses([]);
    setFound(null);
    setError("");
  };

  const apply = () => {
    if (!found) return;
    // Treat blanks as "leave alone".
    const clean = (v?: string) => (v && v.trim() ? v.trim() : undefined);
    onApply({
      season: clean(found.season),
      level: clean(found.level),
      xp: clean(found.xp),
      rate: clean(found.rate),
      gearPieces: clean(found.gearPieces),
      have: Object.fromEntries(Object.entries(found.have ?? {}).filter(([, v]) => clean(v))),
      tools: Object.fromEntries(Object.entries(found.tools ?? {}).filter(([, v]) => clean(v))),
      cart: Object.fromEntries(Object.entries(found.cart).filter(([, v]) => clean(v))),
      levels: Object.fromEntries(Object.entries(found.levels).filter(([, v]) => clean(v))),
    });
    setOpen(false);
    startOver();
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
  // The five gear pieces should add up to the season Gear total, when both were read.
  const gearMismatch = (() => {
    const pieces = readGearPieces(found?.gearPieces);
    const rule = getRule(Number(found?.season) || season);
    const total = Number(found?.levels.gear);
    if (!pieces || !rule || !found?.levels.gear || !Number.isFinite(total)) return false;
    return pieces.reduce((a, v) => a + v - rule.floor, 0) !== total;
  })();
  const count = found
    ? [found.season, found.level, found.xp, found.rate, found.gearPieces, ...Object.values(found.cart), ...Object.values(found.levels), ...Object.values(found.have ?? {}), ...Object.values(found.tools ?? {})].filter((v) => v !== undefined).length
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
        Take screenshots of the screens below in the game, then pick them here. They're read on your device and never uploaded, and you check
        everything before it goes into the planner.
      </p>

      <details className="shot-guide" open={statuses.length === 0}>
        <summary>How to take the screenshots</summary>
        <ol className="shot-steps">
          {GUIDE.map((g, i) => (
            <li key={g.key} className="shot-step">
              <a href={example(g.img)} target="_blank" rel="noreferrer" className="shot-thumb" title="Open the full example">
                <img src={example(g.img)} alt={`Example ${g.title} screenshot, with the part that's read outlined`} loading="lazy" />
              </a>
              <div>
                <p className="shot-step-title">
                  <span className="dawn-rank small" aria-hidden>
                    {i + 1}
                  </span>
                  {g.title}
                </p>
                <p>
                  <b>Where:</b> {g.where}
                </p>
                <p>
                  <b>Fills in:</b> {g.fills}
                </p>
                <p className="hint">{g.reads}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="shot-tips">
          <p className="shot-step-title">Tips for a clean read</p>
          <ul>
            <li>Screenshot the <b>whole screen</b>. Don't crop or zoom: the reader finds numbers by where they sit.</li>
            <li>Close any pop-up, tooltip or chat that covers the numbers.</li>
            <li>Any phone or tablet size works. Pick them all at once or one at a time, in any order, or just the ones you want.</li>
            <li>Take them together, so the numbers match each other.</li>
            <li>The outlined parts in the examples are what's read. Everything else is ignored.</li>
            <li>If something reads wrong, just fix it in the box before filling the planner.</li>
          </ul>
        </div>
      </details>

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
        <span>
          {busy
            ? "Reading… the first time takes a little longer while the reader downloads."
            : statuses.length
              ? "Add more screenshots"
              : "Choose screenshots"}
        </span>
      </label>
      {error && <p className="error">{error}</p>}

      {statuses.length > 0 && !busy && (
        <p className="hint">
          Screenshots add up, so you can pick them one at a time.{" "}
          <button type="button" className="link-button" onClick={startOver}>
            Start over
          </button>
        </p>
      )}
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
          {count > 0 && (
            <div className="shot-apply-top">
              <p className="hint">Nothing goes into the planner until you tap Fill the planner. Check the boxes below first, or fill now.</p>
              <button type="button" className="spin-button" onClick={apply}>
                Fill the planner
              </button>
            </div>
          )}
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
                {field(
                  "Gear pieces",
                  found.gearPieces,
                  (v) => setFound({ ...found, gearPieces: v }),
                  "Each piece's level from the Character screen. Used instead of the gear total.",
                )}
                {gearMismatch && (
                  <p className="hint warn shot-mismatch">The gear pieces don't add up to the season Gear total. One of them may be misread, so check both.</p>
                )}
                {CART_KEYS.map((k) =>
                  field(
                    `${CART_LABELS[k]} on hand`,
                    found.have?.[k],
                    (v) => setFound({ ...found, have: { ...found.have, [k]: v } }),
                    k === "sand" ? "In White Sand (Rare ×5, Epic ×25)" : k === "treats" ? "As Basic Treats (Premium ×8, Deluxe ×40)" : undefined,
                  ),
                )}
                {(["ore", "rola", "essence", "sand"] as const).map((k) =>
                  field(TOOL_LABELS[k], found.tools?.[k], (v) => setFound({ ...found, tools: { ...found.tools, [k]: v } }), "Saved Realm tools"),
                )}
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
              <button type="button" className="spin-button" onClick={apply}>
                Fill the planner
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
