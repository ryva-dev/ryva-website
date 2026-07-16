import test from "node:test";
import assert from "node:assert/strict";
import {
  hasUnfilledPlaceholders,
  isEmptyMarketPulseStructured,
  shouldPublishWorkerOutput
} from "./maraDeliverablePublication.mjs";

test("unfilled placeholders are detected in copy and structured payloads", () => {
  assert.equal(hasUnfilledPlaceholders("Best,\n[Your name]"), true);
  assert.equal(hasUnfilledPlaceholders({ emailPitch: "Hi [Brand], ready to collaborate?" }), true);
  assert.equal(hasUnfilledPlaceholders("Hi Local Lift — ready to collaborate?"), false);
});

test("empty market pulses are not customer-facing", () => {
  assert.equal(isEmptyMarketPulseStructured({}), true);
  assert.equal(
    isEmptyMarketPulseStructured({
      opportunities: [{ title: "Paid UGC for sneakers" }],
      lessonsLearned: [],
      communitySignals: [],
      tiktokSignals: [],
      takeaways: []
    }),
    false
  );
});

test("publication gate hides templates, empty scans, and Mad Libs", () => {
  assert.equal(
    shouldPublishWorkerOutput({
      outputType: "pitch_draft",
      content: "Hi there",
      structuredContent: { generatedBy: "template", emailPitch: "Hi [Brand]" }
    }),
    false
  );
  assert.equal(
    shouldPublishWorkerOutput({
      outputType: "market_pulse",
      content: "Nothing useful",
      structuredContent: { generatedBy: "empty_scan", opportunities: [] }
    }),
    false
  );
  assert.equal(
    shouldPublishWorkerOutput({
      outputType: "pitch_draft",
      content: "Hi Local Lift — I make fitness UGC for beginners. Would you be open to a concept?",
      structuredContent: {
        generatedBy: "llm",
        emailPitch: "Hi Local Lift — I make fitness UGC for beginners. Would you be open to a concept?",
        brandName: "Local Lift"
      }
    }),
    true
  );
});
