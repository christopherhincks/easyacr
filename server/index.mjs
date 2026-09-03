/**
 * easyACR MVP scanner service.
 *
 * Supabase-backed production requests are dispatched to a separate durable
 * worker. The in-memory path remains only for an explicitly configured local
 * invite demo; do not use it for public self-service traffic.
 */
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { createServer as createHttpServer } from 'node:http';
import { isIP } from 'node:net';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SERVER_DIR = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(process.env.STATIC_DIR ?? resolve(SERVER_DIR, '..', 'dist'));
const PORT = Number.parseInt(process.env.PORT ?? '4174', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_PAGES = 10;
const MAX_CONCURRENT_SCANS = 1;
const MAX_QUEUED_SCANS = 20;
const MAX_DISCOVERED_URLS = 200;
const MAX_LINKS_PER_PAGE = 100;
const MAX_FINDINGS = 500;
const MAX_ERRORS = 20;
const MAX_SCAN_MS = 120_000;
const MAX_NAVIGATION_MS = 15_000;
const JOB_RETENTION_MS = 24 * 60 * 60 * 1000;
const BETA_INVITE_TOKEN = process.env.EASYACR_BETA_INVITE_TOKEN?.trim() || null;
const SUPABASE_AUTH_GATEWAY = process.env.SUPABASE_AUTH_GATEWAY?.trim() || null;
const AUTH_GATEWAY_TOKEN = process.env.AUTH_GATEWAY_TOKEN?.trim() || null;
const DATA_GATEWAY_URL = process.env.DATA_GATEWAY_URL?.trim().replace(/\/$/, '') || null;
const DATA_GATEWAY_TOKEN = process.env.DATA_GATEWAY_TOKEN?.trim() || null;
const SUPABASE_BROWSER_HOST = process.env.SUPABASE_HOST?.trim() || null;
const SESSION_SECRET_CONFIGURED = Boolean(process.env.SESSION_HMAC_SECRET);
const SESSION_SECRET = process.env.SESSION_HMAC_SECRET || randomBytes(32).toString('base64url');
const TRUST_PROXY_IP = process.env.TRUST_PROXY_IP === 'true';

if (!process.env.SESSION_HMAC_SECRET) {
  console.warn('[easyacr] SESSION_HMAC_SECRET is unset; generated an ephemeral session key. Sessions will end on restart.');
}

function scannerProxyConfig(value = process.env.SCAN_EGRESS_PROXY?.trim()) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || (url.pathname !== '/' && url.pathname !== '')) throw new Error('invalid proxy URL');
    const username = url.username ? decodeURIComponent(url.username) : undefined;
    const password = url.password ? decodeURIComponent(url.password) : undefined;
    url.username = '';
    url.password = '';
    return { server: url.toString().replace(/\/$/, ''), ...(username ? { username } : {}), ...(password ? { password } : {}) };
  } catch {
    console.error('[easyacr] SCAN_EGRESS_PROXY is invalid; scanning is disabled.');
    return null;
  }
}

const SCAN_PROXY_CONFIG = scannerProxyConfig();
const SUPABASE_AUTH_CONFIGURED = Boolean(SUPABASE_AUTH_GATEWAY && AUTH_GATEWAY_TOKEN);
const DATA_GATEWAY_CONFIGURED = Boolean(DATA_GATEWAY_URL && DATA_GATEWAY_TOKEN);
// Invite sessions are a local compatibility harness only. Public deployment
// must use the authenticated Supabase path, which records terms acceptance.
const LEGACY_INVITE_DEMO_ENABLED = !SUPABASE_AUTH_CONFIGURED && process.env.EASYACR_ALLOW_LOCAL_INVITE_DEMO === 'true';
const CURRENT_TERMS_VERSION = '2026-09-02';

function browserConnectSrc() {
  if (!SUPABASE_BROWSER_HOST) return "'self'";
  try {
    const url = new URL(`https://${SUPABASE_BROWSER_HOST}`);
    if (url.host !== SUPABASE_BROWSER_HOST || url.pathname !== '/') throw new Error('invalid host');
    return `'self' https://${url.host}`;
  } catch {
    console.warn('[easyacr] SUPABASE_HOST is invalid; browser connections are limited to same origin.');
    return "'self'";
  }
}

const jobs = new Map();
const rateWindows = new Map();
const revokedSessions = new Map();
let activeScans = 0;

const jobCleanupTimer = setInterval(() => {
  const cutoff = Date.now() - JOB_RETENTION_MS;
  for (const [id, job] of jobs) {
    if (job.completedAt && Date.parse(job.completedAt) < cutoff) jobs.delete(id);
  }
  for (const [key, hits] of rateWindows) {
    const recent = hits.filter((at) => Date.now() - at < 60 * 60_000);
    if (recent.length) rateWindows.set(key, recent); else rateWindows.delete(key);
  }
  for (const [sid, expiry] of revokedSessions) {
    if (expiry <= Date.now()) revokedSessions.delete(sid);
  }
}, 60 * 60 * 1000);
jobCleanupTimer.unref();

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function now() { return new Date().toISOString(); }

function json(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function error(response, status, code, message) {
  json(response, status, { error: { code, message } });
}

function getClientIp(request) {
  if (TRUST_PROXY_IP) {
    // The Compose Caddy config removes a client-supplied header and sets this
    // value itself. Never enable this option behind an arbitrary proxy.
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded && !forwarded.includes(',')) return forwarded;
  }
  return request.socket.remoteAddress || 'unknown';
}

function allowRate(request, bucket, max, intervalMs) {
  const key = `${bucket}:${getClientIp(request)}`;
  const timestamp = Date.now();
  const hits = (rateWindows.get(key) || []).filter((at) => timestamp - at < intervalMs);
  if (hits.length >= max) return false;
  hits.push(timestamp);
  rateWindows.set(key, hits);
  return true;
}

function encode(data) { return Buffer.from(JSON.stringify(data)).toString('base64url'); }
function decode(data) {
  try { return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')); } catch { return null; }
}
function sign(data) { return createHmac('sha256', SESSION_SECRET).update(data).digest('base64url'); }

function parseCookies(request) {
  const source = request.headers.cookie || '';
  return Object.fromEntries(source.split(';').map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter((entry) => entry.length));
}

function readSession(request) {
  const token = parseCookies(request).easyacr_session;
  if (!token || !token.includes('.')) return null;
  const [encoded, receivedSignature] = token.split('.', 2);
  const expectedSignature = sign(encoded);
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))) return null;
  const session = decode(encoded);
  if (!session || session.v !== 2 || typeof session.sid !== 'string' || typeof session.csrf !== 'string' || typeof session.termsAccepted !== 'boolean' || (session.userId !== null && typeof session.userId !== 'string') || !Number.isFinite(session.exp) || session.exp <= Date.now()) return null;
  if (SUPABASE_AUTH_CONFIGURED && !session.userId) return null;
  if (revokedSessions.has(session.sid)) return null;
  return session;
}

function issueSession(response, principal = null, termsAccepted = false) {
  const issuedAt = Date.now();
  const session = { v: 2, sid: randomUUID(), userId: principal?.id ?? null, termsAccepted, csrf: randomBytes(32).toString('base64url'), iat: issuedAt, exp: issuedAt + SESSION_TTL_MS };
  const encoded = encode(session);
  const secure = IS_PRODUCTION || process.env.COOKIE_SECURE === 'true';
  response.setHeader('Set-Cookie', [
    `easyacr_session=${encoded}.${sign(encoded)}`,
    'Path=/', 'HttpOnly', 'SameSite=Strict', secure ? 'Secure' : '', `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ].filter(Boolean).join('; '));
  return session;
}

function validInvite(request) {
  const presented = request.headers['x-easyacr-invite'];
  if (!BETA_INVITE_TOKEN || typeof presented !== 'string' || presented.length !== BETA_INVITE_TOKEN.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(BETA_INVITE_TOKEN));
}

async function authenticatedPrincipal(request) {
  if (!SUPABASE_AUTH_CONFIGURED) return null;
  const authorization = request.headers.authorization;
  if (typeof authorization !== 'string' || !/^Bearer\s+[^\s]{20,}$/.test(authorization)) return null;
  try {
    const response = await fetch(`${SUPABASE_AUTH_GATEWAY}/v1/user`, {
      method: 'POST',
      headers: { authorization, 'x-easyacr-gateway-token': AUTH_GATEWAY_TOKEN },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const principal = await response.json();
    if (!principal || typeof principal.id !== 'string' || principal.id.length > 128 || (principal.email !== undefined && typeof principal.email !== 'string')) return null;
    return principal;
  } catch {
    return null;
  }
}

async function dataGateway(path, init = {}) {
  if (!DATA_GATEWAY_CONFIGURED) throw new Error('Durable scan storage is not configured.');
  const response = await fetch(`${DATA_GATEWAY_URL}${path}`, {
    ...init,
    headers: { 'x-easyacr-gateway-token': DATA_GATEWAY_TOKEN, 'content-type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Data gateway request failed (${response.status}).`);
  // A mutation may legitimately acknowledge success without a response body.
  // In particular, older gateway deployments did this for terms acceptance.
  // Treat a 2xx empty body as `null` rather than turning a completed mutation
  // into a client-visible JSON parsing failure.
  const body = await response.text();
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('Data gateway returned invalid JSON.');
  }
}

function publicPersistentJob(job) {
  return {
    id: job.id, target: job.target_url, pageLimit: job.page_limit, status: job.status,
    createdAt: job.created_at, startedAt: job.started_at, completedAt: job.completed_at,
    pagesCrawled: job.pages_crawled, summary: { pagesCrawled: job.pages_crawled, violationCount: job.finding_count, status: job.status },
    draftEvidenceAvailable: ['completed', 'partial'].includes(job.status),
  };
}

async function activeSession(request) {
  const session = readSession(request);
  if (!session || !session.userId || !DATA_GATEWAY_CONFIGURED) return session;
  try {
    const state = await dataGateway(`/v1/sessions/${session.sid}/revocation`);
    return state?.revoked ? null : session;
  } catch {
    // In public Supabase mode, losing the revocation store must fail closed.
    return null;
  }
}

async function requireSession(request, response, { csrf = false } = {}) {
  const session = await activeSession(request);
  if (!session) { error(response, 401, 'SESSION_REQUIRED', 'Create a guest session first.'); return null; }
  if (csrf) {
    const sent = request.headers['x-csrf-token'];
    if (typeof sent !== 'string' || sent.length !== session.csrf.length || !timingSafeEqual(Buffer.from(sent), Buffer.from(session.csrf))) {
      error(response, 403, 'CSRF_REJECTED', 'A valid X-CSRF-Token is required.'); return null;
    }
    // Browser-facing mutations must be same-origin. Non-browser agent calls can omit Origin.
    const origin = request.headers.origin;
    if (origin && origin !== `${IS_PRODUCTION ? 'https' : 'http'}://${request.headers.host}`) {
      error(response, 403, 'ORIGIN_REJECTED', 'Cross-origin requests are not allowed.'); return null;
    }
  }
  return session;
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
  }
  if (!body) return {};
  try { return JSON.parse(body); } catch { throw new Error('INVALID_JSON'); }
}

function assertOnlyKeys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request body must be a JSON object.');
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unsupported field: ${key}`);
}

function isPublicIp(address) {
  // Browser DNS and the proxy are not trusted to enforce this. Reject private,
  // loopback, link-local, multicast, documentation, and IPv4-mapped IPv6 space.
  const ipv4 = address.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b, c, d] = ipv4.slice(1).map(Number);
    if ([a, b, c, d].some((part) => part > 255)) return false;
    if (a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31 || a === 100 && b >= 64 && b <= 127 || a === 192 && b === 0 || a === 198 && (b === 18 || b === 19 || b === 51 || b === 100) || a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  const normalized = address.toLowerCase();
  if (normalized.includes('.') && normalized.startsWith('::ffff:')) return false;
  if (normalized === '::' || normalized === '::1' || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('ff') || normalized.startsWith('2001:db8')) return false;
  // A non-IPv4 result is treated as IPv6. lookup() only returns numeric IPs.
  return /^[0-9a-f:]+$/i.test(normalized);
}

// This check deliberately performs no DNS lookup. The public app uses it
// before submitting durable work so a malformed, local, or credential-bearing
// target never reaches the queue. The isolated worker/proxy remains the DNS
// and egress authority, where rebinding must be enforced.
export function validatePublicTargetSyntax(input) {
  if (typeof input !== 'string' || input.length === 0 || input.length > 2_048) throw new Error('Target must be an absolute HTTPS URL.');
  let url;
  try { url = new URL(input); } catch { throw new Error('Target must be an absolute HTTPS URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Target must be a credential-free HTTPS URL without a fragment.');
  if (url.port) throw new Error('Only the default HTTPS port is permitted.');
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname || hostname.length > 253 || hostname.endsWith('.') || isIP(hostname)) throw new Error('IP-literal and malformed targets are not permitted.');
  if (['localhost', 'local', 'internal', 'test', 'example', 'invalid'].includes(hostname) || /\.(localhost|local|internal|test|example|invalid)$/.test(hostname)) throw new Error('Target host is not permitted.');
  const labels = hostname.split('.');
  if (labels.length < 2 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) throw new Error('Target host is not a public DNS hostname.');
  return url;
}

async function validateTarget(input) {
  const url = validatePublicTargetSyntax(input);
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some(({ address }) => !isPublicIp(address))) throw new Error('Target DNS must resolve exclusively to public IP addresses.');
  return url;
}

async function validateCrawlUrl(candidate, expectedOrigin) {
  let url;
  try { url = new URL(candidate); } catch { throw new Error('Invalid crawl URL.'); }
  if (url.protocol !== 'https:' || url.origin !== expectedOrigin || url.username || url.password) throw new Error('Crawl attempted to leave the exact HTTPS target origin.');
  await validateTarget(url.href);
  return url;
}

function publicJob(job) {
  const { ownerSessionId, findings, evidence, queue, visited, errors, ...safe } = job;
  return { ...safe, draftEvidenceAvailable: ['completed', 'partial'].includes(job.status), summary: { pagesCrawled: job.pagesCrawled, violationCount: findings.length, status: job.status } };
}

function scanOwner(session) { return session.userId ?? session.sid; }

function enqueueScan(ownerSessionId, target, pageLimit = MAX_PAGES) {
  const id = `scan_${randomUUID()}`;
  const job = { id, ownerSessionId, target: target.href, origin: target.origin, pageLimit, status: 'queued', createdAt: now(), startedAt: null, completedAt: null, pagesCrawled: 0, findings: [], errors: [], queue: [target.href], visited: new Set() };
  jobs.set(id, job);
  void drainScan(job);
  return job;
}

function recordScanError(job, page, message) {
  if (job.errors.length < MAX_ERRORS) job.errors.push({ page, message: String(message).slice(0, 500) });
}

async function drainScan(job) {
  if (activeScans >= MAX_CONCURRENT_SCANS) { setTimeout(() => void drainScan(job), 250); return; }
  if (job.status !== 'queued') return;
  activeScans += 1;
  job.status = 'running'; job.startedAt = now();
  const deadline = Date.now() + MAX_SCAN_MS;
  let browser;
  try {
    // The proxy config is checked before jobs are created, then passed to
    // Chromium so every browser request is forced through the controlled proxy.
    browser = await chromium.launch({ headless: true, proxy: SCAN_PROXY_CONFIG });
    const context = await browser.newContext({ ignoreHTTPSErrors: false, serviceWorkers: 'block' });
    await context.route('**/*', async (route) => {
      try {
        const request = route.request();
        if (!['GET', 'HEAD'].includes(request.method())) throw new Error('Non-idempotent browser requests are blocked.');
        if (!['document', 'stylesheet', 'script'].includes(request.resourceType())) throw new Error('Non-essential browser resources are blocked.');
        await validateCrawlUrl(request.url(), job.origin);
        await route.continue();
      } catch { await route.abort('blockedbyclient'); }
    });
    while (job.queue.length && job.pagesCrawled < job.pageLimit && Date.now() < deadline) {
      const candidate = job.queue.shift();
      const url = await validateCrawlUrl(candidate, job.origin);
      const page = await context.newPage();
      let redirects = 0;
      page.on('response', (response) => { if (response.request().isNavigationRequest() && response.status() >= 300 && response.status() < 400) redirects += 1; });
      try {
        const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: MAX_NAVIGATION_MS });
        if (redirects > 3) throw new Error('Navigation exceeded the redirect limit.');
        if (!response || !response.ok()) throw new Error(`Navigation failed (${response?.status() ?? 'no response'}).`);
        const result = await new AxeBuilder({ page }).analyze();
        for (const violation of result.violations) {
          if (job.findings.length >= MAX_FINDINGS) break;
          for (const node of violation.nodes.slice(0, 25)) {
            if (job.findings.length >= MAX_FINDINGS) break;
            job.findings.push({
            id: `${job.id}_${job.findings.length + 1}`, page: url.pathname || '/', ruleId: violation.id,
            impact: violation.impact || 'unknown', help: violation.help, helpUrl: violation.helpUrl,
            target: node.target.slice(0, 10).map((selector) => String(selector).slice(0, 500)),
            failureSummary: node.failureSummary ? String(node.failureSummary).slice(0, 1_000) : null,
              source: 'automated', untrustedContent: true,
            });
          }
        }
        const links = await page.locator('a[href]').evaluateAll((anchors) => anchors.slice(0, 100).map((anchor) => anchor.href));
        for (const link of links) {
          if (job.queue.length + job.visited.size >= MAX_DISCOVERED_URLS) break;
          try {
            const found = await validateCrawlUrl(link, job.origin);
            const clean = new URL(found.href); clean.hash = '';
            if (!job.queue.includes(clean.href) && !job.visited?.has(clean.href)) job.queue.push(clean.href);
          } catch { /* External, malformed, or non-public links are deliberately ignored. */ }
        }
        job.pagesCrawled += 1;
        job.visited.add(url.href);
      } catch (scanError) {
        recordScanError(job, url.href, scanError instanceof Error ? scanError.message : 'Page scan failed.');
      } finally { await page.close(); }
    }
    if (Date.now() >= deadline) recordScanError(job, job.target, 'Scan timed out.');
    job.status = job.errors.length ? (job.pagesCrawled ? 'partial' : 'failed') : 'completed';
  } catch (scanError) {
    job.status = 'failed';
    recordScanError(job, job.target, scanError instanceof Error ? scanError.message : 'Scanner failed.');
  } finally {
    if (browser) await browser.close();
    job.completedAt = now();
    activeScans -= 1;
  }
}

function draftEvidence(job) {
  const findings = job.findings || [];
  const byImpact = Object.groupBy(findings, ({ impact }) => impact || 'unknown');
  return {
    scanId: job.id, target: job.target || job.target_url, scanStatus: job.status, generatedAt: now(),
    automatedEvidence: { pagesCrawled: job.pagesCrawled ?? job.pages_crawled, findingsByImpact: Object.fromEntries(Object.entries(byImpact).map(([impact, grouped]) => [impact, grouped.length])), totalFindings: job.finding_count ?? findings.length },
    humanReviewRequired: true,
    warning: 'This is automated draft evidence, not an accessibility conformance determination or completed ACR. Human review is required.',
  };
}

function findingsPage(searchParams) {
  const limitRaw = searchParams.get('limit');
  const cursorRaw = searchParams.get('cursor');
  const severity = searchParams.get('severity');
  if (severity && !['critical', 'serious', 'moderate', 'minor'].includes(severity)) throw new Error('Unsupported severity filter.');
  if (limitRaw !== null && !/^[1-9][0-9]*$/.test(limitRaw)) throw new Error('limit must be a positive integer.');
  if (cursorRaw !== null && !/^(0|[1-9][0-9]*)$/.test(cursorRaw)) throw new Error('cursor must be a non-negative integer.');
  const limit = limitRaw === null ? 50 : Number.parseInt(limitRaw, 10);
  const cursor = cursorRaw === null ? 0 : Number.parseInt(cursorRaw, 10);
  if (limit > 100) throw new Error('limit must not exceed 100.');
  if (cursor > 1_000_000) throw new Error('cursor is out of range.');
  return { limit, cursor, severity };
}

function staticFile(request, response, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const file = resolve(DIST_DIR, `.${normalize(requested)}`);
  if (!file.startsWith(`${DIST_DIR}/`) || !existsSync(file)) {
    const index = resolve(DIST_DIR, 'index.html');
    if (!existsSync(index)) return error(response, 404, 'NOT_FOUND', 'Build the client before serving it.');
    response.writeHead(200, { 'Content-Type': MIME_TYPES['.html'], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': `default-src 'self'; connect-src ${browserConnectSrc()}; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'${IS_PRODUCTION ? '; upgrade-insecure-requests' : ''}` });
    return createReadStream(index).pipe(response);
  }
  response.writeHead(200, { 'Content-Type': MIME_TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
  return createReadStream(file).pipe(response);
}

export function createApp() {
  return createHttpServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const { pathname } = requestUrl;
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=(), usb=()');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Content-Security-Policy', `default-src 'self'; connect-src ${browserConnectSrc()}; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'${IS_PRODUCTION ? '; upgrade-insecure-requests' : ''}`);

    if (request.method === 'GET' && pathname === '/healthz') {
      const accessEnabled = SUPABASE_AUTH_CONFIGURED ? DATA_GATEWAY_CONFIGURED : Boolean(BETA_INVITE_TOKEN && LEGACY_INVITE_DEMO_ENABLED);
      const scanningEnabled = SUPABASE_AUTH_CONFIGURED ? DATA_GATEWAY_CONFIGURED : Boolean(SCAN_PROXY_CONFIG);
      return json(response, scanningEnabled && accessEnabled && SESSION_SECRET_CONFIGURED ? 200 : 503, { ok: Boolean(scanningEnabled && accessEnabled && SESSION_SECRET_CONFIGURED), scanningEnabled, persistenceEnabled: DATA_GATEWAY_CONFIGURED, accessMode: SUPABASE_AUTH_CONFIGURED ? 'supabase' : BETA_INVITE_TOKEN ? 'invite' : 'disabled' });
    }

    if (request.method === 'GET' && pathname === '/api/v1/session') {
      const session = await activeSession(request);
      return json(response, 200, { active: Boolean(session), webMcpEnabled: Boolean(session), csrfToken: session?.csrf, termsAccepted: session?.termsAccepted ?? false, expiresAt: session ? new Date(session.exp).toISOString() : null });
    }
    if (request.method === 'POST' && pathname === '/api/v1/session') {
      if (!allowRate(request, 'session', 10, 15 * 60_000)) return error(response, 429, 'RATE_LIMITED', 'Too many session requests.');
      if (!SESSION_SECRET_CONFIGURED) return error(response, 503, 'SESSION_CONFIGURATION_REQUIRED', 'Beta sessions are not configured.');
      if (SUPABASE_AUTH_CONFIGURED) {
        const principal = await authenticatedPrincipal(request);
        if (!principal) return error(response, 401, 'AUTH_REQUIRED', 'Sign in with Supabase before enabling WebMCP.');
        let workspace;
        try { workspace = await dataGateway('/v1/workspaces/bootstrap', { method: 'POST', body: JSON.stringify({ userId: principal.id, ...(principal.email ? { email: principal.email } : {}) }) }); } catch { return error(response, 503, 'PERSISTENCE_UNAVAILABLE', 'Account storage is temporarily unavailable.'); }
        const state = Array.isArray(workspace) ? workspace[0] : workspace;
        const session = issueSession(response, principal, Boolean(state?.terms_accepted_at));
        return json(response, 201, { webMcpEnabled: true, csrfToken: session.csrf, expiresAt: new Date(session.exp).toISOString(), userId: principal.id, accessMode: 'supabase' });
      }
      if (!LEGACY_INVITE_DEMO_ENABLED) return error(response, 503, 'SELF_SERVICE_AUTH_REQUIRED', 'Public WebMCP sessions require configured Supabase authentication.');
      if (!BETA_INVITE_TOKEN) return error(response, 503, 'BETA_ACCESS_DISABLED', 'Beta access is not configured.');
      if (!validInvite(request)) return error(response, 401, 'INVITE_REQUIRED', 'A valid beta invitation is required.');
      if (request.headers['x-easyacr-terms-version'] !== CURRENT_TERMS_VERSION) return error(response, 400, 'TERMS_REQUIRED', 'Accept the current public-scan terms before enabling a local demo session.');
      const session = issueSession(response, null, true);
      return json(response, 201, { webMcpEnabled: true, csrfToken: session.csrf, expiresAt: new Date(session.exp).toISOString(), beta: true });
    }
    if (request.method === 'POST' && pathname === '/api/v1/session/revoke') {
      const session = await requireSession(request, response, { csrf: true }); if (!session) return;
      revokedSessions.set(session.sid, session.exp);
      if (session.userId && DATA_GATEWAY_CONFIGURED) {
        try { await dataGateway('/v1/sessions/revoke', { method: 'POST', body: JSON.stringify({ sessionId: session.sid, userId: session.userId, expiresAt: new Date(session.exp).toISOString() }) }); } catch { return error(response, 503, 'PERSISTENCE_UNAVAILABLE', 'Could not persist the sign-out request.'); }
      }
      response.setHeader('Set-Cookie', 'easyacr_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
      return json(response, 200, { revoked: true });
    }
    if (request.method === 'POST' && pathname === '/api/v1/terms/accept') {
      const session = await requireSession(request, response, { csrf: true }); if (!session) return;
      if (!session.userId || !DATA_GATEWAY_CONFIGURED) return error(response, 503, 'TERMS_UNAVAILABLE', 'Terms acceptance is unavailable until account storage is configured.');
      try {
        const input = await readJson(request); assertOnlyKeys(input, ['version']);
        if (input.version !== CURRENT_TERMS_VERSION) throw new Error('Unsupported terms version.');
        const acceptance = await dataGateway('/v1/terms/accept', { method: 'POST', body: JSON.stringify({ userId: session.userId, version: input.version }) });
        const renewed = issueSession(response, { id: session.userId }, true);
        revokedSessions.set(session.sid, session.exp);
        await dataGateway('/v1/sessions/revoke', { method: 'POST', body: JSON.stringify({ sessionId: session.sid, userId: session.userId, expiresAt: new Date(session.exp).toISOString(), reason: 'session_rotated' }) });
        return json(response, 200, { accepted: true, csrfToken: renewed.csrf, acceptance });
      } catch (requestError) { return error(response, 400, 'TERMS_REJECTED', requestError instanceof Error ? requestError.message : 'Invalid terms request.'); }
    }
    if (request.method === 'POST' && pathname === '/api/v1/scans') {
      const session = await requireSession(request, response, { csrf: true }); if (!session) return;
      if (!allowRate(request, 'scan', 5, 60 * 60_000)) return error(response, 429, 'RATE_LIMITED', 'Scan limit reached; try again later.');
      if (!session.termsAccepted) return error(response, 403, 'TERMS_REQUIRED', 'Accept the public-scan terms before queuing a scan.');
      const persistentScan = Boolean(session.userId && DATA_GATEWAY_CONFIGURED);
      if (!persistentScan && [...jobs.values()].filter((job) => ['queued', 'running'].includes(job.status)).length >= MAX_QUEUED_SCANS) return error(response, 503, 'SCAN_QUEUE_FULL', 'The scan queue is full; try again shortly.');
      if (!persistentScan && !SCAN_PROXY_CONFIG) return error(response, 503, 'SCANNING_DISABLED', 'Scanning is disabled until a valid SCAN_EGRESS_PROXY is configured.');
      try {
        const input = await readJson(request); assertOnlyKeys(input, ['url', 'pageLimit', 'authorizationConfirmed']);
        if (typeof input.url !== 'string' || input.url.length > 2048) throw new Error('url must be a URL no longer than 2048 characters.');
        if (input.authorizationConfirmed !== true) throw new Error('Confirm that you own or are authorized to test this public website before queuing a scan.');
        if (input.pageLimit !== undefined && (!Number.isInteger(input.pageLimit) || input.pageLimit < 1 || input.pageLimit > MAX_PAGES)) throw new Error(`pageLimit must be an integer from 1 to ${MAX_PAGES}.`);
        // Never resolve durable targets in the public app. The worker's
        // controlled egress proxy performs DNS classification at connection
        // time; this synchronous gate only rejects unsafe URL syntax.
        const target = persistentScan ? validatePublicTargetSyntax(input.url) : await validateTarget(input.url);
        if (persistentScan) {
          const job = await dataGateway('/v1/scans', { method: 'POST', body: JSON.stringify({ userId: session.userId, targetUrl: target.href, pageLimit: input.pageLimit ?? MAX_PAGES, authorizationConfirmed: true }) });
          return json(response, 202, { scan: publicPersistentJob(job), warning: 'Automated findings are draft evidence only and require human review.' });
        }
        const job = enqueueScan(scanOwner(session), target, input.pageLimit ?? MAX_PAGES);
        return json(response, 202, { scan: publicJob(job), warning: 'Automated findings are draft evidence only and require human review.' });
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'Invalid request.';
        return error(response, message === 'BODY_TOO_LARGE' ? 413 : 400, 'INVALID_SCAN_REQUEST', message);
      }
    }
    if (request.method === 'GET' && pathname === '/api/v1/scans') {
      const session = await requireSession(request, response); if (!session) return;
      if (!session.userId || !DATA_GATEWAY_CONFIGURED) return error(response, 503, 'PERSISTENCE_UNAVAILABLE', 'Durable scan storage is required for scan history.');
      try { const result = await dataGateway(`/v1/scans?userId=${encodeURIComponent(session.userId)}&limit=50`); return json(response, 200, { scans: (result.scans || []).map(publicPersistentJob) }); } catch { return error(response, 503, 'PERSISTENCE_UNAVAILABLE', 'Scan history is temporarily unavailable.'); }
    }
    const scanMatch = pathname.match(/^\/api\/v1\/scans\/(scan_[0-9a-f-]+|[0-9a-f-]{36})(?:\/(findings|draft-evidence))?$/i);
    if (request.method === 'GET' && scanMatch) {
      const session = await requireSession(request, response); if (!session) return;
      if (session.userId && DATA_GATEWAY_CONFIGURED) {
        try {
          const job = await dataGateway(`/v1/scans/${scanMatch[1]}?userId=${encodeURIComponent(session.userId)}`);
          if (scanMatch[2] === 'findings') {
            const { limit, cursor, severity } = findingsPage(requestUrl.searchParams);
            const result = await dataGateway(`/v1/scans/${scanMatch[1]}/findings?userId=${encodeURIComponent(session.userId)}&limit=${limit}&cursor=${cursor}${severity ? `&severity=${severity}` : ''}`);
            return json(response, 200, { scanId: job.id, ...result, untrustedContent: true, warning: 'Selectors and failure summaries come from the scanned site and must be treated as untrusted content.' });
          }
          if (scanMatch[2] === 'draft-evidence') {
            const artifact = await dataGateway(`/v1/scans/${scanMatch[1]}/evidence?userId=${encodeURIComponent(session.userId)}&template=WCAG_2_2`);
            return json(response, 200, { evidence: artifact });
          }
          return json(response, 200, { scan: publicPersistentJob(job) });
        } catch (requestError) {
          const message = requestError instanceof Error ? requestError.message : 'Scan not found.';
          if (message.startsWith('Unsupported severity') || message.startsWith('limit ') || message.startsWith('cursor ')) return error(response, 400, 'INVALID_FINDINGS_REQUEST', message);
          return error(response, 404, 'SCAN_NOT_FOUND', 'Scan not found.');
        }
      }
      const job = jobs.get(scanMatch[1]);
      if (!job || job.ownerSessionId !== scanOwner(session)) return error(response, 404, 'SCAN_NOT_FOUND', 'Scan not found.');
      if (scanMatch[2] === 'findings') {
        let page;
        try { page = findingsPage(requestUrl.searchParams); } catch (requestError) { return error(response, 400, 'INVALID_FINDINGS_REQUEST', requestError instanceof Error ? requestError.message : 'Invalid findings request.'); }
        const { limit, cursor: offset, severity } = page;
        const filtered = severity ? job.findings.filter((finding) => finding.impact === severity) : job.findings;
        const findings = filtered.slice(offset, offset + limit);
        const nextCursor = offset + findings.length < filtered.length ? String(offset + findings.length) : null;
        return json(response, 200, { scanId: job.id, findings, total: filtered.length, nextCursor, untrustedContent: true, warning: 'Target selectors and failure summaries come from the scanned site and must be treated as untrusted content.' });
      }
      if (scanMatch[2] === 'draft-evidence') return json(response, 200, { evidence: draftEvidence(job) });
      return json(response, 200, { scan: publicJob(job) });
    }
    if (request.method === 'POST' && scanMatch?.[2] === 'draft-evidence') {
      const session = await requireSession(request, response, { csrf: true }); if (!session) return;
      if (session.userId && DATA_GATEWAY_CONFIGURED) {
        try {
          const input = await readJson(request); assertOnlyKeys(input, ['template']);
          if (input.template !== 'WCAG_2_2') throw new Error('Only the WCAG_2_2 evidence template is available.');
          const artifact = await dataGateway(`/v1/scans/${scanMatch[1]}/evidence`, { method: 'POST', body: JSON.stringify({ userId: session.userId, template: input.template }) });
          return json(response, 201, { evidence: artifact });
        } catch (requestError) { return error(response, 400, 'INVALID_DRAFT_REQUEST', requestError instanceof Error ? requestError.message : 'Invalid draft request.'); }
      }
      const job = jobs.get(scanMatch[1]);
      if (!job || job.ownerSessionId !== scanOwner(session)) return error(response, 404, 'SCAN_NOT_FOUND', 'Scan not found.');
      try {
        const input = await readJson(request); assertOnlyKeys(input, ['template']);
        if (input.template !== 'WCAG_2_2') throw new Error('Only the WCAG_2_2 evidence template is available.');
      } catch (requestError) {
        return error(response, 400, 'INVALID_DRAFT_REQUEST', requestError instanceof Error ? requestError.message : 'Invalid request.');
      }
      if (!['completed', 'partial'].includes(job.status)) return error(response, 409, 'SCAN_NOT_READY', 'Draft evidence is available after a completed or partial scan.');
      return json(response, 200, { evidence: draftEvidence(job) });
    }
    if (pathname.startsWith('/api/')) return error(response, 404, 'NOT_FOUND', 'Unknown API endpoint.');
    if (request.method !== 'GET' && request.method !== 'HEAD') return error(response, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    return staticFile(request, response, pathname);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('PORT must be a valid TCP port.');
  createApp().listen(PORT, HOST, () => console.log(`[easyacr] listening on http://${HOST}:${PORT}`));
}
