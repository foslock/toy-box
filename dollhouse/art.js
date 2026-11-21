// Painting the dollhouse. The static house is baked once into a big canvas in a gouache-ish style
// (flat fills, soft brush streaks, paper grain); everything that moves is drawn live on top.
import * as L from './level.js';

const PAL = {
  ink: '#2a1b14', cream: '#ecdcb8', cream2: '#d9c49a', creamD: '#a98f63', board: '#8b5a36', boardD: '#5e3a22', boardL: '#a8714a',
  slate: '#4a5468', slateL: '#6c7891', slateD: '#333b4c', brick: '#8f4a37', brickL: '#a75c44', mortar: '#5d3a2e', earth: '#3a2a20', earthL: '#4c372a',
  iron: '#34363b', ironL: '#5c6069', ironH: '#868b96', grass: '#3f5a36', grassL: '#5a7a48', brass: '#c9a24c', brassL: '#ecd283', brassD: '#8a6a2a',
  red: '#b8392e', redD: '#7e221b', blue: '#2f4d7a', white: '#f3ead6', skin: '#f0c4a0', sky0: '#121733', sky1: '#28305a', sky2: '#4a4870',
};
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const mix = (a, b, k) => { const pa = hex(a), pb = hex(b); return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(',')})`; };
function hex(c) { if (c.startsWith('rgb')) return c.match(/\d+/g).slice(0, 3).map(Number); const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
const shade = (c, k) => k < 0 ? mix(c, '#140c08', -k) : mix(c, '#fff6e0', k);

// a rectangle painted by hand: slightly wobbly edges, a couple of streaks
function wobRect(ctx, x, y, w, h, r, amt = 0.035) {
  const n = Math.max(2, Math.round((w + h) * 2));
  ctx.beginPath();
  const pts = [];
  const side = (x0, y0, x1, y1, m) => { for (let i = 0; i < m; i++) { const k = i / m; pts.push([x0 + (x1 - x0) * k + (r() - 0.5) * amt, y0 + (y1 - y0) * k + (r() - 0.5) * amt]); } };
  const mw = Math.max(1, Math.round(w * 2)), mh = Math.max(1, Math.round(h * 2));
  side(x, y, x + w, y, mw); side(x + w, y, x + w, y + h, mh); side(x + w, y + h, x, y + h, mw); side(x, y + h, x, y, mh);
  pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.closePath(); void n;
}
function paint(ctx, x, y, w, h, base, r, o = {}) {
  ctx.fillStyle = base; wobRect(ctx, x, y, w, h, r, o.wob ?? 0.035); ctx.fill();
  const streaks = o.streaks ?? Math.min(14, Math.ceil(w * h * 0.8));
  for (let i = 0; i < streaks; i++) {
    ctx.fillStyle = shade(base, (r() - 0.45) * (o.var ?? 0.18)); ctx.globalAlpha = 0.35 + r() * 0.3;
    const sw = (o.vert ? 0.06 + r() * 0.1 : w * (0.2 + r() * 0.6)), sh = o.vert ? h * (0.2 + r() * 0.7) : 0.05 + r() * 0.12;
    ctx.beginPath(); ctx.ellipse(x + r() * w, y + r() * h, sw / 2, sh / 2, (r() - 0.5) * 0.1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (o.edge !== false) { ctx.strokeStyle = o.edgeC || shade(base, -0.45); ctx.lineWidth = o.lw || 0.05; wobRect(ctx, x, y, w, h, r, 0.02); ctx.stroke(); }
  if (o.light) { ctx.fillStyle = shade(base, 0.22); ctx.globalAlpha = 0.5; ctx.fillRect(x + 0.04, y + 0.04, w - 0.08, Math.min(0.1, h * 0.2)); ctx.globalAlpha = 1; }
}
function circle(ctx, x, y, r, fill, stroke, lw) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 0.05; ctx.stroke(); } }
function ell(ctx, x, y, rx, ry, rot, fill) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.001, rx), Math.max(0.001, ry), rot || 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }

// ---------- wallpapers: small tiles made into patterns
function patternCanvas(B, tw, th, draw) {
  const c = document.createElement('canvas'); c.width = Math.round(tw * B); c.height = Math.round(th * B);
  const x = c.getContext('2d'); x.scale(B, B); draw(x, rng(tw * 1000 + th)); return c;
}
const PAPERS = {
  bedroom: { base: '#4e6a8c', draw(x) { // blue damask
    x.fillStyle = '#4e6a8c'; x.fillRect(0, 0, 2, 2);
    for (const [cx, cy] of [[0.5, 0.5], [1.5, 1.5]]) {
      x.fillStyle = '#6683a5'; x.beginPath(); x.ellipse(cx, cy, 0.18, 0.34, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(cx, cy, 0.34, 0.14, 0, 0, 7); x.fill();
      x.fillStyle = '#3f5876'; circle(x, cx, cy, 0.07, '#a8b9cc');
    }
    x.strokeStyle = '#5c789a'; x.lineWidth = 0.04; x.beginPath(); x.moveTo(0, 1); x.quadraticCurveTo(0.5, 0.7, 1, 1); x.quadraticCurveTo(1.5, 1.3, 2, 1); x.stroke();
  } },
  landing: { base: '#5d7754', draw(x) { // green stripes, tiny rosebuds
    x.fillStyle = '#5d7754'; x.fillRect(0, 0, 1.5, 1.5);
    x.fillStyle = '#6c8762'; x.fillRect(0, 0, 0.42, 1.5); x.fillStyle = '#50684a'; x.fillRect(0.42, 0, 0.06, 1.5);
    circle(x, 1.0, 0.4, 0.07, '#c9806e'); circle(x, 1.0, 1.15, 0.07, '#d8b36a');
    x.strokeStyle = '#7f9a6a'; x.lineWidth = 0.03; x.beginPath(); x.moveTo(1, 0.47); x.lineTo(1, 1.08); x.stroke();
  } },
  nursery: { base: '#dcc57f', draw(x) { // pale yellow with stars and ducks
    x.fillStyle = '#dcc57f'; x.fillRect(0, 0, 2.4, 2.4);
    const star = (cx, cy, r, c) => { x.fillStyle = c; x.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.fill(); };
    star(0.6, 0.6, 0.17, '#e9d9a3'); star(1.8, 1.8, 0.17, '#e9d9a3');
    // a duck
    ell(x, 1.8, 0.7, 0.2, 0.13, 0, '#f2e6b8'); circle(x, 1.97, 0.55, 0.09, '#f2e6b8'); x.fillStyle = '#d6955a'; x.fillRect(2.04, 0.54, 0.08, 0.04);
    circle(x, 0.6, 1.8, 0.06, '#c9a8b3'); circle(x, 0.5, 1.9, 0.04, '#c9a8b3');
  } },
  parlour: { base: '#7a3131', draw(x) { // deep red flock
    x.fillStyle = '#7a3131'; x.fillRect(0, 0, 2, 2.4);
    for (const [cx, cy] of [[1, 0.6], [0, 1.8], [2, 1.8]]) {
      x.fillStyle = '#8c3c3a';
      x.beginPath(); x.moveTo(cx, cy - 0.5); x.bezierCurveTo(cx + 0.45, cy - 0.3, cx + 0.4, cy + 0.3, cx, cy + 0.55); x.bezierCurveTo(cx - 0.4, cy + 0.3, cx - 0.45, cy - 0.3, cx, cy - 0.5); x.fill();
      x.fillStyle = '#6a2828'; x.beginPath(); x.ellipse(cx, cy, 0.09, 0.2, 0, 0, 7); x.fill();
    }
  } },
  hall: { base: '#a7713f', draw(x) { // ochre trellis
    x.fillStyle = '#a7713f'; x.fillRect(0, 0, 1.4, 1.4);
    x.strokeStyle = '#94612f'; x.lineWidth = 0.06; x.beginPath(); x.moveTo(0, 0.7); x.lineTo(0.7, 0); x.lineTo(1.4, 0.7); x.lineTo(0.7, 1.4); x.closePath(); x.stroke();
    circle(x, 0.7, 0.7, 0.08, '#c58f55'); circle(x, 0, 0, 0.07, '#c58f55'); circle(x, 1.4, 0, 0.07, '#c58f55'); circle(x, 0, 1.4, 0.07, '#c58f55'); circle(x, 1.4, 1.4, 0.07, '#c58f55');
  } },
  kitchen: { base: '#d9cfb3', draw(x) { // cream plaster, faint check
    x.fillStyle = '#d9cfb3'; x.fillRect(0, 0, 0.5, 0.5); x.fillStyle = '#d3c8aa'; x.fillRect(0, 0, 0.25, 0.25); x.fillRect(0.25, 0.25, 0.25, 0.25);
  } },
  tiles: { base: '#c9d6d2', draw(x) { // blue and white tiles
    x.fillStyle = '#e8ece4'; x.fillRect(0, 0, 0.5, 0.5); x.strokeStyle = '#9fb2b4'; x.lineWidth = 0.025; x.strokeRect(0.01, 0.01, 0.48, 0.48);
    x.strokeStyle = '#5876a0'; x.lineWidth = 0.03; x.beginPath(); x.arc(0.25, 0.25, 0.11, 0, 7); x.stroke(); circle(x, 0.25, 0.25, 0.03, '#5876a0');
  } },
  attic: { base: '#5a4330', draw(x, r) { // bare boards
    x.fillStyle = '#5a4330'; x.fillRect(0, 0, 3, 2);
    for (let i = 0; i < 4; i++) { x.fillStyle = shade('#5a4330', (r() - 0.5) * 0.2); x.fillRect(i * 0.75, 0, 0.72, 2); x.fillStyle = '#3f2e20'; x.fillRect(i * 0.75 + 0.72, 0, 0.03, 2); }
    circle(x, 0.3, 1.2, 0.03, '#2f2218'); circle(x, 1.8, 0.4, 0.03, '#2f2218');
  } },
  cellar: { base: '#4a3a33', draw(x, r) { // rough stone
    x.fillStyle = '#3e322c'; x.fillRect(0, 0, 3, 2);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) { const w = 0.7 + r() * 0.3; x.fillStyle = shade('#4c3d35', (r() - 0.5) * 0.25); x.beginPath(); x.ellipse(i * 0.8 + (row % 2) * 0.4, row * 0.7 + 0.3, w / 2, 0.3, 0, 0, 7); x.fill(); }
  } },
  den: { base: '#c9b28a', draw(x) { // newspaper the mice pasted up
    x.fillStyle = '#cbb894'; x.fillRect(0, 0, 2, 2); x.fillStyle = '#9c8a6a';
    for (let i = 0; i < 9; i++) x.fillRect(0.12, 0.15 + i * 0.2, i % 3 === 2 ? 0.6 : 0.8, 0.05);
    for (let i = 0; i < 9; i++) x.fillRect(1.1, 0.15 + i * 0.2, i % 4 === 3 ? 0.4 : 0.78, 0.05);
    x.fillStyle = '#6f604a'; x.fillRect(0.12, 0.1, 0.5, 0.1);
  } },
};

// windows on the back walls: [x, y, w, h, room]
const WINDOWS = [[11, 16, 3, 3.5], [27, 16, 2.6, 3.2], [58, 16.5, 3, 3], [8, 27, 3, 3.2], [43, 27, 2.6, 3], [52, 27, 3, 3.2], [33.5, 6.5, 2, 2.2]];

export class Art {
  constructor() { this.bake = null; this.B = 0; this.t = 0; }

  // ============== BAKE
  build(game, B) {
    this.B = B;
    const c = document.createElement('canvas'); c.width = L.W * B; c.height = L.H * B;
    const ctx = c.getContext('2d'); ctx.scale(B, B);
    const r = rng(1923);
    const map = game.base; // the original map; tiles that change are drawn live
    this.sky(ctx, r);
    this.garden(ctx, r, game);
    this.interiors(ctx, r, B);
    this.tiles(ctx, r, map);
    this.furniture(ctx, r);
    this.notes(ctx, r);
    this.grain(ctx, B, c);
    this.bake = c;
    // room shapes (for darkness and labels)
    this.roomPaths = {};
    for (const room of L.ROOMS) {
      if (room.outdoor) continue;
      const p = new Path2D();
      for (let y = room.y0; y <= room.y1; y++) {
        let x0 = -1;
        for (let x = room.x0; x <= room.x1 + 1; x++) {
          const inside = x <= room.x1 && game.roomAt(x + 0.5, y + 0.5) === room;
          if (inside && x0 < 0) x0 = x; if (!inside && x0 >= 0) { p.rect(x0 - 0.02, y - 0.02, x - x0 + 0.04, 1.04); x0 = -1; }
        }
      }
      this.roomPaths[room.id] = p;
    }
    return c;
  }
  sky(ctx, r) {
    const g = ctx.createLinearGradient(0, 0, 0, 40);
    g.addColorStop(0, PAL.sky0); g.addColorStop(0.55, PAL.sky1); g.addColorStop(1, PAL.sky2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, L.W, L.H);
    for (let i = 0; i < 260; i++) { const x = r() * L.W, y = r() * 30; ctx.globalAlpha = 0.3 + r() * 0.6; circle(ctx, x, y, 0.03 + r() * 0.05, '#f6efd6'); }
    ctx.globalAlpha = 1;
    // moon with a soft halo
    const mg = ctx.createRadialGradient(87, 7, 0.5, 87, 7, 7); mg.addColorStop(0, 'rgba(250,240,205,.35)'); mg.addColorStop(1, 'rgba(250,240,205,0)');
    ctx.fillStyle = mg; ctx.fillRect(78, 0, 18, 15);
    circle(ctx, 87, 7, 1.7, '#f4ead0'); ell(ctx, 86.4, 6.6, 0.4, 0.3, 0.3, '#e2d6b6'); ell(ctx, 87.7, 7.7, 0.3, 0.22, 0, '#e2d6b6');
    // distant chimney pots of the next street
    ctx.fillStyle = '#1c2140';
    ctx.beginPath(); ctx.moveTo(73, 30);
    let x = 73; while (x < 96) { const w = 2 + r() * 3, h = 18 + r() * 7; ctx.lineTo(x, h); ctx.lineTo(x + w * 0.5, h - 1.2); ctx.lineTo(x + w, h); if (r() < 0.6) { ctx.lineTo(x + w * 0.7, h); ctx.lineTo(x + w * 0.7, h - 1.8); ctx.lineTo(x + w * 0.85, h - 1.8); ctx.lineTo(x + w * 0.85, h); } x += w; }
    ctx.lineTo(96, 30); ctx.lineTo(96, 40); ctx.lineTo(73, 40); ctx.fill();
    for (let i = 0; i < 14; i++) { ctx.fillStyle = r() < 0.5 ? '#e8b85a' : '#c89a4a'; ctx.globalAlpha = 0.6; ctx.fillRect(74 + r() * 21, 25.6 + r() * 3, 0.3, 0.42); }
    ctx.globalAlpha = 1;
    // a far hill on the left behind the house
    ctx.fillStyle = '#1d2343'; ctx.beginPath(); ctx.moveTo(-1, 22); ctx.quadraticCurveTo(20, 10, 40, 16); ctx.quadraticCurveTo(60, 20, 75, 15); ctx.quadraticCurveTo(86, 12, 97, 19); ctx.lineTo(97, 40); ctx.lineTo(-1, 40); ctx.fill();
  }
  garden(ctx, r) {
    // hedge and fence behind the lawn
    ctx.fillStyle = '#26371f'; ctx.beginPath(); ctx.moveTo(73, 36);
    for (let x = 73; x <= 95; x += 0.8) ctx.lineTo(x, 29.5 + Math.sin(x * 1.3) * 0.5 + r() * 0.6);
    ctx.lineTo(95, 36); ctx.fill();
    for (let i = 0; i < 70; i++) { ell(ctx, 73 + r() * 22, 30 + r() * 5.5, 0.4 + r() * 0.5, 0.3 + r() * 0.3, r(), r() < 0.5 ? '#2f4527' : '#355230'); }
    // tree trunk and foliage behind the branch shelves
    ctx.fillStyle = '#3b2a1e';
    ctx.beginPath(); ctx.moveTo(82.2, 36); ctx.bezierCurveTo(82.0, 31, 82.8, 28, 82.3, 24); ctx.lineTo(83.6, 24); ctx.bezierCurveTo(83.4, 28, 84.0, 31, 84.3, 36); ctx.fill();
    for (const [x0, y, x1] of [[79, 34, 83], [83, 32, 87], [79, 30, 83], [83, 28, 87], [80, 26, 84]]) {
      ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(83, y + 0.6); ctx.quadraticCurveTo((x0 + x1) / 2, y + 0.4, x0 < 82 ? x0 : x1, y + 0.2); ctx.stroke();
    }
    for (let i = 0; i < 90; i++) { const a = r() * Math.PI * 2, d = r(); ell(ctx, 83 + Math.cos(a) * d * 5.5, 27.5 + Math.sin(a) * d * 5, 0.6 + r() * 0.6, 0.45 + r() * 0.4, r(), ['#2b4224', '#33502b', '#3d5d32', '#456a3a'][Math.floor(r() * 4)]); }
    for (let i = 0; i < 30; i++) { ctx.globalAlpha = 0.6; ell(ctx, 83 + (r() - 0.3) * 8, 23 + r() * 8, 0.35, 0.2, r(), '#6d8a5c'); } // moonlit leaves
    ctx.globalAlpha = 1;
    // flowers in the bed by the wall
    for (let i = 0; i < 30; i++) { const x = 74 + r() * 20; ctx.strokeStyle = '#35502e'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(x, 36); ctx.lineTo(x + (r() - 0.5) * 0.3, 35.2 - r() * 0.6); ctx.stroke(); circle(ctx, x + (r() - 0.5) * 0.3, 35.1 - r() * 0.6, 0.1, ['#c97b8e', '#e8d58a', '#d9e2f0', '#b45a5a'][Math.floor(r() * 4)]); }
  }
  interiors(ctx, r, B) {
    const room = (id) => L.ROOMS.find(q => q.id === id);
    const fillPaper = (id, x0, y0, x1, y1, key) => {
      const k = key || id, P = PAPERS[k];
      const pc = patternCanvas(B, ...(k === 'tiles' || k === 'kitchen' ? [0.5, 0.5] : k === 'landing' ? [1.5, 1.5] : k === 'hall' ? [1.4, 1.4] : k === 'parlour' ? [2, 2.4] : k === 'nursery' ? [2.4, 2.4] : k === 'attic' || k === 'cellar' ? [3, 2] : [2, 2]), P.draw);
      const pat = ctx.createPattern(pc, 'repeat'); pat.setTransform(new DOMMatrix().scale(1 / B));
      ctx.fillStyle = pat; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    };
    // attic: under the roof
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, 14);
    for (let x = 0; x <= 72; x++) ctx.lineTo(x, L.roofY(x) + 1.5);
    ctx.lineTo(72, 14); ctx.closePath(); ctx.clip();
    fillPaper('attic', 0, 2, 72, 14);
    // rafters
    for (let x = 6; x < 70; x += 7) { paint(ctx, x, 2, 0.45, 12, '#47331f', r, { vert: true, streaks: 3 }); }
    ctx.restore();
    // rooms
    const R = [['bedroom', 1, 15, 22, 25], ['landing', 22, 15, 48, 25], ['nursery', 48, 15, 72, 25], ['parlour', 1, 26, 22, 36], ['hall', 22, 26, 48, 36], ['kitchen', 48, 26, 72, 36], ['den', 1, 37, 15, 47], ['cellar', 15, 37, 72, 47]];
    for (const [id, x0, y0, x1, y1] of R) {
      fillPaper(id, x0, y0, x1, y1);
      if (id === 'kitchen') fillPaper(id, x0, y0 + 5.5, x1, y1, 'tiles');
      if (id !== 'cellar' && id !== 'den' && id !== 'kitchen') {
        // wainscot below the dado rail, a picture rail up top, skirting at the floor
        const wy = y1 - 3.2;
        paint(ctx, x0, wy, x1 - x0, y1 - wy, id === 'nursery' ? '#e9e0c6' : id === 'parlour' ? '#4b2a20' : '#5c3b26', r, { streaks: 20, edge: false });
        for (let x = x0 + 0.6; x < x1 - 1; x += 2.2) { ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 0.06; ctx.strokeRect(x, wy + 0.5, 1.7, 2.1); ctx.strokeStyle = 'rgba(255,240,210,.12)'; ctx.strokeRect(x + 0.05, wy + 0.55, 1.7, 2.1); }
        paint(ctx, x0, wy - 0.18, x1 - x0, 0.22, '#3e2617', r, { streaks: 4, edge: false, light: true });
        paint(ctx, x0, y0 + 0.4, x1 - x0, 0.14, '#3e2617', r, { streaks: 3, edge: false });
      }
      paint(ctx, x0, y1 - 0.42, x1 - x0, 0.42, id === 'cellar' || id === 'den' ? '#2c221d' : '#2f1d12', r, { streaks: 6, edge: false, light: true });
      // soft room shadow: darker at the ceiling and corners
      const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(20,10,5,.35)'); g.addColorStop(0.3, 'rgba(20,10,5,0)'); g.addColorStop(0.85, 'rgba(20,10,5,0)'); g.addColorStop(1, 'rgba(20,10,5,.25)');
      ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    // the inside of the chimney flue is sooty
    ctx.fillStyle = '#1c1512'; ctx.fillRect(67, 5, 2, 27);
    // windows showing the night
    for (const [x, y, w, h] of WINDOWS) {
      paint(ctx, x - 0.2, y - 0.2, w + 0.4, h + 0.4, '#e9dcbc', r, { streaks: 3 });
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#1a2045'); g.addColorStop(1, '#3a3e68');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      for (let i = 0; i < 6; i++) circle(ctx, x + r() * w, y + r() * h * 0.7, 0.03, '#f4ecd0');
      if (r() < 0.6) circle(ctx, x + w * 0.7, y + h * 0.3, 0.3, '#efe4c4');
      ctx.fillStyle = '#e9dcbc'; ctx.fillRect(x + w / 2 - 0.05, y, 0.1, h); ctx.fillRect(x, y + h / 2 - 0.05, w, 0.1);
      // curtains
      const cc = y > 25 ? '#6f2b39' : '#7a5a8c';
      for (const s of [-1, 1]) {
        ctx.fillStyle = cc; ctx.beginPath(); const cx = s < 0 ? x - 0.3 : x + w + 0.3;
        ctx.moveTo(cx, y - 0.4); ctx.lineTo(cx + s * -0.9, y - 0.4); ctx.quadraticCurveTo(cx + s * -0.3, y + h * 0.5, cx + s * -0.7, y + h + 0.3); ctx.lineTo(cx, y + h + 0.3); ctx.fill();
        ctx.fillStyle = shade(cc, 0.15); ctx.fillRect(cx + s * -0.45, y - 0.3, 0.08, h + 0.5);
      }
      paint(ctx, x - 0.6, y - 0.6, w + 1.2, 0.25, '#3e2617', r, { streaks: 2 });
    }
    // portraits and frames
    const frame = (x, y, w, h, inner) => { paint(ctx, x, y, w, h, PAL.brass, r, { streaks: 4 }); ctx.fillStyle = inner; ctx.fillRect(x + 0.18, y + 0.18, w - 0.36, h - 0.36); };
    frame(17, 18.5, 1.6, 2, '#3a4a3a'); circle(ctx, 17.8, 19.3, 0.32, '#d9b08a'); ell(ctx, 17.8, 20.2, 0.5, 0.35, 0, '#2a2a3a');
    frame(39, 17, 1.5, 1.8, '#5a4a3a'); ell(ctx, 39.75, 17.9, 0.4, 0.3, 0, '#7a8a5a');
    frame(31, 27.5, 1.6, 2, '#2e3a4a'); circle(ctx, 31.8, 28.3, 0.3, '#e0c09a'); ell(ctx, 31.8, 29.2, 0.5, 0.3, 0, '#5a2a2a');
    frame(3, 27.5, 2.2, 1.6, '#3e5a6a'); ctx.fillStyle = '#5f7f5a'; ctx.beginPath(); ctx.moveTo(3.2, 28.9); ctx.lineTo(4, 28.2); ctx.lineTo(4.6, 28.6); ctx.lineTo(5.0, 28.3); ctx.lineTo(5.0, 28.9); ctx.fill();
    frame(13, 27, 1.4, 1.8, '#4a3040'); circle(ctx, 13.7, 27.8, 0.28, '#e0c09a');
    // nursery: an alphabet frieze
    const cols = ['#c0533f', '#3f7bb0', '#d9a33f', '#4f8f5a'];
    for (let i = 0; i < 8; i++) { paint(ctx, 49.5 + i * 2, 15.6, 0.9, 0.9, cols[i % 4], r, { streaks: 2 }); }
    // kitchen: dresser of plates painted on the wall, a sink
    paint(ctx, 62.6, 29.8, 0.1, 0.1, '#000', r, { edge: false, streaks: 0 });
    paint(ctx, 50, 28, 4.5, 8, '#6e4a2c', r, { streaks: 12 });
    for (let s = 0; s < 3; s++) { paint(ctx, 50.2, 28.8 + s * 1.2, 4.1, 0.12, '#4e3220', r, { streaks: 1 }); for (let i = 0; i < 4; i++) circle(ctx, 50.7 + i * 1.0, 28.35 + s * 1.2, 0.36, i % 2 ? '#e8ecf0' : '#dfe6ee', '#5876a0', 0.05); }
    paint(ctx, 50, 32.5, 4.5, 3.5, '#5e3d24', r, { streaks: 8 }); ctx.fillStyle = '#3e2617'; ctx.fillRect(52.2, 32.8, 0.08, 3); circle(ctx, 51.9, 34, 0.08, PAL.brass); circle(ctx, 52.6, 34, 0.08, PAL.brass);
    // cellar: jars on shelves, coal
    for (let i = 0; i < 9; i++) { const x = 17 + i * 0.6; paint(ctx, x, 39.3, 0.45, 0.7, ['#c98b3a', '#8f3a3a', '#c9b24a', '#5f7f3a'][i % 4], r, { streaks: 1 }); }
    paint(ctx, 16.5, 40, 6, 0.15, '#3e2617', r, { streaks: 1 });
    ctx.fillStyle = '#16120f'; ctx.beginPath(); ctx.moveTo(41, 47); ctx.quadraticCurveTo(43.5, 43.4, 47, 46); ctx.quadraticCurveTo(48, 45.5, 49.5, 47); ctx.fill();
    for (let i = 0; i < 25; i++) circle(ctx, 41.5 + r() * 7.5, 46.2 + r() * 0.7, 0.12 + r() * 0.12, r() < 0.5 ? '#221c18' : '#2e2622');
    // the mice's den: a matchbox bed, a thimble table
    paint(ctx, 9, 46.4, 1.4, 0.6, '#b8473a', r, { streaks: 2 }); ctx.fillStyle = '#e8d8b0'; ctx.fillRect(9.2, 46.5, 1.0, 0.2);
    // the hall: coat stand
    ctx.strokeStyle = '#3e2617'; ctx.lineWidth = 0.14; ctx.beginPath(); ctx.moveTo(45.5, 36); ctx.lineTo(45.5, 31); ctx.moveTo(45, 31.4); ctx.lineTo(46, 31.4); ctx.stroke();
    ell(ctx, 45.1, 32.2, 0.35, 0.8, 0.1, '#4a4a6a'); ell(ctx, 45.9, 31.9, 0.25, 0.5, -0.1, '#7a3a2a');
    // a rug in the hall and parlour
    for (const [x0, x1, c] of [[23.5, 31, '#7e3a2e'], [8, 14.5, '#2e4a6a']]) { ctx.fillStyle = c; ctx.globalAlpha = 0.9; ctx.fillRect(x0, 35.85, x1 - x0, 0.15); ctx.globalAlpha = 1; }
    // parlour fireplace
    paint(ctx, 8.6, 31.3, 4.8, 4.7, '#d9d0c0', r, { streaks: 6 }); ctx.fillStyle = '#1a1410'; ctx.fillRect(9.6, 32.6, 2.8, 3.4);
    // attic clutter: a dressmaker's dummy, a rolled rug, cobwebs
    ell(ctx, 47.5, 11.4, 0.5, 0.8, 0, '#9c8a72'); ctx.fillStyle = '#3e2617'; ctx.fillRect(47.45, 12.2, 0.1, 1.8);
    ctx.strokeStyle = 'rgba(230,225,210,.35)'; ctx.lineWidth = 0.03;
    for (const [x, y, s] of [[10, 10, 1], [62, 10, -1], [22.5, 37.2, 1], [70.5, 37.2, -1], [1.2, 15.2, 1]]) {
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * Math.cos(i * 0.4) * 1.4, y + Math.sin(i * 0.4) * 1.4); ctx.stroke(); }
      for (let k = 1; k < 4; k++) { ctx.beginPath(); for (let i = 0; i < 5; i++) ctx.lineTo(x + s * Math.cos(i * 0.4) * k * 0.4, y + Math.sin(i * 0.4) * k * 0.4); ctx.stroke(); }
    }
  }
  tiles(ctx, r, map) {
    const T = (x, y) => (x < 0 || y < 0 || x >= L.W || y >= L.H) ? '.' : map[y][x];
    const done = new Set();
    // components of furniture-like tiles get painted as one object
    const comp = (x, y, c) => {
      const q = [[x, y]]; let x0 = x, x1 = x, y0 = y, y1 = y; done.add(y * L.W + x);
      while (q.length) { const [a, b] = q.pop(); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = a + dx, ny = b + dy; if (T(nx, ny) === c && !done.has(ny * L.W + nx)) { done.add(ny * L.W + nx); q.push([nx, ny]); } } }
      return { x0, y0, x1: x1 + 1, y1: y1 + 1, n: 0 };
    };
    const count = (b, c) => { let n = 0; for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) if (T(x, y) === c) n++; return n; };
    for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
      const c = T(x, y);
      if (c === '#') this.frameTile(ctx, r, x, y, T);
      else if (c === 'r') this.roofTile(ctx, r, x, y, T);
      else if (c === 'R') { ctx.save(); ctx.beginPath(); ctx.rect(x, y, 1, 1); ctx.clip(); ctx.fillStyle = PAL.mortar; ctx.fillRect(x, y, 1, 1); for (let i = 0; i < 3; i++) { const off = (y % 2) * 0.5; for (let k = -1; k < 2; k++) paint(ctx, x + off + k * 0.5 + 0.03, y + i * 0.333 + 0.03, 0.44, 0.27, shade(PAL.brick, (r() - 0.5) * 0.25), r, { streaks: 1, edge: false, wob: 0.01 }); } ctx.restore(); }
      else if (c === 'E') { ctx.fillStyle = PAL.earth; ctx.fillRect(x, y, 1.01, 1.01); if (r() < 0.25) circle(ctx, x + r(), y + r(), 0.08 + r() * 0.08, PAL.earthL); if (T(x, y - 1) === '.') { ctx.fillStyle = PAL.grass; ctx.fillRect(x, y, 1.01, 0.22); for (let i = 0; i < 5; i++) { ctx.fillStyle = r() < 0.5 ? PAL.grass : PAL.grassL; ctx.beginPath(); const gx = x + r(); ctx.moveTo(gx - 0.06, y + 0.1); ctx.lineTo(gx + (r() - 0.5) * 0.15, y - 0.25 - r() * 0.2); ctx.lineTo(gx + 0.06, y + 0.1); ctx.fill(); } } }
      else if (c === '=' || c === 'g') {
        if (c === 'g') { ctx.fillStyle = PAL.iron; ctx.fillRect(x, y, 1, 0.22); for (let i = 0; i < 4; i++) { ctx.fillStyle = PAL.ironL; ctx.fillRect(x + i * 0.25 + 0.05, y + 0.03, 0.12, 0.14); } continue; }
        paint(ctx, x - 0.02, y, 1.04, 0.24, '#7a4a2b', r, { streaks: 2, edge: false, light: true });
        ctx.fillStyle = '#3e2617'; ctx.fillRect(x - 0.02, y + 0.22, 1.04, 0.04);
        if (T(x - 1, y) !== '=' || (x % 3 === 0 && T(x + 1, y) === '=')) { ctx.fillStyle = '#4e3220'; ctx.beginPath(); ctx.moveTo(x + 0.15, y + 0.24); ctx.lineTo(x + 0.15, y + 0.6); ctx.lineTo(x + 0.45, y + 0.24); ctx.fill(); }
      } else if (c === '^') this.pins(ctx, r, x, y);
      else if (c === 'S') { paint(ctx, x - 0.05, y, 1.1, 0.3, '#6e4429', r, { streaks: 2, light: true }); paint(ctx, x, y + 0.3, 0.96, 0.7, '#e6d6b2', r, { streaks: 2 }); ctx.fillStyle = '#3e2617'; ctx.fillRect(x + 0.42, y - 1.2, 0.08, 1.2); }
      else if ('TCKIJ'.includes(c) && !done.has(y * L.W + x)) {
        const b = comp(x, y, c);
        if (count(b, c) === (b.x1 - b.x0) * (b.y1 - b.y0)) this.object(ctx, r, c, b);
        else for (let yy = b.y0; yy < b.y1; yy++) for (let xx = b.x0; xx < b.x1; xx++) if (T(xx, yy) === c) this.object(ctx, r, c, { x0: xx, y0: yy, x1: xx + 1, y1: yy + 1 });
      }
    }
    // stair rail
    ctx.strokeStyle = '#3e2617'; ctx.lineWidth = 0.14; ctx.beginPath(); ctx.moveTo(42.4, 24.8); ctx.lineTo(32.4, 34.8); ctx.stroke();
  }
  frameTile(ctx, r, x, y, T) {
    const open = (c) => !L.SOLID.has(c) || c === 'D';
    const slab = y === 14 || y === 25 || y === 36 || y === 47;
    if (slab) {
      paint(ctx, x - 0.01, y, 1.02, 1, PAL.cream, r, { streaks: 3, edge: false });
      if (open(T(x, y - 1)) || T(x, y - 1) === '^') { ctx.fillStyle = PAL.board; ctx.fillRect(x - 0.01, y, 1.02, 0.26); ctx.fillStyle = PAL.boardD; ctx.fillRect(x + (x * 37 % 10) / 10, y + 0.02, 0.04, 0.22); ctx.fillStyle = PAL.boardL; ctx.globalAlpha = 0.5; ctx.fillRect(x, y, 1.0, 0.05); ctx.globalAlpha = 1; }
      ctx.fillStyle = PAL.creamD; ctx.fillRect(x - 0.01, y + 0.82, 1.02, 0.08);
      if (open(T(x, y + 1))) { ctx.fillStyle = 'rgba(40,20,10,.25)'; ctx.fillRect(x, y + 0.92, 1, 0.08); }
    } else {
      paint(ctx, x, y, 1, 1, PAL.cream2, r, { streaks: 2, edge: false, vert: true });
      ctx.fillStyle = PAL.creamD;
      if (open(T(x - 1, y))) ctx.fillRect(x, y, 0.08, 1);
      if (open(T(x + 1, y))) ctx.fillRect(x + 0.92, y, 0.08, 1);
    }
    if (y === 47 || x === 0 || x === 72) { // the outside of the box is painted green
      if ((x === 0 || x === 72) && !slab) { ctx.fillStyle = '#3f5a4a'; ctx.fillRect(x + (x === 0 ? 0 : 0.5), y, 0.5, 1); ctx.fillStyle = '#e9dcbc'; ctx.fillRect(x + (x === 0 ? 0.48 : 0.45), y, 0.07, 1); }
    }
  }
  roofTile(ctx, r, x, y, T) {
    paint(ctx, x - 0.02, y, 1.04, 1.02, PAL.slateD, r, { streaks: 0, edge: false });
    for (let row = 0; row < 2; row++) for (let k = 0; k < 3; k++) {
      const sx = x + k * 0.34 + (row % 2) * 0.17 - 0.17, sy = y + row * 0.5;
      ctx.fillStyle = shade(PAL.slate, (r() - 0.5) * 0.25); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 0.34, sy); ctx.lineTo(sx + 0.34, sy + 0.32); ctx.arc(sx + 0.17, sy + 0.32, 0.17, 0, Math.PI); ctx.closePath(); ctx.fill();
    }
    if (T(x, y - 1) === '.' || T(x, y - 1) === undefined) { ctx.fillStyle = PAL.slateL; ctx.fillRect(x - 0.02, y, 1.04, 0.1); ctx.fillStyle = '#7d4a3a'; ctx.fillRect(x - 0.02, y - 0.05, 1.04, 0.08); }
    if (T(x, y + 1) !== 'r') { ctx.fillStyle = '#e9dcbc'; ctx.fillRect(x - 0.02, y + 0.88, 1.04, 0.12); }
  }
  pins(ctx, r, x, y) {
    const attic = y < 14, cellar = y > 37;
    if (cellar) { for (let i = 0; i < 5; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(190,220,215,.8)' : 'rgba(150,190,190,.7)'; ctx.beginPath(); const bx = x + r() * 0.8; ctx.moveTo(bx, y + 1); ctx.lineTo(bx + 0.1 + r() * 0.15, y + 0.4 + r() * 0.3); ctx.lineTo(bx + 0.3, y + 1); ctx.fill(); } return; }
    if (attic) { ell(ctx, x + 0.5, y + 0.95, 0.6, 0.12, 0, '#6a3a4a'); }
    for (let i = 0; i < 4; i++) {
      const px = x + 0.12 + i * 0.25 + (r() - 0.5) * 0.08, top = y + 0.35 + r() * 0.2, lean = (r() - 0.5) * 0.25;
      ctx.strokeStyle = '#c8ccd2'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(px, y + 1); ctx.lineTo(px + lean, top); ctx.stroke();
      if (attic) circle(ctx, px + lean, top, 0.08, ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60'][Math.floor(r() * 4)]);
      else { ctx.fillStyle = '#9aa0a8'; ctx.fillRect(px + lean - 0.09, top - 0.03, 0.18, 0.05); }
    }
  }
  object(ctx, r, c, b) {
    const { x0, y0, x1, y1 } = b, w = x1 - x0, h = y1 - y0;
    const key = `${x0},${y0}`;
    const named = { '1,17': 'wardrobe', '15,23': 'bedfoot', '3,33': 'sofa', '15,33': 'piano', '25,28': 'clock', '59,29': 'cupboard', '65,34': 'range', '71,30': 'boiler', '66,41': 'boiler2', '62,37': 'pipe', '57,28': 'rack', '8,18': 'bedhead', '38,8': 'bedstead' }[key];
    if (named === 'wardrobe') {
      paint(ctx, x0, y0, w, h, '#6b4227', r, { streaks: 12, light: true });
      paint(ctx, x0 + 0.2, y0 + 0.4, w / 2 - 0.3, h - 0.9, '#5a361f', r, { streaks: 4 }); paint(ctx, x0 + w / 2 + 0.1, y0 + 0.4, w / 2 - 0.3, h - 0.9, '#5a361f', r, { streaks: 4 });
      circle(ctx, x0 + w / 2 - 0.25, y0 + h / 2, 0.08, PAL.brass); circle(ctx, x0 + w / 2 + 0.25, y0 + h / 2, 0.08, PAL.brass);
      paint(ctx, x0 - 0.1, y0 - 0.15, w + 0.2, 0.25, '#4e2f1a', r, { streaks: 2 });
      ctx.fillStyle = '#3a2414'; ctx.fillRect(x0 + 0.1, y1, 0.15, 1); ctx.fillRect(x1 - 0.25, y1, 0.15, 1); // legs over the mouse gap
      return;
    }
    if (named === 'sofa') {
      paint(ctx, x0 - 0.2, y0 - 0.6, w + 0.4, 1.2, '#3e5a4a', r, { streaks: 6 });
      paint(ctx, x0, y0 + 0.3, w, h - 0.3, '#4a6a58', r, { streaks: 8, light: true });
      for (let i = 0; i < 3; i++) circle(ctx, x0 + 1 + i * 1.5, y0 - 0.1, 0.06, '#2a3e32');
      paint(ctx, x0 - 0.4, y0 - 0.2, 0.6, h + 0.2, '#3e5a4a', r, { streaks: 3 }); paint(ctx, x1 - 0.2, y0 - 0.2, 0.6, h + 0.2, '#3e5a4a', r, { streaks: 3 });
      return;
    }
    if (named === 'piano') {
      paint(ctx, x0, y0 - 1.6, w, 1.7, '#241510', r, { streaks: 6, light: true });
      paint(ctx, x0, y0, w, h, '#2b1913', r, { streaks: 8, light: true });
      ctx.fillStyle = '#f3ead6'; ctx.fillRect(x0 + 0.1, y0 + 0.1, w - 0.2, 0.35);
      for (let i = 0; i < 22; i++) { ctx.fillStyle = '#1a100c'; if (i % 7 !== 2 && i % 7 !== 6) ctx.fillRect(x0 + 0.25 + i * 0.21, y0 + 0.1, 0.1, 0.2); }
      paint(ctx, x0 + 0.5, y0 - 1.3, 1.2, 0.8, '#e9dcbc', r, { streaks: 2 }); // sheet music
      ctx.fillStyle = '#1a100c'; ctx.fillRect(x0 + 0.2, y1, 0.2, 1); ctx.fillRect(x1 - 0.4, y1, 0.2, 1);
      return;
    }
    if (named === 'clock') {
      paint(ctx, x0 - 0.15, y0, w + 0.3, h, '#5a2f1a', r, { streaks: 10, light: true, edgeC: '#2a160c' });
      paint(ctx, x0 - 0.3, y0, w + 0.6, 0.4, '#3e1f10', r, { streaks: 2 });
      circle(ctx, x0 + w / 2, y0 + 1.2, 0.75, '#efe5c8', PAL.brass, 0.12);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.fillStyle = PAL.ink; ctx.fillRect(x0 + w / 2 + Math.cos(a) * 0.6 - 0.02, y0 + 1.2 + Math.sin(a) * 0.6 - 0.02, 0.05, 0.05); }
      ctx.fillStyle = '#2a160c'; ctx.fillRect(x0 + 0.3, y0 + 2.5, w - 0.6, h - 3.2); // pendulum window (pendulum drawn live)
      return;
    }
    if (named === 'cupboard') { paint(ctx, x0, y0, w, h, '#7a5a3a', r, { streaks: 6, light: true }); ctx.fillStyle = '#4e3220'; ctx.fillRect(x0 + w / 2 - 0.03, y0 + 0.2, 0.06, h - 0.4); circle(ctx, x0 + w / 2 - 0.2, y0 + h / 2, 0.07, PAL.brass); circle(ctx, x0 + w / 2 + 0.2, y0 + h / 2, 0.07, PAL.brass); return; }
    if (named === 'bedfoot') { paint(ctx, x0, y0, w, h, '#6b4227', r, { streaks: 3, light: true }); return; }
    if (c === 'I' || c === 'J') {
      if (named === 'range') {
        paint(ctx, x0, y0, w, h, PAL.iron, r, { streaks: 10, edgeC: '#18191c' });
        paint(ctx, x0 - 0.1, y0 - 0.12, w + 0.2, 0.22, '#4a4d55', r, { streaks: 3, light: true });
        for (const dx of [0.6, 3.4]) { paint(ctx, x0 + dx, y0 + 0.45, 1.8, 1.25, '#26272b', r, { streaks: 2 }); ctx.fillStyle = PAL.brass; ctx.fillRect(x0 + dx + 0.7, y0 + 1.0, 0.4, 0.08); }
        return;
      }
      if (named === 'pipe' || named === 'rack' || named === 'bedhead' || named === 'bedstead' || named === 'boiler') {
        paint(ctx, x0 + 0.08, y0, w - 0.16, h, PAL.iron, r, { streaks: 4, vert: true, edgeC: '#18191c' });
        ctx.fillStyle = PAL.ironH; ctx.globalAlpha = 0.5; ctx.fillRect(x0 + 0.22, y0 + 0.1, 0.08, h - 0.2); ctx.globalAlpha = 1;
        for (let y = y0 + 0.5; y < y1; y += 1.5) { paint(ctx, x0, y, w, 0.22, '#45484f', r, { streaks: 1, light: true }); }
        if (named === 'bedhead' || named === 'bedstead') { circle(ctx, x0 + 0.5, y0 + 0.05, 0.22, PAL.brass, PAL.brassD); }
        if (named === 'rack') { for (let i = 0; i < 3; i++) { ctx.strokeStyle = '#18191c'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(x0 + 0.5, y0 + 1 + i); ctx.lineTo(x0 - 0.3, y0 + 1.3 + i); ctx.stroke(); circle(ctx, x0 - 0.5, y0 + 1.6 + i, 0.32, '#8a5a3a', '#4e3220'); } ctx.strokeStyle = PAL.iron; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(x0 + 0.5, y0); ctx.lineTo(x0 + 0.5, 26); ctx.stroke(); }
        if (named === 'boiler') { circle(ctx, x0 + 0.5, y0 + 1.5, 0.3, '#efe5c8', PAL.brass, 0.08); }
        return;
      }
      // boiler room: a big riveted iron drum
      paint(ctx, x0, y0, w, h, PAL.iron, r, { streaks: 10, edgeC: '#18191c' });
      for (let x = x0 + 0.4; x < x1; x += 0.8) for (let y = y0 + 0.3; y < y1; y += 1.6) circle(ctx, x, y, 0.06, PAL.ironH);
      circle(ctx, x0 + w / 2, y0 + h / 2, 0.55, '#efe5c8', PAL.brass, 0.1); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(x0 + w / 2, y0 + h / 2); ctx.lineTo(x0 + w / 2 + 0.3, y0 + h / 2 - 0.25); ctx.stroke();
      ctx.fillStyle = '#e87a2a'; ctx.globalAlpha = 0.7; ctx.fillRect(x0 + 0.6, y1 - 1.1, w - 1.2, 0.35); ctx.globalAlpha = 1;
      return;
    }
    if (c === 'T') {
      if (y0 > 36) { // cellar crates and barrels
        if (w <= 2 && h <= 2) { paint(ctx, x0, y0, w, h, '#7a5634', r, { streaks: 5, light: true }); ctx.strokeStyle = '#4e3220'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.moveTo(x1, y0); ctx.lineTo(x0, y1); ctx.stroke(); ctx.strokeRect(x0 + 0.05, y0 + 0.05, w - 0.1, h - 0.1); return; }
        paint(ctx, x0, y0, w, h, y0 > 42 && x0 < 15 ? '#b08a5a' : '#6e4a2c', r, { streaks: 8, light: true });
        if (x0 < 15) { ctx.fillStyle = '#7a5634'; ctx.font = '0.4px serif'; for (let i = 0; i < w; i++) ctx.fillRect(x0 + i + 0.1, y0 + 0.1, 0.8, 0.06); }
        else for (let y = y0 + 0.7; y < y1; y += 0.9) { ctx.fillStyle = '#3a2a1c'; ctx.fillRect(x0, y, w, 0.1); }
        return;
      }
      // attic trunks: leather with brass corners
      paint(ctx, x0, y0, w, h, '#6a3a26', r, { streaks: 6, light: true });
      paint(ctx, x0, y0, w, 0.35, '#7a4630', r, { streaks: 2 });
      for (const [cx, cy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) circle(ctx, cx + (cx === x0 ? 0.12 : -0.12), cy + (cy === y0 ? 0.12 : -0.12), 0.12, PAL.brass);
      ctx.fillStyle = PAL.brassD; ctx.fillRect(x0 + w / 2 - 0.12, y0 + 0.25, 0.24, 0.3);
      return;
    }
    if (c === 'K') { for (let y = y0; y < y1; y += 0.25) paint(ctx, x0 + (r() - 0.5) * 0.15, y, w, 0.24, ['#6a2a2a', '#2a4a6a', '#3a5a3a', '#7a6a3a'][Math.floor(r() * 4)], r, { streaks: 1 }); return; }
    paint(ctx, x0, y0, w, h, '#6b4227', r, { streaks: 6, light: true });
  }
  furniture(ctx, r) {
    // things painted behind the soldier that do not block him
    // bedroom: bed with a quilt
    paint(ctx, 9, 22, 6, 0.7, '#e9e0c6', r, { streaks: 3 });
    paint(ctx, 9.3, 21.6, 5.7, 0.55, '#8a3a4a', r, { streaks: 4 });
    for (let i = 0; i < 5; i++) { ctx.fillStyle = '#a85a6a'; ctx.fillRect(9.5 + i * 1.1, 21.7, 0.5, 0.35); }
    ell(ctx, 9.8, 21.6, 0.6, 0.3, 0, '#f3ead6');
    ctx.fillStyle = '#3a2414'; ctx.fillRect(9.1, 22.7, 0.15, 2.3); ctx.fillRect(14.7, 22.7, 0.15, 2.3);
    // nursery: a cot and a toy shelf
    paint(ctx, 58.5, 21, 4, 0.2, '#e9dcbc', r, { streaks: 1 });
    for (let i = 0; i < 9; i++) { ctx.fillStyle = '#e9dcbc'; ctx.fillRect(58.6 + i * 0.45, 21, 0.1, 3); }
    paint(ctx, 58.5, 24, 4, 0.2, '#e9dcbc', r, { streaks: 1 });
    // on the high shelf: a little teddy and a top
    ell(ctx, 52.6, 17.5, 0.35, 0.45, 0, '#a86a3a'); circle(ctx, 52.6, 16.9, 0.28, '#a86a3a'); circle(ctx, 52.4, 16.7, 0.1, '#a86a3a'); circle(ctx, 52.8, 16.7, 0.1, '#a86a3a');
    this.object(ctx, r, 'C', { x0: 25, y0: 28, x1: 27, y1: 36 });
    // the hall: a gas chandelier hangs from the ceiling (glow drawn live)
    ctx.strokeStyle = PAL.brassD; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(36, 26); ctx.lineTo(36, 27.3); ctx.stroke();
    // parlour: standard lamp
    ctx.strokeStyle = '#3e2617'; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(20.2, 36); ctx.lineTo(20.2, 31.5); ctx.stroke();
    ctx.fillStyle = '#c99a5a'; ctx.beginPath(); ctx.moveTo(19.5, 31.6); ctx.lineTo(20.9, 31.6); ctx.lineTo(20.6, 30.7); ctx.lineTo(19.8, 30.7); ctx.fill();
    // kitchen: table and chairs
    paint(ctx, 62.6, 33.6, 2.2, 0.2, '#8a5a36', r, { streaks: 1, light: true }); ctx.fillStyle = '#5e3a22'; ctx.fillRect(62.8, 33.8, 0.12, 2.2); ctx.fillRect(64.5, 33.8, 0.12, 2.2);
    // nursery fireplace: a mantel and a dark hearth in the chimney breast
    paint(ctx, 65.2, 21.2, 5.2, 0.35, '#e9dcbc', r, { streaks: 2, light: true });
    ctx.fillStyle = '#16100c'; ctx.beginPath(); ctx.moveTo(66, 25); ctx.lineTo(66, 22.6); ctx.quadraticCurveTo(67.5, 21.7, 69, 22.6); ctx.lineTo(69, 25); ctx.fill();
    ctx.fillStyle = 'rgba(255,140,60,.35)'; ctx.fillRect(66.4, 24.55, 2.2, 0.4);
    // the chimney hood over the range
    paint(ctx, 64.6, 31.8, 6.4, 0.35, '#3a3d44', r, { streaks: 2, light: true });
    // cellar: barrels against the wall
    for (const x of [20, 22.5]) { paint(ctx, x, 44.6, 1.9, 2.4, '#6a4428', r, { streaks: 4, light: true }); ctx.fillStyle = '#2a2018'; ctx.fillRect(x, 45.2, 1.9, 0.12); ctx.fillRect(x, 46.3, 1.9, 0.12); }
    // attic: an old rocking chair and stacked frames
    ctx.strokeStyle = '#3e2617'; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(41, 13.9); ctx.quadraticCurveTo(42.5, 14.3, 44, 13.9); ctx.moveTo(41.6, 14); ctx.lineTo(41.8, 11.5); ctx.moveTo(43.4, 14); ctx.lineTo(43.2, 12.6); ctx.moveTo(41.6, 12.7); ctx.lineTo(43.4, 12.7); ctx.stroke();
    for (let i = 0; i < 3; i++) paint(ctx, 31 + i * 0.25, 11 + i * 0.3, 1.6, 2.6 - i * 0.3, PAL.brassD, r, { streaks: 1 });
  }
  notes(ctx, r) {
    for (const n of L.NOTES) {
      const x = n.x + 0.5, y = n.y + 0.25;
      ctx.save(); ctx.translate(x, y); ctx.rotate((r() - 0.5) * 0.3);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-0.32, -0.18, 0.7, 0.48);
      ctx.fillStyle = '#efe3c2'; ctx.beginPath(); ctx.moveTo(-0.35, -0.22); ctx.lineTo(0.3, -0.22); ctx.lineTo(0.38, -0.02); ctx.lineTo(0.3, 0.22); ctx.lineTo(-0.35, 0.22); ctx.fill();
      ctx.fillStyle = '#8a7a5a'; for (let i = 0; i < 3; i++) ctx.fillRect(-0.25, -0.1 + i * 0.1, 0.45 - i * 0.1, 0.03);
      circle(ctx, -0.25, -0.15, 0.05, '#b8392e');
      ctx.restore();
    }
  }
  grain(ctx, B, c) {
    // paper grain over everything, multiplied in
    const g = document.createElement('canvas'); g.width = g.height = 128; const x = g.getContext('2d');
    const id = x.createImageData(128, 128); const r = rng(5);
    for (let i = 0; i < id.data.length; i += 4) { const v = 200 + r() * 55; id.data[i] = v; id.data[i + 1] = v * 0.98; id.data[i + 2] = v * 0.93; id.data[i + 3] = 255; }
    x.putImageData(id, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.22; ctx.fillStyle = ctx.createPattern(g, 'repeat'); ctx.fillRect(0, 0, c.width, c.height); ctx.restore();
  }

  // ============== LIVE
  frame(ctx, game, cam, t, opts = {}) {
    this.t = t;
    const { s, x0, y0, vw, vh, dpr } = cam;
    // the baked house
    const B = this.B;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAL.sky0; ctx.fillRect(0, 0, vw * dpr, vh * dpr);
    const below = (L.H - y0) * s * dpr; if (below < vh * dpr) { ctx.fillStyle = PAL.earth; ctx.fillRect(0, Math.max(0, below), vw * dpr, vh * dpr); }
    const g0 = (36 - y0) * s * dpr; if ((L.W - x0) * s < vw) { ctx.fillStyle = PAL.earth; ctx.fillRect((L.W - x0) * s * dpr, g0, vw * dpr, vh * dpr); }
    const sx = x0 * B, sy = y0 * B, sw = (vw / s) * B, sh = (vh / s) * B;
    // clip source to the bake and map back
    const cx0 = Math.max(0, sx), cy0 = Math.max(0, sy), cx1 = Math.min(this.bake.width, sx + sw), cy1 = Math.min(this.bake.height, sy + sh);
    if (cx1 > cx0 && cy1 > cy0) ctx.drawImage(this.bake, cx0, cy0, cx1 - cx0, cy1 - cy0, (cx0 - sx) / B * s * dpr, (cy0 - sy) / B * s * dpr, (cx1 - cx0) / B * s * dpr, (cy1 - cy0) / B * s * dpr);
    ctx.setTransform(s * dpr, 0, 0, s * dpr, -x0 * s * dpr, -y0 * s * dpr);
    // below the world: more earth
    if (y0 + vh / s > L.H) { ctx.fillStyle = PAL.earth; ctx.fillRect(x0 - 1, L.H, vw / s + 2, vh / s); }
    const view = [x0 - 2, y0 - 2, x0 + vw / s + 2, y0 + vh / s + 2];
    const inView = (x, y, m = 2) => x > view[0] - m && x < view[2] + m && y > view[1] - m && y < view[3] + m;
    this.live(ctx, game, t, inView);
    this.lights(ctx, game, t, opts.overview);
    if (!opts.overview) {
      this.items(ctx, game, t, inView);
      this.toys(ctx, game, t, inView);
      this.enemies(ctx, game, t, inView);
      if (game.boss) this.drawBoss(ctx, game, game.boss, t);
      this.soldier(ctx, game, t);
      this.particles(ctx, game, t);
    } else {
      this.items(ctx, game, t, inView, true);
      this.toys(ctx, game, t, inView);
      if (game.boss) this.drawBoss(ctx, game, game.boss, t);
      this.soldier(ctx, game, t);
    }
  }
  live(ctx, game, t, inView) {
    const map = game.map;
    // doors and blocks change, so they are drawn live
    for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
      const c = map[y][x];
      if (c !== 'D' && c !== 'B') continue;
      if (!inView(x, y)) continue;
      if (c === 'B') this.block(ctx, x, y);
      else this.door(ctx, x, y, map);
    }
    // open doors swung back
    for (const [f, x, y0, y1] of [['nurseryDoor', 48, 22, 24], ['parlourDoor', 22, 30, 35], ['backDoor', 72, 33, 35]]) {
      if (map[y0][x] !== 'D' && inView(x, y0)) { ctx.fillStyle = '#5a3620'; ctx.beginPath(); ctx.moveTo(x + 0.1, y0); ctx.lineTo(x + 0.6, y0 + 0.3); ctx.lineTo(x + 0.6, y1 + 0.8); ctx.lineTo(x + 0.1, y1 + 1); ctx.fill(); ctx.fillStyle = '#3a2210'; ctx.fillRect(x + 0.05, y0, 0.08, y1 - y0 + 1); }
    }
    // pendulum
    if (inView(25.5, 31)) { const a = Math.sin(t * Math.PI) * 0.28; ctx.save(); ctx.translate(26, 30.6); ctx.rotate(a); ctx.strokeStyle = PAL.brassD; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 3); ctx.stroke(); circle(ctx, 0, 3.1, 0.3, PAL.brass, PAL.brassD); ctx.restore(); }
    // fire in the range and the boiler
    if (inView(67, 34)) for (const dx of [0.6, 3.4]) { const f = 0.6 + Math.sin(t * 9 + dx) * 0.15 + Math.sin(t * 23) * 0.1; ctx.fillStyle = `rgba(255,${140 + Math.floor(f * 60)},50,${0.5 + f * 0.3})`; ctx.fillRect(65 + dx + 0.15, 34.75, 1.5, 0.4); }
    // warm air up the chimney
    if (inView(68, 20, 20)) {
      for (let i = 0; i < 26; i++) {
        const y = 34 - ((t * 5 + i * 1.37) % 32), x = 67.3 + Math.sin(t * 2 + i) * 0.4 + (i % 3) * 0.5;
        if (!inView(x, y)) continue;
        ctx.strokeStyle = `rgba(255,220,170,${0.12 + (i % 4) * 0.03})`; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 0.3, y - 0.4, x, y - 0.8); ctx.stroke();
      }
    }
    // winding stands
    for (const st of L.STANDS) {
      if (!inView(st.x, st.y)) continue;
      const x = st.x + 0.5, y = st.y + 1, on = game.bench === st.id;
      paint(ctx, x - 0.45, y - 0.18, 0.9, 0.18, '#4e3220', rng(st.x), { streaks: 1 });
      ctx.strokeStyle = PAL.brassD; ctx.lineWidth = 0.09; ctx.beginPath(); ctx.moveTo(x, y - 0.18); ctx.lineTo(x, y - 1.05); ctx.stroke();
      ctx.save(); ctx.translate(x, y - 1.25); ctx.rotate(on ? t * 1.2 : 0);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = on ? PAL.brassL : PAL.brass; ctx.save(); ctx.rotate(i * Math.PI / 4); ctx.fillRect(-0.06, -0.33, 0.12, 0.12); ctx.restore(); }
      circle(ctx, 0, 0, 0.26, on ? PAL.brassL : PAL.brass, PAL.brassD, 0.04); circle(ctx, 0, 0, 0.08, PAL.brassD);
      ctx.restore();
      if (on) { const g = ctx.createRadialGradient(x, y - 1.2, 0, x, y - 1.2, 1.4); g.addColorStop(0, 'rgba(255,220,140,.35)'); g.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = g; ctx.fillRect(x - 1.5, y - 2.7, 3, 3); }
    }
    // a lamp on the parlour door's lintel shows how many toys have come
    if (inView(23, 30)) {
      const n = game.doorToys.length;
      for (let i = 0; i < 4; i++) circle(ctx, 23.4 + i * 0.5, 29.4, 0.14, i < n ? '#ffd27a' : '#5a4a3a', '#2a1b14', 0.03);
    }
  }
  block(ctx, x, y) {
    const cols = ['#c0533f', '#3f7bb0', '#d9a33f', '#4f8f5a', '#a8579a'];
    const c = cols[(x * 7 + y * 3) % 5];
    ctx.fillStyle = c; ctx.fillRect(x + 0.03, y + 0.03, 0.94, 0.94);
    ctx.fillStyle = shade(c, 0.25); ctx.fillRect(x + 0.03, y + 0.03, 0.94, 0.12);
    ctx.strokeStyle = shade(c, -0.4); ctx.lineWidth = 0.05; ctx.strokeRect(x + 0.05, y + 0.05, 0.9, 0.9);
    ctx.fillStyle = '#f3ead6'; ctx.font = 'bold 0.6px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ABCDEFGHJKLMNPRSTW'[(x * 5 + y * 11) % 18], x + 0.5, y + 0.55);
  }
  door(ctx, x, y, map) {
    const top = map[y - 1]?.[x] !== 'D', bot = map[y + 1]?.[x] !== 'D';
    ctx.fillStyle = '#6b3f22'; ctx.fillRect(x - 0.05, y, 1.1, 1.01);
    ctx.fillStyle = '#5a3319'; ctx.fillRect(x + 0.12, y + (top ? 0.2 : 0), 0.76, bot ? 0.7 : 1);
    ctx.fillStyle = '#7d4d2b'; ctx.fillRect(x - 0.05, y, 0.08, 1.01);
    if (bot) { circle(ctx, x + 0.75, y - 0.4, 0.09, PAL.brass, PAL.brassD, 0.02); }
    if (top) { ctx.fillStyle = '#3a2210'; ctx.fillRect(x - 0.1, y, 1.2, 0.12); }
  }
  lights(ctx, game, t, overview) {
    // unvisited rooms are dark; the lamp comes on the first time you walk in
    for (const room of L.ROOMS) {
      if (room.outdoor) continue;
      const lit = game.visited.has(room.id);
      if (!lit) { ctx.fillStyle = overview ? 'rgba(8,8,20,.86)' : 'rgba(8,8,20,.72)'; ctx.fill(this.roomPaths[room.id]); continue; }
      const [lx, ly] = room.lamp;
      const f = 1 + Math.sin(t * 7 + lx) * 0.03 + Math.sin(t * 17 + ly) * 0.02;
      ctx.save(); ctx.clip(this.roomPaths[room.id]);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(lx, ly, 0.2, lx, ly, 13 * f);
      g.addColorStop(0, 'rgba(255,190,110,.22)'); g.addColorStop(0.5, 'rgba(255,170,90,.07)'); g.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = g; ctx.fillRect(lx - 14, ly - 14, 28, 28);
      ctx.restore();
      // the gas jet itself
      ctx.strokeStyle = PAL.brassD; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(lx, ly + 0.6); ctx.lineTo(lx, ly + 0.15); ctx.stroke();
      ell(ctx, lx, ly - 0.05 + Math.sin(t * 11 + lx) * 0.02, 0.12 * f, 0.22 * f, 0, '#ffe2a0');
      ell(ctx, lx, ly + 0.02, 0.06, 0.1, 0, '#fff6d8');
      ctx.fillStyle = 'rgba(255,245,220,.35)'; ctx.beginPath(); ctx.moveTo(lx - 0.3, ly + 0.25); ctx.lineTo(lx + 0.3, ly + 0.25); ctx.lineTo(lx + 0.22, ly - 0.45); ctx.lineTo(lx - 0.22, ly - 0.45); ctx.fill();
    }
    // the moon lights the garden a little
    const g = ctx.createRadialGradient(87, 8, 1, 87, 8, 30); g.addColorStop(0, 'rgba(180,190,255,.08)'); g.addColorStop(1, 'rgba(180,190,255,0)');
    ctx.fillStyle = g; ctx.fillRect(72, 0, 24, 40);
  }
  items(ctx, game, t, inView, big) {
    const bob = (k) => Math.sin(t * 2.2 + k) * 0.08;
    for (const it of L.ITEMS) {
      if (game.has.has(it.id) || (it.boss && !game.flags[it.boss])) continue;
      if (!inView(it.x, it.y)) continue;
      const x = it.x + 0.5, y = it.y + 0.5 + bob(it.x);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 1.3); g.addColorStop(0, 'rgba(255,230,150,.45)'); g.addColorStop(1, 'rgba(255,230,150,0)'); ctx.fillStyle = g; ctx.fillRect(x - 1.4, y - 1.4, 2.8, 2.8);
      ctx.save(); ctx.translate(x, y); if (big) ctx.scale(1.6, 1.6); drawItem(ctx, it.id, t); ctx.restore();
    }
    for (const m of L.MEDALS) {
      if (game.medals.has(m.id) || !inView(m.x, m.y)) continue;
      ctx.save(); ctx.translate(m.x + 0.5, m.y + 0.5 + bob(m.x)); if (big) ctx.scale(1.8, 1.8); medal(ctx, t + m.x); ctx.restore();
    }
    for (const s of L.SPRINGS) {
      if (game.springs.has(s.id) || !inView(s.x, s.y)) continue;
      ctx.save(); ctx.translate(s.x + 0.5, s.y + 0.6 + bob(s.y)); if (big) ctx.scale(1.8, 1.8); spring(ctx, t); ctx.restore();
    }
  }
  toys(ctx, game, t, inView) {
    for (const toy of L.TOYS) {
      if (game.awake.has(toy.id)) continue;
      if (toy.id === 'blocks') { if (inView(toy.x, toy.y)) zzz(ctx, toy.x + 1.5, toy.y - 0.2, t); continue; }
      if (!inView(toy.x, toy.y)) continue;
      ctx.save(); ctx.translate(toy.x + 0.5, toy.y + 1); drawToy(ctx, toy.id, t, true); ctx.restore();
      zzz(ctx, toy.x + 0.9, toy.y - 0.6, t);
    }
    // toys walking off, and the ones waiting at the parlour door
    for (const a of game.parade) {
      const k = Math.min(1, a.t / 2.4);
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(a.x, a.y - Math.sin(k * Math.PI) * 0.6); drawToy(ctx, a.id, t, false); ctx.restore();
    }
    game.doorToys.forEach((id, i) => {
      if (game.flags.vacuum) { // a party in the parlour
        const x = [6, 9.5, 12.5, 14.5][i] ?? 10, y = [33, 36, 36, 36][i] ?? 36;
        if (!inView(x, y)) return;
        ctx.save(); ctx.translate(x, y - Math.abs(Math.sin(t * 5 + i)) * 0.25); ctx.scale(i % 2 ? -0.9 : 0.9, 0.9); drawToy(ctx, id, t + i, false); ctx.restore();
        return;
      }
      const x = 23.6 + i * 1.15, y = 36;
      if (!inView(x, y)) return;
      ctx.save(); ctx.translate(x, y); ctx.scale(-0.8, 0.8); drawToy(ctx, id, t + i, false); ctx.restore();
    });
  }
  enemies(ctx, game, t, inView) {
    for (const e of game.enemies) {
      if (e.dead || !inView(e.x, e.y)) continue;
      ctx.save(); ctx.translate(e.x, e.y);
      if (e.flash > 0) ctx.filter = 'brightness(2.2)';
      if (e.k === 'moth') moth(ctx, t + e.id, e.dir);
      else if (e.k === 'bunny') bunny(ctx, t + e.id, e.dir);
      else if (e.k === 'mouse') mouse(ctx, t + e.id, e.dir);
      else if (e.k === 'spider') { ctx.strokeStyle = 'rgba(230,230,230,.5)'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(0, -e.len); ctx.lineTo(0, -0.2); ctx.stroke(); spider(ctx, t + e.id); }
      ctx.restore();
    }
  }
  soldier(ctx, game, t) {
    const p = game.p;
    if (p.fade > 0) ctx.globalAlpha = Math.max(0, p.fade / 0.55);
    if (p.inv > 0 && !p.dead && Math.floor(t * 18) % 2 === 0) ctx.globalAlpha *= 0.45;
    ctx.save();
    ctx.translate(p.x, p.y + p.stepVis);
    const sc = p.small ? SMALL_SC : 1;
    ctx.scale(p.face * sc, sc);
    if (p.dead) { const k = Math.min(1, p.dead / 0.6); ctx.rotate(-k * Math.PI / 2); ctx.translate(0, 0); }
    const sq = p.land * 0.12;
    ctx.scale(1 + sq, 1 - sq);
    drawSoldier(ctx, p, t, game);
    ctx.restore();
    ctx.globalAlpha = 1;
    // jab trail
    if (p.jabT > 0.06) {
      const k = (0.24 - p.jabT) / 0.18, jb = game.jabBox();
      ctx.strokeStyle = `rgba(255,248,220,${0.6 * (1 - k)})`; ctx.lineWidth = 0.08 * (p.small ? 0.5 : 1);
      ctx.beginPath(); ctx.moveTo(p.face > 0 ? jb[0] : jb[2], (jb[1] + jb[3]) / 2); ctx.lineTo(p.face > 0 ? jb[2] : jb[0], (jb[1] + jb[3]) / 2 - 0.05); ctx.stroke();
    }
  }
  particles(ctx, game, t) {
    for (const q of game.parts) {
      const k = q.t / q.life;
      ctx.globalAlpha = 1 - k;
      if (q.k === 'spark') circle(ctx, q.x, q.y, 0.06 * (1 - k * 0.5), q.red ? '#ff7a5a' : q.gold ? '#ffe08a' : '#fff4d0');
      else if (q.k === 'fluff') circle(ctx, q.x, q.y, 0.09, q.k2 === 'moth' ? '#a89a82' : '#9a9aa2');
      else if (q.k === 'puff' || q.k === 'dust') circle(ctx, q.x, q.y, 0.12 + k * 0.25, 'rgba(220,210,190,.5)');
      else if (q.k === 'confetti') { ctx.fillStyle = ['#c0533f', '#3f7bb0', '#d9a33f', '#4f8f5a'][Math.floor(q.r * 4)]; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.t * 8 + q.r * 6); ctx.fillRect(-0.08, -0.04, 0.16, 0.08); ctx.restore(); }
      else if (q.k === 'note') note(ctx, q.x, q.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- bosses
  drawBoss(ctx, game, b, t) {
    if (b.kind === 'jack') this.jack(ctx, b, t, game);
    else if (b.kind === 'cat') this.cat(ctx, b, t, game);
    else if (b.kind === 'vacuum') this.vacuum(ctx, b, t, game);
  }
  jack(ctx, b, t) {
    const x = b.x, y = b.y;
    // shockwaves
    for (const w of b.waves) { ctx.fillStyle = '#e9dcbc'; ctx.beginPath(); ctx.moveTo(w.x - 0.4, 25); ctx.lineTo(w.x, 24.35 - Math.sin(w.t * 20) * 0.08); ctx.lineTo(w.x + 0.4, 25); ctx.fill(); }
    // aim line
    if (b.state === 'aim') { ctx.setLineDash([0.18, 0.18]); ctx.strokeStyle = `rgba(220,60,40,${Math.min(0.8, b.t * 1.6)})`; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(b.hx, b.hy); ctx.lineTo(b.tx, b.ty); ctx.stroke(); ctx.setLineDash([]); circle(ctx, b.tx, b.ty, 0.3, null, 'rgba(220,60,40,.6)', 0.05); }
    // spring
    if (b.state !== 'closed' && b.state !== 'intro' && b.state !== 'hop') {
      const bx = x, by = y - 1.5, dx = b.hx - bx, dy = b.hy - by, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      ctx.strokeStyle = '#c8ccd2'; ctx.lineWidth = 0.09; ctx.beginPath(); ctx.moveTo(bx, by);
      const coils = 9; for (let i = 1; i <= coils * 2; i++) { const k = i / (coils * 2), s = (i % 2 ? 1 : -1) * 0.3; ctx.lineTo(bx + dx * k + nx * s, by + dy * k + ny * s); }
      ctx.stroke();
    }
    // box
    ctx.save(); ctx.translate(x, y);
    if (b.state === 'closed' || b.state === 'intro') ctx.rotate(Math.sin(t * 30) * 0.03);
    const fl = b.flash > 0;
    paint(ctx, -0.95, -1.5, 1.9, 1.5, fl ? '#ff8a6a' : '#b8392e', rng(3), { streaks: 4, light: true });
    paint(ctx, -0.7, -1.25, 1.4, 1.0, '#e0a83a', rng(4), { streaks: 2 });
    ctx.fillStyle = '#2f4d7a'; ctx.font = 'bold 0.8px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('J', 0, -0.72);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(0.95, -0.8); ctx.lineTo(1.25, -0.8); ctx.lineTo(1.25 + Math.cos(t * 6) * 0.3, -0.8 + Math.sin(t * 6) * 0.3); ctx.stroke();
    // lid
    ctx.save(); ctx.translate(-0.95, -1.5); ctx.rotate(-b.lid * 2.1); paint(ctx, 0, -0.18, 1.9, 0.2, '#8e2a22', rng(5), { streaks: 1 }); ctx.restore();
    ctx.restore();
    // head
    if (b.state !== 'closed' && b.state !== 'intro' && b.state !== 'hop') {
      ctx.save(); ctx.translate(b.hx, b.hy); if (b.state === 'dying') ctx.rotate(Math.sin(b.t * 3) * 0.5);
      // ruff
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ell(ctx, Math.cos(a) * 0.55, 0.45 + Math.sin(a) * 0.15, 0.25, 0.14, a, i % 2 ? '#f3ead6' : '#e0d2b0'); }
      circle(ctx, 0, 0, 0.62, fl ? '#fff' : '#f5e6d8', PAL.ink, 0.04);
      ctx.fillStyle = '#3f7bb0'; ctx.beginPath(); ctx.moveTo(-0.5, -0.35); ctx.lineTo(0.15, -1.55); ctx.lineTo(0.55, -0.3); ctx.fill(); circle(ctx, 0.15, -1.55, 0.15, '#d9a33f');
      const lx = Math.sign(b.tx - b.hx || 1) * 0.06;
      circle(ctx, -0.22 + lx, -0.08, 0.09, PAL.ink); circle(ctx, 0.22 + lx, -0.08, 0.09, PAL.ink);
      if (b.state === 'stuck' || b.state === 'dying') { ctx.strokeStyle = PAL.ink; ctx.lineWidth = 0.04; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.22 - 0.08, -0.16); ctx.lineTo(s * 0.22 + 0.08, 0); ctx.moveTo(s * 0.22 + 0.08, -0.16); ctx.lineTo(s * 0.22 - 0.08, 0); ctx.stroke(); } }
      circle(ctx, 0, 0.1, 0.13, '#c0392b');
      ctx.strokeStyle = '#a8301f'; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.arc(0, 0.18, 0.26, 0.2, Math.PI - 0.2); ctx.stroke();
      ell(ctx, -0.4, 0.12, 0.1, 0.07, 0, 'rgba(220,80,80,.5)'); ell(ctx, 0.4, 0.12, 0.1, 0.07, 0, 'rgba(220,80,80,.5)');
      ctx.restore();
    }
  }
  cat(ctx, b, t, game) {
    const pk = b.peek;
    // head over the garden wall
    const hx = 90.5, hy = 28 - pk * 4 + (b.state === 'dying' ? b.t * 3 : 0);
    ctx.save(); ctx.translate(hx, hy);
    const fur = b.flash > 0 ? '#6a5a5a' : '#2a2522';
    ctx.fillStyle = fur; ctx.beginPath(); ctx.moveTo(-3.2, -1.2); ctx.lineTo(-2.6, -4.2); ctx.lineTo(-1.0, -2.6); ctx.lineTo(1.0, -2.6); ctx.lineTo(2.6, -4.2); ctx.lineTo(3.2, -1.2); ctx.quadraticCurveTo(3.6, 2.4, 0, 2.8); ctx.quadraticCurveTo(-3.6, 2.4, -3.2, -1.2); ctx.fill();
    ctx.fillStyle = '#4a3a3a'; ctx.beginPath(); ctx.moveTo(-2.5, -2.4); ctx.lineTo(-2.35, -3.6); ctx.lineTo(-1.5, -2.6); ctx.fill(); ctx.beginPath(); ctx.moveTo(2.5, -2.4); ctx.lineTo(2.35, -3.6); ctx.lineTo(1.5, -2.6); ctx.fill();
    const look = clamp((b.eye - hx) / 12, -0.3, 0.3);
    for (const s of [-1, 1]) {
      ell(ctx, s * 1.3, -0.4, 0.75, 0.6, 0, '#e8c84a');
      ell(ctx, s * 1.3 + look, -0.4, 0.14 + (b.state === 'dying' ? 0.3 : 0), 0.5, 0, '#120c08');
      circle(ctx, s * 1.3 + 0.25, -0.65, 0.1, 'rgba(255,255,255,.7)');
    }
    ell(ctx, 0, 0.8, 0.35, 0.22, 0, '#c97b8e');
    ctx.strokeStyle = 'rgba(230,220,200,.6)'; ctx.lineWidth = 0.05;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(s * 0.8, 1.0 + i * 0.15); ctx.lineTo(s * 3.3, 0.6 + i * 0.4); ctx.stroke(); }
    ctx.restore();
    // paws over the wall: an arm reaching
    for (const w of b.paws) {
      if (w.s === 'aim') {
        const k = Math.min(1, w.t / Math.max(0.1, w.lockAt + 0.4));
        ell(ctx, w.x, 35.9, 0.5 + k * 0.9, 0.12 + k * 0.1, 0, `rgba(10,5,5,${0.2 + k * 0.35})`);
        if (w.t > w.lockAt) ell(ctx, w.x, 35.9, 1.4, 0.24, 0, 'rgba(200,40,30,.25)');
        continue;
      }
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.moveTo(93, 15); ctx.quadraticCurveTo((w.x + 93) / 2, w.y - 6, w.x - 0.9, w.y - 1); ctx.lineTo(w.x + 0.9, w.y - 1); ctx.quadraticCurveTo((w.x + 94) / 2, w.y - 5, 95, 17); ctx.fill();
      ctx.save(); ctx.translate(w.x, w.y);
      ell(ctx, 0, -0.65, 1.15, 0.7, 0, fur);
      for (let i = 0; i < 4; i++) ell(ctx, -0.75 + i * 0.5, -0.12, 0.2, 0.14, 0, '#c97b8e');
      if (w.s === 'down') { ctx.strokeStyle = '#efe5c8'; ctx.lineWidth = 0.05; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-0.75 + i * 0.5, 0); ctx.lineTo(-0.7 + i * 0.5, 0.12); ctx.stroke(); } }
      ctx.restore();
    }
    if (b.tail) {
      const x = b.tail.x;
      ctx.strokeStyle = fur; ctx.lineWidth = 0.55; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + 4.6, 35.3); for (let i = 0; i <= 14; i++) { const k = i / 14; ctx.lineTo(x + 4.6 - k * 4.6, 35.6 + Math.sin(t * 14 + k * 6) * 0.1); } ctx.stroke(); ctx.lineCap = 'butt';
    }
  }
  vacuum(ctx, b, t, game) {
    if (b.state === 'gone') return;
    const x = b.x, y = b.y, d = b.dir;
    // suction streaks in front
    if (b.state === 'roam' || b.state === 'charge') for (let i = 0; i < 9; i++) {
      const k = ((t * 2.4 + i / 9) % 1), sx = x + d * (1.2 + (1 - k) * 7), sy = y - 0.3 - (i % 3) * 0.55;
      ctx.strokeStyle = `rgba(230,225,210,${0.35 * k})`; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - d * 0.6, sy + 0.05); ctx.stroke();
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(d, 1);
    const shake = b.state === 'rev' ? Math.sin(t * 70) * 0.05 : 0;
    ctx.translate(shake, 0);
    // nozzle + wheels
    paint(ctx, -0.6, -0.55, 1.9, 0.55, '#3a3a40', rng(9), { streaks: 2, light: true });
    ctx.fillStyle = '#c9a24c'; ctx.fillRect(0.9, -0.12, 0.45, 0.12);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#8a6a3a'; ctx.fillRect(0.95 + i * 0.07, -0.05, 0.03, 0.08); }
    circle(ctx, -0.45, -0.2, 0.22, '#1a1a1e', '#555', 0.05);
    // motor housing
    paint(ctx, -0.85, -1.4, 1.5, 0.95, b.flash > 0 ? '#e0a090' : '#7a2a26', rng(10), { streaks: 4, light: true });
    ctx.fillStyle = PAL.brass; ctx.fillRect(-0.85, -1.1, 1.5, 0.08); circle(ctx, 0.2, -0.95, 0.15, PAL.brassL, PAL.brassD, 0.03);
    // the bag (where you hit it): puffs as it breathes
    const puff = 1 + Math.sin(t * (b.state === 'charge' ? 18 : 6)) * 0.05;
    ctx.save(); ctx.translate(-0.2, -2.0); ctx.scale(puff, 1);
    ell(ctx, 0, 0, 0.8, 0.75, 0, b.flash > 0 ? '#fff0d8' : '#cfc2a0');
    ctx.strokeStyle = '#a89a78'; ctx.lineWidth = 0.05; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 0.35, -0.7); ctx.lineTo(i * 0.35, 0.7); ctx.stroke(); }
    ctx.restore();
    // handle
    ctx.strokeStyle = '#3e2617'; ctx.lineWidth = 0.12; ctx.beginPath(); ctx.moveTo(-0.6, -1.4); ctx.lineTo(-1.2, -3.6); ctx.stroke();
    ctx.strokeStyle = '#1a1a1e'; ctx.lineWidth = 0.2; ctx.beginPath(); ctx.moveTo(-1.45, -3.65); ctx.lineTo(-0.95, -3.6); ctx.stroke();
    // eyes, because it is a villain
    const mad = b.state === 'rev' || b.state === 'charge';
    circle(ctx, 0.35, -1.25, 0.13, mad ? '#ffcf5a' : '#e8dcb8'); circle(ctx, 0.4, -1.25, 0.06, '#120c08');
    if (b.state === 'stun') { for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.1; star(ctx, Math.cos(a) * 0.8 - 0.2, -3.1 + Math.sin(a) * 0.25, 0.14, '#ffe08a'); } }
    ctx.restore();
    // cord
    ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(x - d * 0.6, y - 1.2); ctx.bezierCurveTo(x - d * 2, y - 0.2, 3, y - 0.1, 1.2, y - 0.4); ctx.stroke();
  }
}

export const SMALL_SC = 0.47;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function star(ctx, cx, cy, r, c) { ctx.fillStyle = c; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.fill(); }
function note(ctx, x, y) { ctx.fillStyle = '#ffe9a8'; ell(ctx, x, y, 0.1, 0.075, -0.4, '#ffe9a8'); ctx.fillRect(x + 0.07, y - 0.4, 0.035, 0.4); ctx.fillRect(x + 0.07, y - 0.4, 0.15, 0.05); }
function zzz(ctx, x, y, t) {
  ctx.fillStyle = 'rgba(240,230,210,.75)'; ctx.font = 'italic 0.42px Georgia, serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < 3; i++) { const k = ((t * 0.5 + i / 3) % 1); ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8; ctx.font = `italic ${0.3 + k * 0.25}px Georgia, serif`; ctx.fillText('z', x + k * 0.5, y - k * 0.9); }
  ctx.globalAlpha = 1;
}
export function medal(ctx, t) {
  const tw = Math.abs(Math.cos(t * 1.6));
  ctx.fillStyle = '#b8392e'; ctx.beginPath(); ctx.moveTo(-0.16, -0.42); ctx.lineTo(0.16, -0.42); ctx.lineTo(0.08, -0.08); ctx.lineTo(-0.08, -0.08); ctx.fill();
  ctx.fillStyle = '#2f4d7a'; ctx.fillRect(-0.04, -0.42, 0.08, 0.34);
  ctx.save(); ctx.scale(0.3 + tw * 0.7, 1);
  star(ctx, 0, 0.1, 0.27, '#c9cfd8'); star(ctx, 0, 0.1, 0.17, '#e8ecf2');
  ctx.restore();
}
export function spring(ctx, t) {
  ctx.strokeStyle = '#d8b25a'; ctx.lineWidth = 0.06;
  ctx.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 8, y = -i / 24 * 0.7 + Math.sin(t * 3) * 0.02; ctx.lineTo(Math.cos(a) * 0.22, y + Math.sin(a) * 0.06); } ctx.stroke();
  const g = ctx.createRadialGradient(0, -0.35, 0, 0, -0.35, 0.7); g.addColorStop(0, 'rgba(255,220,140,.4)'); g.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = g; ctx.fillRect(-0.7, -1, 1.4, 1.4);
}
export function drawItem(ctx, id, t) {
  if (id === 'key') {
    ctx.rotate(Math.sin(t * 1.5) * 0.3);
    ctx.strokeStyle = PAL.brass; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.ellipse(-0.18, 0, 0.16, 0.22, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0.18, 0, 0.16, 0.22, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = PAL.brass; ctx.fillRect(-0.05, 0.15, 0.1, 0.4); ctx.fillRect(-0.12, 0.45, 0.24, 0.08);
  } else if (id === 'umbrella') {
    ctx.rotate(-0.3);
    ctx.fillStyle = '#d9707a'; ctx.beginPath(); ctx.moveTo(-0.5, 0); ctx.quadraticCurveTo(0, -0.6, 0.5, 0); ctx.fill();
    ctx.strokeStyle = '#f3ead6'; ctx.lineWidth = 0.03; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(0, -0.3); ctx.lineTo(i * 0.22, 0); ctx.stroke(); }
    ctx.strokeStyle = '#6b4227'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(0, -0.3); ctx.lineTo(0, 0.5); ctx.stroke();
  } else if (id === 'boots') {
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 0.2, 0); ctx.strokeStyle = '#b8392e'; ctx.lineWidth = 0.12; ctx.beginPath(); ctx.arc(0, -0.05, 0.16, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#c8ccd2'; ctx.fillRect(-0.22, -0.05, 0.12, 0.12); ctx.fillRect(0.1, -0.05, 0.12, 0.12); ctx.restore(); }
    ctx.fillStyle = '#1a1210'; ctx.fillRect(-0.4, 0.15, 0.8, 0.2);
  } else if (id === 'thimble') {
    ctx.fillStyle = '#c8ccd2'; ctx.beginPath(); ctx.moveTo(-0.22, 0.3); ctx.lineTo(-0.17, -0.2); ctx.quadraticCurveTo(0, -0.38, 0.17, -0.2); ctx.lineTo(0.22, 0.3); ctx.fill();
    ctx.fillStyle = '#8a9099'; for (let i = 0; i < 9; i++) circle(ctx, -0.12 + (i % 3) * 0.12, -0.12 + Math.floor(i / 3) * 0.12, 0.025, '#8a9099');
    ctx.fillStyle = PAL.brass; ctx.fillRect(-0.24, 0.24, 0.48, 0.08);
  } else if (id === 'musicbox') {
    paint(ctx, -0.4, -0.2, 0.8, 0.5, '#7a3a2a', rng(2), { streaks: 2, light: true }); ctx.fillStyle = PAL.brass; ctx.fillRect(-0.4, -0.05, 0.8, 0.06);
    ctx.strokeStyle = PAL.brass; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(0.4, 0.05); ctx.lineTo(0.55, 0.05); ctx.lineTo(0.55 + Math.cos(t * 4) * 0.12, 0.05 + Math.sin(t * 4) * 0.12); ctx.stroke();
    note(ctx, 0.15, -0.35 - Math.sin(t * 3) * 0.1);
  }
}
function drawToy(ctx, id, t, asleep) {
  const bob = asleep ? 0 : Math.abs(Math.sin(t * 6)) * 0.1;
  ctx.translate(0, -bob);
  if (id === 'horse') {
    ctx.rotate(asleep ? 0 : Math.sin(t * 3) * 0.12);
    ctx.strokeStyle = '#6b4227'; ctx.lineWidth = 0.12; ctx.beginPath(); ctx.moveTo(-0.9, -0.05); ctx.quadraticCurveTo(0, 0.25, 0.9, -0.05); ctx.stroke();
    ctx.strokeStyle = '#4e3220'; ctx.lineWidth = 0.08; for (const x of [-0.5, 0.5]) { ctx.beginPath(); ctx.moveTo(x, 0.05); ctx.lineTo(x * 0.7, -0.5); ctx.stroke(); }
    ell(ctx, 0, -0.65, 0.65, 0.25, 0, '#efe3c2'); ell(ctx, 0.55, -1.0, 0.18, 0.35, 0.4, '#efe3c2'); ell(ctx, 0.72, -1.2, 0.24, 0.13, 0.2, '#efe3c2');
    for (let i = 0; i < 5; i++) circle(ctx, -0.3 + i * 0.12, -0.75 + Math.sin(i) * 0.05, 0.05, '#7a4a3a');
    ctx.fillStyle = '#b8392e'; ctx.fillRect(-0.15, -0.95, 0.35, 0.12);
    ctx.strokeStyle = '#4e3220'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(0.42, -1.15); ctx.lineTo(0.25, -0.75); ctx.stroke();
    if (asleep) { ctx.strokeStyle = PAL.ink; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.arc(0.78, -1.24, 0.05, 0, Math.PI); ctx.stroke(); } else circle(ctx, 0.78, -1.24, 0.035, PAL.ink);
  } else if (id === 'train') {
    paint(ctx, -0.8, -0.75, 1.0, 0.55, '#2f6a4a', rng(11), { streaks: 2, light: true }); paint(ctx, 0.2, -0.9, 0.55, 0.7, '#b8392e', rng(12), { streaks: 2 });
    ctx.fillStyle = '#1a1a1e'; ctx.fillRect(-0.55, -1.15, 0.2, 0.4); ctx.fillStyle = PAL.brass; ctx.fillRect(-0.6, -1.2, 0.3, 0.07);
    for (const x of [-0.55, -0.15, 0.4]) { ctx.save(); ctx.translate(x, -0.15); ctx.rotate(asleep ? 0 : t * 8); circle(ctx, 0, 0, 0.15, '#c9a24c', '#4e3220', 0.03); ctx.fillStyle = '#4e3220'; ctx.fillRect(-0.12, -0.015, 0.24, 0.03); ctx.restore(); }
    if (!asleep) for (let i = 0; i < 3; i++) circle(ctx, -0.45 - i * 0.25, -1.4 - i * 0.2 - ((t * 2) % 0.3), 0.12 + i * 0.04, 'rgba(230,225,215,.5)');
  } else if (id === 'drummer') {
    ctx.fillStyle = '#1a1210'; ctx.fillRect(-0.15, -0.5, 0.12, 0.5); ctx.fillRect(0.05, -0.5, 0.12, 0.5);
    paint(ctx, -0.25, -1.05, 0.5, 0.6, '#3f7bb0', rng(13), { streaks: 1 });
    circle(ctx, 0, -1.25, 0.18, PAL.skin); ctx.fillStyle = '#b8392e'; ctx.fillRect(-0.18, -1.6, 0.36, 0.25);
    ell(ctx, 0, -0.62, 0.34, 0.24, 0, '#efe3c2'); ctx.strokeStyle = '#b8392e'; ctx.lineWidth = 0.05; ctx.strokeRect(-0.33, -0.75, 0.66, 0.26);
    const hit = asleep ? 0 : Math.sin(t * 12) * 0.4; ctx.strokeStyle = '#6b4227'; ctx.lineWidth = 0.04;
    ctx.beginPath(); ctx.moveTo(-0.25, -0.95); ctx.lineTo(-0.1, -0.75 + hit * 0.2); ctx.moveTo(0.25, -0.95); ctx.lineTo(0.1, -0.75 - hit * 0.2); ctx.stroke();
    if (asleep) { ctx.save(); ctx.translate(0, -1.25); ctx.rotate(0.3); ctx.restore(); }
  } else if (id === 'bird') {
    const flap = asleep ? 0 : Math.sin(t * 18) * 0.6;
    ell(ctx, 0, -0.35, 0.35, 0.25, 0, '#3f8fa0'); circle(ctx, 0.3, -0.55, 0.16, '#3f8fa0');
    ctx.fillStyle = '#e0a83a'; ctx.beginPath(); ctx.moveTo(0.44, -0.58); ctx.lineTo(0.62, -0.52); ctx.lineTo(0.44, -0.48); ctx.fill();
    ctx.save(); ctx.translate(-0.05, -0.4); ctx.rotate(-0.4 - flap); ell(ctx, -0.25, 0, 0.3, 0.1, 0, '#2d6a7a'); ctx.restore();
    ctx.fillStyle = PAL.brass; ctx.fillRect(-0.45, -0.45, 0.15, 0.04);
    if (asleep) { ctx.strokeStyle = PAL.ink; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.arc(0.34, -0.6, 0.04, 0, Math.PI); ctx.stroke(); } else circle(ctx, 0.34, -0.6, 0.03, PAL.ink);
  }
}
function moth(ctx, t, dir) {
  const f = Math.sin(t * 22);
  ctx.scale(dir, 1);
  for (const s of [-1, 1]) { ctx.save(); ctx.scale(1, s); ctx.rotate(-0.2 + f * 0.5 * s); ell(ctx, -0.12, -0.18, 0.28, 0.17, -0.5, '#a39478'); circle(ctx, -0.18, -0.2, 0.05, '#6a5a48'); ctx.restore(); }
  ell(ctx, 0, 0, 0.18, 0.08, 0, '#7a6a52'); circle(ctx, 0.17, -0.02, 0.05, '#2a1b14');
  ctx.strokeStyle = '#6a5a48'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(0.2, -0.05); ctx.lineTo(0.32, -0.2); ctx.moveTo(0.2, -0.03); ctx.lineTo(0.36, -0.1); ctx.stroke();
}
function bunny(ctx, t, dir) {
  ctx.scale(dir, 1);
  const sq = 1 + Math.sin(t * 8) * 0.06;
  ctx.save(); ctx.scale(1 / sq, sq);
  ctx.fillStyle = '#8f8c94'; ctx.beginPath();
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, rr = 0.36 + (i % 2) * 0.07; ctx.lineTo(Math.cos(a) * rr, -0.32 + Math.sin(a) * rr * 0.85); }
  ctx.fill();
  ell(ctx, -0.05, -0.38, 0.22, 0.18, 0, '#a7a4ab');
  ctx.restore();
  ell(ctx, 0.08, -0.72, 0.06, 0.16, 0.3, '#8f8c94'); ell(ctx, -0.12, -0.72, 0.06, 0.16, -0.3, '#8f8c94');
  circle(ctx, 0.14, -0.4, 0.06, '#f3ead6'); circle(ctx, 0.16, -0.4, 0.03, '#120c08');
  circle(ctx, -0.04, -0.4, 0.05, '#f3ead6'); circle(ctx, -0.03, -0.4, 0.025, '#120c08');
}
function mouse(ctx, t, dir) {
  ctx.scale(dir, 1);
  ell(ctx, 0, -0.22, 0.38, 0.2, 0, '#8a8890'); circle(ctx, 0.3, -0.28, 0.14, '#8a8890'); circle(ctx, 0.22, -0.42, 0.09, '#c97b8e');
  circle(ctx, 0.38, -0.3, 0.03, '#120c08'); circle(ctx, 0.45, -0.25, 0.03, '#c97b8e');
  ctx.strokeStyle = '#8a8890'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(-0.38, -0.2); ctx.quadraticCurveTo(-0.6, -0.1 + Math.sin(t * 12) * 0.08, -0.7, -0.3); ctx.stroke();
  // wind-up key on its back
  ctx.save(); ctx.translate(-0.05, -0.45); ctx.scale(Math.cos(t * 10), 1); ctx.strokeStyle = PAL.brass; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.ellipse(-0.08, -0.06, 0.07, 0.05, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0.08, -0.06, 0.07, 0.05, 0, 0, 7); ctx.stroke(); ctx.restore();
  for (const x of [-0.2, 0.15]) circle(ctx, x, -0.03, 0.05, '#4a4850');
}
function spider(ctx, t) {
  ctx.strokeStyle = '#1a1412'; ctx.lineWidth = 0.035;
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const a = -0.6 + i * 0.4 + Math.sin(t * 10 + i) * 0.08; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * Math.cos(a) * 0.25, Math.sin(a) * 0.25 - 0.08); ctx.lineTo(s * Math.cos(a) * 0.42, Math.sin(a) * 0.4 + 0.1); ctx.stroke(); }
  ell(ctx, 0, 0.02, 0.2, 0.17, 0, '#1f1816'); circle(ctx, 0, -0.16, 0.1, '#2a201c');
  circle(ctx, -0.04, -0.18, 0.025, '#c0392b'); circle(ctx, 0.04, -0.18, 0.025, '#c0392b');
}
// the tin soldier, drawn with his feet at 0,0 facing right
export function drawSoldier(ctx, p, t, game) {
  const walk = p.grounded && Math.abs(p.vx) > 0.5 ? Math.sin(p.walkT * 13) : 0;
  const air = !p.grounded && !p.climb;
  const legA = p.climb ? Math.sin(p.walkT * 10) * 0.35 : air ? 0.25 : walk * 0.38;
  const boots = game.has.has('boots');
  // legs
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * 0.1, -0.62); ctx.rotate(legA * s * (p.climb ? 1 : 1));
    ctx.fillStyle = '#2b3e6a'; ctx.fillRect(-0.09, 0, 0.18, 0.46); ctx.fillStyle = '#b8392e'; ctx.fillRect(0.03, 0, 0.04, 0.44);
    ctx.fillStyle = boots ? '#3a3d44' : '#141010'; ctx.fillRect(-0.1, 0.42, 0.24, 0.2); if (boots) { ctx.fillStyle = '#b8392e'; ctx.fillRect(-0.1, 0.56, 0.24, 0.06); }
    ctx.restore();
  }
  // wind-up key on the back
  ctx.save(); ctx.translate(-0.24, -0.95); const kw = Math.cos(p.wind);
  ctx.strokeStyle = PAL.brass; ctx.lineWidth = 0.055; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-0.12, 0); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-0.2, -0.1 * kw, 0.07, 0.1 * Math.abs(kw) + 0.01, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(-0.2, 0.1 * kw, 0.07, 0.1 * Math.abs(kw) + 0.01, 0, 0, 7); ctx.stroke();
  ctx.restore();
  // body: red coat with white cross belts
  ctx.fillStyle = '#b8392e'; ctx.beginPath(); ctx.moveTo(-0.22, -0.62); ctx.lineTo(-0.2, -1.12); ctx.lineTo(0.2, -1.12); ctx.lineTo(0.22, -0.62); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d9584a'; ctx.fillRect(-0.18, -1.1, 0.07, 0.46);
  ctx.strokeStyle = '#f3ead6'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(-0.19, -1.1); ctx.lineTo(0.19, -0.66); ctx.moveTo(0.19, -1.1); ctx.lineTo(-0.19, -0.66); ctx.stroke();
  ctx.fillStyle = '#141010'; ctx.fillRect(-0.22, -0.68, 0.44, 0.07); ctx.fillStyle = PAL.brass; ctx.fillRect(-0.04, -0.68, 0.08, 0.07);
  // arm with the sabre
  const jab = p.jabT > 0 ? Math.sin(Math.min(1, (0.24 - p.jabT) / 0.12) * Math.PI / 2) : 0;
  const armA = p.climb ? -1.9 : p.umb ? -2.7 : jab ? -1.55 : 0.15 + walk * 0.2;
  ctx.save(); ctx.translate(0.08, -1.04); ctx.rotate(armA);
  ctx.fillStyle = '#a3322a'; ctx.fillRect(-0.06, 0, 0.12, 0.34 + jab * 0.12); ctx.fillStyle = '#f3ead6'; ctx.fillRect(-0.06, 0.3 + jab * 0.12, 0.12, 0.07);
  if (!p.umb && !p.climb) { ctx.translate(0, 0.38 + jab * 0.12); ctx.fillStyle = PAL.brass; ctx.fillRect(-0.09, -0.02, 0.18, 0.04); ctx.fillStyle = '#d8dde4'; ctx.beginPath(); ctx.moveTo(-0.025, 0); ctx.lineTo(0.025, 0); ctx.lineTo(0.01, 0.62); ctx.lineTo(-0.01, 0.62); ctx.fill(); }
  if (p.umb) { // parasol up
    ctx.translate(0, 0.36);
    ctx.strokeStyle = '#6b4227'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 0.7); ctx.stroke();
    ctx.translate(0, 0.72); ctx.rotate(Math.PI);
    ctx.fillStyle = '#d9707a'; ctx.beginPath(); ctx.moveTo(-0.62, 0.02); ctx.quadraticCurveTo(0, -0.62, 0.62, 0.02); ctx.lineTo(0.42, -0.05); ctx.lineTo(0.2, 0.02); ctx.lineTo(0, -0.05); ctx.lineTo(-0.2, 0.02); ctx.lineTo(-0.42, -0.05); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f0d6a0'; ctx.beginPath(); ctx.moveTo(-0.2, 0.02); ctx.quadraticCurveTo(0, -0.58, 0.2, 0.02); ctx.lineTo(0, -0.05); ctx.fill();
  }
  ctx.restore();
  // head
  ctx.fillStyle = PAL.skin; ctx.beginPath(); ctx.ellipse(0.02, -1.24, 0.15, 0.16, 0, 0, 7); ctx.fill();
  circle(ctx, 0.09, -1.27, 0.028, PAL.ink); ell(ctx, 0.11, -1.17, 0.045, 0.03, 0, '#e08a7a');
  ctx.fillStyle = '#3a2414'; ctx.fillRect(0.02, -1.165, 0.12, 0.025);
  // bearskin hat
  ctx.fillStyle = '#141010'; ctx.beginPath(); ctx.moveTo(-0.17, -1.3); ctx.quadraticCurveTo(-0.22, -1.7, 0, -1.78); ctx.quadraticCurveTo(0.22, -1.7, 0.17, -1.3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a3030'; ctx.fillRect(-0.1, -1.7, 0.05, 0.3);
  ctx.strokeStyle = PAL.brass; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(-0.13, -1.3); ctx.quadraticCurveTo(0.02, -1.08, 0.15, -1.3); ctx.stroke();
}
