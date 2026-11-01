/**
 * Saves that hold item IDs the contract retired (docs/contract.md §7.6). Since content 1.2.5 a
 * form that several paradigm cells show is one item (contract `canonicalItem`): _delfíni_ is
 * `class:number:delfiin:pl1` only, no longer also `…:pl5`. A save made before can hold records
 * under the retired IDs. Activating newer content merges them into the item they stand for
 * (learning/migrate.ts), and nothing the view shows is lost: every answer stays counted, no pearl
 * of a form gets duller, and stages, levels, coins and stickers stay as they were.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createRuntimeHost, parseContentJson, requireValue } from '@aegis/runtime';
import type { ContentPack, RuntimeSnapshot } from '@aegis/runtime';
import { pearlSeaAdapter } from '../../src/rules/adapter';
import {
  CONTENT_FILE,
  CONTENT_HISTORY_DIRECTORY,
  RUNTIME_STATE_RESOURCE,
  canonicalItem,
  contentHistoryPath,
  contentRegistration,
  formCells,
  parseItemId,
  skillItemIndex,
} from '../../src/rules/contract';
import type { ContentData, ItemState, ProfileState } from '../../src/rules/contract';
import { MASTERY_RANK, masteryLevel } from '../../src/rules/learning/items';
import { mergeRetiredItems } from '../../src/rules/learning/migrate';
import { friendSet, shareAt } from '../../src/rules/progression/friends';
import { archivedRevision, readArchive } from '../../scripts/lib/history.mjs';
import { PERFECT, Player } from '../traces/support';

vi.setConfig({ testTimeout: 300_000 });

const root = join(import.meta.dirname, '..', '..');
type Pack = ContentPack<ContentData>;
const parse = (text: string, name: string): Pack =>
  requireValue(parseContentJson(text, contentRegistration, name)) as Pack;

/** The pack the site serves now, and the newest archived one: the pack old saves still pin. */
const current = parse(readFileSync(join(root, 'content', CONTENT_FILE), 'utf8'), CONTENT_FILE);
const OLD = readdirSync(join(root, ...CONTENT_HISTORY_DIRECTORY.split('/')))
  .map(archivedRevision)
  .filter((revision): revision is string => revision !== null)
  .reduce((newest, revision) => {
    const [a, b] = [revision, newest].map((r) => r.split('.').map(Number)) as [number[], number[]];
    const at = a.findIndex((part, i) => part !== b[i]);
    return at >= 0 && a[at]! > b[at]! ? revision : newest;
  });
const old = parse(
  readArchive(readFileSync(join(root, ...contentHistoryPath(OLD).split('/')))).toString('utf8'),
  contentHistoryPath(OLD),
);
const data = current.data;

/** The forms that were two items until content 1.2.5, each with the item it is now. */
const RETIRED: Readonly<Record<string, string>> = {
  'class:number:delfiin:pl5': 'class:number:delfiin:pl1', // delfíni
  'class:number:delfiin:pl7': 'class:number:delfiin:pl4', // delfíny
  'class:number:delfiin:sg4': 'class:number:delfiin:sg2', // delfína
  'class:number:delfiin:sg6': 'class:number:delfiin:sg3', // delfínovi
  'class:number:vlna:sg6': 'class:number:vlna:sg3', // vlně
  'class:tense:skocxit:pres6': 'class:tense:skocxit:pres3', // skočí
  'class:verb-form:skocxit:pres6': 'class:verb-form:skocxit:pres3', // skočí
};

describe('the shipped content', () => {
  it('serves every form once, by its first cell: the seven duplicate forms are retired', () => {
    const universe = new Set([...skillItemIndex(data).values()].flat());
    for (const [retired, kept] of Object.entries(RETIRED)) {
      expect(canonicalItem(retired, data.lexicon), retired).toBe(kept);
      expect(universe.has(retired), retired).toBe(false);
      expect(universe.has(kept), kept).toBe(true);
    }
    const words = new Map(data.lexicon.words.map((word) => [word.id, word]));
    for (const [skill, items] of skillItemIndex(data)) {
      const shown = new Map<string, string>();
      for (const item of items) {
        const parsed = parseItemId(item);
        if (parsed?.kind !== 'class' || parsed.detail === null) continue;
        const word = words.get(parsed.target);
        const form = word && formCells(word).find((cell) => cell.cell === parsed.detail);
        if (!form) continue;
        const key = `${parsed.dimension}:${parsed.target}:${form.text}`;
        expect(shown.get(key), `${skill}: ${item} shows what ${shown.get(key)} shows`).toBe(
          undefined,
        );
        shown.set(key, item);
      }
    }
  });
});

// ------------------------------------------------------------------------------ the save

/** A child's save on the older pack: Krab chosen, the first lagoon lesson played. */
async function saveOnOldPack(): Promise<RuntimeSnapshot> {
  const player = new Player(PERFECT, 'merged-forms', pearlSeaAdapter, old);
  let snapshot: RuntimeSnapshot | null = null;
  player.host.subscribeCommits((commit) => {
    snapshot = commit.snapshot;
  });
  try {
    expect(await player.begin('krab-tvrdak', '2026-11-02')).toBe(true);
    await player.playLevel('sunny-lagoon.1');
    expect(player.failures).toEqual([]);
  } finally {
    await player.dispose();
  }
  expect(snapshot!.content.revision).toBe(OLD);
  return snapshot!;
}

const stateOf = (snapshot: RuntimeSnapshot) =>
  snapshot.world.resources[RUNTIME_STATE_RESOURCE] as unknown as ProfileState;

/** A save on the older pack with records under retired IDs, as an older build wrote them. */
async function plantedSave() {
  const saved = await saveOnOldPack();
  const d = stateOf(saved).day!;
  // Gold by fluency; silver by the box; silver by the effort path (box 1); bronze twice.
  const gold: ItemState = {
    box: 5,
    due: d + 16,
    seen: 7,
    correct: 6,
    recent: ['fast', 'fast', 'ok'],
    lastDay: d - 1,
  };
  const silver: ItemState = {
    box: 3,
    due: d + 4,
    seen: 4,
    correct: 4,
    recent: ['ok', 'ok', 'fast'],
    lastDay: d - 1,
  };
  const effortSilver: ItemState = {
    box: 1,
    due: d + 1,
    seen: 6,
    correct: 4,
    recent: ['miss', 'ok', 'miss'],
    lastDay: d - 1,
    rightDays: 4,
    lastCountedDay: d - 2,
  };
  const bronze: ItemState = {
    box: 2,
    due: d + 2,
    seen: 5,
    correct: 3,
    recent: ['ok', 'miss', 'ok'],
    lastDay: d - 3,
    rightDays: 1,
    lastCountedDay: d - 6,
  };
  const bronzeToo: ItemState = {
    box: 2,
    due: d + 1,
    seen: 2,
    correct: 2,
    recent: ['ok', 'ok'],
    lastDay: d - 1,
  };
  const planted: Record<string, ItemState> = {
    // Alone: the record moves to the kept item.
    'class:number:delfiin:pl5': gold,
    'class:tense:skocxit:pres6': bronze,
    // Both: the better survives whole and the other's answers are added (not its right days).
    'class:number:delfiin:sg4': effortSilver,
    'class:number:delfiin:sg2': bronze,
    'class:number:vlna:sg6': silver,
    'class:number:vlna:sg3': gold,
    // A tie keeps the kept item's own.
    'class:verb-form:skocxit:pres6': bronzeToo,
    'class:verb-form:skocxit:pres3': bronze,
  };
  const answers = (a: ItemState, b: ItemState) => ({
    seen: a.seen + b.seen,
    correct: a.correct + b.correct,
  });
  const merged: Record<string, ItemState> = {
    'class:number:delfiin:pl1': gold,
    'class:tense:skocxit:pres3': bronze,
    'class:number:delfiin:sg2': { ...effortSilver, ...answers(effortSilver, bronze) },
    'class:number:vlna:sg3': { ...gold, ...answers(gold, silver) },
    'class:verb-form:skocxit:pres3': { ...bronze, ...answers(bronze, bronzeToo) },
  };
  const snapshot = structuredClone(saved);
  Object.assign(stateOf(snapshot).items, structuredClone(planted));
  return { snapshot, planted, merged };
}

/** Restore the save with its own pack, then activate `next` at the hub, as the shell does. */
async function activate(snapshot: RuntimeSnapshot, next: Pack) {
  const host = createRuntimeHost({ adapter: pearlSeaAdapter, content: old, seed: 'merged-forms' });
  try {
    const restored = await host.restore(snapshot);
    expect(restored.ok ? 'restored' : restored.error.code, 'retired IDs do not spoil a save').toBe(
      'restored',
    );
    const before = structuredClone(host.inspect().state) as ProfileState;
    const shown = host.getView();
    expect(host.stageContent(next).ok).toBe(true);
    const activated = await host.activateContent(next, 'boundary');
    expect(activated.ok ? 'activated' : activated.error.code).toBe('activated');
    expect(host.inspect().content.revision).toBe(next.revision);
    return {
      before,
      shown,
      after: structuredClone(host.inspect().state) as ProfileState,
      view: host.getView(),
    };
  } finally {
    await host.dispose();
  }
}

/**
 * No retired ID is left, the kept items hold the merged records, every other record and all
 * other progress are untouched, every answer stays counted and each form keeps its best pearl.
 */
function expectMerged(
  before: ProfileState,
  after: ProfileState,
  planted: Record<string, ItemState>,
  merged: Record<string, ItemState>,
  pack: Pack,
): void {
  const lexicon = pack.data.lexicon;
  expect(Object.keys(after.items).filter((id) => canonicalItem(id, lexicon) !== id)).toEqual([]);
  for (const [id, record] of Object.entries(merged)) expect(after.items[id], id).toEqual(record);
  const touched = new Set([...Object.keys(planted), ...Object.values(RETIRED)]);
  for (const [id, record] of Object.entries(before.items)) {
    if (!touched.has(id)) expect(after.items[id], id).toEqual(record);
  }
  expect({ ...after, items: null }).toEqual({ ...before, items: null });
  const total = (state: ProfileState, key: 'seen' | 'correct') =>
    Object.values(state.items).reduce((sum, record) => sum + record[key], 0);
  expect([total(after, 'seen'), total(after, 'correct')]).toEqual([
    total(before, 'seen'),
    total(before, 'correct'),
  ]);
  const level = (record: ItemState | undefined) =>
    MASTERY_RANK.indexOf(masteryLevel(record, pack.data.balance));
  for (const [retired, kept] of Object.entries(RETIRED)) {
    const best = Math.max(level(before.items[retired]), level(before.items[kept]));
    expect(level(after.items[kept]), kept).toBe(best);
  }
}

describe('activating newer content on a save with retired item IDs', () => {
  it('merges each record into the item it stands for, and loses nothing the view shows', async () => {
    // The same content under the next revision, as content 1.2.5 brings it: only the merge moves.
    const [major, minor, patch] = OLD.split('.').map(Number) as [number, number, number];
    const relabelled: Pack = { ...old, revision: `${major}.${minor}.${patch + 1}` };
    const { snapshot, planted, merged } = await plantedSave();
    const { before, shown, after, view } = await activate(snapshot, relabelled);
    expectMerged(before, after, planted, merged, relabelled);

    // What the view shows: the same progress, and no share or count of pearls lower than before.
    const data = relabelled.data;
    expect(view.grownUps.answers).toBe(shown.grownUps.answers);
    expect([view.coins, view.friends, view.album, view.gallery, view.onboarding]).toEqual([
      shown.coins,
      shown.friends,
      shown.album,
      shown.gallery,
      shown.onboarding,
    ]);
    expect(view.hub.regions).toEqual(shown.hub.regions);
    view.grownUps.skills.forEach((skill, index) => {
      const earlier = shown.grownUps.skills[index]!;
      expect(skill.items, skill.skill).toBe(earlier.items);
      expect(skill.mastered, skill.skill).toBeGreaterThanOrEqual(earlier.mastered);
    });
    view.grownUps.objectives.forEach((objective, index) => {
      const earlier = shown.grownUps.objectives[index]!;
      expect(objective.items, objective.objective).toBe(earlier.items);
      expect(objective.mastered, objective.objective).toBeGreaterThanOrEqual(earlier.mastered);
    });
    for (const friend of data.friends) {
      const set = friendSet(data, friend);
      for (const mastery of ['seen', 'bronze', 'silver', 'gold'] as const) {
        expect(
          shareAt(after, data, set, mastery),
          `${friend.id} ${mastery}`,
        ).toBeGreaterThanOrEqual(shareAt(before, data, set, mastery));
      }
    }
    const tulen = friendSet(
      data,
      data.friends.find((friend) => friend.id === 'tulen-padik')!,
    );
    expect(shareAt(after, data, tulen, 'gold')).toBeGreaterThan(
      shareAt(before, data, tulen, 'gold'),
    );

    // Merging again changes nothing.
    const again = structuredClone(after);
    mergeRetiredItems(again, data);
    expect(again).toEqual(after);
  });

  it('moves the save to the content the site serves now, with its records merged', async () => {
    const { snapshot, planted, merged } = await plantedSave();
    const { before, after } = await activate(snapshot, current);
    expectMerged(before, after, planted, merged, current);
  });
});
