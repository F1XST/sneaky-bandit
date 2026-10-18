/*
 * Seeded level generator
 * Builds a room layout (archetype), furnishes it without breaking connectivity,
 * then places loot, hiding spots, guards, cameras and lasers.
 * Every level is deterministic (same seed -> same map) and validated.
 */
(function () {
  const SB = (window.SB = window.SB || {});
  const W = 26, H = 16, T = 36;
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /* ---------- helpers ---------- */
  function RNG(seed) {
    let s = (Math.imul(seed + 1, 2654435761) >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  function shuffle(r, a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function split(total, n) {
    const b = Math.floor(total / n), rem = total - b * n;
    return Array.from({ length: n }, (_, i) => b + (i < rem ? 1 : 0));
  }
  function newGrid() {
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    for (let x = 0; x < W; x++) { g[0][x] = '#'; g[H - 1][x] = '#'; }
    for (let y = 0; y < H; y++) { g[y][0] = '#'; g[y][W - 1] = '#'; }
    return g;
  }
  const hl = (g, y, x1, x2) => { for (let x = x1; x <= x2; x++) g[y][x] = '#'; };
  const vl = (g, x, y1, y2) => { for (let y = y1; y <= y2; y++) g[y][x] = '#'; };
  const isPass = (ch) => '#KTBSE'.indexOf(ch) < 0;
  const isFloor = (ch) => ch === '.' || ch === ',';

  function stats(g, sx, sy, blockD) {
    const isPass = (ch) => '#KTBSE'.indexOf(ch) < 0 && !(blockD && ch === 'D');
    let pass = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isPass(g[y][x])) pass++;
    const seen = new Uint8Array(W * H);
    const st = [sy * W + sx];
    seen[st[0]] = 1;
    let reach = 0;
    while (st.length) {
      const c = st.pop();
      reach++;
      const x = c % W, y = (c / W) | 0;
      for (const d of D4) {
        const nx = x + d[0], ny = y + d[1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (seen[ni] || !isPass(g[ny][nx])) continue;
        seen[ni] = 1;
        st.push(ni);
      }
    }
    return { reach, pass, seen };
  }
  function tryPlace(g, cells, ch, sx, sy) {
    const old = cells.map((c) => g[c[1]][c[0]]);
    cells.forEach((c) => { g[c[1]][c[0]] = ch; });
    const s = stats(g, sx, sy);
    if (s.reach !== s.pass) {
      cells.forEach((c, i) => { g[c[1]][c[0]] = old[i]; });
      return false;
    }
    return true;
  }

  /* ---------- archetypes ---------- */
  function gridRooms(r, cols, rows) {
    const g = newGrid();
    const cw = split(24 - (cols - 1), cols), rh = split(14 - (rows - 1), rows);
    const xs = [], ys = [];
    let x = 1; cw.forEach((w) => { xs.push(x); x += w + 1; });
    let y = 1; rh.forEach((h) => { ys.push(y); y += h + 1; });
    for (let i = 0; i < cols - 1; i++) vl(g, xs[i] + cw[i], 1, 14);
    for (let j = 0; j < rows - 1; j++) hl(g, ys[j] + rh[j], 1, 24);
    const rooms = [], idx = (i, j) => j * cols + i;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) rooms.push({ x: xs[i], y: ys[j], w: cw[i], h: rh[j], kind: 'room' });
    const edges = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        if (i < cols - 1) edges.push({ a: idx(i, j), b: idx(i + 1, j), o: 'v', wx: xs[i] + cw[i], y0: ys[j], y1: ys[j] + rh[j] - 1 });
        if (j < rows - 1) edges.push({ a: idx(i, j), b: idx(i, j + 1), o: 'h', wy: ys[j] + rh[j], x0: xs[i], x1: xs[i] + cw[i] - 1 });
      }
    const par = rooms.map((_, i) => i);
    const find = (a) => (par[a] === a ? a : (par[a] = find(par[a])));
    const doors = [];
    shuffle(r, edges).forEach((e) => {
      const ra = find(e.a), rb = find(e.b);
      if (ra !== rb || r() < 0.35) {
        par[ra] = rb;
        if (e.o === 'v') { const dy = ri(r, e.y0 + 1, e.y1 - 1); g[dy][e.wx] = '.'; doors.push({ x: e.wx, y: dy, o: 'v' }); }
        else { const dx = ri(r, e.x0 + 1, e.x1 - 1); g[e.wy][dx] = '.'; doors.push({ x: dx, y: e.wy, o: 'h' }); }
      }
    });
    const last = (rows - 1) * cols;
    return { g, rooms, doors, ey: rooms[last].y + rooms[last].h - 2 };
  }

  function corridor(r, nTop, nBot) {
    const g = newGrid();
    hl(g, 6, 1, 24); hl(g, 9, 1, 24);
    const rooms = [{ x: 1, y: 7, w: 24, h: 2, kind: 'corr' }];
    const doors = [];
    [[nTop, 1, 5, 6], [nBot, 10, 5, 9]].forEach((cfg) => {
      const n = cfg[0], ry = cfg[1], rh = cfg[2], wy = cfg[3];
      const ws = split(24 - (n - 1), n);
      let x = 1;
      ws.forEach((w, i) => {
        rooms.push({ x, y: ry, w, h: rh, kind: 'room' });
        if (i < n - 1) vl(g, x + w, ry, ry + rh - 1);
        const dx = ri(r, x + 1, x + w - 2);
        g[wy][dx] = '.';
        doors.push({ x: dx, y: wy, o: 'h' });
        x += w + 1;
      });
    });
    return { g, rooms, doors, ey: 8 };
  }

  function hall(r) {
    const g = newGrid();
    vl(g, 8, 1, 14); vl(g, 17, 1, 14); hl(g, 8, 1, 7); hl(g, 8, 18, 24);
    const rooms = [
      { x: 9, y: 1, w: 8, h: 14, kind: 'hall' },
      { x: 1, y: 1, w: 7, h: 7, kind: 'room' }, { x: 1, y: 9, w: 7, h: 6, kind: 'room' },
      { x: 18, y: 1, w: 7, h: 7, kind: 'room' }, { x: 18, y: 9, w: 7, h: 6, kind: 'room' },
    ];
    const doors = [];
    const add = (x, y, o) => { g[y][x] = '.'; doors.push({ x, y, o }); };
    add(8, ri(r, 2, 6), 'v'); add(8, ri(r, 10, 13), 'v');
    add(17, ri(r, 2, 6), 'v'); add(17, ri(r, 10, 13), 'v');
    // wings are only sometimes linked to each other, so some rooms are dead ends
    if (r() < 0.5) add(ri(r, 2, 6), 8, 'h');
    if (r() < 0.5) add(ri(r, 19, 23), 8, 'h');
    return { g, rooms, doors, ey: 12 };
  }

  function open(r) {
    const g = newGrid();
    const rooms = [
      { x: 1, y: 1, w: 12, h: 7, kind: 'room' }, { x: 13, y: 1, w: 12, h: 7, kind: 'room' },
      { x: 1, y: 8, w: 12, h: 7, kind: 'room' }, { x: 13, y: 8, w: 12, h: 7, kind: 'room' },
    ];
    return { g, rooms, doors: [], ey: 8, stubs: [['v', 12, 1, 4], ['v', 13, 11, 14], ['h', 7, 3, 8], ['h', 8, 17, 22], ['v', 6, 10, 14], ['v', 19, 1, 5], ['v', 9, 1, 3], ['v', 16, 12, 14]] };
  }

  function ring(r) {
    const g = newGrid();
    hl(g, 4, 6, 19); hl(g, 11, 6, 19); vl(g, 6, 4, 11); vl(g, 19, 4, 11);
    const doors = [];
    const tx = ri(r, 9, 11), bx = ri(r, 14, 16);
    g[4][tx] = '.'; doors.push({ x: tx, y: 4, o: 'h' });
    g[11][bx] = '.'; doors.push({ x: bx, y: 11, o: 'h' });
    const rooms = [
      { x: 1, y: 4, w: 5, h: 8, kind: 'room' },
      { x: 7, y: 5, w: 12, h: 6, kind: 'room' },
      { x: 1, y: 1, w: 24, h: 3, kind: 'corr' }, { x: 1, y: 12, w: 24, h: 3, kind: 'corr' },
      { x: 20, y: 4, w: 5, h: 8, kind: 'room' },
    ];
    return { g, rooms, doors, ey: 8, ring: { tx, bx } };
  }

  /* ---------- furnishing ---------- */
  function decorate(A, r, spec, res, start) {
    const g = A.g;
    const okCell = (x, y) => y >= 0 && x >= 0 && y < H && x < W && isFloor(g[y][x]) && !res.has(x + ',' + y);
    const sx = start.x, sy = start.y;

    if (A.stubs) {
      shuffle(r, A.stubs).slice(0, spec.stubs == null ? 3 : spec.stubs).forEach((s) => {
        const cells = [];
        if (s[0] === 'v') for (let y = s[2]; y <= s[3]; y++) cells.push([s[1], y]);
        else for (let x = s[2]; x <= s[3]; x++) cells.push([x, s[1]]);
        if (cells.every((c) => okCell(c[0], c[1]))) tryPlace(g, cells, '#', sx, sy);
      });
    }

    A.rooms.forEach((room) => {
      const corr = room.kind === 'corr' || room.kind === 'hall';
      if (corr && spec.corrRug) {
        for (let y = room.y; y < room.y + room.h; y++)
          for (let x = room.x; x < room.x + room.w; x++) if (g[y][x] === '.') g[y][x] = ',';
      } else if (!corr && room.w >= 5 && room.h >= 4 && r() < spec.rug) {
        for (let y = room.y + 1; y < room.y + room.h - 1; y++)
          for (let x = room.x + 1; x < room.x + room.w - 1; x++) if (g[y][x] === '.') g[y][x] = ',';
      }
      const area = room.w * room.h;
      const want = Math.max(room.kind === 'room' ? 1 : 0, Math.round((area * spec.density * (corr ? 0.3 : 1)) / 7));
      const kinds = [];
      Object.keys(spec.style).forEach((k) => { for (let i = 0; i < spec.style[k]; i++) kinds.push(k); });
      let placed = 0;
      for (let k = 0; k < want * 6 && placed < want; k++) {
        const type = pick(r, kinds);
        let cells = [], ch = type;
        if (type === 'K') {
          const len = ri(r, 1, 3), side = ri(r, 0, 3);
          for (let i = 0; i < len; i++) {
            if (side === 0) cells.push([room.x + ri(r, 0, 0) + i + (k % Math.max(1, room.w - len)), room.y]);
            else if (side === 1) cells.push([room.x + i + (k % Math.max(1, room.w - len)), room.y + room.h - 1]);
            else if (side === 2) cells.push([room.x, room.y + i + (k % Math.max(1, room.h - len))]);
            else cells.push([room.x + room.w - 1, room.y + i + (k % Math.max(1, room.h - len))]);
          }
        } else if (type === 'B') {
          if (room.w < 4 || room.h < 4) continue;
          const cx = r() < 0.5 ? room.x : room.x + room.w - 2, cy = r() < 0.5 ? room.y : room.y + room.h - 2;
          cells = [[cx, cy], [cx + 1, cy], [cx, cy + 1], [cx + 1, cy + 1]];
        } else if (type === 'S') {
          if (room.w < 5) continue;
          const sxx = room.x + ri(r, 0, room.w - 3), syy = r() < 0.5 ? room.y : room.y + room.h - 1;
          cells = [[sxx, syy], [sxx + 1, syy], [sxx + 2, syy]];
        } else if (type === 'T') {
          const tw = ri(r, 1, 3), th = ri(r, 1, 2);
          if (room.w - 2 < tw || room.h - 2 < th) continue;
          const tx = ri(r, room.x + 1, room.x + room.w - 1 - tw), ty = ri(r, room.y + 1, room.y + room.h - 1 - th);
          for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) cells.push([tx + xx, ty + yy]);
        }
        if (!cells.length) continue;
        if (!cells.every((c) => okCell(c[0], c[1]))) continue;
        if (tryPlace(g, cells, ch, sx, sy)) placed++;
      }
    });
  }

  function roomCell(g, room, avoid) {
    const cx = room.x + (room.w - 1) / 2, cy = room.y + (room.h - 1) / 2;
    let best = null, bd = 1e9;
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++) {
        const ch = g[y][x];
        if (!(isFloor(ch) || ch === 'H')) continue;
        const d = Math.hypot(x - cx, y - cy);
        if (d < bd) { bd = d; best = [x, y]; }
      }
    return best;
  }

  /* ---------- main entry ---------- */
  function build(spec, seed) {
    const r = RNG(seed);
    const A = spec.arch === 'grid' ? gridRooms(r, spec.cols, spec.rows)
      : spec.arch === 'corridor' ? corridor(r, spec.top, spec.bot)
      : spec.arch === 'hall' ? hall(r)
      : spec.arch === 'ring' ? ring(r) : open(r);
    const g = A.g;
    const start = { x: 1, y: A.ey };
    const exit = { x: 0, y: A.ey };
    const base = stats(g, start.x, start.y);
    if (base.reach !== base.pass) return null;

    const res = new Set();
    const reserve = (x, y, rad) => { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) res.add(x + dx + ',' + (y + dy)); };
    A.doors.forEach((d) => reserve(d.x, d.y, 2));
    reserve(start.x, start.y, 2);

    decorate(A, r, spec, res, start);
    const rooms = A.rooms;
    const startRoom = rooms.findIndex((rm) => start.x >= rm.x && start.x < rm.x + rm.w && start.y >= rm.y && start.y < rm.y + rm.h);

    // loot
    const loot = [];
    const order = shuffle(r, rooms.map((_, i) => i)).filter((i) => i !== startRoom);
    let guard = 0;
    while (loot.length < spec.loot && guard++ < 200) {
      const room = rooms[order[loot.length % order.length]];
      const x = ri(r, room.x, room.x + room.w - 1), y = ri(r, room.y, room.y + room.h - 1);
      if (!isFloor(g[y][x]) || res.has(x + ',' + y)) continue;
      if (Math.abs(x - start.x) + Math.abs(y - start.y) < 7) continue;
      if (loot.some((l) => Math.abs(l[0] - x) + Math.abs(l[1] - y) < 4)) continue;
      loot.push([x, y]);
    }
    if (loot.length < spec.loot) return null;
    loot.forEach((l) => { g[l[1]][l[0]] = '$'; });

    // hiding spots
    rooms.forEach((room) => {
      const n = room.kind === 'room' ? spec.hides : room.kind === 'corr' ? Math.min(spec.hides + 1, 2) : 2;
      let placed = 0;
      for (let k = 0; k < 40 && placed < n; k++) {
        const x = ri(r, room.x, room.x + room.w - 1), y = ri(r, room.y, room.y + room.h - 1);
        const edge = x === room.x || y === room.y || x === room.x + room.w - 1 || y === room.y + room.h - 1;
        if (!edge || !isFloor(g[y][x]) || res.has(x + ',' + y)) continue;
        g[y][x] = 'H';
        placed++;
      }
    });

    // locked rooms: a dead-end room behind a locked door, with the key lying elsewhere
    const lockedRooms = [], lockDoors = [], keyCells = [];
    const roomOf = (x, y) => rooms.findIndex((rm) => x >= rm.x && x < rm.x + rm.w && y >= rm.y && y < rm.y + rm.h);
    const doorRooms = (d) => (d.o === 'v' ? [[d.x - 1, d.y], [d.x + 1, d.y]] : [[d.x, d.y - 1], [d.x, d.y + 1]]).map((c) => roomOf(c[0], c[1]));
    for (let li = 0; li < (spec.locks || 0); li++) {
      const deg = rooms.map(() => 0);
      A.doors.forEach((d) => doorRooms(d).forEach((q) => { if (q >= 0) deg[q]++; }));
      const inner = (d) => doorRooms(d).find((q) => q >= 0 && deg[q] === 1 && q !== startRoom && rooms[q].kind === 'room' && lockedRooms.indexOf(q) < 0);
      const cands = shuffle(r, A.doors).filter((d) => lockDoors.indexOf(d) < 0 && g[d.y][d.x] === '.' && inner(d) !== undefined && Math.abs(d.x - start.x) + Math.abs(d.y - start.y) > 5);
      if (!cands.length) break;
      const d = cands[0];
      const q = inner(d);
      const room = rooms[q];
      if (!loot.some((l) => roomOf(l[0], l[1]) === q)) {
        let placed = false;
        for (let k = 0; k < 60 && !placed; k++) {
          const x = ri(r, room.x, room.x + room.w - 1), y = ri(r, room.y, room.y + room.h - 1);
          if (!isFloor(g[y][x]) || res.has(x + ',' + y)) continue;
          g[y][x] = '$'; loot.push([x, y]); placed = true;
        }
        if (!placed) return null;
      }
      g[d.y][d.x] = 'D';
      lockDoors.push(d);
      lockedRooms.push(q);
    }
    if (lockDoors.length < (spec.locks || 0)) return null;
    if (lockDoors.length) {
      const reach = stats(g, start.x, start.y, true).seen;
      lockDoors.forEach(() => {
        const cands = [];
        for (let y = 1; y < H - 1; y++)
          for (let x = 1; x < W - 1; x++) {
            if (!reach[y * W + x] || !isFloor(g[y][x]) || res.has(x + ',' + y)) continue;
            if (lockedRooms.indexOf(roomOf(x, y)) >= 0) continue;
            if (Math.abs(x - start.x) + Math.abs(y - start.y) < 6) continue;
            if (loot.some((l) => Math.abs(l[0] - x) + Math.abs(l[1] - y) < 3)) continue;
            cands.push([x, y]);
          }
        if (!cands.length) return;
        const c = pick(r, cands);
        g[c[1]][c[0]] = 'k';
        keyCells.push(c);
      });
      if (keyCells.length < lockDoors.length) return null;
    }

    g[exit.y][exit.x] = 'E';
    g[start.y][start.x] = 'P';

    // guards
    const types = spec.guards.slice();
    const sentinels = types.filter((t) => t === 'sentinel').length;
    const sleepers = types.filter((t) => t === 'sleeper').length;
    const walkers = types.filter((t) => t !== 'sentinel' && t !== 'sleeper');
    const hub = rooms.findIndex((rm) => rm.kind === 'corr' || rm.kind === 'hall');
    const shuffled = shuffle(r, rooms.map((_, i) => i)).filter((i) => lockedRooms.indexOf(i) < 0);
    const guards = [];
    for (let i = 0; i < sleepers; i++) {
      const lt = loot[ri(r, 0, loot.length - 1)];
      const cands = [];
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const x = lt[0] + dx, y = lt[1] + dy, m = Math.abs(dx) + Math.abs(dy);
          if (m < 2 || m > 3 || x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
          if (!isFloor(g[y][x]) || res.has(x + ',' + y)) continue;
          if (lockedRooms.indexOf(roomOf(x, y)) >= 0) continue;
          if (Math.abs(x - start.x) + Math.abs(y - start.y) < 9) continue;
          if (guards.some((q) => q.post && q.post[0] === x && q.post[1] === y)) continue;
          cands.push([x, y]);
        }
      if (!cands.length) return null;
      const c = pick(r, cands);
      guards.push({ type: 'sleeper', nap: true, post: [c[0], c[1]], a0: Math.atan2(lt[1] - c[1], lt[0] - c[0]) });
    }
    walkers.forEach((type, gi) => {
      let mine = shuffled.filter((_, k) => k % walkers.length === gi);
      if (hub >= 0 && mine.indexOf(hub) < 0) mine.push(hub);
      if (mine.length < 2) mine = mine.concat(shuffled.filter((i) => mine.indexOf(i) < 0).slice(0, 2 - mine.length));
      let pts = mine.map((i) => roomCell(g, rooms[i])).filter(Boolean);
      // nearest-neighbour tour starting from the point farthest from the thief
      pts.sort((a, b) => Math.hypot(b[0] - start.x, b[1] - start.y) - Math.hypot(a[0] - start.x, a[1] - start.y));
      const tour = [pts.shift()];
      while (pts.length) {
        const c = tour[tour.length - 1];
        pts.sort((a, b) => Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1]));
        tour.push(pts.shift());
      }
      guards.push({ type, route: tour });
    });
    for (let i = 0; i < sentinels; i++) {
      const cand = shuffle(r, A.doors.slice()).filter((d) => lockDoors.indexOf(d) < 0 && Math.abs(d.x - start.x) + Math.abs(d.y - start.y) > 9);
      let done = false;
      for (const d of cand) {
        const dirs = d.o === 'v' ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
        for (const dir of shuffle(r, dirs)) {
          const px = d.x + dir[0] * 2, py = d.y + dir[1] * 2;
          if (isFloor(g[py][px]) && isFloor(g[d.y + dir[1]][d.x + dir[0]])) {
            guards.push({ type: 'sentinel', sentinel: { a0: Math.atan2(d.y - py, d.x - px), sweep: 0.9 }, post: [px, py] });
            done = true; break;
          }
        }
        if (done) break;
      }
      if (!done) return null;
    }

    // cameras
    const cameras = [];
    const camRooms = shuffle(r, rooms.map((_, i) => i)).filter((i) => i !== startRoom && rooms[i].kind !== 'corr' && lockedRooms.indexOf(i) < 0);
    for (let i = 0; i < (spec.cameras || 0); i++) {
      const room = rooms[camRooms[i % camRooms.length]];
      const corners = shuffle(r, [[room.x, room.y, -1, -1], [room.x + room.w - 1, room.y, 1, -1], [room.x, room.y + room.h - 1, -1, 1], [room.x + room.w - 1, room.y + room.h - 1, 1, 1]]);
      const c = corners.find((q) => isFloor(g[q[1]][q[0]]) && !res.has(q[0] + ',' + q[1]));
      if (!c) return null;
      const px = (c[0] + 0.5) * T + c[2] * 10, py = (c[1] + 0.5) * T + c[3] * 10;
      const rcx = (room.x + room.w / 2) * T, rcy = (room.y + room.h / 2) * T;
      cameras.push({ x: px, y: py, a0: Math.atan2(rcy - py, rcx - px), sweep: 0.8, range: 200, fov: 0.95, ph: r() * 6 });
    }

    // lasers
    const lasers = [];
    const cands = [];
    A.doors.forEach((d) => {
      if (lockDoors.indexOf(d) >= 0) return;
      if (Math.abs(d.x - start.x) + Math.abs(d.y - start.y) < 6) return;
      if (d.o === 'v' && g[d.y - 1][d.x] === '#' && g[d.y + 1][d.x] === '#') cands.push({ ax: d.x, ay: d.y - 1, bx: d.x, by: d.y + 1 });
      if (d.o === 'h' && g[d.y][d.x - 1] === '#' && g[d.y][d.x + 1] === '#') cands.push({ ax: d.x - 1, ay: d.y, bx: d.x + 1, by: d.y });
    });
    if (A.ring) {
      const rc = [];
      for (let x = 8; x <= 17; x++) {
        if (Math.abs(x - A.ring.tx) > 1) rc.push({ ax: x, ay: 0, bx: x, by: 4 });
        if (Math.abs(x - A.ring.bx) > 1) rc.push({ ax: x, ay: 11, bx: x, by: 15 });
      }
      [4, 5, 10, 11].forEach((y) => { rc.push({ ax: 0, ay: y, bx: 6, by: y }); rc.push({ ax: 19, ay: y, bx: 25, by: y }); });
      cands.push.apply(cands, shuffle(r, rc));
    }
    shuffle(r, cands).forEach((c) => {
      if (lasers.length >= (spec.lasers || 0)) return;
      if (lasers.some((l) => Math.abs(l.ax - c.ax) + Math.abs(l.ay - c.ay) < 4 && Math.abs(l.bx - c.bx) + Math.abs(l.by - c.by) < 4)) return;
      if (g[c.ay][c.ax] !== '#' || g[c.by][c.bx] !== '#') return;
      lasers.push({ ax: c.ax, ay: c.ay, bx: c.bx, by: c.by, on: 1.8 + r() * 0.8, off: 1.6 + r() * 0.8, ph: r() * 4 });
    });
    if (lasers.length < (spec.lasers || 0)) return null;

    // validation: everything must be reachable and guards must not start on top of the thief
    const st = stats(g, start.x, start.y);
    if (st.reach !== st.pass) return null;
    // with the locked doors still shut, guards and keys must be on the thief's side
    const closed = stats(g, start.x, start.y, true).seen;
    for (const gd of guards) {
      const pts = gd.route || [gd.post];
      for (const p of pts) if (!closed[p[1] * W + p[0]]) return null;
    }
    for (const k of keyCells) if (!closed[k[1] * W + k[0]]) return null;
    const first = guards.filter((q) => q.route).map((q) => q.route[0]);
    if (first.some((p) => Math.abs(p[0] - start.x) + Math.abs(p[1] - start.y) < 9)) return null;

    return { grid: g.map((row) => row.join('')), guards, cameras, lasers };
  }

  SB.genLevel = function (spec) {
    for (let attempt = 0; attempt < 120; attempt++) {
      const out = build(spec, spec.seed * 31 + attempt * 977);
      if (out) {
        return Object.assign({
          name: spec.name, sub: spec.sub, brief: spec.brief, note: spec.note, theme: spec.theme,
          time: spec.time, par: spec.par, rocks: spec.rocks == null ? 3 : spec.rocks,
          items: { sleep: spec.sleep || 0, decoy: spec.decoy || 0, disguise: spec.disguise || 0, shoes: spec.shoes || 0 },
        }, out);
      }
    }
    console.warn('level generation failed for', spec.name);
    return null;
  };

  /* ---------- endless mode: difficulty grows with the streak ---------- */
  const THEME_POOL = ['house', 'mansion', 'hotel', 'bank', 'museum', 'office', 'clinic', 'casino', 'ship', 'train', 'vault', 'factory', 'command'];
  SB.randomSpec = function (streak, seed) {
    const r = RNG(seed);
    const arch = pick(r, ['grid', 'grid', 'hall', 'corridor', 'open', 'ring']);
    const spec = {
      seed, arch, theme: pick(r, THEME_POOL), hides: 1, rug: 0.5, density: 0.9, corrRug: r() < 0.6,
      style: pick(r, [{ T: 3, K: 1, B: 2, S: 1 }, { T: 4, K: 2, S: 1 }, { K: 4, T: 2 }]),
    };
    if (arch === 'grid') { spec.cols = pick(r, [2, 3, 3, 4]); spec.rows = 2; }
    if (arch === 'corridor') { spec.top = ri(r, 3, 5); spec.bot = ri(r, 3, 5); }
    if (arch === 'open') spec.stubs = ri(r, 2, 4);
    if (arch === 'ring') { spec.density = 0.55; spec.rug = 0; spec.corrRug = false; }
    const n = streak;
    const guards = ['guard'];
    const extra = ['cop', 'guard', 'cop', 'guard'];
    for (let i = 0; i < Math.min(4, Math.floor((n - 1) / 2)); i++) guards.push(extra[i]);
    if (n >= 3) guards.push('sleeper');
    if (n >= 4) guards.push('dog');
    if (n >= 6) guards.push('sentinel');
    spec.guards = guards.slice(0, 6);
    spec.loot = Math.min(6, 3 + Math.floor(n / 3));
    spec.cameras = n >= 2 && arch !== 'corridor' ? Math.min(3, Math.floor(n / 2)) : 0;
    spec.lasers = n >= 3 ? Math.min(4, Math.floor((n - 1) / 2)) : 0;
    spec.locks = n >= 4 && arch !== 'ring' && arch !== 'open' ? 1 : 0;
    spec.sleep = n >= 2 ? 1 + (n >= 5 ? 1 : 0) : 0;
    spec.decoy = n >= 3 ? 1 : 0;
    spec.disguise = n >= 4 ? 1 : 0;
    spec.shoes = n >= 5 ? 1 : 0;
    spec.rocks = 3;
    spec.time = 80 + spec.loot * 12 + spec.guards.length * 6 + spec.locks * 10;
    spec.par = Math.round(spec.time * 0.66);
    spec.name = '';
    spec.sub = '';
    spec.brief = '';
    return spec;
  };
})();
