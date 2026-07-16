#!/usr/bin/env node

import "../server/loadEnv.mjs";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import Stripe from "stripe";
import { validateConfiguredPrice } from "../server/billingPricePolicy.mjs";
import { validateConfig } from "../server/observability.mjs";
import { getGmailConnectRedirectUri, getGoogleLoginRedirectUri } from "../server/googleOAuth.mjs";

const args = new Set(process.argv.slice(2));
const liveProviders = args.has("--live-providers");
const remoteIndex = process.argv.indexOf("--remote");
const remoteUrl = remoteIndex >= 0 ? String(process.argv[remoteIndex + 1] ?? "").replace(/\/$/, "") : "";
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function required(name) {
  return String(process.env[name] ?? "").trim();
}

async function checkResponse(name, url, init, predicate) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    const body = await response.text();
    record(name, predicate(response, body), `HTTP ${response.status}`);
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : "request failed");
  }
}

const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
try {
  validateConfig();
  record("production configuration", true, "all mandatory launch variables are structurally valid");
} catch (error) {
  record("production configuration", false, error instanceof Error ? error.message.split("\n").slice(1).join("; ") : "invalid");
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
}

const appUrl = required("APP_URL");
record("public HTTPS URL", /^https:\/\//i.test(appUrl), appUrl ? "HTTPS required for public OAuth and secure cookies" : "APP_URL missing");
if (appUrl) {
  console.log(`INFO  Google login redirect URI — ${getGoogleLoginRedirectUri(appUrl)}`);
  console.log(`INFO  Gmail connect redirect URI — ${getGmailConnectRedirectUri(appUrl, "mara-vale")}`);
  console.log("INFO  Both exact URIs must be listed on the Google Cloud Web application OAuth client.");
}
const supportEmail = required("SUPPORT_EMAIL");
record("support contact syntax", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail), supportEmail ? "address is syntactically valid" : "SUPPORT_EMAIL missing");

if (remoteUrl) {
  await checkResponse("remote liveness", `${remoteUrl}/healthz`, {}, (response) => response.status === 200);
  await checkResponse("remote database/schema readiness", `${remoteUrl}/readyz`, {}, (response) => response.status === 200);
  const metricsToken = required("METRICS_TOKEN");
  await checkResponse(
    "remote authenticated metrics",
    `${remoteUrl}/metrics`,
    { headers: { authorization: `Bearer ${metricsToken}` } },
    (response, body) => response.status === 200 && body.includes("jobs")
  );
}

if (liveProviders) {
  const stripeKey = required("STRIPE_SECRET_KEY");
  const stripePriceId = required("STRIPE_PRICE_ID_MARA_VALE") || required("STRIPE_PRICE_ID");
  if (!stripeKey.startsWith("sk_live_")) {
    record("Stripe live mode", false, "STRIPE_SECRET_KEY is not a live key");
  } else if (!stripePriceId) {
    record("Stripe live price", false, "configure STRIPE_PRICE_ID_MARA_VALE");
  } else {
    try {
      const price = await new Stripe(stripeKey).prices.retrieve(stripePriceId);
      const validation = validateConfiguredPrice(price, { expectedAmountCents: 7900, expectedCurrency: "usd" });
      record("Stripe live price", validation.valid, validation.valid ? "$79 USD monthly and active" : validation.reasons.join("; "));
    } catch (error) {
      record("Stripe live price", false, error instanceof Error ? error.message : "lookup failed");
    }
  }

  try {
    const s3 = new S3Client({
      region: required("AWS_REGION") || "us-east-1",
      endpoint: required("S3_ENDPOINT") || undefined,
      forcePathStyle: required("S3_FORCE_PATH_STYLE").toLowerCase() === "true"
    });
    await s3.send(new HeadBucketCommand({ Bucket: required("S3_BUCKET") }));
    record("S3 bucket access", true, "HeadBucket succeeded");
  } catch (error) {
    record("S3 bucket access", false, error instanceof Error ? error.message : "HeadBucket failed");
  }
}

if (!remoteUrl) console.log("INFO  remote probes skipped (pass --remote https://your-app.example)");
if (!liveProviders) console.log("INFO  live provider probes skipped (pass --live-providers; checks are read-only)");

const failures = results.filter((result) => !result.ok);
console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);
if (failures.length > 0) process.exitCode = 1;
