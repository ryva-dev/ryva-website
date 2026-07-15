import { createEmptyBusinessState } from "./maraBusinessState.mjs";

function state(overrides = {}) {
  const base = createEmptyBusinessState();
  for (const [key, value] of Object.entries(overrides)) {
    base[key] = value && typeof value === "object" && !Array.isArray(value) && typeof base[key] === "object" && !Array.isArray(base[key])
      ? { ...base[key], ...value }
      : value;
  }
  return base;
}

export const MARA_PHASE2_SCENARIOS = [
  { id: "no-niche-no-portfolio", name: "No niche and no portfolio", expected: ["clarify_positioning", "address_portfolio_gap"], avoid: ["strengthen_pipeline"], maxCost: .30,
    state: state({ niche: null, portfolio: { condition: "missing" }, readiness: { level: "beginner", blockers: ["no_niche"], confidence: 1 }, capacity: { weekdayMinutes: 45, weekendMinutes: 180, availableWindows: ["Sunday afternoon"] } }) },
  { id: "strong-portfolio", name: "Strong existing portfolio", expected: ["strengthen_pipeline"], avoid: ["address_portfolio_gap"], maxCost: .15,
    state: state({ niche: "outdoor family travel", portfolio: { condition: "strong", lastValidatedAt: "2026-07-13", evidence: ["12 current niche-relevant samples"] }, readiness: { level: "outreach_ready", blockers: [], confidence: .95 } }) },
  { id: "strong-content-no-replies", name: "Strong content but no replies", expected: ["diagnose_low_response"], avoid: ["address_portfolio_gap"], maxCost: .25,
    state: state({ niche: "clean beauty", portfolio: { condition: "strong" }, performance: { pitchesSent: 28, replies: 0, responseRate: 0, bounceRate: .11, contentSignals: [{ quality: "strong" }] }, risks: [{ type: "contact_quality", detail: "mixed deliverability" }], strategyReason: "Content is credible but the outreach system has not produced replies." }) },
  { id: "twenty-unsent", name: "Twenty unsent opportunities", expected: ["reduce_unsent_backlog"], avoid: ["strengthen_pipeline"], maxCost: .08,
    state: state({ niche: "food", portfolio: { condition: "strong" }, unsentOutreachBacklog: Array.from({ length: 20 }, (_, i) => ({ id: `opp-${i}`, confidence: .5 + i / 50 })), workload: { maraOpen: 20, creatorOpen: 20, ignoredCount: 1, blockedCount: 0 } }) },
  { id: "urgent-active-deals", name: "Active deals with urgent deadlines", expected: ["protect_active_deadline"], avoid: ["strengthen_pipeline", "address_portfolio_gap"], maxCost: .25,
    state: state({ niche: "fitness", portfolio: { condition: "strong" }, activeOpportunities: [{ id: "deal-a", stage: "won", value: 1800 }, { id: "deal-b", stage: "active", value: 900 }], upcomingDeadlines: [{ id: "deal-a", dueAt: "2026-07-16T12:00:00Z", need: "final deliverable" }], repliesAndFollowUps: [{ id: "brand-question", needsInterpretation: true }], revenue: { expected: 2700, confirmed: 1800, paid: 0, invoicesDue: [], invoicesOverdue: [] } }) },
  { id: "limited-time", name: "Creator with very limited time", expected: ["strengthen_pipeline"], avoid: [], maxCost: .15,
    state: state({ niche: "home organization", portfolio: { condition: "strong" }, capacity: { weekdayMinutes: 30, weekendMinutes: 120, availableWindows: ["Sunday 14:00-16:00"], temporaryConstraint: "full-time job and childcare" }, strategyReason: "Creator effort must be batched into one decision and one Sunday production window." }) },
  { id: "suspicious-outreach", name: "Suspicious brand outreach", expected: ["investigate_suspicious_outreach"], avoid: ["prepare_due_follow_up"], maxCost: .30,
    state: state({ niche: "fashion", portfolio: { condition: "strong" }, risks: [{ type: "suspicious_outreach", domain: "brand-payments.example", signals: ["asks creator to pay fee", "domain mismatch", "requests credentials"] }], repliesAndFollowUps: [{ id: "risky-message", due: false }] }) },
  { id: "gifted-preference", name: "Gifted-opportunity preferences", expected: ["assess_gifted_opportunity"], avoid: [], maxCost: .12,
    state: state({ niche: "skincare", portfolio: { condition: "weak" }, preferences: { gifted: "selective when portfolio value is meaningful" }, giftedOpportunity: { productValue: 120, cashValue: 0, deliverables: 2, usageRights: "unclear", portfolioFit: "potentially strong" } }) },
  { id: "historical-import", name: "Historical outreach imports", expected: ["learn_from_historical_outreach", "diagnose_low_response"], avoid: [], maxCost: .40,
    state: state({ niche: "parenting", portfolio: { condition: "strong" }, historicalOutreach: { records: 100, duplicates: 12, channels: ["email", "Instagram"], importValidated: true }, performance: { pitchesSent: 88, replies: 3, responseRate: .034, bounceRate: .02, contentSignals: [] } }) },
  { id: "ignored-tasks", name: "Repeatedly ignored tasks", expected: ["throttle_and_reenter"], avoid: ["strengthen_pipeline"], maxCost: .03,
    state: state({ niche: "wellness", portfolio: { condition: "strong" }, inactive: true, inactivity: { daysSinceReview: 7 }, workload: { maraOpen: 8, creatorOpen: 5, ignoredCount: 5, blockedCount: 0 } }) },
  { id: "international-multilingual", name: "International and multilingual creator", expected: ["assess_international_fit"], avoid: [], maxCost: .25,
    state: state({ niche: "travel", portfolio: { condition: "strong" }, geographyAndLanguages: { country: "Portugal", languages: ["Portuguese", "English"], paymentCurrencies: ["EUR"], shippingMarkets: ["EU"] }, internationalOpportunity: { market: "Germany", language: "English", shipsTo: ["EU"], paysIn: "EUR" } }) },
  { id: "conflicting-preferences", name: "Conflicting user preferences", expected: ["resolve_preference_conflict"], avoid: [], maxCost: .08,
    state: state({ niche: "nightlife and hospitality", portfolio: { condition: "strong" }, preferences: { excludedCategories: ["alcohol"] }, preferenceConflict: { canonical: "exclude alcohol", recentDirection: "find nightlife opportunities that may include alcohol brands" } }) },
  { id: "overdue-payment", name: "Overdue payment", expected: ["resolve_overdue_payment"], avoid: ["strengthen_pipeline"], maxCost: .06,
    state: state({ niche: "beauty", portfolio: { condition: "strong" }, activeOpportunities: [{ id: "deal-paid-work", stage: "delivered" }], revenue: { expected: 800, confirmed: 800, paid: 0, invoicesDue: [], invoicesOverdue: [{ id: "inv-17", amount: 800, daysOverdue: 7, dispute: false }] } }) },
  { id: "poor-contacts", name: "Poor contact quality", expected: ["improve_contact_quality"], avoid: [], maxCost: .18,
    state: state({ niche: "tech", portfolio: { condition: "strong" }, unsentOutreachBacklog: [{ id: "a", contactConfidence: .2 }, { id: "b", contactConfidence: .3 }], performance: { pitchesSent: 25, replies: 2, responseRate: .08, bounceRate: .24, contentSignals: [] }, risks: [{ type: "contact_quality", detail: "guessed and stale contacts" }] }) },
  { id: "low-response", name: "Low outreach response rate", expected: ["diagnose_low_response"], avoid: ["address_portfolio_gap"], maxCost: .25,
    state: state({ niche: "sustainable fashion", portfolio: { condition: "strong" }, performance: { pitchesSent: 60, replies: 2, responseRate: .033, bounceRate: .01, contentSignals: [] }, hypotheses: [{ claim: "brand segment or value proposition may be weak", confidence: .45 }], strategyReason: "Deliverability is acceptable; compare segments, channels, proof, timing, and pitch structure through limited experiments." }) },
  { id: "portfolio-alone", name: "Portfolio should be left alone", expected: [], avoid: ["address_portfolio_gap"], maxCost: .15,
    state: state({ niche: "home decor", portfolio: { condition: "strong", lastValidatedAt: "2026-07-13", evidence: ["current, niche-aligned, conversion-ready"] }, activeOpportunities: [{ id: "steady-deal", stage: "active", nextAction: "waiting on brand" }], emergingNeeds: [], strategy: "wait for current deal response", strategyReason: "Weekend checkpoint and unrelated trend do not justify portfolio or new work." }) }
];

export function getMaraPhase2Scenario(id) { return MARA_PHASE2_SCENARIOS.find((scenario) => scenario.id === id); }
