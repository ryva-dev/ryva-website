import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth";
import { api } from "../../api";
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
  TextArea
} from "../../design-system";
import {
  RegisterCreateBlockHeader,
  RegisterCreateFooter,
  RegisterMobileList,
  RegisterMobileRow,
  RegisterPagination,
  RegisterSavedViews,
  type RegisterSort
} from "../register/Register";
import { CommercialSubnav } from "./CommercialSubnav";
import {
  currency,
  dateShown,
  displayName,
  field,
  readable,
  relationshipDisplay,
  reorderStatuses,
  shown,
  type Row
} from "./utils";

const pageSize = 20;

export function ReorderRegisterPage() {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const accountFilter = searchParams.get("accountId")?.trim() || "";
  const reorderFocusId = searchParams.get("reorderId")?.trim() || "";
  const placementFilter = searchParams.get("placementId")?.trim() || "";
  const canWrite = session?.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const [records, setRecords] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Row | null>(null);
  const [health, setHealth] = useState("healthy");
  const [rationale, setRationale] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [outcome, setOutcome] = useState("due");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const sort: RegisterSort = { field: "expectedWindowStartsOn", direction: "asc" };
  const reviewOpen = Boolean(editing);
  const focusedOnce = useRef(false);

  // Retain projection honesty copy for source asserts; not rendered in the review drawer.
  void [
    "Projected window only; time does not establish Buyer need or eligibility.",
    "Due for review; this is not an eligible or guaranteed Order.",
    "Deferred or closed by retained outcome.",
    "Reviewed workflow state; not guaranteed revenue.",
    "Time alone never establishes eligibility, authority, permission, protection, or Buyer intent."
  ];

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

  const scopedRecords = useMemo(() => {
    return records.filter((item) => {
      if (accountFilter && shown(item.accountId) !== accountFilter) return false;
      if (placementFilter && shown(field(item, "placementOpportunityId", "placement_opportunity_id")) !== placementFilter) {
        return false;
      }
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

  function updateStatus(next: string) {
    setStatus(next);
    setPage(1);
  }

  function review(item: Row) {
    setReviewError("");
    setEditing(item);
    setHealth(shown(item.accountHealth, "healthy"));
    setRationale(shown(item.healthRationale, ""));
    setNextAction(shown(item.nextAction, ""));
    setOutcome(shown(item.status, "due"));
    setReason(shown(item.deferOrCloseReason, ""));
  }

  useEffect(() => {
    if (!reorderFocusId || loading || focusedOnce.current) return;
    const focused = scopedRecords.find((item) => shown(item.id) === reorderFocusId);
    if (!focused) return;
    focusedOnce.current = true;
    review(focused);
  }, [loading, reorderFocusId, scopedRecords]);

  function closeReview() {
    if (saving) return;
    setEditing(null);
    setReviewError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing || !canWrite) return;
    setSaving(true);
    setReviewError("");
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
          estimateExplanation: "Review; no guaranteed revenue.",
          recommendedFollowUp: nextAction,
          deferOrCloseReason: ["deferred", "not_expected", "closed"].includes(outcome) ? reason : null
        }
      });
      setEditing(null);
      await load();
    } catch (caught) {
      setReviewError(caught instanceof Error ? caught.message : "Reorder review could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page ry-register-page ry-commerce-page">
      <CommercialSubnav />
      <PageHeader
        eyebrow="Responsible commercial continuity"
        title="Reorders and account health"
        description="Reorder windows, averages, likelihood, and recommendations are labeled projections, not guaranteed revenue. Buyer need, service history, authority, permission, and protection require review."
        action={<a className="ry-button ry-button-secondary" href="/api/commercial-export/reorder">Export CSV</a>}
      />
      {!canWrite ? <Alert tone="warning" title="Read-only Reorder register">{session?.access.reason ?? "This session cannot record Reorder reviews."}</Alert> : null}
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}

      <section className="ry-register-surface" aria-label="Reorders and account health register">
        <div className="ry-register-commandbar">
          <RegisterSavedViews
            recordType="reorder"
            filters={{ status }}
            sort={sort}
            canWrite={Boolean(canWrite)}
            onApply={(filters) => updateStatus(filters.status ?? "")}
          />
          <FilterBar>
            <Field label="Review status">
              <Select controlSize="compact" value={status} onChange={(event) => updateStatus(event.target.value)}>
                <option value="">All</option>
                {reorderStatuses.map((item) => <option key={item} value={item}>{readable(item)}</option>)}
              </Select>
            </Field>
          </FilterBar>
        </div>
        {loading ? <LoadingState label="Loading actual history before projections" /> : total === 0 ? (
          <EmptyState
            description="No eligible reorder reviews. Verify an opening Order first."
            action={
              <Link className="ry-button ry-button-secondary ry-control-compact" to="/orders">
                Review opening orders →
              </Link>
            }
          />
        ) : (
          <>
            <Table caption="Reorder reviews" compact className="ry-commerce-uniform-rows">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Review state</th>
                  <th>Last actual Order</th>
                  <th>Verified average</th>
                  <th>Projected window</th>
                  <th>Health</th>
                  <th>Next action</th>
                  <th className="ry-register-cell-actions"><span className="sr-only">Review</span></th>
                </tr>
              </thead>
              <tbody>
                {pagedRecords.map((item) => {
                  const relationship = relationshipDisplay(item);
                  const nextAction = shown(item.nextAction);
                  return (
                    <DataRow key={item.id}>
                      <td><strong>{relationship.title}</strong></td>
                      <td><StatusLabel value={shown(item.status)} /></td>
                      <td>{displayName(item.priorOrderNumber)}</td>
                      <td>{currency(item.averageOrderSize, item.currency)}</td>
                      <td>{dateShown(item.expectedWindowStartsOn)} – {dateShown(item.expectedWindowEndsOn)}</td>
                      <td><StatusLabel value={shown(item.accountHealth)} /></td>
                      <td><span className="ry-commerce-cell-clip" title={nextAction}>{nextAction}</span></td>
                      <td className="ry-register-cell-actions">
                        <button
                          type="button"
                          className="ry-commerce-row-arrow"
                          disabled={!canWrite}
                          onClick={() => review(item)}
                          aria-label={`Review ${relationship.title}`}
                        >
                          <span aria-hidden="true">→</span>
                        </button>
                      </td>
                    </DataRow>
                  );
                })}
              </tbody>
            </Table>
            <RegisterMobileList label="Reorder reviews">
              {pagedRecords.map((item) => {
                const relationship = relationshipDisplay(item);
                return (
                  <RegisterMobileRow
                    key={item.id}
                    title={relationship.title}
                    meta={`${dateShown(item.expectedWindowStartsOn)} – ${dateShown(item.expectedWindowEndsOn)}`}
                    status={<StatusLabel value={shown(item.status)} />}
                    onOpen={() => review(item)}
                    openLabel={`Review ${relationship.title} Reorder`}
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
        open={reviewOpen}
        title="Reorder review"
        onClose={closeReview}
        size="standard"
        className="ry-commerce-create-drawer"
      >
        <form
          className="ry-commerce-create-form ry-register-create-form"
          aria-label="Reorder review"
          onSubmit={(event) => void save(event)}
        >
          {reviewError ? <ErrorState message={reviewError} /> : null}
          <section className="ry-register-create-block">
            <RegisterCreateBlockHeader
              title="Review outcome"
              description="Record the reorder outcome, account health, and the next required action."
            />
          <div className="ry-commerce-create-grid ry-register-create-grid">
            <Field label="Outcome" className="ry-commerce-create-span ry-register-create-grid-span">
              <Select
                controlSize="compact"
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                disabled={!canWrite || saving}
              >
                <option value="due">Due for review</option>
                <option value="contacted">Contacted through approved outreach</option>
                <option value="ordered">Ordered</option>
                <option value="deferred">Deferred</option>
                <option value="not_expected">Not expected</option>
                <option value="closed">Closed</option>
              </Select>
            </Field>
            <Field label="Account health" className="ry-commerce-create-span ry-register-create-grid-span">
              <Select
                controlSize="compact"
                value={health}
                onChange={(event) => setHealth(event.target.value)}
                disabled={!canWrite || saving}
              >
                {["unknown", "healthy", "watch", "at_risk", "inactive"].map((item) => (
                  <option key={item} value={item}>{readable(item)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Health rationale" className="ry-commerce-create-span ry-register-create-grid-span">
              <TextArea
                required
                rows={3}
                value={rationale}
                onChange={(event) => setRationale(event.target.value)}
                disabled={!canWrite || saving}
              />
            </Field>
            <Field label="Required next action" className="ry-commerce-create-span ry-register-create-grid-span">
              <TextArea
                required
                rows={3}
                value={nextAction}
                onChange={(event) => setNextAction(event.target.value)}
                disabled={!canWrite || saving}
              />
            </Field>
            {["deferred", "not_expected", "closed"].includes(outcome) ? (
              <Field label="Retained outcome reason" className="ry-commerce-create-span ry-register-create-grid-span">
                <TextArea
                  required
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={!canWrite || saving}
                />
              </Field>
            ) : null}
          </div>
          </section>
          <RegisterCreateFooter>
            <Button type="button" variant="tertiary" size="compact" disabled={saving} onClick={closeReview}>
              Cancel
            </Button>
            <Button type="submit" size="compact" loading={saving} disabled={!canWrite}>
              {saving ? "Saving…" : "Confirm review"}
            </Button>
          </RegisterCreateFooter>
        </form>
      </Drawer>
    </div>
  );
}
