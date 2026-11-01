/**
 * Moving a save's learning records to newer content (adapter.ts `activateContent`).
 *
 * Content IDs are append-only, but an item ID retires when the contract merges two items: since
 * content 1.2.5 a form that several paradigm cells show is one item, named by the first of them
 * (contract `canonicalItem`: _delfíni_ was both `class:number:delfiin:pl1` and `…:pl5`, now only
 * `pl1`). A save made before keeps records under retired IDs. Activating newer content merges
 * each into the item it stands for, in sorted order (activation is deterministic: saves pin the
 * state hash):
 *
 * - the kept item has no record: the retired record moves to it;
 * - both have one: the better record survives whole (the higher mastery level, then the higher
 *   box; the kept item's own on a tie) and the other's answers (`seen`, `correct`) are added to
 *   it, so the grown-ups' totals and accuracy keep every answer and no pearl of the form gets
 *   duller. `rightDays` is not added: two items answered on one day would count it twice.
 *
 * A save without retired IDs is left as it is, so merging again changes nothing.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { canonicalItem } from '../contract';
import type { ItemState, ProfileState } from '../contract';
import { sortText } from './index-cache';
import { MASTERY_RANK, masteryLevel } from './items';
import type { Data } from '../types';

type ReadItem = DeepReadonly<ItemState>;

/** A copy of a record, mutable again. */
function copy(record: ReadItem): ItemState {
  return { ...record, recent: [...record.recent] };
}

/** The record an item keeps when a retired item's record merges into it. */
export function mergeItemRecords(
  kept: ReadItem | undefined,
  retired: ReadItem,
  balance: Data['balance'],
): ItemState {
  if (kept === undefined) return copy(retired);
  const rank = (record: ReadItem) =>
    MASTERY_RANK.indexOf(masteryLevel(record, balance)) * 10 + record.box;
  const [better, other] = rank(retired) > rank(kept) ? [retired, kept] : [kept, retired];
  return {
    ...copy(better),
    seen: better.seen + other.seen,
    correct: better.correct + other.correct,
  };
}

/** Merge every record under a retired item ID into the item it stands for. */
export function mergeRetiredItems(state: ProfileState, data: Data): void {
  for (const id of Object.keys(state.items).sort(sortText)) {
    const kept = canonicalItem(id, data.lexicon);
    if (kept === id) continue;
    const retired = state.items[id]!;
    delete state.items[id];
    state.items[kept] = mergeItemRecords(state.items[kept], retired, data.balance);
  }
}
