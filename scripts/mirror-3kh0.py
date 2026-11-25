#!/usr/bin/env python3
"""Mirror the 3kh0 projects this catalogue links to.

lite.3kh0.net is blocked on some networks, so every game that used to redirect
there now loads from this server instead. The files come from 3kh0's own public
repo (github.com/3kh0/3kh0-lite), one folder per game.

    python scripts/mirror-3kh0.py            # fetch what is missing
    python scripts/mirror-3kh0.py --verify   # report what is missing, download nothing
    python scripts/mirror-3kh0.py --rewrite  # only re-run the link rewrite

Downloads land in gamehosting/3kh0/<slug>/. Re-running only fetches files that
are absent or the wrong size, so an interrupted run resumes where it stopped.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "data", "3kh0.json")
DEST = os.path.join(ROOT, "gamehosting", "3kh0")

REPO = "3kh0/3kh0-lite"
BRANCH = "main"
TREE_API = f"https://api.github.com/repos/{REPO}/git/trees/{BRANCH}?recursive=1"
RAW = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/"

# slices of the manifest's own cover/base URLs that pointed at their host
REMOTE_BASE = "https://lite.3kh0.net/projects/"
LOCAL_BASE = "gamehosting/3kh0/"

WORKERS = 16
TEXT_EXT = {".html", ".htm", ".js", ".mjs", ".css", ".json", ".xml", ".txt", ".svg", ".map"}


def get(url, tries=3, timeout=45):
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "watermusic-mirror"})
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return res.read()
        except Exception as exc:  # retry transient 5xx / resets
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise last


def manifest():
    with open(MANIFEST, encoding="utf-8") as fh:
        return json.load(fh)


def repo_tree():
    data = json.loads(get(TREE_API))
    if data.get("truncated"):
        print("warning: GitHub truncated the tree listing", file=sys.stderr)
    return data["tree"]


def wanted_blobs(tree, slugs):
    blobs = []
    for node in tree:
        if node.get("type") != "blob":
            continue
        parts = node["path"].split("/")
        if len(parts) < 3 or parts[0] != "projects":
            continue
        if parts[1] not in slugs:
            continue
        blobs.append(node)
    return blobs


def local_path(node):
    parts = node["path"].split("/")
    rel = os.path.join(*parts[1:])            # drop the leading projects/
    safe = os.path.normpath(rel).replace("\\", "/")
    if safe.startswith("..") or os.path.isabs(safe):
        raise ValueError("refusing to write " + node["path"])
    return os.path.join(DEST, *safe.split("/"))


def fetch_one(node):
    out = local_path(node)
    if os.path.exists(out) and os.path.getsize(out) == node["size"]:
        return "skip"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    blob = get(RAW + urllib.request.quote(node["path"]))
    tmp = out + ".part"
    with open(tmp, "wb") as fh:
        fh.write(blob)
    os.replace(tmp, out)
    return "got"


def rewrite_game(slug):
    """Point absolute links inside a mirrored game at its own folder."""
    folder = os.path.join(DEST, slug)
    if not os.path.isdir(folder):
        return 0
    # 3kh0's shared /js/main.js injects *their* AdSense + analytics and rewrites
    # the title/icon from localStorage — not something to serve from this site
    drop = re.compile(r'<script[^>]*src=("|\')[^"\']*js/main\.js\1[^>]*>\s*</script>', re.I)
    needles = [
        REMOTE_BASE + slug + "/",
        REMOTE_BASE + slug,
        "//lite.3kh0.net/projects/" + slug + "/",
        "/projects/" + slug + "/",
    ]
    touched = 0
    for base, _dirs, files in os.walk(folder):
        for name in files:
            if os.path.splitext(name)[1].lower() not in TEXT_EXT:
                continue
            path = os.path.join(base, name)
            try:
                with open(path, encoding="utf-8") as fh:
                    text = fh.read()
            except (UnicodeDecodeError, OSError):
                continue
            new = drop.sub("", text)
            for needle in needles:
                new = new.replace(needle, "./")
            if new != text:
                with open(path, "w", encoding="utf-8", newline="") as fh:
                    fh.write(new)
                touched += 1
    return touched


def rewrite_manifest(doc):
    doc["base"] = LOCAL_BASE
    doc["mirrored"] = True
    for game in doc.get("games", []):
        slug = game.get("slug", "")
        cover = game.get("cover") or ""
        if cover.startswith(REMOTE_BASE):
            rest = cover[len(REMOTE_BASE):]
            game["cover"] = LOCAL_BASE + rest
        elif cover.startswith(LOCAL_BASE):
            pass
        game["local"] = True
        game["source"] = f"https://github.com/{REPO}/tree/{BRANCH}/projects/{slug}"
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)
        fh.write("\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--verify", action="store_true", help="report missing files, download nothing")
    ap.add_argument("--rewrite", action="store_true", help="only re-run the link rewrite")
    args = ap.parse_args()

    doc = manifest()
    slugs = {g["slug"] for g in doc["games"] if g.get("slug")}

    if args.rewrite:
        changed = sum(rewrite_game(slug) for slug in sorted(slugs))
        rewrite_manifest(doc)
        print(f"rewrote {changed} file(s)")
        return

    tree = repo_tree()
    blobs = wanted_blobs(tree, slugs)
    total = sum(b["size"] for b in blobs)
    have = sum(os.path.getsize(local_path(b)) for b in blobs
               if os.path.exists(local_path(b)) and os.path.getsize(local_path(b)) == b["size"])
    print(f"{len(slugs)} games · {len(blobs)} files · {total / 1048576:.0f} MB total · "
          f"{have / 1048576:.0f} MB already here")

    if args.verify:
        missing = [b for b in blobs if not os.path.exists(local_path(b))]
        print(f"missing {len(missing)} file(s)")
        for b in missing[:20]:
            print("  " + b["path"])
        return

    failures = []
    done = [0]

    def work(node):
        try:
            result = fetch_one(node)
            done[0] += 1
            if done[0] % 100 == 0:
                print(f"  {done[0]}/{len(blobs)} files", flush=True)
            return result
        except Exception as exc:
            failures.append((node["path"], str(exc)))
            return "fail"

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        list(pool.map(work, blobs))

    rewritten = sum(rewrite_game(slug) for slug in sorted(slugs))
    rewrite_manifest(doc)
    print(f"done · {len(failures)} failure(s) · rewrote {rewritten} file(s)")
    for path, err in failures[:10]:
        print(f"  failed {path}: {err}")
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
