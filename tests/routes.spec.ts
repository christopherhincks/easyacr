import { expect, test } from '@playwright/test';

const routes = [
  '/', '/features', '/pricing', '/about', '/sign-up', '/sign-in', '/password-recovery', '/checkout/success',
  '/onboarding', '/dashboard', '/scans/new', '/scans', '/scans/SCN-1047', '/schedules', '/acrs', '/acrs/new',
  '/acrs/northstar-federal', '/tools', '/account', '/billing', '/organization', '/access-denied', '/error', '/not-a-route',
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('easyacr-role', 'admin');
    localStorage.setItem('easyacr-theme', 'light');
  });
});

for (const route of routes) {
  test(`${route} renders a named page`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('undefined');
  });
}

test('mobile pages do not create page-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/', '/dashboard', '/scans', '/scans/SCN-1047', '/acrs', '/tools', '/organization']) {
    await page.goto(route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${route} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});

test('keyboard path exposes skip link and scan validation', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.goto('/scans/new');
  await page.getByLabel('Website URL').fill('file:///etc/passwd');
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP or HTTPS');
});
