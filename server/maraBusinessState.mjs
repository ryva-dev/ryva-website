import { createHash, randomUUID } from "node:crypto";
import { ensureMaraRuntimeTables, json } from "./maraRuntimeStorage.mjs";

const EMPTY = Object.freeze({
  schemaVersion: 1, commercialObjective: "establish a credible path to creator income", bottleneck: "insufficient evidence",
  creatorIdentity: { displayName: "the creator", role: "creator Mara works for" },
  activeOpportunities: [], unsentOutreachBacklog: [], repliesAndFollowUps: [], upcomingDeadlines: [],
  portfolio: { condition: "unknown", evidence: [], lastValidatedAt: null },
  readiness: { level: "unknown", blockers: [], confidence: 0 },
  performance: { pitchesSent: 0, replies: 0, bounceRate: null, responseRate: null, contentSignals: [] },
  workload: { maraOpen: 0, creatorOpen: 0, ignoredCount: 0, blockedCount: 0 },
  capacity: { weekdayMinutes: null, weekendMinutes: null, availableWindows: [], temporaryConstraint: null },
  ignoredOrBlockedWork: [], revenue: { expected: 0, confirmed: 0, paid: 0, invoicesDue: [], invoicesOverdue: [] },
  risks: [], emergingNeeds: [], strategy: "learn the creator before committing scarce effort",
  strategyReason: "Current evidence is incomplete.", hypotheses: [], preferences: {}, geographyAndLanguages: {},
  lastMeaningfulStateChange: null, evidence: [], stateUpdatedAt: null
});

export function createEmptyBusinessState(overrides = {}) {
  return structuredClone({ ...EMPTY, ...overrides });
}

export function hashBusinessState(state) {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex");
}

function uniqueBy(items, key) {
  return [...new Map((items || []).map((item) => [item?.[key], item])).values()].filter(Boolean);
}

export function applyMaraEvents(previous, events) {
  const state = structuredClone(previous || createEmptyBusinessState());
  const changes = [];
  for (const event of events || []) {
    const p = event.payload || {};
    const evidence = { eventId: event.id, type: event.eventType, confidence: event.confidence ?? 1, occurredAt: event.occurredAt };
    switch (event.eventType) {
      case "creator_context_received": Object.assign(state, p.businessState || p); changes.push("creator context received"); break;
      case "positioning_changed": state.positioning = p.positioning; state.niche = p.niche ?? state.niche; changes.push("positioning changed"); break;
      case "portfolio_changed": state.portfolio = { ...state.portfolio, ...p, evidence: [evidence] }; changes.push("portfolio changed"); break;
      case "availability_changed": state.capacity = { ...state.capacity, ...p }; changes.push("availability changed"); break;
      case "business_message_received": state.repliesAndFollowUps.push({ ...p, eventId: event.id }); changes.push("new business message"); break;
      case "contact_bounced": state.performance.bounces = Number(state.performance.bounces || 0) + 1; state.risks.push({ type: "contact_quality", ...p, evidence }); changes.push("contact bounced"); break;
      case "follow_up_due": state.repliesAndFollowUps.push({ ...p, due: true, eventId: event.id }); changes.push("follow-up due"); break;
      case "opportunity_deadline_approaching": state.upcomingDeadlines.push({ ...p, eventId: event.id }); changes.push("deadline approaching"); break;
      case "opportunity_state_changed": state.activeOpportunities = uniqueBy([...state.activeOpportunities, { ...p, id: event.entityId || p.id }], "id"); changes.push("opportunity changed"); break;
      case "invoice_due": state.revenue.invoicesDue = uniqueBy([...state.revenue.invoicesDue, { ...p, id: event.entityId || p.id }], "id"); changes.push("invoice due"); break;
      case "invoice_overdue": state.revenue.invoicesOverdue = uniqueBy([...state.revenue.invoicesOverdue, { ...p, id: event.entityId || p.id }], "id"); changes.push("invoice overdue"); break;
      case "payment_recorded": {
        state.revenue.paid += Number(p.amount || 0);
        const invoiceId = event.entityId || p.invoiceId || p.id;
        if (invoiceId) {
          state.revenue.invoicesDue = state.revenue.invoicesDue.filter((invoice) => invoice.id !== invoiceId);
          state.revenue.invoicesOverdue = state.revenue.invoicesOverdue.filter((invoice) => invoice.id !== invoiceId);
        }
        changes.push("payment recorded");
        break;
      }
      case "task_ignored": state.workload.ignoredCount += 1; state.ignoredOrBlockedWork.push({ ...p, status: "ignored", eventId: event.id }); changes.push("task ignored"); break;
      case "task_dismissed": state.ignoredOrBlockedWork.push({ ...p, status: "dismissed", eventId: event.id }); changes.push("task dismissed"); break;
      case "inactivity_threshold_reached": state.inactive = true; state.inactivity = p; changes.push("inactivity threshold reached"); break;
      case "content_analytics_ready": state.performance.contentSignals.push({ ...p, eventId: event.id }); changes.push("analytics ready"); break;
      case "historical_outreach_imported": state.performance = { ...state.performance, ...p.performance }; state.historicalOutreach = p; changes.push("outreach history imported"); break;
      case "commercial_outcome_recorded": state.outcomes = [...(state.outcomes || []), { ...p, eventId: event.id }]; changes.push("commercial outcome recorded"); break;
      default: changes.push(event.eventType.replaceAll("_", " "));
    }
    state.evidence.push(evidence);
  }
  state.activeOpportunities = uniqueBy(state.activeOpportunities, "id");
  state.upcomingDeadlines = uniqueBy(state.upcomingDeadlines, "id");
  state.risks = uniqueBy(state.risks, "type");
  state.evidence = state.evidence.slice(-100);
  if (events?.length) {
    state.lastMeaningfulStateChange = events.at(-1).occurredAt;
    state.stateUpdatedAt = new Date().toISOString();
  }
  return { state, materialChanges: [...new Set(changes)] };
}

export async function getLatestBusinessState(store, userId, workerId) {
  await ensureMaraRuntimeTables(store);
  const row = await store.queryOne("SELECT * FROM worker_business_state_snapshots WHERE user_id = ? AND worker_id = ? ORDER BY state_version DESC LIMIT 1", userId, workerId);
  return row ? { id: row.id, version: Number(row.state_version), hash: row.state_hash, state: json(row.state_json, createEmptyBusinessState()), createdAt: row.created_at } : null;
}

export async function materializeBusinessState(store, { userId, workerId, events, seedState }) {
  await ensureMaraRuntimeTables(store);
  const latest = await getLatestBusinessState(store, userId, workerId);
  const base = latest?.state || createEmptyBusinessState(seedState);
  const result = applyMaraEvents(base, events || []);
  const hash = hashBusinessState(result.state);
  if (latest?.hash === hash) return { ...latest, materialChanges: [], unchanged: true };
  const snapshot = { id: randomUUID(), version: (latest?.version || 0) + 1, hash };
  await store.execute(
    `INSERT INTO worker_business_state_snapshots (id,user_id,worker_id,state_version,state_hash,state_json,material_changes_json,source_event_watermark,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
    snapshot.id, userId, workerId, snapshot.version, hash, JSON.stringify(result.state), JSON.stringify(result.materialChanges),
    events?.at(-1)?.occurredAt || null, new Date().toISOString()
  );
  return { ...snapshot, state: result.state, materialChanges: result.materialChanges, unchanged: false };
}
