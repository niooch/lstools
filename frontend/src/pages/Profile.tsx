// src/pages/Profile.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import type { UserProfilePublic, Route } from "../types";

type ContactInfo = {
  email?: string | null;
  phone_number?: string | null;
};

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserProfilePublic | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [contact, setContact] = useState<ContactInfo>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    async function load() {
      try {
        setErr(null);

        // Get public profile + routes + (optional) core user for email/phone
        const [uRes, rRes, coreRes] = await Promise.all([
          api.get(`/api/users/profiles/${id}`),
          api.get(`/api/transport/routes?owner=${id}`),
          // core user might be restricted; swallow errors and keep going
          api.get(`/api/users/${id}`).catch(() => ({ data: {} as ContactInfo })),
        ]);

        if (!on) return;

        const u = uRes.data as UserProfilePublic;
        setUser(u);

        const items: Route[] = Array.isArray(rRes.data) ? rRes.data : rRes.data.results || [];
        setRoutes(items);

        // Prefer explicit core user contact fields; fall back to profile if present
        const core: any = coreRes?.data || {};
        setContact({
          email: core.email ?? (u as any).email ?? null,
          phone_number: core.phone_number ?? (u as any).phone_number ?? null,
        });
      } catch (e: any) {
        if (!on) return;
        setErr(e.response?.data?.detail || "Failed to load profile");
      }
    }
    if (id) load();
    return () => {
      on = false;
    };
  }, [id]);

  if (err) return <div style={{ color: "crimson" }}>{err}</div>;
  if (!user) return <div>Loading…</div>;

  const name = user.display_name || user.username;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 16 }}>
        <h2 style={{ margin: 0 }}>
          <span style={{ color: user.nickname_color }}>{name}</span>
          <small style={{ marginLeft: 8, opacity: 0.7 }}>@{user.username}</small>
        </h2>

        {user.bio ? (
          <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{user.bio}</p>
        ) : (
          <p style={{ opacity: 0.6, marginTop: 8 }}>No bio yet.</p>
        )}

        {/* Contact block */}
        <div
          style={{
            display: "grid",
            gap: 8,
            marginTop: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Email</div>
            {contact.email ? (
              <a href={`mailto:${contact.email}`} style={{ color: "#2563eb", wordBreak: "break-all" }}>
                {contact.email}
              </a>
            ) : (
              <span style={{ opacity: 0.6 }}>—</span>
            )}
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Phone</div>
            {contact.phone_number ? (
              <a
                href={`tel:${String(contact.phone_number).replace(/\s+/g, "")}`}
                style={{ color: "#2563eb", wordBreak: "break-all" }}
              >
                {contact.phone_number}
              </a>
            ) : (
              <span style={{ opacity: 0.6 }}>—</span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 14, opacity: 0.8 }}>
          Routes · active {user.route_stats.active} · sold {user.route_stats.sold} · cancelled {user.route_stats.cancelled} · total{" "}
          {user.route_stats.total}
        </div>
      </div>

      <h3 style={{ margin: "8px 0" }}>Active routes</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {routes.length === 0 ? (
          <div>No active routes.</div>
        ) : (
          routes.map((r) => (
            <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>
                  #{r.id} · {r.status.toUpperCase()}
                </strong>
                <span>
                  {new Date(r.time_start).toLocaleString()} → {new Date(r.time_end).toLocaleTimeString()}
                </span>
              </div>
              <div>vehicle: {r.vehicle_type} · crew: {r.crew}</div>
              <div>
                length: {r.length_km ?? "?"} km · price: {r.price ?? "?"} {r.currency} · ppk: {r.price_per_km ?? "-"}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <Link to="/routes">← Back to routes</Link>
      </div>
    </div>
  );
}
