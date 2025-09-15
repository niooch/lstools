import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";

const REGISTER_PATH = import.meta.env.VITE_AUTH_REGISTER || "/api/users/register";

type ServerErrors = Record<string, string[] | string>;

export default function Register() {
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!form.username || !form.email || !form.password) {
      setError("Please fill all required fields.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      // Try the common payload. If your backend expects password1/password2,
      // adjust the payload or set up the backend to accept this shape.
      const payload = { username: form.username, email: form.email, password: form.password };
      const r = await api.post(REGISTER_PATH, payload);
      // Some backends return 201/200 empty; others return the created user.
      if (r.status === 200 || r.status === 201) {
        // After register, send them to login
        nav("/login?registered=1");
      } else {
        setError("Registration failed. Try again.");
      }
    } catch (err: any) {
      if (err?.response?.data) {
        const data = err.response.data;
        // show field errors if present
        if (typeof data === "object") setFieldErrors(data as ServerErrors);
        setError(data?.detail || "Registration failed.");
      } else {
        setError("Network error. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const err = (k: keyof typeof form) =>
    fieldErrors?.[k] ? (
      <div style={{ color: "crimson", fontSize: 12 }}>
        {Array.isArray(fieldErrors[k]) ? (fieldErrors[k] as string[]).join(", ") : String(fieldErrors[k])}
      </div>
    ) : null;

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", display: "grid", gap: 12 }}>
      <h2>Create account</h2>
      {error && <div style={{ color: "crimson" }}>{error}</div>}
      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <label>
          Username*
          <input
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            autoComplete="username"
          />
          {err("username")}
        </label>

        <label>
          Email*
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            autoComplete="email"
          />
          {err("email")}
        </label>

        <label>
          Password*
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            autoComplete="new-password"
          />
          {/* if backend returns "password1/password2" errors they will show in fieldErrors below */}
          {fieldErrors?.password1 && (
            <div style={{ color: "crimson", fontSize: 12 }}>
              {Array.isArray(fieldErrors.password1) ? fieldErrors.password1.join(", ") : String(fieldErrors.password1)}
            </div>
          )}
        </label>

        <label>
          Confirm password*
          <input
            type="password"
            value={form.confirm}
            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
            autoComplete="new-password"
          />
          {fieldErrors?.password2 && (
            <div style={{ color: "crimson", fontSize: 12 }}>
              {Array.isArray(fieldErrors.password2) ? fieldErrors.password2.join(", ") : String(fieldErrors.password2)}
            </div>
          )}
        </label>

        <button disabled={submitting}>{submitting ? "Creating…" : "Create account"}</button>
        <div style={{ fontSize: 14 }}>
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </form>
    </div>
  );
}

