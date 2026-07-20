import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { classes, humanize, toneForStatus, type SemanticTone } from "./shared";

export function Table({
  caption,
  children,
  compact = false,
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & {
  caption: string;
  compact?: boolean;
}) {
  return (
    <div className="ry-table-wrap table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table {...props} className={classes("ry-table", compact && "ry-table-compact", className)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function DataRow({
  children,
  selected,
  blocked,
  stale,
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & {
  selected?: boolean;
  blocked?: boolean;
  stale?: boolean;
}) {
  return (
    <tr
      {...props}
      className={classes("ry-data-row", selected && "ry-data-row-selected", blocked && "ry-data-row-blocked", stale && "ry-data-row-stale", className)}
      aria-selected={selected}
    >
      {children}
    </tr>
  );
}

export function EmptyState({
  title,
  description,
  action,
  compact = false,
  className
}: {
  title?: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={classes("ry-empty-state", "empty-state", compact && "ry-empty-state-compact", className)}>
      {title ? <strong>{title}</strong> : null}
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something needs attention",
  message,
  action,
  className
}: {
  title?: string;
  message: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={classes("ry-state", "ry-error-state", "state-panel", "error-panel", className)} role="alert">
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {action}
    </div>
  );
}

export function LoadingState({
  label = "Loading",
  skeleton,
  className
}: {
  label?: string;
  skeleton?: ReactNode;
  className?: string;
}) {
  return (
    <div className={classes("ry-state", "ry-loading-state", "state-panel", className)} role="status" aria-live="polite" aria-busy="true">
      {skeleton ?? <span className="ry-spinner spinner" aria-hidden="true" />}
      <p>{label}…</p>
    </div>
  );
}

export function Skeleton({
  variant = "text",
  lines = 1,
  className
}: {
  variant?: "text" | "row" | "identity" | "timeline" | "metric";
  lines?: number;
  className?: string;
}) {
  return (
    <span className={classes("ry-skeleton-group", className)} aria-hidden="true">
      {Array.from({ length: Math.max(1, lines) }, (_, index) => (
        <span className={classes("ry-skeleton", `ry-skeleton-${variant}`)} key={index} />
      ))}
    </span>
  );
}

export function StatusLabel({
  value,
  label,
  tone,
  className
}: {
  value: string;
  label?: string;
  tone?: SemanticTone;
  className?: string;
}) {
  const authoredLabel = label ?? humanize(value);
  const resolvedTone = tone ?? toneForStatus(value);
  return (
    <span className={classes("ry-status-label", "status", `ry-tone-${resolvedTone}`, `status-${value.replaceAll("_", "-")}`, className)}>
      {authoredLabel}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className
}: {
  children: ReactNode;
  tone?: SemanticTone;
  className?: string;
}) {
  return <span className={classes("ry-badge", "quiet-tag", `ry-tone-${tone}`, className)}>{children}</span>;
}

export function Metric({
  label,
  value,
  definition,
  freshness,
  href,
  linkLabel = "Review",
  className
}: {
  label: string;
  value: ReactNode;
  definition?: ReactNode;
  freshness?: ReactNode;
  href?: string;
  linkLabel?: string;
  className?: string;
}) {
  return (
    <article className={classes("ry-metric", "metric", className)} aria-label={label}>
      <span>{label}</span>
      <strong className="tabular-nums">{value}</strong>
      {definition ? <div className="ry-metric-definition">{definition}</div> : null}
      {freshness ? <small>{freshness}</small> : null}
      {href ? <Link to={href}>{linkLabel}</Link> : null}
    </article>
  );
}

export function CurrencyValue({
  value,
  currency,
  status = "actual",
  locale
}: {
  value: number | string | null | undefined;
  currency: string;
  status?: "actual" | "estimated" | "unknown";
  locale?: string;
}) {
  if (value === null || value === undefined || value === "") {
    return <span className="ry-currency tabular-nums" aria-label={`${currency} amount unknown`}>—</span>;
  }
  const numericValue = Number(value);
  const formatted = Number.isFinite(numericValue)
    ? new Intl.NumberFormat(locale, { style: "currency", currency }).format(numericValue)
    : `${String(value)} ${currency}`;
  return <span className="ry-currency tabular-nums" aria-label={`${currency} ${status} amount ${formatted}`}>{formatted}</span>;
}

export function ForecastRange({
  low,
  base,
  high,
  currency,
  assumptions
}: {
  low?: number | string | null;
  base?: number | string | null;
  high?: number | string | null;
  currency: string;
  assumptions?: ReactNode;
}) {
  if (low == null && base == null && high == null) {
    return <span className="ry-forecast-range">Unknown — no user-entered range</span>;
  }
  return (
    <span className="ry-forecast-range">
      <span>
        <CurrencyValue value={low} currency={currency} status="estimated" /> to{" "}
        <CurrencyValue value={high} currency={currency} status="estimated" />
      </span>
      {base != null ? <small>Base: <CurrencyValue value={base} currency={currency} status="estimated" /></small> : null}
      {assumptions ? <small>{assumptions}</small> : null}
    </span>
  );
}
