/**
 * Navigation + Accessibility E2E tests.
 * Runs axe-core on every main view — target: 0 violations.
 * API calls are intercepted so no server is needed.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const MOCK_REPORTS = {
  data: [
    {
      id: 'a1000000-0000-0000-0000-000000000001',
      clientId: 'c1000000-0000-0000-0000-000000000001',
      title: 'Udarna jama na testni ulici',
      category: 'pothole',
      description: 'Testna udarna jama.',
      lat: 46.558,
      lng: 15.646,
      status: 'submitted',
      createdAt: '2025-01-01T10:00:00Z',
      updatedAt: '2025-01-01T10:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};

const MOCK_REPORT_DETAIL = {
  ...MOCK_REPORTS.data[0],
  statusHistory: [
    {
      id: 'h1',
      reportId: 'a1000000-0000-0000-0000-000000000001',
      status: 'submitted',
      changedAt: '2025-01-01T10:00:00Z',
    },
  ],
};

test.beforeEach(async ({ page }) => {
  // Mock all API calls so tests don't require a running server
  await page.route('**/api/reports?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REPORTS),
    }),
  );
  await page.route('**/api/reports/a1000000-**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REPORT_DETAIL),
    }),
  );
  await page.route('**/api/vapid-public-key', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ publicKey: 'BFake_key' }),
    }),
  );
});

test('home page loads and has correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/PrijaviMesto/i);
});

test('home page has <main> landmark', async ({ page }) => {
  await page.goto('/');
  const main = page.locator('main, [role="main"]');
  await expect(main).toBeVisible();
});

test('skip-link is present and focusable', async ({ page }) => {
  await page.goto('/');
  const skipLink = page.locator('a[href="#main"]');
  await expect(skipLink).toBeAttached();
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
});

test('axe — home page (report list)', async ({ page }) => {
  await page.goto('/');
  // Wait for list to render
  await page.waitForTimeout(500);
  const results = await new AxeBuilder({ page })
    .exclude('.leaflet-container') // Leaflet map has known issues with aria roles
    .analyze();
  expect(results.violations).toEqual([]);
});

test('navigate to /new and axe check', async ({ page }) => {
  await page.goto('/prijavi');
  await page.waitForTimeout(300);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('navigate to report detail and axe check', async ({ page }) => {
  await page.goto('/prijava/a1000000-0000-0000-0000-000000000001');
  await page.waitForTimeout(500);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('404 page renders without crash', async ({ page }) => {
  await page.goto('/nonexistent-route-xyz');
  await page.waitForTimeout(300);
  const h1 = page.locator('h1');
  await expect(h1).toContainText('ni najdena');
});
