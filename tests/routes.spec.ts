import { expect, test } from '@playwright/test';

const publicRoutes = ['/', '/tools', '/scans', '/account', '/terms', '/privacy', '/acceptable-use'];
const deferredRoutes = ['/features', '/pricing', '/about', '/sign-up', '/sign-in', '/password-recovery', '/checkout/success', '/onboarding', '/dashboard', '/scans/new', '/schedules', '/acrs', '/acrs/new', '/acrs/northstar-federal', '/billing', '/organization'];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('easyacr-theme', 'light'));
});

for (const route of publicRoutes) {
  test(`${route} renders the public beta shell`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Tools' })).toHaveAttribute('href', '/tools');
    await expect(page.locator('body')).not.toContainText('Northstar');
  });
}

for (const route of deferredRoutes) {
  test(`${route} is unavailable instead of exposing a mock workflow`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: 'Page unavailable' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open tools' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Demo role');
  });
}

test('landing primary calls to action both lead to Tools', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Open WebMCP tools/ })).toHaveAttribute('href', '/tools');
  await expect(page.getByRole('link', { name: 'Start scan beta' })).toHaveAttribute('href', '/tools');
});

test('account entry presents one accessible account control for an active scan session', async ({ page }) => {
  await page.route('**/api/v1/session', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ active: true, webMcpEnabled: true, termsAccepted: true, csrfToken: 'csrf-token' }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await expect(page.getByLabel('Account menu').getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account');
  await expect(page.getByLabel('Account menu').getByRole('button', { name: 'Sign out' })).toBeVisible();
  await expect(page.getByText('Signed in', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeFocused();
});

test('signed-out account page provides the magic-link entry point', async ({ page }) => {
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Access your personal workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Create or sign in' }).click();
  await expect(page).toHaveURL(/\/tools$/);
});

test('browser fallback reads the nested scan identifier returned by the API', async ({ page }) => {
  await page.route('**/api/v1/session', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ active: true, webMcpEnabled: true, termsAccepted: true, csrfToken: 'csrf-token' }) });
  });
  await page.route('**/api/v1/scans', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ scan: { id: 'scan_00000000-0000-0000-0000-000000000000' } }) });
  });
  await page.goto('/tools');
  await page.getByLabel('Public HTTPS website').fill('https://example.com');
  await page.getByLabel('I own this public website or am expressly authorized to test it.').check();
  await page.getByRole('button', { name: 'Queue scan' }).click();
  await expect(page.getByRole('status')).toContainText('scan_00000000-0000-0000-0000-000000000000');
  await expect(page.getByRole('button', { name: 'View queued scan' })).toBeVisible();
});

test('mobile public routes do not create page-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/', '/tools', '/scans', '/terms', '/scans/scan_00000000-0000-0000-0000-000000000000']) {
    await page.goto(route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${route} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});

test('keyboard path exposes the skip link', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
});
