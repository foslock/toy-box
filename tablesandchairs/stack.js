// The physics side: a planck.js (Box2D) world with a floor, each piece a rigid body made of its convex parts.
// The flat geometry (outlines, lowering a piece onto the tower) is in geom.js and fit.js.
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

// Who rests on whom, from the physics' own contacts: for each body, its mass and centre of mass, the span of
// the contacts it stands on (x0..x1, at about height y) and the body under it taking most of its weight (its
// index, or -1 for the ground). See steadiness in fit.js.
export function supports(world, bodies, ground) {
  const index = new Map(bodies.map((b, i) => [b, i]));
  const S = bodies.map(b => { const c = b.getWorldCenter(); return { m: b.getMass(), cx: c.x, cy: c.y, x0: Infinity, x1: -Infinity, y: 0, n: 0, votes: new Map(), under: -1 }; });
  for (let c = world.getContactList(); c; c = c.getNext()) {
    if (!c.isTouching()) continue;
    const A = c.getFixtureA().getBody(), B = c.getFixtureB().getBody(), wm = c.getWorldManifold(null);
    if (!wm || Math.abs(wm.normal.y) < .35) continue;                 // side by side, not one on the other
    const up = wm.normal.y < 0 ? A : B, low = up === A ? B : A, s = S[index.get(up)];   // the normal points from A to B
    if (!s) continue;
    const j = index.get(low) ?? -1;
    for (let k = 0; k < wm.pointCount; k++) {
      const { x, y } = wm.points[k];
      if (x < s.x0) s.x0 = x; if (x > s.x1) s.x1 = x;
      s.y += y; s.n++; s.votes.set(j, (s.votes.get(j) || 0) + 1);
    }
  }
  for (const s of S) {
    if (s.n) s.y /= s.n;
    let most = 0;
    for (const [j, v] of s.votes) if (v > most) { most = v; s.under = j; }
    delete s.votes; delete s.n;
  }
  return S;
}

// The parts of a body as world-space polygons, [[x, y], ...].
export function bodyPolys(body, out = []) {
  for (let f = body.getFixtureList(); f; f = f.getNext()) {
    const poly = [];
    for (const v of f.getShape().m_vertices) { const w = body.getWorldPoint(v); poly.push([w.x, w.y]); }
    out.push(poly);
  }
  return out;
}
