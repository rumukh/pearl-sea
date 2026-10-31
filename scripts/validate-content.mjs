// @ts-check
/**
 * Content validation gate:
 *
 *   node scripts/validate-content.mjs [--strict-coverage] [--strict-art]
 *
 * 1. Catalogs: every `content/catalogs/<locale>.<scope>.json` is a flat map of non-empty strings
 *    for a supported locale. Czech (`cs`) holds every string of the game, `cs.ui.json` must exist
 *    and a key lives in one Czech scope only. English (`en`) exists only for the grown-ups' area
 *    and only for keys Czech has.
 * 2. The catalog convention (docs/contract.md §7.4, `catalogProblems`): the bare key is the
 *    neutral phrasing; `.boy`/`.girl` come as a pair beside it; Czech plurals `.one`/`.few`/
 *    `.other` come as a set; English uses `grownups.*` keys with `.one`/`.other` only.
 * 3. Czech typography in Czech catalogs: the quotation marks „…“ and ‚…‘ instead of straight
 *    quotes, the ellipsis … instead of three dots, the en dash – instead of a spaced hyphen, no
 *    space before , . ; : ! ? and none inside quotation marks or brackets.
 * 4. Every character of every catalog string is in the reading font (the ranges recorded in
 *    assets/fonts/pearl-reading/provenance.json), so no text ever falls back to a system font.
 * 5. The content pack `content/pearl-sea.content.json` (once S3 ships it) against the contract's
 *    registration: schema, references, unlock reachability, skill item universes, activities,
 *    balance sanity and the lexicon's linguistic checks; every catalog key it uses resolves in
 *    Czech; story lines keep to the child profile (@aegis/narrative `CHILD_PROFILE`: at most 10
 *    words a sentence); every archived pack in content/history/ stays valid, is named by its
 *    revision and keeps its catalog keys.
 * 6. Art references are checked against assets/art/catalog.json once the art pipeline publishes
 *    it: reported, or failing the gate with --strict-art.
 * 7. Curriculum coverage: docs/curriculum.md maps every objective to at least one lesson and one
 *    monster level, and so does the pack for the objectives it lists; the pack's levels teach
 *    exactly the objectives the document maps to them. Coverage gaps are reported, or fail the
 *    gate with --strict-coverage (on in `npm run verify`).
 *
 * The TypeScript contract is bundled with esbuild into a temporary module once per process, as
 * Dragon Valley's gate does, so this runs on plain Node with no TypeScript loader. The contract is
 * always this repository's code; `root` only chooses the content tree to check.
 */
import { build } from 'esbuild';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { curriculumProblems, packMappingProblems, parseCurriculum } from './lib/curriculum.mjs';
import { isMain, repositoryRoot } from './lib/tools.mjs';

export const LOCALES = ['cs', 'en'];
/** The locale that holds every string. */
export const MASTER_LOCALE = 'cs';
export const FONT_PROVENANCE = 'assets/fonts/pearl-reading/provenance.json';
export const CURRICULUM_DOC = 'docs/curriculum.md';

const CATALOG_FILE = /^([a-z]{2})\.([a-z][a-z0-9-]*)\.json$/;

/** @type {Promise<any> | null} */
let contract = null;

/** The domain contract (src/rules/contract), bundled once per process. */
export function loadContract() {
  contract ??= (async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ps-contract-'));
    try {
      const file = join(directory, 'contract.mjs');
      await build({
        absWorkingDir: repositoryRoot,
        stdin: {
          contents: `export * from './src/rules/contract/index.ts';
export { parseContentJson } from '@aegis/runtime';
export { CHILD_PROFILE, tokenizeWords } from '@aegis/narrative';`,
          resolveDir: repositoryRoot,
          loader: 'ts',
        },
        outfile: file,
        bundle: true,
        platform: 'node',
        format: 'esm',
        target: 'es2022',
        logLevel: 'warning',
      });
      return await import(pathToFileURL(file).href);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  })();
  return contract;
}

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

/** @param {{ file?: string; recordId?: string; path?: string; code: string; message: string }} d */
function diagnostic(d) {
  return `${d.file ?? 'content'} ${d.recordId ?? ''} ${d.path ?? ''}: [${d.code}] ${d.message}`;
}

/**
 * @param {{ root?: string; strictCoverage?: boolean; strictArt?: boolean }} [options]
 */
export async function validateContentTree(options = {}) {
  const root = options.root ?? repositoryRoot;
  const domain = await loadContract();
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  /** @param {boolean} strict @param {string} message */
  const gate = (strict, message) => (strict ? errors : warnings).push(message);

  const catalogDir = join(root, 'content', 'catalogs');
  if (!existsSync(catalogDir)) {
    errors.push('content/catalogs is missing');
    return { errors, warnings, summary: null };
  }

  // 1. Catalog files.
  /** @type {Map<string, { locale: 'cs' | 'en'; scope: string; entries: Record<string, string> }>} */
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
      locale: /** @type {'cs' | 'en'} */ (match[1]),
      scope: match[2],
      entries: /** @type {Record<string, string>} */ (value),
    });
  }
  if (!catalogs.has(`${MASTER_LOCALE}.ui.json`)) {
    errors.push(`catalogs/${MASTER_LOCALE}.ui.json is missing: Czech holds every UI string`);
  }

  /** Every Czech string, all scopes merged; a key may live in one scope only. */
  /** @type {Record<string, string>} */
  const czech = {};
  /** @type {Map<string, string>} */
  const homes = new Map();
  for (const [name, catalog] of catalogs) {
    if (catalog.locale !== MASTER_LOCALE) continue;
    for (const [key, text] of Object.entries(catalog.entries)) {
      const home = homes.get(key);
      if (home) errors.push(`catalogs/${name} "${key}": also in catalogs/${home}`);
      else homes.set(key, name);
      czech[key] = text;
    }
  }

  // 2. The catalog convention; English only for keys Czech has, and for every grown-ups' key.
  for (const [name, catalog] of catalogs) {
    for (const problem of domain.catalogProblems(catalog.entries, catalog.locale)) {
      errors.push(`catalogs/${name} ${problem}`);
    }
    if (catalog.locale === MASTER_LOCALE) {
      const english = catalogs.get(`en.${catalog.scope}.json`)?.entries ?? {};
      const bases = new Set(
        Object.keys(catalog.entries)
          .filter((key) => key.startsWith(domain.GROWN_UPS_KEY_PREFIX))
          .map((key) => domain.splitCatalogKey(key).base),
      );
      for (const base of bases) {
        if (!domain.catalogHasKey(english, base)) {
          errors.push(
            `catalogs/${name} "${base}": no English in catalogs/en.${catalog.scope}.json (the grown-ups' area has an English switch)`,
          );
        }
      }
      continue;
    }
    const sameScope = catalogs.get(`${MASTER_LOCALE}.${catalog.scope}.json`)?.entries ?? {};
    for (const key of Object.keys(catalog.entries)) {
      if (key.startsWith(domain.GROWN_UPS_KEY_PREFIX) && sameScope[key] === undefined) {
        errors.push(
          `catalogs/${name} "${key}": missing from catalogs/${MASTER_LOCALE}.${catalog.scope}.json`,
        );
      }
    }
  }

  // 3. Czech typography.
  for (const [name, catalog] of catalogs) {
    if (catalog.locale !== MASTER_LOCALE) continue;
    for (const [key, text] of Object.entries(catalog.entries)) {
      if (typeof text !== 'string') continue;
      for (const problem of czechTypographyProblems(text)) {
        errors.push(`catalogs/${name} "${key}": ${problem}`);
      }
    }
  }

  // 4. The reading font.
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

  // 5. The content pack and its history.
  /** @type {any} */
  let pack = null;
  const packName = domain.CONTENT_FILE;
  const packFile = join(root, 'content', packName);
  const historyDir = join(root, 'content', 'history');
  const shipped = existsSync(historyDir)
    ? readdirSync(historyDir).filter((name) => name.endsWith('.json'))
    : [];
  if (!existsSync(packFile)) {
    warnings.push(
      `content/${packName} is not shipped yet: the pack, art and pack coverage were not checked`,
    );
  } else {
    const outcome = domain.parseContentJson(
      readFileSync(packFile, 'utf8'),
      domain.contentRegistration,
      packName,
    );
    if (!outcome.ok) for (const d of outcome.error.diagnostics) errors.push(diagnostic(d));
    else pack = outcome.value;
  }
  if (pack) {
    for (const { key, where } of domain.collectCatalogKeys(pack.data)) {
      if (!domain.catalogHasKey(czech, key)) errors.push(`catalogs: no Czech "${key}" (${where})`);
    }
    const maxWords = domain.CHILD_PROFILE.maxWordsPerSentence;
    for (const beat of pack.data.story.beats) {
      for (const key of beat.graph.catalogs.text) {
        for (const variant of [key, `${key}.boy`, `${key}.girl`]) {
          for (const sentence of (czech[variant] ?? '').split(/[.!?…]+/)) {
            const words = domain.tokenizeWords(sentence).length;
            if (words > maxWords) {
              errors.push(`${variant}: "${sentence.trim()}" has ${words} words (max ${maxWords})`);
            }
          }
        }
      }
    }
    for (const name of shipped) {
      const archived = domain.parseContentJson(
        readFileSync(join(historyDir, name), 'utf8'),
        domain.contentRegistration,
        name,
      );
      if (!archived.ok) {
        errors.push(`history/${name}: no longer valid under the current schema`);
        continue;
      }
      if (`${archived.value.revision}.json` !== name) {
        errors.push(`history/${name}: file name must be its revision`);
      } else if (
        archived.value.revision === pack.revision &&
        JSON.stringify(archived.value) !== JSON.stringify(pack)
      ) {
        errors.push(
          `revision ${pack.revision} was shipped with different content: bump the revision`,
        );
      }
      for (const { key, where } of domain.collectCatalogKeys(archived.value.data)) {
        if (!domain.catalogHasKey(czech, key)) {
          errors.push(
            `history/${name}: the catalogs lost "${key}" (${where}), which a save restored with this pack still shows`,
          );
        }
      }
    }
  }

  // 6. Art.
  const artFile = join(root, ...domain.ART_CATALOG_PATH.split('/'));
  if (pack && existsSync(artFile)) {
    const parsed = domain.artCatalogSchema.parse(JSON.parse(readFileSync(artFile, 'utf8')));
    if (!parsed.ok) {
      errors.push(
        `${domain.ART_CATALOG_PATH}: not a ${domain.ART_CATALOG_FORMAT} catalog (${parsed.error.diagnostics.map(diagnostic).join('; ')})`,
      );
    } else {
      const ids = parsed.value.entries.map((/** @type {{ id: string }} */ entry) => entry.id);
      for (const d of domain.checkArtCatalog(pack.data, ids))
        gate(options.strictArt === true, d.message);
    }
  } else if (pack) {
    warnings.push(
      `${domain.ART_CATALOG_PATH} is not published yet: art references were not checked`,
    );
  }

  // 7. Curriculum coverage.
  const strict = options.strictCoverage === true;
  const packGaps = pack ? domain.curriculumGaps(pack.data) : [];
  for (const gap of packGaps) {
    gate(strict, `content: ${gap.objective} has no ${gap.missing.join(' and no ')} level`);
  }
  const curriculumFile = join(root, ...CURRICULUM_DOC.split('/'));
  /** @type {{ objectives: number; uncovered: number } | null} */
  let documented = null;
  if (!existsSync(curriculumFile)) {
    gate(strict, `${CURRICULUM_DOC} is missing: curriculum coverage was not checked`);
  } else {
    const curriculum = parseCurriculum(readFileSync(curriculumFile, 'utf8'));
    const { errors: shape, gaps } = curriculumProblems(curriculum);
    errors.push(...shape);
    for (const gap of gaps) gate(strict, gap);
    if (pack) errors.push(...packMappingProblems(curriculum.mapping, pack.data));
    documented = { objectives: curriculum.objectives.length, uncovered: gaps.length };
  }

  return {
    errors,
    warnings,
    summary: {
      catalogs: Object.fromEntries(
        [...catalogs].map(([name, catalog]) => [name, Object.keys(catalog.entries).length]),
      ),
      curriculum: documented,
      pack: pack
        ? {
            revision: pack.revision,
            regions: pack.data.regions.length,
            levels: pack.data.levels.length,
            skills: pack.data.skills.length,
            words: pack.data.lexicon.words.length,
            sentences: pack.data.lexicon.sentences.length,
            objectives: pack.data.objectives.length,
            uncovered: packGaps.length,
            history: shipped.length,
          }
        : null,
    },
  };
}

if (isMain(import.meta.url)) {
  const strictCoverage = process.argv.includes('--strict-coverage');
  const strictArt = process.argv.includes('--strict-art');
  const { errors, warnings, summary } = await validateContentTree({ strictCoverage, strictArt });
  for (const warning of warnings) console.log(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);
  if (summary) console.log(`content ${JSON.stringify(summary)}`);
  console.log(errors.length ? `${errors.length} content error(s).` : 'Content is valid.');
  process.exit(errors.length ? 1 : 0);
}
