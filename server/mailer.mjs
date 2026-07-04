import nodemailer from "nodemailer";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outboxPath = path.join(rootDir, "data", "outbox.log");

function getMailerConfig() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  const hasAny =
    Boolean(SMTP_HOST) || Boolean(SMTP_PORT) || Boolean(SMTP_USER) || Boolean(SMTP_PASS) || Boolean(SMTP_FROM);

  if (!hasAny) {
    return null;
  }

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    throw new Error("SMTP configuration is incomplete. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.");
  }

  return {
    from: SMTP_FROM,
    transporter: nodemailer.createTransport({
      auth: {
        pass: SMTP_PASS,
        user: SMTP_USER
      },
      host: SMTP_HOST,
      port: Number.parseInt(SMTP_PORT, 10),
      secure: Number.parseInt(SMTP_PORT, 10) === 465
    })
  };
}

export async function sendTransactionalEmail({ html, subject, text, to }) {
  const config = getMailerConfig();

  if (!config) {
    const entry =
      `[${new Date().toISOString()}]\nTO: ${to}\nSUBJECT: ${subject}\nTEXT:\n${text}\nHTML:\n${html}\n\n---\n`;
    await fs.appendFile(outboxPath, entry, "utf8");
    return { mode: "outbox", preview: outboxPath };
  }

  await config.transporter.sendMail({
    from: config.from,
    html,
    subject,
    text,
    to
  });

  return { mode: "smtp", preview: null };
}
