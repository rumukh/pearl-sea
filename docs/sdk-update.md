# Updating the Aegis SDK

Perlové moře consumes the Aegis SDK (`@aegis/core`, `@aegis/runtime`, `@aegis/narrative`,
`@aegis/browser`) as a **complete, pinned set of local tarballs**, the standalone route documented
in aegis-engine `docs/api/standalone-consumers.md` and ADR-0012. Nothing is fetched from a registry,
nothing is imported from an engine checkout, and the engine repository is never modified from here.
The game pins the same set as Dragon Valley ([plan.md](plan.md) §0); each game vendors its own copy
and updates it in its own pull request.

## Current pin

| Field          | Value                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| Engine commit  | `0abd61b5a679020bfb66bf4db24888df9e339d4d` (aegis-engine `main`)                                              |
| SDK version    | `0.0.0-local.r0abd61b5a679.da726c53afdf74c5f`                                                                 |
| Source digest  | `a726c53afdf74c5f8752981cc8928ea9922358be313552b2923f1ad8affd614d`                                            |
| Packed with    | Node v24.18.0, npm 11.16.0, TypeScript 5.9.3                                                                  |
| Consumer check | `npm run test:consumer` passed when the set was packed for Dragon Valley (all 12 checks, both reference labs) |

| Tarball (`vendor/aegis/<version>/`)                               | SHA-256                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `aegis-core-0.0.0-local.r0abd61b5a679.da726c53afdf74c5f.tgz`      | `16612c186b2371e93ceeb1565953e7b7d9326126d321c8d12b7c5cf2ae69c7ae` |
| `aegis-runtime-0.0.0-local.r0abd61b5a679.da726c53afdf74c5f.tgz`   | `72aac3d1218da81b086c81f57e516d2d61bd6874f6b79c69039effc7ec140384` |
| `aegis-narrative-0.0.0-local.r0abd61b5a679.da726c53afdf74c5f.tgz` | `c9e3165983190533bac07ceee14366b5a2f5daf9d4a3b20fd6588c4fa1630b29` |
| `aegis-browser-0.0.0-local.r0abd61b5a679.da726c53afdf74c5f.tgz`   | `5194c4775178dd4cc587177b91d9026e87e40abda9499077e60e980e20116885` |

`vendor/aegis/<version>/artifacts.json` is the packer's own manifest (tarball names, SHA-256, npm
integrity, the full source inventory and tool versions). `test/tooling/vendor-sdk.test.ts` checks
every tarball against both that manifest and the literal pin above, checks that `package.json`,
`package-lock.json` and `node_modules` all name exactly this set, and fails on any extra file.

### Pin history

| Engine commit | Date       | Why                                                                                                                                                                        |
| ------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0abd61b`     | 2026-10-31 | First pin, with the foundations: the tarball set Dragon Valley has pinned since 2026-10-07 (runtime performance, aegis-engine#7), with the same SHA-256 for every tarball. |

## Procedure

Run these commands in PowerShell on the development machine. Paths use backslashes; the npm
commands are identical on Linux and macOS.

### 1. Produce and check a new artifact set (in the aegis-engine checkout)

Never edit or commit anything in the engine checkout. Its outputs go to its ignored `out\`.

```powershell
$engine = 'C:\Users\predi\.copilot\repos\aegis-engine'   # the engine checkout on this PC
cd $engine
git pull --ff-only
git status --short                       # must print nothing: packing refuses dirty SDK inputs
$rev = git rev-parse HEAD                 # the full 40-character commit
$short = $rev.Substring(0, 7)
npm ci
npm run build
npm run pack:sdk -- --revision $rev --out out\sdk-$short
npm run test:consumer -- --artifacts out\sdk-$short
```

`pack:sdk` refuses an existing output directory; choose a fresh `--out` for every attempt.
`test:consumer` must exit 0. Keep its JSON output for the pull request description. If either
command fails, stop: report the failure to the coordinator, who files an aegis-engine issue. Do not
patch tarballs or work around a defect inside this repository.

### 2. Replace the vendored set (in this repository)

```powershell
cd <pearl-sea worktree>
$v = (Get-Content $engine\out\sdk-$short\artifacts.json -Raw | ConvertFrom-Json).version
git rm -r --quiet vendor\aegis
New-Item -ItemType Directory vendor\aegis\$v | Out-Null
Copy-Item $engine\out\sdk-$short\* vendor\aegis\$v\
```

Copy **all four** tarballs and `artifacts.json`, nothing else. Only one version directory may exist.

### 3. Install all four tarballs in one npm invocation

```powershell
$d = "./vendor/aegis/$v"
npm install --save-exact "$d/aegis-core-$v.tgz" "$d/aegis-runtime-$v.tgz" "$d/aegis-narrative-$v.tgz" "$d/aegis-browser-$v.tgz"
npm run lockfile:fix
```

A single invocation lets npm resolve each package's exact sibling versions to the vendored files.
Installing one tarball at a time would let a sibling dependency resolve elsewhere. `lockfile:fix`
rewrites any corporate-feed URLs that npm wrote back into `package-lock.json` (see below).

### 4. Re-pin the vendor test

Edit `PINNED` in `test/tooling/vendor-sdk.test.ts`: `revision`, `version` and the four `sha256`
values, copied from the `pack:sdk` output. Update the "Current pin" tables in this document.

### 5. Prove it

```powershell
npm ci                 # the lockfile installs and node_modules is exactly the new set
npm run verify         # build, typecheck, lint, format, content, tests, lockfile
npm run test:e2e       # the browser tests through the system Edge/Chrome channel
```

Then read the engine changes between the old and new commits (`git log <old>..<new>` in the
engine checkout), especially `packages/runtime` snapshot and schema behaviour, `docs/api/*` and
`docs/adr/*`:

- A change to the runtime snapshot format, `ContentPack` hashing, PRNG or `dataHash` can invalidate
  saved games and every pinned golden hash. Golden hashes are re-pinned only with an explanation in
  the commit message ([testing.md](testing.md)), and saves need an explicit migration
  ([contract.md](contract.md)).
- Browser save, checkpoint and offline changes can affect stored saves and installed packs.
- Dragon Valley shares this game's origin. A change to how `@aegis/browser` names its caches and
  Web Locks (`aegis:<namespace>:…`), deletes caches or scopes the offline worker must keep the two
  games apart: `test/unit/persistence/origin-isolation.test.ts` and `test/e2e/isolation.spec.ts`
  must stay green without loosening ([architecture.md](architecture.md) §5).

### 6. Commit and open a pull request

One commit, for example `Update Aegis SDK to <short>`, containing `vendor/aegis/**`,
`package.json`, `package-lock.json`, the vendor test pin and this document. Put the `pack:sdk`
summary (version, tarball SHA-256 values) and the `test:consumer` result in the PR description.
The coordinator reviews and merges.

## Why the lockfile keeps public registry URLs

The development machine can reach npm only through the corporate proxy pinned in `.npmrc`
(`https://packagefeedproxy.microsoft.io/npm/`). Do not remove or change it. npm writes the proxy's
internal feed URLs into `package-lock.json`, and GitHub runners cannot fetch those. The committed
lockfile therefore keeps canonical `https://registry.npmjs.org/` URLs: CI fetches them directly
(the workflows set `NPM_CONFIG_REGISTRY` at job level), and behind the proxy npm's default
`replace-registry-host=npmjs` rewrites them back. After **any** `npm install` or `npm update`, run
`npm run lockfile:fix`. `test/tooling/lockfile-registry.test.ts` fails the gate if you forget.
The script is ported from aegis-engine (MIT) with attribution in its header.

## Toolchain notes

- Node 24 or 25 and npm 11 (`engines` in `package.json`). TypeScript is `^5.9.3` (5.x, not 7.x).
- esbuild is pinned to `0.27.7`, matching the engine. Its postinstall is approved in
  `allowScripts`.
- Playwright never downloads browsers on the development machine. Locally it drives the installed
  Microsoft Edge (`channel: 'msedge'`, the default) or Chrome (`PS_BROWSER_CHANNEL=chrome`). CI
  installs Chromium, WebKit and Firefox itself.
