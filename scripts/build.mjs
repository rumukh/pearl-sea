// @ts-check
/**
 * Build the static, offline-installable site.
 *
 *   node scripts/build.mjs [--base /pearl-sea/] [--out dist-site] [--clean] [--sourcemap]
 *
 * Output (default `dist-site/`):
 *   index.html            shell from src/app/index.html (base, offline revision and CSP filled in)
 *   app.js, app.css       esbuild bundle of src/app/main.ts
 *   content/              the pack, its catalogs and the gzip-compressed history archives (copied
 *                         verbatim; the authoring sources in content/ are not shipped)
 *   assets/**             runtime art, audio and fonts (authoring metadata is not shipped)
 *   resource-graph.json   every file above with bytes + SHA-256 (validated by the SDK validator)
 *   sw.js                 offline worker bundled from the PUBLIC @aegis/browser/offline/worker export
 *   build-report.json     format marker, base, revision and bundle inputs
 *
 * Builds are staged in a sibling directory and moved into place only after the finished site
 * has been re-read and verified, so an output directory is always complete. An existing output
 * is replaced only with --clean, and only if it is a previous Pearl Sea build.
 */
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { builtinModules } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { isMain, readJson, repositoryRoot } from './lib/tools.mjs';
import {
  BUILD_FORMAT,
  CONTENT_SECURITY_POLICY,
  OFFLINE_ERROR_MESSAGE,
  OFFLINE_NAMESPACE,
  OFFLINE_PACK_ID,
  describeResources,
  listFiles,
  validateBase,
  verifySite,
} from './lib/site.mjs';

const REVISION_PLACEHOLDER = '%PS_OFFLINE_REVISION%';
const TEMPLATE_PLACEHOLDERS = ['%PS_BASE%', REVISION_PLACEHOLDER, '%PS_CSP%'];

/** Authoring metadata that stays in the repository and is never shipped to players. */
const NOT_SHIPPED = [
  /(^|\/)README(\.[a-z]+)?$/i,
  /\.md$/i,
  /\.prompt\.txt$/i,
  /(^|\/)[^/]*provenance[^/]*\.json$/i,
  /(^|\/)(recipes|source|sources|prompts)\//i,
  /\.(mjs|cjs|ts)$/i,
];

/**
 * The content a player needs, relative to content/: the pack, its catalogs and the archived packs
 * that old saves restore with. The word bank and the pack's sources stay in the repository.
 */
const SHIPPED_CONTENT = [
  /^pearl-sea\.content\.json$/,
  /^catalogs\/[^/]+\.json$/,
  /^history\/[^/]+\.json\.gz$/,
];

const nodeBuiltins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);

/** True for module specifiers that must never reach a player's browser. */
export function isForbiddenModule(/** @type {string} */ specifier) {
  return (
    nodeBuiltins.has(specifier) ||
    specifier.startsWith('node:') ||
    specifier === 'three' ||
    specifier.startsWith('three/') ||
    specifier === '@aegis/render-three' ||
    specifier.startsWith('@aegis/render-three/')
  );
}

/** @type {import('esbuild').Plugin} */
export const browserBoundary = {
  name: 'pearl-sea-browser-boundary',
  setup(builder) {
    builder.onResolve({ filter: /.*/ }, (args) =>
      isForbiddenModule(args.path)
        ? {
            errors: [
              {
                text: `Forbidden module in a browser bundle: "${args.path}" (imported by ${args.importer}). Node built-ins, three.js and the 3D renderer are never shipped.`,
              },
            ],
          }
        : undefined,
    );
  },
};

/**
 * @param {import('esbuild').Metafile} metafile
 * @param {string} label
 */
function checkInputs(metafile, label) {
  const inputs = Object.keys(metafile.inputs);
  const bad = inputs.filter(
    (path) =>
      path.startsWith('../') ||
      path.includes('render-three') ||
      path.includes('node_modules/three/') ||
      path.startsWith('node:'),
  );
  if (bad.length) throw new Error(`${label} bundle has forbidden inputs: ${bad.join(', ')}`);
  return inputs.sort();
}

/**
 * @param {string} from
 * @param {string} to
 * @param {(relativePath: string) => boolean} include
 */
function copyTree(from, to, include) {
  if (!existsSync(from)) return 0;
  let copied = 0;
  for (const path of listFiles(from)) {
    if (!include(path)) continue;
    const target = join(to, ...path.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(from, ...path.split('/')), target);
    copied++;
  }
  return copied;
}

/** @param {string} output */
function isPreviousBuild(output) {
  const entries = readdirSync(output);
  if (entries.length === 0) return true;
  const marker = join(output, 'build-report.json');
  try {
    return existsSync(marker) && readJson(marker).format === BUILD_FORMAT;
  } catch {
    return false;
  }
}

/**
 * @param {{ outDir?: string; base?: string; clean?: boolean; sourcemap?: boolean; root?: string }} [options]
 */
export async function buildSite(options = {}) {
  const root = options.root ?? repositoryRoot;
  const base = validateBase(options.base ?? '/');
  const output = resolve(root, options.outDir ?? 'dist-site');
  if (existsSync(output)) {
    if (!options.clean) {
      throw new Error(`Refusing to overwrite ${output}. Pass --clean to replace a previous build.`);
    }
    if (!isPreviousBuild(output)) {
      throw new Error(`Refusing to clean ${output}: it is not a previous Pearl Sea build.`);
    }
  }
  const stage = join(dirname(output), `.${basename(output)}.staging-${process.pid}`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  try {
    const template = readFileSync(join(root, 'src', 'app', 'index.html'), 'utf8');
    for (const placeholder of TEMPLATE_PLACEHOLDERS) {
      if (!template.includes(placeholder)) {
        throw new Error(`src/app/index.html must contain ${placeholder}`);
      }
    }
    const app = await build({
      absWorkingDir: root,
      entryPoints: { app: 'src/app/main.ts' },
      outdir: stage,
      bundle: true,
      platform: 'browser',
      format: 'esm',
      target: 'es2022',
      minify: true,
      metafile: true,
      sourcemap: options.sourcemap ? 'linked' : false,
      logLevel: 'warning',
      plugins: [browserBoundary],
    });
    const appInputs = checkInputs(app.metafile, 'App');
    const content = copyTree(join(root, 'content'), join(stage, 'content'), (path) =>
      SHIPPED_CONTENT.some((pattern) => pattern.test(path)),
    );
    const assets = copyTree(
      join(root, 'assets'),
      join(stage, 'assets'),
      (path) => !NOT_SHIPPED.some((pattern) => pattern.test(path)),
    );
    const html = template
      .replaceAll('%PS_BASE%', base)
      .replaceAll('%PS_CSP%', CONTENT_SECURITY_POLICY);
    writeFileSync(join(stage, 'index.html'), html);
    // MIT requires the notices to travel with copies; the SDK is bundled into app.js.
    writeFileSync(
      join(stage, 'licenses.txt'),
      [
        'Perlové moře (Pearl Sea): dobrodružství s češtinou',
        readFileSync(join(root, 'LICENSE'), 'utf8').trim(),
        'Aegis SDK (@aegis/core, @aegis/runtime, @aegis/narrative, @aegis/browser), bundled in app.js and sw.js',
        readFileSync(join(root, 'node_modules', '@aegis', 'core', 'LICENSE'), 'utf8').trim(),
        "Art and music: made locally and offline. The paintings were made with Qwen-Image-Edit-2511 by the Qwen team (Apache-2.0), run in WanGP by DeepBeepMeep, and cut out with rembg (MIT) and U²-Net (Apache-2.0). The music was made with ACE-Step 1.5 (MIT). Each file's provenance is recorded in the repository.",
        'The reading font, Pearl Reading (a renamed subset of Andika), carries its licence, the SIL Open Font License 1.1, as OFL.txt next to its files under assets/fonts/pearl-reading/.',
      ].join('\n\n') + '\n',
    );
    const provisional = describeResources(stage, base);
    const revision = createHash('sha256')
      .update(JSON.stringify(provisional))
      .digest('hex')
      .slice(0, 24);
    writeFileSync(join(stage, 'index.html'), html.replaceAll(REVISION_PLACEHOLDER, revision));
    const resources = describeResources(stage, base);
    writeFileSync(
      join(stage, 'resource-graph.json'),
      JSON.stringify({ id: OFFLINE_PACK_ID, revision, resources }, null, 2) + '\n',
    );
    const worker = await build({
      absWorkingDir: root,
      entryPoints: ['src/app/sw.ts'],
      outfile: join(stage, 'sw.js'),
      bundle: true,
      platform: 'browser',
      format: 'esm',
      target: 'es2022',
      minify: true,
      metafile: true,
      logLevel: 'warning',
      define: {
        __PS_OFFLINE_PACK_ID__: JSON.stringify(OFFLINE_PACK_ID),
        __PS_OFFLINE_NAMESPACE__: JSON.stringify(OFFLINE_NAMESPACE),
        __PS_OFFLINE_REVISION__: JSON.stringify(revision),
        __PS_OFFLINE_ERROR_MESSAGE__: JSON.stringify(OFFLINE_ERROR_MESSAGE),
      },
      plugins: [browserBoundary],
    });
    const workerInputs = checkInputs(worker.metafile, 'Worker');
    const sdk = readJson(join(root, 'node_modules', '@aegis', 'runtime', 'package.json')).version;
    const report = {
      format: BUILD_FORMAT,
      base,
      revision,
      sdk,
      resources: resources.length,
      bytes: resources.reduce((sum, resource) => sum + resource.bytes, 0),
      copied: { content, assets },
      inputs: { app: appInputs, worker: workerInputs },
    };
    writeFileSync(join(stage, 'build-report.json'), JSON.stringify(report, null, 2) + '\n');
    verifySite(stage);
    if (existsSync(output)) rmSync(output, { recursive: true, force: true });
    renameSync(stage, output);
    return {
      directory: output,
      base,
      revision,
      sdk,
      resources: report.resources,
      bytes: report.bytes,
    };
  } catch (error) {
    rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}

/** @param {string[]} args */
export function parseBuildArgs(args) {
  /** @type {{ outDir?: string; base?: string; clean?: boolean; sourcemap?: boolean }} */
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--out') options.outDir = args[++i];
    else if (arg === '--base') options.base = args[++i];
    else if (arg === '--clean') options.clean = true;
    else if (arg === '--sourcemap') options.sourcemap = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

if (isMain(import.meta.url)) {
  try {
    const result = await buildSite(parseBuildArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
