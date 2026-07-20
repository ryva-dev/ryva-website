import type { AppConfig } from "../../../packages/config/src/index.js";
import type {
  AiProvider,
  AiProviderOutput,
  AiUseCase,
  AiContextItem
} from "../../../packages/domain/src/index.js";
import { AppError } from "../../../packages/shared/src/index.js";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export type CheckoutResult = { url: string };

export interface BillingProvider {
  createCheckout(input: {
    userId: string;
    email: string;
    returnUrl: string;
  }): Promise<CheckoutResult>;
  createPortal(input: { customerId: string; returnUrl: string }): Promise<CheckoutResult>;
}

export interface CredentialProvider {
  refresh(providerReference: string): Promise<unknown>;
}

export type IntelligenceCandidate = {
  metricCode: string;
  value: unknown;
  observedAt: string;
  sourceReference: string;
  geography?: string | undefined;
  acquisitionContext: string;
  limitations: string;
};

export interface IntelligenceProvider {
  research(input: {
    subjectType: "product" | "brand" | "business" | "contact";
    externalReference: string;
  }): Promise<IntelligenceCandidate[]>;
}

export type EmailSendResult = {
  status: "accepted" | "uncertain" | "rejected";
  providerMessageId?: string | undefined;
  safeDetail?: string | undefined;
};

export interface EmailProvider {
  send(input: {
    idempotencyKey: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    headers: Record<string, string>;
  }): Promise<EmailSendResult>;
}

const aiOutputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  content: z.string().trim().min(1).max(50_000),
  structuredPayload: z.record(z.string(), z.unknown()).optional(),
  confidence: z.enum(["insufficient","limited","supported","strong"]),
  confidenceSubject: z.string().trim().min(1).max(500),
  limitations: z.array(z.string().trim().min(1).max(2_000)).max(50),
  missingEvidence: z.array(z.string().trim().min(1).max(2_000)).max(50),
  contraryEvidence: z.array(z.string().trim().min(1).max(2_000)).max(50),
  statements: z.array(z.object({
    text: z.string().trim().min(1).max(5_000),
    classification: z.enum([
      "verified_fact","direct_evidence","strong_proxy","weak_proxy",
      "estimate","model_inference","unknown"
    ]),
    confidence: z.enum(["insufficient","limited","supported","strong"]),
    citationOrdinals: z.array(z.number().int().positive()).max(50)
  })).min(1).max(100),
  usage: z.object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    costMinorUnits: z.number().int().nonnegative().optional(),
    costCurrency: z.string().regex(/^[A-Z]{3}$/).optional()
  }).optional()
});

export class ConfiguredAiProvider implements AiProvider {
  constructor(private readonly configuration: AppConfig) {}

  metadata() {
    return {
      provider: this.configuration.AI_PROVIDER_URL
        ? new URL(this.configuration.AI_PROVIDER_URL).hostname
        : "unconfigured",
      model: this.configuration.AI_MODEL,
      modelVersion: this.configuration.AI_MODEL_VERSION,
      retentionMode: this.configuration.AI_PROVIDER_RETENTION_MODE,
      trainingAllowed: false as const,
      configured: Boolean(
        this.configuration.AI_GENERATION_ENABLED &&
        this.configuration.AI_PROVIDER_URL &&
        this.configuration.AI_PROVIDER_TOKEN
      )
    };
  }

  async generate(input: {
    useCase: AiUseCase;
    policy: string;
    instruction: string;
    context: AiContextItem[];
    outputSchemaVersion: "ryva-ai-suggestion-v1";
    attachment?: {
      name: string;
      mediaType: string;
      sha256: string;
      contentBase64: string;
    } | undefined;
  }): Promise<AiProviderOutput> {
    if (!this.metadata().configured) {
      throw new AppError(
        503,
        "ai_provider_unavailable",
        "AI is not configured. Manual workflows remain available."
      );
    }
    const response = await fetch(new URL("/generate", this.configuration.AI_PROVIDER_URL), {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.configuration.AI_PROVIDER_TOKEN}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ...input,
        tools: [],
        providerPolicy: {
          retentionMode: this.configuration.AI_PROVIDER_RETENTION_MODE,
          trainingAllowed: false
        }
      }),
      signal: AbortSignal.timeout(this.configuration.AI_TIMEOUT_MS)
    });
    if (!response.ok) {
      throw new AppError(
        response.status >= 500 ? 503 : 422,
        response.status >= 500 ? "ai_provider_unavailable" : "ai_provider_rejected",
        response.status >= 500
          ? "AI could not complete this request. Manual workflows remain available."
          : "AI declined the request under its safety or data policy."
      );
    }
    const parsed = aiOutputSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new AppError(
        502,
        "ai_provider_invalid",
        "AI returned an invalid evidence package. No suggestion was saved."
      );
    }
    return parsed.data;
  }
}

const emailSendResultSchema = z.object({
  status: z.enum(["accepted", "uncertain", "rejected"]),
  providerMessageId: z.string().trim().min(1).max(500).optional(),
  safeDetail: z.string().trim().max(500).optional()
});

export class ConfiguredEmailProvider implements EmailProvider {
  constructor(private readonly configuration: AppConfig) {}

  async send(input: {
    idempotencyKey: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    headers: Record<string, string>;
  }): Promise<EmailSendResult> {
    if (
      !this.configuration.OUTREACH_SEND_ENABLED ||
      !this.configuration.EMAIL_PROVIDER_URL ||
      !this.configuration.EMAIL_PROVIDER_TOKEN
    ) {
      throw new AppError(
        503,
        "email_provider_unavailable",
        "Email delivery is not configured. The approved message remains queued and safe to retry."
      );
    }
    const response = await fetch(new URL("/messages", this.configuration.EMAIL_PROVIDER_URL), {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.configuration.EMAIL_PROVIDER_TOKEN}`,
        "content-type": "application/json",
        "idempotency-key": input.idempotencyKey
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) {
      throw new AppError(
        response.status >= 500 ? 503 : 422,
        response.status >= 500 ? "email_provider_unavailable" : "email_provider_rejected",
        response.status >= 500
          ? "The email provider is temporarily unavailable. The message remains safe to retry."
          : "The email provider rejected this message. Review the recipient and content."
      );
    }
    const parsed = emailSendResultSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new AppError(502, "email_provider_invalid", "The email provider returned an invalid response.");
    }
    return parsed.data;
  }
}

const intelligenceCandidatesSchema = z.array(z.object({
  metricCode: z.string().trim().min(1).max(120),
  value: z.unknown(),
  observedAt: z.string().datetime(),
  sourceReference: z.string().trim().min(1).max(1000),
  geography: z.string().trim().max(200).optional(),
  acquisitionContext: z.string().trim().min(1).max(2000),
  limitations: z.string().trim().max(4000)
})).max(200);

export class HttpIntelligenceProvider implements IntelligenceProvider {
  constructor(private readonly configuration: AppConfig) {}

  async research(input: {
    subjectType: "product" | "brand" | "business" | "contact";
    externalReference: string;
  }): Promise<IntelligenceCandidate[]> {
    if (!this.configuration.INTELLIGENCE_API_URL || !this.configuration.INTELLIGENCE_API_TOKEN) {
      throw new AppError(
        503,
        "intelligence_provider_unavailable",
        "External intelligence refresh is not configured. Existing evidence remains available for manual review."
      );
    }
    const url = new URL("/research", this.configuration.INTELLIGENCE_API_URL);
    url.searchParams.set("subjectType", input.subjectType);
    url.searchParams.set("reference", input.externalReference);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${this.configuration.INTELLIGENCE_API_TOKEN}` },
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      throw new AppError(
        503,
        "intelligence_provider_unavailable",
        "External intelligence could not be refreshed. Existing evidence remains available."
      );
    }
    const payload = intelligenceCandidatesSchema.safeParse(await response.json());
    if (!payload.success) {
      throw new AppError(502, "intelligence_provider_invalid", "The intelligence provider returned an invalid response.");
    }
    return payload.data;
  }
}

export class HttpCredentialProvider implements CredentialProvider {
  constructor(private readonly configuration: AppConfig) {}

  async refresh(providerReference: string): Promise<unknown> {
    if (!this.configuration.CREDENTIAL_API_URL || !this.configuration.CREDENTIAL_API_TOKEN) {
      throw new AppError(
        503,
        "credential_provider_unavailable",
        "Live credential refresh is not configured. Your last verified status remains in effect."
      );
    }
    const response = await fetch(
      `${this.configuration.CREDENTIAL_API_URL.replace(/\/$/, "")}/credentials/${encodeURIComponent(providerReference)}`,
      {
        headers: { authorization: `Bearer ${this.configuration.CREDENTIAL_API_TOKEN}` },
        signal: AbortSignal.timeout(10_000)
      }
    );
    if (!response.ok) {
      throw new AppError(
        503,
        "credential_provider_unavailable",
        "Credential verification could not be refreshed. Try again later."
      );
    }
    return response.json();
  }
}

export type UploadTarget = {
  method: "PUT";
  url: string;
  headers: Record<string, string>;
  expiresInSeconds: number;
};

export interface ObjectStorage {
  createUploadTarget(input: {
    documentId: string;
    storageKey: string;
    mediaType: string;
    byteSize: number;
    sha256: string;
  }): Promise<UploadTarget>;
  writeLocal?(storageKey: string, content: Buffer): Promise<void>;
  createReadTarget(storageKey: string): Promise<{ url?: string; content?: Buffer }>;
  readForProcessing(storageKey: string): Promise<Buffer>;
}

export class ConfiguredObjectStorage implements ObjectStorage {
  private readonly s3: S3Client | null;

  constructor(private readonly configuration: AppConfig) {
    this.s3 =
      configuration.STORAGE_DRIVER === "s3"
        ? new S3Client({
            region: configuration.S3_REGION,
            ...(configuration.S3_ENDPOINT
              ? { endpoint: configuration.S3_ENDPOINT, forcePathStyle: true }
              : {})
          })
        : null;
  }

  async createUploadTarget(input: {
    documentId: string;
    storageKey: string;
    mediaType: string;
    byteSize: number;
    sha256: string;
  }): Promise<UploadTarget> {
    if (!this.s3) {
      return {
        method: "PUT",
        url: `/api/documents/${input.documentId}/content`,
        headers: { "content-type": input.mediaType },
        expiresInSeconds: 900
      };
    }
    const checksum = Buffer.from(input.sha256, "hex").toString("base64");
    const command = new PutObjectCommand({
      Bucket: this.configuration.S3_BUCKET,
      Key: input.storageKey,
      ContentType: input.mediaType,
      ContentLength: input.byteSize,
      ChecksumSHA256: checksum,
      ServerSideEncryption: "AES256"
    });
    const url = await getSignedUrl(this.s3, command, { expiresIn: 900 });
    return {
      method: "PUT",
      url,
      headers: {
        "content-type": input.mediaType,
        "x-amz-checksum-sha256": checksum,
        "x-amz-server-side-encryption": "AES256"
      },
      expiresInSeconds: 900
    };
  }

  async writeLocal(storageKey: string, content: Buffer): Promise<void> {
    if (this.s3) throw new AppError(405, "direct_upload_required", "Use the signed object-storage upload.");
    const root = path.resolve(this.configuration.LOCAL_STORAGE_PATH);
    const target = path.resolve(root, storageKey);
    if (!target.startsWith(`${root}${path.sep}`)) {
      throw new AppError(400, "storage_key_invalid", "Storage key is invalid.");
    }
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, content, { mode: 0o600, flag: "wx" });
  }

  async createReadTarget(storageKey: string): Promise<{ url?: string; content?: Buffer }> {
    if (!this.s3) {
      return { content: await readFile(path.resolve(this.configuration.LOCAL_STORAGE_PATH, storageKey)) };
    }
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.configuration.S3_BUCKET, Key: storageKey }),
      { expiresIn: 300 }
    );
    return { url };
  }

  async readForProcessing(storageKey: string): Promise<Buffer> {
    if (!this.s3) {
      const root = path.resolve(this.configuration.LOCAL_STORAGE_PATH);
      const target = path.resolve(root, storageKey);
      if (!target.startsWith(`${root}${path.sep}`)) {
        throw new AppError(400, "storage_key_invalid", "Storage key is invalid.");
      }
      return readFile(target);
    }
    const result = await this.s3.send(new GetObjectCommand({
      Bucket: this.configuration.S3_BUCKET,
      Key: storageKey
    }));
    if (!result.Body) {
      throw new AppError(404, "document_content_missing", "Document content is unavailable.");
    }
    return Buffer.from(await result.Body.transformToByteArray());
  }
}
