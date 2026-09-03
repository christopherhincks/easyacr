# Architecture decision and integration boundaries

## ADR-001: Typed React prototype with replaceable adapters

**Status:** Accepted for prototype, September 1, 2026.

**Decision:** Use React 19, TypeScript, Vite, semantic native controls, CSS custom-property tokens, and a minimal History API router. Keep authentication, payments, scanning, scheduling, ACR generation, deadline content, and WebMCP behind replaceable service boundaries represented in `src/domain.ts`.

**Why:** The stack is stable, typed, testable, responsive, themeable, locally runnable, and can migrate to a server-rendered React framework when production routing/auth requirements are chosen. Avoiding a component framework keeps the supplied design-system tokens authoritative. Native controls reduce custom accessibility risk.

**Consequences:** Public pages remain client-rendered, so marketing SEO/SSG is a later concern. The production scan path is now implemented as a server API, private Supabase auth/data gateways, a durable Postgres job record, isolated Playwright worker, and controlled egress proxy. Representative dashboard screens are still product-demo UI rather than durable workspace views.

## Integration boundaries

| Integration | Browser responsibility | Application server | Worker/provider |
|---|---|---|---|
| Authentication | Collect credentials via protected transport; hold session UI state | Session rotation, MFA/SSO, organization membership, authorization, CSRF | Identity provider and audit events |
| Payments | Show plan/checkout status; never trust UI entitlement | Checkout sessions, signed webhooks, plan state, idempotency | Payment processor |
| Scanner | Validate useful input and clear secrets after submit | Canonical URL policy, authorization, rate limits, secret envelope, job creation | Isolated fetch/browser worker, DNS/redirect checks, sanitized results |
| Scheduler | Collect cadence/timezone and show next run | Durable schedule, timezone/DST rules, pause/delete, authorization | Queue, retries, concurrency, observability |
| Draft ACR | Edit draft fields, remarks, and evidence links | Template/version registry, organization isolation, validation, version/audit record | Document renderer and secure object storage |
| Deadline feed | Display source and last-verified date | Curated authoritative source record and stale-date policy | Human/legal content review |
| WebMCP | Feature detect, explain tools, surface consent/activity/revocation | Per-call auth, scopes, user/org policy, rate limit, audit | Experimental WebMCP adapter or other client bridge |

## Durable automated evidence

`create_draft_acr` is intentionally named for compatibility with the prototype tool surface, but its production behavior is narrower: it idempotently creates a durable, immutable `automated_draft` evidence artifact tied to the requesting user's completed or partial scan. The artifact snapshots automated counts by severity, scan metadata, the WCAG 2.2 template identifier, and the human-review warning. It does not create an ACR, select VPAT terms, or assert conformance. Finding retrieval applies severity filtering before numeric cursor pagination, so an agent cannot accidentally skip or duplicate a filtered result set.

The application and data gateway perform only pure URL/hostname syntax validation before durable queueing; neither performs a public DNS lookup. The isolated worker and controlled proxy remain responsible for DNS classification, rebinding protection, and connection-time egress enforcement.

## WebMCP decision

As of September 2, 2026, WebMCP is a [Draft Community Group Report](https://webmachinelearning.github.io/webmcp/), not a stable multi-browser production dependency. The public beta feature-detects `document.modelContext.registerTool()` only after the browser holds a Supabase-authenticated, signed same-site scan session with accepted terms. It registers `get-scan-status`, `start_accessibility_scan`, `list_accessibility_issues`, and `create_draft_acr`; each callback calls an API that rechecks the session and CSRF token. Registration shares an abort controller so a failure or page unload unregisters all earlier tools. Findings are marked as untrusted content. The former invite flow is an explicitly enabled local demo harness, not a public access path. This is an automated-evidence beta, not a conformance or ACR-completion service, and still requires specification pinning, auditing, privacy/security testing, and a non-WebMCP fallback before a broader release.

## VPAT decision

[ITI VPAT 2.5Rev](https://www.itic.org/policy/accessibility/vpat) (April 2025) is the current template family verified for this prototype. Editions are 508, EU, WCAG, and INT. Template result terms are Supports, Partially Supports, Does Not Support, and Not Applicable. easyACR’s “Needs review” remains a pre-decision workflow state and must be resolved before reviewed export.
