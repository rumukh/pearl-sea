/**
 * The UI catalogs (content/catalogs/cs.ui.json and en.ui.json): child-facing lines stay within
 * the narrative toolkit's child profile (at most ten words a sentence), placeholders are well
 * formed, plural and address variants are complete, English covers the whole grown-ups' area with
 * the same placeholders, and every message is used.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHILD_PROFILE, tokenizeWords } from '@aegis/narrative';
import { describe, expect, it } from 'vitest';
import { CS_UI as cs, EN_UI as en, placeholders } from '../../../src/app/i18n/messages';
import { GROWN_UPS_TABS } from '../../../src/app/shell/app';

const GROWN_UPS = 'grownups.';
const PLURAL = /^(.+)\.(one|few|other)(?:\.(boy|girl))?$/;
const ADDRESS = /^(.+)\.(boy|girl)$/;

/** Keys built at runtime from a vocabulary, so they never appear literally in the source. */
const DYNAMIC_PREFIXES = ['grownups.tab.', 'grownups.language.cs', 'grownups.language.en'];

function sentences(text: string): string[] {
  return text
    .replace(/\{[A-Za-z][A-Za-z0-9_]*\}/g, 'X')
    .split(/[.!?…]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

/** The key a variant or a plural form belongs to (`coins.label` for `coins.label.few`). */
function baseOf(key: string): string {
  const address = ADDRESS.exec(key);
  const withoutAddress = address ? address[1]! : key;
  const plural = PLURAL.exec(withoutAddress);
  return plural ? plural[1]! : withoutAddress;
}

describe('the Czech catalog', () => {
  const keys = Object.keys(cs);

  it('keeps every child-facing sentence within the child profile', () => {
    const long: string[] = [];
    for (const key of keys) {
      if (key.startsWith(GROWN_UPS)) continue;
      for (const sentence of sentences(cs[key]!)) {
        if (tokenizeWords(sentence).length > CHILD_PROFILE.maxWordsPerSentence) {
          long.push(`${key}: ${sentence}`);
        }
      }
    }
    expect(long).toEqual([]);
  });

  it('has no empty messages and only well-formed placeholders', () => {
    for (const key of keys) {
      const text = cs[key]!;
      expect(text.trim(), key).not.toBe('');
      expect(text.replace(/\{[A-Za-z][A-Za-z0-9_]*\}/g, ''), key).not.toMatch(/[{}]/);
    }
  });

  it('gives every message about a count its one, few and other forms, each with {count}', () => {
    const bases = new Set(keys.filter((key) => PLURAL.test(key)).map(baseOf));
    expect(bases.size).toBeGreaterThan(0);
    for (const base of bases) {
      for (const form of ['one', 'few', 'other']) {
        const key = `${base}.${form}`;
        expect(cs, key).toHaveProperty([key]);
        expect(placeholders(cs[key]!), key).toContain('count');
      }
    }
  });

  it('gives a gendered message both forms and a neutral phrasing to fall back on', () => {
    for (const key of keys.filter((candidate) => ADDRESS.test(candidate))) {
      const neutral = ADDRESS.exec(key)![1]!;
      expect(cs, `${key} needs its neutral phrasing`).toHaveProperty([neutral]);
      for (const form of ['boy', 'girl']) {
        expect(cs, `${key} comes in a pair`).toHaveProperty([`${neutral}.${form}`]);
      }
      expect(placeholders(cs[key]!).sort(), key).toEqual(placeholders(cs[neutral]!).sort());
    }
  });

  it('names every tab and both languages of the grown-ups’ area', () => {
    for (const tab of GROWN_UPS_TABS) expect(cs).toHaveProperty([`grownups.tab.${tab}`]);
    expect(cs['grownups.language.cs']).toBe('Čeština');
    expect(cs['grownups.language.en']).toBe('English');
  });

  it('uses every message somewhere in the shell', () => {
    const source = sourceFiles(join('src', 'app'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    const unused = keys.filter(
      (key) =>
        !DYNAMIC_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
        !source.includes(`'${key}'`) &&
        !source.includes(`'${baseOf(key)}'`),
    );
    expect(unused).toEqual([]);
  });
});

describe('the English catalog', () => {
  it('is a flat map of strings for the grown-ups’ area only', () => {
    const raw = JSON.parse(
      readFileSync(join('content', 'catalogs', 'en.ui.json'), 'utf8'),
    ) as Record<string, unknown>;
    for (const [key, value] of Object.entries(raw)) {
      expect(typeof value, key).toBe('string');
      expect(key.startsWith(GROWN_UPS), key).toBe(true);
    }
  });

  it('translates the whole grown-ups’ area with the same placeholders', () => {
    const missing: string[] = [];
    for (const key of Object.keys(cs).filter((candidate) => candidate.startsWith(GROWN_UPS))) {
      // English has no "few" form: 2, 3 and 4 take "other".
      if (PLURAL.exec(key)?.[2] === 'few') continue;
      const english = en[key];
      if (english === undefined) {
        missing.push(key);
        continue;
      }
      expect(placeholders(english).sort(), key).toEqual(placeholders(cs[key]!).sort());
    }
    expect(missing).toEqual([]);
    for (const key of Object.keys(en)) {
      expect(PLURAL.exec(key)?.[2], `${key}: English has no few form`).not.toBe('few');
    }
  });
});
