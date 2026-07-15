export const json = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

export async function ensureMaraRuntimeTables(store) {
  const kind = store.kind || (typeof store.activeDriver === "function" ? store.activeDriver() : "sqlite");
  const jsonType = kind === "postgres" ? "JSONB" : "TEXT";
  const timeType = kind === "postgres" ? "TIMESTAMPTZ" : "TEXT";
  const statements = [
    `CREATE TABLE IF NOT EXISTS agent_events (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,worker_id TEXT NOT NULL,event_type TEXT NOT NULL,source_type TEXT NOT NULL,source_id TEXT,entity_type TEXT,entity_id TEXT,payload_json ${jsonType} NOT NULL,provenance_json ${jsonType} NOT NULL,confidence REAL NOT NULL,occurred_at ${timeType} NOT NULL,ingested_at ${timeType} NOT NULL,idempotency_key TEXT NOT NULL,processed_at ${timeType},UNIQUE(user_id,worker_id,idempotency_key))`,
    `CREATE TABLE IF NOT EXISTS worker_business_state_snapshots (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,worker_id TEXT NOT NULL,state_version INTEGER NOT NULL,state_hash TEXT NOT NULL,state_json ${jsonType} NOT NULL,material_changes_json ${jsonType} NOT NULL,source_event_watermark ${timeType},created_at ${timeType} NOT NULL,UNIQUE(user_id,worker_id,state_version))`,
    `CREATE TABLE IF NOT EXISTS agent_work_candidates (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,worker_id TEXT NOT NULL,candidate_type TEXT NOT NULL,trigger_event_ids_json ${jsonType} NOT NULL,possible_commercial_objective TEXT NOT NULL,urgency TEXT NOT NULL,dependencies_json ${jsonType} NOT NULL,suggested_owner TEXT NOT NULL,required_capabilities_json ${jsonType} NOT NULL,user_action_may_be_required INTEGER NOT NULL,risk_class TEXT NOT NULL,evidence_json ${jsonType} NOT NULL,dedupe_key TEXT NOT NULL,expires_at ${timeType},status TEXT NOT NULL,created_at ${timeType} NOT NULL,UNIQUE(user_id,worker_id,dedupe_key))`,
    `CREATE TABLE IF NOT EXISTS agent_planning_runs (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,worker_id TEXT NOT NULL,mode TEXT NOT NULL,state_snapshot_id TEXT,state_hash TEXT,trigger_event_ids_json ${jsonType} NOT NULL,playbook_versions_json ${jsonType} NOT NULL,planner_input_json ${jsonType} NOT NULL,planner_output_json ${jsonType},legacy_plan_json ${jsonType} NOT NULL,diagnostics_json ${jsonType} NOT NULL,provider TEXT,model TEXT,estimated_cost_usd REAL NOT NULL,status TEXT NOT NULL,created_at ${timeType} NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS model_usage_events (id TEXT PRIMARY KEY,user_id TEXT,worker_id TEXT,task_type TEXT NOT NULL,provider TEXT NOT NULL,model TEXT NOT NULL,input_tokens INTEGER NOT NULL,output_tokens INTEGER NOT NULL,cached_tokens INTEGER NOT NULL,estimated_cost_usd REAL NOT NULL,latency_ms INTEGER NOT NULL,retry_count INTEGER NOT NULL,request_status TEXT NOT NULL,acceptance_status TEXT NOT NULL,related_event_id TEXT,related_task_id TEXT,related_opportunity_id TEXT,related_commercial_outcome_id TEXT,request_id TEXT,created_at ${timeType} NOT NULL)`
  ];
  for (const statement of statements) await store.execute(statement);
}
