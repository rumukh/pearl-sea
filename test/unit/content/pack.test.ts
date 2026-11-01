/**
 * The content pack (content/pearl-sea.content.json, docs/content.md): it validates, it is the
 * build of its sources, every revision merged to main is pinned to its content hash and archived,
 * and its content keeps the authoring rules every region follows.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dataHash, parseContentJson } from '@aegis/runtime';
import {
  CONTENT_FILE,
  CONTENT_PACK_ID,
  catalogHasKey,
  collectCatalogKeys,
  contentRegistration,
  skillItemIndex,
  skillItems,
} from '../../../src/rules/contract';
import type { ContentData, GeneratorId, Skill } from '../../../src/rules/contract';
import { checkLexicon } from '../../../scripts/lexicon/check.mjs';
import { buildLexicon, buildPack, formatPack } from '../../../scripts/lexicon/build.mjs';
import { archivedRevision, readArchive } from '../../../scripts/lib/history.mjs';

const root = join(import.meta.dirname, '..', '..', '..');
const packText = readFileSync(join(root, 'content', CONTENT_FILE), 'utf8');

interface Pack {
  id: string;
  revision: string;
  schemaVersion: number;
  data: ContentData;
}
const fresh = (): Pack => JSON.parse(packText);

/**
 * Every content revision merged to main, with the content hash a save made on it pins (the
 * runtime's `dataHash` of the pack; literal values, docs/content.md §2). An archived pack never
 * changes, and a content change needs a revision of its own: `npm run content:bump -- <revision>`
 * archives the deployed pack, then pin the new revision here.
 */
const REVISIONS: Readonly<Record<string, string>> = {
  '1.0.0': 'd100ffcbca348be3', // Slunná laguna, the vertical slice
  '1.1.0': 'fe165b25e4728f31', // regions 2-6: the listed words, meanings and parts of speech
  '1.2.0': '7ed523b6d8a3ad19', // regions 7-12: the 3rd grade's finale, the 4th grade's deep, placement
  '1.2.1': '0bbc9d8dcd97870f', // the Krakatice's battle reaches its cap of 40 (design §7.1)
  '1.2.2': '39f6a398bd6aadc0', // balance: grown at 70 % bronze, a streak bonus every 10, chest 1-3
  '1.2.3': '69bff61d6002994d', // led, přístav, Bublinka and Osmička asked only in sentences
  '1.2.4': 'e5eae91473499ccd', // the Czech QA of regions 2-12; Bublinka and Osmička back in Krmení
  '1.2.5': 'fba21f3b2341dd64', // no change of data: saves activate it and merge the retired form items
  '1.2.6': '02803c67c021d1bf', // families mark words of one root, so no hint takes one as another's example
};

/** Generators that make boards, not problems: their items are trained only by minigames. */
const BOARD_GENERATORS: readonly GeneratorId[] = ['alphabet', 'pairs', 'sort', 'segment', 'family'];

/**
 * Friends whose set holds board-only items on purpose (S2: they never come up in Svačinka and are
 * reviewed when the daily adventure replays a minigame), with the item kinds allowed. A board right
 * at the first check credits its items as fast answers, so they can reach gold. Želva knows the
 * alphabet (design §2.2); a listed-word friend knows its letter's school rhyme, and Jazýček also
 * the two families of his short list; Tuleň plays the plural Pexeso of his first lesson, and
 * Kořínek cuts words in his own shell (docs/content.md §3).
 */
const BOARD_ITEMS_ON_PURPOSE: Readonly<Record<string, readonly string[]>> = {
  'zelva-obojka': ['abc'],
  'barakuda-bystrinka': ['abc'],
  'lachtan-lyzar': ['abc'],
  'konik-mydlinek': ['abc'],
  'pyskoun-pysny': ['abc'],
  'jezik-sycik': ['abc'],
  'vydra-vyskalka': ['abc'],
  'jazyk-jazycek': ['abc', 'fam'],
  'tulen-padik': ['pair'],
  'rak-korinek': ['seg'],
};

/**
 * The lesson each friend hatches in (design §3; the first lagoon egg in lesson 1, §4.1). Delfín
 * and the Klauni hatch after the lesson that gives their egg, since their sets hold the lessons
 * after it too (docs/content.md §6).
 */
const HATCH: Readonly<Record<string, string>> = {
  'krab-tvrdak': 'sunny-lagoon.1',
  'meduzka-mekulka': 'sunny-lagoon.1',
  'zelva-obojka': 'sunny-lagoon.1',
  'barakuda-bystrinka': 'coral-reef.2',
  'lachtan-lyzar': 'coral-reef.4',
  'konik-mydlinek': 'kelp-forest.1',
  'pyskoun-pysny': 'kelp-forest.3',
  'jezik-sycik': 'pirate-wreck.1',
  'vydra-vyskalka': 'pirate-wreck.3',
  'jazyk-jazycek': 'pirate-wreck.5',
  'hvezdice-rodinka': 'pearl-bay.2',
  'kalmar-desetiruky': 'volcanic-vents.1',
  'tulen-padik': 'ice-sea.1',
  'delfin-skokanek': 'ice-sea.4',
  'rak-korinek': 'moon-caves.1',
  'stitovec-prisavka': 'sunken-city.1',
  'klipka-vzorna': 'dark-trench.1',
  'klauni-dvojcata': 'kraken-abyss.2',
};

/**
 * Problem skills whose items no friend eats, on purpose: they wait in Osmiččin košík (design
 * §5.15), which serves them with the friends' due items. A friend's set stays small enough to
 * hatch in its lesson, so these skills practise without feeding growth (docs/content.md §3).
 */
const BASKET: readonly string[] = [
  // More of the listed words: odd ones out and relations (regions 2-5).
  'sk.reef.odd-listed',
  'sk.reef.relation-alike',
  'sk.kelp.odd-listed',
  'sk.bay.odd-listed-all',
  'sk.bay.relation-alike',
  'sk.bay.relation-coordinate',
  'sk.vents.inflection',
  // The placement check's first step reaches two points no lagoon friend holds.
  'sk.place.vowels',
  // Ledové moře: the number of verbs, tense forms and the 3rd grade's sentences.
  'sk.ice.verb-number',
  'sk.ice.tense-forms',
  'sk.ice.kinds',
  'sk.ice.clauses',
  'sk.ice.end-marks',
  'sk.ice.conjunctions',
  // Měsíční jeskyně: naming the parts of a word.
  'sk.moon.segment-suffix',
  'sk.moon.segment-ending',
  'sk.moon.segment-all',
  // Potopené město: the pronoun mě/mně.
  'sk.city.mne-sentences',
  'sk.city.mne-mistakes',
  'sk.city.mistakes-all',
  // Bouřlivé moře: verb forms and moods, and standard Czech (design §3.11).
  'sk.storm.tense-forms',
  'sk.storm.person',
  'sk.storm.verb-form',
  'sk.storm.mood-forms',
  'sk.storm.mood',
  'sk.storm.register',
  'sk.storm.spisovne',
  // Krakatičí propast: subjects' genders, clauses and the great review.
  'sk.kraken.gender-class',
  'sk.kraken.clauses',
  'sk.kraken.listed-grade4',
  'sk.kraken.review-spelling',
  'sk.kraken.review-sentences',
  'sk.kraken.review-mistakes',
];

describe('the content pack', () => {
  it('validates under the registration and is a pinned revision of the pearl-sea pack', () => {
    const outcome = parseContentJson(packText, contentRegistration, CONTENT_FILE);
    expect(outcome.ok, JSON.stringify(outcome.ok ? null : outcome.error.diagnostics)).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.id).toBe(CONTENT_PACK_ID);
    expect(Object.keys(REVISIONS)).toContain(outcome.value.revision);
    expect(outcome.value.schemaVersion).toBe(1);
  });

  it('is the build of its sources (run node scripts/lexicon/build.mjs after editing them)', async () => {
    const report = checkLexicon();
    expect(report.errors).toEqual([]);
    const built = await formatPack(buildPack(buildLexicon(report.model)));
    expect(
      built === packText,
      'content/pearl-sea.content.json differs from content/pack-src/pack.json and the word bank',
    ).toBe(true);
  });
});

describe('the content', () => {
  const data = fresh().data;
  const items = skillItemIndex(data);
  const problemItems = new Set(
    data.skills
      .filter((skill) => !BOARD_GENERATORS.includes(skill.generator))
      .flatMap((skill) => items.get(skill.id) ?? []),
  );
  const friendSet = (skills: readonly string[]) =>
    new Set(skills.flatMap((skill) => items.get(skill) ?? []));
  /** The skill with its word or sentence filter narrowed to one record. */
  const only = (skill: Skill, field: 'words' | 'sentences', id: string): Skill => {
    const params = skill.params as unknown as Record<string, Record<string, unknown>>;
    return {
      ...skill,
      params: { ...params, [field]: { ...params[field], [field]: [id] } },
    } as unknown as Skill;
  };

  it('names only words and sentences that serve their skill', () => {
    const idle: string[] = [];
    for (const skill of data.skills) {
      const params = skill.params as unknown as Record<
        string,
        { words?: string[]; sentences?: string[] } | undefined
      >;
      // An odd-one-out set also needs the odd words, which are no items (bílý among bystrý, býk),
      // and a family board its distractors (rybíz beside the fish family).
      const distractors =
        skill.generator === 'odd-one-out' ||
        (skill.generator === 'family' && skill.params.families !== null);
      const words = distractors ? [] : (params['words']?.words ?? []);
      for (const id of words) {
        if (skillItems(only(skill, 'words', id), data.lexicon).length === 0) {
          idle.push(`${skill.id}: word ${id}`);
        }
      }
      for (const id of params['sentences']?.sentences ?? []) {
        if (skillItems(only(skill, 'sentences', id), data.lexicon).length === 0) {
          idle.push(`${skill.id}: sentence ${id}`);
        }
      }
    }
    expect(idle).toEqual([]);
  });

  it('asks every gap of a listed sentence: its gaps keep to the skill’s rules', () => {
    const sentences = new Map(data.lexicon.sentences.map((s) => [s.id, s]));
    const stray: string[] = [];
    for (const skill of data.skills) {
      if (skill.generator !== 'spell.sentence' && skill.generator !== 'spell.mistake') continue;
      const rules: readonly string[] = skill.params.rules;
      for (const id of skill.params.sentences.sentences ?? []) {
        for (const gap of sentences.get(id)?.gaps ?? []) {
          if (!rules.includes(gap.rule)) stray.push(`${skill.id}: ${id} (${gap.rule})`);
        }
      }
    }
    expect(stray).toEqual([]);
  });

  it('practises every skill in a level or a placement step', () => {
    const practised = new Set([
      ...data.levels.flatMap((l) => l.activities.flatMap((a) => a.skills)),
      ...data.placement.steps.map((step) => step.skill),
    ]);
    expect(data.skills.map((s) => s.id).filter((id) => !practised.has(id))).toEqual([]);
  });

  it('teaches in a sentence skill every point a word alone cannot decide (lexicon.md §2.2)', () => {
    const ambiguous = new Set(
      (checkLexicon().model.ambiguous as string[]).map((point) => `spell:${point}`),
    );
    const sentenceItems = new Set(
      data.skills
        .filter((s) => s.generator === 'spell.sentence' || s.generator === 'spell.mistake')
        .flatMap((s) => items.get(s.id) ?? []),
    );
    const bare = data.skills
      .filter((s) => s.generator === 'spell.word')
      .flatMap((s) => (items.get(s.id) ?? []).map((item) => ({ skill: s.id, item })))
      .filter(({ item }) => ambiguous.has(item) && !sentenceItems.has(item))
      .map(({ skill, item }) => `${skill}: ${item}`);
    expect(bare).toEqual([]);
  });

  it('names in no rule line a word its rule’s problems show: a hint never gives the answer away', () => {
    const catalog = JSON.parse(
      readFileSync(join(root, 'content', 'catalogs', 'cs.content.json'), 'utf8'),
    ) as Record<string, string>;
    const lower = (text: string): string => text.toLowerCase();
    const words = new Map(data.lexicon.words.map((word) => [word.id, word]));
    const sentences = new Map(data.lexicon.sentences.map((sentence) => [sentence.id, sentence]));
    const kin = new Map<string, string[]>();
    for (const word of data.lexicon.words) {
      if (word.family) kin.set(word.family.id, [...(kin.get(word.family.id) ?? []), word.id]);
    }
    /** A word's written forms: the lemma and every paradigm cell. */
    const written = (id: string): string[] => {
      const out: string[] = [];
      const walk = (value: unknown): void => {
        if (typeof value === 'string') out.push(lower(value));
        else if (Array.isArray(value)) value.forEach(walk);
        else if (value !== null && typeof value === 'object') Object.values(value).forEach(walk);
      };
      const word = words.get(id);
      if (word) walk([word.lemma, word.noun?.paradigm, word.verb?.paradigm]);
      return out;
    };
    /** The lemma with each option at the point's place: bít, být. */
    const respelled = (lemma: string, at: number, correct: string, options: string[]): string[] => {
      const letters = [...lemma];
      const end = at + [...correct].length;
      return options.map((o) =>
        lower([...letters.slice(0, at), o, ...letters.slice(end)].join('')),
      );
    };
    /** A sentence gap's text with each of its options filled in: odplavala, od plavala. */
    const gapTexts = (text: string, index: number): { texts: string[]; whole: boolean } => {
      const group = [...text.matchAll(/\{([^}]*)\}/g)][index];
      if (group?.index === undefined) return { texts: [], whole: false };
      const fill = (part: string) => part.replace(/\{([^|}]*)\|[^}]*\}/g, '$1');
      const left = /\S*$/.exec(fill(text.slice(0, group.index)))?.[0] ?? '';
      const right = /^\S*/.exec(fill(text.slice(group.index + group[0].length)))?.[0] ?? '';
      return {
        texts: group[1]!
          .split('|')
          .map((option) => lower(`${left}${option}${right}`).replace(/[^\p{L} ]/gu, '')),
        whole: !/\p{L}/u.test(left + right),
      };
    };
    // What a rule's problems show: the asked word in every form, with its other letters, and its
    // family; a gap's text with each option; the agreement's subjects.
    const shown = new Map<string, Map<string, string>>();
    const show = (rule: string, texts: readonly string[], where: string) => {
      const known = shown.get(rule) ?? new Map<string, string>();
      for (const text of texts) if (!known.has(text)) known.set(text, where);
      shown.set(rule, known);
    };
    // A rule whose every item is a choice between the same whole words (mně, mě) names them as
    // its subject, not as an example; any item with letters to fill disables that.
    const choices = new Map<string, Set<string>[]>();
    const lettered = new Set<string>();
    for (const skill of data.skills) {
      if (!['spell.word', 'spell.sentence', 'spell.mistake'].includes(skill.generator)) continue;
      for (const item of items.get(skill.id) ?? []) {
        const [kind, target = '', detail = ''] = item.split(':');
        const where = `${skill.id}: ${target}`;
        if (kind === 'spell') {
          const word = words.get(target);
          const point = word?.spelling?.find((p) => p.at === Number(detail));
          if (!word || !point) continue;
          lettered.add(point.rule);
          show(
            point.rule,
            respelled(word.lemma, point.at, point.correct, [point.correct, ...point.alt]),
            where,
          );
          for (const id of word.family ? (kin.get(word.family.id) ?? []) : [word.id]) {
            show(point.rule, written(id), where);
          }
        } else if (kind === 'gap') {
          const sentence = sentences.get(target);
          const gap = sentence?.gaps[Number(detail)];
          if (!sentence || !gap) continue;
          const { texts, whole } = gapTexts(sentence.text, Number(detail));
          if (whole) choices.set(gap.rule, [...(choices.get(gap.rule) ?? []), new Set(texts)]);
          else lettered.add(gap.rule);
          show(gap.rule, texts, where);
          if (gap.word) show(gap.rule, written(gap.word), where);
          for (const index of gap.subjects ?? []) {
            const token = sentence.tokens?.[index];
            if (token)
              show(gap.rule, [lower(token.t), ...(token.word ? written(token.word) : [])], where);
          }
        }
      }
    }
    const named: string[] = [];
    for (const [key, line] of Object.entries(catalog)) {
      const rule = /^grammar\.rule\.(.+)$/.exec(key)?.[1];
      if (rule === undefined) continue;
      const said = lower(line);
      const tokens = new Set(said.match(/\p{L}+/gu) ?? []);
      const sets = lettered.has(rule) ? [] : (choices.get(rule) ?? []);
      const subject = (text: string) => sets.length > 1 && sets.every((set) => set.has(text));
      for (const [text, where] of shown.get(rule) ?? []) {
        if (text.length < 2 || subject(text)) continue;
        if (text.includes(' ') ? said.includes(text) : tokens.has(text)) {
          named.push(`${key}: ${text} (${where})`);
        }
      }
    }
    expect(named, 'example words no problem of the rule shows (docs/content.md §7)').toEqual([]);
  });

  it('feeds a friend with every item a problem teaches, but the basket’s skills', () => {
    const fed = new Set(data.friends.flatMap((f) => [...friendSet(f.skills)]));
    const hungry: string[] = [];
    const listedButFed: string[] = [];
    for (const skill of data.skills) {
      if (BOARD_GENERATORS.includes(skill.generator)) continue;
      const unfed = (items.get(skill.id) ?? []).filter((item) => !fed.has(item));
      if (BASKET.includes(skill.id)) {
        if (unfed.length === 0) listedButFed.push(skill.id);
      } else {
        hungry.push(...unfed.map((item) => `${skill.id}: ${item}`));
      }
    }
    expect(hungry).toEqual([]);
    expect(listedButFed, 'BASKET lists a skill whose items friends eat').toEqual([]);
  });

  it('keeps board-only items out of friends’ sets unless listed on purpose', () => {
    const boardOnly: string[] = [];
    for (const friend of data.friends) {
      const allowed = BOARD_ITEMS_ON_PURPOSE[friend.id] ?? [];
      for (const item of friendSet(friend.skills)) {
        if (!problemItems.has(item) && !allowed.includes(item.split(':')[0]!)) {
          boardOnly.push(`${friend.id}: ${item}`);
        }
      }
    }
    expect(boardOnly).toEqual([]);
  });

  it('lets a lagoon egg warm from problems the lagoon teaches after lesson 1 (S2: at least 45 %)', () => {
    // A 4th grader's chosen egg warms only through the placed lagoon lessons 2-6 (design §4.1).
    for (const friend of data.friends.filter((f) => f.region === 'sunny-lagoon')) {
      const taught = new Set(
        data.levels
          .filter((l) => l.region === friend.region && l.kind === 'lesson' && l.order > 1)
          .flatMap((l) => l.activities.flatMap((a) => a.skills))
          .filter((id) => {
            const skill = data.skills.find((s) => s.id === id);
            return skill !== undefined && !BOARD_GENERATORS.includes(skill.generator);
          })
          .flatMap((id) => items.get(id) ?? []),
      );
      const set = [...friendSet(friend.skills)];
      const share = (100 * set.filter((item) => taught.has(item)).length) / set.length;
      expect(share, friend.id).toBeGreaterThanOrEqual(45);
    }
  });

  it('keeps each lagoon friend’s set to about 30-40 items (design §4.1)', () => {
    for (const friend of data.friends.filter((f) => f.region === 'sunny-lagoon')) {
      const size = friendSet(friend.skills).size;
      expect(size, friend.id).toBeGreaterThanOrEqual(25);
      expect(size, friend.id).toBeLessThanOrEqual(40);
    }
  });

  it('lets every friend hatch in its lesson: its region offers 30 % of its set by then', () => {
    const levelById = new Map(data.levels.map((l) => [l.id, l]));
    const skillById = new Map(data.skills.map((s) => [s.id, s]));
    const sentences = new Map(data.lexicon.sentences.map((s) => [s.id, s]));
    /** Items one problem or board of a skill can credit at most. */
    const perUnit = (skill: Skill): number => {
      switch (skill.generator) {
        case 'alphabet':
          return skill.params.size;
        case 'pairs':
          return skill.params.pairs * 2;
        case 'sort':
          return skill.params.fish;
        case 'family':
          return skill.params.pick;
        case 'spell.sentence': {
          const ids = skill.params.sentences.sentences ?? [];
          const gaps = ids.map((id) => sentences.get(id)?.gaps.length ?? 1);
          return gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 1;
        }
        default:
          return 1;
      }
    };
    expect(Object.keys(HATCH).sort()).toEqual(data.friends.map((f) => f.id).sort());
    for (const friend of data.friends) {
      const set = friendSet(friend.skills);
      const hatch = levelById.get(HATCH[friend.id]!)!;
      let offered = 0;
      for (const level of data.levels) {
        if (level.region !== hatch.region || level.order > hatch.order) continue;
        for (const activity of level.activities) {
          const skills = activity.skills.map((id) => skillById.get(id)!);
          const capacity =
            (activity.count * skills.reduce((sum, s) => sum + perUnit(s), 0)) / skills.length;
          const reach = new Set(
            activity.skills.flatMap((id) => items.get(id) ?? []).filter((i) => set.has(i)),
          );
          offered += Math.min(Math.floor(capacity), reach.size);
        }
      }
      expect(offered, friend.id).toBeGreaterThanOrEqual(Math.ceil(set.size * 0.3));
    }
  });
});

describe('content history', () => {
  const historyDir = join(root, 'content', 'history');
  const files = existsSync(historyDir) ? readdirSync(historyDir) : [];
  const shipped = files.filter((name) => archivedRevision(name) !== null);
  /** An archived pack's text: the deployed bytes, decompressed (scripts/lib/history.mjs). */
  const archivedText = (name: string): string =>
    readArchive(readFileSync(join(historyDir, name))).toString('utf8');
  const archived = (name: string): Pack => JSON.parse(archivedText(name));
  const order = (revision: string): number[] => revision.split('.').map(Number);
  const older = (a: string, b: string): boolean => {
    const [x, y] = [order(a), order(b)];
    const at = x.findIndex((part, i) => part !== y[i]);
    return at >= 0 && x[at]! < y[at]!;
  };
  const czech: Record<string, string> = Object.assign(
    {},
    ...readdirSync(join(root, 'content', 'catalogs'))
      .filter((name) => name.startsWith('cs.'))
      .map((name) => JSON.parse(readFileSync(join(root, 'content', 'catalogs', name), 'utf8'))),
  );

  it('archives every revision merged to main before the current one', () => {
    const current = fresh().revision;
    expect(
      files.filter((name) => archivedRevision(name) === null),
      'only archives',
    ).toEqual([]);
    expect([...shipped].sort()).toEqual(
      Object.keys(REVISIONS)
        .filter((revision) => revision !== current)
        .map((revision) => `${revision}.json.gz`)
        .sort(),
    );
    for (const name of shipped) {
      expect(older(archived(name).revision, current), `${name} is older than ${current}`).toBe(
        true,
      );
    }
  });

  it('pins the current pack to its revision: changed content needs a new revision', () => {
    const current = fresh();
    const hash = dataHash(current);
    expect(
      hash,
      `the content of revision ${current.revision} is new (hash ${hash}): run ` +
        '`npm run content:bump -- <next revision>` and pin the new revision and its hash in ' +
        'REVISIONS (docs/content.md §2)',
    ).toBe(REVISIONS[current.revision]);
  });

  it('never changes an archived pack: saves made on it pin its hash', () => {
    for (const name of shipped) {
      const pack = archived(name);
      expect(dataHash(pack), name).toBe(REVISIONS[pack.revision]);
    }
  });

  it('keeps every catalog key a shipped pack uses: a restored old save still shows them', () => {
    for (const pack of [fresh(), ...shipped.map(archived)]) {
      const lost = collectCatalogKeys(pack.data).filter(({ key }) => !catalogHasKey(czech, key));
      expect(lost, pack.revision).toEqual([]);
    }
  });

  it('keeps every archived pack valid under the current schema, named by its revision', () => {
    for (const name of shipped) {
      const text = archivedText(name);
      const outcome = parseContentJson(text, contentRegistration, name);
      expect(outcome.ok, `${name}: ${JSON.stringify(outcome.ok ? null : outcome.error)}`).toBe(
        true,
      );
      if (outcome.ok) expect(`${outcome.value.revision}.json.gz`).toBe(name);
    }
  });
});
