# Scanner service (MVP)

Run the built UI and API with Node 20+:

```sh
pnpm build
SESSION_HMAC_SECRET='a-long-random-secret' SUPABASE_AUTH_GATEWAY='http://auth-gateway:4180' AUTH_GATEWAY_TOKEN='a-third-long-random-token' DATA_GATEWAY_URL='http://data-gateway:4181' DATA_GATEWAY_TOKEN='a-fourth-long-random-token' node server/index.mjs
```

In production, `scanner-worker` owns Chromium and `SCAN_EGRESS_PROXY`; the app has no scanner egress. The worker and proxy independently reject non-HTTPS targets, IP literals, non-public DNS answers, cross-origin resources, redirects, and crawl expansion beyond ten pages.

The browser signs in through Supabase, then exchanges its Supabase access token at `POST /api/v1/session`. The app validates it through the private auth gateway before issuing an HttpOnly session cookie. A user must accept the current public-scan terms before WebMCP tools can register or a scan can queue. Include the returned `csrfToken` as `X-CSRF-Token` for state-changing API calls. Durable jobs, structured findings, acceptance, and audit events live in Supabase; completed scan data is purged after 30 days.

Endpoints: `GET/POST /api/v1/session`, `POST /api/v1/scans`, `GET /api/v1/scans/:id`, `GET /api/v1/scans/:id/findings`, and `GET/POST /api/v1/scans/:id/draft-evidence`.

`GET .../findings` accepts a stable numeric `cursor`, `limit` (1–100), and optional `severity` (`critical`, `serious`, `moderate`, or `minor`). Filtering happens before pagination and the response includes `total` and `nextCursor`.

`POST .../draft-evidence` creates (idempotently) a durable `automated_draft` evidence artifact for the requesting user's completed or partial scan. The database snapshots the target, page/finding counts, impact totals, template, and human-review warning. It never creates an ACR, VPAT result, or conformance claim; `GET` returns that stored artifact and is `404` until it has been created.

The legacy invite path is disabled unless `EASYACR_ALLOW_LOCAL_INVITE_DEMO=true`; it additionally requires `X-EasyACR-Terms-Version: 2026-09-02`. Public deployment uses Supabase authentication and the durable per-user terms acceptance record instead.

Findings are automated draft evidence only. Site-derived HTML, CSS selectors, and error strings are flagged as untrusted content and must not be treated as agent instructions. No response is an ACR or conformance determination.
