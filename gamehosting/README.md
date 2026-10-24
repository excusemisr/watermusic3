# /gamehosting — local game source

Drop a game in here and it shows up in the library automatically, tagged with a
`LOCAL` badge. Local games load straight into an iframe (`index.html`), so
relative paths to their own CSS/JS/images just work — no packing into one file.

## Folder layout

```
gamehosting/
└── my-game/
    ├── index.html    ← the game (required)
    ├── style.css     ← anything the game needs (optional, any name)
    ├── script.js     ← anything the game needs (optional, any name)
    └── photo.png     ← thumbnail, square, 512×512 recommended
```

The URL of a game is always:

```
/gamehosting/<folder>/index.html
```

The thumbnail is always:

```
/gamehosting/<folder>/photo.png
```

## Registering it

The site cannot read a directory listing on most static hosts, so add the folder
to the manifest. Any one of these works, checked in this order:

### 1. `games.json` (recommended)

```json
{
  "games": [
    {
      "folder": "my-game",
      "title": "My Game",
      "author": "you",
      "thumbnail": "photo.png",
      "tags": ["puzzle"]
    }
  ]
}
```

Only `folder` is required — everything else falls back to something sensible
(the title is derived from the folder name, tags only affect the category chip).

A bare array works too:

```json
["my-game", "another-game"]
```

### 2. `games.txt`

One folder name per line, `#` for comments:

```
# puzzle
my-game
another-game
```

### 3. Directory autoindex

If your host serves a listing page for `/gamehosting/` (some dev servers and
static hosts do), every link ending in `/` is picked up with no manifest at all.

## Notes

- `photo.png` is optional too; a broken image is hidden rather than shown as a
  broken icon.
- Games run in a sandboxed iframe with autoplay, fullscreen and gamepad access.
  Same-origin storage (`localStorage`, `IndexedDB`) works per folder.
- `demo/` is a small playable example (Neon Runner) — copy it as a starting
  point.
