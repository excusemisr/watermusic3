#!/usr/bin/env python3
"""Split the 3kh0 mirror across several GitHub Pages repos.

GitHub Pages caps a site at 1 GB, and the mirror is already ~1.04 GB on its own,
so one repo cannot hold it. This balances the games by size across N shard
folders, hardlinks them into dist/ (no extra disk), and writes the map the site
reads at runtime.

    python scripts/split-shards.py                 # 5 shards, hardlinked
    python scripts/split-shards.py --shards 6
    python scripts/split-shards.py --copy          # real copies, other volume
    python scripts/split-shards.py --user someone  # override the detected user

Each shard is a self-contained repo root:

    dist/shard-1/
      .nojekyll
      index.html                 landing page listing what is in it
      README.md                  what this repo is + how to push it
      shard.json                 machine-readable manifest of its contents
      gamehosting/3kh0/<slug>/…  the games themselves

Push each folder to its own repo, enable Pages on it, and the main site finds
the games at https://<user>.github.io/<repo>/gamehosting/3kh0/<slug>/.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "data", "3kh0.json")
SHARDS_JSON = os.path.join(ROOT, "data", "shards.json")
MIRROR = os.path.join(ROOT, "gamehosting", "3kh0")
DEFAULT_REPO_PREFIX = "watermusic-games-"
PATH_IN_SITE = "gamehosting/3kh0/"


def detect_user():
    """Read the GitHub user out of the origin remote, if there is one."""
    try:
        url = subprocess.check_output(
            ["git", "-C", ROOT, "remote", "get-url", "origin"],
            stderr=subprocess.DEVNULL, text=True,
        ).strip()
    except Exception:
        return None
    m = re.search(r"github\.com[:/]+([^/]+)/([^/.]+)", url)
    return m.group(1) if m else None


def tree_size(path):
    total = 0
    for base, _dirs, files in os.walk(path):
        for name in files:
            try:
                total += os.path.getsize(os.path.join(base, name))
            except OSError:
                pass
    return total


def balance(items, count):
    """Longest-processing-time first: biggest games go in first, then each one
    lands in the lightest shard. Keeps a 44 MB game from doubling a shard."""
    bins = [{"slugs": [], "bytes": 0} for _ in range(count)]
    for slug, size in sorted(items, key=lambda kv: -kv[1]):
        target = min(bins, key=lambda b: b["bytes"])
        target["slugs"].append(slug)
        target["bytes"] += size
    return bins


def place(src, dst, copy):
    """Hardlink where possible: the same bytes, no second gigabyte on disk."""
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.exists(dst):
        return
    if copy:
        shutil.copy2(src, dst)
        return
    try:
        os.link(src, dst)
    except OSError:
        shutil.copy2(src, dst)


def link_folder(src_dir, dst_dir, copy):
    linked = 0
    for base, _dirs, files in os.walk(src_dir):
        rel = os.path.relpath(base, src_dir)
        out = dst_dir if rel == "." else os.path.join(dst_dir, rel)
        os.makedirs(out, exist_ok=True)
        for name in files:
            place(os.path.join(base, name), os.path.join(out, name), copy)
            linked += 1
    return linked


def landing_page(repo, entries, total_bytes):
    rows = "\n".join(
        f'        <li><a href="{PATH_IN_SITE}{slug}/index.html">{title}</a>'
        f'<span>{(size / 1048576):.1f} MB</span></li>'
        for slug, title, size in entries
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{repo} · watermusic games</title>
<style>
 :root{{color-scheme:dark}}
 body{{margin:0;background:#08080b;color:#e8e8ea;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}}
 main{{max-width:760px;margin:0 auto;padding:64px 24px 96px}}
 h1{{font-size:26px;letter-spacing:-.02em;margin:0 0 6px}}
 p{{color:#9a9aa4;margin:0 0 28px}}
 ul{{list-style:none;padding:0;margin:0;display:grid;gap:2px}}
 li{{display:flex;justify-content:space-between;gap:16px;padding:9px 12px;border-radius:8px;background:#0e0e13}}
 li span{{color:#6d6d78;font-variant-numeric:tabular-nums;font-size:13px}}
 a{{color:#d7ff3e;text-decoration:none}}
 a:hover{{text-decoration:underline}}
</style>
</head>
<body>
<main>
    <h1>watermusic · game shard</h1>
    <p>{len(entries)} games · {total_bytes / 1048576:.0f} MB · this is one of the
       storage shards behind <a href="../watermusic3/">the shelf</a>.</p>
    <ul>
{rows}
    </ul>
</main>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shards", type=int, default=5)
    ap.add_argument("--copy", action="store_true", help="copy files instead of hardlinking")
    ap.add_argument("--out", default=os.path.join(ROOT, "dist"))
    ap.add_argument("--user", default=None)
    ap.add_argument("--prefix", default=DEFAULT_REPO_PREFIX)
    ap.add_argument("--origin", default=None, help="Pages origin, e.g. https://user.github.io")
    args = ap.parse_args()

    with open(MANIFEST, encoding="utf-8") as fh:
        doc = json.load(fh)
    games = doc["games"]

    sized = []
    missing = []
    for game in games:
        slug = game["slug"]
        folder = os.path.join(MIRROR, slug)
        if not os.path.isdir(folder):
            missing.append(slug)
            continue
        sized.append((slug, tree_size(folder)))
    if missing:
        print(f"warning: {len(missing)} game folder(s) absent, run mirror-3kh0.py: "
              f"{missing[:5]}", file=sys.stderr)
    if not sized:
        print("nothing to split - gamehosting/3kh0/ is empty", file=sys.stderr)
        sys.exit(1)

    bins = balance(sized, args.shards)
    total = sum(size for _slug, size in sized)
    titles = {g["slug"]: g.get("title") or g["slug"] for g in games}
    sizes = dict(sized)

    user = args.user or detect_user()
    origin = args.origin or (f"https://{user}.github.io" if user else "https://USER.github.io")
    repos = [f"{args.prefix}{i + 1}" for i in range(args.shards)]

    if os.path.isdir(args.out):
        shutil.rmtree(args.out)
    os.makedirs(args.out)

    shard_map = {}
    print(f"{len(sized)} games, {total / 1048576:.0f} MB across {args.shards} shards\n")
    for index, bucket in enumerate(bins, start=1):
        repo = repos[index - 1]
        shard_dir = os.path.join(args.out, f"shard-{index}")
        os.makedirs(shard_dir, exist_ok=True)
        open(os.path.join(shard_dir, ".nojekyll"), "w").close()

        files = 0
        entries = []
        for slug in bucket["slugs"]:
            shard_map[slug] = index
            files += link_folder(os.path.join(MIRROR, slug),
                                 os.path.join(shard_dir, PATH_IN_SITE, slug),
                                 args.copy)
            entries.append((slug, titles.get(slug, slug), sizes[slug]))
        entries.sort(key=lambda e: e[1].lower())

        with open(os.path.join(shard_dir, "index.html"), "w", encoding="utf-8") as fh:
            fh.write(landing_page(repo, entries, bucket["bytes"]))
        with open(os.path.join(shard_dir, "shard.json"), "w", encoding="utf-8") as fh:
            json.dump({
                "repo": repo,
                "index": index,
                "games": [e[0] for e in entries],
                "bytes": bucket["bytes"],
            }, fh, indent=1)
            fh.write("\n")

        with open(os.path.join(shard_dir, "README.md"), "w", encoding="utf-8") as fh:
            fh.write(f"""# {repo}

Shard {index} of {args.shards} for the watermusic game shelf: **{len(entries)} games,
{bucket['bytes'] / 1048576:.0f} MB**, hardlinked out of the mirror by
`scripts/split-shards.py` so no single GitHub Pages site carries the whole 1 GB.

The games sit under `gamehosting/3kh0/<slug>/`. The shelf reads
`data/shards.json` and asks for `{PATH_IN_SITE}<slug>/index.html` on this repo,
so do not rename the folder.

## publish it

```bash
git init -b main
git add -A
git commit -m "Shard {index}: {len(entries)} games"
git remote add origin https://github.com/{user or 'USER'}/{repo}.git
git push -u origin main
```

Then **Settings → Pages → Source: Deploy from a branch → main / (root)**. The
repo has to be public unless the account has Pages on private repos.
`{origin}/{repo}/` should list the same games as this file.
""")

        print(f"  shard-{index}  {repo:<26} {len(entries):>3} games  "
              f"{bucket['bytes'] / 1048576:>6.1f} MB  {files:>5} files")

    config = {
        "note": ("The 3kh0 mirror is split across repos so no GitHub Pages site "
                 "carries the whole 1 GB. Run scripts/split-shards.py to rebuild "
                 "this file. On localhost the copy in gamehosting/3kh0/ is used "
                 "instead; ?shards=remote forces these URLs."),
        "origin": origin,
        "path": PATH_IN_SITE,
        "repos": repos,
        "shards": dict(sorted(shard_map.items())),
    }
    with open(SHARDS_JSON, "w", encoding="utf-8") as fh:
        json.dump(config, fh, indent=1)
        fh.write("\n")

    biggest = max(b["bytes"] for b in bins) / 1048576
    print(f"\nlargest shard {biggest:.0f} MB of the 1000 MB Pages limit")
    print(f"wrote {os.path.relpath(SHARDS_JSON, ROOT)} ({len(shard_map)} slugs)")
    print(f"wrote {os.path.relpath(args.out, ROOT)}/shard-1 ... shard-{args.shards}")

    if not user:
        print("\nwarning: could not work out your GitHub user; set --user to fix the URLs",
              file=sys.stderr)


if __name__ == "__main__":
    main()
