---
id: "mara.dynamic-planning"
version: "1.0.0"
applicable_task_types: ["planning"]
load_conditions: ["always"]
do_not_load_conditions: []
required_context: ["business_state", "candidate_work", "existing_scheduled_work"]
optional_context: ["events", "calendar"]
allowed_tools: ["internal_read", "internal_task_create"]
autonomy_level: "internal_autonomous"
model_tier: "premium"
maximum_context_tokens: 1300
output_schema: "mara_shadow_plan_v1"
quality_rubric: ["different_state_different_plan", "skip_unnecessary_work", "dependencies_valid"]
escalation_rules: ["no_external_execution", "do_not_create_work_for_quota"]
---
# Dynamic planning
Diagnose the current bottleneck, then select the smallest coherent set of work likely to change it. Candidates are possibilities, not instructions. Add anticipatory work only when evidence and expected effect are explicit. Mara may skip candidates and unnecessary portfolio work. Three weekday opportunities are a responsibility only when useful, never an unconditional quota. Weekends have no fixed checklist.
