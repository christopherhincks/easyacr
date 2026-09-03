import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanPublicTargetUrl, createDataGateway } from './index.mjs';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SCAN_ID = '22222222-2222-4222-8222-222222222222';
const ARTIFACT_ID = '33333333-3333-4333-8333-333333333333';
const environment = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  DATA_GATEWAY_TOKEN: 'a-test-data-gateway-token-that-is-long-enough',
};

async function withGateway(fetchFn, run) {
  const server = createDataGateway({ environment, fetchFn });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function request(origin, path, init = {}) {
  return fetch(`${origin}${path}`, { ...init, headers: { 'x-easyacr-gateway-token': environment.DATA_GATEWAY_TOKEN, ...(init.headers || {}) } });
}

test('pure target syntax validation rejects local targets without resolving DNS', () => {
  assert.equal(cleanPublicTargetUrl('https://www.example.org/path'), 'https://www.example.org/path');
  for (const value of ['https://127.0.0.1', 'https://[::1]', 'https://localhost', 'https://api.internal', 'https://www.example.org:8443', 'https://www.example.org/#fragment']) assert.equal(cleanPublicTargetUrl(value), null);
});

test('findings apply severity before pagination and return a stable next cursor', async () => {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/scan_jobs?')) return new Response(JSON.stringify([{ id: SCAN_ID }]));
    if (url.includes('/scan_findings?')) return new Response(JSON.stringify([{ id: 'finding-1', impact: 'serious' }]), { headers: { 'content-range': '0-0/2' } });
    throw new Error(`unexpected upstream call: ${url}`);
  };
  await withGateway(fetchFn, async (origin) => {
    const response = await request(origin, `/v1/scans/${SCAN_ID}/findings?userId=${USER_ID}&severity=serious&cursor=0&limit=1`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { findings: [{ id: 'finding-1', impact: 'serious' }], total: 2, nextCursor: '1' });
  });
  const findingCall = calls.find((call) => call.url.includes('/scan_findings?'));
  assert.match(findingCall.url, /impact=eq\.serious/);
  assert.match(findingCall.url, /offset=0&limit=1/);
  assert.equal(findingCall.init.headers.prefer, 'count=exact');
});

test('creates a durable automated-evidence artifact only through the ownership-enforcing RPC', async () => {
  const calls = [];
  const artifact = {
    id: ARTIFACT_ID, scan_job_id: SCAN_ID, template: 'WCAG_2_2', state: 'automated_draft', created_at: '2026-09-02T18:00:00Z',
    content: { schemaVersion: '1.0', kind: 'automated_scan_evidence', scanId: SCAN_ID, humanReviewRequired: true },
  };
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    assert.match(url, /\/rest\/v1\/rpc\/easyacr_create_draft_evidence$/);
    return new Response(JSON.stringify([artifact]));
  };
  await withGateway(fetchFn, async (origin) => {
    const response = await request(origin, `/v1/scans/${SCAN_ID}/evidence`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: USER_ID, template: 'WCAG_2_2' }) });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { ...artifact.content, artifactId: ARTIFACT_ID, scanId: SCAN_ID, template: 'WCAG_2_2', artifactState: 'automated_draft', createdAt: '2026-09-02T18:00:00Z' });
  });
  assert.deepEqual(JSON.parse(calls[0].init.body), { p_user_id: USER_ID, p_scan_id: SCAN_ID, p_template: 'WCAG_2_2' });
});
