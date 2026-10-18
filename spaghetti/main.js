import { LEVELS } from './levels.js';
import { Sim, MAT, LOADS, key, memberLen, designCost } from './physics.js';
import * as R from './render.js';
import { Sound } from './sound.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug'), HOLD = Q.has('hold');
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
const snd = new Sound();
const cam = new R.Cam();
const LOAD_IMG = {};
for (const k of Object.keys(LOADS)) LOAD_IMG[k] = R.loadIcon(k);

// ---------- saved progress ----------
const SAVE_KEY = 'spaghetti.v1';
let save = { best: {}, designs: {}, seen: {} };
try { const j = JSON.parse(localStorage.getItem(SAVE_KEY)); if (j) save = { best: {}, designs: {}, seen: {}, ...j }; } catch {}
if (DEMO) save = { best: {}, designs: {}, seen: {} };
function persist() { if (DEMO) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} }
const unlocked = () => { let n = 0; while (n < LEVELS.length && save.best[LEVELS[n].id] != null) n++; return Math.min(LEVELS.length - 1, n); };

// ---------- state ----------
const S = {
  mode: 'title', li: 0, lv: LEVELS[0], members: [], undo: [], tool: 'lasagne',
  sim: null, speed: 1, slow: 0, acc: 0, t: 0, fx: [], shake: 0, creakT: 0,
  drag: null, hover: null, panning: null, pinch: null, pointers: new Map(),
  tut: 0, tested: false, passed: false, coachHidden: false, coachOk: false, resultTimer: 0,
};
let W = 0, H = 0, DPR = 1, base = null;

// ---------- layout ----------
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  fit();
}
function viewRect() {
  const top = DEMO ? 56 : Math.max(60, ($('hud').hidden ? 60 : $('hud').getBoundingClientRect().bottom + 8));
  const coachRoom = TUT[S.lv.id] && !DEMO ? (W < 520 ? 88 : 78) : 0;
  const tray = DEMO ? 70 : (W < 520 ? 86 : 90);
  return { t: top + coachRoom, b: H - tray };
}
function fit() {
  const lv = S.lv, r = viewRect();
  // on tall screens, frame the gap rather than the whole sheet so the squares are big enough for a thumb
  let x0 = -0.8, x1 = lv.w + 0.8;
  if (H > W * 1.2) {
    const ax = lv.anchors.map(a => a[0]);
    x0 = Math.max(x0, Math.min(...ax) - 2.2); x1 = Math.min(x1, Math.max(...ax) + 2.2);
  }
  const ww = x1 - x0, hh = lv.h + 2.0;
  const s = Math.max(8, Math.min((W - 12) / ww, (r.b - r.t) / hh, 70));
  cam.s = s;
  cam.ox = W / 2 - ((x0 + x1) / 2) * s;
  cam.oy = (r.t + r.b) / 2 + ((lv.h - 0.6) / 2) * s;
  base = { s: cam.s, ox: cam.ox, oy: cam.oy };
}
function zoomAt(X, Y, f) {
  const ns = Math.max(base.s * 0.8, Math.min(base.s * 4, cam.s * f));
  const wx = cam.wx(X), wy = cam.wy(Y);
  cam.s = ns; cam.ox = X - wx * ns; cam.oy = Y + wy * ns;
}

// ---------- design helpers ----------
const anchorSet = () => new Set(S.lv.anchors.map(a => key(a[0], a[1])));
const sameEnds = (m, a, b) => (m.a[0] === a[0] && m.a[1] === a[1] && m.b[0] === b[0] && m.b[1] === b[1]) || (m.a[0] === b[0] && m.a[1] === b[1] && m.b[0] === a[0] && m.b[1] === a[1]);
const has = (x1, y1, x2, y2, mat) => S.members.some(m => sameEnds(m, [x1, y1], [x2, y2]) && (!mat || m.mat === mat));
function joints() {
  const set = new Map();
  for (const [x, y] of S.lv.anchors) set.set(key(x, y), [x, y]);
  for (const m of S.members) for (const p of [m.a, m.b]) set.set(key(p[0], p[1]), p);
  return [...set.values()];
}
function validPoint(x, y) {
  const lv = S.lv;
  if (x < 0 || x > lv.w || y < 0 || y > lv.h) return false;
  for (const b of lv.boxes) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return false;
  return true;
}
function roadConnected() {
  const [a, b] = S.lv.anchors;
  const start = key(a[0], a[1]), goal = key(b[0], b[1]);
  const adj = new Map();
  for (const m of S.members) if (m.mat === 'lasagne') {
    const ka = key(...m.a), kb = key(...m.b);
    (adj.get(ka) || adj.set(ka, []).get(ka)).push(kb);
    (adj.get(kb) || adj.set(kb, []).get(kb)).push(ka);
  }
  const seen = new Set([start]), q = [start];
  while (q.length) { const k = q.shift(); if (k === goal) return true; for (const n of adj.get(k) || []) if (!seen.has(n)) { seen.add(n); q.push(n); } }
  return false;
}
const cost = () => designCost(S.members);
function pushUndo() { S.undo.push(JSON.stringify(S.members)); if (S.undo.length > 200) S.undo.shift(); }
function changed() { save.designs[S.lv.id] = S.members; persist(); updateHud(); }

// ---------- levels ----------
function loadLevel(i) {
  S.li = i; S.lv = LEVELS[i];
  S.members = JSON.parse(JSON.stringify(save.designs[S.lv.id] || []));
  S.undo = []; S.sim = null; S.fx = []; S.drag = null;
  S.tut = 0; S.tested = false; S.passed = save.best[S.lv.id] != null; S.coachHidden = false; S.coachOk = false;
  if (!S.members.length) S.tool = 'lasagne';
  setMode('build');
  fit();
  updateHud(); updateTools();
  save.seen[S.lv.id] = 1; persist();
}

function setMode(m) {
  S.mode = m;
  const playing = m === 'build' || m === 'test' || m === 'result';
  $('hud').hidden = !playing;
  $('tray').hidden = m !== 'build';
  $('runbar').hidden = m !== 'test';
  $('vtitle').hidden = m !== 'title';
  $('vpick').hidden = m !== 'pick';
  $('vresult').hidden = m !== 'result';
  if (m !== 'test') banner(null);
  updateCoach();
}

function updateHud() {
  const lv = S.lv, c = cost();
  $('pk').textContent = `Project ${S.li + 1} of ${LEVELS.length}`;
  $('pn').textContent = lv.name;
  $('grams').textContent = `${Math.round(c)} / ${lv.budget} g`;
  $('fill').style.width = Math.min(100, c / lv.budget * 100) + '%';
  $('box').classList.toggle('over', c > lv.budget + 1e-6);
  const t1 = $('t1'), t2 = $('t2');
  t1.style.left = lv.ribbons[0] / lv.budget * 100 + '%'; t1.style.background = 'var(--blue)';
  t2.style.left = lv.ribbons[1] / lv.budget * 100 + '%'; t2.style.background = 'var(--red)';
  const tb = $('test');
  const over = c > lv.budget + 1e-6;
  tb.disabled = over || !S.members.length;
  tb.innerHTML = over ? 'TEST<small>over budget</small>' : 'TEST<small>it!</small>';
}

function updateTools() {
  document.querySelectorAll('.tool[data-tool]').forEach(b => b.classList.toggle('sel', b.dataset.tool === S.tool));
}

// ---------- testing ----------
function startTest() {
  if (S.mode !== 'build' || !S.members.length || cost() > S.lv.budget + 1e-6) return;
  snd.unlock(); snd.click();
  S.sim = new Sim(S.lv, S.members);
  S.speed = 1; S.slow = 0; S.acc = 0; S.fx = []; S.firstSnapSeen = false;
  S.tested = true; S.resultTimer = 0; S.drag = null;
  $('bfast').textContent = '▶▶ faster';
  const qd = $('queue');
  qd.innerHTML = '<span>judges:</span>' + S.lv.loads.map((k, i) => `<img data-i="${i}" src="${LOAD_IMG[k]}" alt="${LOADS[k].name}">`).join('');
  setMode('test');
}

function stopTest() {
  S.sim = null; S.fx = [];
  setMode('build');
}

function handleEvents() {
  const sim = S.sim;
  while (sim.events.length) {
    const e = sim.events.shift();
    if (e.type === 'start') {
      const i = sim.loads.length - 1;
      banner(`Judge ${i + 1} of ${S.lv.loads.length}`, e.load.def.name);
      snd.bell(i);
      document.querySelectorAll('#queue img').forEach((im, j) => { im.classList.toggle('now', j === i); im.classList.toggle('ok', j < i); });
    } else if (e.type === 'finish') {
      snd.through();
      banner(null);
    } else if (e.type === 'snap') {
      snd.snap(e.mat);
      crumbs(e.x, e.y, e.mat);
      S.shake = Math.min(1, S.shake + 0.5);
      if (!S.firstSnapSeen) { S.firstSnapSeen = true; S.slow = 0.7; }
    } else if (e.type === 'pass') {
      document.querySelectorAll('#queue img').forEach(im => { im.classList.remove('now'); im.classList.add('ok'); });
      snd.applause();
      S.resultTimer = 1.3;
    } else if (e.type === 'fail') {
      banner(e.why === 'stuck' ? 'Stuck!' : 'Splat!', e.load.def.name);
      setTimeout(() => snd.fail(), 250);
      S.resultTimer = 2.2;
    }
  }
}

function crumbs(x, y, mat) {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 4;
    S.fx.push({ k: 'crumb', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 2, life: 0.8 + Math.random() * 0.6, rot: Math.random() * 6, sz: mat === 'spaghetti' ? 0.06 : 0.1 });
  }
  S.fx.push({ k: 'word', x, y: y + 0.4, life: 0.9, txt: ['SNAP!', 'CRACK!', 'CRUNCH!'][Math.floor(Math.random() * 3)] });
}

// ---------- results ----------
function ribbonTier(c) { const r = S.lv.ribbons; return c <= r[0] + 1e-6 ? 1 : c <= r[1] + 1e-6 ? 2 : 3; }
const TIER = { 1: ['First prize', '#2f6fbf', '1st'], 2: ['Second prize', '#e14b3b', '2nd'], 3: ['Third prize', '#f4c534', '3rd'] };
function ribbonSVG(tier, dull) {
  const [, col, lab] = TIER[tier];
  const c = dull ? '#d8cfbf' : col, tx = tier === 3 && !dull ? '#2b2623' : '#fff';
  let pts = '';
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, r = i % 2 ? 26 : 31; pts += `${39 + Math.cos(a) * r},${36 + Math.sin(a) * r} `; }
  return `<path d="M24 52 L14 96 L26 88 L33 99 L38 56Z" fill="${c}" opacity=".85"/><path d="M54 52 L64 96 L52 88 L45 99 L40 56Z" fill="${c}" opacity=".85"/>
    <polygon points="${pts}" fill="${c}"/><circle cx="39" cy="36" r="21" fill="#fbf8ee"/><circle cx="39" cy="36" r="17" fill="${c}"/>
    <text x="39" y="44" text-anchor="middle" font-family="Londrina Solid, sans-serif" font-weight="900" font-size="22" fill="${tx}">${dull ? '?' : lab}</text>`;
}

const TIPS = {
  'spaghetti-compression': 'A strand of <b>spaghetti</b> got squashed and snapped. Spaghetti is brilliant when it’s <i>pulled</i> and hopeless when it’s <i>pushed</i>. Flip it so it hangs, or swap in rigatoni. Short strands squash better than long ones.',
  'spaghetti-tension': 'Even spaghetti has limits. Share the pull between more strands, or hang them more steeply.',
  'rigatoni-compression': 'The <b>rigatoni</b> got crushed. Use more props, or let a few spaghetti strands take some of the weight.',
  'rigatoni-tension': 'The <b>rigatoni</b> was pulled apart. Spaghetti does pulling better, and it’s cheaper.',
  'lasagne-compression': 'A <b>lasagne</b> sheet buckled. The road needs holding up more often: try a prop or a hanger under every joint.',
  'lasagne-tension': 'A <b>lasagne</b> sheet tore. The road needs holding up more often: try a prop or a hanger under every joint.',
};
function failTip(sim) {
  if (sim.failWhy === 'stuck') return `The ${sim.failLoad.def.name.toLowerCase()} got stuck. Is there a lump or a steep bit in the road? Keep the lasagne smooth.`;
  if (!roadConnected()) return 'There’s a gap in the road. The judges only drive on <b>lasagne</b>, so it has to run all the way from pin to pin.';
  if (sim.firstBreak) return TIPS[sim.firstBreak.mat + '-' + sim.firstBreak.mode];
  return 'Nothing snapped, it just folded up. Squares wobble but triangles don’t, so brace each box corner to corner.';
}

function showResult() {
  const sim = S.sim, lv = S.lv, ok = sim.result === 'pass', c = cost();
  const rows = lv.loads.map((k, i) => {
    const L = sim.loads[i];
    const st = !L ? '<span class="small">didn’t get a go</span>' : L.state === 'done' ? '<span class="ok">✓ across</span>' : `<span class="no">✗ ${L.state === 'stuck' ? 'stuck' : 'fell'}</span>`;
    return `<div><span><img src="${LOAD_IMG[k]}" alt="">${LOADS[k].name}</span>${st}</div>`;
  });
  rows.push(`<div><span>Pasta used</span><span>${Math.round(c)} g of ${lv.budget} g</span></div>`);
  $('rtip').hidden = true;
  let btns = '';
  if (ok) {
    const tier = ribbonTier(c);
    const prev = save.best[lv.id];
    const better = prev == null || c < prev - 1e-6;
    if (better) save.best[lv.id] = Math.round(c * 10) / 10;
    persist();
    S.passed = true;
    $('rh').textContent = ['', 'First prize!', 'Second prize!', 'Third prize!'][tier];
    $('rstrip').style.background = TIER[tier][1];
    $('rrib').innerHTML = ribbonSVG(tier);
    if (tier > 1) {
      const need = lv.ribbons[tier - 2];
      rows.push(`<div><span class="small">${TIER[tier - 1][0]} needs</span><span class="small">${need} g or less</span></div>`);
    }
    if (prev != null && !better) rows.push(`<div><span class="small">Your best</span><span class="small">${Math.round(prev)} g</span></div>`);
    const last = S.li === LEVELS.length - 1;
    if (last && tier) { $('rtip').hidden = false; $('rtip').innerHTML = 'That’s every project at the Room 14 science fair. The head teacher wants her bowling ball back. Can you win first prize on all eight?'; }
    btns = (last ? '<button class="btn" id="rnext">All projects</button>' : '<button class="btn" id="rnext">Next project</button>') +
      `<button class="btn alt" id="rback">${tier > 1 ? 'Make it lighter' : 'Back to the bridge'}</button>`;
    setTimeout(() => snd.ribbon(), 150);
  } else {
    $('rh').textContent = 'It didn’t hold';
    $('rstrip').style.background = 'var(--ink)';
    $('rrib').innerHTML = ribbonSVG(3, true);
    $('rtip').hidden = false; $('rtip').innerHTML = failTip(sim);
    btns = '<button class="btn" id="rback">Back to building</button><button class="btn alt" id="ragain" style="flex:0 0 auto">Watch again</button>';
  }
  $('rscore').innerHTML = rows.join('');
  $('rrow').innerHTML = btns;
  setMode('result');
  const nx = $('rnext'), bk = $('rback'), ag = $('ragain');
  if (nx) nx.onclick = () => { snd.click(); if (S.li === LEVELS.length - 1) openPicker(); else loadLevel(S.li + 1); };
  if (bk) bk.onclick = () => { snd.click(); stopTest(); };
  if (ag) ag.onclick = () => { snd.click(); setMode('build'); startTest(); };
}

// ---------- the coach (tutorial) ----------
const L = 'lasagne', SP = 'spaghetti', RG = 'rigatoni';
const TUT = {
  gap: [
    { text: 'Welcome to the science fair! The judges want to roll a toy car from this desk to that one. First, tap <b>Lasagne</b> in the pasta box. It’s the only pasta the car can drive on.', hl: '[data-tool=lasagne]', done: () => S.tool === 'lasagne' && S.mode === 'build' || S.members.length > 0 },
    { text: 'Now drag from one <b>red pin</b> to the other to glue a sheet across the gap.', ghost: [[5, 5, 8, 5, L]], done: () => has(5, 5, 8, 5, L) || roadConnected() },
    { text: 'That’s a bridge! Press <b>TEST</b> and let the judges try it.', hl: '#test', done: () => S.tested },
    { text: 'If the car makes it past the chequered flag, you get a ribbon.', mode: 'test', done: () => S.mode !== 'test' },
  ],
  half: [
    { text: 'This gap is 6 squares and a lasagne sheet only stretches 3. Lay <b>two sheets</b> that meet in the middle. Drag from a pin to the middle, then from that blob of glue to the other pin.', ghost: [[4, 5, 7, 5, L], [7, 5, 10, 5, L]], done: () => roadConnected() },
    { text: 'Go on, <b>test</b> it. I have a feeling about this one…', hl: '#test', done: () => S.tested },
    { text: 'A glue joint in mid-air just folds. Hang a <b>V of spaghetti</b> under the road: drag from the left pin down to the dot, then on to the right pin. Then prop the middle up with a stub of <b>rigatoni</b>.', mode: 'build',
      ghost: [[4, 5, 7, 4, SP], [7, 4, 10, 5, SP], [7, 4, 7, 5, RG]], done: () => S.passed || (has(4, 5, 7, 4) && has(7, 4, 10, 5) && has(7, 4, 7, 5)) },
    { text: 'The spaghetti <b>pulls</b> and the rigatoni <b>pushes</b>. Test it again!', hl: '#test', done: () => S.mode === 'test' || S.passed },
    { text: 'Watch the colours: pasta goes <b>red</b> just before it snaps.', mode: 'test', done: () => S.mode !== 'test' },
  ],
  shelf: [
    { text: 'Spaghetti is strongest when it’s <b>pulled</b>. See the shelf? Lay a road across, then hang it from the shelf pins like a swing.',
      ghost: [[3, 5, 5, 5, L], [5, 5, 7, 5, L], [7, 5, 9, 5, L], [9, 5, 11, 5, L], [5, 8, 5, 5, SP], [7, 8, 7, 5, SP], [9, 8, 9, 5, SP]], done: () => S.tested },
    { text: 'Two judges this time. The textbooks are heavy.', mode: 'test', done: () => S.mode !== 'test' },
    { text: 'Tip: the ticks on the pasta meter, top right, are the first and second prize lines. Lighter bridges win better ribbons. Tap a piece with the <b>eraser</b> to take it out.', mode: 'build', go: true, done: () => S.coachOk },
  ],
};

function currentStep() {
  const steps = TUT[S.lv.id];
  if (!steps || DEMO) return null;
  while (S.tut < steps.length && steps[S.tut].done()) { S.tut++; S.coachOk = false; }
  return steps[S.tut] || null;
}

let coachShown = null;
function updateCoach() {
  const st = (S.mode === 'build' || S.mode === 'test') && !S.coachHidden ? currentStep() : null;
  const show = st && (!st.mode || st.mode === S.mode) ? st : null;
  document.querySelectorAll('.pulse').forEach(e => e.classList.remove('pulse'));
  if (show && show.hl && S.mode === 'build') document.querySelector(show.hl)?.classList.add('pulse');
  if (show === coachShown) return;
  coachShown = show;
  $('coach').classList.toggle('off', !show);
  if (show) { $('coacht').innerHTML = show.text; $('coachgo').hidden = !show.go; }
}

// ---------- input ----------
function evPos(e) { const r = cv.getBoundingClientRect(); return { X: e.clientX - r.left, Y: e.clientY - r.top }; }
const pickR = () => Math.max(0.45, 24 / cam.s);

function nearestJoint(wx, wy, r = pickR()) {
  let best = null, bd = r;
  for (const p of joints()) { const d = Math.hypot(p[0] - wx, p[1] - wy); if (d < bd) { bd = d; best = p; } }
  return best;
}
function dragEnd(a, wx, wy, mat) {
  const max = MAT[mat].max + 1e-6;
  let best = null, bd = Infinity;
  for (let x = Math.ceil(a[0] - max); x <= a[0] + max; x++) for (let y = Math.ceil(a[1] - max); y <= a[1] + max; y++) {
    if (x === a[0] && y === a[1]) continue;
    if (Math.hypot(x - a[0], y - a[1]) > max || !validPoint(x, y)) continue;
    const d = Math.hypot(x - wx, y - wy);
    if (d < bd) { bd = d; best = [x, y]; }
  }
  return best;
}
function memberAt(wx, wy) {
  let best = -1, bd = Math.max(0.28, 16 / cam.s);
  S.members.forEach((m, i) => {
    const ax = m.a[0], ay = m.a[1], ex = m.b[0] - ax, ey = m.b[1] - ay, ll = ex * ex + ey * ey;
    const t = Math.max(0, Math.min(1, ((wx - ax) * ex + (wy - ay) * ey) / ll));
    const d = Math.hypot(ax + ex * t - wx, ay + ey * t - wy);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
function eraseAt(wx, wy) {
  const i = memberAt(wx, wy);
  if (i < 0) return false;
  pushUndo(); S.members.splice(i, 1); snd.erase(); changed();
  return true;
}

cv.addEventListener('pointerdown', e => {
  snd.unlock();
  if (S.mode !== 'build' && S.mode !== 'test') return;
  cv.setPointerCapture?.(e.pointerId);
  const p = evPos(e);
  S.pointers.set(e.pointerId, p);
  if (S.pointers.size === 2) {
    // two fingers: pinch and pan, and forget any half-made piece
    S.drag = null; S.panning = null;
    const [a, b] = [...S.pointers.values()];
    S.pinch = { d: Math.hypot(a.X - b.X, a.Y - b.Y) || 1, mx: (a.X + b.X) / 2, my: (a.Y + b.Y) / 2, s: cam.s, ox: cam.ox, oy: cam.oy };
    return;
  }
  if (S.pointers.size > 2) return;
  const wx = cam.wx(p.X), wy = cam.wy(p.Y);
  if (e.button === 1 || e.button === 2 || S.mode === 'test') { S.panning = { X: p.X, Y: p.Y, ox: cam.ox, oy: cam.oy, moved: 0 }; return; }
  if (S.tool === 'erase') { S.erasing = true; eraseAt(wx, wy); return; }
  const j = nearestJoint(wx, wy);
  if (j) { S.drag = { a: j, b: null, X: p.X, Y: p.Y }; S.drag.b = dragEnd(j, wx, wy, S.tool); }
  else S.panning = { X: p.X, Y: p.Y, ox: cam.ox, oy: cam.oy, moved: 0, tap: true };
});

cv.addEventListener('pointermove', e => {
  const p = evPos(e);
  if (S.pointers.has(e.pointerId)) S.pointers.set(e.pointerId, p);
  const wx = cam.wx(p.X), wy = cam.wy(p.Y);
  if (S.pinch && S.pointers.size >= 2) {
    const [a, b] = [...S.pointers.values()];
    const d = Math.hypot(a.X - b.X, a.Y - b.Y) || 1, mx = (a.X + b.X) / 2, my = (a.Y + b.Y) / 2;
    const P = S.pinch;
    const ns = Math.max(base.s * 0.8, Math.min(base.s * 4, P.s * d / P.d));
    const wx0 = (P.mx - P.ox) / P.s, wy0 = (P.oy - P.my) / P.s;
    cam.s = ns; cam.ox = mx - wx0 * ns; cam.oy = my + wy0 * ns;
    return;
  }
  if (S.panning && S.pointers.has(e.pointerId)) {
    const P = S.panning;
    P.moved = Math.max(P.moved, Math.hypot(p.X - P.X, p.Y - P.Y));
    if (P.moved > 6) { cam.ox = P.ox + p.X - P.X; cam.oy = P.oy + p.Y - P.Y; }
    return;
  }
  if (S.erasing && S.pointers.has(e.pointerId)) { eraseAt(wx, wy); return; }
  if (S.drag) { S.drag.b = dragEnd(S.drag.a, wx, wy, S.tool); return; }
  if (e.pointerType === 'mouse' && S.mode === 'build') S.hover = { wx, wy };
});

function endPointer(e) {
  S.pointers.delete(e.pointerId);
  if (S.pinch) { if (S.pointers.size < 2) S.pinch = null; return; }
  if (S.panning) {
    if (S.panning.tap && S.panning.moved < 6 && S.mode === 'build') {
      const p = evPos(e), wx = cam.wx(p.X), wy = cam.wy(p.Y);
      // tapping a piece with a pasta tool swaps it to that pasta
      const i = memberAt(wx, wy);
      if (i >= 0 && S.members[i].mat !== S.tool && memberLen(S.members[i]) <= MAT[S.tool].max + 1e-6) {
        pushUndo(); S.members[i] = { ...S.members[i], mat: S.tool }; snd.place(S.tool); changed();
      } else toast('Start from a red pin or a blob of glue');
    }
    S.panning = null; return;
  }
  if (S.erasing) { S.erasing = false; return; }
  const d = S.drag; S.drag = null;
  if (!d || !d.b || e.type === 'pointercancel') return;
  const a = d.a, b = d.b;
  const ex = S.members.findIndex(m => sameEnds(m, a, b));
  if (ex >= 0 && S.members[ex].mat === S.tool) return;
  pushUndo();
  if (ex >= 0) S.members[ex] = { a: [...a], b: [...b], mat: S.tool };
  else S.members.push({ a: [...a], b: [...b], mat: S.tool });
  snd.place(S.tool);
  changed();
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') S.hover = null; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => {
  e.preventDefault();
  if (S.mode !== 'build' && S.mode !== 'test') return;
  const p = evPos(e);
  if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) zoomAt(p.X, p.Y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  else { cam.ox -= e.deltaX; }
}, { passive: false });
cv.addEventListener('dblclick', () => { if (S.mode === 'build' || S.mode === 'test') fit(); });

function undo() {
  if (S.mode !== 'build' || !S.undo.length) return;
  S.members = JSON.parse(S.undo.pop()); snd.erase(); changed();
}

document.querySelectorAll('.tool[data-tool]').forEach(b => b.addEventListener('click', () => {
  snd.unlock(); snd.click();
  S.tool = b.dataset.tool; updateTools();
}));
$('bundo').onclick = () => { snd.unlock(); undo(); };
$('test').onclick = () => startTest();
$('bstop').onclick = () => { snd.click(); stopTest(); };
$('bfast').onclick = () => { snd.click(); S.speed = S.speed === 1 ? 2.5 : 1; $('bfast').textContent = S.speed === 1 ? '▶▶ faster' : '▶ normal'; };
$('bmenu').onclick = () => { snd.unlock(); snd.click(); openPicker(); };
$('coachx').onclick = () => { S.coachHidden = true; updateCoach(); };
$('coachgo').onclick = () => { S.coachOk = true; snd.click(); updateCoach(); };
$('bplay').onclick = () => { snd.unlock(); snd.click(); loadLevel(unlocked()); };
$('bprojects').onclick = () => { snd.unlock(); snd.click(); openPicker(); };
$('bpickback').onclick = () => { snd.click(); S.sim = null; setMode(S.from === 'title' ? 'title' : 'build'); };
const soundLabel = () => { $('bsound').textContent = 'Sound: ' + (snd.on ? 'on' : 'off'); };
$('bsound').onclick = () => { snd.unlock(); snd.toggle(); soundLabel(); snd.click(); };
soundLabel();

addEventListener('keydown', e => {
  if (e.repeat && !/^[zZ]$/.test(e.key)) return;
  const k = e.key;
  if ((e.metaKey || e.ctrlKey) && (k === 'z' || k === 'Z')) { e.preventDefault(); undo(); return; }
  if (S.mode === 'build') {
    if (k === '1') S.tool = 'spaghetti'; else if (k === '2') S.tool = 'rigatoni'; else if (k === '3') S.tool = 'lasagne';
    else if (k === '4' || k === 'e' || k === 'E') S.tool = 'erase';
    else if (k === 'u' || k === 'U' || k === 'Backspace') undo();
    else if (k === 'Enter' || k === ' ' || k === 't' || k === 'T') { e.preventDefault(); startTest(); }
    else if (k === 'f' || k === 'F' || k === '0') fit();
    else if (k === '=' || k === '+') zoomAt(W / 2, H / 2, 1.2);
    else if (k === '-') zoomAt(W / 2, H / 2, 1 / 1.2);
    updateTools();
  } else if (S.mode === 'test') {
    if (k === 'Escape' || k === 'Backspace') stopTest();
    else if (k === 'f' || k === 'F') $('bfast').click();
  } else if (S.mode === 'result') {
    if (k === 'Enter' || k === ' ') { e.preventDefault(); ($('rnext') || $('rback'))?.click(); }
    else if (k === 'Escape' || k === 'Backspace') $('rback')?.click();
  }
});

let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('off'); toastT = 1.8; }
function banner(k, t) {
  const b = $('banner');
  if (!k) { b.classList.add('off'); return; }
  $('bk').textContent = k; $('bt').textContent = t; b.classList.remove('off');
  clearTimeout(banner.t); banner.t = setTimeout(() => b.classList.add('off'), 1600);
}

// ---------- the project picker ----------
function openPicker() {
  S.from = S.mode === 'title' ? 'title' : 'game';
  if (S.sim) { S.sim = null; }
  const un = unlocked();
  $('projs').innerHTML = LEVELS.map((lv, i) => {
    const b = save.best[lv.id];
    const tier = b != null ? (b <= lv.ribbons[0] + 1e-6 ? 1 : b <= lv.ribbons[1] + 1e-6 ? 2 : 3) : 0;
    const rib = tier ? `<svg class="rib" viewBox="0 0 78 100">${ribbonSVG(tier)}</svg>` : `<span class="small">${i <= un ? (b == null ? 'not tried' : '') : 'locked'}</span>`;
    return `<button data-i="${i}" ${i > un ? 'disabled' : ''} class="${i === S.li && S.from === 'game' ? 'cur' : ''}"><b>${i + 1}</b>${lv.name}${b != null ? `<span class="small">${Math.round(b)} g</span>` : ''}${rib}</button>`;
  }).join('');
  $('projs').querySelectorAll('button').forEach(b => b.onclick = () => { snd.click(); loadLevel(+b.dataset.i); });
  setMode('pick');
}

// ---------- drawing ----------
function draw() {
  const lv = S.lv;
  let sx = 0, sy = 0;
  if (S.shake > 0) { sx = (Math.random() - 0.5) * 8 * S.shake; sy = (Math.random() - 0.5) * 8 * S.shake; cam.ox += sx; cam.oy += sy; }
  R.drawBoard(ctx, cam, lv, W, H, DPR);
  R.drawFurniture(ctx, cam, lv, DPR);
  R.drawFlags(ctx, cam, lv, DPR);
  const AS = anchorSet();
  if (S.sim) {
    R.drawSim(ctx, cam, S.sim, DPR);
    R.drawPins(ctx, cam, lv, DPR);
    R.drawLoads(ctx, cam, S.sim, DPR, S.t);
  } else {
    drawGhosts();
    R.drawDesign(ctx, cam, S.members, DPR, { anchors: AS });
    R.drawPins(ctx, cam, lv, DPR);
    if (S.mode === 'build' || S.mode === 'pick' || S.mode === 'title') {
      const k = lv.loads[0];
      R.drawLoadAt(ctx, cam, DPR, k, lv.spawn[0], lv.spawn[1] + LOADS[k].r + 0.02, 0, S.t);
    }
    if (S.mode === 'build') drawBuildOverlay();
  }
  drawFx();
  if (S.shake > 0) { cam.ox -= sx; cam.oy -= sy; }
}

function drawGhosts() {
  const st = S.mode === 'build' && !S.coachHidden ? currentStep() : null;
  if (!st || !st.ghost || (st.mode && st.mode !== 'build')) return;
  cam.world(ctx, DPR);
  const pulse = 0.35 + 0.25 * Math.sin(S.t * 5);
  for (const [x1, y1, x2, y2, mat] of st.ghost) {
    if (has(x1, y1, x2, y2, mat)) continue;
    R.drawPasta(ctx, mat, x1, y1, x2, y2, { alpha: pulse });
    ctx.save();
    ctx.setLineDash([0.18, 0.14]); ctx.lineDashOffset = -S.t * 0.8;
    ctx.strokeStyle = '#2f6fbf'; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
    // a dot travelling the way to drag
    const k = (S.t * 0.6) % 1;
    ctx.fillStyle = '#2f6fbf';
    ctx.beginPath(); ctx.arc(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 0.12, 0, 7); ctx.fill();
    for (const [x, y] of [[x1, y1], [x2, y2]]) { ctx.strokeStyle = '#2f6fbf'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(x, y, 0.28, 0, 7); ctx.stroke(); }
  }
}

function drawBuildOverlay() {
  cam.world(ctx, DPR);
  const d = S.drag;
  if (d) {
    const mat = MAT[S.tool];
    // reach of this pasta
    ctx.save();
    ctx.setLineDash([0.12, 0.12]); ctx.strokeStyle = 'rgba(47,111,191,.5)'; ctx.lineWidth = 0.04;
    ctx.beginPath(); ctx.arc(d.a[0], d.a[1], mat.max, 0, 7); ctx.stroke();
    ctx.restore();
    if (d.b) {
      R.drawPasta(ctx, S.tool, d.a[0], d.a[1], d.b[0], d.b[1], { alpha: 0.75 });
      ctx.strokeStyle = '#2f6fbf'; ctx.lineWidth = 0.06;
      ctx.beginPath(); ctx.arc(d.b[0], d.b[1], 0.3, 0, 7); ctx.stroke();
      // grams label, in screen space, nudged above the finger
      const len = Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]);
      const X = cam.X((d.a[0] + d.b[0]) / 2), Y = cam.Y(Math.max(d.a[1], d.b[1])) - 22;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.font = '18px "Patrick Hand", sans-serif'; ctx.textAlign = 'center';
      const txt = `${(len * mat.cost).toFixed(1)} g`;
      const tw = ctx.measureText(txt).width + 12;
      ctx.fillStyle = 'rgba(251,248,238,.92)'; ctx.fillRect(X - tw / 2, Y - 17, tw, 22);
      ctx.fillStyle = '#2b2623'; ctx.fillText(txt, X, Y);
    }
    cam.world(ctx, DPR);
    ctx.strokeStyle = '#2f6fbf'; ctx.lineWidth = 0.06;
    ctx.beginPath(); ctx.arc(d.a[0], d.a[1], 0.3, 0, 7); ctx.stroke();
  } else if (S.hover) {
    if (S.tool === 'erase') {
      const i = memberAt(S.hover.wx, S.hover.wy);
      if (i >= 0) { const m = S.members[i]; ctx.strokeStyle = 'rgba(225,75,59,.6)'; ctx.lineWidth = 0.32; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(m.a[0], m.a[1]); ctx.lineTo(m.b[0], m.b[1]); ctx.stroke(); }
    } else {
      const j = nearestJoint(S.hover.wx, S.hover.wy);
      if (j) { ctx.strokeStyle = 'rgba(47,111,191,.8)'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(j[0], j[1], 0.3, 0, 7); ctx.stroke(); cv.style.cursor = 'crosshair'; }
      else cv.style.cursor = 'grab';
    }
  }
}

function drawFx() {
  for (const f of S.fx) {
    if (f.k === 'crumb') {
      cam.world(ctx, DPR);
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = R.COL.pasta; ctx.fillRect(-f.sz, -f.sz / 2, f.sz * 2, f.sz);
      ctx.restore();
    } else if (f.k === 'word') {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const X = cam.X(f.x), Y = cam.Y(f.y) - (0.9 - f.life) * 40;
      ctx.save(); ctx.translate(X, Y); ctx.rotate(-0.12);
      ctx.globalAlpha = Math.min(1, f.life * 3);
      ctx.font = `900 ${Math.round(Math.max(20, cam.s * 0.7))}px "Londrina Solid", sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = '#fbf8ee'; ctx.strokeText(f.txt, 0, 0);
      ctx.fillStyle = R.COL.red; ctx.fillText(f.txt, 0, 0);
      ctx.restore();
    }
  }
}

// ---------- loop ----------
function tick(dt) {
  S.t += dt;
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').classList.add('off');
  S.shake = Math.max(0, S.shake - dt * 2.5);
  if (S.sim && (S.mode === 'test' || S.mode === 'result')) {
    const scale = S.speed * (S.slow > 0 ? 0.3 : 1);
    S.slow -= dt;
    S.acc += dt * scale;
    let n = 0;
    while (S.acc >= 1 / 60 && n < 8) { S.sim.step(1 / 60); S.acc -= 1 / 60; n++; handleEvents(); }
    if (n === 8) S.acc = 0;
    // creaks when something is close to going
    S.creakT -= dt;
    if (S.creakT <= 0 && !S.sim.result) {
      let mx = 0;
      for (const c of S.sim.cs) if (c.mat && !c.debris && !c.broken) mx = Math.max(mx, S.sim.stress(c));
      if (mx > 0.75) { snd.creak(Math.min(1, (mx - 0.75) * 4)); S.creakT = 0.35 + Math.random() * 0.3; }
    }
    if (S.resultTimer > 0 && S.mode === 'test') { S.resultTimer -= dt; if (S.resultTimer <= 0 && !DEMO) showResult(); }
  }
  for (const f of S.fx) {
    f.life -= dt;
    if (f.k === 'crumb') { f.vy -= 20 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += dt * 8; if (f.y < 0.05) { f.y = 0.05; f.vy *= -0.3; f.vx *= 0.6; } }
  }
  S.fx = S.fx.filter(f => f.life > 0);
  if (S.mode === 'build' || S.mode === 'test') updateCoach();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  try { if (!HOLD) tick(dt); draw(); } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}

// ---------- boot ----------
$('tp1').src = R.pastaIcon('spaghetti', 168, 64); $('tp2').src = R.pastaIcon('rigatoni', 168, 64); $('tp3').src = R.pastaIcon('lasagne', 168, 64);
document.querySelectorAll('.tool[data-tool]').forEach(b => { const im = b.querySelector('img'); if (im) im.src = R.pastaIcon(b.dataset.tool, 132, 52); });
addEventListener('resize', resize);
resize();

if (DEMO) {
  const i = Math.min(LEVELS.length - 1, +(Q.get('level') || 8) - 1);
  S.li = i; S.lv = LEVELS[i]; S.members = JSON.parse(JSON.stringify(S.lv.ref));
  setMode('build'); fit(); updateHud();
  $('tray').hidden = true;
  startTest();
  $('runbar').hidden = true;
  // start the shot with the heaviest judge already rolling onto the bridge
  S.sim.queue = S.sim.queue.slice(-1); S.sim.nextLoadAt = 0;
  for (let k = 0; k < 60 * 1.6; k++) { S.sim.step(1 / 60); handleEvents(); }
  banner(null);
} else {
  const bestN = Object.keys(save.best).length;
  $('tbest').textContent = bestN ? `${bestN} of ${LEVELS.length} projects have a ribbon` : '';
  $('bplay').textContent = bestN ? 'Keep building' : 'Start building';
  S.lv = LEVELS[unlocked()];
  fit();
  setMode('title');
}

if (DEBUG || DEMO) window.sb = { S, LEVELS, startTest, stopTest, loadLevel, showResult, tick, draw, cam, fit,
  step(sec) { for (let t = 0; t < sec; t += 1 / 60) tick(1 / 60); draw(); } };

requestAnimationFrame(frame);
window.toyboxReady?.();
