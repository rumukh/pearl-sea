/**
 * One child's backup file: who it was made for (name, picture, how the game addressed them) and
 * the game save and preferences envelopes, exactly as stored. Envelopes are bound to a profile
 * ID, so loading a backup into a child (or onto another device) rebinds them to that child's
 * ID; the stored state itself is then validated as strictly as a normal load.
 *
 * Files are named `pearl-sea-<name>-<day>.json` and carry the contract's `BACKUP_FORMAT`, so a
 * Dragon Valley backup on the same family computer is never mistaken for one of ours.
 */
import { parseBoundedJson } from '@aegis/browser/save';
import { BACKUP_FORMAT } from '../../rules/contract';
import { isAddress } from '../i18n/messages';
import type { Address } from '../i18n/messages';
import { isDiverAvatar } from './family';
import type { DiverAvatar } from './family';

export const BACKUP_VERSION = 1;
export const BACKUP_MAX_BYTES = 4 * 1024 * 1024;

export interface BackupDiver {
  readonly name: string;
  readonly avatar: DiverAvatar;
  readonly address: Address;
}

export interface BackupFile {
  readonly format: typeof BACKUP_FORMAT;
  readonly version: typeof BACKUP_VERSION;
  readonly diver: BackupDiver;
  /** The game save envelope as stored, or null when the child has no saved game yet. */
  readonly game: unknown;
  /** The preferences envelope as stored, or null. */
  readonly preferences: unknown;
}

export class BackupError extends Error {
  constructor(readonly code: 'not-a-backup' | 'too-large' | 'unsupported') {
    super(`Backup rejected: ${code}`);
    this.name = 'BackupError';
  }
}

export function createBackup(
  diver: BackupDiver,
  gamePayload: string | undefined,
  preferencesPayload: string | undefined,
): string {
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    diver: { name: diver.name, avatar: diver.avatar, address: diver.address },
    game: gamePayload === undefined ? null : JSON.parse(gamePayload),
    preferences: preferencesPayload === undefined ? null : JSON.parse(preferencesPayload),
  };
  return JSON.stringify(file, null, 2) + '\n';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readBackup(text: string): BackupFile {
  if (new TextEncoder().encode(text).byteLength > BACKUP_MAX_BYTES) {
    throw new BackupError('too-large');
  }
  let value: unknown;
  try {
    value = parseBoundedJson(text, BACKUP_MAX_BYTES);
  } catch {
    throw new BackupError('not-a-backup');
  }
  if (!isRecord(value) || value['format'] !== BACKUP_FORMAT) {
    throw new BackupError('not-a-backup');
  }
  if (value['version'] !== BACKUP_VERSION) throw new BackupError('unsupported');
  const diver = value['diver'];
  if (
    !isRecord(diver) ||
    typeof diver['name'] !== 'string' ||
    !isDiverAvatar(diver['avatar']) ||
    !isAddress(diver['address'])
  ) {
    throw new BackupError('not-a-backup');
  }
  const game = value['game'] ?? null;
  const preferences = value['preferences'] ?? null;
  for (const envelope of [game, preferences]) {
    if (envelope !== null && !isRecord(envelope)) throw new BackupError('not-a-backup');
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    diver: { name: diver['name'], avatar: diver['avatar'], address: diver['address'] },
    game,
    preferences,
  };
}

/** The envelope as JSON text, bound to `profileId`; validation happens on import. */
export function rebind(envelope: unknown, profileId: string): string {
  if (!isRecord(envelope)) throw new BackupError('not-a-backup');
  return JSON.stringify({ ...envelope, profileId });
}
