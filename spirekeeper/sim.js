// Spire Keeper — the fight engine, Pip's brain, and the run (floors, hype, viewers).
// Pure and seeded: the page animates the event list a fight returns, and balance.mjs
// runs thousands of them headless.
import { CARDS, ENEMIES, RELICS, EVENTS, STARTER_DECK, REWARD_POOL, RARES, TIERS, FLOORS, hpScale, dmgScale, shininess } from './data.js';

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  r.int = n => Math.floor(r() * n);
  r.pick = a => a[Math.floor(r() * a.length)];
  r.shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return r;
}

// ---------------------------------------------------------------- monsters on a floor
export function makeEnemy(key, floor) {
  const d = ENEMIES[key];
  const hm = d.boss ? 1 : hpScale(floor), dm = d.boss ? 1 : dmgScale(floor);
  const sc = m => {
    const o = { ...m };
    if (o.a) o.a = Math.round(o.a * dm);
    if (o.b) o.b = Math.round(o.b * dm);
    if (o.heal) o.heal = Math.round(o.heal * hm);
    return o;
  };
  const hp = Math.round(d.hp * hm);
  return { key, name: d.name, hp, maxHp: hp, first: d.first ? sc(d.first) : null, pattern: d.pattern.map(sc), elite: !!d.elite, boss: !!d.boss };
}

// ---------------------------------------------------------------- fight
const fighter = (hp, maxHp) => ({ hp, maxHp, block: 0, str: 0, vuln: 0, weak: 0, poison: 0, thorns: 0, fortify: 0, regrow: 0 });

function snap(F) {
  const h = F.hero, e = F.foe;
  return {
    hero: { hp: h.hp, maxHp: h.maxHp, block: h.block, str: h.str, vuln: h.vuln, weak: h.weak, poison: h.poison, thorns: h.thorns, fortify: h.fortify, regrow: h.regrow, energy: F.energy },
    foe: { hp: e.hp, maxHp: e.maxHp, block: e.block, str: e.str, vuln: e.vuln, weak: e.weak, poison: e.poison },
    hand: F.hand.slice(), intent: F.intent, turn: F.turn,
    draw: F.drawPile.length, discard: F.discard.length,
  };
}

export function intentDamage(move, foe, hero) {
  if (!move || !move.a) return 0;
  return hitAmount(move.a, foe, hero) * (move.n || 1);
}
function hitAmount(base, att, def) {
  let d = base + att.str;
  if (att.weak > 0) d = Math.floor(d * 0.75);
  if (def.vuln > 0) d = Math.floor(d * 1.5);
  return Math.max(0, d);
}

// hero: { hp, maxHp, deck:[ids], relics:[ids] }
export function fight(hero, enemy, seed, opts = {}) {
  const R = rng(seed);
  const has = k => hero.relics.includes(k);
  const F = {
    hero: fighter(hero.hp, hero.maxHp), foe: fighter(enemy.hp, enemy.maxHp),
    drawPile: R.shuffle(hero.deck.slice()), discard: [], hand: [], exhausted: [],
    energy: 0, turn: 0, intent: null, moveIx: -1, firstAttackDone: false, pillowUsed: false,
    events: [], minHp: hero.hp, over: false, won: false, dmgTaken: 0, bigHits: [],
  };
  const ev = (t, x = {}) => { F.events.push({ t, ...x, s: snap(F) }); };

  if (has('plum')) F.hero.str += 1;
  if (has('glass')) F.hero.str += 3;
  if (has('marble')) F.foe.vuln += 2;
  if (has('sand')) F.foe.weak += 2;
  if (has('mirror')) F.hero.vuln += 2;
  if (has('bramble')) F.hero.thorns += 3;

  const nextIntent = () => {
    if (F.moveIx < 0 && enemy.first) { F.moveIx = 0; F.intent = enemy.first; F.usedFirst = true; return; }
    if (F.moveIx < 0) F.moveIx = 0;
    else if (F.usedFirst) { F.usedFirst = false; F.moveIx = 0; }
    else F.moveIx = (F.moveIx + 1) % enemy.pattern.length;
    F.intent = enemy.pattern[F.moveIx];
  };

  const drawN = n => {
    for (let i = 0; i < n; i++) {
      if (!F.drawPile.length) { if (!F.discard.length) break; F.drawPile = R.shuffle(F.discard); F.discard = []; ev('shuffle'); }
      F.hand.push(F.drawPile.pop());
    }
  };

  // damage to the hero, honouring block, pillow, thorns
  const hurtHero = (amt, src) => {
    const h = F.hero;
    const blocked = Math.min(h.block, amt);
    h.block -= blocked;
    let lost = amt - blocked;
    if (lost >= h.hp && has('pillow') && !F.pillowUsed) { F.pillowUsed = true; lost = h.hp - 1; ev('pillow'); }
    h.hp -= lost;
    F.dmgTaken += lost;
    F.minHp = Math.min(F.minHp, h.hp);
    ev('hurt', { who: 'hero', amt: lost, blocked, src });
    if (lost >= 10) F.bigHits.push(lost);
    if (h.hp <= 0) { h.hp = 0; F.over = true; F.won = false; ev('dead', { who: 'hero' }); }
    return lost;
  };
  const hurtFoe = (amt, src) => {
    const e = F.foe;
    const blocked = Math.min(e.block, amt);
    e.block -= blocked;
    const lost = amt - blocked;
    e.hp -= lost;
    ev('hurt', { who: 'foe', amt: lost, blocked, src });
    if (e.hp <= 0) { e.hp = 0; F.over = true; F.won = true; ev('dead', { who: 'foe' }); }
    return lost;
  };

  const play = (id, hi) => {
    const c = CARDS[id];
    F.hand.splice(hi, 1);
    F.energy -= c.cost;
    const h = F.hero, e = F.foe;
    ev('play', { card: id });
    if (c.selfDmg) { h.hp -= c.selfDmg; F.dmgTaken += c.selfDmg; F.minHp = Math.min(F.minHp, h.hp); ev('hurt', { who: 'hero', amt: c.selfDmg, blocked: 0, src: 'self' }); if (h.hp <= 0) { h.hp = 0; F.over = true; F.won = false; ev('dead', { who: 'hero' }); } }
    if (!F.over && c.type === 'atk') {
      let base = c.dmg || 0;
      if (c.bash) base = h.block;
      if (c.wild) base = c.wild[0] + R.int(c.wild[1] - c.wild[0] + 1);
      if (c.finish && e.hp < e.maxHp / 2) base += c.finish;
      if (c.desperate && h.hp < h.maxHp / 4) base += c.desperate;
      const hits = c.hits || 1;
      let mult = 1;
      if (has('whistle') && !F.firstAttackDone) mult = 2;
      F.firstAttackDone = true;
      for (let i = 0; i < hits && !F.over; i++) hurtFoe(hitAmount(base, h, e) * mult, 'card');
    }
    if (F.over) { if (c.exhaust) F.exhausted.push(id); else F.discard.push(id); return; }
    if (c.block) { h.block += c.block; ev('block', { who: 'hero', amt: c.block }); }
    if (c.vuln) { e.vuln += c.vuln; ev('status', { who: 'foe', k: 'vuln', amt: c.vuln }); }
    if (c.weak) { e.weak += c.weak; ev('status', { who: 'foe', k: 'weak', amt: c.weak }); }
    if (c.poison) { const p = c.poison + (has('inkpot') ? 2 : 0); e.poison += p; ev('status', { who: 'foe', k: 'poison', amt: p }); }
    if (c.str) { h.str += c.str; ev('status', { who: 'hero', k: 'str', amt: c.str }); }
    if (c.thorns) { h.thorns += c.thorns; ev('status', { who: 'hero', k: 'thorns', amt: c.thorns }); }
    if (c.fortify) { h.fortify += c.fortify; ev('status', { who: 'hero', k: 'fortify', amt: c.fortify }); }
    if (c.regrow) { h.regrow += c.regrow; ev('status', { who: 'hero', k: 'regrow', amt: c.regrow }); }
    if (c.heal) { const before = h.hp; h.hp = Math.min(h.maxHp, h.hp + c.heal); ev('heal', { who: 'hero', amt: h.hp - before }); }
    if (c.energy) F.energy += c.energy;
    if (c.draw) drawN(c.draw);
    if (c.exhaust || c.type === 'pow') F.exhausted.push(id); else F.discard.push(id);
  };

  // ---------------- Pip's brain (follows the HABITS in data.js)
  const choose = () => {
    const h = F.hero, e = F.foe;
    const playable = F.hand.map((id, i) => ({ id, i, c: CARDS[id] })).filter(x => x.c.cost <= F.energy && x.c.type !== 'curse');
    if (!playable.length) return null;
    const frac = h.hp / h.maxHp;
    const greedy = frac > 0.5, panic = frac < 0.25;
    const incoming = intentDamage(F.intent, e, h);
    const need = Math.max(0, incoming - h.block);
    const dmgOf = x => {
      const c = x.c;
      if (c.type !== 'atk') return 0;
      let b = c.dmg || 0;
      if (c.bash) b = h.block;
      if (c.wild) b = (c.wild[0] + c.wild[1]) / 2;
      if (c.finish && e.hp < e.maxHp / 2) b += c.finish;
      if (c.desperate && h.hp < h.maxHp / 4) b += c.desperate;
      return hitAmount(b, h, e) * (c.hits || 1);
    };
    const byCost = (a, b, f) => f(b) / Math.max(0.5, b.c.cost) - f(a) / Math.max(0.5, a.c.cost);
    // free stuff and powers first
    const adr = playable.find(x => x.id === 'adrenaline');
    if (adr) return adr;
    const pow = playable.find(x => x.c.type === 'pow');
    if (pow && !panic) return pow;
    // lethal?
    const atks = playable.filter(x => x.c.type === 'atk');
    const best = atks.slice().sort((a, b) => byCost(a, b, dmgOf))[0];
    if (!panic && best && dmgOf(best) >= e.hp + e.block) return best;
    if (panic) {
      const heal = playable.find(x => x.c.heal);
      if (heal) return heal;
      const blk = playable.filter(x => x.c.block).sort((a, b) => byCost(a, b, y => y.c.block))[0];
      if (blk) return blk;
      if (pow) return pow;
    }
    const bl = playable.find(x => x.id === 'bloodlet');
    if (bl && !panic && h.hp > 12 && F.hand.length > 2) return bl;
    if (!greedy && need > 0) {
      const blk = playable.filter(x => x.c.block).sort((a, b) => byCost(a, b, y => y.c.block))[0];
      if (blk) return blk;
    }
    const debuff = playable.find(x => (x.id === 'hex' && incoming > 0) || x.id === 'cloud');
    if (debuff && !greedy) return debuff;
    if (best && dmgOf(best) > 0) return best;
    if (debuff) return debuff;
    const draw = playable.find(x => x.c.draw);
    if (draw) return draw;
    // greedy Pip still won't play pure defence while healthy
    if (greedy) { const any = playable.find(x => !x.c.block || x.c.type === 'atk'); return any || null; }
    return playable.find(x => x.c.block) || playable[0];
  };

  ev('start', { foe: enemy.key });
  nextIntent();
  ev('intent');
  while (!F.over && F.turn < 24) {
    // ---- Pip's turn
    F.turn++;
    const h = F.hero, e = F.foe;
    h.block = 0;
    if (h.poison > 0) { const p = h.poison; h.poison--; ev('tick', { who: 'hero' }); hurtHero(p, 'poison'); if (F.over) break; }
    F.energy = 3 + (F.turn === 1 && has('candle') ? 1 : 0) + (has('mirror') ? 1 : 0);
    ev('turn', { who: 'hero' });
    if (F.turn === 1 && has('doorstop')) { h.block += 10; ev('block', { who: 'hero', amt: 10, src: 'relic' }); }
    if (has('scarf')) { h.block += 4; ev('block', { who: 'hero', amt: 4, src: 'relic' }); }
    if (h.fortify) { h.block += h.fortify; ev('block', { who: 'hero', amt: h.fortify, src: 'power' }); }
    if (h.regrow && h.hp < h.maxHp) { const b = h.hp; h.hp = Math.min(h.maxHp, h.hp + h.regrow); ev('heal', { who: 'hero', amt: h.hp - b }); }
    drawN(5 + (has('hourglass') ? 1 : 0));
    ev('draw');
    for (let guard = 0; guard < 20 && !F.over; guard++) {
      const pick = choose();
      if (!pick) break;
      play(pick.id, pick.i);
    }
    if (F.over) break;
    F.discard.push(...F.hand); F.hand = [];
    if (h.vuln > 0) h.vuln--;
    if (h.weak > 0) h.weak--;
    ev('endturn');
    // ---- foe's turn
    e.block = 0;
    if (e.poison > 0) { const p = e.poison; e.poison--; ev('tick', { who: 'foe' }); hurtFoe(p, 'poison'); if (F.over) break; }
    ev('turn', { who: 'foe' });
    const m = F.intent;
    ev('act', { move: m });
    if (m.sleep) ev('sleep');
    if (m.b) { e.block += m.b; ev('block', { who: 'foe', amt: m.b }); }
    if (m.s) { e.str += m.s; ev('status', { who: 'foe', k: 'str', amt: m.s }); }
    if (m.heal) { const b = e.hp; e.hp = Math.min(e.maxHp, e.hp + m.heal); ev('heal', { who: 'foe', amt: e.hp - b }); }
    if (m.a) {
      for (let i = 0; i < (m.n || 1) && !F.over; i++) {
        const lost = hurtHero(hitAmount(m.a, e, h), 'foe');
        if (!F.over && h.thorns && (lost > 0 || true)) hurtFoe(h.thorns, 'thorns');
      }
    }
    if (F.over) break;
    if (m.weak) { h.weak += m.weak; ev('status', { who: 'hero', k: 'weak', amt: m.weak }); }
    if (m.vuln) { h.vuln += m.vuln; ev('status', { who: 'hero', k: 'vuln', amt: m.vuln }); }
    if (m.poison) { h.poison += m.poison; ev('status', { who: 'hero', k: 'poison', amt: m.poison }); }
    if (e.vuln > 0) e.vuln--;
    if (e.weak > 0) e.weak--;
    nextIntent();
    ev('intent');
  }
  if (!F.over) { F.over = true; F.won = true; F.fled = true; ev('flee'); }
  ev('end', { won: F.won });
  return { events: F.events, won: F.won, hp: F.hero.hp, minHp: F.minHp, turns: F.turn, dmgTaken: F.dmgTaken, bigHits: F.bigHits, fled: !!F.fled, pillow: F.pillowUsed };
}

// ---------------------------------------------------------------- forecasts for the room cards
export function forecast(hero, enemy, n = 40, seed = 1) {
  const losses = [];
  let deaths = 0, lowSum = 0;
  for (let i = 0; i < n; i++) {
    const r = fight(hero, enemy, seed * 977 + i * 131 + 7);
    if (!r.won) deaths++;
    losses.push(hero.hp - r.hp);
    lowSum += r.minHp;
  }
  losses.sort((a, b) => a - b);
  const q = p => losses[Math.min(n - 1, Math.floor(p * n))];
  return { lo: q(0.15), mid: q(0.5), hi: q(0.85), death: deaths / n };
}

// ---------------------------------------------------------------- hype
// Live hype changes per fight event, plus a settle at the end. The page shows the same numbers.
export const HYPE = { start: 55, max: 100, roomDecay: 7 };
export function hypeForEvent(e, maxHp) {
  if (e.t === 'hurt' && e.who === 'hero' && e.amt > 0) {
    const frac = e.s.hero.hp / maxHp;
    return e.amt / maxHp * 70 * (frac < 0.25 ? 1.6 : frac < 0.5 ? 1.25 : 1);
  }
  if (e.t === 'turn' && e.who === 'hero' && e.s.turn > 4) return -2.5;
  if (e.t === 'pillow') return 10;
  return 0;
}
export function hypeSettle(res, hpStart, maxHp, enemy) {
  const out = [];
  const lowFrac = res.minHp / maxHp;
  const dip = (hpStart - res.minHp) / maxHp;
  if (!res.won) return out;
  // a fight that never touched her is no nail-biter, however low she walked in
  if (dip >= 0.06 && lowFrac <= 0.15) out.push({ amt: 22, why: 'CLUTCH' });
  else if (dip >= 0.06 && lowFrac <= 0.3) out.push({ amt: 10, why: 'close call' });
  if (dip < 0.06) out.push({ amt: -12, why: 'snooze' });
  else if (dip < 0.12) out.push({ amt: -5, why: 'one-sided' });
  if (enemy.elite && dip > 0.12) out.push({ amt: 6, why: 'elite down' });
  if (res.turns >= 9) out.push({ amt: -6, why: 'dragged on' });
  return out;
}

// ---------------------------------------------------------------- the run
export function newRun(seed = (Math.random() * 1e9) | 0) {
  return {
    seed, R: rng(seed), floor: 1, hype: HYPE.start, viewers: 140, peak: 140,
    hero: { hp: 70, maxHp: 70, deck: STARTER_DECK.slice(), relics: [] },
    history: [], over: false, outcome: null, clutches: 0,
  };
}

// Three room cards for this floor. The keeper plays one.
export function offerRooms(run, tutorialStep = 0) {
  const R = run.R, f = run.floor;
  if (tutorialStep === 1) return [{ kind: 'monster', key: 'rat' }, { kind: 'monster', key: 'jelly' }, { kind: 'event', key: 'campfire' }];
  if (tutorialStep === 2) return [{ kind: 'monster', key: 'bones' }, { kind: 'monster', key: 'bats' }, { kind: 'treasure', key: 'kettle' }];
  if (f === FLOORS) return R.shuffle(TIERS[4].slice()).map(key => ({ kind: 'monster', key }));
  const pool = f <= 3 ? [1] : f <= 6 ? [1, 2] : f <= 10 ? [1, 2, 2, 3] : [2, 2, 3];
  const monsters = [];
  while (monsters.length < 2) {
    const tier = R.pick(pool);
    const key = R.pick(TIERS[tier]);
    if (!monsters.includes(key)) monsters.push(key);
  }
  const out = monsters.map(key => ({ kind: 'monster', key }));
  // a rest before the boss is always on offer
  if (f === FLOORS - 1 || f === 8) out.push({ kind: 'event', key: 'campfire' });
  else {
    const roll = R();
    if (roll < 0.4) out.push({ kind: 'treasure', key: R.pick(Object.keys(RELICS).filter(k => !run.hero.relics.includes(k))) });
    else if (roll < 0.62) out.push({ kind: 'event', key: 'campfire' });
    else if (roll < 0.9) out.push({ kind: 'event', key: R.pick(['shrine', 'well', 'altar', 'barber']) });
    else { // sometimes three monsters
      let key; do key = R.pick(TIERS[R.pick(pool)]); while (monsters.includes(key));
      out.push({ kind: 'monster', key });
    }
  }
  return out;
}

export function giveRelic(hero, key) {
  hero.relics.push(key);
  if (key === 'sock') { hero.maxHp += 12; hero.hp += 12; }
  if (key === 'glass') { hero.maxHp -= 15; hero.hp = Math.min(hero.hp, hero.maxHp); }
}

// Non-fight rooms. Returns { lines:[text], hype, relic?, card? }
export function resolveRoom(run, room) {
  const h = run.hero, R = run.R;
  const out = { lines: [], hype: 0 };
  if (room.kind === 'treasure') {
    giveRelic(h, room.key);
    out.relic = room.key;
    out.lines.push(`Pip found the ${RELICS[room.key].name}.`);
    out.hype = 3;
  } else {
    const ev = EVENTS[room.key];
    out.hype = ev.hype;
    if (room.key === 'campfire') {
      const b = h.hp; h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * 0.3));
      out.lines.push(`Pip sat by the fire and healed ${h.hp - b}.`);
      out.heal = h.hp - b;
    } else if (room.key === 'shrine') {
      h.hp = Math.max(1, h.hp - 12);
      const card = R.pick(RARES);
      h.deck.push(card); out.card = card;
      out.lines.push(`Pip bled 12 HP for ${CARDS[card].name}.`);
      out.hurt = 12;
    } else if (room.key === 'well') {
      if (R() < 0.5) {
        const key = R.pick(Object.keys(RELICS).filter(k => !h.relics.includes(k)));
        giveRelic(h, key); out.relic = key;
        out.lines.push(`The well coughed up the ${RELICS[key].name}!`);
        out.hype += 4;
      } else {
        h.hp = Math.max(1, h.hp - 14); out.hurt = 14;
        out.lines.push('Pip leaned in too far. Splash. -14 HP.');
        out.hype += 6;
      }
    } else if (room.key === 'altar') {
      const key = R.pick(Object.keys(RELICS).filter(k => !h.relics.includes(k)));
      giveRelic(h, key); out.relic = key;
      h.deck.push('doubt'); out.card = 'doubt';
      out.lines.push(`Pip took the ${RELICS[key].name}. Something whispered "Doubt".`);
    } else if (room.key === 'barber') {
      const di = h.deck.indexOf('doubt');
      if (di >= 0) { h.deck.splice(di, 1); out.lines.push('The barber snipped away a Doubt.'); }
      else {
        let n = 0;
        for (let i = 0; i < 2; i++) { const si = h.deck.indexOf('strike'); if (si >= 0) { h.deck.splice(si, 1); n++; } }
        out.lines.push(n ? `The barber trimmed ${n} Strike${n > 1 ? 's' : ''}.` : 'Nothing left to trim.');
      }
    }
  }
  return out;
}

// After a won fight: Pip picks the shiniest of three cards. Returns { offered, picked }.
export function cardReward(run) {
  const R = run.R;
  const offered = [];
  while (offered.length < 3) { const k = R.pick(REWARD_POOL); if (!offered.includes(k)) offered.push(k); }
  let picked = offered[0];
  for (const k of offered) if (shininess(k) > shininess(picked)) picked = k;
  run.hero.deck.push(picked);
  return { offered, picked };
}

export function viewersAfter(run) {
  const mult = 0.86 + run.hype / 260 + (run.hype > 80 ? 0.05 : 0);
  run.viewers = Math.max(3, Math.round(run.viewers * mult + (run.hype - 40) * 0.6));
  run.peak = Math.max(run.peak, run.viewers);
}
