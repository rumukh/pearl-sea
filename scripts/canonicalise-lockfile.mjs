// @ts-check
/**
 * Canonicalises `resolved` URLs in `package-lock.json` to the public npm registry.
 *
 * Ported from the Aegis engine (`scripts/canonicalise-lockfile.mjs` in rumukh/aegis-engine at
 * 5949a7fa1a34bf66a054220585a0d05699c61d70), MIT License, Copyright (c) the Aegis authors.
 * Behaviour is unchanged except that the repository root is resolved from this file's location
 * and `file:` entries (the vendored Aegis SDK tarballs) are counted separately.
 *
 * **Why this exists.** The development machine installs through a corporate Azure Artifacts
 * proxy (see docs/sdk-update.md and the Aegis ENVIRONMENT.md), so npm writes lockfile `resolved`
 * URLs that point at internal hosts:
 *
 *     https://ms-feed-12.pkgs.visualstudio.com/1es-public/_packaging/npm-public/npm/registry/
 *       yocto-queue/-/yocto-queue-0.1.0.tgz
 *
 * `npm ci` fetches tarballs from those URLs *literally*: the registry setting only selects where
 * packument metadata comes from. A GitHub-hosted runner cannot reach them, so CI dies at the
 * install step no matter what registry the workflow configures.
 *
 * **Why canonical URLs work in both places.** The feed serves the public registry under a feed
 * path, so everything after `.../npm/registry/` is already the canonical registry path and this
 * is a pure prefix swap; no name or version is reconstructed. Afterwards:
 *
 *   - on a GitHub runner the URLs are literally correct;
 *   - behind the proxy, npm's *default* `replace-registry-host=npmjs` rewrites exactly
 *     `registry.npmjs.org` to the configured registry.
 *
 * Both environments are then served by the same committed lockfile.
 *
 * **When to run it.** After any `npm install` / `npm update` on a proxied machine, because npm
 * will have written feed URLs back into the lockfile. `test/tooling/lockfile-registry.test.ts`
 * fails the gate if you forget, and names this script in the failure message.
 *
 *   node scripts/canonicalise-lockfile.mjs           # report only, exit 1 if work is needed
 *   node scripts/canonicalise-lockfile.mjs --write   # rewrite in place
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lockPath = join(root, 'package-lock.json');

/**
 * Any npm registry feed hosted on Azure Artifacts, whose tarball paths are the canonical
 * registry paths under a feed prefix.
 */
const FEED_PREFIX =
  /^https:\/\/[^/]*\.pkgs\.visualstudio\.com\/[^/]+\/_packaging\/[^/]+\/npm\/registry\//;

/** The canonical public registry origin that `replace-registry-host=npmjs` recognises. */
const CANONICAL = 'https://registry.npmjs.org/';

/**
 * @param {Record<string, { resolved?: string }>} packages
 * @returns {{ rewritten: number; canonical: number; local: number; unmatched: string[] }}
 */
function canonicalise(packages) {
  let rewritten = 0;
  let canonical = 0;
  let local = 0;
  /** @type {string[]} */
  const unmatched = [];

  for (const [key, entry] of Object.entries(packages)) {
    if (!entry.resolved) continue;
    // The vendored SDK tarballs install from `file:vendor/...`; they are not registry fetches.
    if (entry.resolved.startsWith('file:')) {
      local++;
      continue;
    }
    if (!/^https?:/.test(entry.resolved)) {
      unmatched.push(`${key} -> ${entry.resolved}`);
    } else if (entry.resolved.startsWith(CANONICAL)) {
      canonical++;
    } else if (FEED_PREFIX.test(entry.resolved)) {
      entry.resolved = entry.resolved.replace(FEED_PREFIX, CANONICAL);
      rewritten++;
    } else {
      // Deliberately not silently tolerated: an unrecognised host is a registry this script has
      // never seen, and guessing at its path layout is how a lockfile ends up quietly wrong.
      unmatched.push(`${key} -> ${entry.resolved}`);
    }
  }
  return { rewritten, canonical, local, unmatched };
}

const write = process.argv.includes('--write');
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
const { rewritten, canonical, local, unmatched } = canonicalise(lock.packages ?? {});

console.log(
  `canonical: ${canonical}  vendored file: ${local}  needing rewrite: ${rewritten}  unrecognised: ${unmatched.length}`,
);
for (const u of unmatched) console.error(`  UNRECOGNISED ${u}`);

if (unmatched.length > 0) {
  console.error('\nRefusing to touch the lockfile while an unrecognised resolved URL is present.');
  process.exit(2);
}

if (write) {
  if (rewritten > 0) {
    // npm writes two-space indent and a trailing newline; matching it keeps the diff to exactly
    // the lines whose URL changed instead of reformatting the whole file.
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
    console.log(`rewrote ${rewritten} resolved URL(s) in package-lock.json`);
  } else {
    console.log('nothing to do');
  }
} else if (rewritten > 0) {
  console.error(
    `\n${rewritten} resolved URL(s) still point at the corporate feed.` +
      '\nRun: npm run lockfile:fix   (node scripts/canonicalise-lockfile.mjs --write)',
  );
  process.exit(1);
}
