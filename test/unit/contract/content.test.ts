/**
 * The content pack contract on the small fixture pack (test/fixtures/contract/mini-pack.json):
 * the fixture validates, and each class of authoring mistake is reported with a named
 * diagnostic and the offending record. Each negative case changes one thing in a fresh copy.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseContentJson, validateContent } from '@aegis/runtime';
import type { RuntimeDiagnostic } from '@aegis/runtime';
import {
  ACTIVITY_GENERATORS,
  ART_ID_PATTERN,
  BOARD_GENERATORS,
  CONTENT_PACK_ID,
  GENERATOR_IDS,
  LEVEL_ACTIVITY_KINDS,
  checkArtCatalog,
  collectArtIds,
  collectCatalogKeys,
  contentRegistration,
  curriculumGaps,
  skillItemIndex,
} from '../../../src/rules/contract';
import type { ContentData } from '../../../src/rules/contract';

const root = join(import.meta.dirname, '..', '..', '..');
const packText = readFileSync(join(root, 'test', 'fixtures', 'contract', 'mini-pack.json'), 'utf8');

interface Pack {
  id: string;
  revision: string;
  schemaVersion: number;
  data: ContentData;
}
const fresh = (): Pack => JSON.parse(packText);

function diagnostics(pack: Pack): readonly RuntimeDiagnostic[] {
  const outcome = validateContent(pack, contentRegistration, 'test.json');
  return outcome.ok ? [] : outcome.error.diagnostics;
}

function expectDiagnostic(pack: Pack, code: string, recordId?: string): void {
  const found = diagnostics(pack);
  expect(
    found.some((d) => d.code === code && (recordId === undefined || d.recordId === recordId)),
    `expected ${code}${recordId ? ` on ${recordId}` : ''}, got ${JSON.stringify(found)}`,
  ).toBe(true);
}

describe('the fixture pack', () => {
  it('validates under the registration', () => {
    const outcome = parseContentJson(packText, contentRegistration, 'mini-pack.json');
    expect(outcome.ok, JSON.stringify(outcome.ok ? null : outcome.error.diagnostics)).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.id).toBe(CONTENT_PACK_ID);
    expect(outcome.value.schemaVersion).toBe(1);
  });

  it('gives every skill items', () => {
    const index = skillItemIndex(fresh().data);
    for (const [skill, items] of index) expect(items.length, skill).toBeGreaterThan(0);
    expect(index.get('sk.listed-l')).toEqual(['spell:mlynaarx:2', 'spell:mlyyn:2']);
  });

  it('covers its objectives with a lesson and a monster level', () => {
    expect(curriculumGaps(fresh().data)).toEqual([]);
    const pack = fresh();
    pack.data.levels.find((l) => l.id === 'moon-caves.monster')!.objectives = [];
    expect(curriculumGaps(pack.data)).toEqual([
      { objective: 'obj.structure.root', missing: ['monster'] },
    ]);
  });
});

describe('content validation reports', () => {
  it('unknown references', () => {
    const pack = fresh();
    pack.data.levels[0]!.activities[0]!.skills = ['sk.nowhere'];
    expectDiagnostic(pack, 'missing-reference', 'sunny-lagoon.1');
  });

  it('a skill an activity cannot serve', () => {
    const pack = fresh();
    pack.data.levels[0]!.activities[0]!.skills = ['sk.family-pairs'];
    expectDiagnostic(pack, 'invalid-content', 'sunny-lagoon.1');
  });

  it('a skill with no items', () => {
    const pack = fresh();
    const skill = pack.data.skills.find((s) => s.id === 'sk.hard-soft')!;
    (skill.params as { rules: string[] }).rules = ['u-zacatek'];
    expectDiagnostic(pack, 'empty-skill', 'sk.hard-soft');
  });

  it('a monster level that does not end with its battle', () => {
    const pack = fresh();
    pack.data.levels
      .find((l) => l.id === 'sunny-lagoon.monster')!
      .activities.push({
        kind: 'feeding',
        skills: ['sk.hard-soft'],
        count: 4,
        input: 'auto',
        options: {},
      });
    expectDiagnostic(pack, 'invalid-content', 'sunny-lagoon.monster');
  });

  it('a grade-4 region before a grade-3 region', () => {
    const pack = fresh();
    pack.data.regions[0]!.order = 3;
    expectDiagnostic(pack, 'invalid-content', 'sunny-lagoon');
  });

  it('a story scene that is not scene art', () => {
    const pack = fresh();
    const graph = pack.data.story.beats[0]!.graph as unknown as {
      catalogs: { scene: string[] };
      nodes: { scene: string }[];
    };
    graph.catalogs.scene = ['sunny-lagoon'];
    for (const node of graph.nodes) node.scene = 'sunny-lagoon';
    expectDiagnostic(pack, 'invalid-content', 'beat.prologue');
  });

  it('a lexicon mistake', () => {
    const pack = fresh();
    pack.data.lexicon.words.find((w) => w.id === 'ryba')!.noun!.pattern = 'hrad';
    expectDiagnostic(pack, 'invalid-lexicon', 'word ryba');
  });

  it('an unlock cycle', () => {
    const pack = fresh();
    pack.data.levels[0]!.unlock.after = ['sunny-lagoon.monster'];
    expectDiagnostic(pack, 'unreachable', 'sunny-lagoon.1');
  });

  it('arms that do not share the meter', () => {
    const pack = fresh();
    pack.data.monsters[0]!.arms = 3;
    expectDiagnostic(pack, 'invalid-content', 'murena-mumla');
  });

  it('an objective title outside the grown-ups’ area', () => {
    const pack = fresh();
    pack.data.objectives[0]!.titleKey = 'objective.letters.hard-soft';
    expectDiagnostic(pack, 'invalid-content', 'obj.letters.hard-soft');
  });

  it('a malformed record through the schema', () => {
    const pack = fresh();
    (pack.data.objectives[0] as { rvp: string[] }).rvp = ['CJL-3-2-08'];
    expect(diagnostics(pack).length).toBeGreaterThan(0);
  });
});

describe('activities and generators', () => {
  it('give every level activity kind a generator, and use every generator', () => {
    expect(Object.keys(ACTIVITY_GENERATORS).sort()).toEqual([...LEVEL_ACTIVITY_KINDS].sort());
    const used = new Set(Object.values(ACTIVITY_GENERATORS).flat());
    expect(GENERATOR_IDS.filter((generator) => !used.has(generator))).toEqual([]);
    for (const generator of BOARD_GENERATORS) {
      const kinds = Object.entries(ACTIVITY_GENERATORS).filter(([, list]) =>
        list.includes(generator),
      );
      expect(kinds, generator).toHaveLength(1);
    }
  });
});

describe('cross-file references', () => {
  it('collects the art the pack needs, by the media conventions', () => {
    const ids = collectArtIds(fresh().data).map(({ id }) => id);
    for (const id of [
      'friend/krab-tvrdak/baby',
      'friend/krab-tvrdak/grown',
      'egg/krab-tvrdak',
      'monster/murena-mumla/inked',
      'monster/murena-mumla/freed',
      'inkoustik/inkoustik-kanka',
      'scene/sunny-lagoon',
      'map/shallows',
      'map/deep',
      'cosmetic/hat-captain',
      'sticker/pearl',
      'sticker/frame-shell',
    ]) {
      expect(ids, id).toContain(id);
    }
    for (const id of ids) expect(id).toMatch(ART_ID_PATTERN);
    expect(checkArtCatalog(fresh().data, ids)).toEqual([]);
    const missing = checkArtCatalog(
      fresh().data,
      ids.filter((id) => id !== 'egg/krab-tvrdak'),
    );
    expect(missing.map((d) => [d.code, d.recordId])).toEqual([['missing-art', 'egg/krab-tvrdak']]);
  });

  it('collects every catalog key the pack uses', () => {
    const keys = collectCatalogKeys(fresh().data).map(({ key }) => key);
    for (const key of [
      'grownups.objective.letters.hard-soft',
      'region.sunny-lagoon',
      'level.moon-caves.monster',
      'skill.listed-l',
      'friend.krab-tvrdak.mnemonic',
      'monster.murena-mumla.joke.1',
      'inkoustik.kanka',
      'story.prologue.1',
      'grammar.rule.tvrda',
      'grammar.listed.b',
      'grammar.pos.interj',
      'grammar.segment.ending',
    ]) {
      expect(keys, key).toContain(key);
    }
    expect(keys.filter((key) => key.startsWith('grammar.case'))).toEqual([]);
  });
});
