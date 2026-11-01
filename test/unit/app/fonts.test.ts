/**
 * The bundled reading font: a renamed subset of Andika (SIL OFL 1.1). The files match their
 * recorded provenance, stay within the size budget, carry the copyright and license records, no
 * longer use the Reserved Font Name, cover every Czech letter in both cases and the punctuation
 * the game shows, and keep i, í, y and ý (the subject of the game) clearly apart.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CZECH_LOWER,
  CZECH_UPPER,
  FAMILY,
  MAX_FACE_BYTES,
  OUTPUT_DIRECTORY,
  readFace,
  REQUIRED,
} from '../../../scripts/fonts/subset-andika.mjs';
import { FONT_DIRECTORY, FONT_FACES, FONT_FAMILY } from '../../../src/app/design/fonts';

interface Provenance {
  format: string;
  family: string;
  origin: { name: string; version: string; reservedFontNames: string[]; license: string };
  license: { file: string; bytes: number; sha256: string };
  required: string;
  faces: { file: string; style: string; weight: number; bytes: number; sha256: string }[];
}

type Face = Awaited<ReturnType<typeof readFace>>;

const provenance: Provenance = JSON.parse(
  readFileSync(join(OUTPUT_DIRECTORY, 'provenance.json'), 'utf8'),
);
const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

describe('Pearl Reading font', () => {
  it('records its origin: Andika 7.000 under the SIL Open Font License', () => {
    expect(provenance.format).toBe('pearl-sea-font-provenance/1');
    expect(provenance.family).toBe(FAMILY);
    expect(provenance.origin).toMatchObject({
      name: 'Andika',
      version: '7.000',
      reservedFontNames: ['Andika', 'SIL'],
      license: 'SIL Open Font License, Version 1.1',
    });
    expect(provenance.faces.map((face) => face.style)).toEqual(['Regular', 'Bold']);
    expect(provenance.required, 'the recorded requirement is the one the build enforces').toBe(
      REQUIRED,
    );
  });

  it('is the font the app loads, from the folder the build ships', () => {
    expect(FONT_FAMILY).toBe(FAMILY);
    expect(join(OUTPUT_DIRECTORY).replace(/\\/g, '/').endsWith(FONT_DIRECTORY.slice(0, -1))).toBe(
      true,
    );
    expect(FONT_FACES.map((face) => face.file)).toEqual(provenance.faces.map((face) => face.file));
  });

  it('ships the license text unchanged next to the fonts', () => {
    const license = readFileSync(join(OUTPUT_DIRECTORY, 'OFL.txt'));
    expect(license.length).toBe(provenance.license.bytes);
    expect(sha256(license)).toBe(provenance.license.sha256);
    expect(license.toString('utf8')).toMatch(/^Copyright \(c\) 2004-2025 SIL Global/);
    expect(license.toString('utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it('requires the whole Czech alphabet in both cases', () => {
    expect([...CZECH_LOWER]).toHaveLength(41);
    expect(CZECH_UPPER).toBe(CZECH_LOWER.toUpperCase());
    for (const letter of 'áčďéěíňóřšťúůýž') {
      expect(CZECH_LOWER, letter).toContain(letter);
      expect(CZECH_UPPER, letter).toContain(letter.toUpperCase());
    }
  });

  for (const meta of provenance.faces) {
    describe(meta.style, () => {
      const bytes = readFileSync(join(OUTPUT_DIRECTORY, meta.file));
      let face: Face;
      const glyphOf = (character: string) => {
        const id = face.characterMap.get(character.codePointAt(0)!);
        expect(id, `${character} has a glyph`).toBeDefined();
        return face.glyphs.glyph(id!);
      };

      beforeAll(async () => {
        face = await readFace(bytes);
      });

      it('matches its provenance digest and stays within the size budget', () => {
        expect(bytes.subarray(0, 4).toString('latin1')).toBe('wOF2');
        expect(bytes.length).toBe(meta.bytes);
        expect(sha256(bytes)).toBe(meta.sha256);
        expect(bytes.length).toBeLessThanOrEqual(MAX_FACE_BYTES);
      });

      it('is renamed, keeping the copyright and license records', () => {
        const { names } = face;
        expect(names.get(1)).toBe(FAMILY);
        expect(names.get(2)).toBe(meta.style);
        for (const id of [1, 3, 4, 6]) expect(names.get(id) ?? '').not.toMatch(/Andika|SIL/);
        expect(names.get(0)).toContain('SIL Global');
        expect(names.get(13)).toMatch(/Open Font License/);
        expect(names.get(10)).toContain('Modified Version of Andika');
      });

      it('covers every Czech letter in both cases', () => {
        const missing = [...CZECH_LOWER, ...CZECH_UPPER].filter(
          (letter) => !face.codePoints.has(letter.codePointAt(0)!),
        );
        expect(missing).toEqual([]);
      });

      it('covers Czech punctuation, the no-break spaces, the arrows and the UI symbols', () => {
        const missing = [...REQUIRED].filter(
          (character) => !face.codePoints.has(character.codePointAt(0)!),
        );
        expect(missing).toEqual([]);
        for (const mark of ['„', '“', '‚', '‘', '’', '–', '—', '…', '\u00a0', '\u2011', '→', '↔']) {
          expect(face.codePoints.has(mark.codePointAt(0)!), mark).toBe(true);
        }
      });

      it('draws i, í, y and ý as four different glyphs, and I, Í, Y and Ý too', () => {
        for (const set of [
          ['i', 'í', 'y', 'ý'],
          ['I', 'Í', 'Y', 'Ý'],
        ]) {
          const glyphs = set.map(glyphOf);
          expect(new Set(glyphs.map((glyph) => glyph.id)).size, set.join(' ')).toBe(4);
          const outlines = glyphs.map((glyph) => glyph.bytes.toString('hex'));
          expect(new Set(outlines).size, `${set.join(' ')} have different outlines`).toBe(4);
        }
      });

      it('puts the same acute on í and ý as on á, é, ó and ú, never on i', () => {
        const acute = (character: string): number => {
          const glyph = glyphOf(character);
          expect(glyph.components, `${character} is a letter plus a mark`).toHaveLength(2);
          return glyph.components[1]!;
        };
        const mark = acute('á');
        for (const letter of ['é', 'ó', 'ú', 'í', 'ý', 'Í', 'Ý']) {
          expect(acute(letter), `${letter} carries the acute`).toBe(mark);
        }
        // í is a dotless ı under the acute: never a dot and an accent together.
        expect(glyphOf('í').components[0]).toBe(glyphOf('ı').id);
        expect(glyphOf('ý').components[0]).toBe(glyphOf('y').id);
        // i is a stem and a round dot of its own, not a composite with the acute.
        expect(glyphOf('i').components).not.toContain(mark);
        expect(glyphOf('i').contours).toBe(2);
      });

      it('gives ů a ring and ú an acute on the same u', () => {
        const ring = glyphOf('ů');
        const acute = glyphOf('ú');
        expect(ring.components[0]).toBe(acute.components[0]);
        expect(ring.components[1]).not.toBe(acute.components[1]);
      });

      it('lets y and ý reach below the line while i and í sit on it', () => {
        const em = face.glyphs.unitsPerEm;
        for (const letter of ['y', 'ý']) {
          expect(glyphOf(letter).yMin, `${letter} has a descender`).toBeLessThan(-em / 10);
        }
        for (const letter of ['i', 'í']) {
          expect(glyphOf(letter).yMin, `${letter} sits on the baseline`).toBeGreaterThanOrEqual(0);
        }
      });

      it('keeps capital I barred so it is not read as a small l', () => {
        const width = (character: string) => glyphOf(character).xMax - glyphOf(character).xMin;
        expect(glyphOf('I').id).not.toBe(glyphOf('l').id);
        expect(width('I')).toBeGreaterThan(2 * width('l'));
      });
    });
  }
});
