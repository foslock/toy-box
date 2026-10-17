// The six songs of a night out, from a warm-up to the carnival parade.
import { SPECIES } from './animals.js';

export const ROUNDS = [
  { name: 'Warm-Up',  lines: 1, n: 2, tier: 1, bonus: 0, leadHp: 6,  leadAtk: 1, speed: 3.2 },
  { name: 'Cha-Cha',  lines: 2, n: 3, tier: 2, bonus: 0, leadHp: 9,  leadAtk: 1, speed: 3.4 },
  { name: 'Mambo',    lines: 2, n: 4, tier: 2, bonus: 1, leadHp: 12, leadAtk: 2, speed: 3.5 },
  { name: 'Rumba',    lines: 3, n: 3, tier: 3, bonus: 1, leadHp: 12, leadAtk: 2, speed: 3.5 },
  { name: 'Samba',    lines: 2, n: 6, tier: 3, bonus: 2, leadHp: 18, leadAtk: 3, speed: 3.7 },
  { name: 'Carnaval', lines: 1, n: 12, tier: 3, bonus: 2, leadHp: 55, leadAtk: 4, speed: 3.1, boss: true },
];

export const pool = (tier) => Object.keys(SPECIES).filter(k => SPECIES[k].tier >= 1 && SPECIES[k].tier <= tier);

export function buildRound(i, rand, W, H) {
  const R = ROUNDS[i], P = pool(R.tier);
  const pick = () => P[Math.floor(rand() * P.length)];
  const foes = [];
  for (let k = 0; k < R.lines; k++) {
    const dancers = [];
    for (let j = 0; j < R.n; j++) {
      const sp = pick(), S = SPECIES[sp];
      const lvl = R.bonus >= 2 && rand() < 0.3 ? 2 : 1;
      dancers.push({ sp, lvl, atk: S.atk + R.bonus + (lvl - 1), hp: S.hp + R.bonus + (lvl - 1) });
    }
    let lead;
    if (R.boss) lead = { sp: 'peacock', atk: R.leadAtk, hp: R.leadHp };
    else { const sp = pick(); lead = { sp, atk: SPECIES[sp].atk + R.leadAtk, hp: R.leadHp }; }
    foes.push({ lead, dancers, speed: R.speed, boss: !!R.boss });
  }
  return {
    W, H, foes,
    wild: [pick()],
    wildPool: P, wildEvery: 11, maxWild: 2,
    coinEvery: 3.5,
  };
}

// the floor keeps about the same area whatever the screen's shape
export function floorSize(aspect) {
  const a = Math.max(0.52, Math.min(1.7, aspect)), A = 330;
  return { W: +Math.sqrt(A * a).toFixed(2), H: +Math.sqrt(A / a).toFixed(2) };
}
