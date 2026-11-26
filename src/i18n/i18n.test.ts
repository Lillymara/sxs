import { describe, expect, it } from "vitest";
import { en } from "./en";
import de from "./de";
import es from "./es";
import fr from "./fr";
import pt from "./pt";
import ru from "./ru";
import { detectLang, fill, translator } from "./index";

const LANGS = { es, pt, ru, de, fr };
const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, "");

describe("translations", () => {
  it("only use keys that exist in English (plural forms allowed)", () => {
    const keys = new Set(Object.keys(en).map(base));
    for (const [code, msgs] of Object.entries(LANGS)) {
      const unknown = Object.keys(msgs).filter((k) => !keys.has(base(k)));
      expect(unknown, code).toEqual([]);
    }
  });

  it("keep every {placeholder} and <b> tag the English has", () => {
    const marks = (s: string) => [...s.matchAll(/\{\w+\}|<\/?b>/g)].map((m) => m[0]).sort();
    for (const [code, msgs] of Object.entries(LANGS)) {
      for (const [k, v] of Object.entries(msgs)) {
        const source = (en as Record<string, string>)[k] ?? (en as Record<string, string>)[`${base(k)}_other`];
        if (source) expect(marks(v!), `${code} ${k}`).toEqual(marks(source));
      }
    }
  });

  it("fall back to English for anything missing", () => {
    const { t } = translator("es", { "home.ready": "Listo" });
    expect(t("home.ready")).toBe("Listo");
    expect(t("home.setGoal")).toBe("Set a goal");
  });

  it("pick the right plural form", () => {
    const ruT = translator("ru", ru);
    expect(ruT.tn("when.inDays", 2)).toBe("Через 2 дня");
    expect(ruT.tn("when.inDays", 5)).toBe("Через 5 дней");
    expect(ruT.tn("when.inDays", 21)).toBe("Через 21 день");
    expect(translator("en", {}).tn("when.inDays", 1)).toBe("In 1 day");
  });

  it("fills placeholders and detects the device language", () => {
    expect(fill("Day {day} of {total}", { day: 3, total: 40 })).toBe("Day 3 of 40");
    expect(detectLang(null, ["pt-BR", "en"])).toBe("pt");
    expect(detectLang("fr", ["de"])).toBe("fr");
    expect(detectLang(null, ["ja"])).toBe("en");
  });
});
