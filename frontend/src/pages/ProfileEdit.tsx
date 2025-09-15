import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { UserProfileMe } from "../types";

export default function ProfileEdit() {
    const [me, setMe] = useState<UserProfileMe | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    async function load() {
        try {
            const { data } = await api.get("/api/users/profiles/me");
            setMe(data);
        } catch (e: any) {
            setErr(e.response?.data?.detail || "Failed to fetch profile");
        }
    }

    useEffect(() => { load(); }, []);

    async function save() {
        if (!me) return;
        setSaving(true);
        setErr(null);
        try {
            const payload = {
                display_name: me.display_name || "",
                bio: me.bio || "",
                phone_number: me.phone_number || "",
            };
            const { data } = await api.patch("/api/users/profiles/me", payload);
            setMe(data);
        } catch (e: any) {
            setErr(e.response?.data || "Failed to save");
        } finally {
            setSaving(false);
        }
    }

    if (err) return <div style={{ color: "crimson" }}>{String(err)}</div>;
    if (!me) return <div>Loading…</div>;

    return (
        <div style={{ maxWidth: 640, display: "grid", gap: 12 }}>
        <h2>My profile</h2>
        <div>
        <div style={{ fontSize: 14, opacity: 0.8 }}>Logged in as</div>
        <div><strong>{me.username}</strong> · <span style={{ color: me.nickname_color }}>color</span></div>
        <div style={{ opacity: 0.8 }}>{me.email}</div>
        </div>

        <label>
        Display name
        <input value={me.display_name || ""} onChange={(e) => setMe({ ...me, display_name: e.target.value })} />
        </label>

        <label>
        Bio
        <textarea rows={4} value={me.bio || ""} onChange={(e) => setMe({ ...me, bio: e.target.value })} />
        </label>

        <label>
        Phone number
        <input value={me.phone_number || ""} onChange={(e) => setMe({ ...me, phone_number: e.target.value })} />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
        <button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
        <button onClick={load}>Reset</button>
        </div>
        </div>
    );
}

