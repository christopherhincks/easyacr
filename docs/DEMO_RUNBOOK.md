# 90-second WebMCP demo runbook

Use an email inbox you control and an operator-owned public HTTPS fixture. A
first-time verified email creates a personal workspace. Never demonstrate
against a target without authorization.

| Time | Screen/action | Point to make |
| --- | --- | --- |
| 0:00–0:12 | Open `/tools`, sign in with a magic link, accept terms. | The beta gates scanning behind identity, terms, and a narrow use policy. |
| 0:12–0:25 | Show the registered four-tool status in a WebMCP-capable client. | WebMCP exposes a real, focused agent workflow rather than static instructions. |
| 0:25–0:40 | Call `start_accessibility_scan` with `authorizationConfirmed: true`. | The agent can request only a bounded, public HTTPS, same-origin scan. |
| 0:40–0:55 | Open the scan detail or call `get-scan-status`. | The lifecycle is observable while work is queued/running. |
| 0:55–1:12 | Call `list_accessibility_issues`; show severity filtering/pagination. | Findings have rule, page, selector, guidance, and explicit untrusted-content labeling. |
| 1:12–1:25 | Call `create_draft_acr` or use the evidence button. | The output is an immutable WCAG 2.2 evidence attachment, not a completed ACR. |
| 1:25–1:30 | Show the human-review warning and acceptable-use boundaries. | Automated accessibility checks are evidence, never certification or legal advice. |

Before recording: verify public DNS and TLS, a working magic link, scan quota
availability, and the exact supported WebMCP client. If any check fails, do
not claim a live end-to-end demonstration.
