# WebMCP beta build note — 2026-09-02

This dated note identifies the public-beta WebMCP extension prepared for the
challenge. It is intentionally specific about observable behavior rather than
claiming that automated testing produces conformance.

## WebMCP beta work

- Added a four-tool, same-origin WebMCP adapter for starting bounded scans,
  checking status, reading paginated automated findings, and creating a WCAG
  2.2 draft-evidence attachment.
- Added Supabase-backed magic-link identity, terms acceptance, per-user
  quotas, durable jobs/findings/evidence records, and an authorization audit
  for scan targets.
- Added browser fallback parity, visible scan lifecycle polling, evidence
  creation, severity filtering, incremental findings loading, and safer
  target-derived-content warnings.
- Added the containerized app, gateway/egress/worker topology, deployment
  notes, and production smoke-test instructions.

## Verification and publication evidence

Before submission, the project owner must publish these changes as dated
commits in a persistent public fork/repository, retain this note, and link the
commit(s) from the submission. The owner must also choose and publish an
open-source license they are authorized to grant; this repository does not
invent a license for upstream code.

The required live deployment and short public demo video are operational
release tasks, not claims made by this note.
