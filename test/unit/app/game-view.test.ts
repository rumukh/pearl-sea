/**
 * Pure readings of the game view for the screens: where a level sits, the friend the grotto
 * features and how far it is from growing, what "Dnešní výprava" does (a level under way goes on
 * at its next activity), where results lead, the game's day, and where markers and level nodes
 * sit on the painted maps. Time on the child's side excludes pauses.
 */
import { describe, expect, it } from 'vitest';
import { levelSpots, mapOf, REGION_SPOTS, regionSpot } from '../../../src/app/game/map';
import { createPlayClock, createResponseTimer } from '../../../src/app/game/timer';
import {
  adventureFor,
  dayBaseline,
  featuredFriend,
  findFriend,
  findLevel,
  findRegion,
  gameDay,
  growthOf,
  resultsNext,
} from '../../../src/app/game/view';
import { REGION_IDS } from '../../../src/app/design/palette';
import { MAX_ELAPSED_MS } from '../../../src/rules/contract';
import type { GameView, NextStep, RunView } from '../../../src/rules/contract';
import { friend, lagoonView, problemRoundView, region } from './game-views';

const RUN: RunView = {
  level: 'lagoon-1',
  next: 1,
  activities: [
    { index: 0, kind: 'pearl-necklace', done: true },
    { index: 1, kind: 'fishing-nets', done: false },
    { index: 2, kind: 'feeding', done: false },
  ],
  result: null,
};

function withNext(next: NextStep, patch: Partial<GameView> = {}): GameView {
  const view = lagoonView(patch);
  return { ...view, hub: { ...view.hub, next } };
}

describe('finding things in the view', () => {
  it('finds regions, levels with their region, and friends', () => {
    const view = lagoonView();
    expect(findRegion(view, 'sunny-lagoon')?.titleKey).toBe('region.sunny-lagoon.title');
    expect(findRegion(view, 'coral-reef')).toBeUndefined();
    expect(findLevel(view, 'lagoon-2')).toMatchObject({
      region: { id: 'sunny-lagoon' },
      level: { id: 'lagoon-2', order: 2 },
    });
    expect(findLevel(view, 'nowhere')).toBeUndefined();
    expect(findFriend(view, 'krab-tvrdak')?.stage).toBe('egg');
  });

  it('features the first friend while it is there, else the first in the list', () => {
    const friends = [friend('meduzka-mekulka'), friend('krab-tvrdak')];
    expect(featuredFriend(lagoonView({ friends }))?.id).toBe('krab-tvrdak');
    const none = lagoonView({
      friends,
      onboarding: { firstFriend: null, choices: [], placement: 'pending' },
    });
    expect(featuredFriend(none)?.id).toBe('meduzka-mekulka');
    expect(featuredFriend(lagoonView({ friends: [] }))).toBeUndefined();
  });

  it('measures growth from the rules’ counts, never past the need, and none when crowned', () => {
    expect(growthOf(friend('krab-tvrdak'))).toEqual({
      next: 'baby',
      have: 0,
      need: 10,
      monster: null,
    });
    const grown = friend('krab-tvrdak', {
      stage: 'baby',
      next: {
        stage: 'grown',
        share: 0.8,
        mastery: 'bronze',
        have: 30,
        need: 26,
        monster: 'murena-mumla',
      },
    });
    expect(growthOf(grown)).toEqual({
      next: 'grown',
      have: 26,
      need: 26,
      monster: 'murena-mumla',
    });
    expect(growthOf(friend('krab-tvrdak', { stage: 'crowned', next: null }))).toBeNull();
  });
});

describe('Dnešní výprava', () => {
  it('starts the suggested level, or goes on at the next activity of the one under way', () => {
    expect(adventureFor(withNext({ kind: 'level', level: 'lagoon-1' }))).toEqual({
      kind: 'action',
      action: { type: 'startLevel', level: 'lagoon-1' },
    });
    expect(adventureFor(withNext({ kind: 'level', level: 'lagoon-1' }, { run: RUN }))).toEqual({
      kind: 'action',
      action: { type: 'startActivity', activity: { kind: 'level', index: 1 } },
    });
    // A finished run, or another level's, starts over.
    const finished = { ...RUN, result: { stars: 2, accuracy: 0.8, firstTime: true } };
    expect(adventureFor(withNext({ kind: 'level', level: 'lagoon-1' }, { run: finished }))).toEqual(
      { kind: 'action', action: { type: 'startLevel', level: 'lagoon-1' } },
    );
    expect(adventureFor(withNext({ kind: 'level', level: 'lagoon-2' }, { run: RUN }))).toEqual({
      kind: 'action',
      action: { type: 'startLevel', level: 'lagoon-2' },
    });
  });

  it('replays one activity of a level, a board for fun or a low day’s review', () => {
    expect(
      adventureFor(withNext({ kind: 'minigame', level: 'lagoon-1', activity: 2 }, { run: RUN })),
    ).toEqual({
      kind: 'action',
      action: { type: 'startLevel', level: 'lagoon-1', activity: 2 },
    });
  });

  it('sends the hub-only activities, opens the chest, or goes to the story, egg or map', () => {
    expect(adventureFor(withNext({ kind: 'placement' }))).toEqual({
      kind: 'action',
      action: { type: 'startActivity', activity: { kind: 'placement' } },
    });
    expect(adventureFor(withNext({ kind: 'snack', friend: 'krab-tvrdak' }))).toEqual({
      kind: 'action',
      action: { type: 'startActivity', activity: { kind: 'snack', friend: 'krab-tvrdak' } },
    });
    expect(adventureFor(withNext({ kind: 'chest' }))).toEqual({
      kind: 'action',
      action: { type: 'openChest' },
    });
    expect(adventureFor(withNext({ kind: 'story', beat: 'prologue' }))).toEqual({
      kind: 'story',
    });
    expect(adventureFor(withNext({ kind: 'first-friend' }))).toEqual({ kind: 'first-friend' });
    expect(adventureFor(withNext({ kind: 'free-play' }))).toEqual({ kind: 'map' });
  });
});

describe('after a round', () => {
  const complete = (patch: Parameters<typeof problemRoundView>[1] = {}) =>
    problemRoundView(null, { status: 'complete', endReason: 'finished', ...patch });

  it('goes on to the level’s next activity while the run is not over', () => {
    expect(resultsNext(lagoonView({ round: complete(), run: RUN }))).toEqual({
      kind: 'activity',
      index: 1,
    });
  });

  it('goes home after the last activity, a quit, a rest, or a round outside a level', () => {
    const done = { kind: 'done' };
    expect(resultsNext(lagoonView({ round: complete(), run: { ...RUN, next: 3 } }))).toEqual(done);
    const finished = { ...RUN, result: { stars: 3, accuracy: 1, firstTime: true } };
    expect(resultsNext(lagoonView({ round: complete(), run: finished }))).toEqual(done);
    expect(resultsNext(lagoonView({ round: complete({ endReason: 'quit' }), run: RUN }))).toEqual(
      done,
    );
    expect(
      resultsNext(lagoonView({ round: complete({ endReason: 'time-limit' }), run: RUN })),
    ).toEqual(done);
    expect(
      resultsNext(
        lagoonView({ round: complete({ source: { kind: 'snack', friend: null } }), run: RUN }),
      ),
    ).toEqual(done);
    expect(resultsNext(lagoonView({ round: problemRoundView(null), run: RUN }))).toEqual(done);
    expect(resultsNext(lagoonView({ round: null, run: RUN }))).toEqual(done);
  });
});

describe('the day', () => {
  it('never goes back a day: a save from a clock that ran ahead keeps its own', () => {
    expect(gameDay({ day: null }, '2026-11-02')).toBe('2026-11-02');
    expect(gameDay({ day: '2026-11-01' }, '2026-11-02')).toBe('2026-11-02');
    expect(gameDay({ day: '2026-11-05' }, '2026-11-02')).toBe('2026-11-05');
  });

  it('notes each friend’s stage at the day’s start, for the diary', () => {
    const view = lagoonView({
      friends: [friend('krab-tvrdak', { stage: 'baby' }), friend('zelva-obojka')],
    });
    expect(dayBaseline(view)).toEqual({
      lit: [],
      stages: { 'krab-tvrdak': 'baby', 'zelva-obojka': 'egg' },
    });
  });
});

describe('the painted maps', () => {
  it('has a spot on open water for every region of the sea, inside the picture', () => {
    expect(Object.keys(REGION_SPOTS).sort()).toEqual([...REGION_IDS].sort());
    for (const spot of Object.values(REGION_SPOTS)) {
      expect(spot.x).toBeGreaterThanOrEqual(80);
      expect(spot.x).toBeLessThanOrEqual(920);
      expect(spot.y).toBeGreaterThanOrEqual(80);
      expect(spot.y).toBeLessThanOrEqual(920);
    }
  });

  it('spreads a region the table does not know by its order on its map', () => {
    expect(regionSpot('sunny-lagoon', 5, 6)).toEqual(REGION_SPOTS['sunny-lagoon']);
    expect(regionSpot('new-sea', 0, 1)).toEqual({ x: 500, y: 500 });
    expect(regionSpot('new-sea', 0, 3)).toEqual({ x: 120, y: 820 });
    expect(regionSpot('new-sea', 2, 3)).toEqual({ x: 880, y: 180 });
  });

  it('lays level nodes in a zigzag from the bottom left up to the top right', () => {
    const spots = levelSpots(7);
    expect(spots).toHaveLength(7);
    expect(spots[0]!.x).toBeLessThan(spots[6]!.x);
    expect(spots[0]!.y).toBeGreaterThan(spots[6]!.y);
    for (let index = 1; index < spots.length; index++) {
      expect(spots[index]!.x).toBeGreaterThan(spots[index - 1]!.x);
      // Neighbours zig and zag, so their buttons never stack.
      expect(Math.abs(spots[index]!.y - spots[index - 1]!.y)).toBeGreaterThan(40);
    }
    for (const spot of [...spots, ...levelSpots(1), ...levelSpots(12)]) {
      expect(spot.x).toBeGreaterThanOrEqual(100);
      expect(spot.x).toBeLessThanOrEqual(900);
      expect(spot.y).toBeGreaterThanOrEqual(100);
      expect(spot.y).toBeLessThanOrEqual(900);
    }
    expect(levelSpots(0)).toEqual([]);
  });

  it('counts the regions on a map', () => {
    const regions = [region('a'), region('b', { map: 'deep' }), region('c')];
    expect(mapOf(regions, 'shallows')).toBe(2);
    expect(mapOf(regions, 'deep')).toBe(1);
  });
});

describe('time on the child’s side', () => {
  function clock() {
    let now = 1000;
    return { now: () => now, advance: (ms: number) => (now += ms) };
  }

  it('times an answer without the time paused, capped by the contract', () => {
    const time = clock();
    const timer = createResponseTimer(time.now);
    timer.start();
    time.advance(1500);
    timer.pause();
    time.advance(60_000);
    expect(timer.elapsed()).toBe(1500);
    timer.resume();
    time.advance(500);
    expect(timer.elapsed()).toBe(2000);
    timer.start();
    expect(timer.elapsed()).toBe(0);
    time.advance(MAX_ELAPSED_MS * 2);
    expect(timer.elapsed()).toBe(MAX_ELAPSED_MS);
  });

  it('starts a problem shown while paused at zero, counting from the resume', () => {
    const time = clock();
    const timer = createResponseTimer(time.now);
    timer.pause();
    time.advance(5000);
    timer.start();
    time.advance(5000);
    expect(timer.elapsed()).toBe(0);
    timer.resume();
    time.advance(700);
    expect(timer.elapsed()).toBe(700);
  });

  it('counts play time without hidden or paused time', () => {
    const time = clock();
    const play = createPlayClock(time.now);
    time.advance(2000);
    play.pause();
    play.pause();
    time.advance(10_000);
    expect(play.elapsed()).toBe(2000);
    play.resume();
    play.resume();
    time.advance(3000);
    expect(play.elapsed()).toBe(5000);
  });
});
