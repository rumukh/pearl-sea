/**
 * Printables (src/app/print/): flashcards laid out ten to an A4 sheet and mirrored for a
 * long-edge flip, a diploma on one page, text that cannot fit refused rather than clipped, and
 * the same layout saved as a plain, script-free Czech file with Czech printing advice.
 */
import { renderPrintHtml } from '@aegis/narrative';
import { describe, expect, it } from 'vitest';
import {
  certificateJob,
  FLASHCARD_OPTIONS,
  flashcardJob,
  printFile,
} from '../../../src/app/print/documents';
import type { CardText } from '../../../src/app/print/documents';
import { pageNumber } from '../../../src/app/screens/print';

const WORDS = ['mlýn', 'být', 'slyšet', 'myš', 'brzy', 'pýcha', 'sýr', 'výr', 'jazyk', 'lyže'];

function cards(count: number): CardText[] {
  return Array.from({ length: count }, (_, index) => {
    const word = WORDS[index % WORDS.length]!;
    return {
      id: `word-${index}`,
      front: [word.replace(/[yý]/, '_')],
      back: [word, 'vyjmenované slovo'],
    };
  });
}

describe('print layouts', () => {
  it('fit ten cards on an A4 sheet, the backs mirrored for a long-edge flip', () => {
    const job = flashcardJob('Kartičky', cards(20), 'karticky');
    expect(FLASHCARD_OPTIONS).toMatchObject({ columns: 2, rows: 5, paper: 'A4' });
    expect(job.layout.pages).toHaveLength(4);
    expect(job.layout.duplex).toBe('long-edge');
    const [front, back] = job.layout.pages;
    expect(front!.side).toBe('front');
    expect(back!.side).toBe('back');
    // The first card's back sits under it when the sheet is flipped on its long edge.
    expect(back!.items[0]!.xMm).toBe(front!.items[1]!.xMm);
    expect(back!.items[0]!.id).toBe(front!.items[0]!.id);
  });

  it('keep the document paragraphs for the shell drawing and refuse text that cannot fit', () => {
    const job = flashcardJob('Kartičky', cards(1), 'one');
    expect(job.document.items[0]).toMatchObject({
      front: ['ml_n'],
      back: ['mlýn', 'vyjmenované slovo'],
    });
    const long: CardText = { id: 'long', front: ['ž'.repeat(40)], back: ['x'] };
    expect(() => flashcardJob('Kartičky', [long], 'long')).toThrow();
  });

  it('lay a diploma out on one side of one page', () => {
    const job = certificateJob(
      'Diplom',
      {
        id: 'certificate:monster:murena-mumla',
        heading: 'Murena Mumla je zase veselá!',
        body: ['Ema', 'umyla inkoust ze Slunné laguny.', '31. října 2026'],
      },
      'ema-murena',
    );
    expect(job.layout.pages).toHaveLength(1);
    expect(job.layout.duplex).toBe('none');
    expect(job.layout.pages[0]!.items.map((item) => item.id)).toEqual(['heading', 'body']);
  });

  it('save the same layout as a plain, script-free Czech file with the advice given', () => {
    const job = flashcardJob('Kartičky', cards(10), 'karticky');
    const advice = 'Tiskněte oboustranně.';
    const file = printFile(job, advice);
    expect(file).toBe(
      renderPrintHtml({ ...job.layout, guidance: advice }).replace('<html>', '<html lang="cs">'),
    );
    expect(file).toContain('<html lang="cs">');
    expect(file).toContain(advice);
    expect(file).not.toContain(job.layout.guidance);
    expect(file).not.toMatch(/<script|<link|https?:/i);
  });

  it('number double-sided sheets and single pages', () => {
    expect([0, 1, 2, 3].map((index) => pageNumber(index, true))).toEqual([1, 1, 2, 2]);
    expect([0, 1, 2].map((index) => pageNumber(index, false))).toEqual([1, 2, 3]);
  });
});
