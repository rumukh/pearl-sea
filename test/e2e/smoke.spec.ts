/**
 * Smoke test on every engine: the built site, served at the nested Pages base, boots into the
 * Czech title screen in the reading font, logs no errors and makes no request to another origin.
 *
 * Owned by S6 (QA) from here on; extend rather than loosen it.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { observe } from './support/observe';

test('the game boots at the Pages base into the Czech title screen', async ({ page, baseURL }) => {
  const seen = observe(page, new URL(baseURL!).origin);

  await page.goto('./');
  const status = page.getByTestId('boot-status');
  await expect(status).toHaveAttribute('data-state', 'ready');
  await expect(status).toHaveAttribute('data-screen', 'title');
  await expect(status).toHaveAttribute('data-base', '/pearl-sea/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
  await expect(page).toHaveTitle('Perlové moře');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Perlové moře');
  await expect(page.getByTestId('title-screen')).toContainText('češtinou');
  await expect(page.locator('#app')).not.toHaveAttribute('aria-busy', 'true');
  await page.waitForLoadState('networkidle');

  expect(seen.pageErrors, 'uncaught page errors').toEqual([]);
  expect(seen.consoleErrors, 'console errors').toEqual([]);
  expect(seen.foreignRequests, 'requests to another origin').toEqual([]);
  expect(seen.failedRequests, 'failed or 4xx/5xx requests').toEqual([]);
});

test('Czech text is drawn in the reading font', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('boot-status')).toHaveAttribute('data-font', 'loaded');
  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    const heading = document.querySelector('h1');
    return {
      family: heading ? getComputedStyle(heading).fontFamily : '',
      regular: document.fonts.check('400 20px "Pearl Reading"', 'iíyý ěščřžďťň ůú ÍÝŮ „“'),
      bold: document.fonts.check('700 20px "Pearl Reading"', 'iíyý ěščřžďťň ůú ÍÝŮ „“'),
    };
  });
  expect(font.family).toMatch(/^"?Pearl Reading"?/);
  expect(font.regular).toBe(true);
  expect(font.bold).toBe(true);
});

test('the shell declares a same-origin Content Security Policy', async ({ page }) => {
  await page.goto('./');
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("connect-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("form-action 'none'");
});

test('one-letter words never end a line', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('boot-status')).toHaveAttribute('data-state', 'ready');
  const tagline = await page.locator('.ps-title__tagline').textContent();
  expect(tagline).toContain('s\u00a0ponorkou');
  expect(tagline).toContain('z\u00a0mořských');
});

test('the title screen has no WCAG 2.1 A or AA violations', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('boot-status')).toHaveAttribute('data-state', 'ready');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map((violation) => `${violation.id}: ${violation.help}`),
    'axe violations',
  ).toEqual([]);
});
