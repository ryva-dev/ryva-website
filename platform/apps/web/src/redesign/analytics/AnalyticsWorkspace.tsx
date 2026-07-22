import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import {
  Button,
  DataRow,
  DateRangePicker,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  ForecastRange,
  Input,
  LoadingState,
  Metric,
  PageHeader,
  StatusLabel,
  Table,
  Tabs
} from "../../design-system";

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

const views = [
  ["representative", "Representative Performance"],
  ["products", "Product Performance"],
  ["brands", "Brand Performance"],
  ["buyers", "Buyer Performance"],
  ["pipeline", "Pipeline Analytics"],
  ["commercial", "Commercial Analytics"],
  ["portfolio", "Portfolio Health"],
  ["reports", "Reports"],
  ["definitions", "Metric Definitions"]
] as const;

function shown(value: unknown, fallback = "—"): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function numberOrUnavailable(value: unknown): string {
  if (value === null || value === undefined) return "Unavailable — denominator or provider data is absent";
  return typeof value === "number" && value > 0 && value <= 1 ? `${(value * 100).toFixed(1)}%` : shown(value);
}

function DataTable({ rows, empty, linkBase }: { rows: Row[]; empty: string; linkBase?: string }) {
  if (!rows.length) return <EmptyState compact description={empty} />;
  const columns = Object.keys(rows[0] ?? {}).filter((column) => !(linkBase && column === "id")).slice(0, 8);
  return (
    <Table caption="Analytics results">
      <thead><tr>{columns.map((column) => <th scope="col" key={column}>{label(column)}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => (
        <DataRow key={shown(row.id, String(index))}>
          {columns.map((column) => (
            <td key={column}>
              {linkBase && column === "name" && row.id
                ? <Link to={`${linkBase}/${shown(row.id)}`}>{shown(row[column])}</Link>
                : typeof row[column] === "object" ? JSON.stringify(row[column]) : shown(row[column])}
            </td>
          ))}
        </DataRow>
      ))}</tbody>
    </Table>
  );
}

function MetricGrid({ data, codes }: { data: AnalyticsData; codes: string[] }) {
  const definitions = new Map(data.definitions.map((item) => [item.code, item]));
  return (
    <section className="ry-analytics-metrics" aria-label="Analytics metrics">
      {codes.map((code) => {
        const definition = definitions.get(code);
        return (
          <Metric
            key={code}
            label={definition?.name ?? label(code)}
            value={numberOrUnavailable(data.metrics[code])}
            definition={<details><summary>Definition</summary><p>{shown(definition?.formula)}</p><small>{shown(definition?.knownLimitations)}</small></details>}
          />
        );
      })}
    </section>
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
        eyebrow="Explainable operations"
        title="Analytics Command Center"
        description="Current Ryva records, visible definitions, accessible drill-downs, currency separation, and explicit actual-versus-estimate treatment. No Product Score or hidden probability."
        action={<a className="ry-button ry-button-secondary" href={exportUrl}>Export permitted CSV</a>}
      />
      <Tabs label="Analytics sections" className="ry-analytics-tabs">
        {views.map(([value, name]) => (
          <Button key={value} variant="tertiary" className={view === value ? "active" : ""} aria-current={view === value ? "page" : undefined} onClick={() => changeView(value)}>
            {name}
          </Button>
        ))}
      </Tabs>
      <FilterBar label="Analytics filters" className="ry-analytics-filters" actions={<Button variant="secondary" onClick={() => void load()}>Recalculate</Button>}>
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <Field label="Currency" hint="Blank shows separate currency groups.">
          <Input maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
        </Field>
      </FilterBar>
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => void load()}>Try again</Button>} /> : null}
      {loading ? <LoadingState label="Reconciling analytics to source records" /> : null}
      {data && !loading ? (
        <>
          <section className="ry-analytics-freshness" aria-label="Calculation freshness">
            <span>Period {data.period.from}–{data.period.to}</span>
            <span>Calculated {new Date(data.generatedAt).toLocaleString()}</span>
            <span>Currencies separate · live calculation</span>
            {data.partialData ? <StatusLabel value="partial" label="Partial data — review source coverage" /> : null}
          </section>
          {view === "representative" ? <RepresentativeView data={data} /> : null}
          {view === "products" ? <DataPanel title="Product performance" description="Platform outcomes describe the recorded Ryva context and do not prove general market demand." rows={data.products} linkBase="/products" empty="No Product records match these filters. No external value is inferred." /> : null}
          {view === "brands" ? <DataPanel title="Brand performance" rows={data.brands} linkBase="/brands" empty="No Brand records match these filters." /> : null}
          {view === "buyers" ? <DataPanel title="Buyer and Business performance" rows={data.buyers} linkBase="/buyers" empty="No Business records match these filters." /> : null}
          {view === "pipeline" ? <PipelineView data={data} /> : null}
          {view === "commercial" ? <CommercialView data={data} /> : null}
          {view === "portfolio" ? <PortfolioView data={data} /> : null}
          {view === "reports" ? <ReportsView query={query} /> : null}
          {view === "definitions" ? <DefinitionsView definitions={data.definitions} /> : null}
          <ExternalReadiness data={data} />
        </>
      ) : null}
    </div>
  );
}

function RepresentativeView({ data }: { data: AnalyticsData }) {
  return <><MetricGrid data={data} codes={["outreach_volume", "approved_messages", "sent_messages", "delivery_rate", "bounce_rate", "complaint_rate", "opt_out_rate", "reply_rate", "positive_response_rate", "conversation_rate", "opening_order_count", "reorder_count", "active_placement_opportunities", "opportunities_won", "opportunities_lost", "stalled_opportunities"]} /><DataPanel title="Commercial outcomes by currency" rows={data.currencyTotals.orders} empty="No verified Orders match these filters." /></>;
}

function DataPanel({ title, description, rows, empty, linkBase }: { title: string; description?: string; rows: Row[]; empty: string; linkBase?: string }) {
  return <section className="panel ry-analytics-panel"><h2>{title}</h2>{description ? <p>{description}</p> : null}<DataTable rows={rows} empty={empty} {...(linkBase ? { linkBase } : {})} /></section>;
}

function PipelineView({ data }: { data: AnalyticsData }) {
  return <><MetricGrid data={data} codes={["active_placement_opportunities", "stalled_opportunities", "opportunities_lacking_next_action", "blocked_opportunities", "opportunities_won", "opportunities_lost"]} /><DataPanel title="Stage distribution and aging" description="Counts and average age come directly from current Placement records. No stage probability is applied." rows={data.stageDistribution} empty="No Placement Opportunities match these filters." /><ForecastPanel forecasts={data.forecasts} /></>;
}

function CommercialView({ data }: { data: AnalyticsData }) {
  return <><DataPanel title="Verified Orders by currency" rows={data.currencyTotals.orders} empty="No verified Orders match these filters." /><DataPanel title="Expected commission" description="Expected estimates, approved, payable, paid, disputed, overdue, and clawback values remain distinct." rows={data.currencyTotals.commissions} empty="No Commission records match these filters." /><p className="ry-analytics-currency-note">Grouped by ISO currency; currencies are never combined.</p></>;
}

function PortfolioView({ data }: { data: AnalyticsData }) {
  return <><MetricGrid data={data} codes={["active_accounts", "at_risk_accounts", "upcoming_reorders", "overdue_reorders", "high_open_risks", "open_risks"]} /><section className="panel ry-analytics-panel"><h2>Context, not a universal health score</h2><p>Review concentration through the Brand, Product, Buyer, Order, and Commission tables. Ryva does not define one ideal portfolio count or produce a Portfolio Score.</p><div className="ry-analytics-links"><Link to="/brands">Review Brands</Link><Link to="/products">Review Products</Link><Link to="/accounts">Review Accounts</Link></div></section></>;
}

function ForecastPanel({ forecasts }: { forecasts: Row[] }) {
  return <section className="panel ry-analytics-panel"><header className="ry-analytics-section-heading"><div><p className="eyebrow">Transparent projections</p><h2>User-entered ranges</h2></div><StatusLabel value="disabled" label="Weighted pipeline disabled" /></header><p>Low/base/high values and qualitative likelihood are human inputs linked to stored evidence. They are not guaranteed income or system probabilities.</p>{forecasts.length ? <div className="ry-analytics-forecasts">{forecasts.map((forecast, index) => <article key={shown(forecast.id, String(index))}><strong>{shown(forecast.name, "User-entered forecast")}</strong><ForecastRange low={typeof forecast.low === "number" ? forecast.low : null} base={typeof forecast.base === "number" ? forecast.base : null} high={typeof forecast.high === "number" ? forecast.high : null} currency={shown(forecast.currency, "USD")} assumptions={shown(forecast.likelihood, "No qualitative likelihood recorded")} /></article>)}</div> : <EmptyState compact description="No user-entered forecast ranges. Ryva will not fabricate one." />}</section>;
}

function DefinitionsView({ definitions }: { definitions: Definition[] }) {
  return <section className="ry-analytics-definitions">{definitions.map((definition) => <article className="panel ry-analytics-panel" id={`metric-${definition.code}`} key={definition.code}><header className="ry-analytics-section-heading"><div><p className="eyebrow">{definition.code}</p><h2>{definition.name}</h2></div><StatusLabel value={shown(definition.valueStatus)} /></header><dl>{["businessMeaning", "formula", "includedRecords", "excludedRecords", "dateBehavior", "currencyBehavior", "freshnessBehavior", "knownLimitations", "sourceRecordTypes"].map((field) => <div key={field}><dt>{label(field)}</dt><dd>{Array.isArray(definition[field]) ? (definition[field] as string[]).join(", ") : shown(definition[field])}</dd></div>)}</dl></article>)}</section>;
}

function ExternalReadiness({ data }: { data: AnalyticsData }) {
  return <section className="panel ry-analytics-panel ry-analytics-external"><header className="ry-analytics-section-heading"><div><p className="eyebrow">External intelligence readiness</p><h2>{label(data.externalIntelligence.status)}</h2></div><StatusLabel value={data.externalIntelligence.status} /></header><p>{data.externalIntelligence.message || "No verified external intelligence is connected."}</p><small>Future pattern: External Data → Verified Metric Calculation → Evidence and Limitation Record → AI Explanation. Statistical outputs remain separate from AI prose.</small></section>;
}

function ReportsView({ query }: { query: string }) {
  const [reports, setReports] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  async function load() {
    try {
      setReports((await api<{ reports: Row[] }>("/api/analytics/reports")).reports);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reports unavailable.");
    }
  }
  useEffect(() => { void load(); }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/analytics/reports", { method: "POST", body: { name, reportType: "representative_activity", filters: Object.fromEntries(new URLSearchParams(query)), columns: [] } });
      setName("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Report could not be saved.");
    }
  }
  return <section className="panel ry-analytics-panel"><h2>Saved and exportable reports</h2><p>Exports carry filters, metric-definition versions, currencies, and value-status labels and are audited.</p>{error ? <ErrorState message={error} /> : null}<form className="ry-analytics-report-form" onSubmit={(event) => void save(event)}><Field label="Report name"><Input required value={name} onChange={(event) => setName(event.target.value)} /></Field><Button type="submit">Save current Representative report</Button></form><DataTable rows={reports} empty="No saved reports yet. Current Analytics can still be exported." /></section>;
}
