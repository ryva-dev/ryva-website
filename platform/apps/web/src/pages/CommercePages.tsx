import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiProblem } from "../api";
import { useAuth } from "../auth";
import { ErrorPanel, Field, Loading, PageHeader, StatusPill } from "../components";
import {
  Alert,
  ApprovalPanel,
  AuditHistory,
  AuthorityIndicator,
  Button,
  ConfirmationDialog,
  Drawer,
  EmptyState,
  ErrorState,
  IdentityHeader,
  LoadingState,
  Radio,
  SavedViewSelector,
  StatusLabel,
  TextArea
} from "../design-system";
import { useLoad } from "../hooks";
import {
  ConsequentialReviewLayout,
  ExactArtifact,
  ReadinessSummary,
  ReviewErrorSummary,
  ReviewOutcome,
  ReviewSection,
  ValidationSummary,
  type ReviewReadiness,
  type ValidationCheck
} from "../redesign/consequential/ConsequentialReview";
import { RelationshipTrail } from "../redesign/relationship/RelationshipDetail";

type Row = Record<string, unknown> & { id: string; version?: number };
type OrderLine = {
  productId: string; description: string; quantity: string; unitWholesalePrice: string;
  grossAmount: string; discountAmount: string; returnAmount: string;
  cancellationAmount: string; commissionEligible: boolean;
};

function shown(value: unknown, fallback = "—"): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return fallback;
}

function dateShown(value: unknown): string {
  if (!value) return "—";
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? shown(value) : parsed.toLocaleDateString();
}

function currency(value: unknown, code: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency", currency: shown(code, "USD")
    }).format(Number(value));
  } catch {
    return `${shown(value)} ${shown(code)}`;
  }
}

function ids(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

import { CommercialSubnav } from "../redesign/commerce/CommercialSubnav";

function Shell({ children }: { children: ReactNode }) {
  return <div className="page ry-commerce-page"><CommercialSubnav />{children}</div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <EmptyState compact description={children} />;
}

function SaveView({
  recordType, status
}: {
  recordType: string; status: string;
}) {
  const [name, setName] = useState("");
  const [result, setResult] = useState("");
  async function save() {
    if (!name.trim()) return;
    try {
      await api("/api/saved-views", {
        method: "POST",
        body: {
          recordType, name, scope: "private",
          definition: {
            filters: status ? [{ field: "status", operator: "equals", value: status }] : [],
            sort: [{ field: "updatedAt", direction: "desc" }],
            layout: "table"
          }
        }
      });
      setResult("Saved");
    } catch (caught) {
      setResult(caught instanceof Error ? caught.message : "View could not be saved.");
    }
  }
  return <SavedViewSelector
    newName={name}
    onNameChange={setName}
    onSave={() => void save()}
    status={result}
  />;
}

export function AccountsPage() {
  const [status, setStatus] = useState("");
  const { data, loading, error } = useLoad(
    () => api<{ accounts: Row[] }>(`/api/accounts${status ? `?status=${encodeURIComponent(status)}` : ""}`),
    [status]
  );
  const accounts = data?.accounts ?? [];
  return <Shell>
    <PageHeader eyebrow="Commercial continuity" title="Protected Accounts and operational Accounts" description="Manage real Brand–Business relationships after verified opening Orders. Account records preserve history; they do not create contractual rights." action={<a className="secondary-button" href="/api/commercial-export/account">Export CSV</a>} />
    <section className="panel filter-panel">
      <Field label="Account status"><select value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="">All statuses</option><option value="onboarding">Onboarding</option>
        <option value="active">Active</option><option value="at_risk">At risk</option>
        <option value="paused">Paused</option><option value="ended">Ended</option>
      </select></Field>
      <SaveView recordType="account" status={status} />
    </section>
    {error ? <ErrorPanel message={error} /> : loading ? <Loading label="Loading Accounts" /> :
      accounts.length === 0 ? <Empty>No Accounts yet. Confirm a documented opening Order to create the first operational Account.</Empty> :
      <section className="panel"><div className="table-wrap"><table>
        <thead><tr><th>Relationship</th><th>Status</th><th>Health</th><th>Protection</th><th>Last Order</th><th /></tr></thead>
        <tbody>{accounts.map((item) => <tr key={item.id}>
          <td><strong>{shown(item.brandName)}</strong><small>{shown(item.businessName)}</small></td>
          <td><StatusPill value={shown(item.status)} /></td>
          <td><StatusPill value={shown(item.health)} /><small>{shown(item.healthRationale)}</small></td>
          <td><StatusPill value={shown(item.protectionStatus, "unverified")} /><small>{item.protectionEndsOn ? `Ends ${dateShown(item.protectionEndsOn)}` : "No asserted protection"}</small></td>
          <td>{shown(item.lastOrderNumber)}<small>{dateShown(item.lastOrderDate)}</small></td>
          <td><Link to={`/accounts/${item.id}`}>Review</Link></td>
        </tr>)}</tbody>
      </table></div></section>}
  </Shell>;
}

export function AccountDetailPage() {
  const { id = "" } = useParams();
  const { data, loading, error, reload } = useLoad(() => api<Record<string, unknown>>(`/api/accounts/${id}`), [id]);
  const account = data?.account as Row | undefined;
  const [status, setStatus] = useState("active");
  const [health, setHealth] = useState("healthy");
  const [rationale, setRationale] = useState("");
  const [endedReason, setEndedReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); if (!account) return;
    setSaving(true); setActionError("");
    try {
      await api(`/api/accounts/${id}`, {
        method: "PATCH",
        body: { version: account.version, status, health, healthRationale: rationale,
          endedReason: status === "ended" ? endedReason : null }
      });
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Account could not be updated.");
    } finally { setSaving(false); }
  }
  if (loading) return <Shell><Loading label="Loading Account relationship" /></Shell>;
  if (error || !account) return <Shell><ErrorPanel message={error || "Account not found."} /></Shell>;
  const protections = (data?.protections ?? []) as Row[];
  const orders = (data?.orders ?? []) as Row[];
  const reorders = (data?.reorders ?? []) as Row[];
  const commissions = (data?.commissions ?? []) as Row[];
  const events = (data?.events ?? []) as Row[];
  return <Shell>
    <PageHeader eyebrow="Account detail" title={`${shown(account.brandName)} → ${shown(account.businessName)}`} description="Commercial history remains visible after protection or the Brand relationship ends. Health is a human judgment with rationale." action={<StatusPill value={shown(account.status)} />} />
    {actionError ? <ErrorPanel message={actionError} /> : null}
    <section className="metric-row">
      <article className="metric"><span>Health</span><StatusPill value={shown(account.health)} /><small>{shown(account.health_rationale)}</small></article>
      <article className="metric"><span>Protection</span><strong>{protections.length ? shown(protections[0]?.status) : "Not asserted"}</strong><Link to="/protected-accounts">Review rights</Link></article>
      <article className="metric"><span>Actual Orders</span><strong>{orders.filter((item) => item.verificationStatus === "verified").length}</strong><Link to="/orders">Order history</Link></article>
    </section>
    <div className="split-grid">
      <section className="panel"><h2>Relationship and account health</h2>
        <form className="form-grid" onSubmit={(event) => void save(event)}>
          <Field label="Status"><select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="onboarding">Onboarding</option><option value="active">Active</option>
            <option value="at_risk">At risk</option><option value="paused">Paused</option><option value="ended">Ended</option>
          </select></Field>
          <Field label="Health"><select value={health} onChange={(event) => setHealth(event.target.value)}>
            <option value="unknown">Unknown</option><option value="healthy">Healthy</option>
            <option value="watch">Watch</option><option value="at_risk">At risk</option><option value="inactive">Inactive</option>
          </select></Field>
          <Field label="Factual health rationale"><textarea required value={rationale} onChange={(event) => setRationale(event.target.value)} /></Field>
          {status === "ended" ? <Field label="End reason"><textarea required value={endedReason} onChange={(event) => setEndedReason(event.target.value)} /></Field> : null}
          <div className="form-actions"><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Confirm human account review"}</button></div>
        </form>
      </section>
      <section className="panel"><h2>Reorder and commission continuity</h2>
        <p><strong>{reorders.length}</strong> reorder review{reorders.length === 1 ? "" : "s"} · <strong>{commissions.length}</strong> commission record{commissions.length === 1 ? "" : "s"}</p>
        <p className="muted">Projected reorders and Estimated Commissions are not guaranteed revenue. Account closure never silently cancels earned compensation.</p>
        <div className="button-row"><Link className="secondary-button" to="/reorders">Review reorders</Link><Link className="secondary-button" to="/commissions">Reconcile commissions</Link></div>
      </section>
    </div>
    <section className="panel"><h2>Linked timeline</h2>{events.length === 0 ? <p className="empty">No commercial events.</p> :
      <div className="record-list">{events.map((item, index) => <div className="task-row" key={`${shown(item.eventType)}-${index}`}>
        <span><strong>{shown(item.eventType)}</strong><small>{shown(item.reason)} · {dateShown(item.occurredAt)}</small></span>
      </div>)}</div>}</section>
  </Shell>;
}

export function ProtectedAccountsPage() {
  const [status, setStatus] = useState("");
  const [accountId, setAccountId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [productIds, setProductIds] = useState("");
  const [scope, setScope] = useState("");
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0,10));
  const [endsOn, setEndsOn] = useState("");
  const [commissionRights, setCommissionRights] = useState("");
  const [reorderRights, setReorderRights] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const { data, loading, error } = useLoad(
    async () => {
      const [protection, accounts, documents] = await Promise.all([
        api<{ protectedAccounts: Row[] }>(`/api/protected-accounts${status ? `?status=${encodeURIComponent(status)}` : ""}`),
        api<{ accounts: Row[] }>("/api/accounts"),
        api<{ documents: Row[] }>("/api/documents")
      ]);
      return { ...protection, accounts: accounts.accounts, documents: documents.documents };
    },
    [status]
  );
  const records = data?.protectedAccounts ?? [];
  async function create(event: FormEvent) {
    event.preventDefault(); setSaving(true); setFormError("");
    try {
      await api("/api/protected-accounts", {
        method: "POST", body: {
          accountId, basisDocumentId: documentId,
          originDate: new Date().toISOString().slice(0,10), scopeSummary: scope,
          productIds: ids(productIds), channels: ["independent_retail"],
          territoryScope: {}, protectionStartsOn: startsOn, protectionEndsOn: endsOn,
          protectionTerm: `${startsOn} through ${endsOn} as documented`,
          commissionRights, reorderRights, houseAccountExclusions: "",
          releaseTerms: "Release requires documented human action."
        }
      });
      window.location.reload();
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : "Protection review could not be created."); }
    finally { setSaving(false); }
  }
  return <Shell>
    <PageHeader eyebrow="Document-derived rights" title="Protected Accounts" description="Ryva records scoped rights from approved documents. It does not create contractual protection, reorder rights, or commission rights." />
    <section className="panel filter-panel"><Field label="Protection status"><select value={status} onChange={(event) => setStatus(event.target.value)}>
      <option value="">All statuses</option>{["pending","active","expiring","expired","disputed","released","ended"].map((item) => <option key={item} value={item}>{item.replaceAll("_"," ")}</option>)}
    </select></Field><SaveView recordType="protected_account" status={status} /></section>
    <section className="panel"><h2>Register a documented account-rights basis</h2>
      <p>This creates a pending review only. It cannot activate rights without overlap checks and exact human approval.</p>
      {formError ? <ErrorPanel message={formError} /> : null}
      <form className="form-grid" onSubmit={(event) => void create(event)}>
        <Field label="Operational Account"><select required value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Select Account</option>{(data?.accounts ?? []).map((item) => <option value={item.id} key={item.id}>{shown(item.brandName)} → {shown(item.businessName)}</option>)}</select></Field>
        <Field label="Clean rights document"><select required value={documentId} onChange={(event) => setDocumentId(event.target.value)}><option value="">Select document</option>{(data?.documents ?? []).filter((item) => item.status === "active" && item.scanStatus === "clean").map((item) => <option value={item.id} key={item.id}>{shown(item.name)}</option>)}</select></Field>
        <Field label="Scoped Product IDs" hint="Comma-separated Products already covered by the Agreement."><input required value={productIds} onChange={(event) => setProductIds(event.target.value)} /></Field>
        <Field label="Exact scope summary"><textarea required value={scope} onChange={(event) => setScope(event.target.value)} /></Field>
        <Field label="Protection starts"><input required type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></Field>
        <Field label="Protection ends"><input required type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /></Field>
        <Field label="Documented commission rights"><textarea required value={commissionRights} onChange={(event) => setCommissionRights(event.target.value)} /></Field>
        <Field label="Documented reorder rights"><textarea required value={reorderRights} onChange={(event) => setReorderRights(event.target.value)} /></Field>
        <div className="form-actions"><button className="primary-button" disabled={saving}>{saving ? "Creating review…" : "Create pending rights review"}</button></div>
      </form>
    </section>
    {error ? <ErrorPanel message={error} /> : loading ? <Loading label="Loading documented rights" /> :
      records.length === 0 ? <Empty>No protection records. A verified opening Order may create a review-required basis only when the Agreement contains supporting terms.</Empty> :
      <section className="panel"><div className="table-wrap"><table><thead><tr><th>Account</th><th>Scope</th><th>Term</th><th>Basis</th><th>Status</th><th /></tr></thead>
        <tbody>{records.map((item) => <tr key={item.id}>
          <td><strong>{shown(item.brandName)}</strong><small>{shown(item.businessName)}</small></td>
          <td>{shown(item.scopeSummary)}<small>{Array.isArray(item.channels) ? item.channels.join(", ") : "No channel scope"}</small></td>
          <td>{dateShown(item.protectionStartsOn)} – {dateShown(item.protectionEndsOn)}</td>
          <td><StatusPill value={shown(item.supportingBasisStatus)} /></td>
          <td><StatusPill value={shown(item.status)} /></td>
          <td><Link to={`/protected-accounts/${item.id}`}>Review rights</Link></td>
        </tr>)}</tbody></table></div></section>}
  </Shell>;
}

export function ProtectedAccountDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const { data, loading, error, reload } = useLoad(
    () => api<Record<string, unknown>>(`/api/protected-accounts/${id}`), [id]
  );
  const protection = data?.protection as Row | undefined;
  const [approvalId, setApprovalId] = useState("");
  const [condition, setCondition] = useState("Approved only as the reviewed document states; Ryva creates no independent rights.");
  const [decision, setDecision] = useState<"approved" | "rejected" | "changes_required" | "">("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const submissionGuard = useRef(false);

  useEffect(() => {
    if (actionError) document.querySelector<HTMLElement>("[data-review-error]")?.focus();
  }, [actionError]);

  async function requestApproval() {
    if (!canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true); setActionError("");
    setConflict(false);
    try {
      const result = await api<{ approval: Row }>(`/api/protected-accounts/${id}/approval`, { method: "POST" });
      setApprovalId(result.approval.id); await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Approval could not be requested.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
    } finally { setSaving(false); submissionGuard.current = false; }
  }
  async function decide() {
    if (!approvalId || !decision || !canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true); setActionError("");
    setConflict(false);
    try {
      await api(`/api/protected-accounts/${id}/approval/${approvalId}`, {
        method: "POST", body: { decision, conditions: condition }
      });
      setConfirmationOpen(false);
      setApprovalId("");
      setDecision("");
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Protection decision could not be recorded.");
      setConflict(caught instanceof ApiProblem && caught.status === 409);
      setConfirmationOpen(false);
    } finally { setSaving(false); submissionGuard.current = false; }
  }
  const loadingTrail = <RelationshipTrail items={[{ label: "Protected Accounts", to: "/protected-accounts" }, { label: loading ? "Loading protection review" : "Protection unavailable" }]} />;
  if (loading) return <div className="page ry-consequential-page">{loadingTrail}<IdentityHeader eyebrow="Consequential review · documentary protection" title="Loading protection review" status={<StatusLabel value="loading" />} /><LoadingState label="Loading exact documentary scope and approval context" /></div>;
  if (error || !protection) return <div className="page ry-consequential-page">{loadingTrail}<IdentityHeader eyebrow="Consequential review · documentary protection" title="Protection unavailable" /><ErrorState message={error || "Protection record not found."} action={<Button variant="secondary" onClick={() => void reload()}>Try again</Button>} /></div>;
  const events = (data?.events ?? []) as Row[];
  const documents = (data?.documents ?? []) as Row[];
  const conflicts = (data?.conflicts ?? []) as Row[];
  const status = shown(protection.status);
  const pending = status === "pending";
  const active = status === "active" || status === "expiring";
  const ended = ["expired","released","ended"].includes(status);
  const documentedBasis = shown(protection.supporting_basis_status) === "documented";
  const documentReady = shown(protection.basisDocumentStatus) === "active" && shown(protection.basisDocumentScanStatus) === "clean";
  const conflictItems = conflicts.filter((item) => ["possible","blocking"].includes(shown(item.status)));
  const exactDigest = shown(protection.rights_digest, "Digest unavailable");
  const readinessState: ReviewReadiness = conflict ? "stale" : !canWrite ? "restricted" : active ? "completed" : pending && documentedBasis && documentReady && conflictItems.length === 0 ? (approvalId ? "ready" : "requires_review") : "blocked";
  const blockers = [
    ...(!canWrite ? [session?.access.reason ?? "This session cannot record a protection decision."] : []),
    ...(!documentedBasis ? ["The supporting basis is not classified as documented."] : []),
    ...(!documentReady ? ["The basis document is not both active and clean."] : []),
    ...(conflictItems.length ? [`${conflictItems.length} unresolved conflict signal(s) require resolution before activation.`] : []),
    ...(!pending && !active ? [`Status ${status.replaceAll("_", " ")} is not eligible for initial approval.`] : []),
    ...(conflict ? ["The approval reference or exact artifact is no longer current. Reload and prepare a fresh review."] : [])
  ];
  const validationChecks: ValidationCheck[] = [
    { id: "basis", label: "Documentary basis", detail: documentedBasis ? "The stored basis classification is documented." : `Stored basis status is ${shown(protection.supporting_basis_status)}.`, state: documentedBasis ? "passed" : "failed" },
    { id: "document", label: "Immutable source availability", detail: documentReady ? `${shown(protection.basisDocumentName)} is active and clean.` : "A clean, active basis document is required.", state: documentReady ? "passed" : "failed" },
    { id: "scope", label: "Exact proposed scope", detail: `Version ${shown(protection.version)} and rights digest ${exactDigest} identify the proposed artifact.`, state: exactDigest === "Digest unavailable" ? "failed" : "passed" },
    { id: "conflicts", label: "Conflict review", detail: conflictItems.length ? `${conflictItems.length} possible or blocking conflict(s) remain.` : "No possible or blocking Placement conflict is returned with this review.", state: conflictItems.length ? "failed" : "passed" },
    { id: "agreement", label: "Agreement authority", detail: "An Agreement reference is stored, but this page response does not independently establish current representation authority.", state: "requires_review" },
    { id: "human", label: "Human confirmation", detail: protection.human_confirmed ? `Confirmed ${dateShown(protection.approval_date)}.` : "No active human confirmation is recorded.", state: protection.human_confirmed ? "passed" : "requires_review" }
  ];
  const auditEntries = events.map((item, index) => ({
    id: `${shown(item.eventType)}-${shown(item.occurredAt)}-${index}`,
    action: shown(item.eventType).replaceAll("_", " ").replaceAll(".", " · "),
    actor: shown(item.origin, "Ryva commercial record"),
    outcome: <StatusLabel value={shown(item.eventType).split(".").at(-1) ?? "recorded"} />,
    timestamp: item.occurredAt ? new Date(shown(item.occurredAt)).toLocaleString() : "Time not recorded",
    detail: shown(item.reason, "No rationale recorded")
  }));
  const proposedScope = <dl className="ry-review-facts">
    <div><dt>Account relationship</dt><dd><Link to={`/accounts/${shown(protection.account_id)}`}>{shown(protection.brandName)} → {shown(protection.businessName)}</Link></dd></div>
    <div><dt>Basis document</dt><dd><button type="button" className="text-button" onClick={() => setDocumentOpen(true)}>{shown(protection.basisDocumentName)}</button></dd></div>
    <div><dt>Scope summary</dt><dd>{shown(protection.scope_summary)}</dd></div>
    <div><dt>Products</dt><dd>{Array.isArray(protection.product_ids) ? protection.product_ids.join(", ") : "No Product scope recorded"}</dd></div>
    <div><dt>Channels</dt><dd>{Array.isArray(protection.channels) ? protection.channels.join(", ") : "No channel scope recorded"}</dd></div>
    <div><dt>Territory</dt><dd><code>{JSON.stringify(protection.territory_scope ?? {})}</code></dd></div>
    <div><dt>Term</dt><dd>{dateShown(protection.protection_starts_on)} – {dateShown(protection.protection_ends_on)} · {shown(protection.protection_term)}</dd></div>
    <div><dt>Commission rights</dt><dd>{shown(protection.commission_rights)}</dd></div>
    <div><dt>Reorder rights</dt><dd>{shown(protection.reorder_rights)}</dd></div>
    <div><dt>House-account exclusions</dt><dd>{shown(protection.house_account_exclusions, "None documented")}</dd></div>
    <div><dt>Release terms</dt><dd>{shown(protection.release_terms, "None documented")}</dd></div>
    <div><dt>Conflict notes</dt><dd>{shown(protection.conflict_notes, "No conflict notes recorded")}</dd></div>
  </dl>;
  const decisionLabel = decision === "approved" ? "Activate exactly documented protection" : decision === "rejected" ? "Reject this protection proposal" : "Require changes before a new decision";

  return <div className="page ry-consequential-page">
    <RelationshipTrail items={[{ label: "Protected Accounts", to: "/protected-accounts" }, { label: `${shown(protection.brandName)} → ${shown(protection.businessName)}` }]} />
    <IdentityHeader
      eyebrow="Consequential review · documentary protection"
      title={`${shown(protection.brandName)} → ${shown(protection.businessName)}`}
      relationship={<span className="ry-relationship-identity-meta"><Link to={`/accounts/${shown(protection.account_id)}`}>Account</Link><Link to={`/agreements/${shown(protection.agreement_id)}`}>Governing Agreement reference</Link><span>Version {shown(protection.version)}</span></span>}
      status={<StatusLabel value={status} />}
      warning={ended ? <Alert tone="warning" title="Rights are not current">History and previously earned rights remain visible. Renewal requires new evidence and approval through the later commercial workflow.</Alert> : !documentReady ? <Alert tone="danger" title="Supporting document unavailable">Activation is blocked until a clean, active basis document is linked.</Alert> : undefined}
      nextAction={<span>{active ? "Inspect the exact activated scope and audited human outcome." : !canWrite ? "Inspect the permitted documentary record in read-only mode." : approvalId ? "Choose a human decision for the exact prepared scope." : "Resolve blockers, then prepare this exact scope for human decision."}</span>}
      actions={<Button variant="secondary" onClick={() => void navigate("/protected-accounts")}>All protection reviews</Button>}
    />
    {actionError ? <ReviewErrorSummary message={actionError} conflict={conflict} onReload={() => { void reload(); setApprovalId(""); setConflict(false); setActionError(""); }} /> : null}
    {!canWrite ? <Alert tone="warning" title="Read-only consequential review">Documentary scope and permitted history remain inspectable, but this session cannot request or record protection approval.</Alert> : null}
    <ConsequentialReviewLayout readiness={<>
      <ReadinessSummary state={readinessState} description={active ? "A named human approved the exact documentary artifact recorded below." : "A proposal creates no protection. The server must validate the current artifact before a human decision can activate it."} blockers={blockers} context={<dl className="ry-review-facts"><div><dt>Proposal status</dt><dd>{status}</dd></div><div><dt>Approval reference</dt><dd>{approvalId || shown(protection.approval_id, "Not prepared in this session")}</dd></div><div><dt>Artifact digest</dt><dd>{exactDigest}</dd></div><div><dt>Protection expiry</dt><dd>{dateShown(protection.protection_ends_on)}</dd></div></dl>} />
      <AuthorityIndicator value="requires_review" rationale="The Agreement reference and relationship do not independently establish current authority on this page." />
    </>}>
      {active ? <ReviewOutcome title="Documentary protection activated" status={status} consequence={`Only the exact scope identified by digest ${exactDigest} is recorded as active. Ryva created no independent contractual right.`}><p>Human confirmation: {protection.human_confirmed ? `recorded ${dateShown(protection.approval_date)}` : "not recorded"}</p></ReviewOutcome> : null}
      <ExactArtifact title="Proposed documentary protection scope" description="This exact stored scope—not the relationship label or a summary—is the artifact submitted to the existing server-side approval process." version={`${shown(protection.version)} · digest ${exactDigest}`}>{proposedScope}</ExactArtifact>
      <ValidationSummary checks={validationChecks} description="Displayed checks summarize stored facts. The existing server revalidates the document, overlap, current approval, and artifact digest at submission." />
      <ReviewSection eyebrow="Authority and consequence" title="What this decision can establish" description="Protection, representation authority, and Agreement authority remain separate records and decisions.">
        <ul className="ry-review-list"><li><strong>Proposal</strong><span>Pending scope is a review record only and creates no rights.</span></li><li><strong>Protected Account decision</strong><span>Approval may activate only the exact documentary scope after server validation.</span></li><li><strong>Representation and Agreement authority</strong><span>References remain inspectable, but their current authority is not inferred here.</span></li><li><strong>Downstream use</strong><span>Outreach and commission workflows must continue to use their own validators.</span></li></ul>
      </ReviewSection>
      {pending && !approvalId ? <ApprovalPanel title="Prepare exact scope for human decision" readiness={<p>{documentedBasis && documentReady && conflictItems.length === 0 ? "The displayed artifact can be submitted to the existing server validator." : "Resolve every failed validation before requesting approval."}</p>} consequence={<p>This creates a requested Human Approval tied to the current exact artifact digest. It does not activate protection.</p>} actions={<Button loading={saving} disabled={!canWrite || !documentedBasis || !documentReady || conflictItems.length > 0} onClick={() => void requestApproval()}>Request exact-scope approval</Button>} processing={saving} /> : null}
      {pending && approvalId ? <ApprovalPanel
        title="Record the human protection decision"
        readiness={<p>The server prepared approval {approvalId} for the exact current artifact. It will revalidate the digest and conflicts before recording the decision.</p>}
        consequence={<p>Approval activates only the displayed documentary scope. Rejection or required changes leave the proposal pending and create no protection.</p>}
        rationale={<><fieldset className="ry-consequence-radio-group"><legend>Human decision</legend><Radio name="protection-decision" value="approved" checked={decision === "approved"} onChange={() => setDecision("approved")} label="Approve exact scope" description="Activate only the prepared documentary artifact." disabled={saving} /><Radio name="protection-decision" value="changes_required" checked={decision === "changes_required"} onChange={() => setDecision("changes_required")} label="Require changes" description="Keep protection pending and require a new reviewed artifact." disabled={saving} /><Radio name="protection-decision" value="rejected" checked={decision === "rejected"} onChange={() => setDecision("rejected")} label="Reject proposal" description="Record rejection; no protection becomes active." disabled={saving} /></fieldset><Field label="Decision rationale or conditions" required><TextArea required rows={5} value={condition} onChange={(event) => setCondition(event.target.value)} disabled={saving} /></Field></>}
        actions={<Button disabled={!decision || !condition.trim()} onClick={() => setConfirmationOpen(true)}>Review final consequence</Button>}
        processing={saving}
      /> : null}
      <ReviewSection eyebrow="Immutable commercial history" title="Protection events">
        <AuditHistory entries={auditEntries} empty="No protection event has been recorded." label={`${shown(protection.brandName)} and ${shown(protection.businessName)} protection history`} />
      </ReviewSection>
    </ConsequentialReviewLayout>
    <ConfirmationDialog open={confirmationOpen} title="Confirm documentary protection decision" description={`You are deciding approval ${approvalId} against artifact digest ${exactDigest}.`} consequence={<><strong>{decisionLabel}</strong><p>{decision === "approved" ? "The server may activate only the exact displayed scope after revalidation." : "The proposal remains pending and no protection becomes active."}</p><p>Rationale or conditions: {condition}</p></>} confirmLabel={decision === "approved" ? "Confirm exact-scope approval" : decision === "rejected" ? "Confirm rejection" : "Require changes"} confirmVariant={decision === "approved" ? "primary" : "destructive"} processing={saving} onClose={() => setConfirmationOpen(false)} onConfirm={() => void decide()} />
    <Drawer open={documentOpen} title={shown(protection.basisDocumentName)} description="Stored basis-document metadata. The immutable original remains governed by the existing Documents workflow." onClose={() => setDocumentOpen(false)} size="standard">
      <dl className="ry-review-facts"><div><dt>Document status</dt><dd><StatusLabel value={shown(protection.basisDocumentStatus)} /></dd></div><div><dt>Scan status</dt><dd><StatusLabel value={shown(protection.basisDocumentScanStatus)} /></dd></div><div><dt>Supporting-basis status</dt><dd><StatusLabel value={shown(protection.supporting_basis_status)} /></dd></div><div><dt>Basis document ID</dt><dd>{shown(protection.basis_document_id)}</dd></div></dl>
      {documents.length ? <ReviewSection title="Linked documentary records"> <ul className="ry-review-list">{documents.map((document) => <li key={document.id}><strong>{shown(document.name)}</strong><span>{shown(document.purpose)} · {shown(document.status)} · {shown(document.scanStatus)}</span></li>)}</ul></ReviewSection> : null}
      <Link className="secondary-button" to="/documents">Open Documents register</Link>
    </Drawer>
  </div>;
}

function blankLine(): OrderLine {
  return { productId: "", description: "", quantity: "1", unitWholesalePrice: "0.00",
    grossAmount: "0.00", discountAmount: "0.00", returnAmount: "0.00",
    cancellationAmount: "0.00", commissionEligible: true };
}

export function OrdersPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const { data, loading, error, reload } = useLoad(async () => {
    const [orders, placements, documents] = await Promise.all([
      api<{ orders: Row[] }>(`/api/orders${status ? `?status=${encodeURIComponent(status)}` : ""}`),
      api<{ placements: Row[] }>("/api/placements"),
      api<{ documents: Row[] }>("/api/documents")
    ]);
    return { ...orders, placements: placements.placements, documents: documents.documents };
  }, [status]);
  const [placementId, setPlacementId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [documentId, setDocumentId] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const orders = data?.orders ?? [];
  const placements = data?.placements ?? [];
  const documents = data?.documents ?? [];
  function setLine(index: number, field: keyof OrderLine, value: string | boolean) {
    setLines((current) => current.map((line, position) => position === index ? { ...line, [field]: value } : line));
  }
  async function create(event: FormEvent) {
    event.preventDefault(); setSaving(true); setFormError("");
    try {
      const result = await api<{ order: Row }>("/api/orders", {
        method: "POST",
        body: {
          placementId, orderNumber, externalReference: externalReference || null,
          idempotencyKey: `ui:${placementId}:${externalReference || orderNumber}`,
          orderType: "opening_order", orderDate, currency: currencyCode,
          sourceType: "document", sourceDocumentId: documentId,
          sourceReference: externalReference, paymentStatus: "unknown",
          fulfillmentStatus: "unknown", lines
        }
      });
      await reload(); void navigate(`/orders/${result.order.id}`);
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : "Order could not be recorded."); }
    finally { setSaving(false); }
  }
  return <Shell>
    <PageHeader eyebrow="Verified commercial records" title="Orders" description="Only documented, human-verified Orders create Accounts and estimated Commissions. Drafts and projections are excluded from actual totals." action={<a className="secondary-button" href="/api/commercial-export/order">Export CSV</a>} />
    <section className="panel filter-panel"><Field label="Order status"><select value={status} onChange={(event) => setStatus(event.target.value)}>
      <option value="">All statuses</option>{["draft","submitted","confirmed","fulfilled","partially_returned","returned","canceled"].map((item) => <option key={item} value={item}>{item.replaceAll("_"," ")}</option>)}
    </select></Field><SaveView recordType="order" status={status} /></section>
    {error ? <ErrorPanel message={error} /> : loading ? <Loading label="Loading Orders and source records" /> : <>
      <section className="panel"><h2>Record an opening Order</h2>
        {formError ? <ErrorPanel message={formError} /> : null}
        <form onSubmit={(event) => void create(event)}>
          <div className="form-grid">
            <Field label="Order-discussion Placement"><select required value={placementId} onChange={(event) => setPlacementId(event.target.value)}>
              <option value="">Select Placement</option>{placements.filter((item) => ["terms_order_discussion","opening_order"].includes(shown(item.stage))).map((item) => <option value={item.id} key={item.id}>{shown(item.brandName)} → {shown(item.businessName)}</option>)}
            </select></Field>
            <Field label="Order number"><input required value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} /></Field>
            <Field label="External reference"><input value={externalReference} onChange={(event) => setExternalReference(event.target.value)} /></Field>
            <Field label="Order date"><input type="date" required value={orderDate} onChange={(event) => setOrderDate(event.target.value)} /></Field>
            <Field label="Currency"><input required pattern="[A-Z]{3}" value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())} /></Field>
            <Field label="Clean source document"><select required value={documentId} onChange={(event) => setDocumentId(event.target.value)}>
              <option value="">Select verified source</option>{documents.filter((item) => item.status === "active" && item.scanStatus === "clean").map((item) => <option value={item.id} key={item.id}>{shown(item.name)}</option>)}
            </select></Field>
          </div>
          <h3>Line items</h3>
          {lines.map((line, index) => <fieldset className="line-item-grid" key={index}>
            <legend>Line {index + 1}</legend>
            <Field label="Product ID"><input required value={line.productId} onChange={(event) => setLine(index, "productId", event.target.value)} /></Field>
            <Field label="Description"><input required value={line.description} onChange={(event) => setLine(index, "description", event.target.value)} /></Field>
            <Field label="Quantity"><input required inputMode="decimal" value={line.quantity} onChange={(event) => setLine(index, "quantity", event.target.value)} /></Field>
            <Field label="Unit wholesale"><input required inputMode="decimal" value={line.unitWholesalePrice} onChange={(event) => setLine(index, "unitWholesalePrice", event.target.value)} /></Field>
            <Field label="Gross"><input required inputMode="decimal" value={line.grossAmount} onChange={(event) => setLine(index, "grossAmount", event.target.value)} /></Field>
            <Field label="Discount"><input inputMode="decimal" value={line.discountAmount} onChange={(event) => setLine(index, "discountAmount", event.target.value)} /></Field>
            <Field label="Return"><input inputMode="decimal" value={line.returnAmount} onChange={(event) => setLine(index, "returnAmount", event.target.value)} /></Field>
            <Field label="Cancellation"><input inputMode="decimal" value={line.cancellationAmount} onChange={(event) => setLine(index, "cancellationAmount", event.target.value)} /></Field>
            <label className="check-row"><input type="checkbox" checked={line.commissionEligible} onChange={(event) => setLine(index, "commissionEligible", event.target.checked)} />Documented as commission eligible</label>
            {lines.length > 1 ? <button type="button" className="text-button" onClick={() => setLines((current) => current.filter((_, position) => position !== index))}>Remove line</button> : null}
          </fieldset>)}
          <div className="button-row"><button type="button" className="secondary-button" onClick={() => setLines((current) => [...current, blankLine()])}>Add line</button><button className="primary-button" disabled={saving}>{saving ? "Recording…" : "Save review-required Order"}</button></div>
        </form>
      </section>
      {orders.length === 0 ? <Empty>No Orders yet. Record a real source-backed opening Order above.</Empty> :
        <section className="panel"><h2>Order reconciliation</h2><div className="table-wrap"><table><thead><tr><th>Order</th><th>Relationship</th><th>Gross</th><th>Net commissionable</th><th>Verification</th><th>Payment</th><th /></tr></thead>
          <tbody>{orders.map((item) => <tr key={item.id}>
            <td><strong>{shown(item.orderNumber)}</strong><small>{dateShown(item.orderDate)} · {shown(item.orderType).replaceAll("_"," ")}</small></td>
            <td>{shown(item.brandName)}<small>{shown(item.businessName)}</small></td>
            <td>{currency(item.wholesaleGross,item.currency)}</td><td>{currency(item.netCommissionable,item.currency)}</td>
            <td><StatusPill value={shown(item.verificationStatus)} /></td><td><StatusPill value={shown(item.paymentStatus)} /></td>
            <td><Link to={`/orders/${item.id}`}>Reconcile</Link></td>
          </tr>)}</tbody></table></div></section>}
    </>}
  </Shell>;
}

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const { data, loading, error, reload } = useLoad(
    () => api<Record<string, unknown>>(`/api/orders/${id}`), [id]
  );
  const order = data?.order as Row | undefined;
  const [notes, setNotes] = useState("I compared the Order identity, Products, quantities, values, adjustments, payment/fulfillment state, and immutable source.");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  async function confirm() {
    if (!order) return; setSaving(true); setActionError("");
    try {
      await api(`/api/orders/${id}/confirm`, {
        method: "POST", body: { version: order.version, verificationNotes: notes }
      });
      await reload();
    } catch (caught) { setActionError(caught instanceof Error ? caught.message : "Order could not be verified."); }
    finally { setSaving(false); }
  }
  if (loading) return <Shell><Loading label="Loading Order evidence and calculation" /></Shell>;
  if (error || !order) return <Shell><ErrorPanel message={error || "Order not found."} /></Shell>;
  const lines = (data?.lines ?? []) as Row[];
  const revisions = (data?.revisions ?? []) as Row[];
  const commissions = (data?.commissions ?? []) as Row[];
  const events = (data?.events ?? []) as Row[];
  return <Shell>
    <PageHeader eyebrow="Order detail" title={shown(order.orderNumber)} description="Order status, payment status, fulfillment, and verification are separate. Corrections preserve the original revision." action={<StatusPill value={shown(order.verificationStatus)} />} />
    {actionError ? <ErrorPanel message={actionError} /> : null}
    <section className="metric-row">
      <article className="metric"><span>Gross wholesale</span><strong>{currency(order.wholesaleGross,order.currency)}</strong></article>
      <article className="metric"><span>Adjustments</span><strong>{currency(Number(shown(order.discounts,"0"))+Number(shown(order.returns,"0"))+Number(shown(order.cancellations,"0")),order.currency)}</strong><small>Discounts + returns + cancellations</small></article>
      <article className="metric"><span>Net commissionable</span><strong>{currency(order.netCommissionable,order.currency)}</strong><small>System calculation, not a payment guarantee</small></article>
    </section>
    <div className="split-grid">
      <section className="panel"><h2>Explainable Order formula</h2>
        <p className="formula">{currency(order.wholesaleGross,order.currency)} gross − {currency(order.discounts,order.currency)} discounts − {currency(order.returns,order.currency)} returns − {currency(order.cancellations,order.currency)} cancellations = <strong>{currency(order.netCommissionable,order.currency)}</strong></p>
        <dl className="detail-list">
          <div><dt>Order / payment / fulfillment</dt><dd><StatusPill value={shown(order.status)} /> <StatusPill value={shown(order.paymentStatus)} /> <StatusPill value={shown(order.fulfillmentStatus)} /></dd></div>
          <div><dt>Source document</dt><dd className="monospace">{shown(order.sourceDocumentId)}</dd></div>
          <div><dt>Current immutable revision</dt><dd>{shown(order.currentRevision)}</dd></div>
        </dl>
      </section>
      <section className="panel"><h2>Human verification</h2>
        {shown(order.verificationStatus) === "verified" ? <><p><strong>Verified</strong> by a named human on {dateShown(order.verifiedAt)}.</p><Link className="secondary-button" to={`/accounts/${shown(order.accountId)}`}>Open Account</Link></> :
          <><Field label="Verification rationale"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
            <button className="primary-button" disabled={saving} onClick={() => void confirm()}>{saving ? "Confirming…" : "Confirm documented Order"}</button>
            <p className="muted">Confirmation atomically creates or links the Account, review-required protection basis, Estimated Commission, and Reorder review.</p></>}
      </section>
    </div>
    <section className="panel"><h2>Line items</h2><div className="table-wrap"><table>
      <thead><tr><th>Product</th><th>Quantity</th><th>Gross</th><th>Adjustments</th><th>Eligible net</th></tr></thead>
      <tbody>{lines.map((line) => <tr key={line.id}>
        <td>{shown(line.productName)}<small>{shown(line.description)}</small></td>
        <td>{shown(line.quantity)} × {currency(line.unitWholesalePrice,order.currency)}</td>
        <td>{currency(line.grossAmount,order.currency)}</td>
        <td>{currency(Number(shown(line.discountAmount,"0"))+Number(shown(line.returnAmount,"0"))+Number(shown(line.cancellationAmount,"0")),order.currency)}</td>
        <td>{line.commissionEligible ? currency(line.netCommissionable,order.currency) : "Not eligible"}</td>
      </tr>)}</tbody>
    </table></div></section>
    <div className="split-grid">
      <section className="panel"><h2>Revision history</h2>{revisions.map((revision) => <div className="task-row" key={shown(revision.revision)}>
        <span><strong>Revision {shown(revision.revision)}</strong><small>{shown(revision.reason)} · {dateShown(revision.changedAt)}</small></span>
      </div>)}</section>
      <section className="panel"><h2>Linked Commission</h2>{commissions.length ? commissions.map((item) => <div className="task-row" key={item.id}><span><strong>{currency(item.expectedAmount,item.currency)}</strong><small>{shown(item.calculationExplanation)}</small></span><Link to={`/commissions/${item.id}`}>Explain</Link></div>) : <p className="empty">Commission appears only after verification and a documented rule.</p>}</section>
    </div>
    <section className="panel"><h2>Audit-linked history</h2>{events.map((item, index) => <div className="task-row" key={`${shown(item.eventType)}-${index}`}><span><strong>{shown(item.eventType)}</strong><small>{shown(item.reason)} · {dateShown(item.occurredAt)}</small></span></div>)}</section>
  </Shell>;
}

export function ReordersPage() {
  const [status, setStatus] = useState("");
  const { data, loading, error, reload } = useLoad(
    () => api<{ reorders: Row[] }>(`/api/reorders${status ? `?status=${encodeURIComponent(status)}` : ""}`),
    [status]
  );
  const [editing, setEditing] = useState<Row | null>(null);
  const [health, setHealth] = useState("healthy");
  const [rationale, setRationale] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [outcome, setOutcome] = useState("due");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editing) return;
    setSaving(true); setActionError("");
    try {
      await api(`/api/reorders/${editing.id}`, {
        method: "PATCH", body: {
          version: editing.version, status: outcome,
          expectedWindowStartsOn: editing.expectedWindowStartsOn ?? null,
          expectedWindowEndsOn: editing.expectedWindowEndsOn ?? null,
          reminderAt: editing.reminderAt ?? null, accountHealth: health,
          healthRationale: rationale, nextAction, likelihoodLabel: null,
          likelihoodOrigin: null, estimateExplanation: "Human review; no guaranteed revenue.",
          recommendedFollowUp: nextAction, deferOrCloseReason: ["deferred","not_expected","closed"].includes(outcome) ? reason : null
        }
      });
      setEditing(null); await reload();
    } catch (caught) { setActionError(caught instanceof Error ? caught.message : "Reorder review could not be saved."); }
    finally { setSaving(false); }
  }
  const records = data?.reorders ?? [];
  return <Shell>
    <PageHeader eyebrow="Responsible commercial continuity" title="Reorders and account health" description="Reorder windows, averages, likelihood, and recommendations are labeled projections, not guaranteed revenue. Buyer need, service history, authority, permission, and protection require human review." action={<a className="secondary-button" href="/api/commercial-export/reorder">Export CSV</a>} />
    <section className="panel filter-panel"><Field label="Review status"><select value={status} onChange={(event) => setStatus(event.target.value)}>
      <option value="">All</option>{["projected","due","contacted","ordered","deferred","not_expected","closed"].map((item) => <option key={item} value={item}>{item.replaceAll("_"," ")}</option>)}
    </select></Field><SaveView recordType="reorder" status={status} /></section>
    {actionError ? <ErrorPanel message={actionError} /> : null}
    {error ? <ErrorPanel message={error} /> : loading ? <Loading label="Loading actual history before projections" /> :
      records.length === 0 ? <Empty>No eligible reorder reviews. Verify an opening Order first.</Empty> :
      <section className="card-grid">{records.map((item) => <article className="record-card" key={item.id}>
        <div className="record-heading"><div><p className="eyebrow">{shown(item.brandName)}</p><h2>{shown(item.businessName)}</h2></div><StatusPill value={shown(item.status)} /></div>
        <dl className="detail-list">
          <div><dt>Last actual Order</dt><dd>{shown(item.priorOrderNumber)} · {dateShown(item.lastOrderDate)}</dd></div>
          <div><dt>Verified average</dt><dd>{currency(item.averageOrderSize,item.currency)}</dd></div>
          <div><dt>Projected window</dt><dd>{dateShown(item.expectedWindowStartsOn)} – {dateShown(item.expectedWindowEndsOn)}</dd></div>
          <div><dt>Protection</dt><dd><StatusPill value={shown(item.protectionStatus,"unverified")} /></dd></div>
          <div><dt>Account health</dt><dd><StatusPill value={shown(item.accountHealth)} /> {shown(item.healthRationale)}</dd></div>
          <div><dt>Next action</dt><dd>{shown(item.nextAction)}</dd></div>
        </dl>
        <button className="secondary-button" onClick={() => { setEditing(item); setRationale(shown(item.healthRationale,"")); setNextAction(shown(item.nextAction,"")); setHealth(shown(item.accountHealth,"healthy")); }}>Review</button>
      </article>)}</section>}
    {editing ? <section className="panel"><h2>Human Reorder review</h2><form className="form-grid" onSubmit={(event) => void save(event)}>
      <Field label="Outcome"><select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
        <option value="due">Due for review</option><option value="contacted">Contacted through approved outreach</option><option value="deferred">Deferred</option><option value="not_expected">Not expected</option><option value="closed">Closed</option>
      </select></Field>
      <Field label="Account health"><select value={health} onChange={(event) => setHealth(event.target.value)}>
        {["unknown","healthy","watch","at_risk","inactive"].map((item) => <option key={item} value={item}>{item.replaceAll("_"," ")}</option>)}
      </select></Field>
      <Field label="Health rationale"><textarea required value={rationale} onChange={(event) => setRationale(event.target.value)} /></Field>
      <Field label="Required next action"><textarea required value={nextAction} onChange={(event) => setNextAction(event.target.value)} /></Field>
      {["deferred","not_expected","closed"].includes(outcome) ? <Field label="Retained outcome reason"><textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></Field> : null}
      <div className="form-actions"><button className="primary-button" disabled={saving}>Confirm human review</button><button className="text-button" type="button" onClick={() => setEditing(null)}>Cancel</button></div>
    </form></section> : null}
  </Shell>;
}

export function CommissionsPage() {
  const [status, setStatus] = useState("");
  const { data, loading, error } = useLoad(
    () => api<{ commissions: Row[] }>(`/api/commissions${status ? `?status=${encodeURIComponent(status)}` : ""}`),
    [status]
  );
  const records = useMemo(() => data?.commissions ?? [], [data]);
  const grouped = useMemo(() => {
    const result = new Map<string, { expected: number; approved: number; paid: number }>();
    for (const item of records) {
      const code = shown(item.currency, "Unknown");
      const group = result.get(code) ?? { expected: 0, approved: 0, paid: 0 };
      group.expected += Number(item.expectedAmount ?? 0);
      group.approved += Number(item.approvedAmount ?? 0);
      group.paid += Number(item.paidAmount ?? 0);
      result.set(code, group);
    }
    return [...result.entries()];
  }, [records]);
  return <Shell>
    <PageHeader eyebrow="Explainable compensation" title="Commissions" description="Expected, verified, approved, payable, and paid values remain distinct. Every amount links to an Agreement rule, exact Order revision, adjustments, evidence, and human action." action={<a className="secondary-button" href="/api/commercial-export/commission">Export reconciliation</a>} />
    <section className="panel filter-panel"><Field label="Commission status"><select value={status} onChange={(event) => setStatus(event.target.value)}>
      <option value="">All</option>{["estimated","pending_verification","approved","payable","paid","disputed","canceled","clawed_back"].map((item) => <option key={item} value={item}>{item.replaceAll("_"," ")}</option>)}
    </select></Field><SaveView recordType="commission" status={status} /></section>
    {error ? <ErrorPanel message={error} /> : loading ? <Loading label="Loading reconciled Commission records" /> :
      records.length === 0 ? <Empty>No Commissions. A verified Order and unambiguous documented Agreement rule are required.</Empty> : <>
        {grouped.map(([code, totals]) => <section className="metric-row" key={code} aria-label={`${code} Commission totals`}>
          <article className="metric"><span>{code} Expected</span><strong>{currency(totals.expected,code)}</strong><small>Estimate, not guaranteed income</small></article>
          <article className="metric"><span>{code} Approved</span><strong>{currency(totals.approved,code)}</strong></article>
          <article className="metric"><span>{code} Paid</span><strong>{currency(totals.paid,code)}</strong><small>Human-confirmed actual</small></article>
        </section>)}
        <section className="panel"><div className="table-wrap"><table><thead><tr><th>Order / Brand</th><th>Formula basis</th><th>Expected</th><th>Approved</th><th>Paid</th><th>Status</th><th /></tr></thead>
          <tbody>{records.map((item) => <tr key={item.id}>
            <td><strong>{shown(item.orderNumber)}</strong><small>{shown(item.brandName)}</small></td>
            <td>{shown(item.termType).replaceAll("_"," ")} · {shown(item.basisType)} × {shown(item.commissionRate)}</td>
            <td>{currency(item.expectedAmount,item.currency)}</td><td>{currency(item.approvedAmount,item.currency)}</td><td>{currency(item.paidAmount,item.currency)}</td>
            <td><StatusPill value={shown(item.status)} /></td><td><Link to={`/commissions/${item.id}`}>Explain</Link></td>
          </tr>)}</tbody></table></div></section>
      </>}
  </Shell>;
}

export function CommissionDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useLoad(
    () => api<Record<string, unknown>>(`/api/commissions/${id}`), [id]
  );
  const commission = data?.commission as Row | undefined;
  const [toStatus, setToStatus] = useState("pending_verification");
  const [documentId, setDocumentId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [reason, setReason] = useState("Human reviewed the Agreement rule, exact Order revision, adjustments, and supporting evidence.");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  async function transition(event: FormEvent) {
    event.preventDefault(); if (!commission) return;
    setSaving(true); setActionError("");
    try {
      await api(`/api/commissions/${id}/status`, {
        method: "POST", body: {
          version: commission.version, toStatus, reason, sourceDocumentId: documentId,
          verifiedAmount: toStatus === "approved" ? amount : null,
          approvedAmount: toStatus === "approved" ? amount : null,
          paidAmount: toStatus === "paid" ? amount : null,
          paymentDueDate: toStatus === "payable" ? dueDate : null,
          paymentDate: toStatus === "paid" ? paymentDate : null,
          clawbackAmount: toStatus === "clawed_back" ? amount : null
        }
      });
      await reload();
    } catch (caught) { setActionError(caught instanceof Error ? caught.message : "Commission state could not be changed."); }
    finally { setSaving(false); }
  }
  async function openDispute() {
    if (!commission) return; setSaving(true); setActionError("");
    try {
      const result = await api<{ dispute: Row }>(`/api/commissions/${id}/disputes`, {
        method: "POST", body: {
          reasonCode: "amount_or_eligibility", reason, disputedAmount: amount,
          evidenceDocumentId: documentId,
          nextAction: "Prepare and approve a factual evidence request to the Brand."
        }
      });
      void navigate(`/commission-disputes/${result.dispute.id}`);
    } catch (caught) { setActionError(caught instanceof Error ? caught.message : "Dispute could not be opened."); }
    finally { setSaving(false); }
  }
  if (loading) return <Shell><Loading label="Loading Commission formula and evidence" /></Shell>;
  if (error || !commission) return <Shell><ErrorPanel message={error || "Commission not found."} /></Shell>;
  const calculations = (data?.calculations ?? []) as Row[];
  const disputes = (data?.disputes ?? []) as Row[];
  const events = (data?.events ?? []) as Row[];
  const current = calculations[0];
  return <Shell>
    <PageHeader eyebrow="Commission detail" title={`${shown(commission.brandName)} · ${shown(commission.orderNumber)}`} description="The current estimate and every prior calculation remain reproducible. Ryva does not approve compensation or payment autonomously." action={<StatusPill value={shown(commission.status)} />} />
    {actionError ? <ErrorPanel message={actionError} /> : null}
    <section className="metric-row">
      <article className="metric"><span>Expected</span><strong>{currency(commission.expectedAmount,commission.currency)}</strong><small>System calculation</small></article>
      <article className="metric"><span>Approved</span><strong>{currency(commission.approvedAmount,commission.currency)}</strong><small>Human-confirmed</small></article>
      <article className="metric"><span>Paid</span><strong>{currency(commission.paidAmount,commission.currency)}</strong><small>{commission.paymentDate ? dateShown(commission.paymentDate) : "No payment confirmed"}</small></article>
    </section>
    <div className="split-grid">
      <section className="panel"><h2>Visible calculation</h2>
        {current ? <><p className="formula">{shown(current.formula)}</p><dl className="detail-list">
          <div><dt>Gross Order</dt><dd>{currency(current.grossAmount,current.currency)}</dd></div>
          <div><dt>Eligible amount</dt><dd>{currency(current.eligibleAmount,current.currency)}</dd></div>
          <div><dt>Discounts / returns / cancellations</dt><dd>{currency(current.discounts,current.currency)} / {currency(current.returns,current.currency)} / {currency(current.cancellations,current.currency)}</dd></div>
          <div><dt>Basis and rate</dt><dd>{shown(current.basisType)} · {shown(current.rate)}</dd></div>
          <div><dt>Rounding</dt><dd>{shown(current.roundingRule)}</dd></div>
          <div><dt>Source versions</dt><dd>Agreement {shown(current.agreementId)} · Order revision {shown(current.orderRevision)}</dd></div>
        </dl></> : <p className="empty">No current calculation. Commission advancement is blocked.</p>}
      </section>
      <section className="panel"><h2>Human state transition</h2><form onSubmit={(event) => void transition(event)}>
        <Field label="Next status"><select value={toStatus} onChange={(event) => setToStatus(event.target.value)}>
          {["pending_verification","approved","payable","paid","canceled","clawed_back"].map((item) => <option key={item} value={item}>{item.replaceAll("_"," ")}</option>)}
        </select></Field>
        <Field label="Clean evidence document ID"><input required value={documentId} onChange={(event) => setDocumentId(event.target.value)} /></Field>
        {["approved","paid","clawed_back"].includes(toStatus) ? <Field label={`${toStatus.replaceAll("_"," ")} amount`}><input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field> : null}
        {toStatus === "payable" ? <Field label="Payment due date"><input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field> : null}
        {toStatus === "paid" ? <Field label="Payment date"><input required type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></Field> : null}
        <Field label="Human rationale"><textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
        <div className="button-row"><button className="primary-button" disabled={saving}>Confirm consequential state</button><button className="secondary-button" type="button" disabled={saving || !amount || !documentId} onClick={() => void openDispute()}>Open documented dispute</button></div>
      </form></section>
    </div>
    <section className="panel"><h2>Immutable calculations</h2>{calculations.map((item) => <div className="task-row" key={item.id}>
      <span><strong>Version {shown(item.calculationVersion)} · {currency(item.resultAmount,item.currency)}</strong><small>{shown(item.reason)} · Order revision {shown(item.orderRevision)}</small></span>
    </div>)}</section>
    {disputes.length ? <section className="panel"><h2>Disputes</h2>{disputes.map((item) => <div className="task-row" key={item.id}><span><strong>{shown(item.reason)}</strong><small>{currency(item.disputedAmount,item.currency)} · {shown(item.status)}</small></span><Link to={`/commission-disputes/${item.id}`}>Open case</Link></div>)}</section> : null}
    <section className="panel"><h2>Payment and adjustment history</h2>{events.map((item, index) => <div className="task-row" key={`${shown(item.eventType)}-${index}`}><span><strong>{shown(item.eventType)}</strong><small>{shown(item.reason)} · {dateShown(item.occurredAt)}</small></span></div>)}</section>
  </Shell>;
}

export function CommissionDisputesPage() {
  const [status, setStatus] = useState("");
  const { data, loading, error } = useLoad(
    () => api<{ disputes: Row[] }>(`/api/commission-disputes${status ? `?status=${encodeURIComponent(status)}` : ""}`),
    [status]
  );
  const records = data?.disputes ?? [];
  return <Shell>
    <PageHeader eyebrow="Human-owned resolution" title="Commission Disputes" description="Preserve claims, evidence, communications, chronology, adjustments, and final human decisions. Ryva does not adjudicate contractual rights." action={<a className="secondary-button" href="/api/commercial-export/commission_dispute">Export case list</a>} />
    <section className="panel filter-panel"><Field label="Dispute status"><select value={status} onChange={(event) => setStatus(event.target.value)}>
      <option value="">All</option>{["opened","evidence_needed","submitted","under_review","resolved","rejected","withdrawn"].map((item) => <option key={item} value={item}>{item.replaceAll("_"," ")}</option>)}
    </select></Field><SaveView recordType="commission_dispute" status={status} /></section>
    {error ? <ErrorPanel message={error} /> : loading ? <Loading label="Loading dispute chronology" /> :
      records.length === 0 ? <Empty>No Commission Disputes. Open one from a Commission variance or overdue-payment review.</Empty> :
      <section className="panel"><div className="table-wrap"><table><thead><tr><th>Case</th><th>Relationship</th><th>Amount</th><th>Reason</th><th>Status</th><th>Next action</th><th /></tr></thead>
        <tbody>{records.map((item) => <tr key={item.id}><td className="monospace">{item.id.slice(0,8)}</td><td>{shown(item.brandName)}<small>{shown(item.businessName)} · {shown(item.orderNumber)}</small></td><td>{currency(item.disputedAmount,item.currency)}</td><td>{shown(item.reason)}</td><td><StatusPill value={shown(item.status)} /></td><td>{shown(item.nextAction)}</td><td><Link to={`/commission-disputes/${item.id}`}>Review case</Link></td></tr>)}</tbody>
      </table></div></section>}
  </Shell>;
}

export function CommissionDisputeDetailPage() {
  const { id = "" } = useParams();
  const { data, loading, error, reload } = useLoad(
    () => api<Record<string, unknown>>(`/api/commission-disputes/${id}`), [id]
  );
  const dispute = data?.dispute as Row | undefined;
  const [resolutionAmount, setResolutionAmount] = useState("");
  const [resolution, setResolution] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [decisionId, setDecisionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  async function resolve(event: FormEvent) {
    event.preventDefault(); if (!dispute) return;
    setSaving(true); setActionError("");
    try {
      await api(`/api/commission-disputes/${id}/resolve`, {
        method: "POST", body: {
          version: dispute.version, resolutionAmount, resolution,
          resolutionDate: new Date().toISOString().slice(0,10),
          evidenceDocumentId: documentId, finalDecisionId: decisionId
        }
      });
      await reload();
    } catch (caught) { setActionError(caught instanceof Error ? caught.message : "Dispute could not be resolved."); }
    finally { setSaving(false); }
  }
  if (loading) return <Shell><Loading label="Loading dispute evidence" /></Shell>;
  if (error || !dispute) return <Shell><ErrorPanel message={error || "Dispute not found."} /></Shell>;
  const events = (data?.events ?? []) as Row[];
  const notes = (data?.notes ?? []) as Row[];
  const documents = (data?.documents ?? []) as Row[];
  return <Shell>
    <PageHeader eyebrow="Dispute case" title={`Order ${shown(dispute.orderNumber)}`} description="Resolution requires evidence, a recorded amount and rationale, and a fresh issued human Decision. Withdrawal does not imply Brand correctness." action={<StatusPill value={shown(dispute.status)} />} />
    {actionError ? <ErrorPanel message={actionError} /> : null}
    <div className="split-grid">
      <section className="panel"><h2>Claim and evidence</h2><dl className="detail-list">
        <div><dt>Reason</dt><dd>{shown(dispute.reason)}</dd></div>
        <div><dt>Disputed amount</dt><dd>{currency(dispute.disputed_amount,dispute.currency)}</dd></div>
        <div><dt>Expected / approved / paid</dt><dd>{currency(dispute.expectedAmount,dispute.currency)} / {currency(dispute.approvedAmount,dispute.currency)} / {currency(dispute.paidAmount,dispute.currency)}</dd></div>
        <div><dt>Next action</dt><dd>{shown(dispute.next_action)}</dd></div>
        <div><dt>Evidence</dt><dd>{documents.length ? documents.map((item) => shown(item.name)).join(", ") : "Evidence unavailable — resolution blocked"}</dd></div>
      </dl></section>
      <section className="panel"><h2>Final human resolution</h2>
        {shown(dispute.status) === "resolved" ? <p><strong>{currency(dispute.resolution_amount,dispute.currency)}</strong> · {shown(dispute.resolution)}</p> :
          <form onSubmit={(event) => void resolve(event)}>
            <Field label="Resolved amount"><input required inputMode="decimal" value={resolutionAmount} onChange={(event) => setResolutionAmount(event.target.value)} /></Field>
            <Field label="Resolution rationale"><textarea required value={resolution} onChange={(event) => setResolution(event.target.value)} /></Field>
            <Field label="Resolution evidence document ID"><input required value={documentId} onChange={(event) => setDocumentId(event.target.value)} /></Field>
            <Field label="Issued human Decision ID"><input required value={decisionId} onChange={(event) => setDecisionId(event.target.value)} /></Field>
            <button className="primary-button" disabled={saving}>Record final human decision</button>
          </form>}
      </section>
    </div>
    <section className="panel"><h2>Immutable chronology</h2>{events.map((item, index) => <div className="task-row" key={`${shown(item.eventType)}-${index}`}><span><strong>{shown(item.eventType)}</strong><small>{shown(item.reason)} · {dateShown(item.occurredAt)}</small></span></div>)}
      {notes.map((item) => <div className="task-row" key={item.id}><span><strong>Case note</strong><small>{shown(item.body)}</small></span></div>)}</section>
  </Shell>;
}
