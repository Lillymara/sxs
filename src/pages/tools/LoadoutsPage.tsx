// Loadouts: pick a class, 4 skills in cast order, 4 charms and a Fantomon, then share the build as a link.
// Nothing is stored on a server; the link carries the whole build (src/lib/loadout.ts).
import { useEffect, useMemo, useState } from "react";
import { ClassSelect } from "../../components/ClassSelect";
import { GameArt } from "../../components/GameArt";
import { Icon } from "../../components/Icon";
import type { Explorer } from "../../lib/explorer";
import { buildFantomons } from "../../lib/fantomonView";
import type { Profession, SkillInfo } from "../../lib/gamedata";
import {
  NOTES_MAX,
  SKILL_SLOTS,
  TITLE_MAX,
  decodeLoadout,
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

  // A shared link (?b=…) opens straight into the builder.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("b");
    if (!code) return;
    const l = decodeLoadout(code);
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
  const copyText = async () => {
    const names = (xs: (number | null)[]) => xs.map((x, i) => `${i + 1}. ${skill(x)?.name ?? "—"}`).join("  ");
    const text = [
      `**${draft.title.trim() || `${cls.name} loadout`}** (${cls.name})`,
      `Skills: ${names(draft.skills)}`,
      `Charms: ${draft.charms.map((x) => skill(x)?.name ?? "—").join(", ")}`,
      pet ? `Fantomon: ${pet.name}` : "",
      draft.notes.trim(),
      link,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied for Discord");
    } catch {
      /* clipboard blocked */
    }
  };
  const save = () => {
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
  const openSaved = (s: SavedLoadout) => {
    const { id, savedAt: _savedAt, ...l } = s;
    setDraft(clean(l, classes, D.skills));
    setEditingId(id);
    setOpened(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
            <GameArt path={`skills/skill_${info.id}.webp`} name={info.name} alt="" className={`q-${info.quality ?? "Blue"}`} />
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
        <div className="lo-card-head">
          <span className="lo-class">
            <GameArt path={`classes/${cls.badge}.webp`} name={cls.name} alt="" className="lo-badge" />
          </span>
          <div className="lo-titles">
            <input
              className="lo-title"
              value={draft.title}
              maxLength={TITLE_MAX}
              placeholder={`${cls.name} loadout`}
              aria-label="Loadout name"
              onChange={(e) => edit({ title: e.target.value })}
            />
            <ClassSelect label="Class" value={draft.cls} classes={classes} onChange={changeClass} />
          </div>
        </div>

        <div className="lo-board">
          <div className="lo-row">
            <p className="lo-row-label">Skills <small>in cast order</small></p>
            <div className="lo-slots">{draft.skills.map((_, i) => <span key={i}>{slotButton({ kind: "skills", i }, `Skill ${i + 1}`, i + 1)}</span>)}</div>
          </div>
          <div className="lo-row">
            <p className="lo-row-label">Charms</p>
            <div className="lo-slots">{draft.charms.map((_, i) => <span key={i}>{slotButton({ kind: "charms", i }, `Charm ${i + 1}`)}</span>)}</div>
          </div>
          <div className="lo-row lo-pet-row">
            <p className="lo-row-label">Fantomon</p>
            <div className="lo-slots one">{slotButton({ kind: "pet" }, "Fantomon")}</div>
          </div>
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
        <div className="lo-picker-head">
          <div>
            <p className="eyebrow">{slot.kind === "pet" ? "Fantomon" : slot.kind === "skills" ? `Skill ${slot.i + 1}` : `Charm ${slot.i + 1}`}</p>
            <h2 className="subhead">{slot.kind === "pet" ? "Pick a Fantomon" : slot.kind === "skills" ? "Pick a skill" : "Pick a charm"}</h2>
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
