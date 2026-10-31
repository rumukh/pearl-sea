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
  '1.0.0': 'a43ba63d18c134d6', // Slunná laguna, the vertical slice
};

/** Generators that make boards, not problems: their items are trained only by minigames. */
const BOARD_GENERATORS: readonly GeneratorId[] = ['alphabet', 'pairs', 'sort', 'segment', 'family'];

/**
 * Friends whose set holds board-only items on purpose (S2: they never come up in Svačinka and are
 * reviewed only when a minigame is replayed), with the item kinds allowed. None yet: Želva's set
 * leaves out the necklace's `abc:` words (docs/content.md §4).
 */
const BOARD_ITEMS_ON_PURPOSE: Readonly<Record<string, readonly string[]>> = {};

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
      for (const id of params['words']?.words ?? []) {
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

  it('practises every skill in a level', () => {
    const practised = new Set(data.levels.flatMap((l) => l.activities.flatMap((a) => a.skills)));
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

  it('feeds a friend with every item a sentence teaches', () => {
    const fed = new Set(data.friends.flatMap((f) => [...friendSet(f.skills)]));
    const hungry: string[] = [];
    for (const skill of data.skills) {
      if (skill.generator !== 'spell.sentence' && skill.generator !== 'spell.mistake') continue;
      for (const item of items.get(skill.id) ?? []) {
        if (!fed.has(item)) hungry.push(`${skill.id}: ${item}`);
      }
    }
    expect(hungry).toEqual([]);
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

  it('lets an egg warm from problems its region teaches after lesson 1 (S2: at least 45 %)', () => {
    for (const friend of data.friends) {
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

  it('keeps each lagoon friend’s set small enough to hatch in lesson 1 (design §4.1)', () => {
    for (const friend of data.friends.filter((f) => f.region === 'sunny-lagoon')) {
      const size = friendSet(friend.skills).size;
      expect(size, friend.id).toBeGreaterThanOrEqual(25);
      expect(size, friend.id).toBeLessThanOrEqual(40);
    }
  });
});

describe('content history', () => {
  const historyDir = join(root, 'content', 'history');
  const shipped = existsSync(historyDir)
    ? readdirSync(historyDir).filter((name) => name.endsWith('.json'))
    : [];
  const archived = (name: string): Pack => JSON.parse(readFileSync(join(historyDir, name), 'utf8'));
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
    expect([...shipped].sort()).toEqual(
      Object.keys(REVISIONS)
        .filter((revision) => revision !== current)
        .map((revision) => `${revision}.json`)
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
      const text = readFileSync(join(historyDir, name), 'utf8');
      const outcome = parseContentJson(text, contentRegistration, name);
      expect(outcome.ok, `${name}: ${JSON.stringify(outcome.ok ? null : outcome.error)}`).toBe(
        true,
      );
      if (outcome.ok) expect(`${outcome.value.revision}.json`).toBe(name);
    }
  });
});
