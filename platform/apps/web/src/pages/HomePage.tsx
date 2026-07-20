import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import { ErrorPanel, Loading, PageHeader, StatusPill } from "../components";
import { AiBriefingPanel } from "./AiPages";

type Priority = {
  key:string;itemType:string;itemId:string;title:string;reason:string;
  explanation:string[];priority:string;dueAt:string|null;href:string;
  nextAction:string;blocking:boolean;
};
type MoneyRow = Record<string,string|number|null>;
type HomeData = {
  generatedAt:string;changedSince:string;priorities:Priority[];today:Priority[];
  changes:Array<{targetId:string;targetType:string;action:string;occurredAt:string}>;
  pipeline:Record<string,string|number|null>;
  commercial:{orders:MoneyRow[];commissions:MoneyRow[]};
  emptyWorkspace:boolean;
};

function readable(value:string):string {
  return value.replaceAll("_"," ").replace(/\b\w/g,(letter)=>letter.toUpperCase());
}

export function HomePage() {
  const { session } = useAuth();
  const [data,setData]=useState<HomeData|null>(null);
  const [error,setError]=useState("");
  const [saving,setSaving]=useState("");
  async function load() {
    try { setData(await api<HomeData>("/api/home-command-center")); }
    catch(caught) { setError(caught instanceof Error?caught.message:"Home priorities could not be loaded."); }
  }
  useEffect(()=>{void load();},[]);
  if(!session)return null;

  async function priorityAction(item:Priority,action:"completed"|"snoozed"|"dismissed"|"reprioritized",manualPriority?:string) {
    setSaving(item.key);setError("");
    try {
      const body:Record<string,unknown>={
        action,reason:action==="reprioritized"?"Representative changed priority.":`${readable(action)} from Home.`
      };
      if(action==="snoozed") body.snoozedUntil=new Date(Date.now()+24*60*60*1000).toISOString();
      if(manualPriority) body.manualPriority=manualPriority;
      setData(await api<HomeData>(`/api/home/priorities/${item.itemType}/${item.itemId}/actions`,{method:"POST",body}));
    } catch(caught) { setError(caught instanceof Error?caught.message:"Priority action could not be recorded."); }
    finally { setSaving(""); }
  }

  async function acknowledge() {
    try { await api("/api/home/acknowledge",{method:"POST"}); await load(); }
    catch(caught){setError(caught instanceof Error?caught.message:"Changes could not be acknowledged.");}
  }

  return <div className="page">
    <PageHeader eyebrow="Command center"
      title={`Good ${new Date().getHours()<12?"morning":new Date().getHours()<18?"afternoon":"evening"}, ${session.user.name.split(" ")[0]}.`}
      description="Today’s commitments, material changes, pipeline exceptions, commercial continuity, and evidence-first next actions." 
      action={<Link className="secondary-button" to="/analytics">Open Analytics</Link>}/>
    {error?<ErrorPanel message={error}/>:null}
    {!data?<Loading label="Calculating current priorities from authorized records"/>:null}
    {data?<>
      <section className="home-status-line" aria-label="Command center freshness">
        <StatusPill value={session.access.mode}/>
        <span>Calculated {new Date(data.generatedAt).toLocaleString()}</span>
        <span>Changes since {new Date(data.changedSince).toLocaleString()}</span>
        <span className="quiet-tag">Rule-based · reasons visible · no scores</span>
      </section>
      <section className="panel">
        <div className="record-heading"><div><p className="eyebrow">Today</p><h2>Priority queue</h2>
          <p>Authority and trust blockers, due commitments, replies, commercial deadlines, stalled work, then evidence review.</p></div>
          <Link to="/tasks">All tasks</Link></div>
        {data.priorities.length?<div className="priority-list">{data.priorities.map((item,index)=>
          <article className={`priority-item ${item.blocking?"priority-blocking":""}`} key={item.key}>
            <span className="priority-position">{String(index+1).padStart(2,"0")}</span>
            <div><div className="record-heading"><span><strong>{item.title}</strong>
              <small>{item.dueAt?new Date(item.dueAt).toLocaleString():"No recorded due date"}</small></span>
              <StatusPill value={item.priority}/></div>
              <p>{item.reason}</p>
              <details><summary>Why this is prioritized</summary><ul>{item.explanation.map(reason=><li key={reason}>{reason}</li>)}</ul></details>
              <p className="next-action"><strong>Next action:</strong> {item.nextAction}</p>
              <div className="button-row">
                <Link className="primary-button" to={item.href}>Open linked record</Link>
                {!item.blocking?<button className="secondary-button" disabled={saving===item.key} onClick={()=>void priorityAction(item,"snoozed")}>Snooze 1 day</button>:null}
                {!item.blocking?<button className="text-button" disabled={saving===item.key} onClick={()=>void priorityAction(item,"dismissed")}>Dismiss with reason</button>:null}
                {item.itemType==="task"&&!item.blocking?<button className="text-button" disabled={saving===item.key} onClick={()=>void priorityAction(item,"completed")}>Complete</button>:null}
                <select aria-label={`Reprioritize ${item.title}`} value={item.priority}
                  onChange={(event)=>void priorityAction(item,"reprioritized",event.target.value)}>
                  {["critical","high","medium","low"].map(value=><option key={value}>{value}</option>)}
                </select>
              </div>
            </div>
          </article>)}</div>:<p className="empty">{data.emptyWorkspace
          ?"No operating records yet. Add a Brand, Product, or Business to establish a responsible next action."
          :"No urgent queue items. Review the portfolio or research queue without treating inactivity as success."}</p>}
      </section>
      <section className="split-grid">
        <article className="panel">
          <div className="record-heading"><div><p className="eyebrow">What changed</p><h2>Material changes since last visit</h2></div>
            {data.changes.length?<button className="text-button" onClick={()=>void acknowledge()}>Acknowledge viewed</button>:null}</div>
          {data.changes.length?<div className="timeline">{data.changes.map((change,index)=>
            <Link className="timeline-item" to="/search" key={`${change.targetId}-${change.occurredAt}-${index}`}>
              <span className="audit-dot"/><span><strong>{readable(change.action)}</strong>
                <small>{readable(change.targetType)} · {new Date(change.occurredAt).toLocaleString()}</small></span>
            </Link>)}</div>:<p className="empty">No material changes since the last acknowledged visit.</p>}
        </article>
        <article className="panel">
          <p className="eyebrow">Pipeline snapshot</p><h2>Exceptions before volume</h2>
          <dl className="definition-list">
            <div><dt>Active placements</dt><dd>{String(data.pipeline.active??0)}</dd></div>
            <div><dt>Stalled</dt><dd>{String(data.pipeline.stalled??0)}</dd></div>
            <div><dt>No next action</dt><dd>{String(data.pipeline.lacking_next_action??0)}</dd></div>
            <div><dt>Blocked</dt><dd>{String(data.pipeline.blocked??0)}</dd></div>
            <div><dt>Active accounts</dt><dd>{String(data.pipeline.active_accounts??0)}</dd></div>
            <div><dt>Upcoming reorders</dt><dd>{String(data.pipeline.upcoming_reorders??0)}</dd></div>
          </dl><Link to="/analytics?view=pipeline">Explain and drill down</Link>
        </article>
      </section>
      <section className="panel">
        <div className="record-heading"><div><p className="eyebrow">Commercial snapshot</p><h2>Currency-separated actuals and obligations</h2></div>
          <Link to="/analytics?view=commercial">Commercial Analytics</Link></div>
        {!data.commercial.orders.length&&!data.commercial.commissions.length?<p className="empty">No verified commercial records. Provider absence is not displayed as zero activity.</p>:
          <div className="currency-grid">{[...new Set([...data.commercial.orders,...data.commercial.commissions].map(row=>String(row.currency)))].map(currency=>{
            const orders=data.commercial.orders.find(row=>row.currency===currency);
            const commissions=data.commercial.commissions.find(row=>row.currency===currency);
            return <article key={currency}><h3>{currency}</h3><dl className="definition-list">
              <div><dt>Verified wholesale actual</dt><dd>{String(orders?.verified??"0.00")}</dd></div>
              <div><dt>Expected estimate</dt><dd>{String(commissions?.expected??"0.00")}</dd></div>
              <div><dt>Approved</dt><dd>{String(commissions?.approved??"0.00")}</dd></div>
              <div><dt>Payable</dt><dd>{String(commissions?.payable??"0.00")}</dd></div>
              <div><dt>Paid actual</dt><dd>{String(commissions?.paid??"0.00")}</dd></div>
              <div><dt>Disputed</dt><dd>{String(commissions?.disputed??"0.00")}</dd></div>
              <div><dt>Overdue</dt><dd>{String(commissions?.overdue??"0.00")}</dd></div>
            </dl></article>;
          })}</div>}
      </section>
      <AiBriefingPanel/>
    </>:null}
  </div>;
}
