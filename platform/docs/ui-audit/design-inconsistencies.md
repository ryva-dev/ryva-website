# Design Inconsistencies

## Findings

| ID | Area | Inconsistency | Current examples and impact |
|---|---|---|---|
| DES-01 | Spacing | Vertical rhythm is controlled by a mix of panel adjacency, local margins, grid gaps, and one-off padding. | `.panel + .panel`, explicit `margin-top`, artifact grids, and inline forms create different section intervals. |
| DES-02 | Typography | One global fluid `h1` scale serves login marketing, Home greeting, utility registers, and dense operational pages. | Titles can reach 4.4rem even where a compact operational heading would carry the same level. |
| DES-03 | Typography | Eyebrows, labels, table headers, metric labels, statuses, and quiet tags each use different uppercase/letter-spacing recipes. | Small metadata feels related but not systematically tiered. |
| DES-04 | Buttons | Primary, secondary, text, danger, danger-text, inline, link-as-button, and emphasis-panel overrides are used without a clear cross-page hierarchy. | “Refresh,” “Revoke,” “Mark read,” exports, back links, and commits vary in weight and size. |
| DES-05 | Buttons | Page-header actions are structurally inconsistent. | Actions may be a status pill, one export link, a button row, a back link, or absent on similar details. |
| DES-06 | Radius | Radii range from `.35rem` tags through `.48rem` controls, `.55–.7rem` rows/subnav, `.75–.85rem` cards/panels, and a custom brand-mark shape. | Surface hierarchy is not encoded consistently by curvature. |
| DES-07 | Shadows | Most panels receive the same large shadow while cards, rows, tables, and specialized surfaces often do not. | Equal panel elevation makes creation forms, warnings, registers, and summaries feel equally prominent. |
| DES-08 | Colors | Semantic colors are partly tokenized and partly hard-coded; `var(--mist)` is used without a root declaration. | Warnings, formulas, success text, locked settings, and statuses do not derive from one semantic palette. |
| DES-09 | Iconography | There is no shared icon system or icon-sizing convention. | Navigation and actions are text-only; the only graphical mark is the brand mark/audit dot/spinner. |
| DES-10 | Tables | Table density, columns, links, actions, empty behavior, and responsive use vary by page. | Analytics dynamic tables differ from Intelligence, Admin, Generic Records, Outreach, and Commerce tables. |
| DES-11 | Forms | `Field`-wrapped forms coexist with bare ARIA-labelled controls, inline labels, checkbox groups, and placeholder-led saved-view inputs. | Label spacing, help placement, validation, and action alignment are inconsistent. |
| DES-12 | Page width | Most pages use the shared 1320 px container, but full loading/error returns and authentication/access surfaces use different wrappers. | Context can visually jump between loading and resolved detail states. |
| DES-13 | Alignment | Section headers, record headers, metric rows, table actions, and page actions align to different baselines. | Similar “title + action/status” patterns do not feel like one system. |
| DES-14 | Empty/loading/error | Three empty-state styles and several warning/provider/blocker styles coexist. | State importance and available recovery are inconsistent. |
| DES-15 | Terminology/capitalization | Buyer/Business, Placement CRM/Placement Opportunities, Operations/Platform operations, Import/Export singulars, and title-case domain nouns are mixed. | Users must translate labels; the same concepts appear to change names. |
| DES-16 | Status labels | Statuses are rendered from raw enum strings with underscore replacement and partial color mappings. | Unknown statuses look generic; capitalization and wording are data-driven rather than user-language controlled. |

## Category notes

### Spacing and density

The stylesheet has useful shared gaps and page padding, but page files frequently introduce their own nested panels and grids. A long detail page can alternate wide blank space, 145–170 px metric cards, compact timelines, and dense form rows without a consistent rhythm tied to task priority.

### Typography

The current typography is visually confident on Login and Home. It is less suitable for dense operational registers, where the same title behavior consumes significant vertical space. Metadata styles are numerous and close in appearance, making hierarchy subtle rather than explicit.

### Color and elevation

The forest/paper/lime palette is cohesive at brand level. Semantic meaning is less cohesive: gold can indicate numbering, lime focus, yellow warnings, red blockers, sage status, and gray locked content without a complete state system. Panel shadows are decorative rather than reliably indicating interaction or elevation.

### Forms and data display

Forms are functional and mostly labelled, but their composition varies by page. Tables are wrapped for horizontal scrolling, while many registers choose lists or cards even for similar attributes. Users therefore relearn filtering, scanning, and action placement across domains.

### Terminology

Capitalization frequently reflects internal entity naming (“Order,” “Product,” “Business”) inside sentences. Status values are mechanically transformed. The product voice is careful and ethical, but interface labels are not governed by an equally consistent lexicon.

