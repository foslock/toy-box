import { Game, THR, STOP, PING_R, AIR, brg, wrap } from './game.js';
import { HOME, FALSE_HOME, MARKS, markById, sdf } from './world.js';
import { Scope, Chart, gauge, crackle, deg } from './view.js';
import { Camera } from './photo.js';
import { Sound } from './sound.js';
import { CAPTION, DELIVER, LOSS, FALSE } from './story.js';

const $ = s => document.querySelector(s), Q = new URLSearchParams(location.search), KEY = 'sonar-v1';
const snd = new Sound(), cam = new Camera(), scope = new Scope($('#scope')), chart = new Chart($('#chart'));
$('#room').style.backgroundImage = `url(${crackle()})`;
let save = null; try { save = JSON.parse(localStorage.getItem(KEY)); } catch { }
const DEMO = Q.has('demo'); if (DEMO) save = null;
let g = new Game(save && save.g, Q.get('seed') ? +Q.get('seed') : undefined);
let prints = (save && save.prints) || [];       // {cap, img, mark}
let running = false, tut = null, shake = 0, lamp = 1, dimT = 0, muted = !!(save && save.muted), skipped = !!(save && save.skipped), heardLesson = !!(save && save.heardLesson);
snd.mute(muted);
const store = () => { if (DEMO) return; try { localStorage.setItem(KEY, JSON.stringify({ g: g.save(), prints: keep(), muted, skipped, heardLesson })); } catch { } };
const keep = () => { const m = prints.filter(p => p.mark), o = prints.filter(p => !p.mark).slice(-5); return prints.filter(p => m.includes(p) || o.includes(p)); };

// ---------- tape
const tq = []; let tape = null, tapeT = 0;
function say(who, text, o = {}) { if (o.now) { tq.length = 0; tape = null; } if (tq.length > 3) tq.shift(); tq.push({ who, text, ...o }); }
let shown = '';
function showTape(m) {
  const k = m ? m.who + m.text + (m.warn || '') + (tut ? 1 : 0) : ''; if (k === shown) return; shown = k;
  const t = $('#tape'); t.querySelector('b').textContent = m ? m.who.toUpperCase() : ''; t.querySelector('span').textContent = m ? m.text : ''; t.classList.toggle('warn', !!(m && m.warn));
  let s = t.querySelector('.skip'); if (tut && !s) { s = document.createElement('button'); s.className = 'skip'; s.textContent = 'skip lesson'; s.onclick = () => { skipped = true; endTut(); store(); }; t.append(s); } if (!tut && s) s.remove();
  if (m) snd.key();
}
function tickTape(dt) {
  if (tape) { tapeT -= dt; if (tapeT <= 0) tape = null; }
  if (!tape && tq.length) { tape = tq.shift(); tapeT = 2 + tape.text.length * .055; }
  showTape(tape || (tut && tut.text ? { who: tut.who || 'Topside', text: tut.text } : idle()));
}
function idle() {
  const L = g.listen();
  if (g.c.st === 'feel') return { who: 'Hull', text: 'It is on the hull. Engine stopped. Touch nothing.', warn: 1 };
  if (g.live && g.thr === STOP && L) return { who: 'Hydrophone', text: `Engine stopped. Something, bearing ${deg(L.b)}, ${L.d < 60 ? 'very close' : L.d < 130 ? 'near' : 'a long way off'}.` };
  if (g.shot.length) return { who: 'Log', text: `${g.shot.length === 1 ? 'One print' : g.shot.length + ' prints'} aboard. Home is 500 E 500 N.` };
  const n = g.marks().filter(m => !g.delivered.includes(m.id)).length;
  return { who: 'Log', text: g.finale ? 'Mark G. 876 E 136 N.' : `${n} mark${n === 1 ? '' : 's'} left to photograph.` };
}

// ---------- lessons
const A = markById.A;
const STEPS = [
  { text: 'Morning, No. 7. Can you hear me? You steer with the brass slider on the ring. Drag it round to 055.', hl: 'bug', ok: () => Math.abs(wrap(g.course - .97)) < .13 },
  { text: "There's no window, so ask the water. Press PING and watch the walls come back.", hl: '#ping', ok: t => t.pings > 0 },
  { text: () => desk() ? 'That ping pencilled the echoes on your chart and fixed your position. Tap mark A on the chart.' : 'That ping pencilled the echoes on your chart and fixed your position. Open the chart.', hl: () => desk() ? 'A' : $('#chartbox').classList.contains('open') ? 'A' : '#cb', ok: t => t.sel === 'A' },
  { text: 'Good. Steer sets the ring to that bearing, 056 for mark A. Do that, then push the lever to HALF.', hl: () => !desk() && $('#chartbox').classList.contains('open') ? '#steer' : '#lever', ok: () => g.thr >= 3 && Math.abs(wrap(g.course - .97)) < .2 },
  { text: 'Mark A is at 614 E 578 N. Watch the counters climb and ping when you want to look.', ok: () => Math.hypot(g.x - A.x, g.y - A.y) < 46 },
  { text: 'Close now. Pull the lever to STOP. She takes a moment to lose way.', hl: '#lever', ok: () => g.thr === STOP && Math.abs(g.v) < 1.5 },
  { text: () => { const d = Math.hypot(g.x - A.x, g.y - A.y), b = brg(A.x - g.x, A.y - g.y), off = Math.abs(wrap(b - g.h)); return d > 33 ? `Still ${Math.round(d)} m off and the flash only carries 30. CREEP closer on ${deg(b)}.` : off > .35 ? `The camera looks where the nose points. Turn to ${deg(b)} to face the mark.` : "She's in front of you. Press SHUTTER."; }, hl: () => { const d = Math.hypot(g.x - A.x, g.y - A.y), off = Math.abs(wrap(brg(A.x - g.x, A.y - g.y) - g.h)); return d > 33 ? '#lever' : off > .35 ? 'bug' : '#shot'; }, ok: () => g.shot.includes('A') },
  { text: 'Now it develops. Give it a few seconds in the tray. You can steer meanwhile.', min: 6, ok: () => g.cam <= 1 },
  { text: () => `Bring it home: 500 E 500 N, steer ${deg(brg(HOME.x - g.x, HOME.y - g.y))}. Ping if you lose the walls.`, ok: () => g.atHome },
  { text: "You're under the shaft. Stop the engine and press Winch up.", hl: '#lever', ok: () => false },
];
function startTut() { tut = { i: 0, pings: 0, sel: null, t: 0 }; }
function endTut() { tut = null; highlight(null); shown = '?'; }
function tickTut(dt) {
  if (!tut) return; tut.t += dt; const s = STEPS[tut.i];
  if (s.ok(tut) && tut.t > (s.min || .6)) { tut.i++; tut.t = 0; if (tut.i >= STEPS.length) return endTut(); snd.clunk(); }
  const n = STEPS[tut.i]; tut.text = typeof n.text === 'function' ? n.text() : n.text; tut.who = 'Topside'; highlight(typeof n.hl === 'function' ? n.hl() : n.hl);
}
let hlNow = null;
function highlight(h) { if (h === hlNow) return; hlNow = h; document.querySelectorAll('.hl').forEach(e => e.classList.remove('hl')); if (h && h[0] === '#') $(h).classList.add('hl'); }
const desk = () => matchMedia('(min-width: 1000px) and (min-height: 600px)').matches;
// second dive: the hydrophone lesson
let ls2 = null;
function lesson2() { ls2 = { t: 0, st: 0 }; g.c.x = 624; g.c.y = 336; g.c.rest = 40; g.c.f = null; g.away(); say('Topside', "One more thing, No. 7. No. 6 pinged the whole way out and something pinged back."); }
function tick2(dt) {
  if (!ls2) return; ls2.t += dt;
  if (ls2.st === 0 && ls2.t > 6) { ls2.st = 1; ls2.t = 0; }
  if (ls2.st === 1) { if (!tq.length && !tape) say('Topside', g.thr === STOP ? 'Keep the engine stopped and listen. Watch the edge of the scope.' : 'Stop the engine and the hydrophone works. Watch the edge of the scope.'); if (g.thr === STOP && g.listen() && ls2.t > 4) { ls2.st = 2; ls2.t = 0; say('Topside', "See the smear? That's where it is. It has no eyes that we know of. It hears.", { now: 1 }); say('Topside', 'CREEP carries 35 m, HALF 95, FULL 190. A ping carries 250. If it comes to you, stop everything.'); say('Topside', 'Vents hide an engine. A Rattle makes noise somewhere you are not. Mind the lip.'); heardLesson = true; store(); } if (ls2.t > 45) { heardLesson = true; store(); ls2 = null; } }
  if (ls2 && ls2.st === 2 && ls2.t > 16) ls2 = null;
}

// ---------- photographs
let tray = null;
const WARM = new Set();
function expose(e) {
  let kind = 'none', m = null, bd = 60;
  for (const k of g.marks()) { const d = Math.hypot(k.x - e.x, k.y - e.y); if (d < bd) { bd = d; kind = k.id; m = k; } }
  if (e.wreck && Math.hypot(e.wreck.x - e.x, e.wreck.y - e.y) < bd) { kind = 'W'; m = { ...e.wreck, rot: e.wreck.no }; }
  const it = e.con && Math.hypot(e.cx - e.x, e.cy - e.y) < 60 ? { x: e.cx, y: e.cy, h: e.ch } : null;
  return cam.expose({ x: e.x, y: e.y, h: e.h, kind, m, it });
}
const WHY = { turn: 'The mark is close, but not in front of the nose.', far: 'Something, past the reach of the flash. Get within 30 m.', seek: 'Dark water. The mark is near. Ping, then face it.' };
function onShot(e) {
  snd.shutter(); flash(.5);
  const cv = expose(e); let cap = e.mark ? CAPTION[e.mark] : e.it ? 'Out of focus. It moved.' : e.wreck ? `No. ${e.wreck.no}. Mine, or it was.` : 'Rock and dark.';
  if (e.it && e.mark) cap += ' And something else.';
  const p = { cap, img: cv.toDataURL('image/jpeg', .82), mark: e.fresh ? e.mark : null };
  if (e.fresh) prints = prints.filter(q => q.mark !== e.mark);
  prints.push(p);
  tray = { cv, cap, t: 0, need: 8.4, lamp: false, why: e.mark ? (e.fresh ? `Mark ${e.mark} is on film.` : `Mark ${e.mark} again. It was already on film.`) : WHY[e.why] || '' };
  const el = $('#tray'); el.hidden = false; el.classList.remove('done'); el.querySelector('.cap').textContent = ''; snd.slosh();
}
function tickTray(dt) {
  if (!tray) return; tray.t += dt; const el = $('#tray'), c = el.querySelector('canvas').getContext('2d'), k = Math.min(1, tray.t / tray.need);
  if (!tray.lamp) {
    if ((tray.sl = (tray.sl || 0) + dt) > 1.7) { tray.sl = 0; snd.slosh(); }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.fillStyle = '#e9dcd2'; c.fillRect(0, 0, 480, 360); c.globalAlpha = Math.pow(k, 1.8); c.drawImage(tray.cv, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'multiply'; c.fillStyle = '#e2442c'; c.fillRect(0, 0, 480, 360); c.globalCompositeOperation = 'source-over';
    if (k >= 1) { tray.lamp = true; tray.t = 0; snd.lamp(); c.drawImage(tray.cv, 0, 0); el.classList.add('done'); el.querySelector('.cap').textContent = tray.cap; if (tray.why) say('Log', tray.why); if (tray.after) tray.after(); }
  } else if (tray.t > 7) closeTray();
}
function closeTray() { if (!tray) return; if (!tray.lamp) { if (tray.t < 1) return; if (tray.why) say('Log', tray.why); } tray = null; $('#tray').hidden = true; }
$('#tray').onclick = closeTray;

// ---------- events from the water
const rel = b => Math.sin(wrap(b - g.h));
function drain() {
  for (const e of g.events.splice(0)) switch (e.type) {
    case 'throttle': snd.clunk(2); break;
    case 'ping': scope.ping(e); snd.ping(e.hits); if (tut) tut.pings++; { const i = e.hits.find(h => h.k === 'it'); if (i && !g.oddSeen) { g.oddSeen = true; say('Log', 'A soft return, no shape I know. It was not there last time.'); } } break;
    case 'shot': onShot(e); if (e.fresh && e.mark === 'G') finaleOn(); break;
    case 'bump': snd.bump(e.hit); shake = Math.min(1, e.hit * .12); if (e.dmg) say('Hull', 'Hard knock. Plates are sprung.', { warn: 1 }); break;
    case 'stir': { const b = brg(g.c.x - g.x, g.c.y - g.y); snd.call(rel(b), Math.max(.2, 1 - e.d / 280)); if (!tut) say('Hydrophone', `Something turned, bearing ${deg(b)}.`); break; }
    case 'hunt': { const b = brg(g.c.x - g.x, g.c.y - g.y); snd.call(rel(b), 1); say('Hydrophone', `It heard you. Bearing ${deg(b)} and closing. Get off this spot, then go quiet.`, { warn: 1, now: 1 }); break; }
    case 'loses': say('Hydrophone', 'It has lost interest.'); break;
    case 'feel': snd.feel(); dimT = 8; shake = .5; say('Hull', g.thr === STOP ? 'It is on the hull. Touch nothing.' : 'It is on the hull. STOP THE ENGINE.', { warn: 1, now: 1 }); buzz(60); break;
    case 'leaves': say('Hull', 'It lets go.', { now: 1 }); snd.creak(); break;
    case 'strike': snd.strike(); shake = 1.6; flash(.25); dimT = 2; buzz([120, 60, 200]); say('Hull', g.hull > 0 ? `Struck. Hull at ${Math.max(0, Math.round(g.hull))}. It will be back.` : 'The plates are going.', { warn: 1, now: 1 }); break;
    case 'mimic': scope.mimic(e); snd.mimic(rel(e.b), Math.max(.15, 1 - e.d / 230)); if (!g.mimicSaid) { g.mimicSaid = 1; say('Log', 'That was not my ping.'); } break;
    case 'decoy': { const d = Math.hypot(e.x - g.x, e.y - g.y); snd.decoy(rel(brg(e.x - g.x, e.y - g.y)), Math.max(.1, 1 - d / 200)); break; }
    case 'drop': snd.clunk(2); say('Log', 'Rattle away. It starts in four seconds.'); break;
    case 'air': say('Gauge', e.f > .3 ? 'Air at two fifths. Turn for home soon.' : e.f > .1 ? 'Air at one fifth.' : 'Air is nearly gone.', { warn: 1 }); snd.alarm(); break;
    case 'salvage': snd.clunk(2); say('Log', e.got.length ? `The arm has No. ${e.no}'s film. ${e.got.length === 1 ? 'One print' : e.got.length + ' prints'}, still good.` : `No. ${e.no}. Nothing left aboard.`); break;
    case 'falsecall': snd.ring(); say('Topside', FALSE[e.n], { now: 1 }); break;
    case 'winch': onWinch(e); break;
    case 'lost': onLost(e); break;
  }
}
function finaleOn() { say('Log', 'That print is the shaft. I am not at the shaft.'); }
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch { } };
function flash(a) { const f = $('#flash'); f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; })); }

let dryN = -1;
function dry() { const el = $('#dry'); if (tray && !tray.lamp) return; const k = prints.length ? prints.length + prints[prints.length - 1].cap : 0; if (k === dryN) return; dryN = k; el.innerHTML = prints.length ? prints.slice(-4).reverse().map((p, i) => `<img alt="" src="${p.img}" style="--r:${[-1.5, 1, 1.2, -.8][i]}deg">`).join('') : '<p>No prints on the line yet.</p>'; }
$('#dry').onclick = () => { if (live()) gallery(); };
// ---------- sheets
const sheetEl = $('#sheet');
function sheet(html, btns) {
  sheetEl.firstElementChild.innerHTML = `<div class="slip">${html}<div class="row"></div></div>`; const r = sheetEl.querySelector('.row');
  btns.forEach(([t, f, big]) => { const b = document.createElement('button'); b.className = 'b' + (big ? ' big' : ''); b.textContent = t; b.onclick = () => { snd.init(); snd.resume(); snd.clunk(); f(); }; r.append(b); });
  sheetEl.hidden = false; sheetEl.scrollTop = 0; running = false; sheetAt = performance.now();
}
let sheetAt = 0;
const closeSheet = () => { sheetEl.hidden = true; };
const prt = (img, cap, text) => `<div class="prt"><img src="${img}" alt=""><p>${text ? text + '<br>' : ''}<span style="font:20px/1.1 'Reenie Beanie',cursive;-webkit-text-stroke:0">${cap}</span></p></div>`;
function nextDive() { closeSheet(); tray = null; $('#tray').hidden = true; scope.clear(); tq.length = 0; tape = null; g.lower(); chart.sel = null; info(); $('#chartbox').classList.remove('open'); run(); if (g.open && !heardLesson) lesson2(); else { ls2 = null; if (!g.open && !skipped) startTut(); else if (g.finale) say('Topside', "Mark G. None of us drew it. Photograph it and come straight up."); else say('Topside', `No. ${g.no}, you're clear of the ice. Mind the lip.`); } }
function finishPrints() { if (tray) { tray = null; $('#tray').hidden = true; } }
function onWinch(e) {
  snd.winch(); endTut(); ls2 = null; finishPrints(); running = false; store();
  const get = id => prints.find(p => p.mark === id);
  if (e.brought.includes('G')) return ending();
  let h = `<h2>Up on the ice</h2>`;
  if (!e.brought.length) h += `<p>No prints this time. Air and plates are made good. There's tea.</p>`;
  for (const id of e.brought) { const p = get(id); h += p ? prt(p.img, CAPTION[id], DELIVER[id]) : `<p>${DELIVER[id]}</p>`; }
  const n = g.delivered.length;
  if (n >= 3 && !prints.some(p => p.mark === 'odd')) { // a frame nobody took
    const cv = cam.expose({ x: 500, y: 500, h: .95, cy: 3.4, pitch: -.16, ghost: 1, kind: 'S', m: { x: 512, y: 510, rot: 1.25 }, seed: 11 }); const p = { cap: CAPTION.odd, img: cv.toDataURL('image/jpeg', .82), mark: 'odd' }; prints.push(p); store();
    h += prt(p.img, CAPTION.odd, 'There was one more frame on your roll.');
  }
  if (g.finale) h += `<p>That's all six. But there's a seventh mark on the chart this morning, G, in pencil. Nobody up here drew it.</p>`;
  else if (n > 1) h += `<p>${6 - n} of the six marks to go.</p>`;
  h += `<p style="font-size:13px">Air, hull and Rattles restored.</p>`;
  setTimeout(() => sheet(h, [['Lower away', nextDive, 1], ['Prints', gallery]]), 1500);
}
function onLost(e) {
  snd.lost(); endTut(); ls2 = null; finishPrints(); running = false; dimT = 3; store();
  const [t, x] = LOSS[e.why]; let extra = '';
  if (e.why === 'false') { const cv = cam.expose({ x: FALSE_HOME.x - 8, y: FALSE_HOME.y, h: 1.3, kind: 'G', m: { x: FALSE_HOME.x + 14, y: FALSE_HOME.y + 3, rot: 0 }, it: { x: FALSE_HOME.x + 3, y: FALSE_HOME.y + 2, h: 1.3 + Math.PI }, seed: 5 }); extra = prt(cv.toDataURL('image/jpeg', .82), CAPTION.false); }
  const w = g.wrecks[g.wrecks.length - 1];
  setTimeout(() => sheet(`<h2>${t}</h2><p>${x}</p>${extra}<p>${w && w.film.length ? `No. ${e.no} went down with ${w.film.length === 1 ? 'a print' : w.film.length + ' prints'} aboard. The wreck is on your chart. Pass slowly within 20 m to take the film.` : `No. ${e.no} had no film aboard.`}</p>`, [[`Lower No. ${g.no}`, nextDive, 1]]), 2200);
}
function ending() {
  const cv = cam.expose({ x: 500, y: 500, h: .6, cy: -3.8, pitch: .24, ghost: 0, kind: 'S', m: { x: 507, y: 510, rot: .9 }, seed: 21 });
  const p = { cap: CAPTION.end, img: cv.toDataURL('image/jpeg', .85), mark: 'end' }; prints = prints.filter(q => q.mark !== 'end'); prints.push(p); store();
  const gp = prints.find(q => q.mark === 'G');
  setTimeout(() => sheet(`<h2>Up for good</h2><p>They winch you up and nobody says mind the lip. Somebody puts a blanket round you. You hand over the print of G and they hold it next to the window, where you can see the hook and the ladder and the lamp, hanging in the ice.</p>${gp ? prt(gp.img, CAPTION.G) : ''}<p>They cap the shaft in the afternoon. Then Ansel brings the rest of your roll out of the dark.</p>${prt(p.img, CAPTION.end)}<p>That night in the hut, with the line unplugged, the telephone rings twice.</p><p style="font-size:13px">${g.losses ? `${g.losses} craft lost` : 'No craft lost'}. ${Math.round(g.T / 60)} minutes in the water.</p>`, [['Prints', gallery], ['Dive again from the start', fresh, 1]]), 1800);
}
function fresh() { g = new Game(); window.sonar.g = g; prints = []; heardLesson = false; g.mimicSaid = 0; store(); nextDive(); }
function gallery() {
  const el = $('#gal'), L = prints.slice().reverse();
  el.firstElementChild.innerHTML = `<h2>Prints</h2><div class="g">${L.map((p, i) => `<div class="p" style="--r:${((i * 37) % 5 - 2) * .7}deg"><img src="${p.img}" alt="">${p.mark && p.mark.length === 1 ? p.mark + '. ' : ''}${p.cap}</div>`).join('') || '<p>Nothing on the line yet.</p>'}</div><div class="row"><button class="b big">Back</button></div>`;
  el.querySelector('.row .b').onclick = () => { el.hidden = true; sync(); }; el.hidden = false; el.scrollTop = 0; galFrom = running; running = false;
}
let galFrom = false;
function sync() { if (galFrom && sheetEl.hidden && $('#title').hidden) run(); }
const HOW = () => `<h2>How it works</h2><dl><dt>Ring</dt><dd>Drag the brass slider to set your course. ${desk() ? '<kbd>A</kbd> <kbd>D</kbd> turn it.' : ''}</dd><dt>Lever</dt><dd>Speed, and noise. CREEP carries 35 m, HALF 95, FULL 190. ${desk() ? '<kbd>W</kbd> <kbd>S</kbd>' : ''}</dd><dt>Ping</dt><dd>Shows the walls, pencils them on the chart and fixes your position there. Carries 250 m. ${desk() ? '<kbd>Space</kbd>' : ''}</dd><dt>Shutter</dt><dd>Get within 30 m of a mark, point the nose at it, shoot. ${desk() ? '<kbd>F</kbd>' : ''}</dd><dt>Chart</dt><dd>Tap anywhere for a bearing from your last ping. ${desk() ? '' : 'Pinch to zoom.'}</dd><dt>Rattle</dt><dd>A canister that makes noise where you leave it. Three a dive. ${desk() ? '<kbd>R</kbd>' : ''}</dd><dt>Amber bars</dt><dd>Rock close on that side of the nose.</dd><dt>It</dt><dd>It hunts by sound. Stop the engine to hear where it is. If it heads for you, move off the spot it heard, then stop. If it is on the hull, do nothing.</dd><dt>Home</dt><dd>500 E 500 N. Prints only count once you winch them up. Going home refills air and mends the hull.</dd></dl>`;
function menu() {
  if (!g.live || !sheetEl.hidden) return; galFrom = false;
  sheet(`<h2>No. ${g.no}</h2><p>Paused. ${g.delivered.length} of 6 delivered, ${g.shot.length} aboard.</p>`, [['Carry on', () => { closeSheet(); run(); }, 1], ['How it works', () => sheet(HOW(), [['Back', menuBack, 1]])], [muted ? 'Sound on' : 'Sound off', () => { muted = !muted; snd.mute(muted); store(); menuBack(); }], ['Prints', gallery], ['Title', () => { closeSheet(); title(); }]]);
}
function menuBack() { closeSheet(); if ($('#title').hidden) menu(); }
function title() { running = false; $('#title').hidden = false; const going = g.delivered.length || g.losses || prints.length || g.aged > 5; $('#over').hidden = !going; $('#go').textContent = g.ended ? 'Dive again from the start' : going ? 'Carry on' : 'Lower away'; snd.pause(); }
function run() { running = true; snd.init(); snd.resume(); last = performance.now(); }
$('#go').onclick = () => { snd.init(); snd.resume(); $('#title').hidden = true; if (g.ended) return fresh(); if (g.live && g.aged > .1) return run(); nextDive(); };
$('#over').onclick = () => { const b = $('#over'); if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Lose all prints?'; setTimeout(() => { delete b.dataset.sure; b.textContent = 'Start over'; }, 3000); return; } delete b.dataset.sure; b.textContent = 'Start over'; $('#title').hidden = true; skipped = false; fresh(); };
$('#how0').onclick = () => sheet(HOW(), [['Back', closeSheet, 1]]);

// ---------- controls
const act = { ping: () => live() && g.ping(), shot: () => { if (live()) { if (!g.shoot() && tray && !tray.lamp) say('Log', 'The last print is still in the tray.'); } }, drop: () => live() && g.drop(), winch: () => live() && g.winch() };
const live = () => running && g.live && sheetEl.hidden;
for (const k of ['ping', 'shot', 'drop']) $('#' + k).addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); act[k](); drain(); });
for (const k of ['ping', 'shot', 'drop']) $('#' + k).addEventListener('click', e => { if (e.detail === 0) { act[k](); } });
$('#winch').onclick = () => { if (act.winch()) drain(); };
$('#menu').onclick = menu; $('#pb').onclick = () => { if (live()) gallery(); };
const lev = $('#lever'), knob = lev.querySelector('.knob'), notch = i => 9 + (4 - i) / 4 * 82;
THR.forEach((t, i) => { const n = document.createElement('div'); n.className = 'n'; n.textContent = t.name; n.style.top = notch(i) + '%'; lev.append(n); });
const levAt = e => { const r = lev.getBoundingClientRect(), f = ((e.clientY - r.top) / r.height - .09) / .82; if (live()) g.throttle(4 - Math.round(Math.max(0, Math.min(1, f)) * 4)); };
lev.addEventListener('pointerdown', e => { lev.setPointerCapture(e.pointerId); lev.on = e.pointerId; levAt(e); }); lev.addEventListener('pointermove', e => { if (lev.on === e.pointerId) levAt(e); }); for (const t of ['pointerup', 'pointercancel']) lev.addEventListener(t, () => { lev.on = null; });
const sc = $('#scope'); let ringId = null;
const ringA = e => { const r = sc.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2; return [Math.atan2(x, -y), Math.hypot(x, y)]; };
sc.addEventListener('pointerdown', e => { const [a, d] = ringA(e); if (!scope.geo || d < scope.geo.r * .45 || d > scope.geo.R * 1.1 || !live()) return; sc.setPointerCapture(e.pointerId); ringId = e.pointerId; g.order(a); });
sc.addEventListener('pointermove', e => { if (e.pointerId === ringId && live()) { const [a, d] = ringA(e); if (d > 20) g.order(a); } });
for (const t of ['pointerup', 'pointercancel']) sc.addEventListener(t, () => { ringId = null; });
sc.addEventListener('wheel', e => { e.preventDefault(); if (live()) g.order(g.course + Math.sign(e.deltaY) * .035); }, { passive: false });
// chart
const cb = $('#chartbox'); $('#cb').onclick = () => { if (!live()) return; cb.classList.add('open'); if (chart.z > 1 || innerWidth < innerHeight) { } info(); }; $('#chartx').onclick = () => cb.classList.remove('open');
const pts = new Map(); let pinch = null, moved = 0, down = null;
const cv = $('#chart');
function zoomAt(k, px, py) { const [a, b] = chart.toWorld(px, py); chart.z = Math.max(1, Math.min(5, chart.z * k)); const [c, d] = chart.toWorld(px, py); chart.cx += a - c; chart.cy += b - d; chart.geo(); }
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = pts.size > 1 ? 99 : 0; down = [e.clientX, e.clientY]; });
cv.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const q = chart.geo().s; if (pts.size === 2) { const o = [...pts.entries()].find(([k]) => k !== e.pointerId)[1], a = Math.hypot(p[0] - o[0], p[1] - o[1]), b = Math.hypot(e.clientX - o[0], e.clientY - o[1]); if (a > 4) zoomAt(b / a, (e.clientX + o[0]) / 2, (e.clientY + o[1]) / 2); moved = 99; } else { moved = Math.max(moved, Math.hypot(e.clientX - down[0], e.clientY - down[1])); if (moved > 8) { chart.cx -= (e.clientX - p[0]) / q; chart.cy += (e.clientY - p[1]) / q; chart.geo(); } } pts.set(e.pointerId, [e.clientX, e.clientY]); });
cv.addEventListener('pointerup', e => { if (pts.size === 1 && moved <= 8) pick(e.clientX, e.clientY); pts.delete(e.pointerId); }); cv.addEventListener('pointercancel', e => pts.delete(e.pointerId));
cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * .0025), e.clientX, e.clientY); }, { passive: false });
const mid = () => { const r = cv.getBoundingClientRect(), f = g.fixes[g.fixes.length - 1]; if (chart.z === 1) { chart.cx = f[0]; chart.cy = f[1]; } return [r.left + r.width / 2, r.top + r.height / 2]; };
$('#zin').onclick = () => { const f = g.fixes[g.fixes.length - 1], first = chart.z === 1; zoomAt(1.6, ...mid()); if (first) { chart.cx = f[0]; chart.cy = f[1]; } }; $('#zout').onclick = () => zoomAt(1 / 1.6, ...mid());
function pick(px, py) {
  const [x, y] = chart.toWorld(px, py); const s = chart.geo().s; let b = { x: Math.round(x), y: Math.round(y), name: '' }, bd = 26;
  for (const m of [...g.marks().map(m => ({ x: m.x, y: m.y, name: 'Mark ' + m.id, id: m.id })), { ...HOME, name: 'Shaft' }, ...g.wrecks.filter(w => !w.done).map(w => ({ x: Math.round(w.x), y: Math.round(w.y), name: 'No. ' + w.no }))]) { const d = Math.hypot(m.x - x, m.y - y) * s; if (d < bd) { bd = d; b = m; } }
  chart.sel = b; if (tut && b.id) tut.sel = b.id; snd.key(); info();
}
function info() {
  const s = chart.sel, f = g.fixes[g.fixes.length - 1], el = $('#chartinfo');
  if (!s) { el.innerHTML = 'Tap the chart for a bearing from your last ping, the white cross.'; $('#steer').disabled = true; $('#steer').textContent = 'Steer'; return; }
  const b = brg(s.x - f[0], s.y - f[1]); el.innerHTML = `${s.name ? s.name + ' · ' : ''}<b>${s.x}</b> E <b>${s.y}</b> N<br>from last ping: <b>${deg(b)}</b>, ${Math.round(Math.hypot(s.x - f[0], s.y - f[1]))} m`; $('#steer').disabled = false; $('#steer').textContent = 'Steer ' + deg(b);
}
$('#steer').onclick = () => { if (!chart.sel || !live()) return; const f = g.fixes[g.fixes.length - 1]; g.order(brg(chart.sel.x - f[0], chart.sel.y - f[1])); snd.clunk(); cb.classList.remove('open'); };
// keys
const held = {};
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const open = !$('#gal').hidden ? $('#gal') : !sheetEl.hidden ? sheetEl : !$('#title').hidden ? $('#title') : null;
  if (open) { if (['Enter', 'Space'].includes(e.code)) { e.preventDefault(); if (e.repeat || (open === sheetEl && performance.now() - sheetAt < 600)) return; const f = document.activeElement; (f && open.contains(f) && f.tagName === 'BUTTON' ? f : open.querySelector('.b.big') || open.querySelector('.b')).click(); } if (e.code === 'Escape' && open === $('#gal')) open.querySelector('.row .b').click(); return; }
  if (!running) return;
  const k = e.code; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(k)) e.preventDefault();
  held[k] = true; if (e.repeat) return;
  if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body) document.activeElement.blur();
  if (k === 'KeyW' || k === 'ArrowUp') g.throttle(g.thr + 1); if (k === 'KeyS' || k === 'ArrowDown') g.throttle(g.thr - 1); if (k === 'KeyX') g.throttle(STOP);
  if (k === 'Space') act.ping(); if (k === 'KeyF') act.shot(); if (k === 'KeyR') act.drop(); if (k === 'Enter') act.winch(); if (k === 'KeyC' && !desk()) cb.classList.toggle('open'); if (k === 'KeyP') gallery(); if (k === 'Escape') { if (cb.classList.contains('open')) cb.classList.remove('open'); else menu(); }
  if (k === 'KeyM') { muted = !muted; snd.mute(muted); store(); }
});
addEventListener('keyup', e => { held[e.code] = false; }); addEventListener('blur', () => { for (const k in held) held[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { snd.pause(); if (running && !DEMO) menu(); } });
document.addEventListener('gesturestart', e => e.preventDefault()); document.addEventListener('contextmenu', e => e.preventDefault());

// ---------- layout and frame
function layout() {
  const w = innerWidth, h = innerHeight; let s;
  if (desk()) { const b = $('#scopebox').getBoundingClientRect(); s = Math.min(b.width, b.height); } else if (w > h && h < 600) s = Math.min(h - 16, w * .48); else s = Math.min(w - 16, h - 50 - 86 - Math.max(210, Math.min(330, h * .36)) - 40, 620);
  document.documentElement.style.setProperty('--ss', Math.max(160, Math.floor(s)) + 'px');
}
addEventListener('resize', layout); layout(); if (document.fonts) document.fonts.ready.then(layout);
let last = performance.now(), feelT = 0, creakT = 9, fl = [99, 99, 99], tickN = 0, T = 0;
function step(dt) {
  if (running) {
    if (held.KeyA || held.ArrowLeft) g.order(g.course - dt * 1.1); if (held.KeyD || held.ArrowRight) g.order(g.course + dt * 1.1);
    g.tick(dt); drain(); if (running) { tickTut(dt); tick2(dt); } tickTray(dt); tickTape(dt);
    if ((feelT -= dt) <= 0) { feelT = .12; fl = g.feelers(); }
    const mn = Math.min(...fl); if (mn < 13 && Math.abs(g.v) > 1.5 && (tickN -= dt) <= 0) { tickN = .1 + mn * .035; snd.feeler(700 + (13 - mn) * 25); }
    if ((creakT -= dt) <= 0) { creakT = 7 + Math.random() * 14; snd.creak(); }
    for (const m of g.marks()) if (!WARM.has(m.id) && Math.hypot(m.x - g.x, m.y - g.y) < 90) { WARM.add(m.id); cam.warm(m.id); }
  }
}
let bot = null;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.max(0, Math.min(.1, (now - last) / 1000)); last = now; T += dt;
  if (!window.sonar.hold) { if (bot && running) bot.step(dt); step(dt); }
  draw(dt);
}
function draw(dt) {
  const L = running ? g.listen() : null; scope.update(running ? dt : 0, L); snd.frame(running ? g : null, L, L ? wrap(L.b - g.h) : 0);
  scope.draw(g, { feel: running ? fl : null, pulse: hlNow === 'bug', crack: g.hull < 35 ? 3 : g.hull < 70 ? 2 : g.hull < 100 ? (g.hull < 95 ? 1 : 0) : 0 });
  if (desk() || cb.classList.contains('open')) { chart.draw(g, { pulse: hlNow, t: T }); dry(); }
  const pad = v => String(Math.max(0, Math.round(v))).padStart(3, '0'), set = (id, t) => { const e = $(id); if (e.textContent !== t) e.textContent = t; };
  set('#dE', pad(g.x)); set('#dN', pad(g.y)); set('#dH', deg(g.h));
  gauge($('#gA'), g.air / AIR, 'AIR', { bad: [0, .2] }); gauge($('#gH'), g.hull / 100, 'HULL', { bad: [0, .4] }); gauge($('#gN'), Math.max(g.heardR, THR[g.thr].r * (g.ventAt(g.x, g.y) ? .35 : 1)) / PING_R, 'NOISE', { bad: [.6, 1] });
  knob.style.top = notch(g.thr) + '%'; lev.querySelectorAll('.n').forEach((n, i) => n.classList.toggle('on', i === g.thr));
  $('#drop').querySelector('small').textContent = g.decoys + ' left'; $('#drop').disabled = !g.decoys || !!g.decoy; $('#shot').disabled = g.cam > 0; $('#ping').disabled = g.pingT > 0;
  const wn = $('#winch'), can = g.live && g.atHome && Math.abs(g.v) <= 2 && g.thr === STOP && (g.aged > 25 || g.shot.length > 0); if (wn.hidden === can) wn.hidden = !can; if (can && wn.textContent[0]) { const t = g.shot.length ? `Winch up with ${g.shot.length} print${g.shot.length > 1 ? 's' : ''}` : 'Winch up'; if (wn.textContent !== t) wn.textContent = t; }
  shake = Math.max(0, shake - dt * 1.6); dimT = Math.max(0, dimT - dt); const st = document.documentElement.style; st.setProperty('--sx', (Math.random() - .5) * shake * 14 + 'px'); st.setProperty('--sy', (Math.random() - .5) * shake * 14 + 'px');
  $('#lampdim').style.opacity = dimT > 0 ? (g.c.st === 'feel' ? .38 + .2 * Math.sin(T * 13) * Math.sin(T * 3.1) : .35 * Math.min(1, dimT) * (Math.random() < .5 ? 1 : .4)) : 0;
}
window.sonar = { g, scope, chart, step, draw, hold: false, get run() { return running; }, cam, prints: () => prints, nextDive, STEPS, get tut() { return tut; }, ff(s) { for (let t = 0; t < s; t += .05) { if (bot) bot.step(.05); step(.05); scope.update(.05, null); } }, async bot(o) { const m = await import('./bot.js'); bot = new m.Bot(g, o); return bot; }, setG(x) { g = x; this.g = x; } };
if (DEMO) {
  $('#title').hidden = true; g.delivered = ['A']; g.wrecks = []; g.lower();
  const path = [[500, 500], [512, 590], [520, 680], [560, 742], [610, 790], [634, 808]]; for (const [x, y] of path) { g.x = x; g.y = y; g.ping(); g.pingT = 0; g.events.length = 0; }
  g.x = 645; g.y = 813; g.h = g.course = brg(markById.B.x - 645, markById.B.y - 813); g.air = AIR * .62; g.hull = 60; g.c.x = 612; g.c.y = 742; g.c.rest = 99; g.c.tx = 612; g.c.ty = 742; chart.sel = { x: 668, y: 830, name: 'Mark B', id: 'B' };
  running = true; info(); g.shoot(); drain(); tray.cap = ''; tray.need = 2; g.pingT = 0; g.heardR = 0; g.noise = () => { }; g.ping(); drain(); g.c.x = 612; g.c.y = 742; g.thing = () => { }; $('#tray').style.left = '74%'; $('#tray').style.top = '80%'; $('#tray').style.width = 'calc(var(--ss) * .5)'; tq.length = 0; say('Hydrophone', 'It heard you. Bearing 205 and closing. Get off this spot, then go quiet.', { warn: 1 }); dimT = 0; $('#flash').style.display = 'none';
} else { title(); info(); }
if (Q.has('autoplay')) { import('./bot.js').then(m => { bot = new m.Bot(g); }); }
requestAnimationFrame(frame); window.toyboxReady?.();
