/**
 * The `test` every Perlové moře end-to-end spec imports. It is Playwright's `test` plus the
 * automatic `guard` fixture (support/guard.ts): every test, in every engine, fails if the game
 * wrote to the console, threw, made a failed or foreign request, linked out, opened a window,
 * sent a beacon, violated its CSP or navigated away. Tests that provoke one of these on purpose
 * say so with `guard.allow(...)`.
 */
import { test as base, expect } from '@playwright/test';
import { Guard, watchContext } from './guard';
import { knownIssuesFor } from './known-issues';

export interface QaFixtures {
  guard: Guard;
}

export const test = base.extend<QaFixtures>({
  guard: [
    async ({ context, page, baseURL, browserName }, use, testInfo) => {
      // Depending on `page` makes this fixture tear down before the page is closed, so the last
      // in-page findings still arrive.
      void page;
      const guard = new Guard(new URL(baseURL!).origin);
      for (const issue of knownIssuesFor(browserName)) {
        guard.allow(issue.kind, issue.pattern, `${issue.id}: ${issue.reason}`);
      }
      await watchContext(context, guard);
      await use(guard);
      guard.close();
      await guard.attachReport(testInfo);
      if (testInfo.status === testInfo.expectedStatus) guard.expectClean('during the test');
    },
    { auto: true },
  ],
});

export { expect };
