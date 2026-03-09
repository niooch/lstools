import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { MapContainer, TileLayer, Marker, Popup, AttributionControl, useMap } from "react-leaflet";
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
const DEFAULT_CENTER: [number, number] = [52.237049, 21.017532];

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
  const { t } = useTranslation();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [results, setResults] = useState<GeoItem[]>([]);
  const [selectedSearch, setSelectedSearch] = useState<GeoItem | null>(null);

  const [latInput, setLatInput] = useState("");
  const [lonInput, setLonInput] = useState("");
  const [saveName, setSaveName] = useState("");
  const [posting, setPosting] = useState(false);

  const manualPoint = useMemo(() => parsePoint(latInput, lonInput), [latInput, lonInput]);
  const activePoint = selectedSearch ?? manualPoint;
  const mapCenter: [number, number] = activePoint ? [activePoint.lat, activePoint.lon] : DEFAULT_CENTER;
  const hasCoordinateInput = latInput.trim().length > 0 || lonInput.trim().length > 0;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let on = true;

    async function run() {
      setSearchErr(null);
      setResults([]);

      if (debouncedQ.length < 2) return;

      setBusy(true);
      try {
        const found = await searchNominatimFlexible(debouncedQ, 8);
        if (!on) return;
        setResults(found);
        if (found.length === 1) {
          selectSearchResult(found[0]);
        }
      } catch (e: any) {
        if (!on) return;
        setSearchErr(e?.response?.data?.detail || t("localisationsAdd.errors.searchFailed"));
      } finally {
        if (on) setBusy(false);
      }
    }

    void run();
    return () => {
      on = false;
    };
  }, [debouncedQ, t]);

  useEffect(() => {
    if (!selectedSearch) return;

    if (manualPoint && samePoint(manualPoint, selectedSearch)) return;

    setSelectedSearch(null);
  }, [latInput, lonInput, manualPoint, selectedSearch]);

  function pinPoint(point: { lat: number; lon: number }, keepSearchSelection = false) {
    if (!keepSearchSelection) {
      setSelectedSearch(null);
    }
    setLatInput(point.lat.toFixed(6));
    setLonInput(point.lon.toFixed(6));
    setSaveErr(null);
  }

  function selectSearchResult(item: GeoItem) {
    setSelectedSearch(item);
    pinPoint(item, true);

    const label = item.display_name || item.label || item.name || "";
    if (label) {
      setSaveName((prev) => (prev.trim() ? prev : label));
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveErr(null);
    if (!activePoint) return setSaveErr(t("localisationsAdd.errors.mustSelectOrEnter"));
    if (!saveName.trim()) return setSaveErr(t("localisationsAdd.errors.mustEnterName"));

    setPosting(true);
    try {
      await api.post(LOCALISATIONS_BASE, {
        name: saveName.trim(),
        latitude: activePoint.lat,
        longitude: activePoint.lon,
      });
      nav("/routes/new");
    } catch (e: any) {
      const d = e?.response?.data;
      setSaveErr(
        (d && typeof d === "object"
          ? Object.entries(d)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
              .join("\n")
          : null) || t("localisationsAdd.errors.couldNotSave")
      );
    } finally {
      setPosting(false);
    }
  }

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

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("localisationsAdd.title")}</h2>
        <Link to="/routes/new" style={btn} title={t("localisationsAdd.backToAddRoute")}>
          {t("localisationsAdd.backToAddRoute")}
        </Link>
      </div>

      <section style={box}>
        <form onSubmit={(e) => e.preventDefault()} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <strong>{t("localisationsAdd.search.title")}</strong>
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              {t("localisationsAdd.search.description")}
            </div>
          </div>

          <label style={lbl}>
            <span>{t("localisationsAdd.search.label")}</span>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("localisationsAdd.search.placeholder")}
              autoFocus
              style={inp}
            />
          </label>

          {busy ? <div>{t("localisationsAdd.search.searching")}</div> : null}
          {searchErr ? <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{searchErr}</div> : null}

          {results.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              {results.map((g, i) => {
                const label = g.display_name || g.label || g.name || `${g.lat}, ${g.lon}`;
                const isSel = !!selectedSearch && samePoint(g, selectedSearch);

                return (
                  <button
                    type="button"
                    key={`${g.lat}-${g.lon}-${i}`}
                    onClick={() => selectSearchResult(g)}
                    style={{
                      display: "grid",
                      gap: 4,
                      padding: 8,
                      border: `1px solid ${isSel ? "#4f46e5" : "#eee"}`,
                      borderRadius: 8,
                      background: isSel ? "#eef2ff" : "#fff",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                    title={t("localisationsAdd.search.selectResult")}
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
            <div>{t("localisationsAdd.search.noResults")}</div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.7 }}>{t("localisationsAdd.search.typeAtLeast", { n: 2 })}</div>
          )}

          <div
            style={{
              display: "grid",
              gap: 12,
              paddingTop: 12,
              borderTop: "1px solid #eee",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <strong>{t("localisationsAdd.manual.title")}</strong>
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                {t("localisationsAdd.manual.description")}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ ...lbl, flex: "1 1 220px" }}>
                <span>{t("localisationsAdd.fields.latitude")}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  placeholder={t("localisationsAdd.placeholders.latitude")}
                  style={inp}
                />
              </label>

              <label style={{ ...lbl, flex: "1 1 220px" }}>
                <span>{t("localisationsAdd.fields.longitude")}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={lonInput}
                  onChange={(e) => setLonInput(e.target.value)}
                  placeholder={t("localisationsAdd.placeholders.longitude")}
                  style={inp}
                />
              </label>
            </div>

            {activePoint ? (
              <div
                style={{
                  border: "1px solid #dbeafe",
                  background: "#eff6ff",
                  borderRadius: 10,
                  padding: 10,
                  fontSize: 14,
                }}
              >
                {t("localisationsAdd.currentPoint", {
                  lat: activePoint.lat.toFixed(6),
                  lon: activePoint.lon.toFixed(6),
                })}
              </div>
            ) : hasCoordinateInput ? (
              <div style={{ fontSize: 13, color: "#b45309" }}>
                {t("localisationsAdd.invalidCoordinates")}
              </div>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.7 }}>{t("localisationsAdd.noPoint")}</div>
            )}
          </div>
        </form>
      </section>

      <section style={{ display: "grid", gap: 8, ...box }}>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          {t("localisationsAdd.map.instructions")}
        </div>
        <div style={{ height: 360, borderRadius: 12, overflow: "hidden" }}>
          <MapContainer center={DEFAULT_CENTER} zoom={activePoint ? 12 : 5} style={{ height: "100%", width: "100%" }} attributionControl={false}>
            <MapViewportSync center={mapCenter} zoom={activePoint ? 12 : 5} />
            <MapPointPicker onPick={pinPoint} />
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <AttributionControl position="bottomright" prefix="" />
            {activePoint ? (
              <Marker
                position={[activePoint.lat, activePoint.lon]}
                draggable
                eventHandlers={{
                  dragend: (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => {
                    const next = e.target.getLatLng();
                    pinPoint({ lat: next.lat, lon: next.lng });
                  },
                }}
              >
                <Popup>
                  <div style={{ maxWidth: 220 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      {saveName.trim() || selectedSearch?.display_name || selectedSearch?.label || t("localisationsAdd.map.selectedPoint")}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {activePoint.lat.toFixed(6)}, {activePoint.lon.toFixed(6)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ) : null}
          </MapContainer>
        </div>

        <form onSubmit={onSave} style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <label style={lbl}>
            <span>{t("localisationsAdd.saveAsName")}</span>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={t("localisationsAdd.placeholders.saveName")}
              style={inp}
            />
          </label>

          {saveErr ? <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{saveErr}</div> : null}

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              readOnly
              value={activePoint ? activePoint.lat.toFixed(6) : ""}
              placeholder={t("localisationsAdd.short.latitude")}
              style={{ ...inp, width: 140 }}
              title={t("localisationsAdd.fields.latitude")}
            />
            <input
              type="text"
              readOnly
              value={activePoint ? activePoint.lon.toFixed(6) : ""}
              placeholder={t("localisationsAdd.short.longitude")}
              style={{ ...inp, width: 140 }}
              title={t("localisationsAdd.fields.longitude")}
            />
            <button type="submit" disabled={!activePoint || posting} style={btnPri}>
              {posting ? t("localisationsAdd.saving") : t("localisationsAdd.submit")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function MapViewportSync({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [map, center, zoom]);

  return null;
}

function MapPointPicker({
  onPick,
}: {
  onPick: (point: { lat: number; lon: number }) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const handleClick = (e: { latlng: { lat: number; lng: number } }) => {
      onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [map, onPick]);

  useEffect(() => {
    const prevCursor = map.getContainer().style.cursor;
    map.getContainer().style.cursor = "crosshair";
    return () => {
      map.getContainer().style.cursor = prevCursor;
    };
  }, [map]);

  return null;
}

function samePoint(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  return a.lat === b.lat && a.lon === b.lon;
}

function parsePoint(latRaw: string, lonRaw: string): GeoItem | null {
  const lat = Number(normalizeCoordinate(latRaw));
  const lon = Number(normalizeCoordinate(lonRaw));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lon < -180 || lon > 180) return null;

  return { lat, lon };
}

function normalizeCoordinate(value: string): string {
  return value.trim().replace(/,/g, ".");
}

function normalizeToGeoItems(data: any): GeoItem[] {
  if (!data) return [];

  if (!Array.isArray(data) && typeof data === "object") {
    if (Array.isArray((data as any).features)) {
      const feats = (data as any).features as any[];
      return feats
        .map((f) => {
          const coords = f?.geometry?.coordinates;
          const lat = Number(coords?.[1]);
          const lon = Number(coords?.[0]);
          const label = f?.properties?.display_name || f?.properties?.label || f?.properties?.name;
          return Number.isFinite(lat) && Number.isFinite(lon)
            ? ({ lat, lon, display_name: label, name: f?.properties?.name, type: f?.properties?.type } as GeoItem)
            : null;
        })
        .filter(Boolean) as GeoItem[];
    }

    if (Array.isArray((data as any).results)) {
      return normalizeToGeoItems((data as any).results);
    }

    if (data.point && data.point.lat != null && data.point.lon != null) {
      const lat = Number(data.point.lat);
      const lon = Number(data.point.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return [{ lat, lon, display_name: data.display_name, label: data.label, name: data.name, type: data.type }];
      }
    }

    if (data.lat != null && data.lon != null) {
      const lat = Number(data.lat);
      const lon = Number(data.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return [{ lat, lon, display_name: data.display_name || data.label || data.name, name: data.name, type: data.type }];
      }
    }
  }

  if (Array.isArray(data)) {
    return (data as any[])
      .map((it) => {
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
      // try next endpoint variant
    }
  }
  return [];
}
