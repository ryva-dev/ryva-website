const ACTIVE_REVENUE = new Set(["protect_active_deadline", "resolve_overdue_payment", "prepare_due_follow_up", "investigate_suspicious_outreach", "throttle_and_reenter"]);

export function evaluateWorkloadPolicy(state = {}, env = process.env) {
  const backlog = Number(state.unsentOutreachBacklog?.length || 0);
  const pauseAt = Number(env.MARA_OPPORTUNITY_PAUSE_THRESHOLD || 20);
  const resumeAt = Number(env.MARA_OPPORTUNITY_RESUME_THRESHOLD || 14);
  const ignored = Number(state.workload?.ignoredCount || 0);
  const dormant = Boolean(state.inactive) || ignored >= Number(env.MARA_DORMANT_IGNORED_TASK_THRESHOLD || 5);
  const discoveryPaused = backlog >= pauseAt || (Boolean(state.workload?.discoveryPaused) && backlog > resumeAt);
  return { backlog, pauseAt, resumeAt, discoveryPaused, discoveryMayResume: backlog <= resumeAt, dormant, temporaryReduction: dormant || Boolean(state.capacity?.temporarilyReduced) };
}

export function shouldSuppressWork(work, state = {}, env = process.env) {
  const policy = evaluateWorkloadPolicy(state, env);
  const types = new Set(work.sourceCandidateTypes || []);
  const text = `${work.title || ""} ${work.commercialObjective || ""}`.toLowerCase();
  if (policy.discoveryPaused && (types.has("strengthen_pipeline") || /new opportunit|prospect|discover brands|pipeline research/.test(text))) {
    return "Opportunity discovery pauses while the unsent backlog is at or above the safety threshold.";
  }
  if (state.portfolio?.condition === "strong" && (types.has("address_portfolio_gap") || /(?:update|rebuild|create|optimi[sz]e|review) (?:the )?(?:portfolio|media kit)/.test(text))) {
    return "The current portfolio is strong and should be left alone.";
  }
  if (policy.dormant && ![...types].some((type) => ACTIVE_REVENUE.has(type)) && !/deadline|payment|reply|risk|fraud/.test(text)) {
    return "Dormant mode preserves only urgent obligations and low-friction re-entry work.";
  }
  return null;
}
