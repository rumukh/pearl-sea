/**
 * The view projection: everything the shell renders, computed from state and content on every
 * commit. Pure and deterministic; no text, only catalog keys, structured problems and the
 * lexicon's Czech words.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { projectMinigame } from '@aegis/narrative';
import type { MinigameDefinition, MinigameState } from '@aegis/narrative';
import {
  FIRST_FRIEND_CHOICES,
  FRIEND_STAGES,
  MASTERY_LEVELS,
  STRANDS,
  isMinigameKind,
  isoDay,
  problemSteps,
  weekday,
} from './contract';
import type {
  AlbumView,
  DailyView,
  Feedback,
  FriendExpression,
  FriendView,
  GalleryView,
  GameView,
  GrownUpsView,
  HubView,
  Level,
  MarketView,
  MasteryLevel,
  NextStep,
  Problem,
  ProblemRound,
  RoundView,
  RunView,
  Screen,
  ShellSkill,
  ShellView,
} from './contract';
import { itemIndex, itemSkills, itemsOf, perPack, sortText } from './learning/index-cache';
import { itemLabel } from './learning/item-info';
import { MASTERY_RANK, atLeast, isDue, masteryLevel, polishedToday } from './learning/items';
import { lowToday, starving } from './learning/selection';
import { MINIGAMES, boardView } from './minigames/boards';
import { completedGrades } from './progression/grades';
import {
  anyStarving,
  dueItems,
  friendSet,
  hungryFriends,
  servableItems,
  shareAt,
  snackItems,
} from './progression/friends';
import { placementFor } from './progression/ladder';
import {
  isComplete,
  levelStatus,
  levelsInMapOrder,
  nextLevel,
  percentOf,
  regionOpen,
} from './progression/levels';
import { JOKE_EVERY, battleMonster, currentArmCount, jokeIndex } from './progression/problems';
import { raceProblem } from './progression/race';
import { canPlay } from './progression/rounds';
import { snackProblem } from './progression/snack';
import { availableCosmetics } from './economy/rewards';
import { storyView } from './story/beats';
import type { Data, Index, Read, ReadState } from './types';

function screenOf(state: ReadState): Screen {
  if (state.story.pending !== null) return 'story';
  if (state.round?.status === 'active') return 'round';
  if (state.round?.status === 'complete') return 'results';
  return 'hub';
}

/** The eggs Osmička offers for the first friend: the lagoon's three, as the content has them. */
export function firstFriendChoices(data: Data): string[] {
  return FIRST_FRIEND_CHOICES.filter((id) => data.friends.some((f) => f.id === id));
}

/**
 * The daily adventure's next step (design §4.2): a pending story beat, the first friend's choice,
 * the placement check while it is pending (a 4th grader's), Svačinka at the start of the day when
 * there is something to snack on (a hungry friend, or due items in Osmička's basket), the next
 * glowing level until one is done today, then once a day a board replay (for variety after a
 * level, or because a finished board's items wait: due, or never met), the chest once the goal is
 * reached, then the review guarantee: Svačinka while a known item it can serve is starving, a
 * board while a known item only boards train is starving (at most `STARVING_BOARDS` boards a
 * day), and more new levels unless today's success is below 70 % (`lowToday`; a level already
 * under way is always continued). Below it the adventure reviews instead: Svačinka when there is
 * something to snack on, else a replay of an activity of the last finished levels. Then free
 * play. Pacing only chooses the suggestion: every open level stays playable from the map.
 */
function nextStep(state: ReadState, data: Data, snack: boolean, index: Index): NextStep {
  if (state.story.pending !== null) return { kind: 'story', beat: state.story.pending };
  if (state.onboarding.firstFriend === null && firstFriendChoices(data).length > 0) {
    return { kind: 'first-friend' };
  }
  if (
    state.onboarding.placement === 'pending' &&
    placementFor(data, state.settings.grade).steps.length > 0
  ) {
    return { kind: 'placement' };
  }
  const daily = state.daily !== null && state.daily.day === state.day ? state.daily : null;
  if (snack && daily !== null && daily.answers === 0) return { kind: 'snack', friend: null };
  const levelsToday = daily?.levels ?? 0;
  const level = nextLevel(state, data);
  if (level !== null && levelsToday === 0) return { kind: 'level', level };
  if (daily !== null && daily.minigames === 0) {
    // Once a day a board: for variety after a level, and on any day when a finished board's items
    // wait for it (items only boards train are reviewed and first met so, design §6.5).
    const replay = minigameReplay(state, data, index);
    if (replay !== null && (levelsToday > 0 || replay.score > 0)) {
      return { kind: 'minigame', level: replay.level, activity: replay.activity };
    }
  }
  if (daily?.chest === 'ready') return { kind: 'chest' };
  const underway = level !== null && state.run?.level === level;
  // The review guarantee: known items four days past their review are fed before anything new.
  if (!underway && snack && anyStarving(state, data)) return { kind: 'snack', friend: null };
  if (!underway && (daily?.minigames ?? 0) < STARVING_BOARDS) {
    const starved = starvingReplay(state, data, index);
    if (starved !== null) {
      return { kind: 'minigame', level: starved.level, activity: starved.activity };
    }
  }
  if (level === null) return { kind: 'free-play' };
  if (underway || !lowToday(state)) return { kind: 'level', level };
  if (snack) return { kind: 'snack', friend: null };
  const review = reviewReplay(state, data, index) ?? minigameReplay(state, data, index);
  return review !== null
    ? { kind: 'minigame', level: review.level, activity: review.activity }
    : { kind: 'free-play' };
}

/**
 * Boards a day at most that the review guarantee asks for (design §6.3): enough to feed the items
 * only boards train once they starve, and a bound if a board cannot thread one of them.
 */
export const STARVING_BOARDS = 3;

/** The finished levels, the furthest first, whose activities a low day's review rotates through. */
export const REVIEW_LEVELS = 3;

/**
 * A low day's review (pacing): one activity of the last `REVIEW_LEVELS` finished levels, never a
 * battle. Their problem activities, or their minigames too while there are fewer than two. The
 * choice rotates with the rounds started (`roundCounter`), so a review that did not lift today's
 * success is followed by a different one.
 */
export function reviewReplay(
  state: ReadState,
  data: Data,
  index: Index,
): { level: string; activity: number } | null {
  const levels = levelsInMapOrder(data)
    .filter((level) => isComplete(state, level.id))
    .reverse()
    .slice(0, REVIEW_LEVELS);
  const activities = (minigames: boolean) =>
    levels.flatMap((level) =>
      level.activities
        .map((activity, i) => ({ activity, i }))
        .filter(
          ({ activity, i }) =>
            activity.kind !== 'battle' &&
            isMinigameKind(activity.kind) === minigames &&
            canPlay(data, level, i, index, state),
        )
        .map(({ i }) => ({ level: level.id, activity: i })),
    );
  let candidates = activities(false);
  if (candidates.length < 2) candidates = [...candidates, ...activities(true)];
  return candidates.length === 0 ? null : candidates[state.roundCounter % candidates.length]!;
}

/**
 * The finished board activity with the highest score (the furthest level first on a tie), with
 * its score; `null` when no finished level has a playable board.
 */
function bestBoard(
  state: ReadState,
  data: Data,
  index: Index,
  score: (items: readonly string[]) => number,
): { level: string; activity: number; score: number } | null {
  const completed = levelsInMapOrder(data)
    .filter((level) => isComplete(state, level.id))
    .reverse();
  let best: { level: string; activity: number; score: number } | null = null;
  for (const level of completed) {
    level.activities.forEach((activity, i) => {
      if (!isMinigameKind(activity.kind) || !canPlay(data, level, i, index, state)) return;
      const value = score(itemsOf(activity.skills, index));
      if (best === null || value > best.score)
        best = { level: level.id, activity: i, score: value };
    });
  }
  return best as { level: string; activity: number; score: number } | null;
}

/**
 * A minigame activity of a completed level to replay: the one with the most items waiting for a
 * board, due ones and board-only ones never answered (the necklace's and Pexeso's items are
 * reviewed and first met so; Svačinka serves the others), else the furthest level's.
 */
function minigameReplay(
  state: ReadState,
  data: Data,
  index: Index,
): { level: string; activity: number; score: number } | null {
  const servable = servableItems(data);
  return bestBoard(
    state,
    data,
    index,
    (items) =>
      dueItems(state, items) +
      items.filter((item) => !servable.has(item) && state.items[item] === undefined).length,
  );
}

/** The board to replay for starving items only boards train (the review guarantee), or `null`. */
function starvingReplay(
  state: ReadState,
  data: Data,
  index: Index,
): { level: string; activity: number } | null {
  const day = state.day ?? 0;
  const servable = servableItems(data);
  const best = bestBoard(
    state,
    data,
    index,
    (items) =>
      items.filter((item) => !servable.has(item) && starving(state.items[item], day)).length,
  );
  return best !== null && best.score > 0 ? best : null;
}

function hubView(state: ReadState, data: Data, index: Index): HubView {
  const glowing = nextLevel(state, data);
  const hungry = hungryFriends(state, data);
  return {
    regions: [...data.regions]
      .sort((a, b) => a.order - b.order)
      .map((region) => {
        const monster =
          region.monster === null ? undefined : data.monsters.find((m) => m.id === region.monster);
        return {
          id: region.id,
          titleKey: region.titleKey,
          order: region.order,
          map: region.map,
          grade: region.grade,
          unlocked: regionOpen(state, data, region.id),
          monster: monster
            ? {
                id: monster.id,
                nameKey: monster.nameKey,
                mood: monster.mood,
                freed: state.monsters[monster.id] !== undefined,
                arms: monster.arms ?? 1,
              }
            : null,
          levels: data.levels
            .filter((level) => level.region === region.id)
            .sort((a, b) => a.order - b.order)
            .map((level) => ({
              id: level.id,
              titleKey: level.titleKey,
              order: level.order,
              kind: level.kind,
              status: levelStatus(state, data, level),
              stars: state.levels[level.id]?.stars ?? 0,
              placed: state.levels[level.id]?.placed ?? false,
              glowing: level.id === glowing,
            })),
        };
      }),
    next: nextStep(state, data, snackProblem(state, data, index, null) === null, index),
    hungry,
    race: { available: raceProblem(state, data) === null, best: state.race.best },
    certificates: completedGrades(state, data),
  };
}

function runView(state: ReadState, data: Data): RunView | null {
  const run = state.run;
  const level = run === null ? undefined : data.levels.find((l) => l.id === run.level);
  if (!run || !level) return null;
  const done = run.next >= level.activities.length;
  const progress = state.levels[level.id];
  return {
    level: run.level,
    next: run.next,
    activities: level.activities.map((activity, index) => ({
      index,
      kind: activity.kind,
      done: run.results.some((r) => r.activity === index && r.completed),
    })),
    result:
      done && progress
        ? {
            stars: progress.stars,
            accuracy: progress.bestAccuracy,
            firstTime: progress.plays === 1,
          }
        : null,
  };
}

/** Each friend's mastery set, for "who is fed": the owned friend that eats the item. */
function roundFriend(state: ReadState, data: Data, item: string | null): string | null {
  const owned = data.friends.filter((f) => state.friends[f.id] !== undefined);
  if (owned.length === 0) return null;
  const feeding = item === null ? undefined : owned.find((f) => friendSet(data, f).includes(item));
  return (feeding ?? owned[0]!).id;
}

/** The joke a battle shows now (`BattleView.jokeKey`), as `monster.joked` told it. */
function jokeKey(data: Data, round: DeepReadonly<ProblemRound>): string | null {
  const battle = round.battle;
  const monster = battleMonster(data, round);
  if (battle === null || monster === undefined || monster.jokes.length === 0) return null;
  const jokes = monster.jokes;
  if (round.status === 'complete') {
    // Every right answer washed until the ink was off: the washed count before the cap's flourish.
    const washed = Math.min(round.correct, battle.target);
    return round.endReason === 'finished'
      ? jokes[jokeIndex(battle.target, washed, true) % jokes.length]!
      : null;
  }
  if (round.answered === 0) return jokes[0]!;
  if (
    round.feedback?.correct === true &&
    battle.washed > 0 &&
    battle.washed % JOKE_EVERY === 0 &&
    battle.washed < battle.target
  ) {
    return jokes[jokeIndex(battle.target, battle.washed, false) % jokes.length]!;
  }
  return null;
}

function roundView(state: ReadState, data: Data): RoundView | null {
  const round = state.round;
  if (round === null) return null;
  if (round.type === 'minigame') {
    const projected = projectMinigame(
      round.definition as MinigameDefinition,
      round.state as MinigameState,
      MINIGAMES,
    );
    return {
      id: round.id,
      type: 'minigame',
      activity: round.activity,
      source: round.source,
      status: round.status,
      endReason: round.endReason,
      board: round.completed,
      boards: round.boards,
      minigame: {
        definition: round.definition.id,
        status: projected.status,
        revision: projected.revision,
        view: projected.view,
      },
      current: boardView(data, round.definition, round.state, projected.view),
      coins: round.coins,
    };
  }
  const item = round.current?.item ?? round.feedback?.item ?? null;
  const friend = roundFriend(state, data, item);
  const ladderSteps = placementFor(data, state.settings.grade).steps.length;
  const sleepy = state.daily !== null && state.daily.correct >= state.daily.goal;
  const egg = friend !== null && state.friends[friend]?.stage === 'egg';
  const expression: FriendExpression = egg
    ? 'idle'
    : round.feedback === null
      ? sleepy
        ? 'sleepy'
        : 'happy'
      : round.feedback.correct
        ? round.streak > 0 && round.streak % data.balance.coins.streakEvery === 0
          ? 'proud'
          : 'eating'
        : 'curious';
  const battle = round.battle;
  const monster = battleMonster(data, round);
  const current = round.current;
  return {
    id: round.id,
    type: 'problems',
    activity: round.activity,
    source: round.source,
    input: round.input,
    status: round.status,
    endReason: round.endReason,
    progress: {
      // Finished problems: the unit of `target` (a problem has one or more answer steps).
      answered: round.asked - (current !== null ? 1 : 0),
      target: round.target,
      correct: round.correct,
      streak: round.streak,
    },
    problem:
      current === null
        ? null
        : {
            index: current.index,
            item: current.item,
            problem: current.problem as Problem,
            input: current.input,
            step: current.step,
            steps: problemSteps(current.problem as Problem),
            reask: current.reask,
            hinted: current.hinted,
            teach: current.teach,
            ambush: current.ambush,
          },
    feedback: round.feedback as Feedback | null,
    coins: round.coins,
    friend: friend === null ? null : { id: friend, expression },
    battle:
      battle === null || monster === undefined
        ? null
        : {
            monster: battle.monster,
            nameKey: monster.nameKey,
            washed: battle.washed,
            target: battle.target,
            arms: battle.arms,
            armsWashed: currentArmCount(battle),
            jokeKey: jokeKey(data, round),
            splashes: battle.splashes,
          },
    placement:
      round.placement === null
        ? null
        : {
            step: Math.min(round.placement.step, ladderSteps),
            steps: ladderSteps,
            placed: [...round.placement.placed],
          },
  };
}

function friendViews(state: ReadState, data: Data): FriendView[] {
  const sleepy = state.daily !== null && state.daily.correct >= state.daily.goal;
  return data.friends
    .filter((friend) => state.friends[friend.id] !== undefined)
    .map((friend) => {
      const owned = state.friends[friend.id]!;
      const items = friendSet(data, friend);
      const share = (level: 'seen' | 'bronze' | 'silver' | 'gold') =>
        shareAt(state, data, items, level);
      const due = dueItems(state, snackItems(friend, data));
      const stageIndex = FRIEND_STAGES.indexOf(owned.stage);
      const rule = data.balance.growth[stageIndex];
      const hungry = owned.stage !== 'egg' && due >= data.balance.hungry.minDue;
      return {
        id: friend.id,
        nameKey: friend.nameKey,
        mnemonicKey: friend.mnemonicKey,
        region: friend.region,
        stage: owned.stage,
        expression:
          owned.stage === 'egg' ? 'idle' : sleepy ? 'sleepy' : hungry ? 'curious' : 'happy',
        mastery: {
          seen: share('seen'),
          bronze: share('bronze'),
          silver: share('silver'),
          gold: share('gold'),
          items: items.length,
        },
        hungry,
        dueItems: due,
        outfit: { ...owned.outfit },
        next: rule
          ? {
              stage: rule.stage,
              share: rule.share,
              mastery: rule.mastery,
              have: items.filter((item) => atLeast(state.items[item], rule.mastery, data.balance))
                .length,
              // The share rounded up: shareAt rounds down, so this many reach `share` percent.
              need:
                (rule.share * items.length + 99 - ((rule.share * items.length + 99) % 100)) / 100,
              monster: rule.monster ? friend.monster : null,
            }
          : null,
      };
    });
}

/** Each item's first skill (content order): the pearl bed it lies in. */
const firstSkill: (data: Data) => ReadonlyMap<string, string> = perPack((data) => {
  const first = new Map<string, string>();
  for (const [item, skills] of itemSkills(data)) first.set(item, skills[0]!);
  return first;
});

/** The skills of each region's levels. */
const regionSkills: (data: Data) => ReadonlyMap<string, readonly string[]> = perPack((data) => {
  const skills = new Map<string, string[]>();
  for (const level of data.levels) {
    const list = skills.get(level.region) ?? [];
    for (const activity of level.activities) {
      for (const skill of activity.skills) if (!list.includes(skill)) list.push(skill);
    }
    skills.set(level.region, list);
  }
  return skills;
});

function emptyCounts(): Record<MasteryLevel, number> {
  return Object.fromEntries(MASTERY_LEVELS.map((level) => [level, 0])) as Record<
    MasteryLevel,
    number
  >;
}

/**
 * The Great Shell (design §6.5): a pearl for each item of an open region, in the bed of its first
 * skill's strand, counted by mastery level, with the known items due again as dull pearls.
 */
function shellView(state: ReadState, data: Data, index: Index): ShellView {
  const day = state.day ?? 0;
  const open = new Set<string>();
  for (const region of data.regions) {
    if (!regionOpen(state, data, region.id)) continue;
    for (const skill of regionSkills(data).get(region.id) ?? []) open.add(skill);
  }
  const first = firstSkill(data);
  const counts = emptyCounts();
  const strands = STRANDS.map((strand) => ({ strand, skills: [] as ShellSkill[] }));
  for (const skill of data.skills) {
    if (!open.has(skill.id)) continue;
    const entry: ShellSkill = {
      skill: skill.id,
      titleKey: skill.titleKey,
      items: 0,
      counts: emptyCounts(),
      dull: 0,
    };
    for (const item of index.get(skill.id) ?? []) {
      if (first.get(item) !== skill.id) continue;
      const record = state.items[item];
      const level = masteryLevel(record, data.balance);
      entry.items += 1;
      entry.counts[level] += 1;
      counts[level] += 1;
      if (level !== 'cloudy' && isDue(record, day)) entry.dull += 1;
    }
    if (entry.items > 0) strands.find((s) => s.strand === skill.strand)!.skills.push(entry);
  }
  const recent = Object.entries(state.items)
    .map(([item, record]) => ({ item, level: polishedToday(record, day, data.balance) }))
    .filter((entry): entry is { item: string; level: MasteryLevel } => entry.level !== null)
    .sort(
      (a, b) =>
        MASTERY_RANK.indexOf(b.level) - MASTERY_RANK.indexOf(a.level) || sortText(a.item, b.item),
    )
    .slice(0, 12);
  return { strands, counts, recent };
}

function galleryView(state: ReadState, data: Data): GalleryView {
  const order = new Map(data.regions.map((r) => [r.id, r.order]));
  return {
    monsters: [...data.monsters]
      .sort((a, b) => (order.get(a.region) ?? 0) - (order.get(b.region) ?? 0))
      .map((monster) => {
        const freed = state.monsters[monster.id];
        return {
          id: monster.id,
          nameKey: monster.nameKey,
          freed: freed !== undefined,
          day: freed ? isoDay(freed.freedDay) : null,
        };
      }),
  };
}

function marketView(state: ReadState, data: Data): MarketView {
  const available = availableCosmetics(state, data);
  return {
    items: data.cosmetics.map((c) => ({
      id: c.id,
      slot: c.slot,
      assetId: c.assetId,
      nameKey: c.nameKey,
      price: c.price,
      owned: state.cosmetics.owned.includes(c.id),
      affordable: state.coins >= c.price,
      available: available.includes(c.id),
    })),
  };
}

function albumView(state: ReadState, data: Data): AlbumView {
  const pages = [...data.regions]
    .sort((a, b) => a.order - b.order)
    .map((region) => ({
      region: region.id,
      stickers: data.stickers
        .filter((s) => s.page === region.id)
        .map((s) => ({
          id: s.id,
          nameKey: s.nameKey,
          icon: s.icon,
          color: s.color,
          frame: s.frame,
          earned: state.stickers[s.id] !== undefined,
          day: state.stickers[s.id] ? isoDay(state.stickers[s.id]!.day) : null,
        })),
    }));
  return { pages, earned: Object.keys(state.stickers).length, total: data.stickers.length };
}

/** Words whose pearls reached bronze today, for the diary card (each word once). */
function learnedToday(state: ReadState, data: Data): { word: string; text: string }[] {
  const day = state.day ?? 0;
  const learned: { word: string; text: string }[] = [];
  for (const item of Object.keys(state.items).sort(sortText)) {
    if (polishedToday(state.items[item], day, data.balance) !== 'bronze') continue;
    const label = itemLabel(data, item);
    if (label.word === null || learned.some((entry) => entry.word === label.word)) continue;
    learned.push({ word: label.word, text: label.text });
  }
  return learned;
}

function dailyView(state: ReadState, data: Data): DailyView | null {
  const daily = state.daily;
  if (daily === null) return null;
  const monday = daily.day - weekday(daily.day);
  const practiced = new Set(state.history.map((record) => record.day));
  return {
    day: isoDay(daily.day),
    goal: daily.goal,
    correct: daily.correct,
    answers: daily.answers,
    reached: daily.correct >= daily.goal,
    quests: daily.quests.map((quest) => {
      const template = data.quests.find((q) => q.id === quest.template);
      return {
        id: quest.id,
        template: quest.template,
        titleKey: template?.titleKey ?? quest.template,
        goal: template?.goal ?? 'correct-answers',
        target: template?.target ?? 1,
        progress: quest.progress,
        done: quest.progress >= (template?.target ?? 1),
        claimed: quest.claimed,
        coins: template?.coins ?? 0,
      };
    }),
    chest: daily.chest,
    week: Array.from({ length: 7 }, (_, offset) => practiced.has(monday + offset)),
    sleepy: daily.correct >= daily.goal,
    learned: learnedToday(state, data),
  };
}

function accuracyOf(state: ReadState, items: readonly string[]): number {
  let seen = 0;
  let correct = 0;
  for (const item of items) {
    const record = state.items[item];
    if (!record) continue;
    seen += record.seen;
    correct += record.correct;
  }
  return percentOf(correct, seen);
}

/** The items of the levels that teach or review each objective. */
const objectiveItems: (data: Data) => ReadonlyMap<string, readonly string[]> = perPack((data) => {
  const index = itemIndex(data);
  const items = new Map<string, string[]>();
  for (const objective of data.objectives) {
    const skills = data.levels
      .filter((level: DeepReadonly<Level>) => level.objectives.includes(objective.id))
      .flatMap((level) => level.activities.flatMap((activity) => activity.skills));
    items.set(objective.id, itemsOf([...new Set(skills)], index));
  }
  return items;
});

function grownUpsView(state: ReadState, data: Data, index: Index): GrownUpsView {
  const mastered = (items: readonly string[]) =>
    items.filter((item) => atLeast(state.items[item], 'silver', data.balance)).length;
  const objectives = data.objectives.map((objective) => {
    const items = objectiveItems(data).get(objective.id) ?? [];
    return {
      objective: objective.id,
      titleKey: objective.titleKey,
      grade: objective.grade,
      accuracy: accuracyOf(state, items),
      mastered: mastered(items),
      items: items.length,
    };
  });
  const skills = data.skills.map((skill) => {
    const items = index.get(skill.id) ?? [];
    return {
      skill: skill.id,
      titleKey: skill.titleKey,
      accuracy: accuracyOf(state, items),
      mastered: mastered(items),
      items: items.length,
    };
  });
  const hardest = Object.entries(state.items)
    .filter(([, record]) => record.seen > 0)
    .map(([item, record]) => ({
      item,
      accuracy: percentOf(record.correct, record.seen),
      box: record.box,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || a.box - b.box || sortText(a.item, b.item))
    .slice(0, 10)
    .map((entry) => ({ ...entry, ...itemLabel(data, entry.item) }))
    .map(({ item, word, text, accuracy, box }) => ({ item, word, text, accuracy, box }));
  return {
    objectives,
    skills,
    hardest,
    trend: state.history.slice(-60).map((record) => ({
      day: isoDay(record.day),
      answers: record.answers,
      correct: record.correct,
      fast: record.fast,
    })),
    daysPracticed: state.daysPracticed,
    answers: Object.values(state.items).reduce((sum, record) => sum + record.seen, 0),
  };
}

export function projectView(read: Read): GameView {
  const state = read.state;
  const data = read.content.data;
  const index = itemIndex(data);
  return {
    revision: read.revision,
    turn: read.turn,
    day: state.day === null ? null : isoDay(state.day),
    screen: screenOf(state),
    coins: state.coins,
    settings: {
      dailyGoal: state.settings.dailyGoal,
      race: state.settings.race,
      unlockAhead: [...state.settings.unlockAhead],
      grade: state.settings.grade,
    },
    onboarding: {
      firstFriend: state.onboarding.firstFriend,
      choices: state.onboarding.firstFriend === null ? firstFriendChoices(data) : [],
      placement: state.onboarding.placement,
    },
    story: storyView(state, data),
    hub: hubView(state, data, index),
    run: runView(state, data),
    round: roundView(state, data),
    friends: friendViews(state, data),
    shell: shellView(state, data, index),
    gallery: galleryView(state, data),
    grotto: { spots: [...state.grotto] },
    market: marketView(state, data),
    album: albumView(state, data),
    daily: dailyView(state, data),
    grownUps: grownUpsView(state, data, index),
  };
}
