// src/pages/ProfileEdit.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setErr(e?.response?.data?.detail || t("profileEdit.loadError"));
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

      setOk(t("profileEdit.saveOk"));
    } catch (e: any) {
      const data = e?.response?.data;
      if (data && typeof data === "object") {
        const msg = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
          .join("\n");
        setErr(msg || t("profileEdit.saveError"));
      } else {
        setErr(t("profileEdit.saveError"));
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
        <h1 style={{ margin: 0, fontSize: 24 }}>{t("profileEdit.title")}</h1>
        <button onClick={() => nav(-1)} style={btnGhost}>{t("common.back")}</button>
      </div>

      {ok && <div style={bannerOk}>{ok}</div>}
      {err && <div style={bannerErr}>{err}</div>}

      {loading ? (
        <div style={card}>{t("common.loading")}</div>
      ) : (
        <div style={card}>
          {/* top meta */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14, opacity: 0.7 }}>@{form.username || "username"}</div>
            <VerifiedPill verified={form.is_email_verified} at={form.email_verified_at} />
          </div>

          {/* names + contact */}
          <div style={gridTwo}>
            <Field label={t("profileEdit.firstName")}>
              <input
                value={form.first_name}
                onChange={(e) => onChange("first_name", e.target.value)}
                style={input}
              />
            </Field>

            <Field label={t("profileEdit.lastName")}>
              <input
                value={form.last_name}
                onChange={(e) => onChange("last_name", e.target.value)}
                style={input}
              />
            </Field>

            <Field label={t("profileEdit.email")}>
              <input value={form.email} style={input} disabled title={t("profileEdit.email")} />
            </Field>

            <Field label={t("profileEdit.phone")}>
              <input
                value={form.phone_number}
                onChange={(e) => onChange("phone_number", e.target.value)}
                placeholder={t("profileEdit.placeholder.phone")}
                style={input}
              />
            </Field>
          </div>

          {/* profile block */}
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>{t("profileEdit.publicProfile")}</h3>

            <div style={gridTwo}>
              <Field label={t("profileEdit.displayName")}>
                <input
                  value={form.display_name}
                  onChange={(e) => onChange("display_name", e.target.value)}
                  placeholder={t("profileEdit.placeholder.displayName")}
                  style={input}
                />
              </Field>

              <Field label={t("profileEdit.nicknameColor")}>
                <input
                  type="color"
                  value={form.nickname_color}
                  onChange={(e) => onChange("nickname_color", e.target.value)}
                  style={{ ...input, padding: 6, height: 42 }}
                />
              </Field>

              <div style={{ gridColumn: "1 / -1" }}>
                <Field label={t("profileEdit.bio")}>
                  <textarea
                    rows={5}
                    value={form.bio}
                    onChange={(e) => onChange("bio", e.target.value)}
                    placeholder={t("profileEdit.placeholder.bio")}
                    style={{ ...input, resize: "vertical" }}
                  />
                  <div style={hint}>{form.bio.length} {t("common.characters")}</div>
                </Field>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <Field label={t("profileEdit.aboutPrivate")}>
                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(e) => onChange("description", e.target.value)}
                    placeholder={t("profileEdit.placeholder.description")}
                    style={{ ...input, resize: "vertical" }}
                  />
                  <div style={hint}>{t("profileEdit.internalDescHint")}</div>
                </Field>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => void save()} disabled={saving} style={btnPrimary}>
              {saving ? t("common.saving") : t("common.saveChanges")}
            </button>
            <button onClick={() => void loadMe()} style={btnGhost}>{t("common.reset")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function VerifiedPill({ verified, at }: { verified?: boolean; at?: string | null }) {
  const { t } = useTranslation();
  const bg = verified ? "#e9f7ef" : "#fff5f5";
  const color = verified ? "#0f7b5f" : "#b42525";
  const border = verified ? "#bfe7d7" : "#f2c2c2";
  const dot = verified ? "#13ae85" : "#e34949";
  const title = verified && at
    ? t("profileEdit.verifiedAt", { date: new Date(at).toLocaleString() })
    : t("profileEdit.notVerifiedTitle");

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
      {verified ? t("profileEdit.emailVerified") : t("profileEdit.emailNotVerified")}
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
