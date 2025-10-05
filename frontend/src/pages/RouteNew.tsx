import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";

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
  attribute?: string | null; // single letter
};

type Crew = "single" | "double";

const MAX_STOPS = 5;

export default function RouteNew() {
  const nav = useNavigate();
  const { t } = useTranslation();

  const [locs, setLocs] = useState<Localisation[]>([]);
  const [vehTypes, setVehTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form state by names (we’ll map to ids on submit)
  const [originName, setOriginName] = useState("");
  const [destName, setDestName] = useState("");
  const [stopNames, setStopNames] = useState<string[]>([""]); // dynamic chain

  // NEW: split date & time into separate fields
  const [dateStart, setDateStart] = useState(""); // yyyy-MM-dd
  const [timeStart, setTimeStart] = useState(""); // HH:mm
  const [dateEnd, setDateEnd] = useState("");     // yyyy-MM-dd
  const [timeEnd, setTimeEnd] = useState("");     // HH:mm

  const [vehName, setVehName] = useState("");
  const [crew, setCrew] = useState<Crew>("single");
  const [currency, setCurrency] = useState<"PLN" | "EUR">("PLN");
  const [price, setPrice] = useState<string>("");

  // pretty address for origin/dest (best effort)
  const [originAddr, setOriginAddr] = useState<string | null>(null);
  const [destAddr, setDestAddr] = useState<string | null>(null);

  // quick lookup maps
  const locByName = useMemo(() => {
    const m: Record<string, Localisation> = {};
    for (const l of locs) {
      if (!l?.name) continue;
      m[l.name.toLowerCase()] = l;
    }
    return m;
  }, [locs]);

  const vehByName = useMemo(() => {
    const m: Record<string, VehicleType> = {};
    for (const v of vehTypes) m[v.name.toLowerCase()] = v;
    return m;
  }, [vehTypes]);

  // load lists (with pagination, and with endpoint fallbacks)
  useEffect(() => {
    let on = true;
    async function loadAll() {
      try {
        setLoading(true);
        setErr(null);

        const locsAll = await fetchAllLocalisations();
        const vehAll = await fetchAllVehicleTypes();

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

  // dynamic stops: ensure a trailing empty input until we hit MAX
  useEffect(() => {
    const trimmed = stopNames.map(s => s.trim());
    const last = trimmed[trimmed.length - 1] ?? "";
    if (trimmed.length < MAX_STOPS && last.length > 0) {
      setStopNames(prev => [...prev, ""]);
    }
    // also, if there are trailing empties >1, squash to a single empty
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

  // fetch pretty address for a selected localisation (best effort)
  useEffect(() => {
    void resolveAddressFor(originName, setOriginAddr, locByName);
  }, [originName, locByName]);
  useEffect(() => {
    void resolveAddressFor(destName, setDestAddr, locByName);
  }, [destName, locByName]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (posting) return;
    setErr(null);

    try {
      // validate names → ids
      const originId = locByName[originName.trim().toLowerCase()]?.id;
      const destId = locByName[destName.trim().toLowerCase()]?.id;
      const vehId = vehByName[vehName.trim().toLowerCase()]?.id;

      if (!originId) throw new Error(t("routeNew.errors.unknownOrigin", { name: originName }));
      if (!destId) throw new Error(t("routeNew.errors.unknownDestination", { name: destName }));
      if (!vehId) throw new Error(t("routeNew.errors.unknownVehicle", { name: vehName }));

      // NEW: combine separate date/time into ISO
      const startISO = combineLocalDateTimeToISO(dateStart, timeStart);
      const endISO = combineLocalDateTimeToISO(dateEnd, timeEnd);
      if (!startISO) throw new Error(t("routeNew.errors.invalidStartDT", "Invalid start date/time"));
      if (!endISO) throw new Error(t("routeNew.errors.invalidEndDT", "Invalid end date/time"));

      // Optional sanity check: end after start
      if (new Date(endISO).getTime() < new Date(startISO).getTime()) {
        throw new Error(t("routeNew.errors.endBeforeStart", "End must be after start"));
      }

      // stops: keep only non-empty and map
      const stopIds: number[] = stopNames
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, MAX_STOPS)
        .map((name) => {
          const id = locByName[name.toLowerCase()]?.id;
          if (!id) throw new Error(t("routeNew.errors.unknownStop", { name }));
          return id;
        });

      const payload: any = {
        origin: originId,
        destination: destId,
        time_start: startISO, // server expects ISO
        time_end: endISO,
        vehicle_type: vehId,
        crew,
        currency,
        price: price ? price : null,
      };
      if (stopIds.length) payload.stop_ids = stopIds;

      setPosting(true);
      await api.post("/api/transport/routes", payload);
      nav("/routes");
    } catch (e: any) {
      const msg =
        typeof e?.message === "string"
          ? e.message
          : e?.response?.data?.detail || stringifyErrors(e?.response?.data) || t("routeNew.errors.create");
      setErr(msg);
    } finally {
      setPosting(false);
    }
  }

  // helpers
  const allLocNames = useMemo(() => locs.map((l) => l.name).sort(), [locs]);
  const allVehNames = useMemo(() => vehTypes.map((v) => v.name).sort(), [vehTypes]);

  const selectedVeh = useMemo(() => vehByName[vehName.trim().toLowerCase()], [vehByName, vehName]);
  const selectedVehLetter = selectedVeh?.attribute?.slice(0, 1)?.toUpperCase() || null;

  const moreCount = Math.max(0, allLocNames.length - 20);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0 16px" }}>{t("routeNew.title")}</h2>

      {loading ? (
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          {t("routeNew.loading")}
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          {err && (
            <div style={{ color: "#8b0000", background: "#ffecec", border: "1px solid #ffd0d0", padding: 10, borderRadius: 8 }}>
              {String(err)}
            </div>
          )}

          {/* localisation quick hint list */}
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            {t("routeNew.knownCodes")}{" "}
            <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
              {allLocNames.slice(0, 20).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    // smart paste into first empty localisation field
                    if (!originName) setOriginName(n);
                    else if (!stopNames.find((s) => !s.trim())) setStopNames((prev) => [...prev, n]);
                    else {
                      // fill first empty stop
                      const idx = stopNames.findIndex((s) => !s.trim());
                      if (idx >= 0) setStopNames((prev) => prev.map((s, i) => (i === idx ? n : s)));
                      else if (!destName) setDestName(n);
                    }
                  }}
                  style={{
                    fontFamily: "monospace",
                    border: "1px dashed #ddd",
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: "#fafafa",
                    cursor: "pointer",
                  }}
                  title={t("common.clickToFill")}
                >
                  {n}
                </button>
              ))}
              {moreCount > 0 && <span>{t("routeNew.andMore", { count: moreCount })}</span>}
            </span>
          </div>

          {/* shared datalist for localisation names */}
          <datalist id="loc-options">
            {allLocNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          {/* origin */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>{t("routeNew.fields.origin")}</label>
            <input
              list="loc-options"
              placeholder={t("routeNew.placeholders.origin")}
              value={originName}
              onChange={(e) => setOriginName(e.target.value)}
              required
            />
            {originAddr ? <div style={{ fontSize: 12, opacity: 0.8 }}>📍 {originAddr}</div> : null}
          </div>

          {/* stops (dynamic) */}
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ fontWeight: 600 }}>{t("routeNew.fields.stops", { max: MAX_STOPS })}</label>
            <div style={{ display: "grid", gap: 8 }}>
              {stopNames.slice(0, MAX_STOPS).map((name, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    list="loc-options"
                    placeholder={i === 0 ? t("routeNew.placeholders.firstStop") : t("routeNew.placeholders.stop")}
                    value={name}
                    onChange={(e) =>
                      setStopNames((prev) => prev.map((s, idx) => (idx === i ? e.target.value : s)))
                    }
                  />
                  {name.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setStopNames((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                      title={t("routeNew.actions.removeStop")}
                      style={{
                        border: "1px solid #eee",
                        background: "#fafafa",
                        padding: "6px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* destination */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>{t("routeNew.fields.destination")}</label>
            <input
              list="loc-options"
              placeholder={t("routeNew.placeholders.destination")}
              value={destName}
              onChange={(e) => setDestName(e.target.value)}
              required
            />
            {destAddr ? <div style={{ fontSize: 12, opacity: 0.8 }}>📍 {destAddr}</div> : null}
          </div>

          {/* NEW: date & time pickers (calendar + time) */}
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontWeight: 600 }}>{t("routeNew.fields.dateStart", "Start date")}</label>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontWeight: 600 }}>{t("routeNew.fields.timeStart", "Start time")}</label>
                <input
                  type="time"
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                  step={300} // 5-minute steps
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontWeight: 600 }}>{t("routeNew.fields.dateEnd", "End date")}</label>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontWeight: 600 }}>{t("routeNew.fields.timeEnd", "End time")}</label>
                <input
                  type="time"
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                  step={300}
                  required
                />
              </div>
            </div>
          </div>

          {/* vehicle type (by name) + attribute bubble */}
          <datalist id="veh-options">
            {allVehNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>{t("routeNew.fields.vehicleType")}</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                list="veh-options"
                placeholder={t("routeNew.placeholders.vehicle")}
                value={vehName}
                onChange={(e) => setVehName(e.target.value)}
                required
              />
              {selectedVehLetter && (
                <span
                  title={t("routeNew.attributeTitle", { attr: selectedVehLetter })}
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: "1px solid #ddd",
                    background: "#fff",
                    fontWeight: 700,
                    fontFamily: "monospace",
                  }}
                >
                  {selectedVehLetter}
                </span>
              )}
            </div>
          </div>

          {/* crew selector with icons */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>{t("routeNew.fields.crew")}</label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <CrewOption
                label={t("routeNew.crew.single")}
                icon="/icons/crew-single.png"
                active={crew === "single"}
                onClick={() => setCrew("single")}
              />
              <CrewOption
                label={t("routeNew.crew.double")}
                icon="/icons/crew-double.png"
                active={crew === "double"}
                onClick={() => setCrew("double")}
              />
            </div>
          </div>

          {/* price & currency */}
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>{t("routeNew.fields.priceOptional")}</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder={t("routeNew.placeholders.price")}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>{t("routeNew.fields.currency")}</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                <option value="PLN">PLN</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button type="submit" disabled={posting} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #ddd" }}>
              {posting ? t("routeNew.actions.creating") : t("routeNew.actions.create")}
            </button>
            <button
              type="button"
              onClick={() => nav(-1)}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #eee", background: "#fafafa" }}
            >
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

/**
 * Combine local date (yyyy-MM-dd) and time (HH:mm) to an ISO string.
 * Keeps the user's local timezone offset (so the server can interpret correctly).
 */
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

    // best-effort: reuse backend nominatim proxy to avoid CORS
    const q = `${lat},${lon}`;
    const r = await api.get("/api/geo/search", { params: { q, limit: 1 } }).catch(() => null as any);
    const arr = (r?.data as any[]) || [];
    if (arr.length && (arr[0].display_name || arr[0].name)) {
      set(arr[0].display_name || arr[0].name);
    }
  } catch {
    /* ignore */
  }
}

function CrewOption({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid " + (active ? "#4f46e5" : "#e5e7eb"),
        background: active ? "#eef2ff" : "#fff",
        cursor: "pointer",
      }}
      title={label}
    >
      <img src={icon} alt="" style={{ width: 24, height: 24, objectFit: "contain" }} />
      <span>{label}</span>
      {active && (
        <span style={{ marginLeft: 4, fontSize: 12, opacity: 0.8 }}>✓</span>
      )}
    </button>
  );
}

/* ---------- data fetchers with fallback ---------- */

async function fetchAllLocalisations(): Promise<Localisation[]> {
  // try proper path first
  const all = await fetchAllPaginated<Localisation>("/api/localisations");
  if (all.length) return all;
  // fallback for the typo path if needed
  try {
    const alt = await fetchAllPaginated<Localisation>("/api/localistations");
    return alt;
  } catch {
    return all;
  }
}

async function fetchAllVehicleTypes(): Promise<VehicleType[]> {
  try {
    const v = await fetchAllPaginated<VehicleType>("/api/transport/vehicle-types");
    if (v.length) return v;
  } catch {
    // fall through
  }
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
  // tolerate both paginated and unpaginated responses
  while (next) {
    const r = await api.get(next);
    const data = r.data;
    if (Array.isArray(data)) {
      out.push(...(data as T[]));
      break;
    }
    if (data?.results && Array.isArray(data.results)) {
      out.push(...(data.results as T[]));
      next = data.next || null;
    } else if (data) {
      // maybe a single object?
      out.push(data as T);
      break;
    } else {
      break;
    }
  }
  return out;
}
