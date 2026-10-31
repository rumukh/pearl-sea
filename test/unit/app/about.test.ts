/**
 * The build id in the grown-ups' About tab (src/app/grownups/about.ts): a short id that always
 * fits a phone's line, whatever the build's revision is, in both languages.
 */
import { describe, expect, it } from 'vitest';
import { createGrownUpTranslator } from '../../../src/app/i18n/messages';
import { SHORT_REVISION_LENGTH, shortRevision } from '../../../src/app/grownups/about';

describe('the About build id', () => {
  const revision = '1d9340225b68a7510757b959';

  it('shows the first 8 characters of the offline revision', () => {
    expect(SHORT_REVISION_LENGTH).toBe(8);
    expect(shortRevision(revision)).toBe('1d934022');
    expect(revision.startsWith(shortRevision(revision))).toBe(true);
    for (const other of ['ffffffffffffffffffffffff', '0123456789abcdef01234567']) {
      expect(shortRevision(other).length).toBeLessThanOrEqual(SHORT_REVISION_LENGTH);
    }
    expect(shortRevision('abc')).toBe('abc');
  });

  it('reads "Verze 1d934022" in Czech and "Version 1d934022" in English', () => {
    const short = shortRevision(revision);
    expect(createGrownUpTranslator('cs')('grownups.about.version', { revision: short })).toBe(
      'Verze 1d934022',
    );
    expect(createGrownUpTranslator('en')('grownups.about.version', { revision: short })).toBe(
      'Version 1d934022',
    );
  });
});
