/**
 * Small versioned JSON records (the family record, a child's preferences, the day record) stored
 * through the SDK's `SaveService`: validated envelopes, ordered compare-and-swap writes, a kept
 * previous copy, and explicit recovery when a stored record cannot be opened.
 */
import { SaveService } from '@aegis/browser/save';
import type { SaveMigration, SavePolicy, SaveStatus, SaveStorage } from '@aegis/browser/save';
import { recoveryFor } from './recovery';
import type { RecordKind } from './recovery';

export interface RecordDefinition<T> {
  readonly kind: RecordKind;
  readonly gameId: string;
  readonly profileId: string;
  readonly schemaVersion: number;
  /** A fixed label for the record format; these records have no content pack. */
  readonly contentRevision: string;
  /** Validates a stored state at `version` (older versions are migrated afterwards). */
  isValid(value: unknown, version: number): boolean;
  /** Validates the current schema, independently of migrations. */
  isCurrent(value: unknown): value is T;
  readonly migrations?: readonly SaveMigration[];
}

export const RECORD_MAX_BYTES = 256 * 1024;

export function recordPolicy<T>(definition: RecordDefinition<T>): SavePolicy<T, null> {
  return {
    gameId: definition.gameId,
    profileId: definition.profileId,
    schemaVersion: definition.schemaVersion,
    engineId: definition.gameId,
    engineSnapshotVersion: 1,
    acceptsContent: (revision) => revision === definition.contentRevision,
    validateState: (value, version) => definition.isValid(value, version),
    validateResume: (value): value is null => value === null,
    isCurrentState: (value): value is T => definition.isCurrent(value),
    maxBytes: RECORD_MAX_BYTES,
  };
}

export class RecordStore<T> {
  readonly policy: SavePolicy<T, null>;
  readonly service: SaveService<T, null>;

  constructor(
    readonly storage: SaveStorage,
    readonly definition: RecordDefinition<T>,
  ) {
    this.policy = recordPolicy(definition);
    this.service = new SaveService(storage, this.policy);
  }

  /** The stored value, `undefined` when nothing was stored; throws `RecoveryRequired`. */
  async load(): Promise<T | undefined> {
    try {
      const envelope = await this.service.load(this.definition.migrations ?? []);
      return envelope?.state;
    } catch (cause) {
      throw await recoveryFor(
        this.definition.kind,
        this.storage,
        this.policy,
        cause,
        async () => {},
        this.definition.migrations ?? [],
      );
    }
  }

  /** Resolves only when this exact value is durably stored. */
  async save(value: T): Promise<void> {
    await this.service.save({
      format: 'aegis.save',
      formatVersion: 1,
      gameId: this.definition.gameId,
      profileId: this.definition.profileId,
      contentRevision: this.definition.contentRevision,
      schemaVersion: this.definition.schemaVersion,
      engine: {
        id: this.definition.gameId,
        snapshotVersion: 1,
        revision: this.definition.contentRevision,
      },
      state: value,
      resume: null,
    });
  }

  /** Retry the retained failed write (not a new one). */
  async retry(): Promise<void> {
    await this.service.retry();
  }

  status(): SaveStatus {
    return this.service.status();
  }

  subscribe(listener: (status: SaveStatus) => void): () => void {
    return this.service.subscribe(listener);
  }

  /** The stored payload text, for backups. */
  async storedText(): Promise<string | undefined> {
    await this.service.flush();
    return (await this.storage.read(this.policy)).current?.payload;
  }
}
