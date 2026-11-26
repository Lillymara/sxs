// "Fill from screenshots": reads game screenshots on the player's device and fills the planner
// after they check what was found.
import { useEffect, useRef, useState } from "react";
import type { ReadErrorCode, ScreenRead } from "../../lib/screens/read";
import { getRule } from "../../data/seasons";
import { CART_KEYS, mergeReads, readGearPieces, type CartKey, type Found } from "./fromScreens";
import { rich, useT } from "../../i18n";
import type { MessageKey } from "../../i18n/en";

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

/** Error codes; what each means (in words a player can act on) is in the translations as si.err.CODE. CRASH is spotted on the next visit. */
type ErrorCode = ReadErrorCode | "CRASH";
const BATCH_KEY = "sxs.shotBatch";
const TIME_LIMIT = 120_000;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Where the reader is used. The Level Timer only needs the Character and Bed screens and the four
 * character values; the planner uses all five screens.
 */
export type ImportScope = "planner" | "timer";

/**
 * The SxS Overlay Android app (the floating bubble over the game) adds this to the page. Its capture()
 * hides the panel, reads the game screen behind it, and answers with an "sxs-overlay-shot" event.
 */
type OverlayBridge = { capture: () => void };
type OverlayShot = { image?: string; error?: string };
const overlay = () => (window as Window & { SxSOverlay?: OverlayBridge }).SxSOverlay;

/** A data URL from the app as a File, so it goes through the same reader as a picked screenshot. */
function dataUrlFile(url: string, name: string): File {
  const [head, body = ""] = url.split(",");
  const type = /^data:([^;,]+)/.exec(head)?.[1] ?? "image/jpeg";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], `${name}.${type === "image/png" ? "png" : "jpg"}`, { type, lastModified: Date.now() });
}
const TIMER_SCREENS = ["character", "bed"];

export function ScreenshotImport({ season, onApply, scope = "planner" }: { season: number; onApply: (found: Found) => void; scope?: ImportScope }) {
  const { t } = useT();
  const timer = scope === "timer";
  // The guide's text in the chosen language (the image and key stay as listed in GUIDE).
  const g = (key: string, part: string) => t(`si.g.${key}.${part}` as MessageKey);
  const guide = (timer ? GUIDE.filter((x) => TIMER_SCREENS.includes(x.key)) : GUIDE).map((x) => ({
    ...x,
    title: g(x.key, "title"),
    where: g(x.key, "where"),
    fills: timer && x.key === "character" ? g(x.key, "fillsTimer") : g(x.key, "fills"),
    reads: g(x.key, "reads"),
  }));
  const fillLabel = timer ? t("si.fillTimer") : t("si.fillPlanner");
  const errText = (code: string) => t(`si.err.${code}` as MessageKey);
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
  const inOverlay = !!overlay();
  /** Waiting on the app to read the game screen. */
  const [grabbing, setGrabbing] = useState(false);
  const grabs = useRef(0);

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
            last = { code, detail: String((e as Error)?.message ?? e).slice(0, 500) };
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
      setError(`${errText("LOAD")} (code LOAD)`);
      setStatuses((s) => s.slice(0, start));
    } finally {
      try {
        localStorage.removeItem(BATCH_KEY);
      } catch {
        /* storage unavailable */
      }
    }
  };

  // The app's answer to "Read the game screen". The ref keeps it reading into the latest batch.
  const readLatest = useRef(read);
  readLatest.current = read;
  useEffect(() => {
    if (!inOverlay) return;
    const onShot = (e: Event) => {
      const shot = ((e as CustomEvent<OverlayShot>).detail ?? {}) as OverlayShot;
      setGrabbing(false);
      if (!shot.image) {
        setError(shot.error ?? t("si.screenFail"));
        return;
      }
      grabs.current += 1;
      try {
        void readLatest.current([dataUrlFile(shot.image, `Game screen ${grabs.current}`)]);
      } catch {
        setError(t("si.screenDamaged"));
      }
    };
    window.addEventListener("sxs-overlay-shot", onShot);
    return () => window.removeEventListener("sxs-overlay-shot", onShot);
  }, [inOverlay]);
  // If the app never answers (it was closed mid-read), don't leave the button stuck.
  useEffect(() => {
    if (!grabbing) return;
    const t = setTimeout(() => setGrabbing(false), 90_000);
    return () => clearTimeout(t);
  }, [grabbing]);
  const grab = () => {
    setError("");
    setGrabbing(true);
    overlay()?.capture();
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
        <span aria-hidden>📷</span> {t("si.open")}
      </button>
    );
  }

  const field = (label: string, value: string | undefined, onEdit: (v: string) => void, hint?: string) => (
    <label className="shot-field" key={label}>
      <span>{label}</span>
      <input value={value ?? ""} onChange={(e) => onEdit(e.target.value)} placeholder={t("si.notFound")} />
      {hint && <small>{hint}</small>}
    </label>
  );
  const gearPieces = readGearPieces(found?.gearPieces);
  // The five gear pieces should add up to the season Gear total, when both were read.
  const gearMismatch = (() => {
    const pieces = gearPieces;
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
          <span aria-hidden>📷</span>{t("si.open")}
        </h2>
        <button type="button" className="link-button" onClick={() => setOpen(false)}>
          {t("si.close")}
        </button>
      </div>
      <p className="hint">
        {timer ? t("si.introTimer") : t("si.introPlanner")}
      </p>

      <details className="shot-guide" open={statuses.length === 0}>
        <summary>{t("si.how")}</summary>
        <ol className="shot-steps">
          {guide.map((g, i) => (
            <li key={g.key} className="shot-step">
              <a href={example(g.img)} target="_blank" rel="noreferrer" className="shot-thumb" title={t("si.openExample")}>
                <img src={example(g.img)} alt={t("si.exampleAlt", { title: g.title })} loading="lazy" />
              </a>
              <div>
                <p className="shot-step-title">
                  <span className="dawn-rank small" aria-hidden>
                    {i + 1}
                  </span>
                  {g.title}
                </p>
                <p>{rich(t("si.where", { text: g.where }))}</p>
                <p>{rich(t("si.fills", { text: g.fills }))}</p>
                <p className="hint">{g.reads}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="shot-tips">
          <p className="shot-step-title">{t("si.tips")}</p>
          <ul>
            {(["si.tip1", "si.tip2", "si.tip3", "si.tip4", "si.tip5", "si.tip6"] as const).map((k) => (
              <li key={k}>{rich(t(k))}</li>
            ))}
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
            const input = e.target;
            const picked = [...(input.files ?? [])];
            // Copy every picked file into memory straight away: some phone browsers only let a page
            // read picked files for a short while, or until the picker is cleared.
            void Promise.all(picked.map((f) => f.arrayBuffer().then((b) => new File([b], f.name, { type: f.type, lastModified: f.lastModified })).catch(() => f))).then(
              (copies) => {
                input.value = "";
                void read(copies);
              },
            );
          }}
        />
        <span>
          {busy
            ? t("si.reading")
            : statuses.length
              ? t("si.addMore")
              : t("si.choose")}
        </span>
      </label>
      {inOverlay && (
        <>
          <button type="button" className={`shot-drop${busy || grabbing ? " busy" : ""}`} disabled={busy || grabbing} onClick={grab}>
            <span>{grabbing ? t("si.readingScreen") : t("si.readScreen")}</span>
          </button>
          <p className="hint">
            {t("si.overlayHint")}
          </p>
        </>
      )}
      {error && <p className="error">{error}</p>}
      {crashed && (
        <p className="note warn">
          {rich(t("si.crash", { n: crashed.n, done: crashed.done }))} {errText("CRASH")}
        </p>
      )}

      {statuses.length > 0 && !busy && (
        <p className="hint">
          {t("si.addUp")}{" "}
          <button type="button" className="link-button" onClick={startOver}>
            {t("si.startOver")}
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
                  ? t("si.waiting")
                  : s.state === "reading"
                    ? t("si.readingShort")
                    : s.state === "failed"
                      ? t("si.couldnt", { code: s.code ?? "READ" })
                      : t(`si.kind.${s.read!.kind}` as MessageKey)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!busy && statuses.some((s) => s.state === "failed" || s.read?.kind === "unknown") && (
        <div className="note warn shot-errors">
          {[...new Set(statuses.filter((s) => s.state === "failed").map((s) => s.code ?? "READ"))].map((c) => (
            <p key={c}>{rich(t("si.code", { code: c, text: errText(c) }))}</p>
          ))}
          {statuses.some((s) => s.read?.kind === "unknown") && (
            <p>{rich(t("si.unknownNote"))}</p>
          )}
        </div>
      )}
      {!busy && (statuses.some((s) => s.state === "failed" || s.read?.kind === "unknown") || crashed) && (
        <p className="hint">
          {t("si.stuck")}{" "}
          <button type="button" className="link-button" onClick={copyDetails}>
            {copied ? t("si.copied") : t("si.copyDetails")}
          </button>{" "}
          {t("si.pasteDiscord")}
        </p>
      )}

      {timer && statuses.some((st) => st.read && st.read.kind !== "unknown" && !TIMER_SCREENS.includes(st.read.kind)) && (
        <p className="hint">
          {t("si.notNeeded")} <a href="/planner">{t("si.planner")}</a>.
        </p>
      )}
      {found && !busy && (
        <div className="shot-review">
          <h3 className="subhead">{t("si.check", { n: count })}</h3>
          {count > 0 && (
            <div className="shot-apply-top">
              <p className="hint">
                {timer ? t("si.nothingGoesTimer") : t("si.nothingGoesPlanner")}
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
              <p className="note warn">{rich(t("si.missing", { list: missing.join(", ") }))}</p>
            ) : null;
          })()}
          {count === 0 ? (
            <p className="note warn">{t("si.nothing")}</p>
          ) : (
            <>
              <div className="shot-grid">
                {field(t("si.f.season"), found.season, (v) => setFound({ ...found, season: v }))}
                {field(t("si.f.level"), found.level, (v) => setFound({ ...found, level: v }))}
                {field(t("si.f.xp"), found.xp, (v) => setFound({ ...found, xp: v }))}
                {field(t("si.f.rate"), found.rate, (v) => setFound({ ...found, rate: v }))}
                {!timer && (
                  <>
                {CART_KEYS.map((k) => field(t("si.f.cartHr", { name: CART_LABELS[k] }), found.cart[k], (v) => setFound({ ...found, cart: { ...found.cart, [k]: v } })))}
                {field(
                  t("si.f.gear"),
                  found.gearPieces,
                  (v) => setFound({ ...found, gearPieces: v }),
                  t("si.f.gearHint"),
                )}
                {!gearPieces && (
                  <p className="hint warn shot-mismatch">{t("si.gearIncomplete")}</p>
                )}
                {gearMismatch && (
                  <p className="hint warn shot-mismatch">{t("si.gearMismatch")}</p>
                )}
                {CART_KEYS.map((k) =>
                  field(
                    t("si.f.onHand", { name: CART_LABELS[k] }),
                    found.have?.[k],
                    (v) => setFound({ ...found, have: { ...found.have, [k]: v } }),
                    k === "sand" ? t("si.f.sandHint") : k === "treats" ? t("si.f.treatsHint") : undefined,
                  ),
                )}
                {field(t("si.f.refined"), found.refinedOre, (v) => setFound({ ...found, refinedOre: v }), t("si.f.refinedHint"))}
                {(["ore", "rola", "essence", "sand"] as const).map((k) =>
                  field(TOOL_LABELS[k], found.tools?.[k], (v) => setFound({ ...found, tools: { ...found.tools, [k]: v } }), t("si.f.toolHint")),
                )}
                {(Object.keys(LEVEL_LABELS) as (keyof typeof LEVEL_LABELS)[]).map((k) =>
                  field(
                    t("si.f.seasonLevel", { name: t(`sum.cat.${k}` as MessageKey) }),
                    found.levels[k],
                    (v) => setFound({ ...found, levels: { ...found.levels, [k]: v } }),
                    k === "gear" ? t("si.f.gearTotalHint") : t("si.f.levelHint"),
                  ),
                )}
                  </>
                )}
              </div>
              <p className="hint">{t("si.blank")}</p>
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
