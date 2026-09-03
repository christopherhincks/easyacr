# easyACR public beta — SDD hardening plan

## Product contract

easyACR's public beta lets an authenticated person authorize a public HTTPS
site, use a compatible WebMCP agent (or the browser fallback) to run a capped
automated accessibility scan, inspect durable automated findings, and create a
durable draft-evidence artifact. It is not an accessibility certification,
completed ACR, billing product, scheduler, team workspace, or authenticated
website scanner.

## Explicit non-goals for this release

- Password sign-up, subscriptions, payment collection, trials, and invoices.
- Team administration, scheduling, reviewed ACR editing/export, or completed
  conformance claims.
- Authenticated scans, submitted credentials, raw-page archival, and security
  testing.

Deferred product routes must not simulate these as functioning public features.

## Acceptance scenarios

### S1 — truthful arrival and navigation

Given an unauthenticated visitor opens the public app, when they follow any
primary call to action, then they arrive at the real `/tools` sign-in flow. No
public navigation or form implies a functional password account, paid plan,
team workspace, or ACR editor.

### S2 — authenticated scan initiation

Given a user completed Supabase magic-link sign-in and accepted the current
terms, when they submit a valid public HTTPS URL through WebMCP or the browser
fallback, then the same server-authorized durable job is queued, its identifier
is shown, and a per-user daily quota, global queue cap, and target authorization
are enforced.

### S3 — target safety

Given a URL contains credentials, is non-HTTPS, uses an IP literal, localhost,
or has an invalid host, when it is submitted, then it is refused before a
durable job or target-authorization record is made. DNS and redirect validation
remains authoritative in the isolated worker and egress proxy.

### S4 — bounded untrusted scanning

Given a target produces many or large findings, never-idle responses, or a slow
accessibility analysis, when a worker scans it, then the scan ends under
explicit time, connection, byte, process, CPU, and memory budgets. The
completion payload fits the gateway limit; any omitted findings are represented
honestly rather than silently losing a completed job.

### S5 — durable evidence and findings

Given a user owns a completed or partial scan, when their agent calls
`list_accessibility_issues` with severity and pagination inputs, then returned
findings honor those inputs and provide an accurate cursor. When it calls
`create_draft_acr`, a durable, user-owned draft-evidence artifact is created or
returned idempotently and is explicitly labeled as automated evidence requiring
human review.

### S6 — regression and release verification

Given a pull request changes the beta, then CI verifies the browser UI at
desktop/mobile and keyboard paths, WebMCP requests, durable gateway/worker
contracts, scanner policy limits, migrations, and Compose configuration. A
deployed environment additionally follows `PRODUCTION_SMOKE_TEST.md`.

## Critical plan review and decisions

The original codebase contains a polished but fictional full-product prototype.
Finishing that product before launch would dilute effort and expose misleading
flows. The beta therefore ships a narrow, truthful surface rather than trying
to make simulated billing, accounts, teams, schedules, or ACR editing appear
complete.

The egress proxy is the security boundary; client and app checks are defence in
depth. We will not add application-network DNS dependence to compensate for the
isolated worker boundary. Instead, enqueue-time checks are purely syntactic and
the worker/proxy retain authoritative DNS, redirect, and address checks.

A nominal maximum finding count is not a safe payload budget. Scanner results
must have an explicit byte budget, and the database must record persisted and
omitted counts separately enough that no result is mistaken for a complete
enumeration.

## Implementation slices

1. **Truthful UI** — reduce public navigation to live capabilities, repair scan
   feedback, and verify accessible keyboard/mobile interactions.
2. **Durable evidence/API** — add an additive migration and narrow gateway
   operations for persisted evidence, correct finding filters/cursors, and
   safe enqueue validation.
3. **Scanner containment** — bound payloads, deadlines, proxy tunnels, and
   container resources with tests.
4. **Root integration review** — inspect all changes against S1–S6, run the
   complete verification suite, resolve conflicts, and update the launch
   checklist.

## Deferred external work

- DNS, verified Resend sender, VPS, production secrets, and TLS deployment.
- Turnstile credentials and the hosted Supabase CAPTCHA configuration.
- Live browser/agent compatibility smoke tests, backup/restore drill, support
  mailbox, monitoring, and legal approval.
