/**
 * The reading font: Pearl Reading, a subset of Andika (SIL OFL 1.1) with every Czech letter in
 * both cases (see assets/fonts/pearl-reading/ and scripts/fonts/subset-andika.mjs), loaded with
 * the CSS Font Loading API from the same origin. Boot waits for it, but never for long: after the
 * timeout the game starts in the fallback font and swaps when the font arrives.
 */
export const FONT_FAMILY = 'Pearl Reading';
export const FONT_DIRECTORY = 'assets/fonts/pearl-reading/';

export const FONT_FACES = [
  { file: 'PearlReading-Regular.woff2', weight: '400' },
  { file: 'PearlReading-Bold.woff2', weight: '700' },
] as const;

export type FontStatus = 'loaded' | 'timeout' | 'failed' | 'unsupported';

export async function loadFonts(baseUrl: string, timeoutMs = 2500): Promise<FontStatus> {
  if (typeof FontFace !== 'function' || !document.fonts) return 'unsupported';
  const faces = FONT_FACES.map((face) => {
    const url = new URL(FONT_DIRECTORY + face.file, baseUrl).href;
    const fontFace = new FontFace(FONT_FAMILY, `url("${url}") format("woff2")`, {
      weight: face.weight,
      style: 'normal',
      display: 'swap',
    });
    document.fonts.add(fontFace);
    return fontFace;
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<FontStatus>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });
  const loading = Promise.all(faces.map((face) => face.load())).then(
    (): FontStatus => 'loaded',
    (): FontStatus => 'failed',
  );
  try {
    return await Promise.race([loading, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
