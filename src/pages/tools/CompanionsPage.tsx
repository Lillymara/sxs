// Companions: a portrait gallery, then a profile with friendship bonuses at any level, how they grow,
// favourite gifts and how to unlock them. Client data, plus newer companions from Purrwikimania.
import { useMemo, useState } from "react";
import raw from "../../data/companions.json";
import extra from "../../data/companionsExtra.json";
import gifts from "../../data/giftItems.json";
import { AvailabilityBar } from "../../components/AvailabilityBar";
import { GameArt } from "../../components/GameArt";
import { GameIcon } from "../../components/GameIcon";
import { availabilityFor, companionRule, isObtainable } from "../../lib/availability";
import { usePersistentState } from "../../lib/storage";
import { effectiveDay1 } from "../calendar/server";
import type { ToolProps } from "./props";
import { formatLocale } from "../../i18n/format";

interface Companion {
  id: number;
  name: string;
  premium: boolean;
  catalog: string;
  nativeClass: string;
  recommended: string[];
  recommendationReason?: string | null;
  gift?: string;
  region?: string | null;
  availability: string;
  unlock: { label: string; sources: string[] };
  maxLevel: number;
  /** Stat bonuses at each friendship level (index 0 = level 1). */
  curve: Record<string, number>[];
  /** Cumulative friendship EXP per level. */
  exp: number[];
  /** Whether full-body art exists (otherwise only the portrait icon). */
  figure: boolean;
  /** Added from Purrwikimania (not in the client extract yet). */
  source?: string;
  /** Only the max-level bonuses are known. */
  maxOnly?: boolean;
}

const DATA = [...(raw as Companion[]), ...(extra as Companion[])];
const GIFTS = gifts as Record<string, { name: string; icon: string }[]>;
const CLASSES: { name: string; badge: number }[] = [
  { name: "Knight", badge: 352 },
  { name: "Duelist", badge: 353 },
  { name: "Sorcerer", badge: 354 },
  { name: "Sage", badge: 355 },
];
const badgeOf = (cls: string) => CLASSES.find((c) => c.name === cls)?.badge;
const CORE: { key: string; icon: string }[] = [
  { key: "ATK", icon: "ruby" },
  { key: "HP", icon: "beryl" },
  { key: "DEF", icon: "sapphire" },
  { key: "SPD", icon: "citrine" },
];
const CORE_KEYS = new Set(CORE.map((c) => c.key));
const TRAVEL = new Set(["Travel Base Reward +", "Travel Reward Bonus", "Travel Extra Reward Chance"]);
const STAT_ORDER = ["ATK %", "DEF %", "HP %", "SPD %", "Crit Rate", "Crit RES", "Accuracy", "Block Rate", "Healing Boost", "DMG Boost", "DMG RES"];
const PERCENTISH = ["Crit Rate", "Crit RES", "Accuracy", "Block Rate", "Crit DMG", "Healing Boost", "DMG Boost", "DMG RES", "Travel Reward Bonus", "Travel Extra Reward Chance"];
const finalOf = (c: Companion) => c.curve[c.curve.length - 1] || {};
const STAT_FILTERS = STAT_ORDER.filter((s) => DATA.some((c) => Number(finalOf(c)[s]) > 0));
const DUPLICATE_NAMES = new Set(DATA.filter((c, i) => DATA.findIndex((x) => x.name === c.name) !== i).map((c) => c.name));
const fmt = (name: string, v: number) =>
  name.includes("%") || PERCENTISH.includes(name)
    ? `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
    : Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
const short = (name: string) => name.replace("Travel Reward Bonus", "Travel reward").replace("Travel Extra Reward Chance", "Travel bonus chance");
const isNew = (c: Companion) => c.source === "purrwikimania";

export function CompanionsPage({ choice, onServerChange, now }: ToolProps) {
  const [filter, setFilter] = usePersistentState<{ only: boolean; limited: boolean }>("sxs.availability", { only: false, limited: false });
  const day1 = effectiveDay1(choice);
  const avail = (x: Companion) => availabilityFor(companionRule(x.id, x.availability), day1, now);
  const [search, setSearch] = useState("");
  const [cls, setCls] = useState("");
  const [rarity, setRarity] = useState("");
  const [catalog, setCatalog] = useState("");
  const [stats, setStats] = useState<Set<string>>(new Set());
  const [showStats, setShowStats] = useState(false);
  const [selectedId, setSelectedId] = useState(DATA.find((c) => c.name === "Pera")?.id ?? DATA[0].id);

  const list = DATA.filter((c) => {
    const q = search.trim().toLowerCase();
    const final = finalOf(c);
    const a = avail(c);
    return (
      (!q || [c.name, c.nativeClass, c.catalog, c.gift, c.region, ...c.recommended].join(" ").toLowerCase().includes(q)) &&
      [...stats].every((s) => Number(final[s]) > 0) &&
      (!cls || c.recommended.includes(cls)) &&
      (!catalog || c.catalog === catalog) &&
      (!filter.only || isObtainable(a)) &&
      (!filter.limited || a.state !== "limited") &&
      (!rarity || (rarity === "premium") === c.premium)
    );
  });
  // Newest additions first, then the client's order.
  const ordered = [...list.filter(isNew), ...list.filter((c) => !isNew(c))];
  const c = DATA.find((x) => x.id === selectedId) ?? DATA[0];
  const pick = (id: number) => {
    setSelectedId(id);
    requestAnimationFrame(() => document.getElementById("companion-profile")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const toggleStat = (s: string) =>
    setStats((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });

  return (
    <div className="tool cp">
      <section className="card">
        <AvailabilityBar
          choice={choice}
          onServerChange={onServerChange}
          onlyObtainable={filter.only}
          onToggle={(only) => setFilter({ ...filter, only })}
          hideLimited={filter.limited}
          onToggleLimited={(limited) => setFilter({ ...filter, limited })}
          limitedCount={DATA.filter((x) => avail(x).state === "limited").length}
          hiddenCount={DATA.filter((x) => !isObtainable(avail(x))).length}
          description="Hides unreleased companions, ones your server hasn't reached yet, and event companions from before it opened"
        />
      </section>

      <section className="card cp-roster">
        <div className="roster-head">
          <h2>
            Companions <span className="chip">{list.length}</span>
          </h2>
          <input className="roster-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, class, gift, region" aria-label="Search companions" />
        </div>
        <div className="filter-row" role="group" aria-label="Filter companions">
          {CLASSES.map((k) => (
            <button key={k.name} type="button" className={`class-chip c-${k.name}`} aria-pressed={cls === k.name} onClick={() => setCls(cls === k.name ? "" : k.name)} title={`Good for ${k.name}s`}>
              <GameArt path={`classes/${k.badge}.webp`} name={k.name} alt="" className="class-mini" />
              {k.name}
            </button>
          ))}
          <span className="filter-gap" aria-hidden />
          {[
            ["premium", "Premium"],
            ["standard", "Standard"],
          ].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={rarity === v} onClick={() => setRarity(rarity === v ? "" : v)}>
              {l}
            </button>
          ))}
          <span className="filter-gap" aria-hidden />
          {[...new Set(DATA.map((x) => x.catalog))].map((v) => (
            <button key={v} type="button" aria-pressed={catalog === v} onClick={() => setCatalog(catalog === v ? "" : v)}>
              {v}
            </button>
          ))}
          <button type="button" className="link-button" aria-expanded={showStats} onClick={() => setShowStats((s) => !s)}>
            {showStats ? "Hide stat filters" : `Stat filters${stats.size ? ` (${stats.size})` : ""}`}
          </button>
        </div>
        {showStats && (
          <div className="filter-row stat-filter" role="group" aria-label="Must have these stats">
            {STAT_FILTERS.map((s) => (
              <button key={s} type="button" aria-pressed={stats.has(s)} onClick={() => toggleStat(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {cls && <p className="hint">Companions whose bonuses suit a {cls}.</p>}
        <div className="cp-grid">
          {ordered.map((x) => {
            const a = avail(x);
            const top = Object.entries(finalOf(x)).filter(([n]) => !CORE_KEYS.has(n) && !TRAVEL.has(n)).slice(0, 2);
            return (
              <button key={x.id} type="button" className={`cp-card c-${x.nativeClass}`} aria-pressed={x.id === c.id} onClick={() => pick(x.id)}>
                {isNew(x) && <span className="ribbon">New</span>}
                <span className="cp-portrait">
                  <GameArt path={`companions/icon_${x.id}.webp`} name={x.name} alt="" />
                  {x.premium && <span className="cp-star" title="Premium" aria-label="Premium">★</span>}
                  {badgeOf(x.nativeClass) && <GameArt path={`classes/${badgeOf(x.nativeClass)}.webp`} name={x.nativeClass} alt="" className="cp-class" />}
                </span>
                <b>{x.name}</b>
                <small className="cp-bonus">{top.map(([n, v]) => `${n} ${fmt(n, v)}`).join(" · ") || x.nativeClass}</small>
                {a.tag && <span className={`avail-tag ${a.state}`}>{a.tag}</span>}
              </button>
            );
          })}
          {!list.length && <p className="hint">No companions match these filters.</p>}
        </div>
      </section>

      <Profile key={c.id} c={c} detail={avail(c).detail} availState={avail(c).state} />
    </div>
  );
}

function Profile({ c, detail, availState }: { c: Companion; detail?: string; availState: string }) {
  const [level, setLevel] = useState(c.maxLevel);
  const [chartStat, setChartStat] = useState("ATK");
  const lv = c.maxOnly ? c.maxLevel : Math.max(1, Math.min(c.maxLevel, level));
  const at = (c.maxOnly ? finalOf(c) : c.curve[lv - 1]) || {};
  const final = finalOf(c);
  const special = Object.keys(final).filter((n) => !CORE_KEYS.has(n) && !TRAVEL.has(n));
  const travel = Object.keys(final).filter((n) => TRAVEL.has(n));
  const giftItems = c.gift ? GIFTS[c.gift] ?? [] : [];

  return (
    <section className={`card cp-profile c-${c.nativeClass}`} id="companion-profile">
      <div className="cp-hero">
        <div className="cp-art">
          <GameArt
            path={c.figure ? `companions/figure_${c.id}.webp` : `companions/icon_${c.id}.webp`}
            name={c.name}
            alt={`${c.name} artwork`}
            className={c.figure ? "figure" : "portrait-icon"}
          />
        </div>
        <div className="cp-id">
          <p className="eyebrow">
            {c.premium ? "★ Premium" : "Standard"} · {c.catalog}
            {DUPLICATE_NAMES.has(c.name) ? ` · entry ${c.id}` : ""}
            {isNew(c) && <span className="ribbon inline">New</span>}
          </p>
          <h2 className="pet-name">{c.name}</h2>
          <p className="cp-native">
            {badgeOf(c.nativeClass) && <GameArt path={`classes/${badgeOf(c.nativeClass)}.webp`} name={c.nativeClass} alt="" className="class-mini" />}
            {c.nativeClass}
            {c.region ? <> · {c.region}</> : null}
          </p>
          {c.recommended.length > 0 && (
            <div className="cp-good">
              <span>Good for</span>
              {c.recommended.map((r) => (
                <span key={r} className={`class-pill c-${r}`}>
                  {badgeOf(r) && <GameArt path={`classes/${badgeOf(r)}.webp`} name={r} alt="" className="class-mini" />}
                  {r}
                </span>
              ))}
            </div>
          )}
          {c.recommendationReason && <p className="hint">{c.recommendationReason}</p>}
          {detail && <p className={`note avail-note ${availState}`}>{detail}</p>}
        </div>
      </div>

      <div className="cp-facts">
        <div className="cp-fact gifts">
          <span>Favourite gifts · {c.gift || "not specified"}</span>
          <div className="gift-row">
            {giftItems.map((g) => (
              <img key={g.name} src={`${import.meta.env.BASE_URL}art/${g.icon}`} alt={g.name} title={g.name} loading="lazy" />
            ))}
          </div>
        </div>
        <div className="cp-fact">
          <span>Unlock</span>
          <b>{c.unlock.label}</b>
          {c.unlock.sources.length > 0 && <small>{c.unlock.sources.join(", ")}</small>}
        </div>
      </div>

      {c.maxOnly ? (
        <p className="note">Only the max-friendship bonuses are known for {c.name} so far, so the level slider and growth chart are off.</p>
      ) : (
        <div className="cp-friend">
          <div className="cp-level">
            <span>Friendship</span>
            <b>{lv}</b>
            <small>of {c.maxLevel}</small>
          </div>
          <div className="cp-slider">
            <input type="range" min={1} max={c.maxLevel} value={lv} onChange={(e) => setLevel(+e.target.value)} aria-label="Friendship level" />
            <small>{lv < c.maxLevel ? `Next level at ${(c.exp[lv] || 0).toLocaleString(formatLocale())} total friendship EXP` : "Max friendship"}</small>
          </div>
        </div>
      )}

      <div className="cp-core">
        {CORE.map((s) => (
          <button
            key={s.key}
            type="button"
            className="cp-stat"
            aria-pressed={chartStat === s.key}
            onClick={() => setChartStat(s.key)}
            disabled={c.maxOnly}
            title={c.maxOnly ? undefined : `Show how ${s.key} grows`}
          >
            <GameIcon name={s.icon} />
            <span>{s.key}</span>
            <b>+{fmt(s.key, at[s.key] || 0)}</b>
            <small>max +{fmt(s.key, final[s.key] || 0)}</small>
          </button>
        ))}
      </div>
      {!c.maxOnly && <GrowthChart c={c} stat={chartStat} level={lv} onLevel={setLevel} />}

      {special.length > 0 && (
        <>
          <h3 className="subhead">Special bonuses</h3>
          <div className="cp-bonuses">
            {special.map((n) => {
              const v = at[n] || 0;
              const unlockAt = c.maxOnly ? null : c.curve.findIndex((row) => (row[n] || 0) > 0) + 1;
              return (
                <div key={n} className={v ? "on" : "off"}>
                  <span>{n}</span>
                  <b>{v ? `+${fmt(n, v)}` : "—"}</b>
                  <small>{v === final[n] ? "max" : `max +${fmt(n, final[n])}${unlockAt && !v ? ` · from Lv ${unlockAt}` : ""}`}</small>
                </div>
              );
            })}
          </div>
        </>
      )}
      {travel.length > 0 && (
        <>
          <h3 className="subhead">Travel</h3>
          <div className="cp-bonuses">
            {travel.map((n) => (
              <div key={n} className={at[n] ? "on" : "off"}>
                <span>{short(n)}</span>
                <b>{at[n] ? `+${fmt(n, at[n])}` : "—"}</b>
                <small>max +{fmt(n, final[n])}</small>
              </div>
            ))}
          </div>
        </>
      )}
      {isNew(c) && <p className="hint source-note">{c.name} comes from Purrwikimania until the client data catches up.</p>}
    </section>
  );
}

/** How one core stat grows over friendship levels, with the chosen level marked. Click to jump there. */
function GrowthChart({ c, stat, level, onLevel }: { c: Companion; stat: string; level: number; onLevel: (lv: number) => void }) {
  const W = 600;
  const H = 120;
  const pad = 6;
  const values = useMemo(() => c.curve.map((row) => row[stat] || 0), [c, stat]);
  const max = Math.max(1, ...values);
  const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  // Stepped line: friendship bonuses arrive in steps, not smoothly.
  const path = values.map((v, i) => (i ? `H${x(i).toFixed(1)}V${y(v).toFixed(1)}` : `M${x(0).toFixed(1)},${y(v).toFixed(1)}`)).join("");
  const area = `${path}V${H - pad}H${x(0)}Z`;
  const cx = x(level - 1);
  return (
    <figure className="cp-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${stat} bonus by friendship level, up to +${max.toLocaleString(formatLocale())}`}
        onClick={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          onLevel(Math.max(1, Math.min(c.maxLevel, Math.round(((e.clientX - r.left) / r.width) * (values.length - 1)) + 1)));
        }}
      >
        <defs>
          <linearGradient id="cp-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--c)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--c)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#cp-fill)" />
        <path d={path} fill="none" stroke="var(--c)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <line x1={cx} x2={cx} y1={pad} y2={H - pad} stroke="var(--text)" strokeOpacity="0.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption>
        <span>{stat} bonus by friendship level · click to jump</span>
        <span>
          Lv {level}: <b>+{(values[level - 1] || 0).toLocaleString(formatLocale())}</b>
        </span>
      </figcaption>
    </figure>
  );
}
