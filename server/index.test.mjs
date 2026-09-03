import assert from 'node:assert/strict';
import test from 'node:test';

// Configure before importing the service; its launch configuration is read
// once so production cannot be weakened by a later request.
process.env.EASYACR_BETA_INVITE_TOKEN = 'test-invite-token';
process.env.SESSION_HMAC_SECRET = 'test-session-secret';
process.env.EASYACR_ALLOW_LOCAL_INVITE_DEMO = 'true';
delete process.env.SCAN_EGRESS_PROXY;

const { createApp, validatePublicTargetSyntax } = await import('./index.mjs');

async function withServer(run) {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('requires an invitation before it issues a scan session', async () => {
  await withServer(async (origin) => {
    const denied = await fetch(`${origin}/api/v1/session`, { method: 'POST' });
    assert.equal(denied.status, 401);

    const allowed = await fetch(`${origin}/api/v1/session`, { method: 'POST', headers: { 'x-easyacr-invite': 'test-invite-token', 'x-easyacr-terms-version': '2026-09-02' } });
    assert.equal(allowed.status, 201);
    const body = await allowed.json();
    assert.equal(body.webMcpEnabled, true);
    assert.equal(typeof body.csrfToken, 'string');
    assert.match(allowed.headers.get('set-cookie') || '', /HttpOnly/);

    const cookie = allowed.headers.get('set-cookie')?.split(';')[0];
    const revoke = await fetch(`${origin}/api/v1/session/revoke`, { method: 'POST', headers: { cookie, 'x-csrf-token': body.csrfToken } });
    assert.equal(revoke.status, 200);
    assert.equal((await revoke.json()).revoked, true);
    const status = await fetch(`${origin}/api/v1/session`, { headers: { cookie } });
    assert.equal((await status.json()).active, false);
  });
});

test('keeps the browser connection policy on SPA fallback routes', async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/tools`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy') || '', /connect-src 'self'/);
  });
});

test('fails closed when no controlled egress proxy is configured', async () => {
  await withServer(async (origin) => {
    const session = await fetch(`${origin}/api/v1/session`, { method: 'POST', headers: { 'x-easyacr-invite': 'test-invite-token', 'x-easyacr-terms-version': '2026-09-02' } });
    const cookie = session.headers.get('set-cookie')?.split(';')[0];
    const { csrfToken } = await session.json();
    const scan = await fetch(`${origin}/api/v1/scans`, {
      method: 'POST',
      headers: { cookie, 'x-csrf-token': csrfToken, 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', pageLimit: 1, authorizationConfirmed: true }),
    });
    assert.equal(scan.status, 503);
    assert.equal((await scan.json()).error.code, 'SCANNING_DISABLED');
  });
});

test('rejects unsafe durable target syntax without performing DNS', () => {
  assert.equal(validatePublicTargetSyntax('https://www.example.org/path').href, 'https://www.example.org/path');
  for (const target of ['http://www.example.org', 'https://127.0.0.1', 'https://[::1]', 'https://localhost', 'https://service.internal', 'https://www.example.org:8443', 'https://user:pass@www.example.org', 'https://www.example.org/#fragment']) {
    assert.throws(() => validatePublicTargetSyntax(target));
  }
});
