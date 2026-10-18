(function () {
  const SB = (window.SB = window.SB || {});
  let ac = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;
  let muted = false, musicOn = true, wantMusic = false;
  let timer = null, step = 0, nextT = 0, intensity = 0, targetIntensity = 0;

  function ctx() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
        sfxBus = ac.createGain(); sfxBus.connect(master);
        musBus = ac.createGain(); musBus.gain.value = 0.55; musBus.connect(master);
        const len = ac.sampleRate;
        noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; }
    }
    return ac;
  }

  function tone(freq, dur, type, vol, slide, delay, bus) {
    const a = ctx();
    if (!a) return;
    const t = a.currentTime + (delay || 0);
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus || sfxBus);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, freq, type, delay, bus) {
    const a = ctx();
    if (!a) return;
    const t = a.currentTime + (delay || 0);
    const s = a.createBufferSource();
    s.buffer = noiseBuf;
    const f = a.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.value = freq;
    const g = a.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.03);
  }
  const sfx = (fn) => function () { if (!muted) fn.apply(null, arguments); };

  /* ---------------- procedural music ---------------- */
  const BPM = 94;
  const STEP = 60 / BPM / 2;
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const ROOTS = [33, 29, 36, 31];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function playStep(s, t) {
    const a = ac;
    const bar = Math.floor(s / 8) % 4, pos = s % 8;
    const chord = CHORDS[bar];
    intensity += (targetIntensity - intensity) * 0.04;
    const k = intensity;
    const note = (freq, dur, type, vol, when) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(vol, when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g); g.connect(musBus);
      o.start(when); o.stop(when + dur + 0.05);
    };
    if (pos === 0) chord.forEach((m, i) => note(mtof(m) * (i % 2 ? 1.004 : 0.996), STEP * 8, 'sine', 0.05, t));
    if (pos % 2 === 0) note(mtof(ROOTS[bar]), STEP * 1.6, 'triangle', 0.16, t);
    if (pos === 6) note(mtof(ROOTS[bar] + 7), STEP * 1.2, 'triangle', 0.1, t);
    if (pos % 2 === 1 || k > 0.5) {
      const src = a.createBufferSource(); src.buffer = noiseBuf;
      const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
      const g = a.createGain();
      g.gain.setValueAtTime(0.03 + k * 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f); f.connect(g); g.connect(musBus);
      src.start(t, Math.random() * 0.4); src.stop(t + 0.07);
    }
    if (k > 0.25 && (pos === 0 || pos === 4)) {
      const o = a.createOscillator(), g = a.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.22 * Math.min(1, k * 1.5), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(musBus); o.start(t); o.stop(t + 0.2);
    }
    if (k > 0.55 && pos % 2 === 1) note(mtof(chord[(pos >> 1) % 3] + 12), STEP * 0.7, 'square', 0.035 * k, t);
  }
  function schedule() {
    if (!ac) return;
    while (nextT < ac.currentTime + 0.3) { playStep(step, nextT); nextT += STEP; step++; }
  }
  function refreshMusic() {
    const should = wantMusic && musicOn && !muted;
    if (should && !timer) {
      if (!ctx()) return;
      step = 0; nextT = ac.currentTime + 0.1;
      timer = setInterval(schedule, 100);
    } else if (!should && timer) { clearInterval(timer); timer = null; }
  }

  SB.audio = {
    resume() { const a = ctx(); if (a && a.state === 'suspended') a.resume(); refreshMusic(); },
    setMuted(m) { muted = m; refreshMusic(); },
    setMusic(on) { musicOn = on; refreshMusic(); },
    isMuted() { return muted; },
    musicPlay(on) { wantMusic = on; refreshMusic(); },
    setIntensity(v) { targetIntensity = Math.max(0, Math.min(1, v)); },

    click: sfx(() => tone(620, 0.05, 'triangle', 0.05)),
    pickup: sfx(() => { tone(880, 0.1, 'triangle', 0.09); tone(1320, 0.18, 'triangle', 0.08, 0, 0.08); }),
    coin: sfx(() => { tone(1200, 0.08, 'square', 0.04); tone(1600, 0.14, 'square', 0.04, 0, 0.07); }),
    key: sfx(() => { tone(990, 0.09, 'triangle', 0.08); tone(1240, 0.09, 'triangle', 0.08, 0, 0.08); tone(1480, 0.2, 'triangle', 0.08, 0, 0.16); }),
    door: sfx(() => { tone(180, 0.25, 'sawtooth', 0.05, -90); noise(0.2, 0.08, 500, 'bandpass', 0.02); }),
    alert: sfx(() => { tone(520, 0.12, 'square', 0.04); tone(800, 0.22, 'square', 0.04, 0, 0.11); }),
    siren: sfx(() => { for (let i = 0; i < 4; i++) tone(i % 2 ? 640 : 880, 0.22, 'square', 0.035, 0, i * 0.24); }),
    suspicious: sfx(() => tone(380, 0.14, 'triangle', 0.05, 80)),
    throwRock: sfx(() => { tone(240, 0.12, 'sine', 0.07, -100); noise(0.1, 0.03, 2500, 'highpass'); }),
    thud: sfx(() => { tone(130, 0.2, 'sine', 0.13, -70); noise(0.12, 0.05, 300, 'lowpass'); }),
    hiss: sfx(() => noise(0.9, 0.07, 2600, 'bandpass')),
    zap: sfx(() => { tone(1400, 0.18, 'sawtooth', 0.06, -1100); noise(0.15, 0.06, 4000, 'highpass'); }),
    beep: sfx(() => tone(1900, 0.06, 'square', 0.03)),
    step: sfx(() => noise(0.04, 0.025, 900, 'bandpass')),
    power: sfx(() => { tone(440, 0.1, 'triangle', 0.07); tone(660, 0.1, 'triangle', 0.07, 0, 0.09); tone(880, 0.16, 'triangle', 0.07, 0, 0.18); }),
    stamp: sfx(() => { tone(90, 0.3, 'sine', 0.2, -40); noise(0.15, 0.1, 400, 'lowpass'); }),
    caught: sfx(() => { tone(320, 0.55, 'sawtooth', 0.06, -250); }),
    win: sfx(() => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.24, 'triangle', 0.08, 0, i * 0.12)); }),
    star: sfx((i) => tone(700 + (i || 0) * 200, 0.28, 'triangle', 0.08)),
    lose: sfx(() => { tone(260, 0.4, 'square', 0.04, -120); tone(180, 0.5, 'square', 0.04, -80, 0.25); }),
  };
})();
