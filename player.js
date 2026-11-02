/* page bootstrap — combo + access code */
(function () {
    'use strict';
    var B = { s: "7fr2nflFmhT1mIO83Urafw==", i: 310000, v: "hhH/MzM780TB1oOe", c: "w8goCvqSFoizdIdwChNHMSxQDSmLBHdCjvhYFd9FSl5VjGa7dbooURsyiwIlL74sYN6do6kLMBr7YgF0iwT4wqVn5VkaLehZSYeXjQXA7GkuViMx6heemjh720UgFNYw5R7ZL6BpqeGSmPqId0+1jALSA6rRyOl4ApduvhQF6BnHksw6WesvUZNOvbKQQ6HD8DVsgQFL8A==" };
    var K = 'wm.t', F = 'wm.u', V = 'wm.v', E = 21600000;
    var SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'];
    var COOLDOWNS = [0, 0, 30000, 120000, 600000];

    // nothing is added to the page until the combination is entered, so there is
    // no markup sitting in the DOM for anyone to poke at
    var gate = null, input = null, go = null, err = null, panel = null;
    var busy = false, tick = null;

    function b64d(s) {
        var raw = atob(s), out = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
        return out;
    }
    function b64e(buf) {
        var view = new Uint8Array(buf), out = '';
        for (var i = 0; i < view.length; i++) out += String.fromCharCode(view[i]);
        return btoa(out);
    }
    function readFails() {
        try { return JSON.parse(localStorage.getItem(F) || 'null') || { n: 0, t: 0 }; } catch (e) { return { n: 0, t: 0 }; }
    }
    function writeFails(v) { try { localStorage.setItem(F, JSON.stringify(v)); } catch (e) { } }
    function waitLeft() {
        var f = readFails();
        return Math.max(0, (f.t || 0) - Date.now());
    }
    function say(text) { if (err) err.textContent = text || ''; }

    function mount() {
        if (gate) return true;
        var style = document.createElement('style');
        style.textContent = [
            '.gk{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;',
            'padding:20px;background:rgba(3,3,5,.78);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}',
            '.gk-panel{width:100%;max-width:352px;padding:22px;border-radius:14px;background:#0c0c10;',
            'border:1px solid rgba(255,255,255,.12);box-shadow:0 30px 70px -30px #000;',
            "font:400 14px/1.5 'Outfit',system-ui,-apple-system,'Segoe UI',sans-serif;color:#f2f3f5}",
            '.gk-panel.shake{animation:gk-shake .28s}',
            '@keyframes gk-shake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}',
            '.gk-title{font-size:15px;font-weight:600;letter-spacing:-.01em}',
            '.gk-sub{margin-top:4px;font-size:12.5px;color:#8d8d99}',
            '.gk-in{width:100%;margin-top:16px;height:42px;padding:0 12px;border-radius:9px;background:#141419;',
            'border:1px solid rgba(255,255,255,.14);color:#f2f3f5;font:400 15px/1 inherit;outline:none;letter-spacing:.08em}',
            '.gk-in:focus{border-color:rgba(215,255,62,.55)}',
            '.gk-row{display:flex;gap:8px;margin-top:12px}',
            '.gk-btn{flex:1;height:40px;border-radius:9px;border:1px solid rgba(255,255,255,.14);',
            'background:transparent;color:#f2f3f5;font:500 13px/1 inherit;cursor:pointer}',
            '.gk-btn:hover{background:rgba(255,255,255,.07)}',
            '.gk-btn.go{background:#d7ff3e;border-color:#d7ff3e;color:#0a0c02;font-weight:600}',
            '.gk-btn.go:disabled{opacity:.5;cursor:default}',
            '.gk-err{margin-top:10px;min-height:16px;font-size:12px;color:#ff8080}'
        ].join('');
        document.head.appendChild(style);

        gate = document.createElement('div');
        gate.className = 'gk';
        gate.style.display = 'none';
        gate.setAttribute('role', 'dialog');
        gate.setAttribute('aria-modal', 'true');
        gate.setAttribute('aria-label', 'Restricted');
        gate.innerHTML =
            '<div class="gk-panel">' +
            '<div class="gk-title">Restricted</div>' +
            '<div class="gk-sub">Enter the access code to continue.</div>' +
            '<input class="gk-in" type="password" autocomplete="off" spellcheck="false" aria-label="Access code">' +
            '<div class="gk-row"><button class="gk-btn go" type="button">Continue</button>' +
            '<button class="gk-btn" type="button" data-close="1">Cancel</button></div>' +
            '<div class="gk-err"></div>' +
            '</div>';
        document.body.appendChild(gate);

        input = gate.querySelector('.gk-in');
        go = gate.querySelector('.gk-btn.go');
        err = gate.querySelector('.gk-err');
        panel = gate.querySelector('.gk-panel');

        go.addEventListener('click', submit);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
        gate.addEventListener('click', function (e) {
            if (e.target === gate || e.target.getAttribute('data-close')) closeGate();
        });
        return true;
    }

    function cooldownCheck() {
        var left = waitLeft();
        if (left > 0) {
            say('Too many tries. Try again in ' + Math.ceil(left / 1000) + 's.');
            go.disabled = true;
            clearInterval(tick);
            tick = setInterval(function () {
                var l = waitLeft();
                if (l <= 0) { clearInterval(tick); go.disabled = false; say(''); return; }
                say('Too many tries. Try again in ' + Math.ceil(l / 1000) + 's.');
            }, 500);
            return false;
        }
        return true;
    }
    function openGate() {
        if (!mount()) return;
        if (gate.style.display === 'flex') return;
        gate.style.display = 'flex';
        input.value = '';
        say('');
        go.disabled = false;
        busy = false;
        cooldownCheck();
        setTimeout(function () { try { input.focus(); } catch (e) { } }, 40);
    }
    function closeGate() {
        if (!gate) return;
        gate.style.display = 'none';
        clearInterval(tick);
        input.value = '';
        say('');
    }
    function fail() {
        var f = readFails();
        f.n = (f.n || 0) + 1;
        f.t = Date.now() + (COOLDOWNS[Math.min(f.n, COOLDOWNS.length - 1)] || 0);
        writeFails(f);
        panel.classList.remove('shake');
        void panel.offsetWidth;
        panel.classList.add('shake');
        say('Wrong code.');
        input.value = '';
        input.focus();
        go.disabled = false;
        cooldownCheck();
    }

    /* pick an address for this visit: never the same one twice in a row */
    function pickAddress(plain) {
        var list = [];
        try { list = JSON.parse(plain).p || []; } catch (e) { list = []; }
        if (!list.length) return '';
        var last = '';
        try { last = localStorage.getItem(V) || ''; } catch (e) { last = ''; }
        var pool = list.filter(function (p) { return p !== last; });
        if (!pool.length) pool = list;
        var next = pool[Math.floor(Math.random() * pool.length)];
        try { localStorage.setItem(V, next); } catch (e) { }
        return next;
    }

    function submit() {
        if (busy || !gate) return;
        var code = input.value;
        if (!code) { input.focus(); return; }
        if (!cooldownCheck()) return;
        var subtle = window.crypto && window.crypto.subtle;
        if (!subtle) { say('This browser cannot open the page.'); return; }
        busy = true;
        go.disabled = true;
        say('Checking…');
        subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey'])
            .then(function (base) {
                return subtle.deriveKey(
                    { name: 'PBKDF2', salt: b64d(B.s), iterations: B.i, hash: 'SHA-256' },
                    base,
                    { name: 'AES-GCM', length: 256 },
                    true,
                    ['decrypt']
                );
            })
            .then(function (key) {
                return subtle.decrypt({ name: 'AES-GCM', iv: b64d(B.v) }, key, b64d(B.c)).then(function (plain) {
                    return subtle.exportKey('raw', key).then(function (raw) {
                        return { plain: plain, raw: raw };
                    });
                });
            })
            .then(function (out) {
                var plain = new TextDecoder().decode(out.plain);
                var target = pickAddress(plain);
                if (!target) { busy = false; go.disabled = false; say('Something went wrong.'); return; }
                writeFails({ n: 0, t: 0 });
                location.href = target;
            })
            .catch(function () {
                busy = false;
                fail();
            });
    }

    document.addEventListener('keydown', function (e) {
        if (!gate || gate.style.display !== 'flex') return;
        // only swallow Escape — other keys still need to reach the field
        if (e.key === 'Escape') { e.preventDefault(); closeGate(); }
    }, true);

    /* the combination: eight arrows in order, no modifiers, not while typing */
    var at = 0;
    document.addEventListener('keydown', function (e) {
        if (gate && gate.style.display === 'flex') return;
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) { at = 0; return; }
        if (e.ctrlKey || e.metaKey || e.altKey) { at = 0; return; }
        if (e.key === SEQ[at]) {
            at += 1;
            if (at === SEQ.length) { at = 0; openGate(); }
            return;
        }
        at = e.key === SEQ[0] ? 1 : 0;
    }, true);
})();
