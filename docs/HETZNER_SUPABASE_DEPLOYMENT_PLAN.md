# easyACR — Hetzner + Supabase deployment plan

## Recommended launch architecture

```text
Browser agent
  -> https://app.easyacr.com
  -> Caddy on Hetzner (TLS and public ingress)
  -> easyACR API + WebMCP page
  -> private data gateway + Playwright worker
  -> authenticated scanner egress proxy
  -> public websites

easyACR API
  -> private auth gateway
  -> Supabase Auth

Supabase
  -> Auth (magic-link and social sign-in)
  -> Postgres (users, workspaces, scan jobs, results, quotas)
```

The Hetzner server is the only public application origin. The auth gateway is
a private sidecar with the only general egress route needed for Supabase token
validation; Chromium remains unable to use it. Do not put the scanner behind
Vercel or expose either internal proxy port. Vercel is optional later for a
separate marketing site; it is not part of the scanning path.

## Lowest-cost viable starting point

- One x86 Hetzner Cloud VM with 4 vCPU, 8 GB RAM, and NVMe storage. Run one
  scan at a time initially.
- Cloudflare DNS and a domain, with `app.easyacr.com` pointed at the VM.
- Supabase Free while integration is being built; move to Supabase Pro before
  relying on it for public users, backups, and uninterrupted service.

Avoid a 2 GB VM: Chromium, the app, Caddy, and the egress proxy need memory
headroom. Choose a US location when scan geography matters; EU is usually the
lowest-cost option but can change the site experience seen by the scanner.

## What to provision now

1. Create an Ubuntu 24.04 x86 VM and add an SSH key.
2. Configure the cloud firewall to allow only TCP 22, 80, and 443. Restrict
   port 22 to the operator's IP range when possible.
3. Create DNS records:
   - `app.easyacr.com` A -> VM public IPv4
   - optional `www.easyacr.com` -> marketing site later
4. Install Docker Engine and Docker Compose.
5. Create a Supabase project in the region closest to the intended users.
   Enable magic-link and Google sign-in, then configure a production SMTP
   provider before public traffic.
6. Add `https://app.easyacr.com` to Supabase Auth redirect URLs.
7. Generate the deployment secrets and save them only in a mode-600
   `.env.production` file on the VM:

   ```dotenv
   EASYACR_PUBLIC_HOST=app.easyacr.com
   ACME_EMAIL=ops@easyacr.com
   SESSION_HMAC_SECRET=<generated secret>
   PROXY_AUTH_TOKEN=<different generated secret>
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_HOST=<project-ref>.supabase.co
   SUPABASE_PUBLISHABLE_KEY=<publishable key>
   SUPABASE_SERVICE_ROLE_KEY=<server-only secret>
   AUTH_GATEWAY_TOKEN=<generated secret>
   DATA_GATEWAY_TOKEN=<generated secret>
   ```

   Do not place the Supabase service-role key in Vite/browser variables.

8. After the application branch is delivered, clone the repository onto the
   VM and run:

   ```sh
   docker compose --env-file .env.production -f compose.yaml config
   docker compose --env-file .env.production -f compose.yaml up --build --detach
   ```

## Application launch gate

- Apply the complete ordered `supabase/migrations/` chain with `supabase db push` before public sign-up.
- Run `docs/PRODUCTION_SMOKE_TEST.md`, including the magic-link, terms, quota,
  fallback-browser, worker-health, and WebMCP-client checks.
- Keep WebMCP registration scoped to the authenticated browser session. The
  normal browser scan form is the supported fallback for browsers without the
  experimental WebMCP interface.
