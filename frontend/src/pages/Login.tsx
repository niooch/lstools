import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, LOGIN_PATH } from "../lib/api";
import { setTokens } from "../lib/auth";
import { useTranslation } from "react-i18next";

export default function Login() {
  const { t } = useTranslation();
  const [id, setId] = useState(""); // username or email
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const loc = useLocation() as any;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { data } = await api.post(LOGIN_PATH, { username: id, email: id, password });
      setTokens({ access: data.access, refresh: data.refresh });
      navigate(loc.state?.from?.pathname || "/routes", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || t("auth.login_failed"));
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 420, margin: "48px auto", display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>{t("auth.login_title")}</h2>

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
