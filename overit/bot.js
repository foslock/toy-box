// A pinball player for the demo and for balance sims: catch, cradle, let it roll, flip at a chosen spot.
import { flipperTip, R } from './engine.js';

export function makeBot(opts = {}) {
  return {
    mode: 'watch', timer: 0, side: -1, aim: 0.5, fireT: 0,
    pickAim: opts.pickAim || (() => 0.25 + Math.random() * 0.6),
    jitter: opts.jitter ?? 0,
    delay: opts.delay || 0,      // reaction time before holding a flipper up
    flail: opts.flail || 0,      // chance of just flipping at the ball instead of catching it
    wait: 0,
    shots: 0,
  };
}

// Sets f.held on the table's flippers for one STEP.
export function botStep(bot, t, dt) {
  const b = t.ball, [fl, fr] = t.flippers;
  if (!b.live) { fl.held = fr.held = false; bot.mode = 'watch'; return; }
  const sp = Math.hypot(b.vx, b.vy);
  const side = b.x < 180 ? -1 : 1;
  const f = side < 0 ? fl : fr;
  bot.timer += dt;
  if (bot.mode === 'watch') {
    fl.held = fr.held = false;
    // catch anything coming down toward the flippers
    if (b.y > 440 && b.vy > -50) {
      bot.wait += dt;
      if (bot.wait < bot.delay) return;
      bot.wait = 0;
      if (Math.random() < bot.flail) { bot.mode = 'fire'; bot.side = side; bot.timer = 0; bot.shots++; f.held = true; return; }
      f.held = true; bot.mode = 'catch'; bot.side = side; bot.timer = 0;
    } else bot.wait = 0;
  } else if (bot.mode === 'catch') {
    const g = bot.side < 0 ? fl : fr;
    fl.held = fr.held = false; g.held = true;
    if (b.y < 420 && b.vy < 0) { bot.mode = 'watch'; return; }
    if ((b.x < 180 ? -1 : 1) !== bot.side && b.y > 470) { bot.side = -bot.side; bot.timer = 0; }
    const [ux, uy] = flipperTip(g);
    const cu = ((b.x - g.px) * (ux - g.px) + (b.y - g.py) * (uy - g.py)) / (g.len * g.len);
    if (sp < 30 && b.y > 480 && cu < 0.35) {
      if (bot.timer > 0.35) { bot.mode = 'roll'; bot.aim = bot.pickAim(t, bot.side) + (Math.random() - 0.5) * bot.jitter; bot.timer = 0; g.held = false; }
    } else bot.timer = Math.min(bot.timer, 0.2);
    if (bot.timer > 6) bot.mode = 'watch';
  } else if (bot.mode === 'roll') {
    const g = bot.side < 0 ? fl : fr;
    g.held = false;
    const [tx, ty] = flipperTip(g);
    const dx = tx - g.px, dy = ty - g.py;
    const u = ((b.x - g.px) * dx + (b.y - g.py) * dy) / (g.len * g.len);
    if (u >= bot.aim || bot.timer > 1.2) { bot.mode = 'fire'; bot.timer = 0; bot.shots++; }
  } else if (bot.mode === 'fire') {
    const g = bot.side < 0 ? fl : fr;
    g.held = true;
    if (bot.timer > 0.28) { g.held = false; bot.mode = 'watch'; bot.timer = 0; }
  }
}
