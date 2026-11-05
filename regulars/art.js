// The look: flat colour cut loose from a thin ink line, the way 1950s cartoon studios printed them.
// Every shape is a fill slightly off-register from its wobbly outline. Nothing here animates, so it can all be cached.
export const INK = '#2a2420';
export const PAPER = '#f4ead4';

export const rng = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

export function wob(pts, amp, seed) {
  const r = rng(seed * 7919 + 13);
  return pts.map(([x, y]) => [x + (r() - .5) * amp * 2, y + (r() - .5) * amp * 2]);
}

function trace(c, pts, closed, smooth) {
  c.beginPath();
  if (!smooth) { pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); if (closed) c.closePath(); return; }
  const n = pts.length;
  if (closed) {
    const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const s = m(pts[n - 1], pts[0]); c.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) { const e = m(pts[i], pts[(i + 1) % n]); c.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); }
    c.closePath();
  } else {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) { const e = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; c.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); }
    c.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
}

let SEED = 1;
export const reseed = (s) => { SEED = s; };

// fill + off-register ink line
export function shape(c, pts, { fill, ink = INK, lw = 1.5, off = 1.6, closed = true, smooth = true, wobble = .6 } = {}) {
  SEED++;
  if (fill) { c.fillStyle = fill; c.save(); c.translate(off, off * .7); trace(c, wob(pts, wobble * .6, SEED), closed, smooth); c.fill(); c.restore(); }
  if (ink) { c.strokeStyle = ink; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; trace(c, wob(pts, wobble, SEED + 500), closed, smooth); c.stroke(); }
}
export const line = (c, pts, o = {}) => shape(c, pts, { closed: false, ...o });

export const box = (x, y, w, h) => { const p = []; const n = 3; for (let i = 0; i < n; i++) p.push([x + w * i / n, y]); for (let i = 0; i < n; i++) p.push([x + w, y + h * i / n]); for (let i = 0; i < n; i++) p.push([x + w - w * i / n, y + h]); for (let i = 0; i < n; i++) p.push([x, y + h - h * i / n]); return p; };
export const ell = (x, y, rx, ry = rx, n = 10) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [x + Math.cos(a) * rx, y + Math.sin(a) * ry]; });
export const rectS = (c, x, y, w, h, o = {}) => shape(c, box(x, y, w, h), { smooth: false, ...o });

const cache = new Map();
export function sprite(key, w, h, scale, draw) {
  const k = key + '@' + scale.toFixed(2);
  let s = cache.get(k);
  if (!s) {
    s = document.createElement('canvas'); s.width = Math.ceil(w * scale); s.height = Math.ceil(h * scale);
    const c = s.getContext('2d'); c.scale(scale, scale); SEED = hash(key); draw(c); cache.set(k, s);
    if (cache.size > 700) cache.delete(cache.keys().next().value);
  }
  return s;
}
export const flushSprites = () => cache.clear();
const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 100000; };

export function grain(w = 160) { // a tile of paper tooth, multiplied over the backdrops
  const g = document.createElement('canvas'); g.width = g.height = w; const c = g.getContext('2d');
  const d = c.createImageData(w, w); const r = rng(99);
  for (let i = 0; i < d.data.length; i += 4) { const v = 232 + r() * 23; d.data[i] = v; d.data[i + 1] = v - 1; d.data[i + 2] = v - 4; d.data[i + 3] = 255; }
  c.putImageData(d, 0, 0); return g;
}

// ——— people ——— a bust, origin at the bottom middle, about 100 wide and 130 tall at size 1
export function drawPerson(c, L, mood = 'idle', dir = 1, blink = false) {
  const sz = L.size || 1; const up = 130 * sz;
  const headR = 27 * (0.8 + .2 * sz) * (sz < .7 ? 1.08 : 1);
  const cx = 0, hy = -up + headR * 1.05;
  const neckY = hy + headR * .9;
  const sw = (L.kind === 'tee' || L.kind === 'stripe' ? 32 : 36) * (0.72 + .28 * sz) * (L.size > 1 ? 1.1 : 1);
  // torso
  const torso = [[-sw - 4, 2], [-sw - 2, neckY + 26], [-sw * .72, neckY + 8], [-12, neckY + 1], [12, neckY + 1], [sw * .72, neckY + 8], [sw + 2, neckY + 26], [sw + 4, 2]];
  shape(c, torso, { fill: L.top, smooth: true, wobble: .5 });
  // neck
  shape(c, [[-9, neckY - 12], [-10, neckY + 8], [0, neckY + 13], [10, neckY + 8], [9, neckY - 12]], { fill: L.skin, wobble: .3, ink: null, off: 0 });
  if (L.kind === 'suit' || L.kind === 'jacket') {
    line(c, [[-11, neckY + 2], [-2, neckY + 40], [0, 2]], { lw: 1.2 }); line(c, [[11, neckY + 2], [2, neckY + 40]], { lw: 1.2 });
    shape(c, [[-9, neckY + 3], [0, neckY + 34], [9, neckY + 3], [0, neckY + 10]], { fill: L.kind === 'jacket' ? '#c9c2a8' : '#efe7d6', lw: 1, off: .6, smooth: false });
    if (L.tie) shape(c, [[-3, neckY + 9], [3, neckY + 9], [4, neckY + 30], [0, neckY + 36], [-4, neckY + 30]], { fill: L.tie, lw: 1, off: .6, smooth: false });
  }
  if (L.bow) { shape(c, [[-11, neckY + 2], [-2, neckY + 6], [-11, neckY + 11]], { fill: L.bow, lw: 1, smooth: false, off: .7 }); shape(c, [[11, neckY + 2], [2, neckY + 6], [11, neckY + 11]], { fill: L.bow, lw: 1, smooth: false, off: .7 }); }
  if (L.kind === 'vest') { shape(c, [[-13, neckY + 3], [0, neckY + 30], [13, neckY + 3], [0, neckY + 8]], { fill: '#efe7d6', lw: 1, off: .6, smooth: false }); line(c, [[-16, neckY + 22], [-3, neckY + 44]], { lw: 1 }); shape(c, ell(13, neckY + 38, 2, 2, 6), { fill: '#d9a53a', lw: .8, off: 0 }); line(c, [[0, neckY + 34], [12, neckY + 37]], { lw: 1, ink: '#b08a2e' }); }
  if (L.kind === 'dress' || L.kind === 'shirt' || L.kind === 'work' || L.kind === 'nurse') { shape(c, [[-13, neckY + 1], [-1, neckY + 12], [-9, neckY + 16]], { fill: '#efe7d6', lw: 1, off: .6, smooth: false }); shape(c, [[13, neckY + 1], [1, neckY + 12], [9, neckY + 16]], { fill: '#efe7d6', lw: 1, off: .6, smooth: false }); }
  if (L.kind === 'stripe') { c.strokeStyle = '#efe7d6'; c.lineWidth = 3.4; for (let y = neckY + 16; y < 0; y += 9) { c.beginPath(); c.moveTo(-sw + 2, y); c.lineTo(sw, y); c.stroke(); } }
  if (L.kind === 'cardigan') { line(c, [[-5, neckY + 8], [-4, 2]], { lw: 1.2 }); line(c, [[5, neckY + 8], [4, 2]], { lw: 1.2 }); for (let i = 0; i < 3; i++) shape(c, ell(-1, neckY + 24 + i * 14, 1.4, 1.4, 6), { fill: INK, ink: null, off: 0 }); }
  if (L.kind === 'apron') { shape(c, [[-20, neckY + 34], [20, neckY + 34], [24, 2], [-24, 2]], { fill: '#fffaf0', lw: 1.1, off: .8 }); line(c, [[-16, neckY + 34], [-9, neckY + 3]], { lw: 1.2 }); line(c, [[16, neckY + 34], [9, neckY + 3]], { lw: 1.2 }); }
  if (L.kind === 'work') { shape(c, box(8, neckY + 26, 15, 13), { fill: '#efe7d6', lw: 1, off: .5, smooth: false }); }
  if (L.kind === 'nurse') { shape(c, ell(-14, neckY + 28, 3, 3, 6), { fill: '#b5392f', lw: .8, off: 0 }); }
  if (L.flower) { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; shape(c, ell(-19 + Math.cos(a) * 3.4, neckY + 22 + Math.sin(a) * 3.4, 2.6, 2.6, 6), { fill: '#f7f1e2', lw: .6, off: 0 }); } shape(c, ell(-19, neckY + 22, 1.8, 1.8, 6), { fill: '#d9a53a', ink: null, off: 0 }); }

  const back = L.hair;
  const hc = L.hairCol;
  // hair behind the head
  if (back === 'long') shape(c, [[-headR - 4, hy - 8], [-headR - 7, hy + 42], [-headR + 6, hy + 46], [headR - 6, hy + 46], [headR + 7, hy + 42], [headR + 4, hy - 8], [0, hy - headR - 6]], { fill: hc });
  if (back === 'bob') shape(c, [[-headR - 5, hy - 10], [-headR - 8, hy + 22], [-headR + 2, hy + 24], [headR - 2, hy + 24], [headR + 8, hy + 22], [headR + 5, hy - 10], [0, hy - headR - 5]], { fill: hc });
  if (back === 'shag') shape(c, [[-headR - 4, hy - 10], [-headR - 6, hy + 24], [-headR + 3, hy + 15], [-headR + 8, hy + 28], [headR - 8, hy + 28], [headR - 3, hy + 15], [headR + 6, hy + 24], [headR + 4, hy - 10], [0, hy - headR - 5]], { fill: hc });
  if (back === 'pigtails') { for (const s of [-1, 1]) { shape(c, [[s * (headR - 2), hy - 5], [s * (headR + 17), hy + 3], [s * (headR + 22), hy + 26], [s * (headR + 8), hy + 18]], { fill: hc }); shape(c, ell(s * (headR + 3), hy, 3.4, 3.4, 6), { fill: '#3f7f9c', lw: .9, off: .4 }); } }
  if (back === 'pony') shape(c, [[dir * -headR * .5, hy - headR], [dir * -(headR + 16), hy - 18], [dir * -(headR + 18), hy + 26], [dir * -(headR + 5), hy + 6]], { fill: hc });
  if (back === 'bun') shape(c, ell(0, hy - headR - 7, 12, 10), { fill: hc });
  if (back === 'beehive') shape(c, ell(0, hy - headR - 12, headR * .8, 25), { fill: hc });
  if (L.ears) { shape(c, ell(-headR, hy + 3, 5, 7, 7), { fill: L.skin, lw: 1.2, off: .5 }); shape(c, ell(headR, hy + 3, 5, 7, 7), { fill: L.skin, lw: 1.2, off: .5 }); }

  // head
  const R = headR;
  const heads = {
    round: ell(0, hy, R, R * 1.02, 12),
    egg: [[-R * .78, hy - R * .7], [0, hy - R * 1.08], [R * .78, hy - R * .7], [R * .98, hy + R * .1], [R * .62, hy + R * .96], [0, hy + R * 1.14], [-R * .62, hy + R * .96], [-R * .98, hy + R * .1]],
    long: [[-R * .72, hy - R * .85], [0, hy - R * 1.18], [R * .72, hy - R * .85], [R * .84, hy + R * .3], [R * .55, hy + R * 1.1], [0, hy + R * 1.3], [-R * .55, hy + R * 1.1], [-R * .84, hy + R * .3]],
    box: [[-R * .98, hy - R * .8], [-R * .4, hy - R * 1.05], [R * .4, hy - R * 1.05], [R * .98, hy - R * .8], [R * 1.04, hy + R * .7], [R * .7, hy + R * 1.08], [-R * .7, hy + R * 1.08], [-R * 1.04, hy + R * .7]],
    pear: [[-R * .62, hy - R * .85], [0, hy - R * 1.08], [R * .62, hy - R * .85], [R * 1.0, hy + R * .3], [R * .96, hy + R * .9], [0, hy + R * 1.12], [-R * .96, hy + R * .9], [-R * 1.0, hy + R * .3]],
  };
  shape(c, heads[L.head] || heads.round, { fill: L.skin, lw: 1.5 });

  // face. Everyone looks a little sideways; a straight-on cartoon has no attitude.
  const ex = dir * 5, ey = hy - 2;
  const eyeL = ex - 10, eyeR = ex + 11;
  if (L.lines >= 2) { line(c, [[-R * .55, hy - R * .55], [-R * .2, hy - R * .6]], { lw: .9, smooth: false }); line(c, [[R * .2, hy - R * .55], [R * .5, hy - R * .58]], { lw: .9, smooth: false }); }
  c.fillStyle = INK;
  const closed = blink || mood === 'sleep';
  if (closed || mood === 'happy') {
    for (const x of [eyeL, eyeR]) line(c, mood === 'happy' && !blink ? [[x - 4, ey + 1], [x, ey - 3], [x + 4, ey + 1]] : [[x - 4, ey], [x + 4, ey]], { lw: 1.6, smooth: false, wobble: .2 });
  } else if (L.sad && mood !== 'happy') {
    for (const x of [eyeL, eyeR]) { line(c, [[x - 4, ey + 2], [x + 4, ey + 2]], { lw: 1.6, smooth: false, wobble: .2 }); }
  } else {
    for (const x of [eyeL, eyeR]) { c.beginPath(); c.arc(x, ey, 2.5, 0, 7); c.fill(); }
  }
  // brows
  const by = ey - 9;
  if (mood === 'cross') { line(c, [[eyeL - 5, by - 2], [eyeL + 5, by + 3]], { lw: 2, smooth: false, wobble: .2 }); line(c, [[eyeR + 5, by - 2], [eyeR - 5, by + 3]], { lw: 2, smooth: false, wobble: .2 }); }
  else if (mood === 'sad') { line(c, [[eyeL - 5, by + 3], [eyeL + 5, by - 2]], { lw: 1.6, smooth: false, wobble: .2 }); line(c, [[eyeR + 5, by + 3], [eyeR - 5, by - 2]], { lw: 1.6, smooth: false, wobble: .2 }); }
  else if (!(sz < .7)) { line(c, [[eyeL - 5, by + .5], [eyeL + 5, by]], { lw: 1.6, smooth: false, wobble: .3 }); line(c, [[eyeR - 5, by], [eyeR + 5, by + .5]], { lw: 1.6, smooth: false, wobble: .3 }); }
  if (L.glasses) { c.strokeStyle = INK; c.lineWidth = 1.2; for (const x of [eyeL, eyeR]) { c.beginPath(); c.arc(x, ey, 7.5, 0, 7); c.stroke(); } line(c, [[eyeL + 7, ey], [eyeR - 7, ey]], { lw: 1.2, smooth: false, wobble: .1 }); }
  // nose: one line
  const nx = ex + dir * 1, ny = ey + 1;
  if (L.nose === 'long') line(c, [[nx, ny - 3], [nx + dir * 8, ny + 11], [nx - dir * 1, ny + 12]], { lw: 1.4, smooth: false, wobble: .2 });
  else if (L.nose === 'hook') line(c, [[nx, ny - 2], [nx + dir * 9, ny + 6], [nx + dir * 5, ny + 11], [nx - dir * 1, ny + 9]], { lw: 1.4, wobble: .2 });
  else if (L.nose === 'button') { shape(c, ell(nx + dir * 1, ny + 6, 3, 2.6, 6), { fill: '#d9805f', ink: null, off: 0, wobble: .1 }); }
  else line(c, [[nx, ny], [nx + dir * 5, ny + 8], [nx - dir * 1, ny + 9]], { lw: 1.3, smooth: false, wobble: .2 });
  if (L.freckles) { c.fillStyle = '#b8683e'; for (const [x, y] of [[-15, 8], [-11, 11], [-17, 12], [15, 8], [19, 11], [13, 12]]) { c.beginPath(); c.arc(x + dir * 2, hy + y, .9, 0, 7); c.fill(); } }
  if (L.stubble) { c.fillStyle = 'rgba(42,36,32,.4)'; const r = rng(4); for (let i = 0; i < 26; i++) { c.beginPath(); c.arc((r() - .5) * R * 1.3, hy + R * .55 + r() * R * .4, .6, 0, 7); c.fill(); } }
  // mouth
  const mx = ex, my = hy + R * .62;
  if (L.stache) { if (L.stacheThin) line(c, [[mx - 10, my - 3], [mx, my - 6], [mx + 10, my - 3]], { lw: 1.8, ink: L.stache, wobble: .2 }); else shape(c, [[mx - 15, my - 2], [mx - 6, my - 9], [mx, my - 6], [mx + 6, my - 9], [mx + 15, my - 2], [mx, my - 3]], { fill: L.stache, lw: 1, off: .6 }); }
  if (L.lip && mood !== 'happy') shape(c, ell(mx, my + 1, 6, 2.6, 7), { fill: L.lip, ink: null, off: 0, wobble: .2 });
  if (mood === 'happy') shape(c, [[mx - 8, my - 1], [mx, my + 2], [mx + 8, my - 1], [mx + 4, my + 7], [mx - 4, my + 7]], { fill: '#fffaf0', lw: 1.3, off: .4, wobble: .2 });
  else if (mood === 'cross') line(c, [[mx - 7, my + 3], [mx, my - 1], [mx + 7, my + 3]], { lw: 1.6, wobble: .2 });
  else if (mood === 'sad' || L.sad) line(c, [[mx - 6, my + 2], [mx + 6, my + 2]], { lw: 1.4, smooth: false, wobble: .3 });
  else if (!L.lip) line(c, [[mx - 6, my + 1], [mx, my + 3], [mx + 6, my]], { lw: 1.4, wobble: .2 });
  if (mood === 'eat') { shape(c, ell(mx, my + 2, 4.5, 3.6, 7), { fill: '#7a2d22', lw: 1.2, off: 0 }); }
  if (L.lines >= 1) { line(c, [[-R * .5, hy + R * .45], [-R * .42, hy + R * .72]], { lw: .9, smooth: false, wobble: .2 }); line(c, [[R * .5, hy + R * .45], [R * .42, hy + R * .72]], { lw: .9, smooth: false, wobble: .2 }); }

  // hair on top
  const top = [[-R * .94, hy - R * .25], [-R * .88, hy - R * .78], [-R * .3, hy - R * 1.14], [R * .4, hy - R * 1.14], [R * .9, hy - R * .76], [R * .96, hy - R * .25]];
  if (back === 'side') shape(c, [...top, [R * .6, hy - R * .62], [-R * .3, hy - R * .72], [-R * .72, hy - R * .5]], { fill: hc, wobble: .7 });
  if (back === 'crew') shape(c, [...top.map(([x, y]) => [x, y + 1]), [R * .7, hy - R * .72], [-R * .7, hy - R * .72]], { fill: hc, wobble: .9, smooth: false });
  if (back === 'pomp') shape(c, [[-R * .94, hy - R * .3], [-R * .9, hy - R * .9], [dir * -R * .2, hy - R * 1.2], [dir * R * .7, hy - R * 1.48], [R * 1.02, hy - R * .9], [R * .96, hy - R * .3], [R * .7, hy - R * .68], [-R * .7, hy - R * .7]], { fill: hc });
  if (back === 'fringe') { shape(c, [[-R * .86, hy - R * .1], [-R * 1.04, hy - R * .45], [-R * .78, hy - R * .62], [-R * .6, hy - R * .28]], { fill: hc, lw: 1 }); shape(c, [[R * .86, hy - R * .1], [R * 1.04, hy - R * .45], [R * .78, hy - R * .62], [R * .6, hy - R * .28]], { fill: hc, lw: 1 }); }
  if (back === 'tuft') shape(c, [[-4, hy - R * .96], [dir * 2, hy - R * 1.4], [6, hy - R * .96]], { fill: hc, lw: 1 });
  if (back === 'curly') { for (let i = 0; i < 9; i++) { const a = Math.PI * (1.03 + i * .118); shape(c, ell(Math.cos(a) * R * 1.0, hy - 4 + Math.sin(a) * R * 1.05, 9, 8, 7), { fill: hc, lw: 1.1, off: .6, wobble: .3 }); } }
  if (['bob', 'long', 'pony', 'bun', 'beehive', 'pigtails', 'shag'].includes(back)) shape(c, [...top, [R * .7, hy - R * .5], [R * .1, hy - R * .85], [-R * .55, hy - R * .55]], { fill: hc, wobble: .6 });
  // hats
  const hatC = L.hatCol || '#444';
  if (L.hat === 'fedora') { shape(c, [[-R * 1.3, hy - R * .72], [-R * .7, hy - R * .9], [-R * .68, hy - R * 1.5], [0, hy - R * 1.36], [R * .68, hy - R * 1.5], [R * .7, hy - R * .9], [R * 1.3, hy - R * .72], [0, hy - R * .62]], { fill: hatC }); shape(c, [[-R * .7, hy - R * 1.02], [R * .7, hy - R * 1.02], [R * .7, hy - R * .84], [-R * .7, hy - R * .84]], { fill: '#2c2622', lw: .8, smooth: false, off: 0 }); }
  if (L.hat === 'cap') { shape(c, [[-R * .9, hy - R * .6], [-R * .78, hy - R * 1.16], [R * .78, hy - R * 1.16], [R * .9, hy - R * .6]], { fill: hatC }); shape(c, [[dir * -R * .3, hy - R * .62], [dir * R * 1.36, hy - R * .52], [dir * R * .9, hy - R * .72]], { fill: hatC, lw: 1.1 }); }
  if (L.hat === 'driver') { shape(c, [[-R * .95, hy - R * .68], [-R * 1.08, hy - R * 1.2], [R * 1.08, hy - R * 1.2], [R * .95, hy - R * .68]], { fill: hatC, smooth: false }); shape(c, [[-R * .8, hy - R * .68], [R * .8, hy - R * .68], [R * .9, hy - R * .52], [-R * .9, hy - R * .52]], { fill: '#1f2a33', lw: 1, smooth: false }); shape(c, ell(0, hy - R * .9, 3.5, 3.5, 6), { fill: '#d9a53a', lw: .8, off: .3 }); }
  if (L.hat === 'pill') shape(c, box(-R * .6, hy - R * 1.36, R * 1.2, R * .34), { fill: hatC, lw: 1.2 });
  if (L.hat === 'band') shape(c, [[-R * .95, hy - R * .55], [R * .95, hy - R * .55], [R * .95, hy - R * .38], [-R * .95, hy - R * .38]], { fill: hatC, lw: 1 });
}

// Passing strangers, dressed for the year
const S_SKIN = ['#eec39b', '#e4ad84', '#c98f62', '#a86f48', '#7d4f33', '#f0cba8'];
const S_HAIR = ['#2c2622', '#5a3a26', '#8f3f27', '#b08a4d', '#7c7670', '#c4bfb3'];
const S_TOP = ['#6d8f7f', '#b5533a', '#3f7f9c', '#d9a53a', '#7f6a8c', '#55675a', '#c17a57', '#8c6d3f'];
export function strangerLook(seed, year) {
  const r = rng(seed); r(); const pick = (a) => a[Math.floor(r() * a.length)];
  const fem = r() < .48;
  const L = { skin: pick(S_SKIN), head: pick(['round', 'egg', 'long', 'box', 'pear']), hairCol: pick(S_HAIR), top: pick(S_TOP), size: .86 + r() * .16, nose: pick(['plain', 'long', 'hook', 'button']), lines: r() < .4 ? 1 : 0, glasses: r() < .22, ears: r() < .3 };
  if (fem) {
    L.hair = year < 1960 ? pick(['curly', 'bob', 'bun', 'pony']) : year < 1966 ? pick(['beehive', 'bob', 'pony', 'curly']) : pick(['long', 'bob', 'beehive', 'shag']);
    L.kind = pick(['dress', 'cardigan', 'sweater']); L.lip = r() < .6 ? '#b5392f' : null;
    if (year < 1961 && r() < .25) { L.hat = 'pill'; L.hatCol = pick(S_TOP); }
    if (year >= 1967 && r() < .2) { L.hat = 'band'; L.hatCol = pick(S_TOP); L.hair = 'long'; }
  } else {
    L.hair = year < 1965 ? pick(['side', 'crew', 'fringe', 'side', 'pomp']) : pick(['side', 'shag', 'fringe', 'shag']);
    L.kind = pick(['suit', 'shirt', 'work', 'tee']); L.tie = pick(S_TOP);
    if (year < 1960 && r() < .35) { L.hat = 'fedora'; L.hatCol = pick(['#5b4a3a', '#44505a', '#6a6a60']); }
    if (r() < .18) { L.stache = L.hairCol; }
    if (year >= 1968 && r() < .25) { L.stache = L.hairCol; L.stacheThin = 0; }
  }
  return L;
}

// ——— things ——— each drawn in a 48×48 box centred on 0,0
export function drawItem(c, kind, o = {}) {
  const ok = o.lw || 1.3;
  const plate = (y = 13, rx = 21) => { shape(c, ell(0, y, rx, 6, 12), { fill: '#fbf5e6', lw: ok, off: .8 }); shape(c, ell(0, y - 1, rx * .68, 3.4, 10), { ink: '#a9a08c', lw: .8, wobble: .2 }); };
  if (kind === 'coffee' || kind === 'tea') {
    shape(c, [[-13, -12], [13, -12], [10, 8], [-10, 8]], { fill: '#fbf5e6', lw: ok, smooth: false, off: .8 });
    shape(c, [[12, -8], [20, -7], [20, 2], [10, 3]], { ink: INK, lw: ok, closed: false });
    shape(c, ell(0, -12, 13, 3.6, 10), { fill: kind === 'coffee' ? '#4a2c1c' : '#c78b35', lw: ok, off: .2, wobble: .2 });
    shape(c, ell(0, 12, 19, 4.5, 10), { fill: '#7fb8a8', lw: ok, off: .6, wobble: .3 });
    if (kind === 'tea') { line(c, [[8, -13], [15, 2]], { lw: .9 }); shape(c, box(13, 1, 6, 7), { fill: '#d9a53a', lw: .8, off: .3, smooth: false }); }
  } else if (['milk', 'choc', 'straw', 'cola'].includes(kind)) {
    const col = { milk: '#fbf7ec', choc: '#8a5a3a', straw: '#ef9ba0', cola: '#3a2017' }[kind];
    shape(c, [[-11, -18], [11, -18], [8, 16], [-8, 16]], { fill: '#e6f0ea', lw: ok, smooth: false, off: .5 });
    shape(c, [[-10, -11], [10, -11], [7.6, 14], [-7.6, 14]], { fill: col, ink: null, smooth: false, off: 0 });
    line(c, [[-11, -18], [-8, 16], [8, 16], [11, -18]], { lw: ok, smooth: false });
    if (kind === 'straw' || kind === 'choc') { line(c, [[4, -14], [9, -26]], { lw: 2.2, ink: '#c9453a', wobble: .1 }); }
    if (kind === 'cola') { shape(c, ell(-3, -7, 2, 2, 6), { fill: '#a06a4a', ink: null, off: 0 }); shape(c, ell(3, 0, 1.6, 1.6, 6), { fill: '#a06a4a', ink: null, off: 0 }); }
  } else if (kind === 'toast') {
    plate();
    shape(c, [[-15, 8], [-16, -9], [-11, -15], [11, -15], [16, -9], [15, 8]], { fill: '#d39a50', lw: ok, off: .8 });
    shape(c, [[-11, 5], [-12, -8], [-9, -11], [9, -11], [12, -8], [11, 5]], { fill: '#efcd8e', ink: null, off: 0 });
    shape(c, box(-4, -6, 9, 6), { fill: '#f6e27a', lw: .8, off: .3, smooth: false });
  } else if (kind === 'eggs') {
    plate();
    shape(c, [[-19, 4], [-15, -6], [-6, -9], [2, -5], [10, -9], [19, -3], [18, 6], [8, 10], [-8, 9]], { fill: '#fffdf3', lw: ok, off: .6 });
    shape(c, ell(-7, -1, 6, 5.4, 9), { fill: '#f2b632', lw: 1.1, off: .4, wobble: .2 }); shape(c, ell(9, 1, 6, 5.4, 9), { fill: '#f2b632', lw: 1.1, off: .4, wobble: .2 });
  } else if (kind === 'burger') {
    plate(15);
    shape(c, [[-18, -2], [-17, -13], [0, -19], [17, -13], [18, -2]], { fill: '#d39a50', lw: ok, off: .7 });
    shape(c, [[-19, 0], [-8, 4], [0, 1], [10, 5], [19, 0], [18, -4], [-18, -4]], { fill: '#6e9b4b', lw: 1, off: .4 });
    shape(c, [[-18, 3], [18, 3], [18, 7], [-18, 7]], { fill: '#5a3120', lw: 1, off: .4 });
    shape(c, [[-17, 8], [17, 8], [15, 13], [-15, 13]], { fill: '#d39a50', lw: ok, off: .5 });
    for (const [x, y] of [[-7, -11], [1, -14], [8, -10]]) { shape(c, ell(x, y, 1.2, .8, 5), { fill: '#fdf0cf', ink: null, off: 0 }); }
  } else if (kind === 'apple' || kind === 'cherry') {
    plate();
    const fillC = kind === 'apple' ? '#e0b45a' : '#a92a35';
    shape(c, [[-19, 4], [14, -13], [20, 8], [-17, 9]], { fill: fillC, lw: ok, off: .6, smooth: false });
    shape(c, [[-19, 3], [13, -14], [17, -8], [20, 2], [-14, 2]], { fill: '#d8a763', lw: ok, off: .7 });
    if (kind === 'apple') for (const [x, y] of [[-4, -3], [5, -6], [9, -2]]) line(c, [[x, y], [x + 4, y - 2]], { lw: 1, ink: '#9d6a2b', wobble: .2 });
    if (kind === 'cherry') { for (const [x, y] of [[-3, -3], [6, -6]]) shape(c, ell(x, y, 2.6, 2.6, 7), { fill: '#a92a35', lw: .8, off: .2 }); }
  } else if (kind === 'burnt') {
    plate(); shape(c, ell(0, 0, 16, 10, 9), { fill: '#2c221c', lw: ok, off: .5, wobble: 2 });
  }
}
