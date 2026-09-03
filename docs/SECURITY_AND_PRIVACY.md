# Security and privacy boundary notes

> Historical design notes are retained below because they explain the security
> model's evolution. The current shipped public-beta behavior is authoritative
> in [`../README.md`](../README.md), [`WEBMCP_COMPATIBILITY.md`](WEBMCP_COMPATIBILITY.md),
> and [`PRODUCTION_SMOKE_TEST.md`](PRODUCTION_SMOKE_TEST.md). In particular,
> easyACR now runs durable, server-authorized public scans; it is not the
> earlier deterministic-fixture prototype described in some historical notes.

## Interface controls

- Accept only visibly complete HTTP/HTTPS targets and explain the server policy.
- Use password inputs with autocomplete disabled for scan secrets; never insert secret values into URLs, analytics, mock fixtures, local/session storage, error messages, or returned objects.
- Clear transient credential state after submission. Show only an opaque saved-secret label for schedules.
- Render evidence as text/code, never raw scanned HTML. Do not use `dangerouslySetInnerHTML` for scan content.
- Show organization, permission, and entitlement state, but never treat the UI as enforcement.
- Confirm cancel, revoke, pause, remove, and other consequential actions; surface audit consequences.

## Application server controls

- Authenticate every request, enforce organization membership and least-privilege authorization, and derive organization ID from the trusted session—not request body.
- Use secure, HttpOnly, SameSite cookies, session rotation, bounded lifetime, logout invalidation, CSRF defense where cookie authentication is used, and MFA/SSO policy.
- Canonicalize and parse URLs with a standards-based parser. Allow only HTTP/HTTPS and approved ports. Reject embedded credentials, malformed hosts, unsafe Unicode, userinfo, and ambiguous numeric addresses.
- Resolve hostnames server-side and reject loopback, private, carrier-grade NAT, link-local, multicast, documentation/reserved, and cloud metadata ranges for IPv4 and IPv6. Repeat checks after every resolution and redirect; pin approved destinations to mitigate DNS rebinding.
- Apply request/body limits, per-user/org/target rate limits, idempotency, quotas, and abuse monitoring.
- Encrypt secrets with a managed key hierarchy, limit decrypt permission to the scanner job, define retention, rotate/revoke, and never echo values.
- Emit tamper-resistant audit events for auth, permissions, secrets, scans, schedules, report versions/exports, WebMCP grants, and admin changes.
- The current WebMCP registration is same-origin. `start_accessibility_scan`
  and `create_draft_acr` are write-shaped and invoke server endpoints that
  recheck session, CSRF, terms, quota, and target authorization before queueing
  durable work. Scans accept only public HTTPS targets and never accept target
  credentials.
- Set restrictive CSP, HSTS, frame policy, referrer policy, MIME protections, permissions policy, and safe cache headers.

## Scanner worker controls

- Run in an isolated account/container/network with deny-by-default egress and no control-plane credentials.
- Recheck resolved IPs and redirects in the worker, cap redirect count/body size/pages/time, and deny non-HTTP schemes and unsafe browser navigation.
- Separate customer jobs, ephemeral browser profiles, storage, cookies, caches, and logs.
- Sanitize DOM/code excerpts, strip scripts/events/URLs as needed, and treat every scanned response as hostile.
- Prevent form submission, destructive interactions, downloads, service-worker persistence, local file access, and access to internal control services.

## Deployment controls

- TLS end-to-end; managed secrets/keys; patched base images; image and dependency scanning; signed deployments; environment separation.
- Database row/tenant policies plus application checks; encrypted backups; tested restore; retention/deletion jobs.
- Central logs with redaction, alerting, incident response, vulnerability disclosure, dependency update policy, and disaster recovery.
- Data-processing inventory, regional/data-residency decisions, subprocessors, customer deletion/export, and privacy request process.

## Prototype privacy assumptions

Representative `.example` domains and mock user data are fictional. No real credential is stored. Production retention is unresolved; proposed defaults are 24 hours for one-time scanner secrets, 90 days for raw scan evidence, customer-configurable report retention, and longer security audit retention subject to documented legal/business need.
