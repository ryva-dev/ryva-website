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
  LoadingState,
  PageHeader,
  Select,
  StatusLabel,
  Table,
  TextArea,
  Input
} from "../../design-system";
import {
  RegisterCreateBlockHeader,
  RegisterCreateFooter,
  RegisterFilterSheet,
  RegisterMobileList,
  RegisterMobileRow,
  RegisterPagination,
  RegisterSavedViews,
  type RegisterSort
} from "../register/Register";
import { CommercialSubnav } from "./CommercialSubnav";
import {
  dateShown,
  displayName,
  field,
  protectionStatuses,
  readable,
  relationshipDisplay,
  shown,
  splitIds,
  type Row
} from "./utils";

type RegisterPayload = {
  protectedAccounts: Row[];
  accounts: Row[];
  documents: Row[];
};

const pageSize = 20;

export function ProtectedAccountRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const accountFilter = searchParams.get("accountId")?.trim() || "";
  const placementFilter = searchParams.get("placementId")?.trim() || "";
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [records, setRecords] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [documents, setDocuments] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [sort] = useState<RegisterSort>({ field: "updatedAt", direction: "desc" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [accountId, setAccountId] = useState(accountFilter);
  const [documentId, setDocumentId] = useState("");
  const [productIds, setProductIds] = useState("");
  const [scope, setScope] = useState("");
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [endsOn, setEndsOn] = useState("");
  const [commissionRights, setCommissionRights] = useState("");
  const [reorderRights, setReorderRights] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [protection, accountPayload, documentPayload] = await Promise.all([
        api<{ protectedAccounts: Row[] }>(`/api/protected-accounts${status ? `?status=${encodeURIComponent(status)}` : ""}`),
        api<{ accounts: Row[] }>("/api/accounts"),
        api<{ documents: Row[] }>("/api/documents")
      ]);
      const payload: RegisterPayload = {
        protectedAccounts: protection.protectedAccounts,
        accounts: accountPayload.accounts,
        documents: documentPayload.documents
      };
      setRecords(payload.protectedAccounts);
      setAccounts(payload.accounts);
      setDocuments(payload.documents);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Documented rights could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (accountFilter) setAccountId(accountFilter);
  }, [accountFilter]);

  const scopedRecords = useMemo(() => {
    return records.filter((item) => {
      if (accountFilter && shown(item.accountId) !== accountFilter) return false;
      if (placementFilter && shown(field(item, "placementOpportunityId", "placement_opportunity_id")) !== placementFilter) return false;
      return true;
    });
  }, [accountFilter, placementFilter, records]);

  const total = scopedRecords.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return scopedRecords.slice(start, start + pageSize);
  }, [currentPage, scopedRecords]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function updateStatus(next: string) {
    setStatus(next);
    setPage(1);
  }

  function openCreate() {
    setCreateError("");
    setCreateOpen(true);
  }

  function closeCreate() {
    if (saving) return;
    setCreateOpen(false);
    setCreateError("");
  }

  function resetForm() {
    setAccountId(accountFilter);
    setDocumentId("");
    setProductIds("");
    setScope("");
    setEndsOn("");
    setCommissionRights("");
    setReorderRights("");
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setCreateError("");
    try {
      await api("/api/protected-accounts", {
        method: "POST",
        body: {
          accountId,
          basisDocumentId: documentId,
          originDate: new Date().toISOString().slice(0, 10),
          scopeSummary: scope,
          productIds: splitIds(productIds),
          channels: ["independent_retail"],
          territoryScope: {},
          protectionStartsOn: startsOn,
          protectionEndsOn: endsOn,
          protectionTerm: `${startsOn} through ${endsOn} as documented`,
          commissionRights,
          reorderRights,
          houseAccountExclusions: "",
          releaseTerms: "Release requires documented reviewer action."
        }
      });
      resetForm();
      setCreateOpen(false);
      await load();
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Protection review could not be created.");
    } finally {
      setSaving(false);
    }
  }

  const headerAction = !loading && total > 0
    ? (canWrite
      ? <Button onClick={openCreate}>Add protection basis</Button>
      : <Button disabled>Read-only access</Button>)
    : undefined;

  return (
    <div className="page ry-register-page ry-commerce-page">
      <CommercialSubnav />
      <PageHeader
        eyebrow="Document-derived rights"
        title="Protected Accounts"
        description="Ryva records scoped rights from approved documents. It does not create contractual protection, reorder rights, or commission rights."
        action={headerAction}
      />
      {!canWrite ? <Alert tone="warning" title="Read-only protection register">{session?.access.reason ?? "This session cannot create protection reviews."}</Alert> : null}
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}

      <section className="ry-register-surface" aria-label="Protected Accounts register">
        <div className="ry-register-commandbar">
          <RegisterSavedViews
            recordType="protected_account"
            filters={{ status }}
            sort={sort}
            canWrite={Boolean(canWrite)}
            onApply={(filters) => updateStatus(filters.status ?? "")}
          />
          <RegisterFilterSheet open={filterOpen} onOpen={() => setFilterOpen(true)} onClose={() => setFilterOpen(false)}>
            <FilterBar>
              <Field label="Protection status">
                <Select controlSize="compact" value={status} onChange={(event) => updateStatus(event.target.value)}>
                  <option value="">All statuses</option>
                  {protectionStatuses.map((item) => <option key={item} value={item}>{readable(item)}</option>)}
                </Select>
              </Field>
            </FilterBar>
          </RegisterFilterSheet>
        </div>
        {loading ? <LoadingState label="Loading protection" /> : total === 0 ? (
          <EmptyState
            description="No account protection recorded yet. Protection can be reviewed when the opening order and representation agreement support it."
            action={canWrite ? <Button onClick={openCreate}>Add protection basis</Button> : undefined}
          />
        ) : (
          <>
            <Table caption="Protected Accounts" className="ry-commerce-uniform-rows">
              <thead><tr><th>Account</th><th>Scope</th><th>Term</th><th>Basis</th><th>Status</th><th className="ry-register-cell-actions"><span className="sr-only">Review</span></th></tr></thead>
              <tbody>{pagedRecords.map((item) => {
                const relationship = relationshipDisplay(item);
                return (
                  <DataRow key={item.id}>
                    <td><strong>{relationship.title}</strong></td>
                    <td><span className="ry-commerce-cell-clip" title={shown(item.scopeSummary)}>{shown(item.scopeSummary)}</span></td>
                    <td>{dateShown(item.protectionStartsOn)} – {dateShown(item.protectionEndsOn)}</td>
                    <td><StatusLabel value={shown(item.supportingBasisStatus)} /></td>
                    <td><StatusLabel value={shown(item.status)} /></td>
                    <td className="ry-register-cell-actions">
                      <Link
                        to={`/protected-accounts/${item.id}`}
                        className="ry-commerce-row-arrow"
                        aria-label={`Review rights for ${relationship.title}`}
                      >
                        <span aria-hidden="true">→</span>
                      </Link>
                    </td>
                  </DataRow>
                );
              })}</tbody>
            </Table>
            <RegisterMobileList label="Protected Accounts">
              {pagedRecords.map((item) => {
                const relationship = relationshipDisplay(item);
                const title = relationship.subtitle
                  ? `${relationship.title} → ${relationship.subtitle}`
                  : relationship.title;
                return (
                  <RegisterMobileRow
                    key={item.id}
                    title={title}
                    meta={`${shown(item.scopeSummary)} · ${dateShown(item.protectionEndsOn)}`}
                    status={<StatusLabel value={shown(item.status)} />}
                    onOpen={() => void navigate(`/protected-accounts/${item.id}`)}
                    openLabel="Review rights"
                  />
                );
              })}
            </RegisterMobileList>
            <RegisterPagination
              page={currentPage}
              pageCount={pageCount}
              total={total}
              pageSize={pageSize}
              onPage={setPage}
            />
          </>
        )}
      </section>

      <Drawer
        open={createOpen}
        title="Add protection basis"
        onClose={closeCreate}
        size="standard"
        className="ry-commerce-create-drawer"
      >
        <form
          className="ry-commerce-create-form ry-register-create-form"
          aria-label="Add protection basis"
          onSubmit={(event) => void create(event)}
        >
          {createError ? <ErrorState message={createError} /> : null}
          <section className="ry-register-create-block">
            <RegisterCreateBlockHeader
              title="Protection details"
              description="Link the account, supporting document, scope, and commission and reorder terms."
            />
          <div className="ry-commerce-create-grid ry-register-create-grid">
            <Field label="Operational Account" className="ry-commerce-create-span ry-register-create-grid-span">
              <Select
                required
                controlSize="compact"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                disabled={!canWrite || saving}
              >
                <option value="">Select Account</option>
                {accounts.map((item) => {
                  const relationship = relationshipDisplay(item);
                  const label = relationship.subtitle
                    ? `${relationship.title} → ${relationship.subtitle}`
                    : relationship.title;
                  return <option value={item.id} key={item.id}>{label}</option>;
                })}
              </Select>
            </Field>
            <Field label="Clean rights document" className="ry-commerce-create-span ry-register-create-grid-span">
              <Select
                required
                controlSize="compact"
                value={documentId}
                onChange={(event) => setDocumentId(event.target.value)}
                disabled={!canWrite || saving}
              >
                <option value="">Select document</option>
                {documents.filter((item) => item.status === "active" && item.scanStatus === "clean").map((item) => (
                  <option value={item.id} key={item.id}>{displayName(item.name)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Scoped Product IDs" className="ry-commerce-create-span ry-register-create-grid-span">
              <Input
                required
                controlSize="compact"
                value={productIds}
                onChange={(event) => setProductIds(event.target.value)}
                disabled={!canWrite || saving}
              />
            </Field>
            <Field label="Exact scope summary" className="ry-commerce-create-span ry-register-create-grid-span">
              <TextArea
                required
                rows={3}
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                disabled={!canWrite || saving}
              />
            </Field>
            <Field label="Protection starts">
              <Input
                required
                type="date"
                controlSize="compact"
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
                disabled={!canWrite || saving}
              />
            </Field>
            <Field label="Protection ends">
              <Input
                required
                type="date"
                controlSize="compact"
                value={endsOn}
                onChange={(event) => setEndsOn(event.target.value)}
                disabled={!canWrite || saving}
              />
            </Field>
            <Field label="Documented commission rights" className="ry-commerce-create-span ry-register-create-grid-span">
              <TextArea
                required
                rows={3}
                value={commissionRights}
                onChange={(event) => setCommissionRights(event.target.value)}
                disabled={!canWrite || saving}
              />
            </Field>
            <Field label="Documented reorder rights" className="ry-commerce-create-span ry-register-create-grid-span">
              <TextArea
                required
                rows={3}
                value={reorderRights}
                onChange={(event) => setReorderRights(event.target.value)}
                disabled={!canWrite || saving}
              />
            </Field>
          </div>
          </section>
          <RegisterCreateFooter>
            <Button type="button" variant="tertiary" size="compact" disabled={saving} onClick={closeCreate}>
              Cancel
            </Button>
            <Button type="submit" size="compact" loading={saving} disabled={!canWrite}>
              {saving ? "Saving…" : "Save for review"}
            </Button>
          </RegisterCreateFooter>
        </form>
      </Drawer>
    </div>
  );
}
