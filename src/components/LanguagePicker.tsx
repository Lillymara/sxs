import { LANGS, useT, type Lang } from "../i18n";
import { Icon } from "./Icon";

/** A globe with the language code; tapping opens the device's own list of languages (each in its own name). */
export function LanguagePicker() {
  const { lang, setLang, t } = useT();
  return (
    <label className="lang-picker" title={t("lang.label")}>
      <Icon name="globe" size={18} />
      <span className="lang-code" aria-hidden>
        {lang.toUpperCase()}
      </span>
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t("lang.label")}>
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
