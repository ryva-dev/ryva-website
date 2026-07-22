import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  DataRow,
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
  RegisterSavedViews,
  SortableHeader,
  type RegisterFilterValue,
  type RegisterSort
} from "../register/Register";
import {
  dateTime,
  messageStatus,
  placementReadyStages,
  readable,
  shown,
  splitIds,
  type Row
} from "./utils";

type Placement = Row & { businessId?: string; business_id?: string };

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
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [callObjective, setCallObjective] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [callOutcome, setCallOutcome] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "buyer", direction: "asc" });
  const [visibleColumns, setVisibleColumns] = useState(new Set(columnOptions.map((column) => column.id)));
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [outreach, activity, placementPayload, contactPayload, templatePayload, configuration] = await Promise.all([
        api<{ messages: Row[] }>("/api/outreach"),
        api<{ history: Row[] }>("/api/outreach/history"),
        api<{ placements: Placement[] }>("/api/placements"),
        api<{ records: Row[] }>("/api/records/contact"),
        api<{ templates: Row[] }>("/api/outreach/templates"),
        api<{ senderAddress: string; providerConfigured: boolean }>("/api/outreach/config")
      ]);
      setMessages(outreach.messages);
      setHistory(activity.history);
      setPlacements(placementPayload.placements);
      setContacts(contactPayload.records);
      setTemplates(templatePayload.templates);
      setSenderAddress(configuration.senderAddress);
      setProviderConfigured(configuration.providerConfigured);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Outreach Center could not be loaded.");
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
      return;
    }
    void api<{ products: Array<{ productId: string }> }>(`/api/placements/${placementId}`)
      .then((value) => setPlacementProducts(value.products.map((item) => item.productId)))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Placement context could not be loaded."));
  }, [placementId]);

  const selectedContact = useMemo(
    () => contacts.find((item) => item.id === contactId),
    [contacts, contactId]
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
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Call could not be logged.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page ry-register-page ry-outreach-page">
      <PageHeader
        eyebrow="Outreach Center"
        title="Human-approved communication"
        description="Prepare, approve, send, call, and follow up from one authority-checked history. Ryva never sends or calls autonomously."
        action={(
          <div className="ry-outreach-header-actions">
            <Link className="ry-button ry-button-secondary" to="/outreach/templates">Templates</Link>
            <Link className="ry-button ry-button-secondary" to="/outreach/sequences">Sequences</Link>
          </div>
        )}
      />
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}
      {!canWrite ? (
        <Alert tone="warning" className="ry-register-policy" title="Read-only Outreach workspace">
          You may inspect permitted Outreach history and drafts, but cannot prepare drafts, approve, queue, or log calls in this session.
        </Alert>
      ) : null}

      {loading ? <LoadingState label="Loading outreach work" /> : (
        <>
          <section className="ry-outreach-summary" aria-label="Outreach status summary">
            <p><strong>{needsApproval}</strong> needs approval · <strong>{queued}</strong> queued · <strong>{replies}</strong> replies</p>
            <p className="ry-outreach-summary-note">Counts reflect stored message statuses only. Placement readiness does not authorize Outreach, and queued does not mean delivered.</p>
          </section>
          {!providerConfigured ? (
            <Alert tone="warning" title="Email provider unavailable">
              Drafting, review, calls, notes, and templates remain available. Approved email stays queued until a verified provider and worker are configured.
            </Alert>
          ) : null}

          <div className="ry-outreach-workspace">
            <section className="panel" aria-label="Communication and activity">
              <header className="ry-outreach-section-heading">
                <p className="eyebrow">Unified history</p>
                <h2>Communication and activity</h2>
              </header>
              {history.length === 0 ? (
                <EmptyState description="No outreach activity yet. Start from a prepared Placement with current authority." />
              ) : (
                <div className="record-list">
                  {history.map((item) => (
                    <div className="task-row" key={`${shown(item.kind)}-${item.id}`}>
                      <span>
                        <strong>{shown(item.summary)}</strong>
                        <small>{shown(item.kind)} · {dateTime(item.occurredAt)}</small>
                      </span>
                      <StatusLabel value={shown(item.status)} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel" aria-label="Prepare outreach">
              <header className="ry-outreach-section-heading">
                <p className="eyebrow">Draft</p>
                <h2>Prepare outreach</h2>
              </header>
              <p className="ry-outreach-boundary">A prepared Placement is required context, not permission. Contact verification, permission, suppression, channel, claims, and exact-artifact approval are checked separately by the server.</p>
              <form className="ry-outreach-prepare-form" onSubmit={(event) => void createMessage(event)}>
                <Field label="Prepared Placement">
                  <Select required value={placementId} onChange={(event) => setPlacementId(event.target.value)} disabled={!canWrite}>
                    <option value="">Select Placement</option>
                    {placements.filter((item) => (placementReadyStages as readonly string[]).includes(shown(item.stage))).map((item) => (
                      <option value={item.id} key={item.id}>{shown(item.brandName)} → {shown(item.businessName)} · {shown(item.stage)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Buyer Contact">
                  <Select required value={contactId} onChange={(event) => setContactId(event.target.value)} disabled={!canWrite}>
                    <option value="">Select Contact</option>
                    {contacts.map((item) => (
                      <option value={item.id} key={item.id}>{shown(item.name)} · {shown(item.email, "no email")}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Channel">
                  <Select value={channel} onChange={(event) => setChannel(event.target.value as "email" | "social")} disabled={!canWrite}>
                    <option value="email">Email</option>
                    <option value="social">Social draft</option>
                  </Select>
                </Field>
                <Field label="Verified sender"><Input value={senderAddress} disabled /></Field>
                <Field label="Template">
                  <Select value={templateVersionId} onChange={(event) => applyTemplate(event.target.value)} disabled={!canWrite}>
                    <option value="">No template</option>
                    {templates.filter((item) => item.channel === channel).map((item) => (
                      <option key={shown(item.versionId)} value={shown(item.versionId)}>{shown(item.name)} · v{shown(item.currentVersion)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Subject"><Input value={subject} onChange={(event) => setSubject(event.target.value)} disabled={!canWrite} /></Field>
                <Field label="Material claim" hint="Leave blank when no factual claim is made. Unsupported claims block approval.">
                  <Input value={claimText} onChange={(event) => setClaimText(event.target.value)} disabled={!canWrite} />
                </Field>
                <Field label="Evidence ID"><Input value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} disabled={!canWrite} /></Field>
                <Field label="Clean attachment IDs" hint="Comma-separated immutable Document IDs.">
                  <Input value={attachmentIds} onChange={(event) => setAttachmentIds(event.target.value)} disabled={!canWrite} />
                </Field>
                <Field label="Exact body"><TextArea required rows={9} value={body} onChange={(event) => setBody(event.target.value)} disabled={!canWrite} /></Field>
                <Button type="submit" loading={saving} disabled={!canWrite || placementProducts.length === 0}>{saving ? "Creating…" : "Create reviewable draft"}</Button>
              </form>
            </section>
          </div>

          <section className="panel" aria-label="Log a call">
            <header className="ry-outreach-section-heading">
              <p className="eyebrow">Human call workflow</p>
              <h2>Log a call</h2>
            </header>
            <form className="ry-outreach-call-form" onSubmit={(event) => void logCall(event)}>
              <Field label="Objective"><Input required value={callObjective} onChange={(event) => setCallObjective(event.target.value)} disabled={!canWrite} /></Field>
              <Field label="Outcome"><Input required value={callOutcome} onChange={(event) => setCallOutcome(event.target.value)} disabled={!canWrite} /></Field>
              <Field label="Notes"><TextArea required value={callNotes} onChange={(event) => setCallNotes(event.target.value)} disabled={!canWrite} /></Field>
              <Button type="submit" loading={saving} disabled={!canWrite || !placementId || !contactId}>Log human-placed call</Button>
            </form>
          </section>

          <section className="ry-register-surface" aria-label="Outreach messages">
            <header className="ry-outreach-section-heading">
              <p className="eyebrow">Exact artifacts</p>
              <h2>Messages</h2>
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
                    <SearchInput label="Search Buyer or subject" controlSize="compact" value={String(filters.query ?? "")} onChange={(event) => updateFilter("query", event.target.value)} onClear={() => updateFilter("query", "")} />
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
                title={activeFilters.length ? "No messages match these filters" : undefined}
                description={activeFilters.length ? "Clear one or more filters to return to the Outreach message register." : "No drafts, sends, or replies."}
                action={activeFilters.length ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button> : undefined}
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
                      <th scope="col" className="ry-register-cell-actions"><span className="sr-only">Review</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMessages.map((item) => (
                      <DataRow key={item.id}>
                        {visibleColumns.has("buyer") ? <td><strong>{shown(item.businessName)}</strong><small>{shown(item.contactName)}</small></td> : null}
                        {visibleColumns.has("channel") ? <td>{shown(item.channel)}</td> : null}
                        {visibleColumns.has("subject") ? <td>{shown(item.subject, "(no subject)")}</td> : null}
                        {visibleColumns.has("status") ? <td><StatusLabel value={messageStatus(item)} /></td> : null}
                        <td className="ry-register-cell-actions"><Link to={`/outreach/${item.id}`}>Review</Link></td>
                      </DataRow>
                    ))}
                  </tbody>
                </Table>
                <RegisterMobileList label="Outreach messages">
                  {sortedMessages.map((item) => (
                    <RegisterMobileRow
                      key={item.id}
                      title={`${shown(item.businessName)} · ${shown(item.contactName)}`}
                      meta={`${shown(item.channel)} · ${shown(item.subject, "(no subject)")}`}
                      status={<StatusLabel value={messageStatus(item)} />}
                      onOpen={() => void navigate(`/outreach/${item.id}`)}
                      openLabel={`Review ${shown(item.subject, "message")}`}
                    />
                  ))}
                </RegisterMobileList>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
