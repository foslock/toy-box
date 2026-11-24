// Draws the instruments: scope and compass ring, chart, gauges, crackle paint.
import { SIZE, HOME, TRACKS, VENTS, sdf } from './world.js';
import { RANGE, brg, AIR } from './game.js';
export const RED = '#ff5a3c', HOT = '#ffd9c2', DIM = '#7d2418', INK = '#2b0705';
const TAU = Math.PI * 2;
export const deg = a => String(Math.round(a * 180 / Math.PI + 360) % 360).padStart(3, '0');

export function fit(cv) {
  const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1), w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return [cv.getContext('2d'), w / d, h / d, d];
}
export function crackle() { // a tile of wrinkle-finish enamel
  const n = 220, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), im = g.createImageData(n, n), v = new Float32Array(n * n);
  for (let k = 0; k < 900; k++) { const x = Math.random() * n, y = Math.random() * n, r = 2 + Math.random() * 5, a = Math.random() * TAU, s = Math.random() - .5; for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) { const u = i * Math.cos(a) + j * Math.sin(a), w = -i * Math.sin(a) + j * Math.cos(a), q = Math.exp(-(u * u / (r * r) + w * w / 2.5)); v[((y + j + n) | 0) % n * n + ((x + i + n) | 0) % n] += s * q; } }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i, l = (v[k] - v[((j + 1) % n) * n + (i + 1) % n]) * 70 + (Math.random() - .5) * 5; im.data[k * 4] = 46 + l; im.data[k * 4 + 1] = 17 + l * .3; im.data[k * 4 + 2] = 14 + l * .25; im.data[k * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); return c.toDataURL();
}

export class Scope {
  constructor(cv) { this.cv = cv; this.echoes = []; this.rings = []; this.t = 0; this.listen = null; this.ls = 0; }
  ping(e) { this.rings.push({ t: 0, x: e.x, y: e.y }); for (const h of e.hits) this.echoes.push({ ...h, t: -h.d / 130 - .05, ox: e.x, oy: e.y, j: Math.random() }); }
  mimic(e) { this.rings.push({ t: 0, x: e.x, y: e.y, odd: 1 }); }
  clear() { this.echoes = []; this.rings = []; this.ls = 0; }
  update(dt, L) { this.t += dt; for (const e of this.echoes) e.t += dt; this.echoes = this.echoes.filter(e => e.t < 16); for (const r of this.rings) r.t += dt; this.rings = this.rings.filter(r => r.t < 2.4); if (L) { if (!this.listen || this.ls < .02) this.listen = { ...L }; this.listen = L; } this.ls += ((L ? 1 : 0) - this.ls) * Math.min(1, dt * (L ? .7 : 3)); }
  draw(g, o = {}) {
    const [c, w, h, d] = fit(this.cv); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h);
    const R = Math.min(w, h) / 2 - 2, cx = w / 2, cy = h / 2, ring = Math.max(26, R * .15), r = R - ring; this.geo = { cx, cy, R, r };
    // brass bezel
    let gr = c.createRadialGradient(cx - R * .3, cy - R * .5, R * .2, cx, cy, R); gr.addColorStop(0, '#6e2c1e'); gr.addColorStop(.8, '#421510'); gr.addColorStop(1, '#1b0806');
    c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#8d3a28'; c.stroke();
    for (let i = 0; i < 72; i++) { const a = i / 72 * TAU, b = i % 6 === 0, m = i % 2 === 0; c.strokeStyle = b ? HOT : '#c9674c'; c.lineWidth = b ? 2 : 1; c.beginPath(); c.moveTo(cx + Math.sin(a) * (r + 3), cy - Math.cos(a) * (r + 3)); const q = r + (b ? 9 : m ? 7 : 5); c.lineTo(cx + Math.sin(a) * q, cy - Math.cos(a) * q); c.stroke(); }
    c.fillStyle = HOT; c.textAlign = 'center'; c.textBaseline = 'middle'; const fs = Math.max(10, ring * .4);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.save(); c.translate(cx + Math.sin(a) * (r + ring * .66), cy - Math.cos(a) * (r + ring * .66)); c.rotate(a); c.font = `700 ${i % 3 ? fs * .86 : fs * 1.15}px B612, sans-serif`; c.fillText(i % 3 ? String(i * 30).padStart(3, '0') : 'NESW'[i / 3], 0, 0); c.restore(); }
    // glass
    gr = c.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, '#210705'); gr.addColorStop(.75, '#140403'); gr.addColorStop(1, '#070101');
    c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
    const S = r / RANGE, X = x => cx + (x - g.x) * S, Y = y => cy - (y - g.y) * S;
    c.strokeStyle = 'rgba(255,90,60,.16)'; c.lineWidth = 1; for (const k of [50, 100, 150]) { c.beginPath(); c.arc(cx, cy, k * S, 0, TAU); c.stroke(); }
    c.fillStyle = 'rgba(255,120,90,.5)'; c.font = `${Math.max(9, r * .05)}px B612, sans-serif`; c.textAlign = 'left'; for (const k of [50, 100, 150]) c.fillText(k + (k === 50 ? ' m' : ''), cx + 4, cy + k * S - 7);
    // course line
    c.setLineDash([3, 6]); c.strokeStyle = 'rgba(255,190,150,.4)'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(g.course) * r, cy - Math.cos(g.course) * r); c.stroke(); c.setLineDash([]);
    // the ping going out
    c.globalCompositeOperation = 'lighter';
    for (const p of this.rings) { const q = p.t * 130 * S, a = Math.max(0, 1 - p.t / 1.5); if (p.odd) { for (let i = 0; i < 3; i++) { c.strokeStyle = `rgba(255,220,200,${a * .5})`; c.lineWidth = 2; c.beginPath(); c.arc(X(p.x) + (Math.random() - .5) * 5, Y(p.y) + (Math.random() - .5) * 5, q * .8 + i * 5, 0, TAU); c.stroke(); } } else { c.strokeStyle = `rgba(255,150,110,${a * .8})`; c.lineWidth = 2; c.beginPath(); c.arc(X(p.x), Y(p.y), q, 0, TAU); c.stroke(); c.strokeStyle = `rgba(255,90,60,${a * .25})`; c.lineWidth = 12; c.beginPath(); c.arc(X(p.x), Y(p.y), Math.max(0, q - 6), 0, TAU); c.stroke(); } }
    for (const e of this.echoes) {
      if (e.t < 0) continue; const f = Math.pow(1 - e.t / 16, 1.6), hot = Math.max(0, 1 - e.t * 1.5), x = X(e.x), y = Y(e.y);
      if (e.k === 'wall') {
        const a = Math.atan2(e.y - e.oy, e.x - e.ox), L = Math.max(2.6, e.d * S * .022), px = Math.sin(a) * L, py = Math.cos(a) * L;
        c.strokeStyle = `rgba(255,${95 + hot * 130 | 0},${60 + hot * 130 | 0},${f * .95})`; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - px, y - py); c.lineTo(x + px, y + py); c.stroke();
        c.strokeStyle = `rgba(255,70,40,${f * .2})`; c.lineWidth = 9; c.beginPath(); const bx = Math.cos(a) * 5, by = -Math.sin(a) * 5; c.moveTo(x - px + bx, y - py + by); c.lineTo(x + px + bx, y + py + by); c.stroke();
      } else if (e.k === 'it') { for (let i = 0; i < 26; i++) { const a = i * 2.4, q = (3 + i * .8) * (1 + .12 * Math.sin(this.t * 3 + i)); c.fillStyle = `rgba(255,${190 + i},${160 + i},${f * .55})`; c.beginPath(); c.arc(x + Math.cos(a) * q * S * 1.0, y + Math.sin(a) * q * S * .7, 2 + S * (1.6 - i * .04), 0, TAU); c.fill(); } }
      else { c.strokeStyle = `rgba(255,225,205,${f})`; c.fillStyle = `rgba(255,225,205,${f})`; c.lineWidth = 1.8; const q = 6; c.beginPath(); if (e.k === 'home') { c.moveTo(x, y - q); c.lineTo(x + q, y); c.lineTo(x, y + q); c.lineTo(x - q, y); c.closePath(); } else if (e.k === 'wreck') { c.moveTo(x - q, y - q); c.lineTo(x + q, y + q); c.moveTo(x + q, y - q); c.lineTo(x - q, y + q); } else { c.arc(x, y, 3, 0, TAU); c.moveTo(x + 8, y); c.arc(x, y, 8, 0, TAU); } c.stroke(); }
    }
    // hydrophone: a smear on the side the noise comes from, narrowing as you keep quiet
    if (this.ls > .03 && this.listen) { const L = this.listen, b = L.b, wd = .75 - .5 * this.ls + (1 - L.s) * .25; for (let i = 0; i < 40; i++) { const u = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5 * wd, a = b + u, q = r - 3 - Math.random() * r * (.06 + .3 * L.s); c.fillStyle = `rgba(255,${150 + Math.random() * 80 | 0},120,${this.ls * (.25 + .5 * L.s) * Math.random()})`; c.beginPath(); c.arc(cx + Math.sin(a) * q, cy - Math.cos(a) * q, 1 + Math.random() * 2.4, 0, TAU); c.fill(); } }
    if (g.live && g.ventAt(g.x, g.y)) for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, q = Math.random() * r; c.fillStyle = 'rgba(255,120,90,.2)'; c.fillRect(cx + Math.sin(a) * q, cy + Math.cos(a) * q, 1.5, 1.5); }
    if (g.decoy) { const k = g.decoy, p = (this.t * 1.2) % 1; c.strokeStyle = `rgba(255,220,190,${.7 - p * .7})`; c.lineWidth = 1.5; c.beginPath(); c.arc(X(k.x), Y(k.y), 2 + p * 9, 0, TAU); c.stroke(); }
    c.globalCompositeOperation = 'source-over';
    // the craft
    c.save(); c.translate(cx, cy); c.rotate(g.h); c.strokeStyle = 'rgba(255,140,100,.22)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-Math.sin(.42) * 34 * S, -Math.cos(.42) * 34 * S); c.arc(0, 0, 34 * S, -Math.PI / 2 - .42, -Math.PI / 2 + .42); c.lineTo(0, 0); c.stroke(); c.fillStyle = HOT; c.beginPath(); c.moveTo(0, -9); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath(); c.fill(); c.restore();
    // glass shine and grain
    gr = c.createLinearGradient(cx - r, cy - r, cx + r * .2, cy + r * .4); gr.addColorStop(0, 'rgba(255,140,110,.13)'); gr.addColorStop(.35, 'rgba(255,140,110,.03)'); gr.addColorStop(.36, 'rgba(255,140,110,0)'); c.fillStyle = gr; c.fillRect(cx - r, cy - r, r * 2, r * 2);
    if (o.crack) { c.strokeStyle = 'rgba(255,210,190,.3)'; c.lineWidth = 1; for (let k = 0; k < o.crack; k++) { let a = 1.1 + k * 2.1, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; for (let b = 0; b < 3; b++) { c.beginPath(); c.moveTo(x, y); let p = x, q = y, aa = a + Math.PI + (b - 1) * .5; for (let i = 0; i < 6; i++) { aa += Math.sin(i * 7 + b * 3 + k) * .5; p += Math.cos(aa) * r * .1; q += Math.sin(aa) * r * .1; c.lineTo(p, q); } c.stroke(); } } }
    c.restore();
    c.strokeStyle = '#0b0202'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
    // heading index and course bug
    const mk = (a, q, f) => { c.save(); c.translate(cx + Math.sin(a) * q, cy - Math.cos(a) * q); c.rotate(a); f(); c.restore(); };
    mk(g.h, r + 1, () => { c.fillStyle = RED; c.beginPath(); c.moveTo(0, -11); c.lineTo(7, 3); c.lineTo(-7, 3); c.closePath(); c.fill(); });
    mk(g.course, R - ring * .42, () => { const k = ring * .52, p = o.pulse ? .5 + .5 * Math.sin(this.t * 6) : 0; if (p) { c.fillStyle = `rgba(255,217,194,${p * .35})`; c.beginPath(); c.arc(0, 0, k * 1.8, 0, TAU); c.fill(); } c.fillStyle = '#e8a35d'; c.strokeStyle = '#2b0705'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, k); c.lineTo(k * .8, k * .2); c.lineTo(k * .8, -k * .75); c.lineTo(-k * .8, -k * .75); c.lineTo(-k * .8, k * .2); c.closePath(); c.fill(); c.stroke(); c.beginPath(); for (const u of [-.35, 0, .35]) { c.moveTo(u * k, -k * .5); c.lineTo(u * k, k * .1); } c.stroke(); });
    // feelers
    if (o.feel) o.feel.forEach((f, i) => { if (f > 18) return; mk(g.h + [-.8, 0, .8][i], r - 10, () => { const u = 1 - f / 19; c.fillStyle = `rgba(255,${200 - u * 120 | 0},120,${.35 + .65 * u * (.5 + .5 * Math.sin(this.t * (6 + 20 * u)))})`; c.fillRect(-16, -3, 32, 6); }); });
  }
}

export class Chart {
  constructor(cv) { this.cv = cv; this.sel = null; this.z = 1; this.cx = 500; this.cy = 500; }
  geo() { const r = this.cv.getBoundingClientRect(), s = Math.min(r.width, r.height) / SIZE * this.z; const hw = r.width / 2 / s, hh = r.height / 2 / s; this.cx = this.z <= 1 ? 500 : Math.max(Math.min(hw, 500), Math.min(Math.max(SIZE - hw, 500), this.cx)); this.cy = this.z <= 1 ? 500 : Math.max(Math.min(hh, 500), Math.min(Math.max(SIZE - hh, 500), this.cy)); return { s, w: r.width, h: r.height, l: r.left, t: r.top }; }
  toWorld(px, py) { const q = this.geo(); return [(px - q.l - q.w / 2) / q.s + this.cx, this.cy - (py - q.t - q.h / 2) / q.s]; }
  draw(g, o = {}) {
    const [c, w, h, d] = fit(this.cv); if (w < 4) return; const { s } = this.geo(); c.setTransform(d, 0, 0, d, 0, 0);
    const X = x => w / 2 + (x - this.cx) * s, Y = y => h / 2 - (y - this.cy) * s;
    c.fillStyle = '#c46a58'; c.fillRect(0, 0, w, h);
    const gr = c.createRadialGradient(w * .5, h * .25, 10, w * .5, h * .4, Math.max(w, h) * .8); gr.addColorStop(0, 'rgba(255,170,140,.42)'); gr.addColorStop(1, 'rgba(50,5,2,.55)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(60,8,4,.12)'; c.lineWidth = 6; for (const k of [.5]) { c.beginPath(); c.moveTo(w * k, 0); c.lineTo(w * k, h); c.moveTo(0, h * k); c.lineTo(w, h * k); c.stroke(); }
    c.strokeStyle = 'rgba(60,8,4,.28)'; c.lineWidth = .8; c.fillStyle = 'rgba(50,6,3,.75)'; c.font = '10px B612, sans-serif'; c.textBaseline = 'middle';
    for (let k = 0; k <= 1000; k += 100) { c.beginPath(); c.moveTo(X(k), 0); c.lineTo(X(k), h); c.moveTo(0, Y(k)); c.lineTo(w, Y(k)); c.stroke(); if (k % 200 === 0 && k && k < 1000) { c.textAlign = 'center'; c.fillText(k + ' E', X(k), Math.min(h - 8, Math.max(8, Y(0) - 8))); c.textAlign = 'left'; c.fillText(k + ' N', Math.max(3, X(0) + 3), Y(k) - 6); } }
    c.strokeStyle = 'rgba(40,5,3,.38)'; c.setLineDash([5, 5]); c.lineWidth = 1.2; if (g.open || o.all) for (const l of TRACKS) { c.beginPath(); l.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](X(p[0]), Y(p[1]))); c.stroke(); } else { c.beginPath(); c.moveTo(X(500), Y(500)); c.lineTo(X(596), Y(566)); c.stroke(); } c.setLineDash([]);
    if (g.open) for (const v of VENTS) { c.strokeStyle = 'rgba(40,5,3,.5)'; c.lineWidth = 1; for (let i = 0; i < 7; i++) { const a = i * 2.4, q = v.r * .11 * i * s, x = X(v.x) + Math.cos(a) * q, y = Y(v.y) + Math.sin(a) * q; c.beginPath(); c.arc(x, y, 1.8, 0, TAU); c.stroke(); } c.font = '15px "Reenie Beanie", cursive'; c.textAlign = 'center'; c.fillStyle = 'rgba(40,5,3,.8)'; c.fillText('vents, loud', X(v.x), Y(v.y) + v.r * s * .8); }
    // pencilled echoes
    c.fillStyle = INK; const q = Math.max(1.5, 2.6 * s); for (const k of g.echo.keys()) { const x = X((k % 256) * 4 + 2), y = Y(((k / 256) | 0) * 4 + 2); if (x > -4 && y > -4 && x < w + 4 && y < h + 4) c.fillRect(x - q / 2, y - q / 2, q, q); }
    // fixes
    c.strokeStyle = 'rgba(40,5,3,.75)'; c.lineWidth = 1; c.beginPath(); g.fixes.forEach((f, i) => c[i ? 'lineTo' : 'moveTo'](X(f[0]), Y(f[1]))); c.stroke();
    g.fixes.forEach((f, i) => { const last = i === g.fixes.length - 1, k = last ? 7 : 3; c.lineWidth = last ? 2.4 : 1; c.strokeStyle = last ? '#fff3e6' : INK; c.beginPath(); c.moveTo(X(f[0]) - k, Y(f[1])); c.lineTo(X(f[0]) + k, Y(f[1])); c.moveTo(X(f[0]), Y(f[1]) - k); c.lineTo(X(f[0]), Y(f[1]) + k); c.stroke(); if (last) { c.beginPath(); c.arc(X(f[0]), Y(f[1]), 11, 0, TAU); c.stroke(); } });
    const lab = (t, x, y, f = '700 13px B612, sans-serif') => { c.font = f; c.textAlign = 'left'; c.fillStyle = INK; const tw = c.measureText(t).width; c.fillText(t, x + 12 + tw > w ? x - 12 - tw : x + 12, y); };
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); const hx = X(HOME.x), hy = Y(HOME.y); c.moveTo(hx, hy - 8); c.lineTo(hx + 8, hy); c.lineTo(hx, hy + 8); c.lineTo(hx - 8, hy); c.closePath(); c.stroke(); lab('SHAFT', hx, hy + 13, '700 10px B612, sans-serif');
    for (const m of g.marks()) { const x = X(m.x), y = Y(m.y), done = g.delivered.includes(m.id), got = g.shot.includes(m.id); c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 7, 0, TAU); if (done || got) { c.moveTo(x - 4, y); c.lineTo(x - 1, y + 4); c.lineTo(x + 6, y - 7); } else { c.moveTo(x + 2, y); c.arc(x, y, 1.6, 0, TAU); } c.stroke(); if (m.id === 'G') { lab('G', x, y - 5, '26px "Reenie Beanie", cursive'); } else lab(m.id, x, y - 5); if (o.pulse === m.id) { c.strokeStyle = `rgba(255,243,230,${.5 + .5 * Math.sin(o.t * 6)})`; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 14, 0, TAU); c.stroke(); } }
    for (const k of g.wrecks) if (!k.done) { const x = X(k.x), y = Y(k.y); c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 5, y - 5); c.lineTo(x + 5, y + 5); c.moveTo(x + 5, y - 5); c.lineTo(x - 5, y + 5); c.stroke(); lab('No. ' + k.no + (k.film.length ? ', film aboard' : ''), x, y, '17px "Reenie Beanie", cursive'); }
    if (this.sel) { const f = g.fixes[g.fixes.length - 1], x = X(this.sel.x), y = Y(this.sel.y); c.strokeStyle = '#fff3e6'; c.lineWidth = 1.6; c.setLineDash([7, 4]); c.beginPath(); c.moveTo(X(f[0]), Y(f[1])); c.lineTo(x, y); c.stroke(); c.setLineDash([]); c.beginPath(); c.arc(x, y, 12, 0, TAU); c.stroke(); }
  }
}
export function gauge(cv, v, label, o = {}) {
  const [c, w, h, d] = fit(cv); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h); const R = Math.min(w / 2, h / 2) - 2, cx = w / 2, cy = h * .5 + R * .16;
  c.fillStyle = '#120403'; c.beginPath(); c.arc(cx, cy - R * .16, R, 0, TAU); c.fill(); c.strokeStyle = '#8d3a28'; c.lineWidth = 2.5; c.stroke();
  const a = t => Math.PI * (1.17 + .66 * t), r = R * .8; c.lineWidth = 1.5; c.strokeStyle = '#e07a5c'; c.beginPath(); c.arc(cx, cy, r, a(0), a(1)); c.stroke();
  if (o.bad) { c.strokeStyle = RED; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, r - 3, a(o.bad[0]), a(o.bad[1])); c.stroke(); }
  c.strokeStyle = HOT; c.lineWidth = 1.2; for (let i = 0; i <= 8; i++) { const k = a(i / 8), q = i % 4 ? r - 4 : r - 8; c.beginPath(); c.moveTo(cx + Math.cos(k) * r, cy + Math.sin(k) * r); c.lineTo(cx + Math.cos(k) * q, cy + Math.sin(k) * q); c.stroke(); }
  c.fillStyle = HOT; c.font = `700 ${Math.max(9, R * .25)}px B612, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, cx, cy + R * .36);
  const k = a(Math.max(0, Math.min(1, v))); c.strokeStyle = '#fff3e6'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - Math.cos(k) * r * .2, cy - Math.sin(k) * r * .2); c.lineTo(cx + Math.cos(k) * (r - 2), cy + Math.sin(k) * (r - 2)); c.stroke(); c.fillStyle = '#8d3a28'; c.beginPath(); c.arc(cx, cy, 3.5, 0, TAU); c.fill();
}
