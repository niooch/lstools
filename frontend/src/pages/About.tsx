import { useTranslation } from "react-i18next";

export default function About() {
  const { t } = useTranslation();
  return (
    <div style={{ maxWidth: 920, margin: "24px auto", padding: "0 16px" }}>
      <h1 style={{ marginTop: 0 }}>{t("about.title", "About us")}</h1>
      <p style={{ fontSize: 16, lineHeight: 1.6, opacity: 0.9 }}>
        {t(
          "about.body",
          "This is our About page. Describe your product, mission, and team here."
        )}
      </p>
    </div>
  );
}

