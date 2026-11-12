// Headless balance check: node arewethereyet/sim.mjs [games] [policy]
// policy: good (attentive parent), lazy (never touches anything mid-drive), mid (slow reactions)
import * as G from './game.js';

const N = +process.argv[2] || 64, policy = process.argv[3] || 'good';

function seatUp(s) {
  const P = s.people;
  const drv = ['dad', 'mom', 'tina'].sort((a, b) => P[a].fatigue - P[b].fatigue)[0];
  const order = { drive: drv };
  order.shot = drv === 'mom' ? 'tina' : 'mom';
  const rest = ['dad', 'mom', 'tina', 'kevin', 'jo'].filter(id => id !== order.drive && id !== order.shot);
  for (const id of Object.keys(P)) P[id].seat = null;
  P[order.drive].seat = 'drive'; P[order.shot].seat = 'shot';
  // Kevin to the way-back, others on the bench ends
  const benches = ['benchL', 'benchR', 'benchM'];
  for (const id of rest) P[id].seat = id === 'kevin' ? 'wayback' : benches.shift();
}

function pickEdge(s) {
  const es = G.nextEdges(s);
  const score = e => {
    const n = s.map.nodes[e.b];
    let v = e.road === 'scenic' ? 2 : 0;
    if (n.type === 'gas' && (s.gas < 0.55 || s.snacks < 5 || s.car < 60)) v += 6;
    if (n.type === 'diner' && s.cash > 60) v += 3;
    if (n.type === 'attraction' && s.cash > 70) v += 4;
    if (n.type === 'motel') v += n.motel.price <= s.cash - 40 ? n.motel.mood / 4 : 0;
    return v + s.r() * 2;
  };
  return es.sort((a, b) => score(b) - score(a))[0];
}

function atStop(s) {
  const st = s.stop;
  if (st.event && !st.result) {
    const ok = st.event.choices.map((c, i) => [c, i]).filter(([c]) => G.choiceOK(s, c) === null);
    G.choose(s, ok[Math.floor(s.r() * ok.length)][1]);
  }
  const sv = id => G.services(s).find(o => o.id === id && !o.off);
  if (s.gas < 0.6 && sv('fill')) G.buy(s, 'fill');
  if (s.snacks < 8 && sv('snacks')) G.buy(s, 'snacks');
  if (s.snacks < 8 && sv('snacks')) G.buy(s, 'snacks');
  if (s.car < 60 && s.cash > 90 && sv('tune')) G.buy(s, 'tune');
  if (s.cash > 70 && sv('eat') && Object.values(s.people).some(p => p.hunger > 0.4)) G.buy(s, 'eat');
  if (sv('coffee')) G.buy(s, 'coffee');
  if (s.cash > 60 && sv('see')) G.buy(s, 'see');
  if (sv('look')) G.buy(s, 'look');
  if (sv('room') && s.cash - G.services(s).find(o => o.id === 'room').cost > 50) G.buy(s, 'room');
  else if (sv('carsleep')) G.buy(s, 'carsleep');
  seatUp(s);
}

const TAPEFOR = s => {
  const ps = G.seated(s).filter(p => p.seat !== 'drive');
  let best = null, bv = -1e9;
  for (const t of [null, ...s.tapes]) {
    let v = 0;
    for (const p of ps) v += (G.likes(p, t) ? 1 : G.hates(p, t) ? -0.6 : 0) * (0.2 + p.bore);
    if (v > bv) { bv = v; best = t; }
  }
  return best;
};

function driveAI(s, react) {
  if (policy === 'lazy') return;
  if (s.mode === 'breakdown') {
    const pr = s.bd.problems;
    for (const p of Object.values(s.people)) {
      const open = pr.map((x, i) => [x, i]).filter(([x]) => x.work < 1);
      if (!open.length) break;
      if (pr.some(x => x.crew.includes(p.id) && x.work < 1)) continue;
      const mine = open.find(([x]) => x.type === p.fix) || open.find(([x]) => x.crew.length < (p.id === 'jo' ? 2 : 1)) || open[0];
      G.assignFix(s, p.id, mine[1]);
    }
    return;
  }
  for (const p of G.seated(s)) if (p.hunger >= react) G.giveSnack(s, p.id);
  const pee = G.seated(s).filter(p => p.bladder > 0.6);
  if (pee.some(p => p.bladder > 0.85) || pee.length >= 2) G.pullOver(s);
  G.setTape(s, TAPEFOR(s));
  if (s.fight) { const k = s.people.kevin; G.moveSeat(s, 'kevin', k.seat === 'wayback' ? 'benchM' : 'wayback'); }
}

const res = []; const CS = {};
for (let g = 0; g < N; g++) {
  const s = G.newGame(1000 + g);
  seatUp(s);
  let steps = 0, legMorale = [];
  while (!s.over && s.mode !== 'end' && steps < 200000) {
    steps++;
    if (s.mode === 'stop') { atStop(s); if (s.mode === 'end' || s.over) break; const m0 = s.morale; G.startLeg(s, pickEdge(s)); legMorale.push(m0 + "@" + s.clock.toFixed(0)); continue; }
    const react = policy === 'mid' ? 0.85 : 0.68;
    if (steps % (policy === 'mid' ? 30 : 5) === 0) driveAI(s, react);
    if (s.mode === 'drive' && !s.leg.pulled) for (const p of G.seated(s)) for (const c of G.complaints(s, p)) CS[c] = (CS[c] || 0) + 1 / 30;
    if (s.mode === 'breakdown') CS.breakdown = (CS.breakdown || 0) + 1 / 30;
    if (process.env.DBG && g === +process.env.DBG && steps % 30 === 0) console.log(s.mode, s.leg?.to.col, s.morale.toFixed(1), s.clock.toFixed(1), G.seated(s).map(p => p.id[0] + ":" + G.complaints(s, p).join("+")).join(" "), s.snacks);
    G.tick(s, 1 / 30);
  }
  res.push({ over: s.over, score: s.result?.score ?? 0, morale: Math.round(s.morale), cash: s.cash, day: s.day, clock: s.clock.toFixed(1), photos: s.polaroids.length, onTime: s.result?.onTime, stats: s.stats, legs: legMorale.map(x => typeof x === "number" ? Math.round(x) : x.replace(/\.\d+@/, "@")).join(' ') });
}
const wins = res.filter(r => !r.over);
const avg = (a, f) => (a.reduce((x, r) => x + f(r), 0) / Math.max(1, a.length)).toFixed(1);
console.log(`${policy}: ${wins.length}/${N} arrive  avgScore ${avg(wins, r => r.score)}  morale ${avg(wins, r => r.morale)}  cash ${avg(wins, r => r.cash)}  photos ${avg(wins, r => r.photos)}  onTime ${wins.filter(r => r.onTime).length}`);
console.log('losses:', res.filter(r => r.over).map(r => r.over).join(' '));
for (const k of Object.keys(res[0].stats)) console.log('  ', k, avg(res, r => r.stats[k]));
console.log('complaint-seconds per game:', Object.entries(CS).map(([k, v]) => k + ' ' + (v / N).toFixed(1)).join(', '));
console.log('sample morale by leg:', res.slice(0, 4).map(r => r.legs).join('\n  '));
console.log('arrival clocks:', wins.slice(0, 12).map(r => `d${r.day} ${r.clock}`).join(', '));
