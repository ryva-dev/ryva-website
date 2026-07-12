import assert from "node:assert/strict";
import test from "node:test";
import { createStore } from "./dataStore.mjs";
import { buildOpportunityPackage, getRevenueInfluenceMetrics, initMaraIntelligence, listCreativeAnalyses, recordCommercialOutcome, saveBrandProfile, saveCreatorBrandOpportunity, saveCreativeAnalysis, scoreCreatorBrandOpportunity } from "./maraIntelligence.mjs";

test("brand ranking is creator-specific and weighted toward strategic fit", () => {
  assert.deepEqual(scoreCreatorBrandOpportunity({ creatorFit: 90, commercialPotential: 80, opportunityGap: 70, outreachLikelihood: 60 }), {
    dimensions: { creatorFit: 90, commercialPotential: 80, opportunityGap: 70, outreachLikelihood: 60 }, total: 78
  });
});

test("opportunity packages require labeled evidence and expose the recommendation basis", () => {
  const result = buildOpportunityPackage({
    scores: { creatorFit: 92, commercialPotential: 85, opportunityGap: 88, outreachLikelihood: 70 },
    opportunityThesis: "Creator credibility fills an observable beginner-persona gap.",
    creativeGap: "Beginner barrier-repair education",
    evidence: [
      { basis: "observed", claim: "The brand is actively promoting barrier repair.", confidence: 95 },
      { basis: "creator_preference", claim: "Educational first-person work is the creator's strongest format.", confidence: 85 },
      { basis: "hypothesis", claim: "A mistake-led hook is worth testing.", confidence: 45 }
    ]
  });
  assert.equal(result.score.total, 86);
  assert.equal(result.evidence[2].basis, "hypothesis");
  assert.equal(result.confidence, 75);
});

test("commercial outcomes calculate revenue-influenced North Star metrics", async () => {
  const store = createStore({ databasePath: ":memory:" });
  await initMaraIntelligence(store);
  const brand = await saveBrandProfile(store, {
    brandKey: "brand-x", brandName: "Brand X", profile: { priorityProducts: ["Barrier Cream"] },
    evidence: [{ basis: "observed", claim: "Active product page", sourceUrl: "https://example.com/product" }]
  });
  const opportunity = await saveCreatorBrandOpportunity(store, {
    userId: "creator-1", workerId: "mara-vale", brandProfileId: brand.id,
    scores: { creatorFit: 90, commercialPotential: 80, opportunityGap: 85, outreachLikelihood: 75 },
    opportunityThesis: "Strong strategic fit", creativeGap: "Beginner education",
    evidence: [{ basis: "observed", claim: "Current ads omit beginners." }]
  });
  await recordCommercialOutcome(store, { userId: "creator-1", workerId: "mara-vale", opportunityId: opportunity.id, contacted: true, responded: true, conceptAccepted: true, hired: true, revenueAmount: 1200 });
  const metrics = await getRevenueInfluenceMetrics(store, "creator-1", "mara-vale");
  assert.equal(metrics.revenueInfluenced, 1200);
  assert.equal(metrics.pitchToDealConversion, 1);
  await assert.rejects(
    recordCommercialOutcome(store, { userId: "other-creator", workerId: "mara-vale", opportunityId: opportunity.id, contacted: true }),
    /not found for this creator/
  );
  await store.close();
});

test("creative analysis stores timestamped consequences and remains tenant scoped", async () => {
  const store = createStore({ databasePath: ":memory:" });
  await initMaraIntelligence(store);
  await saveCreativeAnalysis(store, {
    userId: "creator-1", workerId: "mara-vale", assetType: "rough_cut", assetRef: "video-1",
    analysis: {
      assetSummary: "Barrier cream rough cut",
      videoStructure: { firstVisibleFrame: "Creator holding product", productAppearsAt: "00:00" },
      creativeStrategy: { persona: "Skincare beginner", hookMechanism: "Mistake-led" },
      performanceMechanics: { curiosityGap: true, proof: "Texture demonstration" },
      execution: { naturalness: "Strong", captionReadability: "Needs larger text" },
      timestampedFeedback: [{ at: "00:02", observation: "Speech repeats the on-screen title.", consequence: "The opening spends two seconds without adding a reason to continue.", revision: "Replace the spoken line with the viewer's likely objection." }],
      unknowns: ["No retention curve was supplied."]
    },
    evidence: [{ basis: "observed", claim: "The first spoken line duplicates the title.", confidence: 95 }]
  });
  assert.equal((await listCreativeAnalyses(store, "creator-1", "mara-vale"))[0].analysis.timestampedFeedback[0].at, "00:02");
  assert.equal((await listCreativeAnalyses(store, "creator-2", "mara-vale")).length, 0);
  await assert.rejects(
    saveCreativeAnalysis(store, { userId: "creator-1", workerId: "mara-vale", assetType: "rough_cut", assetRef: "bad", analysis: { timestampedFeedback: [] }, evidence: [{ basis: "observed", claim: "Anything" }] }),
    /timestamped feedback/
  );
  await store.close();
});
