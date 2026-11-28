// Spending guide structure. Community consensus, not official. The words live in src/i18n/en.ts under "sp."
// (and the other language files), so each line can be translated: sp.deal.<id>.name / .verdict / .why1… / .best / .link.

export type Tier = "best" | "good" | "situational" | "skip";

export interface Deal {
  id: string;
  tier: Tier;
  /** How many "why" points it has (sp.deal.<id>.why1, why2…). */
  why: number;
  /** Has a "Best for" line (sp.deal.<id>.best). */
  bestFor?: boolean;
  /** A page on this site to point to (label in sp.deal.<id>.link), shown after "Best for". */
  link?: string;
}

export const TIERS: Tier[] = ["best", "good", "situational", "skip"];

export const DEALS: Deal[] = [
  { id: "monthly", tier: "best", why: 2, bestFor: true },
  { id: "pilgrimage", tier: "best", why: 2, bestFor: true },
  { id: "growth", tier: "best", why: 2, bestFor: true },
  { id: "starter", tier: "best", why: 2, bestFor: true },
  { id: "unlock", tier: "best", why: 2, bestFor: true, link: "/map" },
  { id: "prayer", tier: "good", why: 2 },
  { id: "popup", tier: "situational", why: 2, bestFor: true },
  { id: "limited", tier: "situational", why: 2 },
  { id: "currency", tier: "skip", why: 2 },
  { id: "random", tier: "skip", why: 1 },
];

/** Cosmetics get their own section (sp.cos.*) rather than a value rating: they're bought for fun, not progress. */
export const COSMETICS_PARAGRAPHS = 2;

/** Questions to ask about any deal before buying (sp.chk<n>.q / .flag). `good` is the answer that's no red flag. */
export const CHECKLIST: { good: boolean }[] = [{ good: true }, { good: true }, { good: false }, { good: false }];

/** Free-to-play and spending tips that apply whatever you buy (sp.tip1…). */
export const TIPS = 3;
