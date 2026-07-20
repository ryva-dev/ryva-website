# Page: Profile

## Purpose and user

Manage professional identity and preferences used in Ryva Pro and approved communication.

## Data displayed

Name, photo, professional title, certification summary, outreach identity/signature, time zone, currency, categories, Business types, geography/channel preferences, experience self-assessment, notification/working hours.

## Actions

Primary: Save Profile.  
Secondary: change photo, update preferences, review credential, manage signature.

## Filters

None.

## States

- **Empty:** required identity and regional defaults.
- **Loading:** field skeleton.
- **Error:** inline validation; preserve draft.

## Permissions and responsive

User edits own profile. Credential fields read-only from authority. Fully responsive.

## Linked records and AI

Credential, User, Templates, Outreach identity, Home preferences. AI may suggest normalized category labels but user confirms.

## Acceptance criteria

- outreach identity cannot misstate credential/authority;
- credential not manually editable;
- time zone/currency required;
- signature version captured with sends;
- profile changes audited where used in external communication.

