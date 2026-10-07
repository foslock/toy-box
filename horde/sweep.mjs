// Tries several sets of numbers against every night at once, in parallel, and prints one line each.
//   node horde/sweep.mjs --games 12 --kind smart --nights 1,2 "MOBS.imp.hp=8" "MOBS.imp.hp=10,DEEP.hp=0.4"
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const a = process.argv.slice(2), opt = [];
for (const k of ['--games', '--kind', '--size', '--seed']) { const i = a.indexOf(k); if (i >= 0) { opt.push(k, a[i + 1]); a.splice(i, 2); } }
let NIGHTS = [1, 2, 3, 4, 5, 6];
{ const i = a.indexOf('--nights'); if (i >= 0) { NIGHTS = a[i + 1].split(',').map(Number); a.splice(i, 2); } }
const sets = a.length ? a : [''];
const run = (set, n) => new Promise(res => {
  const p = spawn('node', [here + 'balance.mjs', '--night', String(n), '--json', ...opt, ...(set ? ['--set', set] : [])]);
  let out = ''; p.stdout.on('data', d => out += d); p.on('close', () => res(out.trim().split('\n').filter(Boolean).map(l => JSON.parse(l))));
});
const q = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
for (const set of sets) {
  const res = await Promise.all(NIGHTS.map(n => run(set, n)));
  const cells = res.map(rows => {
    const won = rows.filter(r => r.won), t = q(won.map(r => r.t / 60), .5);
    return `${String(won.length).padStart(2)}/${rows.length} ${isNaN(t) ? '   ' : t.toFixed(1)}m L${q(rows.map(r => r.lv), .5)}`;
  });
  console.log((set || '(as is)').padEnd(48).slice(0, 48), cells.join(' | '));
}
