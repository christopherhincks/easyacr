# User flows, route inventory, and screen states

## Discovery and purchase

1. Visitor arrives at `/`, reads the scope and automation limitation, then explores `/features`, `/pricing`, and `/about`.
2. Visitor chooses Start trial and completes `/sign-up`; existing users use `/sign-in`; recovery uses `/password-recovery`.
3. Prototype checkout state appears under `/checkout/success`; failed/canceled states use the same layout with status content in a production adapter.
4. User selects markets and organization context in `/onboarding`, then reaches `/dashboard`.

## Run and review a scan

1. Entitled user starts from `/dashboard` or `/scans` and opens `/scans/new`.
2. Target step validates a complete HTTP/HTTPS URL. Production enforcement belongs on the server, including address classification before/after DNS and redirects.
3. Access step handles public, form login, HTTP Basic, or opaque saved-secret reference. Values remain transient and never enter URL, analytics, logs, fixtures, or client persistence.
4. Scope step sets host/path policy, page limit, include/exclude globs, and optional schedule entitlement.
5. Review step restates limitations; submission enters queued, running, partial, completed, canceled, or failed state.
6. `/scans/:id` moves between executive summary, issues, pages, manual verification, and export. Filters, sorting, search, grouping, pagination, evidence type, code excerpt, explanation, and remediation are represented.

## Manage scans and schedules

1. `/scans` provides history search, status filter, sorting, and report entry.
2. Detail actions allow duplicate/rerun and confirmation before cancel. Processed pages remain a clearly labeled partial result after cancellation.
3. `/schedules` displays cadence, next run, CDT timezone, and active/paused state. Buttons pause/resume; create/edit/remove are normal adapter actions.
4. Every collection is designed for loading, empty, error, success, partial/stale, and permission-restricted variants. Representative success, running, partial, failed, empty-role, and permission states are included.

## Create a draft ACR

1. `/acrs/new` selects completed/partial evidence.
2. User chooses VPAT 2.5Rev 508, EU, INT, or WCAG; US and EU are explained as different contexts.
3. Product information and evaluation methods are supplied.
4. The review step creates an editable draft; missing evidence stays Needs review.
5. `/acrs/:id` uses only Supports, Partially Supports, Does Not Support, and Not Applicable as template results. Remarks and evidence are editable.
6. Save version records a mock audit event. Reviewed export is unavailable until the explicit human-review gate is satisfied.

## Use WebMCP

1. Entitled paid user opens `/tools` and reads the experimental status and limitations.
2. User reviews the catalog, scopes, expiration, recent activity, and mock connection example.
3. User can copy the illustrative endpoint, rotate authorization, connect, or revoke. Disconnected, expired, and insufficient-plan states map to the same connection/status components.
4. Every tool invocation must be authorized on the server; browser discovery does not grant access.

## Route and primary-screen inventory

| Route | Screen | Audience | Primary states |
|---|---|---|---|
| `/` | Product home | Visitor | Default, light/dark, mobile |
| `/features` | Features | Visitor | Default |
| `/pricing` | Draft pricing | Visitor | Draft assumptions |
| `/about` | About/security posture | Visitor | Default |
| `/sign-up` | Sign up | Visitor | Empty, validation |
| `/sign-in` | Sign in | Visitor | Empty, invalid, recovery |
| `/password-recovery` | Password recovery | Visitor | Request, sent |
| `/checkout/success` | Checkout result | Registered | Success; adapter supports canceled/error |
| `/onboarding` | Onboarding | Registered | Context, team, ready |
| `/dashboard` | Dashboard | Authenticated | Empty/free, trial limit, paid data |
| `/scans/new` | New-scan wizard | Trial/paid | Public/protected, validation, queued |
| `/scans` | Scan history | Authenticated | Search/filter/sort/pagination |
| `/scans/:id` | Scan detail/report | Entitled | Running, summary, issues, pages, manual, export |
| `/schedules` | Scan schedules | Paid | Active, paused, restricted |
| `/acrs` | Draft ACR library | Trial/paid | Draft, human review, restricted |
| `/acrs/new` | Draft ACR wizard | Trial/paid | Evidence, market, product, review |
| `/acrs/:id` | Draft ACR editor | Trial/paid | Needs review, saved version, export gate |
| `/tools` | Tools/WebMCP | Paid entitlement | Connected, disconnected, expired, restricted |
| `/account` | Account/profile | Authenticated | Edit/save |
| `/billing` | Subscription/billing | Registered | No plan, trial, paid, admin |
| `/organization` | Organization admin | Paid admin | Member, role, WebMCP, audit |
| `/access-denied` | Access denied | Any | Permission denied |
| unknown | Not found | Any | 404 |
| `/error` | General error | Any | Recoverable failure |
