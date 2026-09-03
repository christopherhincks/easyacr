# easyACR agency platform — product specification

## Product decision

easyACR will be a public marketing site plus a secure agency workspace. It is
not a port of the retired Northstar mock. The product's first-class object is
an agency-owned public website, with scans, findings, and reviewed evidence
attached to that site over time.

## Domain boundary

| Surface | Host | Responsibility |
| --- | --- | --- |
| Marketing | `easyacr.com` | Explain the product, safety boundaries, WebMCP support, and route visitors to the app. |
| Legacy alias | `www.easyacr.com` | Permanent redirect to `easyacr.com`; it must never continue serving mock data. |
| Product | `app.easyacr.com` | Identity, workspace data, scan execution, findings, evidence, and account controls. |

## Core agency journey

1. A visitor understands the public-site scanning boundary on marketing.
2. They choose **Create or sign in with email**; first-use magic links create
   an account only when Supabase self-service sign-up is explicitly enabled.
3. They accept terms, name their workspace, and land in an empty overview.
4. They add an authorized public site, then start a bounded scan through the
   browser or a WebMCP-capable agent.
5. The workspace shows scan progress, trends, actionable findings, and a
   human-review-required evidence attachment.
6. The owner can manage their profile, retention requests, team access, and
   eventually subscription entitlement without exposing credentials or
   authenticated targets to the scanner.

## Information architecture

### Marketing

- Home, how it works, WebMCP compatibility, safety/security, FAQ, and contact.
- Product proof must use live product behavior or clearly label static
  illustration; it must not use Northstar fixtures.
- Primary CTA: `Open easyACR` → `app.easyacr.com/tools`.

### Workspace application

- **Overview** — active scans, recent completed scans, severity totals, scan
  quota, and next action.
- **Sites** — authorized origins, scan history, ownership attestation, and
  site-level trend view.
- **Scans** — queue, lifecycle, findings, filtering, pagination, and evidence.
- **Evidence** — immutable automated attachments with review state; never a
  completed ACR or conformance claim unless a separate qualified-review flow
  is later built.
- **Team** — owner/admin/member/viewer membership, invitations, audit trail.
- **Settings** — profile, workspace name, notification preferences, data
  retention/deletion request, sign-out, and legal notices.
- **Billing** — deferred until a payment provider, plans, tax posture, and
  entitlement policy are approved. It must not be represented with mock UI.

## Data and security rules

- Preserve the existing user profile, personal workspace, terms acceptance,
  target-authorization audit, durable job, findings, evidence, and RLS model.
- Add a durable `sites` projection only after it is populated from authorized
  origins; do not introduce a second authorization source of truth.
- Keep browser sessions HttpOnly and server-validated; never expose service
  keys or scanner credentials to the client.
- Team invitations and billing require new provider choices and cannot be
  simulated as complete product features.

## Critical review

The existing `/scans` page is sufficient as a beta scan history but is not an
agency dashboard: it lacks a workspace overview, site grouping, profile
visibility, onboarding, and account control. The existing `signInWithOtp`
call is an entry mechanism, not discoverable account creation. The live HTML
still calls the product a prototype, and legacy stub exports in `webmcp.ts`
make source review needlessly ambiguous. Neither should ship as the primary
public experience.

The solution is not to revive mock routes. It is to retain the secure scan
vertical slice and build a new data-backed workspace around it.

## Delivery order

1. Retire mock traffic; remove legacy stubs; correct product metadata and
   account-creation language.
2. Build the marketing surface and host routing without weakening app auth.
3. Build authenticated onboarding, overview, site inventory, and account
   settings on the current Supabase records.
4. Add evidence library, reporting/export capability, and notification model.
5. Add team invitations/roles, then billing only after provider approval.

## Acceptance criteria for the first platform release

- `www` contains no mock page or fictional identifiers.
- A first-time user can understand and complete account entry without a
  separate password flow.
- A signed-in user has an overview, sites, scans, evidence, and settings
  navigation; every displayed value is their durable data or an honest empty
  state.
- A marketing visitor can distinguish automated evidence from an ACR or
  certification and reach the app in one action.
- Existing WebMCP/browser scan safety boundaries and server-side authorization
  continue to pass their regression suite.
