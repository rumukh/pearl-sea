/**
 * The rules the shell plays with: S2's `pearlSeaAdapter` (src/rules/adapter.ts). This file is the
 * one place in the shell that names the adapter; boot (main.ts) loads the content pack for it and
 * every child's game session runs it (game/definition.ts).
 */
export { pearlSeaAdapter as RULES } from '../../rules/adapter';
