// An autopilot: steer for the best thing to eat ahead that can still be reached, and around anything too big.
// skill 1 is sharp; lower skill looks less far ahead, reacts late and wobbles, like a person on a phone.
export function makeBot(skill = 1, seed = 1) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  let target = null, retarget = 0, wob = 0, held = 0;
  return function steer(run, dt) {
    const b = run.ball, C = run.C, inp = run.input;
    const dia = b.r * 2;
    retarget -= dt;
    wob += (rnd() - 0.5) * dt * 4 * (1 - skill);
    wob *= 0.98;
    const vd = Math.max(2, b.vd);
    const A = 6.5 + 1.1 * b.r;
    if (retarget <= 0 || (target && (target.eaten || target.d < b.d - 1))) {
      retarget = 0.15 + (1 - skill) * 0.45;
      const look = (10 + vd * 2.4 + b.r * 5) * (0.6 + 0.4 * skill);
      let best = null, bestS = 0;
      const consider = it => {
        if (it.eaten || it.deco && Math.abs(it.x - b.x) > 30) return;
        const ahead = it.d - b.d;
        if (ahead < b.r * 0.3 || ahead > look) return;
        if (it.need > dia) return;
        const t = ahead / vd;
        const reach = 0.45 * A * t * t + b.r;
        const dx = it.x - (b.x + b.vx * t);
        if (Math.abs(dx) > reach) return;
        const worth = (it.need / dia) ** 1.6 + 0.02;
        const sc = worth / (1 + Math.abs(dx) / (reach + 1)) / (1 + ahead / look);
        if (sc > bestS) { bestS = sc; best = it; }
      };
      for (const it of run.statics) { if (it.d > b.d + look) break; if (it.d > b.d) consider(it); }
      for (const it of run.movers) consider(it);
      target = best;
    }
    // where to go: the target, else the middle of whichever route we're on
    const owner = C.routes[b.owner] || C.routes[0];
    const [cx, w] = C.routeAt(owner, b.d + vd);
    let tx = target ? target.x : cx;
    // steer round anything too big that's in the way: pass it on whichever side the target is, or the nearer side
    const look2 = 4 + vd * 1.3 + b.r * 3;
    for (const it of run.statics) {
      if (it.d < b.d - b.r - it.cr) continue;
      if (it.d > b.d + look2) break;
      if (it.eaten || it.need <= dia || it.pass) continue;
      const t = Math.max(0, it.d - b.d) / vd;
      const px = b.x + b.vx * t;
      const clear = b.r + it.cr + 0.8;
      const lo = it.x - clear, hi = it.x + clear;
      if (tx > lo && tx < hi || px > lo && px < hi) {
        const side = Math.abs(tx - it.x) > 0.5 ? Math.sign(tx - it.x) : Math.sign(px - it.x) || 1;
        tx = side > 0 ? Math.max(tx, hi) : Math.min(tx, lo);
      }
    }
    // keep off the banks
    if (Math.abs(tx - cx) > w * 0.85) tx = cx + Math.sign(tx - cx) * w * 0.85;
    const err = tx - b.x - b.vx * (0.55 + 0.3 * (1 - skill));
    let st = Math.max(-1, Math.min(1, err / (1.5 + b.r * 0.6))) + wob;
    // a person holds the steer a beat too long
    if (skill < 1) { held += dt; if (held < 0.12 * (1 - skill)) st = inp.steer; else held = 0; }
    inp.steer = Math.max(-1, Math.min(1, st));
    inp.brake = 0;
    inp.tuck = 0;
  };
}
