import test from "node:test";
import assert from "node:assert/strict";
import {
  extractGmailBodyText,
  inferMissingCampaignFields,
  parseBrandEmailHeuristic
} from "./maraInboxParser.mjs";

test("extractGmailBodyText prefers plain text parts", () => {
  const body = extractGmailBodyText({
    mimeType: "multipart/alternative",
    parts: [
      {
        mimeType: "text/plain",
        body: { data: Buffer.from("Hi team,\n\nPlease send 2 TikTok videos by Friday.").toString("base64") }
      },
      {
        mimeType: "text/html",
        body: { data: Buffer.from("<p>ignored</p>").toString("base64") }
      }
    ]
  });

  assert.match(body, /2 TikTok videos/i);
});

test("parseBrandEmailHeuristic extracts deliverables and missing payment", () => {
  const parsed = parseBrandEmailHeuristic({
    brandName: "Glow Theory",
    bodyText: "Sharing the August routine brief. Need 2 TikTok videos and 1 Instagram Reel by 2026-08-12. Usage rights for paid social are still TBD.",
    subject: "Glow Theory UGC brief",
    threadStatus: "awaiting_reply",
    urgency: "high"
  });

  assert.equal(parsed.category, "campaign_brief");
  assert.ok(parsed.deliverables.some((item) => /TikTok/i.test(item)));
  assert.ok(parsed.missingFields.includes("payment_amount_missing"));
  assert.ok(parsed.missingFields.includes("usage_rights_unclear"));
  assert.ok(parsed.riskFlags.includes("urgent_thread"));
});

test("inferMissingCampaignFields flags raw footage and missing deadlines", () => {
  const result = inferMissingCampaignFields({
    deliverables: [],
    draftDueDate: null,
    finalDueDate: null,
    paymentAmount: "",
    usageRights: "",
    usageRightsStatus: "unclear",
    rawFootageRequired: true,
    urgency: "medium"
  });

  assert.deepEqual(result.missingFields, [
    "deliverables_missing",
    "deadline_missing",
    "payment_amount_missing",
    "usage_rights_unclear"
  ]);
  assert.ok(result.riskFlags.includes("raw_footage_requested"));
  assert.ok(result.riskFlags.includes("usage_rights_unclear"));
});
