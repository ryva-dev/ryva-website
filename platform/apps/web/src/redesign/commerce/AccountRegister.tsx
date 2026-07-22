import { useCallback, useEffect, useMemo, useState } from "react";
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
  accountHealthValues,
  accountStatuses,
  dateShown,
  field,
  readable,
  shown,
  type Row
} from "./utils";

const initialFilters: RegisterFilterValue = {
  query: "",
  status: "",
  health: ""
};

const columnOptions = [
  { id: "relationship", label: "Relationship", required: true },
  { id: "status", label: "Status", required: true },
  { id: "health", label: "Health" },
  { id: "protection", label: "Protection" },
  { id: "lastOrder", label: "Last Order" }
];

function accountValue(account: Row, sortField: string): string {
  if (sortField === "status") return shown(account.status).toLowerCase();
  if (sortField === "health") return shown(account.health).toLowerCase();
  if (sortField === "protection") return shown(field(account, "protectionStatus", "protection_status")).toLowerCase();
  if (sortField === "lastOrder") return shown(field(account, "lastOrderDate", "last_order_date"), "").toLowerCase();
  return `${shown(account.brandName)} ${shown(account.businessName)}`.toLowerCase();
}

export function AccountRegisterPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const canWrite = session?.access.mode === "full"
    && session.access.capabilities.includes("operational:write");
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [filters, setFilters] = useState<RegisterFilterValue>(initialFilters);
  const [sort, setSort] = useState<RegisterSort>({ field: "relationship", direction: "asc" });
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
      const result = await api<{ accounts: Row[] }>(`/api/accounts${suffix}`);
      setAccounts(result.accounts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Accounts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  function updateFilter(id: string, value: string) {
    setFilters((current) => ({ ...current, [id]: value }));
  }

  const sortedAccounts = useMemo(() => {
    const query = String(filters.query ?? "").trim().toLowerCase();
    const health = String(filters.health ?? "");
    const filtered = accounts.filter((account) => {
      if (statusFilter && shown(account.status) !== statusFilter) return false;
      if (health && shown(account.health) !== health) return false;
      if (!query) return true;
      const haystack = [
        shown(account.brandName),
        shown(account.businessName),
        shown(account.status),
        shown(account.health),
        shown(field(account, "healthRationale", "health_rationale"), ""),
        shown(field(account, "lastOrderNumber", "last_order_number"), "")
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) =>
      accountValue(left, sort.field).localeCompare(accountValue(right, sort.field)) * direction
    );
  }, [accounts, filters, sort, statusFilter]);

  const activeFilters = Object.entries(filters)
    .filter(([, value]) => Boolean(value))
    .map(([id, value]) => ({
      id,
      label: `${id === "query" ? "Search" : readable(id)}: ${id === "query" ? value : readable(value)}`
    }));

  return (
    <div className="page ry-register-page ry-commerce-page">
      <CommercialSubnav />
      <PageHeader
        eyebrow="Commercial continuity"
        title="Protected Accounts and operational Accounts"
        description="Manage real Brand–Business relationships after verified opening Orders. Account records preserve history; they do not create contractual rights."
        action={<a className="ry-button ry-button-secondary" href="/api/commercial-export/account">Export CSV</a>}
      />
      {!canWrite ? (
        <Alert tone="warning" className="ry-register-policy" title="Read-only Account register">
          You may inspect permitted Account history, but cannot record an Account health or status review in this session.
        </Alert>
      ) : null}
      {error ? (
        <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} />
      ) : null}
      {loading ? <LoadingState label="Loading Accounts" /> : (
        <section className="ry-register-surface" aria-label="Accounts">
          <div className="ry-register-commandbar">
            <RegisterSavedViews
              recordType="account"
              filters={filters}
              sort={sort}
              canWrite={Boolean(canWrite)}
              onApply={(nextFilters, nextSort) => {
                setFilters({ ...initialFilters, ...nextFilters });
                setSort(nextSort);
              }}
            />
            <RegisterFilterSheet
              open={filterOpen}
              onOpen={() => setFilterOpen(true)}
              onClose={() => setFilterOpen(false)}
            >
              <FilterBar>
                <Field label="Search Accounts">
                  <SearchInput
                    label="Search Accounts"
                    controlSize="compact"
                    value={String(filters.query ?? "")}
                    onChange={(event) => updateFilter("query", event.target.value)}
                    onClear={() => updateFilter("query", "")}
                  />
                </Field>
                <Field label="Account status">
                  <Select
                    controlSize="compact"
                    value={statusFilter}
                    onChange={(event) => updateFilter("status", event.target.value)}
                  >
                    <option value="">All statuses</option>
                    {accountStatuses.map((status) => <option key={status} value={status}>{readable(status)}</option>)}
                  </Select>
                </Field>
                <Field label="Health">
                  <Select
                    controlSize="compact"
                    value={String(filters.health ?? "")}
                    onChange={(event) => updateFilter("health", event.target.value)}
                  >
                    <option value="">All health values</option>
                    {accountHealthValues.map((health) => <option key={health} value={health}>{readable(health)}</option>)}
                  </Select>
                </Field>
              </FilterBar>
            </RegisterFilterSheet>
          </div>
          <ActiveFilters
            filters={activeFilters}
            onClear={(id) => updateFilter(id, "")}
            onClearAll={() => setFilters(initialFilters)}
          />
          <div className="ry-register-resultbar">
            <span>{sortedAccounts.length} Account{sortedAccounts.length === 1 ? "" : "s"}</span>
            <RegisterColumnSelector
              columns={columnOptions}
              visible={visibleColumns}
              onChange={(id, visible) => setVisibleColumns((current) => {
                const next = new Set(current);
                if (visible) next.add(id);
                else next.delete(id);
                return next;
              })}
              density={density}
              onDensityChange={setDensity}
            />
          </div>
          {sortedAccounts.length === 0 ? (
            <EmptyState
              title={activeFilters.length ? "No Accounts match these filters" : undefined}
              description={activeFilters.length
                ? "Clear one or more filters to return to the Account register."
                : "No Accounts yet. Confirm a documented opening Order to create the first operational Account."}
              action={activeFilters.length
                ? <Button variant="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</Button>
                : undefined}
            />
          ) : (
            <>
              <Table caption="Protected Accounts and operational Accounts" compact={density === "compact"}>
                <thead>
                  <tr>
                    {visibleColumns.has("relationship") ? <SortableHeader field="relationship" label="Relationship" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("status") ? <SortableHeader field="status" label="Status" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("health") ? <SortableHeader field="health" label="Health" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("protection") ? <SortableHeader field="protection" label="Protection" sort={sort} onSort={setSort} /> : null}
                    {visibleColumns.has("lastOrder") ? <SortableHeader field="lastOrder" label="Last Order" sort={sort} onSort={setSort} /> : null}
                    <th scope="col" className="ry-register-cell-actions"><span className="sr-only">Review</span></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAccounts.map((account) => {
                    const protectionStatus = shown(field(account, "protectionStatus", "protection_status"), "unverified");
                    const protectionEndsOn = field(account, "protectionEndsOn", "protection_ends_on");
                    return (
                      <DataRow key={account.id}>
                        {visibleColumns.has("relationship") ? <td><strong>{shown(account.brandName)}</strong><small>{shown(account.businessName)}</small></td> : null}
                        {visibleColumns.has("status") ? <td><StatusLabel value={shown(account.status)} /></td> : null}
                        {visibleColumns.has("health") ? <td><StatusLabel value={shown(account.health)} /><small>{shown(field(account, "healthRationale", "health_rationale"))}</small></td> : null}
                        {visibleColumns.has("protection") ? <td><StatusLabel value={protectionStatus} /><small>{protectionEndsOn ? `Ends ${dateShown(protectionEndsOn)}` : "No asserted protection"}</small></td> : null}
                        {visibleColumns.has("lastOrder") ? <td>{shown(field(account, "lastOrderNumber", "last_order_number"))}<small>{dateShown(field(account, "lastOrderDate", "last_order_date"))}</small></td> : null}
                        <td className="ry-register-cell-actions"><Link to={`/accounts/${account.id}`}>Review</Link></td>
                      </DataRow>
                    );
                  })}
                </tbody>
              </Table>
              <RegisterMobileList label="Accounts">
                {sortedAccounts.map((account) => (
                  <RegisterMobileRow
                    key={account.id}
                    title={`${shown(account.brandName)} → ${shown(account.businessName)}`}
                    meta={`${readable(shown(account.health))} · Last Order ${shown(field(account, "lastOrderNumber", "last_order_number"), "not recorded")}`}
                    status={<StatusLabel value={shown(account.status)} />}
                    onOpen={() => void navigate(`/accounts/${account.id}`)}
                    openLabel={`Review ${shown(account.brandName)} and ${shown(account.businessName)} Account`}
                  />
                ))}
              </RegisterMobileList>
            </>
          )}
        </section>
      )}
    </div>
  );
}
