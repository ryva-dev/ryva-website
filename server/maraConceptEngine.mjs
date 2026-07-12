/**
 * Creative taxonomy + concept-gap engine with deduplication.
 */
import { createHash, randomUUID } from "node:crypto";
import { EVIDENCE_KINDS } from "./maraEvidence.mjs";

export const CREATIVE_TAXONOMY_FIELDS = [
  "persona",
  "awarenessStage",
  "pain",
  "desire",
  "objection",
  "messagingAngle",
  "hookMechanism",
  "visualFormat",
  "proofMechanism",
  "offer",
  "cta",
  "editingPattern",
  "creatorDeliveryStyle",
  "productDemonstrationStyle",
  "contentPurpose"
];

export function conceptSignature(concept) {
  const key = CREATIVE_TAXONOMY_FIELDS.map((field) => String(concept?.[field] || "").toLowerCase().trim()).join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}

export function conceptsAreNearDuplicates(a, b) {
  if (!a || !b) return false;
  if (conceptSignature(a) === conceptSignature(b)) return true;
  const shared = CREATIVE_TAXONOMY_FIELDS.filter((field) => {
    const left = String(a[field] || "").toLowerCase();
    const right = String(b[field] || "").toLowerCase();
    return left && right && left === right;
  });
  return shared.length >= 5;
}

export function buildConceptFromGap({
  creatorProfile,
  brandName,
  product = null,
  observedLandscape = {},
  thesis = null,
  evidenceIds = []
}) {
  const persona =
    observedLandscape.personas?.[0] && creatorProfile?.creative?.authorityAreas?.[0]
      ? `underserved ${creatorProfile.creative.authorityAreas[0]} buyer`
      : creatorProfile?.business?.currentNiches?.[0] || "first-time buyer";
  const format = creatorProfile?.creative?.strongestFormats?.[0] || "talking-head-demo";
  const concept = {
    targetPersona: persona,
    awarenessStage: "problem_aware",
    pain: thesis || "Friction starting with the product category",
    desire: "Clear, believable before/after or routine confidence",
    objection: "Looks hard / not for people like me",
    messagingAngle: thesis || `${brandName} for ${persona}`,
    hookMechanism: "specific_mistake_or_barrier",
    visualFormat: format,
    proofMechanism: "demonstration",
    offer: null,
    cta: "soft_brand_consideration",
    editingPattern: "hook_demo_proof_cta",
    creatorDeliveryStyle: creatorProfile?.creative?.deliveryStyles?.[0] || "natural_first_person",
    productDemonstrationStyle: creatorProfile?.creative?.demonstrationAbility || "hands_on",
    contentPurpose: "paid_or_organic_ugc",
    strategicRationale: `Combine creator strength (${format}) with an underrepresented angle for ${brandName}.`,
    directEvidenceIds: evidenceIds,
    inference: "Brand creative landscape may under-index this persona/use case based on available observations.",
    hypothesis: thesis
      ? `If ${brandName} lacks this angle in observed creative, the creator can credibly fill it.`
      : "Gap remains a hypothesis until advertising observations are available.",
    creatorFitExplanation: creatorProfile?.creative?.authenticProductCategories?.length
      ? `Creator has authentic relevance in: ${creatorProfile.creative.authenticProductCategories.join(", ")}`
      : "Creator niche alignment comes from onboarding preferences; portfolio proof should be attached.",
    hookOptions: [
      `The ${persona} mistake I made before finding a routine that stuck`,
      `What nobody tells beginners about ${product || "this category"}`
    ],
    visualOpening: "Open on the friction, then the product in-use within 2 seconds",
    storyStructure: ["hook", "problem", "demo", "proof", "cta"],
    productDemonstration: product ? `Show ${product} in a realistic routine step` : "Show product in-use early",
    proof: "Specific sensory or routine detail the creator can honestly claim",
    shotList: ["hook close-up", "product intro", "demo beat", "result beat", "end card"],
    bRoll: ["hands + product", "environment texture"],
    onScreenText: ["Specific problem", "One clear benefit", "Soft CTA"],
    deliveryNotes: "Keep claims limited to creator experience; no medical/financial guarantees.",
    editingNotes: "Cut dead air; product visible by second 2.",
    platform: creatorProfile?.business?.activePlatforms?.[0] || "tiktok",
    alternativeVariants: ["voiceover-led", "duet-style myth vs reality"],
    brandSafetyConcerns: creatorProfile?.creative?.claimsWillNotMake || [],
    noveltyAssessment: observedLandscape.evidenceCount ? "differentiated_vs_observed" : "hypothesis_pending_ad_landscape"
  };
  return { ...concept, signature: conceptSignature(concept) };
}

export async function saveConceptIfNovel(store, { userId, workerId, opportunityId, publicBrandId, concept }) {
  const signature = concept.signature || conceptSignature(concept);
  const existing = await store.query(
    `SELECT id, concept_json AS "conceptJson" FROM mara_creative_concepts
     WHERE user_id = ? AND worker_id = ? AND (opportunity_id = ? OR public_brand_id = ?)
     ORDER BY created_at DESC LIMIT 20`,
    userId,
    workerId,
    opportunityId || null,
    publicBrandId || null
  );
  const parse = (value) => {
    if (value && typeof value === "object") return value;
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  };
  for (const row of existing) {
    if (conceptsAreNearDuplicates(concept, parse(row.conceptJson))) {
      return { id: row.id, deduplicated: true, concept: parse(row.conceptJson) };
    }
  }
  const now = new Date().toISOString();
  const id = randomUUID();
  try {
    await store.execute(
      `INSERT INTO mara_creative_concepts
        (id, user_id, worker_id, opportunity_id, public_brand_id, signature, concept_json, evidence_ids_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      id,
      userId,
      workerId,
      opportunityId || null,
      publicBrandId || null,
      signature,
      JSON.stringify(concept),
      JSON.stringify(concept.directEvidenceIds || []),
      now,
      now
    );
  } catch (error) {
    if (String(error?.message || error).includes("UNIQUE")) {
      const row = await store.queryOne(
        `SELECT id, concept_json AS "conceptJson" FROM mara_creative_concepts
         WHERE user_id = ? AND worker_id = ? AND signature = ?`,
        userId,
        workerId,
        signature
      );
      return { id: row?.id, deduplicated: true, concept: parse(row?.conceptJson) };
    }
    throw error;
  }
  return { id, deduplicated: false, concept };
}

export async function listCreativeConcepts(store, userId, workerId, { opportunityId = null, publicBrandId = null, limit = 20 } = {}) {
  const capped = Math.max(1, Math.min(50, Number(limit) || 20));
  let rows;
  if (opportunityId && publicBrandId) {
    rows = await store.query(
      `SELECT id, opportunity_id AS "opportunityId", public_brand_id AS "publicBrandId",
              concept_json AS "conceptJson", signature, status, created_at AS "createdAt"
       FROM mara_creative_concepts
       WHERE user_id = ? AND worker_id = ? AND (opportunity_id = ? OR public_brand_id = ?)
       ORDER BY created_at DESC LIMIT ?`,
      userId,
      workerId,
      opportunityId,
      publicBrandId,
      capped
    );
  } else if (opportunityId) {
    rows = await store.query(
      `SELECT id, opportunity_id AS "opportunityId", public_brand_id AS "publicBrandId",
              concept_json AS "conceptJson", signature, status, created_at AS "createdAt"
       FROM mara_creative_concepts
       WHERE user_id = ? AND worker_id = ? AND opportunity_id = ?
       ORDER BY created_at DESC LIMIT ?`,
      userId,
      workerId,
      opportunityId,
      capped
    );
  } else if (publicBrandId) {
    rows = await store.query(
      `SELECT id, opportunity_id AS "opportunityId", public_brand_id AS "publicBrandId",
              concept_json AS "conceptJson", signature, status, created_at AS "createdAt"
       FROM mara_creative_concepts
       WHERE user_id = ? AND worker_id = ? AND public_brand_id = ?
       ORDER BY created_at DESC LIMIT ?`,
      userId,
      workerId,
      publicBrandId,
      capped
    );
  } else {
    rows = await store.query(
      `SELECT id, opportunity_id AS "opportunityId", public_brand_id AS "publicBrandId",
              concept_json AS "conceptJson", signature, status, created_at AS "createdAt"
       FROM mara_creative_concepts
       WHERE user_id = ? AND worker_id = ?
       ORDER BY created_at DESC LIMIT ?`,
      userId,
      workerId,
      capped
    );
  }
  const parse = (value) => {
    if (value && typeof value === "object") return value;
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  };
  return rows.map((row) => ({ ...row, concept: parse(row.conceptJson) }));
}

export function markHypothesisClearly(text) {
  const body = String(text || "").trim();
  if (!body) return body;
  if (/^(hypothesis|appears|may|might|could|inferred)/i.test(body)) return body;
  return `Hypothesis: ${body}`;
}

export { EVIDENCE_KINDS };
