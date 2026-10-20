// Flight School: three planetoids, one cadet, a few cardboard aliens. Each step teaches one thing by doing it.
import { World, PALETTES, rng, TROOP_R } from './world.js';
import { Game } from './game.js';

export function buildSchool(W, H) {
  const w = new World(W, H), horiz = W >= H, md = Math.min(W, H), rand = rng(11);
  const P = (l, s) => horiz ? { x: l * W, y: s * H } : { x: s * W, y: l * H };
  const a = P(0.2, 0.6), b = P(0.5, 0.36), c = P(0.8, 0.58);
  const A = w.addPlanet(a.x, a.y, md * 0.17, PALETTES[3], rand);
  const B = w.addPlanet(b.x, b.y, md * 0.09, PALETTES[1], rand);
  const C = w.addPlanet(c.x, c.y, md * 0.15, PALETTES[2], rand);
  w.horiz = horiz;
  const g = new Game({ mode: 'tutorial', world: w, empty: true, seed: 5, walkMax: 9999 });
  const toward = (p, q) => Math.atan2(q.y - p.y, q.x - p.x);
  const base = toward(A, B) - 0.95;
  const at = (p, ang) => g.placeOn(p, ang);
  const start = at(A, base);
  const cadet = g.addTroop(0, 'Cadet Bix', start.x, start.y);
  cadet.home = { ...start };
  cadet.facing = 1;
  g.cur = cadet; g.teamTurn = 0;
  const school = { game: g, A, B, C, cadet, base, toward, at };
  school.steps = steps(school);
  return school;
}

function dummy(s, p, ang) {
  const q = s.at(p, ang);
  return s.game.addTroop(2, 'target', q.x, q.y, 1);
}

function steps(s) {
  const g = s.game, { A, B, C, cadet } = s;
  const nearest = t => [A, B, C].reduce((best, p) => Math.hypot(t.x - p.x, t.y - p.y) - p.r < Math.hypot(t.x - best.x, t.y - best.y) - best.r ? p : best, A);
  return [
    {
      text: 'This is <b>Cadet Bix</b>. Put your finger (or mouse) anywhere, <b>drag back</b> like a slingshot, and <b>let go</b> to fire. Knock over the cardboard alien.',
      retry: 'Close! Drag further back for more power, or swing round for a different angle.',
      begin() { this.d = dummy(s, A, s.base + 0.95); g.weapon = 'shell'; },
      mark() { return [{ kind: 'ring', x: this.d.x, y: this.d.y, r: 14 }]; },
      done() { return this.d.dead; },
    },
    {
      text: 'Every planetoid pulls on your shells, so <b>shots bend</b>. Hit the alien on the green world. The dotted line only shows the <b>start</b> of the flight.',
      retry: 'Watch where it curved, then nudge your aim. Small changes go a long way out here.',
      begin() { this.d = dummy(s, C, s.toward(C, A) + 0.35); },
      mark() { return [{ kind: 'ring', x: this.d.x, y: this.d.y, r: 14 }]; },
      done() { return this.d.dead; },
    },
    {
      text: 'You can walk a little each turn. Hold the <b>arrow buttons</b> (or <b>A</b> and <b>D</b>) and walk to the yellow flag.',
      glow: ['walkL', 'walkR'],
      begin() { this.f = s.at(A, s.base - 1.05); },
      mark() { return [{ kind: 'flag', x: this.f.x, y: this.f.y }]; },
      done() { return !cadet.air && Math.hypot(cadet.x - this.f.x, cadet.y - this.f.y) < 15; },
      end() { cadet.home = { x: cadet.x, y: cadet.y }; },
    },
    {
      text: 'Pick the <b>Drill</b>. It bores straight through rock and bursts on the far side. Get the alien hiding behind the little purple moon.',
      retry: 'Aim the drill at the purple moon, so it can tunnel through toward the alien.',
      glow: ['drill'],
      begin() { this.d = dummy(s, B, s.toward(B, A) + Math.PI + 0.25); },
      mark() { return [{ kind: 'ring', x: this.d.x, y: this.d.y, r: 14 }]; },
      done() { return this.d.dead; },
    },
    {
      text: 'The <b>Jetpack</b> aims like a shot, but you are the shell. Pick it and fly over to the green world. (You can still fire after you land.)',
      retry: 'Not quite. Try again: Flight School has plenty of fuel.',
      glow: ['jet'],
      begin() { const q = s.at(C, s.toward(C, A) - 0.4); this.ring = q; g.weapon = 'jet'; },
      mark() { return [{ kind: 'ring', x: this.ring.x, y: this.ring.y, r: 26 }]; },
      done() { return !cadet.flying && !cadet.air && g.phase === 'aim' && nearest(cadet) === C && Math.hypot(cadet.x - C.x, cadet.y - C.y) < C.r + 30; },
      end() { cadet.home = { x: cadet.x, y: cadet.y }; },
    },
    {
      text: 'Last thing. A shell still flying after six seconds goes <b>into orbit</b> and can come back down turns later, on anyone. The <b>G-Mine</b> sticks where it lands and drags passing shots off course. And if you blast someone <b>off the edge</b> of the system, they\'re gone for good. You\'re ready.',
      final: true,
      begin() {},
      mark() { return []; },
      done() { return false; },
    },
  ];
}
