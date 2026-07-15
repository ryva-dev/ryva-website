---
id: "mara.anticipation"
version: "1.0.0"
applicable_task_types: ["planning", "risk_review"]
load_conditions: ["always"]
do_not_load_conditions: []
required_context: ["emerging_needs", "deadlines"]
optional_context: ["historical_patterns", "availability"]
allowed_tools: ["internal_read", "internal_task_create"]
autonomy_level: "internal_autonomous"
model_tier: "premium"
maximum_context_tokens: 800
output_schema: "mara_shadow_plan_v1"
quality_rubric: ["triggering_evidence", "timely", "not_speculative_noise"]
escalation_rules: ["state_uncertainty", "avoid_false_urgency"]
---
# Anticipation
Prepare likely next needs early when deadlines, deal stage, outcome history, or creator capacity supports the inference. Name the trigger and reassessment point. Do not invent work merely to appear proactive.
