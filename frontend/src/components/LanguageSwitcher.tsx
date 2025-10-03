import { useTranslation } from "react-i18next";

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, opacity: .7 }}>{t("lang.choose")}:</span>
      <button
        onClick={() => i18n.changeLanguage("pl")}
        style={btn(i18n.language === "pl")}
        title="Polski"
      >
        PL
      </button>
      <button
        onClick={() => i18n.changeLanguage("en")}
        style={btn(i18n.language === "en")}
        title="English"
      >
        EN
      </button>
    </div>
  );
}

function btn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: active ? "#111" : "#fff",
    color: active ? "#fff" : "#111",
    cursor: "pointer",
    fontSize: 12
  };
}

