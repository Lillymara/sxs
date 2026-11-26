// Number, date and duration formatting in the chosen language, for helpers that run outside React
// (formatDuration, formatEta, countdowns). The I18nProvider updates this whenever the language changes,
// and every component re-renders with it, so they always read the current setting.

type Unit = "d" | "h" | "m";
let state: { locale: string | undefined; units: Record<Unit | "ready", string> } = {
  locale: undefined,
  units: { d: "{n}d", h: "{n}h", m: "{n}m", ready: "Ready now" },
};

export function setFormat(locale: string, units: Record<Unit | "ready", string>) {
  state = { locale, units };
}

/** The chosen language for Intl formatting (undefined until set: the browser's own). */
export const formatLocale = () => state.locale;

/** "3h", "3 Std", "3 ч"… */
export const unitText = (unit: Unit, n: number) => state.units[unit].replace("{n}", n.toLocaleString(state.locale));

export const readyText = () => state.units.ready;
