/* Neon Runner — tiny endless runner used as the /gamehosting sample game */
(function () {
    'use strict';

    var canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d');
    var scoreEl = document.getElementById('score');
    var bestEl = document.getElementById('best');
    var speedEl = document.getElementById('speed');
    var overlay = document.getElementById('overlay');
    var startBtn = document.getElementById('startBtn');
    var hint = document.getElementById('hint');

    var W = 0, H = 0, dpr = 1;
    var groundY = 0;
    var state = 'idle';           // idle | playing | dead
    var score = 0;
    var best = Number(localStorage.getItem('neonrunner.best') || 0);
    var speed = 320;              // px per second
    var spawnIn = 0;
    var obstacles = [];
    var particles = [];
    var last = 0;
    var jumps = 0;

    var player = { x: 0, y: 0, w: 34, h: 34, vy: 0, onGround: true };

    var GRAVITY = 2300;
    var JUMP = -780;
    var JUMP2 = -640;

    bestEl.textContent = best;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth;
        H = canvas.clientHeight;
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        groundY = H - Math.max(56, H * 0.16);
        player.x = Math.max(48, W * 0.16);
        player.w = Math.max(26, Math.min(38, W * 0.05));
        player.h = player.w;
        if (state !== 'playing') {
            player.y = groundY - player.h;
        }
    }

    window.addEventListener('resize', resize);

    function reset() {
        obstacles = [];
        particles = [];
        score = 0;
        speed = 320;
        spawnIn = 0.9;
        jumps = 0;
        player.vy = 0;
        player.onGround = true;
        player.y = groundY - player.h;
        scoreEl.textContent = '0';
        speedEl.textContent = '1.0x';
    }

    function start() {
        reset();
        state = 'playing';
        overlay.classList.add('hide');
        hint.classList.add('hide');
        last = performance.now();
        requestAnimationFrame(loop);
    }

    function jump() {
        if (state === 'idle' || state === 'dead') { start(); return; }
        if (player.onGround) {
            player.vy = JUMP;
            player.onGround = false;
            jumps = 1;
            burst(player.x + player.w / 2, player.y + player.h, '#35e0ff', 8);
            return;
        }
        if (jumps < 2) {
            player.vy = JUMP2;
            jumps = 2;
            burst(player.x + player.w / 2, player.y + player.h, '#c6ff4f', 8);
        }
    }

    function burst(x, y, color, count) {
        for (var i = 0; i < count; i++) {
            particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 220,
                vy: -Math.random() * 240,
                life: 0.5 + Math.random() * 0.4,
                age: 0,
                color: color,
                r: 1.5 + Math.random() * 2.5
            });
        }
    }

    function spawn() {
        var size = 20 + Math.random() * 22;
        obstacles.push({
            x: W + 40,
            w: size * 0.8,
            h: size * 1.5,
            passed: false
        });
    }

    function die() {
        state = 'dead';
        burst(player.x + player.w / 2, player.y + player.h / 2, '#ff4fa3', 26);
        if (score > best) {
            best = score;
            localStorage.setItem('neonrunner.best', String(best));
            bestEl.textContent = best;
        }
        overlay.classList.remove('hide');
        overlay.querySelector('h1').innerHTML = 'GAME<br>OVER';
        startBtn.textContent = 'Run again';
        hint.classList.remove('hide');
    }

    function hit(o) {
        return player.x + player.w > o.x && player.x < o.x + o.w &&
            player.y + player.h > groundY - o.h && player.y < groundY;
    }

    function update(dt) {
        player.vy += GRAVITY * dt;
        player.y += player.vy * dt;
        if (player.y >= groundY - player.h) {
            player.y = groundY - player.h;
            player.vy = 0;
            if (!player.onGround) {
                burst(player.x + player.w / 2, groundY, '#35e0ff', 5);
            }
            player.onGround = true;
            jumps = 0;
        }

        speed += 9 * dt;
        speedEl.textContent = (speed / 320).toFixed(1) + 'x';

        spawnIn -= dt;
        if (spawnIn <= 0) {
            spawn();
            spawnIn = Math.max(0.52, 1.25 - speed / 1600) * (0.8 + Math.random() * 0.7);
        }

        for (var i = obstacles.length - 1; i >= 0; i--) {
            var o = obstacles[i];
            o.x -= speed * dt;
            if (hit(o)) { die(); return; }
            if (!o.passed && o.x + o.w < player.x) {
                o.passed = true;
                score += 1;
                scoreEl.textContent = String(score);
                burst(o.x + o.w, groundY - o.h / 2, '#ff4fa3', 4);
            }
            if (o.x + o.w < -60) obstacles.splice(i, 1);
        }

    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        // horizon glow
        var grad = ctx.createLinearGradient(0, groundY - H * 0.5, 0, groundY);
        grad.addColorStop(0, 'rgba(53,224,255,0)');
        grad.addColorStop(1, 'rgba(53,224,255,0.12)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, groundY - H * 0.5, W, H * 0.5);

        // ground line
        ctx.strokeStyle = 'rgba(53,224,255,.85)';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#35e0ff';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(W, groundY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // grid floor
        ctx.strokeStyle = 'rgba(53,224,255,.15)';
        ctx.lineWidth = 1;
        for (var i = 0; i < 12; i++) {
            var y = groundY + Math.pow(i / 11, 1.9) * (H - groundY);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }

        // obstacles
        obstacles.forEach(function (o) {
            ctx.fillStyle = 'rgba(255,79,163,.9)';
            ctx.shadowColor = '#ff4fa3';
            ctx.shadowBlur = 16;
            ctx.beginPath();
            var top = groundY - o.h;
            ctx.moveTo(o.x, groundY);
            ctx.lineTo(o.x + o.w / 2, top);
            ctx.lineTo(o.x + o.w, groundY);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        // player
        ctx.save();
        ctx.shadowColor = '#35e0ff';
        ctx.shadowBlur = 22;
        var pg = ctx.createLinearGradient(player.x, player.y, player.x + player.w, player.y + player.h);
        pg.addColorStop(0, '#35e0ff');
        pg.addColorStop(1, '#8affd6');
        ctx.fillStyle = pg;
        var r = 8;
        ctx.beginPath();
        ctx.moveTo(player.x + r, player.y);
        ctx.arcTo(player.x + player.w, player.y, player.x + player.w, player.y + player.h, r);
        ctx.arcTo(player.x + player.w, player.y + player.h, player.x, player.y + player.h, r);
        ctx.arcTo(player.x, player.y + player.h, player.x, player.y, r);
        ctx.arcTo(player.x, player.y, player.x + player.w, player.y, r);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // particles
        particles.forEach(function (p) {
            ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    function loop(now) {
        var dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        if (state === 'playing') update(dt);
        if (state === 'playing' || state === 'dead') {
            for (var i = particles.length - 1; i >= 0; i--) {
                var pt = particles[i];
                pt.age += dt;
                pt.x += pt.vx * dt;
                pt.y += pt.vy * dt;
                pt.vy += 900 * dt;
                if (pt.age > pt.life) particles.splice(i, 1);
            }
        }
        draw();
        if (state === 'playing' || particles.length) requestAnimationFrame(loop);
    }

    function onKey(e) {
        if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
            e.preventDefault();
            jump();
        }
    }
    window.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); jump(); });
    startBtn.addEventListener('click', function (e) { e.stopPropagation(); start(); });

    resize();
    reset();
    draw();
    hint.classList.remove('hide');
    window.addEventListener('resize', function () { if (state === 'idle') draw(); });
})();
