# Production-readiness specification

## Objective

Make the current EasyACR public beta operationally repeatable without
misrepresenting deferred product capabilities. The public acquisition journey
stays on `easyacr.com`; the authenticated product stays on
`app.easyacr.com`.

## Scope

1. Preserve a durable account lifecycle: passwordless recovery, verified
   sign-in-email change, clear session ending, and durable historic records.
2. Make production verification repeatable: public-host checks, safety
   rejection checks, documented human steps, and a post-deploy runbook.
3. Add no-secret operational monitoring that fails visibly when either public
   host or the app health endpoint is unavailable.
4. Provide an executable Caddy-state backup procedure and a documented
   restore drill.
5. Prepare CAPTCHA and provider configuration without enabling an unverified
   or ineffective anti-abuse control.
6. Keep deployment automation safe: CI continues to verify every change;
   deploy automation must fail before any deployment mutation until protected
   GitHub SSH secrets are configured.

## Acceptance criteria

- `easyacr.com`, `www.easyacr.com`, and `app.easyacr.com` have an explicit,
  tested responsibility.
- Marketing sign-in and account creation request magic links locally and
  redirect only the verified callback to `app.easyacr.com/tools`.
- An authenticated user can request a verified sign-in-email change without
  losing their workspace history.
- A public no-secret readiness script verifies canonical redirects, live
  marketing assets, app health, and key scanner safety rejections.
- A scheduled GitHub health check reports a failed run if a public endpoint
  becomes unavailable.
- Backup, restore, support, deletion, incident, and manual smoke-test
  procedures are documented with a named external-owner action where code
  cannot safely complete it.

## Critical review

The plan deliberately does **not** add passwords, fake billing, simulated
teams, or mock ACR authoring. Passwords would not improve report continuity:
the Supabase user/workspace owns durable history, while magic links recover the
session on any browser. A verified sign-in-email change is the real missing
account-lifecycle control.

CAPTCHA must be enabled in Supabase with a real provider secret before it can
protect magic-link issuance. A client-only widget without Supabase provider
configuration is cosmetic and must not be shipped as protection. Likewise,
backup restoration, legal approval, inbound support mail, and a live
WebMCP-browser test require external systems or a human decision; the codebase
can provide runbooks and gates, not falsify their completion.

## Implementation plan

### Workstream A — account lifecycle

1. Add a Supabase helper that requests a verified email change and returns no
   sensitive data.
2. Add an Account settings control with accurate confirmation guidance.
3. Keep historic scans bound to the unchanged user/workspace identifier.

### Workstream B — verification and monitoring

1. Add a no-secret production-readiness script for canonical hosts, app
   health, static marketing content, and rejected unsafe scan inputs.
2. Add a scheduled GitHub Actions public-health workflow and manual dispatch.
3. Update the production smoke test for the marketing-domain entry journey.

### Workstream C — operations and recovery

1. Add a Caddy-data backup script that produces a timestamped archive and
   requires an explicit off-host destination.
2. Add an operations runbook for backups/restores, support/deletion requests,
   incident response, and controlled smoke testing.
3. Add a deploy workflow template guarded by required GitHub secrets; it must
   skip rather than attempt an insecure deployment when those secrets do not
   exist.

### Workstream D — external-owner gates

1. Configure Turnstile in Supabase Auth and record the verification result.
2. Verify inbound handling for `support@easyacr.com`.
3. Complete a backup/restore drill and record evidence.
4. Complete legal review of terms, privacy, retention, and acceptable use.
5. Run the browser and WebMCP smoke test with a controlled target.

## Definition of done

Workstreams A–C are merged, deployed, and pass local/CI/public checks.
Workstream D remains an explicit release checklist with accountable evidence;
it is never marked complete solely from code review.
