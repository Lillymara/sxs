// Loadouts: pick a class, 4 skills in cast order, 4 charms and a Fantomon, then share the build as a link.
// Nothing is stored on a server; the link carries the whole build (src/lib/loadout.ts).
import { useEffect, useMemo, useRef, useState } from "react";
import { ClassSelect } from "../../components/ClassSelect";
import { GameArt } from "../../components/GameArt";
import { Icon } from "../../components/Icon";
import type { Explorer } from "../../lib/explorer";
import { buildFantomons } from "../../lib/fantomonView";
import { drawLoadout } from "../../lib/loadoutImage";
import type { Profession, SkillInfo } from "../../lib/gamedata";
import {
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
import { Loading, useExplorer } from "./shared";

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

  const changeClass = (code: string) => {
    const next = classes.find((c) => c.code === code);
    if (!next) return;
    const ok = new Set(next.skills);
    // Keep whatever the new class can still use.
    edit({ cls: code, skills: draft.skills.map((x) => (x && ok.has(x) ? x : null)), charms: draft.charms.map((x) => (x && ok.has(x) ? x : null)) });
  };

  const link = shareUrl(draft);
  const share = async () => {
    const title = draft.title.trim() || `${cls.name} loadout`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setToast("Link copied");
    } catch {
      /* cancelled */
    }
  };
  /** The Discord post: the name and the link. Discord turns the link into a card with the build's picture. */
  const discordText = () =>
    [`**${draft.title.trim() || `${cls.name} loadout`}** · ${cls.name}`, draft.notes.trim() ? `> ${draft.notes.trim().replace(/\n+/g, "\n> ")}` : "", link]
      .filter(Boolean)
      .join("\n");
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(discordText());
      setToast("Copied. Paste it in Discord: the link shows the build.");
    } catch {
      setToast("Your browser blocked copying.");
    }
  };
  const picture = () => {
    const slotOf = (id: number | null) => {
      const s = skill(id);
      return s ? { name: s.name, art: `skills/skill_${s.id}.webp`, quality: s.quality } : null;
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
          await navigator.share({ files: [file], text: discordText() });
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

  const slotButton = (s: Slot, label: string, n?: number) => {
    const id = s.kind === "pet" ? null : draft[s.kind][s.i];
    const info = skill(id);
    const on = slot.kind === s.kind && (s.kind === "pet" || (slot.kind !== "pet" && slot.i === s.i));
    const filled = s.kind === "pet" ? !!pet : !!info;
    return (
      <button
        type="button"
        className={`lo-slot ${s.kind}${on ? " on" : ""}${filled ? " filled" : ""}`}
        aria-pressed={on}
        aria-label={`${label}: ${s.kind === "pet" ? pet?.name ?? "empty" : info?.name ?? "empty"}`}
        onClick={() => {
          setSlot(s);
          // On one-column screens the picker sits below the card: bring it into view.
          const picker = document.querySelector<HTMLElement>(".lo-picker");
          if (picker && picker.getBoundingClientRect().top > window.innerHeight * 0.6) picker.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      >
        <span className="lo-slot-art">
          {s.kind === "pet" ? (
            pet ? <GameArt path={pet.baby} name={pet.name} alt="" /> : <span className="lo-plus">+</span>
          ) : info ? (
            <span className={`lo-ring q-${info.quality ?? "Blue"}`}>
              <GameArt path={`skills/skill_${info.id}.webp`} name={info.name} alt="" />
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
            <Icon name="share" size={18} /> Share link
          </button>
          <button type="button" className="lo-btn" onClick={copyText} disabled={isEmpty(draft)}>
            Copy for Discord
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
                  <p>{focused.description}</p>
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
          </div>
        )}

        {slot.kind === "pet" ? (
          <ul className="lo-grid pets">
            {pets.map((p) => (
              <li key={p.id}>
                <button type="button" className={draft.pet === p.id ? "on" : undefined} onClick={() => edit({ pet: p.id })} title={p.name}>
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
              <ul className="lo-grid">
                {g.items.map((s) => (
                  <li key={s.id}>
                    <button type="button" className={used.has(s.id) ? "used" : undefined} onClick={() => place(s.id)} title={`${s.name}: ${s.description}`}>
                      <GameArt path={`skills/skill_${s.id}.webp`} name={s.name} alt="" className={`q-${s.quality ?? "Blue"}`} />
                      <span>{s.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="hint">Nothing matches "{query}".</p>
        )}
        <p className="hint">Every {pickKind === "charm" ? "charm" : "skill"} {cls.name} can equip, including the ones from earlier classes in its line.</p>
      </section>

      </div>

      <section className="card">
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
  return { ...l, cls: cls.code, skills: keep(l.skills, "active"), charms: keep(l.charms, "charm") };
}
