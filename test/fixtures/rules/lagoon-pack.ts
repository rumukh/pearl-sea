/**
 * A test content pack for the rules: Slunná laguna (the vertical slice, design §3.1) and the
 * first lesson and monster of Měsíční jeskyně (the 4th grade's start), with a small but real
 * lexicon. It stands in for S3's pack until that lands (docs/testing.md): the words, forms and
 * sentences are real Czech and original, but the content is S2's test fixture, not the game's.
 *
 * Built in code so that the noun paradigms stay readable, and validated by the contract's
 * `contentRegistration` like any pack.
 */
import { requireValue, validateContent } from '@aegis/runtime';
import type { ContentPack } from '@aegis/runtime';
import type { NarrativeGraph } from '@aegis/narrative';
import { CONSONANT_ITEMS, contentRegistration } from '../../../src/rules/contract';
import type {
  ContentData,
  Gender,
  Grade,
  Level,
  NounPattern,
  ProperKind,
  Segment,
  Sentence,
  Skill,
  SpellingPoint,
  SpellingRule,
  Word,
} from '../../../src/rules/contract';

const SRC = ['ujc'];

type Seven = [string | string[], string, string, string, string, string | string[], string];

function noun(
  id: string,
  lemma: string,
  options: {
    gender: Gender;
    animate?: boolean;
    pattern: NounPattern | null;
    sg?: Seven;
    pl?: Seven;
    proper?: ProperKind;
    grade?: Grade;
    topics?: string[];
    tags?: string[];
    spelling?: SpellingPoint[];
    segments?: Segment[];
    family?: { id: string; role: 'head' | 'related' };
  },
): Word {
  const numbers = options.sg && options.pl ? 'both' : options.sg ? 'sg' : 'pl';
  return {
    id,
    lemma,
    pos: 'noun',
    grade: options.grade ?? 3,
    topics: options.topics ?? [],
    tags: options.tags ?? [],
    src: SRC,
    noun: {
      gender: options.gender,
      ...(options.gender === 'm' ? { animate: options.animate ?? false } : {}),
      numbers,
      pattern: options.pattern,
      paradigm: {
        ...(options.sg ? { sg: options.sg } : {}),
        ...(options.pl ? { pl: options.pl } : {}),
      },
      ...(options.proper ? { proper: options.proper } : {}),
    },
    ...(options.family ? { family: options.family } : {}),
    ...(options.segments ? { segments: options.segments } : {}),
    ...(options.spelling ? { spelling: options.spelling } : {}),
  };
}

function other(
  id: string,
  lemma: string,
  pos: Word['pos'],
  options: {
    grade?: Grade;
    topics?: string[];
    tags?: string[];
    spelling?: SpellingPoint[];
    segments?: Segment[];
    family?: { id: string; role: 'head' | 'related' };
  } = {},
): Word {
  return {
    id,
    lemma,
    pos,
    grade: options.grade ?? 3,
    topics: options.topics ?? [],
    tags: options.tags ?? [],
    src: SRC,
    ...(options.family ? { family: options.family } : {}),
    ...(options.segments ? { segments: options.segments } : {}),
    ...(options.spelling ? { spelling: options.spelling } : {}),
  };
}

const point = (
  at: number,
  correct: string,
  alt: string[],
  rule: SpellingRule,
  test?: string,
): SpellingPoint => ({ at, correct, alt, rule, ...(test ? { test } : {}) });

/** Singular forms of a feminine noun like žena: `stem` + endings, with its 3rd/6th case. */
const zena = (stem: string, dative: string): Seven => [
  `${stem}a`,
  `${stem}y`,
  dative,
  `${stem}u`,
  `${stem}o`,
  dative,
  `${stem}ou`,
];

/** The lexicon: words of the lagoon's rules, the moon caves' families and a few names. */
const words: Word[] = [
  // Hard consonants: y after h ch k r d t n (tvrda).
  noun('ryba', 'ryba', {
    gender: 'f',
    pattern: 'zena',
    sg: zena('ryb', 'rybě'),
    pl: ['ryby', 'ryb', 'rybám', 'ryby', 'ryby', 'rybách', 'rybami'],
    topics: ['tvrde', 'plural'],
    tags: ['abc', 'sea'],
    spelling: [point(1, 'y', ['i'], 'tvrda')],
  }),
  noun('chyba', 'chyba', {
    gender: 'f',
    pattern: 'zena',
    sg: zena('chyb', 'chybě'),
    pl: ['chyby', 'chyb', 'chybám', 'chyby', 'chyby', 'chybách', 'chybami'],
    topics: ['tvrde', 'plural'],
    tags: ['abc'],
    spelling: [point(2, 'y', ['i'], 'tvrda')],
  }),
  noun('kytara', 'kytara', {
    gender: 'f',
    pattern: 'zena',
    sg: zena('kytar', 'kytaře'),
    pl: ['kytary', 'kytar', 'kytarám', 'kytary', 'kytary', 'kytarách', 'kytarami'],
    topics: ['tvrde', 'plural'],
    tags: ['abc'],
    spelling: [point(1, 'y', ['i'], 'tvrda')],
  }),
  noun('tyyden', 'týden', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['týden', 'týdne', 'týdnu', 'týden', 'týdne', 'týdnu', 'týdnem'],
    pl: ['týdny', 'týdnů', 'týdnům', 'týdny', 'týdny', 'týdnech', 'týdny'],
    topics: ['tvrde'],
    spelling: [point(1, 'ý', ['í'], 'tvrda')],
  }),
  noun('dyynex', 'dýně', {
    gender: 'f',
    pattern: 'ruze',
    sg: ['dýně', 'dýně', 'dýni', 'dýni', 'dýně', 'dýni', 'dýní'],
    pl: ['dýně', 'dýní', 'dýním', 'dýně', 'dýně', 'dýních', 'dýněmi'],
    topics: ['tvrde', 'de-te-ne'],
    spelling: [point(1, 'ý', ['í'], 'tvrda'), point(3, 'ě', ['e'], 'de-te-ne')],
  }),
  other('rychlyy', 'rychlý', 'adj', {
    topics: ['tvrde'],
    spelling: [point(1, 'y', ['i'], 'tvrda')],
  }),
  other('chytryy', 'chytrý', 'adj', {
    topics: ['tvrde'],
    spelling: [point(2, 'y', ['i'], 'tvrda')],
  }),
  // Soft consonants: i after ž š č ř c j ď ť ň (mekka).
  noun('sxipka', 'šipka', {
    gender: 'f',
    pattern: 'zena',
    sg: zena('šipk', 'šipce'),
    pl: ['šipky', 'šipek', 'šipkám', 'šipky', 'šipky', 'šipkách', 'šipkami'],
    topics: ['mekke', 'plural'],
    spelling: [point(1, 'i', ['y'], 'mekka')],
  }),
  noun('zxirafa', 'žirafa', {
    gender: 'f',
    pattern: 'zena',
    sg: zena('žiraf', 'žirafě'),
    pl: ['žirafy', 'žiraf', 'žirafám', 'žirafy', 'žirafy', 'žirafách', 'žirafami'],
    topics: ['mekke'],
    spelling: [point(1, 'i', ['y'], 'mekka')],
  }),
  noun('cibule', 'cibule', {
    gender: 'f',
    pattern: 'ruze',
    sg: ['cibule', 'cibule', 'cibuli', 'cibuli', 'cibule', 'cibuli', 'cibulí'],
    pl: ['cibule', 'cibulí', 'cibulím', 'cibule', 'cibule', 'cibulích', 'cibulemi'],
    topics: ['mekke'],
    tags: ['abc'],
    spelling: [point(1, 'i', ['y'], 'mekka')],
  }),
  noun('jiskra', 'jiskra', {
    gender: 'f',
    pattern: 'zena',
    sg: zena('jiskr', 'jiskře'),
    pl: ['jiskry', 'jisker', 'jiskrám', 'jiskry', 'jiskry', 'jiskrách', 'jiskrami'],
    topics: ['mekke'],
    tags: ['abc'],
    spelling: [point(1, 'i', ['y'], 'mekka')],
  }),
  other('cxistyy', 'čistý', 'adj', {
    topics: ['mekke'],
    spelling: [point(1, 'i', ['y'], 'mekka')],
  }),
  // bě pě vě mě inside a word (be-pe-ve-me).
  noun('obexd', 'oběd', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['oběd', 'obědu', 'obědu', 'oběd', 'obědě', ['obědě', 'obědu'], 'obědem'],
    pl: ['obědy', 'obědů', 'obědům', 'obědy', 'obědy', 'obědech', 'obědy'],
    topics: ['be-pe-ve-me'],
    spelling: [point(2, 'ě', ['je'], 'be-pe-ve-me')],
  }),
  noun('pexna', 'pěna', {
    gender: 'f',
    pattern: 'zena',
    sg: zena('pěn', 'pěně'),
    pl: ['pěny', 'pěn', 'pěnám', 'pěny', 'pěny', 'pěnách', 'pěnami'],
    topics: ['be-pe-ve-me'],
    tags: ['sea'],
    spelling: [point(1, 'ě', ['je'], 'be-pe-ve-me')],
  }),
  noun('mexsto', 'město', {
    gender: 'n',
    pattern: 'mesto',
    sg: ['město', 'města', 'městu', 'město', 'město', ['městě', 'městu'], 'městem'],
    pl: ['města', 'měst', 'městům', 'města', 'města', 'městech', 'městy'],
    topics: ['be-pe-ve-me', 'plural'],
    spelling: [point(1, 'ě', ['ně'], 'be-pe-ve-me')],
  }),
  noun('vexzx', 'věž', {
    gender: 'f',
    pattern: 'pisen',
    sg: ['věž', 'věže', 'věži', 'věž', 'věži', 'věži', 'věží'],
    pl: ['věže', 'věží', 'věžím', 'věže', 'věže', 'věžích', 'věžemi'],
    topics: ['be-pe-ve-me'],
    spelling: [point(1, 'ě', ['je'], 'be-pe-ve-me')],
  }),
  // Short and long vowels (delka): pas × pás are both words, so they are asked in sentences.
  noun('pas', 'pas', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['pas', 'pasu', 'pasu', 'pas', 'pase', 'pasu', 'pasem'],
    pl: ['pasy', 'pasů', 'pasům', 'pasy', 'pasy', 'pasech', 'pasy'],
    topics: ['delka'],
    spelling: [point(1, 'a', ['á'], 'delka')],
  }),
  noun('paas', 'pás', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['pás', 'pásu', 'pásu', 'pás', 'páse', 'pásu', 'pásem'],
    pl: ['pásy', 'pásů', 'pásům', 'pásy', 'pásy', 'pásech', 'pásy'],
    topics: ['delka'],
    spelling: [point(1, 'á', ['a'], 'delka')],
  }),
  noun('maak', 'mák', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['mák', 'máku', 'máku', 'mák', 'máku', 'máku', 'mákem'],
    pl: ['máky', 'máků', 'mákům', 'máky', 'máky', 'mácích', 'máky'],
    topics: ['delka'],
    tags: ['abc'],
    spelling: [point(1, 'á', ['a'], 'delka')],
  }),
  noun('draaha', 'dráha', {
    gender: 'f',
    pattern: 'zena',
    sg: ['dráha', 'dráhy', 'dráze', 'dráhu', 'dráho', 'dráze', 'dráhou'],
    pl: ['dráhy', 'drah', 'drahám', 'dráhy', 'dráhy', 'drahách', 'drahami'],
    topics: ['delka'],
    spelling: [point(2, 'á', ['a'], 'delka')],
  }),
  // dě tě ně (de-te-ne) and the soft di ti ni (dtn-mekke).
  noun('texlo', 'tělo', {
    gender: 'n',
    pattern: 'mesto',
    sg: ['tělo', 'těla', 'tělu', 'tělo', 'tělo', ['těle', 'tělu'], 'tělem'],
    pl: ['těla', 'těl', 'tělům', 'těla', 'těla', 'tělech', 'těly'],
    topics: ['de-te-ne'],
    spelling: [point(1, 'ě', ['e'], 'de-te-ne')],
  }),
  noun('diitex', 'dítě', {
    gender: 'n',
    pattern: null,
    sg: ['dítě', 'dítěte', 'dítěti', 'dítě', 'dítě', 'dítěti', 'dítětem'],
    pl: ['děti', 'dětí', 'dětem', 'děti', 'děti', 'dětech', 'dětmi'],
    topics: ['de-te-ne'],
    spelling: [point(1, 'í', ['ý'], 'dtn-mekke'), point(3, 'ě', ['e'], 'de-te-ne')],
  }),
  noun('ticho', 'ticho', {
    gender: 'n',
    pattern: 'mesto',
    sg: ['ticho', 'ticha', 'tichu', 'ticho', 'ticho', 'tichu', 'tichem'],
    topics: ['de-te-ne'],
    spelling: [point(1, 'i', ['y'], 'dtn-mekke')],
  }),
  other('tichyy', 'tichý', 'adj', {
    topics: ['de-te-ne'],
    spelling: [point(1, 'i', ['y'], 'dtn-mekke')],
  }),
  other('nikdo', 'nikdo', 'pron', {
    topics: ['de-te-ne'],
    spelling: [point(1, 'i', ['y'], 'dtn-mekke')],
  }),
  noun('dexda', 'děda', {
    gender: 'm',
    animate: true,
    pattern: 'predseda',
    sg: ['děda', 'dědy', 'dědovi', 'dědu', 'dědo', 'dědovi', 'dědou'],
    pl: ['dědové', 'dědů', 'dědům', 'dědy', 'dědové', 'dědech', 'dědy'],
    topics: ['de-te-ne'],
    spelling: [point(1, 'ě', ['e'], 'de-te-ne')],
  }),
  // ú at the start or after a prefix, ů inside a word.
  noun('uukol', 'úkol', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['úkol', 'úkolu', 'úkolu', 'úkol', 'úkole', 'úkolu', 'úkolem'],
    pl: ['úkoly', 'úkolů', 'úkolům', 'úkoly', 'úkoly', 'úkolech', 'úkoly'],
    topics: ['u'],
    spelling: [point(0, 'ú', ['ů'], 'u-zacatek')],
  }),
  noun('uusta', 'ústa', {
    gender: 'n',
    pattern: 'mesto',
    pl: ['ústa', 'úst', 'ústům', 'ústa', 'ústa', 'ústech', 'ústy'],
    topics: ['u'],
    spelling: [point(0, 'ú', ['ů'], 'u-zacatek')],
  }),
  noun('duom', 'dům', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['dům', 'domu', 'domu', 'dům', 'dome', ['domě', 'domu'], 'domem'],
    pl: ['domy', 'domů', 'domům', 'domy', 'domy', 'domech', 'domy'],
    topics: ['u', 'plural'],
    spelling: [point(1, 'ů', ['ú'], 'u-uprostred', 'domy')],
  }),
  noun('stuol', 'stůl', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['stůl', 'stolu', 'stolu', 'stůl', 'stole', ['stole', 'stolu'], 'stolem'],
    pl: ['stoly', 'stolů', 'stolům', 'stoly', 'stoly', 'stolech', 'stoly'],
    topics: ['u', 'plural'],
    spelling: [point(2, 'ů', ['ú'], 'u-uprostred', 'stoly')],
  }),
  other('neuuplnyy', 'neúplný', 'adj', {
    topics: ['u'],
    spelling: [point(2, 'ú', ['ů'], 'u-predpona')],
  }),
  // Paired consonants, proved by a test word (parova).
  noun('hrad', 'hrad', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['hrad', 'hradu', 'hradu', 'hrad', 'hrade', ['hradě', 'hradu'], 'hradem'],
    pl: ['hrady', 'hradů', 'hradům', 'hrady', 'hrady', 'hradech', 'hrady'],
    topics: ['parove', 'plural'],
    tags: ['abc'],
    spelling: [point(3, 'd', ['t'], 'parova', 'hrady')],
  }),
  noun('led', 'led', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['led', 'ledu', 'ledu', 'led', 'lede', ['ledě', 'ledu'], 'ledem'],
    pl: ['ledy', 'ledů', 'ledům', 'ledy', 'ledy', 'ledech', 'ledy'],
    topics: ['parove'],
    tags: ['abc'],
    spelling: [point(2, 'd', ['t'], 'parova', 'ledy')],
  }),
  noun('zub', 'zub', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['zub', 'zubu', 'zubu', 'zub', 'zube', 'zubu', 'zubem'],
    pl: ['zuby', 'zubů', 'zubům', 'zuby', 'zuby', 'zubech', 'zuby'],
    topics: ['parove', 'plural'],
    spelling: [point(2, 'b', ['p'], 'parova', 'zuby')],
  }),
  // Capital letters in names (velke-pismeno).
  noun('vltava', 'Vltava', {
    gender: 'f',
    pattern: 'zena',
    sg: zena('Vltav', 'Vltavě'),
    proper: 'river',
    topics: ['velka-pismena'],
    spelling: [point(0, 'V', ['v'], 'velke-pismeno')],
  }),
  noun('praha', 'Praha', {
    gender: 'f',
    pattern: 'zena',
    sg: ['Praha', 'Prahy', 'Praze', 'Prahu', 'Praho', 'Praze', 'Prahou'],
    proper: 'town',
    topics: ['velka-pismena'],
    spelling: [point(0, 'P', ['p'], 'velke-pismeno')],
  }),
  noun('aliik', 'Alík', {
    gender: 'm',
    animate: true,
    pattern: 'pan',
    sg: ['Alík', 'Alíka', 'Alíkovi', 'Alíka', 'Alíku', 'Alíkovi', 'Alíkem'],
    proper: 'animal',
    topics: ['velka-pismena'],
    spelling: [point(0, 'A', ['a'], 'velke-pismeno')],
  }),
  noun('petr', 'Petr', {
    gender: 'm',
    animate: true,
    pattern: 'pan',
    sg: ['Petr', 'Petra', 'Petrovi', 'Petra', 'Petře', 'Petrovi', 'Petrem'],
    proper: 'person',
    topics: ['velka-pismena'],
    spelling: [point(0, 'P', ['p'], 'velke-pismeno')],
  }),
  noun('ema', 'Ema', {
    gender: 'f',
    pattern: 'zena',
    sg: zena('Em', 'Emě'),
    proper: 'person',
    topics: ['velka-pismena'],
    spelling: [point(0, 'E', ['e'], 'velke-pismeno')],
  }),
  noun('brno', 'Brno', {
    gender: 'n',
    pattern: 'mesto',
    sg: ['Brno', 'Brna', 'Brnu', 'Brno', 'Brno', 'Brně', 'Brnem'],
    proper: 'town',
    topics: ['velka-pismena'],
    spelling: [point(0, 'B', ['b'], 'velke-pismeno')],
  }),
  noun('morava', 'Morava', {
    gender: 'f',
    pattern: 'zena',
    sg: zena('Morav', 'Moravě'),
    proper: 'river',
    topics: ['velka-pismena'],
    spelling: [point(0, 'M', ['m'], 'velke-pismeno')],
  }),
  // Měsíční jeskyně: word families and word structure (4th grade).
  noun('les', 'les', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['les', 'lesa', 'lesu', 'les', 'lese', ['lese', 'lesu'], 'lesem'],
    pl: ['lesy', 'lesů', 'lesům', 'lesy', 'lesy', 'lesích', 'lesy'],
    grade: 4,
    topics: ['stavba'],
    family: { id: 'les', role: 'head' },
    segments: [
      ['root', 'les'],
      ['ending', ''],
    ],
  }),
  noun('lesniik', 'lesník', {
    gender: 'm',
    animate: true,
    pattern: 'pan',
    sg: ['lesník', 'lesníka', 'lesníkovi', 'lesníka', 'lesníku', 'lesníkovi', 'lesníkem'],
    pl: ['lesníci', 'lesníků', 'lesníkům', 'lesníky', 'lesníci', 'lesnících', 'lesníky'],
    grade: 4,
    topics: ['stavba'],
    family: { id: 'les', role: 'related' },
    segments: [
      ['root', 'les'],
      ['suffix', 'ník'],
      ['ending', ''],
    ],
  }),
  other('lesnii', 'lesní', 'adj', {
    grade: 4,
    topics: ['stavba'],
    family: { id: 'les', role: 'related' },
    segments: [
      ['root', 'les'],
      ['suffix', 'n'],
      ['ending', 'í'],
    ],
  }),
  noun('lesiik', 'lesík', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['lesík', 'lesíku', 'lesíku', 'lesík', 'lesíku', 'lesíku', 'lesíkem'],
    pl: ['lesíky', 'lesíků', 'lesíkům', 'lesíky', 'lesíky', 'lesících', 'lesíky'],
    grade: 4,
    topics: ['stavba'],
    family: { id: 'les', role: 'related' },
    segments: [
      ['root', 'les'],
      ['suffix', 'ík'],
      ['ending', ''],
    ],
  }),
  noun('voda', 'voda', {
    gender: 'f',
    pattern: 'zena',
    sg: zena('vod', 'vodě'),
    pl: ['vody', 'vod', 'vodám', 'vody', 'vody', 'vodách', 'vodami'],
    grade: 4,
    topics: ['stavba'],
    family: { id: 'voda', role: 'head' },
    segments: [
      ['root', 'vod'],
      ['ending', 'a'],
    ],
  }),
  noun('vodniik', 'vodník', {
    gender: 'm',
    animate: true,
    pattern: 'pan',
    sg: ['vodník', 'vodníka', 'vodníkovi', 'vodníka', 'vodníku', 'vodníkovi', 'vodníkem'],
    pl: ['vodníci', 'vodníků', 'vodníkům', 'vodníky', 'vodníci', 'vodnících', 'vodníky'],
    grade: 4,
    topics: ['stavba'],
    family: { id: 'voda', role: 'related' },
    segments: [
      ['root', 'vod'],
      ['suffix', 'ník'],
      ['ending', ''],
    ],
  }),
  other('vodnii', 'vodní', 'adj', {
    grade: 4,
    topics: ['stavba'],
    family: { id: 'voda', role: 'related' },
    segments: [
      ['root', 'vod'],
      ['suffix', 'n'],
      ['ending', 'í'],
    ],
  }),
  other('podvodnii', 'podvodní', 'adj', {
    grade: 4,
    topics: ['stavba'],
    family: { id: 'voda', role: 'related' },
    segments: [
      ['prefix', 'pod'],
      ['root', 'vod'],
      ['suffix', 'n'],
      ['ending', 'í'],
    ],
  }),
  noun('morxe', 'moře', {
    gender: 'n',
    pattern: 'more',
    sg: ['moře', 'moře', 'moři', 'moře', 'moře', 'moři', 'mořem'],
    pl: ['moře', 'moří', 'mořím', 'moře', 'moře', 'mořích', 'moři'],
    grade: 4,
    topics: ['stavba'],
    family: { id: 'morxe', role: 'head' },
    segments: [
      ['root', 'moř'],
      ['ending', 'e'],
    ],
  }),
  other('morxskyy', 'mořský', 'adj', {
    grade: 4,
    topics: ['stavba'],
    family: { id: 'morxe', role: 'related' },
    segments: [
      ['root', 'moř'],
      ['suffix', 'sk'],
      ['ending', 'ý'],
    ],
  }),
  noun('naamorxniik', 'námořník', {
    gender: 'm',
    animate: true,
    pattern: 'pan',
    sg: [
      'námořník',
      'námořníka',
      'námořníkovi',
      'námořníka',
      'námořníku',
      'námořníkovi',
      'námořníkem',
    ],
    pl: [
      'námořníci',
      'námořníků',
      'námořníkům',
      'námořníky',
      'námořníci',
      'námořnících',
      'námořníky',
    ],
    grade: 4,
    topics: ['stavba'],
    family: { id: 'morxe', role: 'related' },
    segments: [
      ['prefix', 'ná'],
      ['root', 'moř'],
      ['suffix', 'ník'],
      ['ending', ''],
    ],
  }),
  // bje, vje at a prefix seam (bje-vje), for the moon caves' monster.
  noun('vjezd', 'vjezd', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['vjezd', 'vjezdu', 'vjezdu', 'vjezd', 'vjezde', 'vjezdu', 'vjezdem'],
    pl: ['vjezdy', 'vjezdů', 'vjezdům', 'vjezdy', 'vjezdy', 'vjezdech', 'vjezdy'],
    grade: 4,
    topics: ['bje-vje'],
    spelling: [point(1, 'je', ['ě'], 'bje-vje')],
  }),
  noun('objem', 'objem', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['objem', 'objemu', 'objemu', 'objem', 'objeme', 'objemu', 'objemem'],
    pl: ['objemy', 'objemů', 'objemům', 'objemy', 'objemy', 'objemech', 'objemy'],
    grade: 4,
    topics: ['bje-vje'],
    spelling: [point(2, 'je', ['ě'], 'bje-vje')],
  }),
  noun('objezd', 'objezd', {
    gender: 'm',
    animate: false,
    pattern: 'hrad',
    sg: ['objezd', 'objezdu', 'objezdu', 'objezd', 'objezde', 'objezdu', 'objezdem'],
    pl: ['objezdy', 'objezdů', 'objezdům', 'objezdy', 'objezdy', 'objezdech', 'objezdy'],
    grade: 4,
    topics: ['bje-vje'],
    spelling: [point(2, 'je', ['ě'], 'bje-vje')],
  }),
];

function sentence(id: string, text: string, gaps: Sentence['gaps'], topics: string[]): Sentence {
  return { id, grade: 3, topics, text, gaps };
}

const sentences: Sentence[] = [
  sentence(
    's.ryba-1',
    'R{y|i}ba plave v teplém moři.',
    [{ rule: 'tvrda', word: 'ryba', point: 1 }],
    ['tvrde-mekke'],
  ),
  sentence(
    's.chyba-1',
    'Krab udělal ve slově ch{y|i}bu.',
    [{ rule: 'tvrda', word: 'chyba', point: 2 }],
    ['tvrde-mekke'],
  ),
  sentence(
    's.sipka-1',
    'Š{i|y}pka ukazuje cestu k pokladu.',
    [{ rule: 'mekka', word: 'sxipka', point: 1 }],
    ['tvrde-mekke'],
  ),
  sentence(
    's.jiskra-1',
    'Ve vodě se zablýskla j{i|y}skra.',
    [{ rule: 'mekka', word: 'jiskra', point: 1 }],
    ['tvrde-mekke'],
  ),
  sentence(
    's.ticho-1',
    'T{i|y}chá r{y|i}ba spí pod kamenem.',
    [
      { rule: 'dtn-mekke', word: 'tichyy', point: 1 },
      { rule: 'tvrda', word: 'ryba', point: 1 },
    ],
    ['tvrde-mekke', 'de-te-ne'],
  ),
  sentence(
    's.pas-1',
    'Kapitán ukázal celníkovi svůj p{a|á}s.',
    [{ rule: 'delka', word: 'pas', point: 1 }],
    ['delka'],
  ),
  sentence(
    's.paas-1',
    'Želva má na krunýři zlatý p{á|a}s.',
    [{ rule: 'delka', word: 'paas', point: 1 }],
    ['delka'],
  ),
  sentence(
    's.mak-1',
    'Na koláči je hodně m{á|a}ku.',
    [{ rule: 'delka', word: 'maak', point: 1 }],
    ['delka'],
  ),
  sentence(
    's.draha-1',
    'Delfín skáče po dlouhé dr{á|a}ze.',
    [{ rule: 'delka', word: 'draaha', point: 2 }],
    ['delka'],
  ),
  sentence(
    's.obed-1',
    'Rybky už mají ob{ě|je}d.',
    [{ rule: 'be-pe-ve-me', word: 'obexd', point: 2 }],
    ['de-te-ne'],
  ),
  sentence(
    's.mesto-1',
    'Pod mořem leží potopené m{ě|ně}sto.',
    [{ rule: 'be-pe-ve-me', word: 'mexsto', point: 1 }],
    ['de-te-ne'],
  ),
  sentence(
    's.pena-1',
    'Vlny nesou bílou p{ě|je}nu.',
    [{ rule: 'be-pe-ve-me', word: 'pexna', point: 1 }],
    ['de-te-ne'],
  ),
  sentence(
    's.telo-1',
    'Medúza má průhledné t{ě|e}lo.',
    [{ rule: 'de-te-ne', word: 'texlo', point: 1 }],
    ['de-te-ne'],
  ),
  sentence(
    's.deti-1',
    'D{ě|e}ti staví na pláži hrad.',
    [{ rule: 'de-te-ne', word: null }],
    ['de-te-ne'],
  ),
  sentence(
    's.ticho-2',
    'V hlubině je t{i|y}cho.',
    [{ rule: 'dtn-mekke', word: 'ticho', point: 1 }],
    ['de-te-ne'],
  ),
  sentence(
    's.chytra-1',
    'Ch{y|i}trá r{y|i}ba našla š{i|y}pku.',
    [
      { rule: 'tvrda', word: 'chytryy', point: 2 },
      { rule: 'tvrda', word: 'ryba', point: 1 },
      { rule: 'mekka', word: 'sxipka', point: 1 },
    ],
    ['tvrde-mekke'],
  ),
  sentence(
    's.deda-1',
    'D{ě|e}da a d{í|ý}tě jedou do m{ě|ně}sta.',
    [
      { rule: 'de-te-ne', word: 'dexda', point: 1 },
      { rule: 'dtn-mekke', word: 'diitex', point: 1 },
      { rule: 'be-pe-ve-me', word: 'mexsto', point: 1 },
    ],
    ['de-te-ne'],
  ),
  sentence(
    's.dum-1',
    'Šnek nese na zádech svůj d{ů|ú}m.',
    [{ rule: 'u-uprostred', word: 'duom', point: 1 }],
    ['u-parove'],
  ),
  sentence(
    's.stul-1',
    'Na st{ů|ú}l položil námořník mapu.',
    [{ rule: 'u-uprostred', word: 'stuol', point: 2 }],
    ['u-parove'],
  ),
  sentence(
    's.ukol-1',
    'Bublinka dostala nový {ú|ů}kol.',
    [{ rule: 'u-zacatek', word: 'uukol', point: 0 }],
    ['u-parove'],
  ),
  sentence(
    's.hrad-1',
    'Na pláži stojí písečný hra{d|t}.',
    [{ rule: 'parova', word: 'hrad', point: 3 }],
    ['u-parove'],
  ),
  sentence(
    's.led-1',
    'Na severu plave le{d|t}.',
    [{ rule: 'parova', word: 'led', point: 2 }],
    ['u-parove'],
  ),
  sentence(
    's.vltava-1',
    'Řeka {V|v}ltava teče přes celé Čechy.',
    [{ rule: 'velke-pismeno', word: 'vltava', point: 0 }],
    ['velka-pismena'],
  ),
  sentence(
    's.praha-1',
    'Do {P|p}rahy jede vlak.',
    [{ rule: 'velke-pismeno', word: 'praha', point: 0 }],
    ['velka-pismena'],
  ),
  sentence(
    's.alik-1',
    'Pes {A|a}lík se cáká ve vlnách.',
    [{ rule: 'velke-pismeno', word: 'aliik', point: 0 }],
    ['velka-pismena'],
  ),
  sentence(
    's.hvezdice-1',
    '{M|m}ořská hvězdice spí na kameni.',
    [{ rule: 'velke-pismeno', word: null }],
    ['velka-pismena'],
  ),
];

function skill(
  id: string,
  strand: Skill['strand'],
  spec: Pick<Skill, 'generator' | 'params'>,
): Skill {
  return { id, titleKey: `skill.${id.slice(3)}`, strand, ...spec } as Skill;
}

const spellWord = (topics: string[], rules: SpellingRule[], choices = 2, maxGaps = 1) => ({
  generator: 'spell.word' as const,
  params: { words: { topics }, rules, maxGaps, choices },
});
const spellSentence = (topics: string[], rules: SpellingRule[]) => ({
  generator: 'spell.sentence' as const,
  params: { sentences: { topics }, rules },
});
const spellMistake = (topics: string[], rules: SpellingRule[]) => ({
  generator: 'spell.mistake' as const,
  params: { sentences: { topics }, rules },
});

const skills: Skill[] = [
  skill('sk.lagoon.abc', 'letters-sounds', {
    generator: 'alphabet',
    params: { words: { tags: ['abc'] }, order: 'alphabet', size: 6 },
  }),
  skill('sk.lagoon.consonants', 'letters-sounds', {
    generator: 'sort',
    params: {
      dimension: 'consonant',
      context: 'word',
      values: ['hard', 'soft', 'both-way'],
      words: {},
      fish: 9,
      cells: null,
    },
  }),
  ...(['hard', 'soft', 'both-way'] as const).map((klass) =>
    skill(`sk.lagoon.letters.${klass}`, 'letters-sounds', {
      generator: 'sort',
      params: {
        dimension: 'consonant',
        context: 'word',
        values: ['hard', 'soft', 'both-way'],
        words: {},
        fish: 9,
        cells: null,
        consonants: CONSONANT_ITEMS.filter((c) => c.value === klass).map((c) => c.id),
      },
    }),
  ),
  skill('sk.lagoon.hard', 'letters-sounds', spellWord(['tvrde'], ['tvrda'])),
  skill('sk.lagoon.soft', 'letters-sounds', spellWord(['mekke'], ['mekka'])),
  skill(
    'sk.lagoon.hard-soft.s',
    'letters-sounds',
    spellSentence(['tvrde-mekke'], ['tvrda', 'mekka']),
  ),
  skill('sk.lagoon.bepeveme', 'letters-sounds', spellWord(['be-pe-ve-me'], ['be-pe-ve-me'])),
  skill('sk.lagoon.length', 'letters-sounds', spellWord(['delka'], ['delka'])),
  skill('sk.lagoon.length.s', 'letters-sounds', spellSentence(['delka'], ['delka'])),
  skill(
    'sk.lagoon.dtn',
    'letters-sounds',
    spellWord(['de-te-ne'], ['de-te-ne', 'dtn-mekke'], 2, 2),
  ),
  skill(
    'sk.lagoon.dtn.s',
    'letters-sounds',
    spellSentence(['de-te-ne'], ['de-te-ne', 'dtn-mekke', 'be-pe-ve-me']),
  ),
  skill(
    'sk.lagoon.dtn.m',
    'letters-sounds',
    spellMistake(['de-te-ne'], ['de-te-ne', 'dtn-mekke', 'be-pe-ve-me']),
  ),
  skill(
    'sk.lagoon.u',
    'letters-sounds',
    spellWord(['u'], ['u-zacatek', 'u-predpona', 'u-uprostred']),
  ),
  skill('sk.lagoon.paired', 'letters-sounds', spellWord(['parove'], ['parova'])),
  skill(
    'sk.lagoon.u-paired.s',
    'letters-sounds',
    spellSentence(['u-parove'], ['u-zacatek', 'u-uprostred', 'parova']),
  ),
  skill('sk.lagoon.plural', 'nouns', {
    generator: 'pairs',
    params: { pair: 'plural', words: { topics: ['plural'] }, pairs: 4 },
  }),
  skill('sk.lagoon.capitals', 'letters-sounds', spellWord(['velka-pismena'], ['velke-pismeno'])),
  skill(
    'sk.lagoon.capitals.m',
    'letters-sounds',
    spellMistake(['velka-pismena'], ['velke-pismeno']),
  ),
  skill('sk.caves.family', 'word-structure', {
    generator: 'family',
    params: { words: { topics: ['stavba'] }, families: null, pick: 3, distractors: 2 },
  }),
  skill('sk.caves.segment', 'word-structure', {
    generator: 'segment',
    params: { words: { topics: ['stavba'] }, roles: ['root'] },
  }),
  skill('sk.caves.bjevje', 'prefixes', spellWord(['bje-vje'], ['bje-vje'])),
];

type Activity = Level['activities'][number];

const activity = (
  kind: Activity['kind'],
  skillIds: string[],
  count: number,
  input: Activity['input'] = 'auto',
): Activity => ({ kind, skills: skillIds, count, input, options: {} });

function level(
  id: string,
  order: number,
  kind: 'lesson' | 'monster',
  after: string[],
  activities: Activity[],
  options: { eggs?: string[]; cosmetics?: string[]; monster?: string; objectives: string[] },
): Level {
  return {
    id,
    region: id.slice(0, id.lastIndexOf('.')),
    order,
    titleKey: `level.${id}`,
    kind,
    unlock: { after },
    activities,
    stars: null,
    rewards: {
      coins: kind === 'monster' ? [4, 8, 12] : [2, 4, 6],
      eggs: options.eggs ?? [],
      cosmetics: options.cosmetics ?? [],
    },
    monster: options.monster ?? null,
    storyBeat: null,
    objectives: options.objectives,
  };
}

export const LAGOON_EGGS = ['krab-tvrdak', 'meduzka-mekulka', 'zelva-obojka'];
const LAGOON_OBJECTIVES = [
  'obj.letters.alphabet',
  'obj.letters.vowel-length',
  'obj.letters.hard-soft',
  'obj.letters.de-te-ne',
  'obj.letters.be-pe-ve-me',
  'obj.letters.u-ring',
  'obj.letters.paired',
  'obj.letters.capitals',
];

const levels: Level[] = [
  level(
    'sunny-lagoon.1',
    1,
    'lesson',
    [],
    [
      activity('pearl-necklace', ['sk.lagoon.abc'], 2),
      activity('fishing-nets', ['sk.lagoon.consonants'], 1),
      activity('feeding', ['sk.lagoon.hard', 'sk.lagoon.soft', 'sk.lagoon.bepeveme'], 10, 'choice'),
    ],
    { objectives: ['obj.letters.alphabet'] },
  ),
  level(
    'sunny-lagoon.2',
    2,
    'lesson',
    ['sunny-lagoon.1'],
    [
      activity('feeding', ['sk.lagoon.length'], 10, 'choice'),
      activity('ink-sentence', ['sk.lagoon.length.s'], 5),
    ],
    { objectives: ['obj.letters.vowel-length'] },
  ),
  level(
    'sunny-lagoon.3',
    3,
    'lesson',
    ['sunny-lagoon.2'],
    [
      activity('fishing-nets', ['sk.lagoon.consonants'], 2),
      activity('feeding', ['sk.lagoon.hard', 'sk.lagoon.soft'], 10),
      activity('ink-sentence', ['sk.lagoon.hard-soft.s'], 5),
    ],
    { eggs: LAGOON_EGGS, objectives: ['obj.letters.hard-soft'] },
  ),
  level(
    'sunny-lagoon.4',
    4,
    'lesson',
    ['sunny-lagoon.3'],
    [
      activity('feeding', ['sk.lagoon.dtn', 'sk.lagoon.bepeveme'], 10),
      activity('ink-sentence', ['sk.lagoon.dtn.s'], 5),
      activity('bug-hunt', ['sk.lagoon.dtn.m'], 4),
    ],
    { objectives: ['obj.letters.de-te-ne', 'obj.letters.be-pe-ve-me'] },
  ),
  level(
    'sunny-lagoon.5',
    5,
    'lesson',
    ['sunny-lagoon.4'],
    [
      activity('feeding', ['sk.lagoon.u', 'sk.lagoon.paired'], 10),
      activity('memory-match', ['sk.lagoon.plural'], 1),
      activity('ink-sentence', ['sk.lagoon.u-paired.s'], 5),
    ],
    { objectives: ['obj.letters.u-ring', 'obj.letters.paired'] },
  ),
  level(
    'sunny-lagoon.6',
    6,
    'lesson',
    ['sunny-lagoon.5'],
    [
      activity('feeding', ['sk.lagoon.capitals'], 10),
      activity('bug-hunt', ['sk.lagoon.capitals.m'], 5),
    ],
    { cosmetics: ['scarf-sea'], objectives: ['obj.letters.capitals'] },
  ),
  level(
    'sunny-lagoon.monster',
    7,
    'monster',
    ['sunny-lagoon.6'],
    [
      activity(
        'battle',
        [
          'sk.lagoon.hard',
          'sk.lagoon.soft',
          'sk.lagoon.bepeveme',
          'sk.lagoon.length',
          'sk.lagoon.dtn',
          'sk.lagoon.u',
          'sk.lagoon.paired',
          'sk.lagoon.capitals',
        ],
        20,
      ),
    ],
    { eggs: LAGOON_EGGS, monster: 'murena-mumla', objectives: LAGOON_OBJECTIVES },
  ),
  level(
    'moon-caves.1',
    1,
    'lesson',
    [],
    [
      activity('word-family', ['sk.caves.family'], 2),
      activity('word-shell', ['sk.caves.segment'], 2),
      activity('feeding', ['sk.caves.bjevje'], 8, 'choice'),
    ],
    { eggs: ['rak-korinek'], objectives: ['obj.structure.root'] },
  ),
  level(
    'moon-caves.monster',
    2,
    'monster',
    ['moon-caves.1'],
    [activity('battle', ['sk.caves.bjevje'], 13)],
    { eggs: ['rak-korinek'], monster: 'humr-nuzkar', objectives: ['obj.structure.root'] },
  ),
];

type Beat = ContentData['story']['beats'][number];

/** A beat: lines one after another (a "next" choice between them), rewards claimed at once. */
function beat(
  id: string,
  trigger: Beat['trigger'],
  skippable: boolean,
  scene: string,
  lines: number,
  rewards: string[] = [],
): Beat {
  const key = id.slice('beat.'.length);
  const texts = Array.from({ length: lines }, (_, i) => `story.${key}.${i + 1}`);
  const graph = {
    schema: 1,
    id: `story.${key}`,
    revision: '1',
    start: 'line-1',
    catalogs: {
      scene: [scene],
      text: [...texts, ...(lines > 1 ? ['story.next'] : [])],
      asset: [],
      clue: [],
      fact: [],
      glossary: [],
      reward: rewards,
      completion: [],
    },
    flags: [],
    items: [],
    data: [],
    effects: rewards.map((reward) => ({
      id: `claim-${reward}`,
      kind: 'claim',
      catalog: 'reward',
      ref: reward,
    })),
    nodes: texts.map((text, i) => ({
      id: `line-${i + 1}`,
      scene,
      text,
      narration: null,
      revisit: 'allow',
      entryEffects: i === 0 ? rewards.map((reward) => `claim-${reward}`) : [],
      choices:
        i + 1 < lines
          ? [{ id: 'next', text: 'story.next', to: `line-${i + 2}`, guard: null, effects: [] }]
          : [],
      automatic: [],
      resolveEnding: false,
    })),
    maxAutomaticSteps: 4,
    endings: [],
  } as unknown as NarrativeGraph;
  return { id, trigger, skippable, graph };
}

const cosmetic = (
  id: string,
  slot: 'head' | 'eyes' | 'neck' | 'grotto',
  price: number,
  unlock: string | null,
) => ({ id, slot, assetId: `cosmetic/${id}`, nameKey: `cosmetic.${id}`, price, unlock });

const sticker = (
  id: string,
  page: string,
  criteria: ContentData['stickers'][number]['criteria'],
  color: string,
) => ({
  id: `sticker.${id}`,
  nameKey: `sticker.${id}`,
  page,
  criteria,
  icon: `sticker/${id}`,
  color,
  frame: 'sticker/frame-shell',
});

const quest = (
  id: string,
  goal: ContentData['quests'][number]['goal'],
  target: number,
  coins: number,
  weight: number,
  unlock: string | null = null,
) => ({ id: `quest.${id}`, titleKey: `quest.${id}`, goal, target, coins, weight, unlock });

const data: ContentData = {
  grades: [
    { grade: 3, start: 'sunny-lagoon' },
    { grade: 4, start: 'moon-caves' },
  ],
  objectives: [
    ...LAGOON_OBJECTIVES.map((id) => ({
      id,
      strand: 'letters-sounds' as const,
      grade: 3 as const,
      titleKey: `grownups.objective.${id.slice(4)}`,
      rvp: ['ČJL-3-2-08'],
    })),
    {
      id: 'obj.structure.root',
      strand: 'word-structure',
      grade: 4,
      titleKey: 'grownups.objective.structure.root',
      rvp: ['ČJL-5-2-02'],
    },
  ],
  regions: [
    {
      id: 'sunny-lagoon',
      order: 1,
      titleKey: 'region.sunny-lagoon',
      unlock: { after: [] },
      monster: 'murena-mumla',
      map: 'shallows',
      grade: 3,
    },
    {
      id: 'moon-caves',
      order: 8,
      titleKey: 'region.moon-caves',
      unlock: { after: ['sunny-lagoon.monster'] },
      monster: 'humr-nuzkar',
      map: 'deep',
      grade: 4,
    },
  ],
  levels,
  skills,
  friends: [
    {
      id: 'krab-tvrdak',
      nameKey: 'friend.krab-tvrdak',
      mnemonicKey: 'friend.krab-tvrdak.mnemonic',
      region: 'sunny-lagoon',
      skills: ['sk.lagoon.letters.hard', 'sk.lagoon.hard', 'sk.lagoon.dtn', 'sk.lagoon.paired'],
      monster: 'murena-mumla',
    },
    {
      id: 'meduzka-mekulka',
      nameKey: 'friend.meduzka-mekulka',
      mnemonicKey: 'friend.meduzka-mekulka.mnemonic',
      region: 'sunny-lagoon',
      skills: ['sk.lagoon.letters.soft', 'sk.lagoon.soft', 'sk.lagoon.length', 'sk.lagoon.u'],
      monster: 'murena-mumla',
    },
    {
      id: 'zelva-obojka',
      nameKey: 'friend.zelva-obojka',
      mnemonicKey: 'friend.zelva-obojka.mnemonic',
      region: 'sunny-lagoon',
      skills: [
        'sk.lagoon.letters.both-way',
        'sk.lagoon.bepeveme',
        'sk.lagoon.abc',
        'sk.lagoon.capitals',
      ],
      monster: 'murena-mumla',
    },
    {
      id: 'rak-korinek',
      nameKey: 'friend.rak-korinek',
      mnemonicKey: 'friend.rak-korinek.mnemonic',
      region: 'moon-caves',
      skills: ['sk.caves.family', 'sk.caves.segment'],
      monster: 'humr-nuzkar',
    },
  ],
  monsters: [
    {
      id: 'murena-mumla',
      region: 'sunny-lagoon',
      nameKey: 'monster.murena-mumla',
      mood: 'grumpy',
      meter: 15,
      reviewShare: 20,
      jokes: [
        'monster.murena-mumla.joke.1',
        'monster.murena-mumla.joke.2',
        'monster.murena-mumla.joke.3',
      ],
    },
    {
      id: 'humr-nuzkar',
      region: 'moon-caves',
      nameKey: 'monster.humr-nuzkar',
      mood: 'sulky',
      meter: 8,
      reviewShare: 20,
      jokes: ['monster.humr-nuzkar.joke.1', 'monster.humr-nuzkar.joke.2'],
    },
  ],
  inkoustici: [
    { id: 'inkoustik-kanka', nameKey: 'inkoustik.kanka' },
    { id: 'inkoustik-smouha', nameKey: 'inkoustik.smouha' },
    { id: 'inkoustik-cmara', nameKey: 'inkoustik.cmara' },
    { id: 'inkoustik-klikyhak', nameKey: 'inkoustik.klikyhak' },
  ],
  cosmetics: [
    cosmetic('hat-captain', 'head', 20, null),
    cosmetic('goggles-yellow', 'eyes', 25, null),
    cosmetic('scarf-sea', 'neck', 40, 'sunny-lagoon.1'),
    cosmetic('lamp-anemone', 'grotto', 30, 'sunny-lagoon.1'),
    cosmetic('crown-coral', 'head', 175, 'sunny-lagoon.monster'),
  ],
  stickers: [
    sticker(
      'first-baby',
      'sunny-lagoon',
      { kind: 'friend-stage', friend: null, stage: 'baby' },
      '#ffd45c',
    ),
    sticker(
      'lagoon-steps',
      'sunny-lagoon',
      { kind: 'level-complete', level: 'sunny-lagoon.1', stars: 1 },
      '#4fc3c8',
    ),
    sticker(
      'murena-sings',
      'sunny-lagoon',
      { kind: 'monster-freed', monster: 'murena-mumla' },
      '#7e57c2',
    ),
    sticker('first-outfit', 'sunny-lagoon', { kind: 'friends-dressed', count: 1 }, '#ff8a65'),
    sticker('splash', 'sunny-lagoon', { kind: 'inkoustici-splashed', count: 1 }, '#26a69a'),
    sticker('show', 'moon-caves', { kind: 'placement-done' }, '#5c6bc0'),
  ],
  quests: [
    quest('answers', 'correct-answers', 15, 3, 3),
    quest('fast', 'fast-answers', 5, 3, 2),
    quest('minigame', 'play-minigame', 1, 2, 2),
    quest('level', 'finish-level', 1, 2, 2),
    quest('streak', 'best-streak', 5, 3, 1),
    quest('snack', 'feed-hungry', 4, 3, 2, 'sunny-lagoon.2'),
    quest('splash', 'splash-inkoustik', 1, 4, 1, 'sunny-lagoon.monster'),
  ],
  placement: {
    steps: [
      ['sk.lagoon.length', 'sunny-lagoon.2'],
      ['sk.lagoon.hard', 'sunny-lagoon.3'],
      ['sk.lagoon.dtn', 'sunny-lagoon.4'],
      ['sk.lagoon.u', 'sunny-lagoon.5'],
      ['sk.lagoon.capitals', 'sunny-lagoon.6'],
    ].map(([skillId, levelId]) => ({
      skill: skillId!,
      problems: 3,
      passAccuracy: 67,
      levels: [levelId!],
      grades: [4 as const],
    })),
    minProblems: 4,
    maxProblems: 24,
    stopAfterMisses: 3,
  },
  story: {
    beats: [
      beat('beat.prologue', { kind: 'first-session' }, true, 'scene/sunny-lagoon', 3),
      beat(
        'beat.first-egg',
        { kind: 'after-beat', beat: 'beat.prologue' },
        false,
        'scene/grotto',
        2,
      ),
      beat(
        'beat.sunny-lagoon-welcome',
        { kind: 'level-start', level: 'sunny-lagoon.1' },
        true,
        'scene/sunny-lagoon',
        2,
      ),
      beat(
        'beat.sunny-lagoon-eggs',
        { kind: 'level-start', level: 'sunny-lagoon.3' },
        true,
        'scene/sunny-lagoon',
        2,
        ['eggs.krab', 'eggs.meduzka', 'eggs.zelva'],
      ),
      beat(
        'beat.murena-mumla',
        { kind: 'level-start', level: 'sunny-lagoon.monster' },
        true,
        'scene/sunny-lagoon',
        2,
      ),
      beat(
        'beat.murena-mumla-freed',
        { kind: 'monster-freed', monster: 'murena-mumla' },
        true,
        'scene/sunny-lagoon',
        2,
      ),
      beat(
        'beat.inkoustici',
        { kind: 'after-beat', beat: 'beat.murena-mumla-freed' },
        true,
        'scene/sunny-lagoon',
        2,
      ),
      beat('beat.the-deep', { kind: 'level-start', level: 'moon-caves.1' }, true, 'map/deep', 2),
      beat(
        'beat.moon-caves-welcome',
        { kind: 'after-beat', beat: 'beat.the-deep' },
        true,
        'scene/moon-caves',
        2,
        ['eggs.korinek'],
      ),
    ],
    rewards: [
      { reward: 'eggs.krab', grant: { kind: 'egg', friend: 'krab-tvrdak' } },
      { reward: 'eggs.meduzka', grant: { kind: 'egg', friend: 'meduzka-mekulka' } },
      { reward: 'eggs.zelva', grant: { kind: 'egg', friend: 'zelva-obojka' } },
      { reward: 'eggs.korinek', grant: { kind: 'egg', friend: 'rak-korinek' } },
    ],
  },
  balance: {
    leitner: { intervals: [0, 1, 2, 4, 8, 16] },
    response: {
      choice: { fastMs: 2500, okMs: 6000 },
      letters: { fastMs: 3500, okMs: 8000 },
      typed: { fastMs: 5000, okMs: 12000, perExtraLetterMs: 1000 },
      perSentenceWordMs: 1000,
    },
    input: { lettersFromBox: 2, typedFromBox: 4, choices: 4 },
    mix: {
      successTarget: 82,
      knownShare: 70,
      minLearningShare: 10,
      maxLearningShare: 50,
      window: 20,
      noRepeatWithin: 2,
    },
    reask: { delay: 3, maxPerRound: 2 },
    coins: {
      correct: 1,
      streakEvery: 5,
      streakBonus: 1,
      monsterFreed: 15,
      placementDone: 10,
      ambush: 1,
    },
    stars: { twoStars: { accuracy: 80 }, threeStars: { accuracy: 95, fastShare: 60 } },
    mastery: {
      goldBox: 5,
      goldFast: 2,
      goldOfLast: 3,
      effort: { bronzeDays: 2, silverDays: 4, gapDays: 2 },
    },
    growth: [
      { stage: 'baby', share: 30, mastery: 'seen', monster: false },
      { stage: 'grown', share: 80, mastery: 'silver', monster: true },
      { stage: 'crowned', share: 100, mastery: 'gold', monster: true },
    ],
    daily: { goalAnswers: 30, goalMin: 10, goalMax: 100, quests: 3, historyDays: 60 },
    chest: { coinsMin: 2, coinsMax: 6, cosmeticWeight: 0, coinsWeight: 1 },
    race: { unlockAfter: 'sunny-lagoon.monster', maxProblems: 60, seconds: 60 },
    hungry: { minDue: 1 },
    ambush: { unlockAfter: 'sunny-lagoon.monster', chance: 10, minIndex: 3, maxPerRound: 1 },
    battle: { splashEvery: 4 },
  },
  lexicon: {
    sources: [
      {
        id: 'ujc',
        title: 'Internetová jazyková příručka (Ústav pro jazyk český AV ČR)',
        url: 'https://prirucka.ujc.cas.cz/',
      },
    ],
    words,
    families: [
      {
        id: 'les',
        letter: null,
        head: 'les',
        order: null,
        core: false,
        root: 'les',
        kin: [],
        src: SRC,
      },
      {
        id: 'voda',
        letter: null,
        head: 'voda',
        order: null,
        core: false,
        root: 'vod',
        kin: [],
        src: SRC,
      },
      {
        id: 'morxe',
        letter: null,
        head: 'morxe',
        order: null,
        core: false,
        root: 'moř',
        kin: [],
        src: SRC,
      },
    ],
    sentences,
    relations: { synonyms: [], antonyms: [], hierarchies: [], soundAlikes: [] },
  },
};

/** The fixture as raw JSON (what a pack file would hold). */
export function lagoonPackJson(revision = '0.1.0'): {
  id: string;
  revision: string;
  schemaVersion: number;
  data: ContentData;
} {
  return { id: 'pearl-sea', revision, schemaVersion: 1, data: JSON.parse(JSON.stringify(data)) };
}

/** The fixture pack, validated by the contract. */
export function lagoonPack(revision = '0.1.0'): ContentPack<ContentData> {
  return requireValue(validateContent(lagoonPackJson(revision), contentRegistration, 'lagoon'));
}
