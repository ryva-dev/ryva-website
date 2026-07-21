import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  ActivityTimeline,
  Alert,
  Button,
  Drawer,
  EmptyState,
  ErrorState,
  EvidenceLabel,
  Field,
  IdentityHeader,
  Input,
  LoadingState,
  Select,
  StatusLabel,
  TextArea
} from "../../design-system";
import {
  ContextRail,
  RelationshipDetailLayout,
  RelationshipSection,
  RelationshipTabPanel,
  RelationshipTabs,
  RelationshipTrail,
  StickyMobileAction,
  type RelationshipTab
} from "../relationship/RelationshipDetail";
import {
  canonicalContactPaths,
  date,
  dateTime,
  dateTimeInput,
  shown,
  type ContactCompatibility,
  type ContactRow
} from "./utils";
import "./contact.css";

type Source = { id: string; reference: string; status?: string };
type ContactContext = {
  record: ContactRow;
  related: ContactRow[];
  evidence: ContactRow[];
  notes: ContactRow[];
  tasks: ContactRow[];
  documents: ContactRow[];
  activities: ContactRow[];
};

export function ContactDetailPage({
  compatibility = canonicalContactPaths
}: {
  compatibility?: ContactCompatibility;
}) {
  const id = useParams().id ?? "";
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const tabBaseId = `contact-${useId().replaceAll(":", "")}`;
  const [context, setContext] = useState<ContactContext | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [notes, setNotes] = useState("");
  const [observedAt, setObservedAt] = useState(dateTimeInput());
  const [activeTab, setActiveTab] = useState("overview");
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [note, setNote] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setLoadError("");
    try {
      const [record, sourceList] = await Promise.all([
        api<ContactContext>(`/api/records/contact/${id}`),
        api<{ sources: Source[] }>("/api/sources")
      ]);
      setContext(record);
      setSources(sourceList.sources);
      setSourceId((current) => current || shown(record.record.sourceId, ""));
      setNotes((current) => current || shown(record.record.verificationNotes, ""));
      if (typeof record.record.sourceObservedAt === "string" && record.record.sourceObservedAt) {
        setObservedAt(dateTimeInput(record.record.sourceObservedAt));
      }
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "Contact could not be loaded.");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!context || !canWrite) return;
    setSaving(true);
    setActionError("");
    setStatusMessage("");
    try {
      await api(`/api/contacts/${id}/verification`, {
        method: "PATCH",
        body: { version: context.record.version, status: "verified", sourceId, observedAt: new Date(observedAt).toISOString(), notes }
      });
      await load({ silent: true });
      setVerificationOpen(false);
      setStatusMessage("Professional route verification was recorded.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Contact could not be verified.");
    } finally {
      setSaving(false);
    }
  }

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!context || !canWrite) return;
    const tabWhenStarted = activeTab;
    setSaving(true);
    setActionError("");
    setStatusMessage("");
    try {
      await api(`/api/records/contact/${id}/notes`, {
        method: "POST",
        body: { body: note, noteType: "general", pinned: false }
      });
      setNote("");
      await load({ silent: true });
      setNoteOpen(false);
      setActiveTab((current) => (current !== tabWhenStarted && current !== "activity" ? current : "activity"));
      setStatusMessage("Contact note was recorded.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Contact note could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const loadingTrail = (
    <RelationshipTrail
      items={[
        { label: "Contacts", to: compatibility.registerPath },
        { label: loading ? "Loading Contact" : "Contact unavailable" }
      ]}
    />
  );

  if (!context && loading) {
    return (
      <div className="page ry-relationship-page ry-contact-page">
        {loadingTrail}
        <IdentityHeader eyebrow="Contact relationship" title="Loading Contact" status={<StatusLabel value="loading" />} />
        <LoadingState label="Loading Contact relationship" />
      </div>
    );
  }

  if (!context) {
    return (
      <div className="page ry-relationship-page ry-contact-page">
        {loadingTrail}
        <IdentityHeader eyebrow="Contact relationship" title="Contact unavailable" />
        <ErrorState message={loadError} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      </div>
    );
  }

  const record = context.record;
  const parent = context.related[0];
  const parentType = shown(parent?.type, record.brandId ? "brand" : "business");
  const parentPath = parent ? (parentType === "brand" ? `/brands/${parent.id}` : `/buyers/${parent.id}`) : undefined;
  const professionalRoute = shown(record.email, shown(record.phone, shown(record.professionalHandle, "")));
  const hasProfessionalRoute = Boolean(professionalRoute);
  const activeSources = sources.filter((source) => !source.status || source.status === "active");
  const selectedSource = sources.find((source) => source.id === record.sourceId);
  const verificationStatus = shown(record.verificationStatus, "unverified");
  const permissionStatus = shown(record.permissionStatus, "unknown");
  const externallyBlocked = ["prohibited", "opted_out"].includes(permissionStatus);
  const canVerify = Boolean(canWrite && hasProfessionalRoute && activeSources.length > 0);
  const openTaskCount = context.tasks.filter((task) => task.status !== "completed").length;
  const activityEntries = [
    ...(record.lastVerifiedAt ? [{
      id: "current-verification",
      title: "Current professional route verification",
      description: shown(record.verificationNotes, "Human verification is recorded without additional notes."),
      meta: `${dateTime(record.lastVerifiedAt)} · ${selectedSource?.reference ?? "Source reference unavailable"}`,
      status: <StatusLabel value={verificationStatus} />
    }] : []),
    ...context.activities.map((activity) => ({
      id: activity.id,
      title: shown(activity.summary, shown(activity.activityType, "Contact activity")),
      description: shown(activity.activityType, "activity").replaceAll("_", " "),
      meta: typeof activity.occurredAt === "string" ? new Date(activity.occurredAt).toLocaleString() : "Time not recorded",
      status: <StatusLabel value={shown(activity.status, "completed")} />
    }))
  ];
  const tabs: RelationshipTab[] = [
    { id: "overview", label: "Overview" },
    { id: "activity", label: "Activity", count: activityEntries.length },
    { id: "evidence", label: "Evidence", count: context.evidence.length + (record.sourceId ? 1 : 0) }
  ];
  const primaryAction = canWrite ? (
    <Button disabled={!canVerify} onClick={() => { setActionError(""); setVerificationOpen(true); }}>
      {verificationStatus === "verified" ? "Refresh verification" : "Verify professional route"}
    </Button>
  ) : <Button disabled>Read-only access</Button>;
  const contextContent = (
    <>
      <div className="ry-context-item">
        <strong>Next action</strong>
        <p>{!canWrite ? "Verification changes are unavailable in this session." : !hasProfessionalRoute ? "Record a professional route before verification." : activeSources.length === 0 ? "Register an active Source before verification." : verificationStatus === "verified" ? "Refresh the route when its source becomes stale." : "Complete human verification with an active Source."}</p>
        {activeSources.length === 0 && canWrite ? <Link to="/sources">Open Sources</Link> : null}
      </div>
      <div className="ry-context-item">
        <strong>Verification freshness</strong>
        <StatusLabel value={verificationStatus} />
        <small>{record.lastVerifiedAt ? `Last verified ${dateTime(record.lastVerifiedAt)}` : "No completed human verification"}</small>
      </div>
      <div className="ry-context-item">
        <strong>Permission and suppression</strong>
        <StatusLabel value={permissionStatus} />
        <small>{externallyBlocked ? "External contact is blocked by the stored permission state." : "Channel suppression must still be checked by the Outreach validator."}</small>
      </div>
      {parent && parentType === "business" && parentPath ? (
        <div className="ry-context-item">
          <strong>Associated Business</strong>
          <Link to={parentPath}>{parent.name}</Link>
          <small>Business organization — not a Buyer profile. Purchasing authority is recorded on the Business.</small>
        </div>
      ) : null}
      <div className="ry-context-item">
        <strong>Representation authority</strong>
        <StatusLabel value="not_established" label="Not established here" />
        <small>A Contact record never establishes Brand, Product, territory, channel, or Buyer Outreach authority.</small>
      </div>
      <div className="ry-context-item">
        <strong>Open work</strong>
        <p>{openTaskCount} open Tasks</p>
        <small>{context.documents.length} linked Documents</small>
      </div>
    </>
  );

  return (
    <div className="page ry-relationship-page ry-contact-page">
      <RelationshipTrail items={[
        { label: "Contacts", to: compatibility.registerPath },
        ...(parent && parentPath ? [{ label: parent.name, to: parentPath }] : []),
        { label: record.name }
      ]} />
      {compatibility.showCompatibilityNotice ? (
        <Alert title="Generic Contact detail compatibility">This route reuses the canonical Contact relationship workspace.</Alert>
      ) : null}
      <IdentityHeader
        eyebrow="Buyer Intelligence · Human verification"
        title={record.name}
        relationship={<span className="ry-relationship-identity-meta"><span>{shown(record.role, "Role not recorded")}</span>{parent && parentPath ? <Link to={parentPath}>{parent.name}</Link> : <span>Parent relationship unavailable</span>}<span>{professionalRoute || "Professional route missing"}</span></span>}
        status={<StatusLabel value={verificationStatus} />}
        warning={!hasProfessionalRoute ? <Alert tone="warning" title="Professional route missing">Verification requires an email, phone number, or professional handle.</Alert> : externallyBlocked ? <Alert tone="danger" title="External contact blocked">The stored permission status blocks external contact. Verification does not override suppression.</Alert> : undefined}
        nextAction={<span>{canVerify ? (verificationStatus === "verified" ? "Refresh this route when its evidence changes." : "Complete human verification against an active Source.") : !canWrite ? session?.access.reason : activeSources.length === 0 ? "Register an active Source before verification." : "Record a professional route before verification."}</span>}
        actions={<>{primaryAction}<Button variant="secondary" disabled={!canWrite} onClick={() => { setActionError(""); setNoteOpen(true); }}>Add note</Button></>}
      />
      {statusMessage ? <p className="ry-relationship-status" role="status">{statusMessage}</p> : null}
      {!canWrite ? <Alert tone="warning" title="Read-only relationship context">You may inspect permitted Contact context and history, but cannot verify the route or add notes in this session.</Alert> : null}
      <RelationshipTabs tabs={tabs} active={activeTab} onChange={setActiveTab} label="Contact relationship views" baseId={tabBaseId} />
      <RelationshipDetailLayout context={<ContextRail title="Contact context" open={contextOpen} onOpen={() => setContextOpen(true)} onClose={() => setContextOpen(false)}>{contextContent}</ContextRail>}>
        <RelationshipTabPanel id={tabBaseId} tabId="overview" active={activeTab === "overview"}>
          <RelationshipSection title="Call preparation" description="Operational context for professional contact without Buyer purchasing authority.">
            <div className="ry-contact-call-prep">
              <dl className="ry-relationship-facts">
                <div>
                  <dt>Professional route</dt>
                  <dd>
                    {record.email ? <a href={`mailto:${shown(record.email)}`}>{shown(record.email)}</a> : null}
                    {record.email && record.phone ? " · " : null}
                    {record.phone ? <a href={`tel:${shown(record.phone)}`}>{shown(record.phone)}</a> : null}
                    {!record.email && !record.phone ? (record.professionalHandle ? shown(record.professionalHandle) : "Not recorded") : null}
                  </dd>
                </div>
                <div>
                  <dt>Verification freshness</dt>
                  <dd><StatusLabel value={verificationStatus} />{record.lastVerifiedAt ? <small> · Last verified {dateTime(record.lastVerifiedAt)}</small> : null}</dd>
                </div>
                <div>
                  <dt>Permission and suppression</dt>
                  <dd><StatusLabel value={permissionStatus} /></dd>
                </div>
                <div>
                  <dt>Parent Business</dt>
                  <dd>{parent && parentType === "business" && parentPath ? <Link to={parentPath}>{parent.name}</Link> : parent && parentPath ? <Link to={parentPath}>{parent.name}</Link> : "Unavailable"}</dd>
                </div>
                <div>
                  <dt>Open tasks</dt>
                  <dd>{openTaskCount}</dd>
                </div>
              </dl>
              <p>Verification and the stored role do not create Buyer purchasing authority.</p>
            </div>
          </RelationshipSection>
          <RelationshipSection title="Professional identity" description="The stored route and parent relationship; this is not proof of Buyer authority.">
            <dl className="ry-relationship-facts">
              <div><dt>Role</dt><dd>{shown(record.role, "Not recorded")}</dd></div>
              <div><dt>Parent relationship</dt><dd>{parent && parentPath ? <Link to={parentPath}>{parent.name}</Link> : "Unavailable"}</dd></div>
              <div><dt>Email</dt><dd>{record.email ? <a href={`mailto:${shown(record.email)}`}>{shown(record.email)}</a> : "Not recorded"}</dd></div>
              <div><dt>Phone</dt><dd>{record.phone ? <a href={`tel:${shown(record.phone)}`}>{shown(record.phone)}</a> : "Not recorded"}</dd></div>
              <div><dt>Professional handle</dt><dd>{shown(record.professionalHandle, "Not recorded")}</dd></div>
              <div><dt>Owner</dt><dd>{record.ownerUserId === session?.user.id ? "You" : "Workspace member"}</dd></div>
            </dl>
          </RelationshipSection>
          {parentType === "business" && parentPath ? (
            <RelationshipSection title="Associated Business" description="The Business organization this Contact belongs to.">
              <p><Link to={parentPath}>{parent?.name}</Link> — Business organization (not Buyer).</p>
              <p>Buyer roles and purchasing authority are recorded on the associated Business, not on this Contact.</p>
            </RelationshipSection>
          ) : parentPath ? (
            <RelationshipSection title="Buyer authority boundary" description="Contact verification does not establish Buyer purchasing authority.">
              <p>Buyer roles and purchasing authority are recorded on the associated Business, not on this Contact.{parent ? <> See <Link to={parentPath}>{parent.name}</Link>.</> : null}</p>
            </RelationshipSection>
          ) : null}
          <RelationshipSection title="Verification record" description="A human-owned freshness check linked to one active Source.">
            <dl className="ry-relationship-facts">
              <div><dt>Status</dt><dd><StatusLabel value={verificationStatus} /></dd></div>
              <div><dt>Source</dt><dd>{selectedSource?.reference ?? (record.sourceId ? "Source reference unavailable" : "No Source linked")}</dd></div>
              <div><dt>Source observed</dt><dd>{record.sourceObservedAt ? <time dateTime={shown(record.sourceObservedAt)}>{dateTime(record.sourceObservedAt)}</time> : "Not recorded"}</dd></div>
              <div><dt>Last verified</dt><dd>{record.lastVerifiedAt ? <time dateTime={shown(record.lastVerifiedAt)}>{dateTime(record.lastVerifiedAt)}</time> : "Not verified"}</dd></div>
            </dl>
            {record.verificationNotes ? <p>{shown(record.verificationNotes)}</p> : null}
          </RelationshipSection>
        </RelationshipTabPanel>
        <RelationshipTabPanel id={tabBaseId} tabId="activity" active={activeTab === "activity"}>
          <RelationshipSection title="Relationship activity" description="Recorded Contact activity in newest-first order.">
            <ActivityTimeline entries={activityEntries} empty="No Contact activity has been recorded." label={`${record.name} activity timeline`} />
          </RelationshipSection>
          <RelationshipSection title="Notes" description="Human-authored context remains separate from evidence and verification.">
            {context.notes.length ? <ul className="ry-relationship-evidence-list">{context.notes.map((item) => <li key={item.id}><strong>{shown(item.body)}</strong><small>{typeof item.createdAt === "string" ? new Date(item.createdAt).toLocaleString() : "Time not recorded"}</small></li>)}</ul> : <EmptyState compact description="No Contact notes have been recorded." action={canWrite ? <Button variant="secondary" onClick={() => setNoteOpen(true)}>Add note</Button> : undefined} />}
          </RelationshipSection>
        </RelationshipTabPanel>
        <RelationshipTabPanel id={tabBaseId} tabId="evidence" active={activeTab === "evidence"}>
          <RelationshipSection title="Verification Source" description="The Source supports route freshness only; it does not establish Buyer or representation authority.">
            {selectedSource ? <div className="ry-context-item"><strong>{selectedSource.reference}</strong><EvidenceLabel value="direct_evidence" freshness={record.sourceObservedAt ? `Observed ${date(record.sourceObservedAt)}` : "Observation date missing"} /></div> : <EmptyState compact description="No active verification Source is linked to this Contact." action={canWrite ? <Link className="secondary-button" to="/sources">Open Sources</Link> : undefined} />}
          </RelationshipSection>
          <RelationshipSection title="Connected evidence" description="Claims recorded against this Contact remain classified and reviewable.">
            {context.evidence.length ? <ul className="ry-relationship-evidence-list">{context.evidence.map((item) => <li key={item.id}><strong>{shown(item.exactClaim ?? item.exact_claim, "Evidence claim")}</strong><EvidenceLabel value={shown(item.evidenceClass ?? item.evidence_class, "unknown")} confidence={shown(item.confidence, "insufficient")} /><small>{shown(item.sourceReference ?? item.source_reference, "Source unavailable")}</small></li>)}</ul> : <EmptyState compact description="No additional Contact evidence has been recorded." />}
          </RelationshipSection>
        </RelationshipTabPanel>
        <StickyMobileAction>{primaryAction}</StickyMobileAction>
      </RelationshipDetailLayout>

      <Drawer open={verificationOpen} title={verificationStatus === "verified" ? "Refresh professional route" : "Verify professional route"} description="Human verification must name an active Source, observation time, and exact notes." onClose={() => setVerificationOpen(false)}>
        <form onSubmit={(event) => void verify(event)}>
          <Alert title="Verification boundary">This action verifies the professional route and freshness only. It does not approve Buyer authority or external Outreach.</Alert>
          {actionError ? <ErrorState message={actionError} /> : null}
          <Field label="Verification Source" required><Select required value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Select an active Source</option>{activeSources.map((item) => <option key={item.id} value={item.id}>{item.reference}</option>)}</Select></Field>
          <Field label="Source observed at" required><Input type="datetime-local" required value={observedAt} onChange={(event) => setObservedAt(event.target.value)} /></Field>
          <Field label="Human verification notes" required hint="Record what you checked and what this Source does not establish."><TextArea required rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
          <Button type="submit" loading={saving}>Record human verification</Button>
        </form>
      </Drawer>

      <Drawer open={noteOpen} title="Add Contact note" description="Record professional context without presenting it as evidence or authority." onClose={() => setNoteOpen(false)} size="narrow">
        <form onSubmit={(event) => void addNote(event)}>
          {actionError ? <ErrorState message={actionError} /> : null}
          <Field label="Contact note" required><TextArea required rows={6} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
          <Button type="submit" loading={saving}>Save note</Button>
        </form>
      </Drawer>
    </div>
  );
}
