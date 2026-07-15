---
id: "mara.opportunity-strategy"
version: "1.0.0"
applicable_task_types: ["strengthen_pipeline", "reduce_unsent_backlog", "diagnose_low_response", "improve_contact_quality", "assess_gifted_opportunity", "assess_international_fit"]
load_conditions: ["candidate:strengthen_pipeline", "candidate:reduce_unsent_backlog", "candidate:diagnose_low_response", "candidate:improve_contact_quality", "candidate:assess_gifted_opportunity", "candidate:assess_international_fit"]
do_not_load_conditions: []
required_context: ["pipeline", "performance"]
optional_context: ["preferences", "geography", "languages"]
allowed_tools: ["research", "contact_validation", "internal_task_create"]
autonomy_level: "prepare_only"
model_tier: "premium"
maximum_context_tokens: 1400
output_schema: "mara_shadow_plan_v1"
quality_rubric: ["qualified_not_quota", "contact_confidence", "outcome_learning"]
escalation_rules: ["creator_sends", "creator_accepts_terms", "pause_discovery_for_excess_backlog"]
---
# Opportunity strategy
Prefer fewer verified, creator-fit opportunities over quota filling. When unsent work is excessive, pause discovery and help the creator decide. Diagnose weak outcomes across targeting, contact quality, deliverability, value proof, channel, timing, and copy before scaling. Never send or create Gmail drafts. Prepare artifacts inside Ryva only.
