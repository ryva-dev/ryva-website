import type { Database, Transaction } from "../../database/src/index.js";
import { oneOrNone, withTransaction } from "../../database/src/index.js";
import { AppError, newId } from "../../shared/src/index.js";
import { recordAudit } from "./audit.js";

export type CoreRecordType = "brand" | "product" | "business" | "contact";

type Definition = {
  table: string;
  titleColumn: string;
  statusColumn: string;
  select: string;
};

const definitions: Record<CoreRecordType, Definition> = {
  brand: {
    table: "brands",
    titleColumn: "public_name",
    statusColumn: "status",
    select:
      `id, workspace_id AS "workspaceId", public_name AS name, legal_name AS "legalName",
       website, identity_status AS "identityStatus", status, owner_user_id AS "ownerUserId",
       custom_fields AS "customFields", version, created_at AS "createdAt", updated_at AS "updatedAt"`
  },
  product: {
    table: "products",
    titleColumn: "name",
    statusColumn: "status",
    select:
      `id, workspace_id AS "workspaceId", brand_id AS "brandId", name, category, summary,
       identity_status AS "identityStatus", status, owner_user_id AS "ownerUserId",
       custom_fields AS "customFields", version, created_at AS "createdAt", updated_at AS "updatedAt"`
  },
  business: {
    table: "businesses",
    titleColumn: "name",
    statusColumn: "status",
    select:
      `id, workspace_id AS "workspaceId", name, legal_name AS "legalName",
       business_type AS "businessType", category, website, status,
       owner_user_id AS "ownerUserId", geography, fit_rationale AS "fitRationale",
       custom_fields AS "customFields", version, created_at AS "createdAt", updated_at AS "updatedAt"`
  },
  contact: {
    table: "contacts",
    titleColumn: "name",
    statusColumn: "verification_status",
    select:
      `id, workspace_id AS "workspaceId", brand_id AS "brandId", business_id AS "businessId",
       name, role, email, phone, verification_status AS "verificationStatus",
       permission_status AS "permissionStatus", source_id AS "sourceId",
       professional_handle AS "professionalHandle",seniority,location,
       last_verified_at AS "lastVerifiedAt",source_observed_at AS "sourceObservedAt",
       verification_notes AS "verificationNotes",
       owner_user_id AS "ownerUserId", custom_fields AS "customFields",
       version, created_at AS "createdAt", updated_at AS "updatedAt"`
  }
};

export function isCoreRecordType(value: unknown): value is CoreRecordType {
  return typeof value === "string" && value in definitions;
}

function definition(type: string): Definition {
  if (!isCoreRecordType(type)) throw new AppError(404, "record_type_unknown", "Record type not found.");
  return definitions[type];
}

export async function listCoreRecords(
  database: Database,
  input: {
    workspaceId: string;
    type: CoreRecordType;
    query?: string;
    status?: string;
    archived?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ records: Record<string, unknown>[]; total: number }> {
  const selected = definition(input.type);
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const values: unknown[] = [input.workspaceId];
  const conditions = ["workspace_id=$1"];
  if (!input.archived) conditions.push("archived_at IS NULL");
  if (input.status) {
    values.push(input.status);
    conditions.push(`${selected.statusColumn}=$${values.length}`);
  }
  if (input.query) {
    values.push(input.query);
    conditions.push(
      `(${selected.titleColumn} ILIKE '%'||$${values.length}||'%' OR similarity(${selected.titleColumn},$${values.length})>0.25)`
    );
  }
  const where = conditions.join(" AND ");
  const count = await database.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM ${selected.table} WHERE ${where}`,
    values
  );
  values.push(limit, offset);
  const result = await database.query(
    `SELECT ${selected.select} FROM ${selected.table} WHERE ${where}
     ORDER BY updated_at DESC,id LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { records: result.rows as Record<string, unknown>[], total: count.rows[0]?.count ?? 0 };
}

export async function getCoreRecord(
  database: Database | Transaction,
  workspaceId: string,
  type: CoreRecordType,
  id: string
): Promise<Record<string, unknown> | null> {
  const selected = definition(type);
  return oneOrNone(
    database,
    `SELECT ${selected.select} FROM ${selected.table}
      WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL`,
    [workspaceId, id]
  );
}

export async function createCoreRecord(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    type: CoreRecordType;
    values: Record<string, unknown>;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const id = newId();
    if (input.type === "brand") {
      await transaction.query(
        `INSERT INTO brands
          (id,workspace_id,public_name,legal_name,website,identity_status,status,owner_user_id)
         VALUES($1,$2,$3,$4,$5,'unverified','discovered',$6)`,
        [
          id,
          input.workspaceId,
          input.values.name,
          input.values.legalName ?? null,
          input.values.website ?? null,
          input.actorUserId
        ]
      );
    } else if (input.type === "product") {
      const brand = await getCoreRecord(
        transaction,
        input.workspaceId,
        "brand",
        String(input.values.brandId)
      );
      if (!brand) throw new AppError(422, "brand_not_found", "The selected Brand was not found.");
      await transaction.query(
        `INSERT INTO products
          (id,workspace_id,brand_id,name,category,summary,identity_status,status,owner_user_id)
         VALUES($1,$2,$3,$4,$5,$6,'unverified','discovered',$7)`,
        [
          id,
          input.workspaceId,
          input.values.brandId,
          input.values.name,
          input.values.category,
          input.values.summary ?? "",
          input.actorUserId
        ]
      );
    } else if (input.type === "business") {
      await transaction.query(
        `INSERT INTO businesses
          (id,workspace_id,name,legal_name,business_type,category,website,status,owner_user_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,'research',$8)`,
        [
          id,
          input.workspaceId,
          input.values.name,
          input.values.legalName ?? null,
          input.values.businessType,
          input.values.category,
          input.values.website ?? null,
          input.actorUserId
        ]
      );
    } else {
      const parentType = input.values.parentType === "brand" ? "brand" : "business";
      const parent = await getCoreRecord(
        transaction,
        input.workspaceId,
        parentType,
        String(input.values.parentId)
      );
      if (!parent) throw new AppError(422, "contact_parent_not_found", "Contact parent was not found.");
      await transaction.query(
        `INSERT INTO contacts
          (id,workspace_id,brand_id,business_id,name,role,email,phone,
           verification_status,permission_status,owner_user_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,'unverified','unknown',$9)`,
        [
          id,
          input.workspaceId,
          parentType === "brand" ? input.values.parentId : null,
          parentType === "business" ? input.values.parentId : null,
          input.values.name,
          input.values.role,
          input.values.email ?? null,
          input.values.phone ?? null,
          input.actorUserId
        ]
      );
    }
    const created = await getCoreRecord(transaction, input.workspaceId, input.type, id);
    if (!created) throw new Error("Created record could not be read.");
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status)
       VALUES($1,$2,'record_created',$3,$4,$5,$6,'completed')`,
      [newId(), input.workspaceId, input.actorUserId, input.type, id, `${input.type} created`]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: `${input.type}.created`,
      targetType: input.type,
      targetId: id,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      after: created
    });
    return created;
  });
}

const editableFields: Record<CoreRecordType, Record<string, string>> = {
  brand: {
    name: "public_name",
    legalName: "legal_name",
    website: "website",
    identityStatus: "identity_status",
    status: "status",
  },
  product: {
    name: "name",
    category: "category",
    summary: "summary",
    identityStatus: "identity_status",
    status: "status",
  },
  business: {
    name: "name",
    legalName: "legal_name",
    businessType: "business_type",
    category: "category",
    website: "website",
    status: "status",
    geography: "geography",
    fitRationale: "fit_rationale",
  },
  contact: {
    name: "name",
    role: "role",
    email: "email",
    phone: "phone",
    verificationStatus: "verification_status",
    permissionStatus: "permission_status",
  }
};

export async function updateCoreRecord(
  database: Database,
  input: {
    workspaceId: string;
    actorUserId: string;
    requestId: string;
    type: CoreRecordType;
    id: string;
    version: number;
    changes: Record<string, unknown>;
  }
): Promise<Record<string, unknown>> {
  return withTransaction(database, async (transaction) => {
    const before = await getCoreRecord(transaction, input.workspaceId, input.type, input.id);
    if (!before) throw new AppError(404, "record_not_found", "Record not found.");
    const allowed = editableFields[input.type];
    const entries = Object.entries(input.changes).filter(([key]) => key in allowed);
    if (entries.length === 0) throw new AppError(422, "no_changes", "No editable changes were supplied.");
    const values: unknown[] = [input.workspaceId, input.id, input.version];
    const sets = entries.map(([key, value]) => {
      values.push(value);
      return `${allowed[key]}=$${values.length}`;
    });
    const selected = definition(input.type);
    const result = await transaction.query(
      `UPDATE ${selected.table} SET ${sets.join(",")},version=version+1,updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND version=$3 AND archived_at IS NULL`,
      values
    );
    if (result.rowCount !== 1) {
      throw new AppError(
        409,
        "version_conflict",
        "This record changed after you opened it. Reload and review the latest version."
      );
    }
    const after = await getCoreRecord(transaction, input.workspaceId, input.type, input.id);
    await transaction.query(
      `INSERT INTO activities
        (id,workspace_id,activity_type,actor_user_id,subject_type,subject_id,summary,status,metadata)
       VALUES($1,$2,'record_updated',$3,$4,$5,$6,'completed',$7)`,
      [
        newId(),
        input.workspaceId,
        input.actorUserId,
        input.type,
        input.id,
        `${input.type} updated`,
        { fields: entries.map(([key]) => key) }
      ]
    );
    await recordAudit(transaction, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      actorType: "user",
      action: `${input.type}.updated`,
      targetType: input.type,
      targetId: input.id,
      origin: "api",
      requestId: input.requestId,
      outcome: "succeeded",
      before,
      after
    });
    return after!;
  });
}

export async function getRecordContext(
  database: Database,
  workspaceId: string,
  type: CoreRecordType,
  id: string
): Promise<Record<string, unknown>> {
  const record = await getCoreRecord(database, workspaceId, type, id);
  if (!record) throw new AppError(404, "record_not_found", "Record not found.");
  let relatedQuery =
    `SELECT NULL::uuid AS id,NULL::text AS type,NULL::text AS name WHERE false`;
  if (type === "brand") {
    relatedQuery =
      `SELECT id,'product'::text AS type,name FROM products
        WHERE workspace_id=$1 AND brand_id=$2 AND archived_at IS NULL ORDER BY name`;
  } else if (type === "product") {
    relatedQuery =
      `SELECT b.id,'brand'::text AS type,b.public_name AS name FROM products p
       JOIN brands b ON b.workspace_id=p.workspace_id AND b.id=p.brand_id
       WHERE p.workspace_id=$1 AND p.id=$2`;
  } else if (type === "business") {
    relatedQuery =
      `SELECT id,'contact'::text AS type,name FROM contacts
        WHERE workspace_id=$1 AND business_id=$2 AND archived_at IS NULL ORDER BY name`;
  } else {
    relatedQuery =
      `SELECT coalesce(b.id,bu.id) AS id,
              CASE WHEN b.id IS NOT NULL THEN 'brand' ELSE 'business' END::text AS type,
              coalesce(b.public_name,bu.name) AS name
         FROM contacts c
         LEFT JOIN brands b ON b.workspace_id=c.workspace_id AND b.id=c.brand_id
         LEFT JOIN businesses bu ON bu.workspace_id=c.workspace_id AND bu.id=c.business_id
        WHERE c.workspace_id=$1 AND c.id=$2`;
  }
  const buyerQuery = type === "business"
    ? `SELECT bb.id,bb.contact_id AS "contactId",c.name,bb.buyer_role AS "buyerRole",
              bb.decision_context AS "decisionContext",bb.authority_evidence AS "authorityEvidence"
         FROM business_buyers bb JOIN contacts c
           ON c.workspace_id=bb.workspace_id AND c.id=bb.contact_id
        WHERE bb.workspace_id=$1 AND bb.business_id=$2 ORDER BY c.name`
    : `SELECT NULL::uuid AS id,NULL::uuid AS "contactId",NULL::text AS name,
              NULL::text AS "buyerRole",NULL::text AS "decisionContext",
              NULL::text AS "authorityEvidence"
         WHERE $1::uuid IS NULL AND $2::uuid IS NULL`;
  const [related, buyers, evidence, risks, decisions, notes, tasks, documents, activities] = await Promise.all([
    database.query(relatedQuery, [workspaceId, id]),
    database.query(buyerQuery, [workspaceId, id]),
    database.query(
      `SELECT e.*,s.reference AS source_reference FROM evidence_records e
       LEFT JOIN sources s ON s.id=e.source_id AND s.workspace_id=e.workspace_id
       WHERE e.workspace_id=$1 AND e.subject_type=$2 AND e.subject_id=$3
       ORDER BY e.reviewed_at DESC`,
      [workspaceId, type, id]
    ),
    database.query(
      `SELECT * FROM risk_flags WHERE workspace_id=$1 AND subject_type=$2 AND subject_id=$3
       ORDER BY created_at DESC`,
      [workspaceId, type, id]
    ),
    database.query(
      `SELECT * FROM decision_records WHERE workspace_id=$1 AND subject_type=$2 AND subject_id=$3
       ORDER BY created_at DESC`,
      [workspaceId, type, id]
    ),
    database.query(
      `SELECT id,author_user_id AS "authorUserId",note_type AS "noteType",body,pinned,
              version,created_at AS "createdAt",updated_at AS "updatedAt"
       FROM notes WHERE workspace_id=$1 AND subject_type=$2 AND subject_id=$3
         AND archived_at IS NULL ORDER BY pinned DESC,created_at DESC`,
      [workspaceId, type, id]
    ),
    database.query(
      `SELECT id,title,status,priority,due_at AS "dueAt",blocker,mandatory_gate AS "mandatoryGate",
              version,created_at AS "createdAt"
       FROM tasks WHERE workspace_id=$1 AND subject_type=$2 AND subject_id=$3
       ORDER BY completed_at NULLS FIRST,due_at NULLS LAST`,
      [workspaceId, type, id]
    ),
    database.query(
      `SELECT id,name,document_type AS "documentType",media_type AS "mediaType",
              byte_size AS "byteSize",sha256,scan_status AS "scanStatus",
              confidentiality,status,created_at AS "createdAt"
       FROM documents WHERE workspace_id=$1 AND subject_type=$2 AND subject_id=$3
         AND status<>'deleted' ORDER BY created_at DESC`,
      [workspaceId, type, id]
    ),
    database.query(
      `SELECT id,activity_type AS "activityType",summary,status,occurred_at AS "occurredAt",metadata
       FROM activities WHERE workspace_id=$1 AND subject_type=$2 AND subject_id=$3
       ORDER BY occurred_at DESC LIMIT 100`,
      [workspaceId, type, id]
    )
  ]);
  return {
    record,
    related: related.rows,
    buyers: buyers.rows,
    evidence: evidence.rows,
    risks: risks.rows,
    decisions: decisions.rows,
    notes: notes.rows,
    tasks: tasks.rows,
    documents: documents.rows,
    activities: activities.rows
  };
}

export async function searchWorkspace(
  database: Database,
  workspaceId: string,
  query: string,
  limit = 30,
  offset = 0,
  type?: string,
  status?: string
): Promise<Record<string, unknown>[]> {
  const value = query.trim();
  if (!value) return [];
  const result = await database.query(
    `WITH candidates AS (
      SELECT 'brand'::text AS type,id,public_name AS title,coalesce(legal_name,'') AS subtitle,status,updated_at
        FROM brands WHERE workspace_id=$1 AND archived_at IS NULL
      UNION ALL
      SELECT 'product',id,name,category,status,updated_at FROM products WHERE workspace_id=$1 AND archived_at IS NULL
      UNION ALL
      SELECT 'business',id,name,business_type,status,updated_at FROM businesses WHERE workspace_id=$1 AND archived_at IS NULL
      UNION ALL
      SELECT 'contact',id,name,role,verification_status,updated_at FROM contacts WHERE workspace_id=$1 AND archived_at IS NULL
      UNION ALL
      SELECT 'note',id,left(body,120),subject_type,'active',updated_at FROM notes WHERE workspace_id=$1 AND archived_at IS NULL
      UNION ALL
      SELECT 'document',id,name,document_type,status,updated_at FROM documents WHERE workspace_id=$1 AND status<>'deleted'
      UNION ALL
      SELECT 'account',a.id,b.public_name||' → '||bu.name,
             'Operational commercial Account',a.status,a.updated_at
        FROM accounts a JOIN brands b ON b.workspace_id=a.workspace_id AND b.id=a.brand_id
        JOIN businesses bu ON bu.workspace_id=a.workspace_id AND bu.id=a.business_id
       WHERE a.workspace_id=$1 AND a.archived_at IS NULL
      UNION ALL
      SELECT 'order',o.id,o.order_number,b.public_name||' → '||bu.name,o.status,o.updated_at
        FROM orders o JOIN brands b ON b.workspace_id=o.workspace_id AND b.id=o.brand_id
        JOIN businesses bu ON bu.workspace_id=o.workspace_id AND bu.id=o.business_id
       WHERE o.workspace_id=$1 AND o.archived_at IS NULL
      UNION ALL
      SELECT 'commission',c.id,'Commission · '||o.order_number,
             b.public_name||' · '||c.currency,c.status,c.updated_at
        FROM commissions c JOIN orders o ON o.workspace_id=c.workspace_id AND o.id=c.order_id
        JOIN brands b ON b.workspace_id=c.workspace_id AND b.id=c.brand_id
       WHERE c.workspace_id=$1 AND c.archived_at IS NULL
      UNION ALL
      SELECT 'placement_opportunity',p.id,b.public_name||' → '||bu.name,
             'Placement opportunity',p.stage,p.updated_at
        FROM placement_opportunities p
        JOIN brands b ON b.workspace_id=p.workspace_id AND b.id=p.brand_id
        JOIN businesses bu ON bu.workspace_id=p.workspace_id AND bu.id=p.business_id
       WHERE p.workspace_id=$1 AND p.archived_at IS NULL
    )
    SELECT candidates.type,
           coalesce(alias.canonical_id,candidates.id) AS id,
           candidates.id AS "matchedId",title,subtitle,status,updated_at AS "updatedAt",
           (alias.canonical_id IS NOT NULL) AS "resolvedFromAlias",
           CASE WHEN candidates.id::text=$2 THEN 100
                WHEN lower(title)=lower($2) THEN 50
                ELSE similarity(title,$2) END AS rank
      FROM candidates
      LEFT JOIN record_aliases alias ON alias.workspace_id=$1
       AND alias.record_type=candidates.type AND alias.alias_id=candidates.id
     WHERE (candidates.id::text=$2 OR title ILIKE '%'||$2||'%' OR similarity(title,$2)>0.2)
       AND ($5::text IS NULL OR candidates.type=$5)
       AND ($6::text IS NULL OR candidates.status=$6)
     ORDER BY rank DESC,updated_at DESC,candidates.id
     LIMIT $3 OFFSET $4`,
    [workspaceId, value, Math.min(Math.max(limit, 1), 100), Math.max(offset,0), type??null,status??null]
  );
  return result.rows as Record<string, unknown>[];
}

export async function duplicateCandidates(
  database: Database,
  workspaceId: string,
  type: CoreRecordType,
  name: string
): Promise<Record<string, unknown>[]> {
  const selected = definition(type);
  const result = await database.query(
    `SELECT id,${selected.titleColumn} AS name,${selected.statusColumn} AS status,
            similarity(${selected.titleColumn},$2) AS similarity,
            CASE WHEN lower(${selected.titleColumn})=lower($2) THEN ARRAY['exact_normalized_name']
                 ELSE ARRAY['similar_name'] END AS signals
       FROM ${selected.table}
      WHERE workspace_id=$1 AND archived_at IS NULL
        AND (lower(${selected.titleColumn})=lower($2) OR similarity(${selected.titleColumn},$2)>0.35)
      ORDER BY similarity DESC LIMIT 10`,
    [workspaceId, name.trim()]
  );
  return result.rows as Record<string, unknown>[];
}
