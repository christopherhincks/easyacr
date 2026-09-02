import { describe, expect, it } from 'vitest';
import { acrs, adapters, entitlements, issues } from './domain';

describe('central entitlement policy', () => {
  it('allows only the customer administrator to manage the organization', () => {
    expect(entitlements.admin.organization).toBe(true);
    expect(Object.entries(entitlements).filter(([role]) => role !== 'admin').every(([, policy]) => !policy.organization)).toBe(true);
  });

  it('keeps WebMCP behind a paid entitlement', () => {
    expect(entitlements.visitor.webMcp).toBe(false);
    expect(entitlements.free.webMcp).toBe(false);
    expect(entitlements.trial.webMcp).toBe(false);
    expect(entitlements.paid.webMcp).toBe(true);
  });
});

describe('representative evidence', () => {
  it('labels automatic and manual evidence explicitly', () => {
    expect(new Set(issues.map((issue) => issue.kind))).toEqual(new Set(['Automatic', 'Manual verification']));
  });

  it('keeps ACR artifacts labeled as drafts', () => {
    expect(acrs.every((acr) => ['Draft', 'Human review'].includes(acr.status))).toBe(true);
  });

  it('exposes only honest mock adapters', () => {
    expect(adapters.every((adapter) => adapter.mode === 'mock')).toBe(true);
  });
});
