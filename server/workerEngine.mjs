import { randomUUID } from "node:crypto";
import {
  buildAutonomyPlannerContext,
  computeNextRunAt,
  filterPlannedActionsForMode,
  isRecurringDue,
  planMaraAutonomyActions
} from "./maraAutonomyPlanner.mjs";
import { isMaraLlmConfigured, tryGenerateMaraBrandContentIdeas, tryGenerateMaraPersonalizedPitch } from "./maraLlm.mjs";
import {
  buildBrandContext,
  classifyRedditSignalsHeuristic,
  tryClassifyRedditSignals,
  tryExecuteAgentTaskLlm,
  tryPolishDeliverableVoice
} from "./agentLlm.mjs";
import { getRoleConfig } from "./roles.mjs";
import { buildInboxOpsSummary, parseUnparsedInboxThreads } from "./maraInboxOps.mjs";
import { getLatestTrendSnapshot, resolveGlobalTrendInsightsPath, syncUserTrendInsightsFromGlobal } from "./maraTrendOps.mjs";
import {
  deriveMaraPermissionsFromOnboarding,
  formatMaraActivityDescription,
  formatMaraCurrentFocus,
  formatTaskSourceLabel
} from "./maraOfficeUtils.mjs";

export { deriveMaraPermissionsFromOnboarding, formatTaskSourceLabel } from "./maraOfficeUtils.mjs";

export const MARA_WORKER_ID = "mara-vale";

export const DEFAULT_MARA_PERMISSIONS = {
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

export const MARA_ROLE_DEFINITION =
  "Mara is an autonomous UGC operations hire for a specific creator and brand. She maintains positioning and brand-fit criteria, researches aligned brands, drafts personalized outreach, organizes Gmail into a living tracker, generates brand-specific content ideas, surfaces blockers and approval needs, and keeps working within daily limits until she hits a real stop condition.";

const TASK_STATUS_MAP = {
  approved: "To Do",
  blocked: "Blocked",
  completed: "Completed",
  dismissed: "Completed",
  in_progress: "In Progress",
  proposed: "Pending approval"
};

const PRIORITY_MAP = {
  high: "High",
  low: "Low",
  medium: "Medium"
};

const PRIORITY_RANK = {
  high: 3,
  low: 1,
  medium: 2
};

const INTERNAL_ONLY_PERMISSION_PATTERNS = /sendemail|external|inbox|integration/i;

/**
 * Task types where the LLM should draft the deliverable directly from the
 * manager's brand context. Types that depend on live local data (trend
 * snapshots, reddit signals, inbox leads) keep their data-driven executors,
 * and pitch/content-idea types already have richer dedicated LLM paths.
 */
const LLM_FIRST_TASK_TYPES = new Set([
  "creator_positioning",
  "brand_fit_criteria",
  "pitch_template",
  "follow_up_sequence",
  "content_idea_batch",
  "weekly_action_plan",
  "weekly_schedule",
  "brand_tracker_structure",
  "ugc_shot_list",
  "portfolio_recommendations",
  "outreach_strategy",
  "pasted_message_analysis"
]);

async function tryExecuteLlmFirstMaraTask(context) {
  const roleConfig = getRoleConfig(context.workerId);
  if (!roleConfig) return null;

  const brandContext = buildBrandContext({
    accountOnboarding: context.accountContext,
    workerOnboardingAnswers: context.workerOnboarding?.answers ?? {},
    knowledgeSections: context.workerKnowledge,
    recentOutputs: context.previousOutputs,
    openTasks: context.relatedOpenTasks,
    integrations: context.connectedIntegrations,
    recentMessages: context.recentMessages
  });

  // Enrich the task with any linked brand/research context the engine has.
  const extraContextLines = [];
  if (context.targetBrand) {
    extraContextLines.push(
      `Target brand: ${context.targetBrand.brandName}${context.targetBrand.website ? ` (${context.targetBrand.website})` : ""}`,
      context.targetBrand.identitySummary ? `Brand identity: ${context.targetBrand.identitySummary}` : "",
      context.targetBrand.suggestedAngle ? `Suggested angle: ${context.targetBrand.suggestedAngle}` : ""
    );
  }
  for (const research of (context.relatedResearch || []).slice(0, 3)) {
    extraContextLines.push(`Research note — ${research.topic}: ${research.summary}`);
  }
  const task = {
    ...context.currentTask,
    description: [context.currentTask.description, ...extraContextLines.filter(Boolean)].filter(Boolean).join("\n")
  };

  return tryExecuteAgentTaskLlm({
    db: context.db,
    userId: context.userId,
    roleConfig,
    task,
    brandContext,
    fetchImpl: context.fetchImpl
  });
}

/** Data-driven outputs that get a voice rewrite (facts kept, prose humanized). */
const VOICE_POLISH_TASK_TYPES = new Set([
  "tiktok_trend_pulse",
  "reddit_market_pulse",
  "ops_brief",
  "update_brand_tracker"
]);

const SAFE_AUTO_EXECUTE_TASK_TYPES = new Set([
  "brand_content_ideas",
  "brand_fit_criteria",
  "content_idea_batch",
  "creator_positioning",
  "draft_brand_reply",
  "follow_up_sequence",
  "ops_brief",
  "personalized_pitch",
  "pitch_template",
  "reddit_market_pulse",
  "tiktok_trend_pulse",
  "update_brand_tracker",
  "weekly_schedule"
]);

export const MARA_REDDIT_COMMUNITIES = [
  "ugc",
  "UGCSideHustle",
  "UGCcreators",
  "UGCUNIVERSITY",
  "influencermarketing",
  "TikTokMarketing",
  "Tiktokhelp",
  "ContentCreators"
];

const MARA_DAILY_BRAND_RESEARCH_LIMIT = 5;

const TASK_TYPE_OUTPUT_TYPE_MAP = {
  brand_fit_criteria: "brand_criteria",
  brand_research_digest: "summary",
  brand_tracker_structure: "tracker_structure",
  content_idea_batch: "content_ideas",
  creator_positioning: "creator_positioning",
  draft_brand_reply: "reply_draft",
  follow_up_sequence: "follow_up_sequence",
  general_internal_task: "summary",
  inbox_status_digest: "summary",
  outreach_strategy: "strategy",
  pasted_message_analysis: "message_analysis",
  personalized_pitch: "pitch_draft",
  pitch_template: "pitch_template",
  portfolio_recommendations: "recommendation",
  research_queue_summary: "summary",
  ugc_shot_list: "shot_list",
  weekly_action_plan: "weekly_plan",
  weekly_schedule: "weekly_schedule",
  brand_content_ideas: "content_ideas",
  ops_brief: "ops_brief",
  reddit_market_pulse: "market_pulse",
  update_brand_tracker: "tracker_structure"
};

const MARA_KNOWLEDGE_MODULES = [
  {
    id: "mara-ugc-basics",
    workerType: "mara",
    title: "UGC creator basics",
    category: "ugc_basics",
    summary: "Foundational UGC context: what brands usually buy, how UGC differs from influencer work, and what beginners need first.",
    content: "UGC is creator-made content brands buy for their own channels or ads. It differs from influencer content because the value is the asset itself, not mainly the creator's audience. Brands usually buy short-form videos, photos, testimonials, product demos, routines, unboxings, hooks, and paid-ad-ready variations. Beginner creators often need a few solid samples, a simple niche position, and a clean outreach rhythm before expecting steady replies.",
    structuredContent: {
      beginnerExpectations: ["A few strong sample videos matter more than a polished website at first", "Clear niche positioning beats trying to pitch everyone", "Brands care about usable creative, not follower count alone"],
      deliverables: ["Short-form videos", "Photos", "Hooks", "Testimonials", "Product demos", "Routine content"],
      keyDifferences: ["UGC is an asset purchase", "Influencer work is often audience/distribution-led", "UGC can be used organically or in paid ads"],
      outreachBasics: ["Short pitch", "Specific angle", "Simple CTA", "Track follow-ups"]
    },
    tags: ["ugc", "basics", "beginner", "deliverables"],
    isActive: true
  },
  {
    id: "mara-creator-positioning",
    workerType: "mara",
    title: "Creator positioning",
    category: "creator_positioning",
    summary: "How to choose a niche, describe strengths, position beginners, and avoid generic creator messaging.",
    content: "Good creator positioning names the niche, style, strengths, and the kind of brand problem the creator helps solve. Beginners should position around clarity, taste, speed, relatability, or a strong product demo angle rather than pretending to have huge campaign experience. Avoid generic lines like 'passionate creator open to all collaborations.'",
    structuredContent: {
      avoid: ["passionate creator open to all collaborations", "I can do anything for any brand", "generic lifestyle creator with no angle"],
      beginnerPositioning: ["Frame spec work honestly as sample campaign work", "Lead with niche fit and usable content style", "Use practical strengths like clarity, relatability, or demo ability"],
      positioningIngredients: ["Niche", "Audience or content style", "Proof point", "Brand-facing angle", "Creator strengths"]
    },
    tags: ["positioning", "niche", "beginner", "proof"],
    isActive: true
  },
  {
    id: "mara-brand-research",
    workerType: "mara",
    title: "Brand fit criteria",
    category: "brand_research",
    summary: "Signals for finding likely UGC buyers, beginner-friendly brands, bad-fit signals, and priority rules.",
    content: "Good UGC-fit brands usually have active ecommerce, visual products, an ad-friendly offer, and some evidence they use creator or social-style content already. Beginner-friendly brands are often DTC, move quickly, and do not require heavy production polish. Bad-fit signals include unclear offers, no visual product use case, hyper-corporate procurement for tiny creator budgets, or lots of free-work language.",
    structuredContent: {
      beginnerFriendlySignals: ["DTC store", "Active social posting", "Visual product", "Clear product page", "Evidence of UGC or paid social usage"],
      priorityScoring: ["+ niche overlap", "+ product demo potential", "+ active ad presence", "- vague scope", "- obvious free-work angle"],
      badFitSignals: ["Exposure-only tone", "No clear product angle", "Heavy process for low-budget asks", "Unclear deliverables"]
    },
    tags: ["brand research", "fit", "dtc", "priority"],
    isActive: true
  },
  {
    id: "mara-outreach",
    workerType: "mara",
    title: "Outreach best practices",
    category: "outreach",
    summary: "Short personalized outreach, clear value, specific angle, and beginner-friendly CTA choices.",
    content: "Good outreach is short, specific, and easy to reply to. It should name why the brand fits, suggest a concrete content angle, and avoid overexplaining. DM outreach is usually looser and faster. Email outreach can be slightly more structured and should use a clean subject line.",
    structuredContent: {
      ctas: ["Happy to send a few concepts if useful", "Want me to mock up a couple of angles?", "Open to a quick fit check?"],
      emailVsDm: ["DM can be warmer and shorter", "Email can include a tighter value proposition and subject line"],
      principles: ["Personalize the first line", "Keep the value proposition clear", "Name a specific angle", "End with a low-friction CTA"]
    },
    tags: ["outreach", "email", "dm", "personalization"],
    isActive: true
  },
  {
    id: "mara-pitch-templates",
    workerType: "mara",
    title: "Pitch templates",
    category: "pitch_templates",
    summary: "Reusable template ingredients, tone variants, placeholders, and subject line examples.",
    content: "Good pitch templates should be modular. Mara should always keep placeholders for brand name, product, fit reason, and concept angle. Beginners should not oversell themselves. Better to offer a tight concept and a simple next step.",
    structuredContent: {
      placeholders: ["[Brand]", "[Product]", "[Why you fit them]", "[Concept angle]"],
      subjectLines: ["UGC idea for [Brand]", "Quick creator fit for [Brand]", "[Category] concept for [Brand]"],
      templateTypes: ["Short email", "Short DM", "Warm casual", "Professional", "Follow-up-friendly"]
    },
    tags: ["pitch", "templates", "subject lines"],
    isActive: true
  },
  {
    id: "mara-follow-ups",
    workerType: "mara",
    title: "Follow-up strategy",
    category: "follow_ups",
    summary: "When to follow up, how many times, and how to avoid sounding desperate.",
    content: "A simple beginner-safe follow-up rhythm is 3 days, 7 days, and 14 days, then close the loop. Follow-ups should stay calm and useful. Mara should stop after a polite final message unless the brand reopens the conversation.",
    structuredContent: {
      cadence: ["Day 3", "Day 7", "Day 14 closeout"],
      principles: ["Short", "No guilt framing", "Light value reminder", "Stop after final closeout"],
      trackingNeeds: ["Last touch date", "Next follow-up date", "Reply status"]
    },
    tags: ["follow up", "cadence", "tracking"],
    isActive: true
  },
  {
    id: "mara-pricing",
    workerType: "mara",
    title: "UGC pricing basics",
    category: "pricing",
    summary: "Starter pricing guidance, bundles, add-ons, usage rights, and caution against hard unsupported pricing claims.",
    content: "Pricing guidance should be directional, not guaranteed market data. Mara should talk in framework terms: complexity, deliverables, usage rights, raw footage, rush delivery, bundles, and revisions all affect pricing. Beginners can use simple per-video or bundle logic, but Mara should avoid pretending to know what any specific brand will pay without evidence.",
    structuredContent: {
      commonFactors: ["Video count", "Edits", "Usage rights", "Raw footage", "Rush timing", "Exclusivity"],
      guidanceRules: ["Give pricing structure, not fake market certainty", "Encourage clarifying scope and rights first", "Separate organic usage from paid ad usage"]
    },
    tags: ["pricing", "bundles", "usage rights"],
    isActive: true
  },
  {
    id: "mara-usage-rights",
    workerType: "mara",
    title: "Usage rights basics",
    category: "usage_rights",
    summary: "Organic vs paid usage, duration, territory, exclusivity, raw footage, and contract caution.",
    content: "Usage rights should be clarified before agreement. Organic usage is different from paid ad usage. Territory, duration, exclusivity, raw footage rights, and whitelisting or Spark-style permissions all change the scope. Mara should explicitly say this is not legal advice and recommend careful contract review.",
    structuredContent: {
      clarifyFirst: ["Organic vs paid ad usage", "Usage duration", "Territory", "Exclusivity", "Raw footage rights"],
      caution: ["Not legal advice", "Review contract wording carefully", "Do not assume paid usage is included automatically"]
    },
    tags: ["usage rights", "paid ads", "raw footage", "exclusivity"],
    isActive: true
  },
  {
    id: "mara-content-strategy",
    workerType: "mara",
    title: "Content strategy",
    category: "content_strategy",
    summary: "Hooks, problem-solution framing, demos, routines, storytelling, and CTA options for UGC.",
    content: "Effective UGC usually starts with a clear hook, shows a relatable problem, demonstrates the product naturally, and ends with a clean payoff or CTA. Mara should use content pillars like demo, testimonial, routine, comparison, unboxing, and storytelling based on the creator's niche.",
    structuredContent: {
      formats: ["Demo", "Testimonial", "Routine", "Comparison", "Unboxing", "Day-in-the-life", "Storytelling"],
      hookIdeas: ["Problem-first", "What surprised me", "Why this works", "Before you buy"],
      ctas: ["Would you try it?", "Here’s how I’d use it", "Want me to turn this into a script next?"]
    },
    tags: ["content strategy", "hooks", "storytelling"],
    isActive: true
  },
  {
    id: "mara-content-formats",
    workerType: "mara",
    title: "Content formats",
    category: "content_formats",
    summary: "Common UGC formats and when they tend to work.",
    content: "Different products need different formats. Routines work well for repeated-use products. Comparison and testimonial styles work when trust is the main barrier. Demo-heavy content works when the product payoff is visual.",
    structuredContent: {
      formatGuide: ["Routine = repeated-use products", "Demo = visual transformation or process", "Testimonial = trust and relatability", "Comparison = decision support"]
    },
    tags: ["formats", "routine", "demo", "testimonial"],
    isActive: true
  },
  {
    id: "mara-portfolio",
    workerType: "mara",
    title: "Portfolio recommendations",
    category: "portfolio",
    summary: "What a beginner portfolio should include and how to present sample work honestly.",
    content: "A beginner portfolio should be simple: clear niche or categories, 3 to 5 sample assets, contact info, and enough structure to show the creator can think like a brand partner. Spec work should be labeled honestly as sample or concept work.",
    structuredContent: {
      include: ["Niche sections", "Sample assets", "Contact info", "Simple about section"],
      avoid: ["Overstuffed media kit before basics exist", "Dishonest claims about client work", "Generic lifestyle pages with no category fit"],
      sampleProjects: ["Routine demo", "Problem-solution piece", "Close-up product explainer"]
    },
    tags: ["portfolio", "beginner", "samples"],
    isActive: true
  },
  {
    id: "mara-campaign-workflow",
    workerType: "mara",
    title: "Campaign workflow",
    category: "campaign_workflow",
    summary: "The normal flow from lead found through payment and future follow-up.",
    content: "A clean UGC workflow usually moves from lead found, pitch sent, reply received, brief clarified, terms clarified, content created, draft sent, revision handled, approval confirmed, payment tracked, and future follow-up or testimonial request logged.",
    structuredContent: {
      stages: ["Lead found", "Pitch sent", "Reply received", "Brief received", "Terms clarified", "Content created", "Draft sent", "Revision", "Approved", "Payment", "Future follow-up"]
    },
    tags: ["workflow", "pipeline", "campaign"],
    isActive: true
  },
  {
    id: "mara-negotiation",
    workerType: "mara",
    title: "Negotiation basics",
    category: "negotiation",
    summary: "Simple, calm negotiation posture for beginners without fake confidence or fake rate certainty.",
    content: "Negotiation should stay calm and scope-based. Mara should emphasize deliverables, usage, revisions, timing, and raw footage rather than bluffing. A good beginner stance is to clarify the package before discussing price confidence.",
    structuredContent: {
      anchors: ["Clarify scope", "Separate usage rights", "Name add-ons clearly", "Avoid bluffing on market data"]
    },
    tags: ["negotiation", "scope", "rates"],
    isActive: true
  },
  {
    id: "mara-red-flags",
    workerType: "mara",
    title: "Brand red flags",
    category: "red_flags",
    summary: "Common issues to clarify without accusing the brand: scope, payment, rights, revisions, urgency, and free-work signals.",
    content: "Mara should frame concerns as clarifications, not accusations. Common red flags include vague deliverables, free or product-only compensation, affiliate-only offers when the creator wants paid UGC, unclear usage rights, raw footage requested without terms, unlimited revisions, unclear payment timing, no contract, or aggressive urgency.",
    structuredContent: {
      clarifications: ["Deliverables", "Compensation", "Usage rights", "Revisions", "Timeline", "Contract"],
      redFlags: ["Free or product-only", "Affiliate-only", "Raw footage without terms", "Unlimited revisions", "Urgent pressure", "No payment timing"]
    },
    tags: ["red flags", "contracts", "usage", "payment"],
    isActive: true
  },
  {
    id: "mara-admin-tracking",
    workerType: "mara",
    title: "Admin tracking",
    category: "admin_tracking",
    summary: "What Mara should track in a basic creator pipeline and why.",
    content: "A basic creator tracker should include brand name, contact, category, stage, last touch, next follow-up, payment status, usage notes, deliverables, and priority. Mara should keep the structure simple enough to maintain consistently.",
    structuredContent: {
      fields: ["Brand", "Contact", "Category", "Stage", "Last touch", "Next follow-up", "Deliverables", "Payment status", "Usage notes", "Priority"],
      stages: ["Targeted", "Pitched", "Awaiting reply", "In conversation", "Content in progress", "Closed"],
      scoring: ["Niche fit", "Product fit", "Urgency", "Reply probability"]
    },
    tags: ["tracking", "admin", "pipeline"],
    isActive: true
  },
  {
    id: "mara-beginner-roadmap",
    workerType: "mara",
    title: "Beginner UGC roadmap",
    category: "beginner_roadmap",
    summary: "A practical first roadmap for beginner creators: niche, samples, portfolio, first brands, and weekly rhythm.",
    content: "A good beginner roadmap is simple: choose a niche, make 3 to 5 sample assets, build a lightweight portfolio, identify a first list of brands, send pitches, track follow-ups, and improve the system week by week.",
    structuredContent: {
      steps: ["Choose niche", "Create 3 to 5 sample videos", "Build simple portfolio", "Identify first 25 brands", "Send first pitches", "Track follow-ups", "Improve based on replies", "Create weekly rhythm"]
    },
    tags: ["beginner", "roadmap", "portfolio", "first brands"],
    isActive: true
  },
  {
    id: "mara-tiktok-growth",
    workerType: "mara",
    title: "TikTok growth playbook",
    category: "tiktok_growth",
    summary: "How creators actually grow and get seen on TikTok: hooks, retention, hashtags, stories, posting rhythm, and TikTok SEO.",
    content: "TikTok rewards watch time and completion above all. The first 1.5 seconds decide everything: open on motion, a bold claim, a question, or the payoff shown first — never a logo or slow intro. Retention tactics: cut every pause, change the frame every 2-3 seconds, use on-screen text that creates an open loop, and put the payoff at the end to drive completion. Hashtags work as a stack: 1-2 broad trending tags for reach, 2-3 niche tags for classification, 1 micro tag for community. TikTok is a search engine now: say and write the exact phrase a target viewer would search (TikTok SEO) in the first line of the caption and out loud in the first seconds. TikTok Stories keep the account warm between posts and get shown to non-followers. Consistency beats bursts: 3-5 posts a week sustained outperforms 15 in one week then silence. Post when the audience is active, typically mornings and 7-10pm local. Reply to early comments within the first hour — early engagement velocity is a ranking input. Content gaps are the fastest growth lever: find a searched-for topic with weak supply and fill it repeatedly until you own it.",
    structuredContent: {
      hookPatterns: ["Show the payoff first, then explain", "Bold claim the viewer wants to argue with", "Direct question naming the target viewer", "Motion or transformation in frame one", "Negative hook: 'stop doing X'"],
      retentionTactics: ["Cut all dead air", "Visual change every 2-3 seconds", "Open-loop text overlay", "Payoff at the end for completion", "Loop the ending back to the start"],
      hashtagStacking: ["1-2 broad trending tags for reach", "2-3 niche tags for classification", "1 micro/community tag", "Rotate stacks per video — never one static set"],
      tiktokSeo: ["Say the search phrase out loud early", "Write it in the caption's first line", "Use it in on-screen text", "One video = one search intent"],
      postingRhythm: ["3-5 posts weekly, sustained", "Stories between posts to stay warm", "Post at audience-active hours", "Reply to comments within the first hour"],
      contentGapStrategy: ["Find searched topics with weak supply", "Fill one gap repeatedly until you own it", "Check what top results miss, make that"]
    },
    tags: ["tiktok", "hooks", "retention", "hashtags", "seo", "stories", "posting", "trends", "growth"],
    isActive: true
  },
  {
    id: "mara-deal-closing",
    workerType: "mara",
    title: "Closing UGC deals",
    category: "deal_closing",
    summary: "Moving a brand from interested to paid: discovery questions, anchoring rates, usage rights, urgency without desperation, and follow-up cadence that closes.",
    content: "Deals die from slowness and vagueness, not from price. Reply to interested brands within hours, not days. Always ask discovery questions before quoting: how many videos, what platforms, organic or paid usage, what timeline — quoting before scoping leaves money on the table. Anchor with a package rate, not an hourly rate, and never give a naked number: attach it to a deliverable and a timeline. Usage rights are the profit lever: organic-only is the base rate; paid ad usage adds 30-100% or a monthly licensing fee; whitelisting and perpetuity always cost more. Create honest urgency with production slots: 'I have two slots left this month.' Follow-up closes deals: most yeses come on the second to fourth touch — follow up at day 3, day 7, and close the loop at day 14 with the door left open. When a brand goes quiet after a quote, the price was probably fine — re-engage with added value (a concept idea), not a discount.",
    structuredContent: {
      discoveryQuestions: ["How many videos and what formats?", "Organic only, or paid ads too?", "Which platforms and for how long?", "What does your timeline look like?", "Who signs off on creative?"],
      pricingRules: ["Package rates, never hourly", "Number always attached to deliverable + timeline", "Usage rights priced separately", "Paid usage adds 30-100%", "Whitelisting and perpetuity cost more"],
      closingMoves: ["Reply within hours", "Production-slot urgency, honestly", "Second to fourth touch closes most deals", "Re-engage with value, not discounts"],
      followUpCadence: ["Day 3: light bump", "Day 7: add a concept idea", "Day 14: close the loop, door open"]
    },
    tags: ["negotiation", "closing", "rates", "usage rights", "follow ups", "deals"],
    isActive: true
  }
];

const TASK_TYPE_KNOWLEDGE_CATEGORIES = {
  brand_fit_criteria: ["ugc_basics", "brand_research", "creator_positioning"],
  brand_tracker_structure: ["campaign_workflow", "admin_tracking"],
  content_idea_batch: ["ugc_basics", "content_strategy", "content_formats", "creator_positioning"],
  creator_positioning: ["ugc_basics", "creator_positioning", "beginner_roadmap"],
  draft_brand_reply: ["outreach", "negotiation", "usage_rights", "red_flags", "deal_closing"],
  follow_up_sequence: ["follow_ups", "outreach", "admin_tracking"],
  outreach_strategy: ["outreach", "brand_research", "follow_ups", "creator_positioning"],
  pasted_message_analysis: ["red_flags", "usage_rights", "negotiation", "deal_closing"],
  personalized_pitch: ["outreach", "pitch_templates", "creator_positioning", "brand_research"],
  pitch_template: ["outreach", "pitch_templates", "creator_positioning", "brand_research"],
  portfolio_recommendations: ["portfolio", "beginner_roadmap", "creator_positioning"],
  ugc_shot_list: ["content_strategy", "content_formats", "tiktok_growth"],
  weekly_action_plan: ["beginner_roadmap", "admin_tracking", "campaign_workflow"],
  weekly_schedule: ["tiktok_growth", "beginner_roadmap", "campaign_workflow"],
  brand_content_ideas: ["content_strategy", "content_formats", "tiktok_growth"],
  tiktok_trend_pulse: ["tiktok_growth", "content_strategy"],
  reddit_market_pulse: ["tiktok_growth", "brand_research", "deal_closing"]
};

export function normalizeForComparison(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function ensureColumn(db, tableName, columnName, columnDefinition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

function seedMaraKnowledgeModules(db) {
  const timestamp = new Date().toISOString();
  for (const module of MARA_KNOWLEDGE_MODULES) {
    db.prepare(
      `INSERT INTO worker_knowledge_modules
        (id, worker_type, worker_id, title, category, summary, content, structured_content_json, tags_json, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         worker_type = excluded.worker_type,
         worker_id = excluded.worker_id,
         title = excluded.title,
         category = excluded.category,
         summary = excluded.summary,
         content = excluded.content,
         structured_content_json = excluded.structured_content_json,
         tags_json = excluded.tags_json,
         is_active = excluded.is_active,
         updated_at = excluded.updated_at`
    ).run(
      module.id,
      module.workerType ?? null,
      null,
      module.title,
      module.category,
      module.summary,
      module.content,
      module.structuredContent ? JSON.stringify(module.structuredContent) : null,
      module.tags ? JSON.stringify(module.tags) : null,
      module.isActive ? 1 : 0,
      timestamp,
      timestamp
    );
  }
}

export function listWorkerKnowledgeModules(db, { userId = null, workerId = null, workerType = "mara" } = {}) {
  return db
    .prepare(
      `SELECT id, worker_type AS workerType, worker_id AS workerId, title, category, summary, content,
              structured_content_json AS structuredContentJson, tags_json AS tagsJson, is_active AS isActive,
              created_at AS createdAt, updated_at AS updatedAt
       FROM worker_knowledge_modules
       WHERE is_active = 1
         AND (worker_id IS NULL OR worker_id = ?)
         AND (worker_type IS NULL OR worker_type = ?)
       ORDER BY category, title`
    )
    .all(workerId, workerType)
    .map((row) => ({
      ...row,
      isActive: Boolean(row.isActive),
      structuredContent: safeJsonParse(row.structuredContentJson, null),
      tags: safeJsonParse(row.tagsJson, [])
    }));
}

function inferTaskTypeFromMessage(text) {
  const lower = String(text ?? "").toLowerCase();
  if (/pitch template|write me a pitch|pitch for/.test(lower)) return "pitch_template";
  if (/content ideas?|idea batch/.test(lower)) return "content_idea_batch";
  if (/follow up|follow-up/.test(lower)) return "follow_up_sequence";
  if (/tracker/.test(lower)) return "brand_tracker_structure";
  if (/portfolio/.test(lower)) return "portfolio_recommendations";
  if (/positioning|niche/.test(lower)) return "creator_positioning";
  if (/reply to this brand|draft a reply/.test(lower)) return "draft_brand_reply";
  if (/analyze this brand message|analyze this message/.test(lower)) return "pasted_message_analysis";
  if (/outreach strategy/.test(lower)) return "outreach_strategy";
  return "general_internal_task";
}

export function getMaraRelevantKnowledge({
  db,
  taskType = null,
  tags = [],
  limit = 5,
  userId = null,
  userMessage = "",
  workerId = MARA_WORKER_ID
}) {
  const inferredTaskType = taskType || inferTaskTypeFromMessage(userMessage);
  const modules = listWorkerKnowledgeModules(db, { userId, workerId, workerType: "mara" });
  const neededCategories = new Set(["ugc_basics", ...(TASK_TYPE_KNOWLEDGE_CATEGORIES[inferredTaskType] || [])]);
  const neededTags = Array.isArray(tags) ? tags.map((tag) => String(tag).toLowerCase()) : [];
  const lowerMessage = String(userMessage ?? "").toLowerCase();

  return modules
    .map((module) => {
      let score = neededCategories.has(module.category) ? 5 : 0;
      for (const tag of module.tags) {
        const normalizedTag = String(tag).toLowerCase();
        if (neededTags.includes(normalizedTag)) score += 2;
        if (lowerMessage.includes(normalizedTag)) score += 1;
      }
      if (lowerMessage.includes(module.category.replace(/_/g, " "))) score += 2;
      return { ...module, score };
    })
    .filter((module) => module.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function formatKnowledgeModuleBrief(modules) {
  return modules
    .map((module) => `${module.title}: ${module.summary}`)
    .join("\n");
}

export function inferMaraTaskType(title, source = "") {
  const normalized = normalizeForComparison(`${title} ${source}`);

  if (normalized.includes("creator positioning")) return "creator_positioning";
  if (normalized.includes("brand fit criteria")) return "brand_fit_criteria";
  if (normalized.includes("pitch template")) return "pitch_template";
  if (normalized.includes("personalized pitch")) return "personalized_pitch";
  if (normalized.includes("follow up sequence") || normalized.includes("follow-up sequence")) return "follow_up_sequence";
  if (normalized.includes("content idea")) return "content_idea_batch";
  if (normalized.includes("shot list")) return "ugc_shot_list";
  if (normalized.includes("weekly action plan")) return "weekly_action_plan";
  if (normalized.includes("brand tracker structure") || normalized.includes("tracker structure")) return "brand_tracker_structure";
  if (normalized.includes("update brand tracker") || normalized.includes("refresh brand tracker")) return "update_brand_tracker";
  if (normalized.includes("brand content ideas") || normalized.includes("content ideas for")) return "brand_content_ideas";
  if (normalized.includes("ops brief") || normalized.includes("status brief")) return "ops_brief";
  if (normalized.includes("reddit pulse") || normalized.includes("market pulse")) return "reddit_market_pulse";
  if (normalized.includes("message analysis")) return "pasted_message_analysis";
  if (normalized.includes("draft brand reply") || normalized.includes("brand reply")) return "draft_brand_reply";
  if (normalized.includes("portfolio recommendation")) return "portfolio_recommendations";
  if (normalized.includes("outreach strategy")) return "outreach_strategy";
  if (normalized.includes("research queue summary")) return "research_queue_summary";
  return "general_internal_task";
}

export function initWorkerTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS worker_permissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      can_suggest_tasks INTEGER NOT NULL DEFAULT 0,
      can_create_tasks INTEGER NOT NULL DEFAULT 0,
      can_run_research INTEGER NOT NULL DEFAULT 0,
      can_create_recurring_responsibilities INTEGER NOT NULL DEFAULT 0,
      can_draft_outreach INTEGER NOT NULL DEFAULT 0,
      can_read_inbox INTEGER NOT NULL DEFAULT 0,
      can_send_emails_with_approval INTEGER NOT NULL DEFAULT 0,
      can_send_emails_without_approval INTEGER NOT NULL DEFAULT 0,
      can_update_external_trackers INTEGER NOT NULL DEFAULT 0,
      can_use_connected_integrations INTEGER NOT NULL DEFAULT 0,
      approval_required_for_external_actions INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, worker_id)
    );

    CREATE TABLE IF NOT EXISTS worker_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      due_at TEXT,
      required_permissions_json TEXT NOT NULL,
      evidence_used_json TEXT NOT NULL,
      output TEXT,
      normalized_title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS worker_activity_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      related_task_id TEXT,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS worker_recurring_responsibilities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      cadence TEXT NOT NULL,
      day_of_week TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      permission_required TEXT,
      last_run_at TEXT,
      next_run_at TEXT,
      created_from TEXT NOT NULL,
      normalized_title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS worker_research_items (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      worker_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      topic TEXT NOT NULL,
      query TEXT NOT NULL,
      source_type TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT,
      insights_json TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      normalized_topic TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS worker_approval_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      normalized_title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS worker_outputs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      task_id TEXT,
      output_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      structured_content_json TEXT,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS worker_knowledge_modules (
      id TEXT PRIMARY KEY,
      worker_type TEXT,
      worker_id TEXT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      structured_content_json TEXT,
      tags_json TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS worker_brands (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      website TEXT,
      identity_summary TEXT NOT NULL DEFAULT '',
      vibe_notes TEXT NOT NULL DEFAULT '',
      suggested_angle TEXT NOT NULL DEFAULT '',
      contact_email TEXT,
      contact_name TEXT,
      research_item_id TEXT,
      last_content_ideas_at TEXT,
      last_pitch_at TEXT,
      normalized_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, worker_id, normalized_name)
    );

    CREATE TABLE IF NOT EXISTS worker_trend_snapshots (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      niche TEXT NOT NULL,
      region TEXT NOT NULL DEFAULT 'US',
      period_days INTEGER NOT NULL DEFAULT 7,
      source TEXT NOT NULL,
      source_url TEXT NOT NULL DEFAULT '',
      payload_json TEXT NOT NULL,
      content_gaps_json TEXT NOT NULL,
      hashtags_json TEXT NOT NULL,
      insights_json TEXT NOT NULL,
      login_wall_encountered INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  ensureColumn(db, "worker_tasks", "task_type", "TEXT");
  ensureColumn(db, "worker_tasks", "target_brand_id", "TEXT");
  seedMaraKnowledgeModules(db);
}

export function defaultPermissionsForWorker(workerId) {
  if (workerId === MARA_WORKER_ID) {
    return { ...DEFAULT_MARA_PERMISSIONS };
  }

  return {
    approvalRequiredForExternalActions: true,
    canCreateRecurringResponsibilities: false,
    canCreateTasks: true,
    canDraftOutreach: false,
    canReadInbox: false,
    canRunResearch: false,
    canSendEmailsWithApproval: false,
    canSendEmailsWithoutApproval: false,
    canSuggestTasks: true,
    canUpdateExternalTrackers: false,
    canUseConnectedIntegrations: false
  };
}

function boolToInt(value) {
  return value ? 1 : 0;
}

function intToBool(value) {
  return Boolean(value);
}

function safeJsonParse(value, fallback) {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function ensureWorkerPermissions(db, userId, workerId, overrides = {}) {
  const current = db
    .prepare(
      `SELECT *
       FROM worker_permissions
       WHERE user_id = ? AND worker_id = ?`
    )
    .get(userId, workerId);

  if (current) {
    return getWorkerPermissions(db, userId, workerId);
  }

  const timestamp = new Date().toISOString();
  const next = { ...defaultPermissionsForWorker(workerId), ...overrides };
  db.prepare(
    `INSERT INTO worker_permissions (
      id, user_id, worker_id,
      can_suggest_tasks, can_create_tasks, can_run_research, can_create_recurring_responsibilities,
      can_draft_outreach, can_read_inbox, can_send_emails_with_approval, can_send_emails_without_approval,
      can_update_external_trackers, can_use_connected_integrations, approval_required_for_external_actions,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    userId,
    workerId,
    boolToInt(next.canSuggestTasks),
    boolToInt(next.canCreateTasks),
    boolToInt(next.canRunResearch),
    boolToInt(next.canCreateRecurringResponsibilities),
    boolToInt(next.canDraftOutreach),
    boolToInt(next.canReadInbox),
    boolToInt(next.canSendEmailsWithApproval),
    boolToInt(next.canSendEmailsWithoutApproval),
    boolToInt(next.canUpdateExternalTrackers),
    boolToInt(next.canUseConnectedIntegrations),
    boolToInt(next.approvalRequiredForExternalActions),
    timestamp,
    timestamp
  );

  return getWorkerPermissions(db, userId, workerId);
}

export function updateWorkerPermissions(db, userId, workerId, overrides = {}) {
  const current = ensureWorkerPermissions(db, userId, workerId);
  const next = { ...current, ...overrides };
  const timestamp = new Date().toISOString();
  db.prepare(
    `UPDATE worker_permissions
     SET can_suggest_tasks = ?, can_create_tasks = ?, can_run_research = ?, can_create_recurring_responsibilities = ?,
         can_draft_outreach = ?, can_read_inbox = ?, can_send_emails_with_approval = ?, can_send_emails_without_approval = ?,
         can_update_external_trackers = ?, can_use_connected_integrations = ?, approval_required_for_external_actions = ?,
         updated_at = ?
     WHERE user_id = ? AND worker_id = ?`
  ).run(
    boolToInt(next.canSuggestTasks),
    boolToInt(next.canCreateTasks),
    boolToInt(next.canRunResearch),
    boolToInt(next.canCreateRecurringResponsibilities),
    boolToInt(next.canDraftOutreach),
    boolToInt(next.canReadInbox),
    boolToInt(next.canSendEmailsWithApproval),
    boolToInt(next.canSendEmailsWithoutApproval),
    boolToInt(next.canUpdateExternalTrackers),
    boolToInt(next.canUseConnectedIntegrations),
    boolToInt(next.approvalRequiredForExternalActions),
    timestamp,
    userId,
    workerId
  );
  return getWorkerPermissions(db, userId, workerId);
}

export function getWorkerPermissions(db, userId, workerId) {
  const record = db
    .prepare(
      `SELECT *
       FROM worker_permissions
       WHERE user_id = ? AND worker_id = ?`
    )
    .get(userId, workerId);

  if (!record) {
    return ensureWorkerPermissions(db, userId, workerId);
  }

  return {
    approvalRequiredForExternalActions: intToBool(record.approval_required_for_external_actions),
    canCreateRecurringResponsibilities: intToBool(record.can_create_recurring_responsibilities),
    canCreateTasks: intToBool(record.can_create_tasks),
    canDraftOutreach: intToBool(record.can_draft_outreach),
    canReadInbox: intToBool(record.can_read_inbox),
    canRunResearch: intToBool(record.can_run_research),
    canSendEmailsWithApproval: intToBool(record.can_send_emails_with_approval),
    canSendEmailsWithoutApproval: intToBool(record.can_send_emails_without_approval),
    canSuggestTasks: intToBool(record.can_suggest_tasks),
    canUpdateExternalTrackers: intToBool(record.can_update_external_trackers),
    canUseConnectedIntegrations: intToBool(record.can_use_connected_integrations)
  };
}

export function createWorkerActivityLog(db, {
  createdAt,
  description,
  eventType,
  metadata = {},
  relatedTaskId = null,
  title,
  userId,
  workerId
}) {
  const timestamp = createdAt || new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO worker_activity_log (id, user_id, worker_id, event_type, title, description, related_task_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, workerId, eventType, title, description, relatedTaskId, JSON.stringify(metadata), timestamp);
  return id;
}

function hasRequiredPermissions(permissions, requiredPermissions) {
  return requiredPermissions.every((permission) => permissions[permission] === true);
}

function describePermissionBlocker(permission) {
  switch (String(permission ?? "")) {
    case "canDraftOutreach":
      return {
        blockerReason: "I need outreach drafting permission before I can produce this.",
        nextStep: "Enable outreach drafting in my boundaries so I can prepare the asset."
      };
    case "canRunResearch":
      return {
        blockerReason: "I need research permission before I can run this.",
        nextStep: "Allow research in my boundaries, or point me at a different internal task."
      };
    case "canReadInbox":
      return {
        blockerReason: "I can't review inbox-based work until inbox access is connected.",
        nextStep: "Connect Gmail when you're ready for me to work from your email."
      };
    case "canUseConnectedIntegrations":
      return {
        blockerReason: "This depends on a connected tool I don't have access to yet.",
        nextStep: "Connect the required tool, or keep me on internal planning for now."
      };
    case "canSendEmailsWithApproval":
    case "canSendEmailsWithoutApproval":
      return {
        blockerReason: "I don't have email-sending permission for this yet.",
        nextStep: "Update my boundaries before asking me to send or schedule emails."
      };
    default:
      return {
        blockerReason: "I'm blocked until I have the permission or input I need.",
        nextStep: "Adjust my boundaries or point me at a safe internal task."
      };
  }
}

function rankPriority(priority) {
  return PRIORITY_RANK[String(priority ?? "").toLowerCase()] ?? 0;
}

function pickHighestPriorityTask(tasks) {
  return [...tasks].sort((left, right) => {
    const byPriority = rankPriority(right.priority) - rankPriority(left.priority);
    if (byPriority !== 0) return byPriority;
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  })[0] ?? null;
}

export function listWorkerTasksForUserWorker(db, userId, workerId) {
  return db
    .prepare(
      `SELECT id, user_id AS userId, worker_id AS workerId, title, description, source, status, priority,
              due_at AS dueAt, required_permissions_json AS requiredPermissionsJson, evidence_used_json AS evidenceUsedJson,
              output, task_type AS taskType, target_brand_id AS targetBrandId, created_at AS createdAt, updated_at AS updatedAt
       FROM worker_tasks
       WHERE user_id = ? AND worker_id = ?
       ORDER BY created_at DESC`
    )
    .all(userId, workerId)
    .map((row) => ({
      ...row,
      evidenceUsed: safeJsonParse(row.evidenceUsedJson, []),
      requiredPermissions: safeJsonParse(row.requiredPermissionsJson, []),
      taskType: row.taskType || inferMaraTaskType(row.title, row.source)
    }));
}

function findDuplicateTask(db, userId, workerId, title) {
  const normalizedTitle = normalizeForComparison(title);
  return db
    .prepare(
      `SELECT id
       FROM worker_tasks
       WHERE user_id = ? AND worker_id = ? AND normalized_title = ? AND status NOT IN ('dismissed', 'completed')`
    )
    .get(userId, workerId, normalizedTitle);
}

export function createWorkerTask(db, task) {
  const normalizedTitle = normalizeForComparison(task.title);
  const duplicate = findDuplicateTask(db, task.userId, task.workerId, task.title);
  if (duplicate) {
    return { duplicate: true, id: duplicate.id };
  }

  const timestamp = task.createdAt || new Date().toISOString();
  const id = randomUUID();
  const requiredPermissions = Array.isArray(task.requiredPermissions) ? task.requiredPermissions.map(String) : [];
  const evidenceUsed = Array.isArray(task.evidenceUsed) ? task.evidenceUsed : [];
  const taskType = String(task.taskType || inferMaraTaskType(task.title, task.source)).trim();

  db.prepare(
    `INSERT INTO worker_tasks (id, user_id, worker_id, title, description, source, status, priority, due_at,
      required_permissions_json, evidence_used_json, output, task_type, target_brand_id, normalized_title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    task.userId,
    task.workerId,
    task.title,
    task.description,
    task.source,
    task.status,
    task.priority,
    task.dueAt ?? null,
    JSON.stringify(requiredPermissions),
    JSON.stringify(evidenceUsed),
    task.output ?? null,
    taskType,
    task.targetBrandId ?? null,
    normalizedTitle,
    timestamp,
    timestamp
  );

  db.prepare(
    `INSERT INTO office_custom_tasks (id, user_id, worker_slug, title, module_name, owner, priority, status, due_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    task.userId,
    task.workerId,
    task.title,
    task.source,
    "Worker",
    PRIORITY_MAP[task.priority] ?? "Medium",
    TASK_STATUS_MAP[task.status] ?? "To Do",
    task.dueAt ?? "Soon",
    timestamp
  );

  createWorkerActivityLog(db, {
    createdAt: timestamp,
    description: task.description,
    eventType: "task_created",
    metadata: { source: task.source, status: task.status },
    relatedTaskId: id,
    title: task.title,
    userId: task.userId,
    workerId: task.workerId
  });

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), task.userId, task.workerId, "Created worker task.", "Worker Tasks", task.title, timestamp);

  return { duplicate: false, id };
}

export function updateWorkerTaskStatus(db, userId, workerId, taskId, status) {
  const timestamp = new Date().toISOString();
  db.prepare(
    `UPDATE worker_tasks
     SET status = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND worker_id = ?`
  ).run(status, timestamp, taskId, userId, workerId);

  db.prepare(
    `UPDATE office_custom_tasks
     SET status = ?
     WHERE id = ? AND user_id = ? AND worker_slug = ?`
  ).run(TASK_STATUS_MAP[status] ?? "To Do", taskId, userId, workerId);

  return { ok: true };
}

export async function approveWorkerProposedTask(db, userId, workerId, taskId, executionOptions = {}) {
  const task = listWorkerTasksForUserWorker(db, userId, workerId).find((entry) => entry.id === taskId);
  if (!task) {
    throw new Error("Worker task not found.");
  }
  if (task.status !== "proposed") {
    throw new Error("Only proposed tasks can be approved this way.");
  }

  updateWorkerTaskStatus(db, userId, workerId, taskId, "approved");
  const result = await runMaraTask({
    db,
    taskId,
    userId,
    workerId,
    ...executionOptions
  });
  createWorkerActivityLog(db, {
    description: `You approved ${task.title}, so I ran it.`,
    eventType: "task_auto_executed",
    relatedTaskId: taskId,
    title: task.title,
    userId,
    workerId
  });
  return result;
}

export function dismissWorkerTask(db, userId, workerId, taskId) {
  const task = db
    .prepare(
      `SELECT id, title
       FROM worker_tasks
       WHERE id = ? AND user_id = ? AND worker_id = ?`
    )
    .get(taskId, userId, workerId);

  if (!task) {
    throw new Error("Worker task not found.");
  }

  updateWorkerTaskStatus(db, userId, workerId, taskId, "dismissed");
  createWorkerActivityLog(db, {
    description: "Dismissed from Mara's active plate.",
    eventType: "task_dismissed",
    relatedTaskId: taskId,
    title: task.title,
    userId,
    workerId
  });

  return { ok: true };
}

export function completeWorkerTask(db, userId, workerId, taskId, output = null) {
  const timestamp = new Date().toISOString();
  db.prepare(
    `UPDATE worker_tasks
     SET status = 'completed', output = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND worker_id = ?`
  ).run(output, timestamp, taskId, userId, workerId);
  updateWorkerTaskStatus(db, userId, workerId, taskId, "completed");
  createWorkerActivityLog(db, {
    createdAt: timestamp,
    description: output || "Task completed.",
    eventType: "task_completed",
    relatedTaskId: taskId,
    title: "Completed worker task",
    userId,
    workerId
  });
  return { ok: true };
}

export function listWorkerOutputs(db, userId, workerId) {
  return db
    .prepare(
      `SELECT id, user_id AS userId, worker_id AS workerId, task_id AS taskId, output_type AS outputType,
              title, content, structured_content_json AS structuredContentJson, source, created_at AS createdAt, updated_at AS updatedAt
       FROM worker_outputs
       WHERE user_id = ? AND worker_id = ?
       ORDER BY created_at DESC`
    )
    .all(userId, workerId)
    .map((row) => ({
      ...row,
      structuredContent: safeJsonParse(row.structuredContentJson, null)
    }));
}

export function createWorkerOutput(db, output) {
  const timestamp = output.createdAt || new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO worker_outputs
      (id, user_id, worker_id, task_id, output_type, title, content, structured_content_json, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    output.userId,
    output.workerId,
    output.taskId ?? null,
    output.outputType,
    output.title,
    output.content,
    output.structuredContent ? JSON.stringify(output.structuredContent) : null,
    output.source,
    timestamp,
    timestamp
  );

  createWorkerActivityLog(db, {
    createdAt: timestamp,
    description: output.title,
    eventType: "worker_output_created",
    metadata: { outputType: output.outputType, source: output.source },
    relatedTaskId: output.taskId ?? null,
    title: output.title,
    userId: output.userId,
    workerId: output.workerId
  });

  return {
    id,
    ...output,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function buildPreviewFromContent(content) {
  return String(content ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
}

function buildOutputPreview(output) {
  const structured = output.structuredContent ?? {};

  if (output.outputType === "content_ideas" && Array.isArray(structured.ideas)) {
    return `${structured.ideas.length} ${output.title.toLowerCase()} ready with hooks, formats, and difficulty notes.`;
  }

  if (output.outputType === "weekly_plan" && structured.priority) {
    return `Weekly focus: ${structured.priority}`;
  }

  if (output.outputType === "pitch_template" && structured.emailPitch) {
    return String(structured.emailPitch).split("\n").slice(0, 2).join(" ");
  }

  return buildPreviewFromContent(output.content);
}

function getMemoryItem(knowledgeSections, title) {
  const section = (Array.isArray(knowledgeSections) ? knowledgeSections : []).find((entry) => String(entry?.title ?? "").trim() === title);
  return Array.isArray(section?.items) ? section.items : [];
}

function buildSectionContent(title, values) {
  if (Array.isArray(values)) {
    return [`${title}:`, ...values.map((value) => `- ${value}`)].join("\n");
  }
  return `${title}: ${String(values ?? "").trim()}`;
}

function buildRichContent(sections) {
  return sections
    .filter((section) => section && section.title && section.value)
    .map((section) => buildSectionContent(section.title, section.value))
    .join("\n\n");
}

/**
 * "UGC creator" is a job description, not a niche. Values like it must never
 * be presented as the creator's niche — they carry zero targeting signal.
 */
function isGenericNicheValue(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return true;
  return /^(ugc\s*)?(content\s*)?(creator|creators|content|influencer|videos?)$/.test(normalized)
    || normalized === "ugc"
    || normalized === "ugc creator brands";
}

/**
 * A niche is a short noun phrase ("fitness and wellness UGC"), never a
 * sentence from an onboarding answer ("I do not have any content yet").
 * Sentence-shaped candidates produce grotesque pitches — reject them.
 */
function isUsableNichePhrase(value) {
  const text = String(value ?? "").trim();
  if (!text || text.length > 60) return false;
  if (/^i\s/i.test(text)) return false;
  if (/\b(do not|don't|dont|cannot|can't|won't|not have|have no|nothing)\b/i.test(text)) return false;
  if (/[?!]/.test(text)) return false;
  if (text.split(/\s+/).length > 9) return false;
  return true;
}

/**
 * Resolve the creator's actual niche, best signal first:
 * their positioning document → onboarding → memory. Generic values lose.
 */
function resolveCreatorNiche({ accountContext, previousOutputs = [], workerKnowledge = [], maraAnswers = {} }) {
  const positioning = previousOutputs.find((output) => output.outputType === "creator_positioning")?.structuredContent;
  const candidates = [
    positioning?.nicheDefinition,
    positioning?.niche,
    accountContext?.whatYouDo,
    maraAnswers.current_workflow,
    ...getMemoryItem(workerKnowledge, "Preferences"),
    ...getMemoryItem(workerKnowledge, "Goals")
  ];
  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value && !isGenericNicheValue(value) && isUsableNichePhrase(value)) {
      return value;
    }
  }
  return "your creator niche";
}

function buildContextProfile(context) {
  const onboarding = context.accountContext ?? {};
  const preferences = getMemoryItem(context.workerKnowledge, "Preferences");
  const goals = getMemoryItem(context.workerKnowledge, "Goals");
  const approvalRules = getMemoryItem(context.workerKnowledge, "Approval rules");
  const painPoints = getMemoryItem(context.workerKnowledge, "Pain points").concat(getMemoryItem(context.workerKnowledge, "Pain point map"));
  const recentDirection = getMemoryItem(context.workerKnowledge, "Recent direction");
  const brandFitOutput = context.previousOutputs.find((output) => output.outputType === "brand_criteria");
  const positioningOutput = context.previousOutputs.find((output) => output.outputType === "creator_positioning");

  const rawProfileBrandName = String(onboarding.brandName ?? "").trim();
  const profileBrandName =
    rawProfileBrandName && !/^(ugc\s*)?(creator|content creator)$/i.test(rawProfileBrandName)
      ? rawProfileBrandName
      : String(onboarding.name ?? "").trim() || "Your brand";

  return {
    approvalRules,
    audience: String(onboarding.whatYouDo || recentDirection[0] || "UGC-focused creators and founder-led brands").trim(),
    brandFitOutput,
    brandName: profileBrandName,
    goals,
    niche: resolveCreatorNiche({
      accountContext: onboarding,
      maraAnswers: context.workerOnboarding?.answers ?? {},
      previousOutputs: context.previousOutputs,
      workerKnowledge: context.workerKnowledge
    }),
    painPoints,
    positioningOutput,
    preferences,
    recentDirection
  };
}

function getStructuredList(module, key, fallback = []) {
  const value = module?.structuredContent?.[key];
  return Array.isArray(value) ? value : fallback;
}

export function buildMaraExecutionContext({
  db,
  fetchImpl,
  readAccountContext,
  readConnectedIntegrations,
  readMessages,
  readMaraOnboarding,
  readPrivateInsights,
  readWorkerKnowledge,
  taskId,
  userId,
  workerId
}) {
  const task = listWorkerTasksForUserWorker(db, userId, workerId).find((entry) => entry.id === taskId);
  if (!task) {
    throw new Error("Worker task not found.");
  }

  const recentMessages = typeof readMessages === "function" ? readMessages(userId, workerId) : [];
  const relevantKnowledgeModules = getMaraRelevantKnowledge({
    db,
    taskType: task.taskType,
    userId,
    userMessage: recentMessages.map((message) => message.text).join("\n"),
    workerId
  });

  const allResearch = listResearchItems(db, userId, workerId);
  const evidenceIds = new Set(
    (task.evidenceUsed || []).map((evidence) => String(evidence).trim().replace(/^research:/, ""))
  );
  let relatedResearch = allResearch.filter((item) => evidenceIds.has(item.id));
  const targetBrand = task.targetBrandId ? getWorkerBrand(db, userId, workerId, task.targetBrandId) : null;
  if (relatedResearch.length === 0 && targetBrand?.researchItemId) {
    const linkedResearch = allResearch.find((item) => item.id === targetBrand.researchItemId);
    if (linkedResearch) {
      relatedResearch = [linkedResearch];
    }
  }

  return {
    accountContext: typeof readAccountContext === "function" ? readAccountContext(userId) : null,
    connectedIntegrations: typeof readConnectedIntegrations === "function" ? readConnectedIntegrations(userId, workerId) : [],
    currentTask: task,
    db,
    fetchImpl: typeof fetchImpl === "function" ? fetchImpl : globalThis.fetch,
    permissions: getWorkerPermissions(db, userId, workerId),
    previousOutputs: listWorkerOutputs(db, userId, workerId),
    privateInsights: typeof readPrivateInsights === "function" ? readPrivateInsights(userId, workerId) : null,
    relevantKnowledgeModules,
    relatedResearch,
    targetBrand,
    recentActivity: db
      .prepare(
        `SELECT id, event_type AS eventType, title, description, created_at AS createdAt
         FROM worker_activity_log
         WHERE user_id = ? AND worker_id = ?
         ORDER BY created_at DESC
         LIMIT 8`
      )
      .all(userId, workerId),
    recentMessages,
    recurringResponsibilities: listRecurringResponsibilities(db, userId, workerId),
    relatedOpenTasks: listWorkerTasksForUserWorker(db, userId, workerId).filter((entry) => entry.id !== taskId && ["approved", "in_progress", "blocked"].includes(entry.status)),
    userId,
    workerId,
    workerKnowledge: typeof readWorkerKnowledge === "function" ? readWorkerKnowledge(userId, workerId) : [],
    workerOnboarding: typeof readMaraOnboarding === "function" ? readMaraOnboarding(userId, workerId) : null
  };
}

function getKnowledgeModule(context, category) {
  return (context.relevantKnowledgeModules || []).find((module) => module.category === category) ?? null;
}

function extractPrivateInsightItems(privateInsights) {
  if (!privateInsights) return [];
  if (Array.isArray(privateInsights)) {
    return privateInsights.map((item) => String(item?.contentGap || item?.summary || item?.title || item).trim()).filter(Boolean);
  }
  if (Array.isArray(privateInsights.contentGaps)) {
    return privateInsights.contentGaps.map((item) => String(item?.label || item?.gap || item?.title || item).trim()).filter(Boolean);
  }
  if (Array.isArray(privateInsights.insights)) {
    return privateInsights.insights.map((item) => String(item?.contentGap || item?.summary || item?.title || item).trim()).filter(Boolean);
  }
  return [];
}

function extractPersonalizedBrandTarget(context) {
  const relatedResearch = context.relatedResearch?.[0] ?? null;
  if (relatedResearch?.topic) {
    return {
      brandName: String(relatedResearch.topic).trim(),
      summary: String(relatedResearch.summary || "").trim()
    };
  }
  const match = String(context.currentTask?.title ?? "").match(/for\s+(.+)$/i);
  return {
    brandName: match?.[1]?.trim() || "[Brand]",
    summary: ""
  };
}

function executeCreatorPositioningTask(context) {
  const profile = buildContextProfile(context);
  const positioningModule = getKnowledgeModule(context, "creator_positioning");
  const positioningIngredients = getStructuredList(positioningModule, "positioningIngredients", ["Niche", "Proof point", "Brand-facing angle"]);
  const beginnerPositioning = getStructuredList(positioningModule, "beginnerPositioning", ["Lead with niche fit and usable content style"]);
  const structuredContent = {
    audienceSummary: `Creators and brand teams looking for ${profile.niche} content that feels credible and conversion-aware.`,
    brandFacingAngle: `Position ${profile.brandName} as a creator who can make ${profile.niche} feel useful, trustworthy, and easy to brief.`,
    contentStrengths: [
      "Clear founder-friendly communication",
      "UGC that feels native instead of over-produced",
      "Practical hooks tied to product outcomes"
    ],
    creatorPositioningStatement: `${profile.brandName} creates practical, trustworthy ${profile.niche} content that helps brands look credible without losing the native feel that makes UGC perform.`,
    nicheSummary: profile.niche,
    pitchableFactors: [
      "Clear niche alignment",
      "Low-friction content style",
      "Beginner-friendly but commercially useful positioning"
    ],
    suggestedNextSteps: [
      "Use this positioning to tighten your first pitch template",
      "Build brand fit criteria from the same niche assumptions",
      "Create a first content idea batch around the same buyer problems"
    ],
    positioningIngredients,
    beginnerPositioning
  };

  return {
    content: buildRichContent([
      { title: "Creator positioning statement", value: structuredContent.creatorPositioningStatement },
      { title: "Niche summary", value: structuredContent.nicheSummary },
      { title: "Audience summary", value: structuredContent.audienceSummary },
      { title: "Content strengths", value: structuredContent.contentStrengths },
      { title: "Brand-facing angle", value: structuredContent.brandFacingAngle },
      { title: "What makes this creator pitchable", value: structuredContent.pitchableFactors },
      { title: "Positioning ingredients Mara is using", value: structuredContent.positioningIngredients },
      { title: "Beginner positioning rules", value: structuredContent.beginnerPositioning },
      { title: "Suggested next steps", value: structuredContent.suggestedNextSteps }
    ]),
    outputType: "creator_positioning",
    structuredContent,
    title: "Creator positioning"
  };
}

function executeBrandFitCriteriaTask(context) {
  const profile = buildContextProfile(context);
  const brandResearchModule = getKnowledgeModule(context, "brand_research");
  const structuredContent = {
    alignmentCriteria: [`Clear fit with ${profile.niche}`, ...getStructuredList(brandResearchModule, "beginnerFriendlySignals", []).slice(0, 2)],
    bestFitIndustries: ["Skincare", "Wellness", "Beauty-adjacent lifestyle"],
    brandSizeType: ["Indie brands", "Growth-stage DTC brands", "Small teams that value flexible creators"],
    productCategories: ["Serums", "Routine-based products", "Supplements", "Daily-use wellness products"],
    redFlags: getStructuredList(brandResearchModule, "badFitSignals", ["Unclear deliverables", "Spec work requests"]),
    outreachPriorityRules: getStructuredList(brandResearchModule, "priorityScoring", ["Prioritize brands with visible UGC usage already"])
  };

  return {
    content: buildRichContent([
      { title: "Best-fit industries", value: structuredContent.bestFitIndustries },
      { title: "Brand size and type", value: structuredContent.brandSizeType },
      { title: "Product categories", value: structuredContent.productCategories },
      { title: "Alignment criteria", value: structuredContent.alignmentCriteria },
      { title: "Red flags", value: structuredContent.redFlags },
      { title: "Outreach priority rules", value: structuredContent.outreachPriorityRules }
    ]),
    outputType: "brand_criteria",
    structuredContent,
    title: "Brand fit criteria"
  };
}

async function executePitchTemplateTask(context) {
  if (context.currentTask.taskType === "personalized_pitch") {
    // Never pitch an article headline. If the stored target is a listicle
    // that slipped in before scrape filtering, refuse honestly.
    const target = extractPersonalizedBrandTarget(context);
    if (target?.brandName && isLikelyListicleTitle(target.brandName)) {
      return {
        blocked: true,
        blockerReason: `"${target.brandName}" is an article title, not a brand — a pitch addressed to it would be embarrassing to send.`,
        neededFromUser: "Nothing — I've flagged this lead as junk. My next research cycle will bring real brands.",
        suggestedNextStep: "Run brand research again or point me at a specific brand you want pitched."
      };
    }
    const llmResult = await tryGenerateMaraPersonalizedPitch(context);
    if (llmResult) {
      return llmResult;
    }
  }

  const profile = buildContextProfile(context);
  const outreachModule = getKnowledgeModule(context, "outreach");
  const pitchModule = getKnowledgeModule(context, "pitch_templates");
  const positioning = context.previousOutputs.find((output) => output.outputType === "creator_positioning")?.structuredContent?.creatorPositioningStatement
    || `${profile.brandName} creates native-feeling ${profile.niche} content.`;
  const personalizedTarget = context.currentTask.taskType === "personalized_pitch"
    ? extractPersonalizedBrandTarget(context)
    : null;
  const brandLabel = personalizedTarget?.brandName || "[Brand]";
  const fitReason = personalizedTarget?.summary
    ? `A quick fit reason: ${personalizedTarget.summary}`
    : `Reason for fit: native-feeling ${profile.niche} content with a clear product angle.`;
  const structuredContent = {
    casualVersion: `Hey ${brandLabel} — I create ${profile.niche} content that feels natural and easy to plug into your organic or paid mix. ${fitReason} If helpful, I can send a few quick concepts tailored to your current push.`,
    emailPitch: `Hi ${brandLabel},\n\nI'm ${profile.brandName} and I create ${profile.niche} content that helps brands look credible without feeling over-produced. ${positioning}\n\n${fitReason}\n\nIf you're open to it, I can send a few fast concept angles tailored to your current campaign.\n\nBest,\n[Your name]`,
    personalisationPlaceholders: getStructuredList(pitchModule, "placeholders", ["[Brand]", "[product / campaign]", "[specific reason you fit them]"]),
    professionalVersion: `Hi ${brandLabel}, I create concise ${profile.niche} UGC designed to feel trustworthy and easy for brand teams to brief. ${fitReason} I'd be happy to send a few tailored concept angles if you're exploring new creator content.`,
    subjectLineOptions: getStructuredList(pitchModule, "subjectLines", ["UGC idea for [Brand]", "Quick creator fit for [Brand]", `${profile.niche} UGC concept for [Brand]`]),
    usageNotes: [
      ...getStructuredList(outreachModule, "principles", ["Personalize the first line", "Keep the value proposition clear"]).slice(0, 2),
      "Use the casual version for DMs and the professional version for email"
    ],
    warmDmPitch: `Hey ${brandLabel} — I make ${profile.niche} UGC that feels straightforward and credible. ${fitReason} I had a couple of quick concept ideas if you'd want me to send them over.`,
    generatedBy: context.currentTask.taskType === "personalized_pitch" ? "template" : undefined
  };

  return {
    content: buildRichContent([
      { title: "Short email pitch", value: structuredContent.emailPitch },
      { title: "Short DM pitch", value: structuredContent.warmDmPitch },
      { title: "Professional version", value: structuredContent.professionalVersion },
      { title: "Casual version", value: structuredContent.casualVersion },
      { title: "Subject line options", value: structuredContent.subjectLineOptions },
      { title: "Personalization placeholders", value: structuredContent.personalisationPlaceholders },
      { title: "Usage notes", value: structuredContent.usageNotes }
    ]),
    outputType: context.currentTask.taskType === "personalized_pitch" ? "pitch_draft" : "pitch_template",
    structuredContent,
    title: context.currentTask.taskType === "personalized_pitch" ? `Personalized pitch for ${brandLabel}` : "Pitch template"
  };
}

function executeFollowUpSequenceTask(context) {
  const followUpModule = getKnowledgeModule(context, "follow_ups");
  const structuredContent = {
    followUp1: "Wanted to bump this in case it got buried. Happy to send a few quick concept angles if useful.",
    followUp2: "Circling back once more in case creator content is still on your plate this month. I can keep it simple and tailored to your current product focus.",
    finalCloseLoop: "I'll close the loop here for now, but if creator content comes up again later I'd be happy to revisit it.",
    timingRecommendations: getStructuredList(followUpModule, "cadence", ["Send follow-up 1 after 3 days", "Send follow-up 2 after 7 days", "Use the final closeout after 14 days"]),
    whenNotToFollowUp: ["If the brand already said no", "If legal or payment questions are unresolved", "If the timing window has clearly passed"]
  };

  return {
    content: buildRichContent([
      { title: "Follow-up 1", value: structuredContent.followUp1 },
      { title: "Follow-up 2", value: structuredContent.followUp2 },
      { title: "Final close-the-loop message", value: structuredContent.finalCloseLoop },
      { title: "Timing recommendations", value: structuredContent.timingRecommendations },
      { title: "When not to follow up", value: structuredContent.whenNotToFollowUp }
    ]),
    outputType: "follow_up_sequence",
    structuredContent,
    title: "Follow-up sequence"
  };
}

function executeContentIdeaBatchTask(context) {
  const profile = buildContextProfile(context);
  const contentStrategyModule = getKnowledgeModule(context, "content_strategy");
  const contentFormatsModule = getKnowledgeModule(context, "content_formats");
  const hookIdeas = getStructuredList(contentStrategyModule, "hookIdeas", ["Problem-first", "Why this works", "Before you buy"]);
  const formats = getStructuredList(contentStrategyModule, "formats", getStructuredList(contentFormatsModule, "formatGuide", ["Demo", "Routine", "Testimonial"]));
  const insightGaps = extractPrivateInsightItems(context.privateInsights).slice(0, 5);
  const ideas = Array.from({ length: 10 }, (_, index) => ({
    difficultyLevel: index < 3 ? "Low" : index < 7 ? "Medium" : "Medium",
    format: formats[index % formats.length],
    hook: `${hookIdeas[index % hookIdeas.length]} ${insightGaps[index % Math.max(insightGaps.length, 1)] || "[product / category]"}`,
    idea: insightGaps[index]
      ? `${profile.niche} concept ${index + 1}: ${insightGaps[index]}`
      : `${profile.niche} concept ${index + 1}`,
    productFit: profile.niche,
    whyItWorks: "Ties a clear user problem to an easy visual payoff."
  }));

  return {
    content: buildRichContent([
      {
        title: "10 UGC content ideas",
        value: ideas.map((idea) => `${idea.idea}: ${idea.hook} | ${idea.format} | ${idea.whyItWorks} | Difficulty: ${idea.difficultyLevel}`)
      }
    ]),
    outputType: "content_ideas",
    structuredContent: { ideas, privateContentGapsUsed: insightGaps },
    title: "Content idea batch"
  };
}

function executeUGCShotListTask(context) {
  const contentStrategyModule = getKnowledgeModule(context, "content_strategy");
  const structuredContent = {
    bRollIdeas: ["Product in use", "Texture or close-up", "Natural environment", "Routine transition shots"],
    ctaOptions: ["Want me to map this to a brand brief too?", "I can turn this into a script next.", "I can pair this with hooks for email outreach."],
    editingNotes: ["Keep cuts tight", "Front-load the payoff", "Add captions for the hook"],
    hook: getStructuredList(contentStrategyModule, "hookIdeas", ["Problem-first"])[0],
    problemSolutionFraming: "Show the frustrating before-state, then the product slotting naturally into the fix.",
    shotsNeeded: ["Hook shot", "Problem demonstration", "Product application", "Result / proof", "Closing CTA frame"],
    talkingPoints: ["What problem this solves", "Why this product fits daily routine", "What changed after using it"]
  };

  return {
    content: buildRichContent([
      { title: "Shots needed", value: structuredContent.shotsNeeded },
      { title: "B-roll ideas", value: structuredContent.bRollIdeas },
      { title: "Talking points", value: structuredContent.talkingPoints },
      { title: "Hook", value: structuredContent.hook },
      { title: "Problem / solution framing", value: structuredContent.problemSolutionFraming },
      { title: "CTA options", value: structuredContent.ctaOptions },
      { title: "Editing notes", value: structuredContent.editingNotes }
    ]),
    outputType: "shot_list",
    structuredContent,
    title: "UGC shot list"
  };
}

function executeWeeklyActionPlanTask(context) {
  const roadmapModule = getKnowledgeModule(context, "beginner_roadmap");
  const openTaskTitles = context.relatedOpenTasks.slice(0, 4).map((task) => task.title);
  const insightGaps = extractPrivateInsightItems(context.privateInsights).slice(0, 3);
  const structuredContent = {
    adminTasks: ["Update the brand tracker", "Review priorities for next approvals"],
    dailySuggestedActions: [
      "Monday: tighten outreach assets",
      "Tuesday: draft creator content concepts",
      "Wednesday: review follow-ups and open blockers",
      "Thursday: refine pitches or replies",
      "Friday: package next-week priorities"
    ],
    followUpTasks: ["Review stalled conversations", "Queue the next follow-up touchpoint"],
    outreachTasks: openTaskTitles.length > 0 ? openTaskTitles : ["Use the pitch template on best-fit brand targets"],
    priority: "Get the first creator outreach system working end to end.",
    trendSignals: insightGaps,
    userNeeds: ["Approve anything external before it is sent", "Provide pasted brand messages when you want reply drafting"],
    whatMaraCanDoNext: ["Run another safe internal task", "Draft replies to pasted messages", "Create a shot list or weekly plan"],
    roadmapReference: getStructuredList(roadmapModule, "steps", []).slice(0, 4),
    contentTasks: ["Create one content idea batch", "Turn best ideas into a shot list"]
  };

  return {
    content: buildRichContent([
      { title: "This week's priority", value: structuredContent.priority },
      { title: "Daily suggested actions", value: structuredContent.dailySuggestedActions },
      { title: "Outreach tasks", value: structuredContent.outreachTasks },
      { title: "Content tasks", value: structuredContent.contentTasks },
      { title: "Admin tasks", value: structuredContent.adminTasks },
      { title: "Follow-up tasks", value: structuredContent.followUpTasks },
      { title: "Trend and content-gap notes", value: structuredContent.trendSignals.length > 0 ? structuredContent.trendSignals : ["No private creator-search insight file is loaded yet."] },
      { title: "What Mara can do next", value: structuredContent.whatMaraCanDoNext },
      { title: "Beginner roadmap this plan is following", value: structuredContent.roadmapReference },
      { title: "What the user needs to approve or provide", value: structuredContent.userNeeds }
    ]),
    outputType: "weekly_plan",
    structuredContent,
    title: "Weekly action plan"
  };
}

function executeBrandTrackerStructureTask(context) {
  return executeUpdateBrandTrackerTask(context, { includeStructureGuide: true });
}

function executeUpdateBrandTrackerTask(context, { includeStructureGuide = false } = {}) {
  const trackingModule = getKnowledgeModule(context, "admin_tracking");
  const workflowModule = getKnowledgeModule(context, "campaign_workflow");
  const leads = safeSelectAll(
    context.db,
    `SELECT brand_name AS brandName, contact_name AS contactName, contact_email AS contactEmail,
            lead_stage AS leadStage, summary, last_activity_at AS lastActivityAt
     FROM office_leads
     WHERE user_id = ? AND worker_slug = ?
     ORDER BY coalesce(last_activity_at, updated_at, created_at) DESC
     LIMIT 25`,
    [context.userId, context.workerId]
  );
  const brands = listWorkerBrands(context.db, context.userId, context.workerId).slice(0, 15);

  const liveRows = [
    ...leads.map((lead) =>
      `${lead.brandName} | ${lead.contactEmail || "no email"} | ${lead.leadStage || "unknown"} | ${String(lead.summary || "").slice(0, 80)}`
    ),
    ...brands
      .filter((brand) => !leads.some((lead) => normalizeForComparison(lead.brandName) === normalizeForComparison(brand.brandName)))
      .map((brand) => `${brand.brandName} | researched | target | ${String(brand.suggestedAngle || brand.identitySummary || "").slice(0, 80)}`)
  ];

  const structuredContent = {
    exampleRows: liveRows.length > 0 ? liveRows : ["No live tracker rows yet — connect Gmail or let Mara finish brand research."],
    followUpDateLogic: "Set next follow-up 3 days after first touch, then 7 days after second touch.",
    liveRowCount: liveRows.length,
    pipelineStages: getStructuredList(workflowModule, "stages", ["Targeted", "Pitched", "Awaiting reply", "In conversation", "Brief received", "Closed"]),
    priorityScoringLogic: getStructuredList(trackingModule, "scoring", ["+3 niche fit", "+2 product fit", "+2 creator-friendly UGC usage", "-2 unclear scope"]),
    recommendedTrackerFields: getStructuredList(trackingModule, "fields", ["Brand", "Contact", "Category", "Status", "Last touch", "Next follow-up", "Priority score", "Notes"]),
    statusDefinitions: ["Targeted = worth reaching out", "Awaiting reply = first message sent", "In conversation = active back-and-forth"]
  };

  const sections = [];
  if (includeStructureGuide) {
    sections.push(
      { title: "Recommended tracker fields", value: structuredContent.recommendedTrackerFields },
      { title: "Pipeline stages", value: structuredContent.pipelineStages },
      { title: "Status definitions", value: structuredContent.statusDefinitions },
      { title: "Follow-up date logic", value: structuredContent.followUpDateLogic },
      { title: "Priority scoring logic", value: structuredContent.priorityScoringLogic }
    );
  }
  sections.push(
    { title: "Live tracker rows", value: structuredContent.exampleRows },
    { title: "Rows currently tracked", value: [`${structuredContent.liveRowCount} live row(s)`] }
  );

  return {
    content: buildRichContent(sections),
    outputType: "tracker_structure",
    structuredContent,
    title: includeStructureGuide ? "Brand tracker structure" : "Updated brand tracker"
  };
}

function executeBrandContentIdeasTaskTemplate(context) {
  const profile = buildContextProfile(context);
  const brand = context.targetBrand;
  if (!brand) {
    return {
      blocked: true,
      blockerReason: "Brand-specific content ideas need a researched brand on file.",
      neededFromUser: "Let Mara research brands first or specify which brand to ideate for.",
      suggestedNextStep: "Wait for the next brand research cycle or ask Mara to research a target brand."
    };
  }

  const contentStrategyModule = getKnowledgeModule(context, "content_strategy");
  const hookIdeas = getStructuredList(contentStrategyModule, "hookIdeas", ["Problem-first", "Why this works", "Before you buy"]);
  const formats = getStructuredList(contentStrategyModule, "formats", ["Demo", "Routine", "Testimonial"]);
  const identity = String(brand.identitySummary || brand.vibeNotes || brand.suggestedAngle || "").trim();
  const ideas = Array.from({ length: 8 }, (_, index) => ({
    brandName: brand.brandName,
    difficultyLevel: index < 3 ? "Low" : "Medium",
    format: formats[index % formats.length],
    hook: `${hookIdeas[index % hookIdeas.length]} for ${brand.brandName}`,
    idea: `${brand.brandName} concept ${index + 1}: ${brand.suggestedAngle || profile.niche} angle rooted in ${identity.slice(0, 120) || "the brand's current positioning"}`,
    productFit: brand.suggestedAngle || profile.niche,
    whyItWorks: `Uses ${brand.brandName}'s identity and the creator's ${profile.niche} positioning together instead of generic prompts.`
  }));

  return {
    content: buildRichContent([
      { title: `Content ideas for ${brand.brandName}`, value: ideas.map((idea) => `${idea.idea} | ${idea.hook} | ${idea.format}`) },
      { title: "Brand identity Mara used", value: [identity || "Research summary pending"] },
      { title: "Suggested angle", value: [brand.suggestedAngle || "Angle still forming from research"] }
    ]),
    outputType: "content_ideas",
    structuredContent: { brandId: brand.id, brandName: brand.brandName, generatedBy: "template", ideas },
    title: `Content ideas for ${brand.brandName}`
  };
}

async function executeBrandContentIdeasTask(context) {
  if (context.targetBrand?.brandName && isLikelyListicleTitle(context.targetBrand.brandName)) {
    return {
      blocked: true,
      blockerReason: `"${context.targetBrand.brandName}" is an article title, not a brand — content ideas for it would be meaningless.`,
      neededFromUser: "Nothing — I've flagged this lead as junk.",
      suggestedNextStep: "Name a real brand and I'll build ideas for it."
    };
  }
  const llmResult = await tryGenerateMaraBrandContentIdeas(context);
  if (llmResult) {
    return llmResult;
  }
  return executeBrandContentIdeasTaskTemplate(context);
}

async function executeTikTokTrendPulseTask(context) {
  const profile = buildContextProfile(context);
  const insights = context.privateInsights;
  const niche = String(insights?.niche || profile.niche).trim();
  const contentGaps = extractPrivateInsightItems(insights).slice(0, 8);
  const hashtags = Array.isArray(insights?.hashtags) ? insights.hashtags.slice(0, 12) : [];

  // The actionable core: per content gap, a ready-to-use hashtag stack —
  // trending tags from this week's data plus the creator's niche anchors.
  const nicheAnchor = `#${niche.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "creator"}`;
  const hashtagPlan = contentGaps.slice(0, 5).map((gap, index) => {
    const rotation = hashtags.slice(index % Math.max(1, hashtags.length)).concat(hashtags).slice(0, 4);
    return {
      gap: String(gap),
      hashtags: [...new Set([...rotation.map((item) => item.hashtag), nicheAnchor, "#ugccreator"])].slice(0, 6),
      why: rotation[0]?.views ? `Anchored on ${rotation[0].hashtag} (${rotation[0].views} views this week).` : "Anchored on this week's trending set."
    };
  });

  const structuredContent = {
    contentGapNotes: contentGaps,
    hashtagPlan,
    matchedToNiche: Boolean(insights?.matchedToNiche),
    niche,
    notes: Array.isArray(insights?.notes) ? insights.notes : [],
    region: insights?.region || "US",
    sourceUpdatedAt: insights?.updatedAt || null,
    takeaways: hashtags.map((item) => `${item.hashtag}: ${item.posts || "?"} posts / ${item.views || "?"} views`),
    trendingHashtags: hashtags.map((item) => item.hashtag)
  };

  return {
    content: buildRichContent([
      { title: "Focus area", value: [niche] },
      {
        title: "TikTok hashtags matched to this creator",
        value: structuredContent.takeaways.length > 0 ? structuredContent.takeaways : ["No niche-scoped TikTok trends are on file yet."]
      },
      {
        title: "Content-gap angles to explore",
        value: contentGaps.length > 0 ? contentGaps : ["Paste this week's TikTok trend notes on my desk and I'll map the gaps."]
      },
      {
        title: "Hashtag plan — what to tag each video",
        value:
          hashtagPlan.length > 0
            ? hashtagPlan.map((plan) => `${plan.gap}: ${plan.hashtags.join(" ")} — ${plan.why}`)
            : ["Once trend data is loaded I'll pair every content gap with a ready-to-paste hashtag stack."]
      },
      {
        title: "What Mara is taking away",
        value: structuredContent.notes.length > 0 ? structuredContent.notes : ["Use matched trends for pitches and content ideas tied to this niche."]
      }
    ]),
    outputType: "market_pulse",
    structuredContent,
    title: "TikTok niche trend pulse"
  };
}

async function executeRedditMarketPulseTask(context) {
  const profile = buildContextProfile(context);
  const redditSignals = await fetchRedditSignals({ fetchImpl: context.fetchImpl, limitPerCommunity: 4 });
  const insightGaps = extractPrivateInsightItems(context.privateInsights).slice(0, 5);

  // Learning loop: split scraped posts into real paid opportunities and
  // reusable lessons. LLM-classified when available, heuristic otherwise —
  // and never fabricated.
  let classified = null;
  if (redditSignals.length > 0) {
    classified = await tryClassifyRedditSignals({
      db: context.db,
      fetchImpl: context.fetchImpl,
      niche: profile.niche,
      signals: redditSignals,
      userId: context.userId
    });
  }
  if (!classified) {
    classified = classifyRedditSignalsHeuristic(redditSignals);
  }

  // Opportunities become research items the manager can act on immediately.
  const createdOpportunityIds = [];
  for (const opportunity of classified.opportunities) {
    const created = createResearchItem(context.db, {
      evidence: [{ title: opportunity.title, url: opportunity.url }],
      insights: [opportunity.whyRelevant || opportunity.summary].filter(Boolean),
      query: `Reddit opportunity in r/${opportunity.community || "creator communities"}`,
      scope: "brand_opportunity",
      sourceType: "reddit_opportunity",
      status: "queued",
      summary: opportunity.summary || opportunity.title,
      topic: `[Opportunity] ${opportunity.title}`,
      userId: context.userId,
      workerId: context.workerId
    });
    if (!created.duplicate && created.id) createdOpportunityIds.push(created.id);
  }

  const structuredContent = {
    communitySignals: redditSignals.slice(0, 8).map((signal) => `[r/${signal.community}] ${signal.title}`),
    contentGapNotes: insightGaps,
    lessonsLearned: classified.lessons.map((entry) => entry.lesson),
    niche: profile.niche,
    opportunities: classified.opportunities,
    takeaways: redditSignals.slice(0, 3).map((signal) => signal.summary || signal.title)
  };

  return {
    content: buildRichContent([
      { title: "Focus area", value: [profile.niche] },
      {
        title: "Paid opportunities spotted",
        value:
          classified.opportunities.length > 0
            ? classified.opportunities.map((entry) => `${entry.title} — ${entry.url}`)
            : ["No clear paid opportunities in this cycle's posts. I'll keep scanning."]
      },
      {
        title: "What I learned this cycle",
        value: classified.lessons.length > 0 ? classified.lessons.map((entry) => entry.lesson) : ["No new durable lessons this cycle — the playbook stands."]
      },
      { title: "Fresh Reddit creator signals", value: structuredContent.communitySignals.length > 0 ? structuredContent.communitySignals : ["No Reddit pulls were available during this cycle."] },
      { title: "TikTok content gaps on file", value: insightGaps.length > 0 ? insightGaps : ["No trend data loaded yet — paste this week's TikTok trends on my desk."] }
    ]),
    outputType: "market_pulse",
    structuredContent,
    title: "Creator market pulse"
  };
}

function executeOpsStatusBriefTask(context) {
  const approvals = listApprovalRequests(context.db, context.userId, context.workerId).filter((entry) => entry.status === "pending");
  const blockedTasks = listWorkerTasksForUserWorker(context.db, context.userId, context.workerId).filter((entry) => entry.status === "blocked");
  const runnableTasks = listWorkerTasksForUserWorker(context.db, context.userId, context.workerId).filter((entry) => entry.status === "approved");
  const brands = listWorkerBrands(context.db, context.userId, context.workerId);
  const inboxSnapshot = buildInboxLeadSnapshot(context.db, context.userId, context.workerId);
  const researchToday = countBrandResearchItemsToday(context.db, context.userId, context.workerId);

  const structuredContent = {
    approvalQueue: approvals.map((entry) => entry.title),
    blockedTasks: blockedTasks.map((entry) => entry.title),
    brandsTracked: brands.length,
    inboxSummary: inboxSnapshot.items?.slice(0, 4).map((item) => `${item.brandName}: ${item.status}`) ?? [],
    nextRunnableTasks: runnableTasks.slice(0, 4).map((entry) => entry.title),
    researchUsedToday: researchToday,
    researchRemainingToday: Math.max(0, MARA_DAILY_BRAND_RESEARCH_LIMIT - researchToday),
    risks: [
      approvals.length > 0 ? `${approvals.length} approval(s) are blocking external or sensitive work.` : null,
      blockedTasks.length > 0 ? `${blockedTasks.length} task(s) are blocked on permissions or missing input.` : null,
      inboxSnapshot.items?.length === 0 ? "No organized inbox or lead rows are available yet." : null
    ].filter(Boolean)
  };

  return {
    content: buildRichContent([
      { title: "What needs approval", value: structuredContent.approvalQueue.length > 0 ? structuredContent.approvalQueue : ["Nothing waiting on approval right now."] },
      { title: "Blocked work", value: structuredContent.blockedTasks.length > 0 ? structuredContent.blockedTasks : ["No blocked tasks."] },
      { title: "Risks and stop conditions", value: structuredContent.risks.length > 0 ? structuredContent.risks : ["No major risks flagged in this brief."] },
      { title: "Next runnable tasks", value: structuredContent.nextRunnableTasks.length > 0 ? structuredContent.nextRunnableTasks : ["Mara will create or queue the next safe internal task."] },
      { title: "Inbox / lead snapshot", value: structuredContent.inboxSummary.length > 0 ? structuredContent.inboxSummary : ["Inbox organization pending or Gmail not connected."] },
      { title: "Brand research budget today", value: [`${structuredContent.researchUsedToday} used · ${structuredContent.researchRemainingToday} remaining`] },
      { title: "Brands on file", value: [`${structuredContent.brandsTracked} researched brand(s) in Mara's workspace`] }
    ]),
    outputType: "ops_brief",
    structuredContent,
    title: "Mara ops status brief"
  };
}

function getLatestPastedBrandMessage(context) {
  const message = [...context.recentMessages]
    .reverse()
    .find((entry) => entry.author === "You" && /brand[:\-]/i.test(entry.text));
  if (!message) return "";
  const match = String(message.text).split(/brand[:\-]/i);
  return match.length > 1 ? match.slice(1).join(" ").trim() : String(message.text).trim();
}

function executePastedMessageAnalysisTask(context) {
  const pasted = getLatestPastedBrandMessage(context);
  if (!pasted) {
    return {
      blocked: true,
      blockerReason: "This task requires pasted brand message text before Mara can analyze it.",
      neededFromUser: "Paste the brand message into chat.",
      suggestedNextStep: "Reply in chat with the brand message you want Mara to analyze."
    };
  }

  const redFlagsModule = getKnowledgeModule(context, "red_flags");
  const usageModule = getKnowledgeModule(context, "usage_rights");
  const lower = pasted.toLowerCase();
  const potentialClarifications = [];
  if (!/deliverable|video|asset|content/i.test(lower)) potentialClarifications.push("Potential thing to clarify: what exact deliverables the brand wants.");
  if (!/pay|budget|rate|compensation|paid/i.test(lower)) potentialClarifications.push("Potential thing to clarify: how compensation works and when payment happens.");
  if (!/usage|ads|paid social|whitelist|spark|raw footage/i.test(lower)) potentialClarifications.push("Potential thing to clarify: whether usage rights, paid ad usage, or raw footage are expected.");
  if (!/deadline|by |timeline|turnaround/i.test(lower)) potentialClarifications.push("Potential thing to clarify: the deadline or turnaround timeline.");

  const structuredContent = {
    deadlinesOrDeliverables: /deadline|deliverable|due/i.test(pasted) ? ["The message references timing or deliverable expectations."] : ["No explicit deadline or deliverable was clearly stated."],
    questionsToAsk: ["Clarify deliverables", "Confirm timeline", "Confirm usage rights if content is involved"],
    recommendedResponseStrategy: "Acknowledge interest, clarify scope, and avoid agreeing to anything external without approval.",
    redFlags: [
      ...(/free|spec|unpaid|affiliate only|product only/i.test(pasted) ? ["Potential thing to clarify: whether this is paid work versus product-only or affiliate-only compensation."] : []),
      ...(/raw footage/i.test(pasted) ? ["Potential thing to clarify: raw footage rights and what is included."] : []),
      ...potentialClarifications,
      ...(potentialClarifications.length === 0 ? ["No major red flags jumped out, but usage and payment terms should still be confirmed."] : [])
    ],
    summary: pasted.slice(0, 220),
    whatBrandIsAskingFor: /reply|respond/i.test(pasted) ? "A response or next-step confirmation." : "Brand context, deliverables, or collaboration discussion.",
    usageRightsReminder: usageModule?.summary || "",
    redFlagPrinciples: getStructuredList(redFlagsModule, "clarifications", [])
  };

  return {
    content: buildRichContent([
      { title: "Summary of the brand message", value: structuredContent.summary },
      { title: "What the brand is asking for", value: structuredContent.whatBrandIsAskingFor },
      { title: "Deadlines or deliverables mentioned", value: structuredContent.deadlinesOrDeliverables },
      { title: "Red flags", value: structuredContent.redFlags },
      { title: "Questions to ask", value: structuredContent.questionsToAsk },
      { title: "Usage-rights reminder", value: structuredContent.usageRightsReminder || "Clarify organic vs paid usage before agreeing." },
      { title: "Recommended response strategy", value: structuredContent.recommendedResponseStrategy }
    ]),
    outputType: "message_analysis",
    structuredContent,
    title: "Pasted brand message analysis"
  };
}

function executeDraftBrandReplyTask(context) {
  const pasted = getLatestPastedBrandMessage(context);
  if (!pasted) {
    return {
      blocked: true,
      blockerReason: "This task requires pasted brand message text before Mara can draft a reply.",
      neededFromUser: "Paste the brand message you want a reply to.",
      suggestedNextStep: "Drop the full brand message into chat and Mara can draft the reply."
    };
  }

  const preferences = buildContextProfile(context).preferences[0] || "short, clear, and confident";
  const negotiationModule = getKnowledgeModule(context, "negotiation");
  const structuredContent = {
    approvalReminder: "Sending this externally still requires approval and any needed integration setup.",
    professionalVersion: `Hi [Brand], thanks for reaching out. I'm interested and would be glad to move this forward. Before confirming, I'd love to align on deliverables, timing, and usage details so I can respond clearly.`,
    questionsToClarify: ["What deliverables are needed?", "What timing are you targeting?", "How will the content be used?", ...getStructuredList(negotiationModule, "anchors", []).slice(0, 1)],
    replyDraft: `Hi [Brand], thanks for reaching out. I'd be happy to explore this. Before I confirm anything, can you share a bit more on deliverables, timeline, and how you'd want the content used?`,
    warmerVersion: `Hey [Brand], appreciate the note. I'd love to hear a little more about what you're looking for so I can respond in a way that actually matches the scope.`
  };

  return {
    content: buildRichContent([
      { title: "Reply draft", value: structuredContent.replyDraft },
      { title: "Alternative warmer version", value: structuredContent.warmerVersion },
      { title: "Alternative more professional version", value: structuredContent.professionalVersion },
      { title: "Questions to clarify", value: structuredContent.questionsToClarify },
      { title: "Approval reminder", value: structuredContent.approvalReminder },
      { title: "Tone note", value: `Built around the user's preference for ${preferences}.` }
    ]),
    outputType: "reply_draft",
    structuredContent,
    title: "Draft brand reply"
  };
}

function executePortfolioRecommendationsTask(context) {
  const profile = buildContextProfile(context);
  const portfolioModule = getKnowledgeModule(context, "portfolio");
  const roadmapModule = getKnowledgeModule(context, "beginner_roadmap");
  const structuredContent = {
    currentLikelyGaps: ["Before/after proof", "Category-specific examples", "A clear creator positioning section"],
    nextThreeImprovements: ["Add two niche-specific sample projects", "Write a tighter intro using the positioning output", "Show one simple case-study layout"],
    recommendedPortfolioSections: getStructuredList(portfolioModule, "include", ["About", "Best-fit niches", "Sample UGC concepts", "Process / deliverables", "Contact"]),
    sampleProjectsToCreate: getStructuredList(portfolioModule, "sampleProjects", [`${profile.niche} routine walkthrough`, "Problem / solution testimonial", "Product close-up plus talking head"]),
    positionBeginnerWork: "Frame early work as concept-driven sample campaigns that show taste, structure, and platform understanding."
  };

  return {
    content: buildRichContent([
      { title: "Current likely gaps", value: structuredContent.currentLikelyGaps },
      { title: "Recommended portfolio sections", value: structuredContent.recommendedPortfolioSections },
      { title: "Sample projects to create", value: structuredContent.sampleProjectsToCreate },
      { title: "How to position beginner work", value: structuredContent.positionBeginnerWork },
      { title: "Beginner roadmap tie-in", value: getStructuredList(roadmapModule, "steps", []).slice(0, 3) },
      { title: "Next 3 portfolio improvements", value: structuredContent.nextThreeImprovements }
    ]),
    outputType: "recommendation",
    structuredContent,
    title: "Portfolio recommendations"
  };
}

function executeOutreachStrategyTask(context) {
  const profile = buildContextProfile(context);
  const outreachModule = getKnowledgeModule(context, "outreach");
  const followUpModule = getKnowledgeModule(context, "follow_ups");
  const structuredContent = {
    followUpStrategy: getStructuredList(followUpModule, "principles", ["Use a 3 / 7 / 14 day sequence and stop after the polite closeout."]).join(" | "),
    maraNext: ["Run the pitch template task if not done", "Build a follow-up sequence", "Prepare the first tracker structure"],
    outreachCadence: "Start with a small focused batch each week rather than broad-volume outreach.",
    personalizationStrategy: getStructuredList(outreachModule, "principles", ["Use niche overlap, product fit, and a single concrete reason for contacting each brand."]).join(" | "),
    pitchAngle: profile.positioningOutput?.structuredContent?.brandFacingAngle || `Lead with ${profile.niche} fit and low-friction UGC value.`,
    targetBrandCategories: ["Skincare", "Wellness", "Beauty-adjacent lifestyle"],
    whatToTrack: ["Brand", "Last touch", "Next follow-up", "Reply status", "Notes"]
  };

  return {
    content: buildRichContent([
      { title: "Target brand categories", value: structuredContent.targetBrandCategories },
      { title: "Pitch angle", value: structuredContent.pitchAngle },
      { title: "Outreach cadence", value: structuredContent.outreachCadence },
      { title: "Personalization strategy", value: structuredContent.personalizationStrategy },
      { title: "Follow-up strategy", value: structuredContent.followUpStrategy },
      { title: "What to track", value: structuredContent.whatToTrack },
      { title: "What Mara should do next", value: structuredContent.maraNext }
    ]),
    outputType: "strategy",
    structuredContent,
    title: "Outreach strategy"
  };
}

function executeGeneralInternalTask(context) {
  const profile = buildContextProfile(context);
  const structuredContent = {
    summary: context.currentTask.description || `Internal task completed for ${profile.brandName}.`,
    nextSteps: ["Use the output in the next safe internal task", "Refine it in chat if needed"]
  };

  return {
    content: buildRichContent([
      { title: "Summary", value: structuredContent.summary },
      { title: "Next steps", value: structuredContent.nextSteps }
    ]),
    outputType: "summary",
    structuredContent,
    title: context.currentTask.title
  };
}

function executeTaskByType(context) {
  switch (context.currentTask.taskType) {
    case "creator_positioning":
      return executeCreatorPositioningTask(context);
    case "brand_fit_criteria":
      return executeBrandFitCriteriaTask(context);
    case "pitch_template":
    case "personalized_pitch":
      return executePitchTemplateTask(context);
    case "follow_up_sequence":
      return executeFollowUpSequenceTask(context);
    case "content_idea_batch":
      return executeContentIdeaBatchTask(context);
    case "brand_content_ideas":
      return executeBrandContentIdeasTask(context);
    case "ugc_shot_list":
      return executeUGCShotListTask(context);
    case "weekly_action_plan":
      return executeWeeklyActionPlanTask(context);
    case "brand_tracker_structure":
      return executeBrandTrackerStructureTask(context);
    case "update_brand_tracker":
      return executeUpdateBrandTrackerTask(context);
    case "ops_brief":
      return executeOpsStatusBriefTask(context);
    case "reddit_market_pulse":
      return executeRedditMarketPulseTask(context);
    case "tiktok_trend_pulse":
      return executeTikTokTrendPulseTask(context);
    case "pasted_message_analysis":
      return executePastedMessageAnalysisTask(context);
    case "draft_brand_reply":
      return executeDraftBrandReplyTask(context);
    case "portfolio_recommendations":
      return executePortfolioRecommendationsTask(context);
    case "outreach_strategy":
      return executeOutreachStrategyTask(context);
    default:
      return executeGeneralInternalTask(context);
  }
}

function markTaskBlocked(db, userId, workerId, taskId, blocker) {
  updateWorkerTaskStatus(db, userId, workerId, taskId, "blocked");
  db.prepare(
    `UPDATE worker_tasks
     SET output = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND worker_id = ?`
  ).run(JSON.stringify(blocker), new Date().toISOString(), taskId, userId, workerId);
  createWorkerActivityLog(db, {
    description: blocker.blockerReason,
    eventType: "task_execution_blocked",
    metadata: blocker,
    relatedTaskId: taskId,
    title: "Task blocked",
    userId,
    workerId
  });
  return blocker;
}

export async function runMaraTask({
  db,
  fetchImpl,
  readAccountContext,
  readConnectedIntegrations,
  readMessages,
  readMaraOnboarding,
  readPrivateInsights,
  readWorkerKnowledge,
  taskId,
  userId,
  workerId
}) {
  const task = listWorkerTasksForUserWorker(db, userId, workerId).find((entry) => entry.id === taskId);
  if (!task) {
    throw new Error("Worker task not found.");
  }

  if (workerId !== MARA_WORKER_ID) {
    throw new Error("This executor is only available for Mara.");
  }

  if (!["approved", "in_progress"].includes(task.status)) {
    throw new Error("Only approved or in-progress tasks can be executed.");
  }

  const permissions = getWorkerPermissions(db, userId, workerId);
  if (!hasRequiredPermissions(permissions, task.requiredPermissions)) {
    const primaryPermission = task.requiredPermissions[0];
    return markTaskBlocked(db, userId, workerId, taskId, {
      blockerReason: describePermissionBlocker(primaryPermission).blockerReason,
      neededFromUser: describePermissionBlocker(primaryPermission).nextStep,
      suggestedNextStep: "Update Mara's permissions or pick a safe internal task instead."
    });
  }

  if (task.requiredPermissions.some((permission) => INTERNAL_ONLY_PERMISSION_PATTERNS.test(String(permission)))) {
    return markTaskBlocked(db, userId, workerId, taskId, {
      blockerReason: "This task depends on an external action or integration Mara cannot execute internally.",
      neededFromUser: "Use an internal-only task or provide the required integration and approval path first.",
      suggestedNextStep: "Keep Mara on drafting, planning, analysis, or internal workflow work."
    });
  }

  const timestamp = new Date().toISOString();
  updateWorkerTaskStatus(db, userId, workerId, taskId, "in_progress");
  createWorkerActivityLog(db, {
    createdAt: timestamp,
    description: `Started ${task.title}.`,
    eventType: "task_execution_started",
    relatedTaskId: taskId,
    title: task.title,
    userId,
    workerId
  });

  const context = buildMaraExecutionContext({
    db,
    fetchImpl,
    readAccountContext,
    readConnectedIntegrations,
    readMessages,
    readMaraOnboarding,
    readPrivateInsights,
    readWorkerKnowledge,
    taskId,
    userId,
    workerId
  });

  let result = null;
  if (LLM_FIRST_TASK_TYPES.has(task.taskType) && isMaraLlmConfigured()) {
    result = await tryExecuteLlmFirstMaraTask(context);
  }
  if (!result) {
    result = await Promise.resolve(executeTaskByType(context));
    // Data-driven executors stay factually grounded, but their prose is
    // robotic — rewrite in the worker's voice using only the draft's facts.
    if (
      result?.content &&
      !result.blocked &&
      VOICE_POLISH_TASK_TYPES.has(task.taskType) &&
      isMaraLlmConfigured()
    ) {
      const roleConfig = getRoleConfig(workerId);
      const polished = await tryPolishDeliverableVoice({
        db,
        userId,
        roleConfig,
        title: result.title || task.title,
        draftContent: result.content,
        brandContext: {
          brandName: context.accountContext?.brandName || "",
          whatTheyDo: context.accountContext?.whatYouDo || ""
        },
        fetchImpl: context.fetchImpl
      });
      if (polished) {
        result.content = polished;
        if (result.structuredContent && typeof result.structuredContent === "object") {
          result.structuredContent.generatedBy = "llm";
        }
      }
    }
    // Label every non-LLM deliverable honestly so the UI can badge it.
    if (result?.structuredContent && typeof result.structuredContent === "object" && !result.structuredContent.generatedBy) {
      result.structuredContent.generatedBy = "template";
    }
  }
  if (result?.blocked) {
    return markTaskBlocked(db, userId, workerId, taskId, result);
  }

  const savedOutput = createWorkerOutput(db, {
    content: result.content,
    outputType: result.outputType || TASK_TYPE_OUTPUT_TYPE_MAP[task.taskType] || "summary",
    source: "task_execution",
    structuredContent: result.structuredContent ?? null,
    taskId,
    title: result.title || task.title,
    userId,
    workerId
  });
  const previewPayload = {
    outputId: savedOutput.id,
    preview: buildPreviewFromContent(savedOutput.content),
    title: savedOutput.title,
    type: savedOutput.outputType
  };
  completeWorkerTask(db, userId, workerId, taskId, JSON.stringify(previewPayload));

  if (task.targetBrandId) {
    if (savedOutput.outputType === "content_ideas") {
      touchWorkerBrandActivity(db, userId, workerId, task.targetBrandId, "content");
    }
    if (savedOutput.outputType === "pitch_draft" || savedOutput.outputType === "pitch_template") {
      touchWorkerBrandActivity(db, userId, workerId, task.targetBrandId, "pitch");
    }
  }

  createWorkerActivityLog(db, {
    createdAt: timestamp,
    description: `Finished ${task.title}.`,
    eventType: "task_execution_completed",
    metadata: { outputId: savedOutput.id, outputType: savedOutput.outputType },
    relatedTaskId: taskId,
    title: task.title,
    userId,
    workerId
  });

  return {
    output: savedOutput,
    task: listWorkerTasksForUserWorker(db, userId, workerId).find((entry) => entry.id === taskId)
  };
}

function startOfUtcDayIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
}

const HTML_ENTITIES = {
  "&amp;": "&",
  "&apos;": "'",
  "&hellip;": "…",
  "&ldquo;": "“",
  "&lsquo;": "‘",
  "&mdash;": "—",
  "&nbsp;": " ",
  "&ndash;": "–",
  "&quot;": '"',
  "&rdquo;": "”",
  "&rsquo;": "’"
};

/** Scraped text must never show raw entities like &mdash; to a user. */
export function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&[a-z]+;/gi, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? " ");
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * Search results are full of listicles ("15+ Wellness Brands for…", "Top 10
 * DTC brands"). Those are articles, not brands — treating them as brand
 * names produces absurd pitches. Reject them at the source.
 */
export function isLikelyListicleTitle(title) {
  const text = String(title ?? "").trim();
  if (!text) return true;
  if (text.length > 60) return true;
  if (/\d+\s*\+/.test(text)) return true;
  if (/\b(top|best|list of|guide to|ultimate|our favorite|favourites?)\b/i.test(text)) return true;
  if (/\bbrands\b/i.test(text)) return true;
  if (/\b(20\d{2})\b/.test(text)) return true;
  return false;
}

function decodeDuckDuckGoResultUrl(url) {
  try {
    const parsed = new URL(url, "https://duckduckgo.com");
    const uddg = parsed.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : parsed.toString();
  } catch {
    return url;
  }
}

function extractHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isAllowedBrandResearchUrl(url) {
  const host = extractHostname(url);
  if (!host) return false;
  return !/(reddit\.com|linkedin\.com|instagram\.com|tiktok\.com|youtube\.com|duckduckgo\.com)/i.test(host);
}

export function createFetchWithTimeout(fetchImpl = globalThis.fetch, timeoutMs = 8000) {
  return async (url, options = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}

async function fetchText(fetchImpl, url, headers = {}) {
  const response = await fetchImpl(url, {
    headers: {
      "user-agent": "RyvaMara/1.0 (+https://ryvaforge.com)",
      ...headers
    }
  });
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }
  return response.text();
}

function buildBrandResearchQueries({ niche, redditSignals = [], privateInsights = [] }) {
  const themeTerms = [...privateInsights, ...redditSignals]
    .flatMap((item) => String(item?.label || item?.title || item || "").toLowerCase().split(/[^a-z0-9]+/g))
    .map((part) => part.trim())
    .filter((part) => part.length >= 4 && !["with", "that", "this", "from", "your", "about", "would", "could", "creator", "creators", "brand", "brands", "trend", "trends", "hooks"].includes(part));
  const uniqueThemeTerms = [...new Set(themeTerms)].slice(0, 4);

  return [
    `${niche} brand`,
    `${niche} ecommerce brand`,
    `${niche} direct to consumer brand`,
    ...uniqueThemeTerms.map((term) => `${niche} ${term} brand`)
  ];
}

function summarizeBrandResearchFit({ brandName, niche, pageTitle, metaDescription, redditSignals = [], privateInsights = [] }) {
  const summarySource = stripHtml(metaDescription || pageTitle || "").trim();
  const lowerSource = summarySource.toLowerCase();
  const matchedInsights = privateInsights
    .map((item) => String(item?.label || item || "").trim())
    .filter(Boolean)
    .filter((label) => lowerSource.includes(label.toLowerCase().split(" ")[0]));
  const matchedSignals = redditSignals
    .map((item) => String(item?.title || "").trim())
    .filter(Boolean)
    .filter((title) => {
      const anchor = title.toLowerCase().split(/[^a-z0-9]+/g).find((part) => part.length >= 5);
      return anchor ? lowerSource.includes(anchor) : false;
    })
    .slice(0, 2);

  const whyFit = [
    `${brandName} appears aligned with ${niche}.`,
    summarySource ? `Site language suggests: ${summarySource.slice(0, 140)}.` : null,
    matchedInsights.length > 0 ? `Possible content-angle overlap: ${matchedInsights.join(", ")}.` : null,
    matchedSignals.length > 0 ? `Recent creator chatter to keep in mind: ${matchedSignals.join(" | ")}.` : null
  ].filter(Boolean);

  return {
    fitSummary: whyFit.join(" "),
    matchedInsights,
    matchedSignals,
    suggestedAngle: matchedInsights[0] || matchedSignals[0] || `${niche} routine-led content`
  };
}

async function discoverBrandCandidates({ fetchImpl, limit, niche, privateInsights = [], redditSignals = [] }) {
  const queries = buildBrandResearchQueries({ niche, privateInsights, redditSignals });
  const candidates = [];
  const seenHosts = new Set();
  let searchFetchFailures = 0;
  let searchFetchSuccesses = 0;

  for (const query of queries) {
    if (candidates.length >= limit) break;
    let html = "";
    try {
      html = await fetchText(fetchImpl, `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
      searchFetchSuccesses += 1;
    } catch {
      searchFetchFailures += 1;
      continue;
    }

    const matches = [...html.matchAll(/result__a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gims)];
    for (const match of matches) {
      const url = decodeDuckDuckGoResultUrl(match[1]);
      const title = stripHtml(match[2]);
      const hostname = extractHostname(url);
      if (!hostname || seenHosts.has(hostname) || !isAllowedBrandResearchUrl(url)) continue;
      seenHosts.add(hostname);

      let pageHtml = "";
      try {
        pageHtml = await fetchText(fetchImpl, url);
      } catch {
        pageHtml = "";
      }
      const pageTitle = pageHtml.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] || title;
      const metaDescription = pageHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || "";
      const brandName = stripHtml(pageTitle).split("|")[0].split("—")[0].split("-")[0].trim() || stripHtml(title) || hostname;
      // Articles and listicles are not brands — skip them entirely.
      if (isLikelyListicleTitle(brandName) || isLikelyListicleTitle(stripHtml(title))) continue;
      const fit = summarizeBrandResearchFit({
        brandName,
        metaDescription,
        niche,
        pageTitle,
        privateInsights,
        redditSignals
      });
      candidates.push({
        brandName,
        matchedInsights: fit.matchedInsights,
        matchedSignals: fit.matchedSignals,
        summary: fit.fitSummary.slice(0, 320),
        suggestedAngle: fit.suggestedAngle,
        url,
        website: url
      });
      if (candidates.length >= limit) break;
    }
  }

  return {
    candidates: candidates.slice(0, limit),
    searchUnavailable: searchFetchSuccesses === 0 && searchFetchFailures > 0
  };
}

async function fetchRedditSignals({ communities = MARA_REDDIT_COMMUNITIES, fetchImpl, limitPerCommunity = 2 }) {
  const signals = [];
  for (const community of communities) {
    try {
      const text = await fetchText(fetchImpl, `https://www.reddit.com/r/${community}/new.json?limit=${limitPerCommunity}`, {
        "accept": "application/json"
      });
      const parsed = JSON.parse(text);
      const posts = parsed?.data?.children ?? [];
      for (const post of posts.slice(0, limitPerCommunity)) {
        const data = post?.data ?? {};
        if (!data.title) continue;
        signals.push({
          community,
          summary: String(data.selftext || data.title || "").trim().slice(0, 240),
          title: String(data.title).trim(),
          url: `https://www.reddit.com${String(data.permalink || "")}`
        });
      }
    } catch {
      continue;
    }
  }
  return signals.slice(0, 8);
}

function hasConnectedEmailIntegration(integrations) {
  return integrations.some((integration) =>
    ["gmail", "outlook"].includes(String(integration.provider || "").toLowerCase()) &&
    String(integration.status || "").toLowerCase() === "connected"
  );
}

function inferMaraNiche({ accountContext, maraAnswers = {}, workerKnowledge, previousOutputs = [] }) {
  return resolveCreatorNiche({ accountContext, maraAnswers, previousOutputs, workerKnowledge });
}

function hasRecentOutputOfType(db, userId, workerId, outputType, maxAgeHours) {
  const threshold = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
  const row = db.prepare(
    `SELECT id
     FROM worker_outputs
     WHERE user_id = ? AND worker_id = ? AND output_type = ? AND created_at >= ?
     LIMIT 1`
  ).get(userId, workerId, outputType, threshold);
  return Boolean(row);
}

function countBrandResearchItemsToday(db, userId, workerId) {
  const row = db.prepare(
    `SELECT COUNT(*) AS count
     FROM worker_research_items
     WHERE user_id = ? AND worker_id = ? AND source_type = 'web_brand' AND created_at >= ?`
  ).get(userId, workerId, startOfUtcDayIso());
  return Number(row?.count || 0);
}

function safeSelectAll(db, query, params = []) {
  try {
    return db.prepare(query).all(...params);
  } catch {
    return [];
  }
}

function buildResearchSnapshot(db, userId, workerId, researchItems) {
  const todayThreshold = startOfUtcDayIso();
  const todaysResearch = researchItems
    .filter((item) => String(item.createdAt || "") >= todayThreshold)
    .slice(0, 8);
  const brandResearch = todaysResearch.filter((item) => item.sourceType === "web_brand");
  const redditSignals = todaysResearch.filter((item) => item.sourceType === "reddit_signal");

  return {
    brandsFoundToday: brandResearch.map((item) => ({
      id: item.id,
      summary: String(item.summary || "").trim(),
      title: item.topic
    })).slice(0, 5),
    dailyCap: MARA_DAILY_BRAND_RESEARCH_LIMIT,
    redditSignalsToday: redditSignals.map((item) => ({
      id: item.id,
      summary: String(item.summary || "").trim(),
      title: item.topic
    })).slice(0, 5),
    researchedTodayCount: brandResearch.length
  };
}

function buildInboxLeadSnapshot(db, userId, workerId) {
  const trackedLeads = safeSelectAll(
    db,
    `SELECT brand_name AS brandName, contact_name AS contactName, contact_email AS contactEmail, lead_stage AS leadStage,
            summary, last_activity_at AS lastActivityAt, metadata_json AS metadataJson
     FROM office_leads
     WHERE user_id = ? AND worker_slug = ?
     ORDER BY coalesce(last_activity_at, updated_at, created_at) DESC
     LIMIT 40`,
    [userId, workerId]
  );

  if (trackedLeads.length > 0) {
    const counts = trackedLeads.reduce((acc, lead) => {
      const status = String(lead.leadStage || "unknown");
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      counts,
      items: trackedLeads.slice(0, 5).map((lead) => ({
        brandName: lead.brandName || "Unknown brand",
        contactEmail: lead.contactEmail || "",
        contactName: lead.contactName || "",
        snippet: String(lead.summary || "").trim(),
        status: String(lead.leadStage || "unknown"),
        subject: "",
        urgency: "low"
      })),
      urgentCount: 0
    };
  }

  const threads = safeSelectAll(
    db,
    `SELECT brand_name AS brandName, contact_name AS contactName, contact_email AS contactEmail, thread_status AS threadStatus,
            urgency, subject, snippet, received_at AS receivedAt
     FROM office_email_threads
     WHERE user_id = ? AND worker_slug = ? AND brand_related = 1
     ORDER BY received_at DESC
     LIMIT 40`,
    [userId, workerId]
  );

  if (threads.length === 0) {
    return {
      items: [],
      counts: {},
      urgentCount: 0
    };
  }

  const counts = threads.reduce((acc, thread) => {
    const status = String(thread.threadStatus || "unknown");
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return {
    counts,
    items: threads.slice(0, 5).map((thread) => ({
      brandName: thread.brandName || thread.subject || "Unknown brand",
      contactEmail: thread.contactEmail || "",
      contactName: thread.contactName || "",
      snippet: String(thread.snippet || "").trim(),
      status: String(thread.threadStatus || "unknown"),
      subject: thread.subject,
      urgency: thread.urgency || "low"
    })),
    urgentCount: threads.filter((thread) => String(thread.urgency || "").toLowerCase() === "high").length
  };
}

function createAutonomyStarterTasks({ accountContext, db, maraAnswers, userId, workerId }) {
  const plan = buildMaraInitialWorkPlan({ accountContext, maraAnswers });
  const existingTasks = listWorkerTasksForUserWorker(db, userId, workerId);
  const existingByTitle = new Map(existingTasks.map((task) => [normalizeForComparison(task.title), task]));
  const taskIdsToExecute = [];

  for (const task of plan.tasks) {
    const normalizedTitle = normalizeForComparison(task.title);
    const existing = existingByTitle.get(normalizedTitle);
    if (existing) {
      if (["approved", "in_progress"].includes(existing.status)) {
        taskIdsToExecute.push(existing.id);
      }
      continue;
    }

    const created = createApprovedTaskIfPermissionAllows(db, {
      description: task.description,
      dueAt: task.priority === "high" ? "This week" : "Next 7 days",
      evidenceUsed: [],
      priority: task.priority,
      requiredPermissions: [],
      source: "autonomy_starter",
      title: task.title,
      userId,
      workerId
    });
    if (created.id) {
      taskIdsToExecute.push(created.id);
    }
  }

  for (const recurring of plan.recurringResponsibilities) {
    createRecurringResponsibility(db, {
      cadence: recurring.cadence,
      createdFrom: "autonomy_starter",
      dayOfWeek: recurring.dayOfWeek,
      description: recurring.description,
      permissionRequired: recurring.permissionRequired ?? null,
      title: recurring.title,
      userId,
      workerId
    });
  }

  return [...new Set(taskIdsToExecute)];
}

async function runMaraBrandResearchCycle({
  accountContext,
  db,
  fetchImpl = globalThis.fetch,
  privateInsights,
  userId,
  workerId,
  workerKnowledge
}) {
  const todayCount = countBrandResearchItemsToday(db, userId, workerId);
  const remaining = Math.max(0, MARA_DAILY_BRAND_RESEARCH_LIMIT - todayCount);
  if (remaining === 0) {
    return { note: "Daily brand research cap reached." };
  }

  const niche = inferMaraNiche({
    accountContext,
    previousOutputs: listWorkerOutputs(db, userId, workerId),
    workerKnowledge
  });
  const redditSignals = await fetchRedditSignals({ fetchImpl });
  const privateContentGaps = extractPrivateInsightItems(privateInsights).slice(0, 6);
  const discovery = await discoverBrandCandidates({
    fetchImpl,
    limit: remaining,
    niche,
    privateInsights: privateContentGaps,
    redditSignals
  });
  const brands = discovery.candidates;
  if (brands.length === 0) {
    if (discovery.searchUnavailable) {
      return {
        note: "Live brand search was unavailable this cycle (the search source blocked or failed every request). I did not fabricate research — I'll retry next cycle."
      };
    }
    return { note: "Live search ran but no new brand candidates matched this cycle. Nothing was fabricated; I'll broaden queries next cycle." };
  }

  const createdResearchIds = [];
  const createdPitchTaskIds = [];
  const createdSignalResearchIds = [];

  for (const signal of redditSignals.slice(0, 5)) {
    const redditResearch = createResearchItem(db, {
      evidence: [{ title: signal.title, url: signal.url }],
      insights: [signal.summary || signal.title],
      query: `Monitor creator chatter from r/${signal.community} for ${niche}.`,
      scope: "creator_market_signal",
      sourceType: "reddit_signal",
      status: "completed",
      summary: `${signal.title}${signal.summary ? ` — ${signal.summary}` : ""}`.slice(0, 320),
      topic: `[r/${signal.community}] ${signal.title}`,
      userId,
      workerId
    });
    if (!redditResearch.duplicate && redditResearch.id) createdSignalResearchIds.push(redditResearch.id);
  }

  for (const brand of brands) {
    const research = createResearchItem(db, {
      evidence: [{ title: brand.brandName, url: brand.url }],
      insights: [
        brand.summary,
        brand.suggestedAngle ? `Suggested angle: ${brand.suggestedAngle}` : null,
        ...(Array.isArray(brand.matchedInsights) ? brand.matchedInsights.map((item) => `TikTok content gap signal: ${item}`) : []),
        ...(Array.isArray(brand.matchedSignals) ? brand.matchedSignals.map((item) => `Reddit creator signal: ${item}`) : [])
      ].filter(Boolean),
      query: `Research ${brand.brandName} for ${niche} UGC fit.`,
      scope: "brand_identity",
      sourceType: "web_brand",
      status: "completed",
      summary: brand.summary,
      topic: brand.brandName,
      userId,
      workerId
    });
    if (!research.duplicate && research.id) {
      createdResearchIds.push(research.id);
      upsertWorkerBrand(db, {
        brandName: brand.brandName,
        identitySummary: brand.summary,
        researchItemId: research.id,
        suggestedAngle: brand.suggestedAngle || "",
        userId,
        vibeNotes: brand.fitSummary || "",
        website: brand.website || brand.url || "",
        workerId
      });
      const pitchTask = convertResearchItemToTask(db, userId, workerId, research.id, {
        description: `Draft a personalized pitch using the brand's identity, site language, ${brand.suggestedAngle || "the strongest current angle"}, and current fit with ${niche}.`,
        priority: "high",
        requiredPermissions: [],
        source: "autonomy_brand_research",
        status: "approved",
        taskType: "personalized_pitch",
        title: `Draft personalized pitch for ${brand.brandName}`
      });
      if (!pitchTask.duplicate && pitchTask.id) createdPitchTaskIds.push(pitchTask.id);
    }
  }

  const content = buildRichContent([
    { title: "Brands researched today", value: brands.map((brand) => `${brand.brandName}: ${brand.summary} (${brand.website})`) },
    { title: "Fresh Reddit signals", value: redditSignals.length > 0 ? redditSignals.map((signal) => `[r/${signal.community}] ${signal.title}`) : ["No Reddit pulls were available during this cycle."] },
    { title: "Private creator-search content gaps", value: privateContentGaps.length > 0 ? privateContentGaps : ["No private creator-search insight file is loaded yet."] }
  ]);

  const output = createWorkerOutput(db, {
    content,
    outputType: "summary",
    source: "research",
    structuredContent: {
      brands,
      createdSignalResearchIds,
      privateContentGaps,
      redditSignals
    },
    title: "Daily brand research digest",
    userId,
    workerId
  });

  return { createdPitchTaskIds, createdResearchIds, createdSignalResearchIds, output };
}

async function runMaraInboxOrganizationCycle({ db, fetchImpl, userId, workerId }) {
  const threads = db.prepare(
    `SELECT subject, brand_name AS brandName, contact_email AS contactEmail, thread_status AS threadStatus, urgency, snippet
     FROM office_email_threads
     WHERE user_id = ? AND worker_slug = ?
     ORDER BY received_at DESC
     LIMIT 25`
  ).all(userId, workerId);

  if (threads.length === 0) {
    return { note: "No inbox threads are available for organization yet." };
  }

  const briefParse = await parseUnparsedInboxThreads(db, userId, workerId, { fetchImpl });
  const opsSummary = buildInboxOpsSummary(db, userId, workerId);
  const statusCounts = threads.reduce((acc, thread) => {
    const key = String(thread.threadStatus || "unknown");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const urgentThreads = threads.filter((thread) => String(thread.urgency).toLowerCase() === "high").slice(0, 5);
  const campaignsWithGaps = opsSummary.campaignsWithGaps.slice(0, 6);

  const output = createWorkerOutput(db, {
    content: buildRichContent([
      { title: "Outreach status snapshot", value: Object.entries(statusCounts).map(([status, count]) => `${status}: ${count}`) },
      { title: "Parsed briefs this cycle", value: [`${briefParse.parsedCount} email brief(s) parsed into campaign records.`] },
      {
        title: "Campaigns with missing fields",
        value: campaignsWithGaps.length > 0
          ? campaignsWithGaps.map((campaign) => `${campaign.brandName}: ${campaign.missingFields.join(", ")}`)
          : ["No major campaign gaps detected in the latest parsed inbox work."]
      },
      {
        title: "Upcoming deadlines",
        value: opsSummary.upcomingDeadlines.length > 0
          ? opsSummary.upcomingDeadlines.map((campaign) => `${campaign.brandName} — ${campaign.campaignName}`)
          : ["No parsed deadlines on file yet."]
      },
      { title: "Urgent threads", value: urgentThreads.length > 0 ? urgentThreads.map((thread) => `${thread.brandName || thread.subject} — ${thread.snippet}`) : ["No urgent outreach threads right now."] },
      { title: "What Mara updated", value: ["Parsed brand email bodies into campaign records where possible", "Flagged missing payment, usage, deadline, or deliverable fields", "Prepared the latest internal inbox and campaign ops snapshot"] }
    ]),
    outputType: "summary",
    source: "autonomy_inbox",
    structuredContent: { briefParse, campaignsWithGaps, statusCounts, urgentThreads },
    title: "Inbox and campaign ops digest",
    userId,
    workerId
  });

  return { output, parsedCount: briefParse.parsedCount };
}

function countOfficeLeads(db, userId, workerId) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM office_leads
       WHERE user_id = ? AND worker_slug = ?`
    )
    .get(userId, workerId);
  return Number(row?.count || 0);
}

function markRecurringResponsibilityRun(db, recurring) {
  const timestamp = new Date().toISOString();
  const nextRunAt = computeNextRunAt(recurring.cadence, recurring.dayOfWeek, new Date(timestamp));
  db.prepare(
    `UPDATE worker_recurring_responsibilities
     SET last_run_at = ?, next_run_at = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND worker_id = ?`
  ).run(timestamp, nextRunAt, timestamp, recurring.id, recurring.userId, recurring.workerId);
}

function createAndRunAutonomyTask(db, taskInput, readers, summary) {
  const created = createApprovedTaskIfPermissionAllows(db, taskInput);
  if (created.duplicate || !created.id) {
    return null;
  }
  summary.createdTaskIds.push(created.id);
  return created.id;
}

async function executeAutonomyPlannedAction(action, { db, fetchImpl, integrations, permissions, privateInsights, summary, userId, workerId, readers }) {
  switch (action.kind) {
    case "blocked":
      summary.blockers.push(action.reason);
      return;
    case "ensure_starter_tasks": {
      const onboarding = typeof readers.readMaraOnboarding === "function" ? readers.readMaraOnboarding(userId, workerId) : null;
      const accountContext = typeof readers.readAccountContext === "function" ? readers.readAccountContext(userId) : null;
      const starterTaskIds = createAutonomyStarterTasks({
        accountContext,
        db,
        maraAnswers: onboarding?.answers || {},
        userId,
        workerId
      });
      summary.createdTaskIds.push(...starterTaskIds);
      const starterResults = await autoExecuteSafeMaraTasks({
        db,
        fetchImpl,
        taskIds: starterTaskIds,
        userId,
        workerId,
        ...readers
      });
      for (const result of starterResults) {
        if (result?.task?.id) summary.executedTaskIds.push(result.task.id);
        if (result?.output) summary.outputs.push(result.output);
      }
      return;
    }
    case "maintain_artifact":
    case "maintain_profile": {
      if (action.kind === "maintain_profile") {
        await executeAutonomyPlannedAction(
          { kind: "maintain_artifact", reason: "Refresh creator positioning from the latest account context.", taskType: "creator_positioning", title: "Refresh creator positioning" },
          { db, fetchImpl, integrations, permissions, privateInsights, readers, summary, userId, workerId }
        );
        await executeAutonomyPlannedAction(
          { kind: "maintain_artifact", reason: "Refresh brand fit criteria from the latest account context.", taskType: "brand_fit_criteria", title: "Refresh brand fit criteria" },
          { db, fetchImpl, integrations, permissions, privateInsights, readers, summary, userId, workerId }
        );
        if (action.recurringId) {
          const recurring = listRecurringResponsibilities(db, userId, workerId).find((entry) => entry.id === action.recurringId);
          if (recurring) markRecurringResponsibilityRun(db, recurring);
        }
        return;
      }
      const taskId = createAndRunAutonomyTask(
        db,
        {
          description: action.reason || `Maintain ${action.title}.`,
          priority: "high",
          requiredPermissions: [],
          source: "autonomy_maintenance",
          status: "approved",
          taskType: action.taskType,
          title: action.title,
          userId,
          workerId
        },
        readers,
        summary
      );
      if (!taskId) return;
      const result = await runMaraTask({ db, fetchImpl, taskId, userId, workerId, ...readers });
      if (result?.task?.id) summary.executedTaskIds.push(result.task.id);
      if (result?.output) summary.outputs.push(result.output);
      return;
    }
    case "brand_research": {
      if (!permissions.canRunResearch) {
        summary.blockers.push("Research permission is disabled.");
        return;
      }
      const accountContext = typeof readers.readAccountContext === "function" ? readers.readAccountContext(userId) : null;
      const workerKnowledge = typeof readers.readWorkerKnowledge === "function" ? readers.readWorkerKnowledge(userId, workerId) : [];
      const researchResult = await runMaraBrandResearchCycle({
        accountContext,
        db,
        fetchImpl,
        privateInsights,
        userId,
        workerId,
        workerKnowledge
      });
      if (researchResult.output) summary.outputs.push(researchResult.output);
      if (researchResult.createdPitchTaskIds?.length) {
        summary.createdTaskIds.push(...researchResult.createdPitchTaskIds);
        const pitchResults = await autoExecuteSafeMaraTasks({
          db,
          fetchImpl,
          taskIds: researchResult.createdPitchTaskIds,
          userId,
          workerId,
          ...readers
        });
        for (const result of pitchResults) {
          if (result?.task?.id) summary.executedTaskIds.push(result.task.id);
          if (result?.output) summary.outputs.push(result.output);
        }
      }
      if (researchResult.note) summary.notes.push(researchResult.note);
      if (action.recurringId) {
        const recurring = listRecurringResponsibilities(db, userId, workerId).find((entry) => entry.id === action.recurringId);
        if (recurring) markRecurringResponsibilityRun(db, recurring);
      }
      return;
    }
    case "personalized_pitch": {
      const taskId = createAndRunAutonomyTask(
        db,
        {
          description: `Draft a personalized pitch for ${action.brandName} using stored brand identity and research.`,
          evidenceUsed: action.researchItemId ? [`research:${action.researchItemId}`] : [],
          priority: "high",
          requiredPermissions: [],
          source: "autonomy_brand_pitch",
          status: "approved",
          targetBrandId: action.brandId,
          taskType: "personalized_pitch",
          title: `Draft personalized pitch for ${action.brandName}`,
          userId,
          workerId
        },
        readers,
        summary
      );
      if (!taskId) return;
      const result = await runMaraTask({ db, fetchImpl, taskId, userId, workerId, ...readers });
      if (result?.task?.id) summary.executedTaskIds.push(result.task.id);
      if (result?.output) summary.outputs.push(result.output);
      return;
    }
    case "brand_content_ideas":
    case "brand_content_ideas_batch": {
      const brands = listWorkerBrands(db, userId, workerId);
      const brand = action.brandId ? getWorkerBrand(db, userId, workerId, action.brandId) : brands[0];
      if (!brand) {
        summary.notes.push("Brand content ideas were skipped because no researched brands are on file yet.");
        return;
      }
      const taskId = createAndRunAutonomyTask(
        db,
        {
          description: `Generate content ideas tailored to ${brand.brandName}'s identity and the creator's positioning.`,
          priority: "high",
          requiredPermissions: [],
          source: "autonomy_brand_content",
          status: "approved",
          targetBrandId: brand.id,
          taskType: "brand_content_ideas",
          title: `Create content ideas for ${brand.brandName}`,
          userId,
          workerId
        },
        readers,
        summary
      );
      if (!taskId) return;
      const result = await runMaraTask({ db, fetchImpl, taskId, userId, workerId, ...readers });
      if (result?.task?.id) summary.executedTaskIds.push(result.task.id);
      if (result?.output) summary.outputs.push(result.output);
      if (action.recurringId) {
        const recurring = listRecurringResponsibilities(db, userId, workerId).find((entry) => entry.id === action.recurringId);
        if (recurring) markRecurringResponsibilityRun(db, recurring);
      }
      return;
    }
    case "inbox_organization": {
      const inboxResult = await runMaraInboxOrganizationCycle({ db, fetchImpl, userId, workerId });
      if (inboxResult.output) summary.outputs.push(inboxResult.output);
      if (inboxResult.note) summary.notes.push(inboxResult.note);
      return;
    }
    case "update_tracker": {
      const taskId = createAndRunAutonomyTask(
        db,
        {
          description: action.reason || "Refresh the internal brand tracker from inbox, leads, and research.",
          priority: "medium",
          requiredPermissions: [],
          source: "autonomy_tracker",
          status: "approved",
          taskType: "update_brand_tracker",
          title: "Update brand tracker",
          userId,
          workerId
        },
        readers,
        summary
      );
      if (!taskId) return;
      const result = await runMaraTask({ db, fetchImpl, taskId, userId, workerId, ...readers });
      if (result?.task?.id) summary.executedTaskIds.push(result.task.id);
      if (result?.output) summary.outputs.push(result.output);
      if (action.recurringId) {
        const recurring = listRecurringResponsibilities(db, userId, workerId).find((entry) => entry.id === action.recurringId);
        if (recurring) markRecurringResponsibilityRun(db, recurring);
      }
      return;
    }
    case "weekly_plan": {
      const taskId = createAndRunAutonomyTask(
        db,
        {
          description: "Create the latest weekly action plan from current work, research, and blockers.",
          priority: "high",
          requiredPermissions: [],
          source: "autonomy_weekly_planning",
          status: "approved",
          taskType: "weekly_action_plan",
          title: "Create weekly action plan",
          userId,
          workerId
        },
        readers,
        summary
      );
      if (!taskId) return;
      const result = await runMaraTask({ db, fetchImpl, taskId, userId, workerId, ...readers });
      if (result?.task?.id) summary.executedTaskIds.push(result.task.id);
      if (result?.output) summary.outputs.push(result.output);
      if (action.recurringId) {
        const recurring = listRecurringResponsibilities(db, userId, workerId).find((entry) => entry.id === action.recurringId);
        if (recurring) markRecurringResponsibilityRun(db, recurring);
      }
      return;
    }
    case "ops_brief": {
      const taskId = createAndRunAutonomyTask(
        db,
        {
          description: "Summarize blockers, risks, approvals, and the next safe work Mara can do.",
          priority: "high",
          requiredPermissions: [],
          source: "autonomy_ops_brief",
          status: "approved",
          taskType: "ops_brief",
          title: "Create Mara ops status brief",
          userId,
          workerId
        },
        readers,
        summary
      );
      if (!taskId) return;
      const result = await runMaraTask({ db, fetchImpl, taskId, userId, workerId, ...readers });
      if (result?.task?.id) summary.executedTaskIds.push(result.task.id);
      if (result?.output) summary.outputs.push(result.output);
      if (action.recurringId) {
        const recurring = listRecurringResponsibilities(db, userId, workerId).find((entry) => entry.id === action.recurringId);
        if (recurring) markRecurringResponsibilityRun(db, recurring);
      }
      return;
    }
    case "reddit_pulse": {
      const taskId = createAndRunAutonomyTask(
        db,
        {
          description: action.reason || "Keep learning from creator communities and market signals.",
          priority: "medium",
          requiredPermissions: permissions.canRunResearch ? [] : ["canRunResearch"],
          source: "autonomy_market_pulse",
          status: "approved",
          taskType: "reddit_market_pulse",
          title: "Creator market pulse",
          userId,
          workerId
        },
        readers,
        summary
      );
      if (!taskId) return;
      const result = await runMaraTask({ db, fetchImpl, taskId, userId, workerId, ...readers });
      if (result?.task?.id) summary.executedTaskIds.push(result.task.id);
      if (result?.output) summary.outputs.push(result.output);
      if (action.recurringId) {
        const recurring = listRecurringResponsibilities(db, userId, workerId).find((entry) => entry.id === action.recurringId);
        if (recurring) markRecurringResponsibilityRun(db, recurring);
      }
      return;
    }
    case "tiktok_trends": {
      const syncResult = syncUserTrendInsightsFromGlobal({
        db,
        globalPath: resolveGlobalTrendInsightsPath(),
        ...readers,
        userId,
        workerId
      });
      if (syncResult.note) summary.notes.push(syncResult.note);
      const taskId = createAndRunAutonomyTask(
        db,
        {
          description: action.reason || "Refresh niche-scoped TikTok trend insights for this creator.",
          priority: "medium",
          requiredPermissions: [],
          source: "autonomy_tiktok_trends",
          status: "approved",
          taskType: "tiktok_trend_pulse",
          title: "TikTok niche trend pulse",
          userId,
          workerId
        },
        readers,
        summary
      );
      if (!taskId) return;
      const result = await runMaraTask({ db, fetchImpl, taskId, userId, workerId, ...readers });
      if (result?.task?.id) summary.executedTaskIds.push(result.task.id);
      if (result?.output) summary.outputs.push(result.output);
      if (action.recurringId) {
        const recurring = listRecurringResponsibilities(db, userId, workerId).find((entry) => entry.id === action.recurringId);
        if (recurring) markRecurringResponsibilityRun(db, recurring);
      }
      return;
    }
    case "drain_approved_queue": {
      for (const taskId of (action.taskIds || []).slice(0, action.limit || 3)) {
        try {
          const result = await runMaraTask({ db, fetchImpl, taskId, userId, workerId, ...readers });
          if (result?.task?.id) summary.executedTaskIds.push(result.task.id);
          if (result?.output) summary.outputs.push(result.output);
        } catch (error) {
          summary.notes.push(error instanceof Error ? error.message : String(error));
        }
      }
      return;
    }
    default:
      if (action.recurringId) {
        const recurring = listRecurringResponsibilities(db, userId, workerId).find((entry) => entry.id === action.recurringId);
        if (recurring) markRecurringResponsibilityRun(db, recurring);
      }
      return;
  }
}

export async function runMaraAutonomyCycle({
  db,
  fetchImpl = globalThis.fetch,
  mode = "full",
  readAccountContext,
  readConnectedIntegrations,
  readMessages,
  readMaraOnboarding,
  readPrivateInsights,
  readWorkerKnowledge,
  userId,
  workerId
}) {
  if (workerId !== MARA_WORKER_ID) {
    throw new Error("Autonomy cycle is only available for Mara.");
  }

  const permissions = ensureWorkerPermissions(db, userId, workerId);
  const onboarding = typeof readMaraOnboarding === "function" ? readMaraOnboarding(userId, workerId) : null;
  const integrations = typeof readConnectedIntegrations === "function" ? readConnectedIntegrations(userId, workerId) : [];
  const privateInsights = typeof readPrivateInsights === "function" ? readPrivateInsights(userId, workerId) : null;
  const readers = {
    readAccountContext,
    readConnectedIntegrations,
    readMaraOnboarding,
    readMessages,
    readPrivateInsights,
    readWorkerKnowledge
  };
  const summary = {
    createdTaskIds: [],
    executedTaskIds: [],
    notes: [],
    outputs: [],
    blockers: [],
    plannedActions: []
  };

  const plannerContext = buildAutonomyPlannerContext({
    approvals: listApprovalRequests(db, userId, workerId).filter((entry) => entry.status === "pending"),
    blockedTasks: listWorkerTasksForUserWorker(db, userId, workerId).filter((entry) => entry.status === "blocked"),
    brandResearchRemaining: Math.max(0, MARA_DAILY_BRAND_RESEARCH_LIMIT - countBrandResearchItemsToday(db, userId, workerId)),
    brands: listWorkerBrands(db, userId, workerId),
    dueRecurring: listRecurringResponsibilities(db, userId, workerId).filter((entry) => isRecurringDue(entry)),
    hasConnectedEmail: hasConnectedEmailIntegration(integrations),
    integrations,
    leadCount: countOfficeLeads(db, userId, workerId),
    onboarding,
    outputs: listWorkerOutputs(db, userId, workerId),
    permissions,
    tasks: listWorkerTasksForUserWorker(db, userId, workerId),
    trendSnapshotUpdatedAt: getLatestTrendSnapshot(db, userId, workerId)?.updatedAt ?? null
  });

  const timedFetchImpl = createFetchWithTimeout(fetchImpl);
  const plannedActions = filterPlannedActionsForMode(planMaraAutonomyActions(plannerContext), mode);
  summary.plannedActions = plannedActions.map((action) => action.kind);
  summary.mode = mode;

  for (const action of plannedActions) {
    await executeAutonomyPlannedAction(action, {
      db,
      fetchImpl: timedFetchImpl,
      integrations,
      permissions,
      privateInsights,
      readers,
      summary,
      userId,
      workerId
    });
  }

  summary.blockers.push(...plannerContext.blockers);

  createWorkerActivityLog(db, {
    description: `I planned ${plannedActions.length} move(s), finished ${summary.executedTaskIds.length} task(s), and shipped ${summary.outputs.length} deliverable(s).`,
    eventType: "autonomy_cycle_completed",
    metadata: {
      blockers: summary.blockers,
      createdTaskIds: summary.createdTaskIds,
      executedTaskIds: summary.executedTaskIds,
      outputIds: summary.outputs.map((output) => output.id),
      plannedActions: summary.plannedActions
    },
    title: "Mara autonomy cycle",
    userId,
    workerId
  });

  return summary;
}

export async function runWorkerTask(db, userId, workerId, taskId, options = {}) {
  return runMaraTask({ db, taskId, userId, workerId, ...options });
}

export async function autoExecuteSafeMaraTasks({
  db,
  fetchImpl,
  readAccountContext,
  readConnectedIntegrations,
  readMessages,
  readMaraOnboarding,
  readPrivateInsights,
  readWorkerKnowledge,
  taskIds,
  userId,
  workerId
}) {
  const results = [];
  for (const taskId of taskIds) {
    const task = listWorkerTasksForUserWorker(db, userId, workerId).find((entry) => entry.id === taskId);
    if (!task || !SAFE_AUTO_EXECUTE_TASK_TYPES.has(task.taskType)) {
      continue;
    }

    const result = await runMaraTask({
      db,
      fetchImpl,
      readAccountContext,
      readConnectedIntegrations,
      readMessages,
      readMaraOnboarding,
      readPrivateInsights,
      readWorkerKnowledge,
      taskId,
      userId,
      workerId
    });
    createWorkerActivityLog(db, {
      description: `Auto-executed ${task.title}.`,
      eventType: "task_auto_executed",
      relatedTaskId: taskId,
      title: task.title,
      userId,
      workerId
    });
    results.push(result);
  }
  return results;
}

export function createSuggestedTask(db, task) {
  return createWorkerTask(db, {
    ...task,
    source: task.source || "mara_suggested",
    status: "proposed"
  });
}

export function createApprovedTaskIfPermissionAllows(db, task) {
  const permissions = getWorkerPermissions(db, task.userId, task.workerId);
  const requiredPermissions = Array.isArray(task.requiredPermissions) ? task.requiredPermissions : [];
  if (!hasRequiredPermissions(permissions, requiredPermissions)) {
    createWorkerActivityLog(db, {
      description: `Blocked task creation due to missing permissions: ${requiredPermissions.join(", ")}`,
      eventType: "permission_blocked_action",
      metadata: { requiredPermissions },
      title: task.title,
      userId: task.userId,
      workerId: task.workerId
    });
    return createSuggestedTask(db, { ...task, source: task.source || "mara_suggested" });
  }

  return createWorkerTask(db, {
    ...task,
    source: task.source || "memory_triggered",
    status: "approved"
  });
}

function findDuplicateRecurring(db, userId, workerId, title) {
  return db
    .prepare(
      `SELECT id
       FROM worker_recurring_responsibilities
       WHERE user_id = ? AND worker_id = ? AND normalized_title = ? AND is_active = 1`
    )
    .get(userId, workerId, normalizeForComparison(title));
}

export function createRecurringResponsibility(db, recurring) {
  const duplicate = findDuplicateRecurring(db, recurring.userId, recurring.workerId, recurring.title);
  if (duplicate) {
    return { duplicate: true, id: duplicate.id };
  }

  const timestamp = recurring.createdAt || new Date().toISOString();
  const id = randomUUID();
  const nextRunAt = recurring.nextRunAt ?? computeNextRunAt(recurring.cadence, recurring.dayOfWeek, new Date(timestamp));
  db.prepare(
    `INSERT INTO worker_recurring_responsibilities
      (id, user_id, worker_id, title, description, cadence, day_of_week, is_active, permission_required,
       last_run_at, next_run_at, created_from, normalized_title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    recurring.userId,
    recurring.workerId,
    recurring.title,
    recurring.description,
    recurring.cadence,
    recurring.dayOfWeek ?? null,
    recurring.isActive === false ? 0 : 1,
    recurring.permissionRequired ?? null,
    recurring.lastRunAt ?? null,
    nextRunAt,
    recurring.createdFrom,
    normalizeForComparison(recurring.title),
    timestamp,
    timestamp
  );

  createWorkerActivityLog(db, {
    createdAt: timestamp,
    description: recurring.description,
    eventType: "recurring_responsibility_created",
    metadata: { cadence: recurring.cadence, createdFrom: recurring.createdFrom },
    title: recurring.title,
    userId: recurring.userId,
    workerId: recurring.workerId
  });

  return { duplicate: false, id };
}

export function listRecurringResponsibilities(db, userId, workerId) {
  return db
    .prepare(
      `SELECT id, user_id AS userId, worker_id AS workerId, title, description, cadence, day_of_week AS dayOfWeek,
              is_active AS isActive, permission_required AS permissionRequired, last_run_at AS lastRunAt,
              next_run_at AS nextRunAt, created_from AS createdFrom, created_at AS createdAt, updated_at AS updatedAt
       FROM worker_recurring_responsibilities
       WHERE user_id = ? AND worker_id = ?
       ORDER BY created_at DESC`
    )
    .all(userId, workerId)
    .map((row) => ({ ...row, isActive: intToBool(row.isActive) }));
}

function findDuplicateResearch(db, userId, workerId, topic) {
  return db
    .prepare(
      `SELECT id
       FROM worker_research_items
       WHERE coalesce(user_id, '') = coalesce(?, '') AND worker_id = ? AND normalized_topic = ? AND status NOT IN ('dismissed')`
    )
    .get(userId ?? null, workerId, normalizeForComparison(topic));
}

export function createResearchItem(db, item) {
  const duplicate = findDuplicateResearch(db, item.userId ?? null, item.workerId, item.topic);
  if (duplicate) {
    return { duplicate: true, id: duplicate.id };
  }

  const timestamp = item.createdAt || new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO worker_research_items
      (id, user_id, worker_id, scope, topic, query, source_type, status, summary, insights_json, evidence_json, normalized_topic, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    item.userId ?? null,
    item.workerId,
    item.scope,
    item.topic,
    item.query,
    item.sourceType,
    item.status,
    item.summary ?? null,
    JSON.stringify(Array.isArray(item.insights) ? item.insights : []),
    JSON.stringify(Array.isArray(item.evidence) ? item.evidence : []),
    normalizeForComparison(item.topic),
    timestamp,
    timestamp
  );

  createWorkerActivityLog(db, {
    createdAt: timestamp,
    description: item.query,
    eventType: "research_item_created",
    metadata: { scope: item.scope, sourceType: item.sourceType, status: item.status },
    title: item.topic,
    userId: item.userId ?? "global",
    workerId: item.workerId
  });

  return { duplicate: false, id };
}

export function listWorkerBrands(db, userId, workerId) {
  return db
    .prepare(
      `SELECT id, brand_name AS brandName, website, identity_summary AS identitySummary, vibe_notes AS vibeNotes,
              suggested_angle AS suggestedAngle, contact_email AS contactEmail, contact_name AS contactName,
              research_item_id AS researchItemId, last_content_ideas_at AS lastContentIdeasAt, last_pitch_at AS lastPitchAt,
              created_at AS createdAt, updated_at AS updatedAt
       FROM worker_brands
       WHERE user_id = ? AND worker_id = ?
       ORDER BY updated_at DESC`
    )
    .all(userId, workerId);
}

export function getWorkerBrand(db, userId, workerId, brandId) {
  return (
    db
      .prepare(
        `SELECT id, brand_name AS brandName, website, identity_summary AS identitySummary, vibe_notes AS vibeNotes,
                suggested_angle AS suggestedAngle, contact_email AS contactEmail, contact_name AS contactName,
                research_item_id AS researchItemId, last_content_ideas_at AS lastContentIdeasAt, last_pitch_at AS lastPitchAt,
                created_at AS createdAt, updated_at AS updatedAt
         FROM worker_brands
         WHERE id = ? AND user_id = ? AND worker_id = ?`
      )
      .get(brandId, userId, workerId) ?? null
  );
}

export function upsertWorkerBrand(db, brand) {
  const normalizedName = normalizeForComparison(brand.brandName);
  const timestamp = brand.updatedAt || new Date().toISOString();
  const existing = db
    .prepare(
      `SELECT id
       FROM worker_brands
       WHERE user_id = ? AND worker_id = ? AND normalized_name = ?`
    )
    .get(brand.userId, brand.workerId, normalizedName);

  if (existing) {
    db.prepare(
      `UPDATE worker_brands
       SET brand_name = ?, website = ?, identity_summary = ?, vibe_notes = ?, suggested_angle = ?,
           contact_email = coalesce(?, contact_email), contact_name = coalesce(?, contact_name),
           research_item_id = coalesce(?, research_item_id), updated_at = ?
       WHERE id = ?`
    ).run(
      brand.brandName,
      brand.website ?? "",
      brand.identitySummary ?? "",
      brand.vibeNotes ?? "",
      brand.suggestedAngle ?? "",
      brand.contactEmail ?? null,
      brand.contactName ?? null,
      brand.researchItemId ?? null,
      timestamp,
      existing.id
    );
    return { id: existing.id, updated: true };
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO worker_brands
      (id, user_id, worker_id, brand_name, website, identity_summary, vibe_notes, suggested_angle,
       contact_email, contact_name, research_item_id, last_content_ideas_at, last_pitch_at, normalized_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`
  ).run(
    id,
    brand.userId,
    brand.workerId,
    brand.brandName,
    brand.website ?? "",
    brand.identitySummary ?? "",
    brand.vibeNotes ?? "",
    brand.suggestedAngle ?? "",
    brand.contactEmail ?? null,
    brand.contactName ?? null,
    brand.researchItemId ?? null,
    normalizedName,
    timestamp,
    timestamp
  );
  return { id, updated: false };
}

export function touchWorkerBrandActivity(db, userId, workerId, brandId, field) {
  const timestamp = new Date().toISOString();
  const column = field === "pitch" ? "last_pitch_at" : "last_content_ideas_at";
  db.prepare(
    `UPDATE worker_brands
     SET ${column} = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND worker_id = ?`
  ).run(timestamp, timestamp, brandId, userId, workerId);
}

export function listResearchItems(db, userId, workerId) {
  return db
    .prepare(
      `SELECT id, user_id AS userId, worker_id AS workerId, scope, topic, query, source_type AS sourceType, status, summary,
              insights_json AS insightsJson, evidence_json AS evidenceJson, created_at AS createdAt, updated_at AS updatedAt
       FROM worker_research_items
       WHERE worker_id = ? AND (user_id IS NULL OR user_id = ?)
       ORDER BY created_at DESC`
    )
    .all(workerId, userId)
    .map((row) => ({
      ...row,
      evidence: safeJsonParse(row.evidenceJson, []),
      insights: safeJsonParse(row.insightsJson, [])
    }));
}

export function convertResearchItemToTask(db, userId, workerId, researchItemId, taskInput) {
  db.prepare(
    `UPDATE worker_research_items
     SET status = 'converted_to_task', updated_at = ?
     WHERE id = ? AND worker_id = ? AND (user_id = ? OR user_id IS NULL)`
  ).run(new Date().toISOString(), researchItemId, workerId, userId);

  return createWorkerTask(db, {
    ...taskInput,
    evidenceUsed: [...(taskInput.evidenceUsed ?? []), `research:${researchItemId}`],
    source: taskInput.source || "research_triggered",
    status: taskInput.status || "approved",
    userId,
    workerId
  });
}

function findDuplicateApproval(db, userId, workerId, title) {
  return db
    .prepare(
      `SELECT id
       FROM worker_approval_requests
       WHERE user_id = ? AND worker_id = ? AND normalized_title = ? AND status = 'pending'`
    )
    .get(userId, workerId, normalizeForComparison(title));
}

export function createApprovalRequest(db, approval) {
  const duplicate = findDuplicateApproval(db, approval.userId, approval.workerId, approval.title);
  if (duplicate) {
    return { duplicate: true, id: duplicate.id };
  }

  const timestamp = approval.createdAt || new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO worker_approval_requests
      (id, user_id, worker_id, action_type, title, description, payload_json, status, normalized_title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    approval.userId,
    approval.workerId,
    approval.actionType,
    approval.title,
    approval.description,
    JSON.stringify(approval.payload ?? {}),
    approval.status || "pending",
    normalizeForComparison(approval.title),
    timestamp,
    timestamp
  );

  createWorkerActivityLog(db, {
    createdAt: timestamp,
    description: approval.description,
    eventType: "approval_requested",
    metadata: approval.payload ?? {},
    title: approval.title,
    userId: approval.userId,
    workerId: approval.workerId
  });

  db.prepare(
    `INSERT INTO office_suggested_actions
      (id, user_id, worker_slug, action_type, title, description, reason, related_thread_id, related_campaign_id, related_brand_id, payload_json, status, requires_approval, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, 'suggested', 1, ?, ?)`
  ).run(
    id,
    approval.userId,
    approval.workerId,
    approval.actionType,
    approval.title,
    approval.description,
    "Awaiting approval before sensitive or external action.",
    JSON.stringify(approval.payload ?? {}),
    timestamp,
    timestamp
  );

  return { duplicate: false, id };
}

export function listApprovalRequests(db, userId, workerId) {
  return db
    .prepare(
      `SELECT id, action_type AS actionType, title, description, payload_json AS payloadJson, status, created_at AS createdAt, updated_at AS updatedAt
       FROM worker_approval_requests
       WHERE user_id = ? AND worker_id = ?
       ORDER BY created_at DESC`
    )
    .all(userId, workerId)
    .map((row) => ({ ...row, payload: safeJsonParse(row.payloadJson, {}) }));
}

export async function executeApprovalFollowThrough(db, userId, workerId, approval, executionOptions = {}) {
  if (!approval || String(approval.status).toLowerCase() !== "approved") {
    return { executed: false };
  }

  const payload = approval.payload ?? safeJsonParse(approval.payloadJson, {});
  const results = [];

  if (approval.actionType === "use_integration" || payload.enableInboxPermissions) {
    updateWorkerPermissions(db, userId, workerId, {
      canReadInbox: true,
      canUseConnectedIntegrations: true
    });
    results.push({ type: "permissions_updated" });
  }

  if (payload.taskId) {
    const result = await runMaraTask({
      db,
      taskId: String(payload.taskId),
      userId,
      workerId,
      ...executionOptions
    });
    results.push({ outputId: result?.output?.id ?? null, taskId: payload.taskId, type: "task_executed" });
  }

  if (payload.runAutonomy) {
    const summary = await runMaraAutonomyCycle({
      db,
      userId,
      workerId,
      ...executionOptions
    });
    results.push({ plannedActions: summary.plannedActions, type: "autonomy_cycle" });
  }

  return { executed: results.length > 0, results };
}

export async function updateApprovalRequestStatus(db, userId, workerId, approvalId, status, executionOptions = null) {
  const nextStatus = String(status ?? "").trim().toLowerCase();
  if (!["approved", "rejected", "dismissed"].includes(nextStatus)) {
    throw new Error("Unsupported approval status.");
  }

  const approval = db
    .prepare(
      `SELECT id, action_type AS actionType, title, description, payload_json AS payloadJson
       FROM worker_approval_requests
       WHERE id = ? AND user_id = ? AND worker_id = ?`
    )
    .get(approvalId, userId, workerId);

  if (!approval) {
    throw new Error("Approval request not found.");
  }

  const timestamp = new Date().toISOString();
  db.prepare(
    `UPDATE worker_approval_requests
     SET status = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND worker_id = ?`
  ).run(nextStatus, timestamp, approvalId, userId, workerId);

  db.prepare(
    `UPDATE office_suggested_actions
     SET status = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND worker_slug = ?`
  ).run(nextStatus, timestamp, approvalId, userId, workerId);

  createWorkerActivityLog(db, {
    createdAt: timestamp,
    description: approval.description,
    eventType: nextStatus === "approved" ? "approval_approved" : "approval_rejected",
    metadata: safeJsonParse(approval.payloadJson, {}),
    title: approval.title,
    userId,
    workerId
  });

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    userId,
    workerId,
    nextStatus === "approved" ? "Approved worker request." : "Rejected worker request.",
    "Worker approvals",
    approval.title,
    timestamp
  );

  return {
    approval: {
      ...approval,
      payload: safeJsonParse(approval.payloadJson, {}),
      status: nextStatus,
      updatedAt: timestamp
    },
    followThrough: executionOptions
      ? await executeApprovalFollowThrough(
          db,
          userId,
          workerId,
          { ...approval, payload: safeJsonParse(approval.payloadJson, {}), status: nextStatus },
          executionOptions
        )
      : null,
    ok: true
  };
}

export function buildMaraInitialWorkPlan({ accountContext, maraAnswers }) {
  const niche = inferMaraNiche({ accountContext, maraAnswers, workerKnowledge: [] });
  const workflowPain = String(maraAnswers.workflow_breakdowns || "Tracking follow-ups and brand conversations").trim();
  const adminBottleneck = String(maraAnswers.biggest_admin_drag || "Staying organized across outreach, ideas, and follow-ups").trim();
  const inboxPriorities = String(maraAnswers.email_volume || "brand emails, briefs, deadlines, and follow-ups").trim();
  const approvalRules = String(maraAnswers.approval_rules || "Sensitive external actions should be approval-gated.").trim();
  const dailyOutput = String(maraAnswers.daily_output || "A clear list of what moved, what is blocked, and what needs approval.").trim();
  const brandName = String(accountContext?.brandName || "Your brand").trim();

  const creatorProfileSummary = `${brandName} is focused on ${String(accountContext?.whatYouDo || niche).trim()}. Mara should operate as a junior UGC operations hire supporting creator workflow, outreach, and momentum.`;
  const brandFitCriteria = [
    `Brands aligned with ${niche}`,
    "UGC-friendly and open to creator partnerships",
    "Reasonable fit for the creator's current stage and positioning"
  ];
  const painPointMap = [workflowPain, adminBottleneck, `Inbox priorities: ${inboxPriorities}`];
  const first7DayActionPlan = [
    "Clarify creator positioning and ideal brand fit",
    "Set up first outreach assets and brand tracker structure",
    "Generate a first batch of research-backed opportunities",
    "Create a repeatable follow-up rhythm"
  ];
  const firstOutreachAngle = `Lead with a concise ${niche} creator pitch that removes friction and gives brands a clear reason to reply.`;
  const firstContentIdeas = [
    `Three ${niche} content concepts tied to brand outcomes`,
    "A low-production authenticity angle",
    "A problem-solution product use case"
  ];
  const tasks = [
    { title: "Define creator positioning", description: "Turn onboarding context into a clear positioning statement Mara can use across workflow and outreach.", priority: "high" },
    { title: "Build brand fit criteria", description: "Document what kinds of brands Mara should prioritize or avoid.", priority: "high" },
    { title: "Create first pitch template", description: "Draft a low-friction outreach template grounded in the creator's niche and strengths.", priority: "high" },
    { title: "Find first 5 target brands", description: "Queue a first research-backed starter list of brand opportunities.", priority: "high" },
    { title: "Create first content idea batch", description: "Draft initial content ideas Mara can turn into a repeatable workflow.", priority: "medium" },
    { title: "Build follow-up sequence", description: "Create a simple follow-up structure so outreach does not stall.", priority: "medium" },
    { title: "Set up brand tracker structure", description: "Prepare the tracking structure needed so conversations do not get lost.", priority: "medium" },
    { title: "Review weekly UGC workflow", description: "Map the weekly rhythm Mara should own and where approvals are required.", priority: "medium" }
  ];
  const recurringResponsibilities = [
    { title: "Weekly brand research", description: "Find fresh aligned brand opportunities each week.", cadence: "weekly", dayOfWeek: "Monday" },
    { title: "Weekly content idea batch", description: "Prepare a weekly batch of UGC-friendly concepts.", cadence: "weekly", dayOfWeek: "Friday" },
    { title: "Follow-up review", description: "Review open follow-ups and stalled opportunities twice per week.", cadence: "weekly", dayOfWeek: "Wednesday" },
    { title: "Monthly creator profile refresh", description: "Refresh positioning, brand fit, and workflow assumptions each month.", cadence: "monthly", dayOfWeek: null }
  ];
  const memoryEntries = [
    { title: "Creator profile summary", items: [creatorProfileSummary] },
    { title: "Brand fit criteria", items: brandFitCriteria },
    { title: "Pain point map", items: painPointMap },
    { title: "First 7-day action plan", items: first7DayActionPlan },
    { title: "First outreach angle", items: [firstOutreachAngle] },
    { title: "First content ideas", items: firstContentIdeas },
    { title: "Approval rules", items: [approvalRules] },
    { title: "Desired daily output", items: [dailyOutput] }
  ];

  return {
    brandFitCriteria,
    creatorProfileSummary,
    first7DayActionPlan,
    firstContentIdeas,
    firstOutreachAngle,
    memoryEntries,
    painPointMap,
    recurringResponsibilities,
    recommendedNextActions: tasks.slice(0, 4).map((task) => task.title),
    tasks
  };
}

export function runMaraActionDetector({
  openTasks = [],
  permissions = DEFAULT_MARA_PERMISSIONS,
  recentMessages = [],
  triggerText,
  triggerType,
  userId,
  workerId
}) {
  const normalizedText = String(triggerText ?? "").trim();
  const lower = normalizedText.toLowerCase();
  const tasksToCreate = [];
  const recurringResponsibilitiesToSuggest = [];
  const researchItemsToCreate = [];
  const approvalRequests = [];
  const memoriesToSave = [];
  const existingTaskTitles = new Set(openTasks.map((task) => normalizeForComparison(task.title)));

  if (!normalizedText) {
    return {
      approvalRequests,
      memoriesToSave,
      recurringResponsibilitiesToSuggest,
      researchItemsToCreate,
      tasksToCreate,
      userFacingSummary: ""
    };
  }

  memoriesToSave.push({ title: "Recent direction", items: [normalizedText] });

  if (/(prefer|like|hate|don'?t want|want)/.test(lower)) {
    memoriesToSave.push({ title: "Preferences", items: [normalizedText] });
  }

  if (/(always|never|approval|ask before|don'?t send|do not send)/.test(lower)) {
    memoriesToSave.push({ title: "Approval rules", items: [normalizedText] });
  }

  if ((/skincare|beauty|wellness/.test(lower) || /brand/.test(lower)) && /reach out|outreach|pitch/.test(lower)) {
    if (!existingTaskTitles.has(normalizeForComparison("Create first skincare pitch template"))) {
      tasksToCreate.push({
        description: "Draft a reusable outreach template aligned with the user's niche and tone preferences.",
        evidenceUsed: [normalizedText],
        priority: "high",
        requiredPermissions: permissions.canDraftOutreach ? [] : ["canDraftOutreach"],
        source: "memory_triggered",
        status: permissions.canCreateTasks ? "approved" : "proposed",
        title: "Create first skincare pitch template"
      });
    }

    if (!existingTaskTitles.has(normalizeForComparison("Find 5 skincare brand leads"))) {
      researchItemsToCreate.push({
        evidence: [normalizedText],
        insights: [],
        query: "Find 5 skincare brands aligned with the creator's niche and current stage.",
        scope: "user_specific",
        sourceType: "manual",
        status: "queued",
        topic: "Find 5 skincare brand leads"
      });
      tasksToCreate.push({
        description: "Research a starter list of skincare brand opportunities and turn them into a workable lead set.",
        evidenceUsed: [normalizedText],
        priority: "high",
        requiredPermissions: permissions.canRunResearch ? [] : ["canRunResearch"],
        source: "research_triggered",
        status: permissions.canCreateTasks && permissions.canRunResearch ? "approved" : "proposed",
        title: "Find 5 skincare brand leads"
      });
    }

    recurringResponsibilitiesToSuggest.push({
      cadence: "weekly",
      createdFrom: "memory",
      dayOfWeek: "Monday",
      description: "Find a fresh batch of aligned skincare brand opportunities each week.",
      permissionRequired: null,
      title: "Weekly skincare brand research"
    });
  }

  if (/pitch template|make me a pitch|write me a pitch/.test(lower)) {
    const directPitchTitle = /skincare/.test(lower) ? "Create first skincare pitch template" : "Create first pitch template";
    if (!existingTaskTitles.has(normalizeForComparison(directPitchTitle))) {
      tasksToCreate.push({
        description: "Draft a reusable internal pitch template aligned with the user's niche and tone preferences.",
        evidenceUsed: [normalizedText],
        priority: "high",
        requiredPermissions: [],
        source: "chat_direct_request",
        status: permissions.canCreateTasks ? "approved" : "proposed",
        taskType: "pitch_template",
        title: directPitchTitle
      });
    }
  }

  if (/losing track|follow-up|follow up|tracker|messy|missed/.test(lower)) {
    if (!existingTaskTitles.has(normalizeForComparison("Set up brand tracker structure"))) {
      tasksToCreate.push({
        description: "Create the structure Mara can use to keep outreach, follow-ups, and brand conversations visible.",
        evidenceUsed: [normalizedText],
        priority: "high",
        requiredPermissions: [],
        source: triggerType === "onboarding_completed" ? "onboarding_generated" : "memory_triggered",
        status: permissions.canCreateTasks ? "approved" : "proposed",
        title: "Set up brand tracker structure"
      });
    }
  }

  if (/content ideas?|ugc ideas?|idea batch/.test(lower)) {
    if (!existingTaskTitles.has(normalizeForComparison("Create first content idea batch"))) {
      tasksToCreate.push({
        description: "Create a first batch of internal UGC content ideas tailored to the user's niche.",
        evidenceUsed: [normalizedText],
        priority: "high",
        requiredPermissions: [],
        source: "chat_direct_request",
        status: permissions.canCreateTasks ? "approved" : "proposed",
        taskType: "content_idea_batch",
        title: "Create first content idea batch"
      });
    }
  }

  if (/positioning/.test(lower)) {
    if (!existingTaskTitles.has(normalizeForComparison("Define creator positioning"))) {
      tasksToCreate.push({
        description: "Define the creator's positioning using onboarding, memory, and current direction.",
        evidenceUsed: [normalizedText],
        priority: "high",
        requiredPermissions: [],
        source: "chat_direct_request",
        status: permissions.canCreateTasks ? "approved" : "proposed",
        taskType: "creator_positioning",
        title: "Define creator positioning"
      });
    }
  }

  if (/brand fit|ideal brands|best fit brands/.test(lower)) {
    if (!existingTaskTitles.has(normalizeForComparison("Build brand fit criteria"))) {
      tasksToCreate.push({
        description: "Build brand-fit rules Mara can reuse for future strategy and outreach planning.",
        evidenceUsed: [normalizedText],
        priority: "high",
        requiredPermissions: [],
        source: "chat_direct_request",
        status: permissions.canCreateTasks ? "approved" : "proposed",
        taskType: "brand_fit_criteria",
        title: "Build brand fit criteria"
      });
    }
  }

  if (/reply to this brand|draft a reply|reply draft/.test(lower)) {
    tasksToCreate.push({
      description: "Draft a reply to the pasted brand message using the user's tone and approval rules.",
      evidenceUsed: [normalizedText],
      priority: "high",
      requiredPermissions: [],
      source: "chat_direct_request",
      status: permissions.canCreateTasks ? "approved" : "proposed",
      taskType: "draft_brand_reply",
      title: "Draft brand reply"
    });
  }

  if (/analyze this brand message|analyze this message|what is this brand asking/.test(lower)) {
    tasksToCreate.push({
      description: "Analyze the pasted brand message and summarize asks, risks, and response strategy.",
      evidenceUsed: [normalizedText],
      priority: "high",
      requiredPermissions: [],
      source: "chat_direct_request",
      status: permissions.canCreateTasks ? "approved" : "proposed",
      taskType: "pasted_message_analysis",
      title: "Analyze pasted brand message"
    });
  }

  if (/gmail|outlook|inbox|email/.test(lower) && /connect|read|use|check/.test(lower)) {
    approvalRequests.push({
      actionType: "use_integration",
      description: "Mara needs approval before using inbox-connected tools or reading inbox data.",
      payload: { enableInboxPermissions: true, requestedMessage: normalizedText },
      title: "Approve inbox or integration access"
    });
  }

  if (/every week|weekly|every monday|every friday|twice per week/.test(lower) && /research|review|ideas|follow-up|follow up/.test(lower)) {
    recurringResponsibilitiesToSuggest.push({
      cadence: /every friday/.test(lower) ? "weekly" : "weekly",
      createdFrom: "user_request",
      dayOfWeek: /every monday/.test(lower) ? "Monday" : /every friday/.test(lower) ? "Friday" : null,
      description: normalizedText,
      permissionRequired: null,
      title: "Recurring workflow responsibility"
    });
  }

  const userFacingSummaryParts = [];
  if (tasksToCreate.length > 0) userFacingSummaryParts.push(`created ${tasksToCreate.length} task${tasksToCreate.length === 1 ? "" : "s"}`);
  if (researchItemsToCreate.length > 0) userFacingSummaryParts.push(`queued ${researchItemsToCreate.length} research item${researchItemsToCreate.length === 1 ? "" : "s"}`);
  if (recurringResponsibilitiesToSuggest.length > 0) userFacingSummaryParts.push(`identified ${recurringResponsibilitiesToSuggest.length} recurring responsibility${recurringResponsibilitiesToSuggest.length === 1 ? "" : "ies"}`);
  if (approvalRequests.length > 0) userFacingSummaryParts.push(`prepared ${approvalRequests.length} approval request${approvalRequests.length === 1 ? "" : "s"}`);

  return {
    approvalRequests,
    memoriesToSave,
    recurringResponsibilitiesToSuggest,
    researchItemsToCreate,
    tasksToCreate,
    userFacingSummary: userFacingSummaryParts.length > 0 ? `I ${userFacingSummaryParts.join(", ")} based on what you told me.` : ""
  };
}

export function buildMaraWorkspace(db, userId, workerId, { readKnowledgeSections, readOfficeOverlays } = {}) {
  const tasks = listWorkerTasksForUserWorker(db, userId, workerId);
  const workerOutputs = listWorkerOutputs(db, userId, workerId);
  const approvals = listApprovalRequests(db, userId, workerId).filter((request) => request.status === "pending");
  const recurringResponsibilities = listRecurringResponsibilities(db, userId, workerId);
  const researchItems = listResearchItems(db, userId, workerId);
  const researchSnapshot = buildResearchSnapshot(db, userId, workerId, researchItems);
  const inboxLeadSnapshot = buildInboxLeadSnapshot(db, userId, workerId);
  const permissions = getWorkerPermissions(db, userId, workerId);
  const whatMaraKnows = typeof readKnowledgeSections === "function" ? readKnowledgeSections(userId, workerId) : [];
  const recentActivity = db
    .prepare(
      `SELECT id, event_type AS eventType, title, description, related_task_id AS relatedTaskId, metadata_json AS metadataJson, created_at AS createdAt
       FROM worker_activity_log
       WHERE user_id = ? AND worker_id = ?
       ORDER BY created_at DESC
       LIMIT 12`
    )
    .all(userId, workerId)
    .map((row) => ({ ...row, metadata: safeJsonParse(row.metadataJson, {}) }))
    .filter((row) => ["task_created", "task_completed", "memory_created", "research_item_created", "approval_requested", "task_execution_started", "task_execution_completed", "task_execution_blocked", "worker_output_created", "task_auto_executed", "chat_task_created", "chat_task_executed", "recurring_responsibility_created", "autonomy_cycle_completed"].includes(row.eventType))
    .slice(0, 5)
    .map((row) => ({
      ...row,
      description: formatMaraActivityDescription(row.eventType, row.title, row.description)
    }));
  const openTasks = tasks.filter((task) => ["approved", "in_progress"].includes(task.status));
  const proposedTasks = tasks.filter((task) => task.status === "proposed");
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const blockedTasks = tasks.filter((task) => task.status === "blocked");
  const runnableTasks = openTasks.filter((task) => task.status === "approved");
  const runningTask = openTasks.find((task) => task.status === "running") ?? null;
  const inProgressTask = openTasks.find((task) => task.status === "in_progress") ?? null;
  const highestPriorityRunnableTask = pickHighestPriorityTask(runnableTasks);
  const currentWork = runningTask || inProgressTask || highestPriorityRunnableTask;
  const blockedTaskDetails = blockedTasks.map((task) => {
    const primaryPermission = Array.isArray(task.requiredPermissions) ? task.requiredPermissions[0] : null;
    const blocking = describePermissionBlocker(primaryPermission);
    return {
      ...task,
      blockerReason: blocking.blockerReason,
      nextStep: blocking.nextStep
    };
  });
  const waitingOnUser = [
    ...approvals.map((request) => ({
      id: request.id,
      kind: "approval",
      title: request.title,
      description: request.description,
      blockerReason: "I need your sign-off before I move forward.",
      nextStep: "Approve or deny so I can keep going."
    })),
    ...proposedTasks.map((task) => ({
      id: task.id,
      kind: "proposed_task",
      title: task.title,
      description: task.description,
      blockerReason: "I'd like your okay before I run this.",
      nextStep: "Approve it and I'll take it from here."
    })),
    ...blockedTaskDetails.map((task) => ({
      id: task.id,
      kind: "blocked_task",
      title: task.title,
      description: task.description || "I need one more input before I can finish this.",
      blockerReason: task.blockerReason,
      nextStep: task.nextStep
    }))
  ].slice(0, 5);
  const latestOutputs = workerOutputs
    .map((output) => ({
      ...output,
      outputPreview: {
        preview: buildOutputPreview(output),
        title: output.title,
        type: output.outputType
      }
    }))
    .slice(0, 3);
  const hasPositioning = workerOutputs.some((output) => output.outputType === "creator_positioning");
  const hasBrandCriteria = workerOutputs.some((output) => output.outputType === "brand_criteria");
  const hasFollowUpSequence = workerOutputs.some((output) => output.outputType === "follow_up_sequence");
  const hasPortfolioRecommendations = workerOutputs.some((output) => output.outputType === "recommendation");
  const lowerMemory = JSON.stringify(whatMaraKnows).toLowerCase();
  const beginnerSignal = /beginner|starting|new/.test(lowerMemory);
  const skincareSignal = /skincare|wellness|beauty/.test(lowerMemory);
  const lostTrackSignal = /follow up|follow-up|losing track|messy|missed/.test(lowerMemory);
  const outputsByType = latestOutputs.reduce((acc, item) => {
    const type = item.outputPreview?.type || "general";
    acc[type] = acc[type] ? [...acc[type], item] : [item];
    return acc;
  }, {});
  const starterTasks = [];
  if (!hasPositioning) {
    starterTasks.push({
      description: "Turn onboarding context into a sharper positioning statement Mara can use in future work.",
      priority: "high",
      title: "Define creator positioning"
    });
  }
  if (skincareSignal && !hasBrandCriteria) {
    starterTasks.push({
      description: "Document what skincare or wellness brands Mara should prioritize and avoid before outreach.",
      priority: "high",
      title: "Build brand fit criteria"
    });
  }
  if (beginnerSignal && !hasPortfolioRecommendations) {
    starterTasks.push({
      description: "Map the simplest portfolio structure and sample-project plan before pushing more outreach volume.",
      priority: "high",
      title: "Create portfolio recommendations"
    });
  }
  if (lostTrackSignal && !hasFollowUpSequence) {
    starterTasks.push({
      description: "Build a repeatable follow-up sequence so brand outreach stops slipping through the cracks.",
      priority: "high",
      title: "Build follow-up sequence"
    });
  }
  starterTasks.push(
    {
      description: "Draft a first reusable outreach template grounded in the creator's niche and tone.",
      priority: "high",
      title: "Create first pitch template"
    },
    {
      description: "Generate a first batch of content ideas Mara can build from.",
      priority: "high",
      title: "Create first content idea batch"
    }
  );
  const inactiveRecurring = recurringResponsibilities.filter((item) => !item.isActive);
  const recommendedNextActions = [];
  let recommendedNext = null;

  if (blockedTaskDetails[0]) {
    recommendedNextActions.push(`Unblock ${blockedTaskDetails[0].title}`);
    recommendedNext = {
      actionLabel: "Open task",
      description: blockedTaskDetails[0].nextStep,
      dismissible: true,
      itemId: blockedTaskDetails[0].id,
      kind: "task",
      label: `Unblock ${blockedTaskDetails[0].title}`,
      taskId: blockedTaskDetails[0].id
    };
  } else if (approvals[0]) {
    recommendedNextActions.push(approvals[0].title);
    recommendedNext = {
      actionLabel: "Approve",
      approvalId: approvals[0].id,
      description: "I'm paused until you approve or reject this request.",
      dismissible: false,
      kind: "approval",
      label: approvals[0].title
    };
  } else if (highestPriorityRunnableTask) {
    recommendedNextActions.push(`Run ${highestPriorityRunnableTask.title}`);
    recommendedNext = {
      actionLabel: "Run task",
      description: highestPriorityRunnableTask.description,
      dismissible: true,
      itemId: highestPriorityRunnableTask.id,
      kind: "task",
      label: `Run ${highestPriorityRunnableTask.title}`,
      taskId: highestPriorityRunnableTask.id
    };
  } else if (inactiveRecurring[0]) {
    recommendedNextActions.push(`Activate ${inactiveRecurring[0].title}`);
    recommendedNext = {
      actionLabel: "Create in chat",
      description: inactiveRecurring[0].description,
      dismissible: true,
      kind: "recurring",
      label: `Activate ${inactiveRecurring[0].title}`,
      prompt: `Set this recurring responsibility up for Mara: ${inactiveRecurring[0].title}. ${inactiveRecurring[0].description}`
    };
  }

  for (const task of proposedTasks.slice(0, 2)) {
    if (!recommendedNextActions.includes(task.title)) {
      recommendedNextActions.push(task.title);
    }
    if (!recommendedNext) {
      recommendedNext = {
        actionLabel: "Create next task",
        createTask: {
          description: task.description,
          priority: task.priority,
          title: task.title
        },
        description: task.description,
        dismissible: true,
        itemId: task.id,
        kind: "proposed_task",
        label: task.title,
        taskId: task.id
      };
    }
  }
  for (const item of researchItems.filter((entry) => entry.status === "queued").slice(0, 2)) {
    const label = `Research: ${item.topic}`;
    if (!recommendedNextActions.includes(label)) {
      recommendedNextActions.push(label);
    }
  }
  if (recommendedNextActions.length === 0) {
    recommendedNextActions.push(...starterTasks.map((task) => task.title));
    recommendedNext = {
      actionLabel: "Create next task",
      createTask: starterTasks[0],
      description: starterTasks[0].description,
      dismissible: true,
      kind: "starter_task",
      label: starterTasks[0].title
    };
  }

  const recommendedNextTaskToRun =
    highestPriorityRunnableTask
    || pickHighestPriorityTask(completedTasks.length === 0 ? proposedTasks.filter((task) => task.requiredPermissions.length === 0) : [])
    || null;
  const hasTrackedWork =
    tasks.length > 0
    || approvals.length > 0
    || researchItems.length > 0
    || recurringResponsibilities.length > 0;
  const currentFocus = formatMaraCurrentFocus({
    runningTask,
    inProgressTask,
    runnableTask: highestPriorityRunnableTask,
    waitingItem: waitingOnUser[0] ?? null,
    recommendedLabel: hasTrackedWork ? recommendedNextActions[0] ?? null : null,
    hasTrackedWork
  });

  return {
    blockedTasks: blockedTaskDetails,
    completedTasks,
    completedWork: workerOutputs,
    currentFocus,
    currentWork,
    llmConfigured: isMaraLlmConfigured(),
    inboxLeadSnapshot,
    latestOutputs,
    openTasks,
    pendingApprovals: approvals,
    permissions,
    proposedTasks,
    recentActivity,
    recommendedNext,
    recommendedNextTaskToRun,
    recurringResponsibilities,
    recommendedNextActions,
    researchItems,
    researchSnapshot,
    runnableTasks,
    waitingOnUser,
    whatMaraKnows: whatMaraKnows
      .map((section) => ({
        ...section,
        friendlyLabel:
          section.title === "Brand fit criteria"
            ? "Your niche"
            : section.title === "Preferences"
              ? "Your tone"
              : section.title === "Approval rules"
                ? "Your rules"
                : section.title === "Pain point map" || section.title === "Pain points"
                  ? "Your bottlenecks"
                : section.title === "Goals"
                    ? "Your goals"
                    : section.title
      }))
      .slice(0, 5),
    outputsByType
  };
}
