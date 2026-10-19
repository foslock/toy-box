// Every kind of gumball, and how a trayful of them is scored. Pure data and logic, no drawing.
//
// Scoring order: bombs go off, cats eat, then each ball works out its own value (base plus
// whatever its neighbours give it), then clovers add, then multipliers (magnets, rainbows, the
// bomb's "pay double before you go") are applied. `evaluate` is pure so the tray can show live
// numbers while the balls are still rolling around.

export const KINDS = {
  coin:      { name: 'Penny',      color: '#c8703a', base: 1, rarity: 1, tags: ['coin'], text: 'Worth ¢1. Magnets love it.' },
  cherry:    { name: 'Cherry',     color: '#d7263d', base: 1, rarity: 1, tags: ['fruit'], text: '+¢1 for each Cherry it touches.' },
  flower:    { name: 'Daisy',      color: '#ff7eb6', base: 1, rarity: 1, tags: ['flower'], text: 'Worth ¢1. Bees adore it.' },
  bee:       { name: 'Bee',        color: '#ffcf33', base: 1, rarity: 1, tags: ['bug'], text: '+¢2 for each flower or fruit it touches.' },
  fish:      { name: 'Fish',       color: '#2f7ff0', base: 2, rarity: 1, tags: ['fish'], text: 'Worth ¢2. Keep it away from cats. Or don\'t.' },
  milk:      { name: 'Milk',       color: '#e9f0f9', base: 1, rarity: 1, tags: [], text: 'Worth ¢1. A Cat touching it gets +¢3.' },
  mouse:     { name: 'Mouse',      color: '#9aa1ab', base: 1, rarity: 1, tags: ['animal'], text: '+¢3 for each Cheese it touches.' },
  cheese:    { name: 'Cheese',     color: '#ffb020', base: 2, rarity: 1, tags: [], text: 'Worth ¢2.' },
  seed:      { name: 'Seed',       color: '#8a5a35', base: 0, rarity: 1, tags: [], text: 'Worth nothing yet. After 3 cranks in the tray it grows into a Sunflower.', grows: ['sunflower', 3] },
  egg:       { name: 'Egg',        color: '#f4e6c8', base: 1, rarity: 1, tags: [], text: 'Worth ¢1. Hatches into a Chick if another gumball hits it hard. Nudge!' },
  dice:      { name: 'Dice',       color: '#ffffff', base: 0, rarity: 1, tags: [], text: 'Rolls ¢1 to ¢6 when it lands.' },
  balloon:   { name: 'Balloon',    color: '#9b5de5', base: 1, rarity: 1, tags: [], text: 'Floats up. Worth ¢6 if it touches no other gumball, ¢1 if it does.', gs: -0.55, m: 0.4 },

  gold:      { name: 'Gold Coin',  color: '#f2c12e', base: 3, rarity: 2, tags: ['coin'], text: 'Worth ¢3. Magnets love it.' },
  cat:       { name: 'Cat',        color: '#e0612a', base: 2, rarity: 2, tags: ['animal'], text: 'Eats any Fish (+¢8) or Mouse (+¢6) it touches. +¢3 for touching Milk.' },
  magnet:    { name: 'Magnet',     color: '#b9c0ca', base: 0, rarity: 2, tags: [], text: 'Pulls coins toward it. Coins touching it pay double.' },
  bomb:      { name: 'Bomb',       color: '#26262b', base: 0, rarity: 2, tags: [], text: 'Everything it touches pays double, then is blown out of your machine for good. So is the bomb.' },
  superball: { name: 'Superball',  color: '#00b8a0', base: 0, rarity: 2, tags: [], text: '+¢1 every time it bounces off another gumball (up to ¢10).', e: 0.9 },
  clover:    { name: 'Clover',     color: '#3d9b45', base: 1, rarity: 2, tags: ['flower'], text: 'Every gumball touching it gets +¢1.' },
  hive:      { name: 'Hive',       color: '#d98f12', base: 1, rarity: 2, tags: [], text: '+¢2 for every Bee in the tray, touching or not.' },

  jawbreaker:{ name: 'Jawbreaker', color: '#ff4f79', base: 1, rarity: 3, tags: [], text: 'Big and heavy. +¢2 for each gumball touching it.', r: 1.5, m: 3.4 },
  rainbow:   { name: 'Rainbow',    color: '#fff9f0', base: 0, rarity: 3, tags: [], text: 'Doubles every gumball it touches.' },
  diamond:   { name: 'Diamond',    color: '#8fe3f5', base: 7, rarity: 3, tags: [], text: 'Worth ¢7. Pretty.' },

  // grown or hatched, never offered
  sunflower: { name: 'Sunflower',  color: '#ffd000', base: 4, rarity: 0, tags: ['flower'], text: 'Worth ¢4. A flower, as far as bees are concerned.' },
  chick:     { name: 'Chick',      color: '#ffe45c', base: 2, rarity: 0, tags: ['animal'], text: 'Worth ¢2. After 3 cranks in the tray it grows into a Hen.', grows: ['hen', 3] },
  hen:       { name: 'Hen',        color: '#a8552a', base: 3, rarity: 0, tags: ['animal'], text: 'Worth ¢3. +¢2 for each Egg or Chick it touches.' },
};

export const OFFERABLE = Object.keys(KINDS).filter((k) => KINDS[k].rarity > 0);
export const RARITY_NAME = ['', 'common', 'uncommon', 'rare'];

export const has = (kind, tag) => KINDS[kind].tags.includes(tag);

// balls: [{ kind, roll, bounces }], adj: array of neighbour index arrays
export function evaluate(balls, adj) {
  const n = balls.length;
  const add = new Array(n).fill(0);
  const mult = new Array(n).fill(1);
  const fate = new Array(n).fill(null);   // 'boom' | 'eaten'
  const links = [];                        // {a, b, kind} for drawing what touches what
  const notes = balls.map(() => []);       // short reasons, for the info card

  // 1. bombs
  for (let i = 0; i < n; i++) {
    if (balls[i].kind !== 'bomb') continue;
    fate[i] = 'boom';
    for (const j of adj[i]) {
      if (fate[j] !== 'boom') { fate[j] = 'boom'; mult[j] *= 2; notes[j].push('bombed ×2'); }
      links.push({ a: i, b: j, kind: 'boom' });
    }
  }
  // 2. cats eat
  for (let i = 0; i < n; i++) {
    if (balls[i].kind !== 'cat' || fate[i] === 'boom') continue;
    for (const j of adj[i]) {
      const k = balls[j].kind;
      if ((k === 'fish' || k === 'mouse') && !fate[j]) {
        fate[j] = 'eaten';
        const v = k === 'fish' ? 8 : 6;
        add[i] += v; notes[i].push(`ate a ${KINDS[k].name.toLowerCase()} +${v}`);
        links.push({ a: i, b: j, kind: 'eat' });
      }
    }
  }
  // 3. own value
  let bees = 0;
  for (const b of balls) if (b.kind === 'bee') bees++;
  for (let i = 0; i < n; i++) {
    const k = balls[i].kind, nb = adj[i];
    const plus = (j, v, why) => { add[i] += v; links.push({ a: j, b: i, kind: 'plus' }); if (why) notes[i].push(why); };
    switch (k) {
      case 'cherry': for (const j of nb) if (balls[j].kind === 'cherry') plus(j, 1, '+1 cherry'); break;
      case 'bee': for (const j of nb) if (has(balls[j].kind, 'flower') || has(balls[j].kind, 'fruit')) plus(j, 2, '+2 ' + KINDS[balls[j].kind].name.toLowerCase()); break;
      case 'mouse': if (fate[i] !== 'eaten') for (const j of nb) if (balls[j].kind === 'cheese') plus(j, 3, '+3 cheese'); break;
      case 'cat': for (const j of nb) if (balls[j].kind === 'milk') plus(j, 3, '+3 milk'); break;
      case 'hen': for (const j of nb) if (balls[j].kind === 'egg' || balls[j].kind === 'chick') plus(j, 2, '+2 ' + balls[j].kind); break;
      case 'jawbreaker': if (nb.length) { add[i] += 2 * nb.length; notes[i].push(`+2 × ${nb.length} touching`); } break;
      case 'hive': if (bees) { add[i] += 2 * bees; notes[i].push(`+2 × ${bees} bee${bees > 1 ? 's' : ''}`); } break;
      case 'superball': { const v = Math.min(10, balls[i].bounces || 0); add[i] += v; if (v) notes[i].push(`${v} bounce${v > 1 ? 's' : ''}`); break; }
      case 'dice': add[i] += balls[i].roll || 0; if (balls[i].roll) notes[i].push(`rolled ${balls[i].roll}`); break;
      case 'balloon': if (!nb.length) { add[i] += 5; notes[i].push('alone! +5'); } break;
    }
  }
  // 4. clovers
  for (let i = 0; i < n; i++) {
    if (balls[i].kind !== 'clover') continue;
    for (const j of adj[i]) { add[j] += 1; links.push({ a: i, b: j, kind: 'plus' }); notes[j].push('+1 clover'); }
  }
  // 5. multipliers
  for (let i = 0; i < n; i++) {
    const k = balls[i].kind;
    if (k === 'magnet') for (const j of adj[i]) if (has(balls[j].kind, 'coin')) { mult[j] *= 2; links.push({ a: i, b: j, kind: 'mult' }); notes[j].push('magnet ×2'); }
    if (k === 'rainbow') for (const j of adj[i]) { mult[j] *= 2; links.push({ a: i, b: j, kind: 'mult' }); notes[j].push('rainbow ×2'); }
  }

  const vals = new Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const own = KINDS[balls[i].kind].base + add[i];
    vals[i] = fate[i] === 'eaten' ? 0 : Math.max(0, own) * mult[i];
    total += vals[i];
  }
  return { vals, mult, fate, links, notes, total };
}

// neighbours by distance, with a small tolerance so resting balls count as touching
export function touching(balls, tol = 3) {
  const adj = balls.map(() => []);
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j];
      const rr = a.r + b.r + tol;
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy < rr * rr) { adj[i].push(j); adj[j].push(i); }
    }
  }
  return adj;
}
