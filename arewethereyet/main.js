// Are We There Yet: the game in the page. Rules live in game.js, pictures in art.js.
import * as G from './game.js';
import * as A from './art.js';
import * as S from './sound.js';
import { TAPES, FIX_NAMES, regionOf } from './data.js';

const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const $ = id => document.getElementById(id);
const IDS = ['dad', 'mom', 'tina', 'kevin', 'jo'];
const mapc = $('mapc'), mx = mapc.getContext('2d');
const carc = $('carc'), cx = carc.getContext('2d');
let dpr = Math.min(2, window.devicePixelRatio || 1);
let s = null;        // game state
let tut = null;      // tutorial step index or null
let narrow = false;
let T = 0;           // seconds since load, for wobbles

// ---------------------------------------------------------------- layout
function layout() {
  const short = innerHeight < 560 && innerWidth > innerHeight * 1.3;
  narrow = !short && (innerWidth < 860 || innerWidth < innerHeight * 1.05);
  document.body.classList.toggle('narrow', narrow);
  document.body.classList.toggle('short', short);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const c of [mapc, carc]) {
    const r = c.getBoundingClientRect();
    c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr));
  }
  mapBase = null;
}
addEventListener('resize', () => { layout(); placeCoach(); });
if (window.ResizeObserver) { const ro = new ResizeObserver(() => layout()); ro.observe($('photo')); ro.observe($('atlas')); }

// ---------------------------------------------------------------- the atlas
let mapBase = null, mapView = { k: 1, ox: 0, oy: 0 }, mapSel = null, mapPan = null;
function mapGeom() {
  const w = mapc.width / dpr, h = mapc.height / dpr;
  // fill the height, but always show at least ~5 columns across
  const k = Math.max(Math.min(w / A.MAP_W, h / A.MAP_H), Math.min(h / A.MAP_H, w / (narrow ? 300 : 560)));
  return { w, h, k };
}
function buildMapBase() {
  const { k } = mapGeom();
  mapBase = document.createElement('canvas');
  mapBase.width = Math.ceil(A.MAP_W * k * dpr); mapBase.height = Math.ceil(A.MAP_H * k * dpr);
  const c = mapBase.getContext('2d'); c.scale(k * dpr, k * dpr);
  A.drawAtlasBase(c, s.map, G.mulberry(s.seed + 7));
  mapBase.k = k;
}
function centerMapOn(col, snap) {
  const { w, h, k } = mapGeom();
  const node = s.map.nodes[s.map.cols[col][0]];
  const want = Math.min(0, Math.max(w - A.MAP_W * k, w * 0.35 - node.x * k));
  mapView.tx = A.MAP_W * k <= w ? (w - A.MAP_W * k) / 2 : want;
  if (snap || mapView.ox == null) mapView.ox = mapView.tx;
  mapView.oy = Math.max(0, (h - A.MAP_H * k) / 2);
}
function edgeCurve(e) {
  const a = s.map.nodes[e.a], b = s.map.nodes[e.b];
  const qx = (a.x + b.x) / 2, qy = (a.y + b.y) / 2 + (e.road === 'scenic' ? 14 : 0) * Math.sign(b.y - a.y + 0.01);
  return u => [(1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * qx + u * u * b.x, (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * qy + u * u * b.y];
}
function renderMap() {
  setText('atlasHint', s.mode === 'stop' && !mapSel && G.node(s).type !== 'grandma' && !G.canLeave(s) ? 'pick a circled town \u2193' : s.mode === 'drive' ? `on the way to ${s.leg.to.town}` : '');
  if (narrow && !document.body.classList.contains('showAtlas')) return;
  if (!mapBase || mapBase.k !== mapGeom().k) { buildMapBase(); centerMapOn(G.node(s).col, true); }
  const { w, h, k } = mapGeom();
  if (!mapPan && mapView.tx != null) mapView.ox += (mapView.tx - mapView.ox) * 0.15;
  const c = mx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#efe3c3'; c.fillRect(0, 0, w, h);
  c.drawImage(mapBase, mapView.ox, mapView.oy, A.MAP_W * k, A.MAP_H * k);
  c.save(); c.translate(mapView.ox, mapView.oy); c.scale(k, k);
  // the route so far, in felt-tip
  const pts = [];
  for (let i = 0; i < s.trail.length; i++) {
    if (i === 0) { const n = s.map.nodes[s.trail[0]]; pts.push([n.x, n.y]); continue; }
    const e = s.map.edges.find(e => e.a === s.trail[i - 1] && e.b === s.trail[i]);
    const f = edgeCurve(e); for (let u = 0.1; u <= 1.001; u += 0.1) pts.push(f(u));
  }
  let here = pts[pts.length - 1] || [0, 0], ang = 0;
  if (s.mode !== 'stop' && s.leg) {
    const f = edgeCurve(s.leg.edge), u = Math.min(1, s.leg.prog / s.leg.dist);
    for (let v = 0.1; v < u; v += 0.1) pts.push(f(v));
    here = f(u); const p2 = f(Math.min(1, u + 0.02)); ang = Math.atan2(p2[1] - here[1], p2[0] - here[0]);
    pts.push(here);
  }
  A.feltLine(c, pts, T);
  // Grandma's, circled
  const g = s.map.nodes[s.map.nodes.length - 1];
  A.feltCircle(c, g.x, g.y, 30, 0.5);
  c.save(); c.font = `26px ${A.HAND}`; c.fillStyle = 'rgba(200,40,40,.9)'; c.textAlign = 'center'; c.translate(g.x - 8, g.y - 48); c.rotate(-0.12); c.fillText('Grandma’s!!', 0, 0); c.restore();
  // where you can go next
  if (s.mode === 'stop' && s.stop && G.node(s).type !== 'grandma') {
    for (const e of G.nextEdges(s)) {
      const n = s.map.nodes[e.b];
      A.feltCircle(c, n.x, n.y, mapSel === e ? 22 : 16 + Math.sin(T * 4) * 2, T * 2, mapSel === e ? 'rgba(29,106,71,.95)' : 'rgba(29,106,71,.6)');
    }
    if (mapSel) { const f = edgeCurve(mapSel); const p = []; for (let u = 0; u <= 1.001; u += 0.1) p.push(f(u)); A.feltLine(c, p, T, 'rgba(29,106,71,.5)', 4); }
  }
  A.tinyWagon(c, here[0], here[1] - 1, 26, ang);
  c.restore();
}

function mapPointer() {
  let down = null;
  mapc.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, ox: mapView.ox, moved: false }; mapc.setPointerCapture(e.pointerId); });
  mapc.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 8 || Math.abs(e.clientY - down.y) > 8) down.moved = true;
    const { w, k } = mapGeom();
    if (down.moved && A.MAP_W * k > w) { mapPan = true; mapView.ox = Math.min(0, Math.max(w - A.MAP_W * k, down.ox + dx)); mapView.tx = mapView.ox; }
  });
  mapc.addEventListener('pointerup', e => {
    if (!down) return; const was = down; down = null; mapPan = null;
    if (was.moved) return;
    const r = mapc.getBoundingClientRect(), { k } = mapGeom();
    const x = (e.clientX - r.left - mapView.ox) / k, y = (e.clientY - r.top - mapView.oy) / k;
    let best = null, bd = 30 / k;
    if (s.mode === 'stop') for (const ed of G.nextEdges(s)) { const n = s.map.nodes[ed.b], d = Math.hypot(n.x - x, n.y - y); if (d < Math.max(bd, 26)) { bd = d; best = ed; } }
    selectEdge(best);
  });
}

function selectEdge(e) {
  mapSel = e;
  const box = $('mapInfo');
  if (!e) { box.hidden = true; return; }
  S.play('page');
  const n = s.map.nodes[e.b];
  const what = {
    gas: () => `${n.place}. Gas, snacks and a garage.`, diner: () => `${n.place}. Food for everybody, coffee for the driver.`,
    attraction: () => `${n.place}! $${n.sight.price * 2} for the family.`, motel: () => `${n.place}: $${n.motel.price} a night. ${n.motel.note}`,
    event: () => 'Nothing on the map but a dot. Who knows?', summit: () => 'Sawtooth Pass, 9,240 ft. Steep. Hope the radiator holds.', grandma: () => 'GRANDMA’S HOUSE. Cake at 7 PM, Sunday (day 4).',
  }[n.type]();
  const sp = (G.driverOf(s)?.speed || 1) * (e.road === 'interstate' ? 1.1 : 0.85);
  const hrs = G.TUNE.legHours / sp;
  const eta = G.fmtClock(s.clock + hrs);
  const road = e.road === 'interstate' ? `Interstate ${e.num}: fast, flat and boring.` : `Route ${e.num}: slow, scenic, nobody gets bored.`;
  const why = G.canLeave(s);
  box.innerHTML = `<h3>${n.town}</h3><p>${what}</p><p>${road} About ${hrs.toFixed(1)} hrs, there by ${eta}.</p>`
    + (why ? `<p class="hand">${why}</p>` : '')
    + `<div class="btns"><button class="sign" id="driveBtn" ${why ? 'disabled' : ''}>Drive to ${n.town} <span class="arr">&#x2192;</span></button></div>`;
  box.hidden = false;
  $('driveBtn').onclick = () => go(e);
}

function go(e) {
  const why = G.startLeg(s, e);
  if (why) { toast(why, 'bad'); return; }
  mapSel = null; $('mapInfo').hidden = true;
  document.body.classList.remove('showAtlas');
  newLegScenery();
  renderCard();
  centerMapOn(e && s.map.nodes[e.b].col);
  tutEvent('drive');
}

// ---------------------------------------------------------------- the car view
let scroll = 0, props = [], traffic = [], propRegion = -1;
function newLegScenery() {
  const col = s.leg ? s.leg.to.col : G.node(s).col;
  const reg = regionOf(col);
  if (reg !== propRegion) { props = A.makeProps(reg, G.mulberry(col * 31 + s.seed)); propRegion = reg; }
}

function carGeom() {
  const w = carc.width / dpr, h = carc.height / dpr;
  if (s.mode === 'breakdown') return { w, h };
  const unseated = Object.values(s.people).some(p => !p.seat);
  const k = Math.min((h - 24) / A.CAR_H, (w * (unseated ? 0.5 : 0.62)) / A.CAR_W);
  const cw = A.CAR_W * k;
  const road = s.leg ? s.leg.road : 'interstate';
  const rw = Math.min(cw * (road === 'interstate' ? 2.3 : 1.7), w * 0.9);
  const rcx = unseated ? w * 0.6 : w / 2;
  const carX = rcx + (road === 'interstate' ? rw * 0.2 : rw * 0.18) - cw / 2 - (unseated ? 0 : 0);
  const ox = Math.min(w - cw - 6, Math.max(6, carX)), oy = (h - A.CAR_H * k) / 2;
  return { w, h, k, ox, oy, rw, rcx };
}
function seatScreen(g, seat) { const [x, y] = A.SEAT_POS[seat]; return [g.ox + x * g.k, g.oy + y * g.k]; }
function lineupPos(g, i) { const r = A.HEAD_R * g.k; return [Math.max(r * 1.5, g.ox - r * 2.6), g.oy + (40 + i * 38) * g.k]; }

const BUBBLE = { fight: 'MOM!!', 'pee!': 'GOTTA PEE!!', pee: 'gotta pee', hangry: 'I’M STARVING', hungry: 'I’m hungry', arewe: 'are we there yet?', bored: 'so bored…', sleepy: '*yawn*' };
const BAD = new Set(['fight', 'pee!', 'hangry', 'arewe']);
function moodOf(p) {
  const cs = G.complaints(s, p);
  if (s.mode === 'end') return 'happy';
  if (cs.includes('fight')) return 'yell';
  if (s.smell > 0) return 'green';
  if (cs.some(c => BAD.has(c))) return 'cross';
  if (cs.length) return 'meh';
  if (G.likes(p, s.tapeId)) return 'happy';
  if (p.seat === 'drive' && p.fatigue > 0.55) return 'meh';
  return s.morale > 55 ? 'happy' : s.morale > 25 ? 'ok' : 'meh';
}

function renderCar(dt) {
  const c = cx, g = carGeom();
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (s.mode === 'breakdown') { renderBay(c, g); A.photoFinish(c, g.w, g.h, T); return; }
  const L = s.leg, moving = s.mode === 'drive' && L && !(L.pulled > 0) && !s.paused;
  const col = L ? L.to.col : G.node(s).col;
  const road = L ? L.road : 'interstate';
  const pxs = (road === 'interstate' ? 520 : 380) * (g.k / 2.6);
  if (moving) scroll += pxs * dt;
  // traffic
  if (moving && Math.random() < dt * (road === 'interstate' ? 0.45 : 0.3)) traffic.push({ lane: road === 'interstate' ? -0.22 : -0.25, y: -120, v: road === 'interstate' ? pxs * 0.35 : pxs * 1.6, dir: road === 'interstate' ? 1 : -1, color: ['#8a2a2a', '#2a4a7a', '#e2dccb', '#4a6a3a', '#c9a23a'][Math.floor(Math.random() * 5)] });
  for (const tr of traffic) if (moving || tr.dir < 0) tr.y += tr.v * dt * (moving ? 1 : 0);
  traffic = traffic.filter(tr => tr.y < g.h + 200);
  A.drawRoad(c, g.w, g.h, scroll, regionOf(col), road, T, props, { rw: g.rw, cx: g.rcx, traffic });
  if (s.mode === 'stop' || s.mode === 'end') A.drawPlace(c, g.w, g.h, g.rcx, g.rw, G.node(s).type, G.node(s).place, T);
  c.save();
  c.translate(g.ox, g.oy);
  if (L && L.shake > 0) c.translate(Math.sin(T * 60) * 6 * L.shake, 0), c.rotate(Math.sin(T * 30) * 0.03 * L.shake);
  if (moving) c.translate(Math.sin(T * 13) * 0.6, Math.sin(T * 17) * 0.5);
  c.scale(g.k, g.k);
  A.drawCar(c, T, { snacks: s.snacks });
  // seat targets while dragging
  if (drag && drag.kind === 'seat') {
    for (const seat of G.SEATS) {
      const [x, y] = A.SEAT_POS[seat], ok = seatOK(drag.id, seat);
      c.strokeStyle = ok ? 'rgba(255,255,255,.9)' : 'rgba(200,55,45,.8)'; c.lineWidth = 2; c.setLineDash([4, 3]);
      c.beginPath(); c.arc(x, y, A.HEAD_R + 2, 0, 7); c.stroke(); c.setLineDash([]);
    }
  }
  for (const p of Object.values(s.people)) {
    if (!p.seat || (drag && drag.id === p.id && drag.moved)) continue;
    const [x, y] = A.SEAT_POS[p.seat];
    const fightShake = s.fight && s.fight.includes(p.id);
    A.drawPerson(c, p.id, x, y, A.HEAD_R, moodOf(p), T, { bob: G.likes(p, s.tapeId) && moving, shake: fightShake });
  }
  c.restore();
  // people still on the driveway
  let li = 0;
  for (const id of IDS) {
    const p = s.people[id]; if (p.seat || (drag && drag.id === id && drag.moved)) continue;
    const [x, y] = lineupPos(g, li++);
    A.drawPerson(c, id, x, y, A.HEAD_R * g.k, 'ok', T, {});
    c.font = `${Math.max(14, g.k * 6)}px ${A.HAND}`; c.fillStyle = '#2b2420'; c.textAlign = 'center'; c.fillText(p.name, x, y + A.HEAD_R * g.k * 1.75);
  }
  // speech bubbles
  if (s.mode === 'drive') {
    const fs = Math.max(13, Math.min(19, g.k * 6.2));
    for (const p of G.seated(s)) {
      const cs = G.complaints(s, p); if (!cs.length) continue;
      const word = p.id === 'kevin' && cs[0] === 'fight' ? 'poke poke' : BUBBLE[cs[0]];
      const [x, y] = seatScreen(g, p.seat);
      A.bubble(c, x, y - A.HEAD_R * g.k - 2, word, fs, BAD.has(cs[0]) ? 'bad' : 'ok', T);
    }
    if (L && L.pulled > 0) { c.save(); c.font = `900 ${Math.max(16, g.k * 7)}px ${A.SIGN}`; c.textAlign = 'center'; c.fillStyle = '#fff6e0'; c.strokeStyle = '#2b2420'; c.lineWidth = 4; c.strokeText('BATHROOM BREAK', g.w / 2, 34); c.fillText('BATHROOM BREAK', g.w / 2, 34); c.restore(); }
  }
  if (drag && drag.moved && drag.kind === 'seat') A.drawPerson(c, drag.id, drag.x, drag.y, A.HEAD_R * (g.k || 2) * 1.12, 'ok', T);
  A.photoFinish(c, g.w, g.h, T);
}

// breakdowns: the engine bay up top, a job card per broken part, everyone else standing on the shoulder
function bayGeom(w, h) {
  const land = w > h * 1.15;
  const bay = land ? { x: 0, y: 0, w: w * 0.4, h } : { x: 0, y: 0, w, h: h * 0.4 };
  const cards = land ? { x: w * 0.4, y: 0, w: w * 0.6, h: h * 0.62 } : { x: 0, y: h * 0.4, w, h: h * 0.34 };
  const shore = land ? { x: w * 0.4, y: h * 0.62, w: w * 0.6, h: h * 0.38 } : { x: 0, y: h * 0.74, w, h: h * 0.26 };
  const k = Math.min((bay.w - 12) / A.BAY_W, (bay.h - 12) / A.BAY_H);
  const n = s.bd ? s.bd.problems.length : 3;
  const cw = Math.min(160, (cards.w - 12) / n - 8), ch = Math.min(cards.h - 14, cw * 1.35);
  const slotR = Math.max(14, Math.min(cw * 0.2, ch * 0.15, 30));
  const hr = Math.max(16, Math.min(30, shore.h * 0.3, shore.w / 12, slotR * 1.15));
  return { land, bay, cards, shore, k, ox: bay.x + (bay.w - A.BAY_W * k) / 2, oy: bay.y + (bay.h - A.BAY_H * k) / 2, n, cw, ch, slotR, hr };
}
function cardRect(bg, pi) {
  const tot = bg.n * bg.cw + (bg.n - 1) * 8;
  const x = bg.cards.x + (bg.cards.w - tot) / 2 + pi * (bg.cw + 8), y = bg.cards.y + (bg.cards.h - bg.ch) / 2;
  return { x, y, w: bg.cw, h: bg.ch };
}
function hotspot(bg, pr) { const r = cardRect(bg, s.bd.problems.indexOf(pr)); return [r.x + r.w / 2, r.y + r.h / 2]; }
function crewPos(bg, pi, j) { const r = cardRect(bg, pi); return [r.x + r.w * (j ? 0.72 : 0.28), r.y + r.h - bg.slotR - 6]; }
function shoulderPos(bg, w, i, n) { const sw = bg.shore.w - (bg.land && document.body.classList.contains('short') ? 130 : 0); return [bg.shore.x + sw * (i + 1) / (n + 1), bg.shore.y + bg.shore.h * 0.55]; }
function headR(bg) { return bg.hr; }
function inCard(bg, x, y) { for (let i = 0; i < s.bd.problems.length; i++) { const r = cardRect(bg, i); if (x > r.x - 6 && x < r.x + r.w + 6 && y > r.y - 6 && y < r.y + r.h + 6) return i; } return -1; }
function personBayPos(bg, w) {
  const out = {}; const loose = [];
  const B = s.bd;
  for (const id of IDS) {
    const pi = B.problems.findIndex(pr => pr.crew.includes(id));
    if (pi >= 0) out[id] = crewPos(bg, pi, B.problems[pi].crew.indexOf(id)); else loose.push(id);
  }
  loose.forEach((id, i) => { out[id] = shoulderPos(bg, w, i, loose.length); });
  return out;
}
function renderBay(c, g) {
  const { w, h } = g, bg = bayGeom(w, h);
  c.fillStyle = '#8f8a7e'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 60; i++) c.fillRect((i * 97) % w, (i * 53) % h, 3, 3);
  // the shoulder, with a painted edge line
  c.fillStyle = '#6b6560'; c.fillRect(bg.shore.x, bg.shore.y, bg.shore.w, bg.shore.h);
  c.fillStyle = '#e8e2d0'; c.fillRect(bg.shore.x, bg.shore.y, bg.shore.w, 3);
  c.save(); c.translate(bg.ox, bg.oy); c.scale(bg.k, bg.k); A.drawBay(c, s.bd.problems, T);
  // little markers where the trouble is
  for (const pr of s.bd.problems) { if (pr.work >= 1) continue; const [px, py] = A.FIX_POS[pr.type]; c.fillStyle = 'rgba(200,55,45,.9)'; c.beginPath(); c.arc(px, py, 5.5 + Math.sin(T * 6) * 0.8, 0, 7); c.fill(); A.fixIcon(c, pr.type, px, py, 6, '#fff'); }
  c.restore();
  s.bd.problems.forEach((pr, pi) => {
    const r = cardRect(bg, pi), done = pr.work >= 1, cx2 = r.x + r.w / 2;
    c.save();
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.roundRect(r.x + 3, r.y + 4, r.w, r.h, 8); c.fill();
    c.fillStyle = done ? '#1d6a47' : '#fbf5e4'; c.strokeStyle = done ? '#fff' : '#2b2420'; c.lineWidth = 2;
    c.beginPath(); c.roundRect(r.x, r.y, r.w, r.h, 8); c.fill(); c.stroke();
    if (drag && drag.kind === 'fix' && drag.moved && !done) { c.strokeStyle = '#fbe77a'; c.lineWidth = 3; c.setLineDash([6, 4]); c.beginPath(); c.roundRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 10); c.stroke(); c.setLineDash([]); }
    const ic = Math.min(r.w * 0.34, r.h * 0.22);
    A.fixIcon(c, pr.type, cx2, r.y + ic * 0.75 + 4, ic, done ? '#fff' : '#2b2420');
    c.font = `800 ${Math.max(10, Math.min(14, r.w * 0.12))}px ${A.SIGN}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = done ? '#fff' : '#2b2420';
    const ly = r.y + ic * 1.5 + 12;
    c.fillText(done ? 'FIXED!' : FIX_NAMES[pr.type].toUpperCase(), cx2, ly);
    if (!done) {
      const by = ly + 12, bw = r.w - 16;
      c.fillStyle = '#d8ccb0'; c.fillRect(r.x + 8, by, bw, 7);
      c.fillStyle = '#1d6a47'; c.fillRect(r.x + 8, by, bw * pr.work, 7);
      // who's best at it
      const best = Object.values(s.people).find(p => p.fix === pr.type);
      c.font = `${Math.max(12, Math.min(16, r.w * 0.13))}px ${A.HAND}`; c.fillStyle = '#7a5a3a';
      c.fillText(best ? `${best.name}’s job` : 'anyone', cx2, by + 18);
      for (let j = 0; j < 2; j++) { if (pr.crew[j]) continue; const [sx, sy] = crewPos(bg, pi, j); c.strokeStyle = 'rgba(43,36,32,.35)'; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); c.arc(sx, sy, bg.slotR, 0, 7); c.stroke(); c.setLineDash([]); }
    }
    c.restore();
  });
  const pos = personBayPos(bg, w);
  for (const id of IDS) {
    if (drag && drag.id === id && drag.moved) continue;
    const [x, y] = pos[id];
    const onJob = s.bd.problems.some(pr => pr.crew.includes(id));
    drawWorker(c, id, x, y, onJob ? bg.slotR * 0.92 : bg.hr, sel === id);
  }
  if (drag && drag.moved && drag.kind === 'fix') drawWorker(c, drag.id, drag.x, drag.y, bg.hr * 1.1, false);
  if (sel) { c.font = `${Math.max(16, bg.hr * 0.7)}px ${A.HAND}`; c.fillStyle = '#fff6e0'; c.textAlign = 'center'; c.fillText(`now tap a job for ${s.people[sel].name}`, bg.shore.x + bg.shore.w / 2, bg.shore.y + 16); }
}
function drawWorker(c, id, x, y, r, selected) {
  const p = s.people[id];
  const busy = s.bd.problems.some(pr => pr.crew.includes(id) && pr.work < 1);
  if (selected) { c.strokeStyle = '#fbe77a'; c.lineWidth = 4; c.beginPath(); c.arc(x, y, r * 1.35, 0, 7); c.stroke(); }
  A.drawPerson(c, id, x, y, r, busy ? 'meh' : 'ok', T, { bob: busy });
  // their knack, as a little tag
  const tx = x + r * 0.95, ty = y - r * 0.85;
  c.fillStyle = id === 'jo' ? '#fbe77a' : '#fbf5e4'; c.strokeStyle = '#2b2420'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(tx, ty, r * 0.48, 0, 7); c.fill(); c.stroke();
  A.fixIcon(c, id === 'jo' ? 'flash' : p.fix, tx, ty, r * 0.62);
}

// ---------------------------------------------------------------- pointer on the car
let drag = null, sel = null;
function seatOK(id, seat) {
  const p = s.people[id];
  if (seat === 'drive' && !G.canDrive(p)) return false;
  if (s.mode === 'drive' && (seat === 'drive' || p.seat === 'drive')) return false;
  const other = G.inSeat(s, seat);
  if (other && p.seat === 'drive' && !G.canDrive(other)) return false;
  return true;
}
function carPoint(e) { const r = carc.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function personAt(x, y) {
  const g = carGeom();
  if (s.mode === 'breakdown') {
    const bg = bayGeom(g.w, g.h), pos = personBayPos(bg, g.w);
    let best = null, bd = bg.hr * 1.4;
    for (const id of IDS) { const d = Math.hypot(pos[id][0] - x, pos[id][1] - y); if (d < bd) { bd = d; best = id; } }
    return best;
  }
  let best = null, bd = A.HEAD_R * g.k * 1.35, li = 0;
  for (const id of IDS) {
    const p = s.people[id];
    const [px, py] = p.seat ? seatScreen(g, p.seat) : lineupPos(g, li++);
    const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = id; }
  }
  return best;
}
carc.addEventListener('pointerdown', e => {
  S.unlock();
  if (!s || s.over || s.mode === 'end') return;
  const [x, y] = carPoint(e);
  const id = personAt(x, y);
  if (window.awty) window.awty.lastDown = { x, y, id };
  if (s.mode === 'breakdown' && !id) {
    // tap a broken part with someone selected
    const g = carGeom(), bg = bayGeom(g.w, g.h);
    const pi = inCard(bg, x, y);
    if (pi >= 0 && sel) { G.assignFix(s, sel, pi); sel = null; tutEvent('fix'); }
    return;
  }
  if (!id) return;
  drag = { id, x, y, x0: x, y0: y, moved: false, kind: s.mode === 'breakdown' ? 'fix' : 'seat' };
  carc.setPointerCapture(e.pointerId);
});
carc.addEventListener('pointermove', e => {
  if (!drag) return;
  const [x, y] = carPoint(e);
  drag.x = x; drag.y = y;
  if (!drag.moved && Math.hypot(x - drag.x0, y - drag.y0) > 9) {
    if (drag.kind === 'seat' && s.mode === 'drive' && s.people[drag.id].seat === 'drive') { toast('Not while Dad’s driving! Swap drivers at a stop.'.replace('Dad', s.people[drag.id].name), 'bad'); drag = null; return; }
    drag.moved = true; hidePcard();
  }
});
carc.addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag; drag = null;
  const [x, y] = carPoint(e);
  if (window.awty) window.awty.lastUp = { x, y, moved: d.moved, id: d.id };
  if (!d.moved) { tapPerson(d.id, x, y); return; }
  if (d.kind === 'fix') {
    const g = carGeom(), bg = bayGeom(g.w, g.h);
    const pi = inCard(bg, x, y);
    G.assignFix(s, d.id, pi); sel = null;
    if (pi >= 0) tutEvent('fix');
    return;
  }
  const g = carGeom();
  let best = null, bd = A.HEAD_R * g.k * 1.8;
  for (const seat of G.SEATS) { const [sx, sy] = seatScreen(g, seat), dd = Math.hypot(sx - x, sy - y); if (dd < bd) { bd = dd; best = seat; } }
  if (!best) { if (s.mode !== 'drive' && s.people[d.id].seat && x < g.ox - 10) { s.people[d.id].seat = null; S.play('seat'); } return; }
  const why = G.moveSeat(s, d.id, best);
  if (why) toast(why, 'bad'); else { tutEvent('seat'); if (s.mode === 'stop') renderCard(); }
});
carc.addEventListener('pointercancel', () => { drag = null; });

function tapPerson(id, x, y) {
  if (s.mode === 'breakdown') { sel = sel === id ? null : id; S.play('seat'); return; }
  const p = s.people[id];
  if (s.mode === 'drive' && p.seat && p.hunger >= 0.3) { if (G.giveSnack(s, id)) { toast(`${p.name} gets a snack. ${s.snacks} left in the cooler.`, 'good'); tutEvent('snack'); } return; }
  showPcard(id, x, y);
}

// ---------------------------------------------------------------- who's who
function showPcard(id, x, y) {
  const p = s.people[id], card = $('pcard');
  const stars = n => n ? '★'.repeat(n) + '☆'.repeat(3 - n) : '—';
  card.innerHTML = `<canvas width="128" height="128"></canvas><h4>${p.name}</h4><div class="age">age ${p.age}</div>
    <dl><dt>Drives</dt><dd>${p.drive ? stars(p.drive) : 'not allowed'}</dd><dt>Maps</dt><dd>${stars(p.map)}</dd>
    <dt>Fixes</dt><dd>${p.fix ? FIX_NAMES[p.fix] : 'holds the flashlight'}</dd><dt>Loves</dt><dd>${TAPES[p.likes].sub.toLowerCase()} tapes</dd><dt>Hates</dt><dd>${TAPES[p.hates].sub.toLowerCase()}</dd></dl><p>${p.blurb}</p>`;
  const cc = card.querySelector('canvas').getContext('2d'); cc.scale(2, 2); A.drawPerson(cc, id, 32, 30, 20, 'happy', 0, {});
  const r = carc.getBoundingClientRect();
  card.hidden = false;
  const cw = card.offsetWidth, ch = card.offsetHeight;
  card.style.left = Math.max(8, Math.min(innerWidth - cw - 8, r.left + x - cw / 2)) + 'px';
  card.style.top = Math.max(8, Math.min(innerHeight - ch - 8, r.top + y + 30)) + 'px';
  clearTimeout(showPcard.t); showPcard.t = setTimeout(hidePcard, 4500);
}
function hidePcard() { $('pcard').hidden = true; }
addEventListener('pointerdown', e => { if (!$('pcard').hidden && !e.target.closest('#pcard') && e.target !== carc) hidePcard(); });

// ---------------------------------------------------------------- dashboard
const hudCache = {};
function setNeedle(id, v) { const deg = -62 + 124 * Math.max(0, Math.min(1, v)); if (hudCache[id] !== Math.round(deg)) { hudCache[id] = Math.round(deg); document.querySelector(`#${id} .needle`).style.transform = `rotate(${deg}deg)`; } }
function setText(id, t) { if (hudCache[id] !== t) { hudCache[id] = t; $(id).textContent = t; } }
function renderHud() {
  setNeedle('dFuel', s.gas); setNeedle('dFam', s.morale / 100); setNeedle('dCar', s.car / 100);
  setText('clock', `DAY ${s.day} · ${G.fmtClock(s.clock)}`);
  setText('money', `$${s.cash} · ${s.snacks} snack${s.snacks === 1 ? '' : 's'}`);
  setText('stamp', `’86 7 ${11 + s.day}`);
  const nd = G.node(s);
  setText('caption', s.mode === 'drive' ? `on the way to ${s.leg.to.town}` : s.mode === 'breakdown' ? 'broke down. of course.' : nd.type === 'home' ? 'leaving home! (7:58 am)' : `${nd.town}${nd.place ? ' — ' + nd.place : ''}`);
  const t = s.tapeId;
  const key = 'tape' + t;
  if (hudCache.tape !== key) {
    hudCache.tape = key;
    const cass = $('cass');
    if (t) {
      const tp = TAPES[t]; cass.style.background = tp.color; cass.style.setProperty('--lab', tp.label);
      $('tapeName').textContent = tp.name;
      const fam = Object.values(s.people);
      const lv = fam.filter(p => p.likes === t).map(p => p.name), ht = fam.filter(p => p.hates === t).map(p => p.name);
      $('tapeWho').innerHTML = `<span class="lv">♥ ${lv.join(', ')}</span> &nbsp;<span class="ht">✕ ${ht.join(', ')}</span>`;
    } else { cass.style.background = '#3a3530'; cass.style.setProperty('--lab', '#555'); $('tapeName').textContent = 'No tape. Just static.'; $('tapeWho').textContent = 'Tap to try a tape'; }
  }
  $('cass').classList.toggle('spin', !!t && s.mode === 'drive');
  const pull = $('pull');
  if (s.mode === 'breakdown') {
    setText('pullLabel', 'TOW TRUCK'); setText('pullSub', `$${G.TUNE.tow} · +2 hrs`);
    pull.disabled = s.cash < G.TUNE.tow; pull.classList.remove('blink');
  } else {
    setText('pullLabel', 'PULL OVER'); setText('pullSub', 'bathroom stop');
    pull.disabled = s.mode !== 'drive' || (s.leg && s.leg.pulled > 0);
    pull.classList.toggle('blink', s.mode === 'drive' && G.seated(s).some(p => p.bladder >= G.TUNE.line));
  }
  $('deck').hidden = s.mode === 'stop' || s.mode === 'end';
  document.body.classList.toggle('bd', s.mode === 'breakdown');
  $('card').hidden = !(s.mode === 'stop');
}

$('tape').onclick = () => { S.unlock(); if (!s || s.mode === 'end') return; G.cycleTape(s); S.setTape(s.tapeId); tutEvent('tape'); };
$('pull').onclick = () => {
  S.unlock();
  if (s.mode === 'breakdown') { if (G.tow(s)) S.play('horn'); return; }
  if (G.pullOver(s)) { toast('Everybody out. Bathroom break.', 'info'); tutEvent('pull'); }
};
$('mute').onclick = () => { S.unlock(); S.setMuted(!S.isMuted()); $('mute').classList.toggle('off', S.isMuted()); };
$('mute').classList.toggle('off', S.isMuted());
$('atlasClose').onclick = () => { document.body.classList.remove('showAtlas'); selectEdge(null); };

// ---------------------------------------------------------------- the postcard at each stop
function renderCard() {
  const card = $('card');
  if (!s || s.mode !== 'stop') { card.hidden = true; return; }
  const st = s.stop, nd = st.node;
  const placeLine = { home: 'Home • the driveway', gas: 'Gas station', diner: 'Diner', attraction: 'Roadside attraction', motel: 'Motel', event: 'Somewhere on the road', summit: 'Scenic overlook' }[nd.type];
  let h = `<div class="chead" id="chead"><div class="greet"><small>${nd.type === 'home' ? 'Leaving' : 'Greetings from'}</small><b>${nd.town}</b></div><div class="stampbox">DAY ${s.day}<br>${G.fmtClock(s.clock).replace(' ', '<br>')}</div><div class="collapse">${card.classList.contains('min') ? '▴' : '▾'}</div></div><div class="cbody">`;
  h += `<div class="placeline">${placeLine}${nd.place ? ' • ' + nd.place : ''}</div>`;
  if (st.note) h += `<p class="note">${st.note}</p>`;
  if (nd.type === 'home') h += `<p class="evtext">The wagon’s packed. The cooler’s full. Grandma turns 80 on Sunday, and the cake gets cut at 7 PM sharp.</p>`;
  if (nd.type === 'attraction' && !st.event) h += `<p class="evtext">${nd.sight.name}. Kevin has been reading the billboards for 200 miles.</p>`;
  if (nd.type === 'motel') h += `<p class="evtext">${nd.motel.note}</p>`;
  if (nd.type === 'summit') h += `<p class="evtext">You made it over the top. The whole valley’s down there, hazy and gold.</p>`;
  let blocked = false;
  if (st.event) {
    h += `<p class="evtext">${st.event.text}</p>`;
    if (!st.result) {
      blocked = true;
      h += `<div class="btns">` + st.event.choices.map((c, i) => { const why = G.choiceOK(s, c); return `<button class="sign" data-ch="${i}" ${why ? 'disabled' : ''}><span>${c.label}<small>${why || c.sub || '&nbsp;'}</small></span><span class="arr">${i + 1}</span></button>`; }).join('') + `</div>`;
    } else h += `<p class="result">${st.result}</p>`;
  }
  if (!blocked) {
    const sv = G.services(s);
    if (sv.length) h += `<div class="btns ${sv.length > 2 ? 'two' : ''}">` + sv.map(o => `<button class="sign ${o.off && !o.broke ? 'done' : ''} ${o.sleep ? 'brown' : ''}" data-sv="${o.id}" ${o.off ? 'disabled' : ''}><span>${o.label}<small>${o.broke ? 'can’t afford it' : o.off ? (o.sleep ? (st.sleptHow === o.id ? 'goodnight' : '\u2014') : (st.bought[o.id] ? 'done' : o.sub)) : o.sub}</small></span></button>`).join('') + `</div>`;
    const drv = G.driverOf(s);
    if (drv && drv.fatigue > 0.55 && nd.type !== 'motel') h += `<p class="note">${drv.name}’s getting sleepy. Swap drivers? (drag someone else into the driver’s seat)</p>`;
    const why = G.canLeave(s);
    h += `<div class="leave">`;
    if (why) h += `<p>${why}</p>`;
    if (narrow) h += `<button class="sign" id="openAtlas" ${why ? 'disabled' : ''}>Pick the next stop on the atlas <span class="arr">&#x2192;</span></button>`;
    else if (!why) h += `<p>Pick the next stop on the atlas ←</p>`;
    h += `</div>`;
  }
  h += `</div>`;
  card.innerHTML = h;
  card.hidden = false;
  card.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { G.choose(s, +b.dataset.ch); renderCard(); });
  card.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => { if (G.buy(s, b.dataset.sv)) { if (b.dataset.sv === 'room' || b.dataset.sv === 'carsleep') toast(`Day ${s.day}. Up at 8, back on the road.`, 'good'); renderCard(); } });
  $('chead').onclick = () => { card.classList.toggle('min'); renderCard(); setTimeout(() => layout(), 0); };
  const oa = $('openAtlas'); if (oa) oa.onclick = () => { S.play('page'); document.body.classList.add('showAtlas'); layout(); centerMapOn(G.node(s).col, true); tutEvent('atlas'); };
  if (mapSel) selectEdge(mapSel);
  requestAnimationFrame(layout);
}

// ---------------------------------------------------------------- notes
function toast(text, kind = 'info') {
  const box = $('toasts');
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 3200); setTimeout(() => el.remove(), 3700);
}

// ---------------------------------------------------------------- the tutorial: notes from Mom
const TUT = [
  { id: 'seat-dad', text: 'Dad drives first. Drag Dad into the driver’s seat.', ring: () => seatRing('drive'), done: () => s.people.dad.seat === 'drive' },
  { id: 'seat-mom', text: 'I’ll read the map, so drag me up front next to him. A bad navigator misses exits.', ring: () => seatRing('shot'), done: () => s.people.mom.seat === 'shot' },
  { id: 'seat-kids', text: 'Now the kids. Kevin picks on his sisters when he’s bored, so give him the way-back seat at the very back.', ring: () => seatRing('wayback'), done: () => G.allAboard(s) },
  { id: 'atlas', text: 'Now the road atlas. Red interstates are fast but boring. Dotted back roads are slower, and nobody gets bored. Tap a town, then Drive.', ring: () => narrow ? elRing('openAtlas') : null, done: () => s.mode === 'drive', wait: 'drive' },
  { id: 'snack', at: 2.5, set: () => { s.people.kevin.hunger = 0.8; }, text: 'Kevin’s hungry. Already. Tap him to pass back a snack from the cooler.', ring: () => personRing('kevin'), done: () => s.people.kevin.hunger < 0.2, pause: true },
  { id: 'tape', set: () => { s.people.tina.bore = 0.8; }, text: 'Tina’s bored. Tap the tape deck until it plays one she ♥s. Watch the names: somebody always hates it.', ring: () => elRing('tape'), done: () => s.tapeId === 'newwave', pause: true },
  { id: 'pull', set: () => { s.people.jo.bladder = 0.8; }, text: 'Jo needs the bathroom. Hit PULL OVER. It costs time, so it’s best when a few people need to go.', ring: () => elRing('pull'), done: () => s.stats.pullovers > 0, pause: true },
  { id: 'gauge', text: 'Every complaint drains the FAMILY gauge up top. If it hits empty, your father turns this car around. Cake’s at 7 PM on day 4!', ring: () => elRing('dFam'), ok: true },
  { id: 'stop', wait: 'arrive', text: 'Every stop is a choice: gas, snacks, sights. It all costs money and time. Tap anyone to see what they’re good at.', ring: () => null, ok: true },
];
const TUT_BREAKDOWN = { id: 'fix', text: 'Breakdown! Drag people onto the broken parts. The tag by each face shows their knack. I hold the flashlight: Jo makes whoever she’s with faster.', ok: true };
let coachStep = null, coachExtra = null, tutT = 0;
function seatRing(seat) { const g = carGeom(); const [x, y] = seatScreen(g, seat); return canvasRing(x, y, A.HEAD_R * g.k * 1.4); }
function personRing(id) { const p = s.people[id]; if (!p.seat) return null; return seatRing(p.seat); }
function canvasRing(x, y, r) { const b = carc.getBoundingClientRect(); return { x: b.left + x, y: b.top + y, r }; }
function elRing(id) { const el = $(id); if (!el || el.hidden || !el.offsetParent) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, r: Math.min(b.width, b.height) / 2 + 6, w: b.width + 12, h: b.height + 12 }; }

function showCoach(step) {
  coachStep = step;
  const c = $('coach');
  c.innerHTML = `<span class="from">A NOTE FROM MOM</span>${step.text}<div class="row">${step.id === 'atlas' ? '<span></span>' : '<button class="skip" id="cskip">skip tutorial</button>'}${step.ok ? '<button class="ok" id="cok">Got it</button>' : ''}</div>`;
  c.hidden = false;
  if ($('cskip')) $('cskip').onclick = endTutorial;
  if (step.ok) $('cok').onclick = () => advanceTut();
  if (step.pause) s.paused = true;
  placeCoach();
}
function placeCoach() {
  const c = $('coach'); if (c.hidden) return;
  const ph = $('photo').getBoundingClientRect();
  const step = coachStep;
  const ring = step && step.ring ? step.ring() : null;
  const cw = c.offsetWidth, ch = c.offsetHeight;
  let x = ph.left + (ph.width - cw) / 2, y = ph.top + 12;
  if (ring && ring.y < ph.top + ph.height * 0.45) y = Math.min(innerHeight - ch - 10, ph.top + ph.height * 0.58);
  if (ring && Math.abs(ring.x - (x + cw / 2)) < cw / 2 + ring.r && ring.y > y - ring.r && ring.y < y + ch + ring.r) {
    // the note would cover the target: slide it aside
    x = ring.x > innerWidth / 2 ? Math.max(8, ring.x - ring.r - cw - 10) : Math.min(innerWidth - cw - 8, ring.x + ring.r + 10);
    if (x < 8 || x + cw > innerWidth - 8) { x = Math.max(8, Math.min(innerWidth - cw - 8, ph.left + (ph.width - cw) / 2)); y = ring.y > innerHeight / 2 ? Math.max(8, ring.y - ring.r - ch - 14) : ring.y + ring.r + 14; }
  }
  // phones held sideways: the atlas column is the only free space, and the note lets taps through
  if (step && (step.id === 'atlas' || document.body.classList.contains('short')) && !narrow) { const a = $('atlas').getBoundingClientRect(); x = a.left + Math.max(12, (a.width - cw) / 2); y = a.top + 44; }
  // while people are still on the driveway, keep the note off the car and the lineup: sit it on the postcard
  if (step && step.id.startsWith('seat') && !$('card').hidden) { const cr = $('card').getBoundingClientRect(); x = cr.left + (cr.width - cw) / 2; y = Math.max(cr.top - 18, innerHeight - ch - 12); }
  c.style.left = Math.max(8, Math.min(innerWidth - cw - 8, x)) + 'px';
  c.style.top = Math.max(8, Math.min(innerHeight - ch - 8, y)) + 'px';
  const r = $('ring');
  const atlasUp = narrow && document.body.classList.contains('showAtlas');
  c.style.visibility = atlasUp ? 'hidden' : '';
  if (ring && !atlasUp) {
    const rw = ring.w || ring.r * 2, rh = ring.h || ring.r * 2;
    r.hidden = false; r.style.left = ring.x - rw / 2 + 'px'; r.style.top = ring.y - rh / 2 + 'px'; r.style.width = rw + 'px'; r.style.height = rh + 'px'; r.style.borderRadius = ring.w ? '12px' : '50%';
  }
  else r.hidden = true;
}
function hideCoach() { $('coach').hidden = true; $('ring').hidden = true; coachStep = null; }
function advanceTut() {
  if (coachExtra) { coachExtra = null; hideCoach(); s.paused = false; return; }
  hideCoach(); s.paused = false;
  tut++; tutT = 0;
  if (tut >= TUT.length) { endTutorial(); return; }
  const st = TUT[tut];
  if (!st.at && !st.wait) { st.set && st.set(); showCoach(st); }
}
function endTutorial() {
  tut = null; hideCoach(); s.paused = false; coachExtra = null;
  try { localStorage.setItem('awty-tut', '1'); } catch {}
}
function tutTick(dt) {
  if (coachExtra) { placeCoach(); return; }
  if (tut == null) return;
  const st = TUT[tut];
  if (!coachStep) {
    if (st.wait === 'drive' && s.mode === 'stop') { showCoach(st); }
    else if (st.wait === 'arrive') { if (s.mode === 'stop') { showCoach(st); } }
    else if (st.at != null && s.mode === 'drive') { tutT += dt; if (tutT >= st.at) { st.set && st.set(); showCoach(st); } }
    else if (!st.wait && st.at == null) { st.set && st.set(); showCoach(st); }
  } else {
    placeCoach();
    if (st.done && st.done()) advanceTut();
  }
}
function tutEvent() { if (coachStep) placeCoach(); }
function maybeBreakdownTip() {
  let seen = false; try { seen = localStorage.getItem('awty-fix') === '1'; } catch {}
  if (seen || DEMO) return;
  try { localStorage.setItem('awty-fix', '1'); } catch {}
  coachExtra = TUT_BREAKDOWN; s.paused = true; showCoach(TUT_BREAKDOWN);
}

// ---------------------------------------------------------------- keyboard
addEventListener('keydown', e => {
  if (!s || e.repeat) return;
  S.unlock();
  const k = e.key.toLowerCase();
  if ($('title').hidden === false && (k === 'enter' || k === ' ')) { e.preventDefault(); $('go').click(); return; }
  if (s.mode === 'drive' && /^[1-5]$/.test(k)) { const id = IDS[+k - 1], p = s.people[id]; if (G.giveSnack(s, id)) { toast(`${p.name} gets a snack.`, 'good'); } return; }
  if (s.mode === 'stop' && /^[1-4]$/.test(k)) { const b = document.querySelector(`[data-ch="${+k - 1}"]`); if (b && !b.disabled) b.click(); return; }
  if (k === 't') $('tape').click();
  if (k === ' ' || k === 'p') { e.preventDefault(); $('pull').click(); }
  if (k === 'm' && narrow) { document.body.classList.toggle('showAtlas'); layout(); }
  if (k === 'enter' && mapSel) { const b = $('driveBtn'); if (b && !b.disabled) b.click(); }
  if (k === 'escape') { selectEdge(null); hidePcard(); }
});

// ---------------------------------------------------------------- loop
let last = performance.now(), lastMode = null, lastPolaroids = 0;
function frame(now) { update(now); requestAnimationFrame(frame); }
function update(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; T += dt;
  if (s) {
    if (!DEMO && !(window.awty && window.awty.hold)) G.tick(s, dt);
    while (s.toasts.length) { const t = s.toasts.shift(); toast(t.text, t.kind); }
    while (s.cues.length) S.play(s.cues.shift().name);
    if (s.mode !== lastMode) onMode(lastMode, s.mode);
    if (s.polaroids.length !== lastPolaroids) { lastPolaroids = s.polaroids.length; if (s.mode !== 'end') toast(`Snap! A photo for the album: “${s.polaroids[s.polaroids.length - 1].caption}”`, 'good'); }
    if (s.over && !overShown) showOver();
    S.engine(s.mode === 'drive' && !(s.leg && s.leg.pulled > 0) ? 1 : s.mode === 'drive' ? 0.3 : 0, s.leg ? (s.leg.road === 'interstate' ? 1.2 : 0.9) : 1);
    renderHud(); renderCar(dt); renderMap(); tutTick(dt);
  }
}
function onMode(from, to) {
  lastMode = to;
  if (to === 'stop') { renderCard(); centerMapOn(G.node(s).col); if (from === 'drive') { if (narrow) { /* stay on the car */ } } }
  if (to === 'breakdown') { sel = null; maybeBreakdownTip(); }
  if (to === 'end') setTimeout(showEnd, 1600);
  layout();
}

// ---------------------------------------------------------------- start, end, over
function drawFamilyRow(canvas, mood) {
  const r = canvas.getBoundingClientRect(); canvas.width = r.width * dpr; canvas.height = r.height * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr);
  const h = r.height, w = r.width, rad = Math.min(h * 0.3, w / 13);
  IDS.forEach((id, i) => A.drawPerson(c, id, w * (0.12 + i * 0.19), h * 0.45 + (i > 2 ? rad * 0.25 : 0), rad * (id === 'jo' ? 0.85 : 1), mood, 0, {}));
}

function start(withTut) {
  S.unlock();
  $('title').hidden = true; $('end').hidden = true; overShown = false;
  const seed = params.has('seed') ? +params.get('seed') : (Math.random() * 1e9) | 0;
  s = G.newGame(seed);
  lastPolaroids = 0; lastMode = null; mapBase = null; propRegion = -1; traffic = [];
  newLegScenery();
  if (withTut) { tut = 0; } else {
    tut = null;
    const P = s.people; P.dad.seat = 'drive'; P.mom.seat = 'shot'; P.tina.seat = 'benchL'; P.jo.seat = 'benchR'; P.kevin.seat = 'wayback';
  }
  S.setTape(null);
  layout(); renderCard(); centerMapOn(0, true);
}

let overShown = false;
function showOver() {
  overShown = true; S.engine(0); S.setTape(null);
  const v = $('end');
  const why = s.over === 'stranded' ? ['Stranded', 'Out of gas and out of money on a road with no name. Grandma sends a bus ticket.'] : ['That’s it. I’m turning this car around.', `Day ${s.day}, ${G.fmtClock(s.clock)}, ${s.legsDriven} stops in. Nobody is speaking to anybody.`];
  const st = s.stats;
  const tip = s.over === 'stranded' ? 'Fill up whenever a station is on the way: the desert is long.'
    : st.fights > 1 ? 'Kevin starts fights when he’s bored and next to a sister. The way-back seat, or a Silly Songs tape, keeps the peace.'
    : st.accidents ? 'Jo can’t hold it long. Pull over when her bubble appears, and wait for a second customer if you can.'
    : st.swerves ? 'A sleepy driver swerves. Swap drivers at stops, or buy coffee at a diner.'
    : st.breakdowns > 1 ? 'A tune-up at a gas station keeps the car out of the ditch.'
    : 'Hungry people drain the gauge fastest. Keep the cooler stocked, and stop at diners.';
  v.innerHTML = `<div class="sheet over"><h2>${why[0]}</h2><canvas id="overc"></canvas><p>${why[1]}</p><p style="font-size:17px;color:#7a5a3a">Mom’s tip: ${tip}</p><div class="btns"><button class="sign big" id="again">Try again, new route <span class="arr">&#x2192;</span></button></div></div>`;
  v.hidden = false;
  drawFamilyRow($('overc'), 'cross');
  $('again').onclick = () => start(false);
}

function showEnd() {
  S.engine(0);
  const R = s.result, [title, why] = G.rating(R.score);
  const v = $('end');
  v.innerHTML = `<div class="sheet album"><h2>Summer Vacation ’86</h2><div class="verdict">${title}</div><div class="why">${why}</div>
    <div class="snaps">${s.polaroids.map((p, i) => `<div class="snap" style="transform:rotate(${((i * 37) % 7) - 3}deg)"><canvas data-i="${i}" width="236" height="208"></canvas><span>${p.caption}</span></div>`).join('')}</div>
    <div class="tally"><div><span>Family mood at Grandma’s</span><span>${R.morale} × 2</span></div><div><span>Photos in the album</span><span>${R.photos} × 15</span></div>
    <div><span>Money left over</span><span>$${R.cash} ÷ 2</span></div><div><span>${R.onTime ? 'Made it for cake' : 'Missed the cake'}</span><span>${R.onTime ? '+50' : '0'}</span></div><div class="tot"><span>TRIP SCORE</span><span>${R.score}</span></div></div>
    <div class="btns"><button class="sign big" id="again">Drive it again, new route <span class="arr">&#x2192;</span></button></div></div>`;
  v.hidden = false;
  v.querySelectorAll('canvas[data-i]').forEach(cv => { const p = s.polaroids[+cv.dataset.i]; const c = cv.getContext('2d'); A.drawSnapshot(c, p.key, 236, 208, +cv.dataset.i + 3); A.photoFinish(c, 236, 208, 0.3); });
  $('again').onclick = () => start(false);
  S.play('win');
}

$('go').onclick = () => { let seen = false; try { seen = localStorage.getItem('awty-tut') === '1'; } catch {} start(!seen); };
$('goSkip').onclick = () => { try { localStorage.setItem('awty-tut', '1'); } catch {} start(false); };

// ---------------------------------------------------------------- demo (for the preview shot)
function demo() {
  s = G.newGame(4242);
  const P = s.people; P.dad.seat = 'drive'; P.mom.seat = 'shot'; P.tina.seat = 'benchL'; P.jo.seat = 'benchM'; P.kevin.seat = 'benchR';
  // drive the first few legs instantly
  for (let i = 0; i < 4; i++) {
    const e = G.nextEdges(s)[i % G.nextEdges(s).length];
    G.startLeg(s, e); s.leg.breakAt = -1; s.leg.wrongAt = -1;
    while (s.mode === 'drive') G.tick(s, 0.1);
    if (s.mode === 'stop') { if (s.stop.event) G.choose(s, 0); const sv = G.services(s); for (const o of sv) if (!o.off) { G.buy(s, o.id); if (o.sleep) break; } }
  }
  const e = G.nextEdges(s).find(e => e.road === 'interstate') || G.nextEdges(s)[0];
  G.startLeg(s, e); s.leg.breakAt = -1; s.leg.wrongAt = -1; s.leg.prog = 0.45;
  s.morale = 58; s.gas = 0.55; s.car = 71;
  s.people.kevin.bore = 1; s.people.jo.bore = 0.9; s.fight = ['kevin', 'jo'];
  s.people.tina.hunger = 0.8; s.people.dad.fatigue = 0.3; s.people.mom.bore = 0.2;
  G.setTape(s, 'newwave');
  s.toasts.length = 0; s.cues.length = 0;
  lastPolaroids = s.polaroids.length;
  newLegScenery(); layout(); centerMapOn(s.leg.to.col, true);
  $('title').hidden = true;
  setTimeout(() => toast('“MOM! Kevin’s touching me!”', 'bad'), 300);
}

// ---------------------------------------------------------------- debug hooks for the headless playtest
if (params.has('debug')) {
  window.awty = {
    get s() { return s; }, G, hold: false,
    ff(sec) { for (let t = 0; t < sec; t += 1 / 30) { if (!s || s.over || s.mode === 'stop' || s.mode === 'end' || s.paused) break; G.tick(s, 1 / 30); } },
    step(n = 3) { for (let i = 0; i < n; i++) update(last + 1000 / 30); },
    go(i) { const e = G.nextEdges(s)[i]; if (e) go(e); },
    sel(i) { selectEdge(G.nextEdges(s)[i]); },
    tut: () => tut, coach: () => coachStep && coachStep.id,
    personXY(id) {
      const r = carc.getBoundingClientRect(), g = carGeom();
      if (s.mode === 'breakdown') { const bg = bayGeom(g.w, g.h), p = personBayPos(bg, g.w)[id]; return [r.left + p[0], r.top + p[1]]; }
      let li = 0; for (const pid of IDS) { const p = s.people[pid]; const xy = p.seat ? seatScreen(g, p.seat) : lineupPos(g, li++); if (pid === id) return [r.left + xy[0], r.top + xy[1]]; }
    },
    seatXY(seat) { const r = carc.getBoundingClientRect(), xy = seatScreen(carGeom(), seat); return [r.left + xy[0], r.top + xy[1]]; },
    fixXY(pi) { const r = carc.getBoundingClientRect(), g = carGeom(), bg = bayGeom(g.w, g.h), xy = hotspot(bg, s.bd.problems[pi]); return [r.left + xy[0], r.top + xy[1]]; },
    nodeXY(i) { const r = mapc.getBoundingClientRect(), { k } = mapGeom(), n = s.map.nodes[G.nextEdges(s)[i].b]; return [r.left + mapView.ox + n.x * k, r.top + mapView.oy + n.y * k]; },
  };
}

// ---------------------------------------------------------------- boot
mapPointer();
layout();
if (DEMO) { demo(); } else {
  $('title').hidden = false;
  if (matchMedia('(pointer: coarse)').matches) $('keysHelp').hidden = true;
  requestAnimationFrame(() => drawFamilyRow($('famc'), 'happy'));
  document.fonts?.ready.then(() => drawFamilyRow($('famc'), 'happy'));
  s = G.newGame(1); // something to draw behind the title
  const P = s.people; P.dad.seat = 'drive'; P.mom.seat = 'shot'; P.tina.seat = 'benchL'; P.jo.seat = 'benchR'; P.kevin.seat = 'wayback';
}
requestAnimationFrame(frame);
