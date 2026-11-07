# Czech copy review

Reviewed 2026-11-07 from the fixed-seed corpus generated with:

```text
node scripts/content/sample-problems.mjs --per-skill 5 --boards 0 --seed qa-phase-2 --out docs/qa/copy/generated
```

The review corpus is intentionally checked in so another Czech teacher can repeat the reading
review without relying on generator output. `catalog.md` contains all 552 Czech UI strings and
823 Czech content strings. `pack-references.md` contains the 490 resolved story, dialogue, level,
monster, friend and quest references. `generated/` contains 715 fixed-seed problem and hint
samples (at least five per exercise skill and grade where that skill exists).

## Human review coverage

| Corpus                                                    | Reading review                                                                                                          | Result                                                                                               |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| UI catalog, including grown-ups' Czech and English switch | Every Czech label, instruction, error and reward line read in `catalog.md`                                              | One minor copy defect: `grownups` terminology is otherwise consistent                                |
| Story, dialogue, level and monster text                   | Every resolved reference read in `pack-references.md`, including all 12 region welcomes and monster beats               | One major naming-rule defect and one minor awkward sentence                                          |
| Fixed-seed generated problems and hints                   | Five samples per generated skill, both grades where present, across all 12 regions                                      | Grammar, agreement, diacritics and grade level acceptable; no answer/family leakage found by reading |
| Naming and typography                                     | Name insertions, species capitalization and one-letter-word spacing checked against the rendered corpus and source keys | Two authored naming/copy defects recorded below; runtime NBSP behavior is correct                    |

## Findings

Both findings below were fixed by #70 and re-read on main `a199009`. The original wording and
diagnosis remain here as the audit trail for the manual review.

### PS-QA-23 — `friend.tulen-padik.mnemonic` uses vocative

- **Severity:** major
- **Owner:** content
- **Source:** `content/catalogs/cs.content.json`, key `friend.tulen-padik.mnemonic`
- **Text:** `Na šesti schodech se ptáme, na pátém voláme: Pádíku!`
- **Finding:** The line teaches the seventh case by calling the character in the vocative.
  The child-facing naming rule for this pack forbids vocative and permits a name only at a
  sentence start or after a colon or dash as a label. The colon does not make `Pádíku!` a
  non-vocative name; it is still an address form.

### PS-QA-24 — `friend.jazyk-jazycek.mnemonic` is unnatural Czech

- **Severity:** minor
- **Owner:** content
- **Source:** `content/catalogs/cs.content.json`, key `friend.jazyk-jazycek.mnemonic`
- **Text:** `Jsem plochá ryba jazyk.`
- **Finding:** This reads as an ungrammatical or at least very unnatural apposition: the common
  noun `jazyk` looks like the species name and the sentence has no natural naming construction.
  An 8–10-year-old would expect a sentence such as `Jsem plochá ryba jménem Jazýček.` or two
  short sentences that keep the spelling example separate from the character's name.

## Checks with no finding

The reviewed generated samples use method hints on different examples, never the asked word or
its family, and do not expose lexicon IDs. Species names are lowercase when they occur mid-sentence
in the monster introductions. One-letter Czech words are rendered with the repository's NBSP
typography helper. The review found no additional grammar, agreement, diacritic, grade-level or
tone defect in the sampled generated problems.
