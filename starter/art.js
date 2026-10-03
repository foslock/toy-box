// The pictures: the jar on the counter (SVG), the parish map of Much Proving (SVG), the world in dots (canvas) and the
// universe (canvas). Each one is built once and then told the state every frame; they keep their own little animations.
import { dots, KINDS } from './worldmap.js';

const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = x => Math.max(0, Math.min(1, x));
const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// =================================================================================================================== jar
// Four vessels, smallest first. `top`/`bot` bound the inside the starter fills; x0/x1 its sides there.
const VESSELS = {
  jam: { x0: 72, x1: 168, top: 100, bot: 259, band: true,
    body: 'M70,110 Q70,96 84,94 L156,94 Q170,96 170,110 L170,250 Q170,262 156,262 L84,262 Q70,262 70,250 Z',
    neck: 'M80,94 L80,82 L160,82 L160,94' },
  kilner: { x0: 62, x1: 178, top: 80, bot: 259, band: true,
    body: 'M60,92 Q60,74 80,72 L160,72 Q180,74 180,92 L180,250 Q180,262 166,262 L74,262 Q60,262 60,250 Z',
    neck: 'M74,72 L74,60 L166,60 L166,72' },
  bowl: { x0: 22, x1: 218, top: 156, bot: 259, band: false,
    body: 'M18,150 C20,214 58,262 92,262 L148,262 C182,262 220,214 222,150 Z', neck: '' },
  sweet: { x0: 54, x1: 186, top: 76, bot: 259, band: true,
    body: 'M52,98 C52,74 70,68 92,64 L92,46 L148,46 L148,64 C170,68 188,74 188,98 L188,250 Q188,262 174,262 L66,262 Q52,262 52,250 Z',
    neck: 'M92,64 L148,64' },
};
export const vesselOf = s => s.own.crock ? 'sweet' : s.own.bowl ? 'bowl' : s.own.kilner ? 'kilner' : 'jam';

export function makeJar(svg, { mini = false } = {}) {
  svg.textContent = '';
  const defs = el('defs', {}, svg);
  const clip = el('clipPath', { id: svg.id + '-clip' }, defs);
  const clipPath = el('path', {}, clip);
  const grad = el('linearGradient', { id: svg.id + '-dough', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  const g1 = el('stop', { offset: 0, 'stop-color': '#f1e4c4' }, grad);
  const g2 = el('stop', { offset: 1, 'stop-color': '#d9c398' }, grad);
  const check = el('pattern', { id: svg.id + '-check', width: 12, height: 12, patternUnits: 'userSpaceOnUse' }, defs);
  el('rect', { width: 12, height: 12, fill: '#f6efe0' }, check);
  el('rect', { width: 6, height: 12, fill: '#c9573a', opacity: .55 }, check);
  el('rect', { width: 12, height: 6, fill: '#c9573a', opacity: .55 }, check);

  el('line', { x1: 0, y1: 263, x2: 240, y2: 263, stroke: 'currentColor', 'stroke-width': 1.2, opacity: .5, class: 'counter' }, svg);
  const back = el('path', { fill: 'rgba(255,255,255,.35)', stroke: 'none' }, svg);
  const inner = el('g', { 'clip-path': `url(#${svg.id}-clip)` }, svg);
  const dough = el('path', { fill: `url(#${svg.id}-dough)` }, inner);
  const dclip = el('clipPath', { id: svg.id + '-dclip' }, defs);
  const dclipPath = el('path', {}, dclip);
  const flecks = el('g', { fill: '#7a5a34', opacity: 0, 'clip-path': `url(#${svg.id}-dclip)` }, inner);
  const bubG = el('g', { fill: 'rgba(255,250,236,.55)', stroke: '#3a3226', 'stroke-width': .7, 'stroke-opacity': .55 }, inner);
  const hooch = el('path', { fill: 'none', stroke: '#8b8a80', 'stroke-width': 3, opacity: 0 }, inner);
  const surf = el('path', { fill: 'none', stroke: '#3a3226', 'stroke-width': 1.1, opacity: .7 }, inner);
  const flour = el('g', { fill: '#fffaf0', stroke: '#b9ab90', 'stroke-width': .4 }, svg);
  const marks = el('g', {}, svg);
  const dbl = el('line', { stroke: '#3a3226', 'stroke-width': 1, 'stroke-dasharray': '2 3', opacity: .45 }, marks);
  const dblT = el('text', { 'font-size': 10, fill: '#3a3226', opacity: .55, 'font-family': 'Caveat, cursive' }, marks);
  dblT.textContent = '×2';
  const band = el('path', { fill: 'none', stroke: '#b5562f', 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
  const bandHi = el('path', { fill: 'none', stroke: '#e08a62', 'stroke-width': 1.2, 'stroke-linecap': 'round', opacity: .8 }, svg);
  const glass = el('path', { fill: 'none', stroke: '#2b2620', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, svg);
  const shine = el('path', { fill: 'none', stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: .6 }, svg);
  const lid = el('g', {}, svg);
  const tape = el('g', { opacity: 0 }, svg);
  const tapeR = el('path', { fill: '#efe0b0', stroke: '#c9b77f', 'stroke-width': .6 }, tape);
  const tapeT = el('text', { 'font-family': 'Caveat, cursive', 'font-weight': 600, 'font-size': 22, fill: '#2b2620', 'text-anchor': 'middle' }, tape);
  const towel = el('path', { fill: `url(#${svg.id}-check)`, stroke: '#9b4a32', 'stroke-width': .8, opacity: 0 }, svg);
  const fx = el('g', { fill: 'none', stroke: '#3a3226', 'stroke-width': .8 }, svg);

  let vname = null, V = null;
  const bubbles = [], pops = [], grains = [];
  const rand = rng(11);
  for (let i = 0; i < 46; i++) bubbles.push({ u: rand(), v: rand(), r: 1.2 + rand() * 3.2, sp: .02 + rand() * .05, fast: 0, el: null });
  for (let i = 0; i < 26; i++) el('circle', { cx: lerp(70, 170, rand()), cy: 120 + rand() * 140, r: .6 + rand() * .7 }, flecks);

  function setVessel(name) {
    if (name === vname) return;
    vname = name; V = VESSELS[name];
    clipPath.setAttribute('d', V.body);
    back.setAttribute('d', V.body);
    glass.setAttribute('d', V.body + ' ' + V.neck);
    shine.setAttribute('d', name === 'bowl' ? 'M36,170 C40,200 52,222 66,236' : `M${V.x0 + 10},${V.top + 30} L${V.x0 + 10},${V.bot - 30}`);
    lid.textContent = '';
    towel.setAttribute('opacity', 0);
    if (name === 'jam') {
      el('rect', { x: 76, y: 64, width: 88, height: 19, rx: 3, fill: '#c9573a', stroke: '#2b2620', 'stroke-width': 2 }, lid);
      for (let x = 84; x < 160; x += 8) el('line', { x1: x, y1: 66, x2: x, y2: 81, stroke: '#2b2620', 'stroke-width': .7, opacity: .5 }, lid);
      lid.setAttribute('transform', 'rotate(-6 120 72) translate(0 -4)');
    } else if (name === 'kilner') {
      el('path', { d: 'M70,60 Q120,32 170,60 Z', fill: 'rgba(255,255,255,.4)', stroke: '#2b2620', 'stroke-width': 2 }, lid);
      el('line', { x1: 72, y1: 61, x2: 168, y2: 61, stroke: '#d9752e', 'stroke-width': 3 }, lid);
      el('path', { d: 'M68,62 L58,88 M172,62 L182,88 M120,40 L120,34', fill: 'none', stroke: '#6c6c6c', 'stroke-width': 1.6 }, lid);
      lid.setAttribute('transform', '');
    } else if (name === 'bowl') {
      el('ellipse', { cx: 120, cy: 150, rx: 102, ry: 8, fill: 'none', stroke: '#2b2620', 'stroke-width': 2 }, lid);
      towel.setAttribute('d', 'M16,146 C60,132 120,136 150,142 C140,160 150,190 132,206 C110,196 90,212 70,200 C50,190 30,170 16,146 Z');
      towel.setAttribute('opacity', 1);
      lid.setAttribute('transform', '');
    } else {
      el('rect', { x: 86, y: 28, width: 68, height: 19, rx: 6, fill: '#3d6b8a', stroke: '#2b2620', 'stroke-width': 2 }, lid);
      el('circle', { cx: 120, cy: 23, r: 6, fill: '#3d6b8a', stroke: '#2b2620', 'stroke-width': 2 }, lid);
      lid.setAttribute('transform', '');
    }
  }

  // how full: `base` is the level just after a feed (0..1 of the inside), and the rise lifts it
  let anim = null, wob = 0, t = 0, shown = { level: .15, base: .15 };
  function levelY(f) { return lerp(V.bot, V.top, f); }
  function surface(y, dome, k) {
    const x0 = V.x0 - 4, x1 = V.x1 + 4, w = x1 - x0;
    let d = `M${x0},${y + 2}`;
    const n = 16;
    for (let i = 1; i <= n; i++) {
      const u = i / n, x = x0 + u * w;
      const bump = Math.sin(u * 19 + t * 1.7) * .9 + Math.sin(u * 7 - t * 1.1) * .7;
      d += ` L${x.toFixed(1)},${(y - dome * Math.sin(Math.PI * u) - bump * k).toFixed(1)}`;
    }
    return d;
  }

  return {
    svg,
    feed({ disc, base0, base1 }) { anim = { t: 0, from: shown.level, low: disc > 0 ? base1 / 2 : shown.level, to: base1 }; puff(); },
    tap() {
      let n = 0;
      for (const b of bubbles) if (!b.fast && b.v > .5 && n < 3) { b.fast = 1; n++; }
    },
    draw(s, dt, view) {
      t += dt;
      setVessel(view.vessel);
      const cap = view.cap;
      const base = clamp01(.45 * Math.min(1, s.grams / cap));
      let level = base * (1 + s.rise);
      if (anim) {
        anim.t += dt / 1.2;
        const a = anim.t;
        level = a < .35 ? lerp(anim.from, anim.low, ease(a / .35)) : a < .55 ? anim.low : lerp(anim.low, anim.to, ease((a - .55) / .45));
        if (a >= 1) anim = null;
      }
      shown.level = level; shown.base = base;
      const y = levelY(level);
      const peak = s.peakT > 0;
      wob = lerp(wob, peak ? 1 : 0, Math.min(1, dt * 6));
      const dome = 3 + s.rise * 5 + wob * (3 + Math.sin(t * 22) * 1.2);
      const dd = surface(y, dome, 1 + s.rise) + ` L${V.x1 + 4},${V.bot + 6} L${V.x0 - 4},${V.bot + 6} Z`;
      dough.setAttribute('d', dd); dclipPath.setAttribute('d', dd);
      surf.setAttribute('d', surface(y, dome, 1 + s.rise));
      hooch.setAttribute('d', surface(y + 1.5, dome, 1));
      hooch.setAttribute('opacity', view.hooch && peak ? .7 : 0);
      if (view.rye !== shown.rye) {
        shown.rye = view.rye;
        g1.setAttribute('stop-color', view.rye ? '#e8d4ad' : '#f1e4c4'); g2.setAttribute('stop-color', view.rye ? '#c4a676' : '#d9c398');
        flecks.setAttribute('opacity', view.rye ? .5 : 0);
      }

      // bubbles drift up through the starter and pop at the top; there are more of them the livelier you are
      const live = Math.min(bubbles.length, Math.round(4 + view.liveliness * 6));
      const depth = V.bot - y;
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        if (i >= live && !b.fast) { if (b.el) { b.el.remove(); b.el = null; } continue; }
        if (!b.el) b.el = el('circle', {}, bubG);
        b.v -= dt * (b.fast ? 1.4 : b.sp * (.4 + view.liveliness * .25 + s.rise * .6));
        if (b.v < 0) {
          if (pops.length < 14) pops.push({ x: lerp(V.x0 + 8, V.x1 - 8, b.u), y: y - 2, t: 0, el: el('circle', {}, fx) });
          b.v = 1; b.u = Math.random(); b.fast = 0;
        }
        const r = b.r * (.6 + .4 * (1 - b.v)) * (depth > 12 ? 1 : .5);
        b.el.setAttribute('cx', lerp(V.x0 + 8, V.x1 - 8, b.u).toFixed(1));
        b.el.setAttribute('cy', (y + 4 + b.v * Math.max(0, depth - 8)).toFixed(1));
        b.el.setAttribute('r', r.toFixed(2));
      }
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i]; p.t += dt * 2.8;
        if (p.t >= 1) { p.el.remove(); pops.splice(i, 1); continue; }
        p.el.setAttribute('cx', p.x); p.el.setAttribute('cy', p.y - p.t * 3); p.el.setAttribute('r', 1 + p.t * 4); p.el.setAttribute('opacity', 1 - p.t);
      }
      for (let i = grains.length - 1; i >= 0; i--) {
        const g = grains[i]; g.t += dt;
        g.y += g.vy * dt; g.vy += 140 * dt;
        if (g.y > y || g.t > 1.4) { g.el.remove(); grains.splice(i, 1); continue; }
        g.el.setAttribute('cx', g.x.toFixed(1)); g.el.setAttribute('cy', g.y.toFixed(1));
      }

      // the band sits where you were after your last feed; the pencil mark is where doubled will be
      const by = levelY(anim ? (anim.t > .55 ? anim.to : shown.base) : base);
      const dy = levelY(Math.min(.95, (anim ? anim.to : base) * 2));
      if (V.band) {
        const bd = `M${V.x0 - 3},${by} Q120,${by + 5} ${V.x1 + 3},${by}`;
        band.setAttribute('d', bd); bandHi.setAttribute('d', `M${V.x0 - 2},${by - 1.6} Q120,${by + 3.2} ${V.x1 + 2},${by - 1.6}`);
        band.setAttribute('opacity', 1); bandHi.setAttribute('opacity', .8);
      } else { band.setAttribute('opacity', 0); bandHi.setAttribute('opacity', 0); }
      dbl.setAttribute('x1', V.x1 - 26); dbl.setAttribute('x2', V.x1 - 4); dbl.setAttribute('y1', dy); dbl.setAttribute('y2', dy);
      dblT.setAttribute('x', V.x1 - 22); dblT.setAttribute('y', dy - 3);
      marks.setAttribute('opacity', mini || vname === 'bowl' ? 0 : 1);

      if (view.name && vname !== 'bowl') {
        tape.setAttribute('opacity', 1);
        const cx = (V.x0 + V.x1) / 2, ty = V.bot - 46;
        tapeR.setAttribute('d', `M${cx - 40},${ty - 14} l80,-3 l2,26 l-82,3 z`);
        tapeT.setAttribute('x', cx); tapeT.setAttribute('y', ty + 6); tapeT.setAttribute('transform', `rotate(-2 ${cx} ${ty})`);
        tapeT.textContent = view.name.toUpperCase();
      } else tape.setAttribute('opacity', 0);
    },
  };

  function puff() {
    for (let i = 0; i < 22; i++) {
      const g = { x: lerp(V.x0 + 20, V.x1 - 20, Math.random()), y: V.top - 6 - Math.random() * 16, vy: 10 + Math.random() * 30, t: 0 };
      g.el = el('circle', { r: .8 + Math.random() * 1.2 }, flour);
      grains.push(g);
    }
  }
}

// =================================================================================================================== town
// A parish map, drawn once: streets, houses along them, landmarks. Houses fill in, nearest the baker's first.
const STREETS = {
  'High Street': [[16, 190], [90, 180], [170, 173], [246, 170], [330, 168], [400, 177], [466, 192]],
  'Church Lane': [[238, 34], [241, 92], [246, 170], [250, 238], [244, 316]],
  'Mill Road': [[30, 58], [96, 94], [158, 130], [206, 166]],
  'Back Lane': [[252, 240], [320, 251], [390, 262], [460, 272]],
  'Station Road': [[330, 168], [350, 122], [368, 76], [380, 40]],
  'The Crescent': [[52, 214], [74, 250], [114, 272], [160, 266], [188, 240], [200, 206]],
  'Orchard Way': [[400, 177], [418, 222], [424, 268]],
  'Pond Lane': [[96, 94], [80, 136], [64, 176]],
};
const LANDMARKS = [
  { kind: 'green', x: 246, y: 170, r: 17 },
  { kind: 'church', x: 205, y: 70, r: 26 },
  { kind: 'pond', x: 52, y: 108, r: 24 },
  { kind: 'reservoir', x: 428, y: 82, r: 44 },
  { kind: 'hall', x: 298, y: 205, r: 15 },
  { kind: 'river', x: 0, y: 0, r: 0 },
];

export function makeTown(svg) {
  svg.textContent = '';
  const ink = '#1c1a15';
  const g = el('g', { fill: 'none', stroke: ink, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
  el('rect', { x: 2, y: 2, width: 476, height: 326, 'stroke-width': 2 }, g);
  el('rect', { x: 6, y: 6, width: 468, height: 318, 'stroke-width': .6 }, g);
  // the river, along the bottom
  const river = 'M6,300 C70,292 120,312 190,302 S300,288 360,304 S440,312 474,298';
  el('path', { d: river, 'stroke-width': 9, stroke: '#cfc7b4' }, g);
  el('path', { d: river, 'stroke-width': .7, transform: 'translate(0 -5)' }, g);
  el('path', { d: river, 'stroke-width': .7, transform: 'translate(0 5)' }, g);
  for (let x = 20; x < 470; x += 26) el('path', { d: `M${x},${300 + Math.sin(x) * 3} l8,0`, 'stroke-width': .5 }, g);
  // the hill and the reservoir
  for (let i = 0; i < 4; i++) el('ellipse', { cx: 428, cy: 84, rx: 50 + i * 12, ry: 30 + i * 9, 'stroke-width': .45, 'stroke-dasharray': '1.5 2.5', opacity: .7 }, g);
  const resv = el('ellipse', { cx: 428, cy: 84, rx: 34, ry: 18, 'stroke-width': 1.2, fill: '#d8d2c2' }, g);
  const resvFx = el('g', { opacity: 0 }, svg);
  for (let i = 0; i < 18; i++) el('circle', { cx: 404 + (i * 37) % 48, cy: 74 + (i * 13) % 20, r: 1 + (i % 3) * .6, fill: 'none', stroke: ink, 'stroke-width': .5 }, resvFx);
  const pipes = el('path', { d: 'M400,94 C360,120 300,140 252,166 M410,100 C390,160 330,200 260,236', fill: 'none', stroke: ink, 'stroke-width': .8, 'stroke-dasharray': '3 3', opacity: 0 }, svg);
  for (let i = 0; i < 9; i++) el('line', { x1: 404 + i * 5, y1: 76, x2: 400 + i * 5, y2: 92, 'stroke-width': .4, opacity: .5 }, g);
  // the pond
  el('ellipse', { cx: 52, cy: 110, rx: 20, ry: 12, fill: '#d8d2c2', 'stroke-width': 1 }, g);
  // the green: a ring of trees
  for (let a = 0; a < 12; a++) el('circle', { cx: 246 + Math.cos(a / 12 * 6.283) * 13, cy: 170 + Math.sin(a / 12 * 6.283) * 11, r: 2.2, 'stroke-width': .6 }, g);
  // the church: nave, tower, cross; a yard of little stones
  el('rect', { x: 190, y: 62, width: 30, height: 14, 'stroke-width': 1, fill: '#d8d2c2' }, g);
  el('rect', { x: 184, y: 60, width: 8, height: 18, 'stroke-width': 1, fill: '#d8d2c2' }, g);
  el('path', { d: 'M188,56 l0,-8 M185,52 l6,0', 'stroke-width': 1 }, g);
  for (let i = 0; i < 10; i++) el('path', { d: `M${194 + (i % 5) * 6},${84 + Math.floor(i / 5) * 6} l0,-3`, 'stroke-width': .8 }, g);
  // the hall
  el('rect', { x: 286, y: 197, width: 24, height: 14, 'stroke-width': 1, fill: '#d8d2c2' }, g);
  // trees here and there
  const tr = rng(4);
  for (let i = 0; i < 60; i++) {
    const x = 14 + tr() * 452, y = 14 + tr() * 290;
    if (nearStreet(x, y, 14) || LANDMARKS.some(l => Math.hypot(l.x - x, l.y - y) < l.r + 8) || y > 284) continue;
    el('circle', { cx: x, cy: y, r: 2 + tr() * 1.6, 'stroke-width': .5, opacity: .7 }, g);
  }
  // streets
  const sg = el('g', { 'stroke-width': 3.2, stroke: ink }, g);
  const sg2 = el('g', { 'stroke-width': 1.8, stroke: '#ebe5d5' }, g);
  for (const pts of Object.values(STREETS)) {
    const d = 'M' + pts.map(p => p.join(',')).join(' L');
    el('path', { d }, sg); el('path', { d }, sg2);
  }
  // houses, both sides of every street
  const houses = [];
  for (const pts of Object.values(STREETS)) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len, ang = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
      for (let d = 6; d < len - 3; d += 9.5) {
        for (const side of [-1, 1]) {
          const x = ax + (bx - ax) * d / len + nx * 8.5 * side, y = ay + (by - ay) * d / len + ny * 8.5 * side;
          if (x < 14 || x > 466 || y < 14 || y > 284) continue;
          if (nearStreet(x, y, 6.5)) continue;
          if (LANDMARKS.some(l => l.r && Math.hypot(l.x - x, l.y - y) < l.r)) continue;
          if (houses.some(h => Math.hypot(h.x - x, h.y - y) < 7.5)) continue;
          houses.push({ x, y, ang });
        }
      }
    }
  }
  const baker = houses.reduce((a, h) => Math.hypot(h.x - 150, h.y - 182) < Math.hypot(a.x - 150, a.y - 182) ? h : a, houses[0]);
  const hr = rng(9);
  for (const h of houses) h.d = Math.hypot(h.x - baker.x, h.y - baker.y) + hr() * 70;
  houses.sort((a, b) => a.d - b.d);
  const hg = el('g', { 'stroke-width': .8, stroke: ink }, svg);
  for (const h of houses) {
    h.el = el('path', { d: 'M-3,-2.5 L3,-2.5 L3,2.5 L-3,2.5 Z M-3,-2.5 L0,-4.6 L3,-2.5', transform: `translate(${h.x.toFixed(1)} ${h.y.toFixed(1)}) rotate(${h.ang.toFixed(0)})`, fill: '#ebe5d5' }, hg);
  }
  el('path', { d: `M${baker.x},${baker.y - 13} l1.8,3.8 4,.4 -3,2.7 .9,4 -3.7,-2.1 -3.7,2.1 .9,-4 -3,-2.7 4,-.4 z`, fill: '#8e2a1c', stroke: 'none' }, svg);
  // bakeries along the High Street: little loaves
  const shops = [];
  const hs = STREETS['High Street'];
  for (let i = 0; i < 12; i++) {
    const u = .12 + i * .065, seg = Math.min(hs.length - 2, Math.floor(u * (hs.length - 1))), f = u * (hs.length - 1) - seg;
    const x = lerp(hs[seg][0], hs[seg + 1][0], f), y = lerp(hs[seg][1], hs[seg + 1][1], f) - 1;
    shops.push(el('path', { d: `M${x - 3},${y + 1.5} Q${x},${y - 3.5} ${x + 3},${y + 1.5} Z`, fill: '#8e2a1c', stroke: 'none', opacity: 0 }, svg));
  }
  // labels
  const lab = el('g', { 'font-family': "'Old Standard TT', Georgia, serif", 'font-size': 9, fill: ink, 'font-style': 'italic' }, svg);
  const text = (x, y, s, o = {}) => { const t = el('text', { x, y, ...o }, lab); t.textContent = s; return t; };
  text(266, 138, 'The Green'); text(176, 48, "St Crumb's"); text(26, 86, 'Mill Pond'); text(400, 50, 'Reservoir');
  text(282, 224, 'Village Hall'); text(196, 322, 'River Leaven'); text(60, 196, 'High St.', { 'font-size': 8 });
  const cart = el('g', {}, svg);
  el('rect', { x: 14, y: 14, width: 132, height: 34, fill: '#ebe5d5', stroke: ink, 'stroke-width': .8 }, cart);
  const ct = el('text', { x: 80, y: 28, 'text-anchor': 'middle', 'font-family': "'Old Standard TT', Georgia, serif", 'font-size': 10, 'letter-spacing': '1.2', fill: ink }, cart);
  ct.textContent = 'MUCH PROVING';
  const cs = el('text', { x: 80, y: 41, 'text-anchor': 'middle', 'font-family': "'Old Standard TT', Georgia, serif", 'font-size': 7.5, 'font-style': 'italic', fill: ink }, cart);
  cs.textContent = 'kitchens keeping a jar shaded';
  // compass
  const cp = el('g', { transform: 'translate(452 236)', stroke: ink, 'stroke-width': .7, fill: 'none' }, svg);
  el('circle', { r: 9 }, cp); el('path', { d: 'M0,-13 L2.5,0 L0,13 L-2.5,0 Z', fill: ink }, cp);
  const N = el('text', { x: -3, y: -15, 'font-size': 8, fill: ink, stroke: 'none', 'font-family': 'Georgia, serif' }, cp); N.textContent = 'N';

  let lit = -1, shopsLit = -1, res = false;
  return {
    houses: houses.length,
    draw(s) {
      const want = s.own.reservoir ? houses.length : Math.min(houses.length, Math.round(s.jars / 2400 * houses.length + (s.jars >= .5 ? .5 : 0)));
      if (want !== lit) {
        for (let i = 0; i < houses.length; i++) {
          const on = i < want || houses[i] === baker;
          const was = i < lit || houses[i] === baker;
          if (on !== was || lit < 0) houses[i].el.setAttribute('fill', on ? ink : '#ebe5d5');
        }
        lit = want;
      }
      const sl = Math.min(12, s.n.bakery);
      if (sl !== shopsLit) { shops.forEach((p, i) => p.setAttribute('opacity', i < sl ? 1 : 0)); shopsLit = sl; }
      if (!!s.own.reservoir !== res) {
        res = !!s.own.reservoir;
        resv.setAttribute('fill', res ? '#e9dcbc' : '#d8d2c2');
        resvFx.setAttribute('opacity', res ? 1 : 0); pipes.setAttribute('opacity', res ? .8 : 0);
      }
    },
  };
}
function nearStreet(x, y, d) {
  for (const pts of Object.values(STREETS)) for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const vx = bx - ax, vy = by - ay, t = clamp01(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy));
    if (Math.hypot(ax + vx * t - x, ay + vy * t - y) < d) return true;
  }
  return false;
}

// =================================================================================================================== world
// Every dot is a patch of the planet. Wheat takes the land kind by kind, in the order the projects open it up.
const BANDS = [['arable', 0, 11], ['pasture', 11, 36], ['forest', 36, 66], ['desert', 66, 86], ['tundra', 86, 96], ['ice', 96, 100]];
export function makeWorld(canvas) {
  const COLS = 120, ROWS = 54;
  const grid = dots(COLS, ROWS, 82, -70);
  const byKind = Object.fromEntries(KINDS.map(k => [k, grid.filter(d => d.kind === k).sort((a, b) => a.h - b.h)]));
  // the sea fills from the coasts outward: order it by distance from land, a breadth-first walk over the grid
  const far = new Array(grid.length).fill(Infinity), queue = [];
  grid.forEach((d, i) => { if (d.land) { far[i] = 0; queue.push(i); } });
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi], c = i % COLS, r = (i / COLS) | 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = (c + dc + COLS) % COLS, rr = r + dr;
      if (rr < 0 || rr >= ROWS) continue;
      const j = rr * COLS + cc;
      if (far[j] > far[i] + 1) { far[j] = far[i] + 1; queue.push(j); }
    }
  }
  const sea = grid.map((d, i) => ({ d, k: far[i] + d.h * 2.5 })).filter(x => !x.d.land).sort((a, b) => a.k - b.k).map(x => x.d);
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, t = 0, last = -1, base = null, baseKey = '', wheat = [], wheatKey = '';
  function size() {
    const box = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(200, Math.floor(box.width)), H = Math.round(W * ROWS / COLS * 1.04);
    if (W === w && H === h) return;
    w = W; h = H; canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + 'px';
    baseKey = '';
  }
  // the land and the sea (and any sea under wheat) only change now and then, so they're drawn once into a picture
  function paintBase(kelp) {
    base = base || document.createElement('canvas');
    base.width = canvas.width; base.height = canvas.height;
    const c = base.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = w / COLS, ch = h / ROWS, r0 = Math.min(cw, ch) * .36;
    const seaWheat = new Set(sea.slice(0, Math.round(sea.length * kelp / 100)));
    for (const d of grid) {
      let col, r = r0;
      if (seaWheat.has(d)) { col = 'rgba(196,172,96,.75)'; r = r0 * .9; }
      else if (d.land) col = d.kind === 'ice' ? 'rgba(170,196,190,.55)' : d.kind === 'desert' ? 'rgba(150,160,128,.55)' : 'rgba(120,152,132,.6)';
      else { col = 'rgba(70,120,110,.22)'; r = r0 * .55; }
      c.fillStyle = col;
      c.beginPath(); c.arc((d.c + .5) * cw, (d.r + .5) * ch, r, 0, 6.283); c.fill();
    }
  }
  return {
    draw(s, dt) {
      t += dt;
      size();
      const bk = `${s.n.kelp}|${w}|${h}`;
      if (bk !== baseKey) { paintBase(s.n.kelp); baseKey = bk; last = -1; }
      const wk = `${s.n.field}`;
      if (wk !== wheatKey) {
        wheatKey = wk; wheat = [];
        for (const [kind, a, b] of BANDS) {
          const f = clamp01((s.n.field - a) / (b - a)), list = byKind[kind];
          for (let i = 0; i < Math.round(f * list.length); i++) wheat.push(list[i]);
        }
        last = -1;
      }
      if (last >= 0 && t - last < .1) return;
      last = t;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(base, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cw = w / COLS, ch = h / ROWS, r0 = Math.min(cw, ch) * .36;
      const swell = s.own && s.own.crust ? Math.min(.6, Math.log10(1 + s.massT) / 40) : 0;
      for (const d of wheat) {
        const tw = .82 + .18 * Math.sin(t * 2 + d.h * 40);
        ctx.fillStyle = `rgba(227,189,104,${tw.toFixed(2)})`;
        ctx.beginPath(); ctx.arc((d.c + .5) * cw, (d.r + .5) * ch, r0 * (1.05 + swell * (.6 + .4 * Math.sin(t * 3 + d.h * 30))), 0, 6.283); ctx.fill();
      }
    },
  };
}

// =================================================================================================================== cosmos
// A starfield. You spread up it from the bottom like dough. Later the glass shows, and then the band.
export function makeCosmos(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, t = 0;
  let cold = null, warm = null, glassA = 0, bandA = 0, shown = 0;
  const stars = [], gals = [];
  const r = rng(23);
  for (let i = 0; i < 900; i++) stars.push({ x: r(), y: r(), m: r() ** 3, c: r() });
  for (let i = 0; i < 34; i++) gals.push({ x: .12 + r() * .76, y: .1 + r() * .82, s: .012 + r() * .022, a: r() * 6.28, tilt: .3 + r() * .5 });
  // the jar, in 0..1 units of the canvas
  const J = { x0: .14, x1: .86, top: .12, bot: .95, neck0: .3, neck1: .7, lid: .05 };
  function jarPath(c, add = false) {
    const X = v => v * w, Y = v => v * h;
    if (!add) c.beginPath();
    c.moveTo(X(J.x0), Y(J.top + .1));
    c.quadraticCurveTo(X(J.x0), Y(J.top + .02), X(J.neck0), Y(J.top));
    c.lineTo(X(J.neck0), Y(J.lid + .03));
    c.lineTo(X(J.neck1), Y(J.lid + .03));
    c.lineTo(X(J.neck1), Y(J.top));
    c.quadraticCurveTo(X(J.x1), Y(J.top + .02), X(J.x1), Y(J.top + .1));
    c.lineTo(X(J.x1), Y(J.bot - .03));
    c.quadraticCurveTo(X(J.x1), Y(J.bot), X(J.x1 - .04), Y(J.bot));
    c.lineTo(X(J.x0 + .04), Y(J.bot));
    c.quadraticCurveTo(X(J.x0), Y(J.bot), X(J.x0), Y(J.bot - .03));
    c.closePath();
  }
  function paint(c, hot) {
    c.clearRect(0, 0, w, h);
    for (const s of stars) {
      const a = .25 + s.m * .75, rad = (.5 + s.m * 1.5) * dpr;
      c.fillStyle = hot ? `rgba(255,${200 + s.c * 40 | 0},${120 + s.c * 60 | 0},${Math.min(1, a + .2)})` : `rgba(${200 + s.c * 40 | 0},${210 + s.c * 30 | 0},255,${a})`;
      c.beginPath(); c.arc(s.x * w * dpr, s.y * h * dpr, hot ? rad * 1.3 : rad, 0, 6.283); c.fill();
    }
    for (const g of gals) {
      c.save(); c.translate(g.x * w * dpr, g.y * h * dpr); c.rotate(g.a); c.scale(1, g.tilt);
      const R = g.s * w * dpr;
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, R);
      gr.addColorStop(0, hot ? 'rgba(255,214,140,.95)' : 'rgba(210,214,255,.7)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(0, 0, R, 0, 6.283); c.fill();
      c.strokeStyle = hot ? 'rgba(255,214,140,.5)' : 'rgba(200,205,255,.35)'; c.lineWidth = dpr;
      for (const k of [0, Math.PI]) { c.beginPath(); for (let i = 0; i < 18; i++) { const a = k + i * .3, rr = R * .15 + i * R * .05; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.stroke(); }
      c.restore();
    }
  }
  function size() {
    const box = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(220, Math.floor(box.width)), H = Math.round(Math.min(W * 1.08, Math.max(320, window.innerHeight * .7)));
    if (W === w && H === h && cold) return;
    w = W; h = H;
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + 'px';
    cold = document.createElement('canvas'); cold.width = canvas.width; cold.height = canvas.height;
    warm = document.createElement('canvas'); warm.width = canvas.width; warm.height = canvas.height;
    paint(cold.getContext('2d'), false); paint(warm.getContext('2d'), true);
  }
  return {
    draw(s, dt, view) {
      t += dt;
      size();
      const c = ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = '#05061a'; c.fillRect(0, 0, canvas.width, canvas.height);
      c.drawImage(cold, 0, 0);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      shown = lerp(shown, view.rise, Math.min(1, dt * 2));
      const level = lerp(J.bot, J.top + .04, shown) * h;
      const wob = 1.5 + view.over * 9;
      const warmth = view.warmth;
      // before the glass shows, you fill the whole sky; after, you're plainly inside something
      glassA = lerp(glassA, view.glass ? 1 : 0, Math.min(1, dt * .5));
      bandA = lerp(bandA, view.band ? 1 : 0, Math.min(1, dt * .5));
      const sx = lerp(-10, J.x0 * w + 2, glassA), ex = lerp(w + 10, J.x1 * w - 2, glassA);
      const surf = [];
      for (let i = 0; i <= 40; i++) {
        const u = i / 40, x = lerp(sx, ex, u);
        surf.push([x, level - Math.sin(Math.PI * u) * (10 + shown * 14) - Math.sin(u * 23 + t * 1.3) * wob - Math.sin(u * 9 - t * 2.1) * wob * .6]);
      }
      // the leavened part: warm stars, and a glow
      c.save();
      c.beginPath(); c.moveTo(sx, h + 10); for (const [x, y] of surf) c.lineTo(x, y); c.lineTo(ex, h + 10); c.closePath();
      c.clip();
      c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(warm, 0, 0); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const hue = lerp(48, 18, warmth), sat = lerp(25, 95, warmth);
      const gr = c.createLinearGradient(0, level - 30, 0, h);
      gr.addColorStop(0, `hsla(${hue},${sat}%,76%,.40)`);
      gr.addColorStop(.25, `hsla(${hue},${sat}%,64%,.22)`);
      gr.addColorStop(1, `hsla(${hue},${sat}%,52%,.16)`);
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.restore();
      c.strokeStyle = `hsla(${hue},${sat}%,80%,${.55 + view.over * .4})`; c.lineWidth = 1.6;
      c.shadowColor = `hsla(${hue},${sat}%,70%,.9)`; c.shadowBlur = 14;
      c.beginPath(); surf.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
      c.shadowBlur = 0;
      // bubbles rising through the dough
      c.strokeStyle = `hsla(${hue},${sat}%,86%,.5)`; c.lineWidth = 1;
      for (let i = 0; i < 18; i++) {
        const u = ((i * 0.618 + t * .03 * (1 + warmth)) % 1);
        const x = lerp(sx + 30, ex - 30, (i * .381) % 1), y = lerp(h, level + 8, u);
        if (y < level + 6) continue;
        c.beginPath(); c.arc(x, y, 1.5 + (i % 4), 0, 6.283); c.stroke();
      }
      // the glass, once you've reached it; then the band
      if (glassA > .01) {
        c.save();
        c.fillStyle = `rgba(5,6,26,${.82 * glassA})`;
        c.beginPath(); c.rect(0, 0, w, h); jarPath(c, true); c.fill('evenodd');
        jarPath(c);
        c.strokeStyle = `rgba(220,230,255,${.55 * glassA})`; c.lineWidth = 2.2; c.stroke();
        c.strokeStyle = `rgba(255,255,255,${.25 * glassA})`; c.lineWidth = 6;
        c.beginPath(); c.moveTo((J.x0 + .03) * w, (J.top + .16) * h); c.lineTo((J.x0 + .03) * w, (J.bot - .12) * h); c.stroke();
        c.fillStyle = `rgba(200,210,240,${.12 * glassA})`; c.fillRect(J.neck0 * w - 6, (J.lid - .01) * h, (J.neck1 - J.neck0) * w + 12, .04 * h);
        c.restore();
      }
      if (bandA > .01) {
        const by = (J.top + .14) * h;
        c.strokeStyle = `rgba(200,90,55,${.9 * bandA})`; c.lineWidth = 6;
        c.beginPath(); c.moveTo(J.x0 * w - 3, by); c.quadraticCurveTo(w / 2, by + 7, J.x1 * w + 3, by); c.stroke();
      }
    },
  };
}

// The jar at the very end: on the counter, risen to twice the band, with the universe inside it. A spoon comes.
export function drawEndJar(svg, spoonAt = 13.7) {
  svg.textContent = '';
  const ink = '#2b2620';
  const V = VESSELS.kilner;
  el('line', { x1: 0, y1: 263, x2: 240, y2: 263, stroke: ink, 'stroke-width': 1.2, opacity: .5 }, svg);
  const defs = el('defs', {}, svg);
  const cp = el('clipPath', { id: 'endclip' }, defs); el('path', { d: V.body }, cp);
  const gr = el('linearGradient', { id: 'endgrad', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el('stop', { offset: 0, 'stop-color': '#121640' }, gr);
  el('stop', { offset: .55, 'stop-color': '#3a2c52' }, gr);
  el('stop', { offset: 1, 'stop-color': '#b98a4e' }, gr);
  const g = el('g', { 'clip-path': 'url(#endclip)' }, svg);
  el('rect', { x: 50, y: 60, width: 140, height: 210, fill: 'rgba(255,255,255,.35)' }, g);
  el('path', { d: 'M56,104 Q120,80 184,104 L184,270 L56,270 Z', fill: 'url(#endgrad)' }, g);
  el('path', { d: 'M56,104 Q120,80 184,104', fill: 'none', stroke: '#f1c879', 'stroke-width': 1.4, opacity: .8 }, g);
  const r = rng(5);
  for (let i = 0; i < 90; i++) {
    const x = 62 + r() * 116, y = 100 + r() * 156;
    if (y < 104 - Math.sin(Math.PI * (x - 56) / 128) * 22) continue;
    el('circle', { cx: x, cy: y, r: .4 + r() * 1.3, fill: r() > .45 ? '#fff6dc' : '#ffd38a', opacity: .55 + r() * .45 }, g);
  }
  for (let i = 0; i < 5; i++) {
    const x = 74 + r() * 92, y = 120 + r() * 110;
    el('ellipse', { cx: x, cy: y, rx: 5 + r() * 3, ry: 2 + r() * 1.5, fill: '#ffd38a', opacity: .35, transform: `rotate(${r() * 180} ${x} ${y})` }, g);
  }
  for (let i = 0; i < 14; i++) el('circle', { cx: 66 + r() * 108, cy: 150 + r() * 100, r: 1.5 + r() * 3, fill: 'none', stroke: '#e8d4ad', 'stroke-width': .7, opacity: .6 }, g);
  el('path', { d: `M${V.x0 - 3},182 Q120,187 ${V.x1 + 3},182`, fill: 'none', stroke: '#b5562f', 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
  el('path', { d: V.body + ' ' + V.neck, fill: 'none', stroke: ink, 'stroke-width': 2.2 }, svg);
  el('path', { d: 'M70,60 Q120,32 170,60 Z', fill: 'rgba(255,255,255,.4)', stroke: ink, 'stroke-width': 2, transform: 'translate(0 -22) rotate(-8 170 60)' }, svg);
  el('path', { d: 'M70,104 L70,232', stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: .35 }, svg);
  const spoon = el('g', { class: 'spoon', style: `animation: spoon 2.4s ease-out ${spoonAt}s both` }, svg);
  el('path', { d: 'M150,8 L226,-60', stroke: '#8a8f99', 'stroke-width': 5, 'stroke-linecap': 'round' }, spoon);
  el('ellipse', { cx: 140, cy: 18, rx: 15, ry: 9, fill: '#c9ced6', stroke: '#6d727c', 'stroke-width': 1.4, transform: 'rotate(-42 140 18)' }, spoon);
}
