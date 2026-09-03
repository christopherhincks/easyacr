# User flows, route inventory, and screen states

## Public beta flow

1. A visitor arrives at `/`, where both primary calls to action go to `/tools`.
2. On a hosted deployment, the user requests a real Supabase magic link, then accepts the public-scan terms. Local operator testing may instead use the separately labelled invite compatibility path.
3. A compatible browser agent can register four WebMCP tools to queue a capped public HTTPS scan, read status and untrusted findings, and create WCAG 2.2 draft evidence. The browser fallback uses the same API.
4. `/scans` shows history available to the current session. `/scans/:id` shows that scan’s automated findings. Invite-mode history is not durable across service restart.
5. Results are automated evidence, never a completed ACR, certification, or conformance conclusion.

## Explicitly deferred routes

Sign-up, password recovery, billing, onboarding, dashboards, organization management, schedules, authenticated-target scanning, and ACR authoring are not public-beta workflows. Direct requests for those paths render an honest unavailable page rather than a mock screen or representative customer data.

## Route and primary-screen inventory

| Route | Screen | Audience | Primary states |
|---|---|---|---|
| `/` | Product home | Visitor | Default, light/dark, mobile |
| `/tools` | WebMCP tools and browser fallback | Session holder | Hosted sign-in, local invite compatibility, terms, registered/unavailable |
| `/scans` | Session-visible scan history | Session holder | Loading, unavailable, empty, populated |
| `/scans/:id` | Automated findings | Scan owner | Loading, unavailable, queued/running/completed findings |
| `/terms` | Terms | Visitor | Public beta terms |
| `/privacy` | Privacy | Visitor | Deployment-specific retention notice |
| `/acceptable-use` | Acceptable use | Visitor | Permission and safety rules |
| all other routes | Unavailable | Visitor | Honest deferred-route/404 experience |
