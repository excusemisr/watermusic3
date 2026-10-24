# watermusic

A static games portal. Hundreds of browser games, a proxy hub, and a drop-in
`/gamehosting` folder for your own games — all client side, no build step.

```
index.html          the app shell (markup only)
app.css             liquid-glass design system + layout
app.js              catalog, settings, game viewer, caching
proxy.html          proxy hub (self contained)
gamehosting/        your own games + manifest  (see gamehosting/README.md)
soundboard/         bundled soundboard game
```

## Features

- **Liquid glass UI** — frosted panels, aurora background, glass tiles.
- **4 games per row** by default with big square thumbnails. Columns (3–6),
  thumbnail shape, card labels and spacing are all in Settings → Layout.
- **Fonts you can change** — Outfit (default), Space Grotesk, Sora, JetBrains
  Mono. Settings → Appearance opens with eight one-click **theme presets**
  (midnight lime, terminal, vapor, ember, ice, reef, grape, daylight), each
  setting background and accent together; below that, theme (midnight / AMOLED /
  ocean / light), accent colour, glass blur, stars, grain and reduce-motion.
- **Fast game loading**
  - game HTML is fetched **without** a cache-busting `?t=` stamp, so the CDN and
    the browser HTTP cache can do their job;
  - played games are stored in the **Cache API** and in memory, so reopening one
    is instant (Settings → Playback can turn this off);
  - hovering a tile **prefetches** the game, and a click reuses that download;
  - `?id=` deep links start downloading the game *before* the catalog has even
    finished loading;
  - the catalog renders 60 tiles at a time and appends more as you scroll.
- **Starred + recently played** rows, search, category chips with counts, sort
  menu, random game button, keyboard shortcuts (`Ctrl/⌘ K` or `/` to search,
  `R` for random, `Esc` to close).
- **Deep links** — `?id=35` opens a CDN game, `?local=demo` opens a local one,
  `#embed` boots straight into the game.
- **Proxy page** (`proxy.html`) with five nodes, custom URL box, fullscreen and
  pop-out. The default node and "open in new tab" choice are in Settings → Proxy.
- **Hide tab** panel: tab disguise presets, panic key, about:blank cloaking.

## Adding your own games

Put a folder in `gamehosting/` with `index.html`, its own CSS/JS and
`photo.png`, then list it in `gamehosting/games.json`. Full details in
[gamehosting/README.md](gamehosting/README.md). A working sample lives in
`gamehosting/demo/` (Neon Runner).

## Notes

- Settings live in `localStorage` under `wm.config.v3` and are shared with the
  proxy page (theme, accent, font, node).
- `legacy-index.html` is the previous single-file version, kept for reference —
  safe to delete.
- `style.css` / `script.js` in the root are leftovers from an older build and
  are not referenced by anything.

JOIN OUR DISCORD: https://discord.gg/NAFw4ykZ7n
