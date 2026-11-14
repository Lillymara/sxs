import { DAWNIUM_REFRESH_COSTS, ENTRIES_PER_REFRESH, getRule, type SeasonRule } from "../../data/seasons";
import { REFINED_ORE_GATHER,
  DAILY_TASKS,
  GATHER_BASE,
  GRAND_MINE,
  GRAND_MINE_RATE,
  ROLA_BUY,
  SHOP_LISTINGS_PER_SHELF,
  SHOP_PRICE_MULTIPLIER,
  SHOP_STACKS,
  SHOP_UNIT_PRICE,
  STAMINA_PER_GATHER,
  STAMINA_REGEN_PER_HOUR,
  rolaBuyCost,
  shopRefreshCost,
} from "../../data/gameConfig";
import { expToNext, getSeason } from "../xp";
import { planForGoal, type GoalPlan } from "./optimize";
import { progressionCaps, upgradeCosts, type ProgressionCaps, type Slot, type UpgradeCosts } from "./costs";
import { realmYieldsPerEntry, type RealmYields } from "./realm";
import { minimumPlan, scoreSeason, type MinimumPlan, type ScoreSummary, type SlotCategory } from "./score";
import { summarizeTime, type TimeInput, type TimeSummary } from "./time";

export type Material = "ore" | "rola" | "essence" | "sand" | "treats";
export type RealmMaterial = Exclude<Material, "treats">;
/** A daily Realm refresh split and its Dawnium cost; `capped` Realms would need more than 10 a day. */
export interface RealmSplit {
  perDay: Record<RealmMaterial, number>;
  dawniumPerDay: number;
  dawniumTotal: number;
  capped: RealmMaterial[];
}

export const REALM_MATERIALS: RealmMaterial[] = ["ore", "rola", "essence", "sand"];

export interface MaterialIncome {
  have: number;
  cartPerHour: number;
  /** Shop purchases and anything else you get per real day. */
  perDay: number;
}

type Gathered = "rola" | "ore" | "sand" | "essence";

export interface OverworldInput {
  /** Share of stamina spent on each gather type, in percent. */
  split: Record<Gathered, number>;
  /** Grand Mines other players share with you, per week by type (50 a week across all types). */
  bigNodesPerWeek: { rola: number; ore: number; sand: number };
  /** Material per stamina on a regular gather; 0 means work it out from the rank. */
  yieldPerStamina: { rola: number; ore: number; sand: number };
  dungeonOrePerDay: number;
}

export interface PlannerInput extends TimeInput {
  season: number;
  level: number;
  xpIntoLevel: number;
  xpPerHour: number;
  /** Goddess statues: each adds 1% EXP; new ones arrive each daily reset. */
  statues: number;
  statuesPerDay: number;
  primostarsNow: number;
  primostarGoal: number;
  gear: Slot[];
  skills: Slot[];
  fantomons: Slot[];
  relics: Slot[];
  income: Record<Material, MaterialIncome>;
  overworld: OverworldInput;
  /** Realm refreshes bought per day by type (0–10), order Ore-Rola-Essence-Sand. */
  refreshes: Record<RealmMaterial, number>;
  savedEntries: Record<RealmMaterial, number>;
  /** Realm rank tier 1–3. */
  realmTier: number;
  /** Fantomon feed EXP per treat. */
  expPerTreat: number;
  /** Whether the daily tasks are done (Stamina, Realm tools and Rola). */
  dailyTasks: boolean;
  /** Home Shop refreshes bought per day (0–10). */
  shopRefreshes: number;
  /** Rola bought with Dawnium per day. */
  rolaBuys: number;
  /** Refined Ore on hand (optional in older callers). */
  refinedOre?: number;
}

export interface CharacterProjection {
  ok: boolean;
  /** Level and XP at season end. */
  level: number;
  xp: number;
  need: number;
  /** Level including fractional progress. */
  decimalLevel: number;
  xpGained: number;
  /** EXP held in the bed for next season. */
  xpSaved: number;
  /** Level where the XP table ran out, if it did. */
  stoppedAt?: number;
}

export interface MaterialLine {
  key: Material;
  label: string;
  need: number;
  /** Passive total by season end, before Realms. */
  passive: number;
  fromCart: number;
  fromOverworld: number;
  shortfall: number;
  realmYield: number | null;
  realmEntriesNeeded: number | null;
  entriesAvailable: number | null;
  entriesLeft: number | null;
  /** When passive income alone covers the need (null = not by season end). */
  readyAt: Date | null;
  unknownCost: boolean;
  /** Covered by the Realm entries you'll have. */
  fromRealm: number;
  /** Bought in the Home Shop, and the Rola it costs. */
  fromShop: number;
  shopRola: number;
  /** What the Home Shop would list over the season, if bought out. */
  shopSupply: number;
  /** Income + Realm + shop − need: positive is spare, negative is still short. */
  balance: number;
}

export interface PlannerResult {
  rule: SeasonRule;
  time: TimeSummary;
  character: CharacterProjection;
  caps: ProgressionCaps;
  score: ScoreSummary;
  costs: UpgradeCosts;
  materials: MaterialLine[];
  realmYields: RealmYields | null;
  realmEntriesNeeded: number | null;
  dawniumPerDay: number;
  stamina: number;
  /** Rank scale used for gathering, the shop and Rola purchases. */
  scale: number;
  /** Material per Stamina used when no override is given. */
  gatherPerStamina: Record<Gathered, number>;
  /** Gathered in the overworld by season end (Stamina gathers, shared Grand Mines and dungeon Ore). */
  gathered: Record<Gathered, number>;
  /** Rola spent on Home Shop refreshes per day, and Rola bought with Dawnium per day. */
  shopRefreshRolaPerDay: number;
  rolaBoughtPerDay: number;
  /** Realm tools over the season, by Realm. */
  realmTools: Record<RealmMaterial, number>;
  /** Refined Ore for gear (every 5 levels): need, on hand, gathered by season end (4 spots a day), and what's left. */
  refinedOre: { need: number; have: number; gathered: number; left: number };
  /** Fewest daily Realm refreshes that cover what's still short, with their Dawnium cost; null without Realm data. */
  realmSuggestion: RealmSplit | null;
  /** Refreshes the goal would need (planned with up to 10 a day), and whether even that reaches it. */
  goalRealms: (RealmSplit & { reachable: boolean }) | null;
  /** Season points as things stand today (current levels, character's level now). */
  scoreNow: number;
  /** Character level now, with progress into the level as a fraction. */
  levelNow: number;
  /** The cheapest plan across every system that reaches the goal, or null with no goal to reach. */
  goalPlan: (GoalPlan & { reachableTotal: number }) | null;
  /** Per category: the lowest plan that reaches the goal with everything else as planned. */
  minimum: Record<SlotCategory, MinimumPlan>;
}

const LABELS: Record<Material, string> = {
  ore: "Ore",
  rola: "Rola",
  essence: "Essence",
  sand: "Sand (White eq.)",
  treats: "Treats",
};


/**
 * Character EXP over the season. The rate is constant between resets and steps up
 * at each reset as new statues arrive; boost hours are paid at the post-reset rate.
 */
function projectCharacter(input: PlannerInput, time: TimeSummary): CharacterProjection {
  const table = getSeason(input.season);
  const base = Math.max(0, input.xpPerHour);
  const rateAfter = (resetsPassed: number) =>
    (base * (1 + (input.statues + resetsPassed * input.statuesPerDay) / 100)) / (1 + input.statues / 100);

  // Natural hours count until the save window opens; boosts always count.
  const naturalEnd = time.saveStart ?? input.end;
  const bounds = [input.start, ...time.resets, input.end];
  let gained = 0;
  let saved = 0;
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i].getTime(), b = bounds[i + 1].getTime();
    const cut = Math.min(Math.max(naturalEnd.getTime(), a), b);
    const rate = rateAfter(i);
    gained += ((cut - a) / 3_600_000) * rate;
    saved += ((b - cut) / 3_600_000) * rate;
    if (i > 0) gained += input.boostHoursPerReset * rate;
  }

  let level = input.level;
  let xp = Math.max(0, input.xpIntoLevel);
  let remaining = gained;
  const need = (l: number) => (table ? expToNext(table, l) : undefined);
  if (need(level) === undefined) {
    return { ok: false, level, xp, need: 0, decimalLevel: level, xpGained: gained, xpSaved: saved };
  }
  let stoppedAt: number | undefined;
  while (remaining > 0) {
    const req = need(level);
    if (req === undefined) {
      stoppedAt = level;
      break;
    }
    if (remaining < req - xp) {
      xp += remaining;
      remaining = 0;
    } else {
      remaining -= req - xp;
      level++;
      xp = 0;
    }
  }
  const req = need(level) ?? 0;
  return {
    ok: true,
    level,
    xp,
    need: req,
    decimalLevel: level + (req > 0 ? Math.min(1, xp / req) : 0),
    xpGained: gained,
    xpSaved: saved,
    stoppedAt,
  };
}

/** Overworld gathering over the season: Stamina gathers plus shared Grand Mines. */
function overworldGains(o: OverworldInput, perStamina: Record<Gathered, number>, perGather: Record<Gathered, number>, stamina: number, weeks: number, resets: number) {
  // Shared Grand Mines are capped across all types, and each pays 2x a gather for no Stamina.
  const shared = { rola: Math.max(0, o.bigNodesPerWeek.rola), ore: Math.max(0, o.bigNodesPerWeek.ore), sand: Math.max(0, o.bigNodesPerWeek.sand) };
  const total = shared.rola + shared.ore + shared.sand;
  const capScale = total > GRAND_MINE.sharedPerWeek ? GRAND_MINE.sharedPerWeek / total : 1;
  const gain = (k: Gathered) => {
    const spent = (stamina * Math.max(0, o.split[k] || 0)) / 100;
    const mines = k === "essence" ? 0 : shared[k] * capScale * weeks * perGather[k] * GRAND_MINE.multiplier;
    return spent * perStamina[k] + mines;
  };
  return {
    rola: gain("rola"),
    ore: gain("ore") + Math.max(0, o.dungeonOrePerDay) * resets,
    sand: gain("sand"),
    essence: gain("essence"),
  };
}

/**
 * First moment passive income reaches `need`, or null if not by season end.
 * Overworld gains are spread evenly over the season as `extraPerHour`.
 */
function readyTime(need: number, inc: MaterialIncome, extraPerHour: number, input: PlannerInput, time: TimeSummary): Date | null {
  if (need <= inc.have) return input.start;
  const perHour = inc.cartPerHour + inc.perDay / 24 + extraPerHour;
  let have = inc.have;
  let t = input.start.getTime();
  for (const reset of [...time.resets, input.end]) {
    const hours = (reset.getTime() - t) / 3_600_000;
    if (perHour > 0 && have + perHour * hours >= need) return new Date(t + ((need - have) / perHour) * 3_600_000);
    have += perHour * hours;
    t = reset.getTime();
    if (reset !== input.end) have += inc.cartPerHour * input.boostHoursPerReset;
    if (have >= need) return reset;
  }
  return null;
}

export function planSeason(input: PlannerInput): PlannerResult | null {
  const rule = getRule(input.season);
  if (!rule) return null;
  const time = summarizeTime(input);
  const character = projectCharacter(input, time);
  const caps = progressionCaps(rule, character.ok ? character.level : input.level);
  // Plans past a cap can't happen, so they're counted at the cap (never below what's already reached).
  const capped = (slots: Slot[], cap: number | null) =>
    cap === null ? slots : slots.map((sl) => ({ ...sl, planned: Math.min(sl.planned, Math.max(cap, sl.current)) }));
  input = {
    ...input,
    gear: capped(input.gear, caps.gear),
    skills: capped(input.skills, caps.skill),
    fantomons: capped(input.fantomons, caps.fantomon),
    relics: capped(input.relics, caps.relic),
  };

  const score = scoreSeason(rule, {
    characterLevel: character.ok ? character.decimalLevel : input.level,
    gear: input.gear,
    skills: input.skills,
    fantomons: input.fantomons,
    relics: input.relics,
    primostarsNow: input.primostarsNow,
    primostarGoal: input.primostarGoal,
  });
  const pointsExcept = (key: SlotCategory) => score.categories.filter((c) => c.key !== key).reduce((a, c) => a + c.points, 0);
  const fill = (key: SlotCategory, slots: Slot[], floor: number, cap: number | null) =>
    minimumPlan(slots, floor, rule.weights[key], pointsExcept(key), score.scoreNeeded, cap);
  const minimum: Record<SlotCategory, MinimumPlan> = {
    gear: fill("gear", input.gear, rule.floor, caps.gear),
    skill: fill("skill", input.skills, rule.floor, caps.skill),
    fantomon: fill("fantomon", input.fantomons, rule.floor, caps.fantomon),
    relic: fill("relic", input.relics, rule.relicFloor, caps.relic),
  };

  const costs = upgradeCosts(rule, input);
  const tier = Math.min(3, Math.max(1, Math.floor(input.realmTier) || 3));
  const multiplier = rule.realmMultipliers?.[tier - 1];
  const realmYields = multiplier ? realmYieldsPerEntry(multiplier) : null;

  const resets = time.resets.length;
  // The rank scale: the season's rank tier, which also sets Realm, gathering and shop amounts.
  const scale = multiplier ?? 1;
  const daily = input.dailyTasks;

  // Stamina: 5 an hour, plus the daily tasks' 40.
  const stamina = time.realHours * STAMINA_REGEN_PER_HOUR + (daily ? resets * DAILY_TASKS.stamina : 0);
  const perGather: Record<Gathered, number> = {
    rola: GATHER_BASE.rola * scale,
    ore: GATHER_BASE.ore * scale,
    sand: GATHER_BASE.sand * scale,
    essence: GATHER_BASE.essence * scale,
  };
  // Per Stamina, counting the Grand Mines that gathers turn up (not on combat targets).
  const gatherPerStamina = Object.fromEntries(
    (Object.keys(perGather) as Gathered[]).map((k) => [
      k,
      (perGather[k] * (1 + (k === "essence" ? 0 : GRAND_MINE_RATE * GRAND_MINE.multiplier))) / STAMINA_PER_GATHER,
    ]),
  ) as Record<Gathered, number>;
  const y = input.overworld.yieldPerStamina;
  const perStamina: Record<Gathered, number> = {
    rola: y.rola > 0 ? y.rola : gatherPerStamina.rola,
    ore: y.ore > 0 ? y.ore : gatherPerStamina.ore,
    sand: y.sand > 0 ? y.sand : gatherPerStamina.sand,
    essence: gatherPerStamina.essence,
  };
  const overworld = overworldGains(input.overworld, perStamina, perGather, stamina, time.realDays / 7, resets);

  // Daily Rola: the daily tasks pay 2,000 x scale; Dawnium buys 1,500 x scale a purchase.
  const rolaBoughtPerDay = Math.max(0, input.rolaBuys) * ROLA_BUY.base * scale;
  const extraRola = resets * ((daily ? DAILY_TASKS.rolaBase * scale : 0) + rolaBoughtPerDay);

  // Home Shop: a free shelf each day plus one per refresh, each listing about 1.5 stacks per material.
  const shopRefreshes = Math.min(10, Math.max(0, Math.floor(input.shopRefreshes)));
  const shopRefreshRolaPerDay = shopRefreshCost(shopRefreshes);
  const stack = SHOP_STACKS[input.season];
  const listings = SHOP_LISTINGS_PER_SHELF * (1 + shopRefreshes) * Math.max(0, time.realDays);
  const treatsPerListing = stack && input.expPerTreat > 0 ? stack.treatExp / input.expPerTreat : 0;
  const shopSupply: Record<Material, number> = {
    ore: stack ? listings * stack.ore : 0,
    sand: stack ? listings * stack.sand : 0,
    essence: stack ? listings * stack.essence : 0,
    treats: listings * treatsPerListing,
    rola: 0,
  };
  const shopUnitRola: Record<Material, number> = {
    ore: SHOP_UNIT_PRICE.ore * SHOP_PRICE_MULTIPLIER,
    sand: SHOP_UNIT_PRICE.sand * SHOP_PRICE_MULTIPLIER,
    essence: SHOP_UNIT_PRICE.essence * SHOP_PRICE_MULTIPLIER,
    treats: SHOP_UNIT_PRICE.treatExp * input.expPerTreat * SHOP_PRICE_MULTIPLIER,
    rola: 0,
  };

  const needs: Record<Material, number> = {
    ore: costs.ore,
    rola: costs.rola,
    essence: costs.essence,
    sand: costs.sand,
    treats: input.expPerTreat > 0 ? Math.ceil(costs.fantomonExp / input.expPerTreat) : 0,
  };
  const unknown: Record<Material, boolean> = {
    ore: costs.unknownFrom.gear !== undefined,
    rola: costs.unknownFrom.gear !== undefined || costs.unknownFrom.relic !== undefined,
    essence: costs.unknownFrom.skill !== undefined,
    sand: costs.unknownFrom.relic !== undefined,
    treats: costs.unknownFrom.fantomon !== undefined,
  };

  const realmTools = Object.fromEntries(
    REALM_MATERIALS.map((k) => [
      k,
      Math.max(0, input.savedEntries[k]) + resets * (Math.max(0, input.refreshes[k]) * ENTRIES_PER_REFRESH + (daily ? DAILY_TASKS.realmTools[k] : 0)),
    ]),
  ) as Record<RealmMaterial, number>;

  let realmEntriesNeeded: number | null = 0;
  /** One material's balance: income, then the Realm entries you'll have, then the Home Shop. */
  const line = (key: Material, need: number, shopShare = 1): MaterialLine => {
    const inc = input.income[key];
    const fromCart = Math.max(0, inc.cartPerHour) * time.productionHours;
    const fromOverworld = key === "treats" ? 0 : overworld[key];
    const passive = Math.max(0, inc.have) + fromCart + Math.max(0, inc.perDay) * time.realDays + fromOverworld + (key === "rola" ? extraRola : 0);
    const shortfall = Math.max(0, need - passive);

    const isRealm = key !== "treats";
    const realmYield = isRealm && realmYields ? realmYields[key] : null;
    const entriesNeeded = !isRealm ? null : shortfall === 0 ? 0 : realmYield ? Math.ceil(shortfall / realmYield) : null;
    const entriesAvailable = isRealm ? realmTools[key as RealmMaterial] : null;
    if (isRealm) {
      realmEntriesNeeded = realmEntriesNeeded === null || entriesNeeded === null ? null : realmEntriesNeeded + entriesNeeded;
    }
    const fromRealm = realmYield && entriesAvailable ? Math.min(shortfall, entriesAvailable * realmYield) : 0;
    const fromShop = Math.min(shortfall - fromRealm, shopSupply[key]) * shopShare;
    return {
      key,
      label: LABELS[key],
      need,
      passive,
      fromCart,
      fromOverworld,
      shortfall,
      realmYield,
      realmEntriesNeeded: entriesNeeded,
      entriesAvailable,
      entriesLeft: entriesAvailable !== null && entriesNeeded !== null ? entriesAvailable - entriesNeeded : null,
      readyAt: unknown[key] ? null : readyTime(need, inc, time.realHours > 0 ? (fromOverworld + (key === "rola" ? extraRola : 0)) / time.realHours : 0, input, time),
      unknownCost: unknown[key],
      fromRealm,
      fromShop,
      shopRola: fromShop * shopUnitRola[key],
      shopSupply: shopSupply[key],
      balance: passive + fromRealm + fromShop - need,
    };
  };

  // The Home Shop only spends spare Rola: what's left after upgrades and refreshes, counting the
  // Rola Realm runs you'll have. If that can't buy everything still short, every purchase shrinks
  // by the same share.
  const refreshRola = shopRefreshRolaPerDay * resets;
  const rolaBase = line("rola", needs.rola + refreshRola);
  const rolaAvailable = rolaBase.passive + (rolaBase.realmYield && rolaBase.entriesAvailable ? rolaBase.entriesAvailable * rolaBase.realmYield : 0);
  const spareRola = Math.max(0, rolaAvailable - (needs.rola + refreshRola));
  const shopKeys: Material[] = ["ore", "essence", "sand", "treats"];
  const wanted = shopKeys.map((k) => line(k, needs[k])).reduce((a, m) => a + m.shopRola, 0);
  const shopShare = wanted > 0 ? Math.min(1, spareRola / wanted) : 1;
  const others = shopKeys.map((k) => line(k, needs[k], shopShare));
  const rola = line("rola", needs.rola + refreshRola + others.reduce((a, m) => a + m.shopRola, 0));
  const order: Material[] = ["ore", "rola", "essence", "sand", "treats"];
  const materials = order.map((k) => (k === "rola" ? rola : others.find((m) => m.key === k)!));

  // "Plan my goal": what each material comes to by season end (on hand, income, Realm runs; not the
  // Home Shop, whose stock depends on what's planned), spent on the cheapest route to the goal.
  const atCurrent = (slots: Slot[]) => slots.map((sl) => ({ ...sl, planned: sl.current }));
  const baseScore = scoreSeason(rule, {
    characterLevel: character.ok ? character.decimalLevel : input.level,
    gear: atCurrent(input.gear),
    skills: atCurrent(input.skills),
    fantomons: atCurrent(input.fantomons),
    relics: atCurrent(input.relics),
    primostarsNow: input.primostarsNow,
    primostarGoal: input.primostarGoal,
  });
  // Points as things stand today: current levels and the character's level right now.
  const table = getSeason(input.season);
  const needNow = table ? expToNext(table, input.level) : undefined;
  const levelNow = input.level + (needNow ? Math.min(1, Math.max(0, input.xpIntoLevel) / needNow) : 0);
  const scoreNow = scoreSeason(rule, {
    characterLevel: levelNow,
    gear: atCurrent(input.gear),
    skills: atCurrent(input.skills),
    fantomons: atCurrent(input.fantomons),
    relics: atCurrent(input.relics),
    primostarsNow: input.primostarsNow,
    primostarGoal: input.primostarGoal,
  }).total;
  const supply = (k: Material) => {
    const m = materials.find((x) => x.key === k)!;
    return m.passive + (m.realmYield && m.entriesAvailable ? m.entriesAvailable * m.realmYield : 0);
  };
  const goalRoute =
    score.scoreNeeded > 0
      ? planForGoal(rule, {
          gear: input.gear,
          skills: input.skills,
          fantomons: input.fantomons,
          relics: input.relics,
          caps: { gear: caps.gear, skill: caps.skill, fantomon: caps.fantomon, relic: caps.relic },
          pointsNeeded: score.scoreNeeded - baseScore.total,
          budget: {
            ore: supply("ore"),
            rola: Math.max(0, supply("rola") - refreshRola),
            essence: supply("essence"),
            sand: supply("sand"),
            fantomonExp: supply("treats") * Math.max(0, input.expPerTreat),
          },
        })
      : null;
  // The most Primostars the materials reach: what's had now, the fixed ones, and the plan's score.
  const goalPlan = goalRoute && {
    ...goalRoute,
    reachableTotal: input.primostarsNow + rule.fixedStars + Math.floor((baseScore.total + goalRoute.pointsAdded) / rule.pointsPerStar + 1e-9),
  };

  // Suggested Realm refreshes: per Realm, the fewest daily refreshes whose runs (with saved tools and
  // the daily tasks' free ones) cover a shortfall. Two targets: the levels planned now, and the goal.
  const refreshesFor = (short: Record<RealmMaterial, number>) => {
    if (!realmYields || resets <= 0) return null;
    const perDay: Record<RealmMaterial, number> = { ore: 0, rola: 0, essence: 0, sand: 0 };
    const capped: RealmMaterial[] = [];
    for (const k of REALM_MATERIALS) {
      const runsNeeded = short[k] > 0 ? Math.ceil(short[k] / realmYields[k]) : 0;
      const free = Math.max(0, input.savedEntries[k]) + (daily ? resets * DAILY_TASKS.realmTools[k] : 0);
      const n = Math.ceil(Math.max(0, runsNeeded - free) / (resets * ENTRIES_PER_REFRESH));
      if (n > 10) capped.push(k);
      perDay[k] = Math.min(10, n);
    }
    const dawnium = REALM_MATERIALS.reduce((a, k) => a + DAWNIUM_REFRESH_COSTS.slice(0, perDay[k]).reduce((x, y) => x + y, 0), 0);
    return { perDay, dawniumPerDay: dawnium, dawniumTotal: dawnium * resets, capped };
  };
  const passiveOf = (k: Material) => materials.find((x) => x.key === k)!.passive;
  const realmSuggestion = refreshesFor(
    Object.fromEntries(REALM_MATERIALS.map((k) => [k, materials.find((x) => x.key === k)!.shortfall])) as Record<RealmMaterial, number>,
  );
  // For the goal: plan it as if every Realm had 10 refreshes a day, then ask what that plan really needs.
  const goalRealms = (() => {
    if (!goalRoute || !realmYields || resets <= 0) return null;
    const maxRuns = (k: RealmMaterial) =>
      (Math.max(0, input.savedEntries[k]) + resets * (10 * ENTRIES_PER_REFRESH + (daily ? DAILY_TASKS.realmTools[k] : 0))) * realmYields[k];
    const route = planForGoal(rule, {
      gear: input.gear,
      skills: input.skills,
      fantomons: input.fantomons,
      relics: input.relics,
      caps: { gear: caps.gear, skill: caps.skill, fantomon: caps.fantomon, relic: caps.relic },
      pointsNeeded: score.scoreNeeded - baseScore.total,
      budget: {
        ore: passiveOf("ore") + maxRuns("ore"),
        rola: Math.max(0, passiveOf("rola") + maxRuns("rola") - refreshRola),
        essence: passiveOf("essence") + maxRuns("essence"),
        sand: passiveOf("sand") + maxRuns("sand"),
        fantomonExp: passiveOf("treats") * Math.max(0, input.expPerTreat),
      },
    });
    const split = refreshesFor({
      ore: route.spent.ore - passiveOf("ore"),
      rola: route.spent.rola + refreshRola - passiveOf("rola"),
      essence: route.spent.essence - passiveOf("essence"),
      sand: route.spent.sand - passiveOf("sand"),
    });
    return split && { ...split, reachable: route.pointsShort === 0 };
  })();

  const dawniumPerDay =
    REALM_MATERIALS.reduce((a, k) => a + DAWNIUM_REFRESH_COSTS.slice(0, Math.min(10, Math.max(0, input.refreshes[k]))).reduce((x, y) => x + y, 0), 0) +
    rolaBuyCost(Math.max(0, Math.floor(input.rolaBuys)));

  return {
    rule,
    time,
    character,
    caps,
    score,
    costs,
    materials,
    realmYields,
    realmEntriesNeeded,
    dawniumPerDay,
    stamina,
    minimum,
    scale,
    gatherPerStamina,
    gathered: overworld,
    shopRefreshRolaPerDay,
    rolaBoughtPerDay,
    realmTools,
    goalPlan,
    scoreNow,
    levelNow,
    realmSuggestion,
    goalRealms,
    refinedOre: {
      need: costs.forgeStones,
      have: Math.max(0, input.refinedOre ?? 0),
      gathered: resets * REFINED_ORE_GATHER.perDay * REFINED_ORE_GATHER.each,
      left: Math.max(0, input.refinedOre ?? 0) + resets * REFINED_ORE_GATHER.perDay * REFINED_ORE_GATHER.each - costs.forgeStones,
    },
  };
}
