/**
 * Printables for the grown-ups' area: flashcards of the words a child finds hardest, and
 * diplomas (certificates) for freed monsters and finished seas, in Czech.
 *
 * `layoutPrint` from `@aegis/narrative` turns a document into physical A4 geometry: cells in
 * millimetres, the text checked against each cell (it throws rather than clip anything) and, for
 * the double-sided flashcards, back pages whose cells mirror the fronts for a long-edge flip. The
 * shell draws that geometry itself for the preview and the printer (print/sheets.ts: the reading
 * font and pictures on diplomas), and `renderPrintHtml` gives the same layout as a plain,
 * script-free HTML file a grown-up can save and print elsewhere.
 */
import { layoutPrint, renderPrintHtml } from '@aegis/narrative';
import type { PrintDocument, PrintItem, PrintLayout, PrintOptions } from '@aegis/narrative';

/**
 * Ten cards on one A4 sheet, printed on both sides and flipped on the long edge. At 20 pt a card
 * holds twelve letters a line in the toolkit's monospace check, enough for words such as
 * "vyjmenované"; the reading font drawn on the sheet is narrower still.
 */
export const FLASHCARD_OPTIONS: Readonly<PrintOptions> = {
  paper: 'A4',
  columns: 2,
  rows: 5,
  marginMm: 10,
  gutterMm: 4,
  fontPt: 20,
  duplex: 'long-edge',
};

/** One diploma per A4 page: the picture and heading in the top cell, the words below. */
export const CERTIFICATE_OPTIONS: Readonly<PrintOptions> = {
  paper: 'A4',
  columns: 1,
  rows: 2,
  marginMm: 15,
  gutterMm: 0,
  fontPt: 26,
  duplex: 'none',
};

export type PrintKind = 'flashcards' | 'certificate';

/** A laid-out printable, ready for the preview, the printer or a file. */
export interface PrintJob {
  readonly kind: PrintKind;
  /** The document as written: its paragraphs, which the shell's own drawing wraps itself. */
  readonly document: PrintDocument;
  readonly layout: PrintLayout;
  /** File name without extension, for "Uložit jako soubor". */
  readonly fileName: string;
}

/** One flashcard: the task on the front; the answer and how to remember it on the back. */
export interface CardText {
  /** Stable identity, e.g. the item ID `word:mlyn:vyjm`. */
  readonly id: string;
  readonly front: readonly string[];
  readonly back: readonly string[];
}

export interface CertificateText {
  /** Stable identity, e.g. `certificate:monster:murena-mumla`. */
  readonly id: string;
  /** The heading under the picture. */
  readonly heading: string;
  /** Paragraphs below: the child's name, the deed, the date. */
  readonly body: readonly string[];
}

export function flashcardDocument(title: string, cards: readonly CardText[]): PrintDocument {
  return {
    title,
    items: cards.map((card): PrintItem => ({
      id: `card-${card.id}`,
      contentId: card.id,
      kind: 'card',
      front: [...card.front],
      back: [...card.back],
    })),
  };
}

export function certificateDocument(title: string, certificate: CertificateText): PrintDocument {
  return {
    title,
    items: [
      {
        id: 'heading',
        contentId: certificate.id,
        kind: 'card',
        front: [certificate.heading],
        back: null,
      },
      {
        id: 'body',
        contentId: certificate.id,
        kind: 'card',
        front: [...certificate.body],
        back: null,
      },
    ],
  };
}

function job(
  kind: PrintKind,
  document: PrintDocument,
  options: PrintOptions,
  fileName: string,
): PrintJob {
  const approved = [...new Set(document.items.map((item) => item.contentId))];
  return { kind, document, layout: layoutPrint(document, options, approved), fileName };
}

/**
 * Flashcards for `cards` (at least one). Throws the toolkit's error if a card's text could not
 * fit, which the grown-ups' area reports instead of printing clipped cards.
 */
export function flashcardJob(
  title: string,
  cards: readonly CardText[],
  fileName: string,
): PrintJob {
  return job('flashcards', flashcardDocument(title, cards), { ...FLASHCARD_OPTIONS }, fileName);
}

export function certificateJob(
  title: string,
  certificate: CertificateText,
  fileName: string,
): PrintJob {
  return job(
    'certificate',
    certificateDocument(title, certificate),
    { ...CERTIFICATE_OPTIONS },
    fileName,
  );
}

/**
 * The job as a standalone, script-free HTML document (`renderPrintHtml`), in the language of its
 * words (Czech), with the printing advice in the grown-ups' language instead of the toolkit's
 * English.
 */
export function printFile(job: PrintJob, guidance: string): string {
  return renderPrintHtml({ ...job.layout, guidance }).replace('<html>', '<html lang="cs">');
}
