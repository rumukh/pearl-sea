/**
 * The vocative (5. pád: oslovujeme, voláme) of a child's first name, for the grotto's greeting
 * ("Ahoj, Emo!", docs/design.md §10.2). Czech declines a name by its ending and gender, so
 * the profile editor suggests the form for a person to confirm or correct, and the greeting uses
 * a suggestion of its own only for a child whose profile has none yet. Where these rules are not
 * sure (a name of several words, a consonant ending without kluk or holka, endings whose vowel may
 * drop or soften), they say `null` and the game greets without the name, as before.
 */
import type { FormOfAddress } from '../../rules/contract';

const VOWELS = 'aáeéěiíoóuúůyý';
/** Soft consonants (and x) take -i: Tomáš → Tomáši, Matěj → Matěji, Max → Maxi. */
const SOFT = 'šžčřjťďňx';
/** Hard and both-way consonants that take -e: Jakub → Jakube, Jan → Jane, Václav → Václave. */
const PLAIN = 'bdfmnptvw';
/** The soft partner of d, t, n before a dropped ě: Zdeněk → Zdeňku. */
const SOFTENED: Readonly<Record<string, string>> = { d: 'ď', t: 'ť', n: 'ň' };

const isVowel = (letter: string | undefined): boolean =>
  letter !== undefined && VOWELS.includes(letter);

/** A boy's name ending in a consonant: its vocative, or `null`. */
function boysVocative(name: string): string | null {
  const lower = name.toLowerCase();
  const last = lower.at(-1)!;
  const before = lower.at(-2);
  const stem = (drop: number): string => name.slice(0, name.length - drop);
  if (last === 'k' && (before === 'e' || before === 'ě') && !isVowel(lower.at(-3))) {
    // -ek after a consonant drops its e: Marek → Marku, Radek → Radku, Zdeněk → Zdeňku.
    const consonant = lower.at(-3)!;
    if (before === 'e') return `${stem(2)}ku`;
    const softened = SOFTENED[consonant];
    return softened === undefined ? null : `${stem(3)}${softened}ku`;
  }
  if (last === 'k' || last === 'g' || last === 'h') return `${name}u`;
  if (SOFT.includes(last)) return `${name}i`;
  if (last === 'r') return isVowel(before) ? `${name}e` : `${stem(1)}ře`;
  if (last === 'l') {
    if (before !== 'e') return `${name}e`;
    // Daniel → Danieli, Samuel → Samueli; Pavel → Pavle, Karel → Karle; others are not sure.
    if (isVowel(lower.at(-3))) return `${name}i`;
    if (lower.endsWith('avel') || lower.endsWith('arel')) return `${stem(2)}le`;
    return null;
  }
  return PLAIN.includes(last) ? `${name}e` : null;
}

/**
 * The vocative of `name` for a child addressed as `address`, or `null` when these rules are not
 * sure. Names keep their own capitals: Ema → Emo, Marie → Marie, Jan → Jane.
 */
export function suggestVocative(name: string, address: FormOfAddress): string | null {
  const text = name.normalize('NFC').trim();
  if (text === '' || /[\s'’.-]/u.test(text)) return null;
  const last = text.toLowerCase().at(-1)!;
  // Names in -a, of girls and boys alike: Klára → Kláro, Honza → Honzo.
  if (last === 'a') return `${text.slice(0, -1)}o`;
  // Other vowels stay: Marie, Lucie, Hugo, Jiří.
  if (isVowel(last)) return text;
  if (!/\p{L}/u.test(last)) return null;
  // A girl's name in a consonant stays (Nikol, Ester, Karin); a boy's declines.
  if (address === 'girl') return text;
  return address === 'boy' ? boysVocative(text) : null;
}
