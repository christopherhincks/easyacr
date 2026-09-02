export type Role = 'visitor' | 'free' | 'trial' | 'paid' | 'admin';
export type ScanStatus = 'queued' | 'running' | 'partial' | 'completed' | 'canceled' | 'failed';
export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';
export type EvidenceKind = 'Automatic' | 'Manual verification';

export interface Entitlements {
  app: boolean;
  scan: boolean;
  schedule: boolean;
  acr: boolean;
  webMcp: boolean;
  billing: boolean;
  organization: boolean;
  pageLimit: number;
}

export const roleLabels: Record<Role, string> = {
  visitor: 'Visitor',
  free: 'Registered · no plan',
  trial: 'Trial · 3 days left',
  paid: 'Paid member',
  admin: 'Organization admin',
};

export const entitlements: Record<Role, Entitlements> = {
  visitor: { app: false, scan: false, schedule: false, acr: false, webMcp: false, billing: false, organization: false, pageLimit: 0 },
  free: { app: true, scan: false, schedule: false, acr: false, webMcp: false, billing: true, organization: false, pageLimit: 0 },
  trial: { app: true, scan: true, schedule: false, acr: true, webMcp: false, billing: true, organization: false, pageLimit: 25 },
  paid: { app: true, scan: true, schedule: true, acr: true, webMcp: true, billing: true, organization: false, pageLimit: 500 },
  admin: { app: true, scan: true, schedule: true, acr: true, webMcp: true, billing: true, organization: true, pageLimit: 2500 },
};

export const draftPlans = [
  { name: 'Starter', price: '$79', note: 'Draft assumption', pages: '500 pages / month', features: ['On-demand scans', 'Draft WCAG ACRs', '90-day history'] },
  { name: 'Team', price: '$199', note: 'Draft assumption', pages: '2,500 pages / month', features: ['Scheduled scans', 'All VPAT 2.5Rev editions', 'WebMCP access', '5 seats'], featured: true },
  { name: 'Organization', price: '$499', note: 'Draft assumption', pages: '10,000 pages / month', features: ['25 seats', 'Organization controls', 'Priority support', 'Audit events'] },
];

export const scans = [
  { id: 'SCN-1048', site: 'docs.northstar.example', status: 'completed' as ScanStatus, pages: 184, violations: 12, severe: 2, date: 'Aug 31, 2026 · 9:42 AM', duration: '8m 14s', trend: -18 },
  { id: 'SCN-1047', site: 'app.northstar.example', status: 'running' as ScanStatus, pages: 78, violations: 31, severe: 9, date: 'Sep 1, 2026 · 1:08 PM', duration: '4m 07s', trend: 4, progress: 64 },
  { id: 'SCN-1046', site: 'status.northstar.example', status: 'partial' as ScanStatus, pages: 42, violations: 5, severe: 0, date: 'Aug 28, 2026 · 4:17 PM', duration: '3m 52s', trend: 0 },
  { id: 'SCN-1045', site: 'legacy.northstar.example', status: 'failed' as ScanStatus, pages: 9, violations: 47, severe: 18, date: 'Aug 26, 2026 · 11:03 AM', duration: '1m 20s', trend: 11 },
];

export const issues = [
  { severity: 'critical' as Severity, criterion: '1.1.1 Non-text Content', page: '/products/analytics', element: 'img.product-chart', title: 'Chart image has no text alternative', excerpt: '<img src="chart-q3.svg">', explanation: 'People using a screen reader cannot learn what the chart communicates.', fix: 'Add a concise alt description and link to the equivalent data table.', kind: 'Automatic' as EvidenceKind },
  { severity: 'serious' as Severity, criterion: '2.4.7 Focus Visible', page: '/account/billing', element: 'button.save-card', title: 'Keyboard focus is not visible', excerpt: 'outline: none;', explanation: 'Keyboard users can lose track of their position on the page.', fix: 'Use the product focus ring and do not remove the browser outline without a replacement.', kind: 'Automatic' as EvidenceKind },
  { severity: 'moderate' as Severity, criterion: '1.4.3 Contrast (Minimum)', page: '/docs/getting-started', element: '.meta-label', title: 'Text contrast is below 4.5:1', excerpt: 'color: #999; background: #fff;', explanation: 'Low-contrast text can be difficult to read for people with low vision.', fix: 'Use the mapped secondary body text token or a darker value.', kind: 'Automatic' as EvidenceKind },
  { severity: 'minor' as Severity, criterion: '3.2.4 Consistent Identification', page: '/settings/profile', element: 'button[aria-label="Preferences"]', title: 'Control naming needs human review', excerpt: 'aria-label="Preferences"', explanation: 'Equivalent controls may use different names across the product.', fix: 'Review comparable settings controls and use consistent visible and accessible names.', kind: 'Manual verification' as EvidenceKind },
];

export const schedules = [
  { name: 'Production weekly', site: 'app.northstar.example', cadence: 'Every Monday · 8:00 AM', next: 'Sep 7, 2026 · 8:00 AM CDT', state: 'Active' },
  { name: 'Docs release check', site: 'docs.northstar.example', cadence: 'First day monthly · 6:30 AM', next: 'Oct 1, 2026 · 6:30 AM CDT', state: 'Active' },
  { name: 'Legacy migration', site: 'legacy.northstar.example', cadence: 'Every Friday · 5:00 PM', next: 'Paused', state: 'Paused' },
];

export const acrs = [
  { name: 'Northstar Platform — Federal 2026', edition: 'VPAT 2.5Rev 508', version: 'v0.7', updated: 'Aug 30, 2026', review: 14, status: 'Draft' },
  { name: 'Northstar Analytics — EU', edition: 'VPAT 2.5Rev EU', version: 'v1.2', updated: 'Aug 22, 2026', review: 3, status: 'Human review' },
  { name: 'Developer Portal', edition: 'VPAT 2.5Rev WCAG', version: 'v0.3', updated: 'Aug 19, 2026', review: 28, status: 'Draft' },
];

export const deadlines = [
  { market: 'United States', title: 'ADA Title II — larger public entities', date: 'Apr 26, 2027', detail: 'Current interim final rule compliance date. Requirements and exceptions depend on the entity and content.', source: 'https://www.ada.gov/title-ii-web-rule/', verified: 'Sep 1, 2026' },
  { market: 'United States', title: 'ADA Title II — smaller entities and special districts', date: 'Apr 26, 2028', detail: 'Current interim final rule compliance date. Confirm applicability with counsel.', source: 'https://www.ada.gov/title-ii-web-rule/', verified: 'Sep 1, 2026' },
  { market: 'European Union', title: 'European Accessibility Act requirements', date: 'In effect since Jun 28, 2025', detail: 'Coverage, transition rules, and member-state implementation vary by product and service.', source: 'https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/union-equality-strategy-rights-persons-disabilities-2021-2030/european-accessibility-act_en', verified: 'Sep 1, 2026' },
];

export interface ServiceAdapter {
  mode: 'mock';
  name: string;
  boundary: string;
}

export const adapters: ServiceAdapter[] = [
  { mode: 'mock', name: 'Authentication', boundary: 'Session provider and organization membership' },
  { mode: 'mock', name: 'Payments', boundary: 'Checkout, subscriptions, invoices, and webhooks' },
  { mode: 'mock', name: 'Scanner', boundary: 'Server URL policy, isolated crawl worker, and result ingestion' },
  { mode: 'mock', name: 'Scheduler', boundary: 'Durable job definitions, timezone handling, and retry policy' },
  { mode: 'mock', name: 'ACR generator', boundary: 'VPAT template versioning, evidence mapping, documents, and review workflow' },
  { mode: 'mock', name: 'WebMCP', boundary: 'Experimental browser tool registration behind feature detection and explicit authorization' },
];
