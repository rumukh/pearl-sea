/**
 * S5's audio pack (docs/audio.md): the committed manifest is exactly what the generator builds
 * from the recipe and the committed files, the shell's reader accepts it, every shipped sound has
 * provenance with its digest, and the worst case (every sound decoded at once at the pack rate)
 * stays under 48 MiB.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAudioManifest } from '../../src/app/audio/manifest';
import {
  AUDIO_ID_PATTERN,
  AUDIO_MANIFEST_PATH,
  AUDIO_MANIFEST_SCHEMA,
} from '../../src/rules/contract';
import {
  buildAudioManifest,
  DECODED_BUDGET_BYTES,
  formatManifest,
  MANIFEST_PATH,
  MANIFEST_SCHEMA,
  PACK_SAMPLE_RATE,
} from '../../scripts/audio/manifest.mjs';
import { readOggVorbis } from '../../scripts/audio/lib/ogg.mjs';

const repository = join(import.meta.dirname, '..', '..');

function read(path: string): Buffer {
  return readFileSync(join(repository, ...path.split('/')));
}

interface ManifestSound {
  id: string;
  src: string;
  bus: string;
  loop: boolean;
  sha256: string;
}

interface ProvenanceSound {
  id: string;
  file: string;
  sha256: string;
  made: { caption: string; settings: { seed: number }; modelOutput: { sha256: string } };
  processing: { step: string }[];
  approval: { answer: string };
}

const manifest = JSON.parse(read(MANIFEST_PATH).toString('utf8')) as {
  sounds: ManifestSound[];
  music: { states: Record<string, string | null> };
};

describe('audio pack', () => {
  it('follows the contract paths and schema', () => {
    expect(MANIFEST_PATH).toBe(AUDIO_MANIFEST_PATH);
    expect(MANIFEST_SCHEMA).toBe(AUDIO_MANIFEST_SCHEMA);
    for (const sound of manifest.sounds) expect(sound.id).toMatch(AUDIO_ID_PATTERN);
  });

  it('commits exactly the manifest its generator builds, with no rule broken', () => {
    const built = buildAudioManifest(repository);
    expect(built.problems).toEqual([]);
    expect(read(MANIFEST_PATH).toString('utf8')).toBe(formatManifest(built.manifest));
  });

  it('is accepted by the shell', () => {
    const map = parseAudioManifest(manifest);
    expect(map.music.map((sound) => sound.id)).toContain('music/grotto');
    expect(map.effects.map((sound) => sound.id)).toContain('sfx/victory-sting');
    expect(map.musicStates['grotto']).toBe('music/grotto');
  });

  it('ships mono 48 kHz Vorbis without metadata, and loops of whole frames', () => {
    for (const sound of manifest.sounds) {
      const info = readOggVorbis(read(sound.src));
      expect(info.channels, sound.id).toBe(1);
      expect(info.sampleRate, sound.id).toBe(PACK_SAMPLE_RATE);
      expect(
        info.tags.filter((tag) => !/^encoder=/i.test(tag)),
        sound.id,
      ).toEqual([]);
      if (sound.loop) {
        for (const rate of [22_050, 44_100, 48_000]) {
          expect((info.samples * rate) % info.sampleRate, `${sound.id} at ${rate} Hz`).toBe(0);
        }
      }
    }
  });

  it('keeps every sound decoded at once under 48 MiB', () => {
    let bytes = 0;
    for (const sound of manifest.sounds) {
      const info = readOggVorbis(read(sound.src));
      bytes += Math.ceil((info.samples * PACK_SAMPLE_RATE) / info.sampleRate) * info.channels * 4;
    }
    expect(DECODED_BUDGET_BYTES).toBe(48 * 1024 * 1024);
    expect(bytes).toBeLessThanOrEqual(DECODED_BUDGET_BYTES);
  });

  it('records provenance and approval for every shipped sound', () => {
    const provenance = JSON.parse(read('assets/audio/provenance.json').toString('utf8')) as {
      sounds: ProvenanceSound[];
    };
    for (const sound of manifest.sounds) {
      const entry = provenance.sounds.find((candidate) => candidate.id === sound.id);
      expect(entry, sound.id).toBeDefined();
      const digest = createHash('sha256').update(read(sound.src)).digest('hex');
      expect(entry?.sha256, sound.id).toBe(digest);
      expect(sound.sha256, sound.id).toBe(digest);
      expect(`assets/audio/${entry?.file}`, sound.id).toBe(sound.src);
      expect(entry?.made.caption.length, sound.id).toBeGreaterThan(40);
      expect(entry?.made.modelOutput.sha256, sound.id).toMatch(/^[0-9a-f]{64}$/);
      expect(
        entry?.processing.map((step) => step.step),
        sound.id,
      ).toContain('encode');
      expect(entry?.approval.answer, sound.id).not.toBe('');
    }
  });
});
