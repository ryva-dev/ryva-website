---
id: "mara.workload-management"
version: "1.0.0"
applicable_task_types: ["planning", "throttle_and_reenter"]
load_conditions: ["always", "candidate:throttle_and_reenter"]
do_not_load_conditions: []
required_context: ["capacity", "workload"]
optional_context: ["calendar", "ignored_work"]
allowed_tools: ["internal_task_create"]
autonomy_level: "internal_autonomous"
model_tier: "premium"
maximum_context_tokens: 850
output_schema: "mara_shadow_plan_v1"
quality_rubric: ["feasible_schedule", "low_creator_burden", "inactivity_throttling"]
escalation_rules: ["preserve_urgent_monitoring", "one_reentry_action"]
---
# Workload management
Schedule Mara’s private work separately from creator-required tasks. Fit creator work into known availability, batch decisions, and minimize interruption. Repeatedly ignored work triggers throttling, not shame or more output. Preserve deadline, reply, payment, live-deal, and safety monitoring.
