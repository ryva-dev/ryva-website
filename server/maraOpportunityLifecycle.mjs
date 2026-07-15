/**
 * Canonical Mara opportunity lifecycle — single SoT for commercial stage.
 * Legacy `status` values are projected from lifecycle_stage for compatibility.
 */

export const LIFECYCLE_STAGES = Object.freeze([
  "discovered",
  "researching",
  "qualified",
  "disqualified",
  "contact_needed",
  "contact_found",
  "pitch_preparing",
  "approval_needed",
  "approved_to_send",
  "sent",
  "follow_up_due",
  "replied",
  "interested",
  "negotiating",
  "won",
  "lost",
  "brief_received",
  "producing",
  "submitted",
  "revision_requested",
  "approved_by_brand",
  "invoice_needed",
  "invoiced",
  "payment_due",
  "overdue",
  "paid",
  "cold",
  "archived"
]);

/** Terminal stages research refresh must never demote. */
export const TERMINAL_OR_ADVANCED_STAGES = new Set([
  "sent",
  "follow_up_due",
  "replied",
  "interested",
  "negotiating",
  "won",
  "lost",
  "brief_received",
  "producing",
  "submitted",
  "revision_requested",
  "approved_by_brand",
  "invoice_needed",
  "invoiced",
  "payment_due",
  "overdue",
  "paid",
  "cold",
  "archived",
  "disqualified"
]);

/** Map legacy opportunity.status → lifecycle_stage */
export const LEGACY_STATUS_TO_LIFECYCLE = Object.freeze({
  candidate: "discovered",
  qualified: "qualified",
  active: "pitch_preparing",
  contacted: "sent",
  responded: "replied",
  concept_accepted: "interested",
  won: "won",
  won_repeat: "won",
  cold: "cold",
  lost: "lost"
});

/** Map lifecycle_stage → legacy status for older UI / pitch targeting */
export const LIFECYCLE_TO_LEGACY_STATUS = Object.freeze({
  discovered: "candidate",
  researching: "candidate",
  qualified: "qualified",
  disqualified: "cold",
  contact_needed: "qualified",
  contact_found: "qualified",
  pitch_preparing: "active",
  approval_needed: "active",
  approved_to_send: "active",
  sent: "contacted",
  follow_up_due: "contacted",
  replied: "responded",
  interested: "concept_accepted",
  negotiating: "concept_accepted",
  won: "won",
  lost: "lost",
  brief_received: "won",
  producing: "won",
  submitted: "won",
  revision_requested: "won",
  approved_by_brand: "won",
  invoice_needed: "won",
  invoiced: "won",
  payment_due: "won",
  overdue: "won",
  paid: "won",
  cold: "cold",
  archived: "cold"
});

const STAGE_RANK = Object.fromEntries(LIFECYCLE_STAGES.map((stage, index) => [stage, index]));

export function normalizeLifecycleStage(value, { legacyStatus = null } = {}) {
  const raw = String(value || "").trim().toLowerCase();
  if (LIFECYCLE_STAGES.includes(raw)) return raw;
  if (legacyStatus && LEGACY_STATUS_TO_LIFECYCLE[legacyStatus]) {
    return LEGACY_STATUS_TO_LIFECYCLE[legacyStatus];
  }
  if (LEGACY_STATUS_TO_LIFECYCLE[raw]) return LEGACY_STATUS_TO_LIFECYCLE[raw];
  return "discovered";
}

export function legacyStatusFromLifecycle(stage) {
  return LIFECYCLE_TO_LEGACY_STATUS[normalizeLifecycleStage(stage)] || "candidate";
}

export function isValidLifecycleTransition(fromStage, toStage) {
  const from = normalizeLifecycleStage(fromStage);
  const to = normalizeLifecycleStage(toStage);
  if (from === to) return true;
  if (to === "archived" || to === "lost" || to === "disqualified" || to === "cold") return true;
  if (from === "archived" || from === "lost") return false;
  // Allow forward movement and limited lateral recovery (e.g. contact_needed → contact_found).
  if ((STAGE_RANK[to] ?? 0) >= (STAGE_RANK[from] ?? 0)) return true;
  // Allow regress only for operational corrections within pre-win funnel.
  const preWin = new Set([
    "discovered",
    "researching",
    "qualified",
    "contact_needed",
    "contact_found",
    "pitch_preparing",
    "approval_needed",
    "approved_to_send",
    "sent",
    "follow_up_due"
  ]);
  return preWin.has(from) && preWin.has(to);
}

/**
 * Preserve advanced commercial progress when research refreshes.
 */
export function mergeResearchLifecycle({
  existingLifecycle = null,
  existingStatus = null,
  decision = "monitor",
  hasOutreachContact = false
} = {}) {
  const current = normalizeLifecycleStage(existingLifecycle, { legacyStatus: existingStatus });
  if (TERMINAL_OR_ADVANCED_STAGES.has(current) && !["qualified", "contact_needed", "contact_found"].includes(current)) {
    return current;
  }

  if (decision === "avoid_pending_verification" || decision === "deprioritize") {
    return current === "discovered" || current === "researching" ? "disqualified" : current;
  }

  if (decision === "build_toward") {
    return current === "discovered" ? "researching" : current;
  }

  if (decision === "pursue") {
    if (hasOutreachContact) return "contact_found";
    return "contact_needed";
  }

  if (current === "discovered") return "researching";
  return current || "researching";
}

export function buildNextAction({
  lifecycleStage,
  hasOutreachContact = false,
  hasPendingSendApproval = false,
  hasDraft = false,
  daysInStage = 0,
  estimatedValue = 0
} = {}) {
  const stage = normalizeLifecycleStage(lifecycleStage);
  const valueNote = estimatedValue > 0 ? ` (~$${Math.round(estimatedValue)})` : "";

  const table = {
    discovered: {
      action: "deep_research",
      label: "Deep-research this brand for commercial fit",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    researching: {
      action: "finish_qualification",
      label: "Finish qualification with observed evidence",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    qualified: {
      action: hasOutreachContact ? "prepare_pitch" : "discover_contact",
      label: hasOutreachContact ? "Prepare a commercial pitch" : "Find an outreach-ready contact",
      autonomous: true,
      requiresApproval: false,
      blockingReason: hasOutreachContact ? null : "No verified outreach contact"
    },
    contact_needed: {
      action: "discover_contact",
      label: "Discover and validate a partnership contact",
      autonomous: true,
      requiresApproval: false,
      blockingReason: "Contact discovery incomplete"
    },
    contact_found: {
      action: "prepare_pitch",
      label: "Draft a commercially relevant pitch",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    pitch_preparing: {
      action: "finish_pitch_draft",
      label: "Finish pitch draft and queue for approval",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    approval_needed: {
      action: "approve_send",
      label: `Approve send${valueNote}`,
      autonomous: false,
      requiresApproval: true,
      blockingReason: "Waiting on manager send approval"
    },
    approved_to_send: {
      action: "send_email",
      label: "Send approved draft from creator Gmail",
      autonomous: false,
      requiresApproval: true,
      blockingReason: "Send executes only after explicit approval"
    },
    sent: {
      action: daysInStage >= 3 ? "prepare_follow_up" : "wait_or_follow_up",
      label: daysInStage >= 3 ? "Prepare follow-up draft" : "Monitor for reply",
      autonomous: daysInStage >= 3,
      requiresApproval: false,
      blockingReason: null
    },
    follow_up_due: {
      action: "prepare_follow_up",
      label: "Prepare follow-up draft for approval",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    replied: {
      action: "classify_reply",
      label: "Classify reply and draft next response",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    interested: {
      action: "advance_interest",
      label: "Send rates/portfolio/concepts as requested",
      autonomous: true,
      requiresApproval: true,
      blockingReason: "External reply still requires approval to send"
    },
    negotiating: {
      action: "negotiate_terms",
      label: "Flag risks and draft negotiation response",
      autonomous: true,
      requiresApproval: true,
      blockingReason: "Cannot accept rates, rights, or exclusivity without approval"
    },
    won: {
      action: "start_production",
      label: "Create campaign, extract brief, plan production",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    brief_received: {
      action: "structure_deliverables",
      label: "Structure deliverables and production timeline",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    producing: {
      action: "support_production",
      label: "Support concepts, shot list, and draft review",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    submitted: {
      action: "monitor_brand_feedback",
      label: "Monitor brand feedback / approval",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    revision_requested: {
      action: "create_revision_tasks",
      label: "Turn feedback into revision tasks",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    approved_by_brand: {
      action: "prepare_invoice_reminder",
      label: "Prepare invoicing reminder",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    invoice_needed: {
      action: "invoice_reminder",
      label: "Remind creator to invoice",
      autonomous: true,
      requiresApproval: false,
      blockingReason: "Creator must send invoice"
    },
    invoiced: {
      action: "monitor_payment",
      label: "Monitor payment status",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    payment_due: {
      action: "payment_follow_up",
      label: "Draft polite payment follow-up",
      autonomous: true,
      requiresApproval: true,
      blockingReason: "Payment chase requires approval to send"
    },
    overdue: {
      action: "escalate_payment",
      label: "Escalate overdue payment",
      autonomous: false,
      requiresApproval: true,
      blockingReason: "Overdue payment needs manager decision"
    },
    paid: {
      action: "archive_or_renew",
      label: "Log revenue and consider renewal",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    lost: {
      action: "learn_and_archive",
      label: "Capture loss reason and deprioritize",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    cold: {
      action: "revisit_or_archive",
      label: "Revisit later or archive",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    },
    disqualified: {
      action: "archive",
      label: "Keep disqualified — do not pitch",
      autonomous: true,
      requiresApproval: false,
      blockingReason: "Failed qualification"
    },
    archived: {
      action: "none",
      label: "No action",
      autonomous: true,
      requiresApproval: false,
      blockingReason: null
    }
  };

  const base = table[stage] || table.discovered;
  if (hasPendingSendApproval) {
    return {
      ...base,
      action: "approve_send",
      label: `Approve pending send${valueNote}`,
      autonomous: false,
      requiresApproval: true,
      blockingReason: "Draft waiting on approval"
    };
  }
  if (hasDraft && ["contact_found", "qualified", "pitch_preparing"].includes(stage)) {
    return {
      ...base,
      action: "approve_send",
      label: `Review pitch draft${valueNote}`,
      autonomous: false,
      requiresApproval: true,
      blockingReason: "Pitch draft ready"
    };
  }
  return base;
}

export function detectStall({
  lifecycleStage,
  stageChangedAt,
  now = new Date(),
  estimatedValue = 0,
  hasOutreachContact = false
} = {}) {
  const stage = normalizeLifecycleStage(lifecycleStage);
  const changedMs = stageChangedAt ? new Date(stageChangedAt).getTime() : NaN;
  const days = Number.isFinite(changedMs) ? (now.getTime() - changedMs) / (24 * 60 * 60 * 1000) : 0;

  const thresholds = {
    contact_needed: 2,
    contact_found: 2,
    pitch_preparing: 1,
    approval_needed: 1,
    sent: 3,
    follow_up_due: 1,
    replied: 1,
    interested: 2,
    negotiating: 3,
    won: 2,
    brief_received: 2,
    producing: 3,
    submitted: 5,
    invoice_needed: 3,
    payment_due: 2,
    overdue: 0
  };

  const threshold = thresholds[stage];
  if (threshold == null) return null;
  if (days < threshold && stage !== "overdue") return null;

  const next = buildNextAction({
    lifecycleStage: stage,
    hasOutreachContact,
    daysInStage: days,
    estimatedValue
  });

  return {
    stage,
    daysStalled: Math.round(days * 10) / 10,
    likelyReason:
      stage === "contact_needed"
        ? "No outreach-ready contact found"
        : stage === "approval_needed"
          ? "Manager has not approved send"
          : stage === "sent"
            ? "No reply and follow-up is due"
            : stage === "overdue"
              ? "Payment past due"
              : `No progress in ${stage.replace(/_/g, " ")}`,
    nextAction: next,
    valueAtRisk: Number(estimatedValue) || 0,
    canActAutomatically: Boolean(next.autonomous) && !next.requiresApproval,
    requiresUserInput: Boolean(next.requiresApproval) || Boolean(next.blockingReason)
  };
}

export function claimEvidenceLabel(kind) {
  const normalized = String(kind || "").toLowerCase();
  if (normalized === "observed" || normalized === "verified" || normalized === "verified_evidence") {
    return "verified_evidence";
  }
  if (normalized === "inference" || normalized === "strong_inference") return "strong_inference";
  if (normalized === "hypothesis" || normalized === "weak_inference") return "weak_inference";
  return "unknown";
}
