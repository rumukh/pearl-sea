/**
 * The rules the shell plays with: S2's `pearlSeaAdapter` once its rules engine is on `main`
 * (`export { pearlSeaAdapter as RULES } from '../../rules/adapter';`). Until then there are no
 * rules: the shell boots to its title and grown-ups' area, and no child's game opens. This file
 * is the one place that names the adapter.
 */
import type { PearlSeaAdapter } from './definition';

export const RULES: PearlSeaAdapter | null = null;
