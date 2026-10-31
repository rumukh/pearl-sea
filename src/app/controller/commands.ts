/**
 * Command controller: the only way screens dispatch game actions.
 *
 * - **Stale-view guard.** `capture()` binds a dispatcher to the committed revision and to a
 *   view generation when a screen renders. Any newer view (a commit or a restore, even one with
 *   the same numeric revision) makes older dispatchers refuse with `StaleCommandError`, and the
 *   runtime refuses a mismatched `expectedRevision` before any rule runs.
 * - **Strict durability.** After a failed checkpoint, `retry()` asks the runtime to retry the
 *   exact failed write, then continues an accepted multi-turn action with `continuePending()`.
 *   The original action is never dispatched again.
 * - **Pause.** `resume(reason)` removes one pause reason and continues accepted work.
 *
 * Ported from the Aegis reference shell (poc/lab-shared/commands.ts) by way of Dragon Valley.
 */
import type { DispatchReceipt, RuntimeError, RuntimeHost } from '@aegis/runtime';

export class StaleCommandError extends Error {
  constructor() {
    super('This control belongs to a view that has been replaced.');
    this.name = 'StaleCommandError';
  }
}

export class CommandRejectedError extends Error {
  constructor(
    readonly error: RuntimeError,
    readonly accepted: boolean,
  ) {
    super(`The runtime refused the command: ${error.code}`);
    this.name = 'CommandRejectedError';
  }
}

/**
 * For actions that only move the child on (the next story line, a level's start): one the game
 * took but could not save yet counts as done, since the save status says "Neuloženo" and offers
 * Retry. Refusals still reject.
 */
export async function taken(sent: Promise<unknown>): Promise<void> {
  try {
    await sent;
  } catch (error) {
    if (error instanceof CommandRejectedError && error.accepted) return;
    throw error;
  }
}

export type Dispatch<A> = (action: A) => Promise<DispatchReceipt>;

/** Resolves once the action is shown; see `CommandController.captureSend`. */
export type Send<A> = (action: A) => Promise<void>;

/**
 * How long feedback waits for a save before it is shown anyway. A healthy save takes a few
 * milliseconds; a slow device must not make the child wait for praise, and a failing save that
 * reports within this time keeps its answer held (no praise for what is not stored).
 */
export const SAVE_PATIENCE_MS = 250;

export interface CommandController<A> {
  /** A dispatcher bound to the current view that resolves once the action is durably saved. */
  capture(): Dispatch<A>;
  /**
   * A dispatcher bound to the current view for actions the child waits on (an answer, a move,
   * the next line): it resolves when the action is saved, or once it is committed if the save
   * takes longer than `SAVE_PATIENCE_MS` (the view already shows its outcome; the save goes on
   * and the save status tracks it). It rejects when the action is refused, or with
   * `accepted: true` when its save failed within that time.
   */
  captureSend(): Send<A>;
  retry(): Promise<void>;
  resume(reason: string): Promise<void>;
  continueAccepted(): Promise<void>;
  dispose(): void;
}

/** Calls `listener` for every new view (a commit or a restore); returns its unsubscribe. */
export type ViewWatch = (listener: (reason: 'commit' | 'restore') => void) => () => void;

/**
 * `watch` is how the controller hears of new views. By default it listens to the host itself;
 * the shell passes its game session's fan-out instead, so the host keeps a single listener.
 */
export function createCommandController<S, A, V, C>(
  host: RuntimeHost<S, A, V, C>,
  onError: (error: unknown) => void,
  watch: ViewWatch = (listener) => host.subscribe((_view, reason) => listener(reason)),
): CommandController<A> {
  let generation = 0;
  let disposed = false;
  let failed = false;
  let continuation: Promise<void> | undefined;

  const ready = (): boolean => {
    const status = host.getStatus();
    return (
      !disposed &&
      !failed &&
      !status.disposed &&
      !status.busy &&
      status.pendingAction !== null &&
      status.pauseReasons.length === 0 &&
      status.checkpoint !== 'failed' &&
      status.checkpoint !== 'pending'
    );
  };

  const continueAccepted = (): Promise<void> => {
    if (continuation) return continuation;
    if (!ready()) return Promise.resolve();
    continuation = Promise.resolve()
      .then(async () => {
        if (!ready()) return;
        const result = await host.continuePending();
        if (!result.ok) {
          failed = true;
          throw new CommandRejectedError(result.error, result.progress.accepted);
        }
      })
      .finally(() => {
        continuation = undefined;
      });
    return continuation;
  };

  const unsubscribeView = watch((reason) => {
    generation++;
    if (reason === 'restore') failed = false;
  });
  const unsubscribeStatus = host.subscribeStatus(() => {
    void continueAccepted().catch(onError);
  });
  void continueAccepted().catch(onError);

  // The runtime takes one command at a time and refuses one sent while another is still being
  // saved; commands sent meanwhile wait for it here instead.
  let inFlight: Promise<unknown> = Promise.resolve();

  const run = (
    action: A,
    epoch: number,
    revision: number,
    onCommitted: (committed: boolean) => void,
  ): Promise<DispatchReceipt> => {
    const go = async (): Promise<DispatchReceipt> => {
      await inFlight;
      if (disposed || epoch !== generation) throw new StaleCommandError();
      const before = host.getStatus().revision;
      // The runtime commits and publishes the new view before it starts the save.
      const pending = host.dispatch(action, { expectedRevision: revision });
      onCommitted(host.getStatus().revision !== before);
      const result = await pending;
      if (!result.ok) {
        if (result.error.code === 'stale-action') throw new StaleCommandError();
        throw new CommandRejectedError(result.error, result.progress.accepted);
      }
      return result.value;
    };
    const sent = go();
    inFlight = sent.then(
      () => undefined,
      () => undefined,
    );
    return sent;
  };

  return {
    capture() {
      const revision = host.getStatus().revision;
      const epoch = generation;
      return (action) => {
        if (disposed || epoch !== generation) return Promise.reject(new StaleCommandError());
        return run(action, epoch, revision, () => undefined);
      };
    },
    captureSend() {
      const revision = host.getStatus().revision;
      const epoch = generation;
      return (action) =>
        new Promise<void>((resolve, reject) => {
          if (disposed || epoch !== generation) {
            reject(new StaleCommandError());
            return;
          }
          let patience: ReturnType<typeof setTimeout> | undefined;
          run(action, epoch, revision, (committed) => {
            // A slow save does not hold up what the child sees.
            if (committed) patience = setTimeout(resolve, SAVE_PATIENCE_MS);
          }).then(
            () => {
              clearTimeout(patience);
              resolve();
            },
            (error: unknown) => {
              // After the patience ran out, a failed save is the save status's business.
              clearTimeout(patience);
              reject(error);
            },
          );
        });
    },
    async retry() {
      failed = false;
      const result = await host.retryCheckpoint();
      if (!result.ok) throw new CommandRejectedError(result.error, true);
      await continueAccepted();
    },
    async resume(reason) {
      failed = false;
      host.resume(reason);
      await continueAccepted();
    },
    continueAccepted,
    dispose() {
      disposed = true;
      generation++;
      unsubscribeStatus();
      unsubscribeView();
    },
  };
}
