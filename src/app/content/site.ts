/**
 * Same-origin static files below the deployment base (the audio manifest now; the content pack
 * and its history with the game screens). The fetcher is injectable, so loaders are unit-tested
 * without a network.
 */
export interface FetchedText {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

export type Fetcher = (url: string) => Promise<FetchedText>;

const browserFetch: Fetcher = (url) => fetch(url, { credentials: 'same-origin' });

/** A file below the deployment base, as text; a missing file rejects. */
export async function fetchSiteText(
  baseUrl: string,
  path: string,
  fetcher: Fetcher = browserFetch,
): Promise<string> {
  const url = new URL(path, baseUrl);
  if (url.origin !== new URL(baseUrl).origin) throw new Error(`${path} is not on this site.`);
  const response = await fetcher(url.href);
  if (!response.ok) throw new Error(`${path} is unavailable (${response.status}).`);
  return response.text();
}
