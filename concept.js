/* ============================================================
   watermusic · concept layer
   everything the concept adds on top of app.js:
     1. staggered card entrance
     2. rotating featured showcase
     3. ⌘K command palette
   app.js is untouched apart from a read/open/toggle hook (window.wm).
   ============================================================ */
(function () {
    'use strict';

    var wm = window.wm;
    var $ = function (id) { return document.getElementById(id); };
    var raf = window.requestAnimationFrame || function (fn) { return setTimeout(function () { fn(Date.now()); }, 16); };
    var caf = window.cancelAnimationFrame || clearTimeout;
    var reduce = function () {
        return document.documentElement.dataset.motion === 'reduced' ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    };
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function escReg(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    /* ------------------------------------------------------------
       1 · cards: staggered entrance
       ------------------------------------------------------------ */
    function decorate(card, index) {
        card.style.setProperty('--i', String(index));
        card.classList.add('reveal');
        card.addEventListener('animationend', function () { card.classList.remove('reveal'); }, { once: true });
    }

    (function observeCards() {
        var grid = $('grid');
        var row = $('recentRow');
        var targets = [grid, row].filter(Boolean);
        if (!targets.length) return;
        var mo = new MutationObserver(function (records) {
            var i = 0;
            records.forEach(function (rec) {
                Array.prototype.forEach.call(rec.addedNodes, function (node) {
                    if (node.nodeType !== 1) return;
                    if (node.classList && node.classList.contains('card')) {
                        decorate(node, i++);
                        return;
                    }
                    if (node.querySelectorAll) {
                        node.querySelectorAll('.card').forEach(function (card) { decorate(card, i++); });
                    }
                });
            });
        });
        targets.forEach(function (t) { mo.observe(t, { childList: true }); });
        targets.forEach(function (t) {
            t.querySelectorAll('.card').forEach(function (card, i) { decorate(card, i); });
        });
    })();

    /* ------------------------------------------------------------
       2 · rotating featured showcase
       ------------------------------------------------------------ */
    (function featured() {
        var spotlight = $('spotlight');
        var layerA = $('spBg');
        var layerB = $('spBgAlt');
        if (!spotlight || !layerA || !layerB) return;

        var corner = spotlight.querySelector('.sp-corner');
        var title = $('spTitle');
        var sub = $('spSub');
        var dots = $('spDots');
        var timer = $('spTimer');
        var picks = [];
        var index = 0;
        var front = layerA;
        var paused = false;
        var interval = null;
        var knownCount = 0;

        layerB.classList.add('off');

        function modalOpen() {
            return document.body.classList.contains('palette-open') ||
                !!document.querySelector('#viewer.open, #settingsSheet.open, #riskGate.open');
        }

        function build() {
            var all = (wm ? wm.games() : []).filter(function (g) { return g.cover && g.name; });
            if (!all.length) return false;
            var want = Math.min(6, all.length);
            var stride = Math.max(1, Math.floor(all.length / want));
            var out = [];
            for (var i = 0; i < all.length && out.length < want; i += stride) out.push(all[i]);
            // a little variety: mix in one of the newest entries
            if (all.length > want + 2) {
                var tail = all[Math.floor(all.length * 0.72)];
                if (tail && out.indexOf(tail) === -1) out[out.length - 1] = tail;
            }
            picks = out;
            // warm every cover once so the crossfade never stalls on a download
            picks.forEach(function (g) {
                var img = new Image();
                img.decoding = 'async';
                img.src = g.cover;
            });
            return true;
        }

        function buildDots() {
            if (!dots) return;
            dots.innerHTML = picks.map(function (g, i) {
                return '<button type="button" data-slide="' + i + '" class="' + (i === index ? 'on' : '') +
                    '" aria-label="Featured: ' + esc(g.name) + '"></button>';
            }).join('');
        }

        function restartTimer() {
            if (!timer) return;
            timer.classList.remove('run');
            void timer.offsetWidth;
            timer.classList.add('run');
        }

        function show(i, silent) {
            if (!picks.length) return;
            index = ((i % picks.length) + picks.length) % picks.length;
            var game = picks[index];

            if (title) title.textContent = game.name;
            if (sub) sub.textContent = game.author ? 'by ' + game.author : 'Plays right here, no download';
            if (corner) corner.textContent = (index + 1) + ' / ' + picks.length;
            spotlight.dataset.key = game.key;

            var back = front === layerA ? layerB : layerA;
            back.style.backgroundImage = 'url("' + game.cover + '")';
            // put the fresh layer on top, then fade the old one out
            back.classList.remove('off');
            void back.offsetWidth;
            front.classList.add('off');
            front = back;

            if (dots) {
                Array.prototype.forEach.call(dots.children, function (b, n) {
                    b.classList.toggle('on', n === index);
                });
            }
            if (!silent) restartTimer();
        }

        function tick() {
            if (paused || document.hidden || modalOpen() || reduce()) return;
            // the catalog can land after the carousel starts (or be refreshed)
            var total = wm ? wm.games().length : 0;
            if (total && total !== knownCount) { knownCount = total; build(); buildDots(); show(0, true); return; }
            show(index + 1);
        }

        function begin() {
            if (!build()) return false;
            knownCount = wm ? wm.games().length : picks.length;
            buildDots();
            show(0, true);
            if (!interval) interval = setInterval(tick, 6500);
            return true;
        }

        if (!begin()) {
            var tries = 0;
            var wait = setInterval(function () {
                tries += 1;
                if (begin() || tries > 60) clearInterval(wait);
            }, 250);
        }

        spotlight.addEventListener('pointerenter', function () { paused = true; if (timer) timer.classList.remove('run'); });
        spotlight.addEventListener('pointerleave', function () { paused = false; restartTimer(); });
        spotlight.addEventListener('focusin', function () { paused = true; });
        spotlight.addEventListener('focusout', function () { paused = false; });

        if (dots) {
            dots.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-slide]');
                if (!btn) return;
                e.stopPropagation();
                e.preventDefault();
                show(Number(btn.getAttribute('data-slide')));
            });
        }
    })();

    /* ------------------------------------------------------------
       3 · ⌘K command palette
       ------------------------------------------------------------ */
    (function palette() {
        var root = $('palette');
        var input = $('paletteInput');
        var list = $('paletteList');
        var count = $('paletteCount');
        if (!root || !input || !list) return;

        var open = false;
        var results = [];
        var selected = 0;

        function isOpen() { return open; }

        function score(name, q) {
            if (!q) return 1;
            var n = name.toLowerCase();
            if (n === q) return 1200;
            if (n.indexOf(q) === 0) return 1000 - n.length;
            var at = n.indexOf(q);
            if (at > 0) return (n.charAt(at - 1) === ' ' ? 820 : 620) - at;
            // loose subsequence match (typing "crsh" finds "Crash")
            var ni = 0, hits = 0;
            for (var i = 0; i < q.length; i++) {
                var k = n.indexOf(q.charAt(i), ni);
                if (k === -1) return 0;
                ni = k + 1;
                hits += 1;
            }
            return 120 + hits * 6 - n.length * .15;
        }

        function metaLine(g) {
            var bits = [];
            if (g.category && g.category !== 'other') bits.push(g.category.charAt(0).toUpperCase() + g.category.slice(1));
            if (g.author) bits.push(g.author);
            if (g.source === 'local') bits.push('on this site');
            return bits.length ? bits.join(' · ') : 'game';
        }

        function search(q) {
            var games = (wm ? wm.games() : []).filter(function (g) { return g && g.name; });
            if (!q) {
                // no query: starred first, then the catalog in its own order
                return games.slice().sort(function (a, b) {
                    return (wm && wm.isFav(a.key) ? 0 : 1) - (wm && wm.isFav(b.key) ? 0 : 1);
                }).slice(0, 60);
            }
            var scored = [];
            for (var i = 0; i < games.length; i++) {
                var s = q ? score(games[i].name, q) : 1;
                if (s > 0) scored.push({ g: games[i], s: s, i: i });
            }
            scored.sort(function (a, b) { return b.s - a.s || a.i - b.i; });
            return scored.slice(0, 60).map(function (r) { return r.g; });
        }

        function highlight(name, q) {
            var safe = esc(name);
            if (!q) return safe;
            try {
                return safe.replace(new RegExp('(' + escReg(esc(q)) + ')', 'ig'), '<mark>$1</mark>');
            } catch (e) { return safe; }
        }

        function render() {
            var q = input.value.trim().toLowerCase();
            results = search(q);
            var games = wm ? wm.games() : [];

            if (!games.length) {
                list.innerHTML = '<div class="palette-empty"><b>fetching the library</b>Give it a second — the catalog is loading.</div>';
                if (count) count.textContent = '';
                return;
            }
            if (!results.length) {
                list.innerHTML = '<div class="palette-empty"><b>no matches</b>Nothing called “' + esc(q) + '”. Try a shorter word.</div>';
                if (count) count.textContent = '';
                return;
            }

            if (selected >= results.length) selected = 0;
            if (selected < 0) selected = results.length - 1;

            list.innerHTML = results.map(function (g, i) {
                var fav = wm && wm.isFav(g.key);
                return '<div class="p-row' + (i === selected ? ' on' : '') + '" id="p-opt-' + i + '" data-key="' + esc(g.key) + '" role="option" aria-selected="' + (i === selected) + '">' +
                    '<img class="p-cover" src="' + esc(g.cover) + '" alt="" loading="lazy" decoding="async">' +
                    '<div class="p-body">' +
                        '<div class="p-name">' + highlight(g.name, q) + '</div>' +
                        '<div class="p-meta">' + esc(metaLine(g)) + '</div>' +
                    '</div>' +
                    '<button class="p-star' + (fav ? ' on' : '') + '" type="button" data-star="' + esc(g.key) + '" aria-label="Star ' + esc(g.name) + '">' +
                        '<svg viewBox="0 0 24 24" fill="' + (fav ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/></svg>' +
                    '</button>' +
                    '<span class="p-enter">↵</span>' +
                '</div>';
            }).join('');

            if (count) count.textContent = results.length + (q ? ' result' + (results.length === 1 ? '' : 's') : ' games');
            input.setAttribute('aria-activedescendant', 'p-opt-' + selected);
            var on = list.querySelector('.p-row.on');
            if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
        }

        var lastFocus = null;

        function openPalette(seed) {
            if (open) { input.focus(); input.select(); return; }
            if (document.querySelector('#viewer.open, #settingsSheet.open, #riskGate.open')) return;
            lastFocus = document.activeElement;
            open = true;
            root.classList.add('open');
            root.setAttribute('aria-hidden', 'false');
            input.setAttribute('aria-expanded', 'true');
            document.body.classList.add('palette-open');
            input.value = seed || '';
            selected = 0;
            render();
            setTimeout(function () { input.focus(); input.select(); }, 20);
        }

        function closePalette() {
            if (!open) return;
            open = false;
            root.classList.remove('open');
            root.setAttribute('aria-hidden', 'true');
            input.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('palette-open');
            input.blur();
            if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { } }
        }

        function syncSelection(scroll) {
            var rows = list.querySelectorAll('.p-row');
            Array.prototype.forEach.call(rows, function (row, i) {
                row.classList.toggle('on', i === selected);
                row.setAttribute('aria-selected', String(i === selected));
            });
            if (rows[selected]) input.setAttribute('aria-activedescendant', 'p-opt-' + selected);
            if (scroll) {
                var on = rows[selected];
                if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
            }
        }

        function move(delta) {
            if (!results.length) return;
            selected = (selected + delta + results.length) % results.length;
            syncSelection(true);
        }

        function play(i) {
            var game = results[typeof i === 'number' ? i : selected];
            if (!game) return;
            closePalette();
            if (wm) wm.open(game.key);
        }

        function toggleStar(el) {
            var key = el.getAttribute('data-star');
            if (!key || !wm) return;
            wm.toggleFav(key);
            var fav = wm.isFav(key);
            el.classList.toggle('on', fav);
            var svg = el.querySelector('svg');
            if (svg) svg.setAttribute('fill', fav ? 'currentColor' : 'none');
        }

        input.addEventListener('input', function () { selected = 0; render(); });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
            else if (e.key === 'Enter') { e.preventDefault(); play(); }
            else if (e.key === 'Home') { e.preventDefault(); selected = 0; syncSelection(true); }
            else if (e.key === 'End') { e.preventDefault(); selected = results.length - 1; syncSelection(true); }
            else if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) {
                // "s" stars the highlighted game without leaving the palette
                var row = list.querySelector('.p-row.on .p-star');
                if (row) { e.preventDefault(); toggleStar(row); }
            }
        });

        list.addEventListener('click', function (e) {
            var star = e.target.closest('[data-star]');
            if (star) { e.preventDefault(); e.stopPropagation(); toggleStar(star); return; }
            var row = e.target.closest('.p-row');
            if (!row) return;
            var key = row.getAttribute('data-key');
            var i = results.findIndex(function (g) { return g.key === key; });
            if (i > -1) play(i);
        });

        list.addEventListener('pointermove', function (e) {
            var row = e.target.closest('.p-row');
            if (!row) return;
            var key = row.getAttribute('data-key');
            var i = results.findIndex(function (g) { return g.key === key; });
            if (i > -1 && i !== selected) { selected = i; syncSelection(false); }
        }, { passive: true });

        root.addEventListener('click', function (e) { if (e.target === root) closePalette(); });
        [$('paletteBtn'), $('paletteBtn2')].forEach(function (btn) {
            if (btn) btn.addEventListener('click', function () { openPalette(''); });
        });

        window.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
                e.preventDefault();
                e.stopPropagation();
                if (open) closePalette(); else openPalette('');
                return;
            }
            if (e.key === 'Escape' && open) {
                e.preventDefault();
                e.stopPropagation();
                closePalette();
            }
        }, true);
    })();

    /* ------------------------------------------------------------
       6 · tiny polish: keep the hero count honest, close palette on nav
       ------------------------------------------------------------ */
    (function polish() {
        document.querySelectorAll('[data-nav]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.body.classList.remove('palette-open');
            });
        });
    })();
})();
