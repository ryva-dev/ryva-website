import React, { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ActivityTimeline,
  Alert,
  Button,
  ButtonGroup,
  CurrencyValue,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Skeleton
} from "../../design-system";
import { classes, platformCopy } from "../../design-system/shared";

export type CommandCenterPriority = {
  key: string;
  itemType: string;
  itemId: string;
  title: string;
  reason: string;
  explanation: string[];
  priority: string;
  dueAt: string | null;
  href: string;
  nextAction: string;
  blocking: boolean;
};

export type CommandCenterChange = {
  targetId: string;
  targetType: string;
  action: string;
  occurredAt: string;
};

export type CommandCenterMoneyRow = Record<string, string | number | null>;

export type CommandCenterStageCount = {
  stage: string;
  count: number | string;
  average_age_days?: string | number | null;
};

export type CommandCenterPipelineComparison = {
  month: number | null;
  quarter: number | null;
  ytd: number | null;
};

export type CommandCenterData = {
  generatedAt: string;
  changedSince: string;
  priorities: CommandCenterPriority[];
  today: CommandCenterPriority[];
  changes: CommandCenterChange[];
  pipeline: Record<string, string | number | null>;
  stageDistribution?: CommandCenterStageCount[];
  pipelineComparison?: CommandCenterPipelineComparison;
  commercial: { orders: CommandCenterMoneyRow[]; commissions: CommandCenterMoneyRow[] };
  emptyWorkspace: boolean;
};

export type CommandCenterSession = {
  access: { mode: string; reason?: string; capabilities: string[] };
  user: { name: string };
};

function displayCopy(value: string): string {
  const text = value.trim();
  if (/synthetic allegation/i.test(text) || (/allegation/i.test(text) && /not proven/i.test(text))) {
    return "The disputed commission amount does not match the supporting order records and requires review.";
  }
  // Strip trailing seed/fixture slugs such as "acct-chromium-desktop-1784734596469".
  const withoutSlug = text.replace(/\s+(?:[a-z]{2,}(?:-[a-z0-9]+)+-\d{8,})\s*$/i, "").trim();
  return platformCopy(withoutSlug || text);
}

function readable(value: string): string {
  return value
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}

function changeHref(change: CommandCenterChange): string {
  const routes: Record<string, string> = {
    task: "/tasks",
    placement_opportunity: `/placements/${change.targetId}`,
    representation_opportunity: `/representation/${change.targetId}`,
    representation_agreement: `/agreements/${change.targetId}`,
    reorder: "/reorders",
    commission: `/commissions/${change.targetId}`,
    commission_dispute: `/commission-disputes/${change.targetId}`,
    outreach_message: `/outreach/${change.targetId}`,
    evidence_record: "/sources",
    risk_flag: "/tasks",
    protected_account: `/protected-accounts/${change.targetId}`,
    product: `/products/${change.targetId}`,
    brand: `/brands/${change.targetId}`,
    business: `/buyers/${change.targetId}`,
    account: `/accounts/${change.targetId}`,
    order: `/orders/${change.targetId}`,
    contact: `/records/contact/${change.targetId}`,
    // Evaluations are not standalone pages — fall back to placements register.
    authority_evaluation: "/placements",
    ai_suggestion: "/tasks"
  };
  return routes[change.targetType] ?? `/records/${change.targetType}/${change.targetId}`;
}

function pipelineCount(pipeline: Record<string, string | number | null>, keys: string[]): number {
  for (const key of keys) {
    const value = pipeline[key];
    if (value !== undefined && value !== null && value !== "") return Number(value);
  }
  return 0;
}

type PipelineStage = { key: string; label: string; value: number; color: string };

/** Exception / health metrics — not a sequential funnel. */
function pipelineStages(pipeline: Record<string, string | number | null>): PipelineStage[] {
  return [
    { key: "active", label: "Active", value: pipelineCount(pipeline, ["active", "active_placement_opportunities"]), color: "var(--color-chart-blue)" },
    { key: "stalled", label: "Stalled", value: pipelineCount(pipeline, ["stalled", "stalled_opportunities"]), color: "var(--color-chart-pink)" },
    { key: "lacking", label: "No next action", value: pipelineCount(pipeline, ["lacking_next_action", "opportunities_lacking_next_action"]), color: "var(--color-chart-plum)" },
    { key: "won", label: "Won", value: pipelineCount(pipeline, ["won", "opportunities_won"]), color: "var(--color-chart-olive)" },
    { key: "reorders", label: "Upcoming reorders", value: pipelineCount(pipeline, ["upcoming_reorders"]), color: "var(--color-chart-taupe)" },
    { key: "blocked", label: "Blocked", value: pipelineCount(pipeline, ["blocked", "blocked_opportunities"]), color: "var(--color-accent-hover)" },
    { key: "lost", label: "Lost", value: pipelineCount(pipeline, ["lost", "opportunities_lost"]), color: "var(--color-chart-slate)" }
  ].filter((stage) => stage.value > 0);
}

/** Prefer the named Ryva health palette when truncating crowded series. */
function pipelineHealthStages(pipeline: Record<string, string | number | null>): PipelineStage[] {
  const stages = pipelineStages(pipeline);
  if (stages.length <= 5) return stages;

  const preferredKeys = new Set(["active", "stalled", "lacking", "won", "reorders"]);
  const preferred = stages.filter((stage) => preferredKeys.has(stage.key));
  const rest = stages.filter((stage) => !preferredKeys.has(stage.key));
  return [...preferred, ...rest].slice(0, 5);
}

const PLACEMENT_FUNNEL = [
  { key: "prospects", label: "Prospects", stages: ["identified", "qualified", "prepared"] },
  { key: "contacted", label: "Contacted", stages: ["contacted"] },
  { key: "conversation", label: "Conversation", stages: ["engaged", "information_sample_sent"] },
  { key: "proposal", label: "Proposal", stages: ["buyer_review", "terms_order_discussion"] },
  { key: "placement", label: "Placement", stages: ["opening_order", "active_account"] },
  { key: "reorder", label: "Reorder", stages: ["reorder_management"] }
] as const;

type FunnelPoint = {
  key: string;
  label: string;
  value: number;
  share: number;
  previous: number | null;
  delta: number | null;
};

function placementFunnelStages(distribution: CommandCenterStageCount[] | undefined): FunnelPoint[] {
  const counts = new Map<string, number>();
  for (const row of distribution ?? []) {
    counts.set(String(row.stage), Number(row.count) || 0);
  }
  const values = PLACEMENT_FUNNEL.map((bucket) =>
    bucket.stages.reduce((sum, stage) => sum + (counts.get(stage) ?? 0), 0)
  );
  const total = values.reduce((sum, value) => sum + value, 0);
  return PLACEMENT_FUNNEL.map((bucket, index) => {
    const value = values[index] ?? 0;
    return {
      key: bucket.key,
      label: bucket.label,
      value,
      share: total > 0 ? value / total : 0,
      previous: null,
      delta: null
    };
  });
}

const PIPELINE_PERIODS = [
  { id: "month", label: "This month", compare: "vs last month" },
  { id: "quarter", label: "This quarter", compare: "vs last quarter" },
  { id: "ytd", label: "Year to date", compare: "vs prior YTD" }
] as const;

function pipelineComparisonLabel(
  percent: number | null | undefined,
  compare: string
): { percent: number; text: string; direction: "up" | "down" | "flat" } | null {
  if (percent === null || percent === undefined || Number.isNaN(percent)) return null;
  const direction = percent > 0 ? "up" : percent < 0 ? "down" : "flat";
  const signed = percent > 0 ? `+${percent}` : `${percent}`;
  return {
    percent,
    direction,
    text: `${signed}% ${compare}`
  };
}

function greeting(name: string) {
  const hour = new Date().getHours();
  const period = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return <>Good {period}, <span className="ry-command-hero-name">{name.split(" ")[0]}</span>.</>;
}

/** Monotone cubic Hermite (Fritsch–Carlson): no overshoot past data, so zero stages stay on the baseline. */
function monotoneLine(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  const fmt = (point: { x: number; y: number }) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  if (points.length === 1) return `M${fmt(points[0]!)}`;
  if (points.length === 2) return `M${fmt(points[0]!)} L${fmt(points[1]!)}`;

  const count = points.length;
  const deltasX: number[] = [];
  const slopes: number[] = [];
  for (let index = 0; index < count - 1; index += 1) {
    const deltaX = points[index + 1]!.x - points[index]!.x;
    const deltaY = points[index + 1]!.y - points[index]!.y;
    deltasX.push(deltaX);
    slopes.push(deltaX === 0 ? 0 : deltaY / deltaX);
  }

  const tangents = new Array<number>(count);
  tangents[0] = slopes[0]!;
  tangents[count - 1] = slopes[count - 2]!;
  for (let index = 1; index < count - 1; index += 1) {
    tangents[index] = slopes[index - 1]! * slopes[index]! <= 0
      ? 0
      : (slopes[index - 1]! + slopes[index]!) / 2;
  }

  for (let index = 0; index < count - 1; index += 1) {
    if (Math.abs(slopes[index]!) < 1e-12) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const alpha = tangents[index]! / slopes[index]!;
    const beta = tangents[index + 1]! / slopes[index]!;
    const magnitude = alpha * alpha + beta * beta;
    if (magnitude > 9) {
      const scale = 3 / Math.sqrt(magnitude);
      tangents[index] = scale * alpha * slopes[index]!;
      tangents[index + 1] = scale * beta * slopes[index]!;
    }
  }

  let path = `M${fmt(points[0]!)}`;
  for (let index = 0; index < count - 1; index += 1) {
    const start = points[index]!;
    const end = points[index + 1]!;
    const span = deltasX[index]!;
    const low = Math.min(start.y, end.y);
    const high = Math.max(start.y, end.y);
    const controlStartY = Math.min(high, Math.max(low, start.y + (tangents[index]! * span) / 3));
    const controlEndY = Math.min(high, Math.max(low, end.y - (tangents[index + 1]! * span) / 3));
    path += ` C${(start.x + span / 3).toFixed(1)} ${controlStartY.toFixed(1)} ${(end.x - span / 3).toFixed(1)} ${controlEndY.toFixed(1)} ${fmt(end)}`;
  }
  return path;
}

function PipelineOverview({
  stageDistribution,
  pipelineComparison
}: {
  stageDistribution?: CommandCenterStageCount[];
  pipelineComparison?: CommandCenterPipelineComparison;
}) {
  const stages = useMemo(() => placementFunnelStages(stageDistribution), [stageDistribution]);
  const total = stages.reduce((sum, stage) => sum + stage.value, 0);
  const periodId = useId();
  const [period, setPeriod] = useState<(typeof PIPELINE_PERIODS)[number]["id"]>("month");
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const selectedPeriod = PIPELINE_PERIODS.find((item) => item.id === period) ?? PIPELINE_PERIODS[0];
  const comparison = pipelineComparisonLabel(
    pipelineComparison?.[selectedPeriod.id],
    selectedPeriod.compare
  );

  if (!total) {
    return (
      <section className="ry-command-pipeline" aria-labelledby="home-pipeline-heading">
        <header className="ry-command-section-head">
          <div>
            <h2 id="home-pipeline-heading">Placement pipeline</h2>
          </div>
          <div className="ry-command-pipeline-controls">
            <Link to="/placements">Add opportunity</Link>
          </div>
        </header>
        <div className="ry-command-pipeline-empty">
          <span className="ry-command-pipeline-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 48 28" width="48" height="28" fill="none">
              <path
                d="M4 22 C10 22 12 8 18 8 C24 8 26 20 32 20 C38 20 40 6 44 6"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.55"
              />
              <circle cx="4" cy="22" r="3" fill="var(--color-surface)" stroke="currentColor" strokeWidth="1.75" />
              <circle cx="18" cy="8" r="3" fill="var(--color-surface)" stroke="currentColor" strokeWidth="1.75" />
              <circle cx="32" cy="20" r="3" fill="var(--color-surface)" stroke="currentColor" strokeWidth="1.75" />
              <circle cx="44" cy="6" r="3" fill="currentColor" stroke="currentColor" strokeWidth="1.75" />
            </svg>
          </span>
          <p>No opportunities have entered the pipeline yet.</p>
        </div>
      </section>
    );
  }

  const width = 720;
  const height = 228;
  const padX = 28;
  const padTop = 28;
  const padBottom = 72;
  const max = Math.max(...stages.map((stage) => stage.value), 1);
  const step = stages.length > 1 ? (width - padX * 2) / (stages.length - 1) : 0;
  const baseline = height - padBottom;
  const guideCount = 4;
  const points = stages.map((stage, index) => {
    const x = padX + index * step;
    const y = padTop + (1 - stage.value / max) * (baseline - padTop);
    return { x, y, ...stage };
  });
  const line = monotoneLine(points);
  const area = `${line} L${points[points.length - 1]!.x.toFixed(1)} ${baseline} L${points[0]!.x.toFixed(1)} ${baseline} Z`;
  const fillId = `ry-pipeline-fill-${stages.map((stage) => stage.key).join("-")}`;
  const softId = `ry-pipeline-soft-${stages.map((stage) => stage.key).join("-")}`;
  const highlightId = `ry-pipeline-highlight-${stages.map((stage) => stage.key).join("-")}`;
  const peak = points.reduce((best, point) => (point.value > best.value ? point : best), points[0]!);
  const peakDepth = Math.max(baseline - peak.y, 24);
  const highlightRadius = Math.max(step * 1.15, peakDepth * 0.92, 72);
  const hovered = points.find((point) => point.key === hoverKey) ?? null;

  return (
    <section className="ry-command-pipeline" aria-labelledby="home-pipeline-heading">
      <header className="ry-command-section-head ry-command-pipeline-head">
        <div>
          <h2 id="home-pipeline-heading">Placement pipeline</h2>
          <p className="ry-command-pipeline-total">
            <strong className="tabular-nums">{total}</strong>
            <span> opportunities across {stages.length} stages</span>
          </p>
        </div>
        <div className="ry-command-pipeline-controls">
          <label className="ry-command-pipeline-period" htmlFor={periodId}>
            <span className="sr-only">Pipeline period</span>
            <select
              id={periodId}
              value={period}
              onChange={(event) => setPeriod(event.target.value as typeof period)}
            >
              {PIPELINE_PERIODS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          {comparison ? (
            <span
              className={classes(
                "ry-command-pipeline-compare",
                comparison.direction === "up" && "is-up",
                comparison.direction === "down" && "is-down"
              )}
            >
              <span className="ry-command-pipeline-compare-dir" aria-hidden="true">
                {comparison.direction === "up" ? "↑" : comparison.direction === "down" ? "↓" : "→"}
              </span>
              {comparison.text}
            </span>
          ) : null}
          <Link to="/analytics?view=pipeline">View analytics →</Link>
        </div>
      </header>
      <div
        className="ry-command-pipeline-chart"
        role="img"
        aria-label={`Placement pipeline with ${total} opportunities across ${stages.length} stages`}
        onMouseLeave={() => setHoverKey(null)}
      >
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            {/* Vertical fade: strong near the plot top, softer toward the baseline */}
            <linearGradient
              id={fillId}
              gradientUnits="userSpaceOnUse"
              x1={padX}
              y1={padTop}
              x2={padX}
              y2={baseline}
            >
              <stop offset="0%" stopColor="var(--color-chart-blue)" stopOpacity="0.42" />
              <stop offset="38%" stopColor="var(--color-chart-blue)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--color-chart-blue-soft)" stopOpacity="0" />
            </linearGradient>
            {/* Soft LTR wash — keeps left richer without erasing the right */}
            <linearGradient
              id={softId}
              gradientUnits="userSpaceOnUse"
              x1={padX}
              y1={padTop}
              x2={width - padX}
              y2={padTop}
            >
              <stop offset="0%" stopColor="var(--color-chart-blue)" stopOpacity="0.2" />
              <stop offset="55%" stopColor="var(--color-chart-blue)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="var(--color-chart-blue)" stopOpacity="0" />
            </linearGradient>
            {peak.value > 0 ? (
              <radialGradient
                id={highlightId}
                gradientUnits="userSpaceOnUse"
                cx={peak.x}
                cy={peak.y + peakDepth * 0.18}
                fx={peak.x}
                fy={peak.y}
                r={highlightRadius}
              >
                <stop offset="0%" stopColor="var(--color-chart-blue-soft)" stopOpacity="0.26" />
                <stop offset="48%" stopColor="var(--color-chart-blue)" stopOpacity="0.1" />
                <stop offset="100%" stopColor="var(--color-chart-blue)" stopOpacity="0" />
              </radialGradient>
            ) : null}
          </defs>
          {Array.from({ length: guideCount }, (_, index) => {
            const y = padTop + ((baseline - padTop) * index) / (guideCount - 1);
            return (
              <line
                key={`h-${index}`}
                className="ry-command-pipeline-hguide"
                x1={padX - 8}
                y1={y}
                x2={width - padX + 8}
                y2={y}
              />
            );
          })}
          {/* Floor keeps a faint powder-blue under the full curve through Reorder */}
          <path className="ry-command-pipeline-area-floor" d={area} fill="var(--color-chart-blue)" fillOpacity="0.12" />
          {peak.value > 0 ? (
            <path className="ry-command-pipeline-area-glow" d={area} fill={`url(#${highlightId})`} />
          ) : null}
          <path className="ry-command-pipeline-area" d={area} fill={`url(#${fillId})`} />
          <path className="ry-command-pipeline-area-soft" d={area} fill={`url(#${softId})`} />
          <path
            className="ry-command-pipeline-line"
            d={line}
            fill="none"
            stroke="var(--color-chart-blue)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line className="ry-command-pipeline-baseline" x1={padX - 8} y1={baseline} x2={width - padX + 8} y2={baseline} />
          {points.map((point) => (
            <g
              key={point.key}
              className={classes("ry-command-pipeline-node", hoverKey === point.key ? "is-active" : "")}
              transform={`translate(${point.x} ${point.y})`}
              onMouseEnter={() => setHoverKey(point.key)}
            >
              <circle className="ry-command-pipeline-hit" r="14" fill="transparent" />
              <circle className="ry-command-pipeline-point" r="4.5" fill="var(--color-surface)" stroke="var(--color-chart-blue)" strokeWidth="2" />
              <text className="ry-command-pipeline-value" y="-18" textAnchor="middle">{point.value}</text>
            </g>
          ))}
          {points.map((point) => (
            <g key={`label-${point.key}`} className="ry-command-pipeline-stage" transform={`translate(${point.x} ${baseline + 26})`}>
              <text className="ry-command-pipeline-stage-name" textAnchor="middle">{point.label}</text>
              <text className="ry-command-pipeline-stage-meta" y="17" textAnchor="middle">
                {point.value} · {Math.round(point.share * 100)}%
              </text>
            </g>
          ))}
        </svg>
        {hovered ? (
          <div
            className="ry-command-pipeline-tooltip"
            style={{ left: `${(hovered.x / width) * 100}%` }}
            role="tooltip"
          >
            <strong>{hovered.label}</strong>
            <span>{hovered.value} opportunities</span>
            <span>Total value: not stored by stage</span>
            <span>
              {selectedPeriod.compare}: {hovered.delta === null ? "—" : `${hovered.delta > 0 ? "+" : ""}${hovered.delta}`}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PipelineHealth({ pipeline }: { pipeline: Record<string, string | number | null> }) {
  const stages = pipelineHealthStages(pipeline);
  const total = stages.reduce((sum, stage) => sum + stage.value, 0);
  if (!total) return null;

  const radius = 56;
  const stroke = 9;
  const gap = 3.25;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const arcs = stages.map((stage) => {
    const raw = (stage.value / total) * circumference;
    const length = stages.length > 1 ? Math.max(raw - gap, raw * 0.88) : raw;
    const item = { ...stage, length, offset };
    offset += raw;
    return item;
  });

  return (
    <section className="ry-command-health" aria-labelledby="home-health-heading">
      <h2 id="home-health-heading">Pipeline health</h2>
      <div className="ry-command-health-body">
        <div className="ry-command-health-chart" role="img" aria-label={`Pipeline health across ${stages.length} stages`}>
          <svg viewBox="0 0 140 140" aria-hidden="true">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--color-surface-subtle)" strokeWidth={stroke} />
            {arcs.map((arc) => (
              <circle
                key={arc.key}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={stroke}
                strokeDasharray={`${arc.length} ${circumference - arc.length}`}
                strokeDashoffset={-arc.offset}
                strokeLinecap="butt"
                transform="rotate(-90 70 70)"
              />
            ))}
          </svg>
          <div className="ry-command-health-center">
            <strong className="tabular-nums">{total}</strong>
            <span>tracked</span>
          </div>
        </div>
        <ul className="ry-command-health-legend">
          {stages.map((stage) => (
            <li key={stage.key}>
              <span className="ry-command-health-legend-start">
                <span className="ry-command-health-swatch" style={{ background: stage.color }} aria-hidden="true" />
                <span className="ry-command-health-label">{stage.label}</span>
              </span>
              <span className="ry-command-health-legend-end">
                <strong className="ry-command-health-count tabular-nums">{stage.value}</strong>
                <span className="ry-command-health-pct tabular-nums">{Math.round((stage.value / total) * 100)}%</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function AccountPulse({ pipeline }: { pipeline: Record<string, string | number | null> }) {
  const active = pipelineCount(pipeline, ["active_accounts"]);
  const atRisk = pipelineCount(pipeline, ["at_risk_accounts"]);
  const needsAttention = pipelineCount(pipeline, ["overdue_reorders"]);
  if (!active && !atRisk && !needsAttention) return null;
  return (
    <section className="ry-command-pulse" aria-labelledby="home-pulse-heading">
      <header className="ry-command-section-head">
        <h2 id="home-pulse-heading">Account relationships</h2>
        <Link to="/accounts">View accounts →</Link>
      </header>
      <div className="ry-command-pulse-row">
        <Link to="/accounts" className="ry-command-pulse-item">
          <strong className="tabular-nums">{active}</strong>
          <span>Active accounts</span>
        </Link>
        <Link to="/accounts" className="ry-command-pulse-item">
          <strong className="tabular-nums">{atRisk}</strong>
          <span>At-risk accounts</span>
        </Link>
        <Link to="/reorders" className={classes("ry-command-pulse-item", needsAttention > 0 && "ry-command-pulse-attention")}>
          <strong className="tabular-nums">{needsAttention}</strong>
          <span>Needs attention</span>
        </Link>
      </div>
    </section>
  );
}

function FocalPriorityCard({ item }: { item: CommandCenterPriority }) {
  return (
    <section className="ry-command-focal" aria-label="Top priority">
      <p className="ry-command-focal-eyebrow">Top priority</p>
      <div className="ry-command-focal-body">
        <div className="ry-command-focal-case">
          <span className="ry-command-focal-medallion" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
              <path d="M12 3v18M7 7l-4 6a4 4 0 0 0 8 0L7 7Zm10 0-4 6a4 4 0 0 0 8 0l-4-6ZM5 21h14M9 4h6" />
            </svg>
          </span>
          <div className="ry-command-focal-lede">
            <h2><Link to={item.href}>{displayCopy(item.title)}</Link></h2>
            <p className="ry-command-focal-reason">{displayCopy(item.reason)}</p>
          </div>
        </div>
        <div className="ry-command-focal-cluster">
          <dl className="ry-command-focal-meta">
            <div>
              <dt>Priority</dt>
              <dd className="ry-plain-status">{readable(item.priority)}</dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>{item.dueAt ? new Date(item.dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "No recorded date"}</dd>
            </div>
            <div className="ry-command-focal-next">
              <dt>Next action</dt>
              <dd>{item.nextAction}</dd>
            </div>
          </dl>
          <div className="ry-command-focal-actions">
            <Link className="ry-button ry-button-primary" to={item.href}>Review priority</Link>
            <Link className="ry-command-focal-alllink" to="/tasks">View all my tasks →</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function conciseNextAction(value: string, max = 64): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function activityTypeLabel(itemType: string): string {
  const labels: Record<string, string> = {
    task: "Task",
    placement_opportunity: "Placement",
    representation_agreement: "Agreement",
    reorder: "Reorder",
    commission: "Commission",
    commission_dispute: "Dispute",
    outreach_message: "Outreach",
    evidence_record: "Evidence",
    risk_flag: "Risk",
    protected_account: "Protection"
  };
  return labels[itemType] ?? readable(itemType);
}

function displayEntityName(value: string): string {
  return displayCopy(value);
}

function relatedEntityLabel(item: CommandCenterPriority): string {
  if (item.itemType === "reorder") {
    const [, ...rest] = item.title.split(":");
    const related = rest.join(":").trim();
    if (related) return displayEntityName(related);
  }
  if (item.itemType === "placement_opportunity" && item.title.includes("→")) {
    return item.title
      .split("→")
      .map((part) => displayEntityName(part.trim()))
      .join(" → ");
  }
  return displayEntityName(item.title);
}

function activityDateParts(dueAt: string): { month: string; day: string; time: string } {
  const date = new Date(dueAt);
  return {
    month: date.toLocaleString(undefined, { month: "short" }),
    day: date.toLocaleString(undefined, { day: "numeric" }),
    time: date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" })
  };
}

function PriorityQueueRow({ item, index }: { item: CommandCenterPriority; index: number }) {
  return (
    <li className="ry-command-queue-row">
      <span className="ry-command-row-mark" aria-hidden="true">
        <span className="ry-command-row-mark-dot" />
        <span className="ry-command-row-mark-rank">{index + 1}</span>
      </span>
      <div className="ry-command-queue-main">
        <div className="ry-command-queue-primary">
          <Link className="ry-command-queue-title" to={item.href}>{displayCopy(item.title)}</Link>
          <span className="ry-plain-status ry-command-queue-priority" title="Change priority on the task page">
            {readable(item.priority)}
          </span>
        </div>
        <div className="ry-command-queue-secondary">
          <span className="ry-command-queue-next">{conciseNextAction(item.nextAction, 88)}</span>
          <Link className="ry-command-queue-open" to={item.href} aria-label={`Open ${displayCopy(item.title)}`}>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </li>
  );
}

function UpcomingActivityRow({ item }: { item: CommandCenterPriority }) {
  if (!item.dueAt) return null;
  const { month, day, time } = activityDateParts(item.dueAt);
  const type = activityTypeLabel(item.itemType);
  const related = relatedEntityLabel(item);
  return (
    <li className="ry-command-activity-row">
      <span className="ry-command-row-mark" aria-hidden="true">
        <span className="ry-command-row-mark-rule" />
      </span>
      <time className="ry-command-activity-date" dateTime={item.dueAt}>
        <span className="ry-command-activity-month">{month}</span>
        <span className="ry-command-activity-day">{day}</span>
      </time>
      <div className="ry-command-activity-body">
        <span className="ry-command-activity-type">{type}</span>
        <Link className="ry-command-activity-related" to={item.href}>{related}</Link>
      </div>
      <span className="ry-command-activity-time">{time}</span>
      <Link className="ry-command-activity-icon" to={item.href} aria-label={`Open ${related}`}>
        <span aria-hidden="true">→</span>
      </Link>
    </li>
  );
}

function nextScheduledActivities(
  items: CommandCenterPriority[],
  asOf: string | number = Date.now()
): CommandCenterPriority[] {
  const now = typeof asOf === "string" ? new Date(asOf).getTime() : asOf;
  return [...items]
    .filter((item) => item.dueAt && new Date(item.dueAt).getTime() >= now)
    .sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))
    .slice(0, 3);
}

function topPriorityPreview(items: CommandCenterPriority[]): CommandCenterPriority[] {
  return items.slice(0, 3);
}

function CommandCenterLoading() {
  return (
    <div className="page ry-command-center-page" aria-busy="true">
      <PageHeader
        eyebrow="Command center"
        title="Loading priorities"
      />
      <LoadingState
        label="Calculating current priorities from authorized records"
        skeleton={
          <div className="ry-command-loading">
            <Skeleton variant="identity" lines={1} />
            <Skeleton variant="row" lines={4} />
            <Skeleton variant="metric" lines={3} />
          </div>
        }
      />
    </div>
  );
}

function GlanceIcon({ kind }: { kind: "stalled" | "blocked" | "lacking" | "reorders" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      {kind === "stalled" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M10 9v6M14 9v6" />
        </>
      ) : null}
      {kind === "blocked" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m9 9 6 6M15 9l-6 6" />
        </>
      ) : null}
      {kind === "lacking" ? (
        <>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </>
      ) : null}
      {kind === "reorders" ? (
        <>
          <path d="M16.5 9.4 7.55 4.86" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14" />
          <path d="M3.29 7 12 12l8.71-5" />
          <path d="M12 22V12" />
          <path d="M19 14v5" />
          <path d="m17 17 2 2 2-2" />
        </>
      ) : null}
    </svg>
  );
}

function GlanceItem({
  value,
  label,
  sublabel,
  href,
  icon
}: {
  value: number;
  label: string;
  sublabel: string;
  href: string;
  icon: "stalled" | "blocked" | "lacking" | "reorders";
}) {
  return (
    <li>
      <Link to={href} className="ry-command-glance-item">
        <span className="ry-command-glance-icon" aria-hidden="true">
          <GlanceIcon kind={icon} />
        </span>
        <strong className="tabular-nums">{value}</strong>
        <span className="ry-command-glance-text">
          <span className="ry-command-glance-label">{label}</span>
          <span className="ry-command-glance-sub">{sublabel}</span>
        </span>
      </Link>
    </li>
  );
}

function PipelineExceptions({
  pipeline
}: {
  pipeline: Record<string, string | number | null>;
}) {
  const stalled = pipelineCount(pipeline, ["stalled", "stalled_opportunities"]);
  const blocked = pipelineCount(pipeline, ["blocked", "blocked_opportunities"]);
  const lackingNext = pipelineCount(pipeline, ["lacking_next_action", "opportunities_lacking_next_action"]);
  const upcomingReorders = pipelineCount(pipeline, ["upcoming_reorders"]);
  const hasExceptions = stalled + blocked + lackingNext + upcomingReorders > 0;

  return (
    <section className="ry-command-glance" aria-labelledby="home-glance-heading">
      <header className="ry-command-section-head">
        <h2 id="home-glance-heading">At a glance</h2>
      </header>
      {hasExceptions ? (
        <>
          <ul className="ry-command-glance-list">
            {stalled ? <GlanceItem icon="stalled" value={stalled} label="Stalled opportunities" sublabel="No activity in 7+ days" href="/analytics?view=pipeline" /> : null}
            {blocked ? <GlanceItem icon="blocked" value={blocked} label="Blocked opportunities" sublabel="Conflicts need review" href="/analytics?view=pipeline" /> : null}
            {lackingNext ? <GlanceItem icon="lacking" value={lackingNext} label="No next action" sublabel="Placements without a plan" href="/placements" /> : null}
            {upcomingReorders ? <GlanceItem icon="reorders" value={upcomingReorders} label="Upcoming reorders" sublabel="Windows approaching" href="/reorders" /> : null}
          </ul>
          <Link className="ry-command-glance-all" to="/analytics?view=pipeline">View all exceptions</Link>
        </>
      ) : (
        <EmptyState
          compact
          description="No blocked, stalled, or upcoming reorder exceptions require attention in the pipeline right now."
          action={<Link to="/analytics?view=pipeline">Open Pipeline Analytics</Link>}
        />
      )}
    </section>
  );
}

function moneyAmount(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function currencyHasSales(
  currency: string,
  commercial: { orders: CommandCenterMoneyRow[]; commissions: CommandCenterMoneyRow[] }
): boolean {
  const orders = commercial.orders.find((row) => String(row.currency) === currency);
  const commissions = commercial.commissions.find((row) => String(row.currency) === currency);
  return [
    orders?.verified,
    commissions?.expected,
    commissions?.approved,
    commissions?.payable,
    commissions?.paid,
    commissions?.disputed,
    commissions?.overdue
  ].some((value) => moneyAmount(value) > 0);
}

function CommercialContinuity({
  commercial
}: {
  commercial: { orders: CommandCenterMoneyRow[]; commissions: CommandCenterMoneyRow[] };
}) {
  const currencies = [...new Set([...commercial.orders, ...commercial.commissions].map((row) => String(row.currency)))]
    .filter((currency) => currencyHasSales(currency, commercial))
    .sort((left, right) => {
      if (left === "USD") return -1;
      if (right === "USD") return 1;
      return left.localeCompare(right);
    });
  if (!currencies.length) {
    return (
      <EmptyState
        description="No verified commercial records. Provider absence is not displayed as zero activity."
        action={<Link to="/commissions">View commissions</Link>}
      />
    );
  }

  return (
    <div className="ry-command-commercial-grid">
      {currencies.map((currency) => {
        const orders = commercial.orders.find((row) => String(row.currency) === currency);
        const commissions = commercial.commissions.find((row) => String(row.currency) === currency);
        return (
          <section key={currency} aria-labelledby={`commercial-${currency}`}>
            <h3 id={`commercial-${currency}`}>{currency}</h3>
            <dl className="ry-command-commercial-facts">
              <div>
                <dt>Verified revenue</dt>
                <dd><CurrencyValue value={orders?.verified ?? null} currency={currency} status="actual" /></dd>
              </div>
              <div>
                <dt>Approved</dt>
                <dd><CurrencyValue value={commissions?.approved ?? null} currency={currency} status="actual" /></dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd><CurrencyValue value={commissions?.paid ?? null} currency={currency} status="actual" /></dd>
              </div>
              <div>
                <dt>Disputed</dt>
                <dd><CurrencyValue value={commissions?.disputed ?? null} currency={currency} status="actual" /></dd>
              </div>
              <div>
                <dt>Overdue</dt>
                <dd><CurrencyValue value={commissions?.overdue ?? null} currency={currency} status="actual" /></dd>
              </div>
            </dl>
          </section>
        );
      })}
    </div>
  );
}

export function CommandCenterBriefing({
  canWrite,
  available,
  error,
  creating,
  onGenerate
}: {
  canWrite: boolean;
  available: boolean;
  error: string;
  creating: string;
  onGenerate: (useCase: "daily_briefing" | "weekly_briefing") => void;
}) {
  if (!available) return null;

  return (
    <div className="ry-command-briefing">
      {error ? <ErrorState message={error} /> : null}
      <p>Draft a short briefing from current tasks, risks, and opportunities.</p>
      <ButtonGroup label="AI briefing actions">
        <Button
          variant="secondary"
          disabled={!canWrite || Boolean(creating)}
          loading={creating === "daily_briefing"}
          onClick={() => onGenerate("daily_briefing")}
        >
          Draft daily briefing
        </Button>
        <Button
          variant="secondary"
          disabled={!canWrite || Boolean(creating)}
          loading={creating === "weekly_briefing"}
          onClick={() => onGenerate("weekly_briefing")}
        >
          Draft weekly priorities
        </Button>
      </ButtonGroup>
    </div>
  );
}

export function CommandCenter({
  session,
  data,
  loading,
  error,
  saving,
  briefing,
  onReload,
  onAcknowledge,
  onPriorityAction,
  onBriefingGenerate
}: {
  session: CommandCenterSession;
  data: CommandCenterData | null;
  loading: boolean;
  error: string;
  saving: string;
  briefing: {
    available: boolean;
    error: string;
    creating: string;
  };
  onReload: () => void;
  onAcknowledge: () => void;
  onPriorityAction: (
    item: CommandCenterPriority,
    action: "completed" | "snoozed" | "dismissed" | "reprioritized",
    manualPriority?: string
  ) => void;
  onBriefingGenerate: (useCase: "daily_briefing" | "weekly_briefing") => void;
}) {
  void saving;
  void onPriorityAction;
  const canWrite = session.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const topPriority = data?.priorities[0] ?? null;
  const priorityPreview = data ? topPriorityPreview(data.priorities) : [];
  const upcomingActivities = data ? nextScheduledActivities(data.today, data.generatedAt) : [];

  if (loading && !data) return <CommandCenterLoading />;

  return (
    <div className="page ry-command-center-page">
      <PageHeader
        title={greeting(session.user.name)}
      />

      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={onReload}>Retry load</Button>} /> : null}

      {data ? (
        <>
          {!canWrite ? (
            <Alert tone="warning" title="Read-only command center">
              {session.access.reason ?? "You may inspect permitted priorities and summaries, but cannot acknowledge changes or reprioritize work in this session."}
            </Alert>
          ) : null}

          {topPriority ? <FocalPriorityCard item={topPriority} /> : null}

          <div className="ry-command-layout">
            <div className="ry-command-main">
              <PipelineOverview
                {...(data.stageDistribution ? { stageDistribution: data.stageDistribution } : {})}
                {...(data.pipelineComparison ? { pipelineComparison: data.pipelineComparison } : {})}
              />

              <div className="ry-command-split">
                <section className="ry-command-section ry-command-preview-panel" aria-labelledby="home-queue-heading">
                  <header className="ry-command-section-head ry-command-preview-head">
                    <h2 id="home-queue-heading">Priority queue</h2>
                  </header>
                  {priorityPreview.length ? (
                    <>
                      <ol className="ry-command-queue-list" aria-label="Priority queue">
                        {priorityPreview.map((item, index) => (
                          <PriorityQueueRow key={item.key} item={item} index={index} />
                        ))}
                      </ol>
                      <Link className="ry-command-preview-footer" to="/tasks">View priority queue →</Link>
                    </>
                  ) : (
                    <EmptyState
                      description={data.emptyWorkspace
                        ? "No operating records yet. Add a Brand, Product, or Business to establish a responsible next action."
                        : "No urgent queue items. Review the portfolio or research queue without treating inactivity as success."}
                      action={data.emptyWorkspace ? (
                        <ButtonGroup label="First setup actions">
                          <Link className="secondary-button" to="/brands">Add Brand</Link>
                          <Link className="secondary-button" to="/products">Add Product</Link>
                          <Link className="secondary-button" to="/buyers">Add Business</Link>
                        </ButtonGroup>
                      ) : undefined}
                    />
                  )}
                </section>

                <section className="ry-command-section ry-command-preview-panel ry-command-upcoming" aria-labelledby="home-today-heading">
                  <header className="ry-command-section-head ry-command-preview-head">
                    <h2 id="home-today-heading">Upcoming activities</h2>
                  </header>
                  {upcomingActivities.length ? (
                    <>
                      <ol className="ry-command-upcoming-list" aria-label="Upcoming activities">
                        {upcomingActivities.map((item) => (
                          <UpcomingActivityRow key={`today-${item.key}`} item={item} />
                        ))}
                      </ol>
                      <Link className="ry-command-preview-footer" to="/tasks">View today’s tasks →</Link>
                    </>
                  ) : (
                    <EmptyState compact description="No activities scheduled in the next day." />
                  )}
                </section>
              </div>

              <section className="ry-command-section" aria-labelledby="home-commercial-heading">
                <header className="ry-command-section-head">
                  <h2 id="home-commercial-heading">Revenue & Commissions</h2>
                  <Link to="/commissions">View commissions →</Link>
                </header>
                <CommercialContinuity commercial={data.commercial} />
              </section>

              <AccountPulse pipeline={data.pipeline} />

              {briefing.available ? (
                <section className="ry-command-section" aria-labelledby="home-ai-briefing">
                  <header className="ry-command-section-head">
                    <h2 id="home-ai-briefing">AI priority review</h2>
                  </header>
                  <CommandCenterBriefing
                    canWrite={canWrite}
                    available={briefing.available}
                    error={briefing.error}
                    creating={briefing.creating}
                    onGenerate={onBriefingGenerate}
                  />
                </section>
              ) : null}
            </div>

            <aside className="ry-command-rail" aria-label="Overview">
              <PipelineExceptions pipeline={data.pipeline} />
              <PipelineHealth pipeline={data.pipeline} />

              <section className="ry-command-glance" aria-labelledby="home-changes-heading">
                <header className="ry-command-glance-head">
                  <h2 id="home-changes-heading">Recent activity</h2>
                  {data.changes.length && canWrite ? <Button variant="tertiary" size="compact" onClick={onAcknowledge}>Mark viewed</Button> : null}
                </header>
                {data.changes.length ? (
                  <ActivityTimeline
                    label="Material changes since last visit"
                    entries={data.changes.slice(0, 3).map((change, index) => ({
                      id: `${change.targetId}-${change.occurredAt}-${index}`,
                      title: <Link to={changeHref(change)}>{readable(change.action)}</Link>,
                      meta: `${readable(change.targetType)} · ${new Date(change.occurredAt).toLocaleString()}`
                    }))}
                  />
                ) : (
                  <p className="ry-command-activity-empty">
                    <span className="ry-command-activity-empty-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                        <path d="M4 6h11" />
                        <path d="M4 12h16" />
                        <path d="M4 18h8" />
                        <circle cx="19" cy="6" r="1.5" />
                        <circle cx="14" cy="18" r="1.5" />
                      </svg>
                    </span>
                    <span>No new activity since your last visit.</span>
                  </p>
                )}
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
