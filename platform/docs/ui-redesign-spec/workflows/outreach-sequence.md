# Outreach Sequence

- **Purpose:** Explain human-controlled review tasks and why a sequence is active, waiting, stopped, or complete.
- **Used on:** Outreach Sequences and selected enrollment context.
- **Nodes:** Enrolled with valid authority/recipient → Review first draft → Explicit human approval/send → Wait until due → Recheck authority/conflict/suppression/reply → Prepare follow-up review task → Human approval/send or Stop.
- **Completed state:** Review/send step completed by a named human and provider outcome recorded separately.
- **Current state:** Due review task or waiting period.
- **Blocked/stopped state:** Reply, opt-out/suppression, invalid/expired authority, conflict, restricted access, provider block, manual stop.
- **Required next action:** Review draft, resolve permissible prerequisite, or no action when stopped.
- **Visual form:** Ordered vertical steps with dates and stop reason; never a branching automation canvas.
- **Accessibility alternative:** Ordered list/table with step, due date, human owner, send status, stop condition.
- **Mobile alternative:** Same vertical list with current step expanded.
- **Acceptance criteria:** No auto-send; authority/suppression checked on every external path; stopped sequence cannot be overridden visually.

