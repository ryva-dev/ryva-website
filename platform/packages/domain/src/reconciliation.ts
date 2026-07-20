import type { Database, Transaction } from "../../database/src/index.js";
import { oneOrNone, withTransaction } from "../../database/src/index.js";
import { AppError, newId } from "../../shared/src/index.js";
import { recordAudit } from "./audit.js";
import { publicDigest } from "./crypto.js";

export type CredentialProviderEvent = {
  eventId: string;
  eventType: string;
  userId: string;
  providerReference: string;
  credentialType: string;
  credentialNumberMasked: string;
  status: "pending" | "active" | "expiring" | "expired" | "suspended" | "revoked" | "surrendered";
  issuedAt?: string | null;
  expiresAt?: string | null;
  verifiedAt: string;
  suspensionReadOnlyAllowed?: boolean;
  statusReasonCode?: string | null;
  renewalUrl?: string | null;
};

async function claimProviderEvent(
  transaction: Transaction,
  provider: string,
  eventId: string,
  eventType: string,
  payload: unknown,
  requestId: string
): Promise<boolean> {
  const result = await transaction.query(
    `INSERT INTO provider_events
      (id, provider, external_event_id, event_type, payload_digest, request_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (provider, external_event_id) DO NOTHING`,
    [newId(), provider, eventId, eventType, publicDigest(JSON.stringify(payload)), requestId]
  );
  return result.rowCount === 1;
}

export async function reconcileCredentialEvent(
  database: Database,
  event: CredentialProviderEvent,
  requestId: string
): Promise<{ processed: boolean }> {
  return withTransaction(database, async (transaction) => {
    const claimed = await claimProviderEvent(
      transaction,
      "ryva-certification",
      event.eventId,
      event.eventType,
      event,
      requestId
    );
    if (!claimed) return { processed: false };

    const user = await oneOrNone<{ workspace_id: string }>(
      transaction,
      `SELECT wm.workspace_id FROM users u
       JOIN workspace_memberships wm ON wm.user_id=u.id AND wm.status='active'
       WHERE u.id=$1 ORDER BY wm.created_at LIMIT 1`,
      [event.userId]
    );
    if (!user) throw new AppError(422, "credential_user_unknown", "Credential user is not recognized.");

    const before = await oneOrNone<Record<string, unknown>>(
      transaction,
      "SELECT * FROM certification_credentials WHERE provider_reference=$1",
      [event.providerReference]
    );
    const credentialId = (before?.id as string | undefined) ?? newId();
    await transaction.query(
      `INSERT INTO certification_credentials
        (id, user_id, credential_type, credential_number_masked, status, issued_at,
         expires_at, verified_at, provider_reference, provider_event_id,
         suspension_read_only_allowed, status_reason_code, renewal_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (provider_reference) DO UPDATE SET
         user_id=excluded.user_id, credential_type=excluded.credential_type,
         credential_number_masked=excluded.credential_number_masked, status=excluded.status,
         issued_at=excluded.issued_at, expires_at=excluded.expires_at,
         verified_at=excluded.verified_at, provider_event_id=excluded.provider_event_id,
         suspension_read_only_allowed=excluded.suspension_read_only_allowed,
         status_reason_code=excluded.status_reason_code, renewal_url=excluded.renewal_url,
         updated_at=now()`,
      [
        credentialId,
        event.userId,
        event.credentialType,
        event.credentialNumberMasked,
        event.status,
        event.issuedAt ?? null,
        event.expiresAt ?? null,
        event.verifiedAt,
        event.providerReference,
        event.eventId,
        event.suspensionReadOnlyAllowed ?? false,
        event.statusReasonCode ?? null,
        event.renewalUrl ?? null
      ]
    );
    if (event.status === "revoked") {
      await transaction.query(
        `UPDATE sessions SET revoked_at=now(), revoked_reason='credential_revoked'
          WHERE user_id=$1 AND revoked_at IS NULL`,
        [event.userId]
      );
    }
    await recordAudit(transaction, {
      workspaceId: user.workspace_id,
      actorType: "provider",
      action: "credential.reconciled",
      targetType: "certification_credential",
      targetId: credentialId,
      origin: "credential_webhook",
      requestId,
      outcome: "succeeded",
      before,
      after: { ...event, credentialNumberMasked: "[masked]" },
      metadata: { eventId: event.eventId, eventType: event.eventType }
    });
    await transaction.query(
      `UPDATE provider_events SET processed_at=now(), outcome='succeeded'
        WHERE provider='ryva-certification' AND external_event_id=$1`,
      [event.eventId]
    );
    return { processed: true };
  });
}

export type BillingEntitlementEvent = {
  eventId: string;
  eventType: string;
  userId: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  status: "none" | "trial" | "active" | "past_due" | "retry_failed" | "canceled" | "ended";
  currentPeriodEnd?: string | null;
  trialEnd?: string | null;
  cancelAt?: string | null;
  pastDueSince?: string | null;
  priceId?: string | null;
};

export async function reconcileBillingEvent(
  database: Database,
  event: BillingEntitlementEvent,
  requestId: string
): Promise<{ processed: boolean }> {
  return withTransaction(database, async (transaction) => {
    const claimed = await claimProviderEvent(
      transaction,
      "stripe",
      event.eventId,
      event.eventType,
      event,
      requestId
    );
    if (!claimed) return { processed: false };
    const membership = await oneOrNone<{ workspace_id: string }>(
      transaction,
      `SELECT workspace_id FROM workspace_memberships
        WHERE user_id=$1 AND status='active' ORDER BY created_at LIMIT 1`,
      [event.userId]
    );
    if (!membership) throw new AppError(422, "billing_user_unknown", "Billing user is not recognized.");
    const before = await oneOrNone<Record<string, unknown>>(
      transaction,
      "SELECT * FROM subscription_entitlements WHERE user_id=$1",
      [event.userId]
    );
    const id = (before?.id as string | undefined) ?? newId();
    await transaction.query(
      `INSERT INTO subscription_entitlements
        (id, user_id, provider_customer_id, provider_subscription_id, status,
         current_period_end, trial_end, cancel_at, past_due_since, price_id, provider_event_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (user_id) DO UPDATE SET
         provider_customer_id=excluded.provider_customer_id,
         provider_subscription_id=excluded.provider_subscription_id,
         status=excluded.status, current_period_end=excluded.current_period_end,
         trial_end=excluded.trial_end, cancel_at=excluded.cancel_at,
         past_due_since=excluded.past_due_since, price_id=excluded.price_id,
         provider_event_id=excluded.provider_event_id, updated_at=now()`,
      [
        id,
        event.userId,
        event.providerCustomerId,
        event.providerSubscriptionId,
        event.status,
        event.currentPeriodEnd ?? null,
        event.trialEnd ?? null,
        event.cancelAt ?? null,
        event.pastDueSince ?? null,
        event.priceId ?? null,
        event.eventId
      ]
    );
    await recordAudit(transaction, {
      workspaceId: membership.workspace_id,
      actorType: "provider",
      action: "subscription.reconciled",
      targetType: "subscription_entitlement",
      targetId: id,
      origin: "stripe_webhook",
      requestId,
      outcome: "succeeded",
      before,
      after: event,
      metadata: { eventId: event.eventId, eventType: event.eventType }
    });
    await transaction.query(
      `UPDATE provider_events SET processed_at=now(), outcome='succeeded'
        WHERE provider='stripe' AND external_event_id=$1`,
      [event.eventId]
    );
    return { processed: true };
  });
}
