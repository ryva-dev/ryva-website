# Application Shell

## Desktop frame

```text
┌────────────── 240 px sidebar ──────────────┬──────────────── page canvas ────────────────┐
│ Brand / collapse                           │ Optional access or provider banner           │
│ Search                                     │ Breadcrumb/relation trail                     │
│ Grouped navigation                         │ Compact page or identity header               │
│                                            │ Tabs / filters / actions                      │
│ Operations (capability controlled)         │ Main workspace                Context rail     │
│ Notifications / profile                    │                               (when useful)     │
└────────────────────────────────────────────┴─────────────────────────────────────────────┘
```

- Sidebar: fixed, 240 px expanded or 72 px collapsed.
- Canvas: `surface-canvas`; min-width 0; independent vertical document scroll.
- Page maximum: 1440 px content width excluding sidebar.
- Standard gutters: 48 px desktop, 64 px wide desktop.
- Detail rail: 320 px; 24 px gap; sticky below header when content allows.
- Data workspaces may use full available width.

## Page canvas

The canvas is near-white and visually open. It does not wrap the whole page in a card. Use surfaces only for:

- editable or selectable regions;
- tables and document previews;
- warnings/blockers;
- explicit summaries requiring separation.

Sections are separated first by spacing and headings, second by subtle rules, and only then by containers.

## Page header

Height is content-driven, typically 72–104 px.

Left:

- breadcrumb or relationship trail;
- 24–30 px page title;
- one line of supporting context when needed.

Right:

- one primary action;
- up to two secondary actions in an overflow menu or quiet buttons.

Headers are compact, not hero sections. Detail pages use `IdentityHeader` instead.

## Identity header

Contains:

- record type and name;
- restrained status/qualification label;
- relationship line;
- owner and last meaningful activity;
- critical risk/authority indicator when present;
- one primary next action;
- secondary action menu.

It remains visible at the top of the detail page; on desktop, the tab bar may become sticky after scrolling. It never includes a decorative avatar unless a real Brand/Product/Contact image exists and has a valid fallback.

## Command/search interface

- Opened from sidebar Search or `⌘/Ctrl K`.
- Centered dialog, max-width 720 px.
- Search input receives initial focus.
- Results grouped by existing record type.
- Arrow keys navigate; Enter opens; Escape closes and returns focus.
- Safe actions are visually separate from record results.
- Full search results link to `/search`.

## Notifications

- Desktop context panel: 360 px anchored panel; not a permanent third column.
- Mobile: full-height sheet.
- Shows reason, record, severity text, time, read state, and safe action.
- System changes are not shown as transient toast only.

## Profile and account

The profile menu is the durable location for Profile, Certification, Subscription, Settings, workspace identity, and Sign out. Credential/access changes may also produce a persistent banner.

## Context rail

- Width: 320 px on ≥1280 px content area.
- Optional; no blank rail.
- Up to three modules.
- Uses subtle surface or top rules, not stacked shadow cards.
- Order: next action, blocker/authority/risk, key relationship/commercial context.
- At 1024–1279 px, collapses to an “Open context” drawer.
- Below 768 px, context is summarized inline and opens full-screen.

## Drawers

Sizes:

- narrow 400 px: evidence, history, task/note;
- standard 520 px: record preview, AI review;
- wide 680 px: document and complex evidence review.

Behavior:

- enters from right over a scrim;
- title and close button remain sticky;
- body scrolls; actions remain sticky when needed;
- focus is trapped and restored;
- Escape closes unless a submitted consequential action is processing;
- unsaved changes prompt before close.

On mobile, all drawers become full-screen views.

## Dialogs

- Confirmation: 440 px.
- Command/search: 720 px.
- Destructive or consequential dialog names the object, consequence, and irreversible effect.
- Dialogs are not used for long forms or multi-section record review.
- Agreement approval, outreach send, commission payment, dispute resolution, and import commit may use a final confirmation dialog only after the full review screen.

## Toasts

Use for non-critical, reversible feedback:

- draft saved;
- view saved;
- note added;
- copy completed.

Toasts last 5 seconds, pause on hover/focus, are announced politely, and include Undo only when a real safe undo exists. Errors, blockers, permission failures, and provider degradation remain inline.

## Banners and system status

Priority order:

1. revoked/suspended/access blocked;
2. read-only/grace/payment retry;
3. authority/suppression/critical record blocker;
4. provider degraded;
5. informational.

Global banners appear below the shell top edge and above the page header. Page-specific blockers appear adjacent to the action they govern. Banners contain severity text, reason, scope, and action/recovery; they are never color-only.

## Loading

- Shell and page identity remain stable.
- Skeletons match the expected content shape.
- Partial data is shown if safe and labelled stale/partial.
- Buttons use local progress indicators without changing width.
- Loading never clears entered form data.

## Error

- Global route error retains shell, breadcrumb, page identity, retry, and safe return.
- Section errors occupy the failed section only.
- Field errors appear by the field and in a focusable summary for long forms.
- Correlation/support identifiers may be shown when safe.

## Restricted and degraded states

- Read-only mode preserves navigation and inspection; mutating actions explain the access reason.
- Provider unavailable does not make zero data claims.
- Missing authority, unresolved conflict, suppression, or absent human approval appears at action point and in the context rail.
- Admin/support views remain visually part of Ryva but use an “Operations” identity and explicit scope banner.

## Shell acceptance criteria

- No page requires the current horizontal navigation strip.
- Sign out and credential state are available on every viewport.
- Main content can reflow to 320 CSS px without document-level horizontal overflow.
- Context rail is absent when it has no decision value.
- All overlays meet focus, escape, labelling, and return-focus requirements.
- Global and page blockers cannot be mistaken for transient success feedback.
- The shell does not change server policy or infer access from visibility.

