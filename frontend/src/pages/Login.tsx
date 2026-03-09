import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, LOGIN_PATH } from "../lib/api";
import { setTokens } from "../lib/auth";
import { useTranslation } from "react-i18next";

const RESEND_VERIFICATION_PATH =
  (import.meta.env.VITE_AUTH_RESEND_VERIFICATION as string) || "/api/auth/resend-verification";

export default function Login() {
  const { t } = useTranslation();
  const [id, setId] = useState(""); // username or email
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendInfo, setResendInfo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const loc = useLocation() as any;
  const search = useMemo(() => new URLSearchParams(loc.search || ""), [loc.search]);
  const topNotice = search.get("registered") === "1" ? t("auth.registration_success") : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { data } = await api.post(LOGIN_PATH, { username: id, email: id, password });
      setTokens({ access: data.access, refresh: data.refresh });
      window.location.replace(loc.state?.from?.pathname || "/routes");
    } catch (err: any) {
      setError(err.response?.data?.detail || t("auth.login_failed"));
    }
  }

  async function onResendVerification() {
    setResendError(null);
    setResendInfo(null);

    const email = id.trim();
    if (!looksLikeEmail(email)) {
      setResendError(t("auth.resend_verification_requires_email"));
      return;
    }

    setResending(true);
    try {
      const resp = await api.post(RESEND_VERIFICATION_PATH, { email });
      setResendInfo(resp.data?.detail || t("auth.resend_verification_sent"));
    } catch (err: any) {
      setResendError(err.response?.data?.detail || t("auth.resend_verification_failed"));
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 420, margin: "48px auto", display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>{t("auth.login_title")}</h2>
      {topNotice ? <div style={notice}>{topNotice}</div> : null}

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{t("auth.username_or_email")}</span>
        <input
          placeholder={t("auth.username_or_email_placeholder")}
          value={id}
          onChange={(e) => setId(e.target.value)}
          autoComplete="username"
          style={input}
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{t("auth.password")}</span>
        <input
          placeholder={t("auth.password_placeholder")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          style={input}
        />
      </label>

      <button type="submit" style={btnPrimary}>{t("auth.sign_in")}</button>
      {error ? <div style={{ color: "crimson" }}>{error}</div> : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <Link to="/forgot-password" style={linkStyle}>
          {t("auth.forgot_password")}
        </Link>
        <button type="button" style={btnSecondary} onClick={onResendVerification} disabled={resending}>
          {resending ? t("auth.resending_verification") : t("auth.resend_verification")}
        </button>
      </div>

      <div style={{ fontSize: 12, opacity: 0.75 }}>
        {t("auth.resend_verification_hint")}
      </div>
      {resendInfo ? <div style={{ color: "#065f46" }}>{resendInfo}</div> : null}
      {resendError ? <div style={{ color: "crimson" }}>{resendError}</div> : null}
    </form>
  );
}

function looksLikeEmail(value: string) {
  return value.includes("@") && value.includes(".");
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

const btnSecondary: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#f9fafb",
  cursor: "pointer",
};

const linkStyle: React.CSSProperties = {
  color: "#0a58ca",
  textDecoration: "underline",
  fontSize: 14,
};

const notice: React.CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 14,
};
