// A short-order cook who never reads the captions. Used for the ?demo screenshot and the headless balance runs.
import { LINE } from './sim.js';

export class Bot {
  constructor(S, { delay = .45, slop = .06, memory = 1, seed = 5 } = {}) { this.S = S; this.delay = delay; this.slop = slop; this.memory = memory; this.cool = 0; this.pour = null; this.r = () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

  wanted() { // what's on open tickets (and what a hush regular is secretly after), minus what's already in the works
    const S = this.S; const need = [];
    const ps = [...S.parties].sort((a, b) => a.pat / a.pmax - b.pat / b.pmax);
    for (const p of ps) { if (p.state === 'wait' || (p.state === 'hush' && this.memory)) for (const k of p.need) need.push(k); }
    const have = [];
    for (const key of ['urn', 'fount']) if (S[key].glass) have.push(S[key].glass.kind);
    for (const g of S.griddle) if (g && g.state !== 'burnt') have.push(g.kind);
    for (const b of S.toaster) if (b) have.push('toast');
    for (const it of S.pass) if (it) have.push(it.kind);
    for (const h of have) { const i = need.indexOf(h); if (i >= 0) need.splice(i, 1); }
    return need;
  }

  tick(dt) {
    const S = this.S; this.cool -= dt;
    if (this.pour) { const g = S[this.pour.st].glass; if (!g || g.ready || g.fill >= this.pour.at) { S.pourStop(this.pour.st); this.pour = null; this.cool = this.delay * .5; } return; }
    if (this.cool > 0) return;
    this.cool = this.delay * (.7 + this.r() * .6);
    // griddle jobs first
    for (let i = 0; i < 3; i++) { const g = S.griddle[i]; if (g && (g.state === 'flip' || g.state === 'burnt')) { S.griddleTap(i); return; } }
    // anything ready that somebody wants
    const refs = [];
    for (let i = 0; i < 3; i++) if (S.griddle[i]?.state === 'done') refs.push({ at: 'griddle', i });
    for (let i = 0; i < 2; i++) if (S.toaster[i]?.ready) refs.push({ at: 'toaster', i });
    if (S.urn.glass?.ready) refs.push({ at: 'urn' }); if (S.fount.glass?.ready) refs.push({ at: 'fount' });
    for (let i = 0; i < 3; i++) if (S.pass[i]) refs.push({ at: 'pass', i });
    for (const ref of refs) {
      const k = S.peek(ref).kind;
      if (S.target(k)) { S.autoServe(ref); return; }
      const hush = S.parties.find(p => p.state === 'hush' && p.need.includes(k));
      if (hush && this.memory) { S.serveTo(ref, hush.seat); return; }
    }
    for (const ref of refs) if (ref.at !== 'pass' && !this.wanted().length) { /* idle */ }
    for (const ref of refs) if (ref.at === 'urn' || ref.at === 'fount' || ref.at === 'griddle') { if (S.autoServe(ref) === 'full') S.bin(ref); return; }
    // dirty places
    for (let i = 0; i < 5; i++) if (S.stools[i].dirty) { S.clear(i); return; }
    const want = this.wanted();
    for (const k of want) {
      if (k === 'coffee' || k === 'tea') { if (!S.urn.glass) { S.pourStart('urn', k); this.pour = { st: 'urn', at: LINE + (this.r() - .5) * this.slop * 2 }; return; } }
      else if (['milk', 'choc', 'straw', 'cola'].includes(k)) { if (!S.fount.glass) { S.pourStart('fount', k); this.pour = { st: 'fount', at: LINE + (this.r() - .5) * this.slop * 2 }; return; } }
      else if (k === 'toast') { if (S.toast() !== false) return; }
      else if (k === 'eggs' || k === 'burger') { if (S.griddleAdd(k) !== false) return; }
      else if (k === 'apple' || k === 'cherry') { const p = S.parties.find(p => p.need.includes(k) && (p.state === 'wait')); if (p && S.peek({ at: 'pie', kind: k })) { S.autoServe({ at: 'pie', kind: k }); return; } const h = S.parties.find(p => p.need.includes(k) && p.state === 'hush'); if (h && S.peek({ at: 'pie', kind: k })) { S.serveTo({ at: 'pie', kind: k }, h.seat); return; } }
    }
  }
}
