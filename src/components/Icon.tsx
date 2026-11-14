// Small line icons for the menu and home tiles. Drawn for this site on a 24×24 grid; they use
// currentColor so they follow the theme.
import type { ReactNode } from "react";

export type IconName =
  | "home"
  | "timer"
  | "planner"
  | "calendar"
  | "costs"
  | "conversion"
  | "fantomons"
  | "companions"
  | "map"
  | "spending"
  | "prep"
  | "dawnium"
  | "more"
  | "guide"
  | "changes"
  | "camera"
  | "star";

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 13V9M12 13l2.8 2" />
      <path d="M9.5 2.5h5M12 2.5v3" />
    </>
  ),
  planner: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 14h2M12 14h2M16 14h0.5M8 17h2M12 17h2" />
    </>
  ),
  costs: (
    <>
      <ellipse cx="10" cy="7" rx="6" ry="2.8" />
      <path d="M4 7v4c0 1.5 2.7 2.8 6 2.8s6-1.3 6-2.8V7" />
      <path d="M8 16.3c.6.3 1.3.5 2 .5M14 13.5c3.3 0 6 1.3 6 2.8v2.4c0 1.5-2.7 2.8-6 2.8s-6-1.3-6-2.8v-2.4" />
    </>
  ),
  conversion: (
    <>
      <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
    </>
  ),
  fantomons: (
    <>
      <ellipse cx="12" cy="15.5" rx="4.5" ry="4" />
      <circle cx="6" cy="10" r="1.9" />
      <circle cx="18" cy="10" r="1.9" />
      <circle cx="9.3" cy="6" r="1.9" />
      <circle cx="14.7" cy="6" r="1.9" />
    </>
  ),
  companions: (
    <>
      <circle cx="9" cy="8.5" r="3.3" />
      <path d="M3 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5" />
      <circle cx="16.5" cy="7.5" r="2.6" />
      <path d="M16.5 12.5c2.5 0 4.2 1.6 4.6 4.5" />
    </>
  ),
  map: (
    <>
      <path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </>
  ),
  spending: (
    <>
      <path d="M5 8h14l-1.2 12H6.2z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  prep: (
    <>
      <path d="M7 3h10M7 21h10" />
      <path d="M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" />
    </>
  ),
  dawnium: (
    <>
      <path d="M12 3 20 9l-8 12L4 9z" />
      <path d="M4 9h16M9 9l3 12 3-12M8.5 3.8 9 9M15.5 3.8 15 9" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
    </>
  ),
  guide: (
    <>
      <path d="M4 5.5c2.5-1.3 5.3-1.3 8 .5v14c-2.7-1.8-5.5-1.8-8-.5zM20 5.5c-2.5-1.3-5.3-1.3-8 .5v14c2.7-1.8 5.5-1.8 8-.5z" />
    </>
  ),
  changes: (
    <>
      <path d="M12 3l2.2 4.8 5.3.6-3.9 3.6 1.1 5.2L12 14.6 7.3 17.2l1.1-5.2-3.9-3.6 5.3-.6z" />
      <path d="M5 21h14" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  star: (
    <>
      <path d="M12 3.5l2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.5l-5.2 2.9 1.2-5.8-4.4-4 5.9-.7z" />
    </>
  ),
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
