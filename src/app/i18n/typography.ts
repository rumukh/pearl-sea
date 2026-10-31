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
