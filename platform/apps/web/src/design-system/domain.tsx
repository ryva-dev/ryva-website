import type { ReactNode } from "react";
import { classes, type SemanticTone } from "./shared";
import { StatusLabel } from "./data";
import { SectionHeader } from "./structure";

export function IdentityHeader({
  eyebrow,
  title,
  relationship,
  status,
  warning,
  nextAction,
  actions,
  className
}: {
  eyebrow: string;
  title: string;
  relationship?: ReactNode;
  status?: ReactNode;
  warning?: ReactNode;
  nextAction?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={classes("ry-identity-header", className)}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {relationship ? <p>{relationship}</p> : null}
        {warning ? <div className="ry-identity-warning">{warning}</div> : null}
        {nextAction ? <div className="ry-identity-next-action"><strong>Next action</strong>{nextAction}</div> : null}
      </div>
      <div className="ry-identity-actions">{status}{actions}</div>
    </header>
  );
}

export interface TimelineEntry {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
}

export function ActivityTimeline({
  entries,
  empty = "No activity recorded.",
  label = "Activity timeline",
  className
}: {
  entries: TimelineEntry[];
  empty?: ReactNode;
  label?: string;
  className?: string;
}) {
  if (!entries.length) return <p className="empty">{empty}</p>;
  return (
    <ol className={classes("ry-activity-timeline", className)} aria-label={label}>
      {entries.map((entry) => (
        <li key={entry.id}>
          <div>
            <strong>{entry.title}</strong>
            {entry.description ? <p>{entry.description}</p> : null}
            {entry.meta ? <small>{entry.meta}</small> : null}
          </div>
          {entry.status}
        </li>
      ))}
    </ol>
  );
}

function DomainIndicator({
  label,
  value,
  tone,
  rationale,
  className
}: {
  label: string;
  value: string;
  tone?: SemanticTone;
  rationale?: ReactNode;
  className?: string;
}) {
  return (
    <span className={classes("ry-domain-indicator", className)}>
      <span className="sr-only">{label}: </span>
      <StatusLabel value={value} {...(tone ? { tone } : {})} />
      {rationale ? <small>{rationale}</small> : null}
    </span>
  );
}

export function RiskIndicator(props: Omit<Parameters<typeof DomainIndicator>[0], "label">) {
  return <DomainIndicator {...props} label="Risk" className={classes("ry-risk-indicator", props.className)} />;
}

export function AuthorityIndicator(props: Omit<Parameters<typeof DomainIndicator>[0], "label">) {
  return <DomainIndicator {...props} label="Authority" className={classes("ry-authority-indicator", props.className)} />;
}

const evidenceTone: Record<string, SemanticTone> = {
  verified_fact: "success",
  direct_evidence: "success",
  strong_proxy: "info",
  weak_proxy: "warning",
  estimate: "warning",
  assumption: "warning",
  model_generated_inference: "ai",
  model_inference: "ai",
  unknown: "neutral"
};

export function EvidenceLabel({
  value,
  confidence,
  freshness,
  className
}: {
  value: string;
  confidence?: string;
  freshness?: string;
  className?: string;
}) {
  return (
    <span className={classes("ry-evidence-label", className)}>
      <StatusLabel value={value} tone={evidenceTone[value] ?? "neutral"} />
      {confidence ? <small>Confidence: {confidence}</small> : null}
      {freshness ? <small>{freshness}</small> : null}
    </span>
  );
}

export function NotificationItem({
  title,
  reason,
  timestamp,
  unread = false,
  severity = "info",
  action
}: {
  title: string;
  reason: ReactNode;
  timestamp: ReactNode;
  unread?: boolean;
  severity?: SemanticTone;
  action?: ReactNode;
}) {
  return (
    <article className={classes("ry-notification-item", unread && "ry-notification-unread")}>
      <div>
        <StatusLabel value={severity} tone={severity} />
        <strong>{title}</strong>
        <p>{reason}</p>
        <small>{timestamp}</small>
      </div>
      {action}
    </article>
  );
}

export function TaskItem({
  title,
  due,
  origin,
  status,
  blockedReason,
  action
}: {
  title: string;
  due?: ReactNode;
  origin?: ReactNode;
  status: string;
  blockedReason?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <article className={classes("ry-task-item", status === "blocked" && "ry-task-blocked")}>
      <div>
        <strong>{title}</strong>
        {due ? <small>{due}</small> : null}
        {origin ? <small>Origin: {origin}</small> : null}
        {blockedReason ? <p>{blockedReason}</p> : null}
      </div>
      <div><StatusLabel value={status} />{action}</div>
    </article>
  );
}

export function AIRecommendation({
  title,
  status,
  children,
  evidence,
  limitations,
  actions
}: {
  title: string;
  status: string;
  children: ReactNode;
  evidence?: ReactNode;
  limitations?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className="ry-ai-recommendation">
      <SectionHeader eyebrow="AI-assisted · human review required" title={title} action={<StatusLabel value={status} tone="ai" />} />
      <div className="ry-ai-content">{children}</div>
      {evidence ? <section aria-label="Supporting evidence"><strong>Supporting evidence</strong>{evidence}</section> : null}
      {limitations ? <section aria-label="Known limitations"><strong>Known limitations</strong>{limitations}</section> : null}
      {actions}
    </article>
  );
}

export function ApprovalPanel({
  title,
  readiness,
  consequence,
  rationale,
  actions,
  error,
  processing = false
}: {
  title: string;
  readiness: ReactNode;
  consequence: ReactNode;
  rationale?: ReactNode;
  actions: ReactNode;
  error?: ReactNode;
  processing?: boolean;
}) {
  return (
    <section className="ry-approval-panel" aria-busy={processing || undefined}>
      <SectionHeader eyebrow="Human decision" title={title} />
      <div><strong>Readiness</strong>{readiness}</div>
      <div><strong>Exact consequence</strong>{consequence}</div>
      {rationale ? <div><strong>Required rationale</strong>{rationale}</div> : null}
      {error ? <div className="ry-field-error-text" role="alert">{error}</div> : null}
      <div className="ry-button-group">{actions}</div>
    </section>
  );
}
