/**
 * The lockfile must resolve from the public npm registry, and the corporate proxy must remain
 * what local development uses. Ported from the Aegis engine's test/lockfile-registry.test.ts
 * (MIT) and extended to every workflow job that installs packages.
 *
 * The development machine installs through a corporate Azure Artifacts proxy, and npm writes
 * `resolved` URLs pointing at that feed's internal hosts. `npm ci` fetches tarballs from those
 * URLs literally, so a lockfile full of feed URLs cannot be installed on a GitHub-hosted runner.
 * Canonical `https://registry.npmjs.org/` URLs work in both places. The drift is silent: a local
 * `npm install` rewrites them and everything keeps working locally. This test makes anyone run
 * `npm run lockfile:fix` (scripts/canonicalise-lockfile.mjs --write).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', '..');
const read = (path: string): string =>
  readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');

const CANONICAL = 'https://registry.npmjs.org/';

interface LockEntry {
  resolved?: string;
}

function lockEntries(): [string, LockEntry][] {
  const lock = JSON.parse(read('package-lock.json')) as {
    lockfileVersion?: number;
    packages?: Record<string, LockEntry>;
  };
  expect(lock.lockfileVersion, 'lockfile v3 is what the resolved-URL layout below assumes').toBe(3);
  return Object.entries(lock.packages ?? {});
}

/** Entries that are fetched from a registry: everything except the vendored `file:` tarballs. */
function registryEntries(): [string, string][] {
  return lockEntries()
    .filter(([, v]) => typeof v.resolved === 'string' && !v.resolved.startsWith('file:'))
    .map(([k, v]) => [k, v.resolved as string]);
}

/** Job blocks of a workflow, as name -> lines, split on two-space-indented job keys. */
function jobs(workflow: string): Map<string, string[]> {
  const lines = read(workflow).split('\n');
  const start = lines.indexOf('jobs:');
  expect(start, `${workflow} has a jobs: block`).toBeGreaterThan(-1);
  const result = new Map<string, string[]>();
  let current: string | undefined;
  for (const line of lines.slice(start + 1)) {
    const job = /^ {2}([a-z0-9-]+):$/.exec(line);
    if (job?.[1]) {
      current = job[1];
      result.set(current, []);
    } else if (current) result.get(current)?.push(line);
  }
  return result;
}

describe('package-lock.json resolves from the public registry', () => {
  it('has enough registry-resolved entries for the check below to mean anything', () => {
    // Anti-vacuity: if the lockfile layout moved `resolved`, every check would pass over nothing.
    expect(registryEntries().length).toBeGreaterThan(150);
  });

  it('resolves every registry dependency from registry.npmjs.org', () => {
    const offenders = registryEntries()
      .filter(([, url]) => !url.startsWith(CANONICAL))
      .map(([name, url]) => `${name} -> ${url}`);
    expect(
      offenders,
      'Run: npm run lockfile:fix\n(npm install behind the corporate proxy rewrites these to the ' +
        'feed host; the result installs locally but cannot be installed on a GitHub runner.)',
    ).toEqual([]);
  });

  it('installs the Aegis SDK only from the vendored tarballs', () => {
    const aegis = lockEntries().filter(([key]) => key.startsWith('node_modules/@aegis/'));
    expect(aegis.map(([key]) => key).sort()).toEqual([
      'node_modules/@aegis/browser',
      'node_modules/@aegis/core',
      'node_modules/@aegis/narrative',
      'node_modules/@aegis/runtime',
    ]);
    for (const [key, entry] of aegis) {
      expect(entry.resolved, key).toMatch(/^file:vendor\/aegis\/[^/]+\/aegis-[a-z]+-[^/]+\.tgz$/);
    }
  });

  it('keeps the repair script the failure message names', () => {
    const script = read('scripts/canonicalise-lockfile.mjs');
    expect(script).toContain(CANONICAL);
    expect(script).toContain('--write');
    expect(JSON.parse(read('package.json')).scripts['lockfile:fix']).toBe(
      'node scripts/canonicalise-lockfile.mjs --write',
    );
  });
});

describe('the corporate proxy is still what local development uses', () => {
  it('keeps the committed .npmrc pinned at the proxy', () => {
    // The canonical lockfile is not a licence to point local installs at public npm, which is
    // blocked on the development machine. The two halves only work together.
    expect(read('.npmrc')).toContain('https://packagefeedproxy.microsoft.io/npm/');
  });

  it.each(['.github/workflows/ci.yml', '.github/workflows/pages.yml'])(
    '%s selects the public registry at job level for every job that runs npm',
    (workflow) => {
      const found = jobs(workflow);
      const installing = [...found].filter(([, lines]) =>
        lines.some((line) => /^\s+run: npm (ci|install)\b/.test(line)),
      );
      expect(installing.length, `${workflow} has jobs that install packages`).toBeGreaterThan(0);
      for (const [name, lines] of installing) {
        // Job level, not step level: it must reach npm invoked from inside `npm run verify` too,
        // and an environment variable outranks the committed project .npmrc.
        const envAt = lines.indexOf('    env:');
        expect(envAt, `${workflow} job ${name} has a job-level env: block`).toBeGreaterThan(-1);
        expect(lines[envAt + 1], `${workflow} job ${name}`).toBe(
          '      NPM_CONFIG_REGISTRY: https://registry.npmjs.org/',
        );
        expect(lines.indexOf('    steps:'), `${workflow} job ${name}`).toBeGreaterThan(envAt);
      }
    },
  );

  it('runs the local gate in CI as a single step', () => {
    // The workflow must not drift from the gate people run locally.
    const verify = jobs('.github/workflows/ci.yml').get('verify') ?? [];
    const runs = verify
      .map((line) => /^\s*run: (.+)$/.exec(line)?.[1]?.trim())
      .filter((run): run is string => run !== undefined);
    expect(runs.filter((run) => run.startsWith('npm run'))).toEqual(['npm run verify']);
  });
});
