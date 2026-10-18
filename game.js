(function () {
  const SB = window.SB;
  const T = SB.T;
  const A = SB.audio;
  const t = (k, v) => SB.t(k, v);
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const cv = $('#cv');
  const ctx = cv.getContext('2d');

  /* ======================= save data ======================= */
  const SAVE_KEY = 'sneakyBandit.v2';
  const defaults = () => ({
    stars: {}, best: {}, coins: 0, upg: {}, chars: { bob: true }, char: 'bob', lang: 'th', muted: false, music: true,
    rush: false, brain: 'deliberative', unlockAll: false, tutDone: false, endlessBest: 0,
  });
  let save = defaults();
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s) save = Object.assign(save, s);
    else {
      const old = JSON.parse(localStorage.getItem('sneakyBandit.v1'));
      if (old && old.stars) { save.stars = old.stars; save.muted = !!old.muted; save.unlockAll = !!old.unlockAll; }
    }
  } catch (e) { /* storage unavailable */ }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }
  SB.save = save;

  SB.setLang(save.lang);
  A.setMuted(save.muted);
  A.setMusic(save.music);

  const fmtTime = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); };
  const lt = (L, k) => (SB.lang === 'en' && L.en && L.en[k] != null ? L.en[k] : L[k]);

  function playerStats() {
    const c = SB.CHARS[save.char] || SB.CHARS.bob;
    const lv = (k) => save.upg[k] || 0;
    return {
      speed: (1 + 0.05 * lv('speed')) * c.speed,
      noise: Math.max(0.25, 1 - 0.15 * lv('quiet')) * c.noise,
      rocks: lv('rocks'), time: 8 * lv('time'),
      sleep: lv('sleep') + (c.sleep || 0), decoy: lv('decoy') + (c.decoy || 0),
      disguise: lv('disguise'), shoes: lv('shoes'), look: c.look,
    };
  }

  /* ======================= game state ======================= */
  const G = {
    level: null, idx: 0, mode: 'campaign', endless: null, state: 'menu', screenName: 'title',
    player: null, guards: [], loot: [], keyItems: [], carried: 0, keys: 0,
    time: 0, timeMax: 0, elapsed: 0, alert: 0, spotted: 0, incidentCd: 0, anyChase: false,
    t: 0, shake: 0, ai: false, aim: null, staticCv: null, caughtBy: null, flash: null,
    fx: { noise: [], rocks: [], sparks: [], links: [], confetti: [] },
    memory: { hide: {} }, cams: [], lasers: [], gas: [], decoys: [], alarmCd: 0, relayT: 0,
    items: { rock: 0, sleep: 0, decoy: 0, disguise: 0, shoes: 0 }, itemsStart: {}, tool: 'rock',
    trail: [], trailT: 0, runCoins: 0, rushT: 0, rushCount: 0,
    log: null, tut: null, S: null, brain: 'deliberative',
  };
  SB.G = G;

  const brainFor = (id) => (save.brain === 'mixed' ? (id % 2 ? 'reactive' : 'deliberative') : save.brain);

  // hide spots the guards have learned about, nearest to a point first
  G.rememberedHides = function (pos, maxTiles) {
    const out = [];
    G.level.hides.forEach((h) => {
      const c = G.memory.hide[h.x + ',' + h.y] || 0;
      if (c < 1) return;
      const d = Math.hypot((h.x + 0.5) * T - pos.x, (h.y + 0.5) * T - pos.y) / T;
      if (d <= maxTiles) out.push({ x: h.x, y: h.y, c, d });
    });
    return out.sort((a, b) => b.c - a.c || a.d - b.d);
  };

  /* ======================= screens / UI helpers ======================= */
  function showScreen(name) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
    G.screenName = name;
    A.musicPlay(true);
    A.setIntensity(name === 'game' ? 0.1 : 0.05);
  }
  function toast(msg, ms) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.h);
    toast.h = setTimeout(() => el.classList.remove('show'), ms || 1800);
  }
  function stamp(text, cls) {
    const el = $('#stamp');
    el.textContent = text;
    el.className = 'stamp ' + cls;
    void el.offsetWidth;
    el.classList.add('show');
    A.stamp();
  }
  const openModal = (id) => $('#' + id).classList.remove('hidden');
  const closeModal = (id) => $('#' + id).classList.add('hidden');

  const overlay = $('#overlay');
  function showOverlay(html) {
    overlay.innerHTML = '<div class="card">' + html + '</div>';
    overlay.classList.remove('hidden');
  }
  function hideOverlay() { overlay.classList.add('hidden'); overlay.innerHTML = ''; }
  overlay.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    A.resume(); A.click();
    const act = b.dataset.act;
    if (act === 'start') { hideOverlay(); G.state = 'play'; }
    else if (act === 'resume') { hideOverlay(); G.state = 'play'; }
    else if (act === 'retry') restartLevel();
    else if (act === 'next') nextLevel();
    else if (act === 'menu') goMenu();
    else if (act === 'summary') openSummary();
  });

  function goMenu() {
    G.state = 'menu';
    hideOverlay();
    buildLevelGrid();
    showScreen('levels');
  }

  /* ======================= level select ======================= */
  const isUnlocked = (i) => save.unlockAll || i === 0 || (save.stars[i - 1] || 0) >= 1;
  function buildLevelGrid() {
    const grid = $('#levelGrid');
    grid.innerHTML = '';
    let total = 0;
    SB.LEVELS.forEach((L, i) => {
      const st = save.stars[i] || 0;
      total += st;
      const b = document.createElement('button');
      b.className = 'lvl' + (isUnlocked(i) ? '' : ' locked');
      const tags = [t('card.guards', { n: L.guards.length })];
      if (L.cameras.length) tags.push(t('card.cams', { n: L.cameras.length }));
      if (L.lasers.length) tags.push(t('card.lasers', { n: L.lasers.length }));
      if (L.locks.length) tags.push(t('card.locks', { n: L.locks.length }));
      const best = save.best[i] ? '<span class="best">⏱ ' + fmtTime(save.best[i]) + '</span>' : '';
      b.innerHTML =
        '<canvas width="390" height="240"></canvas><div class="info"><span class="num">' + t('card.level', { n: i + 1 }) + ' · ' + tags.join(' · ') +
        '</span><b>' + lt(L, 'name') + '</b><div class="sub">' + lt(L, 'sub') + '</div><div class="stars">' +
        [0, 1, 2].map((k) => '<span class="' + (k < st ? 'on' : '') + '">★</span>').join('') + best + '</div></div>';
      SB.thumb(L, b.querySelector('canvas'));
      b.addEventListener('click', () => {
        if (!isUnlocked(i)) { A.click(); toast(t('toast.locked')); return; }
        A.resume(); A.click();
        startLevelDef(L, i, 'campaign');
      });
      grid.appendChild(b);
    });
    $('#totalStars').textContent = total;
    $('#coinCount').textContent = save.coins;
    $('#endlessBest').textContent = save.endlessBest || 0;
  }

  /* ======================= shop ======================= */
  const avatarCanvases = [];
  function buildShop() {
    $('#shopCoins').textContent = save.coins;
    avatarCanvases.length = 0;
    const cw = $('#charList');
    cw.innerHTML = '';
    SB.CHAR_ORDER.forEach((id) => {
      const c = SB.CHARS[id];
      const owned = !!save.chars[id];
      const sel = save.char === id;
      const d = document.createElement('div');
      d.className = 'char-card' + (sel ? ' sel' : '');
      d.innerHTML = '<canvas width="96" height="96"></canvas><b>' + t('char.' + id) + '</b><small>' + t('char.' + id + '.desc') + '</small>' +
        '<button class="btn small ' + (sel ? 'ghost' : owned ? '' : 'primary') + '" data-char="' + id + '">' +
        (sel ? t('shop.selected') : owned ? t('shop.select') : t('shop.buy', { p: c.price })) + '</button>';
      cw.appendChild(d);
      avatarCanvases.push({ cv: d.querySelector('canvas'), look: c.look });
    });
    const uw = $('#upgList');
    uw.innerHTML = '';
    SB.UPGRADES.forEach((u) => {
      const lv = save.upg[u.id] || 0;
      const maxed = lv >= u.max;
      const cost = u.cost[lv];
      const d = document.createElement('div');
      d.className = 'upg-card';
      d.innerHTML = '<span class="ico">' + SB.icon(u.icon) + '</span><div class="txt"><b>' + t('upg.' + u.id) + '</b><small>' + t('upg.' + u.id + '.desc') + '</small>' +
        '<div class="pips">' + Array.from({ length: u.max }, (_, i) => '<i class="' + (i < lv ? 'on' : '') + '"></i>').join('') + '</div></div>' +
        '<button class="btn small ' + (maxed ? 'ghost' : 'primary') + '" data-upg="' + u.id + '">' + (maxed ? t('shop.max') : '<span class="i-coin"></span> ' + cost) + '</button>';
      uw.appendChild(d);
    });
  }
  $('#screen-shop').addEventListener('click', (e) => {
    const cb = e.target.closest('[data-char]');
    const ub = e.target.closest('[data-upg]');
    if (cb) {
      const id = cb.dataset.char, c = SB.CHARS[id];
      if (!save.chars[id]) {
        if (save.coins < c.price) { toast(t('shop.nocoins')); return; }
        save.coins -= c.price; save.chars[id] = true; A.coin();
      } else A.click();
      save.char = id; persist(); buildShop();
    } else if (ub) {
      const u = SB.UPGRADES.find((x) => x.id === ub.dataset.upg);
      const lv = save.upg[u.id] || 0;
      if (lv >= u.max) return;
      if (save.coins < u.cost[lv]) { toast(t('shop.nocoins')); return; }
      save.coins -= u.cost[lv]; save.upg[u.id] = lv + 1; A.coin(); persist(); buildShop();
    }
  });

  /* ======================= scores / settings modals ======================= */
  function buildScores() {
    let html = '<table class="scores"><thead><tr><th>' + t('scores.level') + '</th><th>' + t('scores.stars') + '</th><th>' + t('scores.best') + '</th></tr></thead><tbody>';
    SB.LEVELS.forEach((L, i) => {
      const st = save.stars[i] || 0;
      html += '<tr><td>' + (i + 1) + '. ' + lt(L, 'name') + '</td><td class="gold">' + '★'.repeat(st) + '<span class="dim">' + '★'.repeat(3 - st) + '</span></td><td>' + (save.best[i] ? fmtTime(save.best[i]) : '-') + '</td></tr>';
    });
    html += '</tbody></table><div class="score-foot"><span>★ ' + Object.keys(save.stars).reduce((a, k) => a + save.stars[k], 0) + ' / ' + SB.LEVELS.length * 3 +
      '</span><span><span class="i-coin"></span> ' + save.coins + '</span><span>🔁 ' + t('scores.endless') + ': ' + (save.endlessBest || 0) + '</span></div>';
    $('#scoresBody').innerHTML = html;
  }
  function buildSettings() {
    const on = (b) => (b ? ' on' : '');
    $('#settingsBody').innerHTML =
      '<div class="set-row"><span>' + t('set.sound') + '</span><button class="tgl' + on(!save.muted) + '" data-set="sound">' + (save.muted ? t('set.off') : t('set.on')) + '</button></div>' +
      '<div class="set-row"><span>' + t('set.music') + '</span><button class="tgl' + on(save.music) + '" data-set="music">' + (save.music ? t('set.on') : t('set.off')) + '</button></div>' +
      '<div class="set-row"><span>' + t('set.lang') + '</span><span class="seg"><button class="' + (SB.lang === 'th' ? 'on' : '') + '" data-set="lang" data-v="th">ไทย</button><button class="' + (SB.lang === 'en' ? 'on' : '') + '" data-set="lang" data-v="en">English</button></span></div>' +
      '<div class="set-row"><span>' + t('set.rush') + '<small>' + t('set.rush.desc') + '</small></span><button class="tgl' + on(save.rush) + '" data-set="rush">' + (save.rush ? t('set.on') : t('set.off')) + '</button></div>' +
      '<div class="set-row col"><span>' + t('set.brain') + '<small>' + t('set.brain.desc') + '</small></span><span class="seg three">' +
      ['deliberative', 'reactive', 'mixed'].map((b) => '<button class="' + (save.brain === b ? 'on' : '') + '" data-set="brain" data-v="' + b + '">' + t('brain.' + b) + '</button>').join('') + '</span></div>';
  }
  $('#settingsBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]');
    if (!b) return;
    const k = b.dataset.set, v = b.dataset.v;
    A.resume(); A.click();
    if (k === 'sound') { save.muted = !save.muted; A.setMuted(save.muted); }
    else if (k === 'music') { save.music = !save.music; A.setMusic(save.music); }
    else if (k === 'lang') { save.lang = v; SB.setLang(v); refreshLanguage(); }
    else if (k === 'rush') save.rush = !save.rush;
    else if (k === 'brain') save.brain = v;
    persist();
    buildSettings();
  });
  function refreshLanguage() {
    SB.applyI18n(document);
    document.documentElement.lang = SB.lang;
    if (G.screenName === 'levels') buildLevelGrid();
    if (G.screenName === 'shop') buildShop();
    if ($('#scoresModal') && !$('#scoresModal').classList.contains('hidden')) buildScores();
    updateHud(true);
  }

  /* ======================= start a level ======================= */
  function startLevelDef(L, idx, mode) {
    G.mode = mode;
    G.idx = idx;
    G.level = L;
    L.opened = {};
    G.staticCv = SB.buildStatic(L);
    G.S = playerStats();
    G.brain = save.brain;
    G.player = {
      x: (L.start.x + 0.5) * T, y: (L.start.y + 0.5) * T, angle: 0, walk: 0, sneaking: false, hidden: false, stepT: 0,
      wasHidden: false, disguiseT: 0, shoesT: 0, look: G.S.look,
    };
    G.player.angle = L.exit.x === 0 ? 0 : L.exit.x === L.w - 1 ? Math.PI : 0;
    G.guards = L.guards.map((d, k) => new SB.Guard(d, k, L, brainFor(k)));
    G.loot = L.loot.map((l) => ({ x: (l.tx + 0.5) * T, y: (l.ty + 0.5) * T, got: false }));
    G.keyItems = L.keys.map((k) => ({ x: (k.tx + 0.5) * T, y: (k.ty + 0.5) * T, got: false }));
    G.carried = 0;
    G.keys = 0;
    const it = L.items;
    G.items = {
      rock: L.rocks + G.S.rocks, sleep: it.sleep + G.S.sleep, decoy: it.decoy + G.S.decoy,
      disguise: it.disguise + G.S.disguise, shoes: it.shoes + G.S.shoes,
    };
    G.itemsStart = Object.assign({}, G.items);
    G.tool = 'rock';
    G.memory = { hide: {} };
    G.cams = L.cameras.map((c) => Object.assign({}, c, { meter: 0, cd: 0, angle: c.a0 }));
    G.lasers = L.lasers.map((l) => ({
      ax: (l.ax + 0.5) * T, ay: (l.ay + 0.5) * T, bx: (l.bx + 0.5) * T, by: (l.by + 0.5) * T,
      on: l.on || 2, off: l.off || 1.5, ph: l.ph || 0, active: false, warn: false,
    }));
    G.gas = []; G.decoys = []; G.trail = []; G.trailT = 0;
    G.alarmCd = 0; G.relayT = 0;
    G.timeMax = L.time + G.S.time;
    G.time = G.timeMax;
    G.elapsed = 0;
    G.alert = 0; G.spotted = 0; G.incidentCd = 0; G.anyChase = false; G.shake = 0; G.caughtBy = null; G.flash = null;
    G.runCoins = 0; G.rushT = 0; G.rushCount = 0;
    G.fx = { noise: [], rocks: [], sparks: [], links: [], confetti: [] };
    G.log = { guards: [], msgs: [], events: [], end: 0, levelName: mode === 'endless' ? t('endless.name', { n: G.endless.streak }) : lt(L, 'name'), result: '', brain: save.brain };
    G.guards.forEach(registerGuardLog);
    G.tut = (mode === 'campaign' && idx === 0 && !save.tutDone) ? { step: 0, sneakT: 0, hid: false, thrown: false, moved: 0 } : null;
    G.state = 'intro';
    $('#stamp').className = 'stamp';
    $('#summaryBtnRow') && ($('#summaryBtnRow').innerHTML = '');
    showScreen('game');
    const stage = $('#stage');
    stage.classList.remove('fade'); void stage.offsetWidth; stage.classList.add('fade');
    updateHud(true);
    updateTutorial();

    const name = mode === 'endless' ? t('endless.name', { n: G.endless.streak }) : lt(L, 'name');
    const brief = mode === 'endless' ? t('endless.brief') : lt(L, 'brief');
    let extra = '';
    const note = mode === 'endless' ? '' : lt(L, 'note');
    if (note) extra += '<p class="new-note">' + note + '</p>';
    if (mode === 'campaign' && idx === 0) extra += '<p class="ctrl-note">' + t('intro.controls') + '</p>';
    const hasItems = it.sleep || it.decoy || it.disguise || it.shoes || G.items.sleep || G.items.decoy || G.items.disguise || G.items.shoes;
    if (hasItems) extra += '<p class="ctrl-note">' + t('intro.items') + '</p>';
    const tag = mode === 'endless' ? t('endless.tag', { n: G.endless.streak }) : t('intro.tag', { n: idx + 1, total: SB.LEVELS.length });
    const goals = '<ul class="goals"><li><i>💰</i>' + t('intro.goal.loot', { n: L.loot.length }) + '</li>' +
      (L.locks.length ? '<li><i>🔑</i>' + t('intro.goal.keys', { n: L.locks.length }) + '</li>' : '') +
      '<li><i>🚪</i>' + t('intro.goal.exit') + '</li>' +
      '<li><i>⏱</i>' + t('intro.goal.time', { t: Math.round(G.timeMax), p: L.par }) + '</li>' +
      (save.rush ? '<li class="warn"><i>🚓</i>' + t('intro.goal.rush') + '</li>' : '') + '</ul>';
    showOverlay('<span class="tag">' + tag + '</span><h2>' + name + '</h2><p>' + brief + '</p>' + goals + extra +
      '<button class="btn primary" data-act="start">' + t('intro.start') + '</button>');
  }
  function restartLevel() {
    if (G.mode === 'endless') startEndless(G.endless.streak, true);
    else startLevelDef(SB.LEVELS[G.idx], G.idx, 'campaign');
  }
  function nextLevel() {
    if (G.mode === 'endless') startEndless(G.endless.streak + 1);
    else if (G.idx + 1 < SB.LEVELS.length) startLevelDef(SB.LEVELS[G.idx + 1], G.idx + 1, 'campaign');
    else goMenu();
  }
  function startEndless(streak, same) {
    let L = null;
    if (same && G.endless.cached) L = G.endless.cached;
    else {
      for (let k = 0; k < 8 && !L; k++) {
        const spec = SB.randomSpec(streak, (Date.now() % 100000) + streak * 131 + k * 17);
        const def = SB.genLevel(spec);
        if (def) L = SB.parseLevel(def);
      }
    }
    if (!L) { toast(t('toast.genfail')); return; }
    G.endless = { streak, cached: L };
    startLevelDef(L, -1, 'endless');
  }

  /* ======================= behaviour log (for the after-action report) ======================= */
  function registerGuardLog(g) {
    G.log.guards.push({ id: g.id, type: g.type, brain: g.brain, tl: [{ s: g.state, t0: G.elapsed, t1: null }] });
    g._ps = g.state;
  }
  function logStates() {
    G.guards.forEach((g) => {
      if (g._ps === g.state) return;
      const entry = G.log.guards.find((q) => q.id === g.id);
      if (!entry) return;
      const last = entry.tl[entry.tl.length - 1];
      if (last) last.t1 = G.elapsed;
      entry.tl.push({ s: g.state, t0: G.elapsed, t1: null });
      g._ps = g.state;
    });
  }
  G.msg = function (type, from, to, info) {
    G.log.msgs.push({ t: G.elapsed, type, from, to, info, i: G.log.msgs.length });
  };
  const logEvent = (kind, info) => G.log.events.push({ t: G.elapsed, kind, info });
  function finalizeLog(result) {
    logStates();
    G.log.end = G.elapsed;
    G.log.result = result;
    G.log.guards.forEach((q) => { const l = q.tl[q.tl.length - 1]; if (l && l.t1 == null) l.t1 = G.elapsed; });
  }
  function openSummary() {
    openModal('sumModal');
    SB.drawSummary($('#summaryCv'), G);
  }

  /* ======================= input ======================= */
  const keys = {};
  let sneakToggle = false;
  const joy = { active: false, id: null, dx: 0, dy: 0 };

  window.addEventListener('keydown', (e) => {
    if (G.screenName !== 'game') return;
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].indexOf(e.code) >= 0) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (!$('#sumModal').classList.contains('hidden')) closeModal('sumModal'); else togglePause();
    }
    else if (e.code === 'KeyR') { if (G.state !== 'intro') restartLevel(); }
    else if (e.code === 'Tab') toggleAI();
    else if (e.code === 'KeyM') { save.muted = !save.muted; A.setMuted(save.muted); persist(); }
    else if (e.code === 'Space' && G.aim) useTool(G.aim.x, G.aim.y);
    else if (e.code === 'Digit1') selectTool('rock');
    else if (e.code === 'Digit2') selectTool('sleep');
    else if (e.code === 'Digit3') selectTool('decoy');
    else if (e.code === 'Digit4') selectTool('disguise');
    else if (e.code === 'Digit5') selectTool('shoes');
    else if (e.code === 'Enter' && G.state === 'intro') { hideOverlay(); G.state = 'play'; }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (G.state === 'play') togglePause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') togglePause(); });

  function gamePos(e) {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * cv.width) / r.width, y: ((e.clientY - r.top) * cv.height) / r.height };
  }
  cv.addEventListener('pointermove', (e) => { G.aim = gamePos(e); });
  cv.addEventListener('pointerleave', () => { G.aim = null; });
  cv.addEventListener('pointerdown', (e) => {
    A.resume();
    const p = gamePos(e);
    G.aim = p;
    useTool(p.x, p.y);
  });

  const joyEl = $('#joy'), knob = $('#joyKnob');
  function joyMove(e) {
    const r = joyEl.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    joy.dx = dx; joy.dy = dy;
    knob.style.transform = 'translate(' + dx * 30 + 'px,' + dy * 30 + 'px)';
  }
  joyEl.addEventListener('pointerdown', (e) => { A.resume(); joy.active = true; joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e); e.preventDefault(); });
  joyEl.addEventListener('pointermove', (e) => { if (joy.active && e.pointerId === joy.id) joyMove(e); });
  const joyEnd = (e) => { if (e.pointerId !== joy.id) return; joy.active = false; joy.dx = joy.dy = 0; knob.style.transform = ''; };
  joyEl.addEventListener('pointerup', joyEnd);
  joyEl.addEventListener('pointercancel', joyEnd);
  $('#btnSneak').addEventListener('pointerdown', (e) => { e.preventDefault(); sneakToggle = !sneakToggle; e.currentTarget.classList.toggle('on', sneakToggle); });

  function togglePause() {
    if (G.state === 'play') {
      G.state = 'paused';
      showOverlay('<h2>' + t('pause.title') + '</h2><p>' + t('pause.text') + '</p><div class="row"><button class="btn primary" data-act="resume">' + t('pause.resume') +
        '</button><button class="btn" data-act="retry">' + t('pause.retry') + '</button><button class="btn ghost" data-act="menu">' + t('pause.menu') + '</button></div>');
    } else if (G.state === 'paused') { hideOverlay(); G.state = 'play'; }
  }
  function toggleAI() {
    G.ai = !G.ai;
    $('#btnAI').classList.toggle('on', G.ai);
    toast(G.ai ? t('toast.ai.on') : t('toast.ai.off'));
  }

  /* ======================= items ======================= */
  function selectTool(id) {
    if (G.state !== 'play' && G.state !== 'intro' && G.state !== 'paused') return;
    const def = SB.TOOLS.find((x) => x.id === id);
    if (id !== 'rock' && !G.itemsStart[id]) { toast(t('toast.noitem')); return; }
    if (def.instant) { if (G.state === 'play') useInstant(id); return; }
    if (G.items[id] <= 0) { toast(t('toast.itemempty')); return; }
    G.tool = id;
    A.click();
    updateHud(true);
  }
  function useInstant(id) {
    const p = G.player;
    if (G.items[id] <= 0) { toast(t('toast.itemempty')); return; }
    if (id === 'disguise') {
      if (p.disguiseT > 0) return;
      p.disguiseT = 12; toast(t('toast.disguise'));
    } else {
      if (p.shoesT > 0) return;
      p.shoesT = 15; toast(t('toast.shoes'));
    }
    G.items[id]--;
    A.power();
    logEvent('item', id);
    updateHud(true);
  }
  function useTool(tx, ty) {
    if (G.state !== 'play') return;
    const kind = G.tool;
    if (G.items[kind] <= 0) { toast(t('toast.itemempty')); if (G.items.rock > 0) G.tool = 'rock'; updateHud(true); return; }
    const p = G.player;
    let dx = tx - p.x, dy = ty - p.y;
    let d = Math.hypot(dx, dy);
    if (d < 6) return;
    const max = 250;
    if (d > max) { dx *= max / d; dy *= max / d; d = max; }
    let lx = p.x, ly = p.y;
    const n = Math.ceil(d / 4);
    for (let i = 1; i <= n; i++) {
      const nx = p.x + (dx * i) / n, ny = p.y + (dy * i) / n;
      if (SB.solidPx(G.level, nx, ny)) break;
      lx = nx; ly = ny;
    }
    G.items[kind]--;
    G.fx.rocks.push({ x0: p.x, y0: p.y, x1: lx, y1: ly, t: 0, dur: 0.15 + d / 700, kind });
    A.throwRock();
    if (G.tut) G.tut.thrown = true;
    logEvent('item', kind);
    if (G.items[kind] <= 0 && kind !== 'rock') G.tool = 'rock';
    updateHud(true);
  }

  /* ======================= agents: noise, radio, contract net ======================= */
  G.noise = function (x, y, radius, kind) {
    const col = kind === 'rock' ? 'rgba(255,214,90,A)' : kind === 'decoy' ? 'rgba(120,255,200,A)' : 'rgba(255,255,255,A)';
    G.fx.noise.push({ x, y, r: 0, max: radius, kind, color: col, alpha: kind === 'step' ? 0.35 : 0.8 });
    if (kind === 'step') A.step();
    G.guards.forEach((g) => g.hear(x, y, radius));
  };

  G.onChase = function (g) {
    if (G.incidentCd <= 0 && !G.anyChase) {
      G.alert = Math.min(3, G.alert + 1);
      G.spotted++;
      G.incidentCd = 1.2;
      A.alert();
      toast(t('toast.spotted'), 2200);
    }
    logEvent('spotted', g.id);
    if (!g.reactive) G.radioBroadcast(g);
  };

  // cost of a guard taking over a search task: walking distance plus how
  // reluctant it is to leave its post
  function bidCost(g, task) {
    const L = G.level;
    const p = SB.findPath(L, Math.floor(g.x / T), Math.floor(g.y / T), Math.floor(task.x / T), Math.floor(task.y / T));
    let cost = (p.length || 30) * T;
    if (g.sentinel || g.nap) cost += 220;
    if (g.state === 'investigate') cost -= 40;
    if (g.type === 'dog') cost -= 60;
    return Math.max(1, cost);
  }

  // Contract Net Protocol: the manager announces the search tasks (CFP), each
  // free contractor bids its cost, and every task is awarded to the lowest bid.
  G.cnp = function (manager, contractors, pos) {
    const L = G.level;
    const mid = manager.id != null ? manager.id : -1;
    contractors = contractors.filter((g) => g !== manager && g.state !== 'chase' && g.state !== 'asleep' && !g.reactive);
    if (!contractors.length) return;
    const n = contractors.length;
    const tasks = [{ x: pos.x, y: pos.y }];
    G.rememberedHides(pos, 7).forEach((h) => { if (tasks.length < n) tasks.push({ x: (h.x + 0.5) * T, y: (h.y + 0.5) * T }); });
    const base = Math.random() * 6.28;
    const need = n - tasks.length;
    for (let i = 0; i < need; i++) {
      const a = base + (i * 6.283) / Math.max(1, need);
      tasks.push(SB.snapPx(L, pos.x + Math.cos(a) * T * 3.4, pos.y + Math.sin(a) * T * 3.4));
    }
    contractors.forEach((g) => G.msg('cfp', mid, g.id, { n }));
    let remaining = contractors.slice();
    tasks.forEach((task, j) => {
      if (!remaining.length) return;
      const bids = remaining.map((g) => ({ g, cost: bidCost(g, task) }));
      bids.forEach((b) => G.msg('bid', b.g.id, mid, { task: j, cost: Math.round(b.cost) }));
      bids.sort((a, b) => a.cost - b.cost);
      const w = bids[0].g;
      G.msg('award', mid, w.id, { task: j });
      remaining = remaining.filter((x) => x !== w);
      const extra = SB.snapPx(L, task.x + (Math.random() - 0.5) * T * 4, task.y + (Math.random() - 0.5) * T * 4);
      w.radioAlert([task, extra], { pos: { x: pos.x, y: pos.y }, t: G.t, from: mid });
      G.fx.links.push({ a: manager.id != null ? manager : { x: pos.x, y: pos.y }, b: w, t: 1.6 });
    });
  };

  // radio message with limited range: only guards within range hear it
  G.radioBroadcast = function (from) {
    const pos = from.lastSeen || { x: from.x, y: from.y };
    G.fx.noise.push({ x: from.x, y: from.y, r: 0, max: SB.RADIO_RANGE, kind: 'radio', color: 'rgba(80,220,255,A)', alpha: 0.6 });
    const heard = G.guards.filter((o) => o !== from && !o.reactive && o.state !== 'chase' && o.state !== 'asleep' &&
      Math.hypot(o.x - from.x, o.y - from.y) <= SB.RADIO_RANGE);
    if (!heard.length) return;
    G.cnp(from, heard, pos);
  };

  // a guard that already knows about the thief passes the news on to a
  // teammate that walks into radio range
  function relayTick(dt) {
    G.relayT -= dt;
    if (G.relayT > 0) return;
    G.relayT = 0.5;
    const informed = G.guards.filter((g) => !g.reactive && g.info && G.t - g.info.t < 25 && (g.state === 'search' || g.state === 'chase'));
    if (!informed.length) return;
    const calm = ['patrol', 'sentinel', 'return', 'investigate', 'track'];
    G.guards.forEach((u) => {
      if (u.reactive || (u.info && G.t - u.info.t < 25) || calm.indexOf(u.state) < 0) return;
      const src = informed.find((i) => Math.hypot(i.x - u.x, i.y - u.y) <= SB.RADIO_RANGE);
      if (!src) return;
      const pos = src.info.pos;
      const L = G.level;
      G.msg('relay', src.id, u.id, null);
      const extra = SB.snapPx(L, pos.x + (Math.random() - 0.5) * T * 4, pos.y + (Math.random() - 0.5) * T * 4);
      u.radioAlert([{ x: pos.x, y: pos.y }, extra], { pos: { x: pos.x, y: pos.y }, t: G.t, from: src.id });
      G.fx.links.push({ a: src, b: u, t: 1.6 });
    });
  }

  // Alarm from a camera or a laser: the building's alarm system tells every guard
  G.alarm = function (pos, src) {
    if (G.alarmCd > 0) return;
    G.alarmCd = 3;
    G.spotted++;
    G.alert = Math.min(3, G.alert + 1);
    A.siren();
    G.shake = 0.25;
    logEvent('spotted', -1);
    toast(t(src === 'laser' ? 'toast.laser' : 'toast.camera'), 2400);
    const sys = { id: -1, x: pos.x, y: pos.y };
    G.cnp(sys, G.guards, pos);
    G.guards.forEach((g) => {
      if (g.reactive && g.state !== 'chase' && g.state !== 'asleep') { G.msg('award', -1, g.id, null); g.investigate(pos.x, pos.y); }
    });
  };

  G.caught = function (g) {
    if (G.state !== 'play') return;
    G.state = 'caught';
    G.caughtBy = g;
    G.shake = 0.6;
    G.flash = { t: 0.8, col: 'rgba(255,40,40,A)' };
    A.caught();
    stamp(t('stamp.busted'), 'bad');
    finalizeLog(t('res.caught', { n: g.id + 1 }));
    const gain = Math.round(G.runCoins * 0.3);
    if (gain) { save.coins += gain; persist(); }
    setTimeout(() => {
      if (G.state !== 'caught') return;
      showOverlay('<h2 class="big-title bad">' + t('res.caught.title') + '</h2><p>' + t('res.caught.text', { n: g.id + 1 }) + '</p>' + (gain ? '<p class="meta"><span class="i-coin"></span> +' + gain + ' ' + t('res.consolation') + '</p>' : '') +
        endlessLine(false) + '<div class="row"><button class="btn primary" data-act="retry">' + t('res.retry') + '</button><button class="btn" data-act="summary">' + t('res.summary') + '</button><button class="btn ghost" data-act="menu">' + t('res.menu') + '</button></div>');
    }, 1100);
  };

  function endlessLine(win) {
    if (G.mode !== 'endless') return '';
    if (!win && G.endless.streak - 1 > (save.endlessBest || 0)) { save.endlessBest = G.endless.streak - 1; persist(); }
    return '<p class="meta">🔁 ' + t('endless.streak', { n: G.endless.streak - (win ? 0 : 1) }) + ' · ' + t('scores.endless') + ': ' + (save.endlessBest || 0) + '</p>';
  }

  function fail() {
    G.state = 'failed';
    A.lose();
    stamp(t('stamp.timeup'), 'bad');
    finalizeLog(t('res.timeout'));
    const gain = Math.round(G.runCoins * 0.3);
    if (gain) { save.coins += gain; persist(); }
    setTimeout(() => {
      if (G.state !== 'failed') return;
      showOverlay('<h2 class="big-title bad">' + t('res.timeout.title') + '</h2><p>' + t('res.timeout.text') + '</p>' + (gain ? '<p class="meta"><span class="i-coin"></span> +' + gain + ' ' + t('res.consolation') + '</p>' : '') +
        endlessLine(false) + '<div class="row"><button class="btn primary" data-act="retry">' + t('res.retry') + '</button><button class="btn" data-act="summary">' + t('res.summary') + '</button><button class="btn ghost" data-act="menu">' + t('res.menu') + '</button></div>');
    }, 900);
  }

  function win() {
    G.state = 'won';
    const L = G.level;
    const used = G.elapsed;
    const left = G.time;
    A.win();
    stamp(t('stamp.clear'), 'good');
    for (let i = 0; i < 150; i++) {
      G.fx.confetti.push({
        x: Math.random() * SB.W, y: -10 - Math.random() * 260, vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 120,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, col: ['#ffc83d', '#ff5a55', '#3dd6c6', '#7fd1ff', '#c79bff', '#9be37a'][i % 6],
      });
    }
    finalizeLog(t('res.win'));
    const mult = save.rush ? 1.5 : 1;
    let stars = 0, s2 = false, s3 = false, newBest = false;
    let bonusTime = Math.round(left * 2 * mult);
    let gain;
    let html;
    if (G.mode === 'campaign') {
      s2 = used <= L.par; s3 = G.spotted === 0;
      stars = 1 + (s2 ? 1 : 0) + (s3 ? 1 : 0);
      if ((save.stars[G.idx] || 0) < stars) save.stars[G.idx] = stars;
      if (!save.best[G.idx] || used < save.best[G.idx]) { save.best[G.idx] = Math.round(used); newBest = true; }
      gain = Math.round(G.runCoins * mult) + bonusTime + stars * 50;
      if (G.idx === 0) save.tutDone = true;
    } else {
      gain = Math.round(G.runCoins * mult) + bonusTime + G.endless.streak * 20;
      if (G.endless.streak > (save.endlessBest || 0)) save.endlessBest = G.endless.streak;
    }
    save.coins += gain;
    persist();
    const hasNext = G.mode === 'endless' || G.idx + 1 < SB.LEVELS.length;
    if (G.mode === 'campaign') {
      html = '<h2 class="big-title good">' + t('res.win.title') + '</h2><div class="stars-big"><span>★</span><span>★</span><span>★</span></div>' +
        '<ul class="goals"><li class="ok"><i>✓</i>' + t('res.goal.done') + '</li>' +
        '<li class="' + (s2 ? 'ok' : 'no') + '"><i>' + (s2 ? '✓' : '✗') + '</i>' + t('res.goal.time', { p: L.par, u: Math.round(used) }) + '</li>' +
        '<li class="' + (s3 ? 'ok' : 'no') + '"><i>' + (s3 ? '✓' : '✗') + '</i>' + t('res.goal.unseen') + (s3 ? '' : ' (' + G.spotted + ')') + '</li></ul>' +
        '<p class="meta"><span class="i-coin"></span> +' + gain + (save.rush ? ' (×1.5)' : '') + (newBest ? ' · 🏆 ' + t('res.record', { t: fmtTime(used) }) : '') + '</p>';
    } else {
      html = '<h2 class="big-title good">' + t('res.win.title') + '</h2><p class="meta">' + t('endless.cleared', { n: G.endless.streak }) + '</p><p class="meta"><span class="i-coin"></span> +' + gain + '</p>' + endlessLine(true);
    }
    html += '<div class="row">' + (hasNext ? '<button class="btn primary" data-act="next">' + t('res.next') + '</button>' : '') +
      '<button class="btn" data-act="retry">' + t('res.replay') + '</button><button class="btn" data-act="summary">' + t('res.summary') + '</button><button class="btn ghost" data-act="menu">' + t('res.menu') + '</button></div>';
    setTimeout(() => {
      if (G.state !== 'won') return;
      showOverlay(html);
      const spans = overlay.querySelectorAll('.stars-big span');
      for (let k = 0; k < stars; k++) setTimeout(() => { spans[k].classList.add('on'); A.star(k); }, 350 + k * 380);
    }, 1100);
  }

  /* ======================= update ======================= */
  function updatePlayer(dt) {
    const p = G.player, L = G.level, S = G.S;
    let ax = 0, ay = 0;
    if (keys.KeyA || keys.ArrowLeft) ax -= 1;
    if (keys.KeyD || keys.ArrowRight) ax += 1;
    if (keys.KeyW || keys.ArrowUp) ay -= 1;
    if (keys.KeyS || keys.ArrowDown) ay += 1;
    if (joy.active) { ax = joy.dx; ay = joy.dy; }
    let len = Math.hypot(ax, ay);
    if (len > 1) { ax /= len; ay /= len; len = 1; }
    let sneak = !!(keys.ShiftLeft || keys.ShiftRight || sneakToggle);
    if (joy.active && len > 0.1 && len < 0.55) sneak = true;
    p.sneaking = sneak;
    if (p.disguiseT > 0) p.disguiseT = Math.max(0, p.disguiseT - dt);
    if (p.shoesT > 0) p.shoesT = Math.max(0, p.shoesT - dt);
    const moved = len > 0.1;
    const speed = (sneak ? 50 : 104) * S.speed;
    if (moved) {
      const k = joy.active && len <= 0.55 ? len / 0.55 : 1;
      const vx = (ax / len) * speed * k, vy = (ay / len) * speed * k;
      const nx = p.x + vx * dt, ny = p.y + vy * dt;
      if (SB.free(L, nx, p.y, 9)) p.x = nx;
      if (SB.free(L, p.x, ny, 9)) p.y = ny;
      const target = Math.atan2(ay, ax);
      const d = SB.angDiff(p.angle, target);
      p.angle += Math.abs(d) < 12 * dt ? d : Math.sign(d) * 12 * dt;
      p.walk += speed * dt;
      if (G.tut) { G.tut.moved += speed * dt; if (sneak) G.tut.sneakT += dt; }
      // scent trail followed by dogs (sneaking leaves a faint trail that fades sooner)
      G.trailT -= dt;
      if (G.trailT <= 0) {
        G.trailT = sneak ? 0.35 : 0.2;
        G.trail.push({ x: p.x, y: p.y, t: G.t - (sneak ? 6 : 0) });
        while (G.trail.length && G.t - G.trail[0].t > 14) G.trail.shift();
      }
    }
    p.hidden = SB.tileAt(L, Math.floor(p.x / T), Math.floor(p.y / T)) === 'H';
    if (p.hidden && !p.wasHidden) {
      const key = Math.floor(p.x / T) + ',' + Math.floor(p.y / T);
      const c = (G.memory.hide[key] || 0) + 1;
      G.memory.hide[key] = c;
      if (c === 2) toast(t('toast.hidelearn'), 2600);
      logEvent('hide_start');
      if (G.tut) G.tut.hid = true;
    } else if (!p.hidden && p.wasHidden) logEvent('hide_end');
    p.wasHidden = p.hidden;
    if (moved && !sneak && !p.hidden && p.shoesT <= 0) {
      p.stepT -= dt;
      if (p.stepT <= 0) { p.stepT = 0.38; G.noise(p.x, p.y, 85 * S.noise, 'step'); }
    } else if (!moved) p.stepT = 0;
  }

  function updateFx(dt) {
    const f = G.fx;
    f.noise.forEach((n) => { n.r += (n.kind === 'step' ? 150 : n.kind === 'radio' ? 420 : 320) * dt; });
    f.noise = f.noise.filter((n) => n.r < n.max);
    f.rocks.forEach((r) => {
      r.t += dt;
      if (!r.landed && r.t >= r.dur) {
        r.landed = true;
        A.thud();
        if (r.kind === 'rock') G.noise(r.x1, r.y1, 210, 'rock');
        else if (r.kind === 'sleep') { G.gas.push({ x: r.x1, y: r.y1, r: 72, t: 0, dur: 4.5 }); A.hiss(); }
        else G.decoys.push({ x: r.x1, y: r.y1, t: 0, dur: 6, next: 0 });
      }
    });
    f.rocks = f.rocks.filter((r) => !r.landed);
    G.gas.forEach((q) => { q.t += dt; });
    G.gas = G.gas.filter((q) => q.t < q.dur);
    G.decoys.forEach((q) => { q.t += dt; });
    G.decoys = G.decoys.filter((q) => q.t < q.dur);
    f.sparks.forEach((s) => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 120 * dt; s.life -= dt * 1.4; });
    f.sparks = f.sparks.filter((s) => s.life > 0);
    f.links.forEach((l) => { l.t -= dt; });
    f.links = f.links.filter((l) => l.t > 0);
    f.confetti.forEach((q) => { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 90 * dt; q.rot += q.vr * dt; });
    f.confetti = f.confetti.filter((q) => q.y < SB.H + 30);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 1.2);
    if (G.flash && G.flash.t > 0) G.flash.t -= dt;
  }

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - (ax + dx * k), py - (ay + dy * k));
  }

  function updateHazards(dt) {
    const p = G.player, L = G.level;
    G.cams.forEach((c) => {
      c.angle = c.a0 + Math.sin(G.t * 0.8 + c.ph) * c.sweep;
      if (c.cd > 0) { c.cd -= dt; c.meter = 0; return; }
      const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
      let seen = false;
      if (!(p.hidden && d > 26) && !(p.disguiseT > 0) && d <= c.range && Math.abs(SB.angDiff(c.angle, Math.atan2(dy, dx))) <= c.fov / 2 && SB.los(L, c.x, c.y, p.x, p.y)) seen = true;
      const before = c.meter;
      if (seen) c.meter = Math.min(1, c.meter + (1 + (1 - d / c.range) * 2) * (p.sneaking ? 0.8 : 1) * dt);
      else c.meter = Math.max(0, c.meter - 0.8 * dt);
      if (before < 0.15 && c.meter >= 0.15) A.beep();
      if (c.meter >= 1) { c.meter = 0; c.cd = 6; G.alarm({ x: p.x, y: p.y }, 'camera'); }
    });
    G.lasers.forEach((l) => {
      const cyc = l.on + l.off;
      const k = (G.t + l.ph) % cyc;
      l.active = k < l.on;
      l.warn = !l.active && k > cyc - 0.5;
      if (l.active && segDist(p.x, p.y, l.ax, l.ay, l.bx, l.by) < 8.5) { A.zap(); G.alarm({ x: p.x, y: p.y }, 'laser'); }
    });
    G.gas.forEach((q) => {
      const rad = q.r * Math.min(1, 0.35 + q.t / 0.5);
      G.guards.forEach((g) => {
        if (g.state !== 'asleep' && Math.hypot(g.x - q.x, g.y - q.y) < rad) {
          g.sleep(8);
          toast(t('toast.gas'));
          for (let i = 0; i < 8; i++) G.fx.sparks.push({ x: g.x, y: g.y, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 40, life: 1, col: '#9be8b0' });
        }
      });
    });
    G.decoys.forEach((q) => {
      q.next -= dt;
      if (q.next <= 0) { q.next = 0.9; G.noise(q.x, q.y, 160, 'decoy'); }
    });
  }

  // "rush" mode: the longer you stay, the more police arrive through the entrance
  function updateRush(dt) {
    if (!save.rush) return;
    G.rushT += dt;
    const interval = 40;
    if (G.rushT >= interval && G.rushCount < 4) {
      G.rushT = 0;
      G.rushCount++;
      const L = G.level, p = G.player;
      const lootTile = L.loot[G.rushCount % L.loot.length];
      const def = { type: 'cop', route: [[L.start.x, L.start.y], [lootTile.tx, lootTile.ty]] };
      const g = new SB.Guard(def, G.guards.length, L, brainFor(G.guards.length));
      G.guards.push(g);
      registerGuardLog(g);
      g.radioAlert([{ x: p.x, y: p.y }, { x: p.x, y: p.y }], { pos: { x: p.x, y: p.y }, t: G.t, from: -1 });
      if (g.reactive) g.investigate(p.x, p.y);
      A.siren();
      toast(t('toast.rush'), 2400);
    }
  }

  function updateTutorial() {
    const el = $('#tut');
    const tu = G.tut;
    if (!tu || G.state === 'won' || G.state === 'caught' || G.state === 'failed') { el.classList.add('hidden'); return; }
    const done = [() => G.carried >= 1, () => tu.sneakT > 1.5, () => tu.hid, () => tu.thrown, () => false];
    while (tu.step < 4 && done[tu.step]()) tu.step++;
    el.classList.remove('hidden');
    $('#tutText').textContent = t('tut.' + tu.step);
    $('#tutStep').textContent = (tu.step + 1) + '/5';
  }

  function update(dt) {
    G.t += dt;
    if (!G.level) return;
    if (G.state === 'caught' || G.state === 'won' || G.state === 'failed') { updateFx(dt); return; }
    if (G.state !== 'play') return;

    G.time -= dt;
    G.elapsed += dt;
    if (G.time <= 0) { G.time = 0; updateHud(); fail(); return; }
    G.incidentCd = Math.max(0, G.incidentCd - dt);
    G.alarmCd = Math.max(0, G.alarmCd - dt);

    updatePlayer(dt);
    G.anyChase = G.guards.some((g) => g.state === 'chase');
    updateHazards(dt);
    updateRush(dt);
    for (const g of G.guards.slice()) { if (G.state !== 'play') break; g.update(dt, G); }
    relayTick(dt);
    logStates();
    if (G.state !== 'play') { updateFx(dt); return; }

    const p = G.player, L = G.level;
    G.loot.forEach((l) => {
      if (l.got) return;
      if (Math.hypot(l.x - p.x, l.y - p.y) < 17) {
        l.got = true;
        G.carried++;
        G.runCoins += 100;
        A.pickup();
        logEvent('loot');
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * 6.28, s = 40 + Math.random() * 90;
          G.fx.sparks.push({ x: l.x, y: l.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 50, life: 1, col: Math.random() > 0.5 ? '#ffd24a' : '#fff3b0' });
        }
        if (G.loot.every((q) => q.got)) { A.power(); toast(t('toast.allloot'), 2600); }
        else toast(t('toast.loot', { a: G.carried, b: G.loot.length }));
      }
    });
    G.keyItems.forEach((k) => {
      if (k.got || Math.hypot(k.x - p.x, k.y - p.y) > 18) return;
      k.got = true; G.keys++; A.key(); logEvent('key');
      toast(t('toast.key'));
    });
    if (G.keys > 0) {
      L.locks.forEach((d) => {
        const key = d.x + ',' + d.y;
        if (L.opened[key]) return;
        if (Math.hypot((d.x + 0.5) * T - p.x, (d.y + 0.5) * T - p.y) < T * 0.95) {
          L.opened[key] = true; G.keys--; A.door(); logEvent('door');
          toast(t('toast.door'));
        }
      });
    } else if (L.locks.some((d) => !L.opened[d.x + ',' + d.y] && Math.hypot((d.x + 0.5) * T - p.x, (d.y + 0.5) * T - p.y) < T * 0.95)) {
      if (!G.doorWarn || G.t - G.doorWarn > 2.5) { G.doorWarn = G.t; toast(t('toast.locked.door')); }
    }

    const e = L.exit;
    const ex = (e.x + 0.5) * T, ey = (e.y + 0.5) * T;
    if (Math.hypot(p.x - ex, p.y - ey) < T * 0.95) {
      if (G.loot.every((l) => l.got)) { win(); }
      else if (!G.exitWarn || G.t - G.exitWarn > 2) { G.exitWarn = G.t; toast(t('toast.exitlocked')); }
    }
    updateFx(dt);
    updateTutorial();
    // music reacts to how dangerous things are
    const searching = G.guards.some((g) => g.state === 'search' || g.state === 'track');
    A.setIntensity(G.anyChase ? 1 : searching ? 0.55 : 0.12 + G.alert * 0.1);
    updateHud();
  }

  /* ======================= HUD ======================= */
  let lastHud = '';
  function updateHud(force) {
    const L = G.level;
    if (!L) return;
    const left = Math.max(0, G.time);
    const tt = fmtTime(left);
    const p = G.player;
    const key = [tt, G.carried, G.keys, G.runCoins, G.items.rock, G.items.sleep, G.items.decoy, G.items.disguise, G.items.shoes, G.tool, G.alert,
      p ? Math.ceil(p.disguiseT) + '/' + Math.ceil(p.shoesT) : '', Math.ceil(save.rush ? 40 - G.rushT : 0), G.idx, SB.lang].join('|');
    $('#timerFill').style.width = (left / G.timeMax) * 100 + '%';
    if (key === lastHud && !force) return;
    lastHud = key;
    $('#hudNum').textContent = G.mode === 'endless' ? '∞' : G.idx + 1;
    $('#hudName').textContent = G.mode === 'endless' ? t('endless.name', { n: G.endless.streak }) : lt(L, 'name');
    $('#timerText').textContent = tt;
    $('.hud-timer').classList.toggle('warn', left < 15);
    $('#hudLoot').textContent = G.carried + '/' + L.loot.length;
    const kc = $('#keyChip');
    kc.classList.toggle('hidden', !L.locks.length);
    $('#hudKeys').textContent = G.keys;
    $('#hudCoins').textContent = G.runCoins;
    const rc = $('#rushChip');
    rc.classList.toggle('hidden', !save.rush);
    $('#hudRush').textContent = G.rushCount >= 4 ? 'MAX' : fmtTime(40 - G.rushT);
    $('#tools').innerHTML = SB.TOOLS.filter((x) => x.id === 'rock' || G.itemsStart[x.id] > 0).map((x) => {
      const active = p && ((x.id === 'disguise' && p.disguiseT > 0) || (x.id === 'shoes' && p.shoesT > 0));
      return '<button class="tool' + (G.tool === x.id ? ' sel' : '') + (G.items[x.id] <= 0 ? ' empty' : '') + (active ? ' active' : '') + '" data-tool="' + x.id + '" title="' + t('tool.' + x.id) + ' (' + x.key + ')">' +
        '<span class="ico">' + SB.icon(x.icon) + '</span><b>' + G.items[x.id] + '</b><kbd>' + x.key + '</kbd></button>';
    }).join('');
    $$('#alertPips i').forEach((el, i) => el.classList.toggle('on', i < G.alert));
  }
  $('#tools').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]');
    if (b) selectTool(b.dataset.tool);
  });

  /* ======================= main loop ======================= */
  let last = performance.now();
  const hero = $('#hero');
  const hctx = hero.getContext('2d');
  function drawAvatars() {
    avatarCanvases.forEach((a) => {
      const c = a.cv.getContext('2d');
      c.clearRect(0, 0, 96, 96);
      c.fillStyle = 'rgba(255,255,255,.07)';
      c.beginPath(); c.arc(48, 48, 44, 0, 7); c.fill();
      c.save(); c.translate(48, 48); c.scale(2.3, 2.3);
      SB.drawThiefSprite(c, { x: 0, y: 0, angle: G.t * 0.9, sneaking: false, walk: G.t * 40, look: a.look }, G.t, 0);
      c.restore();
    });
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      if (G.screenName === 'game' && G.level) {
        update(dt);
        SB.drawFrame(ctx, G);
      } else if (G.screenName === 'title') {
        G.t += dt;
        SB.drawHero(hctx, hero.width, hero.height, G.t);
      } else if (G.screenName === 'shop') {
        G.t += dt;
        drawAvatars();
      }
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(frame);
  }

  /* ======================= wiring ======================= */
  $('#btnPlay').addEventListener('click', () => { A.resume(); A.click(); buildLevelGrid(); showScreen('levels'); });
  $('#btnHow').addEventListener('click', () => { A.resume(); A.click(); openModal('howModal'); });
  $('#btnSettings').addEventListener('click', () => { A.resume(); A.click(); buildSettings(); openModal('settingsModal'); });
  $('#btnSettings2').addEventListener('click', () => { A.click(); buildSettings(); openModal('settingsModal'); });
  $('#btnShop').addEventListener('click', () => { A.click(); buildShop(); showScreen('shop'); });
  $('#btnShopBack').addEventListener('click', () => { A.click(); buildLevelGrid(); showScreen('levels'); });
  $('#btnScores').addEventListener('click', () => { A.click(); buildScores(); openModal('scoresModal'); });
  $('#btnEndless').addEventListener('click', () => { A.resume(); A.click(); startEndless(1); });
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => { closeModal(b.dataset.close); }));
  $('#btnBackTitle').addEventListener('click', () => { A.click(); showScreen('title'); });
  $('#btnMenu').addEventListener('click', () => { if (G.state === 'play') togglePause(); else if (G.state !== 'paused') goMenu(); });
  $('#btnPause').addEventListener('click', togglePause);
  $('#btnAI').addEventListener('click', toggleAI);
  $('#tutSkip').addEventListener('click', () => { G.tut = null; save.tutDone = true; persist(); updateTutorial(); });
  $('#btnSumSave').addEventListener('click', () => {
    const c = $('#summaryCv');
    const a = document.createElement('a');
    a.download = 'sneaky-bandit-report.png';
    a.href = c.toDataURL('image/png');
    a.click();
  });
  window.addEventListener('keydown', (e) => {
    if (G.screenName === 'levels' && e.code === 'KeyU') { save.unlockAll = true; persist(); buildLevelGrid(); }
    if (G.screenName === 'levels' && e.code === 'KeyC') { save.coins += 1000; persist(); buildLevelGrid(); }
  });

  SB.applyI18n(document);
  document.documentElement.lang = SB.lang;
  showScreen('title');
  requestAnimationFrame(frame);
})();
