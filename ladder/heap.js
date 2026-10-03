// Ladder: the heap. One hand-built route from the painter's van to the top.
//
// The route zigzags up a tower of junk. Each stretch is a staircase of ledges about 2.8 m apart going one way, and
// the next stretch goes back the other way 5.6 m above it, so a fall drops you down the stretches below. A ledge's
// floor decides how hard the next placement is: grippy wood and rust hold a ladder from about 62° to 84°, painted
// metal from 74°, enamel only from 78°. Everything else (props, the heap behind) is there to make it a heap.
import { KINDS, MATS, placeParts } from './junk.js';
import { poly, World } from './physics.js';

class Builder {
  constructor() { this.objs = []; this.polys = []; this.back = []; this.n = 0; this.sections = []; this.ledges = []; }
  make(k, x, y, o) {
    const ob = { k, x, y, r: 0, f: 1, name: KINDS[k].name, ...o };
    ob.seed = ob.seed ?? (this.n++ * 7919 + 13) % 10007;
    return ob;
  }
  partsOf(ob) { return placeParts(ob).map(p => poly(p.pts, ob.back ? MATS.ghost : MATS[p.mat], ob)); }
  add(ob) {
    ob.polys = this.partsOf(ob);
    if (ob.back) this.back.push(ob); else { this.objs.push(ob); this.polys.push(...ob.polys); }
    const ys = ob.polys.flatMap(p => [p.miny, p.maxy]), xs = ob.polys.flatMap(p => [p.minx, p.maxx]);
    ob.box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    ob.top = ob.box[3];
    return ob;
  }
  at(k, x, y, o = {}) { return this.add(this.make(k, x, y, o)); }
  deco(k, x, y, o = {}) { return this.at(k, x, y, { ...o, back: true }); }
  section(name, y) { this.sections.push({ name, y }); }
  // A staircase of ledges going one way (d = +1 right, -1 left) from the far end e of a ledge with floor `kind` at `top`.
  // Each step's near corner sits just past the last floor's end, by how slippery that floor is, so the good footing
  // is the last half metre or so of it. A step marked turn sends the stairs back the other way above.
  stairs(d, from, steps) {
    const GAP = { container: 0.5, crushed: 0.5, crates: 0.5, plank: 0.5, mattress: 0.5, tires: 0.5, beam: 0.35, vending: 0.25, car: 0.25, washers: 0.15, fridges: 0.15 };
    const WIDE = { washers: 0.66, vending: 0.92, fridges: 1.8 };
    let cur = from;
    for (const st of steps) {
      if (st.section) this.section(st.section, cur.top);
      const c = cur.e + d * GAP[cur.kind], unit = WIDE[st.kind];
      const w = unit ? unit * Math.max(1, Math.round(st.w / unit)) : st.w;
      const x0 = d > 0 ? c : c - w, x1 = d > 0 ? c + w : c, top = +(cur.top + (st.rise || 2.8)).toFixed(2);
      if (st.kind === 'bus') { const bx = c + d * 4.2; this.at('bus', bx, top - 2.9, { c: 0, f: d }); cur = { e: c, top, kind: 'container', x0: d > 0 ? c : c - 8.4, x1: d > 0 ? c + 8.4 : c }; this.ledges.push({ kind: 'bus', x0: cur.x0, x1: cur.x1, top }); continue; }
      this.ledge(st.kind, x0, x1, top, st);
      cur = { e: d > 0 ? x1 : x0, top, kind: st.kind, x0, x1 };
      if (st.turn) { d = -d; cur.e = c; }
    }
    return cur;
  }
  // a ledge whose floor is at top between x0 and x1, built from one kind of junk
  ledge(kind, x0, x1, top, o = {}) {
    const w = x1 - x0, cx = (x0 + x1) / 2, c = o.c ?? this.ledges.length;
    this.ledges.push({ kind, x0, x1, top });
    switch (kind) {
      case 'container': return this.at('container', cx, top - 2.6, { w, c });
      case 'crushed': { const h = o.h || 1.0; return this.at('crushed', cx, top - h, { w, h, c }); }
      case 'beam': return this.at('beam', cx, top - 0.3, { l: w, c });
      case 'plank': return this.at('plank', cx, top - 0.2, { l: w, c });
      case 'crates': {
        const n = Math.max(1, Math.round(w / 1.2)), cw = w / n, rows = o.rows || 2, ch = 0.95;
        for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) this.at('crate', x0 + cw * (i + 0.5) + (r % 2 ? 0.03 : -0.02), top - ch * (rows - r), { w: cw - 0.02, h: ch, seed: 31 + i * 7 + r * 3 + this.n++ });
        return;
      }
      case 'fridges': { const n = Math.round(w / 1.8); for (let i = 0; i < n; i++) this.at('fridge', x0 + 1.8 * (i + 1), top - 0.38, { r: 90, c: c + i }); return; }
      case 'washers': { const n = Math.round(w / 0.66); this.at('beam', cx, top - 1.16, { l: w, c: 1 }); for (let i = 0; i < n; i++) this.at('washer', x0 + 0.33 + i * 0.66, top - 0.86, { c: c + i }); return; }
      case 'vending': { const n = Math.round(w / 0.92); for (let i = 0; i < n; i++) this.at('vending', x0 + 0.46 + i * 0.92, top - 1.86, { c: c + i }); return; }
      case 'mattress': { this.at('crushed', cx, top - 1.0, { w, h: 0.76, c }); return this.at('mattress', o.mx ?? cx, top - 0.24, { w: o.mw || Math.min(w, 1.9) }); }
      case 'tires': { const n = Math.max(1, Math.round(w / 0.86)), rows = o.rows || 3; for (let i = 0; i < n; i++) this.at('tires', x0 + 0.43 + i * (w - 0.86) / Math.max(1, n - 1), top - 0.27 * rows, { n: rows }); return; }
    }
    throw new Error('no ledge kind ' + kind);
  }
}

export function buildHeap() {
  const B = new Builder();
  // the ground, and fences far out so nobody wanders off forever
  B.polys.push(poly([[-70, -8], [90, -8], [90, 0], [-70, 0]], MATS.dirt, { k: 'ground', name: 'the ground' }));
  B.polys.push(poly([[-36, 0], [-34, 0], [-34, 300], [-36, 300]], MATS.dirt, { k: 'wall', name: 'the fence' }));
  B.polys.push(poly([[30, 0], [32, 0], [32, 300], [30, 300]], MATS.dirt, { k: 'wall', name: 'the fence' }));
  B.at('van', -24, 0);
  B.at('sign', -14, 0, { text: 'NO DUMPING' });

  /* ================================================================== The Yard: going right, grippy */
  B.section('The Yard', 0);
  B.ledge('container', -10, -4, 2.6, { c: 0 });
  B.at('crushed', -2.2, 0, { c: 1, h: 1.0 }); B.at('crushed', -2.15, 1.0, { c: 4, h: 0.9 }); B.at('crushed', -2.1, 1.9, { c: 2, h: 0.7 });
  B.ledge('container', -6.4, -0.4, 5.2, { c: 1 });
  B.ledge('crates', -1.0, 1.4, 8.05, { rows: 3 });
  B.ledge('crushed', 2.4, 6.0, 10.8, { c: 2 });
  // the right-hand slope: catches falls off that side and climbs back to the crates
  B.ledge('container', 1.0, 7.5, 2.6, { c: 3 });
  B.ledge('crushed', 1.6, 5.2, 5.4, { c: 5 });
  B.at('car', 11.0, 0, { c: 1, f: -1 });
  B.at('tires', 7.9, 0, { n: 2 });

  /* ================================================================== Kitchen Row: going left, enamel */
  B.section('Kitchen Row', 10.8);
  B.ledge('mattress', -2.0, 1.6, 13.6, { c: 0, mx: -1.05, mw: 1.9 });
  B.ledge('fridges', -6.6, -3.0, 16.4, { c: 1 });
  B.at('tub', -7.67, 18.54, { c: 0 });                                     // its right rim at (-6.75, 19.2), floor 18.86
  B.ledge('beam', -12.6, -8.75, 22.0, { c: 0 });
  B.at('stove', -6.1, 14.73, { c: 1 }); B.at('washer', -3.6, 14.77, { c: 2 });

  /* ================================================================== The Music Room: going right */
  B.section('The Music Room', 22.0);
  B.ledge('plank', -16.4, -12.8, 24.8, { c: 1 });
  B.at('piano', -15.6, 23.28, { c: 0 }); B.at('piano', -14.0, 23.28, { c: 1 });
  B.ledge('crushed', -12.0, -8.4, 27.6, { c: 3 });
  B.at('piano', -6.64, 29.08 - 0.0, { c: 2 });                             // its lacquered corner at (-7.4, 30.4)
  B.ledge('plank', -5.88, -3.8, 30.4, { c: 0 });
  B.at('jukebox', -4.8, 28.6, { c: 0 });
  B.ledge('vending', -2.8, 0.88, 33.2, { c: 0 });
  B.ledge('container', 1.2, 4.8, 36.0, { c: 2 });

  /* ================================================================== Scaffold: going left, then a bridge */
  // planks with a hole at alternate ends: you lean up through the hole. Halfway, a gap you lay the ladder across.
  B.section('Scaffold', 36.0);
  B.ledge('plank', -5.8, 0.8, 38.8, { c: 0 });
  B.ledge('plank', -1.6, 0.8, 41.6, { c: 1 });
  B.ledge('plank', -2.3, -0.8, 44.4, { c: 0 });
  B.ledge('plank', -7.2, -5.0, 44.8, { c: 1 });                            // across the gap
  B.ledge('plank', -3.8, 0.8, 47.6, { c: 0 });
  B.ledge('plank', -5.8, -0.8, 50.4, { c: 1 });
  for (const x of [-5.9, 0.9]) B.deco('scaffold', x, 36.2, { w: 0.1, h: 14.4 });

  /* ================================================================== The Car Stack: going right, paintwork */
  // from here up the floors get slippery, and the next corner sits so the only good footing is at the very edge
  B.section('The Car Stack', 50.4);
  B.ledge('crushed', -9.8, -6.2, 53.2, { c: 4 });
  B.at('crushed', -3.6, 54.0, { c: 0, w: 3.6, h: 1.0 }); B.at('car', -3.6, 55.0, { c: 0 });   // over its roof to the bonnet, 56.0
  const top = B.stairs(1, { e: -1.55, top: 56.0, kind: 'car' }, [
    { kind: 'vending', w: 1.84, c: 0 }, { kind: 'crushed', w: 2.2, c: 2 }, { kind: 'vending', w: 1.84, c: 1, turn: true },
    /* the Leaning Tower: going left, white goods again */
    { kind: 'washers', w: 1.98, c: 2, section: 'The Leaning Tower' }, { kind: 'fridges', w: 1.8, c: 2 }, { kind: 'vending', w: 1.84, c: 3 }, { kind: 'beam', w: 1.5, c: 1, turn: true },
    /* the Billboard: going right, steel and enamel */
    { kind: 'beam', w: 2.0, c: 0, section: 'The Billboard' }, { kind: 'washers', w: 1.98, c: 0 }, { kind: 'beam', w: 1.8, c: 1 }, { kind: 'vending', w: 1.84, c: 0 }, { kind: 'crushed', w: 1.6, c: 3, turn: true },
    /* the Last Stretch: going left */
    { kind: 'fridges', w: 1.8, c: 0, section: 'The Last Stretch' }, { kind: 'beam', w: 2.0, c: 0 }, { kind: 'vending', w: 1.84, c: 1 }, { kind: 'washers', w: 1.98, c: 1 },
    { kind: 'bus', section: 'The Top' },
  ]);
  // the top: the roof of a school bus, and someone waiting
  const sx = (top.x0 + top.x1) / 2;
  const summit = { x0: sx - 0.2, x1: sx + 1.8, y0: top.top - 0.2, y1: top.top + 3, npc: sx - 0.7, winX: sx - 0.1 };
  B.deco('parasol', sx - 2.4, top.top); B.deco('easel', sx - 1.5, top.top); B.deco('crate', sx - 2.9, top.top, { w: 0.6, h: 0.5 });

  return finish(B, { start: { x: -16, y: 0 }, summit, demo: { x: -2.4, y: 5.2, a: 72, s: 1.6, face: 1, cx: 1.2, cy: 1.5 } });
}

function finish(B, o) {
  const world = new World(B.polys);
  let top = 0; for (const ob of B.objs) top = Math.max(top, ob.top);
  // overlapping junk is a mistake in the layout
  const bad = [];
  for (let i = 0; i < B.objs.length; i++) for (let j = i + 1; j < B.objs.length; j++) {
    const a = B.objs[i], b = B.objs[j];
    if (a.box[2] - 0.02 <= b.box[0] || b.box[2] - 0.02 <= a.box[0] || a.box[3] - 0.02 <= b.box[1] || b.box[3] - 0.02 <= a.box[1]) continue;
    if (a.polys.some(P => b.polys.some(Q => sat(P, Q, 0.02)))) bad.push(`${a.k}@${a.x.toFixed(1)},${a.y.toFixed(1)} × ${b.k}@${b.x.toFixed(1)},${b.y.toFixed(1)}`);
  }
  return { world, objs: B.objs, back: B.back, polys: B.polys, sections: B.sections, ledges: B.ledges, top, start: o.start, summit: o.summit || null, demo: o.demo, bounds: [-34, 30], overlaps: bad };
}
function sat(A, B, m = 0.003) {
  for (const P of [A, B]) for (let i = 0; i < P.n; i++) {
    const nx = P.nx[i], ny = P.ny[i];
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (let j = 0; j < A.n; j++) { const d = A.x[j] * nx + A.y[j] * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (let j = 0; j < B.n; j++) { const d = B.x[j] * nx + B.y[j] * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 <= b0 + m || b1 <= a0 + m) return false;
  }
  return true;
}
