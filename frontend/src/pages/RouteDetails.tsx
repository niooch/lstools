// src/pages/RouteDetails.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";

/* ---- Minimal types ---- */
type StopDto = {
    order: number;
    id: number;
    name: string;
    latitude: string;
    longitude: string;
};
type RouteDto = {
    id: number;
    origin: number;
    destination: number;
    time_start: string;
    time_end: string;
    vehicle_type: number;
    crew: "single" | "double";
    length_km?: string | null;
    price?: string | null;
    currency: "PLN" | "EUR";
    price_per_km?: string | null; // e.g. "2.63 PLN"
    status: "active" | "sold" | "cancelled";
    owner?: string; // username only
    stops: StopDto[];
};
type Localisation = {
    id: number;
    name: string;
    latitude: string;
    longitude: string;
};
type VehicleType = {
    id: number;
    name: string;
    attribute?: string;
};
type UserPublic = {
    id: number;
    username: string;
    email?: string | null;
};
type UserProfilePublic = {
    id: number;
    username: string;
    display_name?: string | null;
    nickname_color?: string | null;
    bio?: string | null;
    phone_number?: string | null;
    email?: string | null;
    route_stats?: {
        active: number;
        sold: number;
        cancelled: number;
        total: number;
    };
};
type CoreUser = {
    id: number;
    username: string;
    email?: string | null;
    phone_number?: string | null;
};
type Me = { id: number; username: string };

/* ---------------------- Component ---------------------- */
export default function RouteDetails() {
    const { id } = useParams<{ id: string }>();

    const [route, setRoute] = useState<RouteDto | null>(null);
    const [origin, setOrigin] = useState<Localisation | null>(null);
    const [destination, setDestination] = useState<Localisation | null>(null);
    const [vehicle, setVehicle] = useState<VehicleType | null>(null);

    /** seller */
    const [ownerProfile, setOwnerProfile] = useState<UserProfilePublic | null>(null);
    const [ownerCore, setOwnerCore] = useState<CoreUser | null>(null);

    /** current user for owner check */
    const [me, setMe] = useState<Me | null>(null);

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [selling, setSelling] = useState(false);
    const [sellErr, setSellErr] = useState<string | null>(null);
    const [sellOk, setSellOk] = useState<string | null>(null);

    useEffect(() => {
        // try to get current user; if unauthenticated, ignore
        api
        .get("/api/users/me")
        .then((r) => setMe({ id: r.data.id, username: r.data.username }))
        .catch(() => setMe(null));
    }, []);

    useEffect(() => {
        let on = true;
        async function load() {
            try {
                setErr(null);
                setLoading(true);
                setSellErr(null);
                setSellOk(null);

                // 1) Route
                const r = await api.get(`/api/transport/routes/${id}`);
                if (!on) return;
                const rt: RouteDto = r.data;
                setRoute(rt);

                // 2) Origin + Destination + Vehicle
                const [o, d, v] = await Promise.all([
                    api.get(`/api/localisations/${rt.origin}`).then((x) => x.data as Localisation),
                        api.get(`/api/localisations/${rt.destination}`).then((x) => x.data as Localisation),
                        api.get(`/api/transport/vehicle-types/${rt.vehicle_type}`).then((x) => x.data as VehicleType),
                ]);
                    if (!on) return;
                    setOrigin(o);
                    setDestination(d);
                    setVehicle(v);

                    // 3) Resolve seller: username -> id -> profile + core user (for email/phone)
                    if (rt.owner) {
                        const { profile, core } = await findOwnerByUsername(rt.owner);
                        if (!on) return;
                        if (profile) setOwnerProfile(profile);
                        if (core) setOwnerCore(core);
                    }
            } catch (e: any) {
                if (!on) return;
                setErr(e?.response?.data?.detail || "Failed to load route.");
            } finally {
                if (on) setLoading(false);
            }
        }
        if (id) load();
        return () => {
            on = false;
        };
    }, [id]);

    // Build an ordered list: origin -> ...stops... -> destination
    const points = useMemo(() => {
        const pts: { id: number; name: string; lat?: number; lon?: number }[] = [];
        if (origin) {
            pts.push({
                id: origin.id,
                name: origin.name,
                lat: Number(origin.latitude),
                lon: Number(origin.longitude),
            });
        }
        if (route?.stops?.length) {
            for (const s of route.stops) {
                const lat = Number(s.latitude);
                const lon = Number(s.longitude);
                pts.push({
                    id: s.id,
                    name: s.name,
                    lat: isFinite(lat) ? lat : undefined,
                    lon: isFinite(lon) ? lon : undefined,
                });
            }
        }
        if (destination) {
            pts.push({
                id: destination.id,
                name: destination.name,
                lat: Number(destination.latitude),
                lon: Number(destination.longitude),
            });
        }
        return pts;
    }, [origin, destination, route?.stops]);

    if (err) return <div style={{ color: "crimson" }}>{err}</div>;
    if (loading || !route) return <div>Loading…</div>;

    const crewIcon =
        route.crew === "double" ? "/icons/crew-double.png" : "/icons/crew-single.png";

    // Contact info: prefer core user fields, fall back to profile if present
    const contactEmail = ownerCore?.email ?? (ownerProfile as any)?.email ?? null;
    const contactPhone =
        ownerCore?.phone_number ?? (ownerProfile as any)?.phone_number ?? null;

    const isOwner = !!(me && route.owner && me.username === route.owner);

    async function markAsSold() {
        if (!route) return;
        if (!window.confirm("Mark this route as sold?")) return;

        setSelling(true);
        setSellErr(null);
        setSellOk(null);

        try {
            // Correct endpoint: POST /api/transport/routes/{id}/sell
            const resp = await api.post(`/api/transport/routes/${route.id}/sell`);

            // If backend responds with the updated route, prefer that status; otherwise assume "sold".
            const newStatus = resp?.data?.status ?? "sold";
            setRoute((r) => (r ? { ...r, status: newStatus } : r));

            setSellOk("Route marked as sold.");
        } catch (e: any) {
            setSellErr(e?.response?.data?.detail || "Failed to mark as sold.");
        } finally {
            setSelling(false);
        }
    }

    return (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr 420px", gap: 16 }}>
        {/* LEFT: timeline + map */}
        <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <h3 style={{ margin: "4px 0 8px" }}>Route map</h3>
        <div style={{ marginBottom: 12 }}>
        <RouteMap points={points} />
        </div>

        <h4 style={{ margin: "8px 0 6px" }}>Localisations</h4>
        {points.length === 0 ? (
            <div>No localisations available.</div>
        ) : (
        <div style={{ display: "grid", gap: 10 }}>
        {points.map((p, idx) => (
            <div key={`${p.id}-${idx}`} style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
            title={idx === 0 ? "Origin" : idx === points.length - 1 ? "Destination" : "Stop"}
            style={{
                width: 26,
                height: 26,
                lineHeight: "26px",
                textAlign: "center",
                borderRadius: "50%",
                background: idx === 0 ? "#ecfeff" : idx === points.length - 1 ? "#ecfccb" : "#f5f3ff",
                border: "1px solid #e5e7eb",
                fontWeight: 700,
                color: "#111",
                flex: "0 0 auto",
            }}
            >
            {idx + 1}
            </div>
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            </div>
            {idx < points.length - 1 && (
                <div style={{ textAlign: "center", opacity: 0.4, userSelect: "none" }}>↓</div>
            )}
            </div>
        ))}
        </div>
        )}
        </section>

        {/* CENTER: facts */}
        <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Route #{route.id}</h2>
        <StatusPill status={route.status} />
        </div>
        {isOwner && route.status === "active" && (
            <button
            onClick={markAsSold}
            disabled={selling}
            title="Mark this route as sold"
            style={{
                border: "1px solid #ddd",
                background: "#fff",
                borderRadius: 999,
                padding: "6px 10px",
                fontWeight: 600,
                cursor: selling ? "not-allowed" : "pointer",
            }}
            >
            {selling ? "Marking…" : "Mark as sold"}
            </button>
        )}
        </div>

        {(sellErr || sellOk) && (
            <div style={{ marginTop: 8 }}>
            {sellErr && <div style={{ color: "crimson" }}>{sellErr}</div>}
            {sellOk && <div style={{ color: "#065f46" }}>{sellOk}</div>}
            </div>
        )}

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        <Row label="Start">{formatDateTime(route.time_start)}</Row>
        <Row label="End">{formatDateTime(route.time_end)}</Row>
        <Row label="Duration">{formatDuration(route.time_start, route.time_end)}</Row>

        <Row label="Length">
        {route.length_km ? `${Number(route.length_km).toFixed(2)} km` : "—"}
        </Row>

        <Row label="Vehicle">
        {vehicle ? (
            <span>
            {vehicle.name}
            {vehicle.attribute && (
                <span
                title="Vehicle attribute"
                style={{
                    marginLeft: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: "1px solid #e5e7eb",
                    fontSize: 12,
                    fontWeight: 700,
                }}
                >
                {vehicle.attribute.toUpperCase()}
                </span>
            )}
            </span>
        ) : (
        "—"
        )}
        </Row>

        <Row label="Crew">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <img
        src={crewIcon}
        alt={route.crew}
        style={{ width: 22, height: 22, objectFit: "contain" }}
        onError={(e) => ((e.currentTarget.style.display = "none"))}
        />
        <span style={{ textTransform: "capitalize" }}>{route.crew}</span>
        </span>
        </Row>

        <Row label="Price">
        {route.price ? (
            <strong>
            {Number(route.price).toFixed(2)} {route.currency}
            </strong>
        ) : (
        "—"
        )}
        </Row>

        <Row label="Price / km">{formatPricePerKm(route)}</Row>
        </div>
        </section>

        {/* RIGHT: seller */}
        <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <h3 style={{ margin: "4px 0 8px" }}>Seller</h3>

        {!ownerProfile ? (
            <div>
            {route.owner ? (
                <div>
                <div style={{ fontWeight: 700 }}>{route.owner}</div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                (Profile link unavailable)
                </div>
                </div>
            ) : (
            <div>Unknown</div>
            )}
            </div>
        ) : (
        <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <Link
        to={`/profile/${ownerProfile.id}`}
        style={{
            color: ownerProfile.nickname_color || "#2563eb",
            textDecoration: "none",
            fontWeight: 700,
        }}
        title="Open profile"
        >
        {ownerProfile.display_name || ownerProfile.username}
        </Link>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
        @{ownerProfile.username}
        </span>
        </div>

        {ownerProfile.bio ? (
            <div style={{ whiteSpace: "pre-wrap" }}>{ownerProfile.bio}</div>
        ) : (
        <div style={{ opacity: 0.6 }}>No bio provided.</div>
        )}

        <div style={{ marginTop: 4, display: "grid", gap: 4, fontSize: 14 }}>
        <div>
        <span style={{ opacity: 0.7, marginRight: 6 }}>Email:</span>
        {contactEmail ? (
            <a
            href={`mailto:${contactEmail}`}
            style={{ textDecoration: "none" }}
            >
            {contactEmail}
            </a>
        ) : (
        <span style={{ opacity: 0.6 }}>—</span>
        )}
        </div>
        <div>
        <span style={{ opacity: 0.7, marginRight: 6 }}>Phone:</span>
        {contactPhone ? (
            <a
            href={`tel:${String(contactPhone).replace(/\s+/g, "")}`}
            style={{ textDecoration: "none" }}
            >
            {contactPhone}
            </a>
        ) : (
        <span style={{ opacity: 0.6 }}>—</span>
        )}
        </div>
        </div>
        </div>
        )}
        </section>
        </div>
    );
}

/* ---------------------- Map (Leaflet) ---------------------- */
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const originIcon = new L.DivIcon({
    className: "leaflet-div-icon custom-marker origin",
    html:
        '<div style="background:#10b981;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;">1</div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

const stopIcon = new L.DivIcon({
    className: "leaflet-div-icon custom-marker stop",
    html:
        '<div style="background:#6366f1;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">•</div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
});

const destIcon = new L.DivIcon({
    className: "leaflet-div-icon custom-marker dest",
    html:
        '<div style="background:#f59e0b;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;">✔</div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

function FitToPoints({ coords }: { coords: [number, number][] }) {
    const map = useMap();
    useEffect(() => {
        if (!coords.length) return;
        if (coords.length === 1) {
            map.setView(coords[0], 10);
            return;
        }
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds.pad(0.2));
    }, [coords, map]);
    return null;
}

function RouteMap({
    points,
}: {
    points: { id: number; name: string; lat?: number; lon?: number }[];
}) {
    const geo = points.filter(
        (p) => typeof p.lat === "number" && typeof p.lon === "number"
    ) as {
        id: number;
        name: string;
        lat: number;
        lon: number;
    }[];

    const center: [number, number] = geo.length ? [geo[0].lat, geo[0].lon] : [52.2297, 21.0122];
    const poly: [number, number][] = geo.map((p) => [p.lat, p.lon]);

    return (
        <div style={{ height: 280, borderRadius: 10, overflow: "hidden" }}>
        <MapContainer center={center} zoom={6} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitToPoints coords={poly} />

        {/* origin */}
        {points[0]?.lat && points[0]?.lon && (
            <Marker position={[points[0].lat!, points[0].lon!]} icon={originIcon}>
            <Popup>
            <strong>Origin</strong>
            <div>{points[0].name}</div>
            </Popup>
            </Marker>
        )}

        {/* stops */}
        {points.slice(1, -1).map((p, i) =>
                                 p.lat && p.lon ? (
                                     <Marker key={`stop-${p.id}-${i}`} position={[p.lat, p.lon]} icon={stopIcon}>
                                     <Popup>
                                     <strong>Stop {i + 1}</strong>
                                     <div>{p.name}</div>
                                     </Popup>
                                     </Marker>
                                 ) : null
                                )}

                                {/* destination */}
                                {points[points.length - 1]?.lat && points[points.length - 1]?.lon && (
                                    <Marker
                                    position={[points[points.length - 1].lat!, points[points.length - 1].lon!]}
                                    icon={destIcon}
                                    >
                                    <Popup>
                                    <strong>Destination</strong>
                                    <div>{points[points.length - 1].name}</div>
                                    </Popup>
                                    </Marker>
                                )}

                                {/* polyline if 2+ points */}
                                {poly.length >= 2 && <Polyline positions={poly} color="#111827" weight={3} opacity={0.6} />}
                                </MapContainer>
                                </div>
    );
}

/* ---------------------- helpers ---------------------- */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", gap: 8 }}>
        <div style={{ opacity: 0.7 }}>{label}</div>
        <div>{children}</div>
        </div>
    );
}

function StatusPill({ status }: { status: RouteDto["status"] }) {
    const styleMap: Record<RouteDto["status"], { bg: string; border: string; color: string; label: string }> = {
        active: { bg: "#ecfeff", border: "#bae6fd", color: "#075985", label: "ACTIVE" },
        sold: { bg: "#ecfccb", border: "#d9f99d", color: "#3f6212", label: "SOLD" },
        cancelled: { bg: "#fee2e2", border: "#fecaca", color: "#991b1b", label: "CANCELLED" },
    };
    const s = styleMap[status];
    return (
        <span
        style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 8px",
            borderRadius: 999,
            border: `1px solid ${s.border}`,
            background: s.bg,
            color: s.color,
            fontWeight: 700,
            fontSize: 12,
        }}
        >
        {s.label}
        </span>
    );
}

function formatDateTime(iso: string) {
    const d = new Date(iso);
    const two = (n: number) => (n < 10 ? `0${n}` : String(n));
    return `${two(d.getHours())}:${two(d.getMinutes())} ${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatDuration(startIso: string, endIso: string) {
    const s = new Date(startIso).getTime();
    const e = new Date(endIso).getTime();
    if (isNaN(s) || isNaN(e) || e <= s) return "—";
    const ms = e - s;
    const hours = Math.floor(ms / 3_600_000);
    const mins = Math.round((ms % 3_600_000) / 60_000);
    const two = (n: number) => (n < 10 ? `0${n}` : String(n));
    return `${two(hours)}:${two(mins)}`;
}

function formatPricePerKm(r: RouteDto) {
    if (r.price && r.length_km) {
        const priceNum = Number(r.price);
        const km = Number(r.length_km);
        if (km > 0) return `${(priceNum / km).toFixed(2)} ${r.currency}/km`;
    }
    if (r.price_per_km) return `${r.price_per_km}/km`;
    return "—";
}

/** Paginate /api/users/ for username -> ID, then fetch profile + core user. */
async function findOwnerByUsername(username: string): Promise<{ profile: UserProfilePublic | null; core: CoreUser | null }> {
    let url: string | null = "/api/users/";
    let guard = 0;
    while (url && guard < 25) {
        const resp = await api.get(url);
        const results = (Array.isArray(resp.data) ? resp.data : resp.data.results) as UserPublic[];
        const match = results.find((u) => u.username === username);
        if (match) {
            const [profile, core] = await Promise.all([
                api.get(`/api/users/profiles/${match.id}`).then((x) => x.data as UserProfilePublic),
                    api.get(`/api/users/${match.id}`).then((x) => x.data as CoreUser).catch(() => null),
            ]);
                return { profile, core };
        }
        url = (resp.data && resp.data.next) || null;
        guard += 1;
    }
    return { profile: null, core: null };
}
