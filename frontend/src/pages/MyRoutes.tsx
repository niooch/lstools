// src/pages/MyRoutes.tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Route } from "../types";

export default function MyRoutes() {
    const [tab, setTab] = useState<"active" | "history">("active");
    const [items, setItems] = useState<Route[]>([]);
    const [priceMap, setPriceMap] = useState<Record<number, string>>({});

    async function load() {
        const path = tab === "active" ? "/api/transport/routes/mine" : "/api/transport/routes/mine/history";
        const r = await api.get(path);
        const data: Route[] = Array.isArray(r.data) ? r.data : r.data.results || [];
        setItems(data);
    }

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

    async function cancel(id: number) {
        await api.post(`/api/transport/routes/${id}/cancel`);
        load();
    }
    async function sell(id: number) {
        const price = priceMap[id];
        await api.post(`/api/transport/routes/${id}/sell`, price ? { price } : {});
        load();
    }

    return (
        <div>
        <h2>My Routes</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setTab("active")} disabled={tab === "active"}>Active</button>
        <button onClick={() => setTab("history")} disabled={tab === "history"}>History</button>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
        {items.map((r) => (
            <div key={r.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <strong>#{r.id} · {r.status.toUpperCase()}</strong>
            <div style={{ display: "flex", gap: 8 }}>
            {r.status === "active" ? (
                <>
                <input
                placeholder={`price (${r.currency})`}
                value={priceMap[r.id] ?? ""}
                onChange={(e) => setPriceMap({ ...priceMap, [r.id]: e.target.value })}
                style={{ width: 120 }}
                />
                <button onClick={() => sell(r.id)}>Sell</button>
                <button onClick={() => cancel(r.id)}>Cancel</button>
                </>
            ) : null}
            </div>
            </div>
            <div>len: {r.length_km ?? "?"} km · price: {r.price ?? "?"} {r.currency} · ppk: {r.price_per_km ?? "-"}</div>
            {r.stops?.length ? <div>stops: {r.stops.map(s => s.name).join(" → ")}</div> : null}
            </div>
        ))}
        </div>
        </div>
    );
}

