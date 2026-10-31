/**
 * The visible save status, derived only from acknowledged facts.
 *
 * "Saved" appears only when the runtime's durable revision equals its committed revision,
 * never merely because the screen moved on. A failed checkpoint is "Not saved" with Retry,
 * which retries the exact failed write (runtime `retryCheckpoint` + `continuePending`), never
 * the action. A storage conflict (another window wrote first) cannot be retried; the child's
 * game must be reopened from what is stored.
 */
import type { RuntimeStatus } from '@aegis/runtime';
import type { SaveStatus } from '@aegis/browser/save';

export type SaveIndicator =
  | { readonly kind: 'none' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved' }
  | { readonly kind: 'failed'; readonly code: string }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'unavailable' };

export function deriveSaveIndicator(
  runtime: Pick<RuntimeStatus, 'checkpoint' | 'revision' | 'durableRevision' | 'error'>,
  storage?: Pick<SaveStatus, 'status'>,
): SaveIndicator {
  switch (runtime.checkpoint) {
    case 'disabled':
      return { kind: 'none' };
    case 'pending':
      return { kind: 'saving' };
    case 'failed': {
      const code = runtime.error?.code ?? 'storage';
      if (storage?.status === 'conflict' || code === 'conflict') return { kind: 'conflict' };
      if (storage?.status === 'unavailable' || code === 'unavailable') {
        return { kind: 'unavailable' };
      }
      return { kind: 'failed', code };
    }
    case 'idle':
      if (runtime.durableRevision === null) return { kind: 'none' };
      return runtime.durableRevision === runtime.revision ? { kind: 'saved' } : { kind: 'saving' };
  }
}

/** Whether "Retry" can help: only an owned, retryable checkpoint failure. */
export function canRetry(indicator: SaveIndicator): boolean {
  return indicator.kind === 'failed';
}
