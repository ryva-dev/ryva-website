# AI Behavior Specification

## Product role

AI reduces research and administrative work while preserving the Representative's responsibility for recommendation, authority, Buyer fit, claims, outreach, negotiation, closing, disputes, and relationships.

## Supported assistance

- Product, Brand, and Buyer research summaries;
- Product-to-Business match candidates;
- missing-evidence and stale-evidence detection;
- Contact and decision-role enrichment suggestions;
- agreement and commission-document field extraction;
- outreach personalization and drafts;
- call preparation and voicemail options;
- objection-response suggestions;
- follow-up drafts;
- conversation and pipeline summaries;
- stalled-Opportunity explanation;
- weekly priorities;
- duplicate candidates;
- next-action suggestions.

## Prohibited AI decisions/actions

AI must not:

- send external communication;
- create false personalization or impersonation;
- negotiate or accept binding terms;
- promise Product performance, Buyer outcome, order, reorder, or commission;
- approve a Brand agreement or Protected Account;
- finally qualify/reject a Product, Brand, Business, or consequential Opportunity;
- move a consequential stage without human confirmation;
- close, reopen, disqualify, or mark an Opportunity won;
- mark an order confirmed, commission approved/paid, or dispute resolved without evidence and human action;
- determine credential, ethics, disciplinary, legal, regulatory, safety, tax, or financial outcomes;
- invent missing values or hide adverse evidence.

## Suggestion object

Every suggestion stores and displays:

- purpose and target;
- generated content or structured changes;
- supporting Evidence Records and source links where allowed;
- classification of each material statement: fact, inference, estimate, assumption, or unknown;
- confidence label and subject;
- missing and contrary evidence;
- model, provider, version, template version, generated time;
- approval status;
- edit and regeneration history;
- user feedback.

## Suggestion UI

### Inline suggestion

Used for summaries, field candidates, next actions, and duplicate matches. Displays AI label, confidence, and source count. Expands into source inspection.

### Review panel

Used for outreach, agreement extraction, commission extraction, matching, and multi-field changes. Shows side-by-side current/proposed values, evidence, unknowns, risk, and actions:

- Accept selected;
- Accept all permitted;
- Edit;
- Reject;
- Regenerate with instruction;
- View sources;
- Report problem.

### External communication review

Shows exact recipient, channel, subject, body, attachments, claims, source basis, opt-out state, authority, conflict status, and approval. Send is a user action after review.

## Accept

Acceptance:

- records the exact suggestion version;
- applies only selected fields/content;
- changes field origin to human-confirmed with AI provenance retained;
- runs validation and policies;
- does not trigger external action unless separately confirmed.

## Edit

Store original and final content plus user diff. Edited output becomes human-owned. Material claims still require evidence.

## Reject and feedback

Rejection records a reason category and optional note. Feedback improves evaluation; it is not automatically used for cross-customer training.

## Regeneration

Creates a child suggestion; it does not overwrite prior output. Changed evidence or instructions are visible.

## Confidence

Use Insufficient, Limited, Supported, or Strong from the Evidence Standard. Never display an unvalidated “AI confidence percentage.” Confidence applies to a named conclusion, not the model globally.

## Data and privacy

- send only authorized minimum context;
- exclude credentials, secrets, unrelated personal information, raw provider payloads, and inaccessible records;
- honor source rights and retention;
- separate workspace data;
- no cross-customer training without approved policy;
- redact sensitive values from logs;
- support provider deletion/retention configuration.

## Evaluation

Before release, test:

- factual support and citation correctness;
- harmful omission and adverse-evidence retention;
- hallucination and fabricated Contact/claim rates;
- bias across Brand size and Business types;
- approval comprehension;
- edit/reject behavior;
- privacy and tenant isolation;
- prompt injection from imported content;
- wrong-stage and wrong-authority suggestions;
- relationship impact.

## Degraded behavior

If AI is unavailable, every core workflow remains usable manually. AI failures create no fake completion, no state transition, and no external action.

