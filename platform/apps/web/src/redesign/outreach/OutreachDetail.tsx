import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiProblem } from "../../api";
import { useAuth } from "../../auth";
import {
  ActivityTimeline,
  Alert,
  ApprovalPanel,
  AuthorityIndicator,
  Button,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  Field,
  IdentityHeader,
  LoadingState,
  Select,
  StatusLabel,
  TextArea
} from "../../design-system";
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
} from "../consequential/ConsequentialReview";
import {
  ContextRail,
  RelationshipDetailLayout,
  RelationshipSection,
  RelationshipTabPanel,
  RelationshipTabs,
  RelationshipTrail,
  StickyMobileAction
} from "../relationship/RelationshipDetail";
import {
  dateTime,
  field,
  hasUnresolvedPlaceholders,
  messageStatus,
  readable,
  responseClassifications,
  shown,
  type Row
} from "./utils";

type MessageDetail = {
  message: Row & {
    placementOpportunityId: string;
    recipientAddress: string;
    senderAddress: string;
    subject: string;
    body: string;
    status: string;
    approvalId: string | null;
    approvedDigest: string | null;
    claims: Row[];
    attachments: Row[];
    products?: string[];
  };
  digest: string;
};

type ContactContext = {
  record: Row;
};

type PlacementContext = {
  placement: Row;
  products: Array<{ productId: string }>;
};

type AuthorityResult = { outcome: string; reasonCodes: string[] };

function isStaleConflict(caught: unknown): boolean {
  return caught instanceof ApiProblem
    && caught.status === 409
    && [
      "approval_artifact_changed",
      "outreach_version_conflict",
      "stale_version",
      "conflict"
    ].some((code) => caught.type.includes(code) || /version|stale|artifact changed|no longer current/i.test(caught.message));
}

function authorityTone(outcome: string): "success" | "warning" | "danger" | "info" {
  if (outcome === "authorized") return "success";
  if (outcome === "review_required" || outcome === "not_checked") return "warning";
  if (outcome === "denied") return "danger";
  return "info";
}

export function OutreachDetailPage() {
  const { id = "" } = useParams();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const tabBaseId = useId();
  const submissionGuard = useRef(false);

  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [contact, setContact] = useState<Row | null>(null);
  const [placement, setPlacement] = useState<PlacementContext | null>(null);
  const [authority, setAuthority] = useState<AuthorityResult | null>(null);
  const [approvalId, setApprovalId] = useState("");
  const [classification, setClassification] = useState("interested");
  const [responseNotes, setResponseNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("message");
  const [contextOpen, setContextOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approve" | "queue" | "confirm-social" | null>(null);
  const [lastOutcome, setLastOutcome] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const value = await api<MessageDetail>(`/api/outreach/${id}`);
      setDetail(value);
      setApprovalId(value.message.approvalId ?? "");

      const contactId = shown(field(value.message, "contactId", "contact_id"));
      const placementId = shown(field(value.message, "placementOpportunityId", "placement_opportunity_id"));
      const brandId = shown(field(value.message, "brandId", "brand_id"));
      const businessId = shown(field(value.message, "businessId", "business_id"));
      const agreementId = shown(field(value.message, "agreementId", "agreement_id"));
      const productIds = Array.isArray(value.message.products)
        ? value.message.products.map(String)
        : [];

      const [contactPayload, placementPayload] = await Promise.all([
        contactId && contactId !== "—"
          ? api<ContactContext>(`/api/records/contact/${contactId}`).catch(() => null)
          : Promise.resolve(null),
        placementId && placementId !== "—"
          ? api<PlacementContext>(`/api/placements/${placementId}`).catch(() => null)
          : Promise.resolve(null)
      ]);
      setContact(contactPayload?.record ?? null);
      setPlacement(placementPayload);

      const evaluatedProducts = productIds.length
        ? productIds
        : (placementPayload?.products.map((item) => item.productId) ?? []);
      if (brandId !== "—" && businessId !== "—" && evaluatedProducts.length > 0) {
        try {
          const action = value.message.status === "approved" || value.message.status === "queued"
            ? "send_outreach"
            : value.message.status === "approval_requested"
              ? "approve_outreach"
              : "prepare_outreach";
          const evaluated = await api<{ authority: AuthorityResult }>("/api/authority/evaluate", {
            method: "POST",
            body: {
              action,
              brandId,
              businessId,
              agreementId: agreementId !== "—" ? agreementId : null,
              productIds: evaluatedProducts,
              channel: shown(field(value.message, "authorityChannel", "authority_channel"), shown(value.message.channel)),
              context: { placementId, messageId: id }
            }
          });
          setAuthority(evaluated.authority);
        } catch {
          setAuthority(null);
        }
      } else {
        setAuthority(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Message could not be loaded.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (actionError) document.querySelector<HTMLElement>("[data-review-error]")?.focus();
  }, [actionError]);

  async function requestApproval() {
    if (!canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true);
    setActionError("");
    setConflict(false);
    try {
      const result = await api<{ approval: Row }>(`/api/outreach/${id}/approval`, { method: "POST" });
      setApprovalId(result.approval.id);
      setLastOutcome("Approval requested for this exact artifact.");
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Approval could not be requested.");
      setConflict(isStaleConflict(caught));
    } finally {
      setSaving(false);
      submissionGuard.current = false;
    }
  }

  async function approve() {
    if (!canWrite || !approvalId || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true);
    setActionError("");
    setConflict(false);
    try {
      await api(`/api/outreach/${id}/approval/${approvalId}`, {
        method: "POST",
        body: {
          decision: "approved",
          conditions: "Approved for this exact recipient, content, attachments, sender, channel and timing only."
        }
      });
      setConfirmationOpen(false);
      setPendingAction(null);
      setLastOutcome("Exact artifact approved. Approval does not send.");
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Exact artifact could not be approved.");
      setConflict(isStaleConflict(caught));
      setConfirmationOpen(false);
    } finally {
      setSaving(false);
      submissionGuard.current = false;
    }
  }

  async function send() {
    if (!canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true);
    setActionError("");
    setConflict(false);
    try {
      await api(`/api/outreach/${id}/send`, { method: "POST" });
      setConfirmationOpen(false);
      setPendingAction(null);
      setLastOutcome("Approved message queued. Queued does not mean delivered.");
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Message could not be queued.");
      setConflict(isStaleConflict(caught));
      setConfirmationOpen(false);
    } finally {
      setSaving(false);
      submissionGuard.current = false;
    }
  }

  async function confirmSocialSend() {
    if (!canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true);
    setActionError("");
    setConflict(false);
    try {
      await api(`/api/outreach/${id}/confirm-manual-send`, {
        method: "POST",
        body: {
          occurredAt: new Date().toISOString(),
          confirmation: "I personally sent this exact approved social message to the named recipient."
        }
      });
      setConfirmationOpen(false);
      setPendingAction(null);
      setLastOutcome("Human confirmation of external social send recorded.");
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "External social send could not be confirmed.");
      setConflict(isStaleConflict(caught));
      setConfirmationOpen(false);
    } finally {
      setSaving(false);
      submissionGuard.current = false;
    }
  }

  async function classifyResponse(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || submissionGuard.current) return;
    submissionGuard.current = true;
    setSaving(true);
    setActionError("");
    setConflict(false);
    try {
      await api(`/api/outreach/${id}/classify-response`, {
        method: "POST",
        body: {
          classification,
          notes: responseNotes,
          nextActionTitle: classification === "opt_out" ? null : "Respond to classified Buyer message",
          nextActionDueAt: classification === "opt_out" ? null : new Date(Date.now() + 86_400_000).toISOString()
        }
      });
      setResponseNotes("");
      setLastOutcome(`Response classified as ${classification}. Classification does not create an Order.`);
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Response could not be classified.");
      setConflict(isStaleConflict(caught));
    } finally {
      setSaving(false);
      submissionGuard.current = false;
    }
  }

  function openConfirmation(action: "approve" | "queue" | "confirm-social") {
    setPendingAction(action);
    setConfirmationOpen(true);
  }

  async function confirmPending() {
    if (pendingAction === "approve") await approve();
    else if (pendingAction === "queue") await send();
    else if (pendingAction === "confirm-social") await confirmSocialSend();
  }

  if (loading && !detail) {
    return (
      <div className="page ry-relationship-page ry-outreach-page">
        <RelationshipTrail items={[{ label: "Outreach", to: "/outreach" }, { label: "Loading outreach artifact" }]} />
        <LoadingState label="Loading outreach artifact" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="page ry-relationship-page ry-outreach-page">
        <RelationshipTrail items={[{ label: "Outreach", to: "/outreach" }, { label: "Outreach artifact unavailable" }]} />
        <IdentityHeader eyebrow="Exact outreach artifact" title="Message unavailable" />
        <ErrorState message={error || "Outreach message not found."} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const message = detail.message;
  const status = messageStatus(message);
  const channel = shown(message.channel);
  const subject = shown(message.subject, "(no subject)");
  const body = shown(message.body, "");
  const placementId = shown(field(message, "placementOpportunityId", "placement_opportunity_id"));
  const contactId = shown(field(message, "contactId", "contact_id"));
  const brandId = shown(field(message, "brandId", "brand_id"));
  const businessId = shown(field(message, "businessId", "business_id"));
  const agreementId = shown(field(message, "agreementId", "agreement_id"));
  const brandName = shown(placement?.placement.brandName, "Brand");
  const businessName = shown(placement?.placement.businessName, "Business");
  const contactName = shown(contact?.name, "Contact");
  const permissionStatus = shown(contact?.permissionStatus ?? contact?.permission_status, "unknown");
  const verificationStatus = shown(contact?.verificationStatus ?? contact?.verification_status, "unverified");
  const lastVerifiedAt = contact?.lastVerifiedAt ?? contact?.last_verified_at;
  const permissionBlocked = ["prohibited", "opted_out"].includes(permissionStatus);
  const verificationStaleOrMissing = verificationStatus !== "verified";
  const unresolved = hasUnresolvedPlaceholders(subject === "(no subject)" ? "" : subject, body);
  const authorityOutcome = authority?.outcome ?? "not_checked";
  const authorized = authorityOutcome === "authorized";
  const claims = Array.isArray(message.claims) ? message.claims : [];
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const productIds = Array.isArray(message.products) ? message.products.map(String) : (placement?.products.map((item) => item.productId) ?? []);
  const isReplyState = ["replied", "received"].includes(status);

  const blockers = [
    ...(!canWrite ? [session?.access.reason ?? "This session cannot approve, queue, or classify Outreach."] : []),
    ...(permissionBlocked ? [`Contact permission is ${readable(permissionStatus)}. Permission is distinct from verification and address presence.`] : []),
    ...(unresolved ? ["Unresolved merge placeholders remain in the exact subject or body."] : []),
    ...(!authorized && status === "draft" ? [`Representation authority is ${readable(authorityOutcome)}. Placement readiness does not authorize Outreach.`] : []),
    ...(conflict ? ["The Outreach artifact version or related approval is no longer current. Reload before retrying."] : [])
  ];

  const readinessState: ReviewReadiness = conflict
    ? "stale"
    : !canWrite
      ? "restricted"
      : permissionBlocked || unresolved
        ? "blocked"
        : ["queued", "accepted", "delivered", "replied", "failed", "suppressed", "canceled"].includes(status)
          ? "completed"
          : "requires_review";

  const validationChecks: ValidationCheck[] = [
    {
      id: "recipient",
      label: "Exact recipient and channel",
      detail: `${message.recipientAddress} · ${channel}. Address presence does not imply permission.`,
      state: message.recipientAddress ? "passed" : "failed"
    },
    {
      id: "permission",
      label: "Contact permission",
      detail: `Stored permission is ${readable(permissionStatus)}. Verified does not mean allowed.`,
      state: permissionBlocked ? "failed" : permissionStatus === "professional_purpose" ? "passed" : "requires_review"
    },
    {
      id: "verification",
      label: "Contact verification",
      detail: verificationStaleOrMissing
        ? `${readable(verificationStatus)}. Verification freshness is separate from permission and suppression.`
        : `Verified${lastVerifiedAt ? ` · ${dateTime(lastVerifiedAt)}` : ""}. Verification does not grant Outreach permission.`,
      state: verificationStatus === "verified" ? "passed" : "requires_review"
    },
    {
      id: "placeholders",
      label: "Exact message content",
      detail: unresolved
        ? "Unresolved {{placeholders}} remain. Do not approve a template-shaped draft as if it were the final artifact."
        : "No unresolved merge placeholders detected in the stored subject and body.",
      state: unresolved ? "failed" : "passed"
    },
    {
      id: "authority",
      label: "Representation authority context",
      detail: authorized
        ? "Authority evaluation returned authorized for the linked Agreement scope. Authority does not auto-approve this message."
        : `Authority outcome is ${readable(authorityOutcome)}. ${Array.isArray(authority?.reasonCodes) ? authority.reasonCodes.join(", ") : "No reason codes."}`,
      state: authorized ? "passed" : "requires_review"
    },
    {
      id: "approval-send",
      label: "Approval versus send",
      detail: status === "approved"
        ? "Approved exact artifact. Approval does not send; queueing revalidates before provider delivery."
        : status === "queued"
          ? "Queued for worker delivery. Queued does not mean delivered or read."
          : `Current status is ${readable(status)}.`,
      state: ["approved", "queued", "accepted", "delivered"].includes(status) ? "passed" : "requires_review"
    }
  ];

  const activityEntries = [
    {
      id: "status",
      title: `Message status · ${readable(status)}`,
      description: "Stored Outreach status only. Open, read, and engagement analytics are not invented here.",
      meta: dateTime(field(message, "updatedAt", "updated_at"), "Time not recorded"),
      status: <StatusLabel value={status} />
    },
    ...(message.scheduledAt ? [{
      id: "scheduled",
      title: "Scheduled timing",
      description: shown(message.scheduledAt),
      meta: "Stored schedule",
      status: <StatusLabel value="scheduled" />
    }] : []),
    ...claims.map((item) => ({
      id: `claim-${shown(item.id)}`,
      title: "Evidence-linked claim",
      description: shown(item.claimText),
      meta: `Evidence ${shown(item.evidenceId, "missing")}`,
      status: <StatusLabel value={shown(item.status)} />
    }))
  ];

  const tabs = [
    { id: "message", label: "Exact message" },
    { id: "contact", label: "Contact & permission" },
    { id: "placement", label: "Placement" },
    { id: "review", label: "Approval & send" },
    { id: "activity", label: "Activity", count: activityEntries.length },
    ...(isReplyState ? [{ id: "response", label: "Response" }] : [])
  ];

  const primaryAction = !canWrite
    ? <Button disabled>Read-only access</Button>
    : status === "draft"
      ? <Button loading={saving} onClick={() => void requestApproval()}>Request exact approval</Button>
      : status === "approval_requested"
        ? <Button loading={saving} disabled={!approvalId} onClick={() => openConfirmation("approve")}>Approve exact artifact</Button>
        : status === "approved" && channel === "email"
          ? <Button loading={saving} onClick={() => openConfirmation("queue")}>Queue approved message</Button>
          : status === "approved" && channel === "social"
            ? <Button loading={saving} onClick={() => openConfirmation("confirm-social")}>Confirm I sent this exact message</Button>
            : <Button variant="secondary" onClick={() => setActiveTab("message")}>Review exact artifact</Button>;

  const confirmationCopy = pendingAction === "approve"
    ? {
        title: "Approve this exact Outreach artifact?",
        description: "Approval binds recipient, sender, channel, subject, body, claims, attachments, and timing together. Approval does not send or queue delivery.",
        confirmLabel: "Approve exact artifact"
      }
    : pendingAction === "queue"
      ? {
          title: "Queue this approved email?",
          description: "Queueing revalidates access, authority, recipient permission, conflict state, claims, and attachments. Queued does not mean delivered.",
          confirmLabel: "Queue approved message"
        }
      : {
          title: "Confirm you sent this exact social message?",
          description: "Only confirm after you personally sent this exact approved social message to the named recipient outside Ryva.",
          confirmLabel: "Confirm external send"
        };

  const contextContent = (
    <>
      <div className="ry-context-item">
        <strong>Status</strong>
        <StatusLabel value={status} />
        <small>Approved ≠ sent. Queued ≠ delivered.</small>
      </div>
      <div className="ry-context-item">
        <strong>Permission</strong>
        <StatusLabel value={permissionStatus} />
        <small>Unknown is distinct from allowed.</small>
      </div>
      <div className="ry-context-item">
        <strong>Verification</strong>
        <StatusLabel value={verificationStatus} />
      </div>
      <div className="ry-context-item">
        <strong>Authority</strong>
        <AuthorityIndicator
          value={authorityOutcome}
          tone={authorityTone(authorityOutcome)}
          rationale="Representation authority informs Outreach eligibility checks. It does not approve or send this artifact."
        />
      </div>
      <div className="ry-context-item">
        <strong>Placement</strong>
        <p>{placementId !== "—" ? <Link to={`/placements/${placementId}`}>{brandName} → {businessName}</Link> : "Not linked"}</p>
        <small>Placement readiness does not authorize Outreach.</small>
      </div>
    </>
  );

  return (
    <div className="page ry-relationship-page ry-outreach-page">
      <RelationshipTrail items={[
        { label: "Outreach", to: "/outreach" },
        { label: subject }
      ]} />
      <IdentityHeader
        eyebrow="Exact outreach artifact"
        title={subject}
        relationship={(
          <span className="ry-relationship-identity-meta">
            <span>{contactName}</span>
            <span>{channel}</span>
            <span>{businessName}</span>
          </span>
        )}
        status={<StatusLabel value={status} />}
        warning={permissionBlocked ? (
          <Alert tone="danger" title="Contact permission blocks external Outreach.">
            Stored permission is {readable(permissionStatus)}. Verification and address presence do not override this state.
          </Alert>
        ) : unresolved ? (
          <Alert tone="warning" title="Unresolved placeholders remain">
            Do not treat a template-shaped draft as the exact message under review until placeholders are resolved.
          </Alert>
        ) : undefined}
        nextAction={<span>{canWrite ? "Review the exact recipient, channel, content, permission, and suppression facts before any approval or queue action." : session?.access.reason ?? "Read-only Outreach inspection."}</span>}
        actions={<>{primaryAction}<Link className="ry-button ry-button-secondary" to="/outreach">Back to outreach</Link></>}
      />
      {!canWrite ? (
        <Alert tone="warning" title="Read-only Outreach context">
          You may inspect permitted Outreach artifacts, but cannot request approval, approve, queue, confirm, or classify in this session.
        </Alert>
      ) : null}
      {actionError ? <ReviewErrorSummary message={actionError} conflict={conflict} onReload={() => { void load(); setConflict(false); setActionError(""); }} /> : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Outreach relationship views" baseId={tabBaseId} />
      <RelationshipDetailLayout context={<ContextRail title="Outreach context" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>{contextContent}</ContextRail>}>
        <RelationshipTabPanel id={tabBaseId} tabId="message" active={activeTab === "message"}>
          <RelationshipSection title="Exact delivery scope" description="Recipient, sender, content, claims, attachments, channel and timing are approved together. Any material edit invalidates approval.">
            <dl className="ry-relationship-facts">
              <div><dt>Recipient</dt><dd>{message.recipientAddress}</dd></div>
              <div><dt>Sender</dt><dd>{message.senderAddress}</dd></div>
              <div><dt>Channel</dt><dd>{channel}</dd></div>
              <div><dt>Timing</dt><dd>{shown(message.scheduledAt, "Immediate after approval")}</dd></div>
              <div><dt>Artifact digest</dt><dd><code>{detail.digest.slice(0, 16)}…</code></dd></div>
              <div><dt>Version</dt><dd>{shown(message.version)}</dd></div>
            </dl>
            <h3>Exact body</h3>
            <pre className="ry-outreach-message-preview">{body}</pre>
          </RelationshipSection>
          <RelationshipSection title="Evidence-linked claims" description="Unsupported claims block approval. Declaring no claim is allowed when no factual claim is made.">
            {claims.length === 0 ? <EmptyState compact description="No material claims declared." /> : (
              <ul className="ry-relationship-evidence-list">
                {claims.map((item) => (
                  <li key={shown(item.id)}>
                    <StatusLabel value={shown(item.status)} />
                    <strong>{shown(item.claimText)}</strong>
                    <small>Evidence {shown(item.evidenceId, "missing")}</small>
                  </li>
                ))}
              </ul>
            )}
          </RelationshipSection>
          <RelationshipSection title="Immutable attachments" description="Only clean immutable Document IDs may attach to an Outreach artifact.">
            {attachments.length === 0 ? <EmptyState compact description="No attachments." /> : (
              <ul className="ry-relationship-evidence-list">
                {attachments.map((item) => (
                  <li key={shown(item.documentId)}>
                    <StatusLabel value={shown(item.scanStatus)} />
                    <strong>{shown(item.documentId)}</strong>
                    <small>{shown(item.sha256).slice(0, 16)}…</small>
                  </li>
                ))}
              </ul>
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="contact" active={activeTab === "contact"}>
          <RelationshipSection title="Contact identity and permission" description="Contact verification, permission, suppression, and channel availability remain distinct. Unknown is not allowed.">
            <dl className="ry-relationship-facts">
              <div><dt>Contact</dt><dd>{contactId !== "—" ? <Link to={`/contacts/${contactId}`}>{contactName}</Link> : contactName}</dd></div>
              <div><dt>Business</dt><dd>{businessId !== "—" ? <Link to={`/buyers/${businessId}`}>{businessName}</Link> : businessName}</dd></div>
              <div><dt>Destination</dt><dd>{message.recipientAddress}</dd></div>
              <div><dt>Permission</dt><dd><StatusLabel value={permissionStatus} /></dd></div>
              <div><dt>Verification</dt><dd><StatusLabel value={verificationStatus} />{lastVerifiedAt ? <small> · {dateTime(lastVerifiedAt)}</small> : null}</dd></div>
              <div><dt>Email on Contact</dt><dd>{shown(contact?.email, "Address missing")}</dd></div>
            </dl>
            <p className="ry-outreach-boundary">An available email address does not authorize Outreach. Suppression and channel rules are revalidated by the server on approval and queue.</p>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="placement" active={activeTab === "placement"}>
          <RelationshipSection title="Placement, Product, and Brand context" description="Placement informs Outreach context. Placement stage readiness does not authorize send, queue, or approve actions.">
            <dl className="ry-relationship-facts">
              <div><dt>Placement</dt><dd>{placementId !== "—" ? <Link to={`/placements/${placementId}`}>{brandName} → {businessName}</Link> : "Not linked"}</dd></div>
              <div><dt>Placement stage</dt><dd><StatusLabel value={shown(placement?.placement.stage, "unknown")} /></dd></div>
              <div><dt>Brand</dt><dd>{brandId !== "—" ? <Link to={`/brands/${brandId}`}>{brandName}</Link> : brandName}</dd></div>
              <div><dt>Agreement</dt><dd>{agreementId !== "—" ? <Link to={`/agreements/${agreementId}`}>Open Agreement</Link> : "Not linked"}</dd></div>
              <div><dt>Products in message</dt><dd>{productIds.length || "None recorded"}</dd></div>
              <div><dt>Authority channel</dt><dd>{shown(field(message, "authorityChannel", "authority_channel"), "Not recorded")}</dd></div>
            </dl>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="review" active={activeTab === "review"}>
          <div id="outreach-review" className="ry-outreach-review">
            {lastOutcome ? <ReviewOutcome title="Outreach action recorded" status={status} consequence={lastOutcome} /> : null}
            <ConsequentialReviewLayout readiness={<>
              <ReadinessSummary
                state={readinessState}
                description="Approval does not send. Queueing revalidates access, authority, recipient permission, conflict state, claims, and attachments. The worker repeats those checks immediately before provider delivery."
                blockers={blockers}
                context={(
                  <dl className="ry-review-facts">
                    <div><dt>Status</dt><dd>{readable(status)}</dd></div>
                    <div><dt>Digest</dt><dd><code>{detail.digest.slice(0, 16)}…</code></dd></div>
                    <div><dt>Version</dt><dd>{shown(message.version)}</dd></div>
                  </dl>
                )}
              />
              <AuthorityIndicator
                value={authorityOutcome}
                tone={authorityTone(authorityOutcome)}
                rationale="Authority context informs eligibility. AI cannot approve, send, or establish permission."
              />
            </>}>
              <ExactArtifact
                title="Exact Outreach message"
                description="This stored recipient, channel, subject, and body—not a reusable template—are the artifact under review."
                version={`${shown(message.version)} · ${detail.digest.slice(0, 12)}…`}
                code
              >
                {`To: ${message.recipientAddress}\nFrom: ${message.senderAddress}\nChannel: ${channel}\nSubject: ${subject}\n\n${body}`}
              </ExactArtifact>
              <ValidationSummary
                checks={validationChecks}
                description="Displayed checks summarize stored facts. The server revalidates on every approval and queue attempt. A visible action does not mean the server will permit it."
              />
              <ReviewSection
                eyebrow="Consequential action"
                title="Human approval and send"
                description="Preserve the boundary between draft, approval pending, approved, queued, sent/accepted, delivered, failed, and cancelled."
              >
                <ApprovalPanel
                  title="Exact-artifact decision"
                  readiness={<p>{readable(readinessState)}. Permission, verification, suppression, and channel checks remain distinct. A visible action does not mean the server will permit it.</p>}
                  consequence={<p>Request approval, approve the exact digest, queue email, or confirm an external social send. Approval does not send. Queued does not mean delivered. Do not invent open or reply status.</p>}
                  rationale={<p>Server validation, optimistic concurrency, and audit history remain authoritative over this panel.</p>}
                  processing={saving}
                  actions={(
                    <div className="ry-outreach-header-actions">
                      {status === "draft" ? <Button variant="secondary" loading={saving} disabled={!canWrite} onClick={() => void requestApproval()}>Request exact approval</Button> : null}
                      {status === "approval_requested" ? <Button loading={saving} disabled={!canWrite || !approvalId} onClick={() => openConfirmation("approve")}>Approve exact artifact</Button> : null}
                      {status === "approved" && channel === "email" ? <Button loading={saving} disabled={!canWrite} onClick={() => openConfirmation("queue")}>Queue approved message</Button> : null}
                      {status === "approved" && channel === "social" ? <Button loading={saving} disabled={!canWrite} onClick={() => openConfirmation("confirm-social")}>Confirm I sent this exact message</Button> : null}
                    </div>
                  )}
                />
              </ReviewSection>
            </ConsequentialReviewLayout>
          </div>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection title="Outreach activity" description="Only stored status, claims, and timing appear here. Engagement analytics are not fabricated.">
            <ActivityTimeline entries={activityEntries} />
          </RelationshipSection>
        </RelationshipTabPanel>

        {isReplyState ? (
          <RelationshipTabPanel id={tabBaseId} tabId="response" active={activeTab === "response"}>
            <RelationshipSection title="Classify the Buyer response" description="Human-owned response tracking. A reply does not create an Order or commercial outcome.">
              <form className="ry-outreach-call-form" onSubmit={(event) => void classifyResponse(event)}>
                <Field label="Response">
                  <Select value={classification} onChange={(event) => setClassification(event.target.value)} disabled={!canWrite}>
                    {responseClassifications.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </Field>
                <Field label="Response notes">
                  <TextArea required value={responseNotes} onChange={(event) => setResponseNotes(event.target.value)} disabled={!canWrite} />
                </Field>
                <Button type="submit" loading={saving} disabled={!canWrite}>{saving ? "Recording…" : "Record human classification"}</Button>
              </form>
            </RelationshipSection>
          </RelationshipTabPanel>
        ) : null}
      </RelationshipDetailLayout>

      <StickyMobileAction>
        {primaryAction}
      </StickyMobileAction>

      <ConfirmationDialog
        open={confirmationOpen}
        title={confirmationCopy.title}
        description={confirmationCopy.description}
        consequence={<>
          <strong>Exact Outreach artifact</strong>
          <p>Recipient {message.recipientAddress} · {channel}</p>
          <p>Subject: {subject}</p>
          <p>Digest {detail.digest.slice(0, 16)}… · version {shown(message.version)}</p>
        </>}
        confirmLabel={confirmationCopy.confirmLabel}
        processing={saving}
        onClose={() => { setConfirmationOpen(false); setPendingAction(null); }}
        onConfirm={() => void confirmPending()}
      />
    </div>
  );
}
