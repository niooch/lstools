// src/pages/Profile.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import type { UserProfilePublic, Route } from "../types";

export default function Profile() {
    const { id } = useParams<{ id: string }>();
    const [user, setUser] = useState<UserProfilePublic | null>(null);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let on = true;
        async function load() {
            try {
                const [u, r] = await Promise.all([
                    api.get(`/api/users/profiles/${id}`),
                    api.get(`/api/transport/routes?owner=${id}`),
                ]);
                    if (!on) return;
                    setUser(u.data);
                    const items: Route[] = Array.isArray(r.data) ? r.data : (r.data.results || []);
                    setRoutes(items);
            } catch (e: any) {
                if (!on) return;
                setErr(e.response?.data?.detail || "Failed to load profile");
            }
        }
        if (id) load();
        return () => { on = false; };
    }, [id]);

    if (err) return <div style={{ color: "crimson" }}>{err}</div>;
    if (!user) return <div>Loading…</div>;

    return (
        <div style={{ display: "grid", gap: 12 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 16 }}>
        <h2 style={{ margin: 0 }}>
        <span style={{ color: user.nickname_color }}>{user.display_name || user.username}</span>
        <small style={{ marginLeft: 8, opacity: 0.7 }}>@{user.username}</small>
        </h2>
        {user.bio ? <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{user.bio}</p> : <p style={{ opacity: 0.6 }}>No bio yet.</p>}
        <div style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
        Routes · active {user.route_stats.active} · sold {user.route_stats.sold} · cancelled {user.route_stats.cancelled} · total {user.route_stats.total}
        </div>
        </div>

        <h3 style={{ margin: "8px 0" }}>Active routes</h3>
        <div style={{ display: "grid", gap: 10 }}>
        {routes.length === 0 ? <div>No active routes.</div> : routes.map((r) => (
            <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>#{r.id} · {r.status.toUpperCase()}</strong>
            <span>{new Date(r.time_start).toLocaleString()} → {new Date(r.time_end).toLocaleTimeString()}</span>
            </div>
            <div>vehicle: {r.vehicle_type} · crew: {r.crew}</div>
            <div>length: {r.length_km ?? "?"} km · price: {r.price ?? "?"} {r.currency} · ppk: {r.price_per_km ?? "-"}</div>
            </div>
        ))}
        </div>

        <div style={{ marginTop: 12 }}>
        <Link to="/routes">← Back to routes</Link>
        </div>
        </div>
    );
}

