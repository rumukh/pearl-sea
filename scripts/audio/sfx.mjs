// @ts-check
/**
 * The sound effects (docs/audio.md §7): deterministic synthesis from the recipes in
 * assets/audio/recipes/sfx/ and the patch library assets/audio/recipes/_patches.json, by
 * Dragon Valley's audio engine (scripts/audio/synth, MIT, same author), shipped as Ogg Vorbis.
 *
 *   node scripts/audio/sfx.mjs                   render every effect, encode the changed ones
 *   node scripts/audio/sfx.mjs --only a,b        only these (fast iteration)
 *   node scripts/audio/sfx.mjs --wav <dir>       also write each rendered PCM WAV into <dir>
 *   node scripts/audio/sfx.mjs --approve <gate> <answer>   record the user's approval
 *   node scripts/audio/sfx.mjs --check           fail when a committed effect is not its recipe's
 *                                                output (the gate; needs no FFmpeg)
 *
 * The synthesizer renders 16-bit mono PCM at the pack rate (48 kHz) with only IEEE-754 basic
 * arithmetic and seeded integer generators, so every platform renders identical PCM, and its digest
 * is the effect's identity. The shipped file is that PCM encoded once with FFmpeg's libvorbis
 * (quality 5, bit-exact flags, no metadata), like the music: an encoder's bytes depend on its
 * version, so an effect is encoded again only when its PCM changes, and assets/audio/
 * synth-provenance.json records the Ogg's digest with the digest of the PCM it was encoded from.
 * Encoding needs FFmpeg (the FFMPEG environment variable, or ffmpeg on the PATH).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isMain, readJson, repositoryRoot } from '../lib/tools.mjs';
import { readOggVorbis } from './lib/ogg.mjs';
import { gainToDb, roundTo } from './synth/dmath.mjs';
import { GENERATOR, renderRecipe, resolveRecipe } from './synth/render.mjs';
import { truePeak } from './synth/resample.mjs';
import { decodeWav } from './synth/wav.mjs';

export const SFX_RECIPE_DIR = 'assets/audio/recipes/sfx';
export const PATCHES_PATH = 'assets/audio/recipes/_patches.json';
export const SFX_DIR = 'assets/audio/sfx';
export const SYNTH_PROVENANCE_PATH = 'assets/audio/synth-provenance.json';
export const MODEL_PROVENANCE_PATH = 'assets/audio/provenance.json';
export const SFX_SAMPLE_RATE = 48_000;
export const VORBIS_QUALITY = 5;
/** A decoded effect may overshoot the synthesizer's -1 dBTP ceiling by this much, never clip. */
const DECODED_TRUE_PEAK_LIMIT_DBTP = -0.5;
/**
 * FFmpeg's Vorbis decoder (Chrome's is FFmpeg too) trims the end of a short stream by its own
 * reckoning: it may drop the last 128 samples or keep up to a long block of the encoder's padding,
 * where libvorbis returns exactly the stream's length. Whatever it drops or adds must be silent.
 */
const DROPPABLE_TAIL_SAMPLES = 128;
const PADDING_SAMPLES = 2048;
const SILENT_DBFS = -50;
const ENCODE_ARGS = [
  '-map_metadata',
  '-1',
  '-fflags',
  '+bitexact',
  '-flags:a',
  '+bitexact',
  '-c:a',
  'libvorbis',
  '-q:a',
  String(VORBIS_QUALITY),
];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @typedef {{ id: string; sampleRate: number; seed: number; kind: string; loudness: { measure: string; target: number } } & Record<string, unknown>} SfxRecipe
 * @typedef {{ id: string; file: string; recipeFile: string; recipeSha256: string; seed: number; pcm: Uint8Array; pcmSha256: string; samples: number; seconds: number; loudness: number; truePeakDbtp: number }} Effect
 * @typedef {{ from: string; encoder: string; vendor: string; decodedTruePeakDbtp: number; bytes: number; sha256: string }} Encoded
 * @typedef {{ gate: string; answer: string }} Approval
 * @typedef {{ id: string; file: string; encoded?: Encoded; approval?: Approval | null }} ProvenanceEffect
 */

/** @param {Uint8Array | string} data */
function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * JSON with keys sorted recursively: the identity of a resolved recipe.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = /** @type {Record<string, unknown>} */ (value);
    const keys = Object.keys(record).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Renders the effects (all, or the IDs in `only`) to PCM, sorted by ID.
 *
 * @param {string} [root]
 * @param {string[]} [only]
 * @returns {Effect[]}
 */
export function renderEffects(root = repositoryRoot, only) {
  const patches = readJson(join(root, ...PATCHES_PATH.split('/')));
  delete patches.$comment;
  const dir = join(root, ...SFX_RECIPE_DIR.split('/'));
  const names = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  /** @type {Effect[]} */
  const effects = [];
  for (const name of names) {
    /** @type {SfxRecipe} */
    const recipe = readJson(join(dir, name));
    if (`${recipe.id}.json` !== name)
      throw new Error(`Recipe ${name} must have the ID ${name.slice(0, -5)}.`);
    if (!ID.test(recipe.id))
      throw new Error(`Effect ID ${recipe.id} must be lower-case kebab words.`);
    if (recipe.kind !== 'sfx') throw new Error(`Recipe ${name} must be an sfx recipe.`);
    if (recipe.sampleRate !== SFX_SAMPLE_RATE) {
      throw new Error(`Recipe ${name} must render at ${SFX_SAMPLE_RATE} Hz.`);
    }
    if (only && !only.includes(recipe.id)) continue;
    const result = renderRecipe(recipe, patches);
    const pcm = /** @type {Uint8Array} */ (result.wav);
    effects.push({
      id: recipe.id,
      file: `sfx/${recipe.id}.ogg`,
      recipeFile: `${SFX_RECIPE_DIR}/${name}`,
      recipeSha256: sha256(canonicalJson(resolveRecipe(recipe, patches))),
      seed: recipe.seed,
      pcm,
      pcmSha256: sha256(pcm),
      samples: result.stats.lengthSamples,
      seconds: Number((result.stats.lengthSamples / SFX_SAMPLE_RATE).toFixed(6)),
      loudness: result.stats.loudness,
      truePeakDbtp: result.stats.truePeakDbtp,
    });
  }
  return effects;
}

/**
 * The committed provenance's effects by ID, or null when the file is missing or unreadable.
 *
 * @param {string} root
 * @returns {Map<string, ProvenanceEffect> | null}
 */
export function readSynthProvenance(root = repositoryRoot) {
  try {
    const record = JSON.parse(
      readFileSync(join(root, ...SYNTH_PROVENANCE_PATH.split('/')), 'utf8'),
    );
    /** @type {ProvenanceEffect[]} */
    const effects = record.effects;
    return new Map(effects.map((effect) => [effect.id, effect]));
  } catch {
    return null;
  }
}

/**
 * The provenance record of the synthesized effects (never shipped).
 *
 * @param {Effect[]} effects
 * @param {Map<string, Encoded>} encoded by effect ID (`sfx/<id>`)
 * @param {Map<string, Approval | null>} approvals by effect ID
 */
export function synthProvenance(effects, encoded, approvals) {
  return `${JSON.stringify(
    {
      schema: 'pearl-sea-synth-provenance/1',
      works:
        'Original works: every effect is synthesized from the recipes in this repository. No samples, recordings, sample libraries, models or third-party audio are used.',
      generator: {
        ...GENERATOR,
        engine: 'scripts/audio/synth (ported from Dragon Valley, MIT, same author)',
        command: 'node scripts/audio/sfx.mjs',
        check: 'node scripts/audio/sfx.mjs --check',
        determinism:
          'Only IEEE-754 basic arithmetic and seeded integer generators, so every platform renders identical PCM.',
      },
      encoding: {
        codec: `Vorbis (libvorbis through FFmpeg), quality ${VORBIS_QUALITY}, mono, ${SFX_SAMPLE_RATE} Hz, no metadata`,
        command: `ffmpeg -i <pcm.wav> ${ENCODE_ARGS.join(' ')} <id>.ogg`,
        policy:
          "An encoder's bytes depend on its version, so an effect is encoded again only when its PCM changes; encoded.from is the SHA-256 of the PCM WAV it was encoded from, and decodedTruePeakDbtp is measured on the decoded Ogg (4x oversampled).",
      },
      patchLibrary: PATCHES_PATH,
      recipeSha256:
        'SHA-256 of the canonical JSON (sorted keys, no whitespace) of a recipe with every patch it extends resolved',
      effects: effects.map((e) => ({
        id: `sfx/${e.id}`,
        file: `assets/audio/${e.file}`,
        recipe: e.recipeFile,
        recipeSha256: e.recipeSha256,
        seed: e.seed,
        samples: e.samples,
        seconds: e.seconds,
        loudnessLufs: e.loudness,
        truePeakDbtp: e.truePeakDbtp,
        pcm: { bytes: e.pcm.length, sha256: e.pcmSha256 },
        encoded: encoded.get(`sfx/${e.id}`) ?? null,
        approval: approvals.get(`sfx/${e.id}`) ?? null,
      })),
    },
    null,
    2,
  )}\n`;
}

/** The files in assets/audio/sfx/ that the model-made provenance owns (the victory sting). */
function modelMadeFiles(root = repositoryRoot) {
  const path = join(root, ...MODEL_PROVENANCE_PATH.split('/'));
  if (!existsSync(path)) return new Set();
  /** @type {{ sounds: { file: string }[] }} */
  const record = JSON.parse(readFileSync(path, 'utf8'));
  return new Set(record.sounds.map((sound) => sound.file));
}

/**
 * Compares the committed effects and their provenance with a fresh render: every recipe renders
 * to the PCM its Ogg was encoded from, every Ogg is the recorded file with the PCM's length, and
 * the provenance is otherwise exactly what the generator writes.
 *
 * @param {string} [root]
 * @returns {string[]} problems
 */
export function checkEffects(root = repositoryRoot) {
  const effects = renderEffects(root);
  /** @type {string[]} */
  const problems = [];
  const committed = readSynthProvenance(root);
  if (!committed) return [`${SYNTH_PROVENANCE_PATH} is missing or unreadable.`];
  /** @type {Map<string, Encoded>} */
  const encoded = new Map();
  /** @type {Map<string, Approval | null>} */
  const approvals = new Map();
  for (const effect of effects) {
    const id = `sfx/${effect.id}`;
    const where = `assets/audio/${effect.file}`;
    const entry = committed.get(id);
    approvals.set(id, entry?.approval ?? null);
    if (!entry?.encoded) {
      problems.push(`${where} was never encoded: run node scripts/audio/sfx.mjs.`);
      continue;
    }
    encoded.set(id, entry.encoded);
    if (entry.encoded.from !== effect.pcmSha256) {
      problems.push(
        `${where} is not encoded from its recipe's output: run node scripts/audio/sfx.mjs.`,
      );
    }
    let bytes;
    try {
      bytes = readFileSync(join(root, 'assets', 'audio', ...effect.file.split('/')));
    } catch {
      problems.push(`${where} is missing: run node scripts/audio/sfx.mjs.`);
      continue;
    }
    if (bytes.length !== entry.encoded.bytes || sha256(bytes) !== entry.encoded.sha256) {
      problems.push(`${where} is not the encoded file its provenance records.`);
      continue;
    }
    const info = readOggVorbis(bytes);
    if (info.samples !== effect.samples || info.channels !== 1) {
      problems.push(
        `${where}: ${info.samples} samples in ${info.channels} channels, expected ${effect.samples} mono.`,
      );
    }
    if (info.vendor !== entry.encoded.vendor) {
      problems.push(
        `${where}: encoder ${info.vendor}, its provenance says ${entry.encoded.vendor}.`,
      );
    }
  }
  const shipped = new Set(effects.map((e) => e.file));
  const modelMade = modelMadeFiles(root);
  for (const name of readdirSync(join(root, ...SFX_DIR.split('/')))) {
    const file = `sfx/${name}`;
    if (!shipped.has(file) && !modelMade.has(file)) {
      problems.push(`${SFX_DIR}/${name} has no recipe and no provenance.`);
    }
  }
  const text = readFileSync(join(root, ...SYNTH_PROVENANCE_PATH.split('/')), 'utf8');
  if (problems.length === 0 && text !== synthProvenance(effects, encoded, approvals)) {
    problems.push(`${SYNTH_PROVENANCE_PATH} is stale: run node scripts/audio/sfx.mjs.`);
  }
  return problems;
}

/** @returns {string} */
function ffmpeg() {
  return process.env['FFMPEG'] ?? 'ffmpeg';
}

/**
 * Encodes one effect's PCM to its Ogg file and measures the result.
 *
 * @param {Effect} effect
 * @param {string} oggPath
 * @param {string} encoder FFmpeg's version line.
 * @returns {Encoded}
 */
function encodeEffect(effect, oggPath, encoder) {
  const work = mkdtempSync(join(tmpdir(), 'pearl-sea-sfx-'));
  try {
    const wavPath = join(work, `${effect.id}.wav`);
    writeFileSync(wavPath, effect.pcm);
    const flags = ['-hide_banner', '-loglevel', 'error', '-y'];
    execFileSync(ffmpeg(), [...flags, '-i', wavPath, ...ENCODE_ARGS, oggPath]);
    const raw = execFileSync(
      ffmpeg(),
      [...flags, '-i', oggPath, '-f', 'f32le', '-ac', '1', '-ar', String(SFX_SAMPLE_RATE), '-'],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    const decoded = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
    const pcm = decodeWav(Buffer.from(effect.pcm)).samples;
    const peakDbfs = (/** @type {ArrayLike<number>} */ values, scale = 1) =>
      gainToDb(Array.from(values).reduce((max, v) => Math.max(max, Math.abs(v)), 0) / scale);
    const extra = decoded.length - effect.samples;
    const silent =
      extra < 0
        ? -extra <= DROPPABLE_TAIL_SAMPLES && peakDbfs(pcm.subarray(extra), 32768) <= SILENT_DBFS
        : extra <= PADDING_SAMPLES && peakDbfs(decoded.subarray(effect.samples)) <= SILENT_DBFS;
    if (!silent) {
      throw new Error(
        `${effect.id}: decoded ${decoded.length} samples, rendered ${effect.samples}.`,
      );
    }
    const peak = roundTo(gainToDb(truePeak(Float64Array.from(decoded))), 2);
    if (peak > DECODED_TRUE_PEAK_LIMIT_DBTP) {
      throw new Error(`${effect.id}: the decoded Ogg peaks at ${peak} dBTP.`);
    }
    const bytes = readFileSync(oggPath);
    const info = readOggVorbis(bytes);
    if (
      info.samples !== effect.samples ||
      info.channels !== 1 ||
      info.sampleRate !== SFX_SAMPLE_RATE
    ) {
      throw new Error(`${effect.id}: the Ogg headers do not match the PCM.`);
    }
    return {
      from: effect.pcmSha256,
      encoder,
      vendor: info.vendor,
      decodedTruePeakDbtp: peak,
      bytes: bytes.length,
      sha256: sha256(bytes),
    };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    const problems = checkEffects();
    if (problems.length > 0) {
      console.error(problems.map((problem) => `- ${problem}`).join('\n'));
      process.exit(1);
    }
    console.log("Checked the synthesized effects: every file is its recipe's output.");
  } else {
    const option = (/** @type {string} */ name) => {
      const at = args.indexOf(name);
      return at >= 0 ? args.slice(at + 1) : undefined;
    };
    const only = option('--only')?.[0]?.split(',');
    const wavDir = option('--wav')?.[0];
    const [gate, answer] = option('--approve') ?? [];
    if (gate !== undefined && (!gate || !answer)) {
      throw new Error('Usage: --approve <gate> <answer>');
    }
    /** @type {Approval | null} */
    const approval = gate && answer ? { gate, answer } : null;
    const effects = renderEffects(repositoryRoot, only);
    const all = only ? renderEffects(repositoryRoot) : effects;
    const committed = readSynthProvenance(repositoryRoot) ?? new Map();
    const dir = join(repositoryRoot, ...SFX_DIR.split('/'));
    mkdirSync(dir, { recursive: true });
    if (wavDir) mkdirSync(wavDir, { recursive: true });
    const encoder =
      execFileSync(ffmpeg(), ['-hide_banner', '-version'], { encoding: 'utf8' })
        .split('\n')[0]
        ?.trim()
        .replace(/ Copyright .*$/, '') ?? 'ffmpeg';
    /** @type {Map<string, Encoded>} */
    const encoded = new Map();
    /** @type {Map<string, Approval | null>} */
    const approvals = new Map();
    const selected = new Set(effects.map((e) => e.id));
    for (const effect of all) {
      const id = `sfx/${effect.id}`;
      const oggPath = join(repositoryRoot, 'assets', 'audio', ...effect.file.split('/'));
      const entry = committed.get(id);
      const kept =
        entry?.encoded?.from === effect.pcmSha256 &&
        existsSync(oggPath) &&
        sha256(readFileSync(oggPath)) === entry.encoded.sha256;
      if (kept && entry?.encoded) {
        encoded.set(id, entry.encoded);
        approvals.set(id, entry.approval ?? null);
      } else if (selected.has(effect.id)) {
        encoded.set(id, encodeEffect(effect, oggPath, encoder));
        approvals.set(id, null);
      } else {
        throw new Error(`${id} changed but is not in --only; render it too.`);
      }
      if (approval && selected.has(effect.id)) approvals.set(id, approval);
      if (wavDir && selected.has(effect.id))
        writeFileSync(join(wavDir, `${effect.id}.wav`), effect.pcm);
      if (selected.has(effect.id)) {
        const e = /** @type {Encoded} */ (encoded.get(id));
        console.log(
          `${effect.id.padEnd(18)} ${effect.seconds.toFixed(3).padStart(6)} s  ${String(effect.loudness).padStart(7)} LUFS  ${String(effect.truePeakDbtp).padStart(6)} dBTP  ogg ${String(e.bytes).padStart(6)} B ${String(e.decodedTruePeakDbtp).padStart(6)} dBTP${kept ? '' : '  (encoded)'}`,
        );
      }
    }
    const names = new Set(all.map((e) => `${e.id}.ogg`));
    const modelMade = modelMadeFiles(repositoryRoot);
    for (const name of readdirSync(dir)) {
      if (!names.has(name) && !modelMade.has(`sfx/${name}`) && /\.(ogg|wav)$/.test(name)) {
        rmSync(join(dir, name));
      }
    }
    writeFileSync(
      join(repositoryRoot, ...SYNTH_PROVENANCE_PATH.split('/')),
      synthProvenance(all, encoded, approvals),
    );
    const seconds = effects.reduce((sum, e) => sum + e.seconds, 0);
    const bytes = effects.reduce((sum, e) => sum + (encoded.get(`sfx/${e.id}`)?.bytes ?? 0), 0);
    console.log(`${effects.length} effects, ${seconds.toFixed(2)} s, ${bytes} bytes of Ogg.`);
  }
}
