// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Determinism guard rails, mirroring the Aegis engine's eslint.config.js (ADR-0001).
 *
 * `src/rules/**` is the authoritative, replayable game: the same actions must produce the same
 * state hash on every machine and in every browser. It may therefore never read a wall clock or
 * an unseeded RNG, never call a platform-provided transcendental (libm results are not
 * guaranteed bit-identical across OS/CPU/JS engine), and never let the host locale decide an
 * ordering or a string. Time enters only as action payload data (`startSession.day`,
 * `answer.elapsedMs`); randomness only through the runtime's named streams.
 *
 * The browser shell (`src/app/**`) is exempt: it legitimately owns clocks, animation and speech.
 */
const bannedMathProps = [
  'random',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'exp',
  'expm1',
  'pow',
  'log',
  'log2',
  'log10',
  'log1p',
  'cbrt',
  'hypot',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
];

const bannedMathMessage =
  'Non-deterministic or platform-dependent. Rules use integer arithmetic and the runtime random streams (docs/contract.md, Determinism).';

const restrictedMathProperties = bannedMathProps.map((property) => ({
  object: 'Math',
  property,
  message: bannedMathMessage,
}));

const localeMessage =
  'Locale-dependent: the host language and ICU data change the result. Rules compare code units (`<`/`>`) and never format text.';

/** Locale-sensitive members on any receiver (strings, numbers, dates, arrays). */
const restrictedLocaleProperties = [
  'localeCompare',
  'toLocaleString',
  'toLocaleDateString',
  'toLocaleTimeString',
  'toLocaleUpperCase',
  'toLocaleLowerCase',
].map((property) => ({ property, message: localeMessage }));

const wallClockMessage =
  'Wall-clock time breaks determinism; time enters only as action payload data.';

/** `new Date(...)` is reported even where `Date` is shadowed or aliased. */
const noWallClockDate = {
  selector: "NewExpression[callee.name='Date']",
  message: wallClockMessage,
};

// `no-restricted-properties` sees `Math.sin`, `const { sin } = Math` and `Math['sin']`. It does
// not see aliasing the object (`const M = Math; M.sin(x)`) or a non-literal computed key
// (`const k = 'sin'; Math[k](x)`). Neither has a legitimate use in rules, so both are banned.
const restrictedMathSyntax = [
  {
    selector: "MemberExpression[computed=true][object.name='Math']",
    message: `${bannedMathMessage} Computed access to Math is banned outright, because a non-literal key evades the property rule.`,
  },
  {
    selector: "VariableDeclarator[init.name='Math']",
    message: `${bannedMathMessage} Aliasing or destructuring Math is banned outright, because an alias evades the property rule.`,
  },
  {
    selector: "BinaryExpression[operator='**'], AssignmentExpression[operator='**=']",
    message:
      'Exponentiation is implementation-approximated (ECMA-262 Number::exponentiate). Multiply integers explicitly.',
  },
];

/**
 * Golden-hash guard rail (Aegis AGENTS.md §6.2–6.3). A golden must be a pinned literal. Comparing
 * a run's hash with itself, or with a value captured from the same run at assert time, is
 * vacuously true and can never fail. These selectors catch the idiom as written and copied:
 * `toBe(run.hash)`, `toBe(host.hash())`, `expectedHash: host.hash()`.
 */
const noSelfReferentialGoldenHash = [
  {
    selector:
      "CallExpression[callee.property.name=/^(toBe|toEqual|toStrictEqual)$/] > MemberExpression.arguments[property.name='hash']",
    message:
      'Comparing against a run-derived `.hash` can never fail. Pin a literal golden hash (docs/testing.md).',
  },
  {
    selector:
      "CallExpression[callee.property.name=/^(toBe|toEqual|toStrictEqual)$/] > CallExpression.arguments[callee.property.name='hash']",
    message:
      'Comparing against a run-derived `hash()` can never fail. Pin a literal golden hash (docs/testing.md).',
  },
  {
    selector:
      "Property[key.name='expectedHash'] > MemberExpression.value[property.name='hash'], Property[key.name='expectedHash'] > CallExpression.value[callee.property.name='hash']",
    message:
      'A trace step whose expected hash comes from the run itself can never fail. Pin a literal.',
  },
];

/** Engine-side packages a static, offline, child-safe build must never contain. */
const forbiddenEverywhere = [
  {
    group: ['three', 'three/*', '@aegis/render-three', '@aegis/render-three/*'],
    message: 'The game is DOM/SVG only; the 3D renderer and three.js are never bundled.',
  },
];

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist-site/**',
      'out/**',
      'vendor/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
      '**/.*.staging-*/**',
      '**/*.tsbuildinfo',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
      'no-restricted-imports': ['error', { patterns: forbiddenEverywhere }],
      'no-restricted-syntax': ['error', ...noSelfReferentialGoldenHash],
    },
  },
  {
    // Deterministic code: the rules and every test that is not a browser end-to-end test.
    // A determinism proof that itself reads a wall clock proves nothing.
    //
    // Flat config *replaces* a rule's options rather than merging them, so every selector that
    // must apply to these files lives in this one block, including the golden-hash selectors
    // declared above for all TypeScript. Moving this block above the `**/*.ts` block, or adding a
    // later block that also sets `no-restricted-syntax` for these files, silently disarms rules.
    files: ['src/rules/**/*.ts', 'test/**/*.ts'],
    ignores: ['test/e2e/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: wallClockMessage },
        { name: 'performance', message: wallClockMessage },
        { name: 'Intl', message: localeMessage },
        { name: 'crypto', message: 'Rules draw randomness only from the runtime random streams.' },
      ],
      'no-restricted-properties': [
        'error',
        ...restrictedMathProperties,
        ...restrictedLocaleProperties,
        { object: 'performance', property: 'now', message: wallClockMessage },
      ],
      'no-restricted-syntax': [
        'error',
        noWallClockDate,
        ...restrictedMathSyntax,
        ...noSelfReferentialGoldenHash,
      ],
    },
  },
  {
    // Rules may depend only on the headless SDK packages and on other rules modules. Browser
    // services, the shell and Node built-ins are reachable only from src/app or tooling.
    files: ['src/rules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...forbiddenEverywhere,
            {
              group: ['@aegis/browser', '@aegis/browser/*'],
              message: 'Rules are DOM-free; browser services belong to src/app.',
            },
            {
              regex: '(^|/)app(/|$)',
              message: 'Rules never import the browser shell; the dependency points app -> rules.',
            },
            {
              regex: '^node:',
              message: 'Rules run in browsers too; Node built-ins are tooling-only.',
            },
          ],
        },
      ],
    },
  },
  {
    // Node tooling: build, serve, verify, content validation and the art/audio pipelines.
    files: ['scripts/**/*.{js,mjs}', '*.config.{js,mjs}', 'eslint.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/*.test.ts', 'test/e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  prettier,
);
