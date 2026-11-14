// Upgrade costs: what it takes to raise gear, skills, Fantomons or relics from one level to another.
import { SEASON_RULES, getRule } from "../../data/seasons";
import { fantomonStepExp, gearStepCost, relicStepCost, skillStepCost, upgradeCosts } from "../../lib/planner/costs";
import { usePersistentState } from "../../lib/storage";
import { formatXpShort } from "../../lib/xp";

type System = "gear" | "skill" | "fantomon" | "relic";
const SYSTEMS: { key: System; label: string; noun: string }[] = [
  { key: "gear", label: "Gear", noun: "gear pieces" },
  { key: "skill", label: "Skills & Charms", noun: "skills" },
  { key: "fantomon", label: "Fantomons", noun: "Fantomons" },
  { key: "relic", label: "Relics", noun: "relics" },
];

interface CostForm {
  season: string;
  system: System;
  from: string;
  to: string;
  count: string;
  expPerTreat: string;
}

const fmt = (x: number) => Math.round(x).toLocaleString();
const short = (x: number) => (x >= 10_000 ? formatXpShort(Math.round(x)) : fmt(x));

export function CostsPage() {
  const [f, setF] = usePersistentState<CostForm>("sxs.costs", { season: "1", system: "skill", from: "", to: "", count: "1", expPerTreat: "50" });
  const set = <K extends keyof CostForm>(k: K, v: CostForm[K]) => setF({ ...f, [k]: v });
  const rule = getRule(Number(f.season));
  const relic = f.system === "relic";
  const base = rule ? (relic ? rule.relicBase : rule.floor) : 0;
  const from = Math.max(base, Math.floor(Number(f.from.replace(/^\+/, "")) || base));
  const to = Math.floor(Number(f.to.replace(/^\+/, "")) || 0);
  const count = Math.max(1, Math.min(20, Math.floor(Number(f.count) || 1)));
  const perTreat = Number(f.expPerTreat) || 50;
  const ready = !!rule && to > from;

  const slots = Array.from({ length: count }, () => ({ current: from, planned: to }));
  const none = { gear: [], skills: [], fantomons: [], relics: [] };
  const c = ready
    ? upgradeCosts(rule!, {
        ...none,
        ...(f.system === "gear" ? { gear: slots } : f.system === "skill" ? { skills: slots } : f.system === "fantomon" ? { fantomons: slots } : { relics: slots }),
      })
    : null;
  const unknownFrom = c ? Object.values(c.unknownFrom).find((v) => v !== undefined) : undefined;

  // Per-level steps for one slot.
  const steps = ready
    ? Array.from({ length: Math.min(to - from, 200) }, (_, i) => {
        const L = from + 1 + i;
        const g = f.system === "gear" ? gearStepCost(rule!, L) : null;
        const text =
          f.system === "gear"
            ? g === null
              ? "?"
              : `${fmt(g)} Ore · ${fmt(g * 2)} Rola${(L - rule!.floor) % 5 === 0 ? ` · ${fmt(rule!.costs?.forgeStone ?? 0)} Refined Ore` : ""}`
            : f.system === "skill"
              ? (() => {
                  const v = skillStepCost(rule!, L);
                  return v === null ? "?" : `${fmt(v)} Essence`;
                })()
              : f.system === "fantomon"
                ? (() => {
                    const v = fantomonStepExp(rule!, L);
                    return v === null ? "?" : `${fmt(v)} EXP (${fmt(Math.ceil(v / perTreat))} treats)`;
                  })()
                : (() => {
                    const v = relicStepCost(rule!, L);
                    return v === null ? "?" : `${fmt(v.blue || v.purple)} ${v.blue ? "Blue" : "Purple"} Sand · ${fmt(v.rola)} Rola`;
                  })();
        return { L, text };
      })
    : [];

  return (
    <div className="tool costs">
      <section className="card">
        <div className="fields">
          <label className="field">
            <span>Season</span>
            <select value={f.season} onChange={(e) => set("season", e.target.value)}>
              {SEASON_RULES.map((r) => (
                <option key={r.season} value={r.season}>
                  Season {r.season}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>What</span>
            <select value={f.system} onChange={(e) => set("system", e.target.value as System)}>
              {SYSTEMS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>From level</span>
            <input value={f.from} onChange={(e) => set("from", e.target.value)} placeholder={`${relic ? "+" : ""}${base}`} inputMode="numeric" />
          </label>
          <label className="field">
            <span>To level</span>
            <input value={f.to} onChange={(e) => set("to", e.target.value)} placeholder={`${relic ? "+" : ""}${base + 10}`} inputMode="numeric" />
          </label>
          <label className="field">
            <span>How many {SYSTEMS.find((s) => s.key === f.system)!.noun}</span>
            <input value={f.count} onChange={(e) => set("count", e.target.value)} placeholder="1" inputMode="numeric" />
            <small>All raised the same way. Up to 20.</small>
          </label>
          {f.system === "fantomon" && (
            <label className="field">
              <span>Fantomon EXP per treat</span>
              <input value={f.expPerTreat} onChange={(e) => set("expPerTreat", e.target.value)} placeholder="50" inputMode="numeric" />
              <small>Basic 50, Premium 400, Deluxe 2,000.</small>
            </label>
          )}
        </div>
        {rule && (
          <p className="hint">
            Season {rule.season} starts {relic ? `relics at +${rule.relicBase}` : `levels at ${rule.floor}`}: costs are counted from there.
          </p>
        )}
      </section>

      <section className="card results" aria-live="polite">
        {!ready ? (
          <p className="hint">Enter a level to go from and a higher one to reach.</p>
        ) : (
          <>
            <p className="eyebrow">
              {count > 1 ? `${count} × ` : ""}
              {SYSTEMS.find((s) => s.key === f.system)!.label} {relic ? "+" : ""}
              {from} → {relic ? "+" : ""}
              {to}
            </p>
            <dl className="stats two">
              {f.system === "gear" && (
                <>
                  <div>
                    <dt>Ore</dt>
                    <dd>{short(c!.ore)}</dd>
                  </div>
                  <div>
                    <dt>Rola</dt>
                    <dd>{short(c!.rola)}</dd>
                  </div>
                  <div>
                    <dt>Refined Ore</dt>
                    <dd>{fmt(c!.forgeStones)}</dd>
                  </div>
                </>
              )}
              {f.system === "skill" && (
                <div>
                  <dt>Essence</dt>
                  <dd>{short(c!.essence)}</dd>
                </div>
              )}
              {f.system === "fantomon" && (
                <>
                  <div>
                    <dt>Fantomon EXP</dt>
                    <dd>{short(c!.fantomonExp)}</dd>
                  </div>
                  <div>
                    <dt>Treats ({fmt(perTreat)} EXP each)</dt>
                    <dd>{fmt(Math.ceil(c!.fantomonExp / perTreat))}</dd>
                  </div>
                </>
              )}
              {relic && (
                <>
                  <div>
                    <dt>{c!.blueSand ? "Blue Sand" : "Purple Sand"}</dt>
                    <dd>{fmt(c!.blueSand || c!.purpleSand)}</dd>
                  </div>
                  <div>
                    <dt>As White Sand</dt>
                    <dd>{short(c!.sand)}</dd>
                  </div>
                  <div>
                    <dt>Rola</dt>
                    <dd>{short(c!.rola)}</dd>
                  </div>
                </>
              )}
            </dl>
            {unknownFrom !== undefined && (
              <p className="note warn">There's no cost data from level {unknownFrom} up, so those levels aren't counted.</p>
            )}
            <details className="cost-steps">
              <summary>Each level{count > 1 ? " (for one)" : ""}</summary>
              <ul>
                {steps.map((s) => (
                  <li key={s.L}>
                    <span>
                      {relic ? "+" : "Lv "}
                      {s.L}
                    </span>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ul>
            </details>
            <p className="hint">
              Planning a whole season? The <a href="#/planner">Season Planner</a> adds these up across every system and checks them against what
              you'll have.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
