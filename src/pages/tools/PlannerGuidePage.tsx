// How to use the Season Planner: step by step, in the order of the planner's cards.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GameIcon } from "../../components/GameIcon";

interface Step {
  id: string;
  title: string;
  /** Short name for the step menu. */
  short: string;
  /** A game icon (public/art/icons) or an emoji. */
  icon: string;
  intro: ReactNode;
  points: ReactNode[];
  /** Extra fields that only Full mode asks for. */
  full?: ReactNode[];
  tip?: ReactNode;
}

const STEPS: Step[] = [
  {
    id: "mode",
    short: "Simple or Full",
    icon: "⚙️",
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
      <>
        On a <b>phone</b> the planner goes one step at a time: <b>Goal → Character → Levels → Materials → Each day</b>. Use the step bar at the
        top or <b>Next</b> at the bottom of each card. The bar at the bottom of the screen jumps to your projection.
      </>,
    ],
  },
  {
    id: "screenshots",
    short: "Screenshots",
    icon: "📷",
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
    short: "Season & goal",
    icon: "primostar",
    title: "Season & goal",
    intro: "Tell the planner where you are and where you want to be.",
    points: [
      <>
        <b>Primostars you have:</b> the total you've filled so far, across every season.
      </>,
      <>
        <b>Total you want:</b> your goal. The hint under it names the Astral Pact bonus that total unlocks, or the next one above it. Aiming for
        a bonus tier is usually the point. See the last step.
      </>,
      <>
        <b>Season ends:</b> filled in from your server on the <a href="/calendar">Server Calendar</a>. Without a server it guesses 14 days, so
        pick yours. Everything depends on how much time is left.
      </>,
      <>
        <b>Save bed EXP</b> and <b>Save Cart resources</b> for next season are on by default (36 hours each), as nearly every player
        should do this. The planner tells you when to stop claiming the bed and the Cart, and leaves those hours out of this season. Untick
        them if you won't save.
      </>,
    ],
    full: [<>Your daily reset time and boost hours per reset.</>],
  },
  {
    id: "character",
    short: "Character EXP",
    icon: "character",
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
    ],
    full: [<>Goddess statues (+1% EXP each) and how many new ones you'll get a day.</>],
  },
  {
    id: "systems",
    short: "System levels",
    icon: "gear",
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
    ],
    full: [
      <>
        Each system lists every slot, and the <b>Set every…</b> row sets them all to one level at once.
      </>,
    ],
  },
  {
    id: "income",
    short: "Cart & materials",
    icon: "ore",
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
    ],
    full: [<>A "Shop + other / day" column for anything else you get daily, and Fantomon EXP per treat.</>],
  },
  {
    id: "daily",
    short: "Each day",
    icon: "essence",
    title: "Each day",
    intro: "What you do every day to top up materials.",
    points: [
      <>
        <b>Material Realms:</b> how many Dawnium refreshes you buy for each Realm a day, written Ore/Rola/Essence/Sand (like 2/2/2/2 or
        4/2/4/4). The planner suggests a split <b>to reach your goal</b> and one <b>for your planned levels</b>, next to the usual presets,
        each with its Dawnium cost a day and by season end. Tap one to use it (then tap <b>Use this plan</b> again so the levels match), or set
        each Realm yourself. See the <a href="/dawnium">Dawnium Guide</a> for advice.
      </>,
      <>
        <b>Home Shop:</b> refreshes a day. The shop only spends Rola you have spare, after upgrades.
      </>,
      <>
        <b>Realm tools saved up:</b> Hammers, Pickaxes, Knuckles and Shovels already in your Backpack.
      </>,
    ],
    full: [
      <>Daily tasks, Rola bought with Dawnium, and your rank (sets Realm, gathering and shop amounts).</>,
      <>
        <b>Stamina &amp; gathering</b>: what percent of your Stamina goes to Rola, Ore, Sand and Essence, plus shared Grand Mines. The{" "}
        <b>By season end</b> column shows what that gathers.
      </>,
    ],
  },
  {
    id: "results",
    short: "The projection",
    icon: "relic",
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

/** Every button and link worth knowing, and where it sits. */
const WHERE: { what: string; href?: string; where: string; does: string }[] = [
  { what: "Season Planner", href: "/planner", where: "The menu, under Plan (on phones, the Planner tab at the bottom)", does: "Opens the planner." },
  { what: "This guide", where: "The 📖 banner at the very top of the planner", does: "Comes back here." },
  {
    what: "Clear planner",
    where: "Top right of the planner, beside the guide banner, and again at the very bottom",
    does: "Empties your goal, levels, plan, materials and Realm choices (it asks first). Your character, server and Simple/Full stay.",
  },
  { what: "Simple / Full", where: "The switch at the top of the planner", does: "How much the planner asks for." },
  { what: "Fill from screenshots", where: "Just under Simple / Full", does: "Reads your game screenshots." },
  { what: "How to take the screenshots", where: "Inside Fill from screenshots, at the top", does: "Where each screen is in the game, with examples." },
  { what: "Add more screenshots / Start over", where: "Inside Fill from screenshots, after you pick some", does: "Add another screenshot, or clear the list." },
  {
    what: "Fill the planner",
    where: "Under Check what was found (top and bottom of the list)",
    does: "Puts what was read into the planner. Nothing goes in until you tap it.",
  },
  {
    what: "Server Calendar", href: "/calendar",
    where: "The menu, under Plan (on phones, the Calendar tab). Before you've picked one, there's also a Pick your server link under Season ends",
    does: "Sets your server, which sets the season end and reset time.",
  },
  { what: "Plan my goal / Use this plan", where: "The box at the top of the System levels card", does: "The cheapest way to your goal; fills every Plan box." },
  { what: "Lower goal to …", where: "Inside Plan my goal, when the goal is out of reach", does: "Sets a goal you can reach, or the best Astral Pact tier within it." },
  { what: "Fill min", where: "Beside each system in System levels", does: "Puts the rest of your goal on that one system." },
  {
    what: "Realm suggestions",
    where: "Each day card → Material Realms",
    does: "Suggested refreshes (Ore/Rola/Essence/Sand) to reach your goal, plus presets, with Dawnium costs. Tap one to use it.",
  },
  { what: "Dawnium Guide", href: "/dawnium", where: "The menu, under Info (on phones, under More), or the link under Material Realms", does: "Where Dawnium does the most good." },
  {
    what: "See all bonuses (Astral Pact)",
    where: "The projection panel, under the Primostars total",
    does: "The full bonus table. Aim for this on a row makes it your goal.",
  },
  {
    what: "Jump to the projection",
    where: "On a phone: the bar fixed at the bottom of the screen (+N Primostars)",
    does: "Scrolls down to the results.",
  },
  { what: "Level Timer", href: "/timer", where: "The menu, under Plan (on phones, the Timer tab)", does: "When you'll reach your next level, with bed boosts and Temporal Crystals. It has its own Fill from screenshots (Character and Bed only), and shares your character with the planner." },
];

/** The quick start, as a path. Each stop links to the step that explains it. */
const QUICK: { text: string; step: string; icon: string }[] = [
  { text: "Pick your server on the Server Calendar so the season end is right.", step: "goal", icon: "🗓️" },
  { text: "Fill from screenshots (or type your numbers in), then tap Fill the planner.", step: "screenshots", icon: "📷" },
  { text: "Enter Primostars you have and the Total you want: pick an Astral Pact tier.", step: "goal", icon: "primostar" },
  { text: "Check Plan my goal at the top of System levels and tap Use this plan.", step: "systems", icon: "gear" },
  { text: "Out of reach? Lower the goal with one tap, or add Realm refreshes and Cart income.", step: "daily", icon: "essence" },
];

const SHOTS = [
  ["character", "Character"],
  ["bed", "Bed"],
  ["cart", "Cart"],
  ["progression", "Season → Progression"],
  ["backpack", "Backpack"],
] as const;

const NOTES = [
  <>
    Everything you enter is saved in this browser only. <b>Clear planner</b> (top right of the planner, or at the very bottom) starts over.
  </>,
  <>Numbers accept K, M and B (like 605K or 1.53M), the way the game shows them.</>,
  <>Redo your screenshots every few days: your rates and stockpiles change, and so does the best plan.</>,
  <>Material, Realm and shop amounts are estimates from the game's data, so leave yourself a little room.</>,
];

function StepIcon({ icon }: { icon: string }) {
  return /^[a-z]/i.test(icon) ? <GameIcon name={icon} /> : <span className="guide-emoji" aria-hidden>{icon}</span>;
}

/** The planner's own Simple/Full choice, so the guide opens the way the planner is set. */
function plannerMode(): "simple" | "full" {
  try {
    return JSON.parse(localStorage.getItem("sxs.planner") || "{}").mode === "full" ? "full" : "simple";
  } catch {
    return "simple";
  }
}

export function PlannerGuidePage() {
  const [mode, setMode] = useState<"simple" | "full">(plannerMode);
  const [active, setActive] = useState(STEPS[0].id);
  const [query, setQuery] = useState("");

  // Highlight the step being read in the step menu.
  useEffect(() => {
    const els = STEPS.map((st) => document.getElementById(`guide-${st.id}`)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (seen) setActive(seen.target.id.replace("guide-", ""));
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  // Keep the highlighted step visible when the step menu is a sideways strip.
  const rail = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const ol = rail.current;
    const a = ol?.querySelector<HTMLElement>("[aria-current]");
    if (!ol || !a || ol.scrollWidth <= ol.clientWidth) return;
    ol.scrollTo({ left: a.offsetLeft - ol.clientWidth / 2 + a.offsetWidth / 2, behavior: "smooth" });
  }, [active]);

  const q = query.trim().toLowerCase();
  const found = q ? WHERE.filter((w) => `${w.what} ${w.where} ${w.does}`.toLowerCase().includes(q)) : WHERE;

  return (
    <div className="tool guide">
      <section className="card guide-hero">
        <div className="guide-hero-head">
          <div>
            <p className="eyebrow">Five minutes to a plan</p>
            <h2>Quick start</h2>
          </div>
          <a className="spin-button" href="/planner">
            Open the Season Planner →
          </a>
        </div>
        <ol className="guide-path">
          {QUICK.map((qk, i) => (
            <li key={qk.text}>
              <a href={`/guide?${qk.step}`} onClick={(e) => jump(e, qk.step)}>
                <span className="guide-path-icon">
                  <StepIcon icon={qk.icon} />
                  <b aria-hidden>{i + 1}</b>
                </span>
                <span>{qk.text}</span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <div className="guide-body">
        <nav className="guide-rail" aria-label="Guide steps">
          <div className="guide-view" role="group" aria-label="Show the guide for">
            <span>Show me</span>
            <span className="yn">
              <button type="button" aria-pressed={mode === "simple"} onClick={() => setMode("simple")}>Simple</button>
              <button type="button" aria-pressed={mode === "full"} onClick={() => setMode("full")}>Full</button>
            </span>
          </div>
          <ol ref={rail}>
            {STEPS.map((st, i) => (
              <li key={st.id}>
                <a href={`/guide?${st.id}`} aria-current={active === st.id ? "step" : undefined} onClick={(e) => jump(e, st.id)}>
                  <b>{i + 1}</b>
                  {st.short}
                </a>
              </li>
            ))}
            <li>
              <a href="/guide?where" onClick={(e) => jump(e, "where")}>
                <b>?</b>
                Find a button
              </a>
            </li>
          </ol>
        </nav>

        <div className="guide-main">
          {STEPS.map((st, i) => (
            <section key={st.id} id={`guide-${st.id}`} className="card guide-step">
              <header>
                <span className="guide-step-icon">
                  <StepIcon icon={st.icon} />
                </span>
                <div>
                  <p className="eyebrow">Step {i + 1} of {STEPS.length}</p>
                  <h2>{st.title}</h2>
                </div>
              </header>
              <p className="guide-intro">{st.intro}</p>
              {st.id === "screenshots" && (
                <ul className="guide-shots">
                  {SHOTS.map(([file, label]) => (
                    <li key={file}>
                      <img src={`${import.meta.env.BASE_URL}art/screens/${file}.jpg`} alt={`Example ${label} screenshot`} loading="lazy" />
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
              )}
              <ul className="guide-points">
                {st.points.map((pt, j) => (
                  <li key={j}>{pt}</li>
                ))}
              </ul>
              {st.full &&
                (mode === "full" ? (
                  <div className="guide-full">
                    <span className="guide-full-tag">Full mode adds</span>
                    <ul className="guide-points">
                      {st.full.map((pt, j) => (
                        <li key={j}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <button type="button" className="guide-full-more" onClick={() => setMode("full")}>
                    + {st.full.length} more field{st.full.length > 1 ? "s" : ""} in Full mode
                  </button>
                ))}
              {st.tip && <p className="guide-tip">💡 {st.tip}</p>}
            </section>
          ))}

          <section className="card" id="guide-where">
            <div className="guide-where-head">
              <div>
                <p className="eyebrow">Can't find it?</p>
                <h2 className="subhead">Every button, and where it is</h2>
              </div>
              <input type="search" placeholder="Search, e.g. Fill min" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search buttons" />
            </div>
            <ul className="guide-finder">
              {found.map((w) => (
                <li key={w.what}>
                  <b>{w.href ? <a href={w.href}>{w.what}</a> : w.what}</b>
                  <span className="guide-finder-where">📍 {w.where}</span>
                  <span>{w.does}</span>
                </li>
              ))}
              {!found.length && <li className="hint">Nothing matches "{query}".</li>}
            </ul>
          </section>

          <section className="card">
            <h2 className="subhead">Good to know</h2>
            <div className="tip-tiles">
              {NOTES.map((n, i) => <p key={i}>{n}</p>)}
            </div>
            <p className="guide-links">
              <a className="spin-button" href="/planner">
                Open the Season Planner →
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Section links scroll within the page without changing the route. */
function jump(e: React.MouseEvent, id: string) {
  e.preventDefault();
  document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
