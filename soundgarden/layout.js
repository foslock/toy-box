// Sound Garden's plan, in metres. x runs east, z runs south, y is up, and the listening chair sits at the origin.
// The garden is a 3×3 grid of rooms inside a tall laurel hedge. A low box hedge rings the centre, so you can see
// over it from the chair; taller yew hedges divide the eight outer rooms, so you have to walk round to find what's in
// them. Each outer room hides one speaker.

export const HALF = 27;                 // centre line of the outer hedge
export const GRID = 9;                  // room grid lines at x = ±9 and z = ±9
export const HEDGE = {
  laurel: { h: 4.2, t: 1.6 },           // the garden wall
  yew: { h: 2.7, t: 1.0 },              // between the outer rooms: above eye height
  box: { h: 1.05, t: 0.6 },             // round the centre, low enough to see over
};
export const PLATFORM = { r: 2.3, step: 2.75, h: 0.3 };        // top radius, lower step radius, top height
export const CHAIR = { x: 0, z: 0, yaw: Math.PI / 2 };          // faces east, with the late sun behind it
export const START = { x: 0, z: 25.2, yaw: Math.PI };           // just inside the gate, facing north

// Objects face their local +z. yaw turns +z towards (sin yaw, cos yaw).
export const yawTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

/* ---------- hedges ---------- */
export const HEDGES = [];                // boxes: { kind, x0, x1, z0, z1, y0, h }
export const GAPS = [];                  // openings in the yew, for the stone piers either side
function run(kind, axis, at, from, to, gaps = []) {
  const { h, t } = HEDGE[kind];
  const cuts = gaps.map(g => [g - (kind === 'box' ? 1.1 : 1.05), g + (kind === 'box' ? 1.1 : 1.05)]).sort((a, b) => a[0] - b[0]);
  let a = from;
  for (const [g0, g1] of [...cuts, [to, to]]) {
    if (g0 - a > .2) HEDGES.push(axis === 'x' ? { kind, x0: a, x1: g0, z0: at - t / 2, z1: at + t / 2, y0: 0, h } : { kind, x0: at - t / 2, x1: at + t / 2, z0: a, z1: g0, y0: 0, h });
    a = g1;
  }
  if (kind === 'yew') for (const g of gaps) GAPS.push(axis === 'x' ? { x: g, z: at, along: 'x' } : { x: at, z: g, along: 'z' });
}
{
  const E = HALF + HEDGE.laurel.t / 2;
  run('laurel', 'x', -HALF, -E, E);
  run('laurel', 'x', HALF, -E, E, [0]);                          // the gate
  run('laurel', 'z', -HALF, -HALF + .8, HALF - .8);
  run('laurel', 'z', HALF, -HALF + .8, HALF - .8);
  HEDGES.push({ kind: 'laurel', x0: -1.05, x1: 1.05, z0: HALF - .8, z1: HALF + .8, y0: 2.45, h: HEDGE.laurel.h });   // grown over the gate
  for (const s of [-1, 1]) {
    run('box', 'x', s * GRID, -GRID - .3, GRID + .3, [0]);
    run('box', 'z', s * GRID, -GRID + .3, GRID - .3, [0]);
  }
  const Y0 = GRID - .3;
  run('yew', 'z', GRID, -HALF, -Y0, [-20]);                       // N ↔ NE
  run('yew', 'z', -GRID, -HALF, -Y0, [-14]);                      // N ↔ NW
  run('yew', 'z', GRID, Y0, HALF, [20]);                          // S ↔ SE
  run('yew', 'z', -GRID, Y0, HALF, [14]);                         // S ↔ SW
  run('yew', 'x', -GRID, Y0, HALF, [21]);                         // E ↔ NE
  run('yew', 'x', GRID, Y0, HALF, [15]);                          // E ↔ SE
  run('yew', 'x', -GRID, -HALF, -Y0, [-15]);                      // W ↔ NW
  run('yew', 'x', GRID, -HALF, -Y0, [-21]);                       // W ↔ SW
}

/* ---------- the pond ---------- */
export const POND = { x: .4, z: -19.6, rx: 4.7, rz: 3.3, level: -.16, depth: .75 };
export function pondRadius(a) {          // the pond's edge, as a radius scale at angle a (1 = the ellipse)
  return 1 + .07 * Math.sin(3 * a + 1.1) + .045 * Math.sin(5 * a + 2.3) + .025 * Math.sin(9 * a + .4);
}
export function pondEdge(a, grow = 0) {
  const k = pondRadius(a);
  return [POND.x + Math.cos(a) * (POND.rx * k + grow), POND.z + Math.sin(a) * (POND.rz * k + grow)];
}
export function inPond(x, z, grow = 0) {
  const dx = x - POND.x, dz = z - POND.z, a = Math.atan2(dz / POND.rz, dx / POND.rx), k = pondRadius(a);
  return (dx / (POND.rx * k + grow)) ** 2 + (dz / (POND.rz * k + grow)) ** 2 < 1;
}

/* ---------- paths ---------- */
// kinds: gravel (painted into the ground), brick (a laid ribbon), bark (woodchip), mown (short grass through the meadow),
// stones (stepping stones set in the ground)
const circle = (cx, cz, r, n = 48, a0 = 0) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + i / n * Math.PI * 2; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
const ellipse = (cx, cz, rx, rz, n = 56) => Array.from({ length: n + 1 }, (_, i) => { const a = i / n * Math.PI * 2; return [cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]; });
export const PATHS = [
  // centre: the ring round the dais and the four ways out
  { kind: 'gravel', w: 1.7, pts: circle(0, 0, 3.55, 64) },
  { kind: 'gravel', w: 1.7, pts: [[0, -4.1], [0, -9.5]] },
  { kind: 'gravel', w: 1.7, pts: [[4.1, 0], [9.5, 0]] },
  { kind: 'gravel', w: 1.7, pts: [[0, 4.1], [0, 9.5]] },
  { kind: 'gravel', w: 1.7, pts: [[-4.1, 0], [-9.5, 0]] },
  // S: the lavender walk from the gate
  { kind: 'gravel', w: 2.0, pts: [[0, 9.2], [0, 26.6]] },
  { kind: 'gravel', w: 1.4, pts: [[.8, 20], [9.7, 20]] },
  { kind: 'gravel', w: 1.4, pts: [[-.8, 14], [-9.7, 14]] },
  // N: round the pond
  { kind: 'gravel', w: 1.6, pts: [[0, -9.2], [.2, -12.4], [.4, -14.4]] },
  { kind: 'gravel', w: 1.5, pts: ellipse(POND.x, POND.z, 6.55, 5.05, 72) },
  { kind: 'gravel', w: 1.4, pts: [[6.8, -19.9], [8.3, -20], [9.7, -20]] },
  { kind: 'gravel', w: 1.4, pts: [[-5.3, -16.6], [-7.4, -14.6], [-9.7, -14]] },
  // E: the rose walk under three arches
  { kind: 'brick', w: 1.8, pts: [[9.3, 0], [24.9, 0]] },
  { kind: 'gravel', w: 1.3, pts: [[21, -.8], [21, -9.7]] },
  { kind: 'gravel', w: 1.3, pts: [[15, .8], [15, 9.7]] },
  // W: stepping stones across the raked gravel
  { kind: 'stones', w: .75, pts: [[-9.4, 0], [-11.2, .15], [-13.6, -.25], [-16.1, .35], [-18.6, .05], [-21.2, -.45]] },
  { kind: 'stones', w: .7, pts: [[-14.6, -.1], [-14.9, -2.6], [-15.1, -5.4], [-15, -7.8], [-15, -9.7]] },
  { kind: 'stones', w: .7, pts: [[-20.4, .1], [-20.8, 2.8], [-21.1, 5.6], [-21, 8], [-21, 9.7]] },
  // NE: a mown path through the meadow
  { kind: 'mown', w: 1.5, pts: [[9.6, -20], [12.4, -19.6], [15.6, -18.6], [18.6, -17.4]] },
  { kind: 'mown', w: 1.5, pts: [[21, -9.6], [20.7, -12.4], [19.7, -15.3], [18.6, -17.4]] },
  { kind: 'mown', w: 1.4, pts: [[18.6, -17.4], [20.4, -19.6], [21.9, -21.3]] },
  { kind: 'mown', w: 4.2, pts: [[18.4, -17.3], [18.8, -17.5]] },           // the clearing with the bench
  // NW: woodchip through the birches
  { kind: 'bark', w: 1.3, pts: [[-9.6, -14], [-12, -14.6], [-14.8, -16.4], [-17.2, -18.4], [-18.6, -20], [-20.9, -22.5], [-18.4, -24.4], [-14.9, -23.3], [-13.4, -20.6], [-14.8, -16.4]] },
  { kind: 'bark', w: 1.2, pts: [[-15, -9.6], [-15.3, -12.2], [-15.2, -14.6], [-14.8, -16.4]] },
  // SE: onto the terrace
  { kind: 'gravel', w: 1.4, pts: [[9.6, 20], [13, 20]] },
  { kind: 'gravel', w: 1.4, pts: [[15, 9.6], [15, 14]] },
  // SW: the kitchen garden's brick cross
  { kind: 'brick', w: 1.5, pts: [[-17.8, 10.2], [-17.8, 25.9]] },
  { kind: 'brick', w: 1.5, pts: [[-25.9, 17.8], [-10.2, 17.8]] },
  { kind: 'gravel', w: 1.2, pts: [[-9.6, 14], [-10.35, 14.6], [-10.35, 17.4]] },
  { kind: 'gravel', w: 1.1, pts: [[-21, 9.6], [-20.6, 10.15], [-18.4, 10.2]] },
];

/* ---------- beds and other ground ---------- */
// Polygons (lists of [x, z]). soil: dark mulch · litter: woodland floor · zen: raked gravel · meadow: long grass
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
function sector(q, r0, r1, m, n = 14) {            // a quarter ring bed between two of the centre's paths
  const pts = [], a = q * Math.PI / 2;
  const arc = (r, rev) => {
    const d = Math.asin(Math.min(1, m / r)), out = [];
    for (let i = 0; i <= n; i++) { const t = a + d + (Math.PI / 2 - 2 * d) * i / n; out.push([Math.cos(t) * r, Math.sin(t) * r]); }
    return rev ? out.reverse() : out;
  };
  return [...arc(r0), ...arc(r1, true)];
}
export const BEDS = [
  ...[0, 1, 2, 3].map(q => ({ kind: 'soil', room: 'C', pts: sector(q, 4.85, 7.7, 1.35), plant: 'centre' })),
  // S: lavender either side of the walk, and a border against the south hedge
  { kind: 'soil', room: 'S', pts: rect(1.15, 10.2, 2.75, 19.2), plant: 'lavender' },
  { kind: 'soil', room: 'S', pts: rect(-2.75, 10.2, -1.15, 13.2), plant: 'lavender' },
  { kind: 'soil', room: 'S', pts: rect(-2.75, 14.8, -1.15, 25.2), plant: 'lavender' },
  { kind: 'soil', room: 'S', pts: rect(1.15, 20.8, 2.75, 25.2), plant: 'lavender' },
  { kind: 'soil', room: 'S', pts: rect(4.2, 23.6, 8.3, 25.9), plant: 'border' },
  { kind: 'soil', room: 'S', pts: rect(-8.3, 23.6, -4.2, 25.9), plant: 'border' },
  // E: rose beds
  { kind: 'soil', room: 'E', pts: rect(10.4, -7.9, 20.2, -1.6), plant: 'roses' },
  { kind: 'soil', room: 'E', pts: rect(21.8, -7.9, 25.5, -1.6), plant: 'roses' },
  { kind: 'soil', room: 'E', pts: rect(10.4, 1.6, 14.2, 7.9), plant: 'roses' },
  { kind: 'soil', room: 'E', pts: rect(15.8, 1.6, 25.5, 7.9), plant: 'roses' },
  // W: the zen garden, and beds for the maples, the bamboo and the water basin
  { kind: 'zen', room: 'W', pts: rect(-25.3, -7.9, -10.2, 7.9) },
  { kind: 'soil', room: 'W', pts: [[-25.9, 2.6], [-24.4, 2.3], [-23.9, 5.5], [-24.6, 8.6], [-25.9, 8.7]], plant: 'bamboo' },
  // SE: hydrangeas round the terrace
  { kind: 'soil', room: 'SE', pts: rect(24.9, 10.2, 25.9, 25.9), plant: 'hydrangea' },
  { kind: 'soil', room: 'SE', pts: rect(10.2, 24.9, 24.9, 25.9), plant: 'hydrangea' },
  // SW: four raised beds round the sundial
  { kind: 'soil', room: 'SW', pts: rect(-24.9, 10.9, -19.1, 16.5), plant: 'kitchen', raised: true },
  { kind: 'soil', room: 'SW', pts: rect(-16.5, 10.9, -11.3, 16.5), plant: 'kitchen', raised: true },
  { kind: 'soil', room: 'SW', pts: rect(-24.9, 19.1, -19.1, 24.9), plant: 'cutting', raised: true },
  { kind: 'soil', room: 'SW', pts: rect(-16.5, 19.1, -11.3, 24.9), plant: 'cutting', raised: true },
  // NW: the woodland floor, and NE: the meadow
  { kind: 'litter', room: 'NW', pts: rect(-26.2, -26.2, -9.5, -9.5) },
  { kind: 'meadow', room: 'NE', pts: rect(9.5, -26.2, 26.2, -9.5) },
];

/* ---------- what stands in the garden ---------- */
export const TREES = [
  { kind: 'olive', x: 7.2, z: -7.2 }, { kind: 'olive', x: -7.2, z: -7.2 }, { kind: 'olive', x: 7.2, z: 7.2 }, { kind: 'olive', x: -7.2, z: 7.2 },
  { kind: 'willow', x: -5.6, z: -23.4 },
  { kind: 'cherry', x: 13.2, z: -13.6 }, { kind: 'cherry', x: 24.3, z: -13 }, { kind: 'cherry', x: 13.9, z: -23.7 }, { kind: 'cherry', x: 18.4, z: -24.3 },
  { kind: 'cherry', x: 23.1, z: -22.6, speaker: true },
  { kind: 'maple', x: -24.3, z: -6.1 }, { kind: 'maple', x: -11.6, z: 6.3 },
  { kind: 'birch', x: -12.7, z: -21.9 }, { kind: 'birch', x: -16.7, z: -12.3 }, { kind: 'birch', x: -21.3, z: -14.7 }, { kind: 'birch', x: -24.3, z: -22.7 },
  { kind: 'birch', x: -19.3, z: -25.1 }, { kind: 'birch', x: -23.7, z: -11.3 }, { kind: 'birch', x: -24.9, z: -17.3 }, { kind: 'birch', x: -11.6, z: -17.6 },
  { kind: 'lemon', x: 12.2, z: 13.1 }, { kind: 'lemon', x: 24.6, z: 13.1 }, { kind: 'lemon', x: 12.2, z: 23.9 },
];

export const SPEAKERS = [                // part: which stem it plays · y: the height of its driver
  { part: 'pad', room: 'S', kind: 'bollard', x: 2.95, z: 16.5, y: .66 },
  { part: 'bowls', room: 'N', kind: 'rock', x: 2.7, z: -23.75, y: .3 },
  { part: 'shimmer', room: 'E', kind: 'arch', x: 16.3, z: 0, y: 2.62 },
  { part: 'handpan', room: 'W', kind: 'lantern', x: -22.9, z: -1.7, y: 1.22 },
  { part: 'flute', room: 'NE', kind: 'tree', x: 22.95, z: -22.45, y: 2.35 },
  { part: 'bass', room: 'NW', kind: 'stump', x: -18.1, z: -21.4, y: .42 },
  { part: 'chimes', room: 'SE', kind: 'pendant', x: 18.5, z: 18.3, y: 2.28 },
  { part: 'piano', room: 'SW', kind: 'post', x: -25.35, z: 19.3, y: 2.02 },
];
for (const s of SPEAKERS) s.yaw = yawTo(s.x, s.z, 0, 0);          // every speaker is aimed at the chair

export const PROPS = [
  { kind: 'gate', x: 0, z: HALF, yaw: 0 },
  { kind: 'bench', x: -5.2, z: 21.2, yaw: Math.PI / 2 },
  { kind: 'bench', x: 25.1, z: 0, yaw: -Math.PI / 2 },
  { kind: 'bench', x: 20.2, z: -16.1, yaw: yawTo(20.2, -16.1, 18.6, -17.6) },
  { kind: 'bench', x: -22.9, z: -18.9, yaw: yawTo(-22.9, -18.9, -19, -20) },
  { kind: 'arch', x: 12.4, z: 0, yaw: Math.PI / 2 }, { kind: 'arch', x: 16.3, z: 0, yaw: Math.PI / 2 }, { kind: 'arch', x: 20.2, z: 0, yaw: Math.PI / 2 },
  { kind: 'basin', x: -12.3, z: -5.7, yaw: .6 },
  { kind: 'rock', x: -19, z: -3.9, r: 1.15, seed: 3 }, { kind: 'rock', x: -16.3, z: 3.7, r: .8, seed: 7 },
  { kind: 'rock', x: -23, z: 4.6, r: .55, seed: 11 }, { kind: 'rock', x: -12.9, z: 2.9, r: .38, seed: 5 },
  { kind: 'log', x: -21.7, z: -20.4, yaw: .9 },
  { kind: 'hive', x: 11.9, z: -25.1, yaw: 0 }, { kind: 'hive', x: 13.5, z: -25.2, yaw: -.2 },
  { kind: 'terrace', x0: 12.8, z0: 13.9, x1: 24.2, z1: 23.2 },
  { kind: 'pergola', x0: 13.4, z0: 14.6, x1: 23.6, z1: 22.4 },
  { kind: 'table', x: 16.1, z: 20, yaw: 0 },
  { kind: 'sundial', x: -17.8, z: 17.8 },
  { kind: 'birdbath', x: 24.4, z: -4.6 },
  { kind: 'pot', x: 13.4, z: 22.9, r: .34 }, { kind: 'pot', x: 23.5, z: 22.9, r: .42 }, { kind: 'pot', x: 23.4, z: 14.6, r: .3 },
  { kind: 'wheelbarrow', x: -12.2, z: 25, yaw: 2.4 },
];

/* ---------- walking: where the ground is, and what you can't walk through ---------- */
export function groundY(x, z) {
  const r = Math.hypot(x - CHAIR.x, z - CHAIR.z);
  if (r < PLATFORM.r) return PLATFORM.h;
  if (r < PLATFORM.step) return PLATFORM.h / 2;
  return 0;
}

// Colliders are 2D signed-distance shapes. The walker is a circle, pushed out of any it overlaps.
export const COLLIDERS = [];
const box = (x0, z0, x1, z1) => ({ type: 'box', x0, z0, x1, z1 });
const disc = (x, z, r) => ({ type: 'disc', x, z, r });
for (const h of HEDGES) if (h.y0 < 1) COLLIDERS.push(box(h.x0, h.z0, h.x1, h.z1));
COLLIDERS.push(box(-.7, HALF - .5, .7, HALF + .9));                             // the gate itself
for (const t of TREES) COLLIDERS.push(disc(t.x, t.z, t.kind === 'olive' || t.kind === 'lemon' ? .55 : t.kind === 'willow' ? .45 : .22));
for (const s of SPEAKERS) if (s.kind !== 'arch' && s.kind !== 'pendant' && s.kind !== 'tree') COLLIDERS.push(disc(s.x, s.z, s.kind === 'stump' ? .42 : s.kind === 'rock' ? .45 : s.kind === 'lantern' ? .45 : .2));
for (const b of BEDS) if (b.kind === 'soil') COLLIDERS.push({ type: 'poly', pts: b.pts, pad: b.raised ? .05 : -.05 });
COLLIDERS.push({ type: 'pond' });
COLLIDERS.push(disc(CHAIR.x - .1, CHAIR.z, .55));
for (const p of PROPS) {
  if (p.kind === 'bench') COLLIDERS.push({ type: 'obox', x: p.x, z: p.z, yaw: p.yaw, hw: .8, hd: .32 });
  else if (p.kind === 'rock') COLLIDERS.push(disc(p.x, p.z, p.r * .95));
  else if (p.kind === 'basin') COLLIDERS.push(disc(p.x, p.z, .6));
  else if (p.kind === 'log') COLLIDERS.push({ type: 'obox', x: p.x, z: p.z, yaw: p.yaw, hw: .25, hd: 1.6 });
  else if (p.kind === 'hive') COLLIDERS.push({ type: 'obox', x: p.x, z: p.z, yaw: p.yaw, hw: .3, hd: .3 });
  else if (p.kind === 'table') COLLIDERS.push(disc(p.x, p.z, .95));
  else if (p.kind === 'sundial') COLLIDERS.push(disc(p.x, p.z, .35));
  else if (p.kind === 'birdbath') COLLIDERS.push(disc(p.x, p.z, .35));
  else if (p.kind === 'pot') COLLIDERS.push(disc(p.x, p.z, p.r + .05));
  else if (p.kind === 'wheelbarrow') COLLIDERS.push(disc(p.x, p.z, .55));
  else if (p.kind === 'pergola') for (const x of [p.x0, (p.x0 + p.x1) / 2, p.x1]) for (const z of [p.z0, p.z1]) COLLIDERS.push(disc(x, z, .16));
  else if (p.kind === 'arch') for (const s of [-1, 1]) COLLIDERS.push(disc(p.x, p.z + s * 1.05, .1));
}
// Raked gravel isn't for walking on: only the stepping stones cross it.
const zen = BEDS.find(b => b.kind === 'zen'), stones = PATHS.filter(p => p.kind === 'stones');
COLLIDERS.push({ type: 'zen', pts: zen.pts, keep: stones });

export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
export function polyDist(pts, x, z) {                    // distance to the outline, and whether (x, z) is inside
  let d = Infinity, inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, az] = pts[j], [bx, bz] = pts[i];
    d = Math.min(d, segDist(x, z, ax, az, bx, bz));
    if ((bz > z) !== (az > z) && x < (ax - bx) * (z - bz) / (az - bz) + bx) inside = !inside;
  }
  return { d, inside };
}
export function lineDist(pts, x, z) {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(x, z, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  return d;
}
function sdf(c, x, z) {
  switch (c.type) {
    case 'disc': return Math.hypot(x - c.x, z - c.z) - c.r;
    case 'box': {
      const dx = Math.max(c.x0 - x, x - c.x1), dz = Math.max(c.z0 - z, z - c.z1);
      return dx > 0 || dz > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) : Math.max(dx, dz);
    }
    case 'obox': {
      const s = Math.sin(c.yaw), co = Math.cos(c.yaw), lx = (x - c.x) * co - (z - c.z) * s, lz = (x - c.x) * s + (z - c.z) * co;
      const dx = Math.abs(lx) - c.hw, dz = Math.abs(lz) - c.hd;
      return dx > 0 || dz > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) : Math.max(dx, dz);
    }
    case 'poly': { const { d, inside } = polyDist(c.pts, x, z); return (inside ? -d : d) - c.pad; }
    case 'pond': {
      const dx = x - POND.x, dz = z - POND.z, a = Math.atan2(dz / POND.rz, dx / POND.rx), k = pondRadius(a);
      const e = Math.hypot(dx / (POND.rx * k + .15), dz / (POND.rz * k + .15));
      return (e - 1) * Math.min(POND.rx, POND.rz) * k;
    }
    case 'zen': {
      const { d, inside } = polyDist(c.pts, x, z), inRect = inside ? -d : d;
      let path = Infinity;
      for (const p of c.keep) path = Math.min(path, lineDist(p.pts, x, z) - .62);
      return Math.max(inRect + .15, -path);
    }
  }
  return Infinity;
}
// Push a circle of radius r at (x, z) out of everything it overlaps. Returns [x, z].
export function collide(x, z, r) {
  for (let it = 0; it < 4; it++) {
    let moved = false;
    for (const c of COLLIDERS) {
      const d = sdf(c, x, z);
      if (d >= r) continue;
      const e = .02, gx = sdf(c, x + e, z) - sdf(c, x - e, z), gz = sdf(c, x, z + e) - sdf(c, x, z - e), gl = Math.hypot(gx, gz);
      if (gl < 1e-6) continue;
      x += gx / gl * (r - d); z += gz / gl * (r - d); moved = true;
    }
    if (!moved) break;
  }
  return [x, z];
}

/* ---------- sound: how much hedge stands between two points ---------- */
// A hedge between a speaker and your ears doesn't silence it, but it takes the edge off. This walks the straight line
// between them and adds up how far below each hedge's top it passes, so sound over the top of a hedge gets through.
export function occlusion(ax, ay, az, bx, by, bz) {
  let occ = 0;
  for (const h of HEDGES) {
    const hit = slab(ax, az, bx, bz, h.x0, h.z0, h.x1, h.z1);
    if (!hit) continue;
    const y = ay + (by - ay) * (hit[0] + hit[1]) / 2;
    const under = h.h - y;
    if (under <= 0 || y < h.y0) continue;
    occ += Math.min(1, under / .9) * (h.kind === 'laurel' ? 1 : h.kind === 'yew' ? .85 : .45);
  }
  return Math.min(1.4, occ);
}
function slab(ax, az, bx, bz, x0, z0, x1, z1) {           // [t0, t1] where a→b crosses the rectangle, or null
  let t0 = 0, t1 = 1;
  for (const [a, d, lo, hi] of [[ax, bx - ax, x0, x1], [az, bz - az, z0, z1]]) {
    if (Math.abs(d) < 1e-9) { if (a < lo || a > hi) return null; continue; }
    let u = (lo - a) / d, v = (hi - a) / d; if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

// A small seeded random generator, so the garden grows the same way every visit.
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
