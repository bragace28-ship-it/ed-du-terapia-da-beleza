const { test, expect } = require('@playwright/test');

test('Master V46 loads without a visible undefined error', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));
  page.on('requestfailed', request => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'request failed' });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const bodyText = await page.locator('body').innerText();
  expect(bodyText, 'The visible UI must not print the literal undefined').not.toMatch(/\bundefined\b/i);
  expect(bodyText).toContain('ED & DU');

  const buttons = page.locator('button:visible');
  expect(await buttons.count(), 'Expected visible interactive controls').toBeGreaterThan(0);

  expect(pageErrors, 'Unhandled JavaScript exceptions').toEqual([]);
  expect(consoleErrors, 'Browser console errors').toEqual([]);
  expect(failedRequests, 'Failed network requests').toEqual([]);
});

test('visible buttons are not all inert placeholders', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const buttons = page.locator('button:visible:not([disabled])');
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);

  let actionable = 0;
  for (let i = 0; i < Math.min(count, 30); i++) {
    const button = buttons.nth(i);
    const text = (await button.innerText().catch(() => '')).trim();
    const onclick = await button.getAttribute('onclick');
    const type = await button.getAttribute('type');
    const hasListenerHint = Boolean(onclick) || Boolean(text) || type === 'submit';
    if (hasListenerHint) actionable++;
  }
  expect(actionable, 'Visible buttons should expose a label or action hook').toBeGreaterThan(0);
});
