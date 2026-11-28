// The twelve species: what they do (think), what makes them do it (fruit,
// whistle, bubbles), the box the camera scores against, and how each is drawn
// as a jointed paper puppet. Draw functions only read the creature's own
// fields, so a recorded snapshot can be redrawn in the screening.
import { blob, blobPts, pathFrom, strip, cut, card, pin, eye, glow, clamp, lerp, rng } from './paper.js';

const TAU = Math.PI * 2;
const start = (c, beh, dur) => { c.beh = beh; c.bt = 0; c.dur = dur; };
const stop = (c, w, rest = [2, 5]) => { c.beh = null; c.bt = 0; c.dur = 0; c.act = null; c.next = rest[0] + w.r() * (rest[1] - rest[0]); };
function walk(c, tx, speed, dt) {
  const d = tx - c.x;
  if (Math.abs(d) < 1.5) { c.moving = 0; return true; }
  c.face = d > 0 ? 1 : -1;
  c.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
  c.ph += dt * speed * 0.16; c.moving = 1;
  return false;
}
function fly(c, tx, ty, speed, dt) {
  const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
  if (d < 2) return true;
  const m = Math.min(d, speed * dt);
  c.x += dx / d * m; c.y += dy / d * m; if (Math.abs(dx) > 3) c.face = dx > 0 ? 1 : -1;
  return false;
}
const fx = (w, c, type, ox, oy, extra) => w.fx.push({ type, x: c.x + ox * c.face * c.p, y: c.y + oy * c.p, p: c.p, t: 0, life: 2.2, s: c.p, ...extra });
const others = (w, c, r) => w.creatures.filter((o) => o !== c && o.sp === c.sp && Math.abs(o.x - c.x) < r && o.p === c.p);
// a fruit becomes the creature's target; eating starts when it gets there
function toFruit(c, f) { c.act = 'fruit'; c.tgt = f; c.beh = null; c.bt = 0; }
const side = (c, f, d) => f.x - d * (f.x >= c.x ? 1 : -1);
function eatFruit(c, f, beh, dur) { f.ownerSp = c.sp; if (Math.abs(f.x - c.x) > 4) c.face = f.x > c.x ? 1 : -1; c.moving = 0; start(c, beh, dur); f.state = 'held'; f.owner = c.id; c.tgt = f; }
function fruitTick(c, w, dt) { // returns true once eating is over
  const f = c.tgt; if (!f) return true;
  f.bites = Math.min(1, f.bites + dt / c.dur);
  if (c.bt >= c.dur) { f.state = 'gone'; c.tgt = null; return true; }
  return false;
}

// ----------------------------------------------------------------- species
export const SPECIES = {};
const def = (key, o) => { SPECIES[key] = { key, ...o }; };

// ---- The Misty Wood
def('puffwick', {
  name: 'Puffwick', latin: 'Muscipila matutina', route: 0,
  blurb: 'A small round songbird made, as far as anyone can tell, mostly of moss.',
  beh: [
    { k: 'preening', name: 'Preening', r: 1, hint: 'Does this when left alone.' },
    { k: 'singing', name: 'Singing', r: 2, hint: 'Answers a whistle.' },
    { k: 'chorus', name: 'The dawn chorus', r: 3, sz: 0.022, hint: 'Whistle with three of them in the frame at once.' },
  ],
  box: () => [-22, -42, 24, 0],
  think(c, w, dt) {
    if (c.beh) { if (c.bt > c.dur) stop(c, w, [1.5, 4]); else if ((c.beh === 'singing' || c.beh === 'chorus') && Math.floor(c.bt * 2.2) !== Math.floor((c.bt - dt) * 2.2)) fx(w, c, 'note', 20, -34); return; }
    c.next -= dt; if (c.next <= 0) start(c, 'preening', 3 + w.r() * 2);
  },
  whistle(c, w, ev) {
    if (c.beh === 'chorus') return;
    const n = ev.inFrame.filter((o) => o.sp === 'puffwick').length;
    if (n >= 3 && ev.inFrame.includes(c)) start(c, 'chorus', 5.5); else start(c, 'singing', 3.6);
    c.bt = -w.r() * 0.4;
    w.sound('chirp', c);
  },
  draw(ctx, c) {
    const b = c.beh, t = c.bt, sing = b === 'singing' || b === 'chorus';
    const hop = b ? 0 : Math.max(0, Math.sin(c.t * 1.7 + c.id)) ** 8 * 5;
    ctx.translate(0, -hop);
    const puff = sing ? 1 + 0.06 * Math.sin(t * 14) + (b === 'chorus' ? 0.06 : 0) : 1;
    card(ctx, strip([-5, -8, -6, 0 + hop], 2.4, 1.6), '#6b4a2a', 1);
    card(ctx, strip([5, -8, 6, 0 + hop], 2.4, 1.6), '#6b4a2a', 1);
    card(ctx, cut([-14, -24, -34, -36, -30, -18], c.id, 1.4, 8), '#4d7436', 1.4);
    ctx.save(); ctx.translate(0, -20); ctx.scale(puff, puff);
    card(ctx, blob(0, 0, 21, 18.5, 0, c.id * 3 + 1, 20, 0.07), '#6f9a4a', 2);
    card(ctx, blob(5, 6, 12, 8, 0.2, c.id * 3 + 2, 14, 0.08), '#b7c873', 0);
    for (let i = 0; i < 4; i++) { const r = rng(c.id * 9 + i); ctx.fillStyle = '#5a8539'; ctx.fill(blob(-12 + r() * 18, -10 + r() * 10, 2.5 + r() * 2, 2 + r() * 1.5, 0, i, 8, 0.2)); }
    const wr = b === 'preening' ? -0.6 - 0.3 * Math.sin(t * 6) : 0.1;
    card(ctx, blob(-5, 1, 12, 7.5, wr, c.id * 3 + 3, 14, 0.1), '#557d38', 1.2);
    // head features rotate when preening (beak tucked into the wing)
    const ha = b === 'preening' ? -2.3 * Math.min(1, t * 2, (c.dur - t) * 2) : (sing ? -0.25 : 0);
    ctx.save(); ctx.translate(5, -6); ctx.rotate(ha);
    const open = sing ? 0.35 + 0.25 * Math.sin(t * 16) : 0.05;
    ctx.save(); ctx.rotate(-open); card(ctx, cut([10, -3, 21, 0, 10, 1], 2, 0.3, 30), '#e59a3b', 0.8); ctx.restore();
    ctx.save(); ctx.rotate(open * 0.7); card(ctx, cut([10, 0, 19, 2, 10, 3], 3, 0.3, 30), '#c47a28', 0.8); ctx.restore();
    eye(ctx, 6, -4, 3.4, b === 'chorus' ? 0.7 : 0);
    ctx.restore();
    ctx.restore();
  },
});

def('mossback', {
  name: 'Mossback tortoise', latin: 'Testudo silvicola', route: 0,
  blurb: 'The oldest thing in the wood. Several of the trees are growing on it.',
  beh: [
    { k: 'plodding', name: 'Plodding', r: 1, hint: 'Does this when left alone. Slowly.' },
    { k: 'feeding', name: 'Feeding', r: 2, hint: 'Very fond of fruit.' },
    { k: 'dozing', name: 'Dozing off', r: 3, hint: 'Something soothing near its head.' },
  ],
  box: () => [-88, -150, 118, 0],
  think(c, w, dt) {
    if (c.act === 'fruit') {
      if (c.tgt.state === 'gone') { stop(c, w); return; }
      if (c.beh === 'feeding') { if (fruitTick(c, w, dt)) stop(c, w); return; }
      if (walk(c, side(c, c.tgt, 94), 14, dt)) eatFruit(c, c.tgt, 'feeding', 7);
      return;
    }
    if (c.beh === 'dozing') { if (Math.floor(c.bt * 1.2) !== Math.floor((c.bt - dt) * 1.2)) fx(w, c, 'z', 100, -70); if (c.bt > c.dur) stop(c, w); return; }
    if (c.beh === 'plodding') {
      if (walk(c, c.k.to, 7, dt) || c.bt > c.dur) { c.moving = 0; stop(c, w, [1, 3]); }
      return;
    }
    c.next -= dt;
    if (c.next <= 0) { start(c, 'plodding', 9 + w.r() * 4); c.k.to = c.home + (w.r() - 0.5) * (c.k.tut ? 70 : 220); }
  },
  fruit(c, f) { if (c.beh === 'dozing' && c.bt < c.dur - 1) return false; toFruit(c, f); return true; },
  bubble(c, w) { if (c.act === 'fruit' || c.beh === 'dozing') return; c.moving = 0; start(c, 'dozing', 8); w.sound('yawn', c); },
  draw(ctx, c) {
    const b = c.beh, t = c.bt, mv = c.moving ? c.ph : 0;
    const legs = [[-52, 0], [-24, 1.6], [30, 3.2], [58, 4.8]];
    for (const [x, o] of legs) {
      const lift = c.moving ? Math.max(0, Math.sin(mv + o)) * 6 : 0;
      card(ctx, cut([x - 11, -30, x + 11, -30, x + 12, -lift, x - 12, -lift], 4 + x, 1, 8), '#6f6c50', 1.6);
      pin(ctx, x, -26, 2.6);
    }
    const sway = c.moving ? Math.sin(mv * 0.5) * 0.04 : Math.sin(c.t * 0.6) * 0.015;
    // tree on its back
    ctx.save(); ctx.translate(-6, -84); ctx.rotate(sway);
    card(ctx, strip([0, 6, 2, -36, -2, -64], 9, 5), '#5b4733', 1.6);
    card(ctx, blob(-2, -78, 34, 22, 0, 41, 16, 0.12), '#4d7d38', 2);
    card(ctx, blob(-22, -64, 18, 13, 0, 42, 12, 0.14), '#5a8a40', 1.6);
    card(ctx, blob(18, -66, 20, 14, 0, 43, 12, 0.14), '#467233', 1.6);
    ctx.restore();
    // shell
    const shell = blobPts(0, -26, 84, 62, 0, c.id + 50, 26, 0.03, Math.PI, TAU);
    card(ctx, pathFrom([...shell, 84, -22, -84, -22]), '#7d6b3d', 2.6);
    for (let i = 0; i < 5; i++) card(ctx, blob(-54 + i * 27, -50 - Math.sin(i / 4 * Math.PI) * 18, 14, 11, 0, i + 60, 10, 0.08), '#94814a', 0.8);
    card(ctx, blob(-30, -78, 22, 6, -0.2, 71, 12, 0.2), '#6f8d3e', 0);
    card(ctx, blob(34, -76, 18, 5, 0.25, 72, 12, 0.2), '#6f8d3e', 0);
    card(ctx, cut([-86, -26, 86, -26, 82, -16, -82, -16], 73, 1, 12), '#5e5230', 1);
    // head
    const eat = b === 'feeding' ? 1 : 0, doze = b === 'dozing' ? clamp(t * 1.5, 0, 1) * clamp((c.dur - t) * 1.5, 0, 1) : 0;
    const hy = -34 + eat * 24 + doze * 14 + (eat ? Math.sin(t * 7) * 2 : 0);
    card(ctx, strip([72, -32, 86, hy - 2, 96, hy], 18, 14), '#888664', 1.6);
    card(ctx, blob(104, hy, 18, 13, 0.1, 74, 14, 0.06), '#8f8e6a', 1.8);
    eye(ctx, 108, hy - 4, 3.2, doze > 0.4 ? 1 : (Math.sin(c.t * 0.8 + c.id) > 0.97 ? 1 : 0.15));
    ctx.strokeStyle = '#3e3a28'; ctx.lineWidth = 1.4; ctx.beginPath();
    const mo = eat ? Math.abs(Math.sin(t * 7)) * 4 : 0;
    ctx.moveTo(110, hy + 5); ctx.lineTo(121, hy + 3 + mo); ctx.stroke();
    pin(ctx, 78, -30, 2.6);
  },
});

def('ferngrazer', {
  name: 'Ferngrazer', latin: 'Pteridocapra timida', route: 0,
  blurb: 'So shy that for many years it was thought to be a fern.',
  beh: [
    { k: 'peeking', name: 'Peeking out', r: 1, hint: 'Watch the ferns.' },
    { k: 'grazing', name: 'Grazing in the open', r: 2, hint: 'Can be called out of cover.' },
    { k: 'sparring', name: 'Sparring', r: 3, hint: 'Two of them, one fruit.' },
  ],
  box: (c) => (c.k.out || 0) < 0.5 ? (c.beh === 'peeking' ? [8, -84, 48, -46] : null) : [-34, -96, 50, 0],
  think(c, w, dt) {
    const k = c.k;
    const goOut = (v) => { k.out = clamp((k.out || 0) + (v ? dt * 1.4 : -dt * 1.4), 0, 1); };
    if (c.beh === 'sparring') {
      goOut(true);
      if (c.bt > c.dur) {
        const f = c.tgt;
        if (f && f.state !== 'gone' && k.win) eatFruit(c, f, 'grazing', 5); else stop(c, w);
      }
      return;
    }
    if (c.act === 'fruit') {
      goOut(true);
      const f = c.tgt;
      if (!f || f.state === 'gone') { stop(c, w); c.act = 'home'; return; }
      if (c.beh === 'grazing') { if (fruitTick(c, w, dt)) { stop(c, w); c.act = 'home'; } return; }
      if (f.state === 'held' && f.owner !== c.id) { stop(c, w); c.act = 'home'; return; }
      if (walk(c, f.x - 36 * Math.sign(f.x - c.x || 1), 34, dt)) {
        const rival = w.creatures.find((o) => o !== c && o.sp === 'ferngrazer' && o.tgt === f && o.act === 'fruit' && Math.abs(o.x - f.x) < 110 && o.beh !== 'sparring');
        if (rival) {
          for (const [a, bb] of [[c, rival], [rival, c]]) { a.act = 'fruit'; a.moving = 0; start(a, 'sparring', 4.5); a.face = bb.x > a.x ? 1 : -1; a.k.win = a === c; a.tgt = f; }
          w.sound('bonk', c);
        } else eatFruit(c, f, 'grazing', 5);
      }
      return;
    }
    if (c.act === 'out') {
      goOut(true);
      if (c.beh === 'grazing') { if (c.bt > c.dur) { stop(c, w); c.act = 'home'; } return; }
      if (walk(c, c.k.spot, 30, dt)) start(c, 'grazing', 6);
      return;
    }
    if (c.act === 'home') {
      if (walk(c, c.home, 38, dt)) { c.act = null; c.face = c.k.face0; }
      goOut(Math.abs(c.x - c.home) > 30);
      return;
    }
    goOut(false); c.moving = 0;
    if (c.beh === 'peeking') { if (c.bt > c.dur) stop(c, w, [2, 4.5]); return; }
    c.next -= dt; if (c.next <= 0 && k.out < 0.1) start(c, 'peeking', 3 + w.r() * 1.5);
  },
  whistle(c, w) {
    if (c.act) return;
    c.act = 'out'; c.beh = null; c.k.spot = c.home + c.k.face0 * 78; w.sound('rustle', c);
  },
  fruit(c, f) { if (c.beh === 'sparring' || (c.beh === 'grazing' && c.act === 'fruit')) return false; toFruit(c, f); return true; },
  bubble(c, w) { if (c.act === 'out' && c.beh !== 'grazing') { c.act = 'home'; } },
  draw(ctx, c) {
    const b = c.beh, t = c.bt, out = c.k.out || 0;
    const crouch = (1 - out) * 34 - (b === 'peeking' && out < 0.5 ? clamp(t * 3, 0, 1) * clamp((c.dur - t) * 3, 0, 1) * 22 : 0);
    ctx.translate(0, crouch);
    const mv = c.moving ? c.ph : 0;
    const legs = [[-18, 0], [-10, 2.2], [14, 1.1], [22, 3.3]];
    for (const [x, o] of legs) {
      const sw = c.moving ? Math.sin(mv + o) * 6 : 0;
      card(ctx, strip([x, -36, x + sw * 0.5, -18, x + sw, 0], 5, 3), x < 0 ? '#8a5f35' : '#9c6c3c', 1);
    }
    const spar = b === 'sparring' ? Math.max(0, Math.sin(t * 5)) : 0;
    ctx.translate(spar * 10, 0);
    card(ctx, cut([-30, -46, -40, -54, -36, -40], 9, 0.6, 20), '#f2ead8', 0.8);
    card(ctx, blob(0, -42, 30, 15, 0, c.id + 5, 18, 0.05), '#b88752', 2);
    card(ctx, blob(2, -36, 20, 7, 0, c.id + 6, 12, 0.06), '#dcbc8c', 0);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#f2ead8'; ctx.beginPath(); ctx.arc(-18 + i * 9, -48 + (i % 2) * 4, 2, 0, 7); ctx.fill(); }
    // neck and head: up, grazing (down) or lowered for sparring
    const graze = b === 'grazing' ? clamp(t * 2, 0, 1) * clamp((c.dur - t) * 2, 0, 1) : 0;
    const low = b === 'sparring' ? 1 : 0;
    const hx = lerp(lerp(32, 40, graze), 46, low), hy = lerp(lerp(-74, -12, graze), -44, low) + (graze ? Math.sin(t * 6) * 1.5 : 0);
    card(ctx, strip([20, -48, (20 + hx) / 2 + 2, (hy - 48) / 2 - 4, hx - 4, hy + 2], 12, 8), '#b07e4a', 1.4);
    pin(ctx, 20, -48, 2.2);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(lerp(0, 0.9, graze) + low * 0.6);
    // fern-frond ears
    for (const [a, l, s] of [[-2.3, 34, 1], [-1.9, 30, 2]]) {
      const pts = []; for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push(-4 + Math.cos(a) * l * u, -6 + Math.sin(a) * l * u + Math.sin(u * 3) * 3); }
      card(ctx, strip(pts, 9, 1), s === 1 ? '#5f9a3e' : '#4f8634', 1);
    }
    card(ctx, blob(0, 0, 12, 9, 0.15, c.id + 7, 14, 0.05), '#c08d57', 1.6);
    card(ctx, blob(10, 3, 6, 5, 0, c.id + 8, 10, 0.05), '#8c6038', 0);
    ctx.fillStyle = '#1b1410'; ctx.beginPath(); ctx.arc(14, 2, 1.8, 0, 7); ctx.fill();
    eye(ctx, 2, -2, 3, 0);
    ctx.restore();
  },
});

// ---- The Reed Marsh
def('stiltbill', {
  name: 'Stiltbill', latin: 'Platalea grallator', route: 1,
  blurb: 'Stands on legs that seem to have been borrowed from something much larger.',
  beh: [
    { k: 'fishing', name: 'Fishing', r: 1, hint: 'Does this when left alone.' },
    { k: 'gulping', name: 'Swallowing fruit whole', r: 2, hint: 'Not a fussy eater.' },
    { k: 'dancing', name: 'The courtship dance', r: 3, sz: 0.08, hint: 'Whistle when two stand together.' },
  ],
  box: () => [-34, -178, 64, 4],
  think(c, w, dt) {
    if (c.act === 'fruit') {
      const f = c.tgt; if (!f || f.state === 'gone' || (f.state === 'held' && f.owner !== c.id)) { stop(c, w); return; }
      if (c.beh === 'gulping') { if (fruitTick(c, w, dt)) stop(c, w); return; }
      if (walk(c, side(c, f, 52), 30, dt)) { eatFruit(c, f, 'gulping', 4.5); w.sound('gulp', c); }
      return;
    }
    if (c.beh === 'dancing') { c.moving = 0; if (c.bt > c.dur) stop(c, w); return; }
    if (c.beh === 'fishing') {
      if (c.bt > c.dur) { fx(w, c, 'fish', 56, -60); w.sound('splash', c); stop(c, w, [1.5, 3.5]); }
      return;
    }
    if (c.act === 'wade') { if (walk(c, c.k.to, 12, dt)) { c.act = null; c.moving = 0; } return; }
    c.next -= dt;
    if (c.next <= 0) {
      if (w.r() < 0.35) { c.act = 'wade'; c.k.to = c.home + (w.r() - 0.5) * 120; }
      else start(c, 'fishing', 3.6 + w.r() * 2);
    }
  },
  fruit(c, f) { if (c.beh === 'dancing') return false; toFruit(c, f); return true; },
  whistle(c, w) {
    if (c.beh === 'dancing' || c.act === 'fruit') return;
    const mate = others(w, c, 280).find((o) => o.beh !== 'dancing' && o.act !== 'fruit');
    if (!mate) return;
    for (const [a, b] of [[c, mate], [mate, c]]) { a.act = null; a.moving = 0; start(a, 'dancing', 6.5); a.face = b.x > a.x ? 1 : -1; }
    w.sound('honk', c);
  },
  draw(ctx, c) {
    const b = c.beh, t = c.bt, mv = c.moving ? c.ph : 0;
    const dance = b === 'dancing' ? 1 : 0;
    const hop = dance ? Math.abs(Math.sin(t * 4)) * 10 : 0;
    // water ring at the feet
    ctx.strokeStyle = 'rgba(230,244,236,.6)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 4, 0, 0, TAU); ctx.stroke();
    ctx.translate(0, -hop);
    for (const [s, o] of [[-1, 0], [1, Math.PI]]) {
      const sw = c.moving ? Math.sin(mv + o) * 10 : (dance ? Math.sin(t * 8 + o) * 8 : 0);
      const kx = s * 3 + sw * 0.4, ky = -56;
      card(ctx, strip([s * 4, -104, kx + 4, ky, s * 5 + sw, 0 + hop * (s > 0 ? 1 : 0.4)], 4, 3), s < 0 ? '#c25e42' : '#d86f50', 1);
      pin(ctx, kx + 3, ky, 1.8);
    }
    if (dance) for (const s of [-1, 1]) {
      const a = Math.sin(t * 8) * 0.25;
      ctx.save(); ctx.translate(-4, -114); ctx.rotate(s * (0.9 + a) - 0.4);
      card(ctx, cut([0, 0, -10, -52, 10, -58, 20, -10], 11 + s, 1.5, 10), s < 0 ? '#e8d6ca' : '#f4e8df', 1.6);
      card(ctx, cut([-10, -52, -4, -64, 10, -58], 13 + s, 0.4, 20), '#2a2622', 0);
      ctx.restore();
    }
    card(ctx, cut([-26, -108, -44, -100, -30, -98], 3, 0.5, 20), '#d6c4b7', 1);
    card(ctx, blob(-2, -110, 26, 14, -0.1, c.id + 3, 18, 0.05), '#f3e7dd', 2);
    if (!dance) card(ctx, blob(-6, -112, 17, 8, -0.15, c.id + 4, 12, 0.07), '#ddcbbf', 0.8);
    // neck: up, or dipped to the water when striking
    let dip = 0;
    if (b === 'fishing') { const u = t / c.dur; dip = u < 0.7 ? Math.sin(u / 0.7 * Math.PI / 2) * 0.55 : u < 0.8 ? 0.55 + (u - 0.7) * 4.5 : Math.max(0, 1 - (u - 0.8) * 5); }
    if (b === 'gulping') dip = 0;
    const bob = dance ? Math.sin(t * 8) * 6 : 0;
    const hx = lerp(26, 58, dip), hy = lerp(-156 + bob, -26, dip);
    const nk = [14, -116, lerp(4, 38, dip), lerp(-132, -96, dip), lerp(30, 50, dip), lerp(-142, -60, dip), hx, hy];
    card(ctx, strip(nk, 9, 7), '#efe2d7', 1.4);
    if (b === 'gulping') { // a lump travelling down the neck
      const u = clamp(t / c.dur, 0, 1); const seg = u < 0.5 ? [nk[6], nk[7], nk[4], nk[5]] : [nk[4], nk[5], nk[2], nk[3]];
      const v = (u % 0.5) * 2;
      card(ctx, blob(lerp(seg[0], seg[2], v), lerp(seg[1], seg[3], v), 8, 7.5, 0, 9, 10, 0.06), '#e7a13c', 1);
    }
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(lerp(0.08, 1.35, dip));
    card(ctx, blob(0, 0, 9, 7.5, 0, c.id + 5, 12, 0.05), '#f6ece3', 1.2);
    card(ctx, cut([6, -1.5, 34, 0, 34, 3, 6, 3], 6, 0.3, 40), '#e2a94a', 1);
    card(ctx, blob(36, 1, 6, 4.5, 0, 7, 10, 0.05), '#3a2f28', 0.8);
    eye(ctx, 2, -2, 2.6, b === 'dancing' ? 0.3 : 0);
    ctx.restore();
  },
});

def('reedotter', {
  name: 'Reed otter', latin: 'Lutra supina', route: 1,
  blurb: 'Spends most of its life on its back, which it would argue is the correct way up.',
  beh: [
    { k: 'floating', name: 'Floating', r: 1, hint: 'Does this when left alone.' },
    { k: 'chasing', name: 'Chasing bubbles', r: 2, hint: 'Cannot resist bubbles.' },
    { k: 'juggling', name: 'Juggling', r: 3, hint: 'Give it something to play with.' },
  ],
  box: (c) => c.beh === 'chasing' && c.k.under ? [-30, -12, 40, 6] : [-66, -46, 58, 8],
  think(c, w, dt) {
    c.k.belly = clamp((c.k.belly || 0) + ((c.beh === 'floating' || c.beh === 'juggling' || !c.beh && !c.act) ? -dt * 2 : dt * 2), 0, 1);
    if (c.act === 'fruit') {
      const f = c.tgt; if (!f || f.state === 'gone' || (f.state === 'held' && f.owner !== c.id)) { stop(c, w); return; }
      if (c.beh === 'juggling') { if (fruitTick(c, w, dt)) stop(c, w); return; }
      if (walk(c, f.x, 40, dt)) { eatFruit(c, f, 'juggling', 6); f.y = c.y; }
      return;
    }
    if (c.beh === 'chasing') {
      const u = c.bt % 1.6; c.k.under = u > 0.5 && u < 1.1;
      if (c.k.bx != null) walk(c, c.k.bx + Math.sin(c.bt * 2) * 30, 46, dt);
      if (Math.floor(c.bt / 1.6) !== Math.floor((c.bt - dt) / 1.6)) { fx(w, c, 'splash', 10, 0); w.sound('splash', c); }
      if (c.bt > c.dur) { c.k.under = false; stop(c, w); }
      return;
    }
    if (c.beh === 'floating') { c.x += Math.sin(c.t * 0.4 + c.id) * dt * 4; if (c.bt > c.dur) stop(c, w, [1, 2.5]); return; }
    if (c.act === 'swim') { if (walk(c, c.k.to, 22, dt)) { c.act = null; c.moving = 0; start(c, 'floating', 7 + w.r() * 4); } return; }
    c.next -= dt;
    if (c.next <= 0) { if (w.r() < 0.4) { c.act = 'swim'; c.k.to = c.home + (w.r() - 0.5) * 140; } else start(c, 'floating', 7 + w.r() * 4); }
  },
  fruit(c, f) { if (c.beh === 'chasing') return false; toFruit(c, f); return true; },
  bubble(c, w, b) {
    if (c.beh === 'juggling' || c.act === 'fruit') return;
    if (c.beh !== 'chasing') { c.act = null; start(c, 'chasing', 5.5); w.sound('squeak', c); }
    c.k.bx = b.lx;
  },
  draw(ctx, c) {
    const b = c.beh, t = c.bt, belly = c.k.belly || 0;
    const bob = Math.sin(c.t * 2 + c.id) * 1.6;
    ctx.translate(0, bob);
    if (b === 'chasing' && c.k.under) {
      ctx.fillStyle = 'rgba(40,70,70,.35)'; ctx.fill(blob(0, 0, 34, 7, 0, 3, 14, 0.1));
      card(ctx, blob(24, -4, 9, 7, 0, 4, 10, 0.05), '#6e4528', 1);
      return;
    }
    const up = belly < 0.5; // on its back
    card(ctx, strip([-36, -6, -52, -4, -64, -10], 9, 3), '#6a4226', 1.2);
    if (up) {
      card(ctx, blob(0, -10, 42, 13, 0, c.id + 1, 20, 0.05), '#7a4e2c', 2);
      card(ctx, blob(2, -15, 32, 7, 0, c.id + 2, 16, 0.07), '#d1a982', 0);
      const jug = b === 'juggling';
      const pz = jug ? Math.sin(t * 9) * 4 : 0;
      card(ctx, blob(12, -24 - pz, 5, 6, 0.3, 5, 10, 0.1), '#6a4226', 1);
      card(ctx, blob(24, -24 + pz, 5, 6, -0.3, 6, 10, 0.1), '#6a4226', 1);
      pin(ctx, 12, -18, 1.8); pin(ctx, 24, -18, 1.8);
      if (jug) {
        const h = Math.abs(Math.sin(t * 4.5)) * 30;
        card(ctx, blob(18, -34 - h, 7, 7, t * 3, 2, 10, 0.08), '#e0573f', 1.4);
        ctx.fillStyle = '#4c7a2a'; ctx.fillRect(17, -42 - h, 2, 4);
      }
      ctx.save(); ctx.translate(42, -14); ctx.rotate(-0.25);
      card(ctx, blob(0, 0, 14, 11.5, 0, c.id + 3, 14, 0.05), '#82542f', 1.6);
      card(ctx, blob(8, -2, 7, 6, 0, 7, 10, 0.05), '#d1a982', 0);
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.ellipse(14, -4, 2.6, 2, 0, 0, 7); ctx.fill();
      card(ctx, blob(-8, -10, 4, 3.5, 0, 8, 8, 0.1), '#6a4226', 0.6);
      eye(ctx, 4, -6, 2.4, jug ? 0.7 : 0.1);
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(22, 2); ctx.moveTo(12, 1); ctx.lineTo(21, 5); ctx.stroke();
      ctx.restore();
    } else {
      card(ctx, blob(0, -6, 40, 11, 0, c.id + 1, 20, 0.05), '#6a4226', 2);
      ctx.save(); ctx.translate(40, -12);
      card(ctx, blob(0, 0, 13, 10.5, 0, c.id + 3, 14, 0.05), '#73492a', 1.6);
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.ellipse(12, -1, 2.4, 2, 0, 0, 7); ctx.fill();
      eye(ctx, 3, -4, 2.4, 0);
      ctx.restore();
    }
    // water lapping in front
    ctx.fillStyle = 'rgba(120,165,160,.75)';
    ctx.fill(blob(0, 4, 50, 6, 0, 9 + Math.floor(c.t * 2) % 3, 18, 0.08));
  },
});

def('boomer', {
  name: 'Boomer', latin: 'Bufo tonitrualis', route: 1,
  blurb: 'A marsh toad with one great talent, and it is not subtle.',
  beh: [
    { k: 'basking', name: 'Basking', r: 1, hint: 'Does this when left alone.' },
    { k: 'booming', name: 'Booming', r: 2, hint: 'Will answer back, loudly.' },
    { k: 'ballooning', name: 'Ballooning', r: 3, hint: 'Something light, drifting by.' },
  ],
  box: (c) => { const l = c.k.lift || 0; return [-38, -56 - l, 40, 2 - l]; },
  think(c, w, dt) {
    if (c.beh === 'ballooning') {
      const u = c.bt / c.dur;
      c.k.lift = (u < 0.3 ? Math.sin(u / 0.3 * Math.PI / 2) : u > 0.82 ? Math.cos((u - 0.82) / 0.18 * Math.PI / 2) : 1) * 80;
      if (c.bt > c.dur) { c.k.lift = 0; fx(w, c, 'splash', 0, 0); w.sound('plop', c); stop(c, w); }
      return;
    }
    if (c.beh === 'booming') {
      if (Math.floor(c.bt / 1.1) !== Math.floor((c.bt - dt) / 1.1) && c.bt > 0.3) { fx(w, c, 'ring', 8, -16, { life: 1.4 }); w.sound('boom', c); }
      if (c.bt > c.dur) stop(c, w); return;
    }
    if (c.beh === 'basking') { if (c.bt > c.dur) stop(c, w, [1, 2]); return; }
    c.next -= dt; if (c.next <= 0) start(c, 'basking', 5 + w.r() * 3);
  },
  whistle(c, w) { if (c.beh === 'ballooning') return; start(c, 'booming', 3.8); c.bt = -w.r() * 0.3; },
  bubble(c, w) { if (c.beh === 'ballooning') return; start(c, 'ballooning', 6.5); w.sound('bloop', c); },
  draw(ctx, c) {
    const b = c.beh, t = c.bt, lift = c.k.lift || 0;
    ctx.translate(0, -lift);
    if (lift > 1) { ctx.translate(Math.sin(c.t * 2) * lift * 0.06, 0); ctx.rotate(Math.sin(c.t * 1.5) * 0.08); }
    const sac = b === 'booming' && t > 0 ? 0.4 + 0.6 * Math.abs(Math.sin(t * Math.PI / 1.1)) : (b === 'basking' ? 0.25 + 0.1 * Math.sin(t * 3) : 0.2);
    card(ctx, blob(-26, -6, 12, 6, 0.3, 1, 10, 0.1), '#6c7a30', 1);
    card(ctx, blob(0, -20, 32, 20, 0, c.id + 2, 20, 0.05), '#7f8f3a', 2.2);
    for (let i = 0; i < 5; i++) { const r = rng(c.id * 5 + i); ctx.fillStyle = '#65742b'; ctx.fill(blob(-20 + r() * 34, -30 + r() * 16, 3 + r() * 3, 2.4 + r() * 2, 0, i, 8, 0.2)); }
    card(ctx, blob(22, -4, 11, 5, -0.2, 3, 10, 0.1), '#6c7a30', 1);
    card(ctx, blob(14, -8, 14 * sac + 4, 11 * sac + 3, 0, 4, 14, 0.04), '#ecdb8c', sac > 0.5 ? 1.4 : 0);
    for (const x of [-10, 14]) {
      card(ctx, blob(x, -38, 9, 8, 0, x + 9, 12, 0.06), '#879a3e', 1.4);
      eye(ctx, x + 1, -40, 4.6, b === 'basking' && Math.sin(t * 1.2) > 0.6 ? 0.85 : 0, '#1a1408', '#f1c84a');
    }
    ctx.strokeStyle = '#3b4416'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(6, -18); ctx.quadraticCurveTo(20, -14, 30, -20); ctx.stroke();
    if (lift > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(210,240,250,.22)';
      ctx.beginPath(); ctx.arc(0, -24, 48, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-18, -50, 9, 5, -0.6, 0, TAU); ctx.fill();
    }
  },
});

// ---- The Glow Caves
def('lampjelly', {
  name: 'Lampjelly', latin: 'Aerelia lucerna', route: 2, glows: true,
  blurb: 'Drifts through the cave air like a lantern that has wandered off on its own.',
  beh: [
    { k: 'drifting', name: 'Drifting', r: 1, hint: 'Does this when left alone.' },
    { k: 'gathering', name: 'Gathering', r: 2, hint: 'Curious about anything else that floats.' },
    { k: 'lightsout', name: 'Lights out', r: 3, hint: 'A whistle in the dark.' },
  ],
  box: () => [-26, -24, 26, 46],
  think(c, w, dt) {
    const k = c.k;
    if (c.beh === 'gathering') {
      fly(c, k.gx + Math.sin(c.t * 1.3 + c.id) * 20, k.gy + Math.cos(c.t * 1.1 + c.id) * 14, 26, dt);
      if (c.bt > c.dur) start(c, 'drifting', 99);
      return;
    }
    if (c.beh === 'lightsout') {
      k.dim = clamp(c.bt * 1.2, 0, 1) * clamp((c.dur - c.bt) * 1.2, 0, 1);
      c.y = lerp(c.homeY, c.homeY + 44, k.dim);
      if (c.bt > c.dur) { k.dim = 0; start(c, 'drifting', 99); }
      return;
    }
    if (!c.beh) start(c, 'drifting', 99);
    fly(c, c.home + Math.sin(c.t * 0.21 + c.id) * 60, c.homeY + Math.sin(c.t * 0.5 + c.id * 2) * 18, 12, dt);
  },
  bubble(c, w, b) { if (c.beh === 'lightsout') return; if (c.beh !== 'gathering') w.sound('chime', c); start(c, 'gathering', 6); c.k.gx = b.lx; c.k.gy = b.y; },
  whistle(c, w) { if (c.beh === 'lightsout') return; start(c, 'lightsout', 6.5); w.sound('dim', c); },
  draw(ctx, c) {
    const b = c.beh, t = c.bt, dim = c.k.dim || 0;
    const pulse = b === 'gathering' ? 0.75 + 0.25 * Math.sin(t * 9) : 0.55 + 0.15 * Math.sin(c.t * 2 + c.id);
    const lit = (1 - dim) * pulse;
    glow(ctx, 0, 4, 70, `rgba(120,240,210,${0.55 * lit})`);
    for (let i = 0; i < 5; i++) {
      const pts = []; const x0 = -14 + i * 7;
      for (let j = 0; j <= 6; j++) { const u = j / 6; pts.push(x0 + Math.sin(c.t * 2.4 + i + u * 4) * 4 * u, 6 + u * (34 + (i % 2) * 8)); }
      card(ctx, strip(pts, 2.6, 0.8), dim > 0.5 ? '#3c5a68' : '#9fe8d8', 0);
    }
    const s = 1 + 0.06 * Math.sin(c.t * 3 + c.id);
    ctx.save(); ctx.scale(s, 1 / s);
    const bell = blobPts(0, 8, 24, 26, 0, c.id + 1, 20, 0.03, Math.PI, TAU);
    card(ctx, pathFrom([...bell, 24, 8, -24, 8]), dim > 0.5 ? '#2c4656' : '#7fe0cc', 1.4);
    card(ctx, blob(0, -2, 13, 9, 0, c.id + 2, 12, 0.06), dim > 0.5 ? '#33505e' : '#c9fff0', 0);
    ctx.restore();
    if (lit > 0.3) glow(ctx, 0, -2, 18, `rgba(230,255,248,${lit})`);
  },
});

def('shellcap', {
  name: 'Shellcap', latin: 'Carcinus fungifer', route: 2,
  blurb: 'A crab that carries a mushroom on its back. The mushroom, in turn, carries a light.',
  beh: [
    { k: 'scuttling', name: 'Scuttling', r: 1, hint: 'Does this when left alone.' },
    { k: 'snacking', name: 'Snacking', r: 2, hint: 'Will not refuse a fruit.' },
    { k: 'hiding', name: 'Hiding', r: 3, hint: 'Easily startled by a noise.' },
  ],
  box: (c) => c.beh === 'hiding' ? [-34, -34, 34, 0] : [-40, -60, 42, 0],
  think(c, w, dt) {
    if (c.act === 'fruit') {
      const f = c.tgt; if (!f || f.state === 'gone' || (f.state === 'held' && f.owner !== c.id)) { stop(c, w); return; }
      if (c.beh === 'snacking') { if (Math.floor(c.bt * 3) !== Math.floor((c.bt - dt) * 3)) w.sound('snip', c); if (fruitTick(c, w, dt)) stop(c, w); return; }
      if (walk(c, side(c, f, 34), 34, dt)) eatFruit(c, f, 'snacking', 6);
      return;
    }
    if (c.beh === 'hiding') { c.moving = 0; if (c.bt > c.dur) stop(c, w); return; }
    if (c.beh === 'scuttling') { if (walk(c, c.k.to, 30, dt) || c.bt > c.dur) { c.moving = 0; stop(c, w, [1.5, 3]); } return; }
    c.next -= dt; if (c.next <= 0) { start(c, 'scuttling', 5); c.k.to = c.home + (w.r() - 0.5) * 170; }
  },
  fruit(c, f) { if (c.beh === 'hiding') return false; toFruit(c, f); return true; },
  whistle(c, w) { if (c.act === 'fruit') return; c.moving = 0; start(c, 'hiding', 5.5); w.sound('tuck', c); },
  draw(ctx, c) {
    const b = c.beh, t = c.bt, mv = c.moving ? c.ph : 0;
    const hide = b === 'hiding' ? clamp(t * 4, 0, 1) * clamp((c.dur - t) * 2, 0, 1) : 0;
    const snip = b === 'snacking' ? Math.sin(t * 18) : 0;
    if (hide < 0.9) for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      const ph = Math.sin(mv * 1.6 + i * 2 + (s > 0 ? 1 : 0)) * 4;
      const x0 = s * (10 + i * 5);
      card(ctx, strip([x0, -14 + hide * 10, x0 + s * 12, -16 + hide * 10, x0 + s * 18 + ph, 0], 3.4, 2), '#b84a32', 0.8);
    }
    ctx.save(); ctx.translate(0, hide * 12);
    card(ctx, blob(0, -16, 24, 11, 0, c.id + 1, 16, 0.06), '#d8653f', 1.6);
    for (const s of [-1, 1]) {
      const cx = s * 22 + (s > 0 ? snip * 2 : 0), cy = -22 - (s > 0 && b === 'snacking' ? 6 : 0);
      card(ctx, strip([s * 12, -16, cx, cy + 4], 4, 3), '#c85438', 0.8);
      card(ctx, blob(cx + s * 6, cy, 8, 6, s * 0.4, 5 + s, 10, 0.05), '#e06e46', 1.2);
      card(ctx, cut([cx + s * 10, cy - 3, cx + s * 18, cy - 6 - snip * 2, cx + s * 12, cy], 8, 0.3, 20), '#e06e46', 0);
      pin(ctx, s * 12, -16, 1.6);
    }
    for (const s of [-1, 1]) { card(ctx, strip([s * 5, -24, s * 7, -34], 2, 2), '#c85438', 0); eye(ctx, s * 7, -35, 2.8, 0); }
    ctx.restore();
    // the mushroom
    const capY = -36 + hide * 24;
    card(ctx, strip([0, -20 + hide * 10, 0, capY], 9, 7), '#e9e0d2', 0.6);
    const cap = blobPts(0, capY + 4, 32, 22, 0, c.id + 3, 20, 0.04, Math.PI, TAU);
    card(ctx, pathFrom([...cap, 32, capY + 4, -32, capY + 4]), '#eee5d6', 2);
    const bright = 0.55 + hide * 0.45;
    for (const [x, y, r] of [[-14, -8, 4], [2, -14, 5], [16, -7, 3.5], [-4, -3, 3]]) {
      ctx.fillStyle = '#7ff0d0'; ctx.beginPath(); ctx.arc(x, capY + y + 4, r, 0, TAU); ctx.fill();
      glow(ctx, x, capY + y + 4, r * 5, `rgba(127,240,208,${0.45 * bright})`);
    }
  },
});

def('hushbat', {
  name: 'Hushbat', latin: 'Nyctalus silens', route: 2,
  blurb: 'Hangs from the ceiling by day which, down here, is always.',
  beh: [
    { k: 'roosting', name: 'Roosting', r: 1, hint: 'Does this when left alone.' },
    { k: 'swirling', name: 'Swirling', r: 2, hint: 'Light sleepers.' },
    { k: 'catching', name: 'Catching fruit', r: 3, hint: 'Toss something up near the roost.' },
  ],
  box: (c) => c.k.flying ? [-34, -18, 34, 18] : [-15, -2, 15, 48],
  think(c, w, dt) {
    const k = c.k;
    if (c.beh === 'swirling') {
      k.flying = 1; const a = c.bt * 1.6 + c.id; const r = 60 + 30 * Math.sin(c.bt * 0.7 + c.id);
      const env = clamp(c.bt * 0.8, 0, 1) * clamp((c.dur - c.bt) * 0.8, 0, 1);
      c.x = lerp(c.home, c.home + Math.cos(a) * r * 1.5, env); c.y = lerp(c.homeY, c.homeY + 90 + Math.sin(a) * r, env);
      c.face = -Math.sin(a) > 0 ? 1 : -1;
      if (c.bt > c.dur) { c.x = c.home; c.y = c.homeY; k.flying = 0; stop(c, w); }
      return;
    }
    if (c.beh === 'catching') {
      const f = c.tgt;
      if (k.stage === 0) { k.flying = 1; if (fly(c, k.fx, k.fy, 150, dt)) { k.stage = 1; if (f) { f.state = 'held'; f.owner = c.id; f.ownerSp = c.sp; } w.sound('snap', c); } }
      else if (k.stage === 1) { if (fly(c, c.home, c.homeY, 90, dt)) { k.stage = 2; k.flying = 0; } }
      else if (f) { f.bites = Math.min(1, f.bites + dt / 3); }
      if (f && f.state === 'held') { f.x = c.x; f.y = c.y + (k.flying ? 10 : 40); }
      if (c.bt > c.dur) { if (f) f.state = 'gone'; c.tgt = null; k.flying = 0; c.x = c.home; c.y = c.homeY; stop(c, w); }
      return;
    }
    if (!c.beh) start(c, 'roosting', 99);
  },
  catchFruit(c, w, f, lx, ly) { if (c.beh === 'catching' || c.beh === 'swirling') return false; start(c, 'catching', 6.5); c.k.stage = 0; c.k.fx = lx; c.k.fy = ly; c.tgt = f; return true; },
  whistle(c, w) { if (c.beh === 'catching' || c.beh === 'swirling') return; start(c, 'swirling', 7); c.bt = -w.r() * 0.6; w.sound('flutter', c); },
  draw(ctx, c) {
    const b = c.beh, t = c.bt;
    if (c.k.flying) {
      const fl = Math.sin(c.t * 18 + c.id);
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1); ctx.rotate(fl * 0.5 * -1);
        card(ctx, cut([2, -2, 18, -16, 26, -10, 34, -12, 30, 2, 22, -2, 14, 6, 2, 4], 3 + s, 0.4, 30), '#4a3670', 1.4);
        ctx.restore();
      }
      card(ctx, blob(0, 0, 8, 10, 0, c.id, 12, 0.06), '#3d2c5c', 1.4);
      for (const s of [-1, 1]) card(ctx, cut([s * 3, -8, s * 7, -16, s * 7, -6], 5, 0.3, 20), '#3d2c5c', 0);
      eye(ctx, -3, -2, 1.8, 0, '#2a1a08', '#ffd27a'); eye(ctx, 3, -2, 1.8, 0, '#2a1a08', '#ffd27a');
      return;
    }
    const sway = Math.sin(c.t * 1.2 + c.id) * 0.08;
    ctx.rotate(sway);
    ctx.strokeStyle = '#2a1f40'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-3, 6); ctx.moveTo(4, 0); ctx.lineTo(3, 6); ctx.stroke();
    card(ctx, blob(0, 22, 13, 19, 0, c.id + 1, 16, 0.05), '#3d2c5c', 1.6);
    card(ctx, blob(-5, 22, 7, 15, 0.1, c.id + 2, 12, 0.06), '#4a3670', 0);
    for (const s of [-1, 1]) card(ctx, cut([s * 4, 38, s * 9, 48, s * 9, 36], 7 + s, 0.3, 20), '#3d2c5c', 0.8);
    card(ctx, blob(0, 36, 8, 6, 0, c.id + 3, 10, 0.05), '#56427c', 0);
    const sleepy = b === 'roosting';
    eye(ctx, -3, 36, 1.8, sleepy ? 0.85 : 0, '#2a1a08', '#ffd27a'); eye(ctx, 3, 36, 1.8, sleepy ? 0.85 : 0, '#2a1a08', '#ffd27a');
  },
});

// ---- The River at Night
def('gloamer', {
  name: 'Gloamer', latin: 'Ursus crepuscularis', route: 3,
  blurb: 'Enormous, shaggy and, for something so big, remarkably polite.',
  beh: [
    { k: 'fishing', name: 'Fishing', r: 1, hint: 'Does this when left alone.' },
    { k: 'feasting', name: 'Feasting', r: 2, hint: 'Accepts gifts of fruit.' },
    { k: 'moonsong', name: 'Moonsong', r: 3, hint: 'Sings only on a full stomach.' },
  ],
  box: () => [-80, -150, 104, 0],
  think(c, w, dt) {
    c.k.fed = Math.max(0, (c.k.fed || 0) - dt);
    if (c.act === 'fruit') {
      const f = c.tgt; if (!f || f.state === 'gone' || (f.state === 'held' && f.owner !== c.id)) { stop(c, w); return; }
      if (c.beh === 'feasting') { if (fruitTick(c, w, dt)) { c.k.fed = 40; stop(c, w); } return; }
      if (walk(c, side(c, f, 84), 22, dt)) eatFruit(c, f, 'feasting', 6);
      return;
    }
    if (c.beh === 'moonsong') { if (Math.floor(c.bt * 1.5) !== Math.floor((c.bt - dt) * 1.5)) fx(w, c, 'note', 76, -150); if (c.bt > c.dur) stop(c, w); return; }
    if (c.beh === 'fishing') {
      if (Math.floor(c.bt / 2) !== Math.floor((c.bt - dt) / 2)) { fx(w, c, 'splash', 90, 0); w.sound('splash', c); }
      if (c.bt > c.dur) { if (w.r() < 0.5) fx(w, c, 'fish', 84, -40); stop(c, w, [1.5, 3]); }
      return;
    }
    if (c.act === 'amble') { if (walk(c, c.k.to, 14, dt)) { c.act = null; c.moving = 0; } return; }
    c.next -= dt;
    if (c.next <= 0) { if (w.r() < 0.3) { c.act = 'amble'; c.k.to = c.home + (w.r() - 0.5) * 160; } else start(c, 'fishing', 5 + w.r() * 2); }
  },
  fruit(c, f) { if (c.beh === 'moonsong') return false; toFruit(c, f); return true; },
  whistle(c, w) {
    if (c.act === 'fruit' || c.beh === 'moonsong') return;
    if (c.k.fed > 0) { c.act = null; c.moving = 0; start(c, 'moonsong', 7); w.sound('howl', c); }
    else w.sound('huff', c);
  },
  draw(ctx, c) {
    const b = c.beh, t = c.bt, mv = c.moving ? c.ph : 0;
    for (const [x, o] of [[-46, 0], [-20, 1.6], [30, 3.2], [54, 4.8]]) {
      const lift = c.moving ? Math.max(0, Math.sin(mv + o)) * 7 : 0;
      card(ctx, cut([x - 13, -40, x + 13, -40, x + 14, -lift, x - 14, -lift], x + 3, 2, 8), x < 0 ? '#2c3858' : '#34416a', 1.6);
    }
    const sit = b === 'moonsong' ? clamp(t * 2, 0, 1) * clamp((c.dur - t) * 2, 0, 1) : 0;
    ctx.save(); ctx.translate(-10, -10); ctx.rotate(-sit * 0.32); ctx.translate(10, 10);
    card(ctx, blob(0, -66, 74, 46, 0, c.id + 1, 44, 0.12), '#3b4a72', 2.8);
    card(ctx, blob(10, -50, 46, 22, 0, c.id + 2, 30, 0.14), '#4c5c88', 0);
    // fishing paw
    let paw = 0;
    if (b === 'fishing') { const u = (t % 2) / 2; paw = u < 0.7 ? u / 0.7 : 1 - (u - 0.7) / 0.3 * 2; }
    const px = 74 + paw * 6, py = lerp(-60, -10, clamp(paw, 0, 1)) - (b === 'fishing' && (t % 2) < 1.2 ? 26 * Math.sin(((t % 2) / 1.2) * Math.PI) : 0);
    card(ctx, strip([52, -60, px - 6, (py - 60) / 2, px, py], 22, 16), '#34416a', 1.6);
    card(ctx, blob(px + 2, py, 12, 9, 0, 9, 12, 0.12), '#2c3858', 1);
    pin(ctx, 52, -60, 3);
    // head
    const hx = 70 - sit * 6, hy = -104 - sit * 26;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-sit * 0.7 + (b === 'feasting' ? 0.35 + Math.sin(t * 6) * 0.05 : 0));
    for (const s of [-1, 1]) card(ctx, blob(s * 14 - 4, -22, 9, 8, 0, 20 + s, 10, 0.12), '#34416a', 1);
    card(ctx, blob(0, 0, 30, 25, 0, c.id + 3, 28, 0.13), '#45547e', 2);
    card(ctx, blob(22, 8, 15, 11, 0, c.id + 4, 14, 0.06), '#6b789e', 0.6);
    ctx.fillStyle = '#141a2c'; ctx.beginPath(); ctx.ellipse(34, 4, 5, 4, 0, 0, TAU); ctx.fill();
    const blink = Math.sin(c.t * 0.7 + c.id) > 0.985 ? 1 : 0;
    for (const x of [4, 18]) { eye(ctx, x, -6, 5, blink, '#141a2c', '#f6eaa8'); glow(ctx, x, -6, 14, 'rgba(246,234,168,.35)'); }
    if (b === 'moonsong') { ctx.fillStyle = '#141a2c'; ctx.beginPath(); ctx.ellipse(26, 16, 5, 6 + Math.sin(t * 5) * 1.5, 0, 0, TAU); ctx.fill(); }
    if (b === 'feasting' && c.tgt) card(ctx, blob(32, 18, 8 * (1 - c.tgt.bites * 0.7), 8 * (1 - c.tgt.bites * 0.7), 0, 5, 10, 0.06), '#e0573f', 1);
    ctx.restore();
    ctx.restore();
  },
});

const WISP_N = 16;
const starPt = (i) => { const k = i % 10, a = -Math.PI / 2 + k / 10 * TAU, r = k % 2 ? 16 : 40; const m = (i / 10 | 0) * 0.5; const a2 = a + m * 0.3; return [Math.cos(a2) * r * (1 - m * 0.4), Math.sin(a2) * r * (1 - m * 0.4)]; };
def('wisps', {
  name: 'Wisp', latin: 'Lampyris concors', route: 3, glows: true,
  blurb: 'Each light is a tiny beetle. Together, they seem to think as one.',
  beh: [
    { k: 'dancing', name: 'Dancing', r: 1, hint: 'Does this when left alone.' },
    { k: 'riding', name: 'Riding bubbles', r: 2, hint: 'They like to travel.' },
    { k: 'constellation', name: 'A new constellation', r: 3, hint: 'They answer a whistle together.' },
  ],
  box: () => [-50, -46, 50, 46],
  think(c, w, dt) {
    if (c.beh === 'riding') { fly(c, c.k.gx, c.k.gy - 30 * Math.min(1, c.bt / 4), 30, dt); if (c.bt > c.dur) start(c, 'dancing', 99); return; }
    if (c.beh === 'constellation') { if (c.bt > c.dur) start(c, 'dancing', 99); return; }
    if (!c.beh) start(c, 'dancing', 99);
    fly(c, c.home + Math.sin(c.t * 0.3 + c.id) * 70, c.homeY + Math.sin(c.t * 0.6 + c.id) * 26, 18, dt);
  },
  bubble(c, w, b) { if (c.beh === 'constellation') return; if (c.beh !== 'riding') w.sound('chime', c); start(c, 'riding', 6); c.k.gx = b.lx; c.k.gy = b.y; },
  whistle(c, w) { if (c.beh === 'constellation') return; start(c, 'constellation', 5.5); w.sound('sparkle', c); },
  draw(ctx, c) {
    const b = c.beh, t = c.bt;
    const form = b === 'constellation' ? clamp(t * 1.2, 0, 1) * clamp((c.dur - t) * 1.2, 0, 1) : 0;
    const ride = b === 'riding' ? clamp(t * 1.5, 0, 1) * clamp((c.dur - t) * 1.5, 0, 1) : 0;
    const pts = [];
    for (let i = 0; i < WISP_N; i++) {
      const a = c.t * (0.9 + (i % 5) * 0.17) + i * 2.4, r = 22 + (i * 7) % 26;
      let x = Math.cos(a) * r + Math.sin(c.t * 1.7 + i) * 8, y = Math.sin(a * 1.3) * r * 0.6;
      if (form) { const [sx, sy] = starPt(i); x = lerp(x, sx, form); y = lerp(y, sy, form); }
      if (ride) { const g = i % 3; const bx = (g - 1) * 30, by = Math.sin(c.t * 2 + g) * 6; x = lerp(x, bx + Math.cos(a * 2) * 6, ride); y = lerp(y, by + Math.sin(a * 2) * 6, ride); }
      pts.push([x, y]);
    }
    if (ride > 0.2) for (let g = 0; g < 3; g++) {
      const bx = (g - 1) * 30, by = Math.sin(c.t * 2 + g) * 6;
      ctx.strokeStyle = `rgba(255,250,220,${0.7 * ride})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(bx, by, 13, 0, TAU); ctx.stroke();
      glow(ctx, bx, by, 26, `rgba(255,230,140,${0.5 * ride})`);
    }
    if (form > 0.5) {
      ctx.strokeStyle = `rgba(255,240,180,${(form - 0.5) * 0.7})`; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let i = 0; i <= 10; i++) { const [x, y] = starPt(i % 10); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    }
    for (const [x, y] of pts) {
      glow(ctx, x, y, 10 + form * 4, 'rgba(255,226,120,.55)');
      ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
    }
  },
});

def('moonmoth', {
  name: 'Moonmoth', latin: 'Selenia lata', route: 3,
  blurb: 'The size of a dinner plate, and nearly as pale as the moon it is named for.',
  beh: [
    { k: 'resting', name: 'Resting', r: 1, hint: 'Does this when left alone.' },
    { k: 'sipping', name: 'Sipping fruit', r: 2, hint: 'Has a sweet tooth.' },
    { k: 'fluttering', name: 'Moon-chasing', r: 3, hint: 'Mistakes round shiny things for little moons.' },
  ],
  box: (c) => c.k.flying ? [-50, -34, 50, 30] : [-30, -50, 30, 8],
  think(c, w, dt) {
    const k = c.k;
    if (c.act === 'fruit') {
      const f = c.tgt; if (!f || f.state === 'gone' || (f.state === 'held' && f.owner !== c.id)) { k.back = 1; c.act = null; stop(c, w); return; }
      if (c.beh === 'sipping') { k.flying = 0; if (fruitTick(c, w, dt)) { k.back = 1; c.act = null; stop(c, w); } return; }
      k.flying = 1;
      if (fly(c, f.x - 20, f.y - 8, 60, dt)) { eatFruit(c, f, 'sipping', 6); k.flying = 0; }
      return;
    }
    if (c.beh === 'fluttering') {
      k.flying = 1; fly(c, k.gx + Math.sin(c.bt * 2.2) * 40, k.gy + Math.cos(c.bt * 3) * 20, 70, dt);
      if (c.bt > c.dur) { k.back = 1; stop(c, w); }
      return;
    }
    if (k.back) { k.flying = 1; if (fly(c, c.home, c.homeY, 60, dt)) { k.back = 0; k.flying = 0; } return; }
    if (c.beh === 'resting') { if (c.bt > c.dur) stop(c, w, [0.2, 0.6]); return; }
    c.next -= dt; if (c.next <= 0) start(c, 'resting', 8 + w.r() * 4);
  },
  fruit(c, f) { if (c.beh === 'fluttering' || c.k.back) return false; toFruit(c, f); return true; },
  bubble(c, w, b) { if (c.act === 'fruit') return; if (c.beh !== 'fluttering') w.sound('flutter', c); start(c, 'fluttering', 6); c.k.gx = b.lx; c.k.gy = b.y; },
  draw(ctx, c) {
    const b = c.beh, t = c.bt;
    const wing = (sx, open) => {
      ctx.save(); ctx.scale(sx, 1);
      const o = open;
      const fore = [0, -4, lerp(6, 38, o), lerp(-44, -30, o), lerp(14, 48, o), lerp(-40, -8, o), lerp(6, 20, o), lerp(-10, 2, o)];
      card(ctx, cut(fore, 5 + sx, 0.6, 9), '#ddd6f0', 1.6);
      const hind = [0, 0, lerp(4, 30, o), lerp(-20, 6, o), lerp(4, 36, o), lerp(-2, 26, o), lerp(2, 10, o), lerp(4, 20, o)];
      card(ctx, cut(hind, 7 + sx, 0.6, 9), '#c9c0e6', 1.2);
      ctx.fillStyle = '#6f5fa8'; ctx.beginPath(); ctx.arc(lerp(8, 32, o), lerp(-26, -18, o), 4.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f5edd2'; ctx.beginPath(); ctx.arc(lerp(8, 32, o), lerp(-26, -18, o), 2, 0, TAU); ctx.fill();
      ctx.restore();
    };
    if (c.k.flying) {
      const fl = 0.35 + 0.65 * Math.abs(Math.sin(c.t * 9 + c.id));
      ctx.save(); ctx.scale(1, fl); wing(-1, 1); wing(1, 1); ctx.restore();
    } else {
      const fan = b === 'resting' ? Math.max(0, Math.sin(t * 1.3)) ** 6 * 0.5 : 0;
      wing(-1, 0.42 + fan * 0.4); wing(1, 0.42 + fan);
    }
    card(ctx, strip([0, -16, 0, 10], 7, 4), '#efe8d8', 1.2);
    for (const s of [-1, 1]) {
      const pts = [s * 2, -16, s * 8, -28, s * 12, -34];
      card(ctx, strip(pts, 3.5, 1), '#d8cfae', 0);
    }
    if (b === 'sipping') {
      ctx.strokeStyle = '#a89a70'; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(0, -12); ctx.quadraticCurveTo(10, -6 + Math.sin(t * 4) * 2, 18, 6); ctx.stroke();
    }
  },
});

export const SPECIES_LIST = Object.values(SPECIES);
export function behInfo(sp, k) { return SPECIES[sp].beh.find((b) => b.k === k); }
