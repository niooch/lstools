import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// importy JSON-ów z tłumaczeniami
import pl from "./locales/pl/common.json";
import en from "./locales/en/common.json";

i18n
  .use(LanguageDetector)          // wykrywanie: localStorage, navigator, <html lang>
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      pl: { translation: pl },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "pl"],
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });

// ustaw atrybut lang na <html>
i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng || "en";
  }
});

export default i18n;

