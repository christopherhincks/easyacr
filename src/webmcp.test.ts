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

  it('rejects unknown input properties instead of relying on schema metadata', () => {
    expect(() => startStubbedAccessibilityScan({ unexpected: true })).toThrow('does not support unexpected');
    expect(() => listStubbedAccessibilityIssues({ unexpected: true })).toThrow('does not support unexpected');
    expect(() => createStubbedDraftAcr({ unexpected: true })).toThrow('does not support unexpected');
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

  it('aborts the shared registration controller after a partial registration failure', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const registerTool = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('duplicate tool'));
    const target = { modelContext: { registerTool } } as unknown as Document;
    const registration = new AbortController();

    await expect(registerEasyAcrWebMcpTools(target, registration)).resolves.toBe('failed');
    expect(registerTool).toHaveBeenCalledTimes(2);
    expect(registration.signal.aborted).toBe(true);
    warning.mockRestore();
  });

  it('calls the server-authorized scan API through each production tool', async () => {
    const response = (value: unknown) => ({ ok: true, json: async () => value });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ active: true, webMcpEnabled: true, termsAccepted: true, csrfToken: 'csrf-token' }))
      .mockResolvedValueOnce(response({ scan: { id: 'scan_1', status: 'completed' } }))
      .mockResolvedValueOnce(response({ active: true, webMcpEnabled: true, termsAccepted: true, csrfToken: 'csrf-token' }))
      .mockResolvedValueOnce(response({ scan: { id: 'scan_2', status: 'queued' } }))
      .mockResolvedValueOnce(response({ active: true, webMcpEnabled: true, termsAccepted: true, csrfToken: 'csrf-token' }))
      .mockResolvedValueOnce(response({ scanId: 'scan_1', findings: [] }))
      .mockResolvedValueOnce(response({ active: true, webMcpEnabled: true, termsAccepted: true, csrfToken: 'csrf-token' }))
      .mockResolvedValueOnce(response({ evidence: { scanId: 'scan_1', humanReviewRequired: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getScanStatusTool.execute({ scanId: 'scan_1' })).resolves.toEqual({ scan: { id: 'scan_1', status: 'completed' } });
    await expect(startAccessibilityScanTool.execute({ url: 'https://example.com', pageLimit: 1, authorizationConfirmed: true })).resolves.toEqual({ scan: { id: 'scan_2', status: 'queued' } });
    await expect(listAccessibilityIssuesTool.execute({ scanId: 'scan_1', cursor: '10', limit: 25, severity: 'serious' })).resolves.toEqual({ scanId: 'scan_1', findings: [] });
    await expect(createDraftAcrTool.execute({ scanId: 'scan_1', template: 'WCAG_2_2' })).resolves.toEqual({ evidence: { scanId: 'scan_1', humanReviewRequired: true } });

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/scans/scan_1', expect.objectContaining({ credentials: 'same-origin', headers: expect.objectContaining({ get: expect.any(Function) }) }));
    const scanCall = fetchMock.mock.calls.find(([path]) => path === '/api/v1/scans');
    expect(scanCall?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ url: 'https://example.com', authorizationConfirmed: true, pageLimit: 1 }) });
    expect((scanCall?.[1] as RequestInit).headers as Headers).toBeInstanceOf(Headers);
    expect(((scanCall?.[1] as RequestInit).headers as Headers).get('x-csrf-token')).toBe('csrf-token');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/scans/scan_1/findings?cursor=10&limit=25&severity=serious', expect.objectContaining({ credentials: 'same-origin' }));
    vi.unstubAllGlobals();
  });

  it('requires a target-authorization attestation before starting a scan', async () => {
    await expect(startAccessibilityScanTool.execute({ url: 'https://example.com' })).rejects.toThrow('authorizationConfirmed must be true');
    await expect(startAccessibilityScanTool.execute({ url: 'https://example.com', authorizationConfirmed: false })).rejects.toThrow('authorizationConfirmed must be true');
  });
});
