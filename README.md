# Perlové moře: dobrodružství s češtinou

A colourful, offline-capable web game that teaches Czech grammar and spelling to children in the
**3rd and 4th grade** of Czech primary school. Dive with the little yellow submarine **Bublinka**,
hatch and raise sea friends, polish the pearls of the Great Shell, and wash the ink off the sea
monsters until the giant **Krakatice** herself is free.

Sister game of [Dragon Valley](https://github.com/rumukh/dragon-valley), built the same way: a
standalone consumer of the [Aegis](https://github.com/rumukh/aegis-engine) action-driven SDK
(`@aegis/core`, `@aegis/runtime`, `@aegis/narrative`, `@aegis/browser`), vendored as pinned
tarballs. Every image and music track is made with **local AI models only** (no cloud services),
with recorded provenance.

**Status:** planning approved; the foundations (toolchain, SDK, build, offline worker, reading
font, CI and Pages) are in place and the game is being built. The approved design and delivery
plan is [`docs/plan.md`](docs/plan.md). The site is published at
<https://rumukh.github.io/pearl-sea/>.

## Develop

Requirements: Node 24 or 25 and npm 11. On the development machine npm goes through the proxy in
`.npmrc`; CI selects the public registry.

```powershell
npm ci
npm run serve        # build, watch and serve at http://127.0.0.1:4330/ (refresh after "rebuilt")
npm run verify       # the gate: build, typecheck, lint, format, content, tests, lockfile
npm run test:e2e     # browser tests at the Pages base through the system Edge (or Chrome:
                     # PS_BROWSER_CHANNEL=chrome); they serve on 4331
npm run build -- --base /pearl-sea/   # the GitHub Pages build in dist-site/
```

Dragon Valley uses ports 4320 and 4321, so both games run side by side. After any `npm install`,
run `npm run lockfile:fix` (the lockfile keeps public registry URLs so CI can install).

## Sharing an origin with Dragon Valley

Both games are served from `https://rumukh.github.io`, which browsers treat as one origin with one
set of storage. Every storage name of this game belongs to it alone: the IndexedDB database
`pearl-sea`, the save IDs `pearl-sea` and `pearl-sea-…`, the offline caches `aegis:pearl-sea:…` and
the offline worker's scope `/pearl-sea/`; the game uses no localStorage, sessionStorage or cookies.
The registry is [`src/rules/contract/persistence.ts`](src/rules/contract/persistence.ts), and
`test/unit/persistence/origin-isolation.test.ts` and `test/e2e/isolation.spec.ts` prove that neither
game can read, evict or overwrite the other's saves or offline files. The storage quota, the
"keep data" permission and the browser's "clear site data" still apply to both games together.

## Layout

| Path            | What                                                                                |
| --------------- | ----------------------------------------------------------------------------------- |
| `src/rules/`    | Deterministic, DOM-free game rules and the domain contract (`contract/`)            |
| `src/app/`      | Browser shell: DOM/SVG screens, styles, the offline worker (`sw.ts`)                |
| `content/`      | Data: catalogs now; the content pack and its history follow                         |
| `assets/`       | Runtime fonts (and later art and audio) with provenance                             |
| `scripts/`      | Node tooling: build, serve, verify, check-site, content validation, lockfile, fonts |
| `test/`         | Vitest unit and tooling tests, Playwright end-to-end tests (`e2e/`)                 |
| `vendor/aegis/` | The pinned SDK tarball set and its artifact manifest                                |
| `docs/`         | The approved plan                                                                   |

## License

MIT. The reading font Pearl Reading is a renamed subset of Andika (SIL Open Font License 1.1, see
`assets/fonts/pearl-reading/`); art and audio carry recorded provenance.
