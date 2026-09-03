# WebMCP Challenge submission packet

This file contains the current, truthful submission copy and judge path for
easyACR. Replace the bracketed video link on Devpost; do not add credentials
or secrets to this repository.

## Live project

- **Live URL:** `https://app.easyacr.com/tools`
- **Demo video:** `[public YouTube URL supplied on Devpost]`
- **Code repository:** `[public repository URL supplied on Devpost]`

Use `app.easyacr.com`, not the legacy `www.easyacr.com` demonstration surface.

## Ready-to-paste project description

### What we built

easyACR is a WebMCP-powered accessibility-evidence beta. A person authorizes a
bounded scan of a public website; their browser agent can start the scan, poll
its status, inspect automated findings, and create a WCAG 2.2 draft-evidence
attachment through focused WebMCP tools. The same authorized workflow also
works through a browser form when WebMCP is unavailable.

### Why WebMCP is a strong fit

Accessibility review requires both human judgment and repetitive, structured
evidence collection. WebMCP lets an agent operate a narrowly scoped,
user-authorized workflow in the browser instead of asking a person to copy
URLs, scan IDs, and findings between separate tools. The agent receives only
four purpose-built actions: start a bounded scan, read status, list findings,
and create draft evidence.

### Better experience for people and agents

The person remains in control of the target, account, terms acceptance, and
scan authorization. The agent handles the mechanical sequence and presents
structured results. Browser fallback parity means the product remains useful
without experimental browser support, while a WebMCP-capable client turns the
same safe workflow into a conversational review loop.

### What people and agents can now do together

Together they can move from an authorized public URL to a bounded scan,
observable job lifecycle, paginated issue evidence, and a draft WCAG 2.2
evidence attachment without manually coordinating identifiers across tools.
easyACR does not claim certification, legal advice, or a completed ACR;
automated findings require qualified human review.

### How WebMCP is implemented

On an authenticated, terms-accepted `/tools` page, easyACR feature-detects
`document.modelContext.registerTool()` and atomically registers four
same-origin tools: `start_accessibility_scan`, `get-scan-status`,
`list_accessibility_issues`, and `create_draft_acr`. Each invocation reaches
the same server-authorized API used by the browser fallback. The server
rechecks session, CSRF, terms, quota, authorization confirmation, target
safety, and ownership before it queues or reads durable work.

## Judge test instructions

1. Open `https://app.easyacr.com/tools` in ChatGPT's in-app browser, or Chrome
   149+ with the WebMCP testing flag enabled.
2. Select **Create or sign in**, enter an email inbox you control, and follow
   the passwordless magic link. A first-time verified email creates a personal
   workspace.
3. Accept the scan terms and confirm the page reports four registered tools.
4. Ask the agent to run `start_accessibility_scan` for a public HTTPS site you
   are authorized to test, with `authorizationConfirmed: true`.
5. Poll `get-scan-status`, inspect `list_accessibility_issues`, then invoke
   `create_draft_acr` with `template: "WCAG_2_2"`.
6. If WebMCP is unavailable in the browser, use the visible browser fallback;
   it exercises the same authenticated API and safety limits.

The public beta accepts public HTTPS targets only, performs same-origin crawls
of at most ten pages, refuses credentials/authenticated targets, and applies a
per-user daily scan quota. It is free for judges to evaluate.

## Publication checklist — owner action required

- [ ] Confirm the submitting individual/team/organization owns the challenge
      extension or has written authorization from every copyright owner.
- [ ] Run a redacted secret-history scan before publication and rotate any
      credential that could have appeared in history.
- [ ] Add an owner-authorized OSI-approved `LICENSE` file.
- [ ] Make the repository public and verify GitHub visibly detects the license.
- [ ] Replace the Devpost placeholders with the public repository and YouTube
      URLs, then save and submit before the deadline.

## Evidence of new challenge work

The WebMCP public-beta extension is documented in
[`docs/HACKATHON_BUILD_NOTES.md`](docs/HACKATHON_BUILD_NOTES.md). The dated
commit history contains the implementation and deployment-hardening work made
on September 2–3, 2026.
