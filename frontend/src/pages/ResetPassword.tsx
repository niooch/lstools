import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

const PASSWORD_RESET_CONFIRM_PATH =
  (import.meta.env.VITE_AUTH_PASSWORD_RESET_CONFIRM as string) || "/api/auth/password-reset/confirm";

export default function ResetPassword() {
  const { t } = useTranslation();
  const loc = useLocation();
  const search = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const uid = search.get("uid") || "";
  const token = search.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasLinkData = !!uid && !!token;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);
    setError(null);

    if (password !== confirm) {
      setError(t("auth.passwords_mismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const resp = await api.post(PASSWORD_RESET_CONFIRM_PATH, {
        uid,
        token,
        new_password: password,
        confirm_password: confirm,
      });
      setInfo(resp.data?.detail || t("auth.reset_password_success"));
      setPassword("");
      setConfirm("");
    } catch (err: any) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        if (typeof data.detail === "string") {
          setError(data.detail);
        } else if (data.new_password) {
          setError(Array.isArray(data.new_password) ? data.new_password.join(", ") : String(data.new_password));
        } else if (data.confirm_password) {
          setError(Array.isArray(data.confirm_password) ? data.confirm_password.join(", ") : String(data.confirm_password));
        } else {
          setError(t("auth.reset_password_failed"));
        }
      } else {
        setError(t("auth.reset_password_failed"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!hasLinkData) {
    return (
      <div style={{ maxWidth: 420, margin: "48px auto", display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("auth.reset_password_title")}</h2>
        <div style={{ color: "crimson" }}>{t("auth.invalid_reset_link")}</div>
        <Link to="/forgot-password" style={linkStyle}>
          {t("auth.send_reset_link")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 420, margin: "48px auto", display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>{t("auth.reset_password_title")}</h2>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{t("auth.new_password")}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          style={input}
          required
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{t("auth.confirm_password")}</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          style={input}
          required
        />
      </label>

      <button type="submit" style={btnPrimary} disabled={submitting}>
        {submitting ? t("auth.resetting_password") : t("auth.reset_password_submit")}
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
