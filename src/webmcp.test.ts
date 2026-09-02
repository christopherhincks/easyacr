import { describe, expect, it, vi } from 'vitest';
import {
  createDraftAcrTool,
  createStubbedDraftAcr,
  easyAcrWebMcpTools,
  getScanStatusTool,
  getStubbedScanStatus,
  listAccessibilityIssuesTool,
  listStubbedAccessibilityIssues,
  registerEasyAcrWebMcpTools,
  startAccessibilityScanTool,
  startStubbedAccessibilityScan,
} from './webmcp';

describe('easyACR WebMCP stubs', () => {
  it('returns the running scan state represented by the report screen', () => {
    const result = getStubbedScanStatus();
    expect(result.scan).toMatchObject({
      id: 'SCN-1047',
      status: 'running',
      progress: { evaluatedPages: 78, discoveredPages: 122, percent: 64 },
      findings: { violations: 31, severeIssues: 9, manualReview: 18 },
    });
    expect(Object.values(result.scan.findings.severity).reduce((total, count) => total + count, 0)).toBe(31);
  });

  it('returns the queued scan represented by the supplied scan-wizard screens', () => {
    const result = startStubbedAccessibilityScan();
    expect(result.scan).toMatchObject({
      id: 'SCN-1049',
      status: 'queued',
      target: { url: 'https://app.northstar.example' },
      access: { type: 'public', credentialsPersisted: false },
      scope: { crawlPolicy: 'same-host-only', pageLimit: 200 },
    });
    expect(result.warning).toContain('not certify conformance');
  });

  it('returns the visible issue and manual-review records from the supplied screens', () => {
    const result = listStubbedAccessibilityIssues();
    expect(result.review).toMatchObject({ evaluatedCriteria: 46, totalCriteria: 64, unresolvedManualReviewItems: 14 });
    expect(result.issues.map((issue) => issue.criterion)).toEqual([
      '1.1.1 Non-text Content',
      '2.4.7 Focus Visible',
      '1.4.3 Contrast (Minimum)',
    ]);
    expect(result.issues[2]).toMatchObject({ evidenceState: 'needs-review', conformanceLevel: null });
  });

  it('returns the representative draft configuration from the supplied ACR wizard screens', () => {
    const result = createStubbedDraftAcr();
    expect(result.draft).toMatchObject({
      id: 'northstar-federal',
      status: 'draft',
      evidence: [{ scanId: 'SCN-1048', pages: 184 }],
      template: { edition: 'VPAT 2.5Rev 508' },
      product: { name: 'Northstar Platform 8.4' },
      review: { criteriaNeedingReview: 27, humanReviewRequired: true, conformanceInferredFromMissingEvidence: false },
    });
  });

  it('rejects values outside each narrowly enumerated stub fixture', () => {
    expect(() => getStubbedScanStatus('SCN-9999')).toThrow('Stub scan not found');
    expect(() => startStubbedAccessibilityScan({ url: 'https://example.com' })).toThrow('only supports url');
    expect(() => listStubbedAccessibilityIssues({ scanId: 'SCN-9999' })).toThrow('only supports scanId');
    expect(() => createStubbedDraftAcr({ edition: 'VPAT 2.5Rev EU' })).toThrow('only supports edition');
  });

  it('registers all four tools with appropriate read/write annotations', async () => {
    const registerTool = vi.fn().mockResolvedValue(undefined);
    const target = { modelContext: { registerTool } } as unknown as Document;

    await expect(registerEasyAcrWebMcpTools(target)).resolves.toBe('registered');
    expect(registerTool).toHaveBeenCalledTimes(4);
    expect(easyAcrWebMcpTools.map((tool) => tool.name)).toEqual([
      'get-scan-status',
      'start_accessibility_scan',
      'list_accessibility_issues',
      'create_draft_acr',
    ]);
    expect(startAccessibilityScanTool.annotations?.readOnlyHint).toBe(false);
    expect(createDraftAcrTool.annotations?.readOnlyHint).toBe(false);
    expect(listAccessibilityIssuesTool.annotations?.readOnlyHint).toBe(true);
  });

  it('returns unsupported without inventing a fallback registration', async () => {
    await expect(registerEasyAcrWebMcpTools({} as Document)).resolves.toBe('unsupported');
  });

  it('returns every fixture through its tool callback', async () => {
    await expect(getScanStatusTool.execute()).resolves.toEqual(getStubbedScanStatus());
    await expect(startAccessibilityScanTool.execute()).resolves.toEqual(startStubbedAccessibilityScan());
    await expect(listAccessibilityIssuesTool.execute()).resolves.toEqual(listStubbedAccessibilityIssues());
    await expect(createDraftAcrTool.execute()).resolves.toEqual(createStubbedDraftAcr());
  });
});
