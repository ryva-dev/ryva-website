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
  currency,
  disputeStatuses,
  readable,
  shown,
  type Row
} from "./utils";

const initialFilters: RegisterFilterValue = {
  query: "",
  status: ""
};

const columnOptions = [
  { id: "case", label: "Case", required: true },
  { id: "relationship", label: "Relationship", required: true },
  { id: "amount", label: "Amount", required: true },
  { id: "reason", label: "Reason" },
  { id: "status", label: "Status", required: true },
  { id: "next", label: "Next action" }
];

function disputeValue(item: Row, sortField: string): string {
  if (sortField === "status") return shown(item.status).toLowerCase();
  if (sortField === "amount") return String(Number(item.disputedAmount ?? 0)).padStart(18, "0");
  if (sortField === "next") return shown(item.nextAction).toLowerCase();
  if (sortField === "relationship") return `${shown(item.brandName)} ${shown(item.businessName)}`.toLowerCase();
  return shown(item.id).toLowerCase();
}

export function DisputeRegisterPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full"
    && session.access.capabilities.includes("operational:write");
  const [records, setRecords] = useState<Row[]>([]);
  const [filters, setFilters] = useState<RegisterFilterValue>(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "status", direction: "asc" });
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
      const result = await api<{ disputes: Row[] }>(`/api/commission-disputes${suffix}`);
      setRecords(result.disputes);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Commission Disputes could not be loaded.");
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
        shown(item.id),
        shown(item.brandName),
        shown(item.businessName),
        shown(item.orderNumber),
        shown(item.reason),
        shown(item.status),
        shown(item.nextAction)
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) =>
      disputeValue(left, sort.field).localeCompare(disputeValue(right, sort.field)) * direction
    );
  }, [records, filters, sort, statusFilter]);

  const filterFields = (
    <Field label="Dispute status">
      <Select controlSize="compact" value={statusFilter} onChange={(event) => updateFilter("status", event.target.value)}>
        <option value="">All</option>
        {disputeStatuses.map((item) => <option key={item} value={item}>{readable(item)}</option>)}
      </Select>
    </Field>
  );

  return (
    <div className="page ry-register-page ry-commerce-page">
      <CommercialSubnav />
      <PageHeader
        eyebrow="Human-owned resolution"
        title="Commission Disputes"
        description="Preserve claims, evidence, communications, chronology, adjustments, and final human decisions. Ryva does not adjudicate contractual rights."
        action={<a className="ry-button ry-button-secondary" href="/api/commercial-export/commission_dispute">Export case list</a>}
      />
      {!canWrite ? <Alert tone="warning" title="Read-only dispute register">{session?.access.reason ?? "This session cannot mutate dispute cases."}</Alert> : null}
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}

      <section className="ry-register-surface" aria-label="Commission Disputes register">
        <div className="ry-register-commandbar">
          <SearchInput
            label="Search disputes"
            controlSize="compact"
            value={String(filters.query ?? "")}
            onChange={(event) => updateFilter("query", event.target.value)}
            onClear={() => updateFilter("query", "")}
            placeholder="Brand, Order, reason, or status"
          />
          <RegisterSavedViews
            recordType="commission_dispute"
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

        {loading ? <LoadingState label="Loading dispute chronology" /> : sorted.length === 0 ? (
          <EmptyState description={records.length === 0
            ? "No Commission Disputes. Open one from a Commission variance or overdue-payment review."
            : "No disputes match the current filters."}
          />
        ) : (
          <>
            <Table caption="Commission dispute cases" compact={density === "compact"}>
              <thead>
                <tr>
                  {visibleColumns.has("case") ? <SortableHeader label="Case" field="case" sort={sort} onSort={setSort} /> : null}
                  {visibleColumns.has("relationship") ? <SortableHeader label="Relationship" field="relationship" sort={sort} onSort={setSort} /> : null}
                  {visibleColumns.has("amount") ? <SortableHeader label="Amount" field="amount" sort={sort} onSort={setSort} /> : null}
                  {visibleColumns.has("reason") ? <th scope="col">Reason</th> : null}
                  {visibleColumns.has("status") ? <SortableHeader label="Status" field="status" sort={sort} onSort={setSort} /> : null}
                  {visibleColumns.has("next") ? <SortableHeader label="Next action" field="next" sort={sort} onSort={setSort} /> : null}
                  <th scope="col"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => (
                  <DataRow key={item.id}>
                    {visibleColumns.has("case") ? <td className="monospace">{shown(item.id).slice(0, 8)}</td> : null}
                    {visibleColumns.has("relationship") ? (
                      <td>
                        <strong>{shown(item.brandName)}</strong>
                        <small>{shown(item.businessName)} · {shown(item.orderNumber)}</small>
                      </td>
                    ) : null}
                    {visibleColumns.has("amount") ? (
                      <td className="ry-commerce-numeric">
                        <CurrencyValue value={item.disputedAmount as string} currency={shown(item.currency, "USD")} status="actual" />
                      </td>
                    ) : null}
                    {visibleColumns.has("reason") ? <td>{shown(item.reason)}<small>Allegation, not proven fact</small></td> : null}
                    {visibleColumns.has("status") ? <td><StatusLabel value={shown(item.status)} /></td> : null}
                    {visibleColumns.has("next") ? <td>{shown(item.nextAction)}</td> : null}
                    <td><Link to={`/commission-disputes/${item.id}`}>Review case</Link></td>
                  </DataRow>
                ))}
              </tbody>
            </Table>
            <RegisterMobileList label="Commission dispute cases">
              {sorted.map((item) => (
                <RegisterMobileRow
                  key={item.id}
                  title={`${shown(item.brandName)} · ${shown(item.orderNumber)}`}
                  meta={`${currency(item.disputedAmount, item.currency)} · ${readable(shown(item.status))} · ${shown(item.nextAction)}`}
                  status={<StatusLabel value={shown(item.status)} />}
                  onOpen={() => void navigate(`/commission-disputes/${item.id}`)}
                  openLabel={`Review dispute ${shown(item.id).slice(0, 8)}`}
                />
              ))}
            </RegisterMobileList>
          </>
        )}
      </section>
    </div>
  );
}
