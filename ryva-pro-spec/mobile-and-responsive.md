# Mobile and Responsive Behavior

## Strategy

Ryva Pro is one responsive web application. No native mobile app is required for the first production version.

## Breakpoints

- wide desktop: 1440px and above;
- desktop: 1024–1439px;
- tablet: 768–1023px;
- mobile: below 768px.

Breakpoints are implementation defaults, not device assumptions.

## Desktop

Fully supports:

- dense intelligence tables;
- Product comparison;
- multi-pane record detail;
- Kanban and timeline;
- sequence builder;
- import mapping;
- document review;
- analytics configuration;
- commission reconciliation and disputes.

## Tablet

Supports all core workflows with collapsible sidebar, two-pane detail where space permits, horizontal table management, and full-screen drawers. Comparison may reduce to two records at once.

## Mobile fully supported

- Home priorities and changes;
- global search and Buyer lookup;
- task view/create/complete/reassign;
- calendar;
- Contact and Business quick view;
- call preparation and logging;
- notes and attachment capture;
- Opportunity stage update with validation;
- final outreach review and send;
- reply review;
- next-action management;
- account/reorder review;
- commission status and explanation;
- approval decisions;
- notifications;
- credential/subscription status.

## Desktop-first workflows

- bulk imports and mapping;
- Product/Brand multi-record comparison;
- advanced saved-view configuration;
- dense analytics creation;
- sequence construction;
- agreement and commission-document extraction review;
- deduplication merge;
- large dispute evidence packages;
- admin audit investigation.

Mobile permits read-only inspection and urgent action for these where feasible.

## Mobile patterns

- bottom navigation;
- sticky primary action;
- record summary before tabs;
- one-column forms;
- filters in full-screen sheet;
- Kanban becomes stage-grouped list;
- tables become prioritized columns with horizontal detail;
- evidence and AI sources open in full-screen drawer;
- numeric values use tabular digits;
- offline drafts limited to notes/call logs only if encryption and sync conflict handling are implemented; otherwise no offline mode.

## Call logging

From Contact or Opportunity:

1. open call workspace;
2. view preparation and current risk/authority;
3. initiate device call via tel link;
4. return to timer/outcome form;
5. log notes, outcome, next action;
6. no recording without separate approved policy and consent.

## Performance

- initial useful content under target on typical 4G;
- route and data-level code splitting;
- thumbnail images;
- virtualized large lists;
- stable skeletons;
- defer analytics and document previews.

