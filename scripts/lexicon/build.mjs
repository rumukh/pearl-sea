// @ts-check
/**
 * Builds the content pack from its sources (docs/content.md):
 *
 *   node scripts/lexicon/build.mjs           write content/pearl-sea.content.json
 *   node scripts/lexicon/build.mjs --check   fail when the pack is not the build of its sources
 *
 * The pack is `content/pack-src/pack.json` (what the regions share: grades, balance, placement,
 * quests, …) and one file per region in `content/pack-src/regions/` (its region, levels, skills,
 * friends, monster, story, …), merged in file-name order, with `data.lexicon` built from the word
 * bank in `content/lexicon-src` (docs/lexicon.md §8): noun and verb data nested, spelling points as
 * positions in the lemma, the point each sentence gap tests, every word of a sentence as a token,
 * relations from the sets. The word bank is checked first (check.mjs). The pack's `id`, `revision`
 * and `schemaVersion` are kept from the pack file, so `npm run content:bump` keeps working; the
 * file is formatted with the repository's Prettier.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain, repositoryRoot } from '../lib/tools.mjs';
import { checkLexicon, parseMarked } from './check.mjs';

export const PACK_FILE = join(repositoryRoot, 'content', 'pearl-sea.content.json');
export const PACK_SOURCE = join(repositoryRoot, 'content', 'pack-src', 'pack.json');
/** One file per region (`01-sunny-lagoon.json`, …), merged into the pack in file-name order. */
export const REGION_SOURCES = join(repositoryRoot, 'content', 'pack-src', 'regions');
/** What a region file may hold: its records, appended to the pack's lists. */
export const REGION_KEYS = [
  'objectives',
  'regions',
  'levels',
  'skills',
  'friends',
  'monsters',
  'cosmetics',
  'stickers',
  'quests',
  'story',
];

/** The contract's words of a text (`textWords`): runs of letters with inner hyphens. */
const TEXT_WORDS = /\p{L}+(?:-\p{L}+)*/gu;
/** Parts of speech that inflect: their segments keep an empty (zero) ending. */
const INFLECTED = new Set(['noun', 'adj', 'pron', 'num', 'verb']);
/**
 * Letters that alphabetical order tells apart only by the háček or ch (abc-pairs sets).
 * @type {[string, string][]}
 */
const LETTER_PAIRS = [
  ['h', 'ch'],
  ['c', 'č'],
  ['r', 'ř'],
  ['s', 'š'],
  ['z', 'ž'],
];

/**
 * The contract lexicon (src/rules/contract/lexicon.ts) of a checked word bank: every word,
 * family, sentence and relation of it.
 * @param {any} model the word bank as `checkLexicon` reads it (`report.model`)
 * @returns {any}
 */
export function buildLexicon(model) {
  // Tags from the alphabet sets: every word of a set, and the sets that tell letters apart.
  /** @type {Map<string, Set<string>>} */
  const setTags = new Map();
  /** @param {string} id @param {string} tag */
  const tag = (id, tag) => {
    const tags = setTags.get(id) ?? new Set();
    setTags.set(id, tags.add(tag));
  };
  for (const { data } of model.topics) {
    for (const set of data.sets ?? []) {
      if (set.kind !== 'alphabet') continue;
      /** @type {string[]} */
      const firsts = set.words.map((/** @type {string} */ id) => {
        const lemma = model.words.get(id).lemma.toLowerCase();
        return lemma.startsWith('ch') ? 'ch' : lemma.charAt(0);
      });
      const pairs = LETTER_PAIRS.some(([a, b]) => firsts.includes(a) && firsts.includes(b));
      for (const id of set.words) {
        tag(id, 'abc');
        if (pairs) tag(id, 'abc-pairs');
      }
    }
  }

  const words = [...model.words.values()]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((w) => convertWord(w, setTags.get(w.id) ?? new Set()));

  // Families: kin from shared kin labels, sound-alike families both ways.
  const families = [...model.families.values()];
  /** @type {Map<string, string[]>} */
  const kin = new Map();
  for (const f of families) {
    if (f.kin) kin.set(f.kin, [...(kin.get(f.kin) ?? []), f.id]);
  }
  /** @type {Map<string, string>} */
  const soundAlike = new Map();
  for (const f of families) if (f.soundAlikeOf) soundAlike.set(f.id, f.soundAlikeOf);
  for (const f of families) {
    if (f.soundAlikeOf && !soundAlike.has(f.soundAlikeOf)) soundAlike.set(f.soundAlikeOf, f.id);
  }
  const familyRecords = families.map((f) => ({
    id: f.id,
    letter: f.letter ?? null,
    head: f.head,
    order: f.letter ? (f.order ?? null) : null,
    core: f.core === true,
    root: f.root,
    kin: f.kin ? (kin.get(f.kin) ?? []).filter((id) => id !== f.id) : [],
    ...(soundAlike.has(f.id) ? { soundAlike: soundAlike.get(f.id) } : {}),
    src: f.src ?? [],
  }));

  // Sentences.
  /** @type {any[]} */
  const sentences = [];
  for (const { file, data } of model.topics) {
    const topic = file.replace(/\.json$/, '');
    for (const s of data.sentences ?? []) {
      sentences.push(
        convertSentence(s, topic, data.grade, model.gapPoints.get(s.id) ?? [], model.words),
      );
    }
  }

  // Relations from the sets.
  /** @type {[string, string][]} */
  const synonyms = [];
  /** @type {[string, string][]} */
  const antonyms = [];
  /** @type {{ general: string; specific: string[] }[]} */
  const hierarchies = [];
  /** @type {[any, any][]} */
  const soundAlikes = [];
  for (const { data } of model.topics) {
    for (const set of data.sets ?? []) {
      if (set.kind === 'synonyms' || set.kind === 'antonyms') {
        const list = set.kind === 'synonyms' ? synonyms : antonyms;
        set.words.forEach((/** @type {string} */ a, /** @type {number} */ i) => {
          for (const b of set.words.slice(i + 1)) list.push([a, b]);
        });
      } else if (set.kind === 'hyponyms') {
        hierarchies.push({ general: set.general, specific: [...set.specific] });
      } else if (set.kind === 'sound-alikes') {
        /** @type {{ word: string; form: string }[]} */
        const items = set.forms;
        const refs = items.map((item) =>
          model.words.get(item.word).lemma === item.form
            ? item.word
            : { word: item.word, form: item.form },
        );
        refs.forEach((a, i) => {
          for (const b of refs.slice(i + 1)) soundAlikes.push([a, b]);
        });
      }
    }
  }

  return {
    sources: [...model.sources.values()].map((s) => ({
      id: s.id,
      title: s.title,
      ...(s.url ? { url: s.url } : {}),
    })),
    words,
    families: familyRecords,
    sentences,
    relations: { synonyms, antonyms, hierarchies, soundAlikes },
  };
}

/**
 * One word in the contract's shape.
 * @param {any} w a merged word of the word bank
 * @param {Set<string>} extraTags
 */
function convertWord(w, extraTags) {
  /** @type {Map<number, { at: number; correct: string; alt: string[]; rule: string; test?: string }>} */
  const points = new Map();
  for (const p of w.points) {
    const parsed = parseMarked(p.spell);
    parsed.gaps.forEach((gap, i) => {
      const r = p.rules[i];
      const rule = typeof r === 'string' ? r : r.rule;
      const test = typeof r === 'string' ? undefined : r.test;
      const at = [...parsed.plain.slice(0, gap.start)].length;
      const known = points.get(at);
      if (known) {
        for (const alt of gap.alts) if (!known.alt.includes(alt)) known.alt.push(alt);
        if (test !== undefined && known.test === undefined) known.test = test;
      } else {
        points.set(at, {
          at,
          correct: gap.correct,
          alt: [...gap.alts],
          rule,
          ...(test === undefined ? {} : { test }),
        });
      }
    });
  }
  const tags = [...new Set([...(w.tags ?? []), ...extraTags])].sort();
  /** @type {Record<string, unknown>} */
  const out = {
    id: w.id,
    lemma: w.lemma,
    pos: w.pos,
    grade: w.grade,
    topics: [...new Set(w.topics)],
    tags,
    src: [...new Set(w.src)],
  };
  if (w.pos === 'noun') {
    out.noun = {
      gender: w.gender,
      ...(w.gender === 'm' ? { animate: w.animate } : {}),
      numbers: w.numbers ?? 'both',
      pattern: w.pattern ?? null,
      ...(w.paradigm ? { paradigm: w.paradigm } : {}),
      ...(w.proper ? { proper: w.proper } : {}),
    };
  }
  if (w.pos === 'verb') {
    out.verb = {
      aspect: w.aspect,
      reflexive: w.reflexive ?? null,
      ...(w.paradigm ? { paradigm: w.paradigm } : {}),
    };
  }
  if (w.register !== undefined) out.register = w.register;
  if (w.standard !== undefined) out.standard = w.standard;
  if (w.family !== undefined)
    out.family = { id: w.family, role: w.role === 'head' ? 'head' : 'related' };
  if (w.segments) {
    const s = w.segments;
    /** @type {[string, string][]} */
    const segments = [];
    if (s.prefix) segments.push(['prefix', s.prefix]);
    segments.push(['root', s.root]);
    if (s.suffix) segments.push(['suffix', s.suffix]);
    if (s.ending || INFLECTED.has(w.pos)) segments.push(['ending', s.ending]);
    out.segments = segments;
  }
  if (points.size) out.spelling = [...points.values()].sort((a, b) => a.at - b.at);
  if (w.senses) out.senses = w.senses;
  return out;
}

/**
 * One sentence in the contract's shape: its gaps with the points they test, every word a token.
 * @param {any} s a sentence of the word bank
 * @param {string} topic the topic file it is in
 * @param {number} fileGrade
 * @param {(number | undefined)[]} points the point each gap tests (check.mjs)
 * @param {Map<string, any>} words
 */
function convertSentence(s, topic, fileGrade, points, words) {
  const { plain, gaps } = parseMarked(s.text);
  const found = [...plain.matchAll(TEXT_WORDS)].map((m) => ({
    t: m[0],
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }));
  /** @type {Record<string, unknown>[]} */
  const tokens = found.map((token) => ({ t: token.t }));
  /** @param {number} at */
  const tokenAt = (at) => found.findIndex((token) => token.start <= at && at < token.end);
  /** @param {string} text @param {number} [before] */
  const tokenNamed = (text, before = Infinity) =>
    found.findIndex((token, i) => token.t === text && i < before);
  /** @param {Record<string, unknown>} token @param {any} word */
  const describe = (token, word) => {
    token.word = word.id;
    token.pos = word.pos;
    if (word.pos === 'noun') {
      token.gender = word.gender === 'm' ? (word.animate ? 'ma' : 'mi') : word.gender;
    }
  };

  // Marks: in text order, each on the first unmarked token with its text.
  /** @type {Set<number>} */
  const marked = new Set();
  /** @type {number[]} */
  const subjects = [];
  /** @type {number[]} */
  const predicates = [];
  /** @type {number[]} */
  const conjunctions = [];
  /** @type {string[]} */
  const moods = [];
  for (const mark of s.marks ?? []) {
    const index = found.findIndex((token, i) => token.t === mark.t && !marked.has(i));
    if (index < 0) continue;
    marked.add(index);
    const token = /** @type {Record<string, unknown>} */ (tokens[index]);
    if (mark.word !== undefined) describe(token, words.get(mark.word));
    if (mark.pos !== undefined) token.pos = mark.pos;
    for (const key of ['case', 'number', 'person', 'tense', 'mood'])
      if (mark[key] !== undefined) token[key] = mark[key];
    if (mark.role !== undefined) {
      token.member = mark.role;
      (mark.role === 'subject' ? subjects : predicates).push(index);
      if (mark.role === 'predicate' && mark.mood) moods.push(mark.mood);
    }
    if (mark.pos === 'conj') conjunctions.push(index);
  }

  const gapRecords = gaps.map((gap, i) => {
    const meta = s.gaps[i];
    const index = tokenAt(gap.start);
    /** @type {Record<string, unknown>} */
    const record = { rule: meta.rule, word: meta.word ?? null };
    const point = points[i];
    if (point !== undefined) record.point = point;
    if (meta.case !== undefined) record.case = meta.case;
    if (meta.number !== undefined) record.number = meta.number;
    if (meta.subjects) {
      record.subjects = meta.subjects.map((/** @type {any} */ subject) =>
        tokenNamed(subject.t, index),
      );
      for (const subject of meta.subjects) {
        const at = tokenNamed(subject.t, index);
        const token = tokens[at];
        if (token && token.word === undefined) {
          describe(token, words.get(subject.word));
          token.case = 1;
          token.number = subject.number ?? 'pl';
        }
      }
    }
    // A gap inside one word names that word on its token.
    const token = tokens[index];
    if (
      meta.word !== undefined &&
      token &&
      token.word === undefined &&
      gap.end <= (found[index]?.end ?? 0)
    )
      describe(token, words.get(meta.word));
    return record;
  });

  /** @type {Record<string, unknown>} */
  const out = {
    id: s.id,
    grade: s.grade ?? fileGrade,
    topics: [...new Set([topic, ...(s.topics ?? [])])],
    text: s.text,
    gaps: gapRecords,
    tokens,
  };
  const kind = plain.endsWith('?')
    ? 'question'
    : moods.includes('imperative')
      ? 'command'
      : moods.length && moods.every((mood) => mood === 'indicative') && plain.endsWith('.')
        ? 'statement'
        : undefined;
  if (kind) out.kind = kind;
  if (subjects.length) out.subjects = subjects;
  if (predicates.length) out.predicates = predicates;
  if (s.clauses !== undefined) {
    out.clauses = s.clauses;
    if (s.clauses > 1 && conjunctions.length) out.conjunctions = conjunctions;
  }
  return out;
}

/**
 * The whole pack: the game source with the built lexicon, keeping the pack's own header. The game
 * source is `pack.json` (what all regions share: grades, balance, placement, quests, the Inkoustíci,
 * the opening beats) with each region's file of `regions/` merged in, in file-name order.
 * @param {any} lexicon
 */
export function buildPack(lexicon) {
  const header = existsSync(PACK_FILE)
    ? JSON.parse(readFileSync(PACK_FILE, 'utf8'))
    : { id: 'pearl-sea', revision: '1.0.0', schemaVersion: 1 };
  const game = JSON.parse(readFileSync(PACK_SOURCE, 'utf8'));
  const names = existsSync(REGION_SOURCES)
    ? readdirSync(REGION_SOURCES)
        .filter((name) => name.endsWith('.json'))
        .sort()
    : [];
  for (const name of names) {
    mergeRegion(game, JSON.parse(readFileSync(join(REGION_SOURCES, name), 'utf8')), name);
  }
  return {
    id: header.id,
    revision: header.revision,
    schemaVersion: header.schemaVersion,
    data: { ...game, lexicon },
  };
}

/**
 * Appends a region file's records to the game source; a region file holds only `REGION_KEYS`.
 * @param {any} game
 * @param {any} region
 * @param {string} name
 */
export function mergeRegion(game, region, name) {
  for (const [key, value] of Object.entries(region)) {
    if (!REGION_KEYS.includes(key)) {
      throw new Error(`pack-src/regions/${name}: "${key}" belongs in pack-src/pack.json`);
    }
    if (key === 'story') {
      game.story.beats.push(...(value.beats ?? []));
      game.story.rewards.push(...(value.rewards ?? []));
    } else {
      game[key] = [...(game[key] ?? []), ...value];
    }
  }
}

/**
 * The pack file's text: the pack formatted with the repository's Prettier.
 * @param {unknown} pack
 */
export async function formatPack(pack) {
  const prettier = await import('prettier');
  const config = (await prettier.resolveConfig(PACK_FILE)) ?? {};
  return prettier.format(JSON.stringify(pack), { ...config, filepath: PACK_FILE });
}

/** @param {string[]} args */
async function main(args) {
  const check = args.includes('--check');
  const report = checkLexicon();
  if (report.errors.length) {
    console.error(
      `lexicon: ${report.errors.length} problem(s); run node scripts/lexicon/check.mjs`,
    );
    return 1;
  }
  const lexicon = buildLexicon(report.model);
  const text = await formatPack(buildPack(lexicon));
  if (check) {
    const current = existsSync(PACK_FILE) ? readFileSync(PACK_FILE, 'utf8') : '';
    if (current !== text) {
      console.error(
        'content/pearl-sea.content.json is not the build of its sources: run node scripts/lexicon/build.mjs',
      );
      return 1;
    }
    console.log('The pack is the build of its sources.');
    return 0;
  }
  writeFileSync(PACK_FILE, text);
  console.log(
    `Wrote content/pearl-sea.content.json (${lexicon.words.length} words, ${lexicon.sentences.length} sentences).`,
  );
  return 0;
}

if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
