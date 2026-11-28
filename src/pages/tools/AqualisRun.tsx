// Aqualis opening run (Season 1): the order to work in when Aqualis opens at a daily reset.
// Words live in src/i18n (pr.aq.*, step tags in pr.tag.*).
import { MILESTONES, publicServerDay } from "../../data/calendar";
import { dayDate } from "../../lib/calendar";
import type { MessageKey } from "../../i18n/en";
import type { Guide, GuideContext, GuideStep } from "./PrepGuide";

/** Server day Aqualis opens (as the calendar shows it), from the calendar's milestone data. */
export const AQUALIS_DAY = publicServerDay(MILESTONES.find((m) => m.title.startsWith("Aqualis"))?.day ?? 12);

/** When Aqualis opens for a server with this Day 1. */
export const aqualisOpens = (day1: Date) => dayDate(day1, AQUALIS_DAY);

/** Steps after Aqualis opens: [id, tag, number of items]. */
const OPEN_STEPS: [string, string, number][] = [
  ["upgrade", "atReset", 2],
  ["push1", "firstRun", 4],
  ["bed", "backAtBase", 2],
  ["push2", "secondRun", 2],
  ["finish", "cleanup", 2],
  ["wind", "doneExploring", 2],
];

export function aqualisGuide(opens: Date | null, { name, t }: GuideContext): Guide {
  const k = (key: string) => t(key as MessageKey);
  const step = ([id, tag, n]: [string, string, number]): GuideStep => ({
    title: k(`pr.aq.${id}.title`),
    tag: k(`pr.tag.${tag}`),
    items: Array.from({ length: n }, (_, i) => k(`pr.aq.${id}.i${i + 1}`)),
  });
  return {
    at: opens,
    event: t("pr.aq.event"),
    eventPast: t("pr.aq.eventPast"),
    pickHint: t("pr.aq.pickHint", { day: AQUALIS_DAY }),
    timeline: [
      { whenText: t("pr.tag.nightBefore"), label: t("pr.aq.tlPark") },
      ...(opens ? [{ at: opens, label: t("pr.aq.tlOpens") }] : []),
    ],
    rule: { icon: "🌊", title: t("pr.aq.ruleTitle"), text: t("pr.aq.ruleText") },
    phases: [
      { title: t("pr.aq.before"), steps: [step(["position", "nightBefore", 2])] },
      {
        title: t("pr.aq.when"),
        at: opens,
        note: opens ? t("pr.inOrderNamed", { name }) : t("pr.inOrder"),
        steps: OPEN_STEPS.map((s) =>
          s[0] === "wind" ? { ...step(s), link: { href: "/timer", label: t("pr.aq.wind.link") } } : step(s),
        ),
      },
    ],
  };
}
