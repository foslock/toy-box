// The six sectors of Outer Space: each card's type. Each has colours for the card frame, a white icon, and a painter
// for the scene behind the item in the card's picture. This set leans high-tech: night skies and starfields, glowing
// holographic floors and heads-up-display lines. It also prints faint circuitry on its card panels (circuit), a ringed
// planet in each card's footer (planet) and a starfield with orbit rings on its pack wrappers (wrapperArt).
import { mulberry, hashString } from '../../kit.js';
import { glow } from '../house/rooms.js';

const TAU = Math.PI * 2;

/* ---------- painting helpers ---------- */
const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; };
const rad = (g, x, y, r0, r1, stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; };
// Where the ground starts (the far edge) for a scene whose item stands at o.floor.
const horizon = (h, o, near = .15, full = .09) => o.floor - h * (o.full ? full : near);
// Stars: mostly pinpricks, a few bright ones with a cross of light.
function starfield(g, w, y0, y1, R, n, tint = '255,255,255') {
  g.save();
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = y0 + R() * (y1 - y0), b = R(), s = Math.max(.6, w / 900) * (b > .97 ? 2.2 : b > .85 ? 1.4 : .8);
    g.fillStyle = `rgba(${R() < .15 ? '190,215,255' : R() < .1 ? '255,220,190' : tint},${.35 + b * .6})`;
    g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    if (b > .97) { g.globalAlpha = .5; g.fillRect(x - s * 5, y - s * .18, s * 10, s * .36); g.fillRect(x - s * .18, y - s * 5, s * .36, s * 10); g.globalAlpha = 1; }
  }
  g.restore();
}
// Soft coloured clouds of gas, added on like light.
function nebula(g, w, h, R, colors, n = 7, size = .5) {
  g.save(); g.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) { const x = R() * w, y = R() * h * .8, r = w * size * (.4 + R() * .6), c = colors[i % colors.length]; g.fillStyle = rad(g, x, y, 0, r, [[0, c], [1, 'rgba(0,0,0,0)']]); g.fillRect(x - r, y - r, r * 2, r * 2); }
  g.restore();
}
// A glowing perspective grid running from the horizon (top) to the bottom edge.
function holoGrid(g, w, top, h, color, cols = 14, rows = 9) {
  const vx = w / 2, vy = top - (h - top) * .9;
  g.save(); g.globalCompositeOperation = 'screen'; g.strokeStyle = color; g.lineCap = 'round';
  for (let i = -cols; i <= cols * 2; i++) {   // lines running away from the viewer, meeting far above the horizon
    const xb = i * w / cols, at = y => vx + (xb - vx) * (y - vy) / (h - vy);
    g.globalAlpha = .55; g.lineWidth = Math.max(1, w / 420); g.beginPath(); g.moveTo(at(top), top); g.lineTo(xb, h); g.stroke();
  }
  for (let r = 0; r <= rows; r++) {   // cross lines, bunching up toward the horizon
    const y = top + (h - top) * Math.pow(r / rows, 1.8);
    g.globalAlpha = .25 + .5 * r / rows; g.lineWidth = Math.max(1, w / 520) * (1 + r / rows); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
  }
  g.restore();
}
// A glowing ring on the floor for the item to stand on, with tick marks round it like a dial.
function pad(g, w, h, o, color, size = .34) {
  const cx = w / 2, cy = o.floor - h * .005, rx = w * size, ry = rx * (o.full ? .2 : .24);
  g.save();
  g.fillStyle = rad(g, cx, cy, 0, rx, [[0, 'rgba(255,255,255,.12)'], [1, 'rgba(255,255,255,0)']]); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
  g.globalCompositeOperation = 'screen'; g.strokeStyle = color;
  for (const [k, a, lw] of [[1, .9, 2.2], [.82, .45, 1.2], [1.12, .3, 1]]) { g.globalAlpha = a; g.lineWidth = Math.max(1, w / 360) * lw; g.beginPath(); g.ellipse(cx, cy, rx * k, ry * k, 0, 0, TAU); g.stroke(); }
  g.globalAlpha = .7; g.lineWidth = Math.max(1, w / 500);
  for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, l = i % 6 ? .05 : .11; g.beginPath(); g.moveTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); g.lineTo(cx + Math.cos(a) * rx * (1 + l), cy + Math.sin(a) * ry * (1 + l)); g.stroke(); }
  g.restore();
  glow(g, cx, cy, rx * 1.1, color, .35);
}
// Heads-up-display brackets in the corners, and a scale of ticks down one side.
function hud(g, w, h, color, a = .5) {
  const m = w * .05, l = w * .07;
  g.save(); g.strokeStyle = color; g.globalAlpha = a; g.lineWidth = Math.max(1.2, w / 380); g.lineCap = 'square';
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [w - m, m, -1, 1]]) { g.beginPath(); g.moveTo(x, y + sy * l); g.lineTo(x, y); g.lineTo(x + sx * l, y); g.stroke(); }
  g.globalAlpha = a * .7; g.lineWidth = Math.max(1, w / 600);
  for (let i = 0; i < 12; i++) { const y = h * .16 + i * h * .035, t = i % 4 ? w * .012 : w * .026; g.beginPath(); g.moveTo(w - m, y); g.lineTo(w - m - t, y); g.stroke(); }
  g.restore();
}

export const TYPES = {
  launch: {
    name: 'Launch', color: '#ff4d3d', light: '#ffe4e0', dark: '#7f160c', weak: 'rocks', resist: 'worlds',
    icon(g, x, y, r) { // a rocket: body, nose, fins and a flame
      g.beginPath(); g.moveTo(x, y - r * .9); g.bezierCurveTo(x + r * .34, y - r * .6, x + r * .26, y + r * .1, x + r * .22, y + r * .42); g.lineTo(x - r * .22, y + r * .42); g.bezierCurveTo(x - r * .26, y + r * .1, x - r * .34, y - r * .6, x, y - r * .9); g.fill();
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x + s * r * .2, y + r * .02); g.lineTo(x + s * r * .5, y + r * .5); g.lineTo(x + s * r * .2, y + r * .4); g.closePath(); g.fill(); }
      g.beginPath(); g.moveTo(x - r * .13, y + r * .5); g.quadraticCurveTo(x, y + r * 1.05, x + r * .13, y + r * .5); g.fill();
    },
    scene(g, w, h, o) { // the launch pad at night: a gantry tower, searchlights, steam, and a concrete pad
      const R = mulberry(o.seed), top = horizon(h, o, .17, .1);
      g.fillStyle = lin(g, 0, 0, 0, top, [[0, '#030716'], [.55, '#0d1f45'], [.85, '#1d4b6e'], [1, '#e08a4a']]); g.fillRect(0, 0, w, top);
      starfield(g, w, 0, top * .75, R, 160);
      glow(g, w * .5, top, w * .8, '#ff9a55', .45);
      g.save(); g.globalCompositeOperation = 'screen';   // searchlight beams sweeping up from the pad
      for (const [x0, a] of [[.12, -.35], [.88, .3], [.3, .12]]) {
        const bx = w * x0, by = top, len = h * 1.1, sp = .09;
        g.fillStyle = lin(g, bx, by, bx + Math.sin(a) * len, by - Math.cos(a) * len, [[0, 'rgba(200,230,255,.3)'], [1, 'rgba(200,230,255,0)']]);
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.sin(a - sp) * len, by - Math.cos(a - sp) * len); g.lineTo(bx + Math.sin(a + sp) * len, by - Math.cos(a + sp) * len); g.fill();
      }
      g.restore();
      // the gantry: a lattice tower off to one side, with red warning lights up it
      const side = R() < .5 ? -1 : 1, gx = w / 2 + side * w * .36, gw = w * .085, gt = h * .06;
      g.fillStyle = '#0a0f1c'; g.fillRect(gx - gw / 2, gt, gw, top - gt);
      g.strokeStyle = '#1c2a44'; g.lineWidth = Math.max(1, w / 420);
      for (let y = gt; y < top; y += gw) { g.beginPath(); g.moveTo(gx - gw / 2, y); g.lineTo(gx + gw / 2, y + gw); g.moveTo(gx + gw / 2, y); g.lineTo(gx - gw / 2, y + gw); g.stroke(); }
      for (let y = gt + gw * .5; y < top; y += gw * 2) { g.fillStyle = '#1c2a44'; g.fillRect(gx - side * gw / 2, y, -side * w * .06, h * .008); }   // swing arms
      for (let y = gt; y < top; y += gw * 2.4) { glow(g, gx, y, w * .03, '#ff3322', .9); g.fillStyle = '#ff6a55'; g.beginPath(); g.arc(gx, y, Math.max(1.5, w / 300), 0, TAU); g.fill(); }
      // steam and smoke drifting low across the pad
      g.save();
      for (let i = 0; i < 16; i++) { const x = R() * w, y = top - h * (.01 + R() * .05), r = w * (.05 + R() * .07); g.fillStyle = rad(g, x, y, 0, r, [[0, 'rgba(230,236,245,.5)'], [1, 'rgba(230,236,245,0)']]); g.fillRect(x - r, y - r, r * 2, r * 2); }
      g.restore();
      // the pad: concrete slabs in perspective, with a band of hazard stripes along the back
      g.fillStyle = lin(g, 0, top, 0, h, [[0, '#4a4f5a'], [1, '#6b7079']]); g.fillRect(0, top, w, h - top);
      const band = h * (o.full ? .012 : .02);
      g.save(); g.beginPath(); g.rect(0, top, w, band); g.clip();
      g.fillStyle = '#f2c230'; g.fillRect(0, top, w, band); g.fillStyle = '#1b1b1b';
      for (let x = -band * 2; x < w; x += band * 2) { g.beginPath(); g.moveTo(x, top + band); g.lineTo(x + band, top); g.lineTo(x + band * 2, top); g.lineTo(x + band, top + band); g.fill(); }
      g.restore();
      const vx = w / 2, vy = top - h * 1.1;
      g.strokeStyle = 'rgba(20,24,32,.55)'; g.lineWidth = Math.max(1, w / 400);
      for (let i = -8; i <= 16; i++) { const xb = i * w / 8, at = y => vx + (xb - vx) * (y - vy) / (h - vy); g.beginPath(); g.moveTo(at(top + band), top + band); g.lineTo(xb, h); g.stroke(); }
      for (let r = 1; r < 7; r++) { const y = top + band + (h - top) * Math.pow(r / 7, 1.6); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 500; i++) g.fillRect(R() * w, top + R() * (h - top), 1.5, 1.5);
      // a painted landing mark under the item, and the glow of the lights on the pad
      g.save(); g.strokeStyle = 'rgba(255,214,90,.75)'; g.lineWidth = Math.max(2, w / 150);
      g.beginPath(); g.ellipse(w / 2, o.floor, w * .3, w * .3 * (o.full ? .17 : .22), 0, 0, TAU); g.stroke(); g.restore();
      glow(g, w / 2, o.floor - h * .3, h * .55, '#ffd9b0', .45);
    },
  },
  orbit: {
    name: 'Orbit', color: '#2e7bff', light: '#e0ebff', dark: '#0b347e', weak: 'stars', resist: 'launch',
    icon(g, x, y, r) { // a satellite: a body with two solar wings and a dish
      g.fillRect(x - r * .2, y - r * .2, r * .4, r * .4);
      for (const s of [-1, 1]) {   // a solar wing on each side: an arm and three cells
        g.fillRect(Math.min(x + s * r * .2, x + s * r * .3), y - r * .03, r * .1, r * .06);
        for (let k = 0; k < 3; k++) { const x0 = x + s * (r * .3 + k * r * .2); g.fillRect(Math.min(x0, x0 + s * r * .17), y - r * .26, r * .17, r * .52); }
      }
      g.beginPath(); g.arc(x, y - r * .5, r * .2, Math.PI * .1, Math.PI * .9, true); g.fill(); g.fillRect(x - r * .03, y - r * .5, r * .06, r * .3);
    },
    scene(g, w, h, o) { // high above the Earth: its curved edge and blue air below, black sky and a docking ring to stand on
      const R = mulberry(o.seed), top = horizon(h, o, .22, .14);
      g.fillStyle = '#01030b'; g.fillRect(0, 0, w, h);
      starfield(g, w, 0, h * .7, R, 220);
      // the Earth: a huge disc below, with cloud swirls, and its thin blue air glowing along the edge
      const er = w * 2.2, ex = w * (.5 + (R() - .5) * .3), ey = top + er * .985;
      g.save(); g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.clip();
      g.fillStyle = lin(g, 0, top - h * .05, 0, h, [[0, '#2f7fd6'], [.3, '#1c56a8'], [1, '#08204d']]); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) { const x = R() * w, y = top + R() * (h - top), rx = w * (.05 + R() * .16); g.fillStyle = `rgba(255,255,255,${.12 + R() * .3})`; g.beginPath(); g.ellipse(x, y, rx, rx * .18, (R() - .5) * .3, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(80,140,70,.35)'; g.beginPath(); g.ellipse(w * (R() < .5 ? .2 : .8), top + (h - top) * .45, w * .2, (h - top) * .15, .2, 0, TAU); g.fill();
      g.restore();
      g.save(); g.globalCompositeOperation = 'screen';
      for (const [k, c, lw] of [[1.004, 'rgba(120,200,255,.9)', w / 90], [1.012, 'rgba(60,140,255,.4)', w / 35], [1.03, 'rgba(40,100,255,.15)', w / 12]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.arc(ex, ey, er * k, Math.PI * 1.25, Math.PI * 1.75); g.stroke(); }
      g.restore();
      // the Sun just off the edge of the Earth
      const sx = R() < .5 ? w * .1 : w * .9;
      glow(g, sx, top - h * .02, w * .45, '#fff1c8', .9); glow(g, sx, top - h * .02, w * .1, '#ffffff', 1);
      pad(g, w, h, o, '#6fd0ff');
      hud(g, w, h, '#8fd8ff', .45);
      glow(g, w / 2, o.floor - h * .3, h * .55, '#cfe6ff', .35);
    },
  },
  crew: {
    name: 'Crew', color: '#ff9a1f', light: '#fff0dc', dark: '#80420a', weak: 'stars', resist: 'rocks',
    icon(g, x, y, r) { // an astronaut's helmet, with its visor
      g.lineWidth = r * .16; g.strokeStyle = g.fillStyle;
      g.beginPath(); g.arc(x, y - r * .1, r * .64, 0, TAU); g.stroke();                              // the shell
      g.beginPath(); g.ellipse(x, y - r * .1, r * .42, r * .3, 0, 0, TAU); g.fill();                  // the visor
      g.fillRect(x - r * .52, y + r * .52, r * 1.04, r * .26);                                       // the neck ring
    },
    scene(g, w, h, o) { // inside the space station: white wall panels, handrails, a porthole onto the Earth and a grated deck
      const R = mulberry(o.seed), top = horizon(h, o, .15, .09);
      g.fillStyle = lin(g, 0, 0, 0, top, [[0, '#c9d1dc'], [1, '#e8edf3']]); g.fillRect(0, 0, w, top);
      // panels: a grid of soft white padded squares with a seam round each
      const pw = w * (o.full ? .19 : .22), ph = top * .36;
      for (let y = -ph * .3, row = 0; y < top; y += ph, row++) for (let x = -pw * (row % 2) * .5; x < w; x += pw) {
        g.fillStyle = lin(g, 0, y, 0, y + ph, [[0, '#f4f6fa'], [1, '#d6dde7']]); g.beginPath(); g.roundRect(x + 3, y + 3, pw - 6, ph - 6, w * .012); g.fill();
        g.strokeStyle = 'rgba(80,90,110,.25)'; g.lineWidth = 1; g.stroke();
        if (R() < .35) { g.fillStyle = ['#3d7bff', '#ffb020', '#ff4d3d', '#2bbf7a'][Math.floor(R() * 4)]; g.fillRect(x + pw * .12, y + ph * .72, pw * .3, ph * .06); }
        if (R() < .3) for (let k = 0; k < 3; k++) { const on = R() < .6, c = ['#40ff90', '#ff5a4a', '#ffd23f'][k]; if (on) glow(g, x + pw * (.62 + k * .09), y + ph * .2, w * .015, c, .9); g.fillStyle = on ? c : '#9aa4b2'; g.beginPath(); g.arc(x + pw * (.62 + k * .09), y + ph * .2, Math.max(1.4, w / 350), 0, TAU); g.fill(); }
      }
      // a porthole with the Earth outside
      const px = w * (R() < .5 ? .2 : .8), py = top * .42, pr = w * (o.full ? .12 : .1);
      g.fillStyle = lin(g, px - pr * 1.3, py, px + pr * 1.3, py, [[0, '#8a93a1'], [.5, '#e6eaf0'], [1, '#7a8391']]); g.beginPath(); g.arc(px, py, pr * 1.3, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(px, py, pr, 0, TAU); g.clip();
      g.fillStyle = '#02040c'; g.fillRect(px - pr, py - pr, pr * 2, pr * 2); starfield(g, w, py - pr, py + pr, R, 20);
      g.fillStyle = lin(g, 0, py - pr * .1, 0, py + pr, [[0, '#4aa0ff'], [1, '#12357a']]); g.beginPath(); g.arc(px + pr * .4, py + pr * 1.6, pr * 1.8, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(px, py + pr * .35, pr * .5, pr * .08, -.2, 0, TAU); g.fill();
      g.fillStyle = lin(g, px - pr, py - pr, px + pr, py + pr, [[0, 'rgba(255,255,255,.25)'], [.5, 'rgba(255,255,255,0)']]); g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      g.restore();
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.fillStyle = '#5a6270'; g.beginPath(); g.arc(px + Math.cos(a) * pr * 1.15, py + Math.sin(a) * pr * 1.15, Math.max(1.5, w / 300), 0, TAU); g.fill(); }
      // handrails along the wall, and a bundle of cables
      for (const [y, c] of [[top * .78, '#ffcf3a'], [top * .12, '#3d7bff']]) { g.fillStyle = lin(g, 0, y - h * .012, 0, y + h * .012, [[0, c], [1, 'rgba(0,0,0,.35)']]); g.fillRect(0, y - h * .01, w, h * .02); for (let x = w * .1; x < w; x += w * .3) { g.fillStyle = '#8a93a1'; g.fillRect(x, y - h * .01, w * .02, h * .03); } }
      g.strokeStyle = 'rgba(40,46,58,.55)'; g.lineWidth = Math.max(1.5, w / 260);
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(0, top * (.9 - k * .02)); g.bezierCurveTo(w * .3, top * (.96 - k * .02), w * .7, top * (.84 - k * .02), w, top * (.92 - k * .02)); g.stroke(); }
      // the deck: grey plates with a grip pattern, in perspective
      g.fillStyle = lin(g, 0, top, 0, h, [[0, '#7c8594'], [1, '#a4acb8']]); g.fillRect(0, top, w, h - top);
      const vx = w / 2, vy = top - h * 1.1;
      g.strokeStyle = 'rgba(40,46,58,.45)'; g.lineWidth = Math.max(1, w / 360);
      for (let i = -6; i <= 12; i++) { const xb = i * w / 6, at = y => vx + (xb - vx) * (y - vy) / (h - vy); g.beginPath(); g.moveTo(at(top), top); g.lineTo(xb, h); g.stroke(); }
      for (let r = 1; r < 6; r++) { const y = top + (h - top) * Math.pow(r / 6, 1.5); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.18)';
      for (let i = 0; i < 260; i++) { const y = top + R() * (h - top), d = (y - top) / (h - top), s = w * (.002 + d * .005); g.save(); g.translate(R() * w, y); g.rotate(i % 2 ? .6 : -.6); g.fillRect(-s * 1.5, -s * .4, s * 3, s * .8); g.restore(); }
      g.fillStyle = lin(g, 0, top, 0, top + h * .05, [[0, 'rgba(20,24,32,.35)'], [1, 'rgba(20,24,32,0)']]); g.fillRect(0, top, w, h * .05);
      glow(g, w / 2, o.floor - h * .3, h * .55, '#fff3e0', .45);
    },
  },
  worlds: {
    name: 'Worlds', color: '#12b3a0', light: '#dcf7f3', dark: '#075a50', weak: 'rocks', resist: 'crew',
    icon(g, x, y, r) { // a planet with a small moon
      g.beginPath(); g.arc(x - r * .1, y + r * .1, r * .52, 0, TAU); g.fill();
      g.beginPath(); g.arc(x + r * .6, y - r * .58, r * .18, 0, TAU); g.fill();
      g.lineWidth = r * .07; g.strokeStyle = g.fillStyle;
      g.beginPath(); g.arc(x - r * .1, y + r * .1, r * .9, -Math.PI * .62, Math.PI * .1); g.stroke();
    },
    scene(g, w, h, o) { // a holographic planetarium: deep space with glowing gas clouds, over a grid of light
      const R = mulberry(o.seed), top = horizon(h, o, .2, .13);
      g.fillStyle = lin(g, 0, 0, 0, top, [[0, '#040716'], [1, '#0a1b33']]); g.fillRect(0, 0, w, top);
      nebula(g, w, top, R, ['rgba(30,200,180,.45)', 'rgba(120,70,255,.4)', 'rgba(255,90,170,.28)', 'rgba(40,120,255,.35)'], 8, .45);
      starfield(g, w, 0, top, R, 200);
      for (let i = 0; i < 2; i++) {   // two little distant worlds, up in the corners, clear of the item (it may be a planet too)
        const x = i ? w * (.86 + R() * .08) : w * (.06 + R() * .08), y = top * (.08 + R() * .22), r = w * (.008 + R() * .012), c = ['#f2a86b', '#8ad6ff', '#d6c8ff', '#ff8f8f'][Math.floor(R() * 4)];
        g.fillStyle = rad(g, x - r * .35, y - r * .35, r * .1, r, [[0, '#ffffff'], [.25, c], [1, 'rgba(10,20,40,1)']]); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        if (R() < .4) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = Math.max(1, r * .15); g.beginPath(); g.ellipse(x, y, r * 1.8, r * .45, -.3, 0, TAU); g.stroke(); }
      }
      // the floor: a dark glass table with a teal grid of light, fading up into the distance
      g.fillStyle = lin(g, 0, top, 0, h, [[0, '#06222a'], [1, '#021015']]); g.fillRect(0, top, w, h - top);
      holoGrid(g, w, top, h, '#2cf0d8');
      g.fillStyle = lin(g, 0, top - h * .03, 0, top + h * .04, [[0, 'rgba(44,240,216,0)'], [.5, 'rgba(44,240,216,.35)'], [1, 'rgba(44,240,216,0)']]); g.fillRect(0, top - h * .03, w, h * .07);
      pad(g, w, h, o, '#5ff7e4', .3);
      hud(g, w, h, '#7ff7e8', .4);
      glow(g, w / 2, o.floor - h * .3, h * .55, '#d8fff8', .35);
    },
  },
  stars: {
    name: 'Stars', color: '#8a4dff', light: '#eee4ff', dark: '#3c1591', weak: 'worlds', resist: 'orbit',
    icon(g, x, y, r) { // a bright star, four points and a sparkle
      const star = (cx, cy, s) => { g.beginPath(); g.moveTo(cx, cy - s); g.quadraticCurveTo(cx, cy, cx + s, cy); g.quadraticCurveTo(cx, cy, cx, cy + s); g.quadraticCurveTo(cx, cy, cx - s, cy); g.quadraticCurveTo(cx, cy, cx, cy - s); g.fill(); };
      star(x - r * .1, y + r * .1, r * .78); star(x + r * .55, y - r * .55, r * .28);
    },
    scene(g, w, h, o) { // the observatory: the Milky Way across a sky full of stars, over a mirror-black floor with a star map
      const R = mulberry(o.seed), top = horizon(h, o, .18, .12);
      g.fillStyle = lin(g, 0, 0, 0, top, [[0, '#07031a'], [1, '#1a0b3a']]); g.fillRect(0, 0, w, top);
      // the Milky Way: a soft band of light across the sky, with dark dust lanes along it
      g.save(); g.translate(w / 2, top * .45); g.rotate(-.5);
      g.fillStyle = lin(g, 0, -h * .2, 0, h * .2, [[0, 'rgba(180,150,255,0)'], [.5, 'rgba(210,190,255,.35)'], [1, 'rgba(180,150,255,0)']]); g.fillRect(-w, -h * .2, w * 2, h * .4);
      g.globalCompositeOperation = 'screen'; for (let i = 0; i < 260; i++) { const x = (R() - .5) * w * 2, y = (R() - .5) * (R() - .5) * h * .5; g.fillStyle = `rgba(255,255,255,${.2 + R() * .5})`; g.fillRect(x, y, 1.2, 1.2); }
      g.globalCompositeOperation = 'source-over'; for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(10,4,24,.35)'; g.beginPath(); g.ellipse((R() - .5) * w * 1.6, (R() - .5) * h * .06, w * (.08 + R() * .12), h * .012, 0, 0, TAU); g.fill(); }
      g.restore();
      nebula(g, w, top, R, ['rgba(160,90,255,.35)', 'rgba(255,110,200,.2)'], 3, .4);
      starfield(g, w, 0, top, R, 260);
      // a constellation drawn over the sky in thin lines
      g.save(); g.strokeStyle = 'rgba(200,180,255,.45)'; g.lineWidth = Math.max(1, w / 500); g.fillStyle = '#ffffff';
      let px = w * (.08 + R() * .2), py = top * (.15 + R() * .2); g.beginPath(); g.moveTo(px, py);
      const pts = [[px, py]]; for (let i = 0; i < 5; i++) { px += w * (.08 + R() * .1); py += top * (R() - .45) * .25; g.lineTo(px, py); pts.push([px, py]); }
      g.stroke(); for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, Math.max(1.5, w / 280), 0, TAU); g.fill(); glow(g, x, y, w * .02, '#ffffff', .6); }
      g.restore();
      // the floor: black glass reflecting the sky, with a star map's rings and spokes round the item
      g.fillStyle = lin(g, 0, top, 0, h, [[0, '#1a0f33'], [1, '#05020c']]); g.fillRect(0, top, w, h - top);
      g.save(); g.globalAlpha = .35; g.translate(0, top * 2); g.scale(1, -1); g.beginPath(); g.rect(0, top, w, top); g.clip();
      g.fillStyle = 'rgba(200,180,255,.25)'; for (let i = 0; i < 80; i++) g.fillRect(R() * w, top + R() * top * .4, 1.2, 1.2);
      g.restore();
      const cx = w / 2, cy = o.floor, rx = w * .46, ry = rx * (o.full ? .18 : .22);
      g.save(); g.globalCompositeOperation = 'screen'; g.strokeStyle = '#b89cff'; g.lineWidth = Math.max(1, w / 450);
      for (const k of [.35, .6, .85, 1.1]) { g.globalAlpha = .45; g.beginPath(); g.ellipse(cx, cy, rx * k, ry * k, 0, 0, TAU); g.stroke(); }
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.globalAlpha = .3; g.beginPath(); g.moveTo(cx + Math.cos(a) * rx * .35, cy + Math.sin(a) * ry * .35); g.lineTo(cx + Math.cos(a) * rx * 1.1, cy + Math.sin(a) * ry * 1.1); g.stroke(); }
      g.restore();
      hud(g, w, h, '#c8b4ff', .35);
      glow(g, w / 2, o.floor - h * .3, h * .55, '#e8dcff', .4);
    },
  },
  rocks: {
    name: 'Rocks', color: '#6f7f99', light: '#e7ebf2', dark: '#2f3a4d', weak: 'launch', resist: 'stars',
    icon(g, x, y, r) { // a lumpy asteroid with craters
      const pts = [[-.7, -.1], [-.5, -.55], [-.05, -.72], [.45, -.55], [.72, -.1], [.6, .4], [.2, .68], [-.35, .62], [-.68, .3]];
      g.lineWidth = r * .14; g.strokeStyle = g.fillStyle; g.lineJoin = 'round';
      g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(x + px * r, y + py * r) : g.moveTo(x + px * r, y + py * r)); g.closePath(); g.stroke();
      for (const [cx, cy, cr] of [[-.2, -.18, .17], [.26, .14, .13], [-.08, .36, .09]]) { g.beginPath(); g.arc(x + cx * r, y + cy * r, cr * r, 0, TAU); g.fill(); }
    },
    scene(g, w, h, o) { // out in the asteroid belt: drifting rocks and dust, over a cratered grey surface
      const R = mulberry(o.seed), top = horizon(h, o, .17, .1);
      g.fillStyle = lin(g, 0, 0, 0, top, [[0, '#05060c'], [1, '#161a26']]); g.fillRect(0, 0, w, top);
      starfield(g, w, 0, top, R, 150);
      const sx = w * (R() < .5 ? .15 : .85);
      glow(g, sx, top * .3, w * .5, '#ffe2b0', .6); glow(g, sx, top * .3, w * .06, '#ffffff', 1);
      g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = lin(g, 0, top * .3, 0, top, [[0, 'rgba(160,150,140,0)'], [1, 'rgba(160,150,140,.25)']]); g.fillRect(0, 0, w, top); g.restore();
      // tumbling rocks at every distance, lit from the Sun's side
      for (let i = 0; i < 22; i++) {
        const x = R() * w, y = R() * top * .95, far = R(), r = w * (far < .7 ? .005 + R() * .012 : .02 + R() * .035), lit = sx < w / 2 ? -1 : 1;
        g.save(); g.translate(x, y); g.rotate(R() * TAU);
        g.beginPath(); for (let k = 0; k < 9; k++) { const a = k / 9 * TAU, rr = r * (.75 + R() * .4); k ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * .8) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr * .8); } g.closePath();
        g.fillStyle = rad(g, lit * r * .4, -r * .4, r * .1, r * 1.3, [[0, far < .7 ? '#6a6660' : '#9a948a'], [1, '#1a1a1e']]); g.fill();
        g.restore();
      }
      // the ground: grey dust with craters, darker toward the front
      g.fillStyle = lin(g, 0, top, 0, h, [[0, '#8a8680'], [1, '#5d5a55']]); g.fillRect(0, top, w, h - top);
      for (let i = 0; i < 18; i++) {
        const y = top + (h - top) * Math.pow(R(), 1.3), d = (y - top) / (h - top), x = R() * w, rx = w * (.02 + R() * .06) * (.4 + d), ry = rx * (.18 + d * .12);
        g.fillStyle = 'rgba(40,38,36,.35)'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,250,240,.18)'; g.beginPath(); g.ellipse(x, y + ry * .25, rx * .92, ry * .75, 0, 0, Math.PI); g.fill();
        g.strokeStyle = 'rgba(200,196,188,.35)'; g.lineWidth = Math.max(1, rx * .08); g.beginPath(); g.ellipse(x, y, rx * 1.05, ry * 1.1, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      }
      for (let i = 0; i < 700; i++) { const y = top + R() * (h - top), d = (y - top) / (h - top), s = Math.max(1, w / 500) * (.5 + d * 2) * R(); g.fillStyle = R() < .5 ? 'rgba(30,28,26,.4)' : 'rgba(255,250,240,.2)'; g.fillRect(R() * w, y, s, s); }
      g.fillStyle = lin(g, 0, top - h * .01, 0, top + h * .03, [[0, 'rgba(180,176,168,0)'], [.5, 'rgba(180,176,168,.35)'], [1, 'rgba(180,176,168,0)']]); g.fillRect(0, top - h * .01, w, h * .04);
      glow(g, w / 2, o.floor - h * .3, h * .55, '#f4ece0', .4);
    },
  },
};

// The set's symbol, printed in every card's footer: a planet with a ring round it.
export function planet(g, x, y, r) {
  g.beginPath(); g.arc(x, y, r * .56, 0, TAU); g.fill();
  g.save(); g.lineWidth = r * .18; g.strokeStyle = g.fillStyle;
  g.beginPath(); g.ellipse(x, y, r * 1.08, r * .34, -.35, 0, TAU); g.stroke();
  g.restore();
}

// Card panels in this set carry faint circuitry instead of stripes: traces that turn at right angles and end in pads.
export function circuit(g, w, h, type) {
  const R = mulberry(hashString('circuit:' + type.name)), step = 38;
  g.save(); g.strokeStyle = type.color; g.fillStyle = type.color; g.lineCap = 'round'; g.lineJoin = 'round';
  g.globalAlpha = .1; g.lineWidth = 4;
  for (let i = 0; i < 30; i++) {
    let x = Math.round(R() * w / step) * step, y = Math.round(R() * h / step) * step, dir = Math.floor(R() * 4);
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0, n = 3 + Math.floor(R() * 5); s < n; s++) {
      const len = step * (1 + Math.floor(R() * 3)), diag = R() < .3;
      const dx = [1, 0, -1, 0][dir], dy = [0, 1, 0, -1][dir];
      if (diag) { x += (dx || (R() < .5 ? 1 : -1)) * step; y += (dy || (R() < .5 ? 1 : -1)) * step; }
      else { x += dx * len; y += dy * len; }
      g.lineTo(x, y);
      dir = (dir + (R() < .5 ? 1 : 3)) % 4;
    }
    g.stroke();
    g.beginPath(); g.arc(x, y, 7, 0, TAU); g.stroke();   // a pad at the end of the trace
  }
  g.globalAlpha = .07;
  for (let x = step / 2; x < w; x += step) for (let y = step / 2; y < h; y += step) g.fillRect(x - 1.5, y - 1.5, 3, 3);
  g.restore();
}

// The pack wrappers' background: a starfield, rings of orbit round the hero and a glowing grid along the bottom.
export function wrapperArt(g, W, H, hy, wrap, R) {
  const [, , light] = wrap.colors;
  g.save(); g.globalCompositeOperation = 'screen';
  starfield(g, W, 0, H, R, 420);
  g.strokeStyle = light;
  for (const [k, a] of [[.36, .5], [.5, .32], [.66, .2], [.84, .12]]) { g.globalAlpha = a; g.lineWidth = 3; g.beginPath(); g.ellipse(W / 2, hy, W * k, W * k * .34, -.18, 0, TAU); g.stroke(); }
  g.globalAlpha = .8;
  for (const [k, t] of [[.5, .8], [.66, 3.6], [.36, 2.2]]) {   // a moon on some of the rings (the rings are tipped by −0.18)
    const a = W * k, b = a * .34, c = Math.cos(-.18), s = Math.sin(-.18);
    const x = W / 2 + Math.cos(t) * a * c - Math.sin(t) * b * s, y = hy + Math.cos(t) * a * s + Math.sin(t) * b * c;
    g.fillStyle = light; g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
  holoGrid(g, W, H * .8, H, light, 12, 7);
  g.restore();
}

export { mulberry };
