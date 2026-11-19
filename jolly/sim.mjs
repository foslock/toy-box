// node jolly/sim.mjs [games] [mode] [host] — plays whole runs with the bot.
// mode: full (bot + gestures), mute (bot, no gestures), solo (host alone)
import { Game, HOST_ORDER, ACTS } from './game.js';
import { makeBot, botInput } from './bot.js';

const N = +(process.argv[2] || 12), mode = process.argv[3] || 'full', only = process.argv[4], skill = +(process.argv[5] || 0.85);
const dt = 1 / 60;
const hosts = only ? [only] : HOST_ORDER;
for (const host of hosts) {
  const res = { won: 0, reach: [0, 0, 0], why: {}, t: [], trust: [], gest: {}, revives: 0, rescues: 0, heeded: 0, ignored: 0, bossT: [[], [], []], hostHurt: {} };
  for (let s = 0; s < N; s++) {
    const g = new Game({ seed: 100 + s, host });
    let r = (s * 7919 + 13) >>> 0; const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 4294967296);
    const m = makeBot({ rnd, skill, gestures: mode === 'full', idle: mode === 'solo' });
    let steps = 0, bossStart = 0;
    while (steps < 60 * 60 * 20) {
      if (g.phase === 'dismissed') break;
      if (g.phase === 'curtain') { if (g.act === ACTS.length - 1) { g.phase = 'won'; break; } g.nextAct(); }
      Object.assign(g.input, botInput(g, m, dt));
      g.step(dt); steps++;
      for (const e of g.events) {
        if (e.t === 'bossIntro') bossStart = g.t;
        if (e.t === 'bossDown') res.bossT[g.act].push(Math.round(g.t - bossStart));
        if (e.t === 'hit' && e.who === 'host') res.hostHurt[e.src] = (res.hostHurt[e.src] || 0) + Math.round(e.dmg);
      }
      g.events.length = 0;
      for (const v of [g.p.x, g.p.y, g.h.x, g.h.y, g.h.hp]) if (!Number.isFinite(v)) { console.log('NaN', host, s, g.t); process.exit(1); }
    }
    res.reach[g.act]++;
    if (g.phase === 'won') res.won++;
    else { if (!g.reason && process.env.V) console.log('TIMEOUT', host, s, g.act, g.phase, 'P', g.p.x|0, g.p.y|0, g.p.state, 'H', g.h.x|0, g.h.y|0, g.h.state, g.h.goal, 'lock', JSON.stringify(g.lock), g.waves.map(w=>w.state+w.at).join(','), g.foes.filter(f=>!f.dead).map(f=>f.type+'@'+(f.x|0)+','+(f.y|0)+f.state).join(' ')); const k = `A${g.act + 1}${g.boss ? 'boss' : ''}: ${g.reason || 'timeout ' + g.phase}`; res.why[k] = (res.why[k] || 0) + 1; }
    res.t.push(Math.round(g.t));
    res.trust.push(Math.round(g.h.trust));
    res.revives += g.stats.revives; res.rescues += g.stats.rescues; res.heeded += g.stats.heeded; res.ignored += g.stats.ignored;
    for (const [k, v] of Object.entries(m.stats.gest)) res.gest[k] = (res.gest[k] || 0) + v;
  }
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : '-'; };
  console.log(`${host} [${mode}] won ${res.won}/${N}  died in act: ${res.reach.join('/')}  median t ${med(res.t)}s  trust ${med(res.trust)}  revives ${res.revives} rescues ${res.rescues} heeded ${res.heeded}/${res.heeded + res.ignored}`);
  console.log('   why:', JSON.stringify(res.why));
  console.log('   boss secs:', res.bossT.map(med).join(' / '), ' gestures:', JSON.stringify(res.gest));
  console.log('   host hurt by:', Object.entries(res.hostHurt).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', '));
}
