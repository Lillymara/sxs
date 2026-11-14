// Site navigation: a sidebar on wide screens; on phones, a bottom tab bar with the main tools and a
// "More" sheet listing everything.
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Logo } from "./Logo";

export interface NavPage {
  id: string;
  group: string;
  label: string;
  icon: IconName;
  hidden?: boolean;
}

export const hrefOf = (id: string) => (id === "home" ? "/" : `/${id}`);

/** The tools in the phone tab bar; everything else is under More. */
const TAB_BAR = ["home", "timer", "planner", "calendar"];

export function Brand() {
  return (
    <a className="brand" href="/">
      <Logo size={34} />
      <span>
        SxS Tools
        <small>by LM Things</small>
      </span>
    </a>
  );
}

function NavLinks({ pages, current, onPick }: { pages: NavPage[]; current: string; onPick?: () => void }) {
  const groups = [...new Set(pages.filter((p) => !p.hidden && p.group).map((p) => p.group))];
  return (
    <>
      {pages
        .filter((p) => !p.group && !p.hidden)
        .map((p) => (
          <NavLink key={p.id} p={p} current={current} onPick={onPick} />
        ))}
      {groups.map((g) => (
        <div key={g} className="nav-group">
          <p className="nav-group-label">{g}</p>
          {pages
            .filter((p) => p.group === g && !p.hidden)
            .map((p) => (
              <NavLink key={p.id} p={p} current={current} onPick={onPick} />
            ))}
        </div>
      ))}
    </>
  );
}

function NavLink({ p, current, onPick }: { p: NavPage; current: string; onPick?: () => void }) {
  return (
    <a href={hrefOf(p.id)} className="nav-link" aria-current={p.id === current ? "page" : undefined} onClick={onPick}>
      <Icon name={p.icon} />
      <span>{p.label}</span>
    </a>
  );
}

export function Sidebar({ pages, current, footer }: { pages: NavPage[]; current: string; footer: ReactNode }) {
  return (
    <aside className="sidebar">
      <Brand />
      <nav className="side-nav" aria-label="Tools">
        <NavLinks pages={pages} current={current} />
      </nav>
      <div className="sidebar-foot">{footer}</div>
    </aside>
  );
}

export function TabBar({ pages, current, extra }: { pages: NavPage[]; current: string; extra?: ReactNode }) {
  const [more, setMore] = useState(false);
  // Close the sheet when the page changes (a link was followed) or Escape is pressed.
  useEffect(() => setMore(false), [current]);
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [more]);
  const inBar = TAB_BAR.map((id) => pages.find((p) => p.id === id)!).filter(Boolean);
  const moreActive = !TAB_BAR.includes(current);

  return (
    <>
      <nav className="tabbar" aria-label="Main tools">
        {inBar.map((p) => (
          <a key={p.id} href={hrefOf(p.id)} aria-current={p.id === current ? "page" : undefined}>
            <Icon name={p.icon} size={22} />
            <span>{p.id === "planner" ? "Planner" : p.id === "timer" ? "Timer" : p.id === "calendar" ? "Calendar" : p.label}</span>
          </a>
        ))}
        <button type="button" aria-expanded={more} className={moreActive ? "active" : undefined} onClick={() => setMore((m) => !m)}>
          <Icon name="more" size={22} />
          <span>More</span>
        </button>
      </nav>
      {more && (
        <div className="more-sheet" role="dialog" aria-label="All tools" onClick={(e) => e.target === e.currentTarget && setMore(false)}>
          <div className="more-panel">
            <div className="more-head">
              <b>All tools</b>
              <button type="button" className="link-button" onClick={() => setMore(false)}>
                Close
              </button>
            </div>
            <nav className="side-nav">
              <NavLinks pages={pages} current={current} onPick={() => setMore(false)} />
            </nav>
            {extra && <div className="more-extra">{extra}</div>}
          </div>
        </div>
      )}
    </>
  );
}
