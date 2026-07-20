# Information Architecture

## Current domain structure

The product contains six conceptual layers, but the navigation presents them mostly as peers:

1. **Access and identity:** Login, Access, Certification, Subscription, Profile, Settings.
2. **Intelligence:** Brands, Products, Buyers, Contacts, Sources, Documents, Territories.
3. **Authority and placement:** Representation, Agreements, Placements.
4. **Engagement:** Outreach, Templates, Sequences, Tasks, Notifications.
5. **Commercial continuity:** Accounts, Protected Accounts, Orders, Reorders, Commissions, Disputes.
6. **Oversight and explanation:** Home, Analytics, AI Copilot, Search, Import, Export, Operations.

The underlying data model expresses relationships between these layers. The page architecture often exposes the entities, but not the relationship as the user’s stable working context.

## Overloaded pages

- Product, Brand, and Buyer details combine identity, editable fields, evidence, risk, qualification, human decision, related records, matches, and activity.
- Agreement detail combines immutable document review, extraction candidates, material-term editing, restrictions, conflict detection, legal ambiguity, approval, and history.
- Outreach combines activity, message drafting, call logging, provider state, and message register.
- Orders combines list/filter/save/export with a 17-control creation form and repeatable lines.
- Settings combines preferences, AI controls, session security, and account closure.
- Admin combines providers, safety controls, jobs, AI operations, and audit events.
- Analytics combines nine view modes, filters, metrics, tables, reports, definitions, and external-intelligence readiness.

## Underfilled pages

- Tasks, Notifications, Territories, Sources, and some empty commerce registers can be visually sparse and still consume a first-level global destination.
- Create Product Comparison is a six-field form on a dedicated page with little surrounding orientation.
- Access, Certification, and Subscription are appropriately focused individually, but together create a fragmented account/access area.
- Empty Home provides strong explanatory copy but little actionable structure until core records exist.

## Findings

| ID | Severity | Finding | Why it matters |
|---|---|---|---|
| IA-01 | Critical | Generic Records and dedicated Intelligence create two information architectures for the same core entities. | Users can encounter different list/detail capabilities and terminology for Brand, Product, Business, and Contact records. |
| IA-02 | High | The data relationship graph is not the persistent page context. | Users lose Brand–Product–Buyer–Authority–Placement orientation while moving between entity pages. |
| IA-03 | High | List, create, filter, and saved-view responsibilities are combined on many register pages. | The information hierarchy cannot clearly privilege review, discovery, or creation. |
| IA-04 | High | Consequential detail pages expose too many equally weighted sections. | Evidence, blockers, human decision, next action, and history compete instead of reflecting decision sequence. |
| IA-05 | Medium | Account/access information is unnecessarily separated across four global destinations. | Users must infer how certification, subscription, profile, and preferences affect access. |
| IA-06 | Medium | Support utilities are over-promoted to first-level navigation. | Sources, Documents, Territories, Import, Export, Search, Tasks, and Notifications crowd daily domain work. |
| IA-07 | High | Evidence and document context frequently sits outside the record workflow that needs it. | Users must leave a review to register a source/upload a document or manually carry identifiers. |
| IA-08 | Medium | Attention is split among Home priorities, Tasks, Notifications, Analytics exceptions, and AI briefings. | The same “what should I do next?” question has several partially overlapping answers. |
| IA-09 | High | Invalid generic route parameters become Brand pages instead of an unsupported/not-found state. | URL and content disagree, harming trust and making the route model ambiguous. |
| IA-10 | Medium | Administration and Analytics are section-heavy single pages without durable section orientation. | Deep content cannot be linked, remembered, or efficiently revisited from the UI. |

## Missing relationships in the interface

- Brand detail does not consistently maintain a visible path through authority, Products, Placements, Accounts, and commercial outcomes.
- Buyer detail does not consistently maintain a visible path through Contacts, Placements, Outreach, Orders, and account health.
- Product detail does not consistently maintain a visible path through representation scope, matched Buyers, Placements, Orders, and reorders.
- Agreement authority is essential to Placement and Outreach but appears as a separate detail destination rather than persistent context.
- Evidence, Sources, and Documents are connected in data but represented as separate registers plus local forms.
- Human decisions and next actions recur across domains without a consistent “decision context” location.

## Simplification opportunities, without design prescription

- Clarify which entity page family is canonical.
- Group global destinations by user intent and frequency.
- Preserve relationship context as users move between connected records.
- Separate record discovery, record creation, and record review responsibilities conceptually.
- Distinguish decision-critical sections from supporting history and metadata.
- Consolidate attention surfaces or define their distinct roles.
- Make access/account state understandable as one conceptual area.

