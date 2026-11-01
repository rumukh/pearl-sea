/**
 * What every test watches: page errors, console errors, failed or 4xx/5xx requests and requests
 * to any other origin. The game sends nothing anywhere, so each list must stay empty.
 *
 * A request the page cancelled itself is noted in `cancelledRequests`, never a failure (as in
 * Dragon Valley's guard): a reload or a closed page cuts loads short, and Chromium reports a
 * fetch whose body the page has already read in full as `net::ERR_ABORTED` when the page lets go
 * of it before the network's completion arrives. The game's sounds load that way, and they
 * decode and play whole.
 */
import type { Page } from '@playwright/test';

export interface Observations {
  consoleErrors: string[];
  pageErrors: string[];
  foreignRequests: string[];
  failedRequests: string[];
  cancelledRequests: string[];
}

/** Error texts engines use for a request cancelled by its own page. */
const CANCELLED = /ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled|canceled|aborted/i;

export function observe(page: Page, origin: string): Observations {
  const seen: Observations = {
    consoleErrors: [],
    pageErrors: [],
    foreignRequests: [],
    failedRequests: [],
    cancelledRequests: [],
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
  page.on('requestfailed', (request) => {
    const text = request.failure()?.errorText ?? 'failed';
    (CANCELLED.test(text) ? seen.cancelledRequests : seen.failedRequests).push(
      `${request.url()} (${text})`,
    );
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      seen.failedRequests.push(`${response.url()} (${response.status()})`);
  });
  return seen;
}
