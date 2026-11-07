// The bus, drawn in a 400x300 world in plain greys (plus a little red and amber).
// main.js dithers the result down to the bus's inks, so nothing here needs to know about the palette.
export const W = 400, H = 300;
export const ROUTE_M = 300;          // metres between two stops
const MPZ = 9;                       // metres of road per unit of depth
const VX = 200, VY = 118;            // vanishing point (eye height, middle of the aisle)

const gray = v => `rgb(${v | 0},${v | 0},${v | 0})`;
const red = v => `rgb(${v | 0},0,0)`;
const amber = v => `rgb(${v | 0},${(v * .62) | 0},${(v * .12) | 0})`;
const K = z => 1 / (1 + .62 * z);
const P = (X, Y, z) => [VX + X * K(z), VY + Y * K(z)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ---------- the anomalies ----------
// view: 0 window, 1 ahead, 2 behind. at: fraction of the ride before it shows. focus: where "show me" looks.
export const ANOMS = [
  { id: 'driverGone', view: 1, d: 1, text: 'There was nobody driving the bus.', focus: [255, 105, 2.6] },
  { id: 'mirrorEmpty', view: 1, d: 3, text: 'The driver’s mirror had nobody in it.', focus: [195, 101, 3] },
  { id: 'adSleep', view: 1, d: 2, text: 'The mattress advert said DON’T SLEEP.', focus: [62, 45, 2.4] },
  { id: 'adSmile', view: 1, d: 2, text: 'The woman on the dentist’s advert was looking at you.', focus: [125, 73, 3] },
  { id: 'standing', view: 1, d: 1, text: 'Someone was standing in the aisle, facing you.', focus: [200, 120, 2.4] },
  { id: 'hoodieTurned', view: 1, d: 2, at: .3, text: 'The sleeping man in the hood woke up and turned round.', focus: [150, 118, 2.6] },
  { id: 'grannyTurned', view: 1, d: 2, text: 'The woman in the hat was facing backwards, at you.', focus: [270, 112, 2.4] },
  { id: 'lightsFlicker', view: 1, d: 1, text: 'The lights kept flickering.', focus: [200, 60, 1.6] },
  { id: 'nextStop', view: 1, d: 2, text: 'The stop sign said NOT IN SERVICE.', focus: [200, 89, 3] },
  { id: 'redPole', view: 1, d: 1, text: 'One of the yellow poles was red.', focus: [178, 130, 2] },
  { id: 'stopLit', view: 1, d: 2, text: 'Every STOP light was on, but nobody had rung.', focus: [205, 115, 2] },
  { id: 'newsHeadline', view: 1, d: 2, text: 'The back page of the newspaper said TURN AROUND.', focus: [238, 103, 3] },
  { id: 'rainInside', view: 1, d: 1, text: 'It was raining inside the bus.', focus: [200, 150, 1.4] },
  { id: 'tilt', view: 1, d: 3, text: 'The whole bus was leaning to one side.', focus: [200, 150, 1] },
  { id: 'longBus', view: 1, d: 3, text: 'The bus was longer. Two more rows of seats.', focus: [200, 125, 1.8] },
  { id: 'handOnSeat', view: 1, d: 2, text: 'A hand was holding the seat in front of you. Nobody was sitting there.', focus: [90, 150, 2.6] },
  { id: 'teenDouble', view: 1, d: 3, text: 'The boy with headphones was sitting next to himself.', focus: [150, 115, 3] },

  { id: 'noReflection', view: 0, d: 2, text: 'You had no reflection in the window.', focus: [120, 140, 2] },
  { id: 'reflectionSmile', view: 0, d: 2, at: .35, text: 'Your reflection smiled. You didn’t.', focus: [120, 135, 2.4] },
  { id: 'reflectionBehind', view: 0, d: 2, text: 'In the window, someone was sitting behind you. The seat was empty.', focus: [180, 130, 2] },
  { id: 'mirroredSigns', view: 0, d: 2, text: 'The shop signs were back to front.', focus: [200, 112, 1.6] },
  { id: 'sameShop', view: 0, d: 2, text: 'Every shop was the same launderette.', focus: [200, 120, 1.4] },
  { id: 'pacer', view: 0, d: 1, at: .2, text: 'Someone on the pavement kept up with the bus the whole way.', focus: [272, 160, 2.4] },
  { id: 'rainUp', view: 0, d: 3, text: 'The rain on the window was running upwards.', focus: [260, 120, 2] },
  { id: 'redMoon', view: 0, d: 1, text: 'The moon was red.', focus: [88, 64, 3] },
  { id: 'handprint', view: 0, d: 2, text: 'There was a handprint on the outside of your window.', focus: [300, 120, 2.4] },

  { id: 'twins', view: 2, d: 2, text: 'The couple on the back seat were the same man, twice.', focus: [160, 128, 2.4] },
  { id: 'sleeperAwake', view: 2, d: 2, text: 'The old man on the back seat was awake, and staring.', focus: [260, 124, 3] },
  { id: 'balloonDown', view: 2, d: 2, text: 'The girl’s balloon was hanging downwards.', focus: [140, 200, 1.8] },
  { id: 'emptyBack', view: 2, d: 1, text: 'Everyone on the back seat had gone.', focus: [200, 130, 1.8] },
  { id: 'doorsOpen', view: 2, d: 1, text: 'The doors were open while the bus was moving.', focus: [330, 150, 1.6] },
  { id: 'redHeadlights', view: 2, d: 2, text: 'The car behind had red headlights.', focus: [200, 98, 3] },
  { id: 'rearFace', view: 2, d: 1, text: 'A face was pressed against the back window.', focus: [200, 88, 2.6] },
  { id: 'childGone', view: 2, d: 2, text: 'The girl had gone. Her balloon was still there.', focus: [130, 140, 2] },
];
export const ANOM = Object.fromEntries(ANOMS.map(a => [a.id, a]));

// ---------- the route (identical every ride) ----------
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const NAMES = ['KEBABS', 'LAUNDERETTE', 'BOOKMAKER', 'CHIPS', 'TO LET', 'OFF LICENCE', 'DENTIST', 'PAWNBROKER', 'NAILS', 'TAXIS', 'PHONES', 'BAKERY', 'CHEMIST', 'TATTOO', 'PIZZA', 'VIDEO'];
const rnd = mulberry(2352);
const SHOPS = [];
for (let m = -50, i = 0; m < ROUTE_M + 70; i++) {
  const w = 14 + (rnd() * 7 | 0);
  if (Math.abs(m + w / 2 - 0) > 9 && Math.abs(m + w / 2 - ROUTE_M) > 9 && Math.abs(m + w / 2 - 120) > 8)
    SHOPS.push({ m, w, name: NAMES[(i * 7) % NAMES.length], lit: .45 + rnd() * .55, dark: rnd() < .2, sign: rnd() < .5 });
  m += w + 1.5;
}
const LAMPS = []; for (let m = -40; m < ROUTE_M + 80; m += 23) LAMPS.push(m);
const SKY = []; for (let x = -200, r = mulberry(7); x < 1400; ) { const w = 22 + r() * 40; SKY.push({ x, w, h: 30 + r() * 70, win: r() }); x += w + 2; }
const DROPS = []; for (let i = 0, r = mulberry(99); i < 80; i++) DROPS.push({ x: r() * 400, y: r() * 200, v: .6 + r() * .8, l: 2 + r() * 6 });
const SHELTERS = [0, 120, ROUTE_M];

// distance along the route at time t (0..1): pull away, cruise, brake into the stop
const SPEED = t => { const s = x => x * x * (3 - 2 * x); return s(clamp(t / .08, 0, 1)) * s(clamp((1 - t) / .15, 0, 1)); };
const DIST = (() => { const n = 600, a = new Float32Array(n + 1); let s = 0; for (let i = 1; i <= n; i++) { s += SPEED((i - .5) / n); a[i] = s; } for (let i = 0; i <= n; i++) a[i] *= ROUTE_M / s; return a; })();
export const routeSpeed = SPEED;
export function routeDist(t) { const f = clamp(t, 0, 1) * 600, i = Math.min(599, f | 0); return DIST[i] + (DIST[i + 1] - DIST[i]) * (f - i); }

// ---------- helpers ----------
function poly(c, pts, fill) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } }
function rrect(c, x, y, w, h, r, fill) { c.beginPath(); c.roundRect(x, y, w, h, r); if (fill) { c.fillStyle = fill; c.fill(); } }
function ell(c, x, y, rx, ry, fill, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } }
function glow(c, x, y, r, v, a = 1, col = gray) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col(v)); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1;
}
// draws a texture onto a perspective quad, in thin slices so the foreshortening is right. f(u,v) -> screen point
function texQuad(c, img, f, n = 10) {
  const iw = img.width, ih = img.height;
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 1) / n;
    const a = f(u0, 0), b = f(u1, 0), d = f(u0, 1);
    c.save();
    c.transform((b[0] - a[0]) / (iw / n), (b[1] - a[1]) / (iw / n), (d[0] - a[0]) / ih, (d[1] - a[1]) / ih, a[0], a[1]);
    c.drawImage(img, u0 * iw, 0, iw / n + .6, ih, 0, 0, iw / n + .6, ih);
    c.restore();
  }
}

// ---------- textures (built once the font is in) ----------
const TEX = {};
const FONT = s => `${s}px Tiny5, monospace`;
function tex(key, w, h, draw) {
  if (TEX[key]) return TEX[key];
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); draw(c, w, h); return (TEX[key] = cv);
}
const adMattress = alt => tex('mat' + alt, 240, 80, (c, w, h) => {
  c.fillStyle = gray(222); c.fillRect(0, 0, w, h);
  c.fillStyle = gray(40); c.fillRect(0, 0, w, 18);
  c.fillStyle = gray(230); c.font = FONT(16); c.textBaseline = 'top'; c.fillText('DORMA BEDS', 8, 1);
  c.fillStyle = gray(30); c.font = FONT(32); c.fillText(alt ? 'DON’T SLEEP' : 'SLEEP WELL', 10, 26);
  // a little bed with a crescent moon
  c.fillStyle = gray(120); c.fillRect(178, 60, 54, 8); c.fillRect(178, 50, 8, 18); c.fillStyle = gray(175); c.fillRect(186, 54, 46, 7);
  ell(c, 214, 32, 9, 9, gray(70)); ell(c, 218, 29, 8, 8, gray(222));
  c.fillStyle = gray(90); c.font = FONT(8); c.fillText('0161 555 0140', 10, 66);
});
const adSmile = alt => tex('smile' + alt, 200, 90, (c, w, h) => {
  c.fillStyle = gray(200); c.fillRect(0, 0, w, h);
  c.fillStyle = gray(150); c.fillRect(0, 0, 90, h);
  // a face in profile-ish three-quarter, looking off to the right; or at you
  ell(c, 46, 44, 26, 32, gray(215)); c.fillStyle = gray(60); c.beginPath(); c.ellipse(44, 26, 30, 22, 0, Math.PI, 0); c.fill(); c.fillRect(14, 22, 10, 50); c.fillRect(66, 22, 9, 30);
  if (alt) { ell(c, 36, 44, 4, 4, gray(20)); ell(c, 56, 44, 4, 4, gray(20)); c.strokeStyle = gray(30); c.lineWidth = 3; c.beginPath(); c.arc(46, 54, 12, .2, Math.PI - .2); c.stroke(); }
  else { ell(c, 42, 44, 3.5, 2, gray(30)); ell(c, 60, 44, 3.5, 2, gray(30)); c.fillStyle = gray(60); c.fillRect(42, 64, 16, 3); }
  c.fillStyle = gray(30); c.font = FONT(24); c.textBaseline = 'top'; c.fillText('SMILE', 100, 10);
  c.font = FONT(16); c.fillText('DENTAL', 100, 38); c.fillStyle = gray(80); c.font = FONT(8); c.fillText('NEW PATIENTS', 100, 62); c.fillText('WELCOME', 100, 72);
});
const adDrive = () => tex('drive', 240, 80, (c, w, h) => {
  c.fillStyle = gray(185); c.fillRect(0, 0, w, h);
  c.fillStyle = gray(30); c.font = FONT(24); c.textBaseline = 'top'; c.fillText('LEARN TO', 10, 6); c.fillText('DRIVE', 10, 32);
  c.font = FONT(8); c.fillText('FIRST LESSON FREE', 10, 62);
  c.fillStyle = gray(60); rrect(c, 150, 30, 70, 22, 6, gray(60)); ell(c, 165, 54, 7, 7, gray(20)); ell(c, 205, 54, 7, 7, gray(20)); rrect(c, 162, 18, 44, 16, 5, gray(60));
  c.fillStyle = gray(230); c.fillRect(176, 36, 12, 10); c.fillStyle = gray(30); c.font = FONT(8); c.fillText('L', 179, 37);
});
const adLink = () => tex('link', 240, 80, (c, w, h) => {
  c.fillStyle = gray(60); c.fillRect(0, 0, w, h);
  c.fillStyle = gray(230); c.font = FONT(16); c.textBaseline = 'top'; c.fillText('CITYLINK', 10, 8);
  c.font = FONT(24); c.fillText('NEARLY HOME', 10, 34);
  c.fillStyle = gray(140); c.font = FONT(8); c.fillText('NIGHT SERVICES EVERY 40 MIN', 10, 64);
});
const paper = alt => tex('paper' + alt, 160, 120, (c, w, h) => {
  c.fillStyle = gray(212); c.fillRect(0, 0, w, h);
  c.fillStyle = gray(30); c.font = FONT(24); c.textBaseline = 'top';
  c.fillText(alt ? 'TURN' : 'ROVERS 0', 8, 6); c.fillText(alt ? 'AROUND' : 'CITY 0', 8, 30);
  c.fillStyle = gray(120); for (let col = 0; col < 3; col++) for (let y = 62; y < 112; y += 5) c.fillRect(8 + col * 50, y, 42 - ((y * 7 + col * 3) % 13), 2);
  c.fillStyle = gray(150); c.fillRect(110, 8, 42, 40);
});
const sign = (name, flip) => tex('sign' + name + flip, 160, 24, (c, w, h) => {
  c.fillStyle = gray(0); c.fillRect(0, 0, w, h);
  c.fillStyle = gray(255); c.font = FONT(16); c.textBaseline = 'middle'; c.textAlign = 'center';
  if (flip) { c.translate(w, 0); c.scale(-1, 1); }
  c.fillText(name, w / 2, h / 2 + 1);
});
export function warmTextures() { adMattress(0); adMattress(1); adSmile(0); adSmile(1); adDrive(); adLink(); paper(0); paper(1); }

// ---------- people ----------
function face(c, x, y, r, o = {}) {
  const skin = gray(o.skin ?? 178);
  if (o.back) { // the back of a head
    ell(c, x, y, r, r * 1.08, gray(o.hair ?? 70));
    return;
  }
  ell(c, x, y, r * .92, r * 1.08, skin);
  if (o.hair !== null) { c.fillStyle = gray(o.hair ?? 60); c.beginPath(); c.ellipse(x, y - r * .25, r * .98, r * .9, 0, Math.PI, 0); c.fill(); }
  const ey = y + r * .1, ex = r * .36;
  if (o.eyes === 'closed') { c.fillStyle = gray(70); c.fillRect(x - ex - r * .18, ey, r * .36, r * .09); c.fillRect(x + ex - r * .18, ey, r * .36, r * .09); }
  else if (o.eyes === 'black') { ell(c, x - ex, ey, r * .2, r * .24, gray(5)); ell(c, x + ex, ey, r * .2, r * .24, gray(5)); }
  else if (o.eyes === 'wide') { ell(c, x - ex, ey, r * .2, r * .2, gray(240)); ell(c, x + ex, ey, r * .2, r * .2, gray(240)); ell(c, x - ex, ey, r * .09, r * .09, gray(10)); ell(c, x + ex, ey, r * .09, r * .09, gray(10)); }
  else { ell(c, x - ex, ey, r * .12, r * .12, gray(30)); ell(c, x + ex, ey, r * .12, r * .12, gray(30)); }
  if (o.mouth === 'grin') { c.fillStyle = gray(10); c.beginPath(); c.ellipse(x, y + r * .5, r * .55, r * .22, 0, 0, Math.PI); c.fill(); }
  else if (o.mouth === 'open') ell(c, x, y + r * .55, r * .14, r * .12, gray(50));
  else { c.fillStyle = gray(110); c.fillRect(x - r * .25, y + r * .52, r * .5, r * .08); }
}
function body(c, x, y, w, h, v) { rrect(c, x - w / 2, y, w, h, w * .3, gray(v)); }

// ---------- AHEAD ----------
function drawAhead(c, s) {
  const a = s.a, long = a('longBus'), FZ = long ? 4 : 3;
  c.fillStyle = gray(18); c.fillRect(-50, -50, W + 100, H + 100);
  if (a('tilt')) { c.translate(200, 150); c.rotate(.07); c.translate(-200, -150); }
  const lightsOff = a('lightsFlicker') && flickerOff(s.sec);

  // ceiling, coving, walls, floor
  poly(c, [P(-160, -150, 0), P(160, -150, 0), P(160, -150, FZ), P(-160, -150, FZ)], gray(128));
  poly(c, [P(-160, -150, 0), P(-205, -100, 0), P(-205, -100, FZ), P(-160, -150, FZ)], gray(98));
  poly(c, [P(160, -150, 0), P(205, -100, 0), P(205, -100, FZ), P(160, -150, FZ)], gray(98));
  poly(c, [P(-205, 22, 0), P(-205, 210, 0), P(-205, 210, FZ), P(-205, 22, FZ)], gray(66));
  poly(c, [P(205, 22, 0), P(205, 210, 0), P(205, 210, FZ), P(205, 22, FZ)], gray(66));
  poly(c, [P(-205, 210, 0), P(205, 210, 0), P(205, 210, FZ), P(-205, 210, FZ)], gray(46));
  poly(c, [P(-14, 210, 0), P(14, 210, 0), P(14, 210, FZ), P(-14, 210, FZ)], gray(60));
  // strip lights
  for (let z = .1; z < FZ - .3; z += .75) for (const X of [-100, 70]) {
    const off = lightsOff && (z > .7 && z < 2.5);
    poly(c, [P(X - 8, -150, z - .06), P(X + 38, -150, z - .06), P(X + 38, -150, z + .56), P(X - 8, -150, z + .56)], gray(off ? 95 : 168));
    poly(c, [P(X, -150, z), P(X + 30, -150, z), P(X + 30, -150, z + .5), P(X, -150, z + .5)], gray(off ? 70 : 255));
  }
  // adverts on the coving
  const coveL = (z0, z1) => (u, v) => P(-160 - 45 * v, -150 + 50 * v, z0 + (z1 - z0) * u);
  const coveR = (z0, z1) => (u, v) => P(160 + 45 * v, -150 + 50 * v, z1 - (z1 - z0) * u);
  texQuad(c, adMattress(a('adSleep') ? 1 : 0), coveL(.06, .8));
  texQuad(c, adSmile(a('adSmile') ? 1 : 0), coveL(1.0, 1.65));
  texQuad(c, adDrive(), coveR(.06, .8));
  texQuad(c, adLink(), coveR(1.0, 1.75));
  if (long) { texQuad(c, adDrive(), coveL(2.0, 2.6)); texQuad(c, adLink(), coveR(2.0, 2.6)); }

  // side windows, with the street going by
  sideWindow(c, s, -1, FZ, false); sideWindow(c, s, 1, FZ, false);

  // front wall and windscreen
  const fw = [P(-205, -100, FZ), P(205, -100, FZ), P(205, 210, FZ), P(-205, 210, FZ)];
  poly(c, [P(-160, -150, FZ), P(160, -150, FZ), P(205, -100, FZ), P(205, 210, FZ), P(-205, 210, FZ), P(-205, -100, FZ)], gray(74));
  c.save(); poly(c, [P(-192, -92, FZ), P(192, -92, FZ), P(192, 60, FZ), P(-192, 60, FZ)]); c.clip();
  windscreen(c, s, FZ); c.restore();
  // next-stop sign
  { const [x0, y0] = P(-112, -146, FZ), k = K(FZ); rrect(c, x0, y0, 224 * k, 42 * k, 3 * k, gray(8));
    c.save(); c.translate(x0, y0); c.scale(k, k); c.font = FONT(24); c.textAlign = 'center'; c.textBaseline = 'middle';
    let txt, col = amber(255);
    if (s.rang) { txt = 'BUS STOPPING'; col = red(255); }
    else txt = (s.sec % 5) < 2.2 ? 'NEXT STOP' : (a('nextStop') ? 'NOT IN SERVICE' : s.stop.toUpperCase());
    c.fillStyle = col; c.fillText(txt, 112, 23, 212); c.restore(); }
  // driver's cab
  const cz = FZ - .32;
  if (!a('driverGone')) {
    const [hx, hy] = P(72, -34, FZ - .16), k = K(FZ - .16);
    body(c, hx, hy + 14 * k, 92 * k, 120 * k, 150);
    face(c, hx, hy, 25 * k, { back: true, hair: 110 });
    c.fillStyle = gray(70); c.beginPath(); c.ellipse(hx, hy - 12 * k, 27 * k, 15 * k, 0, Math.PI, 0); c.fill(); c.fillRect(hx - 30 * k, hy - 13 * k, 60 * k, 5 * k);
  } else { const [hx, hy] = P(72, -22, FZ - .1), k = K(FZ - .1); rrect(c, hx - 24 * k, hy - 18 * k, 48 * k, 50 * k, 8 * k, gray(60)); }
  { const k = K(cz); const [x0, y0] = P(42, -36, cz);
    c.globalAlpha = .18; c.fillStyle = gray(220); c.fillRect(x0, y0, 170 * k, 66 * k); c.globalAlpha = 1;
    c.fillStyle = gray(84); c.fillRect(x0, y0 + 64 * k, 170 * k, 160 * k); c.fillStyle = gray(110); c.fillRect(x0, y0 - 2 * k, 170 * k, 4 * k); c.fillRect(x0, y0 + 62 * k, 170 * k, 5 * k); }
  // interior mirror
  { const [mx, my] = P(-10, -78, FZ - .05), k = K(FZ - .05);
    ell(c, mx, my, 40 * k, 13 * k, gray(25)); ell(c, mx, my, 36 * k, 10 * k, gray(98));
    if (!a('mirrorEmpty') && !a('driverGone')) { ell(c, mx - 9 * k, my, 6 * k, 3.5 * k, gray(200)); ell(c, mx + 11 * k, my, 6 * k, 3.5 * k, gray(200)); ell(c, mx - 8 * k, my, 2.6 * k, 2.6 * k, gray(20)); ell(c, mx + 12 * k, my, 2.6 * k, 2.6 * k, gray(20)); c.fillStyle = gray(60); c.fillRect(mx - 18 * k, my - 7 * k, 36 * k, 2.4 * k); }
  }

  // rows of seats, far to near, with poles and people in between
  const items = [];
  const rows = []; for (let z = .45; z < FZ - .45; z += .5) rows.push(z);
  for (const z of rows) items.push({ z, f: () => seatRowAhead(c, s, z) });
  for (let z = 1.2, i = 0; z < FZ - .5; z += 1, i++) items.push({ z: z - .001, f: () => pole(c, i % 2 ? 38 : -38, z, a('redPole') && i === 0, s) });
  if (a('standing')) items.push({ z: FZ - .85, f: () => standing(c, FZ - .85, s) });
  items.sort((p, q) => q.z - p.z).forEach(i => i.f());

  if (a('rainInside')) {
    { const [x0, y0] = P(-60, 210, .9), [x1] = P(60, 210, .9); ell(c, (x0 + x1) / 2, y0 + 4, (x1 - x0) / 2, 7, gray(150)); ell(c, (x0 + x1) / 2, y0 + 4, (x1 - x0) / 3, 4, gray(205)); }
    c.strokeStyle = gray(225); c.lineWidth = 1.3; c.globalAlpha = .75;
    for (let i = 0; i < 70; i++) { const z = .3 + (i * .618 % 1) * (FZ - .5), X = ((i * 73) % 380) - 190, k = K(z);
      const Y = -150 + ((s.sec * 260 + i * 97) % 360); const [x, y] = P(X, Y, z); c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 14 * k); c.stroke(); }
    c.globalAlpha = 1;
  }
  // fluorescent bloom and a vignette
  glow(c, 200, 30, 180, 140, lightsOff ? .05 : .22);
  const vg = c.createRadialGradient(200, 150, 120, 200, 150, 300); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
  c.fillStyle = vg; c.fillRect(-60, -60, W + 120, H + 120);
  if (lightsOff) { c.fillStyle = 'rgba(0,0,0,.42)'; c.fillRect(-60, -60, W + 120, H + 120); }
}
function flickerOff(sec) { const p = sec % 3.4; return (p < .5 && ((p * 22) | 0) % 2 === 0) || (p > 1.6 && p < 1.75); }

function pole(c, X, z, isRed, s) {
  const k = K(z), [x, y0] = P(X, -150, z), y1 = P(X, 210, z)[1];
  c.fillStyle = isRed ? red(215) : gray(222); c.fillRect(x - 3.5 * k, y0, 7 * k, y1 - y0);
  c.fillStyle = isRed ? red(120) : gray(150); c.fillRect(x + 1 * k, y0, 2 * k, y1 - y0);
  // the STOP push
  const lit = s.rang || s.a('stopLit'), by = P(X, -8, z)[1];
  rrect(c, x - 5 * k, by - 6 * k, 10 * k, 12 * k, 2 * k, red(lit ? 255 : 110));
  if (lit) glow(c, x, by, 22 * k, 255, .6, red);
}
function seatBack(c, X0, X1, z, v = 86) {
  const k = K(z), [x0, y0] = P(X0, 30, z), [x1] = P(X1, 30, z), y1 = P(0, 210, z)[1];
  // top surface first, then the back
  poly(c, [P(X0 + 4, 30, z + .1), P(X1 - 4, 30, z + .1), P(X1, 34, z), P(X0, 34, z)], gray(v + 20));
  rrect(c, x0, y0, x1 - x0, y1 - y0, 12 * k, gray(v));
  c.fillStyle = gray(v + 30); c.fillRect(x0 + 6 * k, y0 + 10 * k, x1 - x0 - 12 * k, 14 * k);
  c.fillStyle = gray(v - 22); for (let i = 1; i < 4; i++) c.fillRect(x0 + 4 * k, y0 + (30 + i * 22) * k, x1 - x0 - 8 * k, 3 * k);
  const hx = X0 < 0 ? x1 - 34 * k : x0 + 6 * k; rrect(c, hx, y0 - 6 * k, 28 * k, 8 * k, 3 * k, gray(205));
}
function seatRowAhead(c, s, z) {
  const a = s.a, k = K(z + .14), hz = z + .14;
  const head = (X, Y = -10) => P(X, Y, hz);
  // people sit just beyond their seat back
  if (Math.abs(z - 1.45) < .01) { // the woman in the hat, window seat on the right
    const [x, y] = head(140, -6), r = 24 * k;
    body(c, x, y + 10 * k, 84 * k, 80 * k, 92);
    if (a('grannyTurned')) face(c, x, y, r, { hair: 150, eyes: 'wide', skin: 170 }); else { face(c, x, y, r, { back: true, hair: 150 }); for (let i = 0; i < 6; i++) ell(c, x - r * .6 + i * r * .24, y + r * .3 + (i % 2) * r * .2, r * .2, r * .2, gray(172)); }
    ell(c, x, y - r * .7, r * 1.45, r * .32, gray(205)); c.fillStyle = gray(64); c.beginPath(); c.ellipse(x, y - r * .75, r * .85, r * .75, 0, Math.PI, 0); c.fill();
    ell(c, x + r * .55, y - r * 1.0, r * .2, r * .2, red(200));
  }
  if (Math.abs(z - 2.45) < .01) { // the newspaper reader, aisle seat on the left
    const pz = z + .1, pk = K(pz);
    texQuad(c, paper(a('newsHeadline') ? 1 : 0), (u, v) => P(-125 + 96 * u, -66 + 72 * v + 5 * u, pz), 6);
    const [lx, ly] = P(-125, -30, pz), [rx, ry] = P(-29, -26, pz);
    ell(c, lx, ly, 6 * pk, 9 * pk, gray(178)); ell(c, rx, ry, 6 * pk, 9 * pk, gray(178));
  }
  if (Math.abs(z - .95) < .01) { // the man asleep in his hood against the window
    if (a('hoodieTurned')) { const [x, y] = head(-140, -12), r = 25 * k; body(c, x, y + 10 * k, 86 * k, 80 * k, 96); ell(c, x, y, r * 1.18, r * 1.25, gray(108)); face(c, x, y + r * .1, r * .78, { hair: null, eyes: 'black', skin: 170 }); }
    else { const [x, y] = head(-160, 0), r = 25 * k; body(c, x + 8 * k, y + 8 * k, 86 * k, 80 * k, 96); ell(c, x, y, r * 1.1, r * 1.22, gray(108), -.4); ell(c, x + 4 * k, y - r * .15, r * .72, r * .9, gray(84), -.4); }
  }
  if (Math.abs(z - 1.95) < .01) { // the boy with headphones, nodding along
    const bob = Math.sin(s.sec * 11) * 1.6;
    const one = X => { const [x, y] = head(X, -8 + bob), r = 23 * k; body(c, x, y + 10 * k - bob * k, 78 * k, 80 * k, 60); face(c, x, y, r, { back: true, hair: 28 });
      c.strokeStyle = gray(215); c.lineWidth = 4 * k; c.beginPath(); c.arc(x, y, r * 1.05, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      ell(c, x - r, y + r * .1, 6 * k, 9 * k, gray(215)); ell(c, x + r, y + r * .1, 6 * k, 9 * k, gray(215)); };
    one(-158); if (a('teenDouble')) one(-92);
  }
  seatBack(c, -200, -38, z); seatBack(c, 38, 200, z);
  if (Math.abs(z - .45) < .01 && a('handOnSeat')) {
    const k2 = K(z); for (let i = 0; i < 4; i++) { const [x, y] = P(-150 + i * 13, 31, z - .02); ell(c, x, y, 6.5 * k2, 9 * k2, gray(205)); ell(c, x, y + 4 * k2, 5 * k2, 3 * k2, gray(150)); }
    const [tx, ty] = P(-160, 40, z - .03); ell(c, tx, ty, 6 * k2, 8 * k2, gray(190));
  }
}
function standing(c, z, s) {
  const k = K(z), [x, y] = P(0, -112, z), r = 21 * k, [, fy] = P(0, 210, z);
  rrect(c, x - 30 * k, y + r, 60 * k, fy - y - r, 14 * k, gray(22));
  rrect(c, x - 8 * k, y + r * .8, 16 * k, 10 * k, 2 * k, gray(150));
  face(c, x, y, r, { hair: 20, eyes: 'black', skin: 158 });
}
function windscreen(c, s, FZ) {
  const g = c.createLinearGradient(0, 70, 0, 120); g.addColorStop(0, gray(6)); g.addColorStop(1, gray(28));
  c.fillStyle = g; c.fillRect(0, 60, W, 70);
  poly(c, [P(-330, 250, FZ), P(330, 250, FZ), P(330, 250, 80), P(-330, 250, 80)], gray(24));
  const S = s.S;
  for (let m = Math.ceil(S / 7) * 7; m < S + 260; m += 7) { const z = (m - S) / MPZ; if (z < FZ) continue; poly(c, [P(-5, 250, z), P(5, 250, z), P(5, 250, z + .35), P(-5, 250, z + .35)], gray(150)); }
  for (let i = LAMPS.length - 1; i >= 0; i--) { const z = (LAMPS[i] - S) / MPZ; if (z < FZ || z > 30) continue;
    for (const X of [-360, 360]) { const [x, y0] = P(X, -260, z), y1 = P(X, 250, z)[1]; c.fillStyle = gray(60); c.fillRect(x - 3 * K(z), y0, 6 * K(z), y1 - y0); glow(c, x, y0, 70 * K(z) + 4, 255, .9); } }
}
// the street seen through a side window from inside, looking along the bus
function sideWindow(c, s, side, FZ, back) {
  const X = 205 * side, S = s.S;
  const quad = [P(X, -100, 0), P(X, 22, 0), P(X, 22, FZ), P(X, -100, FZ)];
  c.save(); poly(c, quad, gray(12)); c.clip();
  const zOf = m => back ? (S - m) / MPZ : (m - S) / MPZ;
  const XO = X + 70 * side;
  const near = side === (back ? 1 : -1); // the pavement on our side, with the shops
  if (near) for (const sh of SHOPS) {
    let z0 = zOf(sh.m), z1 = zOf(sh.m + sh.w * .8); if (z0 > z1) [z0, z1] = [z1, z0];
    if (z1 < 0 || z0 > FZ + 1) continue;
    poly(c, [P(XO, -60, z0), P(XO, 30, z0), P(XO, 30, z1), P(XO, -60, z1)], gray(sh.dark ? 26 : 40 + sh.lit * 80));
    poly(c, [P(XO, -84, z0), P(XO, -66, z0), P(XO, -66, z1), P(XO, -84, z1)], gray(sh.sign ? 120 : 60));
  }
  for (const m of LAMPS) { const z = zOf(m + (near ? 0 : 11)); if (z < -.2 || z > FZ + 1) continue; const [x, y] = P(XO + 30 * side, -96, z); glow(c, x, y, (near ? 90 : 60) * K(z), 255, near ? .95 : .6); }
  c.restore();
  // window pillars and the top sliding pane
  for (let z = .55; z < FZ; z += 1) poly(c, [P(X, -100, z - .04), P(X, 22, z - .04), P(X, 22, z + .04), P(X, -100, z + .04)], gray(54));
  poly(c, [P(X, -46, 0), P(X, -41, 0), P(X, -41, FZ), P(X, -46, FZ)], gray(80));
  poly(c, [P(X, 18, 0), P(X, 26, 0), P(X, 26, FZ), P(X, 18, FZ)], gray(90));
}

// ---------- WINDOW ----------
function drawWindow(c, s) {
  const a = s.a, S = s.S, ox = m => 200 + (m - S) * 9;
  c.fillStyle = gray(60); c.fillRect(-50, -50, W + 100, H + 100);
  c.save(); rrect(c, 24, 36, 352, 178, 14); c.clip();
  const g = c.createLinearGradient(0, 36, 0, 170); g.addColorStop(0, gray(5)); g.addColorStop(1, gray(30)); c.fillStyle = g; c.fillRect(0, 36, W, 180);
  // moon
  if (a('redMoon')) { glow(c, 88, 64, 34, 200, .7, red); ell(c, 88, 64, 11, 11, red(235)); }
  else { glow(c, 88, 64, 34, 140, .6); ell(c, 88, 64, 11, 11, gray(232)); ell(c, 84, 61, 3, 3, gray(200)); ell(c, 92, 68, 2, 2, gray(205)); }
  // the town behind, slow
  for (const b of SKY) { const x = b.x - S * 2.2; const xx = ((x % 1500) + 1500) % 1500 - 200; if (xx > 420 || xx + b.w < -20) continue;
    c.fillStyle = gray(16); c.fillRect(xx, 150 - b.h, b.w, b.h + 50);
    for (let wy = 156 - b.h; wy < 140; wy += 9) for (let wx = xx + 4; wx < xx + b.w - 5; wx += 8) if (((wx * 13 + wy * 7 + b.win * 99) | 0) % 5 === 0) { c.fillStyle = gray(84); c.fillRect(wx, wy, 3, 4); } }
  // shops along our pavement
  for (const sh of SHOPS) {
    const x0 = ox(sh.m), w = sh.w * 9; if (x0 > 410 || x0 + w < -10) continue;
    c.fillStyle = gray(28); c.fillRect(x0, 92, w, 110);
    const name = a('sameShop') ? 'LAUNDERETTE' : sh.name;
    if (sh.dark && !a('sameShop')) { c.fillStyle = gray(48); c.fillRect(x0 + 6, 128, w - 12, 64); c.fillStyle = gray(36); for (let y = 131; y < 192; y += 5) c.fillRect(x0 + 6, y, w - 12, 2); }
    else { glow(c, x0 + w / 2, 162, w * .6, 60 + sh.lit * 90, .7); c.fillStyle = gray(70 + sh.lit * 100); c.fillRect(x0 + 8, 130, w - 34, 58); c.fillStyle = gray(40 + sh.lit * 40); c.fillRect(x0 + w - 22, 134, 14, 58);
      c.fillStyle = gray(36); for (let y = 146; y < 188; y += 13) c.fillRect(x0 + 10, y, w - 38, 2); }
    const img = sign(name, a('mirroredSigns'));
    c.save(); c.translate(x0 + 5, 103); c.scale((w - 10) / img.width, 20 / img.height);
    if (sh.sign || a('sameShop')) { c.fillStyle = gray(200); c.fillRect(0, 0, img.width, img.height); c.globalCompositeOperation = 'difference'; }
    else c.globalCompositeOperation = 'lighter';
    c.globalAlpha = sh.sign ? 1 : .8; c.drawImage(img, 0, 0); c.restore();
  }
  // shelters and stop flags
  for (const m of SHELTERS) { const x = ox(m); if (x < -80 || x > 480) continue;
    c.fillStyle = gray(70); c.fillRect(x - 30, 118, 60, 4); c.fillRect(x - 30, 118, 3, 80); c.fillRect(x + 27, 118, 3, 80);
    c.globalAlpha = .22; c.fillStyle = gray(200); c.fillRect(x - 27, 122, 54, 60); c.globalAlpha = 1;
    c.fillStyle = gray(90); c.fillRect(x + 40, 92, 3, 106); rrect(c, x + 30, 80, 24, 24, 12, gray(200)); c.fillStyle = gray(20); c.font = FONT(8); c.textAlign = 'center'; c.fillText('N23', x + 42, 95); c.textAlign = 'start';
    if (m === 120) { body(c, x - 8, 148, 22, 50, 40); face(c, x - 8, 140, 9, { back: true, hair: 50 }); }
  }
  // the pavement and kerb
  c.fillStyle = gray(36); c.fillRect(0, 196, W, 20); c.fillStyle = gray(70); c.fillRect(0, 196, W, 2);
  for (const m of LAMPS) { const x = ox(m); if (x < -60 || x > 460) continue; c.fillStyle = gray(58); c.fillRect(x - 2, 56, 4, 142); c.fillRect(x - 2, 54, 20, 4); glow(c, x + 16, 60, 60, 255, .85); ell(c, x + 16, 59, 7, 3, gray(255)); }
  if (a('pacer')) { const x = 272, step = Math.sin(s.sec * 8 * Math.max(.05, s.v));
    c.fillStyle = gray(20); c.fillRect(x - 7 + step * 3, 176, 5, 22); c.fillRect(x + 2 - step * 3, 176, 5, 22);
    body(c, x, 142, 24, 40, 22); face(c, x, 132, 9, { hair: 18, eyes: 'black', skin: 150 }); }

  // your reflection in the glass
  c.globalCompositeOperation = 'screen';
  c.fillStyle = gray(36); c.fillRect(24, 50, 352, 5);
  c.fillStyle = gray(30); c.fillRect(160, 112, 56, 90); // the headrest behind you
  if (a('reflectionBehind')) { body(c, 190, 150, 60, 70, 40); face(c, 190, 128, 20, { hair: 25, skin: 62, eyes: 'black' }); }
  if (!a('noReflection')) {
    body(c, 118, 168, 110, 70, 40); ell(c, 118, 136, 30, 36, gray(64)); c.fillStyle = gray(30); c.beginPath(); c.ellipse(118, 124, 31, 26, 0, Math.PI, 0); c.fill();
    c.globalCompositeOperation = 'source-over';
    if (a('reflectionSmile')) { ell(c, 106, 138, 6, 7, gray(4)); ell(c, 130, 138, 6, 7, gray(4)); c.fillStyle = gray(4); c.beginPath(); c.ellipse(118, 152, 15, 7, 0, 0, Math.PI); c.fill(); }
    else { c.globalAlpha = .5; c.fillStyle = gray(10); c.fillRect(101, 137, 10, 3); c.fillRect(125, 137, 10, 3); c.globalAlpha = 1; }
  }
  c.globalCompositeOperation = 'source-over';
  if (a('handprint')) { c.globalAlpha = .4; ell(c, 300, 132, 16, 19, gray(190)); for (let i = 0; i < 4; i++) { c.save(); c.translate(288 + i * 8, 116); c.rotate(-.25 + i * .15); ell(c, 0, -12, 3.6, 10, gray(190)); c.restore(); } c.save(); c.translate(318, 136); c.rotate(.9); ell(c, 0, -8, 4, 9, gray(190)); c.restore(); c.globalAlpha = 1; }
  // rain on the glass
  c.strokeStyle = gray(130); c.lineWidth = 1.2; c.globalAlpha = .55;
  const v = s.v, up = a('rainUp');
  for (const d of DROPS) { const fall = (s.sec * 26 * d.v) * (up ? -1 : 1); const drift = s.S * 6 * d.v;
    const x = ((d.x - drift) % 400 + 400) % 400, y = ((d.y + fall) % 180 + 180) % 180 + 36;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + d.l * (.3 + v * 2.2), y + (up ? 1 : -1) * d.l * (1 - v * .6)); c.stroke(); }
  c.globalAlpha = 1;
  c.restore();
  // frame and the bus wall around it
  c.strokeStyle = gray(30); c.lineWidth = 6; c.beginPath(); c.roundRect(24, 36, 352, 178, 14); c.stroke();
  c.fillStyle = gray(84); c.fillRect(24, 78, 352, 5);
  c.fillStyle = gray(100); c.fillRect(-50, -50, W + 100, 82);
  texQuad(c, adDrive(), (u, v) => [60 + 160 * u, -12 + 40 * v], 1); texQuad(c, adLink(), (u, v) => [236 + 160 * u, -12 + 40 * v], 1);
  c.fillStyle = gray(80); c.fillRect(-50, 28, W + 100, 6);
  c.fillStyle = gray(66); c.fillRect(-50, 222, W + 100, 130);
  c.fillStyle = gray(112); c.fillRect(-50, 218, W + 100, 8);
  c.fillStyle = gray(48); for (let x = 40; x < 300; x += 9) c.fillRect(x, 248, 5, 36);
  rrect(c, 330, 244, 20, 28, 4, red(s.rang || a('stopLit') ? 255 : 100)); if (s.rang || a('stopLit')) glow(c, 340, 258, 30, 255, .6, red);
  c.fillStyle = gray(150); c.font = FONT(8); c.textAlign = 'center'; c.fillText('STOP', 340, 284); c.textAlign = 'start';
  // the seat in front's edge, at the right
  rrect(c, 372, 120, 60, 200, 14, gray(86));
  const vg = c.createRadialGradient(200, 150, 140, 200, 150, 300); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); c.fillStyle = vg; c.fillRect(-60, -60, W + 120, H + 120);
}

// ---------- BEHIND ----------
function drawBehind(c, s) {
  const a = s.a, BZ = 1.5;
  c.fillStyle = gray(18); c.fillRect(-50, -50, W + 100, H + 100);
  poly(c, [P(-160, -150, 0), P(160, -150, 0), P(160, -150, BZ), P(-160, -150, BZ)], gray(124));
  poly(c, [P(-160, -150, 0), P(-205, -100, 0), P(-205, -100, BZ), P(-160, -150, BZ)], gray(96));
  poly(c, [P(160, -150, 0), P(205, -100, 0), P(205, -100, BZ), P(160, -150, BZ)], gray(96));
  poly(c, [P(-205, 22, 0), P(-205, 210, 0), P(-205, 210, BZ), P(-205, 22, BZ)], gray(64));
  poly(c, [P(205, 22, 0), P(205, 210, 0), P(205, 210, BZ), P(205, 22, BZ)], gray(64));
  poly(c, [P(-205, 210, 0), P(205, 210, 0), P(205, 210, BZ), P(-205, 210, BZ)], gray(44));
  for (const X of [-100, 70]) { poly(c, [P(X - 8, -150, .1), P(X + 38, -150, .1), P(X + 38, -150, 1.3), P(X - 8, -150, 1.3)], gray(168)); poly(c, [P(X, -150, .16), P(X + 30, -150, .16), P(X + 30, -150, 1.24), P(X, -150, 1.24)], gray(255)); }
  const coveL = (z0, z1) => (u, v) => P(-160 - 45 * v, -150 + 50 * v, z0 + (z1 - z0) * u);
  texQuad(c, adLink(), coveL(.1, .9));
  sideWindow(c, s, -1, BZ, true); sideWindow(c, s, 1, BZ, true);
  // rear wall and window
  poly(c, [P(-160, -150, BZ), P(160, -150, BZ), P(205, -100, BZ), P(205, 210, BZ), P(-205, 210, BZ), P(-205, -100, BZ)], gray(72));
  c.save(); poly(c, [P(-172, -104, BZ), P(172, -104, BZ), P(172, 24, BZ), P(-172, 24, BZ)]); c.clip();
  c.fillStyle = gray(14); c.fillRect(0, 0, W, H);
  poly(c, [P(-330, 250, BZ), P(330, 250, BZ), P(330, 250, 80), P(-330, 250, 80)], gray(26));
  const S = s.S;
  for (let m = Math.floor(S / 7) * 7; m > S - 200; m -= 7) { const z = (S - m) / MPZ; if (z < BZ) continue; poly(c, [P(-5, 250, z), P(5, 250, z), P(5, 250, z + .35), P(-5, 250, z + .35)], gray(130)); }
  { const z = BZ + 2.6 + Math.sin(s.sec * .7) * .3, k = K(z), [cx0, cy0] = P(-110, -60, z);
    rrect(c, cx0, cy0, 220 * k, 110 * k, 20 * k, gray(30));
    const col = a('redHeadlights') ? red : gray;
    for (const X of [-62, 62]) { const [lx, ly] = P(X, -4, z); glow(c, lx, ly, 90 * k, 255, .9, col); ell(c, lx, ly, 20 * k, 13 * k, col(255)); } }
  c.restore();
  if (a('rearFace')) { const [fx, fy] = P(0, -60, BZ - .01), k = K(BZ); face(c, fx, fy, 34 * k, { hair: 40, skin: 196, eyes: 'black', mouth: 'open' }); ell(c, fx - 30 * k, fy + 20 * k, 9 * k, 14 * k, gray(196)); ell(c, fx + 30 * k, fy + 20 * k, 9 * k, 14 * k, gray(196)); }
  c.fillStyle = gray(96); { const [x0, y0] = P(-172, -56, BZ); c.fillRect(x0, y0, 344 * K(BZ), 5 * K(BZ)); }

  // back bench, full width
  benchFacing(c, -205, 205, BZ - .06, 22);
  const pz = BZ - .2, pk = K(pz);
  if (!a('emptyBack')) {
    const sit = (X, opt, bodyV) => { const [x, y] = P(X, -6, pz), r = 23 * pk; body(c, x, y + 16 * pk, 74 * pk, 92 * pk, bodyV); face(c, x, y, r, opt); return [x, y, r]; };
    const cap = ([x, y, r]) => { c.fillStyle = gray(36); c.beginPath(); c.ellipse(x, y - r * .45, r * 1.0, r * .7, 0, Math.PI, 0); c.fill(); c.fillRect(x - r * 1.1, y - r * .5, r * 2.2, r * .2); };
    cap(sit(-130, { hair: 40, skin: 168 }, 58));
    if (a('twins')) cap(sit(-58, { hair: 40, skin: 168 }, 58));
    else { const [x, y, r] = sit(-58, { hair: 210, skin: 182, mouth: 'flat' }, 110); c.fillStyle = gray(210); c.fillRect(x - r, y - r * .4, r * .26, r * 1.3); c.fillRect(x + r * .74, y - r * .4, r * .26, r * 1.3); }
    { const [x, y] = P(120, 0, pz), r = 23 * pk; body(c, x, y + 14 * pk, 80 * pk, 92 * pk, 76);
      c.save(); c.translate(x, y); c.rotate(a('sleeperAwake') ? 0 : .32); face(c, 0, 0, r, a('sleeperAwake') ? { hair: 150, skin: 172, eyes: 'wide' } : { hair: 150, skin: 172, eyes: 'closed', mouth: 'open' }); c.restore(); }
  }
  benchFront(c, -205, 205, BZ - .4);
  // the middle row: empty
  // the middle doors (our side of the bus is on the right, looking back)
  { const z0 = .55, z1 = .9, op = a('doorsOpen') ? 1 : s.doors, X = 204;
    const Q = (za, zb, y0, y1) => [P(X, y0, za), P(X, y1, za), P(X, y1, zb), P(X, y0, zb)];
    poly(c, Q(z0 - .03, z1 + .03, -108, 210), gray(40));
    poly(c, Q(z0, z1, -100, 206), gray(6));
    if (op > 0) for (let i = 0; i < 5; i++) { const ph = ((s.S * 1.7 + i * 23) % 40) / 40, zz = z0 + (z1 - z0) * ph; const [x, yy] = P(X + 40, -70 + i * 50, zz); glow(c, x, yy, 30 * K(zz), 230, .25 + .6 * s.v); }
    const half = (z1 - z0) / 2 * (1 - op * .85);
    for (const [za, zb] of [[z0, z0 + half], [z1 - half, z1]]) {
      poly(c, Q(za, zb, -100, 206), gray(104));
      const m = (zb - za) * .18; poly(c, Q(za + m, zb - m, -88, 120), gray(20));
    }
    if (op < .05) poly(c, Q((z0 + z1) / 2 - .006, (z0 + z1) / 2 + .006, -100, 206), gray(14));
  }
  pole(c, 38, .7, false, s);
  // the near row: the girl across the aisle, and the empty seat behind you
  benchFacing(c, -205, -38, .42, 34); benchFacing(c, 38, 205, .42, 34);
  const ck = K(.32), [bx, by] = P(-118, 44, .32);
  const balloon = (hx, hy) => { const down = a('balloonDown'); const bob = Math.sin(s.sec * 1.3) * 3 * ck;
    const [px, py] = down ? P(-70, 190, .3) : P(-70, -128, .34); const ty = py + bob;
    c.strokeStyle = gray(150); c.lineWidth = 1.6 * ck; c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo(hx + 10 * ck, (hy + ty) / 2, px, ty + (down ? -30 : 30) * ck); c.stroke();
    ell(c, px, ty, 28 * ck, 32 * ck, gray(206)); ell(c, px - 9 * ck, ty - 10 * ck, 7 * ck, 9 * ck, gray(245)); };
  if (!a('childGone')) {
    body(c, bx, by + 6 * ck, 54 * ck, 70 * ck, 120);
    face(c, bx, by - 6 * ck, 19 * ck, { hair: 60, skin: 186 }); c.fillStyle = gray(60); c.fillRect(bx - 21 * ck, by - 14 * ck, 8 * ck, 26 * ck); c.fillRect(bx + 13 * ck, by - 14 * ck, 8 * ck, 26 * ck);
    const [hx, hy] = P(-84, 64, .3); ell(c, hx, hy, 6 * ck, 6 * ck, gray(186)); balloon(hx, hy);
  } else { const [hx, hy] = P(-90, 70, .33); balloon(hx, hy); }
  benchFront(c, -205, -38, .22); benchFront(c, 38, 205, .22);
  const vg = c.createRadialGradient(200, 150, 120, 200, 150, 300); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = vg; c.fillRect(-60, -60, W + 120, H + 120);
}
function benchFacing(c, X0, X1, z, top) { // a seat's backrest, seen from the front
  const k = K(z), [x0, y0] = P(X0, top, z), [x1] = P(X1, top, z), y1 = P(0, 92, z)[1];
  rrect(c, x0, y0, x1 - x0, y1 - y0, 10 * k, gray(84));
  c.fillStyle = gray(108); c.fillRect(x0 + 5 * k, y0 + 6 * k, x1 - x0 - 10 * k, 12 * k);
  c.fillStyle = gray(70); for (let X = X0 + 40; X < X1 - 20; X += 82) { const xx = P(X + 41, 0, z)[0]; c.fillRect(xx - 1.5 * k, y0 + 20 * k, 3 * k, y1 - y0 - 24 * k); }
}
function benchFront(c, X0, X1, z) { // the cushion edge and the dark under the seat
  const k = K(z), [x0, y0] = P(X0, 96, z), [x1] = P(X1, 96, z), y1 = P(0, 210, z)[1];
  rrect(c, x0, y0, x1 - x0, 30 * k, 8 * k, gray(96));
  c.fillStyle = gray(30); c.fillRect(x0 + 8 * k, y0 + 30 * k, x1 - x0 - 16 * k, y1 - y0 - 30 * k);
}

// ---------- entry ----------
// s: { t, S, v, sec, stop, rang, doors, a(id) }
export function drawView(c, view, s) {
  c.save();
  if (view === 0) drawWindow(c, s); else if (view === 1) drawAhead(c, s); else drawBehind(c, s);
  c.restore();
}
