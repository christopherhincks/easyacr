import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeCompletion } from './index.mjs';

const leaseToken = '11111111-1111-4111-8111-111111111111';
const finding = (index) => ({
  page: `/page-${index}`, ruleId: `rule-${index}`, impact: 'serious', help: 'h'.repeat(500), helpUrl: `https://example.test/rule/${index}`,
  target: ['.selector'.repeat(60)], failureSummary: 'f'.repeat(1_000), source: 'automated', untrustedContent: true,
});

test('completion serialization preserves an ordinary result', () => {
  const payload = serializeCompletion({ status: 'completed', pagesCrawled: 1, findings: [finding(1)], errors: [] }, leaseToken);
  assert.equal(payload.status, 'completed');
  assert.equal(payload.findings.length, 1);
  assert.deepEqual(payload.errors, []);
});

test('completion serialization remains below the gateway intake and discloses omissions', () => {
  const source = { status: 'completed', pagesCrawled: 10, findings: Array.from({ length: 500 }, (_, index) => finding(index)), errors: Array.from({ length: 20 }, () => ({ page: '/', message: 'e'.repeat(500) })) };
  const maximumBytes = 12 * 1024;
  const payload = serializeCompletion(source, leaseToken, maximumBytes);
  assert.ok(Buffer.byteLength(JSON.stringify(payload)) <= maximumBytes);
  assert.equal(payload.status, 'partial');
  const notice = payload.errors.at(-1)?.message || '';
  assert.match(notice, /Result capture\/delivery truncated/);
  assert.match(notice, new RegExp(`of ${source.findings.length} findings`));
  assert.ok(payload.findings.length < source.findings.length);
});

test('completion serialization discloses record-cap omissions even when bytes fit', () => {
  const source = { status: 'completed', pagesCrawled: 1, findings: Array.from({ length: 501 }, (_, index) => ({ page: '/', ruleId: String(index), impact: 'minor', help: 'x', helpUrl: '', target: [] })), errors: [] };
  const payload = serializeCompletion(source, leaseToken);
  assert.equal(payload.status, 'partial');
  assert.equal(payload.findings.length, 500);
  assert.match(payload.errors.at(-1)?.message || '', /stored 500 of 501 findings/);
});
