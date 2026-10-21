(function () {
  'use strict';

  var CONFIG = {
    color: '255,255,255',
    fit: 'contain',
    crisp: true,

    // Cursor trail
    trailRadius: 3,         // reach of each trail point, in grid pitches
    trailBoost: 0.85,       // 1 = full heat pushes a square to full white
    trailJitter: 0.3,       // per-square variation in how far it lights (keeps tonal texture)
    trailGrow: 0.5,         // size added at full heat
    trailMinSize: 0.45,     // lit squares grow to at least this share of the grid pitch
    trailDecay: 420,        // ms trail fade (time constant)
    trailAttack: 30         // ms to light up
  };

  if (typeof window === 'undefined' || !document.querySelector) return;

  var instances = [];
  var listening = false;

  function boot() {
    var wraps;
    try { wraps = document.querySelectorAll('[data-dots="wrap"]'); } catch (e) { return; }
    if (!wraps.length) return;
    if (!window.fetch || !window.DOMParser || !window.IntersectionObserver ||
        !window.requestAnimationFrame || !document.createElement('canvas').getContext) {
      reveal(wraps); return;
    }
    for (var i = 0; i < wraps.length; i++) {
      if (wraps[i].__dots) continue;
      wraps[i].__dots = true;
      try { createField(wraps[i]); }
      catch (err) { reveal([wraps[i]]); warn(err); }
    }
  }

  function reveal(list) {
    for (var i = 0; i < list.length; i++) {
      var img = list[i].querySelector && list[i].querySelector('[data-dots="fallback"]');
      if (img) img.style.opacity = 1;
    }
  }
  function warn(e) { try { console.warn('[dots]', e); } catch (_) {} }

  function mm(q) { try { return window.matchMedia(q).matches; } catch (e) { return false; } }
  var reduceMotion = mm('(prefers-reduced-motion: reduce)');
  var isTouch = mm('(hover: none)');
  var NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/gi;

  function rand(i, s) {
    var h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ s;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function parseSVG(text) {
    var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    var svg = doc.querySelector('svg');
    if (!svg) throw new Error('No <svg> in file');
    var vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || vb.some(isNaN)) {
      vb = [0, 0, parseFloat(svg.getAttribute('width')) || 0, parseFloat(svg.getAttribute('height')) || 0];
    }
    if (!(vb[2] > 0 && vb[3] > 0)) throw new Error('SVG has no usable size');
    var out = [], els = svg.querySelectorAll('rect, path');
    for (var k = 0; k < els.length; k++) {
      var el = els[k], x, y, w, h;
      if (el.getAttribute('fill') === 'none') continue;
      if (el.tagName.toLowerCase() === 'rect') {
        x = +el.getAttribute('x') || 0; y = +el.getAttribute('y') || 0;
        w = +el.getAttribute('width') || 0; h = +el.getAttribute('height') || 0;
      } else {
        var n = (el.getAttribute('d') || '').match(NUM);
        if (!n || n.length < 4) continue;
        var a = +n[0], b = +n[1], c = +n[2], d = +n[3];
        x = Math.min(a, c); y = Math.min(b, d); w = Math.abs(a - c); h = Math.abs(d - b);
      }
      if (w <= 0 || h <= 0 || w >= vb[2] * 0.5) continue; // skip background rects
      var op = el.getAttribute('fill-opacity');
      if (op === null) op = el.getAttribute('opacity');
      op = op === null ? 1 : parseFloat(op);
      if (!(op > 0)) continue;
      out.push(x + w / 2, y + h / 2, (w + h) / 2, op);
    }
    if (!out.length) throw new Error('No squares found in SVG');
    return { vb: vb, data: out };
  }

  function createField(wrap) {
    var img = wrap.querySelector('[data-dots="fallback"]');
    var src = wrap.getAttribute('data-dots-src') || (img && img.getAttribute('src'));
    if (!src) { reveal([wrap]); return; }

    fetch(src, { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + src); return r.text(); })
      .then(function (t) { init(parseSVG(t)); })
      .catch(function (e) { reveal([wrap]); warn(e); });

    function init(parsed) {
      var vb = parsed.vb, D = parsed.data, n = D.length / 4, i;
      var cx = new Float32Array(n), cy = new Float32Array(n), sz = new Float32Array(n),
          base = new Float32Array(n), jit = new Float32Array(n);
      for (i = 0; i < n; i++) {
        cx[i] = D[i * 4]; cy[i] = D[i * 4 + 1]; sz[i] = D[i * 4 + 2]; base[i] = D[i * 4 + 3];
        jit[i] = 1 - CONFIG.trailJitter * rand(i, 31);
      }

      // Grid pitch from median nearest-neighbour distance (works for any field)
      var cell0 = Math.max(vb[2], vb[3]) / Math.sqrt(n) || 10;
      var hash0 = buildHash(cell0), sample = [], step = Math.max(1, Math.floor(n / 300));
      for (i = 0; i < n; i += step) {
        var best = Infinity;
        eachNear(hash0, cell0, cx[i], cy[i], cell0 * 2, function (j, d2) { if (d2 > 1e-6 && d2 < best) best = d2; });
        if (best < Infinity) sample.push(Math.sqrt(best));
      }
      sample.sort(function (a, b) { return a - b; });
      var pitch = sample.length ? sample[sample.length >> 1] : cell0;
      var hash = buildHash(pitch);

      function buildHash(cell) {
        var m = new Map();
        for (var q = 0; q < n; q++) {
          var key = Math.floor(cx[q] / cell) + ',' + Math.floor(cy[q] / cell);
          var b = m.get(key); if (!b) m.set(key, b = []); b.push(q);
        }
        return m;
      }
      function eachNear(m, cell, x, y, r, fn) {
        var gx0 = Math.floor((x - r) / cell), gx1 = Math.floor((x + r) / cell);
        var gy0 = Math.floor((y - r) / cell), gy1 = Math.floor((y + r) / cell), r2 = r * r;
        for (var gx = gx0; gx <= gx1; gx++) for (var gy = gy0; gy <= gy1; gy++) {
          var b = m.get(gx + ',' + gy); if (!b) continue;
          for (var k = 0; k < b.length; k++) {
            var j = b[k], dx = cx[j] - x, dy = cy[j] - y, d2 = dx * dx + dy * dy;
            if (d2 <= r2) fn(j, d2);
          }
        }
      }

      if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
      var canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block;';
      wrap.appendChild(canvas);
      var ctx = canvas.getContext('2d');
      var color = 'rgb(' + (wrap.getAttribute('data-dots-color') || CONFIG.color) + ')';
      var fit = wrap.getAttribute('data-dots-fit') || CONFIG.fit;

      var W = 0, H = 0, dpr = 1, scale = 1, offX = 0, offY = 0;
      function layout() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = Math.max(1, Math.round(wrap.clientWidth * dpr)); H = Math.max(1, Math.round(wrap.clientHeight * dpr));
        canvas.width = W; canvas.height = H;
        scale = fit === 'cover' ? Math.max(W / vb[2], H / vb[3]) : Math.min(W / vb[2], H / vb[3]);
        offX = (W - vb[2] * scale) / 2 - vb[0] * scale;
        offY = (H - vb[3] * scale) / 2 - vb[1] * scale;
      }

      var heat = new Float32Array(n), disp = new Float32Array(n);
      var visible = false;
      var running = false, lastT = 0, last = null;
      var reach = CONFIG.trailRadius * pitch;

      function heatAt(x, y) {
        eachNear(hash, pitch, x, y, reach, function (j, d2) {
          var t = 1 - d2 / (reach * reach), h = t * t;
          if (h > heat[j]) heat[j] = h;
        });
      }
      function heatSegment(a, b) {
        if (!a) { heatAt(b.x, b.y); return; }
        var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy);
        var steps = Math.min(200, Math.max(1, Math.ceil(len / (pitch * 0.5))));
        for (var s = 1; s <= steps; s++) heatAt(a.x + dx * s / steps, a.y + dy * s / steps);
      }

      function draw(now) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = color;
        for (var q = 0; q < n; q++) {
          var o = base[q];
          var d = disp[q] * jit[q];
          if (d > 0) o += (1 - o) * d * CONFIG.trailBoost;
          if (o > 1) o = 1;
          var s0 = sz[q], s1 = Math.max(s0 * (1 + CONFIG.trailGrow), pitch * CONFIG.trailMinSize);
          var s = (s0 + (s1 - s0) * d) * scale;
          var x = offX + cx[q] * scale - s / 2, y = offY + cy[q] * scale - s / 2;
          if (CONFIG.crisp) {
            var x2 = Math.round(x + s), y2 = Math.round(y + s);
            x = Math.round(x); y = Math.round(y);
            s = Math.max(1, Math.min(x2 - x, y2 - y));
          }
          ctx.globalAlpha = o;
          ctx.fillRect(x, y, s, s);
        }
        ctx.globalAlpha = 1;
      }

      function frame(now) {
        try {
          var dt = lastT ? Math.min(64, now - lastT) : 16; lastT = now;
          var decay = Math.exp(-dt / CONFIG.trailDecay), rise = 1 - Math.exp(-dt / CONFIG.trailAttack);

          var active = false;
          for (var q = 0; q < n; q++) {
            var h = heat[q];
            if (h === 0 && disp[q] === 0) continue;
            h *= decay; if (h < 0.003) h = 0; heat[q] = h;
            var d = disp[q];
            d = h > d ? d + (h - d) * rise : h;
            if (d < 0.003) d = 0;
            disp[q] = d;
            if (d > 0) active = true;
          }
          draw(now);

          if (active) requestAnimationFrame(frame);
          else { running = false; lastT = 0; }
        } catch (err) { running = false; warn(err); }
      }
      function kick() { if (running) return; running = true; requestAnimationFrame(frame); }

      var inst = {
        move: function (e) {
          if (!visible) { last = null; return; }
          var r = canvas.getBoundingClientRect();
          var px = (e.clientX - r.left) * dpr, py = (e.clientY - r.top) * dpr, m = reach * scale;
          if (px < -m || py < -m || px > W + m || py > H + m) { last = null; return; }
          var p = { x: (px - offX) / scale, y: (py - offY) / scale };
          heatSegment(last, p); last = p; kick();
        }
      };

      layout();
      if (img) img.style.opacity = 0;
      draw(0);
      // Ready hook for page animations, e.g. GSAP: wrap.addEventListener('dots:ready', ...)
      wrap.setAttribute('data-dots-ready', '');
      try { wrap.dispatchEvent(new CustomEvent('dots:ready', { bubbles: true })); } catch (e) {}

      if (window.ResizeObserver) {
        new ResizeObserver(function () { layout(); if (!running) draw(performance.now()); }).observe(wrap);
      } else {
        window.addEventListener('resize', function () { layout(); if (!running) draw(performance.now()); });
      }

      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (!visible) last = null;
      }, { threshold: 0 }).observe(wrap);

      instances.push(inst);
      if (!isTouch && !reduceMotion && !listening) {
        listening = true;
        window.addEventListener('pointermove', function (e) {
          if (e.pointerType && e.pointerType !== 'mouse') return;
          for (var k = 0; k < instances.length; k++) {
            try { instances[k].move(e); } catch (err) { warn(err); }
          }
        }, { passive: true });
      }
    }
  }

  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  } catch (e) { warn(e); }
})();