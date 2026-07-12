/**
 * Tenant-specific learning from commercial outcomes — never cross-tenant.
 */
import { randomUUID } from "node:crypto";

function nowIso() {
  return new Date().toISOString();
}

function parseJson(value, fallback) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function defaultLearningState() {
  return {
    brandFitWeights: {
      creatorFit: 1,
      commercialPotential: 1,
      creativeOpportunity: 1,
      outreachFeasibility: 1,
      riskAdjustment: 1
    },
    preferredPitchLength: "short",
    preferredPitchStructure: "concept_led",
    followUpCadenceDays: [3, 7, 14],
    contactRolePreference: ["partnership_email", "creator_program_submission"],
    riskSensitivity: "medium",
    corrections: [],
    updatedAt: null
  };
}

export async function ensureLearningSchema(store) {
  await store.execute(`
    CREATE TABLE IF NOT EXISTS mara_creator_learning_state (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, worker_id)
    )
  `);
}

export async function getCreatorLearningState(store, userId, workerId) {
  await ensureLearningSchema(store);
  const row = await store.queryOne(
    `SELECT state_json AS "stateJson" FROM mara_creator_learning_state WHERE user_id = ? AND worker_id = ?`,
    userId,
    workerId
  );
  return { ...defaultLearningState(), ...parseJson(row?.stateJson, {}) };
}

export async function saveCreatorLearningState(store, userId, workerId, state) {
  await ensureLearningSchema(store);
  const now = nowIso();
  const existing = await store.queryOne(
    `SELECT id FROM mara_creator_learning_state WHERE user_id = ? AND worker_id = ?`,
    userId,
    workerId
  );
  const payload = { ...defaultLearningState(), ...state, updatedAt: now };
  if (existing?.id) {
    await store.execute(
      `UPDATE mara_creator_learning_state SET state_json = ?, updated_at = ? WHERE id = ?`,
      JSON.stringify(payload),
      now,
      existing.id
    );
    return payload;
  }
  await store.execute(
    `INSERT INTO mara_creator_learning_state (id, user_id, worker_id, state_json, updated_at) VALUES (?, ?, ?, ?, ?)`,
    randomUUID(),
    userId,
    workerId,
    JSON.stringify(payload),
    now
  );
  return payload;
}

export async function applyOutcomeToLearning(store, {
  userId,
  workerId,
  hired = false,
  declined = false,
  responded = false,
  giftedOnly = false,
  userCorrection = null
}) {
  const state = await getCreatorLearningState(store, userId, workerId);
  const weights = { ...state.brandFitWeights };

  if (hired) {
    weights.creativeOpportunity = Math.min(1.4, weights.creativeOpportunity + 0.05);
    weights.outreachFeasibility = Math.min(1.3, weights.outreachFeasibility + 0.03);
    state.preferredPitchStructure = state.preferredPitchStructure || "concept_led";
  }
  if (declined) {
    weights.riskAdjustment = Math.min(1.4, weights.riskAdjustment + 0.05);
  }
  if (responded && !hired) {
    state.preferredPitchLength = "short";
  }
  if (giftedOnly) {
    state.riskSensitivity = "high";
    state.corrections = [
      ...(state.corrections || []).slice(0, 19),
      { at: nowIso(), type: "gifted_offer", note: "Deprioritize unpaid/gifted offers for this creator." }
    ];
  }
  if (userCorrection) {
    state.corrections = [
      ...(state.corrections || []).slice(0, 19),
      { at: nowIso(), type: "user_correction", note: String(userCorrection).slice(0, 400) }
    ];
  }

  state.brandFitWeights = weights;
  return saveCreatorLearningState(store, userId, workerId, state);
}

export async function resetCreatorLearningState(store, userId, workerId) {
  return saveCreatorLearningState(store, userId, workerId, defaultLearningState());
}
