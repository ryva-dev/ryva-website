import test from "node:test";
import assert from "node:assert/strict";
import { scoreOpportunityQuality, summarizeStage0Run, STAGE0_WORTH_PURSUE_THRESHOLD } from "./maraStage0Quality.mjs";
import {
  shouldPublishWorkerOutput,
  shouldClaimShippedActivity
} from "./maraDeliverablePublication.mjs";
import { formatMaraActivityDescription } from "./maraOfficeUtils.mjs";

test("Stage 0 rubric rejects dream-brand primary and placeholder pitches", () => {
  const bad = scoreOpportunityQuality({
    brandName: "Gymshark",
    creatorStage: "Brand new, no paid deals yet",
    desiredBrands: ["Gymshark"],
    fitReason: "Fitness niche overlap",
    evidenceClaims: ["Article about Gymshark growth"],
    reachableNowReason: "",
    contactRoute: "",
    contentAngle: "Leggings try-on",
    pitchBody: "Hi [Brand], I'm [Your Name]",
    pitchSubject: "Collab?",
    confidence: 40,
    nextAction: "Pitch them",
    decision: "pursue",
    readiness: "now"
  });
  assert.equal(bad.worthPursuing, false);
  assert.ok(bad.score < STAGE0_WORTH_PURSUE_THRESHOLD);
  assert.ok(bad.issues.some((item) => item.code === "dream_brand_as_primary" || item.code === "placeholder_pitch"));
});

test("Stage 0 rubric accepts reachable brand with evidence, contact, and clean pitch", () => {
  const good = scoreOpportunityQuality({
    brandName: "Local Lift Co",
    creatorStage: "Brand new, no paid deals yet",
    desiredBrands: ["Gymshark"],
    fitReason: "Beginner-friendly home gym gear matching inclusive fitness positioning",
    evidenceClaims: ["Brand Instagram actively features UGC creators", "Site has /creators page"],
    reachableNowReason: "Mid-size DTC with public partnerships email",
    contactEmail: "creators@locallift.example",
    contentAngle: "First-week home workout with resistance bands",
    pitchBody: "Hi Maya — I create beginner fitness UGC for people who feel shut out of gym culture. Local Lift's bands fit that exact audience. Would you be open to a 15-second concept?",
    pitchSubject: "Beginner UGC concept for Local Lift",
    confidence: 72,
    risks: ["Small brand — confirm payment terms"],
    nextAction: "Approve send to creators@locallift.example",
    decision: "pursue",
    readiness: "now"
  });
  assert.equal(good.worthPursuing, true);
  assert.ok(good.score >= STAGE0_WORTH_PURSUE_THRESHOLD);
});

test("Stage 0 run gate requires 70% worth-pursuing", () => {
  const summary = summarizeStage0Run([
    { worthPursuing: true, score: 80 },
    { worthPursuing: true, score: 75 },
    { worthPursuing: false, score: 40 }
  ]);
  assert.equal(summary.passRate, 2 / 3);
  assert.equal(summary.gatePass, false);

  const pass = summarizeStage0Run([
    { worthPursuing: true, score: 80 },
    { worthPursuing: true, score: 78 },
    { worthPursuing: true, score: 74 },
    { worthPursuing: false, score: 50 }
  ]);
  assert.equal(pass.gatePass, true);
});

test("brand research digests publish only with brands, and activity does not claim fake ships", () => {
  assert.equal(
    shouldPublishWorkerOutput({
      outputType: "brand_research_digest",
      title: "Daily brand research digest",
      structuredContent: { brands: [{ brandName: "Local Lift Co" }], generatedBy: "research" }
    }),
    true
  );
  assert.equal(
    shouldPublishWorkerOutput({
      outputType: "summary",
      title: "Daily brand research digest",
      structuredContent: { brands: [{ brandName: "Local Lift Co" }] }
    }),
    false
  );
  assert.equal(
    shouldClaimShippedActivity({ outputType: "summary" }, "Daily brand research digest"),
    false
  );
  assert.match(
    formatMaraActivityDescription("worker_output_created", "Daily brand research digest", "Daily brand research digest", {
      outputType: "summary"
    }),
    /not a customer deliverable/i
  );
  assert.match(
    formatMaraActivityDescription("worker_output_created", "Daily brand research digest", "Daily brand research digest", {
      outputType: "brand_research_digest",
      generatedBy: "research"
    }),
    /I shipped Daily brand research digest/i
  );
});
