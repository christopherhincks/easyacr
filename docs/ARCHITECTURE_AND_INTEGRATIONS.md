# Architecture decision and integration boundaries

## ADR-001: Typed React prototype with replaceable adapters

**Status:** Accepted for prototype, September 1, 2026.

**Decision:** Use React 19, TypeScript, Vite, semantic native controls, CSS custom-property tokens, and a minimal History API router. Keep authentication, payments, scanning, scheduling, ACR generation, deadline content, and WebMCP behind replaceable service boundaries represented in `src/domain.ts`.

**Why:** The stack is stable, typed, testable, responsive, themeable, locally runnable, and can migrate to a server-rendered React framework when production routing/auth requirements are chosen. Avoiding a component framework keeps the supplied design-system tokens authoritative. Native controls reduce custom accessibility risk.

**Consequences:** Public pages in this prototype are client-rendered; a production deployment should adopt SSR/SSG for marketing content and route-level data loading. The mock router and in-memory interactions are intentionally simple. Browser/server separation is documented rather than implemented as a backend.

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

## WebMCP decision

As of September 1, 2026, WebMCP is a [Draft Community Group Report](https://webmachinelearning.github.io/webmcp/), not a stable multi-browser production dependency. The prototype feature-detects `document.modelContext.registerTool()` and registers one same-origin, read-only `get-scan-status` stub when supported. The deterministic response is representative fictional data matching SCN-1047; it performs no network request and changes no state. Production integration still requires server authorization, reviewed specification pinning, privacy/security testing, auditing, and a non-WebMCP fallback.

## VPAT decision

[ITI VPAT 2.5Rev](https://www.itic.org/policy/accessibility/vpat) (April 2025) is the current template family verified for this prototype. Editions are 508, EU, WCAG, and INT. Template result terms are Supports, Partially Supports, Does Not Support, and Not Applicable. easyACR’s “Needs review” remains a pre-decision workflow state and must be resolved before reviewed export.
