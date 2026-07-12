/**
 * Secure UGC video upload + async analysis pipeline (provider-agnostic).
 */
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { enqueueJob } from "./jobQueue.mjs";

export const VIDEO_CONTENT_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const MAX_VIDEO_BYTES = Number.parseInt(process.env.MARA_VIDEO_MAX_BYTES ?? String(80 * 1024 * 1024), 10);
const MAX_DURATION_SECONDS = Number.parseInt(process.env.MARA_VIDEO_MAX_DURATION_SECONDS ?? "180", 10);

const MP4_FTYP = Buffer.from("ftyp");
const WEBM_EBML = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

export function detectVideoMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer.subarray(4, 8).equals(MP4_FTYP)) return "video/mp4";
  if (buffer.subarray(0, 4).equals(WEBM_EBML)) return "video/webm";
  // QuickTime/MOV often shares ftyp with qt/isom brands
  const brand = buffer.subarray(8, 12).toString("ascii");
  if (buffer.subarray(4, 8).equals(MP4_FTYP) && /qt|isom|mp41|mp42|avc1/i.test(brand)) {
    return brand.includes("qt") ? "video/quicktime" : "video/mp4";
  }
  return null;
}

export function validateVideoUpload({ name, type, body, maxBytes = MAX_VIDEO_BYTES }) {
  const fileName = String(name ?? "").trim();
  if (!fileName || fileName !== path.basename(fileName) || fileName.length > 180) {
    throw new Error("File name is invalid.");
  }
  if (!Buffer.isBuffer(body) || body.length === 0) throw new Error("Video body is required.");
  if (body.length > maxBytes) throw new Error(`Video exceeds max size of ${maxBytes} bytes.`);
  const detected = detectVideoMime(body);
  if (!detected || !VIDEO_CONTENT_TYPES.has(detected)) {
    throw new Error("Unsupported or unverifiable video type. Allowed: MP4, WebM, MOV.");
  }
  const declared = String(type || "").toLowerCase();
  if (declared && declared !== detected && !(declared === "video/quicktime" && detected === "video/mp4")) {
    // Allow minor declared/detected mismatch only for mov/mp4 family already handled; else reject.
    if (!(declared === "video/mp4" && detected === "video/quicktime")) {
      throw new Error(`Declared type ${declared} does not match file content (${detected}).`);
    }
  }
  return { contentType: detected, fileName, byteSize: body.length };
}

/** Hook for malware scanning — default no-op pass; replace in production. */
export async function scanMediaForMalware(_buffer, _meta) {
  if (process.env.MARA_MEDIA_SCANNER === "fail") {
    return { ok: false, reason: "scanner_rejected" };
  }
  return { ok: true, scanner: process.env.MARA_MEDIA_SCANNER || "noop" };
}

export function createMockTranscriptionProvider() {
  return {
    name: "mock_transcription",
    async transcribe({ durationSeconds = 15 } = {}) {
      return {
        provider: "mock_transcription",
        transcript: [
          { start: 0, end: 2.2, text: "Okay so the thing that actually helped my barrier was consistency." },
          { start: 2.2, end: 5.5, text: "I apply a pea-sized amount after cleansing — no complicated routine." },
          { start: Math.max(6, durationSeconds - 3), end: durationSeconds, text: "If you try it, start slow and see how your skin responds." }
        ],
        confidence: 0.55,
        note: "Mock provider — replace with Whisper/Deepgram/etc via MARA_TRANSCRIPTION_PROVIDER."
      };
    }
  };
}

export function createMockMultimodalProvider() {
  return {
    name: "mock_multimodal",
    async analyzeTimeline({ transcript = [] } = {}) {
      const feedback = [
        {
          start_seconds: 0,
          end_seconds: 1.4,
          observation: "The opening contains speech but the product is not yet visually clear.",
          likely_consequence: "Viewers may not understand what is being demonstrated.",
          recommended_change: "Show the product in-frame within the first 1–2 seconds or pair the first line with on-screen product text.",
          evidence_type: "model_judgment",
          confidence: 0.72
        }
      ];
      if (transcript[1]) {
        feedback.push({
          start_seconds: transcript[1].start,
          end_seconds: transcript[1].end,
          observation: "Demonstration language appears mid-clip.",
          likely_consequence: "This is useful proof if the product is visible here.",
          recommended_change: "Keep hands + product readable; avoid claims beyond personal experience.",
          evidence_type: "model_judgment",
          confidence: 0.64
        });
      }
      return {
        provider: "mock_multimodal",
        strategic: {
          intendedPersona: "barrier-concerned beginner",
          awarenessStage: "problem_aware",
          messagingAngle: "simple consistency over complicated routines",
          hookMechanism: "relatable barrier friction",
          proofMechanism: "personal demonstration",
          cta: "soft consideration",
          judgmentNote: "Strategic fields are model judgments, not observed platform metrics."
        },
        execution: {
          openingClarity: "mixed",
          productVisibility: "unknown_without_frames",
          claimRisks: ["Avoid medical outcome guarantees"]
        },
        timestampedFeedback: feedback
      };
    }
  };
}

export function getTranscriptionProvider() {
  const name = String(process.env.MARA_TRANSCRIPTION_PROVIDER || "mock").toLowerCase();
  if (name === "mock") return createMockTranscriptionProvider();
  // Future: whisper, deepgram adapters
  return createMockTranscriptionProvider();
}

export function getMultimodalProvider() {
  const name = String(process.env.MARA_MULTIMODAL_PROVIDER || "mock").toLowerCase();
  if (name === "mock") return createMockMultimodalProvider();
  return createMockMultimodalProvider();
}

export async function registerMediaAsset(store, {
  userId,
  workerId,
  storageKey,
  contentType,
  byteSize,
  fileId = null,
  durationSeconds = null,
  metadata = {}
}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  await store.execute(
    `INSERT INTO mara_media_assets
      (id, user_id, worker_id, file_id, storage_key, content_type, byte_size, duration_seconds, status, processing_error, metadata_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', NULL, ?, ?, ?)`,
    id,
    userId,
    workerId,
    fileId,
    storageKey,
    contentType,
    byteSize,
    durationSeconds,
    JSON.stringify(metadata),
    now,
    now
  );
  return id;
}

export async function enqueueVideoAnalysis(store, { userId, workerId, mediaAssetId }) {
  const analysisId = randomUUID();
  const now = new Date().toISOString();
  await store.execute(
    `INSERT INTO mara_video_analyses
      (id, user_id, worker_id, media_asset_id, status, analysis_json, timeline_json, evidence_json, provider_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'queued', '{}', '[]', '[]', '{}', ?, ?)`,
    analysisId,
    userId,
    workerId,
    mediaAssetId,
    now,
    now
  );
  await store.execute(
    `UPDATE mara_media_assets SET status = 'processing', updated_at = ? WHERE id = ? AND user_id = ?`,
    now,
    mediaAssetId,
    userId
  );
  await enqueueJob(store, {
    kind: "mara_video_analysis",
    userId,
    workerId,
    payload: { analysisId, mediaAssetId },
    idempotencyKey: `mara_video_analysis:${mediaAssetId}`
  });
  return analysisId;
}

export async function processVideoAnalysisJob(store, { analysisId, mediaAssetId, userId, workerId }) {
  const now = new Date().toISOString();
  const asset = await store.queryOne(
    `SELECT * FROM mara_media_assets WHERE id = ? AND user_id = ? AND worker_id = ?`,
    mediaAssetId,
    userId,
    workerId
  );
  if (!asset) throw new Error("Media asset not found for tenant.");

  try {
    const durationSeconds = Number(asset.duration_seconds || 15);
    if (durationSeconds > MAX_DURATION_SECONDS) {
      throw new Error(`Video duration exceeds limit of ${MAX_DURATION_SECONDS}s.`);
    }
    const transcription = await getTranscriptionProvider().transcribe({ durationSeconds });
    const multimodal = await getMultimodalProvider().analyzeTimeline({ transcript: transcription.transcript });
    const analysis = {
      durationSeconds,
      transcript: transcription.transcript,
      technical: {
        contentType: asset.content_type,
        byteSize: asset.byte_size,
        note: "Frame sampling/OCR not available without media decode provider."
      },
      strategic: multimodal.strategic,
      execution: multimodal.execution,
      timestampedFeedback: multimodal.timestampedFeedback,
      confidence: Math.round(((transcription.confidence || 0.5) + 0.6) * 50),
      unknowns: ["frame_ocr", "true_scene_boundaries", "platform_performance_metrics"]
    };
    await store.execute(
      `UPDATE mara_video_analyses
       SET status = 'completed', analysis_json = ?, timeline_json = ?, provider_json = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      JSON.stringify(analysis),
      JSON.stringify(multimodal.timestampedFeedback),
      JSON.stringify({ transcription: transcription.provider, multimodal: multimodal.provider }),
      now,
      analysisId,
      userId
    );
    await store.execute(
      `UPDATE mara_media_assets SET status = 'analyzed', updated_at = ? WHERE id = ?`,
      now,
      mediaAssetId
    );
    return { status: "completed", analysisId };
  } catch (error) {
    await store.execute(
      `UPDATE mara_video_analyses SET status = 'failed', updated_at = ?, analysis_json = ? WHERE id = ? AND user_id = ?`,
      now,
      JSON.stringify({ error: String(error?.message || error) }),
      analysisId,
      userId
    );
    await store.execute(
      `UPDATE mara_media_assets SET status = 'failed', processing_error = ?, updated_at = ? WHERE id = ?`,
      String(error?.message || error),
      now,
      mediaAssetId
    );
    throw error;
  }
}

export function buildTenantMediaKey(userId, fileName) {
  const safe = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const hash = createHash("sha256").update(`${userId}:${safe}:${Date.now()}`).digest("hex").slice(0, 16);
  return `tenant-uploads/${userId}/mara-media/${hash}-${safe}`;
}

export { MAX_VIDEO_BYTES, MAX_DURATION_SECONDS };
