# Redesign Opportunities

This register identifies opportunities only. It does not propose layouts, components, mockups, implementation steps, or features that do not exist.

Complexity estimates describe likely redesign breadth:

- **Low:** localized surface or terminology.
- **Medium:** several related pages/patterns.
- **High:** shared shell, multiple domains, or consequential workflow/state coordination.

## Opportunity register

| Priority | Opportunity | Current state | Problem and usability harm | Expected benefit | Complexity |
|---|---|---|---|---|---|
| P0 | Clarify global navigation architecture | Up to 27 ungrouped sidebar links; horizontal strip on small screens | Users scan a directory of mixed-frequency domains, utilities, and account controls; mobile access is poor | Faster orientation, less cognitive load, reliable access at every width | High |
| P0 | Resolve duplicate record architectures | Generic Records and dedicated Intelligence both represent Brand/Product/Business/Contact | Capabilities, terms, routes, and visual patterns diverge for the same record | One predictable source of truth and lower relearning cost | High |
| P0 | Establish a consistent detail-page decision hierarchy | Long details stack equally weighted panels for facts, evidence, risks, decisions, actions, and history | Blockers and next actions are hard to distinguish from supporting context | Faster, safer consequential review without removing information | High |
| P0 | Standardize registers, filters, saved views, and data states | Lists/cards/tables and saved-view controls are implemented several ways | Users relearn scanning, filtering, saving, empties, loading, and errors per domain | Consistent discovery and review behavior | High |
| P0 | Clarify multi-step consequential workflows | Long inline forms expose prerequisites and decisions simultaneously | Scrolling and validation replace a visible sense of state, readiness, and completion | Lower error rate and clearer human ownership | High |
| P1 | Preserve connected-record context | Related pages link inconsistently and lack breadcrumbs/parent paths | Users lose Brand–Product–Buyer–Authority–Placement context | Fewer context switches and easier recovery | High |
| P1 | Consolidate account/access orientation | Certification, Subscription, Profile, and Settings are separate global items | Users must infer their relationship and remediation order | Clearer access state and account management | Medium |
| P1 | Define one attention model | Home, Tasks, Notifications, Analytics exceptions, and AI briefings overlap | “What should I do next?” has several partial answers | More trustworthy prioritization and less duplicate review | High |
| P1 | Standardize semantic state language | Raw enums and partially mapped status colors drive labels | Status wording and visual meaning vary across domains | Faster comprehension and safer state transitions | Medium |
| P1 | Establish responsive task priorities | Desktop structures simply collapse; full nav and long forms persist | Mobile work is technically contained but inefficient and security actions disappear | Usable field workflows and complete account access | High |
| P1 | Clarify evidence/source/document relationships | Sources and Documents are separate utilities and IDs sometimes travel manually | Provenance work interrupts record review | Stronger evidence comprehension and fewer context changes | High |
| P1 | Differentiate authority, blocker, warning, and informational states | Several callout/panel treatments overlap | Consequential constraints can look like general notices | Safer actions and clearer recovery | Medium |
| P2 | Calibrate page-title and metadata typography | One large heading scale and several small uppercase recipes serve all contexts | Operational density and hierarchy are uneven | Better scan speed and reduced vertical cost | Medium |
| P2 | Rationalize surfaces, borders, radii, and elevation | Panels and borders are used almost everywhere | Visual containment does not communicate meaning | Cleaner hierarchy and less visual clutter | Medium |
| P2 | Standardize action hierarchy | Links/buttons/text/danger variants are applied inconsistently | Users cannot predict which action is primary, navigational, destructive, or secondary | Clearer intent and reduced accidental action | Medium |
| P2 | Improve table and dense-data comprehension | Wide tables scroll horizontally with inconsistent headers/actions | Comparison and row context are lost on narrow screens | Faster cross-record scanning and better responsive comprehension | High |
| P2 | Normalize empty, loading, error, and success states | Three empty patterns and several alert/state patterns exist | Recovery and progress cues vary | More polished, predictable system feedback | Medium |
| P2 | Make accessibility semantics match visual controls | Analytics tabs, help text, repeated action names, and tables lack full semantics | Assistive-technology users receive less context than visual users | More equivalent access and stronger keyboard orientation | Medium |
| P3 | Align terminology and capitalization | Buyer/Business and several nav/page/status labels differ | Small translation costs accumulate across workflows | More professional voice and lower ambiguity | Low |
| P3 | Clarify utility placement | Search, Import, Export, Sources, Documents, Territories, Tasks, Notifications are first-level peers | Core domain navigation is diluted | Faster access to frequent work while retaining utilities | Medium |
| P3 | Clarify Admin and Analytics section orientation | Long pages use stacked sections or button views without durable hierarchy | Returning to a specific operational subsection is cumbersome | Faster oversight and stronger deep-link orientation | Medium |
| P3 | Audit visual density by populated state | Many inspected registers were empty; CSS supports dense rows/forms | Empty-state appearance can mask populated-state crowding | Redesign decisions grounded in worst-case real content | Medium |

## Five highest-priority opportunities

1. Clarify global navigation architecture.
2. Resolve duplicate record architectures.
3. Establish a consistent detail-page decision hierarchy.
4. Standardize registers, filters, saved views, and data states.
5. Clarify multi-step consequential workflows.

## Dependencies that raise redesign difficulty

| Area | Why difficult later |
|---|---|
| Authenticated shell | Access mode, capabilities, role, export permission, admin/support state, and responsive behavior all change navigation |
| Record pages | Generic and Intelligence page families overlap server endpoints and user goals |
| Consequential details | Actions depend on evidence, human decisions, exact artifacts, authority scope, version, and audit requirements |
| Outreach | Provider state, suppression, authority, approval, claims, attachments, and immutable content must remain coherent |
| Commerce | Order verification produces Accounts and Commissions; revisions and agreement bases must stay traceable |
| AI review | Every statement needs provenance, confidence, classification, freshness, limitations, edits, and human disposition |
| Analytics/Home | Values must remain explainable and currency-separated; unavailable external intelligence cannot appear as zero |
| Responsive shell | Current breakpoints globally transform the sidebar and hide the account footer |

