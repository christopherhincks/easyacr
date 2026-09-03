/** Isolated durable scan worker. Never attach this container to public ingress. */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const DATA_GATEWAY_URL = process.env.DATA_GATEWAY_URL?.replace(/\/$/, '');
const DATA_GATEWAY_TOKEN = process.env.DATA_GATEWAY_TOKEN;
const SCAN_EGRESS_PROXY = process.env.SCAN_EGRESS_PROXY;
const MAX_SCAN_MS = 120_000;
const MAX_NAVIGATION_MS = 15_000;
const MAX_FINDINGS = 500;
const MAX_DISCOVERED_URLS = 200;
const MAX_LINKS_PER_PAGE = 100;
// data-gateway rejects bodies above 256 KiB. Leave schema headroom, then
// measure the exact UTF-8 JSON body before sending it.
const DATA_GATEWAY_MAX_BODY_BYTES = 256 * 1024;
const MAX_COMPLETION_BODY_BYTES = 240 * 1024;
const HEALTH_PORT = Number.parseInt(process.env.HEALTH_PORT || '4175', 10);
const health = { running: false, lastCycleAt: 0, lastSuccessAt: 0, lastError: '' };

class ScanDeadlineError extends Error {
  constructor() { super('Scan timed out.'); this.name = 'ScanDeadlineError'; }
}

function sleep(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
function remainingMilliseconds(deadline) { return Math.max(0, deadline - Date.now()); }
function boundedString(value, maximum) { return String(value ?? '').slice(0, maximum); }
function cleanFinding(value) {
  const impact = ['critical', 'serious', 'moderate', 'minor', 'unknown'].includes(value?.impact) ? value.impact : 'unknown';
  return {
    page: boundedString(value?.page || '/', 2_048), ruleId: boundedString(value?.ruleId || 'unknown', 128), impact,
    help: boundedString(value?.help || 'Automated finding', 500), helpUrl: boundedString(value?.helpUrl, 2_048),
    target: Array.isArray(value?.target) ? value.target.slice(0, 10).map((selector) => boundedString(selector, 500)) : [],
    failureSummary: value?.failureSummary ? boundedString(value.failureSummary, 1_000) : null,
  };
}
function cleanError(value) { return { page: boundedString(value?.page || '/', 2_048), message: boundedString(value?.message || 'Scanner error.', 500) }; }
function bodySize(value) { return Buffer.byteLength(JSON.stringify(value)); }
function completionBody(status, pagesCrawled, findings, errors, leaseToken) { return { status, pagesCrawled, findings, errors, leaseToken }; }

/** Serialize an explicit, bounded completion payload for data-gateway. */
export function serializeCompletion(result, leaseToken, maximumBytes = MAX_COMPLETION_BODY_BYTES) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1_024 || maximumBytes >= DATA_GATEWAY_MAX_BODY_BYTES) throw new Error('Completion payload limit must leave room below the data-gateway intake limit.');
  const rawFindings = Array.isArray(result?.findings) ? result.findings : [];
  const rawErrors = Array.isArray(result?.errors) ? result.errors : [];
  const findings = rawFindings.slice(0, MAX_FINDINGS).map(cleanFinding);
  const errors = rawErrors.slice(0, 20).map(cleanError);
  const pagesCrawled = Number.isInteger(result?.pagesCrawled) ? Math.max(0, Math.min(10, result.pagesCrawled)) : 0;
  const status = ['completed', 'partial', 'failed'].includes(result?.status) ? result.status : 'failed';
  const complete = completionBody(status, pagesCrawled, findings, errors, leaseToken);
  if (rawFindings.length <= MAX_FINDINGS && rawErrors.length <= 20 && bodySize(complete) <= maximumBytes) return complete;

  // Reserve one durable error which accounts for every omitted record. A
  // truncated delivery is partial even if the browser analysis completed.
  const keptFindings = []; const keptErrors = [];
  const truncation = () => ({ page: '/', message: `Result capture/delivery truncated: stored ${keptFindings.length} of ${rawFindings.length} findings and ${keptErrors.length} of ${rawErrors.length} errors within the ${maximumBytes}-byte delivery limit.` });
  const candidate = () => completionBody('partial', pagesCrawled, keptFindings, [...keptErrors, truncation()], leaseToken);
  for (const error of errors) {
    if (bodySize(completionBody('partial', pagesCrawled, keptFindings, [...keptErrors, error, truncation()], leaseToken)) <= maximumBytes) keptErrors.push(error);
    else break;
  }
  for (const item of findings) {
    if (bodySize(completionBody('partial', pagesCrawled, [...keptFindings, item], [...keptErrors, truncation()], leaseToken)) <= maximumBytes) keptFindings.push(item);
    else break;
  }
  const payload = candidate();
  if (bodySize(payload) > maximumBytes) throw new Error('Unable to serialize a bounded completion payload.');
  return payload;
}

function proxyConfig(value = SCAN_EGRESS_PROXY) {
  if (!value) throw new Error('SCAN_EGRESS_PROXY is required.');
  const url = new URL(value); const username = url.username ? decodeURIComponent(url.username) : undefined; const password = url.password ? decodeURIComponent(url.password) : undefined;
  url.username = ''; url.password = '';
  return { server: url.toString().replace(/\/$/, ''), ...(username ? { username } : {}), ...(password ? { password } : {}) };
}
async function validateTarget(input, expectedOrigin = undefined) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.hostname === 'localhost' || url.hostname.endsWith('.') || /^\[?[0-9a-f:.]+\]?$/i.test(url.hostname) || expectedOrigin && url.origin !== expectedOrigin) throw new Error('Target is outside the public HTTPS same-origin policy.');
  // This worker deliberately has no direct internet or DNS route. The
  // controlled egress proxy resolves every CONNECT host itself, rejects any
  // non-public answer, and pins the validated numeric address. Keeping DNS
  // resolution there prevents both an availability failure and a bypass of
  // that network boundary.
  return url;
}
function finding(jobId, index, page, violation, node) {
  return { id: `${jobId}:${index}`, page, ruleId: violation.id, impact: violation.impact || 'unknown', help: String(violation.help || '').slice(0, 500), helpUrl: String(violation.helpUrl || '').slice(0, 2048), target: node.target.slice(0, 10).map((selector) => String(selector).slice(0, 500)), failureSummary: node.failureSummary ? String(node.failureSummary).slice(0, 1_000) : null, source: 'automated', untrustedContent: true };
}

export async function runScan(job) {
  const deadline = Date.now() + MAX_SCAN_MS; let target; const queue = []; const visited = new Set(); const findings = []; const errors = []; let pagesCrawled = 0; let browser; let timedOut = false; let findingLimitReached = false;
  const recordError = (page, error) => { if (errors.length < 20) errors.push({ page, message: String(error).slice(0, 500) }); };
  const ensureTime = () => { if (timedOut || remainingMilliseconds(deadline) < 1) throw new ScanDeadlineError(); };
  const scan = async () => {
    target = await validateTarget(job.target_url); ensureTime(); queue.push(target.href);
    browser = await chromium.launch({ headless: true, proxy: proxyConfig() });
    // The global timer can fire while Chromium itself is starting, before the
    // browser reference existed for it to close.
    if (timedOut) { void browser.close().catch(() => {}); throw new ScanDeadlineError(); }
    ensureTime();
    const context = await browser.newContext({ ignoreHTTPSErrors: false, serviceWorkers: 'block' });
    await context.route('**/*', async (route) => {
      try { const request = route.request(); if (!['GET', 'HEAD'].includes(request.method()) || !['document', 'stylesheet', 'script'].includes(request.resourceType())) throw new Error(); await validateTarget(request.url(), target.origin); await route.continue(); } catch { await route.abort('blockedbyclient'); }
    });
    while (queue.length && pagesCrawled < job.page_limit) {
      ensureTime();
      const candidate = queue.shift(); const url = await validateTarget(candidate, target.origin); const page = await context.newPage(); let redirects = 0;
      page.on('response', (response) => { if (response.request().isNavigationRequest() && response.status() >= 300 && response.status() < 400) redirects += 1; });
      try {
        const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: Math.max(1, Math.min(MAX_NAVIGATION_MS, remainingMilliseconds(deadline))) }); ensureTime();
        if (!response?.ok() || redirects > 3) throw new Error('Navigation did not complete under the public scan policy.');
        // Axe has no cancellation API. The outer deadline closes Chromium,
        // forcing a hanging analysis to reject instead of leaking a browser.
        const axe = await new AxeBuilder({ page }).analyze(); ensureTime();
        for (const violation of axe.violations) for (const node of violation.nodes.slice(0, 25)) {
          if (findings.length >= MAX_FINDINGS) { findingLimitReached = true; break; }
          findings.push(finding(job.id, findings.length + 1, url.pathname || '/', violation, node));
        }
        const links = await page.locator('a[href]').evaluateAll((anchors) => anchors.slice(0, MAX_LINKS_PER_PAGE).map((anchor) => anchor.href));
        for (const link of links) {
          if (queue.length + visited.size >= MAX_DISCOVERED_URLS) break;
          try { const next = await validateTarget(link, target.origin); next.hash = ''; if (!visited.has(next.href) && !queue.includes(next.href)) queue.push(next.href); } catch { /* blocked by policy */ }
        }
        pagesCrawled += 1; visited.add(url.href);
      } catch (error) {
        if (timedOut || error instanceof ScanDeadlineError) throw error;
        recordError(url.href, error instanceof Error ? error.message : 'Page scan failed.');
      } finally { if (!timedOut) await page.close().catch(() => {}); }
    }
  };
  let deadlineTimer;
  const deadlineReached = new Promise((_, reject) => {
    deadlineTimer = setTimeout(() => {
      timedOut = true;
      // Closing Chromium is the practical cancellation primitive for a hung
      // navigation or Axe run. Do not await it before reporting the bounded
      // result; the child process settles asynchronously.
      void browser?.close().catch(() => {});
      reject(new ScanDeadlineError());
    }, MAX_SCAN_MS);
  });
  try { await Promise.race([scan(), deadlineReached]); }
  catch (error) { recordError(target?.href || job.target_url, error instanceof ScanDeadlineError ? 'Scan timed out and the browser was stopped.' : error instanceof Error ? error.message : 'Scanner failed.'); }
  finally {
    clearTimeout(deadlineTimer);
    if (!timedOut) await Promise.race([browser?.close().catch(() => {}), sleep(2_000)]);
  }
  if (findingLimitReached) recordError(target?.href || job.target_url, `Finding capture stopped at the ${MAX_FINDINGS}-finding safety cap; additional automated findings were not retained.`);
  return { status: errors.length ? pagesCrawled ? 'partial' : 'failed' : 'completed', pagesCrawled, findings, errors };
}

async function gateway(path, init = {}) {
  if (!DATA_GATEWAY_URL || !DATA_GATEWAY_TOKEN) throw new Error('DATA_GATEWAY_URL and DATA_GATEWAY_TOKEN are required.');
  const response = await fetch(`${DATA_GATEWAY_URL}${path}`, { ...init, headers: { 'x-easyacr-gateway-token': DATA_GATEWAY_TOKEN, 'content-type': 'application/json', ...(init.headers || {}) }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Data gateway failed (${response.status}).`);
  return response.json();
}
async function workOnce() {
  const claimed = await gateway('/v1/scans/claim-next', { method: 'POST', body: '{}' }); const job = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!job?.id) return false;
  const result = await runScan(job);
  const completion = serializeCompletion(result, job.lease_token);
  await gateway(`/v1/scans/${job.id}/complete`, { method: 'POST', body: JSON.stringify(completion) });
  return true;
}
async function main() {
  let lastPurgeAt = 0;
  while (true) {
    health.running = true; health.lastCycleAt = Date.now();
    try {
      if (Date.now() - lastPurgeAt > 6 * 60 * 60 * 1000) { await gateway('/v1/scans/purge-expired', { method: 'POST', body: '{}' }); lastPurgeAt = Date.now(); }
      if (!await workOnce()) await new Promise((resolve) => setTimeout(resolve, 2_000));
      health.lastSuccessAt = Date.now(); health.lastError = '';
    } catch (error) {
      health.lastError = error instanceof Error ? error.message : 'unknown';
      console.error('[scanner-worker] cycle failed', { message: health.lastError });
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    } finally { health.running = false; }
  }
}
function startHealthServer() {
  createServer((request, response) => {
    if (request.url !== '/healthz') { response.writeHead(404); response.end(); return; }
    const healthy = health.running || Date.now() - health.lastSuccessAt < 180_000;
    response.writeHead(healthy ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ ok: healthy, running: health.running, lastCycleAt: health.lastCycleAt || null }));
  }).listen(HEALTH_PORT, '127.0.0.1');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { startHealthServer(); void main(); }
