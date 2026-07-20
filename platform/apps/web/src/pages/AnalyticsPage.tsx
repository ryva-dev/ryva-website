import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { ErrorPanel, Field, Loading, PageHeader, StatusPill } from "../components";
import { DataRow, EmptyState, Metric, Table, Tabs } from "../design-system";

type Row=Record<string,unknown>;
type Definition=Row&{code:string;name:string};
type AnalyticsData={
  generatedAt:string;period:{from:string;to:string};filters:Row;partialData:boolean;
  externalIntelligence:{status:string;observationCount:number;latestObservationAt:string|null;message:string};
  metrics:Row;currencyTotals:{orders:Row[];commissions:Row[]};
  stageDistribution:Row[];products:Row[];brands:Row[];buyers:Row[];
  forecasts:Row[];definitions:Definition[];
};

const views=[
  ["representative","Representative Performance"],["products","Product Performance"],
  ["brands","Brand Performance"],["buyers","Buyer Performance"],["pipeline","Pipeline Analytics"],
  ["commercial","Commercial Analytics"],["portfolio","Portfolio Health"],
  ["reports","Reports"],["definitions","Metric Definitions"]
] as const;

function shown(value:unknown,fallback="—"):string {
  return typeof value==="string"||typeof value==="number"?String(value):fallback;
}
function label(value:string):string {
  return value.replaceAll("_"," ").replace(/\b\w/g,(letter)=>letter.toUpperCase());
}
function numberOrUnavailable(value:unknown):string {
  if(value===null||value===undefined)return "Unavailable — denominator or provider data is absent";
  return typeof value==="number"&&value>0&&value<=1?`${(value*100).toFixed(1)}%`:shown(value);
}

function DataTable({rows,empty,linkBase}:{rows:Row[];empty:string;linkBase?:string}) {
  if(!rows.length)return <EmptyState compact description={empty}/>;
  const columns=Object.keys(rows[0]!).filter(column=>!(linkBase&&column==="id")).slice(0,8);
  return <Table caption="Analytics results"><thead><tr>{columns.map(column=><th scope="col" key={column}>{label(column)}</th>)}</tr></thead>
    <tbody>{rows.map((row,index)=><DataRow key={shown(row.id,String(index))}>{columns.map(column=>
      <td key={column}>{linkBase&&column==="name"&&row.id
        ?<Link to={`${linkBase}/${shown(row.id)}`}>{shown(row[column])}</Link>
        :typeof row[column]==="object"?JSON.stringify(row[column]):shown(row[column])}</td>)}</DataRow>)}</tbody></Table>;
}

function MetricGrid({data,codes}:{data:AnalyticsData;codes:string[]}) {
  const definitions=new Map(data.definitions.map(item=>[item.code,item]));
  return <div className="analytics-metrics">{codes.map(code=>{
    const definition=definitions.get(code);
    return <Metric key={code} label={definition?.name??label(code)} value={numberOrUnavailable(data.metrics[code])}
      definition={<details><summary>Definition</summary><p>{shown(definition?.formula)}</p>
        <small>{shown(definition?.knownLimitations)}</small></details>}/>;
  })}</div>;
}

export function AnalyticsPage(){
  const [search,setSearch]=useSearchParams();
  const view=search.get("view")??"representative";
  const [from,setFrom]=useState(search.get("from")??new Date(Date.now()-90*86_400_000).toISOString().slice(0,10));
  const [to,setTo]=useState(search.get("to")??new Date().toISOString().slice(0,10));
  const [currency,setCurrency]=useState(search.get("currency")??"");
  const [data,setData]=useState<AnalyticsData|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const query=useMemo(()=>{
    const params=new URLSearchParams({from,to});
    if(currency)params.set("currency",currency);
    return params.toString();
  },[from,to,currency]);
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{setData(await api<AnalyticsData>(`/api/analytics?${query}`));}
    catch(caught){setError(caught instanceof Error?caught.message:"Analytics could not be calculated.");}
    finally{setLoading(false);}
  },[query]);
  useEffect(()=>{void load();},[load]);
  function changeView(next:string){const copy=new URLSearchParams(search);copy.set("view",next);setSearch(copy);}
  const exportUrl=`/api/analytics/export?reportType=${view==="commercial"?"commissions":view==="products"?"product_performance":view==="brands"?"brand_performance":view==="buyers"?"buyer_performance":view==="portfolio"?"portfolio_health":view==="pipeline"?"pipeline":"representative_activity"}&${query}`;

  return <div className="page analytics-page">
    <PageHeader eyebrow="Explainable operations" title="Analytics Command Center"
      description="Current Ryva records, visible definitions, accessible drill-downs, currency separation, and explicit actual-versus-estimate treatment. No Product Score or hidden probability."
      action={<a className="secondary-button" href={exportUrl}>Export permitted CSV</a>}/>
    <Tabs label="Analytics sections">{views.map(([value,name])=>
      <button className={view===value?"active":""} aria-current={view===value?"page":undefined} onClick={()=>changeView(value)} key={value}>{name}</button>)}</Tabs>
    <section className="panel analytics-filters" aria-label="Analytics filters">
      <Field label="From"><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></Field>
      <Field label="To"><input type="date" value={to} onChange={event=>setTo(event.target.value)}/></Field>
      <Field label="Currency" hint="Blank shows separate currency groups."><input maxLength={3} value={currency} onChange={event=>setCurrency(event.target.value.toUpperCase())}/></Field>
      <button className="secondary-button" onClick={()=>void load()}>Recalculate</button>
    </section>
    {error?<ErrorPanel message={error}/>:null}{loading?<Loading label="Reconciling analytics to source records"/>:null}
    {data&&!loading?<>
      <section className="analytics-freshness"><span>Period {data.period.from}–{data.period.to}</span>
        <span>Calculated {new Date(data.generatedAt).toLocaleString()}</span>
        <span className="quiet-tag">Currencies separate · live calculation</span></section>
      {view==="representative"?<section>
        <MetricGrid data={data} codes={["outreach_volume","approved_messages","sent_messages","delivery_rate","bounce_rate","complaint_rate","opt_out_rate","reply_rate","positive_response_rate","conversation_rate","opening_order_count","reorder_count","active_placement_opportunities","opportunities_won","opportunities_lost","stalled_opportunities"]}/>
        <section className="panel"><h2>Commercial outcomes by currency</h2><DataTable rows={data.currencyTotals.orders} empty="No verified Orders match these filters."/></section>
      </section>:null}
      {view==="products"?<section className="panel"><h2>Product performance</h2>
        <p>Platform outcomes describe the recorded Ryva context and do not prove general market demand.</p>
        <DataTable rows={data.products} linkBase="/products" empty="No Product records match these filters. No external value is inferred."/></section>:null}
      {view==="brands"?<section className="panel"><h2>Brand performance</h2>
        <DataTable rows={data.brands} linkBase="/brands" empty="No Brand records match these filters."/></section>:null}
      {view==="buyers"?<section className="panel"><h2>Buyer and Business performance</h2>
        <DataTable rows={data.buyers} linkBase="/buyers" empty="No Business records match these filters."/></section>:null}
      {view==="pipeline"?<PipelineView data={data}/>:null}
      {view==="commercial"?<CommercialView data={data}/>:null}
      {view==="portfolio"?<PortfolioView data={data}/>:null}
      {view==="reports"?<ReportsView query={query}/>:null}
      {view==="definitions"?<DefinitionsView definitions={data.definitions}/>:null}
      <section className="panel external-readiness">
        <div className="record-heading"><div><p className="eyebrow">External intelligence readiness</p><h2>{label(data.externalIntelligence.status)}</h2></div>
          <StatusPill value={data.externalIntelligence.status}/></div>
        <p>{data.externalIntelligence.message}</p>
        <small>Future pattern: External Data → Verified Metric Calculation → Evidence and Limitation Record → AI Explanation. Statistical outputs remain separate from AI prose.</small>
      </section>
    </>:null}
  </div>;
}

function PipelineView({data}:{data:AnalyticsData}){
  return <><MetricGrid data={data} codes={["active_placement_opportunities","stalled_opportunities","opportunities_lacking_next_action","blocked_opportunities","opportunities_won","opportunities_lost"]}/>
    <section className="panel"><h2>Stage distribution and aging</h2>
      <p>Counts and average age come directly from current Placement records. No stage probability is applied.</p>
      <DataTable rows={data.stageDistribution} empty="No Placement Opportunities match these filters."/></section>
    <ForecastPanel forecasts={data.forecasts}/></>;
}

function CommercialView({data}:{data:AnalyticsData}){
  return <><section className="panel"><h2>Verified Orders by currency</h2>
    <DataTable rows={data.currencyTotals.orders} empty="No verified Orders match these filters."/></section>
    <section className="panel"><h2>Commission reconciliation by currency</h2>
      <p>Expected estimates, approved, payable, paid, disputed, overdue, and clawback values remain distinct.</p>
      <DataTable rows={data.currencyTotals.commissions} empty="No Commission records match these filters."/></section></>;
}

function PortfolioView({data}:{data:AnalyticsData}){
  return <><MetricGrid data={data} codes={["active_accounts","at_risk_accounts","upcoming_reorders","overdue_reorders","high_open_risks","open_risks"]}/>
    <section className="panel"><h2>Context, not a universal health score</h2>
      <p>Review concentration through the Brand, Product, Buyer, Order, and Commission tables. Ryva does not define one ideal portfolio count or produce a Portfolio Score.</p>
      <div className="button-row"><Link to="/brands">Review Brands</Link><Link to="/products">Review Products</Link><Link to="/accounts">Review Accounts</Link></div>
    </section></>;
}

function ForecastPanel({forecasts}:{forecasts:Row[]}){
  return <section className="panel"><div className="record-heading"><div><p className="eyebrow">Transparent projections</p><h2>User-entered ranges</h2></div><span className="quiet-tag">Weighted pipeline disabled</span></div>
    <p>Low/base/high values and qualitative likelihood are human inputs linked to stored evidence. They are not guaranteed income or system probabilities.</p>
    <DataTable rows={forecasts} empty="No user-entered forecast ranges. Ryva will not fabricate one."/></section>;
}

function DefinitionsView({definitions}:{definitions:Definition[]}){
  return <section className="metric-dictionary">{definitions.map(definition=>
    <article className="panel" id={`metric-${definition.code}`} key={definition.code}>
      <div className="record-heading"><div><p className="eyebrow">{definition.code}</p><h2>{definition.name}</h2></div>
        <StatusPill value={shown(definition.valueStatus)}/></div>
      <dl className="detail-list">{["businessMeaning","formula","includedRecords","excludedRecords","dateBehavior","currencyBehavior","freshnessBehavior","knownLimitations","sourceRecordTypes"].map(field=>
        <div key={field}><dt>{label(field)}</dt><dd>{Array.isArray(definition[field])?(definition[field] as string[]).join(", "):shown(definition[field])}</dd></div>)}</dl>
    </article>)}</section>;
}

function ReportsView({query}:{query:string}){
  const [reports,setReports]=useState<Row[]>([]);const [name,setName]=useState("");const [error,setError]=useState("");
  async function load(){try{setReports((await api<{reports:Row[]}>("/api/analytics/reports")).reports);}catch(caught){setError(caught instanceof Error?caught.message:"Reports unavailable.");}}
  useEffect(()=>{void load();},[]);
  async function save(event:FormEvent){event.preventDefault();try{await api("/api/analytics/reports",{method:"POST",body:{name,reportType:"representative_activity",filters:Object.fromEntries(new URLSearchParams(query)),columns:[]}});setName("");await load();}catch(caught){setError(caught instanceof Error?caught.message:"Report could not be saved.");}}
  return <section className="panel"><h2>Saved and exportable reports</h2>
    <p>Exports carry filters, metric-definition versions, currencies, and value-status labels and are audited.</p>
    {error?<ErrorPanel message={error}/>:null}<form className="inline-form" onSubmit={event=>void save(event)}>
      <Field label="Report name"><input required value={name} onChange={event=>setName(event.target.value)}/></Field>
      <button className="primary-button">Save current Representative report</button></form>
    <DataTable rows={reports} empty="No saved reports yet. Current Analytics can still be exported."/></section>;
}
