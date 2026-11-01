/**
 * The Perlové moře runtime adapter: state, actions, content, commands, jobs and view, registered
 * with `@aegis/runtime` (docs/contract.md §11). It implements sessions and days (the daily goal,
 * quests, the treasure chest), story beats, the first friend's egg, level runs of problem rounds
 * and minigame boards, monster battles, the Inkoustíci, the placement check, Svačinka, the race,
 * grading, Leitner moves, the mix, re-ask jobs, coins, eggs, friend growth, stickers, U Mrože,
 * outfits and the grotto, rule settings, state validation and the full view.
 */
import { createRuntimeHost, failure, requireValue, schema, success } from '@aegis/runtime';
import type {
  CheckpointWriter,
  ContentPack,
  JsonValue,
  Outcome,
  RuntimeAdapter,
  RuntimeHost,
} from '@aegis/runtime';
import { restoreCosmetics, restoreMinigame, restoreNarrative } from '@aegis/narrative';
import type { MinigameDefinition, NarrativeGraph } from '@aegis/narrative';
import {
  ACTION_TURNS,
  ADAPTER_ID,
  EVENTS,
  EVENT_PHASES,
  FIRST_FRIEND_CHOICES,
  GROTTO_SPOTS,
  JOB_RULES,
  RANDOM_STREAMS,
  STATE_VERSION,
  contentId,
  contentRegistration,
  dayNumber,
  gameActionSchema,
  gradeStart,
  initialProfileState,
  isoDay,
  itemIdSchema,
  parseItemId,
  profileStateSchema,
} from './contract';
import type { ContentData, GameAction, GameView, ProfileState } from './contract';
import { checkDailyGoal, claimProblem, claimQuest, startDay } from './economy/daily';
import {
  availableCosmetics,
  awardStickers,
  cosmeticCatalog,
  grantEgg,
  grantItem,
  openChest,
} from './economy/rewards';
import { itemIndex } from './learning/index-cache';
import { mergeRetiredItems } from './learning/migrate';
import { MINIGAMES } from './minigames/boards';
import { applyGrowth } from './progression/friends';
import { isComplete, isPlayable } from './progression/levels';
import { applyMinigameMove, moveProblem } from './progression/minigame-rounds';
import { placementFor } from './progression/ladder';
import { placementProblem, startPlacement } from './progression/placement';
import { activeProblemRound, gradeAnswer, roundDone, serveNext } from './progression/problems';
import { raceProblem, startRace } from './progression/race';
import { canPlay, closeRound, completeRound, startRunActivity } from './progression/rounds';
import { snackProblem, startSnack } from './progression/snack';
import { chooseInBeat, findBeat, playBeat, storyChoiceProblem, triggerBeats } from './story/beats';
import { projectView } from './view';
import type { Ctx, Read, ReadState } from './types';

type Reject = {
  readonly ok: false;
  readonly error: {
    code: string;
    messageKey: string;
    diagnostics: readonly { code: string; message: string }[];
  };
};
const reject = (code: string, message: string): Reject => failure(code, message);

function problemOnScreen(state: ReadState): boolean {
  const round = state.round;
  return (
    round !== null && round.type === 'problems' && round.status === 'active' && !!round.current
  );
}

function legality(action: GameAction, read: Read): Reject | null {
  const state: ReadState = read.state;
  const data = read.content.data;
  const round = state.round;
  const activeRound = round !== null && round.status === 'active';
  const pendingBlocking =
    state.story.pending !== null && findBeat(data, state.story.pending)?.skippable === false;
  // Settings need no day: the grown-ups may set them before the first session (the grade so the
  // first-session story knows it; the daily goal and the race for a child who has not played).
  const setting = action.type === 'setSetting';
  if (action.type !== 'startSession' && !setting && state.day === null) {
    return reject('no-session', 'Start a session first.');
  }
  switch (action.type) {
    case 'startSession':
      return dayNumber(action.day) === null ? reject('invalid-day', 'Not a calendar date.') : null;
    case 'chooseFirstFriend':
      if (state.onboarding.firstFriend !== null) {
        return reject('friend-chosen', 'The first friend was already chosen.');
      }
      if (!(FIRST_FRIEND_CHOICES as readonly string[]).includes(action.friend)) {
        return reject('not-a-first-friend', 'Choose one of the three lagoon eggs.');
      }
      return data.friends.some((f) => f.id === action.friend)
        ? null
        : reject('unknown-friend', 'No such friend.');
    case 'startLevel': {
      if (pendingBlocking) return reject('story-pending', 'Finish the story first.');
      if (activeRound) return reject('round-active', 'Finish or leave the current round first.');
      const level = data.levels.find((l) => l.id === action.level);
      if (!level) return reject('unknown-level', 'No such level.');
      if (!isPlayable(state, data, action.level)) {
        return reject('locked-level', 'This level is still locked.');
      }
      if (action.activity === undefined) return null;
      if (!isComplete(state, level.id)) {
        return reject('locked-activity', 'Replay single activities of finished levels.');
      }
      return canPlay(data, level, action.activity, itemIndex(data), state)
        ? null
        : reject('locked-activity', 'This activity cannot be played.');
    }
    case 'startActivity': {
      if (pendingBlocking) return reject('story-pending', 'Finish the story first.');
      if (activeRound) return reject('round-active', 'Finish or leave the current round first.');
      const request = action.activity;
      const index = itemIndex(data);
      if (request.kind === 'placement') {
        const problem = placementProblem(state, data);
        return problem === null ? null : reject('locked-activity', problem);
      }
      if (request.kind === 'snack') {
        const problem = snackProblem(state, data, index, request.friend);
        return problem === null ? null : reject(problem.code, problem.message);
      }
      if (request.kind === 'race') {
        const problem = raceProblem(state, data);
        return problem === null ? null : reject('race-locked', problem);
      }
      const run = state.run;
      const level = run === null ? undefined : data.levels.find((l) => l.id === run.level);
      if (!run || !level) return reject('no-level', 'Start a level first.');
      if (request.index > run.next || request.index >= level.activities.length) {
        return reject('locked-activity', 'Play the activities in order.');
      }
      return canPlay(data, level, request.index, index, state)
        ? null
        : reject('locked-activity', 'This activity cannot be played.');
    }
    case 'answer':
      if (!problemOnScreen(state)) return reject('no-problem', 'There is no problem to answer.');
      return round?.type === 'problems' && round.activity === 'placement'
        ? reject('wrong-action', 'Use placementAnswer.')
        : null;
    case 'placementAnswer':
      if (!problemOnScreen(state)) return reject('no-problem', 'There is no problem to answer.');
      return round?.type === 'problems' && round.activity === 'placement'
        ? null
        : reject('wrong-action', 'Use answer.');
    case 'hint':
      if (!problemOnScreen(state)) return reject('no-problem', 'There is no problem to hint.');
      return round?.type === 'problems' && round.current?.hinted
        ? reject('already-hinted', 'The hint is already shown.')
        : null;
    case 'minigameMove': {
      const problem = moveProblem(state, action.revision, action.move);
      return problem === null ? null : reject(problem.code, problem.message);
    }
    case 'endRound':
      if (round === null) return reject('no-round', 'There is no round.');
      if (action.reason === 'done') {
        return activeRound ? reject('round-active', 'The round is still going.') : null;
      }
      if (!activeRound) return reject('round-finished', 'The round has already finished.');
      // Only the race is timed; any round may end on the grown-ups' time limit or a quit.
      return action.reason === 'time-up' && round.activity !== 'race'
        ? reject('not-timed', 'Only the race ends on time.')
        : null;
    case 'buy': {
      const item = data.cosmetics.find((c) => c.id === action.item);
      if (!item || !availableCosmetics(state, data).includes(item.id)) {
        return reject('unknown-item', 'Not at U Mrože.');
      }
      if (state.cosmetics.owned.includes(item.id)) return reject('owned', 'Already owned.');
      return state.coins >= item.price
        ? null
        : reject('insufficient-coins', 'Not enough coins yet.');
    }
    case 'equip': {
      if (!state.friends[action.friend]) return reject('unknown-friend', 'No such friend.');
      if (action.item === null) return null;
      const item = data.cosmetics.find((c) => c.id === action.item);
      if (!item || !state.cosmetics.owned.includes(item.id)) {
        return reject('not-owned', 'Not owned.');
      }
      return item.slot === action.slot ? null : reject('wrong-slot', 'It does not fit there.');
    }
    case 'decorate': {
      if (action.item === null) return null;
      const item = data.cosmetics.find((c) => c.id === action.item);
      if (!item || !state.cosmetics.owned.includes(item.id)) {
        return reject('not-owned', 'Not owned.');
      }
      return item.slot === 'grotto' ? null : reject('wrong-slot', 'It does not go in the grotto.');
    }
    case 'claimQuest': {
      const problem = claimProblem(state, data, action.quest);
      return problem === null ? null : reject(problem.code, problem.message);
    }
    case 'openChest':
      return state.daily?.chest === 'ready'
        ? null
        : reject('chest-not-ready', 'The treasure chest is not ready yet.');
    case 'storyChoice': {
      const problem = storyChoiceProblem(
        state,
        data,
        action.beat,
        action.node,
        action.revision,
        action.choice,
      );
      return problem === null ? null : reject('story-choice', problem);
    }
    case 'setSetting': {
      const { setting } = action;
      if (setting.key === 'dailyGoal') {
        const { goalMin, goalMax } = data.balance.daily;
        return setting.value >= goalMin && setting.value <= goalMax
          ? null
          : reject('invalid-setting', 'Daily goal out of range.');
      }
      if (setting.key === 'unlockAhead') {
        return setting.value.every((id) => data.regions.some((r) => r.id === id))
          ? null
          : reject('invalid-setting', 'Unknown region.');
      }
      if (setting.key === 'grade') {
        // The placement ladder is per grade, so the grade cannot change in the middle of it.
        if (activeRound && round.type === 'problems' && round.placement !== null) {
          return reject('round-active', 'Finish the placement check first.');
        }
        return gradeStart(data, setting.value) !== null
          ? null
          : reject('invalid-setting', 'The content has no regions for this grade.');
      }
      return null;
    }
  }
}

function startSession(ctx: Ctx, iso: string): void {
  const state = ctx.state;
  const requested = dayNumber(iso)!;
  const day = Math.max(requested, state.day ?? requested);
  const newDay = state.day === null || day > state.day;
  state.day = day;
  state.firstDay ??= day;
  state.sessions += 1;
  if (newDay) {
    state.daysPracticed += 1;
    startDay(ctx, day);
  }
  ctx.emit(EVENTS.sessionStarted, { day: isoDay(day), newDay });
  if (state.sessions === 1) triggerBeats(ctx, (trigger) => trigger.kind === 'first-session');
  awardStickers(ctx);
}

/**
 * The safety net: a problem round with no problem on screen has nothing left to serve (its draw
 * came back empty), so it finishes like any finished round, with its results, coins and growth.
 * No round can be left waiting for an answer it cannot ask.
 */
function settleRound(ctx: Ctx): void {
  const round = activeProblemRound(ctx);
  if (round && round.current === null) completeRound(ctx, itemIndex(ctx.content.data), 'finished');
}

/** After an answer: serve the next problem or finish the round; then growth and stickers. */
function afterAnswer(ctx: Ctx): void {
  const index = itemIndex(ctx.content.data);
  const round = activeProblemRound(ctx);
  if (round && round.current === null && !roundDone(ctx.state, ctx.content.data, round)) {
    serveNext(ctx, index);
  }
  settleRound(ctx);
  applyGrowth(ctx, index);
  awardStickers(ctx);
}

function command(
  type: GameAction['type'],
  handlers: {
    start?: (ctx: Ctx, action: GameAction) => void;
    finish?: (ctx: Ctx, action: GameAction) => void;
  },
) {
  const parse = (payload: unknown): GameAction => requireValue(gameActionSchema.parse(payload));
  return {
    id: type,
    payload: gameActionSchema,
    progress: schema.literal(null),
    start: handlers.start
      ? (ctx: Ctx, pending: { payload: unknown }) => handlers.start!(ctx, parse(pending.payload))
      : undefined,
    finish: handlers.finish
      ? (ctx: Ctx, pending: { payload: unknown }) => handlers.finish!(ctx, parse(pending.payload))
      : undefined,
  };
}

const reaskPayload = schema.object({ round: contentId, item: itemIdSchema });

function validateState(read: Read): Outcome<void> {
  const state = read.state;
  const data = read.content.data;
  const problems: string[] = [];
  const known = (list: readonly { id: string }[], id: string) =>
    list.some((entry) => entry.id === id);
  for (const [item, record] of Object.entries(state.items)) {
    if (parseItemId(item) === null) problems.push(`item ${item}`);
    // The effort path's count: both fields or neither, one counted day per right answer at most.
    const days = record.rightDays;
    const counted = record.lastCountedDay;
    if (
      (days === undefined) !== (counted === undefined) ||
      (days !== undefined && (days < 1 || days > record.correct)) ||
      (counted !== undefined && counted > record.lastDay)
    ) {
      problems.push(`item ${item} right days`);
    }
  }
  for (const level of Object.keys(state.levels)) {
    if (!known(data.levels, level)) problems.push(`level ${level}`);
  }
  for (const monster of Object.keys(state.monsters)) {
    if (!known(data.monsters, monster)) problems.push(`monster ${monster}`);
  }
  for (const sticker of Object.keys(state.stickers)) {
    if (!known(data.stickers, sticker)) problems.push(`sticker ${sticker}`);
  }
  for (const region of state.settings.unlockAhead) {
    if (!known(data.regions, region)) problems.push(`region ${region}`);
  }
  const first = state.onboarding.firstFriend;
  if (first !== null && !known(data.friends, first)) problems.push(`first friend ${first}`);
  const fits = (item: string | null, slot: string) => {
    if (item === null) return true;
    const cosmetic = data.cosmetics.find((c) => c.id === item);
    return cosmetic !== undefined && cosmetic.slot === slot && state.cosmetics.owned.includes(item);
  };
  for (const [id, friend] of Object.entries(state.friends)) {
    if (!known(data.friends, id)) problems.push(`friend ${id}`);
    for (const [slot, item] of Object.entries(friend.outfit)) {
      if (!fits(item, slot)) problems.push(`outfit ${id}.${slot}`);
    }
  }
  state.grotto.forEach((item, spot) => {
    if (!fits(item, 'grotto')) problems.push(`grotto ${spot}`);
  });
  for (const quest of state.daily?.quests ?? []) {
    if (!known(data.quests, quest.template)) problems.push(`quest ${quest.id}`);
  }
  try {
    restoreCosmetics(cosmeticCatalog(data), state.cosmetics);
  } catch {
    problems.push('cosmetics');
  }
  for (const [id, beatState] of Object.entries(state.story.beats)) {
    const beat = findBeat(data, id);
    if (!beat) {
      problems.push(`beat ${id}`);
      continue;
    }
    try {
      restoreNarrative(beat.graph as NarrativeGraph, beatState);
    } catch {
      problems.push(`beat state ${id}`);
    }
  }
  if (state.run && !known(data.levels, state.run.level)) problems.push(`run ${state.run.level}`);
  const round = state.round;
  if (round && round.skills.some((skill) => !known(data.skills, skill))) {
    problems.push('round skills');
  }
  if (round?.type === 'minigame') {
    try {
      restoreMinigame(round.definition as MinigameDefinition, round.state, MINIGAMES);
    } catch {
      problems.push('round board');
    }
  }
  if (round?.type === 'problems') {
    if (round.battle !== null && !known(data.monsters, round.battle.monster)) {
      problems.push('round monster');
    }
    if (round.current?.ambush && !known(data.inkoustici, round.current.ambush)) {
      problems.push('round ambush');
    }
    if (round.placement !== null) {
      if (round.placement.step > placementFor(data, state.settings.grade).steps.length) {
        problems.push('placement step');
      }
      for (const level of round.placement.placed) {
        if (!known(data.levels, level)) problems.push(`placed ${level}`);
      }
    }
  }
  for (const job of read.jobs) {
    const payload = job.payload as { round?: unknown };
    if (job.rule !== 'reask' || state.round?.id !== payload.round) problems.push(`job ${job.id}`);
  }
  return problems.length === 0
    ? success(undefined)
    : failure(
        'incompatible-state',
        `State refers to unknown or inconsistent records: ${problems.slice(0, 5).join(', ')}.`,
      );
}

export const pearlSeaAdapter: RuntimeAdapter<ProfileState, GameAction, GameView, ContentData> = {
  id: ADAPTER_ID,
  stateVersion: STATE_VERSION,
  state: profileStateSchema,
  action: gameActionSchema,
  content: contentRegistration,
  randomStreams: RANDOM_STREAMS,
  eventPhases: EVENT_PHASES,
  initialize: ({ content }) =>
    initialProfileState({ dailyGoal: content.data.balance.daily.goalAnswers, race: true }),
  resolve(action, read) {
    const problem = legality(action, read);
    if (problem) return problem;
    return success({ rule: action.type, payload: action, turns: ACTION_TURNS[action.type] });
  },
  commands: [
    command('startSession', {
      start: (ctx, action) => action.type === 'startSession' && startSession(ctx, action.day),
    }),
    command('chooseFirstFriend', {
      start(ctx, action) {
        if (action.type !== 'chooseFirstFriend') return;
        ctx.state.onboarding.firstFriend = action.friend;
        grantEgg(ctx, action.friend);
        awardStickers(ctx);
      },
    }),
    command('startLevel', {
      start(ctx, action) {
        if (action.type !== 'startLevel') return;
        const index = itemIndex(ctx.content.data);
        if (ctx.state.round) closeRound(ctx);
        // Playing a level instead of the placement check skips it (grown-ups can re-run it).
        if (ctx.state.onboarding.placement === 'pending') {
          ctx.state.onboarding.placement = 'skipped';
        }
        const level = ctx.content.data.levels.find((l) => l.id === action.level)!;
        if (action.activity !== undefined) {
          // A replay of one activity: the run is already over, so it never completes again.
          ctx.state.run = { level: action.level, next: level.activities.length, results: [] };
          startRunActivity(ctx, index, action.activity);
        } else {
          ctx.state.run = { level: action.level, next: 0, results: [] };
          triggerBeats(
            ctx,
            (trigger) => trigger.kind === 'level-start' && trigger.level === action.level,
          );
          if (level.storyBeat !== null) playBeat(ctx, level.storyBeat);
          startRunActivity(ctx, index, 0);
        }
        settleRound(ctx);
      },
    }),
    command('startActivity', {
      start(ctx, action) {
        if (action.type !== 'startActivity') return;
        const index = itemIndex(ctx.content.data);
        const request = action.activity;
        if (request.kind === 'level') {
          // Keep the run, even a finished one: a replayed activity belongs to it.
          ctx.state.round = null;
          startRunActivity(ctx, index, request.index);
        } else {
          if (ctx.state.round) closeRound(ctx);
          if (request.kind === 'placement') startPlacement(ctx, index);
          else if (request.kind === 'snack') startSnack(ctx, index, request.friend);
          else startRace(ctx, index);
        }
        settleRound(ctx);
      },
    }),
    command('answer', {
      start: (ctx, action) =>
        action.type === 'answer' && gradeAnswer(ctx, action.value, action.elapsedMs),
      finish: afterAnswer,
    }),
    command('placementAnswer', {
      start: (ctx, action) =>
        action.type === 'placementAnswer' && gradeAnswer(ctx, action.value, action.elapsedMs),
      finish: afterAnswer,
    }),
    command('minigameMove', {
      start(ctx, action) {
        if (action.type !== 'minigameMove') return;
        const index = itemIndex(ctx.content.data);
        const finished = applyMinigameMove(ctx, index, action.revision, action.move as JsonValue);
        if (finished) completeRound(ctx, index, 'finished');
        applyGrowth(ctx, index);
        awardStickers(ctx);
      },
    }),
    command('hint', {
      start(ctx) {
        const current = activeProblemRound(ctx)?.current;
        if (!current) return;
        current.hinted = true;
        ctx.emit(EVENTS.hintShown, { item: current.item });
      },
    }),
    command('endRound', {
      start(ctx, action) {
        if (action.type !== 'endRound') return;
        if (action.reason === 'done') closeRound(ctx);
        else completeRound(ctx, itemIndex(ctx.content.data), action.reason);
        if (action.reason === 'quit') closeRound(ctx);
      },
    }),
    command('buy', {
      start(ctx, action) {
        if (action.type !== 'buy') return;
        const item = ctx.content.data.cosmetics.find((c) => c.id === action.item)!;
        ctx.state.coins -= item.price;
        grantItem(ctx, item.id, `buy:${item.id}`);
        ctx.emit(EVENTS.itemPurchased, { item: item.id, price: item.price });
        awardStickers(ctx);
      },
    }),
    command('equip', {
      start(ctx, action) {
        if (action.type !== 'equip') return;
        ctx.state.friends[action.friend]!.outfit[action.slot] = action.item;
        ctx.emit(EVENTS.friendDressed, {
          friend: action.friend,
          slot: action.slot,
          item: action.item,
        });
        awardStickers(ctx);
      },
    }),
    command('decorate', {
      start(ctx, action) {
        if (action.type !== 'decorate') return;
        // One decoration is in one place: placing it again moves it.
        const grotto = ctx.state.grotto.map((item) =>
          action.item !== null && item === action.item ? null : item,
        );
        grotto[action.spot] = action.item;
        ctx.state.grotto = grotto.slice(0, GROTTO_SPOTS);
        ctx.emit(EVENTS.grottoDecorated, { spot: action.spot, item: action.item });
        awardStickers(ctx);
      },
    }),
    command('claimQuest', {
      start(ctx, action) {
        if (action.type !== 'claimQuest') return;
        claimQuest(ctx, action.quest);
        awardStickers(ctx);
      },
    }),
    command('openChest', {
      start(ctx) {
        openChest(ctx);
        awardStickers(ctx);
      },
    }),
    command('storyChoice', {
      start(ctx, action) {
        if (action.type !== 'storyChoice') return;
        chooseInBeat(ctx, action.beat, action.node, action.revision, action.choice);
        awardStickers(ctx);
      },
    }),
    command('setSetting', {
      start(ctx, action) {
        if (action.type !== 'setSetting') return;
        const { setting } = action;
        if (setting.key === 'dailyGoal') {
          ctx.state.settings.dailyGoal = setting.value;
          if (ctx.state.daily) ctx.state.daily.goal = setting.value;
          checkDailyGoal(ctx);
        } else if (setting.key === 'race') ctx.state.settings.race = setting.value;
        else if (setting.key === 'grade') ctx.state.settings.grade = setting.value;
        else ctx.state.settings.unlockAhead = [...setting.value];
      },
    }),
  ],
  jobs: JOB_RULES.map((id) => ({
    id,
    payload: reaskPayload,
    run(ctx: Ctx, job) {
      const { round, item } = requireValue(reaskPayload.parse(job.payload));
      const active = activeProblemRound(ctx);
      if (active && active.id === round && !active.queue.includes(item)) active.queue.push(item);
    },
  })),
  view: (read) => projectView(read),
  validate: validateState,
  canActivateContent: (read) => read.state.round === null && read.state.story.pending === null,
  activateContent(ctx) {
    // Content IDs are append-only (docs/contract.md §7.6), so progress carries forward; only
    // item IDs the contract retired by merging items move, into the items they stand for.
    mergeRetiredItems(ctx.state, ctx.content.data);
  },
};

/** Create a host for one profile. */
export function createGameHost(
  content: ContentPack<ContentData>,
  seed: string,
  checkpoint?: CheckpointWriter,
): RuntimeHost<ProfileState, GameAction, GameView, ContentData> {
  return createRuntimeHost({ adapter: pearlSeaAdapter, content, seed, checkpoint });
}
