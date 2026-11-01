/**
 * npm run content:bump (scripts/content-bump.mjs): a content change gets a revision of its own,
 * and the pack it replaces is archived exactly as it was deployed (gzip-compressed,
 * scripts/lib/history.mjs), so saves made on it keep restoring. Each test works in a throwaway git
 * repository whose `main` holds the deployed pack.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bumpContent } from '../../scripts/content-bump.mjs';
import { compressArchive, readArchive } from '../../scripts/lib/history.mjs';

/** A deployed pack as prettier writes it; `data` has a `revision` of its own that must stay. */
const DEPLOYED = `{
  "id": "pearl-sea",
  "revision": "1.0.0",
  "schemaVersion": 1,
  "data": {
    "revision": "1.0.0",
    "levels": ["sunny-lagoon.1"]
  }
}
`;
/** The same pack after a content change in the working tree, not yet bumped. */
const CHANGED = DEPLOYED.replace('["sunny-lagoon.1"]', '["sunny-lagoon.1", "sunny-lagoon.2"]');

let root: string;

function git(...args: string[]): void {
  const run = spawnSync(
    'git',
    [
      '-c',
      'core.autocrlf=false',
      '-c',
      'user.name=Content bump test',
      '-c',
      'user.email=content-bump@example.invalid',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  expect(run.status, `git ${args.join(' ')}: ${run.stderr}`).toBe(0);
}

const pack = () => readFileSync(join(root, 'content', 'pearl-sea.content.json'), 'utf8');
const archive = (revision: string) => join(root, 'content', 'history', `${revision}.json.gz`);
/** What an archive holds, decompressed. */
const archived = (revision: string) =>
  readArchive(readFileSync(archive(revision))).toString('utf8');
const writePack = (text: string) =>
  writeFileSync(join(root, 'content', 'pearl-sea.content.json'), text);

/** Commit `text` as the pack on `main`, as a merge to main deploys it. */
function deploy(text: string): void {
  writePack(text);
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'deploy');
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ps-content-bump-'));
  git('init', '-q', '-b', 'main');
  mkdirSync(join(root, 'content'));
  deploy(DEPLOYED);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('npm run content:bump', () => {
  it('archives the deployed pack byte for byte and gives the changed pack the new revision', () => {
    writePack(CHANGED);
    const result = bumpContent({ root, revision: '1.1.0', from: 'main' });
    expect(result).toEqual({
      archived: 'content/history/1.0.0.json.gz',
      from: '1.0.0',
      to: '1.1.0',
      changed: true,
    });
    expect(archived('1.0.0'), 'the archive holds what main deployed').toBe(DEPLOYED);
    expect(readFileSync(archive('1.0.0'))[9], 'no OS byte from the machine that ran it').toBe(255);
    expect(pack(), 'only the top-level revision line changes').toBe(
      CHANGED.replace('"revision": "1.0.0"', '"revision": "1.1.0"'),
    );
  });

  it('works before the content changes too, and changes nothing when run again', () => {
    bumpContent({ root, revision: '1.0.1', from: 'main' });
    const bumped = pack();
    expect(bumped).toBe(DEPLOYED.replace('"revision": "1.0.0"', '"revision": "1.0.1"'));
    const written = readFileSync(archive('1.0.0'));
    expect(bumpContent({ root, revision: '1.0.1', from: 'main' }).changed).toBe(false);
    expect(pack()).toBe(bumped);
    expect(readFileSync(archive('1.0.0')).equals(written), 'the archive is not rewritten').toBe(
      true,
    );
    expect(archived('1.0.0')).toBe(DEPLOYED);
  });

  it('refuses a revision that is malformed or not newer than the deployed one', () => {
    writePack(CHANGED);
    for (const revision of ['1.1', 'v1.1.0', '1.01.0', '1.1.0-beta']) {
      expect(() => bumpContent({ root, revision, from: 'main' }), revision).toThrow(
        /is not a revision/,
      );
    }
    for (const revision of ['1.0.0', '0.9.9']) {
      expect(() => bumpContent({ root, revision, from: 'main' }), revision).toThrow(
        /is not newer than the deployed revision 1\.0\.0/,
      );
    }
    expect(pack(), 'nothing written').toBe(CHANGED);
    expect(existsSync(join(root, 'content', 'history'))).toBe(false);
  });

  it('never changes an archived pack', () => {
    writePack(CHANGED);
    mkdirSync(join(root, 'content', 'history'));
    writeFileSync(archive('1.0.0'), compressArchive(Buffer.from(CHANGED)));
    expect(() => bumpContent({ root, revision: '1.1.0', from: 'main' })).toThrow(
      /1\.0\.0\.json\.gz differs from the pack deployed as 1\.0\.0 \(main\): an archived pack never changes/,
    );
    expect(archived('1.0.0')).toBe(CHANGED);
    writeFileSync(archive('1.0.0'), DEPLOYED);
    expect(() => bumpContent({ root, revision: '1.1.0', from: 'main' })).toThrow(
      /is not a readable archive \(not a gzip file\): an archived pack never changes/,
    );
    expect(readFileSync(archive('1.0.0'), 'utf8')).toBe(DEPLOYED);
    expect(pack(), 'nothing written').toBe(CHANGED);
  });

  it('keeps an archive compressed differently, since only the decompressed bytes count', () => {
    writePack(CHANGED);
    mkdirSync(join(root, 'content', 'history'));
    const other = gzipSync(DEPLOYED, { level: 1 });
    other[9] = 255;
    writeFileSync(archive('1.0.0'), other);
    expect(bumpContent({ root, revision: '1.1.0', from: 'main' }).changed).toBe(true);
    expect(readFileSync(archive('1.0.0')).equals(other), 'the archive is kept as it is').toBe(true);
  });

  it('refuses a branch whose pack is behind the deployed one', () => {
    deploy(DEPLOYED.replace('"revision": "1.0.0"', '"revision": "1.1.0"'));
    writePack(CHANGED);
    expect(() => bumpContent({ root, revision: '1.2.0', from: 'main' })).toThrow(
      /neither the deployed 1\.1\.0 nor 1\.2\.0: rebase onto main first/,
    );
    expect(pack(), 'nothing written').toBe(CHANGED);
    expect(existsSync(join(root, 'content', 'history'))).toBe(false);
  });

  it('is the npm script the content docs name', () => {
    const scripts = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8'),
    ).scripts;
    expect(scripts['content:bump']).toBe('node scripts/content-bump.mjs');
  });
});
