/**
 * Private Supabase token verifier.
 *
 * The scanner application intentionally has no general internet route. This
 * service is its narrowly scoped auth egress: it accepts a bearer token only
 * from the internal app network and calls Supabase's authenticated user API.
 */
import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

function exact(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function config(value = process.env) {
  const url = value.SUPABASE_URL?.trim();
  const key = value.SUPABASE_PUBLISHABLE_KEY?.trim();
  const token = value.AUTH_GATEWAY_TOKEN?.trim();
  if (!url || !key || !token || token.length < 24) throw new Error('SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and a 24+ character AUTH_GATEWAY_TOKEN are required.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('SUPABASE_URL must use HTTPS.');
  return { url: parsed.toString().replace(/\/$/, ''), key, token };
}

export function createAuthGateway({ environment = process.env, fetchFn = fetch } = {}) {
  const settings = config(environment);
  return createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/healthz') {
      response.writeHead(200, { 'Cache-Control': 'no-store' }); response.end('ok'); return;
    }
    if (request.method !== 'POST' || request.url !== '/v1/user') {
      response.writeHead(404); response.end(); return;
    }
    if (!exact(request.headers['x-easyacr-gateway-token'], settings.token)) {
      response.writeHead(401); response.end(); return;
    }
    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string' || !/^Bearer\s+[^\s]{20,}$/.test(authorization)) {
      response.writeHead(401); response.end(); return;
    }
    try {
      const upstream = await fetchFn(`${settings.url}/auth/v1/user`, { headers: { apikey: settings.key, authorization }, signal: AbortSignal.timeout(5_000) });
      if (!upstream.ok) { response.writeHead(401); response.end(); return; }
      const user = await upstream.json();
      if (!user || typeof user.id !== 'string' || user.id.length > 128 || (user.email !== undefined && typeof user.email !== 'string')) { response.writeHead(401); response.end(); return; }
      const body = JSON.stringify({ id: user.id, ...(user.email ? { email: user.email } : {}) });
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(body);
    } catch {
      response.writeHead(503); response.end();
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4180);
  createAuthGateway().listen(port, process.env.HOST || '0.0.0.0');
}
