// src/pages/LocalisationsAdd.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { MapContainer, TileLayer, Marker, Popup, AttributionControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const GEO_PROXY_TRY = ["/api/geo/search", "/api/geo/search/"];
const LOCALISATIONS_BASE = "/api/localisations";

type GeoItem = {
  lat: number;
  lon: number;
  display_name?: string;
  name?: string;
  label?: string;
  type?: string;
};

export default function LocalisationsAdd() {
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [results, setResults] = useState<GeoItem[]>([]);
  const [selected, setSelected] = useState<GeoItem | null>(null);

  const defaultLabel = useMemo(
    () => selected?.display_name || selected?.label || selected?.name || "",
    [selected]
  );
  const [saveName, setSaveName] = useState("");
  useEffect(() => setSaveName(defaultLabel), [defaultLabel]);

  // debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // search
  useEffect(() => {
    let on = true;
    async function run() {
      setErr(null);
      setResults([]);
      setSelected(null);
      if (debouncedQ.length < 2) return;

      setBusy(true);
      try {
        const found = await searchNominatimFlexible(debouncedQ, 8);
        if (!on) return;
        setResults(found);
        if (found.length === 1) setSelected(found[0]); // auto-select single response (like your Szczecin example)
      } catch (e: any) {
        if (!on) return;
        setErr(e?.response?.data?.detail || "Search failed.");
      } finally {
        if (on) setBusy(false);
      }
    }
    void run();
    return () => { on = false; };
  }, [debouncedQ]);

  // save
  const [posting, setPosting] = useState(false);
  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!selected) return setErr("Select a localisation first.");
    if (!saveName.trim()) return setErr("Please enter a name.");

    setPosting(true);
    try {
      await api.post(LOCALISATIONS_BASE, {
        name: saveName.trim(),
        latitude: selected.lat,
        longitude: selected.lon,
      });
      nav("/routes/new");
    } catch (e: any) {
      const d = e?.response?.data;
      setErr(
        (d && typeof d === "object"
          ? Object.entries(d)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
              .join("\n")
          : null) || "Could not save localisation."
      );
    } finally {
      setPosting(false);
    }
  }

  // styles
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

  const center: [number, number] = selected ? [selected.lat, selected.lon] : [52.237049, 21.017532];

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Add Localisation</h2>
        <Link to="/routes/new" style={btn} title="Back to new route">
          ← Back to Add Route
        </Link>
      </div>

      {/* Search */}
      <section style={box}>
        <form onSubmit={(e) => e.preventDefault()} style={{ display: "grid", gap: 8 }}>
          <label style={lbl}>
            <span>Search place</span>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="City, address, POI…"
              autoFocus
              style={inp}
            />
          </label>
          {busy ? <div>Searching…</div> : null}
          {err ? <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{err}</div> : null}

          {results.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              {results.map((g, i) => {
                const label = g.display_name || g.label || g.name || `${g.lat}, ${g.lon}`;
                const isSel = selected && g.lat === selected.lat && g.lon === selected.lon;
                return (
                  <button
                    type="button"
                    key={`${g.lat}-${g.lon}-${i}`}
                    onClick={() => setSelected(g)}
                    style={{
                      display: "grid",
                      gap: 4,
                      padding: 8,
                      border: "1px solid " + (isSel ? "#4f46e5" : "#eee"),
                      borderRadius: 8,
                      background: isSel ? "#eef2ff" : "#fff",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                    title="Select this localisation"
                  >
                    <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{label}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {g.type ? `${g.type} · ` : ""}
                      {g.lat.toFixed(6)}, {g.lon.toFixed(6)}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : debouncedQ.length >= 2 && !busy ? (
            <div>No results.</div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.7 }}>Type at least 2 characters…</div>
          )}
        </form>
      </section>

      {/* Map + Save */}
      <section style={{ display: "grid", gap: 8, ...box }}>
        <div style={{ height: 360, borderRadius: 12, overflow: "hidden" }}>
          <MapContainer center={center} zoom={selected ? 12 : 5} style={{ height: "100%", width: "100%" }} attributionControl={false}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <AttributionControl position="bottomright" prefix="" />
            {selected ? (
              <Marker position={[selected.lat, selected.lon]}>
                <Popup>
                  <div style={{ maxWidth: 220 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{defaultLabel || "Selected place"}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {selected.lat.toFixed(6)}, {selected.lon.toFixed(6)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ) : null}
          </MapContainer>
        </div>

        <form onSubmit={onSave} style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <label style={lbl}>
            <span>Save as name</span>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Warehouse A (PL/WAW)"
              style={inp}
            />
          </label>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              readOnly
              value={selected ? selected.lat.toFixed(6) : ""}
              placeholder="lat"
              style={{ ...inp, width: 140 }}
              title="Latitude"
            />
            <input
              type="text"
              readOnly
              value={selected ? selected.lon.toFixed(6) : ""}
              placeholder="lon"
              style={{ ...inp, width: 140 }}
              title="Longitude"
            />
            <button type="submit" disabled={!selected || posting} style={btnPri}>
              {posting ? "Saving…" : "Add localisation"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* ---------------- helpers ---------------- */

/** Parse many possible response shapes into a normalized GeoItem[] */
function normalizeToGeoItems(data: any): GeoItem[] {
  if (!data) return [];

  // 1) Your sample: single object { point:{lat,lon}, label }
  if (!Array.isArray(data) && typeof data === "object") {
    // GeoJSON?
    if (Array.isArray((data as any).features)) {
      const feats = (data as any).features as any[];
      return feats
        .map((f) => {
          const coords = f?.geometry?.coordinates; // [lon, lat]
          const lat = Number(coords?.[1]);
          const lon = Number(coords?.[0]);
          const label = f?.properties?.display_name || f?.properties?.label || f?.properties?.name;
          return Number.isFinite(lat) && Number.isFinite(lon)
            ? ({ lat, lon, display_name: label, name: f?.properties?.name, type: f?.properties?.type } as GeoItem)
            : null;
        })
        .filter(Boolean) as GeoItem[];
    }

    // Wrapped list: { results: [...] }
    if (Array.isArray((data as any).results)) {
      return normalizeToGeoItems((data as any).results);
    }

    // Single object with {point:{lat,lon}} and optional {label}
    if (data.point && (data.point.lat != null) && (data.point.lon != null)) {
      const lat = Number(data.point.lat);
      const lon = Number(data.point.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return [{ lat, lon, display_name: data.display_name, label: data.label, name: data.name, type: data.type }];
      }
    }

    // Single object with top-level lat/lon
    if ((data.lat != null) && (data.lon != null)) {
      const lat = Number(data.lat);
      const lon = Number(data.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return [{ lat, lon, display_name: data.display_name || data.label || data.name, name: data.name, type: data.type }];
      }
    }
  }

  // 2) Array of raw items
  if (Array.isArray(data)) {
    return (data as any[])
      .map((it) => {
        // allow {point:{lat,lon}} or {lat,lon}
        const lat = it?.point ? Number(it.point.lat) : Number(it.lat ?? it.latitude);
        const lon = it?.point ? Number(it.point.lon) : Number(it.lon ?? it.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const label = it.display_name || it.label || it.name;
        return { lat, lon, display_name: label, name: it.name, type: it.type } as GeoItem;
      })
      .filter(Boolean) as GeoItem[];
  }

  return [];
}

async function searchNominatimFlexible(q: string, limit = 8): Promise<GeoItem[]> {
  const params = { q, limit };
  for (const base of GEO_PROXY_TRY) {
    try {
      const r = await api.get(base, { params });
      const norm = normalizeToGeoItems(r.data);
      if (norm.length) return norm;
    } catch {
      // try next variant
    }
  }
  return [];
}
