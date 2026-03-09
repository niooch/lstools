import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

const PASSWORD_RESET_PATH =
  (import.meta.env.VITE_AUTH_PASSWORD_RESET as string) || "/api/auth/password-reset";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setInfo(null);
    setError(null);

    try {
      const resp = await api.post(PASSWORD_RESET_PATH, { email: email.trim() });
      setInfo(resp.data?.detail || t("auth.password_reset_sent"));
    } catch (err: any) {
      setError(err.response?.data?.detail || t("auth.password_reset_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 420, margin: "48px auto", display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>{t("auth.password_reset_title")}</h2>
      <div style={{ fontSize: 14, opacity: 0.8 }}>{t("auth.password_reset_description")}</div>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{t("auth.email")}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder={t("auth.email_placeholder")}
          style={input}
          required
        />
      </label>

      <button type="submit" style={btnPrimary} disabled={submitting}>
        {submitting ? t("auth.sending_reset_link") : t("auth.send_reset_link")}
      </button>

      {info ? <div style={{ color: "#065f46" }}>{info}</div> : null}
      {error ? <div style={{ color: "crimson" }}>{error}</div> : null}

      <Link to="/login" style={linkStyle}>
        {t("auth.back_to_login")}
      </Link>
    </form>
  );
}

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  outline: "none",
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#fff",
  cursor: "pointer",
};

const linkStyle: React.CSSProperties = {
  color: "#0a58ca",
  textDecoration: "underline",
  fontSize: 14,
};
