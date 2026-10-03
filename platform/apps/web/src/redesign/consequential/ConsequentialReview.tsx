import React, { useId, type ReactNode } from "react";
import { StatusLabel } from "../../design-system";
import { classes } from "../../design-system/shared";

export type ReviewReadiness = "ready" | "blocked" | "requires_review" | "completed" | "restricted" | "stale";
export type ValidationState = "passed" | "failed" | "requires_review";

export type ValidationCheck = {
  id: string;
  label: string;
  detail: ReactNode;
  state: ValidationState;
};

const readinessLabels: Record<ReviewReadiness, string> = {
  ready: "Ready for decision",
  blocked: "Blocked",
  requires_review: "Requires review",
  completed: "Decision recorded",
  restricted: "Read-only review",
  stale: "Stale version"
};

export function ConsequentialReviewLayout({
  children,
  readiness,
  className
}: {
  children: ReactNode;
  readiness: ReactNode;
  className?: string;
}) {
  return (
    <div className={classes("ry-consequential-layout", !readiness && "ry-consequential-layout-solo", className)}>
      {readiness ? (
        <aside className="ry-consequential-rail" aria-label="Decision readiness and context">
          {readiness}
        </aside>
      ) : null}
      <div className="ry-consequential-main">{children}</div>
    </div>
  );
}

export function ReadinessSummary({
  state,
  title,
  description,
  blockers = [],
  context
}: {
  state: ReviewReadiness;
  title?: string;
  description?: ReactNode;
  blockers?: ReactNode[];
  context?: ReactNode;
}) {
  const titleId = useId();
  return (
    <section className={classes("ry-readiness-summary", `ry-readiness-${state}`)} aria-labelledby={titleId}>
      <div>
        <h2 id={titleId}>{title ?? readinessLabels[state]}</h2>
        <StatusLabel value={state} label={readinessLabels[state]} />
        {description ? <div>{description}</div> : null}
      </div>
      {blockers.length ? (
        <div>
          <strong>Blockers and required review</strong>
          <ul>{blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}</ul>
        </div>
      ) : null}
      {context ? <div className="ry-readiness-context">{context}</div> : null}
    </section>
  );
}

export function ValidationSummary({
  checks,
  title = "Validation summary",
  description
}: {
  checks: ValidationCheck[];
  title?: string;
  description?: ReactNode;
}) {
  const titleId = useId();
  const stateCopy: Record<ValidationState, string> = {
    passed: "Complete",
    failed: "Failed",
    requires_review: "Requires review"
  };
  return (
    <section className="ry-validation-summary" aria-labelledby={titleId}>
      <header>
        <h2 id={titleId}>{title}</h2>
        {description ? <div>{description}</div> : null}
      </header>
      <ul className="ry-validation-checks">
        {checks.map((check) => {
          const complete = check.state === "passed";
          return (
            <li key={check.id} data-state={complete ? "complete" : "incomplete"}>
              <span className="ry-validation-check-mark" aria-hidden="true">{complete ? "✓" : "–"}</span>
              <span className="ry-validation-check-label">
                <span className="ry-validation-check-name">{check.label}</span>
                <span className="ry-validation-check-sep" aria-hidden="true"> — </span>
                <span className="ry-validation-check-status">{check.detail}</span>
              </span>
              <span className="sr-only">{stateCopy[check.state]}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ExactArtifact({
  title,
  description,
  version,
  children,
  code = false,
  className
}: {
  title: string;
  description?: ReactNode;
  version?: ReactNode;
  children: ReactNode;
  code?: boolean;
  className?: string;
}) {
  const titleId = useId();
  const showVersion = version != null && version !== "";
  return (
    <section className={classes("ry-exact-artifact", className)} aria-labelledby={titleId}>
      <header>
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <div>{description}</div> : null}
        </div>
        {showVersion ? <span className="ry-artifact-version">Version {version}</span> : null}
      </header>
      {code
        ? <pre tabIndex={0} aria-label={`${title} exact content`}><code>{children}</code></pre>
        : <div className="ry-artifact-content" role="region" aria-label={`${title} exact content`}>{children}</div>}
    </section>
  );
}

export function ReviewSection({
  eyebrow,
  title,
  description,
  children,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  void eyebrow;
  return (
    <section className={classes("ry-review-section", className)}>
      <header>
        <h2>{title}</h2>
        {description ? <div>{description}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function ReviewOutcome({
  title,
  status,
  consequence,
  children
}: {
  title: string;
  status: string;
  consequence: ReactNode;
  children?: ReactNode;
}) {
  const titleId = useId();
  return (
    <section className="ry-review-outcome" aria-labelledby={titleId}>
      <div>
        <h2 id={titleId}>{title}</h2>
        <StatusLabel value={status} />
      </div>
      <div><strong>Recorded consequence</strong><div>{consequence}</div></div>
      {children}
    </section>
  );
}

export function ReviewErrorSummary({
  message,
  conflict = false,
  onReload
}: {
  message: string;
  conflict?: boolean;
  onReload?: () => void;
}) {
  return (
    <section className="ry-review-error" role="alert" tabIndex={-1} data-review-error>
      <strong>{conflict ? "The reviewed version is no longer current" : "The decision was not recorded"}</strong>
      <p>{message}</p>
      {conflict && onReload ? <button type="button" className="ry-button ry-button-secondary ry-control-default" onClick={onReload}><span>Reload current version</span></button> : null}
    </section>
  );
}
