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

/** An ISO day (`2026-10-31`) as a Czech date: `31. 10. 2026`. */
export function czechDate(day: string): string {
  const [year, month, date] = day.split('-');
  return `${Number(date)}. ${Number(month)}. ${year}`;
}
