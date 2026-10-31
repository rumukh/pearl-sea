// @vitest-environment happy-dom
/**
 * Print sheets drawn in the app (src/app/print/sheets.ts): A4 pages whose cells sit where the
 * layout put them, in Czech with one-letter words bound to the next, and pages named in the
 * grown-ups' language; the print preview says how many sheets or pages a job takes.
 */
import { describe, expect, it } from 'vitest';
import { certificateJob, flashcardJob } from '../../../../src/app/print/documents';
import { renderSheets } from '../../../../src/app/print/sheets';

const NBSP = '\u00a0';

describe('print sheets', () => {
  it('draw each page with its cells placed in percent of the page', () => {
    const job = flashcardJob(
      'Kartičky',
      [
        { id: 'mlyn', front: ['ml_n'], back: ['mlýn', 'mlýn – mlynář'] },
        { id: 'byt', front: ['b_t'], back: ['být', 'být × bít'] },
      ],
      'karticky',
    );
    const sheets = renderSheets(job, {
      pageLabel: (index, side) => `List ${Math.floor(index / 2) + 1}, ${side}`,
    });
    const pages = [...sheets.querySelectorAll<HTMLElement>('[data-testid="print-sheet"]')];
    expect(pages.map((page) => page.dataset['side'])).toEqual(['front', 'back']);
    expect(pages.map((page) => page.getAttribute('aria-label'))).toEqual([
      'List 1, front',
      'List 1, back',
    ]);
    expect(pages.every((page) => page.getAttribute('lang') === 'cs')).toBe(true);
    const cell = pages[0]!.querySelector<HTMLElement>('.ps-sheet__cell')!;
    expect(cell.dataset['content']).toBe('mlyn');
    expect(cell.style.getPropertyValue('--x')).toBe('4.762%');
    expect(sheets.style.getPropertyValue('--paper-width')).toBe('210mm');
    const back = [...pages[1]!.querySelectorAll('.ps-sheet__line')].map((line) => line.textContent);
    expect(back).toEqual(['mlýn', 'mlýn – mlynář', 'být', 'být × bít']);
  });

  it('typeset Czech words on the paper and place a picture before a diploma’s words', () => {
    const job = certificateJob(
      'Diplom',
      {
        id: 'certificate:monster:murena-mumla',
        heading: 'Murena Mumla je zase veselá!',
        body: ['Ema', 'umyla inkoust z Murenky a v laguně je klid.'],
      },
      'diplom',
    );
    const sheets = renderSheets(job, {
      pageLabel: (index) => `Strana ${index + 1}`,
      art: (cell) => (cell.id === 'heading' ? document.createElement('figure') : null),
    });
    const lines = [...sheets.querySelectorAll('.ps-sheet__line')].map((line) => line.textContent);
    expect(lines).toContain(`umyla inkoust z${NBSP}Murenky a${NBSP}v${NBSP}laguně je klid.`);
    const heading = sheets.querySelector('[data-item="heading"]')!;
    expect(heading.firstElementChild?.className).toBe('ps-sheet__art');
    expect(sheets.querySelector('[data-item="body"] .ps-sheet__art')).toBeNull();
  });
});
