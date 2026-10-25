# watermusic · concept

A design concept for the watermusic games portal. It is a **standalone copy** of
the site — the original `watermusic3/` folder is untouched and this folder sits
outside that git repo, so nothing here can be auto-committed or pushed.

Open `concept/index.html` (or serve the folder — see below) to look around.

```bash
# from the workspace root
cd concept
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

**Catalog curation (from your four notes files)**

- **Broken / crashing games are gone.** The 16 flagged ids (4, 27, 33, 35, 58,
  66, 117, 198, 211, 265, 285, 330, 375, 557, 560, 570) plus **Retro Bowl
  College** (matched by name) are filtered out before the catalog is built, so
  they can't show up in the grid, search, the palette, recents or the featured
  row.
- **Slop sweep.** 177 mobile ad-farm games are gone too: the endless runners,
  the idle / merge / tycoon clones, the licensed SpongeBob / Teen Titans
  shovelware, the "3D" one-tap games and the dress-up / makeover / telekinesis
  filler. Kept on purpose: Gunspin, Ragdoll Archers & Hit, Jetpack Joyride,
  Crossy Road, Fruit Ninja, Doodle Jump, Snow Rider 3D, Papa's series, Bloons,
  PvZ, Smash Karts, Moto X3M, plus **Plinko** and **Subway Surfers: San
  Francisco** (asked for by name). Catalog is now **382** (381 from the CDN +
  the sample local game).
- **Gunspin (91) and Happy Wheels (569) are pinned** — they sort above everything
  else whatever the sort order, with a small pinned tag on the card.
- **Amaze (26), Ragdoll Hit (44), Escape Road (264) and Aquapark.io (448) open in
  their own tab** instead of the in-page viewer, because they only behave there.
  They get a small "new tab" tag on the card.
- The "nothing needed, just works" list needed no change — those launch normally.

The lists live in one place at the top of `app.js` (`HIDDEN_IDS`, `SLOP_IDS`,
`HIDDEN_NAMES`, `PINNED_IDS`, `FORCE_TAB_IDS`) — add an id to remove a game, to
`PINNED_IDS` to pin it, or to `FORCE_TAB_IDS` to make it open in its own tab.

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
index.html      new shell (same IDs/classes app.js expects, plus the palette)
concept.css     the concept skin, loaded after app.css — app.css is unchanged
concept.js      card entrance, featured carousel, ⌘K palette
app.js          the original app + curated lists (hidden / pinned / new-tab),
                the 3s warning cooldown, and a small additive window.wm hook
                (games / open / isFav / toggleFav) for concept.js
proxy.html      original proxy, restyled flat, with the config-key fix
```

`gamehosting/` and `soundboard/` are copied from the original. `soundboard/media`
is a directory junction back to `watermusic3/soundboard/media` so the 600MB of
audio is not duplicated — replace it with a real folder if you move this concept
somewhere else.

## If you want to ship it

Delete `concept.css` / `concept.js`, copy the new `index.html` over the real one,
then work the skin back into `app.css` properly, or keep the layered approach —
either way `app.css` and `app.js` are the only files with real changes.
