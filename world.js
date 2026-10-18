(function () {
  const SB = (window.SB = window.SB || {});
  const T = (SB.T = 36);
  SB.W = 26 * T;
  SB.H = 16 * T;

  const SOLID = '#KTBSED';
  const SIGHT = '#KED';

  // 'D' is a locked door: solid until the thief opens it with a key (L.opened)
  SB.tileAt = function (L, x, y) {
    if (x < 0 || y < 0 || x >= L.w || y >= L.h) return '#';
    const ch = L.grid[y][x];
    if (ch === 'D' && L.opened && L.opened[x + ',' + y]) return '.';
    return ch;
  };
  SB.solidT = (L, x, y) => SOLID.indexOf(SB.tileAt(L, x, y)) >= 0;
  SB.sightT = (L, x, y) => SIGHT.indexOf(SB.tileAt(L, x, y)) >= 0;
  SB.solidPx = (L, x, y) => SB.solidT(L, Math.floor(x / T), Math.floor(y / T));
  SB.free = (L, x, y, r) =>
    !SB.solidPx(L, x - r, y - r) && !SB.solidPx(L, x + r, y - r) &&
    !SB.solidPx(L, x - r, y + r) && !SB.solidPx(L, x + r, y + r);

  SB.los = function (L, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const n = Math.ceil(Math.hypot(dx, dy) / 5);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (SB.sightT(L, Math.floor((x1 + dx * t) / T), Math.floor((y1 + dy * t) / T))) return false;
    }
    return true;
  };

  SB.rayDist = function (L, x, y, a, max) {
    if (!L) return max;
    const cx = Math.cos(a), cy = Math.sin(a);
    for (let d = 4; d <= max; d += 4) {
      if (SB.sightT(L, Math.floor((x + cx * d) / T), Math.floor((y + cy * d) / T))) return d - 2;
    }
    return max;
  };

  SB.snap = function (L, tx, ty) {
    if (!SB.solidT(L, tx, ty)) return [tx, ty];
    for (let r = 1; r < 8; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!SB.solidT(L, tx + dx, ty + dy)) return [tx + dx, ty + dy];
        }
    return [tx, ty];
  };
  SB.snapPx = function (L, x, y) {
    const s = SB.snap(L, Math.floor(x / T), Math.floor(y / T));
    return { x: (s[0] + 0.5) * T, y: (s[1] + 0.5) * T };
  };

  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  SB.findPath = function (L, sx, sy, tx, ty) {
    const t = SB.snap(L, tx, ty);
    tx = t[0]; ty = t[1];
    sx = Math.max(0, Math.min(L.w - 1, sx));
    sy = Math.max(0, Math.min(L.h - 1, sy));
    if (sx === tx && sy === ty) return [];
    const w = L.w;
    const prev = new Int32Array(L.w * L.h).fill(-1);
    const start = sy * w + sx;
    const q = [start];
    prev[start] = start;
    for (let qi = 0; qi < q.length; qi++) {
      const cur = q[qi];
      const cx = cur % w, cy = (cur / w) | 0;
      if (cx === tx && cy === ty) break;
      for (const [dx, dy] of D8) {
        const nx = cx + dx, ny = cy + dy;
        if (SB.solidT(L, nx, ny)) continue;
        if (dx && dy && (SB.solidT(L, cx + dx, cy) || SB.solidT(L, cx, cy + dy))) continue;
        const ni = ny * w + nx;
        if (prev[ni] >= 0) continue;
        prev[ni] = cur;
        q.push(ni);
      }
    }
    if (prev[ty * w + tx] < 0) return [];
    const out = [];
    let c = ty * w + tx;
    while (c !== start) { out.push({ x: c % w, y: (c / w) | 0 }); c = prev[c]; }
    return out.reverse();
  };

  SB.clearLine = function (L, x1, y1, x2, y2, r) {
    const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 6);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (!SB.free(L, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r)) return false;
    }
    return true;
  };

  SB.smoothPath = function (L, x, y, tp) {
    const pts = tp.map((p) => ({ x: (p.x + 0.5) * T, y: (p.y + 0.5) * T }));
    const out = [];
    let cx = x, cy = y, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !SB.clearLine(L, cx, cy, pts[j].x, pts[j].y, 11)) j--;
      out.push(pts[j]);
      cx = pts[j].x; cy = pts[j].y; i = j + 1;
    }
    return out;
  };

  SB.angDiff = function (a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
})();
