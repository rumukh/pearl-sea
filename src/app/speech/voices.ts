/**
 * Which speech voices read-aloud may use: only voices the device itself provides
 * (`localService === true`) that speak Czech. Remote "natural" voices send text to a service, so
 * they are never used, not even as a fallback. iPad and iPhone have Zuzana; Windows has Jakub
 * once Czech speech is installed.
 */
export interface VoiceLike {
  readonly voiceURI: string;
  readonly name: string;
  readonly lang: string;
  readonly localService: boolean;
  readonly default: boolean;
}

export interface VoiceInfo {
  readonly uri: string;
  readonly name: string;
  readonly lang: string;
  readonly isDefault: boolean;
}

export function isLocalCzech(voice: Pick<VoiceLike, 'localService' | 'lang'>): boolean {
  return voice.localService === true && /^cs(?:[-_]|$)/i.test(voice.lang);
}

function rank(voice: VoiceInfo): number {
  if (voice.isDefault) return 0;
  return voice.lang.toLowerCase().replace('_', '-') === 'cs-cz' ? 1 : 2;
}

/** Local Czech voices, unique by URI: the device default first, then cs-CZ, then the rest. */
export function localCzechVoices(voices: readonly VoiceLike[]): VoiceInfo[] {
  const seen = new Set<string>();
  const result: VoiceInfo[] = [];
  for (const voice of voices) {
    if (!isLocalCzech(voice) || seen.has(voice.voiceURI)) continue;
    seen.add(voice.voiceURI);
    result.push({
      uri: voice.voiceURI,
      name: voice.name,
      lang: voice.lang,
      isDefault: voice.default,
    });
  }
  return result.sort(
    (a, b) => rank(a) - rank(b) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );
}

/** The preferred voice if it is still available, otherwise the best local Czech voice. */
export function chooseVoice(
  voices: readonly VoiceInfo[],
  preferred: string | null,
): VoiceInfo | undefined {
  return voices.find((voice) => voice.uri === preferred) ?? voices[0];
}
