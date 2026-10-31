/**
 * Live stores over the small records: the family record and one child's preferences.
 *
 * A write either becomes the new state or fails without changing it. After a failed write the
 * store re-reads what storage actually holds, so the next change starts from the truth (and the
 * SDK service's retained failure is cleared by that explicit load).
 */
import type { SaveStorage } from '@aegis/browser/save';
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
import type { Diver, DiverInput, FamilyResult, FamilyState, Grade } from './family';
import { DEFAULT_PREFERENCES, preferencesRecord, withPreferences } from './preferences';
import type { ChildPreferences } from './preferences';
import { RecordStore } from './records';

class LiveRecord<T> {
  private value: T;
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
  async open(): Promise<T> {
    this.value = (await this.record.load()) ?? this.fallback;
    this.notify();
    return this.value;
  }

  async write(next: T): Promise<void> {
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

  subscribe(listener: (value: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.value);
  }
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
  async add(input: DiverInput & { readonly grade?: Grade }): Promise<FamilyResult<Diver>> {
    const result = addDiver(this.state(), input);
    if (!result.ok) return result;
    await this.live.write(result.value.state);
    return { ok: true, value: result.value.diver };
  }

  async update(id: string, input: DiverInput): Promise<FamilyResult<Diver>> {
    const result = updateDiver(this.state(), id, input);
    if (!result.ok) return result;
    await this.live.write(result.value.state);
    return { ok: true, value: result.value.diver };
  }

  /** Set or drop (`null`) the grade a child carries until their game save has it. */
  async setPendingGrade(id: string, grade: Grade | null): Promise<FamilyResult<Diver>> {
    const result = setPendingGrade(this.state(), id, grade);
    if (!result.ok) return result;
    await this.live.write(result.value.state);
    return { ok: true, value: result.value.diver };
  }

  /** Erase the child's own records first (privacy), then drop them from the list. */
  async remove(id: string, eraseRecords: () => Promise<void>): Promise<FamilyResult<FamilyState>> {
    const result = removeDiver(this.state(), id);
    if (!result.ok) return result;
    await eraseRecords();
    await this.live.write(result.value);
    return result;
  }

  async setGrownUpsLanguage(language: Language): Promise<void> {
    if (this.state().grownUpsLanguage === language) return;
    await this.live.write(withGrownUpsLanguage(this.state(), language));
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

  async change(edit: Parameters<typeof withPreferences>[1]): Promise<ChildPreferences> {
    const next = withPreferences(this.current(), edit);
    await this.live.write(next);
    return next;
  }

  replace(next: ChildPreferences): Promise<void> {
    return this.live.write(next);
  }
}
