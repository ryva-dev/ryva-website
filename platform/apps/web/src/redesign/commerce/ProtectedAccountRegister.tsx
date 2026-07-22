import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  LoadingState,
  PageHeader,
  Select,
  StatusLabel,
  Table,
  TextArea,
  Input
} from "../../design-system";
import {
  RegisterFilterSheet,
  RegisterMobileList,
  RegisterMobileRow,
  RegisterSavedViews,
  type RegisterSort
} from "../register/Register";
import { CommercialSubnav } from "./CommercialSubnav";
import {
  dateShown,
  protectionStatuses,
  readable,
  shown,
  splitIds,
  type Row
} from "./utils";

type RegisterPayload = {
  protectedAccounts: Row[];
  accounts: Row[];
  documents: Row[];
};

export function ProtectedAccountRegisterPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [records, setRecords] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [documents, setDocuments] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort] = useState<RegisterSort>({ field: "updatedAt", direction: "desc" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accountId, setAccountId] = useState("");
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

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError("");
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
          releaseTerms: "Release requires documented human action."
        }
      });
      setAccountId("");
      setDocumentId("");
      setProductIds("");
      setScope("");
      setEndsOn("");
      setCommissionRights("");
      setReorderRights("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Protection review could not be created.");
    } finally {
      setSaving(false);
    }
  }

  const createForm = (
    <form className="form-grid" onSubmit={(event) => void create(event)}>
      <Field label="Operational Account">
        <Select required value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={!canWrite}>
          <option value="">Select Account</option>
          {accounts.map((item) => <option value={item.id} key={item.id}>{shown(item.brandName)} → {shown(item.businessName)}</option>)}
        </Select>
      </Field>
      <Field label="Clean rights document">
        <Select required value={documentId} onChange={(event) => setDocumentId(event.target.value)} disabled={!canWrite}>
          <option value="">Select document</option>
          {documents.filter((item) => item.status === "active" && item.scanStatus === "clean").map((item) => <option value={item.id} key={item.id}>{shown(item.name)}</option>)}
        </Select>
      </Field>
      <Field label="Scoped Product IDs" hint="Comma-separated Products already covered by the Agreement.">
        <Input required value={productIds} onChange={(event) => setProductIds(event.target.value)} disabled={!canWrite} />
      </Field>
      <Field label="Exact scope summary"><TextArea required value={scope} onChange={(event) => setScope(event.target.value)} disabled={!canWrite} /></Field>
      <Field label="Protection starts"><Input required type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} disabled={!canWrite} /></Field>
      <Field label="Protection ends"><Input required type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} disabled={!canWrite} /></Field>
      <Field label="Documented commission rights"><TextArea required value={commissionRights} onChange={(event) => setCommissionRights(event.target.value)} disabled={!canWrite} /></Field>
      <Field label="Documented reorder rights"><TextArea required value={reorderRights} onChange={(event) => setReorderRights(event.target.value)} disabled={!canWrite} /></Field>
      <Button type="submit" loading={saving} disabled={!canWrite}>Create pending rights review</Button>
    </form>
  );

  return (
    <div className="page ry-register-page ry-commerce-page">
      <CommercialSubnav />
      <PageHeader
        eyebrow="Document-derived rights"
        title="Protected Accounts"
        description="Ryva records scoped rights from approved documents. It does not create contractual protection, reorder rights, or commission rights."
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
            onApply={(filters) => setStatus(filters.status ?? "")}
          />
          <RegisterFilterSheet open={filterOpen} onOpen={() => setFilterOpen(true)} onClose={() => setFilterOpen(false)}>
            <FilterBar>
              <Field label="Protection status">
                <Select controlSize="compact" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">All statuses</option>
                  {protectionStatuses.map((item) => <option key={item} value={item}>{readable(item)}</option>)}
                </Select>
              </Field>
            </FilterBar>
          </RegisterFilterSheet>
        </div>
        {loading ? <LoadingState label="Loading documented rights" /> : records.length === 0 ? (
          <EmptyState description="No protection records. A verified opening Order may create a review-required basis only when the Agreement contains supporting terms." />
        ) : (
          <>
            <Table caption="Protected Accounts">
              <thead><tr><th>Account</th><th>Scope</th><th>Term</th><th>Basis</th><th>Status</th><th><span className="sr-only">Review</span></th></tr></thead>
              <tbody>{records.map((item) => (
                <DataRow key={item.id}>
                  <td><strong>{shown(item.brandName)}</strong><small>{shown(item.businessName)}</small></td>
                  <td>{shown(item.scopeSummary)}<small>{Array.isArray(item.channels) ? item.channels.join(", ") : "No channel scope"}</small></td>
                  <td>{dateShown(item.protectionStartsOn)} – {dateShown(item.protectionEndsOn)}</td>
                  <td><StatusLabel value={shown(item.supportingBasisStatus)} /></td>
                  <td><StatusLabel value={shown(item.status)} /></td>
                  <td><Link to={`/protected-accounts/${item.id}`}>Review rights</Link></td>
                </DataRow>
              ))}</tbody>
            </Table>
            <RegisterMobileList label="Protected Accounts">
              {records.map((item) => <RegisterMobileRow key={item.id} title={`${shown(item.brandName)} → ${shown(item.businessName)}`} meta={`${shown(item.scopeSummary)} · ${dateShown(item.protectionEndsOn)}`} status={<StatusLabel value={shown(item.status)} />} onOpen={() => void navigate(`/protected-accounts/${item.id}`)} openLabel="Review rights" />)}
            </RegisterMobileList>
          </>
        )}
      </section>

      <section className="panel ry-commerce-create-inline">
        <h2>Register a documented account-rights basis</h2>
        <p>This creates a pending review only. It cannot activate rights without overlap checks and exact human approval.</p>
        {createForm}
      </section>
    </div>
  );
}
