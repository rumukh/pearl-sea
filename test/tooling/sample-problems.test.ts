/**
 * The problem sampler (scripts/content/sample-problems.mjs), the Czech review's view of what the
 * rules really ask: it writes the same files for the same pack and seed, covers every problem
 * skill of a region, asks a point the word alone cannot decide only in a sentence, and records a
 * problem it cannot make as an error.
 */
import { describe, expect, it } from 'vitest';
import { sampleProblems, spread } from '../../scripts/content/sample-problems.mjs';

describe('the problem sampler', () => {
  it('spreads its picks evenly over a long list and keeps a short one whole', () => {
    expect(spread([1, 2, 3], 5)).toEqual([1, 2, 3]);
    expect(spread([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5)).toEqual([0, 2, 4, 6, 8]);
  });

  it('writes Slunná laguna the same way twice, every problem skill and no failure', async () => {
    const options = { regions: ['sunny-lagoon'], perSkill: 3, boards: 1 };
    const first = await sampleProblems(options);
    const second = await sampleProblems(options);
    expect(first.errors, 'problems the generators could not make').toEqual([]);
    expect([...first.files], 'the same pack and seed write the same files').toEqual([
      ...second.files,
    ]);
    const lagoon = first.files.get('01-sunny-lagoon.md') ?? '';
    for (const skill of ['sk.lagoon.tvrda', 'sk.lagoon.capitals', 'sk.lagoon.e-mistakes']) {
      expect(lagoon, `${skill} is sampled`).toContain(`: ${skill} (`);
    }
    expect(first.counts).toEqual([
      expect.objectContaining({ region: 'sunny-lagoon', skills: 17, errors: 0 }),
    ]);
    expect(first.files.get('battles.md'), 'Muréna Mumla’s battle').toContain('Muréna Mumla');
  }, 120_000);

  it('asks led (let) and the names Bublinka and Osmička only in a sentence', async () => {
    const { files } = await sampleProblems({ regions: ['sunny-lagoon'], perSkill: 20, boards: 0 });
    const lagoon = files.get('01-sunny-lagoon.md') ?? '';
    expect(lagoon).toContain('věta paired.03: Moře pokryl tenký le[1].');
    expect(lagoon, 'never led alone').not.toContain('slovo: le[1]');
    expect(lagoon).toContain('věta capitals.04: Ponorka [1]ublinka se ponořila.');
    expect(lagoon).toContain('věta capitals.05: Profesorka [1]smička učí malé rybky.');
    expect(lagoon, 'never Bublinka alone').not.toContain('slovo: [1]ublinka');
    expect(lagoon, 'never Osmička alone').not.toContain('slovo: [1]smička');
    expect(lagoon, 'no single word an option turns into another word').not.toContain('(bez věty!)');
  }, 120_000);
});
