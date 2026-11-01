/**
 * Same-origin static files below the deployment base: the content pack, its strings and its
 * archived history, the art catalog and the audio manifest. The fetcher is injectable, so
 * loaders are unit-tested without a network.
 */
export interface FetchedText {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

/** A fetched file that can also be read as bytes: the archived packs are gzip files. */
export interface FetchedFile extends FetchedText {
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type Fetcher = (url: string) => Promise<FetchedText>;
export type FileFetcher = (url: string) => Promise<FetchedFile>;

const browserFetch: FileFetcher = (url) => fetch(url, { credentials: 'same-origin' });

/** A file below the deployment base, fetched; a file elsewhere or a missing file rejects. */
async function fetchSite<R extends FetchedText>(
  baseUrl: string,
  path: string,
  fetcher: (url: string) => Promise<R>,
): Promise<R> {
  const url = new URL(path, baseUrl);
  if (url.origin !== new URL(baseUrl).origin) throw new Error(`${path} is not on this site.`);
  const response = await fetcher(url.href);
  if (!response.ok) throw new Error(`${path} is unavailable (${response.status}).`);
  return response;
}

/** A file below the deployment base, as text; a missing file rejects. */
export async function fetchSiteText(
  baseUrl: string,
  path: string,
  fetcher: Fetcher = browserFetch,
): Promise<string> {
  return (await fetchSite(baseUrl, path, fetcher)).text();
}

/** A file below the deployment base, as the bytes the server sent; a missing file rejects. */
export async function fetchSiteBytes(
  baseUrl: string,
  path: string,
  fetcher: FileFetcher = browserFetch,
): Promise<ArrayBuffer> {
  return (await fetchSite(baseUrl, path, fetcher)).arrayBuffer();
}
