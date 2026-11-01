// @ts-check
/**
 * The art catalog generator (docs/art.md):
 *
 *   node scripts/art/catalog.mjs          write assets/art/catalog.json
 *   node scripts/art/catalog.mjs --check  fail when the catalog is stale or a file breaks a rule
 *
 * The source is assets/art/provenance.json (never shipped): one record per painted file with its
 * art ID, file, digest and, for sea friends, the cosmetic anchors. Every file is measured from its
 * own WebP header, so the catalog's sizes always describe the committed bytes. The static SVG art
 * (eggs, cosmetics, the crown, sticker art) comes from its generator (scripts/art/svg), listed at
 * its viewBox size. Rules:
 *
 * - the catalog parses with the contract's `artCatalogSchema`, and IDs are unique and sorted;
 * - every painted file is a WebP under assets/art/ whose SHA-256 matches its provenance record,
 *   with no EXIF, XMP or ICC chunk;
 * - cut-out art (friends, monsters, Inkoustíci, characters, avatars) has an alpha channel, and
 *   every painted friend publishes the `head`, `eyes` and `neck` anchors;
 * - every SVG file is byte for byte its generator's output, and no SVG file lacks a design;
 * - a painted file stays under FILE_BUDGET_BYTES and all painted art under ART_BUDGET_BYTES.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain, readJson, repositoryRoot } from '../lib/tools.mjs';
import { loadContract } from '../validate-content.mjs';
import { readWebp } from './lib/webp.mjs';
import { checkSvgArt, renderSvgArt } from './svg/generate.mjs';

export const CATALOG_PATH = 'assets/art/catalog.json';
export const PROVENANCE_PATH = 'assets/art/provenance.json';
export const FILE_BUDGET_BYTES = 512 * 1024;
export const ART_BUDGET_BYTES = 28 * 1024 * 1024;
const CUT_OUT = /^(friend|monster|inkoustik|character|avatar)\//;
const FRIEND = /^friend\/[a-z0-9-]+\/(baby|grown)$/;
const ANCHORS = ['head', 'eyes', 'neck'];
const METADATA_CHUNKS = ['EXIF', 'XMP ', 'ICCP'];

/**
 * @typedef {{ x: number; y: number; scale: number; rotate: number }} Anchor
 * @typedef {{ id: string; file: string; sha256: string; anchors?: Record<string, Anchor> | null }} ArtRecord
 */

/** @param {Uint8Array} bytes */
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Builds the catalog from the provenance records, the committed files and the SVG generator.
 *
 * @param {string} [root]
 * @param {import('./svg/generate.mjs').SvgArt[]} [svgArt] the generated SVG art (none in tests)
 * @returns {Promise<{ catalog: Record<string, unknown>; problems: string[]; bytes: number; count: number }>}
 */
export async function buildArtCatalog(root = repositoryRoot, svgArt = renderSvgArt()) {
  const domain = await loadContract();
  /** @type {{ assets: ArtRecord[] }} */
  const provenance = readJson(join(root, ...PROVENANCE_PATH.split('/')));
  /** @type {string[]} */
  const problems = [];
  const records = [...provenance.assets].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  /** @type {({ id: string } & Record<string, unknown>)[]} */
  const entries = [];
  const seen = new Set();
  let total = 0;
  for (const record of records) {
    const where = `Art ${record.id}`;
    if (seen.has(record.id)) problems.push(`${where}: listed twice.`);
    seen.add(record.id);
    let bytes;
    try {
      bytes = readFileSync(join(root, 'assets', 'art', ...record.file.split('/')));
    } catch {
      problems.push(`${where}: missing file assets/art/${record.file}.`);
      continue;
    }
    total += bytes.length;
    if (sha256(bytes) !== record.sha256)
      problems.push(`${where}: the file differs from its record.`);
    if (bytes.length > FILE_BUDGET_BYTES) {
      problems.push(`${where}: ${bytes.length} bytes, over ${FILE_BUDGET_BYTES}.`);
    }
    let info;
    try {
      info = readWebp(bytes);
    } catch (error) {
      problems.push(`${where}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const metadata = info.chunks.filter((chunk) => METADATA_CHUNKS.includes(chunk));
    if (metadata.length > 0) problems.push(`${where}: metadata chunks ${metadata.join(', ')}.`);
    if (CUT_OUT.test(record.id) && !info.alpha) problems.push(`${where}: a cut-out needs alpha.`);
    /** @type {{ id: string } & Record<string, unknown>} */
    const entry = {
      id: record.id,
      kind: 'painted',
      file: record.file,
      width: info.width,
      height: info.height,
    };
    if (FRIEND.test(record.id)) {
      const anchors = record.anchors ?? {};
      for (const name of ANCHORS) {
        if (!anchors[name]) problems.push(`${where}: a painted friend needs the ${name} anchor.`);
      }
      entry['anchors'] = Object.fromEntries(
        ANCHORS.filter((name) => anchors[name]).map((name) => [name, anchors[name]]),
      );
    }
    entries.push(entry);
  }
  if (total > ART_BUDGET_BYTES) {
    problems.push(`Painted art is ${total} bytes, over the ${ART_BUDGET_BYTES}-byte budget.`);
  }
  if (svgArt.length > 0) problems.push(...checkSvgArt(root));
  for (const item of svgArt) {
    if (seen.has(item.id)) problems.push(`Art ${item.id}: listed twice.`);
    seen.add(item.id);
    entries.push({
      id: item.id,
      kind: 'svg',
      file: item.file,
      width: item.width,
      height: item.height,
    });
  }
  entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const catalog = { format: domain.ART_CATALOG_FORMAT, entries };
  const parsed = domain.artCatalogSchema.parse(catalog);
  if (!parsed.ok) {
    problems.push(
      `The catalog breaks the contract: ${parsed.error.diagnostics.map((/** @type {{ path?: unknown; message: string }} */ d) => `${String(d.path ?? '')} ${d.message}`).join('; ')}`,
    );
  }
  return { catalog, problems, bytes: total, count: entries.length };
}

/** @param {Record<string, unknown>} catalog */
export function formatCatalog(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

if (isMain(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { catalog, problems, bytes, count } = await buildArtCatalog();
  const text = formatCatalog(catalog);
  const path = join(repositoryRoot, ...CATALOG_PATH.split('/'));
  if (check) {
    let current = '';
    try {
      current = readFileSync(path, 'utf8');
    } catch {
      problems.push(`${CATALOG_PATH} is missing.`);
    }
    if (current !== '' && current !== text) {
      problems.push(`${CATALOG_PATH} is stale: run node scripts/art/catalog.mjs.`);
    }
  } else if (problems.length === 0) {
    writeFileSync(path, text);
  }
  if (problems.length > 0) {
    console.error(problems.map((problem) => `- ${problem}`).join('\n'));
    process.exit(1);
  }
  const mib = (bytes / (1024 * 1024)).toFixed(1);
  console.log(
    `${check ? 'Checked' : 'Wrote'} ${CATALOG_PATH}: ${count} entries, painted art ${mib} MiB.`,
  );
}
