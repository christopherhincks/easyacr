/**
 * Deliberately narrow CONNECT proxy for the easyACR browser worker.
 *
 * This is an egress boundary, not a general-purpose forward proxy: it accepts
 * only authenticated HTTPS CONNECT requests, resolves names itself, rejects
 * every non-public result, and dials the validated address rather than asking
 * the OS resolver to resolve the name a second time.
 */
import { timingSafeEqual } from 'node:crypto';
import { lookup as nodeLookup } from 'node:dns/promises';
import { createServer } from 'node:http';
import { isIP, createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_IDLE_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_TUNNEL_MS = 120_000;
const DEFAULT_MAX_TUNNEL_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_CONNECTIONS = 100;
const DEFAULT_MAX_CONNECTIONS_PER_CLIENT = 10;

function ipv4Number(address) {
  const parts = address.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  if (octets.some((part) => part > 255)) return null;
  return (((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3]) >>> 0;
}

function inV4Cidr(value, base, prefix) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (base & mask);
}

function ipv6Number(address) {
  // DNS lookup only supplies numeric addresses, but this parser also handles
  // IPv4-mapped forms so callers cannot smuggle an IPv4 range through IPv6.
  if (address.includes('%')) return null;
  const halves = address.toLowerCase().split('::');
  if (halves.length > 2) return null;
  const expand = (part) => part ? part.split(':').flatMap((piece, index, list) => {
    if (piece.includes('.')) {
      if (index !== list.length - 1) return [null];
      const value = ipv4Number(piece);
      return value === null ? [null] : [(value >>> 16).toString(16), (value & 0xffff).toString(16)];
    }
    return [piece];
  }) : [];
  const left = expand(halves[0]);
  const right = halves.length === 2 ? expand(halves[1]) : [];
  if ([...left, ...right].some((part) => !part || !/^[0-9a-f]{1,4}$/.test(part))) return null;
  const missing = 8 - left.length - right.length;
  if ((halves.length === 2 && missing < 1) || (halves.length === 1 && missing !== 0)) return null;
  const groups = [...left, ...Array(Math.max(0, missing)).fill('0'), ...right];
  if (groups.length !== 8) return null;
  return groups.reduce((value, group) => (value << 16n) + BigInt(`0x${group}`), 0n);
}

function inV6Cidr(value, base, prefix) {
  const mask = prefix === 0 ? 0n : ((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix);
  return (value & mask) === (base & mask);
}

function v6(value) { return BigInt(`0x${value.replace(/:/g, '')}`); }

/** Return true only for globally-routable unicast addresses. */
export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const value = ipv4Number(address);
    // IANA special-purpose ranges: this includes private, loopback,
    // link-local, shared/CGNAT, benchmarking, documentation, multicast and
    // reserved space. A default-deny list here prevents SSRF to platform DNS.
    const blocked = [
      [0x00000000, 8], [0x0a000000, 8], [0x64400000, 10], [0x7f000000, 8],
      [0xa9fe0000, 16], [0xac100000, 12], [0xc0000000, 24], [0xc0000200, 24],
      [0xc01fc400, 24], [0xc034c100, 24], [0xc0586300, 24], [0xc0a80000, 16],
      [0xc0af3000, 24], [0xc0b00000, 24], [0xc6336400, 24], [0xc6120000, 15],
      [0xcb007100, 24], [0xe0000000, 4], [0xf0000000, 4],
    ];
    return value !== null && !blocked.some(([base, prefix]) => inV4Cidr(value, base, prefix));
  }
  if (family !== 6) return false;
  const value = ipv6Number(address);
  if (value === null) return false;
  const blocked = [
    [0n, 128], // unspecified
    [1n, 128], // loopback
    [0n, 96], // IPv4-compatible / otherwise special low IPv6 space
    [v6('00000000000000000000ffff00000000'), 96], // IPv4-mapped IPv6
    [v6('0064ff9b000000000000000000000000'), 96], // well-known NAT64
    [v6('0064ff9b000100000000000000000000'), 48], // local-use NAT64
    [v6('01000000000000000000000000000000'), 64], // discard-only
    [v6('20010000000000000000000000000000'), 23], // IETF protocol assignments, incl. documentation
    [v6('20010db8000000000000000000000000'), 32], // documentation (outside 2001::/23)
    [v6('20020000000000000000000000000000'), 16], // 6to4 (encodes an IPv4 address)
    [v6('262004f8000000000000000000000000'), 48], // AS112-v6
    [v6('3fff0000000000000000000000000000'), 20], // documentation
    [v6('fc000000000000000000000000000000'), 7], // unique local
    [v6('fe800000000000000000000000000000'), 10], // link local
    [v6('ff000000000000000000000000000000'), 8], // multicast
  ];
  return !blocked.some(([base, prefix]) => inV6Cidr(value, base, prefix));
}

export function parseConnectAuthority(authority) {
  if (typeof authority !== 'string' || authority.length > 253) return null;
  const matched = authority.match(/^(?:([a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?)|\[([0-9a-fA-F:.]+)\]):(\d{1,5})$/);
  if (!matched) return null;
  const host = (matched[1] || matched[2]).toLowerCase();
  const port = Number(matched[3]);
  // Requiring DNS names avoids all literal-address edge cases and makes the
  // all-address validation below mandatory.
  if (port !== 443 || isIP(host) || host === 'localhost' || host.endsWith('.')) return null;
  return { host, port };
}

export async function resolvePublicDestination(host, lookupFn = nodeLookup) {
  const records = await lookupFn(host, { all: true, verbatim: true });
  if (!Array.isArray(records) || records.length === 0 || records.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Destination did not resolve exclusively to public addresses.');
  }
  // Pin the outbound TCP connection to one address we just validated. Do not
  // pass the hostname to createConnection: that would create a second DNS
  // resolution window (DNS rebinding).
  const record = records[0];
  return { address: record.address, family: record.family };
}

function exactToken(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validProxyAuthorization(header, token) {
  if (typeof header !== 'string' || !header.startsWith('Basic ')) return false;
  let decoded;
  try { decoded = Buffer.from(header.slice(6), 'base64').toString('utf8'); } catch { return false; }
  const delimiter = decoded.indexOf(':');
  if (delimiter < 1) return false;
  return decoded.slice(0, delimiter) === 'easyacr' && exactToken(decoded.slice(delimiter + 1), token);
}

function sendSocketResponse(socket, status, message, headers = {}) {
  const lines = [`HTTP/1.1 ${status} ${message}`, 'Connection: close', ...Object.entries(headers).map(([key, value]) => `${key}: ${value}`), '', ''];
  socket.end(lines.join('\r\n'));
}

function safeLog(event, fields = {}) {
  // Do not log CONNECT headers, credentials, paths, or response payloads.
  console.info(`[scanner-proxy] ${event} ${JSON.stringify(fields)}`);
}

/** Track both directions of a tunnel; return false once its byte cap is hit. */
export function createTunnelBudget(maximumBytes, close) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) throw new Error('Tunnel byte limit must be a positive integer.');
  let usedBytes = 0; let closed = false;
  return {
    add(bytes) {
      if (closed) return false;
      usedBytes += bytes;
      if (usedBytes > maximumBytes) { closed = true; close(); return false; }
      return true;
    },
    get usedBytes() { return usedBytes; },
  };
}

export function createProxyServer({
  proxyToken = process.env.PROXY_AUTH_TOKEN,
  maxConnections = Number(process.env.MAX_CONNECTIONS || DEFAULT_MAX_CONNECTIONS),
  maxConnectionsPerClient = Number(process.env.MAX_CONNECTIONS_PER_CLIENT || DEFAULT_MAX_CONNECTIONS_PER_CLIENT),
  connectTimeoutMs = Number(process.env.CONNECT_TIMEOUT_MS || DEFAULT_CONNECT_TIMEOUT_MS),
  idleTimeoutMs = Number(process.env.IDLE_TIMEOUT_MS || DEFAULT_IDLE_TIMEOUT_MS),
  maxTunnelMs = Number(process.env.MAX_TUNNEL_MS || DEFAULT_MAX_TUNNEL_MS),
  maxTunnelBytes = Number(process.env.MAX_TUNNEL_BYTES || DEFAULT_MAX_TUNNEL_BYTES),
  lookupFn = nodeLookup,
  connectFn = createConnection,
} = {}) {
  if (typeof proxyToken !== 'string' || proxyToken.length < 24) throw new Error('PROXY_AUTH_TOKEN must be a random secret of at least 24 characters.');
  if (![maxConnections, maxConnectionsPerClient, connectTimeoutMs, idleTimeoutMs, maxTunnelMs, maxTunnelBytes].every((value) => Number.isSafeInteger(value) && value > 0)) throw new Error('Proxy limits must be positive integers.');

  let activeConnections = 0;
  const activeByClient = new Map();
  const server = createServer((request, response) => {
    if ((request.method === 'GET' || request.method === 'HEAD') && request.url === '/healthz') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok', activeConnections }));
      return;
    }
    response.writeHead(405, { Allow: 'GET, HEAD, CONNECT', 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('CONNECT proxy only\n');
  });
  // Bound sockets which have not yet authenticated or reached CONNECT, too.
  // The application-level limits below are stricter for established tunnels.
  server.maxConnections = maxConnections;
  server.headersTimeout = connectTimeoutMs;
  server.requestTimeout = connectTimeoutMs;
  server.keepAliveTimeout = 5_000;

  server.on('connect', (request, clientSocket, head) => {
    void (async () => {
      const client = clientSocket.remoteAddress || 'unknown';
      if (!validProxyAuthorization(request.headers['proxy-authorization'], proxyToken)) {
        sendSocketResponse(clientSocket, 407, 'Proxy Authentication Required', { 'Proxy-Authenticate': 'Basic realm="easyacr-scanner"' });
        safeLog('connect_rejected', { reason: 'authentication' });
        return;
      }
      const target = parseConnectAuthority(request.url);
      if (!target) {
        sendSocketResponse(clientSocket, 400, 'Bad Request');
        safeLog('connect_rejected', { reason: 'destination' });
        return;
      }
      if (activeConnections >= maxConnections || (activeByClient.get(client) || 0) >= maxConnectionsPerClient) {
        sendSocketResponse(clientSocket, 503, 'Service Unavailable');
        safeLog('connect_rejected', { reason: 'capacity' });
        return;
      }

      // Reserve capacity before DNS. Otherwise an authenticated client could
      // create unlimited pending lookups without ever reaching the TCP cap.
      activeConnections += 1;
      activeByClient.set(client, (activeByClient.get(client) || 0) + 1);
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        activeConnections -= 1;
        const remaining = (activeByClient.get(client) || 1) - 1;
        if (remaining > 0) activeByClient.set(client, remaining); else activeByClient.delete(client);
      };
      clientSocket.once('close', release);
      clientSocket.pause();
      let destination;
      try { destination = await resolvePublicDestination(target.host, lookupFn); } catch {
        release();
        sendSocketResponse(clientSocket, 403, 'Forbidden');
        safeLog('connect_rejected', { reason: 'dns_policy' });
        return;
      }
      if (clientSocket.destroyed) { release(); return; }

      let upstream;
      let tunnelTimer;
      const connectTimer = setTimeout(() => {
        safeLog('connect_failed', { reason: 'timeout' });
        clientSocket.destroy();
        upstream?.destroy();
      }, connectTimeoutMs);
      try {
        upstream = connectFn({ host: destination.address, port: target.port, family: destination.family });
        upstream.once('connect', () => {
          clearTimeout(connectTimer);
          if (clientSocket.destroyed) { upstream.destroy(); return; }
          const closeTunnel = (reason) => {
            safeLog('connect_closed', { reason });
            clientSocket.destroy();
            upstream.destroy();
          };
          const budget = createTunnelBudget(maxTunnelBytes, () => closeTunnel('byte_limit'));
          // `head` has already been read by the HTTP parser and will not emit a
          // socket data event, so account for it before forwarding.
          if (head.length && !budget.add(head.length)) return;
          clientSocket.on('data', (chunk) => { budget.add(chunk.length); });
          upstream.on('data', (chunk) => { budget.add(chunk.length); });
          tunnelTimer = setTimeout(() => closeTunnel('duration_limit'), maxTunnelMs);
          clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (head.length) upstream.write(head);
          clientSocket.setTimeout(idleTimeoutMs, () => clientSocket.destroy());
          upstream.setTimeout(idleTimeoutMs, () => upstream.destroy());
          clientSocket.pipe(upstream);
          upstream.pipe(clientSocket);
          clientSocket.resume();
          safeLog('connect_opened', { activeConnections });
        });
        upstream.once('error', () => {
          clearTimeout(connectTimer);
          if (!clientSocket.destroyed) clientSocket.destroy();
          safeLog('connect_failed', { reason: 'upstream' });
        });
        upstream.once('close', () => { clearTimeout(tunnelTimer); release(); });
        clientSocket.once('close', () => { clearTimeout(connectTimer); clearTimeout(tunnelTimer); upstream?.destroy(); release(); });
        clientSocket.once('error', () => upstream?.destroy());
      } catch {
        clearTimeout(connectTimer);
        release();
        clientSocket.destroy();
        safeLog('connect_failed', { reason: 'setup' });
      }
    })();
  });
  server.on('clientError', (_error, socket) => sendSocketResponse(socket, 400, 'Bad Request'));
  return server;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const port = Number(process.env.PORT || 3128);
  const host = process.env.HOST || '127.0.0.1';
  const proxy = createProxyServer();
  proxy.listen(port, host, () => safeLog('listening', { host, port }));
}
