import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
type AccountScope = {
  accountId: string;
  brandId: string;
  label: string;
  linkedDocumentIds: Set<string>;
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
  const routes: Record<string, string> = {
    representation_agreement: `/agreements/${item.subjectId}`,
    representation_opportunity: `/representation/${item.subjectId}`,
    brand: `/brands/${item.subjectId}`,
    product: `/products/${item.subjectId}`,
    business: `/buyers/${item.subjectId}`,
    contact: `/records/contact/${item.subjectId}`,
    placement_opportunity: `/placements/${item.subjectId}`,
    account: `/accounts/${item.subjectId}`,
    order: `/orders/${item.subjectId}`,
    commission: `/commissions/${item.subjectId}`,
    commission_dispute: `/commission-disputes/${item.subjectId}`,
    protected_account: `/protected-accounts/${item.subjectId}`,
    outreach_message: `/outreach/${item.subjectId}`
  };
  return routes[item.subjectType] ?? `/records/${item.subjectType}/${item.subjectId}`;
}

function subjectLabel(subjectType: string): string {
  if (subjectType === "representation_agreement") return "Agreement";
  if (subjectType === "representation_opportunity") return "Representation";
  if (subjectType === "business") return "Business";
  if (subjectType === "placement_opportunity") return "Placement";
  if (subjectType === "protected_account") return "Protected Account";
  if (subjectType === "commission_dispute") return "Dispute";
  if (subjectType === "outreach_message") return "Outreach";
  return subjectType.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function accountLabel(account: Record<string, unknown>): string {
  const brandValue = account.brandName ?? account.brand_name;
  const businessValue = account.businessName ?? account.business_name;
  const brand = typeof brandValue === "string" ? brandValue.trim() : "";
  const business = typeof businessValue === "string" ? businessValue.trim() : "";
  if (brand && business) return `${brand} · ${business}`;
  return brand || business || "Account";
}

const DOCUMENT_UPLOAD_ACCEPT = ".pdf,.jpg,.jpeg,.png,.csv,.docx,.xlsx";
const DOCUMENT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

function formatDocumentBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function documentResultLabel(filteredCount: number, totalCount: number): string {
  if (filteredCount === totalCount) {
    return filteredCount === 1 ? "1 document" : `${filteredCount} documents`;
  }
  const filtered = filteredCount === 1 ? "1 document" : `${filteredCount} documents`;
  return `${filtered} of ${totalCount}`;
}

export function DocumentsPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const accountFilter = searchParams.get("accountId")?.trim() || "";
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [items, setItems] = useState<DocumentRecord[]>([]);
  const [brands, setBrands] = useState<CoreRecord[]>([]);
  const [accountScope, setAccountScope] = useState<AccountScope | null>(null);
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
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [documents, records] = await Promise.all([
        api<{ documents: DocumentRecord[] }>("/api/documents"),
        api<{ records: CoreRecord[] }>("/api/records/brand")
      ]);
      setItems(documents.documents);
      setBrands(records.records);
      if (!accountFilter) {
        setAccountScope(null);
        return;
      }
      const detail = await api<{
        account: Record<string, unknown>;
        documents: Array<{ id: string }>;
      }>(`/api/accounts/${accountFilter}`);
      const brandValue = detail.account.brand_id ?? detail.account.brandId;
      const brandId = typeof brandValue === "string" ? brandValue.trim() : "";
      setAccountScope({
        accountId: accountFilter,
        brandId,
        label: accountLabel(detail.account),
        linkedDocumentIds: new Set(detail.documents.map((item) => item.id))
      });
      if (brandId) setSubjectId(brandId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Documents could not be loaded.");
      setAccountScope(null);
    } finally {
      setLoading(false);
    }
  }, [accountFilter]);

  useEffect(() => { void load(); }, [load]);

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
      if (!accountScope?.brandId) setSubjectId("");
      setUploadOpen(false);
      await load();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Document upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const scopedItems = useMemo(() => {
    if (!accountScope) return items;
    return items.filter((item) => (
      (accountScope.brandId && item.subjectType === "brand" && item.subjectId === accountScope.brandId)
      || accountScope.linkedDocumentIds.has(item.id)
    ));
  }, [accountScope, items]);

  const filtered = useMemo(() => {
    const query = (filters.query ?? "").toLowerCase();
    return sortRecords(scopedItems.filter((item) => (
      (!query || `${item.name} ${item.documentType} ${item.subjectType}`.toLowerCase().includes(query)) &&
      (!filters.documentType || item.documentType === filters.documentType) &&
      (!filters.scanStatus || item.scanStatus === filters.scanStatus) &&
      (!filters.status || item.status === filters.status)
    )), sort, (item, field) => field === "byteSize" ? Number(item.byteSize) : String(item[field as keyof DocumentRecord] ?? ""));
  }, [filters, scopedItems, sort]);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeFilters = [
    ...(accountScope ? [{ id: "accountId", label: `Account: ${accountScope.label}` }] : []),
    ...Object.entries(filters).filter(([, value]) => value).map(([id, value]) => ({
      id,
      label: `${id === "query" ? "Search" : id === "documentType" ? "Type" : id === "scanStatus" ? "Scan" : "Status"}: ${value}`
    }))
  ];

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
    setPage(1);
  }

  function clearAccountScope() {
    const next = new URLSearchParams(searchParams);
    next.delete("accountId");
    setSearchParams(next, { replace: true });
    setPage(1);
  }

  function acceptUploadFile(next: File | null) {
    if (!next) {
      setFile(null);
      return;
    }
    if (next.size > DOCUMENT_UPLOAD_MAX_BYTES) {
      setFormError("Choose a file of 20 MB or smaller.");
      setFile(null);
      return;
    }
    setFormError("");
    setFile(next);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!canWrite || uploading) return;
    setDragActive(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (!canWrite || uploading) return;
    acceptUploadFile(event.dataTransfer.files?.[0] ?? null);
  }

  function openUploadDrawer() {
    setFormError("");
    setFile(null);
    setDragActive(false);
    setUploadOpen(true);
  }

  const uploadBrands = accountScope?.brandId
    ? brands.filter((brand) => brand.id === accountScope.brandId)
    : brands;

  return (
    <div className="page ry-register-page ry-documents-page">
      <PageHeader
        eyebrow="Library"
        title="Documents"
        description={accountScope
          ? `Documents for ${accountScope.label}. Upload and review files for this account.`
          : "A professional library of originals — securely scanned before they become available."}
        action={<Button disabled={!canWrite || uploadBrands.length === 0} onClick={openUploadDrawer}>Upload document</Button>}
      />
      <aside className="ry-documents-security ry-register-policy" aria-label="Secure originals">
        <div className="ry-documents-security-copy">
          <strong>Secure originals</strong>
          <p>Uploaded originals are preserved and verified before becoming available.</p>
        </div>
        <details className="ry-documents-security-details">
          <summary>How document security works</summary>
          <p>
            Uploads are hash-verified. Files stay inaccessible while pending, quarantined, infected, failed, or otherwise not clean.
            Originals remain immutable after upload.
          </p>
        </details>
      </aside>
      {!canWrite ? <Alert tone="warning" className="ry-register-policy" title="Read-only access">You may inspect permitted document metadata, but cannot upload files in this session.</Alert> : null}
      <section className="ry-register-surface" aria-label="Document register">
        <div className="ry-register-commandbar">
          <RegisterSavedViews recordType="document" filters={filters} sort={sort} canWrite={Boolean(canWrite)} onApply={(nextFilters, nextSort) => { setFilters({ ...initialFilters, ...nextFilters }); setSort(nextSort); setPage(1); }} />
          <RegisterFilterSheet open={filterOpen} onOpen={() => setFilterOpen(true)} onClose={() => setFilterOpen(false)}>
            <FilterBar>
              <Field label="Search Documents"><SearchInput label="Search Documents" controlSize="compact" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} /></Field>
              <Field label="Document type"><Select controlSize="compact" value={filters.documentType} onChange={(event) => updateFilter("documentType", event.target.value)}><option value="">All types</option>{[...new Set(scopedItems.map((item) => item.documentType))].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></Field>
              <Field label="Scan state"><Select controlSize="compact" value={filters.scanStatus} onChange={(event) => updateFilter("scanStatus", event.target.value)}><option value="">All scan states</option>{[...new Set(scopedItems.map((item) => item.scanStatus))].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></Field>
              <Field label="Availability"><Select controlSize="compact" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All availability</option>{[...new Set(scopedItems.map((item) => item.status))].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></Field>
            </FilterBar>
          </RegisterFilterSheet>
        </div>
        <ActiveFilters
          filters={activeFilters}
          onClear={(id) => {
            if (id === "accountId") clearAccountScope();
            else updateFilter(id, "");
          }}
          onClearAll={() => {
            setFilters(initialFilters);
            if (accountScope) clearAccountScope();
            setPage(1);
          }}
        />
        <div className="ry-register-resultbar">
          <span>
            {documentResultLabel(filtered.length, scopedItems.length)}
            {accountScope ? (
              <>
                {" · "}
                <Link to={`/accounts/${accountScope.accountId}`}>{accountScope.label}</Link>
              </>
            ) : null}
          </span>
          <RegisterColumnSelector columns={columnOptions} visible={visibleColumns} onChange={(id, shown) => setVisibleColumns((current) => { const next = new Set(current); if (shown) next.add(id); else next.delete(id); return next; })} density={density} onDensityChange={setDensity} />
        </div>
        {loading ? <LoadingState label="Loading Documents" /> : error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : filtered.length === 0 ? (
          <EmptyState
            title={scopedItems.length ? "No documents match these filters" : accountScope ? "No documents for this Account" : "No documents yet"}
            description={scopedItems.length
              ? "Clear one or more filters to return to the full library."
              : accountScope
                ? "Upload a document for this Account’s Brand, or clear the Account filter to browse the full library."
                : brands.length
                  ? "Upload the first document. It becomes available after a clean scan."
                  : "Create a Brand before attaching its first document."}
            action={scopedItems.length || accountScope
              ? <Button variant="secondary" onClick={() => { setFilters(initialFilters); if (accountScope) clearAccountScope(); }}>Clear filters</Button>
              : canWrite && brands.length
                ? <Button onClick={openUploadDrawer}>Upload document</Button>
                : undefined}
          />
        ) : <>
          <Table caption="Documents" compact={density === "compact"}>
            <thead><tr>
              {visibleColumns.has("name") ? <SortableHeader field="name" label="Document" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("documentType") ? <SortableHeader field="documentType" label="Type" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("subjectType") ? <SortableHeader field="subjectType" label="Related record" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("scanStatus") ? <SortableHeader field="scanStatus" label="Scan state" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("createdAt") ? <SortableHeader field="createdAt" label="Uploaded" sort={sort} onSort={setSort} /> : null}
              {visibleColumns.has("status") ? <SortableHeader field="status" label="Availability" sort={sort} onSort={setSort} /> : null}
            </tr></thead>
            <tbody>{visibleItems.map((item) => <DataRow key={item.id} selected={selected?.id === item.id} blocked={item.scanStatus === "infected" || item.scanStatus === "failed"}>
              {visibleColumns.has("name") ? <td><button type="button" className="ry-register-table-button" onClick={() => setSelected(item)}>{item.name}</button><small className="ry-register-cell-meta">{formatDocumentBytes(Number(item.byteSize))} · {item.mediaType}</small></td> : null}
              {visibleColumns.has("documentType") ? <td>{item.documentType.replaceAll("_", " ")}</td> : null}
              {visibleColumns.has("subjectType") ? <td><Link to={subjectPath(item)}>{subjectLabel(item.subjectType)}</Link></td> : null}
              {visibleColumns.has("scanStatus") ? <td><StatusLabel value={item.scanStatus} /></td> : null}
              {visibleColumns.has("createdAt") ? <td><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString()}</time></td> : null}
              {visibleColumns.has("status") ? <td><StatusLabel value={item.status} /></td> : null}
            </DataRow>)}</tbody>
          </Table>
          <RegisterMobileList label="Documents">{visibleItems.map((item) => <RegisterMobileRow key={item.id} title={item.name} meta={`${item.documentType.replaceAll("_", " ")} · ${formatDocumentBytes(Number(item.byteSize))} · ${subjectLabel(item.subjectType)}`} status={<><StatusLabel value={item.scanStatus} /><StatusLabel value={item.status} /></>} onOpen={() => setSelected(item)} openLabel={`Review Document ${item.name}`} />)}</RegisterMobileList>
          <RegisterPagination page={currentPage} pageCount={pageCount} total={filtered.length} pageSize={pageSize} onPage={setPage} />
        </>}
      </section>

      <Drawer
        open={uploadOpen}
        title="Upload document"
        description="Documents are securely scanned before becoming available in Ryva."
        onClose={() => {
          setUploadOpen(false);
          setDragActive(false);
          setFormError("");
        }}
      >
        <form className="ry-documents-upload-form" onSubmit={(event) => void upload(event)}>
          <Alert tone="info" title="Uploading does not approve the document">
            Ryva stores and scans the original. Approval, verification, and representation authority remain separate.
          </Alert>
          {formError ? <ErrorState message={formError} /> : null}
          <Field label="Brand">
            <Select
              required
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              disabled={Boolean(accountScope?.brandId) && uploadBrands.length === 1}
            >
              <option value="">Select Brand</option>
              {uploadBrands.map((brand) => <option value={brand.id} key={brand.id}>{brand.name}</option>)}
            </Select>
          </Field>
          <div className="ry-documents-upload-field">
            <span className="ry-field-label" id="documents-upload-label">Document</span>
            <div
              className={`ry-documents-dropzone${dragActive ? " is-active" : ""}${file ? " has-file" : ""}`}
              onDragEnter={onDragOver}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => {
                if (!canWrite || uploading) return;
                fileInputRef.current?.click();
              }}
            >
              <input
                ref={fileInputRef}
                className="ry-documents-dropzone-input"
                aria-labelledby="documents-upload-label"
                type="file"
                accept={DOCUMENT_UPLOAD_ACCEPT}
                disabled={!canWrite || uploading}
                onChange={(event) => acceptUploadFile(event.target.files?.[0] ?? null)}
              />
              <p className="ry-documents-dropzone-title">Drop a document here</p>
              <p className="ry-documents-dropzone-or">
                or{" "}
                <button
                  type="button"
                  className="ry-documents-browse-link"
                  disabled={!canWrite || uploading}
                  onClick={(event) => {
                    event.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Browse files
                </button>
              </p>
              <p className="ry-documents-dropzone-meta">PDF, JPG, PNG, CSV, DOCX, XLSX · Max 20 MB</p>
            </div>
            {file ? (
              <div className="ry-documents-selected-file" role="status">
                <div className="ry-documents-selected-file-copy">
                  <strong title={file.name}>{file.name}</strong>
                  <span>{formatDocumentBytes(file.size)}</span>
                </div>
                <Button
                  type="button"
                  variant="tertiary"
                  size="compact"
                  disabled={uploading}
                  onClick={() => {
                    acceptUploadFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </div>
          <Button type="submit" loading={uploading} disabled={!file || !subjectId}>Upload document</Button>
        </form>
      </Drawer>

      <Drawer open={Boolean(selected)} title={selected?.name ?? "Document details"} description="Scan state, availability, and related-record context." onClose={() => setSelected(null)}>
        {selected ? <div className="ry-register-preview">
          <div><StatusLabel value={selected.scanStatus} /> <StatusLabel value={selected.status} /> <StatusLabel value={selected.confidentiality} /></div>
          {selected.scanStatus !== "clean" || selected.status !== "active" ? <Alert tone="warning" title="Content remains unavailable">This original cannot be opened until both the scanner and availability gates permit access.</Alert> : null}
          <dl>
            <div><dt>Document type</dt><dd>{selected.documentType.replaceAll("_", " ")}</dd></div>
            <div><dt>Media type</dt><dd>{selected.mediaType}</dd></div>
            <div><dt>Size</dt><dd>{formatDocumentBytes(Number(selected.byteSize))}</dd></div>
            <div><dt>SHA-256</dt><dd><code>{selected.sha256}</code></dd></div>
            <div><dt>Uploaded</dt><dd><time dateTime={selected.createdAt}>{new Date(selected.createdAt).toLocaleString()}</time></dd></div>
            <div><dt>Related record</dt><dd><Link to={subjectPath(selected)}>{subjectLabel(selected.subjectType)}</Link></dd></div>
          </dl>
          {selected.scanStatus === "clean" && selected.status === "active" ? <a className="secondary-button" href={`/api/documents/${selected.id}/content`}>Download clean original</a> : null}
        </div> : null}
      </Drawer>
    </div>
  );
}
