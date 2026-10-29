// The microgames. Each one plays in a 480×480 square of "desktop".
// Logic never touches the DOM, so sim.mjs can run every game in Node with its bot.
//
//   init(g)        set up; g.d is difficulty (0…), g.rnd() is seeded
//   tick(g, dt)    dt is game seconds (already sped up)
//   down/move/up(g, x, y)
//   draw(g, c)     c is already in game units
//   bot(g)         returns a gesture for the autoplayer: {tap:[x,y]}, {taps:[[x,y],…], gap}, {drag:[[x,y],…]} or null
//   hint(g)        for the Setup Wizard: {at:[x,y]} or {from:[x,y], to:[x,y]}
//   survive: true  means running out the clock is a win

import { C, rr, inR, cx, cy, winLayout, drawWin, font, button, para, icon, progress, suit, wordart, fitText } from './ui.js';

const W = 480, H = 480;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

export const ADS = [
  { title: 'Congratulations!!!', l1: 'YOU ARE THE', l2: '1,000,000th VISITOR!', bg: ['#fff200', '#ff9a00'], fg: '#d4001a' },
  { title: 'Special Offer', l1: 'FREE SMILEYS', l2: 'for your e-mail :-)', bg: ['#a8f6ff', '#3d86ff'], fg: '#08217a' },
  { title: 'You Won!', l1: 'CLAIM YOUR', l2: 'FREE CRUISE', bg: ['#ffc2ee', '#c64bff'], fg: '#4a0a6a' },
  { title: 'System Alert', l1: 'YOUR PC IS', l2: 'TOO SLOW!!!', bg: ['#d8ff8a', '#33bf3a'], fg: '#0b4a10' },
  { title: 'Hot Deal', l1: 'CHEAP INK', l2: 'CARTRIDGES', bg: ['#ffe0b0', '#ff5a2a'], fg: '#5a1000' },
  { title: 'Quick Survey', l1: 'Rate this', l2: 'pop-up 5 stars', bg: ['#ffffff', '#b8c8ff'], fg: '#1a2a7a' },
  { title: 'Hello!!', l1: 'SINGLE SCREEN', l2: 'SAVERS NEAR YOU', bg: ['#fff7a8', '#ffcf3a'], fg: '#6a3a00' },
];

function drawAd(c, L, ad, t, o = {}) {
  drawWin(c, L, ad.title, { active: o.active !== false, icon: 'warn', shadow: o.shadow });
  const b = L.body;
  const g = c.createLinearGradient(b.x, b.y, b.x + b.w * .3, b.y + b.h);
  g.addColorStop(0, ad.bg[0]); g.addColorStop(1, ad.bg[1]);
  c.fillStyle = g; c.fillRect(b.x, b.y, b.w, b.h);
  // starburst
  c.save(); c.beginPath(); c.rect(b.x, b.y, b.w, b.h); c.clip();
  c.translate(b.x + b.w * .5, b.y + b.h * .45); c.rotate(t * .6);
  c.fillStyle = 'rgba(255,255,255,.22)';
  for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(b.w, -b.w * .12); c.lineTo(b.w, b.w * .12); c.fill(); }
  c.restore();
  const s = Math.min(b.w / 9, b.h / 5.5);
  const blink = Math.floor(t * 4) % 2;
  font(c, s * .85, 'bold'); c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = blink ? ad.fg : '#fff'; c.fillText(fitText(c, ad.l1, b.w - 16), cx(b), b.y + b.h * (o.textY || .3));
  font(c, s * 1.05, 'bold'); c.fillStyle = blink ? '#fff' : ad.fg;
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3;
  const l2 = fitText(c, ad.l2, b.w - 16);
  c.strokeText(l2, cx(b), b.y + b.h * ((o.textY || .3) + .2)); c.fillText(l2, cx(b), b.y + b.h * ((o.textY || .3) + .2));
}

// popups that pile up (the CLOSE IT punishment, and both bosses)
function spawnPop(g, list, o = {}) {
  const w = o.w || g.ri(180, 250), h = o.h || g.ri(140, 190);
  const x = o.x ?? g.ri(4, W - w - 4), y = o.y ?? g.ri(4, H - h - 4);
  const p = { L: winLayout(x, y, w, h, 34, 'x'), ad: g.pick(ADS), born: g.t, shake: g.rnd() < .25 };
  list.push(p); g.sfx('pop');
  return p;
}
function drawPops(c, g, list) {
  list.forEach((p, i) => {
    const a = ease((g.t - p.born) / .12);
    c.save(); c.translate(cx(p.L), cy(p.L)); c.scale(.6 + .4 * a, .6 + .4 * a); c.translate(-cx(p.L), -cy(p.L));
    if (p.shake) c.translate(Math.sin(g.t * 40) * 2, 0);
    drawAd(c, p.L, p.ad, g.t + i, { active: i === list.length - 1 });
    c.restore();
  });
}
function topPopAt(list, x, y) {
  for (let i = list.length - 1; i >= 0; i--) if (inR(x, y, list[i].L)) return i;
  return -1;
}

function deskIcon(c, type, label, x, y, s, sel) {
  icon(c, type, x, y, s);
  font(c, Math.max(12, s * .26)); c.textAlign = 'center'; c.textBaseline = 'top';
  const w = c.measureText(label).width;
  if (sel) { c.fillStyle = C.sel; c.fillRect(x - w / 2 - 3, y + s * .55 - 1, w + 6, s * .3 + 3); }
  else { c.fillStyle = 'rgba(0,0,0,.65)'; c.fillText(label, x + 1, y + s * .55 + 1); }
  c.fillStyle = '#fff'; c.fillText(label, x, y + s * .55);
}

// ------------------------------------------------------------------ games
export const GAMES = [];
const def = o => (GAMES.push(o), o);

// 1. CLOSE IT: the real X is in the title bar; the ones painted in the ad multiply.
def({
  id: 'close', word: 'CLOSE IT!', name: 'close_it.exe', icon: 'popup', art: 'rainbow',
  init(g) {
    const w = g.ri(310, 350), h = g.ri(270, 300);
    g.L = winLayout(g.ri(8, W - w - 8), g.ri(8, H - h - 8), w, h, 42, 'x');
    g.ad = g.pick(ADS); g.pops = []; g.fakes = [];
    const n = 2 + Math.min(g.d, 3), b = g.L.body;
    for (let k = 0; k < 60 && g.fakes.length < n; k++) {
      const kind = g.pick(['big', 'x', 'x', 'round']);
      const fw = kind === 'big' ? 130 : 38, fh = kind === 'big' ? 40 : 38;
      const r = { kind, x: b.x + 6 + g.rnd() * (b.w - fw - 12), y: b.y + 6 + g.rnd() * (b.h - fh - 12), w: fw, h: fh };
      if (g.fakes.every(f => !(r.x < f.x + f.w + 8 && f.x < r.x + r.w + 8 && r.y < f.y + f.h + 8 && f.y < r.y + r.h + 8))) g.fakes.push(r);
    }
  },
  down(g, x, y) {
    if (g.result) return;
    if (inR(x, y, g.L.close, 10)) { g.sfx('close'); g.win(); g.closeT = g.t; return; }
    for (const f of g.fakes) if (inR(x, y, f, 4)) {
      g.sfx('bad'); g.lose();
      for (let i = 0; i < 4; i++) spawnPop(g, g.pops, { x: clamp(g.L.x + 24 * (i + 1), 0, W - 220), y: clamp(g.L.y + 20 * (i + 1), 0, H - 170), w: 220, h: 170 });
      return;
    }
  },
  tick() {},
  draw(g, c) {
    c.save();
    if (g.closeT != null) { const a = 1 - ease((g.t - g.closeT) / .18); c.globalAlpha = a; c.translate(cx(g.L), cy(g.L)); c.scale(.4 + .6 * a, .4 + .6 * a); c.translate(-cx(g.L), -cy(g.L)); }
    drawAd(c, g.L, g.ad, g.t, { textY: .22 });
    for (const f of g.fakes) {
      if (f.kind === 'big') button(c, f, 'CLOSE  ✕', { fill: '#e2412b', color: '#fff', bold: true, size: 16 });
      else if (f.kind === 'x') {
        rr(c, f.x, f.y, f.w, f.h, 5); c.fillStyle = '#d9472a'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
        c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.moveTo(f.x + 11, f.y + 11); c.lineTo(f.x + f.w - 11, f.y + f.h - 11); c.moveTo(f.x + f.w - 11, f.y + 11); c.lineTo(f.x + 11, f.y + f.h - 11); c.stroke();
      } else {
        c.beginPath(); c.arc(cx(f), cy(f), f.w / 2, 0, 7); c.fillStyle = '#888'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
        font(c, 20, 'bold'); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('×', cx(f), cy(f) + 1);
      }
    }
    c.restore();
    drawPops(c, g, g.pops);
  },
  bot: g => ({ tap: [cx(g.L.close), cy(g.L.close)] }),
  hint: g => ({ at: [cx(g.L.close), g.L.close.y] }),
});

// 2. PUNCH: hit the monkey in the banner.
def({
  id: 'punch', word: 'PUNCH!', name: 'punch.exe', icon: 'monkey', art: 'grape',
  init(g) {
    g.L = winLayout(10, g.ri(110, 190), 460, 200, 34, '');
    g.mr = 36 - 3 * Math.min(g.d, 3);
    const b = g.L.body;
    g.mx = b.x + g.mr + g.rnd() * (b.w - 2 * g.mr); g.my = cy(b) + 12;
    g.vx = (g.rnd() < .5 ? -1 : 1) * (150 + 45 * Math.min(g.d, 4));
    g.glove = null; g.hitT = null; g.flip = 1.2;
  },
  tick(g, dt) {
    if (g.hitT != null) return;
    const b = g.L.body;
    g.mx += g.vx * dt;
    if (g.mx < b.x + g.mr) { g.mx = b.x + g.mr; g.vx = Math.abs(g.vx); }
    if (g.mx > b.x + b.w - g.mr) { g.mx = b.x + b.w - g.mr; g.vx = -Math.abs(g.vx); }
    g.my = cy(b) + 16 + Math.sin(g.t * 9) * 14;
    if (g.d >= 1 && (g.flip -= dt) < 0) { g.flip = .5 + g.rnd() * .8; if (g.rnd() < .5) g.vx = -g.vx; }
  },
  down(g, x, y) {
    if (g.result) return;
    g.glove = { x, y, t: g.t };
    if (dist(x, y, g.mx, g.my) < g.mr + 14) { g.sfx('hit'); g.hitT = g.t; g.win(); g.burst(g.mx, g.my, ['#ffe600', '#fff', '#ff7a00'], 14, 260); }
    else g.sfx('swoosh');
  },
  draw(g, c) {
    drawWin(c, g.L, 'www.prize-zone.biz - Banner', { icon: 'globe' });
    const b = g.L.body;
    const gr = c.createLinearGradient(b.x, 0, b.x + b.w, 0);
    gr.addColorStop(0, '#ffef3a'); gr.addColorStop(.5, '#ff9d00'); gr.addColorStop(1, '#ffef3a');
    c.fillStyle = gr; c.fillRect(b.x, b.y, b.w, b.h);
    font(c, 19, 'bold'); c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillStyle = Math.floor(g.t * 5) % 2 ? '#d4001a' : '#1a2a9a';
    c.fillText('HIT THE MONKEY — WIN A PRIZE!', cx(b), b.y + 8);
    c.save(); c.beginPath(); c.rect(b.x, b.y, b.w, b.h); c.clip();
    c.save(); c.translate(g.mx, g.my);
    if (g.hitT != null) { c.rotate(Math.min(1, (g.t - g.hitT) * 6) * .5); }
    icon(c, 'monkey', 0, 0, g.mr * 2.6);
    c.restore();
    if (g.hitT != null) {
      font(c, 20, 'bold'); c.fillStyle = '#fff'; c.textAlign = 'center';
      for (let i = 0; i < 3; i++) { const a = g.t * 8 + i * 2.1; c.fillText('★', g.mx + Math.cos(a) * 34, g.my - g.mr - 6 + Math.sin(a) * 8); }
    }
    c.restore();
    if (g.glove && g.t - g.glove.t < .25) {
      const a = 1 - (g.t - g.glove.t) / .25;
      c.save(); c.translate(g.glove.x, g.glove.y); c.scale(.8 + a * .4, .8 + a * .4);
      c.beginPath(); c.ellipse(0, 0, 22, 18, 0, 0, 7); c.fillStyle = '#e2412b'; c.fill(); c.strokeStyle = '#6a0a04'; c.lineWidth = 2.5; c.stroke();
      c.beginPath(); c.ellipse(-16, 6, 9, 7, .5, 0, 7); c.fill(); c.stroke();
      c.restore();
    }
  },
  bot: g => ({ tap: [g.mx + g.vx * .04, g.my] }),
  hint: g => ({ at: [g.mx, g.my - g.mr] }),
});

// 3. DEFRAG: tap the red fragments back into place.
def({
  id: 'defrag', word: 'DEFRAG!', name: 'defrag.exe', icon: 'calc', art: 'chrome',
  init(g) {
    g.L = winLayout(8, 30, 464, 420, 34, 'mmx');
    const b = g.L.body;
    g.cols = 8; g.rows = 6;
    g.cw = (b.w - 24) / g.cols; g.ch = 44;
    g.gx = b.x + 12; g.gy = b.y + 60;
    g.cells = [];
    const n = g.cols * g.rows;
    for (let i = 0; i < n; i++) g.cells.push(i < n * .62 ? 0 : 2);
    const reds = 3 + Math.min(g.d, 4);
    const idx = g.shuffle([...Array(n).keys()]).slice(0, reds);
    idx.forEach(i => g.cells[i] = 1);
    g.left = reds;
  },
  cell(g, i) { return { x: g.gx + (i % g.cols) * g.cw, y: g.gy + Math.floor(i / g.cols) * g.ch, w: g.cw - 3, h: g.ch - 3 }; },
  down(g, x, y) {
    if (g.result) return;
    g.cells.forEach((v, i) => {
      if (v !== 1) return;
      const r = this.cell(g, i);
      if (inR(x, y, r, 3)) { g.cells[i] = 3; g.left--; g.sfx('good'); g.burst(cx(r), cy(r), ['#fff', '#4a8bff'], 8, 160); }
    });
    if (g.left === 0) g.win();
  },
  draw(g, c) {
    drawWin(c, g.L, 'Disk Defragmenter', { icon: 'calc' });
    const b = g.L.body;
    para(c, `Fragmented files: ${g.left}. Tap the red ones.`, b.x + 12, b.y + 14, b.w - 24, 17, 1.2, C.ink, 'bold');
    rr(c, g.gx - 6, g.gy - 6, g.cols * g.cw + 9, g.rows * g.ch + 9, 3); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#7f9db9'; c.lineWidth = 1; c.stroke();
    g.cells.forEach((v, i) => {
      const r = this.cell(g, i);
      const col = v === 1 ? (Math.floor(g.t * 6) % 2 ? '#e2412b' : '#ff6a4a') : v === 2 ? '#f4f4f4' : v === 3 ? '#4a8bff' : '#2a5fd0';
      c.fillStyle = col; c.fillRect(r.x, r.y, r.w, r.h);
      if (v !== 2) { c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(r.x, r.y, r.w, 4); }
      c.strokeStyle = 'rgba(0,0,0,.15)'; c.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1);
    });
    const done = g.cells.filter(v => v !== 1).length / g.cells.length;
    progress(c, b.x + 12, b.y + b.h - 40, b.w - 24, 26, g.result === 'win' ? 1 : done * .9);
  },
  bot(g) { const i = g.cells.indexOf(1); if (i < 0) return null; const r = this.cell(g, i); return { tap: [cx(r), cy(r)] }; },
});

// 4. DIAL IN: pick the wave that matches the modem's song.
const WAVES = ['sine', 'square', 'saw', 'triangle', 'pulse', 'noise'];
function wv(kind, x, cyc, ph) {
  const p = (x * cyc + ph) % 1;
  switch (kind) {
    case 'sine': return Math.sin(p * Math.PI * 2);
    case 'square': return p < .5 ? .85 : -.85;
    case 'saw': return p * 2 - 1;
    case 'triangle': return p < .5 ? p * 4 - 1 : 3 - p * 4;
    case 'pulse': return p < .15 ? .9 : -.6;
    default: { const k = Math.floor(x * 70 + ph * 30); return (Math.sin(k * 12.9898) * 43758.5453 % 1) * 1.8; }
  }
}
function drawWave(c, r, kind, cyc, ph, col = '#4cff6a') {
  c.fillStyle = '#071407'; c.fillRect(r.x, r.y, r.w, r.h);
  c.strokeStyle = 'rgba(76,255,106,.18)'; c.lineWidth = 1;
  for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(r.x, r.y + r.h * i / 4); c.lineTo(r.x + r.w, r.y + r.h * i / 4); c.stroke(); }
  c.strokeStyle = col; c.lineWidth = 3; c.beginPath();
  for (let i = 0; i <= 80; i++) { const x = i / 80; const v = clamp(wv(kind, x, cyc, ph), -1, 1); c.lineTo(r.x + 4 + x * (r.w - 8), cy(r) - v * r.h * .36); }
  c.stroke();
}
def({
  id: 'dial', word: 'DIAL IN!', name: 'dialup.exe', icon: 'globe', art: 'lime',
  init(g) {
    g.L = winLayout(10, 20, 460, 440, 34, 'x');
    const kinds = g.shuffle(WAVES.slice());
    g.target = { kind: kinds[0], cyc: g.ri(2, 4) };
    let opts = [g.target, { kind: kinds[1], cyc: g.ri(2, 4) }, { kind: kinds[2], cyc: g.ri(2, 4) }];
    if (g.d >= 2) opts[1] = { kind: g.target.kind, cyc: g.target.cyc === 2 ? 4 : g.target.cyc - 1 };
    g.opts = g.shuffle(opts);
    const b = g.L.body, ow = (b.w - 48) / 3;
    g.btn = g.opts.map((o, i) => ({ x: b.x + 12 + i * (ow + 12), y: b.y + 250, w: ow, h: 132 }));
    g.played = false;
  },
  tick(g) { if (!g.played) { g.played = true; g.squeal(g.target.kind, 300 + g.target.cyc * 140); } },
  down(g, x, y) {
    if (g.result) return;
    g.btn.forEach((r, i) => {
      if (!inR(x, y, r, 4) || g.result) return;
      g.pickI = i;
      if (g.opts[i] === g.target) { g.sfx('connect'); g.win(); } else { g.sfx('busy'); g.lose(); }
    });
  },
  draw(g, c) {
    drawWin(c, g.L, 'Connecting to MeadowNet...', { icon: 'globe' });
    const b = g.L.body;
    para(c, 'The modem is singing. Which song is it?', b.x + 14, b.y + 12, b.w - 28, 17, 1.2, C.ink, 'bold');
    const tr = { x: b.x + 14, y: b.y + 44, w: b.w - 28, h: 150 };
    drawWave(c, tr, g.target.kind, g.target.cyc, g.t * 1.5);
    font(c, 14); c.fillStyle = '#4cff6a'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('MODEM ◂◂ ' + (Math.floor(g.t * 3) % 2 ? 'SKREEEE' : 'BWAAANG'), tr.x + 8, tr.y + 6);
    font(c, 15, 'bold'); c.fillStyle = C.ink; c.fillText('Pick the matching one:', b.x + 14, b.y + 222);
    g.btn.forEach((r, i) => {
      const o = g.opts[i];
      button(c, r, '', { def: g.pickI === i });
      drawWave(c, { x: r.x + 8, y: r.y + 8, w: r.w - 16, h: r.h - 16 }, o.kind, o.cyc, g.t * 1.5, g.result && o === g.target ? '#ffe600' : '#4cff6a');
    });
    if (g.result === 'win') para(c, 'Connected at 56,000 bps!', b.x + 14, b.y + 396, b.w - 28, 16, 1, '#1f7a1a', 'bold');
    if (g.result === 'lose') para(c, 'The line is busy.', b.x + 14, b.y + 396, b.w - 28, 16, 1, '#b01a0a', 'bold');
  },
  bot(g) { const i = g.opts.indexOf(g.target); return { tap: [cx(g.btn[i]), cy(g.btn[i])] }; },
});

// 5. CLEAR COOKIES: actual cookies. Rub them out.
def({
  id: 'cookies', word: 'CLEAR COOKIES!', name: 'cookies.exe', icon: 'cookie', art: 'rainbow',
  init(g) {
    g.L = winLayout(20, 20, 440, 160, 34, 'x');
    const n = 5 + Math.min(g.d, 4);
    g.ck = [];
    for (let k = 0; k < 400 && g.ck.length < n; k++) {
      const x = g.ri(40, W - 40), y = g.ri(200, H - 36);
      if (g.ck.every(o => dist(o.x, o.y, x, y) > 72)) g.ck.push({ x, y, r: 30, a: g.rnd() * 6, gone: false });
    }
    g.held = false;
  },
  eat(g, x, y) {
    for (const o of g.ck) if (!o.gone && dist(x, y, o.x, o.y) < o.r + 10) {
      o.gone = true; g.sfx('crunch'); g.burst(o.x, o.y, ['#c8843a', '#e8b468', '#4a2810'], 12, 200);
    }
    if (!g.result && g.ck.every(o => o.gone)) g.win();
  },
  down(g, x, y) { if (g.result) return; g.held = true; this.eat(g, x, y); },
  move(g, x, y) { if (g.held && !g.result) this.eat(g, x, y); },
  up(g) { g.held = false; },
  draw(g, c) {
    drawWin(c, g.L, 'Internet Options', { icon: 'globe' });
    const b = g.L.body;
    para(c, 'Temporary Internet Files and cookies are using 640 KB of your disk.', b.x + 14, b.y + 14, b.w - 28, 16, 1.3);
    const left = g.ck.filter(o => !o.gone).length;
    button(c, { x: b.x + b.w - 184, y: b.y + b.h - 46, w: 170, h: 34 }, `Delete Cookies (${left})`, { def: true });
    for (const o of g.ck) if (!o.gone) { c.save(); c.translate(o.x, o.y); c.rotate(o.a); icon(c, 'cookie', 0, 0, o.r * 2.3); c.restore(); }
  },
  bot(g) {
    const left = g.ck.filter(o => !o.gone);
    if (!left.length) return null;
    const path = [];
    let cur = left.reduce((a, o) => o.x + o.y < a.x + a.y ? o : a);
    const rest = new Set(left);
    while (cur) { path.push([cur.x, cur.y]); rest.delete(cur); let best = null, bd = 1e9; for (const o of rest) { const d = dist(o.x, o.y, cur.x, cur.y); if (d < bd) { bd = d; best = o; } } cur = best; }
    return { drag: path };
  },
});

// 6. BIN IT: drag the helpful floppy into the Recycle Bin.
def({
  id: 'binit', word: 'BIN IT!', name: 'bitsy.exe', icon: 'bitsy', art: 'chrome',
  init(g) {
    const left = g.rnd() < .5;
    g.bin = { x: left ? 70 : W - 70, y: g.ri(330, 400) };
    g.bx = left ? g.ri(300, 400) : g.ri(80, 180); g.by = g.ri(120, 220);
    g.vx = (g.rnd() - .5) * 60; g.vy = (g.rnd() - .5) * 60;
    g.grab = null; g.gone = null;
    g.wig = 30 + 30 * Math.min(g.d, 3);
  },
  tick(g, dt) {
    if (g.gone != null || g.grab) return;
    g.vx += (g.rnd() - .5) * g.wig * 8 * dt; g.vy += (g.rnd() - .5) * g.wig * 8 * dt;
    const sp = Math.hypot(g.vx, g.vy), mx = g.wig * 1.6;
    if (sp > mx) { g.vx *= mx / sp; g.vy *= mx / sp; }
    g.bx = clamp(g.bx + g.vx * dt, 50, W - 50); g.by = clamp(g.by + g.vy * dt, 60, H - 60);
    if (g.bx <= 50 || g.bx >= W - 50) g.vx *= -1;
    if (g.by <= 60 || g.by >= H - 60) g.vy *= -1;
  },
  down(g, x, y) {
    if (g.result) return;
    if (dist(x, y, g.bx, g.by) < 52) { g.grab = { dx: g.bx - x, dy: g.by - y }; g.sfx('click'); }
  },
  move(g, x, y) { if (g.grab && !g.result) { g.bx = x + g.grab.dx; g.by = y + g.grab.dy; } },
  up(g) {
    if (!g.grab || g.result) return;
    g.grab = null;
    if (dist(g.bx, g.by, g.bin.x, g.bin.y) < 66) { g.gone = g.t; g.sfx('swoosh'); g.win(); }
  },
  draw(g, c) {
    const near = dist(g.bx, g.by, g.bin.x, g.bin.y) < 66;
    deskIcon(c, 'bin', 'Recycle Bin', g.bin.x, g.bin.y, near && g.grab ? 96 : 84, near && g.grab);
    if (g.gone != null) {
      const a = ease((g.t - g.gone) / .25);
      c.save(); c.globalAlpha = 1 - a; icon(c, 'bitsy', g.bx + (g.bin.x - g.bx) * a, g.by + (g.bin.y - g.by) * a, 90 * (1 - a * .8), { scared: true }); c.restore();
      return;
    }
    // speech bubble
    const sx = clamp(g.bx - 110, 6, W - 226), sy = g.by - 120 < 4 ? g.by + 56 : g.by - 112;
    rr(c, sx, sy, 220, 62, 10); c.fillStyle = '#ffffe1'; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 1.5; c.stroke();
    para(c, g.grab ? 'Wait! I can help!! Nooo' : "Hi! It looks like you're playing a game. Need help?", sx + 10, sy + 9, 200, 14, 1.25);
    const lx = clamp((g.bin.x - g.bx) / 200, -1, 1), ly = clamp((g.bin.y - g.by) / 200, -1, 1);
    c.save(); c.translate(g.bx, g.by); c.rotate(g.grab ? Math.sin(g.t * 30) * .12 : Math.sin(g.t * 3) * .06);
    icon(c, 'bitsy', 0, 0, 90, { look: g.grab ? [lx, ly] : [Math.sin(g.t), .2], scared: !!g.grab });
    c.restore();
  },
  bot: g => ({ drag: [[g.bx, g.by], [g.bin.x, g.bin.y]] }),
  hint: g => ({ from: [g.bx, g.by], to: [g.bin.x, g.bin.y] }),
});

// 7. SAVE: File, then Save, before the screen turns blue.
const TYPED = "Dear diary. Today I wrote the best essay of my whole life, nine pages about volcanoes, and I haven't saved it once. If this computer crashes I will";
def({
  id: 'save', word: 'SAVE!', name: 'notepad.exe', icon: 'doc', art: 'lime',
  init(g) {
    g.L = winLayout(12, 14, 456, 452, 34, 'mmx');
    const names = ['File', 'Edit', 'Format', 'View', 'Help'];
    g.menus = g.d >= 1 ? g.shuffle(names) : names;
    const b = g.L.body;
    let x = b.x + 4;
    g.mr = g.menus.map(m => { const w = m.length * 9 + 30; const r = { x, y: b.y + 2, w, h: 34, name: m }; x += w + 2; return r; });
    const items = { File: ['New', 'Open...', 'Save', 'Save As...', 'Print...', 'Exit'], Edit: ['Undo', 'Cut', 'Copy', 'Paste'], Format: ['Word Wrap', 'Font...'], View: ['Status Bar'], Help: ['Help Topics', 'About Notepad'] };
    if (g.d >= 2) items.File = g.shuffle(items.File);
    g.items = items; g.open = null; g.saved = null;
  },
  dropRects(g) {
    const m = g.mr.find(r => r.name === g.open);
    return g.items[g.open].map((name, i) => ({ x: m.x, y: m.y + m.h + 2 + i * 38, w: 180, h: 38, name }));
  },
  down(g, x, y) {
    if (g.result) return;
    if (g.open) {
      const it = this.dropRects(g).find(r => inR(x, y, r));
      if (it) {
        if (g.open === 'File' && it.name === 'Save') { g.sfx('save'); g.saved = g.t; g.open = null; g.win(); return; }
        g.sfx('click'); g.open = null; return;
      }
    }
    const m = g.mr.find(r => inR(x, y, r, 4));
    g.open = m && m.name !== g.open ? m.name : null;
    if (m) g.sfx('click');
  },
  draw(g, c) {
    drawWin(c, g.L, g.saved != null ? 'volcanoes.txt - Notepad' : 'Untitled - Notepad', { icon: 'doc' });
    const b = g.L.body;
    c.fillStyle = C.body; c.fillRect(b.x, b.y, b.w, 38);
    g.mr.forEach(r => {
      if (r.name === g.open) { c.fillStyle = C.sel; c.fillRect(r.x, r.y, r.w, r.h); }
      font(c, 17); c.fillStyle = r.name === g.open ? '#fff' : C.ink; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(r.name, cx(r), cy(r) + 1);
    });
    const tb = { x: b.x + 2, y: b.y + 40, w: b.w - 4, h: b.h - 42 };
    c.fillStyle = '#fff'; c.fillRect(tb.x, tb.y, tb.w, tb.h);
    const n = Math.min(TYPED.length, Math.floor(g.t * 34));
    const ht = para(c, TYPED.slice(0, n) + (Math.floor(g.t * 3) % 2 ? '|' : ''), tb.x + 10, tb.y + 10, tb.w - 20, 18, 1.4, C.ink, '', MONO_FALLBACK);
    if (g.open) {
      const rs = this.dropRects(g);
      const last = rs[rs.length - 1];
      c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 6; c.shadowOffsetX = 3; c.shadowOffsetY = 3;
      c.fillStyle = '#fff'; c.fillRect(rs[0].x, rs[0].y, 180, last.y + last.h - rs[0].y); c.restore();
      c.strokeStyle = '#aca899'; c.strokeRect(rs[0].x + .5, rs[0].y + .5, 179, last.y + last.h - rs[0].y - 1);
      rs.forEach(r => { font(c, 17); c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(r.name, r.x + 22, cy(r) + 1); });
    }
    // trouble brewing
    const f = g.t / g.dur;
    if (!g.result && f > .55) {
      c.fillStyle = `rgba(0,0,170,${(f - .55) * .5})`;
      for (let i = 0; i < 5; i++) { const y = ((g.t * 300 + i * 97) % H); c.fillRect(0, y, W, 6 + i * 3); }
    }
    if (g.saved != null) {
      const a = ease((g.t - g.saved) / .2);
      icon(c, 'floppy', 240, 300, 60 + a * 40);
      font(c, 22, 'bold'); c.fillStyle = '#1f7a1a'; c.textAlign = 'center'; c.fillText('Saved!', 240, 370);
    }
    if (g.result === 'lose') {
      c.fillStyle = '#0000aa'; c.fillRect(0, 0, W, H);
      font(c, 18, '', MONO_FALLBACK); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('A fatal exception has occurred.', 240, 220); c.fillText('Your essay was not saved.', 240, 250);
    }
  },
  bot(g) {
    if (g.open !== 'File') { const m = g.mr.find(r => r.name === 'File'); return { tap: [cx(m), cy(m)] }; }
    const it = this.dropRects(g).find(r => r.name === 'Save'); return { tap: [cx(it), cy(it)] };
  },
  hint(g) {
    if (g.open !== 'File') { const m = g.mr.find(r => r.name === 'File'); return { at: [cx(m), m.y + 6] }; }
    const it = this.dropRects(g).find(r => r.name === 'Save'); return { at: [it.x + 60, it.y + 4] };
  },
});
const MONO_FALLBACK = '"Lucida Console", "Courier New", monospace';

// 8. DON'T TOUCH: updates are installing. Leave it alone.
def({
  id: 'wait', word: "DON'T TOUCH!", name: 'update.exe', icon: 'clock', art: 'grape', survive: true,
  init(g) {
    g.L = winLayout(40, 30, 400, 210, 34, '');
    g.bx = g.ri(90, 390); g.by = g.ri(320, 420); g.bvx = (g.rnd() < .5 ? -1 : 1) * (120 + 30 * g.d); g.bvy = 90;
    g.touched = null;
  },
  tick(g, dt) {
    g.bx += g.bvx * dt; g.by += g.bvy * dt;
    if (g.bx < 90 || g.bx > W - 90) { g.bvx *= -1; g.bx = clamp(g.bx, 90, W - 90); }
    if (g.by < 290 || g.by > H - 40) { g.bvy *= -1; g.by = clamp(g.by, 290, H - 40); }
  },
  down(g, x, y) { if (g.result) return; g.touched = { x, y }; g.sfx('bad'); g.lose(); },
  draw(g, c) {
    drawWin(c, g.L, 'Installing Updates (3 of 27)', { icon: 'setup' });
    const b = g.L.body;
    para(c, 'Please do not touch anything. Your computer may restart several times.', b.x + 16, b.y + 14, b.w - 32, 16, 1.3);
    progress(c, b.x + 16, b.y + 84, b.w - 32, 24, g.t / g.dur);
    icon(c, 'clock', b.x + 30, b.y + 140, 34 + Math.sin(g.t * 8) * 3);
    font(c, 15); c.fillStyle = C.grey; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(`About ${Math.max(1, Math.round((g.dur - g.t) * 7))} minutes remaining`, b.x + 56, b.y + 140);
    const r = { x: g.bx - 85, y: g.by - 30, w: 170, h: 60 };
    rr(c, r.x, r.y, r.w, r.h, 30);
    const gr = c.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, '#ff8a6a'); gr.addColorStop(.5, '#e2412b'); gr.addColorStop(1, '#a8200e');
    c.fillStyle = gr; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, r.x + 10, r.y + 4, r.w - 20, 20, 10); c.fill();
    font(c, 22, 'bold'); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(Math.floor(g.t * 4) % 2 ? 'CLICK ME!' : 'FREE STUFF', g.bx, g.by + 2);
    if (g.touched) {
      icon(c, 'err', 240, 180, 80);
      font(c, 20, 'bold'); c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.lineWidth = 4; c.strokeText('You touched it.', 240, 240); c.fillText('You touched it.', 240, 240);
    }
  },
  bot: () => null,
});

// 9. SHUT DOWN: open the go menu and pick the right way out.
def({
  id: 'shutdown', word: 'SHUT DOWN!', name: 'shutdown.exe', icon: 'pc', art: 'chrome',
  init(g) {
    g.bar = { x: 0, y: H - 48, w: W, h: 48 };
    g.go = { x: 0, y: H - 48, w: 120, h: 48 };
    g.menu = { x: 0, y: H - 48 - 340, w: 320, h: 340 };
    const opts = g.d >= 1 ? ['Log Off', 'Turn Off', 'Stand By'] : ['Log Off', 'Turn Off'];
    const names = g.d >= 1 ? g.shuffle(opts) : opts;
    const m = g.menu, n = names.length, bw = (m.w - 20 - (n - 1) * 8) / n;
    g.foot = names.map((name, i) => ({ x: m.x + 10 + i * (bw + 8), y: m.y + m.h - 56, w: bw, h: 44, name }));
    g.open = false; g.off = null;
  },
  down(g, x, y) {
    if (g.result) return;
    if (inR(x, y, g.go, 4)) { g.open = !g.open; g.sfx('click'); return; }
    if (g.open) {
      const f = g.foot.find(r => inR(x, y, r, 3));
      if (f) { if (f.name === 'Turn Off') { g.off = g.t; g.sfx('over'); g.win(); } else { g.sfx('bad'); g.lose(); g.wrong = f.name; } return; }
      if (!inR(x, y, g.menu)) g.open = false;
    }
  },
  draw(g, c) {
    // the in-game taskbar
    const b = g.bar;
    let gr = c.createLinearGradient(0, b.y, 0, b.y + b.h); gr.addColorStop(0, '#3f8cf3'); gr.addColorStop(.15, '#245edb'); gr.addColorStop(1, '#1941a5');
    c.fillStyle = gr; c.fillRect(b.x, b.y, b.w, b.h);
    drawGo(c, g.go, g.open);
    if (g.open) {
      const m = g.menu;
      c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 10; rr(c, m.x, m.y, m.w, m.h, [8, 8, 0, 0]); c.fillStyle = '#fff'; c.fill(); c.restore();
      gr = c.createLinearGradient(0, m.y, 0, m.y + 56); gr.addColorStop(0, '#2f7bff'); gr.addColorStop(1, '#1650d0');
      rr(c, m.x, m.y, m.w, 56, [8, 8, 0, 0]); c.fillStyle = gr; c.fill();
      icon(c, 'image', m.x + 32, m.y + 28, 36);
      font(c, 19, 'bold'); c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('Player', m.x + 60, m.y + 29);
      const items = [['globe', 'Internet'], ['mail', 'E-mail'], ['doc', 'My Documents'], ['music', 'My Music'], ['calc', 'Control Panel']];
      items.forEach(([ic, name], i) => { icon(c, ic, m.x + 30, m.y + 80 + i * 40, 28); font(c, 16); c.fillStyle = C.ink; c.fillText(name, m.x + 54, m.y + 81 + i * 40); });
      c.fillStyle = '#d6dff7'; c.fillRect(m.x, m.y + m.h - 66, m.w, 66);
      g.foot.forEach(f => button(c, f, f.name, { bold: true, fill: f.name === 'Turn Off' ? '#ffd0c4' : undefined, size: 16 }));
    }
    if (g.off != null) {
      const a = ease((g.t - g.off) / .3);
      c.fillStyle = `rgba(0,0,0,${a})`; c.fillRect(0, 0, W, H);
      font(c, 20, 'bold'); c.fillStyle = `rgba(255,150,40,${a})`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText("It's now safe to turn off", 240, 225); c.fillText('your computer.', 240, 255);
    }
    if (g.wrong) { font(c, 22, 'bold'); c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.lineWidth = 4; c.textAlign = 'center'; const s = g.wrong === 'Log Off' ? 'Logging off...' : 'Zzz...'; c.strokeText(s, 240, 70); c.fillText(s, 240, 70); }
  },
  bot(g) { if (!g.open) return { tap: [cx(g.go), cy(g.go)] }; const f = g.foot.find(r => r.name === 'Turn Off'); return { tap: [cx(f), cy(f)] }; },
});
export function drawGo(c, r, down) {
  const gr = c.createLinearGradient(0, r.y, 0, r.y + r.h);
  gr.addColorStop(0, down ? '#2a7a2a' : '#5cc85c'); gr.addColorStop(.2, down ? '#2f8f2f' : '#3aa83a'); gr.addColorStop(1, '#236f23');
  rr(c, r.x, r.y, r.w, r.h, [0, r.h * .45, r.h * .45, 0]); c.fillStyle = gr; c.fill();
  c.fillStyle = 'rgba(255,255,255,.18)'; rr(c, r.x, r.y + 2, r.w - 6, r.h * .35, [0, 10, 10, 0]); c.fill();
  const s = r.h * .5;
  // the logo: a little sun over a hill
  c.save(); c.translate(r.x + r.h * .55, r.y + r.h / 2);
  c.beginPath(); c.arc(0, 0, s * .5, 0, 7); c.fillStyle = '#fff'; c.fill();
  c.beginPath(); c.arc(s * .1, -s * .1, s * .2, 0, 7); c.fillStyle = '#ffd500'; c.fill();
  c.beginPath(); c.moveTo(-s * .5, s * .15); c.quadraticCurveTo(0, -s * .15, s * .5, s * .2); c.lineTo(s * .45, s * .3); c.arc(0, 0, s * .5, .6, Math.PI - .6); c.closePath(); c.fillStyle = '#3aa83a'; c.fill();
  c.restore();
  font(c, r.h * .5, 'bold italic'); c.fillStyle = 'rgba(0,0,0,.4)'; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText('go', r.x + r.h * 1.05 + 1, r.y + r.h / 2 + 2); c.fillStyle = '#fff'; c.fillText('go', r.x + r.h * 1.05, r.y + r.h / 2 + 1);
}

// 10. SELECT ALL: drag a box round every icon.
const DESK = [['folder', 'Homework'], ['doc', 'todo.txt'], ['image', 'dog.bmp'], ['music', 'song.mid'], ['game', 'Snake'], ['mail', 'Mail'], ['cd', 'CD Drive'], ['paint', 'Paint'], ['calc', 'Calc'], ['globe', 'Web']];
def({
  id: 'select', word: 'SELECT ALL!', name: 'explorer.exe', icon: 'folder', art: 'lime',
  init(g) {
    const n = 3 + Math.min(g.d, 3);
    const types = g.shuffle(DESK.slice()).slice(0, n);
    g.ic = [];
    for (let k = 0; k < 500 && g.ic.length < n; k++) {
      const x = g.ri(50, W - 50), y = g.ri(50, H - 70);
      if (g.ic.every(o => Math.abs(o.x - x) > 84 || Math.abs(o.y - y) > 92)) g.ic.push({ x, y, t: types[g.ic.length] });
    }
    g.box = null;
  },
  inBox(g, o) { const b = g.box; return b && o.x > Math.min(b.x0, b.x1) && o.x < Math.max(b.x0, b.x1) && o.y > Math.min(b.y0, b.y1) && o.y < Math.max(b.y0, b.y1); },
  down(g, x, y) { if (g.result) return; g.box = { x0: x, y0: y, x1: x, y1: y }; },
  move(g, x, y) {
    if (!g.box || g.result) return;
    g.box.x1 = x; g.box.y1 = y;
    if (g.ic.every(o => this.inBox(g, o))) { g.sfx('good'); g.win(); }
  },
  up(g) { if (!g.result) g.box = null; },
  draw(g, c) {
    for (const o of g.ic) deskIcon(c, o.t[0], o.t[1], o.x, o.y, 58, this.inBox(g, o));
    if (g.box) {
      const b = g.box, x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1);
      c.fillStyle = 'rgba(49,106,197,.25)'; c.fillRect(x, y, Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
      c.strokeStyle = '#316ac5'; c.lineWidth = 1.5; c.strokeRect(x, y, Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    }
  },
  bot(g) {
    const xs = g.ic.map(o => o.x), ys = g.ic.map(o => o.y);
    return { drag: [[Math.max(4, Math.min(...xs) - 40), Math.max(4, Math.min(...ys) - 40)], [Math.min(W - 4, Math.max(...xs) + 40), Math.min(H - 4, Math.max(...ys) + 40)]] };
  },
});

// 11. AGREE: scroll the licence to the bottom, then I Agree.
const EULA = [
  'MEADOW SOFTWARE LICENCE AGREEMENT', '', 'By reading this sentence you have', 'already agreed to most of it.', '',
  '1. You may install this software on', 'one (1) computer, or one (1) toaster', 'if the toaster asks nicely.', '',
  '2. You may not lend it to your cousin.', '', '3. The software may contain pop-ups.', 'The pop-ups may contain software.', '',
  '4. Meadow is not responsible for lost', 'homework, lost essays, or the sound', 'the modem makes at 2 a.m.', '',
  '5. All smileys remain the property of', 'their respective smiles.', '', '6. You agree to restart your computer', 'whenever it feels like it.', '',
  '7. Reading this far voids the warranty.', '', '8. The paperclip is not included.', 'Please stop asking about the paperclip.', '',
  '9. This licence continues for a while', 'longer than you would like.', '', '10. Almost there.', '', '11. Nearly.', '',
  '12. Thank you for reading. Nobody does.', '', '', '— END OF AGREEMENT —',
];
def({
  id: 'agree', word: 'AGREE!', name: 'license.txt', icon: 'setup', art: 'grape', dur: 5.4,
  init(g) {
    g.L = winLayout(20, 14, 440, 452, 34, 'x');
    const b = g.L.body;
    g.box = { x: b.x + 12, y: b.y + 46, w: b.w - 24 - 26, h: 270 };
    g.track = { x: g.box.x + g.box.w + 2, y: g.box.y, w: 24, h: g.box.h };
    g.lines = g.d >= 1 ? EULA.slice(0, 2).concat(EULA.slice(2, 30), EULA.slice(2, 12), EULA.slice(30)) : EULA;
    g.content = g.lines.length * 22 + 20;
    g.max = g.content - g.box.h; g.sc = 0; g.vel = 0;
    g.agree = { x: b.x + b.w - 250, y: b.y + b.h - 52, w: 116, h: 38 };
    g.cancel = { x: b.x + b.w - 126, y: b.y + b.h - 52, w: 114, h: 38 };
    g.drag = null;
  },
  thumb(g) { const th = Math.max(40, g.track.h * g.box.h / g.content); return { x: g.track.x + 2, y: g.track.y + (g.track.h - th) * (g.sc / g.max), w: g.track.w - 4, h: th }; },
  tick(g, dt) {
    if (!g.drag && Math.abs(g.vel) > 1) { g.sc = clamp(g.sc + g.vel * dt, 0, g.max); g.vel *= Math.pow(.04, dt); }
  },
  ok: g => g.sc >= g.max - 6,
  down(g, x, y) {
    if (g.result) return;
    if (inR(x, y, g.agree, 4)) { if (this.ok(g)) { g.sfx('good'); g.win(); } else g.sfx('tick'); return; }
    if (inR(x, y, g.cancel, 4)) { g.sfx('bad'); g.lose(); return; }
    if (inR(x, y, g.track, 6)) { const t = this.thumb(g); if (!inR(x, y, t)) g.sc = clamp(((y - g.track.y - t.h / 2) / (g.track.h - t.h)) * g.max, 0, g.max); g.drag = { mode: 'thumb', y, sc: g.sc }; return; }
    if (inR(x, y, g.box, 10)) { g.drag = { mode: 'text', y, sc: g.sc, ly: y, lt: g.t }; g.vel = 0; }
  },
  move(g, x, y) {
    const d = g.drag; if (!d || g.result) return;
    if (d.mode === 'thumb') { const t = this.thumb(g); g.sc = clamp(d.sc + (y - d.y) * g.max / (g.track.h - t.h), 0, g.max); }
    else { g.sc = clamp(d.sc - (y - d.y) * 1.4, 0, g.max); const dt = g.t - d.lt; if (dt > 0) g.vel = -(y - d.ly) * 1.4 / dt; d.ly = y; d.lt = g.t; }
  },
  up(g) { if (g.drag && g.drag.mode === 'text') g.vel = clamp(g.vel, -3000, 3000); else g.vel = 0; g.drag = null; },
  draw(g, c) {
    drawWin(c, g.L, 'Meadow Setup - Licence', { icon: 'setup' });
    const b = g.L.body;
    para(c, 'Scroll down and read every word. (Or don\'t.)', b.x + 12, b.y + 14, b.w - 24, 16, 1.2, C.ink, 'bold');
    c.fillStyle = '#fff'; c.fillRect(g.box.x, g.box.y, g.box.w, g.box.h); c.strokeStyle = '#7f9db9'; c.strokeRect(g.box.x + .5, g.box.y + .5, g.box.w - 1, g.box.h - 1);
    c.save(); c.beginPath(); c.rect(g.box.x, g.box.y, g.box.w, g.box.h); c.clip();
    font(c, 15); c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'top';
    g.lines.forEach((l, i) => { const y = g.box.y + 10 + i * 22 - g.sc; if (y > g.box.y - 22 && y < g.box.y + g.box.h) { font(c, 15, i === 0 ? 'bold' : ''); c.fillText(l, g.box.x + 10, y); } });
    c.restore();
    c.fillStyle = '#f4f3ee'; c.fillRect(g.track.x, g.track.y, g.track.w, g.track.h);
    const t = this.thumb(g); button(c, t, '≡', { size: 14 });
    font(c, 14); c.fillStyle = C.grey; c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillText(this.ok(g) ? 'Thank you for reading.' : `${Math.round(g.sc / g.max * 100)}% read`, b.x + 12, g.agree.y + 12);
    button(c, g.agree, 'I Agree', { dis: !this.ok(g), def: this.ok(g), bold: true });
    button(c, g.cancel, 'Cancel');
  },
  bot(g) {
    if (!this.ok(g)) { const t = this.thumb(g); return { drag: [[cx(t), cy(t)], [cx(t), g.track.y + g.track.h + 20]] }; }
    return { tap: [cx(g.agree), cy(g.agree)] };
  },
});

// 12. OPEN IT: double-click the folder that keeps hopping away.
def({
  id: 'openit', word: 'OPEN IT!', name: 'homework.exe', icon: 'folder', art: 'rainbow',
  init(g) {
    g.hop = Math.max(.6, 1.1 - .12 * g.d); g.nextHop = g.hop; // real seconds
    g.fx = g.ri(70, W - 70); g.fy = g.ri(70, H - 90); g.from = null;
    g.lastTap = -9; g.sel = false; g.opened = null;
  },
  tick(g, dt) {
    if (g.result) return;
    if (g.rt > g.nextHop) {
      g.nextHop += g.hop; g.from = { x: g.fx, y: g.fy, t: g.t };
      let x, y; do { x = g.ri(70, W - 70); y = g.ri(70, H - 90); } while (dist(x, y, g.fx, g.fy) < 140);
      g.fx = x; g.fy = y; g.sel = false;
    }
  },
  pos(g) { if (!g.from) return [g.fx, g.fy]; const a = ease((g.t - g.from.t) / .12); return [g.from.x + (g.fx - g.from.x) * a, g.from.y + (g.fy - g.from.y) * a]; },
  down(g, x, y) {
    if (g.result) return;
    const [px, py] = this.pos(g);
    if (Math.abs(x - px) < 52 && Math.abs(y - py - 8) < 56) {
      if (g.rt - g.lastTap < .45 && g.sel) { g.opened = g.t; g.sfx('good'); g.win(); return; }
      g.lastTap = g.rt; g.sel = true; g.sfx('click');
    } else g.sel = false;
  },
  draw(g, c) {
    const [px, py] = this.pos(g);
    if (g.opened != null) {
      const a = ease((g.t - g.opened) / .2);
      const L = winLayout(px + (20 - px) * a - 60 * (1 - a), py + (40 - py) * a - 40 * (1 - a), 120 + 320 * a, 80 + 320 * a, 34, 'mmx');
      drawWin(c, L, 'Homework', { icon: 'folder' });
      if (a > .9) { para(c, 'This folder is empty.', L.body.x + 16, L.body.y + 16, 300, 17); }
      return;
    }
    deskIcon(c, 'folder', 'Homework', px, py, 74, g.sel);
  },
  bot(g) { const [px, py] = this.pos(g); return { taps: [[px, py], [px, py]], gap: .09 }; },
});

// 13. STACK: drop the card on the one it goes on (other colour, one higher).
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
function drawCard(c, x, y, card, w = 84, h = 118, glow) {
  c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
  rr(c, x, y, w, h, 7); c.fillStyle = '#fff'; c.fill(); c.restore();
  c.strokeStyle = glow || '#333'; c.lineWidth = glow ? 4 : 1.2; rr(c, x, y, w, h, 7); c.stroke();
  const red = card.s === 'h' || card.s === 'd';
  font(c, 24, 'bold'); c.fillStyle = red ? '#d01f1f' : '#111'; c.textAlign = 'left'; c.textBaseline = 'top';
  c.fillText(RANKS[card.r], x + 7, y + 6);
  suit(c, card.s, x + 17, y + 44, 15);
  suit(c, card.s, x + w * .58, y + h * .62, 40);
}
def({
  id: 'stack', word: 'STACK!', name: 'solitaire.exe', icon: 'game', art: 'lime',
  init(g) {
    g.L = winLayout(4, 4, 472, 472, 34, 'mmx');
    const r = g.ri(1, 11);
    const red = g.rnd() < .5;
    const redS = ['h', 'd'], blk = ['s', 'c'];
    g.card = { r, s: g.pick(red ? redS : blk) };
    const good = { r: r + 1, s: g.pick(red ? blk : redS), ok: true };
    const bad = [{ r: r + 1, s: g.pick(red ? redS : blk) }, { r: clamp(r + g.pick([-1, 2]), 0, 12), s: g.pick(red ? blk : redS) }, { r: clamp(r + g.pick([3, -2]), 0, 12), s: g.pick(red ? blk : redS) }];
    const n = g.d >= 2 ? 4 : 3;
    const tg = g.shuffle([good, ...bad.slice(0, n - 1)]);
    const tw = 84, gap = (g.L.body.w - n * tw) / (n + 1);
    g.targets = tg.map((t, i) => ({ ...t, x: g.L.body.x + gap + i * (tw + gap), y: g.L.body.y + 30 }));
    g.home = { x: 240 - 42, y: 320 }; g.px = g.home.x; g.py = g.home.y; g.grab = null; g.back = null; g.won = null;
  },
  down(g, x, y) {
    if (g.result) return;
    if (x > g.px - 10 && x < g.px + 94 && y > g.py - 10 && y < g.py + 128) { g.grab = { dx: g.px - x, dy: g.py - y }; g.back = null; g.sfx('click'); }
  },
  move(g, x, y) { if (g.grab && !g.result) { g.px = x + g.grab.dx; g.py = y + g.grab.dy; } },
  up(g) {
    if (!g.grab || g.result) return;
    g.grab = null;
    const t = g.targets.find(t => Math.abs(t.x - g.px) < 60 && Math.abs(t.y + 34 - g.py) < 80);
    if (t && t.ok) { g.px = t.x; g.py = t.y + 34; g.won = g.t; g.sfx('win'); g.win(); }
    else if (t) { g.bad = t; g.sfx('bad'); g.lose(); }
    else g.back = { x: g.px, y: g.py, t: g.t };
  },
  tick(g) { if (g.back) { const a = ease((g.t - g.back.t) / .15); g.px = g.back.x + (g.home.x - g.back.x) * a; g.py = g.back.y + (g.home.y - g.back.y) * a; if (a >= 1) g.back = null; } },
  draw(g, c) {
    drawWin(c, g.L, 'Solitaire', { icon: 'game', bodyColor: '#0b7a3a' });
    const b = g.L.body;
    c.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 6; i++) c.fillRect(b.x, b.y + i * 80, b.w, 40);
    g.targets.forEach(t => drawCard(c, t.x, t.y, t, 84, 118, g.result && t.ok ? '#ffe600' : (g.bad === t ? '#e2412b' : null)));
    rr(c, g.home.x, g.home.y, 84, 118, 7); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.setLineDash([6, 5]); c.stroke(); c.setLineDash([]);
    if (g.won != null) for (let i = 0; i < 6; i++) {
      const tt = g.t - g.won - i * .05; if (tt < 0) continue;
      const x = g.px + tt * (i % 2 ? 160 : -160), y = g.py + 30 - Math.abs(Math.sin(tt * 7)) * 120 * Math.exp(-tt * 1.2) + tt * 60;
      drawCard(c, x, y, { r: (g.card.r + i) % 13, s: 'hscd'[i % 4] }, 84, 118);
    }
    drawCard(c, g.px, g.py, g.card);
    font(c, 15); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText('Red on black, black on red, one rank higher.', 240, b.y + b.h - 34);
  },
  bot(g) { const t = g.targets.find(t => t.ok); return { drag: [[g.px + 42, g.py + 60], [t.x + 42, t.y + 34 + 60]] }; },
});

// 14. PRINT: mash the jammed printer.
def({
  id: 'print', word: 'PRINT!', name: 'printer.exe', icon: 'printer', art: 'chrome', dur: 4.8,
  init(g) { g.need = 5 + Math.min(g.d, 3); g.n = 0; g.shake = 0; g.L = winLayout(20, 20, 440, 100, 34, 'x'); },
  tick(g, dt) { g.shake = Math.max(0, g.shake - dt * 6); },
  down(g, x, y) {
    if (g.result || y < 130) return;
    g.n++; g.shake = 1; g.sfx('print');
    g.burst(240 + (g.rnd() - .5) * 80, 300, ['#fff', '#222'], 3, 120);
    if (g.n >= g.need) { g.sfx('good'); g.win(); }
  },
  draw(g, c) {
    drawWin(c, g.L, 'Printer Error', { icon: 'warn' });
    para(c, g.result === 'win' ? 'Printing... done!' : `Paper jam! Tap the printer. (${g.need - g.n} more)`, g.L.body.x + 14, g.L.body.y + 16, 400, 17, 1.2, C.ink, 'bold');
    const f = g.result === 'win' ? 1 : g.n / g.need;
    c.save(); c.translate(240 + Math.sin(g.t * 70) * 6 * g.shake, 290);
    // paper coming out of the front
    c.fillStyle = '#fff'; c.strokeStyle = '#888'; c.lineWidth = 2;
    const py = 30 + f * 120;
    c.save(); c.rotate(g.result === 'win' ? 0 : Math.sin(g.n) * .08);
    c.fillRect(-70, 20, 140, py - 20 + 60); c.strokeRect(-70, 20, 140, py - 20 + 60);
    c.fillStyle = '#7d9cc8'; for (let i = 0; i < Math.floor(f * 8); i++) c.fillRect(-56, py + 60 - 16 - i * 12, 90 + (i * 37) % 30, 4);
    c.restore();
    icon(c, 'printer', 0, -30, 240);
    c.restore();
    if (!g.result) { font(c, 30, '', 'Anton, Impact, sans-serif'); c.fillStyle = Math.floor(g.t * 6) % 2 ? '#e2412b' : '#fff'; c.textAlign = 'center'; c.strokeStyle = '#111'; c.lineWidth = 5; c.strokeText('JAM!', 380, 200); c.fillText('JAM!', 380, 200); }
  },
  bot: () => ({ tap: [240, 280], react: .1 }),
});

// 15. MUTE: drag the volume all the way down.
def({
  id: 'mute', word: 'MUTE!', name: 'volume.exe', icon: 'speaker', art: 'rainbow',
  init(g) {
    g.L = winLayout(120, 10, 240, 460, 34, 'x');
    g.track = { x: 240 - 14, y: 120, w: 28, h: 280 };
    g.v = 1; g.grab = false; g.jT = 0;
    g.creep = 70 * Math.min(g.d, 3);
  },
  ky(g) { return g.track.y + (1 - g.v) * g.track.h; },
  tick(g, dt) {
    if (g.result) return;
    if (!g.grab && g.creep) g.v = Math.min(1, g.v + g.creep / g.track.h * dt);
    if ((g.jT -= dt) < 0 && g.v > .1) { g.jT = .8; g.sfx('jingle'); }
  },
  set(g, y) { g.v = clamp(1 - (y - g.track.y) / g.track.h, 0, 1); if (g.v < .06) { g.v = 0; g.sfx('click'); g.win(); } },
  down(g, x, y) { if (g.result) return; if (Math.abs(x - 240) < 70 && y > g.track.y - 30 && y < g.track.y + g.track.h + 30) { g.grab = true; this.set(g, y); } },
  move(g, x, y) { if (g.grab && !g.result) this.set(g, y); },
  up(g) { g.grab = false; },
  draw(g, c) {
    drawWin(c, g.L, 'Volume', { icon: 'speaker' });
    const b = g.L.body;
    icon(c, 'speaker', 240, b.y + 40, 54, { off: g.v === 0 });
    if (g.v > 0) { font(c, 22, 'bold'); c.fillStyle = '#e2412b'; c.textAlign = 'center'; c.fillText('♪ ♫ ♪', 240 + Math.sin(g.t * 12) * 6, b.y + 74); }
    const t = g.track;
    for (let i = 0; i <= 10; i++) { c.fillStyle = C.grey; c.fillRect(t.x - 26, t.y + t.h * i / 10, 14, 2); c.fillRect(t.x + t.w + 12, t.y + t.h * i / 10, 14, 2); }
    rr(c, t.x + 9, t.y - 6, 10, t.h + 12, 5); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#888'; c.stroke();
    const ky = this.ky(g);
    rr(c, 240 - 44, ky - 15, 88, 30, 6);
    const gr = c.createLinearGradient(0, ky - 15, 0, ky + 15); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#c9c4b4');
    c.fillStyle = gr; c.fill(); c.strokeStyle = '#003c74'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#2f5fd0'; c.fillRect(240 - 30, ky - 2, 60, 4);
    font(c, 15, 'bold'); c.fillStyle = C.ink; c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText(g.v === 0 ? 'Mute' : `${Math.round(g.v * 100)}%`, 240, t.y + t.h + 22);
  },
  bot(g) { return { drag: [[240, this.ky(g)], [240, g.track.y + g.track.h + 10]] }; },
});

// 16. CORNER: tap the instant the bouncing logo hits a corner.
const fold = (X, L) => { const m = ((X % (2 * L)) + 2 * L) % (2 * L); return m <= L ? m : 2 * L - m; };
def({
  id: 'corner', word: 'CORNER!', name: 'screensaver.scr', icon: 'pc', art: 'grape', dur: 4.6,
  init(g) {
    g.lw = 132; g.lh = 64;
    g.Lx = W - g.lw; g.Ly = H - g.lh;
    g.v = 175 + 30 * Math.min(g.d, 4);
    g.tc = g.dur * (.48 + g.rnd() * .22);
    const a = (32 + g.rnd() * 26) * Math.PI / 180;
    g.right = g.rnd() < .5; g.bottom = g.rnd() < .5;
    g.vx = (g.right ? 1 : -1) * g.v * Math.cos(a); g.vy = (g.bottom ? 1 : -1) * g.v * Math.sin(a);
    g.X0 = (g.right ? g.Lx : 0) - g.vx * g.tc; g.Y0 = (g.bottom ? g.Ly : 0) - g.vy * g.tc;
    g.win0 = .19; g.col = 0; g.tapT = null;
  },
  pos(g, t = g.t) { return [fold(g.X0 + g.vx * t, g.Lx), fold(g.Y0 + g.vy * t, g.Ly)]; },
  near(g) { const [x, y] = this.pos(g); const dx = Math.min(x, g.Lx - x), dy = Math.min(y, g.Ly - y); return Math.max(dx, dy) <= g.win0 * g.v; },
  down(g) {
    if (g.result) return;
    g.tapT = g.t;
    if (this.near(g)) { g.sfx('win'); g.win(); const [x, y] = this.pos(g); g.burst(x + g.lw / 2, y + g.lh / 2, ['#fff', '#ffe600', '#ff7ae6', '#4cff6a'], 30, 320); }
    else { g.sfx('bad'); g.lose(); }
  },
  draw(g, c) {
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    const [x, y] = g.result ? this.pos(g, g.tapT) : this.pos(g);
    const hue = Math.floor((g.X0 + g.vx * g.t) / g.Lx) + Math.floor((g.Y0 + g.vy * g.t) / g.Ly);
    const cols = ['#ff4a8a', '#4cff6a', '#4aa8ff', '#ffe600', '#ff8a2a', '#b47aff'];
    const col = cols[((hue % 6) + 6) % 6];
    rr(c, x, y, g.lw, g.lh, 14); c.strokeStyle = col; c.lineWidth = 5; c.stroke();
    font(c, 34, '', 'Anton, Impact, sans-serif'); c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('MEADOW', x + g.lw / 2, y + g.lh / 2 + 2);
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2; c.strokeRect(1, 1, W - 2, H - 2);
    if (g.result === 'lose') { font(c, 22, 'bold'); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText('So close.', 240, 240); }
  },
  bot(g) { return Math.abs(g.t - g.tc) < .05 ? { tap: [240, 240] } : null; },
});

// 17. RESIZE: drag the corner until the window fills the outline.
def({
  id: 'resize', word: 'RESIZE!', name: 'resize.exe', icon: 'image', art: 'lime',
  init(g) {
    g.ox = g.ri(14, 60); g.oy = g.ri(14, 60);
    g.w = 170; g.h = 130;
    g.tw = g.ri(300, W - g.ox - 14); g.th = g.ri(250, H - g.oy - 14);
    if (g.rnd() < .5 && g.d >= 1) { g.w = g.tw + 20 < W - g.ox - 6 ? W - g.ox - 10 : 170; }
    g.tol = 20 - 3 * Math.min(g.d, 2); g.grab = null;
  },
  fits(g) { return Math.abs(g.w - g.tw) < g.tol && Math.abs(g.h - g.th) < g.tol; },
  down(g, x, y) { if (g.result) return; if (dist(x, y, g.ox + g.w, g.oy + g.h) < 56) g.grab = { dx: g.ox + g.w - x, dy: g.oy + g.h - y }; },
  move(g, x, y) { if (!g.grab || g.result) return; g.w = clamp(x + g.grab.dx - g.ox, 120, W - g.ox); g.h = clamp(y + g.grab.dy - g.oy, 90, H - g.oy); },
  up(g) { if (!g.grab || g.result) return; g.grab = null; if (this.fits(g)) { g.w = g.tw; g.h = g.th; g.sfx('good'); g.win(); } },
  draw(g, c) {
    const fit = this.fits(g);
    c.strokeStyle = fit ? '#4cff6a' : '#fff'; c.lineWidth = 4; c.setLineDash([12, 8]); c.lineDashOffset = -g.t * 30;
    c.strokeRect(g.ox, g.oy, g.tw, g.th); c.setLineDash([]);
    const L = winLayout(g.ox, g.oy, g.w, g.h, 34, 'mmx');
    drawWin(c, L, 'dog.bmp - Paint', { icon: 'paint', bodyColor: '#fff' });
    // the picture: a dog, roughly
    const b = L.body; c.save(); c.beginPath(); c.rect(b.x, b.y, b.w, b.h); c.clip();
    c.fillStyle = '#c8e8ff'; c.fillRect(b.x, b.y, b.w, b.h);
    c.fillStyle = '#6cc23a'; c.fillRect(b.x, b.y + b.h * .7, b.w, b.h);
    const dx = b.x + b.w * .5, dy = b.y + b.h * .62, k = Math.min(b.w, b.h) / 200;
    c.fillStyle = '#a0682a'; c.beginPath(); c.ellipse(dx, dy, 60 * k, 34 * k, 0, 0, 7); c.fill();
    c.beginPath(); c.arc(dx + 58 * k, dy - 30 * k, 26 * k, 0, 7); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(dx + 66 * k, dy - 36 * k, 4 * k, 0, 7); c.fill();
    c.restore();
    // the grip
    const gx = g.ox + g.w, gy = g.oy + g.h;
    c.fillStyle = '#ffe600'; c.strokeStyle = '#111'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 34, gy); c.lineTo(gx, gy - 34); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#111'; c.lineWidth = 2; for (let i = 1; i <= 3; i++) { c.beginPath(); c.moveTo(gx - i * 8, gy - 3); c.lineTo(gx - 3, gy - i * 8); c.stroke(); }
  },
  bot: g => ({ drag: [[g.ox + g.w - 8, g.oy + g.h - 8], [g.ox + g.tw - 8, g.oy + g.th - 8]] }),
});

// 18. NEXT: click through the installer as it runs from you. Don't hit Cancel.
const PAGES = ['Welcome to Setup.', 'Choose where to install. (It does not matter.)', 'Install the Meadow Toolbar too? Yes. (You cannot say no.)', 'Copying files you will never open...', 'Almost done. Really this time.'];
def({
  id: 'next', word: 'NEXT!', name: 'setup.exe', icon: 'setup', art: 'chrome',
  init(g) { g.k = 0; g.K = 3 + Math.min(g.d, 2); this.place(g); },
  place(g) {
    const w = 330, h = 210;
    g.L = winLayout(g.ri(4, W - w - 4), g.ri(4, H - h - 4), w, h, 34, 'x');
    const b = g.L.body, y = b.y + b.h - 50;
    const names = g.d >= 1 && g.rnd() < .5 ? ['< Back', 'Cancel', 'Next >'] : ['< Back', 'Next >', 'Cancel'];
    g.bt = names.map((n, i) => ({ x: b.x + b.w - 3 * 100 - 6 + i * 100, y, w: 94, h: 38, name: n }));
    g.born = g.t;
  },
  down(g, x, y) {
    if (g.result) return;
    const bt = g.bt.find(r => inR(x, y, r, 3));
    if (!bt) return;
    if (bt.name === 'Cancel') { g.sfx('bad'); g.lose(); return; }
    if (bt.name === '< Back') { g.sfx('click'); g.k = Math.max(0, g.k - 1); this.place(g); return; }
    g.k++; g.sfx(g.k >= g.K ? 'win' : 'click');
    if (g.k >= g.K) g.win(); else this.place(g);
  },
  draw(g, c) {
    const a = ease((g.t - g.born) / .1);
    c.save(); c.globalAlpha = .4 + .6 * a;
    drawWin(c, g.L, `Setup - Step ${Math.min(g.k + 1, g.K)} of ${g.K}`, { icon: 'setup' });
    const b = g.L.body;
    const sg = c.createLinearGradient(b.x, 0, b.x + 70, 0); sg.addColorStop(0, '#1d5ed8'); sg.addColorStop(1, '#6fb0ff');
    c.fillStyle = sg; c.fillRect(b.x, b.y, 70, b.h - 62);
    icon(c, 'setup', b.x + 35, b.y + 50, 46);
    para(c, g.result === 'win' ? 'Setup is complete!' : PAGES[g.k % PAGES.length], b.x + 84, b.y + 16, b.w - 98, 17, 1.3);
    c.fillStyle = C.line; c.fillRect(b.x, b.y + b.h - 62, b.w, 1);
    g.bt.forEach(r => button(c, r, r.name, { def: r.name === 'Next >', bold: r.name === 'Next >' }));
    c.restore();
  },
  bot(g) { const r = g.bt.find(r => r.name === 'Next >'); return { tap: [cx(r), cy(r)] }; },
});

// 19. FIND: tap the icon that matches.
const FINDABLE = ['folder', 'doc', 'bin', 'pc', 'globe', 'mail', 'cookie', 'music', 'printer', 'floppy', 'setup', 'cd', 'image', 'game', 'calc', 'clock', 'key', 'paint', 'speaker', 'bug'];
def({
  id: 'find', word: 'FIND IT!', name: 'search.exe', icon: 'globe', art: 'rainbow',
  init(g) {
    g.n = g.d >= 1 ? 4 : 3;
    const types = g.shuffle(FINDABLE.slice()).slice(0, g.n * g.n);
    g.target = types[0]; g.types = g.shuffle(types);
    g.L = winLayout(6, 6, 468, 468, 34, 'x');
    const b = g.L.body, top = b.y + 80, cs = Math.min((b.w - 20) / g.n, (b.h - 92) / g.n);
    g.cells = g.types.map((t, i) => ({ x: b.x + (b.w - cs * g.n) / 2 + (i % g.n) * cs, y: top + Math.floor(i / g.n) * cs, w: cs - 6, h: cs - 6, t }));
  },
  down(g, x, y) {
    if (g.result) return;
    const r = g.cells.find(r => inR(x, y, r, 2));
    if (!r) return;
    g.picked = r;
    if (r.t === g.target) { g.sfx('good'); g.win(); } else { g.sfx('bad'); g.lose(); }
  },
  draw(g, c) {
    drawWin(c, g.L, 'Search Results', { icon: 'globe' });
    const b = g.L.body;
    c.fillStyle = '#fff'; c.fillRect(b.x + 10, b.y + 10, b.w - 20, 60); c.strokeStyle = '#7f9db9'; c.strokeRect(b.x + 10.5, b.y + 10.5, b.w - 21, 59);
    font(c, 20, 'bold'); c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('Find this one:', b.x + 24, b.y + 40);
    icon(c, g.target, b.x + 230, b.y + 40, 48);
    g.cells.forEach(r => {
      const hit = g.picked === r;
      rr(c, r.x, r.y, r.w, r.h, 6); c.fillStyle = hit ? (g.result === 'win' ? '#c8f7b0' : '#ffc4b8') : '#fff'; c.fill(); c.strokeStyle = '#c9c7ba'; c.lineWidth = 1; c.stroke();
      icon(c, r.t, cx(r), cy(r), r.w * .62);
    });
  },
  bot(g) { const r = g.cells.find(r => r.t === g.target); return { tap: [cx(r), cy(r)] }; },
});

// 20. DELETE SPAM: tap the junk, leave the real mail.
const SPAM = [['WINNER DEPT', 'U HAVE WON!!! CLAIM NOW'], ['Ink4Less', 'CHEAP INK cheap ink CHEAP'], ['Prize Zone', 're: re: ur FREE prize!!!'], ['$$$ FAST', 'Make $$$ from your sofa'], ['Smiley Club', 'FREE SMILEYS 4 U :) :) :)'], ['Lucky Draw', 'Final notice!!! Open me!!!'], ['Dr. Upgrade', 'YOUR PC IS SLOW. FIX NOW']];
const REAL = [['Mom', 'Dinner on Sunday?'], ['Grandpa', 'Photos from the lake'], ['Ms. Patel', 'Science fair reminder'], ['Sam', 'did u get my CD back'], ['Coach Rivera', 'Practice moved to 4pm'], ['Aunt Jo', 'Happy birthday sweetie'], ['Library', 'Your book is due']];
def({
  id: 'spam', word: 'DELETE SPAM!', name: 'mail.exe', icon: 'mail', art: 'grape',
  init(g) {
    g.L = winLayout(8, 18, 464, 444, 34, 'mmx');
    const n = g.d >= 2 ? 6 : 5, ns = g.d >= 1 ? 3 : 2;
    const rows = g.shuffle([...g.shuffle(SPAM.slice()).slice(0, ns).map(m => ({ m, spam: true })), ...g.shuffle(REAL.slice()).slice(0, n - ns).map(m => ({ m, spam: false }))]);
    const b = g.L.body;
    g.rows = rows.map((r, i) => ({ ...r, x: b.x + 4, y: b.y + 34 + i * 62, w: b.w - 8, h: 58, gone: null }));
    g.left = ns;
  },
  down(g, x, y) {
    if (g.result) return;
    const r = g.rows.find(r => r.gone == null && inR(x, y, r));
    if (!r) return;
    if (r.spam) { r.gone = g.t; g.left--; g.sfx('close'); if (g.left === 0) g.win(); }
    else { g.oops = r; g.sfx('bad'); g.lose(); }
  },
  draw(g, c) {
    drawWin(c, g.L, `Inbox (${g.rows.filter(r => r.gone == null).length})`, { icon: 'mail' });
    const b = g.L.body;
    c.fillStyle = '#fff'; c.fillRect(b.x, b.y + 30, b.w, b.h - 30);
    c.fillStyle = C.body; c.fillRect(b.x, b.y, b.w, 30);
    font(c, 14, 'bold'); c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('From', b.x + 52, b.y + 15); c.fillText('Subject', b.x + 182, b.y + 15);
    font(c, 13); c.fillStyle = C.grey; c.textAlign = 'right'; c.fillText('tap junk to delete', b.x + b.w - 10, b.y + 15);
    g.rows.forEach(r => {
      let x = r.x;
      if (r.gone != null) { const a = ease((g.t - r.gone) / .2); if (a >= 1) return; x += a * 480; c.globalAlpha = 1 - a; }
      c.fillStyle = g.oops === r ? '#ffc4b8' : (r.spam ? '#fff' : '#fff'); c.fillRect(x, r.y, r.w, r.h - 2);
      c.fillStyle = '#e5e3d8'; c.fillRect(x, r.y + r.h - 2, r.w, 1);
      icon(c, 'mail', x + 26, r.y + r.h / 2, 30);
      font(c, 15, 'bold'); c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(fitText(c, r.m[0], 122), x + 50, r.y + r.h / 2);
      font(c, 15); c.fillText(fitText(c, r.m[1], r.w - 186), x + 178, r.y + r.h / 2);
      c.globalAlpha = 1;
    });
  },
  bot(g) { const r = g.rows.find(r => r.spam && r.gone == null); return r ? { tap: [r.x + 200, r.y + 29] } : null; },
});

// 21. MAXIMIZE: hit the middle button of a drifting window. Not the X.
def({
  id: 'maximize', word: 'MAXIMIZE!', name: 'tiny.exe', icon: 'pc', art: 'lime',
  init(g) {
    g.w = 250; g.h = 170; g.x = g.ri(10, W - 260); g.y = g.ri(10, H - 180);
    const s = 60 + 35 * Math.min(g.d, 4), a = g.rnd() * 6.28;
    g.vx = Math.cos(a) * s; g.vy = Math.sin(a) * s; g.big = null;
  },
  L(g) { return winLayout(g.x, g.y, g.w, g.h, 46, 'mmx'); },
  tick(g, dt) {
    if (g.result) return;
    g.x += g.vx * dt; g.y += g.vy * dt;
    if (g.x < 2 || g.x > W - g.w - 2) { g.vx *= -1; g.x = clamp(g.x, 2, W - g.w - 2); }
    if (g.y < 2 || g.y > H - g.h - 2) { g.vy *= -1; g.y = clamp(g.y, 2, H - g.h - 2); }
  },
  down(g, x, y) {
    if (g.result) return;
    const L = this.L(g);
    if (inR(x, y, L.max, 5)) { g.big = { t: g.t, x: g.x, y: g.y }; g.sfx('good'); g.win(); }
    else if (inR(x, y, L.close, 3) || inR(x, y, L.min, 3)) { g.sfx('bad'); g.lose(); g.oops = inR(x, y, L.close, 3) ? 'x' : 'min'; }
  },
  draw(g, c) {
    let L = this.L(g);
    if (g.big) { const a = ease((g.t - g.big.t) / .2); L = winLayout(g.big.x * (1 - a), g.big.y * (1 - a), g.w + (W - g.w) * a, g.h + (H - g.h) * a, 46, 'mmx'); }
    if (g.oops === 'x' || g.oops === 'min') { c.globalAlpha = .35; }
    drawWin(c, L, 'Tiny Window', { icon: 'pc', hot: 'max' });
    c.globalAlpha = 1;
    const b = L.body;
    para(c, g.big ? 'Ahh, much better. Room to breathe.' : 'It is cramped in here. Please make me bigger.', b.x + 12, b.y + 12, b.w - 24, 16, 1.3);
  },
  bot(g) { const L = this.L(g); return { tap: [cx(L.max) + g.vx * .05, cy(L.max) + g.vy * .05] }; },
});

// 22. DOWNLOAD: catch the files in the folder, dodge the bugs.
def({
  id: 'download', word: 'DOWNLOAD!', name: 'download.exe', icon: 'floppy', art: 'chrome', dur: 5,
  init(g) {
    g.need = 3 + (g.d >= 2 ? 1 : 0); g.got = 0; g.bxp = 240; g.items = [];
    g.vy = 190 + 20 * Math.min(g.d, 3);
    const span = g.dur * .72;
    const n = g.need + 2;
    for (let i = 0; i < n; i++) g.items.push({ t: .15 + i * span / n, x: g.ri(50, W - 50), kind: g.pick(['doc', 'image', 'music']), y: -30, state: 0 });
    const bugs = Math.min(g.d, 2);
    for (let i = 0; i < bugs; i++) g.items.push({ t: .5 + (i + .5) * span / (bugs + 1), x: g.ri(50, W - 50), kind: 'bug', y: -30, state: 0 });
    g.ow = 50;
  },
  tick(g, dt) {
    for (const it of g.items) {
      if (it.state || g.t < it.t) continue;
      it.y = -30 + (g.t - it.t) * g.vy;
      if (!g.result && it.y > 400 && it.y < 440 && Math.abs(it.x - g.bxp) < g.ow + 6) {
        it.state = 1;
        if (it.kind === 'bug') { g.sfx('bad'); g.lose(); g.bitten = true; }
        else { g.got++; g.sfx('good'); g.burst(it.x, 410, ['#fff', '#4cff6a'], 8, 150); if (g.got >= g.need) g.win(); }
      }
      if (it.y > H + 40) it.state = 2;
    }
  },
  down(g, x) { if (!g.result) g.bxp = clamp(x, 50, W - 50); },
  move(g, x) { if (!g.result) g.bxp = clamp(x, 50, W - 50); },
  draw(g, c) {
    const L = winLayout(70, 10, 340, 96, 34, '');
    drawWin(c, L, 'Downloading...', { icon: 'globe' });
    progress(c, L.body.x + 12, L.body.y + 12, L.body.w - 24, 20, g.got / g.need);
    font(c, 14); c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillText(`${g.got} of ${g.need} files caught${g.d >= 1 ? '  ·  avoid bugs!' : ''}`, L.body.x + 12, L.body.y + 38);
    for (const it of g.items) if (!it.state && g.t >= it.t) icon(c, it.kind, it.x, it.y, 50);
    icon(c, 'folder', g.bxp, 430, 110);
    if (g.bitten) { icon(c, 'err', g.bxp, 360, 60); }
  },
  bot(g) {
    const live = g.items.filter(it => !it.state && g.t >= it.t - .3 && it.y < 420);
    const file = live.filter(i => i.kind !== 'bug').sort((a, b) => b.y - a.y)[0];
    let tx = file ? file.x : g.bxp;
    const bug = live.find(i => i.kind === 'bug' && i.y > 250 && Math.abs(i.x - tx) < 70);
    if (bug) tx = bug.x > 240 ? bug.x - 140 : bug.x + 140;
    return { drag: [[g.bxp, 450], [clamp(tx, 50, W - 50), 450]], speed: 1400 };
  },
});

// ------------------------------------------------------------------ bosses
export const BOSSES = [];
const boss = o => (BOSSES.push(o), o.boss = true, o);

boss({
  id: 'virus', word: 'VIRUS ALERT!', name: 'antivirus.exe', icon: 'bug', art: 'rainbow', dur: 15,
  init(g) {
    g.hp = g.max = 6 + 2 * Math.min(g.d, 3); g.vxp = 240; g.vyp = 260; g.to = [240, 260];
    g.pops = []; g.spawn = 1.2; g.every = Math.max(.9, 1.6 - .2 * g.d); g.wob = 0; g.dead = null;
    g.L = winLayout(60, 4, 360, 80, 30, '');
  },
  tick(g, dt) {
    if (g.dead != null) return;
    const [tx, ty] = g.to;
    const d = dist(tx, ty, g.vxp, g.vyp), sp = (200 + 25 * g.d) * dt;
    if (d < sp) g.to = [g.ri(60, W - 60), g.ri(140, H - 60)];
    else { g.vxp += (tx - g.vxp) / d * sp; g.vyp += (ty - g.vyp) / d * sp; }
    g.wob = Math.max(0, g.wob - dt * 4);
    if ((g.spawn -= dt) < 0 && !g.result) { g.spawn = g.every; if (g.pops.length < 6) spawnPop(g, g.pops, { y: g.ri(90, H - 190) }); }
  },
  down(g, x, y) {
    if (g.result) return;
    const i = topPopAt(g.pops, x, y);
    if (i >= 0) { if (inR(x, y, g.pops[i].L.close, 8)) { g.pops.splice(i, 1); g.sfx('close'); } return; }
    if (dist(x, y, g.vxp, g.vyp) < 52) {
      g.hp--; g.wob = 1; g.sfx('hit'); g.burst(g.vxp, g.vyp, ['#9df05a', '#fff', '#2f8a1a'], 12, 240);
      g.to = [g.ri(60, W - 60), g.ri(140, H - 60)];
      if (g.hp <= 0) { g.dead = g.t; g.sfx('win'); g.win(); g.burst(g.vxp, g.vyp, ['#9df05a', '#ffe600', '#fff'], 40, 400); }
    }
  },
  draw(g, c) {
    if (g.dead == null) {
      c.save(); c.translate(g.vxp, g.vyp); c.rotate(Math.sin(g.t * 10) * .15 + g.wob * Math.sin(g.t * 50) * .5);
      icon(c, 'bug', 0, 0, 104 * (1 + g.wob * .2));
      c.restore();
    }
    drawPops(c, g, g.pops);
    drawWin(c, g.L, 'Virus Scan', { icon: 'bug' });
    const b = g.L.body;
    font(c, 14, 'bold'); c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('Threat', b.x + 10, b.y + 22);
    progress(c, b.x + 64, b.y + 10, b.w - 76, 24, g.hp / g.max, { color: ['#ffc4b8', '#e2412b', '#a8200e'] });
  },
  bot(g) {
    const cover = topPopAt(g.pops, g.vxp, g.vyp);
    if (cover >= 0) { const r = g.pops[cover].L.close; return { tap: [cx(r), cy(r)] }; }
    const [tx, ty] = g.to, d = dist(tx, ty, g.vxp, g.vyp) || 1, s = (200 + 25 * g.d) * .05;
    return { tap: [g.vxp + (tx - g.vxp) / d * s, g.vyp + (ty - g.vyp) / d * s] };
  },
});

boss({
  id: 'storm', word: 'POP-UP STORM!', name: 'storm.exe', icon: 'popup', art: 'grape', dur: 13,
  init(g) {
    g.total = 13 + 3 * Math.min(g.d, 3); g.made = 0; g.pops = []; g.limit = 6;
    g.times = []; const span = g.dur - 3;
    for (let i = 0; i < g.total; i++) g.times.push(span * Math.pow((i + .5) / g.total, .8));
    g.L = winLayout(100, H - 74, 280, 70, 28, '');
  },
  tick(g) {
    if (g.result) return;
    while (g.made < g.total && g.t >= g.times[g.made]) { g.made++; spawnPop(g, g.pops, { y: g.ri(4, H - 270) }); }
    if (g.pops.length >= g.limit) { g.sfx('bad'); g.lose(); }
    else if (g.made >= g.total && !g.pops.length) { g.sfx('win'); g.win(); }
  },
  down(g, x, y) {
    if (g.result) return;
    const i = topPopAt(g.pops, x, y);
    if (i >= 0 && inR(x, y, g.pops[i].L.close, 8)) { const p = g.pops.splice(i, 1)[0]; g.sfx('close'); g.burst(cx(p.L.close), cy(p.L.close), ['#fff', '#e2412b'], 6, 140); }
  },
  draw(g, c) {
    drawPops(c, g, g.pops);
    drawWin(c, g.L, 'System Resources', { icon: 'pc' });
    const b = g.L.body, f = g.pops.length / g.limit;
    progress(c, b.x + 10, b.y + 8, b.w - 20, 22, f, { color: f > .6 ? ['#ffc4b8', '#e2412b', '#a8200e'] : undefined });
    if (g.result === 'lose') { font(c, 26, 'bold'); c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.lineWidth = 5; c.textAlign = 'center'; c.strokeText('Out of memory!', 240, 240); c.fillText('Out of memory!', 240, 240); }
  },
  bot(g) { if (!g.pops.length) return null; const r = g.pops[g.pops.length - 1].L.close; return { tap: [cx(r), cy(r)] }; },
});

export const ALL = [...GAMES, ...BOSSES];
export const byId = id => ALL.find(d => d.id === id);
