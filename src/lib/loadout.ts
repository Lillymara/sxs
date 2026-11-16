// A skill loadout and its share-link form. The whole build lives in the link (no server, no login):
// ?b= is base64url of a compact JSON array, versioned so old links keep working.

export const SKILL_SLOTS = 4;
export const CHARM_SLOTS = 4;
export const TITLE_MAX = 60;
export const NOTES_MAX = 400;

export interface Loadout {
  /** Class code, e.g. "Mishushi". */
  cls: string;
  /** Skills in cast order; null is an empty slot. */
  skills: (number | null)[];
  charms: (number | null)[];
  pet: number | null;
  title: string;
  notes: string;
}

export interface SavedLoadout extends Loadout {
  id: string;
  savedAt: number;
}

export const emptyLoadout = (cls = "Zhanshi"): Loadout => ({
  cls,
  skills: Array(SKILL_SLOTS).fill(null),
  charms: Array(CHARM_SLOTS).fill(null),
  pet: null,
  title: "",
  notes: "",
});

const VERSION = 1;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

const slots = (ids: unknown, n: number): (number | null)[] => {
  const arr = Array.isArray(ids) ? ids : [];
  return Array.from({ length: n }, (_, i) => (Number.isInteger(arr[i]) && arr[i] > 0 ? (arr[i] as number) : null));
};

/** The ?b= code for a loadout. Empty slots are 0. */
export function encodeLoadout(l: Loadout): string {
  const z = (xs: (number | null)[]) => xs.map((x) => x ?? 0);
  return toBase64Url(JSON.stringify([VERSION, l.cls, z(l.skills), z(l.charms), l.pet ?? 0, l.title.slice(0, TITLE_MAX), l.notes.slice(0, NOTES_MAX)]));
}

/** Reads a ?b= code back. Returns null for anything that isn't a loadout link. */
export function decodeLoadout(code: string): Loadout | null {
  try {
    const a = JSON.parse(fromBase64Url(code));
    if (!Array.isArray(a) || a[0] !== VERSION || typeof a[1] !== "string") return null;
    return {
      cls: a[1],
      skills: slots(a[2], SKILL_SLOTS),
      charms: slots(a[3], CHARM_SLOTS),
      pet: Number.isInteger(a[4]) && a[4] > 0 ? a[4] : null,
      title: typeof a[5] === "string" ? a[5].slice(0, TITLE_MAX) : "",
      notes: typeof a[6] === "string" ? a[6].slice(0, NOTES_MAX) : "",
    };
  } catch {
    return null;
  }
}

export const shareUrl = (l: Loadout, origin = window.location.origin) => `${origin}/loadouts?b=${encodeLoadout(l)}`;

export const isEmpty = (l: Loadout) => !l.skills.some(Boolean) && !l.charms.some(Boolean) && !l.pet && !l.title.trim() && !l.notes.trim();
