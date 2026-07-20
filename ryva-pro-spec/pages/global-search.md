# Page: Global Search

## Purpose and user

Find permitted records and documents quickly across the operating system.

## Data displayed

Grouped results for Products, Brands, Businesses, Contacts, Opportunities, Accounts, Orders, Commissions, Notes, and Documents; matched snippet, status, owner, last activity, next action.

## Actions

Primary: Open result.  
Secondary: filter type/status/owner/date, recent search, create record when no result, open full result page.

## Filters

Record type, active/archived, owner, status, Brand/Business, date.

## States

- **Empty:** differentiate no query and no match; suggest exact identifier or new record.
- **Loading:** grouped skeleton/typeahead.
- **Error:** preserve query and filters; allow direct navigation.

## Permissions and responsive

All authenticated entitled/read-only users within their rights. Fully mobile supported.

## Linked records and AI

Search result links. No semantic AI search initially.

## Acceptance criteria

- tenant and field permissions enforced before snippets;
- exact IDs rank first;
- typo tolerance works without cross-tenant leakage;
- archived hidden by default;
- results reflect merges;
- keyboard navigation accessible.

