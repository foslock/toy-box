// One microgame in play: seeded state, the clock, particles, and the autoplay hand.
// No DOM here, so sim.mjs can run it in Node.

export const BASE_DUR = 4.4;

export function makeGame(def, o = {}) {
  let s = (o.seed >>> 0) || 1;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const g = {
    def, W: 480, H: 480, t: 0, rt: 0, dur: def.dur ?? BASE_DUR, d: o.d || 0,
    // bosses are long, so they only take half the speed-up
    speed: def.boss ? 1 + ((o.speed || 1) - 1) * .5 : (o.speed || 1),
    result: null, resT: 0, timeout: false, noTimer: !!o.noTimer, parts: [],
    rnd, ri: (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick: a => a[Math.floor(rnd() * a.length)],
    shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    win() { if (!g.result) { g.result = 'win'; g.resT = g.t; } },
    lose() { if (!g.result) { g.result = 'lose'; g.resT = g.t; } },
    sfx: o.sfx || (() => {}), squeal: o.squeal || (() => {}),
    burst(x, y, cols, n = 10, spd = 200) {
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, v = spd * (.3 + rnd() * .7);
        g.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * .3, life: .5 + rnd() * .4, age: 0, col: cols[i % cols.length], r: 3 + rnd() * 4 });
      }
    },
  };
  def.init(g);
  return g;
}

// dt is real seconds; the game clock runs at g.speed
export function step(g, dt) {
  const gd = dt * g.speed;
  g.rt += dt; g.t += gd;
  g.def.tick?.call(g.def, g, gd);
  for (const p of g.parts) { p.age += gd; p.x += p.vx * gd; p.y += p.vy * gd; p.vy += 600 * gd; }
  if (g.parts.length) g.parts = g.parts.filter(p => p.age < p.life);
  if (!g.result && !g.noTimer && g.t >= g.dur) {
    g.timeout = true;
    if (g.def.survive) g.win(); else g.lose();
  }
}

export function input(g, type, x, y) {
  if (g.result && type === 'down') return;
  g.def[type]?.call(g.def, g, x, y);
}

// The autoplayer: asks the game's bot for a gesture, then performs it at human-ish speed.
export class Hand {
  constructor(react = .28, speed = 1100) { this.react = react; this.speed = speed; this.wait = react; this.job = null; this.x = 240; this.y = 240; this.down = false; }
  update(g, dt) {
    if (g.result) { if (this.down) { input(g, 'up', this.x, this.y); this.down = false; } return; }
    if (!this.job) {
      if ((this.wait -= dt) > 0) return;
      const gest = g.def.bot?.call(g.def, g);
      if (!gest) return;
      this.job = this.plan(gest); this.job.react = gest.react;
    }
    const j = this.job;
    j.t += dt;
    while (j.i < j.steps.length && j.steps[j.i].at <= j.t) {
      const s = j.steps[j.i++];
      this.x = s.x; this.y = s.y;
      if (s.type === 'down') this.down = true;
      if (s.type === 'up') this.down = false;
      input(g, s.type, s.x, s.y);
      if (g.result) break;
    }
    if (j.i >= j.steps.length) { this.job = null; this.wait = j.react ?? this.react; }
  }
  plan(gest) {
    const steps = [];
    if (gest.tap) { const [x, y] = gest.tap; steps.push({ at: 0, type: 'down', x, y }, { at: .05, type: 'up', x, y }); }
    else if (gest.taps) { gest.taps.forEach(([x, y], i) => { const t = i * (gest.gap || .1); steps.push({ at: t, type: 'down', x, y }, { at: t + .03, type: 'up', x, y }); }); }
    else if (gest.drag) {
      const pts = gest.drag, sp = gest.speed || this.speed;
      let t = 0; steps.push({ at: 0, type: 'down', x: pts[0][0], y: pts[0][1] });
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 18));
        const seg = Math.hypot(bx - ax, by - ay) / sp;
        for (let k = 1; k <= n; k++) steps.push({ at: t + seg * k / n, type: 'move', x: ax + (bx - ax) * k / n, y: ay + (by - ay) * k / n });
        t += seg;
      }
      const [lx, ly] = pts[pts.length - 1];
      steps.push({ at: t + .03, type: 'up', x: lx, y: ly });
    }
    return { steps, i: 0, t: 0 };
  }
}
