// src/pages/RoutesList.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";
import type { AxiosResponse } from "axios";
import crewSingle from "../assets/crew-single.png";
import crewDouble from "../assets/crew-double.png";

const ROUTES_BASE = "/api/transport/routes";
const LOCALISATIONS_BASE = "/api/localisations";
const USERS_PROFILES_BASE = "/api/users/profiles";
const VEH_TYPES_BASE = "/api/transport/vehicle-types"; // no trailing slash
const GEO_PROXY = "/api/geo/search";
const OSRM_BASE = import.meta.env.VITE_OSRM_URL || "http://localhost:5000";
const ARROW = "→";

// Correct app path for opening a user's profile
const userPathById = (id: number) => `/profile/${id}`;

/* ---------------- types ---------------- */
type Localisation = {
  id: number;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lon?: number | null;
};

type VehicleType = {
  id: number;
  name: string;
  attribute?: string | null;
  slug?: string;
  description?: string;
  is_active?: boolean;
  category?: string | null;
};

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
  length_km?: string | number | null;
  crew?: "single" | "double" | string;
  vehicle_type?: VehicleType | number | null;

  owner?: string | UserPublic | number | null;
  owner_id?: number | null;
  user?: UserPublic | number | null;
  created_by?: UserPublic | number | null;

  price?: string | number | null;
  currency?: "EUR" | string | null;
  time_start?: string | null;
  time_end?: string | null;
};

type Paged<T> = {
  results?: T[];
  count?: number;
  next?: string | null;
  previous?: string | null;
} & (T[] | {});

type Point = { lat: number; lon: number };
type VehMap = Record<number, VehicleType>;

/* --------------- helpers --------------- */
const asPoint = (loc?: Localisation | null): Point | null => {
  if (!loc) return null;
  const lat = (loc.lat ?? loc.latitude) as number | null | undefined;
  const lon = (loc.lon ?? loc.longitude) as number | null | undefined;
  return typeof lat === "number" && typeof lon === "number" ? { lat, lon } : null;
};

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
const kmFmt = (v?: number | null, digits = 2) => (v == null || Number.isNaN(v) ? "—" : v.toFixed(digits));
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
const pricePerKmFmt = (price?: string | number | null, lenKm?: number | null, currency?: string | null) => {
  if (price == null || price === "") return "—";
  const p = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(p) || !lenKm || !isFinite(lenKm) || lenKm <= 0) return "—";
  const per = p / lenKm;
  const cur = currency || "";
  return `${per.toFixed(2)} ${cur}/km`.trim();
};

const haversineKm = (a: Point, b: Point) => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const aa = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(aa)));
};
async function osrmDistanceKm(from: Point, to: Point): Promise<number | null> {
  try {
    const url = `${OSRM_BASE}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
    const r = await fetch(url);
    if (!r.ok) return haversineKm(from, to);
    const j = await r.json();
    const m = j?.routes?.[0]?.distance;
    return typeof m === "number" ? m / 1000 : haversineKm(from, to);
  } catch {
    return haversineKm(from, to);
  }
}

// prefer display_name -> username -> #id
function userLabel(u?: UserPublic | null): string {
  if (!u) return "—";
  const dn = (u.display_name || "").trim();
  if (dn) return dn;
  return u.username || `#${u.id}`;
}

/**
 * Return id and label.
 * If we can resolve an id, we prefer pulling the label from userById[id] (which includes display_name via profiles).
 */
function getOwnerIdAndLabel(
  r: RouteRow,
  userById: Record<number, UserPublic>,
  userByUsername: Record<string, UserPublic>
): { id?: number; label: string } {
  if (typeof r.owner_id === "number") {
    const prof = userById[r.owner_id];
    if (prof) return { id: r.owner_id, label: userLabel(prof) };
    if (typeof r.owner === "string" && r.owner.trim()) return { id: r.owner_id, label: r.owner.trim() };
    return { id: r.owner_id, label: `#${r.owner_id}` };
  }

  const raw = r.owner ?? r.user ?? r.created_by;

  // 1) numeric id
  if (typeof raw === "number") {
    const prof = userById[raw]; // <- profile-based (display_name) if fetched
    return { id: raw, label: userLabel(prof) };
  }

  // 2) embedded object with id/username
  if (raw && typeof raw === "object") {
    const o = raw as UserPublic;
    if (typeof o.id === "number") {
      const prof = userById[o.id] || o; // prefer profile, fallback to object
      return { id: o.id, label: userLabel(prof) };
    }
    if (o.username) {
      const u = userByUsername[o.username];
      if (u?.id) {
        const prof = userById[u.id] || u;
        return { id: u.id, label: userLabel(prof) };
      }
      return { label: userLabel(o) };
    }
  }

  // 3) plain username string -> try map to id
  if (typeof raw === "string") {
    const uname = raw.trim();
    if (uname) {
      const u = userByUsername[uname];
      if (u?.id) {
        const prof = userById[u.id] || u;
        return { id: u.id, label: userLabel(prof) };
      }
      return { label: uname };
    }
  }

  return { label: "—" };
}

/* ---------------- component ---------------- */
export default function RoutesList() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [locById, setLocById] = useState<Record<number, Localisation>>({});
  const [vehById, setVehById] = useState<VehMap>({});

  // Users: profiles (by id) and a username→user map (from /api/users/profiles)
  const [userById, setUserById] = useState<Record<number, UserPublic>>({});
  const [userByUsername, setUserByUsername] = useState<Record<string, UserPublic>>({});
  const allProfilesLoadedRef = useRef(false);

  // “Near” search + distance
  const [qNear, setQNear] = useState("");
  const [radiusKm, setRadiusKm] = useState<number>(120);
  const [searchPoint, setSearchPoint] = useState<Point | null>(null);
  const [searchLabel, setSearchLabel] = useState<string>("");
  const [distById, setDistById] = useState<Record<number, number | null | undefined>>({});
  const fetchBusyRef = useRef(false);

  // Filter panel state (client-side only)
  const [filters, setFilters] = useState<{
      originName: string;
      destName: string;
      startFrom: string; // datetime-local string
      endUntil: string;  // datetime-local string
      crew: "any" | "single" | "double";
      sort:
          | "date_start"   // default
              | "price_asc"
                  | "price_desc"
                      | "ppk_asc"
                          | "ppk_desc";
  }>({
      originName: "",
      destName: "",
      startFrom: "",
      endUntil: "",
      crew: "any",
      sort: "date_start", // default: start date asc
  });

  // Selected IDs (locked on Apply when user chose from datalist)
  const [originIdSel, setOriginIdSel] = useState<number | undefined>();
  const [destIdSel, setDestIdSel] = useState<number | undefined>();

  // Vehicle type checklist (client-side)
  const [vehTypeOpts, setVehTypeOpts] = useState<VehicleType[]>([]);
  const [vehTypeChecked, setVehTypeChecked] = useState<Record<number, boolean>>({});

  // Typeahead options for origin/destination
  const [originOpts, setOriginOpts] = useState<Localisation[]>([]);
  const [destOpts, setDestOpts] = useState<Localisation[]>([]);

  const originOf = (r: RouteRow): Localisation | null =>
  typeof r.origin === "number" ? locById[r.origin] ?? null : (r.origin || null);
  const destinationOf = (r: RouteRow): Localisation | null =>
  typeof r.destination === "number" ? locById[r.destination] ?? null : (r.destination || null);
  const stopsCountOf = (r: RouteRow): number =>
  typeof r.stops_count === "number" ? r.stops_count : (r.stops ? r.stops.length : 0);

  // ---- Fetch once (no server filtering) ----
  // replaces your current loadRoutes()
  async function loadRoutes() {
      setLoading(true);
      setErr(null);
      try {
          const r = await api.get<Paged<RouteRow>>(ROUTES_BASE);
          const list: RouteRow[] = Array.isArray(r.data) ? (r.data as any) : (r.data as any).results || [];
          setRows(list);

          const locIds = new Set<number>();
          const vehIds = new Set<number>();
          const userIds = new Set<number>();      // ids to fetch profiles for
          const usernames = new Set<string>();    // usernames we need to resolve to ids

          for (const rt of list) {
              if (typeof rt.origin === "number") locIds.add(rt.origin);
              if (typeof rt.destination === "number") locIds.add(rt.destination);
              if (rt.stops) for (const s of rt.stops) if (typeof s === "number") locIds.add(s);

              const vt = rt.vehicle_type;
              if (typeof vt === "number") vehIds.add(vt);
              else if (vt && typeof vt === "object" && (vt as any).id) vehIds.add((vt as any).id as number);

              if (typeof rt.owner_id === "number") userIds.add(rt.owner_id);

              const cand = rt.owner ?? rt.user ?? rt.created_by;
              if (typeof cand === "number") userIds.add(cand);
              else if (cand && typeof cand === "object" && typeof (cand as any).id === "number") userIds.add((cand as any).id);
              else if (typeof cand === "string" && cand.trim()) usernames.add(cand.trim());
          }

          // fetch localisations & vehicle types first
          const [locMap, vehMapFromIds] = await Promise.all([
              locIds.size ? fetchLocalisations([...locIds]) : Promise.resolve({} as Record<number, Localisation>),
              vehIds.size ? fetchVehicleTypes([...vehIds]) : Promise.resolve({} as VehMap),
          ]);
          if (Object.keys(locMap).length) setLocById((prev) => ({ ...prev, ...locMap }));
          if (Object.keys(vehMapFromIds).length) setVehById((prev) => ({ ...prev, ...vehMapFromIds }));

          // --- IMPORTANT FIX STARTS HERE ---
          // Build local maps we can use synchronously in this call
          let localUserById: Record<number, UserPublic> = { ...userById };
          let localUserByUsername: Record<string, UserPublic> = { ...userByUsername };

          // Load ALL public profiles once (paginated) to populate username -> id
          if (!allProfilesLoadedRef.current) {
              const { byId, byUsername } = await fetchAllProfiles();
              allProfilesLoadedRef.current = true;

              // Merge into local maps FIRST (so we can use them right away)
              localUserById = { ...localUserById, ...byId };
              localUserByUsername = { ...localUserByUsername, ...byUsername };

              // Then update state (async, but our local copies already have the data)
              if (Object.keys(byId).length) setUserById((prev) => ({ ...prev, ...byId }));
              if (Object.keys(byUsername).length) setUserByUsername((prev) => ({ ...prev, ...byUsername }));
          }

          // Resolve usernames -> ids using the LOCAL map we just built
          for (const uname of usernames) {
              const u = localUserByUsername[uname];
              if (u?.id) userIds.add(u.id);
          }

          // Fetch profiles/{id} only for any ids still missing in the local map
          const missingProfileIds = [...userIds].filter((uid) => !localUserById[uid]);
          if (missingProfileIds.length) {
              const profById = await fetchUserProfiles(missingProfileIds);
              if (Object.keys(profById).length) {
                  // update local map so this render can immediately use display_name
                  localUserById = { ...localUserById, ...profById };
                  // and update state for future renders
                  setUserById((prev) => ({ ...prev, ...profById }));
              }
          }
          // --- IMPORTANT FIX ENDS HERE ---
      } catch (e: any) {
          setErr(e?.response?.data?.detail || t("routesList.state.error"));
      } finally {
          setLoading(false);
      }
  }

  useEffect(() => {
    void Promise.all([loadRoutes(), preloadAllVehicleTypes()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // distance refresh for “near” point
  useEffect(() => {
    if (!searchPoint || rows.length === 0) {
      setDistById({});
      return;
    }
    if (fetchBusyRef.current) return;
    fetchBusyRef.current = true;
    const promises: Array<Promise<void>> = [];
    const next: Record<number, number | null> = {};
    for (const r of rows) {
      const o = originOf(r);
      const op = asPoint(o);
      if (!op) {
        next[r.id] = null;
        continue;
      }
      promises.push(osrmDistanceKm(searchPoint, op).then((km) => void (next[r.id] = km)));
    }
    Promise.allSettled(promises).then(() => {
      setDistById(next);
      fetchBusyRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchPoint, rows, locById, radiusKm]);

  // ---------- typeahead for localisations ----------
  useEffect(() => {
    const tmr = setTimeout(() => {
      void (async () => {
        setOriginOpts(filters.originName.trim() ? await searchLocalisations(filters.originName.trim()) : []);
      })();
    }, 250);
    return () => clearTimeout(tmr);
  }, [filters.originName]);

  useEffect(() => {
    const tmr = setTimeout(() => {
      void (async () => {
        setDestOpts(filters.destName.trim() ? await searchLocalisations(filters.destName.trim()) : []);
      })();
    }, 250);
    return () => clearTimeout(tmr);
  }, [filters.destName]);

  // ---------- sidebar actions ----------
  async function onApplyFilters(e: React.FormEvent) {
    e.preventDefault();

    setOriginIdSel(pickBestId(filters.originName, originOpts));
    setDestIdSel(pickBestId(filters.destName, destOpts));

    // Geocode “near”
    if (qNear.trim()) {
      try {
        const geo = await api.get(GEO_PROXY, { params: { q: qNear.trim() } });
        const pt: Point | null =
          geo?.data?.point &&
          typeof geo.data.point.lat === "number" &&
          typeof geo.data.point.lon === "number"
            ? geo.data.point
            : null;
        if (pt) {
          setSearchPoint(pt);
          setSearchLabel(geo?.data?.label || qNear.trim());
        } else {
          setSearchPoint(null);
          setSearchLabel("");
        }
      } catch {
        setSearchPoint(null);
        setSearchLabel("");
      }
    } else {
      setSearchPoint(null);
      setSearchLabel("");
    }
  }

  function onClearFilters() {
    setFilters({
      originName: "",
      destName: "",
      startFrom: "",
      endUntil: "",
      crew: "any",
      sort: "date_start",
    });
    setOriginIdSel(undefined);
    setDestIdSel(undefined);
    setVehTypeChecked({});
    setQNear("");
    setSearchPoint(null);
    setSearchLabel("");
  }

  // ---------- CLIENT-SIDE filtering + sorting ----------
  const displayedRows = useMemo(() => {
    const norm = (s: string) => s.normalize("NFKD").toLowerCase().trim();

    const originNameNeedle = norm(filters.originName);
    const destNameNeedle = norm(filters.destName);

    const vehSelectedIds = new Set(
      Object.entries(vehTypeChecked)
        .filter(([, v]) => v)
        .map(([k]) => Number(k))
    );

    const startFromTs = filters.startFrom ? new Date(filters.startFrom).getTime() : null;
    const endUntilTs = filters.endUntil ? new Date(filters.endUntil).getTime() : null;

    let arr = rows.filter((r) => {
      // origin filter
      if (originIdSel) {
        const oid = typeof r.origin === "number" ? r.origin : (r.origin?.id ?? undefined);
        if (oid !== originIdSel) return false;
      } else if (originNameNeedle) {
        const o = originOf(r);
        const name = norm(o?.name || "");
        if (!name.includes(originNameNeedle)) return false;
      }

      // destination filter
      if (destIdSel) {
        const did = typeof r.destination === "number" ? r.destination : (r.destination?.id ?? undefined);
        if (did !== destIdSel) return false;
      } else if (destNameNeedle) {
        const d = destinationOf(r);
        const name = norm(d?.name || "");
        if (!name.includes(destNameNeedle)) return false;
      }

      // time window (inclusive)
      const tsStart = r.time_start ? new Date(r.time_start).getTime() : null;
      const tsEnd = r.time_end ? new Date(r.time_end).getTime() : null;
      if (startFromTs != null && (tsStart == null || tsStart < startFromTs)) return false;
      if (endUntilTs != null && (tsEnd == null || tsEnd > endUntilTs)) return false;

      // crew
      if (filters.crew !== "any") {
        const c = (r.crew || "").toString().toLowerCase();
        if (c !== filters.crew) return false;
      }

      // vehicle types
      if (vehSelectedIds.size) {
        const vtId =
          typeof r.vehicle_type === "number"
            ? r.vehicle_type
            : (r.vehicle_type as VehicleType | null | undefined)?.id;
        if (!vtId || !vehSelectedIds.has(vtId)) return false;
      }

      // near radius (origin point)
      if (searchPoint) {
        const dist = distById[r.id];
        if (dist == null || !Number.isFinite(dist) || dist > radiusKm) return false;
      }

      return true;
    });

    // ---- sorting helpers (always secondary: start date asc, then id asc) ----
    const ts = (r: RouteRow) => (r.time_start ? new Date(r.time_start).getTime() : Number.POSITIVE_INFINITY);
    const idAsc = (a: RouteRow, b: RouteRow) => (a.id === b.id ? 0 : a.id < b.id ? -1 : 1);
    const secondaries = (a: RouteRow, b: RouteRow) => {
      const d = ts(a) - ts(b);
      return d !== 0 ? d : idAsc(a, b);
    };

    const priceNum = (r: RouteRow) => {
      const p = typeof r.price === "string" ? Number(r.price) : (r.price as number | null | undefined);
      return Number.isFinite(p || NaN) ? (p as number) : Number.POSITIVE_INFINITY;
    };
    const lenNum = (r: RouteRow) => {
      const L = typeof r.length_km === "string" ? Number(r.length_km) : (r.length_km as number | null | undefined);
      return Number.isFinite(L || NaN) ? (L as number) : NaN;
    };
    const ppk = (r: RouteRow) => {
      const p = priceNum(r);
      const L = lenNum(r);
      return Number.isFinite(p) && Number.isFinite(L) && L > 0 ? p / (L as number) : Number.POSITIVE_INFINITY;
    };

    // primary sorting
    switch (filters.sort) {
      case "date_start":
        arr = arr.slice().sort((a, b) => {
          const d = ts(a) - ts(b);
          return d !== 0 ? d : idAsc(a, b);
        });
        break;
      case "price_asc":
        arr = arr.slice().sort((a, b) => {
          const d = priceNum(a) - priceNum(b);
          return d !== 0 ? d : secondaries(a, b);
        });
        break;
      case "price_desc":
        arr = arr.slice().sort((a, b) => {
          const d = priceNum(b) - priceNum(a);
          return d !== 0 ? d : secondaries(a, b);
        });
        break;
      case "ppk_asc":
        arr = arr.slice().sort((a, b) => {
          const d = ppk(a) - ppk(b);
          return d !== 0 ? d : secondaries(a, b);
        });
        break;
      case "ppk_desc":
        arr = arr.slice().sort((a, b) => {
          const d = ppk(b) - ppk(a);
          return d !== 0 ? d : secondaries(a, b);
        });
        break;
      default:
        break;
    }
    return arr;
  }, [
    rows,
    filters.originName,
    filters.destName,
    originIdSel,
    destIdSel,
    filters.startFrom,
    filters.endUntil,
    filters.crew,
    filters.sort,
    vehTypeChecked,
    searchPoint,
    radiusKm,
    distById,
  ]);

  // ---------- table ----------
  const table = useMemo(() => {
    if (loading) return <div>{t("routesList.state.loading")}</div>;
    if (err) return <div style={{ color: "crimson" }}>{err}</div>;
    if (displayedRows.length === 0) {
      return (
        <div>
          {t("routesList.state.empty")}
          {searchPoint ? (
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              {t("routesList.filters.using")} <em>{searchLabel}</em>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", borderSpacing: 0, minWidth: 1040 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={th}>{t("routesList.table.dist")}</th>
              <th style={th}>{t("routesList.table.origin")}</th>
              <th style={th}></th>
              <th style={th}>{t("routesList.table.destination")}</th>
              <th style={th}>{t("routesList.table.lengthKm")}</th>
              <th style={th}>{t("routesList.table.crew")}</th>
              <th style={th}>{t("routesList.table.vehicle")}</th>
              <th style={th}>{t("routesList.table.user")}</th>
              <th style={th}>{t("routesList.table.price")}</th>
              <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>{t("routesList.table.more")}</th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((r) => {
              const o = originOf(r);
              const d = destinationOf(r);
              const sc = stopsCountOf(r);
              const markerDest = sc + 2;

              const { id: ownerId, label: ownerLabel } = getOwnerIdAndLabel(r, userById, userByUsername);

              const crew = (r.crew || "").toString().toLowerCase();
              const crewIcon = crew === "double" ? crewDouble : crewSingle;
              const crewAlt = crew === "double" ? t("routesList.crew.double") : t("routesList.crew.single");

              const distKm = distById[r.id];
              const lenNum =
                typeof r.length_km === "string" ? Number(r.length_km) : (r.length_km as number | undefined | null);

              const startLabel = fmtDateTime(r.time_start);
              const endLabel = fmtDateTime(r.time_end);
              const durationLabel = fmtDurationHHMM(r.time_start, r.time_end);
              const priceLabel = moneyFmt(r.price, (r.currency || "EUR") as string);
              const ppkLabel = pricePerKmFmt(
                r.price,
                typeof lenNum === "number" ? lenNum : null,
                r.currency || "EUR",
              );

              // vehicle type label + attribute badge
              let vehName = "—";
              let vehAttr: string | null = null;
              if (typeof r.vehicle_type === "object" && r.vehicle_type) {
                vehName = (r.vehicle_type as any).name;
                vehAttr = (r.vehicle_type as any).attribute || null;
              } else if (typeof r.vehicle_type === "number") {
                const vt = vehById[r.vehicle_type] || vehTypeOpts.find((v) => v.id === r.vehicle_type);
                vehName = vt?.name || `#${r.vehicle_type}`;
                vehAttr = vt?.attribute || null;
              }

              return (
                <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={tdMono}>
                    {searchPoint ? (distKm == null ? "…" : `${kmFmt(distKm)} ${t("routesList.kmAbbr")}`) : "—"}
                  </td>

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

                  <td
                    style={{ ...tdCenter, width: 40, opacity: 0.7, fontSize: 18 }}
                    title={t("routesList.table.routeArrowTitle")}
                  >
                    {ARROW}
                  </td>

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

                  <td style={tdMono}>
                    <div>
                      <div>{lenNum != null && Number.isFinite(lenNum) ? kmFmt(lenNum) : "—"}</div>
                      <div style={subline}>{durationLabel}</div>
                    </div>
                  </td>

                  <td style={tdCenter}>
                    <img src={crewIcon} alt={crewAlt} title={crewAlt} style={{ height: 20 }} />
                  </td>

                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {vehAttr ? (
                        <AttrBadge title={t("routesList.vehicle.attribute", { attr: (vehAttr[0] || "").toUpperCase() })}>
                          {vehAttr[0].toUpperCase()}
                        </AttrBadge>
                      ) : null}
                      <span>{vehName}</span>
                    </div>
                  </td>

                  <td style={td}>
                    {ownerId ? (
                      <Link
                        to={userPathById(ownerId)}
                        title={t("routesList.openProfile")}
                        style={{ color: "#0a58ca", textDecoration: "underline" }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {ownerLabel}
                      </Link>
                    ) : (
                      ownerLabel
                    )}
                  </td>

                  <td style={tdMono}>
                    <div>
                      <div>{priceLabel}</div>
                      <div style={subline}>{ppkLabel}</div>
                    </div>
                  </td>

                  <td style={{ textAlign: "right" }}>
                    <Link
                      to={`/routes/${r.id}`}
                      style={{
                        display: "inline-block",
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        textDecoration: "none",
                        color: "#111",
                        fontSize: 13,
                      }}
                      title={t("routesList.detailsTitle")}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("routesList.details")}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }, [
    displayedRows,
    err,
    loading,
    distById,
    searchPoint,
    searchLabel,
    locById,
    userById,
    userByUsername,
    vehById,
    vehTypeOpts,
    t,
  ]);

  // ---------- UI ----------
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("routesList.title")}</h2>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 320px) 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Sidebar filters */}
        <aside
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
            position: "sticky",
            top: 8,
          }}
        >
          <form onSubmit={onApplyFilters} style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>{t("routesList.filters.header")}</div>

            <div style={{ fontWeight: 700 }}>{t("routesList.filters.nearHeader")}</div>
            <label style={lbl}>
              <span>{t("routesList.filters.searchNear")}</span>
              <input
                type="text"
                placeholder={t("routesList.filters.searchNearPlaceholder")}
                value={qNear}
                onChange={(e) => setQNear(e.target.value)}
                style={inp}
              />
            </label>

            <label style={lbl}>
              <span>{t("routesList.filters.radius")}</span>
              <select value={radiusKm} onChange={(e) => setRadiusKm(parseInt(e.target.value))} style={inp}>
                {[50, 80, 120, 200, 300].map((k) => (
                  <option key={k} value={k}>
                    {k} {t("routesList.kmAbbr")}
                  </option>
                ))}
              </select>
            </label>

            {searchPoint && (
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {t("routesList.filters.using")} <em>{searchLabel}</em>
              </div>
            )}

            <div style={{ height: 1, background: "#eee", margin: "6px 0" }} />

            <label style={lbl}>
              <span>{t("routesList.filters.originName")}</span>
              <input
                list="origin-list"
                value={filters.originName}
                onChange={(e) => setFilters((p) => ({ ...p, originName: e.target.value }))}
                placeholder={t("routesList.filters.originPlaceholder")}
                style={inp}
              />
              <datalist id="origin-list">
                {originOpts.map((o) => (
                  <option key={o.id} value={o.name} />
                ))}
              </datalist>
            </label>

            <label style={lbl}>
              <span>{t("routesList.filters.destinationName")}</span>
              <input
                list="dest-list"
                value={filters.destName}
                onChange={(e) => setFilters((p) => ({ ...p, destName: e.target.value }))}
                placeholder={t("routesList.filters.destinationPlaceholder")}
                style={inp}
              />
              <datalist id="dest-list">
                {destOpts.map((o) => (
                  <option key={o.id} value={o.name} />
                ))}
              </datalist>
            </label>

            <label style={lbl}>
              <span>{t("routesList.filters.startFrom")}</span>
              <input
                type="datetime-local"
                value={filters.startFrom}
                onChange={(e) => setFilters((p) => ({ ...p, startFrom: e.target.value }))}
                style={inp}
              />
            </label>

            <label style={lbl}>
              <span>{t("routesList.filters.endUntil")}</span>
              <input
                type="datetime-local"
                value={filters.endUntil}
                onChange={(e) => setFilters((p) => ({ ...p, endUntil: e.target.value }))}
                style={inp}
              />
            </label>

            <label style={lbl}>
              <span>{t("routesList.filters.crew")}</span>
              <select
                value={filters.crew}
                onChange={(e) => setFilters((p) => ({ ...p, crew: e.target.value as any }))}
                style={inp}
              >
                <option value="any">{t("routesList.filters.crewAny")}</option>
                <option value="single">{t("routesList.filters.crewSingle")}</option>
                <option value="double">{t("routesList.filters.crewDouble")}</option>
              </select>
            </label>

            {/* Vehicle types checklist */}
            <fieldset style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
              <legend style={{ padding: "0 6px", fontWeight: 700 }}>{t("routesList.filters.vehicleTypes")}</legend>
              <div style={{ display: "grid", gap: 6, maxHeight: 180, overflow: "auto", paddingRight: 4 }}>
                {vehTypeOpts.length === 0 ? (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{t("routesList.state.loading")}</div>
                ) : (
                  vehTypeOpts.map((vt) => (
                    <label key={vt.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={!!vehTypeChecked[vt.id]}
                        onChange={(e) => setVehTypeChecked((p) => ({ ...p, [vt.id]: e.target.checked }))}
                      />
                      <span>{vt.name}</span>
                      {vt.attribute ? (
                        <AttrBadge title={t("routesList.vehicle.attribute", { attr: vt.attribute.toUpperCase() })}>
                          {vt.attribute.toUpperCase()}
                        </AttrBadge>
                      ) : null}
                    </label>
                  ))
                )}
              </div>
              {Object.values(vehTypeChecked).some(Boolean) ? (
                <button
                  type="button"
                  onClick={() => setVehTypeChecked({})}
                  style={{ ...btn, marginTop: 8, background: "#f9fafb" }}
                >
                  {t("routesList.filters.clearVehicleTypes")}
                </button>
              ) : null}
            </fieldset>

            <label style={lbl}>
              <span>{t("routesList.filters.sort")}</span>
              <select
                value={filters.sort}
                onChange={(e) => setFilters((p) => ({ ...p, sort: e.target.value as any }))}
                style={inp}
              >
                <option value="date_start">{t("routesList.filters.sortDateStart")}</option>
                <option value="price_asc">{t("routesList.filters.sortPriceAsc")}</option>
                <option value="price_desc">{t("routesList.filters.sortPriceDesc")}</option>
                <option value="ppk_asc">{t("routesList.filters.sortPPKAsc")}</option>
                <option value="ppk_desc">{t("routesList.filters.sortPPKDesc")}</option>
              </select>
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit" style={btn}>
                {t("routesList.filters.apply")}
              </button>
              <button type="button" onClick={onClearFilters} style={{ ...btn, background: "#f9fafb" }}>
                {t("routesList.filters.clear")}
              </button>
            </div>
          </form>
        </aside>

        {/* Table */}
        <section>{table}</section>
      </div>
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

  async function fetchVehicleTypes(ids: number[]): Promise<VehMap> {
    const out: VehMap = {};
    await Promise.all(
      ids.map(async (id) => {
        if (out[id]) return;
        try {
          const r = await api.get(`${VEH_TYPES_BASE}/${id}`);
          const it = r.data as VehicleType;
          if (it?.id) out[it.id] = it;
        } catch {
          const cached = vehTypeOpts.find((v) => v.id === id);
          out[id] = cached || { id, name: `#${id}`, attribute: null };
        }
      })
    );
    return out;
  }

  // Load full list for the checklist
  async function preloadAllVehicleTypes() {
    const all: VehicleType[] = [];
    let url: string | null = `${VEH_TYPES_BASE}`; // exact path
    const seen = new Set<number>();

    while (url) {
      try {
        const r: AxiosResponse<unknown> = await api.get(url);
        const page = Array.isArray(r.data)
          ? { results: r.data as VehicleType[], next: null as string | null }
          : (r.data as { results?: VehicleType[]; next?: string | null });
        const resultItems: VehicleType[] = page.results || [];
        resultItems.forEach((v: VehicleType) => {
          if (!seen.has(v.id)) {
            seen.add(v.id);
            all.push(v);
          }
        });
        url = page.next || null;
      } catch {
        break;
      }
    }

    setVehTypeOpts(all);
    setVehById((prev) => {
      const next = { ...prev };
      for (const v of all) next[v.id] = v;
      return next;
    });
  }

  // Fetch ALL public profiles (paginated) and build maps by id and by username.
  async function fetchAllProfiles(): Promise<{
    byId: Record<number, UserPublic>;
    byUsername: Record<string, UserPublic>;
  }> {
    const byId: Record<number, UserPublic> = {};
    const byUsername: Record<string, UserPublic> = {};

    let url: string | null = `${USERS_PROFILES_BASE}`;
    while (url) {
      try {
        const r = await api.get(url);
        const page = (Array.isArray(r.data)
          ? { results: r.data as UserPublic[], next: null as string | null }
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

  // Resolve profiles/{id} to get display_name and tie it to id
  async function fetchUserProfiles(ids: number[]): Promise<Record<number, UserPublic>> {
    const byId: Record<number, UserPublic> = {};
    await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await api.get(`${USERS_PROFILES_BASE}/${id}`);
          const p = r.data as UserPublic & { nickname_color?: string; bio?: string; route_stats?: any };
          byId[id] = {
            id: p.id,
            username: p.username,
            display_name: p.display_name,
            first_name: undefined,
            last_name: undefined,
          };
        } catch {
          // ignore missing
        }
      })
    );
    return byId;
  }

  // Localisation typeahead: best-effort (backend may ignore)
  async function searchLocalisations(term: string): Promise<Localisation[]> {
    const tryOnce = async (params: Record<string, any>) => {
      try {
        const r = await api.get(LOCALISATIONS_BASE, { params });
        const arr: Localisation[] = Array.isArray(r.data) ? r.data : r.data.results || [];
        return arr;
      } catch {
        return [];
      }
    };
    let out = await tryOnce({ q: term });
    if (out.length) return out;
    out = await tryOnce({ name__icontains: term });
    if (out.length) return out;
    out = await tryOnce({ search: term });
    return out;
  }

  function pickBestId(typed: string, opts: Localisation[]): number | undefined {
    const t = typed.trim();
    if (!t) return undefined;
    const exact = opts.find((o) => o.name.toLowerCase() === t.toLowerCase());
    if (exact) return exact.id;
    const starts = opts.find((o) => o.name.toLowerCase().startsWith(t.toLowerCase()));
    if (starts) return starts.id;
    const any = opts[0];
    return any?.id;
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

const th: React.CSSProperties = {
  fontWeight: 700,
  padding: "10px 8px",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = { padding: "10px 8px", verticalAlign: "middle", whiteSpace: "nowrap" };
const tdMono: React.CSSProperties = { ...td, fontVariantNumeric: "tabular-nums" };
const tdCenter: React.CSSProperties = { ...td, textAlign: "center" };
const subline: React.CSSProperties = { fontSize: 12, opacity: 0.7, marginTop: 2 };
const lbl: React.CSSProperties = { display: "grid", gap: 6, fontSize: 12, fontWeight: 600 };
const inp: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #ddd",
  borderRadius: 8,
  fontSize: 14,
};
const btn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
  fontSize: 14,
};
