import assert from "node:assert/strict";
import test from "node:test";
import { deriveMaraActivationJourney } from "./maraActivationJourney.mjs";

test("activation journey advances only from commercial evidence", () => {
  const journey = deriveMaraActivationJourney({
    onboardingComplete: true, gmailConnected: true, opportunityCount: 3,
    verifiedContactCount: 1, pitchCount: 1, sentCount: 0, replyCount: 4,
    wonCount: 2, revenueRecorded: 900
  });
  assert.equal(journey.completedCount, 7);
  assert.equal(journey.nextMilestone.id, "sent");
  assert.equal(journey.milestones.find((item) => item.id === "reply").complete, true);
  assert.equal(journey.progress, 7 / 8);
});

test("activation journey does not treat onboarding alone as ready", () => {
  const journey = deriveMaraActivationJourney({ onboardingComplete: true, gmailConnected: false });
  assert.equal(journey.completedCount, 0);
  assert.equal(journey.nextMilestone.id, "ready");
});
