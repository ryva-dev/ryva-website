import type { Database } from "../../database/src/index.js";
import { oneOrNone, withTransaction } from "../../database/src/index.js";
import { AppError } from "../../shared/src/index.js";
import { recordAudit } from "./audit.js";

export type CredentialView = {
  id: string;
  credentialType: string;
  credentialNumberMasked: string;
  status: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  verifiedAt: Date;
  providerReference: string;
  renewalUrl: string | null;
};

export type SubscriptionView = {
  id: string;
  status: string;
  currentPeriodEnd: Date | null;
  trialEnd: Date | null;
  cancelAt: Date | null;
  pastDueSince: Date | null;
  priceId: string | null;
  hasCustomer: boolean;
};

export async function getCredential(database: Database, userId: string): Promise<CredentialView | null> {
  return oneOrNone<CredentialView>(
    database,
    `SELECT id, credential_type AS "credentialType",
            credential_number_masked AS "credentialNumberMasked", status,
            issued_at AS "issuedAt", expires_at AS "expiresAt", verified_at AS "verifiedAt",
            provider_reference AS "providerReference", renewal_url AS "renewalUrl"
       FROM certification_credentials WHERE user_id=$1
      ORDER BY verified_at DESC LIMIT 1`,
    [userId]
  );
}

export async function getSubscription(
  database: Database,
  userId: string
): Promise<SubscriptionView | null> {
  return oneOrNone<SubscriptionView>(
    database,
    `SELECT id, status, current_period_end AS "currentPeriodEnd", trial_end AS "trialEnd",
            cancel_at AS "cancelAt", past_due_since AS "pastDueSince", price_id AS "priceId",
            provider_customer_id IS NOT NULL AS "hasCustomer"
       FROM subscription_entitlements WHERE user_id=$1`,
    [userId]
  );
}

export type ProfileView = {
  userId: string;
  workspaceId: string;
  name: string;
  email: string;
  timeZone: string;
  locale: string;
  professionalTitle: string;
  outreachName: string;
  outreachSignature: string;
  currency: string;
  categoryInterests: string[];
  businessTypeInterests: string[];
  geographicPreferences: string[];
  experienceLevel: string;
  workingHours: Record<string, unknown>;
  version: number;
};

export async function getProfile(
  database: Database,
  userId: string,
  workspaceId: string
): Promise<ProfileView | null> {
  return oneOrNone<ProfileView>(
    database,
    `SELECT u.id AS "userId", p.workspace_id AS "workspaceId", u.name, u.email,
            u.time_zone AS "timeZone", u.locale, p.professional_title AS "professionalTitle",
            p.outreach_name AS "outreachName", p.outreach_signature AS "outreachSignature",
            p.currency, p.category_interests AS "categoryInterests",
            p.business_type_interests AS "businessTypeInterests",
            p.geographic_preferences AS "geographicPreferences",
            p.experience_level AS "experienceLevel", p.working_hours AS "workingHours",
            p.version
       FROM users u JOIN user_profiles p ON p.user_id=u.id
      WHERE u.id=$1 AND p.workspace_id=$2`,
    [userId, workspaceId]
  );
}

export async function updateProfile(
  database: Database,
  input: {
    userId: string;
    workspaceId: string;
    requestId: string;
    version: number;
    name: string;
    timeZone: string;
    locale: string;
    professionalTitle: string;
    outreachName: string;
    outreachSignature: string;
    currency: string;
    categoryInterests: string[];
    businessTypeInterests: string[];
    geographicPreferences: string[];
    experienceLevel: string;
    workingHours: Record<string, unknown>;
  }
): Promise<ProfileView> {
  await withTransaction(database, async (transaction) => {
    const before = await transaction.query(
      `SELECT u.name, u.time_zone, u.locale, p.* FROM users u
       JOIN user_profiles p ON p.user_id=u.id
       WHERE u.id=$1 AND p.workspace_id=$2 FOR UPDATE`,
      [input.userId, input.workspaceId]
    );
    const previous = before.rows[0] as Record<string, unknown> | undefined;
    if (!previous) throw new AppError(404, "profile_not_found", "Profile not found.");
    if (Number(previous.version) !== input.version) {
      throw new AppError(
        409,
        "version_conflict",
        "This profile changed after you opened it. Reload and review the latest version."
      );
    }
    await transaction.query(
      `UPDATE users SET name=$2, time_zone=$3, locale=$4, version=version+1, updated_at=now()
        WHERE id=$1`,
      [input.userId, input.name, input.timeZone, input.locale]
    );
    const update = await transaction.query(
      `UPDATE user_profiles SET professional_title=$3, outreach_name=$4,
              outreach_signature=$5, currency=$6, category_interests=$7,
              business_type_interests=$8, geographic_preferences=$9,
              experience_level=$10, working_hours=$11, version=version+1, updated_at=now()
        WHERE user_id=$1 AND workspace_id=$2 AND version=$12`,
      [
        input.userId,
        input.workspaceId,
        input.professionalTitle,
        input.outreachName,
        input.outreachSignature,
        input.currency,
        JSON.stringify(input.categoryInterests),
        JSON.stringify(input.businessTypeInterests),
        JSON.stringify(input.geographicPreferences),
        input.experienceLevel,
        JSON.stringify(input.workingHours),
        input.version
      ]
    );
    if (update.rowCount !== 1) throw new AppError(409, "version_conflict", "Profile update conflicted.");
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.userId,
      actorType: "user",
      action: "profile.updated",
      targetType: "profile",
      targetId: input.userId,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      before: previous,
      after: { ...input, requestId: undefined }
    });
  });
  const result = await getProfile(database, input.userId, input.workspaceId);
  if (!result) throw new Error("Profile disappeared after update.");
  return result;
}

export type SettingsView = {
  workspaceId: string;
  quietHours: Record<string, unknown>;
  notificationPreferences: Record<string, unknown>;
  taskDefaults: Record<string, unknown>;
  aiPreferences: Record<string, unknown>;
  version: number;
};

export async function getSettings(
  database: Database,
  workspaceId: string
): Promise<SettingsView | null> {
  return oneOrNone<SettingsView>(
    database,
    `SELECT workspace_id AS "workspaceId", quiet_hours AS "quietHours",
            notification_preferences AS "notificationPreferences",
            task_defaults AS "taskDefaults", ai_preferences AS "aiPreferences", version
       FROM workspace_settings WHERE workspace_id=$1`,
    [workspaceId]
  );
}

export async function updateSettings(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    version: number;
    quietHours: Record<string, unknown>;
    notificationPreferences: Record<string, unknown>;
    taskDefaults: Record<string, unknown>;
    aiPreferences: Record<string, unknown>;
  }
): Promise<SettingsView> {
  await withTransaction(database, async (transaction) => {
    const before = await transaction.query(
      "SELECT * FROM workspace_settings WHERE workspace_id=$1 FOR UPDATE",
      [input.workspaceId]
    );
    const previous = before.rows[0] as Record<string, unknown> | undefined;
    if (!previous) throw new AppError(404, "settings_not_found", "Settings not found.");
    const result = await transaction.query(
      `UPDATE workspace_settings SET quiet_hours=$2, notification_preferences=$3,
              task_defaults=$4, ai_preferences=$5, version=version+1, updated_at=now()
        WHERE workspace_id=$1 AND version=$6`,
      [
        input.workspaceId,
        input.quietHours,
        input.notificationPreferences,
        input.taskDefaults,
        {
          ...input.aiPreferences,
          enabled: input.aiPreferences.enabled === true,
          providerTrainingAllowed: false
        },
        input.version
      ]
    );
    if (result.rowCount !== 1) {
      throw new AppError(
        409,
        "version_conflict",
        "These settings changed after you opened them. Reload before saving."
      );
    }
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: "workspace_settings.updated",
      targetType: "workspace_settings",
      targetId: input.workspaceId,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      before: previous,
      after: input
    });
  });
  const result = await getSettings(database, input.workspaceId);
  if (!result) throw new Error("Settings disappeared after update.");
  return result;
}
