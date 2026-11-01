/**
 * S5's art catalog (docs/art.md): the committed catalog is exactly what its generator builds from
 * the provenance records and the committed WebP files, it parses with the contract's schema, and
 * the generator refuses metadata, wrong digests, cut-outs without alpha and friends without
 * anchors.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { artCatalogSchema, ART_CATALOG_FORMAT, ART_CATALOG_PATH } from '../../src/rules/contract';
import {
  buildArtCatalog,
  CATALOG_PATH,
  formatCatalog,
  PROVENANCE_PATH,
} from '../../scripts/art/catalog.mjs';
import { readWebp } from '../../scripts/art/lib/webp.mjs';

const repository = join(import.meta.dirname, '..', '..');
const published = existsSync(join(repository, ...CATALOG_PATH.split('/')));
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A minimal lossless WebP: VP8L header for a width x height canvas, with or without alpha. */
function webp(width: number, height: number, alpha: boolean, extra: Buffer[] = []): Buffer {
  const bits = (width - 1) | ((height - 1) << 14) | ((alpha ? 1 : 0) << 28);
  const vp8l = Buffer.alloc(5);
  vp8l[0] = 0x2f;
  vp8l.writeUInt32LE(bits >>> 0, 1);
  const chunk = (fourcc: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.write(fourcc, 0, 'latin1');
    head.writeUInt32LE(data.length, 4);
    return Buffer.concat([head, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  const body = Buffer.concat([chunk('VP8L', vp8l), ...extra.map((data) => chunk('EXIF', data))]);
  const riff = Buffer.alloc(12);
  riff.write('RIFF', 0, 'latin1');
  riff.writeUInt32LE(body.length + 4, 4);
  riff.write('WEBP', 8, 'latin1');
  return Buffer.concat([riff, body]);
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function tree(files: Record<string, Buffer>, records: unknown[]): string {
  const root = mkdtempSync(join(tmpdir(), 'ps-art-'));
  roots.push(root);
  for (const [file, bytes] of Object.entries(files)) {
    const path = join(root, 'assets', 'art', ...file.split('/'));
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, bytes);
  }
  mkdirSync(join(root, 'assets', 'art'), { recursive: true });
  writeFileSync(join(root, ...PROVENANCE_PATH.split('/')), JSON.stringify({ assets: records }));
  return root;
}

const anchors = {
  head: { x: 500, y: 100, scale: 100, rotate: 0 },
  eyes: { x: 500, y: 250, scale: 100, rotate: 0 },
  neck: { x: 500, y: 450, scale: 100, rotate: 0 },
};

describe('art catalog generator', () => {
  it('measures files and writes a catalog the contract accepts', async () => {
    const friend = webp(400, 300, true);
    const scene = webp(1664, 928, false);
    const root = tree({ 'friends/a-grown.webp': friend, 'scenes/s.webp': scene }, [
      { id: 'scene/sunny-lagoon', file: 'scenes/s.webp', sha256: sha256(scene) },
      {
        id: 'friend/krab-tvrdak/grown',
        file: 'friends/a-grown.webp',
        sha256: sha256(friend),
        anchors,
      },
    ]);
    const built = await buildArtCatalog(root);
    expect(built.problems).toEqual([]);
    expect(built.catalog).toEqual({
      format: ART_CATALOG_FORMAT,
      entries: [
        {
          id: 'friend/krab-tvrdak/grown',
          kind: 'painted',
          file: 'friends/a-grown.webp',
          width: 400,
          height: 300,
          anchors,
        },
        {
          id: 'scene/sunny-lagoon',
          kind: 'painted',
          file: 'scenes/s.webp',
          width: 1664,
          height: 928,
        },
      ],
    });
    expect(artCatalogSchema.parse(built.catalog).ok).toBe(true);
  });

  it('refuses metadata, wrong digests, opaque cut-outs and friends without anchors', async () => {
    const tagged = webp(64, 64, true, [Buffer.from('Exif\0\0')]);
    const opaque = webp(64, 64, false);
    const friend = webp(64, 64, true);
    const root = tree(
      { 'm/tagged.webp': tagged, 'm/opaque.webp': opaque, 'f/friend.webp': friend },
      [
        { id: 'monster/murena-mumla/inked', file: 'm/tagged.webp', sha256: sha256(tagged) },
        { id: 'monster/murena-mumla/freed', file: 'm/opaque.webp', sha256: sha256(opaque) },
        { id: 'friend/krab-tvrdak/grown', file: 'f/friend.webp', sha256: '0'.repeat(64) },
      ],
    );
    const { problems } = await buildArtCatalog(root);
    expect(problems.some((p) => p.includes('murena-mumla/inked') && p.includes('EXIF'))).toBe(true);
    expect(problems.some((p) => p.includes('murena-mumla/freed') && p.includes('alpha'))).toBe(
      true,
    );
    expect(problems.some((p) => p.includes('krab-tvrdak/grown') && p.includes('differs'))).toBe(
      true,
    );
    expect(problems.some((p) => p.includes('krab-tvrdak/grown') && p.includes('head anchor'))).toBe(
      true,
    );
  });

  it('reads the size of every WebP flavour', () => {
    expect(readWebp(webp(1, 1, false))).toMatchObject({ width: 1, height: 1, lossless: true });
    expect(readWebp(webp(16384, 3, true))).toMatchObject({ width: 16384, height: 3, alpha: true });
    expect(() => readWebp(Buffer.from('RIFF0000WAVE'))).toThrow();
  });
});

describe.runIf(published)('published art catalog', () => {
  it('is exactly what the generator builds, with no rule broken', async () => {
    expect(CATALOG_PATH).toBe(ART_CATALOG_PATH);
    const built = await buildArtCatalog(repository);
    expect(built.problems).toEqual([]);
    const committed = readFileSync(join(repository, ...CATALOG_PATH.split('/')), 'utf8');
    expect(committed).toBe(formatCatalog(built.catalog));
  });

  it('keeps every shipped file free of metadata', () => {
    const catalog = JSON.parse(
      readFileSync(join(repository, ...CATALOG_PATH.split('/')), 'utf8'),
    ) as {
      entries: { file: string }[];
    };
    for (const entry of catalog.entries) {
      const info = readWebp(
        readFileSync(join(repository, 'assets', 'art', ...entry.file.split('/'))),
      );
      expect(
        info.chunks.filter((chunk) => ['EXIF', 'XMP ', 'ICCP'].includes(chunk)),
        entry.file,
      ).toEqual([]);
    }
  });
});
