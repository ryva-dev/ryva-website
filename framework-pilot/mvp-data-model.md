# Ryva Pro MVP Data Model Derived From the Pilot

## 1. Design objective

This model is the smallest structure needed to run the five foundational Frameworks in a human-reviewed prototype. It supports evidence, lifecycle state, three-party review, decisions, approvals, risks, and next actions. It does not implement production numerical scoring, autonomous outreach, an Opportunity marketplace, advanced commission accounting, or enterprise data architecture.

## 2. Field-origin notation

- **[U] User-entered:** entered or affirmed by the Representative or authorized user.
- **[S] System-derived:** deterministic status, timestamp, or calculation from stored records.
- **[A] AI-suggested:** proposed by AI and not authoritative until reviewed.
- **[E] Externally sourced:** imported or observed from an authorized external source.

A field may permit more than one origin. Every material value stores its actual origin and, where applicable, the person who affirmed an AI suggestion.

## 3. Shared requirements

Every durable entity has:

- `id` [S], immutable;
- `tenant_id` [S];
- `created_at`, `updated_at` [S];
- `created_by`, `updated_by` [S/U];
- `record_status` [U/S]: active, inactive, archived, or superseded;
- `source_origin` [S]: user, system, AI, or external where relevant;
- `version` [S]; and
- an append-only history for consequential changes.

AI suggestions must remain distinguishable from user-approved values. Unknown is null plus an `unknown_reason`, not a midpoint or empty string.

## 4. Core party and object entities

### 4.1 Product

**Purpose:** Identify the specific Product or variant being researched or represented.

**Required fields**

- `brand_id` [U/E]
- `name` [U/E/A]
- `product_type` [U/E/A]
- `variant_scope` [U/E]
- `identity_status` [U]: unverified, partially verified, verified
- `current_summary` [U/A]

**Optional fields**

- SKU, barcode or identifier [U/E]
- category and subcategory [U/A]
- consumer price and currency [U/E]
- specifications, ingredients/materials, packaging reference [U/E]
- public URL and image references [E/U]
- Product status and discontinuation date [U/E]

**Relationships:** Brand; Evidence Records; Risk Flags; Placement Opportunities; Orders.

**Audit:** Preserve identity changes, category changes, variant merges, and who verified the Product.

### 4.2 Brand

**Purpose:** Represent the organization offering the Product and seeking Business relationships.

**Required fields**

- legal or operating name [U/E]
- identity status [U]
- primary authorized contact status [U]
- summary [U/A]

**Optional fields**

- legal entity name and jurisdiction [U/E]
- ownership information [U/E]
- website and public identifiers [E/U]
- operational status [U/E]
- support contact and escalation contact [U]

**Relationships:** Products; Contacts; Evidence Records; Representation Opportunities; Representation Agreements; Risk Flags.

**Audit:** Preserve identity, ownership, authority, and status changes. AI cannot verify legitimacy.

### 4.3 Account

**Purpose:** Represent a Business organization or defined operating unit that may purchase, use, distribute, or resell Products.

**Required fields**

- Business name [U/E]
- Business type [U/A]
- account status [U]: research candidate, qualified, active relationship, inactive, closed
- identity status [U]

**Optional fields**

- legal name [U/E]
- locations and geography [U/E]
- website [E/U]
- assortment or Business-purpose summary [U/A]
- price positioning [U/A]
- qualification date and reason [U]
- relationship owner [U]

**Relationships:** Contacts; Business Buyers; Evidence Records; Placement Opportunities; Orders; Outreach Activities.

**Audit:** Preserve qualification, status, owner, and merge history. Account status must not imply Buyer intent.

### 4.4 Contact

**Purpose:** Store a person associated with a Brand or Account and the permitted professional context for contact.

**Required fields**

- associated Brand or Account [U/E]
- name [U/E]
- role or role status [U/E/A]
- contact source [U/E]
- contact-permission status [U]

**Optional fields**

- professional email, phone, or channel [U/E]
- decision role [U/A]
- communication preference and opt-out [U/E]
- authority evidence reference [U]
- freshness date [S/U]

**Relationships:** Brand or Account; Business Buyer; Outreach Activities; Evidence Records.

**Audit:** Preserve source, consent/opt-out, role changes, and access. Avoid irrelevant personal information.

### 4.5 Business Buyer

**Purpose:** Record a Contact's verified or proposed authority in a specific Business decision.

**Required fields**

- `contact_id` [U/E]
- `account_id` [S/U]
- Buyer role status [U]: unknown, influencer, evaluator, recommender, decision-maker, authorized purchaser
- decision context [U]

**Optional fields**

- authority evidence [U/E]
- buying window [U/E]
- stated need and requirements [U/E]
- decision process [U/E]
- authority expiry or reassessment [U]

**Relationships:** Contact; Account; Placement Opportunity; Evidence Records.

**Audit:** Preserve who assigned authority and on what evidence. AI may suggest a role but cannot verify authority.

## 5. Evidence entities

### 5.1 Source

**Purpose:** Identify where evidence came from and how it may be used.

**Required fields**

- source type [U/S]: authoritative record, first-party record, Business record, independent source, public platform, assertion, observation, model output, other
- source name or reference [U/E]
- owner or provider when known [U/E]
- capture date [S/E]
- access/use classification [U/S]

**Optional fields**

- URL or external opaque ID [E/U]
- observed period [U/E]
- confidentiality and retention class [U/S]
- provider terms reference [U]
- dependency or parent source [U]

**Relationships:** Evidence Records.

**Audit:** Preserve original reference, capture time, access, correction, and deletion. Do not expose secrets or restricted payloads.

### 5.2 Evidence Record

**Purpose:** Connect one material claim to information and define what that information may support.

**Required fields**

- subject type and ID [U/S]
- exact claim [U/A]
- evidence class [U]: Verified Fact, Direct Evidence, Strong Proxy, Weak Proxy, Estimate, Assumption, Model-Generated Inference, Unknown
- source ID, except for Unknown [S/U]
- observed period or unknown reason [U/E]
- supports [U/A]
- does not support [U/A]
- conclusion confidence [U]: Insufficient, Limited, Supported, Strong
- reviewer [U]

**Optional fields**

- context: channel, geography, Business type, population [U/E/A]
- credibility, directness, freshness, coverage [U/A]
- limitation and contrary evidence [U/A]
- paid/organic/affiliate/unknown context [U/E]
- permitted use and prohibited inference [U]
- expiry/reassessment date [U/S]
- correction and supersession links [S/U]

**Relationships:** Source; any subject entity; Decision Review; Risk Flag.

**Audit:** Append corrections and supersession; never silently replace the original classification. Record AI proposal and human affirmation separately.

## 6. Opportunity and authority entities

### 6.1 Representation Opportunity

**Purpose:** Track a potential Brand mandate before representation authority exists.

**Required fields**

- Brand ID [U]
- opportunity status [U]: candidate, diligence, negotiating, declined, converted, closed
- decision owner [U]
- next action ID [U]

**Optional fields**

- Product scope [U]
- proposed channel, territory, and Business types [U]
- proposed economics summary [U]
- missing mandate terms [U/A]
- decline or close reason [U]

**Relationships:** Brand; Products; Evidence Records; Decision Reviews; Representation Agreement; Next Actions; Risk Flags.

**Audit:** Preserve conversion and closure. This is not the Standard-defined Placement Opportunity and creates no authority.

### 6.2 Representation Agreement

**Purpose:** Record the mandate and limits authorizing the Representative's work.

**Required fields**

- Brand ID [U]
- Representative/user ID [S/U]
- authority status [U]: pending verification, active, suspended, expired, ended
- effective and end dates [U/E]
- Product scope [U/E]
- territory and channel scope [U/E]
- communication/negotiation/binding authority [U/E]
- compensation basis and timing [U/E]
- agreement evidence Source or file reference [U/E]

**Optional fields**

- exclusivity [U/E]
- restrictions and conflicts [U/E]
- account attribution and house-account rules [U/E]
- approved claim/material references [U/E]
- samples, returns, support, escalation, and post-termination terms [U/E]

**Relationships:** Brand; Products; Representation Opportunity; Placement Opportunities; Accounts; Commission records.

**Audit:** Version all terms and effective dates. AI may extract clauses, but a human confirms the record. This record is not legal advice.

### 6.3 Placement Opportunity

**Purpose:** Store the Standard-defined Opportunity: a potential Brand–Business relationship with a credible match thesis, identifiable next step, and sufficient authority to pursue evaluation.

**Required fields**

- Product ID [U]
- Brand ID [S/U]
- Account ID [U]
- Representation Agreement ID [U]
- match thesis [U/A]
- opportunity status [U]
- Placement Cycle Status ID [S/U]
- decision owner [U]
- next action ID [U]

**Optional fields**

- Business Buyer ID [U]
- context/location [U]
- stated Buyer need [U/E]
- commercial assumptions [U]
- estimated value range and basis [U/A]
- target timing [U/E]
- close reason [U]

**Relationships:** Product; Brand; Account; Buyer; Representation Agreement; Evidence Records; Triangle Reviews; Decision Reviews; Risk Flags; Actions; Outreach; Orders.

**Audit:** Preserve status, stage, estimates, match-thesis, owner, and close reason. Estimated value never updates actual Order fields.

### 6.4 Placement Cycle Status

**Purpose:** Record the active stage and evidence state without treating the stage as proof.

**Required fields**

- subject type and ID [S]
- stage [U]: Discover, Evaluate, Qualify, Represent, Target, Prepare, Approach, Present, Place, Support, Reorder, Grow
- entered at [S]
- entered by [S/U]
- entry criteria summary [U/A]
- missing exit criteria [U/A]
- next required action [U]

**Optional fields**

- blocker [U/A]
- prohibited premature action [U]
- prior stage and transition reason [S/U]
- review date [U]

**Relationships:** Product research, Representation Opportunity, Placement Opportunity, Account relationship.

**Audit:** Append every transition, including backward movement. AI may propose but cannot silently change a consequential stage.

## 7. Review, risk, and action entities

### 7.1 Relationship Triangle Review

**Purpose:** Record value, obligations, risk, and condition for Brand, Business Buyer, and Representative.

**Required fields**

- subject Opportunity or relationship [U]
- review date and reviewer [S/U]
- Brand value, obligations, risks, condition [U/A]
- Business value, obligations, risks, condition [U/A]
- Representative value, obligations, risks, condition [U/A]
- overall condition [S]: weakest party condition
- can all parties receive legitimate value [U]

**Optional fields**

- warning signs [U/A]
- conditions and evidence needed [U]
- expiry/review trigger [U]

**Relationships:** Placement Opportunity; Decision Review; Evidence Records.

**Audit:** Preserve prior reviews. AI may draft summaries; the reviewer owns conditions.

### 7.2 Decision Review

**Purpose:** Apply the Decision Filter and record an actionable human outcome.

**Required fields**

- subject type and ID [U/S]
- exact question and scope [U]
- ten test outcomes and rationales [U/A]
- final decision [U]: Proceed, Proceed With Conditions, Investigate Further, Do Not Proceed
- confidence [U]
- rationale [U]
- decision owner and date [S/U]
- next action ID [U]

**Optional fields**

- conditions and limits [U]
- alternative interpretation [U]
- public-defensibility note [U]
- escalation or specialist-review need [U]
- review trigger [U]

**Relationships:** Evidence Records; Triangle Review; Human Approval; Risk Flags; Next Action; Decision History.

**Audit:** Immutable issued version; changes create Decision History. Preserve AI suggestion separately.

### 7.3 Human Approval

**Purpose:** Prove that an authorized person meaningfully reviewed a proposed material action or decision.

**Required fields**

- subject and action/decision type [S/U]
- proposed artifact/version [S]
- approver [S/U]
- approval status [U]: approved, rejected, changes required, expired
- decision timestamp [S]
- scope [U]

**Optional fields**

- rationale [U]
- conditions [U]
- evidence viewed [S/U]
- AI contribution [S]
- expiry [U]

**Relationships:** Decision Review; Placement stage transition; Outreach Activity; Agreement record.

**Audit:** Append-only; approval cannot be reused for a materially different side effect.

### 7.4 Risk Flag

**Purpose:** Make material risk visible and assign its disposition.

**Required fields**

- subject type and ID [U/S]
- risk type [U/A]: identity, authority, claims, safety, labeling, fulfillment, margin, returns, conflict, trust, data, other
- description [U/A]
- status [U]: open, under review, mitigated, accepted within authority, closed
- severity [U]
- owner [U]

**Optional fields**

- evidence links [U/S]
- stop/gate status [U]
- specialist-review type [U]
- mitigation and due date [U]

**Relationships:** Any subject; Evidence Record; Decision Review; Next Action.

**Audit:** Preserve creation, severity changes, disposition, evidence, and approver.

### 7.5 Next Action

**Purpose:** Convert a Framework conclusion into a named bounded action.

**Required fields**

- subject type and ID [S/U]
- action description [U/A]
- owner [U]
- status [U]: proposed, approved, in progress, blocked, completed, cancelled
- decision source [U/S]

**Optional fields**

- due/review date [U]
- prerequisites [U/A]
- prohibited action [U]
- completion evidence [U/E]
- blocker reason [U]

**Relationships:** Opportunity, Decision Review, Risk Flag, Outreach Activity.

**Audit:** Preserve status, owner, completion evidence, and cancellation reason.

### 7.6 Decision History

**Purpose:** Preserve changes in decisions, stages, approvals, and material interpretations.

**Required fields**

- subject and prior record ID [S]
- event type [S]
- prior value and new value [S]
- actor and timestamp [S]
- reason or new evidence [U]

**Optional fields**

- related Evidence Record [S/U]
- approval [S]
- Framework/model version [S]

**Relationships:** Decision Review; Placement Cycle Status; Human Approval; source entity.

**Audit:** This is the audit event. It is append-only and not user-deletable through ordinary workflow.

## 8. Relationship and activity entities

### 8.1 Outreach Activity

**Purpose:** Record a proposed or completed professional contact without confusing delivery with engagement.

**Required fields**

- Placement Opportunity ID [U]
- Contact ID [U]
- activity type [U]: email, call, meeting, sample, other
- status [U]: prepared, approved, sent/completed, failed, cancelled
- purpose [U]
- occurred or proposed time [U/S]

**Optional fields**

- channel [U]
- artifact/reference [U]
- Human Approval ID [S/U]
- response state [U/E]
- opt-out or contact restriction [U/E]
- next action [U]

**Relationships:** Opportunity; Contact; Human Approval; Evidence Record; Next Action.

**Audit:** Preserve final content/reference, sender, approval, outcome, and contact restrictions. Delivery does not advance stage automatically.

### 8.2 Order

**Purpose:** Record a verified opening or subsequent Business order.

**Required fields**

- Placement Opportunity or Account relationship [U]
- Brand and Account [S/U]
- order type [U]: opening, subsequent, adjustment
- external order reference [U/E]
- order date [U/E]
- status [U/E]
- currency and verified net amount [U/E]

**Optional fields**

- Product lines and quantities [U/E]
- shipment and fulfillment status [E/U]
- returns/adjustments [E/U]
- payment status where authorized [E/U]
- Source/evidence [E/U]

**Relationships:** Brand; Account; Product; Opportunity; Reorder; Commission.

**Audit:** Preserve external source, corrections, adjustments, cancellation, and who verified. Estimates never create Orders.

### 8.3 Reorder

**Purpose:** Identify a verified subsequent order and connect it to the relationship review.

**Required fields**

- Order ID [S/U]
- prior Order or relationship reference [S/U]
- verified status [U/S]

**Optional fields**

- cadence from prior order [S]
- reorder reason [U/E]
- Product mix change [S/U]
- relationship review reference [U]

**Relationships:** Order; Account; Product; Placement Opportunity/relationship.

**Audit:** Derived cadence is recalculable; verified status and links are preserved. A forecast is not a Reorder.

### 8.4 Commission

**Purpose:** Record a transparent proposed or actual Representative compensation event without making commission the Opportunity objective.

**Required fields**

- Representation Agreement ID [U]
- related Order ID for actual commission, or explicit estimate status [U]
- status [U]: estimated, earned, approved, paid, disputed, adjusted, cancelled
- basis description [U/E]
- currency [U/E]

**Optional fields**

- rate and eligible amount [U/E]
- estimated range [U/A]
- earned, approved, and paid amounts/dates [U/E]
- exclusions, returns, chargebacks, and adjustment reason [U/E]
- payment evidence [E/U]

**Relationships:** Agreement; Order; Brand; Representative; Decision/Risk if disputed.

**Audit:** Separate estimated, earned, and paid values. Preserve adjustments and disputes. Commission must not be the sole priority field.

## 9. Deferred entity

### 9.1 Protected Account

**Purpose:** None in the initial prototype. The term implies a right not yet established by The Ryva Standard or Frameworks.

**Required fields if later approved**

- Account ID;
- Representative and Brand/Agreement;
- protection authority and source;
- scope: Products, Brand, channel, geography;
- start, expiry, and release conditions;
- qualifying activity/evidence;
- overlap and conflict status;
- dispute and appeal route.

**Optional fields**

- renewal history;
- inactivity threshold;
- approved exception.

**Relationships:** Account; Representation Agreement; Opportunity; Human Approval; Decision History.

**Audit:** Would require append-only grant, renewal, release, conflict, and dispute history.

**MVP decision:** Do not build a Protected Account entity or user-facing claim until Founder policy resolves authority, scope, expiry, inactivity, conflicts, and appeal. Use an ordinary Account relationship owner plus a non-rights-bearing conflict note during the pilot.

## 10. Minimum prototype workflows

The first prototype needs only:

1. create Product, Brand, Account, Contact, and Buyer context;
2. capture Sources and claim-level Evidence Records;
3. create a Representation Opportunity and record mandate diligence;
4. activate a Representation Agreement only after human verification;
5. create a Placement Opportunity only when its definition is met;
6. set and audit Placement Cycle stage;
7. complete a Triangle Review;
8. complete a Decision Review;
9. assign Risk Flags, specialist review, and Next Actions;
10. require Human Approval before external Outreach;
11. record verified Orders and Reorders; and
12. distinguish estimated, earned, and paid Commission.

## 11. MVP fields required

The pilot indicates the first version must include:

- source, observation date, evidence class, supports/does-not-support, limitation, confidence, and unknown reason;
- AI-suggested versus human-approved provenance;
- Product, Brand, Account, Contact, and Buyer authority;
- representation status and exact authority;
- Opportunity definition fields and match thesis;
- Placement Cycle stage, missing exit criteria, prohibited action, and transition history;
- party-specific Triangle value, obligations, risk, and condition;
- ten Decision Filter outcomes, scoped final decision, confidence, rationale, and next action;
- risk/gate, owner, specialist-review need, and disposition;
- action owner, status, due/review trigger, and completion evidence;
- external outreach approval and actual state;
- actual versus estimated commercial values; and
- immutable decision and approval history.

## 12. Do not build yet

- production numerical Product, Brand, Fit, Opportunity, Portfolio, or Relationship scores;
- predictive opening probability or expected revenue;
- autonomous external outreach;
- public scorecards or Brand/Buyer rankings;
- Protected Account rights;
- Opportunity marketplace allocation;
- automated Certification or ethics decisions;
- enterprise territory optimization;
- complex commission forecasting or payroll;
- inferred Buyer personal profiles;
- cross-customer intelligence sharing;
- automated legal, regulatory, safety, or financial conclusions;
- generic “AI confidence percentage”; or
- data collection without a defined pilot or professional purpose.

