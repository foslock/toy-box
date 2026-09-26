// The eight rooms of Around the House: each card's type. A room has colours for the card frame, an icon, and a
// painter for the scene behind the item in the card's picture: a wall, a surface for the item to stand on, and light.
import { mulberry, hashString } from '../../kit.js';

const TAU = Math.PI * 2;

/* ---------- small painting helpers ---------- */
const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; };
const rad = (g, x, y, r0, r1, stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; };
function glow(g, x, y, r, color, a = .6) {
  g.save(); g.globalCompositeOperation = 'screen';
  g.fillStyle = rad(g, x, y, 0, r, [[0, color], [1, 'rgba(0,0,0,0)']]); g.globalAlpha = a; g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}
function rays(g, x, y, r, color, n = 14, a = .18, spin = 0) {
  g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = a;
  g.fillStyle = rad(g, x, y, 0, r, [[0, color], [1, 'rgba(0,0,0,0)']]);
  for (let i = 0; i < n; i++) {
    const a0 = spin + (i / n) * TAU, a1 = a0 + TAU / n * .45;
    g.beginPath(); g.moveTo(x, y); g.arc(x, y, r, a0, a1); g.closePath(); g.fill();
  }
  g.restore();
}
function sparkles(g, w, h, R, n, color = '#fff') {
  g.save(); g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h * .8, s = (2 + R() * 7) * w / 700;
    g.globalAlpha = .35 + R() * .6;
    g.beginPath();
    g.moveTo(x, y - s * 2.2); g.quadraticCurveTo(x, y, x + s * 2.2, y); g.quadraticCurveTo(x, y, x, y + s * 2.2); g.quadraticCurveTo(x, y, x - s * 2.2, y); g.quadraticCurveTo(x, y, x, y - s * 2.2);
    g.fill();
  }
  g.restore();
}
function vignette(g, w, h, a = .35) {
  g.fillStyle = rad(g, w / 2, h * .45, Math.min(w, h) * .35, Math.max(w, h) * .8, [[0, 'rgba(0,0,0,0)'], [1, `rgba(20,10,30,${a})`]]);
  g.fillRect(0, 0, w, h);
}
function noise(g, w, h, R, n, alpha, dark = true) {
  g.save();
  for (let i = 0; i < n; i++) { g.fillStyle = dark ? `rgba(0,0,0,${R() * alpha})` : `rgba(255,255,255,${R() * alpha})`; const s = 1 + R() * 2.2; g.fillRect(R() * w, R() * h, s, s); }
  g.restore();
}
// A flat surface seen from a little above: its top runs from y0 (back edge) to y1 (front edge), then a front face to y2.
function surface(g, w, y0, y1, y2, topFill, faceFill, edge = 'rgba(255,255,255,.35)') {
  g.fillStyle = topFill; g.fillRect(0, y0, w, y1 - y0);
  g.fillStyle = faceFill; g.fillRect(0, y1, w, y2 - y1);
  g.fillStyle = edge; g.fillRect(0, y1, w, Math.max(1, (y2 - y1) * .06));
  g.fillStyle = lin(g, 0, y1, 0, y2, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.25)']]); g.fillRect(0, y1, w, y2 - y1);
  // contact shade where the surface meets the wall
  g.fillStyle = lin(g, 0, y0, 0, y0 + (y1 - y0) * .5, [[0, 'rgba(0,0,0,.18)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, y0, w, (y1 - y0) * .5);
}
function woodPlanks(g, x, y, w, h, R, colors, vertical = false, n = 7) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length];
    if (vertical) g.fillRect(x + i * w / n, y, w / n + 1, h); else g.fillRect(x, y + i * h / n, w, h / n + 1);
  }
  g.save(); g.globalAlpha = .12; g.strokeStyle = '#3a200c';
  for (let i = 0; i < 40; i++) {
    const yy = y + R() * h; g.lineWidth = .6 + R(); g.beginPath();
    for (let xx = x; xx <= x + w; xx += 12) g.lineTo(xx, yy + Math.sin(xx * .03 + i) * 1.5);
    g.stroke();
  }
  g.restore();
}

/* ---------- the rooms ---------- */
// Each scene(g, w, h, o): o.floor is the y where the item's base sits; o.full for a full-art card; o.rarity; o.seed.
export const ROOMS = {
  kitchen: {
    name: 'Kitchen', color: '#e4572e', light: '#ffe6da', dark: '#8a2a12', weak: 'bathroom', resist: 'garden',
    icon(g, x, y, r) { // a flame
      g.beginPath(); g.moveTo(x, y - r * .78);
      g.bezierCurveTo(x + r * .2, y - r * .35, x + r * .62, y - r * .15, x + r * .52, y + r * .28);
      g.bezierCurveTo(x + r * .44, y + r * .66, x + r * .14, y + r * .76, x, y + r * .76);
      g.bezierCurveTo(x - r * .4, y + r * .76, x - r * .62, y + r * .4, x - r * .5, y + r * .06);
      g.bezierCurveTo(x - r * .42, y - r * .14, x - r * .24, y - r * .2, x - r * .2, y - r * .38);
      g.bezierCurveTo(x - r * .06, y - r * .22, x - r * .04, y - r * .5, x, y - r * .78); g.fill();
    },
    scene(g, w, h, o) {
      const R = mulberry(o.seed), f = o.floor, back = f - h * (o.full ? .07 : .13), front = f + h * (o.full ? .05 : .065);
      const tiles = [['#fbf4ea', '#e9dccb'], ['#e3f1ea', '#c9dfd3'], ['#fdf0cf', '#ecd9a6']][o.seed % 3];
      g.fillStyle = lin(g, 0, 0, 0, back, [[0, tiles[0]], [1, tiles[1]]]); g.fillRect(0, 0, w, back);
      const th = w * (o.full ? .05 : .06), tw = th * 2.1;
      g.strokeStyle = 'rgba(120,90,60,.22)'; g.lineWidth = Math.max(1, w / 400);
      for (let r = 0, y = back; y > -th; r++, y -= th) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
        for (let x = (r % 2) * tw / 2; x < w + tw; x += tw) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - th); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,.35)';
        for (let x = (r % 2) * tw / 2; x < w + tw; x += tw) g.fillRect(x + 3, y - th + 3, tw * .45, th * .18);
      }
      glow(g, w * .18, h * .08, w * .7, '#fff3d6', .8);
      surface(g, w, back, front, h, lin(g, 0, back, 0, front, [[0, '#d9a168'], [1, '#c68a50']]), '#a86c3a');
      woodPlanks(g, 0, back, w, front - back, R, ['rgba(255,220,170,.10)', 'rgba(120,70,30,.10)', 'rgba(255,240,210,.06)'], false, 5);
      glow(g, w / 2, f - h * .3, h * .55, '#ffc9a8', .55);
    },
  },
  bathroom: {
    name: 'Bathroom', color: '#2aa3d6', light: '#dff4ff', dark: '#0e5878', weak: 'office', resist: 'kitchen',
    icon(g, x, y, r) { // a drop
      g.beginPath(); g.moveTo(x, y - r * .8);
      g.bezierCurveTo(x + r * .18, y - r * .45, x + r * .58, y - r * .08, x + r * .58, y + r * .26);
      g.arc(x, y + r * .26, r * .58, 0, Math.PI, false);
      g.bezierCurveTo(x - r * .58, y - r * .08, x - r * .18, y - r * .45, x, y - r * .8); g.fill();
    },
    scene(g, w, h, o) {
      const R = mulberry(o.seed), f = o.floor, back = f - h * (o.full ? .07 : .13), front = f + h * (o.full ? .05 : .065);
      const pal = [['#e8f7fb', '#bfe3ee', '#9ccfe0'], ['#eef3ff', '#cad8f4', '#a7bde8'], ['#e9fbf5', '#c1eadb', '#9bd8c4']][o.seed % 3];
      g.fillStyle = lin(g, 0, 0, 0, back, [[0, pal[0]], [1, pal[1]]]); g.fillRect(0, 0, w, back);
      const t = w * (o.full ? .075 : .085);
      for (let y = back; y > -t; y -= t) for (let x = 0; x < w; x += t) {
        g.fillStyle = `rgba(255,255,255,${.12 + R() * .2})`; g.fillRect(x + 2, y - t + 2, t - 4, t - 4);
        g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 4, y - t + 4, t * .35, 2);
      }
      g.strokeStyle = pal[2]; g.globalAlpha = .55; g.lineWidth = Math.max(1, w / 350);
      for (let y = back; y > -t; y -= t) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      for (let x = 0; x < w; x += t) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, back); g.stroke(); }
      g.globalAlpha = 1;
      glow(g, w * .8, h * .05, w * .7, '#ffffff', .7);
      surface(g, w, back, front, h, lin(g, 0, back, 0, front, [[0, '#f7f9fb'], [1, '#e3e8ee']]), '#cfd7e0');
      g.save(); g.globalAlpha = .18; g.strokeStyle = '#8a98a8'; // marble veins
      for (let i = 0; i < 6; i++) { g.lineWidth = .8 + R() * 1.5; g.beginPath(); let x = R() * w, y = back + R() * (front - back); g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += 20 + R() * 50; y += (R() - .5) * 14; g.lineTo(x, y); } g.stroke(); }
      g.restore();
      glow(g, w / 2, f - h * .3, h * .55, '#bfefff', .55);
    },
  },
  living: {
    name: 'Living Room', color: '#8c55d9', light: '#efe4ff', dark: '#4a2385', weak: 'laundry', resist: 'bedroom',
    icon(g, x, y, r) { // a sofa
      const u = r / 10;
      g.beginPath(); g.roundRect(x - 6.5 * u, y - 5 * u, 13 * u, 6 * u, 2 * u); g.fill();
      g.beginPath(); g.roundRect(x - 8.5 * u, y - 1.5 * u, 4 * u, 6.5 * u, 1.6 * u); g.fill();
      g.beginPath(); g.roundRect(x + 4.5 * u, y - 1.5 * u, 4 * u, 6.5 * u, 1.6 * u); g.fill();
      g.fillRect(x - 5 * u, y + 1 * u, 10 * u, 3.5 * u);
      g.fillRect(x - 7.5 * u, y + 4.5 * u, 1.6 * u, 2.4 * u); g.fillRect(x + 5.9 * u, y + 4.5 * u, 1.6 * u, 2.4 * u);
    },
    scene(g, w, h, o) {
      const R = mulberry(o.seed), f = o.floor, back = f - h * (o.full ? .08 : .14), front = f + h * (o.full ? .05 : .07);
      const pal = [['#6b3fa8', '#583192', '#e2c26b'], ['#2f6e73', '#255a5e', '#e8c878'], ['#a64a6a', '#8a3a57', '#f0cf86']][o.seed % 3];
      g.fillStyle = pal[0]; g.fillRect(0, 0, w, back);
      const sw = w * (o.full ? .085 : .1);
      for (let x = 0; x < w; x += sw * 2) { g.fillStyle = pal[1]; g.fillRect(x, 0, sw, back); g.fillStyle = pal[2]; g.globalAlpha = .45; g.fillRect(x + sw - 1, 0, Math.max(1.5, w / 400), back); g.globalAlpha = 1; }
      // damask dots
      g.fillStyle = 'rgba(255,255,255,.07)';
      for (let x = sw / 2; x < w; x += sw) for (let y = sw * .6; y < back; y += sw * 1.2) { g.beginPath(); g.ellipse(x, y + ((x / sw) % 2) * sw * .6, sw * .16, sw * .26, 0, 0, TAU); g.fill(); }
      // chair rail
      g.fillStyle = 'rgba(255,240,220,.28)'; g.fillRect(0, back - h * .09, w, Math.max(2, h * .012));
      // a shaft of window light
      g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(255,236,200,.22)';
      g.beginPath(); g.moveTo(w * .05, 0); g.lineTo(w * .42, 0); g.lineTo(w * .75, back + (front - back)); g.lineTo(w * .2, back + (front - back)); g.fill(); g.restore();
      surface(g, w, back, front, h, lin(g, 0, back, 0, front, [[0, '#9a6538'], [1, '#b07747']]), '#6f4424');
      woodPlanks(g, 0, back, w, front - back, R, ['rgba(255,210,160,.12)', 'rgba(60,30,10,.12)'], false, 6);
      // a rug under the item
      g.fillStyle = 'rgba(190,60,70,.85)'; g.beginPath(); g.ellipse(w / 2, (back + front) / 2 + 2, w * .36, (front - back) * .42, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,220,150,.7)'; g.lineWidth = Math.max(1.5, w / 260); g.beginPath(); g.ellipse(w / 2, (back + front) / 2 + 2, w * .32, (front - back) * .34, 0, 0, TAU); g.stroke();
      glow(g, w / 2, f - h * .3, h * .55, '#e7c9ff', .5);
    },
  },
  bedroom: {
    name: 'Bedroom', color: '#4458c4', light: '#e3e8ff', dark: '#1f2c78', weak: 'office', resist: 'living',
    icon(g, x, y, r) { // a crescent moon
      g.beginPath(); g.arc(x, y, r * .72, 0, TAU); g.fill();
      g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(x + r * .34, y - r * .22, r * .6, 0, TAU); g.fill(); g.restore();
    },
    scene(g, w, h, o) {
      const R = mulberry(o.seed), f = o.floor, back = f - h * (o.full ? .07 : .13), front = f + h * (o.full ? .05 : .065);
      const pal = [['#27306f', '#3f4aa0'], ['#3b2a6e', '#5a3f98'], ['#1f4b6e', '#2f6d96']][o.seed % 3];
      g.fillStyle = lin(g, 0, 0, 0, back, [[0, pal[0]], [1, pal[1]]]); g.fillRect(0, 0, w, back);
      g.fillStyle = 'rgba(255,240,200,.55)';
      const step = w * .11;
      for (let y = step * .5, r = 0; y < back; y += step, r++) for (let x = (r % 2) * step / 2; x < w + step; x += step) {
        const s = w / 700 * (R() < .25 ? 6 : 3.2);
        g.globalAlpha = .3 + R() * .5;
        g.beginPath(); g.moveTo(x, y - s * 2); g.quadraticCurveTo(x, y, x + s * 2, y); g.quadraticCurveTo(x, y, x, y + s * 2); g.quadraticCurveTo(x, y, x - s * 2, y); g.quadraticCurveTo(x, y, x, y - s * 2); g.fill();
      }
      g.globalAlpha = 1;
      glow(g, w * .85, h * .15, w * .55, '#ffd89a', .45);   // a bedside lamp somewhere off to the right
      surface(g, w, back, front, h, lin(g, 0, back, 0, front, [[0, '#7c4f2e'], [1, '#95623a']]), '#5b3820');
      woodPlanks(g, 0, back, w, front - back, R, ['rgba(255,210,160,.1)', 'rgba(40,20,10,.14)'], false, 4);
      glow(g, w / 2, f - h * .3, h * .55, '#b9c6ff', .55);
    },
  },
  garage: {
    name: 'Garage', color: '#c0702c', light: '#fbe8d6', dark: '#6b3a12', weak: 'garden', resist: 'office',
    icon(g, x, y, r) { // a wrench
      g.save(); g.translate(x, y); g.rotate(-Math.PI / 4);
      const u = r / 10;
      g.beginPath(); g.roundRect(-1.5 * u, -2 * u, 3 * u, 10 * u, 1.5 * u); g.fill();
      g.beginPath(); g.arc(0, -4.4 * u, 3.8 * u, 0, TAU); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.fillRect(-1.3 * u, -9.5 * u, 2.6 * u, 5.2 * u);
      g.restore();
    },
    scene(g, w, h, o) {
      const R = mulberry(o.seed), f = o.floor, back = f - h * (o.full ? .07 : .13), front = f + h * (o.full ? .05 : .065);
      g.fillStyle = lin(g, 0, 0, 0, back, [[0, '#caa47a'], [1, '#b98f63']]); g.fillRect(0, 0, w, back);
      const s = w * (o.full ? .042 : .05);
      g.fillStyle = 'rgba(60,35,15,.45)';
      for (let y = s / 2; y < back - s / 3; y += s) for (let x = s / 2; x < w; x += s) { g.beginPath(); g.arc(x, y, s * .11, 0, TAU); g.fill(); }
      noise(g, w, back, R, 1500, .06);
      // a hazard stripe along the bottom of the wall
      const hy = back - h * .045;
      g.save(); g.beginPath(); g.rect(0, hy, w, h * .03); g.clip();
      g.fillStyle = '#f2c230'; g.fillRect(0, hy, w, h * .03); g.fillStyle = '#2b2a28';
      for (let x = -h * .06; x < w; x += h * .06) { g.beginPath(); g.moveTo(x, hy + h * .03); g.lineTo(x + h * .03, hy); g.lineTo(x + h * .045, hy); g.lineTo(x + h * .015, hy + h * .03); g.fill(); }
      g.restore();
      glow(g, w * .5, -h * .1, w * .8, '#fff4dc', .5);   // a shop light overhead
      surface(g, w, back, front, h, lin(g, 0, back, 0, front, [[0, '#d7b98e'], [1, '#c9a674']]), '#8d6a44');
      woodPlanks(g, 0, back, w, front - back, R, ['rgba(255,230,190,.12)', 'rgba(90,60,30,.12)'], false, 3);
      noise(g, w, front, R, 500, .05);
      glow(g, w / 2, f - h * .3, h * .55, '#ffd9a8', .5);
    },
  },
  office: {
    name: 'Office', color: '#e3a712', light: '#fff6d8', dark: '#7a5600', weak: 'kitchen', resist: 'garage',
    icon(g, x, y, r) { // a pencil
      g.save(); g.translate(x, y); g.rotate(Math.PI / 4);
      const u = r / 10;
      g.fillRect(-2 * u, -7 * u, 4 * u, 10 * u);
      g.beginPath(); g.moveTo(-2 * u, 3.6 * u); g.lineTo(2 * u, 3.6 * u); g.lineTo(0, 8 * u); g.fill();
      g.fillRect(-2 * u, -9 * u, 4 * u, 1.4 * u);
      g.restore();
    },
    scene(g, w, h, o) {
      const R = mulberry(o.seed), f = o.floor, back = f - h * (o.full ? .07 : .13), front = f + h * (o.full ? .05 : .065);
      g.fillStyle = lin(g, 0, 0, 0, back, [[0, '#fbf1cf'], [1, '#f2e2ae']]); g.fillRect(0, 0, w, back);
      // a cork board with notes
      const bx = w * .08, by = h * .06, bw = w * .84, bh = back - h * .14;
      g.fillStyle = '#7a5a36'; g.fillRect(bx - 6, by - 6, bw + 12, bh + 12);
      g.fillStyle = '#c99a62'; g.fillRect(bx, by, bw, bh);
      g.save(); g.beginPath(); g.rect(bx, by, bw, bh); g.clip();
      for (let i = 0; i < 2600; i++) { g.fillStyle = R() < .5 ? 'rgba(90,55,20,.2)' : 'rgba(255,230,180,.18)'; g.fillRect(bx + R() * bw, by + R() * bh, 2, 2); }
      const notes = ['#fff27a', '#ffb8d1', '#aee8ff', '#c7f59a', '#ffffff'];
      for (let i = 0; i < 7; i++) {
        const nx = bx + R() * bw, ny = by + R() * bh * .8, ns = w * (.07 + R() * .05);
        g.save(); g.translate(nx, ny); g.rotate((R() - .5) * .35);
        g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(-ns / 2 + 3, -ns / 2 + 4, ns, ns);
        g.fillStyle = notes[i % notes.length]; g.fillRect(-ns / 2, -ns / 2, ns, ns);
        g.fillStyle = 'rgba(40,40,60,.25)'; for (let l = 0; l < 3; l++) g.fillRect(-ns * .35, -ns * .2 + l * ns * .18, ns * (.5 + R() * .2), Math.max(1, ns * .03));
        g.fillStyle = ['#e5383b', '#2a9df4', '#34c759'][i % 3]; g.beginPath(); g.arc(0, -ns * .38, ns * .07, 0, TAU); g.fill();
        g.restore();
      }
      g.restore();
      glow(g, w * .15, h * .1, w * .6, '#fff9e0', .55);
      surface(g, w, back, front, h, lin(g, 0, back, 0, front, [[0, '#f6f3ee'], [1, '#e6e1d8']]), '#bdb4a6');
      glow(g, w / 2, f - h * .3, h * .55, '#fff0b0', .55);
    },
  },
  garden: {
    name: 'Garden', color: '#3c9f4a', light: '#e2f7df', dark: '#1d5a26', weak: 'garage', resist: 'bathroom',
    icon(g, x, y, r) { // a leaf
      g.save(); g.translate(x, y); g.rotate(-Math.PI / 4);
      g.beginPath(); g.moveTo(0, -r * .82); g.bezierCurveTo(r * .62, -r * .4, r * .62, r * .4, 0, r * .82); g.bezierCurveTo(-r * .62, r * .4, -r * .62, -r * .4, 0, -r * .82); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.lineWidth = r * .1; g.beginPath(); g.moveTo(0, -r * .6); g.lineTo(0, r * .7); g.stroke();
      g.restore();
    },
    scene(g, w, h, o) {
      const R = mulberry(o.seed), f = o.floor, back = f - h * (o.full ? .09 : .15), front = f + h * (o.full ? .05 : .07);
      g.fillStyle = lin(g, 0, 0, 0, back, [[0, '#6fb8f0'], [.7, '#bfe3fb'], [1, '#e9f6ff']]); g.fillRect(0, 0, w, back);
      glow(g, w * .8, h * .06, w * .45, '#fff6c8', .9);
      g.fillStyle = 'rgba(255,255,255,.9)';
      for (let i = 0; i < 3; i++) {
        const cx = R() * w, cy = h * (.08 + R() * .18), s = w * (.06 + R() * .05);
        for (let j = 0; j < 5; j++) { g.beginPath(); g.arc(cx + (j - 2) * s * .7, cy + Math.abs(j - 2) * s * .15, s * (.6 + (j % 2) * .25), 0, TAU); g.fill(); }
      }
      // hedge and a picket fence
      const hy = back - h * (o.full ? .16 : .2);
      g.fillStyle = '#3f8a3e'; g.beginPath(); g.moveTo(0, back);
      for (let x = 0; x <= w; x += w / 14) g.lineTo(x, hy + Math.sin(x * .05 + o.seed % 7) * h * .02 - R() * h * .03);
      g.lineTo(w, back); g.fill();
      g.fillStyle = 'rgba(20,60,20,.25)'; for (let i = 0; i < 200; i++) { g.beginPath(); g.arc(R() * w, hy + R() * (back - hy), 2 + R() * 5, 0, TAU); g.fill(); }
      const pw = w * .05, py = back - h * .1;
      for (let x = pw * .3; x < w; x += pw * 1.6) {
        g.fillStyle = '#fbfbf6'; g.beginPath(); g.moveTo(x, back); g.lineTo(x, py); g.lineTo(x + pw / 2, py - pw * .5); g.lineTo(x + pw, py); g.lineTo(x + pw, back); g.fill();
        g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x + pw * .7, py, pw * .3, back - py);
      }
      g.fillStyle = '#f2f2ea'; g.fillRect(0, py + (back - py) * .25, w, h * .012); g.fillRect(0, py + (back - py) * .7, w, h * .012);
      // lawn
      g.fillStyle = lin(g, 0, back, 0, h, [[0, '#5fae4c'], [1, '#3f8a38']]); g.fillRect(0, back, w, h - back);
      g.strokeStyle = 'rgba(30,90,30,.5)'; g.lineWidth = Math.max(1, w / 500);
      for (let i = 0; i < 420; i++) { const x = R() * w, y = back + R() * (h - back), l = 4 + R() * 7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 3, y - l); g.stroke(); }
      glow(g, w / 2, f - h * .3, h * .55, '#e6ffc8', .45);
    },
  },
  laundry: {
    name: 'Laundry', color: '#e0609f', light: '#ffe5f1', dark: '#86204f', weak: 'kitchen', resist: 'bathroom',
    icon(g, x, y, r) { // bubbles
      const b = (bx, by, br) => { g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); };
      b(x - r * .28, y + r * .22, r * .44); b(x + r * .36, y - r * .12, r * .32); b(x - r * .02, y - r * .52, r * .22);
    },
    scene(g, w, h, o) {
      const R = mulberry(o.seed), f = o.floor, back = f - h * (o.full ? .07 : .13), front = f + h * (o.full ? .05 : .075);
      const pal = [['#ffe1ee', '#f7c4dc'], ['#e9e1ff', '#d2c4f7'], ['#dff5f6', '#c0e6e9']][o.seed % 3];
      g.fillStyle = lin(g, 0, 0, 0, back, [[0, pal[0]], [1, pal[1]]]); g.fillRect(0, 0, w, back);
      for (let i = 0; i < 26; i++) {
        const x = R() * w, y = R() * back, r = w * (.012 + R() * .05);
        g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = Math.max(1, r * .08); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(x - r * .35, y - r * .4, r * .22, r * .12, -.6, 0, TAU); g.fill();
      }
      // checkerboard floor in a little perspective
      const rows = 5, cols = 12;
      for (let r = 0; r < rows; r++) {
        const y0 = back + (front - back) * (r / rows), y1 = back + (front - back) * ((r + 1) / rows);
        for (let c = -2; c < cols + 2; c++) {
          const sp = (yy) => 1 + (yy - back) / (front - back) * .6;
          const x0a = w / 2 + (c - cols / 2) * (w / cols) * sp(y0), x1a = w / 2 + (c + 1 - cols / 2) * (w / cols) * sp(y0);
          const x0b = w / 2 + (c - cols / 2) * (w / cols) * sp(y1), x1b = w / 2 + (c + 1 - cols / 2) * (w / cols) * sp(y1);
          g.fillStyle = (r + c) % 2 ? '#2f2a36' : '#f4f1ee';
          g.beginPath(); g.moveTo(x0a, y0); g.lineTo(x1a, y0); g.lineTo(x1b, y1 + .5); g.lineTo(x0b, y1 + .5); g.fill();
        }
      }
      g.fillStyle = lin(g, 0, back, 0, back + (front - back) * .4, [[0, 'rgba(0,0,0,.25)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, back, w, (front - back) * .4);
      g.fillStyle = '#d7d2da'; g.fillRect(0, front, w, h - front);
      g.fillStyle = lin(g, 0, front, 0, h, [[0, 'rgba(0,0,0,.05)'], [1, 'rgba(0,0,0,.3)']]); g.fillRect(0, front, w, h - front);
      glow(g, w / 2, f - h * .3, h * .55, '#ffd3ea', .5);
    },
  },
};

// Shared finishing touches for any set's scenes: sparkle for rares, rays and a vignette for full art.
export function finishScene(g, w, h, o, type) {
  const R = mulberry(hashString(o.seed + ':fx'));
  if (o.full) {
    g.save(); g.globalCompositeOperation = 'screen';
    const cx = w / 2, cy = o.floor - h * .28, n = 18;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU + .1, a1 = a0 + TAU / n * .42;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, h * .75);
      gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, h * .9, a0, a1); g.closePath(); g.fill();
    }
    g.restore();
  }
  if (o.rarity === 'R' || o.full) sparkles(g, w, h, R, o.full ? 46 : 22, '#fffbe8');
  vignette(g, w, h, o.full ? .42 : .3);
}

export { glow, rays, sparkles, vignette };
