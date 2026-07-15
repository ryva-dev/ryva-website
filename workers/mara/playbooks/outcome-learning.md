---
id: "mara.outcome-learning"
version: "1.0.0"
applicable_task_types: ["diagnose_low_response", "learn_from_historical_outreach", "planning"]
load_conditions: ["candidate:diagnose_low_response", "candidate:learn_from_historical_outreach", "state:outcomes"]
do_not_load_conditions: []
required_context: ["outcomes", "performance"]
optional_context: ["edits", "rejections"]
allowed_tools: ["analytics", "internal_task_create"]
autonomy_level: "internal_autonomous"
model_tier: "premium"
maximum_context_tokens: 1100
output_schema: "mara_shadow_plan_v1"
quality_rubric: ["hypothesis_not_false_cause", "future_plan_changes", "reassessment_defined"]
escalation_rules: ["low_confidence_hypothesis", "conflicting_evidence"]
---
# Outcome learning
Sends, replies, edits, rejections, deals, payments, and revenue must change future planning when evidence is sufficient. Form confidence-labeled hypotheses with provenance and counterevidence. Never convert correlation into certainty or share one creator’s private data with another.
