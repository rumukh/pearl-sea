/**
 * The UI catalogs (content/catalogs/cs.ui.json and en.ui.json) follow the contract's catalog
 * convention (`catalogProblems`, docs/contract.md §7.4); child-facing lines stay within the
 * narrative toolkit's child profile (at most ten words a sentence); placeholders are well formed
 * and every form of a message about a count passes `{count}`; English covers the whole grown-ups'
 * area with the same placeholders; and every message is used.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHILD_PROFILE, tokenizeWords } from '@aegis/narrative';
import { describe, expect, it } from 'vitest';
import { CS_UI as cs, EN_UI as en } from '../../../src/app/i18n/messages';
import { GROWN_UPS_TABS } from '../../../src/app/shell/app';
import {
  catalogProblems,
  GROWN_UPS_KEY_PREFIX,
  placeholders,
  splitCatalogKey,
} from '../../../src/rules/contract';

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
describe('the Czech catalog', () => {
  const keys = Object.keys(cs);

  it('follows the contract’s catalog convention', () => {
    expect(catalogProblems(cs, 'cs')).toEqual([]);
  });

  it('keeps every child-facing sentence within the child profile', () => {
    const long: string[] = [];
    for (const key of keys) {
      if (key.startsWith(GROWN_UPS_KEY_PREFIX)) continue;
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

  it('passes the count to every form of a message about a count', () => {
    const counted = keys.filter((key) => splitCatalogKey(key).plural !== null);
    expect(counted.length).toBeGreaterThan(0);
    for (const key of counted) expect(placeholders(cs[key]!), key).toContain('count');
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
        !source.includes(`'${splitCatalogKey(key).base}'`),
    );
    expect(unused).toEqual([]);
  });
});

describe('the English catalog', () => {
  it('is a flat map of strings that follows the contract’s convention', () => {
    const raw = JSON.parse(
      readFileSync(join('content', 'catalogs', 'en.ui.json'), 'utf8'),
    ) as Record<string, unknown>;
    for (const [key, value] of Object.entries(raw)) expect(typeof value, key).toBe('string');
    // The grown-ups' area only, with one and other forms only.
    expect(catalogProblems(en, 'en')).toEqual([]);
  });

  it('translates the whole grown-ups’ area with the same placeholders', () => {
    const missing: string[] = [];
    for (const key of Object.keys(cs).filter((candidate) =>
      candidate.startsWith(GROWN_UPS_KEY_PREFIX),
    )) {
      // English has no "few" form: 2, 3 and 4 take "other".
      if (splitCatalogKey(key).plural === 'few') continue;
      const english = en[key];
      if (english === undefined) {
        missing.push(key);
        continue;
      }
      expect(placeholders(english), key).toEqual(placeholders(cs[key]!));
    }
    expect(missing).toEqual([]);
  });
});
