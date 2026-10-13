// The mountains. Each one is a height field on a 2-unit grid; one map unit is 5 metres on the ground.
// Pure data, no DOM, so the Node balance sim builds exactly the same mountains as the page.

export const W = 600, H = 960, CELL = 2, MPU = 5;
export const GW = W / CELL + 1, GH = H / CELL + 1;

// grades (metres down per metre along) that sort a run into a colour, by its steepest pitch
export const GREEN_MAX = 0.24, BLUE_MAX = 0.42, CLIFF = 0.95;
export function gradeClass(g) { return g < GREEN_MAX ? 0 : g < BLUE_MAX ? 1 : 2; }

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function valueNoise(seed) {
  const r = rng(seed), P = new Float32Array(256 * 256);
  for (let i = 0; i < P.length; i++) P[i] = r() * 2 - 1;
  const at = (i, j) => P[((j & 255) << 8) | (i & 255)];
  const s = t => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const i = Math.floor(x), j = Math.floor(y), fx = s(x - i), fy = s(y - j);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  return (x, y, oct = 4) => { let v = 0, amp = 1, f = 1, tot = 0; for (let o = 0; o < oct; o++) { v += amp * n(x * f + o * 17.3, y * f - o * 9.1); tot += amp; amp *= .5; f *= 2.03; } return v / tot; };
}

const sig = t => 1 / (1 + Math.exp(-t));
const gauss = (dx, dy, r) => Math.exp(-(dx * dx + dy * dy) / (2 * r * r));

// A mountain is a broad rise from the valley floor (bottom) to the summit ridge (top), with peaks, bowls,
// a few cliff bands (steep sigmoid steps along a curve) and some noise for the ground's texture.
export const MOUNTAINS = [
  {
    id: 'hollin', name: 'Hollin Fell', sub: 'A friendly hill with one rock band', seed: 11, base: 1250, top: 2650, shape: 1.6, noise: 70,
    peaks: [{ x: 330, y: 70, h: 260, r: 120 }, { x: 120, y: 190, h: 120, r: 90 }],
    bowls: [{ x: 430, y: 430, h: -140, r: 110 }],
    cliffs: [{ x0: 360, x1: 560, y: 250, tilt: .25, A: 170, w: 6 }],
    unlock: 0,
  },
  {
    id: 'twins', name: 'The Twins', sub: 'Two summits and a long valley between', seed: 23, base: 1300, top: 2800, shape: 1.3, noise: 85,
    peaks: [{ x: 150, y: 90, h: 380, r: 120 }, { x: 470, y: 120, h: 330, r: 115 }],
    bowls: [{ x: 310, y: 300, h: -320, r: 95 }, { x: 310, y: 520, h: -150, r: 90 }],
    cliffs: [{ x0: 40, x1: 220, y: 330, tilt: -.2, A: 160, w: 6 }, { x0: 400, x1: 580, y: 360, tilt: .15, A: 150, w: 6 }],
    unlock: 100,
  },
  {
    id: 'couloir', name: 'Grand Couloir', sub: 'Steep. The cliffs leave a few gaps', seed: 37, base: 1350, top: 3150, shape: 1.15, noise: 95,
    peaks: [{ x: 300, y: 40, h: 300, r: 140 }],
    bowls: [{ x: 300, y: 380, h: -120, r: 60 }],
    cliffs: [{ x0: 20, x1: 260, y: 420, tilt: .1, A: 210, w: 6 }, { x0: 340, x1: 590, y: 400, tilt: -.1, A: 210, w: 6 }, { x0: 120, x1: 480, y: 190, tilt: 0, A: 160, w: 5 }],
    unlock: 100,
  },
];

// the tutorial hill: gentle by the lodge, a steeper shoulder to the east
export const TUTORIAL = {
  id: 'tutorial', name: 'Nursery Slopes', sub: 'Training', seed: 5, base: 1250, top: 2300, shape: 1.7, noise: 40,
  peaks: [{ x: 300, y: 120, h: 160, r: 140 }, { x: 470, y: 380, h: 330, r: 95 }],
  bowls: [], cliffs: [{ x0: 40, x1: 210, y: 300, tilt: .1, A: 150, w: 6 }],
};

export function makeTerrain(def) {
  const noise = valueNoise(def.seed), noise2 = valueNoise(def.seed * 7 + 3);
  const h = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = i * CELL, y = j * CELL, t = 1 - y / H;
    let v = def.base + (def.top - def.base) * Math.pow(t, def.shape);
    for (const p of def.peaks) v += p.h * gauss(x - p.x, y - p.y, p.r);
    for (const b of def.bowls) v += b.h * gauss(x - b.x, y - b.y, b.r);
    for (const c of def.cliffs) {
            // past its ends the step softens into an ordinary slope rather than stopping dead
      const m = Math.min(sig((x - c.x0) / 12), sig((c.x1 - x) / 12));
      const cy = c.y + (x - (c.x0 + c.x1) / 2) * c.tilt + 14 * noise2(x / 60, c.y / 60, 2);
      v += c.A * (sig((cy - y) / (c.w + 260 * (1 - m))) - .5);
    }
    v += def.noise * noise(x / 170, y / 170, 4) + def.noise * .18 * noise2(x / 55, y / 55, 3);
    h[j * GW + i] = v;
  }
  // gradient in metres per metre, by central differences
  const gx = new Float32Array(GW * GH), gy = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(GW - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(GH - 1, j + 1);
    gx[j * GW + i] = (h[j * GW + i1] - h[j * GW + i0]) / ((i1 - i0) * CELL * MPU);
    gy[j * GW + i] = (h[j1 * GW + i] - h[j0 * GW + i]) / ((j1 - j0) * CELL * MPU);
  }
  let lo = Infinity, hi = -Infinity;
  for (const v of h) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const samp = (A, x, y) => {
    const fx = Math.max(0, Math.min(GW - 1.001, x / CELL)), fy = Math.max(0, Math.min(GH - 1.001, y / CELL));
    const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j, k = j * GW + i;
    return A[k] * (1 - u) * (1 - v) + A[k + 1] * u * (1 - v) + A[k + GW] * (1 - u) * v + A[k + GW + 1] * u * v;
  };
  const T = {
    def, h, gx, gy, lo, hi, noise,
    height: (x, y) => samp(h, x, y),
    grade: (x, y) => Math.hypot(samp(gx, x, y), samp(gy, x, y)),
    inside: (x, y) => x >= 6 && y >= 6 && x <= W - 6 && y <= H - 6,
  };
  // forest: below the tree line, on ground that isn't too steep, in patches
  T.forest = (x, y) => {
    const e = T.height(x, y), line = T.lo + (T.hi - T.lo) * .42;
    return e < line - 40 * noise2(x / 40, y / 40, 2) && noise(x / 70 + 50, y / 70, 3) > .16 && T.grade(x, y) < .7;
  };
  return T;
}
