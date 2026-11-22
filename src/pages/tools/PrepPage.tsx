// Season prep: one tab per big moment (a new island opening, a season change), each timed for the picked server.
// To add a guide, write a function that returns a Guide (see PrepGuide.tsx) and add it to `guides` below, in game order.
import { useEffect, useId, useState } from "react";
import { ServerSearch } from "../../components/ServerSearch";
import { seasonStatus } from "../../lib/calendar";
import { effectiveDay1, type ServerChoice } from "../calendar/server";
import { aqualisGuide, aqualisOpens, AQUALIS_DAY } from "./AqualisRun";
import { hoursBefore, left, PrepGuide, when, type Guide, type GuideContext } from "./PrepGuide";
import type { ToolProps } from "./props";

/** Season 2 levels worth spending Speed-Ups to reach, from eog.gg's Season 2 prep guide. */
const SPEEDUP_LEVELS: { level: number; unlocks: string }[] = [
  { level: 106, unlocks: "Tier 4, your next power tier" },
  { level: 108, unlocks: "Your Fantomon grows into its Adult form" },
  { level: 116, unlocks: "The Tower opens (Gem drops)" },
  { level: 130, unlocks: "Second dungeon, with the first seasonal gear drops" },
];
const SOURCE = "https://eog.gg/games/sword-x-staff/guides/season-2-prep/";

function season2Guide(end: Date | null, { name, tz, now }: GuideContext): Guide {
  const hold = end ? hoursBefore(end, 36) : null;
  const lastDay = end ? hoursBefore(end, 24) : null;
  /** "Your server: from … until …, <what>." for a step that runs up to the season end. */
  const window = (from: Date | null, what: string) =>
    from &&
    end && (
      <>
        {name}: from <b>{when(from, tz)}</b> ({left(from, now)}) until <b>{when(end, tz)}</b>, {what}.
      </>
    );
  return {
    at: end,
    event: "Season 1 ends",
    eventPast: "Season 1 ended",
    pickHint: "Pick your server above to see when your season ends and when to stop claiming the bed and the Cart and start saving Stamina and dungeon runs.",
    timeline: end
      ? [
          { at: hold!, label: "Stop claiming the bed and the Cart, start saving Stamina" },
          { at: lastDay!, label: "Save your dungeon runs" },
          { at: end, label: "Season 2 starts: levels turn into Primostars" },
        ]
      : [],
    rule: {
      icon: "⏳",
      title: "Don't claim it, carry it over",
      text: "Bed EXP, Cart resources, Stamina and dungeon runs you save in the last hours all carry into Season 2, where they're worth more.",
    },
    phases: [
      {
        title: "Before Season 1 ends",
        steps: [
          {
            title: "Aim for an Astral Pact tier",
            tag: "Before the end",
            items: ["Check which Astral Pact tier your Primostars will land on.", "See if a little more gets you to the next one."],
            link: { href: "/planner", label: "Season Planner → See all bonuses" },
          },
          {
            title: "Finish your upgrades",
            tag: "Before the end",
            items: ["Finish every upgrade before the season ends: only finished ones count.", "Use the planner to see what your materials can still reach."],
            link: { href: "/planner", label: "Season Planner → Plan my goal" },
          },
          {
            title: "Stop claiming the bed",
            tag: "Last 36h",
            items: ["Leave the bed unclaimed.", "Its EXP carries into Season 2, a head start on day one."],
            timed: window(hold, "leave it unclaimed"),
          },
          {
            title: "Stop claiming the Cart",
            tag: "Last 36h",
            items: ["Leave the Cart unclaimed.", "Its resources carry into Season 2 for the new upgrades."],
            timed: window(hold, "leave it unclaimed"),
          },
          {
            title: "Save your Stamina",
            tag: "Last 36h",
            items: ["Only spend the Stamina you need for your daily quests.", "Gathering pays more once you rank up in Season 2."],
            timed: window(hold, "daily quests only"),
          },
          {
            title: "Save your dungeon runs",
            tag: "Last day",
            items: ["Skip your daily dungeon runs and save 4.", "The new dungeon opens on day one of Season 2: run it 6 times."],
            timed: window(lastDay, "no dungeon runs"),
          },
        ],
        foot: 'The Season Planner\'s "Save bed EXP" and "Save Cart resources" options (on by default) already leave those last 36 hours out.',
      },
      {
        title: "When Season 2 starts",
        at: end,
        note: end ? `${name}: work through these in order.` : "Work through these in order.",
        steps: [
          { title: "Claim your rewards", tag: "At reset", items: ["Claim your Seasonal Rewards."] },
          { title: "Spend your Primostars", tag: "At reset", items: ["Put every Primostar into the Astral Pact's permanent bonuses."] },
          {
            title: "Explore to claim statues",
            tag: "First run",
            items: ["Explore as far as you can and claim every statue.", "Statues are free EXP: keep Speed-Ups and Temporal Crystals for when you stall."],
          },
          { title: "Run the new dungeon", tag: "Day one", items: ["Use the 6 runs you saved."] },
          { title: "Do your Relic pulls", tag: "Before day one ends", items: ["Don't let launch day end without them."] },
        ],
      },
      {
        title: "When to spend Speed-Ups",
        note: "Once you stall, spend Speed-Ups and Temporal Crystals only to cross a level that unlocks something.",
        extra: (
          <>
            <div className="table-wrap flat">
              <table>
                <thead>
                  <tr>
                    <th>Level</th>
                    <th>Unlocks</th>
                  </tr>
                </thead>
                <tbody>
                  {SPEEDUP_LEVELS.map((m) => (
                    <tr key={m.level}>
                      <td>
                        <b>Lv. {m.level}</b>
                      </td>
                      <td>{m.unlocks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint">
              Or hold them all until the end of the season: if you're chasing extra Primostars, cashing them in after every new statue is unlocked gets the most EXP
              out of each one.
            </p>
          </>
        ),
        foot: (
          <>
            Launch-day order and Speed-Up levels from{" "}
            <a href={SOURCE} target="_blank" rel="noreferrer">
              eog.gg's Season 2 prep guide
            </a>
            .
          </>
        ),
      },
    ],
  };
}

/** Which server the times are for, with a search to change it. Folds to one line on phones, like the Fantomons page. */
function PrepServer({ choice, onChange }: { choice: ServerChoice; onChange: (c: ServerChoice) => void }) {
  const day1 = effectiveDay1(choice);
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const name = day1 ? choice.name || "Custom server" : "Not picked yet";
  const sub = day1 ? `Times below are for this server${choice.timezone ? `, in ${choice.timezone.replace(/_/g, " ")}` : ""}` : "Pick it to time every step for your server";
  return (
    <section className={`card availability-bar${open ? " open" : ""}`}>
      <button type="button" className="availability-summary" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
        <span className="availability-summary-text">
          <span className="eyebrow">Your server</span>
          <b>{name}</b>
          <small>{sub}</small>
        </span>
        <span className="availability-action">{open ? "Done" : day1 ? "Change" : "Pick"}</span>
      </button>
      <div className="availability-body" id={bodyId}>
        <p className="server-now">
          <span className="eyebrow">Your server</span>
          <b>{name}</b>
          <small>{sub}</small>
        </p>
        <ServerSearch choice={choice} onChange={onChange} />
      </div>
    </section>
  );
}

export function PrepPage({ choice, onServerChange, now }: ToolProps) {
  const day1 = effectiveDay1(choice);
  const ctx: GuideContext = { name: choice.name || "Your server", tz: choice.timezone || undefined, now };
  const shortDate = (d: Date) => d.toLocaleDateString(undefined, { timeZone: ctx.tz, month: "short", day: "numeric" });

  /** Every guide, in the order they happen on a server. */
  const guides: { id: string; label: string; fallback: string; guide: Guide }[] = [
    { id: "aqualis", label: "Aqualis opening", fallback: `Server day ${AQUALIS_DAY}`, guide: aqualisGuide(day1 ? aqualisOpens(day1) : null, ctx) },
    { id: "season-2", label: "Season 1 → 2", fallback: "Season end", guide: season2Guide(day1 ? seasonStatus(day1, now).seasonEnds : null, ctx) },
  ];
  // Open on the guide in the link, else the next one coming up on this server, else the latest.
  const pick = () => {
    const fromHash = guides.find((g) => `#${g.id}` === window.location.hash);
    return (fromHash ?? guides.find((g) => g.guide.at && g.guide.at > now) ?? guides[guides.length - 1]).id;
  };
  const [tab, setTab] = useState(pick);
  useEffect(() => {
    const onHash = () => setTab(pick());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  });
  const current = guides.find((g) => g.id === tab) ?? guides[0];
  const choose = (id: string) => {
    setTab(id);
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="tool prep">
      <PrepServer choice={choice} onChange={onServerChange} />
      <div className="prep-tabs" role="tablist" aria-label="Guides">
        {guides.map((g) => {
          const at = g.guide.at;
          return (
            <button key={g.id} type="button" role="tab" id={`tab-${g.id}`} aria-selected={g.id === current.id} aria-controls="prep-panel" onClick={() => choose(g.id)}>
              <span>{g.label}</span>
              <small>{at ? (at > now ? `${shortDate(at)} · ${left(at, now)}` : `Done · ${shortDate(at)}`) : g.fallback}</small>
            </button>
          );
        })}
      </div>
      <div className="prep-panel" id="prep-panel" role="tabpanel" aria-labelledby={`tab-${current.id}`}>
        <PrepGuide guide={current.guide} ctx={ctx} />
      </div>
    </div>
  );
}
