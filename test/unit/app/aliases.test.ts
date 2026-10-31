/**
 * Read-aloud aliases (src/app/speech/aliases.ts): words the voices say wrongly are replaced,
 * whole, just before speaking; after a number a word takes its Czech plural form; the screen
 * keeps the original; and every alias in the catalog is for a word the game's text uses.
 */
import { describe, expect, it, vi } from 'vitest';
import { CS_UI } from '../../../src/app/i18n/messages';
import { applyAliases, speechAliases } from '../../../src/app/speech/aliases';
import { createReadAloud } from '../../../src/app/speech/read-aloud';
import type { SpeechPlatform } from '../../../src/app/speech/read-aloud';

const ALIASES = speechAliases({
  'speech.alias.Kč.one': 'koruna',
  'speech.alias.Kč.few': 'koruny',
  'speech.alias.Kč.other': 'korun',
  'speech.alias.Osmička': 'Osmička',
  'speech.alias.ch': 'chá',
  'title.subtitle': 'Not an alias',
});

describe('read-aloud aliases', () => {
  it('reads the catalog: plain aliases and plural forms, nothing else, longest word first', () => {
    expect(ALIASES).toEqual([
      { word: 'Osmička', one: 'Osmička', few: 'Osmička', other: 'Osmička' },
      { word: 'Kč', one: 'koruna', few: 'koruny', other: 'korun' },
      { word: 'ch', one: 'chá', few: 'chá', other: 'chá' },
    ]);
  });

  it('replaces whole words only, keeping endings and the words around them', () => {
    expect(applyAliases('Písmeno ch je za h.', ALIASES)).toBe('Písmeno chá je za h.');
    expect(applyAliases('chobotnice a ocas', ALIASES)).toBe('chobotnice a ocas');
  });

  it('says a word after a number in its Czech plural form', () => {
    expect(applyAliases('Stojí 1 Kč.', ALIASES)).toBe('Stojí 1 koruna.');
    expect(applyAliases('Stojí 3 Kč, potom 25 Kč.', ALIASES)).toBe(
      'Stojí 3 koruny, potom 25 korun.',
    );
    expect(applyAliases('Kolik Kč zbývá?', ALIASES)).toBe('Kolik korun zbývá?');
  });

  it('speaks the alias and leaves the shown text alone', () => {
    const spoken: string[] = [];
    class Utterance {
      voice: unknown = null;
      lang = '';
      volume = 1;
      rate = 1;
      constructor(readonly text: string) {
        spoken.push(text);
      }
      addEventListener(): void {}
    }
    const zuzana = { name: 'Zuzana', voiceURI: 'Zuzana', lang: 'cs-CZ', localService: true };
    const environment = {
      synth: {
        getVoices: () => [zuzana],
        speak: vi.fn(),
        cancel: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as SpeechSynthesis,
      Utterance: Utterance as unknown as typeof SpeechSynthesisUtterance,
    } satisfies SpeechPlatform;
    const reader = createReadAloud(environment, ALIASES);
    const line = 'Za písmenem h je ch.';
    expect(reader.speak(line, { voice: null })).toBe(true);
    expect(spoken).toEqual(['Za písmenem h je chá.']);
    expect(line).toContain(' ch.');
  });

  it('defines no alias the game’s text never uses', () => {
    const strings = Object.values(CS_UI);
    for (const { word } of speechAliases(CS_UI)) {
      const whole = new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, 'u');
      expect(
        strings.some((text) => whole.test(text)),
        `"${word}" appears in some catalog string`,
      ).toBe(true);
    }
  });
});
