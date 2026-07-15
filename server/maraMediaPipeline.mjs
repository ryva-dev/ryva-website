/**
 * Secure UGC video upload + async analysis pipeline (provider-agnostic).
 */
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { enqueueJob } from "./jobQueue.mjs";
import * as defaultStore from "./dataStore.mjs";
import { canSpend, noteSpend } from "./llmBudget.mjs";
import { normalizeAnthropicUsage, recordModelUsage } from "./modelUsageAccounting.mjs";

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

export function createUnconfiguredTranscriptionProvider(name) {
  return {
    name,
    async transcribe() {
      throw new Error(
        `Transcription provider "${name}" is not configured. Set a real MARA_TRANSCRIPTION_PROVIDER (e.g. anthropic) or leave unset/mock only for local demos — mock results are never returned as live analysis.`
      );
    }
  };
}

export function createUnconfiguredMultimodalProvider(name) {
  return {
    name,
    async analyzeTimeline() {
      throw new Error(
        `Multimodal provider "${name}" is not configured. Set a real MARA_MULTIMODAL_PROVIDER or leave mock for demos only — mock results are never returned as live analysis.`
      );
    }
  };
}

/** Anthropic-backed transcript+timeline analysis when ANTHROPIC_API_KEY is present. */
export function createAnthropicMultimodalProvider({ fetchImpl = globalThis.fetch, usageStore = defaultStore } = {}) {
  return {
    name: "anthropic",
    async analyzeTimeline({ transcript = "", durationSeconds = 15, userId, workerId } = {}) {
      const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY is required for anthropic multimodal analysis.");
      }
      const model = String(process.env.MARA_MULTIMODAL_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514").trim();
      if (!(await canSpend(userId))) throw new Error("Daily LLM budget reached for this account.");
      const started = Date.now();
      const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model,
          max_tokens: 1200,
          system:
            "You analyze UGC rough cuts for creator-brand campaigns. Return ONLY JSON with keys: strategic, execution, timestampedFeedback (array of {at, observation, revision}), openingHookPresent (boolean), pacingNotes, missingTalkingPoints (array), complianceFlags (array). Never invent brand claims.",
          messages: [
            {
              role: "user",
              content: `DurationSeconds: ${durationSeconds}\nTranscript:\n${String(transcript || "").slice(0, 12000)}`
            }
          ]
        })
      });
      if (!response.ok) {
        await recordModelUsage(usageStore, { userId, workerId, provider: "anthropic", model, taskType: "video_timeline_analysis", requestStatus: "failure", latencyMs: Date.now() - started });
        throw new Error(`Anthropic multimodal failed with status ${response.status}`);
      }
      const payload = await response.json();
      await noteSpend(userId);
      await recordModelUsage(usageStore, { ...normalizeAnthropicUsage(payload), userId, workerId, provider: "anthropic", model, taskType: "video_timeline_analysis", requestStatus: "success", latencyMs: Date.now() - started, requestId: payload.id });
      const text = Array.isArray(payload.content)
        ? payload.content.map((part) => part.text || "").join("\n")
        : "";
      let parsed = {};
      try {
        const match = text.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : {};
      } catch {
        parsed = {};
      }
      return {
        provider: "anthropic",
        strategic: parsed.strategic || { summary: "Anthropic analysis returned unstructured text.", raw: text.slice(0, 500) },
        execution: parsed.execution || { pacingNotes: parsed.pacingNotes || null },
        timestampedFeedback: Array.isArray(parsed.timestampedFeedback) ? parsed.timestampedFeedback : [],
        openingHookPresent: Boolean(parsed.openingHookPresent),
        missingTalkingPoints: parsed.missingTalkingPoints || [],
        complianceFlags: parsed.complianceFlags || []
      };
    }
  };
}

/** OpenAI Whisper transcription — accepts mp4/webm/audio when OPENAI_API_KEY is set. */
export function createOpenAiWhisperProvider({ fetchImpl = globalThis.fetch, usageStore = defaultStore } = {}) {
  return {
    name: "openai_whisper",
    async transcribe({ durationSeconds = 15, mediaBuffer = null, fileName = "rough-cut.mp4", contentType = "video/mp4", userId, workerId } = {}) {
      const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is required for openai Whisper transcription.");
      }
      if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer) && !(mediaBuffer instanceof Uint8Array)) {
        throw new Error("openai Whisper requires the media file bytes — storage lookup failed.");
      }
      const form = new FormData();
      const blob = new Blob([mediaBuffer], { type: contentType || "video/mp4" });
      form.append("file", blob, fileName || "rough-cut.mp4");
      const model = String(process.env.OPENAI_WHISPER_MODEL || "whisper-1");
      form.append("model", model);
      form.append("response_format", "verbose_json");
      if (!(await canSpend(userId))) throw new Error("Daily LLM budget reached for this account.");
      const started = Date.now();
      const response = await fetchImpl("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form
      });
      if (!response.ok) {
        const errText = await response.text();
        await recordModelUsage(usageStore, { userId, workerId, provider: "openai", model, taskType: "video_transcription", requestStatus: "failure", latencyMs: Date.now() - started });
        throw new Error(`OpenAI Whisper failed (${response.status}): ${errText.slice(0, 200)}`);
      }
      const payload = await response.json();
      await noteSpend(userId);
      const billedDuration = Number(payload.duration || durationSeconds) || durationSeconds;
      await recordModelUsage(usageStore, {
        userId, workerId, provider: "openai", model, taskType: "video_transcription", requestStatus: "success",
        latencyMs: Date.now() - started,
        estimatedCostUsd: Number(((billedDuration / 60) * Number(process.env.OPENAI_WHISPER_USD_PER_MINUTE || .006)).toFixed(8))
      });
      const segments = Array.isArray(payload.segments) ? payload.segments : [];
      return {
        provider: "openai_whisper",
        confidence: 0.82,
        durationSeconds: Number(payload.duration || durationSeconds) || durationSeconds,
        transcript: String(payload.text || ""),
        segments: segments.map((seg) => ({
          at: Number(seg.start || 0),
          text: String(seg.text || "").trim()
        }))
      };
    }
  };
}

export function getTranscriptionProvider() {
  const name = String(process.env.MARA_TRANSCRIPTION_PROVIDER || "mock").toLowerCase();
  if (name === "mock") return createMockTranscriptionProvider();
  if (name === "openai" || name === "whisper" || name === "openai_whisper") {
    return createOpenAiWhisperProvider();
  }
  return createUnconfiguredTranscriptionProvider(name);
}

export function getMultimodalProvider() {
  const name = String(process.env.MARA_MULTIMODAL_PROVIDER || "mock").toLowerCase();
  if (name === "mock") return createMockMultimodalProvider();
  if (name === "anthropic") return createAnthropicMultimodalProvider();
  return createUnconfiguredMultimodalProvider(name);
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

function formatSecondsAsTimestamp(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Map pipeline analysis JSON into mara_creative_analyses shape
 * (required by validateCreativeAnalysis).
 */
export function mapPipelineAnalysisToCreativeIntel(analysis, { fileName = "rough cut" } = {}) {
  const strategic = analysis?.strategic || {};
  const execution = analysis?.execution || {};
  const feedback = Array.isArray(analysis?.timestampedFeedback) ? analysis.timestampedFeedback : [];
  return {
    assetSummary: `${fileName}: ${strategic.messagingAngle || "UGC rough-cut review"}`,
    videoStructure: {
      durationSeconds: analysis?.durationSeconds ?? null,
      openingClarity: execution.openingClarity || "unknown",
      productVisibility: execution.productVisibility || "unknown",
      transcriptBeatCount: Array.isArray(analysis?.transcript) ? analysis.transcript.length : 0
    },
    creativeStrategy: {
      intendedPersona: strategic.intendedPersona || null,
      awarenessStage: strategic.awarenessStage || null,
      messagingAngle: strategic.messagingAngle || null,
      hookMechanism: strategic.hookMechanism || null,
      proofMechanism: strategic.proofMechanism || null,
      cta: strategic.cta || null
    },
    performanceMechanics: {
      note: strategic.judgmentNote || "Mechanics are model judgments until platform metrics are attached.",
      unknowns: analysis?.unknowns || []
    },
    execution: {
      openingClarity: execution.openingClarity || null,
      productVisibility: execution.productVisibility || null,
      claimRisks: execution.claimRisks || [],
      technical: analysis?.technical || {}
    },
    timestampedFeedback: feedback.map((item) => ({
      at: formatSecondsAsTimestamp(item.start_seconds ?? item.start ?? 0),
      observation: String(item.observation || "").trim() || "Observation not captured.",
      consequence: String(item.likely_consequence || item.consequence || "").trim() || "Impact not captured.",
      revision: String(item.recommended_change || item.revision || "").trim() || "Revision not captured."
    })),
    unknowns: Array.isArray(analysis?.unknowns) ? analysis.unknowns : [],
    isMock: Boolean(analysis?.isMock),
    providerHonesty: analysis?.providerHonesty || null
  };
}

export async function processVideoAnalysisJob(store, { analysisId, mediaAssetId, userId, workerId, objectStorage = null }) {
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

    let mediaBuffer = null;
    const providerName = String(process.env.MARA_TRANSCRIPTION_PROVIDER || "mock").toLowerCase();
    if (providerName !== "mock" && objectStorage) {
      // Uploads store as mara-media/{basename}; storage_key is the logical tenant path.
      const key = String(asset.storage_key || "");
      const storedName = `mara-media/${path.basename(key)}`;
      try {
        mediaBuffer = await objectStorage.get({ userId, storedName });
      } catch {
        mediaBuffer = null;
      }
    }

    const transcription = await getTranscriptionProvider().transcribe({
      durationSeconds,
      mediaBuffer,
      fileName: path.basename(String(asset.storage_key || "rough-cut.mp4")),
      contentType: asset.content_type || "video/mp4",
      userId,
      workerId
    });
    const multimodal = await getMultimodalProvider().analyzeTimeline({
      transcript: transcription.transcript,
      durationSeconds: transcription.durationSeconds || durationSeconds,
      userId,
      workerId
    });
    const usingMock = transcription.provider === "mock_transcription" || multimodal.provider === "mock_multimodal";
    if (usingMock && String(process.env.MARA_REQUIRE_REAL_MEDIA || "").trim() === "1") {
      throw new Error("Real media providers required (MARA_REQUIRE_REAL_MEDIA=1); refusing mock analysis.");
    }
    const analysis = {
      durationSeconds,
      transcript: transcription.transcript,
      isMock: usingMock,
      providerHonesty: usingMock
        ? "Mock providers only — not real Whisper/CV. Do not treat as production creative QA."
        : "Real configured providers.",
      technical: {
        contentType: asset.content_type,
        byteSize: asset.byte_size,
        note: usingMock
          ? "Mock analysis path."
          : "Frame sampling/OCR limited without dedicated media decode provider."
      },
      strategic: multimodal.strategic,
      execution: multimodal.execution,
      timestampedFeedback: multimodal.timestampedFeedback,
      openingHookPresent: multimodal.openingHookPresent ?? null,
      missingTalkingPoints: multimodal.missingTalkingPoints || [],
      complianceFlags: multimodal.complianceFlags || [],
      confidence: usingMock ? Math.min(40, Math.round(((transcription.confidence || 0.5) + 0.6) * 50)) : Math.round(((transcription.confidence || 0.5) + 0.6) * 50),
      unknowns: usingMock
        ? ["mock_provider", "frame_ocr", "true_scene_boundaries", "platform_performance_metrics"]
        : ["frame_ocr", "true_scene_boundaries", "platform_performance_metrics"]
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

    // Mirror into growth-intel creative reviews so desk + weekly brief can use it.
    try {
      const { saveCreativeAnalysis } = await import("./maraIntelligence.mjs");
      const meta = typeof asset.metadata_json === "object"
        ? asset.metadata_json
        : (() => { try { return JSON.parse(asset.metadata_json || "{}"); } catch { return {}; } })();
      const fileName = meta.fileName || meta.originalName || "rough cut";
      await saveCreativeAnalysis(store, {
        userId,
        workerId,
        assetType: "rough_cut",
        assetRef: mediaAssetId,
        analysis: mapPipelineAnalysisToCreativeIntel(analysis, { fileName }),
        evidence: [
          {
            basis: "observed",
            claim: `Video analysis completed for media asset ${mediaAssetId} (${transcription.provider}).`,
            confidence: Number(analysis.confidence) || 55
          }
        ]
      });
    } catch {
      /* best-effort — pipeline row is still completed */
    }

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
