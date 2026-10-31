/**
 * Sea friends' growth (design §6.5): a friend's set is the union of its skills' items; it hatches
 * when 30 % of its set was answered right once, grows up at 80 % silver once its monster is freed
 * (never before, however well the child knows the set), is crowned at 100 % gold with its monster
 * freed; it is hungry only for due items Svačinka can serve.
 */
import { describe, expect, it } from 'vitest';
import { initialProfileState } from '../../../src/rules/contract';
import type { ItemState, ProfileState } from '../../../src/rules/contract';
import { itemIndex } from '../../../src/rules/learning/index-cache';
import {
  earnedStage,
  friendSet,
  hungryFriends,
  servableItems,
} from '../../../src/rules/progression/friends';
import { lagoonPack } from '../../fixtures/rules/packs';

const data = lagoonPack().data;
const index = itemIndex(data);
const krab = data.friends.find((f) => f.id === 'krab-tvrdak')!;
const set = friendSet(data, krab);
const DAY = 20_000;

/** The fewest items of the set that make `share` percent (shares are rounded down). */
const itemsFor = (share: number) => Math.ceil((set.length * share) / 100);

/** A state owning Krab with `count` items of its set at `box` (its monster freed or not). */
function withKrab(count: number, box: number, freed = false): ProfileState {
  const state = initialProfileState({ dailyGoal: 30, race: true });
  state.day = DAY;
  state.friends[krab.id] = {
    stage: 'egg',
    obtainedDay: DAY,
    stageDay: DAY,
    outfit: { head: null, eyes: null, neck: null },
  };
  const recent: ItemState['recent'] = box === 5 ? ['fast', 'fast', 'fast'] : ['ok', 'ok', 'ok'];
  for (const item of set.slice(0, count)) {
    state.items[item] = { box, due: DAY + 1, seen: 6, correct: 6, recent, lastDay: DAY };
  }
  if (freed) state.monsters[krab.monster!] = { freedDay: DAY };
  return state;
}

describe('a friend’s set', () => {
  it('is the union of its skills’ items', () => {
    const union = new Set(krab.skills.flatMap((skill) => index.get(skill) ?? []));
    expect(new Set(set)).toEqual(union);
    expect(set.length).toBeGreaterThan(20);
  });
});

describe('growth', () => {
  it('hatches at 30 % answered right once', () => {
    expect(earnedStage(withKrab(itemsFor(30) - 1, 1), data, krab, index)).toBe('egg');
    expect(earnedStage(withKrab(itemsFor(30), 1), data, krab, index)).toBe('baby');
  });

  it('grows up at 80 % silver only once its monster is freed', () => {
    expect(earnedStage(withKrab(itemsFor(80), 3), data, krab, index)).toBe('baby');
    expect(earnedStage(withKrab(set.length, 3), data, krab, index), 'not before the monster').toBe(
      'baby',
    );
    expect(earnedStage(withKrab(itemsFor(80), 3, true), data, krab, index)).toBe('grown');
    expect(earnedStage(withKrab(itemsFor(80) - 1, 3, true), data, krab, index)).toBe('baby');
  });

  it('is crowned at 100 % gold with its monster freed', () => {
    expect(earnedStage(withKrab(set.length, 5, true), data, krab, index)).toBe('crowned');
    expect(earnedStage(withKrab(set.length, 5), data, krab, index)).toBe('baby');
    expect(earnedStage(withKrab(set.length - 1, 5, true), data, krab, index)).toBe('grown');
  });
});

describe('hunger', () => {
  it('counts only due items Svačinka can serve, and only for hatched friends', () => {
    const state = withKrab(itemsFor(40), 1);
    // Answered three days ago and due since: hungry, once hatched.
    for (const record of Object.values(state.items)) {
      record.lastDay = DAY - 3;
      record.due = DAY - 2;
    }
    expect(hungryFriends(state, data), 'an egg is never hungry').toEqual([]);
    state.friends[krab.id]!.stage = 'baby';
    const servable = servableItems(data);
    const due = Object.keys(state.items).filter((item) => servable.has(item));
    expect(due.length).toBeGreaterThan(0);
    expect(hungryFriends(state, data)).toEqual([krab.id]);
    // Board-only items alone never make a friend hungry.
    for (const item of due) delete state.items[item];
    expect(Object.keys(state.items).length).toBeGreaterThan(0);
    expect(hungryFriends(state, data)).toEqual([]);
  });
});
