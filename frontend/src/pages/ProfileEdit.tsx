// src/pages/ProfileEdit.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type MeResponse = {
  id: number;
  username: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  description?: string | null;      // lives on /me/update (core)
  phone_number?: string | null;     // lives on /me/update (core)
  is_email_verified?: boolean;
  email_verified_at?: string | null;
};

type ProfileMeResponse = {
  display_name?: string | null;     // lives on /profiles/me
  nickname_color?: string | null;   // lives on /profiles/me
  bio?: string | null;              // lives on /profiles/me
};

export default function ProfileEdit() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [form, setForm] = useState({
    // core account
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    description: "",

    // profile fields
    display_name: "",
    nickname_color: "#111111",
    bio: "",

    // meta
    is_email_verified: false,
    email_verified_at: "" as string | null,
  });

  useEffect(() => {
    void loadMe();
  }, []);

  async function loadMe() {
    setLoading(true);
    setErr(null);
    setOk(null);
    try {
      const [coreRes, profileRes] = await Promise.all([
        api.get<MeResponse>("/api/users/me"),
        api.get<ProfileMeResponse>("/api/users/profiles/me"),
      ]);

      const core = coreRes.data;
      const prof = profileRes.data;

      setForm({
        // core
        username: core.username || "",
        email: core.email || "",
        first_name: core.first_name || "",
        last_name: core.last_name || "",
        phone_number: core.phone_number || "",
        description: core.description || "",

        // profile
        display_name: prof.display_name || "",
        nickname_color: prof.nickname_color || "#111111",
        bio: prof.bio || "",

        // meta
        is_email_verified: !!core.is_email_verified,
        email_verified_at: core.email_verified_at || null,
      });
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      // 1) core account update
      await api.patch("/api/users/me/update", {
        first_name: form.first_name || "",
        last_name: form.last_name || "",
        phone_number: form.phone_number || "",
        description: form.description || "",
      });

      // 2) public profile update
      await api.patch("/api/users/profiles/me", {
        display_name: form.display_name || "",
        nickname_color: form.nickname_color || "#111111",
        bio: form.bio || "",
      });

      setOk("Profile updated!");
    } catch (e: any) {
      const data = e?.response?.data;
      if (data && typeof data === "object") {
        const msg = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
          .join("\n");
        setErr(msg || "Save failed.");
      } else {
        setErr("Save failed.");
      }
    } finally {
      setSaving(false);
    }
  }

  function onChange<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  return (
    <div style={page}>
      <div style={headerRow}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Edit profile</h1>
        <button onClick={() => nav(-1)} style={btnGhost}>Back</button>
      </div>

      {ok && (
        <div style={bannerOk}>
          {ok}
        </div>
      )}
      {err && (
        <div style={bannerErr}>
          {err}
        </div>
      )}

      {loading ? (
        <div style={card}>Loading…</div>
      ) : (
        <div style={card}>

          {/* top meta */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14, opacity: 0.7 }}>@{form.username || "username"}</div>
            <VerifiedPill verified={form.is_email_verified} at={form.email_verified_at} />
          </div>

          {/* names + contact */}
          <div style={gridTwo}>
            <Field label="First name">
              <input
                value={form.first_name}
                onChange={(e) => onChange("first_name", e.target.value)}
                style={input}
              />
            </Field>

            <Field label="Last name">
              <input
                value={form.last_name}
                onChange={(e) => onChange("last_name", e.target.value)}
                style={input}
              />
            </Field>

            <Field label="Email">
              <input value={form.email} style={input} disabled title="Email change disabled here" />
            </Field>

            <Field label="Phone number">
              <input
                value={form.phone_number}
                onChange={(e) => onChange("phone_number", e.target.value)}
                placeholder="+48 123 456 789"
                style={input}
              />
            </Field>
          </div>

          {/* profile block */}
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Public profile</h3>

            <div style={gridTwo}>
              <Field label="Display name">
                <input
                  value={form.display_name}
                  onChange={(e) => onChange("display_name", e.target.value)}
                  placeholder="How others will see you"
                  style={input}
                />
              </Field>

              <Field label="Nickname color">
                <input
                  type="color"
                  value={form.nickname_color}
                  onChange={(e) => onChange("nickname_color", e.target.value)}
                  style={{ ...input, padding: 6, height: 42 }}
                />
              </Field>

              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Bio">
                  <textarea
                    rows={5}
                    value={form.bio}
                    onChange={(e) => onChange("bio", e.target.value)}
                    placeholder="Tell others a bit about you…"
                    style={{ ...input, resize: "vertical" }}
                  />
                  <div style={hint}>{form.bio.length} characters</div>
                </Field>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="About me (private account field)">
                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(e) => onChange("description", e.target.value)}
                    placeholder="Internal description on your account"
                    style={{ ...input, resize: "vertical" }}
                  />
                  <div style={hint}>Saved to /api/users/me/update</div>
                </Field>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => void save()} disabled={saving} style={btnPrimary}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button onClick={() => void loadMe()} style={btnGhost}>Reset</button>
          </div>
        </div>
      )}
    </div>
  );
}

function VerifiedPill({ verified, at }: { verified?: boolean; at?: string | null }) {
  const bg = verified ? "#e9f7ef" : "#fff5f5";
  const color = verified ? "#0f7b5f" : "#b42525";
  const border = verified ? "#bfe7d7" : "#f2c2c2";
  const dot = verified ? "#13ae85" : "#e34949";
  const title = verified && at ? `Verified at ${new Date(at).toLocaleString()}` : "Not verified";

  return (
    <span title={title} style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      borderRadius: 999,
      background: bg,
      color,
      border: `1px solid ${border}`,
      fontSize: 12,
      fontWeight: 600
    }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: dot }} />
      {verified ? "Email verified" : "Email not verified"}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{label}</span>
      {children}
    </label>
  );
}

/* ---- styles ---- */
const page: React.CSSProperties = {
  maxWidth: 800,
  margin: "0 auto",
  padding: 16,
  display: "grid",
  gap: 12,
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
  background: "#fff",
  boxShadow: "0 2px 10px rgba(0,0,0,.04)",
};

const gridTwo: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  outline: "none",
};

const hint: React.CSSProperties = { fontSize: 12, opacity: 0.6, marginTop: 4 };

const btnPrimary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#fff",
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
};

const bannerOk: React.CSSProperties = {
  border: "1px solid #bfe7d7",
  background: "#e9f7ef",
  color: "#0f7b5f",
  padding: 12,
  borderRadius: 10,
};

const bannerErr: React.CSSProperties = {
  border: "1px solid #f2c2c2",
  background: "#fff5f5",
  color: "#b42525",
  padding: 12,
  borderRadius: 10,
};
