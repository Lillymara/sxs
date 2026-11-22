// Aqualis opening run (Season 1): the order to work in when Aqualis opens at a daily reset.
import { MILESTONES, publicServerDay } from "../../data/calendar";
import { dayDate } from "../../lib/calendar";
import type { Guide, GuideContext } from "./PrepGuide";

/** Server day Aqualis opens (as the calendar shows it), from the calendar's milestone data. */
export const AQUALIS_DAY = publicServerDay(MILESTONES.find((m) => m.title.startsWith("Aqualis"))?.day ?? 12);

/** When Aqualis opens for a server with this Day 1. */
export const aqualisOpens = (day1: Date) => dayDate(day1, AQUALIS_DAY);

export function aqualisGuide(opens: Date | null, { name }: GuideContext): Guide {
  return {
    at: opens,
    event: "Aqualis opens",
    eventPast: "Aqualis opened",
    pickHint: `Pick your server above to see when Aqualis opens. It opens at the daily reset on server day ${AQUALIS_DAY}.`,
    timeline: [
      { whenText: "The night before", label: "Park at the Cinder Ridge Nexus" },
      ...(opens ? [{ at: opens, label: "Aqualis opens: upgrade, then head in" }] : []),
    ],
    rule: {
      icon: "🌊",
      title: "Hold party invites until exploration is maxed",
      text: "Exploring first gets you the most EXP. Accept invites once the map is done.",
    },
    phases: [
      {
        title: "Before Aqualis opens",
        steps: [
          {
            title: "Get in position",
            tag: "The night before",
            items: ["Park at the Cinder Ridge Nexus.", "Wait on the character screen until reset."],
          },
        ],
      },
      {
        title: "When Aqualis opens",
        at: opens,
        note: opens ? `${name}: work through these in order.` : "Work through these in order.",
        steps: [
          {
            title: "Upgrade and head in",
            tag: "At reset",
            items: ["Upgrade Elite 3 → Expert 1.", "Enter Cinder Ridge, tap the Nexus and skip the dialogue."],
          },
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
          {
            title: "Push to your next wall",
            tag: "Second run",
            items: ["Explore everything up to the next wall.", "Spend leftover EXP items and the bed boost."],
          },
          {
            title: "Finish the map",
            tag: "Cleanup",
            items: ["Clear the puzzle areas.", "Do your Relic pulls on Aqualis, or keep pulling Verdantglade and Cinder Ridge to about 50–70%."],
          },
          {
            title: "Wind down",
            tag: "Done exploring",
            items: ["Check when your next level unlocks and set an alarm.", "Then accept party invites and do your dailies at your own pace."],
            link: { href: "/timer", label: "Level Timer → when your next level unlocks" },
          },
        ],
      },
    ],
  };
}
