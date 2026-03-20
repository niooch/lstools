import { useTranslation } from "react-i18next";

const CONTACT_EMAIL = "admin@relaygielda.com";
const CONTACT_PHONE = "+48 695 871 674";

export default function Contact() {
  const { t } = useTranslation();

  return (
    <div style={{ maxWidth: 920, margin: "24px auto", padding: "0 16px", display: "grid", gap: 12 }}>
      <h1 style={{ margin: 0 }}>{t("contact.title")}</h1>
      <p style={{ fontSize: 16, lineHeight: 1.6, opacity: 0.9, margin: 0 }}>
        {t("contact.body")}
      </p>

      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        <div>
          <strong>{t("contact.emailLabel")}:</strong>{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ textDecoration: "underline" }}>
            {CONTACT_EMAIL}
          </a>
        </div>
        <div>
          <strong>{t("contact.phoneLabel")}:</strong>{" "}
          <a href={`tel:${CONTACT_PHONE}`} style={{ textDecoration: "underline" }}>
            {CONTACT_PHONE}
          </a>
        </div>
      </div>
    </div>
  );
}
