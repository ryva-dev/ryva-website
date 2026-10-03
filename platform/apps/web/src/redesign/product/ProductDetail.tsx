import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  ActivityTimeline,
  Alert,
  Button,
  ErrorState,
  EvidenceLabel,
  Field,
  IdentityHeader,
  Input,
  LoadingState,
  RiskIndicator,
  Select,
} from "../../design-system";
import {
  ContextRail,
  RelationshipDetailLayout,
  RelationshipSection,
  RelationshipTabPanel,
  RelationshipTabs,
  RelationshipTrail,
  type RelationshipTab
} from "../relationship/RelationshipDetail";
import { displayBrandName } from "../brand/utils";
import {
  canonicalProductPaths,
  dateTime,
  displayName,
  formatProductEvidenceDisplay,
  normalizeComparisonProduct,
  productDataCompleteness,
  productReviewOutcomeLabel,
  productStageLabel,
  previewLeadTime,
  previewMarginValue,
  previewMoq,
  previewRetail,
  previewWholesale,
  readable,
  shown,
  type ProductCompatibility,
  type ProductRow
} from "./utils";

type Source = { id: string; reference: string; status?: string };
type Detail = {
  product: ProductRow;
  evidence: ProductRow[];
  risks: ProductRow[];
  decisions: ProductRow[];
  observations: ProductRow[];
  recommendations: ProductRow[];
  matches: ProductRow[];
  unknowns: ProductRow[];
  unsupportedClaims: ProductRow[];
};

type ReadinessState = "Complete" | "Needs review" | "Missing" | "Not applicable";

const observationTypes = [
  ["price_change", "Price change"],
  ["inventory_update", "Inventory update"],
  ["lead_time_change", "Lead-time change"],
  ["packaging_update", "Packaging update"],
  ["sales_signal", "Sales signal"]
] as const;

const reviewOutcomes = [
  { value: "Ready for wholesale", status: "qualified", label: "Ready for wholesale" },
  { value: "Needs more information", status: "under_review", label: "Needs more information" },
  { value: "Not a fit", status: "rejected", label: "Not a fit" },
  { value: "Hold for later", status: "watchlist", label: "Hold for later" }
] as const;

const detailAreas = ["Commercial", "Merchandising", "Performance", "Market", "Identity"] as const;
type DetailArea = (typeof detailAreas)[number];

type DetailDraft = {
  wholesalePrice: string;
  consumerPrice: string;
  currency: string;
  moq: string;
  leadTime: string;
  inventoryNotes: string;
  casePack: string;
  fulfillmentNotes: string;
  packagingReadiness: string;
  packagingNotes: string;
  salesEvidenceSummary: string;
  physicalRetailPresence: string;
  trendDirection: string;
  differentiation: string;
  summary: string;
  imageUrl: string;
  wholesaleReadiness: string;
  monitoringStatus: string;
  identityNote: string;
  optionalNote: string;
};

type ReadinessChecklistItem = {
  label: string;
  state: ReadinessState;
  area: DetailArea;
  fieldId: string;
};

const emptyDetailDraft = (): DetailDraft => ({
  wholesalePrice: "",
  consumerPrice: "",
  currency: "USD",
  moq: "",
  leadTime: "",
  inventoryNotes: "",
  casePack: "",
  fulfillmentNotes: "",
  packagingReadiness: "not_reviewed",
  packagingNotes: "",
  salesEvidenceSummary: "",
  physicalRetailPresence: "unknown",
  trendDirection: "unknown",
  differentiation: "",
  summary: "",
  imageUrl: "",
  wholesaleReadiness: "not_reviewed",
  monitoringStatus: "not_monitored",
  identityNote: "",
  optionalNote: ""
});

function draftFromRecord(record: ProductRow): DetailDraft {
  const fields = (record.customFields ?? record.custom_fields) as Record<string, unknown> | undefined;
  const custom = (key: string, ...alts: string[]) => {
    for (const candidate of [key, ...alts]) {
      const value = fields?.[candidate];
      if (value !== null && value !== undefined && value !== "") return shown(value, "");
    }
    return "";
  };
  return {
    wholesalePrice: shown(record.wholesalePrice ?? custom("wholesalePrice", "wholesale_price"), ""),
    consumerPrice: shown(record.consumerPrice ?? record.consumer_price, ""),
    currency: shown(record.currency, "USD") || "USD",
    moq: shown(record.moq ?? custom("moq"), ""),
    leadTime: shown(record.leadTime ?? custom("leadTime", "lead_time"), ""),
    inventoryNotes: shown(record.inventoryNotes ?? record.inventory_notes, ""),
    casePack: shown(record.casePack ?? custom("casePack", "case_pack"), ""),
    fulfillmentNotes: shown(record.fulfillmentNotes ?? record.fulfillment_notes, ""),
    packagingReadiness: shown(record.packagingReadiness ?? record.packaging_readiness, "not_reviewed") || "not_reviewed",
    packagingNotes: "",
    salesEvidenceSummary: shown(record.salesEvidenceSummary ?? record.sales_evidence_summary, ""),
    physicalRetailPresence: shown(record.physicalRetailPresence ?? record.physical_retail_presence, "unknown") || "unknown",
    trendDirection: shown(record.trendDirection ?? record.trend_direction, "unknown") || "unknown",
    differentiation: shown(record.differentiation, ""),
    summary: shown(record.summary, ""),
    imageUrl: shown(record.imageUrl ?? custom("imageUrl", "image_url", "image"), ""),
    wholesaleReadiness: shown(record.wholesaleReadiness ?? record.wholesale_readiness, "not_reviewed") || "not_reviewed",
    monitoringStatus: shown(record.monitoringStatus ?? record.monitoring_status, "not_monitored") || "not_monitored",
    identityNote: "",
    optionalNote: ""
  };
}

function observationPlaceholder(metric: string): string {
  switch (metric) {
    case "price_change":
      return "New wholesale or retail price";
    case "inventory_update":
      return "Current inventory note";
    case "lead_time_change":
      return "Updated lead time";
    case "packaging_update":
      return "Packaging status or notes";
    case "sales_signal":
      return "Sales signal detail";
    default:
      return "Update value";
  }
}

function hasMeaningful(value: unknown): boolean {
  const text = shown(value, "").trim();
  if (!text || text === "—" || text === "Not recorded") return false;
  const lowered = text.toLowerCase();
  return lowered !== "unknown" && lowered !== "not monitored" && lowered !== "not_reviewed";
}

function readinessFromValue(value: unknown): ReadinessState {
  const text = shown(value, "").trim().toLowerCase();
  if (!text || text === "—" || text === "unknown" || text === "not_reviewed") return "Missing";
  if (text === "ready") return "Complete";
  if (text === "conditional" || text === "not_ready") return "Needs review";
  return "Needs review";
}

function readinessFromPresence(...values: unknown[]): ReadinessState {
  const present = values.map((value) => hasMeaningful(value));
  if (present.every(Boolean)) return "Complete";
  if (present.some(Boolean)) return "Needs review";
  return "Missing";
}

function buyerFitLabel(status: string): string {
  if (status === "confirmed") return "Strong match";
  if (status === "rejected") return "Not a fit";
  if (status === "proposed") return "Needs review";
  return "Possible match";
}

function buyerTypeSourceLabel(origin: string): string {
  if (origin === "user_entered") return "Added by you";
  if (origin === "imported") return "Imported";
  if (origin === "ai_suggested" || origin === "system_derived") return "Ryva suggestion";
  return "Recorded";
}

export function ProductDetailPage({
  compatibility = canonicalProductPaths
}: {
  compatibility?: ProductCompatibility;
}) {
  const id = useParams().id ?? "";
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const tabBaseId = `product-${useId().replaceAll(":", "")}`;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [observationBusy, setObservationBusy] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [contextOpen, setContextOpen] = useState(false);
  const [evidenceClass, setEvidenceClass] = useState("direct_evidence");
  const [sourceId, setSourceId] = useState("");
  const [observationMetric, setObservationMetric] = useState<string>(observationTypes[0][0]);
  const [observationValue, setObservationValue] = useState("");
  const [decisionOutcome, setDecisionOutcome] = useState<string>(reviewOutcomes[0].value);
  const [decisionRationale, setDecisionRationale] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextStatus, setNextStatus] = useState<string>(reviewOutcomes[0].status);
  const [reviewOwner, setReviewOwner] = useState("");
  const [reviewDueDate, setReviewDueDate] = useState("");
  const [recommendationCategory, setRecommendationCategory] = useState("");
  const [recommendationRationale, setRecommendationRationale] = useState("");
  const [detailArea, setDetailArea] = useState<DetailArea>("Commercial");
  const [detailDraft, setDetailDraft] = useState<DetailDraft>(emptyDetailDraft);
  const [draftProductId, setDraftProductId] = useState("");

  const endpoint = `/api/intelligence/products/${id}`;
  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setLoadError("");
    try {
      const [payload, sourcePayload] = await Promise.all([
        api<Detail>(endpoint),
        api<{ sources: Source[] }>("/api/sources")
      ]);
      const normalized = normalizeComparisonProduct({
        product: payload.product,
        unknowns: payload.unknowns,
        evidence: payload.evidence,
        risks: payload.risks
      });
      setDetail({
        ...payload,
        product: { ...payload.product, ...normalized }
      });
      setSources(sourcePayload.sources);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "The Product could not be loaded.");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { void load(); }, [load]);

  const record = detail?.product;

  useEffect(() => {
    if (!record?.id) return;
    if (record.id === draftProductId) return;
    setDetailDraft(draftFromRecord(record));
    setDraftProductId(record.id);
  }, [record, draftProductId]);

  function updateDraft<K extends keyof DetailDraft>(key: K, value: DetailDraft[K]) {
    setDetailDraft((current) => ({ ...current, [key]: value }));
  }

  function openReadinessDetail(area: DetailArea, fieldId: string) {
    setActiveTab("details");
    setDetailArea(area);
    window.setTimeout(() => {
      const target = document.getElementById(fieldId);
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    }, 0);
  }

  function buildDetailClaim(area: DetailArea, draft: DetailDraft): { claim: string; changes: Record<string, unknown>; fields: string[] } {
    const parts: string[] = [];
    const changes: Record<string, unknown> = {};
    const fields: string[] = [];
    const trim = (value: string) => value.trim();
    const take = (field: string, value: unknown, label: string, display?: string) => {
      fields.push(field);
      changes[field] = value;
      parts.push(`${label} ${display ?? String(value)}`);
    };

    if (area === "Commercial") {
      const wholesale = trim(draft.wholesalePrice);
      const retail = trim(draft.consumerPrice);
      const currency = trim(draft.currency).toUpperCase() || "USD";
      const moq = trim(draft.moq);
      const leadTime = trim(draft.leadTime);
      const inventory = trim(draft.inventoryNotes);
      const casePack = trim(draft.casePack);
      const fulfillment = trim(draft.fulfillmentNotes);
      const note = trim(draft.optionalNote);
      if (wholesale) take("wholesalePrice", wholesale, "Wholesale", `$${wholesale}`);
      if (retail) {
        const amount = Number(retail.replace(/[^0-9.-]/g, ""));
        if (Number.isFinite(amount)) take("consumerPrice", amount, "Retail", `$${amount}`);
        else parts.push(`Retail ${retail}`);
      }
      if (currency && (wholesale || retail)) take("currency", currency, "Currency");
      else if (currency && currency !== "USD") take("currency", currency, "Currency");
      if (moq) take("moq", moq, "MOQ");
      if (leadTime) take("leadTime", leadTime, "Lead time");
      if (inventory) take("inventoryNotes", inventory, "Inventory");
      if (casePack) take("casePack", casePack, "Case pack");
      if (fulfillment) take("fulfillmentNotes", fulfillment, "Shipping");
      if (note) parts.push(note);
    } else if (area === "Merchandising") {
      const summary = trim(draft.summary);
      const imageUrl = trim(draft.imageUrl);
      const readiness = trim(draft.packagingReadiness);
      const notes = trim(draft.packagingNotes);
      if (summary) take("summary", summary, "Description");
      if (imageUrl) take("imageUrl", imageUrl, "Product image");
      if (readiness) take("packagingReadiness", readiness, "Packaging", readable(readiness));
      if (notes) parts.push(notes);
    } else if (area === "Performance") {
      const summary = trim(draft.salesEvidenceSummary);
      const presence = trim(draft.physicalRetailPresence);
      if (summary) take("salesEvidenceSummary", summary, "Sales");
      if (presence && presence !== "unknown") take("physicalRetailPresence", presence, "Retail presence", readable(presence));
      else if (presence === "unknown" && summary) parts.push("Retail presence Unknown");
    } else if (area === "Market") {
      const trend = trim(draft.trendDirection);
      const differentiation = trim(draft.differentiation);
      const note = trim(draft.optionalNote);
      if (trend && trend !== "unknown") take("trendDirection", trend, "Trend", readable(trend));
      if (differentiation) take("differentiation", differentiation, "Differentiation");
      if (note) parts.push(note);
    } else {
      const readiness = trim(draft.wholesaleReadiness);
      const monitoring = trim(draft.monitoringStatus);
      const note = trim(draft.identityNote);
      if (readiness && readiness !== "not_reviewed") take("wholesaleReadiness", readiness, "Wholesale readiness", readable(readiness));
      if (monitoring && monitoring !== "not_monitored") take("monitoringStatus", monitoring, "Monitoring", readable(monitoring));
      if (note) parts.push(note);
    }

    return { claim: parts.join("; "), changes, fields };
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || !record) return;
    const built = buildDetailClaim(detailArea, detailDraft);
    if (!built.claim) {
      setActionError("Enter at least one detail to save.");
      return;
    }
    let status = evidenceClass;
    if (status !== "unknown" && !sourceId) {
      // Concrete values without a linked source stay unverified until Advanced source is set.
      status = "unknown";
    }
    const unknown = status === "unknown";
    const tabWhenStarted = activeTab;
    setEvidenceBusy(true);
    setActionError("");
    try {
      const created = await api<{ evidence: { id: string } }>(`/api/records/product/${id}/evidence`, {
        method: "POST",
        body: {
          exactClaim: built.claim,
          evidenceClass: status,
          verificationStatus: "reviewed",
          sourceId: unknown ? null : sourceId,
          unknownReason: unknown ? "Required evidence has not been obtained." : null,
          supports: unknown ? "" : built.claim,
          doesNotSupport: "",
          confidence: unknown ? "insufficient" : "limited",
          context: `Product detail · ${detailArea}`,
          limitations: "",
          contraryEvidence: "",
          permittedUse: "Internal qualification",
          prohibitedInference: "Do not present beyond the recorded support."
        }
      });
      const evidenceId = created.evidence?.id;
      if (built.fields.length && evidenceId) {
        const evidenceByField: Record<string, string[]> = {};
        for (const field of built.fields) evidenceByField[field] = [evidenceId];
        await api(endpoint, {
          method: "PATCH",
          body: {
            version: record.version,
            changes: built.changes,
            evidenceByField,
            origin: "human_confirmed"
          }
        });
      }
      setDetailDraft((current) => ({
        ...current,
        optionalNote: "",
        packagingNotes: detailArea === "Merchandising" ? "" : current.packagingNotes,
        identityNote: detailArea === "Identity" ? "" : current.identityNote
      }));
      await load({ silent: true });
      setActiveTab((current) => (current !== tabWhenStarted && current !== "details" ? current : "details"));
      setStatusMessage(`${detailArea} details saved.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Product detail could not be saved.");
    } finally {
      setEvidenceBusy(false);
    }
  }

  async function addObservation(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    let status = evidenceClass;
    if (status !== "unknown" && !sourceId) status = "unknown";
    const unknown = status === "unknown";
    const tabWhenStarted = activeTab;
    setObservationBusy(true);
    setActionError("");
    try {
      await api(`/api/intelligence/product/${id}/observations`, {
        method: "POST",
        body: {
          metricCode: observationMetric,
          value: observationValue,
          evidenceClass: status,
          confidence: unknown ? "insufficient" : "limited",
          sourceId: unknown ? null : sourceId,
          unknownReason: unknown ? "Observation is not yet available." : null,
          observedAt: unknown ? null : new Date().toISOString(),
          acquisitionContext: "Entered Phase 3 research",
          limitations: "",
          origin: "user_entered"
        }
      });
      setObservationValue("");
      await load({ silent: true });
      setActiveTab((current) => (current !== tabWhenStarted && current !== "review" ? current : "review"));
      setStatusMessage("Update saved.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Update could not be saved.");
    } finally {
      setObservationBusy(false);
    }
  }

  async function decide(event: FormEvent) {
    event.preventDefault();
    if (!record || !canWrite) return;
    setDecisionBusy(true);
    setActionError("");
    const rationaleParts = [
      reviewOwner.trim() ? `Owner: ${reviewOwner.trim()}` : "",
      decisionRationale.trim()
    ].filter(Boolean);
    const nextActionParts = [
      nextAction.trim(),
      reviewDueDate.trim() ? `Due: ${reviewDueDate.trim()}` : ""
    ].filter(Boolean);
    const rationaleBody = rationaleParts.join("\n");
    const nextActionBody = nextActionParts.join(" · ");
    try {
      const decision = await api<{ decision: { id: string } }>(`/api/records/product/${id}/decisions`, {
        method: "POST",
        body: {
          question: `Should this product move to ${nextStatus.replaceAll("_", " ")}?`,
          scope: "Current evidence, risks, unknowns, and relationship value",
          outcome: decisionOutcome,
          rationale: rationaleBody,
          confidence: "limited",
          nextAction: nextActionBody,
          status: "issued"
        }
      });
      let taskId: string | null = null;
      if (nextStatus !== "rejected") {
        const task = await api<{ task: { id: string } }>(`/api/records/product/${id}/tasks`, {
          method: "POST",
          body: { title: nextActionBody || decisionOutcome, priority: "medium", createdReason: "Product review", mandatoryGate: true }
        });
        taskId = task.task.id;
      }
      await api(`${endpoint}/status`, {
        method: "POST",
        body: {
          version: record.version,
          toStatus: nextStatus,
          decisionId: decision.decision.id,
          nextActionTaskId: taskId
        }
      });
      setDecisionRationale("");
      setNextAction("");
      setReviewOwner("");
      setReviewDueDate("");
      await load({ silent: true });
      setStatusMessage("Review saved.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Review could not be saved.");
    } finally {
      setDecisionBusy(false);
    }
  }

  async function createRecommendation(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    const evidenceId = detail?.evidence[0]?.id;
    if (!evidenceId) {
      setActionError("Add at least one product detail before adding a buyer type.");
      return;
    }
    const tabWhenStarted = activeTab;
    setRecommendationBusy(true);
    setActionError("");
    try {
      await api(`/api/intelligence/products/${id}/buyer-categories`, {
        method: "POST",
        body: {
          buyerCategory: recommendationCategory,
          rationale: recommendationRationale,
          confidence: "limited",
          evidenceIds: [evidenceId],
          missingEvidence: ["Confirm fit against a specific Business Buyer."],
          contraryEvidence: "",
          origin: "user_entered"
        }
      });
      setRecommendationCategory("");
      setRecommendationRationale("");
      await load({ silent: true });
      setActiveTab((current) => (current !== tabWhenStarted && current !== "buyer-fit" ? current : "buyer-fit"));
      setStatusMessage("Buyer type added.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Buyer type could not be saved.");
    } finally {
      setRecommendationBusy(false);
    }
  }

  async function decideRecommendation(recommendation: ProductRow, status: "confirmed" | "rejected") {
    if (!canWrite) return;
    setRecommendationBusy(true);
    setActionError("");
    try {
      await api(`/api/intelligence/buyer-categories/${recommendation.id}`, {
        method: "PATCH",
        body: { version: recommendation.version, status }
      });
      await load({ silent: true });
      setStatusMessage(status === "confirmed" ? "Buyer match confirmed." : "Buyer match marked not a fit.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Buyer match could not be updated.");
    } finally {
      setRecommendationBusy(false);
    }
  }

  const loadingTrail = (
    <RelationshipTrail items={[
      { label: "Products", to: compatibility.registerPath },
      { label: loading ? "Loading product" : "Product unavailable" }
    ]} />
  );

  if (!detail && loading) {
    return (
      <div className="page ry-relationship-page ry-product-page">
        {loadingTrail}
        <IdentityHeader title="Loading product" status={<span className="ry-product-status-meta">Loading</span>} />
        <LoadingState label="Loading product" />
      </div>
    );
  }

  if (!detail || !record) {
    return (
      <div className="page ry-relationship-page ry-product-page">
        {loadingTrail}
        <IdentityHeader title="Product unavailable" />
        <ErrorState message={loadError} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const status = shown(record.status, "discovered");
  const brandId = shown(record.brandId ?? record.brand_id, "");
  const brandName = displayBrandName(record.brandName ?? record.brand_name, "Brand unavailable");
  const productName = displayName(record.name);
  const category = shown(record.category, "");
  const evidence = detail.evidence;
  const observations = detail.observations ?? [];
  const recommendations = detail.recommendations ?? [];
  const matches = detail.matches ?? [];
  const decisions = detail.decisions ?? [];
  const risks = detail.risks ?? [];
  const unknownCount = detail.unknowns?.length ?? 0;

  const wholesaleDisplay = previewWholesale(record);
  const retailDisplay = previewRetail(record);
  const marginDisplay = previewMarginValue(record);
  const moqDisplay = previewMoq(record);
  const leadTimeDisplay = previewLeadTime(record);
  const pricingComplete = Boolean(wholesaleDisplay && retailDisplay);
  const stageLabel = productStageLabel(status);
  const dataCompleteness = productDataCompleteness(record, pricingComplete, wholesaleDisplay, retailDisplay, moqDisplay, leadTimeDisplay);
  const reviewOutcome = productReviewOutcomeLabel(decisions);

  const moqCasePackTarget = (): Pick<ReadinessChecklistItem, "area" | "fieldId"> => {
    if (!hasMeaningful(moqDisplay)) return { area: "Commercial", fieldId: "product-field-moq" };
    if (!hasMeaningful(record.casePack)) return { area: "Commercial", fieldId: "product-field-case-pack" };
    return { area: "Commercial", fieldId: "product-field-moq" };
  };

  const checklist: ReadinessChecklistItem[] = [
    { label: "Pricing", state: readinessFromPresence(wholesaleDisplay, retailDisplay), area: "Commercial", fieldId: "product-field-wholesale-price" },
    { label: "MOQ and case pack", state: readinessFromPresence(moqDisplay, record.casePack), ...moqCasePackTarget() },
    { label: "Lead time", state: readinessFromPresence(leadTimeDisplay), area: "Commercial", fieldId: "product-field-lead-time" },
    { label: "Inventory", state: readinessFromPresence(record.inventoryNotes), area: "Commercial", fieldId: "product-field-inventory-notes" },
    { label: "Packaging", state: readinessFromValue(record.packagingReadiness), area: "Merchandising", fieldId: "product-field-packaging-readiness" },
    { label: "Product images", state: readinessFromPresence(record.imageUrl), area: "Merchandising", fieldId: "product-field-image-url" },
    { label: "Description", state: readinessFromPresence(record.summary), area: "Merchandising", fieldId: "product-field-summary" },
    { label: "Shipping details", state: readinessFromPresence(record.fulfillmentNotes), area: "Commercial", fieldId: "product-field-fulfillment-notes" }
  ];

  const researchFields: Array<{ label: string; value: string }> = [
    { label: "Review volume", value: shown(record.reviewVolume, "Not recorded") },
    { label: "Review quality", value: shown(record.reviewQualitySummary, "Not recorded") },
    { label: "Sales evidence summary", value: shown(record.salesEvidenceSummary, "Not recorded") },
    { label: "Physical retail presence", value: readable(shown(record.physicalRetailPresence, "unknown")) },
    { label: "Monitoring", value: readable(shown(record.monitoringStatus, "not monitored")) }
  ].filter((item) => hasMeaningful(item.value) && item.value !== "Unknown" && item.value !== "Not Monitored");

  const riskLevel = risks.some((item) => ["high", "critical"].includes(shown(item.severity)))
    ? "high"
    : risks.length
      ? "medium"
      : "low";
  const riskLabel = readable(riskLevel);

  const tabs: RelationshipTab[] = [
    { id: "overview", label: "Overview" },
    { id: "details", label: "Product details", count: evidence.length },
    { id: "review", label: "Review", count: observations.length + decisions.length },
    { id: "buyer-fit", label: "Buyer fit", count: recommendations.length + matches.length },
    { id: "activity", label: "Activity", count: decisions.length + observations.length + recommendations.length + matches.length }
  ];

  const activityEntries = [
    ...decisions.map((item) => ({
      id: `decision-${item.id}`,
      title: shown(item.outcome, "Review recorded"),
      description: shown(item.rationale, "No rationale recorded."),
      meta: `${dateTime(item.decidedAt)} · Product review`,
      status: <span className="ry-product-status-meta">{readable(shown(item.status, "issued"))}</span>,
      sortAt: shown(item.decidedAt, "")
    })),
    ...observations.map((item) => ({
      id: `observation-${item.id}`,
      title: readable(shown(item.metricCode, "Product update")),
      description: shown(item.value, "Not recorded"),
      meta: dateTime(item.observedAt, "Update time not recorded"),
      status: <EvidenceLabel value={shown(item.evidenceClass, "unknown")} confidence={shown(item.confidence, "insufficient")} />,
      sortAt: shown(item.observedAt, "")
    })),
    ...recommendations.map((item) => ({
      id: `recommendation-${item.id}`,
      title: `Buyer type · ${shown(item.buyerCategory)}`,
      description: shown(item.rationale, "No rationale recorded."),
      meta: `${dateTime(item.createdAt ?? item.updatedAt, "Time not recorded")} · ${buyerFitLabel(shown(item.status, "proposed"))}`,
      status: <span className="ry-product-fit-status">{buyerFitLabel(shown(item.status, "proposed"))}</span>,
      sortAt: shown(item.createdAt ?? item.updatedAt, "")
    })),
    ...matches.map((item) => ({
      id: `match-${item.id}`,
      title: `Buyer match · ${shown(item.businessName)}`,
      description: shown(item.rationale, "No rationale recorded."),
      meta: `${dateTime(item.createdAt ?? item.updatedAt, "Time not recorded")} · ${buyerFitLabel(shown(item.status, "proposed"))}`,
      status: <span className="ry-product-fit-status">{buyerFitLabel(shown(item.status, "proposed"))}</span>,
      sortAt: shown(item.createdAt ?? item.updatedAt, "")
    }))
  ].sort((left, right) => {
    const leftTime = left.sortAt ? new Date(left.sortAt).getTime() : 0;
    const rightTime = right.sortAt ? new Date(right.sortAt).getTime() : 0;
    return rightTime - leftTime;
  }).map(({ sortAt, ...entry }) => {
    void sortAt;
    return entry;
  });

  const headerActions = canWrite
    ? <Link className="ry-button ry-button-secondary" to={compatibility.registerPath}>Back to products</Link>
    : (
      <>
        <Button disabled>Read-only</Button>
        <Link className="ry-button ry-button-secondary" to={compatibility.registerPath}>Back to products</Link>
      </>
    );

  const contextContent = (
    <>
      <div className="ry-context-item ry-product-status-item">
        <strong>Stage</strong>
        <span>{stageLabel}</span>
      </div>
      <div className="ry-context-item ry-product-status-item">
        <strong>Data completeness</strong>
        <span>{dataCompleteness}</span>
      </div>
      <div className="ry-context-item ry-product-status-item">
        <strong>Risk</strong>
        <span>{riskLabel}</span>
      </div>
      <div className="ry-context-item ry-product-status-item">
        <strong>Review outcome</strong>
        <span>{reviewOutcome}</span>
      </div>
      <div className="ry-context-item ry-product-status-item">
        <strong>Brand</strong>
        {brandId ? <Link to={`/brands/${brandId}`}>{brandName}</Link> : <span>{brandName}</span>}
      </div>
      <div className="ry-context-item ry-product-status-item">
        <strong>Next action</strong>
        <p>{shown(record.nextAction, "Complete the missing product details and record a review outcome.")}</p>
      </div>
    </>
  );

  return (
    <div className="page ry-relationship-page ry-product-page">
      <RelationshipTrail items={[
        { label: "Products", to: compatibility.registerPath },
        ...(brandId ? [{ label: brandName, to: `/brands/${brandId}` }] : []),
        { label: productName }
      ]} />
      {compatibility.showCompatibilityNotice ? (
        <Alert title="Generic Product detail compatibility">This route reuses the canonical Product Intelligence detail workspace.</Alert>
      ) : null}
      <IdentityHeader
        title={productName}
        relationship={(
          <span className="ry-product-identity-meta">
            {brandId ? <Link to={`/brands/${brandId}`}>{brandName}</Link> : brandName}
            {category ? ` · ${category}` : null}
          </span>
        )}
        status={(
          <span className="ry-product-status-meta" aria-label="Product summary">
            <span className="ry-product-status-chip">
              <strong>Stage</strong>
              <span>{stageLabel}</span>
            </span>
            <span className="ry-product-status-chip">
              <strong>Data</strong>
              <span className={`ry-product-identity-status${dataCompleteness === "Complete" ? " is-complete" : " is-attention"}`}>{dataCompleteness}</span>
            </span>
            <span className="ry-product-status-chip">
              <strong>Review outcome</strong>
              <span className={`ry-product-identity-status${decisions.length ? " is-complete" : " is-attention"}`}>{reviewOutcome}</span>
            </span>
            {unknownCount > 0 ? (
              <span className="ry-product-status-chip">
                <strong>Verification</strong>
                <span className="ry-product-identity-status is-attention">
                  {unknownCount} pending
                </span>
              </span>
            ) : null}
          </span>
        )}
        nextAction={<span>{canWrite ? "Complete the missing product details and record a review outcome." : session?.access.reason ?? "Read-only."}</span>}
        actions={headerActions}
      />
      {statusMessage ? <p className="ry-relationship-status" role="status">{statusMessage}</p> : null}
      {actionError ? <ErrorState message={actionError} /> : null}
      {!canWrite ? <p className="ry-product-readonly-note">Read-only</p> : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Product views" baseId={tabBaseId} />
      <RelationshipDetailLayout context={<ContextRail title="At a glance" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>{contextContent}</ContextRail>}>
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Product overview" description="Key commercial details for wholesale evaluation.">
            <dl className="ry-relationship-facts ry-product-overview-facts">
              <div><dt>Category</dt><dd>{shown(record.category)}</dd></div>
              <div><dt>Wholesale price</dt><dd>{wholesaleDisplay || "Not recorded"}</dd></div>
              <div><dt>Suggested retail</dt><dd>{retailDisplay || "Not recorded"}</dd></div>
              <div><dt>Margin</dt><dd>{marginDisplay ? `${marginDisplay}` : "Not recorded"}</dd></div>
              <div><dt>MOQ</dt><dd>{moqDisplay || "Not recorded"}</dd></div>
              <div><dt>Lead time</dt><dd>{leadTimeDisplay || "Not recorded"}</dd></div>
              <div><dt>Inventory</dt><dd>{shown(record.inventoryNotes, "Not recorded")}</dd></div>
              <div><dt>Packaging</dt><dd>{readable(shown(record.packagingReadiness, "not_reviewed"))}</dd></div>
              <div><dt>Product verification</dt><dd>{readable(shown(record.identityStatus, "unverified"))}</dd></div>
            </dl>
            {researchFields.length ? (
              <details className="ry-product-advanced ry-product-research-details">
                <summary>Additional research</summary>
                <dl className="ry-relationship-facts">
                  {researchFields.map((item) => (
                    <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                  ))}
                </dl>
              </details>
            ) : null}
          </RelationshipSection>
          <RelationshipSection title="Commercial readiness" description="Each item opens the matching field in Product details. Data completeness updates when details are saved.">
            <ul className="ry-product-readiness-checklist">
              {checklist.map((item) => {
                const stateClass = `is-${item.state.toLowerCase().replaceAll(" ", "-")}`;
                const rowBody = (
                  <>
                    <span className="ry-product-readiness-label">{item.label}</span>
                    <span className="ry-product-readiness-state">{item.state}</span>
                  </>
                );
                return (
                  <li key={item.label} className={stateClass} data-state={item.state === "Complete" ? "complete" : "incomplete"}>
                    {canWrite ? (
                      <button
                        type="button"
                        className="ry-product-readiness-row"
                        onClick={() => openReadinessDetail(item.area, item.fieldId)}
                      >
                        {rowBody}
                      </button>
                    ) : (
                      rowBody
                    )}
                  </li>
                );
              })}
            </ul>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="details" active={activeTab === "details"}>
          <RelationshipSection title="Product details">
            {evidence.length ? (
              <ul className="ry-relationship-evidence-list">
                {evidence.map((item) => {
                  const display = formatProductEvidenceDisplay(item);
                  return (
                    <li key={item.id} className="ry-product-evidence-item">
                      <strong>{display.headline}</strong>
                      <span className="ry-product-evidence-meta">{display.meta}</span>
                      {display.detail ? <small>{display.detail}</small> : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="ry-product-empty-note">No product details recorded yet.</p>
            )}
            {canWrite ? (
              <form className="ry-product-evidence-form ry-product-form-compact ry-product-workspace-form" onSubmit={(event) => void saveDetails(event)}>
                <div className="ry-product-area-switch" role="tablist" aria-label="Information areas">
                  {detailAreas.map((area) => (
                    <button
                      key={area}
                      type="button"
                      role="tab"
                      aria-selected={detailArea === area}
                      className={`ry-product-area-tab${detailArea === area ? " is-active" : ""}`}
                      onClick={() => setDetailArea(area)}
                    >
                      {area}
                    </button>
                  ))}
                </div>
                <div className="ry-product-form-grid">
                  {detailArea === "Commercial" ? (
                    <>
                      <Field label="Wholesale price">
                        <Input id="product-field-wholesale-price" controlSize="compact" value={detailDraft.wholesalePrice} onChange={(event) => updateDraft("wholesalePrice", event.target.value)} placeholder="e.g. 12" />
                      </Field>
                      <Field label="Suggested retail">
                        <Input id="product-field-consumer-price" controlSize="compact" value={detailDraft.consumerPrice} onChange={(event) => updateDraft("consumerPrice", event.target.value)} placeholder="e.g. 24" />
                      </Field>
                      <Field label="Currency">
                        <Input controlSize="compact" value={detailDraft.currency} onChange={(event) => updateDraft("currency", event.target.value.toUpperCase())} maxLength={3} placeholder="USD" />
                      </Field>
                      <Field label="MOQ">
                        <Input id="product-field-moq" controlSize="compact" value={detailDraft.moq} onChange={(event) => updateDraft("moq", event.target.value)} placeholder="e.g. 24" />
                      </Field>
                      <Field label="Lead time">
                        <Input id="product-field-lead-time" controlSize="compact" value={detailDraft.leadTime} onChange={(event) => updateDraft("leadTime", event.target.value)} placeholder="e.g. 3 weeks" />
                      </Field>
                      <Field label="Case pack">
                        <Input id="product-field-case-pack" controlSize="compact" value={detailDraft.casePack} onChange={(event) => updateDraft("casePack", event.target.value)} placeholder="e.g. 12 units" />
                      </Field>
                      <Field label="Inventory notes" className="ry-product-form-span">
                        <Input id="product-field-inventory-notes" controlSize="compact" value={detailDraft.inventoryNotes} onChange={(event) => updateDraft("inventoryNotes", event.target.value)} placeholder="Current stock or availability" />
                      </Field>
                      <Field label="Shipping details" className="ry-product-form-span">
                        <Input id="product-field-fulfillment-notes" controlSize="compact" value={detailDraft.fulfillmentNotes} onChange={(event) => updateDraft("fulfillmentNotes", event.target.value)} placeholder="Shipping, fulfillment, or returns notes" />
                      </Field>
                      <Field label="Optional note" className="ry-product-form-span">
                        <Input controlSize="compact" value={detailDraft.optionalNote} onChange={(event) => updateDraft("optionalNote", event.target.value)} placeholder="Short note" />
                      </Field>
                    </>
                  ) : null}
                  {detailArea === "Merchandising" ? (
                    <>
                      <Field label="Product description" className="ry-product-form-span">
                        <Input id="product-field-summary" controlSize="compact" value={detailDraft.summary} onChange={(event) => updateDraft("summary", event.target.value)} placeholder="Short product description for wholesale review" />
                      </Field>
                      <Field label="Product image URL" className="ry-product-form-span">
                        <Input id="product-field-image-url" controlSize="compact" value={detailDraft.imageUrl} onChange={(event) => updateDraft("imageUrl", event.target.value)} placeholder="https://…" />
                      </Field>
                      <Field label="Packaging readiness">
                        <Select id="product-field-packaging-readiness" controlSize="compact" value={detailDraft.packagingReadiness} onChange={(event) => updateDraft("packagingReadiness", event.target.value)}>
                          <option value="not_reviewed">Not reviewed</option>
                          <option value="not_ready">Not ready</option>
                          <option value="conditional">Conditional</option>
                          <option value="ready">Ready</option>
                        </Select>
                      </Field>
                      <Field label="Packaging notes" className="ry-product-form-span">
                        <Input controlSize="compact" value={detailDraft.packagingNotes} onChange={(event) => updateDraft("packagingNotes", event.target.value)} placeholder="Optional notes" />
                      </Field>
                    </>
                  ) : null}
                  {detailArea === "Performance" ? (
                    <>
                      <Field label="Sales summary" className="ry-product-form-span">
                        <Input controlSize="compact" value={detailDraft.salesEvidenceSummary} onChange={(event) => updateDraft("salesEvidenceSummary", event.target.value)} placeholder="What sales evidence shows" />
                      </Field>
                      <Field label="Physical retail presence" className="ry-product-form-span">
                        <Select controlSize="compact" value={detailDraft.physicalRetailPresence} onChange={(event) => updateDraft("physicalRetailPresence", event.target.value)}>
                          <option value="unknown">Unknown</option>
                          <option value="none_observed">None observed</option>
                          <option value="limited">Limited</option>
                          <option value="moderate">Moderate</option>
                          <option value="broad">Broad</option>
                        </Select>
                      </Field>
                    </>
                  ) : null}
                  {detailArea === "Market" ? (
                    <>
                      <Field label="Trend direction">
                        <Select controlSize="compact" value={detailDraft.trendDirection} onChange={(event) => updateDraft("trendDirection", event.target.value)}>
                          <option value="unknown">Unknown</option>
                          <option value="rising">Rising</option>
                          <option value="stable">Stable</option>
                          <option value="declining">Declining</option>
                          <option value="volatile">Volatile</option>
                        </Select>
                      </Field>
                      <Field label="Differentiation" className="ry-product-form-span">
                        <Input controlSize="compact" value={detailDraft.differentiation} onChange={(event) => updateDraft("differentiation", event.target.value)} placeholder="What sets this product apart" />
                      </Field>
                      <Field label="Optional note" className="ry-product-form-span">
                        <Input controlSize="compact" value={detailDraft.optionalNote} onChange={(event) => updateDraft("optionalNote", event.target.value)} placeholder="Short note" />
                      </Field>
                    </>
                  ) : null}
                  {detailArea === "Identity" ? (
                    <>
                      <Field label="Wholesale readiness">
                        <Select controlSize="compact" value={detailDraft.wholesaleReadiness} onChange={(event) => updateDraft("wholesaleReadiness", event.target.value)}>
                          <option value="not_reviewed">Not reviewed</option>
                          <option value="not_ready">Not ready</option>
                          <option value="conditional">Conditional</option>
                          <option value="ready">Ready</option>
                        </Select>
                      </Field>
                      <Field label="Monitoring status">
                        <Select controlSize="compact" value={detailDraft.monitoringStatus} onChange={(event) => updateDraft("monitoringStatus", event.target.value)}>
                          <option value="not_monitored">Not monitored</option>
                          <option value="active">Active</option>
                          <option value="paused">Paused</option>
                          <option value="source_unavailable">Source unavailable</option>
                        </Select>
                      </Field>
                      <Field label="Identity note" className="ry-product-form-span">
                        <Input controlSize="compact" value={detailDraft.identityNote} onChange={(event) => updateDraft("identityNote", event.target.value)} placeholder="Verification or identity note" />
                      </Field>
                    </>
                  ) : null}
                </div>
                <details className="ry-product-advanced">
                  <summary>Advanced</summary>
                  <div className="ry-product-form-grid">
                    <Field label="Status">
                      <Select controlSize="compact" value={evidenceClass} onChange={(event) => setEvidenceClass(event.target.value)}>
                        <option value="unknown">Not yet verified</option>
                        <option value="verified_fact">Verified</option>
                        <option value="direct_evidence">Confirmed from source</option>
                        <option value="strong_proxy">Strong indication</option>
                        <option value="weak_proxy">Weak indication</option>
                        <option value="estimate">Estimate</option>
                        <option value="assumption">Assumption</option>
                      </Select>
                    </Field>
                    {evidenceClass !== "unknown" ? (
                      <Field label="Source">
                        <Select controlSize="compact" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                          <option value="">Select…</option>
                          {sources.map((item) => <option key={item.id} value={item.id}>{item.reference}</option>)}
                        </Select>
                      </Field>
                    ) : null}
                  </div>
                </details>
                <Button type="submit" variant="secondary" size="compact" loading={evidenceBusy}>
                  {`Save ${detailArea.toLowerCase()}`}
                </Button>
              </form>
            ) : null}
          </RelationshipSection>
          {detail.unsupportedClaims?.length ? (
            <RelationshipSection title="Needs verification" description="These details need another look before using them in review.">
              <ul className="ry-relationship-evidence-list">
                {detail.unsupportedClaims.map((item) => {
                  const display = formatProductEvidenceDisplay(item);
                  return (
                    <li key={item.id} className="ry-product-evidence-item">
                      <strong>{display.headline}</strong>
                      <span className="ry-product-evidence-meta">{display.meta}</span>
                      <EvidenceLabel value={shown(item.evidenceClass, "weak_proxy")} />
                    </li>
                  );
                })}
              </ul>
            </RelationshipSection>
          ) : null}
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="review" active={activeTab === "review"}>
          <div className="ry-product-review">
            <RelationshipSection title="Product updates" description="Record changes that affect wholesale readiness.">
              {observations.length ? (
                <ul className="ry-relationship-evidence-list">
                  {observations.map((item) => (
                    <li key={item.id}>
                      <strong>{readable(shown(item.metricCode))}</strong>
                      <span>{shown(item.value, "Not recorded")}</span>
                      <EvidenceLabel value={shown(item.evidenceClass, "unknown")} confidence={shown(item.confidence, "insufficient")} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ry-product-empty-note">No product updates recorded.</p>
              )}
              {canWrite ? (
                <form className="ry-product-observation-form ry-product-form-compact ry-product-workspace-form" onSubmit={(event) => void addObservation(event)}>
                  <div className="ry-product-form-grid">
                    <Field label="Update type">
                      <Select controlSize="compact" required value={observationMetric} onChange={(event) => setObservationMetric(event.target.value)}>
                        {observationTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </Select>
                    </Field>
                    <Field label="Value">
                      <Input
                        controlSize="compact"
                        required
                        value={observationValue}
                        onChange={(event) => setObservationValue(event.target.value)}
                        placeholder={observationPlaceholder(observationMetric)}
                      />
                    </Field>
                  </div>
                  <Button type="submit" variant="secondary" size="compact" loading={observationBusy}>Save update</Button>
                </form>
              ) : null}
            </RelationshipSection>
            <RelationshipSection title="Product review" description="Record a review outcome. Saving may advance the product stage when the outcome supports it.">
              <p className="ry-product-review-status">
                Stage: {stageLabel}
                <span aria-hidden="true"> · </span>
                Review outcome: {reviewOutcome}
              </p>
              <form className="ry-product-decision-form ry-product-form-compact ry-product-workspace-form" onSubmit={(event) => void decide(event)}>
                <div className="ry-product-form-grid">
                  <Field label="Review outcome" className="ry-product-form-span">
                    <Select
                      controlSize="compact"
                      value={decisionOutcome}
                      disabled={!canWrite}
                      onChange={(event) => {
                        const selected = reviewOutcomes.find((item) => item.value === event.target.value) ?? reviewOutcomes[0];
                        setDecisionOutcome(selected.value);
                        setNextStatus(selected.status);
                      }}
                    >
                      {reviewOutcomes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Rationale" className="ry-product-form-span">
                    <Input
                      controlSize="compact"
                      required
                      value={decisionRationale}
                      onChange={(event) => setDecisionRationale(event.target.value)}
                      disabled={!canWrite}
                      placeholder="Why this review outcome"
                    />
                  </Field>
                  {nextStatus !== "rejected" ? (
                    <Field label="Next action" className="ry-product-form-span">
                      <Input controlSize="compact" required value={nextAction} onChange={(event) => setNextAction(event.target.value)} disabled={!canWrite} placeholder="What happens next" />
                    </Field>
                  ) : null}
                  <Field label="Owner">
                    <Input controlSize="compact" value={reviewOwner} onChange={(event) => setReviewOwner(event.target.value)} disabled={!canWrite} placeholder="Optional" />
                  </Field>
                  <Field label="Due date">
                    <Input controlSize="compact" type="date" value={reviewDueDate} onChange={(event) => setReviewDueDate(event.target.value)} disabled={!canWrite} />
                  </Field>
                </div>
                <Button type="submit" size="compact" loading={decisionBusy} disabled={!canWrite}>Save review</Button>
              </form>
            </RelationshipSection>
            {risks.length ? (
              <RelationshipSection title="Open risks" description="Issues that may affect wholesale readiness.">
                <ul className="ry-relationship-evidence-list">
                  {risks.map((item) => (
                    <li key={item.id}>
                      <strong>{readable(shown(item.riskType, "risk"))}</strong>
                      <RiskIndicator value={shown(item.severity, "medium")} rationale={shown(item.description, "No description recorded.")} />
                      <small>{shown(item.mitigation, "No mitigation recorded")}</small>
                    </li>
                  ))}
                </ul>
              </RelationshipSection>
            ) : null}
          </div>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="buyer-fit" active={activeTab === "buyer-fit"}>
          <div className="ry-product-buyer-fit">
            <RelationshipSection title="Buyer types" description="Wholesale buyer categories that may carry this product. Each confirmed type is a lens for finding businesses to place with.">
              {recommendations.length ? (
                <ul className="ry-relationship-evidence-list">
                  {recommendations.map((item) => (
                    <li key={item.id}>
                      <strong>{shown(item.buyerCategory)}</strong>
                      <span className="ry-product-evidence-meta">{buyerTypeSourceLabel(shown(item.origin, "user_entered"))}</span>
                      <small>{shown(item.rationale)}</small>
                      <span className={`ry-product-fit-status is-${shown(item.status, "proposed")}`}>{buyerFitLabel(shown(item.status, "proposed"))}</span>
                      {canWrite && item.status === "proposed" ? (
                        <span className="ry-product-inline-actions">
                          <Button variant="tertiary" size="compact" disabled={recommendationBusy} onClick={() => void decideRecommendation(item, "confirmed")}>Confirm</Button>
                          <Button variant="tertiary" size="compact" disabled={recommendationBusy} onClick={() => void decideRecommendation(item, "rejected")}>Reject</Button>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ry-product-empty-note">No buyer types yet.</p>
              )}
              {canWrite ? (
                <form className="ry-product-recommendation-form ry-product-form-compact ry-product-buyer-fit-form" onSubmit={(event) => void createRecommendation(event)}>
                  <p className="ry-product-form-lede">Add a wholesale buyer category from your market knowledge.</p>
                  <Field label="Buyer category">
                    <Input controlSize="compact" required value={recommendationCategory} onChange={(event) => setRecommendationCategory(event.target.value)} placeholder="e.g. Independent gift" />
                  </Field>
                  <Field label="Rationale">
                    <Input controlSize="compact" required value={recommendationRationale} onChange={(event) => setRecommendationRationale(event.target.value)} placeholder="Why this buyer type fits" />
                  </Field>
                  <Button type="submit" variant="secondary" size="compact" loading={recommendationBusy}>Add buyer type</Button>
                </form>
              ) : null}
            </RelationshipSection>
            <RelationshipSection title="Business matches" description="Specific businesses reviewed for this product — the step from buyer type toward placement.">
              {matches.length ? (
                <ul className="ry-relationship-evidence-list">
                  {matches.map((item) => {
                    const businessId = shown(item.businessId ?? item.business_id, "");
                    const businessName = displayName(item.businessName ?? item.business_name, "Business");
                    return (
                      <li key={item.id}>
                        <strong>
                          {businessId ? <Link to={`/buyers/${businessId}`}>{businessName}</Link> : businessName}
                        </strong>
                        <small>{shown(item.rationale)}</small>
                        <span className={`ry-product-fit-status is-${shown(item.status, "proposed")}`}>{buyerFitLabel(shown(item.status, "proposed"))}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="ry-product-empty-note">No businesses linked to this product yet.</p>
              )}
            </RelationshipSection>
          </div>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection title="Product activity" description="Reviews, updates, and buyer-fit decisions in newest-first order.">
            <ActivityTimeline entries={activityEntries} empty="No product activity recorded yet." label={`${productName} activity timeline`} />
          </RelationshipSection>
        </RelationshipTabPanel>
      </RelationshipDetailLayout>
    </div>
  );
}
