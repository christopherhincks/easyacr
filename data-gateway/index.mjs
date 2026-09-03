/**
 * Private persistence gateway for easyACR.
 *
 * It is deliberately not a generic PostgREST proxy. The API and scanner
 * worker can perform only the narrow operations below, while this process is
 * the only component holding the Supabase service-role key and a data egress
 * route. Do not publish this port.
 */
import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';

const MAX_BODY_BYTES = 256 * 1024;

function exact(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function settings(environment = process.env) {
  const url = environment.SUPABASE_URL?.trim();
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const token = environment.DATA_GATEWAY_TOKEN?.trim();
  if (!url || !serviceRoleKey || !token || token.length < 24) throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and a 24+ character DATA_GATEWAY_TOKEN are required.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('SUPABASE_URL must use HTTPS.');
  return { url: parsed.toString().replace(/\/$/, ''), serviceRoleKey, token };
}

function cleanId(value) { return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null; }
// This is intentionally a pure parser. Resolving the hostname here would add
// public-app egress and still could not defend against DNS rebinding. The
// scanner proxy is the network authority; the app/gateway only reject URLs
// that are never valid public scan targets.
export function cleanPublicTargetUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2_048) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.port) return null;
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname || hostname.length > 253 || hostname.endsWith('.') || isIP(hostname)) return null;
  if (['localhost', 'local', 'internal', 'test', 'example', 'invalid'].includes(hostname) || /\.(localhost|local|internal|test|example|invalid)$/.test(hostname)) return null;
  const labels = hostname.split('.');
  if (labels.length < 2 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return null;
  return url.href;
}
function cleanInteger(value, min, max) { return Number.isInteger(value) && value >= min && value <= max ? value : null; }
function cleanCursor(value) { return value !== null && /^(0|[1-9][0-9]*)$/.test(value) && Number(value) <= 1_000_000 ? Number(value) : null; }
function cleanLimit(value) { return value !== null && /^[1-9][0-9]*$/.test(value) && Number(value) <= 100 ? Number(value) : null; }
function cleanSeverity(value) { return value === null || ['critical', 'serious', 'moderate', 'minor'].includes(value) ? value : undefined; }
function contentRangeTotal(value) {
  const match = typeof value === 'string' && value.match(/\/(\d+|\*)$/);
  return match && match[1] !== '*' ? Number(match[1]) : null;
}
function row(value) { return Array.isArray(value) ? value[0] : value; }
function publicEvidenceArtifact(value) {
  const artifact = row(value);
  if (!artifact || typeof artifact !== 'object' || !artifact.content || typeof artifact.content !== 'object') throw new Error('invalid evidence artifact');
  return { ...artifact.content, artifactId: artifact.id, scanId: artifact.scan_job_id, template: artifact.template, artifactState: artifact.state, createdAt: artifact.created_at };
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error('body too large');
  }
  try { return body ? JSON.parse(body) : {}; } catch { throw new Error('invalid json'); }
}

function reply(response, status, value = undefined) {
  if (value === undefined) { response.writeHead(status); response.end(); return; }
  const body = JSON.stringify(value);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(body);
}

export function createDataGateway({ environment = process.env, fetchFn = fetch } = {}) {
  const config = settings(environment);
  const upstream = async (path, init = {}) => fetchFn(`${config.url}${path}`, {
    ...init,
    headers: { apikey: config.serviceRoleKey, authorization: `Bearer ${config.serviceRoleKey}`, 'content-type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(8_000),
  });
  const rpc = async (name, body) => {
    const response = await upstream(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Supabase RPC ${name} failed (${response.status}).`);
    return response.json();
  };

  return createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://gateway');
    const { pathname } = url;
    if (request.method === 'GET' && pathname === '/healthz') return reply(response, 200, { ok: true });
    if (!exact(request.headers['x-easyacr-gateway-token'], config.token)) return reply(response, 401);
    try {
      if (request.method === 'POST' && request.url === '/v1/workspaces/bootstrap') {
        const body = await readJson(request); const userId = cleanId(body.userId);
        if (!userId || (body.email !== undefined && (typeof body.email !== 'string' || body.email.length > 320))) return reply(response, 400);
        return reply(response, 200, await rpc('easyacr_bootstrap_workspace', { p_user_id: userId, p_email: body.email || null }));
      }
      if (request.method === 'POST' && request.url === '/v1/terms/accept') {
        const body = await readJson(request); const userId = cleanId(body.userId);
        if (!userId || typeof body.version !== 'string' || body.version.length > 64) return reply(response, 400);
        return reply(response, 200, await rpc('easyacr_accept_terms', { p_user_id: userId, p_version: body.version }));
      }
      if (request.method === 'POST' && request.url === '/v1/scans') {
        const body = await readJson(request); const userId = cleanId(body.userId); const targetUrl = cleanPublicTargetUrl(body.targetUrl); const pageLimit = cleanInteger(body.pageLimit, 1, 10);
        if (!userId || !targetUrl || pageLimit === null || body.authorizationConfirmed !== true) return reply(response, 400);
        await rpc('easyacr_authorize_target', { p_user_id: userId, p_target_url: targetUrl });
        const scan = row(await rpc('easyacr_enqueue_scan', { p_user_id: userId, p_target_url: targetUrl, p_page_limit: pageLimit }));
        if (!scan) throw new Error('scan enqueue returned no job');
        return reply(response, 202, scan);
      }
      if (request.method === 'POST' && request.url === '/v1/scans/claim-next') return reply(response, 200, await rpc('easyacr_claim_next_scan', {}));
      if (request.method === 'POST' && request.url === '/v1/scans/purge-expired') return reply(response, 200, { purged: await rpc('easyacr_purge_expired_scans', {}) });
      if (request.method === 'GET' && pathname === '/v1/scans') {
        const userId = cleanId(url.searchParams.get('userId')); const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 100);
        if (!userId) return reply(response, 400);
        const data = await upstream(`/rest/v1/scan_jobs?requested_by=eq.${userId}&select=id,target_url,status,page_limit,pages_crawled,finding_count,errors,created_at,started_at,completed_at,terms_version&order=created_at.desc&limit=${limit}`, { headers: { accept: 'application/json' } });
        if (!data.ok) throw new Error('scan list failed');
        return reply(response, 200, { scans: await data.json() });
      }
      if (request.method === 'POST' && request.url === '/v1/sessions/revoke') {
        const body = await readJson(request); const sessionId = cleanId(body.sessionId); const userId = cleanId(body.userId); const expiresAt = typeof body.expiresAt === 'string' && Number.isFinite(Date.parse(body.expiresAt)) ? body.expiresAt : null;
        if (!sessionId || !expiresAt) return reply(response, 400);
        const saved = await upstream('/rest/v1/webmcp_session_revocations?on_conflict=session_id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ session_id: sessionId, user_id: userId, expires_at: expiresAt, reason: typeof body.reason === 'string' ? body.reason.slice(0, 96) : 'user_sign_out' }) });
        if (!saved.ok) throw new Error('session revocation save failed');
        return reply(response, 204);
      }
      const revocation = pathname.match(/^\/v1\/sessions\/([0-9a-f-]{36})\/revocation$/i);
      if (request.method === 'GET' && revocation) {
        const data = await upstream(`/rest/v1/webmcp_session_revocations?session_id=eq.${revocation[1]}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=session_id&limit=1`, { headers: { accept: 'application/json' } });
        if (!data.ok) throw new Error('session revocation lookup failed');
        return reply(response, 200, { revoked: (await data.json()).length > 0 });
      }
      const scan = pathname.match(/^\/v1\/scans\/([0-9a-f-]{36})$/i);
      if (request.method === 'GET' && scan) {
        const userId = cleanId(url.searchParams.get('userId'));
        if (!userId) return reply(response, 400);
        const data = await upstream(`/rest/v1/scan_jobs?id=eq.${scan[1]}&requested_by=eq.${userId}&select=id,target_url,status,page_limit,pages_crawled,finding_count,errors,created_at,started_at,completed_at,terms_version`, { headers: { accept: 'application/json' } });
        if (!data.ok) throw new Error('scan lookup failed');
        const rows = await data.json(); return rows[0] ? reply(response, 200, rows[0]) : reply(response, 404);
      }
      const findings = pathname.match(/^\/v1\/scans\/([0-9a-f-]{36})\/findings$/i);
      if (request.method === 'GET' && findings) {
        const query = url.searchParams; const userId = cleanId(query.get('userId')); const cursor = cleanCursor(query.get('cursor') || '0'); const limit = cleanLimit(query.get('limit') || '50'); const severity = cleanSeverity(query.get('severity'));
        if (!userId || cursor === null || limit === null || severity === undefined) return reply(response, 400);
        const owner = await upstream(`/rest/v1/scan_jobs?id=eq.${findings[1]}&requested_by=eq.${userId}&select=id`, { headers: { accept: 'application/json' } });
        if (!owner.ok || !(await owner.json()).length) return reply(response, 404);
        const severityFilter = severity ? `&impact=eq.${severity}` : '';
        const data = await upstream(`/rest/v1/scan_findings?scan_job_id=eq.${findings[1]}${severityFilter}&select=id,page,rule_id,impact,help,help_url,target,failure_summary&order=sequence.asc&offset=${cursor}&limit=${limit}`, { headers: { accept: 'application/json', prefer: 'count=exact' } });
        if (!data.ok) throw new Error('findings lookup failed');
        const rows = await data.json(); const total = contentRangeTotal(data.headers.get('content-range'));
        if (total === null) throw new Error('findings count unavailable');
        return reply(response, 200, { findings: rows, total, nextCursor: cursor + rows.length < total ? String(cursor + rows.length) : null });
      }
      const evidence = pathname.match(/^\/v1\/scans\/([0-9a-f-]{36})\/evidence$/i);
      if (evidence && request.method === 'GET') {
        const userId = cleanId(url.searchParams.get('userId')); const template = url.searchParams.get('template');
        if (!userId || template !== 'WCAG_2_2') return reply(response, 400);
        const data = await upstream(`/rest/v1/scan_evidence_artifacts?scan_job_id=eq.${evidence[1]}&created_by=eq.${userId}&template=eq.${template}&select=id,scan_job_id,template,state,content,created_at&limit=1`, { headers: { accept: 'application/json' } });
        if (!data.ok) throw new Error('evidence lookup failed');
        const artifacts = await data.json(); return artifacts[0] ? reply(response, 200, publicEvidenceArtifact(artifacts[0])) : reply(response, 404);
      }
      if (evidence && request.method === 'POST') {
        const body = await readJson(request); const userId = cleanId(body.userId);
        if (!userId || body.template !== 'WCAG_2_2') return reply(response, 400);
        const artifact = await rpc('easyacr_create_draft_evidence', { p_user_id: userId, p_scan_id: evidence[1], p_template: body.template });
        return reply(response, 201, publicEvidenceArtifact(artifact));
      }
      const completion = pathname.match(/^\/v1\/scans\/([0-9a-f-]{36})\/complete$/i);
      if (request.method === 'POST' && completion) {
        const body = await readJson(request); const pagesCrawled = cleanInteger(body.pagesCrawled, 0, 10); const leaseToken = cleanId(body.leaseToken);
        if (!leaseToken || !['completed', 'partial', 'failed'].includes(body.status) || pagesCrawled === null || !Array.isArray(body.findings) || !Array.isArray(body.errors)) return reply(response, 400);
        return reply(response, 200, await rpc('easyacr_complete_scan', { p_scan_id: completion[1], p_lease_token: leaseToken, p_status: body.status, p_pages_crawled: pagesCrawled, p_findings: body.findings.slice(0, 500), p_errors: body.errors.slice(0, 20) }));
      }
      return reply(response, 404);
    } catch (error) {
      console.error('[data-gateway] request failed', { message: error instanceof Error ? error.message : 'unknown' });
      return reply(response, 503, { error: 'persistence temporarily unavailable' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createDataGateway().listen(Number(process.env.PORT || 4181), process.env.HOST || '0.0.0.0');
}
