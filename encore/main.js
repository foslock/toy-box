// Encore: the light-up floor, the rack, the marquee signs, input and the tutorial.
import { Game, W as GW, H as GH, PH, INST, PICKS, FOE, FLOORS, WIN } from './game.js';
import { text, block, blockH, textW, dotWidth, fitPitch, LINE } from './font.js';
import { draw as spr } from './sprites.js';
import { choose } from './bot.js';
import * as mu from './music.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), AUTO = Q.has('autoplay'), DEBUG = Q.has('debug') || AUTO;
const TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const cv = document.getElementById('cv'), c = cv.getContext('2d');

const AMBER = '#ffb43a', DIM = '#2e1d10', RED = '#ff4a3a', HOT = '#fff1c9', BG = '#120c0e', DEEP = '#0b0709';
const FLOORCOL = ['#e8402f', '#f28c28', '#f5d33f', '#4fbf5a', '#3f7fe0'];
const RACK = ['kick', ...PICKS];

// ------------------------------------------------------------ save
const KEY = 'encore.v1';
const save = { best: 0, tut: false, wins: 0 };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} };

// ------------------------------------------------------------ layout
let VW = 0, VH = 0, dpr = 1, sa = { t: 0, r: 0, b: 0, l: 0 }, Lo = null, bgImg = null, tiles = null;
function layout() {
  VW = innerWidth; VH = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr);
  const cs = getComputedStyle(document.getElementById('safe'));
  sa = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  const side = VW > VH * 1.05;
  const L = { side };
  if (side) {
    const top = sa.t + 12, bot = VH - sa.b - 10;
    const beatH = Math.max(34, Math.min(56, (bot - top) * .08));
    let ts = Math.floor(Math.min((bot - top - beatH - 14) / (GH + .7), (VW - sa.l - sa.r - 2 * 210) / (GW + .7)));
    ts = Math.max(18, ts);
    const gw = ts * GW, gh = ts * GH;
    const gx = Math.round((VW - gw) / 2), gy = Math.round(top + ts * .35 + Math.max(0, (bot - top - beatH - 14 - gh - ts * .7) / 2));
    L.ts = ts; L.gx = gx; L.gy = gy; L.gw = gw; L.gh = gh;
    L.beat = { x: gx - ts * .35, y: gy + gh + ts * .35 + 8, w: gw + ts * .7, h: beatH };
    const lpx = sa.l + 14, lpw = gx - ts * .35 - 18 - lpx, rpx = gx + gw + ts * .35 + 18, rpw = VW - sa.r - 14 - rpx;
    L.hud = { x: Math.max(lpx, 62), y: top + 2, w: gx - ts * .35 - 18 - Math.max(lpx, 62) };
    L.cap = { x: lpx, y: top + 70, w: lpw };
    L.rack = { x: rpx, y: Math.max(gy, top + 50), w: rpw - (gy < top + 50 ? 0 : 0) };
    L.btn = { x: VW - sa.r - 50, y: top };
  } else {
    const top = sa.t + 10, bot = VH - sa.b - 10;
    const capH = 92, beatH = 40, rackH = 5 * 17 + 6;
    let ts = Math.floor(Math.min((VW - sa.l - sa.r - 24) / (GW + .7), (bot - top - 48 - capH - beatH - rackH - 26) / (GH + .7)));
    ts = Math.max(16, ts);
    const gw = ts * GW, gh = ts * GH;
    const slack = Math.max(0, bot - top - 48 - capH - beatH - rackH - 26 - gh - ts * .7);
    const gx = Math.round((VW - gw) / 2), gy = Math.round(top + 48 + capH + ts * .35 + slack * .35);
    L.ts = ts; L.gx = gx; L.gy = gy; L.gw = gw; L.gh = gh;
    L.hud = { x: 62, y: top + 4, w: VW - sa.r - 62 - 56 };
    L.cap = { x: gx - ts * .35, y: top + 48 + slack * .2, w: gw + ts * .7, h: capH };
    L.beat = { x: gx - ts * .35, y: gy + gh + ts * .35 + 8, w: gw + ts * .7, h: beatH };
    L.rack = { x: gx - ts * .35, y: L.beat.y + beatH + 8, w: gw + ts * .7 };
    L.btn = { x: VW - sa.r - 50, y: top };
  }
  Lo = L;
  bgImg = makeBg(); tiles = makeTiles(L.ts);
}
addEventListener('resize', layout);

function makeBg() {
  const b = document.createElement('canvas'); b.width = cv.width; b.height = cv.height;
  const x = b.getContext('2d'); x.scale(dpr, dpr);
  x.fillStyle = BG; x.fillRect(0, 0, VW, VH);
  // the unlit pegboard of a giant LED wall
  x.fillStyle = '#1b1215';
  for (let yy = 4; yy < VH; yy += 8) for (let xx = (yy / 8) % 2 ? 4 : 8; xx < VW; xx += 8) { x.beginPath(); x.arc(xx, yy, 1.3, 0, 6.3); x.fill(); }
  const g = x.createRadialGradient(VW / 2, VH * .45, 10, VW / 2, VH * .45, Math.max(VW, VH) * .75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)');
  x.fillStyle = g; x.fillRect(0, 0, VW, VH);
  return b;
}
function shade(hex, k) { // k<0 darker toward DEEP, k>0 lighter toward white
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = k < 0 ? [20, 13, 16] : [255, 250, 235], a = Math.abs(k);
  return `rgb(${Math.round(r + (t[0] - r) * a)},${Math.round(g + (t[1] - g) * a)},${Math.round(b + (t[2] - b) * a)})`;
}
function rr(ctx, X, Y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(X, Y, w, h, r) : ctx.rect(X, Y, w, h); }
function makeTiles(ts) {
  const mk = (col, lit) => {
    const b = document.createElement('canvas'); b.width = b.height = Math.ceil(ts * dpr);
    const x = b.getContext('2d'); x.scale(dpr, dpr);
    const i = Math.max(1, ts * .045), s = ts - 2 * i;
    rr(x, i, i, s, s, ts * .1);
    if (lit) {
      const g = x.createRadialGradient(ts / 2, ts / 2, ts * .05, ts / 2, ts / 2, ts * .7);
      g.addColorStop(0, shade(col, .75)); g.addColorStop(.35, shade(col, .15)); g.addColorStop(1, shade(col, -.35));
      x.fillStyle = g;
    } else x.fillStyle = shade(col, -.86);
    x.fill();
    x.save(); x.clip();
    x.strokeStyle = lit ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.035)'; x.lineWidth = 1;
    for (let k = -ts; k < ts * 2; k += ts / 5) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + ts, ts); x.stroke(); }
    x.restore();
    x.strokeStyle = lit ? shade(col, .5) : shade(col, -.7); x.lineWidth = Math.max(1, ts * .03);
    rr(x, i, i, s, s, ts * .1); x.stroke();
    return b;
  };
  return { off: FLOORCOL.map(cl => mk(cl, false)), on: FLOORCOL.map(cl => mk(cl, true)) };
}

// ------------------------------------------------------------ state
const S = { mode: 'title', paused: false, t0: 0, g: null, fx: [], banner: null, shake: 0, over: null, tut: null, judge: null, trans: 0, lastBeat: -99, hold: false, kickPulse: -9 };
let hot = [];
const anim = new Map();      // entity id -> {fx, fy, tx, ty, t}

const songT = () => mu.now() - S.t0;
const L_ = () => S.g ? S.g.L : .6;

function layersFor(b) { return S.g && S.mode === 'play' ? [...S.g.parts()] : ['kick', 'bass']; }

function startSong() {
  S.t0 = mu.start(S.g.bpm, layersFor);
  S.lastBeat = -99;
}

function newRun(o = {}) {
  S.g = new Game({ seed: o.seed, lap: o.lap || 0, tutorial: !!o.tutorial });
  if (o.score) S.g.score = o.score;
  S.mode = 'play'; S.paused = false; S.fx = []; S.over = null; anim.clear();
  S.tut = o.tutorial ? makeTutorial() : null;
  if (S.tut) S.tut.enter(0);
  banner(o.tutorial ? 'SOUNDCHECK' : 'FLOOR 1', o.tutorial ? 'LEARN THE STEPS' : FLOORS[0].name, AMBER, 4);
  startSong();
}

function banner(big, small, col = AMBER, beats = 3) { if (DEMO) return; S.banner = { big, small, col, t: mu.now(), dur: beats * L_() + .6 }; }

// ------------------------------------------------------------ input
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
function move(dir, t) {
  const g = S.g;
  if (!g || S.mode !== 'play' || S.paused) return;
  const st = songT() - (mu.now() - t);
  const r = g.input(st, dir);
  if (r === 'miss') {
    const off = st - Math.round(st / g.L) * g.L;
    S.judge = { s: off < 0 ? 'EARLY' : 'LATE', t: mu.now(), bad: 1 };
  } else if (r === 'ok') {
    const off = st - Math.round(st / g.L) * g.L;
    S.judge = { s: Math.abs(off) < .06 ? 'PERFECT' : off < 0 ? 'A HAIR EARLY' : 'A HAIR LATE', t: mu.now() };
  }
  consume();
}
addEventListener('keydown', e => {
  if (e.repeat) { if (KEYS[e.key]) e.preventDefault(); return; }
  mu.unlock();
  if (KEYS[e.key] && S.mode === 'play' && !S.paused) { e.preventDefault(); move(KEYS[e.key], mu.evTime(e)); return; }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (S.mode === 'play') togglePause(); return; }
  if (e.key === 'm' || e.key === 'M') { mu.setMuted(!mu.isMuted()); return; }
  if (e.key === 'Enter' || e.key === ' ') {
    const b = hot.find(h => h.primary);
    if (b) { e.preventDefault(); mu.sfx('click'); b.fn(); }
  }
});
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  mu.unlock();
  const x = e.clientX, y = e.clientY;
  for (let i = hot.length - 1; i >= 0; i--) {
    const h = hot[i];
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) { mu.sfx('click'); h.fn(); return; }
  }
  if (S.mode === 'play' && !S.paused && S.g) {
    // tap above, below or beside your dancer
    const p = S.g.player, { px, py } = tileC(p.x, p.y);
    const dx = x - px, dy = y - py;
    if (Math.hypot(dx, dy) < Lo.ts * .35) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    move(dir, mu.evTime(e));
    S.tapAt = { x, y, dir, t: mu.now() };
  }
});
cv.addEventListener('contextmenu', e => e.preventDefault());
// touch only counts as a gesture for audio on the way up
for (const n of ['pointerup', 'touchend', 'click']) addEventListener(n, () => mu.unlock(), { passive: true });

function togglePause(force) {
  const want = force ?? !S.paused;
  if (want === S.paused) return;
  S.paused = want;
  if (want) mu.pause(); else mu.resume();
}
document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode === 'play' && !DEMO && !AUTO) togglePause(true); });

// ------------------------------------------------------------ events -> juice
function tileC(x, y) { return { px: Lo.gx + (x + .5) * Lo.ts, py: Lo.gy + (y + .5) * Lo.ts }; }
function burst(x, y, col, n = 10, sp = 1) {
  const { px, py } = tileC(x, y);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, v = (40 + Math.random() * 120) * sp;
    S.fx.push({ k: 'bit', x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: mu.now(), dur: .5 + Math.random() * .3, col });
  }
}
function float(x, y, s, col = AMBER) { const { px, py } = tileC(x, y); S.fx.push({ k: 'txt', x: px, y: py - Lo.ts * .6, s, col, t: mu.now(), dur: .9 }); }

function consume() {
  const g = S.g;
  if (!g) return;
  const ev = g.ev; g.ev = [];
  const now = mu.now();
  for (const e of ev) {
    switch (e.type) {
      case 'beat': break;
      case 'onbeat': S.kickPulse = now; break;
      case 'miss': mu.sfx('miss'); break;
      case 'bump': mu.sfx('bump'); S.shake = Math.max(S.shake, .15); break;
      case 'dash': mu.sfx('dash'); S.fx.push({ k: 'trail', x: g.player.x, y: g.player.y, t: now, dur: .25 }); break;
      case 'hit': mu.sfx('hit'); burst(e.x, e.y, HOT, 5, .6); break;
      case 'kill': {
        const boss = FOE[e.foe].boss;
        mu.sfx(boss ? 'boss' : 'kill');
        burst(e.x, e.y, boss ? '#ffc63d' : FLOORCOL[(e.x + e.y) % 5], boss ? 30 : 14, boss ? 1.6 : 1);
        if (e.pts) float(e.x, e.y, '+' + e.pts);
        if (boss) { S.shake = .4; banner(FOE[e.foe].name + ' IS OUT', 'NO MORE ' + FOE[e.foe].part, '#ffc63d', 3); }
        break;
      }
      case 'shove': mu.sfx('shove'); S.fx.push({ k: 'ring', x: e.x, y: e.y, t: now, dur: .35, col: INST.bass.col }); break;
      case 'zap': mu.sfx('zap'); S.fx.push({ k: 'beam', x: e.x, y: e.y, dx: e.dx, dy: e.dy, len: e.len, t: now, dur: .25, col: INST.lead.col }); break;
      case 'blast': mu.sfx('blast'); S.fx.push({ k: 'beam', x: e.x, y: e.y, dx: e.dx, dy: e.dy, len: e.len, t: now, dur: .3, col: RED, wide: 1 }); S.shake = Math.max(S.shake, .2); break;
      case 'halo': mu.sfx('halo'); break;
      case 'relic':
        mu.sfx('relic'); burst(e.x, e.y, INST[e.inst].col, 24, 1.2);
        if (!g.tutorial || S.tut?.i !== 3) banner('+ ' + INST[e.inst].name + '!', INST[e.inst].power + ': ' + INST[e.inst].say, INST[e.inst].col, 5);
        S.rackFlash = { inst: e.inst, t: now };
        if (!g.tutorial) setTimeout(() => S.g === g && banner('STAIRS OPEN', 'OR KEEP DANCING FOR POINTS', AMBER, 3), 2600);
        break;
      case 'regain': mu.sfx('pickup'); burst(e.x, e.y, INST[e.inst].col, 12); float(e.x, e.y, (e.tape ? 'TAPE: ' : '') + INST[e.inst].name + ' BACK', INST[e.inst].col); S.rackFlash = { inst: e.inst, t: now }; break;
      case 'tape': mu.sfx('pickup'); float(e.x, e.y, 'B-SIDE +' + 50 * g.mult); break;
      case 'fade': mu.sfx('lose'); banner(INST[e.inst].name + ' FADED', 'A DEMO TAPE CAN BRING IT BACK', RED, 3); break;
      case 'hurt': {
        S.shake = .45; S.hurtT = now;
        const p = g.player;
        if (e.tut) { mu.sfx('hurt'); float(p.x, p.y, 'OUCH!', RED); }
        else if (e.halo) { mu.sfx('halo'); float(p.x, p.y, 'HALO TOOK IT', INST.choir.col); burst(p.x, p.y, INST.choir.col, 16); }
        else if (e.lost) { mu.sfx('hurt'); banner('LOST THE ' + INST[e.lost].name, 'GRAB IT BEFORE IT FADES!', RED, 3); }
        else if (e.crack) { mu.sfx('hurt'); banner('KICK CRACKED', 'ONE MORE HIT AND THE MUSIC STOPS', RED, 3); }
        else if (e.dead) mu.sfx('dead');
        break;
      }
      case 'aim': break;
      case 'summon': burst(e.x, e.y, '#ff5bb0', 10); break;
      case 'down': mu.sfx('stairs'); break;
      case 'won': mu.sfx('cheer'); break;
    }
    S.tut?.ev(e);
  }
}

// ------------------------------------------------------------ flow per frame
function stepGame() {
  const g = S.g;
  if (!g || S.mode !== 'play' || S.paused) return;
  const t = songT();
  if ((AUTO || DEMO) && g.status === 'play') {
    // the bot steps a few ms after each beat
    const k = g.next, bt = g.beatTime(k);
    if (k >= 0 && t >= bt + .02 && t <= bt + WIN) { const a = choose(g, { slop: .08 }); if (a) g.input(bt + .02, a); }
  }
  g.update(t);
  consume();
  if (g.status === 'down' && !S.trans) {
    S.trans = mu.now();
    mu.stop();
  }
  if (S.trans && g.status === 'down' && mu.now() - S.trans > .9) {
    S.trans = 0;
    g.nextFloor(); anim.clear(); consume();
    banner('FLOOR ' + (g.fi + 1), g.floor.name + (g.floor.boss ? ': THE BAND' : ''), g.floor.boss ? '#ffc63d' : AMBER, 4);
    startSong();
  }
  if (g.status === 'tutdone' && !S.trans) {
    save.tut = true; store();
    S.trans = mu.now(); mu.stop();
    setTimeout(() => { S.trans = 0; newRun(); }, 900);
  }
  if ((g.status === 'dead' || g.status === 'won') && !S.over) {
    S.over = { t: mu.now(), won: g.status === 'won' };
    if (g.score > save.best) { save.best = g.score; S.over.newBest = 1; }
    if (S.over.won) save.wins++;
    store();
    if (S.over.won) setTimeout(() => S.over && mu.stop(), 2500); else mu.stop();
    if (DEMO) setTimeout(() => newDemo(), 400);
  }
}

// ------------------------------------------------------------ tutorial
function makeTutorial() {
  const T = { i: 0, n: 0, msg: '', sub: '' };
  const g = () => S.g;
  const near = (dx, dy) => {
    const p = g().player;
    const cands = [[p.x + dx, p.y + dy], [p.x + dx + 1, p.y + dy], [p.x + dx - 1, p.y + dy], [p.x, p.y - 3], [4, 2], [2, 4], [6, 4]];
    for (const [x, y] of cands) if (g().walkable(x, y) && !g().foeAt(x, y) && !g().itemAt(x, y) && !(x === p.x && y === p.y)) return { x, y };
    return { x: 4, y: 3 };
  };
  const how = TOUCH ? 'TAP ABOVE, BELOW OR BESIDE YOUR DANCER' : 'USE THE ARROW KEYS OR WASD';
  const steps = [
    { msg: 'THE FLOOR FLASHES ON EVERY BEAT. MOVE IN TIME WITH IT.', sub: how + '. MOVE 4 TIMES ON THE BEAT.', goal: 4 },
    { msg: 'THAT IS A PRACTICE DUMMY. BUMP INTO IT TO HIT IT.', sub: 'ONE HIT EACH, ON THE BEAT.', enter: () => { const t = near(0, -2); g().spawn('dummy', t.x, t.y); } },
    { msg: 'SNARELINGS STEP ON BEATS 2 AND 4. THE DOT ABOVE GOES RED JUST BEFORE THEY MOVE.', sub: 'HIT IT BEFORE IT HITS YOU.', enter: () => { g().spawn('snare', 4, 1); } },
    { msg: 'A RELIC! EACH ONE ADDS A PART TO THE SONG, AND EACH PART IS A POWER.', sub: 'GRAB IT.', enter: () => { const t = near(2, -2); g().items.push({ id: g().nid++, kind: 'relic', inst: 'bass', x: t.x, y: t.y }); } },
    { msg: 'BASS SHOVES EVERYTHING NEXT TO YOU ON BEAT 1 OF EACH BAR. THE RACK SHOWS WHICH BEATS EACH PART FIRES ON.', sub: 'SHAKERS JITTER EVERY BEAT. CLEAR THEM BOTH.', enter: () => { g().spawn('shaker', 2, 3); g().spawn('shaker', 6, 3); } },
    { msg: 'A HIT KNOCKS YOUR NEWEST PART LOOSE, LIKE THAT. GRAB IT BACK BEFORE IT FADES.', sub: 'GO GET THE BASS.', enter: () => {
      const G = g(), p = G.player; G.player.inst = G.player.inst.filter(i => i !== 'bass');
      const t = near(-2, -1); G.items.push({ id: G.nid++, kind: 'lost', inst: 'bass', x: t.x, y: t.y, until: 1e9 });
      S.shake = .4; mu.sfx('hurt'); banner('LOST THE BASS', 'GRAB IT BEFORE IT FADES!', RED, 3);
    } },
    { msg: 'KICK IS YOUR LAST PART. IT CAN CRACK ONCE; THE NEXT HIT STOPS THE MUSIC.', sub: 'THE STAIRS ARE OPEN. THE SET STARTS DOWNSTAIRS.', enter: () => { g().stairs.open = true; } },
  ];
  T.enter = i => {
    T.i = i; T.n = 0; const s = steps[i]; T.msg = s.msg; T.sub = s.sub; T.t = mu.now();
    s.enter?.();
  };
  T.done = () => { if (T.i < steps.length - 1) { mu.sfx('pickup'); T.enter(T.i + 1); } };
  T.ev = e => {
    if (!S.g?.tutorial) return;
    const s = steps[T.i];
    if (T.i === 0 && e.type === 'onbeat') { T.n++; if (T.n >= s.goal) T.done(); }
    if (T.i === 1 && e.type === 'kill') T.done();
    if (T.i === 2 && e.type === 'kill') T.done();
    if (T.i === 2 && e.type === 'hurt') T.sub = 'OUCH. IN THE REAL SET THAT COSTS YOU. HIT IT FIRST!';
    if (T.i === 3 && e.type === 'relic') T.done();
    if (T.i === 4 && e.type === 'kill' && !S.g.foes.some(f => f.hp > 0)) T.done();
    if (T.i === 5 && e.type === 'regain') T.done();
    if (e.type === 'miss' && T.i === 0) T.sub = 'OFF THE BEAT! WAIT FOR THE FLASH, THEN MOVE.';
  };
  T.progress = () => T.i === 0 ? T.n + '/4' : '';
  return T;
}

// ------------------------------------------------------------ drawing helpers
function bulbs(x, y, w, h, gap, phase, col = AMBER) {
  const per = 2 * (w + h), n = Math.max(8, Math.round(per / gap)), step = per / n;
  for (let i = 0; i < n; i++) {
    let d = i * step, bx, by;
    if (d < w) { bx = x + d; by = y; } else if ((d -= w) < h) { bx = x + w; by = y + d; }
    else if ((d -= h) < w) { bx = x + w - d; by = y + h; } else { d -= w; bx = x; by = y + h - d; }
    const on = ((i + Math.floor(phase)) % 3) === 0;
    c.fillStyle = on ? HOT : '#4a3018';
    if (on) { c.save(); c.shadowColor = col; c.shadowBlur = 8; }
    c.beginPath(); c.arc(bx, by, Math.max(1.6, gap * .2), 0, 6.3); c.fill();
    if (on) c.restore();
  }
}
// a marquee sign button
function button(label, x, y, w, h, fn, o = {}) {
  hot.push({ x, y, w, h, fn, primary: o.primary });
  c.fillStyle = o.primary ? '#2a160c' : '#1c1215';
  rr(c, x, y, w, h, 8); c.fill();
  c.strokeStyle = o.primary ? '#6a3a14' : '#3a2410'; c.lineWidth = 2; c.stroke();
  bulbs(x + 5, y + 5, w - 10, h - 10, 11, beatPhase() * (o.primary ? 2 : 1), o.col || AMBER);
  const p = Math.min(o.p || 3, fitPitch(label, w - 26, o.p || 3));
  text(c, label, x + w / 2, y + h / 2 - 3.5 * p, p, o.col || AMBER, { align: 'center', dim: DIM, glow: o.primary ? AMBER : null });
}
function panel(x, y, w, h) {
  c.fillStyle = 'rgba(14,9,11,.94)';
  rr(c, x, y, w, h, 10); c.fill();
  c.strokeStyle = '#3a2410'; c.lineWidth = 2; c.stroke();
  bulbs(x + 6, y + 6, w - 12, h - 12, 13, beatPhase());
}
function beatPhase() { // beat count, continuous
  if (S.g && S.mode === 'play') return songT() / S.g.L;
  return performance.now() / 600;
}
function pulse() { // 1 on the beat, decaying
  const b = beatPhase(), f = b - Math.floor(b);
  return Math.exp(-f * (S.g ? S.g.L : .6) / .16);
}

// ------------------------------------------------------------ the floor
function drawFloor() {
  const g = S.g, { ts, gx, gy, gw, gh } = Lo;
  const b = beatPhase(), kb = Math.floor(b), pu = pulse();
  const mult = g ? g.mult : 1, dead = g && g.status === 'dead';
  const base = dead ? 0 : [.1, .28, .42, .58][mult - 1];
  // the stage frame
  const fr = ts * .35;
  c.fillStyle = '#1a1013'; rr(c, gx - fr, gy - fr, gw + fr * 2, gh + fr * 2, ts * .2); c.fill();
  c.strokeStyle = '#3a2410'; c.lineWidth = 2; c.stroke();
  bulbs(gx - fr / 2, gy - fr / 2, gw + fr, gh + fr, ts * .5, b * 2);
  const fi = g ? g.fi : 0;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const ci = (x * 2 + y * 3 + fi) % 5, X = gx + x * ts, Y = gy + y * ts;
    c.drawImage(tiles.off[ci], X, Y, ts, ts);
    const on = (x + y + kb) % 2 === 0;
    const a = dead ? 0 : on ? base + (1 - base) * pu * (b < 0 ? .5 : 1) : base * .35;
    if (a > .02) { c.globalAlpha = Math.min(1, a); c.drawImage(tiles.on[ci], X, Y, ts, ts); c.globalAlpha = 1; }
  }
}

function lerpPos(id, x, y, now, hopK = .22) {
  let a = anim.get(id);
  if (!a) { a = { fx: x, fy: y, tx: x, ty: y, t: -9 }; anim.set(id, a); }
  if (a.tx !== x || a.ty !== y) {
    const u = Math.min(1, (now - a.t) / .1);
    a.fx = a.fx + (a.tx - a.fx) * u; a.fy = a.fy + (a.ty - a.fy) * u;
    a.tx = x; a.ty = y; a.t = now;
  }
  const u = Math.min(1, (now - a.t) / .1), e = 1 - (1 - u) * (1 - u);
  const cx = a.fx + (a.tx - a.fx) * e, cy = a.fy + (a.ty - a.fy) * e;
  const hop = Math.sin(u * Math.PI) * hopK * (Math.hypot(a.tx - a.fx, a.ty - a.fy) > .01 ? 1 : 0);
  return { x: cx, y: cy, hop };
}

function drawThings() {
  const g = S.g, { ts, gx, gy } = Lo, now = mu.now(), pu = pulse();
  const sq = 1 - .09 * pu, st = 1 + .07 * pu;
  // speakers
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (g.blocks[y * GW + x]) {
    const X = gx + (x + .5) * ts, Y = gy + (y + 1) * ts - ts * .04;
    spr(c, 'speaker', X, Y, ts * .96, { sx: 1 + .04 * pu, sy: 1 + .04 * pu });
  }
  // stairs
  {
    const s = g.stairs, X = gx + s.x * ts, Y = gy + s.y * ts, i = ts * .1;
    c.fillStyle = DEEP; rr(c, X + i, Y + i, ts - 2 * i, ts - 2 * i, ts * .08); c.fill();
    for (let k = 0; k < 4; k++) { c.fillStyle = s.open ? shade('#ffb43a', -.3 - k * .15) : '#2a1d20'; c.fillRect(X + i * 1.6, Y + i * 1.6 + k * (ts - i * 3.2) / 4, ts - i * 3.2 - k * ts * .12, (ts - i * 3.2) / 4 - 2); }
    if (s.open) {
      const bl = Math.floor(beatPhase() * 2) % 2;
      text(c, 'v', X + ts / 2, Y - ts * .3, ts * .06, bl ? HOT : AMBER, {});
      c.strokeStyle = bl ? HOT : AMBER; c.lineWidth = 2; rr(c, X + i, Y + i, ts - 2 * i, ts - 2 * i, ts * .08); c.stroke();
    } else {
      c.strokeStyle = '#5a2020'; c.lineWidth = Math.max(2, ts * .06);
      c.beginPath(); c.moveTo(X + i * 2, Y + i * 2); c.lineTo(X + ts - i * 2, Y + ts - i * 2); c.moveTo(X + ts - i * 2, Y + i * 2); c.lineTo(X + i * 2, Y + ts - i * 2); c.stroke();
    }
  }
  // blast lanes being aimed
  for (const f of g.foes) if (f.hp > 0 && f.aim) {
    const lane = g.lane(f), soon = g.threat(f, g.next) === 2;
    for (const [x, y] of lane) {
      const X = gx + x * ts, Y = gy + y * ts;
      c.fillStyle = soon ? `rgba(255,60,40,${.25 + .35 * pu})` : 'rgba(255,60,40,.14)';
      c.fillRect(X + ts * .1, Y + ts * .1, ts * .8, ts * .8);
      if (f.type === 'bassist') { text(c, f.aim[0] > 0 ? '>' : f.aim[0] < 0 ? '<' : f.aim[1] < 0 ? '^' : 'v', X + ts / 2, Y + ts * .3, ts * .05, RED, { align: 'center' }); }
    }
  }
  // items
  for (const it of g.items) {
    const X = gx + (it.x + .5) * ts, Y = gy + (it.y + 1) * ts - ts * .12;
    const bob = Math.sin(now * 4 + it.id) * ts * .05;
    if (it.kind === 'relic' || it.kind === 'lost') {
      const col = INST[it.inst].col;
      let vis = true;
      if (it.kind === 'lost' && it.until < 1e8) { const left = it.until - (g.next - 1); vis = left > 3 || Math.floor(now * (left > 1 ? 6 : 12)) % 2 === 0; }
      c.save(); c.globalAlpha = .35 + .3 * pu; c.fillStyle = col;
      c.beginPath(); c.ellipse(X, Y, ts * .36, ts * .12, 0, 0, 6.3); c.fill(); c.restore();
      if (vis) spr(c, it.inst, X, Y - ts * .08 + bob, ts * .74);
      if (it.kind === 'lost' && it.until < 1e8) { const left = Math.max(0, it.until - (g.next - 1)); text(c, String(left), X, Y - ts * .95, ts * .045, RED, { align: 'center' }); }
    } else if (it.kind === 'tape') spr(c, 'tape', X, Y + bob, ts * .7);
  }
  // foes, back to front
  const list = g.foes.slice().sort((a, b) => a.y - b.y);
  for (const f of list) {
    const P = lerpPos(f.id, f.x, f.y, now);
    const X = gx + (P.x + .5) * ts, Y = gy + (P.y + 1) * ts - ts * .08 - P.hop * ts;
    const dying = f.hp <= 0, ago = (g.k - f.hurtAt);
    const flash = ago <= 0 && now - (S.lastBeatT || 0) < .12;
    let lx = 0, ly = 0;
    if (f.lunge && f.lunge.k === g.k) { const u = Math.min(1, (now - (S.lastBeatT || 0)) / .14); const s = Math.sin(u * Math.PI) * ts * .3; lx = f.lunge.dx * s; ly = f.lunge.dy * s; }
    if (dying) { const u = Math.min(1, (now - (S.lastBeatT || 0)) / .3); if (u >= 1) continue; spr(c, f.type, X, Y, ts * .9, { flash: true, alpha: 1 - u, sx: 1 + u, sy: 1 - u }); continue; }
    const big = FOE[f.type].boss ? 1.08 : 1;
    const stunned = f.stun >= g.next;
    spr(c, f.type, X + lx, Y + ly, ts * .9 * big, { sx: st, sy: sq, flash, flip: g.player.x < f.x });
    if (FOE[f.type].boss) {
      spr(c, 'crown', X + lx, Y + ly - ts * .82, ts * .38);
      const hpMax = FOE[f.type].hp + g.lap * 2;
      for (let i = 0; i < hpMax; i++) { c.fillStyle = i < f.hp ? '#ffc63d' : '#3a2410'; c.fillRect(X - hpMax * ts * .045 + i * ts * .09, Y + ts * .04, ts * .07, ts * .06); }
    } else if (FOE[f.type].hp > 1) {
      for (let i = 0; i < FOE[f.type].hp; i++) { c.fillStyle = i < f.hp ? HOT : '#3a2410'; c.fillRect(X - ts * .1 + i * ts * .12, Y + ts * .04, ts * .08, ts * .05); }
    }
    // the warning pip: red just before it acts on the next beat
    if (f.type !== 'dummy') {
      const th = g.threat(f, g.next), py = Y - ts * (FOE[f.type].boss ? 1.02 : .92);
      c.fillStyle = stunned ? '#5a5a7a' : th === 2 ? (Math.floor(now * 10) % 2 ? RED : HOT) : th ? RED : '#3a2410';
      if (th && !stunned) { c.save(); c.shadowColor = RED; c.shadowBlur = 6; }
      c.beginPath(); c.arc(X, py, ts * (th === 2 ? .085 : .065), 0, 6.3); c.fill();
      if (th && !stunned) c.restore();
      if (stunned) text(c, 'Z', X + ts * .22, py - ts * .12, ts * .04, '#9a9ac8');
    }
  }
  // the dancer
  const p = g.player, P = lerpPos('p', p.x, p.y, now, .3);
  const X = gx + (P.x + .5) * ts, Y = gy + (P.y + 1) * ts - ts * .08 - P.hop * ts;
  const blink = S.hurtT && now - S.hurtT < .8 && Math.floor(now * 14) % 2;
  if (g.status !== 'dead') {
    if (!blink) spr(c, 'player', X, Y, ts * .9, { sx: st, sy: sq, flip: p.fx < 0 });
    if (p.halo) {
      c.save(); c.strokeStyle = INST.choir.col; c.lineWidth = Math.max(2, ts * .06); c.shadowColor = INST.choir.col; c.shadowBlur = 8;
      c.beginPath(); c.ellipse(X, Y - ts * .95, ts * .22, ts * .07, 0, 0, 6.3); c.stroke(); c.restore();
    }
    // facing tick for the lead
    if (g.has('lead')) { c.fillStyle = INST.lead.col; c.globalAlpha = .7; c.beginPath(); c.arc(X + p.fx * ts * .48, Y - ts * .42 + p.fy * ts * .48, ts * .05, 0, 6.3); c.fill(); c.globalAlpha = 1; }
  } else {
    spr(c, 'player', X, Y, ts * .9, { sx: 1.2, sy: .35, alpha: .8 });
  }
  if (TOUCH && g.status === 'play' && (g.tutorial || g.fi === 0 && g.next < 24)) {
    // ghost chevrons where to tap
    c.globalAlpha = .35 + .25 * pu;
    const cx = gx + (P.x + .5) * ts, cy = gy + (P.y + .5) * ts, d = ts * 1.05, pp = ts * .05;
    text(c, '^', cx, cy - d - 3.5 * pp, pp, HOT, { align: 'center' }); text(c, 'v', cx, cy + d - 3.5 * pp, pp, HOT, { align: 'center' });
    text(c, '<', cx - d, cy - 3.5 * pp, pp, HOT, { align: 'center' }); text(c, '>', cx + d, cy - 3.5 * pp, pp, HOT, { align: 'center' });
    c.globalAlpha = 1;
  }
}

function drawFx() {
  const now = mu.now(), { ts } = Lo;
  S.fx = S.fx.filter(f => now - f.t < f.dur);
  for (const f of S.fx) {
    const u = (now - f.t) / f.dur, dt = now - f.t;
    if (f.k === 'bit') {
      c.fillStyle = f.col; c.globalAlpha = 1 - u;
      const s = Math.max(2, ts * .09);
      c.fillRect(f.x + f.vx * dt - s / 2, f.y + f.vy * dt + 240 * dt * dt - s / 2, s, s); c.globalAlpha = 1;
    } else if (f.k === 'txt') {
      text(c, f.s, f.x, f.y - u * ts * .6, Math.max(1.5, ts * .045), f.col, { align: 'center' });
    } else if (f.k === 'ring') {
      const { px, py } = tileC(f.x, f.y);
      c.strokeStyle = f.col; c.globalAlpha = 1 - u; c.lineWidth = ts * .12 * (1 - u) + 1;
      c.strokeRect(px - ts * (.5 + u), py - ts * (.5 + u), ts * (1 + 2 * u), ts * (1 + 2 * u)); c.globalAlpha = 1;
    } else if (f.k === 'beam') {
      const { px, py } = tileC(f.x, f.y), ex = px + f.dx * (f.len + .5) * ts, ey = py + f.dy * (f.len + .5) * ts;
      c.save(); c.strokeStyle = f.col; c.shadowColor = f.col; c.shadowBlur = 14; c.globalAlpha = 1 - u;
      c.lineWidth = ts * (f.wide ? .5 : .22) * (1 - u * .7); c.lineCap = 'round';
      c.beginPath(); c.moveTo(px + f.dx * ts * .3, py + f.dy * ts * .3); c.lineTo(ex, ey); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth *= .35; c.stroke(); c.restore();
    } else if (f.k === 'trail') {
      const { px, py } = tileC(f.x, f.y);
      c.fillStyle = INST.hats.col; c.globalAlpha = (1 - u) * .5; c.fillRect(px - ts * .3, py - ts * .3, ts * .6, ts * .6); c.globalAlpha = 1;
    }
  }
}

// ------------------------------------------------------------ HUD, beat bar and rack
function drawHud() {
  const g = S.g, h = Lo.hud;
  const name = g.tutorial ? 'SOUNDCHECK' : 'FLOOR ' + (g.fi + 1) + (g.lap ? ' · ENCORE ' + g.lap : '');
  const sub = g.tutorial ? 'LEARN THE STEPS' : g.floor.name + ' · ' + g.bpm + ' BPM';
  if (Lo.side) {
    let y = h.y;
    const p = Math.min(3, fitPitch(name, h.w, 3));
    text(c, name, h.x, y, p, AMBER, { dim: DIM }); y += 9 * p;
    const p2 = Math.min(2, fitPitch(sub, h.w, 2)); text(c, sub, h.x, y, p2, '#c88a3a'); y += 10 * p2;
    Lo.cap.y = y + 14;
    // the score sits under the soundcheck caption when that runs long on short screens
    const cap = capBox(), sy = Lo.gy + Lo.gh - 60;
    drawScore(h.x, cap ? Math.min(VH - sa.b - 58, Math.max(sy, cap.y + cap.h + 12)) : sy, h.w, false);
  } else {
    const room = h.w - 92;
    const p = Math.min(2.5, fitPitch(name, room, 2.5));
    text(c, name, h.x, h.y, p, AMBER, { dim: DIM });
    const sub2 = g.tutorial ? sub : g.floor.name;
    text(c, sub2, h.x, h.y + 9 * p, Math.min(1.5, fitPitch(sub2, room, 1.5)), '#c88a3a');
    drawScore(h.x + h.w, h.y, 86, true);
  }
  // pause / sound
  const b = Lo.btn;
  hot.push({ x: b.x - 4, y: b.y - 4, w: 50, h: 50, fn: () => togglePause() });
  c.fillStyle = '#1c1215'; rr(c, b.x, b.y, 40, 40, 8); c.fill(); c.strokeStyle = '#3a2410'; c.lineWidth = 2; c.stroke();
  c.fillStyle = AMBER; c.fillRect(b.x + 13, b.y + 12, 5, 16); c.fillRect(b.x + 22, b.y + 12, 5, 16);
}
function drawScore(x, y, w, right) {
  const g = S.g, al = right ? 'right' : 'left';
  const s = String(g.score).padStart(5, '0');
  const p = right ? 2.5 : 3;
  text(c, s, x, y, p, HOT, { align: al, dim: DIM });
  const m = 'x' + g.mult, mp = right ? 1.5 : 2;
  const cx = x;
  text(c, 'GROOVE ' + m, cx, y + 9 * p, mp, g.mult > 1 ? FLOORCOL[(g.mult + 1) % 5] : '#c88a3a', { align: al });
  // combo fill toward the next multiplier
  const frac = g.mult >= 4 ? 1 : (g.combo % 8) / 8, bw = right ? 70 : Math.min(w, 140);
  const bx = right ? cx - bw : cx;
  for (let i = 0; i < 8; i++) { c.fillStyle = i < frac * 8 ? AMBER : '#3a2410'; c.fillRect(bx + i * bw / 8, y + 9 * p + 9 * mp, bw / 8 - 2, 3); }
}

function drawBeatBar() {
  const g = S.g, B = Lo.beat, t = songT(), L = g.L;
  const cx = B.x + B.w / 2, cy = B.y + B.h / 2, sp = B.w * .13;
  c.fillStyle = '#160e11'; rr(c, B.x, B.y, B.w, B.h, 8); c.fill();
  c.strokeStyle = '#3a2410'; c.lineWidth = 2; c.stroke();
  // markers slide in from both sides and meet the kick drum on the beat
  const k0 = Math.floor(t / L);
  c.save(); rr(c, B.x + 2, B.y + 2, B.w - 4, B.h - 4, 7); c.clip();
  for (let k = k0 - 1; k <= k0 + 5; k++) {
    const dt = (k * L - t) / L;
    if (dt < -.25 || k < 0 && g.status === 'play' && k < -4) continue;
    const off = dt * sp, a = Math.max(0, Math.min(1, 1.6 - Math.abs(dt) * .35));
    const ph = ((k % PH) + PH) % PH;
    const pw = [];
    for (const i of g.player.inst) if (i !== 'kick' && INST[i].steps[ph]) pw.push(INST[i].col);
    for (const s of [-1, 1]) {
      const x = cx + s * off;
      c.globalAlpha = a * (k < 0 ? .5 : 1);
      c.fillStyle = k === g.next && Math.abs(dt) * L < WIN ? HOT : AMBER;
      c.fillRect(x - 3, cy - B.h * .3, 6, B.h * .6);
      pw.forEach((col, j) => { c.fillStyle = col; c.fillRect(x - 4, cy - B.h * .3 - 6 - j * 5, 8, 4); });
    }
  }
  c.globalAlpha = 1; c.restore();
  // the window, faintly
  c.fillStyle = 'rgba(255,180,58,.08)'; c.fillRect(cx - WIN / L * sp, B.y + 3, 2 * WIN / L * sp, B.h - 6);
  const pu = pulse(), kp = Math.exp(-(mu.now() - S.kickPulse) / .12);
  spr(c, g.player.crack ? 'kick' : 'kick', cx, cy + B.h * .38, B.h * .78 * (1 + .12 * pu + .1 * kp));
  if (g.player.crack) { c.strokeStyle = RED; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 6, cy - B.h * .3); c.lineTo(cx + 2, cy - 2); c.lineTo(cx - 3, cy + 3); c.lineTo(cx + 5, cy + B.h * .3); c.stroke(); }
  // judgement
  if (S.judge && mu.now() - S.judge.t < .6) {
    const p = Math.max(1.5, Math.min(2, B.h * .05));
    text(c, S.judge.s, cx, B.y - 8 * p - 2, p, S.judge.bad ? RED : S.judge.s === 'PERFECT' ? HOT : '#c88a3a', { align: 'center' });
  }
}

function drawRack() {
  const g = S.g, R = Lo.rack, now = mu.now();
  const rows = RACK;
  const side = Lo.side;
  const rowH = side ? Math.min(46, Math.max(28, (Lo.gh - 80) / 5 / 1.6)) : 17;
  const p = side ? Math.min(2.5, rowH * .07) : 1.5;
  let y = R.y;
  if (side) { text(c, 'THE RACK', R.x, y, Math.min(2.5, p * 1.1), AMBER, { dim: DIM }); y += 12 * p; }
  const ph = g.next > 0 ? ((g.next - 1) % PH) : -1;
  const labelW = side ? Math.min(R.w * .45, 18 * 6 * p) : Math.min(R.w * .42, 112);
  const cellW = (R.w - labelW) / 8;
  for (const i of rows) {
    const own = g.has(i), lost = g.items.find(it => it.kind === 'lost' && it.inst === i), gone = g.player.gone.includes(i);
    const fl = S.rackFlash && S.rackFlash.inst === i && now - S.rackFlash.t < 1.5 && Math.floor(now * 8) % 2;
    const col = own ? INST[i].col : lost ? RED : '#4a3420';
    const lab = own || lost || gone ? INST[i].name : '?????';
    text(c, lab, R.x, y + 2, p, fl ? HOT : col);
    const pw = own || lost || gone ? INST[i].power : '';
    if (side) text(c, pw, R.x, y + 2 + 9 * p, p * .75, own ? '#c88a3a' : '#4a3420');
    else text(c, pw, R.x + 6.5 * 6 * p, y + 2, p, own ? '#c88a3a' : '#4a3420');
    if (gone && !own) { c.fillStyle = RED; c.fillRect(R.x, y + 2 + 3 * p, dotWidth(lab) * p, 2); }
    for (let s = 0; s < 8; s++) {
      const X = R.x + labelW + s * cellW, on = INST[i].steps[s];
      const cur = s === ph;
      c.fillStyle = cur ? '#3a2a1a' : '#1a1114';
      c.fillRect(X + 1, y, cellW - 2, rowH - (side ? rowH * .35 : 3));
      if (on) {
        const lit = own && cur;
        c.fillStyle = own ? (lit ? HOT : col) : '#3a2a20';
        if (lit) { c.save(); c.shadowColor = col; c.shadowBlur = 10; }
        const pad = Math.max(2, cellW * .18);
        c.fillRect(X + 1 + pad, y + pad * .7, cellW - 2 - 2 * pad, rowH - (side ? rowH * .35 : 3) - pad * 1.4);
        if (lit) c.restore();
      }
      if (s % 4 === 0) { c.fillStyle = '#3a2410'; c.fillRect(X, y, 1, rowH - (side ? rowH * .35 : 3)); }
    }
    y += side ? rowH * 1.2 : rowH;
  }
  if (side) {
    // what's on the floor
    y += 8;
    const parts = [...new Set(g.foes.filter(f => f.hp > 0 && FOE[f.type].part).map(f => FOE[f.type].part))];
    if (parts.length) {
      text(c, 'ON THE FLOOR', R.x, y, p * .8, '#c88a3a'); y += 10 * p * .8;
      block(c, parts.join(' · '), R.x, y, p * .8, R.w, RED);
    }
  }
}

function capBox() {
  const T = S.tut, C = Lo.cap, g = S.g;
  if (!T || !g.tutorial) return null;
  const inner = C.w - 24, subW = inner - 70, sub = T.sub + (T.progress() ? '  ' + T.progress() : '');
  // shrink the type until the box fits above the floor (or, beside it, above the score)
  const room = Lo.side ? VH - sa.b - 70 - C.y : Lo.gy - Lo.ts * .35 - 8 - (Lo.hud.y + 40);
  let p = Lo.side ? Math.min(2.5, Math.max(1.5, C.w / 120)) : 2, h = 0;
  for (;;) {
    h = Math.max(blockH(T.msg, p, inner) + 6 * p + blockH(sub, p * .8, subW) + 28, 13 * p + 56);
    if (h <= room || p <= 1) break;
    p -= .25;
  }
  return { p, h, inner, subW, sub, y: Lo.side ? C.y : Lo.gy - Lo.ts * .35 - 8 - h };
}
function drawCaption() {
  const T = S.tut, C = Lo.cap, B = capBox();
  if (!B) return;
  const { p, h, inner, subW, sub, y } = B;
  c.fillStyle = 'rgba(20,12,14,.95)'; rr(c, C.x, y, C.w, h, 8); c.fill();
  c.strokeStyle = '#6a3a14'; c.lineWidth = 2; c.stroke();
  let yy = y + 12;
  yy += block(c, T.msg, C.x + 12, yy, p, inner, AMBER) + 6 * p;
  block(c, sub, C.x + 12, yy, p * .8, subW, HOT);
  button('SKIP', C.x + C.w - 66, y + h - 32, 58, 26, () => { save.tut = true; store(); mu.stop(); newRun(); }, { p: 1.5 });
}

function drawBanner() {
  const B = S.banner, now = mu.now();
  const g = S.g;
  // count-in numbers
  if (g && S.mode === 'play' && g.status === 'play') {
    const t = songT();
    if (t < 0 && t > -4 * g.L - .2) {
      const n = Math.ceil(-t / g.L);
      if (n >= 1 && n <= 4) {
        const f = (-t / g.L) % 1, p = Lo.ts * .14 * (1 + .3 * Math.pow(f, 3));
        text(c, String(5 - n), Lo.gx + Lo.gw / 2, Lo.gy + Lo.gh * .62, p, HOT, { align: 'center', glow: AMBER });
      }
    }
  }
  if (!B || now - B.t > B.dur) return;
  const u = (now - B.t) / B.dur, a = Math.min(1, Math.min(u * 8, (1 - u) * 5));
  const w = Lo.gw * .96, x = Lo.gx + (Lo.gw - w) / 2;
  const pb = Math.min(Lo.ts * .1, fitPitch(B.big, w - 24, 6)), ps = Math.max(1.5, Math.min(pb * .45, 2.5));
  const sh = blockH(B.small, ps, w - 24);
  const h = 7 * pb + sh + 34, y = Lo.gy + Lo.gh * .22;
  c.globalAlpha = a;
  c.fillStyle = 'rgba(14,9,11,.9)'; rr(c, x, y, w, h, 8); c.fill();
  c.strokeStyle = B.col; c.lineWidth = 2; c.stroke();
  text(c, B.big, x + w / 2, y + 12, pb, B.col, { align: 'center', glow: B.col });
  block(c, B.small, x + 12, y + 20 + 7 * pb, ps, w - 24, HOT, { align: 'center' });
  c.globalAlpha = 1;
}

// ------------------------------------------------------------ screens
function drawTitle() {
  const now = performance.now() / 1000;
  // a demo floor dances under the sign
  const ts = Lo.ts;
  drawFloorIdle();
  const w = Math.min(VW - 32, 620), x = (VW - w) / 2;
  const pT = fitPitch('ENCORE', w - 60, 14);
  const lines = [
    'A RHYTHM DUNGEON WHERE EVERY RELIC ADDS A PART TO THE SONG, AND EVERY PART IS A POWER.',
  ];
  let ps = Math.max(1.5, Math.min(2.5, w / 260)), bh = [50, 44, 40], gap = 10, pt = pT;
  let bodyH = blockH(lines[0], ps, w - 60);
  let h = 7 * pt + bodyH + 48 + bh[0] + bh[1] + bh[2] + 3 * gap + 40;
  if (h > VH - sa.t - 16) { // short screens: smaller sign, slimmer buttons
    bh = [40, 34, 32]; gap = 6; pt = Math.min(pT, (VH - sa.t) * .1 / 7); ps = 1.5;
    bodyH = blockH(lines[0], ps, w - 60);
    h = 7 * pt + bodyH + 40 + bh[0] + bh[1] + bh[2] + 3 * gap + 36;
  }
  const y = Math.max(sa.t + 8, (VH - h) / 2);
  panel(x, y, w, h);
  text(c, 'ENCORE', VW / 2, y + 22, pt, AMBER, { align: 'center', dim: DIM, glow: '#ff8a1a' });
  let yy = y + 22 + 7 * pt + 14;
  yy += block(c, lines[0], x + 30, yy, ps, w - 60, '#e8c89a', { align: 'center' }) + 14;
  const bw = Math.min(300, w - 60), bx = VW / 2 - bw / 2;
  button('PLAY', bx, yy, bw, bh[0], () => { mu.unlock(); newRun({ tutorial: !save.tut }); }, { primary: true, p: 3 }); yy += bh[0] + gap;
  button('SOUNDCHECK', bx, yy, bw, bh[1], () => { mu.unlock(); newRun({ tutorial: true }); }, { p: 2 }); yy += bh[1] + gap;
  button(mu.isMuted() ? 'SOUND: OFF' : 'SOUND: ON', bx, yy, bw, bh[2], () => mu.setMuted(!mu.isMuted()), { p: 1.5 }); yy += bh[2] + gap;
  const best = save.best ? 'BEST ' + save.best + (save.wins ? ' · ' + save.wins + ' ENCORE' + (save.wins > 1 ? 'S' : '') : '') : (TOUCH ? 'BEST WITH SOUND ON' : 'BEST WITH SOUND ON · ARROWS OR WASD');
  text(c, best, VW / 2, yy, 1.5, '#c88a3a', { align: 'center' });
}
function drawFloorIdle() {
  const { ts, gx, gy, gw, gh } = Lo;
  const b = performance.now() / 600, kb = Math.floor(b), pu = Math.exp(-(b - kb) * .6 / .16);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const ci = (x * 2 + y * 3) % 5, X = gx + x * ts, Y = gy + y * ts;
    c.drawImage(tiles.off[ci], X, Y, ts, ts);
    const a = (x + y + kb) % 2 === 0 ? .2 + .6 * pu : .08;
    c.globalAlpha = a; c.drawImage(tiles.on[ci], X, Y, ts, ts); c.globalAlpha = 1;
  }
  const sq = 1 - .09 * pu;
  const cast = [['player', 4, 8], ['snare', 2, 3], ['shaker', 6, 2], ['tom', 7, 6], ['horn', 1, 6], ['speaker', 3, 5], ['speaker', 5, 5]];
  for (const [n, x, y] of cast) spr(c, n, gx + (x + .5) * ts, gy + (y + 1) * ts - ts * .08 - (n === 'player' ? Math.abs(Math.sin(b * Math.PI)) * ts * .15 : 0), ts * .9, { sx: 1 + .07 * pu, sy: sq });
}

function drawOver() {
  const O = S.over, g = S.g, now = mu.now();
  if (!O || now - O.t < 1.4) return;
  const w = Math.min(VW - 32, 480), x = (VW - w) / 2;
  const big = O.won ? 'ENCORE!' : 'THE MUSIC STOPPED';
  const pb = fitPitch(big, w - 50, 6);
  const lines = O.won
    ? ['THE BAND IS DOWN AND THE CROWD WANTS MORE.', 'SCORE ' + g.score + (O.newBest ? ' · NEW BEST!' : ' · BEST ' + save.best), 'LONGEST GROOVE ' + g.best + ' · ' + g.kills + ' KNOCKED OUT']
    : ['FLOOR ' + (g.fi + 1) + ': ' + g.floor.name + (g.lap ? ' · ENCORE ' + g.lap : ''), 'SCORE ' + g.score + (O.newBest ? ' · NEW BEST!' : ' · BEST ' + save.best), 'LONGEST GROOVE ' + g.best + ' · ' + g.kills + ' KNOCKED OUT'];
  const ps = Math.max(1.5, Math.min(2, w / 230));
  const bh = lines.reduce((a, l) => a + blockH(l, ps, w - 50) + 10, 0);
  const h = 7 * pb + bh + 60 + 2 * 56;
  const y = (VH - h) / 2;
  panel(x, y, w, h);
  text(c, big, VW / 2, y + 26, pb, O.won ? '#ffc63d' : RED, { align: 'center', glow: O.won ? '#ffc63d' : RED });
  let yy = y + 26 + 7 * pb + 18;
  for (const l of lines) yy += block(c, l, x + 25, yy, ps, w - 50, '#e8c89a', { align: 'center' }) + 10;
  yy += 8;
  const bw = Math.min(300, w - 50), bx = VW / 2 - bw / 2;
  if (O.won) button('ENCORE +12 BPM', bx, yy, bw, 46, () => newRun({ lap: g.lap + 1, score: g.score }), { primary: true, p: 2.5 });
  else button('AGAIN', bx, yy, bw, 46, () => newRun(), { primary: true, p: 3 });
  button('TITLE', bx, yy + 56, bw, 40, toTitle, { p: 2 });
}
function toTitle() { mu.stop(); S.mode = 'title'; S.g = null; S.over = null; S.tut = null; S.paused = false; mu.resume(); }

function drawPause() {
  const w = Math.min(VW - 32, 380), x = (VW - w) / 2, h = 7 * 5 + 40 + 4 * 54 + 10, y = (VH - h) / 2;
  panel(x, y, w, h);
  text(c, 'PAUSED', VW / 2, y + 24, Math.min(5, fitPitch('PAUSED', w - 60, 5)), AMBER, { align: 'center', dim: DIM });
  const bw = Math.min(280, w - 50), bx = VW / 2 - bw / 2;
  let yy = y + 24 + 35 + 20;
  button('RESUME', bx, yy, bw, 44, () => togglePause(false), { primary: true, p: 2.5 }); yy += 54;
  button(mu.isMuted() ? 'SOUND: OFF' : 'SOUND: ON', bx, yy, bw, 40, () => mu.setMuted(!mu.isMuted()), { p: 1.5 }); yy += 50;
  if (S.g?.tutorial) { button('SKIP SOUNDCHECK', bx, yy, bw, 40, () => { save.tut = true; store(); togglePause(false); mu.stop(); newRun(); }, { p: 1.5 }); yy += 50; }
  else { button('RESTART', bx, yy, bw, 40, () => { togglePause(false); newRun(); }, { p: 1.5 }); yy += 50; }
  button('QUIT TO TITLE', bx, yy, bw, 40, () => { togglePause(false); toTitle(); }, { p: 1.5 });
}

// ------------------------------------------------------------ frame
function frame() {
  requestAnimationFrame(frame);
  if (S.hold) return;
  render();
}
function render() {
  hot = [];
  mu.watchdog();
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.drawImage(bgImg, 0, 0, VW, VH);
  if (S.mode === 'title') { drawTitle(); return; }
  stepGame();
  const g = S.g;
  if (!g) return;
  if (g.k !== S.lastBeat) { S.lastBeat = g.k; S.lastBeatT = mu.now(); }
  const now = mu.now();
  const sh = S.shake > 0 ? S.shake : 0;
  S.shake = Math.max(0, S.shake - 1 / 60 * 1.6);
  c.save();
  if (sh) c.translate((Math.random() - .5) * sh * 14, (Math.random() - .5) * sh * 14);
  drawFloor();
  drawThings();
  drawFx();
  c.restore();
  if (S.trans) { c.fillStyle = `rgba(11,7,9,${Math.min(1, (now - S.trans) / .8)})`; c.fillRect(0, 0, VW, VH); }
  drawBanner();
  drawHud();
  drawBeatBar();
  drawRack();
  drawCaption();
  if (S.hurtT && now - S.hurtT < .3 && now >= S.hurtT) { c.fillStyle = `rgba(255,40,30,${.25 * (1 - (now - S.hurtT) / .3)})`; c.fillRect(0, 0, VW, VH); }
  drawOver();
  if (S.paused) { c.fillStyle = 'rgba(8,5,6,.6)'; c.fillRect(0, 0, VW, VH); hot = []; drawPause(); }
}

// ------------------------------------------------------------ boot
function newDemo() {
  S.g = new Game({ seed: 8 });
  const g = S.g;
  g.player.inst = ['kick', 'bass', 'hats', 'lead'];
  g.score = 1240; g.combo = 19; g.best = 31;
  g.fi = 1; g.nextFloor();
  S.mode = 'play'; S.over = null; S.fx = []; anim.clear();
  S.t0 = mu.now() - 6 * g.L + .05;
  g.ev = [];
}
layout();
if (DEMO) newDemo();
else if (AUTO) { save.tut = true; newRun({ seed: +(Q.get('seed') || 1) }); }
if (DEBUG) window.enc = { S, get g() { return S.g; }, get hot() { return hot; }, render, newRun, mu, step: n => { for (let i = 0; i < n; i++) render(); } , hold: v => S.hold = v };
requestAnimationFrame(() => { frame(); window.toyboxReady?.(); });
