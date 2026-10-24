/* ============================================================
   watermusic · app
   - single source of truth for config, catalog and the game viewer
   - game loading is cached (memory + Cache API) and prefetched on hover
   ============================================================ */
(function () {
    'use strict';

    /* ---------------- constants ---------------- */
    const ROOT = new URL('./', location.href).href;
    const COVER_URL = 'https://cdn.jsdelivr.net/gh/gnmathcopy/covers@main';
    const HTML_URL = 'https://cdn.jsdelivr.net/gh/gnmathcopy/html@main';
    const ZONES_URLS = [
        'https://cdn.jsdelivr.net/gh/gnmathcopy/assets@main/zones.json',
        'https://raw.githubusercontent.com/gnmathcopy/assets/main/zones.json',
        'https://cdn.jsdelivr.net/gh/gnmathcopy/assets/zones.json'
    ];
    const LOCAL_BASE = ROOT + 'gamehosting/';
    const SOUNDBOARD_URL = ROOT + 'soundboard/index.html';
    const CONFIG_KEY = 'wm.config.v5';
    const RISK_KEY = 'wm.risk.ok';
    const ZONES_CACHE_KEY = 'wm.zones.v2';
    const FAV_KEY = 'wm.favorites';
    const RECENT_KEY = 'wm.recent';
    const GAME_CACHE = 'wm-games-v1';
    const PAGE_SIZE = 60;

    const FONTS = {
        outfit: { label: 'Outfit', stack: "'Outfit', system-ui, -apple-system, 'Segoe UI', sans-serif" },
        grotesk: { label: 'Grotesk', stack: "'Space Grotesk', system-ui, -apple-system, sans-serif" },
        sora: { label: 'Sora', stack: "'Sora', system-ui, -apple-system, sans-serif" },
        mono: { label: 'Mono', stack: "'JetBrains Mono', ui-monospace, 'Cascadia Mono', monospace" }
    };
    const THUMBS = { square: '1/1', wide: '16/10', portrait: '4/5' };
    // one-click looks: theme + accent, so a preset changes the whole palette
    const THEME_BG = { midnight: '#08080b', amoled: '#000000', ocean: '#050d12', light: '#f3f3ef' };
    const THEME_PRESETS = [
        { key: 'lime', label: 'Midnight lime', theme: 'midnight', accent: '#d7ff3e' },
        { key: 'terminal', label: 'Terminal', theme: 'amoled', accent: '#39ff88' },
        { key: 'vapor', label: 'Vapor', theme: 'midnight', accent: '#ff6bd6' },
        { key: 'ember', label: 'Ember', theme: 'amoled', accent: '#ff7a3d' },
        { key: 'ice', label: 'Ice', theme: 'ocean', accent: '#4cc9f0' },
        { key: 'reef', label: 'Reef', theme: 'ocean', accent: '#00e0c6' },
        { key: 'grape', label: 'Grape', theme: 'midnight', accent: '#b388ff' },
        { key: 'paper', label: 'Daylight', theme: 'light', accent: '#ffcc00' }
    ];
    const PROXY_NODES = [
        { id: 1, label: 'Achroma Link #1', url: 'https://frost-atlas-51214.surge.sh' },
        { id: 2, label: 'Achroma Link #2', url: 'https://river-harbor-52881.surge.sh' },
        { id: 3, label: 'Achroma Link #3', url: 'https://sage-reef-64729.surge.sh' },
        { id: 4, label: 'Achroma Link #4', url: 'https://lark-flint-66405.surge.sh' },
        { id: 5, label: 'Achroma Link #5', url: 'https://palm-arch-11546.surge.sh' }
    ];

    const DEFAULTS = {
        // appearance
        theme: 'midnight', accent: '#d7ff3e', font: 'grotesk',
        glass: true, blur: 16, blobs: false, stars: false, grain: true, motion: true,
        // layout
        columns: 4, thumb: 'square', labels: 'below', spacing: 'normal',
        // playback
        prefetch: true, cacheGames: true, external: 'tab', sort: 'name', riskEvery: true,
        // proxy
        proxyNode: 1, proxyNewTab: false,
        // privacy
        cloakPreset: 'none', cloakTitle: 'watermusic', cloakIcon: '',
        panicKey: '', panicUrl: 'about:blank', autoBlank: false
    };

    /* ---------------- tiny helpers ---------------- */
    const $ = (id) => document.getElementById(id);
    const el = (sel, root) => (root || document).querySelector(sel);
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function escapeReg(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function debounce(fn, ms) {
        let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(this, a), ms); };
    }
    function hexToRgb(hex) {
        hex = String(hex || '').replace('#', '');
        if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
        if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '215,255,62';
        const n = parseInt(hex, 16);
        return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
    }
    function normalizeHex(hex) {
        hex = String(hex || '').trim().replace('#', '');
        if (/^[0-9a-fA-F]{3}$/.test(hex)) hex = hex.split('').map((c) => c + c).join('');
        return /^[0-9a-fA-F]{6}$/.test(hex) ? '#' + hex.toLowerCase() : '#d7ff3e';
    }
    function titleFromFolder(folder) {
        return String(folder)
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, (c) => c.toUpperCase()) || folder;
    }
    function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { } }
    function read(key, fallback) {
        try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
    }
    function toast(message) {
        const wrap = $('toastWrap'); if (!wrap) return;
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = message;
        wrap.appendChild(t);
        setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, 2400);
    }

    /* ---------------- config ---------------- */
    // v5 changes the "warn me every time" default, so carry v4 appearance prefs over
    const storedConfig = read(CONFIG_KEY, null);
    const legacyConfig = storedConfig || read('wm.config.v4', null) || {};
    let config = Object.assign({}, DEFAULTS, legacyConfig);
    if (!storedConfig) {
        config.riskEvery = true;
        store(CONFIG_KEY, config);
    }
    if (config.glass === false && config.blur == null) config.blur = 0;

    function saveConfig() { store(CONFIG_KEY, config); flashSaved(); }
    let savedTimer;
    function flashSaved() {
        const pill = $('saveState'); if (!pill) return;
        pill.textContent = 'saving…';
        clearTimeout(savedTimer);
        savedTimer = setTimeout(() => { pill.textContent = 'saved'; }, 500);
    }

    function applyConfig() {
        const html = document.documentElement;
        const font = FONTS[config.font] || FONTS.outfit;
        html.dataset.theme = config.theme;
        html.dataset.labels = config.labels;
        html.dataset.spacing = config.spacing;
        html.dataset.glass = config.glass ? 'on' : 'off';
        html.dataset.bg = config.blobs ? 'glow' : 'plain';
        html.dataset.stars = config.stars ? 'on' : 'off';
        html.dataset.grain = config.grain ? 'on' : 'off';
        html.dataset.motion = config.motion ? 'full' : 'reduced';
        html.style.setProperty('--accent', config.accent);
        html.style.setProperty('--accent-rgb', hexToRgb(config.accent));
        html.style.setProperty('--blur', (config.glass ? config.blur : 0) + 'px');
        html.style.setProperty('--font', font.stack);
        html.style.setProperty('--thumb', THUMBS[config.thumb] || THUMBS.square);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', config.theme === 'light' ? '#e9edf6' : (config.theme === 'amoled' ? '#000000' : '#05060c'));
        layoutColumns();
    }

    function layoutColumns() {
        const w = window.innerWidth;
        let cols = Number(config.columns) || 4;
        if (w < 560) cols = 2;
        else if (w < 900) cols = Math.min(cols, 3);
        else if (w < 1240) cols = Math.min(cols, 4);
        document.documentElement.style.setProperty('--cols', cols);
        document.documentElement.style.setProperty('--gap', w < 560 ? '12px' : (config.spacing === 'compact' ? '11px' : '20px'));
    }

    /* ---------------- catalog ---------------- */
    let games = [];
    let popularity = {};
    let favs = new Set(read(FAV_KEY, []));
    let recent = read(RECENT_KEY, []);
    const state = { query: '', category: 'all', starred: false, sort: config.sort || 'name' };
    let riskAccepted = read(RISK_KEY, false);
    let pendingRisk = null;
    let pendingPreload = null;

    const CATEGORY_RULES = [
        { key: 'horror', label: 'Horror', words: ['five nights', 'fnaf', 'freddy', 'granny', 'baldi', 'backrooms', 'bendy', 'ink machine', 'buckshot', 'cat home', 'neighbor', 'r.e.p.o', 'repo', 'slender', 'scary'] },
        { key: 'shooter', label: 'Shooter', words: ['shooter', 'shoot', 'gun', 'bazooka', 'doom', '1v1', 'superhot', 'hotline', 'snowbattle', 'blade ball', 'gunspin', 'johnny trigger', 'sniper', 'war'] },
        { key: 'racing', label: 'Racing', words: ['race', 'racing', 'drift', 'moto', 'hill climb', 'highway', 'turbo', 'drive', 'driven', 'offroad', 'snow rider', 'bike', 'truck'] },
        { key: 'sports', label: 'Sports', words: ['basket', 'football', 'soccer', 'tennis', 'retro bowl', 'pool', 'carrom', 'archery', 'golf', 'volley', 'cricket', 'darts', 'chess', 'boxing'] },
        { key: 'music', label: 'Music', words: ['funkin', 'fnf', 'magic tiles', 'dance of fire', 'osu', 'sprunki', 'piano', 'beat', 'rhythm', 'soundboard'] },
        { key: 'puzzle', label: 'Puzzle', words: ['2048', 'wordle', 'bloxorz', 'color', 'match', 'sort', 'cut the rope', 'candy', 'maze', 'draw', 'trivia', 'guess', 'tiles', 'coreball', 'slice', 'sudoku', 'mahjong'] },
        { key: 'strategy', label: 'Strategy', words: ['bloons', 'tower', 'papa', 'plants vs zombies', 'state.io', 'defense', 'lords', 'king', 'card', 'clash', 'chess'] },
        { key: 'platformer', label: 'Platformer', words: ['vex', 'tiny square', 'parkour', 'slope', 'tunnel', 'run', 'jump', 'stickman', 'helix', 'temple run', 'subway', 'ice dodo', 'stacky', 'flappy', 'geometry', 'hardest', 'fireboy', 'watergirl', 'bottle'] },
        { key: 'sandbox', label: 'Sandbox', words: ['minecraft', 'world box', 'melon', 'playground', 'sandbox', 'build', 'craft'] },
        { key: 'sim', label: 'Sim', words: ['bitlife', 'pou', 'cookie clicker', 'fishing', 'achievement', 'life', 'shop', 'city', 'duck life', 'idle'] },
        { key: 'action', label: 'Action', words: ['ragdoll', 'combat', 'duelist', 'battle', 'ninja', 'sword', 'fighting', 'gladi', 'attack', 'brawl', 'bouncy', 'crazy cattle'] },
        { key: 'multiplayer', label: 'Multiplayer', words: ['.io', '1v1', 'among', 'paper', 'random', 'party'] }
    ];

    function categorize(name) {
        const n = String(name || '').toLowerCase();
        for (const rule of CATEGORY_RULES) {
            if (rule.words.some((w) => n.includes(w))) return rule.key;
        }
        return 'other';
    }

    function normalizeCdn(z, index) {
        const raw = String(z.url || '');
        const soundboard = String(z.id) === '179' || /soundboard/i.test(z.name || '');
        // only a URL that is literally http(s) in the manifest points at another site;
        // {HTML_URL}/x.html entries are single-file games served by the CDN
        const external = /^https?:/i.test(raw);
        const resolved = raw.replace('{COVER_URL}', COVER_URL).replace('{HTML_URL}', HTML_URL);
        return {
            key: 'cdn:' + z.id,
            id: z.id,
            name: z.name || ('Game ' + z.id),
            cover: String(z.cover || '').replace('{COVER_URL}', COVER_URL).replace('{HTML_URL}', HTML_URL),
            // the soundboard ships with the site, so play our own copy instead of the CDN one
            url: soundboard ? SOUNDBOARD_URL : resolved,
            type: soundboard ? 'soundboard' : (external ? 'external' : 'cdn'),
            source: 'cdn',
            author: z.author || '',
            authorLink: z.authorLink || '',
            category: categorize(z.name),
            featured: index === 0
        };
    }

    function normalizeLocal(entry) {
        let folder, name, thumb, tags = [], author = '';
        if (typeof entry === 'string') {
            folder = entry.trim();
        } else if (entry && typeof entry === 'object') {
            folder = entry.folder || entry.slug || entry.dir || entry.id || entry.name;
            name = entry.title || entry.displayName || entry.label;
            thumb = entry.thumbnail || entry.thumb || entry.image || entry.photo;
            tags = Array.isArray(entry.tags) ? entry.tags : (entry.category ? [entry.category] : []);
            author = entry.author || '';
        }
        folder = String(folder || '').replace(/^\/+|\/+$/g, '');
        if (!folder || folder.indexOf('..') !== -1) return null;
        const base = LOCAL_BASE + folder + '/';
        const game = {
            key: 'local:' + folder,
            id: folder,
            name: name || titleFromFolder(folder),
            cover: thumb ? (thumb.match(/^https?:/i) ? thumb : base + thumb.replace(/^\.?\//, '')) : base + 'photo.png',
            url: base + 'index.html',
            type: 'local',
            source: 'local',
            author: author,
            authorLink: '',
            category: tags.length ? categorize(tags.join(' ')) : categorize(folder),
            featured: false,
            tags: tags
        };
        return game;
    }

    function readZonesCache() {
        const cached = read(ZONES_CACHE_KEY, null);
        return cached && Array.isArray(cached.data) && cached.data.length ? cached.data : null;
    }

    async function fetchZones() {
        for (const url of ZONES_URLS) {
            try {
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 12000);
                const res = await fetch(url, { signal: ctrl.signal });
                clearTimeout(timer);
                if (!res.ok) continue;
                const json = await res.json();
                if (Array.isArray(json) && json.length) return json;
            } catch (e) { /* try the next mirror */ }
        }
        return null;
    }

    async function fetchLocalGames() {
        const out = [];
        let list = null;
        const bust = '?v=' + Date.now();
        try {
            const res = await fetch(LOCAL_BASE + 'games.json' + bust, { cache: 'no-store' });
            if (res.ok) {
                const json = await res.json();
                if (Array.isArray(json)) list = json;
                else if (json && Array.isArray(json.games)) list = json.games;
            }
        } catch (e) { }
        if (!list) {
            try {
                const res = await fetch(LOCAL_BASE + 'games.txt' + bust, { cache: 'no-store' });
                if (res.ok) {
                    const text = await res.text();
                    list = text.split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
                }
            } catch (e) { }
        }
        if (!list) {
            // last resort: a plain directory listing (works on servers with autoindex on)
            try {
                const res = await fetch(LOCAL_BASE, { cache: 'no-store' });
                if (res.ok) {
                    const text = await res.text();
                    const doc = new DOMParser().parseFromString(text, 'text/html');
                    const found = [];
                    doc.querySelectorAll('a[href]').forEach((a) => {
                        const href = a.getAttribute('href') || '';
                        if (!/\/$/.test(href) || /^https?:/i.test(href) || href.startsWith('..') || href.startsWith('/')) return;
                        const folder = href.replace(/\/+$/, '');
                        if (/^[A-Za-z0-9._-]+$/.test(folder)) found.push(folder);
                    });
                    if (found.length) list = found;
                }
            } catch (e) { }
        }
        (list || []).forEach((entry) => {
            const game = normalizeLocal(entry);
            if (game) out.push(game);
        });
        return out;
    }

    async function fetchPopularity() {
        try {
            const res = await fetch('https://data.jsdelivr.com/v1/stats/packages/gh/gnmathcopy/html@main/files?period=year');
            if (!res.ok) return;
            const data = await res.json();
            const map = {};
            (Array.isArray(data) ? data : []).forEach((file) => {
                const m = String(file.name || '').match(/\/(\d+)\.html$/);
                if (m) map[m[1]] = (file.hits && file.hits.total) || 0;
            });
            popularity = map;
            if (state.sort === 'popular') render();
        } catch (e) { }
    }

    /* ---------------- rendering ---------------- */
    let filtered = [];
    let rendered = 0;
    const grid = $('grid');

    function visibleGames() {
        const q = state.query.trim().toLowerCase();
        return games.filter((g) => {
            if (state.starred && !favs.has(g.key)) return false;
            if (state.category !== 'all' && g.category !== state.category) return false;
            if (q && !g.name.toLowerCase().includes(q)) return false;
            return true;
        }).sort((a, b) => {
            switch (state.sort) {
                case 'popular': return (popularity[b.id] || 0) - (popularity[a.id] || 0) || a.name.localeCompare(b.name);
                case 'id': return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
                case 'random': return Math.random() - 0.5;
                default: return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            }
        });
    }

    function nameMarkup(name, query) {
        const safe = escapeHtml(name);
        if (!query) return safe;
        try {
            return safe.replace(new RegExp('(' + escapeReg(escapeHtml(query)) + ')', 'ig'), '<mark>$1</mark>');
        } catch (e) { return safe; }
    }

    function ordinal(n) {
        const s = String(n + 1);
        return s.length < 2 ? '0' + s : s;
    }

    function cardHTML(game, query, eager, index) {
        const fav = favs.has(game.key);
        const meta = game.author ? escapeHtml(game.author) : '';
        return '' +
            '<article class="card" data-key="' + escapeHtml(game.key) + '" tabindex="0" role="button" aria-label="Play ' + escapeHtml(game.name) + '">' +
                '<div class="thumb-wrap">' +
                    '<img class="thumb" src="' + escapeHtml(game.cover) + '" alt="" ' + (eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"') + ' decoding="async">' +
                    '<span class="idx">' + ordinal(index || 0) + '</span>' +
                    '<button class="fav' + (fav ? ' on' : '') + '" data-fav="' + escapeHtml(game.key) + '" type="button" aria-label="Star game" title="Star game">' +
                        '<svg viewBox="0 0 24 24" fill="' + (fav ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/></svg>' +
                    '</button>' +
                    '<span class="play-pop">Play</span>' +
                '</div>' +
                '<div class="info">' +
                    '<div class="name">' + nameMarkup(game.name, query) + '</div>' +
                    (meta ? '<div class="meta">' + meta + '</div>' : '') +
                '</div>' +
            '</article>';
    }

    function appendPage() {
        if (rendered >= filtered.length) { updateStatus(); return; }
        const next = filtered.slice(rendered, rendered + PAGE_SIZE);
        const html = next.map((g, i) => cardHTML(g, state.query, rendered + i < 8, rendered + i)).join('');
        grid.insertAdjacentHTML('beforeend', html);
        rendered += next.length;
        updateStatus();
    }

    function updateStatus() {
        const status = $('gridStatus');
        const total = filtered.length;
        $('allCount').textContent = total;
        if (!games.length) { status.innerHTML = ''; return; }
        if (!total) {
            status.innerHTML = '';
            return;
        }
        if (rendered < total) {
            status.innerHTML = '<span class="loading-dots"><i></i><i></i><i></i></span> showing ' + rendered + ' of ' + total;
        } else {
            status.innerHTML = total > PAGE_SIZE ? 'that\'s all ' + total + ' games' : '';
        }
    }

    function render() {
        filtered = visibleGames();
        rendered = 0;
        grid.innerHTML = '';
        if (!filtered.length) {
            let title = games.length ? 'No games match that' : 'Loading games…';
            let sub = games.length ? 'Try another search or category.' : 'Hang tight, fetching the library.';
            if (state.starred && !favs.size) {
                title = 'Nothing starred yet';
                sub = 'Tap the star on any tile and it shows up here.';
            }
            grid.innerHTML = '<div class="empty"><b>' + title + '</b>' + sub + '</div>';
            updateStatus();
            return;
        }
        appendPage();
        renderCategoryCounts();
    }

    function renderCategories() {
        const nav = $('categoryNav');
        const cats = [{ key: 'all', label: 'All' }].concat(CATEGORY_RULES.map((r) => ({ key: r.key, label: r.label })));
        nav.innerHTML = cats.map((c) => (
            '<button class="chip' + (state.category === c.key ? ' active' : '') + '" data-cat="' + c.key + '" type="button">' +
            c.label + '<span class="n" data-count="' + c.key + '"></span></button>'
        )).join('');
        renderCategoryCounts();
    }

    function renderCategoryCounts() {
        if (!games.length) return;
        const counts = { all: games.length };
        games.forEach((g) => { counts[g.category] = (counts[g.category] || 0) + 1; });
        document.querySelectorAll('[data-count]').forEach((node) => {
            const key = node.getAttribute('data-count');
            node.textContent = counts[key] ? counts[key] : '';
        });
    }

    function renderRecent() {
        const section = $('recentSection');
        const row = $('recentRow');
        const items = recent.map((key) => games.find((g) => g.key === key)).filter(Boolean).slice(0, 12);
        if (!items.length) { section.hidden = true; row.innerHTML = ''; return; }
        section.hidden = false;
        row.innerHTML = items.map((g, i) => cardHTML(g, '', false, i)).join('');
    }

    function renderSpotlight() {
        const game = games.find((g) => g.featured) || games[0];
        if (!game) return;
        $('spTitle').textContent = game.name;
        $('spSub').textContent = game.author ? 'by ' + game.author : 'straight from the shelf';
        $('spBg').style.backgroundImage = 'url("' + game.cover + '")';
        $('spotlight').dataset.key = game.key;
        // warm the featured cover so the hero never flashes empty
        const img = new Image();
        img.src = game.cover;
    }

    function updateStats() {
        $('statGames').textContent = games.length;
        $('footCount').textContent = games.length;
        const mast = $('mastCount');
        if (mast) mast.textContent = games.length;
        const starred = $('statStarred');
        if (starred) starred.textContent = favs.size;
        document.querySelectorAll('[data-game-count]').forEach((n) => {
            n.textContent = games.length + ' games';
        });
        updateCacheStat();
    }

    async function updateCacheStat() {
        const node = $('statCached');
        if (!node) return;
        try {
            if (!('caches' in window)) { node.textContent = '—'; return; }
            const cache = await caches.open(GAME_CACHE);
            const keys = await cache.keys();
            node.textContent = keys.length;
        } catch (e) { node.textContent = '—'; }
    }

    /* ---------------- favorites / recent ---------------- */
    function toggleFav(key) {
        if (favs.has(key)) { favs.delete(key); toast('Removed from starred'); }
        else { favs.add(key); toast('Starred'); }
        store(FAV_KEY, Array.from(favs));
        document.querySelectorAll('[data-fav="' + CSS.escape(key) + '"]').forEach((btn) => {
            const on = favs.has(key);
            btn.classList.toggle('on', on);
            const path = btn.querySelector('svg');
            if (path) path.setAttribute('fill', on ? 'currentColor' : 'none');
        });
        if (currentGame && currentGame.key === key) updateFavButton();
        updateStats();
        if (state.starred) render();
    }

    function pushRecent(game) {
        recent = [game.key].concat(recent.filter((k) => k !== game.key)).slice(0, 16);
        store(RECENT_KEY, recent);
        renderRecent();
    }

    /* ---------------- game loading ---------------- */
    const memCache = new Map();
    function memSet(key, html) {
        memCache.set(key, html);
        if (memCache.size > 8) memCache.delete(memCache.keys().next().value);
    }
    async function gameCache() {
        if (!config.cacheGames || !('caches' in window)) return null;
        try { return await caches.open(GAME_CACHE); } catch (e) { return null; }
    }

    const inflight = new Map();
    async function fetchGameHTML(game, onProgress) {
        if (memCache.has(game.key)) { onProgress(1); return memCache.get(game.key); }
        // a hover-prefetch may already be downloading this game — share that request
        if (inflight.has(game.key)) return inflight.get(game.key);
        const task = downloadGameHTML(game, onProgress);
        inflight.set(game.key, task);
        try {
            return await task;
        } finally {
            if (inflight.get(game.key) === task) inflight.delete(game.key);
        }
    }

    async function downloadGameHTML(game, onProgress) {
        const cache = await gameCache();
        if (cache) {
            try {
                const hit = await cache.match(game.url);
                if (hit) {
                    const text = await hit.text();
                    memSet(game.key, text);
                    onProgress(1);
                    return text;
                }
            } catch (e) { }
        }
        const res = await fetch(game.url, { cache: 'default' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const total = Number(res.headers.get('content-length') || 0);
        let text;
        if (res.body && res.body.getReader && total > 0) {
            const reader = res.body.getReader();
            const chunks = [];
            let got = 0;
            for (; ;) {
                const step = await reader.read();
                if (step.done) break;
                chunks.push(step.value);
                got += step.value.length;
                onProgress(Math.min(0.98, got / total));
            }
            const merged = new Uint8Array(got);
            let off = 0;
            chunks.forEach((c) => { merged.set(c, off); off += c.length; });
            text = new TextDecoder('utf-8').decode(merged);
        } else {
            text = await res.text();
        }
        onProgress(1);
        memSet(game.key, text);
        if (cache) {
            try {
                cache.put(game.url, new Response(text, { headers: { 'content-type': 'text/html; charset=utf-8' } }))
                    .then(updateCacheStat)
                    .catch(() => { });
            } catch (e) { }
        }
        return text;
    }

    const prefetched = new Set();
    async function prefetch(game) {
        if (!config.prefetch || !game || game.type !== 'cdn' || prefetched.has(game.key)) return;
        prefetched.add(game.key);
        if (memCache.has(game.key)) return;
        const cache = await gameCache();
        if (cache) {
            try { if (await cache.match(game.url)) return; } catch (e) { }
        }
        fetchGameHTML(game, () => { }).catch(() => { prefetched.delete(game.key); });
    }

    /* ---------------- viewer ---------------- */
    let currentGame = null;
    let frame = $('vFrame');
    let frameArmed = false;
    let openToken = 0;
    let stallTimer = null;
    let slowTimer = null;
    const viewer = $('viewer');
    const loader = $('vLoader');

    function makeFrame() {
        const fresh = document.createElement('iframe');
        fresh.id = 'vFrame';
        fresh.title = 'Game';
        fresh.setAttribute('allow', 'autoplay; fullscreen; gamepad; clipboard-write; microphone; camera');
        fresh.setAttribute('allowfullscreen', '');
        fresh.addEventListener('load', () => { if (frameArmed) hideLoader(); });
        frame.replaceWith(fresh);
        frame = fresh;
        frameArmed = false;
    }

    let loaderGen = 0;
    function showLoader(game) {
        loaderGen++;
        loader.classList.remove('hide');
        loader.classList.add('show');
        $('loaderTitle').textContent = 'Loading ' + (game ? game.name : 'game') + '…';
        $('loaderSub').textContent = 'Reaching the game server.';
        $('loaderBar').style.width = '6%';
        $('loaderActions').innerHTML = '';
        clearTimeout(slowTimer);
        slowTimer = setTimeout(() => {
            $('loaderSub').textContent = 'Still going — slow connection? You can pop it out in a new tab.';
            $('loaderActions').innerHTML =
                '<button class="v-btn" data-loader="pop" type="button">Open in new tab</button>' +
                '<button class="v-btn" data-loader="cancel" type="button">Cancel</button>';
        }, 7000);
    }

    function hideLoader() {
        clearTimeout(slowTimer);
        clearTimeout(stallTimer);
        $('loaderBar').style.width = '100%';
        loader.classList.add('hide');
        const gen = ++loaderGen;
        setTimeout(() => {
            // only dismiss the overlay if no newer game started in the meantime
            if (gen === loaderGen && loader.classList.contains('hide')) {
                loader.classList.remove('show', 'hide');
            }
        }, 380);
    }

    function loaderError(message) {
        clearTimeout(slowTimer);
        $('loaderTitle').textContent = 'Could not load that game';
        $('loaderSub').textContent = message;
        $('loaderBar').style.width = '0%';
        $('loaderActions').innerHTML =
            '<button class="v-btn" data-loader="retry" type="button">Try again</button>' +
            '<button class="v-btn" data-loader="pop" type="button">Open in new tab</button>' +
            '<button class="v-btn" data-loader="cancel" type="button">Close</button>';
    }

    function updateFavButton() {
        const on = currentGame ? favs.has(currentGame.key) : false;
        $('vFav').classList.toggle('on', on);
        const svg = $('vFav').querySelector('svg');
        if (svg) svg.setAttribute('fill', on ? 'currentColor' : 'none');
        const label = $('vFav').querySelector('span');
        if (label) label.textContent = on ? 'Starred' : 'Star';
    }

    function setUrlHash() {
        if (!currentGame) return;
        const before = location.href;
        const url = new URL(location.href);
        url.searchParams.delete('id');
        url.searchParams.delete('local');
        if (currentGame.source === 'local') url.searchParams.set('local', currentGame.id);
        else if (/^\d+$/.test(String(currentGame.id))) url.searchParams.set('id', currentGame.id);
        if (url.toString() === before) return;
        history.pushState({ game: currentGame.key }, '', url.toString());
    }

    function clearUrlHash() {
        const url = new URL(location.href);
        url.searchParams.delete('id');
        url.searchParams.delete('local');
        history.replaceState({}, '', url.toString());
    }

    function needsRisk(game) {
        // games served from this site never trigger the notice
        if (!game || game.type === 'local' || game.type === 'soundboard') return false;
        if (config.riskEvery) return true;
        return !riskAccepted;
    }

    function showRisk(game, preloaded) {
        pendingRisk = game;
        pendingPreload = preloaded || null;
        const nameNode = $('riskGameName');
        if (nameNode) nameNode.textContent = game.name;
        const foot = $('riskFoot');
        if (foot) {
            foot.textContent = config.riskEvery
                ? 'you will see this before every game \u00b7 turn it off in Settings'
                : 'you accept this once \u00b7 turn warnings back on in Settings';
        }
        const dontAsk = $('riskDontAsk');
        if (dontAsk) dontAsk.checked = false;
        $('riskGate').classList.add('open');
        const accept = $('riskAccept');
        if (accept) setTimeout(() => accept.focus(), 30);
    }

    function closeRisk() {
        pendingRisk = null;
        pendingPreload = null;
        $('riskGate').classList.remove('open');
        if (!currentGame) clearUrlHash();
    }

    function acceptRisk() {
        const game = pendingRisk;
        const preloaded = pendingPreload;
        riskAccepted = true;
        store(RISK_KEY, true);
        const dontAsk = $('riskDontAsk');
        if (dontAsk && dontAsk.checked) setConfig('riskEvery', false);
        closeRisk();
        if (game) openGame(game, preloaded, true);
    }

    async function openGame(game, preloaded, skipRisk) {
        if (!game) return;
        if (!skipRisk && needsRisk(game)) { showRisk(game, preloaded); return; }
        currentGame = game;
        const token = ++openToken;
        viewer.classList.add('open');
        document.body.style.overflow = 'hidden';
        $('vName').textContent = game.name;
        $('vMeta').textContent = game.author ? game.author : '';
        updateFavButton();
        setUrlHash();
        pushRecent(game);
        makeFrame();
        showLoader(game);
        clearTimeout(stallTimer);

        if (game.type === 'external') {
            if (config.external === 'tab') {
                window.open(game.url, '_blank', 'noopener');
                closeGame();
                return;
            }
            frameArmed = true;
            frame.src = game.url;
            $('loaderSub').textContent = 'Waiting on the game\u2019s own page…';
            return;
        }

        if (game.type === 'local' || game.type === 'soundboard') {
            frameArmed = true;
            frame.src = game.url;
            $('loaderBar').style.width = '55%';
            $('loaderSub').textContent = 'Starting the local game…';
            stallTimer = setTimeout(() => {
                if (frameArmed) $('loaderSub').textContent = 'Taking a while. If nothing shows, the file may be missing.';
            }, 8000);
            return;
        }

        try {
            const html = preloaded || await fetchGameHTML(game, (p) => {
                if (token !== openToken) return;
                $('loaderBar').style.width = Math.max(6, Math.round(p * 100)) + '%';
                $('loaderSub').textContent = p < 1 ? 'Downloading game files…' : 'Starting the game…';
            });
            if (token !== openToken) return;
            frameArmed = true;
            frame.srcdoc = html;
            stallTimer = setTimeout(() => {
                if (frameArmed) $('loaderSub').textContent = 'Game is starting slowly — you can pop it out in a new tab.';
            }, 9000);
        } catch (err) {
            if (token !== openToken) return;
            loaderError('That game could not be downloaded (' + (err && err.message ? err.message : 'network error') + ').');
        }
    }

    function closeGame() {
        openToken++;
        frameArmed = false;
        clearTimeout(stallTimer);
        clearTimeout(slowTimer);
        viewer.classList.remove('open');
        document.body.style.overflow = '';
        loader.classList.remove('show', 'hide');
        currentGame = null;
        makeFrame();
        clearUrlHash();
    }

    function restartGame() {
        if (!currentGame) return;
        const g = currentGame;
        openGame(g, null, true);
    }

    async function popOut() {
        if (!currentGame) return;
        const g = currentGame;
        if (g.type === 'local' || g.type === 'soundboard') {
            window.open(g.url, '_blank', 'noopener');
            return;
        }
        const win = window.open('about:blank', '_blank');
        if (!win) { toast('Popup blocked — allow popups to open games in a tab.'); return; }
        try {
            const html = await fetchGameHTML(g, () => { });
            win.document.open();
            win.document.write(html);
            win.document.close();
        } catch (e) {
            win.close();
            toast('Could not open that game in a new tab.');
        }
    }

    function fullscreenGame() {
        const node = frame;
        if (!node) return;
        if (node.requestFullscreen) node.requestFullscreen().catch(() => { });
        else if (node.webkitRequestFullscreen) node.webkitRequestFullscreen();
        else if (node.msRequestFullscreen) node.msRequestFullscreen();
    }

    function downloadGame() {
        if (!currentGame || currentGame.type !== 'cdn') { toast('That one can\u2019t be saved.'); return; }
        const g = currentGame;
        fetchGameHTML(g, () => { }).then((html) => {
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = g.name.replace(/[^\w.-]+/g, '_') + '.html';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        }).catch(() => toast('Download failed.'));
    }

    /* ---------------- cards wiring ---------------- */
    function findGame(key) { return games.find((g) => g.key === key); }

    document.addEventListener('click', (e) => {
        const favBtn = e.target.closest('[data-fav]');
        if (favBtn) {
            e.preventDefault();
            e.stopPropagation();
            toggleFav(favBtn.getAttribute('data-fav'));
            return;
        }
        const card = e.target.closest('.card');
        if (card && card.dataset.key) {
            e.preventDefault();
            const game = findGame(card.dataset.key);
            if (game) openGame(game);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const card = e.target.closest && e.target.closest('.card');
        if (card && card.dataset.key && document.activeElement === card) {
            e.preventDefault();
            const game = findGame(card.dataset.key);
            if (game) openGame(game);
        }
    });

    function attachHoverPrefetch() {
        let hoverTimer;
        document.addEventListener('pointerover', (e) => {
            const card = e.target.closest && e.target.closest('.card');
            if (!card || !card.dataset.key) return;
            clearTimeout(hoverTimer);
            hoverTimer = setTimeout(() => {
                const game = findGame(card.dataset.key);
                if (game) prefetch(game);
            }, 120);
        }, { passive: true });
        document.addEventListener('pointerout', () => clearTimeout(hoverTimer), { passive: true });
    }

    // reveal thumbnails once decoded
    document.addEventListener('load', (e) => {
        const img = e.target;
        if (img && img.classList && img.classList.contains('thumb')) img.classList.add('loaded');
    }, true);
    document.addEventListener('error', (e) => {
        const img = e.target;
        if (img && img.classList && img.classList.contains('thumb')) {
            img.classList.add('loaded');
            img.style.opacity = '0';
        }
    }, true);

    /* ---------------- settings sheet ---------------- */
    const PANELS = [
        { key: 'appearance', label: 'Appearance', icon: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/>' },
        { key: 'layout', label: 'Layout', icon: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>' },
        { key: 'playback', label: 'Playback', icon: '<path d="M8 5v14l11-7z"/>' },
        { key: 'proxy', label: 'Proxy', icon: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/>' },
        { key: 'privacy', label: 'Hide tab', icon: '<path d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12 17.9 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>' },
        { key: 'data', label: 'Data', icon: '<ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6"/>' },
        { key: 'about', label: 'About', icon: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.2"/>' }
    ];
    let activePanel = 'appearance';

    function seg(key, options, value) {
        return '<div class="seg" data-seg="' + key + '">' + options.map((o) => (
            '<button type="button" data-val="' + o[0] + '" class="' + (String(value) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>'
        )).join('') + '</div>';
    }
    function row(title, hint, control) {
        return '<div class="row"><div class="row-text"><b>' + title + '</b>' + (hint ? '<small>' + hint + '</small>' : '') + '</div><div class="control">' + control + '</div></div>';
    }
    function toggle(key, value) {
        return '<label class="switch"><input type="checkbox" data-check="' + key + '"' + (value ? ' checked' : '') + '><span></span></label>';
    }

    function isPresetOn(p) {
        return config.theme === p.theme && normalizeHex(config.accent) === p.accent;
    }

    function panelAppearance() {
        const accentChoices = ['#7c8cff', '#00e0c6', '#ff6b9d', '#ffb347', '#4cc9f0', '#b388ff'];
        const current = normalizeHex(config.accent);
        const custom = accentChoices.indexOf(current) === -1;
        return '' +
            '<section><h4>Themes</h4><span class="hint">One click sets the background and the accent together.</span>' +
                '<div class="presets">' + THEME_PRESETS.map((p) => (
                    '<button class="preset' + (isPresetOn(p) ? ' on' : '') + '" type="button" data-preset="' + p.key + '" aria-pressed="' + (isPresetOn(p) ? 'true' : 'false') + '">' +
                    '<span class="preset-swatch" style="background:' + THEME_BG[p.theme] + '"><i style="background:' + p.accent + '"></i></span>' +
                    '<span class="preset-name">' + p.label + '</span></button>'
                )).join('') + '</div>' +
            '</section>' +
            '<section><h4>Theme</h4><span class="hint">The base palette for the whole site.</span>' +
                seg('theme', [['midnight', 'Midnight'], ['amoled', 'AMOLED'], ['ocean', 'Ocean'], ['light', 'Light']], config.theme) +
            '</section>' +
            '<section><h4>Accent colour</h4><span class="hint">Buttons, highlights and glows follow this colour.</span>' +
                '<div class="swatches">' +
                accentChoices.map((c) => '<button class="swatch' + (c === current ? ' on' : '') + '" type="button" data-accent="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join('') +
                '<label class="swatch custom' + (custom ? ' on' : '') + '" title="Custom accent"><input type="color" id="accentPicker" value="' + current + '"></label>' +
                '</div>' +
                '<div class="field" style="margin-top:12px"><input type="text" id="accentHex" value="' + current + '" placeholder="#7c8cff" aria-label="Accent hex"><button class="btn" type="button" data-action="accent-default">Reset</button></div>' +
            '</section>' +
            '<section><h4>Typeface</h4><span class="hint">Pick the font used across the interface.</span>' +
                seg('font', Object.keys(FONTS).map((k) => [k, FONTS[k].label]), config.font) +
            '</section>' +
            '<section><h4>Glass</h4>' +
                row('Liquid glass', 'Frosted blur behind panels and bars.', toggle('glass', config.glass)) +
                row('Blur intensity', 'How frosted the glass looks.', '<input type="range" min="0" max="40" step="2" data-range="blur" value="' + config.blur + '"><span class="pill" id="blurValue">' + config.blur + 'px</span>') +
            '</section>' +
            '<section><h4>Background</h4>' +
                row('Aurora glow', 'Soft animated colour blobs.', toggle('blobs', config.blobs)) +
                row('Stars', 'Tiny star field overlay.', toggle('stars', config.stars)) +
                row('Film grain', 'Subtle texture over the background.', toggle('grain', config.grain)) +
                row('Reduce motion', 'Stop animations and hover movement.', toggle('motion', !config.motion)) +
            '</section>';
    }

    function panelLayout() {
        return '' +
            '<section><h4>Grid</h4><span class="hint">Four games per row by default — bigger thumbnails, fewer rows to scroll.</span>' +
                row('Games per row', 'On small screens this adapts automatically.', seg('columns', [['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']], config.columns)) +
                row('Thumbnail shape', 'Square keeps the original art uncropped.', seg('thumb', [['square', 'Square'], ['wide', 'Wide'], ['portrait', 'Tall']], config.thumb)) +
                row('Spacing', 'Comfortable or dense.', seg('spacing', [['normal', 'Normal'], ['compact', 'Compact']], config.spacing)) +
            '</section>' +
            '<section><h4>Card labels</h4>' +
                row('Title position', 'Where the game name sits on a card.', seg('labels', [['below', 'Below'], ['overlay', 'Overlay'], ['hidden', 'Hidden']], config.labels)) +
            '</section>' +
            '<section><h4>Preview</h4><div class="preview-tile" id="layoutPreview"></div></section>';
    }

    function panelPlayback() {
        return '' +
            '<section><h4>Speed</h4><span class="hint">Games are cached after the first load, so the second launch is instant.</span>' +
                row('Prefetch on hover', 'Start downloading a game as soon as you hover it.', toggle('prefetch', config.prefetch)) +
                row('Cache games on this device', 'Stores played games locally for instant replays.', toggle('cacheGames', config.cacheGames)) +
                row('Default sort', 'Used when the page loads.', '<select data-select="sort">' +
                    [['name', 'Name A-Z'], ['id', 'Newest ID'], ['popular', 'Most played'], ['random', 'Shuffle']]
                        .map((o) => '<option value="' + o[0] + '"' + (config.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') +
                    '</select>') +
            '</section>' +
            '<section><h4>Launch</h4>' +
                row('Stubborn games', 'Some refuse the in-page viewer — open them in a tab instead.', seg('external', [['tab', 'New tab'], ['frame', 'In page']], config.external)) +
                row('Warn me every time', 'Show the “not hosted by me” notice before every launch.', toggle('riskEvery', config.riskEvery)) +
                '<div class="field" style="margin-top:12px"><button class="btn" type="button" data-action="risk-reset">Show the warning again</button></div>' +
            '</section>' +
            '<section><h4>Game cache</h4>' +
                '<div class="preview-tile"><div><div class="pv-name" id="cacheTitle">Checking…</div><div class="pv-meta" id="cacheMeta">Games stored in your browser</div></div>' +
                '<button class="btn danger" type="button" data-action="clear-cache">Clear cache</button></div>' +
            '</section>';
    }

    function panelProxy() {
        return '' +
            '<section><h4>Default node</h4><span class="hint">The proxy page opens on this node.</span>' +
                row('Node', 'Five mirrors are available.', '<select data-select="proxyNode">' +
                    PROXY_NODES.map((n) => '<option value="' + n.id + '"' + (String(config.proxyNode) === String(n.id) ? ' selected' : '') + '>' + n.label + '</option>').join('') +
                    '</select>') +
                row('Open proxy in a new tab', 'Keeps the games library loaded behind it.', toggle('proxyNewTab', config.proxyNewTab)) +
            '</section>' +
            '<section><h4>Launch</h4><div class="field"><button class="btn primary" type="button" data-action="open-proxy">Open proxy</button></div>' +
                '<div class="note">The proxy is a separate page (proxy.html). If a node is down, switch to another one in the dropdown there.</div>' +
            '</section>';
    }

    const CLOAK_PRESETS = {
        none: ['No disguise', 'watermusic', 'favicon.png'],
        quizlet: ['Quizlet', 'Quizlet', 'https://quizlet.com/favicon.ico'],
        google: ['Google', 'Google', 'https://www.google.com/favicon.ico'],
        classroom: ['Google Classroom', 'Google Classroom', 'https://ssl.gstatic.com/classroom/ic_product_classroom_32.png'],
        desmos: ['Desmos', 'Desmos', 'https://www.desmos.com/favicon.ico']
    };

    function panelPrivacy() {
        const options = Object.keys(CLOAK_PRESETS).map((k) => (
            '<option value="' + k + '"' + (config.cloakPreset === k ? ' selected' : '') + '>' + CLOAK_PRESETS[k][0] + '</option>'
        )).join('');
        return '' +
            '<section><h4>Tab disguise</h4><span class="hint">Change the tab title and icon so it looks like something else.</span>' +
                row('Preset', 'Quick disguises for school.', '<select data-select="cloakPreset">' + options +
                    '<option value="custom"' + (config.cloakPreset === 'custom' ? ' selected' : '') + '>Custom</option></select>') +
                '<div class="field" style="margin-top:12px"><input type="text" id="cloakTitle" placeholder="Tab title" value="' + escapeHtml(config.cloakTitle) + '"><button class="btn" type="button" data-action="apply-cloak">Apply</button></div>' +
                '<div class="field" style="margin-top:8px"><input type="text" id="cloakIcon" placeholder="Icon URL" value="' + escapeHtml(config.cloakIcon) + '"></div>' +
            '</section>' +
            '<section><h4>Panic key</h4><span class="hint">Press this key anywhere to leave the page instantly.</span>' +
                row('Current key', 'Click to rebind.', '<button class="btn" type="button" data-action="rebind-panic">' + (config.panicKey ? escapeHtml(config.panicKey) : 'Set key') + '</button>') +
                row('Destination', 'Where the panic key sends you.', '<input type="text" data-text="panicUrl" value="' + escapeHtml(config.panicUrl) + '" style="width:170px" class="btn">') +
            '</section>' +
            '<section><h4>Cloaked window</h4>' +
                row('Open in about:blank on launch', 'Reloads the site inside a blank tab.', toggle('autoBlank', config.autoBlank)) +
                '<div class="field" style="margin-top:12px"><button class="btn" type="button" data-action="cloak-blank">Open in about:blank now</button></div>' +
            '</section>';
    }

    function panelData() {
        return '' +
            '<section><h4>Stored data</h4><span class="hint">Everything lives in your browser — nothing is sent anywhere.</span>' +
                '<div class="preview-tile"><div><div class="pv-name">Library cache</div><div class="pv-meta">Game list and covers metadata</div></div><button class="btn" type="button" data-action="clear-zones">Refresh library</button></div>' +
                '<div class="preview-tile"><div><div class="pv-name">Starred games</div><div class="pv-meta">' + favs.size + ' starred</div></div><button class="btn danger" type="button" data-action="clear-favs">Clear</button></div>' +
                '<div class="preview-tile"><div><div class="pv-name">Recently played</div><div class="pv-meta">' + recent.length + ' games</div></div><button class="btn danger" type="button" data-action="clear-recent">Clear</button></div>' +
            '</section>' +
            '<section><h4>Reset</h4><div class="field"><button class="btn danger" type="button" data-action="reset-settings">Reset all settings</button></div></section>';
    }

    function panelAbout() {
        return '' +
            '<section><h4>watermusic</h4><span class="hint">A free games portal that runs entirely in your browser. No account, no tracking.</span>' +
                row('Version', 'Catalogue release', '<span class="pill">3.1</span>') +
                row('Index', 'Everything playable in this build.', '<span class="pill">' + games.length + ' games</span>') +
            '</section>' +
            '<section><h4>Links</h4>' +
                '<div class="field"><a class="btn" href="./proxy.html">Proxy</a>' +
                '<a class="btn" href="https://moonlight-hub.pages.dev/" target="_blank" rel="noopener">Moonlight Hub</a></div>' +
            '</section>';
    }

    const PANEL_RENDER = {
        appearance: panelAppearance,
        layout: panelLayout,
        playback: panelPlayback,
        proxy: panelProxy,
        privacy: panelPrivacy,
        data: panelData,
        about: panelAbout
    };

    function renderSheet() {
        $('sheetNav').innerHTML = PANELS.map((p) => (
            '<button type="button" data-panel="' + p.key + '" class="' + (activePanel === p.key ? 'active' : '') + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + p.icon + '</svg>' +
            p.label + '</button>'
        )).join('');
        $('sheetContent').innerHTML = PANELS.map((p) => (
            '<div class="panel ' + (activePanel === p.key ? 'active' : '') + '" id="panel-' + p.key + '">' + PANEL_RENDER[p.key]() + '</div>'
        )).join('');
        if (activePanel === 'playback') refreshCacheInfo();
        if (activePanel === 'layout') renderLayoutPreview();
    }

    function renderLayoutPreview() {
        const node = $('layoutPreview');
        if (!node) return;
        node.innerHTML = '<div><div class="pv-name">' + config.columns + ' games per row · ' + config.thumb + '</div>' +
            '<div class="pv-meta">' + FONTS[config.font].label + ' font · ' + config.labels + ' labels</div></div>' +
            '<div style="display:flex;gap:6px">' + new Array(Math.min(6, Number(config.columns))).fill(0).map(() => (
                '<span style="width:18px;height:18px;border-radius:5px;background:rgba(var(--accent-rgb),.5)"></span>'
            )).join('') + '</div>';
    }

    async function refreshCacheInfo() {
        const title = $('cacheTitle');
        const meta = $('cacheMeta');
        if (!title) return;
        try {
            if (!('caches' in window)) { title.textContent = 'Not supported'; meta.textContent = 'This browser has no Cache API'; return; }
            const cache = await caches.open(GAME_CACHE);
            const keys = await cache.keys();
            title.textContent = keys.length + ' game' + (keys.length === 1 ? '' : 's') + ' cached';
            if ('storage' in navigator && navigator.storage.estimate) {
                const est = await navigator.storage.estimate();
                const used = ((est.usage || 0) / 1048576).toFixed(1);
                meta.textContent = 'About ' + used + ' MB used on this device';
            } else {
                meta.textContent = 'Stored in your browser';
            }
        } catch (e) {
            title.textContent = 'Cache unavailable';
        }
    }

    function openSettings(panel) {
        if (panel) activePanel = panel;
        renderSheet();
        $('settingsSheet').classList.add('open');
    }
    function closeSettings() { $('settingsSheet').classList.remove('open'); }

    // a preset is only "on" while its exact theme + accent pair is active
    function syncPresetState() {
        document.querySelectorAll('[data-preset]').forEach((b) => {
            const p = THEME_PRESETS.find((x) => x.key === b.getAttribute('data-preset'));
            const on = p ? isPresetOn(p) : false;
            b.classList.toggle('on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    function setConfig(key, value, opts) {
        config[key] = value;
        saveConfig();
        applyConfig();
        syncPresetState();
        if (!opts || !opts.keepPanel) {
            if (activePanel === 'layout') renderLayoutPreview();
        }
        if (key === 'sort') { state.sort = value; render(); }
        if (key === 'cacheGames' || key === 'prefetch') { /* no re-render needed */ }
    }

    function rebindPanic() {
        const btn = document.querySelector('[data-action="rebind-panic"]');
        if (btn) btn.textContent = 'Press a key…';
        const handler = (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            document.removeEventListener('keydown', handler, true);
            if (e.key !== 'Escape') {
                config.panicKey = e.key;
                saveConfig();
            }
            renderSheet();
        };
        setTimeout(() => document.addEventListener('keydown', handler, true), 50);
    }

    function applyCloak() {
        const titleNode = $('cloakTitle');
        const iconNode = $('cloakIcon');
        config.cloakTitle = titleNode ? titleNode.value : config.cloakTitle;
        config.cloakIcon = iconNode ? iconNode.value : config.cloakIcon;
        config.cloakPreset = 'custom';
        document.title = config.cloakTitle || 'watermusic';
        setFavicon(config.cloakIcon || 'favicon.png');
        saveConfig();
        toast('Tab disguise applied');
    }

    function setFavicon(href) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = href || 'favicon.png';
    }

    function cloakToBlank() {
        const url = location.href;
        const win = window.open('about:blank');
        if (!win) { toast('Popup blocked — allow popups for this site.'); return; }
        win.document.write('<!doctype html><title>.</title><script>location.replace(' + JSON.stringify(url) + ');<\/script>');
        win.document.close();
        setTimeout(() => { try { location.replace('about:blank'); } catch (e) { } }, 200);
    }

    // settings interactions
    const sheetNav = $('sheetNav');
    if (sheetNav) {
        // the tab rail is a sibling of the content pane, so it needs its own listener
        sheetNav.addEventListener('click', (e) => {
            const navBtn = e.target.closest('[data-panel]');
            if (!navBtn) return;
            activePanel = navBtn.getAttribute('data-panel');
            document.querySelectorAll('#sheetNav button').forEach((b) => b.classList.toggle('active', b === navBtn));
            document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + activePanel));
            if (activePanel === 'playback') refreshCacheInfo();
            if (activePanel === 'layout') renderLayoutPreview();
        });
    }

    const sheetContent = $('sheetContent');
    if (sheetContent) {
        sheetContent.addEventListener('click', (e) => {
            const segBtn = e.target.closest('.seg button');
            if (segBtn) {
                const segNode = segBtn.closest('.seg');
                const key = segNode.getAttribute('data-seg');
                let value = segBtn.getAttribute('data-val');
                if (key === 'columns') value = Number(value);
                if (key === 'motion') value = !(value === 'reduced');
                segNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === segBtn));
                setConfig(key, value);
                return;
            }
            const presetBtn = e.target.closest('[data-preset]');
            if (presetBtn) {
                const preset = THEME_PRESETS.find((p) => p.key === presetBtn.getAttribute('data-preset'));
                if (preset) {
                    config.theme = preset.theme;
                    setConfig('accent', preset.accent);
                    renderSheet();
                    toast(preset.label + ' applied');
                }
                return;
            }
            const accentBtn = e.target.closest('[data-accent]');
            if (accentBtn) {
                setConfig('accent', accentBtn.getAttribute('data-accent'));
                document.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s === accentBtn));
                const hex = $('accentHex');
                if (hex) hex.value = accentBtn.getAttribute('data-accent');
                return;
            }
            const action = e.target.closest('[data-action]');
            if (action) {
                const kind = action.getAttribute('data-action');
                if (kind === 'accent-default') { setConfig('accent', '#d7ff3e'); renderSheet(); }
                else if (kind === 'clear-cache') {
                    caches.delete(GAME_CACHE).then(() => { refreshCacheInfo(); updateCacheStat(); toast('Game cache cleared'); });
                } else if (kind === 'clear-zones') {
                    localStorage.removeItem(ZONES_CACHE_KEY);
                    location.reload();
                } else if (kind === 'clear-favs') {
                    favs = new Set(); store(FAV_KEY, []); render(); renderSheet(); toast('Starred games cleared');
                } else if (kind === 'clear-recent') {
                    recent = []; store(RECENT_KEY, []); renderRecent(); renderSheet(); toast('Recent games cleared');
                } else if (kind === 'reset-settings') {
                    config = Object.assign({}, DEFAULTS);
                    store(CONFIG_KEY, config);
                    applyConfig(); renderSheet(); render();
                    toast('Settings reset');
                } else if (kind === 'open-proxy') {
                    const url = './proxy.html?node=' + config.proxyNode;
                    if (config.proxyNewTab) window.open(url, '_blank', 'noopener');
                    else location.href = url;
                } else if (kind === 'risk-reset') {
                    riskAccepted = false;
                    store(RISK_KEY, false);
                    toast('The notice will show again');
                } else if (kind === 'apply-cloak') {
                    applyCloak();
                } else if (kind === 'rebind-panic') {
                    rebindPanic();
                } else if (kind === 'cloak-blank') {
                    cloakToBlank();
                }
            }
        });

        sheetContent.addEventListener('change', (e) => {
            const check = e.target.closest('[data-check]');
            if (check) {
                const key = check.getAttribute('data-check');
                if (key === 'motion') setConfig('motion', !check.checked);
                else setConfig(key, check.checked);
                return;
            }
            const select = e.target.closest('[data-select]');
            if (select) {
                const key = select.getAttribute('data-select');
                let value = select.value;
                if (key === 'proxyNode') value = Number(value);
                if (key === 'cloakPreset') {
                    config.cloakPreset = value;
                    const preset = CLOAK_PRESETS[value];
                    if (preset && value !== 'none') {
                        config.cloakTitle = preset[1];
                        config.cloakIcon = preset[2];
                        document.title = preset[1];
                        setFavicon(preset[2]);
                    }
                    saveConfig();
                    renderSheet();
                    return;
                }
                setConfig(key, value);
                return;
            }
            if (e.target.id === 'accentPicker') {
                setConfig('accent', e.target.value);
                const hex = $('accentHex');
                if (hex) hex.value = e.target.value;
            }
        });

        sheetContent.addEventListener('input', debounce((e) => {
            if (e.target.id === 'accentPicker') {
                setConfig('accent', e.target.value);
                const hex = $('accentHex');
                if (hex) hex.value = e.target.value;
                return;
            }
            if (e.target.id === 'accentHex') {
                const value = normalizeHex(e.target.value);
                if (value) setConfig('accent', value);
                return;
            }
            const range = e.target.closest('[data-range]');
            if (range) {
                const key = range.getAttribute('data-range');
                setConfig(key, Number(range.value));
                const label = $('blurValue');
                if (label) label.textContent = range.value + 'px';
            }
        }, 60));

        sheetContent.addEventListener('change', (e) => {
            const text = e.target.closest('[data-text]');
            if (text) setConfig(text.getAttribute('data-text'), text.value);
        });
    }

    /* ---------------- top bar ---------------- */
    const SORTS = [['name', 'Name A-Z'], ['id', 'Newest ID'], ['popular', 'Most played'], ['random', 'Shuffle']];
    function renderSortMenu() {
        const menu = $('sortMenu');
        menu.innerHTML = SORTS.map((s) => (
            '<button type="button" data-sort="' + s[0] + '" class="' + (state.sort === s[0] ? 'on' : '') + '">' + s[1] + '</button>'
        )).join('') + '<hr><button type="button" data-sort-action="reset">Reset filters</button>';
    }

    const searchBar = $('searchBar');
    const debouncedSearch = debounce(() => {
        state.query = searchBar.value;
        render();
    }, 110);
    searchBar.addEventListener('input', debouncedSearch);

    $('sortBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        renderSortMenu();
        $('sortMenu').classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#sortMenu') && !e.target.closest('#sortBtn')) $('sortMenu').classList.remove('open');
    });
    $('sortMenu').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-sort]');
        if (btn) {
            state.sort = btn.getAttribute('data-sort');
            setConfig('sort', state.sort);
            render();
            $('sortMenu').classList.remove('open');
            return;
        }
        if (e.target.closest('[data-sort-action]')) {
            state.query = ''; state.category = 'all';
            setStarredOnly(false);
            searchBar.value = '';
            renderCategories();
            render();
            $('sortMenu').classList.remove('open');
        }
    });

    $('categoryNav').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cat]');
        if (!btn) return;
        state.category = btn.getAttribute('data-cat');
        document.querySelectorAll('#categoryNav .chip').forEach((c) => c.classList.toggle('active', c === btn));
        render();
    });

    function setStarredOnly(on) {
        state.starred = !!on;
        // keep the sidebar honest: starred filter on = Starred highlighted, off = Games
        document.querySelectorAll('[data-nav]').forEach((b) => {
            const nav = b.getAttribute('data-nav');
            if (nav === 'starred') b.classList.toggle('active', state.starred);
            else if (nav === 'games') b.classList.toggle('active', !state.starred);
        });
    }

    function randomGame() {
        const pool = filtered.length ? filtered : games;
        if (!pool.length) return;
        openGame(pool[Math.floor(Math.random() * pool.length)]);
    }
    $('randomBtn').addEventListener('click', randomGame);
    $('heroRandom').addEventListener('click', randomGame);

    $('spotlight').addEventListener('click', () => {
        const key = $('spotlight').dataset.key;
        const game = key ? findGame(key) : (games.find((g) => g.featured) || games[0]);
        if (game) openGame(game);
    });
    $('spotlight').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('spotlight').click(); }
    });

    $('clearRecent').addEventListener('click', () => {
        recent = []; store(RECENT_KEY, []); renderRecent(); toast('Recent games cleared');
    });

    document.querySelectorAll('[data-nav]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const nav = btn.getAttribute('data-nav');
            document.querySelectorAll('[data-nav]').forEach((b) => b.classList.toggle('active', b === btn));
            if (nav === 'starred') {
                setStarredOnly(true);
                render();
                $('games').scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (nav === 'recent') {
                // scrolls to the "jump back in" row instead of filtering

                if (recent.length) $('recentSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
                else toast('No recent games yet');
            } else {
                setStarredOnly(false);
                render();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });

    /* ---------------- viewer buttons ---------------- */
    $('vClose').addEventListener('click', closeGame);
    $('vFull').addEventListener('click', fullscreenGame);
    $('vReload').addEventListener('click', restartGame);
    $('vPop').addEventListener('click', popOut);
    $('vFav').addEventListener('click', () => { if (currentGame) toggleFav(currentGame.key); });
    $('riskAccept').addEventListener('click', acceptRisk);
    $('riskCancel').addEventListener('click', closeRisk);
    $('riskGate').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeRisk(); });
    $('vLoader').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-loader]');
        if (!btn) return;
        const kind = btn.getAttribute('data-loader');
        if (kind === 'retry' && currentGame) openGame(currentGame);
        else if (kind === 'pop') popOut();
        else if (kind === 'cancel') closeGame();
    });
    // download button is added here so the toolbar stays compact on mobile
    (function addDownloadButton() {
        const actions = document.querySelector('.v-actions');
        if (!actions) return;
        const btn = document.createElement('button');
        btn.className = 'v-btn';
        btn.id = 'vDownload';
        btn.type = 'button';
        btn.title = 'Download this game as HTML';
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/></svg><span>Save</span>';
        btn.addEventListener('click', downloadGame);
        actions.appendChild(btn);
    })();

    /* ---------------- settings + global keys ---------------- */
    $('settingsBtn').addEventListener('click', () => openSettings());
    $('settingsClose').addEventListener('click', closeSettings);
    $('settingsSheet').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSettings(); });

    document.addEventListener('keydown', (e) => {
        const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            searchBar.focus();
            searchBar.select();
            return;
        }
        if (e.key === 'Escape') {
            if ($('riskGate').classList.contains('open')) { closeRisk(); return; }
            if ($('settingsSheet').classList.contains('open')) { closeSettings(); return; }
            if (viewer.classList.contains('open')) { closeGame(); return; }
            $('sortMenu').classList.remove('open');
            return;
        }
        if (viewer.classList.contains('open') || $('settingsSheet').classList.contains('open')) return;
        if (!typing && e.key === '/') { e.preventDefault(); searchBar.focus(); return; }
        if (!typing && e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) { randomGame(); return; }
        if (!typing && config.panicKey && e.key.toLowerCase() === String(config.panicKey).toLowerCase()) {
            location.href = config.panicUrl || 'about:blank';
        }
    });

    window.addEventListener('popstate', () => {
        const params = new URLSearchParams(location.search);
        const id = params.get('id');
        const local = params.get('local');
        if (!id && !local) {
            if (currentGame) closeGame();
            return;
        }
        const game = local
            ? games.find((g) => g.source === 'local' && g.id === local)
            : games.find((g) => String(g.id) === String(id));
        if (game && (!currentGame || currentGame.key !== game.key)) openGame(game);
    });

    window.addEventListener('resize', debounce(layoutColumns, 120));

    /* ---------------- boot ---------------- */
    function startSyncObserver() {
        const sentinel = $('sentinel');
        if (!('IntersectionObserver' in window)) return;
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting && rendered < filtered.length) appendPage();
            });
        }, { rootMargin: '600px 0px' });
        io.observe(sentinel);
    }

    async function applyDeepLink(early) {
        const params = new URLSearchParams(location.search);
        const id = params.get('id');
        const local = params.get('local');
        if (!id && !local) return false;
        let game = null;
        if (local) game = games.find((g) => g.source === 'local' && g.id === local);
        if (!game && id) game = games.find((g) => String(g.id) === String(id));
        if (!game) return false;
        let preloaded = null;
        if (early) {
            try { preloaded = await early; } catch (e) { preloaded = null; }
            if (preloaded) memSet(game.key, preloaded);
        }
        if (location.hash.indexOf('embed') !== -1 && preloaded) {
            document.open();
            document.write(preloaded);
            document.close();
            return true;
        }
        openGame(game, preloaded);
        return true;
    }

    function boot() {
        applyConfig();
        renderCategories();
        renderSortMenu();
        attachHoverPrefetch();
        startSyncObserver();

        // kick off the ?id= fetch immediately — the biggest win for shared links
        const params = new URLSearchParams(location.search);
        const deepId = params.get('id');
        const early = (deepId && /^\d+$/.test(deepId))
            ? fetch(HTML_URL + '/' + deepId + '.html', { cache: 'default' }).then((r) => (r.ok ? r.text() : null)).catch(() => null)
            : null;

        const cached = readZonesCache();
        if (cached) {
            games = cached.map(normalizeCdn);
            renderAll();
        }

        (async () => {
            const [zones, localGames] = await Promise.all([fetchZones(), fetchLocalGames()]);
            if (zones) store(ZONES_CACHE_KEY, { at: Date.now(), data: zones });
            const cdnGames = (zones || cached || []).map(normalizeCdn);
            games = cdnGames.concat(localGames);
            renderAll();
            await applyDeepLink(early);
            fetchPopularity();
        })();

        // refresh the featured card + stats once data lands
        function renderAll() {
            render();
            renderSpotlight();
            renderRecent();
            updateStats();
        }

        // re-render recent when it becomes available
        if (config.autoBlank && !sessionStorage.getItem('wm.blanked')) {
            sessionStorage.setItem('wm.blanked', '1');
            setTimeout(cloakToBlank, 400);
        }
        if (config.cloakPreset && config.cloakPreset !== 'none' && config.cloakTitle) {
            document.title = config.cloakTitle;
            setFavicon(config.cloakIcon || 'favicon.png');
        }
    }

    /* ---------------- school filter shim (kept from the original) ---------------- */
    const BLOCKED = ['deledao', 'goguardian', 'lightspeed', 'linewize', 'securly', '.edu/'];
    function isBlocked(url) {
        try {
            const host = new URL(url, location.origin).hostname + '/';
            return BLOCKED.some((s) => host.includes(s));
        } catch (e) { return false; }
    }
    const nativeFetch = window.fetch;
    window.fetch = function (input) {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url && isBlocked(url)) return Promise.reject(new Error('blocked'));
        return nativeFetch.apply(this, arguments);
    };
    const nativeOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        if (url && isBlocked(url)) return;
        return nativeOpen.apply(this, arguments);
    };

    boot();
})();
