import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { resolveUrl } from "../lib/media";
import type { VerificationDoc } from "../types";

const BASE = "/api/users/verification-docs";

export default function VerifyDocs() {
  const [docs, setDocs] = useState<VerificationDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [kind, setKind] = useState<VerificationDoc["kind"]>("company");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.get(BASE);
      const items: VerificationDoc[] = Array.isArray(r.data) ? r.data : r.data.results || [];
      setDocs(items);
    } catch (e: any) {
      setErr(e.response?.data?.detail || "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function upload() {
    setUploadErr(null);
    const fileInput = fileRef.current;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      setUploadErr("Choose a file.");
      return;
    }
    const file = fileInput.files[0];
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", file);
    setUploading(true);
    try {
      await api.post(BASE, fd); // multipart auto-set by axios on FormData
      fileInput.value = "";
      await load();
    } catch (e: any) {
      setUploadErr(e.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: number, status: string) {
    if (status !== "pending") {
      alert("Only pending documents can be deleted.");
      return;
    }
    if (!confirm("Delete this document?")) return;
    try {
      await api.delete(`${BASE}/${id}`);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Delete failed.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 800 }}>
      <h2>Verification documents</h2>

      <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Upload a document</h3>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label>
            Type
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="company">Company</option>
              <option value="id">ID / Passport</option>
              <option value="license">License</option>
              <option value="other">Other</option>
            </select>
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            style={{ maxWidth: 320 }}
          />
          <button onClick={upload} disabled={uploading}>{uploading ? "Uploading…" : "Upload"}</button>
          {uploadErr && <div style={{ color: "crimson" }}>{uploadErr}</div>}
        </div>
      </div>

      <div>
        <h3 style={{ marginTop: 0 }}>My documents</h3>
        {loading ? (
          <div>Loading…</div>
        ) : err ? (
          <div style={{ color: "crimson" }}>{err}</div>
        ) : docs.length === 0 ? (
          <div>No documents yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {docs.map((d) => (
              <div key={d.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <strong>#{d.id}</strong> · <code>{d.kind}</code> ·
                    <span style={{ marginLeft: 8, textTransform: "uppercase" }}>{d.status}</span>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      uploaded {new Date(d.created_at).toLocaleString()}
                      {d.reviewed_at && <> · reviewed {new Date(d.reviewed_at).toLocaleString()}</>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <a href={resolveUrl(d.file)} target="_blank" rel="noreferrer">Open</a>
                    <button onClick={() => remove(d.id, d.status)} disabled={d.status !== "pending"}>
                      Delete
                    </button>
                  </div>
                </div>
                {d.admin_note && (
                  <div style={{ marginTop: 8, background: "#fafafa", padding: 8, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Admin note</div>
                    <div>{d.admin_note}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

