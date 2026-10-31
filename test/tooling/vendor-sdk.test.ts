/**
 * The vendored Aegis SDK is exactly the approved, complete tarball set.
 *
 * Provenance of the expected values: PINNED was copied by hand from the `npm run pack:sdk` output
 * at aegis-engine commit 0abd61b (also recorded in vendor/aegis/<version>/artifacts.json and in
 * docs/sdk-update.md). It is a literal on purpose: the tarballs and artifacts.json are compared
 * with each other *and* with this pin, so replacing both consistently with a different SDK still
 * fails here until someone deliberately re-pins (docs/sdk-update.md, step 4).
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PINNED = {
  revision: '0abd61b5a679020bfb66bf4db24888df9e339d4d',
  version: '0.0.0-local.r0abd61b5a679.da726c53afdf74c5f',
  sha256: {
    '@aegis/core': '16612c186b2371e93ceeb1565953e7b7d9326126d321c8d12b7c5cf2ae69c7ae',
    '@aegis/runtime': '72aac3d1218da81b086c81f57e516d2d61bd6874f6b79c69039effc7ec140384',
    '@aegis/narrative': 'c9e3165983190533bac07ceee14366b5a2f5daf9d4a3b20fd6588c4fa1630b29',
    '@aegis/browser': '5194c4775178dd4cc587177b91d9026e87e40abda9499077e60e980e20116885',
  } as Record<string, string>,
} as const;

const PACKAGES = ['@aegis/browser', '@aegis/core', '@aegis/narrative', '@aegis/runtime'];

const root = join(import.meta.dirname, '..', '..');
const vendorRoot = join(root, 'vendor', 'aegis');
const json = (path: string): any => JSON.parse(readFileSync(path, 'utf8'));
const sha256 = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

interface Artifact {
  name: string;
  version: string;
  file: string;
  sha256: string;
  integrity: string;
}
interface Artifacts {
  format: string;
  revision: string;
  workingTree: string;
  sourceDigest: string;
  version: string;
  packages: Artifact[];
}

const versionDir = join(vendorRoot, PINNED.version);
const artifacts = (): Artifacts => json(join(versionDir, 'artifacts.json'));

describe('vendored Aegis SDK artifacts', () => {
  it('vendors exactly one SDK version, the pinned one', () => {
    expect(readdirSync(vendorRoot)).toEqual([PINNED.version]);
  });

  it('records a clean build of the pinned engine commit with all four packages', () => {
    const report = artifacts();
    expect(report.format).toBe('aegis-sdk-build/1');
    expect(report.revision).toBe(PINNED.revision);
    expect(report.workingTree, 'an SDK packed from a dirty checkout is not provenance').toBe(
      'clean',
    );
    expect(report.version).toBe(PINNED.version);
    expect(report.packages.map((entry) => entry.name).sort()).toEqual(PACKAGES);
    expect(report.packages.every((entry) => entry.version === PINNED.version)).toBe(true);
  });

  it('contains only the four tarballs and the artifact manifest', () => {
    const expected = [...artifacts().packages.map((entry) => entry.file), 'artifacts.json'].sort();
    expect(readdirSync(versionDir).sort()).toEqual(expected);
  });

  it.each(PACKAGES)('%s tarball bytes match artifacts.json and the pinned digest', (name) => {
    const entry = artifacts().packages.find((candidate) => candidate.name === name);
    expect(entry, `${name} is listed in artifacts.json`).toBeDefined();
    const actual = sha256(join(versionDir, entry!.file));
    expect(actual, `${entry!.file} differs from artifacts.json`).toBe(entry!.sha256);
    expect(actual, `${entry!.file} differs from the approved pin`).toBe(PINNED.sha256[name]);
  });
});

describe('the consumer installs exactly the vendored set', () => {
  it('declares the four SDK packages as its only runtime dependencies, from vendor files', () => {
    const manifest = json(join(root, 'package.json'));
    const expected = Object.fromEntries(
      artifacts()
        .packages.map((entry) => [entry.name, `file:vendor/aegis/${PINNED.version}/${entry.file}`])
        .sort(([a], [b]) => (a! < b! ? -1 : 1)),
    );
    expect(manifest.dependencies).toEqual(expected);
  });

  it.each(PACKAGES)('%s is locked to the vendored file and its npm integrity', (name) => {
    const lock = json(join(root, 'package-lock.json'));
    const entry = artifacts().packages.find((candidate) => candidate.name === name)!;
    const locked = lock.packages[`node_modules/${name}`];
    expect(locked.version).toBe(PINNED.version);
    expect(locked.resolved).toBe(`file:vendor/aegis/${PINNED.version}/${entry.file}`);
    expect(locked.integrity).toBe(entry.integrity);
  });

  it.each(PACKAGES)(
    '%s in node_modules is the pinned build (run npm ci after an update)',
    (name) => {
      const directory = join(root, 'node_modules', ...name.split('/'));
      const installed = json(join(directory, 'package.json'));
      expect(installed.version).toBe(PINNED.version);
      const build = json(join(directory, 'aegis-build.json'));
      expect(build.revision).toBe(PINNED.revision);
      expect(build.sourceDigest).toBe(artifacts().sourceDigest);
      for (const [dependency, version] of Object.entries(installed.dependencies ?? {})) {
        expect(PACKAGES, `${name} depends only on SDK siblings`).toContain(dependency);
        expect(version, `${name} pins ${dependency} exactly`).toBe(PINNED.version);
      }
    },
  );
});
