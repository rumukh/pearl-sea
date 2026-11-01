// @ts-check
/**
 * Problem samples for a Czech review of what the rules really ask:
 *
 *   node scripts/content/sample-problems.mjs [--per-skill 10] [--boards 2] [--seed qa]
 *                                            [--region sunny-lagoon,coral-reef]
 *                                            [--pack content/pearl-sea.content.json]
 *                                            [--out out/problem-samples]
 *
 * Region by region in map order, every problem skill's generator (src/rules/learning/generate.ts
 * `problemFor`, the rules' own code) makes up to `--per-skill` problems: one per item, the items
 * spread evenly over what the skill can serve, each from its own seeded streams. They are written
 * as Czech text: the word or sentence with its numbered gaps, the options and the letter pad, the
 * expected answer and the hint (the catalogs' rule and method lines, the family word, the test
 * word, the case question, the pattern, the word that is not listed shown with its gap). Every
 * board activity gets `--boards` boards from the board makers
 * (src/rules/minigames/boards.ts `makeBoard`). Each monster battle lists its skills (arm by arm for
 * a many-armed monster) with problems drawn from them in turn. `inkoustici.md` lists the
 * activities the Inkoustíci ambush and their lines. `summary.md` counts what was written.
 *
 * Notes marked ⚠ point at what a reviewer must decide, not at errors: an option that spells
 * another word of the lexicon (a sentence must decide it), a form of the asked word that other
 * paradigm cells share (the sentence must decide its case), an option of a relation that the
 * lexicon relates to the target too.
 *
 * The same pack, seed and options always give the same files. The TypeScript is bundled with
 * esbuild into a temporary module, as scripts/simulate.mjs does, so this runs on plain Node.
 */
import { build } from 'esbuild';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isMain, repositoryRoot } from '../lib/tools.mjs';

const RULES_ENTRY = `export { canGenerate, problemFor, servableIndex } from './src/rules/learning/generate.ts';
export { formsOf, itemIndex, itemsOf, lexiconIndex } from './src/rules/learning/index-cache.ts';
export { makeBoard, necklaceShape, parseFace } from './src/rules/minigames/boards.ts';
export { AMBUSH_ACTIVITIES } from './src/rules/progression/problems.ts';
export { gradeBalance } from './src/rules/contract/index.ts';
export { createPrng } from '@aegis/core';`;

const BOARD_ACTIVITIES = [
  'pearl-necklace',
  'memory-match',
  'fishing-nets',
  'word-shell',
  'word-family',
];

/**
 * The rules' functions this script calls, bundled from their TypeScript sources.
 * @param {string} root
 * @returns {Promise<any>}
 */
export async function loadRules(root) {
  const directory = mkdtempSync(join(tmpdir(), 'pearl-sea-samples-'));
  try {
    const file = join(directory, 'rules.mjs');
    await build({
      absWorkingDir: root,
      stdin: { contents: RULES_ENTRY, resolveDir: root, loader: 'ts' },
      outfile: file,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'es2022',
      logLevel: 'warning',
    });
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * Up to `count` entries of `list`, spread evenly over it (all of it when it is short).
 * @template T
 * @param {readonly T[]} list
 * @param {number} count
 * @returns {T[]}
 */
export function spread(list, count) {
  if (list.length <= count) return [...list];
  return Array.from(
    { length: count },
    (_, i) => /** @type {T} */ (list[Math.floor((i * list.length) / count)]),
  );
}

/**
 * @typedef {object} SampleOptions
 * @property {string} [root] the repository root
 * @property {string} [pack] the pack file, relative to the root
 * @property {number} [perSkill] problems per problem skill
 * @property {number} [boards] boards per board activity
 * @property {string} [seed]
 * @property {string[] | null} [regions] region IDs to sample (all when null)
 */

/**
 * @typedef {object} RegionCount
 * @property {string} region
 * @property {number} skills
 * @property {number} problems
 * @property {number} boards
 * @property {number} notes
 * @property {number} errors
 */

/**
 * @typedef {object} SampleResult
 * @property {Map<string, string>} files markdown by file name
 * @property {RegionCount[]} counts
 * @property {string[]} errors skill, item and message of every problem that could not be made
 */

/**
 * The samples of a pack as markdown files.
 * @param {SampleOptions} [options]
 * @returns {Promise<SampleResult>}
 */
export async function sampleProblems(options = {}) {
  const root = options.root ?? repositoryRoot;
  const perSkill = options.perSkill ?? 10;
  const boardsPerActivity = options.boards ?? 2;
  const seed = options.seed ?? 'qa';
  const rules = await loadRules(root);
  /** @type {any} */
  const pack = JSON.parse(
    readFileSync(join(root, options.pack ?? 'content/pearl-sea.content.json'), 'utf8'),
  );
  const data = pack.data;
  /** @type {Record<string, string>} */
  const cs = {};
  for (const scope of ['content', 'ui']) {
    try {
      const file = join(root, 'content', 'catalogs', `cs.${scope}.json`);
      Object.assign(cs, JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      // A catalog the checkout does not have yet: its keys show as keys.
    }
  }
  const lexicon = rules.lexiconIndex(data);
  const served = rules.servableIndex(data);
  const items = rules.itemIndex(data);
  /** @type {Map<string, any>} */
  const skills = new Map(data.skills.map((/** @type {any} */ s) => [s.id, s]));

  /** @param {string | null | undefined} id */
  const lemma = (id) => (id ? (lexicon.words.get(id)?.lemma ?? id) : '—');
  /** @param {string} dimension @param {unknown} value */
  const label = (dimension, value) => cs[`grammar.${dimension}.${String(value)}`] ?? String(value);
  /** @param {string} key */
  const text = (key) => cs[key] ?? key;
  /** @param {string} key */
  const stream = (key) => rules.createPrng(`${seed}:${key}`);
  /** @param {string} word */
  const spelled = (word) =>
    lexicon.spellings.has(word) || lexicon.spellings.has(word.toLowerCase());

  /** @param {any} hint */
  function hintText(hint) {
    if (!hint) return '—';
    switch (hint.kind) {
      case 'family':
        return `příbuzné slovo: ${lemma(hint.related)}`;
      case 'test-word':
        return `zkouška: ${hint.test}`;
      case 'listed':
        return text(`grammar.listed.${hint.letter}`);
      case 'ten-ta-to':
        return hint.plural
          ? `ti, ty, nebo ta? (${label('gender-class', hint.gender)}, množné číslo)`
          : `ten, ta, nebo to? (${label('gender-class', hint.gender)})`;
      case 'case-question':
        return `${label('case', hint.case)}: ${text(`grammar.case-question.${hint.case}`)}`;
      case 'pattern':
        return `vzor ${label('pattern', hint.pattern)}`;
      case 'rule':
        return text(`grammar.rule.${hint.rule}`);
      case 'method':
        return text(`grammar.method.${hint.method}`);
      case 'not-listed': {
        // As the shell shows it: the word with its gap, never spelled out.
        const letters = [...lemma(hint.word)];
        const gapped = [...letters.slice(0, hint.span[0]), '_', ...letters.slice(hint.span[1])];
        return `slovo ${gapped.join('')} není vyjmenované ani příbuzné s vyjmenovaným`;
      }
      default:
        return JSON.stringify(hint);
    }
  }

  /**
   * The word around gap `index` of a gaps problem when that gap holds `option`.
   * @param {any} problem @param {number} index @param {string} option
   */
  function gapWord(problem, index, option) {
    let before = '';
    let after = '';
    let seen = false;
    for (const part of problem.parts) {
      if (part.kind === 'gap' && part.gap === index) {
        seen = true;
        continue;
      }
      const piece = part.kind === 'text' ? part.text : problem.gaps[part.gap].correct;
      if (seen) after += piece;
      else before += piece;
    }
    const left = /[\p{L}\p{M}-]*$/u.exec(before)?.[0] ?? '';
    const right = /^[\p{L}\p{M}-]*/u.exec(after)?.[0] ?? '';
    return `${left}${option}${right}`;
  }

  /**
   * The paradigm cells of `word` whose form is `form` (more than one: a sentence must decide).
   * @param {string} word @param {string} form
   * @returns {string[]}
   */
  function sharedCells(word, form) {
    const record = lexicon.words.get(word);
    if (!record) return [];
    const lower = form.toLowerCase();
    return rules
      .formsOf(record)
      .filter((/** @type {any} */ f) => f.text.toLowerCase() === lower)
      .map((/** @type {any} */ f) => f.cell);
  }

  /**
   * How the lexicon relates `option` to `target`.
   * @param {string | null} target @param {string | null} option
   * @returns {string[]}
   */
  function relationsOf(target, option) {
    if (!target || !option) return [];
    /** @param {Map<string, Set<string>>} map */
    const has = (map) => map.get(target)?.has(option) ?? false;
    const found = [];
    if (has(lexicon.synonyms)) found.push('synonym');
    if (has(lexicon.antonyms)) found.push('antonym');
    if (has(lexicon.generals)) found.push('general');
    if (has(lexicon.specifics)) found.push('specific');
    const family = lexicon.words.get(target)?.family?.id;
    if (family && family === lexicon.words.get(option)?.family?.id) found.push('related');
    return found;
  }

  /**
   * What an odd-one-out reads of a word: part of speech, gender, family, register.
   * @param {string | null} id
   */
  function describe(id) {
    const word = id ? lexicon.words.get(id) : undefined;
    if (!word) return '?';
    const parts = [word.pos];
    if (word.noun) {
      const animate = word.noun.animate === undefined ? '' : word.noun.animate ? '-anim' : '-inan';
      parts.push(`${word.noun.gender}${animate}`);
    }
    if (word.family) parts.push(`rodina ${word.family.id}`);
    if (word.register && word.register !== 'standard') parts.push(word.register);
    return parts.join(' ');
  }

  /**
   * A problem as Czech lines and its ⚠ notes.
   * @param {any} problem
   * @returns {{ lines: string[], notes: number }}
   */
  function renderProblem(problem) {
    /** @type {string[]} */
    const lines = [];
    let notes = 0;
    /** @param {string} line */
    const note = (line) => {
      notes++;
      lines.push(`    ⚠ ${line}`);
    };
    /** @param {any} gap @param {string} name */
    const gapLine = (gap, name) => {
      const word = gap.word ? ` (${lemma(gap.word)})` : '';
      lines.push(
        `  ${name} správně «${gap.correct}» · volby: ${gap.options.join(' | ')} · ` +
          `klávesy: ${gap.keys.join(' ')} · ${gap.rule}${word}`,
      );
      lines.push(`    nápověda: ${hintText(gap.hint)}`);
    };
    /** @param {any[]} list @param {number} correct */
    const marked = (list, correct) =>
      list.map((entry, i) => (i === correct ? `✱${entry.text}` : entry.text)).join(' · ');
    switch (problem.kind) {
      case 'gaps': {
        let shown = '';
        for (const part of problem.parts) {
          shown += part.kind === 'text' ? part.text : `[${part.gap + 1}]`;
        }
        lines.push(`- ${problem.sentence ? `věta ${problem.sentence}` : 'slovo'}: ${shown}`);
        problem.gaps.forEach((/** @type {any} */ gap, /** @type {number} */ index) => {
          gapLine(gap, `[${index + 1}]`);
          for (const option of gap.options) {
            if (option === gap.correct) continue;
            const other = gapWord(problem, index, option);
            if (!spelled(other)) continue;
            note(
              `«${other}» je také slovo lexikonu${problem.sentence ? ': rozhodne věta?' : ' (bez věty!)'}`,
            );
          }
        });
        break;
      }
      case 'classify': {
        const dimension = problem.dimension;
        let shown = problem.target.text;
        if (problem.context) {
          const { tokens, at } = problem.context;
          shown = tokens
            .map((/** @type {string} */ t, /** @type {number} */ i) => (i === at ? `«${t}»` : t))
            .join(' ');
        } else if (problem.span) {
          const letters = [...problem.target.text];
          const [start, end] = problem.span;
          shown =
            `${letters.slice(0, start).join('')}[${letters.slice(start, end).join('')}]` +
            letters.slice(end).join('');
        }
        lines.push(`- urči ${dimension}: ${shown}`);
        const options = problem.options.map((/** @type {string} */ v) => label(dimension, v));
        lines.push(
          `  volby: ${options.join(' | ')} · správně: ${label(dimension, problem.correct)}`,
        );
        lines.push(`    nápověda: ${hintText(problem.hint)}`);
        if (problem.context && problem.target.word) {
          const cells = sharedCells(problem.target.word, problem.target.text);
          if (cells.length > 1) {
            note(`tvar «${problem.target.text}» mají buňky ${cells.join(', ')}: rozhodne věta?`);
          }
        }
        break;
      }
      case 'odd': {
        lines.push(
          `- co sem nepatří (${problem.basis}): ${marked(problem.words, problem.correct)}`,
        );
        const facts = problem.words.map(
          (/** @type {any} */ w) => `${w.text} = ${describe(w.word)}`,
        );
        lines.push(`    údaje: ${facts.join('; ')}`);
        lines.push(`    nápověda: ${hintText(problem.hint)}`);
        break;
      }
      case 'relation': {
        const relation = label('relation', problem.relation);
        lines.push(
          `- ${relation} ke slovu «${problem.target.text}»: ${marked(problem.options, problem.correct)}`,
        );
        lines.push(`    nápověda: ${hintText(problem.hint)}`);
        problem.options.forEach((/** @type {any} */ option, /** @type {number} */ i) => {
          if (i === problem.correct) return;
          const found = relationsOf(problem.target.word, option.word);
          if (found.length > 0) {
            note(`«${option.text}» je ke slovu «${problem.target.text}» také: ${found.join(', ')}`);
          }
        });
        break;
      }
      case 'mistake': {
        // Each token, then its mark (`marks`), as the shell shows them: ~dosita~. and dos[ ]ta.
        const tokens = problem.tokens.map(
          (/** @type {string} */ t, /** @type {number} */ i) =>
            `${i === problem.wrong ? `~${t}~` : t}${problem.marks?.[i] ?? ''}`,
        );
        lines.push(`- lov chyb (${problem.sentence}): ${tokens.join(' ')}`);
        gapLine(problem.fix, `oprava ${problem.around[0]}[ ]${problem.around[1]}:`);
        break;
      }
      default:
        lines.push(`- ${JSON.stringify(problem)}`);
    }
    return { lines, notes };
  }

  /**
   * A board definition as Czech lines.
   * @param {any} definition
   * @returns {string[]}
   */
  function renderBoard(definition) {
    const config = definition.config;
    /** @param {string} key */
    const face = (key) => {
      const parsed = rules.parseFace(data, key);
      if (!parsed) return key;
      if (parsed.kind === 'word' || parsed.kind === 'form') return parsed.text;
      if (parsed.kind === 'pattern') return `vzor ${label('pattern', parsed.pattern)}`;
      return label(parsed.dimension, parsed.value);
    };
    if (definition.kind === 'matching') {
      /** @type {Map<string, string[]>} */
      const pairs = new Map();
      for (const card of config.cards) {
        pairs.set(card.pair, [...(pairs.get(card.pair) ?? []), face(card.labelKey)]);
      }
      return [`- pexeso: ${[...pairs.values()].map((p) => p.join(' ↔ ')).join(' · ')}`];
    }
    if (definition.kind === 'ordering') {
      const shape = rules.necklaceShape(definition.id);
      const order = config.solution.map((/** @type {string} */ id) => lemma(id)).join(' → ');
      return [`- náhrdelník (${shape.order}${shape.letter ? ` ${shape.letter}` : ''}): ${order}`];
    }
    if (config.fish) {
      const nets = config.values.map((/** @type {string} */ value, /** @type {number} */ i) => {
        const fish = config.fish.filter((/** @type {any} */ f) => f.net === i);
        return `${label(config.dimension, value)}: ${fish.map((/** @type {any} */ f) => f.text).join(', ')}`;
      });
      return [`- sítě (${config.dimension}): ${nets.join(' · ')}`];
    }
    if (config.letters) {
      /** @type {string[]} */
      const parts = [];
      let from = 0;
      for (const cut of [...config.cuts, config.letters.length]) {
        parts.push(config.letters.slice(from, cut).join(''));
        from = cut;
      }
      const roles = config.roles.map((/** @type {string} */ r) => label('segment', r)).join(', ');
      const named = parts.map((part, i) => {
        const role = config.labels[i];
        return `${part} = ${role ? label('segment', role) : '—'}`;
      });
      const zero = config.zeroEnding ? ' | ∅ = nulová koncovka' : '';
      return [`- ulita (${roles}): ${named.join(' | ')}${zero}`];
    }
    if (config.head) {
      const pick = (/** @type {boolean} */ member) =>
        config.words
          .filter((/** @type {any} */ w) => w.member === member)
          .map((/** @type {any} */ w) => w.text);
      const others = pick(false);
      return [
        `- rodinka slova ${config.head.text}: patří ${pick(true).join(', ')} · ` +
          `nepatří ${others.length > 0 ? others.join(', ') : '—'}`,
      ];
    }
    return [`- ${JSON.stringify(config)}`];
  }

  /**
   * One problem of `skill` for `item`, rendered; an error is recorded and returned as a line.
   * @param {any} skill @param {string} item @param {string} key @param {number} choices
   * @returns {{ lines: string[], notes: number, failed: boolean }}
   */
  function sample(skill, item, key, choices) {
    try {
      const problem = rules.problemFor(skill, item, {
        problems: stream(`${key}:problems`),
        distractors: stream(`${key}:distractors`),
        words: stream(`${key}:words`),
        data,
        choices,
      });
      return { ...renderProblem(problem), failed: false };
    } catch (error) {
      const message = `${skill.id} ${item}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(message);
      return { lines: [`- CHYBA ${message}`], notes: 0, failed: true };
    }
  }

  /**
   * A battle's skills in order and problems drawn from them in turn.
   * @param {any} level @param {any} activity @param {number} choices
   * @returns {string[]}
   */
  function battleSection(level, activity, choices) {
    const monster = data.monsters.find((/** @type {any} */ m) => m.region === level.region);
    const name = monster ? text(monster.nameKey) : '?';
    const lines = [
      `## ${level.id}: ${name} (meter ${monster?.meter}, ramena ${monster?.arms ?? 1}, ` +
        `opakování ${monster?.reviewShare} %, nejvýš ${activity.count} úloh)`,
      '',
      ...activity.skills.map(
        (/** @type {string} */ id, /** @type {number} */ i) =>
          `${i + 1}. ${id}: ${text(skills.get(id)?.titleKey)}`,
      ),
      '',
    ];
    const playable = activity.skills.filter(
      (/** @type {string} */ id) => (served.get(id)?.length ?? 0) > 0,
    );
    for (let k = 0; k < Math.min(perSkill, activity.count) && playable.length > 0; k++) {
      const id = playable[k % playable.length];
      const key = `${level.id}:battle:${k}`;
      const item = stream(`${key}:item`).pick(served.get(id) ?? []);
      lines.push(`(${id})`, ...sample(skills.get(id), item, key, choices).lines);
    }
    lines.push('');
    return lines;
  }

  /** @type {Map<string, string>} */
  const files = new Map();
  /** @type {RegionCount[]} */
  const counts = [];
  /** @type {string[]} */
  const errors = [];
  const battles = ['# Souboje s příšerami', ''];
  const regions = data.regions.filter(
    (/** @type {any} */ r) => !options.regions || options.regions.includes(r.id),
  );

  for (const region of regions) {
    const choices = rules.gradeBalance(data.balance, region.grade).input.choices;
    const count = { region: region.id, skills: 0, problems: 0, boards: 0, notes: 0, errors: 0 };
    const out = [`# ${text(region.titleKey)} (${region.id}, ${region.grade}. třída)`, ''];
    /** @type {Set<string>} */
    const done = new Set();
    for (const level of data.levels.filter((/** @type {any} */ l) => l.region === region.id)) {
      out.push(`## ${level.id}: ${text(level.titleKey)}`, '');
      for (const [a, activity] of level.activities.entries()) {
        const titles = activity.skills
          .map((/** @type {string} */ id) => `${id} (${text(skills.get(id)?.titleKey)})`)
          .join(', ');
        if (activity.kind === 'battle') {
          battles.push(...battleSection(level, activity, choices));
          out.push(`### battle: viz battles.md`, '');
          continue;
        }
        if (BOARD_ACTIVITIES.includes(activity.kind)) {
          out.push(`### ${activity.kind}: ${titles}`, '');
          const records = activity.skills.map((/** @type {string} */ id) => skills.get(id));
          const pool = rules.itemsOf(activity.skills, items);
          /** @type {any} */
          let previous = null;
          for (let board = 1; board <= boardsPerActivity; board++) {
            const key = `${level.id}:${a}:${board}`;
            /** @type {any} */
            const definition = rules.makeBoard({
              activity: activity.kind,
              id: `qa.b${board}`,
              board,
              boards: boardsPerActivity,
              pool,
              focus: null,
              skills: records,
              previous,
              state: {},
              data,
              random: stream(`${key}:board`),
              words: stream(`${key}:words`),
            });
            if (definition === null) {
              out.push('- (žádná deska)');
              continue;
            }
            previous = definition;
            count.boards++;
            out.push(...renderBoard(definition));
          }
          out.push('');
          continue;
        }
        for (const id of activity.skills) {
          const skill = skills.get(id);
          if (done.has(id)) {
            out.push(`### ${activity.kind}: ${id} (${text(skill?.titleKey)}), viz výše`, '');
            continue;
          }
          done.add(id);
          if (!skill || !rules.canGenerate(skill)) continue;
          const universe = served.get(id) ?? [];
          count.skills++;
          out.push(
            `### ${activity.kind}: ${id} (${text(skill.titleKey)}), ${skill.generator}, ` +
              `${universe.length} položek`,
            '',
          );
          for (const item of spread(universe, perSkill)) {
            const result = sample(skill, item, `${id}:${item}`, choices);
            count.problems += result.failed ? 0 : 1;
            count.errors += result.failed ? 1 : 0;
            count.notes += result.notes;
            out.push(...result.lines);
          }
          out.push('');
        }
      }
    }
    counts.push(count);
    files.set(`${String(region.order).padStart(2, '0')}-${region.id}.md`, `${out.join('\n')}\n`);
  }

  files.set('battles.md', `${battles.join('\n')}\n`);
  const ambush = data.balance.ambush;
  const beat = data.story.beats.find((/** @type {any} */ b) => b.id === 'beat.inkoustici');
  const line = cs['ambush.line'];
  files.set(
    'inkoustici.md',
    [
      '# Inkoustíci',
      '',
      `Přepadají aktivity ${rules.AMBUSH_ACTIVITIES.join(', ')} od ${ambush.unlockAfter}: ` +
        `od úlohy ${ambush.minIndex}, šance ${ambush.chance} %, nejvýš ${ambush.maxPerRound} ` +
        'za kolo. Přepadení zakryje běžnou úlohu té aktivity; správná odpověď inkoustíka spláchne.',
      '',
      ...data.inkoustici.map(
        (/** @type {any} */ i) =>
          `- ${text(i.nameKey)}: ${line ? line.replace('{name}', text(i.nameKey)) : '(ambush.line zatím v katalogu není)'}`,
      ),
      '',
      ...(beat?.graph.catalogs.text ?? []).map((/** @type {string} */ key) => `> ${text(key)}`),
      '',
    ].join('\n'),
  );
  /** @param {'skills' | 'problems' | 'boards' | 'notes' | 'errors'} field */
  const total = (field) => counts.reduce((sum, c) => sum + c[field], 0);
  files.set(
    'summary.md',
    [
      `# Vzorky úloh (balíček ${pack.revision}, seed ${seed})`,
      '',
      '| Oblast | Dovednosti | Úlohy | Desky | ⚠ | Chyby |',
      '| --- | --- | --- | --- | --- | --- |',
      ...counts.map(
        (c) =>
          `| ${c.region} | ${c.skills} | ${c.problems} | ${c.boards} | ${c.notes} | ${c.errors} |`,
      ),
      `| celkem | ${total('skills')} | ${total('problems')} | ${total('boards')} | ` +
        `${total('notes')} | ${total('errors')} |`,
      '',
      ...errors.map((e) => `- CHYBA ${e}`),
      '',
    ].join('\n'),
  );
  return { files, counts, errors };
}

/** @param {string[]} args @param {string} name @param {string} fallback */
function option(args, name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] !== undefined
    ? /** @type {string} */ (args[index + 1])
    : fallback;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const region = option(args, 'region', '');
  const outDir = resolve(repositoryRoot, option(args, 'out', 'out/problem-samples'));
  const result = await sampleProblems({
    pack: option(args, 'pack', 'content/pearl-sea.content.json'),
    perSkill: Number(option(args, 'per-skill', '10')),
    boards: Number(option(args, 'boards', '2')),
    seed: option(args, 'seed', 'qa'),
    regions: region ? region.split(',') : null,
  });
  mkdirSync(outDir, { recursive: true });
  for (const [name, content] of result.files) writeFileSync(join(outDir, name), content);
  process.stdout.write(result.files.get('summary.md') ?? '');
  process.stdout.write(`Wrote ${result.files.size} files to ${outDir}\n`);
  if (result.errors.length > 0) process.exitCode = 1;
}
