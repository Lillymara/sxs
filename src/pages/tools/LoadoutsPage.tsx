// Loadouts: pick a class, 4 skills in cast order, 4 charms and a Fantomon, then share the build as a link.
// Nothing is stored on a server; the link carries the whole build (src/lib/loadout.ts).
import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ClassSelect } from "../../components/ClassSelect";
import { GameArt } from "../../components/GameArt";
import { Icon } from "../../components/Icon";
import { GRADE_RANKS, gradeOfRank, rowText, type Explorer } from "../../lib/explorer";
import { buildFantomons } from "../../lib/fantomonView";
import { drawLoadout } from "../../lib/loadoutImage";
import type { Profession, SkillInfo } from "../../lib/gamedata";
import {
  MAX_RANK,
  NOTES_MAX,
  SKILL_SLOTS,
  TITLE_MAX,
  decodeLoadout,
  decodeShort,
  emptyLoadout,
  isEmpty,
  shareUrl,
  type Loadout,
  type SavedLoadout,
} from "../../lib/loadout";
import { usePersistentState } from "../../lib/storage";
import { GlossaryText, Loading, useExplorer } from "./shared";

type Slot = { kind: "skills" | "charms"; i: number } | { kind: "pet" };
const UNNAMED = /^(?:Skill \d+|DNTB)/i;

export function LoadoutsPage() {
  const { explorer, error } = useExplorer();
  return explorer ? <Loadouts explorer={explorer} /> : <Loading error={error} />;
}

function Loadouts({ explorer }: { explorer: Explorer }) {
  const { D } = explorer;
  const classes = D.professions;
  const pets = useMemo(() => buildFantomons(explorer), [explorer]);
  const [draft, setDraft] = usePersistentState<Loadout>("sxs.loadoutDraft", emptyLoadout(classes[0].code));
  const [saved, setSaved] = usePersistentState<{ items: SavedLoadout[] }>("sxs.loadouts", { items: [] });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot>({ kind: "skills", i: 0 });
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [opened, setOpened] = useState(false);
  const [nameNeeded, setNameNeeded] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  /** Your level and combat rank: the fixed part of skill numbers grows with both. Kept per browser. */
  const [calc, setCalc] = usePersistentState<{ level: number; combatRank: string }>("sxs.loadoutCalc", { level: 120, combatRank: "Silver3" });

  // A shared link (?b=…) opens straight into the builder.
  useEffect(() => {
    const short = /^\/l\/([A-Za-z0-9_-]+)/.exec(window.location.pathname)?.[1];
    const code = new URLSearchParams(window.location.search).get("b");
    if (!short && !code) return;
    const l = short ? decodeShort(short) : decodeLoadout(code!);
    if (l) {
      setDraft(clean(l, classes, D.skills));
      setEditingId(null);
      setOpened(true);
    }
    history.replaceState(null, "", "/loadouts");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const cls = classes.find((c) => c.code === draft.cls) ?? classes[0];
  const className = (code: string) => classes.find((c) => c.code === code)?.name ?? code;
  const skill = (id: number | null) => (id ? D.skills[String(id)] : undefined);
  const pet = pets.find((p) => p.id === draft.pet);

  const used = new Set([...draft.skills, ...draft.charms].filter(Boolean) as number[]);
  const pickKind = slot.kind === "charms" ? "charm" : "active";
  const q = query.trim().toLowerCase();
  const options =
    slot.kind === "pet"
      ? []
      : cls.skills
          .map((id) => D.skills[String(id)])
          .filter((s): s is SkillInfo => !!s && s.type === pickKind && !UNNAMED.test(s.name))
          .filter((s) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  // Group the options by the class in the chain they come from, newest class first.
  const groups = [...cls.chain].reverse().map((code) => ({ code, items: options.filter((s) => (cls.source?.[s.id] ?? cls.code) === code) })).filter((g) => g.items.length);
  const focused = slot.kind === "pet" ? undefined : skill(draft[slot.kind][slot.i]);

  const edit = (patch: Partial<Loadout>) => setDraft((d) => ({ ...d, ...patch }));

  /** A skill's rank in this build: what's been set, or the rank it starts at. */
  const baseRank = (s: SkillInfo) => Math.max(1, +s.rank || 1);
  const rankOf = (s: SkillInfo) => draft.ranks?.[String(s.id)] ?? baseRank(s);
  const setRank = (s: SkillInfo, rank: number) =>
    setDraft((d) => {
      const ranks = { ...(d.ranks ?? {}) };
      if (rank <= baseRank(s)) delete ranks[String(s.id)];
      else ranks[String(s.id)] = rank;
      return { ...d, ranks };
    });
  const gradeName = (raw: string) => explorer.grade(raw).name;

  /** Puts a skill in the open slot (moving it if it's already elsewhere), then opens the next empty slot. */
  const place = (id: number) => {
    if (slot.kind === "pet") return;
    const kind = slot.kind;
    const list = draft[kind].map((x) => (x === id ? null : x));
    list[slot.i] = id;
    edit({ [kind]: list });
    const nextEmpty = list.findIndex((x) => !x);
    if (nextEmpty >= 0) setSlot({ kind, i: nextEmpty });
    else if (kind === "skills" && draft.charms.some((x) => !x)) setSlot({ kind: "charms", i: draft.charms.findIndex((x) => !x) });
  };
  const clearSlot = (s: Slot) => {
    if (s.kind === "pet") edit({ pet: null });
    else edit({ [s.kind]: draft[s.kind].map((x, j) => (j === s.i ? null : x)) });
  };
  /** Moves a skill one place earlier or later in the cast order. */
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= SKILL_SLOTS) return;
    const list = [...draft.skills];
    [list[i], list[j]] = [list[j], list[i]];
    edit({ skills: list });
    setSlot({ kind: "skills", i: j });
  };

  // ---- Drag and drop: drag a skill or Fantomon from the list (or a slot) onto a slot. Mouse drags start
  // on movement; touch drags start after a short press so the list still scrolls. ----
  type Payload = { type: "active" | "charm" | "pet"; id: number; from?: Slot };
  const drag = useRef<{ p: Payload; x: number; y: number; on: boolean; timer?: number; ghost?: HTMLElement; art?: string } | null>(null);
  const suppressClick = useRef(false);
  const [dragType, setDragType] = useState<Payload["type"] | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Window listeners must stay the same functions between renders, so they call through a ref.
  const H = useRef({ move: (_: PointerEvent) => {}, up: (_: PointerEvent) => {}, cancel: () => {}, touch: (_: TouchEvent) => {} });
  const L = useMemo(
    () => ({ move: (e: PointerEvent) => H.current.move(e), up: (e: PointerEvent) => H.current.up(e), cancel: () => H.current.cancel(), touch: (e: TouchEvent) => H.current.touch(e) }),
    [],
  );
  const slotKey = (s: Slot) => (s.kind === "pet" ? "pet" : `${s.kind}-${s.i}`);
  const accepts = (s: Slot, t: Payload["type"]) => (s.kind === "pet" ? t === "pet" : (s.kind === "skills" ? "active" : "charm") === t);
  const targetAt = (x: number, y: number): Slot | null => {
    const k = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-slot]")?.dataset.slot;
    if (!k) return null;
    if (k === "pet") return { kind: "pet" };
    const [kind, i] = k.split("-");
    return { kind: kind as "skills" | "charms", i: +i };
  };
  const drop = (p: Payload, to: Slot) => {
    if (!accepts(to, p.type)) return;
    if (to.kind === "pet") {
      edit({ pet: p.id });
      setSlot(to);
      return;
    }
    const d = draftRef.current;
    const list = [...d[to.kind]];
    const from = p.from && p.from.kind === to.kind ? p.from.i : list.indexOf(p.id);
    const prev = list[to.i];
    if (from >= 0) list[from] = from === to.i ? p.id : prev; // swap with what was there
    list[to.i] = p.id;
    edit({ [to.kind]: list });
    setSlot(to);
  };
  const endDrag = () => {
    const d = drag.current;
    if (d?.timer) clearTimeout(d.timer);
    d?.ghost?.remove();
    drag.current = null;
    setDragType(null);
    setOver(null);
    window.removeEventListener("pointermove", L.move);
    window.removeEventListener("pointerup", L.up);
    window.removeEventListener("pointercancel", L.cancel);
    window.removeEventListener("touchmove", L.touch);
  };
  const blockScroll = (e: TouchEvent) => drag.current?.on && e.preventDefault();
  const begin = () => {
    const d = drag.current;
    if (!d || d.on) return;
    d.on = true;
    suppressClick.current = true;
    navigator.vibrate?.(15);
    const g = document.createElement("div");
    g.className = "lo-ghost";
    if (d.art) g.innerHTML = `<img src="${d.art}" alt="">`;
    g.style.left = `${d.x}px`;
    g.style.top = `${d.y}px`;
    document.body.appendChild(g);
    d.ghost = g;
    setDragType(d.p.type);
  };
  function onMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const far = Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8;
    if (!d.on) {
      if (!far) return;
      if (e.pointerType === "mouse") begin();
      else return endDrag(); // a touch that moved before the press finished is a scroll
    }
    d.ghost!.style.left = `${e.clientX}px`;
    d.ghost!.style.top = `${e.clientY}px`;
    const t = targetAt(e.clientX, e.clientY);
    setOver(t && accepts(t, d.p.type) ? slotKey(t) : null);
  }
  function onUp(e: PointerEvent) {
    const d = drag.current;
    if (d?.on) {
      const t = targetAt(e.clientX, e.clientY);
      if (t) drop(d.p, t);
      setTimeout(() => (suppressClick.current = false), 0);
    }
    endDrag();
  }
  H.current = { move: onMove, up: onUp, cancel: endDrag, touch: blockScroll };
  const dragProps = (p: Payload, art?: string) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      endDrag();
      drag.current = { p, x: e.clientX, y: e.clientY, on: false, art: art ? `${import.meta.env.BASE_URL}art/${art}` : undefined };
      if (e.pointerType !== "mouse") drag.current.timer = window.setTimeout(begin, 260);
      window.addEventListener("pointermove", L.move);
      window.addEventListener("pointerup", L.up);
      window.addEventListener("pointercancel", L.cancel);
      window.addEventListener("touchmove", L.touch, { passive: false });
    },
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
    onDragStart: (e: DragEvent) => e.preventDefault(),
  });
  useEffect(() => endDrag, []); // eslint-disable-line react-hooks/exhaustive-deps
  /** Click handler that ignores the click a finished drag leaves behind. */
  const tap = (fn: () => void) => () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    fn();
  };

  const changeClass = (code: string) => {
    const next = classes.find((c) => c.code === code);
    if (!next) return;
    const ok = new Set(next.skills);
    // Keep whatever the new class can still use.
    edit({ cls: code, skills: draft.skills.map((x) => (x && ok.has(x) ? x : null)), charms: draft.charms.map((x) => (x && ok.has(x) ? x : null)) });
  };

  const link = shareUrl(draft);
  /** What Share copies: any notes as a quote, then the link. Discord turns the link into a card with
   *  the build's name, skills and picture, so nothing else is needed. */
  const shareText = () => [draft.notes.trim() ? `> ${draft.notes.trim().replace(/\n+/g, "\n> ")}` : "", link].filter(Boolean).join("\n");
  const share = async () => {
    const title = draft.title.trim() || `${cls.name} loadout`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title, text: draft.notes.trim() || undefined, url: link });
        return;
      }
      await navigator.clipboard.writeText(shareText());
      setToast("Copied. Paste it in Discord and the link shows the build.");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setToast("Your browser blocked copying.");
    }
  };
  const picture = () => {
    const slotOf = (id: number | null) => {
      const s = skill(id);
      if (!s) return null;
      const g = gradeOfRank(rankOf(s));
      return { name: s.name, art: `skills/skill_${s.id}.webp`, quality: g.raw, stars: g.stars };
    };
    return drawLoadout({
      title: draft.title.trim(),
      className: cls.name,
      badge: `classes/${cls.badge}.webp`,
      skills: draft.skills.map(slotOf),
      charms: draft.charms.map(slotOf),
      pet: pet ? { name: pet.name, art: pet.baby } : null,
      url: link,
    });
  };
  const fileName = () => `${(draft.title.trim() || `${cls.name} loadout`).replace(/[^\w-]+/g, "-").toLowerCase()}.png`;
  /** Phones: share the picture and text straight to Discord. Computers: copy the picture to paste. */
  const copyPicture = async () => {
    setToast("Drawing…");
    try {
      if (matchMedia("(pointer: coarse)").matches && navigator.canShare) {
        const file = new File([await picture()], fileName(), { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: shareText() });
          setToast("");
          return;
        }
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": picture() })]);
      setToast("Picture copied");
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return setToast("");
      downloadPicture();
    }
  };
  const downloadPicture = async () => {
    const url = URL.createObjectURL(await picture());
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setToast("Picture saved");
  };
  const save = () => {
    if (!draft.title.trim()) {
      setNameNeeded(true);
      nameRef.current?.focus();
      nameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const id = editingId ?? Date.now().toString(36);
    const item: SavedLoadout = { ...draft, id, savedAt: Date.now() };
    setSaved((s) => ({ items: [item, ...s.items.filter((x) => x.id !== id)] }));
    setEditingId(id);
    setOpened(false);
    setToast(editingId ? "Saved" : "Saved to My loadouts");
  };
  const startNew = () => {
    setDraft(emptyLoadout(draft.cls));
    setEditingId(null);
    setOpened(false);
    setSlot({ kind: "skills", i: 0 });
  };
  const openSaved = (s: SavedLoadout, scroll = true) => {
    const { id, savedAt: _savedAt, ...l } = s;
    setDraft(clean(l, classes, D.skills));
    setEditingId(id);
    setOpened(false);
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  };
  /** Steps through My loadouts, like the arrows beside the loadout name in the game. */
  const cycle = (by: number) => {
    const items = saved.items;
    if (!items.length) return;
    const at = items.findIndex((x) => x.id === editingId);
    openSaved(items[at < 0 ? (by > 0 ? 0 : items.length - 1) : (at + by + items.length) % items.length], false);
  };
  const rename = (s: SavedLoadout) => {
    const name = window.prompt("Loadout name", s.title)?.trim().slice(0, TITLE_MAX);
    if (!name) return;
    setSaved((x) => ({ items: x.items.map((it) => (it.id === s.id ? { ...it, title: name } : it)) }));
    if (editingId === s.id) edit({ title: name });
  };
  const remove = (id: string) => {
    if (!window.confirm("Delete this loadout from My loadouts?")) return;
    setSaved((s) => ({ items: s.items.filter((x) => x.id !== id) }));
    if (editingId === id) setEditingId(null);
  };

  /** Grade, stars and the numbers they give, for the skill in the open slot. */
  const rankPanel = (s: SkillInfo) => {
    const rank = rankOf(s);
    const { raw, stars } = gradeOfRank(rank);
    const [lo, hi] = GRADE_RANKS[raw];
    const grades = Object.entries(GRADE_RANKS).filter(([, [, top]]) => top >= baseRank(s));
    const d = explorer.detail(s.id, raw, stars, calc.level, calc.combatRank, rank);
    return (
      <div className={`lo-rank q-${raw}`}>
        <div className="q-stepper" role="radiogroup" aria-label="Grade">
          {grades.map(([g, [a]]) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={g === raw}
              className={`q-${g}`}
              onClick={() => setRank(s, Math.max(baseRank(s), Math.min(GRADE_RANKS[g][1], a + stars)))}
            >
              {gradeName(g)}
            </button>
          ))}
        </div>
        {hi > lo && (
          <div className="lo-stars" role="radiogroup" aria-label="Stars">
            {Array.from({ length: hi - lo }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={n === stars}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                className={n <= stars ? "lit" : undefined}
                onClick={() => setRank(s, Math.max(baseRank(s), lo + (n === stars ? n - 1 : n)))}
              >
                ★
              </button>
            ))}
            <span className="lo-stars-label">
              {gradeName(raw)} {stars}★
            </span>
          </div>
        )}
        {d.rows.length > 0 ? (
          <dl className="fm-lines">
            {d.rows.map((r, i) => (
              <div key={i}>
                <dt>{r.label}</dt>
                <dd>{rowText(r)}</dd>
              </div>
            ))}
            {d.cd ? (
              <div>
                <dt>Cooldown</dt>
                <dd>{d.cd} turns</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="hint">The game data has no numbers for this one.</p>
        )}
        <div className="lo-calc">
          <label>
            Your level
            <input
              type="number"
              min={1}
              max={430}
              value={calc.level}
              onChange={(e) => setCalc((c) => ({ ...c, level: Math.max(1, Math.min(430, Math.round(+e.target.value) || 1)) }))}
            />
          </label>
          <label>
            Combat rank
            <select value={calc.combatRank} onChange={(e) => setCalc((c) => ({ ...c, combatRank: e.target.value }))}>
              {explorer.C.combatRanks.map((r) => (
                <option key={r.raw} value={r.raw}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <small>The fixed part of each number grows with your level and combat rank.</small>
        </div>
      </div>
    );
  };

  const slotButton = (s: Slot, label: string, n?: number) => {
    const id = s.kind === "pet" ? null : draft[s.kind][s.i];
    const info = skill(id);
    const on = slot.kind === s.kind && (s.kind === "pet" || (slot.kind !== "pet" && slot.i === s.i));
    const filled = s.kind === "pet" ? !!pet : !!info;
    const can = dragType !== null && accepts(s, dragType);
    const drags =
      s.kind === "pet"
        ? pet && dragProps({ type: "pet", id: pet.id, from: s }, pet.baby)
        : info && dragProps({ type: info.type, id: info.id, from: s }, `skills/skill_${info.id}.webp`);
    return (
      <button
        type="button"
        data-slot={slotKey(s)}
        className={`lo-slot ${s.kind}${on ? " on" : ""}${filled ? " filled" : ""}${can ? " can-drop" : ""}${over === slotKey(s) ? " over" : ""}`}
        aria-pressed={on}
        aria-label={`${label}: ${s.kind === "pet" ? pet?.name ?? "empty" : info?.name ?? "empty"}`}
        {...(drags || {})}
        onClick={tap(() => {
          setSlot(s);
          // On one-column screens the picker sits below the card: bring it into view.
          const picker = document.querySelector<HTMLElement>(".lo-picker");
          if (picker && picker.getBoundingClientRect().top > window.innerHeight * 0.6) picker.scrollIntoView({ behavior: "smooth", block: "start" });
        })}
      >
        <span className="lo-slot-art">
          {s.kind === "pet" ? (
            pet ? <GameArt path={pet.baby} name={pet.name} alt="" /> : <span className="lo-plus">+</span>
          ) : info ? (
            <span className={`lo-ring q-${gradeOfRank(rankOf(info)).raw}`}>
              <GameArt path={`skills/skill_${info.id}.webp`} name={info.name} alt="" />
              {gradeOfRank(rankOf(info)).stars > 0 && <b className="lo-stars-tag">{gradeOfRank(rankOf(info)).stars}★</b>}
            </span>
          ) : (
            <span className="lo-plus">+</span>
          )}
          {n !== undefined && <b className="lo-num">{n}</b>}
        </span>
        <span className="lo-slot-name">{s.kind === "pet" ? pet?.name ?? "Fantomon" : info?.name ?? label}</span>
      </button>
    );
  };

  return (
    <div className="tool loadouts">
      {opened && (
        <p className="lo-banner">
          <Icon name="share" size={18} />
          <span>
            Someone shared this loadout with you. <b>Save it</b> to keep a copy in My loadouts.
          </span>
        </p>
      )}

      <div className="lo-split">
      <section className="card lo-card">
        {/* Laid out like the game's Skill screen: techniques left, charms right, Fantomon in the middle. */}
        <div className="lo-scene">
          <div className="lo-col left">{draft.skills.map((_, i) => <span key={i}>{slotButton({ kind: "skills", i }, `Technique ${i + 1}`, i + 1)}</span>)}</div>
          <div className="lo-stage">
            <span className="lo-emblem" aria-hidden>
              <GameArt path={`classes/${cls.badge}.webp`} name={cls.name} alt="" />
            </span>
            {slotButton({ kind: "pet" }, "Fantomon")}
            <span className="lo-stage-class">{cls.name}</span>
          </div>
          <div className="lo-col right">{draft.charms.map((_, i) => <span key={i}>{slotButton({ kind: "charms", i }, `Charm ${i + 1}`)}</span>)}</div>
        </div>

        <div className={`lo-namebar${nameNeeded ? " needed" : ""}`}>
          <button type="button" className="lo-arrow" onClick={() => cycle(-1)} disabled={!saved.items.length} aria-label="Previous saved loadout">
            ‹
          </button>
          <label className="lo-name-box">
            <span className="lo-pencil" aria-hidden>✎</span>
            <input
              ref={nameRef}
              className="lo-title"
              value={draft.title}
              maxLength={TITLE_MAX}
              placeholder="NAME YOUR LOADOUT"
              aria-label="Loadout name"
              onChange={(e) => {
                edit({ title: e.target.value });
                setNameNeeded(false);
              }}
            />
          </label>
          <button type="button" className="lo-arrow" onClick={() => cycle(1)} disabled={!saved.items.length} aria-label="Next saved loadout">
            ›
          </button>
        </div>
        {saved.items.length > 0 && (
          <p className="lo-dots" aria-hidden>
            {saved.items.map((it) => <i key={it.id} className={it.id === editingId ? "on" : undefined} />)}
          </p>
        )}
        {nameNeeded && <p className="lo-name-hint">Give it a name so you can find it in My loadouts.</p>}

        <div className="lo-class-row">
          <ClassSelect label="Class" value={draft.cls} classes={classes} onChange={changeClass} />
        </div>

        <textarea
          className="lo-notes"
          rows={2}
          maxLength={NOTES_MAX}
          placeholder="Notes for whoever opens this: when to use it, rotation, swaps…"
          value={draft.notes}
          onChange={(e) => edit({ notes: e.target.value })}
        />

        <div className="lo-actions">
          <button type="button" className="spin-button" onClick={share} disabled={isEmpty(draft)}>
            <Icon name="share" size={18} /> Share
          </button>
          <button type="button" className="lo-btn" onClick={copyPicture} disabled={isEmpty(draft)}>
            Copy picture
          </button>
          <button type="button" className="lo-btn" onClick={downloadPicture} disabled={isEmpty(draft)}>
            Save picture
          </button>
          <span className="lo-actions-break" />
          <button type="button" className="lo-btn" onClick={save} disabled={isEmpty(draft)}>
            {editingId ? "Save changes" : "Save to My loadouts"}
          </button>
          <button type="button" className="link-button" onClick={startNew}>
            New loadout
          </button>
        </div>
        {toast && (
          <p className="lo-toast" role="status">
            {toast}
          </p>
        )}
      </section>

      <section className="card lo-picker">
        <div className="lo-tabs" role="tablist" aria-label="What to pick">
          {(["skills", "charms", "pet"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={slot.kind === k}
              onClick={() => {
                if (k === "pet") setSlot({ kind: "pet" });
                else if (slot.kind !== k) setSlot({ kind: k, i: Math.max(0, draft[k].findIndex((x) => !x)) });
              }}
            >
              {k === "skills" ? "Technique" : k === "charms" ? "Charm" : "Fantomon"}
            </button>
          ))}
        </div>
        <div className="lo-picker-head">
          <div>
            <p className="eyebrow">{slot.kind === "pet" ? "Fantomon" : slot.kind === "skills" ? `Technique ${slot.i + 1}` : `Charm ${slot.i + 1}`}</p>
            <h2 className="subhead">{slot.kind === "pet" ? "Pick a Fantomon" : slot.kind === "skills" ? "Pick a technique" : "Pick a charm"}</h2>
          </div>
          {slot.kind !== "pet" && (
            <input type="search" placeholder="Search name or effect" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search skills" />
          )}
        </div>

        {(focused || (slot.kind === "pet" && pet)) && (
          <div className="lo-focus">
            {focused ? (
              <>
                <GameArt path={`skills/skill_${focused.id}.webp`} name={focused.name} alt="" />
                <div>
                  <b>{focused.name}</b>
                  <GlossaryText text={focused.description} />
                </div>
              </>
            ) : (
              <>
                <GameArt path={pet!.baby} name={pet!.name} alt="" />
                <div>
                  <b>{pet!.name}</b>
                  <p>{pet!.role ?? pet!.type}</p>
                </div>
              </>
            )}
            <div className="lo-focus-tools">
              {slot.kind === "skills" && (
                <>
                  <button type="button" className="lo-btn small" onClick={() => move(slot.i, -1)} disabled={slot.i === 0} aria-label="Cast earlier">
                    ←
                  </button>
                  <button type="button" className="lo-btn small" onClick={() => move(slot.i, 1)} disabled={slot.i === SKILL_SLOTS - 1} aria-label="Cast later">
                    →
                  </button>
                </>
              )}
              <button type="button" className="lo-btn small" onClick={() => clearSlot(slot)}>
                Remove
              </button>
            </div>
            {focused && rankPanel(focused)}
          </div>
        )}

        {slot.kind === "pet" ? (
          <ul className="lo-grid pets">
            {pets.map((p) => (
              <li key={p.id}>
                <button type="button" className={draft.pet === p.id ? "on" : undefined} onClick={tap(() => edit({ pet: p.id }))} title={p.name} {...dragProps({ type: "pet", id: p.id }, p.baby)}>
                  <GameArt path={p.baby} name={p.name} alt="" />
                  <span>{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : groups.length ? (
          groups.map((g) => (
            <div key={g.code} className="lo-group">
              <p className="lo-group-label">From {className(g.code)}</p>
              <ul className="lo-list">
                {g.items.map((s) => (
                  <li key={s.id}>
                    <button type="button" className={used.has(s.id) ? "used" : undefined} onClick={tap(() => place(s.id))} {...dragProps({ type: s.type, id: s.id }, `skills/skill_${s.id}.webp`)}>
                      <GameArt path={`skills/skill_${s.id}.webp`} name={s.name} alt="" className={`q-${s.quality ?? "Blue"}`} />
                      <span>
                        <b>{s.name}</b>
                        <small>{s.description}</small>
                      </span>
                      {used.has(s.id) && <em>In use</em>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="hint">Nothing matches "{query}".</p>
        )}
        {!isEmpty(draft) && (
          <div className="lo-back">
            <button
              type="button"
              className="lo-btn"
              onClick={() => document.querySelector<HTMLElement>(".lo-card")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              ↑ Back to loadout
            </button>
          </div>
        )}
        <p className="hint">Tap to fill the open slot, or drag onto any slot (press and hold first on a phone). Every {pickKind === "charm" ? "charm" : "skill"} {cls.name} can equip, including the ones from earlier classes in its line.</p>
      </section>

      </div>

      <section className="card lo-saved-card">
        <h2 className="subhead">My loadouts</h2>
        {saved.items.length ? (
          <ul className="lo-saved">
            {saved.items.map((s) => {
              const c = classes.find((x) => x.code === s.cls);
              return (
                <li key={s.id} className={s.id === editingId ? "on" : undefined}>
                  <button type="button" className="lo-saved-open" onClick={() => openSaved(s)}>
                    {c && <GameArt path={`classes/${c.badge}.webp`} name={c.name} alt="" className="lo-badge small" />}
                    <span className="lo-saved-text">
                      <b>{s.title.trim() || `${c?.name ?? s.cls} loadout`}</b>
                      <small>
                        {c?.name ?? s.cls} · {new Date(s.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </small>
                    </span>
                    <span className="lo-mini">
                      {[...s.skills, ...s.charms].map((id, i) =>
                        id ? <GameArt key={i} path={`skills/skill_${id}.webp`} name="" alt="" /> : <i key={i} />,
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="lo-btn small"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(shareUrl(s));
                        setToast("Link copied");
                      } catch {
                        /* blocked */
                      }
                    }}
                  >
                    Copy link
                  </button>
                  <button type="button" className="lo-btn small" onClick={() => rename(s)}>
                    Rename
                  </button>
                  <button type="button" className="link-button" onClick={() => remove(s.id)}>
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="hint">Loadouts you save appear here. They're kept in this browser only; share the link to move one to another device.</p>
        )}
      </section>
    </div>
  );
}

/** Drops anything a loadout can't hold any more (a class that changed, a skill the class can't use). */
function clean(l: Loadout, classes: Profession[], skills: Record<string, SkillInfo>): Loadout {
  const cls = classes.find((c) => c.code === l.cls) ?? classes[0];
  const ok = new Set(cls.skills);
  const keep = (xs: (number | null)[], type: string) => xs.map((x) => (x && ok.has(x) && skills[String(x)]?.type === type ? x : null));
  const ranks = Object.fromEntries(Object.entries(l.ranks ?? {}).filter(([id, r]) => skills[id] && Number.isInteger(r) && r > 0 && r <= MAX_RANK));
  return { ...l, cls: cls.code, skills: keep(l.skills, "active"), charms: keep(l.charms, "charm"), ranks };
}
