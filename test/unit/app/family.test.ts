/**
 * The family record: name rules (Czech names welcome), up to four children in the contract's
 * fixed profile slots, how the game addresses each child, a pending grade, the grown-ups'
 * language, and strict validation of what is stored.
 */
import { describe, expect, it } from 'vitest';
import {
  addDiver,
  DIVER_AVATARS,
  EMPTY_FAMILY,
  FAMILY_RECORD,
  findDiver,
  GRADES,
  isFamilyState,
  MAX_DIVERS,
  MAX_NAME_LENGTH,
  normalizeName,
  removeDiver,
  setPendingGrade,
  updateDiver,
  withGrownUpsLanguage,
} from '../../../src/app/persistence/family';
import type { DiverAvatar, FamilyState, Grade } from '../../../src/app/persistence/family';
import type { Address, Language } from '../../../src/app/i18n/messages';
import {
  FAMILY_GAME_ID,
  FAMILY_PROFILE_ID,
  MAX_PROFILE_NAME_LENGTH,
  MAX_PROFILES,
  PROFILE_IDS,
} from '../../../src/rules/contract';

function family(...names: string[]): FamilyState {
  let state = EMPTY_FAMILY;
  for (const name of names) {
    const result = addDiver(state, { name, avatar: 'diver-1', address: 'neutral' });
    if (!result.ok) throw new Error(result.problem);
    state = result.value.state;
  }
  return state;
}

describe('names', () => {
  it('tidies spaces and keeps Czech letters', () => {
    expect(normalizeName('  Šárka   Nováková ')).toEqual({ ok: true, name: 'Šárka Nováková' });
    expect(normalizeName('Jiří')).toEqual({ ok: true, name: 'Jiří' });
    expect(normalizeName('Ťapka Ďáblová')).toEqual({ ok: true, name: 'Ťapka Ďáblová' });
    expect(normalizeName("O'Brien-Smith")).toEqual({ ok: true, name: "O'Brien-Smith" });
  });

  it('normalises to NFC, so the same name typed two ways is the same name', () => {
    const decomposed = 'S\u030carka';
    expect(normalizeName(decomposed)).toEqual({ ok: true, name: 'Šarka' });
  });

  it('rejects empty, too long and symbol names, counting letters rather than code units', () => {
    expect(MAX_NAME_LENGTH).toBe(MAX_PROFILE_NAME_LENGTH);
    expect(normalizeName('   ')).toEqual({ ok: false, problem: 'empty' });
    expect(normalizeName('Ř'.repeat(MAX_NAME_LENGTH))).toEqual({
      ok: true,
      name: 'Ř'.repeat(MAX_NAME_LENGTH),
    });
    expect(normalizeName('a'.repeat(MAX_NAME_LENGTH + 1))).toEqual({ ok: false, problem: 'long' });
    expect(normalizeName('<b>')).toEqual({ ok: false, problem: 'chars' });
    expect(normalizeName('-Ann')).toEqual({ ok: false, problem: 'chars' });
    expect(normalizeName('Ema🐠')).toEqual({ ok: false, problem: 'chars' });
  });
});

describe('children on the device', () => {
  it('take the first free profile slot, and a removed slot is offered again', () => {
    let state = family('Ema', 'Ben', 'Cyril');
    expect(state.profiles.map((diver) => diver.id)).toEqual([
      'profile-1',
      'profile-2',
      'profile-3',
    ]);
    const removed = removeDiver(state, 'profile-2');
    if (!removed.ok) throw new Error('remove failed');
    state = removed.value;
    const added = addDiver(state, { name: 'Dana', avatar: 'diver-4', address: 'girl' });
    if (!added.ok) throw new Error('add failed');
    expect(added.value.diver.id).toBe('profile-2');
    // Cards keep slot order, so a returning slot does not jump to the end.
    expect(added.value.state.profiles.map((diver) => diver.name)).toEqual(['Ema', 'Dana', 'Cyril']);
  });

  it('are at most four', () => {
    expect(MAX_DIVERS).toBe(MAX_PROFILES);
    const state = family('Ema', 'Ben', 'Cyril', 'Dana');
    expect(state.profiles.map((diver) => diver.id)).toEqual([...PROFILE_IDS]);
    expect(addDiver(state, { name: 'Eva', avatar: 'diver-2', address: 'girl' })).toEqual({
      ok: false,
      problem: 'full',
    });
  });

  it('never share a name, ignoring letter case', () => {
    expect(addDiver(family('Ema'), { name: 'EMA', avatar: 'diver-2', address: 'girl' })).toEqual({
      ok: false,
      problem: 'taken',
    });
  });

  it('are addressed as a boy, a girl or neutrally, and the editor can change it', () => {
    const added = addDiver(EMPTY_FAMILY, { name: 'Tomáš', avatar: 'diver-3', address: 'boy' });
    if (!added.ok) throw new Error('add failed');
    expect(added.value.diver).toEqual({
      id: 'profile-1',
      name: 'Tomáš',
      avatar: 'diver-3',
      address: 'boy',
    });
    const changed = updateDiver(added.value.state, 'profile-1', {
      name: 'Tomáš',
      avatar: 'diver-3',
      address: 'neutral',
    });
    expect(changed.ok && changed.value.diver.address).toBe('neutral');
    expect(
      addDiver(EMPTY_FAMILY, { name: 'Ema', avatar: 'diver-1', address: 'other' as Address }),
    ).toEqual({ ok: false, problem: 'address' });
  });

  it('rename and change their picture, but not into another child’s name', () => {
    const state = family('Ema', 'Ben');
    const renamed = updateDiver(state, 'profile-1', {
      name: 'Emička',
      avatar: 'diver-5',
      address: 'girl',
    });
    if (!renamed.ok) throw new Error('rename failed');
    expect(findDiver(renamed.value.state, 'profile-1')).toEqual({
      id: 'profile-1',
      name: 'Emička',
      avatar: 'diver-5',
      address: 'girl',
    });
    expect(
      updateDiver(state, 'profile-1', { name: 'ben', avatar: 'diver-1', address: 'neutral' }),
    ).toEqual({ ok: false, problem: 'taken' });
    // Keeping one's own name with different letter case is fine.
    expect(
      updateDiver(state, 'profile-1', { name: 'EMA', avatar: 'diver-1', address: 'neutral' }).ok,
    ).toBe(true);
    expect(
      updateDiver(state, 'profile-4', { name: 'Zoe', avatar: 'diver-1', address: 'neutral' }),
    ).toEqual({ ok: false, problem: 'missing' });
  });

  it('choose from the eight diver pictures only', () => {
    expect(DIVER_AVATARS).toHaveLength(8);
    expect(
      addDiver(EMPTY_FAMILY, {
        name: 'Ema',
        avatar: 'diver-9' as DiverAvatar,
        address: 'girl',
      }),
    ).toEqual({ ok: false, problem: 'avatar' });
  });

  it('carry the editor’s grade, 3 or 4, until the game takes it', () => {
    expect(GRADES).toEqual([3, 4]);
    const added = addDiver(EMPTY_FAMILY, {
      name: 'Ema',
      avatar: 'diver-1',
      address: 'girl',
      grade: 4,
    });
    if (!added.ok) throw new Error('add failed');
    expect(added.value.diver.grade).toBe(4);
    const dropped = setPendingGrade(added.value.state, 'profile-1', null);
    if (!dropped.ok) throw new Error('drop failed');
    expect(dropped.value.diver).toEqual({
      id: 'profile-1',
      name: 'Ema',
      avatar: 'diver-1',
      address: 'girl',
    });
    expect(isFamilyState(dropped.value.state)).toBe(true);
    expect(setPendingGrade(added.value.state, 'profile-1', 5 as Grade)).toEqual({
      ok: false,
      problem: 'grade',
    });
    expect(
      addDiver(EMPTY_FAMILY, {
        name: 'Ema',
        avatar: 'diver-1',
        address: 'girl',
        grade: 2 as Grade,
      }),
    ).toEqual({ ok: false, problem: 'grade' });
  });

  it('cannot be removed when they are not there', () => {
    expect(removeDiver(family('Ema'), 'profile-3')).toEqual({ ok: false, problem: 'missing' });
  });
});

describe('the grown-ups’ language', () => {
  it('starts Czech and switches to English, keeping the children', () => {
    const state = family('Ema');
    expect(state.grownUpsLanguage).toBe('cs');
    const english = withGrownUpsLanguage(state, 'en');
    expect(english).toEqual({ profiles: state.profiles, grownUpsLanguage: 'en' });
    expect(() => withGrownUpsLanguage(state, 'de' as Language)).toThrow(RangeError);
  });
});

describe('stored family validation', () => {
  it('stores the record under the contract identity', () => {
    expect(FAMILY_RECORD.gameId).toBe(FAMILY_GAME_ID);
    expect(FAMILY_RECORD.profileId).toBe(FAMILY_PROFILE_ID);
  });

  it('accepts what the operations produce', () => {
    expect(isFamilyState(EMPTY_FAMILY)).toBe(true);
    expect(isFamilyState(family('Ema', 'Šárka', 'Jiří', 'Dana'))).toBe(true);
    expect(isFamilyState(withGrownUpsLanguage(family('Ema'), 'en'))).toBe(true);
  });

  it('rejects tampered records', () => {
    const ema = { id: 'profile-1', name: 'Ema', avatar: 'diver-1', address: 'girl' };
    const of = (...profiles: unknown[]) => ({ profiles, grownUpsLanguage: 'cs' });
    const cases: unknown[] = [
      null,
      [],
      {},
      { profiles: [] },
      { profiles: [], grownUpsLanguage: 'de' },
      { profiles: {}, grownUpsLanguage: 'cs' },
      { ...of(), extra: 1 },
      of({ ...ema, id: 'profile-5' }),
      of({ ...ema, id: 'child-1' }),
      of(ema, { ...ema, name: 'Ben' }),
      of(ema, { ...ema, id: 'profile-2', name: 'ema' }),
      of({ ...ema, name: ' Ema' }),
      of({ ...ema, name: 'a'.repeat(MAX_NAME_LENGTH + 1) }),
      of({ ...ema, avatar: 'keeper-1' }),
      of({ ...ema, address: 'female' }),
      of({ id: 'profile-1', name: 'Ema', avatar: 'diver-1' }),
      of({ ...ema, grade: 2 }),
      of({ ...ema, seed: 'pearl-sea:profile-1' }),
      of(
        ...['profile-1', 'profile-2', 'profile-3', 'profile-4', 'profile-4'].map((id, index) => ({
          ...ema,
          id,
          name: `Dítě ${index}`,
        })),
      ),
    ];
    for (const value of cases) expect(isFamilyState(value), JSON.stringify(value)).toBe(false);
  });
});
