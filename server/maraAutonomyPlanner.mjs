const MAINTAIN_ARTIFACT_MAX_AGE_HOURS = {
  brand_criteria: 24 * 14,
  creator_positioning: 24 * 14,
  ops_brief: 24,
  tiktok_trends: 24 * 7,
  ugc_strategy: 24 * 3,
  tracker_structure: 24 * 7,
  growth_intelligence_brief: 24 * 7,
  weekly_plan: 24 * 7,
  weekly_schedule: 24 * 7
};

const DAY_INDEX = {
  Friday: 5,
  Monday: 1,
  Saturday: 6,
  Sunday: 0,
  Thursday: 4,
  Tuesday: 2,
  Wednesday: 3
};

export function computeNextRunAt(cadence, dayOfWeek = null, fromDate = new Date()) {
  const base = new Date(fromDate);
  if (cadence === "monthly") {
    const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1, 9, 0, 0));
    return next.toISOString();
  }

  const targetDay = DAY_INDEX[dayOfWeek] ?? base.getUTCDay();
  const next = new Date(base);
  next.setUTCHours(9, 0, 0, 0);
  let delta = (targetDay - next.getUTCDay() + 7) % 7;
  if (delta === 0 && next.getTime() <= base.getTime()) {
    delta = 7;
  }
  next.setUTCDate(next.getUTCDate() + delta);
  return next.toISOString();
}

export function isRecurringDue(recurring, now = new Date()) {
  if (!recurring?.isActive) {
    return false;
  }

  const nowMs = now.getTime();
  if (recurring.nextRunAt) {
    return new Date(recurring.nextRunAt).getTime() <= nowMs;
  }

  if (!recurring.lastRunAt) {
    return true;
  }

  const lastMs = new Date(recurring.lastRunAt).getTime();
  const hoursSince = (nowMs - lastMs) / (1000 * 60 * 60);
  if (recurring.cadence === "monthly") {
    return hoursSince >= 24 * 28;
  }
  return hoursSince >= 24 * 6.5;
}

export function mapRecurringToAutonomyAction(recurring) {
  const title = String(recurring.title ?? "").toLowerCase();
  const description = String(recurring.description ?? "").toLowerCase();
  const combined = `${title} ${description}`;

  if (/brand research|target brand|find.*brand/.test(combined)) {
    return { kind: "brand_research", recurringId: recurring.id };
  }
  if (/content idea|idea batch/.test(combined)) {
    return { kind: "brand_content_ideas_batch", recurringId: recurring.id };
  }
  if (/follow-up|follow up|tracker|pipeline/.test(combined)) {
    return { kind: "update_tracker", recurringId: recurring.id };
  }
  if (/position|profile refresh|brand fit/.test(combined)) {
    return { kind: "maintain_profile", recurringId: recurring.id };
  }
  if (/weekly plan|action plan/.test(combined)) {
    return { kind: "weekly_plan", recurringId: recurring.id };
  }
  if (/reddit|market signal|learn/.test(combined)) {
    return { kind: "reddit_pulse", recurringId: recurring.id };
  }
  if (/tiktok|trend|hashtag/.test(combined)) {
    return { kind: "tiktok_trends", recurringId: recurring.id };
  }

  return { kind: "ops_brief", recurringId: recurring.id };
}

/**
 * State-driven planner for Mara's autonomy loop.
 * Returns ordered actions Mara should attempt this cycle.
 */
export function planMaraAutonomyActions(context) {
  const actions = [];
  const {
    blockers = [],
    brandResearchRemaining = 0,
    brandsNeedingContentIdeas = [],
    brandsNeedingPitches = [],
    canRunInbox = false,
    dueRecurring = [],
    hasConnectedEmail = false,
    leadCount = 0,
    onboardingComplete = false,
    permissions = {},
    recentOutputTypes = {},
    runnableApprovedTasks = [],
    trendSnapshotUpdatedAt = null
  } = context;

  if (!onboardingComplete) {
    return [{ kind: "blocked", reason: "Mara needs completed onboarding before her autonomy loop can start." }];
  }

  actions.push({ kind: "ensure_starter_tasks" });

  if (!recentOutputTypes.creator_positioning) {
    actions.push({
      kind: "maintain_artifact",
      reason: "No creator positioning on file yet.",
      taskType: "creator_positioning",
      title: "Define creator positioning"
    });
  } else if (isArtifactStale(recentOutputTypes.creator_positioning, MAINTAIN_ARTIFACT_MAX_AGE_HOURS.creator_positioning)) {
    actions.push({
      kind: "maintain_artifact",
      reason: "Creator positioning is due for a refresh.",
      taskType: "creator_positioning",
      title: "Refresh creator positioning"
    });
  }

  if (!recentOutputTypes.brand_criteria) {
    actions.push({
      kind: "maintain_artifact",
      reason: "No brand fit criteria on file yet.",
      taskType: "brand_fit_criteria",
      title: "Build brand fit criteria"
    });
  } else if (isArtifactStale(recentOutputTypes.brand_criteria, MAINTAIN_ARTIFACT_MAX_AGE_HOURS.brand_criteria)) {
    actions.push({
      kind: "maintain_artifact",
      reason: "Brand fit criteria are due for a refresh.",
      taskType: "brand_fit_criteria",
      title: "Refresh brand fit criteria"
    });
  }

  for (const recurring of dueRecurring) {
    actions.push(mapRecurringToAutonomyAction(recurring));
  }

  if (permissions.canRunResearch && brandResearchRemaining > 0) {
    actions.push({ kind: "brand_research", limit: brandResearchRemaining });
  }

  // Always harvest commercial signal from evidence Mara already holds.
  actions.push({ kind: "infer_commercial_outcomes" });
  actions.push({ kind: "manage_stalled_opportunities" });
  actions.push({ kind: "advance_won_opportunities" });

  // Deep-refresh top candidate brands when research budget remains.
  if (permissions.canRunResearch && brandResearchRemaining > 0 && (context.growthPitchTargets || []).length) {
    actions.push({
      kind: "deep_brand_research",
      brandName: context.growthPitchTargets[0].brandName,
      website: context.growthPitchTargets[0].website || null
    });
  }

  // Prepare opportunity packages for qualified targets missing packages.
  if ((context.growthPitchTargets || []).some((target) => target.status === "candidate" || target.status === "qualified")) {
    actions.push({ kind: "prepare_opportunity_packages", limit: 2 });
  }

  // Draft follow-ups that are due (approval still required to send).
  // Only schedule when the context knows there are due rows — otherwise skip noise.
  if (context.dueFollowUpCount == null || Number(context.dueFollowUpCount) > 0) {
    actions.push({ kind: "prepare_due_followups" });
  }

  for (const brand of brandsNeedingPitches.slice(0, 2)) {
    actions.push({
      brandId: brand.id,
      brandName: brand.brandName,
      kind: "personalized_pitch",
      researchItemId: brand.researchItemId ?? null,
      opportunityId: brand.opportunityId ?? null,
      publicBrandId: brand.publicBrandId ?? null,
      website: brand.website ?? null,
      scoreTotal: brand.scoreTotal ?? null,
      outreachReady: Boolean(brand.outreachReady),
      source: brand.source || "worker_brands"
    });
  }

  for (const brand of brandsNeedingContentIdeas.slice(0, 2)) {
    actions.push({
      brandId: brand.id,
      brandName: brand.brandName,
      kind: "brand_content_ideas"
    });
  }

  if (canRunInbox) {
    actions.push({ kind: "inbox_organization" });
  } else if (hasConnectedEmail && !permissions.canReadInbox) {
    blockers.push("Inbox is connected but Mara still does not have inbox-read permission.");
  }

  if (leadCount > 0 && isArtifactStale(recentOutputTypes.tracker_structure, MAINTAIN_ARTIFACT_MAX_AGE_HOURS.tracker_structure)) {
    actions.push({ kind: "update_tracker", reason: "Lead tracker should reflect the latest inbox and research activity." });
  }

  if (isArtifactStale(recentOutputTypes.weekly_plan, MAINTAIN_ARTIFACT_MAX_AGE_HOURS.weekly_plan)) {
    actions.push({ kind: "weekly_plan" });
  }

  if (isArtifactStale(recentOutputTypes.growth_intelligence_brief, MAINTAIN_ARTIFACT_MAX_AGE_HOURS.growth_intelligence_brief)) {
    actions.push({
      kind: "maintain_artifact",
      reason: "Build this week's creator-specific opportunity, creative-gap, and revenue intelligence brief.",
      taskType: "weekly_growth_intelligence_brief",
      title: "Prepare weekly growth intelligence brief"
    });
  }

  if (isArtifactStale(recentOutputTypes.weekly_schedule, MAINTAIN_ARTIFACT_MAX_AGE_HOURS.weekly_schedule)) {
    actions.push({
      kind: "maintain_artifact",
      reason: "Build this week's working schedule: filming blocks, posting slots, story cadence, and follow-up time.",
      taskType: "weekly_schedule",
      title: "Plan this week's schedule"
    });
  }

  if (isArtifactStale(recentOutputTypes.ops_brief, MAINTAIN_ARTIFACT_MAX_AGE_HOURS.ops_brief)) {
    actions.push({ kind: "ops_brief" });
  }

  // Market-pulse work must not spam the library: only one fresh pulse doc at
  // a time, and never generate a trend brief when no trend data exists.
  const marketPulseFresh = recentOutputTypes.market_pulse
    && !isArtifactStale(recentOutputTypes.market_pulse, MAINTAIN_ARTIFACT_MAX_AGE_HOURS.tiktok_trends);

  if (permissions.canRunResearch && brandResearchRemaining === 0 && !marketPulseFresh) {
    actions.push({ kind: "reddit_pulse", reason: "I'll scan creator communities for fresh angles while brand research cools down." });
  }

  if (
    permissions.canRunResearch &&
    isArtifactStale(recentOutputTypes.strategy ?? null, MAINTAIN_ARTIFACT_MAX_AGE_HOURS.ugc_strategy)
  ) {
    actions.push({
      kind: "ugc_strategy_research",
      reason: "Refresh cross-platform UGC strategy: what works, what to avoid, and which channels still need API keys."
    });
  }

  if (
    trendSnapshotUpdatedAt &&
    !marketPulseFresh &&
    isArtifactStale(recentOutputTypes.market_pulse ?? null, MAINTAIN_ARTIFACT_MAX_AGE_HOURS.tiktok_trends)
  ) {
    actions.push({ kind: "tiktok_trends", reason: "Refresh niche-scoped TikTok trend insights for this creator." });
  } else if (!trendSnapshotUpdatedAt) {
    // Soft note only — do not block the commercial loop on missing trends.
  }

  if (runnableApprovedTasks.length > 0) {
    actions.push({ kind: "drain_approved_queue", limit: 3, taskIds: runnableApprovedTasks.map((task) => task.id) });
  }

  return actions;
}

const HEAVY_AUTONOMY_ACTION_KINDS = new Set(["brand_research", "inbox_organization", "reddit_pulse", "ugc_strategy_research", "deep_brand_research"]);

export function filterPlannedActionsForMode(plannedActions, mode = "full") {
  if (mode !== "interactive") {
    return plannedActions;
  }

  return plannedActions.filter((action) => !HEAVY_AUTONOMY_ACTION_KINDS.has(action.kind));
}

function isArtifactStale(lastCreatedAt, maxAgeHours) {
  if (!lastCreatedAt) {
    return true;
  }
  const ageMs = Date.now() - new Date(lastCreatedAt).getTime();
  return ageMs >= maxAgeHours * 60 * 60 * 1000;
}

export function buildAutonomyPlannerContext({
  approvals = [],
  blockedTasks = [],
  brandResearchRemaining = 0,
  brands = [],
  dueFollowUpCount = null,
  dueRecurring = [],
  growthPitchTargets = [],
  hasConnectedEmail = false,
  integrations = [],
  leadCount = 0,
  onboarding = null,
  outputs = [],
  permissions = {},
  tasks = [],
  trendSnapshotUpdatedAt = null
}) {
  const recentOutputTypes = outputs.reduce((acc, output) => {
    const type = String(output.outputType ?? "");
    if (!type) {
      return acc;
    }
    if (!acc[type] || new Date(output.createdAt).getTime() > new Date(acc[type]).getTime()) {
      acc[type] = output.createdAt;
    }
    return acc;
  }, {});

  const brandsNeedingContentIdeas = brands.filter((brand) => {
    if (!brand.lastContentIdeasAt) {
      return true;
    }
    return isArtifactStale(brand.lastContentIdeasAt, 24 * 7);
  });

  const stalePitchBrands = brands.filter((brand) => {
    if (!brand.lastPitchAt) {
      return true;
    }
    return isArtifactStale(brand.lastPitchAt, 24 * 14);
  });

  // Prefer Mara-ranked opportunities when available; fall back to raw worker_brands.
  const rankedTargets = Array.isArray(growthPitchTargets) ? growthPitchTargets : [];
  const brandsNeedingPitches = (rankedTargets.length
    ? rankedTargets.map((target) => {
        const matched = brands.find(
          (brand) =>
            String(brand.brandName || "").toLowerCase() === String(target.brandName || "").toLowerCase() ||
            (brand.website && target.website && String(brand.website).toLowerCase() === String(target.website).toLowerCase())
        );
        return {
          id: matched?.id || target.brandProfileId,
          brandName: target.brandName,
          website: target.website || matched?.website || null,
          researchItemId: matched?.researchItemId ?? null,
          lastPitchAt: matched?.lastPitchAt ?? null,
          opportunityId: target.id,
          scoreTotal: target.scoreTotal,
          contactEmail: matched?.contactEmail || target.contactEmail || null,
          outreachReady: Boolean(
            matched?.contactEmail ||
              target.outreachReady ||
              target.contactEmail ||
              target.outreachContact?.value
          ),
          publicBrandId: target.publicBrandId || target.brandProfileId || null,
          source: "mara_opportunity"
        };
      }).filter((brand) => {
        if (!brand.lastPitchAt) return true;
        return isArtifactStale(brand.lastPitchAt, 24 * 14);
      })
    : stalePitchBrands.map((brand) => ({
        ...brand,
        outreachReady: Boolean(brand.contactEmail),
        contactEmail: brand.contactEmail || null
      }))
  ).sort((left, right) => Number(Boolean(right.outreachReady)) - Number(Boolean(left.outreachReady)));

  // Prefer pitching brands that already have a sendable contact; still include others for draft-only work.
  const pitchQueue = [
    ...brandsNeedingPitches.filter((brand) => brand.outreachReady),
    ...brandsNeedingPitches.filter((brand) => !brand.outreachReady)
  ].slice(0, 2);

  const runnableApprovedTasks = tasks
    .filter((task) => task.status === "approved")
    .sort((left, right) => priorityRank(right.priority) - priorityRank(left.priority));

  const connected = integrations.some((entry) => entry.status === "connected");

  return {
    approvals,
    blockedTasks,
    blockers: [],
    brandResearchRemaining,
    brands,
    brandsNeedingContentIdeas,
    brandsNeedingPitches: pitchQueue,
    canRunInbox: Boolean(permissions.canReadInbox && connected),
    dueFollowUpCount,
    dueRecurring,
    growthPitchTargets: rankedTargets,
    hasConnectedEmail: connected,
    leadCount,
    onboardingComplete: onboarding?.status === "completed",
    permissions,
    recentOutputTypes,
    runnableApprovedTasks,
    trendSnapshotUpdatedAt
  };
}

function priorityRank(priority) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}
