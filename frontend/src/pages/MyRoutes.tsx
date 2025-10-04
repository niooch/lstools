import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import crewSingle from "../assets/crew-single.png";
import crewDouble from "../assets/crew-double.png";

const MINE_ENDPOINT = "/api/transport/routes/mine";
const LOCALISATIONS_BASE = "/api/localisations";
const VEH_TYPES_BASE = "/api/transport/vehicle-types";
const USERS_BASE = "/api/users";
const ARROW = "→";

/* ---------------- types ---------------- */
type Localisation = {
  id: number;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lon?: number | null;
};

type VehicleType = { id: number; name: string; attribute?: string | null };

type UserPublic = {
  id: number;
  username: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

type RouteRow = {
  id: number;
  origin: Localisation | number;
  destination: Localisation | number;
  stops?: Array<Localisation | number> | null;
  stops_count?: number;

  vehicle_type?: VehicleType | number | null;
  crew?: "single" | "double" | string;
  length_km?: string | number | null;

  // possible owner/user shapes
  owner?: string | UserPublic | number | null;
  user?: UserPublic | number | null;
  created_by?: UserPublic | number | null;

  price?: string | number | null;
  currency?: "PLN" | "EUR" | string | null;
  time_start?: string | null;
  time_end?: string | null;
};

/* --------------- helpers --------------- */
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const DD = pad2(d.getDate());
  const MM = pad2(d.getMonth() + 1);
  const YYYY = d.getFullYear();
  return `${hh}:${mm} ${DD}/${MM}/${YYYY}`;
};

const fmtDurationHHMM = (start?: string | null, end?: string | null) => {
  if (!start || !end) return "—";
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!isFinite(s) || !isFinite(e) || e < s) return "—";
  const mins = Math.round((e - s) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
};

const kmFmt = (v?: number | null, digits = 2) =>
  v == null || Number.isNaN(v) ? "—" : v.toFixed(digits);

const moneyFmt = (price?: string | number | null, currency?: string | null) => {
  if (price == null || price === "") return "—";
  const num = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(num)) return `${price} ${currency ?? ""}`.trim();
  try {
    if (!currency) return `${num.toFixed(2)}`;
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(num);
  } catch {
    return `${num.toFixed(2)} ${currency}`;
  }
};

const pricePerKmFmt = (
  price?: string | number | null,
  lenKm?: number | null,
  currency?: string | null
) => {
  if (price == null || price === "") return "—";
  const p = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(p) || !lenKm || !isFinite(lenKm) || lenKm <= 0) return "—";
  const per = p / lenKm;
  const cur = currency || "";
  return `${per.toFixed(2)} ${cur}/km`.trim();
};

function userLabel(u?: UserPublic | null): string {
  if (!u) return "—";
  if (u.display_name && u.display_name.trim()) return u.display_name.trim();
  const fl = `${u.first_name || ""} ${u.last_name || ""}`.trim();
  return fl || u.username || `#${u.id}`;
}

function getOwnerIdAndLabel(
  r: RouteRow,
  userById: Record<number, UserPublic>,
  userByUsername: Record<string, UserPublic>
): { id?: number; label: string } {
  const raw = r.owner ?? r.user ?? r.created_by;

  if (typeof raw === "string") {
    const uname = raw.trim();
    if (uname) {
      const u = userByUsername[uname];
      if (u) return { id: u.id, label: userLabel(u) };
      return { label: uname };
    }
    return { label: "—" };
  }

  if (typeof raw === "number") {
    const u = userById[raw];
    return { id: raw, label: userLabel(u) };
  }

  if (raw && typeof raw === "object") {
    const o = raw as any;
    const id = o.id as number | undefined;
    const label = userLabel(o as UserPublic);
    return { id, label };
  }

  return { label: "—" };
}

/* ---------------- component ---------------- */
export default function MyRoutes() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [locById, setLocById] = useState<Record<number, Localisation>>({});
  const [vehById, setVehById] = useState<Record<number, VehicleType>>({});

  // Users: both by id and by username (to turn 'owner' strings into links)
  const [userById, setUserById] = useState<Record<number, UserPublic>>({});
  const [userByUsername, setUserByUsername] = useState<Record<string, UserPublic>>({});
  const allUsersLoadedRef = useRef(false);

  useEffect(() => {
    void loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMine() {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.get(MINE_ENDPOINT);
      const list: RouteRow[] = Array.isArray(r.data) ? r.data : (r.data as any).results || [];
      setRows(list);

      // collect ids to fetch
      const locIds = new Set<number>();
      const vehIds = new Set<number>();
      const userNamesNeeded = new Set<string>();

      for (const rt of list) {
        if (typeof rt.origin === "number") locIds.add(rt.origin);
        if (typeof rt.destination === "number") locIds.add(rt.destination);
        if (rt.stops) for (const s of rt.stops) if (typeof s === "number") locIds.add(s);

        const vt = rt.vehicle_type;
        if (typeof vt === "number") vehIds.add(vt);
        else if (vt && typeof vt === "object" && (vt as any).id) vehIds.add((vt as any).id as number);

        const cand = rt.owner ?? rt.user ?? rt.created_by;
        if (typeof cand === "string" && cand.trim()) userNamesNeeded.add(cand.trim());
      }

      const locNeeded = [...locIds].filter((i) => !locById[i]);
      const vehNeeded = [...vehIds].filter((i) => !vehById[i]);

      const [locMap, vehMap] = await Promise.all([
        locNeeded.length ? fetchLocalisations(locNeeded) : Promise.resolve({} as Record<number, Localisation>),
        vehNeeded.length ? fetchVehicleTypes(vehNeeded) : Promise.resolve({} as Record<number, VehicleType>),
      ]);

      if (Object.keys(locMap).length) setLocById((prev) => ({ ...prev, ...locMap }));
      if (Object.keys(vehMap).length) setVehById((prev) => ({ ...prev, ...vehMap }));

      const unresolved = [...userNamesNeeded].filter((uname) => !userByUsername[uname]);
      if (unresolved.length && !allUsersLoadedRef.current) {
        const { byId, byUsername } = await fetchAllUsers();
        allUsersLoadedRef.current = true;
        if (Object.keys(byId).length) setUserById((prev) => ({ ...byId, ...prev }));
        if (Object.keys(byUsername).length) setUserByUsername((prev) => ({ ...byUsername, ...prev }));
      }
    } catch (e: any) {
      setErr(e?.response?.data?.detail || t("state.errorMine"));
    } finally {
      setLoading(false);
    }
  }

  const table = useMemo(() => {
    if (loading) return <div>{t("state.loading")}</div>;
    if (err) return <div style={{ color: "crimson" }}>{err}</div>;
    if (rows.length === 0) return <div>{t("state.emptyMine")}</div>;

    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", borderSpacing: 0, minWidth: 980 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={th}>{t("table.headers.origin")}</th>
              <th style={th}></th>
              <th style={th}>{t("table.headers.destination")}</th>
              <th style={th}>{t("table.headers.lengthKm", { unit: t("unit.kmShort") })}</th>
              <th style={th}>{t("table.headers.crew")}</th>
              <th style={th}>{t("table.headers.vehicle")}</th>
              <th style={th}>{t("table.headers.user")}</th>
              <th style={th}>{t("table.headers.price")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const o = typeof r.origin === "number" ? locById[r.origin] : (r.origin as Localisation | undefined);
              const d =
                typeof r.destination === "number"
                  ? locById[r.destination]
                  : (r.destination as Localisation | undefined);
              const sc = typeof r.stops_count === "number" ? r.stops_count : (r.stops ? r.stops.length : 0);
              const markerDest = sc + 2;

              const { id: ownerId, label: ownerLabel } = getOwnerIdAndLabel(r, userById, userByUsername);

              const crew = (r.crew || "").toString().toLowerCase();
              const crewIcon = crew === "double" ? crewDouble : crewSingle;
              const crewAlt =
                crew === "double" ? t("table.alt.doubleCrew") : t("table.alt.singleCrew");

              const lenNum =
                typeof r.length_km === "string" ? Number(r.length_km) : (r.length_km as number | undefined | null);

              const startLabel = fmtDateTime(r.time_start);
              const endLabel = fmtDateTime(r.time_end);
              const durationLabel = fmtDurationHHMM(r.time_start, r.time_end);
              const priceLabel = moneyFmt(r.price, (r.currency || "PLN") as string);
              const ppkLabel = pricePerKmFmt(
                r.price,
                typeof lenNum === "number" ? lenNum : null,
                r.currency || "PLN"
              );

              // vehicle type name + attribute badge
              let vehName = "—";
              let vehAttr: string | null = null;
              if (typeof r.vehicle_type === "object" && r.vehicle_type) {
                vehName = (r.vehicle_type as any).name;
                vehAttr = (r.vehicle_type as any).attribute || null;
              } else if (typeof r.vehicle_type === "number") {
                const vt = vehById[r.vehicle_type];
                vehName = vt?.name || `#${r.vehicle_type}`;
                vehAttr = vt?.attribute || null;
              }

              return (
                <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                  {/* Origin + start time */}
                  <td style={td}>
                    <div>
                      <div>
                        <Badge>1</Badge>{" "}
                        <span title={o?.name || ""}>
                          {o?.name || (typeof r.origin === "number" ? `#${r.origin}` : "—")}
                        </span>
                      </div>
                      <div style={subline}>{startLabel}</div>
                    </div>
                  </td>

                  {/* Arrow */}
                  <td style={{ ...tdCenter, width: 40, opacity: 0.7, fontSize: 18 }} title={t("table.routeArrowTitle")}>
                    {ARROW}
                  </td>

                  {/* Destination + end time */}
                  <td style={td}>
                    <div>
                      <div>
                        <Badge>{markerDest}</Badge>{" "}
                        <span title={d?.name || ""}>
                          {d?.name || (typeof r.destination === "number" ? `#${r.destination}` : "—")}
                        </span>
                      </div>
                      <div style={subline}>{endLabel}</div>
                    </div>
                  </td>

                  {/* Length + duration */}
                  <td style={tdMono}>
                    <div>
                      <div>{lenNum != null && Number.isFinite(lenNum) ? kmFmt(lenNum) : "—"}</div>
                      <div style={subline}>{durationLabel}</div>
                    </div>
                  </td>

                  {/* Crew */}
                  <td style={tdCenter}>
                    <img src={crewIcon} alt={crewAlt} title={crewAlt} style={{ height: 20 }} />
                  </td>

                  {/* Vehicle with attribute bubble */}
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {vehAttr ? (
                        <AttrBadge title={t("table.attrBadgeTitle", { attr: vehAttr.toUpperCase() })}>
                          {vehAttr[0].toUpperCase()}
                        </AttrBadge>
                      ) : null}
                      <span>{vehName}</span>
                    </div>
                  </td>

                  {/* Owner link */}
                  <td style={td}>
                    {ownerId ? (
                      <Link
                        to={`/users/${ownerId}`}
                        title={t("table.openProfile")}
                        style={{ color: "#0a58ca", textDecoration: "underline" }}
                      >
                        {ownerLabel}
                      </Link>
                    ) : (
                      ownerLabel
                    )}
                  </td>

                  {/* Price + per km */}
                  <td style={tdMono}>
                    <div>
                      <div>{priceLabel}</div>
                      <div style={subline}>{ppkLabel}</div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }, [rows, err, loading, locById, vehById, userById, userByUsername, t]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("page.myRoutes.title")}</h2>
        <button
          onClick={() => void loadMine()}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
        >
          {t("page.myRoutes.refresh")}
        </button>
      </div>
      {table}
    </div>
  );

  /* ---------- data fetch helpers ---------- */
  async function fetchLocalisations(ids: number[]): Promise<Record<number, Localisation>> {
    const out: Record<number, Localisation> = {};
    try {
      const r = await api.get(`${LOCALISATIONS_BASE}`, { params: { ids: ids.join(",") } });
      const arr: Localisation[] = Array.isArray(r.data) ? r.data : r.data.results || [];
      for (const it of arr) out[it.id] = it;
      if (Object.keys(out).length === ids.length) return out;
    } catch {}
    try {
      const r = await api.get(`${LOCALISATIONS_BASE}`, { params: { id__in: ids.join(",") } });
      const arr: Localisation[] = Array.isArray(r.data) ? r.data : r.data.results || [];
      for (const it of arr) out[it.id] = it;
      if (Object.keys(out).length === ids.length) return out;
    } catch {}
    await Promise.all(
      ids.map(async (id) => {
        if (out[id]) return;
        try {
          const r = await api.get(`${LOCALISATIONS_BASE}/${id}`);
          const it = r.data as Localisation;
          if (it?.id) out[it.id] = it;
        } catch {
          out[id] = { id, name: `#${id}`, lat: null, lon: null };
        }
      })
    );
    return out;
  }

  async function fetchVehicleTypes(ids: number[]): Promise<Record<number, VehicleType>> {
    const out: Record<number, VehicleType> = {};
    await Promise.all(
      ids.map(async (id) => {
        if (out[id]) return;
        try {
          const r = await api.get(`${VEH_TYPES_BASE}/${id}`);
          const it = r.data as VehicleType;
          if (it?.id) out[it.id] = it;
        } catch {
          out[id] = { id, name: `#${id}`, attribute: null };
        }
      })
    );
    return out;
  }

  async function fetchAllUsers(): Promise<{
    byId: Record<number, UserPublic>;
    byUsername: Record<string, UserPublic>;
  }> {
    const byId: Record<number, UserPublic> = {};
    const byUsername: Record<string, UserPublic> = {};

    let url: string | null = `${USERS_BASE}/`;
    while (url) {
      try {
        const r = await api.get(url);
        const page = (Array.isArray(r.data)
          ? { results: r.data, next: null }
          : (r.data as any)) as { results?: UserPublic[]; next?: string | null };
        const items: UserPublic[] = page.results || [];
        for (const u of items) {
          byId[u.id] = u;
          if (u.username) byUsername[u.username] = u;
        }
        url = page.next || null;
      } catch {
        break;
      }
    }
    return { byId, byUsername };
  }
}

/* ---------- tiny UI bits ---------- */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 20,
        height: 20,
        padding: "0 6px",
        borderRadius: 999,
        background: "#111",
        color: "#fff",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function AttrBadge({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: "1px solid #ddd",
        background: "#f8f8f8",
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}

/* ---------- table styles ---------- */
const th: React.CSSProperties = {
  fontWeight: 700,
  padding: "10px 8px",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = { padding: "10px 8px", verticalAlign: "middle", whiteSpace: "nowrap" };
const tdMono: React.CSSProperties = { ...td, fontVariantNumeric: "tabular-nums" };
const tdCenter: React.CSS_PROPERTIES = { ...td, textAlign: "center" };
const subline: React.CSSProperties = { fontSize: 12, opacity: 0.7, marginTop: 2 };
