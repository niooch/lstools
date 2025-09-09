// src/pages/RouteNew.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function RouteNew() {
    const [form, setForm] = useState({
        origin: "", destination: "", time_start: "", time_end: "",
        vehicle_type: "", crew: "single", currency: "PLN", price: "", stop_ids: "" // comma-separated
    });
    const [err, setErr] = useState<string | null>(null);
    const nav = useNavigate();

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        try {
            const payload: any = {
                origin: Number(form.origin),
                destination: Number(form.destination),
                time_start: new Date(form.time_start).toISOString(),
                time_end: new Date(form.time_end).toISOString(),
                vehicle_type: Number(form.vehicle_type),
                crew: form.crew, currency: form.currency, price: form.price ? form.price : null,
            };
            const stopIds = form.stop_ids.split(",").map(s => s.trim()).filter(Boolean).map(Number);
            if (stopIds.length) payload.stop_ids = stopIds;

            const { data } = await api.post("/api/transport/routes", payload);
            nav(`/routes`);
        } catch (e: any) {
            setErr(e.response?.data || e.message);
        }
    }

    return (
        <form onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 540 }}>
        <h2>New Route</h2>
        <input placeholder="origin ID" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} required />
        <input placeholder="destination ID" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required />
        <input type="datetime-local" value={form.time_start} onChange={(e) => setForm({ ...form, time_start: e.target.value })} required />
        <input type="datetime-local" value={form.time_end} onChange={(e) => setForm({ ...form, time_end: e.target.value })} required />
        <input placeholder="vehicle type ID" value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} required />
        <select value={form.crew} onChange={(e) => setForm({ ...form, crew: e.target.value })}>
        <option value="single">single</option>
        <option value="double">double</option>
        </select>
        <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
        <option>PLN</option><option>EUR</option>
        </select>
        <input placeholder="price (optional)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <input placeholder="stop ids (comma sep, up to 5)" value={form.stop_ids} onChange={(e) => setForm({ ...form, stop_ids: e.target.value })} />
        <button type="submit">Create</button>
        {err ? <pre style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{JSON.stringify(err, null, 2)}</pre> : null}
        </form>
    );
}

