import type { AppConfig } from "../../config/src/index.js";
import type { Database, Transaction } from "../../database/src/index.js";
import { oneOrNone, withTransaction } from "../../database/src/index.js";
import { AppError, newId } from "../../shared/src/index.js";
import { recordAudit } from "./audit.js";
import { publicDigest } from "./crypto.js";

export type ProAccessState =
  | "not_eligible"
  | "program_incomplete"
  | "trial_active"
  | "subscription_active"
  | "paid_through"
  | "inactive"
  | "staff";

export type CustomerProductAccessInput = {
  programStatus: string | null;
  programCompletedAt: Date | null;
  proTrialStartedAt: Date | null;
  proTrialEndsAt: Date | null;
  subscriptionStatus: string | null;
  subscriptionPeriodEnd: Date | null;
  subscriptionPastDueSince: Date | null;
};

export type CustomerProductAccess = {
  canAccessProgram: boolean;
  isProgramCompleted: boolean;
  canAccessOperatingPlatform: boolean;
  isProTrialActive: boolean;
  isProActive: boolean;
  programStatus: string | null;
  programCompletedAt: string | null;
  proTrialStartedAt: string | null;
  proTrialEndsAt: string | null;
  proAccessState: ProAccessState;
  subscriptionStatus: string | null;
};

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export function deriveCustomerProductAccess(
  input: CustomerProductAccessInput,
  at = new Date()
): CustomerProductAccess {
  const canAccessProgram = input.programStatus === "active";
  const isProgramCompleted = input.programCompletedAt !== null;
  const isProTrialActive = Boolean(
    canAccessProgram &&
    isProgramCompleted &&
    input.proTrialStartedAt &&
    input.proTrialStartedAt <= at &&
    input.proTrialEndsAt &&
    input.proTrialEndsAt > at
  );

  const status = input.subscriptionStatus ?? "none";
  const activeSubscription = status === "active" && (
    input.subscriptionPeriodEnd === null || input.subscriptionPeriodEnd > at
  );
  const retrySubscription = status === "past_due" && Boolean(
    input.subscriptionPastDueSince &&
    at <= new Date(input.subscriptionPastDueSince.getTime() + 7 * 24 * 60 * 60 * 1000)
  );
  const paidThrough = status === "canceled" && Boolean(
    input.subscriptionPeriodEnd && input.subscriptionPeriodEnd > at
  );
  const subscriptionAccess = activeSubscription || retrySubscription || paidThrough;
  const isProActive = canAccessProgram && isProgramCompleted && subscriptionAccess;
  const canAccessOperatingPlatform = canAccessProgram && isProgramCompleted && (
    isProTrialActive || subscriptionAccess
  );

  let proAccessState: ProAccessState;
  if (!canAccessProgram) proAccessState = "not_eligible";
  else if (!isProgramCompleted) proAccessState = "program_incomplete";
  else if (isProTrialActive) proAccessState = "trial_active";
  else if (paidThrough) proAccessState = "paid_through";
  else if (activeSubscription || retrySubscription) proAccessState = "subscription_active";
  else proAccessState = "inactive";

  return {
    canAccessProgram,
    isProgramCompleted,
    canAccessOperatingPlatform,
    isProTrialActive,
    isProActive,
    programStatus: input.programStatus,
    programCompletedAt: iso(input.programCompletedAt),
    proTrialStartedAt: iso(input.proTrialStartedAt),
    proTrialEndsAt: iso(input.proTrialEndsAt),
    proAccessState,
    subscriptionStatus: input.subscriptionStatus
  };
}

export async function grantProgramEntitlement(
  database: Database,
  input: {
    userId: string;
    workspaceId: string;
    source: "manual" | "stripe_program_purchase" | "migration" | "synthetic";
    requestId: string;
  }
): Promise<{ id: string; created: boolean }> {
  return withTransaction(database, (transaction) => grantProgramEntitlementInTransaction(transaction, input));
}

export async function grantProgramEntitlementInTransaction(
  transaction: Transaction,
  input: {
    userId: string;
    workspaceId: string;
    source: "manual" | "stripe_program_purchase" | "migration" | "synthetic";
    requestId: string;
  }
): Promise<{ id: string; created: boolean }> {
    const existing = await oneOrNone<{ id: string; status: string }>(
      transaction,
      "SELECT id,status FROM program_entitlements WHERE user_id=$1 FOR UPDATE",
      [input.userId]
    );
    if (existing?.status === "active") return { id: existing.id, created: false };
    const id = existing?.id ?? newId();
    await transaction.query(
      `INSERT INTO program_entitlements
        (id,user_id,status,entitlement_source,granted_at)
       VALUES ($1,$2,'active',$3,clock_timestamp())
       ON CONFLICT (user_id) DO UPDATE SET
         status='active',entitlement_source=excluded.entitlement_source,
         granted_at=excluded.granted_at,updated_at=clock_timestamp()`,
      [id, input.userId, input.source]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.userId,
      actorType: "system",
      action: "program.entitlement_granted",
      targetType: "program_entitlement",
      targetId: id,
      origin: "domain",
      requestId: input.requestId,
      outcome: "succeeded",
      metadata: { source: input.source }
    });
    return { id, created: !existing };
}

export type ProgramPurchaseEvent = {
  eventId: string;
  eventType: "checkout.session.completed" | "checkout.session.async_payment_succeeded";
  providerCheckoutSessionId: string;
  userId: string;
  providerCustomerId: string | null;
  providerPaymentIntentId: string | null;
  paymentStatus: string;
  amountTotal: number | null;
  currency: string | null;
};

export type SubscriptionCheckoutEvent = {
  eventId: string;
  eventType: "checkout.session.completed" | "checkout.session.async_payment_failed" | "checkout.session.expired";
  providerCheckoutSessionId: string;
  providerSubscriptionId: string | null;
  userId: string;
};

export async function reconcileSubscriptionCheckout(
  database: Database,
  event: SubscriptionCheckoutEvent,
  requestId: string
): Promise<{ processed: boolean }> {
  return withTransaction(database, async (transaction) => {
    const claimed = await transaction.query(
      `INSERT INTO provider_events
        (id,provider,external_event_id,event_type,payload_digest,request_id)
       VALUES ($1,'stripe',$2,$3,$4,$5)
       ON CONFLICT (provider,external_event_id) DO NOTHING`,
      [newId(), event.eventId, event.eventType, publicDigest(JSON.stringify(event)), requestId]
    );
    if (claimed.rowCount !== 1) return { processed: false };
    const checkout = await oneOrNone<{ id: string; user_id: string; workspace_id: string; status: string }>(
      transaction,
      `SELECT id,user_id,workspace_id,status FROM subscription_checkout_sessions
        WHERE provider_checkout_session_id=$1 FOR UPDATE`,
      [event.providerCheckoutSessionId]
    );
    if (!checkout) throw new AppError(422, "subscription_checkout_unknown", "Subscription checkout is not recognized.");
    if (checkout.user_id !== event.userId) {
      throw new AppError(422, "subscription_checkout_identity_mismatch", "Subscription checkout identity does not match.");
    }
    const status = event.eventType === "checkout.session.completed"
      ? "completed"
      : event.eventType === "checkout.session.expired" ? "expired" : "failed";
    if (checkout.status !== "completed") {
      await transaction.query(
        `UPDATE subscription_checkout_sessions
            SET status=$2,provider_event_id=$3,provider_subscription_id=COALESCE($4,provider_subscription_id),
                completed_at=CASE WHEN $2='completed' THEN COALESCE(completed_at,clock_timestamp()) ELSE completed_at END,
                updated_at=clock_timestamp()
          WHERE id=$1`,
        [checkout.id, status, event.eventId, event.providerSubscriptionId]
      );
    }
    await recordAudit(transaction, {
      workspaceId: checkout.workspace_id,
      actorUserId: checkout.user_id,
      actorType: "provider",
      action: `subscription.checkout_${status}`,
      targetType: "subscription_checkout_session",
      targetId: checkout.id,
      origin: "stripe_webhook",
      requestId,
      outcome: "succeeded",
      metadata: { eventId: event.eventId, eventType: event.eventType }
    });
    await transaction.query(
      `UPDATE provider_events SET processed_at=clock_timestamp(),outcome='succeeded'
        WHERE provider='stripe' AND external_event_id=$1`,
      [event.eventId]
    );
    return { processed: true };
  });
}

export type ProgramCheckoutFailureEvent = {
  eventId: string;
  eventType: "checkout.session.async_payment_failed" | "checkout.session.expired";
  providerCheckoutSessionId: string;
  userId: string;
};

export async function reconcileProgramCheckoutFailure(
  database: Database,
  event: ProgramCheckoutFailureEvent,
  requestId: string
): Promise<{ processed: boolean }> {
  return withTransaction(database, async (transaction) => {
    const claimed = await transaction.query(
      `INSERT INTO provider_events
        (id,provider,external_event_id,event_type,payload_digest,request_id)
       VALUES ($1,'stripe',$2,$3,$4,$5)
       ON CONFLICT (provider,external_event_id) DO NOTHING`,
      [newId(), event.eventId, event.eventType, publicDigest(JSON.stringify(event)), requestId]
    );
    if (claimed.rowCount !== 1) return { processed: false };
    const checkout = await oneOrNone<{ id: string; user_id: string; workspace_id: string; status: string }>(
      transaction,
      `SELECT id,user_id,workspace_id,status FROM program_checkout_sessions
        WHERE provider_checkout_session_id=$1 FOR UPDATE`,
      [event.providerCheckoutSessionId]
    );
    if (!checkout) throw new AppError(422, "program_checkout_unknown", "Program checkout is not recognized.");
    if (checkout.user_id !== event.userId) {
      throw new AppError(422, "program_checkout_identity_mismatch", "Program checkout identity does not match.");
    }
    if (checkout.status !== "paid") {
      await transaction.query(
        `UPDATE program_checkout_sessions SET status=$2,provider_event_id=$3,updated_at=clock_timestamp()
          WHERE id=$1`,
        [checkout.id, event.eventType === "checkout.session.expired" ? "expired" : "failed", event.eventId]
      );
    }
    await recordAudit(transaction, {
      workspaceId: checkout.workspace_id,
      actorUserId: checkout.user_id,
      actorType: "provider",
      action: "program.checkout_failed",
      targetType: "program_checkout_session",
      targetId: checkout.id,
      origin: "stripe_webhook",
      requestId,
      outcome: "succeeded",
      metadata: { eventId: event.eventId, eventType: event.eventType }
    });
    await transaction.query(
      `UPDATE provider_events SET processed_at=clock_timestamp(),outcome='succeeded'
        WHERE provider='stripe' AND external_event_id=$1`,
      [event.eventId]
    );
    return { processed: true };
  });
}

export async function reconcileProgramPurchase(
  database: Database,
  event: ProgramPurchaseEvent,
  requestId: string
): Promise<{ processed: boolean; entitlementCreated: boolean }> {
  return withTransaction(database, async (transaction) => {
    const claimed = await transaction.query(
      `INSERT INTO provider_events
        (id,provider,external_event_id,event_type,payload_digest,request_id)
       VALUES ($1,'stripe',$2,$3,$4,$5)
       ON CONFLICT (provider,external_event_id) DO NOTHING`,
      [newId(), event.eventId, event.eventType, publicDigest(JSON.stringify(event)), requestId]
    );
    if (claimed.rowCount !== 1) return { processed: false, entitlementCreated: false };

    const checkout = await oneOrNone<{
      id: string;
      user_id: string;
      workspace_id: string;
      amount_total: number;
      currency: string;
      status: string;
    }>(
      transaction,
      `SELECT id,user_id,workspace_id,amount_total,currency,status
         FROM program_checkout_sessions
        WHERE provider_checkout_session_id=$1
        FOR UPDATE`,
      [event.providerCheckoutSessionId]
    );
    if (!checkout) throw new AppError(422, "program_checkout_unknown", "Program checkout is not recognized.");
    if (checkout.user_id !== event.userId) {
      throw new AppError(422, "program_checkout_identity_mismatch", "Program checkout identity does not match.");
    }
    if (
      event.paymentStatus !== "paid" ||
      event.amountTotal !== checkout.amount_total ||
      event.currency?.toLowerCase() !== checkout.currency
    ) {
      throw new AppError(422, "program_payment_not_verified", "Program payment could not be verified.");
    }

    await transaction.query(
      `UPDATE program_checkout_sessions
          SET status='paid',provider_customer_id=$2,provider_payment_intent_id=$3,provider_event_id=$4,
              completed_at=COALESCE(completed_at,clock_timestamp()),updated_at=clock_timestamp()
        WHERE id=$1`,
      [checkout.id, event.providerCustomerId, event.providerPaymentIntentId, event.eventId]
    );
    const entitlement = await grantProgramEntitlementInTransaction(transaction, {
      userId: checkout.user_id,
      workspaceId: checkout.workspace_id,
      source: "stripe_program_purchase",
      requestId
    });
    await recordAudit(transaction, {
      workspaceId: checkout.workspace_id,
      actorUserId: checkout.user_id,
      actorType: "provider",
      action: "program.purchase_reconciled",
      targetType: "program_checkout_session",
      targetId: checkout.id,
      origin: "stripe_webhook",
      requestId,
      outcome: "succeeded",
      metadata: { eventId: event.eventId, eventType: event.eventType, entitlementCreated: entitlement.created }
    });
    await transaction.query(
      `UPDATE provider_events SET processed_at=clock_timestamp(),outcome='succeeded'
        WHERE provider='stripe' AND external_event_id=$1`,
      [event.eventId]
    );
    return { processed: true, entitlementCreated: entitlement.created };
  });
}

export async function completeProgram(
  database: Database,
  configuration: AppConfig,
  input: { userId: string; workspaceId: string; requestId: string }
): Promise<{
  completedAt: string;
  trialStartedAt: string;
  trialEndsAt: string;
  newlyCompleted: boolean;
}> {
  return withTransaction(database, (transaction) => completeProgramInTransaction(transaction, configuration, input));
}

export async function completeProgramInTransaction(
  transaction: Transaction,
  configuration: AppConfig,
  input: { userId: string; workspaceId: string; requestId: string }
): Promise<{
  completedAt: string;
  trialStartedAt: string;
  trialEndsAt: string;
  newlyCompleted: boolean;
}> {
  const entitlement = await oneOrNone<{
      id: string;
      status: string;
      completed_at: Date | null;
      pro_trial_started_at: Date | null;
      pro_trial_ends_at: Date | null;
    }>(
      transaction,
      `SELECT id,status,completed_at,pro_trial_started_at,pro_trial_ends_at
         FROM program_entitlements WHERE user_id=$1 FOR UPDATE`,
      [input.userId]
    );
    if (!entitlement || entitlement.status !== "active") {
      throw new AppError(403, "program_entitlement_required", "An active Ryva Program entitlement is required.");
    }
    if (
      entitlement.completed_at &&
      entitlement.pro_trial_started_at &&
      entitlement.pro_trial_ends_at
    ) {
      return {
        completedAt: entitlement.completed_at.toISOString(),
        trialStartedAt: entitlement.pro_trial_started_at.toISOString(),
        trialEndsAt: entitlement.pro_trial_ends_at.toISOString(),
        newlyCompleted: false
      };
    }
    const updated = await transaction.query<{
      completed_at: Date;
      pro_trial_started_at: Date;
      pro_trial_ends_at: Date;
    }>(
      `WITH authoritative_time AS (SELECT clock_timestamp() AS completed_at)
       UPDATE program_entitlements pe SET
         completed_at=authoritative_time.completed_at,
         pro_trial_started_at=authoritative_time.completed_at,
         pro_trial_ends_at=authoritative_time.completed_at + ($2 * interval '1 day'),
         updated_at=authoritative_time.completed_at
       FROM authoritative_time
       WHERE pe.id=$1 AND pe.completed_at IS NULL
       RETURNING pe.completed_at,pe.pro_trial_started_at,pe.pro_trial_ends_at`,
      [entitlement.id, configuration.RYVA_PRO_TRIAL_DAYS]
    );
    const completion = updated.rows[0];
    if (!completion) throw new AppError(409, "program_completion_conflict", "Program completion could not be recorded.");
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.userId,
      actorType: "user",
      action: "program.completed",
      targetType: "program_entitlement",
      targetId: entitlement.id,
      origin: "domain",
      requestId: input.requestId,
      outcome: "succeeded",
      metadata: { trialDays: configuration.RYVA_PRO_TRIAL_DAYS }
    });
    return {
      completedAt: completion.completed_at.toISOString(),
      trialStartedAt: completion.pro_trial_started_at.toISOString(),
      trialEndsAt: completion.pro_trial_ends_at.toISOString(),
      newlyCompleted: true
    };
}
