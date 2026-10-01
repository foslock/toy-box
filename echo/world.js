// Echo's cave, as one signed distance field: negative in air, positive in rock. The mesher draws its zero surface,
// and the walker, the swimmer and the loose rocks all collide with it directly, so what you see is what you bump into.
// Units are metres; y is up. Everything here is plain JS so the headless check can run the same cave.

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; };
const FAR = 99;

/* ---------- noise: a small, fast value noise, so walls aren't smooth tubes ---------- */
function h3(x, y, z) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) & 0xffff) / 32767.5 - 1;
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const a = h3(xi, yi, zi), b = h3(xi + 1, yi, zi), c = h3(xi, yi + 1, zi), d = h3(xi + 1, yi + 1, zi);
  const e = h3(xi, yi, zi + 1), f = h3(xi + 1, yi, zi + 1), g = h3(xi, yi + 1, zi + 1), h = h3(xi + 1, yi + 1, zi + 1);
  const ab = a + (b - a) * fx, cd = c + (d - c) * fx, ef = e + (f - e) * fx, gh = g + (h - g) * fx;
  const lo = ab + (cd - ab) * fy, hi = ef + (gh - ef) * fy;
  return lo + (hi - lo) * fz;
}
// Rock lumps about 6 m, 2.4 m and 1.1 m across. Roughly -1..1.
export function rockNoise(x, y, z) {
  return .58 * vnoise(x * .17, y * .21, z * .17) + .3 * vnoise(x * .41 + 17.3, y * .45 + 3.1, z * .41 + 9.7) + .14 * vnoise(x * .93 + 31.1, y * .93 + 7.7, z * .93 + 2.9);
}

/* ---------- primitives ---------- */
// Air is carved by tubes (tunnels with flat floors), rooms (domes with flat floors) and boxes (the old, square-cut
// puzzle passages). Rock is put back with columns and lumps. Each has a roughness: how much the noise moves its walls.
const TUBE = 0, ROOM = 1, BOX = 2, COLUMN = 3, LUMP = 4, OUTSIDE = 5;
const prims = [];

// A tunnel through floor points [x, floorY, z, (floor width), (height)]. The section is a slightly flattened oval
// sitting on a flat floor: about `fw` wide at the floor and `h` tall.
function tube(pts, { fw = 2, h = 2.7, rough = .45, k = .6, floor = true, r: rFixed } = {}) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, af, az, afw = fw, ah = h] = pts[i], [bx, bf, bz, bfw = fw, bh = h] = pts[i + 1];
    const ra = rFixed ?? afw / 2 / .9035, rb = rFixed ?? bfw / 2 / .9035;
    const p = { t: TUBE, rough, k, floor,
      ax, ay: af + .3 * ah, az, bx, by: bf + .3 * bh, bz, af, bf, ra, rb, va: rFixed ?? .7 * ah, vb: rFixed ?? .7 * bh };
    const m = Math.max(ra, rb, p.va, p.vb) + rough + 1;
    p.box = [Math.min(ax, bx) - m, Math.min(p.ay, p.by) - m, Math.min(az, bz) - m, Math.max(ax, bx) + m, Math.max(p.ay, p.by) + m, Math.max(az, bz) + m];
    prims.push(p);
  }
}
// A domed room standing on a flat floor at y = fy: about 2·rx by 2·rz across and h tall.
function room(x, fy, z, rx, h, rz, { rough = .8, k = 1 } = {}) {
  const p = { t: ROOM, rough, k, cx: x, cy: fy + .25 * h, cz: z, rx, ry: .75 * h, rz, fy };
  const m = rough + 1;
  p.box = [x - rx - m, fy - 1.5, z - rz - m, x + rx + m, fy + h + m, z + rz + m];
  prims.push(p);
}
// A square-cut box of air, centre (x, y, z), half sizes (hx, hy, hz).
function box(x, y, z, hx, hy, hz, { rough = .04, k = .15 } = {}) {
  const p = { t: BOX, rough, k, cx: x, cy: y, cz: z, hx, hy, hz };
  const m = rough + .6;
  p.box = [x - hx - m, y - hy - m, z - hz - m, x + hx + m, y + hy + m, z + hz + m];
  prims.push(p);
}
// A rock column (or stalactite / stalagmite when r0 and r1 differ) from y0 to y1.
function column(x, z, y0, y1, r0, r1 = r0, { rough = .35, k = .7, waist = r0 === r1 } = {}) {
  const p = { t: COLUMN, rough, k, cx: x, cz: z, y0, y1, r0, r1, rock: true, waist };
  const m = Math.max(r0, r1) + rough + 1;
  p.box = [x - m, y0 - 1, z - m, x + m, y1 + 1, z + m];
  prims.push(p);
}
function lump(x, y, z, r, { rough = .25, k = .3 } = {}) {
  const p = { t: LUMP, rough, k, cx: x, cy: y, cz: z, r, rock: true };
  const m = r + rough + .6;
  p.box = [x - m, y - m, z - m, x + m, y + m, z + m];
  prims.push(p);
}

/* ---------- the way out, and the wood beyond it ---------- */
export const CLIFF_X = 206;                               // the hillside the last tunnel comes out of faces +x
export const MOUTH = { x: 206, y: 1.7, z: -151 };        // middle of the cave mouth
export const CLEARING = { x: 230, z: -151, r: 30 };
export function groundY(x, z) {                          // the forest floor (the walker and forest.js share it)
  const k = smooth(CLIFF_X, CLIFF_X + 9, x);
  const b = .45 * (Math.sin(x * .21 + .7) * Math.cos(z * .17 + 1.3) + .5 * Math.sin(x * .07 - z * .09 + 2));
  const b0 = .45 * (Math.sin(CLIFF_X * .21 + .7) * Math.cos(-151 * .17 + 1.3) + .5 * Math.sin(CLIFF_X * .07 + 151 * .09 + 2));
  return .4 + (b - b0) * k - .035 * Math.max(0, x - CLIFF_X) + .012 * Math.max(0, x - CLIFF_X) * Math.abs(z + 151) * .08;
}
// The trees stand in the field too, so you walk round them.
function forestLayout() {
  let s = 91; const R = () => ((s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5 | 0) >>> 0) / 4294967296;
  const trees = [];
  for (let tries = 0; trees.length < 46 && tries < 3000; tries++) {
    const a = R() * Math.PI * 2, d = 7 + Math.sqrt(R()) * 26;
    const x = CLEARING.x + Math.cos(a) * d, z = CLEARING.z + Math.sin(a) * d;
    if (x < CLIFF_X + 3) continue;
    if (Math.abs(z - MOUTH.z) < 6 && x < CLIFF_X + 20) continue;              // keep the way from the mouth open
    if (Math.abs(z - MOUTH.z - (x - CLIFF_X) * .12) < 2.4) continue;            // the path
    if (trees.some(t => Math.hypot(t.x - x, t.z - z) < 3.4)) continue;
    const kind = R() < .3 ? 'pine' : R() < .5 ? 'birch' : 'oak';
    const r = kind === 'oak' ? .32 + R() * .25 : kind === 'pine' ? .24 + R() * .12 : .14 + R() * .06;
    trees.push({ x, z, r, kind, h: kind === 'pine' ? 11 + R() * 7 : kind === 'birch' ? 8 + R() * 4 : 7 + R() * 4, seed: R() * 1000 });
  }
  return trees;
}
export const TREES = forestLayout();
{
  const p = { t: OUTSIDE, rough: .9, k: 1.2 };
  p.box = [CLIFF_X - 4, -6, CLEARING.z - CLEARING.r - 2, CLEARING.x + CLEARING.r + 2, 40, CLEARING.z + CLEARING.r + 2];
  prims.push(p);
  for (const t of TREES) column(t.x, t.z, groundY(t.x, t.z) - 1, groundY(t.x, t.z) + 3, t.r, t.r, { rough: 0, k: .05, waist: false });
}

/* ---------- the cave, section by section ---------- */
// Each section starts at the mouth of a tunnel: that's where you come back to if you drown or ask to go back.
export const SECTIONS = [];
const face = (dx, dz) => Math.atan2(-dx, -dz);           // the camera yaw that looks along (dx, dz)
function section(name, spawn, look, trigger, more = {}) {
  SECTIONS.push({ name, spawn, yaw: face(...look), trigger, ...more });
}
export const WATER = [];
export const MOVABLES = [];
export const DRIPS = [];
export const ZONES = {};                                  // named places the tutorial and the traps listen for
const water = (y, x0, x1, z0, z1) => WATER.push({ y, x0, x1, z0, z1 });
const movable = (x, fy, z, sec, id) => MOVABLES.push({ id, sec, x, y: fy + .5, z });
const drip = (x, y, z) => DRIPS.push({ x, y, z });

// 0. The Landing: where the rope gave out. A small dome with the shaft you came down in its roof.
room(0, 0, 0, 4.6, 4.4, 4.2);
tube([[-.6, 3.4, .8], [-.9, 9, 1.1], [-1, 14, 1.3]], { r: .95, floor: false, rough: .35 });
section('The Landing', [-2.2, 0, .4], [1, 0], null);
export const ROPE = { x: -.75, z: 1.05, top: 14, end: 2.3, coil: [-1.3, 0, 1.7] };

// The Crawl: a winding tunnel down to the hall, pinched low in the middle.
tube([[3.5, 0, 0], [9, -.2, 2.5], [14, -.5, 1], [18, -.8, -3, 1.6, 2.2], [23, -1.1, -4.5, 1.6, 2.2], [28, -1.5, -2], [32, -1.8, 1.5], [36.5, -2.1, 2], [40, -2.5, 2]], { fw: 2, h: 2.6 });
drip(25.5, -1.32, -3.6);

// 1. The Hall: too big for a snap. Two blind alcoves and the real way on, in the far corner.
room(53, -2.5, 2, 16, 9, 11);
column(47, 6, -4, 8, 1.5, 1.5, { rough: .55 }); column(56, -3, -4, 8, 2, 2, { rough: .6 }); column(61, 7.5, -4, 8, 1.3, 1.3, { rough: .5 });
tube([[50, -2.5, -6.5], [49.5, -2.3, -13], [48.5, -2.2, -17]], { fw: 2.4, h: 3 });            // blind
tube([[58, -2.5, 9.5], [59, -2.4, 15.5], [60.5, -2.2, 19]], { fw: 2.4, h: 3 });                 // blind
tube([[64, -2.5, -5], [70, -2.4, -8], [74, -2.3, -11], [74, -2.2, -16]], { fw: 2.2, h: 2.8 });
drip(64.6, -2.5, -5.6);
section('The Hall', [38.6, -2.4, 2], [1, 0], [39.6, -2.4, 2, 2.4]);
ZONES.hall = { x: 53, z: 2, rx: 14, rz: 9.5 };

// 2. The Knot: a small grid of passages, most of them blind.
{
  const N = (i, j) => [68 + 6 * i, -2.2, -16 - 6 * j];
  const links = [[1, 0, 0, 0], [0, 0, 0, 1], [0, 1, 0, 2], [0, 2, 0, 3], [0, 3, 1, 3], [1, 0, 2, 0], [2, 0, 3, 0], [3, 0, 3, 1], [3, 1, 2, 1],
    [2, 1, 1, 1], [3, 1, 3, 2], [3, 2, 2, 2], [2, 2, 2, 3], [2, 2, 1, 2], [3, 2, 3, 3]];
  for (const [a, b, c, d] of links) tube([N(a, b), N(c, d)], { fw: 1.9, h: 2.6, rough: .4, k: .5 });
  tube([N(2, 3), [80, -2.4, -39], [81, -4, -44], [82, -6, -49], [82, -7.8, -54], [82, -8, -57]], { fw: 2.1, h: 2.8 });
  drip(80, -2.2, -34.3);
}
section('The Knot', [74, -2.3, -11.6], [0, -1], [74, -2.3, -12.2, 1.8]);

// 3. The Gallery: long and high, with a shallow lake. Only a whistle reaches the far end.
room(82, -8, -82, 13, 16, 30, { rough: 1 });
room(82, -9, -82, 8, 2.6, 11, { rough: .5, k: 1.5 });                                          // the lake bed
water(-8.35, 70, 94, -98, -66);
column(76, -70, -10, 9, 2.2, 2.2, { rough: .6 }); column(88, -92, -10, 9, 2.6, 2.6, { rough: .7 }); column(79.5, -99, -10, 9, 1.6, 1.6, { rough: .5 });
column(85, -66, 1, 10, .2, 1.6, { rough: .2 }); column(78, -88, 2, 10, .15, 1.3, { rough: .2 }); column(90, -78, 3, 10, .1, 1, { rough: .2 });
column(86, -101, -9, -5.5, 1.1, .15, { rough: .2 }); column(74.5, -78, -9, -6, .9, .1, { rough: .2 });
tube([[93, -8, -75], [99, -7.5, -76], [103, -7.2, -74]], { fw: 2.2, h: 2.8 });                // blind
tube([[70.5, -8, -88], [65, -7.8, -90], [62, -7.6, -93]], { fw: 2.2, h: 2.8 });               // blind
tube([[75, -8, -103], [72, -8.4, -109], [69, -9, -114], [66, -10, -120], [63, -11.3, -125], [62.5, -11.5, -127]], { fw: 2.1, h: 2.8 });
drip(74.6, -8, -103.6);
section('The Gallery', [80.3, -2.5, -39.5], [.15, -1], [80.4, -2.5, -40, 1.8]);
ZONES.gallery = { x0: 70, x1: 95, z0: -108, z1: -58 };

// 4. The Sump: the passage carries on under a pool. A short swim.
room(62, -11.5, -131, 6, 6, 6);
room(62, -14, -133, 4.5, 3, 4, { rough: .45 });                                                // the deep part
tube([[62, -14, -136], [62, -14.1, -141], [62.5, -13.6, -145], [63, -12.3, -148], [63, -11.1, -151], [63, -10.8, -154]], { fw: 1.9, h: 2.4, rough: .35 });
water(-11, 54, 71, -153.5, -124);
drip(62.3, -11, -132.5); drip(63, -11, -148.6);
section('The Sump', [71.4, -8.6, -110.5], [-3, -5], [71.2, -8.6, -111, 1.8]);
ZONES.shore = { x: 62.6, y: -11.3, z: -127.5, r: 3.2 };

// 5. Loose Rock: an old square-cut passage, plugged. It ends in a blind pocket, and the way on turns off before it.
room(63, -10.8, -158, 4.2, 3.4, 3.6, { rough: .6 });
box(71.25, -10.8 + 1.15, -158, 5.25, 1.15, .8);                                                // the passage, x 66 to 76.5
box(73.3, -10.8 + 1.15, -160.9, .8, 1.15, 3.6);                                                // the turn off it (overlapping, so there's no seam)
movable(69.5, -10.8, -158, 5, 'plug');
drip(61, -10.8, -159.5);
section('Loose Rock', [63, -10.8, -155.4], [0, -1], [63, -10.8, -155.2, 2.2]);

// 6. Rockfall: the way on is a doorway choked with boulders. One of them is loose.
room(75, -10.8, -168, 5.5, 4, 4.5, { rough: .6 });
box(81.3, -10.8 + 1.1, -168, 2.7, 1.1, .75);                                                  // the doorway, running well into both rooms
lump(78.9, -10.5, -170.5, 1.05); lump(79, -10.4, -165.6, .95); lump(77.6, -10.7, -171.6, .75); lump(77.9, -10.6, -164.5, .65);
lump(71, -10.6, -171.2, .8); lump(70.4, -10.5, -165.3, .7); lump(75.5, -10.7, -172, .6);
movable(80.4, -10.8, -168, 6, 'door');
movable(71.8, -10.8, -167.2, 6, 'decoy');
room(85.8, -10.8, -168, 3.4, 3.2, 3.4, { rough: .5 });
drip(72.3, -10.8, -170);
section('Rockfall', [73.3, -10.8, -160.8], [0, -1], [73.3, -10.8, -160.6, 1.5]);
ZONES.rubble = { x: 79, y: -10.3, z: -168, r: 4 };

// 7. The Long Swim: a longer sump, with one bell of air halfway along. A step up keeps rocks out of it.
tube([[88.6, -10.3, -168], [93, -10.5, -169.5], [97.5, -11, -171]], { fw: 2, h: 2.6, k: .15 });
room(103, -11.5, -172, 6, 5, 5);
room(104, -14.5, -173, 4, 3.5, 3.5, { rough: .45 });
tube([[107.5, -14.5, -173], [112, -14.6, -174], [116, -14.5, -175], [120, -14.6, -176], [125, -14.5, -176], [128, -13.2, -175], [131, -11.6, -174], [134, -10.9, -173], [137, -10.8, -172]],
  { fw: 1.9, h: 2.4, rough: .35 });
room(116, -14.5, -175, 2.6, 5.5, 2.6, { rough: .4 });                                          // the bell
water(-11, 96, 136, -182, -164);
drip(102.4, -11, -171.4); drip(116.3, -11, -175.3);
section('The Long Swim', [90.6, -10.4, -168.8], [1, -.35], [90.6, -10.4, -168.8, 1.6]);
ZONES.shore2 = { x: 99.5, y: -11, z: -171.6, r: 3 };
ZONES.bell = { x: 116, y: -11, z: -175, r: 2.4 };

// 8. The Gap: a square-cut passage with a pit across it, and a loose rock in the room before it.
room(141, -10.8, -172, 5, 4, 6, { rough: .6 });
box(145.3, -10.8 + 1.2, -172, .7, 1.2, 1.3);                                                   // a wide mouth, so a rock finds its way in
box(151.75, -10.8 + 1.2, -172, 6.25, 1.2, .8);                                                 // the passage, x 145.5 to 158
box(151.75, -11.05, -172, .75, .75, .8, { rough: 0, k: .02 });                                 // the pit, 1 m deep: a rock fits it exactly
movable(142.5, -10.8, -175, 8, 'bridge');
drip(139, -10.8, -169.5);
section('The Gap', [137.2, -10.8, -172], [1, 0], [137.4, -10.8, -172, 1.6]);
ZONES.pit = { x0: 151, x1: 152.5, z0: -172.8, z1: -171.2, y: -10.95 };
ZONES.rim = { x: 150.2, z: -172, r: 1.1 };

// 9. The Way Out: up and round a bend, and then there's light.
tube([[157, -10.8, -172, 1.9, 2.5], [162, -10.3, -171], [167, -9.3, -168], [171, -8, -163], [174, -6.6, -157], [180, -5.2, -154], [187, -3.6, -152, 2.4, 3],
  [194, -2, -151, 2.8, 3.3], [201, -.6, -151, 3.2, 3.7], [207, .4, -151, 3.6, 4.1], [211, .4, -151, 4, 4.4]], { fw: 2.1, h: 2.8 });
section('The Way Out', [158.6, -10.8, -172], [1, 0], [158.7, -10.8, -172, 1.3]);
export const FINALE = { start: [174, -157], bend: [180, -154] };

/* ---------- evaluation ---------- */
function evalPrim(p, x, y, z, n) {
  switch (p.t) {
    case TUBE: {
      const abx = p.bx - p.ax, aby = p.by - p.ay, abz = p.bz - p.az;
      const t = clamp(((x - p.ax) * abx + (y - p.ay) * aby + (z - p.az) * abz) / (abx * abx + aby * aby + abz * abz), 0, 1);
      const r = p.ra + (p.rb - p.ra) * t, v = p.va + (p.vb - p.va) * t;
      const qx = x - (p.ax + abx * t), qy = (y - (p.ay + aby * t)) * r / v, qz = z - (p.az + abz * t);
      const d = Math.sqrt(qx * qx + qy * qy + qz * qz) - r + p.rough * n;
      return p.floor ? Math.max(d, p.af + (p.bf - p.af) * t - y + .12 * p.rough * n) : d;
    }
    case ROOM: {
      const qx = (x - p.cx), qy = (y - p.cy), qz = (z - p.cz);
      const k0 = Math.sqrt((qx / p.rx) ** 2 + (qy / p.ry) ** 2 + (qz / p.rz) ** 2);
      const k1 = Math.sqrt((qx / (p.rx * p.rx)) ** 2 + (qy / (p.ry * p.ry)) ** 2 + (qz / (p.rz * p.rz)) ** 2) || 1e-6;
      const d = k0 * (k0 - 1) / k1 + p.rough * n;
      return Math.max(d, p.fy - y + .1 * p.rough * n);
    }
    case BOX: {
      const qx = Math.abs(x - p.cx) - p.hx, qy = Math.abs(y - p.cy) - p.hy, qz = Math.abs(z - p.cz) - p.hz;
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
      return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) + p.rough * n;
    }
    case COLUMN: {
      const t = clamp((y - p.y0) / (p.y1 - p.y0), 0, 1);
      const waist = p.waist ? .72 + .55 * (2 * t - 1) ** 2 + .08 * Math.sin(y * 1.7 + p.cx) : 1;   // stalactite meets stalagmite
      const d = Math.hypot(x - p.cx, z - p.cz) - (p.r0 + (p.r1 - p.r0) * t) * waist;
      return Math.max(d, p.y0 - y, y - p.y1) + p.rough * n;
    }
    case LUMP: return Math.hypot(x - p.cx, y - p.cy, z - p.cz) - p.r + p.rough * n;
    case OUTSIDE: {
      const cliff = CLIFF_X - x + p.rough * n;
      return Math.max(cliff, groundY(x, z) - y, Math.hypot(x - CLEARING.x, z - CLEARING.z) - CLEARING.r);
    }
  }
  return FAR;
}

// A coarse grid of which primitives can matter where, so each lookup only weighs a handful.
const G = 6;
const cells = new Map();
const key = (i, j, k) => ((i + 600) * 2048 + (j + 600)) * 2048 + (k + 600);
for (const p of prims) {
  const [x0, y0, z0, x1, y1, z1] = p.box;
  for (let i = Math.floor(x0 / G); i <= Math.floor(x1 / G); i++)
    for (let j = Math.floor(y0 / G); j <= Math.floor(y1 / G); j++)
      for (let k = Math.floor(z0 / G); k <= Math.floor(z1 / G); k++) {
        const c = key(i, j, k);
        let e = cells.get(c);
        if (!e) cells.set(c, e = { carve: [], rock: [] });
        (p.rock ? e.rock : e.carve).push(p);
      }
}
export const BOUNDS = prims.reduce((b, p) => [Math.min(b[0], p.box[0]), Math.min(b[1], p.box[1]), Math.min(b[2], p.box[2]), Math.max(b[3], p.box[3]), Math.max(b[4], p.box[4]), Math.max(b[5], p.box[5])], [FAR, FAR, FAR, -FAR, -FAR, -FAR]);

// The distance field itself: < 0 in air, > 0 in rock.
export function D(x, y, z) {
  const e = cells.get(key(Math.floor(x / G), Math.floor(y / G), Math.floor(z / G)));
  if (!e || !e.carve.length) return 4;
  const n = rockNoise(x, y, z);
  let d = FAR;
  for (const p of e.carve) d = smin(d, evalPrim(p, x, y, z, n), p.k);
  for (const p of e.rock) d = -smin(-d, evalPrim(p, x, y, z, n), p.k);
  return d;
}
// Which way is out of the rock, and how steep the field is there (for pushing things out by the right amount).
export function grad(x, y, z, out = [0, 0, 0], h = .06) {
  const gx = D(x + h, y, z) - D(x - h, y, z), gy = D(x, y + h, z) - D(x, y - h, z), gz = D(x, y, z + h) - D(x, y, z - h);
  const l = Math.hypot(gx, gy, gz) || 1;
  out[0] = gx / l; out[1] = gy / l; out[2] = gz / l; out[3] = l / (2 * h);
  return out;
}
// Ray march from (x, y, z) along a unit direction until rock or `max`. Returns the distance.
export function march(x, y, z, dx, dy, dz, max) {
  let t = .05;
  for (let i = 0; i < 160 && t < max; i++) {
    const d = D(x + dx * t, y + dy * t, z + dz * t);
    if (d > -.01) return t;
    t += Math.max(-d * .7, .04);
  }
  return max;
}

/* ---------- water ---------- */
export function waterLevel(x, z) {
  for (const w of WATER) if (x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1) return w.y;
  return null;
}

export const SPAWN = i => SECTIONS[clamp(i, 0, SECTIONS.length - 1)];
