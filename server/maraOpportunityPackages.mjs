/**
 * Evidence-supported opportunity packages.
 */
import { randomUUID } from "node:crypto";
import { EVIDENCE_KINDS } from "./maraEvidence.mjs";
import { decideOpportunityAction, scoreOpportunityDimensions, SCORE_VERSION } from "./maraOpportunityScoring.mjs";
import { savePublicBrand, saveTenantEvidence, projectOpportunityToWorkerBrand, officeFitScoreFromCanonical } from "./maraBrandCanonical.mjs";

function unknown(field) {
  return { [field]: null, [`${field}Status`]: "unknown" };
}

export function buildOpportunityPackageV2({
  brand,
  creatorProfile,
  evidence = [],
  adObservations = [],
  contacts = [],
  scoreDetail,
  concepts = []
}) {
  const observed = evidence.filter((item) => (item.kind || item.basis) === EVIDENCE_KINDS.OBSERVED);
  const inferred = evidence.filter((item) => (item.kind || item.basis) === EVIDENCE_KINDS.INFERENCE);
  const hypotheses = evidence.filter((item) => (item.kind || item.basis) === EVIDENCE_KINDS.HYPOTHESIS);
  const usableContact = contacts.find((contact) => Number(contact.mayUseForOutreach) === 1);

  const brandSummary = {
    whatTheySell: brand?.profile?.description || brand?.metaDescription || null,
    relevantProducts: brand?.profile?.namedProducts || [],
    creatorActivityEvidence: observed.filter((item) => /creator|ugc|ambassador|affiliate/i.test(item.claim)).map((item) => item.id),
    publicPrograms: {
      creatorProgramUrl: brand?.profile?.creatorProgramUrl || null,
      affiliateProgramUrl: brand?.profile?.affiliateProgramUrl || null
    },
    retrievedAt: brand?.lastResearchedAt || new Date().toISOString(),
    confidence: scoreDetail?.confidence ?? 40
  };

  const creativeLandscape = {
    personas: adObservations.map((obs) => obs.observation?.persona).filter(Boolean),
    messagingAngles: adObservations.map((obs) => obs.observation?.messagingAngle).filter(Boolean),
    hooks: adObservations.map((obs) => obs.observation?.hook).filter(Boolean),
    formats: adObservations.map((obs) => obs.observation?.visualFormat).filter(Boolean),
    evidenceCount: adObservations.length,
    confidence: adObservations.length ? 55 : 15,
    note: adObservations.length
      ? "Based on available advertisement/public promo observations."
      : "No advertisement observations available from configured providers."
  };

  const opportunityThesis = {
    underrepresented: hypotheses[0]?.claim || inferred[0]?.claim || null,
    whyItCouldMatter: hypotheses[0]?.claim || null,
    creatorCredibility: creatorProfile?.creative?.authorityAreas?.[0] || creatorProfile?.business?.currentNiches?.[0] || null,
    observed: observed.map((item) => ({ id: item.id, claim: item.claim })),
    inferred: inferred.map((item) => ({ id: item.id, claim: item.claim })),
    hypotheses: hypotheses.map((item) => ({ id: item.id, claim: item.claim })),
    unknowns: [
      ...(adObservations.length ? [] : ["advertising_creative_landscape"]),
      ...(usableContact ? [] : ["verified_outreach_contact"])
    ]
  };

  const decision = decideOpportunityAction({
    total: scoreDetail?.total ?? 0,
    confidence: scoreDetail?.confidence ?? 0,
    riskScore: scoreDetail?.dimensions?.riskAdjustment?.score,
    hasContact: Boolean(usableContact),
    hasObservedSource: observed.some((item) => item.sourceUrl),
    creatorProfile,
    brandName: brand?.brand_name || brand?.brandName
  });

  return {
    version: "opportunity_package_v2",
    scoreVersion: SCORE_VERSION,
    brandSummary,
    whyCreatorFits: {
      strengths: creatorProfile?.creative?.strongestFormats || [],
      nicheFit: creatorProfile?.business?.currentNiches || [],
      portfolioEvidence: creatorProfile?.creative?.strongestPortfolioExamples || [],
      concerns: creatorProfile?.creative?.contentBoundaries || []
    },
    observedCreativeLandscape: creativeLandscape,
    opportunityThesis,
    recommendedPitchStrategy: {
      preferredContactPath: usableContact
        ? { type: usableContact.contactType, value: usableContact.value, contactId: usableContact.id }
        : null,
      pitchFraming: opportunityThesis.underrepresented || "Creator-specific product use case",
      portfolioAssets: creatorProfile?.creative?.strongestPortfolioExamples || [],
      initialAsk: creatorProfile?.commercial?.preferredDealTypes?.[0] || "paid_or_hybrid",
      followUpPlan: ["day_3", "day_7", "day_14_close"],
      cautions: usableContact ? [] : ["No outreach-ready contact yet — discover or confirm a contact before sending."]
    },
    recommendedConceptTerritory: concepts[0] || {
      ...unknown("targetPersona"),
      ...unknown("awarenessStage"),
      messagingAngle: opportunityThesis.underrepresented,
      evidenceIds: observed.map((item) => item.id).slice(0, 5)
    },
    decision: decision.decision,
    decisionReason: decision.reason,
    score: scoreDetail,
    evidence
  };
}

export async function createOrUpdateOpportunityFromResearch(store, {
  userId,
  workerId,
  brandName,
  website,
  evidence = [],
  creatorProfile = null,
  contacts = [],
  adObservations = [],
  dimensionComponents = null
}) {
  const publicBrand = await savePublicBrand(store, {
    brandName,
    website,
    description: evidence.find((item) => item.rawExcerpt)?.rawExcerpt || null
  });
  const savedEvidence = await saveTenantEvidence(store, {
    userId,
    workerId,
    publicBrandId: publicBrand.id,
    evidence
  });

  const scoreDetail =
    dimensionComponents
      ? scoreOpportunityDimensions(dimensionComponents)
      : scoreOpportunityDimensions({
          creatorFit: {
            score: creatorProfile?.business?.currentNiches?.length ? 72 : 55,
            confidence: creatorProfile ? 65 : 35,
            evidenceIds: savedEvidence.slice(0, 1).map((item) => item.id),
            notes: "Niche overlap from creator profile / research."
          },
          commercialPotential: {
            score: contacts.some((contact) => Number(contact.mayUseForOutreach) === 1) ? 68 : 48,
            confidence: 50,
            evidenceIds: savedEvidence.map((item) => item.id).slice(0, 2),
            notes: "Contact path and public program signals."
          },
          creativeOpportunity: {
            score: evidence.some((item) => (item.kind || item.basis) === EVIDENCE_KINDS.HYPOTHESIS) ? 70 : 45,
            confidence: 45,
            evidenceIds: savedEvidence.filter((item) => item.kind === EVIDENCE_KINDS.HYPOTHESIS).map((item) => item.id),
            notes: "Gap thesis present but advertising landscape may be incomplete."
          },
          outreachFeasibility: {
            score: contacts.some((contact) => Number(contact.mayUseForOutreach) === 1) ? 80 : null,
            confidence: contacts.length ? 60 : 20,
            unknown: !contacts.some((contact) => Number(contact.mayUseForOutreach) === 1),
            evidenceIds: [],
            notes: contacts.length ? "Contact candidates found." : "No outreach-ready contact."
          },
          riskAdjustment: {
            score: evidence.some((item) => /allegation|complaint|scam/i.test(item.claim)) ? 40 : 75,
            confidence: 40,
            evidenceIds: savedEvidence.filter((item) => /allegation|complaint/i.test(item.claim)).map((item) => item.id),
            notes: "Risk from public mentions only; not a finding of wrongdoing."
          }
        });

  const packageData = buildOpportunityPackageV2({
    brand: {
      ...publicBrand,
      profile: typeof publicBrand.profile_json === "object" ? publicBrand.profile_json : JSON.parse(publicBrand.profile_json || "{}"),
      lastResearchedAt: publicBrand.last_researched_at || publicBrand.lastResearchedAt,
      metaDescription: savedEvidence[0]?.rawExcerpt
    },
    creatorProfile,
    evidence: savedEvidence,
    adObservations,
    contacts,
    scoreDetail
  });

  const now = new Date().toISOString();
  const existing = await store.queryOne(
    `SELECT id, score_total AS "scoreTotal", status, lifecycle_stage AS "lifecycleStage", attribution
     FROM mara_creator_brand_opportunities
     WHERE user_id = ? AND worker_id = ? AND (public_brand_id = ? OR brand_profile_id = ?)`,
    userId,
    workerId,
    publicBrand.id,
    publicBrand.id
  );

  const { mergeResearchLifecycle, legacyStatusFromLifecycle } = await import("./maraOpportunityLifecycle.mjs");
  const { resolveAttribution, ATTRIBUTION_TYPES } = await import("./maraRevenueAttribution.mjs");
  const hasOutreachContact = contacts.some((contact) => Number(contact.mayUseForOutreach) === 1);
  const lifecycleStage = mergeResearchLifecycle({
    existingLifecycle: existing?.lifecycleStage || null,
    existingStatus: existing?.status || null,
    decision: packageData.decision,
    hasOutreachContact
  });
  const status = legacyStatusFromLifecycle(lifecycleStage);
  const attribution = resolveAttribution({
    existing: existing?.attribution || null,
    discoveredByMara: true,
    maraDraftedPitch: false
  });

  const { buildNextAction } = await import("./maraOpportunityLifecycle.mjs");
  const nextAction = buildNextAction({ lifecycleStage, hasOutreachContact });
  const contactRetryDueAt = lifecycleStage === "contact_needed"
    ? new Date(Date.now() + 72 * 3600_000).toISOString()
    : null;
  const id = existing?.id || randomUUID();
  if (existing?.id) {
    await store.execute(
      `UPDATE mara_creator_brand_opportunities
       SET status = ?, lifecycle_stage = COALESCE(lifecycle_stage, ?), score_total = ?, scores_json = ?, opportunity_package_json = ?, evidence_json = ?,
           score_version = ?, confidence = ?, public_brand_id = ?, decision = ?, decision_reason = ?,
           brand_profile_id = ?, next_action_json = ?, blocking_reason = ?,
           next_action_due_at = CASE WHEN ? IS NOT NULL THEN COALESCE(next_action_due_at, ?) ELSE NULL END,
           attribution = COALESCE(NULLIF(attribution, ''), ?),
           updated_at = ?
       WHERE id = ? AND user_id = ?`,
      status,
      lifecycleStage,
      scoreDetail.total,
      JSON.stringify(scoreDetail.dimensions),
      JSON.stringify(packageData),
      JSON.stringify(savedEvidence),
      SCORE_VERSION,
      scoreDetail.confidence,
      publicBrand.id,
      packageData.decision,
      packageData.decisionReason,
      publicBrand.id,
      JSON.stringify(nextAction),
      nextAction.blockingReason,
      contactRetryDueAt,
      contactRetryDueAt,
      attribution || ATTRIBUTION_TYPES.SOURCED_BY_MARA,
      now,
      id,
      userId
    );
    // Only bump lifecycle when research merge advances a non-terminal early stage.
    if (!existing.lifecycleStage || ["discovered", "researching", "qualified", "contact_needed"].includes(String(existing.lifecycleStage))) {
      try {
        const { transitionOpportunityStage, ensureOpportunityLifecycleSchema } = await import("./maraOpportunityStateEngine.mjs");
        await ensureOpportunityLifecycleSchema(store);
        await transitionOpportunityStage(store, {
          userId,
          workerId,
          opportunityId: id,
          toStage: lifecycleStage,
          confidence: scoreDetail.confidence,
          evidence: savedEvidence.slice(0, 5).map((item) => ({ id: item.id, claim: item.claim })),
          source: "research_refresh",
          reason: `Research decision: ${packageData.decision}`,
          force: true
        });
      } catch {
        /* schema may not be ready in unit tests without init */
      }
    }
    await store.execute(
      `INSERT INTO mara_score_change_log
        (id, user_id, worker_id, opportunity_id, score_version, previous_total, next_total, reason, evidence_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      userId,
      workerId,
      id,
      SCORE_VERSION,
      existing.scoreTotal ?? null,
      scoreDetail.total,
      "research_refresh",
      JSON.stringify(savedEvidence.map((item) => item.id)),
      now
    );
  } else {
    await store.execute(
      `INSERT INTO mara_creator_brand_opportunities
        (id, user_id, worker_id, brand_profile_id, status, score_total, scores_json, opportunity_package_json,
         evidence_json, created_at, updated_at, score_version, confidence, public_brand_id, decision, decision_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      userId,
      workerId,
      publicBrand.id,
      status,
      scoreDetail.total,
      JSON.stringify(scoreDetail.dimensions),
      JSON.stringify(packageData),
      JSON.stringify(savedEvidence),
      now,
      now,
      SCORE_VERSION,
      scoreDetail.confidence,
      publicBrand.id,
      packageData.decision,
      packageData.decisionReason
    );
    try {
      await store.execute(
        `UPDATE mara_creator_brand_opportunities
         SET lifecycle_stage = ?, stage_changed_at = ?, next_action_json = ?, blocking_reason = ?,
             next_action_due_at = ?, attribution = ?
         WHERE id = ?`,
        lifecycleStage,
        now,
        JSON.stringify(nextAction),
        nextAction.blockingReason,
        contactRetryDueAt,
        ATTRIBUTION_TYPES.SOURCED_BY_MARA,
        id
      );
    } catch {
      /* columns may be absent until migration/init */
    }
  }

  await projectOpportunityToWorkerBrand(store, {
    userId,
    workerId,
    brandName,
    website,
    opportunity: { opportunityPackage: packageData, opportunityThesis: packageData.opportunityThesis?.underrepresented }
  });

  // Keep office projection aligned to canonical score (no alternate weights).
  const officeScores = officeFitScoreFromCanonical(scoreDetail.total, scoreDetail.confidence);
  const officeExisting = await store.queryOne(
    `SELECT id FROM office_brand_opportunities WHERE user_id = ? AND worker_slug = ? AND brand_name = ?`,
    userId,
    workerId,
    brandName
  ).catch(() => null);
  if (officeExisting?.id) {
    await store.execute(
      `UPDATE office_brand_opportunities SET fit_score = ?, notes = ?, updated_at = ? WHERE id = ?`,
      officeScores.fitScore,
      `scoreVersion=${officeScores.scoreVersion}; confidence=${officeScores.confidence}`,
      now,
      officeExisting.id
    ).catch(() => null);
  }

  return { id, publicBrandId: publicBrand.id, package: packageData, score: scoreDetail, evidence: savedEvidence };
}
