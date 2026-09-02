export type WebMcpRegistrationStatus = 'registered' | 'unsupported' | 'failed';

type ToolInput = Record<string, unknown>;
type ToolExecutionOptions = { signal?: AbortSignal };

type ModelContextTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input?: ToolInput, options?: ToolExecutionOptions) => Promise<unknown>;
};

type ModelContext = {
  registerTool: (tool: ModelContextTool, options?: { signal?: AbortSignal; exposedTo?: string[] }) => Promise<void>;
};

declare global {
  interface Document {
    readonly modelContext?: ModelContext;
  }
}

const authorization = {
  mode: 'user-mediated',
  scope: 'organization',
  organization: { id: 'northstar-labs', name: 'Northstar Labs' },
  dataClassification: 'Representative fictional prototype data',
} as const;

function assertInvocationActive(options: ToolExecutionOptions) {
  if (options.signal?.aborted) throw options.signal.reason;
}

function requireStubValue(input: ToolInput, key: string, expected: unknown) {
  if (input[key] !== undefined && input[key] !== expected) {
    throw new Error(`The stub only supports ${key}=${JSON.stringify(expected)}.`);
  }
}

export const stubbedScanStatus = {
  schemaVersion: '1.0',
  tool: 'get-scan-status',
  mode: 'stub',
  authorization,
  scan: {
    id: 'SCN-1047',
    target: { url: 'https://app.northstar.example', displayHost: 'app.northstar.example' },
    status: 'running',
    startedAt: '2026-09-01T13:08:00-05:00',
    startedDisplay: 'Sep 1, 2026 at 1:08 PM CDT',
    progress: {
      evaluatedPages: 78,
      discoveredPages: 122,
      percent: 64,
      currentPath: '/account/team',
      message: 'Currently evaluating /account/team. 31 violations found so far; results may change until completion.',
    },
    findings: {
      violations: 31,
      changeFromPriorScan: 4,
      severeIssues: 9,
      manualReview: 18,
      severity: { critical: 3, serious: 6, moderate: 14, minor: 8 },
      interpretation: 'The current automatic findings show focus visibility and text-alternative risks across account and analytics workflows.',
    },
    evidence: {
      state: 'partial',
      humanReviewRequired: true,
      warning: 'The crawl is still running and 18 criteria need manual verification. Do not use these totals as a conformance claim.',
    },
    reportPath: '/scans/SCN-1047',
  },
  summary: 'SCN-1047 is running at 64%: 78 of 122 discovered pages evaluated, 31 violations found, 9 severe issues, and 18 criteria requiring manual review.',
} as const;

export const stubbedStartedScan = {
  schemaVersion: '1.0',
  tool: 'start_accessibility_scan',
  mode: 'stub',
  authorization,
  scan: {
    id: 'SCN-1049',
    target: { url: 'https://app.northstar.example', displayHost: 'app.northstar.example' },
    status: 'queued',
    access: { type: 'public', credentialsAccepted: false, credentialsPersisted: false },
    scope: { crawlPolicy: 'same-host-only', pageLimit: 200, includePaths: [], excludePaths: ['/logout', '/admin/**'] },
    scheduleAfterFirstRun: false,
    reportPath: '/scans/SCN-1049',
  },
  accepted: true,
  warning: 'This scan will not certify conformance. Automatic findings remain separate from manual verification needs.',
  summary: 'SCN-1049 is queued for app.northstar.example with public access, same-host crawling, and a 200-page limit.',
} as const;

export const stubbedAccessibilityIssues = {
  schemaVersion: '1.0',
  tool: 'list_accessibility_issues',
  mode: 'stub',
  authorization,
  source: {
    scanId: 'SCN-1047',
    draftId: 'northstar-federal',
    draftName: 'Northstar Platform — Federal 2026',
    draftVersion: 'v0.7',
    template: 'VPAT 2.5Rev 508',
  },
  review: { evaluatedCriteria: 46, totalCriteria: 64, unresolvedManualReviewItems: 14, reviewedExportAvailable: false },
  pagination: { returned: 3, totalIssues: 31, nextCursor: 'stub-page-2' },
  issues: [
    {
      id: 'ISS-111-NON-TEXT', severity: 'critical', criterion: '1.1.1 Non-text Content', page: '/products/analytics',
      element: 'img.product-chart', title: 'Chart image has no text alternative', evidenceState: 'mapped',
      conformanceLevel: 'Supports', remarks: 'Add a concise alt description and link to the equivalent data table.', evidenceType: 'automatic',
    },
    {
      id: 'ISS-247-FOCUS', severity: 'serious', criterion: '2.4.7 Focus Visible', page: '/account/billing',
      element: 'button.save-card', title: 'Keyboard focus is not visible', evidenceState: 'mapped',
      conformanceLevel: 'Partially Supports', remarks: 'Use the product focus ring and do not remove the browser outline without a replacement.', evidenceType: 'automatic',
    },
    {
      id: 'ISS-143-CONTRAST', severity: 'moderate', criterion: '1.4.3 Contrast (Minimum)', page: '/account',
      element: '.meta-label', title: 'Manual contrast and zoom review is pending', evidenceState: 'needs-review',
      conformanceLevel: null, remarks: 'Manual contrast and zoom review is pending for the account workflow.', evidenceType: 'manual-verification',
    },
  ],
  warning: 'A reviewed export remains unavailable until every criterion has an allowed template term and supporting explanation.',
} as const;

export const stubbedDraftAcr = {
  schemaVersion: '1.0',
  tool: 'create_draft_acr',
  mode: 'stub',
  authorization,
  draft: {
    id: 'northstar-federal',
    name: 'Northstar Platform — Federal 2026',
    status: 'draft',
    version: 'v0.1',
    evidence: [{ scanId: 'SCN-1048', site: 'docs.northstar.example', pages: 184, state: 'completed' }],
    template: { market: 'US federal procurement', edition: 'VPAT 2.5Rev 508' },
    product: {
      name: 'Northstar Platform 8.4',
      description: 'Cloud analytics and reporting platform for distributed operations teams.',
      evaluationMethods: 'Automated scanning, manual keyboard review, screen reader testing, contrast analysis, and product-team interviews.',
    },
    review: { criteriaNeedingReview: 27, humanReviewRequired: true, conformanceInferredFromMissingEvidence: false },
    editorPath: '/acrs/northstar-federal',
  },
  created: true,
  warning: 'No conformance result was inferred where scan evidence is missing or inconclusive.',
  summary: 'Created a VPAT 2.5Rev 508 draft for Northstar Platform 8.4 from SCN-1048; 27 criteria require human review.',
} as const;

export function getStubbedScanStatus(scanId = 'SCN-1047') {
  if (scanId !== stubbedScanStatus.scan.id) throw new Error(`Stub scan not found: ${scanId}`);
  return stubbedScanStatus;
}

export function startStubbedAccessibilityScan(input: ToolInput = {}) {
  requireStubValue(input, 'url', stubbedStartedScan.scan.target.url);
  requireStubValue(input, 'access', 'public');
  requireStubValue(input, 'pageLimit', 200);
  requireStubValue(input, 'crawlScope', 'same-host-only');
  return stubbedStartedScan;
}

export function listStubbedAccessibilityIssues(input: ToolInput = {}) {
  requireStubValue(input, 'scanId', stubbedAccessibilityIssues.source.scanId);
  return stubbedAccessibilityIssues;
}

export function createStubbedDraftAcr(input: ToolInput = {}) {
  requireStubValue(input, 'scanId', stubbedDraftAcr.draft.evidence[0].scanId);
  requireStubValue(input, 'edition', stubbedDraftAcr.draft.template.edition);
  requireStubValue(input, 'productName', stubbedDraftAcr.draft.product.name);
  return stubbedDraftAcr;
}

export const getScanStatusTool: ModelContextTool = {
  name: 'get-scan-status',
  title: 'Get scan status',
  description: 'Returns the representative running status for easyACR scan SCN-1047. This read-only stub does not query production services.',
  inputSchema: {
    type: 'object', properties: { scanId: { type: 'string', enum: ['SCN-1047'], description: 'Defaults to SCN-1047.' } }, additionalProperties: false,
  },
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  execute: async (input = {}, options = {}) => {
    assertInvocationActive(options);
    return getStubbedScanStatus(input.scanId as string | undefined);
  },
};

export const startAccessibilityScanTool: ModelContextTool = {
  name: 'start_accessibility_scan',
  title: 'Start accessibility scan',
  description: 'Queues the representative public scan configuration shown in the easyACR scan wizard. This is a deterministic stub and starts no real crawler.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', enum: ['https://app.northstar.example'], description: 'Defaults to the representative Northstar application.' },
      access: { type: 'string', enum: ['public'], description: 'Credentials are never accepted by this stub.' },
      pageLimit: { type: 'integer', enum: [200], description: 'Defaults to 200 pages.' },
      crawlScope: { type: 'string', enum: ['same-host-only'], description: 'Defaults to same-host-only.' },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  execute: async (input = {}, options = {}) => {
    assertInvocationActive(options);
    return startStubbedAccessibilityScan(input);
  },
};

export const listAccessibilityIssuesTool: ModelContextTool = {
  name: 'list_accessibility_issues',
  title: 'List accessibility issues',
  description: 'Returns the representative issue and criterion-review records shown in the supplied easyACR screens. This read-only stub does not query production services.',
  inputSchema: {
    type: 'object', properties: { scanId: { type: 'string', enum: ['SCN-1047'], description: 'Defaults to SCN-1047.' } }, additionalProperties: false,
  },
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  execute: async (input = {}, options = {}) => {
    assertInvocationActive(options);
    return listStubbedAccessibilityIssues(input);
  },
};

export const createDraftAcrTool: ModelContextTool = {
  name: 'create_draft_acr',
  title: 'Create draft ACR',
  description: 'Creates the representative Northstar Platform 8.4 draft configuration shown in the supplied easyACR screens. This stub persists no data and never creates a reviewed conformance claim.',
  inputSchema: {
    type: 'object',
    properties: {
      scanId: { type: 'string', enum: ['SCN-1048'], description: 'Defaults to the completed 184-page evidence scan.' },
      edition: { type: 'string', enum: ['VPAT 2.5Rev 508'], description: 'Defaults to the US federal procurement template.' },
      productName: { type: 'string', enum: ['Northstar Platform 8.4'], description: 'Defaults to the representative product.' },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  execute: async (input = {}, options = {}) => {
    assertInvocationActive(options);
    return createStubbedDraftAcr(input);
  },
};

export const easyAcrWebMcpTools = [getScanStatusTool, startAccessibilityScanTool, listAccessibilityIssuesTool, createDraftAcrTool] as const;

export async function registerEasyAcrWebMcpTools(target: Document = document, signal?: AbortSignal): Promise<WebMcpRegistrationStatus> {
  if (!target.modelContext?.registerTool) return 'unsupported';

  try {
    for (const tool of easyAcrWebMcpTools) await target.modelContext.registerTool(tool, { signal });
    return 'registered';
  } catch (error) {
    console.warn('easyACR WebMCP tool registration failed.', error);
    return 'failed';
  }
}
