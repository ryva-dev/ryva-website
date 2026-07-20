import { generateSecret } from "otplib";
import { config } from "../../config/src/index.js";
import { encryptSecret, hashPassword } from "../../domain/src/index.js";
import { createDatabase, withTransaction } from "./pool.js";

const ids = {
  active: "10000000-0000-4000-8000-000000000001",
  uncertified: "10000000-0000-4000-8000-000000000002",
  grace: "10000000-0000-4000-8000-000000000003",
  expired: "10000000-0000-4000-8000-000000000004",
  suspendedRead: "10000000-0000-4000-8000-000000000005",
  suspendedBlock: "10000000-0000-4000-8000-000000000006",
  revoked: "10000000-0000-4000-8000-000000000007",
  canceledPaid: "10000000-0000-4000-8000-000000000008",
  canceledEnded: "10000000-0000-4000-8000-000000000009",
  admin: "10000000-0000-4000-8000-000000000010",
  support: "10000000-0000-4000-8000-000000000011"
} as const;

export const syntheticPassword = "Synthetic!Passphrase2026";

type SeedUser = {
  id: string;
  email: string;
  name: string;
  role: "representative" | "admin" | "support";
  credential?: {
    status: "active" | "expired" | "suspended" | "revoked";
    expiresAt: Date;
    readOnly?: boolean;
  };
  subscription?: {
    status: "active" | "canceled";
    currentPeriodEnd: Date;
  };
};

const days = (count: number): Date => new Date(Date.now() + count * 24 * 60 * 60 * 1000);

export async function seedSynthetic(): Promise<void> {
  const configuration = config();
  if (configuration.NODE_ENV === "production" || !configuration.ALLOW_SYNTHETIC_SEED) {
    throw new Error("Synthetic seed is disabled. Set ALLOW_SYNTHETIC_SEED=1 outside production.");
  }
  const database = createDatabase(configuration);
  const passwordHash = await hashPassword(syntheticPassword, configuration.SESSION_PEPPER);
  const fieldKey =
    configuration.FIELD_ENCRYPTION_KEY ||
    "0000000000000000000000000000000000000000000000000000000000000000";
  const adminMfaSecret = generateSecret();
  const supportMfaSecret = generateSecret();
  const users: SeedUser[] = [
    {
      id: ids.active,
      email: "active@synthetic.ryva.test",
      name: "Avery Active",
      role: "representative",
      credential: { status: "active", expiresAt: days(365) },
      subscription: { status: "active", currentPeriodEnd: days(30) }
    },
    {
      id: ids.uncertified,
      email: "uncertified@synthetic.ryva.test",
      name: "Uma Uncertified",
      role: "representative",
      subscription: { status: "active", currentPeriodEnd: days(30) }
    },
    {
      id: ids.grace,
      email: "grace@synthetic.ryva.test",
      name: "Gale Grace",
      role: "representative",
      credential: { status: "expired", expiresAt: days(-5) },
      subscription: { status: "active", currentPeriodEnd: days(30) }
    },
    {
      id: ids.expired,
      email: "expired@synthetic.ryva.test",
      name: "Evan Expired",
      role: "representative",
      credential: { status: "expired", expiresAt: days(-45) },
      subscription: { status: "active", currentPeriodEnd: days(30) }
    },
    {
      id: ids.suspendedRead,
      email: "suspended-read@synthetic.ryva.test",
      name: "Sage Suspended",
      role: "representative",
      credential: { status: "suspended", expiresAt: days(180), readOnly: true },
      subscription: { status: "active", currentPeriodEnd: days(30) }
    },
    {
      id: ids.suspendedBlock,
      email: "suspended-blocked@synthetic.ryva.test",
      name: "Blake Blocked",
      role: "representative",
      credential: { status: "suspended", expiresAt: days(180), readOnly: false },
      subscription: { status: "active", currentPeriodEnd: days(30) }
    },
    {
      id: ids.revoked,
      email: "revoked@synthetic.ryva.test",
      name: "Riley Revoked",
      role: "representative",
      credential: { status: "revoked", expiresAt: days(180) },
      subscription: { status: "active", currentPeriodEnd: days(30) }
    },
    {
      id: ids.canceledPaid,
      email: "canceled-paid@synthetic.ryva.test",
      name: "Casey Paid Through",
      role: "representative",
      credential: { status: "active", expiresAt: days(365) },
      subscription: { status: "canceled", currentPeriodEnd: days(10) }
    },
    {
      id: ids.canceledEnded,
      email: "canceled-ended@synthetic.ryva.test",
      name: "Cameron Ended",
      role: "representative",
      credential: { status: "active", expiresAt: days(365) },
      subscription: { status: "canceled", currentPeriodEnd: days(-45) }
    },
    {
      id: ids.admin,
      email: "admin@synthetic.ryva.test",
      name: "Addison Admin",
      role: "admin"
    },
    {
      id: ids.support,
      email: "support@synthetic.ryva.test",
      name: "Sam Support",
      role: "support"
    }
  ];

  await withTransaction(database, async (transaction) => {
    for (const user of users) {
      const workspaceId = user.id.replace(/^1/, "2");
      const membershipId = user.id.replace(/^1/, "3");
      await transaction.query(
        `INSERT INTO users
          (id,email,email_verified_at,password_hash,name,status,mfa_secret_ciphertext)
         VALUES ($1,$2,now(),$3,$4,'active',$5)
         ON CONFLICT (id) DO UPDATE SET email=excluded.email, password_hash=excluded.password_hash,
           name=excluded.name, status='active', mfa_secret_ciphertext=excluded.mfa_secret_ciphertext,
           updated_at=now()`,
        [
          user.id,
          user.email,
          passwordHash,
          user.name,
          user.role === "admin"
            ? encryptSecret(adminMfaSecret, fieldKey)
            : user.role === "support"
              ? encryptSecret(supportMfaSecret, fieldKey)
              : null
        ]
      );
      await transaction.query(
        `INSERT INTO workspaces (id,name,status) VALUES ($1,$2,'active')
         ON CONFLICT (id) DO UPDATE SET name=excluded.name, status='active', updated_at=now()`,
        [workspaceId, `${user.name}'s synthetic workspace`]
      );
      await transaction.query(
        `INSERT INTO workspace_memberships (id,workspace_id,user_id,role,status)
         VALUES ($1,$2,$3,$4,'active')
         ON CONFLICT (workspace_id,user_id) DO UPDATE SET role=excluded.role,status='active',updated_at=now()`,
        [membershipId, workspaceId, user.id, user.role]
      );
      await transaction.query(
        `INSERT INTO user_profiles (user_id,workspace_id,outreach_name)
         VALUES ($1,$2,$3)
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id, workspaceId, user.name]
      );
      await transaction.query(
        `INSERT INTO workspace_settings (workspace_id) VALUES ($1)
         ON CONFLICT (workspace_id) DO NOTHING`,
        [workspaceId]
      );
      if (user.credential) {
        await transaction.query(
          `INSERT INTO certification_credentials
            (id,user_id,credential_type,credential_number_masked,status,issued_at,expires_at,
             verified_at,provider_reference,suspension_read_only_allowed,renewal_url)
           VALUES ($1,$2,'Ryva Brand Placement Certification',$3,$4,$5,$6,now(),$7,$8,$9)
           ON CONFLICT (provider_reference) DO UPDATE SET status=excluded.status,
             expires_at=excluded.expires_at, verified_at=now(),
             suspension_read_only_allowed=excluded.suspension_read_only_allowed,updated_at=now()`,
          [
            user.id.replace(/^1/, "4"),
            user.id,
            `••••${user.id.slice(-4)}`,
            user.credential.status,
            days(-365),
            user.credential.expiresAt,
            `synthetic:${user.id}`,
            user.credential.readOnly ?? false,
            "https://example.invalid/synthetic-renewal"
          ]
        );
      }
      if (user.subscription) {
        await transaction.query(
          `INSERT INTO subscription_entitlements
            (id,user_id,provider_customer_id,provider_subscription_id,status,current_period_end,price_id)
           VALUES ($1,$2,$3,$4,$5,$6,'synthetic-price')
           ON CONFLICT (user_id) DO UPDATE SET status=excluded.status,
             current_period_end=excluded.current_period_end,updated_at=now()`,
          [
            user.id.replace(/^1/, "5"),
            user.id,
            `synthetic_customer_${user.id}`,
            `synthetic_subscription_${user.id}`,
            user.subscription.status,
            user.subscription.currentPeriodEnd
          ]
        );
      }
    }

    const activeWorkspaceId = ids.active.replace(/^1/, "2");
    const syntheticRunId = "90000000-0000-4000-8000-000000000701";
    const syntheticContextId = "90000000-0000-4000-8000-000000000702";
    const syntheticSuggestionId = "90000000-0000-4000-8000-000000000703";
    const syntheticStatementId = "90000000-0000-4000-8000-000000000704";
    await transaction.query(
      `INSERT INTO ai_runs
        (id,workspace_id,requesting_user_id,use_case,target_type,target_id,user_instruction,
         prompt_template_key,prompt_template_version,policy_version,request_digest,context_digest,
         status,provider,model,model_version,provider_retention_mode,provider_training_allowed,
         input_tokens,output_tokens,cost_minor_units,cost_currency,latency_ms,started_at,completed_at)
       VALUES
        ($1,$2,$3,'daily_briefing','workspace',$4,'Summarize the synthetic workspace.',
         'responsible-ai.daily-briefing',1,'phase7-v1',
         repeat('a',64),repeat('b',64),'succeeded','synthetic-fixture',
         'synthetic-review-model','fixture-v1','not_applicable',false,80,45,0,'USD',15,
         now() - interval '5 minutes',now() - interval '5 minutes')
       ON CONFLICT (id) DO NOTHING`,
      [syntheticRunId, activeWorkspaceId, ids.active, activeWorkspaceId]
    );
    await transaction.query(
      `INSERT INTO ai_run_context_items
        (id,workspace_id,run_id,record_type,record_id,label,evidence_class,freshness_at,
         limitations,permitted_use,content_excerpt,content_digest,ordinal)
       VALUES
        ($1,$2,$3,'workspace',$4,'Synthetic workspace fixture','direct_evidence',now(),
         'This is an internal synthetic browser fixture, not externally sourced intelligence.',
         'Internal testing and interface review only.',
         'The synthetic workspace has no live commercial records.',repeat('c',64),1)
       ON CONFLICT (id) DO NOTHING`,
      [syntheticContextId, activeWorkspaceId, syntheticRunId, activeWorkspaceId]
    );
    await transaction.query(
      `INSERT INTO ai_suggestions
        (id,workspace_id,run_id,requesting_user_id,suggestion_type,target_type,target_id,title,
         original_content,structured_payload,confidence,confidence_subject,limitations,
         missing_evidence,contrary_evidence,status,generated_at,current_content)
       VALUES
        ($1,$2,$3,$4,'daily_briefing','workspace',$5,'Synthetic daily briefing',
         'No live priorities can be recommended because this workspace contains only synthetic access fixtures.',
         '{"fixture":true,"futureIntelligence":{"status":"not_connected"}}'::jsonb,
         'limited','workspace priorities',
         ARRAY['Synthetic fixture only; do not use for a commercial decision.'],
         ARRAY['Current qualified opportunities','Open buyer tasks','Verified reorder evidence'],
         ARRAY[]::text[],'generated',now() - interval '5 minutes',
         'No live priorities can be recommended because this workspace contains only synthetic access fixtures.')
       ON CONFLICT (id) DO NOTHING`,
      [syntheticSuggestionId, activeWorkspaceId, syntheticRunId, ids.active, activeWorkspaceId]
    );
    await transaction.query(
      `INSERT INTO ai_suggestion_statements
        (id,workspace_id,suggestion_id,statement_text,classification,confidence,ordinal)
       VALUES
        ($1,$2,$3,'The workspace contains only synthetic access fixtures.','direct_evidence','limited',1)
       ON CONFLICT (id) DO NOTHING`,
      [syntheticStatementId, activeWorkspaceId, syntheticSuggestionId]
    );
    await transaction.query(
      `INSERT INTO ai_statement_context_links
        (workspace_id,statement_id,context_item_id)
       VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [activeWorkspaceId, syntheticStatementId, syntheticContextId]
    );
  });
  await database.end();
  process.stdout.write(
    [
      "Synthetic Ryva Pro fixtures are ready.",
      `Representative login: active@synthetic.ryva.test / ${syntheticPassword}`,
      `Synthetic admin TOTP secret: ${adminMfaSecret}`,
      `Synthetic support TOTP secret: ${supportMfaSecret}`,
      "These identities are synthetic and must never be used in production."
    ].join("\n") + "\n"
  );
}

if (import.meta.url === `file://${process.argv[1]}`) await seedSynthetic();
