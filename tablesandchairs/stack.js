// The physics side: a planck.js (Box2D) world with a floor, each piece a rigid body made of its convex parts,
// and the geometry for lowering a held piece until it would just touch whatever is under it.
// Units are decimetres, so gravity is 98 units/s².
import { World, Vec2, Polygon, Box, Settings } from 'planck';

export const G = 98;
// Tall stacks of light pieces on thin legs creep over at 60–120 Hz; at 240 Hz with extra iterations they
// stand still and fall asleep, and a real imbalance still tips them.
export const STEP = 1 / 240;
Settings.linearSleepTolerance = .02;

export function createWorld() {
  const world = new World({ gravity: Vec2(0, -G) });
  const ground = world.createBody({ userData: { ground: true } });
  ground.createFixture(new Box(4000, 10, Vec2(0, -10)), { friction: .9 });
  return { world, ground };
}

// Chairs and tables are wood on wood: grippy enough to stack, not so grippy that nothing ever slides.
export function addBody(world, piece, flip, turn, x, y) {
  const body = world.createBody({ type: 'dynamic', position: Vec2(x, y), angle: turn * Math.PI / 2, userData: piece });
  const m = flip ? -1 : 1;
  for (const q of piece.parts) {
    body.createFixture(new Polygon(q.v.map(([px, py]) => Vec2(px * m, py))), { density: q.dz * .1, friction: .62, restitution: .02 });
  }
  return body;
}

export const step = world => world.step(STEP, 24, 12);

// The parts of a body as world-space polygons, [[x, y], ...].
export function bodyPolys(body, out = []) {
  for (let f = body.getFixtureList(); f; f = f.getNext()) {
    const poly = [];
    for (const v of f.getShape().m_vertices) { const w = body.getWorldPoint(v); poly.push([w.x, w.y]); }
    out.push(poly);
  }
  return out;
}

// Local parts (already posed) moved to (x, y).
export const placePolys = (posed, x, y) => posed.map(q => q.v.map(([px, py]) => [px + x, py + y]));

function xRange(poly) {
  let a = Infinity, b = -Infinity;
  for (const [x] of poly) { if (x < a) a = x; if (x > b) b = x; }
  return [a, b];
}
// Where a vertical line at x crosses a convex polygon: [bottom, top], or null.
function vSpan(poly, x) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0, n = poly.length; i < n; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % n];
    if (x < Math.min(x1, x2) - 1e-9 || x > Math.max(x1, x2) + 1e-9) continue;
    if (Math.abs(x2 - x1) < 1e-9) { lo = Math.min(lo, y1, y2); hi = Math.max(hi, y1, y2); continue; }
    const y = y1 + (y2 - y1) * (x - x1) / (x2 - x1);
    if (y < lo) lo = y; if (y > hi) hi = y;
  }
  return lo <= hi ? [lo, hi] : null;
}

// How far the held polygons (placed at height 0) have to be raised to sit on top of everything under them,
// as if lowered from far above until something touched. Also reports which obstacle it would land on.
// For two convex outlines the gap between the top of one and the bottom of the other is concave across their
// shared x-range, so checking every corner's x (and the range ends) finds the first touch.
export function clearance(held, obstacles) {
  let need = -Infinity, hit = null;
  for (const A of held) {
    const [ax0, ax1] = xRange(A);
    for (const [, y] of A) if (-y > need) { need = -y; hit = null; }   // the floor
    for (const B of obstacles) {
      const [bx0, bx1] = B.range || (B.range = xRange(B));
      const x0 = Math.max(ax0, bx0), x1 = Math.min(ax1, bx1);
      if (x1 - x0 < 1e-6) continue;
      const xs = [x0, x1];
      for (const [x] of A) if (x > x0 && x < x1) xs.push(x);
      for (const [x] of B) if (x > x0 && x < x1) xs.push(x);
      for (const x of xs) {
        const sa = vSpan(A, x), sb = vSpan(B, x);
        if (sa && sb && sb[1] - sa[0] > need) { need = sb[1] - sa[0]; hit = B; }
      }
    }
  }
  return { need, hit };
}

export function polysBounds(polys) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, x1, y0, y1 };
}
