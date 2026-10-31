import { defineConfig } from 'vitest/config';

/**
 * Unit, trace, simulation, migration and tooling tests. Browser end-to-end tests live in
 * test/e2e and run under Playwright (playwright.config.ts), never under Vitest.
 *
 * Tests import the installed SDK tarballs from node_modules exactly as the shipped bundle does;
 * there are no source aliases into an engine checkout.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/e2e/**', 'node_modules/**'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
