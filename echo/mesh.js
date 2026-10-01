// Turns the cave's distance field into triangles, a chunk at a time (surface nets: one vertex per cell the surface
// passes through, one quad per grid edge it crosses). Chunks are built nearest-first in small slices of each frame,
// so the game can start as soon as the rooms around you exist. Plain JS: the browser and the headless check share it.
import { D, BOUNDS, CLIFF_X, MOUTH } from './world.js';

const N = 24;                                  // cells per chunk side
const SUB = 8;                                 // cells per culling block
const LIP = 1.8, MARGIN = 1.2;                 // how fast the field can change (with noise), and a cell's width to spare

export class Mesher {
  constructor(cell = .35) {
    this.s = cell; this.size = N * cell;
    this.todo = []; this.done = 0; this.total = 0;
    const S = this.size, half = S * Math.sqrt(3) / 2;
    const [x0, y0, z0, x1, y1, z1] = BOUNDS;
    for (let x = Math.floor(x0 / S) * S; x < x1; x += S)
      for (let y = Math.floor(y0 / S) * S; y < Math.min(y1, 24); y += S)
        for (let z = Math.floor(z0 / S) * S; z < z1; z += S) {
          if (x > CLIFF_X + 1) continue;                                          // the wood is drawn by forest.js
          const d = D(x + S / 2, y + S / 2, z + S / 2);
          if (Math.abs(d) > half * LIP + MARGIN) continue;
          this.todo.push({ x, y, z, cx: x + S / 2, cy: y + S / 2, cz: z + S / 2 });
        }
    this.total = this.todo.length;
  }
  // Build chunks for up to `ms` milliseconds, nearest to (px, py, pz) first. Returns the finished ones.
  step(ms, px, py, pz) {
    const out = [], t0 = performance.now();
    if (!this.todo.length) return out;
    for (const c of this.todo) c.d = (c.cx - px) ** 2 + (c.cy - py) ** 2 * 2 + (c.cz - pz) ** 2;
    this.todo.sort((a, b) => b.d - a.d);
    while (this.todo.length && performance.now() - t0 < ms) {
      const c = this.todo.pop(); this.done++;
      const m = this.chunk(c.x, c.y, c.z);
      if (m) out.push(m);
    }
    return out;
  }
  get left() { return this.todo.length; }

  chunk(ox, oy, oz) {
    const s = this.s, M = N + 2, C = M - 1;
    const vals = this.vals ||= new Float32Array(M * M * M);       // reused: most chunks hold nothing
    // Which 8-cell blocks could hold surface: the rest get a stand-in value of the right sign.
    const NB = Math.ceil(M / SUB), act = new Int8Array(NB * NB * NB), sign = new Float32Array(NB * NB * NB);
    const hd = SUB * s * Math.sqrt(3) / 2 * LIP + MARGIN;
    let any = false;
    for (let bk = 0; bk < NB; bk++) for (let bj = 0; bj < NB; bj++) for (let bi = 0; bi < NB; bi++) {
      const d = D(ox + ((bi + .5) * SUB - 1) * s, oy + ((bj + .5) * SUB - 1) * s, oz + ((bk + .5) * SUB - 1) * s);
      const b = (bk * NB + bj) * NB + bi;
      if (Math.abs(d) < hd) { act[b] = 1; any = true; } else sign[b] = d > 0 ? 9 : -9;
    }
    if (!any) return null;
    let pos0 = false, neg0 = false;
    for (let k = 0; k < M; k++) for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const b = ((k / SUB | 0) * NB + (j / SUB | 0)) * NB + (i / SUB | 0);
      if (!act[b]) { vals[(k * M + j) * M + i] = sign[b]; continue; }
      const v = vals[(k * M + j) * M + i] = D(ox + (i - 1) * s, oy + (j - 1) * s, oz + (k - 1) * s);
      if (v > 0) pos0 = true; else neg0 = true;
    }
    if (!pos0 || !neg0) return null;
    // Only cells in live blocks can hold surface (the margin keeps it at least a cell away from the rest).
    const blocks = [];
    for (let b = 0; b < act.length; b++) if (act[b]) blocks.push([b % NB, (b / NB | 0) % NB, b / (NB * NB) | 0]);
    // A vertex in every cell the surface passes through, at the average of its edge crossings.
    const vidx = (this.vidx ||= new Int32Array(C * C * C)).fill(-1);
    const pos = [];
    const at = (i, j, k) => vals[(k * M + j) * M + i];
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const cv = new Float32Array(8);
    for (const [bi, bj, bk] of blocks)
      for (let k = bk * SUB; k < Math.min(bk * SUB + SUB, C); k++) for (let j = bj * SUB; j < Math.min(bj * SUB + SUB, C); j++) for (let i = bi * SUB; i < Math.min(bi * SUB + SUB, C); i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) { const v = cv[c] = at(i + (c & 1), j + (c >> 1 & 1), k + (c >> 2 & 1)); if (v > 0) mask |= 1 << c; }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of E) {
          const va = cv[a], vb = cv[b];
          if ((va > 0) === (vb > 0)) continue;
          const t = va / (va - vb);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += (a >> 1 & 1) + ((b >> 1 & 1) - (a >> 1 & 1)) * t; sz += (a >> 2 & 1) + ((b >> 2 & 1) - (a >> 2 & 1)) * t; n++;
        }
        vidx[(k * C + j) * C + i] = pos.length / 3;
        pos.push(ox + (i - 1 + sx / n) * s, oy + (j - 1 + sy / n) * s, oz + (k - 1 + sz / n) * s);
      }
    // A quad across every grid edge this chunk owns where the field changes sign, facing out into the air.
    const idx = [];
    const V = (i, j, k) => vidx[(k * C + j) * C + i];
    const quad = (a, b, c, d, flip) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
    };
    for (const [bi, bj, bk] of blocks)
      for (let k = Math.max(1, bk * SUB); k <= Math.min(N, bk * SUB + SUB - 1); k++) for (let j = Math.max(1, bj * SUB); j <= Math.min(N, bj * SUB + SUB - 1); j++) for (let i = Math.max(1, bi * SUB); i <= Math.min(N, bi * SUB + SUB - 1); i++) {
        const v0 = at(i, j, k), in0 = v0 > 0;
        if (ox + (i - 1) * s > CLIFF_X + 1) continue;
        if ((at(i + 1, j, k) > 0) !== in0) quad(V(i, j - 1, k - 1), V(i, j, k - 1), V(i, j, k), V(i, j - 1, k), !in0);
        if ((at(i, j + 1, k) > 0) !== in0) quad(V(i - 1, j, k - 1), V(i - 1, j, k), V(i, j, k), V(i, j, k - 1), !in0);
        if ((at(i, j, k + 1) > 0) !== in0) quad(V(i - 1, j - 1, k), V(i, j - 1, k), V(i, j, k), V(i - 1, j, k), !in0);
      }
    if (!idx.length) return null;
    // Normals from the field (smooth across chunks), and how open the space in front of each vertex is.
    const nv = pos.length / 3, nor = new Float32Array(nv * 3), ao = new Float32Array(nv), h = .14;
    for (let v = 0; v < nv; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      let gx = D(x - h, y, z) - D(x + h, y, z), gy = D(x, y - h, z) - D(x, y + h, z), gz = D(x, y, z - h) - D(x, y, z + h);
      const l = Math.hypot(gx, gy, gz) || 1; gx /= l; gy /= l; gz /= l;
      nor[v * 3] = gx; nor[v * 3 + 1] = gy; nor[v * 3 + 2] = gz;
      const a = -D(x + gx * .5, y + gy * .5, z + gz * .5) / .5, b = -D(x + gx * 1.3, y + gy * 1.3, z + gz * 1.3) / 1.3;
      ao[v] = Math.min(1, Math.max(0, .5 * a + .5 * b));
    }
    // Check winding against the field's normal once per chunk (all quads share a convention).
    {
      const [a, b, c] = idx, p = pos;
      const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2];
      const wx = p[c * 3] - p[a * 3], wy = p[c * 3 + 1] - p[a * 3 + 1], wz = p[c * 3 + 2] - p[a * 3 + 2];
      const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
      if (fx * (nor[a * 3] + nor[b * 3] + nor[c * 3]) + fy * (nor[a * 3 + 1] + nor[b * 3 + 1] + nor[c * 3 + 1]) + fz * (nor[a * 3 + 2] + nor[b * 3 + 2] + nor[c * 3 + 2]) < 0)
        for (let q = 0; q < idx.length; q += 3) { const t = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = t; }
    }
    const S = this.size;
    const nearMouth = Math.hypot(ox + S / 2 - MOUTH.x, oz + S / 2 - MOUTH.z) < 60;
    return {
      pos: new Float32Array(pos), nor, ao, idx: nv < 65536 ? new Uint16Array(idx) : new Uint32Array(idx),
      center: [ox + S / 2, oy + S / 2, oz + S / 2], radius: S * .9, nearMouth,
    };
  }
}
