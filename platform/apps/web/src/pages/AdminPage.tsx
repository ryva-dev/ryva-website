import { useState } from "react";
import { api } from "../api";
import { ErrorPanel, Field, Loading, PageHeader, StatusPill } from "../components";
import { useLoad } from "../hooks";

type Job = {
  id: string;
  kind: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  updatedAt: string;
  lastErrorCode: string | null;
  lastErrorSafe: string | null;
};

type AuditEvent = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorType: string;
  occurredAt: string;
  outcome: string;
  requestId: string;
};

type AiStatus = {
  enabled: boolean;
  reason: string;
  provider: { configured: boolean; provider: string; model: string; retentionMode: string };
};
type OperationalStatus={
  providers:Array<{key:string;status:string;required:boolean}>;
  jobs:Array<{status:string;count:number}>;
  users:Array<{status:string;count:number}>;
  activeLegalHolds:number;
  imports:Array<{status:string;count:number}>;
  exports:Array<{status:string;count:number}>;
  controls:{supportImpersonation:boolean;autonomousSend:boolean;autonomousApproval:boolean};
};

export function AdminPage() {
  const jobs = useLoad(() => api<{ jobs: Job[] }>("/api/admin/jobs"), []);
  const audit = useLoad(() => api<{ events: AuditEvent[] }>("/api/admin/audit"), []);
  const aiStatus = useLoad(() => api<AiStatus>("/api/ai/status"), []);
  const operations=useLoad(()=>api<OperationalStatus>("/api/admin/operational-status"),[]);
  const [error, setError] = useState("");
  const [aiReason, setAiReason] = useState("");

  async function retry(jobId: string) {
    setError("");
    try {
      await api(`/api/admin/jobs/${jobId}/retry`, { method: "POST" });
      await jobs.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The job could not be retried.");
    }
  }

  async function changeAiControl(enabled: boolean) {
    setError("");
    try {
      await api("/api/admin/ai-control", {
        method: "POST",
        body: { enabled, reason: aiReason }
      });
      setAiReason("");
      await aiStatus.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI control could not be changed.");
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Restricted operations"
        title="Platform operations"
        description="Least-privilege job and audit visibility. This is not a general user-content browser."
      />
      {error ? <ErrorPanel message={error} /> : null}
      <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">Launch operations</p>
          <h2>Provider and safety status</h2></div>
          <button className="text-button" onClick={()=>void operations.reload()}>Refresh</button>
        </div>
        {operations.loading?<Loading label="Loading operational status" />:null}
        {operations.error?<ErrorPanel message={operations.error} />:null}
        {operations.data?<>
          <div className="metric-row">
            <div className="metric"><span>Active legal holds</span><strong>{operations.data.activeLegalHolds}</strong></div>
            <div className="metric"><span>Providers available</span><strong>{operations.data.providers.filter(item=>item.status==="available").length}/{operations.data.providers.length}</strong></div>
            <div className="metric"><span>Unsafe autonomy controls</span><strong>{Object.values(operations.data.controls).some(Boolean)?"Review":"Off"}</strong></div>
          </div>
          <div className="table-wrap"><table><thead><tr><th>Provider</th><th>Required</th><th>Status</th></tr></thead>
            <tbody>{operations.data.providers.map(provider=><tr key={provider.key}>
              <td>{provider.key.replaceAll("_"," ")}</td><td>{provider.required?"Yes":"Optional"}</td>
              <td><StatusPill value={provider.status} /></td></tr>)}</tbody></table></div>
          <p className="callout">Support impersonation, autonomous sending, and autonomous approval are disabled by policy.</p>
        </>:null}
      </section>
      <section className="panel">
        <div className="section-heading">
          <div><p className="eyebrow">Fail-safe integration control</p><h2>AI generation kill switch</h2></div>
          {aiStatus.data ? <StatusPill value={aiStatus.data.enabled ? "enabled" : "disabled"} /> : null}
        </div>
        {aiStatus.loading ? <Loading label="Loading AI control" /> : null}
        {aiStatus.error ? <ErrorPanel message={aiStatus.error} /> : null}
        {aiStatus.data ? <p>Provider: {aiStatus.data.provider.configured
          ? `${aiStatus.data.provider.provider} · ${aiStatus.data.provider.model}`
          : "not configured"} · {aiStatus.data.provider.retentionMode.replaceAll("_", " ")}. Disabling generation never removes suggestion or audit history.</p> : null}
        <Field label="Required operational reason"><textarea value={aiReason}
          onChange={(event) => setAiReason(event.target.value)} /></Field>
        <div className="button-row">
          <button className="secondary-button" disabled={aiReason.trim().length < 10}
            onClick={() => void changeAiControl(false)}>Disable AI generation</button>
          <button className="secondary-button" disabled={aiReason.trim().length < 10}
            onClick={() => void changeAiControl(true)}>Enable AI generation</button>
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div><p className="eyebrow">Durable work</p><h2>Job health</h2></div>
          <button className="text-button" onClick={() => void jobs.reload()}>Refresh</button>
        </div>
        {jobs.loading ? <Loading label="Loading jobs" /> : null}
        {jobs.error ? <ErrorPanel message={jobs.error} /> : null}
        {jobs.data?.jobs.length === 0 ? (
          <div className="empty-state"><h3>No jobs recorded</h3><p>There are no queued, active, completed, or dead jobs.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Kind</th><th>Status</th><th>Attempts</th><th>Updated</th><th>Action</th></tr></thead>
              <tbody>
                {jobs.data?.jobs.map((job) => (
                  <tr key={job.id}>
                    <td><strong>{job.kind}</strong>{job.lastErrorSafe ? <small>{job.lastErrorSafe}</small> : null}</td>
                    <td><StatusPill value={job.status} /></td>
                    <td>{job.attempts} / {job.maxAttempts}</td>
                    <td>{new Date(job.updatedAt).toLocaleString()}</td>
                    <td>{job.status === "dead" ? <button className="text-button" onClick={() => void retry(job.id)}>Retry</button> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="section-heading">
          <div><p className="eyebrow">Immutable history</p><h2>Recent audit events</h2></div>
          <button className="text-button" onClick={() => void audit.reload()}>Refresh</button>
        </div>
        {audit.loading ? <Loading label="Loading audit events" /> : null}
        {audit.error ? <ErrorPanel message={audit.error} /> : null}
        <div className="audit-list">
          {audit.data?.events.map((event) => (
            <article key={event.id}>
              <span className="audit-dot" aria-hidden="true" />
              <div><strong>{event.action}</strong><small>{event.actorType} · {event.targetType}</small></div>
              <StatusPill value={event.outcome} />
              <time>{new Date(event.occurredAt).toLocaleString()}</time>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
