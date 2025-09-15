// If backend returns "/media/…" we need a full URL for <img src> / <a href>
export function resolveUrl(u?: string | null) {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const base = import.meta.env.VITE_API_URL || "";
  return `${base}${u}`;
}

