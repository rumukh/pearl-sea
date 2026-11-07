# Full-sea progression record

The browser evidence run was executed on 2026-11-07 with the fixed QA seed and reduced motion.
The existing trace suite drives the complete rules path through all 12 regions; the new
`test/e2e/qa-phase2.spec.ts` drives the browser UI to every region 2–12 map node, region screen,
first level and monster battle/freed state.

The visual evidence test is intentionally excluded from normal CI because it is a one-off
documentation harness and takes about ten minutes per browser. Run it explicitly when refreshing
the committed screenshots:

```text
QA_EVIDENCE=1 npx playwright test test/e2e/qa-phase2.spec.ts --project=chromium
```

In PowerShell, use `$env:QA_EVIDENCE='1'` before the command. The harness waits for the level screen
to leave before advancing the monster story; this avoids mistaking a slow WebKit story transition
for a product battle-start failure. Phone captures intentionally stop after the level screen, while
the iPad landscape path captures battle and freeing.

| Area                      | Evidence                                                                                        | Result                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Regions 1–7               | `test/traces/finale.test.ts`, `test/traces/lagoon.test.ts`, browser screenshots for regions 2–7 | All levels, monster battles and freed rewards progressed without a stuck transition                          |
| Placement                 | `test/e2e/grade-four.spec.ts` and `test/traces/fourth-grader.test.ts`                           | Placement completed and the child was routed to the deep sea                                                 |
| Grade-4 art pack          | `test/e2e/grade-four.spec.ts`, offline placeholder/install assertions                           | Placeholders were confined to the pre-install offline state; installed grade-4 art rendered in regions 8–12  |
| Regions 8–12 and deep map | `test/traces/finale.test.ts` and browser screenshots for Moon Caves through Kraken Abyss        | Deep-map nodes, lessons, battles and freed moments rendered with the expected region art and monster pairing |
| Offline continuation      | `test/e2e/offline.spec.ts` and `test/e2e/grade-four.spec.ts`                                    | The installed save reloaded offline and retained progress                                                    |

The game stores a child's grade at profile creation, so the end-to-end coverage necessarily uses
the shipped grade-3 and grade-4 profile paths rather than changing one profile's grade in place.
That is the product flow exercised by the placement and pack-install tests. No UI, reward or
region-progress defect was found in this run.
