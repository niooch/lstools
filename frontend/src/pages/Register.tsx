// src/pages/Register.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

const REGISTER_PATH = (import.meta.env.VITE_AUTH_REGISTER as string) || "/api/users/register";

type ServerErrors = Record<string, string[] | string>;

export default function Register() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ServerErrors>({});

  function setField<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    if (fieldErrors[k]) {
      const next = { ...fieldErrors };
      delete next[k];
      setFieldErrors(next);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!form.username || !form.email || !form.password) {
      setError(t("auth.fill_required"));
      return;
    }
    if (form.password !== form.confirm) {
      const msg = t("auth.passwords_mismatch");
      setError(msg);
      setFieldErrors((p) => ({ ...p, confirm: msg }));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      };
      const r = await api.post(REGISTER_PATH, payload);
      if (r.status === 200 || r.status === 201) {
        nav("/login?registered=1");
      } else {
        setError(t("auth.registration_failed"));
      }
    } catch (err: any) {
      const data = err?.response?.data;
      if (data && typeof data === "object") {
        setFieldErrors(data as ServerErrors);
        setError((data.detail as string) || t("auth.registration_failed"));
      } else {
        setError(t("auth.network_error"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const err = (k: keyof typeof form) =>
    fieldErrors?.[k] ? (
      <div style={styles.fieldError}>
        {Array.isArray(fieldErrors[k]) ? (fieldErrors[k] as string[]).join(", ") : String(fieldErrors[k])}
      </div>
    ) : null;

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.h2}>{t("auth.register_title")}</h2>
          <p style={styles.subtle}>
            {t("auth.have_account")}{" "}
            <Link to="/login" style={styles.link}>
              {t("auth.login_link")}
            </Link>
          </p>
        </div>

        {error && (
          <div style={styles.topError} role="alert" aria-live="polite">
            {typeof error === "string" ? error : t("auth.registration_failed")}
          </div>
        )}

        <form onSubmit={submit} style={styles.form}>
          <label style={styles.label}>
            <span style={styles.labelText}>{t("auth.username")}</span>
            <input
              style={styles.input}
              value={form.username}
              onChange={(e) => setField("username", e.target.value)}
              autoComplete="username"
              placeholder={t("auth.username_placeholder")}
              disabled={submitting}
              required
            />
            {err("username")}
          </label>

          <label style={styles.label}>
            <span style={styles.labelText}>{t("auth.email")}</span>
            <input
              style={styles.input}
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              autoComplete="email"
              placeholder={t("auth.email_placeholder")}
              disabled={submitting}
              required
            />
            {err("email")}
          </label>

          <label style={styles.label}>
            <span style={styles.labelText}>{t("auth.password")}</span>
            <input
              style={styles.input}
              type="password"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              autoComplete="new-password"
              placeholder={t("auth.password_placeholder")}
              disabled={submitting}
              required
            />
            {fieldErrors?.password1 && (
              <div style={styles.fieldError}>
                {Array.isArray(fieldErrors.password1)
                  ? fieldErrors.password1.join(", ")
                  : String(fieldErrors.password1)}
              </div>
            )}
            {fieldErrors?.password && (
              <div style={styles.fieldError}>
                {Array.isArray(fieldErrors.password)
                  ? fieldErrors.password.join(", ")
                  : String(fieldErrors.password)}
              </div>
            )}
          </label>

          <label style={styles.label}>
            <span style={styles.labelText}>{t("auth.confirm_password")}</span>
            <input
              style={styles.input}
              type="password"
              value={form.confirm}
              onChange={(e) => setField("confirm", e.target.value)}
              autoComplete="new-password"
              placeholder={t("auth.confirm_password_placeholder")}
              disabled={submitting}
              required
            />
            {fieldErrors?.password2 && (
              <div style={styles.fieldError}>
                {Array.isArray(fieldErrors.password2)
                  ? fieldErrors.password2.join(", ")
                  : String(fieldErrors.password2)}
              </div>
            )}
            {err("confirm")}
          </label>

          <button type="submit" style={styles.button} disabled={submitting}>
            {submitting ? t("auth.creating") : t("auth.create_account")}
          </button>

          {fieldErrors?.non_field_errors && (
            <div style={styles.fieldError}>
              {Array.isArray(fieldErrors.non_field_errors)
                ? fieldErrors.non_field_errors.join(", ")
                : String(fieldErrors.non_field_errors)}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

/* ---------- inline “design system” ---------- */
const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "calc(100vh - 120px)",
    display: "grid",
    placeItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    background: "#fff",
    boxShadow: "0 8px 24px rgba(0,0,0,.04)",
  },
  header: { display: "grid", gap: 6, marginBottom: 6 },
  h2: { margin: 0, fontSize: 22 },
  subtle: { margin: 0, fontSize: 14, opacity: 0.8 },
  link: { color: "#0a58ca", textDecoration: "underline" },

  topError: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 10,
    padding: "8px 10px",
    margin: "8px 0",
    fontSize: 14,
  },

  form: { display: "grid", gap: 12, marginTop: 8 },
  label: { display: "grid", gap: 6 },
  labelText: { fontWeight: 600, fontSize: 14 },
  input: {
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    outline: "none",
    fontSize: 14,
  },
  button: {
    marginTop: 6,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  },
  fieldError: { color: "crimson", fontSize: 12, lineHeight: 1.25 },
};
