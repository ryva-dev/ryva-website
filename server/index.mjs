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
const storageRoot =
  process.env.STORAGE_ROOT ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  path.join(rootDir, "data");
const uploadsDir = path.join(storageRoot, "office-uploads");
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

await fs.mkdir(uploadsDir, { recursive: true });

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

  express.json({ limit: "2mb" })(req, res, next);
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

function hasHiredWorker(userId, workerSlug) {
  return Boolean(
    db
      .prepare("SELECT id FROM hired_workers WHERE user_id = ? AND worker_slug = ? AND status = ?")
      .get(userId, workerSlug, "active")
  );
}

function readOfficeOverlaysForUser(userId) {
  return {
    briefings: db
      .prepare(
        `SELECT worker_slug AS workerSlug, id, title, date_label AS dateLabel, summary,
                agenda_json AS agendaJson, decisions_json AS decisionsJson, actions_json AS actionsJson
         FROM office_custom_briefings
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId),
    chats: db
      .prepare(
        `SELECT worker_slug AS workerSlug, id, author, text, created_at AS timestamp
         FROM office_chat_messages
         WHERE user_id = ?
         ORDER BY created_at ASC`
      )
      .all(userId),
    tasks: db
      .prepare(
        `SELECT worker_slug AS workerSlug, id, due_date AS dueDate, module_name AS module, owner, priority, status, title
         FROM office_custom_tasks
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId),
    worklog: db
      .prepare(
        `SELECT worker_slug AS workerSlug, id, action, module_name AS module, result, created_at AS timestamp
         FROM office_activity_logs
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .all(userId),
    settings: db
      .prepare(
        `SELECT worker_slug AS workerSlug, settings_json AS settingsJson
         FROM office_worker_settings
         WHERE user_id = ?`
      )
      .all(userId),
    knowledge: db
      .prepare(
        `SELECT worker_slug AS workerSlug, knowledge_json AS knowledgeJson
         FROM office_worker_knowledge
         WHERE user_id = ?`
      )
      .all(userId),
    files: db
      .prepare(
        `SELECT worker_slug AS workerSlug, id, name, type, uploaded_at AS updatedAt
         FROM office_uploaded_files
         WHERE user_id = ?
         ORDER BY uploaded_at DESC`
      )
      .all(userId),
    globalSettings:
      db
        .prepare(
          `SELECT settings_json AS settingsJson
           FROM office_global_settings
           WHERE user_id = ?`
        )
        .get(userId) ?? null
  };
}

function makeWorkerReply(name) {
  return `${name ? name.split(" ")[0] : "I"} received that update and will reflect it in the work queue before the next briefing.`;
}

function normalizeTextList(value, limit = 12) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .slice(0, limit);
}

function upsertWorkerKnowledge(userId, workerSlug, recipe) {
  const record = db
    .prepare(
      `SELECT knowledge_json AS knowledgeJson
       FROM office_worker_knowledge
       WHERE user_id = ? AND worker_slug = ?`
    )
    .get(userId, workerSlug);

  const currentKnowledge =
    record?.knowledgeJson && typeof record.knowledgeJson === "string" ? JSON.parse(record.knowledgeJson) : [];

  const nextKnowledge = recipe(Array.isArray(currentKnowledge) ? currentKnowledge : []);

  db.prepare(
    `INSERT INTO office_worker_knowledge (id, user_id, worker_slug, knowledge_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_slug) DO UPDATE SET
       knowledge_json = excluded.knowledge_json,
       updated_at = excluded.updated_at`
  ).run(randomUUID(), userId, workerSlug, JSON.stringify(nextKnowledge), nowIso());
}

function rememberWorkerDirection(userId, workerSlug, text) {
  const cleaned = String(text ?? "").trim();
  if (!cleaned) return;

  upsertWorkerKnowledge(userId, workerSlug, (knowledge) => {
    const next = [...knowledge];
    const sectionIndex = next.findIndex((section) => section?.title === "Recent direction");
    const directionItems = sectionIndex >= 0 && Array.isArray(next[sectionIndex]?.items) ? next[sectionIndex].items : [];
    const updatedItems = [cleaned, ...directionItems.filter((entry) => entry !== cleaned)].slice(0, 8);
    const section = { items: updatedItems, title: "Recent direction" };

    if (sectionIndex >= 0) {
      next[sectionIndex] = section;
    } else {
      next.unshift(section);
    }

    return next;
  });
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

app.get("/api/office/overlays", requireAuth, (req, res) => {
  res.json(readOfficeOverlaysForUser(req.user.id));
});

app.get("/api/office/files/:fileId/download", requireAuth, async (req, res) => {
  const file = db
    .prepare(
      `SELECT id, user_id, name, type, stored_name
       FROM office_uploaded_files
       WHERE id = ? AND user_id = ?`
    )
    .get(req.params.fileId, req.user.id);

  if (!file) {
    res.status(404).json({ error: "File not found." });
    return;
  }

  const fullPath = path.join(uploadsDir, req.user.id, file.stored_name);

  try {
    await fs.access(fullPath);
    res.download(fullPath, file.name);
  } catch {
    res.status(404).json({ error: "Stored file is missing." });
  }
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

  const trimmedName = String(name).trim();
  if (trimmedName.length < 2) {
    res.status(400).json({ error: "Enter your full name." });
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
    name: trimmedName,
    password_hash: hashPassword(String(password))
  };

  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, email_verified_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`
  ).run(user.id, user.email, user.name, user.password_hash, user.created_at);

  const sessionToken = createSession(user.id);
  setSessionCookie(res, sessionToken);

  let mailResult = { preview: null };
  try {
    mailResult = await issueEmailVerification(user);
  } catch {
    mailResult = { preview: null };
  }
  res.status(201).json({
    emailVerificationSent: Boolean(mailResult.preview),
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

  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
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
  if (req.user.email_verified_at) {
    res.json({ ok: true, preview: null, alreadyVerified: true });
    return;
  }
  const mailResult = await issueEmailVerification(req.user);
  res.json({ ok: true, preview: mailResult.preview, alreadyVerified: false });
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
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(record.user_id);
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

  if (hasHiredWorker(req.user.id, workerSlug)) {
    res.status(409).json({ error: "You have already hired this worker." });
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

app.post("/api/office/workers/:slug/chat", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const text = String(req.body?.text ?? "").trim();

  if (!text) {
    res.status(400).json({ error: "Message text is required." });
    return;
  }

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const workers = await readWorkers();
  const worker = workers.find((entry) => entry.slug === workerSlug);
  const createdAt = nowIso();

  db.prepare(
    `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "You", text, createdAt);
  rememberWorkerDirection(req.user.id, workerSlug, text);

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Sent a chat message.", "Chat", "Worker notified of new direction", createdAt);

  const replyText = makeWorkerReply(worker?.name);
  const replyCreatedAt = new Date(Date.now() + 1000).toISOString();
  db.prepare(
    `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Worker", replyText, replyCreatedAt);

  res.status(201).json({ ok: true });
});

app.post("/api/office/workers/:slug/tasks", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const { dueDate, module, owner, priority, title } = req.body ?? {};

  if (!title || !module) {
    res.status(400).json({ error: "Task title and module are required." });
    return;
  }

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO office_custom_tasks (id, user_id, worker_slug, title, module_name, owner, priority, status, due_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    req.user.id,
    workerSlug,
    String(title),
    String(module),
    owner === "You" ? "You" : "Worker",
    priority === "Low" || priority === "Medium" || priority === "High" ? priority : "Medium",
    "To Do",
    String(dueDate || "This week"),
    createdAt
  );

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Created a task.", String(module), String(title), createdAt);

  res.status(201).json({ ok: true });
});

app.post("/api/office/workers/:slug/tasks/:taskId/status", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const taskId = req.params.taskId;
  const status = String(req.body?.status ?? "");

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!["To Do", "In Progress", "Needs Review", "Completed"].includes(status)) {
    res.status(400).json({ error: "Unsupported task status." });
    return;
  }

  const updated = db
    .prepare(
      `UPDATE office_custom_tasks
       SET status = ?
       WHERE id = ? AND user_id = ? AND worker_slug = ?`
    )
    .run(status, taskId, req.user.id, workerSlug);

  if (updated.changes === 0) {
    res.status(404).json({ error: "Custom task not found." });
    return;
  }

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Updated task status.", "Tasks", `${taskId} -> ${status}`, nowIso());

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/briefings/:briefingId/action", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const briefingId = req.params.briefingId;
  const action = String(req.body?.action ?? "");

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const createdAt = nowIso();

  if (action === "approve") {
    db.prepare(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), req.user.id, workerSlug, "Approved a briefing.", "Briefings", briefingId, createdAt);
    res.json({ ok: true });
    return;
  }

  if (action === "followup") {
    const followupText = "Please prepare follow-up notes and update the queue before the next review.";
    db.prepare(
      `INSERT INTO office_chat_messages (id, user_id, worker_slug, author, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      req.user.id,
      workerSlug,
      "You",
      followupText,
      createdAt
    );
    rememberWorkerDirection(req.user.id, workerSlug, followupText);
    db.prepare(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), req.user.id, workerSlug, "Requested briefing follow-up.", "Briefings", briefingId, createdAt);
    res.json({ ok: true });
    return;
  }

  if (action === "task") {
    db.prepare(
      `INSERT INTO office_custom_tasks (id, user_id, worker_slug, title, module_name, owner, priority, status, due_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      req.user.id,
      workerSlug,
      "Follow up on briefing decisions",
      "Briefings",
      "Worker",
      "High",
      "To Do",
      "Tomorrow",
      createdAt
    );
    db.prepare(
      `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), req.user.id, workerSlug, "Created a task from briefing.", "Briefings", briefingId, createdAt);
    res.json({ ok: true });
    return;
  }

  res.status(400).json({ error: "Unsupported briefing action." });
});

app.post("/api/office/workers/:slug/settings", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const settings = req.body?.settings;

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!Array.isArray(settings)) {
    res.status(400).json({ error: "Settings payload is invalid." });
    return;
  }

  db.prepare(
    `INSERT INTO office_worker_settings (id, user_id, worker_slug, settings_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_slug) DO UPDATE SET
       settings_json = excluded.settings_json,
       updated_at = excluded.updated_at`
  ).run(randomUUID(), req.user.id, workerSlug, JSON.stringify(settings), nowIso());

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Updated worker settings.", "Settings", "Office preferences saved", nowIso());

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/knowledge", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const knowledge = req.body?.knowledge;

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!Array.isArray(knowledge)) {
    res.status(400).json({ error: "Knowledge payload is invalid." });
    return;
  }

  const normalizedKnowledge = knowledge
    .map((section) => ({
      items: normalizeTextList(section?.items),
      title: String(section?.title ?? "").trim()
    }))
    .filter((section) => section.title && section.items.length > 0);

  db.prepare(
    `INSERT INTO office_worker_knowledge (id, user_id, worker_slug, knowledge_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, worker_slug) DO UPDATE SET
       knowledge_json = excluded.knowledge_json,
       updated_at = excluded.updated_at`
  ).run(randomUUID(), req.user.id, workerSlug, JSON.stringify(normalizedKnowledge), nowIso());

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Updated worker knowledge.", "Memory", "Operating context saved", nowIso());

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/files", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const name = String(req.body?.name ?? "").trim();
  const type = String(req.body?.type ?? "File").trim();
  const contentBase64 = String(req.body?.contentBase64 ?? "");

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!name || !contentBase64) {
    res.status(400).json({ error: "File name and content are required." });
    return;
  }

  const fileId = randomUUID();
  const storedName = `${fileId}-${name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const userDir = path.join(uploadsDir, req.user.id);
  await fs.mkdir(userDir, { recursive: true });
  await fs.writeFile(path.join(userDir, storedName), Buffer.from(contentBase64, "base64"));

  db.prepare(
    `INSERT INTO office_uploaded_files (id, user_id, worker_slug, name, type, stored_name, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(fileId, req.user.id, workerSlug, name, type || "File", storedName, nowIso());

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Uploaded a file.", "Files", name, nowIso());

  res.status(201).json({ ok: true });
});

app.post("/api/office/workers/:slug/files/:fileId/delete", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const fileId = req.params.fileId;

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  const file = db
    .prepare(
      `SELECT stored_name, name
       FROM office_uploaded_files
       WHERE id = ? AND user_id = ? AND worker_slug = ?`
    )
    .get(fileId, req.user.id, workerSlug);

  if (!file) {
    res.status(404).json({ error: "File not found." });
    return;
  }

  db.prepare("DELETE FROM office_uploaded_files WHERE id = ? AND user_id = ?").run(fileId, req.user.id);

  try {
    await fs.unlink(path.join(uploadsDir, req.user.id, file.stored_name));
  } catch {
    // Ignore missing file on disk if metadata was present.
  }

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Removed a file.", "Files", file.name, nowIso());

  res.json({ ok: true });
});

app.post("/api/office/workers/:slug/briefings", assertOrigin, requireAuth, async (req, res) => {
  const workerSlug = req.params.slug;
  const { agenda, dateLabel, decisionsNeeded, recommendedActions, summary, title } = req.body ?? {};

  if (!hasHiredWorker(req.user.id, workerSlug)) {
    res.status(404).json({ error: "Hired worker not found." });
    return;
  }

  if (!title || !dateLabel) {
    res.status(400).json({ error: "Briefing title and time are required." });
    return;
  }

  const briefingId = randomUUID();
  db.prepare(
    `INSERT INTO office_custom_briefings
     (id, user_id, worker_slug, title, date_label, summary, agenda_json, decisions_json, actions_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    briefingId,
    req.user.id,
    workerSlug,
    String(title),
    String(dateLabel),
    String(summary || ""),
    JSON.stringify(Array.isArray(agenda) ? agenda : []),
    JSON.stringify(Array.isArray(decisionsNeeded) ? decisionsNeeded : []),
    JSON.stringify(Array.isArray(recommendedActions) ? recommendedActions : []),
    nowIso()
  );

  db.prepare(
    `INSERT INTO office_activity_logs (id, user_id, worker_slug, action, module_name, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), req.user.id, workerSlug, "Scheduled a briefing.", "Briefings", String(title), nowIso());

  res.status(201).json({ ok: true });
});

app.post("/api/office/settings", assertOrigin, requireAuth, async (req, res) => {
  const settings = req.body?.settings;
  if (!settings || typeof settings !== "object") {
    res.status(400).json({ error: "Office settings payload is invalid." });
    return;
  }

  const normalizedSettings = {
    autoBriefingPrep: String(settings.autoBriefingPrep ?? "Enabled"),
    briefingDigestTime: String(settings.briefingDigestTime ?? "08:30"),
    brandContext: String(settings.brandContext ?? "").trim(),
    defaultTaskPriority: String(settings.defaultTaskPriority ?? "Medium"),
    decisionStyle: String(settings.decisionStyle ?? "").trim(),
    digestDelivery: String(settings.digestDelivery ?? "Email and in-office"),
    dislikes: String(settings.dislikes ?? "").trim(),
    likes: String(settings.likes ?? "").trim(),
    meetingBuffer: String(settings.meetingBuffer ?? "15 minutes"),
    managerSummaryFrequency: String(settings.managerSummaryFrequency ?? "Daily"),
    nonNegotiables: String(settings.nonNegotiables ?? "").trim(),
    notificationWindow: String(settings.notificationWindow ?? "").trim(),
    officeHours: String(settings.officeHours ?? "").trim(),
    quietHours: String(settings.quietHours ?? "").trim(),
    reviewCadence: String(settings.reviewCadence ?? "Weekly"),
    reviewReminderLead: String(settings.reviewReminderLead ?? "2 hours before"),
    timezone: String(settings.timezone ?? "America/New_York")
  };

  db.prepare(
    `INSERT INTO office_global_settings (user_id, settings_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       settings_json = excluded.settings_json,
       updated_at = excluded.updated_at`
  ).run(req.user.id, JSON.stringify(normalizedSettings), nowIso());

  res.json({ ok: true });
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
