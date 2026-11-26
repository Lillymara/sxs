// Fantomons: a collection gallery, then a profile for the one picked: evolution, role and movement,
// Fantasmia, stats at any level, and every skill at any quality.
import { useMemo, useState } from "react";
import type { Explorer } from "../../lib/explorer";
import { AvailabilityBar } from "../../components/AvailabilityBar";
import { GameArt } from "../../components/GameArt";
import { GameIcon } from "../../components/GameIcon";
import { FANTOMON_RULES, availabilityFor, isStillObtainable } from "../../lib/availability";
import { buildFantomons, qualitiesFrom, qualityName, QUALITIES, type FantomonView, type QualityRaw, type ViewSkill } from "../../lib/fantomonView";
import { usePersistentState } from "../../lib/storage";
import { effectiveDay1 } from "../calendar/server";
import type { ToolProps } from "./props";
import { GlossaryText, Loading, useExplorer } from "./shared";
import { formatLocale } from "../../i18n/format";

export function FantomonsPage(props: ToolProps) {
  const { explorer, error } = useExplorer();
  if (!explorer) return <Loading error={error} />;
  return <Fantomons explorer={explorer} {...props} />;
}

const STATS: { key: string; label: string; icon: string }[] = [
  { key: "MaxHp", label: "HP", icon: "beryl" },
  { key: "Attack", label: "ATK", icon: "ruby" },
  { key: "Defence", label: "DEF", icon: "sapphire" },
  { key: "Speed", label: "SPD", icon: "citrine" },
];
const MAX_LEVEL = 200;

/** What each role spends on its ability tree: three tiers, four of one merge into one of the next. */
const TREE_MATS: Record<string, { family: string; tiers: { name: string; art: string }[] }> = {
  Tank: { family: "Eggs", tiers: [{ name: "Brown Egg", art: "icons/eggBrown.webp" }, { name: "Bronze Egg", art: "icons/eggBronze.webp" }, { name: "Silver Egg", art: "icons/eggSilver.webp" }] },
  DPS: { family: "Wool", tiers: [{ name: "Magic Wool", art: "items/item_1540.webp" }, { name: "Bronze Wool", art: "items/item_1541.webp" }, { name: "Silver Wool", art: "items/item_1542.webp" }] },
  Support: { family: "Essence", tiers: [{ name: "Fresh Essence", art: "items/item_1530.webp" }, { name: "Focus Essence", art: "items/item_1531.webp" }, { name: "Inspiration Essence", art: "items/item_1532.webp" }] },
};
const artUrl = (p: string) => `${import.meta.env.BASE_URL}art/${p}`;

function Fantomons({ explorer, choice, onServerChange, now }: { explorer: Explorer } & ToolProps) {
  const all = useMemo(() => buildFantomons(explorer), [explorer]);
  const [filter, setFilter] = usePersistentState<{ only: boolean; limited: boolean }>("sxs.availability", { only: false, limited: false });
  const day1 = effectiveDay1(choice);
  const avail = (id: number) => availabilityFor(FANTOMON_RULES[id], day1, now);

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [start, setStart] = useState("");
  const roles = [...new Set(all.map((f) => f.role).filter(Boolean) as string[])].sort();
  const starts = QUALITIES.filter((q) => all.some((f) => f.quality === q.raw));

  const shown = all.filter((f) => {
    const a = avail(f.id);
    const q = search.trim().toLowerCase();
    return (
      (!filter.only || isStillObtainable(a)) &&
      (!filter.limited || a.state !== "limited") &&
      (!role || f.role === role) &&
      (!start || f.quality === start) &&
      (!q || [f.name, f.role, f.type, f.moves, ...[...f.support, ...f.battle].map((s) => s.name)].join(" ").toLowerCase().includes(q))
    );
  });

  const [selected, setSelected] = useState(1609);
  const pet = all.find((f) => f.id === selected) ?? all[0];
  const pick = (id: number) => {
    setSelected(id);
    requestAnimationFrame(() => document.getElementById("fantomon-profile")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="tool fm">
      <section className="card">
        <AvailabilityBar
          choice={choice}
          onServerChange={onServerChange}
          onlyObtainable={filter.only}
          onToggle={(only) => setFilter({ ...filter, only })}
          hiddenCount={all.filter((f) => !isStillObtainable(avail(f.id))).length}
          hideLimited={filter.limited}
          onToggleLimited={(limited) => setFilter({ ...filter, limited })}
          limitedCount={all.filter((f) => avail(f.id).state === "limited").length}
          label="Hide missed and unreleased"
          description="Hides unreleased Fantomons and event Fantomons your server missed. Ones still on the way stay listed"
        />
      </section>

      <section className="card fm-roster">
        <div className="roster-head">
          <h2>
            Collection <span className="chip">{shown.length}</span>
          </h2>
          <input className="roster-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or skill" aria-label="Search Fantomons" />
        </div>
        <div className="filter-row" role="group" aria-label="Filter by role and starting quality">
          <button type="button" aria-pressed={!role && !start} onClick={() => (setRole(""), setStart(""))}>
            All
          </button>
          {roles.map((r) => (
            <button key={r} type="button" className="role-chip" aria-pressed={role === r} onClick={() => setRole(role === r ? "" : r)}>
              {TREE_MATS[r] && <img src={artUrl(TREE_MATS[r].tiers[0].art)} alt="" />}
              {r}
            </button>
          ))}
          <span className="filter-gap" aria-hidden />
          {starts.map((q) => (
            <button key={q.raw} type="button" className={`q-chip q-${q.raw}`} aria-pressed={start === q.raw} onClick={() => setStart(start === q.raw ? "" : q.raw)}>
              {q.name}
            </button>
          ))}
        </div>
        {!shown.length && <p className="hint">Nothing matches. Clear a filter to see more.</p>}
        <div className="fm-grid">
          {shown.map((f) => {
            const a = avail(f.id);
            return (
              <button key={f.id} type="button" className={`fm-card q-${f.quality}`} aria-pressed={f.id === pet.id} onClick={() => pick(f.id)}>
                {f.isNew && <span className="ribbon">New</span>}
                <span className="fm-art">
                  <GameArt path={f.adult ?? f.baby} name={f.name} alt="" />
                </span>
                <b>{f.name}</b>
                <small>
                  {qualityName(f.quality)} · {f.role ?? f.type}
                  {f.moves ? ` · ${f.moves === "Fly" ? "Flies" : "Runs"}` : ""}
                </small>
                {a.tag && <span className={`avail-tag ${a.state}`}>{a.tag}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <Profile key={pet.id} pet={pet} detail={avail(pet.id).detail} availState={avail(pet.id).state} />
    </div>
  );
}

function Profile({ pet, detail, availState }: { pet: FantomonView; detail?: string; availState: string }) {
  const [level, setLevel] = useState(100);
  const levels = qualitiesFrom(pet.skillStart);
  const [quality, setQuality] = useState<QualityRaw>(levels[Math.min(levels.length - 1, 1)].raw);
  const stats = pet.stats(level);
  const top = pet.stats(MAX_LEVEL);
  const adultNow = pet.adultLevel !== undefined && level >= pet.adultLevel;

  return (
    <section className={`card fm-profile q-${pet.quality}`} id="fantomon-profile">
      <div className="fm-hero">
        <div className="fm-evo">
          <figure className={adultNow ? "dim" : ""}>
            <GameArt path={pet.baby} name={pet.name} alt={`${pet.name}, baby form`} />
            <figcaption>Baby</figcaption>
          </figure>
          {pet.adult && (
            <>
              <span className="evo-step" aria-hidden>
                <span>→</span>
                <small>Lv {pet.adultLevel}</small>
              </span>
              <figure className={adultNow ? "" : "dim"}>
                <GameArt path={pet.adult} name={pet.name} alt={`${pet.name}, adult form`} />
                <figcaption>Adult</figcaption>
              </figure>
            </>
          )}
        </div>
        <div className="fm-id">
          <p className="eyebrow">
            <span className={`q-text q-${pet.quality}`}>{qualityName(pet.quality)}</span> · {pet.role ?? pet.type}
            {pet.isNew && <span className="ribbon inline">New</span>}
          </p>
          <h2 className="pet-name">{pet.name}</h2>
          <div className="fm-facts">
            {pet.moves && (
              <div>
                <span>Moves</span>
                <b>{pet.moves === "Fly" ? "Flies" : "Runs"}</b>
              </div>
            )}
            {pet.shardsToSummon !== undefined && (
              <div>
                <span>To summon</span>
                <b>{pet.shardsToSummon} shards</b>
              </div>
            )}
            <div>
              <span>Evolves</span>
              <b>{pet.adultLevel ? `Lv ${pet.adultLevel}` : "No adult form"}</b>
            </div>
            <div>
              <span>Skills start</span>
              <b className={`q-text q-${pet.skillStart}`}>{qualityName(pet.skillStart)}</b>
            </div>
          </div>
          {pet.role && TREE_MATS[pet.role] && (
            <div className="tree-mats">
              <span>Ability tree · {TREE_MATS[pet.role].family}</span>
              <div>
                {TREE_MATS[pet.role].tiers.map((t, i) => (
                  <span key={t.name} className="tree-tier">
                    {i > 0 && <i aria-hidden>×4 →</i>}
                    <img src={artUrl(t.art)} alt="" title={t.name} />
                    <small>{t.name}</small>
                  </span>
                ))}
              </div>
            </div>
          )}
          {pet.fantasmia && <FantasmiaMeter f={pet.fantasmia} />}
          {detail && <p className={`note avail-note ${availState}`}>{detail}</p>}
        </div>
      </div>

      <div className="fm-controls">
        <div className="q-stepper" role="radiogroup" aria-label="Skill quality">
          {levels.map((q) => (
            <button key={q.raw} type="button" role="radio" aria-checked={quality === q.raw} className={`q-${q.raw}`} onClick={() => setQuality(q.raw)}>
              {q.name}
            </button>
          ))}
        </div>
        <label className="lv-control">
          <span>
            Level <b>{level}</b>
          </span>
          <input type="range" min={1} max={MAX_LEVEL} value={level} onChange={(e) => setLevel(+e.target.value)} aria-label="Fantomon level" />
        </label>
      </div>

      <div className="fm-stats">
        {STATS.map((s) => {
          const v = +stats[s.key] || 0;
          // Growth is steep, so the bar uses a log scale to stay readable at every level.
          const pct = v > 1 ? Math.min(100, (Math.log(v) / Math.log(+top[s.key] || 2)) * 100) : 0;
          const base = pet.battleBase?.[s.label];
          return (
            <div key={s.key} className="fm-stat">
              <GameIcon name={s.icon} />
              <span className="fm-stat-label">{s.label}</span>
              <b>{v.toLocaleString(formatLocale())}</b>
              <span className="meter" aria-hidden>
                <span style={{ width: `${pct}%` }} />
              </span>
              {base !== undefined && base !== 100 && <small className={base > 100 ? "up" : "down"}>{base}% in battle</small>}
            </div>
          );
        })}
      </div>
      <p className="hint">Stats at level {level}. Every Fantomon shares one growth curve.</p>

      <SkillGroup title="Support skill" note={pet.adult ? "Baby and adult" : undefined} skills={pet.support} quality={quality} level={level} />
      {pet.field && (
        <div className="skill-group">
          <h3 className="subhead">
            Field skill <span className="hint">Adult</span>
          </h3>
          <article className="fm-skill field">
            <span className="fm-skill-icon">{pet.adult && <GameArt path={pet.adult} name={pet.name} alt="" />}</span>
            <div>
              <b>{pet.field.name}</b>
              <p className="fm-skill-desc">{pet.field.description}</p>
            </div>
          </article>
        </div>
      )}
      {pet.battle.length > 0 && <SkillGroup title="Battle skills" note="Adult, once materialized" skills={pet.battle} quality={quality} level={level} />}
      {pet.fromPwm && <p className="hint source-note">This Fantomon's numbers come from Purrwikimania until the client data catches up.</p>}
    </section>
  );
}

function SkillGroup({ title, note, skills, quality, level }: { title: string; note?: string; skills: ViewSkill[]; quality: QualityRaw; level: number }) {
  if (!skills.length) return null;
  return (
    <div className="skill-group">
      <h3 className="subhead">
        {title} {note && <span className="hint">{note}</span>}
      </h3>
      {skills.map((s) => {
        const lines = s.lines(quality, level);
        const kind = s.tags.find((t) => /^(DMG|Buff|Debuff|Heal|Shield|Summon|Dispel)$/i.test(t));
        return (
          <article key={s.name} className={`fm-skill q-${quality}`}>
            <span className="fm-skill-icon">{s.icon ? <img src={`${import.meta.env.BASE_URL}art/${s.icon}`} alt="" loading="lazy" /> : <span>{s.name[0]}</span>}</span>
            <div>
              <div className="fm-skill-head">
                <b>{s.name}</b>
                {kind && <span className={`kind kind-${kind.toLowerCase()}`}>{kind}</span>}
                {s.tags.some((t) => /passive/i.test(t)) && <span className="kind">Passive</span>}
              </div>
              <div className="fm-skill-desc">
                <GlossaryText text={s.description} />
              </div>
              {lines.length > 0 && (
                <dl className="fm-lines">
                  {lines.map((l, i) => (
                    <div key={i}>
                      <dt>{l.label}</dt>
                      <dd>{l.text}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function FantasmiaMeter({ f }: { f: { cap: number; initial: number; perTurn: number; perDmg: number; note: string } }) {
  const turns = Math.max(0, Math.ceil((f.cap - f.initial) / f.perTurn));
  const said = f.note ? f.note.replace(/^./, (c) => c.toUpperCase()) : "";
  return (
    <div className="fantasmia">
      <div className="fantasmia-head">
        <span>Fantasmia</span>
        <b>{said || `Materializes in about ${turns} turn${turns === 1 ? "" : "s"}`}</b>
      </div>
      <span className="fantasmia-bar" aria-hidden>
        <span style={{ width: `${(f.initial / f.cap) * 100}%` }} />
        {Array.from({ length: turns }, (_, i) => (
          <i key={i} style={{ left: `${Math.min(100, ((f.initial + f.perTurn * (i + 1)) / f.cap) * 100)}%` }} />
        ))}
      </span>
      <small>
        Starts at {f.initial.toLocaleString(formatLocale())} of {f.cap.toLocaleString(formatLocale())} · +{f.perTurn} a turn · +{f.perDmg} for each hit taken
      </small>
    </div>
  );
}
