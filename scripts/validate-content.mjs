// @ts-check
/**
 * Content validation gate:
 *
 *   node scripts/validate-content.mjs
 *
 * 1. Catalogs: every `content/catalogs/<locale>.<scope>.json` is a flat map of non-empty strings
 *    for a supported locale. Czech (`cs`) holds every string of the game and `cs.ui.json` must
 *    exist. English (`en`) exists only for the grown-ups' area: every English key starts with
 *    `grownups.` and also exists in the Czech catalog of the same scope.
 * 2. Czech typography in Czech catalogs: the quotation marks „…“ and ‚…‘ instead of straight
 *    quotes, the ellipsis … instead of three dots, the en dash – instead of a spaced hyphen, no
 *    space before , . ; : ! ? and none inside quotation marks or brackets.
 * 3. Every character of every catalog string is in the reading font (the ranges recorded in
 *    assets/fonts/pearl-reading/provenance.json), so no text ever falls back to a system font.
 *
 * The content pack, its history, art references and curriculum coverage join this gate with the
 * domain contract (docs/contract.md).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isMain, repositoryRoot } from './lib/tools.mjs';

export const LOCALES = ['cs', 'en'];
/** The locale that holds every string. */
export const MASTER_LOCALE = 'cs';
/** English strings exist only for keys of the grown-ups' area. */
export const GROWN_UPS_PREFIX = 'grownups.';
export const FONT_PROVENANCE = 'assets/fonts/pearl-reading/provenance.json';

const CATALOG_FILE = /^([a-z]{2})\.([a-z][a-z0-9-]*)\.json$/;

/**
 * Parse provenance ranges such as `U+0020-007E` and `U+2009` into inclusive code point pairs.
 * @param {readonly string[]} ranges
 * @returns {[number, number][]}
 */
export function parseRanges(ranges) {
  return ranges.map((range) => {
    const match = /^U\+([0-9A-F]{4,6})(?:-([0-9A-F]{4,6}))?$/.exec(range);
    if (!match?.[1]) throw new Error(`Not a code point range: ${range}`);
    const from = Number.parseInt(match[1], 16);
    return [from, match[2] ? Number.parseInt(match[2], 16) : from];
  });
}

/**
 * Typographic problems of one Czech string (an empty list when it is fine).
 * @param {string} text
 * @returns {string[]}
 */
export function czechTypographyProblems(text) {
  /** @type {string[]} */
  const problems = [];
  if (text.includes('"')) problems.push('a straight double quote: use „…“');
  if (text.includes("'")) problems.push('a straight single quote: use ‚…‘ or the apostrophe ’');
  if (text.includes('...')) problems.push('three dots: use the ellipsis …');
  if (/\s-\s/.test(text)) problems.push('a spaced hyphen: use the en dash –');
  if (/\s[,.;:!?]/.test(text)) problems.push('a space before , . ; : ! or ?');
  if (/[„‚(]\s/.test(text)) problems.push('a space after an opening quotation mark or bracket');
  if (/\s[“‘)]/.test(text)) problems.push('a space before a closing quotation mark or bracket');
  return problems;
}

/** @param {unknown} value */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {{ root?: string }} [options]
 */
export async function validateContentTree(options = {}) {
  const root = options.root ?? repositoryRoot;
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  const catalogDir = join(root, 'content', 'catalogs');
  if (!existsSync(catalogDir)) {
    errors.push('content/catalogs is missing');
    return { errors, warnings, summary: null };
  }

  /** @type {Map<string, { locale: string; scope: string; entries: Record<string, string> }>} */
  const catalogs = new Map();
  for (const name of readdirSync(catalogDir).sort()) {
    const match = CATALOG_FILE.exec(name);
    if (!match?.[1] || !match[2]) {
      errors.push(`catalogs/${name}: not a <locale>.<scope>.json catalog`);
      continue;
    }
    if (!LOCALES.includes(match[1])) {
      errors.push(`catalogs/${name}: unsupported locale "${match[1]}" (${LOCALES.join(', ')})`);
      continue;
    }
    /** @type {unknown} */
    let value;
    try {
      value = JSON.parse(readFileSync(join(catalogDir, name), 'utf8'));
    } catch (error) {
      errors.push(`catalogs/${name}: not JSON (${error instanceof Error ? error.message : error})`);
      continue;
    }
    if (!isRecord(value)) {
      errors.push(`catalogs/${name}: not a flat object of strings`);
      continue;
    }
    const bad = Object.entries(/** @type {Record<string, unknown>} */ (value))
      .filter(([, text]) => typeof text !== 'string' || text.length === 0)
      .map(([key]) => key);
    if (bad.length) errors.push(`catalogs/${name}: non-string or empty entries: ${bad.join(', ')}`);
    catalogs.set(name, {
      locale: match[1],
      scope: match[2],
      entries: /** @type {Record<string, string>} */ (value),
    });
  }
  if (!catalogs.has(`${MASTER_LOCALE}.ui.json`)) {
    errors.push(`catalogs/${MASTER_LOCALE}.ui.json is missing: Czech holds every UI string`);
  }

  for (const [name, catalog] of catalogs) {
    if (catalog.locale === MASTER_LOCALE) {
      for (const [key, text] of Object.entries(catalog.entries)) {
        if (typeof text !== 'string') continue;
        for (const problem of czechTypographyProblems(text)) {
          errors.push(`catalogs/${name} "${key}": ${problem}`);
        }
      }
      continue;
    }
    const czech = catalogs.get(`${MASTER_LOCALE}.${catalog.scope}.json`)?.entries ?? {};
    for (const key of Object.keys(catalog.entries)) {
      if (!key.startsWith(GROWN_UPS_PREFIX)) {
        errors.push(
          `catalogs/${name} "${key}": only the grown-ups' area is translated (keys start with "${GROWN_UPS_PREFIX}")`,
        );
      } else if (czech[key] === undefined) {
        errors.push(
          `catalogs/${name} "${key}": missing from catalogs/${MASTER_LOCALE}.${catalog.scope}.json`,
        );
      }
    }
  }

  const provenanceFile = join(root, ...FONT_PROVENANCE.split('/'));
  if (!existsSync(provenanceFile)) {
    errors.push(`${FONT_PROVENANCE} is missing: the reading font's coverage cannot be checked`);
  } else {
    const ranges = parseRanges(JSON.parse(readFileSync(provenanceFile, 'utf8')).ranges ?? []);
    /** @param {number} code */
    const covered = (code) => ranges.some(([from, to]) => code >= from && code <= to);
    for (const [name, catalog] of catalogs) {
      for (const [key, text] of Object.entries(catalog.entries)) {
        if (typeof text !== 'string') continue;
        const missing = [...new Set([...text])].filter(
          (char) => !covered(char.codePointAt(0) ?? 0),
        );
        if (missing.length) {
          const list = missing.map(
            (char) => `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`,
          );
          errors.push(
            `catalogs/${name} "${key}": ${list.join(', ')} not in the reading font (${FONT_PROVENANCE})`,
          );
        }
      }
    }
  }

  return {
    errors,
    warnings,
    summary: {
      catalogs: Object.fromEntries(
        [...catalogs].map(([name, catalog]) => [name, Object.keys(catalog.entries).length]),
      ),
    },
  };
}

if (isMain(import.meta.url)) {
  const { errors, warnings, summary } = await validateContentTree();
  for (const warning of warnings) console.log(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);
  if (summary) console.log(`content ${JSON.stringify(summary)}`);
  console.log(errors.length ? `${errors.length} content error(s).` : 'Content is valid.');
  process.exit(errors.length ? 1 : 0);
}
