import { useEffect, useState } from "react";
import { LANGUAGE_EVENT, LANGUAGES, getLanguage, setLanguage, t } from "@/i18n";

/** Re-renders the component when the language changes. */
export function useI18n() {
  const [lang, setLang] = useState(getLanguage);
  useEffect(() => {
    const sync = () => setLang(getLanguage());
    window.addEventListener(LANGUAGE_EVENT, sync);
    return () => window.removeEventListener(LANGUAGE_EVENT, sync);
  }, []);
  return { t, lang, setLanguage, languages: LANGUAGES };
}
