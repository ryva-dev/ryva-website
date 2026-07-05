import cookieParser from "cookie-parser";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import Stripe from "stripe";
import { fileURLToPath } from "node:url";
import { db } from "./db.mjs";
import { sendTransactionalEmail } from "./mailer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const workersPath = path.join(rootDir, "data", "workers.json");
const sessionCookieName = "ryva_session";
const sessionDurationMs = 1000 * 60 * 60 * 24 * 7;
const emailTokenDurationMs = 1000 * 60 * 60 * 24;
const resetTokenDurationMs = 1000 * 60 * 30;
const isProduction = process.env.NODE_ENV === "production";
const appUrl = process.env.APP_URL ?? "http://localhost:5173";
const allowedOrigin = new URL(appUrl).origin;
const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const host = process.env.HOST ?? "0.0.0.0";

if (isProduction && !process.env.APP_URL) {
  throw new Error("APP_URL must be set in production.");
}

if (
  (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_WEBHOOK_SECRET) ||
  (!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
) {
  throw new Error("STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be set together.");
}

const app = express();
app.disable("x-powered-by");
if (isProduction) {
  app.set("trust proxy", 1);
}
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use((req, res, next) => {
  if (req.path === "/api/payments/webhook") {
    next();
    return;
  }

  express.json({ limit: "100kb" })(req, res, next);
});
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." }
});

const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checkout attempts. Please try again later." }
});

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password, salt = randomUUID()) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;

  const actualBuffer = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "utf8");
  const expectedBuffer = Buffer.from(expectedHash, "utf8");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function createOpaqueToken() {
  const raw = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

function toSafeUser(user) {
  return {
    createdAt: user.created_at,
    email: user.email,
    emailVerified: Boolean(user.email_verified_at),
    id: user.id,
    name: user.name
  };
}

async function readWorkers() {
  const file = await fs.readFile(workersPath, "utf8");
  return JSON.parse(file);
}

async function readHiredWorkersForUser(userId) {
  const hiredRows = db
    .prepare(
      `SELECT worker_slug
       FROM hired_workers
       WHERE user_id = ? AND status = ?
       ORDER BY hired_at DESC`
    )
    .all(userId, "active");

  if (hiredRows.length === 0) {
    return [];
  }

  const workers = await readWorkers();
  const workerMap = new Map(workers.map((worker) => [worker.slug, worker]));

  return hiredRows
    .map((row) => workerMap.get(row.worker_slug))
    .filter(Boolean);
}

function cleanupExpiredRecords() {
  const now = nowIso();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  db.prepare("DELETE FROM email_verification_tokens WHERE expires_at < ? OR consumed_at IS NOT NULL").run(now);
  db.prepare("DELETE FROM password_reset_tokens WHERE expires_at < ? OR consumed_at IS NOT NULL").run(now);
}

function setSessionCookie(res, rawToken) {
  res.cookie(sessionCookieName, rawToken, {
    httpOnly: true,
    maxAge: sessionDurationMs,
    path: "/",
    sameSite: "lax",
    secure: isProduction
  });
}

function clearSessionCookie(res) {
  res.clearCookie(sessionCookieName, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isProduction
  });
}

function assertOrigin(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  const origin = req.get("origin");
  const referer = req.get("referer");
  let requestOrigin = origin ?? null;

  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch {
      requestOrigin = null;
    }
  }

  if (requestOrigin && requestOrigin !== allowedOrigin) {
    res.status(403).json({ error: "Invalid request origin." });
    return;
  }

  next();
}

function getUserBySessionToken(rawToken) {
  if (!rawToken) return null;
  cleanupExpiredRecords();
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  return db
    .prepare(
      `SELECT users.*
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at >= ?`
    )
    .get(tokenHash, nowIso());
}

async function requireAuth(req, res, next) {
  const user = getUserBySessionToken(req.cookies[sessionCookieName]);
  if (!user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  req.user = user;
  next();
}

async function issueEmailVerification(user) {
  const { hash, raw } = createOpaqueToken();

  db.prepare("DELETE FROM email_verification_tokens WHERE user_id = ?").run(user.id);
  db.prepare(
    `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, consumed_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`
  ).run(randomUUID(), user.id, hash, new Date(Date.now() + emailTokenDurationMs).toISOString(), nowIso());

  const verificationUrl = `${appUrl}/api/auth/verify-email?token=${raw}`;
  return sendTransactionalEmail({
    html: `<p>Verify your Ryva account:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p>`,
    subject: "Verify your Ryva account",
    text: `Verify your Ryva account: ${verificationUrl}`,
    to: user.email
  });
}

async function issuePasswordReset(user) {
  const { hash, raw } = createOpaqueToken();

  db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(user.id);
  db.prepare(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, consumed_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`
  ).run(randomUUID(), user.id, hash, new Date(Date.now() + resetTokenDurationMs).toISOString(), nowIso());

  const resetUrl = `${appUrl}/?reset_token=${raw}#about`;
  return sendTransactionalEmail({
    html: `<p>Reset your Ryva password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    subject: "Reset your Ryva password",
    text: `Reset your Ryva password: ${resetUrl}`,
    to: user.email
  });
}

function createSession(userId) {
  const { hash, raw } = createOpaqueToken();
  db.prepare(
    `INSERT INTO sessions (id, token_hash, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(randomUUID(), hash, userId, new Date(Date.now() + sessionDurationMs).toISOString(), nowIso());
  return raw;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/workers", async (_req, res) => {
  const workers = await readWorkers();
  res.json({ workers });
});

app.get("/api/workers/:slug", async (req, res) => {
  const workers = await readWorkers();
  const worker = workers.find((entry) => entry.slug === req.params.slug);
  if (!worker) {
    res.status(404).json({ error: "Worker not found." });
    return;
  }

  res.json({ worker });
});

app.get("/api/office/workers", requireAuth, async (req, res) => {
  const workers = await readHiredWorkersForUser(req.user.id);
  res.json({ workers });
});

app.post("/api/auth/register", authLimiter, assertOrigin, async (req, res) => {
  const { email, name, password } = req.body ?? {};

  if (!email || !name || !password) {
    res.status(400).json({ error: "Name, email, and password are required." });
    return;
  }

  if (String(password).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }

  const user = {
    created_at: nowIso(),
    email: normalizedEmail,
    id: randomUUID(),
    name: String(name).trim(),
    password_hash: hashPassword(String(password))
  };

  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, email_verified_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`
  ).run(user.id, user.email, user.name, user.password_hash, user.created_at);

  const sessionToken = createSession(user.id);
  setSessionCookie(res, sessionToken);

  const mailResult = await issueEmailVerification(user);
  res.status(201).json({
    emailVerificationSent: true,
    emailVerificationPreview: mailResult.preview,
    user: {
      createdAt: user.created_at,
      email: user.email,
      emailVerified: false,
      id: user.id,
      name: user.name
    }
  });
});

app.post("/api/auth/login", authLimiter, assertOrigin, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizeEmail(email));
  if (!user || !verifyPassword(String(password), user.password_hash)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const sessionToken = createSession(user.id);
  setSessionCookie(res, sessionToken);
  res.json({ user: toSafeUser(user) });
});

app.post("/api/auth/logout", assertOrigin, (req, res) => {
  const rawToken = req.cookies[sessionCookieName];
  if (rawToken) {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  }

  clearSessionCookie(res);
  res.status(204).end();
});

app.get("/api/auth/me", (req, res) => {
  const user = getUserBySessionToken(req.cookies[sessionCookieName]);
  res.json({ user: user ? toSafeUser(user) : null });
});

app.post("/api/auth/resend-verification", authLimiter, assertOrigin, requireAuth, async (req, res) => {
  const mailResult = await issueEmailVerification(req.user);
  res.json({ ok: true, preview: mailResult.preview });
});

app.get("/api/auth/verify-email", async (req, res) => {
  const token = String(req.query.token ?? "");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const record = db
    .prepare(
      `SELECT * FROM email_verification_tokens
       WHERE token_hash = ? AND consumed_at IS NULL AND expires_at >= ?`
    )
    .get(tokenHash, nowIso());

  if (!record) {
    res.redirect(`${appUrl}/?notice=verification-invalid#about`);
    return;
  }

  db.prepare("UPDATE email_verification_tokens SET consumed_at = ? WHERE id = ?").run(nowIso(), record.id);
  db.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?").run(nowIso(), record.user_id);
  res.redirect(`${appUrl}/?notice=email-verified#workers`);
});

app.post("/api/auth/request-password-reset", authLimiter, assertOrigin, async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    res.status(400).json({ error: "Email is required." });
    return;
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizeEmail(email));
  if (user) {
    const mailResult = await issuePasswordReset(user);
    res.json({ ok: true, preview: mailResult.preview });
    return;
  }

  res.json({ ok: true, preview: null });
});

app.post("/api/auth/reset-password", authLimiter, assertOrigin, async (req, res) => {
  const { password, token } = req.body ?? {};
  if (!token || !password) {
    res.status(400).json({ error: "Token and new password are required." });
    return;
  }

  if (String(password).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const tokenHash = createHash("sha256").update(String(token)).digest("hex");
  const record = db
    .prepare(
      `SELECT * FROM password_reset_tokens
       WHERE token_hash = ? AND consumed_at IS NULL AND expires_at >= ?`
    )
    .get(tokenHash, nowIso());

  if (!record) {
    res.status(400).json({ error: "Password reset token is invalid or expired." });
    return;
  }

  db.prepare("UPDATE password_reset_tokens SET consumed_at = ? WHERE id = ?").run(nowIso(), record.id);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(String(password)), record.user_id);
  res.json({ ok: true });
});

app.post("/api/payments/checkout", checkoutLimiter, assertOrigin, requireAuth, async (req, res) => {
  const { workerSlug } = req.body ?? {};
  if (!req.user.email_verified_at) {
    res.status(403).json({ error: "Verify your email before starting checkout." });
    return;
  }

  const workers = await readWorkers();
  const worker = workers.find((entry) => entry.slug === workerSlug);

  if (!worker) {
    res.status(404).json({ error: "Worker not found." });
    return;
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    res.status(501).json({ error: "Stripe is not configured. Set STRIPE_SECRET_KEY to enable checkout." });
    return;
  }

  const stripe = new Stripe(stripeKey);
  const unitAmount = Number.parseInt(worker.salary.replace(/[^0-9]/g, ""), 10) * 100;
  const checkoutId = randomUUID();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${appUrl}/?checkout=success#app/office`,
    cancel_url: `${appUrl}/?checkout=cancelled#worker-${worker.slug}`,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            description: `Monthly salary for ${worker.department}`,
            name: `${worker.name} - ${worker.title}`
          },
          unit_amount: unitAmount
        },
        quantity: 1
      }
    ],
    metadata: {
      checkoutId,
      userId: req.user.id,
      workerSlug: worker.slug
    }
  });

  db.prepare(
    `INSERT INTO checkout_sessions (id, user_id, worker_slug, amount_cents, stripe_session_id, status, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
  ).run(checkoutId, req.user.id, worker.slug, unitAmount, session.id, "pending", nowIso());

  res.json({ url: session.url });
});

app.post("/api/payments/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    res.status(501).json({ error: "Stripe webhook is not configured." });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    res.status(400).send("Missing Stripe signature.");
    return;
  }

  try {
    const stripe = new Stripe(stripeKey);
    const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const checkoutId = session.metadata?.checkoutId;
      const userId = session.metadata?.userId;
      const workerSlug = session.metadata?.workerSlug;

      if (checkoutId) {
        db.prepare(
          `UPDATE checkout_sessions
           SET status = ?, completed_at = ?
           WHERE id = ?`
        ).run("completed", nowIso(), checkoutId);
      }

      if (checkoutId && userId && workerSlug) {
        db.prepare(
          `INSERT INTO hired_workers (id, user_id, worker_slug, checkout_session_id, status, hired_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, worker_slug) DO UPDATE SET
             checkout_session_id = excluded.checkout_session_id,
             status = excluded.status,
             hired_at = excluded.hired_at`
        ).run(randomUUID(), userId, workerSlug, checkoutId, "active", nowIso());
      }
    }

    res.json({ received: true });
  } catch (error) {
    res.status(400).send(error instanceof Error ? error.message : "Webhook verification failed.");
  }
});

app.use(express.static(distDir));
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }

  try {
    const indexPath = path.join(distDir, "index.html");
    await fs.access(indexPath);
    res.sendFile(indexPath);
  } catch {
    next();
  }
});

app.listen(port, host, () => {
  console.log(`Ryva API listening on http://${host}:${port}`);
});
