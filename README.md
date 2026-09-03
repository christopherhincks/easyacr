# easyACR public-scan beta

easyACR is a public-scan beta for agent-assisted automated accessibility evidence. The shipped public surface is deliberately small: the landing page, WebMCP tools, session-visible scans, and legal notices.

The beta is intentionally explicit that automated testing cannot certify accessibility conformance. It produces automated findings and a WCAG 2.2 draft evidence attachment, never a completed ACR, certification, or legal conclusion.

## Run locally

Prerequisites: Node.js 20+ and pnpm 11+.

```sh
pnpm install
pnpm dev
```

Build and run the same-origin UI/API service with a controlled egress proxy and beta-session secrets. See [`server/README.md`](server/README.md). A user first enables a time-limited beta session in the browser; a compatible agent can then discover four WebMCP tools to start a capped public HTTPS scan, poll status, read untrusted findings, and create a WCAG 2.2 draft evidence attachment.

## Verification

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:routes
pnpm test:a11y
```

The Playwright checks expect the app at `http://127.0.0.1:4173`; the configuration starts the preview server automatically after a build.

## Evaluation materials

- [Judge quickstart](JUDGING.md) — supported WebMCP and browser-fallback flow.
- [90-second demo runbook](docs/DEMO_RUNBOOK.md) — a safe, reproducible recording path.
- [Dated WebMCP build note](docs/HACKATHON_BUILD_NOTES.md) — scope of the challenge extension.
- [Judge-readiness specification](docs/SDD_JUDGE_READINESS.md) — requirements, critical review, and acceptance checks.

## Project map

- `src/App.tsx` — route-aware public-beta interface.
- `src/styles.css` — Brand → Alias → Mapped → Responsive design-token implementation.
- `docs/` — product, flows, routes, roles, architecture, integrations, security, privacy, and validation notes.
- `design/screens/` — individual editable SVG compositions and screen index.
- `design/screens-archive/` — preserved first export set from before the supplied theme-aware logo update.
- `scripts/generate-svgs.mjs` — deterministic SVG artifact generator using the supplied logo and tokens.

## Important prototype boundaries

- The public beta has no sign-up, password, billing, organization, scheduling, completed-ACR, or authenticated-target workflow. Deferred routes show an unavailable page rather than representative data.
- Hosted deployments can use configured Supabase sign-in; local operator testing can use the invite compatibility path. Both accept only public HTTPS targets, require a controlled egress proxy, and cap same-origin scans at ten pages.
- Credentials are not accepted or stored.
- Production URL submission must be revalidated server-side before and after DNS resolution and redirects.
- This prototype is not legal advice, a compliance claim, or an accessibility certification.
