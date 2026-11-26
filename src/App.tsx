import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from "react";
import { CharacterForm, type Character } from "./components/CharacterForm";
import { Results } from "./components/Results";
import { planSeason } from "./lib/planner/plan";
import { usePersistentState } from "./lib/storage";
import { calculate, getSeason, parseAmount as num } from "./lib/xp";
import { seasonStatus } from "./lib/calendar";
import { RESET_UTC_HOUR } from "./data/calendar";
import { DEFAULT_SERVER, effectiveDay1, localResetTime, type ServerChoice } from "./pages/calendar/server";
import { DEFAULT_PLANNER, toPlannerInput, type PlannerForm, type TimeDefaults } from "./pages/planner/form";
import { PlannerPage } from "./pages/planner/PlannerPage";
import { ScreenshotImport } from "./pages/planner/ScreenshotImport";
import { applyFound } from "./pages/planner/fromScreens";
import { ColorChooser } from "./components/ColorChooser";
import { InstallApp } from "./components/InstallApp";
import { Brand, Sidebar, TabBar } from "./components/Nav";
import type { IconName } from "./components/Icon";
import { HomePage } from "./pages/HomePage";
import { currentPath, listen } from "./lib/router";
import { DISCORD_URL } from "./data/site";
import { LanguagePicker } from "./components/LanguagePicker";
import { useT } from "./i18n";
import type { MessageKey } from "./i18n/en";
import type { ToolProps } from "./pages/tools/props";

// The calendar carries the full server roster, so it loads only when opened.
const CalendarPage = lazy(() => import("./pages/calendar/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const ConversionPage = lazy(() => import("./pages/tools/ConversionPage").then((m) => ({ default: m.ConversionPage })));
const FantomonsPage = lazy(() => import("./pages/tools/FantomonsPage").then((m) => ({ default: m.FantomonsPage })));
const CompanionsPage = lazy(() => import("./pages/tools/CompanionsPage").then((m) => ({ default: m.CompanionsPage })));
const SpendingPage = lazy(() => import("./pages/tools/SpendingPage").then((m) => ({ default: m.SpendingPage })));
const LoadoutsPage = lazy(() => import("./pages/tools/LoadoutsPage").then((m) => ({ default: m.LoadoutsPage })));
const DawniumPage = lazy(() => import("./pages/tools/DawniumPage").then((m) => ({ default: m.DawniumPage })));
const PlannerGuidePage = lazy(() => import("./pages/tools/PlannerGuidePage").then((m) => ({ default: m.PlannerGuidePage })));
const PrepPage = lazy(() => import("./pages/tools/PrepPage").then((m) => ({ default: m.PrepPage })));
const ChangesPage = lazy(() => import("./pages/tools/ChangesPage").then((m) => ({ default: m.ChangesPage })));
const WorldMapPage = lazy(() => import("./pages/tools/WorldMapPage").then((m) => ({ default: m.WorldMapPage })));

/** Self-contained reference tools, each loaded only when opened. */
const SIMPLE_PAGES = {
  conversion: ConversionPage,
  fantomons: FantomonsPage,
  companions: CompanionsPage,
  map: WorldMapPage,
  spending: SpendingPage,
  dawnium: DawniumPage,
  loadouts: LoadoutsPage,
  guide: PlannerGuidePage,
  prep: PrepPage,
  changes: ChangesPage,
};

const DEFAULT_CHARACTER: Character = {
  name: "",
  season: "1",
  level: "",
  progressMode: "xp",
  currentXp: "",
  percent: "",
  rate: "",
  goalLevel: "",
};

type Page = "home" | "timer" | "planner" | "calendar" | keyof typeof SIMPLE_PAGES;
type Group = "" | "Plan" | "Info" | "Guides";
/** `hidden` pages are reached by link only, not the menu. `blurb` is the home page tile's line. */
const PAGES: { id: Page; group: Group; label: string; icon: IconName; blurb: string; title: string; lede: string; wide?: boolean; hidden?: boolean }[] = [
  { id: "home", group: "", label: "Home", icon: "home", blurb: "", title: "SxS Tools", lede: "", wide: true },
  { id: "timer", group: "Plan", label: "Level Timer", icon: "timer", blurb: "When you'll reach your next level", title: "Level Timer", lede: "Enter your character and XP rate to see when you'll reach your next level." },
  { id: "planner", group: "Plan", label: "Season Planner", icon: "planner", blurb: "Primostars, upgrades and materials for the season", title: "Season Planner", lede: "Plan your season's Primostars, upgrades and materials, from now until the season ends.", wide: true },
  { id: "calendar", group: "Plan", label: "Server Calendar", icon: "calendar", blurb: "Your server's seasons, dungeons and events", title: "Server Calendar", lede: "Your server's day, season dates, dungeon releases, weekly events and their rewards." },
  { id: "loadouts", group: "Plan", label: "Loadouts", icon: "loadouts", blurb: "Build, save and share skill loadouts", title: "Loadouts", lede: "Pick your skills, charms and Fantomon, then share the build with a link. No sign-up: the link is the loadout.", wide: true },
  { id: "conversion", group: "Plan", label: "Class Change", icon: "conversion", blurb: "What your skills become in a new class", title: "Skills Conversion", lede: "See what each of your skills can turn into when you change class.", wide: true, hidden: true },
  { id: "fantomons", group: "Info", label: "Fantomons", icon: "fantomons", blurb: "Stats, forms and abilities", title: "Fantomons", lede: "Every Fantomon's stats, baby and adult forms, and abilities at any grade and level.", wide: true },
  { id: "companions", group: "Info", label: "Companions", icon: "companions", blurb: "Bonuses, gifts and best classes", title: "Companions", lede: "Companion stat bonuses by friendship level, favorite gifts, unlocks and the classes they suit.", wide: true },
  { id: "map", group: "Info", label: "World Map", icon: "map", blurb: "Lucky Wheels and unlockable areas", title: "World Map", lede: "Lucky Wheels, unlockable areas and their loot, region by region.", wide: true },
  { id: "guide", group: "Plan", label: "Planner Guide", icon: "guide", blurb: "", title: "How to use the Season Planner", lede: "Step by step: what each part of the planner asks for, what it does, and how to read the results.", wide: true, hidden: true },
  { id: "changes", group: "Info", label: "What's New", icon: "changes", blurb: "", title: "What's New", lede: "Recent changes to the site, newest first.", wide: true, hidden: true },
  { id: "prep", group: "Guides", label: "Season Prep", icon: "prep", blurb: "Island openings and season changes", title: "Season Prep", lede: "Step-by-step guides for each new island and season change, timed for your server.", wide: true },
  { id: "spending", group: "Guides", label: "Spending Guide", icon: "spending", blurb: "Which deals are worth it", title: "Spending Guide", lede: "If you do spend: which deals give you the most, and which to skip.", wide: true },
  { id: "dawnium", group: "Guides", label: "Dawnium Guide", icon: "dawnium", blurb: "Where Dawnium does the most good", title: "Dawnium Guide", lede: "Where your Dawnium (and Rola) does the most good, and what to skip.", wide: true },
];

const pageFromPath = (): Page => {
  const id = currentPath();
  // Short loadout links: /l/<code>.
  if (id === "l") return "loadouts";
  return PAGES.some((p) => p.id === id) ? (id as Page) : "home";
};

export default function App() {
  const [character, setCharacter] = usePersistentState<Character>("sxs.character", DEFAULT_CHARACTER);
  // Read before the planner state saves itself back with the new defaults filled in.
  const [plannerFromBeforeCartSave] = useState(() => {
    try {
      const raw = localStorage.getItem("sxs.planner");
      return !!raw && !raw.includes('"saveCart"');
    } catch {
      return false;
    }
  });
  const [planner, setPlanner] = usePersistentState<PlannerForm>("sxs.planner", DEFAULT_PLANNER);
  const [serverChoice, setServerChoice] = usePersistentState<ServerChoice>("sxs.server", DEFAULT_SERVER);
  // Planners saved before Cart saving existed: switch bed and Cart saving on once, as nearly everyone should.
  useEffect(() => {
    if (plannerFromBeforeCartSave) setPlanner((p) => ({ ...p, saveBed: true, saveCart: true, saveCartHours: p.saveCartHours || "36" }));
  }, [plannerFromBeforeCartSave, setPlanner]);
  const [page, setPage] = useState<Page>(pageFromPath);
  const [now, setNow] = useState(() => new Date());

  // Keep ETAs current while the page is left open.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => listen(() => setPage(pageFromPath())), []);

  const table = getSeason(Number(character.season));
  const level = num(character.level);
  const required = table && table.expToNext[level - table.minLevel];

  // A blank progress field means "just levelled"; anything else must parse.
  const orZero = (value: string) => (value.trim() === "" ? 0 : num(value));
  const currentXp =
    character.progressMode === "percent"
      ? required !== undefined
        ? (required * orZero(character.percent)) / 100
        : NaN
      : orZero(character.currentXp);

  // Boosts: the daily bed boost and Temporal Crystals are each 2 hours of EXP.
  const crystals = Math.max(0, Math.floor(num(character.crystals ?? "") || 0));
  const bedHours = character.bedBoost ? 2 : 0;
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), RESET_UTC_HOUR));
  if (nextReset <= now) nextReset.setUTCDate(nextReset.getUTCDate() + 1);
  // The reset shown in the saved server's time zone (or the device's).
  const resetLabel = (() => {
    try {
      return nextReset.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: serverChoice.timezone || undefined, timeZoneName: "short" });
    } catch {
      return nextReset.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    }
  })();
  const boosts =
    bedHours || crystals
      ? {
          nowHours: (character.bedToday !== false ? bedHours : 0) + crystals * 2,
          dailyHours: bedHours,
          hoursUntilReset: (nextReset.getTime() - now.getTime()) / 3_600_000,
        }
      : undefined;

  const goal = num(character.goalLevel);
  const ready = table && character.level !== "" && character.rate !== "";
  const outcome = ready
    ? calculate({
        table,
        level,
        currentXp,
        xpPerHour: num(character.rate),
        boosts,
        goalLevel: Number.isInteger(goal) ? goal : undefined,
      })
    : undefined;

  const day1 = effectiveDay1(serverChoice);
  const server = day1 ? { ...seasonStatus(day1, now), name: serverChoice.name } : null;
  const seasonEndTime = server?.seasonEnds?.getTime();
  const timeDefaults: TimeDefaults = useMemo(
    () => ({ seasonEnd: seasonEndTime !== undefined ? new Date(seasonEndTime) : null, resetTime: localResetTime() }),
    [seasonEndTime],
  );

  const plan = useMemo(() => {
    if ((page !== "planner" && page !== "home") || !Number.isFinite(currentXp)) return null;
    const input = toPlannerInput(character, currentXp, planner, timeDefaults, now);
    return input ? planSeason(input) : null;
  }, [page, character, currentXp, planner, timeDefaults, now]);

  const { t } = useT();
  // Page names and descriptions in the chosen language (ids and groups stay as keys).
  const pages = PAGES.map((p) => ({
    ...p,
    label: t(`page.${p.id}.label` as MessageKey),
    title: t(`page.${p.id}.title` as MessageKey),
    blurb: p.blurb && t(`page.${p.id}.blurb` as MessageKey),
    lede: p.lede && t(`page.${p.id}.lede` as MessageKey),
  }));
  const current = pages.find((p) => p.id === page)!;
  /** Clears the planner's own inputs (character, server and Simple/Full stay), after a check. */
  const clearPlanner = () => {
    if (window.confirm(t("planner.clearConfirm")))
      setPlanner({ ...DEFAULT_PLANNER, mode: planner.mode });
  };

  useEffect(() => {
    document.title = page === "home" ? "SxS Tools · Sword x Staff Tools by LM Things" : `${current.title} · SxS Tools`;
    window.scrollTo(0, 0);
  }, [current.title, page]);

  const footerTools = (
    <>
      <ColorChooser />
      <LanguagePicker />
      <InstallApp />
    </>
  );

  return (
    <div className="app">
      <Sidebar pages={pages} current={page} footer={footerTools} />
      <div className="app-main">
      <div className="topbar">
        <Brand />
        <div className="top-actions">
          <div className="top-actions-row">
            <ColorChooser />
            <LanguagePicker />
          </div>
        </div>
      </div>
      <div className={`shell ${current.wide ? "wide" : ""}`}>
      {page !== "home" && (
      <header className="masthead">
        <p className="eyebrow">{current.group && t(`group.${current.group}` as MessageKey)}</p>
        <h1>{current.title}</h1>
        <p className="lede">{current.lede}</p>
      </header>
      )}

      {page === "home" ? (
        <main>
          <HomePage
            tiles={pages.filter((p) => !p.hidden && p.id !== "home")}
            level={character.level}
            outcome={outcome}
            plan={plan}
            now={now}
            server={
              server && {
                name: server.name,
                season: server.season.number,
                day1: day1!,
                seasonEnds: server.seasonEnds,
                dayOfSeason: server.dayOfSeason,
                timezone: serverChoice.timezone,
                seasonDays: server.nextSeason ? server.nextSeason.start - server.season.start : null,
              }
            }
          />
        </main>
      ) : 
page in SIMPLE_PAGES ? (
        <main>
          <Suspense fallback={<p className="hint">{t("loading")}</p>}>
            {(() => {
              const Tool = SIMPLE_PAGES[page as keyof typeof SIMPLE_PAGES] as ComponentType<ToolProps>;
              return <Tool choice={serverChoice} onServerChange={setServerChoice} now={now} />;
            })()}
          </Suspense>
        </main>
      ) : page === "calendar" ? (
        <main>
          <Suspense fallback={<p className="hint">{t("loadingCalendar")}</p>}>
            <CalendarPage choice={serverChoice} onChange={setServerChoice} now={now} />
          </Suspense>
        </main>
      ) : page === "timer" ? (
        <main className="layout">
          <ScreenshotImport
            scope="timer"
            season={Number(character.season) || 1}
            onApply={(found) => setCharacter(applyFound(found, character, planner).character)}
          />
          <Results character={character} outcome={outcome} now={now} />
          <CharacterForm
            character={character}
            onChange={setCharacter}
            onReset={() => setCharacter({ ...DEFAULT_CHARACTER, season: character.season })}
            table={table}
            resetNote={
              <>
                {t("timer.resetNote")} <b>{resetLabel}</b>
                {serverChoice.name ? <> ({serverChoice.name}).</> : <>. <a href="/calendar">{t("timer.pickServer")}</a> {t("timer.pickServerTail")}</>}
                {" "}{t("timer.everyServer")}
              </>
            }
          />
        </main>
      ) : (
        <main>
          <PlannerPage
            character={character}
            onCharacterChange={setCharacter}
            form={planner}
            onChange={setPlanner}
            onClear={clearPlanner}
            result={plan}
            now={now}
            defaults={timeDefaults}
            server={server && { name: server.name, season: server.season.number, seasonEnds: server.seasonEnds }}
          />
          <p className="reset-row">
            <button type="button" className="link-button" onClick={clearPlanner}>
              {t("planner.clear")}
            </button>
          </p>
        </main>
      )}

      <footer className="footer">
        <p className="footer-links">
          <a href="/changes">{t("footer.whatsNew")}</a>
          <a href="/guide">{t("footer.guide")}</a>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer">
            {t("footer.discord")}
          </a>
        </p>
        <p>{t("footer.about")}</p>
      </footer>
      </div>
      </div>
      <TabBar
        pages={pages}
        current={page}
        extra={
          <>
            <LanguagePicker />
            <InstallApp />
            <a href="/changes">{t("footer.whatsNew")}</a>
            <a href={DISCORD_URL} target="_blank" rel="noreferrer">
              {t("footer.discordShort")}
            </a>
          </>
        }
      />
    </div>
  );
}
