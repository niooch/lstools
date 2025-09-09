// src/pages/RoutesList.tsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Route } from "../types";
import dayjs from "dayjs";

type Page<T> = { results?: T[]; count?: number; next?: string; previous?: string } | T[];

function useData<T>(url: string, deps: any[] = []) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    useEffect(() => {
        let on = true;
        setLoading(true);
        setErr(null);
        api.get(url)
        .then((r) => on && setData(r.data))
        .catch((e) => on && setErr(e.response?.data?.detail || "Error"))
        .finally(() => on && setLoading(false));
        return () => { on = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    return { data, loading, err };
}

export default function RoutesList() {
    const [q, setQ] = useState({ search: "", vehicle_type_slug: "", available_at: "", origin_q: "", radius_km: 10 });
    const query = useMemo(() => {
        const params = new URLSearchParams();
        if (q.search) params.set("search", q.search);
        if (q.vehicle_type_slug) params.set("vehicle_type_slug", q.vehicle_type_slug);
        if (q.available_at) params.set("available_at", q.available_at);
        if (q.origin_q) { params.set("origin_q", q.origin_q); params.set("radius_km", String(q.radius_km)); }
        return params.toString();
    }, [q]);

    const { data, loading, err } = useData<Page<Route>>(`/api/transport/routes${query ? `?${query}` : ""}`, [query]);
    const items: Route[] = Array.isArray(data) ? data : (data?.results || []);

    return (
        <div>
        <h2>Routes</h2>
        <form style={{ display: "grid", gridTemplateColumns: "1fr 160px 200px 1fr 120px auto", gap: 8, marginBottom: 12 }}
        onSubmit={(e) => e.preventDefault()}>
        <input placeholder="search…" value={q.search} onChange={(e) => setQ({ ...q, search: e.target.value })} />
        <input placeholder="type slug" value={q.vehicle_type_slug} onChange={(e) => setQ({ ...q, vehicle_type_slug: e.target.value })} />
        <input type="datetime-local" value={q.available_at}
        onChange={(e) => setQ({ ...q, available_at: e.target.value ? dayjs(e.target.value).toISOString() : "" })} />
        <input placeholder="origin place (nominatim)" value={q.origin_q} onChange={(e) => setQ({ ...q, origin_q: e.target.value })} />
        <input type="number" min={1} placeholder="radius km" value={q.radius_km}
        onChange={(e) => setQ({ ...q, radius_km: Number(e.target.value) })} />
        <button type="button" onClick={() => setQ({ search: "", vehicle_type_slug: "", available_at: "", origin_q: "", radius_km: 10 })}>Clear</button>
        </form>

        {loading && <div>Loading…</div>}
        {err && <div style={{ color: "crimson" }}>{err}</div>}

        <div style={{ display: "grid", gap: 12 }}>
        {items.map((r) => (
            <div key={r.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>#{r.id} · {r.status.toUpperCase()}</strong>
            <span>{dayjs(r.time_start).format("YYYY-MM-DD HH:mm")} → {dayjs(r.time_end).format("HH:mm")}</span>
            </div>
            <div>vehicle: {r.vehicle_type} · crew: {r.crew}</div>
            <div>len: {r.length_km ?? "?"} km · price: {r.price ?? "?"} {r.currency} · ppk: {r.price_per_km ?? "-"}</div>
            {r.stops?.length ? <div>stops: {r.stops.map(s => s.name).join(" → ")}</div> : null}
            </div>
        ))}
        </div>
        </div>
    );
}

