// The run between songs: hearts, coins, the troupe and the shop. No DOM.
import { SPECIES, TREATS } from './animals.js';
import { ROUNDS, pool } from './rounds.js';
import { CAP } from './game.js';

export const PRICE = 3, REROLL = 1, INCOME = 6;
let uid = 1;

export function newRun() {
  return { round: 0, hearts: 3, coins: 10, roster: [], leader: { atk: 2, hp: 8 }, offers: [], treat: null, won: 0, lost: 0, koTotal: 0 };
}

export function rollShop(run, rand) {
  const P = pool(ROUNDS[Math.min(run.round, ROUNDS.length - 1)].tier);
  run.offers = Array.from({ length: 4 }, () => P[Math.floor(rand() * P.length)]);
  run.treat = rand() < 0.5 ? 'mango' : 'maracas';
}

export const mergeTarget = (run, sp) => run.roster.find(e => e.sp === sp);

export function canBuy(run, i) {
  const sp = run.offers[i];
  if (!sp || run.coins < PRICE) return false;
  return !!mergeTarget(run, sp) || run.roster.length < CAP;
}

export function buy(run, i) {
  if (!canBuy(run, i)) return null;
  const sp = run.offers[i];
  run.coins -= PRICE;
  run.offers[i] = null;
  const m = mergeTarget(run, sp);
  if (m) { m.atk++; m.hp++; m.lvl = Math.min(3, m.lvl + 1); return { merged: m }; }
  const S = SPECIES[sp];
  const e = { sp, lvl: 1, atk: S.atk, hp: S.hp, uid: uid++ };
  run.roster.push(e);
  return { added: e };
}

export function canTreat(run) {
  if (!run.treat || run.coins < TREATS[run.treat].cost) return false;
  return run.treat !== 'mango' || run.roster.length > 0;
}

export function buyTreat(run) {
  if (!canTreat(run)) return null;
  const t = run.treat;
  run.coins -= TREATS[t].cost;
  run.treat = null;
  if (t === 'mango') { const e = run.roster[run.roster.length - 1]; e.atk++; e.hp++; return { fed: e }; }
  run.leader.atk++; run.leader.hp += 2;
  return { leader: true };
}

export function sell(run, i) {
  const e = run.roster[i];
  if (!e) return 0;
  run.roster.splice(i, 1);
  run.coins += e.lvl;
  return e.lvl;
}

export function move(run, i, dir) {
  const j = i + dir, R = run.roster;
  if (j < 0 || j >= R.length) return i;
  [R[i], R[j]] = [R[j], R[i]];
  return j;
}

export function reroll(run, rand) {
  if (run.coins < REROLL) return false;
  run.coins -= REROLL;
  const keepTreat = run.treat === null;
  rollShop(run, rand);
  if (keepTreat) run.treat = null;
  return true;
}

// after a song: pay out, count hearts, move on (or not)
export function settle(run, game) {
  run.coins += INCOME + game.coinsGot;
  run.koTotal += game.leadersOut;
  if (game.over === 'win') { run.won++; run.round++; run.leader.hp += 1; }
  else { run.lost++; run.hearts--; }
  return run.hearts <= 0 ? 'out' : run.round >= ROUNDS.length ? 'champion' : 'next';
}
