/**
 * The build id in the grown-ups' About tab. The offline revision (24 hex characters, in
 * `index.html`'s `ps-offline-revision` and `resource-graph.json`) is a single word too long for a
 * phone's line. About shows its first characters, as a short commit id does, and keeps the
 * whole revision on the line for support.
 */
export const SHORT_REVISION_LENGTH = 8;

/** The first characters of the offline revision: `1d9340225b68a7510757b959` is `1d934022`. */
export function shortRevision(revision: string): string {
  return revision.slice(0, SHORT_REVISION_LENGTH);
}
