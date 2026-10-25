/* ============================================================
   soundboard
   - 1,800 sounds, but only a page of them is ever in the DOM
   - one <audio> element when overlap is off, a small pool when it is on
   - every tile is a real <button>, so tab + enter/spece work
   ============================================================ */
(function () {
    'use strict';

    var PAGE_SIZE = 120;
    var FAV_KEY = 'favorites';          // same key the old board used
    var RECENT_KEY = 'sb.recent.v1';
    var RECENT_MAX = 24;

    var soundBoard = document.getElementById('soundboard');
    var searchInput = document.getElementById('searchInput');
    var modeChips = document.getElementById('modeChips');
    var toggleButton = document.getElementById('toggleButton');
    var stopButton = document.getElementById('stopButton');
    var emptyNode = document.getElementById('sbEmpty');
    var countNode = document.getElementById('sbCount');
    var sentinel = document.getElementById('sbSentinel');

    /* ------------------------------------------------------------
       data
       ------------------------------------------------------------ */
    function trim(p) { return String(p || '').replace(/^\/+/, ''); }

    var items = [];
    var byFile = Object.create(null);
    var seenFiles = Object.create(null);

    // sounds.js declares `sounds` with const, so it is a global binding, not a
    // window property — reach it by name
    var rawSounds = (typeof sounds !== 'undefined' && Array.isArray(sounds)) ? sounds : [];

    rawSounds.forEach(function (s) {
        var file = trim(s.mp3);
        if (!file || seenFiles[file]) return;   // the manifest has ~130 duplicate files
        seenFiles[file] = true;
        var item = {
            file: file,
            name: String(s.name || file).trim(),
            color: s.color || '',
            lower: String(s.name || '').toLowerCase(),
            missing: false
        };
        byFile[file] = item;
        items.push(item);
    });

    function readJSON(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            var value = raw ? JSON.parse(raw) : null;
            return value || fallback;
        } catch (e) { return fallback; }
    }
    function writeJSON(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
    }

    var favs = new Set();
    function refreshFavs() {
        favs = new Set();
        readJSON(FAV_KEY, []).forEach(function (f) {
            var file = trim(f && f.mp3);
            if (file) favs.add(file);
        });
    }
    refreshFavs();

    var recent = readJSON(RECENT_KEY, []).map(trim).filter(Boolean);

    /* ------------------------------------------------------------
       state + rendering
       ------------------------------------------------------------ */
    var state = { q: '', mode: 'all' };
    var filteredList = [];
    var rendered = 0;

    function matchesQuery(item, tokens) {
        for (var i = 0; i < tokens.length; i++) {
            if (item.lower.indexOf(tokens[i]) === -1) return false;
        }
        return true;
    }

    function computeList() {
        var tokens = state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
        var base;
        if (state.mode === 'fav') {
            base = items.filter(function (i) { return favs.has(i.file); });
        } else if (state.mode === 'recent') {
            base = recent.map(function (f) { return byFile[f]; }).filter(Boolean);
        } else {
            base = items;
        }
        return tokens.length ? base.filter(function (i) { return matchesQuery(i, tokens); }) : base;
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function tileHTML(item) {
        var cls = 'sb-tile';
        if (favs.has(item.file)) cls += ' fav';
        if (item.missing) cls += ' missing';
        return '<button type="button" class="' + cls + '" data-file="' + esc(item.file) + '"' +
            ' title="' + esc(item.name) + '"' +
            (item.color ? ' style="--c:' + esc(item.color) + '"' : '') +
            (item.missing ? ' aria-disabled="true"' : '') +
            '><span class="sb-tile-name">' + esc(item.name) + '</span>' +
            '<span class="sb-tile-play" aria-hidden="true">play</span></button>';
    }

    function updateCount() {
        if (!countNode) return;
        var total = filteredList.length;
        if (rendered < total) {
            countNode.textContent = rendered + ' of ' + total + ' sounds';
        } else if (state.mode === 'all' && !state.q.trim()) {
            countNode.textContent = total + ' sounds';
        } else {
            countNode.textContent = total + (total === 1 ? ' sound' : ' sounds');
        }
    }

    function appendPage() {
        if (rendered >= filteredList.length) { updateCount(); return; }
        var next = filteredList.slice(rendered, rendered + PAGE_SIZE);
        soundBoard.insertAdjacentHTML('beforeend', next.map(tileHTML).join(''));
        rendered += next.length;
        updateCount();
    }

    function render() {
        filteredList = computeList();
        rendered = 0;
        soundBoard.innerHTML = '';
        var isEmpty = !filteredList.length;
        if (emptyNode) {
            emptyNode.hidden = !isEmpty;
            if (isEmpty) {
                emptyNode.querySelector('b').textContent =
                    state.mode === 'fav' ? 'No favorites yet'
                        : state.mode === 'recent' ? 'Nothing played yet'
                            : 'Nothing matches that';
                emptyNode.querySelector('span').textContent =
                    state.mode === 'fav' ? 'Right-click a sound and pick Favorite to keep it here.'
                        : state.mode === 'recent' ? 'Sounds you play show up here, newest first.'
                            : 'Try a shorter search, or switch back to All.';
            }
        }
        appendPage();
    }

    /* ------------------------------------------------------------
       audio
       ------------------------------------------------------------ */
    var allowOverlap = false;
    var single = new Audio();
    single.preload = 'auto';
    var activeAudios = [];
    var playingTile = null;
    var MAX_OVERLAP = 12;

    function clearPlaying() {
        if (playingTile) playingTile.classList.remove('playing');
        playingTile = null;
    }

    function clearAllPlaying() {
        document.querySelectorAll('.sb-tile.playing').forEach(function (t) { t.classList.remove('playing'); });
        playingTile = null;
    }

    function stopAll() {
        try { single.pause(); single.currentTime = 0; } catch (e) { }
        activeAudios.forEach(function (a) {
            try { a.pause(); a.currentTime = 0; } catch (e) { }
        });
        activeAudios = [];
        clearAllPlaying();
    }

    function markMissing(item, tile) {
        item.missing = true;
        if (tile) {
            tile.classList.add('missing');
            tile.setAttribute('aria-disabled', 'true');
            tile.title = item.name + ' (file missing)';
        }
        toast('That sound file is missing on the server');
    }

    function play(item, tile) {
        if (!item || item.missing) return;

        if (!allowOverlap) {
            stopAll();
            single.src = item.file;
            single.currentTime = 0;
            single.onerror = function () { clearPlaying(); markMissing(item, tile); };
            single.onended = function () { clearPlaying(); };
            var p = single.play();
            if (p && p.catch) p.catch(function (err) { if (err && err.name === 'NotSupportedError') markMissing(item, tile); });
        } else {
            var a = new Audio(item.file);
            a.onerror = function () { if (tile) tile.classList.remove('playing'); markMissing(item, tile); };
            a.onended = function () {
                var idx = activeAudios.indexOf(a);
                if (idx >= 0) activeAudios.splice(idx, 1);
                if (tile) tile.classList.remove('playing');
            };
            if (activeAudios.length >= MAX_OVERLAP) {
                var oldest = activeAudios.shift();
                try { oldest.pause(); } catch (e) { }
            }
            activeAudios.push(a);
            var ap = a.play();
            if (ap && ap.catch) ap.catch(function () { });
        }

        // the highlight stays for as long as the sound plays; ended/error clears it.
        // with overlap on, several tiles can be lit at once, so leave the others be.
        if (!allowOverlap && playingTile && playingTile !== tile) playingTile.classList.remove('playing');
        if (!allowOverlap) playingTile = tile || null;
        if (tile) tile.classList.add('playing');

        pushRecent(item.file);
    }

    function pushRecent(file) {
        recent = [file].concat(recent.filter(function (f) { return f !== file; })).slice(0, RECENT_MAX);
        writeJSON(RECENT_KEY, recent);
    }

    /* ------------------------------------------------------------
       toast
       ------------------------------------------------------------ */
    var toastNode = null;
    var toastTimer = null;
    function toast(msg) {
        if (!toastNode) {
            toastNode = document.createElement('div');
            toastNode.className = 'sb-toast';
            document.body.appendChild(toastNode);
        }
        toastNode.textContent = msg;
        toastNode.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastNode.classList.remove('show'); }, 2000);
    }

    /* ------------------------------------------------------------
       favorites + menu
       ------------------------------------------------------------ */
    function toggleFavorite(item, tile) {
        var list = readJSON(FAV_KEY, []);
        var index = -1;
        for (var i = 0; i < list.length; i++) {
            if (trim(list[i] && list[i].mp3) === item.file) { index = i; break; }
        }
        var on = index === -1;
        if (on) list.push({ name: item.name, color: item.color, mp3: '/' + item.file });
        else list.splice(index, 1);
        writeJSON(FAV_KEY, list);
        refreshFavs();

        if (tile) tile.classList.toggle('fav', on);
        toast(on ? 'Added to favorites' : 'Removed from favorites');
        if (state.mode === 'fav') render();
    }

    function download(item) {
        var link = document.createElement('a');
        link.href = item.file;
        link.download = item.file.split('/').pop();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast('Downloading ' + link.download);
    }

    function closeMenu() {
        document.querySelectorAll('.right-click-panel').forEach(function (p) { p.remove(); });
    }

    function openMenu(x, y, item, tile) {
        closeMenu();
        var panel = document.createElement('div');
        panel.className = 'right-click-panel';

        var fav = document.createElement('button');
        fav.type = 'button';
        fav.className = 'right-click-panel-button';
        fav.textContent = favs.has(item.file) ? 'Remove from favorites' : 'Add to favorites';
        fav.onclick = function () { toggleFavorite(item, tile); panel.remove(); };

        var dl = document.createElement('button');
        dl.type = 'button';
        dl.className = 'right-click-panel-button';
        dl.textContent = 'Download sound';
        dl.onclick = function () { download(item); panel.remove(); };

        var copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'right-click-panel-button';
        copy.textContent = 'Copy name';
        copy.onclick = function () {
            var done = function () { toast('Name copied'); };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(item.name).then(done, function () { toast('Copy blocked by the browser'); });
            } else { toast('Copy blocked by the browser'); }
            panel.remove();
        };

        panel.appendChild(fav);
        panel.appendChild(dl);
        panel.appendChild(copy);
        document.body.appendChild(panel);

        // keep the panel inside the window
        var rect = panel.getBoundingClientRect();
        var left = Math.min(x + window.scrollX, window.scrollX + document.documentElement.clientWidth - rect.width - 8);
        var top = Math.min(y + window.scrollY, window.scrollY + document.documentElement.clientHeight - rect.height - 8);
        panel.style.left = Math.max(8, left) + 'px';
        panel.style.top = Math.max(8, top) + 'px';

        setTimeout(function () {
            var onDown = function (e) {
                if (!panel.contains(e.target)) {
                    panel.remove();
                    document.removeEventListener('pointerdown', onDown);
                }
            };
            document.addEventListener('pointerdown', onDown);
        }, 0);
    }

    /* ------------------------------------------------------------
       events
       ------------------------------------------------------------ */
    var pressTimer = null;
    var longPressed = false;

    soundBoard.addEventListener('click', function (e) {
        var tile = e.target.closest('.sb-tile');
        if (!tile) return;
        if (longPressed) { longPressed = false; return; }
        var item = byFile[tile.dataset.file];
        if (item) play(item, tile);
    });

    soundBoard.addEventListener('contextmenu', function (e) {
        var tile = e.target.closest('.sb-tile');
        if (!tile) return;
        e.preventDefault();
        var item = byFile[tile.dataset.file];
        if (item) openMenu(e.clientX, e.clientY, item, tile);
    });

    soundBoard.addEventListener('pointerdown', function (e) {
        var tile = e.target.closest('.sb-tile');
        if (!tile || e.pointerType === 'mouse') return;
        clearTimeout(pressTimer);
        longPressed = false;
        pressTimer = setTimeout(function () {
            var item = byFile[tile.dataset.file];
            if (!item) return;
            longPressed = true;
            openMenu(e.clientX, e.clientY, item, tile);
            if (navigator.vibrate) navigator.vibrate(10);
        }, 480);
    });
    ['pointerup', 'pointercancel', 'pointermove', 'scroll'].forEach(function (type) {
        window.addEventListener(type, function () { clearTimeout(pressTimer); }, { passive: true });
    });

    var searchTimer = null;
    searchInput.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
            state.q = searchInput.value;
            render();
            window.scrollTo({ top: 0, behavior: 'auto' });
        }, 80);
    });

    modeChips.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        state.mode = chip.dataset.mode;
        Array.prototype.forEach.call(modeChips.querySelectorAll('.chip'), function (c) {
            c.classList.toggle('active', c === chip);
        });
        render();
    });

    toggleButton.addEventListener('click', function () {
        allowOverlap = !allowOverlap;
        toggleButton.textContent = 'Overlap: ' + (allowOverlap ? 'on' : 'off');
        toggleButton.setAttribute('aria-pressed', String(allowOverlap));
        if (!allowOverlap) stopAll();
    });

    stopButton.addEventListener('click', function () {
        stopAll();
        toast('Stopped');
    });

    document.addEventListener('keydown', function (e) {
        var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
        if (e.key === '/' && !typing) {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        } else if (e.key === 'Escape') {
            closeMenu();
            if (document.activeElement === searchInput && searchInput.value) {
                searchInput.value = '';
                state.q = '';
                render();
            } else if (typing) {
                document.activeElement.blur();
            }
            if (!ttsPanel.classList.contains('hidden')) {
                ttsPanel.classList.add('hidden');
                ttsToggle.setAttribute('aria-expanded', 'false');
                ttsToggle.classList.remove('tts-toggle-active');
            }
        }
    });

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            if (entries.some(function (en) { return en.isIntersecting; })) appendPage();
        }, { rootMargin: '600px 0px' }).observe(sentinel);
    } else {
        window.addEventListener('scroll', function () {
            if (window.innerHeight + window.scrollY > document.body.offsetHeight - 800) appendPage();
        }, { passive: true });
    }

    render();
    searchInput.placeholder = 'Search ' + items.length.toLocaleString() + ' sounds…';

    /* ============================================================
       text to speech (unchanged behaviour, new skin)
       ============================================================ */
    var ttsToggle = document.getElementById('ttsToggle');
    var ttsPanel = document.getElementById('ttsPanel');
    var ttsClose = document.getElementById('ttsClose');
    var ttsText = document.getElementById('ttsText');
    var ttsVoice = document.getElementById('ttsVoice');
    var ttsLangFilter = document.getElementById('ttsLangFilter');
    var ttsVolume = document.getElementById('ttsVolume');
    var ttsRate = document.getElementById('ttsRate');
    var ttsPitch = document.getElementById('ttsPitch');
    var ttsVolumeVal = document.getElementById('ttsVolumeVal');
    var ttsRateVal = document.getElementById('ttsRateVal');
    var ttsPitchVal = document.getElementById('ttsPitchVal');
    var ttsSpeak = document.getElementById('ttsSpeak');
    var ttsPauseBtn = document.getElementById('ttsPause');
    var ttsResumeBtn = document.getElementById('ttsResume');
    var ttsStopBtn = document.getElementById('ttsStop');
    var ttsResetBtn = document.getElementById('ttsReset');
    var ttsStatus = document.getElementById('ttsStatus');
    var ttsSpeaking = document.getElementById('ttsSpeaking');
    var ttsCurrentWord = document.getElementById('ttsCurrentWord');

    var synth = window.speechSynthesis;
    var allVoices = [];
    var currentUtterance = null;

    function openTTS(open) {
        ttsPanel.classList.toggle('hidden', !open);
        ttsToggle.setAttribute('aria-expanded', String(open));
        ttsToggle.classList.toggle('tts-toggle-active', open);
        if (open) ttsText.focus();
    }

    ttsToggle.addEventListener('click', function () {
        openTTS(ttsPanel.classList.contains('hidden'));
    });
    ttsClose.addEventListener('click', function () { openTTS(false); });

    function loadVoices() {
        if (!synth) return;
        allVoices = synth.getVoices();
        if (!allVoices.length) return;

        var langs = [];
        allVoices.forEach(function (v) { if (langs.indexOf(v.lang) === -1) langs.push(v.lang); });
        langs.sort();
        ttsLangFilter.innerHTML = '<option value="">All languages</option>';
        langs.forEach(function (lang) {
            var opt = document.createElement('option');
            opt.value = lang;
            opt.textContent = lang;
            ttsLangFilter.appendChild(opt);
        });
        populateVoiceList('');
    }

    function populateVoiceList(langFilter) {
        var filtered = langFilter ? allVoices.filter(function (v) { return v.lang === langFilter; }) : allVoices;
        ttsVoice.innerHTML = '';
        filtered.forEach(function (voice, i) {
            var opt = document.createElement('option');
            opt.value = i;
            opt.dataset.voiceName = voice.name;
            opt.textContent = voice.name + ' (' + voice.lang + ')' + (voice.default ? ' ★' : '');
            ttsVoice.appendChild(opt);
        });
        var defIdx = filtered.findIndex(function (v) { return v.default; });
        if (defIdx >= 0) ttsVoice.selectedIndex = defIdx;
    }

    function getSelectedVoice() {
        var langFilter = ttsLangFilter.value;
        var filtered = langFilter ? allVoices.filter(function (v) { return v.lang === langFilter; }) : allVoices;
        return filtered[ttsVoice.selectedIndex] || null;
    }

    if (synth) {
        loadVoices();
        if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;
    }

    ttsLangFilter.addEventListener('change', function () { populateVoiceList(ttsLangFilter.value); });
    ttsVolume.addEventListener('input', function () { ttsVolumeVal.textContent = parseFloat(ttsVolume.value).toFixed(2); });
    ttsRate.addEventListener('input', function () { ttsRateVal.textContent = parseFloat(ttsRate.value).toFixed(1); });
    ttsPitch.addEventListener('input', function () { ttsPitchVal.textContent = parseFloat(ttsPitch.value).toFixed(2); });

    ttsSpeak.addEventListener('click', function () {
        var text = ttsText.value.trim();
        if (!text) { setStatus('Type something first', 'warn'); return; }
        if (!synth) { setStatus('This browser has no speech engine', 'error'); return; }
        synth.cancel();

        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.voice = getSelectedVoice();
        currentUtterance.volume = parseFloat(ttsVolume.value);
        currentUtterance.rate = parseFloat(ttsRate.value);
        currentUtterance.pitch = parseFloat(ttsPitch.value);

        currentUtterance.onstart = function () {
            setStatus('Speaking…', 'speaking');
            setBtns(true);
            ttsSpeaking.classList.remove('hidden');
        };
        currentUtterance.onboundary = function (e) {
            if (e.name === 'word') {
                var word = text.substr(e.charIndex, e.charLength);
                ttsCurrentWord.textContent = word;
                ttsCurrentWord.classList.remove('word-pop');
                void ttsCurrentWord.offsetWidth;
                ttsCurrentWord.classList.add('word-pop');
            }
        };
        currentUtterance.onpause = function () { setStatus('Paused', 'paused'); };
        currentUtterance.onresume = function () { setStatus('Speaking…', 'speaking'); };
        currentUtterance.onend = function () {
            setStatus('Done', 'done');
            setBtns(false);
            ttsSpeaking.classList.add('hidden');
            ttsCurrentWord.textContent = '';
        };
        currentUtterance.onerror = function (e) {
            setStatus('Error: ' + e.error, 'error');
            setBtns(false);
            ttsSpeaking.classList.add('hidden');
        };
        synth.speak(currentUtterance);
    });

    ttsPauseBtn.addEventListener('click', function () {
        if (synth && synth.speaking && !synth.paused) synth.pause();
        ttsPauseBtn.disabled = true;
        ttsResumeBtn.disabled = false;
    });
    ttsResumeBtn.addEventListener('click', function () {
        if (synth && synth.paused) synth.resume();
        ttsPauseBtn.disabled = false;
        ttsResumeBtn.disabled = true;
    });
    ttsStopBtn.addEventListener('click', function () {
        if (synth) synth.cancel();
        setBtns(false);
        ttsSpeaking.classList.add('hidden');
        ttsCurrentWord.textContent = '';
        setStatus('Stopped', 'idle');
    });
    ttsResetBtn.addEventListener('click', function () {
        ttsVolume.value = 1; ttsVolumeVal.textContent = '1.00';
        ttsRate.value = 1; ttsRateVal.textContent = '1.0';
        ttsPitch.value = 1; ttsPitchVal.textContent = '1.00';
        ttsLangFilter.value = '';
        populateVoiceList('');
        setStatus('Reset', 'idle');
    });

    function setBtns(active) {
        ttsSpeak.disabled = active;
        ttsPauseBtn.disabled = !active;
        ttsStopBtn.disabled = !active;
        ttsResumeBtn.disabled = true;
    }

    function setStatus(msg, state) {
        ttsStatus.textContent = msg;
        ttsStatus.className = 'tts-status tts-status--' + state;
    }
})();
