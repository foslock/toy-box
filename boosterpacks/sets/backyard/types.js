// The six patches of the Backyard: each card's type. Each has colours for the card frame, a white icon, and a painter
// for the scene behind the item in the card's picture: a sky or backdrop, and the ground the item stands on.
import { mulberry } from '../../kit.js';
import { glow } from '../house/rooms.js';

const TAU = Math.PI * 2;

/* ---------- painting helpers ---------- */
const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; };
const rad = (g, x, y, r0, r1, stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; };
// Where the ground starts (the far edge) for a scene whose item stands at o.floor.
const horizon = (h, o, near = .15, full = .09) => o.floor - h * (o.full ? full : near);
function sky(g, w, top, stops) { g.fillStyle = lin(g, 0, 0, 0, top, stops); g.fillRect(0, 0, w, top); }
function cloud(g, x, y, s, a = .92) {
  g.save(); g.globalAlpha = a; g.fillStyle = '#ffffff';
  for (const [dx, dy, r] of [[-1.1, .15, .55], [-.5, -.2, .72], [.2, -.35, .85], [.9, -.05, .62], [1.4, .2, .45], [0, .2, .7]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(160,190,230,.35)'; g.fillRect(x - 1.6 * s, y + .3 * s, 3.2 * s, .35 * s);
  g.restore();
}
// Soft round blobs of foliage along a line (tree lines, hedges, canopies).
function foliage(g, w, y, R, size, colors, n = 16, jitter = .5) {
  for (let i = 0; i < n; i++) {
    const x = (i + R() * .8) / n * (w + size * 2) - size, r = size * (.6 + R() * .6);
    g.fillStyle = colors[i % colors.length]; g.beginPath(); g.arc(x, y - R() * size * jitter, r, 0, TAU); g.fill();
  }
}
function grassBlades(g, w, y0, y1, R, n, color, len) {
  g.save(); g.strokeStyle = color; g.lineWidth = Math.max(1, w / 520); g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const y = y0 + R() * (y1 - y0), depth = (y - y0) / Math.max(1, y1 - y0), l = len * (.4 + depth), x = R() * w;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (R() - .5) * l * .6, y - l * .6, x + (R() - .5) * l * .9, y - l); g.stroke();
  }
  g.restore();
}
function speckle(g, x, y, w, h, R, n, colors, size) {
  for (let i = 0; i < n; i++) { g.fillStyle = colors[i % colors.length]; const s = size * (.5 + R()); g.fillRect(x + R() * w, y + R() * h, s, s); }
}
// Mowing stripes: bands that run away from the viewer toward a point above the horizon.
function stripes(g, w, top, h, n, a, b) {
  const vx = w / 2, vy = top - h * .9;
  for (let i = -n; i < n * 2; i++) {
    const x0 = i * w / n, x1 = (i + 1) * w / n;
    const at = (x, y) => vx + (x - vx) * (y - vy) / (h - vy);
    g.fillStyle = i % 2 ? a : b;
    g.beginPath(); g.moveTo(at(x0, top), top); g.lineTo(at(x1, top), top); g.lineTo(x1, h); g.lineTo(x0, h); g.closePath(); g.fill();
  }
}

export const TYPES = {
  play: {
    name: 'Play', color: '#2f8ff0', light: '#e1efff', dark: '#0d4a8c', weak: 'critters', resist: 'patio',
    icon(g, x, y, r) { // a kite with a bow on its tail
      g.beginPath(); g.moveTo(x, y - r * .82); g.lineTo(x + r * .5, y - r * .2); g.lineTo(x, y + r * .42); g.lineTo(x - r * .5, y - r * .2); g.closePath(); g.fill();
      g.lineWidth = r * .09; g.strokeStyle = g.fillStyle; g.beginPath(); g.moveTo(x, y + r * .42);
      g.bezierCurveTo(x + r * .3, y + r * .55, x - r * .3, y + r * .7, x + r * .05, y + r * .86); g.stroke();
      for (const [bx, by] of [[x + r * .1, y + r * .58]]) { g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - r * .2, by - r * .1); g.lineTo(bx - r * .2, by + r * .12); g.closePath(); g.fill(); g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + r * .2, by - r * .1); g.lineTo(bx + r * .2, by + r * .12); g.closePath(); g.fill(); }
    },
    scene(g, w, h, o) { // a sunny lawn: bunting across the sky, a faint rainbow, mowing stripes
      const R = mulberry(o.seed), top = horizon(h, o, .2, .12);
      sky(g, w, top, [[0, '#3d9ef0'], [.65, '#9fd4fb'], [1, '#dff2ff']]);
      glow(g, w * .12, h * .04, w * .6, '#fff6c8', .9);
      g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = .28; g.lineWidth = w * .018;   // the rainbow
      ['#ff5a5a', '#ffb347', '#fff36b', '#6be27a', '#5ab8ff', '#9b7bff'].forEach((c, i) => { g.strokeStyle = c; g.beginPath(); g.arc(w * .62, top + h * .1, w * .62 - i * w * .018, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); });
      g.restore();
      for (let i = 0; i < 2; i++) cloud(g, w * (.2 + .55 * i + R() * .1), h * (.12 + R() * .1), w * (.05 + R() * .02));
      // bunting: two strings of little flags sagging across the top
      const flags = ['#ff5a5a', '#ffd23f', '#3fa7ff', '#5ad16a', '#ff8fc7', '#ffffff'];
      for (const [y0, sag, fs, off] of [[h * .05, h * .08, w * .045, 0], [h * .15, h * .06, w * .036, 3]]) {
        g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = Math.max(1, w / 400);
        g.beginPath(); g.moveTo(-10, y0); g.quadraticCurveTo(w / 2, y0 + sag * 2, w + 10, y0); g.stroke();
        for (let x = fs * .6, i = off; x < w; x += fs * 1.35, i++) {
          const t = x / w, y = (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * (y0 + sag * 2) + t * t * y0;
          g.fillStyle = flags[i % flags.length]; g.beginPath(); g.moveTo(x - fs / 2, y); g.lineTo(x + fs / 2, y); g.lineTo(x, y + fs * 1.15); g.closePath(); g.fill();
          g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + fs / 2, y); g.lineTo(x, y + fs * 1.15); g.closePath(); g.fill();
        }
      }
      foliage(g, w, top, R, w * .07, ['#3f8f45', '#4d9e4a', '#357a3b'], 14, .6);
      g.fillStyle = '#3a8340'; g.fillRect(0, top - 2, w, 3);
      stripes(g, w, top, h, 7, '#6fca52', '#5db946');
      g.fillStyle = lin(g, 0, top, 0, top + h * .06, [[0, 'rgba(20,60,20,.3)'], [1, 'rgba(20,60,20,0)']]); g.fillRect(0, top, w, h * .06);
      grassBlades(g, w, top + h * .02, h, R, 360, 'rgba(40,110,40,.45)', h * .025);
      for (let i = 0; i < 26; i++) {   // daisies
        const x = R() * w, y = top + h * .03 + R() * (h - top), s = w * (.004 + (y - top) / h * .012);
        g.fillStyle = '#ffffff'; for (let p = 0; p < 5; p++) { const a = p / 5 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * s, y + Math.sin(a) * s * .6, s * .7, 0, TAU); g.fill(); }
        g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x, y, s * .6, 0, TAU); g.fill();
      }
      glow(g, w / 2, o.floor - h * .3, h * .55, '#e8fbff', .5);
    },
  },
  sports: {
    name: 'Sports', color: '#e53945', light: '#ffe2e4', dark: '#7d1119', weak: 'garden', resist: 'play',
    icon(g, x, y, r) { // a baseball, in outline: the ball and its two seams
      g.lineWidth = r * .13; g.strokeStyle = g.fillStyle;
      g.beginPath(); g.arc(x, y, r * .7, 0, TAU); g.stroke();
      g.lineWidth = r * .1;
      g.beginPath(); g.arc(x - r * 1.04, y, r * .66, -.78, .78); g.stroke();
      g.beginPath(); g.arc(x + r * 1.04, y, r * .66, Math.PI - .78, Math.PI + .78); g.stroke();
    },
    scene(g, w, h, o) { // the backyard ball field: a chain-link fence in front of the trees, grass and a chalk line
      const R = mulberry(o.seed), top = horizon(h, o, .16, .1);
      sky(g, w, top, [[0, '#5aa9ec'], [.7, '#b7defa'], [1, '#e8f6ff']]);
      glow(g, w * .85, h * .02, w * .5, '#fff4d0', .8);
      cloud(g, w * (.25 + R() * .2), h * (.1 + R() * .06), w * .05, .85);
      foliage(g, w, top - h * .12, R, w * .09, ['#2f6f3a', '#3b7f42', '#28603a'], 12, .9);
      g.fillStyle = '#2d6a37'; g.fillRect(0, top - h * .12, w, h * .12);
      // chain-link fence: posts, rails and the diamond mesh
      const fy = top - h * (o.full ? .3 : .42), post = w * .014;
      g.save(); g.strokeStyle = 'rgba(210,218,226,.55)'; g.lineWidth = Math.max(1, w / 520);
      const m = w * (o.full ? .03 : .036);
      for (let x = -h; x < w + h; x += m) { g.beginPath(); g.moveTo(x, fy); g.lineTo(x + (top - fy), top); g.stroke(); g.beginPath(); g.moveTo(x, fy); g.lineTo(x - (top - fy), top); g.stroke(); }
      g.restore();
      for (let x = w * .08; x < w; x += w * .3) { g.fillStyle = lin(g, x, 0, x + post, 0, [[0, '#9aa3ad'], [.5, '#e6ebf0'], [1, '#8a939c']]); g.fillRect(x, fy - h * .02, post, top - fy + h * .02); }
      g.fillStyle = lin(g, 0, fy - post * .6, 0, fy + post * .6, [[0, '#e6ebf0'], [1, '#8a939c']]); g.fillRect(0, fy - post * .5, w, post);
      // grass, a dirt patch and a chalk line
      stripes(g, w, top, h, 6, '#5cb349', '#4fa53e');
      g.fillStyle = lin(g, 0, top, 0, top + h * .05, [[0, 'rgba(20,50,20,.35)'], [1, 'rgba(20,50,20,0)']]); g.fillRect(0, top, w, h * .05);
      g.fillStyle = 'rgba(196,140,90,.55)'; g.beginPath(); g.ellipse(w * .82, top + (h - top) * .35, w * .22, (h - top) * .16, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(2, w / 110); g.lineCap = 'round';
      g.beginPath(); g.moveTo(-w * .05, top + (h - top) * .75); g.quadraticCurveTo(w * .45, top + (h - top) * .08, w * 1.05, top + (h - top) * .2); g.stroke();
      grassBlades(g, w, top + h * .02, h, R, 300, 'rgba(30,90,30,.45)', h * .022);
      glow(g, w / 2, o.floor - h * .3, h * .55, '#fff3dc', .45);
    },
  },
  garden: {
    name: 'Garden', color: '#46a83c', light: '#e4f6dd', dark: '#1e5c17', weak: 'bugs', resist: 'sports',
    icon(g, x, y, r) { // a sprout: a stem and two leaves
      g.lineWidth = r * .14; g.strokeStyle = g.fillStyle; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y + r * .78); g.quadraticCurveTo(x - r * .06, y + r * .2, x, y - r * .1); g.stroke();
      const leaf = (a, s) => { g.save(); g.translate(x, y - r * .08); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * r * .2, -r * .42, s * r * .62, -r * .5, s * r * .78, -r * .44); g.bezierCurveTo(s * r * .66, -r * .12, s * r * .3, r * .04, 0, 0); g.fill(); g.restore(); };
      leaf(0, 1); leaf(0, -1);
    },
    scene(g, w, h, o) { // the vegetable patch: a trellis with climbing vines, and furrowed soil
      const R = mulberry(o.seed), top = horizon(h, o, .16, .1);
      sky(g, w, top, [[0, '#86c7f2'], [1, '#e2f4ff']]);
      glow(g, w * .8, h * .05, w * .5, '#fff6c8', .8);
      // wooden lattice
      const lt = top - h * .02, s = w * (o.full ? .085 : .1);
      g.save(); g.beginPath(); g.rect(0, h * .04, w, lt - h * .04); g.clip();
      g.fillStyle = 'rgba(120,80,40,.1)'; g.fillRect(0, h * .04, w, lt);
      g.lineWidth = w * .012;
      for (let x = -lt; x < w + lt; x += s) {
        g.strokeStyle = '#b98a56'; g.beginPath(); g.moveTo(x, h * .04); g.lineTo(x + lt, lt + h * .04); g.stroke();
        g.strokeStyle = '#c99a64'; g.beginPath(); g.moveTo(x + lt, h * .04); g.lineTo(x, lt + h * .04); g.stroke();
      }
      g.restore();
      g.fillStyle = '#a37443'; g.fillRect(0, h * .03, w, w * .02); g.fillRect(0, lt - w * .02, w, w * .02);
      // vines, leaves, flowers and a few ripe tomatoes
      for (let v = 0; v < 4; v++) {
        let x = w * (.08 + v * .27 + R() * .06), y = lt;
        g.strokeStyle = '#3e7d2a'; g.lineWidth = Math.max(1.5, w / 260); g.beginPath(); g.moveTo(x, y);
        const pts = [];
        for (let i = 0; i < 9; i++) { x += (R() - .5) * w * .07; y -= (lt - h * .06) / 9; g.lineTo(x, y); pts.push([x, y]); }
        g.stroke();
        for (const [px, py] of pts) {
          const ls = w * (.018 + R() * .012), a = R() * TAU;
          g.fillStyle = R() < .5 ? '#4c9a36' : '#5eae41'; g.beginPath(); g.ellipse(px + Math.cos(a) * ls, py + Math.sin(a) * ls * .6, ls, ls * .6, a, 0, TAU); g.fill();
          if (R() < .3) { g.fillStyle = '#ffe04d'; g.beginPath(); g.arc(px - ls * .6, py + ls * .4, ls * .35, 0, TAU); g.fill(); }
          if (R() < .22) { g.fillStyle = '#e8422f'; g.beginPath(); g.arc(px + ls * .5, py + ls * .9, ls * .55, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(px + ls * .35, py + ls * .75, ls * .15, 0, TAU); g.fill(); }
        }
      }
      // soil in furrows
      g.fillStyle = lin(g, 0, top, 0, h, [[0, '#5a3d27'], [1, '#6f4a2c']]); g.fillRect(0, top, w, h - top);
      const rows = 6;
      for (let r = 0; r < rows; r++) {
        const y0 = top + (h - top) * Math.pow(r / rows, 1.3), y1 = top + (h - top) * Math.pow((r + 1) / rows, 1.3);
        g.fillStyle = lin(g, 0, y0, 0, y1, [[0, 'rgba(255,220,180,.1)'], [.5, 'rgba(255,220,180,.02)'], [1, 'rgba(0,0,0,.28)']]); g.fillRect(0, y0, w, y1 - y0);
        if (r < 3) for (let x = w * .04 + R() * w * .05; x < w; x += w * (.07 + R() * .05)) {   // seedlings
          const sy = y0 + (y1 - y0) * .45, ss = w * .008 * (1 + r * .6);
          g.strokeStyle = '#5a9a3a'; g.lineWidth = Math.max(1, ss * .4); g.beginPath(); g.moveTo(x, sy); g.lineTo(x, sy - ss * 1.6); g.stroke();
          g.fillStyle = '#6cb846'; g.beginPath(); g.ellipse(x - ss * .8, sy - ss * 1.7, ss, ss * .5, -.4, 0, TAU); g.fill(); g.beginPath(); g.ellipse(x + ss * .8, sy - ss * 1.7, ss, ss * .5, .4, 0, TAU); g.fill();
        }
      }
      speckle(g, 0, top, w, h - top, R, 900, ['rgba(40,24,12,.35)', 'rgba(255,230,200,.12)', 'rgba(20,12,6,.3)'], Math.max(1, w / 300));
      glow(g, w / 2, o.floor - h * .3, h * .55, '#f4ffd8', .45);
    },
  },
  critters: {
    name: 'Critters', color: '#b0713a', light: '#f8ead9', dark: '#5e3813', weak: 'sports', resist: 'bugs',
    icon(g, x, y, r) { // a paw print
      g.beginPath(); g.ellipse(x, y + r * .3, r * .38, r * .32, 0, 0, TAU); g.fill();
      for (const [dx, dy, s] of [[-.52, -.12, .15], [-.2, -.5, .16], [.2, -.5, .16], [.52, -.12, .15]]) { g.beginPath(); g.ellipse(x + dx * r, y + dy * r, s * r, s * r * 1.25, dx * .6, 0, TAU); g.fill(); }
    },
    scene(g, w, h, o) { // the edge of the woods: tree trunks, dappled light, ferns and a leafy floor
      const R = mulberry(o.seed), top = horizon(h, o, .15, .09);
      g.fillStyle = lin(g, 0, 0, 0, top, [[0, '#4e7a3c'], [.6, '#8fb366'], [1, '#d7e6a6']]); g.fillRect(0, 0, w, top);
      glow(g, w * .7, top * .55, w * .6, '#fff2b8', .75);
      for (let i = 0; i < 7; i++) {   // trunks, the far ones paler
        const far = i < 3, x = R() * w, tw = w * (far ? .03 + R() * .02 : .06 + R() * .05);
        g.fillStyle = far ? 'rgba(110,100,80,.45)' : lin(g, x, 0, x + tw, 0, [[0, '#4a3a2a'], [.4, '#6d5a42'], [1, '#3a2c1e']]);
        g.fillRect(x, 0, tw, top + 2);
        if (!far) { g.strokeStyle = 'rgba(30,20,10,.35)'; g.lineWidth = Math.max(1, tw * .06); for (let j = 0; j < 8; j++) { const bx = x + R() * tw; g.beginPath(); g.moveTo(bx, R() * top); g.lineTo(bx + (R() - .5) * tw * .2, R() * top); g.stroke(); } }
      }
      foliage(g, w, h * .06, R, w * .12, ['rgba(40,80,30,.9)', 'rgba(60,100,40,.85)', 'rgba(30,64,24,.9)'], 10, .4);
      g.save(); g.globalCompositeOperation = 'screen';   // shafts of light
      for (let i = 0; i < 3; i++) { const x = w * (.2 + i * .3 + R() * .1); g.fillStyle = 'rgba(255,240,190,.13)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w * .08, 0); g.lineTo(x + w * .3, top); g.lineTo(x + w * .14, top); g.fill(); }
      g.restore();
      for (let i = 0; i < 7; i++) {   // ferns along the back of the ground
        const fx = R() * w, fy = top + h * .01, L = h * (.08 + R() * .06), dir = R() < .5 ? -1 : 1;
        g.strokeStyle = '#4f8a3a'; g.lineWidth = Math.max(1, w / 400);
        for (let f = 0; f < 3; f++) {
          const a = -Math.PI / 2 + (f - 1) * .55 + dir * .15, ex = fx + Math.cos(a) * L, ey = fy + Math.sin(a) * L;
          g.beginPath(); g.moveTo(fx, fy); g.quadraticCurveTo(fx + Math.cos(a) * L * .5, fy + Math.sin(a) * L * .7, ex, ey); g.stroke();
          for (let t = .15; t < 1; t += .12) { const px = fx + (ex - fx) * t, py = fy + (ey - fy) * t, ll = L * .16 * (1 - t * .7); g.fillStyle = '#5c9a44'; g.beginPath(); g.ellipse(px, py, ll, ll * .35, a + 1.2, 0, TAU); g.fill(); g.beginPath(); g.ellipse(px, py, ll, ll * .35, a - 1.2, 0, TAU); g.fill(); }
        }
      }
      g.fillStyle = lin(g, 0, top, 0, h, [[0, '#6a6a3a'], [.5, '#7a6440'], [1, '#5e4a2e']]); g.fillRect(0, top, w, h - top);
      for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(90,140,60,${.25 + R() * .25})`; g.beginPath(); g.ellipse(R() * w, top + R() * (h - top), w * (.04 + R() * .06), h * (.01 + R() * .02), 0, 0, TAU); g.fill(); }   // moss
      const leafC = ['#d9822b', '#e8b33a', '#b8472b', '#9a6a2a', '#c9a13e'];
      for (let i = 0; i < 70; i++) {   // fallen leaves
        const x = R() * w, y = top + R() * (h - top), d = (y - top) / (h - top), s = w * (.006 + d * .014), a = R() * TAU;
        g.fillStyle = leafC[i % leafC.length]; g.beginPath(); g.ellipse(x, y, s * 1.6, s * .7, a, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(80,40,10,.4)'; g.lineWidth = Math.max(.6, s * .12); g.beginPath(); g.moveTo(x - Math.cos(a) * s * 1.4, y - Math.sin(a) * s * 1.4); g.lineTo(x + Math.cos(a) * s * 1.4, y + Math.sin(a) * s * 1.4); g.stroke();
      }
      speckle(g, 0, top, w, h - top, R, 400, ['rgba(30,20,10,.3)', 'rgba(255,240,200,.12)'], Math.max(1, w / 320));
      glow(g, w / 2, o.floor - h * .3, h * .55, '#fff0c8', .45);
    },
  },
  bugs: {
    name: 'Bugs', color: '#8757d9', light: '#efe6ff', dark: '#43208a', weak: 'critters', resist: 'garden',
    icon(g, x, y, r) { // a butterfly
      for (const s of [-1, 1]) {
        g.beginPath(); g.ellipse(x + s * r * .38, y - r * .22, r * .36, r * .42, s * -.5, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(x + s * r * .3, y + r * .36, r * .24, r * .3, s * .5, 0, TAU); g.fill();
      }
      g.beginPath(); g.ellipse(x, y + r * .05, r * .09, r * .56, 0, 0, TAU); g.fill();
      g.lineWidth = r * .06; g.strokeStyle = g.fillStyle;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x, y - r * .45); g.quadraticCurveTo(x + s * r * .1, y - r * .75, x + s * r * .26, y - r * .84); g.stroke(); }
    },
    scene(g, w, h, o) { // a leaf, up close: soft bokeh behind and a big glossy leaf to stand on
      const R = mulberry(o.seed), top = horizon(h, o, .2, .12), t = top / h;
      g.fillStyle = lin(g, 0, 0, 0, h, [[0, '#4f9a3c'], [t * .6, '#8cc65a'], [t, '#cfe9a0'], [Math.min(1, t + .12), '#7fb85a'], [1, '#3f7d2c']]); g.fillRect(0, 0, w, h);
      g.save(); g.globalCompositeOperation = 'screen';
      for (let i = 0; i < 34; i++) {   // bokeh
        const x = R() * w, y = R() * h, r = w * (.02 + R() * .07), c = R() < .3 ? '255,240,170' : R() < .5 ? '210,255,170' : '255,255,255';
        g.fillStyle = rad(g, x, y, r * .6, r, [[0, `rgba(${c},${.12 + R() * .18})`], [1, `rgba(${c},0)`]]); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      g.restore();
      const fx = w * (R() < .5 ? .12 : .88), fy = top * .35, fr = w * .16;   // a blurry pink flower off to one side
      for (let p = 0; p < 6; p++) { const a = p / 6 * TAU; g.fillStyle = 'rgba(255,150,200,.35)'; g.beginPath(); g.ellipse(fx + Math.cos(a) * fr * .6, fy + Math.sin(a) * fr * .6, fr * .5, fr * .3, a, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,230,120,.5)'; g.beginPath(); g.arc(fx, fy, fr * .25, 0, TAU); g.fill();
      // the leaf: it fills the ground, its tip off in the distance, with a midrib and veins
      const cx = w * .5, tipY = top - h * .02;
      g.fillStyle = lin(g, 0, tipY, 0, h, [[0, '#6fbf3e'], [.5, '#4fa32f'], [1, '#3a8424']]);
      const leaf = () => { g.beginPath(); g.moveTo(cx, tipY); g.bezierCurveTo(w * 1.02, top + (h - top) * .2, w * 1.06, h * .98, cx, h * 1.15); g.bezierCurveTo(-w * .06, h * .98, -w * .02, top + (h - top) * .2, cx, tipY); };
      g.save(); g.shadowColor = 'rgba(20,50,10,.45)'; g.shadowBlur = w * .03; g.shadowOffsetY = w * .01; leaf(); g.fill(); g.restore();
      leaf(); g.fillStyle = lin(g, 0, tipY, 0, h, [[0, 'rgba(255,255,255,.3)'], [1, 'rgba(255,255,255,0)']]); g.fill();
      g.save(); leaf(); g.clip();
      g.strokeStyle = 'rgba(225,255,195,.6)'; g.lineWidth = Math.max(2, w / 160);
      g.beginPath(); g.moveTo(cx, tipY + h * .01); g.quadraticCurveTo(cx + w * .02, top + (h - top) * .5, cx - w * .01, h); g.stroke();
      g.lineWidth = Math.max(1, w / 360); g.strokeStyle = 'rgba(225,255,195,.3)';
      for (let i = 1; i < 9; i++) {
        const y = tipY + (h - tipY) * i / 9, spread = w * (.14 + i * .05);
        for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo(cx + sg * spread * .6, y - (h - top) * .03, cx + sg * spread, y - (h - top) * .12); g.stroke(); }
      }
      g.restore();
      leaf(); g.strokeStyle = 'rgba(40,110,30,.6)'; g.lineWidth = Math.max(1.5, w / 250); g.stroke();
      for (let i = 0; i < 7; i++) {   // dewdrops
        const x = w * (.1 + R() * .8), y = top + (h - top) * (.15 + R() * .8), r = w * (.006 + (y - top) / (h - top) * .016);
        g.fillStyle = 'rgba(20,70,20,.25)'; g.beginPath(); g.ellipse(x + r * .3, y + r * .5, r, r * .6, 0, 0, TAU); g.fill();
        g.fillStyle = rad(g, x - r * .3, y - r * .3, r * .1, r, [[0, 'rgba(255,255,255,.9)'], [.4, 'rgba(200,255,200,.35)'], [1, 'rgba(120,200,90,.5)']]); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      glow(g, w / 2, o.floor - h * .3, h * .55, '#f0ffd0', .45);
    },
  },
  patio: {
    name: 'Patio', color: '#f28a1c', light: '#fff0dc', dark: '#86430a', weak: 'bugs', resist: 'critters',
    icon(g, x, y, r) { // a sun
      g.beginPath(); g.arc(x, y, r * .4, 0, TAU); g.fill();
      g.lineWidth = r * .12; g.strokeStyle = g.fillStyle; g.lineCap = 'round';
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(x + Math.cos(a) * r * .56, y + Math.sin(a) * r * .56); g.lineTo(x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8); g.stroke(); }
    },
    scene(g, w, h, o) { // the deck at dusk: string lights over a wooden fence, and warm deck boards
      const R = mulberry(o.seed), top = horizon(h, o, .14, .09);
      sky(g, w, top, [[0, '#2f2a66'], [.45, '#8a4f8f'], [.8, '#f08a7a'], [1, '#ffc58a']]);
      for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(255,255,255,${.3 + R() * .5})`; g.beginPath(); g.arc(R() * w, R() * top * .35, Math.max(.8, w / 600), 0, TAU); g.fill(); }
      // a fence of boards across the back
      const fy = top - h * (o.full ? .2 : .3), bw = w * .075;
      for (let x = 0; x < w; x += bw) { g.fillStyle = lin(g, x, 0, x + bw, 0, [[0, '#8a5a34'], [.5, '#a06a3e'], [1, '#7a4c2a']]); g.fillRect(x + 1, fy, bw - 2, top - fy); }
      g.fillStyle = 'rgba(40,20,20,.35)'; g.fillRect(0, fy, w, top - fy);
      g.fillStyle = '#6a4226'; g.fillRect(0, fy + (top - fy) * .2, w, h * .012);
      // string lights: sagging wires with warm bulbs
      for (const [y0, sag, off] of [[h * .08, h * .07, 0], [h * .03, h * .1, .5]]) {
        g.strokeStyle = 'rgba(30,20,20,.8)'; g.lineWidth = Math.max(1, w / 500);
        g.beginPath(); g.moveTo(-5, y0); g.quadraticCurveTo(w / 2, y0 + sag * 2, w + 5, y0); g.stroke();
        for (let t = .04 + off * .05; t < 1; t += .1) {
          const x = t * w, y = (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * (y0 + sag * 2) + t * t * y0 + w * .012;
          glow(g, x, y, w * .06, '#ffcf70', .55);
          g.fillStyle = '#fff3c4'; g.beginPath(); g.ellipse(x, y, w * .008, w * .012, 0, 0, TAU); g.fill();
        }
      }
      // deck boards running away from the viewer
      g.fillStyle = lin(g, 0, top, 0, h, [[0, '#a8743f'], [1, '#c48a4c']]); g.fillRect(0, top, w, h - top);
      const vx = w / 2, vy = top - h * 1.2, n = 9;
      for (let i = -n; i <= n * 2; i++) {
        const xb = i * w / n, at = y => vx + (xb - vx) * (y - vy) / (h - vy);
        g.strokeStyle = 'rgba(70,40,15,.55)'; g.lineWidth = Math.max(1, w / 260); g.beginPath(); g.moveTo(at(top), top); g.lineTo(xb, h); g.stroke();
        g.strokeStyle = 'rgba(255,220,170,.12)'; g.lineWidth = Math.max(1, w / 500); g.beginPath(); g.moveTo(at(top) + 2, top); g.lineTo(xb + 3, h); g.stroke();
      }
      g.save(); g.globalAlpha = .1; g.strokeStyle = '#3a200c';
      for (let i = 0; i < 40; i++) { const y = top + R() * (h - top); g.lineWidth = .6 + R(); g.beginPath(); for (let x = 0; x <= w; x += 14) g.lineTo(x, y + Math.sin(x * .04 + i) * 1.5); g.stroke(); }
      g.restore();
      g.fillStyle = lin(g, 0, top, 0, top + h * .05, [[0, 'rgba(30,10,10,.4)'], [1, 'rgba(30,10,10,0)']]); g.fillRect(0, top, w, h * .05);
      glow(g, w / 2, o.floor - h * .3, h * .55, '#ffd6a0', .55);
    },
  },
};

// The set's symbol, printed in every card's footer: three pickets of fence.
export function fence(g, x, y, r) {
  for (const dx of [-.62, 0, .62]) { const px = x + dx * r; g.beginPath(); g.moveTo(px - r * .24, y + r * .9); g.lineTo(px - r * .24, y - r * .45); g.lineTo(px, y - r * .9); g.lineTo(px + r * .24, y - r * .45); g.lineTo(px + r * .24, y + r * .9); g.closePath(); g.fill(); }
  g.fillRect(x - r * .95, y - r * .12, r * 1.9, r * .22); g.fillRect(x - r * .95, y + r * .42, r * 1.9, r * .22);
}

export { mulberry };
