/**
 * Czech typesetting for text shown on screen.
 *
 * A one-letter preposition or conjunction (k, s, v, z, o, u, a, i) must not be left at the end of
 * a line in Czech; the space after it becomes a no-break space (U+00A0), which the reading font
 * covers. Catalogs keep ordinary spaces, so translators never type invisible characters.
 */
const ONE_LETTER_WORD = /(?<=^|[\s(„‚"'\u00a0])([AIKOSUVZaikosuvz]) /g;

export function keepOneLetterWordsWithNext(text: string): string {
  return text.replace(ONE_LETTER_WORD, '$1\u00a0');
}

/**
 * A hyphen that starts a word marks an ending (_rod střední: -a_, _-i/-y_). A browser may break a
 * line after it and leave the hyphen alone at the end of the line, so it becomes a non-breaking
 * hyphen (U+2011), which the reading font covers. Hyphens inside words (_vy-_, _e-mail_) and
 * minus signs before numbers stay as they are.
 */
const ENDING_HYPHEN = /(?<=^|[\s(„‚"'/\u00a0])-(?=\p{L})/gu;

export function keepEndingsWhole(text: string): string {
  return text.replace(ENDING_HYPHEN, '\u2011');
}

/** Every Czech string on screen: one-letter words bound to the next word, endings kept whole. */
export function typesetCzech(text: string): string {
  return keepEndingsWhole(keepOneLetterWordsWithNext(text));
}

/** An ISO day (`2026-10-31`) as a Czech date: `31. 10. 2026`. */
export function czechDate(day: string): string {
  const [year, month, date] = day.split('-');
  return `${Number(date)}. ${Number(month)}. ${year}`;
}
