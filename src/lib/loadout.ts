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
  /** Skill rank (1–34, grade and stars together) by skill id, for skills raised above their base. */
  ranks: Record<string, number>;
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
  ranks: {},
});

export const MAX_RANK = 34;

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
      ranks: {},
    };
  } catch {
    return null;
  }
}

// ---- Short links: /l/<code> ----
// The build packed into bits: version (3), class (5), 8 slots × 10 (skill id − 9999, 0 = empty),
// Fantomon (6, id − 1599), then the name (length byte + UTF-8) and any notes (UTF-8, to the end).
// About 16 characters before the name. Version 2 adds each slot's rank (6 bits, 0 = base) after the
// Fantomon; it's only used when a slotted skill has a rank set, so plain builds keep the shorter code.

/** Class codes in a fixed order. Only ever append: a link stores the position. */
const CLASS_CODES = [
  "Zhanshi", "Fashi", "Huwei", "Doushi", "Shushi", "Xianzhe", "Dunjiashi", "Kuangzhanshi", "Modaoshi", "Mishushi",
  "Shouhuzhe", "Zhengfuzhe", "Huimiezhe", "Zhangkongzhe", "LegendShouhuzhe", "LegendZhengfuzhe", "LegendHuimiezhe",
  "LegendZhangkongzhe", "Shouhuzhe6", "Zhengfuzhe6", "Huimiezhe6", "Zhangkongzhe6", "Shouhuzhe7", "Zhengfuzhe7",
  "Huimiezhe7", "Zhangkongzhe7",
];
const SHORT_VERSION = 1;
const RANKED_VERSION = 2;
const HEAD_BYTES = 12; // 94 bits, rounded up
const RANKED_HEAD_BYTES = 18; // 142 bits, rounded up

const bytesToB64 = (bytes: Uint8Array) => {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64ToBytes = (code: string) => {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

export function encodeShort(l: Loadout): string {
  const ids = [...l.skills, ...l.charms].map((x) => (x && x > 9999 && x < 11023 ? x : 0));
  const rankOf = (id: number) => {
    const r = id ? l.ranks?.[String(id)] : 0;
    return r && Number.isInteger(r) && r > 0 && r <= MAX_RANK ? r : 0;
  };
  const ranked = ids.some(rankOf);
  const fields: [number, number][] = [
    [ranked ? RANKED_VERSION : SHORT_VERSION, 3],
    [Math.max(0, CLASS_CODES.indexOf(l.cls)), 5],
    ...ids.map((x): [number, number] => [x ? x - 9999 : 0, 10]),
    [l.pet && l.pet > 1599 && l.pet < 1663 ? l.pet - 1599 : 0, 6],
    ...(ranked ? ids.map((x): [number, number] => [rankOf(x), 6]) : []),
  ];
  const head = new Uint8Array(ranked ? RANKED_HEAD_BYTES : HEAD_BYTES);
  let bit = 0;
  for (const [value, width] of fields)
    for (let i = width - 1; i >= 0; i--, bit++) if ((value >> i) & 1) head[bit >> 3] |= 0x80 >> (bit & 7);
  const enc = new TextEncoder();
  const title = enc.encode(l.title.trim().slice(0, TITLE_MAX)).slice(0, 255);
  const notes = enc.encode(l.notes.trim().slice(0, NOTES_MAX));
  const tail = title.length || notes.length ? [title.length, ...title, ...notes] : [];
  return bytesToB64(Uint8Array.from([...head, ...tail]));
}

export function decodeShort(code: string): Loadout | null {
  try {
    const bytes = b64ToBytes(code);
    let bit = 0;
    const read = (width: number) => {
      let v = 0;
      for (let i = 0; i < width; i++, bit++) v = (v << 1) | ((bytes[bit >> 3] >> (7 - (bit & 7))) & 1);
      return v;
    };
    const version = read(3);
    if (version !== SHORT_VERSION && version !== RANKED_VERSION) return null;
    const headBytes = version === RANKED_VERSION ? RANKED_HEAD_BYTES : HEAD_BYTES;
    if (bytes.length < headBytes) return null;
    const cls = CLASS_CODES[read(5)];
    if (!cls) return null;
    const slotIds = Array.from({ length: SKILL_SLOTS + CHARM_SLOTS }, () => {
      const v = read(10);
      return v ? v + 9999 : null;
    });
    const pet = read(6);
    const ranks: Record<string, number> = {};
    if (version === RANKED_VERSION)
      slotIds.forEach((id) => {
        const r = read(6);
        if (id && r > 0 && r <= MAX_RANK) ranks[String(id)] = r;
      });
    const dec = new TextDecoder();
    const titleLen = bytes[headBytes] ?? 0;
    const title = dec.decode(bytes.slice(headBytes + 1, headBytes + 1 + titleLen));
    const notes = dec.decode(bytes.slice(headBytes + 1 + titleLen));
    return {
      cls,
      skills: slotIds.slice(0, SKILL_SLOTS),
      charms: slotIds.slice(SKILL_SLOTS),
      pet: pet ? pet + 1599 : null,
      title: title.slice(0, TITLE_MAX),
      notes: notes.slice(0, NOTES_MAX),
      ranks,
    };
  } catch {
    return null;
  }
}

/** Share links go through l.lmthings.com (share/ in this repo), which gives Discord and other apps a
 *  preview picture of the build and sends people on to sxs.lmthings.com/l/<code>. */
export const SHARE_ORIGIN = "https://l.lmthings.com";
export const shareUrl = (l: Loadout) => `${SHARE_ORIGIN}/${encodeShort(l)}`;

export const isEmpty = (l: Loadout) => !l.skills.some(Boolean) && !l.charms.some(Boolean) && !l.pet && !l.title.trim() && !l.notes.trim();
