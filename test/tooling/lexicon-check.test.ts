/**
 * The lexicon checker (scripts/lexicon/check.mjs) on throwaway copies of the word bank: the
 * repository's word bank passes, every kind of injected fault is reported, and the command line
 * turns problems into the failing exit code that `npm run verify` observes.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkLexicon, LEXICON_DIR, parseMarked, translit } from '../../scripts/lexicon/check.mjs';

const CHECKER = join(import.meta.dirname, '..', '..', 'scripts', 'lexicon', 'check.mjs');
let dir: string;

/** Rewrites one file of the copied word bank. */
function edit(file: string, change: (data: any) => void): void {
  const path = join(dir, file);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  change(data);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

const word = (data: any, id: string) => data.words.find((w: any) => w.id === id);
const sentence = (data: any, id: string) => data.sentences.find((s: any) => s.id === id);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ps-lexicon-'));
  cpSync(LEXICON_DIR, dir, { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** One injected fault: the file it changes, the change, and a phrase the report must contain. */
interface Fault {
  name: string;
  file: string;
  change: (data: any) => void;
  reported: string;
}

const faults: Fault[] = [
  {
    name: 'a vyjmenované word spelled with i',
    file: 'vyjmenovana-l.json',
    change: (d) => (word(d, 'mlyyn').spell = 'ml{í|ý}n'),
    reported: 'vyjm needs y/ý',
  },
  {
    name: 'a vyjm gap after the wrong letter',
    file: 'vyjmenovana-b.json',
    change: (d) => (word(d, 'bystryy').spell = 'bystr{ý|í}'),
    reported: 'not the family letter',
  },
  {
    name: 'segments that do not rebuild the word',
    file: 'word-structure.json',
    change: (d) => (word(d, 'podmorxskyy').segments.root = 'mor'),
    reported: 'segments rebuild',
  },
  {
    name: 'a pattern that disagrees with gender and animacy',
    file: 'noun-patterns.json',
    change: (d) => (word(d, 'paan').pattern = 'hrad'),
    reported: 'pattern "hrad" is m inanimate',
  },
  {
    name: 'two files with conflicting facts',
    file: 'alphabet.json',
    change: (d) => (word(d, 'ryba').gender = 'm'),
    reported: 'conflicts with',
  },
  {
    name: 'an ID that is not the transliterated lemma',
    file: 'vyjmenovana-z.json',
    change: (d) => (word(d, 'brzy').lemma = 'brzi'),
    reported: 'ID must be',
  },
  {
    name: 'a gap word that is not a form of its word',
    file: 'vyjmenovana-l.json',
    change: (d) => (sentence(d, 'vyjm-l.04').text = 'U zátoky stojí starý ml{ý|í}nek.'),
    reported: 'is not a known form of mlyyn',
  },
  {
    name: 'a wrong agreement ending',
    file: 'sentences.json',
    change: (d) => (sentence(d, 'agree.02').text = 'Ryby plaval{i|y} v zátoce.'),
    reported: 'agreement needs -y',
  },
  {
    name: 'a subject after its predicate',
    file: 'sentences.json',
    change: (d) => {
      const s = sentence(d, 'agree.02');
      s.text = 'V zátoce plaval{y|i} ryby.';
      s.gaps[0].subjects[0].t = 'ryby';
    },
    reported: 'must come before the predicate',
  },
  {
    name: 'a sentence over ten words',
    file: 'vyjmenovana-b.json',
    change: (d) =>
      (sentence(d, 'vyjm-b.01').text =
        'Malí delfíni b{y|i}dlí v teplém a modrém moři u velkého ostrova.'),
    reported: 'at most 10',
  },
  {
    name: 'an incomplete school list',
    file: 'vyjmenovana-z.json',
    change: (d) => (d.families = d.families.filter((f: any) => f.id !== 'vyjm-z.brzy')),
    reported: 'school list Z',
  },
  {
    name: 'an alphabet set out of order (ch comes after h)',
    file: 'alphabet.json',
    change: (d) =>
      (d.sets.find((s: any) => s.id === 'abc.03').words = ['hlubina', 'chaluha', 'humr']),
    reported: 'must come after',
  },
  {
    name: 'a paired consonant whose test word does not prove it',
    file: 'paired-consonants.json',
    change: (d) => (word(d, 'hrad').rules = [{ rule: 'parova', test: 'hradní' }]),
    reported: 'test word',
  },
  {
    name: 'a vzor gap with the wrong case',
    file: 'noun-patterns.json',
    change: (d) => (sentence(d, 'vzor.01').gaps[0].case = 4),
    reported: 'is not 4. pád',
  },
  {
    name: 'a mark with the wrong case',
    file: 'nouns.json',
    // ostrovu is both the 3rd and the 6th case, so a fault needs the 7th (ostrovem).
    change: (d) => (sentence(d, 'case.09').marks[0].case = 7),
    reported: 'is not 7. pád',
  },
  {
    name: 'a sound-alike pair that differs in more than i/y',
    file: 'sound-alikes.json',
    change: (d) =>
      (d.sets.find((s: any) => s.id === 'alike.pyl-pil').forms[1] = { form: 'pít', word: 'piit' }),
    reported: 'do not differ only in i/y',
  },
  {
    name: 'a text that is not NFC',
    file: 'vowels.json',
    change: (d) => (sentence(d, 'vowels.03').text = 'Delf{í|i}n skáče přes vlny.'.normalize('NFD')),
    reported: 'NFC',
  },
  {
    name: 'a character outside the Czech text set (an em dash)',
    file: 'vowels.json',
    change: (d) => (sentence(d, 'vowels.03').text = 'Delf{í|i}n skáče — přes vlny.'),
    reported: 'outside the Czech text set',
  },
  {
    name: 'a standard noun without its paradigm',
    file: 'paradigms.json',
    change: (d) => delete d.paradigms.haadka,
    reported: 'a noun needs its paradigm',
  },
  {
    name: 'a paradigm with a number the noun does not have',
    file: 'paired-consonants.json',
    change: (d) => (word(d, 'haadka').numbers = 'sg'),
    reported: 'paradigm.pl is given, but "numbers" is "sg"',
  },
  {
    name: 'an irregular future left out (půjdu, never budu jít)',
    file: 'verbs.json',
    change: (d) => delete word(d, 'jiit').paradigm.fut,
    reported: '"jít" forms its future without budu',
  },
  {
    name: 'a listed form that is not in the paradigm',
    file: 'paired-consonants.json',
    change: (d) => (word(d, 'hrad').forms = ['hradou']),
    reported: 'form "hradou" is not a form of the paradigm',
  },
  {
    name: 'an ambiguous spelling point without a sentence (vila, víla)',
    file: 'vowels.json',
    change: (d) => (d.sentences = d.sentences.filter((s: any) => s.id !== 'vowels.14')),
    reported: 'the spelling point at 1 also spells "víla": a sentence needs a gap on it',
  },
  {
    name: 'an end-mark gap in a statement, which may be read as a question',
    file: 'sentences.json',
    change: (d) => {
      const s = sentence(d, 'kind.01');
      s.text = 'Na dně moře žije mnoho barevných ryb{.|?}';
      s.gaps = [{ rule: 'interpunkce' }];
    },
    reported: 'an end mark is asked only in a question, a command or a wish',
  },
  {
    name: 'an end-mark gap in a question without a question word',
    file: 'sentences.json',
    change: (d) => {
      const s = sentence(d, 'kind.11');
      s.text = 'Plavou delfíni rychleji než ryby{?|.}';
      s.gaps = [{ rule: 'interpunkce' }];
    },
    reported: 'starts with a question word',
  },
  {
    name: 'a command offering the full stop it may also end with',
    file: 'sentences.json',
    change: (d) => (sentence(d, 'kind.12').text = 'Plav rychle ke břehu{!|.}'),
    reported: 'a command ends with !, against ?',
  },
  {
    name: 'a wish without kéž or ať',
    file: 'sentences.json',
    change: (d) => (sentence(d, 'kind.17').text = 'Už bychom našli ztracený poklad{!|?}'),
    reported: 'a wish starts with Kéž or Ať',
  },
  {
    name: 'a conjunction offered against one that takes the comma differently',
    file: 'sentences.json',
    change: (d) =>
      (sentence(d, 'conj.01').text = 'Foukal silný vítr, {ale|a} delfíni skákali dál.'),
    reported: 'takes the comma differently',
  },
  {
    name: 'a missing comma before ale',
    file: 'sentences.json',
    change: (d) =>
      (sentence(d, 'conj.05').text = 'Krab plaval ke břehu {ale|protože} vlny ho vracely.'),
    reported: 'a comma goes before "ale"',
  },
  {
    name: 'an antonym missing for a synonym of the antonym',
    file: 'meaning.json',
    change: (d) => (d.sets = d.sets.filter((s: any) => s.id !== 'ant.smutny-radostny')),
    reported: 'record smutnyy × radostnyy as antonyms',
  },
];

describe('scripts/lexicon/check.mjs', () => {
  it('accepts the repository’s word bank', () => {
    const { errors, counts, summary } = checkLexicon();
    expect(errors).toEqual([]);
    expect(counts.files).toBeGreaterThan(20);
    expect(counts.words).toBeGreaterThan(700);
    expect(summary.join('\n')).toMatch(/^vyjmenovaná Z: 4 families, \d+ words$/m);
  });

  it.each(faults)('reports $name', ({ file, change, reported }) => {
    edit(file, change);
    const { errors } = checkLexicon({ dir });
    expect(errors.join('\n')).toContain(reported);
  });

  it('finds the spelling points the word alone cannot decide, and their sentence gaps', () => {
    const { model } = checkLexicon();
    // být × bít by the i/y pad, vila × víla by length, děti × dětí by the pad's í.
    expect(model.ambiguous).toEqual(
      expect.arrayContaining(['byyt:1', 'biit:1', 'vila:1', 'viila:1', 'dexti:3']),
    );
    expect(model.ambiguous).not.toContain('ryba:1');
    // vowels.14 (bílá v{i|í}la) tests the point at 1 of vila.
    expect(model.gapPoints.get('vowels.14')).toEqual([1]);
  });

  it('reports a BOM and CR line endings', () => {
    const path = join(dir, 'vowels.json');
    writeFileSync(path, `\uFEFF${readFileSync(path, 'utf8').replace(/\n/g, '\r\n')}`);
    const { errors } = checkLexicon({ dir });
    expect(errors).toEqual([
      'vowels.json: starts with a BOM',
      'vowels.json: contains CR characters (use LF)',
    ]);
  });

  it('stops at a file that is not JSON, and at a missing word bank', () => {
    writeFileSync(join(dir, 'vowels.json'), '{ "topic": "vowels", ');
    const broken = checkLexicon({ dir });
    expect(broken.errors).toHaveLength(1);
    expect(broken.errors[0]).toMatch(/^vowels\.json: is not readable UTF-8 JSON/);
    const missing = join(dir, 'missing');
    expect(checkLexicon({ dir: missing }).errors).toEqual([`${missing}: does not exist`]);
  });

  it('transliterates lemmas into content IDs', () => {
    expect(translit('být')).toBe('byyt');
    expect(translit('dům')).toBe('duom');
    expect(translit('úplněk')).toBe('uuplnexk');
    expect(translit('přímořský')).toBe('prxiimorxskyy');
    expect(translit('Ruzyně')).toBe('ruzynex');
    expect(translit('blýskat se')).toBe('blyyskat-se');
  });

  it('parses marked strings into the plain text and its gaps', () => {
    expect(parseMarked('r{y|i}bn{í|ý}k')).toEqual({
      plain: 'rybník',
      gaps: [
        { start: 1, end: 2, correct: 'y', alts: ['i'] },
        { start: 4, end: 5, correct: 'í', alts: ['ý'] },
      ],
    });
    expect(parseMarked('{odplavala|od plavala} k útesu').gaps).toEqual([
      { start: 0, end: 9, correct: 'odplavala', alts: ['od plavala'] },
    ]);
    expect(() => parseMarked('ml{ý}n')).toThrow(/needs an answer and an alternative/);
    expect(() => parseMarked('ml{ý|ín')).toThrow(/unclosed/);
    expect(() => parseMarked('ml|n')).toThrow(/stray/);
  });

  it('exits 0 on the word bank, 1 on a problem and 2 on an unknown option', () => {
    const ok = spawnSync(process.execPath, [CHECKER, '--summary'], { encoding: 'utf8' });
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toMatch(
      /^lexicon: OK \(\d+ words, \d+ families, \d+ sentences in \d+ files\)$/m,
    );
    expect(ok.stdout).toMatch(/^parts of speech: .*\bnoun \d+/m);

    edit('vyjmenovana-l.json', (d) => (word(d, 'mlyyn').spell = 'ml{í|ý}n'));
    const bad = spawnSync(process.execPath, [CHECKER, '--dir', dir], { encoding: 'utf8' });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/^lexicon: \d+ problems?$/m);
    expect(bad.stderr).toContain('vyjm needs y/ý');

    const usage = spawnSync(process.execPath, [CHECKER, '--fix'], { encoding: 'utf8' });
    expect(usage.status).toBe(2);
    expect(usage.stderr).toContain('Usage: node scripts/lexicon/check.mjs');
  });
});
