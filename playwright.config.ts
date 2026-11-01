import { defineConfig, devices } from '@playwright/test';
import type { Project, ReporterDescription } from '@playwright/test';
import { DEPLOYMENT_BASE } from './src/rules/contract/persistence';
import { e2ePort, outputFolder, siteFolder } from './test/e2e/support/site';

/**
 * Browser end-to-end tests (test/e2e/**). The web server builds the site with the GitHub Pages
 * base path, so every run exercises a nested deployment exactly like production.
 *
 * Engines:
 * - CI (`CI` is set by GitHub Actions) installs Playwright's Chromium, WebKit and Firefox with
 *   `npx playwright install --with-deps` and runs each engine (`--project=<engine>`) in its own job.
 * - Locally, Playwright never downloads browsers. It drives the installed system browser through a
 *   channel: Microsoft Edge by default, or Chrome with `PS_BROWSER_CHANNEL=chrome`. Set
 *   `PS_E2E_ALL_ENGINES=1` to run all three engines locally if they have been installed.
 *
 * Timeouts are generous because WebKit on a shared runner is slow, not because anything waits:
 * every wait is for a named condition.
 */
const ci = Boolean(process.env.CI);
const port = e2ePort();
const base = DEPLOYMENT_BASE;
const channel = process.env.PS_BROWSER_CHANNEL ?? 'msedge';

const allEngines: Project[] = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
];
const systemBrowser: Project[] = [
  { name: `chromium-${channel}`, use: { ...devices['Desktop Chrome'], channel } },
];
// The QA reporter (test/e2e/support/qa-reporter.ts) writes qa-summary.md beside the results: the
// known defects, slow tests, performance and accessibility advice, and the job summary on CI. On
// CI it reports first, so its bound on the runner's exit (PS-QA-21) covers every reporter after it.
const qa: ReporterDescription = ['./test/e2e/support/qa-reporter.ts'];
const reporters: ReporterDescription[] = ci
  ? [
      qa,
      ['list'],
      ['html', { open: 'never' }],
      ['json', { outputFile: 'test-results/results.json' }],
    ]
  : [['list'], qa];

export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: true,
  forbidOnly: ci,
  retries: 0,
  workers: ci ? 2 : undefined,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: reporters,
  // One engine's run takes up to 15 minutes on CI (WebKit, the slowest); this is twice that. A run
  // that hangs in its tests or their teardown fails here with Playwright's own message, before the
  // step's 35-minute timeout (.github/workflows/ci.yml); a hang after reporting is bounded by the
  // QA reporter (PS-QA-21).
  globalTimeout: ci ? 30 * 60_000 : 0,
  outputDir: outputFolder(port),
  use: {
    baseURL: `http://127.0.0.1:${port}${base}`,
    locale: 'cs-CZ',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: ci || process.env.PS_E2E_ALL_ENGINES ? allEngines : systemBrowser,
  webServer: {
    command: `node scripts/serve.mjs --build --out ${siteFolder(port).replace(/\\/g, '/')} --base ${base} --port ${port}`,
    url: `http://127.0.0.1:${port}${base}`,
    // Never reuse a server already on the port: it may belong to another run or another checkout
    // (Dragon Valley's tests use 4321), serving their build and vanishing when that run ends. A
    // busy port stops the run at once; choose another with PS_E2E_PORT.
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
