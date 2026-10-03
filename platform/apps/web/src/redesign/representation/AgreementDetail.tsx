import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiProblem } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  AuthorityIndicator,
  Button,
  Checkbox,
  ConfirmationDialog,
  DataRow,
  ErrorState,
  Field,
  IdentityHeader,
  Input,
  LoadingState,
  Select,
  Skeleton,
  StatusLabel,
  Table,
  TextArea
} from "../../design-system";
import { useLoad } from "../../hooks";
import { ReviewErrorSummary } from "../consequential/ConsequentialReview";
import {
  RelationshipSection,
  RelationshipTabPanel,
  RelationshipTabs,
  RelationshipTrail,
  type RelationshipTab
} from "../relationship/RelationshipDetail";
import {
  agreementChannelOptions,
  agreementCurrencyOptions,
  agreementTerritoryOptions,
  channelsLabel,
  date,
  displayBrandName,
  displayProductName,
  fromDateInputValue,
  materialFieldLabel,
  materialFieldOptions,
  pendingApprovalStatus,
  readable,
  shown,
  stageDisplayLabel,
  territoryLabel,
  toDateInputValue,
  type Row
} from "./utils";

type AgreementDetail = {
  agreement: Row;
  products: string[];
  restrictions: Row[];
  candidates: Row[];
  versions: Row[];
  authorityDigest: string;
};

type BrandProductsContext = { related: Row[] };

type TermKey =
  | "effectiveAt"
  | "expiresAt"
  | "renewalReviewAt"
  | "channels"
  | "products"
  | "territoryScope"
  | "commissionBasis"
  | "commissionRate"
  | "commissionCurrency"
  | "commissionTiming"
  | "openingOrderRights"
  | "reorderRights"
  | "protectedAccountRules"
  | "houseAccountRules"
  | "terminationTerms"
  | "postTerminationCommissionRights"
  | "authoritySummary";

const TERM_GROUPS: Array<{ id: string; title: string; fields: TermKey[] }> = [
  { id: "dates", title: "Dates and renewal", fields: ["effectiveAt", "expiresAt", "renewalReviewAt"] },
  { id: "sales", title: "Sales scope", fields: ["channels", "products", "territoryScope"] },
  { id: "commission", title: "Commission terms", fields: ["commissionBasis", "commissionRate", "commissionCurrency", "commissionTiming"] },
  { id: "accounts", title: "Account rights", fields: ["openingOrderRights", "reorderRights", "protectedAccountRules", "houseAccountRules"] },
  { id: "termination", title: "Termination", fields: ["terminationTerms", "postTerminationCommissionRights", "authoritySummary"] }
];

const TERM_LABELS: Record<TermKey, string> = {
  effectiveAt: "Effective date",
  expiresAt: "Expiration date",
  renewalReviewAt: "Renewal review date",
  channels: "Sales channels",
  products: "Products",
  territoryScope: "Territory",
  commissionBasis: "Commission basis",
  commissionRate: "Commission rate",
  commissionCurrency: "Commission currency",
  commissionTiming: "Commission timing",
  openingOrderRights: "Opening-order rights",
  reorderRights: "Reorder rights",
  protectedAccountRules: "Protected-account rules",
  houseAccountRules: "House-account exclusions",
  terminationTerms: "Termination terms",
  postTerminationCommissionRights: "Post-termination commission",
  authoritySummary: "Authority summary"
};

function parsePageHint(location: unknown): number | null {
  const text = shown(location, "");
  const match = text.match(/(?:page|p\.?)\s*(\d+)/i) ?? text.match(/^(\d+)$/);
  if (!match?.[1]) return null;
  const page = Number(match[1]);
  return Number.isFinite(page) && page > 0 ? page : null;
}

function currentChannels(agreement: Row, changes: Record<string, string>): string[] {
  if (changes.channels != null) {
    return changes.channels.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return Array.isArray(agreement.channels) ? agreement.channels.map(String) : [];
}

function currentTerritory(agreement: Row, changes: Record<string, string>): string {
  if (changes.territoryScope != null) return changes.territoryScope;
  return territoryLabel(agreement.territoryScope, "");
}

function formatPercentInput(value: unknown): string {
  const rate = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(rate)) return "";
  const percent = rate * 100;
  return Number.isInteger(percent) ? String(percent) : String(Number(percent.toFixed(2)));
}

function displayActor(value: unknown, fallbackUser?: { id?: string; name?: string } | null): string {
  const text = shown(value, "").trim();
  if (!text) return "—";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
    if (fallbackUser?.id && fallbackUser.name && text === fallbackUser.id) return fallbackUser.name;
    return "Workspace user";
  }
  if (text.toLowerCase().includes("ryva representation")) return "System";
  return text;
}

function versionChangeLabel(item: Row): string {
  const reason = shown(item.reason, "").trim();
  if (!reason) return "Terms updated";
  if (/^agreement created$/i.test(reason)) return "Agreement created";
  if (/material terms edited/i.test(reason)) return "Terms edited";
  return reason;
}

function fieldDraft(agreement: Row, changes: Record<string, string>, key: string): string {
  if (changes[key] != null) return changes[key];
  const raw = agreement[key];
  if (key === "commissionRate") return formatPercentInput(raw);
  if (raw == null) return "";
  if (typeof raw === "string" || typeof raw === "number") return String(raw);
  return "";
}

function AgreementDocumentViewer({
  documentId,
  documentName,
  page,
  onPageChange,
  canWrite,
  onReplace,
  onRevised
}: {
  documentId: string;
  documentName: string;
  page: number;
  onPageChange: (page: number) => void;
  canWrite: boolean;
  onReplace: () => void;
  onRevised: () => void;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [search, setSearch] = useState("");
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const contentUrl = `/api/documents/${documentId}/content`;
  const viewerSrc = previewUrl
    ? `${previewUrl}#page=${page}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`
    : undefined;

  useEffect(() => {
    let cancelled = false;
    setPreviewState("loading");
    setPreviewUrl(null);

    async function preparePreview() {
      try {
        const response = await fetch(contentUrl, { credentials: "include" });
        if (!response.ok) throw new Error("Document content is unavailable.");
        const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
        const looksLikePdf = contentType.includes("pdf") || documentName.toLowerCase().endsWith(".pdf");
        if (!looksLikePdf) {
          if (!cancelled) setPreviewState("unavailable");
          return;
        }
        const blob = await response.blob();
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: "application/pdf" }));
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = nextUrl;
        setPreviewUrl(nextUrl);
        setPreviewState("ready");
      } catch {
        if (!cancelled) {
          setPreviewUrl(null);
          setPreviewState("unavailable");
        }
      }
    }

    void preparePreview();
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [contentUrl, documentName]);

  async function toggleFullscreen() {
    const node = shellRef.current;
    if (!node) return;
    if (document.fullscreenElement === node) {
      await document.exitFullscreen();
      return;
    }
    await node.requestFullscreen();
  }

  return (
    <div className="ry-agreement-viewer" ref={shellRef}>
      <div className="ry-agreement-viewer-toolbar" role="toolbar" aria-label="Agreement document tools">
        <div className="ry-agreement-viewer-nav">
          <Button type="button" variant="tertiary" size="compact" aria-label="Previous page" disabled={previewState !== "ready"} onClick={() => onPageChange(Math.max(1, page - 1))}>Prev</Button>
          <span className="ry-agreement-viewer-page">Page {page}</span>
          <Button type="button" variant="tertiary" size="compact" aria-label="Next page" disabled={previewState !== "ready"} onClick={() => onPageChange(page + 1)}>Next</Button>
        </div>
        <div className="ry-agreement-viewer-zoom">
          <Button type="button" variant="tertiary" size="compact" aria-label="Zoom out" disabled={previewState !== "ready"} onClick={() => setZoom((value) => Math.max(50, value - 10))}>−</Button>
          <span>{zoom}%</span>
          <Button type="button" variant="tertiary" size="compact" aria-label="Zoom in" disabled={previewState !== "ready"} onClick={() => setZoom((value) => Math.min(200, value + 10))}>+</Button>
        </div>
        <form
          className="ry-agreement-viewer-search"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <Input
            aria-label="Search agreement"
            placeholder="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            controlSize="compact"
            disabled={previewState !== "ready"}
          />
        </form>
        <div className="ry-agreement-viewer-actions">
          <a className="ry-button ry-button-tertiary ry-control-compact" href={contentUrl} download={documentName || "agreement.pdf"}>Download</a>
          <Button type="button" variant="tertiary" size="compact" disabled={previewState !== "ready"} onClick={() => void toggleFullscreen()}>Full screen</Button>
        </div>
      </div>
      <div className="ry-agreement-viewer-frame" style={{ ["--ry-agreement-zoom" as string]: String(zoom / 100) }}>
        {previewState === "loading" ? (
          <div className="ry-agreement-viewer-skeleton" role="status" aria-live="polite" aria-busy="true">
            <Skeleton variant="identity" lines={1} />
            <Skeleton variant="row" lines={6} />
            <p>Loading agreement preview…</p>
          </div>
        ) : previewState === "ready" && viewerSrc ? (
          <iframe
            title={documentName || "Agreement document"}
            src={viewerSrc}
            onError={() => setPreviewState("unavailable")}
          />
        ) : (
          <div className="ry-agreement-viewer-unavailable" role="status">
            <p>Preview unavailable. Download the agreement to review it.</p>
            <a className="ry-button ry-button-secondary ry-control-compact" href={contentUrl} download={documentName || "agreement.pdf"}>
              Download agreement
            </a>
          </div>
        )}
      </div>
      <div className="ry-agreement-viewer-secondary">
        <Button type="button" variant="tertiary" size="compact" disabled={!canWrite} onClick={onReplace}>Replace document</Button>
        <Button type="button" variant="tertiary" size="compact" disabled={!canWrite} onClick={onRevised}>Upload revised version</Button>
      </div>
    </div>
  );
}

function TermGroup({
  title,
  open,
  onToggle,
  children
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`ry-agreement-term-group${open ? " is-open" : ""}`}>
      <button type="button" className="ry-agreement-term-group-toggle" aria-expanded={open} onClick={onToggle}>
        <span>{title}</span>
        <span className="ry-agreement-term-group-chevron" aria-hidden="true" />
      </button>
      {open ? <div className="ry-agreement-term-group-body">{children}</div> : null}
    </section>
  );
}

export function AgreementDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const tabBaseId = `agreement-${useId().replaceAll(":", "")}`;
  const { data, loading, error, reload } = useLoad(() => api<AgreementDetail>(`/api/agreements/${id}`), [id]);
  const agreement = data?.agreement;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadModeRef = useRef<"attach" | "replace" | "revised">("attach");

  const [brandProducts, setBrandProducts] = useState<Row[]>([]);
  const [businesses, setBusinesses] = useState<Row[]>([]);
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productDirty, setProductDirty] = useState(false);
  const [editingTerm, setEditingTerm] = useState<TermKey | null>(null);
  const [candidateField, setCandidateField] = useState<string>(materialFieldOptions[0]);
  const [candidateValue, setCandidateValue] = useState("");
  const [sourceLocation, setSourceLocation] = useState("");
  const [ambiguous, setAmbiguous] = useState(false);
  const [restrictionType, setRestrictionType] = useState("house_account_exclusion");
  const [restrictionBusinessId, setRestrictionBusinessId] = useState("");
  const [restrictionLocation, setRestrictionLocation] = useState("");
  const [approvalId, setApprovalId] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const [evidenceAdvancedOpen, setEvidenceAdvancedOpen] = useState(false);
  const [evidenceKind, setEvidenceKind] = useState<"term" | "restriction">("term");
  const [activeTab, setActiveTab] = useState("agreement");
  const [viewerPage, setViewerPage] = useState(1);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    dates: true,
    sales: true,
    commission: true,
    accounts: false,
    termination: false
  });
  const [uploadNote, setUploadNote] = useState("");
  const submissionGuard = useRef(false);

  useEffect(() => {
    void api<{ records: Row[] }>("/api/records/business")
      .then((result) => setBusinesses(result.records))
      .catch(() => setBusinesses([]));
  }, []);

  useEffect(() => {
    if (!agreement?.brandId) return;
    void api<BrandProductsContext>(`/api/records/brand/${shown(agreement.brandId)}`)
      .then((result) => setBrandProducts(result.related ?? []))
      .catch(() => setBrandProducts([]));
  }, [agreement?.brandId]);

  useEffect(() => {
    if (!data) return;
    setProductIds((data.products ?? []).map(String));
    setProductDirty(false);
    setChanges({});
    setEditingTerm(null);
  }, [data]);

  useEffect(() => {
    if (actionError) document.querySelector<HTMLElement>("[data-review-error]")?.focus();
  }, [actionError]);

  async function saveTerms(event?: FormEvent) {
    event?.preventDefault();
    if (!agreement || !canWrite) return;
    setSaving(true); setActionError(""); setConflict(false);
    try {
      const normalized: Record<string, unknown> = { ...changes };
      if ("channels" in changes) {
        normalized.channels = changes.channels.split(",").map((item) => item.trim()).filter(Boolean);
      }
      if ("territoryScope" in changes) {
        normalized.territoryScope = { description: changes.territoryScope };
      }
      if ("commissionRate" in changes) {
        normalized.commissionRate = Number(changes.commissionRate) / 100;
      }
      await api(`/api/agreements/${id}`, {
        method: "PATCH",
        body: {
          version: agreement.version,
          changes: normalized,
          ...(productDirty ? { productIds } : {})
        }
      });
      setChanges({});
      setProductDirty(false);
      setEditingTerm(null);
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Terms could not be saved.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
    } finally { setSaving(false); }
  }

  function cancelTerms() {
    setChanges({});
    setProductIds((data?.products ?? []).map(String));
    setProductDirty(false);
    setEditingTerm(null);
  }

  async function uploadDocument(file: File) {
    if (!agreement || !canWrite) return;
    const opportunityId = shown(agreement.representationOpportunityId, "");
    if (!opportunityId) {
      setActionError("This agreement is not linked to an opportunity, so a document cannot be uploaded here.");
      return;
    }
    setSaving(true); setActionError(""); setUploadNote("");
    try {
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))]
        .map((value) => value.toString(16).padStart(2, "0")).join("");
      const created = await api<{ document: Row; upload: { url: string } }>("/api/documents", {
        method: "POST",
        body: {
          subjectType: "representation_opportunity",
          subjectId: opportunityId,
          name: file.name,
          documentType: "representation_agreement_original",
          mediaType: file.type || "application/pdf",
          byteSize: file.size,
          sha256: digest,
          confidentiality: "restricted"
        }
      });
      await api(created.upload.url, {
        method: "PUT",
        headers: { "content-type": file.type || "application/pdf" },
        body: file
      });
      setUploadNote(
        uploadModeRef.current === "attach"
          ? "Upload started. When scanning finishes, open the opportunity to attach this original if needed."
          : "Revised original uploaded to the opportunity. Existing agreement source stays unchanged until a new reviewed agreement is created."
      );
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "The agreement could not be uploaded.");
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function proposeCandidate(event: FormEvent) {
    event.preventDefault();
    if (!agreement?.sourceDocumentId || !canWrite) return;
    setSaving(true); setActionError(""); setConflict(false);
    try {
      await api(`/api/agreements/${id}/term-candidates`, {
        method: "POST", body: {
          sourceDocumentId: agreement.sourceDocumentId, fieldName: candidateField,
          proposedValue: candidateValue, sourceLocation, evidenceExcerpt: "",
          evidenceClass: "direct_evidence", confidence: "supported", origin: "user_entered",
          material: true, ambiguous, specialistReviewRequired: ambiguous
        }
      });
      setCandidateValue(""); setSourceLocation("");
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Candidate could not be recorded.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
    } finally { setSaving(false); }
  }

  async function reviewCandidate(item: Row, decision: "confirmed" | "rejected") {
    if (!canWrite) return;
    setSaving(true); setActionError(""); setConflict(false);
    try {
      await api(`/api/agreement-term-candidates/${item.id}`, {
        method: "PATCH", body: {
          version: item.version, decision, reviewNotes: `${decision} after comparing the cited original.`
        }
      });
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Candidate review failed.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
    } finally { setSaving(false); }
  }

  async function requestApproval() {
    if (!canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true); setActionError(""); setConflict(false);
    try {
      const result = await api<{ approval: Row }>(`/api/agreements/${id}/approval`, {
        method: "POST", body: { scope: "Current written Product, channel, territory, account, commission, and termination terms only." }
      });
      setApprovalId(result.approval.id);
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Approval could not be requested.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
    } finally { setSaving(false); submissionGuard.current = false; }
  }

  async function activate() {
    if (!approvalId || !canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true); setActionError(""); setConflict(false);
    try {
      await api(`/api/agreements/${id}/activate`, {
        method: "POST", body: { approvalId, decision: "approved", conditions: "Authority limited to the reviewed written scope." }
      });
      setConfirmationOpen(false);
      setApprovalId("");
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Agreement could not be activated.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
      setConfirmationOpen(false);
    } finally { setSaving(false); submissionGuard.current = false; }
  }

  async function end(status: "suspended" | "ended") {
    if (!agreement || !canWrite) return;
    setSaving(true); setActionError(""); setConflict(false);
    try {
      await api(`/api/agreements/${id}/status`, {
        method: "POST", body: { version: agreement.version, status, reason: `Recorded ${status} authority after reviewing current contractual status.` }
      });
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Agreement status could not be changed.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
    } finally { setSaving(false); }
  }

  async function addRestriction(event: FormEvent) {
    event.preventDefault();
    if (!agreement?.sourceDocumentId || !restrictionBusinessId || !canWrite) return;
    const business = businesses.find((item) => item.id === restrictionBusinessId);
    setSaving(true); setActionError(""); setConflict(false);
    try {
      await api(`/api/agreements/${id}/account-restrictions`, {
        method: "POST",
        body: {
          restrictionType, businessId: restrictionBusinessId,
          accountName: shown(business?.name), productIds: data?.products ?? [],
          channels: Array.isArray(agreement.channels) ? agreement.channels : [],
          territoryScope: agreement.territoryScope ?? {},
          sourceDocumentId: agreement.sourceDocumentId,
          sourceLocation: restrictionLocation
        }
      });
      setRestrictionBusinessId(""); setRestrictionLocation("");
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Account restriction could not be recorded.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
    } finally { setSaving(false); }
  }

  const loadingTrail = <RelationshipTrail items={[{ label: "Representation", to: "/representation" }, { label: loading ? "Loading agreement" : "Agreement unavailable" }]} />;
  if (loading) {
    return (
      <div className="page ry-relationship-page ry-representation-page ry-agreement-workspace">
        {loadingTrail}
        <IdentityHeader eyebrow="Representation Agreement" title="Loading agreement" status={<StatusLabel value="loading" />} />
        <LoadingState label="Loading agreement" />
      </div>
    );
  }
  if (error || !data || !agreement) {
    return (
      <div className="page ry-relationship-page ry-representation-page ry-agreement-workspace">
        {loadingTrail}
        <IdentityHeader eyebrow="Representation Agreement" title="Agreement unavailable" />
        <ErrorState message={error || "Representation Agreement not found."} action={<Button variant="secondary" onClick={() => void reload()}>Try again</Button>} />
      </div>
    );
  }

  const loadedAgreement: Row = agreement;
  const status = shown(agreement.status, "draft");
  const pending = pendingApprovalStatus(status);
  const active = status === "active";
  const products = data.products ?? [];
  const restrictions = data.restrictions ?? [];
  const candidates = data.candidates ?? [];
  const versions = data.versions ?? [];
  const documentId = shown(agreement.sourceDocumentId, "");
  const documentReady = Boolean(documentId) && shown(agreement.documentStatus) === "active" && shown(agreement.documentScanStatus) === "clean";
  const documentPending = Boolean(documentId) && !documentReady;
  const scopeComplete = Boolean(agreement.effectiveAt) && products.length > 0 && Array.isArray(agreement.channels) && agreement.channels.length > 0;
  const pendingCandidates = candidates.filter((item) => item.material && item.status === "proposed");
  const ambiguousCandidates = candidates.filter((item) => item.ambiguous || item.status === "proposed");
  const ambiguityResolved = !["review_required", "specialist_required"].includes(shown(agreement.legalAmbiguityStatus));
  const readyForApproval = documentReady && scopeComplete && pendingCandidates.length === 0 && ambiguityResolved;
  const authorityDigest = data.authorityDigest || "Digest unavailable";
  const representationOpportunityId = shown(agreement.representationOpportunityId, "");
  const brandName = displayBrandName(agreement.brandName);
  const dirty = Object.keys(changes).length > 0 || productDirty;
  const selectedChannels = currentChannels(agreement, changes);
  const selectedTerritory = currentTerritory(agreement, changes);
  const productNameById = new Map(brandProducts.map((item) => [String(item.id), displayProductName(item.name)]));
  const latestVersion = versions[0];
  const versionMeta = latestVersion?.changedAt
    ? `Version ${shown(agreement.version)} · Updated ${date(latestVersion.changedAt)}`
    : `Version ${shown(agreement.version)}`;
  const approvalRef = approvalId || shown(agreement.approvalId, "");
  const approvedBy = shown(agreement.approvedBy, "");
  const documentHash = shown(agreement.documentSha256, "");

  const nextActionCopy = active
    ? "Inspect the activated scope and recorded approval."
    : !canWrite
      ? session?.access.reason ?? "Read-only inspection."
      : approvalId
        ? "Approval is prepared. Confirm to activate this agreement’s written scope."
        : readyForApproval
          ? "Submit this version for approval. Authority stays inactive until you confirm."
          : "Resolve items needing attention, then request approval.";

  const attentionItems = [
    ...(!documentReady ? ["Source agreement is missing or still scanning."] : []),
    ...(!scopeComplete ? ["Effective date, products, and channels are incomplete."] : []),
    ...(pendingCandidates.length ? [`${pendingCandidates.length} term candidate${pendingCandidates.length === 1 ? "" : "s"} need review.`] : []),
    ...(!ambiguityResolved ? ["Legal ambiguity still needs review."] : [])
  ];

  const passedChecks = [
    documentReady,
    scopeComplete,
    pendingCandidates.length === 0,
    ambiguityResolved
  ].filter(Boolean).length;

  const tabs: RelationshipTab[] = [
    { id: "agreement", label: "Agreement" },
    { id: "terms", label: "Terms" },
    { id: "evidence", label: "Evidence", count: candidates.length + restrictions.length },
    { id: "history", label: "History", count: versions.length }
  ];

  const candidateByField = new Map<string, Row>();
  for (const item of candidates) {
    const key = String(item.fieldName);
    if (!candidateByField.has(key)) candidateByField.set(key, item);
  }

  function termDisplayValue(key: TermKey): string {
    if (key === "channels") return channelsLabel(loadedAgreement.channels);
    if (key === "products") {
      return products.length
        ? products.map((productId) => productNameById.get(productId) ?? "Product").join(", ")
        : "—";
    }
    if (key === "territoryScope") return territoryLabel(loadedAgreement.territoryScope);
    if (key === "effectiveAt" || key === "expiresAt" || key === "renewalReviewAt") return date(loadedAgreement[key]);
    if (key === "commissionRate") {
      const formatted = formatPercentInput(loadedAgreement.commissionRate);
      return formatted ? `${formatted}%` : "—";
    }
    if (key === "commissionBasis") {
      const value = shown(loadedAgreement.commissionBasis, "");
      return value ? stageDisplayLabel(value) : "—";
    }
    return shown(loadedAgreement[key]);
  }

  function termStatus(key: TermKey): { label: string; tone: string } {
    const candidate = candidateByField.get(key);
    if (candidate?.status === "proposed") return { label: "Needs review", tone: "needs_review" };
    if (candidate?.ambiguous) return { label: "Ambiguous", tone: "needs_review" };
    const value = termDisplayValue(key);
    if (!value || value === "—" || value === "Not set") return { label: "Missing", tone: "draft" };
    return { label: "Recorded", tone: "active" };
  }

  function setChange(key: string, value: string) {
    setChanges((current) => ({ ...current, [key]: value }));
  }

  function viewInAgreement(location: unknown) {
    const page = parsePageHint(location);
    if (page) setViewerPage(page);
    setActiveTab("agreement");
  }

  function openUpload(mode: "attach" | "replace" | "revised") {
    uploadModeRef.current = mode;
    fileInputRef.current?.click();
  }

  return (
    <div className={`page ry-relationship-page ry-representation-page ry-agreement-workspace${dirty && activeTab === "terms" ? " has-terms-footer" : ""}`}>
      <RelationshipTrail items={[
        { label: "Representation", to: "/representation" },
        ...(representationOpportunityId ? [{ label: "Opportunity", to: `/representation/${representationOpportunityId}` }] : []),
        { label: `${brandName} Agreement` }
      ]} />
      <IdentityHeader
        eyebrow="Representation Agreement"
        title={`${brandName} Agreement`}
        relationship={versionMeta}
        status={(
          <span className={`ry-representation-status ry-representation-status-${status === "active" ? "active" : status === "ended" ? "ended" : status === "draft" ? "draft" : "needs_review"}`}>
            <span className="ry-representation-status-dot" aria-hidden="true" />
            {stageDisplayLabel(status)}
          </span>
        )}
        nextAction={<span>{nextActionCopy}</span>}
        actions={<Button variant="secondary" onClick={() => void navigate("/representation")}>All agreements</Button>}
      />
      {actionError ? (
        <ReviewErrorSummary
          message={actionError}
          conflict={conflict}
          onReload={() => { void reload(); setApprovalId(""); setConflict(false); setActionError(""); }}
        />
      ) : null}
      {!canWrite ? (
        <Alert tone="warning" title="Read-only agreement">
          You can inspect terms and history, but this session cannot edit or approve.
        </Alert>
      ) : null}
      {uploadNote ? <Alert tone="info" title="Document uploaded">{uploadNote}</Alert> : null}

      <input
        ref={fileInputRef}
        className="ry-agreement-file-input"
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        aria-label="Agreement document"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadDocument(file);
        }}
      />

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Agreement views" baseId={tabBaseId} />

      <RelationshipTabPanel id={tabBaseId} tabId="agreement" active={activeTab === "agreement"} className="ry-agreement-tab-panel">
        <div className="ry-agreement-split">
          <div className="ry-agreement-document-pane">
            {documentReady ? (
              <AgreementDocumentViewer
                documentId={documentId}
                documentName={shown(agreement.documentName, "agreement.pdf")}
                page={viewerPage}
                onPageChange={setViewerPage}
                canWrite={canWrite}
                onReplace={() => openUpload("replace")}
                onRevised={() => openUpload("revised")}
              />
            ) : documentPending ? (
              <div className="ry-agreement-upload-state">
                <h2>Document scanning</h2>
                <p>The uploaded agreement is still being scanned. Preview unlocks when it is active and clean.</p>
                <StatusLabel value={shown(agreement.documentScanStatus, "scanning")} />
              </div>
            ) : (
              <div className="ry-agreement-upload-state">
                <h2>Add the representation agreement</h2>
                <p>Upload the proposed or signed agreement to begin reviewing its commercial terms.</p>
                <Button disabled={!canWrite || saving || !representationOpportunityId} loading={saving} onClick={() => openUpload("attach")}>
                  Upload agreement
                </Button>
                {!representationOpportunityId ? (
                  <p className="ry-agreement-empty-note">This agreement is not linked to an opportunity, so upload is unavailable here.</p>
                ) : null}
              </div>
            )}
          </div>

          <aside className="ry-agreement-review-panel" aria-label="Agreement review">
            {!active ? (
              <p className="ry-agreement-authority-notice">
                Authority not active — this agreement must be reviewed and approved before it can establish representation authority.
              </p>
            ) : null}

            <dl className="ry-agreement-review-facts">
              <div>
                <dt>Agreement status</dt>
                <dd>
                  <span className={`ry-representation-status ry-representation-status-${status === "active" ? "active" : status === "ended" ? "ended" : status === "draft" ? "draft" : "needs_review"}`}>
                    <span className="ry-representation-status-dot" aria-hidden="true" />
                    {stageDisplayLabel(status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Authority</dt>
                <dd>
                  <AuthorityIndicator
                    value={active ? "established" : status === "suspended" ? "suspended" : status === "ended" ? "ended" : "not_established"}
                    rationale="Only an active agreement establishes current representation authority."
                  />
                </dd>
              </div>
              <div>
                <dt>Review progress</dt>
                <dd>
                  <span>{passedChecks} of 4 checks ready</span>
                  <span
                    className="ry-agreement-review-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={4}
                    aria-valuenow={passedChecks}
                    aria-label={`${passedChecks} of 4 checks ready`}
                  >
                    <span
                      className="ry-agreement-review-progress-fill"
                      style={{ width: `${(passedChecks / 4) * 100}%` }}
                    />
                  </span>
                </dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{date(agreement.expiresAt)}</dd>
              </div>
            </dl>

            <section className="ry-agreement-review-block">
              <h3>Needs attention</h3>
              {attentionItems.length ? (
                <ul>{attentionItems.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : (
                <p>No blockers. Ready to request approval.</p>
              )}
            </section>

            <section className="ry-agreement-review-block">
              <h3>Missing or ambiguous</h3>
              {ambiguousCandidates.length ? (
                <ul>
                  {ambiguousCandidates.slice(0, 6).map((item) => (
                    <li key={item.id}>
                      <button type="button" className="text-button" onClick={() => viewInAgreement(item.sourceLocation)}>
                        {materialFieldLabel(item.fieldName)}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No ambiguous clauses recorded.</p>
              )}
            </section>

            <section className="ry-agreement-review-block">
              <h3>Next action</h3>
              <p>{nextActionCopy}</p>
            </section>

            {pending && !approvalId ? (
              <div className="ry-agreement-review-action">
                <Button loading={saving} disabled={!canWrite || !readyForApproval} onClick={() => void requestApproval()}>
                  Request approval
                </Button>
                <p className="ry-agreement-review-action-note">
                  Step 1 of 2 — prepares this version for review. Does not grant authority yet.
                </p>
              </div>
            ) : null}
            {pending && approvalId ? (
              <div className="ry-agreement-review-action">
                <p className="ry-agreement-review-action-note">
                  Step 2 of 2 — approval is ready. Confirming activates only the reviewed written scope.
                </p>
                <Button disabled={!canWrite || saving} onClick={() => setConfirmationOpen(true)}>
                  Confirm and activate
                </Button>
              </div>
            ) : null}
            {active ? (
              <div className="ry-button-group">
                <Button variant="secondary" size="compact" disabled={!canWrite || saving} onClick={() => void end("suspended")}>Suspend</Button>
                <Button variant="destructive" size="compact" disabled={!canWrite || saving} onClick={() => void end("ended")}>End</Button>
              </div>
            ) : null}
          </aside>
        </div>
      </RelationshipTabPanel>

      <RelationshipTabPanel id={tabBaseId} tabId="terms" active={activeTab === "terms"}>
        <RelationshipSection
          className="ry-agreement-section"
          title="Agreement terms"
          description={pending ? "Review each term, then edit only what needs updating." : "Material terms are locked while authority is active."}
        >
          <div className="ry-agreement-terms-board">
            {TERM_GROUPS.map((group) => (
              <TermGroup
                key={group.id}
                title={group.title}
                open={Boolean(openGroups[group.id])}
                onToggle={() => setOpenGroups((current) => ({ ...current, [group.id]: !current[group.id] }))}
              >
                <Table caption={group.title} compact className="ry-agreement-terms-table">
                  <thead>
                    <tr>
                      <th scope="col">Term</th>
                      <th scope="col">Value</th>
                      <th scope="col">Source</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="ry-register-cell-actions">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.fields.map((key) => {
                      const candidate = candidateByField.get(key);
                      const statusMeta = termStatus(key);
                      const editing = editingTerm === key;
                      return (
                        <Fragment key={key}>
                          <DataRow className={editing ? "is-editing" : undefined}>
                            <td className="ry-register-cell-lead">{TERM_LABELS[key]}</td>
                            <td>{termDisplayValue(key)}</td>
                            <td className="ry-agreement-term-source">
                              {candidate ? shown(candidate.sourceLocation, "No source cited") : "No source cited"}
                            </td>
                            <td>
                              <span className={`ry-representation-status ry-representation-status-${statusMeta.tone}`}>
                                <span className="ry-representation-status-dot" aria-hidden="true" />
                                {statusMeta.label}
                              </span>
                            </td>
                            <td className="ry-register-cell-actions">
                              <div className="ry-agreement-term-actions">
                                {candidate?.sourceLocation ? (
                                  <Button type="button" variant="tertiary" size="compact" onClick={() => viewInAgreement(candidate.sourceLocation)}>
                                    View
                                  </Button>
                                ) : null}
                                {pending && canWrite ? (
                                  <Button
                                    type="button"
                                    variant="tertiary"
                                    size="compact"
                                    onClick={() => setEditingTerm(editing ? null : key)}
                                  >
                                    {editing ? "Close" : "Edit"}
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </DataRow>
                          {editing ? (
                            <tr className="ry-agreement-term-editor-row">
                              <td colSpan={5} className="ry-agreement-term-editor-cell">
                                <div className="ry-agreement-term-editor">
                                  {key === "channels" ? (
                                    <div className="ry-agreement-chip-list" role="group" aria-label="Sales channels">
                                      {agreementChannelOptions.map((option) => {
                                        const selected = selectedChannels.includes(option.value);
                                        return (
                                          <label key={option.value} className={`ry-agreement-chip${selected ? " is-selected" : ""}`}>
                                            <input
                                              type="checkbox"
                                              checked={selected}
                                              onChange={() => {
                                                const next = selected
                                                  ? selectedChannels.filter((item) => item !== option.value)
                                                  : [...selectedChannels, option.value];
                                                setChange("channels", next.join(","));
                                              }}
                                            />
                                            <span>{option.label}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                  {key === "products" ? (
                                    <div className="ry-agreement-chip-list" role="group" aria-label="Products">
                                      {brandProducts.map((item) => {
                                        const selected = productIds.includes(String(item.id));
                                        return (
                                          <label key={item.id} className={`ry-agreement-chip${selected ? " is-selected" : ""}`}>
                                            <input
                                              type="checkbox"
                                              checked={selected}
                                              onChange={() => {
                                                setProductDirty(true);
                                                setProductIds((current) => (
                                                  current.includes(String(item.id))
                                                    ? current.filter((value) => value !== String(item.id))
                                                    : [...current, String(item.id)]
                                                ));
                                              }}
                                            />
                                            <span>{displayProductName(item.name)}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                  {key === "territoryScope" ? (
                                    <Select value={selectedTerritory || ""} onChange={(event) => setChange("territoryScope", event.target.value)}>
                                      <option value="">Select territory</option>
                                      {agreementTerritoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                                    </Select>
                                  ) : null}
                                  {key === "commissionCurrency" ? (
                                    <Select value={fieldDraft(agreement, changes, key)} onChange={(event) => setChange(key, event.target.value)}>
                                      <option value="">Select currency</option>
                                      {agreementCurrencyOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                                    </Select>
                                  ) : null}
                                  {key === "commissionRate" ? (
                                    <div className="ry-agreement-affix">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        inputMode="decimal"
                                        value={fieldDraft(agreement, changes, key)}
                                        onChange={(event) => setChange(key, event.target.value)}
                                      />
                                      <span aria-hidden="true">%</span>
                                    </div>
                                  ) : null}
                                  {key === "effectiveAt" || key === "expiresAt" || key === "renewalReviewAt" ? (
                                    <Input
                                      type="date"
                                      value={changes[key] != null ? toDateInputValue(changes[key]) : toDateInputValue(agreement[key])}
                                      onChange={(event) => setChange(key, fromDateInputValue(event.target.value))}
                                    />
                                  ) : null}
                                  {key === "commissionBasis" || key === "commissionTiming" || key === "openingOrderRights" || key === "reorderRights" || key === "protectedAccountRules" || key === "houseAccountRules" || key === "terminationTerms" || key === "postTerminationCommissionRights" || key === "authoritySummary" ? (
                                    key === "commissionBasis" || key === "commissionTiming" ? (
                                      <Input value={fieldDraft(agreement, changes, key)} onChange={(event) => setChange(key, event.target.value)} />
                                    ) : (
                                      <TextArea rows={3} value={fieldDraft(agreement, changes, key)} onChange={(event) => setChange(key, event.target.value)} />
                                    )
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </Table>
              </TermGroup>
            ))}
          </div>
        </RelationshipSection>
      </RelationshipTabPanel>

      <RelationshipTabPanel id={tabBaseId} tabId="evidence" active={activeTab === "evidence"}>
        <RelationshipSection className="ry-agreement-section" title="Term candidates" description="Values linked to a source page or section.">
          {candidates.length === 0 ? (
            <p className="ry-agreement-empty-note">No term candidates recorded yet.</p>
          ) : (
            <Table caption="Term candidates" compact className="ry-agreement-evidence-table">
              <thead>
                <tr>
                  <th scope="col">Term</th>
                  <th scope="col">Value</th>
                  <th scope="col">Source</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="ry-register-cell-actions">Action</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((item) => (
                  <DataRow key={item.id}>
                    <td className="ry-register-cell-lead">{materialFieldLabel(item.fieldName)}</td>
                    <td>{shown(item.proposedValue)}</td>
                    <td className="ry-agreement-term-source">{shown(item.sourceLocation, "—")}</td>
                    <td><StatusLabel value={String(item.status)} /></td>
                    <td className="ry-register-cell-actions">
                      <div className="ry-agreement-term-actions">
                        {item.sourceLocation ? (
                          <Button type="button" variant="tertiary" size="compact" onClick={() => viewInAgreement(item.sourceLocation)}>View</Button>
                        ) : null}
                        {item.status === "proposed" && canWrite ? (
                          <>
                            <Button variant="tertiary" size="compact" disabled={saving} onClick={() => void reviewCandidate(item, "confirmed")}>Confirm</Button>
                            <Button variant="tertiary" size="compact" disabled={saving} onClick={() => void reviewCandidate(item, "rejected")}>Reject</Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </DataRow>
                ))}
              </tbody>
            </Table>
          )}
        </RelationshipSection>

        <RelationshipSection className="ry-agreement-section" title="Account restrictions" description="Written rules cited in the source agreement.">
          {restrictions.length === 0 ? (
            <p className="ry-agreement-empty-note">No account restrictions recorded.</p>
          ) : (
            <Table caption="Account restrictions" compact className="ry-agreement-evidence-table">
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Rule</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {restrictions.map((item) => (
                  <DataRow key={item.id}>
                    <td className="ry-register-cell-lead">{shown(item.accountName)}</td>
                    <td>{readable(String(item.restrictionType))}</td>
                    <td className="ry-agreement-term-source">{shown(item.sourceLocation, "—")}</td>
                  </DataRow>
                ))}
              </tbody>
            </Table>
          )}
        </RelationshipSection>

        {["draft", "reviewing"].includes(status) && canWrite ? (
          <RelationshipSection
            className="ry-agreement-section"
            title="Add evidence"
            description="Record a term candidate or written account restriction."
            action={(
              <Button
                type="button"
                variant="tertiary"
                size="compact"
                aria-expanded={evidenceAdvancedOpen}
                onClick={() => setEvidenceAdvancedOpen((current) => !current)}
              >
                {evidenceAdvancedOpen ? "Hide" : "Add"}
              </Button>
            )}
          >
            {evidenceAdvancedOpen ? (
              <div className="ry-agreement-evidence-compose is-revealed">
                <div className="ry-agreement-evidence-progress" aria-label="Evidence type">
                  <button
                    type="button"
                    className={`ry-agreement-evidence-step${evidenceKind === "term" ? " is-active" : ""}`}
                    aria-pressed={evidenceKind === "term"}
                    onClick={() => setEvidenceKind("term")}
                  >
                    Term candidate
                  </button>
                  <button
                    type="button"
                    className={`ry-agreement-evidence-step${evidenceKind === "restriction" ? " is-active" : ""}`}
                    aria-pressed={evidenceKind === "restriction"}
                    onClick={() => setEvidenceKind("restriction")}
                  >
                    Account restriction
                  </button>
                </div>

                {evidenceKind === "term" ? (
                  <form className="ry-agreement-evidence-form" onSubmit={(event) => void proposeCandidate(event)}>
                    <div className="ry-agreement-evidence-grid">
                      <Field label="Material field">
                        <Select controlSize="compact" value={candidateField} onChange={(event) => setCandidateField(event.target.value)}>
                          {materialFieldOptions.map((item) => <option key={item} value={item}>{materialFieldLabel(item)}</option>)}
                        </Select>
                      </Field>
                      <Field label="Extracted value">
                        <Input
                          required
                          controlSize="compact"
                          value={candidateValue}
                          onChange={(event) => setCandidateValue(event.target.value)}
                        />
                      </Field>
                      <Field label="Document page or section">
                        <Input
                          required
                          controlSize="compact"
                          value={sourceLocation}
                          onChange={(event) => setSourceLocation(event.target.value)}
                        />
                      </Field>
                      <div className="ry-agreement-evidence-check">
                        <Checkbox label="Legal ambiguity requires review" checked={ambiguous} onChange={(event) => setAmbiguous(event.target.checked)} />
                      </div>
                    </div>
                    <div className="ry-agreement-evidence-footer">
                      <Button type="submit" size="compact" disabled={saving}>Record candidate</Button>
                    </div>
                  </form>
                ) : (
                  <form className="ry-agreement-evidence-form" onSubmit={(event) => void addRestriction(event)}>
                    <div className="ry-agreement-evidence-grid">
                      <Field label="Written rule type">
                        <Select controlSize="compact" value={restrictionType} onChange={(event) => setRestrictionType(event.target.value)}>
                          <option value="house_account_exclusion">House-account exclusion</option>
                          <option value="account_exclusion">Account exclusion</option>
                          <option value="protected_account_basis">Protected-account basis</option>
                        </Select>
                      </Field>
                      <Field label="Business named in writing">
                        <Select
                          required
                          controlSize="compact"
                          value={restrictionBusinessId}
                          onChange={(event) => setRestrictionBusinessId(event.target.value)}
                        >
                          <option value="">Select business</option>
                          {businesses.map((item) => <option key={item.id} value={String(item.id)}>{String(item.name)}</option>)}
                        </Select>
                      </Field>
                      <Field label="Document page or section" className="ry-agreement-evidence-span">
                        <Input
                          required
                          controlSize="compact"
                          value={restrictionLocation}
                          onChange={(event) => setRestrictionLocation(event.target.value)}
                        />
                      </Field>
                    </div>
                    <div className="ry-agreement-evidence-footer">
                      <Button type="submit" size="compact" disabled={saving}>Record restriction</Button>
                    </div>
                  </form>
                )}
              </div>
            ) : null}
          </RelationshipSection>
        ) : null}
      </RelationshipTabPanel>

      <RelationshipTabPanel id={tabBaseId} tabId="history" active={activeTab === "history"}>
        <RelationshipSection
          className="ry-agreement-section"
          title="History"
          description={`${versionMeta}. Changes to terms are listed below.`}
          action={(
            <Button variant="tertiary" size="compact" onClick={() => setTechnicalOpen((current) => !current)}>
              {technicalOpen ? "Hide technical details" : "View technical details"}
            </Button>
          )}
        >
          {versions.length === 0 ? (
            <p className="ry-agreement-empty-note">No term changes have been recorded yet for this agreement.</p>
          ) : (
            <Table caption="Version history" compact className="ry-agreement-evidence-table">
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col">What changed</th>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((item) => (
                  <DataRow key={item.id}>
                    <td className="ry-register-cell-lead">{shown(item.version)}</td>
                    <td>{versionChangeLabel(item)}</td>
                    <td className="ry-agreement-term-source">{date(item.changedAt)}</td>
                    <td className="ry-agreement-term-source">
                      {displayActor(item.changedByName ?? item.changedBy, session?.user)}
                    </td>
                  </DataRow>
                ))}
              </tbody>
            </Table>
          )}
          {technicalOpen ? (
            <div className="ry-agreement-technical">
              <p className="ry-agreement-technical-intro">Identifiers used for support and auditing.</p>
              <dl>
                <div>
                  <dt>Scope fingerprint</dt>
                  <dd className="ry-agreement-technical-value">{authorityDigest || "—"}</dd>
                </div>
                <div>
                  <dt>Approval</dt>
                  <dd>{approvalRef || "Not prepared yet"}</dd>
                </div>
                <div>
                  <dt>Approved</dt>
                  <dd>
                    {approvedBy
                      ? `${displayActor(shown(agreement.approvedByName, "") || approvedBy, session?.user)} · ${date(agreement.approvedAt)}`
                      : "Not approved yet"}
                  </dd>
                </div>
                <div>
                  <dt>Source file check</dt>
                  <dd className="ry-agreement-technical-value">
                    {documentHash || "No source file linked"}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </RelationshipSection>
      </RelationshipTabPanel>

      {dirty && activeTab === "terms" && pending ? (
        <div className="ry-agreement-terms-footer" role="status">
          <p>Unsaved changes</p>
          <div className="ry-button-group">
            <Button type="button" variant="tertiary" size="compact" disabled={saving} onClick={cancelTerms}>Cancel</Button>
            <Button type="button" size="compact" loading={saving} disabled={!canWrite} onClick={() => void saveTerms()}>Save changes</Button>
          </div>
        </div>
      ) : null}

      <ConfirmationDialog
        open={confirmationOpen}
        title="Activate this agreement?"
        description="You’re about to turn on representation authority for the terms you’ve reviewed."
        consequence={
          <p>
            Only those written terms become active. If you change them later, you’ll need to approve the agreement again.
          </p>
        }
        confirmLabel="Confirm and activate"
        confirmVariant="primary"
        processing={saving}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={() => void activate()}
      />
    </div>
  );
}
