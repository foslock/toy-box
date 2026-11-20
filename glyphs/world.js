// Story and rules: who says what, what each answer does. No DOM here, so a bot can play it headless.
import { PAGES, GLYPHS } from './glyphs.js';

const W = (s) => s.split(' ');
export const NUM = { 1: 'one', 2: 'two', 3: 'three' };

export const PLACES = {
  harbour: { name: 'sea', title: 'The harbour', exits: [{ id: 'x-market', to: 'market', sign: 'bread house' }] },
  market: { name: 'bread house', title: 'Bakers’ row', exits: [{ id: 'x-harbour', to: 'harbour', sign: 'sea' }, { id: 'x-court', to: 'court', sign: 'water' }] },
  court: { name: 'water', title: 'The well', exits: [{ id: 'x-market', to: 'market', sign: 'bread house' }, { id: 'x-temple', to: 'temple', sign: 'temple' }, { id: 'x-gate', to: 'gate', sign: 'gate' }] },
  temple: { name: 'temple', title: 'The temple', exits: [{ id: 'x-court', to: 'court', sign: 'water' }] },
  gate: { name: 'gate', title: 'The upper gate', exits: [{ id: 'x-court', to: 'court', sign: 'water' }] },
};

// signs painted on walls (not exits)
export const SIGNS = {
  's-fish': 'fish', 's-sea': 'sea', 's-bakery': 'bread house', 's-window': 'bread many',
  's-well': 'water', 's-childhouse': 'child house', 's-temple': 'temple', 's-gate': 'gate',
};

export const PEOPLE = {
  fisher: { place: 'harbour', name: 'the fisher' },
  child: { place: 'harbour', name: 'the child' },
  baker: { place: 'market', name: 'the baker' },
  customer: { place: 'market', name: 'a customer' },
  neighbor: { place: 'court', name: 'a neighbour' },
  priest: { place: 'temple', name: 'the priest' },
  guard: { place: 'gate', name: 'the guard' },
};

export function newState() {
  return {
    v: 1, place: 'harbour', inv: { coin: 0, bread: 0, water: 0, sun: 0 },
    f: { childN: 2, tries: {} }, cyc: {}, seen: {}, ctx: [], guess: {}, locked: {}, solved: {},
    notes: ['My boat broke up on the rocks last night. The road home runs through this town and out of its upper gate.'],
    visited: { harbour: true }, tut: 0, ended: false, t0: Date.now(),
  };
}

const say = (who, s, pt) => ({ t: 'say', who, w: W(s), pt });
const ask = (who, s, id, pt) => ({ t: 'ask', who, w: W(s), ask: id, pt });
const act = (from, to, item) => ({ t: 'act', from, to, item });
const note = (text) => ({ t: 'note', text });
const fx = (name) => ({ t: 'fx', fx: name });

export class World {
  constructor(state) { this.s = state || newState(); }

  addNote(text) { if (!this.s.notes.includes(text)) this.s.notes.unshift(text); }

  // a line or a sign was read: remember the sentence for each glyph in it
  see(words, src) {
    const key = src + '|' + words.join(' ');
    let i = this.s.ctx.findIndex((c) => c.k === key);
    if (i < 0) { this.s.ctx.push({ k: key, w: words, src }); i = this.s.ctx.length - 1; }
    const fresh = [];
    for (const g of words) {
      if (!GLYPHS[g]) continue;
      const list = this.s.seen[g] || (this.s.seen[g] = []);
      if (!list.length) fresh.push(g);
      if (!list.includes(i)) list.push(i);
    }
    return fresh;
  }

  pageReady(p) { return p.glyphs.every((g) => this.s.seen[g]); }
  readyPages() { return PAGES.filter((p) => this.pageReady(p) && !this.s.solved[p.id]); }

  // try a page: map glyph -> drawing glyph. All four right settles them.
  checkPage(pid, placed) {
    const p = PAGES.find((q) => q.id === pid);
    const right = p.glyphs.filter((g) => placed[g] === g).length;
    if (right === 4) { this.s.solved[pid] = true; for (const g of p.glyphs) this.s.locked[g] = true; }
    return right;
  }

  cycle(id, lines) {
    const n = this.s.cyc[id] || 0;
    this.s.cyc[id] = n + 1;
    return lines[n % lines.length];
  }

  // tap on a person or a thing
  talk(id) {
    const s = this.s, f = s.f, inv = s.inv;
    switch (id) {
      case 'fisher':
        return this.cycle('fisher', [[say('fisher', 'sun good')], [say('fisher', 'fish many', 'pile')], [say('fisher', 'fish good'), say('fisher', 'sea good', 'sea')]]);
      case 'child':
        if (!f.countSeen) {
          f.countSeen = true;
          return [say('child', 'sun good'), say('child', 'fish one', 'b1'), say('child', 'fish two', 'b2'), say('child', 'fish three', 'b3'), say('child', 'fish many', 'pile'), ask('child', 'fish q', 'child', 'game')];
        }
        if (!f.counted) return [ask('child', 'fish q', 'child', 'game')];
        return this.cycle('child', [[say('child', 'child good')], [say('child', 'child want bread')], [say('child', 'fish many', 'pile')]]);
      case 'baker':
        if (!f.bakerMet) { f.bakerMet = true; return [say('baker', 'sun good'), ask('baker', 'you want q', 'baker')]; }
        return [ask('baker', 'you want q', 'baker')];
      case 'customer':
        if (!f.custSeen) {
          f.custSeen = true;
          return [say('customer', 'sun good'), say('baker', 'sun good'), say('baker', 'you want q'), say('customer', 'I want bread'),
            say('baker', 'coin one'), act('customer', 'baker', 'coin'), act('baker', 'customer', 'bread'), say('customer', 'baker good')];
        }
        return this.cycle('customer', [[say('customer', 'bread good')], [say('customer', 'I eat bread')], [say('customer', 'baker good')]]);
      case 'neighbor': {
        const lines = [[say('neighbor', 'sun good')], [say('neighbor', 'water good', 'well')],
          [say('neighbor', f.waterGiven ? 'priest water good' : 'priest water no')],
          [say('neighbor', f.guardFed ? 'guard eat good' : 'guard eat no')], [say('neighbor', 'person many want water', 'well')]];
        return this.cycle('neighbor', lines);
      }
      case 'well':
        if (!inv.water && !f.waterGiven) { inv.water = 1; this.addNote('I drew a jug of water from the well.'); return [act('well', 'you', 'water')]; }
        return [note(inv.water ? 'My jug is already full.' : 'The well is cool and deep.')];
      case 'priest':
        if (inv.water && !f.waterGiven) {
          inv.water = 0; f.waterGiven = true; inv.sun = 1;
          this.addNote('I gave the priest the water. They hung a little sun on a cord round my neck.');
          return [act('you', 'priest', 'water'), fx('basin'), say('priest', 'water good', 'basin'), say('priest', 'you good'), say('priest', 'I give you sun'), act('priest', 'you', 'sun')];
        }
        if (!f.waterGiven) return this.cycle('priest', [[say('priest', 'sun good')], [say('priest', 'temple water no', 'basin')], [say('priest', 'priest want water', 'basin')]]);
        return this.cycle('priest2', [[say('priest', 'sun good')], [say('priest', 'temple water good', 'basin')], [say('priest', 'you go gate q')]]);
      case 'guard':
        if (s.ended) return [say('guard', 'sun good')];
        if (!f.guardMet) {
          f.guardMet = true;
          this.addNote('A guard stands at the upper gate, and it stays shut.');
          return [say('guard', 'gate open no', 'gatedoor'), say('guard', 'person go no'), ask('guard', 'you want q', 'guard')];
        }
        return [ask('guard', 'you want q', 'guard')];
    }
    return [];
  }

  // an answer composed in the composer
  answer(id, w) {
    const s = this.s, f = s.f, inv = s.inv;
    const has = (g) => w.includes(g);
    const neg = (g) => { const i = w.indexOf(g); return i >= 0 && w[i + 1] === 'no'; };
    const yes = (g) => has(g) && !neg(g);
    const greet = has('sun') && has('good') && w.length <= 3;
    const tries = f.tries[id] = (f.tries[id] || 0) + 1;
    switch (id) {
      case 'child': {
        const nums = w.filter((g) => ['one', 'two', 'three', 'many'].includes(g));
        const want = NUM[f.childN];
        if (nums.length === 1 && nums[0] === want) {
          f.counted = true; inv.coin = 1; f.tries.child = 0;
          this.addNote('The child was counting fish, and paid me a coin for playing along.');
          return [say('child', 'good'), say('child', 'you good'), say('child', 'child give you coin'), act('child', 'you', 'coin')];
        }
        if (greet) return [say('child', 'sun good'), ask('child', 'fish q', 'child', 'game')];
        const out = [];
        if (nums.length) out.push(say('child', 'no'), say('child', 'fish ' + want, 'game'));
        else out.push(say('child', 'q'));
        let n; do { n = 1 + Math.floor(Math.random() * 3); } while (n === f.childN);
        f.childN = n;
        out.push(fx('scene'));
        if (!nums.length && tries >= 2) out.push(note('The child keeps pointing at the basket. I think they want a number.'));
        out.push(ask('child', 'fish q', 'child', 'game'));
        return out;
      }
      case 'baker':
        if (yes('bread')) {
          if (inv.bread) return [say('baker', 'bread good')];
          if (inv.coin) {
            inv.coin = 0; inv.bread = 1; f.tries.baker = 0;
            this.addNote('I bought a loaf with the child’s coin.');
            return [say('baker', 'coin one'), act('you', 'baker', 'coin'), act('baker', 'you', 'bread'), say('baker', 'bread good')];
          }
          if (f.guardFed) return [say('baker', 'bread good')];
          this.addNote('The baker wants a coin for bread. I have nothing to pay with.');
          return [say('baker', 'coin q'), say('baker', 'you coin no')];
        }
        if (greet) return [say('baker', 'sun good')];
        if (yes('fish')) return [say('baker', 'fish no'), say('baker', 'bread many', 'shelf')];
        if (yes('water')) return [say('baker', 'water no')];
        return tries >= 3 ? [say('baker', 'q'), note('Maybe I should ask for something the way that customer did.')] : [say('baker', 'q')];
      case 'guard': {
        const pass = yes('go') || yes('open') || (yes('gate') && !has('no'));
        if (greet && !pass) return [say('guard', 'sun good')];
        if (yes('bread') && !pass) {
          if (f.guardFed) return [say('guard', 'I eat good')];
          if (inv.bread) {
            inv.bread = 0; f.guardFed = true;
            this.addNote('The guard wolfed down the bread and looks a lot friendlier.');
            return [act('you', 'guard', 'bread'), say('guard', 'bread good'), say('guard', 'you good')];
          }
          return [say('guard', 'bread q'), say('guard', 'you bread no')];
        }
        if (pass) {
          if (!f.guardFed) {
            this.addNote('The guard is grumbling about something. They seem hungry.');
            return [say('guard', 'I eat no'), say('guard', 'gate open no', 'gatedoor')];
          }
          if (!inv.sun) {
            this.addNote('The guard wants to see something on me before they open up.');
            return [say('guard', 'you sun no'), say('guard', 'person go no')];
          }
          s.ended = true; f.gateOpen = true;
          return [say('guard', 'you sun good'), say('guard', 'I open gate', 'gatedoor'), fx('gate'), say('guard', 'sun good'), fx('end')];
        }
        return tries >= 3 && !f.guardFed ? [say('guard', 'q'), note('The guard waits for an answer. What did they ask?')] : [say('guard', 'q')];
      }
    }
    return [];
  }
}

// one tidy line describing what to do next (used by the bot and for the hint note)
export function goal(s) {
  const f = s.f, inv = s.inv;
  if (!f.counted) return 'child';
  if (!inv.bread && !f.guardFed) return 'baker';
  if (!f.waterGiven && !inv.water) return 'well';
  if (!f.waterGiven) return 'priest';
  return 'guard';
}
