import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = ['/', '/features', '/pricing', '/sign-in', '/onboarding', '/dashboard', '/scans/new', '/scans', '/scans/SCN-1047', '/schedules', '/acrs', '/acrs/new', '/acrs/northstar-federal', '/tools', '/organization'];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('easyacr-role', 'admin');
    localStorage.setItem('easyacr-theme', 'light');
  });
});

for (const route of routes) {
  test(`${route} has no automatically detectable serious accessibility violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const serious = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious, serious.map((item) => `${item.id}: ${item.help}`).join('\n')).toEqual([]);
  });
}

test('dashboard mobile dark theme has no serious automated violations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('easyacr-theme', 'dark'));
  await page.goto('/dashboard');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});
