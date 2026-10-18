(function () {
  const SB = window.SB;
  const T = SB.T;
  const TAU = Math.PI * 2;
  const FONT = "Kanit, 'Segoe UI', sans-serif";

  /* ---------------- helpers ---------------- */
  function rnd(x, y, i) {
    let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 7, 668265263) ^ Math.imul((i || 0) + 13, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function ell(c, x, y, rx, ry, fill) {
    c.fillStyle = fill;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, TAU);
    c.fill();
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const cl = (v) => Math.max(0, Math.min(255, v));
    return 'rgb(' + cl((n >> 16) + amt) + ',' + cl(((n >> 8) & 255) + amt) + ',' + cl((n & 255) + amt) + ')';
  }

  /* ---------------- static layer ---------------- */
  function floorTile(c, x, y, th) {
    const px = x * T, py = y * T;
    c.fillStyle = th.floor[(x + y) & 1];
    c.fillRect(px, py, T, T);
    if (th.kind === 'wood') {
      for (let i = 0; i < 4; i++) {
        const r = rnd(x, y, i);
        c.fillStyle = r > 0.5 ? 'rgba(255,255,255,' + (r - 0.5) * 0.14 + ')' : 'rgba(0,0,0,' + (0.5 - r) * 0.12 + ')';
        c.fillRect(px + i * 9, py, 9, T);
        c.fillStyle = th.seam;
        c.fillRect(px + i * 9, py, 1, T);
        c.fillRect(px + i * 9, py + Math.floor(rnd(x, y, i + 9) * 30) + 3, 9, 1);
      }
    } else {
      c.strokeStyle = th.seam;
      c.lineWidth = 1;
      c.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      c.strokeStyle = 'rgba(255,255,255,.3)';
      c.beginPath();
      c.moveTo(px + 2, py + 2); c.lineTo(px + T - 2, py + 2);
      c.moveTo(px + 2, py + 2); c.lineTo(px + 2, py + T - 2);
      c.stroke();
      if (rnd(x, y, 3) > 0.55) {
        c.strokeStyle = 'rgba(90,90,110,.13)';
        c.beginPath();
        c.moveTo(px + rnd(x, y, 4) * T, py);
        c.quadraticCurveTo(px + rnd(x, y, 5) * T, py + T / 2, px + rnd(x, y, 6) * T, py + T);
        c.stroke();
      }
    }
  }

  function rugTile(c, x, y, th, isRug) {
    const px = x * T, py = y * T;
    c.fillStyle = th.rug;
    c.fillRect(px, py, T, T);
    c.fillStyle = 'rgba(0,0,0,.12)';
    c.fillRect(px, py, T, T);
    c.strokeStyle = th.rugEdge;
    c.globalAlpha = 0.28;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(px + T / 2, py + 6); c.lineTo(px + T - 6, py + T / 2); c.lineTo(px + T / 2, py + T - 6); c.lineTo(px + 6, py + T / 2); c.closePath();
    c.stroke();
    c.globalAlpha = 1;
    c.strokeStyle = th.rugEdge;
    c.lineWidth = 2;
    c.beginPath();
    if (!isRug(x, y - 1)) { c.moveTo(px, py + 3); c.lineTo(px + T, py + 3); }
    if (!isRug(x, y + 1)) { c.moveTo(px, py + T - 3); c.lineTo(px + T, py + T - 3); }
    if (!isRug(x - 1, y)) { c.moveTo(px + 3, py); c.lineTo(px + 3, py + T); }
    if (!isRug(x + 1, y)) { c.moveTo(px + T - 3, py); c.lineTo(px + T - 3, py + T); }
    c.stroke();
  }

  SB.buildStatic = function (L) {
    const cv = document.createElement('canvas');
    cv.width = L.w * T;
    cv.height = L.h * T;
    const c = cv.getContext('2d');
    const th = L.theme;
    const at = (x, y) => SB.tileAt(L, x, y);
    const isW = (x, y) => { const t = at(x, y); return t === '#' || t === 'E'; };

    // rug map (furniture sitting on a rug keeps the rug underneath)
    const rug = [];
    for (let y = 0; y < L.h; y++) { rug.push([]); for (let x = 0; x < L.w; x++) rug[y].push(at(x, y) === ','); }
    const isRug = (x, y) => y >= 0 && x >= 0 && y < L.h && x < L.w && rug[y][x];
    const base = rug.map((r) => r.slice());
    for (let y = 0; y < L.h; y++)
      for (let x = 0; x < L.w; x++) {
        const ch = at(x, y);
        if ('TBSKH'.indexOf(ch) < 0) continue;
        let n = 0;
        if (y > 0 && base[y - 1][x]) n++;
        if (y < L.h - 1 && base[y + 1][x]) n++;
        if (x > 0 && base[y][x - 1]) n++;
        if (x < L.w - 1 && base[y][x + 1]) n++;
        if (n >= 2) rug[y][x] = true;
      }

    for (let y = 0; y < L.h; y++)
      for (let x = 0; x < L.w; x++) {
        if (isW(x, y)) continue;
        floorTile(c, x, y, th);
        if (isRug(x, y)) rugTile(c, x, y, th, isRug);
      }

    // shadows cast by walls / cabinets
    for (let y = 0; y < L.h; y++)
      for (let x = 0; x < L.w; x++) {
        if (isW(x, y)) continue;
        const px = x * T, py = y * T;
        const up = isW(x, y - 1) || at(x, y - 1) === 'K';
        const left = isW(x - 1, y) || at(x - 1, y) === 'K';
        if (up) {
          const g = c.createLinearGradient(0, py, 0, py + 16);
          g.addColorStop(0, 'rgba(0,0,0,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.fillRect(px, py, T, 16);
        }
        if (left) {
          const g = c.createLinearGradient(px, 0, px + 10, 0);
          g.addColorStop(0, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.fillRect(px, py, 10, T);
        }
      }

    // furniture drop shadows
    c.fillStyle = 'rgba(0,0,0,.26)';
    for (let y = 0; y < L.h; y++)
      for (let x = 0; x < L.w; x++) {
        const ch = at(x, y);
        if ('TBSK'.indexOf(ch) >= 0) c.fillRect(x * T + 3, y * T + 5, T, T);
      }
    L.hides.forEach((h) => ell(c, (h.x + 0.5) * T + 2, (h.y + 0.5) * T + 8, 15, 8, 'rgba(0,0,0,.22)'));
    // re-lay tiles under shadows' overlap so shadow only falls on floor
    for (let y = 0; y < L.h; y++)
      for (let x = 0; x < L.w; x++) {
        const ch = at(x, y);
        if ('TBSK'.indexOf(ch) >= 0) {
          const px = x * T, py = y * T;
          c.fillStyle = th.floor[(x + y) & 1];
          c.fillRect(px, py, T, T);
          if (isRug(x, y)) rugTile(c, x, y, th, isRug);
        }
      }

    const same = (ch) => (x, y) => at(x, y) === ch;
    function block(x, y, ch, fill, edge) {
      const px = x * T, py = y * T, s = same(ch);
      const l = s(x - 1, y) ? 0 : 2, r = s(x + 1, y) ? 0 : 2, t = s(x, y - 1) ? 0 : 2, b = s(x, y + 1) ? 0 : 2;
      c.fillStyle = fill;
      c.fillRect(px + l, py + t, T - l - r, T - t - b);
      c.fillStyle = edge;
      if (!l) {} else c.fillRect(px + l, py + t, 2, T - t - b);
      if (r) c.fillRect(px + T - r - 2, py + t, 2, T - t - b);
      if (t) c.fillRect(px + l, py + t, T - l - r, 2);
      if (b) c.fillRect(px + l, py + T - b - 3, T - l - r, 3);
      return { l, r, t, b, px, py };
    }

    for (let y = 0; y < L.h; y++)
      for (let x = 0; x < L.w; x++) {
        const ch = at(x, y);
        const px = x * T, py = y * T;
        if (ch === 'T') {
          const top = th.table;
          block(x, y, 'T', top, th.tableEdge || shade(top, -45));
          c.fillStyle = 'rgba(255,255,255,.14)';
          c.fillRect(px + 5, py + 5, T - 10, 3);
          const r = rnd(x, y, 21);
          if (r > 0.72) { ell(c, px + 20, py + 17, 5, 5, '#f4f1ea'); ell(c, px + 20, py + 17, 3, 3, '#6b4a2a'); }
          else if (r > 0.5) { c.save(); c.translate(px + 18, py + 18); c.rotate(r); c.fillStyle = '#f7f5ee'; c.fillRect(-7, -5, 14, 10); c.fillStyle = '#9aa'; c.fillRect(-5, -2, 10, 1); c.fillRect(-5, 1, 7, 1); c.restore(); }
        } else if (ch === 'B') {
          block(x, y, 'B', th.frame, shade(th.frame, -30));
          const s = same('B');
          const up = s(x, y - 1);
          c.fillStyle = up ? th.blanket : th.bed;
          c.fillRect(px + 4, py + (up ? 0 : 4), T - 8, up ? T - 4 : T - 4);
          if (!up) {
            rr(c, px + 7, py + 7, T - 14, 11, 4); c.fillStyle = '#ffffff'; c.fill();
            c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; c.stroke();
          } else {
            c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(px + 4, py + 5, T - 8, 3);
          }
        } else if (ch === 'S') {
          const s = same('S');
          block(x, y, 'S', th.sofa, shade(th.sofa, -40));
          c.fillStyle = shade(th.sofa, -25);
          if (!s(x, y - 1)) c.fillRect(px + 2, py + 2, T - 4, 9);
          if (!s(x - 1, y)) c.fillRect(px + 2, py + 2, 6, T - 4);
          if (!s(x + 1, y)) c.fillRect(px + T - 8, py + 2, 6, T - 4);
          c.fillStyle = 'rgba(255,255,255,.14)';
          c.fillRect(px + 10, py + 14, T - 20, 3);
        } else if (ch === 'K') {
          const fh = 9;
          c.fillStyle = th.cab; c.fillRect(px, py, T, T - fh);
          c.fillStyle = shade(th.cab, -35); c.fillRect(px, py + T - fh, T, fh);
          c.fillStyle = shade(th.cab, 22); c.fillRect(px, py, T, 2); c.fillRect(px, py, 2, T - fh);
          c.strokeStyle = shade(th.cab, -22); c.lineWidth = 1.5;
          c.strokeRect(px + 6, py + 5, T - 12, T - fh - 11);
          c.beginPath(); c.moveTo(px + T / 2, py + 5); c.lineTo(px + T / 2, py + T - fh - 6); c.stroke();
          ell(c, px + T / 2 - 4, py + T - fh + 4, 1.8, 1.8, '#e8c36a');
          ell(c, px + T / 2 + 4, py + T - fh + 4, 1.8, 1.8, '#e8c36a');
        }
      }

    // walls
    for (let y = 0; y < L.h; y++)
      for (let x = 0; x < L.w; x++) {
        if (!isW(x, y)) continue;
        const px = x * T, py = y * T;
        const below = isW(x, y + 1);
        const fh = below ? 0 : 10;
        c.fillStyle = th.wall;
        c.fillRect(px, py, T, T - fh);
        c.fillStyle = 'rgba(255,255,255,.05)';
        c.fillRect(px, py + 8, T, 1);
        c.fillRect(px, py + 22, T, 1);
        if (!isW(x, y - 1)) { c.fillStyle = th.wallHi; c.fillRect(px, py, T, 3); }
        if (!isW(x - 1, y)) { c.fillStyle = th.wallHi; c.globalAlpha = 0.5; c.fillRect(px, py, 2, T - fh); c.globalAlpha = 1; }
        if (!isW(x + 1, y)) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(px + T - 2, py, 2, T - fh); }
        if (fh) {
          c.fillStyle = th.wallFace;
          c.fillRect(px, py + T - fh, T, fh);
          c.fillStyle = 'rgba(255,255,255,.1)';
          c.fillRect(px, py + T - fh, T, 1);
          c.fillStyle = 'rgba(0,0,0,.25)';
          c.fillRect(px, py + T - 3, T, 3);
        }
      }
    return cv;
  };

  /* ---------------- sprites ---------------- */
  const DEFAULT_LOOK = { shirt: '#2a2d43', stripe: '#eef0f6', skin: '#f1c9a0', cap: '#16161f' };
  function drawThiefSprite(c, p, t, carried) {
    let look = p.look || DEFAULT_LOOK;
    const disguised = p.disguiseT > 0;
    if (disguised) look = { shirt: '#2f6fb0', stripe: '#2f6fb0', skin: look.skin, cap: '#244f80' };
    c.save();
    c.translate(p.x, p.y);
    ell(c, 0, 4, 12, 8, 'rgba(0,0,0,.3)');
    if (p.shoesT > 0) {
      c.globalAlpha = 0.5 + Math.sin(t * 8) * 0.15;
      ell(c, 0, 5, 14, 9, 'rgba(120,200,255,.5)');
      c.globalAlpha = 1;
    }
    c.rotate(p.angle);
    if (p.sneaking) c.scale(1, 0.88);
    const sw = Math.sin(p.walk * 0.22) * 3.5;
    ell(c, sw, -5, 5, 3.4, p.shoesT > 0 ? '#5aa8e8' : '#1d1d28');
    ell(c, -sw, 5, 5, 3.4, p.shoesT > 0 ? '#5aa8e8' : '#1d1d28');
    if (carried > 0) {
      const sr = 6 + Math.min(carried, 4) * 0.8;
      ell(c, -10, 0, sr, sr * 0.9, '#8a5a2b');
      ell(c, -10 + 2, -2, sr * 0.45, sr * 0.35, 'rgba(255,255,255,.18)');
      c.fillStyle = '#5c3a18';
      c.beginPath(); c.arc(-10 - sr + 1, 0, 2.2, 0, TAU); c.fill();
    }
    ell(c, 2, -10, 4.2, 3, look.skin);
    ell(c, 2, 10, 4.2, 3, look.skin);
    c.save();
    c.beginPath(); c.ellipse(0, 0, 8.5, 11, 0, 0, TAU); c.clip();
    c.fillStyle = look.shirt; c.fillRect(-12, -12, 24, 24);
    c.fillStyle = look.stripe;
    for (let i = -3; i <= 3; i++) c.fillRect(i * 4 - 1, -12, 2.2, 24);
    c.restore();
    ell(c, 2, 0, 7.2, 7.2, look.skin);
    c.fillStyle = look.cap;
    c.beginPath(); c.arc(2, 0, 7.8, Math.PI * 0.58, Math.PI * 1.42); c.closePath(); c.fill();
    if (disguised) {
      ell(c, 8.5, 0, 3.4, 6.2, '#1a3a60');
      c.fillStyle = '#e8c36a';
      c.beginPath(); c.arc(2, 0, 7.8, -0.5, 0.5); c.lineTo(2, 0); c.closePath(); c.fill();
    } else {
      c.fillRect(3.5, -7.2, 4.8, 14.4);
      ell(c, 7.4, -3.2, 1.9, 1.9, '#fff');
      ell(c, 7.4, 3.2, 1.9, 1.9, '#fff');
      ell(c, 8, -3.2, 0.9, 0.9, '#111');
      ell(c, 8, 3.2, 0.9, 0.9, '#111');
    }
    c.restore();
  }
  SB.drawThiefSprite = drawThiefSprite;

  function drawDogSprite(c, g, t) {
    c.save();
    c.translate(g.x, g.y);
    ell(c, 0, 4, 14, 8, 'rgba(0,0,0,.3)');
    c.rotate(g.angle);
    const sw = g.moving ? Math.sin(g.walk * 0.3) * 4 : 0;
    ell(c, 6 + sw, -6, 3.4, 2.4, '#5a3a22');
    ell(c, 6 - sw, 6, 3.4, 2.4, '#5a3a22');
    ell(c, -7 - sw, -6, 3.4, 2.4, '#5a3a22');
    ell(c, -7 + sw, 6, 3.4, 2.4, '#5a3a22');
    const wag = Math.sin(t * 12) * 3;
    c.strokeStyle = '#7a4e2c'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-12, 0); c.quadraticCurveTo(-17, wag, -19, wag * 1.4); c.stroke();
    ell(c, -1, 0, 12, 7, '#8a5a34');
    ell(c, -3, 0, 6, 4, '#a06a3e');
    ell(c, 8, 0, 3, 7.4, '#d33');
    ell(c, 11, 0, 6, 5.4, '#9a6638');
    ell(c, 15.5, 0, 3, 2.4, '#d9b48a');
    ell(c, 17.5, 0, 1.6, 1.4, '#111');
    ell(c, 11, -4.8, 2.6, 2, '#5a3a22');
    ell(c, 11, 4.8, 2.6, 2, '#5a3a22');
    ell(c, 13.2, -2.4, 1, 1, '#111');
    ell(c, 13.2, 2.4, 1, 1, '#111');
    c.restore();
  }

  const UNI = {
    guard: { body: '#2f6fb0', cap: '#244f80', band: '#e8c36a' },
    cop: { body: '#27324a', cap: '#1c2336', band: '#e24b4a' },
    sentinel: { body: '#3d8a5a', cap: '#2a6240', band: '#e8c36a' },
    sleeper: { body: '#7a6a9a', cap: '#524470', band: '#c9b8e8' },
  };
  function drawGuardSprite(c, g, t) {
    if (g.type === 'dog') { drawDogSprite(c, g, t); return; }
    const u = UNI[g.type] || UNI.guard;
    c.save();
    c.translate(g.x, g.y);
    ell(c, 0, 4, 13, 9, 'rgba(0,0,0,.3)');
    c.rotate(g.angle);
    const sw = g.moving ? Math.sin(g.walk * 0.2) * 3.5 : 0;
    ell(c, sw, -5.5, 5.5, 3.6, '#14141c');
    ell(c, -sw, 5.5, 5.5, 3.6, '#14141c');
    ell(c, 1, 0, 8.5, 12.5, u.body);
    c.fillStyle = 'rgba(255,255,255,.12)';
    c.fillRect(-4, -12, 2.5, 24);
    ell(c, -1, 0, 3.5, 12, 'rgba(0,0,0,.14)');
    ell(c, 3, -11.5, 4.4, 3.2, u.body);
    ell(c, 6.5, -11.5, 2.6, 2.2, '#f1c9a0');
    ell(c, 3, 11.5, 4.4, 3.2, u.body);
    ell(c, 6.5, 11.5, 2.6, 2.2, '#f1c9a0');
    c.fillStyle = '#23232d';
    c.fillRect(7, 9.5, 9, 4);
    ell(c, 16, 11.5, 2.4, 2.4, '#fff3b0');
    ell(c, 2, 0, 7.4, 7.4, '#f1c9a0');
    ell(c, 1, 0, 8, 8, u.cap);
    c.fillStyle = u.band;
    c.beginPath(); c.arc(1, 0, 8, -0.6, 0.6); c.lineTo(1, 0); c.closePath(); c.fill();
    ell(c, 8.5, 0, 3.6, 6.4, shade(u.cap.length === 7 ? u.cap : '#244f80', -20));
    c.fillStyle = u.band;
    ell(c, -1, 0, 1.8, 1.8, u.band);
    c.restore();
  }

  function bubble(c, x, y, txt, col, prog) {
    c.save();
    c.translate(x, y);
    if (prog > 0 && prog < 1) {
      c.strokeStyle = col; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.arc(0, 0, 11, -Math.PI / 2, -Math.PI / 2 + TAU * prog); c.stroke();
    }
    ell(c, 0, 0, 9, 9, '#fff');
    c.fillStyle = col;
    c.font = '700 14px ' + FONT;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(txt, 0, 1);
    c.restore();
  }

  function radioWaves(c, x, y, t, a) {
    c.save();
    c.strokeStyle = 'rgba(80,220,255,' + Math.min(1, a) + ')';
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const r = 6 + ((t * 18 + i * 7) % 21);
      c.globalAlpha = Math.min(1, a) * (1 - (r - 6) / 21);
      c.beginPath(); c.arc(x, y, r, -2.4, -0.74); c.stroke();
    }
    c.restore();
  }

  /* ---------------- cones ---------------- */
  function cone(c, L, g, range, fov, rgb, alpha) {
    const n = 34;
    c.beginPath();
    c.moveTo(g.x, g.y);
    for (let i = 0; i <= n; i++) {
      const a = g.angle - fov / 2 + (fov * i) / n;
      const d = SB.rayDist(L, g.x, g.y, a, range);
      c.lineTo(g.x + Math.cos(a) * d, g.y + Math.sin(a) * d);
    }
    c.closePath();
    const gr = c.createRadialGradient(g.x, g.y, 4, g.x, g.y, range);
    gr.addColorStop(0, 'rgba(' + rgb + ',' + alpha + ')');
    gr.addColorStop(0.7, 'rgba(' + rgb + ',' + alpha * 0.55 + ')');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    c.fillStyle = gr;
    c.fill();
  }

  /* ---------------- loot / exit ---------------- */
  function drawLoot(c, l, t, idx) {
    const kind = idx % 3;
    const bob = Math.sin(t * 3 + idx) * 2;
    const x = l.x, y = l.y;
    const gl = c.createRadialGradient(x, y, 2, x, y, 26);
    const pulse = 0.38 + Math.sin(t * 4 + idx) * 0.12;
    gl.addColorStop(0, 'rgba(255,220,100,' + pulse + ')');
    gl.addColorStop(1, 'rgba(255,220,100,0)');
    c.fillStyle = gl;
    c.fillRect(x - 28, y - 28, 56, 56);
    ell(c, x, y + 9, 9, 3.5, 'rgba(0,0,0,.28)');
    c.save();
    c.translate(x, y + bob - 2);
    if (kind === 0) {
      ell(c, 0, 3, 9, 8.5, '#9b6a34');
      ell(c, -2.5, 0, 4, 5, 'rgba(255,255,255,.15)');
      c.fillStyle = '#5c3a18';
      c.beginPath(); c.moveTo(-4, -4); c.lineTo(0, -9); c.lineTo(4, -4); c.closePath(); c.fill();
      c.fillStyle = '#e8c36a'; c.fillRect(-4.5, -5, 9, 2.2);
      c.fillStyle = '#fff4c8'; c.font = '700 10px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('$', 0, 4);
    } else if (kind === 1) {
      c.fillStyle = '#4fd8f2';
      c.beginPath(); c.moveTo(0, -9); c.lineTo(8.5, -2.5); c.lineTo(0, 9); c.lineTo(-8.5, -2.5); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.55)';
      c.beginPath(); c.moveTo(0, -9); c.lineTo(-4, -2.5); c.lineTo(0, 2); c.lineTo(4, -2.5); c.closePath(); c.fill();
      c.strokeStyle = '#1b7a96'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-8.5, -2.5); c.lineTo(8.5, -2.5); c.moveTo(-4, -2.5); c.lineTo(0, 9); c.lineTo(4, -2.5); c.stroke();
    } else {
      [[-5, 4], [5, 4], [0, -3]].forEach((q) => {
        c.fillStyle = '#f4c12d';
        c.beginPath(); c.moveTo(q[0] - 6, q[1] + 4); c.lineTo(q[0] - 4, q[1] - 3); c.lineTo(q[0] + 4, q[1] - 3); c.lineTo(q[0] + 6, q[1] + 4); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(q[0] - 3, q[1] - 2, 6, 1.6);
      });
    }
    c.restore();
    const ph = (t * 1.3 + idx * 0.37) % 1;
    if (ph < 0.5) {
      const s = Math.sin(ph * Math.PI * 2) * 5;
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(x + 7 - s, y - 9 + bob); c.lineTo(x + 7 + s, y - 9 + bob);
      c.moveTo(x + 7, y - 9 - s + bob); c.lineTo(x + 7, y - 9 + s + bob);
      c.stroke();
    }
  }

  function exitDir(L) {
    const e = L.exit;
    if (e.x === 0) return [1, 0];
    if (e.x === L.w - 1) return [-1, 0];
    if (e.y === 0) return [0, 1];
    return [0, -1];
  }
  function drawExit(c, G) {
    const L = G.level, e = L.exit, t = G.t;
    const open = G.loot.every((l) => l.got);
    const [ix, iy] = exitDir(L);
    const px = e.x * T, py = e.y * T, cx = px + T / 2, cy = py + T / 2;
    if (open) {
      const gx = cx + ix * T * 0.9, gy = cy + iy * T * 0.9;
      const gr = c.createRadialGradient(gx, gy, 2, gx, gy, 52);
      gr.addColorStop(0, 'rgba(70,255,150,' + (0.35 + Math.sin(t * 4) * 0.1) + ')');
      gr.addColorStop(1, 'rgba(70,255,150,0)');
      c.fillStyle = gr;
      c.fillRect(gx - 54, gy - 54, 108, 108);
    }
    c.fillStyle = '#2a1b14'; c.fillRect(px, py, T, T);
    c.fillStyle = open ? '#2fa36b' : '#8c2f39';
    c.fillRect(px + 3, py + 3, T - 6, T - 6);
    c.fillStyle = 'rgba(255,255,255,.18)';
    c.fillRect(px + 3, py + 3, T - 6, 4);
    c.fillStyle = 'rgba(0,0,0,.22)';
    c.fillRect(px + T / 2 - 1, py + 3, 2, T - 6);
    c.fillStyle = '#fff';
    c.font = '700 9px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(open ? 'EXIT' : 'LOCK', cx, cy);
    if (open) {
      for (let k = 0; k < 2; k++) {
        const off = ((t * 1.6 + k * 0.5) % 1);
        const ax = cx + ix * (T * 0.6 + (1 - off) * T * 0.9), ay = cy + iy * (T * 0.6 + (1 - off) * T * 0.9);
        c.save();
        c.translate(ax, ay);
        c.rotate(Math.atan2(-iy, -ix));
        c.globalAlpha = Math.sin(off * Math.PI);
        c.fillStyle = '#6dffb0';
        c.beginPath(); c.moveTo(7, 0); c.lineTo(-4, -7); c.lineTo(-1, 0); c.lineTo(-4, 7); c.closePath(); c.fill();
        c.restore();
      }
    }
  }

  function drawPlant(c, h, t, covering) {
    const cx = (h.x + 0.5) * T, cy = (h.y + 0.5) * T;
    c.save();
    c.translate(cx, cy + 1);
    const sway = Math.sin(t * 1.4 + h.x * 2) * 0.05;
    c.rotate(sway);
    ell(c, 0, 6, 8, 5, '#7a4a2a');
    ell(c, 0, 4, 8, 4, '#a0643a');
    const leaves = 9;
    for (let i = 0; i < leaves; i++) {
      const a = (i / leaves) * TAU + 0.3;
      const r = 11 + (i % 2) * 3;
      c.save();
      c.rotate(a);
      c.fillStyle = i % 2 ? '#2f9a4f' : '#43b862';
      c.beginPath(); c.ellipse(r * 0.62, 0, r * 0.62, 5, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(0,60,20,.28)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(1, 0); c.lineTo(r * 1.2, 0); c.stroke();
      c.restore();
    }
    ell(c, 0, 0, 4, 4, '#1f7a3c');
    c.restore();
    if (covering) {
      c.save();
      c.translate(cx, cy + 1);
      c.globalAlpha = 0.5;
      for (let i = 0; i < 6; i++) {
        c.save(); c.rotate(i * 1.05 + 0.5 + sway);
        c.fillStyle = i % 2 ? '#2f9a4f' : '#43b862';
        c.beginPath(); c.ellipse(8, 0, 9, 4.5, 0, 0, TAU); c.fill();
        c.restore();
      }
      c.restore();
    }
  }

  /* ---------------- AI view ---------------- */
  const STCOL = SB.STATE_COLORS = {
    patrol: '#7fd1ff', investigate: '#ffd24a', search: '#ffa24a', chase: '#ff5a55', return: '#9be37a',
    sentinel: '#c79bff', asleep: '#9be8b0', napping: '#b8a9e0', track: '#e8a070',
  };
  function drawAI(c, G) {
    const t = SB.t;
    // radio coverage of every guard that can talk
    G.guards.forEach((g) => {
      if (g.reactive || g.state === 'asleep') return;
      c.strokeStyle = 'rgba(80,220,255,.16)'; c.lineWidth = 1.5; c.setLineDash([4, 6]);
      c.beginPath(); c.arc(g.x, g.y, SB.RADIO_RANGE, 0, TAU); c.stroke(); c.setLineDash([]);
    });
    // what the guards have learned about the thief's favourite hiding places
    G.level.hides.forEach((h) => {
      const n = G.memory.hide[h.x + ',' + h.y] || 0;
      if (!n) return;
      const x = (h.x + 0.5) * T, y = (h.y + 0.5) * T - 20;
      ell(c, x, y, 10, 10, n >= 2 ? '#ff5a55' : '#ffd24a');
      c.fillStyle = '#1a1020'; c.font = '700 12px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(n), x, y + 1);
    });
    G.cams.forEach((cam) => {
      const txt = t('ai.camera') + (cam.cd > 0 ? ' (' + t('ai.alarm') + ')' : cam.meter > 0.05 ? ' ' + Math.round(cam.meter * 100) + '%' : '');
      c.font = '500 11px ' + FONT;
      const w = c.measureText(txt).width + 12;
      rr(c, cam.x - w / 2, cam.y + 12, w, 16, 8);
      c.fillStyle = 'rgba(10,12,28,.82)'; c.fill();
      c.strokeStyle = '#ff7a85'; c.lineWidth = 1; c.stroke();
      c.fillStyle = '#ff9aa4'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(txt, cam.x, cam.y + 20);
    });
    G.guards.forEach((g) => {
      const col = STCOL[g.state] || '#fff';
      if (g.path && g.path.length) {
        c.strokeStyle = col; c.lineWidth = 2; c.setLineDash([5, 5]); c.globalAlpha = 0.9;
        c.beginPath(); c.moveTo(g.x, g.y);
        g.path.forEach((p) => c.lineTo(p.x, p.y));
        c.stroke();
        c.setLineDash([]); c.globalAlpha = 1;
        const e = g.path[g.path.length - 1];
        c.strokeStyle = col; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(e.x - 5, e.y - 5); c.lineTo(e.x + 5, e.y + 5); c.moveTo(e.x + 5, e.y - 5); c.lineTo(e.x - 5, e.y + 5); c.stroke();
      }
      if (g.state === 'search') {
        g.searchPts.forEach((q, i) => {
          c.strokeStyle = col; c.lineWidth = 1.5;
          c.beginPath(); c.arc(q.x, q.y, 8, 0, TAU); c.stroke();
          c.fillStyle = col; c.font = '700 10px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(String(i + 1), q.x, q.y + 1);
        });
      }
      if (g.lastSeen && (g.state === 'chase' || g.state === 'search')) {
        c.strokeStyle = 'rgba(255,90,85,.8)'; c.lineWidth = 1.5; c.setLineDash([3, 4]);
        c.beginPath(); c.arc(g.lastSeen.x, g.lastSeen.y, 12, 0, TAU); c.stroke(); c.setLineDash([]);
      }
      const base = g.state === 'investigate' && g.reason === 'hide' ? t('ai.hidecheck') : t('state.' + g.state);
      const txt = '#' + (g.id + 1) + (g.reactive ? ' R' : ' D') + ' ' + base + (g.meter > 0.05 && g.state !== 'chase' ? ' ' + Math.round(g.meter * 100) + '%' : '');
      c.font = '500 11px ' + FONT;
      const w = c.measureText(txt).width + 12;
      rr(c, g.x - w / 2, g.y + 17, w, 17, 8);
      c.fillStyle = 'rgba(10,12,28,.82)'; c.fill();
      c.strokeStyle = col; c.lineWidth = 1; c.stroke();
      c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(txt, g.x, g.y + 26);
    });
  }

  /* ---------------- cameras / lasers / items ---------------- */
  function drawCamera(c, cam, t) {
    c.save();
    c.translate(cam.x, cam.y);
    ell(c, 0, 0, 9, 9, 'rgba(0,0,0,.28)');
    c.rotate(cam.angle);
    c.fillStyle = '#272b36';
    rr(c, -8, -5, 16, 10, 3); c.fill();
    c.fillStyle = '#3d4352'; c.fillRect(-8, -5, 16, 3);
    ell(c, 8, 0, 3.6, 3.6, '#10131a');
    ell(c, 8, 0, 2, 2, cam.cd > 0 ? '#ff5560' : '#5ac8ff');
    c.restore();
    const blink = cam.cd > 0 ? Math.sin(t * 16) > 0 : Math.sin(t * 3 + cam.ph) > 0.7;
    ell(c, cam.x, cam.y - 8, 2.3, 2.3, blink ? '#ff3b4a' : '#5a1820');
  }

  function drawLaser(c, l, t) {
    c.save();
    c.lineCap = 'round';
    if (l.active) {
      c.strokeStyle = 'rgba(255,60,90,.28)'; c.lineWidth = 11;
      c.beginPath(); c.moveTo(l.ax, l.ay); c.lineTo(l.bx, l.by); c.stroke();
      c.strokeStyle = '#ff4466'; c.lineWidth = 3.5;
      c.beginPath(); c.moveTo(l.ax, l.ay); c.lineTo(l.bx, l.by); c.stroke();
      c.strokeStyle = '#ffd6de'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(l.ax, l.ay); c.lineTo(l.bx, l.by); c.stroke();
    } else if (l.warn) {
      c.strokeStyle = 'rgba(255,120,140,' + (Math.sin(t * 36) > 0 ? 0.6 : 0.15) + ')';
      c.lineWidth = 2; c.setLineDash([4, 5]);
      c.beginPath(); c.moveTo(l.ax, l.ay); c.lineTo(l.bx, l.by); c.stroke();
    } else {
      c.strokeStyle = 'rgba(255,110,130,.17)'; c.lineWidth = 1; c.setLineDash([3, 7]);
      c.beginPath(); c.moveTo(l.ax, l.ay); c.lineTo(l.bx, l.by); c.stroke();
    }
    c.setLineDash([]);
    [[l.ax, l.ay], [l.bx, l.by]].forEach((p) => {
      ell(c, p[0], p[1], 6, 6, '#20242e');
      ell(c, p[0], p[1], 3, 3, l.active ? '#ff4466' : l.warn ? '#ff9aa8' : '#6a2a36');
    });
    c.restore();
  }

  function drawKey(c, k, t, idx) {
    const bob = Math.sin(t * 3 + idx) * 2;
    const gl = c.createRadialGradient(k.x, k.y, 2, k.x, k.y, 24);
    gl.addColorStop(0, 'rgba(120,230,255,.4)'); gl.addColorStop(1, 'rgba(120,230,255,0)');
    c.fillStyle = gl; c.fillRect(k.x - 26, k.y - 26, 52, 52);
    ell(c, k.x, k.y + 9, 8, 3, 'rgba(0,0,0,.28)');
    c.save();
    c.translate(k.x, k.y + bob);
    c.rotate(-0.6);
    c.strokeStyle = '#f4c12d'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.arc(-6, 0, 4.5, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(-1.5, 0); c.lineTo(9, 0); c.moveTo(6, 0); c.lineTo(6, 4); c.moveTo(9, 0); c.lineTo(9, 3.5); c.stroke();
    c.restore();
  }

  function drawDoor(c, d, t) {
    const px = d.x * T, py = d.y * T;
    c.fillStyle = '#2a1b10'; c.fillRect(px, py, T, T);
    c.fillStyle = '#7a4a28'; c.fillRect(px + 2, py + 2, T - 4, T - 4);
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(px + 2, py + 2, T - 4, 4);
    c.strokeStyle = '#4a2c16'; c.lineWidth = 2;
    c.strokeRect(px + 6, py + 6, T - 12, T - 12);
    c.fillStyle = '#9aa3ad'; c.fillRect(px + 2, py + T / 2 - 3, T - 4, 6);
    ell(c, px + T / 2, py + T / 2, 6.5, 6.5, '#f4c12d');
    ell(c, px + T / 2, py + T / 2, 2, 2, '#4a2c16');
    c.fillStyle = '#4a2c16'; c.fillRect(px + T / 2 - 1, py + T / 2, 2, 5);
  }

  function drawGas(c, q, t) {
    const fade = Math.min(1, (q.dur - q.t) / 1.0);
    const rad = q.r * Math.min(1, 0.35 + q.t / 0.5);
    c.save();
    c.globalAlpha = fade;
    const gr = c.createRadialGradient(q.x, q.y, 4, q.x, q.y, rad);
    gr.addColorStop(0, 'rgba(140,240,180,.5)');
    gr.addColorStop(1, 'rgba(140,240,180,0)');
    c.fillStyle = gr;
    c.fillRect(q.x - rad, q.y - rad, rad * 2, rad * 2);
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + t * 0.6, d = rad * (0.35 + 0.25 * Math.sin(t * 1.3 + i));
      c.fillStyle = 'rgba(170,255,200,.22)';
      c.beginPath(); c.arc(q.x + Math.cos(a) * d, q.y + Math.sin(a) * d, rad * 0.28, 0, TAU); c.fill();
    }
    c.restore();
  }

  function drawDecoy(c, q, t) {
    const pulse = (t * 2) % 1;
    c.save();
    c.strokeStyle = 'rgba(120,255,200,' + (1 - pulse) * 0.7 + ')';
    c.lineWidth = 2;
    c.beginPath(); c.arc(q.x, q.y, 8 + pulse * 22, 0, TAU); c.stroke();
    ell(c, q.x, q.y + 5, 7, 3, 'rgba(0,0,0,.3)');
    ell(c, q.x, q.y, 7, 7, '#f2c14e');
    ell(c, q.x - 2, q.y - 2, 2.6, 2.2, 'rgba(255,255,255,.7)');
    c.fillStyle = '#8a5a10';
    c.fillRect(q.x - 1, q.y - 10, 2, 4);
    c.restore();
  }

  /* ---------------- main frame ---------------- */
  let vignette = null;
  function getVignette() {
    if (vignette) return vignette;
    vignette = document.createElement('canvas');
    vignette.width = SB.W; vignette.height = SB.H;
    const c = vignette.getContext('2d');
    const g = c.createRadialGradient(SB.W / 2, SB.H / 2, SB.H * 0.45, SB.W / 2, SB.H / 2, SB.W * 0.62);
    g.addColorStop(0, 'rgba(0,0,10,0)');
    g.addColorStop(1, 'rgba(0,0,14,.5)');
    c.fillStyle = g; c.fillRect(0, 0, SB.W, SB.H);
    return vignette;
  }

  SB.drawFrame = function (c, G) {
    const L = G.level, th = L.theme, t = G.t, p = G.player;
    c.save();
    if (G.shake > 0) c.translate((Math.random() - 0.5) * G.shake * 14, (Math.random() - 0.5) * G.shake * 14);
    c.clearRect(0, 0, SB.W, SB.H);
    c.drawImage(G.staticCv, 0, 0);
    c.textBaseline = 'alphabetic';
    drawExit(c, G);
    G.loot.forEach((l, i) => { if (!l.got) drawLoot(c, l, t, i); });
    G.keyItems.forEach((k, i) => { if (!k.got) drawKey(c, k, t, i); });
    L.locks.forEach((d) => { if (!L.opened[d.x + ',' + d.y]) drawDoor(c, d, t); });

    G.cams.forEach((cam) => drawCamera(c, cam, t));
    const ents = G.guards.map((g) => ({
      y: g.y,
      f: () => {
        if (g.state === 'asleep') c.globalAlpha = 0.72;
        drawGuardSprite(c, g, t);
        c.globalAlpha = 1;
      },
    }));
    ents.push({
      y: p.y,
      f: () => {
        if (p.hidden) c.globalAlpha = 0.6;
        drawThiefSprite(c, p, t, G.carried);
        c.globalAlpha = 1;
      },
    });
    ents.sort((a, b) => a.y - b.y).forEach((e) => e.f());

    L.hides.forEach((h) => {
      const covering = p.hidden && Math.floor(p.x / T) === h.x && Math.floor(p.y / T) === h.y;
      drawPlant(c, h, t, covering);
    });

    // night tint
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = th.night;
    c.fillRect(0, 0, SB.W, SB.H);
    c.globalCompositeOperation = 'source-over';

    // flashlight cones
    c.globalCompositeOperation = 'lighter';
    G.cams.forEach((cam) => {
      if (cam.cd > 0) cone(c, L, cam, cam.range, cam.fov, '255,40,40', 0.1 + (Math.sin(t * 14) > 0 ? 0.12 : 0));
      else cone(c, L, cam, cam.range, cam.fov, cam.meter > 0.1 ? '255,120,60' : '255,70,90', 0.2 + cam.meter * 0.15);
    });
    G.guards.forEach((g) => {
      if (g.state === 'asleep' || g.state === 'napping') return;
      const range = g.rangeNow(G);
      let rgb = '255,240,170', a = 0.32;
      if (g.type === 'dog') { rgb = '255,200,150'; a = 0.22; }
      if (g.state === 'chase') { rgb = '255,90,80'; a = 0.38; }
      else if (g.state === 'search') { rgb = '255,150,70'; a = 0.34; }
      else if (g.meter > 0.18) { rgb = '255,200,80'; a = 0.36; }
      cone(c, L, g, range, g.fov, rgb, a);
      const gl = c.createRadialGradient(g.x, g.y, 2, g.x, g.y, 40);
      gl.addColorStop(0, 'rgba(' + rgb + ',.25)'); gl.addColorStop(1, 'rgba(' + rgb + ',0)');
      c.fillStyle = gl; c.fillRect(g.x - 40, g.y - 40, 80, 80);
    });
    c.globalCompositeOperation = 'source-over';
    c.drawImage(getVignette(), 0, 0);

    // fx
    G.fx.noise.forEach((n) => {
      const k = n.r / n.max;
      c.strokeStyle = n.color.replace('A', String(Math.max(0, (1 - k) * n.alpha)));
      c.lineWidth = n.kind === 'step' ? 1.5 : 3;
      c.beginPath(); c.arc(n.x, n.y, n.r, 0, TAU); c.stroke();
    });
    G.lasers.forEach((l) => drawLaser(c, l, t));
    G.gas.forEach((q) => drawGas(c, q, t));
    G.decoys.forEach((q) => drawDecoy(c, q, t));
    G.fx.rocks.forEach((r) => {
      const k = Math.min(1, r.t / r.dur);
      const x = r.x0 + (r.x1 - r.x0) * k, y = r.y0 + (r.y1 - r.y0) * k;
      const h = Math.sin(k * Math.PI) * 34;
      ell(c, x, y + 3, 4, 2, 'rgba(0,0,0,.35)');
      if (r.kind === 'sleep') { ell(c, x, y - h, 5, 5, '#6fe0a0'); ell(c, x - 1, y - h - 1, 2, 1.8, 'rgba(255,255,255,.7)'); }
      else if (r.kind === 'decoy') { ell(c, x, y - h, 5, 5, '#f2c14e'); ell(c, x - 1, y - h - 1, 2, 1.8, 'rgba(255,255,255,.7)'); }
      else { ell(c, x, y - h, 4.5, 4, '#9ea0a8'); ell(c, x - 1, y - h - 1, 2, 1.6, 'rgba(255,255,255,.5)'); }
    });
    G.fx.sparks.forEach((s) => {
      c.globalAlpha = Math.max(0, s.life);
      c.fillStyle = s.col;
      c.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    });
    c.globalAlpha = 1;

    // radio links
    G.fx.links.forEach((l) => {
      c.strokeStyle = 'rgba(80,220,255,' + Math.min(1, l.t) * 0.85 + ')';
      c.lineWidth = 2; c.setLineDash([6, 5]); c.lineDashOffset = -t * 30;
      c.beginPath(); c.moveTo(l.a.x, l.a.y - 4); c.lineTo(l.b.x, l.b.y - 4); c.stroke();
      c.setLineDash([]); c.lineDashOffset = 0;
    });

    // guard bubbles and meters
    G.guards.forEach((g) => {
      let sym = null, col = '#e3a21a', prog = 0;
      if (g.state === 'chase') { sym = '!'; col = '#e24b4a'; }
      else if (g.state === 'search') { sym = '?'; col = '#e3701a'; }
      else if (g.state === 'investigate') { sym = g.reason === 'hide' ? '●' : '?'; col = '#d39b0e'; }
      else if (g.state === 'track') { sym = '~'; col = '#c0703a'; }
      else if (g.meter > 0.1) { sym = '?'; col = '#d39b0e'; prog = g.meter; }
      if (sym) bubble(c, g.x, g.y - 26 + Math.sin(t * 6) * (g.state === 'chase' ? 1.5 : 0), sym, col, prog);
      if (g.state === 'asleep' || g.state === 'napping') {
        c.fillStyle = '#c8f0ff';
        c.font = '700 13px ' + FONT; c.textAlign = 'center';
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.8 + i * 0.33) % 1;
          c.globalAlpha = 1 - ph;
          c.fillText('z', g.x + 8 + i * 5, g.y - 14 - ph * 22);
        }
        c.globalAlpha = 1;
      }
      if (g.radioT > 0) radioWaves(c, g.x + 12, g.y - 20, t, g.radioT);
    });
    if (p.hidden) {
      c.font = '500 11px ' + FONT; c.textAlign = 'center';
      rr(c, p.x - 22, p.y - 32, 44, 16, 8); c.fillStyle = 'rgba(10,40,20,.8)'; c.fill();
      c.fillStyle = '#8bf2b0'; c.fillText(SB.t('hud.hidden'), p.x, p.y - 21);
    }
    if (p.disguiseT > 0 || p.shoesT > 0) {
      const lab = [];
      if (p.disguiseT > 0) lab.push('🎭 ' + Math.ceil(p.disguiseT));
      if (p.shoesT > 0) lab.push('👣 ' + Math.ceil(p.shoesT));
      c.font = '500 11px ' + FONT; c.textAlign = 'center';
      const txt = lab.join('  ');
      const w = c.measureText(txt).width + 14;
      rr(c, p.x - w / 2, p.y + 16, w, 16, 8); c.fillStyle = 'rgba(10,20,40,.8)'; c.fill();
      c.fillStyle = '#bfe3ff'; c.textBaseline = 'middle'; c.fillText(txt, p.x, p.y + 25); c.textBaseline = 'alphabetic';
    }

    // confetti and screen flash
    (G.fx.confetti || []).forEach((q) => {
      c.save();
      c.translate(q.x, q.y); c.rotate(q.rot);
      c.fillStyle = q.col; c.fillRect(-3, -2, 6, 4);
      c.restore();
    });
    if (G.flash && G.flash.t > 0) {
      c.fillStyle = G.flash.col.replace('A', String(Math.min(0.5, G.flash.t)));
      c.fillRect(0, 0, SB.W, SB.H);
    }

    // aim preview
    if (G.aim && G.items[G.tool] > 0 && G.state === 'play') {
      let dx = G.aim.x - p.x, dy = G.aim.y - p.y;
      let d = Math.hypot(dx, dy);
      if (d > 4) {
        const max = 250;
        if (d > max) { dx *= max / d; dy *= max / d; d = max; }
        let lx = p.x, ly = p.y;
        const n = Math.ceil(d / 4);
        for (let i = 1; i <= n; i++) {
          const nx = p.x + (dx * i) / n, ny = p.y + (dy * i) / n;
          if (SB.solidPx(L, nx, ny)) break;
          lx = nx; ly = ny;
        }
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.5; c.setLineDash([4, 6]);
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(lx, ly); c.stroke(); c.setLineDash([]);
        c.beginPath(); c.arc(lx, ly, 6 + Math.sin(t * 8) * 1.2, 0, TAU); c.stroke();
      }
    }

    if (G.ai) drawAI(c, G);
    c.restore();
  };

  /* ---------------- thumbnails / hero ---------------- */
  SB.thumb = function (L, canvas) {
    const c = canvas.getContext('2d');
    const st = SB.buildStatic(L);
    c.imageSmoothingQuality = 'high';
    c.drawImage(st, 0, 0, canvas.width, canvas.height);
    const sx = canvas.width / SB.W, sy = canvas.height / SB.H;
    L.loot.forEach((l) => {
      c.fillStyle = '#ffd24a';
      c.beginPath(); c.arc((l.tx + 0.5) * T * sx, (l.ty + 0.5) * T * sy, 3, 0, TAU); c.fill();
    });
    c.fillStyle = 'rgba(40,40,80,.18)';
    c.fillRect(0, 0, canvas.width, canvas.height);
  };

  SB.drawHero = function (c, w, h, t) {
    c.clearRect(0, 0, w, h);
    const th = { floor: ['#c99a62', '#c0915a'], seam: 'rgba(70,40,15,.45)', kind: 'wood' };
    for (let y = 0; y < Math.ceil(h / T); y++)
      for (let x = 0; x < Math.ceil(w / T); x++) {
        c.save(); c.translate(0, 0);
        floorTile(c, x, y, th);
        c.restore();
      }
    c.fillStyle = 'rgba(20,16,50,.35)'; c.fillRect(0, 0, w, h);
    const g = { x: w * 0.68, y: h * 0.55, angle: Math.PI + Math.sin(t * 0.9) * 0.55, type: 'guard', moving: false, walk: 0 };
    c.globalCompositeOperation = 'lighter';
    cone(c, null, g, 190, SB.FOV, '255,240,170', 0.4);
    c.globalCompositeOperation = 'source-over';
    drawGuardSprite(c, g, t);
    const k = (t * 0.35) % 1;
    const p = { x: 40 + k * (w * 0.5), y: h * 0.55 + Math.sin(k * 14) * 18, angle: 0, sneaking: true, walk: t * 30 };
    drawThiefSprite(c, p, t, 2);
  };
})();
