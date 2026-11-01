/**
 * Strict decoders for the custom minigame adapters. They throw the narrative package's
 * `ToolkitError` (code `AEG-NARRATIVE-PS-BOARD`), as the built-in adapters do, so the rules can
 * reject an illegal move without changing anything.
 */
import { ToolkitError } from '@aegis/narrative';

export function invalid(path: string, message: string): never {
  throw new ToolkitError('PS-BOARD', path, message, 'Use a value this board allows.');
}

export function object(
  value: unknown,
  path: string,
  keys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid(path, 'Expected an object.');
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!keys.includes(key)) invalid(`${path}.${key}`, 'Unexpected field.');
  }
  return record;
}

export function integer(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    invalid(path, `Expected an integer in ${min}..${max}.`);
  }
  return value;
}

export function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalid(path, 'Expected a boolean.');
  return value;
}

export function text(value: unknown, path: string, max = 128): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    invalid(path, `Expected a text of 1..${max} characters.`);
  }
  return value;
}

export function nullableText(value: unknown, path: string, max = 128): string | null {
  return value === null ? null : text(value, path, max);
}

export function literal<const T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    invalid(path, `Expected one of ${allowed.join(', ')}.`);
  }
  return value as T;
}

export function nullableLiteral<const T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
): T | null {
  return value === null ? null : literal(value, path, allowed);
}

export function array(value: unknown, path: string, length: { min: number; max: number }) {
  if (!Array.isArray(value) || value.length < length.min || value.length > length.max) {
    invalid(path, `Expected an array of ${length.min}..${length.max} entries.`);
  }
  return value as unknown[];
}

/** Integer or `null`. */
export function nullableInteger(
  value: unknown,
  path: string,
  min: number,
  max: number,
): number | null {
  return value === null ? null : integer(value, path, min, max);
}

/** Unique strings. */
export function uniqueTexts(values: readonly string[], path: string): void {
  if (new Set(values).size !== values.length) invalid(path, 'Expected unique entries.');
}
