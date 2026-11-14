import { useEffect, useState, type ReactNode } from "react";
import { CharacterForm, type Character } from "../../components/CharacterForm";
import { Field } from "../../components/Field";
import { DAWNIUM_REFRESH_COSTS, getRule } from "../../data/seasons";
import { DAILY_TASKS, REALM_TOOL_NAMES, SHOP_REFRESH_COSTS, rolaBuyCost, shopRefreshCost } from "../../data/gameConfig";
import type { Material, PlannerResult } from "../../lib/planner/plan";
import type { SlotCategory } from "../../lib/planner/score";
import { REALM_MATERIALS, type RealmMaterial } from "../../lib/planner/plan";
import { RealmSuggest } from "./RealmSuggest";
import { formatDuration, formatEta, formatXpShort, getSeason } from "../../lib/xp";
import {
  DEFAULT_EXP_PER_TREAT,
  GEAR_NAMES,
  effectiveSeasonEnd,
  type PlannerForm,
  type SlotForm,
  type TimeDefaults,
} from "./form";
import { SlotTable } from "./SlotTable";
import { Summary } from "./Summary";
import { findProblems } from "./validate";
import { GoatCard } from "../../components/SillyGoat";
import { ScreenshotImport } from "./ScreenshotImport";
import { GoalPlanBox } from "./GoalPlanBox";
import { shareText } from "./shareText";
import { ProgressLog, addSnapshot, type Snapshot } from "./ProgressLog";
import { usePersistentState } from "../../lib/storage";
import { pactGoalHint } from "./AstralPact";
import { applyFound } from "./fromScreens";

interface Props {
  character: Character;
  onCharacterChange: (c: Character) => void;
  form: PlannerForm;
  onChange: (f: PlannerForm) => void;
  /** Empties the planner (asks first). */
  onClear: () => void;
  result: PlannerResult | null;
  now: Date;
  defaults: TimeDefaults;
  /** The player's server from the calendar, if set. */
  server: { name: string; season: number; seasonEnds: Date | null } | null;
}

const MATERIAL_LABELS: Record<Material, string> = {
  rola: "Rola",
  ore: "Ore",
  essence: "Essence",
  sand: "Sand (White eq.)",
  treats: "Treats",
};
/** In the order the Cart screen lists them. */
const CART_ORDER: Material[] = ["rola", "ore", "essence", "sand", "treats"];
const fmt = (x: number) => Math.round(x).toLocaleString();

type SlotField = "gear" | "skills" | "fantomons" | "relics";
const SYSTEMS: { field: SlotField; key: SlotCategory; label: string; icon: string; material: string; noun: string; one: string; plus?: boolean }[] = [
  { field: "gear", key: "gear", label: "Gear", icon: "⚔️", material: "Ore & Rola", noun: "gear", one: "gear piece" },
  { field: "skills", key: "skill", label: "Skills & Charms", icon: "✨", material: "Essence", noun: "skills", one: "skill" },
  { field: "fantomons", key: "fantomon", label: "Fantomons", icon: "🐾", material: "Treats", noun: "Fantomons", one: "Fantomon" },
  { field: "relics", key: "relic", label: "Relics", icon: "💎", material: "Sand", noun: "relics", one: "relic", plus: true },
];

/** One labelled card in the planner grid. */
function Card({ icon, title, aside, wide, children }: { icon: string; title: string; aside?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <section className={`card pcard${wide ? " wide" : ""}`}>
      <div className="pcard-head">
        <h2>
          <span aria-hidden>{icon}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The shared value of every slot, or "" when they differ. */
const mixed = (rows: SlotForm[], key: keyof SlotForm) => rows.some((r) => r[key] !== rows[0][key]);
/** True when any slot is planned past the cap. */
const overCap = (rows: SlotForm[], cap: number | null) =>
  cap !== null && rows.some((r) => r.planned !== "" && Number(r.planned.replace(/^\+/, "")) > cap);
/** What Simple mode shows: the shared level, or the range when slots differ (e.g. "135–140"). */
const shown = (rows: SlotForm[], key: keyof SlotForm) => {
  if (!mixed(rows, key)) return rows[0]?.[key] ?? "";
  const nums = rows.map((r) => Number(r[key].replace(/^\+/, ""))).filter((v, i) => rows[i][key] !== "" && Number.isFinite(v));
  if (!nums.length) return "";
  const lo = Math.min(...nums), hi = Math.max(...nums);
  const plus = rows.some((r) => r[key].startsWith("+")) ? "+" : "";
  return nums.length < rows.length || lo !== hi ? `${plus}${lo}–${hi}` : `${plus}${lo}`;
};

export function PlannerPage({ character, onCharacterChange, form, onChange, onClear, result, now, defaults, server }: Props) {
  const season = Number(character.season);
  const rule = getRule(season);
  const table = getSeason(season);
  const set = <K extends keyof PlannerForm>(key: K, value: PlannerForm[K]) => onChange({ ...form, [key]: value });
  // Season progress: logged after each fill from screenshots (once the new numbers are worked out), or by hand.
  const [progress, setProgress] = usePersistentState<{ entries: Snapshot[] }>("sxs.progress", { entries: [] });
  const [logPending, setLogPending] = useState(false);
  const logNow = () => {
    if (!result) return;
    setProgress({
      entries: addSnapshot(progress.entries, { at: new Date().toISOString(), season: result.rule.season, points: result.scoreNow, level: result.levelNow }),
    });
  };
  useEffect(() => {
    if (logPending && result) {
      setLogPending(false);
      logNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logPending, result]);
  const full = form.mode === "full";
  const floor = rule?.floor ?? 0;
  const caps = result?.caps;
  const t = result?.time;
  const problems = findProblems(character, form, rule, table);
  const silly = problems.messages.length > 0;
  const range = (count: number, label: (i: number) => string) => Array.from({ length: count }, (_, i) => label(i));
  const capOf = (key: SlotCategory) => (caps ? (key === "gear" ? caps.gear : key === "skill" ? caps.skill : key === "fantomon" ? caps.fantomon : caps.relic) : null);
  const baselineOf = (field: SlotField) => String(field === "relics" ? rule?.relicFloor ?? 0 : floor);

  /** "Fill minimum" for one system: sets its planned levels to the lowest that reach the goal. */
  const fill = (s: (typeof SYSTEMS)[number]) => {
    if (!result) return;
    const plan = result.minimum[s.key];
    onChange({ ...form, [s.field]: form[s.field].map((g, i) => ({ ...g, planned: String(plan.planned[i]) })) });
  };
  const canFill = !!result && result.score.scoreNeeded > 0;

  const days = t ? Math.max(0, t.realHours / 24) : 0;
  const realmCost = (n: number) => DAWNIUM_REFRESH_COSTS.slice(0, Math.min(10, Math.max(0, n))).reduce((a, b) => a + b, 0);

  return (
    <div className="planner">
      <div className="planner-form">
        <div className="planner-top">
          <a className="guide-banner" href="#/guide">
            <span aria-hidden>📖</span>
            <span>
              <b>New to the planner?</b> Read the step-by-step guide to what everything does →
            </span>
          </a>
          <button type="button" className="link-button planner-clear" onClick={onClear}>
            Clear planner
          </button>
        </div>
        <div className="mode-switch" role="group" aria-label="Planner detail">
          {(["simple", "full"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={form.mode === m} onClick={() => set("mode", m)}>
              <b>{m === "simple" ? "Simple" : "Full"}</b>
              <small>{m === "simple" ? "One level per system" : "Every slot and stockpile"}</small>
            </button>
          ))}
          <p className="hint">
            {full
              ? "Every slot, what you have stockpiled, stamina, shops and Realm details."
              : "Quick and rougher: one level per system and your Cart income. Switch to Full for a closer answer."}
          </p>
        </div>

        <ScreenshotImport
          season={season}
          onApply={(found) => {
            const next = applyFound(found, character, form);
            onCharacterChange(next.character);
            onChange(next.form);
            setLogPending(true);
          }}
        />

        <div className="planner-cards">
          <Card icon="🎯" title="Season & goal">
            <div className="fields">
              <Field label="Primostars you have" value={form.primostarsNow} onChange={(v) => set("primostarsNow", v)} placeholder="0" />
              <Field
                label="Total you want"
                value={form.primostarGoal}
                onChange={(v) => set("primostarGoal", v)}
                placeholder="0"
                hint={pactGoalHint(Number(form.primostarGoal)) ?? "Pick a total that unlocks an Astral Pact bonus (see the projection)."}
              />
              <Field
                className="span-2"
                type="datetime-local"
                label="Season ends"
                value={effectiveSeasonEnd(form, defaults, now)}
                onChange={(v) => set("seasonEnd", v)}
                hint={
                  form.seasonEnd ? (
                    defaults.seasonEnd ? (
                      <button type="button" className="link-button" onClick={() => set("seasonEnd", "")}>
                        Use {server?.name || "my server"}'s season end
                      </button>
                    ) : undefined
                  ) : defaults.seasonEnd ? (
                    <>From {server?.name || "your server"}'s calendar.</>
                  ) : (
                    <>
                      Guessing 14 days. <a href="#/calendar">Pick your server</a> for the real date.
                    </>
                  )
                }
              />
            </div>
            {t && <p className="pcard-foot">{formatDuration(t.realHours)} left · {t.resets.length} resets</p>}
            {rule && result && result.score.scoreNeeded > 0 && (
              <p className="hint">
                This season needs <b>{fmt(result.score.scoreNeeded)}</b> points (1 Primostar per {rule.pointsPerStar}, plus {rule.fixedStars} fixed).
              </p>
            )}
            <div className="fields save-next">
              <label className="check span-2">
                <input type="checkbox" checked={form.saveBed} onChange={(e) => set("saveBed", e.target.checked)} />
                <span>
                  Save bed EXP for next season <em className="chip">Recommended</em>
                  <small>Stop claiming the bed for the last hours so its EXP carries into next season. Reset boosts inside that window still count.</small>
                </span>
              </label>
              {form.saveBed && (
                <Field label="Bed hours to save" value={form.saveBedHours} onChange={(v) => set("saveBedHours", v)} placeholder="36" hint="Max 36." />
              )}
              <label className="check span-2">
                <input type="checkbox" checked={form.saveCart !== false} onChange={(e) => set("saveCart", e.target.checked)} />
                <span>
                  Save Cart resources for next season <em className="chip">Recommended</em>
                  <small>Stop claiming the Cart for the last hours so its resources carry into next season. They're left out of this season's materials.</small>
                </span>
              </label>
              {form.saveCart !== false && (
                <Field label="Cart hours to save" value={form.saveCartHours ?? "36"} onChange={(v) => set("saveCartHours", v)} placeholder="36" hint="Max 36." />
              )}
              {(t?.saveStart || t?.cartSaveStart) && (
                <p className="hint span-2">
                  {t?.saveStart && <>Stop claiming the bed {formatEta(0, t.saveStart)}. </>}
                  {t?.cartSaveStart && <>Stop claiming the Cart {formatEta(0, t.cartSaveStart)}.</>}
                </p>
              )}
            </div>
            {full && (
              <div className="fields full-only">
                <Field
                  type="time"
                  label="Daily reset"
                  value={form.resetTime || defaults.resetTime}
                  onChange={(v) => set("resetTime", v)}
                  hint={form.resetTime ? undefined : "13:00 UTC in your time."}
                />
                <Field label="Boost hours per reset" value={form.boostHours} onChange={(v) => set("boostHours", v)} placeholder="2" />
              </div>
            )}
          </Card>

          <Card icon="🛏️" title="Character EXP">
            {server && server.season !== season && server.season <= 5 && (
              <p className="note warn">
                {server.name || "Your server"} is in Season {server.season}.{" "}
                <button type="button" className="link-button" onClick={() => onCharacterChange({ ...character, season: String(server.season) })}>
                  Switch to Season {server.season}
                </button>
              </p>
            )}
            <CharacterForm
              character={character}
              onChange={onCharacterChange}
              onReset={() => onCharacterChange({ ...character, level: "", currentXp: "", percent: "", rate: "" })}
              table={table}
              compact
            />
            {result?.character.ok && (
              <p className="pcard-foot">
                Projected by season end: <b>Lv {result.character.decimalLevel.toFixed(2)}</b>
                {t && <> · {fmt(t.xpHours)} EXP hours</>}
              </p>
            )}
            {result && !result.character.ok && <p className="error">No EXP data for that level in Season {season}.</p>}
            {result?.character.stoppedAt !== undefined && <p className="error">EXP data runs out at level {result.character.stoppedAt}.</p>}
            {full && (
              <div className="fields full-only">
                <Field label="Goddess statues now" value={form.statues} onChange={(v) => set("statues", v)} placeholder="0" hint="Each adds 1% EXP." />
                <Field label="New statues per day" value={form.statuesPerDay} onChange={(v) => set("statuesPerDay", v)} placeholder="0" />
              </div>
            )}
          </Card>

          <Card icon="📈" title="System levels" wide>
            <p className="hint">
              {full ? "Each slot's current level and where you plan to take it." : "One level for the whole system: now, and where you plan to take it."} Scoring starts above Lv {floor}
              {rule && <> (relics above +{rule.relicFloor})</>}.
            </p>
            <GoalPlanBox
              result={result}
              onSetGoal={(stars) => set("primostarGoal", String(stars))}
              planned={{
                gear: form.gear.map((r) => Number(r.planned) || 0),
                skill: form.skills.map((r) => Number(r.planned) || 0),
                fantomon: form.fantomons.map((r) => Number(r.planned) || 0),
                relic: form.relics.map((r) => Number(r.planned.replace(/^\+/, "")) || 0),
              }}
              current={{
                gear: form.gear.map((r) => Math.max(floor, Number(r.current) || 0)),
                skill: form.skills.map((r) => Math.max(floor, Number(r.current) || 0)),
                fantomon: form.fantomons.map((r) => Math.max(floor, Number(r.current) || 0)),
                relic: form.relics.map((r) => Math.max(rule?.relicFloor ?? 0, Number(r.current.replace(/^\+/, "")) || 0)),
              }}
              onApply={(planned) => {
                const put = (rows: SlotForm[], levels: number[]) => rows.map((r, i) => ({ ...r, planned: String(levels[i]) }));
                onChange({
                  ...form,
                  gear: put(form.gear, planned.gear),
                  skills: put(form.skills, planned.skill),
                  fantomons: put(form.fantomons, planned.fantomon),
                  relics: put(form.relics, planned.relic),
                });
              }}
            />
            {full ? (
              SYSTEMS.map((s) => {
                const names = s.field === "gear" ? GEAR_NAMES : range(form[s.field].length, (i) => (s.field === "skills" ? `Skill ${i + 1}` : `#${i + 1}`));
                const cap = capOf(s.key);
                return (
                  <div key={s.field} className="system-block">
                    <div className="system-head">
                      <h3>
                        <span aria-hidden>{s.icon}</span> {s.label} <small>· {s.material}</small>
                      </h3>
                      {rule && <span className="chip">+{rule.weights[s.key]} pts / lv</span>}
                    </div>
                    <SlotTable
                      names={names}
                      rows={form[s.field]}
                      onChange={(rows) => set(s.field, rows)}
                      invalid={problems.slots[s.field]}
                      baseline={baselineOf(s.field)}
                      cap={cap ?? null}
                      prefix={s.plus ? "+" : ""}
                      noun={s.one}
                      quick={s.field === "skills" && character.level.trim() ? { label: `Now = my level (${character.level.trim()}) for every skill`, value: character.level.trim() } : undefined}
                    />
                    <div className="system-foot">
                      {cap != null && <span className="hint">Cap by season end: {s.plus ? "+" : ""}{cap}</span>}
                      {canFill && (
                        <button type="button" className="link-button" onClick={() => fill(s)}>
                          Fill minimum {s.noun} for my goal
                        </button>
                      )}
                    </div>
                    {result?.minimum[s.key].limited && <p className="hint warn">{s.label} alone can't make up the rest of the goal under the cap.</p>}
                  </div>
                );
              })
            ) : (
              <div className="simple-levels">
                <div className="simple-head" aria-hidden>
                  <span />
                  <span>Now</span>
                  <span />
                  <span>Plan</span>
                  <span />
                </div>
                {SYSTEMS.map((s) => {
                  const rows = form[s.field];
                  const setAll = (key: keyof SlotForm, value: string) => set(s.field, rows.map((r) => ({ ...r, [key]: value })));
                  const bad = problems.slots[s.field].size > 0;
                  const prefix = s.plus ? "+" : "";
                  return (
                    <div key={s.field} className="simple-row">
                      <span className="simple-name">
                        <b>
                          <span aria-hidden>{s.icon}</span> {s.label}
                        </b>
                        {rule && <small>+{rule.weights[s.key]} pts / lv</small>}
                        {capOf(s.key) != null && <small>Cap {prefix}{capOf(s.key)}</small>}
                      </span>
                      <input
                        aria-label={`${s.label} current level`}
                        className={bad ? "silly" : undefined}
                        value={shown(rows, "current")}
                        onFocus={(e) => mixed(rows, "current") && e.target.select()}
                        title={mixed(rows, "current") ? "Slots differ (see Full). Typing here sets them all." : undefined}
                        onChange={(e) => setAll("current", e.target.value)}
                        placeholder={mixed(rows, "current") ? "mixed" : `${prefix}${baselineOf(s.field)}`}
                      />
                      <span aria-hidden>→</span>
                      <input
                        aria-label={`${s.label} planned level`}
                        className={bad ? "silly" : overCap(rows, capOf(s.key)) ? "over-cap" : undefined}
                        value={shown(rows, "planned")}
                        onFocus={(e) => mixed(rows, "planned") && e.target.select()}
                        title={mixed(rows, "planned") ? "Slots differ (see Full). Typing here sets them all." : undefined}
                        onChange={(e) => setAll("planned", e.target.value)}
                        placeholder={mixed(rows, "planned") ? "mixed" : "same"}
                      />
                      {canFill ? (
                        <button type="button" className="fill-btn" onClick={() => fill(s)} title={`Fill the lowest ${s.noun} levels that reach your goal`}>
                          Fill min
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
                <p className="hint">"Fill min" puts the rest of your goal on that system. Levels past a cap are counted at the cap. A range like 135–140 means the slots differ: see each one in Full, or type one level to set them all.</p>
              </div>
            )}
          </Card>

          <Card icon="🛒" title="Cart income">
            <p className="hint">What your Cart makes an hour, in the order the Cart screen lists it, and how much you already have.</p>
            {full ? (
              <div className="table-wrap flat">
                <table className="input-table">
                  <thead>
                    <tr>
                      <th scope="col"></th>
                      <th scope="col">Cart / hr</th>
                      <th scope="col">Have now</th>
                      <th scope="col">Shop + other / day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CART_ORDER.map((k) => (
                      <tr key={k}>
                        <th scope="row">{MATERIAL_LABELS[k]}</th>
                        {(["cartPerHour", "have", "perDay"] as const).map((col) => (
                          <td key={col}>
                            <input
                              aria-label={`${MATERIAL_LABELS[k]} ${col}`}
                              value={form.income[k][col]}
                              onChange={(e) => set("income", { ...form.income, [k]: { ...form.income[k], [col]: e.target.value } })}
                              placeholder="0"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="cart-list">
                <div className="cart-row cart-head" aria-hidden>
                  <span />
                  <span>Cart / hr</span>
                  <span>Have now</span>
                </div>
                {CART_ORDER.map((k) => {
                  const name = MATERIAL_LABELS[k].replace(" (White eq.)", "");
                  return (
                    <div key={k} className="cart-row">
                      <span>{name}</span>
                      <input
                        aria-label={`${name} Cart per hour`}
                        value={form.income[k].cartPerHour}
                        onChange={(e) => set("income", { ...form.income, [k]: { ...form.income[k], cartPerHour: e.target.value } })}
                        placeholder="0"
                      />
                      <input
                        aria-label={`${name} on hand`}
                        value={form.income[k].have}
                        onChange={(e) => set("income", { ...form.income, [k]: { ...form.income[k], have: e.target.value } })}
                        placeholder="0"
                      />
                    </div>
                  );
                })}
              </div>
            )}
            <p className="hint">Sand counts as White Sand (1 Blue = 5 White, 1 Purple = 25 White).</p>
            <Field
              label="Refined Ore on hand"
              value={form.refinedOre ?? ""}
              onChange={(v) => set("refinedOre", v)}
              placeholder="0"
              hint="Gear needs it every 5 levels. Rarely short: 4 map gathers a day and Ore Realms keep it topped up."
            />
            {full && (
              <Field label="Fantomon EXP per treat" value={form.expPerTreat} onChange={(v) => set("expPerTreat", v)} placeholder={String(DEFAULT_EXP_PER_TREAT)} />
            )}
          </Card>

          <Card icon="📅" title="Each day">
            <h3 className="subhead">Material Realms</h3>
            <RealmSuggest
              result={result}
              current={Object.fromEntries(REALM_MATERIALS.map((k) => [k, Number(form.refreshes[k]) || 0])) as Record<RealmMaterial, number>}
              onPick={(split) => set("refreshes", Object.fromEntries(REALM_MATERIALS.map((k) => [k, String(split[k])])) as PlannerForm["refreshes"])}
            />
            <div className="realm-picks">
              {REALM_MATERIALS.map((k) => (
                <label key={k} className="field">
                  <span>{MATERIAL_LABELS[k].replace(" (White eq.)", "")}</span>
                  <select value={form.refreshes[k] || "0"} onChange={(e) => set("refreshes", { ...form.refreshes, [k]: e.target.value })}>
                    {Array.from({ length: 11 }, (_, n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "refresh" : "refreshes"}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {result && days > 0 && (
              <div className="tool-summary">
                <p>
                  By season end you'll have{" "}
                  {REALM_MATERIALS.map((k, i) => (
                    <span key={k}>
                      {i > 0 && (i === REALM_MATERIALS.length - 1 ? " and " : ", ")}
                      <b>{fmt(result.realmTools[k])}</b> {REALM_TOOL_NAMES[k]}
                    </span>
                  ))}
                  {form.dailyTasks !== false && <>, daily tasks included</>}.
                </p>
                {result.realmYields && (
                  <p className="hint">
                    Each run: ~{fmt(result.realmYields.ore)} Ore · ~{fmt(result.realmYields.rola)} Rola · ~{fmt(result.realmYields.essence)} Essence · ~
                    {fmt(result.realmYields.sand)} Sand.
                  </p>
                )}
                <p className="hint">
                  Refreshes cost <b>{fmt(result.dawniumPerDay - rolaBuyCost(Number(form.rolaBuys) || 0))}</b> Dawnium a day. First two {realmCost(1)} each.{" "}
                  <a href="#/dawnium">Dawnium Guide →</a>
                </p>
              </div>
            )}

            <h3 className="subhead">Home Shop</h3>
            <label className="field">
              <span>Refreshes a day</span>
              <select value={form.shopRefreshes || "0"} onChange={(e) => set("shopRefreshes", e.target.value)}>
                {Array.from({ length: SHOP_REFRESH_COSTS.length + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "None (free shelf only)" : `${n} · ${formatXpShort(shopRefreshCost(n))} Rola a day`}
                  </option>
                ))}
              </select>
              <small>Each shelf lists about 1.5 stacks each of Ore, Sand, Essence and treats. Spare Rola buys whatever is still short.</small>
            </label>

            <h3 className="subhead">Realm tools saved up</h3>
            <p className="hint">
              Tools already in your Backpack, on top of the ones the daily tasks give. Filled in from a Backpack screenshot when the tools show in it.
            </p>
            <div className="table-wrap flat">
              <table className="input-table">
                <thead>
                  <tr>
                    <th scope="col"></th>
                    <th scope="col">In Backpack</th>
                  </tr>
                </thead>
                <tbody>
                  {REALM_MATERIALS.map((k) => (
                    <tr key={k}>
                      <th scope="row">{REALM_TOOL_NAMES[k]}</th>
                      <td>
                        <input aria-label={`${REALM_TOOL_NAMES[k]} saved`} value={form.savedEntries[k]} onChange={(e) => set("savedEntries", { ...form.savedEntries, [k]: e.target.value })} placeholder="0" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {full && (
              <div className="full-only">
                <label className="check">
                  <input type="checkbox" checked={form.dailyTasks !== false} onChange={(e) => set("dailyTasks", e.target.checked)} />
                  <span>
                    I clear the daily tasks
                    <small>
                      They pay {DAILY_TASKS.stamina} Stamina, {Object.values(DAILY_TASKS.realmTools).reduce((a, b) => a + b, 0)} Realm tools and{" "}
                      {result ? fmt(DAILY_TASKS.rolaBase * result.scale) : `${DAILY_TASKS.rolaBase} × rank`} Rola a day.
                    </small>
                  </span>
                </label>
                <label className="field">
                  <span>Rola bought with Dawnium a day</span>
                  <select value={form.rolaBuys || "0"} onChange={(e) => set("rolaBuys", e.target.value)}>
                    {Array.from({ length: 21 }, (_, n) => (
                      <option key={n} value={n}>
                        {n === 0
                          ? "None"
                          : `${n} · ${result ? formatXpShort(n * 1500 * result.scale) : n * 1500} Rola for ${fmt(rolaBuyCost(n))} Dawnium`}
                      </option>
                    ))}
                  </select>
                  <small>Five at 30 Dawnium, five at 50, then 100 each.</small>
                </label>

                {rule && (
                  <label className="field">
                    <span>Rank (sets Realm, gathering and shop amounts)</span>
                    <select value={form.realmTier} onChange={(e) => set("realmTier", e.target.value as PlannerForm["realmTier"])}>
                      <option value="auto">Auto ({rule.realmRankName} III)</option>
                      {[1, 2, 3].map((tier) => (
                        <option key={tier} value={tier}>
                          {rule.realmRankName} {"I".repeat(tier)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <h3 className="subhead">Stamina & gathering</h3>
                <p className="hint">
                  Out in the world map you spend Stamina to gather from Rola, Ore, Sand and Essence spots. Tell the planner how you usually split
                  your Stamina and it adds what you'd gather to your materials.
                </p>
                <ul className="hint gather-facts">
                  <li>
                    You get 5 Stamina an hour{form.dailyTasks !== false && <> plus {DAILY_TASKS.stamina} from the daily tasks</>}
                    {result && <>: about <b>{fmt(result.stamina)}</b> by season end</>}. Each gather costs 5.
                  </li>
                  <li>
                    <b>Share of Stamina:</b> what percent goes to each kind. For example, 50 Rola and 50 Ore. Leave it blank if you don't gather.
                  </li>
                  <li>
                    <b>Shared Grand Mines:</b> big mines other players find and share with you. Each pays double and costs no Stamina, up to 50 a
                    week in total.
                  </li>
                  <li>
                    <b>Per Stamina:</b> already worked out from your rank, including the Grand Mines your own gathers sometimes find. Only change
                    it if your gathers pay a different amount.
                  </li>
                </ul>
                <div className="table-wrap flat">
                  <table className="input-table">
                    <thead>
                      <tr>
                        <th scope="col"></th>
                        <th scope="col">Share of Stamina %</th>
                        <th scope="col">Shared Grand Mines / week</th>
                        <th scope="col">Per Stamina</th>
                        <th scope="col">By season end</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["rola", "ore", "sand", "essence"] as const).map((k) => (
                        <tr key={k}>
                          <th scope="row">{MATERIAL_LABELS[k].replace(" (White eq.)", "")}</th>
                          <td>
                            <input aria-label={`${k} stamina percent`} value={form.staminaSplit[k] ?? ""} onChange={(e) => set("staminaSplit", { ...form.staminaSplit, [k]: e.target.value })} placeholder="0" />
                          </td>
                          <td>
                            {k === "essence" ? (
                              <span className="hint">—</span>
                            ) : (
                              <input aria-label={`${k} shared mines per week`} value={form.bigNodes[k]} onChange={(e) => set("bigNodes", { ...form.bigNodes, [k]: e.target.value })} placeholder="0" />
                            )}
                          </td>
                          <td>
                            {k === "essence" ? (
                              <span className="hint">{result ? fmt(result.gatherPerStamina.essence) : "—"}</span>
                            ) : (
                              <input
                                aria-label={`${k} per stamina`}
                                value={form.staminaYield[k]}
                                onChange={(e) => set("staminaYield", { ...form.staminaYield, [k]: e.target.value })}
                                placeholder={result ? fmt(result.gatherPerStamina[k]) : "auto"}
                              />
                            )}
                          </td>
                          <td>
                            <span className="hint">{result ? `+${formatXpShort(result.gathered[k])}` : "—"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const total = (["rola", "ore", "sand", "essence"] as const).reduce((t, k) => t + (Number(form.staminaSplit[k]) || 0), 0);
                  return total > 100 ? (
                    <p className="hint warn">Your shares add up to {total}%. They should total 100% or less.</p>
                  ) : total > 0 && total < 100 ? (
                    <p className="hint">{100 - total}% of your Stamina isn't gathering (for example, it goes on fights).</p>
                  ) : null;
                })()}
                <Field
                  label="Ore from dungeons per day"
                  value={form.dungeonOrePerDay}
                  onChange={(v) => set("dungeonOrePerDay", v)}
                  placeholder="0"
                  hint="Ore your daily dungeon runs give, if you want it counted. It's added to the Ore gathered above."
                />
              </div>
            )}
          </Card>
        </div>
        <ProgressLog result={result} log={progress.entries} onLog={logNow} onClear={() => setProgress({ entries: [] })} />
      </div>

      <aside className="planner-summary" id="summary">
        {silly ? <GoatCard messages={problems.messages} outlined={Object.values(problems.slots).some((x) => x.size > 0)} /> : <Summary
            result={result}
            now={now}
            onPickGoal={(stars) => set("primostarGoal", String(stars))}
            share={result ? shareText(result, form, character.level) : undefined}
          />}
      </aside>

      {silly ? (
        <a className="mobile-bar goat-bar" href="#summary" onClick={(e) => {
          e.preventDefault();
          document.getElementById("summary")?.scrollIntoView({ behavior: "smooth" });
        }}>
          <b>🐐 You silly goat!</b>
          <span>Some numbers can't happen. Tap to see why.</span>
        </a>
      ) : result && (
        <a className="mobile-bar" href="#summary" onClick={(e) => {
          e.preventDefault();
          document.getElementById("summary")?.scrollIntoView({ behavior: "smooth" });
        }}>
          <b>+{result.score.earned.toLocaleString()} Primostars</b>
          {result.character.ok && <span>Lv {result.character.decimalLevel.toFixed(2)}</span>}
          <span>
            {result.realmEntriesNeeded === null ? "Realms ?" : `${result.realmEntriesNeeded.toLocaleString()} Realm runs`}
          </span>
        </a>
      )}
    </div>
  );
}
