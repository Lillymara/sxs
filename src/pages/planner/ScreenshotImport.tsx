// "Fill from screenshots": reads game screenshots on the player's device and fills the planner
// after they check what was found.
import { useEffect, useState } from "react";
import type { ReadErrorCode, ScreenRead } from "../../lib/screens/read";
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
    fills: "Rola, Ore, Refined Ore, Essence, Sand and Treats on hand, plus saved Realm tools.",
    reads: "Recognises the outlined items by their icons and reads each count. Chrono Sand grades are added as White Sand, and treat grades as Basic Treats.",
  },
];

type Status = { file: string; state: "waiting" | "reading" | "done" | "failed"; read?: ScreenRead; code?: ErrorCode; detail?: string; size?: number; tries?: number };

/** What each error code means, in words a player can act on. CRASH is spotted on the next visit. */
type ErrorCode = ReadErrorCode | "CRASH";
const ERRORS: Record<ErrorCode, string> = {
  IMG: "The image couldn't be opened. It may be a format this browser can't show (like HEIC), or still downloading from cloud storage. Save it to the phone as a normal screenshot (PNG or JPG) and try again.",
  MEM: "Your browser ran out of memory for pictures. Pick fewer screenshots at a time (one or two), or close other tabs.",
  LOAD: "The text reader didn't download. Check your connection and try again.",
  READ: "The text reader stopped part-way. Try this screenshot again on its own.",
  SLOW: "Reading took too long and was stopped. Try this screenshot again on its own.",
  CRASH: "Your browser closed the page part-way through the last batch, almost always from running out of memory. Pick one or two screenshots at a time.",
};
const BATCH_KEY = "sxs.shotBatch";
const TIME_LIMIT = 120_000;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Where the reader is used. The Level Timer only needs the Character and Bed screens and the four
 * character values; the planner uses all five screens.
 */
export type ImportScope = "planner" | "timer";
const TIMER_SCREENS = ["character", "bed"];

export function ScreenshotImport({ season, onApply, scope = "planner" }: { season: number; onApply: (found: Found) => void; scope?: ImportScope }) {
  const timer = scope === "timer";
  const guide = timer
    ? GUIDE.filter((g) => TIMER_SCREENS.includes(g.key)).map((g) => (g.key === "character" ? { ...g, fills: "level and EXP into the level." } : g))
    : GUIDE;
  const target = timer ? "the Level Timer" : "the planner";
  const fillLabel = timer ? "Fill the Level Timer" : "Fill the planner";
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  /** A batch that never finished last time: the page was closed under it. */
  const [crashed, setCrashed] = useState<{ n: number; done: number; files: string[] } | null>(null);
  useEffect(() => {
    try {
      const b = JSON.parse(localStorage.getItem(BATCH_KEY) ?? "null");
      localStorage.removeItem(BATCH_KEY);
      if (b && Date.now() - b.at < 30 * 60_000) {
        setCrashed(b);
        setOpen(true);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);
  const busy = statuses.some((s) => s.state === "waiting" || s.state === "reading");

  /** Each pick adds to the screenshots already read, so they can be chosen one at a time (as phones tend to). */
  const read = async (files: File[]) => {
    if (!files.length) return;
    setError("");
    setCrashed(null);
    setCopied(false);
    const start = statuses.length;
    const earlier = statuses.flatMap((s) => (s.read ? [s.read] : []));
    setStatuses((s) => [...s, ...files.map((f): Status => ({ file: f.name, state: "waiting", size: f.size }))]);
    // Noted while reading, so if the browser closes the page part-way we can say so next time.
    const note = (done: number) => {
      try {
        localStorage.setItem(BATCH_KEY, JSON.stringify({ at: Date.now(), n: files.length, done, files: files.map((f) => `${f.name} (${Math.round(f.size / 1024)} KB)`) }));
      } catch {
        /* storage unavailable */
      }
    };
    try {
      const { readScreenshot, releaseCanvases, resetReaders } = await import("../../lib/screens/read");
      const reads: ScreenRead[] = [...earlier];
      const once = (f: File) =>
        Promise.race([
          readScreenshot(f, season),
          pause(TIME_LIMIT).then(() => {
            throw Object.assign(new Error("Timed out"), { code: "SLOW" });
          }),
        ]);
      for (let i = 0; i < files.length; i++) {
        const at = start + i;
        note(i);
        setStatuses((s) => s.map((x, j) => (j === at ? { ...x, state: "reading" } : x)));
        let last: { code: ErrorCode; detail: string } | null = null;
        // A failed read gets one more go after memory is freed and the reader restarted.
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const r = await once(files[i]);
            reads.push(r);
            last = null;
            setStatuses((s) => s.map((x, j) => (j === at ? { ...x, state: "done", read: r, tries: attempt } : x)));
            break;
          } catch (e) {
            const code = ((e as { code?: ErrorCode }).code ?? "READ") as ErrorCode;
            last = { code, detail: String((e as Error)?.message ?? e).slice(0, 200) };
            if (code === "LOAD") throw e;
            releaseCanvases();
            if (code === "SLOW" || code === "READ") await resetReaders();
            await pause(400);
          }
        }
        if (last) setStatuses((s) => s.map((x, j) => (j === at ? { ...x, state: "failed", code: last!.code, detail: last!.detail, tries: 2 } : x)));
        // A breather between screenshots lets the browser tidy up memory.
        await pause(150);
      }
      setFound(mergeReads(reads, season));
    } catch {
      setError(`${ERRORS.LOAD} (code LOAD)`);
      setStatuses((s) => s.slice(0, start));
    } finally {
      try {
        localStorage.removeItem(BATCH_KEY);
      } catch {
        /* storage unavailable */
      }
    }
  };

  /** Everything useful for a bug report, to paste in Discord. No screenshots or game numbers. */
  const copyDetails = async () => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lines = [
      `SxS Tools screenshot report (${new Date().toISOString()})`,
      `Browser: ${navigator.userAgent}`,
      `Screen: ${screen.width}×${screen.height} @${devicePixelRatio}x${nav.deviceMemory ? `, ~${nav.deviceMemory} GB memory` : ""}`,
      ...(crashed ? [`Last batch stopped (CRASH) after ${crashed.done} of ${crashed.n}: ${crashed.files.join(", ")}`] : []),
      ...statuses.map(
        (st) =>
          `- ${st.file} (${st.size ? Math.round(st.size / 1024) : "?"} KB): ${st.state}${st.read ? ` → ${st.read.kind}` : ""}${st.code ? ` [${st.code}] ${st.detail ?? ""}` : ""}${st.tries && st.tries > 1 && st.state === "done" ? " (worked on retry)" : ""}`,
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
    } catch {
      window.prompt("Copy this report:", lines.join("\n"));
    }
  };
  const startOver = () => {
    setStatuses([]);
    setFound(null);
    setError("");
    setCrashed(null);
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
      refinedOre: clean(found.refinedOre),
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
    ? timer
      ? [found.season, found.level, found.xp, found.rate].filter((v) => v !== undefined).length
      : [found.season, found.level, found.xp, found.rate, found.gearPieces, ...Object.values(found.cart), ...Object.values(found.levels), ...Object.values(found.have ?? {}), found.refinedOre, ...Object.values(found.tools ?? {})].filter((v) => v !== undefined).length
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
        everything before it goes into {target}.
        {timer && <> The Season Planner gets the same character numbers.</>}
      </p>

      <details className="shot-guide" open={statuses.length === 0}>
        <summary>How to take the screenshots</summary>
        <ol className="shot-steps">
          {guide.map((g, i) => (
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
      {crashed && (
        <p className="note warn">
          <b>Code CRASH:</b> your last batch of {crashed.n} screenshots stopped after {crashed.done}. {ERRORS.CRASH}
        </p>
      )}

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
                {s.state === "waiting"
                  ? "Waiting"
                  : s.state === "reading"
                    ? "Reading…"
                    : s.state === "failed"
                      ? `Couldn't read (code ${s.code ?? "READ"})`
                      : KIND_LABELS[s.read!.kind]}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!busy && statuses.some((s) => s.state === "failed" || s.read?.kind === "unknown") && (
        <div className="note warn shot-errors">
          {[...new Set(statuses.filter((s) => s.state === "failed").map((s) => s.code ?? "READ"))].map((c) => (
            <p key={c}>
              <b>Code {c}:</b> {ERRORS[c]}
            </p>
          ))}
          {statuses.some((s) => s.read?.kind === "unknown") && (
            <p>
              <b>Not recognised:</b> the screenshot opened fine but didn't look like one of the screens above. Check it's the whole screen, uncropped,
              with no pop-up covering it.
            </p>
          )}
        </div>
      )}
      {!busy && (statuses.some((s) => s.state === "failed" || s.read?.kind === "unknown") || crashed) && (
        <p className="hint">
          Still stuck?{" "}
          <button type="button" className="link-button" onClick={copyDetails}>
            {copied ? "Copied" : "Copy details for a bug report"}
          </button>{" "}
          and paste them in the Discord. They list your browser and each file's size and result, not your screenshots or numbers.
        </p>
      )}

      {timer && statuses.some((st) => st.read && st.read.kind !== "unknown" && !TIMER_SCREENS.includes(st.read.kind)) && (
        <p className="hint">
          Cart, Season and Backpack screenshots aren't needed here. Use them in the <a href="/planner">Season Planner</a>.
        </p>
      )}
      {found && !busy && (
        <div className="shot-review">
          <h3 className="subhead">Check what was found ({count})</h3>
          {count > 0 && (
            <div className="shot-apply-top">
              <p className="hint">
                Nothing goes into {target} until you tap {fillLabel}. Check the boxes below first, or fill now.
              </p>
              <button type="button" className="spin-button" onClick={apply}>
                {fillLabel}
              </button>
            </div>
          )}
          {(() => {
            // A Backpack was read, but some materials weren't on it: usually they're further down the list.
            const bagRead = statuses.some((st) => st.read?.kind === "backpack");
            if (!bagRead || timer) return null;
            const missing = [
              ...(["ore", "essence", "sand", "treats"] as const).filter((k) => found.have?.[k] === undefined).map((k) => CART_LABELS[k]),
              ...(["ore", "rola", "essence", "sand"] as const).filter((k) => found.tools?.[k] === undefined).map((k) => TOOL_LABELS[k]),
              ...(found.refinedOre === undefined ? ["Refined Ore"] : []),
            ];
            return missing.length ? (
              <p className="note warn">
                Not found in your Backpack: <b>{missing.join(", ")}</b>. They may be further down the list or cut off at the bottom. Scroll so
                they show with their numbers and tap <b>Add more screenshots</b>.
              </p>
            ) : null;
          })()}
          {count === 0 ? (
            <p className="note warn">Nothing could be read. Try uncropped screenshots of the screens listed above.</p>
          ) : (
            <>
              <div className="shot-grid">
                {field("Season", found.season, (v) => setFound({ ...found, season: v }))}
                {field("Level", found.level, (v) => setFound({ ...found, level: v }))}
                {field("EXP into level", found.xp, (v) => setFound({ ...found, xp: v }))}
                {field("EXP per hour", found.rate, (v) => setFound({ ...found, rate: v }))}
                {!timer && (
                  <>
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
                {field("Refined Ore on hand", found.refinedOre, (v) => setFound({ ...found, refinedOre: v }), "Gear needs it every 5 levels")}
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
                  </>
                )}
              </div>
              <p className="hint">Blank fields are left as they are. Edit anything that was misread.</p>
              <button type="button" className="spin-button" onClick={apply}>
                {fillLabel}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
