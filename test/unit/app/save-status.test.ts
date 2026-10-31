/**
 * The save status shows "Uloženo" only for acknowledged writes. Every runtime checkpoint state
 * maps to exactly one indicator.
 */
import { describe, expect, it } from 'vitest';
import { canRetry, deriveSaveIndicator } from '../../../src/app/persistence/save-status';

const status = (
  checkpoint: 'disabled' | 'idle' | 'pending' | 'failed',
  revision: number,
  durableRevision: number | null,
  code?: string,
) => ({
  checkpoint,
  revision,
  durableRevision,
  error: code ? { code, messageKey: `aegis.browser.${code}`, diagnostics: [] } : null,
});

describe('save indicator', () => {
  it('shows nothing before anything was saved or without a checkpoint writer', () => {
    expect(deriveSaveIndicator(status('idle', 0, null))).toEqual({ kind: 'none' });
    expect(deriveSaveIndicator(status('disabled', 3, null))).toEqual({ kind: 'none' });
  });

  it('says saving while a write is pending, and saved only when it is durable', () => {
    expect(deriveSaveIndicator(status('pending', 4, 3))).toEqual({ kind: 'saving' });
    expect(deriveSaveIndicator(status('idle', 4, 4))).toEqual({ kind: 'saved' });
    expect(deriveSaveIndicator(status('idle', 5, 4))).toEqual({ kind: 'saving' });
  });

  it('offers retry for an ordinary failed write', () => {
    const indicator = deriveSaveIndicator(status('failed', 5, 4, 'storage'), { status: 'failed' });
    expect(indicator).toEqual({ kind: 'failed', code: 'storage' });
    expect(canRetry(indicator)).toBe(true);
  });

  it('asks to reopen after another window wrote first, which retry cannot fix', () => {
    for (const indicator of [
      deriveSaveIndicator(status('failed', 5, 4, 'conflict')),
      deriveSaveIndicator(status('failed', 5, 4, 'storage'), { status: 'conflict' }),
    ]) {
      expect(indicator).toEqual({ kind: 'conflict' });
      expect(canRetry(indicator)).toBe(false);
    }
  });

  it('reports storage the browser will not provide', () => {
    expect(deriveSaveIndicator(status('failed', 1, null, 'unavailable'))).toEqual({
      kind: 'unavailable',
    });
    expect(
      deriveSaveIndicator(status('failed', 1, null, 'storage'), { status: 'unavailable' }),
    ).toEqual({ kind: 'unavailable' });
  });
});
