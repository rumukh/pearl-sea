// @ts-check
/**
 * docs/curriculum.md as data, for the content gate (`--strict-coverage`) and the curriculum doc
 * test. Two tables carry the plan:
 *
 * - §2, the objectives: one row per objective, its ID in backticks in the first cell
 *   (`` | `obj.letters.alphabet` | … ``), with Strand, Grade and RVP columns.
 * - §3, the mapping: one row per objective with a Lessons column and a Monster levels column
 *   listing level IDs (`sunny-lagoon.1`, `sunny-lagoon.monster`).
 *
 * Columns are found by their header, so prose columns may be added or reordered freely.
 */

/** A lesson level ID (`<region>.<n>`) or a monster level ID (`<region>.monster`). */
const LEVEL_ID = /\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.(?:[1-9][0-9]?|monster)\b/g;
const OBJECTIVE_ID = /^obj(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

/**
 * The text of section `## <number>.` (up to the next `## ` heading), or `null`.
 * @param {string} doc
 * @param {number} number
 */
export function curriculumSection(doc, number) {
  const lines = doc.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => line.startsWith(`## ${number}.`));
  if (start === -1) return null;
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

/** @param {string} line */
function cells(line) {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

/**
 * The objective rows of a section's table, as `{ header: cell }` records (headers lower-cased).
 * @param {string} section
 * @returns {Record<string, string>[]}
 */
export function objectiveRows(section) {
  const lines = section.split('\n');
  const headerIndex = lines.findIndex(
    (line, index) => line.startsWith('|') && /^\|\s*:?-{3,}/.test(lines[index + 1] ?? ''),
  );
  if (headerIndex === -1) return [];
  const headers = cells(/** @type {string} */ (lines[headerIndex])).map((h) => h.toLowerCase());
  return lines
    .filter((line) => line.startsWith('| `obj.'))
    .map((line) =>
      Object.fromEntries(cells(line).map((cell, index) => [headers[index] ?? `${index}`, cell])),
    );
}

/** @param {string} cell */
export function backticked(cell) {
  return [...cell.matchAll(/`([^`]+)`/g)].map((match) => /** @type {string} */ (match[1]));
}

/** @param {string} cell */
export function levelIds(cell) {
  return [...cell.matchAll(LEVEL_ID)].map((match) => match[0]);
}

/**
 * @typedef {{ id: string; strand: string; grade: number; rvp: string[] }} DocumentedObjective
 * @typedef {{ objective: string; lessons: string[]; monsters: string[] }} DocumentedMapping
 */

/**
 * The objectives of §2 and the level mapping of §3.
 * @param {string} doc
 * @returns {{ objectives: DocumentedObjective[]; mapping: DocumentedMapping[]; problems: string[] }}
 */
export function parseCurriculum(doc) {
  /** @type {string[]} */
  const problems = [];
  const objectivesSection = curriculumSection(doc, 2);
  const mappingSection = curriculumSection(doc, 3);
  if (objectivesSection === null)
    problems.push('docs/curriculum.md has no "## 2." objectives section');
  if (mappingSection === null) problems.push('docs/curriculum.md has no "## 3." mapping section');
  /** @param {Record<string, string>} row @param {string} name */
  const column = (row, name) =>
    Object.entries(row).find(([header]) => header.includes(name))?.[1] ?? '';
  const objectives = objectiveRows(objectivesSection ?? '').map((row) => {
    const first = Object.values(row)[0] ?? '';
    return {
      id: backticked(first)[0] ?? first,
      strand: backticked(column(row, 'strand'))[0] ?? column(row, 'strand'),
      grade: Number(column(row, 'grade')),
      rvp: [...column(row, 'rvp').matchAll(/ČJL-[35]-2-0[1-9]p?/g)].map((match) => match[0]),
    };
  });
  const mapping = objectiveRows(mappingSection ?? '').map((row) => ({
    objective: backticked(Object.values(row)[0] ?? '')[0] ?? '',
    lessons: levelIds(column(row, 'lesson')),
    monsters: levelIds(column(row, 'monster')),
  }));
  return { objectives, mapping, problems };
}

/**
 * Coverage and shape problems of the documented curriculum: every objective has a well-formed
 * ID, a grade, an RVP outcome, at least one lesson and at least one monster level, and §2 and §3
 * list the same objectives once each.
 * @param {ReturnType<typeof parseCurriculum>} curriculum
 * @returns {{ errors: string[]; gaps: string[] }}
 */
export function curriculumProblems(curriculum) {
  const errors = [...curriculum.problems];
  /** @type {string[]} */
  const gaps = [];
  const ids = curriculum.objectives.map((objective) => objective.id);
  const mapped = curriculum.mapping.map((row) => row.objective);
  if (curriculum.objectives.length === 0) errors.push('docs/curriculum.md §2 lists no objectives');
  for (const [where, list] of [
    ['§2', ids],
    ['§3', mapped],
  ]) {
    const seen = new Set();
    for (const id of /** @type {string[]} */ (list)) {
      if (seen.has(id)) errors.push(`docs/curriculum.md ${where}: ${id} is listed twice`);
      seen.add(id);
    }
  }
  for (const objective of curriculum.objectives) {
    if (!OBJECTIVE_ID.test(objective.id))
      errors.push(`docs/curriculum.md §2: "${objective.id}" is not an objective ID`);
    if (objective.grade !== 3 && objective.grade !== 4) {
      errors.push(`docs/curriculum.md §2: ${objective.id} has no grade 3 or 4`);
    }
    if (objective.rvp.length === 0)
      errors.push(`docs/curriculum.md §2: ${objective.id} names no RVP outcome`);
    if (!mapped.includes(objective.id))
      errors.push(`docs/curriculum.md §3: ${objective.id} is not mapped`);
  }
  for (const row of curriculum.mapping) {
    if (!ids.includes(row.objective))
      errors.push(`docs/curriculum.md §3: ${row.objective} is not in §2`);
    for (const level of row.lessons) {
      if (level.endsWith('.monster'))
        errors.push(`docs/curriculum.md §3: ${row.objective} lists ${level} as a lesson`);
    }
    for (const level of row.monsters) {
      if (!level.endsWith('.monster')) {
        errors.push(`docs/curriculum.md §3: ${row.objective} lists ${level} as a monster level`);
      }
    }
    const missing = [
      ...(row.lessons.length === 0 ? ['lesson'] : []),
      ...(row.monsters.length === 0 ? ['monster'] : []),
    ];
    if (missing.length)
      gaps.push(`curriculum: ${row.objective} has no ${missing.join(' and no ')} level`);
  }
  return { errors, gaps };
}

/**
 * Disagreements between the documented mapping and a content pack: the pack's objectives must
 * be documented, and every level in the pack teaches exactly the objectives whose row lists it.
 * @param {DocumentedMapping[]} mapping
 * @param {{ objectives: { id: string }[]; levels: { id: string; objectives: string[] }[] }} data
 * @returns {string[]}
 */
export function packMappingProblems(mapping, data) {
  /** @type {string[]} */
  const problems = [];
  const documented = new Set(mapping.map((row) => row.objective));
  for (const objective of data.objectives) {
    if (!documented.has(objective.id)) {
      problems.push(`content objective ${objective.id} is not in docs/curriculum.md`);
    }
  }
  /** @type {Map<string, Set<string>>} */
  const byLevel = new Map();
  for (const row of mapping) {
    for (const level of [...row.lessons, ...row.monsters]) {
      byLevel.set(level, (byLevel.get(level) ?? new Set()).add(row.objective));
    }
  }
  for (const level of data.levels) {
    const expected = [...(byLevel.get(level.id) ?? [])].sort().join(', ');
    const actual = [...level.objectives].sort().join(', ');
    if (expected !== actual) {
      problems.push(
        `level ${level.id} teaches [${actual}] but docs/curriculum.md §3 maps [${expected}]`,
      );
    }
  }
  return problems;
}
