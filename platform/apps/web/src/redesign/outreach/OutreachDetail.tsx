import { Fragment, useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiProblem } from "../../api";
import { useAuth } from "../../auth";
import {
  ActivityTimeline,
  Alert,
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
  ReviewErrorSummary,
  ReviewOutcome,
  type ReviewReadiness
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
  authorityBlockedActionReason,
  authorityBlockedAlertContent,
  authorityRecoveryLabel
} from "../representation/utils";
import { displayBrandName } from "../brand/utils";
import {
  dateTime,
  displayAddress,
  displayAddressTitle,
  displayName,
  displayNameTitle,
  displayOutreachRecipient,
  displayOutreachSender,
  field,
  hasUnresolvedPlaceholders,
  messageStatus,
  messageStatusTone,
  outreachPermissionLabel,
  outreachVerificationLabel,
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

function checkStatus(ok: boolean, complete: string, incomplete: string) {
  return { ok, status: ok ? complete : incomplete };
}

function DisabledActionHint({ reason, children }: { reason: string; children: ReactNode }) {
  return (
    <span className="ry-disabled-action-hint" title={reason}>
      {children}
    </span>
  );
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
      setLastOutcome("Approval requested for this message.");
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
      setLastOutcome("Message approved. Sending is a separate step.");
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Message could not be approved.");
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
      setLastOutcome("Message queued. Delivery status updates when the provider responds.");
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
      setLastOutcome("External social send confirmed.");
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
      setLastOutcome(`Response classified as ${classification}. This does not create an order.`);
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
        <RelationshipTrail items={[{ label: "Outreach", to: "/outreach" }, { label: "Loading message" }]} />
        <LoadingState label="Loading outreach message" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="page ry-relationship-page ry-outreach-page">
        <RelationshipTrail items={[{ label: "Outreach", to: "/outreach" }, { label: "Message unavailable" }]} />
        <IdentityHeader title="Message unavailable" />
        <ErrorState message={error || "Outreach message not found."} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const message = detail.message;
  const status = messageStatus(message);
  const channel = shown(message.channel);
  const subject = shown(message.subject, "(no subject)");
  const subjectLabel = displayName(message.subject, "(no subject)");
  const body = shown(message.body, "");
  const placementId = shown(field(message, "placementOpportunityId", "placement_opportunity_id"));
  const contactId = shown(field(message, "contactId", "contact_id"));
  const brandId = shown(field(message, "brandId", "brand_id"));
  const businessId = shown(field(message, "businessId", "business_id"));
  const agreementId = shown(field(message, "agreementId", "agreement_id"));
  const brandName = displayBrandName(placement?.placement.brandName, "Brand");
  const businessName = displayName(placement?.placement.businessName, "Business");
  const contactName = displayName(contact?.name, "Contact");
  const recipientPresentation = displayOutreachRecipient(message.recipientAddress, contact, businessName, "Not recorded");
  const recipientLabel = recipientPresentation.label;
  const senderLabel = displayOutreachSender(message.senderAddress, "Not recorded");
  const recipientTitle = recipientPresentation.title ?? displayAddressTitle(message.recipientAddress);
  const senderTitle = displayAddressTitle(message.senderAddress);
  const permissionStatus = shown(contact?.permissionStatus ?? contact?.permission_status, "unknown");
  const verificationStatus = shown(contact?.verificationStatus ?? contact?.verification_status, "unverified");
  const lastVerifiedAt = contact?.lastVerifiedAt ?? contact?.last_verified_at;
  const permissionBlocked = ["prohibited", "opted_out"].includes(permissionStatus);
  const unresolved = hasUnresolvedPlaceholders(subject === "(no subject)" ? "" : subject, body);
  const authorityOutcome = authority?.outcome ?? "not_checked";
  const authorized = authorityOutcome === "authorized";
  const authorityBlocked = !authorized && Array.isArray(authority?.reasonCodes) && authority.reasonCodes.length
    ? authorityBlockedAlertContent(authority.reasonCodes)
    : null;
  const authorityBlocksActions = authority !== null && !authorized;
  const blockedActionReason = authorityBlocked
    ? authorityBlockedActionReason(authority!.reasonCodes)
    : "Representation authority is not confirmed for this message.";
  const claims = Array.isArray(message.claims) ? message.claims : [];
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const productIds = Array.isArray(message.products) ? message.products.map(String) : (placement?.products.map((item) => item.productId) ?? []);
  const isReplyState = ["replied", "received"].includes(status);
  const recipientReady = Boolean(message.recipientAddress);
  const permissionReady = !permissionBlocked && permissionStatus === "professional_purpose";
  const verificationReady = verificationStatus === "verified";
  const contentReady = !unresolved;
  const sendComplete = ["queued", "accepted", "delivered", "replied", "failed", "suppressed", "canceled"].includes(status);
  const approvalReady = ["approved", "queued", "accepted", "delivered"].includes(status);

  const blockers = [
    ...(!canWrite ? [session?.access.reason ?? "You can review this message, but cannot approve or send in this session."] : []),
    ...(permissionBlocked ? [`Update contact permission (${readable(permissionStatus)})`] : []),
    ...(unresolved ? ["Resolve merge placeholders in the subject or body"] : []),
    ...(!authorized && status === "draft" ? ["Confirm representation authority"] : []),
    ...(conflict ? ["Reload this message"] : [])
  ];

  const readinessState: ReviewReadiness = conflict
    ? "stale"
    : !canWrite
      ? "restricted"
      : permissionBlocked || unresolved
        ? "blocked"
        : sendComplete
          ? "completed"
          : "requires_review";

  const reviewChecks = [
    {
      id: "recipient",
      name: "Recipient and channel",
      ...checkStatus(recipientReady, "Complete", "Missing"),
      link: null as string | null,
      linkLabel: null as string | null
    },
    {
      id: "permission",
      name: "Contact permission",
      ...checkStatus(
        permissionReady,
        "Complete",
        permissionBlocked ? "Needs attention" : "Needs attention"
      ),
      link: contactId !== "—" ? `/contacts/${contactId}` : null,
      linkLabel: "Review contact →"
    },
    {
      id: "verification",
      name: "Contact verification",
      ...checkStatus(verificationReady, "Complete", "Needs attention"),
      link: contactId !== "—" ? `/contacts/${contactId}` : null,
      linkLabel: "Verify contact →"
    },
    {
      id: "content",
      name: "Message content",
      ...checkStatus(contentReady, "Complete", "Incomplete"),
      link: null,
      linkLabel: null
    },
    {
      id: "authority",
      name: "Representation authority",
      ...checkStatus(authorized, "Complete", "Needs attention"),
      link: agreementId !== "—" ? `/agreements/${agreementId}` : null,
      linkLabel: "Review agreement →"
    },
    {
      id: "approval",
      name: "Approval",
      ok: approvalReady,
      status: approvalReady ? "Complete" : status === "approval_requested" ? "In progress" : "Required",
      link: null,
      linkLabel: null
    }
  ];

  const stillNeeded = blockers;
  const actionBlocked = readinessState === "blocked" || readinessState === "restricted" || readinessState === "stale";
  const approvalActionBlocked = actionBlocked || authorityBlocksActions;
  const approvalBlockedReason = authorityBlocksActions
    ? blockedActionReason
    : blockers[0] ?? "Complete the review checklist before continuing.";

  const activityEntries = [
    {
      id: "status",
      title: `Status · ${readable(status)}`,
      description: "Stored message status only.",
      meta: dateTime(field(message, "updatedAt", "updated_at"), "Time not recorded"),
      status: <StatusLabel value={status} tone={messageStatusTone(status)} />
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
      meta: shown(item.evidenceId, "Evidence not linked"),
      status: <StatusLabel value={shown(item.status)} />
    }))
  ];

  const tabs = [
    { id: "message", label: "Message" },
    { id: "contact", label: "Contact & permission" },
    { id: "placement", label: "Placement" },
    { id: "review", label: "Approval & send" },
    { id: "activity", label: "Activity", count: activityEntries.length },
    ...(isReplyState ? [{ id: "response", label: "Response" }] : [])
  ];

  const headerRecoveryAction = authorityBlocksActions && canWrite && agreementId !== "—" ? (
    <Link className="ry-button ry-button-primary" to={`/agreements/${agreementId}`}>
      {authorityBlocked ? authorityRecoveryLabel(authority.reasonCodes) : "Review agreement"}
    </Link>
  ) : null;

  const reviewTabAction = !canWrite
    ? null
    : status === "draft" ? (
      <DisabledActionHint reason={approvalBlockedReason}>
        <Button loading={saving} disabled={approvalActionBlocked} title={approvalBlockedReason} onClick={() => void requestApproval()}>
          Request approval
        </Button>
      </DisabledActionHint>
    ) : status === "approval_requested" ? (
      <Button loading={saving} disabled={!approvalId || approvalActionBlocked} onClick={() => openConfirmation("approve")}>
        Approve message
      </Button>
    ) : status === "approved" && channel === "email" ? (
      <Button loading={saving} disabled={approvalActionBlocked} onClick={() => openConfirmation("queue")}>
        Queue message
      </Button>
    ) : status === "approved" && channel === "social" ? (
      <Button loading={saving} disabled={approvalActionBlocked} onClick={() => openConfirmation("confirm-social")}>
        Confirm I sent this
      </Button>
    ) : null;

  const mobileAction = headerRecoveryAction ?? (
    canWrite && (status === "draft" || status === "approval_requested")
      ? <Button variant="secondary" onClick={() => setActiveTab("review")}>Review and continue</Button>
      : <Link className="ry-button ry-button-secondary" to="/outreach">Back to outreach</Link>
  );

  const confirmationCopy = pendingAction === "approve"
    ? {
        title: "Approve this message?",
        description: "Approval locks the recipient, sender, channel, subject, body, claims, attachments, and timing together. Sending remains a separate step.",
        confirmLabel: "Approve message"
      }
    : pendingAction === "queue"
      ? {
          title: "Queue this email?",
          description: "We'll recheck permission and content, then hand it off for delivery.",
          confirmLabel: "Queue message"
        }
      : {
          title: "Confirm you sent this social message?",
          description: "Only confirm after you personally sent this approved social message to the named recipient outside Ryva.",
          confirmLabel: "Confirm external send"
        };

  const authorityStatusLabel = authorized ? "Confirmed" : readable(authorityOutcome);
  const permissionStatusLabel = outreachPermissionLabel(permissionStatus, permissionBlocked);
  const verificationStatusLabel = outreachVerificationLabel(verificationReady, lastVerifiedAt);

  const contextContent = (
    <>
      <dl className="ry-outreach-status-list">
        <div className="ry-outreach-status-row">
          <dt>Status</dt>
          <dd>{readable(status)}</dd>
        </div>
        <div className="ry-outreach-status-row">
          <dt>Email permission</dt>
          <dd>{permissionStatusLabel}</dd>
        </div>
        <div className="ry-outreach-status-row">
          <dt>Email verification</dt>
          <dd>{verificationStatusLabel}</dd>
        </div>
        <div className="ry-outreach-status-row">
          <dt>Authority</dt>
          <dd>{authorityStatusLabel}</dd>
        </div>
        <div className="ry-outreach-status-row">
          <dt>Placement</dt>
          <dd>
            {placementId !== "—"
              ? <Link to={`/placements/${placementId}`}>{brandName} → {businessName}</Link>
              : "Not linked"}
          </dd>
        </div>
      </dl>
      {activeTab === "review" && stillNeeded.length > 0 ? (
        <div className="ry-outreach-missing-actions ry-outreach-missing-actions-rail" role="status">
          <strong>Still needed</strong>
          <ul>
            {stillNeeded.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="page ry-relationship-page ry-outreach-page">
      <RelationshipTrail items={[
        { label: "Outreach", to: "/outreach" },
        { label: subjectLabel }
      ]} />
      <IdentityHeader
        title={<span title={displayNameTitle(message.subject)}>{subjectLabel}</span>}
        relationship={(
          <span className="ry-relationship-identity-meta ry-outreach-identity-meta">
            <StatusLabel value={status} tone={messageStatusTone(status)} className="ry-outreach-identity-status" />
            <span aria-hidden="true">·</span>
            <span title={displayNameTitle(placement?.placement.businessName)}>
              {businessName.replace(/\s+Business$/i, "").trim() || businessName}
            </span>
          </span>
        )}
        warning={permissionBlocked ? (
          <Alert tone="danger" title="Contact permission blocks outreach.">
            Stored permission is {readable(permissionStatus)}. Verification and address presence do not change this.
          </Alert>
        ) : authorityBlocksActions ? (
          <Alert tone="danger" title="Representation authority blocks approval." className="ry-outreach-authority-alert">
            {authorityBlocked ? authorityBlocked.messages.map((item, index) => (
              <Fragment key={item.code}>
                <p className="ry-outreach-authority-alert-line">{item.summary}</p>
                <p className="ry-outreach-authority-alert-line">
                  {item.guidance}
                  {authorityBlocked.showAgreementLink && agreementId !== "—" && index === authorityBlocked.messages.length - 1 ? (
                    <>{" "}<Link to={`/agreements/${agreementId}`}>Review agreement →</Link></>
                  ) : null}
                </p>
              </Fragment>
            )) : (
              <p className="ry-outreach-authority-alert-line">Confirm representation authority before requesting approval.</p>
            )}
          </Alert>
        ) : unresolved ? (
          <Alert tone="warning" title="Unresolved placeholders remain">
            Finish the draft before treating it as the message under review.
          </Alert>
        ) : undefined}
        nextAction={<span>{canWrite ? "Review recipient, content, and permission before approving or sending." : session?.access.reason ?? "Read-only Outreach inspection."}</span>}
        actions={<>{headerRecoveryAction}<Link className="ry-button ry-button-secondary" to="/outreach">Back to outreach</Link></>}
      />
      {!canWrite ? (
        <Alert tone="warning" title="Read-only Outreach context">
          You may inspect permitted messages, but cannot request approval, approve, queue, confirm, or classify in this session.
        </Alert>
      ) : null}
      {actionError ? <ReviewErrorSummary message={actionError} conflict={conflict} onReload={() => { void load(); setConflict(false); setActionError(""); }} /> : null}

      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Outreach relationship views" baseId={tabBaseId} />
      <RelationshipDetailLayout context={(
        <ContextRail
          title="Outreach status"
          className="ry-outreach-status-rail"
          triggerLabel="Review status"
          open={contextOpen}
          onOpen={() => setContextOpen(true)}
          onClose={() => setContextOpen(false)}
        >
          {contextContent}
        </ContextRail>
      )}>
        <RelationshipTabPanel id={tabBaseId} tabId="message" active={activeTab === "message"}>
          <RelationshipSection title="Message details" description="Recipient, sender, content, claims, attachments, channel, and timing are reviewed together.">
            <dl className="ry-relationship-facts ry-outreach-facts">
              <div><dt>Recipient</dt><dd title={recipientTitle}>{recipientLabel}</dd></div>
              <div><dt>Sender</dt><dd title={senderTitle}>{senderLabel}</dd></div>
              <div><dt>Channel</dt><dd>{readable(channel)}</dd></div>
              <div><dt>Timing</dt><dd>{shown(message.scheduledAt, "Immediate after approval")}</dd></div>
              <div><dt>Version</dt><dd>{shown(message.version)}</dd></div>
            </dl>
            <details className="ry-outreach-technical-details">
              <summary>View technical details</summary>
              <dl className="ry-relationship-facts ry-outreach-facts">
                <div><dt>Digest</dt><dd><code className="ry-outreach-digest">{detail.digest}</code></dd></div>
              </dl>
            </details>
            <h3 className="ry-outreach-body-heading">Message body</h3>
            <pre className="ry-outreach-message-preview">{body || "No body recorded."}</pre>
          </RelationshipSection>
          <RelationshipSection title="Evidence-linked claims" description="Claims that need evidence appear here before approval.">
            {claims.length === 0 ? (
              <EmptyState
                compact
                className="ry-outreach-empty-state"
                description="No claims recorded."
              />
            ) : (
              <ul className="ry-relationship-evidence-list">
                {claims.map((item) => (
                  <li key={shown(item.id)}>
                    <StatusLabel value={shown(item.status)} />
                    <strong>{shown(item.claimText)}</strong>
                    <small>{shown(item.evidenceId, "Evidence not linked")}</small>
                  </li>
                ))}
              </ul>
            )}
          </RelationshipSection>
          <RelationshipSection title="Attachments" description="Only clean immutable documents may attach to this message.">
            {attachments.length === 0 ? (
              <EmptyState
                compact
                className="ry-outreach-empty-state"
                description="No attachments yet."
              />
            ) : (
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
          <RelationshipSection title="Contact & permission" description="Confirm who receives this message and whether contact is permitted.">
            <dl className="ry-relationship-facts ry-outreach-facts">
              <div><dt>Recipient</dt><dd title={recipientTitle}>{recipientLabel}</dd></div>
              <div><dt>Contact</dt><dd>{contactId !== "—" ? <Link to={`/contacts/${contactId}`}>{contactName}</Link> : contactName}</dd></div>
              <div><dt>Business</dt><dd>{businessId !== "—" ? <Link to={`/buyers/${businessId}`}>{businessName}</Link> : businessName}</dd></div>
              <div><dt>Email on contact</dt><dd title={displayAddressTitle(contact?.email)}>{displayAddress(contact?.email, "Not recorded")}</dd></div>
            </dl>
            <div className="ry-outreach-permission-actions">
              <div className="ry-outreach-permission-action">
                <div className="ry-outreach-permission-action-copy">
                  <strong>Email permission</strong>
                  <span>{permissionStatusLabel}</span>
                </div>
                {!permissionReady && contactId !== "—" ? (
                  <Link to={`/contacts/${contactId}`}>Review contact →</Link>
                ) : null}
              </div>
              <div className="ry-outreach-permission-action">
                <div className="ry-outreach-permission-action-copy">
                  <strong>Email verification</strong>
                  <span>{verificationStatusLabel}</span>
                </div>
                {!verificationReady && contactId !== "—" ? (
                  <Link to={`/contacts/${contactId}`}>Verify contact →</Link>
                ) : null}
              </div>
            </div>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="placement" active={activeTab === "placement"}>
          <RelationshipSection title="Placement context" description="Linked placement and agreement context for this outreach.">
            <dl className="ry-relationship-facts ry-outreach-facts">
              <div><dt>Placement</dt><dd>{placementId !== "—" ? <Link to={`/placements/${placementId}`}>{brandName} → {businessName}</Link> : "Not linked"}</dd></div>
              <div><dt>Placement stage</dt><dd>{readable(shown(placement?.placement.stage, "unknown"))}</dd></div>
              <div><dt>Brand</dt><dd>{brandId !== "—" ? <Link to={`/brands/${brandId}`}>{brandName}</Link> : brandName}</dd></div>
              <div><dt>Agreement</dt><dd>{agreementId !== "—" ? <Link to={`/agreements/${agreementId}`}>Open agreement</Link> : "Not linked"}</dd></div>
              <div><dt>Products</dt><dd>{productIds.length || "None recorded"}</dd></div>
              <div><dt>Authority channel</dt><dd>{readable(shown(field(message, "authorityChannel", "authority_channel"), "Not recorded"))}</dd></div>
            </dl>
          </RelationshipSection>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="review" active={activeTab === "review"}>
          <div id="outreach-review" className="ry-outreach-review">
            <RelationshipSection
              title="Approval & send"
              description="See what is complete, what needs attention, and what to do before approving or sending."
            >
              {lastOutcome ? (
                <ReviewOutcome
                  title="Outreach action recorded"
                  status={status}
                  consequence={lastOutcome}
                />
              ) : null}

              <dl className="ry-outreach-review-stages">
                <div>
                  <dt>Current status</dt>
                  <dd>{readable(status)}</dd>
                </div>
                <div>
                  <dt>Next step</dt>
                  <dd>
                    {status === "draft"
                      ? "Request approval"
                      : status === "approval_requested"
                        ? "Approve message"
                        : status === "approved" && channel === "email"
                          ? "Queue message"
                          : status === "approved" && channel === "social"
                            ? "Confirm send"
                            : sendComplete
                              ? "Complete"
                              : "Review message"}
                  </dd>
                </div>
              </dl>

              <div className="ry-outreach-before-approving">
                <h3>Before approving</h3>
                <ul className="ry-outreach-review-checks">
                  {reviewChecks.map((item) => {
                    const rowBody = (
                      <>
                        <span className="ry-outreach-review-check-mark" aria-hidden="true">{item.ok ? "✓" : "–"}</span>
                        <span className="ry-outreach-review-check-label">
                          <span className="ry-outreach-review-check-name">{item.name}</span>
                          <span className="ry-outreach-review-check-sep" aria-hidden="true"> — </span>
                          <span className="ry-outreach-review-check-status">{item.status}</span>
                        </span>
                        {!item.ok && item.linkLabel ? (
                          <span className="ry-outreach-review-link">{item.linkLabel}</span>
                        ) : null}
                      </>
                    );
                    return (
                      <li key={item.id} data-state={item.ok ? "complete" : "incomplete"}>
                        {!item.ok && item.link ? (
                          <Link className="ry-outreach-review-check-row" to={item.link}>{rowBody}</Link>
                        ) : rowBody}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="ry-outreach-review-preview">
                <h3>Message under review</h3>
                <pre className="ry-outreach-message-preview" title={recipientTitle || senderTitle}>{`To: ${recipientLabel}\nFrom: ${senderLabel}\nChannel: ${channel}\nSubject: ${subjectLabel}\n\n${body}`}</pre>
                <details className="ry-outreach-technical-details">
                  <summary>View technical details</summary>
                  <p className="ry-outreach-technical-copy">Digest <code className="ry-outreach-digest">{detail.digest}</code> · version {shown(message.version)}</p>
                </details>
              </div>

              <div className="ry-outreach-review-actions-block">
                <h3>Review and continue</h3>
                <p className="ry-outreach-review-hint">
                  Approval does not send. Queueing rechecks permission and content before delivery.
                </p>
                <div className="ry-outreach-header-actions ry-outreach-review-actions">
                  {reviewTabAction}
                  {sendComplete ? (
                    <p className="ry-outreach-review-complete">This message has already moved past approval.</p>
                  ) : null}
                </div>
              </div>
            </RelationshipSection>
          </div>
        </RelationshipTabPanel>

        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection title="Outreach activity" description="Stored status, claims, and timing for this message.">
            {activityEntries.length ? (
              <ActivityTimeline entries={activityEntries} label="Outreach activity" />
            ) : (
              <EmptyState
                compact
                className="ry-outreach-empty-state"
                title="No activity yet"
                description="Status changes, claims, and timing will appear here."
              />
            )}
          </RelationshipSection>
        </RelationshipTabPanel>

        {isReplyState ? (
          <RelationshipTabPanel id={tabBaseId} tabId="response" active={activeTab === "response"}>
            <RelationshipSection title="Classify the buyer response" description="A reply does not create an order or commercial outcome.">
              <form className="ry-outreach-call-form" onSubmit={(event) => void classifyResponse(event)}>
                <Field label="Response">
                  <Select value={classification} onChange={(event) => setClassification(event.target.value)} disabled={!canWrite}>
                    {responseClassifications.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </Field>
                <Field label="Response notes">
                  <TextArea required value={responseNotes} onChange={(event) => setResponseNotes(event.target.value)} disabled={!canWrite} />
                </Field>
                <Button type="submit" loading={saving} disabled={!canWrite}>{saving ? "Recording…" : "Record classification"}</Button>
              </form>
            </RelationshipSection>
          </RelationshipTabPanel>
        ) : null}
      </RelationshipDetailLayout>

      <StickyMobileAction>
        {mobileAction}
      </StickyMobileAction>

      <ConfirmationDialog
        open={confirmationOpen}
        title={confirmationCopy.title}
        description={confirmationCopy.description}
        consequence={<>
          <strong>Message</strong>
          <p title={recipientTitle}>Recipient {recipientLabel} · {readable(channel)}</p>
          <p title={displayNameTitle(message.subject)}>Subject: {subjectLabel}</p>
          <details className="ry-outreach-technical-details">
            <summary>View technical details</summary>
            <p>Digest <code className="ry-outreach-digest">{detail.digest}</code> · version {shown(message.version)}</p>
          </details>
        </>}
        confirmLabel={confirmationCopy.confirmLabel}
        processing={saving}
        onClose={() => { setConfirmationOpen(false); setPendingAction(null); }}
        onConfirm={() => void confirmPending()}
      />
    </div>
  );
}
