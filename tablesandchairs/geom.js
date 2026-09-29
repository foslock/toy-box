// Flat geometry on outlines made of convex polygons ([[x, y], ...]), shared by the physics, the piece generator
// and the aiming. Units are decimetres. Nothing here touches three.js or planck, so it runs in Node too.

export function xRange(poly) {
  let a = Infinity, b = -Infinity;
  for (const [x] of poly) { if (x < a) a = x; if (x > b) b = x; }
  return [a, b];
}
// Where a vertical line at x crosses a convex polygon: [bottom, top], or null.
export function vSpan(poly, x) {
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

// Local parts (already posed) moved to (x, y).
export const placePolys = (posed, x, y) => posed.map(q => q.v.map(([px, py]) => [px + x, py + y]));

export function polysBounds(polys) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, x1, y0, y1 };
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

// The convex hull of a set of points, anticlockwise.
export function hull(points) {
  const P = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of P) { while (lo.length > 1 && cross(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (hi.length > 1 && cross(hi.at(-2), hi.at(-1), p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

// Mass, centre of mass and moment of inertia (about the centre of mass) of parts [{ v, dz }], at the density the
// physics gives them (dz / 10 per unit area).
export function massProps(parts) {
  let m = 0, mx = 0, my = 0, J = 0;
  for (const { v, dz } of parts) {
    let a = 0, cx = 0, cy = 0, j = 0;
    for (let i = 0, n = v.length; i < n; i++) {
      const [x1, y1] = v[i], [x2, y2] = v[(i + 1) % n], c = x1 * y2 - x2 * y1;
      a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c;
      j += c * (x1 * x1 + x1 * x2 + x2 * x2 + y1 * y1 + y1 * y2 + y2 * y2);
    }
    if (Math.abs(a) < 1e-12) continue;
    const rho = dz * .1, pm = Math.abs(a / 2) * rho;
    m += pm; mx += cx / (3 * a) * pm; my += cy / (3 * a) * pm; J += Math.abs(j) / 12 * rho;
  }
  const cx = mx / m, cy = my / m;
  return { mass: m, cx, cy, I: J - m * (cx * cx + cy * cy) };
}
