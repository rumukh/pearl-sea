/**
 * The content gate (scripts/validate-content.mjs) on throwaway trees: catalogs are flat Czech
 * string maps, English is limited to the grown-ups' area, Czech typography holds, and every
 * character is in the reading font.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectArtIds, collectCatalogKeys, SHELL_ART_IDS } from '../../src/rules/contract';
import type { ContentData } from '../../src/rules/contract';
import { compressArchive } from '../../scripts/lib/history.mjs';
import {
  czechTypographyProblems,
  FONT_PROVENANCE,
  parseRanges,
  validateContentTree,
} from '../../scripts/validate-content.mjs';

const repository = join(import.meta.dirname, '..', '..');
let root: string;

function catalog(name: string, value: unknown): void {
  writeFileSync(join(root, 'content', 'catalogs', name), JSON.stringify(value, null, 2));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ps-content-'));
  mkdirSync(join(root, 'content', 'catalogs'), { recursive: true });
  mkdirSync(join(root, 'assets', 'fonts', 'pearl-reading'), { recursive: true });
  cpSync(
    join(repository, ...FONT_PROVENANCE.split('/')),
    join(root, ...FONT_PROVENANCE.split('/')),
  );
  catalog('cs.ui.json', {
    'app.title': 'Perlové moře',
    'grownups.title': 'Pro dospělé',
    'hint.family': 'Najdi příbuzné slovo: mlýn → mlynář.',
  });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('scripts/validate-content.mjs', () => {
  it('accepts the repository’s own content', async () => {
    const { errors } = await validateContentTree();
    expect(errors).toEqual([]);
  });

  it('accepts Czech catalogs and an English grown-ups’ catalog', async () => {
    catalog('en.ui.json', { 'grownups.title': 'For grown-ups' });
    const { errors, summary } = await validateContentTree({ root });
    expect(errors).toEqual([]);
    expect(summary?.catalogs).toEqual({ 'cs.ui.json': 3, 'en.ui.json': 1 });
  });

  it('requires the Czech UI catalog and refuses unknown locales and file names', async () => {
    rmSync(join(root, 'content', 'catalogs', 'cs.ui.json'));
    catalog('de.ui.json', { 'app.title': 'Perlenmeer' });
    catalog('strings.json', {});
    const { errors } = await validateContentTree({ root });
    expect(errors.join('\n')).toMatch(/cs\.ui\.json is missing/);
    expect(errors.join('\n')).toMatch(/unsupported locale "de"/);
    expect(errors.join('\n')).toMatch(/strings\.json: not a <locale>\.<scope>\.json catalog/);
  });

  it('refuses nested, empty and non-string entries', async () => {
    catalog('cs.ui.json', { a: '', b: 3, c: { d: 'e' }, f: 'Ryba' });
    const { errors } = await validateContentTree({ root });
    expect(errors).toEqual(['catalogs/cs.ui.json: non-string or empty entries: a, b, c']);
  });

  it('translates only the grown-ups’ area, and only keys Czech has', async () => {
    catalog('en.ui.json', {
      'app.title': 'Pearl Sea',
      'grownups.help': 'Help',
      'grownups.title': 'For grown-ups',
    });
    const { errors } = await validateContentTree({ root });
    expect(errors).toEqual([
      'catalogs/en.ui.json "app.title": English exists only for keys starting "grownups.".',
      'catalogs/en.ui.json "grownups.help": missing from catalogs/cs.ui.json',
    ]);
  });

  it('requires English for every grown-ups’ string, plural sets by their base', async () => {
    const czech = {
      'app.title': 'Perlové moře',
      'grownups.title': 'Pro dospělé',
      'grownups.days.one': '{n} den',
      'grownups.days.few': '{n} dny',
      'grownups.days.other': '{n} dní',
    };
    catalog('cs.ui.json', czech);
    expect((await validateContentTree({ root })).errors).toEqual([
      'catalogs/cs.ui.json "grownups.title": no English in catalogs/en.ui.json (the grown-ups\' area has an English switch)',
      'catalogs/cs.ui.json "grownups.days": no English in catalogs/en.ui.json (the grown-ups\' area has an English switch)',
    ]);
    catalog('en.ui.json', {
      'grownups.title': 'For grown-ups',
      'grownups.days.one': '{n} day',
      'grownups.days.other': '{n} days',
    });
    expect((await validateContentTree({ root })).errors).toEqual([]);
  });

  it('enforces the address and plural convention, and one Czech scope per key', async () => {
    catalog('cs.ui.json', {
      'app.title': 'Perlové moře',
      'praise.done.boy': 'Dokázal jsi to!',
      'coins.one': 'mince',
      'coins.other': 'mincí',
    });
    catalog('cs.content.json', { 'app.title': 'Perlové moře' });
    const { errors } = await validateContentTree({ root });
    expect(errors).toEqual([
      'catalogs/cs.ui.json "app.title": also in catalogs/cs.content.json',
      'catalogs/cs.ui.json "praise.done.boy": needs its pair "praise.done.girl".',
      'catalogs/cs.ui.json "praise.done.boy": needs the neutral form "praise.done".',
      'catalogs/cs.ui.json "coins.one": the plural set needs "coins.few".',
      'catalogs/cs.ui.json "coins.other": the plural set needs "coins.few".',
    ]);
  });

  it('enforces Czech typography in Czech catalogs', async () => {
    catalog('cs.ui.json', { 'app.title': 'Řekla "ahoj" a pak... - konec !' });
    const { errors } = await validateContentTree({ root });
    expect(errors.map((error) => error.replace(/^.*?: /, ''))).toEqual([
      'a straight double quote: use „…“',
      'three dots: use the ellipsis …',
      'a spaced hyphen: use the en dash –',
      'a space before , . ; : ! or ?',
    ]);
  });

  it('refuses characters the reading font cannot draw', async () => {
    catalog('cs.ui.json', { 'app.title': 'Perlové moře 🐙 za 5 €' });
    const { errors } = await validateContentTree({ root });
    expect(errors).toEqual([
      'catalogs/cs.ui.json "app.title": U+1F419, U+20AC not in the reading font (assets/fonts/pearl-reading/provenance.json)',
    ]);
  });

  it('parses font ranges and judges Czech typography string by string', () => {
    expect(parseRanges(['U+0020-007E', 'U+2009'])).toEqual([
      [0x20, 0x7e],
      [0x2009, 0x2009],
    ]);
    expect(() => parseRanges(['0020-007E'])).toThrow(/Not a code point range/);
    expect(czechTypographyProblems('Řekla: „Ahoj!“ A pak… plavala dál – k útesu.')).toEqual([]);
    expect(czechTypographyProblems('„ ahoj “')).toEqual([
      'a space after an opening quotation mark or bracket',
      'a space before a closing quotation mark or bracket',
    ]);
    expect(czechTypographyProblems("it's")).toEqual([
      'a straight single quote: use ‚…‘ or the apostrophe ’',
    ]);
  });
});

describe('scripts/validate-content.mjs with a content pack', () => {
  const fixture = readFileSync(
    join(repository, 'test', 'fixtures', 'contract', 'mini-pack.json'),
    'utf8',
  );
  const pack = (): { revision: string; data: ContentData } => JSON.parse(fixture);
  const writePack = (value: unknown, name = 'pearl-sea.content.json') =>
    writeFileSync(join(root, 'content', name), JSON.stringify(value));
  /** Archive a pack as npm run content:bump does, under content/history/. */
  const writeArchive = (value: unknown, name: string) => {
    mkdirSync(join(root, 'content', 'history'), { recursive: true });
    writeFileSync(
      join(root, 'content', 'history', name),
      compressArchive(Buffer.from(JSON.stringify(value))),
    );
  };
  const strings = (keys: readonly string[]) => Object.fromEntries(keys.map((key) => [key, 'Text']));
  const keysOf = (value: { data: ContentData }) =>
    collectCatalogKeys(value.data).map(({ key }) => key);
  const curriculum = (monsterLevels: string) =>
    [
      '# Curriculum',
      '',
      '## 2. Objectives',
      '',
      '| ID | Strand | Grade | RVP |',
      '|---|---|---|---|',
      '| `obj.letters.hard-soft` | letters-sounds | 3 | ČJL-3-2-08 |',
      '| `obj.structure.root` | word-structure | 4 | ČJL-5-2-02 |',
      '',
      '## 3. Objectives by level and monster',
      '',
      '| Objective | Lessons | Monster levels |',
      '|---|---|---|',
      '| `obj.letters.hard-soft` | `sunny-lagoon.1` | `sunny-lagoon.monster` |',
      `| \`obj.structure.root\` | \`moon-caves.1\` | ${monsterLevels} |`,
      '',
      '## 4. Generator bounds',
      '',
    ].join('\n');

  beforeEach(() => {
    mkdirSync(join(root, 'docs'), { recursive: true });
    writePack(pack());
    catalog('cs.content.json', strings(keysOf(pack())));
    catalog('en.ui.json', { 'grownups.title': 'For grown-ups' });
    catalog(
      'en.content.json',
      strings(keysOf(pack()).filter((key) => key.startsWith('grownups.'))),
    );
    writeFileSync(join(root, 'docs', 'curriculum.md'), curriculum('`moon-caves.monster`'));
  });

  it('accepts a valid pack whose strings, history and curriculum agree', async () => {
    writeArchive(pack(), '0.0.1.json.gz');
    const { errors, warnings, summary } = await validateContentTree({ root, strictCoverage: true });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([
      'assets/art/catalog.json is not published yet: art references were not checked',
    ]);
    expect(summary?.pack).toMatchObject({
      revision: '0.0.1',
      levels: 4,
      objectives: 2,
      uncovered: 0,
      history: 1,
    });
    expect(summary?.curriculum).toEqual({ objectives: 2, uncovered: 0 });
  });

  it('keeps story lines to the child profile: at most 10 words a sentence', async () => {
    const keys = keysOf(pack());
    const czech = strings(keys);
    czech['story.prologue.2'] =
      'Osmička plave s Bublinkou daleko za útes, kde spí velká stará muréna. Ahoj!';
    catalog('cs.content.json', czech);
    expect((await validateContentTree({ root })).errors).toEqual([
      'story.prologue.2: "Osmička plave s Bublinkou daleko za útes, kde spí velká stará muréna" has 12 words (max 10)',
    ]);
  });

  it('reports pack diagnostics, missing strings and a wrongly named archive', async () => {
    const broken = pack();
    broken.data.levels[0]!.activities[0]!.skills = ['sk.nowhere'];
    writePack(broken);
    expect((await validateContentTree({ root })).errors.join('\n')).toMatch(
      /\[missing-reference\] Unknown skill "sk\.nowhere"/,
    );

    writePack(pack());
    const keys = keysOf(pack()).filter((key) => key !== 'region.moon-caves');
    catalog('cs.content.json', strings(keys));
    writeArchive(pack(), '0.0.0.json.gz');
    expect((await validateContentTree({ root })).errors).toEqual([
      'catalogs: no Czech "region.moon-caves" (region moon-caves)',
      'history/0.0.0.json.gz: file name must be its revision',
      'history/0.0.0.json.gz: the catalogs lost "region.moon-caves" (region moon-caves), which a save restored with this pack still shows',
    ]);
  });

  it('keeps content/history to archives that every gzip reader reads alike', async () => {
    writeArchive(pack(), '0.0.1.json.gz');
    writePack(pack(), 'history/0.0.1.json');
    const linux = gzipSync(JSON.stringify(pack()));
    linux[9] = 3;
    writeFileSync(join(root, 'content', 'history', '0.0.2.json.gz'), linux);
    expect((await validateContentTree({ root })).errors).toEqual([
      'history/0.0.1.json: content/history holds only <revision>.json.gz archives, written by npm run content:bump',
      'history/0.0.2.json.gz: the gzip header names an operating system',
    ]);
  });

  it('gates curriculum coverage and the level mapping with --strict-coverage', async () => {
    writeFileSync(join(root, 'docs', 'curriculum.md'), curriculum(' '));
    const relaxed = await validateContentTree({ root });
    expect(relaxed.warnings).toContain('curriculum: obj.structure.root has no monster level');
    expect(relaxed.errors).toEqual([
      'level moon-caves.monster teaches [obj.structure.root] but docs/curriculum.md §3 maps []',
    ]);
    const strict = await validateContentTree({ root, strictCoverage: true });
    expect(strict.errors).toContain('curriculum: obj.structure.root has no monster level');

    const uncovered = pack();
    uncovered.data.levels.find((l) => l.id === 'moon-caves.monster')!.objectives = [];
    writePack(uncovered);
    const gaps = await validateContentTree({ root, strictCoverage: true });
    expect(gaps.errors).toContain('content: obj.structure.root has no monster level');
  });

  it('checks art references against the published art catalog, strictly with --strict-art', async () => {
    const ids = collectArtIds(pack().data).map(({ id }) => id);
    const missing = ['monster/humr-nuzkar/freed', 'character/osmicka/happy'];
    mkdirSync(join(root, 'assets', 'art'), { recursive: true });
    const publish = (cosmeticSide: number) => {
      const entries = [...new Set([...ids, ...SHELL_ART_IDS])]
        .filter((id) => !missing.includes(id))
        .map((id) => {
          const side = id.startsWith('cosmetic/') ? cosmeticSide : 512;
          return { id, kind: 'svg', file: `${id}.svg`, width: side, height: side };
        });
      writeFileSync(
        join(root, 'assets', 'art', 'catalog.json'),
        JSON.stringify({ format: 'pearl-sea-art-catalog/1', entries }),
      );
    };
    publish(100);
    const messages = [
      'Art ID "monster/humr-nuzkar/freed" (monster humr-nuzkar) is not in assets/art/catalog.json.',
      'Art ID "character/osmicka/happy" (shown by the shell) is not in assets/art/catalog.json.',
    ];
    const relaxed = await validateContentTree({ root });
    expect(relaxed.errors).toEqual([]);
    expect(relaxed.warnings).toEqual(expect.arrayContaining(messages));
    expect((await validateContentTree({ root, strictArt: true })).errors).toEqual(messages);

    publish(512);
    expect((await validateContentTree({ root })).errors).toEqual([
      'assets/art/catalog.json: not a pearl-sea-art-catalog/1 catalog (content  : [invalid-data] cosmetic/hat-captain: a cosmetic is an SVG with a 100 × 100 viewBox.)',
    ]);
  });
});
