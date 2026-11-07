/**
 * The static build: a nested-base site whose offline resource graph is complete, digest-exact,
 * accepted by the SDK's own validator, and free of Node built-ins, three.js and the renderer.
 */
import { build } from 'esbuild';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { browserBoundary, buildSite, isForbiddenModule } from '../../scripts/build.mjs';
import { GRADE_FOUR_GRAPH, verifySite } from '../../scripts/lib/site.mjs';
import { FONT_DIRECTORY, FONT_FACES } from '../../src/app/design/fonts';
import {
  CONTENT_FILE,
  CONTENT_HISTORY_DIRECTORY,
  CONTENT_HISTORY_EXTENSION,
  contentHistoryPath,
} from '../../src/rules/contract';
import {
  DEPLOYMENT_BASE,
  OFFLINE_ERROR_MESSAGE,
  OFFLINE_GRADE_FOUR_PACK_ID,
  OFFLINE_NAMESPACE,
} from '../../src/rules/contract/persistence';

const repository = join(import.meta.dirname, '..', '..');
let directory: string;
let site: Awaited<ReturnType<typeof buildSite>>;
const BASE = DEPLOYMENT_BASE;

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'ps-build-test-'));
  site = await buildSite({ outDir: join(directory, 'site'), base: BASE });
});

afterAll(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

const report = (): {
  base: string;
  revision: string;
  inputs: { app: string[]; worker: string[] };
} => JSON.parse(readFileSync(join(site.directory, 'build-report.json'), 'utf8'));
const graph = (): { resources: { src: string; kind: string }[] } =>
  JSON.parse(readFileSync(join(site.directory, 'resource-graph.json'), 'utf8'));

describe('scripts/build.mjs', () => {
  it('emits a verified offline resource graph for the nested Pages base', () => {
    const verified = verifySite(site.directory);
    expect(verified.base).toBe(BASE);
    expect(verified.revision).toMatch(/^[0-9a-f]{24}$/);
    const sources = graph().resources.map((resource) => resource.src);
    for (const member of ['index.html', 'app.js', 'app.css', 'licenses.txt']) {
      expect(sources, `${member} is installable offline`).toContain(BASE + member);
    }
    expect(sources, 'the worker is not a member of the graph it serves').not.toContain(
      BASE + 'sw.js',
    );
    expect(sources.every((src) => src.startsWith(BASE))).toBe(true);
  });

  it('bundles the SDK from the installed tarballs, never from engine sources', () => {
    const inputs = report().inputs.app;
    // The foundations shell uses @aegis/runtime; the full shell adds the other packages.
    expect(
      inputs.some((path) => path.startsWith('node_modules/@aegis/runtime/dist/')),
      '@aegis/runtime reaches the app bundle',
    ).toBe(true);
    for (const path of inputs.filter((input) => input.includes('@aegis/'))) {
      expect(path, 'an SDK module comes from an installed tarball').toMatch(
        /^node_modules\/@aegis\/(core|runtime|narrative|browser)\/dist\//,
      );
    }
    expect(
      inputs.filter((path) => path.startsWith('../') || path.includes('aegis-engine')),
    ).toEqual([]);
  });

  it('bundles the worker from the public offline worker export and pins this revision', () => {
    expect(report().inputs.worker).toContain('node_modules/@aegis/browser/dist/offline/worker.js');
    expect(readFileSync(join(site.directory, 'sw.js'), 'utf8')).toContain(report().revision);
  });

  it('pins the worker to this game’s pack ID, namespace and message, never Dragon Valley’s', () => {
    const worker = readFileSync(join(site.directory, 'sw.js'), 'utf8');
    expect(worker).toContain(`"${OFFLINE_NAMESPACE}"`);
    expect(worker).toContain(`"${OFFLINE_ERROR_MESSAGE}"`);
    expect(worker).not.toMatch(/dragon-valley|dv-offline/);
    expect(graph().resources.every((resource) => resource.src.startsWith(DEPLOYMENT_BASE))).toBe(
      true,
    );
  });

  it('ships a Czech page with the reading font in its resource graph', () => {
    const index = readFileSync(join(site.directory, 'index.html'), 'utf8');
    expect(index).toMatch(/<html lang="cs">/);
    expect(index).toContain('<title>Perlové moře</title>');
    const sources = graph().resources.map((resource) => resource.src);
    for (const file of FONT_FACES.map((face) => face.file)) {
      expect(sources).toContain(`${BASE}${FONT_DIRECTORY}${file}`);
    }
    expect(sources).toContain(`${BASE}${FONT_DIRECTORY}OFL.txt`);
    expect(sources, 'authoring provenance is not shipped').not.toContain(
      `${BASE}${FONT_DIRECTORY}provenance.json`,
    );
    expect(sources).toContain(`${BASE}content/catalogs/cs.ui.json`);
  });

  it('ships the pack, its catalogs and the history archives, never the content sources', () => {
    const resources = graph().resources;
    const sources = resources.map((resource) => resource.src);
    expect(sources).toContain(`${BASE}content/${CONTENT_FILE}`);
    const archives = readdirSync(join(repository, ...CONTENT_HISTORY_DIRECTORY.split('/'))).filter(
      (name) => name.endsWith(CONTENT_HISTORY_EXTENSION),
    );
    expect(archives.length, 'the repository has archived packs to ship').toBeGreaterThan(0);
    for (const name of archives) {
      const revision = name.slice(0, -CONTENT_HISTORY_EXTENSION.length);
      const archive = resources.find((r) => r.src === `${BASE}${contentHistoryPath(revision)}`);
      expect(archive, `${name} is installable offline`).toMatchObject({ kind: 'data' });
    }
    expect(
      sources.filter((src) => src.startsWith(`${BASE}content/`)).length,
      'nothing else under content/',
    ).toBe(1 + archives.length + readdirSync(join(repository, 'content', 'catalogs')).length);
    expect(sources.filter((src) => /\/content\/(lexicon-src|pack-src)\//.test(src))).toEqual([]);
  });

  it('credits the SDK, the reading font and the local art and music models in licenses.txt', () => {
    const licenses = readFileSync(join(site.directory, 'licenses.txt'), 'utf8');
    expect(licenses).toContain(readFileSync(join(repository, 'LICENSE'), 'utf8').trim());
    for (const credit of [
      'Aegis SDK',
      'Qwen-Image-Edit-2511 by the Qwen team (Apache-2.0)',
      'WanGP by DeepBeepMeep',
      'rembg (MIT) and U²-Net (Apache-2.0)',
      'ACE-Step 1.5 (MIT)',
      'SIL Open Font License 1.1, as OFL.txt',
    ]) {
      expect(licenses, credit).toContain(credit);
    }
  });

  it('builds reproducibly: the same tree yields the same offline revision', async () => {
    const again = await buildSite({ outDir: join(directory, 'again'), base: BASE });
    expect(again.revision).toBe(site.revision);
  });

  it('classifies Node built-ins, three.js and the 3D renderer as forbidden', () => {
    for (const specifier of [
      'fs',
      'node:fs',
      'node:crypto',
      'path',
      'three',
      'three/addons/controls/OrbitControls.js',
      '@aegis/render-three',
    ]) {
      expect(isForbiddenModule(specifier), specifier).toBe(true);
    }
    for (const specifier of ['@aegis/runtime', '@aegis/browser/offline/worker', './main']) {
      expect(isForbiddenModule(specifier), specifier).toBe(false);
    }
  });

  it('fails a bundle that imports a Node built-in', async () => {
    await expect(
      build({
        stdin: { contents: "import { readFileSync } from 'node:fs'; console.log(readFileSync);" },
        bundle: true,
        write: false,
        platform: 'browser',
        logLevel: 'silent',
        plugins: [browserBoundary],
      }),
    ).rejects.toThrow(/Forbidden module in a browser bundle: "node:fs"/);
  });

  it('rejects a site whose bytes drift from its resource graph, even at the same length', () => {
    const copy = join(directory, 'tampered');
    cpSync(site.directory, copy, { recursive: true });
    const original = readFileSync(join(copy, 'app.js'), 'utf8');
    const tampered = (original.startsWith('/') ? ' ' : '/') + original.slice(1);
    expect(tampered.length, 'the tamper keeps the byte count').toBe(original.length);
    expect(tampered).not.toBe(original);
    writeFileSync(join(copy, 'app.js'), tampered);
    expect(() => verifySite(copy)).toThrow(/app\.js/);
  });

  it('rejects an undeclared extra file in the site', () => {
    const copy = join(directory, 'extra');
    cpSync(site.directory, copy, { recursive: true });
    mkdirSync(join(copy, 'content'), { recursive: true });
    writeFileSync(join(copy, 'content', 'surprise.json'), '{}\n');
    expect(() => verifySite(copy)).toThrow(/surprise\.json/);
  });

  it('refuses to overwrite a build without --clean and to clean a foreign directory', async () => {
    await expect(buildSite({ outDir: site.directory, base: BASE })).rejects.toThrow(/Pass --clean/);
    const foreign = join(directory, 'foreign');
    mkdirSync(foreign);
    writeFileSync(join(foreign, 'keep.txt'), 'not a build\n');
    await expect(buildSite({ outDir: foreign, base: BASE, clean: true })).rejects.toThrow(
      /not a previous Pearl Sea build/,
    );
    expect(readFileSync(join(foreign, 'keep.txt'), 'utf8')).toBe('not a build\n');
  });

  it('rejects a base path that is not an absolute directory', async () => {
    for (const base of ['pearl-sea/', '/pearl-sea', '/../', 'https://example.com/']) {
      await expect(buildSite({ outDir: join(directory, 'bad'), base }), base).rejects.toThrow(
        /Base must be/,
      );
    }
  });

  it('puts exactly the catalog entries tagged grade-4 in the grade-4 graph', () => {
    const grade = JSON.parse(readFileSync(join(site.directory, GRADE_FOUR_GRAPH), 'utf8')) as {
      id: string;
      revision: string;
      resources: { src: string }[];
    };
    expect(grade.id).toBe(OFFLINE_GRADE_FOUR_PACK_ID);
    expect(grade.revision).toBe(report().revision);
    expect(grade.resources.map((resource) => resource.src).sort()).toEqual(taggedFiles());
  });
});

/** The site paths of the published catalog's grade-4 entries, sorted. */
function taggedFiles(): string[] {
  const catalog = JSON.parse(
    readFileSync(join(repository, 'assets', 'art', 'catalog.json'), 'utf8'),
  ) as {
    entries: { file: string; pack?: string }[];
  };
  return catalog.entries
    .filter((entry) => entry.pack === 'grade-4')
    .map((entry) => `${BASE}assets/art/${entry.file}`)
    .sort();
}
describe('the grade-4 pack', () => {
  const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
  let split: Awaited<ReturnType<typeof buildSite>>;

  beforeAll(async () => {
    split = await buildSite({
      outDir: join(directory, 'grade-four'),
      base: BASE,
      extraArt: [
        {
          entry: {
            id: 'scene/test-deep',
            kind: 'painted',
            file: 'scenes/test-deep.svg',
            width: 10,
            height: 10,
            pack: 'grade-4',
          },
          body: SVG,
        },
        {
          entry: {
            id: 'scene/test-core',
            kind: 'painted',
            file: 'scenes/test-core.svg',
            width: 10,
            height: 10,
          },
          body: SVG.replace('10"/>', '9"/>'),
        },
      ],
    });
  });

  const read = (file: string) =>
    JSON.parse(readFileSync(join(split.directory, file), 'utf8')) as {
      id: string;
      revision: string;
      resources: { src: string }[];
    };

  it('puts the files of entries tagged grade-4 in their own graph, and only there', () => {
    expect(verifySite(split.directory).revision).toMatch(/^[0-9a-f]{24}$/);
    const core = read('resource-graph.json').resources.map((resource) => resource.src);
    const grade = read(GRADE_FOUR_GRAPH);
    expect(grade.id).toBe(OFFLINE_GRADE_FOUR_PACK_ID);
    expect(grade.revision).toBe(read('resource-graph.json').revision);
    expect(grade.resources.map((resource) => resource.src).sort()).toEqual(
      [...taggedFiles(), `${BASE}assets/art/scenes/test-deep.svg`].sort(),
    );
    expect(core).not.toContain(`${BASE}assets/art/scenes/test-deep.svg`);
    expect(core, 'an untagged entry stays core').toContain(
      `${BASE}assets/art/scenes/test-core.svg`,
    );
    expect(core, 'the catalog itself is core').toContain(`${BASE}assets/art/catalog.json`);
  });

  it('pins the worker to the grade-4 pack ID too', () => {
    expect(readFileSync(join(split.directory, 'sw.js'), 'utf8')).toContain(
      `"${OFFLINE_GRADE_FOUR_PACK_ID}"`,
    );
  });

  it('rejects a grade-4 graph that drifts from the catalog’s tags', () => {
    const copy = join(directory, 'grade-four-drift');
    cpSync(split.directory, copy, { recursive: true });
    const grade = read(GRADE_FOUR_GRAPH);
    writeFileSync(join(copy, GRADE_FOUR_GRAPH), JSON.stringify({ ...grade, resources: [] }));
    expect(() => verifySite(copy)).toThrow(/grade-4 files/);
  });
});
