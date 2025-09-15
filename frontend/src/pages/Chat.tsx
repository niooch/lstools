import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { resolveUrl } from "../lib/media";
import { getLastId, mergeUnique } from "../lib/chat";

export type ChatUser = {
  id: number;
  username: string;
  display_name?: string;
  nickname_color: string;
};

export type ChatMessage = {
  id: number;
  user: ChatUser;
  content?: string | null;
  image?: string | null;
  route?: number | null;
  route_label?: string | null;
  created_at: string;
  deleted_at?: string | null;
};

const BASE = "/api/chat/messages";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [posting, setPosting] = useState(false);

  const pollRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // track the last id and “stickiness” to bottom without re-render loops
  const lastIdRef = useRef<number | null>(null);
  const [autoStick, setAutoStick] = useState(true);
  const autoStickRef = useRef(true);
  useEffect(() => { autoStickRef.current = autoStick; }, [autoStick]);

  // how many new messages arrived while user was scrolled up
  const [pendingNew, setPendingNew] = useState(0);

  useEffect(() => {
    lastIdRef.current = messages.length ? messages[messages.length - 1].id : null;
  }, [messages]);

  async function initialLoad() {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.get(BASE);
      const items: ChatMessage[] = Array.isArray(r.data) ? r.data : r.data.results || [];
      items.sort((a, b) => a.id - b.id);
      setMessages(items);
      // start at bottom
      setAutoStick(true);
      requestAnimationFrame(() => scrollToBottom(true));
    } catch (e: any) {
      setErr(e.response?.data?.detail || "Failed to load chat.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchNew() {
    if (loading) return;
    try {
      const lastId = lastIdRef.current;
      const r = await api.get(BASE, { params: lastId ? { after_id: lastId } : {} });
      const items: ChatMessage[] = Array.isArray(r.data) ? r.data : r.data.results || [];
      if (items.length) {
        items.sort((a, b) => a.id - b.id);
        setMessages((prev) => mergeUnique(prev, items));
        // only scroll if user is near the bottom (not browsing old msgs)
        if (autoStickRef.current) {
          requestAnimationFrame(() => scrollToBottom(false));
        } else {
          setPendingNew((n) => n + items.length);
        }
      }
    } catch {
      /* ignore transient polling errors */
    }
  }

  useEffect(() => {
    initialLoad();
    // 10s polling loop
    pollRef.current = window.setInterval(fetchNew, 10_000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function isNearBottom() {
    const el = containerRef.current;
    if (!el) return true;
    const thresholdPx = 80; // “one line” wiggle room
    return el.scrollHeight - el.scrollTop - el.clientHeight < thresholdPx;
  }

  function handleScroll() {
    const near = isNearBottom();
    setAutoStick(near);
    if (near && pendingNew) setPendingNew(0);
  }

  function scrollToBottom(instant: boolean) {
    const el = containerRef.current;
    if (!el) return;
    const behavior: ScrollBehavior = instant ? "auto" : "smooth";
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  async function send() {
    const hasText = text.trim().length > 0;
    const file = fileRef.current?.files?.[0];

    if (!hasText && !file) return;

    setPosting(true);
    setErr(null);
    try {
      if (file) {
        const fd = new FormData();
        if (hasText) fd.append("content", text.trim());
        fd.append("image", file);
        await api.post(BASE, fd);
        fileRef.current!.value = "";
      } else {
        await api.post(BASE, { content: text.trim() });
      }
      setText("");
      // fetch & jump to newest after we send
      await fetchNew();
      setAutoStick(true);
      setPendingNew(0);
      requestAnimationFrame(() => scrollToBottom(false));
    } catch (e: any) {
      setErr(e.response?.data?.detail || "Send failed.");
    } finally {
      setPosting(false);
    }
  }

  function onKeyDownText(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    const isComposing = (e.nativeEvent as any)?.isComposing;
    if (isComposing) return;

    const fileSelected = !!fileRef.current?.files?.length;
    const hasText = text.trim().length > 0;

    if (hasText || fileSelected) {
      e.preventDefault();
      if (!posting) void send();
    }
  }

  function popOut() {
    window.open(
      "/chat/popout",
      "ChatPopup",
      "popup=yes,width=460,height=720,left=120,top=80,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes"
    );
  }

  function jumpToNewest() {
    setAutoStick(true);
    setPendingNew(0);
    requestAnimationFrame(() => scrollToBottom(false));
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Community chat</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={fetchNew}>Refresh</button>
          <button onClick={popOut}>Pop out</button>
        </div>
      </div>

      {err && <div style={{ color: "crimson" }}>{err}</div>}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          position: "relative",
          border: "1px solid #eee",
          borderRadius: 10,
          padding: 12,
          minHeight: 260,
          maxHeight: 520,
          overflow: "auto",
        }}
      >
        {loading ? (
          <div>Loading…</div>
        ) : messages.length === 0 ? (
          <div>No messages yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {messages.map((m) => (
              <div key={m.id} style={{ display: "grid", gap: 6, borderBottom: "1px dashed #eee", paddingBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <strong style={{ color: m.user?.nickname_color }}>
                    {m.user?.display_name || m.user?.username || "?"}
                  </strong>
                  <span style={{ fontSize: 12, opacity: 0.6 }}>{new Date(m.created_at).toLocaleString()}</span>
                  {m.route_label && <span style={{ fontSize: 12, opacity: 0.7 }}>· {m.route_label}</span>}
                </div>
                {m.content && <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>}
                {m.image && (
                  <div>
                    <img src={resolveUrl(m.image)} alt="chat attachment" style={{ maxWidth: "100%", borderRadius: 10 }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Floating “Jump to newest” when scrolled up and new stuff arrived */}
        {!autoStick && pendingNew > 0 && (
          <button
            onClick={jumpToNewest}
            style={{
              position: "sticky",
              left: "100%",
              transform: "translateX(-100%)",
              bottom: 0,
              marginTop: 8,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: "#fff",
              boxShadow: "0 2px 10px rgba(0,0,0,.06)",
              fontSize: 12,
              cursor: "pointer",
            }}
            title="Scroll to newest"
          >
            Jump to newest ({pendingNew})
          </button>
        )}
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
        <textarea
          rows={3}
          placeholder="Write a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDownText}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept="image/*" />
          <button onClick={send} disabled={posting}>
            {posting ? "Sending…" : "Send"}
          </button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Tip: press <kbd>Enter</kbd> to send (use <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line). You can also send an
          image-only message.
        </div>
      </div>
    </div>
  );
}
