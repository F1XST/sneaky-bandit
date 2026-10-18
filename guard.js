/*
 * Guard agent
 * ------------------------------------------------------------
 * Each guard is an autonomous agent with:
 *   - Perception : vision cone with wall occlusion, hearing (noise events),
 *                  smell (dogs follow the thief's scent trail)
 *   - Beliefs    : lastSeen (where it last saw the thief), meter (suspicion),
 *                  info (alert received over the radio), hide memory (shared)
 *   - Behaviour  : finite-state machine
 *                  patrol -> (suspicious stare) -> chase -> search -> return -> patrol
 *                  investigate (heard noise / checks a remembered hiding spot),
 *                  track (dog follows the scent), sentinel (fixed post),
 *                  napping (dozing guard), asleep (hit by sleeping gas)
 *   - Communication : radio with limited range, contract-net task allocation
 *                  (see Game.cnp), relays between guards
 *   - Brain      : 'deliberative' (memory + radio + planning) or
 *                  'reactive' (sees -> chases, forgets quickly, no radio)
 */
(function () {
  const SB = window.SB;
  const T = SB.T;

  // per-type parameters: sight range, field of view, patrol speed, chase speed
  const PARAM = {
    guard: { range: 170, fov: 1.2, patrol: 50, chase: 98 },
    cop: { range: 178, fov: 1.2, patrol: 54, chase: 104 },
    sentinel: { range: 175, fov: 1.2, patrol: 50, chase: 98 },
    dog: { range: 115, fov: 1.9, patrol: 70, chase: 124 },
    sleeper: { range: 150, fov: 1.1, patrol: 50, chase: 96 },
  };
  SB.FOV = 1.2;
  SB.rangeFor = (alert) => 170 + alert * 20;

  class Guard {
    constructor(def, id, L, brain) {
      this.id = id;
      this.L = L;
      this.type = def.type || 'guard';
      this.brain = brain || 'deliberative';
      const P = PARAM[this.type] || PARAM.guard;
      this.range0 = P.range; this.fov = P.fov; this.pspd = P.patrol; this.cspd = P.chase;
      this.sentinel = def.sentinel || null;
      this.nap = !!def.nap;
      this.route = (def.route || [def.post]).map((p) => SB.snap(L, p[0], p[1]));
      const s = this.route[0];
      this.x = (s[0] + 0.5) * T;
      this.y = (s[1] + 0.5) * T;
      this.home = { x: this.x, y: this.y };
      if (this.sentinel) this.angle = this.sentinel.a0;
      else if (this.nap) this.angle = def.a0 || 0;
      else if (this.route.length > 1) {
        const n = this.route[1];
        this.angle = Math.atan2((n[1] + 0.5) * T - this.y, (n[0] + 0.5) * T - this.x);
      } else this.angle = 0;
      this.state = this.nap ? 'napping' : this.sentinel ? 'sentinel' : 'patrol';
      this.wp = this.route.length > 1 ? 1 : 0;
      this.path = [];
      this.wait = 1.2 + Math.random();
      this.meter = 0;
      this.t = Math.random() * 10;
      this.lastSeen = null;
      this.searchPts = [];
      this.searchIdx = 0;
      this.searchT = 0;
      this.lose = 0;
      this.timer = 0;
      this.arrived = false;
      this.target = null;
      this.walk = 0;
      this.moving = false;
      this.radioT = 0;
      this.sinceRadio = 0;
      this.repath = 0;
      this.seesPlayer = false;
      this.reason = '';
      this.hideCd = {};
      this.info = null;
      this.trackI = 0;
    }

    get reactive() { return this.brain === 'reactive'; }
    rangeNow(g) { return this.range0 + (this.reactive ? 0 : g.alert * 20); }

    /* ---------- learning: remember where the thief likes to hide ---------- */
    pickHide(g) {
      if (this.reactive) return null;
      const mem = g.memory.hide;
      let best = null, bs = 0;
      for (const h of this.L.hides) {
        const key = h.x + ',' + h.y;
        const cnt = mem[key] || 0;
        if (cnt < 2) continue;
        if (this.hideCd[key] && this.t - this.hideCd[key] < 22) continue;
        const dist = Math.hypot((h.x + 0.5) * T - this.x, (h.y + 0.5) * T - this.y) / T;
        if (dist > 10) continue;
        const score = cnt - dist * 0.15;
        if (score > bs) { bs = score; best = h; }
      }
      if (!best) return null;
      const cnt = mem[best.x + ',' + best.y];
      if (Math.random() > Math.min(0.9, 0.35 + 0.15 * cnt)) return null;
      this.hideCd[best.x + ',' + best.y] = this.t;
      return best;
    }
    sleep(sec) {
      this.state = 'asleep';
      this.timer = sec;
      this.path = [];
      this.meter = 0;
      this.moving = false;
      this.reason = '';
    }

    /* ---------- movement helpers ---------- */
    goTo(px, py) {
      const a = SB.findPath(this.L, Math.floor(this.x / T), Math.floor(this.y / T), Math.floor(px / T), Math.floor(py / T));
      this.path = SB.smoothPath(this.L, this.x, this.y, a);
      this.dest = { x: px, y: py };
    }
    follow(dt, speed) {
      if (!this.path.length) { this.moving = false; return true; }
      const n = this.path[0];
      const dx = n.x - this.x, dy = n.y - this.y;
      const d = Math.hypot(dx, dy);
      const step = speed * dt;
      this.moving = true;
      if (d <= step + 0.5) {
        this.x = n.x; this.y = n.y;
        this.path.shift();
        return this.path.length === 0;
      }
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      this.walk += step;
      this.turnTo(Math.atan2(dy, dx), dt, 8);
      return false;
    }
    turnTo(a, dt, rate) {
      const d = SB.angDiff(this.angle, a);
      const s = rate * dt;
      this.angle += Math.abs(d) < s ? d : Math.sign(d) * s;
    }

    /* ---------- perception ---------- */
    canSee(p, g) {
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy);
      if (p.hidden && d > 26) return 0;
      if (p.disguiseT > 0 && d > 46) return 0;
      if (d > this.rangeNow(g)) return 0;
      if (d > 24 && Math.abs(SB.angDiff(this.angle, Math.atan2(dy, dx))) > this.fov / 2) return 0;
      if (!SB.los(this.L, this.x, this.y, p.x, p.y)) return 0;
      return Math.max(d, 1);
    }
    hear(x, y, radius) {
      if (this.state === 'chase' || this.state === 'asleep') return false;
      let d = Math.hypot(x - this.x, y - this.y);
      if (!SB.los(this.L, this.x, this.y, x, y)) d *= 1.7;
      if (this.state === 'napping') {
        if (d <= radius * 0.45) { this.investigate(x, y); return true; }
        return false;
      }
      if (this.reactive) radius *= 0.6;
      if (d > radius || this.meter > 0.5) return false;
      this.investigate(x, y);
      return true;
    }
    sniff(g) {
      const tr = g.trail;
      if (!tr || !tr.length) return -1;
      let bi = -1, bd = 1e9;
      for (let i = 0; i < tr.length; i++) {
        if (g.t - tr[i].t > 10) continue;
        const d = Math.hypot(tr[i].x - this.x, tr[i].y - this.y);
        if (d < bd) { bd = d; bi = i; }
      }
      return bd < 90 ? bi : -1;
    }

    /* ---------- state transitions ---------- */
    investigate(x, y) {
      if (this.state !== 'investigate') SB.audio.suspicious();
      this.state = 'investigate';
      this.reason = 'noise';
      this.target = { x, y };
      this.goTo(x, y);
      this.arrived = false;
    }
    startChase(g) {
      this.state = 'chase';
      this.meter = 1;
      this.path = [];
      this.repath = 0;
      this.lose = 0;
      this.sinceRadio = 0;
      this.lastSeen = { x: g.player.x, y: g.player.y };
      g.onChase(this);
    }
    startSearch(pt, g) {
      const L = this.L;
      let extra = SB.snapPx(L, pt.x + (Math.random() - 0.5) * T * 5, pt.y + (Math.random() - 0.5) * T * 5);
      const mem = g && !this.reactive && g.rememberedHides(pt, 6);
      if (mem && mem.length) extra = { x: (mem[0].x + 0.5) * T, y: (mem[0].y + 0.5) * T };
      this.state = 'search';
      this.reason = 'search';
      this.searchPts = [{ x: pt.x, y: pt.y }, extra];
      this.searchIdx = 0;
      this.searchT = 0;
      this.nextSearch();
    }
    // an assignment won in a contract-net auction (or a relayed alert)
    radioAlert(pts, info) {
      if (this.reactive) return;
      if (this.state === 'chase' || this.state === 'asleep') return;
      this.state = 'search';
      this.reason = 'search';
      this.searchPts = pts;
      this.searchIdx = 0;
      this.searchT = 0;
      this.radioT = 1.4;
      this.info = info || this.info;
      this.nextSearch();
    }
    nextSearch() {
      const q = this.searchPts[this.searchIdx];
      this.target = q;
      this.goTo(q.x, q.y);
      this.arrived = false;
    }
    enterReturn() {
      this.state = 'return';
      this.reason = '';
      if (this.sentinel || this.nap) this.goTo(this.home.x, this.home.y);
      else {
        let best = 0, bd = 1e9;
        this.route.forEach((w, i) => {
          const d = Math.hypot((w[0] + 0.5) * T - this.x, (w[1] + 0.5) * T - this.y);
          if (d < bd) { bd = d; best = i; }
        });
        this.wp = best;
        const w = this.route[best];
        this.goTo((w[0] + 0.5) * T, (w[1] + 0.5) * T);
      }
    }

    /* ---------- main update ---------- */
    update(dt, g) {
      const p = g.player;
      this.t += dt;
      if (this.radioT > 0) this.radioT -= dt;

      if (this.state === 'asleep') {
        this.timer -= dt;
        this.moving = false;
        this.seesPlayer = false;
        this.meter = 0;
        if (this.timer <= 0) this.enterReturn();
        return;
      }
      if (this.state === 'napping') {
        this.moving = false;
        this.seesPlayer = false;
        this.meter = 0;
        return;
      }

      const d = this.canSee(p, g);
      this.seesPlayer = d > 0;
      if (d > 0) {
        const r = this.rangeNow(g);
        const rate = (1.1 + (1 - d / r) * 2.8) * (p.sneaking ? 0.75 : 1) * (p.disguiseT > 0 ? 0.4 : 1);
        this.meter = Math.min(1, this.meter + rate * dt);
        this.lastSeen = { x: p.x, y: p.y };
        this.info = { pos: { x: p.x, y: p.y }, t: g.t, from: this.id };
      } else {
        this.meter = Math.max(0, this.meter - (this.state === 'chase' ? 0.3 : 0.7) * dt);
      }
      if (this.state !== 'chase' && this.meter >= 1) this.startChase(g);

      // dogs smell the scent trail while idle
      if (this.type === 'dog' && this.state !== 'chase' && this.state !== 'track') {
        const bi = this.sniff(g);
        if (bi >= 0) {
          this.state = 'track';
          this.reason = 'scent';
          this.trackI = bi;
          this.repath = 0;
        }
      }

      // freeze and stare when something catches the eye
      if (this.state !== 'chase' && d > 0 && this.meter > 0.18) {
        this.turnTo(Math.atan2(p.y - this.y, p.x - this.x), dt, 9);
        this.moving = false;
        return;
      }

      const walkSpd = this.pspd;
      switch (this.state) {
        case 'sentinel': {
          const s = this.sentinel;
          this.turnTo(s.a0 + Math.sin(this.t * 0.7) * s.sweep, dt, 2.6);
          this.moving = false;
          break;
        }
        case 'patrol': {
          if (this.wait > 0) {
            this.wait -= dt;
            this.moving = false;
            this.angle += Math.sin(this.t * 2.2) * dt * 0.9;
            break;
          }
          if (!this.path.length) {
            const hide = this.pickHide(g);
            if (hide) {
              this.investigate((hide.x + 0.5) * T, (hide.y + 0.5) * T);
              this.reason = 'hide';
              break;
            }
            const w = this.route[this.wp];
            this.goTo((w[0] + 0.5) * T, (w[1] + 0.5) * T);
          }
          if (this.follow(dt, walkSpd)) {
            this.wait = 0.7 + Math.random() * 0.8;
            this.wp = (this.wp + 1) % this.route.length;
          }
          break;
        }
        case 'investigate': {
          if (!this.arrived) {
            if (this.follow(dt, walkSpd * 1.48)) { this.arrived = true; this.timer = this.reactive ? 0.9 : 1.7; }
          } else {
            this.timer -= dt;
            this.angle += Math.cos(this.t * 3.5) * dt * 2.2;
            if (this.timer <= 0) this.enterReturn();
          }
          break;
        }
        case 'track': {
          const tr = g.trail;
          this.repath -= dt;
          if (this.repath <= 0) {
            this.repath = 0.25;
            let bi = -1, bd = 1e9;
            for (let i = Math.max(0, this.trackI - 3); i < tr.length; i++) {
              if (g.t - tr[i].t > 10) continue;
              const dd = Math.hypot(tr[i].x - this.x, tr[i].y - this.y);
              if (dd < bd) { bd = dd; bi = i; }
            }
            if (bi < 0 || bd > 150) { this.enterReturn(); break; }
            this.trackI = bi;
            const tgt = tr[Math.min(bi + 4, tr.length - 1)];
            this.goTo(tgt.x, tgt.y);
            this.trackEnd = bi >= tr.length - 2;
          }
          this.follow(dt, walkSpd * 1.7);
          if (this.trackEnd && !this.path.length) {
            const lastPt = tr[tr.length - 1];
            if (lastPt) this.startSearch(lastPt, g); else this.enterReturn();
          }
          break;
        }
        case 'search': {
          this.searchT += dt;
          if (!this.arrived) {
            if (this.follow(dt, walkSpd * 1.48)) { this.arrived = true; this.timer = 1.3; }
          } else {
            this.timer -= dt;
            this.angle += Math.cos(this.t * 4) * dt * 2.6;
            if (this.timer <= 0) {
              this.searchIdx++;
              if (this.searchIdx >= this.searchPts.length || this.searchT > 16) this.enterReturn();
              else this.nextSearch();
            }
          }
          break;
        }
        case 'return': {
          if (this.follow(dt, walkSpd * 1.25)) {
            this.state = this.nap ? 'napping' : this.sentinel ? 'sentinel' : 'patrol';
            this.wait = 0.5;
          }
          break;
        }
        case 'chase': {
          if (d > 0) {
            this.lose = 0;
            this.sinceRadio += dt;
            if (!this.reactive && this.sinceRadio > 1.8) { this.sinceRadio = 0; g.radioBroadcast(this); }
          } else this.lose += dt;
          this.repath -= dt;
          if (this.repath <= 0) {
            this.repath = 0.22;
            const tg = d > 0 ? p : this.lastSeen;
            this.goTo(tg.x, tg.y);
          }
          const spd = this.cspd + (this.reactive ? 0 : g.alert * 7);
          this.follow(dt, spd);
          if (d > 0 && d < 130) this.turnTo(Math.atan2(p.y - this.y, p.x - this.x), dt, 10);
          if (Math.hypot(p.x - this.x, p.y - this.y) < 16) { g.caught(this); break; }
          const loseMax = this.reactive ? 1.2 : 2.4;
          if (this.lose > loseMax || (!this.path.length && d === 0 && this.lose > 0.6)) {
            if (this.reactive) this.enterReturn();
            else this.startSearch(this.lastSeen, g);
          }
          break;
        }
      }
    }
  }

  SB.Guard = Guard;
})();
