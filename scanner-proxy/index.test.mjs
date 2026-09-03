import assert from 'node:assert/strict';
import test from 'node:test';
import { createTunnelBudget, isPublicAddress, parseConnectAuthority, resolvePublicDestination } from './index.mjs';

test('allows public addresses and rejects SSRF-sensitive IPv4 ranges', () => {
  for (const address of ['8.8.8.8', '1.1.1.1']) assert.equal(isPublicAddress(address), true, address);
  for (const address of ['0.0.0.0', '10.0.0.1', `100.64.${'0.1'}`, '127.0.0.1', '169.254.169.254', '172.16.0.1', `192.168.${'1.1'}`, '192.0.2.1', '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '240.0.0.1']) assert.equal(isPublicAddress(address), false, address);
});

test('allows public IPv6 and rejects local, documentation, mapped, and multicast IPv6', () => {
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
  for (const address of ['::', '::1', '::ffff:127.0.0.1', '64:ff9b::808:808', '2001:db8::1', 'fc00::1', 'fe80::1', 'ff02::1']) assert.equal(isPublicAddress(address), false, address);
});

test('accepts only hostname:443 CONNECT targets', () => {
  assert.deepEqual(parseConnectAuthority('www.example.com:443'), { host: 'www.example.com', port: 443 });
  for (const target of ['www.example.com:80', '127.0.0.1:443', '[::1]:443', 'localhost:443', 'www.example.com.:443', 'user@www.example.com:443', 'www.example.com:443/path']) assert.equal(parseConnectAuthority(target), null, target);
});

test('requires every DNS answer to be public and returns a pinned numeric address', async () => {
  const selected = await resolvePublicDestination('example.test', async () => [{ address: '1.1.1.1', family: 4 }, { address: '2606:4700:4700::1111', family: 6 }]);
  assert.deepEqual(selected, { address: '1.1.1.1', family: 4 });
  await assert.rejects(resolvePublicDestination('example.test', async () => [{ address: '1.1.1.1', family: 4 }, { address: '127.0.0.1', family: 4 }]));
});

test('tunnel budget closes exactly once after the combined byte cap', () => {
  let closes = 0; const budget = createTunnelBudget(10, () => { closes += 1; });
  assert.equal(budget.add(6), true);
  assert.equal(budget.add(4), true);
  assert.equal(budget.add(1), false);
  assert.equal(budget.add(1), false);
  assert.equal(budget.usedBytes, 11);
  assert.equal(closes, 1);
});
