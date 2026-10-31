/**
 * A child's printables, in Czech: flashcards ask the very letter the child keeps missing (the
 * word with its spelling point blank on the front, the whole word on the back), only words'
 * spelling points make cards, and diplomas name the child, the deed and the day.
 */
import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../../src/app/i18n/messages';
import { flashcardJob } from '../../../src/app/print/documents';
import {
  BLANK,
  gradeDiploma,
  hardestCards,
  monsterDiploma,
} from '../../../src/app/print/printables';
import type { GrownUpsView } from '../../../src/rules/contract';

const t = createTranslator();

function entry(item: string, text: string, accuracy = 40): GrownUpsView['hardest'][number] {
  return { item, word: null, text, accuracy, box: 1 };
}

describe('flashcards', () => {
  it('blank the spelling point on the front and show the whole word on the back', () => {
    const cards = hardestCards([
      entry('spell:mlyyn:2', 'mlýn'),
      entry('spell:krixdlo:2', 'křídlo'),
      entry('spell:tygr:1', 'tygr'),
    ]);
    expect(cards).toEqual([
      { id: 'spell:mlyyn:2', front: [`ml${BLANK}n`], back: ['mlýn'] },
      { id: 'spell:krixdlo:2', front: [`kř${BLANK}dlo`], back: ['křídlo'] },
      { id: 'spell:tygr:1', front: [`t${BLANK}gr`], back: ['tygr'] },
    ]);
  });

  it('come only from spelling points that fall inside the word', () => {
    const cards = hardestCards([
      entry('class:consonant:cb', 'b'),
      entry('gap:s.ryby-1:0', 'Ryby plavou.'),
      entry('rel:antonym:velky', 'velký'),
      entry('spell:mys:9', 'myš'),
      entry('not an item', 'nic'),
    ]);
    expect(cards).toEqual([]);
  });

  it('fit on a printed sheet of ten cards', () => {
    const cards = hardestCards(
      ['mlýn', 'brýle', 'pytel', 'výr', 'sýr', 'myš', 'zima', 'pivo', 'lyže', 'býk'].map(
        (word, index) => entry(`spell:w${index}:1`, word),
      ),
    );
    const job = flashcardJob(t('print.cardsTitle', { name: 'Ema' }), cards, 'karticky-ema');
    expect(job.layout.pages.map((page) => page.side)).toEqual(['front', 'back']);
    expect(job.layout.pages[0]!.items).toHaveLength(10);
  });
});

describe('diplomas', () => {
  it('name the child, the freed monster and the day it was freed, in Czech', () => {
    expect(
      monsterDiploma(t, 'Ema', { id: 'murena-mumla', name: 'Muréna Mumla', day: '2026-10-31' }),
    ).toEqual({
      id: 'certificate:monster:murena-mumla',
      heading: t('diploma.heading'),
      body: ['Ema', t('diploma.monster', { monster: 'Muréna Mumla' }), '31. 10. 2026'],
    });
    expect(t('diploma.monster', { monster: 'Muréna Mumla' })).toContain('Muréna Mumla');
  });

  it('name the child and the whole grade, dated the day of printing', () => {
    expect(gradeDiploma(t, 'Ema', 3, '2027-06-30')).toEqual({
      id: 'certificate:grade:3',
      heading: t('diploma.heading'),
      body: ['Ema', t('diploma.grade', { grade: 3 }), '30. 6. 2027'],
    });
    expect(t('diploma.grade', { grade: 4 })).toContain('4.');
  });
});
