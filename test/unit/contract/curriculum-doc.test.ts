/**
 * docs/curriculum.md is the curriculum plan the content must follow. Its tables are parsed by the
 * same code as the content gate (scripts/lib/curriculum.mjs) and checked against the contract
 * (regions, strands, grades), against docs/design.md (the levels) and, once S3 ships it, against
 * the content pack (the objective-to-level mapping in both directions). The sides are authored
 * separately, so agreement is evidence, not a tautology.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_REGION_IDS,
  CONTENT_FILE,
  FINALE_MONSTER_ID,
  STRANDS,
} from '../../../src/rules/contract';
import type { ContentData } from '../../../src/rules/contract';
import {
  curriculumProblems,
  levelIds,
  packMappingProblems,
  parseCurriculum,
} from '../../../scripts/lib/curriculum.mjs';

const root = join(import.meta.dirname, '..', '..', '..');
const read = (...path: string[]) => readFileSync(join(root, ...path), 'utf8');
const curriculum = parseCurriculum(read('docs', 'curriculum.md'));
const regionOf = (level: string) => level.slice(0, level.lastIndexOf('.'));
/** Regions 1-7 (the shallows) teach grade 3; regions 8-12 (the deep) grade 4. */
const regionGrade = (region: string) =>
  (CANONICAL_REGION_IDS as readonly string[]).indexOf(region) < 7 ? 3 : 4;
const strandOf = new Map(curriculum.objectives.map((o) => [o.id, o.strand]));
const gradeOf = new Map(curriculum.objectives.map((o) => [o.id, o.grade]));

describe('docs/curriculum.md', () => {
  it('parses into well-formed objectives, each with a lesson and a monster level', () => {
    expect(curriculum.objectives.length).toBeGreaterThan(40);
    expect(curriculumProblems(curriculum)).toEqual({ errors: [], gaps: [] });
  });

  it('uses the contract’s strands and regions, every strand and every region', () => {
    expect([...new Set(curriculum.objectives.map((o) => o.strand))].sort()).toEqual(
      [...STRANDS].sort(),
    );
    const regions = new Set(
      curriculum.mapping.flatMap((row) => [...row.lessons, ...row.monsters].map(regionOf)),
    );
    expect([...regions].sort()).toEqual([...CANONICAL_REGION_IDS].sort());
  });

  it('names an RVP outcome of the objective’s grade, and covers every outcome of both', () => {
    for (const objective of curriculum.objectives) {
      const family = objective.grade === 3 ? 'ČJL-3-2-' : 'ČJL-5-2-';
      expect(
        objective.rvp.some((code) => code.startsWith(family)),
        objective.id,
      ).toBe(true);
    }
    const covered = new Set(curriculum.objectives.flatMap((o) => o.rvp));
    const outcomes = [
      ...Array.from({ length: 8 }, (_, i) => `ČJL-3-2-0${i + 1}`),
      ...Array.from({ length: 9 }, (_, i) => `ČJL-5-2-0${i + 1}`),
    ];
    expect(outcomes.filter((code) => !covered.has(code))).toEqual([]);
  });

  it('teaches each objective in its grade’s sea; monsters may review earlier grades', () => {
    for (const row of curriculum.mapping) {
      const grade = gradeOf.get(row.objective)!;
      for (const lesson of row.lessons)
        expect(regionGrade(regionOf(lesson)), `${row.objective} ${lesson}`).toBe(grade);
      for (const monster of row.monsters) {
        expect(
          regionGrade(regionOf(monster)),
          `${row.objective} ${monster}`,
        ).toBeGreaterThanOrEqual(grade);
      }
    }
  });

  it('gives Krakatice one arm per strand in the finale', () => {
    const finale = `${CANONICAL_REGION_IDS[CANONICAL_REGION_IDS.length - 1]}.monster`;
    expect(FINALE_MONSTER_ID).toBe('krakatice-inkoustova');
    const strands = new Set(
      curriculum.mapping
        .filter((row) => row.monsters.includes(finale))
        .map((row) => strandOf.get(row.objective)),
    );
    expect([...strands].sort()).toEqual([...STRANDS].sort());
  });
});

describe('docs/curriculum.md and docs/design.md', () => {
  const regions: readonly string[] = CANONICAL_REGION_IDS;
  const designed = new Set(
    levelIds(read('docs', 'design.md')).filter((level) => regions.includes(regionOf(level))),
  );
  const mapped = new Set(curriculum.mapping.flatMap((row) => [...row.lessons, ...row.monsters]));

  it('design one monster level per region and number each region’s lessons 1..n', () => {
    for (const region of CANONICAL_REGION_IDS) {
      expect(designed.has(`${region}.monster`), region).toBe(true);
      const lessons = [...designed]
        .filter((level) => regionOf(level) === region && !level.endsWith('.monster'))
        .map((level) => Number(level.slice(region.length + 1)))
        .sort((a, b) => a - b);
      expect(lessons.length, region).toBeGreaterThan(0);
      expect(lessons, region).toEqual(Array.from({ length: lessons.length }, (_, i) => i + 1));
    }
  });

  it('agree on the levels: every designed level teaches an objective, every mapped level exists', () => {
    expect([...mapped].filter((level) => !designed.has(level))).toEqual([]);
    expect([...designed].filter((level) => !mapped.has(level))).toEqual([]);
  });
});

describe('docs/curriculum.md and the content pack', () => {
  it('agree on every level the pack has (none before S3 ships the pack)', () => {
    const file = join(root, 'content', CONTENT_FILE);
    const data: Pick<ContentData, 'objectives' | 'levels'> = existsSync(file)
      ? JSON.parse(readFileSync(file, 'utf8')).data
      : { objectives: [], levels: [] };
    expect(packMappingProblems(curriculum.mapping, data)).toEqual([]);
  });
});
