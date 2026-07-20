# Page: Templates

## Purpose and user

Manage reusable email, social-draft, call, voicemail, objection, and follow-up structures while preserving personalization and claims integrity.

## Data displayed

Name, channel, purpose, context, owner, status, version, subject/body/script, variables, approved claims/evidence, usage, reply/opt-out indicators, last review.

## Actions

Primary: Create Template.  
Secondary: edit/version, preview with record, duplicate, archive, add approved variables, request AI draft, compare versions.

## Filters

Channel, purpose, category, Business type, status, owner, usage, last reviewed.

## States

- **Empty:** explain template as structure, not automatic personalization.
- **Loading:** list and preview skeleton.
- **Error:** preserve draft and allow local copy.

## Permissions and responsive

Representative owns personal templates; Ryva-supplied templates read-only and duplicable. Mobile supports lookup/preview; editing desktop/tablet.

## Linked records and AI

Sequences, Emails, Calls, Products/Brands, Evidence. AI drafts and adapts but labels assumptions.

## Acceptance criteria

- unresolved variables block approval/send;
- template cannot insert unsupported Product claim;
- using template creates a communication-specific version;
- edits do not alter prior sends/enrollments;
- opt-out language and identity requirements preserved;
- no template is marked “high converting” without defined evidence.

