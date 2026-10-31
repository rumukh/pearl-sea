/**
 * The print preview, opened from the grown-ups' area: the pages of a printable as they will come
 * out of the printer (print/sheets.ts), how to print them, and two ways out - the browser's own
 * print dialog (only the pages are printed; the screen around them is hidden by the print
 * styles) or the same layout saved as a plain HTML file (`renderPrintHtml`) to print elsewhere.
 * The pages are Czech; the words around them speak the grown-ups' language.
 */
import type { PrintJob } from '../print/documents';
import { printFile } from '../print/documents';
import { renderSheets } from '../print/sheets';
import type { SheetOptions } from '../print/sheets';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';
import { downloadText, topBar } from './common';

export interface PrintRequest {
  readonly job: PrintJob;
  /** The screen's heading, e.g. "Kartičky: nejtěžší slova". */
  readonly title: string;
  readonly art?: SheetOptions['art'];
}

/** "Sheet 2, back" for double-sided jobs, "Page 2" for single-sided ones. */
export function pageNumber(index: number, duplex: boolean): number {
  return duplex ? Math.floor(index / 2) + 1 : index + 1;
}

export function printScreen(app: App, request: PrintRequest): ScreenEntry {
  return {
    key: `print:${request.job.fileName}`,
    build() {
      const g = app.grownUps();
      const { job } = request;
      const duplex = job.layout.duplex !== 'none';
      const guidance = duplex
        ? g('grownups.print.guidance.duplex')
        : g('grownups.print.guidance.single');
      const heading = h('h1', { className: 'ps-print__title', text: request.title });
      const sheets = renderSheets(job, {
        pageLabel: (index, side) =>
          duplex
            ? g(side === 'front' ? 'grownups.print.sheetFront' : 'grownups.print.sheetBack', {
                number: pageNumber(index, true),
              })
            : g('grownups.print.page', { number: pageNumber(index, false) }),
        ...(request.art ? { art: request.art } : {}),
      });
      const pages = job.layout.pages.length;
      const element = h(
        'main',
        { className: 'ps-print', testId: 'screen-print', dataset: { kind: job.kind } },
        topBar({
          back: {
            label: g('grownups.print.back'),
            testId: 'print-back',
            onPress: () => app.router.back(),
          },
          title: heading,
          onError: app.kit.onError,
        }),
        h(
          'section',
          { className: 'ps-card ps-print__intro' },
          h('p', { testId: 'print-guidance', text: guidance }),
          h('p', {
            className: 'ps-note',
            testId: 'print-count',
            text: duplex
              ? g.plural('grownups.print.sheets', pages / 2)
              : g.plural('grownups.print.pages', pages),
          }),
          h(
            'div',
            { className: 'ps-row' },
            candyButton({
              label: g('grownups.print.print'),
              icon: 'print',
              variant: 'sun',
              testId: 'print-now',
              onPress: () => window.print(),
              onError: app.kit.onError,
            }),
            candyButton({
              label: g('grownups.print.file'),
              icon: 'download',
              variant: 'paper',
              testId: 'print-file',
              onPress: () =>
                downloadText(`${job.fileName}.html`, printFile(job, guidance), 'text/html'),
              onError: app.kit.onError,
            }),
          ),
        ),
        sheets,
      );
      // Only the pages are printed while this screen is shown (the print styles hide the rest).
      document.documentElement.dataset['printing'] = job.kind;
      return {
        element,
        title: request.title,
        field: 'desk',
        region: null,
        lang: g.language,
        dispose() {
          delete document.documentElement.dataset['printing'];
        },
      };
    },
  };
}
