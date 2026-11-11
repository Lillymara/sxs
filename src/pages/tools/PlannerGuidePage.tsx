// How to use the Season Planner: step by step, in the order of the planner's cards.
import type { ReactNode } from "react";

interface Step {
  id: string;
  title: string;
  intro: ReactNode;
  points: ReactNode[];
  tip?: ReactNode;
}

const STEPS: Step[] = [
  {
    id: "mode",
    title: "Choose Simple or Full",
    intro: "The switch at the top sets how much the planner asks for. You can change it at any time without losing anything.",
    points: [
      <>
        <b>Simple</b> asks for one level per system, your Cart income and what you have on hand. A good place to start.
      </>,
      <>
        <b>Full</b> adds every single slot, stamina and gathering, daily tasks, Rola bought with Dawnium, your rank, bed boosts and saving bed
        EXP. Use it for the closest answer.
      </>,
    ],
  },
  {
    id: "screenshots",
    title: "Fill it in from screenshots (optional)",
    intro: "Instead of typing, let the planner read your numbers from game screenshots. They're read on your device and never uploaded.",
    points: [
      <>
        Tap <b>Fill from screenshots</b>. Open <b>How to take the screenshots</b> to see where each screen is, with an example of each.
      </>,
      <>
        Take these five: <b>Character</b>, <b>Bed</b>, <b>Cart</b>, <b>Season → Progression</b> and your <b>Backpack</b> (scroll so your
        materials and Realm tools show; more than one Backpack screenshot is fine).
      </>,
      <>Pick them all at once or one at a time. Each one gets a label (Character, Cart…) once it's read.</>,
      <>
        Check the numbers under <b>Check what was found</b> and fix anything that's wrong.
      </>,
      <>
        Then tap <b>Fill the planner</b>. <b>Nothing goes in until you tap it.</b>
      </>,
    ],
    tip: "Screenshot the whole screen, uncropped, with no pop-ups covering the numbers.",
  },
  {
    id: "goal",
    title: "Season & goal",
    intro: "Tell the planner where you are and where you want to be.",
    points: [
      <>
        <b>Primostars you have:</b> the total you've filled so far, across every season.
      </>,
      <>
        <b>Total you want:</b> your goal. The hint under it names the Astral Pact bonus that total unlocks, or the next one above it. Aiming for
        a bonus tier is usually the point. See step 8.
      </>,
      <>
        <b>Season ends:</b> filled in from your server on the <a href="#/calendar">Server Calendar</a>. Without a server it guesses 14 days, so
        pick yours. Everything depends on how much time is left.
      </>,
      <>
        <b>Full mode</b> also has your daily reset time, boost hours per reset, and an option to <b>save bed EXP for next season</b> (the
        last hours of bed EXP are held back).
      </>,
    ],
  },
  {
    id: "character",
    title: "Character EXP",
    intro: "Your level and how fast you're levelling. This decides your season-end level, and that sets every cap.",
    points: [
      <>
        <b>Season</b>, <b>Current level</b> and your EXP into the level (as EXP like 605K, or as a percent).
      </>,
      <>
        <b>XP per hour</b> is the EXP/Hr on your Bed. The free daily bed boost is counted as 2 hours of EXP after each reset (change it in
        Full mode under <b>Boost hours per reset</b>).
      </>,
      <>
        Underneath you'll see <b>Projected by season end: Lv …</b>. At around 1.8M EXP per level from 122 onward, a 76K/hr bed is about a level
        a day.
      </>,
      <>
        <b>Full mode</b> adds Goddess statues (+1% EXP each) and how many new ones you'll get a day.
      </>,
    ],
  },
  {
    id: "systems",
    title: "System levels and Plan my goal",
    intro: "Gear, Skills & Charms, Fantomons and Relics. Each level above the season's starting level scores points; 100 points make a Primostar in Season 1.",
    points: [
      <>
        <b>Now</b> is your current level, <b>Plan</b> is where you'll take it. Blank Plan means "stay where I am". A range like{" "}
        <b>135–140</b> means your slots differ (see each one in Full).
      </>,
      <>
        <b>Caps</b> come from your projected season-end level: Skills up to that level, Fantomons to the next multiple of 10 (Lv 129 → 130, Lv
        130 → 140), Relics to a tenth of it plus one (Lv 130 → +14). Gear has no cap. Plans past a cap turn red and only count up to the cap.
      </>,
      <>
        <b>Plan my goal</b> (the box at the top) works out the cheapest way to reach your goal across all four systems, using only the
        materials you'll have by season end. Tap <b>Use this plan</b> to fill in every Plan box.
      </>,
      <>
        If the goal is out of reach, the box says how many Primostars you'd be short and which material runs out first, then offers to{" "}
        <b>lower your goal</b>: to the highest Astral Pact tier you can reach, or to the most you can reach.
      </>,
      <>
        <b>Fill min</b> next to a system puts the rest of your goal on that one system alone, if you'd rather push one thing.
      </>,
      <>
        In <b>Full</b>, each system lists every slot, and the <b>Set every…</b> row sets them all to one level at once.
      </>,
    ],
  },
  {
    id: "income",
    title: "Cart income and what you have",
    intro: "Where your materials come from.",
    points: [
      <>
        <b>Cart / hr</b> is each line of your Cart, in the order the Cart lists them. <b>Have now</b> is what's in your Backpack.
      </>,
      <>
        <b>Sand</b> is counted as White Sand (1 Blue = 5 White, 1 Purple = 25 White). <b>Treats</b> are counted as Basic Treats.
      </>,
      <>
        <b>Refined Ore on hand:</b> gear needs it every 5 levels. It's rarely short (4 map gathers a day plus Ore Realms), so it's shown but
        doesn't limit plans.
      </>,
      <>
        <b>Full mode</b> also has a "Shop + other / day" column for anything else you get daily, and Fantomon EXP per treat.
      </>,
    ],
  },
  {
    id: "daily",
    title: "Each day",
    intro: "What you do every day to top up materials.",
    points: [
      <>
        <b>Material Realms:</b> how many Dawnium refreshes you buy for each Realm a day. The box underneath shows the tools you'll have by season
        end and what each run gives. See the <a href="#/dawnium">Dawnium Guide</a> for sensible splits.
      </>,
      <>
        <b>Home Shop:</b> refreshes a day. The shop only spends Rola you have spare, after upgrades.
      </>,
      <>
        <b>Realm tools saved up:</b> Hammers, Pickaxes, Knuckles and Shovels already in your Backpack.
      </>,
      <>
        <b>Full mode</b> adds daily tasks, Rola bought with Dawnium, your rank (sets Realm, gathering and shop amounts), and{" "}
        <b>Stamina &amp; gathering</b>: what percent of your Stamina goes to Rola, Ore, Sand and Essence, plus shared Grand Mines. The{" "}
        <b>By season end</b> column shows what that gathers.
      </>,
    ],
  },
  {
    id: "results",
    title: "Read the projection",
    intro: "The panel beside the cards (or at the bottom on a phone; tap the bar at the bottom of the screen to jump there).",
    points: [
      <>
        <b>+N Primostars</b> is what this season adds: the season's fixed ones plus what your levels earn. It's a floor, not a forecast. Below
        it are the points from each system.
      </>,
      <>
        <b>Astral Pact:</b> how many permanent bonuses your projected total unlocks and what's next. Tap <b>See all bonuses</b> for the full
        table: grey is already yours, coloured is this season, gold is up to your goal. <b>Aim for this</b> on any row makes it your goal.
      </>,
      <>
        <b>Upgrade costs:</b> everything your plan spends.
      </>,
      <>
        <b>Material balance by season end:</b> for each material, what the plan <b>Needs</b>, your <b>Income</b> (on hand + Cart + gathering),
        what <b>Realm</b> runs and the <b>Shop</b> cover, and what's <b>Left</b>. Green is spare; red still needs finding.
      </>,
      <>
        If something can't happen (a plan below your current level, more EXP than a level holds…), a <b>silly goat</b> appears instead and
        points to what to fix.
      </>,
    ],
  },
];

const QUICK = [
  "Pick your server on the Server Calendar so the season end is right.",
  "Fill from screenshots (or type your numbers in), then tap Fill the planner.",
  "Enter Primostars you have and the Total you want: pick an Astral Pact tier.",
  "Check Plan my goal at the top of System levels and tap Use this plan.",
  "Out of reach? Lower the goal with one tap, or add Realm refreshes and Cart income.",
];

export function PlannerGuidePage() {
  return (
    <div className="tool guide">
      <section className="card">
        <h2 className="subhead">Quick start</h2>
        <ol className="guide-quick">
          {QUICK.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
        <p className="guide-links">
          <a className="spin-button" href="#/planner">
            Open the Season Planner →
          </a>
        </p>
        <nav className="guide-toc" aria-label="Guide sections">
          {STEPS.map((s, i) => (
            <a key={s.id} href={`#/guide?${s.id}`} onClick={(e) => jump(e, s.id)}>
              {i + 1}. {s.title}
            </a>
          ))}
        </nav>
      </section>

      <section className="card">
        <ol className="dawn-uses guide-steps">
          {STEPS.map((s, i) => (
            <li key={s.id} id={`guide-${s.id}`}>
              <span className="dawn-rank" aria-hidden>
                {i + 1}
              </span>
              <div>
                <div className="dawn-title">
                  <h3>{s.title}</h3>
                </div>
                <p className="deal-verdict">{s.intro}</p>
                <ul>
                  {s.points.map((p, j) => (
                    <li key={j}>{p}</li>
                  ))}
                </ul>
                {s.tip && <p className="hint">💡 {s.tip}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2 className="subhead">Good to know</h2>
        <ul className="guide-notes">
          <li>Everything you enter is saved in this browser only. "Clear planner" at the bottom of the planner starts over.</li>
          <li>Numbers accept K, M and B (like 605K or 1.53M), the way the game shows them.</li>
          <li>Redo your screenshots every few days: your rates and stockpiles change, and so does the best plan.</li>
          <li>Material, Realm and shop amounts are estimates from the game's data, so leave yourself a little room.</li>
        </ul>
        <p className="guide-links">
          <a className="spin-button" href="#/planner">
            Open the Season Planner →
          </a>
        </p>
      </section>
    </div>
  );
}

/** Section links scroll within the page without changing the route. */
function jump(e: React.MouseEvent, id: string) {
  e.preventDefault();
  document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
