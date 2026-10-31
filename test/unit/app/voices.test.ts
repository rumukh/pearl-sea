/**
 * Read-aloud uses only voices that run on the device and speak Czech. A network voice is never
 * chosen, not even when it is the browser's default, and neither is an English voice.
 */
import { describe, expect, it, vi } from 'vitest';
import { createReadAloud, SPEECH_RATE } from '../../../src/app/speech/read-aloud';
import type { SpeechPlatform } from '../../../src/app/speech/read-aloud';
import { chooseVoice, isLocalCzech, localCzechVoices } from '../../../src/app/speech/voices';
import type { VoiceLike } from '../../../src/app/speech/voices';

const voice = (
  voiceURI: string,
  lang: string,
  localService: boolean,
  isDefault = false,
): VoiceLike => ({ voiceURI, name: voiceURI, lang, localService, default: isDefault });

const VOICES = [
  voice('Google čeština', 'cs-CZ', false, true),
  voice('Zira', 'en-US', true),
  voice('Zuzana', 'cs-CZ', true),
  voice('Jakub', 'cs_CZ', true),
  voice('Iveta', 'cs', true),
  voice('Zuzana', 'cs-CZ', true),
  voice('Natural Vlasta', 'cs-CZ', false),
  voice('Filip', 'sk-SK', true),
];

describe('voice selection', () => {
  it('keeps only local Czech voices, once each', () => {
    expect(isLocalCzech({ localService: true, lang: 'cs' })).toBe(true);
    expect(isLocalCzech({ localService: true, lang: 'cs-CZ' })).toBe(true);
    expect(isLocalCzech({ localService: true, lang: 'csb' })).toBe(false);
    expect(isLocalCzech({ localService: false, lang: 'cs-CZ' })).toBe(false);
    expect(isLocalCzech({ localService: true, lang: 'sk-SK' })).toBe(false);
    expect(localCzechVoices(VOICES).map((v) => v.uri)).toEqual(['Jakub', 'Zuzana', 'Iveta']);
  });

  it('puts a local default first, then cs-CZ voices', () => {
    const withDefault = [...VOICES, voice('Antonín', 'cs-CZ', true, true)];
    expect(localCzechVoices(withDefault).map((v) => v.uri)).toEqual([
      'Antonín',
      'Jakub',
      'Zuzana',
      'Iveta',
    ]);
  });

  it('keeps the chosen voice while it exists and falls back to the best local one', () => {
    const voices = localCzechVoices(VOICES);
    expect(chooseVoice(voices, 'Zuzana')?.uri).toBe('Zuzana');
    expect(chooseVoice(voices, 'Natural Vlasta')?.uri).toBe('Jakub');
    expect(chooseVoice(voices, null)?.uri).toBe('Jakub');
    expect(chooseVoice([], null)).toBeUndefined();
  });
});

class FakeUtterance {
  voice: unknown = null;
  lang = '';
  volume = 1;
  rate = 1;
  private readonly listeners = new Map<string, () => void>();
  constructor(readonly text: string) {}
  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }
  fire(type: string): void {
    this.listeners.get(type)?.();
  }
}

function platform(voices: VoiceLike[]) {
  const spoken: FakeUtterance[] = [];
  let changed: (() => void) | undefined;
  const synth = {
    getVoices: () => voices,
    speak: vi.fn((utterance: FakeUtterance) => spoken.push(utterance)),
    cancel: vi.fn(),
    addEventListener: (_type: string, listener: () => void) => {
      changed = listener;
    },
    removeEventListener: vi.fn(),
  };
  const environment = {
    synth: synth as unknown as SpeechSynthesis,
    Utterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
  } satisfies SpeechPlatform;
  return { environment, synth, spoken, voicesChanged: () => changed?.() };
}

describe('read-aloud', () => {
  it('names a local Czech voice on every utterance and never falls back to a network voice', () => {
    const fake = platform(VOICES);
    const reader = createReadAloud(fake.environment);
    expect(reader.available()).toBe(true);
    expect(reader.speak('Doplň i, nebo y: ml_n.', { voice: 'Google čeština' })).toBe(true);
    const utterance = fake.spoken[0]!;
    expect((utterance.voice as VoiceLike).voiceURI).toBe('Jakub');
    expect(utterance.lang).toBe('cs_CZ');
    expect(utterance.rate).toBe(SPEECH_RATE);
    expect(fake.synth.cancel).toHaveBeenCalled();
  });

  it('says text with plain spaces where the screen binds one-letter words', () => {
    const fake = platform(VOICES);
    createReadAloud(fake.environment).speak('Ponoř se s\u00a0ponorkou.', { voice: null });
    expect(fake.spoken[0]!.text).toBe('Ponoř se s ponorkou.');
  });

  it('is unavailable, and silent, without a local Czech voice', () => {
    const fake = platform([
      voice('Google čeština', 'cs-CZ', false, true),
      voice('Zira', 'en-US', true),
    ]);
    const reader = createReadAloud(fake.environment);
    expect(reader.available()).toBe(false);
    expect(reader.speak('Ahoj', { voice: null })).toBe(false);
    expect(fake.synth.speak).not.toHaveBeenCalled();
  });

  it('notices voices that arrive later and reports when speech ends', () => {
    const list: VoiceLike[] = [];
    const fake = platform(list);
    const reader = createReadAloud(fake.environment);
    const listener = vi.fn();
    reader.subscribe(listener);
    expect(reader.available()).toBe(false);
    list.push(voice('Zuzana', 'cs-CZ', true));
    fake.voicesChanged();
    expect(listener).toHaveBeenCalled();
    expect(reader.available()).toBe(true);
    const onEnd = vi.fn();
    reader.speak('Ahoj', { voice: null, onEnd });
    expect(reader.speaking()).toBe(true);
    fake.spoken[0]!.fire('end');
    expect(onEnd).toHaveBeenCalledOnce();
    expect(reader.speaking()).toBe(false);
  });

  it('is unavailable where the platform has no speech at all', () => {
    const reader = createReadAloud({ synth: undefined, Utterance: undefined });
    expect(reader.available()).toBe(false);
    expect(reader.speak('Ahoj', { voice: null })).toBe(false);
  });
});
