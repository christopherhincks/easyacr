import { describe, expect, it, vi } from 'vitest';
import { getScanStatusTool, getStubbedScanStatus, registerEasyAcrWebMcpTools } from './webmcp';

describe('get-scan-status WebMCP stub', () => {
  it('returns the running scan state represented by the report screen', () => {
    const result = getStubbedScanStatus();

    expect(result.scan).toMatchObject({
      id: 'SCN-1047',
      status: 'running',
      progress: { evaluatedPages: 78, discoveredPages: 122, percent: 64 },
      findings: { violations: 31, severeIssues: 9, manualReview: 18 },
    });
    expect(Object.values(result.scan.findings.severity).reduce((total, count) => total + count, 0)).toBe(31);
    expect(result.scan.evidence.humanReviewRequired).toBe(true);
  });

  it('rejects scan identifiers outside the explicit stub', () => {
    expect(() => getStubbedScanStatus('SCN-9999')).toThrow('Stub scan not found');
  });

  it('registers one read-only tool when WebMCP is supported', async () => {
    const registerTool = vi.fn().mockResolvedValue(undefined);
    const target = { modelContext: { registerTool } } as unknown as Document;

    await expect(registerEasyAcrWebMcpTools(target)).resolves.toBe('registered');
    expect(registerTool).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'get-scan-status', annotations: { readOnlyHint: true, untrustedContentHint: false } }),
      { signal: undefined },
    );
  });

  it('returns unsupported without inventing a fallback registration', async () => {
    await expect(registerEasyAcrWebMcpTools({} as Document)).resolves.toBe('unsupported');
  });

  it('returns the stub through the tool callback', async () => {
    const result = await getScanStatusTool.execute();
    expect(result).toEqual(getStubbedScanStatus());
  });
});
