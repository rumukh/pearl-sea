/**
 * One document-level keyboard listener with a stack of handlers. The top handler sees a key
 * first; a modal layer pushes a handler that returns 'block' so screens underneath stay
 * quiet. Typing in text fields, sliders and selects never reaches game handlers, and Enter or
 * Space on a focused button is left to the browser's native activation (one click, not two).
 */
import { isEditableTarget } from './dom';

export type KeyResult = 'handled' | 'pass' | 'block';
export type KeyHandler = (event: KeyboardEvent) => KeyResult;

export interface Keyboard {
  push(handler: KeyHandler): () => void;
  dispose(): void;
}

function activatesNatively(target: EventTarget | null, key: string): boolean {
  if (key !== 'Enter' && key !== ' ') return false;
  if (!(target instanceof Element)) return false;
  return target.closest('button, a[href], summary, [role="button"], input') !== null;
}

function ownsKeys(target: EventTarget | null): boolean {
  return (
    isEditableTarget(target) || (target instanceof HTMLInputElement && target.type === 'range')
  );
}

export function createKeyboard(target: Document = document): Keyboard {
  const handlers: KeyHandler[] = [];
  const listener = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (ownsKeys(event.target) || activatesNatively(event.target, event.key)) return;
    for (let index = handlers.length - 1; index >= 0; index--) {
      const result = handlers[index]!(event);
      if (result === 'handled') {
        event.preventDefault();
        return;
      }
      if (result === 'block') return;
    }
  };
  target.addEventListener('keydown', listener);
  return {
    push(handler) {
      handlers.push(handler);
      return () => {
        const index = handlers.lastIndexOf(handler);
        if (index >= 0) handlers.splice(index, 1);
      };
    },
    dispose() {
      handlers.length = 0;
      target.removeEventListener('keydown', listener);
    },
  };
}
