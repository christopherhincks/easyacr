# Agency platform implementation plan

## Critical review of the specification

The specification is intentionally broader than the existing beta. Building
all listed navigation before durable backing data would recreate the exact
mock-product failure we are retiring. Therefore the plan ships only a screen
when it has an honest empty/loading/error state and a server-authorized data
path. It also keeps billing and invitations out of the first release because
they require external provider and delivery decisions.

## Plan

### 1. Remove ambiguity and establish the public boundary

- Remove legacy fixture exports and fixture-oriented tests from production
  WebMCP modules.
- Change metadata and user-facing account language from “prototype/sign in” to
  “public beta/create or sign in.”
- Configure `easyacr.com` as marketing and `www` as a redirect only after the
  new marketing response is deployed and validated.

### 2. Deliver a durable single-agency workspace

- Treat existing personal workspace, target authorization, scans, findings,
  and evidence artifacts as the source of truth.
- Add API projections for workspace overview, sites, evidence list, and
  profile only through the data gateway.
- Add authenticated overview, sites, evidence, and settings routes with real
  empty/error states.

### 3. Operationalize the agency workflow

- Add site grouping/trends, evidence export, retention/deletion request, and
  notification preferences with audit events.
- Add interaction tests for lifecycle polling, filtering, and cursor loading.

### 4. Expand only with approved integrations

- Add team invitations using the existing membership roles and a transactional
  email provider.
- Add billing only after plan, processor, tax, and entitlement policy choices
  are approved; no placeholder checkout UI.

## First-slice acceptance checks

- No shipped source or live page presents Northstar fixtures as product data.
- Metadata calls EasyACR a public beta.
- The account entry explains first-time magic-link use without promising a
  password workflow.
- Existing real WebMCP tools, scan safety checks, and browser fallback pass.
- The next workspace routes are added only alongside backed API contracts.
