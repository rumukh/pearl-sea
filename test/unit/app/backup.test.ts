/**
 * Backup files hold one child. Reading one is strict (a Dragon Valley backup is not ours), and
 * envelopes are rebound to the child they are loaded into (their contents are then validated
 * like a fresh load).
 */
import { describe, expect, it } from 'vitest';
import {
  BACKUP_MAX_BYTES,
  BackupError,
  createBackup,
  readBackup,
  rebind,
} from '../../../src/app/persistence/backup';
import { BACKUP_FORMAT } from '../../../src/rules/contract';

const game = JSON.stringify({ format: 'aegis.save', profileId: 'profile-1', revision: 3 });
const preferences = JSON.stringify({ format: 'aegis.save', profileId: 'profile-1', revision: 1 });
const SARKA = { name: 'Šárka', avatar: 'diver-5', address: 'girl' } as const;

describe('backup files', () => {
  it('round-trip a child with their game and preferences', () => {
    const text = createBackup(SARKA, game, preferences);
    const backup = readBackup(text);
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.diver).toEqual(SARKA);
    expect(backup.game).toEqual(JSON.parse(game));
    expect(backup.preferences).toEqual(JSON.parse(preferences));
  });

  it('allow a child who has not saved a game yet', () => {
    const backup = readBackup(
      createBackup({ name: 'Tom', avatar: 'diver-1', address: 'boy' }, undefined, undefined),
    );
    expect(backup.game).toBeNull();
    expect(backup.preferences).toBeNull();
  });

  it('refuse anything that is not a backup of this format', () => {
    const valid = JSON.parse(createBackup(SARKA, game, undefined));
    const cases: [string, BackupError['code']][] = [
      ['not json', 'not-a-backup'],
      ['[]', 'not-a-backup'],
      [JSON.stringify({ ...valid, format: 'dragon-valley-backup' }), 'not-a-backup'],
      [JSON.stringify({ ...valid, version: 2 }), 'unsupported'],
      [JSON.stringify({ ...valid, diver: { ...SARKA, avatar: 'keeper-1' } }), 'not-a-backup'],
      [JSON.stringify({ ...valid, diver: { ...SARKA, address: 'female' } }), 'not-a-backup'],
      [JSON.stringify({ ...valid, diver: { name: 7, avatar: 'diver-1' } }), 'not-a-backup'],
      [JSON.stringify({ ...valid, game: [1, 2] }), 'not-a-backup'],
      ['x'.repeat(BACKUP_MAX_BYTES + 1), 'too-large'],
    ];
    for (const [text, code] of cases) {
      const error = (() => {
        try {
          readBackup(text);
        } catch (cause) {
          return cause;
        }
        return undefined;
      })();
      expect(error, text.slice(0, 60)).toBeInstanceOf(BackupError);
      expect((error as BackupError).code, text.slice(0, 60)).toBe(code);
    }
  });

  it('rebind an envelope to the child it is loaded into', () => {
    expect(JSON.parse(rebind(JSON.parse(game), 'profile-4'))).toEqual({
      format: 'aegis.save',
      profileId: 'profile-4',
      revision: 3,
    });
    expect(() => rebind(null, 'profile-4')).toThrow(BackupError);
  });
});
