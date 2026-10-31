/**
 * Story beats: small `@aegis/narrative` graphs started by triggers (first session, after another
 * beat, level start or completion, monster freed, finale). One beat is pending at a time; later
 * triggers queue. Reward claims made inside a beat become game grants through
 * `content.story.rewards` (an egg claimed in a beat's first node is given even if it is skipped).
 * Skippable beats can be skipped whole.
 */
import { advanceNarrative, createNarrativeState, projectNarrative } from '@aegis/narrative';
import type { NarrativeGraph, NarrativeState } from '@aegis/narrative';
import type { DeepReadonly } from '@aegis/runtime';
import { EVENTS } from '../contract';
import type { BeatTrigger, StoryBeat, StoryView } from '../contract';
import { applyGrant } from '../economy/rewards';
import type { Ctx, Data, ReadState } from '../types';

export function findBeat(data: Data, id: string): DeepReadonly<StoryBeat> | undefined {
  return data.story.beats.find((beat) => beat.id === id);
}

function graphOf(beat: DeepReadonly<StoryBeat>): NarrativeGraph {
  return beat.graph as NarrativeGraph;
}

export function isFinished(
  beat: DeepReadonly<StoryBeat>,
  state: DeepReadonly<NarrativeState>,
): boolean {
  return projectNarrative(graphOf(beat), state as NarrativeState).choices.length === 0;
}

function grantRewards(
  ctx: Ctx,
  beat: string,
  before: readonly string[],
  after: readonly string[],
): void {
  for (const reward of after.filter((id) => !before.includes(id))) {
    const mapping = ctx.content.data.story.rewards.find((r) => r.reward === reward);
    if (!mapping || !ctx.claim(`story:${beat}:${reward}`)) continue;
    applyGrant(ctx, mapping.grant, `story:${reward}`, 'story');
  }
}

function startNext(ctx: Ctx): void {
  const story = ctx.state.story;
  while (story.pending === null && story.queue.length > 0) {
    const id = story.queue.shift()!;
    const beat = findBeat(ctx.content.data, id);
    if (!beat) continue;
    const state = createNarrativeState(graphOf(beat));
    story.beats[id] = state;
    story.pending = id;
    grantRewards(ctx, id, [], state.collected.reward);
    if (isFinished(beat, state)) finishBeat(ctx, id);
  }
}

function finishBeat(ctx: Ctx, id: string): void {
  const story = ctx.state.story;
  if (!story.done.includes(id)) story.done.push(id);
  if (story.pending === id) story.pending = null;
  // A finished beat never runs again: keep its ID in `done`, drop its narrative state.
  delete story.beats[id];
  triggerBeats(ctx, (trigger) => trigger.kind === 'after-beat' && trigger.beat === id);
  startNext(ctx);
}

/** Whether a trigger's `grades` filter admits `grade` (no filter admits every grade). */
export function triggerServesGrade(trigger: DeepReadonly<BeatTrigger>, grade: number): boolean {
  return trigger.grades === undefined || (trigger.grades as readonly number[]).includes(grade);
}

function queue(ctx: Ctx, beat: DeepReadonly<StoryBeat>): void {
  const story = ctx.state.story;
  if (story.done.includes(beat.id) || story.pending === beat.id || story.queue.includes(beat.id)) {
    return;
  }
  if (story.beats[beat.id]) return;
  story.queue.push(beat.id);
}

/**
 * Queue every not-yet-seen beat whose trigger matches and whose `grades` filter admits the
 * child's grade, in content order, and start one.
 */
export function triggerBeats(
  ctx: Ctx,
  matches: (trigger: DeepReadonly<BeatTrigger>) => boolean,
): void {
  for (const beat of ctx.content.data.story.beats) {
    if (!matches(beat.trigger)) continue;
    if (!triggerServesGrade(beat.trigger, ctx.state.settings.grade)) continue;
    queue(ctx, beat);
  }
  startNext(ctx);
}

/** Queue one beat by its ID (a level's `storyBeat`) unless it was seen, and start one. */
export function playBeat(ctx: Ctx, id: string): void {
  const beat = findBeat(ctx.content.data, id);
  if (beat && triggerServesGrade(beat.trigger, ctx.state.settings.grade)) queue(ctx, beat);
  startNext(ctx);
}

/** Apply a validated choice (or a skip when `choice` is null) to the pending beat. */
export function chooseInBeat(
  ctx: Ctx,
  beatId: string,
  node: string,
  revision: number,
  choice: string | null,
): void {
  const beat = findBeat(ctx.content.data, beatId)!;
  const current = ctx.state.story.beats[beatId]!;
  if (choice === null) {
    finishBeat(ctx, beatId);
    ctx.emit(EVENTS.storyAdvanced, { beat: beatId, node, finished: true });
    return;
  }
  const next = advanceNarrative(graphOf(beat), current, { node, revision, choice });
  ctx.state.story.beats[beatId] = next;
  grantRewards(ctx, beatId, current.collected.reward, next.collected.reward);
  const finished = isFinished(beat, next);
  ctx.emit(EVENTS.storyAdvanced, { beat: beatId, node: next.node, finished });
  if (finished) finishBeat(ctx, beatId);
}

/** Legality of a story choice, checked in `resolve` (null when legal). */
export function storyChoiceProblem(
  state: ReadState,
  data: Data,
  beatId: string,
  node: string,
  revision: number,
  choice: string | null,
): string | null {
  if (state.story.pending !== beatId) return 'This story beat is not the one on screen.';
  const beat = findBeat(data, beatId);
  const current = state.story.beats[beatId];
  if (!beat || !current) return 'Unknown story beat.';
  if (choice === null) return beat.skippable ? null : 'This story beat cannot be skipped.';
  try {
    advanceNarrative(graphOf(beat), current as NarrativeState, { node, revision, choice });
    return null;
  } catch {
    return 'That choice is not available here.';
  }
}

export function storyView(state: ReadState, data: Data): StoryView | null {
  const id = state.story.pending;
  const beat = id === null ? undefined : findBeat(data, id);
  const current = id === null ? undefined : state.story.beats[id];
  if (!id || !beat || !current) return null;
  const projected = projectNarrative(graphOf(beat), current as NarrativeState);
  return {
    beat: id,
    skippable: beat.skippable,
    node: projected.node,
    scene: projected.scene,
    text: projected.text,
    revision: projected.revision,
    choices: projected.choices,
    finished: projected.choices.length === 0,
  };
}
