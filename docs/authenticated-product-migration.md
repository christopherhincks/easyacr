# Authenticated product migration

## Decision

The former `www` prototype is design reference, not production behavior. Its
navigation and information architecture are retained only where an equivalent
surface can be backed by real EasyACR data. Fictional organizations, demo
roles, placeholder pricing, simulated billing, and mock ACR results must not
ship in the authenticated product.

## Real beta journey

1. A visitor follows a public link to `app.easyacr.com`.
2. A passwordless user creates or resumes a workspace with a magic link.
3. The user accepts the public-scan terms.
4. A short, persisted onboarding flow will collect display and workspace names.
5. The authenticated dashboard shows only durable scan information and a clear
   first-scan action.
6. The user authorizes a public target, queues a scan, reviews findings, and
   may create an immutable automated-evidence artifact for qualified human
   review.

## Migration matrix

| Legacy surface | Product decision | Delivery |
| --- | --- | --- |
| Dashboard | Rebuild from the real scan API, including useful empty states. | This migration |
| Scans and results | Retain real list/detail; add product navigation and client-side discovery controls. | This migration |
| Onboarding and account profile | Persist a display name, workspace name, and onboarding completion state. | Next phase; requires a schema migration and profile API |
| Draft ACR concept | Keep the real automated-evidence action and its human-review limitation. Do not present it as an ACR editor. | This migration |
| Schedules | Do not expose until a durable scheduler, ownership rules, and retry model exist. | Deferred |
| Billing | Do not expose until pricing, subscriptions, and payment processing exist. | Deferred |
| Organization administration | Do not expose until membership management and audit APIs exist. | Deferred |
| ACR authoring/export | Do not expose until versioned templates, reviewer identity, approval, and export workflows exist. | Deferred |

## Acceptance criteria

- A signed-in user sees an application shell, not the public marketing shell.
- No signed-in view contains Northstar, demo roles, fabricated metrics, or
  placeholder subscription claims.
- The dashboard and scan history render only records returned by the API.
- The scan-detail evidence action continues to state that it is automated,
  immutable evidence and not an ACR or conformance determination.
