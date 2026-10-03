// Headless checks for Ladder: node ladder/check.mjs [--map out.svg] [--fast]
//   - the ladder's statics: which angles hold on which materials when climbed carefully, and fast
//   - every ledge on the heap, and which ladder placements lead from it to which others (the real game, headless)
//   - the top can be reached from the van, and no ledge you can land on is a dead end
//   - how wide each step's window is (how many angles work), to see where it's hard
import { writeFileSync } from 'node:fs';
import { buildHeap } from './heap.js';
import { solve, distances, tryLadder } from './route.js';
import { poly, World, Sim, LADDER, capsuleHits } from './physics.js';
import { MATS } from './junk.js';

const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? (process.argv[i + 1] ?? true) : null; };
let bad = 0; const fail = m => { bad++; console.log('  FAIL', m); };

if (!arg('skip-statics')) statics();

const heap = buildHeap();
for (const o of heap.overlaps) fail('overlap: ' + o);
const t0 = performance.now();
const sol = solve(heap, { step: arg('fast') ? 4 : 2, every: arg('plan') ? 1 : arg('fast') ? 3 : 2 });
const ms = performance.now() - t0;
const L = sol.ledges.list;
const goal = l => heap.summit && l.spots.some(s => s.x >= heap.summit.x0 && s.x <= heap.summit.x1 && s.y >= heap.summit.y0 - 0.1);
const dist = distances(sol, goal);
const start = sol.ledges.at(heap.start.x, heap.start.y);
console.log(`\n${L.length} ledges, ${sol.edges.filter(e => !e.hop).length} ladder links, solved in ${(ms / 1000).toFixed(1)}s`);
console.log(`start: ledge ${start?.id}; placements to the top from there: ${dist[start?.id]}`);
if (!start || !isFinite(dist[start.id])) fail('the top cannot be reached from the start');

// the best way up from each ledge on the main line
const out = new Map(); for (const e of sol.edges) (out.get(e.from) || out.set(e.from, []).get(e.from)).push(e);
let cur = start, n = 0, path = [];
while (cur && dist[cur.id] > 0 && n++ < 80) {
  const opts = (out.get(cur.id) || []).filter(e => dist[e.to] < dist[cur.id]).sort((a, b) => dist[a.to] - dist[b.to] || b.tries.length - a.tries.length);
  const e = opts[0]; if (!e) break;
  const to = L[e.to], degs = e.tries.map(t => t.deg), xs = e.tries.map(t => t.x);
  path.push(e);
  console.log(`  ${String(cur.id).padStart(3)} ${cur.name.padEnd(26)} y${cur.y.toFixed(1).padStart(5)} → ${String(to.id).padStart(3)} ${to.name.padEnd(26)} y${to.y.toFixed(1).padStart(5)}  ${e.hop ? 'hop' : `${e.tries.length} ways, rests ${Math.min(...e.tries.map(t => t.rest))}–${Math.max(...e.tries.map(t => t.rest))}°, x ${Math.min(...xs).toFixed(1)}…${Math.max(...xs).toFixed(1)}`}`);
  cur = to;
}
// dead ends: a ledge you could end up on with no way to the top
const traps = L.filter(l => !isFinite(dist[l.id]) && l.spots.length >= 2 && l.y < heap.top + 1);
for (const t of traps) fail(`dead end: ledge ${t.id} on ${t.name} at y ${t.y.toFixed(1)}, x ${t.x0.toFixed(1)}…${t.x1.toFixed(1)}`);
if (arg('edges')) for (const l of L) { const es = (out.get(l.id) || []).filter(e => !e.hop); console.log(`  ledge ${String(l.id).padStart(3)} ${l.name.padEnd(24)} y${l.y.toFixed(1).padStart(5)} x ${l.x0.toFixed(1)}…${l.x1.toFixed(1)}  d=${dist[l.id]}  → ${es.map(e => `${e.to}[${e.tries.length}: rests ${Math.min(...e.tries.map(t => t.rest))}-${Math.max(...e.tries.map(t => t.rest))}°, x ${Math.min(...e.tries.map(t => t.x)).toFixed(1)}…${Math.max(...e.tries.map(t => t.x)).toFixed(1)}]`).join(' ')}`); }
// the plan for the autoplay bot: for every ledge that leads to the top, the steadiest placement onto its next ledge
if (arg('plan')) {
  const plan = [];
  for (const l of L) {
    if (!isFinite(dist[l.id]) || dist[l.id] === 0) continue;
    const opts = (out.get(l.id) || []).filter(e => !e.hop && dist[e.to] < dist[l.id]).sort((a, b) => dist[a.to] - dist[b.to] || b.tries.length - a.tries.length);
    const e = opts[0]; if (!e) continue;
    // the try with the most working neighbours (nearby spots and aims) is the least fussy
    const lean = t => Math.abs(90 - Math.abs(90 - t.rest));   // degrees from horizontal, whichever way it leans
    const score = t => e.tries.filter(u => Math.abs(u.x - t.x) < 0.65 && Math.abs(u.deg - t.deg) <= 4).length - Math.abs(lean(t) - 74) * 0.3;
    // of the likeliest, take one that still works standing a little to either side, climbed at the bot's pace
    const ranked = e.tries.slice().sort((a, b) => score(b) - score(a));
    const holds = t => [-0.05, 0, 0.05].every(dx => { const r = tryLadder(heap, t.x + dx, t.y, t.deg, 0.9); return r.ok && sol.ledges.at(r.x, r.y)?.id === e.to; });
    const best = ranked.slice(0, 30).find(holds) || ranked[0];
    plan.push({ id: l.id, spots: l.spots.map(s => [+s.x.toFixed(2), +s.y.toFixed(2)]), x: +best.x.toFixed(2), aim: best.deg, to: e.to, d: dist[l.id] });
  }
  writeFileSync(new URL('./plan.js', import.meta.url), '// Ladder: made by check.mjs --plan. For each ledge on the way up, where the autoplay bot stands and aims.\nexport const PLAN = ' + JSON.stringify(plan) + ';\n');
  console.log('plan →', plan.length, 'ledges');
}
// how far a fall goes from each step of the main line: climb its planned placement too fast (it tips back),
// and lean it too shallow (the foot slides out), and see where the painter ends up
if (arg('falls')) {
  const { Game } = await import('./game.js');
  console.log('\nFalls from each step (metres lost: rushed / too shallow):');
  for (const e of path) {
    if (e.hop) continue;
    const t = e.tries[Math.floor(e.tries.length / 2)], from = L[e.from];
    const { groundAt } = await import('./physics.js');
    const run = (x, deg, speed) => {
      const gr = groundAt(heap.world, x, t.y + 0.3, t.y - 0.3); if (!gr) return '  -  ';
      const g = new Game(heap); g.p.x = x; g.p.y = gr.y; g.p.face = Math.cos(deg * Math.PI / 180) >= 0 ? 1 : -1; g.carryPose(true);
      g.aimStart(); g.aimA = deg * Math.PI / 180; g.aimPose = g.place(g.aimA); if (g.aimEnd() !== 'planted') return '  -  ';
      g.mount(); let lost = null;
      for (let i = 0; i < 60 * 40; i++) { if (g.mode === 'climb') g.climbBy(speed / 60); g.tick(); for (const ev of g.drain()) if (ev.type === 'land') lost = ev.lost; if (g.mode === 'stepoff' || (lost != null && g.mode === 'stand')) break; }
      return g.mode === 'stepoff' || g.mode === 'haul' ? '  ok ' : (lost != null ? lost.toFixed(1) : '  ?  ').padStart(5);
    };
    const away = t.rest < 90 ? -1 : 1;   // the foot moves this way to lean it shallower
    console.log(`  ${from.name.padEnd(24)} y${from.y.toFixed(1).padStart(6)}  rushed ${run(t.x, t.deg, 3.0)}   shallow ${run(t.x + away * 0.8, t.deg, 0.9)}   very shallow ${run(t.x + away * 1.5, t.deg, 0.9)}`);
  }
}
const mapOut = arg('map'); if (mapOut) { writeFileSync(mapOut, svg(heap, sol, dist, path)); console.log('map →', mapOut); }
console.log(bad ? `\n${bad} problem(s)` : '\nall good');
process.exit(bad ? 1 : 0);

function statics() {
  console.log('Statics: a ladder against a corner, climbed at 0.9 m/s (and at 2.2 m/s), by angle and friction');
  const box = (x0, y0, x1, y1, mu) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { mu });
  const mus = [['enamel', MATS.enamel.mu], ['gloss', MATS.gloss.mu], ['steel', MATS.steel.mu], ['wood', MATS.wood.mu], ['rubber', MATS.rubber.mu]];
  console.log('deg    ' + mus.map(([n]) => n.padEnd(14)).join(''));
  for (const deg of [50, 60, 66, 72, 76, 80, 83, 86]) {
    const row = mus.map(([, mu]) => [0.9, 2.2].map(sp => trial(deg, mu, sp)).join(' ').padEnd(14)).join('');
    console.log(String(deg).padEnd(7) + row);
  }
  function trial(deg, mu, speed) {
    const a = deg * Math.PI / 180, ground = box(-20, -2, 20, 0, mu), cx = Math.cos(a) * 3.9, cy = Math.sin(a) * 3.9;
    const w = new World([ground, box(cx + 0.12 / Math.sin(a), -1, cx + 3, cy, mu)]);
    const lad = { fx: 0, fy: LADDER.r + 0.002, a, vx: 0, vy: 0, w: 0 };
    for (let d = 0; d <= 89; d += 0.05) { const aa = (90 - d) * Math.PI / 180; if (capsuleHits(w, 0, lad.fy, Math.cos(aa) * LADDER.L, lad.fy + Math.sin(aa) * LADDER.L, LADDER.r - 0.001, ground)) { lad.a = (90 - d + 0.1) * Math.PI / 180; break; } }
    const sim = new Sim(w), rider = { s: 0, side: 1 }, a0 = lad.a; let last = 0;
    for (let t = 0; t < 8; t += 1 / 240) {
      rider.s = Math.min(3.6, rider.s + speed / 240);
      const r = Math.floor(rider.s / 0.3); let kick = 0;
      if (r !== last) { last = r; kick = 0.34 * Math.max(0, speed - 0.6) ** 1.5; }
      sim.step(lad, rider, null, null, 1 / 240, kick);
      if (Math.abs(lad.w) > 1.4 || Math.abs(lad.a - a0) > 0.2 || Math.hypot(lad.vx, lad.vy) > 1.5) return lad.a > a0 ? 'TIP' : 'slp';
    }
    return ' ok';
  }
}

function svg(heap, sol, dist, path) {
  const S = +(arg('scale') || 16), x0 = +(arg('x0') || -30), x1 = +(arg('x1') || 30), y1 = heap.top + 6, W = (x1 - x0) * S, H = (y1 + 2) * S;
  const X = x => ((x - x0) * S).toFixed(1), Y = y => ((y1 - y) * S).toFixed(1);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#f4ead6;font:10px sans-serif">`;
  for (let y = 0; y <= y1; y += 5) s += `<line x1="0" x2="${W}" y1="${Y(y)}" y2="${Y(y)}" stroke="#0001"/><text x="2" y="${Y(y) - 2}" fill="#0006">${y}</text>`;
  for (const P of heap.polys) { if (P.obj?.k === 'ground' || P.obj?.k === 'wall') continue; const pts = []; for (let i = 0; i < P.n; i++) pts.push(`${X(P.x[i])},${Y(P.y[i])}`); const c = { enamel: '#9cc', gloss: '#c9c', steel: '#aab', rust: '#c97', wood: '#db8', rubber: '#555', cloth: '#9b9', paint: '#9ad', plastic: '#ccc' }[P.mat.id] || '#bbb'; s += `<polygon points="${pts.join(' ')}" fill="${c}" stroke="#0005" stroke-width="0.6"/>`; }
  for (const L of sol.ledges.list) {
    const d = dist[L.id], col = !isFinite(d) ? '#d22' : '#282';
    s += `<polyline points="${L.spots.map(p => `${X(p.x)},${Y(p.y)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2.5"/>`;
    s += `<text x="${X((L.x0 + L.x1) / 2)}" y="${Y(L.y) - 3}" fill="${col}" text-anchor="middle">${L.id}${isFinite(d) ? '·' + d : ''}</text>`;
  }
  for (const e of sol.edges) {
    if (e.hop) continue;
    const a = sol.ledges.list[e.from], b = sol.ledges.list[e.to], on = path.includes(e);
    s += `<line x1="${X(e.tries[0].x)}" y1="${Y(e.tries[0].y)}" x2="${X((b.x0 + b.x1) / 2)}" y2="${Y(b.y)}" stroke="${on ? '#14c' : '#14c3'}" stroke-width="${on ? 2 : 1}"/>`;
  }
  if (heap.summit) s += `<rect x="${X(heap.summit.x0)}" y="${Y(heap.summit.y1)}" width="${(heap.summit.x1 - heap.summit.x0) * S}" height="${(heap.summit.y1 - heap.summit.y0) * S}" fill="none" stroke="#e80" stroke-width="2"/>`;
  return s + '</svg>';
}
