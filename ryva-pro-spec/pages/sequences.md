# Page: Sequences

## Purpose and user

Build controlled multi-step follow-up plans that prepare work and reminders without autonomous external communication.

## Data displayed

Sequence name, purpose, audience context, status, owner, version, steps, delays, templates, task/call steps, stop conditions, enrollments, pending approvals, reply/opt-out/stop outcomes.

## Actions

Primary: Create Sequence / Activate Version.  
Secondary: add/reorder step, choose template, set delay, add task/call, define stop, duplicate, pause/stop/archive, enroll eligible Contacts, inspect performance.

## Filters

Status, channel, category, Business type, owner, active enrollment, reply rate, last updated.

## States

- **Empty:** create a small professional follow-up plan.
- **Loading:** list then selected steps.
- **Error:** preserve draft; active sequence job failure visible per enrollment.

## Permissions and responsive

Representative. Mobile supports pause/stop, enrollment review, and individual approval; builder desktop-first.

## Linked records and AI

Templates, Contacts, Opportunities, Tasks, Emails/Calls, Approvals. AI may suggest cadence and drafts with rationale; user owns activation and each send.

## Acceptance criteria

- every external step requires exact human approval;
- reply, opt-out, closed/disqualified Opportunity, credential/access loss, conflict, or inactive agreement stops future steps;
- version used by enrollment is preserved;
- delays respect time zone/quiet hours;
- sequence cannot be used for indiscriminate unqualified lists;
- actions audited.

