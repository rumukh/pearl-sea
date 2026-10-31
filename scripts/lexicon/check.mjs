#!/usr/bin/env node
// Linguistic invariants of the Czech word bank in content/lexicon-src (docs/lexicon.md).
// Dependency-free: node scripts/lexicon/check.mjs [--summary] [--dir <path>]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
const dirFlag = args.indexOf('--dir');
const DIR = dirFlag >= 0 ? args[dirFlag + 1] : join(here, '..', '..', 'content', 'lexicon-src');
const SUMMARY = args.includes('--summary');

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

// ---------------------------------------------------------------------------------------------
// Loading

function readJson(file) {
  const bytes = readFileSync(join(DIR, file));
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) fail(file, 'starts with a BOM');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (text.includes('\r')) fail(file, 'contains CR characters (use LF)');
  if (text.normalize('NFC') !== text) fail(file, 'is not NFC-normalised');
  return JSON.parse(text);
}

const vocab = readJson('vocabulary.json');
const sources = new Map(readJson('sources.json').sources.map((s) => [s.id, s]));
const topicFiles = readdirSync(DIR)
  .filter((f) => f.endsWith('.json') && f !== 'vocabulary.json' && f !== 'sources.json')
  .sort();
const topics = topicFiles.map((file) => ({ file, data: readJson(file) }));

// ---------------------------------------------------------------------------------------------
// Vocabulary

const ID_PATTERN = /^[a-z0-9]+(?:[-.:][a-z0-9]+)*$/;
const LOWER = 'aábcčdďeéěfghiíjklmnňoópqrřsštťuúůvwxyýzž';
const VOWELS = new Set([...vocab.vowels.short, ...vocab.vowels.long, 'ě']);
const HARD = new Set(vocab.consonants.hard);
const SOFT = new Set(vocab.consonants.soft);
const BOTH = new Set(vocab.consonants.bothWay);
const PAIR = new Map();
for (const [a, b] of vocab.pairedConsonants) {
  PAIR.set(a, b);
  PAIR.set(b, a);
}
const LENGTH = new Map();
for (const [s, l] of vocab.vowels.lengthPairs) {
  if (!LENGTH.has(s)) LENGTH.set(s, new Set());
  if (!LENGTH.has(l)) LENGTH.set(l, new Set());
  LENGTH.get(s).add(l);
  LENGTH.get(l).add(s);
}
const POS = new Set(vocab.partsOfSpeech.map((p) => p.id));
const PATTERNS = new Map(vocab.patterns.map((p) => [p.id, p]));
const RULES = new Map(vocab.rules.map((r) => [r.id, r]));
const SET_KINDS = new Set(vocab.setKinds);
const PROPER_KINDS = new Set(vocab.properKinds);
const TENSES = new Set(vocab.tenses.map((t) => t.id));
const MOODS = new Set(vocab.moods.map((m) => m.id));
const SENTENCE_ONLY_RULES = new Set(['shoda', 'mne-zajmeno', 'vzor', 'predpona-predlozka']);
const PREFIXES_WITH_VOICED_END = ['od', 'nad', 'pod', 'před', 'roz', 'bez'];
const VERB_FORM_KEYS = ['inf', 'pres', 'imp', 'past'];
const PAST_KEYS = ['m', 'f', 'n', 'ma', 'mi', 'fpl', 'npl'];

const isLetter = (ch) => ch !== undefined && LOWER.includes(ch.toLowerCase());
const isUpper = (ch) => isLetter(ch) && ch !== ch.toLowerCase();
const isVowel = (ch) => ch !== undefined && VOWELS.has(ch.toLowerCase());

// Characters a word bank string may contain: the Czech alphabet, digits and Czech punctuation
// available in the reading font.
const TEXT_CHARS = new RegExp(`^[${LOWER}${LOWER.toUpperCase()}0-9 .,!?:;–„“‚‘…()\\-]*$`);
function checkText(where, value) {
  if (typeof value !== 'string') return fail(where, `expected a string, got ${JSON.stringify(value)}`);
  if (value.normalize('NFC') !== value) fail(where, `"${value}" is not NFC`);
  if (!TEXT_CHARS.test(value)) {
    const bad = [...value].filter((c) => !TEXT_CHARS.test(c));
    fail(where, `"${value}" contains characters outside the Czech text set: ${JSON.stringify(bad)}`);
  }
  if (/ {2}|^ | $/.test(value)) fail(where, `"${value}" has stray spaces`);
}

const TRANSLIT = {
  á: 'aa', é: 'ee', í: 'ii', ó: 'oo', ú: 'uu', ý: 'yy', ů: 'uo',
  č: 'cx', ď: 'dx', ě: 'ex', ň: 'nx', ř: 'rx', š: 'sx', ť: 'tx', ž: 'zx',
};
function translit(lemma) {
  return [...lemma.toLowerCase()].map((c) => TRANSLIT[c] ?? (c === ' ' ? '-' : c)).join('');
}

// Czech primary collation: ch is a letter after h; č ř š ž are letters; other diacritics fold.
const PRIMARY = new Map(vocab.collation.primary.map((l, i) => [l, i]));
function collationKey(word) {
  const w = word.toLowerCase();
  const key = [];
  for (let i = 0; i < w.length; i++) {
    if (w[i] === 'c' && w[i + 1] === 'h') {
      key.push(PRIMARY.get('ch'));
      i++;
      continue;
    }
    const folded = vocab.collation.fold[w[i]] ?? w[i];
    if (!PRIMARY.has(folded)) continue;
    key.push(PRIMARY.get(folded));
  }
  return key;
}
function compareKeys(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

// ---------------------------------------------------------------------------------------------
// Marked strings: "ml{ý|í}n" = the form "mlýn" with a gap whose answer is ý and alternative í.

function parseMarked(text) {
  let plain = '';
  const gaps = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      const close = text.indexOf('}', i);
      if (close < 0) throw new Error('unclosed {');
      const inner = text.slice(i + 1, close);
      if (inner.includes('{')) throw new Error('nested {');
      const [correct, ...alts] = inner.split('|');
      if (!correct || alts.length === 0) throw new Error(`gap {${inner}} needs an answer and an alternative`);
      gaps.push({ start: plain.length, end: plain.length + correct.length, correct, alts });
      plain += correct;
      i = close;
    } else if (ch === '}' || ch === '|') {
      throw new Error(`stray ${ch}`);
    } else {
      plain += ch;
    }
  }
  return { plain, gaps };
}

const TOKEN = /[\p{L}\d]+(?:-[\p{L}\d]+)*/gu;
function tokens(plain) {
  return [...plain.matchAll(TOKEN)].map((m) => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
}

// ---------------------------------------------------------------------------------------------
// Words: merged by ID across topic files

const words = new Map(); // id -> merged entry
const SCALAR_FIELDS = [
  'lemma', 'pos', 'gender', 'animate', 'pattern', 'numbers', 'proper', 'aspect', 'reflexive',
  'family', 'role', 'register', 'standard', 'loan', 'grade',
];
const STRUCT_FIELDS = ['paradigm', 'segments'];
const LIST_FIELDS = ['src', 'tags', 'forms', 'senses', 'topics'];
const KNOWN_WORD_FIELDS = new Set([
  'id', ...SCALAR_FIELDS, ...STRUCT_FIELDS, ...LIST_FIELDS, 'spell', 'rules', 'note',
]);

for (const { file, data } of topics) {
  const topic = basename(file, '.json');
  if (data.topic !== topic) fail(file, `"topic" must be "${topic}"`);
  for (const key of Object.keys(data)) {
    if (!['topic', 'title', 'grade', 'src', 'note', 'families', 'words', 'sentences', 'sets'].includes(key)) {
      fail(file, `unknown top-level key "${key}"`);
    }
  }
  if (![3, 4].includes(data.grade)) fail(file, '"grade" must be 3 or 4');
  checkText(`${file} title`, data.title);
  for (const s of data.src ?? []) if (!sources.has(s)) fail(file, `unknown source "${s}"`);

  for (const w of data.words ?? []) {
    const where = `${file} word ${w.id ?? JSON.stringify(w.lemma)}`;
    for (const key of Object.keys(w)) if (!KNOWN_WORD_FIELDS.has(key)) fail(where, `unknown field "${key}"`);
    const entry = { ...w, grade: w.grade ?? data.grade, topics: [topic, ...(w.topics ?? [])] };
    const points = [];
    if (w.spell !== undefined) points.push({ topic, file, spell: w.spell, rules: w.rules ?? [] });
    else if (w.rules !== undefined) fail(where, '"rules" without "spell"');
    const prev = words.get(w.id);
    if (!prev) {
      words.set(w.id, { ...entry, points, files: [file] });
      continue;
    }
    prev.files.push(file);
    prev.points.push(...points);
    for (const key of SCALAR_FIELDS) {
      if (key === 'grade') continue;
      if (entry[key] === undefined) continue;
      if (prev[key] === undefined) prev[key] = entry[key];
      else if (prev[key] !== entry[key]) {
        fail(where, `"${key}" ${JSON.stringify(entry[key])} conflicts with ${JSON.stringify(prev[key])} in ${prev.files[0]}`);
      }
    }
    prev.grade = Math.min(prev.grade, entry.grade);
    for (const key of STRUCT_FIELDS) {
      if (entry[key] === undefined) continue;
      if (prev[key] === undefined) prev[key] = entry[key];
      else if (JSON.stringify(prev[key]) !== JSON.stringify(entry[key])) {
        fail(where, `"${key}" differs from the definition in ${prev.files[0]}`);
      }
    }
    for (const key of LIST_FIELDS) {
      if (entry[key] === undefined) continue;
      prev[key] = [...new Set([...(prev[key] ?? []), ...entry[key]])];
    }
  }
}

function formsOf(word) {
  const out = new Set([word.lemma]);
  const p = word.paradigm;
  if (p && word.pos === 'noun') {
    for (const num of ['sg', 'pl']) for (const cell of p[num] ?? []) for (const f of [cell].flat()) out.add(f);
  }
  if (p && word.pos === 'verb') {
    out.add(p.inf);
    for (const f of [...(p.pres ?? []), ...(p.imp ?? [])].flat()) out.add(f);
    for (const f of Object.values(p.past ?? {}).flat()) out.add(f);
  }
  for (const f of word.forms ?? []) out.add(f);
  if (word.reflexive) out.add(word.lemma.replace(/ s[ei]$/, ''));
  return out;
}

// Does the sentence, at the token starting at `start`, spell one of the word's forms?
function matchForm(plain, start, word, sentenceInitial) {
  for (const form of [...formsOf(word)].sort((a, b) => b.length - a.length)) {
    let candidate = plain.slice(start, start + form.length);
    if (isLetter(plain[start + form.length])) continue;
    if (candidate === form) return form;
    if (sentenceInitial && !word.proper) {
      candidate = candidate[0].toLowerCase() + candidate.slice(1);
      if (candidate === form) return form;
    }
  }
  return null;
}

function cellHas(cell, form) {
  return [cell].flat().includes(form);
}

// ---------------------------------------------------------------------------------------------
// Families

const families = new Map();
for (const { file, data } of topics) {
  for (const f of data.families ?? []) {
    const where = `${file} family ${f.id}`;
    if (families.has(f.id)) fail(where, 'duplicate family ID');
    families.set(f.id, { ...f, file });
    if (!ID_PATTERN.test(f.id)) fail(where, 'ID does not match the content ID pattern');
    if (f.letter !== null && !BOTH.has(f.letter)) fail(where, `"letter" must be one of b l m p s v z or null`);
    if (f.letter && !f.id.startsWith(`vyjm-${f.letter}.`)) fail(where, `a vyjmenovaná family ID starts with "vyjm-${f.letter}."`);
    if (!f.letter && !f.id.startsWith('fam.')) fail(where, 'an ordinary family ID starts with "fam."');
    for (const s of f.src ?? []) if (!sources.has(s)) fail(where, `unknown source "${s}"`);
    if (f.letter && f.core && !Number.isInteger(f.order)) fail(where, 'a core family needs its "order" in the school list');
    if (f.root !== undefined) for (const part of f.root.split('/')) checkText(`${where} root`, part);
  }
}

for (const [id, f] of families) {
  const where = `${f.file} family ${id}`;
  const head = words.get(f.head);
  if (!head) {
    fail(where, `head "${f.head}" is not a word`);
    continue;
  }
  if (head.family !== id || head.role !== 'head') fail(where, `head "${f.head}" must have family "${id}" and role "head"`);
  if (f.soundAlikeOf && !families.has(f.soundAlikeOf)) fail(where, `soundAlikeOf "${f.soundAlikeOf}" is not a family`);
  if (f.kin) {
    for (const [otherId, other] of families) {
      if (other.kin === f.kin && other.letter !== f.letter) fail(where, `kin "${f.kin}" is shared with ${otherId} of another letter`);
    }
  }
}

// The standard school lists are complete and in order.
for (const [letter, list] of Object.entries(vocab.schoolLists)) {
  const core = [...families.values()].filter((f) => f.letter === letter && f.core).sort((a, b) => a.order - b.order);
  const heads = core.map((f) => words.get(f.head)?.lemma);
  if (JSON.stringify(heads) !== JSON.stringify(list)) {
    fail(`school list ${letter.toUpperCase()}`, `core families give [${heads.join(', ')}], expected [${list.join(', ')}]`);
  }
  core.forEach((f, i) => {
    if (f.order !== i + 1) fail(`family ${f.id}`, `"order" must be ${i + 1}`);
  });
}

// ---------------------------------------------------------------------------------------------
// Spelling points

// Checks one gap in `form` (the plain token) under its rule. `gap` positions are relative to form.
function checkPoint(where, form, gap, rule, word, extra = {}) {
  const { start, end, correct, alts } = gap;
  const lower = form.toLowerCase();
  const prev = lower[start - 1];
  const prev2 = lower.slice(start - 2, start);
  const next = lower[end];
  const altSet = new Set(alts);
  const onlyAlts = (allowed) => alts.every((a) => allowed.includes(a));
  const iy = { y: 'i', ý: 'í', i: 'y', í: 'ý' };
  const family = word && word.family ? families.get(word.family) : undefined;
  if (altSet.size !== alts.length || alts.includes(correct)) fail(where, `alternatives ${JSON.stringify(alts)} repeat or include the answer`);
  if (!RULES.has(rule)) return fail(where, `unknown rule "${rule}"`);
  switch (rule) {
    case 'vyjm':
      if (!['y', 'ý'].includes(correct) || !onlyAlts([iy[correct]])) fail(where, `vyjm needs y/ý against i/í, got ${correct}/${alts}`);
      if (!family || !family.letter) fail(where, `vyjm: "${word?.id}" is not in a vyjmenovaná family`);
      else if (prev !== family.letter) fail(where, `vyjm: "${correct}" follows "${prev}", not the family letter "${family.letter}"`);
      break;
    case 'vyjm-prefix': {
      if (!['y', 'ý'].includes(correct) || !onlyAlts([iy[correct]])) fail(where, `vyjm-prefix needs y/ý against i/í`);
      const vAt = start - 1;
      if (prev !== 'v' || !(vAt === 0 || (vAt === 2 && lower.startsWith('ne')))) fail(where, 'vyjm-prefix: the gap must follow the prefix v- at the start');
      break;
    }
    case 'obojetna-i':
      if (!['i', 'í'].includes(correct) || !onlyAlts([iy[correct]])) fail(where, `obojetna-i needs i/í against y/ý`);
      if (!BOTH.has(prev)) fail(where, `obojetna-i: "${prev}" is not a both-way consonant`);
      if (family?.letter) fail(where, `obojetna-i: "${word.id}" is in the vyjmenovaná family ${family.id}`);
      break;
    case 'tvrda':
      if (!['y', 'ý'].includes(correct) || !onlyAlts([iy[correct]])) fail(where, `tvrda needs y/ý against i/í`);
      if (!(HARD.has(prev) || prev2 === 'ch')) fail(where, `tvrda: "${prev}" is not a hard consonant`);
      break;
    case 'mekka':
      if (!['i', 'í'].includes(correct) || !onlyAlts([iy[correct]])) fail(where, `mekka needs i/í against y/ý`);
      if (!SOFT.has(prev) || ['ď', 'ť', 'ň'].includes(prev)) fail(where, `mekka: "${prev}" is not ž š č ř c j`);
      break;
    case 'dtn-mekke':
      if (!['i', 'í'].includes(correct) || !onlyAlts([iy[correct]])) fail(where, `dtn-mekke needs i/í against y/ý`);
      if (!['d', 't', 'n'].includes(prev)) fail(where, `dtn-mekke: "${prev}" is not d, t or n`);
      break;
    case 'delka':
      if (!alts.every((a) => LENGTH.get(correct)?.has(a))) fail(where, `delka: ${correct}/${alts} are not a short/long pair`);
      break;
    case 'de-te-ne':
      if (correct !== 'ě' || !onlyAlts(['e'])) fail(where, 'de-te-ne needs ě against e');
      if (!['d', 't', 'n'].includes(prev)) fail(where, `de-te-ne: "${prev}" is not d, t or n`);
      break;
    case 'be-pe-ve-me':
      if (correct !== 'ě') fail(where, 'be-pe-ve-me needs ě');
      if (!['b', 'p', 'v', 'm'].includes(prev)) fail(where, `be-pe-ve-me: "${prev}" is not b, p, v or m`);
      else if (!onlyAlts(prev === 'm' ? ['ně', 'e'] : ['je', 'e'])) fail(where, `be-pe-ve-me: unexpected alternatives ${alts}`);
      break;
    case 'bje-vje':
      if (correct !== 'je' || !onlyAlts(['ě'])) fail(where, 'bje-vje needs je against ě');
      if (!((prev === 'b' && prev2 === 'ob') || (prev === 'v' && start === 1))) fail(where, 'bje-vje: je must follow the prefix ob- or v-');
      break;
    case 'mne':
      if (correct !== 'ně' || !onlyAlts(['ě'])) fail(where, 'mne needs ně against ě');
      if (prev !== 'm') fail(where, 'mne: the gap must follow m');
      break;
    case 'mne-zajmeno': {
      if (!['mě', 'mně'].includes(correct) || !onlyAlts(['mě', 'mně']) || start !== 0 || end !== form.length) {
        fail(where, 'mne-zajmeno: the gap is the whole word mě or mně');
      }
      const wanted = [3, 6].includes(extra.case) ? 'mně' : [2, 4].includes(extra.case) ? 'mě' : null;
      if (correct !== wanted) fail(where, `mne-zajmeno: case ${extra.case} needs "${wanted}"`);
      break;
    }
    case 'u-zacatek':
      if (correct.toLowerCase() !== 'ú' || !alts.every((a) => a.toLowerCase() === 'ů')) fail(where, 'u-zacatek needs ú against ů');
      if (start !== 0) fail(where, 'u-zacatek: ú must start the word');
      break;
    case 'u-predpona':
      if (correct !== 'ú' || !onlyAlts(['ů'])) fail(where, 'u-predpona needs ú against ů');
      if (start === 0) fail(where, 'u-predpona: ú must follow a prefix or the first part of the word');
      if (!extra.test || !extra.test.startsWith('ú') || !lower.slice(start).startsWith(extra.test.slice(0, 3))) {
        fail(where, `u-predpona: the test word "${extra.test}" must start with ú and match the word after the prefix`);
      }
      break;
    case 'u-uprostred':
      if (correct !== 'ů' || !onlyAlts(['ú'])) fail(where, 'u-uprostred needs ů against ú');
      if (start === 0) fail(where, 'u-uprostred: ů never starts a word');
      break;
    case 'u-prejate':
      if (correct !== 'ú' || !onlyAlts(['ů'])) fail(where, 'u-prejate needs ú against ů');
      if (start === 0) fail(where, 'u-prejate: use u-zacatek for a word-initial ú');
      if (!word?.loan) fail(where, `u-prejate: "${word?.id}" must be marked "loan": true`);
      break;
    case 'parova': {
      if (PAIR.get(correct) === undefined || !onlyAlts([PAIR.get(correct)])) fail(where, `parova: ${correct}/${alts} are not a consonant pair`);
      if (next !== undefined && (isVowel(next) || !isLetter(next))) fail(where, 'parova: the consonant must end the word or stand before another consonant');
      const test = extra.test;
      if (!test) {
        fail(where, 'parova needs a test word');
        break;
      }
      const t = test.toLowerCase();
      let ok = false;
      // ď ť ň are written d t n before ě, i, í: loď is tested by lodě.
      const spelled = { ď: ['dě', 'di', 'dí'], ť: ['tě', 'ti', 'tí'], ň: ['ně', 'ni', 'ní'] }[correct];
      for (let i = 0; i < t.length; i++) if (t.startsWith(correct, i) && isVowel(t[i + correct.length])) ok = true;
      if (spelled?.some((s) => t.includes(s))) ok = true;
      if (!ok || t[0] !== lower[0]) fail(where, `parova: the test word "${test}" must start like the word and have "${correct}" before a vowel`);
      break;
    }
    case 'velke-pismeno':
      if (!isUpper(correct[0]) || !onlyAlts([correct.toLowerCase()]) || start !== 0) fail(where, 'velke-pismeno: a capital first letter against its small letter');
      if (word && !word.proper) fail(where, `velke-pismeno: "${word.id}" is not a proper name`);
      break;
    case 'predpona-souhlaska': {
      if (!['d', 'z'].includes(correct) || !onlyAlts([PAIR.get(correct)])) fail(where, 'predpona-souhlaska needs d/z against t/s');
      const prefix = word?.segments?.prefix ?? '';
      const head = lower.slice(0, end);
      if (!PREFIXES_WITH_VOICED_END.some((p) => head.endsWith(p)) || !prefix.endsWith(head.slice(-2))) {
        fail(where, `predpona-souhlaska: the gap must end one of the prefixes ${PREFIXES_WITH_VOICED_END.join(', ')} (segments.prefix "${prefix}")`);
      }
      break;
    }
    case 'shoda':
      if (!['i', 'y', 'a'].includes(correct) || !onlyAlts(['i', 'y', 'a']) || end !== form.length) fail(where, 'shoda: the ending -i/-y/-a of the past tense');
      break;
    case 'vzor':
    case 'predpona-predlozka':
      break;
    default:
      fail(where, `rule "${rule}" has no check`);
  }
}

// Word-level spelling points and per-word checks
for (const [id, w] of words) {
  const where = `${w.files[0]} word ${id}`;
  if (typeof id !== 'string' || !ID_PATTERN.test(id) || id.length > 64) fail(where, 'ID does not match the content ID pattern');
  checkText(`${where} lemma`, w.lemma);
  const base = translit(w.lemma);
  if (id !== base && !(id.startsWith(`${base}.`) && /^[a-z0-9-]+$/.test(id.slice(base.length + 1)))) {
    fail(where, `ID must be "${base}" or "${base}.<sense>"`);
  }
  if (!POS.has(w.pos)) fail(where, `unknown pos "${w.pos}"`);
  if (![3, 4].includes(w.grade)) fail(where, 'grade must be 3 or 4');
  for (const s of w.src ?? []) if (!sources.has(s)) fail(where, `unknown source "${s}"`);
  if (!w.src?.length) fail(where, 'needs at least one source');
  for (const f of w.forms ?? []) checkText(`${where} form`, f);
  for (const s of w.senses ?? []) checkText(`${where} sense`, s);
  if (w.senses && w.senses.length < 2) fail(where, '"senses" lists at least two meanings');
  if (w.proper !== undefined && !PROPER_KINDS.has(w.proper)) fail(where, `unknown proper-name kind "${w.proper}"`);
  if (w.proper && !isUpper(w.lemma[0])) fail(where, 'a proper name starts with a capital letter');
  if (!w.proper && isUpper(w.lemma[0])) fail(where, 'a capitalised lemma needs "proper"');

  if (w.pos === 'noun') {
    if (!['m', 'f', 'n'].includes(w.gender)) fail(where, 'a noun needs gender m, f or n');
    if (w.gender === 'm' && typeof w.animate !== 'boolean') fail(where, 'a masculine noun needs "animate"');
    if (w.gender !== 'm' && w.animate !== undefined) fail(where, '"animate" is for masculine nouns only');
    const numbers = w.numbers ?? 'both';
    if (!['both', 'sg', 'pl'].includes(numbers)) fail(where, '"numbers" must be both, sg or pl');
    if (w.pattern !== undefined && w.pattern !== null) {
      const pat = PATTERNS.get(w.pattern);
      if (!pat) fail(where, `unknown pattern "${w.pattern}"`);
      else {
        if (pat.gender !== w.gender || (pat.gender === 'm' && pat.animate !== w.animate)) {
          fail(where, `pattern "${w.pattern}" is ${pat.gender}${pat.gender === 'm' ? (pat.animate ? ' animate' : ' inanimate') : ''}, the noun is ${w.gender}${w.gender === 'm' ? (w.animate ? ' animate' : ' inanimate') : ''}`);
        }
        const nom = numbers === 'pl' ? null : w.lemma.toLowerCase();
        const last = nom?.slice(-1);
        const ok =
          nom === null ||
          (pat.nominative === 'consonant' && !isVowel(last)) ||
          (pat.nominative === 'e' && (last === 'e' || last === 'ě')) ||
          last === pat.nominative;
        if (!ok) fail(where, `"${w.lemma}" does not end like the pattern ${pat.word} (${pat.nominative})`);
      }
    }
    if (w.paradigm) {
      for (const num of numbers === 'both' ? ['sg', 'pl'] : [numbers]) {
        const cells = w.paradigm[num];
        if (!Array.isArray(cells) || cells.length !== 7) fail(where, `paradigm.${num} needs 7 cases`);
        else for (const cell of cells) for (const f of [cell].flat()) checkText(`${where} paradigm`, f);
      }
      for (const num of Object.keys(w.paradigm)) if (!['sg', 'pl'].includes(num)) fail(where, `paradigm has unknown key "${num}"`);
      const nomCell = numbers === 'pl' ? w.paradigm.pl?.[0] : w.paradigm.sg?.[0];
      if (nomCell && [nomCell].flat()[0] !== w.lemma) fail(where, 'the first nominative form must be the lemma');
    }
  } else {
    for (const key of ['gender', 'animate', 'pattern', 'numbers']) if (w[key] !== undefined && w.pos !== 'noun') fail(where, `"${key}" is for nouns`);
  }

  if (w.pos === 'verb') {
    if (!['impf', 'pf'].includes(w.aspect)) fail(where, 'a verb needs aspect impf or pf');
    if (w.reflexive !== undefined && !['se', 'si'].includes(w.reflexive)) fail(where, '"reflexive" must be se or si');
    if (w.reflexive && !w.lemma.endsWith(` ${w.reflexive}`)) fail(where, `a reflexive lemma ends with " ${w.reflexive}"`);
    if (!w.reflexive && / s[ei]$/.test(w.lemma)) fail(where, 'the lemma ends with se/si: set "reflexive"');
    if (w.paradigm) {
      for (const key of Object.keys(w.paradigm)) if (!VERB_FORM_KEYS.includes(key)) fail(where, `paradigm has unknown key "${key}"`);
      if (w.paradigm.inf !== w.lemma.replace(/ s[ei]$/, '')) fail(where, 'paradigm.inf must be the lemma without se/si');
      if (w.paradigm.pres && w.paradigm.pres.length !== 6) fail(where, 'paradigm.pres needs 6 forms (1-3 sg, 1-3 pl)');
      if (w.paradigm.imp && w.paradigm.imp.length !== 3) fail(where, 'paradigm.imp needs 3 forms (2 sg, 1 pl, 2 pl)');
      if (w.paradigm.past) {
        for (const k of PAST_KEYS) if (w.paradigm.past[k] === undefined) fail(where, `paradigm.past.${k} is missing`);
        for (const k of Object.keys(w.paradigm.past)) if (!PAST_KEYS.includes(k)) fail(where, `paradigm.past has unknown key "${k}"`);
      }
    }
  } else if (w.aspect !== undefined || w.reflexive !== undefined) {
    fail(where, '"aspect" and "reflexive" are for verbs');
  }

  if (w.register !== undefined) {
    if (!['standard', 'colloquial'].includes(w.register)) fail(where, '"register" must be standard or colloquial');
    if (w.register === 'colloquial') {
      const std = words.get(w.standard);
      if (!std) fail(where, `standard twin "${w.standard}" is not a word`);
      else if (std.register === 'colloquial') fail(where, 'the standard twin must not be colloquial');
    } else if (w.standard !== undefined) fail(where, '"standard" belongs to a colloquial word');
  }

  if (w.family !== undefined) {
    const fam = families.get(w.family);
    if (!fam) fail(where, `family "${w.family}" does not exist`);
    if (!['head', 'member'].includes(w.role)) fail(where, '"role" must be head or member');
    if (fam && w.role === 'head' && fam.head !== id) fail(where, `only ${fam.head} is the head of ${fam.id}`);
    if (fam?.letter && !w.points.some((p) => (p.rules ?? []).some((r) => (r.rule ?? r) === 'vyjm'))) {
      fail(where, `a word of the vyjmenovaná family ${fam.id} needs its vyjm spelling point`);
    }
  } else if (w.role !== undefined) fail(where, '"role" without "family"');

  if (w.segments) {
    const s = w.segments;
    for (const key of Object.keys(s)) if (!['prefix', 'root', 'suffix', 'ending'].includes(key)) fail(where, `segments has unknown key "${key}"`);
    for (const key of ['prefix', 'root', 'suffix', 'ending']) if (typeof s[key] !== 'string') fail(where, `segments.${key} must be a string ("" when empty)`);
    if (!s.root) fail(where, 'segments.root is empty');
    const rebuilt = `${s.prefix}${s.root}${s.suffix}${s.ending}`;
    if (rebuilt !== w.lemma.toLowerCase()) fail(where, `segments rebuild "${rebuilt}", not "${w.lemma}"`);
  }

  const seen = new Map(); // position -> correct
  for (const p of w.points) {
    let parsed;
    try {
      parsed = parseMarked(p.spell);
    } catch (e) {
      fail(where, `spell "${p.spell}": ${e.message}`);
      continue;
    }
    if (parsed.plain !== w.lemma) fail(where, `spell "${p.spell}" spells "${parsed.plain}", not the lemma "${w.lemma}"`);
    if (parsed.gaps.length !== p.rules.length) fail(where, `spell "${p.spell}" has ${parsed.gaps.length} gaps but ${p.rules.length} rules`);
    parsed.gaps.forEach((gap, i) => {
      const r = p.rules[i];
      if (r === undefined) return;
      const rule = typeof r === 'string' ? r : r.rule;
      if (SENTENCE_ONLY_RULES.has(rule)) return fail(where, `rule "${rule}" belongs in sentences`);
      checkPoint(`${where} spell "${p.spell}" gap ${i + 1}`, parsed.plain, gap, rule, w, typeof r === 'string' ? {} : r);
      const key = `${gap.start}`;
      if (seen.has(key) && seen.get(key) !== gap.correct) fail(where, `two spelling points at position ${gap.start} disagree`);
      seen.set(key, gap.correct);
    });
  }
}

// Same lemma and part of speech under two IDs: homographs must be told apart.
const byLemma = new Map();
for (const [id, w] of words) {
  const key = `${w.lemma}|${w.pos}`;
  if (!byLemma.has(key)) byLemma.set(key, []);
  byLemma.get(key).push(id);
}
for (const [key, ids] of byLemma) {
  if (ids.length < 2) continue;
  for (const id of ids) {
    if (!words.get(id).note) fail(`word ${id}`, `homograph of ${ids.join(', ')} (${key}) needs a "note" telling the meanings apart`);
  }
}

// ---------------------------------------------------------------------------------------------
// Sets

for (const { file, data } of topics) {
  for (const set of data.sets ?? []) {
    const where = `${file} set ${set.id}`;
    if (!set.id || !ID_PATTERN.test(set.id)) fail(where, 'set ID does not match the content ID pattern');
    if (!SET_KINDS.has(set.kind)) {
      fail(where, `unknown set kind "${set.kind}"`);
      continue;
    }
    const need = (ids) => ids.map((id) => words.get(id) ?? (fail(where, `"${id}" is not a word`), null));
    if (set.kind === 'alphabet') {
      const ws = need(set.words ?? []);
      if (ws.length < 3) fail(where, 'an alphabet set has at least 3 words');
      for (let i = 1; i < ws.length; i++) {
        if (!ws[i] || !ws[i - 1]) continue;
        const c = compareKeys(collationKey(ws[i - 1].lemma), collationKey(ws[i].lemma));
        if (c === 0) fail(where, `"${ws[i - 1].lemma}" and "${ws[i].lemma}" tie at the primary level`);
        if (c > 0) fail(where, `"${ws[i - 1].lemma}" must come after "${ws[i].lemma}"`);
      }
    } else if (set.kind === 'synonyms' || set.kind === 'antonyms') {
      const ws = need(set.words ?? []);
      if (set.kind === 'antonyms' && ws.length !== 2) fail(where, 'an antonym set has exactly 2 words');
      if (ws.length < 2) fail(where, 'a synonym set has at least 2 words');
      if (new Set(ws.filter(Boolean).map((w) => w.pos)).size > 1) fail(where, 'words of a set share their part of speech');
    } else if (set.kind === 'hyponyms') {
      const [general] = need([set.general]);
      const specific = need(set.specific ?? []);
      if (specific.length < 2) fail(where, 'a hyponym set lists at least 2 specific words');
      for (const w of [general, ...specific]) if (w && w.pos !== 'noun') fail(where, `"${w.id}" is not a noun`);
    } else if (set.kind === 'sound-alikes' || set.kind === 'minimal-length') {
      const items = set.forms ?? [];
      if (items.length < 2 || (set.kind === 'minimal-length' && items.length !== 2)) fail(where, 'too few forms');
      for (const it of items) {
        const w = words.get(it.word);
        if (!w) fail(where, `"${it.word}" is not a word`);
        else if (!formsOf(w).has(it.form)) fail(where, `"${it.form}" is not a known form of ${it.word}`);
      }
      for (let i = 1; i < items.length; i++) {
        const a = items[0].form.toLowerCase();
        const b = items[i].form.toLowerCase();
        const diffs = [...a].map((c, k) => [c, b[k]]).filter(([x, y]) => x !== y);
        const okLen = a.length === b.length && diffs.length > 0;
        const ok =
          set.kind === 'sound-alikes'
            ? okLen && diffs.every(([x, y]) => (x === 'i' && y === 'y') || (x === 'y' && y === 'i') || (x === 'í' && y === 'ý') || (x === 'ý' && y === 'í'))
            : okLen && diffs.length === 1 && LENGTH.get(diffs[0][0])?.has(diffs[0][1]);
        if (!ok) fail(where, `"${items[0].form}" and "${items[i].form}" do not differ only in ${set.kind === 'sound-alikes' ? 'i/y' : 'vowel length'}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Sentences

const sentenceIds = new Set();
let sentenceCount = 0;
for (const { file, data } of topics) {
  for (const s of data.sentences ?? []) {
    sentenceCount++;
    const where = `${file} sentence ${s.id}`;
    if (!s.id || !ID_PATTERN.test(s.id)) fail(where, 'sentence ID does not match the content ID pattern');
    if (sentenceIds.has(s.id)) fail(where, 'duplicate sentence ID');
    sentenceIds.add(s.id);
    for (const key of Object.keys(s)) {
      if (!['id', 'text', 'grade', 'topics', 'gaps', 'marks', 'clauses', 'note'].includes(key)) fail(where, `unknown field "${key}"`);
    }
    let parsed;
    try {
      parsed = parseMarked(s.text);
    } catch (e) {
      fail(where, `text: ${e.message}`);
      continue;
    }
    const { plain, gaps } = parsed;
    checkText(where, plain);
    for (const g of gaps) for (const a of g.alts) checkText(`${where} alternative`, a);
    if (!(isUpper(plain[0]) || plain[0] === '„' || /\d/.test(plain[0]))) fail(where, 'starts with a capital letter');
    if (!/[.!?]“?$/.test(plain)) fail(where, 'ends with . ! or ?');
    const toks = tokens(plain);
    if (toks.length > 10) fail(where, `has ${toks.length} words (at most 10)`);
    const meta = s.gaps ?? [];
    if (meta.length !== gaps.length) fail(where, `${gaps.length} gaps but ${meta.length} gap records`);

    const findToken = (start) => toks.find((t) => t.start <= start && start < t.end);
    gaps.forEach((gap, i) => {
      const m = meta[i];
      if (!m) return;
      const gw = `${where} gap ${i + 1} {${gap.correct}|${gap.alts.join('|')}}`;
      if (!RULES.has(m.rule)) return fail(gw, `unknown rule "${m.rule}"`);
      const word = m.word !== undefined ? words.get(m.word) : undefined;
      if (m.word !== undefined && !word) return fail(gw, `"${m.word}" is not a word`);
      if (m.rule === 'predpona-predlozka') {
        const apart = gap.correct.includes(' ');
        const ok = gap.alts.every((a) => a.replace(/ /g, '') === gap.correct.replace(/ /g, '') && a.includes(' ') !== apart);
        if (!ok) fail(gw, 'together/apart alternatives differ only by the space');
        const together = apart ? gap.alts[0] : gap.correct;
        const prep = (apart ? gap.correct : gap.alts[0]).split(' ')[0];
        const prepWord = [...words.values()].find((w) => w.pos === 'prep' && w.lemma === prep.toLowerCase());
        if (apart && !prepWord) fail(gw, `"${prep}" is not a preposition in the word bank`);
        if (!apart) {
          if (!word) fail(gw, 'a prefix gap names its word');
          else if (!matchForm(plain, gap.start, word, gap.start === 0)) fail(gw, `"${together}" is not a known form of ${word.id}`);
          else if (!word.segments?.prefix || !together.toLowerCase().startsWith(word.segments.prefix) || word.segments.prefix !== prep.toLowerCase()) {
            fail(gw, `the prefix "${prep}" must be the word's segments.prefix`);
          }
        }
        return;
      }
      const tok = findToken(gap.start);
      if (!tok || gap.end > tok.end) return fail(gw, 'a gap stays inside one word');
      const local = { ...gap, start: gap.start - tok.start, end: gap.end - tok.start };
      if (word) {
        const form = matchForm(plain, tok.start, word, tok.start === 0);
        if (!form) fail(gw, `"${tok.text}" is not a known form of ${word.id} (add it to "forms" or the paradigm)`);
      } else if (!['shoda'].includes(m.rule)) {
        fail(gw, 'the gap names its word');
      }
      if (m.rule === 'vzor') {
        if (!word?.paradigm) return fail(gw, 'vzor needs a word with a paradigm');
        const cell = word.paradigm[m.number]?.[m.case - 1];
        const form = tok.start === 0 && !word.proper ? tok.text[0].toLowerCase() + tok.text.slice(1) : tok.text;
        if (!cell || !cellHas(cell, form)) fail(gw, `"${tok.text}" is not ${m.case}. pád ${m.number} of ${word.id}`);
        for (const alt of gap.alts) {
          const altForm = form.slice(0, local.start) + alt + form.slice(local.end);
          if (cell && cellHas(cell, altForm)) fail(gw, `the alternative "${altForm}" is also correct`);
        }
        return;
      }
      checkPoint(gw, tok.text, local, m.rule, word, m);
      if (m.rule === 'shoda') {
        const subjects = m.subjects ?? [];
        if (!subjects.length) return fail(gw, 'shoda names its subjects');
        if (word?.paradigm?.past && !Object.values(word.paradigm.past).flat().includes(tok.text)) {
          fail(gw, `"${tok.text}" is not a past form of ${word.id}`);
        }
        let anyAnimate = false;
        let allNeuterPlural = true;
        for (const subj of subjects) {
          const sw = words.get(subj.word);
          if (!sw) {
            fail(gw, `subject "${subj.word}" is not a word`);
            continue;
          }
          const number = subj.number ?? 'pl';
          const st = toks.find((t) => t.text === subj.t);
          if (!st) fail(gw, `subject token "${subj.t}" is not in the sentence`);
          else {
            if (st.start >= tok.start) fail(gw, `the subject "${subj.t}" must come before the predicate`);
            const nomCell = sw.paradigm?.[number]?.[0];
            const sform = st.start === 0 && !sw.proper ? subj.t[0].toLowerCase() + subj.t.slice(1) : subj.t;
            if (nomCell && !cellHas(nomCell, sform)) fail(gw, `"${subj.t}" is not the nominative ${number} of ${sw.id}`);
            if (!nomCell && !formsOf(sw).has(sform)) fail(gw, `"${subj.t}" is not a known form of ${sw.id}`);
          }
          if (sw.gender === 'm' && sw.animate) anyAnimate = true;
          if (!(sw.gender === 'n' && number === 'pl')) allNeuterPlural = false;
        }
        if (subjects.length === 1 && (subjects[0].number ?? 'pl') !== 'pl') fail(gw, 'a single subject of a shoda gap is plural');
        const expected = anyAnimate ? 'i' : allNeuterPlural ? 'a' : 'y';
        if (gap.correct !== expected) fail(gw, `agreement needs -${expected}, the gap says -${gap.correct}`);
      }
    });

    let predicates = 0;
    for (const mk of s.marks ?? []) {
      const mw = `${where} mark "${mk.t}"`;
      const tok = toks.find((t) => t.text === mk.t);
      if (!tok) {
        fail(mw, 'is not a word of the sentence');
        continue;
      }
      if (mk.role === 'predicate') predicates++;
      if (mk.role !== undefined && !['subject', 'predicate'].includes(mk.role)) fail(mw, `unknown role "${mk.role}"`);
      if (mk.pos !== undefined && !POS.has(mk.pos)) fail(mw, `unknown pos "${mk.pos}"`);
      if (mk.tense !== undefined && !TENSES.has(mk.tense)) fail(mw, `unknown tense "${mk.tense}"`);
      if (mk.mood !== undefined && !MOODS.has(mk.mood)) fail(mw, `unknown mood "${mk.mood}"`);
      if (mk.person !== undefined && ![1, 2, 3].includes(mk.person)) fail(mw, 'person must be 1, 2 or 3');
      if (mk.number !== undefined && !['sg', 'pl'].includes(mk.number)) fail(mw, 'number must be sg or pl');
      if (mk.case !== undefined && ![1, 2, 3, 4, 5, 6, 7].includes(mk.case)) fail(mw, 'case must be 1-7');
      if (mk.word === undefined) continue;
      const w = words.get(mk.word);
      if (!w) {
        fail(mw, `"${mk.word}" is not a word`);
        continue;
      }
      if (mk.pos !== undefined && mk.pos !== w.pos) fail(mw, `pos "${mk.pos}" differs from ${w.id}'s "${w.pos}"`);
      if (!matchForm(plain, tok.start, w, tok.start === 0)) fail(mw, `is not a known form of ${w.id}`);
      if (mk.case !== undefined && w.paradigm && w.pos === 'noun') {
        const cell = w.paradigm[mk.number ?? 'sg']?.[mk.case - 1];
        const form = tok.start === 0 && !w.proper ? mk.t[0].toLowerCase() + mk.t.slice(1) : mk.t;
        if (!cell || !cellHas(cell, form)) fail(mw, `is not ${mk.case}. pád ${mk.number ?? 'sg'} of ${w.id}`);
      }
    }
    if (s.clauses !== undefined) {
      if (!Number.isInteger(s.clauses) || s.clauses < 1) fail(where, '"clauses" is a positive integer');
      if (predicates && predicates !== s.clauses) fail(where, `${predicates} predicates marked for ${s.clauses} clauses`);
      if (!predicates) fail(where, '"clauses" needs the predicates marked');
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Report

if (SUMMARY) {
  const count = (pred) => [...words.values()].filter(pred).length;
  const lines = [];
  lines.push(`files: ${topics.length}, words: ${words.size}, families: ${families.size}, sentences: ${sentenceCount}`);
  lines.push(`grade 3 words: ${count((w) => w.grade === 3)}, grade 4 words: ${count((w) => w.grade === 4)}`);
  const byPos = {};
  for (const w of words.values()) byPos[w.pos] = (byPos[w.pos] ?? 0) + 1;
  lines.push(`parts of speech: ${Object.entries(byPos).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  const byRule = {};
  for (const w of words.values()) for (const p of w.points) for (const r of p.rules) byRule[r.rule ?? r] = (byRule[r.rule ?? r] ?? 0) + 1;
  lines.push(`word spelling points: ${Object.entries(byRule).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  const gapRules = {};
  for (const { data } of topics) for (const s of data.sentences ?? []) for (const g of s.gaps ?? []) gapRules[g.rule] = (gapRules[g.rule] ?? 0) + 1;
  lines.push(`sentence gaps: ${Object.entries(gapRules).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  const byPattern = {};
  for (const w of words.values()) if (w.pattern) byPattern[w.pattern] = (byPattern[w.pattern] ?? 0) + 1;
  lines.push(`noun patterns: ${Object.entries(byPattern).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  for (const letter of Object.keys(vocab.schoolLists)) {
    const fams = [...families.values()].filter((f) => f.letter === letter);
    const members = count((w) => fams.some((f) => f.id === w.family));
    lines.push(`vyjmenovaná ${letter.toUpperCase()}: ${fams.length} families, ${members} words`);
  }
  for (const { file, data } of topics) {
    lines.push(`  ${file}: ${(data.words ?? []).length} words, ${(data.sentences ?? []).length} sentences, ${(data.sets ?? []).length} sets, ${(data.families ?? []).length} families`);
  }
  console.log(lines.join('\n'));
}

if (errors.length) {
  console.error(`lexicon: ${errors.length} problem${errors.length === 1 ? '' : 's'}`);
  for (const e of errors) console.error(`  ${e}`);
  process.exitCode = 1;
} else {
  console.log(`lexicon: OK (${words.size} words, ${families.size} families, ${sentenceCount} sentences in ${topics.length} files)`);
}
