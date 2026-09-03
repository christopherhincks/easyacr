# Simulated judge-panel decision log

This is a product-review record, not feedback from named competition judges.
Each round is scored by the same three simulated lenses: agency owner,
in-house accessibility lead, and WebMCP challenge evaluator.

## Round 1 — 2026-09-02: baseline review

| Feedback | Decision | Disposition |
| --- | --- | --- |
| Scan progress was not observable without a reload. | Poll a single scan while queued/running, expose manual refresh and timestamp. | Implemented in this pass. |
| Browser users could not create draft evidence. | Surface the existing CSRF-protected evidence action after terminal scans. | Implemented in this pass. |
| Findings lacked actionable context and complete traversal. | Add rule, failure summary, guidance, total, filter, and cursor loading. | Implemented in this pass. |
| Target consent was too generic. | Require an explicit per-target authorization attestation in browser and tool contracts. | Implemented in this pass. |
| Browser CSP differed from intended production behavior. | Give direct serving the same restricted Supabase `connect-src` allowance and inject the hostname through Compose. | Implemented; staging validation required. |
| Mobile navigation and support path were weak. | Close navigation after route selection and add the support mail link. | Implemented in this pass. |
| Judges need a repeatable evaluation path and dated scope. | Add quickstart, demo runbook, and build note. | Implemented in this pass. |
| Public DNS/TLS, video, license, and persistent public fork were missing. | Treat as external owner gates; do not simulate them in code. | Pending owner action. |

## Round 2 — post-implementation re-score

The same simulated lenses re-reviewed the implementation before the private
stage promotion. Agency and compliance lenses each scored the source **4/5**;
the challenge evaluator scored it **32.5/40**. They agreed that the primary
workflow and tool contracts are source-complete, while public DNS/TLS,
magic-link/WebMCP live smoke testing, video, public repository, and
owner-authorized license remain release gates.

| Round 2 feedback | Decision | Disposition |
| --- | --- | --- |
| SPA fallback emitted a stricter CSP than the direct app path. | Reuse the restricted Supabase `connect-src` policy in the fallback response. | Implemented; staged header check required. |
| The stated three-per-day quota and generic hourly flood protection could be confused. | Keep the durable three-successful-scans-per-day product quota; document the separate short-term abuse control rather than expose a bypassable rate limit. | Clarified in judge material. |
| Polling can race with load-more/filter interactions. | Treat as a live interaction test item; do not invent local optimistic merging without evidence. | Pending staged/browser smoke test. |

## Round 3 — post-remediation re-score

The same lenses re-scored the CSP remediation after a full local validation
run. Compliance scored the source **4.5/5** and release readiness **3.5/5**;
the agency lens retained **4/5** pending real-world staging; the challenge
evaluator raised the source-complete score to **34/40**.

| Round 3 feedback | Decision | Disposition |
| --- | --- | --- |
| Verify browser CSP on both normal and SPA fallback responses. | Added fallback parity and a server regression test; full suite passed locally. | Source complete; staged header check remains. |
| Polling may race with filter/load-more. | Retain this as a specifically scripted live interaction check rather than hide it with unverified client-side merging. | Pending live smoke test. |
| Evaluators still need proof, not repository claims. | Keep all public deployment, authentication, WebMCP-client, worker, evidence, license, repository, and video requirements as explicit release gates. | Pending owner/staging action. |
