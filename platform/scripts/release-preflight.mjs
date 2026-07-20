const required = [
  "DATABASE_URL","SESSION_PEPPER","FIELD_ENCRYPTION_KEY","CREDENTIAL_WEBHOOK_SECRET",
  "CREDENTIAL_API_URL","CREDENTIAL_API_TOKEN","STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID","EMAIL_PROVIDER_URL","EMAIL_PROVIDER_TOKEN","EMAIL_WEBHOOK_SECRET",
  "EMAIL_FROM_ADDRESS","S3_BUCKET","S3_REGION","MALWARE_SCANNER_WEBHOOK_SECRET"
];

const checks = required.map((key) => ({ key, ok: Boolean(process.env[key]) }));
checks.push(
  { key: "APP_URL_HTTPS", ok: String(process.env.APP_URL ?? "").startsWith("https://") },
  { key: "PGSSL_VERIFIED", ok: ["verify","verify-full"].includes(process.env.PGSSL ?? "") },
  { key: "S3_STORAGE", ok: process.env.STORAGE_DRIVER === "s3" },
  { key: "SYNTHETIC_SEED_DISABLED", ok: process.env.ALLOW_SYNTHETIC_SEED !== "1" },
  { key: "PROVIDER_TRAINING_DISABLED", ok: process.env.AI_ALLOW_PROVIDER_TRAINING !== "1" }
);

for (const check of checks) {
  process.stdout.write(`${check.ok ? "PASS" : "BLOCK"} ${check.key}\n`);
}
if (checks.some((check) => !check.ok)) {
  process.stderr.write("Release preflight status: NOT READY\n");
  process.exitCode = 1;
} else {
  process.stdout.write("Release preflight configuration gates passed. Runtime and policy evidence are still required.\n");
}
