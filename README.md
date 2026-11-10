# watermusic

A static games portal: a hand-picked catalog, an in-page game viewer and a
drop-in `gamehosting/` folder for your own games. No build step.

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
  **Sort** and **Find** next to their icons (icons only under 780px so the bar
  stays usable on a phone).
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
  palette row, no recent entry, no featured slot. **Catalog is 325**
  (261 curated CDN ids + 62 3kh0 games + the sample local game, plus the duplicate
  id 1 pair counted twice).
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
- The soundboard (id `179`) is on the list now. An entry with `"href"` instead
  of `"id"` opens any page directly — that is how
  `downloads/frequency-generator.html` gets a Recommended card without being a
  CDN game. Those entries show on the Recommended page; the strip on the main
  page only pins real catalog games.

**Games load from 3kh0's copies**

- Most of the shelf came from one CDN of single-file uploads and a lot of those
  files were dead, so any game 3kh0 also hosts now opens **their** copy from
  `lite.3kh0.net`: same card, name, cover, star and Recommended slot, a build
  that runs. Those are `type: 'kh0'` in the catalog — plain pages on their
  own host, so they skip `play.html` entirely.
- `data/3kh0.json` drives it: `slug`, `title`, `cover`, `replaces` (our CDN ids
  the entry takes over) and `add` (true = a card of its own). Currently 45 ids
  replaced and **62 new games** added; clicker/idle clones, 2048 re-skins and
  joke pages were left out.
- Shared links use `?g=<slug>` for these, alongside `?id=NN` and `?local=…`.

**Bonus fix found while curating:** the manifest ships two games with `id: 1`
(Bowmasters and OvO), so they shared one catalog key — starring or opening one
hit the other. Duplicate keys are now suffixed (`cdn:1`, `cdn:1-2`).

**The "not hosted by me" warning**

- The accept button is **locked for 3 seconds** every time the notice opens: it
  counts down (`Let me play (3)` → `(2)` → `(1)`), shows a thin progress line and
  the click is ignored until it unlocks, so it can't be tapped straight past.
  "Go back" stays available the whole time.

**Games open in their own tab by default**

- Clicking a card launches the game's own page in a new tab, so the library
  stays where it is and nothing loads inside a frame. Every game type gets the
  same treatment — CDN titles open their real CDN page, local games and the
  soundboard open their own file.
- **Settings → Playback → Launch → "Open games in a new tab"** turns it off.
  Switching it off opens a warning first — *"Turning this off WILL break some
  games"* — and nothing is saved until you press **Turn it off anyway**. With it
  off, games play in the in-page viewer as before.
- Shared links (`?id=NN`, `?local=…`), browser back/forward and the loader's
  retry button always use the in-page viewer: they aren't a click on a card, so
  a popup would be blocked anyway.
- If the browser blocks the tab, the game opens in the page instead and a toast
  says so.

**Public proxy — `proxy.html`**

- `/proxy.html` is open again: no combination, no code, and it is linked from
  the sidebar, the top bar, the hero and the footer. It is the same hub the
  locked page serves — five
  Achroma nodes, a custom-link field, reload, fullscreen and "open in new tab".
- A notice strip sits above the stage (the Oscar Molloy / Louis Sinclair
  warning). Edit the `<div class="notice">` block in `proxy.html` to reword it;
  the locked build reads `_vault/proxy-src.html`, so change both if the gate
  should say the same thing.

**The locked page**

- Nothing on the site links to it: no rail button, no top-bar button, no hero
  button, no settings panel, no footer or palette entry.
- **The code is needed twice.** On the main page the arrow-key combination opens
  the box and the code hands you one of the random addresses. That address shows
  nothing but a plain 404 — the same combination and the same code have to be
  entered again on it before it decrypts. A screenshot of the address bar, a
  photo of the screen or a URL someone read over your shoulder is therefore worth
  nothing on its own: it opens to a 404.
- The page itself is **not stored in plain text**. `_vault/build.js` encrypts
  `_vault/proxy-src.html` with a key derived from the passphrase (PBKDF2-SHA256,
  310k iterations, AES-256-GCM) and writes a shell: without the key it is a plain
  "404 — page could not be found", and the shell is what answers the URL.
  Reading the source, the repo or the dev console gives you ciphertext, and the
  folder name is not referenced anywhere in the site's HTML or JS.
- The page is published at a **pool of eight random addresses**, and every
  unlock sends you to a different one than last time, so the URL in the address
  bar is never the same twice in a row and there is nothing worth memorising.
  Every build throws the old pool away and makes a new one, which kills any URL
  that leaked.
- The key from the second unlock lives in `sessionStorage` for 6 hours, so a
  reload of that tab reopens the page, but the same URL in another tab, browser
  or profile is back to a 404.
- Three wrong codes in a row start a cooldown (30s, then 2m, then 10m); the
  counter lives in `localStorage`, so closing the tab does not reset it.

Rebuild after changing the page or the code:

```bash
node _vault/build.js "new passphrase"
```

`_vault/` is git-ignored, so the plain-text source is never published with the
site. Edit `_vault/proxy-src.html`, run the command, then commit `player.js` and
the address folders it printed — and delete the folders from the previous build
(the script removes the ones it recorded in `_vault/pool.json`, so a rebuild on
the same machine cleans up after itself). Change `POOL` in the script to publish
more or fewer addresses.

**Fixes carried in the concept**

- Theme preset swatches were collapsing to 2px wide (Chrome gives `<button>`
  `align-items:flex-start`); they now render.
- The locked page reads `wm.config.v5` (with `wm.config.v3` as a fallback), so
  theme, accent and font carry over from the main app.
- Its node dropdown used to draw **behind** the game iframe: the bar's
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
proxy.html       the public proxy hub (open, no gate)
play.html        game loader: fetches a CDN game page and starts it in the tab
                 (the CDN serves those files as text/plain, so linking straight
                 at them shows source instead of the game)
player.js        the hidden combo + access-code gate (generated by _vault/build.js)
<random>/        eight random folders, each a decoy 404 that decrypts to the
                 hub when the right code was entered in this tab
downloads/       single-file tools, not games (frequency generator)
```

`gamehosting/` holds your own games (`games.json` lists them) and
`soundboard/` is the bundled soundboard game with its 600MB of audio under
`soundboard/media/`.

The update log is the `#updateLog` panel in `index.html`; it opens once per
release and is keyed by `UPDATE_ID` in `app.js` (`wm.updates.seen`), so bump that
string when you add an entry.

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
