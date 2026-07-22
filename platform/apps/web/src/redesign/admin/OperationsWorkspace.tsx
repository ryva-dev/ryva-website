import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import {
  Alert,
  Banner,
  Button,
  ConfirmationDialog,
  DataRow,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  StatusLabel,
  Table,
  Tabs,
  TextArea
} from "../../design-system";

type Job = {
  id: string;
  kind: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  updatedAt: string;
  lastErrorSafe: string | null;
};

type AuditEvent = {
  id: string;
  action: string;
  targetType: string;
  actorType: string;
  occurredAt: string;
  outcome: string;
};

type AiStatus = {
  enabled: boolean;
  reason: string;
  provider: { configured: boolean; provider: string; model: string; retentionMode: string };
};

type OperationalStatus = {
  providers: Array<{ key: string; status: string; required: boolean }>;
  jobs: Array<{ status: string; count: number }>;
  users: Array<{ status: string; count: number }>;
  activeLegalHolds: number;
  imports: Array<{ status: string; count: number }>;
  exports: Array<{ status: string; count: number }>;
  controls: { supportImpersonation: boolean; autonomousSend: boolean; autonomousApproval: boolean };
};

type Section = "status" | "ai" | "jobs" | "audit";
type Confirmation = { kind: "ai"; enabled: boolean } | { kind: "retry"; job: Job } | null;

function friendlyFailure(fallback: string) {
  return fallback;
}

export function OperationsWorkspacePage() {
  const [section, setSection] = useState<Section>("status");
  const [operations, setOperations] = useState<OperationalStatus | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [audit, setAudit] = useState<AuditEvent[] | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState<Record<Section, boolean>>({ status: true, ai: true, jobs: true, audit: true });
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [processing, setProcessing] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading((current) => ({ ...current, status: true }));
    try {
      setOperations(await api<OperationalStatus>("/api/admin/operational-status"));
    } catch {
      setError(friendlyFailure("Operational status could not be loaded."));
    } finally {
      setLoading((current) => ({ ...current, status: false }));
    }
  }, []);

  const loadAi = useCallback(async () => {
    setLoading((current) => ({ ...current, ai: true }));
    try {
      setAiStatus(await api<AiStatus>("/api/ai/status"));
    } catch {
      setError(friendlyFailure("AI control status could not be loaded."));
    } finally {
      setLoading((current) => ({ ...current, ai: false }));
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading((current) => ({ ...current, jobs: true }));
    try {
      setJobs((await api<{ jobs: Job[] }>("/api/admin/jobs")).jobs);
    } catch {
      setError(friendlyFailure("Job health could not be loaded."));
    } finally {
      setLoading((current) => ({ ...current, jobs: false }));
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setLoading((current) => ({ ...current, audit: true }));
    try {
      setAudit((await api<{ events: AuditEvent[] }>("/api/admin/audit")).events);
    } catch {
      setError(friendlyFailure("Recent audit events could not be loaded."));
    } finally {
      setLoading((current) => ({ ...current, audit: false }));
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadStatus(), loadAi(), loadJobs(), loadAudit()]);
  }, [loadAi, loadAudit, loadJobs, loadStatus]);

  async function confirmAction() {
    if (!confirmation) return;
    setProcessing(true);
    setError("");
    try {
      if (confirmation.kind === "ai") {
        await api("/api/admin/ai-control", { method: "POST", body: { enabled: confirmation.enabled, reason } });
        setReason("");
        await loadAi();
      } else {
        await api(`/api/admin/jobs/${confirmation.job.id}/retry`, { method: "POST" });
        await loadJobs();
      }
      setConfirmation(null);
    } catch {
      setError(confirmation.kind === "ai"
        ? friendlyFailure("AI generation control could not be changed.")
        : friendlyFailure("The job could not be retried."));
    } finally {
      setProcessing(false);
    }
  }

  const confirmationCopy = confirmation?.kind === "ai"
    ? {
        title: confirmation.enabled ? "Enable AI generation" : "Disable AI generation",
        description: "Confirm this operational control change.",
        consequence: confirmation.enabled
          ? "New AI generation requests may be processed after the server records this reason."
          : "New AI generation requests will be blocked. Stored suggestions and audit history remain available.",
        label: confirmation.enabled ? "Enable AI generation" : "Disable AI generation",
        variant: confirmation.enabled ? "primary" as const : "destructive" as const
      }
    : confirmation?.kind === "retry"
      ? {
          title: "Retry dead job",
          description: `Confirm retry of ${confirmation.job.kind}.`,
          consequence: "The server will queue a new attempt using the job's existing authorized payload.",
          label: "Retry job",
          variant: "primary" as const
        }
      : null;

  return (
    <div className="page ry-admin-page">
      <PageHeader
        eyebrow="Restricted operations"
        title="Platform operations"
        description="Least-privilege operational visibility for safety controls, jobs, and audit history. This is not a general user-content browser."
      />
      <Banner tone="read-only" title="Operational boundary">
        Review only the operational data needed to maintain the platform. User content, secrets, and diagnostic stack traces are not displayed here.
      </Banner>
      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={() => setError("")}>Dismiss</Button>} /> : null}

      <Tabs label="Platform operation sections" className="ry-admin-tabs">
        {([
          ["status", "System status"],
          ["ai", "AI control"],
          ["jobs", "Jobs"],
          ["audit", "Audit"]
        ] as const).map(([id, label]) => (
          <button key={id} type="button" aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}>{label}</button>
        ))}
      </Tabs>

      {section === "status" ? (
        <section className="panel ry-admin-panel" aria-labelledby="admin-status-title">
          <header className="ry-admin-section-header">
            <div><p className="eyebrow">System status</p><h2 id="admin-status-title">Provider and safety status</h2></div>
            <Button variant="secondary" onClick={() => void loadStatus()} loading={loading.status}>Refresh status</Button>
          </header>
          {loading.status ? <LoadingState label="Loading operational status" /> : null}
          {operations ? <>
            <div className="ry-admin-metrics">
              <div><span>Active legal holds</span><strong>{operations.activeLegalHolds}</strong></div>
              <div><span>Providers available</span><strong>{operations.providers.filter((item) => item.status === "available").length}/{operations.providers.length}</strong></div>
              <div><span>Autonomy controls</span><strong>{Object.values(operations.controls).some(Boolean) ? "Review" : "Off"}</strong></div>
            </div>
            <Table caption="Provider status">
              <thead><tr><th scope="col">Provider</th><th scope="col">Required</th><th scope="col">Status</th></tr></thead>
              <tbody>{operations.providers.map((provider) => <DataRow key={provider.key}>
                <td>{provider.key.replaceAll("_", " ")}</td><td>{provider.required ? "Yes" : "Optional"}</td><td><StatusLabel value={provider.status} /></td>
              </DataRow>)}</tbody>
            </Table>
            <Alert tone="info" title="Safety controls">Support impersonation, autonomous sending, and autonomous approval are disabled by policy.</Alert>
          </> : null}
        </section>
      ) : null}

      {section === "ai" ? (
        <section className="panel ry-admin-panel" aria-labelledby="admin-ai-title">
          <header className="ry-admin-section-header">
            <div><p className="eyebrow">Fail-safe integration control</p><h2 id="admin-ai-title">AI generation kill switch</h2></div>
            {aiStatus ? <StatusLabel value={aiStatus.enabled ? "enabled" : "disabled"} /> : null}
          </header>
          {loading.ai ? <LoadingState label="Loading AI control" /> : null}
          {aiStatus ? <>
            <p className="ry-admin-boundary">Provider: {aiStatus.provider.configured ? `${aiStatus.provider.provider} · ${aiStatus.provider.model}` : "not configured"} · {aiStatus.provider.retentionMode.replaceAll("_", " ")}. Disabling generation never removes suggestion or audit history.</p>
            <Field label="Required operational reason" hint="At least 10 characters; this reason is recorded with the control change." required>
              <TextArea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} />
            </Field>
            <div className="ry-admin-actions">
              <Button variant="destructive" disabled={reason.trim().length < 10} onClick={() => setConfirmation({ kind: "ai", enabled: false })}>Disable AI generation</Button>
              <Button variant="secondary" disabled={reason.trim().length < 10} onClick={() => setConfirmation({ kind: "ai", enabled: true })}>Enable AI generation</Button>
            </div>
          </> : null}
        </section>
      ) : null}

      {section === "jobs" ? (
        <section className="panel ry-admin-panel" aria-labelledby="admin-jobs-title">
          <header className="ry-admin-section-header">
            <div><p className="eyebrow">Durable work</p><h2 id="admin-jobs-title">Job health</h2></div>
            <Button variant="secondary" onClick={() => void loadJobs()} loading={loading.jobs}>Refresh jobs</Button>
          </header>
          {loading.jobs ? <LoadingState label="Loading jobs" /> : null}
          {jobs?.length === 0 ? <EmptyState title="No jobs recorded" description="There are no queued, active, completed, or dead jobs." /> : null}
          {jobs?.length ? <Table caption="Job health">
            <thead><tr><th scope="col">Kind</th><th scope="col">Status</th><th scope="col">Attempts</th><th scope="col">Updated</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
            <tbody>{jobs.map((job) => <DataRow key={job.id}>
              <td><strong>{job.kind}</strong>{job.lastErrorSafe ? <small className="ry-admin-safe-error">{job.lastErrorSafe}</small> : null}</td>
              <td><StatusLabel value={job.status} /></td><td>{job.attempts} / {job.maxAttempts}</td><td>{new Date(job.updatedAt).toLocaleString()}</td>
              <td>{job.status === "dead" ? <Button variant="tertiary" onClick={() => setConfirmation({ kind: "retry", job })}>Retry</Button> : "—"}</td>
            </DataRow>)}</tbody>
          </Table> : null}
        </section>
      ) : null}

      {section === "audit" ? (
        <section className="panel ry-admin-panel" aria-labelledby="admin-audit-title">
          <header className="ry-admin-section-header">
            <div><p className="eyebrow">Immutable history</p><h2 id="admin-audit-title">Recent audit events</h2></div>
            <Button variant="secondary" onClick={() => void loadAudit()} loading={loading.audit}>Refresh audit</Button>
          </header>
          {loading.audit ? <LoadingState label="Loading audit events" /> : null}
          {audit?.length === 0 ? <EmptyState title="No recent audit events" description="No operational audit events are available for this authorized view." /> : null}
          {audit?.length ? <div className="ry-admin-audit-list">{audit.map((event) => <article key={event.id}>
            <div><strong>{event.action}</strong><small>{event.actorType} · {event.targetType}</small></div><StatusLabel value={event.outcome} /><time>{new Date(event.occurredAt).toLocaleString()}</time>
          </article>)}</div> : null}
        </section>
      ) : null}

      {confirmationCopy ? <ConfirmationDialog
        open
        title={confirmationCopy.title}
        description={confirmationCopy.description}
        consequence={<p>{confirmationCopy.consequence}</p>}
        confirmLabel={confirmationCopy.label}
        confirmVariant={confirmationCopy.variant}
        onConfirm={() => void confirmAction()}
        onClose={() => setConfirmation(null)}
        processing={processing}
        error={error}
      /> : null}
    </div>
  );
}
