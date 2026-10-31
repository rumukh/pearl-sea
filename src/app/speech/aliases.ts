/**
 * Read-aloud aliases: whole words the voices say wrongly, given in the UI catalog as
 * `speech.alias.*` keys and applied to the text just before it is spoken. What the screen shows
 * is untouched.
 *
 * - `speech.alias.<word>`: the word is always said as its alias.
 * - `speech.alias.<word>.one`, `.few` and `.other`: after a number the form follows it, in
 *   Czech plural forms ("1 Kč" is said "1 koruna", "3 Kč" "3 koruny", "25 Kč" "25 korun");
 *   anywhere else the `other` form.
 *
 * A word matches only whole: never inside a longer word, so an inflected form keeps its ending.
 */
import { pluralCategory } from '../i18n/messages';

export interface SpeechAlias {
  readonly word: string;
  readonly one: string;
  readonly few: string;
  readonly other: string;
}

const PREFIX = 'speech.alias.';

type Forms = { plain?: string; one?: string; few?: string; other?: string };

/** The aliases a catalog defines, longest word first (so a longer word wins over its start). */
export function speechAliases(catalog: Readonly<Record<string, string>>): SpeechAlias[] {
  const forms = new Map<string, Forms>();
  for (const [key, value] of Object.entries(catalog)) {
    if (!key.startsWith(PREFIX)) continue;
    const rest = key.slice(PREFIX.length);
    const plural = /^(.+)\.(one|few|other)$/u.exec(rest);
    const word = plural ? plural[1]! : rest;
    const entry = forms.get(word) ?? {};
    if (plural) entry[plural[2] as 'one' | 'few' | 'other'] = value;
    else entry.plain = value;
    forms.set(word, entry);
  }
  return [...forms]
    .map(([word, form]) => {
      const other = form.other ?? form.plain ?? form.few ?? form.one ?? word;
      return {
        word,
        one: form.one ?? form.plain ?? other,
        few: form.few ?? form.plain ?? other,
        other,
      };
    })
    .sort((a, b) => b.word.length - a.word.length);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The text as it should be said: every alias's word replaced by its spoken form. */
export function applyAliases(text: string, aliases: readonly SpeechAlias[]): string {
  let spoken = text;
  for (const alias of aliases) {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])(?:(\\d+)(\\s+))?${escapeRegExp(alias.word)}(?![\\p{L}\\p{N}])`,
      'gu',
    );
    spoken = spoken.replace(pattern, (_match, count?: string, space?: string) =>
      count === undefined
        ? alias.other
        : `${count}${space}${alias[pluralCategory('cs', Number(count))]}`,
    );
  }
  return spoken;
}
