/**
 * Sizes for grown-ups in their own language: Czech writes "3,4 MB" with a decimal comma and a
 * no-break space, English "3.4 MB".
 */
import { describe, expect, it } from 'vitest';
import { formatBytes } from '../../../src/app/persistence/storage';

describe('storage sizes', () => {
  it('are written the Czech way in Czech and the English way in English', () => {
    expect(formatBytes(512, 'cs')).toBe('512\u00a0B');
    expect(formatBytes(12 * 1024, 'cs')).toBe('12\u00a0kB');
    expect(formatBytes(3.4 * 1024 * 1024, 'cs')).toBe('3,4\u00a0MB');
    expect(formatBytes(512, 'en')).toBe('512 B');
    expect(formatBytes(12 * 1024, 'en')).toBe('12 KB');
    expect(formatBytes(3.4 * 1024 * 1024, 'en')).toBe('3.4 MB');
  });
});
