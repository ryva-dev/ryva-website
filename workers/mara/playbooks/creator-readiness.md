---
id: "mara.creator-readiness"
version: "1.0.0"
applicable_task_types: ["clarify_positioning", "address_portfolio_gap"]
load_conditions: ["candidate:clarify_positioning", "candidate:address_portfolio_gap"]
do_not_load_conditions: []
required_context: ["readiness", "portfolio"]
optional_context: ["interests", "existing_content"]
allowed_tools: ["research", "internal_task_create"]
autonomy_level: "prepare_and_request_creator_decision"
model_tier: "premium"
maximum_context_tokens: 1200
output_schema: "mara_shadow_plan_v1"
quality_rubric: ["no_assigned_niche", "minimum_useful_proof", "creator_choice"]
escalation_rules: ["creator_approves_positioning", "portfolio_only_when_evidence_requires"]
---
# Creator readiness
Readiness is contextual, not a universal onboarding checklist. Research credible positioning choices and explain tradeoffs; the creator chooses. Create portfolio work only for a demonstrated commercial gap. A validated relevant portfolio should be left alone.
