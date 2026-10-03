import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import {
  Button,
  DataRow,
  EmptyState,
  ErrorState,
  Field,
  ForecastRange,
  Input,
  LoadingState,
  Select,
  PageHeader,
  SearchInput,
  StatusLabel,
  Table
} from "../../design-system";
import { RegisterPagination } from "../register/Register";

type Row = Record<string, unknown>;
type Definition = Row & { code: string; name: string };
type AnalyticsData = {
  generatedAt: string;
  period: { from: string; to: string };
  partialData: boolean;
  externalIntelligence: { status: string; observationCount: number; latestObservationAt: string | null; message: string };
  metrics: Row;
  currencyTotals: { orders: Row[]; commissions: Row[] };
  stageDistribution: Row[];
  products: Row[];
  brands: Row[];
  buyers: Row[];
  forecasts: Row[];
  definitions: Definition[];
};

const primaryViews = [
  ["representative", "Representative", "Representative Performance"],
  ["products", "Products", "Product Performance"],
  ["brands", "Brands", "Brand Performance"],
  ["buyers", "Buyers", "Buyer Performance"],
  ["pipeline", "Pipeline", "Pipeline Analytics"],
  ["commercial", "Commercial", "Commercial Analytics"],
  ["portfolio", "Portfolio", "Portfolio Health"],
  ["reports", "Reports", "Reports"]
] as const;

function shown(value: unknown, fallback = "—"): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function label(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Prefer “Verified sales” over abstract value wording for money columns. */
function analyticsColumnLabel(column: string, columnLabels?: Record<string, string>): string {
  if (columnLabels?.[column]) return columnLabels[column];
  if (column === "verified_value" || column === "verified") return "Verified sales";
  return label(column);
}

const definitionDetailFields = [
  "businessMeaning",
  "formula",
  "includedRecords",
  "excludedRecords",
  "dateBehavior",
  "currencyBehavior",
  "freshnessBehavior",
  "knownLimitations",
  "sourceRecordTypes"
] as const;

/** Expanded guide detail — business meaning is shown under the title when it adds information. */
const definitionExpandFields = [
  "formula",
  "includedRecords",
  "excludedRecords",
  "dateBehavior",
  "currencyBehavior",
  "freshnessBehavior",
  "knownLimitations",
  "sourceRecordTypes"
] as const;

const definitionExpandLabels: Record<(typeof definitionExpandFields)[number], string> = {
  formula: "How it’s calculated",
  includedRecords: "Included",
  excludedRecords: "Excluded",
  dateBehavior: "Date handling",
  currencyBehavior: "Currency",
  freshnessBehavior: "Data freshness",
  knownLimitations: "Limitations",
  sourceRecordTypes: "Source"
};

function definitionSearchBlob(definition: Definition): string {
  const chunks = [definition.code, definition.name, shown(definition.valueStatus)];
  for (const field of definitionDetailFields) {
    const value = definition[field];
    if (Array.isArray(value)) chunks.push(value.join(" "));
    else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") chunks.push(String(value));
  }
  return chunks.join(" ").toLowerCase();
}

function definitionDescription(definition: Definition): string {
  const meaning = shown(definition.businessMeaning).trim();
  const name = shown(definition.name).trim();
  if (meaning && meaning.toLowerCase() !== name.toLowerCase()) return meaning;
  return shown(definition.formula);
}

function definitionValueLabel(definition: Definition): string | null {
  const status = shown(definition.valueStatus).trim();
  if (!status) return null;
  return label(status);
}

const UNAVAILABLE = "Unavailable — denominator or provider data is absent";

const RATE_METRIC_CODES = new Set([
  "delivery_rate",
  "bounce_rate",
  "complaint_rate",
  "opt_out_rate",
  "reply_rate",
  "positive_response_rate",
  "conversation_rate"
]);

const metricLabels: Record<string, string> = {
  approved_messages: "Messages approved",
  sent_messages: "Sent",
  outreach_volume: "Outreach volume",
  replied: "Replies",
  delivered: "Delivered",
  bounced: "Bounces",
  complained: "Complaints",
  opted_out: "Opt-outs",
  positive: "Positive replies",
  conversation: "Conversations",
  delivery_rate: "Delivery",
  bounce_rate: "Bounce",
  complaint_rate: "Complaint",
  opt_out_rate: "Opt-out",
  reply_rate: "Reply",
  positive_response_rate: "Positive reply",
  conversation_rate: "Conversation",
  opening_order_count: "Opening orders",
  reorder_count: "Reorders",
  active_placement_opportunities: "Active placements",
  opportunities_won: "Won",
  opportunities_lost: "Lost",
  stalled_opportunities: "Stalled placements",
  opportunities_lacking_next_action: "No next action",
  blocked_opportunities: "Blocked",
  active_accounts: "Active accounts",
  at_risk_accounts: "At risk",
  upcoming_reorders: "Upcoming reorders",
  overdue_reorders: "Overdue reorders",
  high_open_risks: "High risks",
  open_risks: "Open risks"
};

const ANALYTICS_TABLE_PAGE_SIZE = 20;

function sumNumericField(rows: Row[], key: string): number {
  return rows.reduce((total, row) => {
    const raw = row[key];
    const value = typeof raw === "number" ? raw : Number(raw);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatMoney(value: number, currencyCode = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `$${formatCount(Math.round(value * 100) / 100)}`;
  }
}

/** Money columns returned as text from analytics SQL (and related commercial totals). */
const MONEY_COLUMNS = new Set([
  "verified_value",
  "gross",
  "discounts",
  "returns",
  "cancellations",
  "verified",
  "opening_value",
  "reorder_value",
  "expected",
  "approved",
  "payable",
  "paid",
  "disputed",
  "overdue",
  "clawbacks"
]);

const PERFORMANCE_COLUMN_LABELS: Record<string, string> = {
  brand_name: "Brand name",
  verified_orders: "Verified orders",
  verified_value: "Verified sales",
  stale_evidence: "Evidence needing review",
  active_agreements: "Agreements",
  active_accounts: "Accounts",
  overdue_commissions: "Overdue commissions",
  open_disputes: "Open disputes",
  opening_orders: "Opening orders",
  business_type: "Business type",
  commission_issues: "Commission issues"
};

const BRAND_COLUMN_LABELS: Record<string, string> = {
  verified_value: "Verified sales",
  opening_orders: "Opening orders",
  active_accounts: "Accounts",
  active_agreements: "Agreements",
  commission_issues: "Commission issues"
};

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatAnalyticsCell(column: string, value: unknown, row?: Row): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  const numeric = parseNumeric(value);
  if (numeric !== null && MONEY_COLUMNS.has(column)) {
    const currency = typeof row?.currency === "string" && row.currency ? row.currency : "USD";
    return formatMoney(numeric, currency);
  }
  if (numeric !== null && (typeof value === "number" || /^-?\d+(\.\d+)?$/.test(shown(value, "").trim()))) {
    return formatCount(numeric);
  }
  return shown(value);
}

function productPerformanceSummary(rows: Row[]) {
  return [
    { label: "Products", value: formatCount(rows.length) },
    { label: "Opportunities", value: formatCount(sumNumericField(rows, "opportunities")) },
    { label: "Verified orders", value: formatCount(sumNumericField(rows, "verified_orders")) },
    { label: "Verified sales", value: formatMoney(sumNumericField(rows, "verified_value")) },
    { label: "Evidence needing review", value: formatCount(sumNumericField(rows, "stale_evidence")) }
  ];
}

function brandCommissionIssues(rows: Row[]): number {
  return sumNumericField(rows, "overdue_commissions") + sumNumericField(rows, "open_disputes");
}

function brandPerformanceSummary(rows: Row[]) {
  return [
    { label: "Verified sales", value: formatMoney(sumNumericField(rows, "verified_value")) },
    { label: "Opening orders", value: formatCount(sumNumericField(rows, "opening_orders")) },
    { label: "Active accounts", value: formatCount(sumNumericField(rows, "active_accounts")) },
    { label: "Agreements", value: formatCount(sumNumericField(rows, "active_agreements")) },
    { label: "Commission issues", value: formatCount(brandCommissionIssues(rows)) }
  ];
}

/** Prefer outcome-first columns; fold overdue + disputes into one commission signal. */
function brandPerformanceRows(rows: Row[]): Row[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    verified_value: row.verified_value,
    opening_orders: row.opening_orders ?? row.verified_orders ?? 0,
    active_accounts: row.active_accounts,
    active_agreements: row.active_agreements,
    commission_issues:
      (parseNumeric(row.overdue_commissions) ?? 0) + (parseNumeric(row.open_disputes) ?? 0)
  }));
}

function buyerPerformanceSummary(rows: Row[]) {
  return [
    { label: "Buyers", value: formatCount(rows.length) },
    { label: "Outreach", value: formatCount(sumNumericField(rows, "outreach")) },
    { label: "Replies", value: formatCount(sumNumericField(rows, "replies")) },
    { label: "Opening orders", value: formatCount(sumNumericField(rows, "opening_orders")) },
    { label: "Reorders", value: formatCount(sumNumericField(rows, "reorders")) },
    { label: "Verified sales", value: formatMoney(sumNumericField(rows, "verified_value")) }
  ];
}

function metricLabel(code: string, fallback?: string): string {
  return metricLabels[code] ?? fallback ?? label(code);
}

function metricDisplay(value: unknown, code?: string): { text: string; unavailable: boolean } {
  if (
    value === null
    || value === undefined
    || value === ""
    || value === UNAVAILABLE
    || (typeof value === "string" && /unavailable/i.test(value))
  ) {
    return { text: "-", unavailable: true };
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    return { text: "-", unavailable: true };
  }
  const asRate = Boolean(code && RATE_METRIC_CODES.has(code));
  const numeric = parseNumeric(value);
  if (asRate) {
    if (numeric === null || numeric < 0) return { text: "-", unavailable: true };
    return { text: `${(numeric * 100).toFixed(1)}%`, unavailable: false };
  }
  if (numeric !== null) {
    return { text: formatCount(numeric), unavailable: false };
  }
  return { text: shown(value), unavailable: false };
}

function percentOf(part: number, whole: number): string | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  const pct = Math.round((part / whole) * 100);
  return `${pct}%`;
}

function DataTable({
  rows,
  empty,
  linkBase,
  columnLabels,
  formatValue
}: {
  rows: Row[];
  empty: string;
  linkBase?: string;
  columnLabels?: Record<string, string>;
  formatValue?: (column: string, value: unknown, row: Row) => string;
}) {
  if (!rows.length) return <EmptyState compact description={empty} />;
  const columns = Object.keys(rows[0] ?? {}).filter((column) => !(linkBase && column === "id")).slice(0, 8);
  return (
    <Table caption="Analytics results" compact className="ry-analytics-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th scope="col" key={column}>{analyticsColumnLabel(column, columnLabels)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <DataRow key={shown(row.id, String(index))}>
            {columns.map((column) => {
              const raw = row[column];
              const text = formatValue ? formatValue(column, raw, row) : typeof raw === "object" ? JSON.stringify(raw) : shown(raw);
              return (
                <td key={column}>
                  {linkBase && column === "name" && row.id
                    ? <Link to={`${linkBase}/${shown(row.id)}`}>{text}</Link>
                    : text}
                </td>
              );
            })}
          </DataRow>
        ))}
      </tbody>
    </Table>
  );
}

function MetricBoard({
  data,
  codes,
  tone = "primary",
  label: boardLabel,
  labels,
  contextFor
}: {
  data: AnalyticsData;
  codes: string[];
  tone?: "primary" | "secondary";
  label?: string;
  labels?: Record<string, string>;
  contextFor?: (code: string, metrics: Record<string, unknown>) => string | null;
}) {
  const definitions = new Map(data.definitions.map((item) => [item.code, item]));
  return (
    <dl className={tone === "primary" ? "ry-analytics-board" : "ry-analytics-board ry-analytics-board-secondary"} aria-label={boardLabel ?? "Analytics metrics"}>
      {codes.map((code) => {
        const definition = definitions.get(code);
        const display = metricDisplay(data.metrics[code], code);
        const context = contextFor?.(code, data.metrics) ?? null;
        return (
          <div key={code} className={display.unavailable ? "is-unavailable" : undefined}>
            <dt title={typeof definition?.businessMeaning === "string" ? definition.businessMeaning : undefined}>
              {labels?.[code] ?? metricLabel(code, definition?.name)}
            </dt>
            <dd
              className="tabular-nums"
              title={display.unavailable ? UNAVAILABLE : shown(definition?.businessMeaning, definition?.name)}
            >
              <span className="ry-analytics-metric-value">{display.text}</span>
              {context ? <small className="ry-analytics-metric-context">{context}</small> : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function AnalyticsWorkspacePage() {
  const [search, setSearch] = useSearchParams();
  const view = search.get("view") ?? "representative";
  const [from, setFrom] = useState(search.get("from") ?? new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(search.get("to") ?? new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState(search.get("currency") ?? "");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const query = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    if (currency) params.set("currency", currency);
    return params.toString();
  }, [currency, from, to]);
  const currencyOptions = useMemo(() => {
    if (!data) return currency ? [currency] : [];
    const codes = new Set<string>();
    for (const row of [...data.currencyTotals.orders, ...data.currencyTotals.commissions]) {
      const code = shown(row.currency, "").trim();
      if (code) codes.add(code);
    }
    if (currency) codes.add(currency);
    return [...codes].sort();
  }, [currency, data]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api<AnalyticsData>(`/api/analytics?${query}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analytics could not be calculated.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  function changeView(next: string) {
    const copy = new URLSearchParams(search);
    copy.set("view", next);
    setSearch(copy);
  }

  const exportUrl = `/api/analytics/export?reportType=${view === "commercial" ? "commissions" : view === "products" ? "product_performance" : view === "brands" ? "brand_performance" : view === "buyers" ? "buyer_performance" : view === "portfolio" ? "portfolio_health" : view === "pipeline" ? "pipeline" : "representative_activity"}&${query}`;

  return (
    <div className="page ry-analytics-page">
      <PageHeader
        title="Analytics"
        description="Wholesale performance across outreach, placements, and verified sales."
        action={(
          <div className="ry-analytics-header-actions">
            <button
              type="button"
              className={view === "definitions" ? "ry-analytics-definitions-launch is-active" : "ry-analytics-definitions-launch"}
              aria-current={view === "definitions" ? "page" : undefined}
              onClick={() => changeView("definitions")}
            >
              Metric guide
            </button>
            {view !== "definitions" ? (
              <a className="ry-button ry-button-secondary ry-control-compact" href={exportUrl}>Export data</a>
            ) : null}
          </div>
        )}
      />

      {view !== "definitions" ? (
        <div className="ry-analytics-nav" role="tablist" aria-label="Analytics sections">
          {primaryViews.map(([value, shortLabel, fullLabel]) => (
            <button
              key={value}
              type="button"
              role="tab"
              className={view === value ? "active" : undefined}
              aria-label={fullLabel}
              aria-selected={view === value}
              onClick={() => changeView(value)}
            >
              {shortLabel}
            </button>
          ))}
        </div>
      ) : (
        <div className="ry-analytics-definitions-bar">
          <button type="button" className="ry-analytics-back" onClick={() => changeView("representative")}>
            ← Back to Analytics
          </button>
        </div>
      )}

      {view !== "definitions" ? (
        <div className="ry-analytics-toolbar" role="group" aria-label="Analytics filters">
          <Field label="From">
            <Input
              type="date"
              controlSize="compact"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              controlSize="compact"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
          <Field label="Currency">
            <Select
              controlSize="compact"
              value={currency}
              title="All currencies shows separate currency groups."
              onChange={(event) => setCurrency(event.target.value)}
            >
              <option value="">All currencies</option>
              {currencyOptions.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </Select>
          </Field>
          <Button variant="secondary" size="compact" onClick={() => void load()}>Apply</Button>
        </div>
      ) : null}

      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}
      {loading ? <LoadingState label="Reconciling analytics to source records" /> : null}

      {data && !loading ? (
        <div className="ry-analytics-body">
          {data.partialData
            ? <StatusLabel value="partial" label="Partial data — review source coverage" />
            : null}
          {view === "representative" ? <RepresentativeView data={data} /> : null}
          {view === "products" ? (
            <DataPanel
              title="Product performance"
              description="See how products are progressing through placements and verified sales."
              rows={data.products}
              summary={productPerformanceSummary(data.products)}
              linkBase="/products"
              columnLabels={PERFORMANCE_COLUMN_LABELS}
              empty="No Product records match these filters."
            />
          ) : null}
          {view === "brands" ? (
            <DataPanel
              title="Brand performance"
              description="See how brands are progressing through accounts and verified sales."
              rows={brandPerformanceRows(data.brands)}
              summary={brandPerformanceSummary(data.brands)}
              linkBase="/brands"
              columnLabels={BRAND_COLUMN_LABELS}
              empty="No Brand records match these filters."
            />
          ) : null}
          {view === "buyers" ? (
            <DataPanel
              title="Buyer performance"
              description="See how buyers move from outreach through verified sales."
              rows={data.buyers}
              summary={buyerPerformanceSummary(data.buyers)}
              linkBase="/buyers"
              columnLabels={PERFORMANCE_COLUMN_LABELS}
              empty="No Buyer records match these filters."
            />
          ) : null}
          {view === "pipeline" ? <PipelineView data={data} /> : null}
          {view === "commercial" ? <CommercialView data={data} /> : null}
          {view === "portfolio" ? <PortfolioView data={data} /> : null}
          {view === "reports" ? <ReportsView query={query} /> : null}
          {view === "definitions" ? <DefinitionsView definitions={data.definitions} /> : null}

          {/* Future: <ExternalReadiness data={data} /> when external intelligence is surfaced in Analytics. */}
        </div>
      ) : null}
    </div>
  );
}

function RepresentativeView({ data }: { data: AnalyticsData }) {
  void UNAVAILABLE;
  const outreachContext = (code: string, metrics: Record<string, unknown>) => {
    const sent = Number(metrics.sent_messages ?? 0);
    const delivered = Number(metrics.delivered ?? 0);
    const replied = Number(metrics.replied ?? 0);
    const positive = Number(metrics.positive ?? 0);
    const conversation = Number(metrics.conversation ?? 0);
    const bounced = Number(metrics.bounced ?? 0);
    const complained = Number(metrics.complained ?? 0);
    const optedOut = Number(metrics.opted_out ?? 0);
    if (code === "delivered") {
      const pct = percentOf(delivered, sent);
      return pct && sent > 0 ? `${pct} of sent` : null;
    }
    if (code === "replied") {
      const pct = percentOf(replied, sent);
      return pct && sent > 0 ? `${pct} of sent` : null;
    }
    if (code === "positive") {
      const pct = percentOf(positive, replied > 0 ? replied : sent);
      return pct && (replied > 0 || sent > 0) ? `${pct} of ${replied > 0 ? "replies" : "sent"}` : null;
    }
    if (code === "conversation") {
      const pct = percentOf(conversation, sent);
      return pct && sent > 0 ? `${pct} of sent` : null;
    }
    if (code === "bounced") {
      const pct = percentOf(bounced, sent);
      return pct && sent > 0 ? `${pct} of sent` : null;
    }
    if (code === "complained") {
      const pct = percentOf(complained, sent);
      return pct && sent > 0 ? `${pct} of sent` : null;
    }
    if (code === "opted_out") {
      const pct = percentOf(optedOut, sent);
      return pct && sent > 0 ? `${pct} of sent` : null;
    }
    return null;
  };
  return (
    <>
      <section className="ry-analytics-section" aria-labelledby="analytics-glance-heading">
        <header className="ry-analytics-section-head">
          <h2 id="analytics-glance-heading">Performance overview</h2>
        </header>
        <MetricBoard
          data={data}
          label="Key performance"
          codes={["sent_messages", "replied", "opening_order_count", "active_placement_opportunities", "stalled_opportunities"]}
          labels={{
            sent_messages: "Outreach sent",
            replied: "Replies",
            opening_order_count: "Opening orders",
            active_placement_opportunities: "Active placements",
            stalled_opportunities: "Stalled placements"
          }}
          contextFor={(code, metrics) => {
            const sent = Number(metrics.sent_messages ?? 0);
            const replied = Number(metrics.replied ?? 0);
            const active = Number(metrics.active_placement_opportunities ?? 0);
            const stalled = Number(metrics.stalled_opportunities ?? 0);
            if (code === "replied") {
              const pct = percentOf(replied, sent);
              return pct && sent > 0 ? `${pct} of sent` : null;
            }
            if (code === "stalled_opportunities") {
              const pct = percentOf(stalled, active);
              return pct && active > 0 ? `${pct} of active placements` : null;
            }
            return null;
          }}
        />
      </section>
      <section className="ry-analytics-section" aria-labelledby="analytics-outreach-heading">
        <header className="ry-analytics-section-head">
          <div>
            <h2 id="analytics-outreach-heading">Outreach</h2>
            <p>Message volume and engagement for the selected period.</p>
          </div>
        </header>
        <div className="ry-analytics-metric-groups">
          <div className="ry-analytics-metric-group">
            <h3>Messages</h3>
            <MetricBoard
              data={data}
              tone="secondary"
              label="Messages"
              codes={["approved_messages", "sent_messages", "delivered"]}
              labels={{
                approved_messages: "Messages approved",
                sent_messages: "Sent",
                delivered: "Delivered"
              }}
              contextFor={outreachContext}
            />
          </div>
          <div className="ry-analytics-metric-group">
            <h3>Engagement</h3>
            <MetricBoard
              data={data}
              tone="secondary"
              label="Engagement"
              codes={["replied", "positive", "conversation"]}
              labels={{
                replied: "Replies",
                positive: "Positive replies",
                conversation: "Conversations"
              }}
              contextFor={outreachContext}
            />
          </div>
          <div className="ry-analytics-metric-group">
            <h3>Delivery health</h3>
            <MetricBoard
              data={data}
              tone="secondary"
              label="Delivery health"
              codes={["bounced", "complained", "opted_out"]}
              labels={{
                bounced: "Bounces",
                complained: "Complaints",
                opted_out: "Opt-outs"
              }}
              contextFor={outreachContext}
            />
          </div>
        </div>
      </section>
      <section className="ry-analytics-section" aria-labelledby="analytics-outcomes-heading">
        <header className="ry-analytics-section-head">
          <div>
            <h2 id="analytics-outcomes-heading">Outcomes</h2>
            <p>Orders and placement movement recorded in Ryva.</p>
          </div>
        </header>
        <MetricBoard
          data={data}
          label="Outcome metrics"
          codes={["opening_order_count", "reorder_count", "opportunities_won", "opportunities_lost"]}
        />
      </section>
      <DataPanel
        title="Verified orders by currency"
        rows={data.currencyTotals.orders}
        columnLabels={COMMERCIAL_ORDER_COLUMN_LABELS}
        empty="No verified Orders match these filters."
      />
    </>
  );
}

function PanelSummaryBar({ items, label }: { items: Array<{ label: string; value: string }>; label: string }) {
  return (
    <dl className="ry-analytics-board" aria-label={label}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd className="tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DataPanel({
  title,
  description,
  rows,
  empty,
  linkBase,
  summary,
  columnLabels,
  formatValue
}: {
  title: string;
  description?: string;
  rows: Row[];
  empty: string;
  linkBase?: string;
  summary?: Array<{ label: string; value: string }>;
  columnLabels?: Record<string, string>;
  formatValue?: (column: string, value: unknown, row: Row) => string;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [rows]);
  const pageCount = Math.max(1, Math.ceil(rows.length / ANALYTICS_TABLE_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(
    () => rows.slice((currentPage - 1) * ANALYTICS_TABLE_PAGE_SIZE, currentPage * ANALYTICS_TABLE_PAGE_SIZE),
    [currentPage, rows]
  );

  return (
    <section className="ry-analytics-section">
      <header className="ry-analytics-section-head">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </header>
      {summary?.length ? <PanelSummaryBar items={summary} label={`${title} summary`} /> : null}
      <DataTable
        rows={pagedRows}
        empty={empty}
        {...(linkBase ? { linkBase } : {})}
        {...(columnLabels ? { columnLabels } : {})}
        formatValue={(column, value, row) => (
          formatValue ? formatValue(column, value, row) : formatAnalyticsCell(column, value, row)
        )}
      />
      {rows.length > ANALYTICS_TABLE_PAGE_SIZE ? (
        <RegisterPagination
          page={currentPage}
          pageCount={pageCount}
          total={rows.length}
          pageSize={ANALYTICS_TABLE_PAGE_SIZE}
          onPage={setPage}
        />
      ) : null}
    </section>
  );
}

const DAYS_INACTIVE_HINT =
  "Days since the last recorded meaningful action—not a close forecast.";

/** Rep-facing wholesale path — groups fine-grained placement stages. */
const PIPELINE_VISUAL_STAGES = [
  { key: "targeted", label: "Targeted", stages: ["identified", "qualified", "prepared"] },
  { key: "contacted", label: "Contacted", stages: ["contacted"] },
  { key: "interested", label: "Interested", stages: ["engaged", "information_sample_sent"] },
  { key: "reviewing", label: "Reviewing", stages: ["buyer_review"] },
  { key: "negotiating", label: "Negotiating", stages: ["terms_order_discussion", "opening_order"] },
  { key: "won", label: "Won", stages: ["active_account", "reorder_management"] }
] as const;

type PipelineStageBucket = {
  key: string;
  label: string;
  count: number;
  daysInactive: number | null;
};

function pipelineStageBuckets(distribution: Row[]): PipelineStageBucket[] {
  const byStage = new Map<string, { count: number; age: number | null }>();
  for (const row of distribution) {
    const stage = shown(row.stage, "");
    if (!stage) continue;
    byStage.set(stage, {
      count: Number(row.count) || 0,
      age: parseNumeric(row.average_age_days)
    });
  }
  return PIPELINE_VISUAL_STAGES.map((bucket) => {
    let count = 0;
    let ageWeighted = 0;
    let ageWeight = 0;
    for (const stage of bucket.stages) {
      const entry = byStage.get(stage);
      if (!entry) continue;
      count += entry.count;
      if (entry.age !== null && entry.count > 0) {
        ageWeighted += entry.age * entry.count;
        ageWeight += entry.count;
      }
    }
    return {
      key: bucket.key,
      label: bucket.label,
      count,
      daysInactive: ageWeight > 0 ? ageWeighted / ageWeight : null
    };
  });
}

function formatDaysInactive(days: number): string {
  const rounded = Math.round(days);
  if (rounded === 1) return "1 day inactive";
  return `${formatCount(rounded)} days inactive`;
}

function formatStageDetailValue(column: string, value: unknown): string {
  if (column === "stage") return label(shown(value));
  if (column === "average_age_days") {
    const days = parseNumeric(value);
    if (days === null) return "—";
    const rounded = Math.round(days * 10) / 10;
    if (rounded === 1) return "1 day";
    return `${rounded} days`;
  }
  if (column === "count") {
    const count = parseNumeric(value);
    return count === null ? shown(value) : formatCount(count);
  }
  return typeof value === "object" ? JSON.stringify(value) : shown(value);
}

function pipelineAttentionItems(metrics: Row, distribution: Row[]): string[] {
  const stalled = Number(metrics.stalled_opportunities ?? 0);
  const lacking = Number(metrics.opportunities_lacking_next_action ?? 0);
  const blocked = Number(metrics.blocked_opportunities ?? 0);
  const maxDays = distribution.reduce((highest, row) => {
    const age = parseNumeric(row.average_age_days);
    return age !== null && age > highest ? age : highest;
  }, 0);
  const items: string[] = [];
  if (Number.isFinite(stalled) && stalled > 0) {
    const days = Math.round(maxDays);
    items.push(
      days > 0
        ? `${formatCount(stalled)} placement${stalled === 1 ? "" : "s"} stalled for ${formatCount(days)} day${days === 1 ? "" : "s"}`
        : `${formatCount(stalled)} placement${stalled === 1 ? "" : "s"} stalled`
    );
  }
  if (Number.isFinite(lacking) && lacking > 0) {
    items.push(
      `${formatCount(lacking)} placement${lacking === 1 ? "" : "s"} ${lacking === 1 ? "has" : "have"} no next action`
    );
  }
  if (Number.isFinite(blocked) && blocked > 0) {
    items.push(`${formatCount(blocked)} placement${blocked === 1 ? "" : "s"} blocked`);
  }
  return items;
}

function DaysInactiveHint() {
  return (
    <button
      type="button"
      className="ry-analytics-info"
      title={DAYS_INACTIVE_HINT}
      aria-label={DAYS_INACTIVE_HINT}
    >
      i
    </button>
  );
}

function PipelineStageStrip({ buckets }: { buckets: PipelineStageBucket[] }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  return (
    <ol className="ry-analytics-pipeline-strip" aria-label="Placements by stage">
      {buckets.map((bucket) => (
        <li
          key={bucket.key}
          className={bucket.count > 0 ? "ry-analytics-pipeline-stage is-active" : "ry-analytics-pipeline-stage"}
        >
          <span className="ry-analytics-pipeline-stage-label">{bucket.label}</span>
          <strong className="ry-analytics-pipeline-stage-count tabular-nums">{formatCount(bucket.count)}</strong>
          {bucket.count > 0 && bucket.daysInactive !== null ? (
            <span className="ry-analytics-pipeline-stage-idle">
              <span>{formatDaysInactive(bucket.daysInactive)}</span>
              <DaysInactiveHint />
            </span>
          ) : (
            <span className="ry-analytics-pipeline-stage-idle is-empty" aria-hidden="true">
              {total > 0 ? "—" : ""}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function PipelineView({ data }: { data: AnalyticsData }) {
  const buckets = useMemo(() => pipelineStageBuckets(data.stageDistribution), [data.stageDistribution]);
  const attention = useMemo(
    () => pipelineAttentionItems(data.metrics, data.stageDistribution),
    [data.metrics, data.stageDistribution]
  );
  const won = Number(data.metrics.opportunities_won ?? 0);
  const lost = Number(data.metrics.opportunities_lost ?? 0);
  const hasPlacements = buckets.some((bucket) => bucket.count > 0) || won > 0 || lost > 0;

  return (
    <>
      <section className="ry-analytics-section" aria-labelledby="analytics-pipeline-heading">
        <header className="ry-analytics-section-head">
          <div>
            <h2 id="analytics-pipeline-heading">Pipeline</h2>
            <p>Follow placements through the wholesale path from first target to won account.</p>
          </div>
        </header>
        {hasPlacements ? (
          <PipelineStageStrip buckets={buckets} />
        ) : (
          <EmptyState compact description="No Placement Opportunities match these filters." />
        )}
        {(Number.isFinite(won) || Number.isFinite(lost)) && hasPlacements ? (
          <p className="ry-analytics-pipeline-outcomes">
            <span className="tabular-nums">{formatCount(won)}</span> won
            <span aria-hidden="true"> · </span>
            <span className="tabular-nums">{formatCount(lost)}</span> lost
          </p>
        ) : null}
      </section>
      <section className="ry-analytics-section" aria-labelledby="analytics-attention-heading">
        <header className="ry-analytics-section-head">
          <div>
            <h2 id="analytics-attention-heading">Needs attention</h2>
            <p>Stalled work, missing next actions, and blocked placements.</p>
          </div>
        </header>
        {attention.length ? (
          <ul className="ry-analytics-attention-list">
            {attention.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="ry-analytics-attention-clear">No placements need attention right now.</p>
        )}
      </section>
      {hasPlacements ? (
        <DataPanel
          title="Stage detail"
          rows={data.stageDistribution}
          empty="No Placement Opportunities match these filters."
          columnLabels={{
            stage: "Stage",
            count: "Placements",
            average_age_days: "Days inactive"
          }}
          formatValue={(column, value) => formatStageDetailValue(column, value)}
        />
      ) : null}
      {/* Future: <ForecastPanel forecasts={data.forecasts} /> when user-entered ranges are surfaced on Pipeline. */}
    </>
  );
}

/** Keep each currency’s money distinct — never sum EUR into USD without FX. */
function formatMoneyByCurrency(rows: Row[], field: string): string {
  if (!rows.length) return formatMoney(0, "USD");
  const parts = rows.map((row) => {
    const amount = parseNumeric(row[field]) ?? 0;
    const currency = shown(row.currency, "USD");
    return formatMoney(amount, currency);
  });
  return parts.join(" · ");
}

function commercialPerformanceSummary(orders: Row[], commissions: Row[]) {
  return [
    { label: "Verified sales", value: formatMoneyByCurrency(orders, "verified") },
    { label: "Opening orders", value: formatCount(sumNumericField(orders, "opening_count")) },
    { label: "Reorders", value: formatCount(sumNumericField(orders, "reorder_count")) },
    { label: "Returns", value: formatMoneyByCurrency(orders, "returns") },
    { label: "Paid commission", value: formatMoneyByCurrency(commissions, "paid") }
  ];
}

const COMMERCIAL_ORDER_COLUMN_LABELS: Record<string, string> = {
  opening_count: "Opening orders",
  reorder_count: "Reorders",
  verified: "Verified sales",
  opening_value: "Opening sales",
  reorder_value: "Reorder sales"
};

function CommercialView({ data }: { data: AnalyticsData }) {
  return (
    <>
      <section className="ry-analytics-section" aria-label="Commercial summary">
        <PanelSummaryBar
          items={commercialPerformanceSummary(data.currencyTotals.orders, data.currencyTotals.commissions)}
          label="Commercial summary"
        />
      </section>
      <DataPanel
        title="Verified orders by currency"
        rows={data.currencyTotals.orders}
        columnLabels={COMMERCIAL_ORDER_COLUMN_LABELS}
        empty="No verified Orders match these filters."
      />
      <DataPanel
        title="Commission summary"
        description="Track commissions from expected through payment."
        rows={data.currencyTotals.commissions}
        empty="No Commission records match these filters."
      />
      <p className="ry-analytics-currency-note">Currencies are shown separately.</p>
    </>
  );
}

function portfolioNeedsAttention(metrics: Row): number {
  const atRisk = Math.max(0, Number(metrics.at_risk_accounts ?? 0) || 0);
  const overdue = Math.max(0, Number(metrics.overdue_reorders ?? 0) || 0);
  const openRisks = Math.max(0, Number(metrics.open_risks ?? 0) || 0);
  return atRisk + overdue + openRisks;
}

function PortfolioView({ data }: { data: AnalyticsData }) {
  const attention = portfolioNeedsAttention(data.metrics);
  return (
    <section className="ry-analytics-section" aria-labelledby="analytics-portfolio-heading">
      <header className="ry-analytics-section-head">
        <div>
          <h2 id="analytics-portfolio-heading">Portfolio health</h2>
          <p>Monitor active accounts, reorder activity, and commercial risk.</p>
        </div>
      </header>
      <MetricBoard
        data={data}
        label="Portfolio health"
        codes={["active_accounts", "at_risk_accounts", "upcoming_reorders", "overdue_reorders", "open_risks"]}
        labels={{
          active_accounts: "Active accounts",
          at_risk_accounts: "Accounts at risk",
          upcoming_reorders: "Reorders due soon",
          overdue_reorders: "Overdue reorders",
          open_risks: "Open risks"
        }}
      />
      {attention > 0 ? (
        <p className="ry-analytics-health-sentence">
          {attention === 1
            ? "1 account needs attention."
            : `${formatCount(attention)} accounts need attention.`}
        </p>
      ) : (
        <div className="ry-analytics-portfolio-clear">
          <p>Your portfolio looks healthy.</p>
          <p>No overdue reorders or open commercial risks.</p>
        </div>
      )}
    </section>
  );
}

function ForecastPanel({ forecasts }: { forecasts: Row[] }) {
  void ["No user-entered forecast ranges. Ryva will not fabricate one."];
  if (!forecasts.length) return null;

  return (
    <section className="ry-analytics-section">
      <header className="ry-analytics-section-head">
        <div>
          <h2>User-entered ranges</h2>
          <p>Low/base/high values and qualitative likelihood are manual inputs linked to stored evidence. They are not guaranteed income or system probabilities.</p>
        </div>
        <StatusLabel value="disabled" label="Weighted pipeline disabled" />
      </header>
      <ul className="ry-analytics-forecast-list">
          {forecasts.map((forecast, index) => (
            <li key={shown(forecast.id, String(index))}>
              <strong>{shown(forecast.name, "User-entered forecast")}</strong>
              <ForecastRange
                low={typeof forecast.low === "number" ? forecast.low : null}
                base={typeof forecast.base === "number" ? forecast.base : null}
                high={typeof forecast.high === "number" ? forecast.high : null}
                currency={shown(forecast.currency, "USD")}
                assumptions={shown(forecast.likelihood, "No qualitative likelihood recorded")}
              />
            </li>
          ))}
        </ul>
    </section>
  );
}

function DefinitionsView({ definitions }: { definitions: Definition[] }) {
  const [query, setQuery] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash.startsWith("metric-")) return;
    const code = hash.slice("metric-".length);
    if (!code) return;
    setOpenCode(code);
    window.requestAnimationFrame(() => {
      document.getElementById(`metric-${code}`)?.scrollIntoView({ block: "nearest" });
    });
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return definitions;
    return definitions.filter((definition) => definitionSearchBlob(definition).includes(needle));
  }, [definitions, query]);

  function toggleMetric(code: string) {
    setOpenCode((current) => {
      const next = current === code ? null : code;
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (next) url.hash = `metric-${next}`;
        else url.hash = "";
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
      return next;
    });
  }

  return (
    <section className="ry-analytics-guide" aria-labelledby="analytics-guide-heading">
      <header className="ry-analytics-section-head">
        <div>
          <h2 id="analytics-guide-heading">Metric guide</h2>
          <p>Definitions, formulas, and data rules for every Analytics metric.</p>
        </div>
      </header>
      <div className="ry-analytics-definitions-search">
        <SearchInput
          label="Search metric guide"
          placeholder="Search metrics by name, code, or definition text"
          controlSize="compact"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
        />
      </div>
      <p className="ry-analytics-definitions-scope">
        Platform outcomes describe the recorded Ryva context and do not prove general market demand.
        Ryva does not define one ideal portfolio count or produce a Portfolio Score.
        Analytics does not invent a Product Score or hidden win-rate forecast.
      </p>
      {filtered.length ? (
        <ul className="ry-analytics-guide-list">
          {filtered.map((definition) => {
            const expanded = openCode === definition.code;
            const detailId = `metric-${definition.code}-detail`;
            const valueLabel = definitionValueLabel(definition);
            return (
              <li
                id={`metric-${definition.code}`}
                key={definition.code}
                className={expanded ? "ry-analytics-guide-item is-open" : "ry-analytics-guide-item"}
              >
                <button
                  type="button"
                  className="ry-analytics-guide-trigger"
                  aria-expanded={expanded}
                  aria-controls={detailId}
                  onClick={() => toggleMetric(definition.code)}
                >
                  <span className="ry-analytics-guide-copy">
                    <span className="ry-analytics-guide-name">{definition.name}</span>
                    <span className="ry-analytics-guide-summary">{definitionDescription(definition)}</span>
                  </span>
                  {valueLabel ? <span className="ry-analytics-guide-meta">{valueLabel}</span> : null}
                  <span className="ry-analytics-guide-chevron" aria-hidden="true">{expanded ? "−" : "+"}</span>
                </button>
                {expanded ? (
                  <div id={detailId} className="ry-analytics-guide-detail">
                    <dl>
                      {definitionExpandFields.map((field) => (
                        <div key={field}>
                          <dt>{definitionExpandLabels[field]}</dt>
                          <dd>
                            {Array.isArray(definition[field])
                              ? (definition[field] as string[]).join(", ")
                              : shown(definition[field])}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState compact description="No metrics match this search." />
      )}
    </section>
  );
}

function ExternalReadiness({ data }: { data: AnalyticsData }) {
  return (
    <aside className="ry-analytics-external" aria-label="External intelligence readiness">
      <StatusLabel value={data.externalIntelligence.status} />
      <p>{data.externalIntelligence.message || "No verified external intelligence is connected."}</p>
      <small>Future pattern: External Data → Verified Metric Calculation → Evidence and Limitation Record → AI Explanation. Statistical outputs remain separate from AI prose.</small>
    </aside>
  );
}

void ForecastPanel;
void ExternalReadiness;

/** Saved report definitions API — not surfaced in Reports UI yet. */
const analyticsReportDefinitionApi = { method: "POST", path: "/api/analytics/reports" };
void analyticsReportDefinitionApi;

function viewToReportType(view: string): string {
  switch (view) {
    case "commercial":
      return "commissions";
    case "products":
      return "product_performance";
    case "brands":
      return "brand_performance";
    case "buyers":
      return "buyer_performance";
    case "pipeline":
      return "pipeline";
    case "portfolio":
      return "portfolio_health";
    default:
      return "representative_activity";
  }
}

const analyticsDownloadReports = primaryViews
  .filter(([viewKey]) => viewKey !== "reports")
  .map(([viewKey, shortLabel, fullLabel]) => ({
    viewKey,
    shortLabel,
    fullLabel,
    reportType: viewToReportType(viewKey)
  }));

function filtersFromQuery(query: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(query));
}

function exportHref(reportType: string, filters: Record<string, unknown>): string {
  const params = new URLSearchParams({ reportType });
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      if (value !== "") params.set(key, String(value));
    }
  }
  return `/api/analytics/export?${params.toString()}`;
}

function ReportsView({ query }: { query: string }) {
  const filters = useMemo(() => filtersFromQuery(query), [query]);

  return (
    <section className="ry-analytics-section">
      <header className="ry-analytics-section-head">
        <div>
          <h2>Reports</h2>
          <p>Download a CSV for any Analytics tab using the filters above. Currencies stay separate.</p>
        </div>
      </header>
      <Table caption="Analytics CSV exports" compact className="ry-analytics-table ry-analytics-report-list">
        <thead>
          <tr>
            <th scope="col">Report</th>
            <th scope="col">Open tab</th>
            <th scope="col">Download</th>
          </tr>
        </thead>
        <tbody>
          {analyticsDownloadReports.map((report) => (
            <DataRow key={report.reportType}>
              <td>{report.shortLabel}</td>
              <td>
                <Link className="ry-analytics-report-tab-link" to={{ search: `?view=${report.viewKey}&${query}` }}>
                  {report.shortLabel}
                </Link>
              </td>
              <td className="ry-analytics-report-download-cell">
                <a
                  className="ry-button ry-button-secondary ry-control-compact"
                  href={exportHref(report.reportType, filters)}
                >
                  Download
                </a>
              </td>
            </DataRow>
          ))}
        </tbody>
      </Table>
    </section>
  );
}
