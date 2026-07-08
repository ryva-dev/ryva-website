import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMaraLlmBrief,
  isMaraLlmConfigured,
  parseJsonFromLlmText,
  resolvePersonalizedBrandTarget,
  tryGenerateMaraBrandContentIdeas,
  tryGenerateMaraPersonalizedPitch
} from "./maraLlm.mjs";

test("parseJsonFromLlmText handles fenced and raw JSON", () => {
  const payload = parseJsonFromLlmText('```json\n{"emailPitch":"Hi"}\n```');
  assert.equal(payload.emailPitch, "Hi");

  const raw = parseJsonFromLlmText('{"ideas":[{"idea":"Routine demo"}]}');
  assert.equal(raw.ideas[0].idea, "Routine demo");
});

test("resolvePersonalizedBrandTarget prefers targetBrand on context", () => {
  const brand = resolvePersonalizedBrandTarget({
    currentTask: { title: "Draft personalized pitch for Example Co" },
    relatedResearch: [{ topic: "Other Brand", summary: "ignored when brand exists" }],
    targetBrand: {
      brandName: "Glow Theory",
      identitySummary: "Clean skincare for sensitive skin.",
      suggestedAngle: "Routine-first education",
      vibeNotes: "Soft, clinical, trustworthy"
    }
  });

  assert.equal(brand.brandName, "Glow Theory");
  assert.match(brand.summary, /sensitive skin/i);
});

test("buildMaraLlmBrief combines creator memory, onboarding, and brand context", () => {
  const brief = buildMaraLlmBrief({
    accountContext: { brandName: "Glow Forge", whatYouDo: "skincare and wellness UGC" },
    currentTask: { title: "Create content ideas for Glow Theory" },
    previousOutputs: [
      {
        outputType: "creator_positioning",
        structuredContent: { creatorPositioningStatement: "Practical skincare UGC for busy routines." }
      }
    ],
    relevantKnowledgeModules: [{ title: "Outreach basics", summary: "Keep pitches short and specific." }],
    targetBrand: {
      brandName: "Glow Theory",
      identitySummary: "Barrier-support skincare.",
      suggestedAngle: "Sensitive-skin routines"
    },
    workerKnowledge: [{ title: "Preferences", items: ["Keep outreach short and confident."] }],
    workerOnboarding: { answers: { approval_rules: "Ask before sending anything external." } }
  });

  assert.equal(brief.creatorName, "Glow Forge");
  assert.equal(brief.niche, "skincare and wellness UGC");
  assert.equal(brief.targetBrand.brandName, "Glow Theory");
  assert.match(brief.positioning.creatorPositioningStatement, /Practical skincare UGC/i);
  assert.match(brief.maraOperatingRules.approvalRules, /Ask before sending/i);
});

test("tryGenerateMaraPersonalizedPitch returns null when Anthropic is not configured", async () => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  const result = await tryGenerateMaraPersonalizedPitch({
    currentTask: { taskType: "personalized_pitch", title: "Draft personalized pitch for Glow Theory" },
    targetBrand: { brandName: "Glow Theory", identitySummary: "Clean skincare." }
  });

  if (previousKey) {
    process.env.ANTHROPIC_API_KEY = previousKey;
  }

  assert.equal(result, null);
  assert.equal(isMaraLlmConfigured(), Boolean(previousKey));
});

test("tryGenerateMaraPersonalizedPitch uses mocked Anthropic response", async () => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";

  const result = await tryGenerateMaraPersonalizedPitch(
    {
      accountContext: { brandName: "Glow Forge", whatYouDo: "skincare UGC" },
      currentTask: { taskType: "personalized_pitch", title: "Draft personalized pitch for Glow Theory" },
      previousOutputs: [],
      relevantKnowledgeModules: [],
      targetBrand: {
        brandName: "Glow Theory",
        identitySummary: "Barrier-support skincare for sensitive skin.",
        suggestedAngle: "Routine education"
      },
      workerKnowledge: [],
      workerOnboarding: { answers: {} }
    },
    {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  emailPitch: "Hi Glow Theory team,\n\nI create skincare UGC focused on sensitive-skin routines.",
                  warmDmPitch: "Hey Glow Theory — I make sensitive-skin routine UGC that feels native.",
                  professionalVersion: "Hi Glow Theory, I create concise skincare UGC for sensitive-skin routines.",
                  casualVersion: "Hey — I make routine-first skincare UGC that feels trustworthy.",
                  subjectLineOptions: ["Sensitive-skin UGC concept for Glow Theory"],
                  fitReason: "Your barrier-support positioning matches my routine-first skincare content.",
                  usageNotes: ["Send after approval"]
                })
              }
            ]
          }),
          { status: 200 }
        )
    }
  );

  if (previousKey) {
    process.env.ANTHROPIC_API_KEY = previousKey;
  } else {
    delete process.env.ANTHROPIC_API_KEY;
  }

  assert.ok(result);
  assert.equal(result.outputType, "pitch_draft");
  assert.equal(result.structuredContent.generatedBy, "llm");
  assert.match(result.structuredContent.emailPitch, /Glow Theory/i);
  assert.match(result.structuredContent.fitReason, /barrier-support/i);
});

test("tryGenerateMaraBrandContentIdeas uses mocked Anthropic response", async () => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";

  const result = await tryGenerateMaraBrandContentIdeas(
    {
      accountContext: { brandName: "Glow Forge", whatYouDo: "skincare UGC" },
      currentTask: { taskType: "brand_content_ideas", title: "Create content ideas for Glow Theory" },
      previousOutputs: [],
      relevantKnowledgeModules: [],
      targetBrand: {
        id: "brand-1",
        brandName: "Glow Theory",
        identitySummary: "Barrier-support skincare.",
        suggestedAngle: "Sensitive-skin routines"
      },
      workerKnowledge: [],
      workerOnboarding: { answers: {} }
    },
    {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  brandAngleUsed: "Barrier-support routines",
                  creatorAngleUsed: "Sensitive-skin education",
                  ideas: [
                    {
                      idea: "Morning barrier routine with Glow Theory serum",
                      hook: "If your skin stings after cleansing, start here",
                      format: "Routine",
                      whyItWorks: "Combines the brand's barrier angle with a relatable pain point.",
                      difficultyLevel: "Low",
                      productFit: "Barrier-support serum"
                    }
                  ]
                })
              }
            ]
          }),
          { status: 200 }
        )
    }
  );

  if (previousKey) {
    process.env.ANTHROPIC_API_KEY = previousKey;
  } else {
    delete process.env.ANTHROPIC_API_KEY;
  }

  assert.ok(result);
  assert.equal(result.structuredContent.generatedBy, "llm");
  assert.equal(result.structuredContent.ideas.length, 1);
  assert.match(result.structuredContent.ideas[0].idea, /barrier routine/i);
});
