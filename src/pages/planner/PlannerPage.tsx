import { useEffect, useState, type ReactNode } from "react";
import { GameIcon } from "../../components/GameIcon";
import { CharacterForm, type Character } from "../../components/CharacterForm";
import { Field } from "../../components/Field";
import { DAWNIUM_REFRESH_COSTS, getRule } from "../../data/seasons";
import { DAILY_TASKS, REALM_TOOL_NAMES, SHOP_REFRESH_COSTS, rolaBuyCost, shopRefreshCost } from "../../data/gameConfig";
import type { Material, PlannerResult } from "../../lib/planner/plan";
import type { SlotCategory } from "../../lib/planner/score";
import { REALM_MATERIALS, type RealmMaterial } from "../../lib/planner/plan";
import { RealmSuggest } from "./RealmSuggest";
import { formatDuration, formatEta, formatXpShort, getSeason } from "../../lib/xp";
import { rich, useT } from "../../i18n";
import type { MessageKey } from "../../i18n/en";
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
import { GoalPlanBox, StaminaGoalBox } from "./GoalPlanBox";
import { shareText } from "./shareText";
import { ProgressLog, addSnapshot, type Snapshot } from "./ProgressLog";
import { usePersistentState } from "../../lib/storage";
import { pactGoalHint } from "./AstralPact";
import { applyFound } from "./fromScreens";
import { fixed, formatLocale } from "../../i18n/format";

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
const fmt = (x: number) => Math.round(x).toLocaleString(formatLocale());

type SlotField = "gear" | "skills" | "fantomons" | "relics";
const SYSTEMS: { field: SlotField; key: SlotCategory; label: string; icon: string; material: string; noun: string; one: string; plus?: boolean }[] = [
  { field: "gear", key: "gear", label: "Gear", icon: "⚔️", material: "Ore & Rola", noun: "gear", one: "gear piece" },
  { field: "skills", key: "skill", label: "Skills & Charms", icon: "✨", material: "Essence", noun: "skills", one: "skill" },
  { field: "fantomons", key: "fantomon", label: "Fantomons", icon: "🐾", material: "Treats", noun: "Fantomons", one: "Fantomon" },
  { field: "relics", key: "relic", label: "Relics", icon: "💎", material: "Sand", noun: "relics", one: "relic", plus: true },
];

/** One labelled card in the planner grid. */
/** The planner's steps on phones, in order (each is one card). */
const STEPS = [
  { id: "goal", label: "Goal" },
  { id: "character", label: "Character" },
  { id: "levels", label: "Levels" },
  { id: "materials", label: "Materials" },
  { id: "daily", label: "Each day" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

function Card({
  icon,
  title,
  aside,
  wide,
  step,
  current,
  onStep,
  children,
}: {
  icon: ReactNode;
  title: string;
  aside?: ReactNode;
  wide?: boolean;
  step: StepId;
  current: StepId;
  onStep: (s: StepId) => void;
  children: ReactNode;
}) {
  const { t } = useT();
  const i = STEPS.findIndex((x) => x.id === step);
  const prev = STEPS[i - 1], next = STEPS[i + 1];
  return (
    <section className={`card pcard${wide ? " wide" : ""}${step === current ? " step-active" : ""}`} id={`step-${step}`}>
      <div className="pcard-head">
        <h2>
          <span aria-hidden>{icon}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
      <div className="step-nav">
        {prev ? (
          <button type="button" className="link-button" onClick={() => onStep(prev.id)}>
            ← {t(`pl.step.${prev.id}` as MessageKey)}
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button type="button" className="spin-button" onClick={() => onStep(next.id)}>
            {t("pl.next", { label: t(`pl.step.${next.id}` as MessageKey) })}
          </button>
        ) : (
          <a className="spin-button" href="#summary" onClick={(e) => {
            e.preventDefault();
            document.getElementById("summary")?.scrollIntoView({ behavior: "smooth" });
          }}>
            {t("pl.seeProjection")}
          </a>
        )}
      </div>
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
  const { t: tr, tn, locale } = useT();
  const table = getSeason(season);
  const set = <K extends keyof PlannerForm>(key: K, value: PlannerForm[K]) => onChange({ ...form, [key]: value });
  // Phones show one card at a time; the step bar and Back/Next move between them.
  const [step, setStep] = useState<StepId>("goal");
  const goStep = (s: StepId) => {
    setStep(s);
    requestAnimationFrame(() => document.getElementById("plan-steps")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
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
  const problems = findProblems(character, form, rule, table, tr);
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
          <a className="guide-banner" href="/guide">
            <span aria-hidden>📖</span>
            <span>
              {rich(tr("pl.newTo"))}
            </span>
          </a>
          <button type="button" className="link-button planner-clear" onClick={onClear}>
            {tr("planner.clear")}
          </button>
        </div>
        <div className="mode-switch" role="group" aria-label={tr("pl.detail")}>
          {(["simple", "full"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={form.mode === m} onClick={() => set("mode", m)}>
              <b>{m === "simple" ? tr("pl.simple") : tr("pl.full")}</b>
              <small>{m === "simple" ? tr("pl.simpleSub") : tr("pl.fullSub")}</small>
            </button>
          ))}
          <p className="hint">
            {full
              ? tr("pl.fullHint")
              : tr("pl.simpleHint")}
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

        <nav className="plan-steps" id="plan-steps" aria-label={tr("pl.steps")}>
          {STEPS.map((x, i) => (
            <button key={x.id} type="button" aria-current={x.id === step ? "step" : undefined} onClick={() => goStep(x.id)}>
              <span className="plan-step-num">{i + 1}</span>
              {tr(`pl.step.${x.id}` as MessageKey)}
            </button>
          ))}
        </nav>
        <div className="planner-cards">
          <Card icon={<GameIcon name="primostar" />} title={tr("pl.goalCard")} step="goal" current={step} onStep={goStep}>
            <div className="fields">
              <Field label={tr("pl.have")} value={form.primostarsNow} onChange={(v) => set("primostarsNow", v)} placeholder="0" />
              <Field
                label={tr("pl.want")}
                value={form.primostarGoal}
                onChange={(v) => set("primostarGoal", v)}
                placeholder="0"
                hint={pactGoalHint(Number(form.primostarGoal), tr) ?? tr("pl.wantHint")}
              />
              <Field
                className="span-2"
                type="datetime-local"
                label={tr("pl.seasonEnds")}
                value={effectiveSeasonEnd(form, defaults, now)}
                onChange={(v) => set("seasonEnd", v)}
                hint={
                  form.seasonEnd ? (
                    defaults.seasonEnd ? (
                      <button type="button" className="link-button" onClick={() => set("seasonEnd", "")}>
                        {tr("pl.useServerEnd", { server: server?.name || tr("pl.myServer") })}
                      </button>
                    ) : undefined
                  ) : defaults.seasonEnd ? (
                    <>{tr("pl.fromCalendar", { server: server?.name || tr("pl.yourServer") })}</>
                  ) : (
                    <>
                      {tr("pl.guessing")} <a href="/calendar">{tr("pl.pickServer")}</a> {tr("pl.forRealDate")}
                    </>
                  )
                }
              />
            </div>
            {t && <p className="pcard-foot">{tr("pl.left", { time: formatDuration(t.realHours), n: t.resets.length })}</p>}
            {rule && result && result.score.scoreNeeded > 0 && (
              <p className="hint">
                {rich(tr("pl.needs", { points: fmt(result.score.scoreNeeded), per: rule.pointsPerStar, fixed: rule.fixedStars }))}
              </p>
            )}
            <div className="fields save-next">
              <label className="check span-2">
                <input type="checkbox" checked={form.saveBed} onChange={(e) => set("saveBed", e.target.checked)} />
                <span>
                  {tr("pl.saveBed")} <em className="chip">{tr("pl.recommended")}</em>
                  <small>{tr("pl.saveBedHint")}</small>
                </span>
              </label>
              {form.saveBed && (
                <Field label={tr("pl.bedHours")} value={form.saveBedHours} onChange={(v) => set("saveBedHours", v)} placeholder="36" hint={tr("pl.max36")} />
              )}
              <label className="check span-2">
                <input type="checkbox" checked={form.saveCart !== false} onChange={(e) => set("saveCart", e.target.checked)} />
                <span>
                  {tr("pl.saveCart")} <em className="chip">{tr("pl.recommended")}</em>
                  <small>{tr("pl.saveCartHint")}</small>
                </span>
              </label>
              {form.saveCart !== false && (
                <Field label={tr("pl.cartHours")} value={form.saveCartHours ?? "36"} onChange={(v) => set("saveCartHours", v)} placeholder="36" hint={tr("pl.max36")} />
              )}
              {(t?.saveStart || t?.cartSaveStart) && (
                <p className="hint span-2">
                  {t?.saveStart && <>{tr("pl.stopBed", { eta: formatEta(0, t.saveStart) })} </>}
                  {t?.cartSaveStart && <>{tr("pl.stopCart", { eta: formatEta(0, t.cartSaveStart) })}</>}
                </p>
              )}
            </div>
            {full && (
              <div className="fields full-only">
                <Field
                  type="time"
                  label={tr("pl.dailyReset")}
                  value={form.resetTime || defaults.resetTime}
                  onChange={(v) => set("resetTime", v)}
                  hint={form.resetTime ? undefined : tr("pl.resetHint")}
                />
                <Field label={tr("pl.boostHours")} value={form.boostHours} onChange={(v) => set("boostHours", v)} placeholder="2" />
              </div>
            )}
          </Card>

          <Card icon={<GameIcon name="character" />} title={tr("pl.charCard")} step="character" current={step} onStep={goStep}>
            {server && server.season !== season && server.season <= 5 && (
              <p className="note warn">
                {tr("pl.serverIn", { server: server.name || tr("cal.yourServer"), n: server.season })}{" "}
                <button type="button" className="link-button" onClick={() => onCharacterChange({ ...character, season: String(server.season) })}>
                  {tr("pl.switchSeason", { n: server.season })}
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
                {rich(tr("pl.projected", { lv: fixed(result.character.decimalLevel, 2) }))}
                {t && <> · {tr("pl.expHours", { n: fmt(t.xpHours) })}</>}
              </p>
            )}
            {result && !result.character.ok && <p className="error">{tr("pl.noExpData", { n: season })}</p>}
            {result?.character.stoppedAt !== undefined && <p className="error">{tr("pl.runsOut", { n: result.character.stoppedAt })}</p>}
            {full && (
              <div className="fields full-only">
                <Field label={tr("pl.statues")} value={form.statues} onChange={(v) => set("statues", v)} placeholder="0" hint={tr("pl.statuesHint")} />
                <Field label={tr("pl.statuesDay")} value={form.statuesPerDay} onChange={(v) => set("statuesPerDay", v)} placeholder="0" />
              </div>
            )}
          </Card>

          <Card icon="📈" title={tr("pl.levelsCard")} step="levels" current={step} onStep={goStep} wide>
            <p className="hint">
              {full ? tr("pl.levelsFull") : tr("pl.levelsSimple")}{" "}
              {rule ? tr("pl.scoringRelic", { floor, relic: rule.relicFloor }) : tr("pl.scoring", { floor })}
            </p>
            <StaminaGoalBox result={result} />
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
                const names = s.field === "gear" ? GEAR_NAMES : range(form[s.field].length, (i) => (s.field === "skills" ? tr("pl.skillN", { n: i + 1 }) : `#${i + 1}`));
                const cap = capOf(s.key);
                return (
                  <div key={s.field} className="system-block">
                    <div className="system-head">
                      <h3>
                        <GameIcon name={s.key} /> {tr(`pl.sys.${s.field}` as MessageKey)} <small>· {s.material}</small>
                      </h3>
                      {rule && <span className="chip">{tr("pl.ptsLv", { n: rule.weights[s.key] })}</span>}
                    </div>
                    <SlotTable
                      names={names}
                      rows={form[s.field]}
                      onChange={(rows) => set(s.field, rows)}
                      invalid={problems.slots[s.field]}
                      baseline={baselineOf(s.field)}
                      cap={cap ?? null}
                      prefix={s.plus ? "+" : ""}
                      noun={tr(`pl.one.${s.field}` as MessageKey)}
                      quick={s.field === "skills" && character.level.trim() ? { label: tr("pl.quickSkills", { lv: character.level.trim() }), value: character.level.trim() } : undefined}
                    />
                    <div className="system-foot">
                      {cap != null && <span className="hint">{tr("pl.capBy", { cap: `${s.plus ? "+" : ""}${cap}` })}</span>}
                      {canFill && (
                        <button type="button" className="link-button" onClick={() => fill(s)}>
                          {tr(`pl.fillMin.${s.field}` as MessageKey)}
                        </button>
                      )}
                    </div>
                    {result?.minimum[s.key].limited && <p className="hint warn">{tr("pl.cantAlone", { system: tr(`pl.sys.${s.field}` as MessageKey) })}</p>}
                  </div>
                );
              })
            ) : (
              <div className="simple-levels">
                <div className="simple-head" aria-hidden>
                  <span />
                  <span>{tr("pl.now")}</span>
                  <span />
                  <span>{tr("pl.plan")}</span>
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
                          <GameIcon name={s.key} /> {tr(`pl.sys.${s.field}` as MessageKey)}
                        </b>
                        {rule && <small>{tr("pl.ptsLv", { n: rule.weights[s.key] })}</small>}
                        {capOf(s.key) != null && <small>{tr("pl.cap", { cap: `${prefix}${capOf(s.key)}` })}</small>}
                      </span>
                      <input
                        aria-label={tr("pl.currentAria", { system: tr(`pl.sys.${s.field}` as MessageKey) })}
                        className={bad ? "silly" : undefined}
                        value={shown(rows, "current")}
                        onFocus={(e) => mixed(rows, "current") && e.target.select()}
                        title={mixed(rows, "current") ? tr("pl.slotsDiffer") : undefined}
                        onChange={(e) => setAll("current", e.target.value)}
                        placeholder={mixed(rows, "current") ? tr("pl.mixed") : `${prefix}${baselineOf(s.field)}`}
                      />
                      <span aria-hidden>→</span>
                      <input
                        aria-label={tr("pl.plannedAria", { system: tr(`pl.sys.${s.field}` as MessageKey) })}
                        className={bad ? "silly" : overCap(rows, capOf(s.key)) ? "over-cap" : undefined}
                        value={shown(rows, "planned")}
                        onFocus={(e) => mixed(rows, "planned") && e.target.select()}
                        title={mixed(rows, "planned") ? tr("pl.slotsDiffer") : undefined}
                        onChange={(e) => setAll("planned", e.target.value)}
                        placeholder={mixed(rows, "planned") ? tr("pl.mixed") : tr("pl.same")}
                      />
                      {canFill ? (
                        <button type="button" className="fill-btn" onClick={() => fill(s)} title={tr(`pl.fillTitle.${s.field}` as MessageKey)}>
                          {tr("pl.fillMinShort")}
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
                <p className="hint">{tr("pl.fillHint")}</p>
              </div>
            )}
          </Card>

          <Card icon={<GameIcon name="rola" />} title={tr("pl.cartCard")} step="materials" current={step} onStep={goStep}>
            <p className="hint">{tr("pl.cartHint")}</p>
            {full ? (
              <div className="table-wrap flat">
                <table className="input-table">
                  <thead>
                    <tr>
                      <th scope="col"></th>
                      <th scope="col">{tr("pl.cartHr")}</th>
                      <th scope="col">{tr("pl.haveNow")}</th>
                      <th scope="col">{tr("pl.shopOther")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CART_ORDER.map((k) => (
                      <tr key={k}>
                        <th scope="row"><GameIcon name={k} /> {k === "sand" ? tr("pl.sandWhite") : MATERIAL_LABELS[k]}</th>
                        {(["cartPerHour", "have", "perDay"] as const).map((col) => (
                          <td key={col}>
                            <input
                              aria-label={tr(col === "cartPerHour" ? "pl.cartAria" : col === "have" ? "pl.handAria" : "pl.perDayAria", { name: MATERIAL_LABELS[k] })}
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
                  <span>{tr("pl.cartHr")}</span>
                  <span>{tr("pl.haveNow")}</span>
                </div>
                {CART_ORDER.map((k) => {
                  const name = MATERIAL_LABELS[k].replace(" (White eq.)", "");
                  return (
                    <div key={k} className="cart-row">
                      <span><GameIcon name={k} /> {name}</span>
                      <input
                        aria-label={tr("pl.cartAria", { name })}
                        value={form.income[k].cartPerHour}
                        onChange={(e) => set("income", { ...form.income, [k]: { ...form.income[k], cartPerHour: e.target.value } })}
                        placeholder="0"
                      />
                      <input
                        aria-label={tr("pl.handAria", { name })}
                        value={form.income[k].have}
                        onChange={(e) => set("income", { ...form.income, [k]: { ...form.income[k], have: e.target.value } })}
                        placeholder="0"
                      />
                    </div>
                  );
                })}
              </div>
            )}
            <p className="hint">{tr("pl.sandHint")}</p>
            <Field
              label={tr("pl.refined")}
              value={form.refinedOre ?? ""}
              onChange={(v) => set("refinedOre", v)}
              placeholder="0"
              hint={tr("pl.refinedHint")}
            />
            {full && (
              <Field label={tr("pl.expPerTreat")} value={form.expPerTreat} onChange={(v) => set("expPerTreat", v)} placeholder={String(DEFAULT_EXP_PER_TREAT)} />
            )}
          </Card>

          <Card icon="📅" title={tr("pl.dailyCard")} step="daily" current={step} onStep={goStep}>
            <h3 className="subhead">{tr("pl.realms")}</h3>
            <RealmSuggest
              result={result}
              current={Object.fromEntries(REALM_MATERIALS.map((k) => [k, Number(form.refreshes[k]) || 0])) as Record<RealmMaterial, number>}
              onPick={(split) => set("refreshes", Object.fromEntries(REALM_MATERIALS.map((k) => [k, String(split[k])])) as PlannerForm["refreshes"])}
            />
            <div className="realm-picks">
              {REALM_MATERIALS.map((k) => (
                <label key={k} className="field">
                  <span><GameIcon name={k} /> {MATERIAL_LABELS[k].replace(" (White eq.)", "")}</span>
                  <select value={form.refreshes[k] || "0"} onChange={(e) => set("refreshes", { ...form.refreshes, [k]: e.target.value })}>
                    {Array.from({ length: 11 }, (_, n) => (
                      <option key={n} value={n}>
                        {tn("pl.refreshN", n)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {result && days > 0 && (
              <div className="tool-summary">
                <p>
                  {rich(
                    tr(form.dailyTasks !== false ? "pl.byEndTasks" : "pl.byEnd", {
                      list: new Intl.ListFormat(locale, { type: "conjunction" }).format(REALM_MATERIALS.map((k) => `<b>${fmt(result.realmTools[k])}</b> ${REALM_TOOL_NAMES[k]}`)),
                    }),
                  )}
                </p>
                {result.realmYields && (
                  <p className="hint">
                    {tr("pl.eachRun", { ore: fmt(result.realmYields.ore), rola: fmt(result.realmYields.rola), essence: fmt(result.realmYields.essence), sand: fmt(result.realmYields.sand) })}
                  </p>
                )}
                <p className="hint">
                  {rich(tr("pl.refreshCost", { n: fmt(result.dawniumPerDay - rolaBuyCost(Number(form.rolaBuys) || 0)), cost: realmCost(1) }))}{" "}
                  <a href="/dawnium">{tr("pl.dawniumGuide")}</a>
                </p>
              </div>
            )}

            <h3 className="subhead">{tr("pl.homeShop")}</h3>
            <label className="field">
              <span>{tr("pl.refreshes")}</span>
              <select value={form.shopRefreshes || "0"} onChange={(e) => set("shopRefreshes", e.target.value)}>
                {Array.from({ length: SHOP_REFRESH_COSTS.length + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n === 0 ? tr("pl.noneFree") : tr("pl.rolaDay", { n, rola: formatXpShort(shopRefreshCost(n)) })}
                  </option>
                ))}
              </select>
              <small>{tr("pl.shelfHint")}</small>
            </label>

            <h3 className="subhead">{tr("pl.toolsSaved")}</h3>
            <p className="hint">{tr("pl.toolsHint")}</p>
            <div className="table-wrap flat">
              <table className="input-table">
                <thead>
                  <tr>
                    <th scope="col"></th>
                    <th scope="col">{tr("pl.inBackpack")}</th>
                  </tr>
                </thead>
                <tbody>
                  {REALM_MATERIALS.map((k) => (
                    <tr key={k}>
                      <th scope="row">{REALM_TOOL_NAMES[k]}</th>
                      <td>
                        <input aria-label={tr("pl.toolSavedAria", { name: REALM_TOOL_NAMES[k] })} value={form.savedEntries[k]} onChange={(e) => set("savedEntries", { ...form.savedEntries, [k]: e.target.value })} placeholder="0" />
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
                    {tr("pl.dailyTasks")}
                    <small>
                      {tr("pl.dailyTasksHint", {
                        stamina: DAILY_TASKS.stamina,
                        tools: Object.values(DAILY_TASKS.realmTools).reduce((a, b) => a + b, 0),
                        rola: result ? fmt(DAILY_TASKS.rolaBase * result.scale) : tr("pl.rolaRank", { n: DAILY_TASKS.rolaBase }),
                      })}
                    </small>
                  </span>
                </label>
                <label className="field">
                  <span>{tr("pl.rolaBought")}</span>
                  <select value={form.rolaBuys || "0"} onChange={(e) => set("rolaBuys", e.target.value)}>
                    {Array.from({ length: 21 }, (_, n) => (
                      <option key={n} value={n}>
                        {n === 0
                          ? tr("pl.none")
                          : tr("pl.rolaFor", { n, rola: result ? formatXpShort(n * 1500 * result.scale) : n * 1500, cost: fmt(rolaBuyCost(n)) })}
                      </option>
                    ))}
                  </select>
                  <small>{tr("pl.rolaBuyHint")}</small>
                </label>

                {rule && (
                  <label className="field">
                    <span>{tr("pl.rank")}</span>
                    <select value={form.realmTier} onChange={(e) => set("realmTier", e.target.value as PlannerForm["realmTier"])}>
                      <option value="auto">{tr("pl.auto", { name: `${rule.realmRankName} III` })}</option>
                      {[1, 2, 3].map((tier) => (
                        <option key={tier} value={tier}>
                          {rule.realmRankName} {"I".repeat(tier)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <h3 className="subhead">{tr("pl.stamina")}</h3>
                <p className="hint">{tr("pl.staminaHint")}</p>
                <ul className="hint gather-facts">
                  <li>
                    {form.dailyTasks !== false ? tr("pl.st.baseTasks", { n: DAILY_TASKS.stamina }) : tr("pl.st.base")}
                    {result && rich(tr("pl.st.total", { n: fmt(result.stamina) }))}
                    {tr("pl.st.cost")}
                  </li>
                  <li>
                    {rich(tr("pl.st.share"))}
                  </li>
                  <li>
                    {rich(tr("pl.st.mines"))}
                  </li>
                  <li>
                    {rich(tr("pl.st.per"))}
                  </li>
                </ul>
                <div className="table-wrap flat">
                  <table className="input-table">
                    <thead>
                      <tr>
                        <th scope="col"></th>
                        <th scope="col">{tr("pl.col.share")}</th>
                        <th scope="col">{tr("pl.col.mines")}</th>
                        <th scope="col">{tr("pl.col.per")}</th>
                        <th scope="col">{tr("pl.col.byEnd")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["rola", "ore", "sand", "essence"] as const).map((k) => (
                        <tr key={k}>
                          <th scope="row"><GameIcon name={k} /> {MATERIAL_LABELS[k].replace(" (White eq.)", "")}</th>
                          <td>
                            <input aria-label={tr("pl.aria.stPct", { name: MATERIAL_LABELS[k] })} value={form.staminaSplit[k] ?? ""} onChange={(e) => set("staminaSplit", { ...form.staminaSplit, [k]: e.target.value })} placeholder="0" />
                          </td>
                          <td>
                            {k === "essence" ? (
                              <span className="hint">—</span>
                            ) : (
                              <input aria-label={tr("pl.aria.mines", { name: MATERIAL_LABELS[k] })} value={form.bigNodes[k]} onChange={(e) => set("bigNodes", { ...form.bigNodes, [k]: e.target.value })} placeholder="0" />
                            )}
                          </td>
                          <td>
                            {k === "essence" ? (
                              <span className="hint">{result ? fmt(result.gatherPerStamina.essence) : "—"}</span>
                            ) : (
                              <input
                                aria-label={tr("pl.aria.per", { name: MATERIAL_LABELS[k] })}
                                value={form.staminaYield[k]}
                                onChange={(e) => set("staminaYield", { ...form.staminaYield, [k]: e.target.value })}
                                placeholder={result ? fmt(result.gatherPerStamina[k]) : tr("pl.autoValue")}
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
                    <p className="hint warn">{tr("pl.overTotal", { n: total })}</p>
                  ) : total > 0 && total < 100 ? (
                    <p className="hint">{tr("pl.notGathering", { n: 100 - total })}</p>
                  ) : null;
                })()}
                <Field
                  label={tr("pl.dungeonOre")}
                  value={form.dungeonOrePerDay}
                  onChange={(v) => set("dungeonOrePerDay", v)}
                  placeholder="0"
                  hint={tr("pl.dungeonOreHint")}
                />
              </div>
            )}
          </Card>
        </div>
        <ProgressLog result={result} log={progress.entries} onLog={logNow} onClear={() => setProgress({ entries: [] })} />
      </div>

      {(silly || result) && <aside className="planner-summary" id="summary">
        {silly ? <GoatCard messages={problems.messages} outlined={Object.values(problems.slots).some((x) => x.size > 0)} /> : <Summary
            result={result}
            now={now}
            onPickGoal={(stars) => set("primostarGoal", String(stars))}
            share={result ? shareText(result, form, character.level) : undefined}
          />}
      </aside>}

      {silly ? (
        <a className="mobile-bar goat-bar" href="#summary" onClick={(e) => {
          e.preventDefault();
          document.getElementById("summary")?.scrollIntoView({ behavior: "smooth" });
        }}>
          <b>{tr("pl.goat")}</b>
          <span>{tr("pl.goatSub")}</span>
        </a>
      ) : result && (
        <a className="mobile-bar" href="#summary" onClick={(e) => {
          e.preventDefault();
          document.getElementById("summary")?.scrollIntoView({ behavior: "smooth" });
        }}>
          <b>{tr("pl.barStars", { n: result.score.earned.toLocaleString(locale) })}</b>
          {result.character.ok && <span>{tr("lg.lv", { lv: fixed(result.character.decimalLevel, 2) })}</span>}
          <span>
            {result.realmEntriesNeeded === null ? tr("pl.realmsUnknown") : tr("pl.barRealms", { n: result.realmEntriesNeeded.toLocaleString(locale) })}
          </span>
        </a>
      )}
    </div>
  );
}
