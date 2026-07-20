# Navigation Redesign

## Final desktop hierarchy

The expanded sidebar is 240 px wide. It uses five labelled groups, a fixed search affordance, and a utility footer. There is at most one nested level.

### Operate

1. Home — `/`
2. Tasks — `/tasks`
3. Representation — `/representation`
4. Placements — `/placements`
5. Outreach — `/outreach`

Representation remains globally visible because valid authority is a prerequisite to Placement and Outreach. It is not folded into Brand detail.

### Intelligence

1. Products — `/products`
2. Brands — `/brands`
3. Businesses & Buyers — `/buyers`

Contacts are accessed from Businesses & Buyers, Search, and related-record links. `/records/contact` remains valid but is no longer a first-level destination. Sources and Territories become contextual utilities from evidence and authority workflows while their routes remain valid.

### Commercial

1. Accounts — `/accounts`
2. Orders — `/orders`
3. Reorders — `/reorders`
4. Commissions — `/commissions`

Protected Accounts is an Accounts tab/context link. Commission Disputes is a Commissions tab/context link. Both routes remain valid.

### Analyze

1. Analytics — `/analytics`
2. Reports — `/analytics?view=reports`

AI Copilot is not a permanent global workspace item. `/copilot` remains accessible from Home briefings, contextual AI actions, AI history links, command search, and Settings. This prevents AI from dominating the operating model without removing functionality.

### System

1. Documents — `/documents`
2. Data transfer
   - Import — `/imports`
   - Export — `/exports` when capability permits
3. Settings — `/settings`

Data transfer is the only nested sidebar item. Profile, Certification, Subscription, Notifications, and Search live in shell utilities rather than the workspace list.

### Administrative

Operations — `/admin`, separated by a divider and rendered only for admin/support capabilities. It never appears disabled to ordinary representatives.

## Sidebar anatomy

Top to bottom:

1. Ryva wordmark and collapse control.
2. Global Search button with `⌘/Ctrl K` hint.
3. Scrollable grouped workspace navigation.
4. Capability-controlled Operations link.
5. Utility footer:
   - notification button with unread count;
   - profile button with name/credential-state summary.

The workspace groups scroll; logo, search, and footer remain fixed.

## Expanded mode

- Width: 240 px.
- Group labels: 11 px, uppercase only for navigation group labels, not ordinary form labels.
- Link height: 40 px.
- Icon: 18 px, leading.
- Label: 14 px, medium weight.
- Active state: accent-subtle background, accent-strong text, 2 px inset leading marker.
- Hover: neutral-hover background.
- No counters except Tasks/Notifications when count is actionable and non-zero.

## Collapsed mode

- Width: 72 px.
- Brand mark, search icon, workspace icons, notifications, and profile avatar/initial remain.
- Group labels become 1 px separators.
- Every icon has a tooltip after 400 ms and an accessible name.
- Active state uses the same leading marker and subtle fill.
- Data transfer opens a labelled flyout; it does not create a second permanent rail.
- Collapse preference persists per user.

## Search and commands

The Search button opens a command/search dialog. Existing search functionality is preserved:

- grouped record results;
- exact identifiers before fuzzy names;
- permissions applied before display;
- recent records/searches;
- keyboard navigation.

Only safe existing internal actions may be represented. The command interface cannot send outreach, approve agreements, change credentials, change payment state, mark commissions paid, or bypass any reviewed workflow.

The dedicated `/search` route remains the full results page and mobile destination.

## Notifications

- Bell button in the sidebar footer on desktop/tablet.
- Unread count is textually available and capped visually at `99+`.
- Clicking opens a 360 px contextual panel on desktop; “View all” navigates to `/notifications`.
- Critical/action-required items precede informational items.
- Mark-read controls include the notification subject in their accessible name.

## Profile menu

Contains:

- user name and workspace;
- credential and subscription summary;
- Profile — `/profile`;
- Certification — `/certification`;
- Subscription — `/subscription`;
- Settings — `/settings`;
- Sign out.

Restricted access states place Certification/Subscription remediation first.

## Breadcrumbs and relation context

Breadcrumbs represent true hierarchy only:

- Brand → Representation opportunity → Agreement;
- Account → Order;
- Commission → Dispute where entered from the parent.

Cross-linked records use a relation trail, not false hierarchy:

`Product · Brand · Buyer · Placement`

The immediate parent/back context retains the originating saved view and scroll position. All detail pages expose an explicit return action.

## Contextual navigation

- Detail pages use focused tabs, not sidebar children.
- Commerce uses Accounts, Orders, Reorders, Commissions as global siblings; Protection and Disputes become local tabs.
- Outreach uses tabs for Activity, Drafts, Templates, and Sequences while preserving existing routes.
- Analytics uses route/query-synchronized tabs for its existing views.
- Sources, Territories, and Documents open contextually from relevant records; their standalone registers remain reachable through Search/command and System where applicable.

## Capability-dependent behavior

| State | Navigation behavior |
|---|---|
| Full | All entitled groups/actions |
| Grace/read-only | Normal locations remain visible; mutating affordances show read-only state and reason |
| Certification required | Workspace list is replaced by Access, Certification, Subscription, permitted Export, Help/Profile |
| Subscription required | Access, Subscription, Certification, permitted Export, Help/Profile |
| Suspended | Only policy-permitted read locations; persistent suspension banner |
| Revoked | Certification/appeal/support and controlled data-request routes only |
| Export not permitted | Export child is omitted; no disabled tease |
| Provider unavailable | Workspace remains available; affected action is labelled unavailable with recovery information |
| Admin/support | Operations appears in separated administrative section |

Unavailable workflow actions within an otherwise accessible page remain visible when explaining the prerequisite helps the user. They use a reason-bearing disabled or blocked state. Navigation items that the user can never access are omitted.

## Tablet

- 72 px collapsed rail from 768–1023 px.
- Rail can temporarily expand over the canvas without resizing content.
- Right rails become drawers.
- Search and notifications remain in the rail.
- No horizontal global-navigation strip.

## Mobile

Persistent bottom navigation:

1. Home
2. Tasks
3. Placements
4. Search
5. More

More opens a full-height sheet containing grouped navigation, Notifications, Profile, Certification, Subscription, Settings, and Sign out. Current location is announced. The sheet traps focus, closes on Escape, returns focus to More, and supports 44 px targets.

Outreach is available in More and contextually from Placement/Contact. Time-sensitive Outreach approval may surface as a task but does not replace the route.

## Acceptance criteria

- Every current route remains reachable through a global, contextual, relation, command, or profile path.
- No representative sees more than five top-level groups.
- Desktop has no ungrouped 20+ link list.
- Tablet/mobile never use the current horizontal full-navigation strip.
- Sign out is available at every viewport.
- Capability restrictions are truthful and server-authoritative.
- Keyboard users can reach and operate every navigation item and return focus from overlays.
- Current location is conveyed by text/semantics, not color alone.
- Saved view, filter, selection, and scroll context survive detail navigation.

