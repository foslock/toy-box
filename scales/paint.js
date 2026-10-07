// Scales: the printed look. Everything is drawn like a two- or three-ink screenprint on cream stock: flat ink, a
// halftone of a darker ink for shade, and the black key plate a hair out of register. Each piece of produce is two
// sprites: its body (colour, pattern, stem; it turns as it rolls) and its shade (halftone and a paper-white glint;
// it doesn't turn, so the light stays top left).

export const INK = '#2b201c', PAPER = '#f3e7cf', CREAM = '#fbf4e2';
export const RED = '#c2412d', ORANGE = '#e0782c', MUSTARD = '#dba33a', OLIVE = '#77893c', TEAL = '#2e6a69', PLUM = '#5b3561';
export const WOOD = '#c08c56', WOOD_D = '#8b5a33', WOOD_L = '#d8aa72', STRAW = '#e3bf69', STRAW_D = '#b98f3e';
const TAU = Math.PI * 2;
const MIS = [0.9, 0.7];   // the key plate's misregistration, in sprite pixels per unit of scale

// a little deterministic noise so every sprite is the same each time
function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
export function canvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)))
    : Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.ceil(w)), height: Math.max(1, Math.ceil(h)) });
  return c;
}

// a closed wobbly outline around the origin: n lobes of depth amp, plus a small hand-drawn wobble
function outline(ctx, R, { n = 0, amp = 0, ph = 0, wob = 0.012, seed = 1, flat = 0, steps = 72 } = {}) {
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = i / steps * TAU;
    let r = R * (1 - amp * 0.5 + amp * 0.5 * Math.cos(n * a + ph));
    r *= 1 + wob * (Math.sin(a * 3 + seed) * 0.6 + Math.sin(a * 7 + seed * 2.3) * 0.4);
    const y = Math.sin(a) * r * (1 - flat * (Math.sin(a) > 0 ? 0.6 : 1)), x = Math.cos(a) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}
// a meridian of a sphere seen side on, at longitude lon (radians), as a path from pole to pole
function meridian(ctx, R, lon, squash = 1) {
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const lat = -Math.PI / 2 + i / 24 * Math.PI;
    const x = R * Math.sin(lon) * Math.cos(lat), y = R * Math.sin(lat) * squash;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
}
function stem(ctx, R, s, { len = 0.38, bend = 0.25, w = 0.07, col = INK, ang = -Math.PI / 2 } = {}) {
  ctx.save(); ctx.rotate(ang + Math.PI / 2);
  ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.4 * s, R * w);
  ctx.beginPath(); ctx.moveTo(0, -R * 0.82); ctx.quadraticCurveTo(R * bend * 0.4, -R * (0.82 + len * 0.6), R * bend, -R * (0.82 + len)); ctx.stroke();
  ctx.restore();
}
function leaf(ctx, R, s, { x = 0.12, y = -0.95, len = 0.5, ang = -0.5, col = OLIVE } = {}) {
  ctx.save(); ctx.translate(R * x, R * y); ctx.rotate(ang);
  const L = R * len;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * 0.5, -L * 0.42, L, 0); ctx.quadraticCurveTo(L * 0.5, L * 0.42, 0, 0); ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = Math.max(1, R * 0.035); ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L * 0.1, 0); ctx.lineTo(L * 0.85, 0); ctx.lineWidth = Math.max(0.8, R * 0.022); ctx.stroke();
  ctx.restore();
}
function speckle(ctx, R, n, col, size, seed, alpha = 1) {
  ctx.fillStyle = col; ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const a = hash(seed + i) * TAU, d = Math.sqrt(hash(seed + i * 1.7 + 3)) * R * 0.92;
    ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, size * (0.5 + hash(seed + i * 2.1) * 0.8), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// the produce, by key: shape (outline options), base ink, shade ink, and what to print on top of the base
const LOOKS = {
  crab: { base: '#c8402f', shade: '#6e1d22', shape: { wob: 0.02, flat: 0.08 },
    paint(c, R, s) {
      c.fillStyle = '#e6703f'; c.globalAlpha = 0.85; c.beginPath(); c.ellipse(R * 0.3, R * 0.15, R * 0.42, R * 0.55, 0.4, 0, TAU); c.fill(); c.globalAlpha = 1;
      speckle(c, R, 7, '#f0c27a', R * 0.035, 11, 0.9);
    },
    top(c, R, s) { stem(c, R, s, { len: 0.45, bend: 0.35, w: 0.09 }); leaf(c, R, s, { x: 0.18, y: -1.05, len: 0.62, ang: -0.35 }); } },
  damson: { base: '#4a3f7a', shade: '#1e1636', shape: { wob: 0.015, flat: -0.08 },
    paint(c, R, s) {
      speckle(c, R, 26, '#a59ccc', R * 0.05, 21, 0.55);
      c.strokeStyle = '#2a2150'; c.lineWidth = Math.max(1, R * 0.06); c.beginPath(); c.moveTo(R * 0.05, -R * 0.9); c.quadraticCurveTo(R * 0.32, 0, R * 0.08, R * 0.88); c.stroke();
    },
    top(c, R, s) { stem(c, R, s, { len: 0.3, bend: -0.2, w: 0.08, col: '#5a4026' }); } },
  apple: { base: '#e5b13b', shade: '#8a5a1c', shape: { wob: 0.02, flat: 0.06 },
    paint(c, R, s) {
      c.fillStyle = '#d65f36'; c.globalAlpha = 0.7; c.beginPath(); c.ellipse(-R * 0.35, R * 0.1, R * 0.45, R * 0.62, -0.3, 0, TAU); c.fill(); c.globalAlpha = 1;
      speckle(c, R, 22, '#a8762a', R * 0.03, 31, 0.8);
    },
    top(c, R, s) {
      c.fillStyle = '#8a5a1c'; c.beginPath(); c.ellipse(0, -R * 0.78, R * 0.16, R * 0.07, 0, 0, TAU); c.fill();
      stem(c, R, s, { len: 0.4, bend: 0.2, w: 0.075 }); leaf(c, R, s, { x: 0.12, y: -1.02, len: 0.55, ang: -0.6 });
    } },
  turnip: { base: '#f1e5c9', shade: '#7a5a6e', shape: { wob: 0.02, flat: -0.05 },
    paint(c, R, s) {
      // the purple shoulders, with a soft printed edge
      c.save(); c.beginPath();
      for (let i = 0; i <= 40; i++) { const x = -R + i / 40 * 2 * R; const y = -R * 0.05 + Math.sin(i * 0.9) * R * 0.05; i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.lineTo(R, -R); c.lineTo(-R, -R); c.closePath(); c.clip();
      c.fillStyle = '#9b3a6f'; c.fillRect(-R, -R, 2 * R, 2 * R); c.restore();
      c.fillStyle = '#9b3a6f'; for (let i = 0; i < 14; i++) { const x = -R * 0.9 + hash(41 + i) * R * 1.8, y = R * 0.02 + hash(51 + i) * R * 0.22; c.globalAlpha = 0.7; c.beginPath(); c.arc(x, y, R * 0.04, 0, TAU); c.fill(); }
      c.globalAlpha = 1;
      c.strokeStyle = 'rgba(122,90,110,.6)'; c.lineWidth = Math.max(0.8, R * 0.025);
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, R * (0.35 + i * 0.18), R * (0.5 - i * 0.12), 0.2, Math.PI - 0.2); c.stroke(); }
    },
    top(c, R, s) {
      c.strokeStyle = INK; c.lineWidth = Math.max(1, R * 0.04); c.beginPath(); c.moveTo(0, R * 0.95); c.quadraticCurveTo(R * 0.06, R * 1.15, -R * 0.08, R * 1.3); c.stroke();
      for (const [x, a, l] of [[-0.12, -0.7, 0.55], [0.02, -0.15, 0.62], [0.14, 0.45, 0.5]]) {
        c.save(); c.translate(R * x, -R * 0.9); c.rotate(a);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -R * l); c.lineWidth = Math.max(1.4 * s, R * 0.07); c.strokeStyle = '#4f6b2a'; c.lineCap = 'round'; c.stroke();
        c.restore();
      }
    } },
  acorn: { base: '#2f4a33', shade: '#0f1c12', shape: { n: 8, amp: 0.07, wob: 0.01, flat: 0.08 },
    paint(c, R, s) {
      c.fillStyle = '#e1883a'; c.globalAlpha = 0.95; c.beginPath(); c.ellipse(R * 0.25, R * 0.55, R * 0.5, R * 0.32, -0.3, 0, TAU); c.fill(); c.globalAlpha = 1;
      speckle(c, R, 10, '#e1883a', R * 0.04, 61, 0.8);
      for (let i = -3; i <= 3; i++) {
        meridian(c, R * 0.98, i * 0.42, 0.95); c.strokeStyle = '#13241a'; c.lineWidth = Math.max(1.2, R * 0.07); c.stroke();
        meridian(c, R * 0.98, i * 0.42 + 0.17, 0.95); c.strokeStyle = 'rgba(120,160,110,.45)'; c.lineWidth = Math.max(0.8, R * 0.03); c.stroke();
      }
    },
    top(c, R, s) {
      c.fillStyle = '#c9a06a'; c.strokeStyle = INK; c.lineWidth = Math.max(1, R * 0.035);
      c.beginPath(); c.moveTo(-R * 0.1, -R * 0.82); c.lineTo(-R * 0.08, -R * 1.08); c.lineTo(R * 0.1, -R * 1.1); c.lineTo(R * 0.11, -R * 0.82); c.closePath(); c.fill(); c.stroke();
    } },
  cabbage: { base: '#8dad58', shade: '#2f4a1c', shape: { n: 11, amp: 0.05, wob: 0.03, flat: 0.04 },
    paint(c, R, s) {
      c.fillStyle = '#6f9142';
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.4; c.beginPath(); c.ellipse(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, R * 0.55, R * 0.42, a, 0, TAU); c.globalAlpha = 0.6; c.fill(); }
      c.globalAlpha = 1;
      // crinkled leaf edges, and pale veins from the heart
      c.strokeStyle = '#3f5e25'; c.lineWidth = Math.max(1, R * 0.035);
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        for (let i = 0; i <= 50; i++) { const a = -0.3 + i / 50 * 2.6 + k * 1.9, r = R * (0.42 + k * 0.17) * (1 + 0.08 * Math.sin(i * 1.7)); const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      }
      c.strokeStyle = '#e4ecc0'; c.lineWidth = Math.max(1, R * 0.04);
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.2; c.beginPath(); c.moveTo(Math.cos(a) * R * 0.12, Math.sin(a) * R * 0.12); c.quadraticCurveTo(Math.cos(a + 0.3) * R * 0.5, Math.sin(a + 0.3) * R * 0.5, Math.cos(a + 0.15) * R * 0.9, Math.sin(a + 0.15) * R * 0.9); c.stroke(); }
    },
    top() {} },
  prince: { base: '#8aa3a2', shade: '#2c4446', shape: { n: 9, amp: 0.06, wob: 0.012, flat: 0.18 },
    paint(c, R, s) {
      for (let i = -3; i <= 3; i++) { meridian(c, R * 0.97, i * 0.4, 0.82); c.strokeStyle = 'rgba(44,68,70,.7)'; c.lineWidth = Math.max(1, R * 0.05); c.stroke(); }
      speckle(c, R, 16, '#c7d6cf', R * 0.03, 71, 0.6);
    },
    top(c, R, s) {
      c.fillStyle = '#d9c39a'; c.strokeStyle = INK; c.lineWidth = Math.max(1, R * 0.035);
      c.beginPath(); c.ellipse(0, -R * 0.78, R * 0.2, R * 0.11, 0, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-R * 0.07, -R * 0.82); c.lineTo(-R * 0.05, -R * 0.98); c.lineTo(R * 0.07, -R * 0.99); c.lineTo(R * 0.08, -R * 0.82); c.fillStyle = '#b89a6a'; c.fill(); c.stroke();
    } },
  turban: { base: '#e07a2c', shade: '#6d2a12', shape: { n: 10, amp: 0.06, wob: 0.012, flat: 0.06 },
    paint(c, R, s) {
      // the turban: striped green and cream ribs round the lower half
      c.save(); c.beginPath(); c.rect(-R * 1.2, R * 0.05, R * 2.4, R * 1.3); c.clip();
      for (let i = -5; i <= 5; i++) {
        meridian(c, R, i * 0.3, 1); c.strokeStyle = i % 2 ? '#4d7a3c' : '#f0e2c0'; c.lineWidth = R * 0.16; c.stroke();
      }
      c.restore();
      // the cap on top: a smaller dome with its own stripes
      c.fillStyle = '#c9472a'; c.beginPath(); c.ellipse(0, -R * 0.12, R * 0.62, R * 0.55, 0, 0, TAU); c.fill();
      c.save(); c.beginPath(); c.ellipse(0, -R * 0.12, R * 0.62, R * 0.55, 0, 0, TAU); c.clip();
      for (let i = -3; i <= 3; i++) { c.save(); c.translate(0, -R * 0.12); meridian(c, R * 0.6, i * 0.45, 0.92); c.restore(); c.strokeStyle = i % 2 ? '#f0e2c0' : '#4d7a3c'; c.lineWidth = R * 0.06; c.stroke(); }
      c.restore();
      c.strokeStyle = INK; c.lineWidth = Math.max(1, R * 0.03); c.beginPath(); c.ellipse(0, -R * 0.12, R * 0.62, R * 0.55, 0, 0.15, Math.PI - 0.15); c.stroke();
    },
    top(c, R, s) { stem(c, R, s, { len: 0.22, bend: 0.12, w: 0.1, col: '#6b5a2e' }); } },
  pumpkin: { base: '#e3792b', shade: '#7a2f0e', shape: { n: 8, amp: 0.09, wob: 0.01, flat: 0.12 },
    paint(c, R, s) {
      for (let i = -3; i <= 3; i++) {
        meridian(c, R * 0.97, i * 0.4, 0.88); c.strokeStyle = '#b5521a'; c.lineWidth = Math.max(1.2, R * 0.055); c.stroke();
        meridian(c, R * 0.97, i * 0.4 + 0.18, 0.88); c.strokeStyle = 'rgba(250,190,110,.55)'; c.lineWidth = Math.max(0.8, R * 0.03); c.stroke();
      }
    },
    top(c, R, s) {
      c.strokeStyle = '#4e5a24'; c.lineCap = 'round'; c.lineWidth = Math.max(1.4 * s, R * 0.13);
      c.beginPath(); c.moveTo(0, -R * 0.75); c.quadraticCurveTo(R * 0.04, -R * 0.98, R * 0.2, -R * 1.06); c.stroke();
      c.strokeStyle = INK; c.lineWidth = Math.max(1, R * 0.025);
      c.beginPath(); c.moveTo(R * 0.04, -R * 0.84); for (let i = 0; i < 18; i++) { const a = i * 0.7, r = R * (0.05 + i * 0.012); c.lineTo(-R * 0.1 - Math.cos(a) * r - i * R * 0.02, -R * 0.86 + Math.sin(a) * r); } c.stroke();
    } },
  giant: { base: '#eda66b', shade: '#7a3a17', shape: { n: 9, amp: 0.07, wob: 0.025, flat: 0.2 },
    paint(c, R, s) {
      for (let i = -3; i <= 3; i++) { meridian(c, R * 0.97, i * 0.4, 0.8); c.strokeStyle = 'rgba(176,96,48,.75)'; c.lineWidth = Math.max(1.2, R * 0.045); c.stroke(); }
      speckle(c, R, 30, '#f6c88f', R * 0.025, 81, 0.6);
    },
    top(c, R, s) {
      c.strokeStyle = '#6b6a2e'; c.lineCap = 'round'; c.lineWidth = Math.max(1.4 * s, R * 0.12);
      c.beginPath(); c.moveTo(0, -R * 0.66); c.quadraticCurveTo(-R * 0.05, -R * 0.86, -R * 0.2, -R * 0.92); c.stroke();
      // the rosette: first prize at the county show
      c.save(); c.translate(R * 0.5, -R * 0.28);
      c.fillStyle = '#2f5d9a'; c.strokeStyle = INK; c.lineWidth = Math.max(1, R * 0.025);
      for (const a of [-0.25, 0.25]) { c.save(); c.rotate(a); c.beginPath(); c.moveTo(-R * 0.08, 0); c.lineTo(-R * 0.1, R * 0.55); c.lineTo(0, R * 0.47); c.lineTo(R * 0.1, R * 0.55); c.lineTo(R * 0.08, 0); c.closePath(); c.fill(); c.stroke(); c.restore(); }
      c.beginPath(); for (let i = 0; i <= 32; i++) { const a = i / 32 * TAU, r = R * (0.25 + (i % 2) * 0.03); i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke();
      c.fillStyle = MUSTARD; c.beginPath(); c.arc(0, 0, R * 0.14, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = INK; c.font = `700 ${R * 0.12}px Ultra, Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('1st', 0, R * 0.01);
      c.restore();
    } },
};

// a piece of produce at radius R (sprite pixels). s is the pixel scale, for minimum line widths.
export function produceSprites(key, R, s) {
  R = Math.max(3, R);
  const L = LOOKS[key], pad = Math.ceil(R * 0.75 + 4), size = Math.ceil(R * 2 + pad * 2), o = size / 2;
  const body = canvas(size, size), c = body.getContext('2d');
  c.translate(o, o);
  outline(c, R, { ...L.shape, seed: R });
  c.fillStyle = L.base; c.fill();
  c.save(); outline(c, R, { ...L.shape, seed: R }); c.clip(); L.paint(c, R, s); c.restore();
  // the key plate, a hair out of register
  c.save(); c.translate(MIS[0] * s, MIS[1] * s);
  outline(c, R, { ...L.shape, seed: R }); c.strokeStyle = INK; c.lineWidth = Math.max(1.3 * s, R * 0.075); c.lineJoin = 'round'; c.stroke();
  c.restore();
  L.top(c, R, s);

  const shade = canvas(size, size), d = shade.getContext('2d');
  d.translate(o, o);
  d.save(); d.beginPath(); d.arc(0, 0, R * 0.93, 0, TAU); d.clip();
  halftone(d, R, L.shade, s);
  d.restore();
  // a glint where the paper shows through
  d.fillStyle = 'rgba(255,250,236,.8)';
  d.beginPath(); d.ellipse(-R * 0.4, -R * 0.42, R * 0.2, R * 0.1, -0.75, 0, TAU); d.fill();
  d.beginPath(); d.arc(-R * 0.14, -R * 0.6, R * 0.045, 0, TAU); d.fill();
  return { body, shade, o, R };
}
// shade dots on a 45° screen, bigger where a ball lit from the top left turns away from the light
function halftone(c, R, col, s) {
  const cell = Math.max(2.6 * s, R * 0.13), L = [-0.45, -0.62, 0.64], ln = Math.hypot(...L);
  c.fillStyle = col; c.globalAlpha = 0.62;
  c.rotate(Math.PI / 4);
  for (let y = -R * 1.5; y < R * 1.5; y += cell) for (let x = -R * 1.5; x < R * 1.5; x += cell) {
    // back to unrotated space for the lighting
    const ux = (x - y) * Math.SQRT1_2, uy = (x + y) * Math.SQRT1_2, d2 = (ux * ux + uy * uy) / (R * R);
    if (d2 > 1) continue;
    const nz = Math.sqrt(1 - d2), lit = (ux / R * L[0] + uy / R * L[1] + nz * L[2]) / ln;
    const dark = Math.max(0, Math.min(1, (0.78 - lit) * 1.25)) + d2 * d2 * 0.25;
    const r = cell * 0.55 * Math.sqrt(Math.min(1, dark));
    if (r < 0.35 * s) continue;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  c.rotate(-Math.PI / 4); c.globalAlpha = 1;
}

/* ------------------------------------------------------------------------------------------------- the plank */
// a weathered board with a batten at each end and the farm's name stencilled along its face, `L` by `T` (pixels)
export function plankSprite(L, T, lip, lipW, s, name = 'HOLLOWAY FARM  ·  FINE PRODUCE  ·  EST. 1931') {
  const pad = Math.ceil(4 * s), w = Math.ceil(L + pad * 2), h = Math.ceil(T + lip + pad * 2);
  const cv = canvas(w, h), c = cv.getContext('2d');
  c.translate(pad, pad + lip);   // (0,0) is the top-left of the board's face, the battens sit above it
  const board = () => { c.beginPath(); c.rect(0, 0, L, T); c.rect(0, -lip, lipW, lip); c.rect(L - lipW, -lip, lipW, lip); };
  c.fillStyle = WOOD; board(); c.fill();
  c.save(); board(); c.clip();
  c.fillStyle = WOOD_L; c.fillRect(0, 0, L, T * 0.22);
  c.fillStyle = 'rgba(110,64,30,.25)'; c.fillRect(0, T * 0.78, L, T * 0.22);
  // grain
  c.strokeStyle = 'rgba(110,64,30,.45)'; c.lineWidth = Math.max(0.7, s * 0.7);
  for (let i = 0; i < 5; i++) {
    const y0 = T * (0.18 + i * 0.16); c.beginPath();
    for (let x = 0; x <= L; x += 6 * s) { const y = y0 + Math.sin(x / (40 * s) + i * 1.7) * T * 0.05 + Math.sin(x / (13 * s) + i) * T * 0.02; x ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
  }
  // knots
  for (const kx of [0.17, 0.62, 0.86]) {
    c.fillStyle = 'rgba(100,58,26,.6)'; c.beginPath(); c.ellipse(L * kx, T * 0.55, T * 0.32, T * 0.18, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(100,58,26,.4)'; c.beginPath(); c.ellipse(L * kx, T * 0.55, T * 0.55, T * 0.3, 0, 0, TAU); c.stroke();
  }
  // the stencil, worn
  c.fillStyle = 'rgba(251,244,226,.55)'; c.font = `400 ${T * 0.52}px Ultra, Georgia, serif`; c.textBaseline = 'middle'; c.textAlign = 'center';
  if ('letterSpacing' in c) c.letterSpacing = `${T * 0.12}px`;
  c.fillText(name, L * 0.5, T * 0.56);
  c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(0,0,0,${0.2 + hash(i) * 0.5})`; c.fillRect(L * hash(i * 3.1), T * hash(i * 7.7), (1 + hash(i) * 3) * s, (0.6 + hash(i * 2) * 1.2) * s); }
  c.globalCompositeOperation = 'source-over';
  c.restore();
  // battens' end grain and nails
  c.fillStyle = INK;
  for (const x of [lipW / 2, L - lipW / 2]) { c.beginPath(); c.arc(x, -lip * 0.45, Math.max(1, T * 0.08), 0, TAU); c.fill(); }
  for (const x of [L * 0.25, L * 0.5, L * 0.75]) { c.beginPath(); c.arc(x, T * 0.3, Math.max(0.8, T * 0.06), 0, TAU); c.fill(); }
  c.save(); c.translate(MIS[0] * s, MIS[1] * s); board(); c.strokeStyle = INK; c.lineWidth = Math.max(1.3, 1.5 * s); c.lineJoin = 'round'; c.stroke(); c.restore();
  return { cv, pad, lip };
}

/* ------------------------------------------------------------------------------------------------- the bale */
export function baleSprite(R, s) {
  R = Math.max(3, R);
  const pad = Math.ceil(R * 0.25), size = Math.ceil(R * 2 + pad * 2), cv = canvas(size, size), c = cv.getContext('2d');
  c.translate(size / 2, size / 2);
  c.fillStyle = STRAW; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
  c.save(); c.beginPath(); c.arc(0, 0, R, 0, TAU); c.clip();
  // the rolled spiral, in short straw strokes
  c.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const t = i / 900, a = t * 22 * Math.PI + hash(i) * 0.3, r = R * Math.sqrt(t) * 0.98, len = (0.15 + hash(i * 3) * 0.25);
    c.strokeStyle = hash(i * 5) < 0.5 ? STRAW_D : '#f4dc96'; c.lineWidth = Math.max(0.8, s * (0.8 + hash(i * 9)));
    c.beginPath(); c.arc(0, 0, r, a, a + len); c.stroke();
  }
  halftone(c, R, '#6d4f1c', s);
  c.restore();
  // stray straws round the rim
  c.strokeStyle = STRAW_D; c.lineWidth = Math.max(0.8, s);
  for (let i = 0; i < 40; i++) {
    const a = hash(i + 100) * TAU, r0 = R * 0.96, l = R * (0.08 + hash(i + 200) * 0.16), d = (hash(i + 300) - 0.5) * 0.8;
    c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a + d * 0.2) * (r0 + l), Math.sin(a + d * 0.2) * (r0 + l)); c.stroke();
  }
  c.save(); c.translate(MIS[0] * s, MIS[1] * s); c.beginPath(); c.arc(0, 0, R, 0, TAU); c.strokeStyle = INK; c.lineWidth = Math.max(1.3, 1.6 * s); c.stroke(); c.restore();
  return { cv, o: size / 2 };
}

/* ------------------------------------------------------------------------------------------------- the crow */
// drawn live: (x, y) are its feet, s its size in pixels per world unit, face ±1. pose: 'stand' | 'fly'
export function drawCrow(c, x, y, s, face, pose, t, { peck = 0, hop = 0 } = {}) {
  c.save(); c.translate(x, y); c.scale(face * s, s);
  const blk = '#1f1a22', hi = '#4a4258';
  if (pose === 'fly') {
    const f = Math.sin(t * 16);
    c.translate(0, -14);
    c.fillStyle = blk;
    // wings
    for (const side of [1, -1]) {
      c.save(); c.scale(1, side === 1 ? 1 : 0.6); c.globalAlpha = side === 1 ? 1 : 0.85;
      c.beginPath(); c.moveTo(-4, -2); c.quadraticCurveTo(-2, -16 * f - 4, 8, -26 * f - 2); c.lineTo(12, -22 * f); c.quadraticCurveTo(6, -8 * f, 6, 0); c.closePath(); c.fill();
      c.restore();
    }
    c.globalAlpha = 1;
    c.beginPath(); c.ellipse(0, 0, 15, 6.5, -0.1, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-13, -1); c.lineTo(-24, -5); c.lineTo(-24, 4); c.closePath(); c.fill();
    c.beginPath(); c.arc(13, -3, 5.5, 0, TAU); c.fill();
    c.fillStyle = '#3a3030'; c.beginPath(); c.moveTo(17, -4.5); c.lineTo(25, -2); c.lineTo(17, -0.5); c.closePath(); c.fill();
    c.fillStyle = CREAM; c.beginPath(); c.arc(14.5, -4.5, 1.2, 0, TAU); c.fill();
    c.restore(); return;
  }
  const bob = hop > 0 ? -Math.sin(hop / 0.25 * Math.PI) * 6 : 0;
  c.translate(0, bob);
  // legs
  c.strokeStyle = '#3a3030'; c.lineWidth = 1.6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-2, -9); c.lineTo(-3, 0); c.moveTo(3, -9); c.lineTo(4, 0); c.moveTo(-3, 0); c.lineTo(1, 0); c.moveTo(4, 0); c.lineTo(8, 0); c.stroke();
  // body, tail, folded wing
  c.fillStyle = blk;
  c.save(); c.translate(0, -17); c.rotate(-0.35 + (peck > 0 ? 0.55 * Math.sin(peck / 0.3 * Math.PI) : 0));
  c.beginPath(); c.ellipse(0, 0, 14, 8.5, 0, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(-11, 1); c.lineTo(-25, 6); c.lineTo(-23, -1); c.closePath(); c.fill();
  c.fillStyle = hi; c.globalAlpha = 0.55; c.beginPath(); c.ellipse(-2, -1, 9, 4, -0.1, 0, TAU); c.fill(); c.globalAlpha = 1;
  // head and beak
  c.fillStyle = blk; c.beginPath(); c.arc(12, -6, 6.5, 0, TAU); c.fill();
  c.fillStyle = '#3a3030'; c.beginPath(); c.moveTo(16.5, -8); c.lineTo(26, -4.5); c.lineTo(16.5, -3); c.closePath(); c.fill();
  c.fillStyle = CREAM; c.beginPath(); c.arc(14, -7.5, 1.4, 0, TAU); c.fill();
  c.fillStyle = INK; c.beginPath(); c.arc(14.3, -7.4, 0.7, 0, TAU); c.fill();
  c.restore();
  c.restore();
}

/* ------------------------------------------------------------------------------------------------- bits */
export function leafPath(c, size) {
  c.beginPath(); c.moveTo(-size, 0); c.quadraticCurveTo(0, -size * 0.7, size, 0); c.quadraticCurveTo(0, size * 0.7, -size, 0); c.closePath();
}
export { halftone, outline, hash };
