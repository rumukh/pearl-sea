// @ts-check
/**
 * Local static server for development and end-to-end tests. Read-only; GET/HEAD only; loopback.
 *
 *   node scripts/serve.mjs                       build to out/dev-site-*, watch, rebuild on change
 *   node scripts/serve.mjs --base /pearl-sea/ --port 4330
 *   node scripts/serve.mjs --build --out out/e2e-site --base /pearl-sea/   build once, serve
 *   node scripts/serve.mjs --static dist-site    serve an existing build as-is
 *
 * Every response carries the same Content-Security-Policy the shipped index.html declares, so a
 * request the browser would refuse in production is refused here too. `/` redirects to the base.
 * There is no live reload: refresh the page after "rebuilt" is printed.
 */
import { createServer } from 'node:http';
import { existsSync, rmSync, watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { isMain, readJson, repositoryRoot } from './lib/tools.mjs';
import { CONTENT_SECURITY_POLICY, validateBase } from './lib/site.mjs';
import { buildSite } from './build.mjs';

/**
 * The development server's port. Dragon Valley serves on 4320 (and its browser tests on 4321), so
 * both games can run side by side on one machine; the browser tests here use 4331.
 */
export const DEFAULT_PORT = 4330;

/** @type {Record<string, string>} */
const MIME = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  webmanifest: 'application/manifest+json; charset=utf-8',
  map: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  opus: 'audio/ogg',
};

/**
 * Serve a directory whose build-report.json names its base.
 * @param {{ directory: () => string; port?: number; host?: string }} options
 */
export async function serveDirectory({ directory, port = 0, host = '127.0.0.1' }) {
  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const root = directory();
    try {
      const { base } = readJson(join(root, 'build-report.json'));
      const url = new URL(request.url ?? '/', 'http://localhost');
      const path = decodeURIComponent(url.pathname);
      if (path === '/' && base !== '/') {
        response.writeHead(302, { Location: base }).end();
        return;
      }
      if (!path.startsWith(base)) {
        response.writeHead(404).end();
        return;
      }
      const leaf = path.slice(base.length);
      const full = resolve(root, leaf === '' || leaf.endsWith('/') ? leaf + 'index.html' : leaf);
      if (full !== root && !full.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
      }
      const data = await readFile(full);
      response.writeHead(200, {
        'Content-Type': MIME[full.split('.').pop() ?? ''] ?? 'application/octet-stream',
        'Content-Length': data.length,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': CONTENT_SECURITY_POLICY,
      });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      const code = /** @type {{ code?: string }} */ (error)?.code;
      response.writeHead(code === 'ENOENT' || code === 'EISDIR' ? 404 : 400).end();
    }
  });
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      done(undefined);
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('No server address');
  return {
    port: address.port,
    url: (/** @type {string} */ base) => `http://${host}:${address.port}${base}`,
    close: () =>
      new Promise((done, reject) =>
        server.close((error) => (error ? reject(error) : done(undefined))),
      ),
  };
}

/** @param {string[]} args */
function parseArgs(args) {
  /** @type {{ mode: 'watch' | 'build' | 'static'; dir?: string; out?: string; base: string; port: number }} */
  const options = { mode: 'watch', base: '/', port: DEFAULT_PORT };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--static') {
      options.mode = 'static';
      options.dir = args[++i];
    } else if (arg === '--build') options.mode = 'build';
    else if (arg === '--out') options.out = args[++i];
    else if (arg === '--base') options.base = validateBase(args[++i] ?? '');
    else if (arg === '--port') options.port = Number(args[++i]);
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    throw new Error('--port must be an integer between 0 and 65535.');
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === 'static') {
    const directory = resolve(options.dir ?? 'dist-site');
    if (!existsSync(join(directory, 'build-report.json'))) {
      throw new Error(`${directory} is not a build (no build-report.json).`);
    }
    const { base } = readJson(join(directory, 'build-report.json'));
    const server = await serveDirectory({ directory: () => directory, port: options.port });
    console.log(JSON.stringify({ url: server.url(base), mode: 'static', directory }));
    return;
  }
  if (options.mode === 'build') {
    const built = await buildSite({
      outDir: options.out ?? join('out', 'e2e-site'),
      base: options.base,
      clean: true,
    });
    const server = await serveDirectory({ directory: () => built.directory, port: options.port });
    console.log(
      JSON.stringify({ url: server.url(options.base), mode: 'build', revision: built.revision }),
    );
    return;
  }

  let generation = 0;
  /** @type {string | undefined} */
  let current;
  const rebuild = async () => {
    const next = join(repositoryRoot, 'out', `dev-site-${process.pid}-${++generation}`);
    const built = await buildSite({ outDir: next, base: options.base, sourcemap: true });
    const previous = current;
    current = built.directory;
    if (previous) rmSync(previous, { recursive: true, force: true });
    return built;
  };
  const first = await rebuild();
  const server = await serveDirectory({
    directory: () => {
      if (!current) throw new Error('No build available');
      return current;
    },
    port: options.port,
  });
  console.log(
    JSON.stringify({ url: server.url(options.base), mode: 'watch', revision: first.revision }),
  );

  /** @type {NodeJS.Timeout | undefined} */
  let timer;
  let building = false;
  let again = false;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (building) {
        again = true;
        return;
      }
      building = true;
      try {
        const built = await rebuild();
        console.log(`rebuilt ${built.revision} (${built.resources} resources)`);
      } catch (error) {
        console.error(`build failed: ${error instanceof Error ? error.message : error}`);
      } finally {
        building = false;
        if (again) {
          again = false;
          schedule();
        }
      }
    }, 150);
  };
  const watchers = ['src', 'content', 'assets']
    .map((name) => join(repositoryRoot, name))
    .filter((path) => existsSync(path))
    .map((path) => watch(path, { recursive: true }, schedule));
  const stop = async () => {
    for (const watcher of watchers) watcher.close();
    await server.close();
    if (current) rmSync(current, { recursive: true, force: true });
    process.exit(0);
  };
  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());
}

if (isMain(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
