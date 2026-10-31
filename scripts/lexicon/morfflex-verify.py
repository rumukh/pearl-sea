"""Verify the Czech word bank (content/lexicon-src) against MorfFlex CZ 2.0 (docs/lexicon.md, section 5).

Optional maintenance tool, run by hand after editing the word bank; it is not part of `npm run
verify`. Needs Python 3.10+, `pip install ufal.morphodita` and the Czech MorfFlex 2.0 + PDT-C model
for MorphoDiTa (http://hdl.handle.net/11234/1-4794, CC BY-NC-SA 4.0). Download the model locally;
never commit or ship it. Nothing from MorfFlex is copied into the word bank.

    python scripts/lexicon/morfflex-verify.py content/lexicon-src <path to czech-morfflex2.0-220710.dict> [--derinet]

Reports, per word: unknown lemmas, part of speech, gender and animacy, aspect, every paradigm cell
MorfFlex does not produce (or whose first form is a non-standard variant), standard forms a cell
leaves out, and whether colloquial words are non-standard. Per sentence: words MorfFlex does not
know, gap alternatives that are real words, and marks MorfFlex cannot confirm. With --derinet:
DeriNet roots of family members and of look-alike words.
"""
import json
import os
import re
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")
from ufal.morphodita import Morpho, TaggedLemmas, TaggedLemmasForms, DerivatedLemma  # noqa: E402

DIR, DICT = sys.argv[1], sys.argv[2]
DERINET = "--derinet" in sys.argv
morpho = Morpho.load(DICT)
if morpho is None:
    sys.exit("cannot load " + DICT)
derivator = morpho.getDerivator()

POS_TAG = {"noun": "N", "adj": "A", "pron": "P", "num": "C", "verb": "V", "adv": "D", "prep": "R", "conj": "J", "part": "T", "interj": "I"}
STANDARD_VARIANTS = {"-", "1"}


def raw(lemma):
    """MorfFlex raw lemma: strip the technical suffixes (_..., -1)."""
    lemma = re.split(r"[_`]", lemma)[0]
    return re.sub(r"-\d+$", "", lemma)


def analyze(form):
    lemmas = TaggedLemmas()
    result = morpho.analyze(form, Morpho.NO_GUESSER, lemmas)
    if result < 0:
        return []
    return [(l.lemma, l.tag) for l in lemmas]


def generate(lemma):
    out = TaggedLemmasForms()
    morpho.generate(lemma, "", Morpho.NO_GUESSER, out)
    res = []
    for tl in out:
        for f in tl.forms:
            res.append((f.form, f.tag))
    return res


def load():
    words, sentences, families, sets = {}, [], {}, []
    for name in sorted(os.listdir(DIR)):
        if not name.endswith(".json") or name in ("vocabulary.json", "sources.json", "paradigms.json"):
            continue
        with open(os.path.join(DIR, name), encoding="utf-8") as fh:
            data = json.load(fh)
        for w in data.get("words", []):
            prev = words.get(w["id"])
            if prev is None:
                words[w["id"]] = dict(w, _file=name)
            else:
                for k, v in w.items():
                    if k == "forms":
                        prev["forms"] = sorted(set(prev.get("forms", [])) | set(v))
                    elif k not in prev:
                        prev[k] = v
        for s in data.get("sentences", []):
            sentences.append(dict(s, _file=name))
        for f in data.get("families", []):
            families[f["id"]] = f
        sets.extend(st for st in data.get("sets", []) if st.get("kind") == "lookalikes")
    para = os.path.join(DIR, "paradigms.json")
    if os.path.exists(para):
        with open(para, encoding="utf-8") as fh:
            for wid, paradigm in json.load(fh)["paradigms"].items():
                if wid in words and "paradigm" not in words[wid]:
                    words[wid]["paradigm"] = paradigm
    return words, sentences, families, sets


GAP = re.compile(r"\{([^{}]*)\}")
TOKEN = re.compile(r"[^\W\d_]+(?:-[^\W\d_]+)*")


def plain_and_alts(text):
    """The plain sentence plus, per gap, the sentence with that gap's alternatives."""
    gaps = [m for m in GAP.finditer(text)]
    plain = GAP.sub(lambda m: m.group(1).split("|")[0], text)
    variants = []
    for i, g in enumerate(gaps):
        opts = g.group(1).split("|")
        for alt in opts[1:]:
            k = 0

            def repl(m):
                nonlocal k
                opt = m.group(1).split("|")
                r = alt if k == i else opt[0]
                k += 1
                return r

            variants.append((i, alt, GAP.sub(repl, text)))
    return plain, variants


def main_lemma_analyses(word):
    lemma = word["lemma"]
    if word.get("reflexive"):
        lemma = lemma.rsplit(" ", 1)[0]
    parts = lemma.split(" ")
    head = parts[-1] if word["pos"] == "noun" and len(parts) > 1 else parts[0]
    if word.get("proper") and len(parts) > 1:
        head = parts[0]
    found = analyze(head)
    if not found and head[0].isupper():
        found = analyze(head[0].lower() + head[1:])
    return head, found


report = defaultdict(list)


def note(kind, where, msg):
    report[kind].append(f"{where}: {msg}")


def gender_code(word):
    g = word.get("gender")
    if g == "m":
        return "M" if word.get("animate") else "I"
    return {"f": "F", "n": "N"}.get(g)


def check_word(wid, w):
    where = f"{w['_file']} {wid} ({w['lemma']})"
    if w.get("proper") and " " in w["lemma"]:
        for part in w["lemma"].split(" "):
            if not (analyze(part) or analyze(part[0].lower() + part[1:])):
                note("unknown-lemma", where, f"MorfFlex does not know '{part}'")
        return None
    head, found = main_lemma_analyses(w)
    if w.get("register") == "colloquial":
        flags = sorted({t[14] for _, t in found})
        general = [l for l, _ in found if "_,h" in l and "^GC" in l]
        if found and not general and any(f in STANDARD_VARIANTS for f in flags):
            note("register", where, f"MorfFlex treats '{head}' as standard (variants {flags}) {sorted({raw(l) for l, _ in found})}")
        else:
            note("register-ok", where, f"non-standard in MorfFlex: variants {flags} of {sorted({raw(l) for l, _ in found})}")
        return None
    if not found:
        note("unknown-lemma", where, f"MorfFlex does not know '{head}'")
        return None
    want_pos = POS_TAG[w["pos"]]

    def citation(t):
        # the lemma is a citation-form variant of a MorfFlex lemma (bydlit ~ bydlet)
        if w["pos"] == "verb":
            return t[1] == "f"
        if w["pos"] == "noun":
            return t[4] == "1" and (t[3] == "S" or w.get("numbers") == "pl")
        if w["pos"] == "adj":
            return t[4] == "1" and t[3] == "S" and t[2] in "MYI"
        return False

    same = [(l, t) for (l, t) in found if t[0] == want_pos and raw(l).lower() == head.lower()]
    if not same:
        same = [(l, t) for (l, t) in found if t[0] == want_pos and citation(t)]
        if same:
            note("lemma-variant", where, f"'{head}' is a citation variant of MorfFlex {sorted({raw(l) for l, _ in same})} (variant {sorted({t[14] for _, t in same})})")
    if not same:
        poss = sorted({f"{raw(l)}:{t[:2]}" for l, t in found})
        note("pos", where, f"no {w['pos']} analysis of '{head}' as its own lemma; MorfFlex: {poss}")
        return None
    lemma_ids = sorted({l for l, _ in same})
    if w["pos"] == "noun" and w.get("gender") and len(w["lemma"].split(" ")) == 1:
        want = gender_code(w)
        genders = {t[2] for _, t in same}
        if want not in genders and not (want in "MI" and "Y" in genders):
            note("gender", where, f"gender {want} not among MorfFlex {sorted(genders)} for {lemma_ids}")
    if w["pos"] == "verb":
        aspects = {t[12] for _, t in same}
        want = {"impf": "I", "pf": "P"}[w["aspect"]]
        if want not in aspects and "B" not in aspects:
            note("aspect", where, f"aspect {want} not among MorfFlex {sorted(aspects)}")
    return lemma_ids


def noun_cells(lemma_ids, gender):
    cells = defaultdict(dict)  # (num, case) -> form -> variant
    for lid in lemma_ids:
        for form, tag in generate(lid):
            # the dual (D: oči, nohama) is the plural of the school grammar
            if tag[0] != "N" or tag[4] not in "1234567" or tag[3] not in "SPD" or tag[10] == "N":
                continue
            if gender and tag[2] not in (gender, "X", "Y" if gender in "MI" else "-"):
                continue
            key = ("sg" if tag[3] == "S" else "pl", int(tag[4]))
            var = tag[14]
            cells[key][form] = min(cells[key].get(form, var), var, key=lambda v: (v not in STANDARD_VARIANTS, v))
    return cells


def check_noun_paradigm(wid, w, lemma_ids):
    where = f"{w['_file']} {wid} ({w['lemma']})"
    cells = noun_cells(lemma_ids, gender_code(w))
    numbers = w.get("numbers", "both")
    for num in (["sg", "pl"] if numbers == "both" else [numbers]):
        for case, cell in enumerate(w["paradigm"].get(num, []), start=1):
            ours = cell if isinstance(cell, list) else [cell]
            mf = cells.get((num, case), {})
            for i, form in enumerate(ours):
                if form not in mf:
                    note("paradigm", where, f"{case}. pád {num} '{form}' not in MorfFlex {sorted(mf)}")
                elif i == 0 and mf[form] not in STANDARD_VARIANTS:
                    note("paradigm-variant", where, f"{case}. pád {num} preferred '{form}' is MorfFlex variant {mf[form]}")
            std = sorted(f for f, v in mf.items() if v == "-")
            missing = [f for f in std if f not in ours]
            if missing:
                note("paradigm-missing", where, f"{case}. pád {num}: MorfFlex standard forms not listed: {missing} (ours {ours})")


def check_verb_paradigm(wid, w, lemma_ids):
    where = f"{w['_file']} {wid} ({w['lemma']})"
    gen = defaultdict(dict)
    for lid in lemma_ids:
        for form, tag in generate(lid):
            gen[tag[:2] + tag[2:5] + tag[7]][form] = tag[14]
            gen["all"][form] = tag[14]
    p = w["paradigm"]

    def has(key_pred, form):
        for k, forms in gen.items():
            if k != "all" and key_pred(k) and form in forms:
                return forms[form]
        return None

    if p.get("inf") and has(lambda k: k.startswith("Vf"), p["inf"]) is None:
        note("verb", where, f"infinitive '{p['inf']}' not generated")
    for i, cell in enumerate(p.get("pres", [])):
        num = "S" if i < 3 else "P"
        person = str(i % 3 + 1)
        for form in (cell if isinstance(cell, list) else [cell]):
            v = has(lambda k: k.startswith("VB") and k[3] == num and k[5] == person, form)
            if v is None:
                note("verb", where, f"present {person}{num} '{form}' not generated")
            elif v not in STANDARD_VARIANTS:
                note("verb-variant", where, f"present {person}{num} '{form}' is MorfFlex variant {v}")
    for i, cell in enumerate(p.get("imp", [])):
        num, person = [("S", "2"), ("P", "1"), ("P", "2")][i]
        for form in (cell if isinstance(cell, list) else [cell]):
            v = has(lambda k: k.startswith("Vi") and k[3] == num and k[5] == person, form)
            if v is None:
                note("verb", where, f"imperative {person}{num} '{form}' not generated")
            elif v not in STANDARD_VARIANTS:
                note("verb-variant", where, f"imperative {person}{num} '{form}' is MorfFlex variant {v}")
    for i, cell in enumerate(p.get("fut", [])):
        num = "S" if i < 3 else "P"
        person = str(i % 3 + 1)
        for form in (cell if isinstance(cell, list) else [cell]):
            found = [t for _, t in analyze(form) if t.startswith("VB") and t[3] == num and t[7] == person and t[8] == "F"]
            if not found:
                note("verb", where, f"future {person}{num} '{form}' not analysed as a future")
            elif not any(t[14] in STANDARD_VARIANTS for t in found):
                note("verb-variant", where, f"future {person}{num} '{form}' is a non-standard variant")
    past_codes = {"m": ("Y", "S"), "f": ("Q", "W"), "n": ("N", "S"), "ma": ("M", "P"), "mi": ("T", "P"), "fpl": ("T", "P"), "npl": ("Q", "W")}
    for key, (g, n) in past_codes.items():
        cell = p.get("past", {}).get(key)
        if cell is None:
            continue
        for form in (cell if isinstance(cell, list) else [cell]):
            v = has(lambda k: k.startswith("Vp") and k[2] == g and k[3] == n, form)
            if v is None:
                note("verb", where, f"past {key} '{form}' not generated")
            elif v not in STANDARD_VARIANTS:
                note("verb-variant", where, f"past {key} '{form}' is MorfFlex variant {v}")


def check_forms(wid, w, lemma_ids):
    where = f"{w['_file']} {wid} ({w['lemma']})"
    rawset = {raw(l).lower() for l in lemma_ids} if lemma_ids else {w["lemma"].lower()}
    for form in w.get("forms", []):
        last = form.split(" ")
        for part in last:
            an = analyze(part) or (analyze(part[0].lower() + part[1:]) if part[0].isupper() else [])
            if not an:
                note("form-unknown", where, f"form '{part}' unknown to MorfFlex")
        if len(last) == 1:
            an = analyze(form) or analyze(form[0].lower() + form[1:])
            if an and not any(raw(l).lower() in rawset for l, _ in an):
                note("form-lemma", where, f"form '{form}' analyses as {sorted({raw(l) for l, _ in an})}, not {sorted(rawset)}")


def check_sentence(s, words):
    where = f"{s['_file']} {s['id']}"
    plain, variants = plain_and_alts(s["text"])
    toks = [(m.group(0), m.start()) for m in TOKEN.finditer(plain)]
    for tok, start in toks:
        an = analyze(tok)
        if not an and start == 0:
            an = analyze(tok[0].lower() + tok[1:])
        if not an:
            note("sentence-unknown", where, f"'{tok}' unknown to MorfFlex in: {plain}")
    gaps = s.get("gaps", [])
    for i, alt, text in variants:
        rule = gaps[i]["rule"] if i < len(gaps) else "?"
        alt_plain = GAP.sub(lambda m: m.group(1).split("|")[0], text)
        alt_toks = [m.group(0) for m in TOKEN.finditer(alt_plain)]
        orig = [t for t, _ in toks]
        for t in alt_toks:
            if t in orig:
                continue
            an = analyze(t) or analyze(t[0].lower() + t[1:])
            if an and rule not in ("shoda", "vzor", "predpona-predlozka", "mne-zajmeno", "spisovne"):
                note("alt-is-word", where, f"rule {rule}: alternative '{t}' is a real word {sorted({raw(l) for l, _ in an})[:4]} in: {plain}")
    for mk in s.get("marks", []):
        tok = mk["t"]
        an = analyze(tok) or analyze(tok[0].lower() + tok[1:])
        w = words.get(mk.get("word", ""))
        if w is None:
            continue
        lemma = w["lemma"].rsplit(" ", 1)[0] if w.get("reflexive") else w["lemma"]
        mine = [t for l, t in an if raw(l).lower() == lemma.lower().split(" ")[0]]
        if not mine:
            note("mark", where, f"'{tok}' does not analyse as {lemma}: {sorted({raw(l) for l, _ in an})}")
            continue
        ok = True
        if "case" in mk:
            ok = any(t[4] == str(mk["case"]) for t in mine)
        if ok and "number" in mk:
            ok = any(t[3] == ("S" if mk["number"] == "sg" else "P") or t[3] in "XW-" for t in mine)
        if ok and "person" in mk and w["pos"] == "verb":
            ok = any(t[7] in (str(mk["person"]), "X", "-") for t in mine)
        if not ok:
            note("mark", where, f"'{tok}' MorfFlex tags {sorted(set(mine))} do not confirm {mk}")


def check_families(words, families, sets=()):
    if not DERINET:
        return

    def root(lemma):
        an = analyze(lemma)
        cands = sorted({l for l, _ in an if raw(l).lower() == lemma.lower()})
        if not cands:
            return None
        cur = cands[0]
        for _ in range(12):
            p = DerivatedLemma()
            if not derivator.parent(cur, p):
                break
            cur = p.lemma
        return raw(cur)

    for fid, f in families.items():
        head = words.get(f["head"])
        if not head:
            continue
        hl = head["lemma"].rsplit(" ", 1)[0] if head.get("reflexive") else head["lemma"]
        hroot = root(hl.split(" ")[0])
        for wid, w in words.items():
            if w.get("family") != fid or wid == f["head"]:
                continue
            wl = w["lemma"].rsplit(" ", 1)[0] if w.get("reflexive") else w["lemma"]
            r = root(wl.split(" ")[0])
            if r != hroot:
                note("derinet", f"{fid}", f"{w['lemma']} derives from '{r}', head {hl} from '{hroot}'")

    for st in sets:
        f = families.get(st["family"])
        head = words.get(f["head"]) if f else None
        if not head:
            continue
        hroot = root(head["lemma"].split(" ")[0])
        for wid in st["words"]:
            r = root(words[wid]["lemma"])
            kind = "lookalike-related" if r == hroot else "lookalike-ok"
            note(kind, st["id"], f"{words[wid]['lemma']} derives from '{r}', family head from '{hroot}'")


def main():
    words, sentences, families, sets = load()
    for wid, w in words.items():
        lemma_ids = check_word(wid, w)
        if lemma_ids and w.get("paradigm"):
            if w["pos"] == "noun":
                check_noun_paradigm(wid, w, lemma_ids)
            if w["pos"] == "verb":
                check_verb_paradigm(wid, w, lemma_ids)
        check_forms(wid, w, lemma_ids)
    for s in sentences:
        check_sentence(s, words)
    check_families(words, families, sets)
    total = 0
    for kind in sorted(report):
        print(f"== {kind} ({len(report[kind])})")
        for line in report[kind]:
            print("  " + line)
        total += len(report[kind])
    print(f"MorfFlex check: {len(words)} words, {len(sentences)} sentences, {total} findings")


main()
