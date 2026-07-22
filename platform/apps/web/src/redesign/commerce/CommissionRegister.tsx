import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Alert,
  Button,
  CurrencyValue,
  DataRow,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  LoadingState,
  Metric,
  PageHeader,
  SearchInput,
  Select,
  StatusLabel,
  Table
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
import { CommercialSubnav } from "./CommercialSubnav";
import {
  commissionStatuses,
  currency,
  field,
  readable,
  shown,
  type Row
} from "./utils";

const initialFilters: RegisterFilterValue = {
  query: "",
  status: ""
};

const columnOptions = [
  { id: "order", label: "Order / Brand", required: true },
  { id: "basis", label: "Formula basis" },
  { id: "expected", label: "Expected", required: true },
  { id: "approved", label: "Approved" },
  { id: "paid", label: "Paid" },
  { id: "status", label: "Status", required: true },
  { id: "dispute", label: "Dispute" }
];

function commissionValue(item: Row, sortField: string): string {
  if (sortField === "status") return shown(item.status).toLowerCase();
  if (sortField === "expected") return String(Number(item.expectedAmount ?? 0)).padStart(18, "0");
  if (sortField === "approved") return String(Number(item.approvedAmount ?? 0)).padStart(18, "0");
  if (sortField === "paid") return String(Number(item.paidAmount ?? 0)).padStart(18, "0");
  if (sortField === "dispute") return shown(field(item, "disputeStatus", "dispute_status")).toLowerCase();
  return `${shown(item.orderNumber)} ${shown(item.brandName)}`.toLowerCase();
}

export function CommissionRegisterPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full"
    && session.access.capabilities.includes("operational:write");
  const [records, setRecords] = useState<Row[]>([]);
  const [filters, setFilters] = useState<RegisterFilterValue>(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "order", direction: "asc" });
  const [visibleColumns, setVisibleColumns] = useState(new Set(columnOptions.map((column) => column.id)));
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const statusFilter = String(filters.status ?? "");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const suffix = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const result = await api<{ commissions: Row[] }>(`/api/commissions${suffix}`);
      setRecords(result.commissions);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Commissions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
  }

  const sorted = useMemo(() => {
    const query = String(filters.query ?? "").trim().toLowerCase();
    const filtered = records.filter((item) => {
      if (statusFilter && shown(item.status) !== statusFilter) return false;
      if (!query) return true;
      const haystack = [
        shown(item.orderNumber),
        shown(item.brandName),
        shown(item.status),
        shown(field(item, "disputeStatus", "dispute_status"), ""),
        shown(item.calculationExplanation, ""),
        shown(item.termType, ""),
        shown(item.basisType, "")
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) =>
      commissionValue(left, sort.field).localeCompare(commissionValue(right, sort.field)) * direction
    );
  }, [records, filters, sort, statusFilter]);

  const grouped = useMemo(() => {
    const result = new Map<string, { expected: number; approved: number; paid: number }>();
    for (const item of sorted) {
      const code = shown(item.currency, "Unknown");
      const group = result.get(code) ?? { expected: 0, approved: 0, paid: 0 };
      group.expected += Number(item.expectedAmount ?? 0);
      group.approved += Number(item.approvedAmount ?? 0);
      group.paid += Number(item.paidAmount ?? 0);
      result.set(code, group);
    }
    return [...result.entries()];
  }, [sorted]);

  const filterFields = (
    <Field label="Commission status">
      <Select controlSize="compact" value={statusFilter} onChange={(event) => updateFilter("status", event.target.value)}>
        <option value="">All</option>
        {commissionStatuses.map((item) => <option key={item} value={item}>{readable(item)}</option>)}
      </Select>
    </Field>
  );

  return (
    <div className="page ry-register-page ry-commerce-page">
      <CommercialSubnav />
      <PageHeader
        eyebrow="Explainable compensation"
        title="Commissions"
        description="Expected, verified, approved, payable, and paid values remain distinct. Every amount links to an Agreement rule, exact Order revision, adjustments, evidence, and human action."
        action={<a className="ry-button ry-button-secondary" href="/api/commercial-export/commission">Export reconciliation</a>}
      />
      {!canWrite ? <Alert tone="warning" title="Read-only Commission register">{session?.access.reason ?? "This session cannot approve, mark payable/paid, or open disputes."}</Alert> : null}
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}

      <section className="ry-register-surface" aria-label="Commissions register">
        <div className="ry-register-commandbar">
          <SearchInput
            label="Search Commissions"
            controlSize="compact"
            value={String(filters.query ?? "")}
            onChange={(event) => updateFilter("query", event.target.value)}
            onClear={() => updateFilter("query", "")}
            placeholder="Order, Brand, status, or basis"
          />
          <RegisterSavedViews
            recordType="commission"
            filters={filters}
            sort={sort}
            canWrite={Boolean(canWrite)}
            onApply={(next) => setFilters({ ...initialFilters, ...next })}
          />
          <FilterBar className="ry-register-inline-filters">{filterFields}</FilterBar>
          <RegisterFilterSheet open={filterOpen} onOpen={() => setFilterOpen(true)} onClose={() => setFilterOpen(false)}>
            {filterFields}
          </RegisterFilterSheet>
          <RegisterColumnSelector
            columns={columnOptions}
            visible={visibleColumns}
            onChange={(id, nextVisible) => {
              setVisibleColumns((current) => {
                const copy = new Set(current);
                if (nextVisible) copy.add(id);
                else copy.delete(id);
                return copy;
              });
            }}
            density={density}
            onDensityChange={setDensity}
          />
        </div>
        <ActiveFilters
          filters={[
            ...(String(filters.query ?? "").trim() ? [{ id: "query", label: `Search: ${String(filters.query)}` }] : []),
            ...(statusFilter ? [{ id: "status", label: `Status: ${readable(statusFilter)}` }] : [])
          ]}
          onClear={(id) => updateFilter(id, "")}
          onClearAll={() => setFilters(initialFilters)}
        />

        {loading ? <LoadingState label="Loading reconciled Commission records" /> : sorted.length === 0 ? (
          <EmptyState description={records.length === 0
            ? "No Commissions. A verified Order and unambiguous documented Agreement rule are required."
            : "No Commissions match the current filters."}
          />
        ) : (
          <>
            {grouped.map(([code, totals]) => (
              <section className="ry-commerce-currency-summary" key={code} aria-label={`${code} Commission totals from listed stored amounts`}>
                <Metric label={`${code} Expected`} value={<CurrencyValue value={totals.expected} currency={code} status="estimated" />} definition="Sum of listed stored expected amounts. Estimate, not guaranteed income." />
                <Metric label={`${code} Approved`} value={<CurrencyValue value={totals.approved} currency={code} status="actual" />} definition="Sum of listed stored approved amounts. Approved is not paid." />
                <Metric label={`${code} Paid`} value={<CurrencyValue value={totals.paid} currency={code} status="actual" />} definition="Sum of listed stored paid amounts. Human-confirmed actual only." />
              </section>
            ))}
            <Table caption="Commission ledger" compact={density === "compact"}>
              <thead>
                <tr>
                  {visibleColumns.has("order") ? <SortableHeader label="Order / Brand" field="order" sort={sort} onSort={setSort} /> : null}
                  {visibleColumns.has("basis") ? <th scope="col">Formula basis</th> : null}
                  {visibleColumns.has("expected") ? <SortableHeader label="Expected" field="expected" sort={sort} onSort={setSort} /> : null}
                  {visibleColumns.has("approved") ? <SortableHeader label="Approved" field="approved" sort={sort} onSort={setSort} /> : null}
                  {visibleColumns.has("paid") ? <SortableHeader label="Paid" field="paid" sort={sort} onSort={setSort} /> : null}
                  {visibleColumns.has("status") ? <SortableHeader label="Status" field="status" sort={sort} onSort={setSort} /> : null}
                  {visibleColumns.has("dispute") ? <SortableHeader label="Dispute" field="dispute" sort={sort} onSort={setSort} /> : null}
                  <th scope="col"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => (
                  <DataRow key={item.id}>
                    {visibleColumns.has("order") ? (
                      <td>
                        <strong>{shown(item.orderNumber)}</strong>
                        <small>{shown(item.brandName)}</small>
                      </td>
                    ) : null}
                    {visibleColumns.has("basis") ? (
                      <td>
                        {readable(shown(item.termType))} · {shown(item.basisType)} × {shown(item.commissionRate)}
                        <small>Stored Agreement rule and rate; Order value is not commission owed</small>
                      </td>
                    ) : null}
                    {visibleColumns.has("expected") ? <td className="ry-commerce-numeric"><CurrencyValue value={item.expectedAmount as string} currency={shown(item.currency, "USD")} status="estimated" /></td> : null}
                    {visibleColumns.has("approved") ? <td className="ry-commerce-numeric"><CurrencyValue value={item.approvedAmount as string} currency={shown(item.currency, "USD")} status="actual" /></td> : null}
                    {visibleColumns.has("paid") ? <td className="ry-commerce-numeric"><CurrencyValue value={item.paidAmount as string} currency={shown(item.currency, "USD")} status="actual" /></td> : null}
                    {visibleColumns.has("status") ? <td><StatusLabel value={shown(item.status)} /></td> : null}
                    {visibleColumns.has("dispute") ? <td><StatusLabel value={shown(field(item, "disputeStatus", "dispute_status"), "none")} /></td> : null}
                    <td><Link to={`/commissions/${item.id}`}>Explain</Link></td>
                  </DataRow>
                ))}
              </tbody>
            </Table>
            <RegisterMobileList label="Commission ledger">
              {sorted.map((item) => (
                <RegisterMobileRow
                  key={item.id}
                  title={`${shown(item.orderNumber)} · ${shown(item.brandName)}`}
                  meta={`${currency(item.expectedAmount, item.currency)} expected · ${readable(shown(item.status))} · dispute ${shown(field(item, "disputeStatus", "dispute_status"), "none")}`}
                  status={<StatusLabel value={shown(item.status)} />}
                  onOpen={() => void navigate(`/commissions/${item.id}`)}
                  openLabel={`Explain Commission for ${shown(item.orderNumber)}`}
                />
              ))}
            </RegisterMobileList>
          </>
        )}
      </section>
    </div>
  );
}
