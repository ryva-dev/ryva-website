# Page: Settings

## Purpose and user

Manage workspace preferences, integrations, notifications, custom fields, defaults, security, import/export, and data controls.

## Data displayed

Sections: General, regional/currency/time zone, outreach identity, integrations, notifications/quiet hours, task/stale defaults, bounded custom fields, AI preferences, security/sessions, import/export, privacy/data deletion.

## Actions

Primary: Save section.  
Secondary: connect/disconnect integration, revoke session, request export/deletion, reset safe defaults.

## Filters

Integration type/status; custom-field object; session.

## States

- **Empty:** provider/custom-field-specific setup.
- **Loading:** section-level.
- **Error:** preserve changes; disconnect failures do not claim disconnected.

## Permissions and responsive

Representative manages own workspace. Admin-only settings absent. Mobile supports common preferences/security; custom fields/integration detail desktop-first.

## Linked records and AI

Integrations, Saved Views, Templates, Tasks, Profile, Subscription, Credential. AI may explain settings, not change them.

## Acceptance criteria

- settings validated server-side;
- mandatory controls cannot be disabled;
- integration scopes visible;
- disconnect revokes/deletes secrets where supported;
- currency/time-zone changes do not rewrite historical actuals;
- sensitive actions require confirmation/step-up and audit.

