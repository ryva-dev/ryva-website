const DEFAULT_MARA_PERMISSIONS_BASE = {
  approvalRequiredForExternalActions: true,
  canCreateRecurringResponsibilities: true,
  canCreateTasks: true,
  canDraftOutreach: true,
  canReadInbox: false,
  canRunResearch: true,
  canSendEmailsWithApproval: false,
  canSendEmailsWithoutApproval: false,
  canSuggestTasks: true,
  canUpdateExternalTrackers: false,
  canUseConnectedIntegrations: false
};

export function sentenceCase(value) {
  const trimmed = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function safeList(json) {
  try {
    const parsed = typeof json === "string" ? JSON.parse(json) : json;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

const TASK_SOURCE_LABELS = {
  autonomy_brand_content: "Brand content planning",
  autonomy_brand_pitch: "Outreach",
  autonomy_brand_research: "Brand research",
  autonomy_maintenance: "Profile upkeep",
  autonomy_market_pulse: "Creator community signals",
  autonomy_ops_brief: "Daily brief",
  autonomy_starter: "Getting started",
  autonomy_tiktok_trends: "Trend research",
  autonomy_tracker: "Pipeline tracker",
  autonomy_weekly_planning: "Weekly planning",
  chat_direct_request: "From our chat",
  mara_suggested: "Suggested by me",
  memory_triggered: "From what I know about you",
  onboarding_generated: "From your onboarding",
  research_triggered: "From research",
  recurring: "Recurring work"
};

export function formatTaskSourceLabel(source) {
  const key = String(source ?? "").trim();
  if (!key || key === "worker_task" || key === "office_task") {
    return "";
  }
  return TASK_SOURCE_LABELS[key] || sentenceCase(key.replace(/_/g, " "));
}

export function deriveMaraPermissionsFromOnboarding(answers = {}, { inboxConnected = false } = {}) {
  const combined = [
    answers.approval_rules,
    answers.reply_boundaries,
    answers.daily_output,
    answers.email_volume,
    answers.deadline_style
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const permissions = {
    ...DEFAULT_MARA_PERMISSIONS_BASE,
    canCreateRecurringResponsibilities: true,
    canCreateTasks: true,
    canDraftOutreach: true,
    canRunResearch: true,
    canSuggestTasks: true,
    approvalRequiredForExternalActions: true,
    canSendEmailsWithoutApproval: false,
    canSendEmailsWithApproval: true,
    canReadInbox: inboxConnected,
    canUseConnectedIntegrations: inboxConnected,
    canUpdateExternalTrackers: inboxConnected
  };

  if (/no research|don't research|do not research|skip research|hold off on research/i.test(combined)) {
    permissions.canRunResearch = false;
  }

  if (/no outreach|don't pitch|do not pitch|no pitching|hold outreach/i.test(combined)) {
    permissions.canDraftOutreach = false;
  }

  if (/never send|don't send|do not send|without my approval|always ask|always bring|bring back to me|check with me first|need my approval/i.test(combined)) {
    permissions.canSendEmailsWithoutApproval = false;
    permissions.canSendEmailsWithApproval = true;
    permissions.approvalRequiredForExternalActions = true;
  }

  // Public launch stays approval-gated even if free-form onboarding asks Mara
  // to send independently. Graduated authority must be granted through a
  // dedicated, inspectable policy flow rather than inferred from prose.
  if (/send on your own|you can send|approve yourself|without asking/i.test(combined)) {
    permissions.canSendEmailsWithoutApproval = false;
    permissions.canSendEmailsWithApproval = true;
    permissions.approvalRequiredForExternalActions = true;
  }

  const integrationInterest = String(answers.integration_interest ?? "").toLowerCase();
  if (integrationInterest.includes("no")) {
    permissions.canReadInbox = false;
    permissions.canUseConnectedIntegrations = false;
  } else if (inboxConnected) {
    permissions.canReadInbox = true;
    permissions.canUseConnectedIntegrations = true;
  }

  if (/draft only|organize only|don't reply|do not reply/i.test(String(answers.reply_boundaries ?? "").toLowerCase())) {
    permissions.canSendEmailsWithoutApproval = false;
    permissions.canSendEmailsWithApproval = true;
  }

  return permissions;
}

export function formatMaraCurrentFocus({
  runningTask = null,
  inProgressTask = null,
  runnableTask = null,
  waitingItem = null,
  recommendedLabel = null,
  hasTrackedWork = false
}) {
  if (runningTask?.title || inProgressTask?.title) {
    const title = runningTask?.title || inProgressTask?.title;
    return `I'm working on ${title}.`;
  }
  if (runnableTask?.title) {
    return `I'm picking up ${runnableTask.title} next.`;
  }
  if (waitingItem?.title) {
    return `I'm waiting on you for ${waitingItem.title}.`;
  }
  if (recommendedLabel) {
    return `I'm ready to move on ${recommendedLabel}.`;
  }
  if (hasTrackedWork) {
    return "I'm caught up on my queue and ready for the next move.";
  }
  return "I'm getting oriented on your brand and setting up my first pieces of work.";
}

export function formatMaraActivityDescription(eventType, title, description) {
  const cleanTitle = String(title ?? "").trim();
  const cleanDescription = String(description ?? "").trim();
  if (eventType === "autonomy_cycle_completed") {
    return cleanDescription.replace(/^Planned /, "I planned ").replace(/created (\d+)/, "created $1").replace(/executed (\d+)/, "finished $1");
  }
  if (eventType === "task_completed" || eventType === "task_auto_executed" || eventType === "chat_task_executed") {
    return cleanTitle ? `I finished ${cleanTitle}.` : "I finished a task.";
  }
  if (eventType === "task_created" || eventType === "chat_task_created") {
    return cleanTitle ? `I queued ${cleanTitle}.` : "I queued new work.";
  }
  if (eventType === "approval_requested") {
    return cleanTitle ? `I need your approval on ${cleanTitle}.` : "I need your approval on something.";
  }
  if (eventType === "worker_output_created") {
    return cleanTitle ? `I shipped ${cleanTitle}.` : "I shipped a new deliverable.";
  }
  return cleanDescription || cleanTitle || "I updated my work.";
}
