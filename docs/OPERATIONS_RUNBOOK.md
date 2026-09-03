# EasyACR operations runbook

This runbook is for the public beta. It does not replace incident response,
privacy, or legal review for a commercial service.

## Release verification

After each deploy, from a separate network run:

```sh
pnpm check:production
```

Then complete the controlled human steps in
[PRODUCTION_SMOKE_TEST.md](./PRODUCTION_SMOKE_TEST.md). Record the date,
operator, controlled target, browser/client build, scan id, and result in the
release record. Do not use a customer site for this verification.

## Monitoring

The scheduled `Public health` GitHub workflow checks the canonical marketing
host, the `www` redirect, and the app health endpoint without credentials.
Configure GitHub notifications for failed workflow runs. This is a liveness
signal, not a substitute for application error monitoring.

On a suspected scan or service incident:

1. Preserve access-controlled service logs.
2. Stop new scan intake if the issue involves egress, repeated denied proxy
   attempts, worker crashes, or unexpected scan behavior.
3. Record impact, time window, affected scan ids, and mitigation.
4. Restore intake only after a controlled scan succeeds and the root cause is
   understood.

## Backups and restoration

Supabase owns durable scan data, findings, user profiles, and evidence. Enable
and test Supabase backups through its project controls. Caddy owns local TLS
account/certificate state in the `caddy_data` Docker volume.

On the Hetzner host, archive Caddy state to a specific encrypted backup staging
directory, then copy it off-host:

```sh
cd /opt/easyacr
./deploy/backup-caddy-data.sh /srv/easyacr-backup-staging
```

To test restoration on a non-production host:

1. Stop Caddy.
2. Restore a selected archive into an empty volume with the same ownership and
   verify its SHA-256 file.
3. Start Caddy and verify the expected certificates and public health checks.
4. Do not overwrite production Caddy state during the first drill.

## Account support and deletion

- A user who still controls their sign-in email uses the passwordless sign-in
  flow to recover access to historic reports.
- A user changing email uses **Account → Change sign-in email** and completes
  the provider verification. Workspace history remains attached to the same
  user/workspace.
- A user who cannot access their prior email contacts `support@easyacr.com`.
  Confirm account ownership through a documented support procedure before
  discussing or changing account data.
- For a deletion request, verify requester identity, identify the workspace,
  record the request, delete through approved Supabase procedures, and confirm
  completion. Do not promise a retention period beyond the deployed policy.

## External gates

The following cannot be completed by source code alone. Keep evidence of each
in the release record:

- Enable and test a real Turnstile CAPTCHA provider in Supabase Auth.
- Verify that `support@easyacr.com` receives inbound mail and has an owner.
- Complete a Supabase and Caddy backup/restore drill.
- Obtain review/approval of the terms, privacy notice, retention statement,
  and acceptable use policy.
- Test WebMCP in every browser/client build marketed as supported.
