/**
 * Schema helpers for the contract, built only on the public `@aegis/runtime` schema API.
 *
 * Every helper validates without normalising: a parsed value is byte-for-byte the input (the
 * runtime rejects state whose parse result hashes differently from the stored value). Content may
 * use `objectWithOptional` so that later content revisions can add optional fields while every
 * shipped pack in content/history stays valid under the newest schema (docs/contract.md).
 */
import { failure, isRecord, schema, success } from '@aegis/runtime';
import type { Outcome, Schema } from '@aegis/runtime';
import { CONTENT_ID_MAX_LENGTH, CONTENT_ID_PATTERN } from './ids';

/** Compile-time equality check used to keep interfaces and schemas in lock step. */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
export type Expect<T extends true> = T;

/** A stable content ID (see `CONTENT_ID_PATTERN`). */
export const contentId: Schema<string> = schema.string({
  minLength: 1,
  maxLength: CONTENT_ID_MAX_LENGTH,
  pattern: CONTENT_ID_PATTERN,
});

/**
 * A key into the catalogs (`content/catalogs/cs.*.json`; English only for `grownups.*` keys), e.g.
 * `level.sunny-lagoon.1`.
 */
export const CATALOG_KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
export const catalogKey: Schema<string> = schema.string({
  minLength: 1,
  maxLength: 128,
  pattern: CATALOG_KEY_PATTERN,
});

/**
 * An ID from the art catalog published by the art pipeline (`assets/art/catalog.json`), e.g.
 * `friend/krab-tvrdak/baby` or `scene/sunny-lagoon` (docs/contract.md §7.5).
 */
export const ART_ID_PATTERN = /^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/;
export const artId: Schema<string> = schema.string({
  minLength: 1,
  maxLength: 128,
  pattern: ART_ID_PATTERN,
});

/** A `#rrggbb` colour. */
export const hexColor: Schema<string> = schema.string({
  minLength: 7,
  maxLength: 7,
  pattern: /^#[0-9a-f]{6}$/,
});

/** An integer in `[min, max]`. */
export function int(min: number, max: number): Schema<number> {
  return schema.number({ integer: true, min, max });
}

/** A non-negative safe integer counter. */
export const counter: Schema<number> = int(0, Number.MAX_SAFE_INTEGER);

/** An integer percentage, 0..100. Content and state never store fractions. */
export const percent: Schema<number> = int(0, 100);

/** A school grade, 3 or 4 (`GRADES`). */
export const gradeSchema = int(3, 4) as Schema<3 | 4>;

/** One of a closed list of string literals. */
export function oneOf<const T extends readonly string[]>(values: T): Schema<T[number]> {
  const allowed = new Set<string>(values);
  return {
    parse(value: unknown, path = ''): Outcome<T[number]> {
      return typeof value === 'string' && allowed.has(value)
        ? success(value as T[number])
        : failure('invalid-data', `Expected one of ${values.join(', ')}.`, { path });
    },
  };
}

/** `T` or an explicit `null` (object schemas require every declared field to be present). */
export function nullable<T>(item: Schema<T>): Schema<T | null> {
  return {
    parse(value: unknown, path = ''): Outcome<T | null> {
      return value === null ? success(null) : item.parse(value, path);
    },
  };
}

/** Accept a value only if `check` returns no problem message. */
export function refine<T>(item: Schema<T>, check: (value: T) => string | null): Schema<T> {
  return {
    parse(value: unknown, path = ''): Outcome<T> {
      const parsed = item.parse(value, path);
      if (!parsed.ok) return parsed;
      const problem = check(parsed.value);
      return problem === null ? parsed : failure('invalid-data', problem, { path });
    },
  };
}

/** An array whose elements are unique (by JSON identity of strings/numbers). */
export function uniqueArray<T extends string | number>(
  item: Schema<T>,
  options: { min?: number; max?: number } = {},
): Schema<T[]> {
  return refine(schema.array(item, options), (values) =>
    new Set(values).size === values.length ? null : 'Expected unique entries.',
  );
}

/** An inclusive integer range `[low, high]` with `low <= high`. */
export function intRange(min: number, max: number): Schema<[number, number]> {
  return refine(schema.array(int(min, max), { min: 2, max: 2 }), ([low, high]) =>
    low! <= high! ? null : 'Expected [low, high] with low <= high.',
  ) as Schema<[number, number]>;
}

/** A schema resolved on first use, for recursive structures such as expression trees. */
export function lazy<T>(factory: () => Schema<T>): Schema<T> {
  let resolved: Schema<T> | undefined;
  return {
    parse(value: unknown, path = ''): Outcome<T> {
      resolved ??= factory();
      return resolved.parse(value, path);
    },
  };
}

type Shape = Record<string, Schema<unknown>>;
type Infer<S extends Shape> = {
  -readonly [K in keyof S]: S[K] extends Schema<infer V> ? V : never;
};

/**
 * An object with required fields plus optional fields that may be absent (never `undefined`).
 * Unknown fields are rejected, as with `schema.object`. Absent optional fields stay absent, so
 * a parsed value is identical to its input. Use for content records that may grow later.
 */
export function objectWithOptional<R extends Shape, O extends Shape>(
  required: R,
  optional: O,
): Schema<Infer<R> & Partial<Infer<O>>> {
  return {
    parse(value: unknown, path = '') {
      if (!isRecord(value)) return failure('invalid-data', 'Expected an object.', { path });
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(required, key) && !Object.hasOwn(optional, key)) {
          return failure('invalid-data', 'Expected a declared field.', { path: `${path}.${key}` });
        }
      }
      const result: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(required)) {
        const parsed = item.parse(value[key], `${path}.${key}`);
        if (!parsed.ok) return parsed;
        result[key] = parsed.value;
      }
      for (const [key, item] of Object.entries(optional)) {
        if (!Object.hasOwn(value, key)) continue;
        const parsed = item.parse(value[key], `${path}.${key}`);
        if (!parsed.ok) return parsed;
        result[key] = parsed.value;
      }
      return success(result as Infer<R> & Partial<Infer<O>>);
    },
  };
}

/** A record keyed by content IDs. */
export function idRecord<T>(item: Schema<T>): Schema<Record<string, T>> {
  return refine(schema.record(item), (value) => {
    const bad = Object.keys(value).find((key) => !CONTENT_ID_PATTERN.test(key));
    return bad === undefined ? null : `Record key "${bad}" is not a content ID.`;
  });
}

export { schema };
