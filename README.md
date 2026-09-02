# easyACR visual prototype

easyACR is a responsive, role-aware SaaS interface prototype for website accessibility scans, evidence review, scheduled scans, draft Accessibility Conformance Reports (ACRs), and experimental WebMCP access.

The prototype is intentionally explicit that automated testing cannot certify accessibility conformance. Generated reports are always called **draft ACRs**, incomplete evidence is **Needs review**, and a human-review step gates reviewed export.

## Run locally

Prerequisites: Node.js 20+ and pnpm 11+.

```sh
pnpm install
pnpm dev
```

Open `http://127.0.0.1:4173`. Use the “Demo role” selector in the application sidebar to inspect visitor, non-subscriber, trial, paid-member, and organization-administrator states. All external services are replaceable mock adapters; no paid account or cloud credential is required.

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

## Project map

- `src/App.tsx` — route-aware interface and complete prototype flows.
- `src/domain.ts` — centralized entitlements, draft pricing, representative data, and adapter boundaries.
- `src/styles.css` — Brand → Alias → Mapped → Responsive design-token implementation.
- `docs/` — product, flows, routes, roles, architecture, integrations, security, privacy, and validation notes.
- `design/screens/` — individual editable SVG compositions and screen index.
- `design/screens-archive/` — preserved first export set from before the supplied theme-aware logo update.
- `scripts/generate-svgs.mjs` — deterministic SVG artifact generator using the supplied logo and tokens.

## Important prototype boundaries

- Authentication, billing, scanning, scheduling, ACR generation, deadlines, and WebMCP are mock adapters.
- Credentials are never stored in fixtures or local persistence. Protected-scan fields are transient and are cleared at submission in the intended server flow.
- Production URL submission must be revalidated server-side before and after DNS resolution and redirects.
- Pricing and plan limits are draft assumptions, centralized in `src/domain.ts`.
- This prototype is not legal advice, a compliance claim, or an accessibility certification.
