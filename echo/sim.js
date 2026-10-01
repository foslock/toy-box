// The spelunker and the loose rocks, moving through the distance field. A fixed 60 Hz step so the headless check
// plays exactly what the page plays. No three.js in here.
import { D, grad, march, waterLevel, SECTIONS, MOVABLES, ZONES, clamp, lerp, groundY, CLIFF_X } from './world.js';

export const HZ = 60, DT = 1 / HZ;
export const EYE = 1.6;
export const BREATH = 16;                 // seconds under water before you black out
const G = 20, WALK = 2.6, RUN = 4, WADE = 1.7, SWIM = 2.3, PUSH = 1.25;
const STEP_UP = .6;                       // anything this high or lower you clamber onto
const BODY = [[.9, .3], [1.38, .28]];     // spheres (height above your feet, radius) that bump into walls
const FOOT = .18;
const RH = [.65, .5, .65];                // a loose rock's half sizes

// Points on a loose rock's surface, for testing where it may go.
function lattice(inset, lift) {
  const xs = [-.65 + inset, -.22, .22, .65 - inset], ys = [-.5 + lift, 0, .5 - .02], out = [], bottom = [];
  for (const x of xs) for (const y of ys) for (const z of xs) {
    const edge = Math.abs(x) > .4 || Math.abs(z) > .4 || y !== 0;
    if (edge) out.push([x, y, z]);
  }
  for (const x of [-.6, -.2, .2, .6]) for (const z of [-.6, -.2, .2, .6]) bottom.push([x, -.5, z]);
  return { out, bottom };
}
const SIDE = lattice(.02, .12), SLIM = lattice(.1, .12);

export class Rock {
  constructor(def) { this.def = def; this.reset(); }
  reset() { const d = this.def; this.x = d.x; this.y = d.y; this.z = d.z; this.vy = 0; this.speed = 0; this.moved = 0; this.fell = false; this.grounded = true; }
}

export class Sim {
  constructor(cp = 0) {
    this.rocks = MOVABLES.map(m => new Rock(m));
    this.events = [];
    this.t = 0;
    this.cp = 0;
    this.spawn(cp);
  }
  spawn(cp) {
    this.cp = cp;
    const s = SECTIONS[cp];
    const p = this.p = { x: s.spawn[0], y: s.spawn[1], z: s.spawn[2], vx: 0, vy: 0, vz: 0, yaw: s.yaw, pitch: -.05, ground: true, swim: false, under: false, wade: 0, breath: 1, stepAcc: 0, bumpT: 0, stuckT: 0 };
    p.y = this.groundAt(p.x, p.y + .5, p.z, 2);
    for (const r of this.rocks) if (r.def.sec >= cp) r.reset();
    this.events.push({ type: 'spawn', cp });
  }

  /* ----- what's under foot ----- */
  // Highest ground under a foot-sized disc at (x, z), searching down from y + reach. Rock tops count.
  groundAt(x, y, z, down = 1.2) {
    let best = -1e9;
    for (const [ox, oz] of [[0, 0], [FOOT, 0], [-FOOT, 0], [0, FOOT], [0, -FOOT]]) {
      const px = x + ox, pz = z + oz;
      let yy = y, n = 0;
      if (D(px, yy, pz) > -.01) continue;                        // that bit of the foot is in the wall
      while (n++ < 40 && yy > y - down - STEP_UP) {
        const d = D(px, yy, pz);
        if (d > -.01) break;
        yy -= Math.max(-d * .8, .02);
      }
      if (yy > best) best = yy;
    }
    for (const r of this.rocks) {
      const top = r.y + RH[1];
      if (Math.abs(x - r.x) < RH[0] + FOOT * .6 && Math.abs(z - r.z) < RH[2] + FOOT * .6 && top <= y + .05 && top > best) best = top;
    }
    return best > -1e8 ? best : y - STEP_UP;                        // wedged in: stay put rather than fall forever
  }

  /* ----- loose rocks ----- */
  rockFree(r, x, y, z, pts, ignorePlayer) {
    for (const [ox, oy, oz] of pts) if (D(x + ox, y + oy, z + oz) > -.005) return false;
    for (const o of this.rocks) if (o !== r && Math.abs(o.x - x) < 1.3 && Math.abs(o.z - z) < 1.3 && Math.abs(o.y - y) < .98) return false;
    if (!ignorePlayer) {
      const p = this.p;
      if (Math.abs(p.x - x) < .65 + .25 && Math.abs(p.z - z) < .65 + .25 && p.y < y + .45 && p.y + 1.7 > y - .5) return false;
    }
    return true;
  }
  pushRock(r, dx, dz) {
    if (!r.grounded) return 0;
    const nx = r.x + dx, nz = r.z + dz;
    if (this.rockFree(r, nx, r.y, nz, SIDE.out, true)) { r.x = nx; r.z = nz; return 1; }
    const up = .008 + .45 * Math.hypot(dx, dz);              // up a gentle slope or a crumb of grit, never a step
    if (this.rockFree(r, nx, r.y + up, nz, SIDE.out, true)) { r.x = nx; r.z = nz; r.y += up; return 1; }
    return 0;
  }
  stepRock(r) {
    // falls when nothing is under any part of its base
    let held = false;
    for (const [ox, , oz] of SIDE.bottom) if (D(r.x + ox, r.y - .5 - .03, r.z + oz) > -.001) { held = true; break; }
    if (!held) for (const o of this.rocks) if (o !== r && Math.abs(o.x - r.x) < 1.25 && Math.abs(o.z - r.z) < 1.25 && Math.abs(o.y + 1 - r.y) < .05) { held = true; break; }
    if (held && r.vy >= 0) { r.vy = 0; r.grounded = true; return; }
    r.grounded = false;
    r.vy -= G * DT;
    const ny = r.y + r.vy * DT;
    const okAt = y => {
      for (const [ox, , oz] of SIDE.bottom) if (D(r.x + ox, y - .5, r.z + oz) > 0) return false;
      for (const o of this.rocks) if (o !== r && Math.abs(o.x - r.x) < 1.25 && Math.abs(o.z - r.z) < 1.25 && y - .5 < o.y + .5 && y > o.y) return false;
      return this.rockFree(r, r.x, y, r.z, SLIM.out, true);
    };
    if (okAt(ny)) { r.y = ny; return; }
    let lo = ny, hi = r.y;
    for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (okAt(m)) hi = m; else lo = m; }
    const fall = -r.vy;
    r.y = hi; r.vy = 0; r.grounded = true;
    if (fall > 2) { r.fell = true; this.events.push({ type: 'thud', rock: r, speed: fall }); }
  }

  /* ----- you ----- */
  step(inp) {
    const p = this.p, ev = this.events;
    this.t += DT;
    p.yaw = inp.yaw; p.pitch = inp.pitch;
    const lvl = waterLevel(p.x, p.z);
    const eyeY = p.y + EYE;
    const deep = lvl !== null && D(p.x, Math.min(lvl - .05, eyeY), p.z) < 0 ? lvl - p.y : 0;
    const wasUnder = p.under;
    p.under = lvl !== null && eyeY < lvl - .04 && D(p.x, eyeY, p.z) < 0;
    p.wade = lvl !== null ? clamp(deep / 1.2, 0, 1) : 0;
    const swimming = lvl !== null && deep > 1.25;
    if (swimming !== p.swim) { p.swim = swimming; if (!swimming) p.vy = 0; }
    if (p.under && !wasUnder) ev.push({ type: 'dive' });
    if (!p.under && wasUnder) ev.push({ type: 'surface', breath: p.breath });

    // breath
    if (p.under) {
      p.breath -= DT / BREATH;
      if (p.breath <= 0) { p.breath = 0; ev.push({ type: 'drown' }); return; }
    } else p.breath = Math.min(1, p.breath + DT / 2.2);

    // where you want to go
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    let fx = clamp(inp.fx || 0, -1, 1), fz = clamp(inp.fz || 0, -1, 1);
    const l = Math.hypot(fx, fz); if (l > 1) { fx /= l; fz /= l; }
    const top = p.swim ? SWIM : p.wade > .25 ? lerp(WALK, WADE, smooth01((p.wade - .25) / .75)) * (inp.run ? 1.25 : 1) : inp.run ? RUN : WALK;
    let tvx = (fx * cy + fz * sy) * top, tvz = (-fx * sy + fz * cy) * top, tvy = 0;
    if (p.swim) {
      // swim the way you look: forward tips you up or down with your gaze
      const fwd = -fz;
      const cp = Math.cos(p.pitch), spch = Math.sin(p.pitch);
      tvx = (fx * cy - fwd * sy * cp) * top; tvz = (-fx * sy - fwd * cy * cp) * top; tvy = fwd * spch * top;
      if (!p.under && tvy > 0) tvy = 0;
      const floatY = lvl + .22 - EYE;                         // head just out of the water
      if (!p.under && tvy > -.6) tvy = (floatY - p.y) * 3;      // bob at the surface
      else if (p.under && Math.abs(fwd) < .1) tvy = .28;       // drift up slowly when you stop
      const k = 1 - Math.exp(-4 * DT);
      p.vx += (tvx - p.vx) * k; p.vz += (tvz - p.vz) * k; p.vy += (tvy - p.vy) * k;
    } else {
      const k = 1 - Math.exp(-(p.ground ? 11 : 2) * DT);
      p.vx += (tvx - p.vx) * k; p.vz += (tvz - p.vz) * k;
    }

    // pushing loose rocks: walk into one's side
    let pushing = null;
    for (const r of this.rocks) {
      const dx = p.x - r.x, dz = p.z - r.z;
      if (p.y > r.y + RH[1] - .1 || p.y + 1.7 < r.y - RH[1]) continue;
      const ex = Math.abs(dx) - RH[0], ez = Math.abs(dz) - RH[2];
      const cx = clamp(dx, -RH[0], RH[0]), cz = clamp(dz, -RH[2], RH[2]);
      const dist = Math.hypot(dx - cx, dz - cz);
      if (dist > .3 + .04) continue;
      const alongX = ex > ez;                                  // which face you're at
      const dir = alongX ? -Math.sign(dx) : -Math.sign(dz);
      const into = alongX ? p.vx * dir : p.vz * dir;
      const want = alongX ? tvx * dir : tvz * dir;
      if (p.ground && !p.swim && want > .8 && into > -.2) {
        const sp = Math.min(PUSH, Math.max(into, .5));
        const moved = this.pushRock(r, alongX ? dir * sp * DT : 0, alongX ? 0 : dir * sp * DT);
        r.speed = moved ? sp : 0;
        if (moved) { r.moved += sp * DT; pushing = r; }
        if (alongX) p.vx = dir * Math.min(Math.max(p.vx * dir, 0), moved ? sp : 0); else p.vz = dir * Math.min(Math.max(p.vz * dir, 0), moved ? sp : 0);
      }
    }
    for (const r of this.rocks) { if (r !== pushing) r.speed *= .8; this.stepRock(r); }

    // move, then shove out of the rock
    const ox = p.x, oz = p.z;
    p.x += p.vx * DT; p.z += p.vz * DT;
    let bumped = null;
    const g = [0, 0, 0, 0];
    for (let it = 0; it < 3; it++) {
      for (const [h, rad] of BODY) {
        const y = p.y + h, d = D(p.x, y, p.z);
        if (d <= -rad) continue;
        grad(p.x, y, p.z, g);
        if (p.swim) {                                          // in water you can be pushed any way
          const pen = (d + rad) / Math.max(g[3], .5);
          p.x -= g[0] * pen; p.y -= g[1] * pen; p.z -= g[2] * pen;
          const vn = -(p.vx * g[0] + p.vy * g[1] + p.vz * g[2]);
          if (vn < 0) { p.vx += vn * g[0]; p.vy += vn * g[1]; p.vz += vn * g[2]; }
        } else {
          const hl = Math.hypot(g[0], g[2]);
          if (hl < .25) continue;                              // that's floor or ceiling, not wall
          const pen = (d + rad) / Math.max(g[3], .5) / hl;
          const nx = g[0] / hl, nz = g[2] / hl;
          p.x -= nx * pen; p.z -= nz * pen;
          const vn = p.vx * nx + p.vz * nz;
          if (vn > 0) { p.vx -= vn * nx; p.vz -= vn * nz; }
        }
        if (!bumped && d > -rad + .03) bumped = [p.x + g[0] * rad, y + g[1] * rad, p.z + g[2] * rad];
      }
      // and the loose rocks, as boxes
      for (const r of this.rocks) {
        if (p.y >= r.y + RH[1] - .1 || p.y + 1.7 < r.y - RH[1]) continue;
        const dx = p.x - r.x, dz = p.z - r.z;
        const cx = clamp(dx, -RH[0], RH[0]), cz = clamp(dz, -RH[2], RH[2]);
        let qx = dx - cx, qz = dz - cz, dist = Math.hypot(qx, qz);
        if (dist >= .3) continue;
        if (dist < 1e-4) { if (Math.abs(dx) / RH[0] > Math.abs(dz) / RH[2]) { qx = Math.sign(dx); qz = 0; } else { qx = 0; qz = Math.sign(dz); } dist = 0; }
        else { qx /= dist; qz /= dist; }
        p.x += qx * (.3 - dist); p.z += qz * (.3 - dist);
        const vn = p.vx * qx + p.vz * qz;
        if (vn < 0) { p.vx -= vn * qx; p.vz -= vn * qz; }
      }
    }
    // the edge of the world outside
    if (p.x > CLIFF_X) {
      const dx = p.x - 230, dz = p.z + 151, d = Math.hypot(dx, dz);
      if (d > 28) { p.x = 230 + dx / d * 28; p.z = -151 + dz / d * 28; }
    }

    // up and down
    if (p.swim) {
      p.y += p.vy * DT;
      for (const [h, rad] of [[.35, .3]]) {                    // feet against the bottom
        const d = D(p.x, p.y + h, p.z);
        if (d > -rad) { grad(p.x, p.y + h, p.z, g); const pen = (d + rad) / Math.max(g[3], .5); p.x -= g[0] * pen; p.y -= g[1] * pen; p.z -= g[2] * pen; if (p.vy < 0 && g[1] < -.5) p.vy = 0; }
      }
      if (D(p.x, p.y + 1.72, p.z) > -.04) { p.y -= .02; if (p.vy > 0) p.vy = 0; }   // head against the roof
      p.ground = false;
    } else {
      const gy = this.groundAt(p.x, p.y + STEP_UP, p.z);
      if (p.ground && gy > p.y - .35 && gy < p.y + STEP_UP + .02) {
        // on the ground: follow it, climbing up steps a little slower than down
        p.y = gy > p.y ? Math.min(gy, p.y + 3.2 * DT + (gy - p.y) * .25) : Math.max(gy, p.y - 6 * DT);
        p.vy = 0;
      } else {
        p.vy -= G * DT;
        p.y += p.vy * DT;
        if (p.y <= gy) { const v = -p.vy; p.y = gy; p.vy = 0; if (v > 3) ev.push({ type: 'land', speed: v }); }
      }
      p.ground = p.y - gy < .04;
      if (D(p.x, p.y + 1.74, p.z) > 0 && p.vy > 0) p.vy = 0;
    }

    // steps and bumps make little sounds of their own
    const moved = Math.hypot(p.x - ox, p.z - oz);
    if (p.ground || p.swim) p.stepAcc += moved;
    if (p.stepAcc > (p.swim ? 1.3 : .78)) { p.stepAcc = 0; ev.push({ type: p.swim ? 'stroke' : 'step', water: p.wade > .05, under: p.under, x: p.x, y: p.y, z: p.z }); }
    p.bumpT -= DT;
    if (bumped && p.bumpT <= 0 && Math.hypot(tvx, tvz) > 1) { p.bumpT = .45; ev.push({ type: 'bump', at: bumped }); }

    // checkpoints: only ever forward
    for (let i = this.cp + 1; i < SECTIONS.length; i++) {
      const tr = SECTIONS[i].trigger;
      if (tr && Math.hypot(p.x - tr[0], p.y - tr[1], p.z - tr[2]) < tr[3]) { this.cp = i; ev.push({ type: 'cp', cp: i }); }
    }
    // stuck in the pit with nothing to stand on
    const pit = ZONES.pit;
    const inPit = p.x > pit.x0 && p.x < pit.x1 && p.z > pit.z0 && p.z < pit.z1 && p.y < pit.y;
    p.stuckT = inPit ? p.stuckT + DT : 0;
  }
  eye() { return [this.p.x, this.p.y + EYE, this.p.z]; }
  drain() { const e = this.events; this.events = []; return e; }
}
const smooth01 = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export { march };
