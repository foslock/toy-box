// Headless descents with the bot, for tuning: how far it gets, how much each fight costs, how often it wins.
//
//   node harrowing/check.mjs            → 300 runs
//   node harrowing/check.mjs 1000       → that many
//   node harrowing/check.mjs 50 -v      → and a line per fight
//   node harrowing/check.mjs --fights   → just every fight in the game, 200 times each with a starter-ish deck
import { Run, ROWS, blessingChoices, BLESSINGS } from './run.js';
import { Battle } from './engine.js';
import { Bot } from './bot.js';
import { pickEvent } from './events.js';
import { ENCOUNTERS, ELITES, ACTS, ENEMIES } from './enemies.js';
import { CARDS, makeCard } from './cards.js';

const args = process.argv.slice(2);
const V = args.includes('-v');
const N = +args.find(a => /^\d+$/.test(a)) || 300;

async function fight(run, enemies, kind, bot, seed) {
  const b = new Battle({ run, enemies, kind, seed, io: bot });
  const res = await b.start();
  run.stats.scorched += b.stats.scorched; run.stats.offered += b.stats.offered;
  return { res, b };
}

async function descend(seed, log) {
  const bot = new Bot();
  const run = new Run(seed);
  const choice = blessingChoices(run)[0];
  const bl = BLESSINGS[choice];
  if (bl.apply) bl.apply(run);
  else if (bl.pick === 'rare') run.addCard(run.cardChoices('boss', 1)[0]);
  else if (bl.pick === 'remove') run.removeCard(bot.removeTarget(run));
  const perFight = [];
  for (;;) {
    const choices = run.choices();
    const n = choices.length === 1 && choices[0].type === 'boss' ? choices[0] : bot.pickNode(run, choices);
    run.moveTo(n);
    const type = n.type;
    if (type === 'fight' || type === 'elite' || type === 'boss') {
      const enc = run.encounter(type);
      const hp0 = run.hp;
      const { res, b } = await fight(run, enc.enemies, enc.kind, bot, seed * 31 + run.floor);
      perFight.push({ act: run.act, kind: enc.kind, enemies: enc.enemies.join('+'), lost: hp0 - run.hp, turns: b.turn, win: res === 'win' });
      if (log) console.log(`  A${run.act + 1} r${n.row} ${enc.kind.padEnd(5)} ${enc.enemies.join('+').padEnd(28)} hp ${hp0}→${run.hp} turns ${b.turn} deck ${run.deck.length}`);
      if (res !== 'win') return { win: false, act: run.act, row: n.row, floor: run.floor, perFight, run };
      for (const c of run.charms) (await import('./charms.js')).CHARMS[c].fightEnd?.(run);
      const rw = run.rewards(enc.kind);
      run.obols += rw.obols;
      const pick = bot.pickCard(run, rw.cards); if (pick) run.addCard(pick);
      if (rw.charm) run.addCharm(rw.charm);
      if (type === 'boss') {
        run.stats.bosses++;
        if (run.act === 2) return { win: true, act: 2, floor: run.floor, perFight, run };
        run.addCharm(bot.bossCharm(run, rw.bossCharms));
        run.heal(Math.round((run.maxHp - run.hp) * .75));
        run.nextAct();
      }
    } else if (type === 'rest') {
      if (bot.restChoice(run) === 'rest') run.heal(run.restHeal());
      else { const t = bot.blessTarget(run); if (t) run.bless(t); }
    } else if (type === 'shop') {
      bot.shop(run, run.shopStock());
    } else if (type === 'treasure') {
      run.addCharm(run.randomCharm());
    } else if (type === 'event') {
      if (run.charms.includes('pilgrimStaff')) run.heal(8);
      const e = pickEvent(run);
      const ch = bot.eventChoice(run, e.choices(run));
      const out = ch.go(run);
      if (out.pick === 'remove') for (let i = 0; i < (out.n ?? 1); i++) run.removeCard(bot.removeTarget(run));
      if (out.pick === 'bless') { const t = bot.blessTarget(run); if (t) run.bless(t); }
      if (out.pick === 'transform') for (let i = 0; i < (out.n ?? 1); i++) run.transform(bot.removeTarget(run));
      if (out.pick === 'copy') { const t = bot.blessTarget(run); if (t) run.addCard(makeCard(t.id, t.plus)); }
      if (out.cards) { const p = bot.pickCard(run, out.cards); if (p) run.addCard(p); }
      if (out.fight) {
        const hp0 = run.hp;
        const { res } = await fight(run, out.fight.enemies, out.fight.kind, bot, seed * 37 + run.floor);
        if (res !== 'win') return { win: false, act: run.act, row: n.row, floor: run.floor, perFight, run };
        run.addCharm(run.randomCharm());
        if (log) console.log(`  event fight ${out.fight.enemies} hp ${hp0}→${run.hp}`);
      }
      if (run.hp <= 0) return { win: false, act: run.act, row: n.row, floor: run.floor, perFight, run };
    }
  }
}

if (args.includes('--fights')) {
  // every encounter on its own, with a lightly built deck for its act
  const bot = new Bot();
  const decks = [
    [],
    ['searingLight', 'consecrate', 'disarm', 'shieldFaith', 'hymn', 'flamingSword', 'rebuke'],
    ['searingLight', 'consecrate', 'disarm', 'shieldFaith', 'hymn', 'flamingSword', 'rebuke', 'pillarFire', 'guardianWings', 'hosanna', 'archSpear', 'manna'],
  ];
  const list = [];
  for (let act = 0; act < 3; act++) {
    for (let c = act * 3; c < act * 3 + 3; c++) for (const e of [...(ENCOUNTERS[c].early ?? []), ...ENCOUNTERS[c].normal]) list.push({ act, enemies: e, kind: 'fight' });
    for (const e of ELITES[act]) list.push({ act, enemies: e, kind: 'elite' });
    for (const e of ACTS[act].boss) list.push({ act, enemies: e, kind: 'boss' });
  }
  for (const f of list) {
    let lost = 0, wins = 0, turns = 0;
    const T = 200;
    for (let i = 0; i < T; i++) {
      const run = new Run(1000 + i);
      for (const id of decks[f.act]) run.addCard(makeCard(id));
      run.maxHp = run.hp = 72;
      const b = new Battle({ run, enemies: f.enemies, kind: f.kind, seed: i * 7 + 1, io: bot });
      const res = await b.start();
      lost += 72 - Math.max(0, run.hp); wins += res === 'win'; turns += b.turn;
    }
    console.log(`A${f.act + 1} ${f.kind.padEnd(5)} ${f.enemies.join('+').padEnd(30)} hp lost ${(lost / T).toFixed(1).padStart(5)}  turns ${(turns / T).toFixed(1)}  win ${(wins / T * 100).toFixed(0)}%`);
  }
  process.exit(0);
}

const results = [];
for (let i = 0; i < N; i++) {
  if (V) console.log(`run ${i + 1}`);
  results.push(await descend(5000 + i, V));
}
const wins = results.filter(r => r.win).length;
const byAct = [0, 0, 0];
for (const r of results) if (!r.win) byAct[r.act]++;
console.log(`\n${N} descents: ${wins} reached the surface (${(wins / N * 100).toFixed(1)}%). Fell in act I: ${byAct[0]}, act II: ${byAct[1]}, act III: ${byAct[2]}`);
const reachedBoss = [0, 1, 2].map(a => results.filter(r => r.perFight.some(f => f.act === a && f.kind === 'boss')).length);
const beatBoss = [0, 1, 2].map(a => results.filter(r => r.perFight.some(f => f.act === a && f.kind === 'boss' && f.win)).length);
console.log(`bosses reached / beaten: ${reachedBoss.map((x, i) => `${x}/${beatBoss[i]}`).join('  ')}`);
// cost of each kind of fight
const agg = {};
for (const r of results) for (const f of r.perFight) {
  const k = `A${f.act + 1} ${f.kind.padEnd(5)} ${f.enemies}`;
  const a = agg[k] ??= { n: 0, lost: 0, deaths: 0, turns: 0 };
  a.n++; a.lost += f.lost; a.turns += f.turns; if (!f.win) a.deaths++;
}
console.log('\nfight                                     seen   hp lost  turns  deaths');
for (const [k, a] of Object.entries(agg).sort()) console.log(`${k.padEnd(42)} ${String(a.n).padStart(4)}  ${(a.lost / a.n).toFixed(1).padStart(7)}  ${(a.turns / a.n).toFixed(1).padStart(5)}  ${String(a.deaths).padStart(5)}`);
const floors = results.map(r => r.floor).sort((a, b) => a - b);
console.log(`\nmedian floor reached: ${floors[Math.floor(N / 2)]} of ${3 * (ROWS + 1)}`);
const decks = results.map(r => r.run.deck.length);
console.log(`average deck at the end: ${(decks.reduce((a, b) => a + b, 0) / N).toFixed(1)} cards`);
