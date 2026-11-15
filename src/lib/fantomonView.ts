// One view of a Fantomon for the Fantomons page, whichever source it comes from: the client data
// (0xNobody's extract) or, for Fantomons that data doesn't have yet, Purrwikimania's records (game data
// by Boltray Games). Profiles from Purrwikimania also add role, movement, shards and Fantasmia to every one.
import profilesRaw from "../data/fantomonProfiles.json";
import { rowText, type Explorer } from "./explorer";
import { nearest, type Props } from "./gamedata";

/** Skill values as Purrwikimania stores them: per rank, either a direct value or a multiplier on a level curve. */
export interface PwmValues {
  ranks: number[];
  vals: Record<string, Record<string, number>>;
  lmult: Record<string, Record<string, number>>;
  lgroup: Record<string, number>;
  labels: Record<string, string>;
  pct: Record<string, boolean>;
  order: Record<string, number>;
  pair: Record<string, string>;
  lkey: Record<string, string>;
  origRank?: number;
}

interface ProfileSkill {
  name: string;
  tags: string[];
  description: string;
  icon?: string;
  values?: PwmValues;
}

export interface Fantasmia {
  cap: number;
  initial: number;
  perTurn: number;
  perDmg: number;
  note: string;
}

interface Profile {
  role?: string;
  moves?: string;
  shardsToSummon?: number;
  battleBase?: Record<string, number>;
  adultLevel?: number;
  fantasmia?: Fantasmia;
  skills: { support: ProfileSkill[]; field: { name: string; description: string } | null; battle: ProfileSkill[] };
  new?: { name: string; baby: string | null; adult: string | null };
}

export const PROFILES = profilesRaw as unknown as Record<string, Profile>;

/** Skill qualities in order: client grade code, display name, and the first of its 34 skill ranks. */
export const QUALITIES = [
  { raw: "Blue", name: "Rare", rank: 1 },
  { raw: "Purple", name: "Epic", rank: 3 },
  { raw: "Orange", name: "Legendary", rank: 6 },
  { raw: "Gold", name: "Mythic", rank: 10 },
  { raw: "Red", name: "Divine", rank: 16 },
  { raw: "Rainbow", name: "Immortal", rank: 24 },
] as const;
export type QualityRaw = (typeof QUALITIES)[number]["raw"];
const qIndex = (raw: string) => QUALITIES.findIndex((q) => q.raw === raw);
const qualityOfRank = (rank: number) => [...QUALITIES].reverse().find((q) => rank >= q.rank) ?? QUALITIES[0];


export interface SkillLine {
  label: string;
  text: string;
}

export interface ViewSkill {
  name: string;
  tags: string[];
  description: string;
  icon?: string;
  /** Number lines at a skill quality and Fantomon level. */
  lines: (quality: QualityRaw, level: number) => SkillLine[];
}

export interface FantomonView {
  id: number;
  name: string;
  /** Client type (Attacker, Support…) or Purrwikimania role. */
  type: string;
  role?: string;
  moves?: string;
  status?: string;
  /** Starting Fantomon quality. */
  quality: QualityRaw;
  /** Lowest skill quality (skills start a step below the Fantomon). */
  skillStart: QualityRaw;
  baby: string;
  adult?: string;
  adultLevel?: number;
  shardsToSummon?: number;
  battleBase?: Record<string, number>;
  fantasmia?: Fantasmia;
  support: ViewSkill[];
  field?: { name: string; description: string };
  battle: ViewSkill[];
  stats: (level: number) => Props;
  /** Data that came from Purrwikimania rather than the client extract. */
  fromPwm: boolean;
  isNew: boolean;
}

const fmt = (v: number, pct: boolean) =>
  pct ? `${(Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "")}%` : Math.abs(v) < 10 ? String(Math.round(v * 100) / 100) : Math.round(v).toLocaleString("en-US");

/** Evaluates a Purrwikimania skill record against our own level curves (the same game tables). */
export function pwmLines(explorer: Explorer, v: PwmValues, quality: QualityRaw, level: number, combatRank = "Silver3"): SkillLine[] {
  const { C } = explorer;
  const want = QUALITIES[qIndex(quality)].rank;
  const rank = String([...v.ranks].reverse().find((r) => r <= want) ?? v.ranks[0]);
  const curveRow = (prop: string) => {
    const id = C.skillGroups[String(v.lgroup[prop])]?.[combatRank];
    const table = id ? C.skillFixedCurves[id] ?? C.skillPassiveCurves[id] : undefined;
    return table ? nearest(table, level) : undefined;
  };
  const valueOf = (prop: string): number | undefined => {
    const direct = v.vals[rank]?.[prop];
    if (direct !== undefined) return direct;
    const mult = v.lmult[rank]?.[prop];
    if (mult === undefined) return undefined;
    const row = curveRow(prop);
    const key = v.lkey[prop] || prop;
    return row && row[key] !== undefined ? row[key] * mult : undefined;
  };
  const paired = new Set(Object.values(v.pair));
  return Object.keys(v.labels)
    .filter((p) => !paired.has(p))
    .sort((a, b) => (v.order[b] || 0) - (v.order[a] || 0))
    .flatMap((p) => {
      const x = valueOf(p);
      if (x === undefined || (p === "CD" && x < 0)) return [];
      let text = fmt(x, v.pct[p]);
      const mate = v.pair[p];
      const f = mate ? valueOf(mate) : undefined;
      if (f) text += ` + ${fmt(f, v.pct[mate])}`;
      return [{ label: v.labels[p], text }];
    });
}

/** Every Fantomon on the page: the client roster plus newer ones from Purrwikimania. */
export function buildFantomons(explorer: Explorer): FantomonView[] {
  const { C } = explorer;
  const shared = C.pets["1612"]?.levels ?? {};
  const out: FantomonView[] = explorer.fantomons.map((f) => {
    const pet = C.pets[String(f.id)];
    const prof = PROFILES[String(f.id)];
    const quality = (pet.minQuality || "Purple") as QualityRaw;
    const skillStart = (qIndex(quality) < qIndex("Orange") ? quality : "Orange") as QualityRaw;
    const icons = new Map<string, string | undefined>(
      [...(prof?.skills.support ?? []), ...(prof?.skills.battle ?? [])].map((s) => [s.name, s.icon]),
    );
    const tagsOf = new Map<string, string[]>([...(prof?.skills.support ?? []), ...(prof?.skills.battle ?? [])].map((s) => [s.name, s.tags]));
    const client = (s: { id: number; name: string; description?: string }): ViewSkill => ({
      name: /^(?:Skill \d+|DNTB)/i.test(s.name) ? `Unlocalized ability (ID ${s.id})` : s.name,
      tags: tagsOf.get(s.name) ?? [],
      description: s.description || "No description in this client build.",
      icon: icons.get(s.name),
      lines: (q, level) => {
        const raw = qIndex(q) < qIndex(skillStart) ? skillStart : q;
        // Fantomon skills use the same 34 ranks as character skills; a quality starts at its first rank
        // (Rare 1, Epic 3, Legendary 6, Mythic 10, Divine 16, Immortal 24), which is what the client's
        // values step up at.
        return explorer.detail(s.id, raw, 0, level, "Silver3").rows.map((r) => ({ label: r.label, text: rowText(r) }));
      },
    });
    const baby = pet.stages?.Childhood ?? [];
    const supportNames = new Set(baby.map((s) => s.name));
    const adult = pet.forms?.Adulthood;
    return {
      id: f.id,
      name: f.name,
      type: f.type,
      role: prof?.role,
      moves: prof?.moves,
      status: f.status,
      quality,
      skillStart,
      baby: `fantomons/pet_${pet.forms?.Childhood?.iconId || f.id}.webp`,
      adult: adult ? `fantomons/pet_${adult.iconId}.webp` : undefined,
      adultLevel: adult ? adult.level || prof?.adultLevel || 100 : undefined,
      shardsToSummon: prof?.shardsToSummon,
      battleBase: prof?.battleBase,
      fantasmia: prof?.fantasmia,
      support: baby.map(client),
      field: prof?.skills.field ?? undefined,
      battle: (pet.stages?.Adulthood ?? []).filter((s) => !supportNames.has(s.name)).map(client),
      stats: (level) => nearest(pet.levels, level),
      fromPwm: false,
      isNew: false,
    };
  });

  for (const [id, prof] of Object.entries(PROFILES)) {
    if (!prof.new) continue;
    const start = qualityOfRank(prof.skills.support[0]?.values?.origRank ?? 3);
    // A Fantomon's skills start one quality below the Fantomon itself.
    const quality = QUALITIES[Math.min(QUALITIES.length - 1, qIndex(start.raw) + 1)].raw;
    const pwm = (s: ProfileSkill): ViewSkill => ({
      name: s.name,
      tags: s.tags,
      description: s.description,
      icon: s.icon,
      lines: (q, level) => (s.values ? pwmLines(explorer, s.values, q, level) : []),
    });
    out.push({
      id: +id,
      name: prof.new.name,
      type: prof.role ?? "",
      role: prof.role,
      moves: prof.moves,
      quality,
      skillStart: start.raw,
      baby: prof.new.baby ?? `fantomons/pet_${id}.webp`,
      adult: prof.new.adult ?? undefined,
      adultLevel: prof.new.adult ? prof.adultLevel ?? 100 : undefined,
      shardsToSummon: prof.shardsToSummon,
      battleBase: prof.battleBase,
      fantasmia: prof.fantasmia,
      support: prof.skills.support.map(pwm),
      field: prof.skills.field ?? undefined,
      battle: prof.skills.battle.map(pwm),
      stats: (level) => nearest(shared, level),
      fromPwm: true,
      isNew: true,
    });
  }
  return out;
}

export const qualityName = (raw: string) => QUALITIES.find((q) => q.raw === raw)?.name ?? raw;
export const qualitiesFrom = (raw: string) => QUALITIES.slice(Math.max(0, qIndex(raw)));
