# Deploying the public-scan beta

This Compose deployment is deliberately a narrow, single-host beta topology:

```text
Internet -> Caddy (ports 80/443) -> app
app -> private auth gateway -> Supabase Auth
app -> private data gateway -> Supabase Postgres
scanner worker -> scanner-egress -> Internet
```

The app has no scanner or general internet egress. Chromium runs only in the
separate `scanner-worker`, which can reach public websites only through
`scanner-egress`. Do not attach `app` to `edge` or `scanner_egress`, publish
port `3128`, or point `SCAN_EGRESS_PROXY` at any other proxy.

Caddy removes any client-supplied `X-Forwarded-*` headers and writes the
connected client IP itself. The app must be configured to trust forwarding
headers only from Caddy on `app_front`; never make the app port public or place
another unreviewed proxy between Caddy and the app.

`scanner-egress` accepts only an authenticated HTTPS CONNECT tunnel from the
internal Compose subnet. For every tunnel it resolves the hostname itself,
rejects the request unless every answer is globally routable, and connects to a
validated numeric address rather than resolving the hostname again. That blocks
private, loopback, link-local/metadata, multicast, documentation, reserved,
and IPv4-mapped destination ranges as well as DNS rebinding. Keep application
URL validation too: it is defence in depth, whereas this proxy is the network
boundary.

## Before first deploy

1. Use a dedicated host or VM with current Docker Engine and Compose. Open only
   inbound TCP 80 and 443 in the host/firewall; do **not** expose the Docker API
   or scanner proxy.
2. Point a public DNS hostname at that host. Caddy obtains and renews TLS
   automatically, so the hostname must be reachable on port 80 and 443.
3. Create a local, mode-`600` environment file outside version control. Generate
   distinct secrets with a cryptographically secure generator; never reuse a
   gateway token as a signing secret or place either value in shell history.

   ```dotenv
   EASYACR_PUBLIC_HOST=easyacr.example.com
   ACME_EMAIL=ops@example.com
   SESSION_HMAC_SECRET=replace-with-a-long-random-secret
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_HOST=your-project.supabase.co
   SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   SUPABASE_SERVICE_ROLE_KEY=server-only-service-role-key
   AUTH_GATEWAY_TOKEN=<configure-auth-token>
   DATA_GATEWAY_TOKEN=<configure-data-token>
   PROXY_AUTH_TOKEN=<configure-proxy-token>
   ```

   Generate the four secrets with `openssl rand -hex 48`; this form is safe in
   the proxy URL that Compose passes to the app. `PROXY_AUTH_TOKEN` must be at
   least 24 characters and is shared only by the app and scanner egress proxy.
   The current app reads secrets from environment variables. Do not commit this
   file, bake it into an image, or paste it into tickets/logs. A secret-manager
   Supabase owns user identity and Postgres data. Its service-role key is held
   only by `data-gateway`, never by the browser, app, auth gateway, or worker.
4. Confirm that no later Compose override attaches `app` to `edge` or
   `scanner_egress`, or attaches Caddy to `scanner_control`. Those network
   separations are part of the scanner's egress boundary.

Supabase stores durable identity, workspaces, scan jobs, findings, draft
evidence, acceptance, and audit events. Before public sign-up, apply the entire
ordered migration chain with `supabase db push`; do not apply only the initial
migration. The worker processes one job at a time; a restart can interrupt only
an active browser run, which is recorded as a failed or retryable operational
event rather than silently disappearing.

## Launch

From the repository root, after saving the environment file as a protected path
(shown here as `./.env.production`, which must stay untracked):

```sh
docker compose --env-file .env.production -f compose.yaml config
docker compose --env-file .env.production -f compose.yaml up --build --detach
docker compose --env-file .env.production -f compose.yaml ps
```

The first command is a required fail-closed configuration check: Compose exits
before starting if a hostname, ACME contact, session secret, Supabase project
configuration, auth-gateway token, or proxy token is missing. The application
health endpoint returns `503` unless all scanner requirements are configured,
including the in-network proxy.

Verify from a separate network:

```sh
curl --fail --show-error --silent https://easyacr.example.com/healthz
docker compose --env-file .env.production -f compose.yaml logs --tail=100 app data-gateway scanner-worker scanner-egress caddy
```

Do not use `/healthz` as a public status dashboard: it confirms beta scanning
is enabled. Restrict host access to operators and use your platform's private
health monitoring where possible.

## Operating limits and incident response

- This is authenticated public HTTPS scanning with no submitted credentials.
  Keep the existing page/time caps, require account verification, and rotate
  the auth-gateway token if it leaks. Rotate the HMAC secret as a separate
  operation, which invalidates existing browser sessions.
- `scanner-worker` is capped at 1 CPU, 768 MiB memory, 256 PIDs, and a 256 MiB
  shared-memory mount; `scanner-egress` is capped at 0.25 CPU and 128 MiB.
  Each proxy tunnel is limited to 120 seconds and 16 MiB across both
  directions. A scan has a hard 120-second deadline; on expiry the worker
  closes Chromium, which is the cancellation mechanism for navigation and Axe
  analysis. Treat repeated memory kills, tunnel caps, or scan timeouts as a
  capacity/security signal rather than raising these values ad hoc.
- Worker completion bodies are measured before delivery and limited to 240 KiB,
  below the data gateway's 256 KiB intake. If findings cannot fit, the stored
  job is marked `partial` with an error that states exactly how many findings
  and errors were retained. This beta intentionally does not provide a bulk
  artifact download for omitted raw evidence.
- Review proxy logs and container health. Unexpected private-address attempts,
  repeated denied CONNECTs, task timeouts, or Chromium crashes are an immediate
  reason to pause the beta (`docker compose ... stop app`), preserve relevant
  logs under access controls, and investigate before restarting.
- Patch base images regularly and rebuild. Pin image digests in your deployment
  system after testing them; the tags in this repository are readable defaults,
  not an update policy.
- Back up Caddy's `caddy_data` volume (TLS account/cert state) with access
  controls. Configure and test Supabase backups separately; scan jobs and
  findings are retained for 30 days then purged by the worker.

## Required work before a broader launch

Before broadening beyond the public beta, add outbound notification, support
and deletion workflows, a written incident response policy, legal review of
the public documents, a backup/restore drill, and compatibility testing against
each agent/browser build that will be marketed.
