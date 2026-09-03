# Public prototype launch specification

**Decision:** Ship easyACR as an authenticated public-site automated-evidence beta. It is not a conformance, completed-ACR, or compliance-certification service.

## Problem and outcome

Prospective accessibility teams need agents to collect initial automated evidence from their public websites. A user signs in through Supabase, lets a compatible agent invoke the WebMCP tools, and receives capped, same-origin axe findings plus a WCAG 2.2 draft evidence attachment. They cannot scan authenticated targets, submit credentials, obtain a conformance result, or receive a completed ACR.

## User stories and acceptance criteria

1. As an authenticated user, I can authorize my browser agent to scan a public HTTPS target.
   - A signed HttpOnly, same-site session and CSRF token are required for every scan request.
   - The target is HTTPS-only, credential-free, hostname-based, exact-origin, and limited to ten pages and 120 seconds.
2. As a compatible AI client, I can invoke session-scoped tools to start a scan, poll status, read findings, and generate WCAG 2.2 draft evidence.
   - Source-derived output is marked untrusted; draft evidence never assigns conformance terms.
   - Abort or partial registration removes every registered tool.
3. As a launch owner, I can release an isolated service set that serves the UI/API, private auth and persistence gateways, scanner egress proxy, and durable worker.
   - `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:routes`, and `pnpm test:a11y` pass.
   - Hosting is HTTPS with a restrictive CSP, frame policy, referrer policy, and cache policy appropriate to the host.

## Explicit non-goals

- Authenticated targets, stored credentials, subdomains, schedules, exports, payments, or reviewed ACRs.
- Authenticated targets, schedules, exports, payments, or reviewed ACRs.
- Accessibility conformance, VPAT/ACR certification, or legal advice.

## Required infrastructure launch gate

`SCAN_EGRESS_PROXY` must be a controlled proxy that independently blocks private, link-local, loopback, metadata, multicast, reserved, and DNS-rebinding destinations. Application URL validation and browser request interception are defense in depth, not a substitute for an isolated scanner egress boundary. Do not enable scanning until this is verified in staging.

## Release checklist

- Configure HTTPS, Supabase Auth, its migration, `SESSION_HMAC_SECRET`, `AUTH_GATEWAY_TOKEN`, `DATA_GATEWAY_TOKEN`, and a verified `SCAN_EGRESS_PROXY`.
- Verify terms acceptance, account ownership, the three-per-day database quota, 30-day retention purge, and scanner-worker recovery before opening sign-up.
- Exercise private-address, redirect, quota, owner-isolation, and proxy-blocking tests in staging.
- Manually smoke test magic-link sign-in, agent discovery/invocation, a scan of an owned site, keyboard navigation, and mobile layout.
- Keep all public copy explicit that output is automated evidence requiring human review.
