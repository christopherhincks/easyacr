# easyACR scanner egress proxy

This is a deliberately narrow CONNECT proxy for the isolated Playwright scan
worker. It is the network-security boundary that prevents a submitted website
URL from being used to reach internal services.

It accepts only authenticated `CONNECT hostname:443` requests. For each tunnel
it resolves all DNS answers, rejects the request unless **every** address is a
globally routable unicast address, then opens TCP to a selected validated
numeric address. It never asks the system resolver to resolve the hostname
again, which closes the DNS-rebinding window. It rejects private, loopback,
link-local, metadata, shared/CGNAT, benchmarking, documentation, multicast,
reserved, IPv4-mapped, ULA, and special IPv6 ranges.

## Run

```sh
PROXY_AUTH_TOKEN='<configure-a-local-secret>' node scanner-proxy/index.mjs
```

The proxy listens on `127.0.0.1:3128` by default. Set `HOST` and `PORT` only
when the isolated scanner worker needs a private network route to it. Do not
publish this port to the internet. The service refuses to start without a
random `PROXY_AUTH_TOKEN` at least 24 characters long.

Configure Playwright with `http://easyacr:<PROXY_AUTH_TOKEN>@proxy-host:3128`.
The current scanner service must pass those credentials as Playwright's proxy
`username` and `password`; a URL alone is not sufficient for every Playwright
version.

Operational defaults: 100 active tunnels total, 10 per client IP, 10-second
TCP-connect timeout, 60-second idle timeout, 120-second maximum tunnel life,
and 16 MiB total bytes in both directions per tunnel. Override with
`MAX_CONNECTIONS`, `MAX_CONNECTIONS_PER_CLIENT`, `CONNECT_TIMEOUT_MS`,
`IDLE_TIMEOUT_MS`, `MAX_TUNNEL_MS`, and `MAX_TUNNEL_BYTES` only after capacity
review. A byte/duration limit destroys both sides of the tunnel; it does not
attempt to preserve a partial HTTP response.

`GET /healthz` is unauthenticated and returns only liveness plus active tunnel
count. CONNECT logs contain an event and reason only—never credentials, full
URLs, request headers, or page content.

## Verify

```sh
node --test scanner-proxy/index.test.mjs
```

This proxy is a necessary boundary, not the complete scanner threat model.
Keep the scan worker in its own unprivileged runtime with no cloud metadata or
production credentials, and enforce scan quotas in the application.
