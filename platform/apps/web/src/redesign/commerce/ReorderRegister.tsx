import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth";
import { api } from "../../api";
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
  TextArea
} from "../../design-system";
import {
  RegisterMobileList,
  RegisterMobileRow,
  RegisterSavedViews,
  type RegisterSort
} from "../register/Register";
import { CommercialSubnav } from "./CommercialSubnav";
import {
  currency,
  dateShown,
  readable,
  reorderStatuses,
  shown,
  type Row
} from "./utils";

export function ReorderRegisterPage() {
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [records, setRecords] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [health, setHealth] = useState("healthy");
  const [rationale, setRationale] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [outcome, setOutcome] = useState("due");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sort: RegisterSort = { field: "expectedWindowStartsOn", direction: "asc" };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ reorders: Row[] }>(`/api/reorders${status ? `?status=${encodeURIComponent(status)}` : ""}`);
      setRecords(result.reorders);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reorder reviews could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  function review(item: Row) {
    setEditing(item);
    setHealth(shown(item.accountHealth, "healthy"));
    setRationale(shown(item.healthRationale, ""));
    setNextAction(shown(item.nextAction, ""));
    setOutcome(shown(item.status, "due"));
    setReason(shown(item.deferOrCloseReason, ""));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing || !canWrite) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/reorders/${editing.id}`, {
        method: "PATCH",
        body: {
          version: editing.version,
          status: outcome,
          expectedWindowStartsOn: editing.expectedWindowStartsOn ?? null,
          expectedWindowEndsOn: editing.expectedWindowEndsOn ?? null,
          reminderAt: editing.reminderAt ?? null,
          accountHealth: health,
          healthRationale: rationale,
          nextAction,
          likelihoodLabel: null,
          likelihoodOrigin: null,
          estimateExplanation: "Human review; no guaranteed revenue.",
          recommendedFollowUp: nextAction,
          deferOrCloseReason: ["deferred", "not_expected", "closed"].includes(outcome) ? reason : null
        }
      });
      setEditing(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reorder review could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function projectionMeaning(value: string) {
    if (value === "projected") return "Projected window only; time does not establish Buyer need or eligibility.";
    if (value === "due") return "Due for human review; this is not an eligible or guaranteed Order.";
    if (["deferred", "not_expected", "closed"].includes(value)) return "Deferred or closed by retained human outcome.";
    return "Human-reviewed workflow state; not guaranteed revenue.";
  }

  return (
    <div className="page ry-register-page ry-commerce-page">
      <CommercialSubnav />
      <PageHeader
        eyebrow="Responsible commercial continuity"
        title="Reorders and account health"
        description="Reorder windows, averages, likelihood, and recommendations are labeled projections, not guaranteed revenue. Buyer need, service history, authority, permission, and protection require human review."
        action={<a className="ry-button ry-button-secondary" href="/api/commercial-export/reorder">Export CSV</a>}
      />
      {!canWrite ? <Alert tone="warning" title="Read-only Reorder register">{session?.access.reason ?? "This session cannot record Reorder reviews."}</Alert> : null}
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}

      <section className="ry-register-surface" aria-label="Reorders and account health register">
        <div className="ry-register-commandbar">
          <RegisterSavedViews recordType="reorder" filters={{ status }} sort={sort} canWrite={Boolean(canWrite)} onApply={(filters) => setStatus(filters.status ?? "")} />
          <FilterBar>
            <Field label="Review status">
              <Select controlSize="compact" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All</option>
                {reorderStatuses.map((item) => <option key={item} value={item}>{readable(item)}</option>)}
              </Select>
            </Field>
          </FilterBar>
        </div>
        {loading ? <LoadingState label="Loading actual history before projections" /> : records.length === 0 ? (
          <EmptyState description="No eligible reorder reviews. Verify an opening Order first." />
        ) : (
          <>
            <Table caption="Reorder reviews">
              <thead><tr><th>Account</th><th>Review state</th><th>Last actual Order</th><th>Verified average</th><th>Projected window</th><th>Health</th><th>Next action</th><th><span className="sr-only">Review</span></th></tr></thead>
              <tbody>{records.map((item) => (
                <DataRow key={item.id}>
                  <td><strong>{shown(item.brandName)}</strong><small>{shown(item.businessName)}</small></td>
                  <td><StatusLabel value={shown(item.status)} /><small>{projectionMeaning(shown(item.status))}</small></td>
                  <td>{shown(item.priorOrderNumber)}<small>{dateShown(item.lastOrderDate)}</small></td>
                  <td>{currency(item.averageOrderSize, item.currency)}<small>Actual verified history only</small></td>
                  <td>{dateShown(item.expectedWindowStartsOn)} – {dateShown(item.expectedWindowEndsOn)}<small>Projection, not eligibility</small></td>
                  <td><StatusLabel value={shown(item.accountHealth)} /><small>{shown(item.healthRationale)}</small></td>
                  <td>{shown(item.nextAction)}</td>
                  <td><Button variant="secondary" size="compact" disabled={!canWrite} onClick={() => review(item)}>Review</Button></td>
                </DataRow>
              ))}</tbody>
            </Table>
            <RegisterMobileList label="Reorder reviews">
              {records.map((item) => <RegisterMobileRow key={item.id} title={`${shown(item.brandName)} → ${shown(item.businessName)}`} meta={`${projectionMeaning(shown(item.status))} ${dateShown(item.expectedWindowStartsOn)} – ${dateShown(item.expectedWindowEndsOn)}`} status={<StatusLabel value={shown(item.status)} />} onOpen={() => review(item)} openLabel={`Review ${shown(item.businessName)} Reorder`} />)}
            </RegisterMobileList>
          </>
        )}
      </section>

      {editing ? (
        <section className="panel ry-commerce-inline-review" aria-live="polite">
          <h2>Human Reorder review</h2>
          <p><strong>{shown(editing.brandName)} → {shown(editing.businessName)}</strong></p>
          <p>{projectionMeaning(outcome)} Time alone never establishes eligibility, authority, permission, protection, or Buyer intent.</p>
          <form className="form-grid" onSubmit={(event) => void save(event)}>
            <Field label="Outcome">
              <Select value={outcome} onChange={(event) => setOutcome(event.target.value)} disabled={!canWrite}>
                <option value="due">Due for review</option>
                <option value="contacted">Contacted through approved outreach</option>
                <option value="ordered">Ordered</option>
                <option value="deferred">Deferred</option>
                <option value="not_expected">Not expected</option>
                <option value="closed">Closed</option>
              </Select>
            </Field>
            <Field label="Account health">
              <Select value={health} onChange={(event) => setHealth(event.target.value)} disabled={!canWrite}>
                {["unknown", "healthy", "watch", "at_risk", "inactive"].map((item) => <option key={item} value={item}>{readable(item)}</option>)}
              </Select>
            </Field>
            <Field label="Health rationale"><TextArea required value={rationale} onChange={(event) => setRationale(event.target.value)} disabled={!canWrite} /></Field>
            <Field label="Required next action"><TextArea required value={nextAction} onChange={(event) => setNextAction(event.target.value)} disabled={!canWrite} /></Field>
            {["deferred", "not_expected", "closed"].includes(outcome) ? <Field label="Retained outcome reason"><TextArea required value={reason} onChange={(event) => setReason(event.target.value)} disabled={!canWrite} /></Field> : null}
            <div className="form-actions">
              <Button type="submit" loading={saving} disabled={!canWrite}>Confirm human review</Button>
              <Button variant="tertiary" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
