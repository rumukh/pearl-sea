/**
 * A stand-in for the device's speech engine (the Web Speech API), installed before the game
 * starts. It offers the voices a test describes, records every utterance (text, voice, language,
 * rate) and every cancel, and can announce a late voice list with `voiceschanged`, as real
 * browsers often do after the first page load. Nothing is spoken.
 *
 * Read-aloud may use only local Czech voices (docs/app.md §10): Zuzana on an iPad, Jakub on
 * Windows with the Czech speech pack. Edge also offers remote "natural" Czech voices, which send
 * the text to a service and must never be used, not even as a fallback.
 */
import type { BrowserContext, Page } from '@playwright/test';

export interface FakeVoice {
  readonly voiceURI: string;
  readonly name: string;
  readonly lang: string;
  readonly localService: boolean;
  readonly default: boolean;
}

export interface SpokenLine {
  readonly text: string;
  readonly voiceURI: string | null;
  readonly voiceLocal: boolean | null;
  readonly lang: string;
  readonly rate: number;
  readonly volume: number;
}

export interface SpeechLog {
  readonly spoken: SpokenLine[];
  readonly cancels: number;
}

/** Edge's online Czech voice, which the browser marks as its default: it must never be used. */
export const REMOTE_CZECH: FakeVoice = {
  voiceURI: 'qa-remote-cs-CZ',
  name: 'Microsoft Antonín Online (Natural) - Czech (Czechia)',
  lang: 'cs-CZ',
  localService: false,
  default: true,
};
/** The iPad's Czech voice. */
export const ZUZANA: FakeVoice = {
  voiceURI: 'qa-local-zuzana',
  name: 'Zuzana',
  lang: 'cs-CZ',
  localService: true,
  default: false,
};
/** Windows' Czech voice, once the Czech speech pack is installed. */
export const JAKUB: FakeVoice = {
  voiceURI: 'qa-local-jakub',
  name: 'Microsoft Jakub - Czech (Czech)',
  lang: 'cs-CZ',
  localService: true,
  default: false,
};
export const LOCAL_ENGLISH: FakeVoice = {
  voiceURI: 'qa-local-en-GB',
  name: 'English (United Kingdom)',
  lang: 'en-GB',
  localService: true,
  default: false,
};

/** A typical iPad: a remote default voice, a local English one and Zuzana. */
export const TYPICAL_VOICES: readonly FakeVoice[] = [REMOTE_CZECH, LOCAL_ENGLISH, ZUZANA];
/** A Windows PC without the Czech speech pack: Czech only online, which does not count. */
export const NO_LOCAL_CZECH: readonly FakeVoice[] = [REMOTE_CZECH, LOCAL_ENGLISH];

function fakeSpeech(config: { voices: FakeVoice[] }): void {
  // No class fields or helpers: Playwright serialises this function into the page as written.
  let voices = config.voices.slice();
  const spoken: SpokenLine[] = [];
  let cancels = 0;

  class FakeUtterance extends EventTarget {
    text: string;
    voice: FakeVoice | null;
    lang: string;
    volume: number;
    rate: number;
    pitch: number;
    constructor(text = '') {
      super();
      this.text = text;
      this.voice = null;
      this.lang = '';
      this.volume = 1;
      this.rate = 1;
      this.pitch = 1;
    }
  }

  class FakeSynthesis extends EventTarget {
    speaking: boolean;
    pending: boolean;
    paused: boolean;
    constructor() {
      super();
      this.speaking = false;
      this.pending = false;
      this.paused = false;
    }
    getVoices(): FakeVoice[] {
      return voices.slice();
    }
    speak(utterance: FakeUtterance): void {
      spoken.push({
        text: utterance.text,
        voiceURI: utterance.voice ? utterance.voice.voiceURI : null,
        voiceLocal: utterance.voice ? utterance.voice.localService : null,
        lang: utterance.lang,
        rate: utterance.rate,
        volume: utterance.volume,
      });
      this.speaking = true;
      setTimeout(() => {
        this.speaking = false;
        utterance.dispatchEvent(new Event('end'));
      }, 30);
    }
    cancel(): void {
      cancels++;
      this.speaking = false;
    }
    pause(): void {
      this.paused = true;
    }
    resume(): void {
      this.paused = false;
    }
  }

  const synthesis = new FakeSynthesis();
  Object.defineProperty(window, 'speechSynthesis', { value: synthesis, configurable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: FakeUtterance,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, '__psQaSpeech', {
    configurable: true,
    value: {
      log: () => ({ spoken: spoken.slice(), cancels }),
      publish(next: FakeVoice[]) {
        voices = next.slice();
        synthesis.dispatchEvent(new Event('voiceschanged'));
      },
    },
  });
}

/** Install the fake speech engine with `voices` in every page of the context. */
export async function installSpeech(
  context: BrowserContext,
  voices: readonly FakeVoice[],
): Promise<void> {
  await context.addInitScript(fakeSpeech, { voices: [...voices] });
}

export async function speechLog(page: Page): Promise<SpeechLog> {
  return page.evaluate(() =>
    (window as unknown as { __psQaSpeech: { log(): SpeechLog } }).__psQaSpeech.log(),
  );
}

export async function spokenTexts(page: Page): Promise<string[]> {
  return (await speechLog(page)).spoken.map((line) => line.text);
}

/** The device finishes loading its voices later and says so with `voiceschanged`. */
export async function publishVoices(page: Page, voices: readonly FakeVoice[]): Promise<void> {
  await page.evaluate(
    (next) => {
      (
        window as unknown as { __psQaSpeech: { publish(v: FakeVoice[]): void } }
      ).__psQaSpeech.publish(next);
    },
    [...voices],
  );
}
