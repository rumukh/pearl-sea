/**
 * Where a run's web server listens and what it serves. Each port gets its own build folder and
 * its own output folder, so two local runs on different ports (`PS_E2E_PORT`) never rebuild or
 * clear each other's files mid-run. CI runs one suite per job on the default port. Dragon Valley
 * uses 4320 and 4321, so both games' suites can run on one machine at the same time.
 */
import { join } from 'node:path';

export const DEFAULT_PORT = 4331;

/** The port the e2e web server listens on (`PS_E2E_PORT`, 4331 by default). */
export function e2ePort(): number {
  return Number(process.env['PS_E2E_PORT'] ?? DEFAULT_PORT);
}

/** The built site the web server serves, relative to the repository root. */
export function siteFolder(port: number = e2ePort()): string {
  return join('out', `e2e-site-${port}`);
}

/**
 * Playwright's output folder (traces, screenshots): the usual one on the default port.
 * Playwright empties it when a run starts, so another port's folder must not sit inside it.
 */
export function outputFolder(port: number = e2ePort()): string {
  return port === DEFAULT_PORT ? 'test-results' : join('out', `e2e-results-${port}`);
}
