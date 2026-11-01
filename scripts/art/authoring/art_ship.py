"""Ship approved art into the repository and write assets/art/provenance.json (CPU only).

For every approved asset: cut out (characters, with the current cutout.py), trim, scale, encode
WebP (ship_art.py), then record a portable provenance entry: the full generation lineage (the
approved image, then each reference that was itself generated, down to the Pillow sketch or the
blank canvas), with the exact prompt, negative prompt, seed, steps, CFG, resolution, mode,
model and checkpoint digests, every post-processing step, the digests, the anchors and the user's
approval. Prompts are also written to assets/art/prompts/<asset>.prompt.txt (never shipped).

Usage: python art_ship.py <repo> <spec.json>   ($PEARL_SEA_ART_ROOT: the authoring folder, outside
the repository, that holds the renders with their records, _briefs and _decisions)
spec: {"assets": [{"id", "kind": "character"|"scene", "source", "file", "maxSide", "quality",
                   "gate": "<decision json>", "approvalKey": "<label in that gate>"}]}
"""

import hashlib
import json
import os
import subprocess
import sys

A = os.environ.get("PEARL_SEA_ART_ROOT") or sys.exit("Set PEARL_SEA_ART_ROOT to the authoring folder.")
PY = sys.executable
TOOLS = os.path.dirname(os.path.abspath(__file__))
TOOL_PATH = "scripts/art/authoring"


def load(path):
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def portable(path):
    """A host-free name for an authoring file: <asset folder>/<file name>."""
    norm = os.path.normpath(path)
    parts = norm.split(os.sep)
    return "/".join(parts[-2:])


def lineage(png, seen=None):
    seen = seen or set()
    rec_path = png[:-4] + ".record.json"
    if png in seen or not os.path.exists(rec_path):
        return []
    seen.add(png)
    rec = load(rec_path)
    step = {
        "image": portable(png),
        "sha256": rec["output"]["sha256"],
        "size": [rec["output"]["width"], rec["output"]["height"]],
        "tool": f"WanGP {rec['tool']['commit'][:12]} (github.com/deepbeepmeep/Wan2GP), headless, offline",
        "model": {
            "name": rec["model"]["name"],
            "transformer": rec["model"]["transformer"],
            "textEncoder": rec["model"]["textEncoder"],
            "vae": rec["model"]["vae"],
            "quantization": rec["model"]["quantization"],
            "sampler": rec["model"]["sampler"],
        },
        "prompt": rec["prompt"],
        "promptPrefixAddedByHelper": rec.get("promptPrefixAddedByHelper"),
        "negativePrompt": rec["negativePrompt"],
        "seed": rec["seed"],
        "steps": rec["steps"],
        "trueCfg": rec["trueCfg"],
        "resolution": rec["resolution"],
        "referenceMode": rec["referenceMode"],
        "references": [{"image": portable(r["path"]), "role": r["role"], "sha256": r["sha256"]} for r in rec["references"]],
        "date": rec["startedAt"][:10],
        "machine": "local NVIDIA RTX 4070 Ti SUPER (16 GB), Windows; no cloud service",
    }
    chain = [step]
    for r in rec["references"]:
        chain += lineage(r["path"], seen)
    return chain


def main():
    repo, spec_path = sys.argv[1], sys.argv[2]
    spec = load(spec_path)
    licences = load(os.path.join(A, "_tools", "licences.json"))
    anchors = load(os.path.join(A, "_briefs", "anchors.json"))["anchors"]
    sketch_script_sha = sha256(os.path.join(TOOLS, "sketches.py"))
    cutout_sha = sha256(os.path.join(TOOLS, "cutout.py"))
    ship_sha = sha256(os.path.join(TOOLS, "ship_art.py"))
    ship_items = []
    for a in spec["assets"]:
        item = {"id": a["id"], "kind": a["kind"], "source": a["source"], "file": a["file"],
                "maxSide": a["maxSide"], "quality": a["quality"]}
        if a["kind"] == "character":
            out_dir = os.path.join(os.path.dirname(a["source"]), "cutouts")
            stem = os.path.splitext(os.path.basename(a["source"]))[0]
            subprocess.run([PY, "-W", "ignore", os.path.join(TOOLS, "cutout.py"), a["source"], "--out", out_dir],
                           check=True, capture_output=True, env=dict(os.environ, CUDA_VISIBLE_DEVICES=""))
            item["cutout"] = os.path.join(out_dir, f"{stem}.cutout.png")
            anc = anchors.get(a["id"])
            if anc:
                if anc["sourceSha256"] != sha256(a["source"]):
                    raise SystemExit(f"{a['id']}: anchors were set on a different image")
                item["anchors"] = {k: anc[k] for k in ("head", "eyes", "neck")}
        ship_items.append(item)
    ship_spec = os.path.join(A, "_scratch", "ship-spec.json")
    with open(ship_spec, "w", encoding="utf-8") as f:
        json.dump({"repo": repo, "items": ship_items}, f, indent=1)
    subprocess.run([PY, "-W", "ignore", os.path.join(TOOLS, "ship_art.py"), ship_spec], check=True)
    results = {r["id"]: r for r in load(ship_spec.replace(".json", ".result.json"))}

    prov_path = os.path.join(repo, "assets", "art", "provenance.json")
    existing = load(prov_path)["assets"] if os.path.exists(prov_path) else []
    by_id = {e["id"]: e for e in existing}
    for a, item in zip(spec["assets"], ship_items):
        res = results[a["id"]]
        gate = load(a["gate"])
        chain = lineage(a["source"])
        prompt_file = "prompts/" + a["file"].rsplit("/", 1)[-1].replace(".webp", ".prompt.txt")
        prompt_path = os.path.join(repo, "assets", "art", *prompt_file.split("/"))
        os.makedirs(os.path.dirname(prompt_path), exist_ok=True)
        with open(prompt_path, "w", encoding="utf-8", newline="\n") as f:
            # The exact strings, line breaks included, are in provenance.json; this copy uses LF only.
            for i, step in enumerate(chain):
                f.write(f"# step {i + 1}: {step['image']} (seed {step['seed']}, {step['referenceMode']} mode)\n")
                f.write(step["prompt"].strip().replace("\r\n", "\n") + "\n\n")
                f.write("# negative prompt\n" + step["negativePrompt"].strip().replace("\r\n", "\n") + "\n\n")
        processing = [dict(step) for step in res["processing"]]
        if a["kind"] == "character":
            cut = load(item["cutout"].replace(".cutout.png", ".cutout.json"))
            first = processing[0]
            if first["step"] != "cut-out":
                raise SystemExit(f"{a['id']}: expected the cut-out as the first processing step")
            first.update({"tool": f"{TOOL_PATH}/cutout.py (sha256 {cutout_sha}): rembg 2.0.65 U2Net "
                          "(u2net.onnx, md5 60024c5c889badc19c04ad937298a77b) on CPU, then backdrop keying, "
                          "enclosed-gap opening, shadow removal and edge matting with colour decontamination",
                          "holesOpened": cut["holesOpened"], "specksRemoved": cut["specksRemoved"],
                          "iouWithU2net": cut["iouWithU2net"]})
        for step in processing:
            if step["step"] != "cut-out":
                step["tool"] = f"{TOOL_PATH}/ship_art.py (sha256 {ship_sha})"
        uses_sketch = any("sketch" in r["role"] for s in chain for r in s["references"])
        entry = {
            "id": a["id"],
            "file": a["file"],
            "width": res["width"],
            "height": res["height"],
            "bytes": res["bytes"],
            "sha256": res["sha256"],
            "anchors": res.get("anchors"),
            "promptFile": prompt_file,
            "approvedImage": {"image": portable(a["source"]), "sha256": sha256(a["source"])},
            "lineage": chain,
            "sketchScript": {"path": f"{TOOL_PATH}/sketches.py", "sha256": sketch_script_sha} if uses_sketch else None,
            "processing": processing,
            "approval": {"gate": gate["gate"], "decidedAt": gate["decidedAt"], "question": gate["question"],
                         "answer": gate["userAnswer"], "chosen": a["approvalKey"]},
        }
        by_id[a["id"]] = entry
    doc = {
        "schema": "pearl-sea-art-provenance/1",
        "description": "Provenance of every shipped painting. Never shipped (scripts/build.mjs skips *provenance*.json). "
                       "Local models only (docs/assets.md). The committed bytes with their digests are the assets; "
                       "GPU generation is not bit-identical across machines.",
        "styleDecision": load(os.path.join(A, "_decisions", "gate1-art-style.json"))["userAnswer"],
        "licences": [c for c in licences["components"] if "ACE-Step" not in c["component"] and "Qwen3" not in c["component"]],
        "assets": [by_id[k] for k in sorted(by_id)],
    }
    with open(prov_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False, allow_nan=False)
        f.write("\n")
    for k in sorted(by_id):
        e = by_id[k]
        print(f"{k}: {e['file']} {e['width']}x{e['height']} {e['bytes'] // 1024} KiB, lineage {len(e['lineage'])} step(s)")


if __name__ == "__main__":
    main()
