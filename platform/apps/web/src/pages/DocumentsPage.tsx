import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  Alert,
  Button,
  DataRow,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  FileUpload,
  FilterBar,
  LoadingState,
  PageHeader,
  SearchInput,
  Select,
  StatusLabel,
  Table
} from "../design-system";
import {
  ActiveFilters,
  RegisterColumnSelector,
  RegisterFilterSheet,
  RegisterMobileList,
  RegisterMobileRow,
  RegisterPagination,
  RegisterSavedViews,
  SortableHeader,
  type RegisterFilterValue,
  type RegisterSort
} from "../redesign/register/Register";
import { sortRecords } from "../redesign/register/utils";

type CoreRecord = { id: string; name: string };
type DocumentRecord = {
  id: string;
  subjectType: string;
  subjectId: string;
  name: string;
  documentType: string;
  mediaType: string;
  byteSize: string;
  sha256: string;
  scanStatus: string;
  confidentiality: string;
  status: string;
  createdAt: string;
};
type UploadResponse = {
  document: DocumentRecord;
  upload: { method: "PUT"; url: string; headers: Record<string, string> };
};

const initialFilters: RegisterFilterValue = { query: "", documentType: "", scanStatus: "", status: "" };
const columnOptions = [
  { id: "name", label: "Document", required: true },
  { id: "documentType", label: "Type" },
  { id: "subjectType", label: "Related record" },
  { id: "scanStatus", label: "Scan state" },
  { id: "createdAt", label: "Uploaded" },
  { id: "status", label: "Availability" }
];

function csrfCookie(): string {
  const value = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith("ryva_csrf="));
  return value ? decodeURIComponent(value.slice("ryva_csrf=".length)) : "";
}

function subjectPath(item: DocumentRecord): string {
  if (item.subjectType === "representation_opportunity") return `/representation/${item.subjectId}`;
  return `/records/${item.subjectType}/${item.subjectId}`;
}

export function DocumentsPage() {
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [items, setItems] = useState<DocumentRecord[]>([]);
  const [brands, setBrands] = useState<CoreRecord[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "createdAt", direction: "desc" });
  const [visibleColumns, setVisibleColumns] = useState(new Set(columnOptions.map((column) => column.id)));
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [documents, records] = await Promise.all([
        api<{ documents: DocumentRecord[] }>("/api/documents"),
        api<{ records: CoreRecord[] }>("/api/records/brand")
      ]);
      setItems(documents.documents);
      setBrands(records.records);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Documents could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || !canWrite) return;
    setUploading(true);
    setFormError("");
    try {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const sha256 = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const created = await api<UploadResponse>("/api/documents", {
        method: "POST",
        body: {
          subjectType: "brand",
          subjectId,
          name: file.name,
          documentType: "supporting_material",
          mediaType: file.type,
          byteSize: file.size,
          sha256,
          confidentiality: "normal"
        }
      });
      const headers = new Headers(created.upload.headers);
      if (created.upload.url.startsWith("/api/")) headers.set("x-csrf-token", csrfCookie());
      const response = await fetch(created.upload.url, { method: created.upload.method, headers, body: file });
      if (!response.ok) throw new Error("The document content could not be uploaded.");
      setFile(null);
      setSubjectId("");
      setUploadOpen(false);
      await load();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Document upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const filtered = useMemo(() => {
    const query = (filters.query ?? "").toLowerCase();
    return sortRecords(items.filter((item) => (
      (!query || `${item.name} ${item.documentType} ${item.subjectType}`.toLowerCase().includes(query)) &&
      (!filters.documentType || item.documentType === filters.documentType) &&
      (!filters.scanStatus || item.scanStatus === filters.scanStatus) &&
      (!filters.status || item.status === filters.status)
    )), sort, (item, field) => field === "byteSize" ? Number(item.byteSize) : String(item[field as keyof DocumentRecord] ?? ""));
  }, [filters, items, sort]);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeFilters = Object.entries(filters).filter(([, value]) => value).map(([id, value]) => ({ id, label: `${id === "query" ? "Search" : id === "documentType" ? "Type" : id === "scanStatus" ? "Scan" : "Status"}: ${value}` }));

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
    setPage(1);
  }

  return (
    <div className="page ry-register-page">
      <PageHeader
        eyebrow="Controlled files"
        title="Documents"
        description="Register immutable originals, verify their hash, and keep every file quarantined until its scanner state permits access."
        action={<Button disabled={!canWrite || brands.length === 0} onClick={() => setUploadOpen(true)}>Upload document</Button>}
      />
      <Alert className="ry-register-policy" title="Originals remain immutable">
        Uploads are hash-verified and inaccessible while pending, quarantined, infected, failed, or otherwise not clean.
      </Alert>
      {!canWrite ? <Alert tone="warning" className="ry-register-policy" title="Read-only access">You may inspect permitted document metadata, but cannot upload files in this session.</Alert> : null}
      <section className="ry-register-surface" aria-label="Document register">
        <div className="ry-register-commandbar">
          <RegisterSavedViews recordType="document" filters={filters} sort={sort} canWrite={Boolean(canWrite)} onApply={(nextFilters, nextSort) => { setFilters({ ...initialFilters, ...nextFilters }); setSort(nextSort); setPage(1); }} />
          <RegisterFilterSheet open={filterOpen} onOpen={() => setFilterOpen(true)} onClose={() => setFilterOpen(false)}>
            <FilterBar>
              <Field label="Search Documents"><SearchInput label="Search Documents" controlSize="compact" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} /></Field>
              <Field label="Document type"><Select controlSize="compact" value={filters.documentType} onChange={(event) => updateFilter("documentType", event.target.value)}><option value="">All types</option>{[...new Set(items.map((item) => item.documentType))].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></Field>
              <Field label="Scan state"><Select controlSize="compact" value={filters.scanStatus} onChange={(event) => updateFilter("scanStatus", event.target.value)}><option value="">All scan states</option>{[...new Set(items.map((item) => item.scanStatus))].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></Field>
              <Field label="Availability"><Select controlSize="compact" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All availability</option>{[...new Set(items.map((item) => item.status))].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></Field>
            </FilterBar>
          </RegisterFilterSheet>
        </div>
        <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => { setFilters(initialFilters); setPage(1); }} />
        <div className="ry-register-resultbar">
          <span>{filtered.length} of {items.length} Documents</span>
          <RegisterColumnSelector columns={columnOptions} visible={visibleColumns} onChange={(id, shown) => setVisibleColumns((current) => { const next = new Set(current); if (shown) next.add(id); else next.delete(id); return next; })} density={density} onDensityChange={setDensity} />
        </div>
        {loading ? <LoadingState label="Loading Documents" /> : error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : filtered.length === 0 ? (
          <EmptyState title={items.length ? "No Documents match these filters" : "No Documents uploaded"} description={items.length ? "Clear one or more filters to return to the complete immutable file register." : brands.length ? "Upload the first original to quarantine. Access remains blocked until it scans clean." : "Create a Brand before attaching its first controlled Document."} action={items.length ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button> : canWrite && brands.length ? <Button onClick={() => setUploadOpen(true)}>Upload document</Button> : undefined} />
        ) : <>
          <Table caption="Controlled Documents" compact={density === "compact"}>
            <thead><tr>
              {visibleColumns.has("name") ? <SortableHeader field="name" label="Document" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("documentType") ? <SortableHeader field="documentType" label="Type" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("subjectType") ? <SortableHeader field="subjectType" label="Related record" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("scanStatus") ? <SortableHeader field="scanStatus" label="Scan state" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("createdAt") ? <SortableHeader field="createdAt" label="Uploaded" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("status") ? <SortableHeader field="status" label="Availability" sort={sort} onSort={setSort} /> : null}
            </tr></thead>
            <tbody>{visibleItems.map((item) => <DataRow key={item.id} selected={selected?.id === item.id} blocked={item.scanStatus === "infected" || item.scanStatus === "failed"}>
              {visibleColumns.has("name") ? <td><button type="button" className="ry-register-table-button" onClick={() => setSelected(item)}>{item.name}</button><small className="ry-register-cell-meta">{Math.ceil(Number(item.byteSize) / 1024)} KB · {item.mediaType}</small></td> : null}
              {visibleColumns.has("documentType") ? <td>{item.documentType.replaceAll("_", " ")}</td> : null}
              {visibleColumns.has("subjectType") ? <td><Link to={subjectPath(item)}>{item.subjectType.replaceAll("_", " ")}</Link></td> : null}
              {visibleColumns.has("scanStatus") ? <td><StatusLabel value={item.scanStatus} /></td> : null}
              {visibleColumns.has("createdAt") ? <td><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString()}</time></td> : null}
              {visibleColumns.has("status") ? <td><StatusLabel value={item.status} /></td> : null}
            </DataRow>)}</tbody>
          </Table>
          <RegisterMobileList label="Controlled Documents">{visibleItems.map((item) => <RegisterMobileRow key={item.id} title={item.name} meta={`${item.documentType.replaceAll("_", " ")} · ${Math.ceil(Number(item.byteSize) / 1024)} KB · ${item.subjectType.replaceAll("_", " ")}`} status={<><StatusLabel value={item.scanStatus} /><StatusLabel value={item.status} /></>} onOpen={() => setSelected(item)} openLabel={`Review Document ${item.name}`} />)}</RegisterMobileList>
          <RegisterPagination page={currentPage} pageCount={pageCount} total={filtered.length} onPage={setPage} />
        </>}
      </section>

      <Drawer open={uploadOpen} title="Upload Document to quarantine" description="The original is hash-verified and cannot be opened until scanning reports it clean." onClose={() => setUploadOpen(false)}>
        <form onSubmit={(event) => void upload(event)}>
          <Alert tone="warning" title="Quarantine is mandatory">Uploading does not approve, validate, or authorize the file or any terms it contains.</Alert>
          {formError ? <ErrorState message={formError} /> : null}
          <Field label="Related Brand" required><Select required value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Select Brand</option>{brands.map((brand) => <option value={brand.id} key={brand.id}>{brand.name}</option>)}</Select></Field>
          <FileUpload label="Original file" required accept=".pdf,.jpg,.jpeg,.png,.csv,.docx,.xlsx" hint="PDF, JPEG, PNG, CSV, DOCX, or XLSX up to 20 MB." {...(file ? { status: `${file.name} selected` } : {})} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <Button type="submit" loading={uploading} disabled={!file || !subjectId}>Upload to quarantine</Button>
        </form>
      </Drawer>

      <Drawer open={Boolean(selected)} title={selected?.name ?? "Document details"} description="Immutable identity, scan state, and related-record context." onClose={() => setSelected(null)}>
        {selected ? <div className="ry-register-preview">
          <div><StatusLabel value={selected.scanStatus} /> <StatusLabel value={selected.status} /> <StatusLabel value={selected.confidentiality} /></div>
          {selected.scanStatus !== "clean" || selected.status !== "active" ? <Alert tone="warning" title="Content remains unavailable">This original cannot be opened until both the scanner and availability gates permit access.</Alert> : null}
          <dl>
            <div><dt>Document type</dt><dd>{selected.documentType.replaceAll("_", " ")}</dd></div>
            <div><dt>Media type</dt><dd>{selected.mediaType}</dd></div>
            <div><dt>Size</dt><dd>{Number(selected.byteSize).toLocaleString()} bytes</dd></div>
            <div><dt>Immutable SHA-256</dt><dd><code>{selected.sha256}</code></dd></div>
            <div><dt>Uploaded</dt><dd><time dateTime={selected.createdAt}>{new Date(selected.createdAt).toLocaleString()}</time></dd></div>
            <div><dt>Related record</dt><dd><Link to={subjectPath(selected)}>{selected.subjectType.replaceAll("_", " ")}</Link></dd></div>
          </dl>
          {selected.scanStatus === "clean" && selected.status === "active" ? <a className="secondary-button" href={`/api/documents/${selected.id}/content`}>Download clean original</a> : null}
        </div> : null}
      </Drawer>
    </div>
  );
}
