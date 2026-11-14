// What's new: recent changes, newest first, written for players.

export const CHANGES: { date: string; items: { text: string; href?: string }[] }[] = [
  {
    date: "2026-11-14",
    items: [
      { text: "Level Timer: a progress ring around your next level, and numbers that count up when they change.", href: "/timer" },
      { text: "Season Planner: a Primostar track showing what you have, what this season adds, your goal and every Astral Pact tier along the way.", href: "/planner" },
      { text: "Season Planner: bars under each material showing how much of your plan is covered, and on phones the planner goes step by step.", href: "/planner" },
      { text: "The planner fits better when your browser window is half a screen wide." },
      { text: "Game icons: Rola, Ore, Essence, Sand, Treats, Refined Ore, Primostars and the Gear, Skill, Fantomon and Relic badges now show beside their names in the planner.", href: "/planner" },
      { text: "Level Timer: the cards now fill the page's full width, with your level-up time on top." },
      { text: "No more empty result boxes: your level-up time shows at the top of the Level Timer as soon as it's filled in, and the planner's Primostar bar stays in view whenever the projection is below the form.", href: "/timer" },
    ],
  },
  {
    date: "2026-11-13",
    items: [
      { text: "New home, new name: the site is now SxS Tools by LM Things at sxs.lmthings.com. Old links forward here and bring your saved data with them." },
      { text: "A home page with your numbers at a glance and a season clock, a new menu (a sidebar, or tabs at the bottom on phones), and a new logo that follows your colour theme.", href: "/" },
      { text: "Join the Discord for announcements, bug reports and ideas.", href: "https://discord.gg/3YBBXcEk5n" },
      { text: "Install the site as an app on your phone or computer (in the menu). It opens offline too." },
      { text: "Level Timer: fill it from your Character and Bed screenshots.", href: "/timer" },
      { text: "Season Planner: copy your plan as a message for Discord.", href: "/planner" },
      { text: "Season Planner: a season progress log that shows whether you're keeping pace with your goal.", href: "/planner" },
    ],
  },
  {
    date: "2026-11-11",
    items: [
      { text: "Season Planner: fill it from game screenshots (Character, Bed, Cart, Season progression and Backpack).", href: "/planner" },
      { text: "Plan my goal: the cheapest way to your Primostar goal with the materials you'll have, and a one-tap lower goal if it's out of reach." },
      { text: "Caps follow your projected season-end level: Skills to your level, Fantomons to the next 10, Relics to a tenth plus one." },
      { text: "Astral Pact bonus table, with every tier marked as yours, this season, or your goal." },
      { text: "Material Realm suggestions (Ore/Rola/Essence/Sand) with their Dawnium cost." },
      { text: "Save bed EXP and Cart resources for next season, on by default." },
      { text: "Refined Ore in the material balance, Simple/Full modes, and a step-by-step planner guide.", href: "/guide" },
    ],
  },
  {
    date: "2026-10-24",
    items: [{ text: "Level Timer: the free daily bed boost and Temporal Crystals count toward your next level.", href: "/timer" }],
  },
  {
    date: "2026-10-22",
    items: [
      { text: "New Dawnium Guide: the best uses, in order, with Realm refresh prices.", href: "/dawnium" },
      { text: "World Map: mark blockades as opened and track the unlock items you still need.", href: "/map" },
    ],
  },
  {
    date: "2026-10-20",
    items: [{ text: "Level Timer: see the level banked EXP takes you to when the next area opens.", href: "/timer" }],
  },
  {
    date: "2026-10-19",
    items: [
      { text: "New Spending Guide: which shop deals are worth it, if you spend.", href: "/spending" },
      { text: "World Map: corrected Lucky Wheel and blockade positions, and a Show-on-map filter.", href: "/map" },
    ],
  },
  {
    date: "2026-10-17",
    items: [{ text: "The site opens: Level Timer, Season Planner, Server Calendar, Class Change, Fantomons, Companions and World Map." }],
  },
];

const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

export function ChangesPage() {
  return (
    <div className="tool changes">
      {CHANGES.map((c) => (
        <section className="card" key={c.date}>
          <h2 className="subhead">{day(c.date)}</h2>
          <ul className="change-list">
            {c.items.map((it) => (
              <li key={it.text}>
                {it.text}
                {it.href && (
                  <>
                    {" "}
                    <a href={it.href} {...(it.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
                      Open →
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
