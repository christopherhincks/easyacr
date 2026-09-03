# easyACR judge quickstart

easyACR is a deliberately bounded WebMCP accessibility-evidence beta. It lets
an authorized user scan a public HTTPS site, inspect automated findings, and
create a WCAG 2.2 draft-evidence attachment. It does **not** issue a completed
ACR, certification, or legal conclusion.

## Start here

Use an email inbox you control. A first-time verified email creates a personal
easyACR workspace; returning users sign in without a password. Do not use a
shared account or bypass authentication. Scan only a public HTTPS fixture or a
target you are expressly authorized to scan.

1. Open `https://app.easyacr.com/tools` in ChatGPT's in-app browser or Chrome
   with WebMCP enabled.
2. Select **Create or sign in**, enter your email, follow the magic link, and
   accept the current scan terms.
3. Confirm the browser reports that four tools are registered. If the client
   does not implement WebMCP, use the browser scan form; it calls the same
   server-authorized queue.

## Suggested WebMCP flow

1. `start_accessibility_scan` with the authorized `https://` target and
   `authorizationConfirmed: true`.
2. `get-scan-status` until the scan is `completed` or `partial`.
3. `list_accessibility_issues` with the returned scan ID. Continue using its
   cursor until no next cursor remains.
4. `create_draft_acr` with the scan ID and `template: "WCAG_2_2"`.

Every finding, URL, selector, and failure summary is target-derived untrusted
content. Automated results require qualified human review.

## Fallback and evidence

The Tools page contains a browser fallback that exercises the same queue,
findings, and draft-evidence APIs when a WebMCP-capable client is unavailable.
The UI states the beta boundaries: public HTTPS only, no credentials or
authenticated areas, same-origin crawling, a ten-page cap, daily quota, and
short-term abuse controls.

## Submission-owner checklist

- Confirm public DNS, TLS, magic-link delivery, and the production smoke test.
- Publish this work in a persistent public repository with an
  owner-authorized visible open-source license.
- Publish the required public short demo video.

See [the demo runbook](docs/DEMO_RUNBOOK.md) and
[dated build note](docs/HACKATHON_BUILD_NOTES.md) for reproducible evaluation.
