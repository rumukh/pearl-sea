// @ts-check
/**
 * Static-site helpers shared by build.mjs, serve.mjs and check-site.mjs.
 *
 * The site is a closed, same-origin resource graph: every file a player needs is listed in
 * `resource-graph.json` with its exact byte count and SHA-256, and the SDK's own validator
 * (`validateOfflinePack` from the public `@aegis/browser/offline` export) must accept it. That is
 * what the offline installer verifies in the browser, so the build refuses anything it would refuse.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { validateOfflinePack } from '@aegis/browser/offline';

export const BUILD_FORMAT = 'pearl-sea-build/1';
/** The same values as in src/rules/contract/persistence.ts (test/unit/persistence/origin-isolation.test.ts). */
export const OFFLINE_PACK_ID = 'pearl-sea';
export const OFFLINE_NAMESPACE = 'pearl-sea';
export const OFFLINE_ERROR_MESSAGE = 'pearl-sea-offline-error';

/** Files that describe the graph or install it; they are deliberately not members of it. */
export const OUTSIDE_GRAPH = new Set(['sw.js', 'resource-graph.json', 'build-report.json']);

/** Per-file and per-pack budgets; the SDK defaults, restated so the build fails first and clearly. */
export const MAX_FILE_BYTES = 32 * 1024 * 1024;
export const MAX_PACK_BYTES = 64 * 1024 * 1024;
export const MAX_RESOURCES = 4096;

/**
 * Content Security Policy for every page. GitHub Pages cannot send headers, so the build puts it
 * in a meta element and the local server also sends it as a header. Everything is same-origin:
 * no CDNs, remote fonts, analytics or embeds can load even if a dependency tried.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/** @type {Record<string, 'shell' | 'script' | 'image' | 'audio' | 'font' | 'locale' | 'data' | 'style'>} */
const KIND_BY_EXTENSION = {
  html: 'shell',
  js: 'script',
  mjs: 'script',
  css: 'style',
  svg: 'image',
  png: 'image',
  webp: 'image',
  jpg: 'image',
  jpeg: 'image',
  avif: 'image',
  ico: 'image',
  woff2: 'font',
  woff: 'font',
  ttf: 'font',
  otf: 'font',
  wav: 'audio',
  ogg: 'audio',
  mp3: 'audio',
  m4a: 'audio',
  opus: 'audio',
  json: 'data',
  webmanifest: 'data',
  txt: 'data',
};

/**
 * Validate a deployment base path such as `/` or `/pearl-sea/`.
 * @param {string} base
 */
export function validateBase(base) {
  if (typeof base !== 'string' || !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base)) {
    throw new Error(
      `Base must be an absolute directory path such as / or /pearl-sea/ (got ${base}).`,
    );
  }
  return base;
}

/** @param {string} path */
export function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * Every file under `directory`, as sorted forward-slash relative paths (code-unit order, so the
 * listing is identical on every OS).
 * @param {string} directory
 * @returns {string[]}
 */
export function listFiles(directory) {
  /** @param {string} current @returns {string[]} */
  const walk = (current) =>
    readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const path = join(current, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`Symbolic links are not allowed in a site: ${path}`);
      return entry.isDirectory() ? walk(path) : [relative(directory, path).split(sep).join('/')];
    });
  return walk(directory).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * The kind of a site file, by path. Unknown extensions are an error rather than a guess, so a new
 * asset type is a deliberate decision recorded here.
 * @param {string} path forward-slash relative path
 */
export function resourceKind(path) {
  if (/^content\/catalogs\/.+\.json$/.test(path)) return 'locale';
  const extension = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1).toLowerCase() : '';
  const kind = KIND_BY_EXTENSION[extension];
  if (!kind) {
    throw new Error(
      `Unsupported site file type: ${path}. Add its extension to KIND_BY_EXTENSION in scripts/lib/site.mjs.`,
    );
  }
  return kind;
}

/**
 * Describe every graph member of a built directory.
 * @param {string} directory
 * @param {string} base
 */
export function describeResources(directory, base) {
  validateBase(base);
  const resources = listFiles(directory)
    .filter((path) => !OUTSIDE_GRAPH.has(path) && !path.endsWith('.map'))
    .map((path) => {
      const full = join(directory, ...path.split('/'));
      const bytes = readFileSync(full).length;
      if (bytes === 0) throw new Error(`Empty files cannot be installed offline: ${path}`);
      if (bytes > MAX_FILE_BYTES) throw new Error(`${path} exceeds ${MAX_FILE_BYTES} bytes.`);
      return {
        id: 'file-' + createHash('sha256').update(path).digest('hex').slice(0, 24),
        src: base + path,
        bytes,
        sha256: sha256(full),
        kind: resourceKind(path),
      };
    });
  if (resources.length > MAX_RESOURCES) throw new Error(`More than ${MAX_RESOURCES} resources.`);
  const total = resources.reduce((sum, resource) => sum + resource.bytes, 0);
  if (total > MAX_PACK_BYTES)
    throw new Error(`Site exceeds the ${MAX_PACK_BYTES}-byte pack budget.`);
  return resources;
}

/**
 * Re-read a built site and prove its graph: format, base, SDK validation, every digest, and no
 * file outside the graph except the installer's own files. Throws with a precise message.
 * @param {string} directory
 */
export function verifySite(directory) {
  const report = JSON.parse(readFileSync(join(directory, 'build-report.json'), 'utf8'));
  if (report.format !== BUILD_FORMAT) throw new Error(`Not a ${BUILD_FORMAT} build: ${directory}`);
  const base = validateBase(report.base);
  const graph = JSON.parse(readFileSync(join(directory, 'resource-graph.json'), 'utf8'));
  if (graph.id !== OFFLINE_PACK_ID) throw new Error(`Unexpected pack id ${graph.id}`);
  if (graph.revision !== report.revision) throw new Error('Graph and report revisions differ.');
  validateOfflinePack(graph, new URL(base, 'https://pearl-sea.invalid').href);
  const actual = describeResources(directory, base);
  const declared = JSON.stringify(graph.resources);
  if (JSON.stringify(actual) !== declared) {
    const expected = new Map(graph.resources.map((/** @type {any} */ r) => [r.src, r]));
    const drift = actual
      .filter((r) => JSON.stringify(expected.get(r.src)) !== JSON.stringify(r))
      .map((r) => r.src);
    const missing = graph.resources
      .filter((/** @type {any} */ r) => !actual.some((a) => a.src === r.src))
      .map((/** @type {any} */ r) => r.src);
    throw new Error(
      `Resource graph does not match the files on disk. Changed or undeclared: ${drift.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}.`,
    );
  }
  for (const required of ['index.html', 'app.js', 'sw.js']) {
    if (!listFiles(directory).includes(required)) throw new Error(`Missing ${required}`);
  }
  const index = readFileSync(join(directory, 'index.html'), 'utf8');
  const meta = (/** @type {string} */ name) =>
    new RegExp(`<meta name="${name}" content="([^"]*)"\\s*/?>`).exec(index)?.[1];
  if (meta('ps-offline-revision') !== report.revision) {
    throw new Error('index.html does not pin the offline revision.');
  }
  if (meta('ps-base') !== base) {
    throw new Error('index.html does not declare the deployment base.');
  }
  if (!readFileSync(join(directory, 'sw.js'), 'utf8').includes(report.revision)) {
    throw new Error('sw.js is not pinned to this build revision.');
  }
  return {
    base,
    revision: report.revision,
    resources: graph.resources.length,
    bytes: graph.resources.reduce(
      (/** @type {number} */ sum, /** @type {any} */ r) => sum + r.bytes,
      0,
    ),
  };
}
