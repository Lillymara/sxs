// Aqualis opening run: the order to work in when Aqualis opens at a daily reset, timed for the saved server.
import { MILESTONES, publicServerDay } from "../../data/calendar";
import type { ReactNode } from "react";
import { dayDate } from "../../lib/calendar";

/** Server day Aqualis opens (as the calendar shows it), from the calendar's milestone data. */
export const AQUALIS_DAY = publicServerDay(MILESTONES.find((m) => m.title.startsWith("Aqualis"))?.day ?? 12);

/** When Aqualis opens for a server with this Day 1. */
export const aqualisOpens = (day1: Date) => dayDate(day1, AQUALIS_DAY);

const RUN: { title: string; tag: string; items: string[] }[] = [
  { title: "Before reset", tag: "The night before", items: ["Park at the Cinder Ridge Nexus.", "Wait on the character screen."] },
  { title: "At reset", tag: "Aqualis opens", items: ["Upgrade Elite 3 → Expert 1.", "Enter Cinder Ridge, tap the Nexus and skip the dialogue."] },
  {
    title: "Push to your first wall",
    tag: "First run",
    items: [
      "Race through the Aqualis areas.",
      "Only do side areas if they're just pick-ups and the shrine.",
      "Stop at your level wall (around Lv 72–76).",
      "Then sweep the side areas: use your drills, keys and Withering Potions.",
    ],
  },
  {
    title: "Level up at the bed",
    tag: "Back at base",
    items: ["Use EXP items and the free burst, but only up to the wall's level.", "Skip it if you'd get there naturally in under 2 hours."],
  },
  { title: "Push to your next wall", tag: "Second run", items: ["Explore everything up to the next wall.", "Spend leftover EXP items and the bed boost."] },
  {
    title: "Finish the map",
    tag: "Cleanup",
    items: ["Clear the puzzle areas.", "Do your Relic pulls on Aqualis, or keep pulling Verdantglade and Cinder Ridge to about 50–70%."],
  },
  { title: "Wind down", tag: "Done exploring", items: ["Check when your next level unlocks and set an alarm.", "Then accept party invites and do your dailies at your own pace."] },
];

export function AqualisRun({ label }: { label: ReactNode }) {
  return (
    <section className="card">
      <h2 className="subhead">Aqualis opening run</h2>
      <p className="hint">{label}</p>
      <div className="pulls-reminder" style={{ margin: "12px 0 16px" }}>
        <span aria-hidden>🌊</span>
        <div>
          <h3>Hold party invites until exploration is maxed</h3>
          <p style={{ fontStyle: "normal" }}>Exploring first gets you the most EXP. Accept invites once the map is done.</p>
        </div>
      </div>
      <ol className="dawn-uses">
        {RUN.map((s, i) => (
          <li key={s.title}>
            <span className="dawn-rank" aria-hidden>
              {i + 1}
            </span>
            <div>
              <div className="dawn-title">
                <h3>{s.title}</h3>
                <span className="chip">{s.tag}</span>
              </div>
              <ul>
                {s.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
              {i === RUN.length - 1 && (
                <p className="hint deal-link">
                  <a href="/timer">Level Timer → when your next level unlocks →</a>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
