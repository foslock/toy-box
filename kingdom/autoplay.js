// A stand-in player, for the headless balance runs (balance.mjs) and the page's ?demo. skill is how often it sees
// through a choice to the better side (0 picks at random; 1 always picks what worth.js rates higher). Everything
// else it does the way a sensible player would: spends foresight on the choices that matter, won't walk into a fight
// it can't win when it's nearly dead, shops for what it's short of, and turns back time when it dies.
import { optionWorth } from './worth.js';
import { ITEMS } from './rules.js';
import { buyLegacy, legacyCost } from './dynasty.js';
import { LEGACY } from './rules.js';

export function makePlayer(skill = .55, rand = Math.random) {
  return {
    choose(life) {
      const cur = life.present();
      const lock = life.locks();
      if (lock.L) return 'R';
      if (lock.R) return 'L';
      const s = life.state();
      const L = optionWorth(life.option('L'), s), R = optionWorth(life.option('R'), s);
      if (cur.hidden) {               // the Veil: judge the side you can see
        const seen = cur.hidden === 'L' ? R : L, dir = cur.hidden === 'L' ? 'R' : 'L';
        return rand() < skill ? (seen >= 0 ? dir : cur.hidden) : (rand() < .5 ? 'L' : 'R');
      }
      // Seven-League Boots when both ways look grim.
      if (Math.max(L, R) < -25 && life.relics.some(r => r.id === 'boots' && !r.used) && life.phase === 'journey' && rand() < skill + .3) return 'stride';
      // Foresight on the big ones.
      if (life.sight > 0 && !cur.omens && (Math.abs(L - R) > 12 || life.phase === 'succession' || life.hp <= 2) && rand() < .5 + skill / 2) life.foresee();
      if (cur.omens) {
        const o = cur.omens, rank = { good: 2, mixed: 1, ill: 0 };
        if (rank[o.L] !== rank[o.R]) return rank[o.L] > rank[o.R] ? 'L' : 'R';
      }
      if (rand() < skill && Math.abs(L - R) > 1) return L > R ? 'L' : 'R';
      return rand() < .5 ? 'L' : 'R';
    },
    shop(life) {
      if (!life.shop) return;
      const w = life.shop.wares;
      const buy = x => { if (!x.sold && life.gold >= x.price) life.buy(x.i); };
      const careless = rand() > skill;
      for (let pass = 0; pass < 3; pass++) {
        if (life.hp <= life.maxHp - 2 || life.hp <= 2) { const h = w.find(x => x.kind === 'heal' && !x.sold && life.gold >= x.price); if (h) buy(h); }
        if (life.food < 4 && life.phase === 'journey') { const f = w.find(x => x.kind === 'food' && !x.sold && life.gold >= x.price); if (f) buy(f); }
        if (life.cursed) { const l = w.find(x => x.kind === 'lift' && !x.sold); if (l) buy(l); }
        const items = w.filter(x => x.kind === 'item' && !x.sold && ITEMS[x.id].power > ITEMS[life[ITEMS[x.id].slot]].power)
          .sort((a, b) => (ITEMS[b.id].power - ITEMS[life[ITEMS[b.id].slot]].power) / b.price - (ITEMS[a.id].power - ITEMS[life[ITEMS[a.id].slot]].power) / a.price);
        for (const it of items) if (life.gold - it.price >= (careless ? 0 : 6)) buy(it);
        const relic = w.find(x => x.kind === 'relic' && !x.sold && life.gold - x.price >= (careless ? 0 : 12));
        if (relic) buy(relic);
        const sight = w.find(x => x.kind === 'sight' && !x.sold && life.gold - x.price >= 20);
        if (sight) buy(sight);
      }
      life.leave();
    },
  };
}

// Plays a whole life with the stand-in player. Returns the life, finished.
export function playLife(life, player) {
  let guard = 0;
  while (!life.fate && guard++ < 60) {
    const dir = player.choose(life);
    if (dir === 'stride') life.stride(life.locks().L ? 'R' : 'L');
    else life.choose(dir);
    if (life.fate && life.canRewind()) life.rewind();
    if (life.shop) player.shop(life);
  }
  return life;
}

// Spends a house's vault the way a player might: the cheapest bloodline power it can afford, again and again.
export function spendVault(house) {
  for (;;) {
    const options = LEGACY.map(l => ({ id: l.id, cost: legacyCost(house, l.id) })).filter(o => o.cost != null && o.cost <= house.vault).sort((a, b) => a.cost - b.cost);
    if (!options.length) return;
    buyLegacy(house, options[0].id);
  }
}
