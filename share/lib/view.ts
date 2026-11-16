// A short loadout code turned into names and art paths, for the preview page and picture.
import data from "./data.json";
import { decodeShort } from "./loadout";

type Pair = [string, string];
const SKILLS = data.skills as Record<string, Pair>;
const CLASSES = data.classes as Record<string, [string, number]>;
const PETS = data.pets as Record<string, Pair>;

export interface Slot {
  name: string;
  art: string;
  /** Grade the skill is at in this build (Blue … Rainbow). */
  quality: string;
  stars: number;
}

/** Skill rank range of each grade, as on the site (src/lib/explorer.ts). */
const GRADE_RANKS: [string, number, number][] = [
  ["Blue", 1, 2], ["Purple", 3, 5], ["Orange", 6, 9], ["Gold", 10, 15], ["Red", 16, 23], ["Rainbow", 24, 34],
];

export interface View {
  code: string;
  title: string;
  className: string;
  badge: string;
  skills: (Slot | null)[];
  charms: (Slot | null)[];
  pet: { name: string; art: string } | null;
  notes: string;
}

const slot = (id: number | null, ranks: Record<string, number>): Slot | null => {
  const s = id ? SKILLS[String(id)] : undefined;
  if (!s) return null;
  const g = ranks[String(id)] ? GRADE_RANKS.find(([, a, b]) => ranks[String(id)] >= a && ranks[String(id)] <= b) : undefined;
  return { name: s[0], art: `skills/${id}.png`, quality: g ? g[0] : s[1], stars: g ? ranks[String(id)] - g[1] : 0 };
};

export function viewOf(code: string): View | null {
  const l = decodeShort(code);
  if (!l) return null;
  const [className, badge] = CLASSES[l.cls] ?? [l.cls, 0];
  const pet = l.pet ? PETS[String(l.pet)] : undefined;
  return {
    code,
    title: l.title.trim() || `${className} loadout`,
    className,
    badge: `classes/${badge}.png`,
    skills: l.skills.map((id) => slot(id, l.ranks)),
    charms: l.charms.map((id) => slot(id, l.ranks)),
    pet: pet ? { name: pet[0], art: pet[1] } : null,
    notes: l.notes.trim(),
  };
}

export const SITE = "https://sxs.lmthings.com";
