/**
 * The content gate (scripts/validate-content.mjs) on throwaway trees: catalogs are flat Czech
 * string maps, English is limited to the grown-ups' area, Czech typography holds, and every
 * character is in the reading font.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
    catalog('en.ui.json', { 'app.title': 'Pearl Sea', 'grownups.help': 'Help' });
    const { errors } = await validateContentTree({ root });
    expect(errors).toEqual([
      'catalogs/en.ui.json "app.title": only the grown-ups\' area is translated (keys start with "grownups.")',
      'catalogs/en.ui.json "grownups.help": missing from catalogs/cs.ui.json',
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
