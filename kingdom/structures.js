// The pictures a choice is drawn as: what rises out of the fog on the tile a way leads to. Each is painted onto the
// ground of wherever it lands (so a tavern in the snow stands on snow), and most have a little life added every frame
// by the renderer: smoke, fire, sparkle, water, a windmill turning (see fx).
import { Px, ramp, shade, box, roof, tower, cone, diamond, foot } from './paint.js';
import { ground, tree, pine, deadTree, rock, bush, house, crossroads, SPRITE, centre, WATER } from './terrain.js';
import { hash2 } from './util.js';

const STONE = '#a8a294', DARKSTONE = '#6e6a66', WOOD = '#8a5a36', DWOOD = '#5a3a24', THATCH = '#c8a050', PLASTER = '#e8dcc0';

function stream(p, cx, cy, w = 7) {
  // a stream across the tile, in at the upper-left edge and out at the lower-right, through the middle
  diamondFill(p, cx, cy, (x, y) => {
    const d = (y + .5 - cy) - (x + .5 - cx) / 2;
    if (Math.abs(d) > w / 2) return Math.abs(d) < w / 2 + 1.2 ? '#8a7a5a' : null;
    const n = hash2(x, y, 41);
    return n < .08 ? WATER.hi : d < -w / 2 + 1.5 ? WATER.lo : n < .25 ? shade(WATER.top, .07) : WATER.top;
  });
}
const diamondFill = (p, cx, cy, fn) => p.poly([[cx, cy - 12], [cx + 24, cy], [cx, cy + 12], [cx - 24, cy]], fn);
function tent(p, cx, cy, a, b, h, col, stripe) {
  const R = ramp(col);
  const [x, y] = foot(cx, cy, a, b);
  roof(p, x, y, a, b, 0, h, { lit: R.lit, base: R.base, gable: R.dim }, 'a');
  if (stripe) { const S = ramp(stripe); for (let i = 1; i < 4; i += 2) { const t = i / 4; const ex = x + 2 * a * t - b, ey = y + a * t + b / 2 - h; p.line(ex, ey, ex - b, ey + b / 2 + h, S.base); } }
  const mx = x + 2 * a - b, my = y + a + b / 2;       // the middle of the gable end, on the ground
  p.rect(mx - 1, my - 3, 3, 3, '#2a2230');
}
function flag(p, x, y, h, col, w = 5) { p.vline(x, y - h, y, DWOOD); p.rect(x + 1, y - h, w, 3, col); p.put(x + w + 1, y - h + 1, col); p.rect(x + 1, y - h + 1, w, 1, shade(col, -.2)); }
function logs(p, x, y) { p.line(x - 3, y, x + 3, y - 1, DWOOD); p.line(x - 3, y - 1, x + 3, y, WOOD); p.put(x, y - 1, '#ff9a3a'); }
function barrel(p, x, y) { p.rect(x - 2, y - 5, 4, 5, WOOD); p.rect(x - 2, y - 4, 4, 1, DWOOD); p.rect(x - 2, y - 2, 4, 1, DWOOD); p.rect(x - 2, y - 6, 4, 1, shade(WOOD, .2)); }
function crate(p, x, y) { const [fx, fy] = foot(x, y, 3, 3); box(p, fx, fy, 3, 3, 4, { top: '#c89a5a', left: '#a87a42', right: '#8a6234' }); }
function candle(p, x, y, col = '#f0e8d0') { p.rect(x, y - 3, 1, 3, col); p.put(x, y - 4, '#ffd24a'); }
function spear(p, x, y, h = 12) { p.line(x, y, x + 2, y - h, DWOOD); p.put(x + 2, y - h - 1, '#c8c8d0'); p.put(x + 3, y - h - 2, '#e8e8f0'); }
function stoneRing(p, cx, cy, rx, col = STONE) { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; rock(p, cx + Math.cos(a) * rx, cy + Math.sin(a) * rx / 2, .45, col); } }
function tomb(p, x, y, col = '#9a968e') { p.rect(x - 2, y - 6, 5, 6, col); p.rect(x - 1, y - 7, 3, 1, col); p.rect(x + 2, y - 6, 1, 6, shade(col, -.25)); p.put(x, y - 4, shade(col, -.35)); }
function columns(p, cx, cy, n, span, h, col = '#e0dad0') {
  for (let i = 0; i < n; i++) { const x = cx - span / 2 + i * span / (n - 1), y = cy - (i - (n - 1) / 2) * 1.2; p.rect(x - 1, y - h, 3, h, col); p.rect(x + 1, y - h, 1, h, shade(col, -.2)); p.rect(x - 2, y - h - 1, 5, 1, shade(col, .1)); }
}
function mound(p, cx, cy, rx, ry, col) {
  const R = ramp(col);
  p.ellipse(cx, cy, rx, ry, (x, y, nx, ny) => { const l = -nx * .6 - ny * .8 + (hash2(x, y, 3) - .5) * .35; return l > .5 ? R.hi : l > .05 ? R.lit : l > -.4 ? R.base : R.dim; });
}

// Each: draw(p, cx, cy, o) paints onto a sprite whose tile centre is (cx, cy); o: { biome, v }.
// fx: little bits of life the renderer adds, at offsets from the tile centre.
export const STRUCTURES = {
  road: {
    draw(p, cx, cy) {
      // cart ruts from edge to edge, a milestone, a signpost with a lantern, and a stile
      for (let i = -9; i <= 9; i++) { p.put(cx + i * 2 - 3, cy + i - 2, '#8c6a44'); p.put(cx + i * 2 + 3, cy + i + 2, '#8c6a44'); }
      p.rect(cx + 9, cy - 8, 4, 8, '#a8a294'); p.rect(cx + 9, cy - 9, 4, 1, '#c8c2b4'); p.rect(cx + 12, cy - 8, 1, 8, '#7e7a70'); p.put(cx + 10, cy - 6, '#6e6a66'); p.put(cx + 11, cy - 4, '#6e6a66');
      p.rect(cx - 12, cy - 18, 2, 18, DWOOD); p.rect(cx - 19, cy - 17, 9, 3, '#c8a878'); p.put(cx - 20, cy - 16, '#c8a878'); p.rect(cx - 10, cy - 13, 8, 3, '#b89868'); p.put(cx - 2, cy - 12, '#b89868');
      p.rect(cx - 12, cy - 22, 3, 4, '#3a3440'); p.put(cx - 11, cy - 21, '#ffd26a'); p.put(cx - 11, cy - 20, '#ffb040');
      p.rect(cx + 14, cy + 3, 1, 4, WOOD); p.rect(cx + 18, cy + 1, 1, 4, WOOD); p.line(cx + 13, cy + 4, cx + 19, cy + 2, '#a87a42');
    },
    fx: [{ k: 'glow', x: -11, y: -20, c: '#ffc85a' }],
  },
  village: { draw(p, cx, cy) { house(p, cx - 10, cy - 3, 5, 4, 7, PLASTER, '#a8583a', 'a', 5); house(p, cx + 9, cy - 5, 4, 5, 8, '#d8c8a8', THATCH, 'b', 6); house(p, cx - 1, cy + 5, 5, 4, 7, PLASTER, '#8a7a4a', 'a', 5); }, fx: [{ k: 'smoke', x: -8, y: -18 }] },
  tavern: {
    draw(p, cx, cy) {
      house(p, cx, cy - 2, 9, 7, 16, '#efe4c8', '#9a4a32', 'a', 8);
      // timber frame
      const [x, y] = foot(cx, cy - 2, 9, 7);
      for (let i = 1; i < 9; i += 3) p.line(x + 2 * i, y + i - 16 + 1, x + 2 * i, y + i - 1, '#6a4428');
      p.rect(cx + 12, cy - 13, 1, 6, DWOOD); p.rect(cx + 13, cy - 13, 5, 1, DWOOD); p.rect(cx + 14, cy - 12, 4, 4, '#e0b040'); p.put(cx + 15, cy - 11, '#a0602a');
      barrel(p, cx - 14, cy + 4);
    },
    fx: [{ k: 'smoke', x: -4, y: -32 }, { k: 'glow', x: -6, y: -8, c: '#ffc85a' }],
  },
  market: {
    draw(p, cx, cy) {
      const stall = (x, y, c1, c2) => { box(p, ...foot(x, y, 5, 4), 5, 4, 4, { top: '#a87a42', left: '#8a6234', right: '#6e4a28' }); const [fx, fy] = foot(x, y - 1, 6, 5); roof(p, fx, fy, 6, 5, 9, 3, { lit: c1, base: c2, gable: shade(c1, -.3) }, 'a'); p.put(x - 2, y - 6, '#e0402a'); p.put(x, y - 6, '#f2c24c'); p.put(x + 2, y - 7, '#6ab04c'); };
      stall(cx - 9, cy - 4, '#e8e0d0', '#c0302a'); stall(cx + 9, cy - 2, '#f2d25a', '#2f55a8'); crate(p, cx - 2, cy + 6); barrel(p, cx + 4, cy + 7);
    },
  },
  smithy: {
    draw(p, cx, cy) {
      const W = ramp(DARKSTONE);
      const [x, y] = foot(cx - 2, cy - 2, 8, 7); box(p, x, y, 8, 7, 12, { top: W.lit, left: W.base, right: W.dim });
      const [rx, ry] = foot(cx - 2, cy - 2, 9, 8); roof(p, rx, ry, 9, 8, 12, 5, { lit: '#6a5a4a', base: '#4a3e34', gable: W.dim }, 'b');
      p.rect(cx - 12, cy - 30, 4, 18, '#5a5450'); p.rect(cx - 12, cy - 31, 4, 1, '#3a3430');
      p.rect(cx - 3, cy - 5, 5, 4, '#ff7a2a'); p.rect(cx - 2, cy - 4, 3, 2, '#ffd26a');
      p.rect(cx + 10, cy + 2, 6, 2, '#4a4a52'); p.rect(cx + 12, cy + 4, 2, 3, '#3a3a42'); p.rect(cx + 9, cy + 1, 3, 1, '#5a5a62');
    },
    fx: [{ k: 'smoke', x: -10, y: -33, dark: true }, { k: 'glow', x: -1, y: -3, c: '#ff8a3a' }, { k: 'sparks', x: 13, y: 0 }],
  },
  farm: {
    draw(p, cx, cy) {
      p.poly([[cx - 4, cy - 10], [cx + 20, cy + 2], [cx + 8, cy + 8], [cx - 16, cy - 4]], (x, y) => ((x - 2 * y) >> 2) % 2 ? '#d8b848' : '#c49a34');
      house(p, cx - 8, cy + 1, 6, 5, 9, '#b0402c', '#6a4a3a', 'b', 6);
      p.rect(cx - 9, cy - 3, 3, 4, '#f0e0c0');
    },
  },
  mill: {
    draw(p, cx, cy) { const t = tower(p, cx, cy, 6, 22, '#d8d0c0'); cone(p, cx, t.top, 8, 10, '#8a5a3a'); p.rect(cx - 1, cy - 6, 3, 5, '#4a3024'); },
    fx: [{ k: 'sails', x: 0, y: -24 }],
  },
  manor: {
    draw(p, cx, cy) { house(p, cx + 4, cy - 4, 8, 6, 13, '#e8dcc8', '#4a5a7a', 'a', 7); house(p, cx - 10, cy + 2, 5, 6, 10, '#e0d4bc', '#4a5a7a', 'b', 6); bush(p, cx + 14, cy + 4, .9); bush(p, cx - 18, cy + 6, .8); },
    fx: [{ k: 'flag', x: 6, y: -30, c: '#c0302a' }],
  },
  chapel: {
    draw(p, cx, cy) {
      const W = ramp('#d0c8b8');
      const [x, y] = foot(cx + 3, cy - 1, 9, 5); box(p, x, y, 9, 5, 11, { top: W.lit, left: W.base, right: W.dim });
      const [rx, ry] = foot(cx + 3, cy - 1, 10, 6); roof(p, rx, ry, 10, 6, 11, 7, { lit: '#7a6a5a', base: '#5a4a3e', gable: W.dim }, 'a');
      const t = tower(p, cx - 10, cy - 3, 4, 22, '#d0c8b8'); cone(p, cx - 10, t.top, 5, 10, '#5a4a3e');
      p.put(cx - 10, t.top - 12, '#f2c24c'); p.rect(cx - 11, t.top + 3, 2, 3, '#3a2a2a');
      p.disc(cx + 16, cy - 4, 2, '#8ab0e8');
    },
  },
  abbey: {
    draw(p, cx, cy) {
      const W = ramp('#c8c0ac');
      const [x, y] = foot(cx - 2, cy - 4, 10, 6); box(p, x, y, 10, 6, 13, { top: W.lit, left: W.base, right: W.dim });
      const [rx, ry] = foot(cx - 2, cy - 4, 11, 7); roof(p, rx, ry, 11, 7, 13, 7, { lit: '#8a6a4a', base: '#6a4e36', gable: W.dim }, 'a');
      const [wx, wy] = foot(cx + 6, cy + 5, 8, 2); box(p, wx, wy, 8, 2, 6, { top: W.lit, left: W.base, right: W.dim });
      const t = tower(p, cx - 14, cy - 2, 4, 26, '#c8c0ac'); for (let i = -4; i < 4; i += 3) p.rect(cx - 14 + i, t.top - 3, 2, 3, '#c8c0ac');
    },
  },
  tollgate: {
    draw(p, cx, cy) {
      const W = ramp(STONE);
      const [x1, y1] = foot(cx - 12, cy - 4, 4, 4); box(p, x1, y1, 4, 4, 16, { top: W.lit, left: W.base, right: W.dim });
      const [x2, y2] = foot(cx + 10, cy + 5, 4, 4); box(p, x2, y2, 4, 4, 16, { top: W.lit, left: W.base, right: W.dim });
      for (let i = 0; i < 12; i++) p.put(cx - 8 + i * 2, cy - 8 + i, i % 4 < 2 ? '#e8e0d0' : '#c0302a');
      for (let i = 0; i < 12; i++) p.put(cx - 7 + i * 2, cy - 8 + i, i % 4 < 2 ? '#e8e0d0' : '#c0302a');
    },
    fx: [{ k: 'flag', x: -12, y: -26, c: '#c0302a' }],
  },
  camp: { draw(p, cx, cy) { tent(p, cx - 9, cy - 3, 6, 5, 9, '#c8b890'); tent(p, cx + 10, cy - 1, 5, 5, 8, '#a8b890'); logs(p, cx, cy + 5); }, fx: [{ k: 'fire', x: 0, y: 4 }] },
  bandit_camp: {
    draw(p, cx, cy) {
      for (let i = 0; i < 9; i++) { const x = cx - 20 + i * 3, y = cy - 6 - i * 1.5 + 6; p.rect(x, y - 10, 2, 10, i % 2 ? DWOOD : WOOD); p.put(x, y - 11, WOOD); }
      tent(p, cx + 6, cy - 2, 5, 5, 8, '#6a5a4a'); logs(p, cx - 4, cy + 6); flag(p, cx + 16, cy + 2, 16, '#2a2228', 6); p.put(cx + 19, cy - 13, '#e8e0d0');
    },
    fx: [{ k: 'fire', x: -4, y: 5 }],
  },
  war_camp: {
    draw(p, cx, cy) {
      tent(p, cx - 10, cy - 4, 5, 5, 9, '#e8e0d0', '#c0302a'); tent(p, cx + 8, cy - 5, 5, 5, 9, '#e8e0d0', '#2f55a8'); tent(p, cx, cy + 4, 5, 4, 8, '#e0d8c8');
      spear(p, cx + 16, cy + 4); spear(p, cx + 18, cy + 3); spear(p, cx + 20, cy + 2);
    },
    fx: [{ k: 'flag', x: -10, y: -20, c: '#c0302a' }, { k: 'flag', x: 8, y: -21, c: '#2f55a8' }],
  },
  watchtower: {
    draw(p, cx, cy) {
      for (const dx of [-4, 4]) p.line(cx + dx, cy, cx + dx / 2, cy - 26, DWOOD);
      p.line(cx - 4, cy - 6, cx + 4, cy - 14, WOOD); p.line(cx + 4, cy - 6, cx - 4, cy - 14, WOOD);
      const [x, y] = foot(cx, cy - 26, 5, 5); box(p, x, y, 5, 5, 5, { top: '#a87a42', left: '#8a6234', right: '#6e4a28' });
      const [rx, ry] = foot(cx, cy - 31, 6, 6); roof(p, rx, ry, 6, 6, 5, 5, { lit: '#9a4a32', base: '#7a3a26', gable: '#6e4a28' }, 'a');
    },
    fx: [{ k: 'glow', x: 0, y: -33, c: '#ffc85a' }],
  },
  castle: {
    draw(p, cx, cy) {
      const W = ramp('#b0aa9c');
      const [x, y] = foot(cx, cy, 10, 10); box(p, x, y, 10, 10, 10, { top: '#8a9a6a', left: W.base, right: W.dim });
      const [kx, ky] = foot(cx, cy - 2, 5, 5); box(p, kx, ky, 5, 5, 22, { top: W.lit, left: W.base, right: W.dim });
      for (const [dx, dy] of [[-20, 0], [20, 0], [0, 10]]) { const t = tower(p, cx + dx, cy + dy, 4, 16, '#b0aa9c'); cone(p, cx + dx, t.top, 5, 8, '#4a5a7a'); }
      p.rect(cx - 1, cy + 3, 3, 4, '#2a2230');
    },
    fx: [{ k: 'flag', x: 1, y: -32, c: '#c0302a' }],
  },
  ruins: {
    draw(p, cx, cy) {
      const W = ramp('#9a948a');
      const [x, y] = foot(cx - 6, cy - 4, 2, 9); box(p, x, y, 2, 9, 14, { top: W.lit, left: W.base, right: W.dim });
      const [x2, y2] = foot(cx + 8, cy - 2, 7, 2); box(p, x2, y2, 7, 2, 8, { top: W.lit, left: W.base, right: W.dim });
      columns(p, cx + 2, cy + 6, 2, 10, 10, '#b8b2a8');
      rock(p, cx - 12, cy + 6, .6, '#9a948a'); rock(p, cx + 14, cy + 6, .5, '#9a948a');
      for (let i = 0; i < 6; i++) p.put(cx - 7 + (i & 1), cy - 14 + i * 2, '#4a8a3a');
    },
  },
  bridge: {
    draw(p, cx, cy) {
      stream(p, cx, cy, 7);
      const W = ramp(STONE);
      p.poly([[cx - 16, cy + 6], [cx + 4, cy - 6], [cx + 16, cy - 2], [cx - 4, cy + 10]], W.lit);
      p.poly([[cx - 4, cy + 10], [cx + 16, cy - 2], [cx + 16, cy + 1], [cx - 4, cy + 13]], W.dim);
      p.disc(cx + 6, cy + 5, 2.5, '#2a3a5a');
      for (let i = 0; i < 10; i++) p.put(cx - 15 + i * 2, cy + 5 - i, W.hi);
    },
  },
  troll_bridge: {
    draw(p, cx, cy) {
      STRUCTURES.bridge.draw(p, cx, cy);
      for (let i = 0; i < 8; i++) p.put(cx - 10 + i * 3, cy + 3 - i * 1.5, '#4a7a3a');
      p.ellipse(cx + 6, cy + 5, 4, 3, '#1a2a1a');
    },
    fx: [{ k: 'eyes', x: 6, y: 5, c: '#ffd24a' }],
  },
  ferry: {
    draw(p, cx, cy) {
      stream(p, cx, cy, 10);
      p.rect(cx - 6, cy - 2, 12, 5, '#8a5a36'); p.rect(cx - 6, cy - 2, 12, 1, '#a87a4a'); p.hline(cx - 6, cx + 6, cy + 1, DWOOD);
      p.vline(cx - 16, cy - 16, cy - 4, DWOOD); p.line(cx - 16, cy - 14, cx + 18, cy + 2, '#c8b890');
      p.rect(cx - 2, cy - 8, 2, 6, '#4a3a5a'); p.rect(cx - 2, cy - 10, 2, 2, '#e0b48e');
    },
    fx: [{ k: 'ripple', x: 0, y: 3 }],
  },
  well: {
    draw(p, cx, cy) {
      tower(p, cx, cy, 6, 5, '#a8a294');
      p.ellipse(cx, cy - 5, 4, 2, '#2a3a5a');
      p.vline(cx - 6, cy - 16, cy - 4, DWOOD); p.vline(cx + 5, cy - 16, cy - 4, DWOOD);
      const [rx, ry] = foot(cx, cy - 16, 5, 4); roof(p, rx, ry, 5, 4, 0, 5, { lit: '#9a4a32', base: '#7a3a26', gable: DWOOD }, 'b');
      p.hline(cx - 5, cx + 4, cy - 12, '#6a4a30'); p.rect(cx - 1, cy - 11, 2, 3, '#8a6234');
    },
  },
  shrine: {
    draw(p, cx, cy) {
      const W = ramp('#b8b0a0');
      const [x, y] = foot(cx, cy - 2, 4, 3); box(p, x, y, 4, 3, 10, { top: W.lit, left: W.base, right: W.dim });
      const [rx, ry] = foot(cx, cy - 2, 5, 4); roof(p, rx, ry, 5, 4, 10, 4, { lit: '#7a6a5a', base: '#5a4a3e', gable: W.dim }, 'a');
      p.rect(cx - 2, cy - 8, 3, 4, '#3a2a2a'); p.put(cx - 1, cy - 7, '#f2c24c');
      for (const [dx, dy] of [[-8, 4], [-5, 6], [7, 5], [10, 3]]) candle(p, cx + dx, cy + dy);
      p.put(cx + 3, cy + 7, '#f07aa0'); p.put(cx - 3, cy + 8, '#f2e25a');
    },
    fx: [{ k: 'candles', pts: [[-8, 0], [-5, 2], [7, 1], [10, -1]] }],
  },
  stones: {
    draw(p, cx, cy) {
      const pts = [];
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + .4; pts.push([Math.cos(a) * 17, Math.sin(a) * 8]); }
      pts.sort((a, b) => a[1] - b[1]);
      for (const [dx, dy] of pts) { const x = cx + dx, y = cy + dy; p.rect(x - 2, y - 11, 4, 11, '#8a8680'); p.rect(x + 1, y - 11, 1, 11, '#6a6660'); p.rect(x - 2, y - 12, 3, 1, '#a8a49e'); p.put(x - 1, y - 7, '#6ae0e0'); p.put(x, y - 5, '#6ae0e0'); }
      p.rect(cx - 3, cy - 3, 7, 3, '#7a7670');
    },
    fx: [{ k: 'glow', x: 0, y: -4, c: '#6ae0e0', big: true }, { k: 'motes', x: 0, y: -6, c: '#aaf8f8' }],
  },
  graveyard: {
    draw(p, cx, cy) {
      deadTree(p, cx - 13, cy - 2);
      for (const [dx, dy] of [[-4, -6], [4, -4], [12, -2], [-8, 2], [0, 4], [8, 6]]) tomb(p, cx + dx, cy + dy);
      p.rect(cx - 14, cy - 15, 3, 2, '#1a1620'); p.put(cx - 12, cy - 16, '#1a1620');
      for (let i = 0; i < 14; i++) p.put(cx - 20 + i * 3, cy + 6 - Math.round(i * 1.4) + 6, DWOOD);
    },
    fx: [{ k: 'wisp', x: 4, y: -2, c: '#c8e8ff' }],
  },
  crypt: {
    draw(p, cx, cy) {
      const W = ramp('#8e8a84');
      const [x, y] = foot(cx, cy - 2, 8, 6); box(p, x, y, 8, 6, 12, { top: W.lit, left: W.base, right: W.dim });
      const [rx, ry] = foot(cx, cy - 2, 9, 7); roof(p, rx, ry, 9, 7, 12, 5, { lit: '#7a7670', base: '#5e5a56', gable: W.dim }, 'b');
      columns(p, cx - 7, cy + 4, 2, 8, 10, '#a8a49e');
      p.rect(cx - 9, cy - 5, 5, 7, '#1a1620');
      tomb(p, cx + 14, cy + 5, '#8e8a84');
    },
    fx: [{ k: 'wisp', x: -7, y: -2, c: '#b8f0c8' }],
  },
  gallows: {
    draw(p, cx, cy) {
      mound(p, cx, cy + 2, 18, 7, '#7a8a4a');
      p.rect(cx - 8, cy - 22, 2, 22, DWOOD); p.rect(cx - 8, cy - 22, 16, 2, DWOOD); p.line(cx - 6, cy - 16, cx - 2, cy - 20, DWOOD);
      p.vline(cx + 5, cy - 20, cy - 13, '#c8b890'); p.disc(cx + 5, cy - 12, 1.5, '#c8b890'); p.put(cx + 5, cy - 12, '#7a8a4a');
      p.rect(cx - 10, cy - 1, 20, 2, WOOD);
    },
    fx: [{ k: 'crow', x: -4, y: -24 }],
  },
  mine: {
    draw(p, cx, cy) {
      mound(p, cx - 2, cy - 4, 20, 13, '#8a8074');
      p.rect(cx - 8, cy - 12, 10, 11, '#1a1620'); p.rect(cx - 9, cy - 13, 12, 2, WOOD); p.rect(cx - 9, cy - 12, 2, 11, WOOD); p.rect(cx + 1, cy - 12, 2, 11, WOOD);
      for (let i = 0; i < 6; i++) p.hline(cx + i * 2 - 2, cx + i * 2, cy + i, '#6a6660');
      p.rect(cx + 8, cy + 2, 6, 4, '#6a5a4a'); p.rect(cx + 9, cy + 1, 4, 2, '#4a4a52'); p.put(cx + 9, cy + 6, '#2a2228'); p.put(cx + 13, cy + 6, '#2a2228');
    },
    fx: [{ k: 'glow', x: -3, y: -6, c: '#ffc85a' }],
  },
  cave: { draw(p, cx, cy) { mound(p, cx, cy - 4, 22, 14, '#8a8478'); p.ellipse(cx + 2, cy - 4, 7, 7, '#1a1620'); p.rect(cx - 5, cy - 4, 14, 5, '#1a1620'); rock(p, cx - 14, cy + 6, .7); rock(p, cx + 14, cy + 6, .6); } },
  lair: {
    draw(p, cx, cy) {
      mound(p, cx, cy - 4, 22, 14, '#5a4640');
      p.ellipse(cx + 2, cy - 4, 8, 7, '#140e12'); p.rect(cx - 6, cy - 4, 16, 5, '#140e12');
      for (let i = 0; i < 7; i++) p.put(cx - 4 + i * 2, cy + 1 - (i & 1), '#f2c24c');
      p.rect(cx - 16, cy + 3, 4, 3, '#e8e0cc'); p.put(cx - 15, cy + 4, '#4a3e38'); p.hline(cx + 12, cx + 17, cy + 4, '#d8d0bc'); p.hline(cx + 12, cx + 17, cy + 6, '#d8d0bc');
    },
    fx: [{ k: 'smoke', x: 2, y: -18, dark: true }, { k: 'eyes', x: 2, y: -5, c: '#ff5a2a' }, { k: 'glint', x: 0, y: 0 }],
  },
  witch_hut: {
    draw(p, cx, cy) {
      // a crooked cottage: walls leaning one way, the roof the other
      const [x, y] = foot(cx + 2, cy - 3, 7, 6);
      box(p, x, y, 7, 6, 10, { top: '#7a6a4a', left: '#8a7254', right: '#6a563e' });
      const [rx, ry] = foot(cx + 3, cy - 4, 8, 7); roof(p, rx, ry, 8, 7, 10, 10, { lit: '#5a6a3a', base: '#46552e', gable: '#6a563e' }, 'b');
      p.rect(cx + 6, cy - 26, 3, 8, '#4a4038'); p.rect(cx - 2, cy - 6, 3, 5, '#2a2018'); p.put(cx + 10, cy - 8, '#9aff6a');
      tower(p, cx - 13, cy + 5, 4, 4, '#2a2a30'); p.ellipse(cx - 13, cy + 1, 3, 1.5, '#5aff4a');
      p.line(cx - 17, cy + 5, cx - 15, cy + 2, DWOOD); p.line(cx - 9, cy + 5, cx - 11, cy + 2, DWOOD);
    },
    fx: [{ k: 'smoke', x: 7, y: -28, green: true }, { k: 'bubbles', x: -13, y: 1 }],
  },
  wizard_tower: {
    draw(p, cx, cy) {
      const t = tower(p, cx, cy, 6, 38, '#9a94b0'); cone(p, cx, t.top, 9, 18, '#3a3a8a');
      for (const [dx, dy] of [[-3, -10], [2, -14], [-1, -6], [4, -4]]) p.put(cx + dx, t.top - dy - 12 + 12, '#f2e25a');
      p.rect(cx - 1, t.top + 8, 2, 3, '#ffe88a'); p.rect(cx - 2, cy - 7, 3, 6, '#2a2230');
      rock(p, cx + 12, cy + 5, .6); bush(p, cx - 12, cy + 5, .7, '#4a6a8a');
    },
    fx: [{ k: 'glow', x: 0, y: -29, c: '#8ab8ff' }, { k: 'motes', x: 0, y: -46, c: '#fff4a0' }],
  },
  fairy_ring: {
    draw(p, cx, cy) {
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const x = Math.round(cx + Math.cos(a) * 15), y = Math.round(cy + Math.sin(a) * 7); p.rect(x, y - 2, 1, 2, '#f0e8d0'); p.rect(x - 1, y - 4, 3, 2, i % 3 ? '#e04a3a' : '#f06a4a'); p.put(x, y - 4, '#ffffff'); }
      p.ellipse(cx, cy, 11, 5, (x, y) => hash2(x, y, 5) < .15 ? '#9aff9a' : '#6ac85a');
    },
    fx: [{ k: 'motes', x: 0, y: -4, c: '#f8c8ff', many: true }],
  },
  grove: {
    draw(p, cx, cy) {
      p.rect(cx - 3, cy - 16, 6, 16, '#6a4a30'); p.rect(cx + 1, cy - 16, 2, 16, '#5a3c26'); p.line(cx - 3, cy, cx - 7, cy + 2, '#6a4a30'); p.line(cx + 3, cy, cx + 7, cy + 2, '#5a3c26');
      const R = ramp('#3a8a4a');
      for (const [dx, dy, r] of [[0, -30, 12], [-11, -24, 9], [11, -25, 9], [-5, -38, 8], [6, -37, 8], [0, -20, 8]]) p.disc(cx + dx, cy + dy, r, (x, y, nx, ny) => { const l = -nx * .6 - ny * .8 + (hash2(x, y, 7) - .5) * .5; return l > .55 ? R.hi : l > .1 ? R.lit : l > -.35 ? R.base : R.dim; });
    },
    fx: [{ k: 'motes', x: 0, y: -26, c: '#e8ffa0' }],
  },
  forest: { draw(p, cx, cy) { for (const [dx, dy] of [[-12, -4], [2, -7], [13, -3], [-5, 1], [8, 3], [-14, 5], [0, 6]]) { if ((dx + dy) % 3 === 0) pine(p, cx + dx, cy + dy, 1.05, '#23583a'); else tree(p, cx + dx, cy + dy, 1, '#2e6e34', dx); } } },
  swamp: {
    draw(p, cx, cy) {
      p.ellipse(cx - 6, cy + 1, 10, 4, '#3a5a4a'); p.ellipse(cx + 9, cy - 3, 7, 3, '#3a5a4a'); p.ellipse(cx - 6, cy + 1, 8, 3, '#46705a');
      deadTree(p, cx + 12, cy + 4, '#4a4038');
      for (let i = 0; i < 8; i++) { const x = cx - 18 + i * 5, y = cy + 4 - (i % 3); p.vline(x, y - 5, y, '#7a7a3a'); p.put(x, y - 6, '#5a3a24'); }
    },
    fx: [{ k: 'wisp', x: -6, y: -8, c: '#a8ffb0' }, { k: 'wisp', x: 9, y: -12, c: '#b8f0ff' }],
  },
  lake: { draw(p, cx, cy) { diamond(p, cx, cy, 22, (x, y) => hash2(x, y, 12) < .06 ? WATER.hi : WATER.top); diamond(p, cx, cy + 1, 14, WATER.lo); p.rect(cx + 1, cy - 8, 1, 7, '#e8e8f0'); p.rect(cx - 1, cy - 6, 5, 1, '#c8a040'); p.rect(cx, cy - 2, 2, 2, '#e0b48e'); }, fx: [{ k: 'sparkle', x: 1, y: -8 }, { k: 'ripple', x: 1, y: 0 }] },
  mountain: {
    draw(p, cx, cy) {
      const R = ramp('#8a8478');
      p.poly([[cx - 3, cy - 42], [cx + 6, cy + 6], [cx - 22, cy + 5]], (x, y) => hash2(x, y, 4) < .1 ? R.base : R.lit);
      p.poly([[cx - 3, cy - 42], [cx + 22, cy + 4], [cx + 6, cy + 6]], (x, y) => hash2(x, y, 4) < .1 ? R.dark : R.dim);
      p.poly([[cx - 3, cy - 42], [cx + 4, cy - 26], [cx - 2, cy - 24], [cx - 9, cy - 27]], '#f4f8fc');
      p.poly([[cx - 3, cy - 42], [cx + 8, cy - 23], [cx + 4, cy - 26]], '#cfdcea');
      p.poly([[cx + 8, cy - 14], [cx + 24, cy + 4], [cx + 12, cy + 6]], R.dark);
    },
  },
  pass: {
    draw(p, cx, cy) {
      const R = ramp('#8a8478');
      p.poly([[cx - 12, cy - 30], [cx - 4, cy + 2], [cx - 24, cy + 2]], R.lit); p.poly([[cx - 12, cy - 30], [cx - 2, cy - 4], [cx - 4, cy + 2]], R.dim);
      p.poly([[cx + 14, cy - 26], [cx + 24, cy + 2], [cx + 6, cy + 2]], R.dim); p.poly([[cx + 14, cy - 26], [cx + 6, cy + 2], [cx + 4, cy - 6]], R.lit);
      p.poly([[cx - 12, cy - 30], [cx - 8, cy - 22], [cx - 14, cy - 22]], '#f4f8fc'); p.poly([[cx + 14, cy - 26], [cx + 17, cy - 19], [cx + 11, cy - 19]], '#f4f8fc');
    },
  },
  battlefield: {
    draw(p, cx, cy) {
      for (const [dx, dy, a] of [[-12, 2, 3], [-4, -4, -2], [6, 0, 4], [14, -3, 1], [0, 6, -3]]) p.line(cx + dx, cy + dy, cx + dx + a, cy + dy - 9, DWOOD);
      p.rect(cx - 9, cy + 4, 4, 3, '#8a8a92'); p.ellipse(cx + 9, cy + 5, 3, 2, '#7a4a3a');
      p.vline(cx + 2, cy - 18, cy - 2, DWOOD); p.poly([[cx + 3, cy - 18], [cx + 10, cy - 17], [cx + 8, cy - 13], [cx + 10, cy - 10], [cx + 3, cy - 11]], '#8a2a2a');
      p.rect(cx - 16, cy - 4, 3, 2, '#1a1620'); p.put(cx - 15, cy - 5, '#1a1620');
    },
    fx: [{ k: 'crow', x: 12, y: -14 }],
  },
  tourney: {
    draw(p, cx, cy) {
      tent(p, cx - 12, cy - 5, 5, 5, 10, '#e8e0d0', '#c0302a'); tent(p, cx + 13, cy - 3, 5, 5, 10, '#e8e0d0', '#2f55a8');
      for (let i = 0; i < 12; i++) { p.put(cx - 14 + i * 3, cy + 7 - i * 1.5, '#e8e0d0'); p.put(cx - 13 + i * 3, cy + 7 - i * 1.5, i % 2 ? '#c0302a' : '#e8e0d0'); p.vline(cx - 14 + i * 3, cy + 7 - i * 1.5 + 1, cy + 7 - i * 1.5 + 3, DWOOD); }
    },
    fx: [{ k: 'flag', x: -12, y: -22, c: '#f2c24c' }, { k: 'flag', x: 13, y: -20, c: '#2f55a8' }],
  },
  hermitage: {
    draw(p, cx, cy) {
      mound(p, cx + 6, cy - 3, 16, 10, '#8a8478');
      house(p, cx - 6, cy + 1, 5, 4, 7, '#a89478', '#6a5a3a', 'b', 5);
      p.vline(cx + 10, cy - 8, cy + 4, DWOOD); p.rect(cx + 9, cy - 10, 3, 3, '#f2c24c');
    },
    fx: [{ k: 'glow', x: 10, y: -9, c: '#ffd26a' }],
  },
  oracle: {
    draw(p, cx, cy) {
      const W = ramp('#e8e2d6');
      const [x, y] = foot(cx, cy, 9, 7); box(p, x, y, 9, 7, 3, { top: W.lit, left: W.base, right: W.dim });
      columns(p, cx, cy - 1, 4, 26, 16, '#e8e2d6');
      const [rx, ry] = foot(cx, cy - 18, 10, 8); roof(p, rx, ry, 10, 8, 0, 6, { lit: '#d8d0c0', base: '#b8b0a0', gable: '#c8c0b0' }, 'a');
      p.rect(cx - 2, cy - 6, 4, 3, '#6a5a4a'); p.rect(cx - 3, cy - 7, 6, 1, '#8a7a6a');
    },
    fx: [{ k: 'smoke', x: 0, y: -8, green: false, purple: true }, { k: 'fire', x: 0, y: -7, small: true }],
  },
  portal: {
    draw(p, cx, cy) {
      const W = ramp('#8a8680');
      p.rect(cx - 12, cy - 22, 5, 22, W.lit); p.rect(cx + 8, cy - 22, 5, 22, W.dim); p.rect(cx - 13, cy - 26, 27, 5, W.base); p.rect(cx - 13, cy - 26, 27, 1, W.hi);
      p.ellipse(cx + .5, cy - 10, 7.5, 11, '#2a1848');
      for (const [dx, dy] of [[-10, -12], [10, -8], [-10, -4]]) p.put(cx + dx, cy + dy, '#c89aff');
    },
    fx: [{ k: 'portal', x: 0, y: -10 }],
  },
  orchard: { draw(p, cx, cy) { for (const [dx, dy] of [[-12, -2], [0, -6], [12, -2], [-6, 4], [6, 4]]) { tree(p, cx + dx, cy + dy, .7, '#4a9a40', dx); p.put(cx + dx - 2, cy + dy - 7, '#e0402a'); p.put(cx + dx + 2, cy + dy - 9, '#e0402a'); p.put(cx + dx, cy + dy - 11, '#f2c24c'); } } },
  stable: {
    draw(p, cx, cy) {
      house(p, cx, cy - 1, 11, 5, 8, '#9a6a44', '#7a4a32', 'a', 5);
      p.rect(cx + 7, cy - 1, 3, 3, '#1a1620'); p.rect(cx + 8, cy - 3, 2, 2, '#6a4a30');
      p.rect(cx - 16, cy + 3, 6, 4, '#d8b848'); p.rect(cx - 16, cy + 3, 6, 1, '#f0d26a');
    },
  },
  prison: {
    draw(p, cx, cy) {
      const W = ramp('#7e7a74');
      const [x, y] = foot(cx, cy - 1, 9, 8); box(p, x, y, 9, 8, 16, { top: W.lit, left: W.base, right: W.dim });
      for (let i = 0; i < 12; i += 3) for (let j = 0; j < 3; j++) p.put(cx - 14 + i + 1, cy - 6 - 4 + j * 1 + i / 2 - 3, '#1a1620');
      for (const [dx, dy] of [[-12, -8], [-6, -5], [6, -6], [12, -9]]) { p.rect(cx + dx, cy + dy, 3, 4, '#1a1620'); p.vline(cx + dx + 1, cy + dy, cy + dy + 3, '#8a8a92'); }
      for (let i = -9; i < 10; i += 3) p.rect(cx + i, cy - 21 - Math.round(i / 2) * 0, 2, 2, W.lit);
    },
  },
  altar: {
    draw(p, cx, cy) {
      p.ellipse(cx, cy + 1, 17, 8, '#3a2a30');
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; p.put(cx + Math.round(Math.cos(a) * 15), cy + 1 + Math.round(Math.sin(a) * 7), '#8a1a2a'); }
      p.line(cx - 10, cy - 3, cx + 10, cy + 5, '#8a1a2a'); p.line(cx + 10, cy - 3, cx - 10, cy + 5, '#8a1a2a');
      const W = ramp('#4a4448'); const [x, y] = foot(cx, cy, 6, 3); box(p, x, y, 6, 3, 6, { top: W.lit, left: W.base, right: W.dim });
      for (const [dx, dy] of [[-14, 0], [14, 1], [-7, 7], [7, 7], [0, -6]]) candle(p, cx + dx, cy + dy, '#3a2a30');
    },
    fx: [{ k: 'candles', pts: [[-14, -4], [14, -3], [-7, 3], [7, 3], [0, -10]], red: true }, { k: 'glow', x: 0, y: -2, c: '#ff3a4a' }],
  },
  hovel: {
    draw(p, cx, cy) {
      house(p, cx - 2, cy - 1, 6, 5, 6, '#9a8a6a', '#7a6a4a', 'b', 5);
      p.rect(cx - 6, cy - 14, 4, 3, '#9a7a4a'); p.rect(cx + 2, cy - 12, 3, 2, '#6a5a3a');
      p.rect(cx + 10, cy + 3, 3, 3, '#6a5a4a'); p.line(cx + 12, cy - 4, cx + 16, cy + 4, DWOOD);
    },
  },
  bonfire: { draw(p, cx, cy) { /* the ash ring first, then the sticks standing in it */ p.ellipse(cx, cy + 3, 9, 3, '#3a2a24'); for (let i = 0; i < 6; i++) p.line(cx - 7 + i * 3, cy + 4, cx - 1 + i, cy - 6, i % 2 ? WOOD : DWOOD); }, fx: [{ k: 'fire', x: 0, y: -2, big: true }, { k: 'smoke', x: 0, y: -24 }] },
  palace: {
    draw(p, cx, cy) {
      const W = ramp('#e8e0cc');
      const [x, y] = foot(cx, cy - 2, 11, 8); box(p, x, y, 11, 8, 18, { top: W.lit, left: W.base, right: W.dim });
      const [rx, ry] = foot(cx, cy - 2, 12, 9); roof(p, rx, ry, 12, 9, 18, 8, { lit: '#4a5a8a', base: '#3a4a7a', gable: W.dim }, 'a');
      columns(p, cx - 6, cy + 7, 4, 16, 12, '#f0e8d8');
      p.rect(cx + 8, cy - 14, 3, 6, '#f2c24c'); p.rect(cx + 14, cy - 11, 3, 6, '#f2c24c');
    },
    fx: [{ k: 'flag', x: 2, y: -40, c: '#c0302a' }],
  },
  cathedral: {
    draw(p, cx, cy) {
      const W = ramp('#d8d0c0'), Rf = ramp('#4a5a7a');
      const [x, y] = foot(cx + 2, cy, 12, 7); box(p, x, y, 12, 7, 16, { top: W.lit, left: W.base, right: W.dim });
      const [rx, ry] = foot(cx + 2, cy, 13, 8); roof(p, rx, ry, 13, 8, 16, 9, { lit: Rf.lit, base: Rf.base, gable: W.dim }, 'a');
      const t = tower(p, cx - 12, cy - 3, 5, 36, '#d8d0c0'); cone(p, cx - 12, t.top, 6, 18, '#4a5a7a'); p.put(cx - 12, t.top - 20, '#f2c24c');
      p.disc(cx + 13, cy - 6, 3, '#6a8ac8'); p.put(cx + 13, cy - 6, '#f0d27a'); p.put(cx + 12, cy - 7, '#e05a8a');
    },
  },
  city_gate: {
    draw(p, cx, cy) {
      const W = ramp('#a8a296');
      p.rect(cx - 20, cy - 16, 40, 16, W.base); p.rect(cx - 20, cy - 18, 40, 2, W.lit);
      for (let x = cx - 20; x < cx + 20; x += 4) p.rect(x, cy - 21, 2, 3, W.lit);
      for (const dx of [-16, 16]) { const t = tower(p, cx + dx, cy + 2, 6, 26, '#b0aa9e'); cone(p, cx + dx, t.top, 7, 10, '#4a5a7a'); }
      p.rect(cx - 6, cy - 12, 12, 12, '#1a1620'); p.ellipse(cx, cy - 12, 6, 4, '#1a1620'); for (let x = cx - 5; x <= cx + 5; x += 2) p.vline(x, cy - 14, cy - 4, '#6a6a72');
    },
    fx: [{ k: 'flag', x: -16, y: -40, c: '#c0302a' }, { k: 'flag', x: 16, y: -40, c: '#c0302a' }],
  },
  garden: {
    draw(p, cx, cy) {
      for (let i = -3; i <= 3; i++) { bush(p, cx + i * 5, cy - 7 + Math.abs(i) * 1, .8, '#2f7a3a'); bush(p, cx + i * 5, cy + 7 - Math.abs(i) * 1, .8, '#2f7a3a'); }
      tower(p, cx, cy + 1, 5, 3, '#c8c0b0'); p.ellipse(cx, cy - 2, 3, 1.5, WATER.top); p.rect(cx, cy - 8, 1, 6, '#8cc6ef');
      for (const [dx, dy, c] of [[-10, 0, '#f07aa0'], [10, 0, '#f2e25a'], [-4, 5, '#ffffff'], [4, -5, '#b890f0']]) p.put(cx + dx, cy + dy, c);
    },
    fx: [{ k: 'sparkle', x: 0, y: -8 }],
  },
  street: {
    draw(p, cx, cy) {
      // a city street on a holiday: cobbles, tall houses either side, bunting strung between them, and the crowd
      diamond(p, cx, cy, 24, (x, y) => ((x >> 1) + y) % 4 === 0 ? '#8e887c' : (x + 2 * y) % 7 === 0 ? '#a8a294' : '#9c968a');
      house(p, cx - 13, cy - 4, 4, 5, 16, '#e8dcc0', '#8a3a2a', 'b', 6);
      house(p, cx + 13, cy - 4, 5, 4, 14, '#d8c8a8', '#3e5288', 'a', 6);
      const flags = ['#c0302a', '#f2c24c', '#2f55a8', '#e8e0d0', '#2f7d47'];
      for (let i = 0; i <= 14; i++) { const x = cx - 10 + i * 1.5, y = cy - 20 + Math.round(Math.sin(i / 14 * Math.PI) * 4); p.put(Math.round(x), y, '#5a4a3a'); if (i % 2 === 0) { p.put(Math.round(x), y + 1, flags[(i / 2) % 5]); p.put(Math.round(x), y + 2, flags[(i / 2) % 5]); } }
      const folk = ['#b8563f', '#2f55a8', '#6a8a3a', '#d8b848', '#8a5a8a', '#e8e0d0'];
      for (let i = 0; i < 8; i++) { const x = cx - 15 + i * 4 + (i & 1), y = cy + 3 + (i % 3) - (i > 4 ? 2 : 0); p.rect(x, y - 3, 2, 3, folk[i % 6]); p.put(x, y - 4, ['#f1d0b0', '#c68d64', '#e0b48e'][i % 3]); }
    },
    fx: [{ k: 'flag', x: -13, y: -30, c: '#c0302a' }, { k: 'flag', x: 13, y: -28, c: '#f2c24c' }],
  },
  throne: { draw(p, cx, cy, o) { throneRoom(p, cx, cy, o); }, fx: [{ k: 'glow', x: -10, y: -8, c: '#ffcf5a', big: true }, { k: 'glow', x: 14, y: -6, c: '#ffcf5a', big: true }, { k: 'motes', x: 0, y: -20, c: '#fff4a0', many: true }] },
  crossroads: { draw(p, cx, cy) { crossroads(p, cx, cy); } },
};

// The throne room: a hall of gold with the roof off, so you can see in. A red carpet runs from the doors (bottom
// corner) to the throne on its steps under a canopy, between pillars, braziers and your house's banners.
export function throneRoom(p, cx, cy, o = {}) {
  const gold = ramp('#e8b830'), marble = ramp('#f2ead8');
  // the floor, a chequer of marble and gold
  p.poly([[cx, cy - 12], [cx + 24, cy], [cx, cy + 12], [cx - 24, cy]], (x, y) => ((x >> 2) + (y >> 1)) % 2 ? marble.lit : '#e8d8a8');
  // walls on the two far sides, low enough to see over
  const wallH = 18;
  p.poly([[cx - 24, cy], [cx, cy - 12], [cx, cy - 12 - wallH], [cx - 24, cy - wallH]], (x, y) => (y + (x >> 1)) % 6 === 0 ? gold.dim : '#c89a3a');
  p.poly([[cx, cy - 12], [cx + 24, cy], [cx + 24, cy - wallH], [cx, cy - 12 - wallH]], (x, y) => (y - (x >> 1)) % 6 === 0 ? gold.base : '#dcae44');
  p.hline(cx - 24, cx, cy - wallH, gold.hi); p.line(cx, cy - 12 - wallH, cx + 24, cy - wallH, gold.hi); p.line(cx - 24, cy - wallH, cx, cy - 12 - wallH, gold.hi);
  // banners with the house arms on the back walls
  const arms = o.arms || { field: '#2f55a8', tincture: '#f2c24c' };
  for (const [bx, by] of [[cx - 15, cy - 20], [cx + 13, cy - 21]]) { p.rect(bx, by, 5, 9, arms.field); p.poly([[bx, by + 9], [bx + 5, by + 9], [bx + 2.5, by + 12]], arms.field); p.rect(bx + 2, by + 3, 1, 3, arms.tincture); p.rect(bx + 1, by + 4, 3, 1, arms.tincture); }
  // the carpet from the doors to the throne
  p.poly([[cx - 2, cy + 12], [cx + 3, cy + 11], [cx + 3, cy - 5], [cx - 2, cy - 5]].map(([x, y]) => [x, y]), '#b8202a');
  p.poly([[cx - 1, cy + 12], [cx + 2, cy + 11], [cx + 2, cy - 5], [cx - 1, cy - 5]], '#d8303a');
  // steps and the throne under a canopy
  for (let i = 0; i < 3; i++) p.rect(cx - 7 + i, cy - 8 - i * 2, 15 - i * 2, 2, i % 2 ? gold.lit : gold.base);
  p.rect(cx - 4, cy - 22, 9, 12, gold.base); p.rect(cx - 3, cy - 21, 7, 10, '#a01a24'); p.rect(cx - 4, cy - 24, 9, 2, gold.hi); p.put(cx, cy - 25, gold.hi); p.put(cx - 4, cy - 25, gold.hi); p.put(cx + 4, cy - 25, gold.hi);
  p.rect(cx - 5, cy - 13, 2, 3, gold.dim); p.rect(cx + 4, cy - 13, 2, 3, gold.dim);
  p.poly([[cx - 9, cy - 34], [cx + 10, cy - 34], [cx + 8, cy - 29], [cx - 7, cy - 29]], '#8a1a2a'); p.hline(cx - 9, cx + 10, cy - 34, gold.hi);
  p.vline(cx - 8, cy - 33, cy - 10, gold.base); p.vline(cx + 9, cy - 33, cy - 10, gold.base);
  // pillars along the sides, and braziers
  for (const [dx, dy] of [[-18, -2], [-10, 3], [12, 3], [19, -2]]) { p.rect(cx + dx - 1, cy + dy - 22, 3, 22, marble.lit); p.rect(cx + dx + 1, cy + dy - 22, 1, 22, marble.dim); p.rect(cx + dx - 2, cy + dy - 23, 5, 2, gold.hi); p.rect(cx + dx - 2, cy + dy - 1, 5, 1, gold.base); }
  for (const [dx, dy] of [[-10, -8], [14, -6]]) { p.rect(cx + dx - 1, cy + dy - 4, 3, 4, gold.dim); p.rect(cx + dx - 2, cy + dy - 5, 5, 1, gold.base); }
}

// A structure on a block of ground, as one sprite. o: { biome, h, arms }.
export function structureSprite(theme, o = {}) {
  const s = STRUCTURES[theme] || STRUCTURES.road;
  const p = new Px(SPRITE.w, SPRITE.h);
  ground(p, theme === 'throne' ? 'city' : o.biome || 'farm', o.h || 0, 77, { path: o.path });
  const [cx, cy] = centre(o.h || 0);
  s.draw(p, cx, cy, o);
  return p;
}
// The same picture in two layers, for a way ahead: its ground, and what stands on it. The way's highlight goes between
// them, so it lies on the ground, and whatever rises from the tile stands in front of it.
export function structureLayers(theme, o = {}) {
  const s = STRUCTURES[theme] || STRUCTURES.road;
  const base = new Px(SPRITE.w, SPRITE.h), top = new Px(SPRITE.w, SPRITE.h);
  ground(base, theme === 'throne' ? 'city' : o.biome || 'farm', o.h || 0, 77, { path: o.path });
  const [cx, cy] = centre(o.h || 0);
  s.draw(top, cx, cy, o);
  return { base, top };
}
export const fxOf = theme => STRUCTURES[theme]?.fx || [];
