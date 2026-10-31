/**
 * The shell's messages: `content/catalogs/cs.ui.json` (every string of the game) and
 * `en.ui.json` (only the grown-ups' area, keys `grownups.*`), bundled at build time so each key is
 * a compile-time type, and read through the SDK's `createMessages`, which refuses missing keys
 * and missing placeholder values instead of inventing text.
 *
 * Czech grammar is part of the catalog format: the contract's convention (docs/contract.md §7.4,
 * `catalogs.ts`, checked by `catalogProblems` in `npm run verify`):
 *
 * - **Plurals.** A message about a count has the keys `<key>.one` (1), `<key>.few` (2-4) and
 *   `<key>.other` (0, 5 and more): "1 mince", "3 mince", "5 mincí" (`czechPlural`). English, for
 *   grown-ups only, has `.one` and `.other` (`englishPlural`). `t.plural(key, count)` picks the
 *   form and passes the count as `{count}`. Counts are whole numbers.
 * - **Address.** A child's profile says kluk (boy), holka (girl) or neither (`FORMS_OF_ADDRESS`).
 *   A message that addresses the child in a gendered form keeps a neutral phrasing under its bare
 *   key and may add the pair `<key>.boy` and `<key>.girl` ("Dokázal jsi to!", "Dokázala jsi
 *   to!"). The translator picks the form for the child playing now, and the neutral phrasing for
 *   anyone else. Plural and address combine as `<key>.<plural>.<address>`.
 * - **Typography.** A one-letter preposition or conjunction is bound to the next word with a
 *   no-break space in every Czech string the translator returns (typography.ts).
 */
import { createMessages } from '@aegis/browser/ui';
import cs from '../../../content/catalogs/cs.ui.json' with { type: 'json' };
import en from '../../../content/catalogs/en.ui.json' with { type: 'json' };
import { czechPlural, englishPlural } from '../../rules/contract';
import type { FormOfAddress, GROWN_UPS_KEY_PREFIX } from '../../rules/contract';
import { keepOneLetterWordsWithNext } from './typography';

export type MessageKey = keyof typeof cs;
/** Keys of the grown-ups' area, the only part of the game that can be shown in English. */
export type GrownUpKey = Extract<MessageKey, `${typeof GROWN_UPS_KEY_PREFIX}${string}`>;
type PluralBase<K> = K extends `${infer Base}.other` ? Base : never;
/** Bases of messages about a count (`coins.label` for `coins.label.one`, `.few`, `.other`). */
export type PluralKey = PluralBase<MessageKey>;
export type GrownUpPluralKey = Extract<PluralKey, `${typeof GROWN_UPS_KEY_PREFIX}${string}`>;

export type Catalog = Readonly<Record<string, string>>;
export type MessageValues = Readonly<Record<string, string | number>>;

export const CS_UI: Catalog = cs;
export const EN_UI: Catalog = en;

/** The child's game is always Czech; the grown-ups' area is Czech or English. */
export const LANGUAGES = ['cs', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export interface Translator<K extends string, P extends string> {
  (key: K, values?: MessageValues): string;
  /** The form of `key` for `count`, which the message receives as `{count}`. */
  plural(key: P, count: number, values?: MessageValues): string;
  readonly language: Language;
}

/** The child-facing translator: Czech, addressing the child playing now. */
export type Translate = Translator<MessageKey, PluralKey>;
/** The grown-ups' translator, in the language the family chose for the grown-ups' area. */
export type GrownUpTranslate = Translator<GrownUpKey, GrownUpPluralKey>;

export interface TranslatorOptions {
  readonly catalog?: Catalog;
  readonly language?: Language;
  /** Whom the messages address now; neutral when nobody is playing. */
  readonly address?: () => FormOfAddress;
  /** Where a key the catalog lacks is looked up instead (English falls back to Czech). */
  readonly fallback?: { readonly catalog: Catalog; readonly language: Language };
}

function strings(values: MessageValues | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(values ?? {})) result[name] = String(value);
  return result;
}

function translator<K extends string, P extends string>(
  options: TranslatorOptions,
): Translator<K, P> {
  const catalog = options.catalog ?? CS_UI;
  const language = options.language ?? 'cs';
  const address = options.address ?? ((): FormOfAddress => 'neutral');
  const sources = [
    { catalog, language, message: createMessages(catalog) },
    ...(options.fallback
      ? [{ ...options.fallback, message: createMessages(options.fallback.catalog) }]
      : []),
  ];

  const lookup = (key: string, values?: MessageValues): string => {
    const source =
      sources.find((candidate) => Object.hasOwn(candidate.catalog, key)) ?? sources[0]!;
    const who = address();
    const variant = who === 'neutral' ? key : `${key}.${who}`;
    const chosen = Object.hasOwn(source.catalog, variant) ? variant : key;
    const text = source.message(chosen, strings(values));
    return source.language === 'cs' ? keepOneLetterWordsWithNext(text) : text;
  };

  const plural = (key: P, count: number, values: MessageValues = {}): string =>
    lookup(`${key}.${language === 'cs' ? czechPlural(count) : englishPlural(count)}`, {
      ...values,
      count,
    });

  return Object.assign((key: K, values?: MessageValues) => lookup(key, values), {
    plural,
    language,
  });
}

export function createTranslator(options: TranslatorOptions = {}): Translate {
  return translator<MessageKey, PluralKey>(options);
}

export function createGrownUpTranslator(language: Language): GrownUpTranslate {
  return translator<GrownUpKey, GrownUpPluralKey>(
    language === 'en'
      ? { catalog: EN_UI, language: 'en', fallback: { catalog: CS_UI, language: 'cs' } }
      : { catalog: CS_UI, language: 'cs' },
  );
}

/** Whether a key built at runtime (for example `error.<code>`) is in the Czech catalog. */
export function hasMessage(key: string): key is MessageKey {
  return Object.hasOwn(CS_UI, key);
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}
