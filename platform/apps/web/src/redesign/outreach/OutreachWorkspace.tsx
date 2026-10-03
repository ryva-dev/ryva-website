import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  DataRow,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Input,
  LoadingState,
  PageHeader,
  SearchInput,
  Select,
  StatusLabel,
  Table,
  TextArea
} from "../../design-system";
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
} from "../register/Register";
import { displayBrandName } from "../brand/utils";
import {
  dateTime,
  displayAddress,
  displayAddressTitle,
  displayName,
  displayNameTitle,
  field,
  messageStatus,
  messageStatusTone,
  placementReadyStages,
  readable,
  shown,
  splitIds,
  type Row
} from "./utils";

type Placement = Row & { businessId?: string; business_id?: string };

const ACTIVITY_PAGE_SIZE = 10;

function recordBusinessId(record: Record<string, unknown> | null | undefined): string {
  if (!record) return "";
  const value = shown(field(record, "businessId", "business_id"), "");
  return value === "—" ? "" : value;
}

const initialFilters: RegisterFilterValue = {
  query: "",
  status: "",
  channel: ""
};

const columnOptions = [
  { id: "buyer", label: "Buyer", required: true },
  { id: "channel", label: "Channel" },
  { id: "subject", label: "Subject" },
  { id: "status", label: "Status", required: true }
];

function activityLabel(kind: unknown): string {
  const value = shown(kind, "activity");
  if (value === "task") return "Task";
  if (value === "note") return "Note";
  if (value === "outreach_message" || value === "message") return "Message";
  if (value === "call") return "Call";
  return readable(value);
}

export function OutreachWorkspacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [messages, setMessages] = useState<Row[]>([]);
  const [history, setHistory] = useState<Row[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [contacts, setContacts] = useState<Row[]>([]);
  const [templates, setTemplates] = useState<Row[]>([]);
  const [placementId, setPlacementId] = useState(searchParams.get("placementId") ?? "");
  const [placementProducts, setPlacementProducts] = useState<string[]>([]);
  const [contactId, setContactId] = useState("");
  const [channel, setChannel] = useState<"email" | "social">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [claimText, setClaimText] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [attachmentIds, setAttachmentIds] = useState("");
  const [templateVersionId, setTemplateVersionId] = useState("");
  const [senderAddress, setSenderAddress] = useState(session?.user.email ?? "");
  const [callObjective, setCallObjective] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [callOpen, setCallOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "buyer", direction: "asc" });
  const [visibleColumns, setVisibleColumns] = useState(new Set(columnOptions.map((column) => column.id)));
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [claimsOpen, setClaimsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [outreach, activity, placementPayload, contactPayload, templatePayload, configuration] = await Promise.all([
        api<{ messages: Row[] }>("/api/outreach"),
        api<{ history: Row[] }>("/api/outreach/history"),
        api<{ placements: Placement[] }>("/api/placements"),
        api<{ records: Row[] }>("/api/records/contact?limit=100"),
        api<{ templates: Row[] }>("/api/outreach/templates"),
        api<{ senderAddress: string; providerConfigured: boolean }>("/api/outreach/config")
      ]);
      setMessages(outreach.messages);
      setHistory(activity.history);
      setActivityPage(1);
      setPlacements(placementPayload.placements);
      setContacts(contactPayload.records);
      setTemplates(templatePayload.templates);
      setSenderAddress(configuration.senderAddress);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Outreach could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const fromQuery = searchParams.get("placementId");
    if (fromQuery) setPlacementId(fromQuery);
  }, [searchParams]);

  useEffect(() => {
    if (!placementId) {
      setPlacementProducts([]);
      setContactId("");
      return;
    }
    void api<{ products: Array<{ productId: string }> }>(`/api/placements/${placementId}`)
      .then((value) => setPlacementProducts(value.products.map((item) => item.productId)))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Placement context could not be loaded."));
  }, [placementId]);

  const selectedPlacement = useMemo(
    () => placements.find((item) => item.id === placementId) ?? null,
    [placements, placementId]
  );
  const placementBusinessId = recordBusinessId(selectedPlacement);
  const placementContacts = useMemo(() => {
    if (!placementBusinessId) return [];
    return contacts.filter((item) => recordBusinessId(item) === placementBusinessId);
  }, [contacts, placementBusinessId]);

  useEffect(() => {
    if (!contactId) return;
    if (!placementContacts.some((item) => item.id === contactId)) setContactId("");
  }, [contactId, placementContacts]);

  const selectedContact = useMemo(
    () => placementContacts.find((item) => item.id === contactId) ?? contacts.find((item) => item.id === contactId),
    [placementContacts, contacts, contactId]
  );

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
  }

  function applyTemplate(id: string) {
    setTemplateVersionId(id);
    const template = templates.find((item) => item.versionId === id);
    if (!template) return;
    setSubject(shown(template.subject, ""));
    setBody(shown(template.body, ""));
    const templateChannel = shown(template.channel);
    if (templateChannel === "email" || templateChannel === "social") setChannel(templateChannel);
  }

  const filteredMessages = useMemo(() => {
    const query = String(filters.query ?? "").trim().toLowerCase();
    return messages.filter((item) => {
      if (filters.status && messageStatus(item) !== filters.status) return false;
      if (filters.channel && shown(item.channel) !== filters.channel) return false;
      if (!query) return true;
      const haystack = `${shown(item.businessName)} ${shown(item.contactName)} ${shown(item.subject)} ${messageStatus(item)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [filters, messages]);

  const sortedMessages = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filteredMessages].sort((left, right) => {
      const value = (item: Row) => {
        if (sort.field === "channel") return shown(item.channel).toLowerCase();
        if (sort.field === "subject") return shown(item.subject).toLowerCase();
        if (sort.field === "status") return messageStatus(item);
        return `${shown(item.businessName)} ${shown(item.contactName)}`.toLowerCase();
      };
      return value(left).localeCompare(value(right)) * direction;
    });
  }, [filteredMessages, sort]);

  const activeFilters = Object.entries(filters)
    .filter(([, value]) => Boolean(value))
    .map(([id, value]) => ({
      id,
      label: `${id === "query" ? "Search" : readable(id)}: ${readable(String(value))}`
    }));

  const needsApproval = messages.filter((item) => item.status === "approval_requested").length;
  const queued = messages.filter((item) => item.status === "queued").length;
  const replies = messages.filter((item) => item.status === "replied" || item.direction === "inbound").length;
  const readyPlacements = placements.filter((item) => (placementReadyStages as readonly string[]).includes(shown(item.stage)));
  const activityPageCount = Math.max(1, Math.ceil(history.length / ACTIVITY_PAGE_SIZE));
  const currentActivityPage = Math.min(activityPage, activityPageCount);
  const pagedHistory = useMemo(
    () => history.slice((currentActivityPage - 1) * ACTIVITY_PAGE_SIZE, currentActivityPage * ACTIVITY_PAGE_SIZE),
    [history, currentActivityPage]
  );

  async function createMessage(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError("");
    try {
      const result = await api<{ message: Row }>("/api/outreach", {
        method: "POST",
        body: {
          placementId,
          contactId,
          channel,
          senderAddress,
          recipientAddress: channel === "email" ? shown(selectedContact?.email, "") : shown(selectedContact?.name, ""),
          subject,
          body,
          productIds: placementProducts,
          claimLinks: claimText ? [{ claimText, productId: placementProducts[0] ?? null, evidenceId: evidenceId || null }] : [],
          attachmentIds: splitIds(attachmentIds),
          templateVersionId: templateVersionId || null
        }
      });
      void navigate(`/outreach/${result.message.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Draft could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function logCall(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/outreach/calls", {
        method: "POST",
        body: {
          placementId,
          contactId,
          status: "completed",
          objective: callObjective,
          preparation: "",
          questions: [],
          objectionGuidance: [],
          authorityLimits: "Do not negotiate or promise binding commercial outcomes.",
          voicemailScript: "",
          notes: callNotes,
          outcome: callOutcome,
          nextActionTitle: "Review call outcome and choose next action",
          nextActionDueAt: new Date(Date.now() + 86_400_000).toISOString()
        }
      });
      setCallObjective("");
      setCallNotes("");
      setCallOutcome("");
      setCallOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Call could not be logged.");
    } finally {
      setSaving(false);
    }
  }

  function scrollToPrepare() {
    document.getElementById("prepare-message")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="page ry-register-page ry-outreach-page">
      <PageHeader
        title="Outreach"
        description="Prepare buyer messages, log calls, and review replies. Approval is required before send."
        action={(
          <div className="ry-outreach-header-actions">
            {canWrite ? (
              <Button variant="secondary" onClick={() => setCallOpen(true)}>Log call</Button>
            ) : (
              <Button disabled>Read-only access</Button>
            )}
            <Link className="ry-button ry-button-secondary" to="/outreach/templates">Templates</Link>
            <Link className="ry-button ry-button-secondary" to="/outreach/sequences">Sequences</Link>
          </div>
        )}
      />
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}
      {!canWrite ? (
        <Alert tone="warning" className="ry-register-policy" title="Read-only Outreach workspace">
          You may inspect Outreach history and drafts, but cannot prepare messages, approve, queue, or log calls in this session.
        </Alert>
      ) : null}

      {loading ? <LoadingState label="Loading outreach work" /> : (
        <>
          <section className="ry-outreach-summary" aria-label="Outreach status summary">
            <p>
              <strong>{needsApproval}</strong> {needsApproval === 1 ? "needs" : "need"} approval
              {" · "}
              <strong>{queued}</strong> queued
              {" · "}
              <strong>{replies}</strong> {replies === 1 ? "reply" : "replies"}
            </p>
            <p className="ry-outreach-summary-note">
              Review drafts waiting for approval, then queue or send when your email provider is ready.
            </p>
          </section>

          <div className="ry-outreach-workspace">
            <section className="ry-outreach-surface ry-outreach-surface-context" aria-label="Activity">
              <header className="ry-outreach-section-heading ry-outreach-section-heading-context">
                <h2>Activity</h2>
                <p>Recent messages, calls, notes, and related work.</p>
              </header>
              {history.length === 0 ? (
                <EmptyState
                  compact
                  className="ry-outreach-empty"
                  title="No activity yet"
                  description="Start from a placement that is ready for outreach."
                  action={<Link className="ry-button ry-button-secondary" to="/placements">Open placements</Link>}
                />
              ) : (
                <>
                  <ul className="ry-outreach-activity-list">
                    {pagedHistory.map((item) => (
                      <li key={`${shown(item.kind)}-${item.id}`}>
                        <div className="ry-outreach-activity-copy">
                          <strong title={displayNameTitle(item.summary)}>{displayName(item.summary)}</strong>
                          <small>{activityLabel(item.kind)} · {dateTime(item.occurredAt)}</small>
                        </div>
                        <StatusLabel value={shown(item.status)} tone={messageStatusTone(shown(item.status))} />
                      </li>
                    ))}
                  </ul>
                  {history.length > ACTIVITY_PAGE_SIZE ? (
                    <RegisterPagination
                      page={currentActivityPage}
                      pageCount={activityPageCount}
                      total={history.length}
                      pageSize={ACTIVITY_PAGE_SIZE}
                      onPage={setActivityPage}
                    />
                  ) : null}
                </>
              )}
            </section>

            <section id="prepare-message" className="ry-outreach-surface ry-outreach-surface-primary" aria-label="Prepare message">
              <header className="ry-outreach-section-heading ry-outreach-section-heading-primary">
                <h2>Prepare message</h2>
                <p>Draft an email or social message for review. Nothing sends from this form.</p>
              </header>
              <form className="ry-outreach-prepare-form" onSubmit={(event) => void createMessage(event)}>
                <div className="ry-outreach-prepare-grid">
                  <Field label="Placement">
                    <Select
                      required
                      controlSize="compact"
                      value={placementId}
                      onChange={(event) => {
                        setPlacementId(event.target.value);
                        setContactId("");
                      }}
                      disabled={!canWrite}
                    >
                      <option value="">Select placement</option>
                      {readyPlacements.map((item) => (
                        <option value={item.id} key={item.id} title={`${displayBrandName(item.brandName)} → ${displayName(item.businessName)}`}>
                          {displayBrandName(item.brandName)} → {displayName(item.businessName)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Buyer contact">
                    <Select
                      required
                      controlSize="compact"
                      value={contactId}
                      onChange={(event) => setContactId(event.target.value)}
                      disabled={!canWrite || !placementId}
                    >
                      <option value="">
                        {!placementId
                          ? "Select a placement first"
                          : placementContacts.length === 0
                            ? "No contacts for this buyer"
                            : "Select contact"}
                      </option>
                      {placementContacts.map((item) => (
                        <option value={item.id} key={item.id} title={displayNameTitle(item.name) ?? displayAddressTitle(item.email)}>
                          {displayName(item.name)}{item.email ? ` · ${displayAddress(item.email)}` : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Channel">
                    <Select
                      controlSize="compact"
                      value={channel}
                      onChange={(event) => {
                        const next = event.target.value as "email" | "social";
                        setChannel(next);
                        const selectedTemplate = templates.find((item) => shown(item.versionId) === templateVersionId);
                        if (selectedTemplate && shown(selectedTemplate.channel) !== next) {
                          setTemplateVersionId("");
                        }
                      }}
                      disabled={!canWrite}
                    >
                      <option value="email">Email</option>
                      <option value="social">Social</option>
                    </Select>
                  </Field>
                  <Field label="From">
                    <Input controlSize="compact" value={senderAddress} disabled />
                  </Field>
                  <Field label="Template" className="ry-outreach-prepare-span">
                    <Select
                      controlSize="compact"
                      value={templateVersionId}
                      onChange={(event) => applyTemplate(event.target.value)}
                      disabled={!canWrite}
                    >
                      <option value="">No template</option>
                      {templates.filter((item) => item.channel === channel).map((item) => (
                        <option key={shown(item.versionId)} value={shown(item.versionId)} title={displayNameTitle(item.name)}>
                          {displayName(item.name)} · v{shown(item.currentVersion)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Subject" className="ry-outreach-prepare-span">
                    <Input controlSize="compact" value={subject} onChange={(event) => setSubject(event.target.value)} disabled={!canWrite} />
                  </Field>
                  <Field label="Message" className="ry-outreach-prepare-span">
                    <TextArea required rows={3} value={body} onChange={(event) => setBody(event.target.value)} disabled={!canWrite} />
                  </Field>
                </div>
                <div className="ry-outreach-prepare-footer">
                  <button
                    type="button"
                    className={`ry-outreach-advanced-toggle${claimsOpen ? " is-open" : ""}`}
                    aria-expanded={claimsOpen}
                    aria-controls="outreach-claims-fields"
                    onClick={() => setClaimsOpen((open) => !open)}
                  >
                    Supporting details & attachments
                  </button>
                  <div className="ry-outreach-prepare-actions">
                    <Button type="submit" loading={saving} disabled={!canWrite || placementProducts.length === 0}>
                      Create draft
                    </Button>
                    {readyPlacements.length === 0 ? (
                      <p className="ry-outreach-prepare-hint">No placements are ready for outreach yet.</p>
                    ) : null}
                  </div>
                  {claimsOpen ? (
                    <div id="outreach-claims-fields" className="ry-outreach-advanced-fields">
                      <Field label="Product claim" hint="Leave blank when you are not stating a product fact.">
                        <Input controlSize="compact" value={claimText} onChange={(event) => setClaimText(event.target.value)} disabled={!canWrite} />
                      </Field>
                      <Field label="Supporting evidence" hint="Optional evidence reference when a claim is included.">
                        <Input controlSize="compact" value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} disabled={!canWrite} />
                      </Field>
                      <Field label="Attachments" hint="Document references, comma-separated.">
                        <Input controlSize="compact" value={attachmentIds} onChange={(event) => setAttachmentIds(event.target.value)} disabled={!canWrite} />
                      </Field>
                    </div>
                  ) : null}
                </div>
              </form>
            </section>
          </div>

          <section className="ry-register-surface" aria-label="Outreach messages">
            <header className="ry-outreach-section-heading">
              <h2>Messages</h2>
              <p>Drafts, approvals, sends, and replies.</p>
            </header>
            <div className="ry-register-commandbar">
              <RegisterSavedViews
                recordType="outreach_message"
                filters={filters}
                sort={sort}
                canWrite={Boolean(canWrite)}
                onApply={(nextFilters, nextSort) => {
                  setFilters({ ...initialFilters, ...nextFilters });
                  setSort(nextSort);
                }}
              />
              <RegisterFilterSheet open={filterOpen} onOpen={() => setFilterOpen(true)} onClose={() => setFilterOpen(false)}>
                <FilterBar>
                  <Field label="Search Buyer or subject">
                    <SearchInput
                      label="Search Buyer or subject"
                      controlSize="compact"
                      value={String(filters.query ?? "")}
                      onChange={(event) => updateFilter("query", event.target.value)}
                      onClear={() => updateFilter("query", "")}
                    />
                  </Field>
                  <Field label="Status">
                    <Select controlSize="compact" value={String(filters.status ?? "")} onChange={(event) => updateFilter("status", event.target.value)}>
                      <option value="">All statuses</option>
                      {["draft", "approval_requested", "approved", "queued", "accepted", "delivered", "replied", "failed", "suppressed"].map((item) => (
                        <option key={item} value={item}>{readable(item)}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Channel">
                    <Select controlSize="compact" value={String(filters.channel ?? "")} onChange={(event) => updateFilter("channel", event.target.value)}>
                      <option value="">All channels</option>
                      <option value="email">Email</option>
                      <option value="social">Social</option>
                    </Select>
                  </Field>
                </FilterBar>
              </RegisterFilterSheet>
            </div>
            <ActiveFilters filters={activeFilters} onClear={(id) => updateFilter(id, "")} onClearAll={() => setFilters(initialFilters)} />
            <div className="ry-register-resultbar">
              <span>{sortedMessages.length} message{sortedMessages.length === 1 ? "" : "s"}</span>
              <RegisterColumnSelector
                columns={columnOptions}
                visible={visibleColumns}
                onChange={(id, shownColumn) => setVisibleColumns((current) => {
                  const next = new Set(current);
                  if (shownColumn) next.add(id);
                  else next.delete(id);
                  return next;
                })}
                density={density}
                onDensityChange={setDensity}
              />
            </div>
            {sortedMessages.length === 0 ? (
              <EmptyState
                compact
                className="ry-outreach-empty"
                title={activeFilters.length ? "No messages match these filters" : undefined}
                description={activeFilters.length
                  ? "Clear one or more filters to return to your messages."
                  : "No drafts, sends, or replies yet."}
                action={activeFilters.length
                  ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button>
                  : (canWrite ? <Button variant="secondary" onClick={scrollToPrepare}>Prepare message</Button> : undefined)}
              />
            ) : (
              <>
                <Table caption="Outreach messages" compact={density === "compact"}>
                  <thead>
                    <tr>
                      {visibleColumns.has("buyer") ? <SortableHeader field="buyer" label="Buyer" sort={sort} onSort={setSort} /> : null}
                      {visibleColumns.has("channel") ? <SortableHeader field="channel" label="Channel" sort={sort} onSort={setSort} /> : null}
                      {visibleColumns.has("subject") ? <SortableHeader field="subject" label="Subject" sort={sort} onSort={setSort} /> : null}
                      {visibleColumns.has("status") ? <SortableHeader field="status" label="Status" sort={sort} onSort={setSort} /> : null}
                      <th scope="col" className="ry-register-cell-actions"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMessages.map((item) => (
                      <DataRow key={item.id}>
                        {visibleColumns.has("buyer") ? (
                          <td>
                            <strong title={displayNameTitle(item.businessName)}>{displayName(item.businessName)}</strong>
                            <small title={displayNameTitle(item.contactName)}>{displayName(item.contactName)}</small>
                          </td>
                        ) : null}
                        {visibleColumns.has("channel") ? <td>{readable(shown(item.channel))}</td> : null}
                        {visibleColumns.has("subject") ? (
                          <td title={displayNameTitle(item.subject)}>{displayName(item.subject, "(no subject)")}</td>
                        ) : null}
                        {visibleColumns.has("status") ? <td><StatusLabel value={messageStatus(item)} tone={messageStatusTone(messageStatus(item))} /></td> : null}
                        <td className="ry-register-cell-actions">
                          <Link className="ry-outreach-open" to={`/outreach/${item.id}`}>
                            Open <span aria-hidden="true">→</span>
                          </Link>
                        </td>
                      </DataRow>
                    ))}
                  </tbody>
                </Table>
                <RegisterMobileList label="Outreach messages">
                  {sortedMessages.map((item) => (
                    <RegisterMobileRow
                      key={item.id}
                      title={`${displayName(item.businessName)} · ${displayName(item.contactName)}`}
                      meta={`${readable(shown(item.channel))} · ${displayName(item.subject, "(no subject)")}`}
                      status={<StatusLabel value={messageStatus(item)} tone={messageStatusTone(messageStatus(item))} />}
                      onOpen={() => void navigate(`/outreach/${item.id}`)}
                      openLabel={`Open ${displayName(item.subject, "message")}`}
                    />
                  ))}
                </RegisterMobileList>
              </>
            )}
          </section>
        </>
      )}

      <Drawer
        open={callOpen}
        title="Log call"
        description="Record a completed call against the selected placement and contact."
        onClose={() => { if (!saving) setCallOpen(false); }}
        size="standard"
      >
        <form className="ry-outreach-call-form" onSubmit={(event) => void logCall(event)}>
          <Field label="Placement">
            <Select
              required
              controlSize="compact"
              value={placementId}
              onChange={(event) => {
                setPlacementId(event.target.value);
                setContactId("");
              }}
              disabled={!canWrite || saving}
            >
              <option value="">Select placement</option>
              {readyPlacements.map((item) => (
                <option value={item.id} key={item.id} title={`${displayBrandName(item.brandName)} → ${displayName(item.businessName)}`}>
                  {displayBrandName(item.brandName)} → {displayName(item.businessName)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Buyer contact">
            <Select
              required
              controlSize="compact"
              value={contactId}
              onChange={(event) => setContactId(event.target.value)}
              disabled={!canWrite || saving || !placementId}
            >
              <option value="">
                {!placementId
                  ? "Select a placement first"
                  : placementContacts.length === 0
                    ? "No contacts for this buyer"
                    : "Select contact"}
              </option>
              {placementContacts.map((item) => (
                <option value={item.id} key={item.id} title={displayNameTitle(item.name) ?? displayAddressTitle(item.email)}>
                  {displayName(item.name)}{item.email ? ` · ${displayAddress(item.email)}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Objective">
            <Input required controlSize="compact" value={callObjective} onChange={(event) => setCallObjective(event.target.value)} disabled={!canWrite || saving} />
          </Field>
          <Field label="Outcome">
            <Input required controlSize="compact" value={callOutcome} onChange={(event) => setCallOutcome(event.target.value)} disabled={!canWrite || saving} />
          </Field>
          <Field label="Notes">
            <TextArea required rows={4} value={callNotes} onChange={(event) => setCallNotes(event.target.value)} disabled={!canWrite || saving} />
          </Field>
          <div className="ry-outreach-call-actions">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setCallOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={!canWrite || !placementId || !contactId}>Save call</Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
