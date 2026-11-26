// What's new: recent changes, newest first, written for players.

export const CHANGES: { date: string; items: { text: string; href?: string }[] }[] = [
  {
    date: "2026-11-26",
    items: [
      { text: "Languages: the site now speaks Español, Português, Русский, Deutsch and Français. Tap the globe at the top to switch; it starts in your device's language. The menus, page titles and home page are translated so far, with the tools themselves coming next. Game names (Primostars, Dawnium, skills, Fantomons) stay in English for now." },
    ],
  },
  {
    date: "2026-11-22",
    items: [
      { text: "Season Prep has tabs now, one per guide (Aqualis opening, Season 1 → 2), and opens on whichever is next for your server. Pick or change your server right at the top to line every time up with it. Both guides share one layout: key times, the one rule to remember, then short Before and When steps.", href: "/prep" },
      { text: "Season Prep: the Aqualis opening run, a seven-step order for the morning Aqualis opens (server day 11, at the daily reset), timed for your server. It sits at the top of the page while Aqualis is still coming on your server.", href: "/prep" },
      { text: "Season Prep: save your Stamina for the last 36 hours (daily quests only, since gathering pays more once you rank up in the new season), and skip your dungeon runs on the last day so you can run the new dungeon 6 times on day one. Launch morning now says to explore as far as you can to claim statues.", href: "/prep" },
    ],
  },
  {
    date: "2026-11-21",
    items: [
      { text: "Season Prep: what to do first when Season 2 starts, and which levels are worth spending Speed-Ups to reach (from eog.gg's Season 2 prep guide).", href: "/prep" },
      { text: "New Guides section in the menu: Season Prep (what to do as a season ends, with the exact times to stop claiming the bed and the Cart on your server), the Spending Guide and the Dawnium Guide.", href: "/prep" },
      { text: "Server Calendar: 28 new servers (Nexus 70046 and 70047, up to Faerie Inn), plus opening dates for the rest of 70044 and 70045, so those servers' calendars work now. The server list now updates twice a week from the community's SxS All In One Database sheet. Thanks to everyone who keeps it up to date.", href: "/calendar" },
      { text: "Loadouts on phones: My loadouts now sits right under the builder instead of below the whole skill list, a Back to loadout button stays in reach while you pick, and the rank stars are bigger.", href: "/loadouts" },
      { text: "Spending Guide: cosmetics have their own section instead of \"Usually skip\". They're some of the most fun things to own and can be gifted to friends, though they only nudge your Visage score.", href: "/spending" },
      { text: "Season Planner on phones: the material balance table fits without sideways scrolling, so the Left column is visible; Realm refresh picks are two per row.", href: "/planner" },
      { text: "Spending Guide: the Monthly Card is now called by its in-game name, Monthly Pass; the Month Fund / Growth Fund entry is now the Pilgrimage Pass, with a new entry for the occasional long-term growth passes ($10, $15 or $20, always a good buy); and the Weekly Card is the 7-Day Prayer, the weekly pass in the same shop section as the Monthly Pass.", href: "/spending" },
      { text: "On phones: World Map names no longer pile on top of each other, the Dawnium calculator's boxes are easier to tap, the server picker on Fantomons and Companions folds into one line, and small card text is larger.", href: "/map" },
      { text: "Dawnium Guide: removed Shop refreshes, since those cost Rola, not Dawnium.", href: "/dawnium" },
      { text: "Server Calendar: every event now says when it unlocks, at the daily reset in your time and in server time (8:00 AM, UTC−5), with a countdown on the day (\"Unlocks in 2h 14m\") and \"Live now\" once it's open. The home page no longer says \"Now\" for things that only open at reset later today.", href: "/calendar" },
      { text: "Moonmoth Vale (Nexus 70048 #2, opened Nov 18) is in the server list ahead of the community sheet, with its one-day shift built in. If you'd added it yourself, your pick switches to this one and your calendar stays the same.", href: "/calendar" },
      { text: "Server not listed yet? Type its name in Find your server and pick \"Add as a new server\" to enter its name and Day 1 yourself. It's saved only in your browser, and once the community list has it, your pick switches over on its own.", href: "/calendar" },
    ],
  },
  {
    date: "2026-11-18",
    items: [
      { text: "Calendar: Godspire, Crimson Fort, Ancient Ruin and Mistwaste run a day later than their opening date (Season 1 is a day longer), so their dates now line up without adjusting. If you added a day yourself, set it back to 0 days.", href: "/calendar" },
    ],
  },
  {
    date: "2026-11-16",
    items: [
      { text: "Fill from screenshots handles several screenshots at once more reliably: memory is freed after each one and a failed read is tried again. When a screenshot still can't be read you get a code saying why (IMG, MEM, LOAD, READ, SLOW, or CRASH if the browser closed the page part-way) and a Copy details button for a bug report.", href: "/planner" },
      { text: "Loadouts: the skill list now shows each skill's description, and the slot you're filling shows its full text plus its numbers (DMG, healing, cooldown and more). Pick a grade from Rare to Immortal and its stars to see the numbers at that rank, set to your level and combat rank. Ranks are saved with the loadout, shown on its picture and carried in share links. You can also drag skills, charms and Fantomons onto a slot, or drag one slot onto another to swap them (on a phone, press and hold first).", href: "/loadouts" },
      { text: "Loadout links now show the build in Discord: paste a link (l.lmthings.com/…) and Discord shows the loadout's name, skills, charms, Fantomon and a picture of it, no need to open the site. The Share button copies the link (and your notes) ready to paste.", href: "/loadouts" },
      { text: "Loadouts: much shorter share links (sxs.lmthings.com/l/…), a Copy picture button that draws the loadout as an image to paste in Discord (on phones it shares straight to the app), and a tidier Copy text post. Older loadout links still open.", href: "/loadouts" },
      { text: "Loadouts now look like the game's Skill screen: techniques down the left, charms down the right, your Fantomon in the middle, and the loadout's name underneath with arrows to flip through your saved loadouts. Every loadout needs a name before it's saved, and you can rename saved ones.", href: "/loadouts" },
      { text: "New: Loadouts. Pick a class, 4 skills in cast order, 4 charms and a Fantomon, add notes, and share it with a link (no sign-up; the link holds the whole build). Save your own in My loadouts, or copy a ready-made post for Discord.", href: "/loadouts" },
      { text: "Home page redesigned: a Your season panel with rings for your level, season time left, Primostars against your goal and the daily reset, what's coming up on your server, and the tools grouped with game art." },
    ],
  },
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
