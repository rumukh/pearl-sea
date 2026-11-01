/**
 * Problems step by step (design §5.1, §5.5, §5.6, §6.4): every answer step is one turn; a gap
 * problem credits each gap's own item; Lov chyb's find and fix train the fix's item once, with the
 * worse of the two answers (a wrong find counts as a miss and the fix still follows); a miss is
 * re-asked three problems later, at most twice a round, and leaving the round cancels it; a hint
 * shows the strategy for free; the input follows the item's box.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RuntimeSnapshot } from '@aegis/runtime';
import { inputFor } from '../../../src/rules/progression/problems';
import type { Problem, ProblemRoundView } from '../../../src/rules/contract';
import type { Player } from '../../traces/support';
import { playerFrom, saveAfter } from './saves';

vi.setConfig({ testTimeout: 120_000 });

let afterThree: RuntimeSnapshot;
beforeAll(async () => {
  afterThree = await saveAfter(['sunny-lagoon.1', 'sunny-lagoon.2', 'sunny-lagoon.3']);
});

/** Start activity `index` of Slunná laguna 4 (Krmení, Inkoustová věta, Lov chyb). */
async function lagoonFour(index: number): Promise<Player> {
  const player = await playerFrom(afterThree);
  await player.act({ type: 'startLevel', level: 'sunny-lagoon.4' });
  await player.settleStory();
  for (let i = 0; i < index; i++) {
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    await player.act({ type: 'startActivity', activity: { kind: 'level', index: i + 1 } });
  }
  return player;
}

function onScreen(player: Player) {
  const round = player.view().round as ProblemRoundView | null;
  return round?.status === 'active' ? round.problem : null;
}

/** Answer events (item per step) since `from`. */
const answerItems = (player: Player, from: number) =>
  player.events
    .slice(from)
    .filter((e) => e.type === 'answer.correct' || e.type === 'answer.incorrect')
    .map((e) => (e.data as { item: string }).item);

describe('a sentence with several gaps', () => {
  it('asks one gap a step, one turn each, crediting each gap’s own item', async () => {
    const player = await lagoonFour(1);
    let checked = 0;
    for (let guard = 0; guard < 20; guard++) {
      const shown = onScreen(player);
      if (!shown) break;
      const problem = shown.problem as Problem;
      if (problem.kind !== 'gaps') throw new Error('Inkoustová věta asks gaps');
      const from = player.events.length;
      const turn = player.turn;
      for (let step = 0; step < problem.gaps.length; step++) {
        expect(onScreen(player)?.step).toBe(step);
        await player.answerAs(true);
      }
      expect(player.turn - turn).toBe(problem.gaps.length);
      expect(answerItems(player, from)).toEqual(problem.gaps.map((gap) => gap.item));
      if (problem.gaps.length > 1) checked += 1;
    }
    expect(checked, 'some sentence had several gaps').toBeGreaterThan(0);
    expect(player.failures).toEqual([]);
    await player.dispose();
  });

  it('shows the answer of a wrong gap and goes on to the next one', async () => {
    const player = await lagoonFour(1);
    let found = false;
    for (let guard = 0; guard < 20 && !found; guard++) {
      const shown = onScreen(player);
      if (!shown) break;
      const problem = shown.problem as Problem;
      if (problem.kind !== 'gaps' || problem.gaps.length < 2 || shown.step > 0) {
        await player.answerAs(true);
        continue;
      }
      await player.answerAs(false);
      const after = player.view().round as ProblemRoundView;
      expect(after.feedback).toMatchObject({ correct: false, step: 0 });
      expect(after.feedback?.expected).toEqual({ kind: 'text', value: problem.gaps[0]!.correct });
      expect(after.problem?.step, 'the next gap follows').toBe(1);
      found = true;
    }
    expect(found).toBe(true);
    await player.dispose();
  });
});

describe('Lov chyb', () => {
  it('trains the fix’s item once, with the worse answer; a wrong find still leads to the fix', async () => {
    const player = await lagoonFour(2);
    // 1st hunt: wrong find, right fix. 2nd hunt: right and right.
    const first = onScreen(player)!;
    expect(first.problem.kind).toBe('mistake');
    const fixItem = (first.problem as Extract<Problem, { kind: 'mistake' }>).fix.item;
    let from = player.events.length;
    await player.answerAs(false);
    expect(onScreen(player)?.step, 'the fix follows a wrong find').toBe(1);
    await player.answerAs(true);
    expect(answerItems(player, from)).toEqual([fixItem, fixItem]);
    const promoted = (from: number) =>
      player.events.slice(from).filter((e) => e.type === 'item.promoted');
    expect(promoted(from), 'a wrong find makes the hunt a miss').toHaveLength(0);
    expect(player.data_('reask.scheduled').at(-1)).toMatchObject({ item: fixItem });

    const second = onScreen(player)!;
    const secondFix = (second.problem as Extract<Problem, { kind: 'mistake' }>).fix.item;
    from = player.events.length;
    await player.answerAs(true);
    expect(promoted(from), 'the find alone credits nothing').toHaveLength(0);
    await player.answerAs(true);
    const credited = promoted(from).map((e) => (e.data as { item: string }).item);
    expect(credited.length <= 1 && credited.every((item) => item === secondFix)).toBe(true);
    expect(player.failures).toEqual([]);
    await player.dispose();
  });
});

describe('re-asks', () => {
  it('come three problems later, at most twice a round, and leaving the round cancels them', async () => {
    const player = await lagoonFour(0);
    const misses: { item: string; index: number }[] = [];
    for (let n = 0; n < 5; n++) {
      const shown = onScreen(player)!;
      if (shown.step === 0 && !shown.reask) misses.push({ item: shown.item, index: shown.index });
      await player.answerAs(false);
      while (onScreen(player) && onScreen(player)!.step > 0) await player.answerAs(true);
    }
    expect(player.count('reask.scheduled')).toBe(2);
    for (let guard = 0; guard < 10 && onScreen(player); guard++) {
      const shown = onScreen(player)!;
      if (shown.reask) {
        const missed = misses.find((m) => m.item === shown.item)!;
        expect(shown.index).toBe(missed.index + 3);
      }
      await player.answerAs(true);
    }
    expect(player.served.filter((s) => s.reask && s.step === 0)).toHaveLength(2);
    await player.dispose();
  });

  it('are cancelled when the round is left', async () => {
    const player = await lagoonFour(0);
    await player.answerAs(false);
    expect(player.host.inspect().jobs).toHaveLength(1);
    await player.act({ type: 'endRound', reason: 'quit' });
    expect(player.host.inspect().jobs).toHaveLength(0);
    await player.dispose();
  });
});

describe('hints', () => {
  it('show the strategy for free, once a problem', async () => {
    const player = await lagoonFour(0);
    const item = onScreen(player)!.item;
    await player.act({ type: 'hint' });
    expect(player.data_('hint.shown')).toEqual([{ item }]);
    expect(onScreen(player)?.hinted).toBe(true);
    expect(await player.reject({ type: 'hint' }, 'already-hinted')).toBe(true);
    const coins = player.state().coins;
    await player.answerAs(true, 1500);
    const earned = player.state().coins - coins;
    expect(earned, 'a hint never costs a coin').toBeGreaterThanOrEqual(1);
    await player.dispose();
  });
});

describe('the input of a problem', () => {
  const base = {
    round: 'auto' as const,
    lettersFromBox: 2,
    typedFromBox: 4,
    easier: false,
    gaps: true,
    typeable: true,
    atLeastLetters: false,
  };
  it('follows the box in auto rounds: choice, the letter pad, typing', () => {
    expect([0, 1, 2, 3, 4, 5].map((box) => inputFor({ ...base, box }))).toEqual([
      'choice',
      'choice',
      'letters',
      'letters',
      'typed',
      'typed',
    ]);
  });
  it('uses the letter pad where the answer cannot be typed, choice when made easier', () => {
    expect(inputFor({ ...base, box: 5, typeable: false })).toBe('letters');
    expect(inputFor({ ...base, box: 5, easier: true })).toBe('choice');
  });
  it('asks at least on the letter pad in the race and the placement check', () => {
    expect(inputFor({ ...base, box: 0, atLeastLetters: true })).toBe('letters');
    expect(inputFor({ ...base, box: 0, atLeastLetters: true, easier: true })).toBe('letters');
  });
  it('keeps a round’s fixed mode, and picks classifications', () => {
    expect(inputFor({ ...base, round: 'choice', box: 5 })).toBe('choice');
    expect(inputFor({ ...base, round: 'letters', box: 0 })).toBe('letters');
    expect(inputFor({ ...base, box: 5, gaps: false })).toBe('choice');
  });
});
