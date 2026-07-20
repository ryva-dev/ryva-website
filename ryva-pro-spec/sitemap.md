# Sitemap

## Public and access

- `/login` — Login
- `/access/certification` — Certification access check
- `/access/subscription` — Subscription activation
- `/onboarding` — Guided real-data setup

## Application

- `/home` — command center
- `/products` — Product Intelligence
  - `/products/:productId`
  - `/products/compare`
- `/brands` — Brand Intelligence
  - `/brands/:brandId`
- `/businesses` — Business and Buyer Intelligence
  - `/businesses/:businessId`
  - `/contacts/:contactId`
- `/placements` — Placement CRM
  - `/placements/:opportunityId`
- `/outreach` — unified outreach/activity center
  - `/outreach/sequences`
  - `/outreach/templates`
- `/tasks`
- `/calendar`
- `/accounts/protected`
- `/accounts/:accountId`
- `/orders`
  - `/orders/:orderId`
- `/reorders`
- `/commissions`
  - `/commissions/:commissionId`
  - `/commissions/disputes`
- `/analytics`
- `/notifications`
- `/documents`
- `/search`

## Settings

- `/settings`
- `/settings/profile`
- `/settings/subscription`
- `/settings/certification`
- `/settings/integrations`
- `/settings/import-export`
- `/settings/security`

## Administration

- `/admin/credentials`
- `/admin/access`
- `/admin/support-cases`
- `/admin/audit`
- `/admin/jobs`

Admin routes are absent from ordinary navigation and require explicit role and step-up authentication where configured.

## Record routes

Canonical URLs use opaque IDs. Human-readable names may appear as optional slugs but never determine authorization or identity.

