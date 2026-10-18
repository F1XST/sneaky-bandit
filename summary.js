/*
 * After-action report: a timeline of every guard's state, the messages the
 * guards exchanged (contract-net CFP / bid / award, radio relays, alarms) and
 * what the thief did. Drawn on a canvas so it can be saved as a picture.
 */
(function () {
  const SB = window.SB;
  const FONT = "Kanit, 'Segoe UI', sans-serif";
  const MSG_COL = { cfp: '#4cd6ff', bid: '#8a93a8', award: '#5fe08a', relay: '#c79bff', alarm: '#ff5a55' };
  const STATE_ORDER = ['patrol', 'sentinel', 'napping', 'investigate', 'track', 'search', 'chase', 'return', 'asleep'];

  SB.drawSummary = function (cv, G) {
    const t = SB.t;
    const log = G.log;
    const W = 920, left = 168, right = 24, laneH = 34;
    const hasAlarm = log.msgs.some((m) => m.from === -1);
    const lanes = [];
    if (hasAlarm) lanes.push({ kind: 'sys' });
    log.guards.forEach((g) => lanes.push({ kind: 'guard', g }));
    lanes.push({ kind: 'player' });
    const headH = 74, chartTop = headH + 24;
    const chartH = lanes.length * laneH;
    const legendH = 54;
    const statRows = log.guards.length;
    const statH = 56 + statRows * 24;
    const H = chartTop + chartH + 40 + legendH + statH + 16;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.aspectRatio = W + ' / ' + H;
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#14122b'; c.fillRect(0, 0, W, H);

    const D = Math.max(5, log.end);
    const X = (tt) => left + ((W - left - right) * Math.min(tt, D)) / D;
    const laneY = (idx) => chartTop + idx * laneH;
    const laneOf = (id) => {
      if (id === -1) return lanes.findIndex((l) => l.kind === 'sys');
      return lanes.findIndex((l) => l.kind === 'guard' && l.g.id === id);
    };

    // header
    c.fillStyle = '#f1eefc'; c.font = '500 20px ' + FONT; c.textBaseline = 'alphabetic';
    c.fillText(t('sum.title') + ' — ' + log.levelName, 18, 32);
    c.font = '400 13px ' + FONT; c.fillStyle = '#a9a4cc';
    c.fillText(log.result + ' · ' + t('sum.duration', { s: Math.round(log.end) }) + ' · ' + t('sum.brain') + ': ' + t('brain.' + log.brain), 18, 54);

    // time grid
    c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1;
    c.fillStyle = '#7d78a8'; c.font = '400 11px ' + FONT; c.textAlign = 'center';
    const tick = D > 120 ? 20 : D > 50 ? 10 : 5;
    for (let s = 0; s <= D; s += tick) {
      c.beginPath(); c.moveTo(X(s), chartTop - 4); c.lineTo(X(s), chartTop + chartH); c.stroke();
      c.fillText(s + 's', X(s), chartTop - 10);
    }

    // lanes
    lanes.forEach((ln, i) => {
      const y = laneY(i);
      c.fillStyle = i % 2 ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.06)';
      c.fillRect(8, y, W - 16, laneH - 2);
      c.textAlign = 'left'; c.fillStyle = '#f1eefc'; c.font = '500 12px ' + FONT; c.textBaseline = 'middle';
      let label = '';
      if (ln.kind === 'sys') label = t('sum.alarmsys');
      else if (ln.kind === 'player') label = t('sum.player');
      else label = '#' + (ln.g.id + 1) + ' ' + t('gtype.' + ln.g.type) + ' (' + (ln.g.brain === 'reactive' ? 'R' : 'D') + ')';
      c.fillText(label, 16, y + laneH / 2 - 1);
      if (ln.kind === 'guard') {
        ln.g.tl.forEach((seg) => {
          const x0 = X(seg.t0), x1 = X(seg.t1 == null ? log.end : seg.t1);
          c.fillStyle = SB.STATE_COLORS[seg.s] || '#888';
          c.globalAlpha = 0.9;
          c.fillRect(x0, y + 6, Math.max(1.5, x1 - x0), laneH - 14);
          c.globalAlpha = 1;
        });
      }
    });

    // player lane: hiding intervals and events
    const pl = lanes.findIndex((l) => l.kind === 'player');
    const py = laneY(pl);
    let hideStart = null;
    log.events.forEach((e) => {
      if (e.kind === 'hide_start') hideStart = e.t;
      if (e.kind === 'hide_end' && hideStart != null) {
        c.fillStyle = 'rgba(95,224,138,.55)';
        c.fillRect(X(hideStart), py + 8, Math.max(2, X(e.t) - X(hideStart)), laneH - 18);
        hideStart = null;
      }
    });
    if (hideStart != null) { c.fillStyle = 'rgba(95,224,138,.55)'; c.fillRect(X(hideStart), py + 8, Math.max(2, X(log.end) - X(hideStart)), laneH - 18); }
    log.events.forEach((e) => {
      const x = X(e.t), cy = py + laneH / 2 - 1;
      if (e.kind === 'loot') { c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(x, cy, 5, 0, 7); c.fill(); }
      else if (e.kind === 'item') { c.fillStyle = '#9be8b0'; c.fillRect(x - 4, cy - 4, 8, 8); }
      else if (e.kind === 'spotted') { c.fillStyle = '#ff5a55'; c.beginPath(); c.moveTo(x, cy - 7); c.lineTo(x + 6, cy + 5); c.lineTo(x - 6, cy + 5); c.closePath(); c.fill(); }
      else if (e.kind === 'door') { c.fillStyle = '#c98a4a'; c.fillRect(x - 3, cy - 6, 6, 12); }
    });

    // messages between agents
    c.lineWidth = 1.6;
    log.msgs.forEach((m) => {
      const a = laneOf(m.from), b = m.to === -2 ? pl : laneOf(m.to);
      if (a < 0 || b < 0) return;
      const x = X(m.t);
      const y0 = laneY(a) + laneH / 2, y1 = laneY(b) + laneH / 2;
      const col = m.type === 'alarm' ? MSG_COL.alarm : MSG_COL[m.type] || '#fff';
      c.strokeStyle = col; c.fillStyle = col;
      c.globalAlpha = m.type === 'bid' ? 0.45 : 0.95;
      c.setLineDash(m.type === 'relay' ? [4, 3] : m.type === 'bid' ? [2, 3] : []);
      const dx = ((m.i || 0) % 5) * 1.5 - 3;
      c.beginPath(); c.moveTo(x + dx, y0); c.lineTo(x + dx, y1); c.stroke();
      c.setLineDash([]);
      const dir = y1 > y0 ? 1 : -1;
      c.beginPath(); c.moveTo(x + dx, y1); c.lineTo(x + dx - 3.5, y1 - dir * 6); c.lineTo(x + dx + 3.5, y1 - dir * 6); c.closePath(); c.fill();
      c.globalAlpha = 1;
    });

    // legend
    let ly = chartTop + chartH + 30;
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.font = '400 12px ' + FONT;
    let lx = 16;
    c.fillStyle = '#a9a4cc'; c.fillText(t('sum.states') + ':', lx, ly); lx += 58;
    STATE_ORDER.forEach((s) => {
      c.fillStyle = SB.STATE_COLORS[s]; c.fillRect(lx, ly - 6, 12, 12);
      c.fillStyle = '#d9d5f0'; c.fillText(t('state.' + s), lx + 17, ly);
      lx += 22 + c.measureText(t('state.' + s)).width + 14;
    });
    ly += 24; lx = 16;
    c.fillStyle = '#a9a4cc'; c.fillText(t('sum.messages') + ':', lx, ly); lx += 70;
    [['cfp', 'sum.cfp'], ['bid', 'sum.bid'], ['award', 'sum.award'], ['relay', 'sum.relay'], ['alarm', 'sum.alarm']].forEach((p) => {
      c.strokeStyle = MSG_COL[p[0]]; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(lx, ly + 6); c.lineTo(lx, ly - 6); c.stroke();
      c.fillStyle = MSG_COL[p[0]]; c.beginPath(); c.moveTo(lx, ly - 7); c.lineTo(lx - 3, ly - 1); c.lineTo(lx + 3, ly - 1); c.fill();
      const count = log.msgs.filter((m) => (p[0] === 'alarm' ? m.from === -1 : m.type === p[0] && m.from !== -1)).length;
      c.fillStyle = '#d9d5f0';
      const txt = t(p[1]) + ' ×' + count;
      c.fillText(txt, lx + 9, ly);
      lx += 22 + c.measureText(txt).width + 12;
    });

    // time-in-state table
    let sy = ly + 36;
    c.fillStyle = '#f1eefc'; c.font = '500 14px ' + FONT; c.fillText(t('sum.share'), 16, sy);
    sy += 22;
    log.guards.forEach((g) => {
      const tot = {};
      g.tl.forEach((seg) => { tot[seg.s] = (tot[seg.s] || 0) + ((seg.t1 == null ? log.end : seg.t1) - seg.t0); });
      const sum = Object.keys(tot).reduce((a, k) => a + tot[k], 0) || 1;
      c.fillStyle = '#d9d5f0'; c.font = '400 12px ' + FONT;
      c.fillText('#' + (g.id + 1) + ' ' + t('gtype.' + g.type), 16, sy + 8);
      let bx = left;
      const bw = W - left - right - 150;
      STATE_ORDER.forEach((s) => {
        if (!tot[s]) return;
        const w = (tot[s] / sum) * bw;
        c.fillStyle = SB.STATE_COLORS[s]; c.fillRect(bx, sy, w, 16);
        bx += w;
      });
      const chaseP = Math.round(((tot.chase || 0) / sum) * 100);
      c.fillStyle = '#a9a4cc'; c.fillText(t('sum.chasepct', { p: chaseP }), left + bw + 10, sy + 8);
      sy += 24;
    });
    c.textBaseline = 'alphabetic';
  };
})();
