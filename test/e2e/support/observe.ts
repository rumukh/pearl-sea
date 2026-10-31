/**
 * What every test watches: page errors, console errors, failed or 4xx/5xx requests and requests
 * to any other origin. The game sends nothing anywhere, so each list must stay empty.
 */
import type { Page } from '@playwright/test';

export interface Observations {
  consoleErrors: string[];
  pageErrors: string[];
  foreignRequests: string[];
  failedRequests: string[];
}

export function observe(page: Page, origin: string): Observations {
  const seen: Observations = {
    consoleErrors: [],
    pageErrors: [],
    foreignRequests: [],
    failedRequests: [],
  };
  page.on('console', (message) => {
    if (message.type() === 'error') seen.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => seen.pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && url.origin !== origin) {
      seen.foreignRequests.push(request.url());
    }
  });
  page.on('requestfailed', (request) =>
    seen.failedRequests.push(`${request.url()} (${request.failure()?.errorText ?? 'failed'})`),
  );
  page.on('response', (response) => {
    if (response.status() >= 400)
      seen.failedRequests.push(`${response.url()} (${response.status()})`);
  });
  return seen;
}
