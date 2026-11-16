/* Braid Keyboard download page: the demo keyboards. No libraries, no network.
   The shapes and timings follow the app's own drawing (two-thumb trails, the knot on lift,
   and the key-press effects Glitch, Lightning, Pixel and Confetti), re-drawn for canvas. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var es = root.lang === 'es';

  // The language link remembers the choice, so lang.js never overrides it.
  var langLink = d.querySelector('.langs');
  if (langLink) langLink.addEventListener('click', function () {
    try { localStorage.setItem('braid-lang', es ? 'en' : 'es'); } catch (e) {}
  });

  var hero = d.getElementById('hero-kb'), strip = d.getElementById('try-kb');
  if (!hero || !strip) return;

  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var TAU = Math.PI * 2;

  // Easing and the stable pseudo-random the effects share.
  function cl(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function seg(t, a, b) { return cl((t - a) / (b - a)); }
  function o3(t) { return 1 - (1 - t) * (1 - t) * (1 - t); }
  function ox(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function i2(t) { return t * t; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function fade(t, from) { return 1 - smooth(seg(t, from, 1)); }
  function hash(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function hex(s) {
    s = s.trim().replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + cl(a).toFixed(3) + ')'; }
  var WHITE = [255, 255, 255], BLACK = [0, 0, 0], RED = [255, 45, 85], CYAN = [0, 229, 255];

  // One demo keyboard: its canvas, where its keys are, and its theme colors.
  function Board(el) {
    this.el = el;
    this.canvas = el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.keys = {};
    this.w = 0; this.h = 0;
  }
  Board.prototype.measure = function () {
    var box = this.el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = box.width; this.h = box.height;
    var keys = this.keys = {}, list = this.el.querySelectorAll('.k');
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      var k = { el: list[i], l: r.left - box.left, t: r.top - box.top, r: r.right - box.left, b: r.bottom - box.top };
      k.x = (k.l + k.r) / 2; k.y = (k.t + k.b) / 2;
      var name = list[i].textContent.trim();
      if (name.length === 1) keys[name] = k;
    }
    var rows = this.el.querySelector('.krows').getBoundingClientRect();
    this.rowsTop = rows.top - box.top;
    var bar = this.el.querySelector('.kbar');
    if (bar) { var b = bar.getBoundingClientRect(); this.barX = b.left - box.left + b.width / 2; this.barY = b.top - box.top + b.height / 2; }
    this.colors();
    this.canvas.width = Math.round(box.width * dpr);
    this.canvas.height = Math.round(box.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  Board.prototype.colors = function () {
    var cs = getComputedStyle(this.el), c = this.c = {};
    ['key', 'kt', 'acc', 'L', 'L2', 'R', 'R2'].forEach(function (n) { c[n] = hex(cs.getPropertyValue('--' + n)); });
    c.dark = (0.2126 * c.key[0] + 0.7152 * c.key[1] + 0.0722 * c.key[2]) / 255 < 0.4;
  };
  Board.prototype.clear = function () { this.ctx.clearRect(0, 0, this.w, this.h); };

  // Canvas primitives, named after what the app's effect canvas offers.
  function line(g, x1, y1, x2, y2, w, col) {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  function rr(g, l, t, r, b, rad) {
    g.beginPath();
    if (g.roundRect) g.roundRect(l, t, r - l, b - t, Math.max(0, rad)); else g.rect(l, t, r - l, b - t);
  }
  function fillRR(g, l, t, r, b, rad, col) { g.fillStyle = col; rr(g, l, t, r, b, rad); g.fill(); }
  function strokeRR(g, l, t, r, b, rad, w, col) { g.strokeStyle = col; g.lineWidth = w; rr(g, l, t, r, b, rad); g.stroke(); }
  function circle(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, Math.max(0, r), 0, TAU); g.fill(); }
  function glow(g, x, y, r, c, a) {
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(c, a)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }

  // ---- Key-press effects (the strip) ----
  var DUR = { glitch: 170, zap: 190, pixel: 250, confetti: 280 };  // ms, as in the app
  var GLITCH_STEPS = [1, 0.75, 1, 0.45, 0.7, 0.3, 0.15];
  var NEIGHBORS = [1, 0, 0.5, 1, -0.5, 1, -1, 0, -0.5, -1, 0.5, -1];
  var live = [];

  function spawn(board, key, kind, px, slow) {
    var c = board.c, e = {
      kind: kind, born: performance.now(), life: DUR[kind] * (slow ? 4 : 1),
      l: key.l, t: key.t, r: key.r, b: key.b,
      x: px == null ? key.x : Math.min(key.r, Math.max(key.l, px)), y: key.t + (key.b - key.t) * 0.55,
      u: (key.b - key.t) / 74, seed: Math.floor(Math.random() * 1024)
    };
    if (kind === 'glitch') { e.c1 = c.kt; e.c2 = RED; e.c3 = CYAN; }
    else if (kind === 'zap') { e.c1 = c.acc; e.c2 = c.dark ? mix(c.acc, WHITE, 0.6) : mix(c.acc, BLACK, 0.3); e.c3 = c.R; }
    else if (kind === 'pixel') { e.c1 = c.acc; e.c2 = c.R; e.c3 = c.kt; }
    else { e.c1 = c.acc; e.c2 = c.L2; e.c3 = c.R; }
    if (live.length > 40) live.shift();
    live.push(e);
    wake();
  }

  // Glitch: the outline pulls apart into two colors, four slices jump sideways, two scan lines cross.
  // Time moves in jumps: each state holds, then the picture tears somewhere else, calmer each time.
  function drawGlitch(g, e, t) {
    var u = e.u, h = e.seed, step = Math.min(GLITCH_STEPS.length - 1, Math.floor(t * GLITCH_STEPS.length));
    var env = GLITCH_STEPS[step], op = fade(t, 0.55), kh = e.b - e.t, split = 4.5 * env * u, k, q;
    strokeRR(g, e.l - split, e.t, e.r - split, e.b, 8 * u, 1.6 * u, rgba(e.c2, 0.85 * op));
    strokeRR(g, e.l + split, e.t, e.r + split, e.b, 8 * u, 1.6 * u, rgba(e.c3, 0.85 * op));
    for (k = 0; k < 4; k++) {
      q = h + step * 13 + k * 7;
      var sy = e.t + kh * (0.06 + 0.74 * hash(q)), sh = kh * (0.07 + 0.1 * hash(q + 1)), dx = (hash(q + 2) - 0.5) * 30 * env * u;
      fillRR(g, e.l + dx, sy, e.r + dx, sy + sh, 0, rgba(e.c1, 0.9 * op));
      fillRR(g, e.l + dx - split, sy, e.l + dx, sy + sh, 0, rgba(e.c2, 0.9 * op));
      fillRR(g, e.r + dx, sy, e.r + dx + split, sy + sh, 0, rgba(e.c3, 0.9 * op));
    }
    for (k = 0; k < 2; k++) {
      q = h + step * 17 + k * 5 + 50;
      var y = e.t - 6 * u + (kh + 12 * u) * hash(q), half = (38 + 14 * hash(q + 1)) * u;
      line(g, e.x - half, y, e.x + half, y, 0.9 * u, rgba(k ? e.c3 : e.c2, 0.6 * op * env));
    }
  }

  // Lightning: three jagged bolts strike toward the keys around, each with a side branch and a hot point.
  // It strikes, holds, goes dark for a blink, strikes again along a new path, then thins out.
  function drawZap(g, e, t) {
    var u = e.u, cx = e.x, cy = e.y, pitch = (e.r - e.l) * 1.12, row = (e.b - e.t) * 1.1;
    var again = t >= 0.34, grow = again ? 1 : o3(seg(t, 0, 0.1));
    var env = t < 0.26 ? 1 : t < 0.34 ? 0.18 : t < 0.5 ? 1 : fade(t, 0.5);
    var h = e.seed + (again ? 31 : 0), glowC = rgba(e.c1, 0.34 * env), core = rgba(e.c2, env);
    var coreW = (2 - 1.1 * seg(t, 0.5, 1)) * u, flash = seg(t, 0, 0.3);
    if (flash < 1) glow(g, cx, cy, (10 + 8 * flash) * u * 1.6, e.c1, 0.7 * (1 - flash));
    for (var k = 0; k < 3; k++) {
      var n = (e.seed + 2 * k) % 6, dx = NEIGHBORS[n * 2] * pitch, dy = NEIGHBORS[n * 2 + 1] * row + (e.t + e.b) / 2 - cy;
      var len = Math.sqrt(dx * dx + dy * dy), nx = -dy / len, ny = dx / len, q = h + k * 17;
      var px = cx, py = cy, fx = cx, fy = cy;
      for (var j = 1; j <= 4; j++) {
        var f = j / 4 * grow, jit = j === 4 ? 0 : (hash(q + j) - 0.5) * 18 * u * grow;
        var x = cx + dx * f + nx * jit, y = cy + dy * f + ny * jit;
        line(g, px, py, x, y, 5 * u, glowC);
        line(g, px, py, x, y, coreW, core);
        if (j === 2) { fx = x; fy = y; }
        px = x; py = y;
      }
      var turn = hash(q + 7) > 0.5 ? 0.75 : -0.75;
      var bx = (dx * Math.cos(turn) - dy * Math.sin(turn)) / len, by = (dx * Math.sin(turn) + dy * Math.cos(turn)) / len;
      var reach = (11 + 8 * hash(q + 8)) * grow * u, off = (hash(q + 9) - 0.5) * 8 * u;
      var mx = fx + bx * reach + nx * off, my = fy + by * reach + ny * off;
      line(g, fx, fy, mx, my, coreW * 0.7, core);
      line(g, mx, my, mx + bx * reach * 0.8, my + by * reach * 0.8, coreW * 0.5, core);
      if (grow >= 1) circle(g, px, py, (2.2 + (again ? 1.6 : 0)) * (1 - 0.5 * seg(t, 0.5, 1)) * u, core);
    }
  }

  // Pixel: the key breaks into twenty square blocks (4 x 5) that jump out in whole steps, hang and snap back.
  function drawPixel(g, e, t) {
    var u = e.u, h = e.seed, COLS = 4, ROWS = 5, k;
    var away = ox(seg(t, 0, 0.28)) * (1 - i2(seg(t, 0.52, 0.84))), left = 1 - seg(t, 0.84, 0.94);
    var bw = (e.r - e.l) / COLS, bh = (e.b - e.t) / ROWS, seam = rgba(e.c3, 0.4 * Math.min(1, away * 3) * left);
    for (k = 1; k < COLS; k++) line(g, e.l + k * bw, e.t + 2 * u, e.l + k * bw, e.b - 2 * u, 0.9 * u, seam);
    for (k = 1; k < ROWS; k++) line(g, e.l + 2 * u, e.t + k * bh, e.r - 2 * u, e.t + k * bh, 0.9 * u, seam);
    var step = 3 * u, size = 0.5 * (1 - 0.3 * away), mxk = (e.l + e.r) / 2, myk = (e.t + e.b) / 2;
    for (k = 0; k < COLS * ROWS; k++) {
      var bx = e.l + (k % COLS + 0.5) * bw, by = e.t + (Math.floor(k / COLS) + 0.5) * bh;
      var an = Math.atan2(by - myk, bx - mxk) + (hash(h + k * 3) - 0.5) * 0.9;
      var dist = (12 + 30 * hash(h + k)) * away * u;
      var x = bx + Math.floor(Math.cos(an) * dist / step + 0.5) * step, y = by + Math.floor(Math.sin(an) * dist / step + 0.5) * step;
      var a = (k % 2 ? 0.8 : 0.95) * Math.min(1, 0.22 + away * 4) * left;
      fillRR(g, x - bw * size + 0.6 * u, y - bh * size + 0.6 * u, x + bw * size - 0.6 * u, y + bh * size - 0.6 * u, 0.8 * u, rgba(k % 5 === 2 ? e.c2 : e.c1, a));
    }
    var snap = seg(t, 0.82, 1);
    if (snap > 0) {
      var gp = 5 * o3(snap) * u;
      strokeRR(g, e.l - gp, e.t - gp, e.r + gp, e.b + gp, 8 * u + gp, (2.4 * (1 - snap) + 0.4) * u, rgba(e.c2, 0.9 * (1 - snap) * (1 - snap)));
    }
  }

  // Confetti: fourteen paper bits burst up in a fan, then flutter down, flipping.
  function drawConfetti(g, e, t) {
    var u = e.u, h = e.seed, op = fade(t, 0.65), burst = ox(seg(t, 0, 0.6));
    var cols = [e.c1, e.c2, e.c3, mix(e.c2, WHITE, 0.35)];
    for (var k = 0; k < 14; k++) {
      var an = -Math.PI / 2 + (hash(h + k) - 0.5) * 2.6, sp = 38 + 30 * hash(h + k + 20);
      var x = e.x + (Math.cos(an) * sp * burst * 0.8 + Math.sin(t * 9 + k) * 4 * t) * u;
      var y = e.y + (Math.sin(an) * sp * burst + 110 * t * t) * u;
      var flip = Math.abs(Math.cos(t * (14 + 6 * hash(h + k + 40)) + k));
      var w = (6.5 + 3 * hash(h + k + 60)) * u * Math.max(0.15, flip), ht = (3.8 + 1.4 * hash(h + k + 80)) * u;
      g.save();
      g.translate(x, y);
      g.rotate((k * 47 + t * (k % 2 ? -300 : 260)) * Math.PI / 180);
      fillRR(g, -w / 2, -ht / 2, w / 2, ht / 2, 0.4 * u, rgba(cols[k % 4], op));
      g.restore();
    }
  }
  var DRAW = { glitch: drawGlitch, zap: drawZap, pixel: drawPixel, confetti: drawConfetti };

  // ---- The hero: two thumbs glide a word at the same time ----
  var WORDS = es ? ['dos', 'pulgares', 'una', 'palabra'] : ['two', 'thumbs', 'one', 'word'];
  var STEP = 230, LEAD = 200, LIFT = 140, KNOT = 360, REST = 450, HOLD = 1300;  // ms; the knot's 360 is the app's
  var plan = [], loopLen = 0, clock = 0, stage = '', glowA = 0;

  function bez(a, c, b, s) { var m = 1 - s; return m * m * a + 2 * m * s * c + s * s * b; }
  function thumbAt(th, t, out) {
    var w = th.w, n = w.length, j = 0;
    if (t <= w[0].t || n === 1) { out.x = w[0].x; out.y = w[0].y; return; }
    if (t >= w[n - 1].t) { out.x = w[n - 1].x; out.y = w[n - 1].y; return; }
    while (j < n - 2 && t > w[j + 1].t) j++;
    var a = w[j], b = w[j + 1], s = smooth((t - a.t) / (b.t - a.t));
    out.x = bez(a.x, a.cx, b.x, s); out.y = bez(a.y, a.cy, b.y, s);
  }
  function buildPlan(board) {
    plan = [];
    var at = 0, mid = board.w / 2;
    WORDS.forEach(function (word) {
      var p = { word: word, start: at, thumbs: [] }, sides = { L: [], R: [] };
      for (var i = 0; i < word.length; i++) {
        var k = board.keys[word[i]];
        if (!k) continue;
        sides[k.x < mid ? 'L' : 'R'].push({ x: k.x, y: k.y, t: at + LEAD + i * STEP, k: k });
      }
      ['L', 'R'].forEach(function (side) {
        var w = sides[side];
        if (!w.length) return;
        for (var j = 0; j < w.length - 1; j++) {  // a soft arc between keys, as a thumb sweeps
          var dx = w[j + 1].x - w[j].x, dy = w[j + 1].y - w[j].y, bend = (j % 2 ? -0.2 : 0.2) * (side === 'L' ? 1 : -1);
          w[j].cx = (w[j].x + w[j + 1].x) / 2 - dy * bend; w[j].cy = (w[j].y + w[j + 1].y) / 2 + dx * bend;
        }
        p.thumbs.push({ side: side, w: w, down: w[0].t - 60, up: w[w.length - 1].t + (w.length === 1 ? 90 : 0) });
      });
      p.lift = at + LEAD + (word.length - 1) * STEP + LIFT;
      p.thumbs.forEach(function (th) { if (th.w.length > 1) th.up = Math.max(th.up, p.lift); });
      // Where the two trails meet: the midpoint of their closest pair of points.
      var a = p.thumbs[0], b = p.thumbs[1] || a, best = 1e12, pa = {}, pb = {};
      p.mx = a.w[a.w.length - 1].x; p.my = a.w[a.w.length - 1].y;
      if (b !== a) for (var s = 0; s <= 24; s++) {
        thumbAt(a, a.down + (a.up - a.down) * s / 24, pa);
        for (var r = 0; r <= 24; r++) {
          thumbAt(b, b.down + (b.up - b.down) * r / 24, pb);
          var dd = (pa.x - pb.x) * (pa.x - pb.x) + (pa.y - pb.y) * (pa.y - pb.y);
          if (dd < best) { best = dd; p.mx = (pa.x + pb.x) / 2; p.my = (pa.y + pb.y) / 2; }
        }
      }
      p.end = p.lift + KNOT + REST;
      at = p.end;
      plan.push(p);
    });
    loopLen = at + HOLD;
  }

  function knot(g, x, y, s, rot, alpha, cL, cR) {
    g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = cl(alpha);
    g.lineWidth = s * 0.17; g.lineCap = 'round';
    for (var k = 0; k < 4; k++) {  // four strands in a pinwheel, two of each color, like the Nudo mark
      g.strokeStyle = rgba(k % 2 ? cR : cL, 1);
      g.beginPath(); g.ellipse(0, -s * 0.13, s * 0.5, s * 0.24, 0, Math.PI * 0.62, Math.PI * 1.62); g.stroke();
      g.rotate(Math.PI / 2);
    }
    g.restore();
  }

  var pt = { x: 0, y: 0 };
  function drawHero(board, tt) {
    var g = board.ctx, c = board.c, i = 0;
    board.clear();
    while (i < plan.length - 1 && tt >= plan[i].end) i++;
    var p = plan[i], after = tt - p.lift, keyH = board.keys.q.b - board.keys.q.t;
    var sub = after < 0 ? 0 : after < 320 ? 1 : 2, st = i + ':' + sub;
    if (st !== stage) {
      stage = st;
      var done = WORDS.slice(0, i + (sub ? 1 : 0)).join(' ');
      board.field.textContent = done;
      board.word.textContent = sub ? p.word : '';
      board.bar.classList.toggle('lit', sub === 1);
    }
    var downs = 0, pull = after > 0 ? i2(seg(after, 0, 120)) : 0;
    // Each key lights for a moment as a thumb reaches it.
    if (after < 0) p.thumbs.forEach(function (th) {
      for (var j = 0; j < th.w.length; j++) {
        var a = 1 - Math.abs(tt - th.w[j].t) / 170, k = th.w[j].k;
        if (a > 0) fillRR(g, k.l, k.t, k.r, k.b, keyH * 0.14, rgba(th.side === 'L' ? c.L : c.R, 0.3 * a));
      }
    });
    if (after < 120) p.thumbs.forEach(function (th) {
      if (tt < th.down) return;
      var col = th.side === 'L' ? c.L : c.R, col2 = th.side === 'L' ? c.L2 : c.R2;
      var t1 = Math.min(tt, th.up), n = Math.max(2, Math.ceil((t1 - th.down) / 14)), x0 = 0, y0 = 0;
      g.lineWidth = keyH * 0.2 * (1 - 0.5 * pull); g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath();
      for (var s = 0; s <= n; s++) {
        thumbAt(th, th.down + (t1 - th.down) * s / n, pt);
        var x = pt.x + (p.mx - pt.x) * pull, y = pt.y + (p.my - pt.y) * pull;
        if (s) g.lineTo(x, y); else { g.moveTo(x, y); x0 = x; y0 = y; }
      }
      var gr = g.createLinearGradient(x0, y0, pt.x + (p.mx - pt.x) * pull + 0.01, pt.y + (p.my - pt.y) * pull);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(1, rgba(col2, 1));
      g.strokeStyle = gr; g.stroke();
      if (tt <= th.up && after <= 0) {  // the thumb is down: a halo and a ring under it
        downs++;
        glow(g, pt.x, pt.y, keyH * 0.75, col, 0.3);
        g.strokeStyle = rgba(col, 0.6); g.lineWidth = Math.max(1.5, keyH * 0.04);
        g.beginPath(); g.arc(pt.x, pt.y, keyH * 0.42, 0, TAU); g.stroke();
      }
    });
    // The glow means two: a two-color line along the bar's lower edge while both thumbs are down.
    glowA += ((downs > 1 ? 1 : 0) - glowA) * 0.25;
    if (glowA > 0.02) {
      var lg = g.createLinearGradient(0, 0, board.w, 0);
      lg.addColorStop(0, rgba(c.L, glowA)); lg.addColorStop(1, rgba(c.R, glowA));
      g.fillStyle = lg; g.fillRect(0, board.rowsTop - 1, board.w, 2);
    }
    // The knot on lift: it ties where the trails met, settles, and rises into the word.
    if (after >= 120 && after < KNOT) {
      var tie = o3(seg(after, 120, 200)), rise = i2(seg(after, 260, 360));
      var sc = (0.6 + 0.48 * tie - 0.08 * seg(after, 200, 260)) * (1 - 0.45 * rise);
      var kx = p.mx + (board.barX - p.mx) * rise, ky = p.my + (board.barY - p.my) * rise;
      var b = seg(after, 120, 290);
      if (b < 1) {
        g.strokeStyle = rgba(c.L2, 0.5 * (1 - b)); g.lineWidth = 1.5;
        g.beginPath(); g.arc(p.mx, p.my, keyH * (0.35 + 0.7 * o3(b)), 0, TAU); g.stroke();
        for (var k = 0; k < 6; k++) {
          var an = k * TAU / 6 + 0.4, rd = keyH * (0.4 + 0.75 * o3(b));
          circle(g, p.mx + Math.cos(an) * rd, p.my + Math.sin(an) * rd, keyH * 0.05 * (1 - b), rgba(k % 2 ? c.R : c.L, 1 - b));
        }
      }
      knot(g, kx, ky, keyH * 0.9 * sc, -Math.PI / 2 * (1 - tie), 1 - rise, c.L, c.R);
    }
  }

  // ---- Running it: one frame loop, only while something moves and is on screen ----
  var heroB = new Board(hero), stripB = new Board(strip);
  heroB.field = d.getElementById('hero-text'); heroB.word = d.getElementById('hero-word'); heroB.bar = hero.querySelector('.kbar');
  var typed = d.getElementById('try-text'), toggle = d.getElementById('hero-toggle');
  var heroSeen = false, paused = false, raf = 0, last = 0;

  function heroRuns() { return heroSeen && !paused && !reduce.matches && !d.hidden; }
  function frame(now) {
    raf = 0;
    var dt = Math.min(50, now - last); last = now;
    if (heroRuns()) { clock = (clock + dt) % loopLen; drawHero(heroB, clock); }
    if (live.length) {
      stripB.clear();
      for (var i = live.length - 1; i >= 0; i--) {
        var e = live[i], t = (now - e.born) / e.life;
        if (t >= 1) live.splice(i, 1); else DRAW[e.kind](stripB.ctx, e, t);
      }
    }
    wake();
  }
  function wake() {
    if (!raf && (heroRuns() || live.length)) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  // With reduced motion there is no loop: one still frame, both thumbs mid-word.
  function still() {
    stage = '';
    drawHero(heroB, reduce.matches ? plan[1].lift - 1 : clock);
  }
  function layout() {
    heroB.measure(); stripB.measure(); buildPlan(heroB);
    if (!heroRuns()) still();
    wake();
  }
  layout();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { heroSeen = en[0].isIntersecting; wake(); }, { threshold: 0.15 }).observe(hero);
  } else heroSeen = true;
  d.addEventListener('visibilitychange', wake);
  var rt = 0;
  if ('ResizeObserver' in window) new ResizeObserver(function (en) {
    if (Math.abs(en[0].contentRect.width - heroB.w) < 1) return;  // the first call, and height-only changes
    clearTimeout(rt); rt = setTimeout(layout, 120);
  }).observe(hero);
  reduce.addEventListener('change', function () { toggle.hidden = reduce.matches; layout(); });

  toggle.hidden = reduce.matches;
  toggle.addEventListener('click', function () {
    paused = !paused;
    toggle.textContent = toggle.getAttribute(paused ? 'data-play' : 'data-pause');
    wake();
  });

  // The strip: every tap starts its own effect, so fast taps stack, as in the app.
  function choice(name) { var r = d.querySelector('input[name=' + name + ']:checked'); return r ? r.value : ''; }
  function press(btn, px) {
    var name = btn.textContent.trim(), key = stripB.keys[name], slow = d.getElementById('fx-slow').checked;
    if (!key) return;
    typed.textContent = (typed.textContent + name).slice(-14);
    btn.classList.add('down');
    setTimeout(function () { btn.classList.remove('down'); }, slow ? 280 : 70);
    if (!reduce.matches) spawn(stripB, key, choice('fx') || 'glitch', px, slow);
  }
  strip.addEventListener('pointerdown', function (ev) {
    var btn = ev.target.closest('button.k');
    if (btn) press(btn, ev.clientX - strip.getBoundingClientRect().left);
  });
  strip.addEventListener('click', function (ev) {  // keyboard and switch users: a click with no pointer
    var btn = ev.target.closest('button.k');
    if (btn && ev.detail === 0) press(btn, null);
  });
  d.querySelectorAll('input[name=theme]').forEach(function (r) {
    r.addEventListener('change', function () { heroB.colors(); stripB.colors(); if (!heroRuns()) still(); });
  });
})();
