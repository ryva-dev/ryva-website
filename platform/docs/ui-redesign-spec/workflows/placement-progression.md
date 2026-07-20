# Placement Progression

- **Purpose:** Show current Placement stage, entry/exit criteria, blocker, and next action while supporting pipeline scanning.
- **Used on:** Placement Kanban/Table and Placement detail.
- **Stages:** Identified → Qualified → Prepared → Contacted → Engaged → Information or Sample sent → Buyer review → Terms or Order discussion → Opening Order → Active Account → Reorder management; Closed lost and Disqualified are explicit outcomes.
- **Completed state:** Stage event exists and current records still support the transition history.
- **Current state:** Server Placement stage.
- **Blocked state:** Missing authority/decision/task, conflict, poor fit, triangle failure, unsupported claim, opt-out, stale approval/evidence, missing order condition.
- **Required next action:** Owned task or existing action; overdue/missing produces stalled flag, not a stage.
- **Visual form:** Kanban for pipeline scanning; compact step path on detail; Table always available.
- **Accessibility alternative:** Full sortable Table plus Change stage form.
- **Mobile alternative:** Stage-grouped list and vertical current-stage path.
- **Acceptance criteria:** Drag cannot bypass review; backward movement requires reason; AI cannot apply; stage changes never create actual revenue; audit preserved.

