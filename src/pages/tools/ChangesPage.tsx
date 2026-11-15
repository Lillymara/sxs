// What's new: recent changes, newest first, written for players.

export const CHANGES: { date: string; items: { text: string; href?: string }[] }[] = [
  {
    date: "2026-11-15",
    items: [
      { text: "Spending Guide redesigned: a \"buy in this order\" path, every deal rated with a value meter (tap one for the details), and a Deal check: answer four yes/no questions about a pack and it tells you whether to buy, think twice or skip.", href: "/spending" },
      { text: "Planner Guide redesigned: a quick-start path, a step menu that follows you as you read, a Simple/Full switch that hides the Full-only fields, the example screenshots, and a search for any button in the planner.", href: "/guide" },
      { text: "Dawnium Guide redesigned: the Realm refresh table and calculator are now one chart. Tap the boxes for each Realm to set your refreshes and see the daily and weekly Dawnium.", href: "/dawnium" },
    ],
  },
  {
    date: "2026-11-14",
    items: [
      { text: "New Fantomons: Mumpkin and Hexitty. New companions: Pera, Iron Clod, and six from Aeperis (Scarlett, Lucille, Zenith, Lumi, Elio, Avery). Their numbers come from Purrwikimania (purrwikimania.com) until the game data we use catches up.", href: "/fantomons" },
      { text: "Fantomons page redesigned: a collection gallery, evolution art, role, movement, shards to summon, a Fantasmia meter, skill icons, and one quality switch and level slider for every skill.", href: "/fantomons" },
      { text: "Fixed: Fantomon skills at Mythic and above showed Epic-level numbers. Every quality now uses the right values.", href: "/fantomons" },
      { text: "Companions page redesigned: portrait gallery by class, favourite gift items, a friendship slider and a growth chart for each stat.", href: "/companions" },
      { text: "Fantomons: each profile shows its ability-tree material (Eggs for Tanks, Wool for DPS, Essence for Supports), and the role filters carry the matching icon.", href: "/fantomons" },
      { text: "World Map: a bigger map with floating zoom buttons, and a \"Mark opened\" mode where one click marks a blockade. Marking no longer resets or jumps your zoom, and trackpad zoom is smoother.", href: "/map" },
      { text: "Gem icons beside the Astral Pact bonuses." },
      { text: "Level Timer: a progress ring around your next level, and numbers that count up when they change.", href: "/timer" },
      { text: "Season Planner: a Primostar track showing what you have, what this season adds, your goal and every Astral Pact tier along the way.", href: "/planner" },
      { text: "Season Planner: bars under each material showing how much of your plan is covered, and on phones the planner goes step by step.", href: "/planner" },
      { text: "The planner fits better when your browser window is half a screen wide." },
      { text: "Game icons (art by Boltray Games): Rola, Ore, Essence, Sand, Treats, Refined Ore, Primostars and the Gear, Skill, Fantomon and Relic badges now show beside their names in the planner.", href: "/planner" },
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
