// @ts-check
/**
 * Give a content change a revision of its own:
 *
 *   npm run content:bump -- <revision> [--from <git-ref>]
 *
 * A save pins the exact pack it was played with (ID, revision and content hash), and the runtime
 * restores it only with that pack. So every content change merged to main gets a new revision,
 * and the pack it replaces is shipped beside it in content/history/ (docs/content.md §1). This
 * script
 *
 * 1. reads the deployed pack byte for byte from git, `<git-ref>:content/pearl-sea.content.json`
 *    (default `origin/main`: fetch first). That is the pack saves in the wild pin, whether or not
 *    the working tree has already changed the content;
 * 2. archives it as `content/history/<its revision>.json` (an archive that already exists must be
 *    identical: an archived pack never changes);
 * 3. sets the working tree pack's top-level `revision` to `<revision>` and touches nothing else.
 *
 * It refuses a revision that is not MAJOR.MINOR.PATCH or not newer than the deployed one, and a
 * working tree pack whose revision is neither the deployed one nor `<revision>` (rebase onto the
 * ref first). Running it again changes nothing.
 *
 * Afterwards pin the new revision's content hash in `REVISIONS` in
 * test/unit/contract/content.test.ts (the failing test prints it) and re-pin the golden traces:
 * the content hash is part of every snapshot.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain, repositoryRoot } from './lib/tools.mjs';

export const PACK_PATH = 'content/pearl-sea.content.json';
export const HISTORY_PATH = 'content/history';

/** The pack's own `revision` line: prettier puts top-level keys at two spaces. */
const REVISION_LINE = /^ {2}"revision": "[^"\n]*"/m;

/**
 * @param {string} revision
 * @returns {[number, number, number] | null}
 */
function parseRevision(revision) {
  const m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(revision);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * @param {[number, number, number]} a
 * @param {[number, number, number]} b
 * @returns {number} negative when `a` is older than `b`
 */
function compareRevisions(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * @param {{ root?: string; revision: string; from?: string }} options
 * @returns {{ archived: string; from: string; to: string; changed: boolean }}
 */
export function bumpContent({ root = repositoryRoot, revision, from = 'origin/main' }) {
  const next = parseRevision(revision);
  if (!next) throw new Error(`"${revision}" is not a revision: use MAJOR.MINOR.PATCH, e.g. 1.2.0`);

  const shown = spawnSync('git', ['show', `${from}:${PACK_PATH}`], {
    cwd: root,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (shown.error) throw new Error(`git could not be started: ${shown.error.message}`);
  if (shown.status !== 0) {
    throw new Error(`cannot read ${PACK_PATH} at ${from}: ${shown.stderr.toString().trim()}`);
  }
  const deployedBytes = shown.stdout;
  /** @type {{ id: string; revision: string }} */
  const deployed = JSON.parse(deployedBytes.toString('utf8'));
  const old = parseRevision(deployed.revision);
  if (!old) throw new Error(`the pack at ${from} has no valid revision ("${deployed.revision}")`);
  if (compareRevisions(next, old) <= 0) {
    throw new Error(
      `${revision} is not newer than the deployed revision ${deployed.revision} (${from})`,
    );
  }

  const packFile = join(root, PACK_PATH);
  const text = readFileSync(packFile, 'utf8');
  /** @type {{ id: string; revision: string }} */
  const pack = JSON.parse(text);
  if (pack.id !== deployed.id) {
    throw new Error(`the pack is "${pack.id}" here but "${deployed.id}" at ${from}`);
  }
  if (pack.revision !== deployed.revision && pack.revision !== revision) {
    throw new Error(
      `the pack here is ${pack.revision}, neither the deployed ${deployed.revision} nor ` +
        `${revision}: rebase onto ${from} first`,
    );
  }

  const archived = `${HISTORY_PATH}/${deployed.revision}.json`;
  const archiveFile = join(root, archived);
  if (existsSync(archiveFile)) {
    if (!readFileSync(archiveFile).equals(deployedBytes)) {
      throw new Error(
        `${archived} differs from the pack deployed as ${deployed.revision} (${from}): ` +
          'an archived pack never changes',
      );
    }
  }

  let changed = false;
  if (pack.revision !== revision) {
    if (!REVISION_LINE.test(text)) {
      throw new Error(`${PACK_PATH} has no top-level "revision" line: format it with prettier`);
    }
    const updated = text.replace(REVISION_LINE, `  "revision": "${revision}"`);
    if (JSON.stringify(JSON.parse(updated)) !== JSON.stringify({ ...pack, revision })) {
      throw new Error(`setting the revision would change more than the revision of ${PACK_PATH}`);
    }
    if (!existsSync(archiveFile)) {
      mkdirSync(join(root, HISTORY_PATH), { recursive: true });
      writeFileSync(archiveFile, deployedBytes);
    }
    writeFileSync(packFile, updated);
    changed = true;
  } else if (!existsSync(archiveFile)) {
    mkdirSync(join(root, HISTORY_PATH), { recursive: true });
    writeFileSync(archiveFile, deployedBytes);
    changed = true;
  }
  return { archived, from: deployed.revision, to: revision, changed };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const fromAt = args.indexOf('--from');
  const from = fromAt >= 0 ? args[fromAt + 1] : undefined;
  const positional = args.filter((_, i) => fromAt < 0 || (i !== fromAt && i !== fromAt + 1));
  if (positional.length !== 1 || positional[0]?.startsWith('-') || (fromAt >= 0 && !from)) {
    console.error('usage: npm run content:bump -- <revision> [--from <git-ref>]');
    process.exit(2);
  }
  try {
    const result = bumpContent({ revision: String(positional[0]), from });
    console.log(
      result.changed
        ? `Archived the deployed ${result.from} pack as ${result.archived}; the pack is now ${result.to}.`
        : `Nothing to do: the pack is ${result.to} and ${result.archived} is archived.`,
    );
    console.log(
      'Next: pin the new revision in REVISIONS (test/unit/contract/content.test.ts prints its ' +
        'hash), re-pin the golden traces (the content hash is in every snapshot), npm run verify.',
    );
  } catch (error) {
    console.error(`content:bump: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
