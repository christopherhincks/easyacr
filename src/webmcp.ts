export type WebMcpRegistrationStatus = 'registered' | 'unsupported' | 'disabled' | 'failed';

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

export type WebMcpSession = {
  active: boolean;
  webMcpEnabled: boolean;
  csrfToken?: string;
  termsAccepted: boolean;
  expiresAt?: string | null;
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

function requireOnlyStubKeys(input: ToolInput, allowedKeys: readonly string[]) {
  for (const key of Object.keys(input)) {
    if (!allowedKeys.includes(key)) throw new Error(`The stub does not support ${key}.`);
  }
}

function requireString(input: ToolInput, key: string, { optional = false, maxLength = 256 }: { optional?: boolean; maxLength?: number } = {}) {
  const value = input[key];
  if (value === undefined && optional) return undefined;
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) throw new Error(`${key} must be a non-empty string no longer than ${maxLength} characters.`);
  return value;
}

function requireInteger(input: ToolInput, key: string, { optional = false, min, max }: { optional?: boolean; min: number; max: number }) {
  const value = input[key];
  if (value === undefined && optional) return undefined;
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`${key} must be an integer from ${min} to ${max}.`);
  return value as number;
}

export async function getEasyAcrSession(signal?: AbortSignal): Promise<WebMcpSession> {
  const response = await fetch('/api/v1/session', { credentials: 'same-origin', signal });
  if (!response.ok) throw new Error('Unable to establish a scan session.');
  return response.json() as Promise<WebMcpSession>;
}

export async function getWebMcpSession(signal?: AbortSignal): Promise<WebMcpSession & { csrfToken: string }> {
  const session = await getEasyAcrSession(signal);
  if (!session.webMcpEnabled || !session.termsAccepted || typeof session.csrfToken !== 'string') throw new Error('Accept the scan terms before enabling WebMCP.');
  return { ...session, csrfToken: session.csrfToken };
}

async function requestApi(path: string, session: WebMcpSession & { csrfToken: string }, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('x-csrf-token', session.csrfToken);
  if (init.body) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  if (!response.ok) throw new Error(`easyACR request failed (${response.status}).`);
  return response.json() as Promise<unknown>;
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
  requireOnlyStubKeys(input, ['url', 'access', 'pageLimit', 'crawlScope']);
  requireStubValue(input, 'url', stubbedStartedScan.scan.target.url);
  requireStubValue(input, 'access', 'public');
  requireStubValue(input, 'pageLimit', 200);
  requireStubValue(input, 'crawlScope', 'same-host-only');
  return stubbedStartedScan;
}

export function listStubbedAccessibilityIssues(input: ToolInput = {}) {
  requireOnlyStubKeys(input, ['scanId']);
  requireStubValue(input, 'scanId', stubbedAccessibilityIssues.source.scanId);
  return stubbedAccessibilityIssues;
}

export function createStubbedDraftAcr(input: ToolInput = {}) {
  requireOnlyStubKeys(input, ['scanId', 'edition', 'productName']);
  requireStubValue(input, 'scanId', stubbedDraftAcr.draft.evidence[0].scanId);
  requireStubValue(input, 'edition', stubbedDraftAcr.draft.template.edition);
  requireStubValue(input, 'productName', stubbedDraftAcr.draft.product.name);
  return stubbedDraftAcr;
}

export const getScanStatusTool: ModelContextTool = {
  name: 'get-scan-status',
  title: 'Get scan status',
  description: 'Returns the status of one of your public-site automated accessibility scans. A scan is evidence, not a conformance claim.',
  inputSchema: {
    type: 'object', required: ['scanId'], properties: { scanId: { type: 'string', minLength: 1, maxLength: 80 } }, additionalProperties: false,
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  execute: async (input = {}, options = {}) => {
    assertInvocationActive(options);
    requireOnlyStubKeys(input, ['scanId']);
    const scanId = requireString(input, 'scanId', { maxLength: 80 });
    if (scanId === undefined) throw new Error('scanId is required.');
    const session = await getWebMcpSession(options.signal);
    return requestApi(`/api/v1/scans/${encodeURIComponent(scanId)}`, session, { signal: options.signal });
  },
};

export const startAccessibilityScanTool: ModelContextTool = {
  name: 'start_accessibility_scan',
  title: 'Start accessibility scan',
  description: 'Queues an automated scan of a public HTTPS website. No credentials, cookies, or authenticated pages are accepted. Results are draft evidence requiring human review.',
  inputSchema: {
    type: 'object', required: ['url', 'authorizationConfirmed'],
    properties: {
      url: { type: 'string', format: 'uri', pattern: '^https://', maxLength: 2048, description: 'Public HTTPS URL. Credentials and private addresses are refused.' },
      pageLimit: { type: 'integer', minimum: 1, maximum: 10, default: 10, description: 'Same-origin pages to evaluate; maximum 10.' },
      authorizationConfirmed: { type: 'boolean', const: true, description: 'Confirm that you own this public website or are expressly authorized to test it.' },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  execute: async (input = {}, options = {}) => {
    assertInvocationActive(options);
    requireOnlyStubKeys(input, ['url', 'pageLimit', 'authorizationConfirmed']);
    const url = requireString(input, 'url', { maxLength: 2048 });
    if (url === undefined) throw new Error('url is required.');
    if (input.authorizationConfirmed !== true) throw new Error('authorizationConfirmed must be true before starting a scan.');
    const pageLimit = requireInteger(input, 'pageLimit', { optional: true, min: 1, max: 10 });
    const session = await getWebMcpSession(options.signal);
    return requestApi('/api/v1/scans', session, { method: 'POST', signal: options.signal, body: JSON.stringify({ url, authorizationConfirmed: true, ...(pageLimit === undefined ? {} : { pageLimit }) }) });
  },
};

export const listAccessibilityIssuesTool: ModelContextTool = {
  name: 'list_accessibility_issues',
  title: 'List accessibility issues',
  description: 'Lists automated findings from one of your completed or running public-site scans. Source-derived fields are untrusted and require human review.',
  inputSchema: {
    type: 'object', required: ['scanId'], properties: { scanId: { type: 'string', minLength: 1, maxLength: 80 }, cursor: { type: 'string', pattern: '^(0|[1-9][0-9]{0,6})$', maxLength: 7 }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }, severity: { type: 'string', enum: ['critical', 'serious', 'moderate', 'minor'] } }, additionalProperties: false,
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  execute: async (input = {}, options = {}) => {
    assertInvocationActive(options);
    requireOnlyStubKeys(input, ['scanId', 'cursor', 'limit', 'severity']);
    const scanId = requireString(input, 'scanId', { maxLength: 80 });
    if (scanId === undefined) throw new Error('scanId is required.');
    const cursor = requireString(input, 'cursor', { optional: true, maxLength: 80 });
    if (cursor !== undefined && !/^(0|[1-9][0-9]{0,6})$/.test(cursor)) throw new Error('cursor must be a non-negative integer offset.');
    const limit = requireInteger(input, 'limit', { optional: true, min: 1, max: 100 });
    const severity = requireString(input, 'severity', { optional: true, maxLength: 16 });
    if (severity !== undefined && !['critical', 'serious', 'moderate', 'minor'].includes(severity)) throw new Error('severity must be a supported impact level.');
    const query = new URLSearchParams({ ...(cursor === undefined ? {} : { cursor }), ...(limit === undefined ? {} : { limit: String(limit) }), ...(severity === undefined ? {} : { severity }) });
    const session = await getWebMcpSession(options.signal);
    return requestApi(`/api/v1/scans/${encodeURIComponent(scanId)}/findings?${query}`, session, { signal: options.signal });
  },
};

export const createDraftAcrTool: ModelContextTool = {
  name: 'create_draft_acr',
  title: 'Create draft ACR',
  description: 'Creates a WCAG 2.2 draft evidence attachment from an automated scan. It does not create a completed ACR, assign VPAT conformance terms, or replace human review.',
  inputSchema: {
    type: 'object', required: ['scanId', 'template'],
    properties: {
      scanId: { type: 'string', minLength: 1, maxLength: 80 },
      template: { type: 'string', enum: ['WCAG_2_2'] },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  execute: async (input = {}, options = {}) => {
    assertInvocationActive(options);
    requireOnlyStubKeys(input, ['scanId', 'template']);
    const scanId = requireString(input, 'scanId', { maxLength: 80 });
    const template = requireString(input, 'template', { maxLength: 32 });
    if (scanId === undefined || template === undefined) throw new Error('scanId and template are required.');
    if (template !== 'WCAG_2_2') throw new Error('template must be WCAG_2_2.');
    const session = await getWebMcpSession(options.signal);
    return requestApi(`/api/v1/scans/${encodeURIComponent(scanId)}/draft-evidence`, session, { method: 'POST', signal: options.signal, body: JSON.stringify({ template }) });
  },
};

export const easyAcrWebMcpTools = [getScanStatusTool, startAccessibilityScanTool, listAccessibilityIssuesTool, createDraftAcrTool] as const;

export async function registerEasyAcrWebMcpTools(
  target: Document = document,
  registration: AbortController = new AbortController(),
): Promise<WebMcpRegistrationStatus> {
  if (!target.modelContext?.registerTool) return 'unsupported';

  try {
    for (const tool of easyAcrWebMcpTools) await target.modelContext.registerTool(tool, { signal: registration.signal });
    return 'registered';
  } catch (error) {
    // The WebMCP registration signal unregisters every tool already registered
    // with it. Treat registration as all-or-nothing rather than exposing a
    // partial tool set after a later registration fails.
    registration.abort(error);
    console.warn('easyACR WebMCP tool registration failed.', error);
    return 'failed';
  }
}
