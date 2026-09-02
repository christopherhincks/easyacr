export type WebMcpRegistrationStatus = 'registered' | 'unsupported' | 'failed';

type ToolInput = { scanId?: string };
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

export const stubbedScanStatus = {
  schemaVersion: '1.0',
  tool: 'get-scan-status',
  mode: 'stub',
  authorization: {
    mode: 'user-mediated',
    scope: 'organization',
    organization: { id: 'northstar-labs', name: 'Northstar Labs' },
    dataClassification: 'Representative fictional prototype data',
  },
  scan: {
    id: 'SCN-1047',
    target: {
      url: 'https://app.northstar.example',
      displayHost: 'app.northstar.example',
    },
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

export function getStubbedScanStatus(scanId = 'SCN-1047') {
  if (scanId !== stubbedScanStatus.scan.id) {
    throw new Error(`Stub scan not found: ${scanId}`);
  }
  return stubbedScanStatus;
}

export const getScanStatusTool: ModelContextTool = {
  name: 'get-scan-status',
  title: 'Get scan status',
  description: 'Returns the current status, progress, findings summary, severity totals, and manual-review warning for the representative easyACR scan SCN-1047. This is a read-only stub and does not query production services.',
  inputSchema: {
    type: 'object',
    properties: {
      scanId: {
        type: 'string',
        enum: ['SCN-1047'],
        description: 'Optional representative scan identifier. Defaults to SCN-1047.',
      },
    },
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: false,
  },
  execute: async (input = {}, options = {}) => {
    if (options.signal?.aborted) throw options.signal.reason;
    return getStubbedScanStatus(input.scanId);
  },
};

export async function registerEasyAcrWebMcpTools(target: Document = document, signal?: AbortSignal): Promise<WebMcpRegistrationStatus> {
  if (!target.modelContext?.registerTool) return 'unsupported';

  try {
    await target.modelContext.registerTool(getScanStatusTool, { signal });
    return 'registered';
  } catch (error) {
    console.warn('easyACR WebMCP tool registration failed.', error);
    return 'failed';
  }
}
