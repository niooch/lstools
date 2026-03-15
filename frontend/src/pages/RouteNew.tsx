// src/pages/RouteNew.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";
import type { AxiosResponse } from "axios";

/* ---------- types ---------- */
type Localisation = {
  id: number;
  name: string;
  latitude?: string | number;
  longitude?: string | number;
  lat?: number;
  lon?: number;
};

type VehicleType = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean;
  category?: string | null;
  attribute?: string | null;
};

type Crew = "single" | "double";

const MAX_STOPS = 5;

/* ---------- component ---------- */
export default function RouteNew() {
  const nav = useNavigate();
  const { t } = useTranslation();

  const [locs, setLocs] = useState<Localisation[]>([]);
  const [vehTypes, setVehTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form state (by readable names; we map to IDs on submit)
  const [originName, setOriginName] = useState("");
  const [destName, setDestName] = useState("");
  const [stopNames, setStopNames] = useState<string[]>([""]); // dynamic list, always keeps one trailing empty

  const [dateStart, setDateStart] = useState(""); // yyyy-MM-dd
  const [timeStart, setTimeStart] = useState(""); // HH:mm
  const [dateEnd, setDateEnd] = useState("");     // yyyy-MM-dd
  const [timeEnd, setTimeEnd] = useState("");     // HH:mm

  const [vehName, setVehName] = useState("");
  const [crew, setCrew] = useState<Crew>("single");
  const [price, setPrice] = useState<string>("");
  const currency = "EUR" as const;

  // pretty addresses (best-effort using your proxy)
  const [originAddr, setOriginAddr] = useState<string | null>(null);
  const [destAddr, setDestAddr] = useState<string | null>(null);

  // quick lookup maps
  const locByName = useMemo(() => {
    const m: Record<string, Localisation> = {};
    for (const l of locs) if (l?.name) m[l.name.toLowerCase()] = l;
    return m;
  }, [locs]);

  const vehByName = useMemo(() => {
    const m: Record<string, VehicleType> = {};
    for (const v of vehTypes) m[v.name.toLowerCase()] = v;
    return m;
  }, [vehTypes]);

  // load dictionaries
  useEffect(() => {
    let on = true;
    async function loadAll() {
      try {
        setLoading(true);
        setErr(null);
        const [locsAll, vehAll] = await Promise.all([
          fetchAllLocalisations(),
          fetchAllVehicleTypes(),
        ]);
        if (!on) return;
        setLocs(locsAll);
        setVehTypes(vehAll);
      } catch (e: any) {
        if (!on) return;
        setErr(e?.response?.data?.detail || t("routeNew.errors.loadDicts"));
      } finally {
        if (on) setLoading(false);
      }
    }
    loadAll();
    return () => { on = false; };
  }, [t]);

  // keep a single trailing empty stop input, up to MAX_STOPS
  useEffect(() => {
    const trimmed = stopNames.map((s) => s.trim());
    const last = trimmed[trimmed.length - 1] ?? "";
    if (trimmed.length < MAX_STOPS && last.length > 0) {
      setStopNames((prev) => [...prev, ""]);
      return;
    }
    // collapse extra trailing empties to just one
    if (trimmed.length > 1) {
      let i = trimmed.length - 1;
      let empties = 0;
      while (i >= 0 && trimmed[i] === "") { empties++; i--; }
      if (empties > 1) {
        const base = trimmed.slice(0, trimmed.length - empties);
        setStopNames([...base, ""]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopNames.join("|")]);

  // resolve pretty address for origin/destination (optional)
  useEffect(() => { void resolveAddressFor(originName, setOriginAddr, locByName); }, [originName, locByName]);
  useEffect(() => { void resolveAddressFor(destName, setDestAddr, locByName); }, [destName, locByName]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (posting) return;

    setErr(null);
    try {
      const originId = locByName[originName.trim().toLowerCase()]?.id;
      const destId = locByName[destName.trim().toLowerCase()]?.id;
      if (!originId || !destId) {
        throw new Error(t("routeNew.errors.pickKnownLocalisations"));
      }

      // map stopNames (excluding empty trailing input and excluding origin/destination if duplicated)
      const stopIds = stopNames
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
        .map((n) => locByName[n.toLowerCase()]?.id)
        .filter((id): id is number => typeof id === "number")
        .filter((id) => id !== originId && id !== destId);

      const vehId = vehByName[vehName.trim().toLowerCase()]?.id;
      const time_start = combineLocalDateTimeToISO(dateStart, timeStart);
      const time_end = combineLocalDateTimeToISO(dateEnd, timeEnd);

      const payload: any = {
        origin: originId,
        destination: destId,
        stop_ids: stopIds,
        vehicle_type: vehId || undefined,
        crew,
        currency,
        price: price ? Number(price) : undefined,
        time_start,
        time_end,
      };

      setPosting(true);
      await api.post("/api/transport/routes", payload);
      nav("/routes");
    } catch (e: any) {
      setErr(
        e?.response?.data
          ? stringifyErrors(e.response.data) || t("routeNew.errors.couldNotCreate")
          : e?.message || t("routeNew.errors.couldNotCreate")
      );
    } finally {
      setPosting(false);
    }
  }

  /* ---------- styles ---------- */
  const box: React.CSSProperties = { border: "1px solid #eee", borderRadius: 12, padding: 12 };
  const lbl: React.CSSProperties = { display: "grid", gap: 6 };
  const inp: React.CSSProperties = { padding: 8, border: "1px solid #ccc", borderRadius: 6 };
  const btn: React.CSSProperties = {
    padding: "8px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
  };
  const btnPri: React.CSSProperties = { ...btn, background: "#0a7", color: "#fff", borderColor: "#0a7" };
  const btnLink: React.CSSProperties = { ...btn, textDecoration: "none", color: "#111" };
  const chip: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    fontSize: 12,
    background: "#fff",
  };

  const allLocNames = useMemo(() => locs.map((l) => l.name).sort(), [locs]);
  const allVehNames = useMemo(() => vehTypes.map((v) => v.name).sort(), [vehTypes]);

  /* ---------- UI ---------- */
  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: "8px 0 16px" }}>{t("routeNew.title")}</h2>
        <Link to="/localisations/new" style={btnLink} title={t("routeNew.buttons.addLocalisation")}>
          {t("routeNew.buttons.addLocalisation")}
        </Link>
      </div>

      {loading ? (
        <div style={{ ...box }}>{t("routeNew.loading")}</div>
      ) : (
        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          {err && (
            <div style={{ color: "#8b0000", background: "#ffecec", border: "1px solid #ffd0d0", padding: 10, borderRadius: 8 }}>
              {String(err)}
            </div>
          )}

          {/* shared datalists */}
          <datalist id="loc-options">
            {allLocNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <datalist id="veh-options">
            {allVehNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          {/* Origin */}
          <section style={box}>
            <label style={lbl}>
              <span>{t("routeNew.origin")}</span>
              <input
                list="loc-options"
                value={originName}
                onChange={(e) => setOriginName(e.target.value)}
                placeholder={t("routeNew.placeholders.selectKnownLocalisation")}
                style={inp}
              />
            </label>
            {originAddr ? <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{originAddr}</div> : null}
          </section>

          {/* Stops (restored) */}
          <section style={{ ...box, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{t("routeNew.stops")}</strong>
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                {t("routeNew.upToNStops", { n: MAX_STOPS - 1 })}
              </span>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {stopNames.map((name, idx) => {
                const lastEmpty = idx === stopNames.length - 1 && name.trim() === "";
                const canRemove = stopNames.length > 1 && !lastEmpty;
                return (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      list="loc-options"
                      value={name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setStopNames((prev) => prev.map((s, i) => (i === idx ? v : s)));
                      }}
                      placeholder={
                        lastEmpty
                          ? t("routeNew.placeholders.addStop")
                          : t("routeNew.placeholders.stop", { n: idx + 1 })
                      }
                      style={{ ...inp, flex: 1 }}
                    />
                    {canRemove ? (
                      <button
                        type="button"
                        onClick={() => setStopNames((prev) => prev.filter((_, i) => i !== idx))}
                        style={btn}
                        title={t("routeNew.buttons.removeStopTitle")}
                      >
                        {t("routeNew.buttons.removeStop")}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* visual summary chips (only confirmed stops) */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {stopNames
                .map((n) => n.trim())
                .filter((n) => n.length > 0)
                .map((n, i) => (
                  <span key={i} style={chip}>{n}</span>
                ))}
            </div>
          </section>

          {/* Destination */}
          <section style={box}>
            <label style={lbl}>
              <span>{t("routeNew.destination")}</span>
              <input
                list="loc-options"
                value={destName}
                onChange={(e) => setDestName(e.target.value)}
                placeholder={t("routeNew.placeholders.selectKnownLocalisation")}
                style={inp}
              />
            </label>
            {destAddr ? <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{destAddr}</div> : null}
          </section>

          {/* Vehicle */}
          <section style={box}>
            <label style={lbl}>
              <span>{t("routeNew.vehicleType")}</span>
              <input
                list="veh-options"
                value={vehName}
                onChange={(e) => setVehName(e.target.value)}
                placeholder={t("routeNew.placeholders.vehicleOptional")}
                style={inp}
              />
            </label>
          </section>

          {/* Time & price */}
          <section style={{ ...box, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={lbl}>
                <span>{t("routeNew.startDate")}</span>
                <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} style={inp} />
              </label>
              <label style={lbl}>
                <span>{t("routeNew.startTime")}</span>
                <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} style={inp} />
              </label>
              <label style={lbl}>
                <span>{t("routeNew.endDate")}</span>
                <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} style={inp} />
              </label>
              <label style={lbl}>
                <span>{t("routeNew.endTime")}</span>
                <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} style={inp} />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label style={lbl}>
                <span>{t("routeNew.price")}</span>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={t("routeNew.placeholders.price")}
                  style={inp}
                />
              </label>
              <label style={lbl}>
                <span>{t("routeNew.currency")}</span>
                <input value={currency} readOnly style={inp} />
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input type="radio" name="crew" checked={crew === "single"} onChange={() => setCrew("single")} />
                  <span>{t("routeNew.crewSingle")}</span>
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input type="radio" name="crew" checked={crew === "double"} onChange={() => setCrew("double")} />
                  <span>{t("routeNew.crewDouble")}</span>
                </label>
              </div>
            </div>
          </section>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={posting} style={btnPri}>
              {posting ? t("common.saving") : t("routeNew.save")}
            </button>
            <button type="button" onClick={() => nav("/routes")} style={btn}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function stringifyErrors(data: any): string | null {
  if (!data || typeof data !== "object") return null;
  try {
    return Object.entries(data)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
      .join("\n");
  } catch {
    return null;
  }
}

/** Combine local date (yyyy-MM-dd) and time (HH:mm) to ISO string. */
function combineLocalDateTimeToISO(dateStr: string, timeStr: string): string | null {
  const d = (dateStr || "").trim();
  const t = (timeStr || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(t)) return null;
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  if (hh > 23 || mm > 59) return null;
  const dt = new Date(y, m - 1, day, hh, mm, 0, 0);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

// Resolve pretty address using your backend Nominatim proxy (best-effort)
async function resolveAddressFor(
  name: string,
  set: (s: string | null) => void,
  locMap: Record<string, Localisation>
) {
  try {
    set(null);
    const loc = locMap[name.trim().toLowerCase()];
    if (!loc) return;
    const lat = (loc.latitude ?? loc.lat) as any;
    const lon = (loc.longitude ?? loc.lon) as any;
    if (lat == null || lon == null) return;

    const q = `${lat},${lon}`;
    const r = await api.get("/api/geo/search", { params: { q, limit: 1 } }).catch(() => null as any);
    const data = r?.data;
    const label =
      (Array.isArray(data) ? data[0]?.display_name || data[0]?.label : data?.display_name || data?.label) || null;
    set(label);
  } catch {
    /* ignore */
  }
}

/* ---------- data fetchers ---------- */

async function fetchAllLocalisations(): Promise<Localisation[]> {
  const all = await fetchAllPaginated<Localisation>("/api/localisations");
  if (all.length) return all;
  // fallback if an alternative path exists in your setup
  try {
    const alt = await fetchAllPaginated<Localisation>("/api/localisations/localisations");
    return alt;
  } catch {
    return all;
  }
}

async function fetchAllVehicleTypes(): Promise<VehicleType[]> {
  try {
    const v = await fetchAllPaginated<VehicleType>("/api/transport/vehicle-types");
    if (v.length) return v;
  } catch {}
  try {
    const v2 = await fetchAllPaginated<VehicleType>("/api/vehicle-types");
    return v2;
  } catch {
    return [];
  }
}

async function fetchAllPaginated<T = any>(url: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = url;
  while (next) {
    const r: AxiosResponse<unknown> = await api.get(next);
    const data = r.data;
    if (Array.isArray(data)) {
      out.push(...(data as T[]));
      break;
    }
    if (data && typeof data === "object" && "results" in data) {
      const page = data as { results?: T[]; next?: string | null };
      if (Array.isArray(page.results)) out.push(...page.results);
      next = page.next || null;
      continue;
    }
    if (data) {
      out.push(data as T);
      break;
    }
    break;
  }
  return out;
}
