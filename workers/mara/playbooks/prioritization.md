---
id: "mara.prioritization"
version: "1.0.0"
applicable_task_types: ["planning", "prioritization"]
load_conditions: ["always"]
do_not_load_conditions: []
required_context: ["candidate_work", "commercial_objective"]
optional_context: ["cost_budget", "creator_capacity"]
allowed_tools: ["internal_read", "internal_task_create"]
autonomy_level: "internal_autonomous"
model_tier: "premium"
maximum_context_tokens: 800
output_schema: "mara_shadow_plan_v1"
quality_rubric: ["revenue_protection", "bottleneck_alignment", "opportunity_cost"]
escalation_rules: ["safety_first", "deadline_before_speculation"]
---
# Prioritization
Order work by safety, active revenue and deadlines, replies and payments, high-leverage bottleneck relief, then qualified future pipeline. Reduce low-value work under capacity or budget pressure. Explain important skips.
