// Values from Sword x Staff's own config tables, as extracted by kakotheris for their
// Primostar Calculator (https://kakotheris.neocities.org/primostar-calculator).
// The game values belong to the game's publisher; the calculations using them here are our own.

import type { RealmMaterial } from "../lib/planner/plan";

/** Stamina regenerates 5 an hour (hang_up_reward). */
export const STAMINA_REGEN_PER_HOUR = 5;

/** What the daily tasks pay each day. Rola is a base, multiplied by the rank scale. */
export const DAILY_TASKS = {
  stamina: 40,
  dawnium: 170,
  rolaBase: 2000,
  /** Free Realm tools a day: 5 Iron Hammers, 5 Gold Pickaxes, 5 Worn Knuckles, 10 Sand Shovels. */
  realmTools: { ore: 5, rola: 5, essence: 5, sand: 10 } as Record<RealmMaterial, number>,
};

/** Realm tool names, by the material their Realm gives. */
export const REALM_TOOL_NAMES: Record<RealmMaterial, string> = {
  ore: "Iron Hammers",
  rola: "Gold Pickaxes",
  essence: "Worn Knuckles",
  sand: "Sand Shovels",
};

/** Overworld gathering: each attempt costs 5 Stamina and pays a base times the rank scale. */
export const STAMINA_PER_GATHER = 5;
export const GATHER_BASE = { rola: 1200, ore: 120, sand: 100, essence: 150 };

/**
 * Grand Ore Mines: a gather turns one up 5% of the time (guaranteed by the 75th), paying 2x a gather
 * for no Stamina. Combat targets (Essence) have none. Mines other players share are capped at 50 a week.
 */
export const GRAND_MINE = { chance: 0.05, pity: 75, multiplier: 2, sharedPerWeek: 50 };

/** Long-run chance per gather of finding a Grand Mine, with the pity counted in. */
export const GRAND_MINE_RATE = (() => {
  const { chance: p, pity: n } = GRAND_MINE;
  const meanGathers = (1 - Math.pow(1 - p, n)) / p;
  return 1 / meanGathers;
})();

/** Home Shop refresh prices in Rola, in order. Up to 10 a day. */
export const SHOP_REFRESH_COSTS = [4000, 8000, 12000, 20000, 30000, 48000, 80000, 120000, 160000, 240000];

/** Home Shop listings of each material per shelf (the free daily shelf and each refresh). */
export const SHOP_LISTINGS_PER_SHELF = 1.5;

/** Shop prices are the item price times a random discount: 100%, 90%, 80%, 70% or 60%, averaging 80%. */
export const SHOP_PRICE_MULTIPLIER = 0.8;

/** Item list prices in Rola: per Ore, White Sand, Essence, and per Fantomon EXP of treats (100 Rola / 50 EXP). */
export const SHOP_UNIT_PRICE = { ore: 10, sand: 12, essence: 8, treatExp: 2 };

/** Home Shop stack size per listing at each season's rank (Sand in White Sand, treats in Fantomon EXP). */
export const SHOP_STACKS: Record<number, { ore: number; sand: number; essence: number; treatExp: number }> = {
  1: { ore: 1000, sand: 1000, essence: 1000, treatExp: 5000 },
  2: { ore: 1500, sand: 1500, essence: 1500, treatExp: 7400 },
  3: { ore: 3000, sand: 3000, essence: 3000, treatExp: 15000 },
  4: { ore: 6760, sand: 5343.75, essence: 6760, treatExp: 33800 },
  5: { ore: 12000, sand: 12000, essence: 12000, treatExp: 63500 },
  6: { ore: 18020, sand: 18166.67, essence: 18000, treatExp: 96000 },
};

/** Rola bought with Dawnium: 1,500 x rank scale a purchase, five at 30, five at 50, then 100 each. */
export const ROLA_BUY = { base: 1500, prices: [30, 30, 30, 30, 30, 50, 50, 50, 50, 50], beyond: 100 };

/** Dawnium for the first `n` Rola purchases of a day. */
export const rolaBuyCost = (n: number) => {
  let t = 0;
  for (let i = 0; i < n; i++) t += ROLA_BUY.prices[i] ?? ROLA_BUY.beyond;
  return t;
};

/** Rola for the first `n` Home Shop refreshes of a day. */
export const shopRefreshCost = (n: number) => SHOP_REFRESH_COSTS.slice(0, Math.min(10, Math.max(0, n))).reduce((a, b) => a + b, 0);

/** Every relic level also costs Rola: 9 per Rare Sand in Season 1, 45 per Epic Sand after. */
export const RELIC_ROLA_PER_SAND: Record<number, number> = { 1: 9, 2: 45, 3: 45, 4: 45, 5: 45, 6: 45 };
