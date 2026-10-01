// A guide who knows the way: walks, swims and pushes through every section by waypoints. The headless check
// (check.mjs) and ?autoplay both use it, so the cave is known to be passable end to end.
//   [x, y, z]                walk (or swim, if y is given under water) to there
//   { rock, axis, to }         stand behind that loose rock and push it along x or z until it passes `to`
//   { wait }                 stand still for that many seconds
//   { say }                  make that sound
export const ROUTE = [
  /* 0 */ [{ say: 'snap' }, [3.5, 0, 0], [9, -.2, 2.5], { say: 'snap' }, [14, -.5, 1], [18, -.8, -3], { say: 'snap' }, [23, -1.1, -4.5], [28, -1.5, -2], { say: 'snap' }, [32, -1.8, 1.5], [36.5, -2.1, 2], [40, -2.5, 2]],
  /* 1 */ [{ say: 'clap' }, [48, -2.5, 1], [56, -2.5, 1.5], { say: 'clap' }, [62, -2.5, -2], [64, -2.5, -5], [70, -2.4, -8], [74, -2.3, -11], [74, -2.3, -12.6]],
  /* 2 */ [[74, -2.2, -16], { say: 'snap' }, [80, -2.2, -16], [86, -2.2, -16], { say: 'clap' }, [86, -2.2, -22], [86, -2.2, -28], [80, -2.2, -28], { say: 'snap' }, [80, -2.2, -34], [80, -2.4, -39], [80.4, -2.5, -40.5]],
  /* 3 */ [[81, -4, -44], [82, -6, -49], [82, -7.8, -54], { say: 'whistle' }, [84, -8, -65], [84, -8, -80], { say: 'whistle' }, [83, -8, -88], [80, -8, -94], [77, -8, -100], [75, -8, -103], [72, -8.4, -109], [71.2, -8.6, -111.3]],
  /* 4 */ [[69, -9, -114], [66, -10, -120], { say: 'clap' }, [63, -11.3, -125], [62.5, -11.5, -128], [62, -11.6, -132], [62, -13.2, -136], { say: 'snap' }, [62, -13.2, -141], [62.5, -12.8, -145], [63, -11.6, -148], [63, -11, -151], [63, -10.8, -154], [63, -10.8, -155.6]],
  /* 5 */ [{ say: 'snap' }, [63, -10.8, -158], [66.6, -10.8, -158], { rock: 'plug', axis: 'x', to: 75.6 }, [73.3, -10.8, -158.2], [73.3, -10.8, -160.9]],
  /* 6 */ [{ say: 'snap' }, [73.3, -10.8, -164], [75, -10.8, -168], { say: 'snap' }, [78.2, -10.8, -168], { rock: 'door', axis: 'x', to: 84.6 }, [83.4, -10.8, -165.7], [86.6, -10.8, -165.7], [88, -10.6, -167.6], [89.5, -10.3, -168.3], [90.6, -10.4, -168.8]],
  /* 7 */ [[93, -10.5, -169.5], [97.5, -11, -171], { say: 'clap' }, [101, -11.4, -171.5], [104, -11.6, -172.5], [107, -13.3, -173], { say: 'snap' }, [112, -13.2, -174], [116, -12.4, -175], [116, -11, -175], { wait: 2.5 },
    [117, -13.3, -175.6], [120, -13.3, -176], { say: 'snap' }, [125, -13.3, -176], [128, -12.4, -175], [131, -11.3, -174], [134, -10.9, -173], [137.6, -10.8, -172]],
  /* 8 */ [{ say: 'snap' }, [139, -10.8, -175.4], [141.2, -10.8, -176.6], [142.5, -10.8, -176.6], { rock: 'bridge', axis: 'z', to: -172 }, [140.6, -10.8, -174.4], [140.4, -10.8, -172],
    { rock: 'bridge', axis: 'x', to: 999 }, { say: 'snap' }, [151.75, -10.8, -172], [155, -10.8, -172], [158.8, -10.8, -172]],
  /* 9 */ [[162, -10.3, -171], [167, -9.3, -168], { say: 'clap' }, [171, -8, -163], [174, -6.6, -157], [180, -5.2, -154], [187, -3.6, -152], [194, -2, -151], [201, -.6, -151], [207, .4, -151], [214, .2, -151], [222, 0, -150]],
];

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export class Bot {
  constructor(sim, from = sim.cp) { this.sim = sim; this.sec = from; this.i = 0; this.t = 0; this.stuck = 0; this.done = false; this.log = []; this.yaw = sim.p.yaw; this.pitch = 0; this.phase = 0; }
  get step() { return ROUTE[this.sec]?.[this.i]; }
  next() {
    this.i++; this.t = 0; this.phase = 0;
    if (this.i >= ROUTE[this.sec].length) { this.sec++; this.i = 0; if (this.sec >= ROUTE.length) this.done = true; }
  }
  restartSection(cp) { this.sec = cp; this.i = 0; this.t = 0; this.phase = 0; }
  // One tick's input. `say` comes back as the sound to make, if any.
  input(dt) {
    const s = this.sim, p = s.p, st = this.step;
    const out = { fx: 0, fz: 0, yaw: this.yaw, pitch: this.pitch, say: null };
    if (!st || this.done) return out;
    this.t += dt;
    if (this.t > 40) { this.log.push(`stuck at section ${this.sec} step ${this.i} (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`); this.done = true; this.failed = true; return out; }
    if (st.say) { out.say = st.say; this.next(); return out; }
    if (st.wait !== undefined) { if (this.t >= st.wait) this.next(); return out; }
    if (st.rock) {
      const r = s.rocks.find(r => r.def.id === st.rock);
      const ax = st.axis, v = ax === 'x' ? r.x : r.z;
      if (r.fell && st.to === 999) { this.next(); return out; }
      if (v >= st.to - .02) { this.next(); return out; }
      // stand behind it, centred on its face, then walk into it
      const bx = ax === 'x' ? r.x - 1.0 : r.x, bz = ax === 'z' ? r.z - 1.0 : r.z;
      const off = ax === 'x' ? Math.abs(p.z - r.z) : Math.abs(p.x - r.x);
      if (this.phase === 0 && (Math.hypot(p.x - bx, p.z - bz) > .25 || off > .2)) return this.steer(out, bx, p.y, bz, .5);
      this.phase = 1;
      const tx = ax === 'x' ? r.x + 3 : r.x, tz = ax === 'z' ? r.z + 3 : r.z;
      this.steer(out, tx, p.y, tz, 1);
      return out;
    }
    const [x, y, z] = st;
    const under = p.swim && p.under;
    const dh = Math.hypot(x - p.x, z - p.z);
    const dy = y - (p.y + .9);
    if (dh < .45 && (!p.swim || Math.abs(dy) < .7 || !under && y > p.y)) { this.next(); return this.input(0); }
    return this.steer(out, x, y, z, 1);
  }
  steer(out, x, y, z, speed) {
    const p = this.sim.p;
    const want = Math.atan2(-(x - p.x), -(z - p.z));
    this.yaw += wrap(want - this.yaw) * .25;
    const dh = Math.hypot(x - p.x, z - p.z);
    this.pitch = p.swim ? Math.max(-1.2, Math.min(1.2, Math.atan2(y - (p.y + .9), Math.max(dh, .3)))) : this.pitch * .9;
    out.yaw = this.yaw; out.pitch = this.pitch;
    const ahead = Math.cos(wrap(want - this.yaw));
    out.fz = -speed * Math.max(.2, ahead);
    return out;
  }
}
