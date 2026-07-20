# UI Redesign Increment 3 — Application Shell

**Status:** Complete
**Date:** 2026-07-20
**Scope boundary:** Application shell, global navigation, shell utilities, and responsive navigation only.

## Delivered architecture

The protected route boundary now composes one shared `ApplicationShell`. The 51
documented application pages and all existing route declarations remain in
place; no page component, API, permission, or business workflow was redesigned.

The global navigation is capability-derived and follows the approved order:

1. Operate — Home, Tasks, Representation, Placements, Outreach
2. Intelligence — Products, Brands, Businesses & Buyers
3. Commercial — Accounts, Orders, Reorders, Commissions
4. Analyze — Analytics, Reports
5. System — Documents, Data transfer, Settings
6. Capability-controlled — Operations for Admin and Support only

Contacts, Sources, Territories, and AI Copilot remain valid contextual routes
without occupying global navigation. Reports uses the existing Analytics route
with the approved reports view query. Data transfer discloses the existing
Import and capability-controlled Export routes.

## Responsive behavior

- **Desktop:** persistent 240 px sidebar with a user-persisted 72 px collapsed
  state, clear active marker, token-sized icons, collapsed tooltips, internally
  scrollable workspace groups, and a durable utility/profile footer.
- **Tablet:** 72 px rail at 1024 px and below, temporarily expanding over a
  dismissible scrim. The page canvas keeps its width and does not move beneath
  the expanded navigation.
- **Mobile:** fixed context top bar; Home, Tasks, Placements, Search, and More
  bottom navigation; and a full-height, internally scrollable More sheet. The
  sheet exposes every permitted workspace, notifications, account status,
  Settings when permitted, Profile when permitted, and Sign out.

The desktop collapsed preference is deliberately ignored for mobile rendering,
so a stored desktop preference cannot remove mobile menu labels.

## Utilities and access behavior

- Search remains the existing `/search` experience. Sidebar Search and
  `Command/Ctrl K` invoke that route without changing search behavior.
- Notifications retain their existing route and API; the shell displays a
  restrained unread count when the notification request succeeds and safely
  degrades to no count when it does not.
- The profile menu exposes Profile, Certification, Subscription, Settings, and
  Sign out, with credential and subscription statuses.
- Access warnings use the shared persistent Banner.
- Navigation is derived from server-issued session capabilities. Restricted
  sessions receive only Access and any separately granted Export/Settings
  capability; operational navigation is not rendered.

## Accessibility behavior

- Semantic application, primary, mobile-primary, profile, and account
  navigation landmarks.
- `aria-current="page"` for active destinations.
- Accessible labels for icon-only controls and collapsed destinations.
- Tokenized visible focus treatment and 44 px mobile/touch controls.
- Full-height mobile dialog with initial close-button focus, Tab containment,
  Escape dismissal, body scroll lock, focus restoration, explicit close
  action, and polite menu-state announcement.
- Escape handling and focus restoration for the profile disclosure.
- Reduced-motion override for shell transitions and mobile-sheet entry.

## Validation evidence

- `npm run lint`: passed, including the token-only redesign policy.
- `npm run typecheck`: passed for strict server and web projects.
- `npm run test:unit`: 23 passed, including 4 shell contract tests.
- `npm run test:integration`: 62 passed against PostgreSQL.
- `npm run test:e2e`: 46 passed across desktop Chrome and Pixel 7 profiles,
  including shell navigation, focus restoration, Escape, capability visibility,
  and overflow journeys.
- `npm run build`: passed; Vite transformed 84 modules. The existing bundle now
  emits a 501.84 kB minified client chunk and retains Vite's advisory
  code-splitting warning.
- In-app authenticated and restricted sessions were inspected with no console
  errors or document-level horizontal overflow.
- Exact-size captures at 1440 × 900, 1024 × 768, and 390 × 844 reported
  `scrollWidth === clientWidth` and no post-auth console/page errors.

## Review captures

- [Expanded desktop](screenshots/increment-3/desktop-expanded-1440x900.png)
- [Collapsed desktop](screenshots/increment-3/desktop-collapsed-1440x900.png)
- [Tablet navigation](screenshots/increment-3/tablet-navigation-1024x768.png)
- [Mobile navigation closed](screenshots/increment-3/mobile-navigation-closed-390x844.png)
- [Mobile navigation open](screenshots/increment-3/mobile-navigation-open-390x844.png)

## Increment boundary and risks

No Home, workspace, page-content, or page-specific layout redesign was started.
The content visible inside the new shell therefore retains its existing visual
debt until its scheduled redesign increment.

The long desktop/tablet navigation is intentionally internally scrollable on
short viewports so the fixed utility/profile area remains reachable. Future page
redesigns must preserve `min-width: 0`, avoid introducing document-level
horizontal overflow, and account for the mobile top/bottom shell in sticky
page-level controls.

No founder decision was required.

## Corrective responsive pass — 2026-07-20

Founder review identified visual clipping at a real mobile viewport despite the
original document-width assertion passing. The assertion was insufficient:
legacy flex headers could shrink a trailing action to a narrow sliver while
remaining technically inside `scrollWidth`, and the shell had not opted into
safe-area viewport coverage or asserted every bottom-navigation cell against
the visual viewport.

The Increment 3 shell now:

- opts into `viewport-fit=cover`;
- constrains the root, shell canvas, page boundary, panels, and relevant
  flex/grid headers to the available mobile inline size;
- wraps legacy record/section header actions instead of allowing destructive
  flex shrink;
- sizes the fixed top bar, bottom navigation, and More sheet with dynamic
  viewport and safe-area insets;
- gives all five bottom-navigation cells zero minimum inline size and allows
  long labels to wrap within their own cell;
- keeps the More sheet vertically scrollable through its account and Sign out
  controls, including bottom safe-area padding; and
- tests visible element rectangles against `visualViewport.width`, rather than
  relying only on document `scrollWidth`.

Corrective validation passed at 1440 × 900 expanded/collapsed, 1024 × 768,
390 × 844, 375 × 812, and 320 × 568. The final suite reports 23 unit tests and
47 passing Playwright tests with one intentional duplicate-project skip. No
Home markup/content or Increment 4 work was changed.
