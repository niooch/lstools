// src/pages/Profile.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import type { UserProfilePublic, Route } from "../types";

export default function Profile() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserProfilePublic | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    async function load() {
      try {
        setErr(null);

        const [uRes, rRes] = await Promise.all([
          api.get(`/api/users/profiles/${id}`),
          api.get(`/api/transport/routes?owner=${id}`),
        ]);

        if (!on) return;

        const u = uRes.data as UserProfilePublic;
        setUser(u);

        const items: Route[] = Array.isArray(rRes.data) ? rRes.data : rRes.data.results || [];
        setRoutes(items);
      } catch (e: any) {
        if (!on) return;
        setErr(e.response?.data?.detail || t("common.loadFailedProfile"));
      }
    }
    if (id) load();
    return () => {
      on = false;
    };
  }, [id, t]);

  if (err) return <div style={{ color: "crimson" }}>{err}</div>;
  if (!user) return <div>{t("common.loading")}</div>;

  const name = user.display_name || user.username;

  // Try to translate status if available (active/sold/cancelled)
  const statusLabel = (status?: string) =>
    status ? (t(`routes.status.${status}`, status) as string) : "—";

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
          <p style={{ opacity: 0.6, marginTop: 8 }}>{t("profile.noBio")}</p>
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
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
              {t("common.email")}
            </div>
            {user.email ? (
              <a href={`mailto:${user.email}`} style={{ color: "#2563eb", wordBreak: "break-all" }}>
                {user.email}
              </a>
            ) : (
              <span style={{ opacity: 0.6 }}>—</span>
            )}
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
              {t("common.phone")}
            </div>
            {user.phone_number ? (
              <a
                href={`tel:${String(user.phone_number).replace(/\s+/g, "")}`}
                style={{ color: "#2563eb", wordBreak: "break-all" }}
              >
                {user.phone_number}
              </a>
            ) : (
              <span style={{ opacity: 0.6 }}>—</span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 14, opacity: 0.8 }}>
          {t("profile.stats", {
            active: user.route_stats.active,
            sold: user.route_stats.sold,
            cancelled: user.route_stats.cancelled,
            total: user.route_stats.total,
          })}
        </div>
      </div>

      <h3 style={{ margin: "8px 0" }}>{t("profile.activeRoutes")}</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {routes.length === 0 ? (
          <div>{t("profile.noActiveRoutes")}</div>
        ) : (
          routes.map((r) => (
            <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>
                  #{r.id} · {statusLabel(r.status)}
                </strong>
                <span>
                  {new Date(r.time_start).toLocaleString()} → {new Date(r.time_end).toLocaleTimeString()}
                </span>
              </div>
              <div>
                {t("routes.vehicle")}: {r.vehicle_type} · {t("routes.crew")}: {r.crew}
              </div>
              <div>
                {t("routes.length")}: {r.length_km ?? "?"} km · {t("routes.price")}: {r.price ?? "?"} {r.currency} ·{" "}
                {t("routes.ppk")}: {r.price_per_km ?? "-"}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <Link to="/routes">← {t("routes.backToList")}</Link>
      </div>
    </div>
  );
}
