import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { ChatMessage } from "../types";

export default function Chat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [text, setText] = useState("");
    const [routeFilter, setRouteFilter] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const lastIdRef = useRef<number | null>(null);

    async function load(initial = false) {
        setLoading(true);
        const params = new URLSearchParams();
        if (!initial && lastIdRef.current) params.set("after_id", String(lastIdRef.current));
        if (routeFilter) params.set("route", routeFilter);
        const r = await api.get(`/api/chat/messages${params.toString() ? `?${params}` : ""}`);
        const data: ChatMessage[] = Array.isArray(r.data) ? r.data : (r.data.results || []);
        if (initial) {
            setMessages(data);
            lastIdRef.current = data.length ? data[data.length - 1].id : null;
        } else if (data.length) {
            setMessages((prev) => [...prev, ...data]);
            lastIdRef.current = data[data.length - 1].id;
        }
        setLoading(false);
    }

    useEffect(() => { load(true); /* eslint-disable-next-line */ }, []);
    useEffect(() => { load(true); /* eslint-disable-next-line */ }, [routeFilter]);

    useEffect(() => {
        const t = setInterval(() => load(false), 4000);
        return () => clearInterval(t);
    }, []);

    async function send(e: React.FormEvent) {
        e.preventDefault();
        if (!text.trim()) return;
        const payload: any = { content: text.trim() };
        if (routeFilter) payload.route = Number(routeFilter);
        const { data } = await api.post("/api/chat/messages", payload);
        setMessages((prev) => [...prev, data]);
        lastIdRef.current = data.id;
        setText("");
    }

    return (
        <div>
        <h2>Chat</h2>
        <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input placeholder="filter by route id" value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)} style={{ width: 160 }} />
        <button onClick={() => load(true)}>Apply</button>
        <button onClick={() => { setRouteFilter(""); load(true); }}>Clear</button>
        </form>

        <div style={{ display: "grid", gap: 8, border: "1px solid #eee", padding: 8, borderRadius: 8, maxHeight: 420, overflow: "auto" }}>
        {messages.map((m) => (
            <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ fontWeight: 600, color: m.user.nickname_color }}>{m.user.username}</span>
            <span>·</span>
            <span>{m.content}</span>
            {m.route_label ? <span style={{ marginLeft: "auto", fontStyle: "italic" }}>{m.route_label}</span> : null}
            </div>
        ))}
        {loading ? <div>Loading…</div> : null}
        </div>

        <form onSubmit={send} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="write a message…" style={{ flex: 1 }} />
        <button type="submit">Send</button>
        </form>
        </div>
    );
}

