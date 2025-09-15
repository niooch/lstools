import Chat from "./Chat";

// Keep it dead simple: reuse the exact Chat component UI/polling,
// but with a slimmer header so the popup looks cleaner.
// If you prefer a different layout, you can copy Chat.tsx and tweak.

export default function ChatPopout() {
  return (
    <div style={{ padding: 12 }}>
      <Chat />
    </div>
  );
}

