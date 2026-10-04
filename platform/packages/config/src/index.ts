import "dotenv/config";
import { z } from "zod";

const booleanString = z
  .enum(["0", "1"])
  .default("0")
  .transform((value) => value === "1");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.string().url().default("http://127.0.0.1:5173"),
    PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    DATABASE_URL: z.string().min(1).default("postgres://localhost/ryva_pro_dev"),
    PGSSL: z.enum(["verify-full", "verify", "require", "disable"]).default("verify-full"),
    PG_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    SESSION_PEPPER: z.string().default(""),
    FIELD_ENCRYPTION_KEY: z.string().default(""),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(168),
    TRUST_PROXY: booleanString,
    CREDENTIAL_WEBHOOK_SECRET: z.string().default(""),
    CREDENTIAL_API_URL: z.union([z.literal(""), z.string().url()]).default(""),
    CREDENTIAL_API_TOKEN: z.string().default(""),
    INTELLIGENCE_API_URL: z.union([z.literal(""), z.string().url()]).default(""),
    INTELLIGENCE_API_TOKEN: z.string().default(""),
    AI_PROVIDER_URL: z.union([z.literal(""), z.string().url()]).default(""),
    AI_PROVIDER_TOKEN: z.string().default(""),
    AI_MODEL: z.string().trim().min(1).max(200).default("provider-default"),
    AI_MODEL_VERSION: z.string().trim().min(1).max(200).default("unknown"),
    AI_GENERATION_ENABLED: booleanString,
    AI_PROVIDER_RETENTION_MODE: z.enum([
      "zero_data_retention",
      "no_training_contract",
      "provider_default"
    ]).default("zero_data_retention"),
    AI_ALLOW_PROVIDER_TRAINING: booleanString,
    AI_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
    AI_MAX_CONTEXT_ITEMS: z.coerce.number().int().min(1).max(200).default(50),
    EMAIL_PROVIDER_URL: z.union([z.literal(""), z.string().url()]).default(""),
    EMAIL_PROVIDER_TOKEN: z.string().default(""),
    EMAIL_WEBHOOK_SECRET: z.string().default(""),
    RESEND_WEBHOOK_SECRET: z.string().default(""),
    EMAIL_FROM_ADDRESS: z.union([z.literal(""), z.string().email()]).default(""),
    OUTREACH_SEND_ENABLED: booleanString,
    TRANSACTIONAL_EMAIL_PROVIDER_URL: z.union([z.literal(""), z.string().url()]).default(""),
    TRANSACTIONAL_EMAIL_PROVIDER_TOKEN: z.string().default(""),
    TRANSACTIONAL_EMAIL_FROM_ADDRESS: z.union([z.literal(""), z.string().email()]).default(""),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(15).max(240).default(60),
    RYVA_PRO_TRIAL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    TERMS_DOCUMENT_URL: z.union([z.literal(""), z.string().url()]).default(""),
    TERMS_DOCUMENT_VERSION: z.string().trim().default("2026-10-02"),
    PRIVACY_DOCUMENT_URL: z.union([z.literal(""), z.string().url()]).default(""),
    PRIVACY_DOCUMENT_VERSION: z.string().trim().default("2026-10-02"),
    REFUND_POLICY_DOCUMENT_URL: z.union([z.literal(""), z.string().url()]).default(""),
    REFUND_POLICY_DOCUMENT_VERSION: z.string().trim().default("2026-10-02"),
    DISCLAIMER_DOCUMENT_URL: z.union([z.literal(""), z.string().url()]).default(""),
    DISCLAIMER_DOCUMENT_VERSION: z.string().trim().default("2026-10-02"),
    STRIPE_SECRET_KEY: z.string().default(""),
    STRIPE_WEBHOOK_SECRET: z.string().default(""),
    STRIPE_PROGRAM_PRICE_ID: z.string().default(""),
    PROGRAM_PRICE_CENTS: z.coerce.number().int().refine((value) => value === 39700, {
      message: "The Ryva Program price must be 39700 cents."
    }).default(39700),
    PROGRAM_PRICE_CURRENCY: z.string().trim().toLowerCase().refine((value) => value === "usd", {
      message: "The Ryva Program currency must be USD."
    }).default("usd"),
    STRIPE_PRICE_ID: z.string().default(""),
    RYVA_PRO_PRICE_CENTS: z.coerce.number().int().refine((value) => value === 2000, {
      message: "Ryva Pro must cost 2000 cents per month."
    }).default(2000),
    RYVA_PRO_PRICE_CURRENCY: z.string().trim().toLowerCase().refine((value) => value === "usd", {
      message: "Ryva Pro currency must be USD."
    }).default("usd"),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    LOCAL_STORAGE_PATH: z.string().default(".data/documents"),
    S3_BUCKET: z.string().default(""),
    S3_REGION: z.string().default(""),
    S3_ENDPOINT: z.union([z.literal(""), z.string().url()]).default(""),
    MALWARE_SCANNER_WEBHOOK_SECRET: z.string().default(""),
    SUPPORT_EMAIL: z.string().email().default("support@ryvaforge.com"),
    JOB_WORKER_ENABLED: booleanString,
    JOB_POLL_INTERVAL_MS: z.coerce.number().int().min(250).max(60_000).default(5000),
    CONTROLLED_LAUNCH_ENABLED: booleanString,
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(60).max(86_400).default(600),
    RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().min(1).max(1000).default(10),
    ALLOW_SYNTHETIC_SEED: booleanString
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== "production") return;
    const required: Array<keyof typeof value> = [
      "SESSION_PEPPER",
      "FIELD_ENCRYPTION_KEY",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PROGRAM_PRICE_ID",
      "STRIPE_PRICE_ID",
      "EMAIL_PROVIDER_URL",
      "EMAIL_PROVIDER_TOKEN",
      "RESEND_WEBHOOK_SECRET",
      "EMAIL_FROM_ADDRESS",
      "TRANSACTIONAL_EMAIL_PROVIDER_URL",
      "TRANSACTIONAL_EMAIL_PROVIDER_TOKEN",
      "TRANSACTIONAL_EMAIL_FROM_ADDRESS",
      "S3_BUCKET",
      "S3_REGION",
      "MALWARE_SCANNER_WEBHOOK_SECRET"
    ];
    for (const key of required) {
      if (!String(value[key])) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required in production`
        });
      }
    }
    if (!value.APP_URL.startsWith("https://")) {
      context.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "APP_URL must use HTTPS in production"
      });
    }
    if (
      (value.TERMS_DOCUMENT_URL && !value.TERMS_DOCUMENT_URL.startsWith("https://")) ||
      (value.PRIVACY_DOCUMENT_URL && !value.PRIVACY_DOCUMENT_URL.startsWith("https://")) ||
      (value.REFUND_POLICY_DOCUMENT_URL && !value.REFUND_POLICY_DOCUMENT_URL.startsWith("https://")) ||
      (value.DISCLAIMER_DOCUMENT_URL && !value.DISCLAIMER_DOCUMENT_URL.startsWith("https://"))
    ) {
      context.addIssue({
        code: "custom",
        path: ["TERMS_DOCUMENT_URL"],
        message: "Production legal document URLs must use HTTPS"
      });
    }
    if (value.PGSSL === "disable") {
      context.addIssue({
        code: "custom",
        path: ["PGSSL"],
        message: "PGSSL=disable is not permitted in production"
      });
    }
    if (value.ALLOW_SYNTHETIC_SEED) {
      context.addIssue({
        code: "custom",
        path: ["ALLOW_SYNTHETIC_SEED"],
        message: "Synthetic seeding must be disabled in production"
      });
    }
    if (value.STORAGE_DRIVER !== "s3") {
      context.addIssue({
        code: "custom",
        path: ["STORAGE_DRIVER"],
        message: "Production document storage must use the S3 adapter"
      });
    }
    if (value.AI_GENERATION_ENABLED && (
      !value.AI_PROVIDER_URL || !value.AI_PROVIDER_TOKEN
    )) {
      context.addIssue({
        code: "custom",
        path: ["AI_PROVIDER_URL"],
        message: "AI provider URL and token are required when AI generation is enabled"
      });
    }
    if (value.AI_ALLOW_PROVIDER_TRAINING) {
      context.addIssue({
        code: "custom",
        path: ["AI_ALLOW_PROVIDER_TRAINING"],
        message: "Cross-customer provider training is not permitted"
      });
    }
  });

export type AppConfig = z.infer<typeof schema>;

let cached: AppConfig | undefined;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = schema.safeParse(environment);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid Ryva Pro configuration: ${details}`);
  }
  return result.data;
}

export function config(): AppConfig {
  cached ??= loadConfig();
  return cached;
}

export function resetConfigForTests(): void {
  cached = undefined;
}
