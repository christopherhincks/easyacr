# easyACR — Judge-readiness specification

## Outcome

Make the public beta's browser fallback and WebMCP path tell one complete,
truthful story: an authorized user can start one bounded public-site scan,
observe it reaching a terminal state, review complete automated findings, and
create a clearly limited WCAG 2.2 draft-evidence artifact.

The change targets the WebMCP Challenge's equally weighted criteria: genuine
WebMCP leverage, coherent execution, credible impact, and creative ambition.
It does not turn automated output into an ACR, a certification, or a legal
opinion.

## Evidence considered

- Agency-owner, in-house accessibility-lead, and simulated judge-panel reviews
  on 2026-09-02.
- The actual API, UI, schema, deployment files, and private Hetzner staging
  checks.
- The public Caddy deployment is the intended browser path. Its CSP permits
  the configured Supabase host; the direct Node path must provide the same
  safe `connect-src` allowance or be explicitly unsupported.

## Requirements

### R1 — Observe scan progress

- `/scans/:id` fetches scan and findings on entry.
- While a scan is `queued` or `running`, it polls with bounded five-second
  backoff and stops at a terminal state.
- A user can refresh manually and sees the last successful update time.
- Load failures preserve a retry path and return the server's actionable
  message when safe to display.

### R2 — Complete browser evidence workflow

- A completed or partial scan exposes a browser action to create the existing
  `WCAG_2_2` draft-evidence artifact.
- The action uses the same CSRF-protected API as the WebMCP write tool.
- The resulting artifact identifier/state is visible with an explicit
  automated-evidence and human-review warning.

### R3 — Review complete, usable findings

- The detail surface renders rule ID, failure summary, guidance link, page,
  selector, and explicit source-derived/untrusted labeling.
- It shows total findings, a severity filter, and incremental pagination.
- It never renders scanned content as HTML.

### R4 — Tie consent to a target and explain limits

- Browser and agent scan starts require an explicit `authorizationConfirmed`
  attestation.
- The existing database target-authorization RPC remains the durable audit
  mechanism; no site credentials or verification token are collected.
- The browser states public HTTPS restrictions, 10-page cap, daily beta quota,
  and queue-delay possibility before submission.

### R5 — Keep contracts and deployment-safe headers correct

- WebMCP schemas declare every runtime-required input.
- Scan status and findings are annotated as potentially untrusted because they
  contain user- or target-derived values.
- Direct Node serving permits only the configured Supabase origin for browser
  `connect-src`; Caddy remains the required public ingress in production.

### R6 — Make evaluation reproducible

- Add a judge quickstart and a 90-second demo runbook.
- Add a dated hackathon build note that distinguishes WebMCP work from the
  upstream project.
- README links to those materials and describes the four-tool flow.

## Explicit non-goals and external launch gates

- No authentication bypass, shared judge token, or fixture mode is introduced.
  Any judge access pattern needs an operator-approved, time-boxed account.
- No DNS cutover, TLS activation, magic-link delivery, video upload, or
  Devpost submission occurs from repository code.
- Do not add a software license without authorization from the copyright owner
  of the upstream project. A visible OSI license is still a submission gate.
- A persistent public fork and dated commits must be created by the project
  owner before submission.

## Critical review

The first review proposal overreached by treating Caddy's production CSP as a
confirmed auth failure; it is not. The implementation instead closes the
direct-serving discrepancy and retains Caddy as the public boundary.

The proposal also suggested a no-friction judge bypass. That conflicts with
the product's authorization model and would weaken a scanning service. The
safe alternative is a documented, operator-provisioned test account and a
controlled public target.

Browser evidence parity, status polling, complete findings, explicit input
schemas, and target attestation have strong agreement across all reviewers and
are safe to implement before the external launch gate. Public DNS, a video,
license selection, and repository publication cannot be truthfully completed
by source changes alone.

## Implementation plan

1. Correct the API/WebMCP contracts and CSP configuration.
2. Implement browser scan attestation, limit guidance, and actionable errors.
3. Replace the static scan-detail fetch with observable lifecycle, findings,
   pagination, and evidence controls.
4. Fix mobile navigation closing and visible support contact.
5. Add judge/demo/hackathon documentation; update route and WebMCP regression
   coverage.
6. Run type, lint, unit/route/a11y, Docker Compose, and staged-host validation.
7. After external DNS is updated: enable Caddy, verify TLS and magic link, then
   run the controlled browser/WebMCP smoke test.

## Acceptance checks

- A scan page updates from queued/running without a reload and can be manually
  refreshed.
- A completed/partial browser scan creates and displays draft evidence.
- A scan with more than one findings page can reveal all findings and filter by
  severity.
- Browser and WebMCP scan starts fail before queueing without attestation.
- WebMCP tool schemas and handlers agree on required inputs.
- Direct app CSP and Caddy CSP allow only the configured Supabase browser
  origin for `connect-src`.
- Judge docs contain the safe access, exact tool-call, fallback, and video
  script guidance without claiming the public endpoint is already live.
