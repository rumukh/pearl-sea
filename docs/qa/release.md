# Perlové moře v1 release checklist

This is the go/no-go checklist for publishing the current `main` build to GitHub Pages. A release
is **GO** only when every required automated check passes, no blocker or major PS-QA defect is open,
the tested commit is the commit deployed at `https://rumukh.github.io/pearl-sea/`, and the manual
device gates below have an explicit sign-off.

## Automated gate

- [ ] `npm ci` completes from the committed lockfile.
- [ ] `npm run verify` passes all 13 steps: build, four type checks, lint, format, content,
      lexicon, audio, art, unit/trace/tooling tests and lockfile validation.
- [ ] `npm run test:e2e` passes on Chromium, Firefox and WebKit in CI. The local Edge run must
      have no unexpected skips or failures.
- [ ] The full-sea traces cover regions 1–12, both grade paths, both finales, monster battles,
      freeing, eggs and hatching, the grotto, daily adventure and snack, U Mrože, Pexeso,
      Inkoustíci, placement, backups and the grown-ups' area.
- [ ] `PS_E2E_LIVE=1 npm run test:e2e -- live.spec.ts` passes against the deployed URL after
      deployment.
- [ ] `PS_QA_DOCS=1 npm run test:e2e -- screens.spec.ts` passes and the regenerated
      `docs/qa/screens.md` and screen images are reviewed at 1280 × 800, 1024 × 768, 1440 × 900,
      390 × 844 and 200% text.

## Content, art and audio

- [ ] `npm run verify` reports valid Czech catalogs, lexicon, curriculum coverage and generated
      problems. Hints demonstrate the method on a different example and never expose the asked
      word, a family member or a lexicon ID.
- [ ] Inserted names occur only at a sentence start or after a colon or dash; species names are
      lowercase mid-sentence; Czech diacritics and grammar are reviewed.
- [ ] Czech typography is intact: one-letter words use a no-break space and all shipped Czech text
      is covered by the reading font.
- [ ] Every content-referenced art ID resolves. No `DEV …` placeholder is visible in an online
      screen; grade-4 placeholders are allowed only before the grade-4 pack is installed offline.
- [ ] Music mood transitions and the victory sting are checked in-browser, including the offline
      path. Decoded audio remains at or below 48 MiB.
- [ ] The core offline graph remains at or below 11 MB and the no-audio core remains at or below
      8.5 MB. The current 10.95 MB core graph leaves only about 50 KB: any addition requires an
      explicit budget review or compensating reduction.
- [ ] The grade-4 offline graph remains at or below 4 MB and is installed only after a grade-4
      child reaches the appropriate flow.

## Accessibility and device gates

- [ ] Axe WCAG 2.2 A/AA checks are clean on every walk; no registered layout or accessibility
      defect is reproduced.
- [ ] A child can play by keyboard alone and touch alone; focus rings, target sizes, dialogs,
      reduced motion and 200% text reflow are checked.
- [ ] On a real tablet, check iPad landscape and portrait plus an Android tablet: title, first
      lesson, a board, Muréna's battle, offline reload and the grown-ups' gate.
- [ ] On a phone at 200% text, check rounds, U Mrože, the grotto, the map and results for reflow,
      wrapping and no sideways scroll.
- [ ] On real devices, check VoiceOver/Safari or NVDA/Edge, Windows high contrast, focus-ring and
      control-edge contrast, text spacing, colour vision and local Czech read-aloud.
- [ ] Confirm the child playtest finds the reading load, story wording, hints and difficulty
      appropriate for Czech pupils in grades 3 and 4.

## Go/no-go decision

**NO-GO** if any blocker or major PS-QA defect is open, any automated gate fails, the deployed
commit differs from the tested commit, any online screen exposes a `DEV …` placeholder, the core
or audio budget is exceeded, or a required real-device/accessibility gate is unresolved. PS-QA-23
and PS-QA-24 are no longer release blockers: #70 fixed both content findings and main `a199009`
was re-read against their original keys.

**GO** when all automated and manual checks above are checked, the coordinator has reviewed the
phase-2 QA evidence, and the release commit is the one verified on GitHub Pages. The current phase-2
automated evidence is green with no open PS-QA defects; manual device, child-playtest and explicit
core-budget sign-off remain release prerequisites. The current decision is **NO-GO pending those
remaining gates**, not because of the fixed copy findings.
