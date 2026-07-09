const MARA_ROLE_DEFINITION =
  "Mara is an autonomous UGC operations hire for a specific creator and brand. She maintains positioning and brand-fit criteria, researches aligned brands, drafts personalized outreach, organizes Gmail into a living tracker, generates brand-specific content ideas, surfaces blockers and approval needs, and keeps working within daily limits until she hits a real stop condition.";

const DEFAULT_MODEL =
  process.env.ANTHROPIC_MARA_TASK_MODEL ||
  process.env.ANTHROPIC_OFFICE_MODEL ||
  process.env.ANTHROPIC_MODEL ||
  "claude-sonnet-4-6";

function getMemoryItems(workerKnowledge, title) {
  const section = (Array.isArray(workerKnowledge) ? workerKnowledge : []).find(
    (entry) => String(entry?.title ?? "").trim() === title
  );
  return Array.isArray(section?.items) ? section.items.map((item) => String(item).trim()).filter(Boolean) : [];
}

function extractPrivateInsightItems(privateInsights) {
  if (!privateInsights) return [];
  if (Array.isArray(privateInsights.contentGaps)) {
    return privateInsights.contentGaps.map((item) => String(item?.label || item?.gap || item?.title || item).trim()).filter(Boolean);
  }
  if (Array.isArray(privateInsights.insights)) {
    return privateInsights.insights.map((item) => String(item?.contentGap || item?.summary || item?.title || item).trim()).filter(Boolean);
  }
  return [];
}

export function isMaraLlmConfigured() {
  return Boolean(String(process.env.ANTHROPIC_API_KEY ?? "").trim());
}

function getAnthropicConfig() {
  const apiKey = String(process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    version: String(process.env.ANTHROPIC_VERSION ?? "2023-06-01").trim() || "2023-06-01"
  };
}

function extractAnthropicText(payload) {
  if (!Array.isArray(payload?.content)) return "";

  for (const item of payload.content) {
    if (item?.type === "text" && typeof item?.text === "string" && item.text.trim()) {
      return item.text.trim();
    }
  }

  return "";
}

export async function createAnthropicMessage({ fetchImpl = globalThis.fetch, maxTokens, messages, model, system }) {
  const config = getAnthropicConfig();
  if (!config) {
    throw new Error("Anthropic is not configured.");
  }

  const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": config.version
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  const text = extractAnthropicText(payload);
  if (!text) {
    throw new Error("Anthropic request returned no text.");
  }

  return text;
}

export function parseJsonFromLlmText(text) {
  const raw = String(text ?? "").trim();
  if (!raw) {
    throw new Error("LLM response was empty.");
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || raw;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("LLM response was not valid JSON.");
  }
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

export function resolvePersonalizedBrandTarget(context) {
  if (context.targetBrand) {
    return {
      brandName: context.targetBrand.brandName,
      contactName: context.targetBrand.contactName || "",
      identitySummary: context.targetBrand.identitySummary || "",
      suggestedAngle: context.targetBrand.suggestedAngle || "",
      summary: String(context.targetBrand.identitySummary || context.targetBrand.suggestedAngle || "").trim(),
      vibeNotes: context.targetBrand.vibeNotes || "",
      website: context.targetBrand.website || ""
    };
  }

  const relatedResearch = context.relatedResearch?.[0] ?? null;
  if (relatedResearch?.topic) {
    return {
      brandName: String(relatedResearch.topic).trim(),
      contactName: "",
      identitySummary: String(relatedResearch.summary || "").trim(),
      suggestedAngle: Array.isArray(relatedResearch.insights) ? relatedResearch.insights.slice(0, 2).join(" | ") : "",
      summary: String(relatedResearch.summary || "").trim(),
      vibeNotes: "",
      website: ""
    };
  }

  const match = String(context.currentTask?.title ?? "").match(/for\s+(.+)$/i);
  return {
    brandName: match?.[1]?.trim() || "[Brand]",
    contactName: "",
    identitySummary: "",
    suggestedAngle: "",
    summary: "",
    vibeNotes: "",
    website: ""
  };
}

export function buildMaraLlmBrief(context) {
  const onboarding = context.accountContext ?? {};
  const maraAnswers = context.workerOnboarding?.answers ?? {};
  const preferences = getMemoryItems(context.workerKnowledge, "Preferences");
  const goals = getMemoryItems(context.workerKnowledge, "Goals");
  const approvalRules = getMemoryItems(context.workerKnowledge, "Approval rules");
  const painPoints = getMemoryItems(context.workerKnowledge, "Pain points").concat(
    getMemoryItems(context.workerKnowledge, "Pain point map")
  );
  const recentDirection = getMemoryItems(context.workerKnowledge, "Recent direction");
  const positioningOutput = context.previousOutputs.find((output) => output.outputType === "creator_positioning");
  const brandFitOutput = context.previousOutputs.find((output) => output.outputType === "brand_criteria");
  // Niche: positioning document first — "UGC creator" is a job title, not a
  // niche, so generic values are skipped in favor of real targeting signal.
  // Sentence-shaped answers ("I do not have any content yet") are never a
  // niche either; they produce grotesque mail-merge pitches.
  const genericNiche = /^(ugc\s*)?(content\s*)?(creator|creators|content|influencer)s?$/i;
  const isUsableNiche = (value) =>
    value.length > 0 &&
    value.length <= 60 &&
    !genericNiche.test(value) &&
    !/^i\s/i.test(value) &&
    !/\b(do not|don't|dont|cannot|can't|not have|have no)\b/i.test(value) &&
    !/[?!]/.test(value) &&
    value.split(/\s+/).length <= 9;
  const nicheCandidates = [
    positioningOutput?.structuredContent?.nicheDefinition,
    positioningOutput?.structuredContent?.niche,
    onboarding.whatYouDo,
    maraAnswers.current_workflow,
    preferences[0]
  ];
  const niche = String(
    nicheCandidates.find((candidate) => isUsableNiche(String(candidate ?? "").trim())) ?? "the creator's niche"
  ).trim();

  // "UGC Creator" as a brand name is a placeholder, not an identity — sign
  // pitches with the person's actual name instead.
  const genericBrandName = /^(ugc\s*)?(creator|content creator)$/i;
  const rawBrandName = String(onboarding.brandName ?? "").trim();
  const creatorName = rawBrandName && !genericBrandName.test(rawBrandName)
    ? rawBrandName
    : String(onboarding.name ?? "").trim() || "the creator";

  return {
    approvalRules,
    brandFitCriteria: brandFitOutput?.structuredContent ?? null,
    brandTarget: resolvePersonalizedBrandTarget(context),
    creatorName,
    goals,
    knowledgeSummaries: (context.relevantKnowledgeModules || []).map(
      (module) => `${module.title}: ${module.summary}`
    ),
    maraOperatingRules: {
      approvalRules: maraAnswers.approval_rules || approvalRules.join(" | "),
      dailyOutput: maraAnswers.daily_output || "",
      inboxPriorities: maraAnswers.email_volume || "",
      replyBoundaries: maraAnswers.reply_boundaries || "",
      workflow: maraAnswers.current_workflow || ""
    },
    niche,
    painPoints,
    positioning: positioningOutput?.structuredContent ?? null,
    privateContentGaps: extractPrivateInsightItems(context.privateInsights).slice(0, 6),
    recentDirection,
    relatedResearch: (context.relatedResearch || []).map((item) => ({
      insights: item.insights ?? [],
      summary: item.summary ?? "",
      topic: item.topic ?? ""
    })),
    targetBrand: context.targetBrand
      ? {
          brandName: context.targetBrand.brandName,
          contactName: context.targetBrand.contactName,
          identitySummary: context.targetBrand.identitySummary,
          suggestedAngle: context.targetBrand.suggestedAngle,
          vibeNotes: context.targetBrand.vibeNotes,
          website: context.targetBrand.website
        }
      : null
  };
}

function buildPitchSystemPrompt() {
  return [
    "You are Mara, an autonomous UGC operations hire drafting internal outreach assets for a specific creator.",
    MARA_ROLE_DEFINITION,
    "Write for one real brand and one real creator. Use their names, niche, positioning, and stored brand research.",
    "Do not invent fake metrics, past collaborations, or live trend claims.",
    "Write like a person emailing another person — warm, specific, confident. Never mail-merge phrasing, never a sentence a human wouldn't say out loud.",
    "If the creator is early-stage or has no portfolio yet, never state that negatively; lead with fit and offer tailored sample concepts instead.",
    "The pitch must pass this test: a busy brand manager reads it and thinks 'this person actually looked at us.' Reference something concrete about the brand from the provided context.",
    "Keep pitches short, specific, and easy to send after human approval.",
    "Return only valid JSON matching the requested schema. No markdown fences or commentary."
  ].join("\n");
}

function buildContentIdeasSystemPrompt() {
  return [
    "You are Mara, an autonomous UGC operations hire generating brand-specific content ideas for one creator.",
    MARA_ROLE_DEFINITION,
    "Each idea must combine the creator's positioning with the target brand's identity — not generic UGC prompts.",
    "Do not invent fake metrics or claim live trend research unless provided in context.",
    "Return only valid JSON matching the requested schema. No markdown fences or commentary."
  ].join("\n");
}

function normalizePitchStructuredContent(payload, brandLabel) {
  const subjectLineOptions = Array.isArray(payload.subjectLineOptions)
    ? payload.subjectLineOptions.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const usageNotes = Array.isArray(payload.usageNotes)
    ? payload.usageNotes.map((item) => String(item).trim()).filter(Boolean)
    : [];

  return {
    casualVersion: String(payload.casualVersion || "").trim(),
    emailPitch: String(payload.emailPitch || "").trim(),
    fitReason: String(payload.fitReason || "").trim(),
    generatedBy: "llm",
    personalisationPlaceholders: [],
    professionalVersion: String(payload.professionalVersion || "").trim(),
    subjectLineOptions,
    usageNotes,
    warmDmPitch: String(payload.warmDmPitch || payload.warmDmPitch || "").trim()
  };
}

function normalizeContentIdeasStructuredContent(payload, brand) {
  const ideas = Array.isArray(payload.ideas)
    ? payload.ideas
        .map((idea) => ({
          brandName: brand.brandName,
          difficultyLevel: String(idea.difficultyLevel || "Medium").trim(),
          format: String(idea.format || "Demo").trim(),
          hook: String(idea.hook || "").trim(),
          idea: String(idea.idea || "").trim(),
          productFit: String(idea.productFit || brand.suggestedAngle || "").trim(),
          whyItWorks: String(idea.whyItWorks || "").trim()
        }))
        .filter((idea) => idea.idea && idea.hook)
    : [];

  if (ideas.length === 0) {
    throw new Error("LLM returned no usable content ideas.");
  }

  return {
    brandAngleUsed: String(payload.brandAngleUsed || brand.suggestedAngle || brand.identitySummary || "").trim(),
    brandId: brand.id,
    brandName: brand.brandName,
    creatorAngleUsed: String(payload.creatorAngleUsed || "").trim(),
    generatedBy: "llm",
    ideas: ideas.slice(0, 10)
  };
}

function buildPitchUserPrompt(brief) {
  const brand = brief.brandTarget;
  return [
    "Draft a personalized outreach package for this creator and brand.",
    `Creator: ${brief.creatorName}`,
    `Creator niche: ${brief.niche}`,
    brief.positioning?.creatorPositioningStatement
      ? `Creator positioning: ${brief.positioning.creatorPositioningStatement}`
      : "",
    brief.brandFitCriteria?.alignmentCriteria?.length
      ? `Brand-fit criteria: ${brief.brandFitCriteria.alignmentCriteria.join(" | ")}`
      : "",
    `Target brand: ${brand.brandName}`,
    brand.website ? `Brand website: ${brand.website}` : "",
    brand.identitySummary ? `Brand identity: ${brand.identitySummary}` : "",
    brand.suggestedAngle ? `Suggested angle: ${brand.suggestedAngle}` : "",
    brand.vibeNotes ? `Brand vibe: ${brand.vibeNotes}` : "",
    brief.relatedResearch.length > 0
      ? `Research notes: ${brief.relatedResearch.map((item) => `${item.topic}: ${item.summary}`).join(" | ")}`
      : "",
    brief.maraOperatingRules.replyBoundaries
      ? `Reply boundaries: ${brief.maraOperatingRules.replyBoundaries}`
      : "",
    brief.approvalRules.length > 0 ? `Approval rules: ${brief.approvalRules.join(" | ")}` : "",
    brief.knowledgeSummaries.length > 0 ? `UGC operating knowledge:\n${brief.knowledgeSummaries.join("\n")}` : "",
    'Return JSON: {"emailPitch":"","warmDmPitch":"","professionalVersion":"","casualVersion":"","subjectLineOptions":[],"fitReason":"","usageNotes":[]}'
  ]
    .filter(Boolean)
    .join("\n");
}

function buildContentIdeasUserPrompt(brief, brand) {
  return [
    "Generate 8 brand-specific UGC content ideas for this creator targeting this brand.",
    `Creator: ${brief.creatorName}`,
    `Creator niche: ${brief.niche}`,
    brief.positioning?.creatorPositioningStatement
      ? `Creator positioning: ${brief.positioning.creatorPositioningStatement}`
      : "",
    `Target brand: ${brand.brandName}`,
    brand.website ? `Brand website: ${brand.website}` : "",
    brand.identitySummary ? `Brand identity: ${brand.identitySummary}` : "",
    brand.suggestedAngle ? `Suggested angle: ${brand.suggestedAngle}` : "",
    brand.vibeNotes ? `Brand vibe: ${brand.vibeNotes}` : "",
    brief.privateContentGaps.length > 0 ? `Content gaps to consider: ${brief.privateContentGaps.join(" | ")}` : "",
    brief.knowledgeSummaries.length > 0 ? `UGC operating knowledge:\n${brief.knowledgeSummaries.join("\n")}` : "",
    'Return JSON: {"brandAngleUsed":"","creatorAngleUsed":"","ideas":[{"idea":"","hook":"","format":"","whyItWorks":"","difficultyLevel":"Low|Medium|High","productFit":""}]}'
  ]
    .filter(Boolean)
    .join("\n");
}

export async function tryGenerateMaraPersonalizedPitch(context, { fetchImpl } = {}) {
  if (!isMaraLlmConfigured()) {
    return null;
  }

  const brief = buildMaraLlmBrief(context);
  const brandLabel = brief.brandTarget.brandName;
  if (!brandLabel || brandLabel === "[Brand]") {
    return null;
  }

  try {
    const text = await createAnthropicMessage({
      fetchImpl: fetchImpl || context.fetchImpl,
      maxTokens: 1400,
      model: DEFAULT_MODEL,
      system: buildPitchSystemPrompt(),
      messages: [{ role: "user", content: [{ type: "text", text: buildPitchUserPrompt(brief) }] }]
    });
    const payload = parseJsonFromLlmText(text);
    const structuredContent = normalizePitchStructuredContent(payload, brandLabel);
    if (!structuredContent.emailPitch || !structuredContent.warmDmPitch) {
      throw new Error("LLM pitch response was incomplete.");
    }

    return {
      content: buildRichContent([
        { title: "Short email pitch", value: structuredContent.emailPitch },
        { title: "Short DM pitch", value: structuredContent.warmDmPitch },
        { title: "Professional version", value: structuredContent.professionalVersion },
        { title: "Casual version", value: structuredContent.casualVersion },
        { title: "Why this brand fits", value: structuredContent.fitReason },
        { title: "Subject line options", value: structuredContent.subjectLineOptions },
        { title: "Usage notes", value: structuredContent.usageNotes }
      ]),
      outputType: "pitch_draft",
      structuredContent,
      title: `Personalized pitch for ${brandLabel}`
    };
  } catch {
    return null;
  }
}

export async function tryGenerateMaraBrandContentIdeas(context, { fetchImpl } = {}) {
  if (!isMaraLlmConfigured()) {
    return null;
  }

  const brand = context.targetBrand;
  if (!brand) {
    return null;
  }

  const brief = buildMaraLlmBrief(context);

  try {
    const text = await createAnthropicMessage({
      fetchImpl: fetchImpl || context.fetchImpl,
      maxTokens: 1800,
      model: DEFAULT_MODEL,
      system: buildContentIdeasSystemPrompt(),
      messages: [{ role: "user", content: [{ type: "text", text: buildContentIdeasUserPrompt(brief, brand) }] }]
    });
    const payload = parseJsonFromLlmText(text);
    const structuredContent = normalizeContentIdeasStructuredContent(payload, brand);

    return {
      content: buildRichContent([
        {
          title: `Content ideas for ${brand.brandName}`,
          value: structuredContent.ideas.map((idea) => `${idea.idea} | ${idea.hook} | ${idea.format}`)
        },
        { title: "Brand angle Mara used", value: [structuredContent.brandAngleUsed || brand.suggestedAngle || ""] },
        { title: "Creator angle Mara used", value: [structuredContent.creatorAngleUsed || brief.niche] }
      ]),
      outputType: "content_ideas",
      structuredContent,
      title: `Content ideas for ${brand.brandName}`
    };
  } catch {
    return null;
  }
}
