import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import { ErrorPanel, Field, Loading, PageHeader, StatusPill } from "../components";

type CoreRecord = { id: string; name: string };
type Document = {
  id: string; name: string; documentType: string; mediaType: string; byteSize: string;
  scanStatus: string; status: string; createdAt: string;
};
type UploadResponse = {
  document: Document;
  upload: { method: "PUT"; url: string; headers: Record<string,string> };
};

function csrfCookie(): string {
  const value = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith("ryva_csrf="));
  return value ? decodeURIComponent(value.slice("ryva_csrf=".length)) : "";
}

export function DocumentsPage() {
  const [items, setItems] = useState<Document[]>([]);
  const [brands, setBrands] = useState<CoreRecord[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [documents, records] = await Promise.all([
        api<{documents: Document[]}>("/api/documents"),
        api<{records: CoreRecord[]}>("/api/records/brand")
      ]);
      setItems(documents.documents); setBrands(records.records);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Documents could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function upload(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!file) return;
    try {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const sha256 = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const created = await api<UploadResponse>("/api/documents", {
        method: "POST",
        body: {
          subjectType: "brand", subjectId, name: file.name, documentType: "supporting_material",
          mediaType: file.type, byteSize: file.size, sha256, confidentiality: "normal"
        }
      });
      const headers = new Headers(created.upload.headers);
      if (created.upload.url.startsWith("/api/")) headers.set("x-csrf-token", csrfCookie());
      const response = await fetch(created.upload.url, { method: created.upload.method, headers, body: file });
      if (!response.ok) throw new Error("The document content could not be uploaded.");
      setFile(null); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Document upload failed."); }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Controlled files" title="Documents" description="Originals are immutable, hash-verified, and quarantined until a malware scanner reports them clean." />
      {loading ? <Loading /> : null}{error ? <ErrorPanel message={error} /> : null}
      <div className="split-grid">
        <section className="panel">
          <h2>Document register</h2>
          <div className="record-list">{items.map((item) => <a key={item.id} href={item.status === "active" ? `/api/documents/${item.id}/content` : undefined}><span><strong>{item.name}</strong><small>{item.documentType} · {Math.ceil(Number(item.byteSize) / 1024)} KB</small></span><StatusPill value={item.scanStatus} /></a>)}</div>
          {items.length === 0 ? <p className="empty-state">No documents have been uploaded.</p> : null}
        </section>
        <section className="panel">
          <h2>Upload document</h2>
          <p>PDF, JPEG, PNG, CSV, DOCX, or XLSX up to 20 MB.</p>
          <form onSubmit={(event) => void upload(event)}>
            <Field label="Related brand"><select required value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Select…</option>{brands.map((brand) => <option value={brand.id} key={brand.id}>{brand.name}</option>)}</select></Field>
            <Field label="File"><input required type="file" accept=".pdf,.jpg,.jpeg,.png,.csv,.docx,.xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></Field>
            <button className="primary-button">Upload to quarantine</button>
          </form>
        </section>
      </div>
    </div>
  );
}
