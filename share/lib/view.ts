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
  quality: string;
}

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

const slot = (id: number | null): Slot | null => {
  const s = id ? SKILLS[String(id)] : undefined;
  return s ? { name: s[0], art: `skills/${id}.png`, quality: s[1] } : null;
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
    skills: l.skills.map(slot),
    charms: l.charms.map(slot),
    pet: pet ? { name: pet[0], art: pet[1] } : null,
    notes: l.notes.trim(),
  };
}

export const SITE = "https://sxs.lmthings.com";
