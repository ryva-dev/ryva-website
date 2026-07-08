import { useEffect, useMemo, useState } from "react";

import type { Worker } from "../types";
import { WorkerMark } from "./WorkerMark";

type MaraIntegration = {
  accountLabel: string;
  connectedAt: string | null;
  metadata: Record<string, unknown>;
  provider: string;
  status: string;
};

type MaraDailyBrief = {
  found: string[];
  intro: string;
  prepared: string[];
};

type MaraThread = {
  brandName: string;
  brandRelated: number;
  category: string;
  confidence: number;
  contactEmail: string;
  contactName: string;
  id: string;
  provider: string;
  reason: string;
  receivedAt: string;
  snippet: string;
  sourceMessageCount: number;
  subject: string;
  threadStatus: string;
  urgency: string;
};

type MaraCampaign = {
  brandName: string;
  brandWebsite: string;
  briefText: string;
  campaignName: string;
  campaignStatus: string;
  deliverables: string[];
  draftDueDate: string | null;
  finalDueDate: string | null;
  id: string;
  missingFields: string[];
  notes: string;
  paymentAmount: string;
  paymentStatus: string;
  rawFootageRequired: number;
  revisionLimit: string;
  riskFlags: string[];
  usageRights: string;
  usageRightsStatus: string;
};

type MaraSuggestedAction = {
  actionType: string;
  createdAt: string;
  description: string;
  id: string;
  payload: Record<string, unknown>;
  reason: string;
  requiresApproval: number;
  status: string;
  title: string;
};

type MaraOpportunity = {
  brandName: string;
  category: string;
  contentGap: string;
  fitScore: number;
  id: string;
  priority: string;
  riskScore: number;
  sourceNotes: string;
  status: string;
  suggestedAngle: string;
  ugcPotentialScore: number;
  website: string;
};

type MaraTask = {
  dueDate: string;
  id: string;
  module: string;
  owner: string;
  priority: string;
  status: string;
  title: string;
};

type MaraTrendSignal = {
  confidence: string;
  id: string;
  platform: string;
  signalType: string;
  summary: string;
  title: string;
};

type MaraRisk = {
  campaignName: string;
  flag: string;
  id: string;
  plainLanguage: string;
  type: string;
};

type MaraRecentWork = {
  action: string;
  id: string;
  module: string;
  result: string;
  timestamp: string;
};

type MaraDashboard = {
  campaigns: MaraCampaign[];
  dailyBrief: MaraDailyBrief;
  integrations: MaraIntegration[];
  opportunities: MaraOpportunity[];
  recentWork: MaraRecentWork[];
  risks: MaraRisk[];
  suggestedActions: MaraSuggestedAction[];
  tasks: MaraTask[];
  threads: MaraThread[];
  trendSignals: MaraTrendSignal[];
};

type MaraDashboardViewProps = {
  onOfficeReload: () => Promise<void>;
  worker: Worker;
};

async function maraJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "Mara request failed.";
    throw new Error(message);
  }

  return payload as T;
}

function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function niceDate(iso: string | null) {
  if (!iso) return "Not scheduled";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Not scheduled" : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function titleCaseFlag(value: string) {
  return value.replace(/_/g, " ");
}

export function MaraDashboardView({ onOfficeReload, worker }: MaraDashboardViewProps) {
  const [dashboard, setDashboard] = useState<MaraDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    try {
      const data = await maraJson<MaraDashboard>(`/api/office/workers/${worker.slug}/dashboard`, { method: "GET" });
      setDashboard(data);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load Mara.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [worker.slug]);

  const connectedIntegrations = useMemo(
    () => dashboard?.integrations.filter((integration) => integration.status === "connected") ?? [],
    [dashboard]
  );

  async function connect(provider: "gmail" | "outlook") {
    setBusyKey(`connect-${provider}`);
    try {
      const response = await maraJson<{ dashboard?: MaraDashboard; redirectUrl?: string }>(`/api/office/workers/${worker.slug}/connect-email`, {
        method: "POST",
        body: JSON.stringify({ provider })
      });
      if (response.redirectUrl) {
        window.location.href = response.redirectUrl;
        return;
      }
      if (response.dashboard) {
        setDashboard(response.dashboard);
      }
      setError("");
      await onOfficeReload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to connect inbox.");
    } finally {
      setBusyKey(null);
    }
  }

  async function runScan() {
    setBusyKey("scan");
    try {
      const response = await maraJson<{ dashboard: MaraDashboard }>(`/api/office/workers/${worker.slug}/run-scan`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setDashboard(response.dashboard);
      await onOfficeReload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to run Mara's scan.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSuggestedAction(actionId: string, decision: "approve" | "reject" | "edit" | "revise") {
    const note =
      decision === "edit" || decision === "revise"
        ? window.prompt(
            decision === "edit" ? "What should Mara edit before this moves forward?" : "What should Mara revise?",
            ""
          ) ?? ""
        : "";

    if ((decision === "edit" || decision === "revise") && !note.trim()) {
      return;
    }

    setBusyKey(`${decision}-${actionId}`);
    try {
      const response = await maraJson<{ dashboard: MaraDashboard }>(`/api/office/workers/${worker.slug}/suggested-actions/${actionId}`, {
        method: "POST",
        body: JSON.stringify({ decision, note })
      });
      setDashboard(response.dashboard);
      await onOfficeReload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update this suggestion.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleOpportunity(id: string, status: "saved_to_crm" | "ignored" | "not_a_fit" | "contacted") {
    setBusyKey(`${status}-${id}`);
    try {
      const response = await maraJson<{ dashboard: MaraDashboard }>(`/api/office/workers/${worker.slug}/opportunities/${id}`, {
        method: "POST",
        body: JSON.stringify({ status })
      });
      setDashboard(response.dashboard);
      await onOfficeReload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update this opportunity.");
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return (
      <div className="ro-main-scroll">
        <div className="ro-quiet-card ro-quiet-lg">Loading Mara’s dashboard…</div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="ro-main-scroll">
        <div className="ro-quiet-card ro-quiet-lg">{error || "Mara's dashboard is unavailable right now."}</div>
      </div>
    );
  }

  const approvalItems = dashboard.suggestedActions.filter((action) => action.status === "suggested" && action.requiresApproval);

  return (
    <div className="ro-main-scroll">
      <div className="ro-day-head">
        <h1>{worker.name.split(" ")[0]}’s <em>desk</em></h1>
        <div className="ro-clockline">
          <span className="ro-live-dot" />
          <span>UGC Production Coordinator</span>
        </div>
      </div>

      <section className="ro-mara-hero">
        <div className="ro-mara-hero-id">
          <WorkerMark seed={worker.slug} size={54} active />
          <div>
            <h2>{worker.name}</h2>
            <p>{worker.profile.philosophy}</p>
          </div>
        </div>
        <div className="ro-mara-hero-actions">
          <button className="r-btn r-btn-ghost" disabled={busyKey === "scan"} onClick={() => void runScan()} type="button">
            {busyKey === "scan" ? "Scanning…" : "Run scan"}
          </button>
        </div>
      </section>

      {error ? <div className="ro-error ro-mara-error">{error}</div> : null}

      {connectedIntegrations.length === 0 ? (
        <section className="ro-panel ro-mara-connect">
          <div className="ro-panel-title">Connect email</div>
          <p>Mara treats email as the primary source of truth for creator operations. Connect an inbox to let her scan, classify, and organize recent brand work.</p>
          <div className="ro-mara-connect-grid">
            <button className="ro-mara-connect-card" disabled={busyKey === "connect-gmail"} onClick={() => void connect("gmail")} type="button">
              <strong>{busyKey === "connect-gmail" ? "Connecting Gmail…" : "Connect Gmail"}</strong>
              <span>Scaffold Gmail support and load recent creator-brand threads into Ryva.</span>
            </button>
            <button className="ro-mara-connect-card" disabled={busyKey === "connect-outlook"} onClick={() => void connect("outlook")} type="button">
              <strong>{busyKey === "connect-outlook" ? "Connecting Outlook…" : "Connect Outlook"}</strong>
              <span>Scaffold Outlook/Microsoft 365 support and mirror the same operational flow.</span>
            </button>
          </div>
        </section>
      ) : null}

      <div className="ro-mara-grid">
        <section className="ro-panel">
          <div className="ro-panel-title">Today’s brief</div>
          <p className="ro-mara-copy">{dashboard.dailyBrief.intro}</p>
          <div className="ro-mara-stat-grid">
            <div className="ro-mara-stat">
              <strong>Found</strong>
              <ul>
                {dashboard.dailyBrief.found.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="ro-mara-stat">
              <strong>Prepared</strong>
              <ul>
                {dashboard.dailyBrief.prepared.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="ro-panel">
          <div className="ro-panel-title">Inbox findings</div>
          <div className="ro-mara-list">
            {dashboard.threads.map((thread) => (
              <article className="ro-mara-thread" key={thread.id}>
                <div className="ro-mara-thread-top">
                  <strong>{thread.brandName}</strong>
                  <span>{titleCaseFlag(thread.category)}</span>
                </div>
                <b>{thread.subject}</b>
                <p>{thread.snippet}</p>
                <div className="ro-mara-meta">
                  <span>{Math.round(thread.confidence * 100)}% confidence</span>
                  <span>{thread.urgency}</span>
                  <span>{timeAgo(thread.receivedAt)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ro-panel">
          <div className="ro-panel-title">Needs approval</div>
          {approvalItems.length === 0 ? (
            <div className="ro-quiet-card">Mara does not have anything waiting on approval right now.</div>
          ) : (
            <div className="ro-mara-list">
              {approvalItems.map((action) => (
                <article className="ro-mara-action" key={action.id}>
                  <div className="ro-mara-thread-top">
                    <strong>{titleCaseFlag(action.actionType)}</strong>
                    <span>{timeAgo(action.createdAt)}</span>
                  </div>
                  <b>{action.title}</b>
                  <p>{action.description}</p>
                  <small>{action.reason}</small>
                  <div className="ro-mara-action-bar">
                    <button className="r-btn r-btn-accent" disabled={busyKey === `approve-${action.id}`} onClick={() => void handleSuggestedAction(action.id, "approve")} type="button">
                      Approve
                    </button>
                    <button className="r-btn r-btn-ghost" disabled={busyKey === `edit-${action.id}`} onClick={() => void handleSuggestedAction(action.id, "edit")} type="button">
                      Edit
                    </button>
                    <button className="r-btn r-btn-ghost" disabled={busyKey === `reject-${action.id}`} onClick={() => void handleSuggestedAction(action.id, "reject")} type="button">
                      Reject
                    </button>
                    <button className="r-btn r-btn-ghost" disabled={busyKey === `revise-${action.id}`} onClick={() => void handleSuggestedAction(action.id, "revise")} type="button">
                      Ask Mara to revise
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="ro-panel">
          <div className="ro-panel-title">Campaigns</div>
          <div className="ro-mara-list">
            {dashboard.campaigns.map((campaign) => (
              <article className="ro-mara-campaign" key={campaign.id}>
                <div className="ro-mara-thread-top">
                  <strong>{campaign.brandName}</strong>
                  <span>{titleCaseFlag(campaign.campaignStatus)}</span>
                </div>
                <b>{campaign.campaignName}</b>
                <p>{campaign.deliverables.join(" · ")}</p>
                <div className="ro-mara-meta">
                  <span>Draft {niceDate(campaign.draftDueDate)}</span>
                  <span>Final {niceDate(campaign.finalDueDate)}</span>
                </div>
                {campaign.missingFields.length > 0 ? (
                  <div className="ro-mara-tags">
                    {campaign.missingFields.map((item) => (
                      <span key={item}>{titleCaseFlag(item)}</span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="ro-panel">
          <div className="ro-panel-title">Tasks</div>
          <div className="ro-mara-list">
            {dashboard.tasks.map((task) => (
              <article className="ro-mara-task" key={task.id}>
                <div className="ro-mara-thread-top">
                  <strong>{task.title}</strong>
                  <span>{task.status}</span>
                </div>
                <div className="ro-mara-meta">
                  <span>{task.priority}</span>
                  <span>{task.dueDate}</span>
                  <span>{task.owner}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ro-panel">
          <div className="ro-panel-title">Brand opportunities</div>
          <div className="ro-mara-list">
            {dashboard.opportunities.map((opportunity) => (
              <article className="ro-mara-opportunity" key={opportunity.id}>
                <div className="ro-mara-thread-top">
                  <strong>{opportunity.brandName}</strong>
                  <span>{opportunity.category}</span>
                </div>
                <p>{opportunity.contentGap}</p>
                <small>{opportunity.suggestedAngle}</small>
                <div className="ro-mara-meta">
                  <span>Fit {opportunity.fitScore}</span>
                  <span>UGC {opportunity.ugcPotentialScore}</span>
                  <span>Risk {opportunity.riskScore}</span>
                </div>
                <div className="ro-mara-action-bar">
                  <button className="r-btn r-btn-accent" disabled={busyKey === `saved_to_crm-${opportunity.id}`} onClick={() => void handleOpportunity(opportunity.id, "saved_to_crm")} type="button">
                    Save to CRM
                  </button>
                  <button className="r-btn r-btn-ghost" disabled={busyKey === `ignored-${opportunity.id}`} onClick={() => void handleOpportunity(opportunity.id, "ignored")} type="button">
                    Ignore
                  </button>
                  <button className="r-btn r-btn-ghost" disabled={busyKey === `not_a_fit-${opportunity.id}`} onClick={() => void handleOpportunity(opportunity.id, "not_a_fit")} type="button">
                    Not a fit
                  </button>
                  <button className="r-btn r-btn-ghost" disabled={busyKey === `contacted-${opportunity.id}`} onClick={() => void handleOpportunity(opportunity.id, "contacted")} type="button">
                    Create outreach note
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ro-panel">
          <div className="ro-panel-title">Risks and missing info</div>
          <div className="ro-mara-list">
            {dashboard.risks.map((risk) => (
              <article className="ro-mara-risk" key={risk.id}>
                <div className="ro-mara-thread-top">
                  <strong>{risk.campaignName}</strong>
                  <span>{titleCaseFlag(risk.flag)}</span>
                </div>
                <p>{risk.plainLanguage}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ro-panel">
          <div className="ro-panel-title">Trend notes</div>
          <div className="ro-mara-list">
            {dashboard.trendSignals.map((signal) => (
              <article className="ro-mara-risk" key={signal.id}>
                <div className="ro-mara-thread-top">
                  <strong>{signal.title}</strong>
                  <span>{signal.platform}</span>
                </div>
                <p>{signal.summary}</p>
                <small>{signal.confidence} confidence</small>
              </article>
            ))}
          </div>
        </section>

        <section className="ro-panel">
          <div className="ro-panel-title">Recent work</div>
          <div className="ro-mara-list">
            {dashboard.recentWork.map((item) => (
              <article className="ro-mara-task" key={item.id}>
                <div className="ro-mara-thread-top">
                  <strong>{item.action}</strong>
                  <span>{timeAgo(item.timestamp)}</span>
                </div>
                <p>{item.result}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
