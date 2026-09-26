// A booster box: ten packs opened together. The box opens, the packs spring out into a grid and tear open in a ripple,
// then all ten deal their cards at once, one round at a time, straight into the binder. Quick and methodical.
import * as THREE from 'three';
import { LO, GOLD } from './faces.js';
import { CARD_W, CARD_H } from './card.js';
import { money, itemOf, valueOf, HOLO, FULL, VARIANT_NAME } from './store.js';

const FONT = 'Fredoka, system-ui, sans-serif', BODY = 'Nunito, system-ui, sans-serif';

export class BoxOpening {
  constructor(ctx) {
    Object.assign(this, ctx);
    this.group = new THREE.Group();
    this.stage.add(this.group);
    this.packs3d = []; this.live = new Set(); this.fast = false; this.pulls = [];
  }
  update(dt) {
    if (this.spot) { const s = this.spot, h = s.card.holder; s.t += dt; h.rotation.y = Math.sin(s.t * 1.3) * .3; h.rotation.x = Math.sin(s.t * .9) * .08; }
    for (const p of this.packs3d) {
      p.update(dt);
      if (p.state === 'float') { p.group.position.y = Math.sin(performance.now() / 700 + p.k) * .12; }
    }
  }
  grid() {
    const n = 10, gap = 1, availW = this.view.W * .94, availH = this.VIEW_H * .66;
    let best = null;
    for (const cols of [2, 3, 4, 5, 10]) {
      const rows = Math.ceil(n / cols), s = Math.min(availW / (cols * this.PW + (cols - 1) * gap), availH / (rows * this.PH + (rows - 1) * gap));
      if (!best || s > best.s) best = { cols, rows, s };
    }
    const at = i => {
      const r = Math.floor(i / best.cols), c = i % best.cols, inRow = Math.min(best.cols, n - r * best.cols);
      return new THREE.Vector3((c - (inRow - 1) / 2) * (this.PW + gap) * best.s, ((best.rows - 1) / 2 - r) * (this.PH + gap) * best.s + (this.view.portrait ? .6 : 0), 0);
    };
    return { ...best, at };
  }
  makeBox(prints) {
    const W = 9.2, H = 12.8, D = 6.4, t = .16, wrap = this.set.wrappers[0];
    const g = new THREE.Group();
    const print = document.createElement('canvas'); print.width = 512; print.height = Math.round(512 * H / W);
    const c = print.getContext('2d'), pw = print.width, ph = print.height;
    const gr = c.createLinearGradient(0, 0, 0, ph); gr.addColorStop(0, wrap.colors[0]); gr.addColorStop(.5, wrap.colors[1]); gr.addColorStop(1, wrap.colors[0]);
    c.fillStyle = gr; c.fillRect(0, 0, pw, ph);
    c.drawImage(prints.front, pw * .08, ph * .22, pw * .84, pw * .84 * prints.front.height / prints.front.width * .72);
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, ph * .8, pw, ph * .2);
    c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = `700 ${pw * .1}px ${FONT}`; c.fillText('BOOSTER BOX', pw / 2, ph * .88);
    c.font = `800 ${pw * .042}px ${BODY}`; c.fillStyle = wrap.accent; c.fillText(`10 PACKS · 90 CARDS · ${this.set.name.toUpperCase()}`, pw / 2, ph * .94);
    const g2 = c.createLinearGradient(0, 0, pw, 0); GOLD.forEach((col, i) => g2.addColorStop(i / (GOLD.length - 1), col));
    c.fillStyle = g2; c.fillRect(0, 0, pw, ph * .025); c.fillRect(0, ph * .975, pw, ph * .025);
    const tex = new THREE.CanvasTexture(print); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const board = new THREE.MeshStandardMaterial({ color: wrap.colors[1], roughness: .55, metalness: .2 });
    const inside = new THREE.MeshStandardMaterial({ color: 0xcfc2a8, roughness: .95 });
    const front = new THREE.MeshStandardMaterial({ map: tex, roughness: .45, metalness: .15 });
    const panel = (w, h, d, x, y, z, mats) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats); m.position.set(x, y, z); g.add(m); return m; };
    panel(W, H, t, 0, H / 2, D / 2, [board, board, board, board, front, inside]);
    panel(W, H, t, 0, H / 2, -D / 2, [board, board, board, board, inside, board]);
    panel(t, H, D, -W / 2, H / 2, 0, board); panel(t, H, D, W / 2, H / 2, 0, board);
    panel(W, t, D, 0, t / 2, 0, board);
    const lid = new THREE.Group(); lid.position.set(0, H, -D / 2);
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(W + .3, t * 1.5, D + .3), [board, board, front, inside, board, board]);
    lidMesh.position.set(0, 0, D / 2); lid.add(lidMesh);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(W + .3, 1.6, t), front); flap.position.set(0, -.8, D + .15); lid.add(flap);
    g.add(lid);
    g.userData = { lid, W, H, D };
    return g;
  }
  async run() {
    const { set, packs, results, sleep, moveTo, ease, sound, particles, faces } = this;
    const flat = packs.flat();
    // start making every face now; they'll be ready by the time the cards come out
    const entries = flat.map(c => faces.get(c, LO));
    this.hint('');
    // 1. the box drops in and opens
    const wi = Math.floor(Math.random() * set.wrappers.length), prints = this.wrapperPrints(set, wi);
    const box = this.box = this.makeBox(prints);
    const bs = Math.min(.62 * this.VIEW_H / 12.8, .6 * this.view.W / 9.2);
    box.scale.setScalar(bs); box.rotation.set(.42, -.25, 0);
    box.position.set(0, this.VIEW_H, 0);
    this.group.add(box);
    sound.whoosh(.8);
    this.setActions([{ label: 'Skip', cls: 'ghost glass', onClick: () => this.skipAll() }]);
    await moveTo(box, { p: [0, -bs * 5.2, 0] }, .55, ease.back);
    sound.thump();
    // packs inside, standing in a row front to back
    for (let i = 0; i < 10; i++) {
      const p = new this.Pack(set, set.wrappers[(wi + i) % set.wrappers.length], this.wrapperPrints(set, (wi + i) % set.wrappers.length));
      p.holder = new THREE.Group(); p.holder.add(p.group);
      p.holder.position.set(0, this.PH / 2 + .4, box.userData.D / 2 - .7 - i * (box.userData.D - 1.2) / 9);
      p.k = i; p.state = 'box';
      box.add(p.holder);
      this.packs3d.push(p);
    }
    sound.flip();
    await this.anim(.45, x => { box.userData.lid.rotation.x = -x * 2.1; }, ease.out);
    // 2. out they spring, into a grid
    const G = this.G = this.grid();
    await Promise.all(this.packs3d.map((p, i) => sleep(i * .07).then(async () => {
      this.group.attach(p.holder);
      sound.swish(.6);
      const at = G.at(i);
      await moveTo(p.holder, { p: [at.x, at.y, at.z], s: G.s, r: [0, 0, 0], arc: 3, lift: 2 }, .5, ease.out);
      p.state = 'float';
    })));
    moveTo(box, { p: [0, -this.VIEW_H * 1.2, -4], r: [.9, -.25, 0] }, .5, ease.in).then(() => { box.removeFromParent(); });
    // 3. tear them all open in a ripple
    await sleep(.15);
    await Promise.all(this.packs3d.map((p, i) => sleep(i * .06).then(async () => {
      p.startTear(i % 2 ? -1 : 1);
      const from = -p.dir * (this.PW / 2 + .05);
      await this.anim(.3, x => p.tearToward(from + p.dir * x * (this.PW + 1.2)), ease.inOut);
      if (i % 2 === 0) sound.rip();
      p.group.updateWorldMatrix(true, false);
      particles.burst(p.frontWorld(), 10, { colors: ['#fff6d0', '#ffd76a'], speed: 6, size: .35, life: .6 });
    })));
    await sleep(.25);
    // 4. deal: every pack gives up one card per round, all at once
    let revealed = 0, newCount = 0, soldTotal = 0, holos = 0, fulls = 0, total = 0, best = null;
    const tallyNow = r => this.tally(`Booster box · round <b>${r}</b>/9 · ${revealed}/90 cards · <b>${newCount}</b> new${soldTotal ? ` · sold ${money(soldTotal, { short: true })}` : ''}`);
    tallyNow(0);
    for (let r = 0; r < 9; r++) {
      const rare = r === 8;
      const round = this.packs3d.map((p, i) => ({ p, c: packs[i][r], res: results[i * 9 + r], e: entries[i * 9 + r] }));
      // wait (briefly) for faces
      for (let w = 0; w < 40 && round.some(x => !x.e.ready); w++) await sleep(.05);
      const cs = G.s * 1.02;
      const cards = round.map(x => {
        const card = this.makeCard(x.c, x.e);
        faces.get(x.c, LO);   // the card holds its own reference; the box keeps one until the end
        const pos = x.p.holder.position;
        card.holder.position.set(pos.x, pos.y + (this.PH / 2 - CARD_H / 2 - .8) * G.s, pos.z - .05);
        card.holder.scale.setScalar(cs);
        if (rare || (x.c.v & 3)) card.holder.rotation.y = Math.PI;
        card.res = x.res; card.pack = x.p;
        this.group.add(card.holder);
        this.live.add(card);
        return card;
      });
      if (!this.fast) sound.slide();
      await Promise.all(cards.map((card, i) => sleep(i * .025).then(() => {
        const pos = card.pack.holder.position;
        return moveTo(card.holder, { p: [pos.x, pos.y + (rare ? 1.2 : .9) * G.s * 3, 2 + i * .01] }, rare ? .4 : .26, ease.out);
      })));
      // specials flip over with a flourish, bigger the more they're worth; only the dearest in a round makes a sound
      const specials = cards.filter(c => c.holder.rotation.y !== 0);
      const loudest = [...cards].sort((a, b) => valueOf(b.data) - valueOf(a.data))[0];
      const centre = card => { card.holder.updateWorldMatrix(true, false); return new THREE.Vector3().applyMatrix4(card.holder.matrixWorld); };
      const behind = { backZ: 1.2 };   // cards in a round sit at z ≈ 2 over their packs
      for (const card of cards) if (!specials.includes(card) && this.tierOf(card.data) >= 2) this.celebrate(card.data, centre(card), { ...behind, mini: true, quiet: true });
      if (specials.length) {
        if (rare) this.hint('Ten rares!');
        await Promise.all(specials.map((card, i) => sleep(i * (rare ? .09 : .05)).then(() => this.anim(rare ? .5 : .35, (x, k) => {
          card.holder.rotation.y = Math.PI * (1 - x);
          card.holder.position.z = 2 + Math.sin(k * Math.PI) * 2;
          if (!card.popped && x > .5) {
            card.popped = true;
            if (!this.fast || this.tierOf(card.data) >= 3) this.celebrate(card.data, centre(card), { ...behind, mini: true, quiet: card !== loudest });
          }
        }, ease.inOut))));
      }
      // every card worth $250 or more gets pulled out front for a proper show, dearest last; over $1,000 even when skipping
      const stars = cards.filter(c => { const t = this.tierOf(c.data); return t >= 5 || (t >= 4 && !this.fast); }).sort((a, b) => valueOf(a.data) - valueOf(b.data));
      for (const star of stars) await this.spotlight(star, this.tierOf(star.data));
      for (const card of cards) {
        const v = valueOf(card.data);
        this.pulls.push({ c: card.data, v });
        revealed++; total += v;
        if (card.res.isNew) newCount++;
        if (card.data.v & HOLO) holos++;
        if (card.data.v & FULL) fulls++;
        if (!best || v > best.v) best = { c: card.data, v };
      }
      tallyNow(r + 1);
      await sleep(rare ? 1.6 : specials.length ? .75 : .32);
      if (rare) this.hint('');
      // away: into the binder, or sold on the spot if it's a duplicate and auto-sell is on
      const target = this.binderWorld(4);
      await Promise.all(cards.map((card, i) => sleep(i * .02).then(async () => {
        const h = card.holder;
        if (this.autoSell && card.res.dupe) {
          const v = this.sell(card.res.key);
          soldTotal += v;
          h.updateWorldMatrix(true, false);
          if (v) this.payout(new THREE.Vector3().applyMatrix4(h.matrixWorld), v, 0);
          await moveTo(h, { s: .01, r: [0, Math.PI * 2, 0] }, .3, ease.in);
        } else {
          await moveTo(h, { p: [target.x, target.y, target.z], s: G.s * .08, r: [0, 0, (Math.random() - .5)] }, .38, ease.in);
        }
        h.visible = false;
      })));
      tallyNow(r + 1);
      this.updateCount(true);
      for (const card of cards) { this.live.delete(card); this.disposeCard(card); }
    }
    entries.forEach(e => faces.release(e));
    // 5. the packs fold away
    sound.whoosh(.6);
    await Promise.all(this.packs3d.map((p, i) => sleep(i * .03).then(() => moveTo(p.holder, { p: [p.holder.position.x, p.holder.position.y - this.VIEW_H, -3], r: [.4, .2, .3] }, .45, ease.in))));
    this.tally('');
    this.setActions([]);
    const bi = best && itemOf(best.c);
    const seen = new Set(), best3 = [];
    for (const p of [...this.pulls].sort((a, b) => b.v - a.v)) { const key = `${p.c.set}:${p.c.id}:${p.c.v}`; if (seen.has(key)) continue; seen.add(key); best3.push(p.c); if (best3.length === 3) break; }
    return {
      best: best3,
      title: 'Booster box opened!',
      sub: `90 cards from 10 ${set.name} packs, straight into your binder.`,
      stats: [
        ['New cards', newCount], ['Holos', holos], ['Full arts', fulls],
        ['Best pull', bi ? `${bi.name}${best.c.v & 3 ? ' · ' + VARIANT_NAME[best.c.v & 3] : ''} · ${money(best.v, { short: true })}` : '—'],
        ['Everything in the box', money(total)], ...(soldTotal ? [['Duplicates sold', '+' + money(soldTotal)]] : []),
      ],
    };
  }
  async spotlight(card, tier) {
    const { moveTo, ease } = this, h = card.holder;
    if (tier >= 5) this.setTimeScale(1);
    const saved = { p: h.position.toArray(), s: h.scale.x, r: [h.rotation.x, h.rotation.y, h.rotation.z] };
    const s = Math.min(.56 * this.VIEW_H / CARD_H, .72 * this.view.W / CARD_W);
    this.sound.whoosh(.7);
    await moveTo(h, { p: [0, .4, 7], s, r: [0, 0, 0] }, .55, ease.out);
    h.updateWorldMatrix(true, false);
    const fx = this.celebrate(card.data, new THREE.Vector3().applyMatrix4(h.matrixWorld), { linger: true, backZ: 5.5 });
    this.hint(tier >= 5 ? 'What a pull! Tap to keep going' : 'Tap to keep going');
    this.spot = { card, t: 0 };
    await this.tapOnce(tier >= 5 ? 8000 : 3500);
    this.spot = null; fx.release(); this.hint('');
    await moveTo(h, { p: saved.p, s: saved.s, r: saved.r }, .45, ease.inOut);
    if (this.fast) this.setTimeScale(10);
  }
  skipAll() { this.fast = true; this.setTimeScale(10); this.setActions([]); }
  dispose() {
    for (const card of this.live) this.disposeCard(card);
    for (const p of this.packs3d) p.dispose();
    this.box?.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
    this.group.removeFromParent();
  }
}
