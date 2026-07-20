# Navigation Audit

## Current hierarchy

### Public

- Login
  - successful full access → Home
  - restricted access → Access Check
  - conditional verification → TOTP field on Login

### Authenticated representative navigation

The desktop sidebar exposes up to 25 links in one continuous, ungrouped list:

1. Home
2. Brands
3. Products
4. Buyers
5. Representation
6. Placement CRM
7. Outreach
8. Accounts
9. Orders
10. Reorders
11. Commissions
12. AI Copilot
13. Analytics
14. Contacts
15. Tasks
16. Documents
17. Sources
18. Territories
19. Search
20. Import
21. Export
22. Notifications
23. Certification
24. Subscription
25. Profile
26. Settings

Export is capability-gated, so the normal maximum is 26 rather than 25 for an export-authorized user. Admin/support adds **Operations**, raising the possible total to 27. A restricted user instead receives Access plus certification, subscription, profile, and settings according to capabilities.

There is no separate top navigation on desktop. At 900 px and below, the sidebar becomes the top navigation: the same links are arranged in a horizontally scrolling strip.

### Nested and contextual navigation

| Area | Current mechanism | Destinations |
|---|---|---|
| Commerce | `CommerceNav` subnav repeated through a local `Shell` | Accounts, Protection, Orders, Reorders, Commissions, Disputes |
| Outreach | Page-header action links | Templates, Sequences; each links back to Outreach |
| Analytics | Button-based horizontal subnav | Representative, Product, Brand, Buyer, Pipeline, Commercial, Portfolio, Reports, Metric Definitions |
| Intelligence | Record links and page-specific actions | Product/Brand/Buyer details, comparisons, contacts, matches |
| Representation | Record links | Opportunity → Agreement/Documents; Placement → Outreach |
| Utilities | Mostly global links only | Search, Tasks, Documents, Sources, Territories, Import, Export, Notifications |

### Breadcrumbs

There are no breadcrumbs. Detail pages rely on browser Back, a page-specific link when supplied, or returning to the global navigation. Outreach Templates and Sequences explicitly include “Back to outreach”; most other detail pages do not expose a parent return action.

### Settings navigation

Certification, Subscription, Profile, and Settings are separate global destinations rather than a grouped account/settings area. Settings itself is one long page containing working preferences, AI settings, active sessions, and account closure.

### Admin navigation

Admin/support receives one global “Operations” destination. Its page contains Provider and safety status, AI kill switch, Job health, and Recent audit events as vertically stacked sections. There is no admin subnavigation, section index, or direct-link structure.

## Contextual link graph

```text
Brand ⇄ Product ⇄ Buyer
  │         │        │
  └── Representation ── Agreement
             │              │
             └── Placement ─┘
                    │
                 Outreach
                    │
                  Order → Account → Reorder
                    │
                Commission → Dispute

Evidence support: Source ⇄ Document
Work support: Home ⇄ Task ⇄ Notification
Explanation support: Copilot ⇄ Analytics
```

The graph exists in data and page actions, but it is not consistently visible as navigation. Users often return to the global rail to change context.

## Findings

| ID | Severity | Finding | Evidence and effect |
|---|---|---|---|
| NAV-01 | High | The global navigation is a flat list of up to 27 destinations. | Domains, work queues, utilities, and account controls have equal visual weight; scanning cost is high. |
| NAV-02 | Critical | Small-screen navigation is the full global list in a horizontally scrolling sticky strip. | At 390 px, only a few of 26+ destinations are visible; off-screen destinations have no menu or position affordance. |
| NAV-03 | High | Account identity and Sign out disappear at 900 px and below. | `.sidebar-footer { display: none; }`; no alternate sign-out control is exposed in page content. |
| NAV-04 | High | There are no breadcrumbs or consistent parent-return controls. | Dynamic details can become dead ends for users who entered from Search, Home, Notifications, or a related record. |
| NAV-05 | Medium | Similar domains use different contextual navigation conventions. | Commerce has a subnav, Outreach has header links, Analytics uses buttons, and Intelligence relies on record links. |
| NAV-06 | High | Certification, Subscription, Profile, and Settings occupy four global slots. | Account administration competes with daily operational navigation and increases rail length. |
| NAV-07 | Medium | Search, Tasks, Notifications, Documents, Sources, Territories, Import, and Export are all first-level destinations. | Utility/support tools are not grouped by user intent or frequency. |
| NAV-08 | High | Record relationships are not consistently navigable in both directions. | The data graph is richer than the visible link graph; context switches often require returning to a list or sidebar. |
| NAV-09 | Medium | Analytics view buttons do not create a clear nested-route hierarchy. | Some state is query-driven, but views present like tabs without stable page-level orientation. |
| NAV-10 | Medium | Terminology shifts between navigation and page titles. | “Placement CRM” opens “Placement Opportunities”; “Operations” opens “Platform operations”; “Buyers” becomes “Business” in generic records. |
| NAV-11 | Medium | Restricted-access navigation is materially different without an explicit orientation model. | Users see a reduced set of links and remediation content, but no account-area grouping explains what remains available. |
| NAV-12 | High | Unsupported generic record types silently fall back to Brand pages. | `/records/task`, `/records/document`, and `/records/source` render Brands rather than a not-found or unsupported state, creating misleading navigation outcomes. |

## Click and dead-end observations

- Any global destination is one click on desktop if visible, but locating it may require scrolling the sidebar.
- On mobile, a destination can require horizontal swiping plus a tap; this is not represented as a click count but is material navigation work.
- Commerce pages add one contextual click to move among six related registers.
- Outreach Templates/Sequences require a parent return link; message details do not consistently show one.
- Dynamic detail pages without a header action provide no explicit route back to their list.
- Search and Notifications can enter details, but the detail page does not preserve or display the originating result context.
- The wildcard redirect to Home hides invalid URLs instead of explaining that the requested page does not exist.

