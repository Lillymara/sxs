import type { ReactNode } from "react";
import { CharacterForm, type Character } from "../../components/CharacterForm";
import { Field } from "../../components/Field";
import { DAWNIUM_REFRESH_COSTS, getRule } from "../../data/seasons";
import type { Material, PlannerResult, RealmMaterial } from "../../lib/planner/plan";
import type { SlotCategory } from "../../lib/planner/score";
import { REALM_MATERIALS } from "../../lib/planner/plan";
import { formatDuration, formatEta, getSeason } from "../../lib/xp";
import {
  DEFAULT_EXP_PER_TREAT,
  GEAR_NAMES,
  STAMINA_YIELD_DEFAULTS,
  effectiveSeasonEnd,
  type PlannerForm,
  type SlotForm,
  type TimeDefaults,
} from "./form";
import { SlotTable } from "./SlotTable";
import { Summary } from "./Summary";
import { findProblems } from "./validate";
import { GoatCard } from "../../components/SillyGoat";

interface Props {
  character: Character;
  onCharacterChange: (c: Character) => void;
  form: PlannerForm;
  onChange: (f: PlannerForm) => void;
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
const REALM_TOOLS: Record<RealmMaterial, string> = { ore: "Hammers", rola: "Rola entries", essence: "Gloves", sand: "Shovels" };
const fmt = (x: number) => Math.round(x).toLocaleString();

type SlotField = "gear" | "skills" | "fantomons" | "relics";
const SYSTEMS: { field: SlotField; key: SlotCategory; label: string; icon: string; material: string; noun: string; plus?: boolean }[] = [
  { field: "gear", key: "gear", label: "Gear", icon: "⚔️", material: "Ore & Rola", noun: "gear" },
  { field: "skills", key: "skill", label: "Skills & Charms", icon: "✨", material: "Essence", noun: "skills" },
  { field: "fantomons", key: "fantomon", label: "Fantomons", icon: "🐾", material: "Treats", noun: "Fantomons" },
  { field: "relics", key: "relic", label: "Relics", icon: "💎", material: "Sand", noun: "relics", plus: true },
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
const common = (rows: SlotForm[], key: keyof SlotForm) => (rows.every((r) => r[key] === rows[0][key]) ? rows[0][key] : "");
const mixed = (rows: SlotForm[], key: keyof SlotForm) => rows.some((r) => r[key] !== rows[0][key]);

export function PlannerPage({ character, onCharacterChange, form, onChange, result, now, defaults, server }: Props) {
  const season = Number(character.season);
  const rule = getRule(season);
  const table = getSeason(season);
  const set = <K extends keyof PlannerForm>(key: K, value: PlannerForm[K]) => onChange({ ...form, [key]: value });
  const full = form.mode === "full";
  const floor = rule?.floor ?? 0;
  const caps = result?.caps;
  const t = result?.time;
  const staminaDefaults = STAMINA_YIELD_DEFAULTS[season];
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

        <div className="planner-cards">
          <Card icon="🎯" title="Season & goal">
            <div className="fields">
              <Field label="Primostars you have" value={form.primostarsNow} onChange={(v) => set("primostarsNow", v)} placeholder="0" />
              <Field label="Total you want" value={form.primostarGoal} onChange={(v) => set("primostarGoal", v)} placeholder="0" />
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
                <label className="check span-2">
                  <input type="checkbox" checked={form.saveBed} onChange={(e) => set("saveBed", e.target.checked)} />
                  <span>
                    Save bed EXP for next season
                    <small>The last natural bed hours are held back. Reset boosts inside that window still count.</small>
                  </span>
                </label>
                {form.saveBed && (
                  <Field label="Hours to save" value={form.saveBedHours} onChange={(v) => set("saveBedHours", v)} placeholder="36" hint="Max 36." />
                )}
                {t?.saveStart && <p className="hint span-2">Start saving {formatEta(0, t.saveStart)}.</p>}
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
                      </span>
                      <input
                        aria-label={`${s.label} current level`}
                        className={bad ? "silly" : undefined}
                        value={common(rows, "current")}
                        onChange={(e) => setAll("current", e.target.value)}
                        placeholder={mixed(rows, "current") ? "mixed" : `${prefix}${baselineOf(s.field)}`}
                      />
                      <span aria-hidden>→</span>
                      <input
                        aria-label={`${s.label} planned level`}
                        className={bad ? "silly" : undefined}
                        value={common(rows, "planned")}
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
                <p className="hint">"Fill min" puts the rest of your goal on that system. "mixed" means the slots differ (set in Full).</p>
              </div>
            )}
          </Card>

          <Card icon="🛒" title="Cart income">
            <p className="hint">What your Cart makes an hour, in the order the Cart screen lists it.</p>
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
                {CART_ORDER.map((k) => (
                  <label key={k} className="cart-row">
                    <span>{MATERIAL_LABELS[k].replace(" (White eq.)", "")}</span>
                    <input
                      value={form.income[k].cartPerHour}
                      onChange={(e) => set("income", { ...form.income, [k]: { ...form.income[k], cartPerHour: e.target.value } })}
                      placeholder="0"
                    />
                    <small>/hr</small>
                  </label>
                ))}
              </div>
            )}
            <p className="hint">Sand counts as White Sand (1 Blue = 5 White, 1 Purple = 25 White).</p>
            {full && (
              <Field label="Fantomon EXP per treat" value={form.expPerTreat} onChange={(v) => set("expPerTreat", v)} placeholder={String(DEFAULT_EXP_PER_TREAT)} />
            )}
          </Card>

          <Card icon="📅" title="Each day">
            <h3 className="subhead">Material Realm refreshes</h3>
            <div className="realm-picks">
              {REALM_MATERIALS.map((k) => (
                <label key={k} className="field">
                  <span>{MATERIAL_LABELS[k].replace(" (White eq.)", "")}</span>
                  <select value={form.refreshes[k] || "0"} onChange={(e) => set("refreshes", { ...form.refreshes, [k]: e.target.value })}>
                    {Array.from({ length: 11 }, (_, n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {result && (
              <p className="pcard-foot">
                {fmt(result.dawniumPerDay)} Dawnium a day
                {days > 0 && <> · {fmt(result.dawniumPerDay * Math.ceil(days))} by season end</>}
                <br />
                <small className="hint">
                  Each refresh is 5 entries; the 5 free daily-quest entries per Realm are added for you. First two cost {realmCost(1)} each.{" "}
                  <a href="#/dawnium">Dawnium Guide →</a>
                </small>
              </p>
            )}
            {full && (
              <div className="full-only">
                <div className="table-wrap flat">
                  <table className="input-table">
                    <thead>
                      <tr>
                        <th scope="col"></th>
                        <th scope="col">Saved entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {REALM_MATERIALS.map((k) => (
                        <tr key={k}>
                          <th scope="row">
                            {MATERIAL_LABELS[k].replace(" (White eq.)", "")} <small>({REALM_TOOLS[k]})</small>
                          </th>
                          <td>
                            <input aria-label={`${k} saved entries`} value={form.savedEntries[k]} onChange={(e) => set("savedEntries", { ...form.savedEntries, [k]: e.target.value })} placeholder="0" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rule && (
                  <label className="field">
                    <span>Realm rank</span>
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

                <h3 className="subhead">Stamina & overworld</h3>
                <p className="hint">Stamina refills 140 a day, plus 50 from the daily quest. Big nodes cost 5 and give 10× (50 a week in total).</p>
                <div className="table-wrap flat">
                  <table className="input-table">
                    <thead>
                      <tr>
                        <th scope="col"></th>
                        <th scope="col">Stamina %</th>
                        <th scope="col">Big nodes / wk</th>
                        <th scope="col">Per stamina</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["rola", "ore", "sand"] as const).map((k) => (
                        <tr key={k}>
                          <th scope="row">{MATERIAL_LABELS[k].replace(" (White eq.)", "")}</th>
                          <td><input aria-label={`${k} stamina percent`} value={form.staminaSplit[k]} onChange={(e) => set("staminaSplit", { ...form.staminaSplit, [k]: e.target.value })} placeholder="0" /></td>
                          <td><input aria-label={`${k} big nodes per week`} value={form.bigNodes[k]} onChange={(e) => set("bigNodes", { ...form.bigNodes, [k]: e.target.value })} placeholder="0" /></td>
                          <td><input aria-label={`${k} per stamina`} value={form.staminaYield[k]} onChange={(e) => set("staminaYield", { ...form.staminaYield, [k]: e.target.value })} placeholder={staminaDefaults ? String(staminaDefaults[k]) : "?"} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!staminaDefaults && <p className="hint">Per-stamina yields are only known for Season 2. Enter what a regular node gives you.</p>}
                <Field label="Dungeon Ore per day" value={form.dungeonOrePerDay} onChange={(v) => set("dungeonOrePerDay", v)} placeholder="0" />
              </div>
            )}
          </Card>
        </div>
      </div>

      <aside className="planner-summary" id="summary">
        {silly ? <GoatCard messages={problems.messages} outlined={Object.values(problems.slots).some((x) => x.size > 0)} /> : <Summary result={result} now={now} />}
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
