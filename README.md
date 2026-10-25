# watermusic

A static games portal: a hand-picked catalog, an in-page game viewer, a proxy
hub and a drop-in `gamehosting/` folder for your own games. No build step.

```bash
python -m http.server 8123
# then open http://127.0.0.1:8123/
```

## What the concept changes

**Look**

- **Flat, quiet surfaces.** The aurora canvas, drifting blobs, grid, grain,
  marquee ticker and glow shadows are gone. Background is one solid colour,
  panels are hairline-bordered, and the accent is used only where it means
  something (active nav, primary action, current filter, starred).
- **Labels instead of guesswork.** The top bar buttons now read **Random**,
  **Sort**, **Proxy** and **Find** next to their icons (icons only under 780px so
  the bar stays usable on a phone). The proxy's buttons are labelled the same
  way: Open, Reload, Full, New tab.
- **Sentence case, no fake-terminal type.** Section headings, buttons, card
  metadata, toasts, the palette and the settings sheet all use the body font in
  sentence case; the monospace face is kept only for numbers, counts and key
  hints. No uppercase micro-labels, no gradient text, no `01 / 02` section
  numbers.
- **Floating dock** instead of the full-height sidebar, with a bottom pill bar on
  phones.
- **Hero** is now a wordmark, one line of copy, three buttons and three flat
  stat tiles next to the **rotating featured showcase** (six picks, cross-faded
  covers, progress bar and dots, paused while hovered or while a game is open).
  The showcase's own play button is a labelled "Play" instead of a bare circle.
- **Cards** lost the pointer tilt and the accent glare; hovering lifts the border
  and reveals a small Play pill. Covers fade in without the shimmer sweep.
- Restyled viewer, loader, settings sheet, warning panel and toasts — plus a full
  light-theme pass.

**New interaction**

- **⌘K / Ctrl K command palette** — fuzzy search over the whole catalog, covers,
  categories, arrow-key navigation, `↵` to play, `S` to star without leaving the
  palette, Esc to close. Full-screen on mobile.
- The top bar search, shortcuts (`R`, `/`, Esc), starring, recents, sorting,
  filters, caching, prefetching and deep links all still work as before.

**Catalog curation — a short list**

- The shelf is now an **allowlist**: only ids listed in `CATALOG_IDS` (top of
  `app.js`) are let in, so the manifest can grow to 500+ uploads and the site
  still shows a hand-picked set people actually recognise. Everything not on
  the list is dropped before the catalog is built — no card, no search hit, no
  palette row, no recent entry, no featured slot. **Catalog is 262**
  (261 curated CDN ids + the sample local game).
- Carried over from the notes files: the 16 flagged / broken ids and the slop
  sweep (endless runners, idle / merge / tycoon clones, licensed shovelware,
  the "3D" one-tap wave) are all simply not in the allowlist. Kept on purpose:
  Gunspin, Happy Wheels, Ragdoll Archers & Hit, Jetpack Joyride, Crossy Road,
  Fruit Ninja, Doodle Jump, Snow Rider 3D, Papa's series, Bloons, PvZ, Smash
  Karts, Moto X3M, Plinko and Subway Surfers: San Francisco.
- **Amaze (26), Ragdoll Hit (44), Escape Road (264) and Aquapark.io (448) open in
  their own tab** instead of the in-page viewer, because they only behave there.
  They get a small "new tab" tag on the card.
- To change the shelf, add or remove an id in `CATALOG_IDS`; to change what opens
  in its own tab, edit `FORCE_TAB_IDS`.

**Recommended — `recommended.html`**

- The list lives in **one place**: a JSON block inside `recommended.html`
  (`id` is the number in a `?id=NN` link, plus an optional one-line `why`). Edit
  those entries and both places update — no second copy to keep in sync.
- That page is a real page (`/recommended.html`) with a cover, the name, the
  reason and a Play link per game, linked from the section head and the footer.
- On the main page the same list renders as a **Recommended strip above the
  games list**, and those games **sort to the top of the grid in list order**
  whatever sort is picked — the pin tag on the card reads "Recommended".
- If `recommended.html` can't be fetched (`file://`, offline), `app.js` falls
  back to the built-in `RECOMMENDED_FALLBACK` list, so the strip never vanishes.

**Bonus fix found while curating:** the manifest ships two games with `id: 1`
(Bowmasters and OvO), so they shared one catalog key — starring or opening one
hit the other. Duplicate keys are now suffixed (`cdn:1`, `cdn:1-2`).

**The "not hosted by me" warning**

- The accept button is **locked for 3 seconds** every time the notice opens: it
  counts down (`Let me play (3)` → `(2)` → `(1)`), shows a thin progress line and
  the click is ignored until it unlocks, so it can't be tapped straight past.
  "Go back" stays available the whole time.

**Fixes carried in the concept**

- Theme preset swatches were collapsing to 2px wide (Chrome gives `<button>`
  `align-items:flex-start`); they now render.
- `proxy.html` read `wm.config.v3` while the app saved `wm.config.v5`, so the
  proxy never picked up your theme/accent/font. It now reads v5 (old key still
  used as a fallback).
- The proxy's node dropdown drew **behind** the game iframe: the bar's
  `backdrop-filter` makes it a stacking context, so the menu couldn't escape it
  and the stage painted over it. The bar now carries its own `z-index`.

## How it is built

```
index.html       the shell (palette, recommended strip, viewer, settings)
recommended.html the recommended picks page + the JSON list that drives it
concept.css      the skin, loaded after app.css
concept.js       card entrance, featured carousel, ⌘K palette
app.js           catalog (CATALOG_IDS allowlist), recommended list reader,
                 viewer, caching, the 3s warning cooldown, window.wm hook
proxy.html       proxy hub, restyled flat, with the config-key fix
```

`gamehosting/` holds your own games (`games.json` lists them) and
`soundboard/` is the bundled soundboard game with its 600MB of audio under
`soundboard/media/`.

## Soundboard (`soundboard/`)

1,801 entries collapse to **1,670 unique files** (the list had duplicates), rendered
a page at a time instead of all at once: 120 tiles per page, a few hundred nodes
instead of roughly 7,000, and about 2 ms per filter change. Search is debounced and multi-word (`vine boom`),
the All / Favorites / Recent chips keep their state in `localStorage`, playing a
sound with overlap off reuses one `<audio>` element, and tiles are real buttons so
Tab + Enter work. Right-click or long-press a tile for favorite, download and copy
name. A sound whose mp3 is not on the server marks itself as missing and says so
instead of failing silently. The TTS panel is the same behaviour with the new skin.

## If you want to fold the skin into `app.css`

Delete `concept.css` / `concept.js` and work the rules back into `app.css`, or
keep the layered approach — the layer is loaded last, so either works.
