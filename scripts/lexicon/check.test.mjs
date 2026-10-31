// Self-test of scripts/lexicon/check.mjs: every injected fault must be reported.
// Dependency-free: node --test scripts/lexicon/check.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, '..', '..', 'content', 'lexicon-src');
const CHECK = join(here, 'check.mjs');

function run(dir) {
  const r = spawnSync(process.execPath, [CHECK, '--dir', dir], { encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

/** Copies the word bank, applies `mutate(dir)`, runs the checker and cleans up. */
function withMutation(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'lexicon-'));
  try {
    cpSync(SOURCE, dir, { recursive: true });
    mutate(dir);
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function edit(dir, file, change) {
  const path = join(dir, file);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  change(data);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

const word = (data, id) => data.words.find((w) => w.id === id);
const sentence = (data, id) => data.sentences.find((s) => s.id === id);

test('the word bank passes', () => {
  const { status, out } = run(SOURCE);
  assert.equal(status, 0, out);
});

const faults = [
  {
    name: 'a vyjmenované word spelled with i',
    file: 'vyjmenovana-l.json',
    change: (d) => (word(d, 'mlyyn').spell = 'ml{í|ý}n'),
    expect: 'vyjm needs y/ý',
  },
  {
    name: 'a vyjm gap after the wrong letter',
    file: 'vyjmenovana-b.json',
    change: (d) => (word(d, 'bystryy').spell = 'bystr{ý|í}'),
    expect: 'not the family letter',
  },
  {
    name: 'segments that do not rebuild the word',
    file: 'word-structure.json',
    change: (d) => (word(d, 'podmorxskyy').segments.root = 'mor'),
    expect: 'segments rebuild',
  },
  {
    name: 'a pattern that disagrees with gender and animacy',
    file: 'noun-patterns.json',
    change: (d) => (word(d, 'paan').pattern = 'hrad'),
    expect: 'pattern "hrad" is m inanimate',
  },
  {
    name: 'two files with conflicting facts',
    file: 'alphabet.json',
    change: (d) => (word(d, 'ryba').gender = 'm'),
    expect: 'conflicts with',
  },
  {
    name: 'an ID that is not the transliterated lemma',
    file: 'vyjmenovana-z.json',
    change: (d) => (word(d, 'brzy').lemma = 'brzi'),
    expect: 'ID must be',
  },
  {
    name: 'a gap word that is not a form of its word',
    file: 'vyjmenovana-l.json',
    change: (d) => (sentence(d, 'vyjm-l.04').text = 'U zátoky stojí starý ml{ý|í}nek.'),
    expect: 'is not a known form of mlyyn',
  },
  {
    name: 'a wrong agreement ending',
    file: 'sentences.json',
    change: (d) => (sentence(d, 'agree.02').text = 'Ryby plaval{i|y} v zátoce.'),
    expect: 'agreement needs -y',
  },
  {
    name: 'a subject after its predicate',
    file: 'sentences.json',
    change: (d) => {
      const s = sentence(d, 'agree.02');
      s.text = 'V zátoce plaval{y|i} ryby.';
      s.gaps[0].subjects[0].t = 'ryby';
    },
    expect: 'must come before the predicate',
  },
  {
    name: 'a sentence over ten words',
    file: 'vyjmenovana-b.json',
    change: (d) =>
      (sentence(d, 'vyjm-b.01').text =
        'Malí delfíni b{y|i}dlí v teplém a modrém moři u velkého ostrova.'),
    expect: 'at most 10',
  },
  {
    name: 'an incomplete school list',
    file: 'vyjmenovana-z.json',
    change: (d) => (d.families = d.families.filter((f) => f.id !== 'vyjm-z.brzy')),
    expect: 'school list Z',
  },
  {
    name: 'an alphabet set out of order',
    file: 'alphabet.json',
    change: (d) => (d.sets.find((s) => s.id === 'abc.03').words = ['hlubina', 'chaluha', 'humr']),
    expect: 'must come after',
  },
  {
    name: 'a paired consonant whose test word does not prove it',
    file: 'paired-consonants.json',
    change: (d) => (word(d, 'hrad').rules = [{ rule: 'parova', test: 'hradní' }]),
    expect: 'test word',
  },
  {
    name: 'a vzor gap with the wrong case',
    file: 'noun-patterns.json',
    change: (d) => (sentence(d, 'vzor.01').gaps[0].case = 4),
    expect: 'is not 4. pád',
  },
  {
    name: 'a mark with the wrong case',
    file: 'nouns.json',
    // ostrovu is both the 3rd and the 6th case; the 7th is ostrovem
    change: (d) => (sentence(d, 'case.09').marks[0].case = 7),
    expect: 'is not 7. pád',
  },
  {
    name: 'a sound-alike pair that differs in more than i/y',
    file: 'sound-alikes.json',
    change: (d) =>
      (d.sets.find((s) => s.id === 'alike.pyl-pil').forms[1] = { form: 'pít', word: 'piit' }),
    expect: 'do not differ only in i/y',
  },
  {
    name: 'a text that is not NFC',
    file: 'vowels.json',
    change: (d) => (sentence(d, 'vowels.03').text = 'Delf{í|i}n skáče přes vlny.'.normalize('NFD')),
    expect: 'NFC',
  },
];

for (const fault of faults) {
  test(`reports ${fault.name}`, () => {
    const { status, out } = withMutation((dir) => edit(dir, fault.file, fault.change));
    assert.equal(status, 1, `expected a failure:\n${out}`);
    assert.ok(out.includes(fault.expect), `expected "${fault.expect}" in:\n${out}`);
  });
}
