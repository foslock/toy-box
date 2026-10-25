import { Game, pilot } from './game.js';
import { GOAL, GEAR, LINES, ICE, SEALS, MAT, WATER_Y, rampGeom } from './sim.js';
import { Painter, INK, icon } from './art.js';
import { Sound } from './sound.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug') || Q.has('hold'), HOLD = Q.has('hold'), AUTO = Q.has('autoplay');
const TS = DEMO ? 0.45 : +(Q.get('speed') || 2.4);     // simulated seconds per real second
const STEP = 1 / 120;
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('pileup.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { if (DEMO || AUTO) return; try { localStorage.setItem('pileup.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('pileup.' + k); } catch {} },
};
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const fmtDist = (m) => m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m < 10000 ? 2 : 1) + ' km';

const painter = new Painter($('world'));
const sound = new Sound();
let game = null, run = null;
let mode = 'title';            // title | ready | fly | landed | report | pause
let pausedFrom = null;
let fx = [];
let time = 0, acc = 0, last = performance.now();
let slowT = 0, slowTo = 1, shake = 0, ff = false, endT = 0, report = null;
let steer = null, keyTurn = { up: false, down: false }, boostHeld = false, boostPtr = null;
let steered = false;
let seen = store.get('seen', {});
let coachCur = null;
let shownDist = 0;
let stripCache = null;

// ---------------------------------------------------------------- layout
function layout() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  painter.resize(window.innerWidth, window.innerHeight, dpr);
  stripCache = null;
  snapCamera();
}
window.addEventListener('resize', layout);

// ---------------------------------------------------------------- camera
function coveredTop() {
  let y = 0;
  for (const id of ['hud', 'coach']) {
    const el = $(id);
    if (!el.hidden) y = Math.max(y, el.getBoundingClientRect().bottom);
  }
  return y;
}
function camTarget() {
  const { W, H } = painter;
  const big = Math.max(W, H * 0.75);
  if (!run || run.state === 'ready' || (run.state === 'ramp' && run.s < 0.6)) {
    const gm = rampGeom(run ? run.ramp : GEAR.ramp[game.tiers.ramp]);
    const span = gm.L + (W < H ? 14 : 46);
    // keep the top of the ramp (and the penguin on it) below the top bar and any tip card
    const top = coveredTop() + 40;          // room for the penguin's sprite above the ramp's top
    const fit = (H * 0.8 - top) / (gm.p0[1] + 2);
    const s = clamp(Math.min(W * 0.92 / span, H * 0.5 / (gm.p0[1] + 6), fit), 1, 30);
    const x = -gm.L / 2 + (W < H ? 4 : 14);
    return { x, y: game.world.at(x) + H * 0.3 / s - 1, s };
  }
  const w = game.world;
  const v = run.state === 'done' ? 0 : run.speed;
  const gy = w.at(run.x);
  const alt = Math.max(0, run.y - gy);
  let s = big / Math.max(34, v * 1.7 + 20);
  s = Math.min(s, H * 0.5 / Math.max(1, alt + 6));
  s = clamp(s, 0.1, 14);
  return { s, x: run.x + (W * 0.17) / s, gy, py: run.y };
}
function updateCamera(dt) {
  const t = camTarget(), c = painter.cam, { H } = painter;
  const k = 1 - Math.exp(-dt * 3);
  c.s = Math.exp(Math.log(c.s) + (Math.log(t.s) - Math.log(c.s)) * k);
  const kx = 1 - Math.exp(-dt * 7);
  c.x += (t.x - c.x) * kx;
  const ty = t.gy == null ? t.y : Math.max(t.gy + 0.27 * H / c.s, t.py - 0.2 * H / c.s);
  c.y += (ty - c.y) * (1 - Math.exp(-dt * 6));
  if (run && run.state !== 'ready') {
    // never lose the penguin
    const sx = painter.sx(run.x), sy = painter.sy(run.y);
    if (sx > painter.W * 0.85) c.x += (sx - painter.W * 0.85) / c.s;
    if (sx < painter.W * 0.1) c.x -= (painter.W * 0.1 - sx) / c.s;
    const yTop = Math.min(H * 0.6, Math.max(H * 0.18, coveredTop() + 24));
    if (sy < yTop) c.y += (yTop - sy) / c.s;
    if (sy > H * 0.9) c.y -= (sy - H * 0.9) / c.s;
  }
}
function snapCamera() {
  if (!game) return;
  const t = camTarget(), c = painter.cam;
  c.s = t.s; c.x = t.x; c.y = t.gy == null ? t.y : Math.max(t.gy + 0.27 * painter.H / c.s, t.py - 0.2 * painter.H / c.s);
}

// ---------------------------------------------------------------- the loop
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  try {
    if (!HOLD) tick(dt);
    draw();
  } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
function slowFactor() {
  let f = slowT > 0 ? slowTo : 1;
  if (coachCur && coachCur.slow && coachCur.slow < f) f = coachCur.slow;
  return f;
}
function input() {
  if (DEMO || AUTO) return pilot(run);
  const turn = (keyTurn.up ? 1 : 0) - (keyTurn.down ? 1 : 0);
  return { pitch: steer && steer.on ? steer.target : null, turn, boost: boostHeld };
}
function tick(dt) {
  time += dt;
  if (slowT > 0) slowT -= dt;
  if (mode === 'fly' && run) {
    acc += dt * TS * (ff ? 3 : 1) * slowFactor();
    let n = 0;
    while (acc >= STEP && n < 90) {
      run.step(STEP, input());
      acc -= STEP; n++;
      events();
      if (run.state === 'done') { acc = 0; break; }
    }
    if (run.state === 'fly' || run.state === 'ramp') trail(dt);
    tutorial(dt);
  } else if (mode === 'landed') {
    events();
    endT -= dt;
    if (endT <= 0) settle();
  } else if (run && run.state === 'done' && mode === 'report') { run.stepDebris(STEP); }
  if (coachCur) { coachCur.t += dt; if (coachCur.dur && coachCur.t > coachCur.dur) hideCoach(); }
  for (const p of fx) { const d = dt * (mode === 'fly' ? TS * slowFactor() : 1); p.age += dt; p.x += (p.vx || 0) * d; p.y += (p.vy || 0) * d; if (p.k === 'puff') p.vy *= 1 - 2 * d; else if (p.k === 'chip') p.vy -= 9.8 * d; }
  fx = fx.filter((p) => p.age < p.life);
  if (game) updateCamera(dt);
  shake = Math.max(0, shake - dt * 3);
  hud();
  const st = run && (mode === 'fly' || mode === 'landed') ? { speed: run.speed, ground: run.ground, ice: run.surface === MAT.ice, boost: run.boosting } : null;
  sound.update(st ? st : { speed: 0, calm: true });
}

// trails: snow spray when sliding, smoke when burning
let trailAcc = 0;
function trail(dt) {
  trailAcc += dt;
  if (trailAcc < 0.03) return;
  trailAcc = 0;
  const v = run.speed;
  if (run.ground && v > 3) {
    if (Math.random() < 0.6) fx.push({ k: 'puff', x: run.x - 0.8, y: run.y + 0.15, vx: run.vx * 0.55 + (Math.random() - 0.5) * 2, vy: 1.5 + Math.random() * Math.min(6, v * 0.12), r: 0.12 + Math.random() * 0.18, age: 0, life: 0.35 + Math.random() * 0.25, layer: 'front' });
    if (Math.random() < 0.8) fx.push({ k: 'chip', x: run.x - 0.6, y: run.y + 0.2, vx: run.vx * 0.4 - Math.random() * 4, vy: 2 + Math.random() * Math.min(8, v * 0.2), age: 0, life: 0.4, c: INK.blue });
  }
  if (run.boosting) {
    fx.push({ k: 'smoke', x: run.x - Math.cos(run.p) * 1.2, y: run.y + 0.3 - Math.sin(run.p) * 1.2, vx: run.vx * 0.3, vy: run.vy * 0.3 + 1, r: 0.3, age: 0, life: 0.9, layer: 'back' });
  }
}

function word(text, x, y, o = {}) { fx.push({ k: 'word', text, x, y, age: 0, life: o.life || 1.1, c: o.c, size: o.size, rot: (Math.random() - 0.5) * 0.3 }); }
function puffs(x, y, n, spread = 3) {
  for (let i = 0; i < n; i++) fx.push({ k: 'puff', x: x + (Math.random() - 0.5) * 1.5, y: y + 0.2, vx: (Math.random() - 0.3) * spread * 2, vy: Math.random() * spread * 1.5, r: 0.3 + Math.random() * 0.5, age: 0, life: 0.6 + Math.random() * 0.5 });
}
function slowmo(f, dur) { slowTo = f; slowT = dur; }

function events() {
  if (!run) return;
  for (const e of run.events) {
    switch (e.t) {
      case 'go': sound.play('go'); break;
      case 'lip': sound.play('lip'); puffs(run.x, run.y, 4, 2); break;
      case 'land': {
        sound.play('land', e.v);
        puffs(e.x, e.y, Math.min(14, 2 + e.v * 0.6), 1 + e.v * 0.15);
        if (e.v > 12) { shake = Math.min(1, e.v / 30); }
        if (e.m === MAT.penguin) { sound.play('boing'); sound.play('honk'); word(Math.random() < 0.5 ? 'BOING' : 'HONK', e.x, e.y + 3); slowmo(0.35, 0.5); }
        else if (e.m === MAT.wood) { word('CLONK', e.x, e.y + 3, { c: INK.blue }); sound.play('thud'); }
        else if (e.m === MAT.metal) { word('CLANG', e.x, e.y + 3, { c: INK.blue }); }
        else if (e.v > 16) { word('WHUMP', e.x, e.y + 3, { c: INK.blue }); slowmo(0.4, 0.4); }
        if (coachCur && coachCur.id === 'land') landFeedback(e);
        break;
      }
      case 'seal': sound.play('boing'); word('BOING!', e.x, e.y + 3, { size: 32 }); slowmo(0.3, 0.6); shake = 0.4; break;
      case 'snap': sound.play('snap'); word('SNAP', e.x, e.y + 3); slowmo(0.35, 0.5); coach('snap', `<b>Snap!</b> Too hard a landing breaks the wings. They stay right there: a ramp for another day.`, { dur: 6 }); break;
      case 'burnout': sound.play('burnout'); break;
      case 'thud': sound.play('thud'); puffs(e.x, e.y, 5, 2); break;
      case 'end':
        mode = 'landed';
        endT = e.why === 'sea' ? 2.2 : 1.3;
        steer = null; boostHeld = false;
        if (e.why === 'crack') { sound.play('crack'); word('STUCK', run.x, run.y + 4, { life: 1.6 }); }
        else if (e.why === 'sea') { sound.play('splash'); puffs(run.x, WATER_Y, 20, 5); banner('Splash!', `${run.name} made it to the sea`); }
        hideCoach('land'); hideCoach('steer');
        break;
    }
  }
  run.events.length = 0;
}

// ---------------------------------------------------------------- tutorial coach
function coach(id, html, o = {}) {
  if (DEMO || AUTO) return false;
  if (seen[id] && !o.again) return false;
  seen[id] = 1; store.set('seen', seen);
  coachCur = { id, t: 0, dur: o.dur ?? 0, slow: o.slow || 0 };
  const el = $('coach');
  el.className = o.good ? 'good' : '';
  el.innerHTML = '';
  el.appendChild(icon('penguin', o.sleepy ? 1 : 0, 48));
  const box = document.createElement('div');
  box.innerHTML = `<div class="step"><span>${o.step || 'Flying club notes'}</span>${o.good ? '' : '<button id="skipTut">skip tips</button>'}</div><p>${html}</p>`;
  el.appendChild(box);
  el.hidden = false;
  const sk = $('skipTut');
  if (sk) sk.onclick = (ev) => { ev.stopPropagation(); for (const k of TIPS) seen[k] = 1; store.set('seen', seen); hideCoach(); };
  return true;
}
const TIPS = ['launch', 'steer', 'land', 'heap', 'crack', 'wings', 'rocket', 'seals', 'ice', 'ff', 'snap', 'kicker'];
function hideCoach(id) {
  if (!coachCur || (id && coachCur.id !== id)) return;
  coachCur = null; $('coach').hidden = true;
}
function praise(html, dur = 2.2) { coach('_ok', html, { again: true, good: true, dur, step: 'Nice' }); seen._ok = 0; }
function landFeedback(e) {
  if (e.align > 0.92) praise('Belly-flat! A smooth landing <b>keeps your speed</b>.', 3);
  else praise(`Oof, beak first. A flatter landing would have <b>slid further</b>.`, 3);
}
function tutorial() {
  if (!run || DEMO || AUTO) return;
  const flying = run.state === 'fly' && !run.ground;
  if (coachCur && coachCur.id === 'launch' && run.state !== 'ready') hideCoach();
  if (flying && !seen.steer && run.air > 0.15) {
    coach('steer', `<b>Drag up or down</b> anywhere (or ↑ ↓) to tip ${run.name}'s beak. Point it <b>along the flight</b> to cut through the air.`, { slow: 0.25, step: 'Steering' });
    steered = false;
  }
  if (coachCur && coachCur.id === 'steer') {
    if (steered && coachCur.t > 0.6) { praise('That\'s it. Now get ready to land.', 1.6); }
    else if (coachCur.t > 7) hideCoach();
  }
  if (flying && seen.steer && !seen.land && run.vy < -3 && run.alt < Math.max(6, -run.vy * 0.9) && run.alt > 1.2) {
    coach('land', `Coming down! Tip the beak to match the <b>dashed line</b>. Belly-flat landings keep their speed.`, { slow: 0.22, step: 'Landing' });
  }
  if (coachCur && coachCur.id === 'land' && coachCur.t > 6) hideCoach();
  if (run.x > SEALS[0] - 260 && run.x < SEALS[0] && flying) coach('seals', `Seals ahead! They don't mind. <b>Bounce off them</b> for a free hop.`, { dur: 5 });
  if (run.x > ICE[0] - 400 && run.x < ICE[0]) coach('ice', `The <b>ice shelf</b>: five kilometres of slippery. Land belly-flat and enjoy the ride.`, { dur: 6 });
  if (run.x > 1450 && run.x < 1600 && run.ground) coach('kicker', `A natural <b>ski jump</b>. Keep your speed up the slope and it'll throw you.`, { dur: 5 });
  if (run.time > 30 && !coachCur) coach('ff', `Long flight? Tap the <b>▶▶</b> button (or press F) to fast-forward.`, { dur: 5 });
  if (game.day >= 2 && !seen.heap && run.state === 'fly' && !coachCur) {
    const ahead = game.world.wrecks.find((w) => w.x > run.x && w.x < run.x + 80);
    if (ahead) coach('heap', `That's ${ahead.n || 'yesterday\'s wreck'}, right where they stopped. Nothing gets cleared away: <b>every wreck is a bump</b> to bounce off.`, { dur: 7, step: 'The heap', sleepy: true });
  }
}

// ---------------------------------------------------------------- flow
function newGame(save) {
  game = new Game(save);
  stripCache = null;
}
function startDay() {
  run = game.newRun();
  mode = 'ready';
  fx = []; acc = 0; steer = null; boostHeld = false; ff = false;
  $('ffBtn').classList.remove('on');
  for (const id of ['report', 'title', 'pause', 'win']) $(id).hidden = true;
  $('hud').hidden = false;
  shownDist = 0;
  if (game.day === 1) coach('launch', `Day one. ${run.name} is waiting at the top of the ramp. <b>Tap anywhere</b> (or press Space) to let go of the brake.`, { step: 'Lesson one' });
  else if (game.tiers.rocket > 0 && !seen.rocket) coach('rocket', `A rocket! Once you're off the ramp, <b>hold Boost</b> (or Space) to fire. When it burns out it drops off, and stays where it lands.`, { step: 'New gear' });
  else if (game.tiers.wings > 0 && !seen.wings) coach('wings', `Wings! In the air, a little <b>nose up</b> glides; too steep and you'll stall. Let go and they trim themselves.`, { step: 'New gear' });
  else if (game.day === 2) coach('heap', `${game.nameFor(1)} is still out there from yesterday. Nothing gets cleared away: <b>every wreck becomes a bump</b> you can bounce off.`, { dur: 8, step: 'The heap', sleepy: true });
  snapCamera();
}
function launch() {
  if (mode !== 'ready' || !run) return;
  sound.init();
  run.launch();
  mode = 'fly';
  hideCoach('launch');
}
function settle() {
  report = game.settle();
  store.set('save', game.toJSON());
  stripCache = null;
  mode = 'report';
  showReport(report);
  if (report.firstWin) showWin(report);
}
const FLAVOUR = [
  (n) => `${n} is now part of the landscape.`,
  (n) => `${n} is having a little lie-down. Indefinitely.`,
  (n) => `${n} will make a fine bump for tomorrow.`,
  (n) => `${n} has decided to stay here and think about things.`,
  (n) => `${n} is fine. ${n} is staying put, though.`,
  (n) => `The tundra has one more penguin in it.`,
];
function showReport(r) {
  $('repHead').textContent = `Day ${r.day} · ${r.name}`;
  $('repSub').textContent = r.end === 'sea' || game.won ? 'the sea, reached' : `${fmtDist(GOAL - game.best)} to the sea`;
  const d = $('repDist'); d.textContent = r.end === 'sea' ? '20 km!' : fmtDist(r.dist); d.className = 'dist' + (r.record ? ' rec' : '');
  let note;
  if (r.end === 'sea') note = `${r.name} flew all the way to the sea.`;
  else if (r.end === 'crack') {
    const k = game.world.cracks[r.wreck.c];
    const pct = Math.min(100, Math.round((k.fill / k.d) * 100));
    note = pct >= 100 ? `${r.name} filled the crevasse to the brim. It's a bridge now.` : `${r.name} fell down a crevasse. It's ${pct}% full now.`;
  } else if (r.record && r.prevBest > 0) note = `A new record! ${r.name} stays out there as the marker.`;
  else note = FLAVOUR[r.day % FLAVOUR.length](r.name);
  $('repNote').textContent = note;
  const pay = $('repPay'); pay.innerHTML = '';
  for (const [k, v] of r.parts) pay.insertAdjacentHTML('beforeend', `<div><span>${k}</span><i></i><b>+${v}</b></div>`);
  pay.insertAdjacentHTML('beforeend', `<div class="tot"><span>Fish earned</span><i></i><b>+${r.earned}</b></div>`);
  if (r.record) sound.play('record');
  for (let i = 0; i < Math.min(12, r.parts.length * 3); i++) setTimeout(() => sound.play('fish', i), 200 + i * 60);
  const tip = $('repTip');
  tip.hidden = true;
  if (!DEMO && !AUTO) {
    if (r.day === 1) { const c = game.cheapest(); tip.hidden = false; tip.textContent = `Fish buy gear, and gear is permanent. ${c && c.price <= game.fish ? `You can afford the ${GEAR[c.line][game.tiers[c.line] + 1].name} already.` : 'Save up for something.'}`; }
    else if (r.end === 'crack' && !seen.crack) { seen.crack = 1; store.set('seen', seen); tip.hidden = false; tip.textContent = 'Crevasses fill up with whatever falls in. A few more penguins and you can slide straight over.'; }
    else if (r.day === 3) { tip.hidden = false; tip.textContent = 'Wings glide, rockets climb, wax slides further. Mix and match.'; }
  }
  shed(r.day === 1);
  $('nextBtn').innerHTML = `Day ${game.day}: ${game.name} ▸`;
  $('report').hidden = false;
  $('report').scrollTop = 0;
}
const LINE_NAMES = { ramp: 'Ramp', wings: 'Wings', rocket: 'Rocket', belly: 'Belly' };
const FISH = '<svg class="fish" viewBox="0 0 22 12"><path d="M1 6 C5 0 13 0 16 6 C13 12 5 12 1 6 Z M16 6 L21 1 L20 6 L21 11 Z" fill="currentColor"/></svg>';
function shed(hint) {
  const el = $('shed'); el.innerHTML = '';
  const cheap = game.cheapest();
  for (const l of LINES) {
    const t = game.tiers[l], nx = game.next(l);
    const it = document.createElement('div'); it.className = 'item';
    if (hint && cheap && cheap.line === l && game.canBuy(l)) it.classList.add('hot');
    it.appendChild(icon(l, nx ? t + 1 : t, 58));
    it.insertAdjacentHTML('beforeend', `<div class="ln">${LINE_NAMES[l]}</div><div class="cur">${GEAR[l][t].name}</div><div class="pips">${GEAR[l].slice(1).map((_, i) => `<i class="${i < t ? 'on' : ''}"></i>`).join('')}</div>`);
    const b = document.createElement('button'); b.className = 'btn' + (nx && game.canBuy(l) ? '' : ' blue');
    if (nx) {
      b.innerHTML = `<small>${nx.name}</small><span class="p">${nx.price} ${FISH}</span>`;
      b.disabled = !game.canBuy(l);
      b.onclick = () => { if (game.buy(l)) { sound.play('buy'); store.set('save', game.toJSON()); shed(false); hud(); } };
    } else { b.innerHTML = '<small>Best there is</small><span class="p">Maxed</span>'; b.disabled = true; }
    it.appendChild(b);
    el.appendChild(it);
  }
}
function showWin(r) {
  $('winSub').textContent = `day ${r.day}`;
  $('winNote').textContent = `${r.name} reached the sea on day ${r.day}, carried there by ${game.log.length} wrecks' worth of hard-won lessons.`;
  drawScene($('winArt'), true);
  $('win').hidden = false;
}
function banner(text, sub) {
  const el = $('banner');
  el.innerHTML = `<div><b>${text}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
}
function pause(on) {
  if (on && (mode === 'fly' || mode === 'ready')) { pausedFrom = mode; mode = 'pause'; $('pause').hidden = false; $('pauseSub').textContent = `day ${game.day}`; steer = null; boostHeld = false; }
  else if (!on && mode === 'pause') { mode = pausedFrom; $('pause').hidden = true; last = performance.now(); }
}
function toTitle() {
  mode = 'title'; run = null;
  for (const id of ['report', 'pause', 'win']) $(id).hidden = true;
  $('hud').hidden = true; hideCoach();
  setupTitle();
  $('title').hidden = false;
}

// ---------------------------------------------------------------- HUD and strip map
function hud() {
  if (!game) return;
  $('dayN').textContent = game.day;
  $('fishN').textContent = game.fish;
  const flying = run && (mode === 'fly' || mode === 'landed' || (mode === 'pause' && pausedFrom === 'fly'));
  if (flying) {
    shownDist = Math.max(0, run.x);
    $('distLbl').textContent = run.name; $('distN').textContent = fmtDist(shownDist);
  } else { $('distLbl').textContent = 'Best'; $('distN').textContent = fmtDist(game.best); }
  const showG = flying && run.state === 'fly';
  $('gauges').hidden = !showG;
  if (showG) {
    $('altN').textContent = Math.round(Math.max(0, run.alt)) + ' m';
    $('spdN').textContent = Math.round(run.speed * 3.6) + ' km/h';
  }
  const hasR = run && run.t.rocket > 0 && (mode === 'fly' || mode === 'ready' || mode === 'landed');
  $('boost').hidden = !hasR;
  if (hasR) {
    const f = run.rkt.fuel ? run.fuel / run.rkt.fuel : 0;
    $('fuelRing').setAttribute('stroke-dasharray', `${(f * 352).toFixed(1)} 352`);
    $('boost').classList.toggle('empty', f <= 0);
    $('boost').classList.toggle('down', !!(run.boosting || (boostHeld && f > 0)));
  }
  $('tapHint').hidden = !(mode === 'ready');
  drawStrip();
}
function drawStrip() {
  const c = $('strip');
  if ($('hud').hidden) return;
  const w = c.clientWidth, h = 40, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (!w) return;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = h * dpr; stripCache = null; }
  const world = game.world;
  if (!stripCache || stripCache.n !== world.wrecks.length) {
    const oc = document.createElement('canvas'); oc.width = c.width; oc.height = c.height;
    const g = oc.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = INK.paper; g.strokeStyle = INK.blue; g.lineWidth = 3;
    g.beginPath(); g.roundRect(1.5, 1.5, w - 3, h - 3, 5); g.fill(); g.stroke();
    const x0 = 8, x1 = w - 8, px = (x) => x0 + (x / GOAL) * (x1 - x0);
    const yOf = (y) => 30 - ((y + 60) / 130) * 20;
    // ice and sea
    g.fillStyle = INK.tint; g.fillRect(px(ICE[0]), 6, px(ICE[1]) - px(ICE[0]), h - 10);
    g.fillStyle = INK.blue; g.fillRect(px(GOAL - 15), 5, x1 - px(GOAL - 15) + 4, h - 10);
    // profile
    g.fillStyle = INK.paper; g.strokeStyle = INK.blue; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x0, h - 5);
    for (let sx = x0; sx <= px(GOAL - 15); sx++) { const x = ((sx - x0) / (x1 - x0)) * GOAL; g.lineTo(sx, clamp(yOf(world.at(x)), 6, h - 6)); }
    g.lineTo(px(GOAL - 15), h - 5); g.closePath(); g.fill(); g.stroke();
    // crevasses
    g.fillStyle = INK.black;
    for (const k of world.cracks) if (k.fill < k.d) g.fillRect(px(k.x) - 1, yOf(k.top) - 1, 2.5, 6);
    // seals
    for (const s of world.seals) { g.beginPath(); g.arc(px(s.x), yOf(s.y) - 1.5, 1.4, 0, 7); g.fill(); }
    // the heap: every wreck is a tick
    const cols = new Map();
    for (const wr of world.wrecks) {
      const sx = Math.round(px(wr.x)), n = cols.get(sx) || 0; cols.set(sx, n + 1);
      if (n > 5) continue;
      g.fillStyle = wr.k === 'penguin' ? INK.black : INK.red;
      g.fillRect(sx - 1, yOf(world.at(wr.x)) - 4 - n * 2.5, 2.5, 2.5);
    }
    g.fillStyle = INK.paper; g.font = `9px 'Holtwood One SC', serif`; g.textAlign = 'right';
    g.fillText('SEA', x1 - 1, h - 10);
    stripCache = { img: oc, n: world.wrecks.length, px, yOf };
  }
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(stripCache.img, 0, 0);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { px } = stripCache;
  if (game.best > 0) {
    const bx = px(Math.min(GOAL, game.best));
    g.strokeStyle = INK.black; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, 30); g.lineTo(bx, 7); g.stroke();
    g.fillStyle = INK.red; g.beginPath(); g.moveTo(bx, 7); g.lineTo(bx + 8, 10); g.lineTo(bx, 13); g.fill();
  }
  if (run && run.state !== 'ready') {
    const rx = px(clamp(run.x, 0, GOAL));
    g.fillStyle = INK.red; g.strokeStyle = INK.paper; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(rx, h - 4); g.lineTo(rx - 5, h - 12); g.lineTo(rx + 5, h - 12); g.closePath(); g.fill(); g.stroke();
  }
}

// ---------------------------------------------------------------- drawing
function draw() {
  if (!game) return;
  const c = painter.cam;
  const sx = shake ? (Math.random() - 0.5) * shake * 10 : 0, sy = shake ? (Math.random() - 0.5) * shake * 10 : 0;
  c.x -= sx / c.s; c.y += sy / c.s;
  painter.frame(game, run, fx, time);
  if (coachCur && coachCur.id === 'land' && run && run.state === 'fly') landGuide();
  c.x += sx / c.s; c.y -= sy / c.s;
}
// the dashed line a landing should match
function landGuide() {
  const g = painter.g, w = game.world;
  const x = run.x + run.vx * 0.12;
  const a = Math.atan(w.slope(x));
  const px = painter.sx(run.x), py = painter.sy(run.y);
  const L = 70;
  g.save(); g.translate(px, py); g.rotate(-a);
  g.setLineDash([9, 7]); g.strokeStyle = INK.red; g.lineWidth = 3;
  g.beginPath(); g.moveTo(-L, 0); g.lineTo(L, 0); g.stroke();
  g.restore();
  g.setLineDash([]);
}
// title and win illustrations: a heap of sleepy penguins and one who's off again
function drawScene(cv, sea) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = 420, H = 120;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.maxWidth = '100%';
  const p = new Painter(cv); p.W = W; p.H = H; p.dpr = dpr;
  const g = p.g; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  if (sea) {
    g.fillStyle = INK.blue; g.fillRect(250, 92, 170, 30);
    g.strokeStyle = INK.paper; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(262 + i * 26, 104); g.quadraticCurveTo(272 + i * 26, 98, 282 + i * 26, 104); g.stroke(); }
  }
  g.strokeStyle = INK.blue; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 100); g.quadraticCurveTo(120, 96, sea ? 250 : 420, sea ? 92 : 104); if (sea) g.lineTo(250, 120); g.stroke();
  const heap = [[60, 96, 0.05], [96, 96, -0.1], [78, 84, 0.2], [130, 97, 0.02], [112, 86, -0.15], [92, 73, 0.1]];
  for (const [x, y, r] of heap) { g.save(); g.translate(x, y); g.rotate(r); p.penguinBody(30, { lying: true, sleepy: true, t: x }); g.restore(); }
  g.save(); g.translate(sea ? 330 : 300, sea ? 78 : 40); g.rotate(sea ? 0.6 : -0.25);
  if (!sea) p.wingShape(3, 40, false);
  p.penguinBody(40, { lying: true, t: 0, scared: !!sea });
  if (!sea) p.rocketShape(2, 40, true, 0.4);
  g.restore();
  if (sea) { g.fillStyle = INK.paper; g.strokeStyle = INK.blue; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(310 + i * 9, 90 - (i % 2) * 8, 4 + (i % 3), 0, 7); g.fill(); g.stroke(); } }
  g.fillStyle = p.grain; g.fillRect(0, 0, W, H);
}
function setupTitle() {
  const save = store.get('save', null);
  $('startBtn').textContent = save ? `Continue · Day ${save.day}` : 'Start';
  $('newBtn').hidden = !save;
  $('titleBest').textContent = save && save.best ? `Best so far: ${fmtDist(save.best)}${save.won ? ' · reached the sea' : ''}` : '';
  drawScene($('titleArt'), false);
}

// ---------------------------------------------------------------- input
const cv = $('world');
cv.addEventListener('pointerdown', (e) => {
  sound.init();
  if (mode === 'ready') { launch(); return; }
  if (mode === 'fly' && !steer && run) {
    try { cv.setPointerCapture(e.pointerId); } catch {}
    steer = { id: e.pointerId, y0: e.clientY, p0: run.p, target: run.p, on: false };
  }
});
cv.addEventListener('pointermove', (e) => {
  if (!steer || e.pointerId !== steer.id || !run) return;
  const dy = steer.y0 - e.clientY;
  if (!steer.on && Math.abs(dy) > 6) { steer.on = true; steer.y0 = e.clientY; steer.p0 = run.p; }
  if (steer.on) { steer.target = clamp(steer.p0 + (steer.y0 - e.clientY) * (2.6 / Math.max(320, painter.H)), -1.45, 1.45); steered = true; }
});
const endSteer = (e) => { if (steer && e.pointerId === steer.id) steer = null; };
cv.addEventListener('pointerup', endSteer);
cv.addEventListener('pointercancel', endSteer);

const bb = $('boost');
bb.addEventListener('pointerdown', (e) => {
  e.preventDefault(); sound.init();
  if (mode === 'ready') { launch(); return; }
  boostHeld = true; boostPtr = e.pointerId;
  try { bb.setPointerCapture(e.pointerId); } catch {}
});
const endBoost = (e) => { if (e.pointerId === boostPtr) { boostHeld = false; boostPtr = null; } };
bb.addEventListener('pointerup', endBoost);
bb.addEventListener('pointercancel', endBoost);
bb.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === ' ' || k === 'Shift') {
    e.preventDefault();
    sound.init();
    if (mode === 'ready') launch();
    else if (mode === 'fly') boostHeld = true;
    else if (mode === 'report' && k === ' ' && !e.repeat && document.activeElement?.tagName !== 'BUTTON') (!$('win').hidden ? $('winGo') : $('nextBtn')).click();
    return;
  }
  if (k === 'ArrowUp' || k === 'w' || k === 'W') { keyTurn.up = true; steered = true; e.preventDefault(); }
  else if (k === 'ArrowDown' || k === 's' || k === 'S') { keyTurn.down = true; steered = true; e.preventDefault(); }
  else if (k === 'Enter' && mode === 'report' && !$('win').hidden) $('winGo').click();
  else if (k === 'Enter' && mode === 'report' && document.activeElement?.tagName !== 'BUTTON') $('nextBtn').click();
  else if (k === 'Enter' && mode === 'title') $('startBtn').click();
  else if (k === 'f' || k === 'F') toggleFF();
  else if (k === 'm' || k === 'M') toggleMute();
  else if (k === 'Escape' || k === 'p' || k === 'P') pause(mode !== 'pause');
});
window.addEventListener('keyup', (e) => {
  const k = e.key;
  if (k === ' ' || k === 'Shift') boostHeld = false;
  if (k === 'ArrowUp' || k === 'w' || k === 'W') keyTurn.up = false;
  if (k === 'ArrowDown' || k === 's' || k === 'S') keyTurn.down = false;
});
window.addEventListener('blur', () => { boostHeld = false; keyTurn.up = keyTurn.down = false; steer = null; });
document.addEventListener('visibilitychange', () => { if (document.hidden && !DEMO && !AUTO && mode === 'fly') pause(true); });

function toggleFF() { ff = !ff; $('ffBtn').classList.toggle('on', ff); }
function toggleMute() { sound.init(); sound.setOn(!sound.on); store.set('mute', !sound.on); $('muteBtn').classList.toggle('off', !sound.on); }
$('ffBtn').onclick = toggleFF;
$('muteBtn').onclick = toggleMute;
$('pauseBtn').onclick = () => pause(mode !== 'pause');
$('resumeBtn').onclick = () => pause(false);
$('menuBtn').onclick = () => toTitle();
$('nextBtn').onclick = () => { sound.init(); sound.play('click'); startDay(); };
$('startBtn').onclick = () => {
  sound.init(); sound.play('click');
  newGame(store.get('save', null));
  startDay();
};
$('newBtn').onclick = () => {
  if (!confirm('Start a new season? The heap, your gear and your fish all go.')) return;
  store.del('save'); newGame(null); startDay();
};
$('winGo').onclick = () => { $('win').hidden = true; };
$('winNew').onclick = () => { store.del('save'); newGame(null); startDay(); };
if (store.get('mute', false)) { sound.on = false; $('muteBtn').classList.add('off'); }

// ---------------------------------------------------------------- start
function demo() {
  // a season well under way: a heap near the start, a filled crevasse, a penguin mid-flight
  const g = new Game();
  g.day = 14; g.fish = 212; g.best = 1840;
  g.tiers = { ramp: 2, wings: 3, rocket: 0, belly: 2 };
  const spots = [118, 121, 124, 119.5, 160, 162, 205, 207, 209, 206, 244, 300, 330, 330, 330, 330, 395, 397, 455, 520, 522, 524, 600, 760, 905, 1190, 1400, 1840];
  spots.forEach((x, i) => { g.world.stamp(i % 5 === 3 ? 'glider' : i % 7 === 4 ? 'rocket' : 'penguin', x, { d: i + 1, n: g.nameFor(i + 1) }); });
  game = g;
  run = g.newRun();
  run.state = 'fly'; run.x = 98; run.y = g.world.at(98) + 7; run.vx = 27; run.vy = 4; run.p = 0.2;
  mode = 'fly';
  $('title').hidden = true; $('hud').hidden = false;
  snapCamera();
}

layout();
if (DEMO) demo();
else if (AUTO) { newGame(null); startDay(); $('title').hidden = true; launch(); }
else { newGame(store.get('save', null)); setupTitle(); snapCamera(); }
document.fonts?.ready.then(() => { stripCache = null; if (mode === 'title') setupTitle(); });
requestAnimationFrame(frame);
window.toyboxReady?.();

// autoplay keeps going through the shop on its own (for headless playtests)
if (AUTO) setInterval(() => {
  if (mode === 'report') {
    if (!$('win').hidden) $('win').hidden = true;
    for (;;) { const c = game.cheapest(); if (!c || c.price > game.fish) break; game.buy(c.line); }
    startDay();
  } else if (mode === 'ready') launch();
}, 600);

if (DEBUG || DEMO || AUTO) {
  window.pu = {
    get game() { return game; }, get run() { return run; }, get mode() { return mode; }, get cam() { return painter.cam; },
    step(n = 1) { for (let i = 0; i < n; i++) tick(1 / 60); draw(); },
    ff(sec) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) tick(1 / 60); draw(); },
    launch, startDay, settle,
  };
}
