// Site translations: the chosen language, a t() for plain strings, tn() for plurals and rich() for strings
// with <b>bold</b> parts. English is built in; other languages load when picked. Anything a language is
// missing falls back to English, so the site always works while translations catch up.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en, type MessageKey, type Messages } from "./en";
import { setFormat } from "./format";

export const LANGS = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
  { code: "ru", name: "Русский" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
] as const;
export type Lang = (typeof LANGS)[number]["code"];

const STORAGE_KEY = "sxs.lang";
const LOADERS: Record<Exclude<Lang, "en">, () => Promise<{ default: Messages }>> = {
  es: () => import("./es"),
  pt: () => import("./pt"),
  ru: () => import("./ru"),
  de: () => import("./de"),
  fr: () => import("./fr"),
};

const isLang = (x: unknown): x is Lang => LANGS.some((l) => l.code === x);

/** The saved choice, else the first of the device's languages we have, else English. */
export function detectLang(saved: string | null, preferred: readonly string[]): Lang {
  if (isLang(saved)) return saved;
  for (const p of preferred) {
    const base = p.toLowerCase().split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}

/** Fills "{name}" placeholders. */
export const fill = (text: string, vars?: Record<string, string | number>) =>
  vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;

/** Builds the lookup functions for one language. */
export function translator(lang: Lang, messages: Messages) {
  const get = (key: string): string => messages[key] ?? (en as Record<string, string>)[key] ?? key;
  const plurals = new Intl.PluralRules(lang);
  const t = (key: MessageKey, vars?: Record<string, string | number>) => fill(get(key), vars);
  /** Plural: looks up `${key}_${form}` (one, few, many, other) for n, with English forms as the fallback. */
  const tn = (key: string, n: number, vars?: Record<string, string | number>) => {
    const form = plurals.select(n);
    const text = messages[`${key}_${form}`] ?? messages[`${key}_other`] ?? (en as Record<string, string>)[`${key}_${n === 1 ? "one" : "other"}`] ?? key;
    return fill(text, { n, ...vars });
  };
  return { t, tn };
}

/** Turns "<b>bold</b>" and "<i>stressed</i>" in a translated string into real markup (nothing else is allowed). */
export function rich(text: string): ReactNode {
  return text.split(/(<b>.*?<\/b>|<i>.*?<\/i>)/g).map((part, i) =>
    part.startsWith("<b>") ? <b key={i}>{part.slice(3, -4)}</b> : part.startsWith("<i>") ? <em key={i}>{part.slice(3, -4)}</em> : part,
  );
}

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: ReturnType<typeof translator>["t"];
  tn: ReturnType<typeof translator>["tn"];
  /** For Intl date and number formatting in the chosen language. */
  locale: string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage blocked: just detect.
    }
    return detectLang(saved, typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : []);
  });
  const [messages, setMessages] = useState<{ lang: Lang; msgs: Messages }>({ lang: "en", msgs: {} });

  useEffect(() => {
    document.documentElement.lang = lang;
    if (lang === "en") return setMessages({ lang, msgs: {} });
    let live = true;
    LOADERS[lang]()
      .then((m) => live && setMessages({ lang, msgs: m.default }))
      .catch(() => live && setMessages({ lang, msgs: {} }));
    return () => {
      live = false;
    };
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // Can't save: the choice lasts for this visit.
    }
  }, []);

  // Until a language's file arrives, show English rather than mixing two languages.
  const shown = messages.lang === lang ? messages.msgs : {};
  const value = useMemo<I18n>(() => {
    const tr = translator(lang, shown);
    // Durations and dates formatted outside React follow the same language.
    setFormat(lang, { d: tr.t("dur.d"), h: tr.t("dur.h"), m: tr.t("dur.m"), ready: tr.t("dur.ready") });
    return { lang, setLang, locale: lang, ...tr };
  }, [lang, setLang, shown]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT(): I18n {
  const ctx = useContext(Ctx);
  // Outside the provider (tests, isolated renders): plain English.
  return ctx ?? { lang: "en", setLang: () => {}, locale: "en", ...translator("en", {}) };
}
