/**
 * The family record: up to four children (divers) on this device, in the contract's fixed
 * profile slots `profile-1` … `profile-4`, and the language of the grown-ups' area. A new child
 * takes the first free slot; removing a child erases that slot's game, preferences and day
 * records first, and the storage service's revision tombstones keep a stale window from writing
 * into a reused slot. Names, pictures and how the game addresses a child live only here, never in
 * game state.
 *
 * - `address`: kluk (`boy`), holka (`girl`) or neither (`neutral`), the contract's
 *   `FORMS_OF_ADDRESS`, for grammatical praise (i18n/messages.ts). It is presentation: it never
 *   enters a game hash.
 * - `avatar`: one of the contract's `DIVER_AVATARS` (S5 paints them as `avatar/<diver-n>`).
 * - `grade`: the class chosen in the editor before the child's game save exists. The game takes
 *   it at the first session and the profile drops it, so the save stays the only lasting home of
 *   a child's grade.
 * - `grownUpsLanguage`: Czech or English for the grown-ups' area. The child's game is Czech.
 */
import {
  DIVER_AVATARS,
  FAMILY_GAME_ID,
  FAMILY_PROFILE_ID,
  FORMS_OF_ADDRESS,
  GRADES,
  MAX_PROFILE_NAME_LENGTH,
  MAX_PROFILES,
  PROFILE_IDS,
} from '../../rules/contract';
import type { DiverAvatar, FormOfAddress, Grade, ProfileId } from '../../rules/contract';
import { isLanguage } from '../i18n/messages';
import type { Language } from '../i18n/messages';
import type { RecordDefinition } from './records';

export const MAX_DIVERS = MAX_PROFILES;
export const MAX_NAME_LENGTH = MAX_PROFILE_NAME_LENGTH;
export const FAMILY_SCHEMA_VERSION = 1;

export interface Diver {
  readonly id: ProfileId;
  readonly name: string;
  readonly avatar: DiverAvatar;
  /** How the game addresses this child: as a boy, a girl, or in neutral phrasing. */
  readonly address: FormOfAddress;
  /** The grade chosen before the game save exists; handed to the game at the first session. */
  readonly grade?: Grade;
}

export interface FamilyState {
  readonly profiles: readonly Diver[];
  /** The language of the grown-ups' area. */
  readonly grownUpsLanguage: Language;
}

export type NameProblem = 'empty' | 'long' | 'chars' | 'taken';
export type FamilyProblem = NameProblem | 'full' | 'missing' | 'avatar' | 'address' | 'grade';
export type FamilyResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: FamilyProblem };

export const EMPTY_FAMILY: FamilyState = { profiles: [], grownUpsLanguage: 'cs' };

const NAME_PATTERN = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '’.-]*$/u;

/** Tidy a typed name (Unicode NFC, single spaces, trimmed) and check it. */
export function normalizeName(
  raw: string,
):
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly problem: NameProblem } {
  const name = raw.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (name === '') return { ok: false, problem: 'empty' };
  if ([...name].length > MAX_NAME_LENGTH) return { ok: false, problem: 'long' };
  if (!NAME_PATTERN.test(name)) return { ok: false, problem: 'chars' };
  return { ok: true, name };
}

function sameName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function isDiverAvatar(value: unknown): value is DiverAvatar {
  return typeof value === 'string' && (DIVER_AVATARS as readonly string[]).includes(value);
}

export function isFormOfAddress(value: unknown): value is FormOfAddress {
  return typeof value === 'string' && (FORMS_OF_ADDRESS as readonly string[]).includes(value);
}

export function isGrade(value: unknown): value is Grade {
  return typeof value === 'number' && (GRADES as readonly number[]).includes(value);
}

export function isProfileId(value: unknown): value is ProfileId {
  return typeof value === 'string' && (PROFILE_IDS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: object, keys: readonly string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
}

const DIVER_KEYS = ['id', 'name', 'avatar', 'address'];

export function isFamilyState(value: unknown): value is FamilyState {
  if (!isRecord(value) || !hasExactKeys(value, ['profiles', 'grownUpsLanguage'])) return false;
  if (!isLanguage(value['grownUpsLanguage'])) return false;
  const profiles = value['profiles'];
  if (!Array.isArray(profiles) || profiles.length > MAX_DIVERS) return false;
  const ids = new Set<string>();
  const names: string[] = [];
  for (const diver of profiles as unknown[]) {
    if (!isRecord(diver)) return false;
    const withGrade = 'grade' in diver;
    if (!hasExactKeys(diver, withGrade ? [...DIVER_KEYS, 'grade'] : DIVER_KEYS)) return false;
    const { id, name, avatar, address, grade } = diver;
    if (withGrade && !isGrade(grade)) return false;
    if (!isProfileId(id) || ids.has(id) || typeof name !== 'string') return false;
    const normalized = normalizeName(name);
    if (!normalized.ok || normalized.name !== name) return false;
    if (names.some((other) => sameName(other, name))) return false;
    if (!isDiverAvatar(avatar) || !isFormOfAddress(address)) return false;
    ids.add(id);
    names.push(name);
  }
  return true;
}

export function findDiver(state: FamilyState, id: string): Diver | undefined {
  return state.profiles.find((diver) => diver.id === id);
}

/** Children in slot order, so cards keep their places when one is removed. */
function ordered(profiles: readonly Diver[]): Diver[] {
  return [...profiles].sort((a, b) => PROFILE_IDS.indexOf(a.id) - PROFILE_IDS.indexOf(b.id));
}

export interface DiverInput {
  readonly name: string;
  readonly avatar: DiverAvatar;
  readonly address: FormOfAddress;
}

function checkInput(
  state: FamilyState,
  input: DiverInput,
  self?: string,
): FamilyResult<{ name: string }> {
  const normalized = normalizeName(input.name);
  if (!normalized.ok) return normalized;
  if (state.profiles.some((diver) => diver.id !== self && sameName(diver.name, normalized.name))) {
    return { ok: false, problem: 'taken' };
  }
  if (!isDiverAvatar(input.avatar)) return { ok: false, problem: 'avatar' };
  if (!isFormOfAddress(input.address)) return { ok: false, problem: 'address' };
  return { ok: true, value: { name: normalized.name } };
}

export function addDiver(
  state: FamilyState,
  input: DiverInput & { readonly grade?: Grade },
): FamilyResult<{ state: FamilyState; diver: Diver }> {
  const slot = PROFILE_IDS.find((id) => !findDiver(state, id));
  if (!slot) return { ok: false, problem: 'full' };
  const checked = checkInput(state, input);
  if (!checked.ok) return checked;
  if (input.grade !== undefined && !isGrade(input.grade)) return { ok: false, problem: 'grade' };
  const diver: Diver = {
    id: slot,
    name: checked.value.name,
    avatar: input.avatar,
    address: input.address,
    ...(input.grade !== undefined ? { grade: input.grade } : {}),
  };
  return {
    ok: true,
    value: { state: { ...state, profiles: ordered([...state.profiles, diver]) }, diver },
  };
}

export function updateDiver(
  state: FamilyState,
  id: string,
  input: DiverInput,
): FamilyResult<{ state: FamilyState; diver: Diver }> {
  const current = findDiver(state, id);
  if (!current) return { ok: false, problem: 'missing' };
  const checked = checkInput(state, input, id);
  if (!checked.ok) return checked;
  const diver: Diver = {
    ...current,
    name: checked.value.name,
    avatar: input.avatar,
    address: input.address,
  };
  return {
    ok: true,
    value: {
      state: {
        ...state,
        profiles: state.profiles.map((other) => (other.id === id ? diver : other)),
      },
      diver,
    },
  };
}

/** Set or drop (`null`) a child's pending grade. */
export function setPendingGrade(
  state: FamilyState,
  id: string,
  grade: Grade | null,
): FamilyResult<{ state: FamilyState; diver: Diver }> {
  const current = findDiver(state, id);
  if (!current) return { ok: false, problem: 'missing' };
  if (grade !== null && !isGrade(grade)) return { ok: false, problem: 'grade' };
  const rest: Diver = {
    id: current.id,
    name: current.name,
    avatar: current.avatar,
    address: current.address,
  };
  const diver: Diver = grade === null ? rest : { ...rest, grade };
  return {
    ok: true,
    value: {
      state: {
        ...state,
        profiles: state.profiles.map((other) => (other.id === id ? diver : other)),
      },
      diver,
    },
  };
}

export function removeDiver(state: FamilyState, id: string): FamilyResult<FamilyState> {
  if (!findDiver(state, id)) return { ok: false, problem: 'missing' };
  return {
    ok: true,
    value: { ...state, profiles: state.profiles.filter((diver) => diver.id !== id) },
  };
}

export function withGrownUpsLanguage(state: FamilyState, language: Language): FamilyState {
  if (!isLanguage(language)) throw new RangeError('Unknown language.');
  return { ...state, grownUpsLanguage: language };
}

export const FAMILY_RECORD: RecordDefinition<FamilyState> = {
  kind: 'family',
  gameId: FAMILY_GAME_ID,
  profileId: FAMILY_PROFILE_ID,
  schemaVersion: FAMILY_SCHEMA_VERSION,
  contentRevision: 'family-1',
  isValid: (value) => isFamilyState(value),
  isCurrent: isFamilyState,
};
