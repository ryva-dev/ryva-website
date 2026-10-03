import { generateSecret, verify } from "otplib";
import type { AppConfig } from "../../config/src/index.js";
import type { Database } from "../../database/src/index.js";
import { oneOrNone, withTransaction } from "../../database/src/index.js";
import { AppError, newId } from "../../shared/src/index.js";
import { recordAudit } from "./audit.js";
import {
  decryptSecret,
  encryptSecret,
  hashPassword,
  randomToken,
  secureDigest
} from "./crypto.js";
import { enqueueJob } from "./jobs.js";
import { revokeUserSessions } from "./sessions.js";

export type TransactionalIdentityMessage = {
  kind: "password_reset";
  to: string;
  subject: string;
  text: string;
};

export type TransactionalIdentityEmailProvider = {
  send(input: TransactionalIdentityMessage & { idempotencyKey: string }): Promise<{
    providerMessageId?: string;
  }>;
};

export type RegistrationInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  termsVersion: string;
  privacyVersion: string;
  acceptedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
};

export async function registerCustomer(
  database: Database,
  configuration: AppConfig,
  input: RegistrationInput,
  requestId: string
): Promise<{ userId: string; workspaceId: string }> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const displayName = [firstName, lastName].filter(Boolean).join(" ");
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password, configuration.SESSION_PEPPER);
  const userId = newId();
  const workspaceId = newId();
  const occurredAt = input.acceptedAt ?? new Date();

  try {
    await withTransaction(database, async (transaction) => {
      const conflict = await oneOrNone<{ id: string }>(
        transaction,
        "SELECT id FROM users WHERE lower(email)=lower($1) AND status<>'deleted'",
        [email]
      );
      if (conflict) throw new AppError(409, "email_in_use", "An account already uses that email address.");

      await transaction.query(
        `INSERT INTO users
          (id,email,password_hash,first_name,last_name,name,status)
         VALUES ($1,$2,$3,$4,$5,$6,'active')`,
        [userId, email, passwordHash, firstName, lastName, displayName]
      );
      await transaction.query(
        `INSERT INTO workspaces (id,name,status) VALUES ($1,$2,'active')`,
        [workspaceId, `${displayName}'s workspace`]
      );
      await transaction.query(
        `INSERT INTO workspace_memberships (id,workspace_id,user_id,role,status)
         VALUES ($1,$2,$3,'representative','active')`,
        [newId(), workspaceId, userId]
      );
      await transaction.query(
        `INSERT INTO user_profiles (user_id,workspace_id,outreach_name)
         VALUES ($1,$2,$3)`,
        [userId, workspaceId, displayName]
      );
      await transaction.query(
        "INSERT INTO workspace_settings (workspace_id) VALUES ($1)",
        [workspaceId]
      );
      await transaction.query(
        `INSERT INTO legal_acceptances
          (id,user_id,workspace_id,document_type,document_version,acceptance_action,
           acceptance_context,ip_hash,user_agent,occurred_at)
         VALUES ($1,$2,$3,'terms_of_use',$4,'accepted','account_creation',$5,$6,$7),
                ($8,$2,$3,'privacy_policy',$9,'acknowledged','account_creation',$5,$6,$7)`,
        [
          newId(), userId, workspaceId, input.termsVersion,
          input.ipAddress ? secureDigest(input.ipAddress, configuration.SESSION_PEPPER) : null,
          input.userAgent?.slice(0, 500) ?? null, occurredAt,
          newId(), input.privacyVersion
        ]
      );
      await recordAudit(transaction, {
        workspaceId,
        actorUserId: userId,
        actorType: "user",
        action: "account.registered",
        targetType: "user",
        targetId: userId,
        origin: "public_api",
        requestId,
        outcome: "succeeded",
        metadata: {
          role: "representative",
          termsVersion: input.termsVersion,
          privacyVersion: input.privacyVersion
        }
      });
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new AppError(409, "email_in_use", "An account already uses that email address.");
    }
    throw error;
  }
  return { userId, workspaceId };
}

export async function requestPasswordReset(
  database: Database,
  configuration: AppConfig,
  emailInput: string,
  requestId: string
): Promise<void> {
  if (!configuration.FIELD_ENCRYPTION_KEY) {
    throw new AppError(
      503,
      "password_reset_unavailable",
      "Password recovery is temporarily unavailable."
    );
  }
  const email = emailInput.trim().toLowerCase();
  const user = await oneOrNone<{ id: string; email: string; workspace_id: string }>(
    database,
    `SELECT u.id,u.email,wm.workspace_id
       FROM users u
       JOIN LATERAL (
         SELECT workspace_id FROM workspace_memberships
          WHERE user_id=u.id AND status='active' ORDER BY created_at LIMIT 1
       ) wm ON true
      WHERE lower(u.email)=lower($1) AND u.status='active'`,
    [email]
  );
  if (!user) return;

  const token = randomToken();
  const resetId = newId();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + configuration.PASSWORD_RESET_TTL_MINUTES * 60_000);
  const resetUrl = new URL("/reset-password", configuration.APP_URL);
  resetUrl.searchParams.set("token", token);
  const message: TransactionalIdentityMessage = {
    kind: "password_reset",
    to: user.email,
    subject: "Reset your Ryva password",
    text: `A password reset was requested for your Ryva account. Use this secure link within ${configuration.PASSWORD_RESET_TTL_MINUTES} minutes: ${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.`
  };
  const outboxId = newId();

  await withTransaction(database, async (transaction) => {
    await transaction.query(
      `UPDATE password_reset_tokens SET used_at=now()
        WHERE user_id=$1 AND used_at IS NULL`,
      [user.id]
    );
    await transaction.query(
      `INSERT INTO password_reset_tokens
        (id,user_id,token_hash,issued_at,expires_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [resetId, user.id, secureDigest(token, configuration.SESSION_PEPPER), issuedAt, expiresAt]
    );
    await transaction.query(
      `INSERT INTO transactional_email_outbox
        (id,user_id,message_kind,recipient_address,encrypted_payload,idempotency_key,status)
       VALUES ($1,$2,'password_reset',$3,$4,$5,'queued')`,
      [
        outboxId,
        user.id,
        user.email,
        encryptSecret(JSON.stringify(message), configuration.FIELD_ENCRYPTION_KEY),
        `identity:password-reset:${resetId}`
      ]
    );
    await enqueueJob(transaction, {
      workspaceId: user.workspace_id,
      kind: "identity.transactional_email",
      payload: { outboxId },
      idempotencyKey: `identity:transactional-email:${outboxId}`
    });
    await recordAudit(transaction, {
      workspaceId: user.workspace_id,
      actorUserId: user.id,
      actorType: "system",
      action: "account.password_reset_requested",
      targetType: "password_reset",
      targetId: resetId,
      origin: "public_api",
      requestId,
      outcome: "succeeded"
    });
  });
}

export async function resetPassword(
  database: Database,
  configuration: AppConfig,
  token: string,
  newPassword: string,
  requestId: string
): Promise<void> {
  const passwordHash = await hashPassword(newPassword, configuration.SESSION_PEPPER);
  await withTransaction(database, async (transaction) => {
    const reset = await oneOrNone<{ id: string; user_id: string; workspace_id: string }>(
      transaction,
      `SELECT pr.id,pr.user_id,wm.workspace_id
         FROM password_reset_tokens pr
         JOIN users u ON u.id=pr.user_id AND u.status='active'
         JOIN LATERAL (
           SELECT workspace_id FROM workspace_memberships
            WHERE user_id=u.id AND status='active' ORDER BY created_at LIMIT 1
         ) wm ON true
        WHERE pr.token_hash=$1 AND pr.used_at IS NULL AND pr.expires_at>now()
        FOR UPDATE OF pr`,
      [secureDigest(token, configuration.SESSION_PEPPER)]
    );
    if (!reset) throw new AppError(400, "password_reset_invalid", "This password-reset link is invalid or has expired.");
    await transaction.query(
      "UPDATE users SET password_hash=$2,version=version+1,updated_at=now() WHERE id=$1",
      [reset.user_id, passwordHash]
    );
    await transaction.query(
      "UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL",
      [reset.user_id]
    );
    await revokeUserSessions(transaction, reset.user_id, "password_reset");
    await recordAudit(transaction, {
      workspaceId: reset.workspace_id,
      actorUserId: reset.user_id,
      actorType: "user",
      action: "account.password_reset_completed",
      targetType: "user",
      targetId: reset.user_id,
      origin: "public_api",
      requestId,
      outcome: "succeeded"
    });
  });
}

export async function beginStaffMfaEnrollment(
  database: Database,
  configuration: AppConfig,
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  if (!configuration.FIELD_ENCRYPTION_KEY) {
    throw new AppError(503, "mfa_setup_unavailable", "Multi-factor setup is temporarily unavailable.");
  }
  const token = randomToken();
  const secret = generateSecret();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 15 * 60_000);
  await withTransaction(database, async (transaction) => {
    await transaction.query(
      `UPDATE staff_mfa_enrollment_challenges SET consumed_at=now()
        WHERE user_id=$1 AND consumed_at IS NULL`,
      [userId]
    );
    await transaction.query(
      `INSERT INTO staff_mfa_enrollment_challenges
        (id,user_id,token_hash,secret_ciphertext,issued_at,expires_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        newId(),
        userId,
        secureDigest(token, configuration.SESSION_PEPPER),
        encryptSecret(secret, configuration.FIELD_ENCRYPTION_KEY),
        issuedAt,
        expiresAt
      ]
    );
  });
  return { token, expiresAt };
}

export async function getStaffMfaEnrollment(
  database: Database,
  configuration: AppConfig,
  token: string
): Promise<{ email: string; secret: string; expiresAt: Date }> {
  const challenge = await oneOrNone<{ email: string; secret_ciphertext: string; expires_at: Date }>(
    database,
    `SELECT u.email,c.secret_ciphertext,c.expires_at
       FROM staff_mfa_enrollment_challenges c
       JOIN users u ON u.id=c.user_id
       JOIN workspace_memberships wm ON wm.user_id=u.id AND wm.status='active'
      WHERE c.token_hash=$1 AND c.consumed_at IS NULL AND c.expires_at>now()
        AND u.status='active' AND wm.role IN ('admin','support')
      ORDER BY wm.created_at LIMIT 1`,
    [secureDigest(token, configuration.SESSION_PEPPER)]
  );
  if (!challenge) throw new AppError(401, "mfa_setup_invalid", "Multi-factor setup has expired. Sign in again.");
  return {
    email: challenge.email,
    secret: decryptSecret(challenge.secret_ciphertext, configuration.FIELD_ENCRYPTION_KEY),
    expiresAt: challenge.expires_at
  };
}

export async function confirmStaffMfaEnrollment(
  database: Database,
  configuration: AppConfig,
  token: string,
  code: string,
  requestId: string
): Promise<void> {
  await withTransaction(database, async (transaction) => {
    const challenge = await oneOrNone<{
      id: string;
      user_id: string;
      secret_ciphertext: string;
      workspace_id: string;
    }>(
      transaction,
      `SELECT c.id,c.user_id,c.secret_ciphertext,wm.workspace_id
         FROM staff_mfa_enrollment_challenges c
         JOIN users u ON u.id=c.user_id
         JOIN workspace_memberships wm ON wm.user_id=u.id AND wm.status='active'
        WHERE c.token_hash=$1 AND c.consumed_at IS NULL AND c.expires_at>now()
          AND u.status='active' AND wm.role IN ('admin','support')
        ORDER BY wm.created_at LIMIT 1
        FOR UPDATE OF c`,
      [secureDigest(token, configuration.SESSION_PEPPER)]
    );
    if (!challenge) throw new AppError(401, "mfa_setup_invalid", "Multi-factor setup has expired. Sign in again.");
    const secret = decryptSecret(challenge.secret_ciphertext, configuration.FIELD_ENCRYPTION_KEY);
    if (!(await verify({ token: code, secret })).valid) {
      throw new AppError(400, "mfa_invalid", "The verification code is invalid.");
    }
    await transaction.query(
      `UPDATE users SET mfa_secret_ciphertext=$2,version=version+1,updated_at=now()
        WHERE id=$1`,
      [challenge.user_id, challenge.secret_ciphertext]
    );
    await transaction.query(
      "UPDATE staff_mfa_enrollment_challenges SET consumed_at=now() WHERE id=$1",
      [challenge.id]
    );
    await recordAudit(transaction, {
      workspaceId: challenge.workspace_id,
      actorUserId: challenge.user_id,
      actorType: "user",
      action: "account.mfa_enrolled",
      targetType: "user",
      targetId: challenge.user_id,
      origin: "mfa_setup",
      requestId,
      outcome: "succeeded"
    });
  });
}

export async function processTransactionalIdentityEmail(
  database: Database,
  configuration: AppConfig,
  provider: TransactionalIdentityEmailProvider,
  outboxId: string
): Promise<{ providerMessageId: string | null }> {
  const outbox = await oneOrNone<{
    encrypted_payload: string;
    idempotency_key: string;
    status: string;
    provider_message_id: string | null;
  }>(database, "SELECT * FROM transactional_email_outbox WHERE id=$1", [outboxId]);
  if (!outbox) throw new AppError(404, "identity_email_not_found", "Transactional email was not found.");
  if (outbox.status === "sent") return { providerMessageId: outbox.provider_message_id };
  const message = JSON.parse(
    decryptSecret(outbox.encrypted_payload, configuration.FIELD_ENCRYPTION_KEY)
  ) as TransactionalIdentityMessage;
  const result = await provider.send({ ...message, idempotencyKey: outbox.idempotency_key });
  await database.query(
    `UPDATE transactional_email_outbox
        SET status='sent',provider_message_id=$2,sent_at=now(),updated_at=now(),last_error_code=NULL
      WHERE id=$1`,
    [outboxId, result.providerMessageId ?? null]
  );
  return { providerMessageId: result.providerMessageId ?? null };
}
