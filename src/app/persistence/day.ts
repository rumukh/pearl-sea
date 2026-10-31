/**
 * A child's day so far, for the diary card at goodbye ("Dnes ses naučil(a): mlýn, slyšet!"):
 * when a day's first session starts, the shell notes which items already shine (a pearl of
 * bronze or better) and how far each sea friend has grown. At the end of the session the diary
 * is the difference between that and the game view: what was learned and grown today.
 *
 * One small record per child (`pearl-sea-day`), apart from the game save: it is never part of
 * the game state, a hash or a backup, and holds nothing the game save does not. So a record that
 * cannot be read is simply replaced (no grown-up is asked), and a write that fails leaves the
 * diary to this page only. The game screens take the baseline from the view (`DayBaseline`).
 */
import type { SaveStorage } from '@aegis/browser/save';
import { DAY_GAME_ID } from '../../rules/contract';
import { RecordStore } from './records';
import type { RecordDefinition } from './records';
import { eraseRecord, RecoveryRequired } from './recovery';

/** What the view says when a day begins. */
export interface DayBaseline {
  /** Items that already shine (bronze or better). */
  readonly lit: readonly string[];
  /** Each sea friend's stage (`egg`, `baby`, …). */
  readonly stages: Readonly<Record<string, string>>;
}

export interface DayRecord extends DayBaseline {
  /** The local day `YYYY-MM-DD` the baseline was taken on. */
  readonly day: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ITEM = /^[a-z0-9][a-z0-9:._-]{0,127}$/;
const FRIEND = /^[a-z0-9][a-z0-9-]{0,63}$/;
const STAGE = /^[a-z][a-z-]{0,31}$/;
const MAX_ITEMS = 5000;
const MAX_FRIENDS = 100;

export function isDayRecord(value: unknown): value is DayRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 3 || !['day', 'lit', 'stages'].every((key) => keys.includes(key))) {
    return false;
  }
  const { day, lit, stages } = record;
  if (typeof day !== 'string' || !DAY.test(day)) return false;
  if (!Array.isArray(lit) || lit.length > MAX_ITEMS) return false;
  if (!lit.every((item) => typeof item === 'string' && ITEM.test(item))) return false;
  if (new Set(lit).size !== lit.length) return false;
  if (typeof stages !== 'object' || stages === null || Array.isArray(stages)) return false;
  const entries = Object.entries(stages);
  return (
    entries.length <= MAX_FRIENDS &&
    entries.every(
      ([id, stage]) => FRIEND.test(id) && typeof stage === 'string' && STAGE.test(stage),
    )
  );
}

export function dayRecord(profileId: string): RecordDefinition<DayRecord> {
  return {
    kind: 'day',
    gameId: DAY_GAME_ID,
    profileId,
    schemaVersion: 1,
    contentRevision: 'day-1',
    isValid: (value) => isDayRecord(value),
    isCurrent: isDayRecord,
  };
}

/** One child's day record. Reading and writing it never stops the game. */
export class DayStore {
  private readonly record: RecordStore<DayRecord>;
  private value: DayRecord | undefined;

  constructor(
    private readonly storage: SaveStorage,
    profileId: string,
  ) {
    this.record = new RecordStore(storage, dayRecord(profileId));
  }

  current(): DayRecord | undefined {
    return this.value;
  }

  async open(): Promise<DayRecord | undefined> {
    try {
      this.value = await this.record.load();
    } catch (error) {
      this.value = undefined;
      // A record that cannot be read holds nothing the game save does not: start it again, and
      // read the emptied record back so today's baseline can be stored over it.
      if (error instanceof RecoveryRequired && error.actions.available) {
        try {
          await eraseRecord(this.storage, this.record.policy);
          await this.record.load();
        } catch {
          // The diary then covers this page only.
        }
      }
    }
    return this.value;
  }

  /**
   * Note how `day` begins, unless it already has its baseline. The note is kept for this page
   * even when it cannot be stored.
   */
  async begin(day: string, baseline: () => DayBaseline): Promise<void> {
    if (this.value?.day === day) return;
    const taken = baseline();
    const next: DayRecord = { day, lit: [...taken.lit], stages: { ...taken.stages } };
    this.value = next;
    try {
      await this.record.save(next);
    } catch {
      // The diary then covers this page only; the game is not affected.
    }
  }
}

/** The device's local calendar day, `YYYY-MM-DD`: time enters the game only as data. */
export function localDay(now: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
