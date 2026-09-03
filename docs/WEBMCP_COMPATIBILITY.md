# WebMCP compatibility and fallback

easyACR uses the browser's experimental `document.modelContext.registerTool` surface. It is an enhancement, not the only way to use the scan service.

| Client condition | Expected behavior | User path |
| --- | --- | --- |
| Browser exposes WebMCP and the user accepted scan terms | Four tools register atomically for the current document/session | Agent can invoke scan, status, findings, and draft-evidence tools |
| Browser lacks WebMCP | No tools register | `/tools` exposes the ordinary browser scan form using the same authorized API |
| Tool registration fails part way | Registration aborts; no partial tool set remains | Reload after correcting the client problem; ordinary browser scan remains available |
| Session expires, is revoked, or terms are not accepted | Invocation is rejected by the server | Sign in again or accept the current terms; then reload `/tools` |

Launch validation must test at least one intended WebMCP-capable browser/agent build and one ordinary browser. The implementation must not claim universal support while the API remains experimental.
