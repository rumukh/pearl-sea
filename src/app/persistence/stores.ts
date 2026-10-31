/**
 * Live stores over the small records: the family record and one child's preferences.
 *
 * A write either becomes the new state or fails without changing it. After a failed write the
 * store re-reads what storage actually holds, so the next change starts from the truth (and the
 * SDK service's retained failure is cleared by that explicit load).
 *
 * Opens and changes take turns, in the order they were asked for, and each change is worked out
 * from the last saved state when its turn comes, never from the state at the moment it was asked
 * for. Two quick changes (a grown-up tapping two switches before the first is on disk, or adding
 * two children) therefore both stay, in order.
 */
import type { SaveStorage } from '@aegis/browser/save';
import type { Grade } from '../../rules/contract';
import type { Language } from '../i18n/messages';
import {
  addDiver,
  EMPTY_FAMILY,
  FAMILY_RECORD,
  removeDiver,
  setPendingGrade,
  updateDiver,
  withGrownUpsLanguage,
} from './family';
import type { Diver, DiverInput, FamilyResult, FamilyState } from './family';
import { DEFAULT_PREFERENCES, preferencesRecord, withPreferences } from './preferences';
import type { ChildPreferences } from './preferences';
import { RecordStore } from './records';

/** What one change stores (nothing without `next`) and what it answers. */
interface Change<T, R> {
  readonly next?: T;
  readonly result: R;
}

class LiveRecord<T> {
  private value: T;
  private turn: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<(value: T) => void>();

  constructor(
    readonly record: RecordStore<T>,
    private readonly fallback: T,
  ) {
    this.value = fallback;
  }

  current(): T {
    return this.value;
  }

  /** Throws `RecoveryRequired` when the stored record cannot be opened. */
  open(): Promise<T> {
    return this.inTurn(async () => {
      this.value = (await this.record.load()) ?? this.fallback;
      this.notify();
      return this.value;
    });
  }

  /**
   * One read-modify-write, planned from the last saved value when its turn comes. The plan must
   * not wait for another open or change of the same record: that would wait for itself.
   */
  change<R>(plan: (current: T) => Change<T, R> | Promise<Change<T, R>>): Promise<R> {
    return this.inTurn(async () => {
      const { next, result } = await plan(this.value);
      if (next !== undefined) await this.write(next);
      return result;
    });
  }

  subscribe(listener: (value: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private inTurn<R>(task: () => Promise<R>): Promise<R> {
    const run = this.turn.then(task);
    // A failed turn has already answered its own caller; the next one still runs.
    this.turn = run.catch(() => undefined);
    return run;
  }

  private async write(next: T): Promise<void> {
    try {
      await this.record.save(next);
      this.value = next;
      this.notify();
    } catch (error) {
      try {
        this.value = (await this.record.load()) ?? this.fallback;
        this.notify();
      } catch {
        // The record will ask for recovery the next time it is opened.
      }
      throw error;
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.value);
  }
}

/** A family change that passed validation stores its new state and answers with the child. */
function storedDiver(
  result: FamilyResult<{ state: FamilyState; diver: Diver }>,
): Change<FamilyState, FamilyResult<Diver>> {
  return result.ok
    ? { next: result.value.state, result: { ok: true, value: result.value.diver } }
    : { result };
}

export class FamilyStore {
  private readonly live: LiveRecord<FamilyState>;

  constructor(storage: SaveStorage) {
    this.live = new LiveRecord(new RecordStore(storage, FAMILY_RECORD), EMPTY_FAMILY);
  }

  get record(): RecordStore<FamilyState> {
    return this.live.record;
  }

  state(): FamilyState {
    return this.live.current();
  }

  open(): Promise<FamilyState> {
    return this.live.open();
  }

  subscribe(listener: (state: FamilyState) => void): () => void {
    return this.live.subscribe(listener);
  }

  /** Validation problems come back as values; storage failures throw. */
  add(input: DiverInput & { readonly grade?: Grade }): Promise<FamilyResult<Diver>> {
    return this.live.change((state) => storedDiver(addDiver(state, input)));
  }

  update(id: string, input: DiverInput): Promise<FamilyResult<Diver>> {
    return this.live.change((state) => storedDiver(updateDiver(state, id, input)));
  }

  /** Set or drop (`null`) the grade a child carries until their game save has it. */
  setPendingGrade(id: string, grade: Grade | null): Promise<FamilyResult<Diver>> {
    return this.live.change((state) => storedDiver(setPendingGrade(state, id, grade)));
  }

  /**
   * Erase the child's own records first (privacy), then drop them from the list. The erasing
   * runs in the family's turn, so it must not change the family itself.
   */
  remove(id: string, eraseRecords: () => Promise<void>): Promise<FamilyResult<FamilyState>> {
    return this.live.change(
      async (state): Promise<Change<FamilyState, FamilyResult<FamilyState>>> => {
        const result = removeDiver(state, id);
        if (!result.ok) return { result };
        await eraseRecords();
        return { next: result.value, result };
      },
    );
  }

  /** Choosing the language the area already has stores nothing. */
  setGrownUpsLanguage(language: Language): Promise<void> {
    return this.live.change((state) =>
      state.grownUpsLanguage === language
        ? { result: undefined }
        : { next: withGrownUpsLanguage(state, language), result: undefined },
    );
  }
}

export class PreferencesStore {
  private readonly live: LiveRecord<ChildPreferences>;

  constructor(storage: SaveStorage, profileId: string) {
    this.live = new LiveRecord(
      new RecordStore(storage, preferencesRecord(profileId)),
      DEFAULT_PREFERENCES,
    );
  }

  get record(): RecordStore<ChildPreferences> {
    return this.live.record;
  }

  current(): ChildPreferences {
    return this.live.current();
  }

  open(): Promise<ChildPreferences> {
    return this.live.open();
  }

  subscribe(listener: (preferences: ChildPreferences) => void): () => void {
    return this.live.subscribe(listener);
  }

  change(edit: Parameters<typeof withPreferences>[1]): Promise<ChildPreferences> {
    return this.live.change((current) => {
      const next = withPreferences(current, edit);
      return { next, result: next };
    });
  }

  replace(next: ChildPreferences): Promise<void> {
    return this.live.change(() => ({ next, result: undefined }));
  }
}
