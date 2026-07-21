import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ActivityTimeline,
  AIRecommendation,
  Alert,
  Badge,
  Button,
  ButtonGroup,
  CurrencyValue,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  PageHeader,
  SectionHeader,
  Select,
  Skeleton,
  StatusLabel
} from "../../design-system";
import { classes } from "../../design-system/shared";
import {
  ContextRail,
  RelationshipSection,
  StickyMobileAction
} from "../relationship/RelationshipDetail";

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

export type CommandCenterData = {
  generatedAt: string;
  changedSince: string;
  priorities: CommandCenterPriority[];
  today: CommandCenterPriority[];
  changes: CommandCenterChange[];
  pipeline: Record<string, string | number | null>;
  commercial: { orders: CommandCenterMoneyRow[]; commissions: CommandCenterMoneyRow[] };
  emptyWorkspace: boolean;
};

export type CommandCenterSession = {
  access: { mode: string; reason?: string; capabilities: string[] };
  user: { name: string };
};

function readable(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pipelineCount(pipeline: Record<string, string | number | null>, keys: string[]): number {
  for (const key of keys) {
    const value = pipeline[key];
    if (value !== undefined && value !== null && value !== "") return Number(value);
  }
  return 0;
}

function greeting(name: string): string {
  const hour = new Date().getHours();
  const period = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return `Good ${period}, ${name.split(" ")[0]}.`;
}

function PriorityQueueItem({
  item,
  index,
  canWrite,
  saving,
  onAction
}: {
  item: CommandCenterPriority;
  index: number;
  canWrite: boolean;
  saving: boolean;
  onAction: (
    item: CommandCenterPriority,
    action: "completed" | "snoozed" | "dismissed" | "reprioritized",
    manualPriority?: string
  ) => void;
}) {
  return (
    <li className={classes("ry-command-priority-item", item.blocking && "ry-command-priority-blocking")}>
      <span className="ry-command-priority-position" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
      <article>
        <div className="ry-command-priority-heading">
          <div>
            <h3><Link to={item.href}>{item.title}</Link></h3>
            <small>{item.dueAt ? new Date(item.dueAt).toLocaleString() : "No recorded due date"}</small>
          </div>
          <StatusLabel value={item.priority} />
        </div>
        <p>{item.reason}</p>
        <details className="ry-command-priority-reasons">
          <summary>Why this is prioritized</summary>
          <ul>{item.explanation.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </details>
        <p className="ry-command-next-action"><strong>Next action:</strong> {item.nextAction}</p>
        <ButtonGroup label={`Actions for ${item.title}`}>
          <Link className="ry-button ry-button-primary" to={item.href}>Open linked record</Link>
          {!item.blocking && canWrite ? (
            <>
              <Button variant="secondary" disabled={saving} onClick={() => onAction(item, "snoozed")}>Snooze 1 day</Button>
              <Button variant="tertiary" disabled={saving} onClick={() => onAction(item, "dismissed")}>Dismiss with reason</Button>
              {item.itemType === "task" ? (
                <Button variant="tertiary" disabled={saving} onClick={() => onAction(item, "completed")}>Complete</Button>
              ) : null}
              <label className="ry-field ry-command-reprioritize">
                <span className="sr-only">Reprioritize {item.title}</span>
                <Select
                  controlSize="compact"
                  value={item.priority}
                  disabled={saving}
                  onChange={(event) => onAction(item, "reprioritized", event.target.value)}
                >
                  {["critical", "high", "medium", "low"].map((value) => <option key={value} value={value}>{readable(value)}</option>)}
                </Select>
              </label>
            </>
          ) : null}
        </ButtonGroup>
      </article>
    </li>
  );
}

function CommandCenterLoading() {
  return (
    <div className="ry-command-center-page" aria-busy="true">
      <PageHeader
        eyebrow="Command center"
        title="Loading priorities"
        description="Calculating current commitments from authorized records."
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

function PipelineExceptions({
  pipeline,
  className
}: {
  pipeline: Record<string, string | number | null>;
  className?: string;
}) {
  const stalled = pipelineCount(pipeline, ["stalled", "stalled_opportunities"]);
  const blocked = pipelineCount(pipeline, ["blocked", "blocked_opportunities"]);
  const lackingNext = pipelineCount(pipeline, ["lacking_next_action", "opportunities_lacking_next_action"]);
  const upcomingReorders = pipelineCount(pipeline, ["upcoming_reorders"]);
  const hasExceptions = stalled + blocked + lackingNext + upcomingReorders > 0;

  if (!hasExceptions) {
    return (
      <EmptyState
        compact
        description="No blocked, stalled, or upcoming reorder exceptions require attention in the pipeline right now."
        action={<Link to="/analytics?view=pipeline">Open Pipeline Analytics</Link>}
      />
    );
  }

  return (
    <div className={classes("ry-command-pipeline-exceptions", className)}>
      {stalled ? <Metric label="Stalled opportunities" value={stalled} href="/analytics?view=pipeline" linkLabel="Explain and drill down" /> : null}
      {blocked ? <Metric label="Blocked opportunities" value={blocked} href="/analytics?view=pipeline" linkLabel="Review conflicts" /> : null}
      {lackingNext ? <Metric label="No next action" value={lackingNext} href="/placements" linkLabel="Review placements" /> : null}
      {upcomingReorders ? <Metric label="Upcoming reorders" value={upcomingReorders} href="/reorders" linkLabel="Review reorders" /> : null}
    </div>
  );
}

function CommercialContinuity({
  commercial
}: {
  commercial: { orders: CommandCenterMoneyRow[]; commissions: CommandCenterMoneyRow[] };
}) {
  const currencies = [...new Set([...commercial.orders, ...commercial.commissions].map((row) => String(row.currency)))];
  if (!currencies.length) {
    return (
      <EmptyState
        description="No verified commercial records. Provider absence is not displayed as zero activity."
        action={<Link to="/analytics?view=commercial">Open Commercial Analytics</Link>}
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
              <div><dt>Verified wholesale actual</dt><dd><CurrencyValue value={orders?.verified ?? null} currency={currency} status="actual" /></dd></div>
              <div><dt>Expected estimate</dt><dd><CurrencyValue value={commissions?.expected ?? null} currency={currency} status="estimated" /></dd></div>
              <div><dt>Approved</dt><dd><CurrencyValue value={commissions?.approved ?? null} currency={currency} status="actual" /></dd></div>
              <div><dt>Payable</dt><dd><CurrencyValue value={commissions?.payable ?? null} currency={currency} status="actual" /></dd></div>
              <div><dt>Paid actual</dt><dd><CurrencyValue value={commissions?.paid ?? null} currency={currency} status="actual" /></dd></div>
              <div><dt>Disputed</dt><dd><CurrencyValue value={commissions?.disputed ?? null} currency={currency} status="actual" /></dd></div>
              <div><dt>Overdue</dt><dd><CurrencyValue value={commissions?.overdue ?? null} currency={currency} status="actual" /></dd></div>
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
  return (
    <AIRecommendation
      title="AI priority review"
      status={available ? "available" : "unavailable"}
      limitations="Briefings use current Ryva tasks, risks, opportunities, reorders, and commissions. They cannot create work, hide blockers, or elevate commission over fit and trust."
      evidence={<p>AI output is evidence-labelled and requires human review before any operational use.</p>}
      actions={
        <ButtonGroup label="AI briefing actions">
          <Button variant="secondary" disabled={!available || !canWrite || Boolean(creating)} loading={creating === "daily_briefing"} onClick={() => onGenerate("daily_briefing")}>
            Draft daily briefing
          </Button>
          <Button variant="secondary" disabled={!available || !canWrite || Boolean(creating)} loading={creating === "weekly_briefing"} onClick={() => onGenerate("weekly_briefing")}>
            Draft weekly priorities
          </Button>
          <Link className="secondary-button" to="/copilot">Copilot history</Link>
        </ButtonGroup>
      }
    >
      {error ? <ErrorState message={error} /> : null}
      {!available ? (
        <p>AI briefing is unavailable or disabled. The deterministic Home actions above remain current and usable.</p>
      ) : (
        <p>Generate an explainable briefing from authorized workspace context. Acceptance records review only; it does not change records or authority.</p>
      )}
    </AIRecommendation>
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
  const [contextOpen, setContextOpen] = useState(false);
  const canWrite = session.access.mode === "full" && session.access.capabilities.includes("operational:write");
  const topPriority = data?.priorities[0] ?? null;
  const primaryAction = useMemo(() => {
    if (topPriority) {
      return <Link className="ry-button ry-button-primary" to={topPriority.href}>{topPriority.nextAction}</Link>;
    }
    return <Link className="ry-button ry-button-primary" to="/tasks">Review tasks</Link>;
  }, [topPriority]);

  const pipelineExceptions = data ? (
    <PipelineExceptions pipeline={data.pipeline} />
  ) : null;

  const showRail = data ? pipelineCount(data.pipeline, ["stalled", "stalled_opportunities", "blocked", "blocked_opportunities", "lacking_next_action", "opportunities_lacking_next_action", "upcoming_reorders"]) > 0 : false;

  if (loading && !data) return <CommandCenterLoading />;

  return (
    <div className="ry-command-center-page">
      <PageHeader
        eyebrow="Command center"
        title={greeting(session.user.name)}
        description="Today's commitments, material changes, pipeline exceptions, commercial continuity, and evidence-first next actions."
        action={
          data ? (
            <ButtonGroup label="Command center actions">
              {primaryAction}
              <Link className="secondary-button" to="/analytics">Open Analytics</Link>
            </ButtonGroup>
          ) : (
            <Link className="secondary-button" to="/analytics">Open Analytics</Link>
          )
        }
      />

      {error ? <ErrorState message={error} action={<Button variant="secondary" onClick={onReload}>Retry load</Button>} /> : null}

      {data ? (
        <>
          <section className="ry-command-freshness" aria-label="Command center freshness">
            <StatusLabel value={session.access.mode} />
            <span>Calculated {new Date(data.generatedAt).toLocaleString()}</span>
            <span>Changes since {new Date(data.changedSince).toLocaleString()}</span>
            <Badge tone="neutral">Rule-based · reasons visible · no scores</Badge>
          </section>

          {!canWrite ? (
            <Alert tone="warning" title="Read-only command center">
              {session.access.reason ?? "You may inspect permitted priorities and summaries, but cannot acknowledge changes or reprioritize work in this session."}
            </Alert>
          ) : null}

          <div className="ry-command-layout">
            <div className="ry-command-main">
              {data.today.length ? (
                <RelationshipSection
                  title="Today"
                  description="Owned tasks and due commitments in the next day."
                  action={<Link to="/tasks">All tasks</Link>}
                >
                  <ol className="ry-command-today-list" aria-label="Today's commitments">
                    {data.today.map((item, index) => (
                      <PriorityQueueItem
                        key={`today-${item.key}`}
                        item={item}
                        index={index}
                        canWrite={canWrite}
                        saving={saving === item.key}
                        onAction={onPriorityAction}
                      />
                    ))}
                  </ol>
                </RelationshipSection>
              ) : null}

              <RelationshipSection
                title="Material changes since last visit"
                description="Compact chronological material changes since the last acknowledged visit."
                action={data.changes.length && canWrite ? (
                  <Button variant="tertiary" onClick={onAcknowledge}>Acknowledge viewed</Button>
                ) : undefined}
              >
                {data.changes.length ? (
                  <ActivityTimeline
                    label="Material changes since last visit"
                    entries={data.changes.map((change, index) => ({
                      id: `${change.targetId}-${change.occurredAt}-${index}`,
                      title: <Link to="/search">{readable(change.action)}</Link>,
                      meta: `${readable(change.targetType)} · ${new Date(change.occurredAt).toLocaleString()}`
                    }))}
                  />
                ) : (
                  <EmptyState compact description="No material changes since the last acknowledged visit." />
                )}
              </RelationshipSection>

              <RelationshipSection
                title="Priority queue"
                description="Authority and trust blockers, due commitments, replies, commercial deadlines, stalled work, then evidence review."
                action={<Link to="/tasks">All tasks</Link>}
              >
                {data.priorities.length ? (
                  <ol className="ry-command-priority-list" aria-label="Priority queue">
                    {data.priorities.map((item, index) => (
                      <PriorityQueueItem
                        key={item.key}
                        item={item}
                        index={index}
                        canWrite={canWrite}
                        saving={saving === item.key}
                        onAction={onPriorityAction}
                      />
                    ))}
                  </ol>
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
              </RelationshipSection>

              {!showRail ? (
                <RelationshipSection title="Pipeline exceptions" description="Blocked, stalled, and upcoming reorder exceptions.">
                  {pipelineExceptions}
                </RelationshipSection>
              ) : null}

              <RelationshipSection
                title="Currency-separated actuals and obligations"
                description="Verified, expected, approved, payable, paid, disputed, and overdue values remain separate by ISO currency."
                action={<Link to="/analytics?view=commercial">Commercial Analytics</Link>}
              >
                <CommercialContinuity commercial={data.commercial} />
              </RelationshipSection>

              <section className="ry-command-briefing" aria-labelledby="home-ai-briefing">
                <SectionHeader eyebrow="Explainable briefing" title="AI priority review" />
                <CommandCenterBriefing
                  canWrite={canWrite}
                  available={briefing.available}
                  error={briefing.error}
                  creating={briefing.creating}
                  onGenerate={onBriefingGenerate}
                />
              </section>
            </div>

            {showRail ? (
              <ContextRail
                title="Pipeline exceptions"
                open={contextOpen}
                onOpen={() => setContextOpen(true)}
                onClose={() => setContextOpen(false)}
              >
                <p>Exceptions before volume. Drill down only when a count is non-zero.</p>
                {pipelineExceptions}
                <Link to="/analytics?view=pipeline">Explain and drill down</Link>
              </ContextRail>
            ) : null}
          </div>

          <StickyMobileAction>{primaryAction}</StickyMobileAction>
        </>
      ) : null}
    </div>
  );
}
