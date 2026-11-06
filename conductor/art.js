// A Victorian toy theatre: everything is an engraved sheet, tinted by hand a little outside the lines, cut out with
// a margin of white paper, and jointed with brass fasteners. Parts are drawn once and then only ever moved.
export const INK = '#2b1d14', PAPER = '#f4e8cf', CREAM = '#fbf3e0', SKIN = '#efc6a0', VERM = '#c33d27', GAMB = '#e0a42c', PRUS = '#2c587a', SAP = '#6d8b3d', ROSE = '#cc6d7c', GOLD = '#c79f45', COAT = '#3b3634', PLUM = '#6b3a5e', TEAL = '#3d7f78', CRIM = '#7c1f22';

export const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
export function smooth(pts, closed = true) {
  const p = new Path2D(), n = pts.length, at = (i) => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
    p.bezierCurveTo(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1]);
  }
  if (closed) p.closePath(); return p;
}
export const poly = (pts, closed = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; };
export const oval = (x, y, rx, ry = rx, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, 6.2832); return p; };

// ruled lines, a little unsteady, inside whatever is currently clipped
function rule(g, x0, y0, x1, y1, ang, gap, color, lw, wob = .5) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 4, c = Math.cos(ang), s = Math.sin(ang);
  g.strokeStyle = color; g.lineWidth = lw; g.beginPath();
  let k = 0;
  for (let d = -R; d < R; d += gap) {
    k++; const nx = -s * d + cx, ny = c * d + cy;
    g.moveTo(nx - c * R + Math.sin(k * 7.1) * wob, ny - s * R + Math.cos(k * 3.3) * wob);
    g.lineTo(nx + c * R + Math.sin(k * 5.7) * wob, ny + s * R + Math.cos(k * 2.1) * wob);
  }
  g.stroke();
}
// fill: tint, slipped off the line; shade: [x-from, angle, gap]; line: outline weight
export function paint(g, path, { fill, shade, line = 1.3, off = .9, ink = INK, box = [-130, -150, 130, 70] } = {}) {
  if (fill) { g.save(); g.translate(off, off * .7); g.fillStyle = fill; g.fill(path); g.restore(); }
  if (shade) {
    g.save(); g.clip(path); const [from, ang = .9, gap = 3, a = 1] = shade; g.globalAlpha = a;
    rule(g, Math.max(from, box[0]), box[1], box[2], box[3], ang, gap, ink, .75); g.restore();
  }
  if (line) { g.strokeStyle = ink; g.lineWidth = line; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(path); }
}
export function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

// add the white cut-paper margin round everything drawn so far
function margin(c, px) {
  const m = mk(c.width, c.height), g = m.getContext('2d');
  const s = mk(c.width, c.height), h = s.getContext('2d'); h.drawImage(c, 0, 0); h.globalCompositeOperation = 'source-in'; h.fillStyle = '#fbf4e4'; h.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832; g.drawImage(s, Math.cos(a) * px, Math.sin(a) * px); }
  g.drawImage(c, 0, 0); return m;
}

function hair(g, o) {
  const c = o.hairC || '#5a3a22', r = o.r;
  switch (o.hair) {
    case 'bald': paint(g, smooth([[-r - 2, 2], [-r - 7, -5], [-r - 3, -13], [-r + 4, -7]]), { fill: c, line: 1 }); paint(g, smooth([[r + 2, 2], [r + 7, -5], [r + 3, -13], [r - 4, -7]]), { fill: c, line: 1 }); break;
    case 'side': paint(g, smooth([[-r - 1, 0], [-r - 1, -r * .9], [-4, -r - 6], [r * .9, -r * .95], [r + 1, -2], [r - 3, -r * .55], [-6, -r * .8], [-r + 5, -r * .45]]), { fill: c, shade: [-40, .5, 2.4] }); break;
    case 'mop': paint(g, smooth([[-r - 5, 8], [-r - 9, -8], [-r - 3, -r], [-8, -r - 11], [8, -r - 9], [r + 5, -r], [r + 9, -6], [r + 4, 8], [r - 3, -8], [8, -r * .65], [-9, -r * .55], [-r + 3, -8]]), { fill: c, shade: [0, .5, 2.4] }); break;
    case 'bun': paint(g, oval(0, -r - 11, 11, 10), { fill: c, shade: [0, .5, 2.2] }); paint(g, smooth([[-r - 2, 3], [-r - 3, -r * .8], [0, -r - 4], [r + 3, -r * .8], [r + 2, 3], [r - 4, -r * .5], [0, -r * .66], [-r + 4, -r * .5]]), { fill: c, shade: [0, .5, 2.2] }); break;
    case 'curls': for (let i = 0; i < 9; i++) { const a = -2.95 + i * .347; paint(g, oval(Math.cos(a) * (r + 2), Math.sin(a) * (r + 2), 8), { fill: c, line: 1 }); } break;
    case 'plume': paint(g, smooth([[-r - 2, 3], [-r - 2, -r], [0, -r - 8], [r + 2, -r], [r + 2, 3], [r - 5, -r * .55], [-r + 5, -r * .55]]), { fill: c, shade: [0, .5, 2.2] }); paint(g, smooth([[6, -r - 4], [18, -r - 26], [32, -r - 34], [27, -r - 16], [14, -r - 2]]), { fill: VERM, shade: [14, 1.1, 2.6] }); paint(g, oval(5, -r - 3, 4), { fill: GOLD, line: 1 }); break;
  }
}
// A head, centred on the origin. The eyes and mouth are left off and drawn live.
function head(g, o) {
  const r = o.r = o.r || 24, w = o.wide || 1, faces = { egg: [[-r * .9 * w, -r * .5], [0, -r], [r * .9 * w, -r * .5], [r * w, r * .25], [r * .5, r * 1.02], [0, r * 1.14], [-r * .5, r * 1.02], [-r * w, r * .25]],
    pear: [[-r * .68, -r * .6], [0, -r * .98], [r * .68, -r * .6], [r * 1.06, r * .5], [r * .62, r * 1.08], [0, r * 1.14], [-r * .62, r * 1.08], [-r * 1.06, r * .5]],
    long: [[-r * .75, -r * .7], [0, -r * 1.05], [r * .75, -r * .7], [r * .8, r * .6], [r * .34, r * 1.36], [0, r * 1.45], [-r * .34, r * 1.36], [-r * .8, r * .6]],
    round: [[-r, -r * .3], [-r * .62, -r * .9], [0, -r], [r * .62, -r * .9], [r, -r * .3], [r, r * .4], [r * .6, r], [0, r * 1.05], [-r * .6, r], [-r, r * .4]] };
  if (o.back) o.back(g);
  paint(g, oval(-r * 1.02, 4, 5, 7), { fill: o.skin || SKIN, line: 1 }); paint(g, oval(r * 1.02, 4, 5, 7), { fill: o.skin || SKIN, line: 1 });
  const f = smooth(faces[o.shape || 'egg']); paint(g, f, { fill: o.skin || SKIN, shade: [r * .3, 1.0, 2.6] });
  if (o.cheek) { g.save(); g.globalAlpha = .45; g.fillStyle = VERM; g.fill(oval(-r * .55, r * .42, r * .24, r * .17)); g.fill(oval(r * .55, r * .42, r * .24, r * .17)); g.restore(); }
  const nose = { bulb: () => paint(g, oval(0, 7, 7.5, 6.5), { fill: o.noseC || '#e39a7c', line: 1.1, shade: [1, 1, 2.2] }), long: () => paint(g, smooth([[-2.5, -3], [3, -3], [6, 14], [0, 18], [-5, 14]]), { fill: SKIN, line: 1.1 }), snub: () => paint(g, smooth([[-4, 7], [0, 2], [4, 7], [0, 10]]), { line: 1 }) };
  nose[o.nose || 'snub']();
  switch (o.face) {
    case 'walrus': paint(g, smooth([[0, 11], [9, 12], [20, 21], [12, 22], [0, 16], [-12, 22], [-20, 21], [-9, 12]]), { fill: o.hairC || '#7b7468', shade: [-30, 1.4, 2] }); break;
    case 'curl': paint(g, smooth([[0, 12], [9, 13], [17, 8], [14, 15], [0, 16], [-14, 15], [-17, 8], [-9, 13]]), { fill: o.hairC || COAT }); break;
    case 'chops': { const c = o.hairC || '#8b8880'; paint(g, smooth([[-r - 1, -4], [-r + 7, -2], [-r + 12, 16], [-r + 18, 27], [-r + 6, 22]]), { fill: c, shade: [-40, 1.2, 2] }); paint(g, smooth([[r + 1, -4], [r - 7, -2], [r - 12, 16], [r - 18, 27], [r - 6, 22]]), { fill: c, shade: [-40, 1.2, 2] }); break; }
    case 'goatee': paint(g, smooth([[-6, 19], [6, 19], [0, 34]]), { fill: o.hairC || COAT, shade: [-20, 1.3, 2] }); break;
  }
  hair(g, o);
}
function coat(g, o = {}) { // shoulders and a tailcoat, or a Sunday dress, with a neck
  paint(g, smooth([[-9, -80], [9, -80], [11, -62], [-11, -62]]), { fill: o.skin || SKIN, line: 1 });
  const c = o.c || COAT, w = o.w || 40;
  paint(g, smooth([[-w, -46], [-w + 7, -62], [-14, -69], [14, -69], [w - 7, -62], [w, -46], [w + 4, 30], [-w - 4, 30]]), { fill: c, shade: o.dress ? [8, 1, 3.4] : [-60, 1, 2.3, .9] });
  if (o.dress) {
    paint(g, smooth([[-15, -69], [0, -56], [15, -69], [18, -64], [0, -46], [-18, -64]]), { fill: CREAM });
    if (o.brooch) paint(g, oval(0, -50, 4), { fill: GOLD, line: 1 });
  } else {
    paint(g, poly([[-13, -69], [13, -69], [4, 22], [-4, 22]]), { fill: CREAM, line: 1.1 });
    paint(g, smooth([[-11, -70], [-1, -65], [-11, -60]]), { fill: o.tie || INK, line: 1 }); paint(g, smooth([[11, -70], [1, -65], [11, -60]]), { fill: o.tie || INK, line: 1 });
    for (const y of [-48, -30, -12]) g.fill(oval(0, y, 1.6));
  }
}
function sleeve(g, x0, y0, x1, y1, wd, c = COAT) {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * wd, ny = Math.cos(a) * wd;
  paint(g, smooth([[x0 + nx, y0 + ny], [x1 + nx * .75, y1 + ny * .75], [x1 + Math.cos(a) * 4, y1 + Math.sin(a) * 4], [x1 - nx * .75, y1 - ny * .75], [x0 - nx, y0 - ny], [x0 - Math.cos(a) * wd, y0 - Math.sin(a) * wd]]), { fill: c, shade: [-140, a + 1, 2.4, .85] });
}
const hand = (g, x, y, r = 7.5, c = SKIN) => paint(g, oval(x, y, r, r * .9), { fill: c, line: 1.1 });
const brass = (g, x, y) => { paint(g, oval(x, y, 2.6), { fill: GOLD, line: .8 }); };

function violin(g, x, y, rot, s = 1) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  paint(g, smooth([[-16, -10], [-5, -12], [-3, -7], [6, -7], [8, -12], [19, -10], [24, 0], [19, 10], [8, 12], [6, 7], [-3, 7], [-5, 12], [-16, 10], [-21, 0]]), { fill: '#b9652c', shade: [0, .4, 2.4] });
  paint(g, poly([[20, -2], [52, -1.6], [52, 1.6], [20, 2]]), { fill: INK, line: .8 });
  paint(g, oval(55, 0, 4, 3), { fill: '#8d4a22', line: .9 }); g.restore();
}
function bow(g, x0, y0, x1, y1) { g.strokeStyle = INK; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.lineWidth = .7; g.beginPath(); g.moveTo(x0 + 3, y0 + 3); g.lineTo(x1 + 1, y1 + 3); g.stroke(); }

// Each player is a stack of parts, each with a pivot. `live` is where the face goes.
const CAST = {
  v1: { sec: 'str', head: { shape: 'long', hair: 'bun', hairC: '#7e7a72', nose: 'long' }, build(a) {
    a.part('body', g => { coat(g, { c: PLUM, dress: 1, brooch: 1, w: 36 }); });
    a.head(); a.part('fiddle', g => { sleeve(g, 33, -56, 62, -74, 9, PLUM); hand(g, 66, -76); violin(g, 26, -78, -.3); }, 0, 0, null, 'over');
    a.part('bow', g => { sleeve(g, -33, -54, -30, -14, 9, PLUM); sleeve(g, -30, -14, -2, -40, 8, PLUM); hand(g, 0, -42); bow(g, -26, -22, 44, -62); brass(g, -33, -54); }, -33, -54, 'saw');
  } },
  v2: { sec: 'str', head: { shape: 'round', hair: 'side', hairC: '#b36a2c', nose: 'snub', cheek: 1 }, build(a) {
    a.part('body', g => coat(g, { w: 34 }));
    a.head(); a.part('fiddle', g => { sleeve(g, 31, -56, 60, -74, 9); hand(g, 64, -76); violin(g, 24, -78, -.3); }, 0, 0, null, 'over');
    a.part('bow', g => { sleeve(g, -31, -54, -28, -14, 9); sleeve(g, -28, -14, 0, -40, 8); hand(g, 2, -42); bow(g, -24, -22, 46, -62); brass(g, -31, -54); }, -31, -54, 'saw');
  } },
  cello: { sec: 'str', head: { shape: 'pear', hair: 'bald', hairC: '#55524c', nose: 'bulb', face: 'curl', noseC: '#dd8466' }, build(a) {
    a.part('body', g => coat(g, { w: 44 }));
    a.head(); a.part('cello', g => {
      paint(g, poly([[17, -112], [23, -112], [23, -30], [17, -30]]), { fill: INK, line: .8 }); paint(g, oval(20, -116, 6, 5), { fill: '#8d4a22', line: 1 });
      paint(g, smooth([[-8, -42], [20, -48], [48, -42], [52, -22], [40, -8], [54, 8], [50, 40], [-10, 40], [-14, 8], [0, -8], [-12, -22]]), { fill: '#a9571f', shade: [24, .5, 2.6] });
      sleeve(g, 40, -55, 34, -84, 9); hand(g, 22, -90, 7);
    }, 0, 0, null, 'over');
    a.part('bow', g => { sleeve(g, -40, -52, -52, -12, 10); sleeve(g, -52, -12, -16, -6, 8.5); hand(g, -12, -6); bow(g, -20, -2, 62, -2); brass(g, -40, -52); }, -40, -52, 'saw2');
  } },
  flute: { sec: 'wood', head: { shape: 'egg', hair: 'bun', hairC: '#c9a24f', nose: 'snub', cheek: 1 }, build(a) {
    a.part('body', g => coat(g, { c: TEAL, dress: 1, w: 34 }));
    a.head(); a.part('flute', g => {
      sleeve(g, -33, -56, -44, -24, 9, TEAL); sleeve(g, -44, -24, -30, -62, 7, TEAL); sleeve(g, 33, -56, 34, -24, 9, TEAL); sleeve(g, 34, -24, 52, -74, 7, TEAL);
      g.strokeStyle = INK; g.lineWidth = 4.5; g.beginPath(); g.moveTo(-54, -62); g.lineTo(76, -82); g.stroke(); g.strokeStyle = '#d7d4c8'; g.lineWidth = 2.6; g.stroke();
      hand(g, -28, -64); hand(g, 52, -76);
    }, 0, -72, 'tilt', 'over');
  } },
  clar: { sec: 'wood', head: { shape: 'long', hair: 'bun', hairC: '#c9a24f', nose: 'long', specs: 1 }, build(a) {
    a.part('body', g => coat(g, { c: TEAL, dress: 1, w: 32 }));
    a.head(); a.part('clar', g => {
      sleeve(g, -31, -56, -38, -22, 9, TEAL); sleeve(g, -38, -22, -6, -40, 7, TEAL); sleeve(g, 31, -56, 36, -22, 9, TEAL); sleeve(g, 36, -22, 8, -20, 7, TEAL);
      paint(g, poly([[-3, -72], [3, -72], [4, -2], [-4, -2]]), { fill: '#2f2a26', line: 1 }); paint(g, smooth([[-5, -4], [5, -4], [11, 8], [-11, 8]]), { fill: '#2f2a26', line: 1 });
      hand(g, -5, -40); hand(g, 6, -20);
    }, 0, -72, 'tilt', 'over');
  } },
  trumpet: { sec: 'brass', head: { shape: 'round', hair: 'side', hairC: '#a66', nose: 'snub', puff: 1, wide: 1.05 }, build(a) {
    a.part('body', g => coat(g, { w: 36 }));
    a.head(); a.part('tr', g => {
      sleeve(g, -35, -56, -40, -24, 9); sleeve(g, -40, -24, -10, -56, 7); sleeve(g, 35, -56, 38, -24, 9); sleeve(g, 38, -24, 10, -56, 7);
      paint(g, smooth([[-4, -72], [4, -72], [8, -56], [24, -30], [-24, -30], [-8, -56]]), { fill: GAMB, shade: [2, 1, 2.2] }); paint(g, oval(0, -30, 24, 7.5), { fill: '#7a5412', line: 1.2 });
      hand(g, -11, -56); hand(g, 11, -56);
    }, 0, -72, 'blow', 'over');
  } },
  horn: { sec: 'brass', head: { shape: 'pear', hair: 'bald', hairC: '#7b7468', nose: 'bulb', face: 'walrus', noseC: '#d97b5e' }, build(a) {
    a.part('body', g => coat(g, { w: 44 }));
    a.head(); a.part('horn', g => {
      sleeve(g, 42, -54, 56, -22, 10); sleeve(g, -42, -54, -44, -24, 10); sleeve(g, -44, -24, -8, -36, 8);
      const r = new Path2D(); r.ellipse(14, -28, 32, 30, 0, 0, 6.2832); r.ellipse(14, -28, 19, 18, 0, 0, 6.2832, true);
      paint(g, r, { fill: GAMB, shade: [14, 1, 2.4] }); paint(g, smooth([[34, -6], [66, 2], [74, 22], [46, 28], [30, 14]]), { fill: GAMB, shade: [40, 1, 2.2] }); paint(g, oval(60, 15, 13, 12), { fill: '#7a5412', line: 1.1 });
      hand(g, 60, -20); hand(g, -8, -36);
    }, 0, -72, 'blow', 'over');
  } },
  tuba: { sec: 'tuba', head: { shape: 'round', hair: 'bald', hairC: '#c9c5ba', nose: 'bulb', face: 'chops', wide: 1.05, noseC: '#d97b5e' }, build(a) {
    a.part('body', g => coat(g, { w: 50 }));
    a.head(); a.part('tuba', g => {
      paint(g, smooth([[-46, 30], [-52, -14], [-30, -52], [-2, -58], [24, -48], [26, -14], [22, 30]]), { fill: GAMB, shade: [-14, 1, 2.6] });
      paint(g, smooth([[-36, -50], [-68, -116], [-104, -128], [-108, -142], [-42, -148], [-22, -130], [-4, -56]]), { fill: GAMB, shade: [-64, 1, 2.6] });
      paint(g, oval(-74, -142, 34, 8, -.03), { fill: '#7a5412', line: 1.2 });
      paint(g, oval(-10, -8, 22, 22), { fill: '#eebc4d', line: 1.1 }); paint(g, oval(-10, -8, 11, 11), { line: 1 });
      sleeve(g, 49, -52, 54, -16, 11); sleeve(g, 54, -16, 28, -12, 9); hand(g, 24, -12); hand(g, -48, -8);
    }, 0, 0, 'tubabob', 'over');
  } },
  timp: { sec: 'drum', head: { shape: 'round', hair: 'mop', hairC: '#c0752d', nose: 'snub', cheek: 1 }, build(a) {
    a.part('body', g => coat(g, { c: VERM, w: 33, tie: GOLD }));
    a.head();
    a.part('armL', g => { sleeve(g, -32, -54, -46, -24, 8, VERM); sleeve(g, -46, -24, -28, -8, 7, VERM); hand(g, -26, -8, 6.5); g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(-26, -8); g.lineTo(-44, 18); g.stroke(); paint(g, oval(-45, 20, 5.5), { fill: CREAM, line: 1 }); brass(g, -32, -54); }, -32, -54, 'stickL');
    a.part('armR', g => { sleeve(g, 32, -54, 46, -24, 8, VERM); sleeve(g, 46, -24, 28, -8, 7, VERM); hand(g, 26, -8, 6.5); g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(26, -8); g.lineTo(44, 18); g.stroke(); paint(g, oval(45, 20, 5.5), { fill: CREAM, line: 1 }); brass(g, 32, -54); }, 32, -54, 'stickR');
    a.part('kettles', g => { for (const x of [-46, 46]) { paint(g, smooth([[x - 38, 30], [x + 38, 30], [x + 32, 62], [x + 12, 84], [x - 12, 84], [x - 32, 62]]), { fill: '#b87333', shade: [x, 1, 2.6] }); paint(g, oval(x, 30, 40, 9), { fill: '#f0e2c2', line: 1.3 }); } }, 0, 0, null);
  } },
  tri: { sec: 'tri', head: { shape: 'long', hair: 'bald', hairC: '#6a6258', nose: 'long', r: 20, specs: 1 }, build(a) {
    a.part('body', g => coat(g, { w: 25 }));
    a.head();
    a.part('armL', g => { sleeve(g, -24, -56, -30, -22, 7); sleeve(g, -30, -22, -40, -74, 6); hand(g, -40, -78, 6); g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(-40, -78); g.lineTo(-40, -72); g.stroke(); g.strokeStyle = '#7a776c'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-40, -72); g.lineTo(-60, -40); g.lineTo(-20, -40); g.closePath(); g.stroke(); g.strokeStyle = INK; g.lineWidth = .6; g.stroke(); brass(g, -24, -56); }, -24, -56, null);
    a.part('armR', g => { sleeve(g, 24, -56, 30, -22, 7); sleeve(g, 30, -22, 6, -46, 6); hand(g, 3, -48, 6); g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.moveTo(3, -48); g.lineTo(-30, -55); g.stroke(); brass(g, 24, -56); }, 24, -56, 'ting');
  } },
  solo: { sec: 'solo', head: { shape: 'pear', hair: 'plume', hairC: '#2f2520', nose: 'long', r: 26, mouth: 1, cheek: 1 }, build(a) {
    a.part('body', g => {
      paint(g, smooth([[-34, -46], [34, -46], [62, 40], [78, 110], [-78, 110], [-62, 40]]), { fill: VERM, shade: [10, 1, 3.2] });
      for (const y of [30, 66, 96]) paint(g, smooth([[-46 - (y - 30) * .4, y], [-20, y + 8], [0, y], [20, y + 8], [46 + (y - 30) * .4, y]], false), { line: 1.1 });
      paint(g, smooth([[-10, -80], [10, -80], [11, -62], [-11, -62]]), { fill: SKIN, line: 1 });
      paint(g, smooth([[-44, -46], [-34, -66], [-12, -72], [0, -58], [12, -72], [34, -66], [44, -46], [34, -8], [-34, -8]]), { fill: VERM, shade: [10, 1, 3] });
      paint(g, smooth([[-24, -68], [0, -48], [24, -68], [12, -72], [0, -60], [-12, -72]]), { fill: SKIN, line: 1 });
      for (let i = 0; i < 5; i++) paint(g, oval(-14 + i * 7, -56 + Math.abs(i - 2) * -3, 2.6), { fill: CREAM, line: .7 });
    });
    a.head();
    a.part('armL', g => { sleeve(g, -40, -54, -66, -22, 8.5, VERM); sleeve(g, -66, -22, -86, -46, 6.5, SKIN); hand(g, -90, -50, 6.5); brass(g, -40, -54); }, -40, -54, 'diva');
    a.part('armR', g => { sleeve(g, 40, -54, 66, -22, 8.5, VERM); sleeve(g, 66, -22, 86, -46, 6.5, SKIN); hand(g, 90, -50, 6.5); paint(g, smooth([[90, -50], [120, -78], [130, -56], [122, -38]]), { fill: GAMB, shade: [100, 1.3, 2.4] }); brass(g, 40, -54); }, 40, -54, 'diva2');
  } },
};

class Figure {
  constructor(id, scale, dpr) {
    this.id = id; const d = CAST[id]; this.sec = d.sec; this.parts = []; this.seed = id.length * 3.1 + id.charCodeAt(0);
    const s = Math.min(scale * dpr, 1.8), B = { x: -140, y: -160, w: 280, h: 280 };
    const self = this; const headOpt = { ...d.head };
    const add = (name, fn, px = 0, py = 0, motion = null) => {
      const c = mk(B.w * s, B.h * s), g = c.getContext('2d'); g.scale(s, s); g.translate(-B.x, -B.y); fn(g);
      self.parts.push({ name, img: margin(c, Math.max(1.2, 2.4 * s)), px, py, motion, isHead: name === 'head' });
    };
    d.build({
      part: add,
      head() { add('head', g => { g.translate(0, -92); head(g, headOpt); if (headOpt.specs) { g.strokeStyle = INK; g.lineWidth = 1; for (const x of [-10, 10]) g.stroke(oval(x, -3, 7)); g.beginPath(); g.moveTo(-3, -3); g.lineTo(3, -3); g.stroke(); } }, 0, -76); },
    });
    this.opt = headOpt; this.b = B; this.s = scale;
  }
}

const SCENES = {
  bare(g, w, h, r) { wash(g, w, h, ['#6f5a42', '#574332']); g.save(); g.globalAlpha = .4; rule(g, 0, 0, w, h, 1.57, 22, INK, 1); g.restore(); for (let i = 0; i < 4; i++) paint(g, poly([[w * (.1 + i * .24), 0], [w * (.1 + i * .24) + 4, 0], [w * (.1 + i * .24) + 3, h * .9], [w * (.1 + i * .24) - 1, h * .9]]), { fill: '#3e2c1e', line: 0 }); },
  prom(g, w, h, r) {
    wash(g, w, h, ['#a9cbd6', '#e9dfc0']); skyLines(g, w, h * .6, .3);
    cloud(g, w * .22, h * .16, w * .13, r); cloud(g, w * .72, h * .1, w * .17, r);
    paint(g, poly([[0, h * .42], [w, h * .42], [w, h * .62], [0, h * .62]]), { fill: '#5b8b98', shade: [-9e3, 0, 4, .35], line: 1, box: [0, 0, w, h] });
    for (let i = 0; i < 3; i++) { const x = w * (.12 + i * .33); paint(g, poly([[x, h * .42], [x + w * .05, h * .34], [x + w * .05, h * .4], [x + w * .1, h * .42]]), { fill: CREAM, line: 1 }); }
    // pier and bunting
    paint(g, smooth([[0, h], [0, h * .56], [w * .3, h * .52], [w * .7, h * .53], [w, h * .58], [w, h]]), { fill: '#d9c389', shade: [-9e3, .1, 5, .5], box: [0, 0, w, h] });
    for (const x of [.08, .92]) { paint(g, poly([[w * x - 3, h * .55], [w * x + 3, h * .55], [w * x + 2, h * .1], [w * x - 2, h * .1]]), { fill: '#6b4a2e' }); }
    const q = (t) => [w * (.08 + .84 * t), h * (.13 + .24 * 4 * t * (1 - t))];
    g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); for (let t = 0; t <= 1; t += .02) { const p = q(t); t ? g.lineTo(...p) : g.moveTo(...p); } g.stroke();
    for (let i = 0; i < 16; i++) { const p = q((i + .5) / 16), z = w * .018; paint(g, poly([[p[0] - z, p[1]], [p[0] + z, p[1]], [p[0], p[1] + z * 2.2]]), { fill: [VERM, PRUS, GAMB, CREAM][i % 4], line: .8 }); }
  },
  river(g, w, h, r) {
    wash(g, w, h, ['#efd7a9', '#cfdcc6']); skyLines(g, w, h * .5, .22);
    paint(g, smooth([[0, h * .7], [0, h * .34], [w * .2, h * .24], [w * .4, h * .35], [w * .6, h * .22], [w * .85, h * .33], [w, h * .28], [w, h * .7]]), { fill: '#9fb492', shade: [-9e3, .7, 5, .4], box: [0, 0, w, h] });
    for (let i = 0; i < 8; i++) { const x = w * (.3 + i * .05), hh = h * (.05 + (i % 3) * .035); paint(g, poly([[x, h * .46], [x, h * .46 - hh], [x + w * .012, h * .46 - hh - h * .05], [x + w * .024, h * .46 - hh], [x + w * .024, h * .46]]), { fill: i % 2 ? '#c9a77c' : '#b98f68', line: .9 }); }
    paint(g, poly([[0, h * .46], [w, h * .46], [w, h * .64], [0, h * .64]]), { fill: '#74a4b6', shade: [-9e3, 0, 4, .45], line: 1, box: [0, 0, w, h] });
    paint(g, smooth([[0, h], [0, h * .58], [w * .28, h * .6], [w * .6, h * .56], [w, h * .6], [w, h]]), { fill: '#7f9a59', shade: [-9e3, .4, 5, .45], box: [0, 0, w, h] });
  },
  night(g, w, h, r) {
    wash(g, w, h, ['#16263f', '#2f4a68']); g.save(); g.globalAlpha = .3; rule(g, 0, 0, w, h, .03, 5, '#0a1220', 1); g.restore();
    for (let i = 0; i < 46; i++) { const x = r() * w, y = r() * h * .6, z = 1 + r() * 2.5; paint(g, star(x, y, z * (w / 300)), { fill: '#f1dc9a', line: 0, off: 0 }); }
    paint(g, oval(w * .76, h * .2, w * .085), { fill: '#f3e6b1', line: 1 }); g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#1f3250'; g.fill(oval(w * .8, h * .18, w * .082)); g.globalCompositeOperation = 'source-over';
    cloud(g, w * .3, h * .3, w * .16, r, '#566f8e'); cloud(g, w * .6, h * .42, w * .2, r, '#4a6281');
    paint(g, smooth([[0, h], [0, h * .6], [w * .35, h * .54], [w * .7, h * .62], [w, h * .56], [w, h]]), { fill: '#1a2c44', shade: [-9e3, .5, 5, .5], box: [0, 0, w, h] });
    for (let i = 0; i < 5; i++) { const x = w * (.1 + i * .2), y = h * (.56 + (i % 2) * .02), z = w * .04; paint(g, poly([[x, y], [x + z, y - z], [x + z * 2, y], [x + z * 2, y + z], [x, y + z]]), { fill: '#24344e', line: 1, ink: '#0a1220' }); g.fillStyle = '#f0c96a'; g.fillRect(x + z * .7, y + z * .2, z * .5, z * .45); }
  },
  seville(g, w, h, r) {
    wash(g, w, h, ['#f0b45e', '#f6dfa4']); skyLines(g, w, h * .45, .2);
    paint(g, oval(w * .5, h * .34, w * .13), { fill: '#fbe9a6', line: 1 });
    paint(g, poly([[0, h * .3], [w, h * .3], [w, h], [0, h]]), { fill: '#d98a52', shade: [-9e3, 1.2, 6, .3], box: [0, 0, w, h] });
    const n = 5, aw = w / n;
    for (let i = 0; i < n; i++) { const x = aw * i + aw * .18, y = h * .42, wd = aw * .64, p = new Path2D(); p.moveTo(x, h * .7); p.lineTo(x, y); p.ellipse(x + wd / 2, y, wd / 2, wd * .62, 0, Math.PI, 0); p.lineTo(x + wd, h * .7); p.closePath(); paint(g, p, { fill: '#7e3f27', shade: [-9e3, .8, 4, .6], box: [0, 0, w, h] }); }
    paint(g, poly([[0, h * .3], [w, h * .3], [w, h * .34], [0, h * .34]]), { fill: '#efe0bb', line: 1 });
    for (let i = 0; i < 26; i++) { paint(g, poly([[i * w / 26, h * .3], [(i + .5) * w / 26, h * .26], [(i + 1) * w / 26, h * .3]]), { fill: '#b6512d', line: .7 }); }
    paint(g, poly([[0, h * .66], [w, h * .66], [w, h], [0, h]]), { fill: '#c9975d', shade: [-9e3, .3, 5, .35], box: [0, 0, w, h] });
    for (const x of [.1, .9]) { const X = w * x; paint(g, poly([[X - 3, h * .68], [X + 3, h * .68], [X + 2, h * .4], [X - 2, h * .4]]), { fill: '#59412a' }); paint(g, smooth([[X - w * .07, h * .42], [X - w * .05, h * .22], [X, h * .17], [X + w * .05, h * .22], [X + w * .07, h * .42], [X, h * .47]]), { fill: '#3f6b41', shade: [X, .8, 3.4, .6], box: [0, 0, w, h] }); for (let i = 0; i < 6; i++) paint(g, oval(X + (r() - .5) * w * .1, h * (.24 + r() * .18), w * .007), { fill: GAMB, line: .6 }); }
  },
  cavern(g, w, h, r) {
    wash(g, w, h, ['#16241f', '#2d4a37']);
    g.save(); g.globalAlpha = .55; rule(g, 0, 0, w, h, 1.2, 5, '#050a08', 1); g.restore();
    const glow = g.createRadialGradient(w * .5, h * .55, 0, w * .5, h * .55, w * .5); glow.addColorStop(0, 'rgba(208,110,40,.75)'); glow.addColorStop(1, 'rgba(208,110,40,0)'); g.fillStyle = glow; g.fillRect(0, 0, w, h);
    for (let l = 0; l < 2; l++) for (let i = 0; i < 11; i++) { const x = (i + r() * .6) * w / 10, wd = w * (.05 + r() * .04), len = h * (.14 + r() * .24); paint(g, smooth([[x - wd, -4], [x, len], [x + wd, -4]]), { fill: l ? '#1a2c26' : '#28423a', shade: [x, 1.1, 3, .7], ink: '#060c09', box: [0, 0, w, h] }); }
    paint(g, smooth([[0, h], [0, h * .62], [w * .2, h * .68], [w * .5, h * .6], [w * .8, h * .68], [w, h * .6], [w, h]]), { fill: '#1b2f27', shade: [-9e3, .7, 4, .6], ink: '#060c09', box: [0, 0, w, h] });
    for (let i = 0; i < 11; i++) { const x = w * (.06 + i * .09), y = h * (.52 + r() * .12), z = w * .008; for (const d of [-1, 1]) { g.fillStyle = '#f2d24a'; g.fill(oval(x + d * z * 1.3, y, z, z * .75)); } }
  },
  dawn(g, w, h, r) {
    wash(g, w, h, ['#f2c15e', '#f7e6b5']);
    const c = [w * .5, h * .62];
    for (let i = 0; i < 28; i++) { const a0 = i / 28 * 6.283, a1 = a0 + .112; paint(g, poly([c, [c[0] + Math.cos(a0) * w * 1.2, c[1] + Math.sin(a0) * w * 1.2], [c[0] + Math.cos(a1) * w * 1.2, c[1] + Math.sin(a1) * w * 1.2]]), { fill: 'rgba(214,92,42,.55)', line: 0, off: 0 }); }
    paint(g, oval(c[0], c[1], w * .13), { fill: '#fff0b8', line: 1.2 });
    paint(g, smooth([[0, h], [0, h * .62], [w * .16, h * .42], [w * .3, h * .58], [w * .46, h * .46], [w * .62, h * .6], [w * .8, h * .38], [w, h * .56], [w, h]]), { fill: '#6f7f96', shade: [w * .3, .9, 4, .4], box: [0, 0, w, h] });
    paint(g, smooth([[0, h], [0, h * .72], [w * .3, h * .64], [w * .62, h * .72], [w, h * .66], [w, h]]), { fill: '#4e7346', shade: [-9e3, .5, 5, .45], box: [0, 0, w, h] });
  },
  cabaret(g, w, h, r) {
    wash(g, w, h, ['#7b1e23', '#3c0f14']); g.save(); g.globalAlpha = .4; rule(g, 0, 0, w, h, 1.57, 16, '#1e0608', 2); g.restore();
    for (let i = 0; i < 9; i++) { const x = w * (.06 + i * .11); g.strokeStyle = GOLD; g.lineWidth = 1; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h * .24); g.stroke(); const gl = g.createRadialGradient(x, h * .26, 0, x, h * .26, w * .07); gl.addColorStop(0, 'rgba(250,206,110,.9)'); gl.addColorStop(1, 'rgba(250,206,110,0)'); g.fillStyle = gl; g.fillRect(x - w * .08, h * .17, w * .16, h * .2); paint(g, oval(x, h * .26, w * .012), { fill: '#fde6a2', line: 1 }); }
    paint(g, poly([[0, h * .7], [w, h * .7], [w, h], [0, h]]), { fill: '#5b2a1c', shade: [-9e3, .1, 6, .4], box: [0, 0, w, h] });
  },
};
function star(x, y, z) { const p = new Path2D(); for (let i = 0; i < 8; i++) { const a = i * .785, r = i % 2 ? z * .32 : z; i ? p.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : p.moveTo(x + r, y); } p.closePath(); return p; }
function wash(g, w, h, [a, b]) { const l = g.createLinearGradient(0, 0, 0, h); l.addColorStop(0, a); l.addColorStop(1, b); g.fillStyle = l; g.fillRect(0, 0, w, h); }
function skyLines(g, w, h, a) { g.save(); g.globalAlpha = a; rule(g, 0, 0, w, h, .0, 4, INK, .6, .9); g.restore(); }
function cloud(g, x, y, z, r, c = CREAM) { const pts = []; const n = 9; for (let i = 0; i < n; i++) { const a = i / n * 6.283; pts.push([x + Math.cos(a) * z * (1 + r() * .22), y + Math.sin(a) * z * .34 * (1 + r() * .4)]); } paint(g, smooth(pts), { fill: c, line: .9, box: [x - z, y - z, x + z, y + z] }); }

const ROWS = [ // x and baseline in the opening, 0..1
  ['trumpet', .12, .55], ['horn', .29, .55], ['tuba', .52, .55], ['tri', .92, .55], ['timp', .73, .5],
  ['v1', .09, 1], ['v2', .25, 1], ['cello', .43, 1], ['flute', .62, 1], ['clar', .78, 1], ['solo', .925, 1.02],
];

export class Art {
  constructor() { this.dpr = 1; this.scenes = {}; this.figs = []; this.patrons = []; }
  layout(R, dpr) {
    this.R = R; this.dpr = dpr; this.scenes = {};
    const side = Math.max(34, Math.min(R.w * .1, 110)), top = Math.max(38, R.h * .1), bot = Math.max(16, R.h * .055);
    const O = this.O = { x: R.x + side, y: R.y + top, w: R.w - side * 2, h: R.h - top - bot };
    const u = this.u = Math.min(O.w / (O.w < O.h * 1.3 ? 5.4 : 6.4), O.h / 2.86); const s = u / 100; this.s = s;
    this.figs = ROWS.map(([id, x, y]) => { const f = new Figure(id, s, dpr); f.x = O.x + O.w * x; f.y = O.y + O.h - u * (y > .9 ? .1 : (O.w < O.h * 1.3 ? 1.5 : 1.2) + (id === 'timp' ? .1 : 0)); return f; });
    this.secPos = {}; for (const sec of ['str', 'wood', 'brass', 'tuba', 'drum', 'tri', 'solo']) { const fs = this.figs.filter(f => f.sec === sec); this.secPos[sec] = { x: fs.reduce((a, f) => a + f.x, 0) / fs.length, y: fs[0].y - u * .75, top: fs[0].y - u * 1.45 }; }
    this.buildFrame(side, top, bot); this.buildCurtain(); this.buildPatrons(side, top);
  }
  scene(name) {
    if (this.scenes[name]) return this.scenes[name];
    const O = this.O, d = this.dpr, c = mk(O.w * d, O.h * d), g = c.getContext('2d'); g.scale(d, d);
    (SCENES[name] || SCENES.bare)(g, O.w, O.h, rng(name.length * 977 + 5));
    return this.scenes[name] = c;
  }
  buildFrame(side, top, bot) {
    const { R, O, dpr: d } = this, c = this.frame = mk(R.w * d, R.h * d), g = c.getContext('2d'); g.scale(d, d); g.translate(-R.x, -R.y);
    const box = [R.x, R.y, R.x + R.w, R.y + R.h];
    const fr = new Path2D(); fr.rect(R.x, R.y, R.w, R.h); fr.moveTo(O.x, O.y + O.h); fr.lineTo(O.x + O.w, O.y + O.h); fr.lineTo(O.x + O.w, O.y); fr.lineTo(O.x, O.y); fr.closePath();
    g.fillStyle = CRIM; g.fill(fr, 'evenodd');
    g.save(); g.clip(fr, 'evenodd'); g.globalAlpha = .5; rule(g, ...box, .85, 3.2, '#2a0a0c', .8); g.restore();
    // gold mouldings
    for (const [ins, w, col] of [[0, 3, GOLD], [-7, 1, INK], [-10, 2, GOLD]]) { g.strokeStyle = col; g.lineWidth = w; g.strokeRect(O.x + ins, O.y + ins, O.w - ins * 2, O.h - ins * 2 + bot * .4); }
    // arch swag across the top
    const sw = 5, sww = O.w / sw;
    for (let i = 0; i < sw; i++) { const x = O.x + i * sww; const p = smooth([[x, O.y - 2], [x + sww * .5, O.y - 2], [x + sww, O.y - 2], [x + sww * .8, O.y + top * .36], [x + sww * .5, O.y + top * .46], [x + sww * .2, O.y + top * .36]]); paint(g, p, { fill: VERM, shade: [-1e4, 1.1, 3, .55], box }); for (let k = 0; k < 2; k++) { paint(g, smooth([[x + sww * (.08 + k * .1), O.y + 2], [x + sww * .5, O.y + top * (.22 + k * .1)], [x + sww * (.92 - k * .1), O.y + 2]], false), { line: .9 }); } paint(g, oval(x + sww, O.y + 2, 4.5), { fill: GOLD, line: .9 }); }
    // cartouche
    const cx = R.x + R.w / 2, cy = R.y + top * .42, cw = Math.min(R.w * .3, 170);
    paint(g, smooth([[cx - cw, cy], [cx - cw * .78, cy - top * .34], [cx, cy - top * .4], [cx + cw * .78, cy - top * .34], [cx + cw, cy], [cx + cw * .78, cy + top * .34], [cx, cy + top * .4], [cx - cw * .78, cy + top * .34]]), { fill: '#e8c877', shade: [-1e4, .9, 3.4, .22], box });
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `400 ${Math.min(top * .3, 19)}px "Gravitas One", serif`; g.fillText('THEATRE ROYAL', cx, cy + 1);
    // stage front: boards and footlight trough
    const fy = O.y + O.h;
    paint(g, poly([[O.x - 3, fy - 1], [O.x + O.w + 3, fy - 1], [O.x + O.w + 3, R.y + R.h], [O.x - 3, R.y + R.h]]), { fill: '#22130c', shade: [-1e4, 1.57, 9, .5], box });
    // boxes either side
    this.boxes = []; const tiers = R.h > 300 ? 2 : 1, th = (O.h + top * .3) / tiers;
    for (const sx of [0, 1]) for (let i = 0; i < tiers; i++) {
      const bx = sx ? O.x + O.w + 11 : R.x + 2, bw = side - 13, by = R.y + top * .7 + i * th + th * .08, bh = th * .8;
      const p = new Path2D(); p.moveTo(bx, by + bh); p.lineTo(bx, by + bw * .55); p.ellipse(bx + bw / 2, by + bw * .55, bw / 2, bw * .55, 0, Math.PI, 0); p.lineTo(bx + bw, by + bh); p.closePath();
      paint(g, p, { fill: '#1c0b0b', line: 1.2 }); g.strokeStyle = GOLD; g.lineWidth = 1.6; g.stroke(p);
      this.boxes.push({ x: bx, y: by, w: bw, h: bh });
    }
  }
  drawFrontOfBoxes(g) {
    // the velvet rail, in front of the patrons
    for (const b of this.boxes) { const ry = b.y + b.h * .66; const box = [b.x, ry, b.x + b.w, b.y + b.h]; paint(g, poly([[b.x - 2, ry], [b.x + b.w + 2, ry], [b.x + b.w + 2, b.y + b.h + 2], [b.x - 2, b.y + b.h + 2]]), { fill: VERM, shade: [-1e4, 1.2, 2.6, .5], box, line: 1.1 }); g.fillStyle = GOLD; g.fillRect(b.x - 2, ry - 2, b.w + 4, 3); }
  }
  buildPatrons(side) {
    const r = rng(4242), hairs = ['bald', 'side', 'bun', 'curls', 'side', 'bun'], cols = ['#6a4a2a', '#3a2a20', '#a8a296', '#b3762c', '#4b3a30'];
    this.patrons = [];
    for (const b of this.boxes) {
      const n = Math.max(1, Math.round(b.w / 26)), z = b.w / n;
      for (let i = 0; i < n; i++) {
        const sc = Math.min(.42, z / 58 * this.dpr / this.dpr), o = { shape: ['egg', 'round', 'pear', 'long'][r() * 4 | 0], hair: hairs[r() * hairs.length | 0], hairC: cols[r() * cols.length | 0], nose: ['snub', 'long', 'bulb'][r() * 3 | 0], face: r() < .25 ? 'walrus' : '', r: 22 };
        const s = sc * this.dpr, c = mk(90 * s, 110 * s), g = c.getContext('2d'); g.scale(s, s); g.translate(45, 50);
        g.fillStyle = PLUM; paint(g, smooth([[-30, 30], [-14, 18], [14, 18], [30, 30], [34, 60], [-34, 60]]), { fill: ['#3b3634', PLUM, PRUS, SAP, ROSE][r() * 5 | 0], line: 1.4 });
        head(g, o); g.fillStyle = INK; g.fill(oval(-8, -3, 2.2)); g.fill(oval(8, -3, 2.2));
        this.patrons.push({ img: margin(c, 1.2), x: b.x + z * (i + .5), y: b.y + b.h * .62, sc, w: 90 * sc, h: 110 * sc, gone: 0, leaving: false, ph: r() * 6.28, rate: .8 + r() });
      }
    }
  }
  buildCurtain() {
    const { O, dpr: d } = this, c = this.curtain = mk(O.w * d, (O.h + 8) * d), g = c.getContext('2d'); g.scale(d, d); const w = O.w, h = O.h + 8, box = [0, 0, w, h];
    g.fillStyle = CRIM; g.fillRect(0, 0, w, h);
    const n = Math.round(w / 34);
    for (let i = 0; i < n; i++) { const x = i / n * w, ww = w / n; const l = g.createLinearGradient(x, 0, x + ww, 0); l.addColorStop(0, 'rgba(255,120,90,.26)'); l.addColorStop(.5, 'rgba(255,120,90,0)'); l.addColorStop(1, 'rgba(0,0,0,.42)'); g.fillStyle = l; g.fillRect(x, 0, ww, h); g.save(); g.beginPath(); g.rect(x + ww * .55, 0, ww * .45, h); g.clip(); g.globalAlpha = .55; rule(g, x, 0, x + ww, h, 1.4, 2.6, '#1e0507', .7); g.restore(); g.strokeStyle = INK; g.lineWidth = .9; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    const fy = h - Math.max(26, h * .1);
    paint(g, poly([[0, fy], [w, fy], [w, fy + 7], [0, fy + 7]]), { fill: GOLD, line: 1, box });
    for (let x = 4; x < w; x += 9) paint(g, poly([[x - 3.5, fy + 7], [x + 3.5, fy + 7], [x + 2.5, fy + 21], [x - 2.5, fy + 21]]), { fill: GAMB, line: .7 });
    const cx = w / 2, cy = h * .44, z = Math.min(w, h) * .22;
    paint(g, smooth([[cx - z, cy], [cx - z * .7, cy - z * .7], [cx, cy - z * .92], [cx + z * .7, cy - z * .7], [cx + z, cy], [cx + z * .7, cy + z * .7], [cx, cy + z * .92], [cx - z * .7, cy + z * .7]]), { fill: '#e8c877', box, shade: [-1e4, .8, 3.4, .25] });
    paint(g, smooth([[cx - z * .82, cy], [cx - z * .56, cy - z * .56], [cx, cy - z * .74], [cx + z * .56, cy - z * .56], [cx + z * .82, cy], [cx + z * .56, cy + z * .56], [cx, cy + z * .74], [cx - z * .56, cy + z * .56]]), { line: 1 });
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `400 ${z * .32}px "Gravitas One", serif`; g.fillText('L. W. P. S.', cx, cy - z * .05);
    g.font = `italic 400 ${z * .15}px "Old Standard TT", serif`; g.fillText('Est. for the Improvement', cx, cy + z * .25); g.fillText('of the Town', cx, cy + z * .42);
  }
  // Poses come from time since each section last sounded, so anybody playing visibly plays.
  pose(f, t, S, beat) {
    const sinceB = Math.max(0, t - (S ? S.lastBig : -9)), hit = Math.exp(-sinceB * 7), act = Math.exp(-Math.max(0, t - (S ? S.last : -9)) * 2.2), n = this.seed;
    const asleep = S?.asleep;
    return { hit, act, sway: asleep ? Math.sin(t * .9) * .02 : Math.sin(t * 2.3 + f.seed) * .012 + hit * .018 * Math.sin(f.seed), asleep };
  }
  angle(m, t, q, f) {
    const v = q.act; switch (m) {
      case 'saw': return Math.sin(t * 7 + f.seed) * .22 * v;
      case 'saw2': return Math.sin(t * 6 + f.seed) * .13 * v;
      case 'tilt': return Math.sin(t * 3 + f.seed) * .04 * v + q.hit * .03;
      case 'blow': return -q.hit * .055;
      case 'tubabob': return q.asleep ? .02 : -q.hit * .03;
      case 'stickL': return -.45 * q.hit * (Math.sin(t * 9) > 0 ? 1 : .2) + .16;
      case 'stickR': return .45 * q.hit * (Math.sin(t * 9) > 0 ? .2 : 1) - .16;
      case 'ting': return q.hit * -.5 + .05;
      case 'diva': return -.35 * q.act + Math.sin(t * 1.7) * .08;
      case 'diva2': return .35 * q.act - Math.sin(t * 1.3) * .08;
    } return 0;
  }
  face(g, f, q, ctx, t) {
    const o = f.opt, r = o.r, look = ctx.look || 0, blink = Math.sin(t * .7 + f.seed * 3) > .985;
    g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = 1.3; g.lineCap = 'round';
    const ex = r * .42, ey = -r * .12;
    if (q.asleep || blink) { for (const d of [-1, 1]) { g.beginPath(); g.arc(d * ex, ey, 4, .2, 2.94); g.stroke(); } }
    else if (ctx.alarm) { for (const d of [-1, 1]) { g.fillStyle = CREAM; g.fill(oval(d * ex, ey, 5.5)); g.stroke(oval(d * ex, ey, 5.5)); g.fillStyle = INK; g.fill(oval(d * ex + look, ey + 1, 1.8)); } }
    else { for (const d of [-1, 1]) g.fill(oval(d * ex + look * .6, ey, 2.4)); }
    const brow = ctx.alarm ? -6 : ctx.cross ? 3 : 0; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(d * ex - 5, ey - 8 + brow + (ctx.cross ? d * 2 : 0)); g.lineTo(d * ex + 5, ey - 8 + brow - (ctx.cross ? d * 2 : 0)); g.stroke(); }
    if (o.mouth) { const a = Math.max(.15, q.act); g.fillStyle = '#5a1518'; g.fill(oval(0, r * .86, 6.5, 2 + 8 * a)); g.stroke(oval(0, r * .86, 6.5, 2 + 8 * a)); }
    else if (!o.face || o.face === 'goatee') { g.beginPath(); if (ctx.alarm) g.arc(0, r * .78, 3.4, 0, 6.2832); else g.arc(0, r * .55, 7, .4, 2.74); g.stroke(); }
  }
  drawFigure(g, f, secState, t, ctx) {
    const q = this.pose(f, t, secState); const k = 1 / this.dpr;
    g.save(); g.translate(f.x + (ctx.nudge || 0), f.y); g.rotate(q.sway);
    const bx = f.b.x * f.s, by = f.b.y * f.s, ww = f.b.w * f.s, hh = f.b.h * f.s;
    for (const p of f.parts) {
      const m = p.isHead ? null : p.motion; const headRot = p.isHead ? (q.asleep ? .24 + Math.sin(t * 1.1) * .03 : Math.sin(t * 1.6 + f.seed) * .025 + (ctx.alarm ? 0 : q.hit * .02)) : 0;
      const a = headRot || (m ? this.angle(m, t, q, f) : 0);
      if (a) { g.save(); g.translate(p.px * f.s, p.py * f.s); g.rotate(a); g.translate(-p.px * f.s, -p.py * f.s); }
      else if (p.isHead) g.save();
      g.drawImage(p.img, bx, by, ww, hh);
      if (p.isHead) { g.translate(0, -92 * f.s); g.scale(f.s, f.s); this.face(g, f, q, ctx, t); g.restore(); }
      else if (a) g.restore();
    }
    g.restore();
  }
  // the printer's pointing hand, pointing down at whoever needs you
  manicule(g, x, y, s, a = 0, col = VERM) {
    g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
    paint(g, poly([[-10, -36], [12, -36], [11, -24], [-9, -24]]), { fill: col, off: 0, line: 1.1 });
    paint(g, poly([[-13, -40], [15, -40], [15, -35], [-13, -35]]), { fill: CREAM, off: 0, line: 1 });
    const h = smooth([[-9, -24], [11, -24], [15, -14], [13, -6], [8, -3], [3.5, -4], [3.2, 12], [0, 15], [-3.2, 12], [-3.5, -5], [-7, -6], [-12, -10], [-16, -18], [-13, -21]]);
    paint(g, h, { fill: CREAM, off: 0, line: 1.3 });
    g.strokeStyle = INK; g.lineWidth = .9; g.beginPath(); for (const x0 of [5, 9]) { g.moveTo(x0, -14); g.lineTo(x0 + .6, -4.5); } g.moveTo(-3.3, -9); g.lineTo(3.2, -9); g.moveTo(-1, 4); g.lineTo(1.5, 4); g.stroke();
    g.restore();
  }
}
