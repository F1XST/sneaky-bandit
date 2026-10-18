(function () {
  const SB = (window.SB = window.SB || {});

  function mk(w, h) {
    const g = Array.from({ length: h }, () => Array(w).fill('.'));
    const api = {
      r(x, y, ww, hh, c) { for (let j = y; j < y + hh; j++) for (let i = x; i < x + ww; i++) g[j][i] = c; return api; },
      s(x, y, c) { g[y][x] = c; return api; },
      h(y, x1, x2, c) { for (let i = x1; i <= x2; i++) g[y][i] = c || '#'; return api; },
      v(x, y1, y2, c) { for (let j = y1; j <= y2; j++) g[j][x] = c || '#'; return api; },
      border() { api.h(0, 0, w - 1); api.h(h - 1, 0, w - 1); api.v(0, 0, h - 1); api.v(w - 1, 0, h - 1); return api; },
      out() { return g.map((r) => r.join('')); },
    };
    return api;
  }

  const THEMES = {
    house: {
      kind: 'wood', floor: ['#c99a62', '#c0915a'], seam: 'rgba(70,40,15,.45)',
      wall: '#51456b', wallFace: '#34294a', wallHi: '#7a6c99',
      rug: '#a8424a', rugEdge: '#f0c96b', table: '#8a5a35', sofa: '#3f8f9a',
      bed: '#efe9dc', blanket: '#6fa8dc', frame: '#7a4a2a', cab: '#6b4326', night: '#a0a6d2',
    },
    mansion: {
      kind: 'tile', floor: ['#efe6d3', '#ddd2b8'], seam: 'rgba(120,100,70,.35)',
      wall: '#6a3341', wallFace: '#46202b', wallHi: '#93566a',
      rug: '#2f5a96', rugEdge: '#f1d27c', table: '#7b4a2b', sofa: '#8a2f4a',
      bed: '#f3eee6', blanket: '#c4506a', frame: '#5a3720', cab: '#52301c', night: '#a6aad6',
    },
    hotel: {
      kind: 'wood', floor: ['#d9c3a0', '#cfb48e'], seam: 'rgba(80,55,25,.4)',
      wall: '#2f5b63', wallFace: '#1d3b41', wallHi: '#5b8d96',
      rug: '#8a2234', rugEdge: '#f2cf72', table: '#8d6038', sofa: '#2e6f8a',
      bed: '#f7f3ea', blanket: '#2f7f8f', frame: '#6b4428', cab: '#5d3b22', night: '#9ca6d4',
    },
    bank: {
      kind: 'tile', floor: ['#bfc9d4', '#aeb9c6'], seam: 'rgba(40,60,90,.35)',
      wall: '#2c405c', wallFace: '#1c2b40', wallHi: '#587298',
      rug: '#233f73', rugEdge: '#d7b660', table: '#7c5a3a', sofa: '#3a5a7a',
      bed: '#e9edf2', blanket: '#5a7aa0', frame: '#4a5a6a', cab: '#56616d', night: '#939fcc',
    },
    museum: {
      kind: 'tile', floor: ['#e8dfd2', '#d8cdbc'], seam: 'rgba(110,90,70,.3)',
      wall: '#5d4a3e', wallFace: '#3d2f27', wallHi: '#8a7262',
      rug: '#7a2231', rugEdge: '#e6c46a', table: '#9fc6d6', tableEdge: '#e8f4f8', sofa: '#6b4a7a',
      bed: '#f0ece6', blanket: '#a0729a', frame: '#5a4636', cab: '#4a3a30', night: '#9aa0cc',
    },
    office: {
      kind: 'tile', floor: ['#d3d8de', '#c6ccd3'], seam: 'rgba(60,75,95,.3)',
      wall: '#3d4d63', wallFace: '#27323f', wallHi: '#6f86a3',
      rug: '#2b6b72', rugEdge: '#c9d6df', table: '#b08a5a', sofa: '#4a6f93',
      bed: '#e9edf2', blanket: '#5a7aa0', frame: '#4a5a6a', cab: '#5b6672', night: '#98a4cf',
    },
    clinic: {
      kind: 'tile', floor: ['#e6f0ef', '#d6e5e3'], seam: 'rgba(60,110,115,.28)',
      wall: '#3f6f73', wallFace: '#274749', wallHi: '#78aaae',
      rug: '#4a8f8f', rugEdge: '#f2fbfa', table: '#a9c4c8', tableEdge: '#e8f6f6', sofa: '#4a8fb0',
      bed: '#ffffff', blanket: '#7fc8d6', frame: '#aab8bb', cab: '#7a8f93', night: '#a4b0d4',
    },
    casino: {
      kind: 'tile', floor: ['#7a5068', '#6f4860'], seam: 'rgba(255,215,120,.2)',
      wall: '#3b2048', wallFace: '#241030', wallHi: '#8a58a0',
      rug: '#127a54', rugEdge: '#f2cf72', table: '#1c8a5c', tableEdge: '#d7b660', sofa: '#a62a40',
      bed: '#f3eee6', blanket: '#b84a64', frame: '#6a4228', cab: '#5a3418', night: '#b2aedc',
    },
    ship: {
      kind: 'wood', floor: ['#b98a58', '#ae8050'], seam: 'rgba(60,35,15,.5)',
      wall: '#2c4f6b', wallFace: '#1b3347', wallHi: '#5f8eb0',
      rug: '#b0342e', rugEdge: '#f5e9c8', table: '#8b5a2e', sofa: '#2f6f8f',
      bed: '#f2efe6', blanket: '#3d86a8', frame: '#6b4426', cab: '#5a3a20', night: '#98a6d4',
    },
    train: {
      kind: 'wood', floor: ['#a9744a', '#9f6c44'], seam: 'rgba(50,25,10,.5)',
      wall: '#5a2a2a', wallFace: '#391818', wallHi: '#8f5555',
      rug: '#8a2f2f', rugEdge: '#e8c36a', table: '#7a4a28', sofa: '#6b3a2a',
      bed: '#efe7da', blanket: '#a0453a', frame: '#4a2a18', cab: '#4a2c1c', night: '#a09ac8',
    },
    vault: {
      kind: 'tile', floor: ['#9aa3ad', '#8c959f'], seam: 'rgba(30,40,55,.4)',
      wall: '#3a3f47', wallFace: '#22262c', wallHi: '#7b8794',
      rug: '#6b1f1f', rugEdge: '#d7b660', table: '#6a7480', sofa: '#4a5562',
      bed: '#cfd5db', blanket: '#6a7a8c', frame: '#4a5560', cab: '#4d5661', night: '#8890bc',
    },
    factory: {
      kind: 'tile', floor: ['#a9a49a', '#9d988e'], seam: 'rgba(40,35,25,.4)',
      wall: '#55504a', wallFace: '#35312c', wallHi: '#8a847a',
      rug: '#b8742a', rugEdge: '#f2d27a', table: '#6e6a62', sofa: '#4a5a4a',
      bed: '#d8d4ca', blanket: '#7a8a6a', frame: '#4a463e', cab: '#5a564e', night: '#9a98bc',
    },
    command: {
      kind: 'tile', floor: ['#8d99a8', '#7f8b9b'], seam: 'rgba(20,30,50,.4)',
      wall: '#1f2a3d', wallFace: '#121a28', wallHi: '#5a7090',
      rug: '#6a1f2f', rugEdge: '#e6c46a', table: '#4a5a72', sofa: '#33465e',
      bed: '#c9d2dc', blanket: '#56708f', frame: '#334055', cab: '#2f3b4c', night: '#848cbc',
    },
  };

  function level1() {
    const a = mk(26, 16).border();
    a.v(9, 1, 14).s(9, 4, '.').s(9, 12, '.');
    a.h(8, 1, 8).s(4, 8, '.');
    a.h(7, 10, 24).s(17, 7, '.');
    // bedroom
    a.r(4, 4, 4, 3, ',').r(1, 1, 2, 2, 'B').s(4, 1, 'T').s(7, 2, '$').s(8, 6, 'H');
    // kitchen
    a.r(3, 11, 3, 2, 'T').r(5, 9, 3, 1, 'K').s(1, 14, 'H');
    // living room
    a.r(12, 3, 8, 3, ',').r(12, 1, 4, 1, 'S').r(15, 4, 2, 1, 'T').r(23, 1, 2, 1, 'K').s(22, 2, '$').s(10, 6, 'H');
    // dining room
    a.r(13, 9, 7, 4, ',').r(14, 10, 5, 2, 'T').s(24, 14, 'H').s(23, 10, '$');
    a.s(0, 13, 'E').s(1, 13, 'P');
    return {
      name: 'บ้านหลังแรก', sub: 'ยามคนเดียว ลองย่องดูก่อน', theme: 'house', time: 90, par: 55, rocks: 4,
      brief: 'บ้านเศรษฐีเล็ก ๆ มียามคนเดียวเดินวนรอบบ้าน เก็บของมีค่าให้ครบแล้วหนีออกทางประตูเดิม',
      grid: a.out(),
      guards: [{ type: 'guard', route: [[7, 11], [11, 12], [20, 13], [17, 8], [20, 4], [11, 3], [6, 5], [4, 8]] }],
    };
  }

  function level2() {
    const a = mk(26, 16).border();
    a.v(8, 1, 14).s(8, 3, '.').s(8, 11, '.');
    a.v(17, 1, 14).s(17, 3, '.').s(17, 11, '.');
    a.h(8, 1, 7).s(4, 8, '.');
    a.h(8, 18, 24).s(21, 8, '.');
    // hall
    a.r(10, 4, 6, 8, ',').r(12, 7, 2, 2, 'T').s(9, 1, 'H').s(16, 1, 'H').s(9, 14, 'H').s(16, 14, 'H').s(11, 1, 'K').s(14, 1, 'K');
    // left top
    a.r(3, 4, 3, 3, ',').r(1, 1, 2, 2, 'B').s(4, 1, 'T').s(6, 2, '$').s(7, 6, 'H');
    // left bottom
    a.r(1, 11, 5, 3, ',').r(2, 10, 3, 1, 'S').r(5, 12, 2, 2, 'T').s(2, 13, '$').s(1, 9, 'H');
    // right top
    a.r(19, 2, 5, 2, ',').r(22, 1, 3, 1, 'K').r(19, 5, 3, 1, 'T').s(23, 6, '$').s(18, 6, 'H');
    // right bottom
    a.r(19, 10, 3, 3, ',').r(22, 9, 3, 2, 'B').r(19, 13, 2, 1, 'T').s(23, 13, '$').s(18, 14, 'H');
    a.s(12, 15, 'E').s(11, 14, 'P');
    return {
      name: 'คฤหาสน์เก่า', sub: 'ยาม 2 คน ลาดตระเวนกันคนละฝั่ง', theme: 'mansion', time: 110, par: 75, rocks: 3,
      brief: 'ห้องโถงกลางเชื่อมห้องนอนสี่มุม ยามสองคนเดินสลับกันผ่านโถง ใช้พุ่มไม้หลบและโยนหินเบี่ยงความสนใจ',
      grid: a.out(),
      guards: [
        { type: 'guard', route: [[12, 13], [12, 3], [4, 4], [4, 12]] },
        { type: 'cop', route: [[14, 3], [21, 4], [21, 12], [14, 13]] },
      ],
    };
  }

  function level3() {
    const a = mk(26, 16).border();
    a.h(6, 1, 24).h(9, 1, 24).r(1, 7, 24, 2, ',');
    [4, 10, 16, 22].forEach((x) => { a.s(x, 6, '.'); a.s(x, 9, '.'); });
    [7, 13, 19].forEach((x) => { a.v(x, 1, 5); a.v(x, 10, 14); });
    // top rooms
    a.r(1, 1, 2, 2, 'B').s(5, 1, 'T').s(1, 5, 'H');
    a.r(11, 1, 2, 2, 'B').s(8, 5, 'H').s(9, 2, '$');
    a.r(14, 1, 2, 2, 'B').s(18, 5, 'H').s(18, 1, 'T');
    a.r(23, 1, 2, 2, 'B').s(20, 5, 'H').s(21, 3, '$');
    // bottom rooms
    a.r(1, 13, 2, 2, 'B').s(5, 13, '$').s(6, 14, 'H').s(6, 10, 'T');
    a.r(11, 13, 2, 2, 'B').s(8, 14, 'H').s(9, 11, 'T');
    a.r(14, 13, 2, 2, 'B').s(18, 14, 'H').s(17, 12, '$');
    a.r(23, 13, 2, 2, 'B').s(20, 14, 'H').s(21, 11, 'T');
    // corridor plants
    a.s(1, 7, 'H').s(12, 7, 'H').s(18, 8, 'H');
    a.s(25, 8, 'E').s(1, 8, 'P');
    return {
      name: 'โรงแรมหรู', sub: 'ทางเดินยาว ต้องจับจังหวะ', theme: 'hotel', time: 120, par: 85, rocks: 3,
      brief: 'ทางเดินยาวมองเห็นได้ไกล ยามสองคนสลับกันเดิน แอบเข้าห้องพักเก็บของแล้วรอจังหวะวิ่งไปประตูสุดทาง',
      grid: a.out(),
      guards: [
        { type: 'guard', route: [[22, 7], [3, 7]] },
        { type: 'cop', route: [[8, 8], [8, 3], [8, 8], [2, 8], [16, 8], [16, 12], [16, 8], [23, 8]] },
      ],
    };
  }

  function level4() {
    const a = mk(26, 16).border();
    a.v(12, 1, 14).s(12, 5, '.').s(12, 12, '.');
    a.h(8, 13, 24).s(15, 8, '.').s(22, 8, '.');
    a.v(18, 1, 7).s(18, 4, '.');
    a.v(18, 9, 14).s(18, 12, '.');
    // lobby
    a.r(3, 9, 7, 4, ',').r(3, 11, 5, 1, 'S').r(3, 7, 7, 1, 'T').s(5, 3, '$').s(2, 1, 'H').s(11, 1, 'H').s(1, 14, 'H').s(10, 14, 'H');
    // back office top
    a.r(14, 5, 3, 1, 'T').r(13, 1, 1, 3, 'K').s(16, 2, '$').s(17, 7, 'H');
    // vault
    a.r(19, 1, 6, 1, 'K').r(20, 6, 2, 1, 'T').s(22, 4, '$').s(24, 7, 'H');
    // office bottom
    a.r(13, 13, 2, 1, 'S').s(17, 9, 'H').s(14, 10, 'T');
    // server room
    a.r(20, 10, 5, 1, 'K').s(19, 14, 'H').s(23, 13, '$');
    a.s(0, 13, 'E').s(1, 13, 'P');
    return {
      name: 'ธนาคารกลาง', sub: 'มียามเฝ้าจุดตายหน้าห้องนิรภัย', theme: 'bank', time: 130, par: 90, rocks: 3,
      brief: 'ล็อบบี้โล่งกว้าง ห้องนิรภัยมียามยืนเฝ้าสแกนซ้ายขวา ยามอีกสองคนคอยเดินสวนกัน ถ้าถูกเห็น ยามจะวิทยุเรียกพวก',
      grid: a.out(),
      guards: [
        { type: 'guard', route: [[10, 4], [10, 12], [3, 12], [3, 4]] },
        { type: 'cop', route: [[14, 3], [16, 7], [15, 12], [16, 12]] },
        { type: 'sentinel', sentinel: { a0: Math.PI, sweep: 0.95 }, post: [20, 4] },
      ],
    };
  }

  function level5() {
    const a = mk(26, 16).border();
    a.v(8, 1, 5).v(8, 10, 14).v(17, 1, 5).v(17, 10, 14);
    a.r(9, 5, 8, 6, ',');
    [[11, 3], [14, 3], [11, 12], [14, 12]].forEach((p) => a.s(p[0], p[1], 'K'));
    a.r(11, 7, 4, 2, 'T').s(13, 6, '$');
    // left wing
    a.r(3, 10, 2, 2, 'T').r(3, 5, 2, 1, 'T').s(4, 3, '$').s(2, 2, 'H').s(2, 13, 'H').s(6, 7, 'H');
    // right wing
    a.r(21, 10, 2, 2, 'T').r(21, 5, 2, 1, 'T').s(22, 13, '$').s(23, 2, 'H').s(23, 13, 'H').s(19, 7, 'H');
    // extra loot top right
    a.s(20, 2, '$');
    a.s(0, 8, 'E').s(1, 8, 'P');
    return {
      name: 'พิพิธภัณฑ์เก่า', sub: 'ด่านสุดท้าย ยามประสานงานกันดี', theme: 'museum', time: 140, par: 100, rocks: 3,
      brief: 'ห้องแสดงโบราณวัตถุเต็มไปด้วยเสากับตู้กระจก ยามสามคนแบ่งโซนกัน ใครเห็นเรา ที่เหลือจะแยกกันค้นหาทันที',
      grid: a.out(),
      guards: [
        { type: 'guard', route: [[12, 2], [23, 3], [23, 13], [12, 13], [2, 13], [2, 3]] },
        { type: 'cop', route: [[13, 5], [10, 8], [13, 11], [16, 8]] },
        { type: 'sentinel', sentinel: { a0: Math.PI, sweep: 1.2 }, post: [20, 8] },
      ],
    };
  }

  SB.parseLevel = function (d) {
    const grid = d.grid.map((r) => r.split(''));
    const L = Object.assign({}, d, { w: grid[0].length, h: grid.length, loot: [], hides: [], keys: [], locks: [] });
    const rugAt = (x, y) => y >= 0 && x >= 0 && y < grid.length && x < grid[0].length && grid[y][x] === ',';
    for (let y = 0; y < L.h; y++)
      for (let x = 0; x < L.w; x++) {
        const ch = grid[y][x];
        const nearRug = rugAt(x - 1, y) || rugAt(x + 1, y) || rugAt(x, y - 1) || rugAt(x, y + 1);
        if (ch === 'P') { L.start = { x, y }; grid[y][x] = '.'; }
        else if (ch === 'k') { L.keys.push({ tx: x, ty: y }); grid[y][x] = nearRug ? ',' : '.'; }
        else if (ch === 'D') L.locks.push({ x, y });
        else if (ch === '$') { L.loot.push({ tx: x, ty: y }); grid[y][x] = nearRug ? ',' : '.'; }
        else if (ch === 'E') L.exit = { x, y };
        else if (ch === 'H') { L.hides.push({ x, y }); if (nearRug) grid[y][x] = 'H'; }
      }
    L.grid = grid.map((r) => r.join(''));
    L.theme = Object.assign({}, THEMES[d.theme]);
    L.themeName = d.theme;
    L.cameras = d.cameras || [];
    L.lasers = d.lasers || [];
    L.items = Object.assign({ sleep: 0, decoy: 0, disguise: 0, shoes: 0 }, d.items || {});
    L.opened = {};
    return L;
  };

  /* ---------- generated levels ---------- */
  const rich = { T: 3, K: 1, B: 2, S: 1 };
  const GEN = {
    2: {
      name: 'อพาร์ตเมนต์ริมคลอง', sub: 'ห้องแคบ ทางหนีน้อย', theme: 'house', seed: 2, arch: 'grid', cols: 2, rows: 2,
      loot: 3, hides: 1, guards: ['guard'], rug: 0.7, density: 1.1, style: rich, time: 90, par: 60,
      brief: 'ห้องเล็ก ๆ สี่ห้องติดกัน ยามคนเดียวเดินวนทุกห้อง ฝึกใช้พุ่มไม้หลบให้คล่อง',
    },
    4: {
      name: 'ร้านเพชรกลางเมือง', sub: 'มีกล้องวงจรปิดตัวแรก', theme: 'bank', seed: 4, arch: 'open', stubs: 3,
      loot: 3, hides: 1, guards: ['guard'], cameras: 1, rug: 0.5, density: 0.6, style: { T: 3, K: 2 }, time: 100, par: 70,
      brief: 'ร้านเครื่องประดับโล่งกว้าง มีกล้องหมุนส่ายอยู่มุมห้อง ยามหนึ่งคนเดินตรวจเป็นรอบ',
      note: 'ใหม่: กล้องวงจรปิด ถ้ากล้องเห็นคุณ สัญญาณเตือนดังทั่วอาคารและยามทุกคนจะรีบมาตรวจ',
    },
    6: {
      name: 'คลินิกเอกชน', sub: 'ลองใช้ยาสลบ', theme: 'clinic', seed: 6, arch: 'grid', cols: 3, rows: 2,
      loot: 4, hides: 1, guards: ['guard', 'cop'], sleep: 2, rug: 0.5, density: 0.9, style: { B: 2, T: 1, K: 1, S: 1 }, time: 120, par: 80,
      brief: 'ห้องตรวจหกห้องเรียงกัน ยามสองคนสวนกันในทางเดินแคบ ถึงเวลาลองใช้ไอเท็ม',
      note: 'ใหม่: ยาสลบ กดเลข 2 แล้วปาลงพื้น ควันจะทำให้ยามที่เข้าใกล้หลับไป 8 วินาที',
    },
    7: {
      name: 'สำนักงานบริษัท', sub: 'กล้องสองตัว ยามสองคน', theme: 'office', seed: 7, arch: 'grid', cols: 3, rows: 2,
      loot: 4, hides: 1, guards: ['guard', 'guard'], cameras: 2, rug: 0.6, density: 1, style: { T: 4, K: 2, S: 1 }, time: 120, par: 85,
      brief: 'ออฟฟิศที่แบ่งเป็นห้องประชุมและห้องทำงาน กล้องคุมจุดอับ ยามสองคนตรวจสลับกัน',
    },
    8: {
      name: 'ห้องนิรภัยใต้ดิน', sub: 'เลเซอร์กั้นทางเดิน', theme: 'vault', seed: 8, arch: 'ring',
      loot: 3, hides: 1, guards: ['guard'], lasers: 3, rug: 0, density: 0.5, style: { K: 2, T: 1 }, time: 120, par: 80,
      brief: 'ทางเดินวงแหวนรอบห้องนิรภัย มีลำแสงเลเซอร์ตัดขวางทางเดิน ต้องรอจังหวะ',
      note: 'ใหม่: เลเซอร์ ลำแสงจะติดดับเป็นจังหวะ ถ้าแตะตอนติด สัญญาณเตือนจะดังทันที รอให้ดับก่อนค่อยเดินผ่าน',
    },
    10: {
      name: 'ภัตตาคารหรู', sub: 'ใช้ตัวหลอกเสียงล่อยาม', theme: 'mansion', seed: 10, arch: 'hall',
      loot: 4, hides: 1, guards: ['guard', 'cop'], cameras: 1, decoy: 2, rug: 0.6, density: 1, style: { T: 4, S: 1, K: 1 }, corrRug: true, time: 130, par: 90,
      brief: 'โถงใหญ่ที่ยามผ่านบ่อย ปีกซ้ายขวามีห้องจัดเลี้ยง ใช้เสียงล่อให้ยามออกห่างจากห้องที่ต้องการ',
      note: 'ใหม่: ตัวหลอกเสียง กดเลข 3 แล้วโยนลงพื้น มันจะส่งเสียงเรียกยามซ้ำ ๆ นาน 6 วินาที',
    },
    11: {
      name: 'ห้องสมุดโบราณ', sub: 'ชั้นหนังสือบังสายตา', theme: 'museum', seed: 11, arch: 'open', stubs: 4,
      loot: 4, hides: 1, guards: ['guard', 'cop'], cameras: 2, sleep: 1, decoy: 1, rug: 0.4, density: 0.9, style: { K: 5, T: 2 }, time: 130, par: 90,
      brief: 'ชั้นหนังสือสูงบังสายตาทั้งผู้เล่นและยาม แต่กล้องสองตัวคอยจับตาจุดสำคัญ',
    },
    12: {
      name: 'คาสิโนใต้ดิน', sub: 'ทางเดินยาว เลเซอร์และยามสามคน', theme: 'casino', seed: 12, arch: 'corridor', top: 4, bot: 4,
      loot: 4, hides: 1, guards: ['guard', 'cop', 'guard'], lasers: 3, decoy: 1, sleep: 1, rug: 0.5, density: 1, style: { T: 3, S: 2, K: 1 }, corrRug: true, time: 140, par: 100,
      brief: 'ห้องเล่นเกมเรียงสองฝั่งของทางเดินยาว ประตูบางบานมีเลเซอร์กั้น ยามสามคนเดินไม่หยุด',
    },
    13: {
      name: 'สถานีตำรวจ', sub: 'ตำรวจแน่นทุกห้อง', theme: 'bank', seed: 13, arch: 'grid', cols: 3, rows: 2,
      loot: 4, hides: 1, guards: ['cop', 'cop', 'guard', 'cop'], cameras: 1, sleep: 2, decoy: 2, rug: 0.3, density: 1, style: { T: 3, K: 2, S: 1 }, time: 150, par: 105,
      brief: 'ที่ที่อันตรายที่สุดสำหรับโจร ตำรวจสี่นายแบ่งกันเดิน ถ้าถูกเห็น ทุกคนจะวิ่งมาเป็นทีม',
    },
    14: {
      name: 'โรงงานเครื่องประดับ', sub: 'เลเซอร์สี่เส้น กล้องสองตัว', theme: 'factory', seed: 14, arch: 'ring',
      loot: 4, hides: 1, guards: ['guard', 'cop'], lasers: 4, cameras: 2, sleep: 1, rug: 0, density: 0.6, style: { K: 3, T: 2 }, time: 140, par: 95,
      brief: 'สายการผลิตวนรอบห้องเก็บของ เลเซอร์เยอะขึ้นและมีกล้องสองตัว ต้องวางแผนเส้นทางดี ๆ',
    },
    16: {
      name: 'คฤหาสน์มหาเศรษฐี', sub: 'ยามสี่คนรวมยามเฝ้าประตู', theme: 'mansion', seed: 16, arch: 'hall',
      loot: 5, hides: 1, guards: ['guard', 'cop', 'guard', 'sentinel'], cameras: 2, lasers: 2, sleep: 2, decoy: 1, rug: 0.7, density: 1.1, style: rich, corrRug: true, time: 160, par: 110,
      brief: 'คฤหาสน์ที่ใหญ่กว่าหลังเก่าหลายเท่า ระบบรักษาความปลอดภัยครบทั้งยาม กล้อง และเลเซอร์',
    },
    17: {
      name: 'เรือสำราญ', sub: 'ทางเดินแคบ ห้องพักเรียงยาว', theme: 'ship', seed: 17, arch: 'corridor', top: 3, bot: 3,
      loot: 5, hides: 1, guards: ['guard', 'cop', 'guard'], lasers: 3, cameras: 2, decoy: 2, rug: 0.5, density: 1, style: { B: 2, T: 2, K: 1, S: 1 }, corrRug: true, time: 160, par: 115,
      brief: 'ห้องพักกว้างบนเรือหรู ยามสามคนสลับกันตามระเบียง เลเซอร์กั้นห้องวีไอพี',
    },
    18: {
      name: 'รถไฟหรูข้ามประเทศ', sub: 'ห้องโดยสารแคบ ๆ เรียงกัน', theme: 'train', seed: 18, arch: 'corridor', top: 5, bot: 5,
      loot: 5, hides: 1, guards: ['guard', 'cop', 'guard'], cameras: 2, lasers: 2, sleep: 2, rug: 0.4, density: 0.8, style: { B: 2, S: 1, T: 1, K: 1 }, corrRug: true, time: 170, par: 120,
      brief: 'ตู้รถไฟที่แบ่งเป็นห้องเล็กสิบห้อง ทางเดินกลางเป็นทางเดียวที่ใช้ได้ ยามเดินตัดผ่านตลอด',
    },
    19: {
      name: 'ห้องเซฟลับใต้ดิน', sub: 'เลเซอร์หกเส้นและยามเฝ้าประตู', theme: 'vault', seed: 19, arch: 'ring',
      loot: 4, hides: 1, guards: ['guard', 'sentinel'], lasers: 6, cameras: 3, sleep: 2, decoy: 2, rug: 0, density: 0.6, style: { K: 3, T: 2 }, time: 170, par: 115,
      brief: 'ระบบป้องกันขั้นสูงสุด เลเซอร์ กล้อง และยามเฝ้าหน้าห้องนิรภัย ใช้ไอเท็มให้เป็นประโยชน์',
    },
    20: {
      name: 'ศูนย์บัญชาการ', sub: 'ด่านสุดท้าย ทุกอย่างรวมกัน', theme: 'command', seed: 20, arch: 'grid', cols: 4, rows: 2,
      loot: 5, hides: 1, guards: ['guard', 'cop', 'guard', 'sentinel', 'sentinel'], cameras: 3, lasers: 3, sleep: 3, decoy: 3, rug: 0.4, density: 1, style: { T: 3, K: 2, S: 1 }, time: 190, par: 130,
      brief: 'ศูนย์ควบคุมของเครือข่ายยามทั้งหมด ยามห้านาย กล้อง เลเซอร์ ครบทุกอย่าง ใช้ทุกทักษะที่เรียนมา',
    },
  };

  // version 3 features layered on the generated specs: disguises, silent shoes, keys, dogs, sleepers
  Object.assign(GEN[7], {
    disguise: 1,
    note: 'ใหม่: ชุดยามปลอมตัว กดเลข 4 ใส่ได้ 12 วินาที ยามจะจำหน้าไม่ได้ถ้าไม่เข้าใกล้ และกล้องก็มองไม่ออก',
  });
  Object.assign(GEN[11], {
    guards: ['guard', 'cop', 'sleeper'], shoes: 2,
    note: 'ใหม่: รองเท้าเงียบ กดเลข 5 เดินเร็วได้โดยไม่มีเสียงฝีเท้า 15 วินาที และยามที่นั่งหลับจะตื่นเมื่อได้ยินเสียงดังใกล้ ๆ',
  });
  Object.assign(GEN[12], {
    locks: 1,
    note: 'ใหม่: ประตูล็อก ห้องที่มีประตูสีน้ำตาลต้องใช้กุญแจ หากุญแจที่วางอยู่ในอาคารแล้วเดินชนประตูเพื่อเปิด',
  });
  Object.assign(GEN[13], {
    guards: ['cop', 'cop', 'guard', 'dog'],
    note: 'ใหม่: หมาตำรวจ มองเห็นไม่ไกลแต่ดมกลิ่นตามรอยที่คุณเดินผ่านได้ การย่องช่วยให้กลิ่นจางเร็วขึ้น',
  });
  Object.assign(GEN[14], {
    guards: ['guard', 'cop', 'sleeper'],
    note: 'ใหม่: ยามนั่งหลับ นั่งหลับอยู่ข้างของมีค่า ตื่นเมื่อได้ยินเสียงดังใกล้ ๆ ย่องผ่านไปเงียบ ๆ หรือใช้ยาสลบ',
  });
  Object.assign(GEN[16], { guards: ['guard', 'cop', 'guard', 'dog', 'sentinel'], locks: 1 });
  Object.assign(GEN[17], { guards: ['guard', 'cop', 'guard', 'sleeper'], locks: 1, disguise: 1 });
  Object.assign(GEN[18], { guards: ['guard', 'cop', 'dog'], locks: 2, shoes: 1 });
  Object.assign(GEN[19], { guards: ['guard', 'sentinel', 'dog'], disguise: 1 });
  Object.assign(GEN[20], { guards: ['guard', 'cop', 'guard', 'dog', 'sentinel', 'sleeper'], locks: 2, disguise: 2, shoes: 2 });

  SB.LEVEL_EN = {
    1: { name: 'First house', sub: 'One guard. Learn to sneak.', brief: 'A small wealthy home with a single guard circling the house. Collect all the valuables, then leave through the same door.' },
    2: { name: 'Canal apartments', sub: 'Cramped rooms, few escapes', brief: 'Four small rooms side by side with one guard walking through all of them. Practice hiding in the plants.' },
    3: { name: 'The old mansion', sub: 'Two guards, one on each side', brief: 'A central hall links four bedrooms. Two guards cross the hall in turn. Hide in the plants and throw rocks to distract them.' },
    4: { name: 'Diamond shop', sub: 'The first security camera', brief: 'An open jewelry shop with a camera sweeping the corner. One guard patrols in a loop.', note: 'New: security cameras. If a camera sees you, the alarm sounds across the building and every guard comes to check.' },
    5: { name: 'Luxury hotel', sub: 'Long corridor, timing matters', brief: 'A long corridor lets guards see far. They take turns walking it. Sneak into the rooms, then time your dash to the exit.' },
    6: { name: 'Private clinic', sub: 'Try the sleeping gas', brief: 'Six exam rooms in a row and two guards passing in narrow halls. Time to try your items.', note: 'New: sleeping gas. Press 2, then throw it at the floor. The gas puts nearby guards to sleep for 8 seconds.' },
    7: { name: 'Office building', sub: 'Two cameras, two guards', brief: 'Meeting rooms and offices. Cameras cover the blind spots and two guards take turns checking.', note: 'New: guard disguise. Press 4 to wear it for 12 seconds. Guards will not recognise you unless you get close, and cameras are fooled.' },
    8: { name: 'Underground vault', sub: 'Lasers across the corridor', brief: 'A ring corridor around the vault with laser beams cutting across. You need to time your moves.', note: 'New: lasers. The beams switch on and off. Touch one while it is on and the alarm sounds. Wait until it is off, then go.' },
    9: { name: 'Central bank', sub: 'A sentinel watches the vault door', brief: 'A wide open lobby. A sentinel scans left and right at the vault door and two more guards pass each other. If you are seen, they call the others on the radio.' },
    10: { name: 'Fine restaurant', sub: 'Lure guards with a noise decoy', brief: 'A big hall guards pass through often, with banquet rooms on both wings. Use noise to pull guards away.', note: 'New: noise decoy. Press 3, then throw it. It keeps calling guards over for 6 seconds.' },
    11: { name: 'Ancient library', sub: 'Shelves block the view', brief: 'Tall shelves block both your view and the guards’. Two cameras watch the key spots.', note: 'New: silent shoes. Press 5 to walk at normal speed with no footstep noise for 15 seconds. A dozing guard wakes up when you make noise close by.' },
    12: { name: 'Underground casino', sub: 'Long hall, lasers and three guards', brief: 'Game rooms line both sides of a long hall. Some doors are blocked by lasers. Three guards never stop moving.', note: 'New: locked doors. A brown door needs a key. Find a key in the building and walk into the door to open it.' },
    13: { name: 'Police station', sub: 'Cops in every room', brief: 'The most dangerous place for a thief. Four officers share the rooms. If you are spotted they come as a team.', note: 'New: police dog. It does not see far, but it can follow your scent trail. Sneaking makes the scent fade faster.' },
    14: { name: 'Jewelry factory', sub: 'Four lasers, two cameras', brief: 'A production line circles the storeroom. More lasers and two cameras. Plan your route carefully.', note: 'New: dozing guard. He naps next to the loot and wakes when he hears loud noise nearby. Sneak past or use the gas.' },
    15: { name: 'Old museum', sub: 'Guards coordinate their zones', brief: 'Gallery halls full of pillars and glass cases. Three guards share the zones. If one sees you, the rest split up and search.' },
    16: { name: 'Billionaire mansion', sub: 'Five guards, a dog and a gate sentinel', brief: 'A mansion many times bigger than the old one. Guards, a dog, cameras, lasers and locked doors.' },
    17: { name: 'Cruise ship', sub: 'Narrow corridors, long row of cabins', brief: 'Spacious cabins on a luxury ship. Three guards and a dozing one work the decks. Lasers guard the VIP rooms.' },
    18: { name: 'Luxury train', sub: 'Small compartments in a row', brief: 'A train car split into ten small compartments. The middle corridor is the only way, and guards walk it all the time.' },
    19: { name: 'Secret underground safe', sub: 'Six lasers, a dog and a sentinel', brief: 'The highest level of protection: lasers, cameras, a sentinel at the vault door, and a dog on your trail. Use every item.' },
    20: { name: 'Command center', sub: 'Final level. Everything together.', brief: 'The control center of the whole guard network. Six guards, cameras, lasers, locks and a dog. Use everything you have learned.' },
  };

  const defs = [level1(), null, level2(), null, level3(), null, null, null, level4(), null, null, null, null, null, level5(), null, null, null, null, null];
  const out = [];
  defs.forEach((d, i) => {
    const pos = i + 1;
    const def = d || SB.genLevel(GEN[pos]);
    if (!def) return;
    def.en = SB.LEVEL_EN[pos];
    out.push(SB.parseLevel(def));
  });
  SB.LEVELS = out;
  SB.parseNewLevel = SB.parseLevel;
})();
