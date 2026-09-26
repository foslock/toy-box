// The binder: an open ring binder whose sheets have twelve sleeves a side (three across, four down). It never runs out
// of sheets. Only the sheets near the open spread are built; cards load their faces as they come into view.
import { LO } from './faces.js';
import { CARD_W, CARD_H } from './card.js';
import { SETS } from './sets/index.js';

const COLS = 3, ROWS = 4, PER_SIDE = COLS * ROWS, PER_SHEET = PER_SIDE * 2;
const POCKET_W = CARD_W + .34, POCKET_H = CARD_H + .34, GAP = .14;
const SPINE_M = 1.35, OUTER_M = .45, TOP_M = .55;
const SHEET_W = SPINE_M + COLS * POCKET_W + (COLS - 1) * GAP + OUTER_M;
const SHEET_H = TOP_M * 2 + ROWS * POCKET_H + (ROWS - 1) * GAP;
const SPINE = 1.1, COVER_PAD = .7;
const FONT = 'Fredoka, system-ui, sans-serif', BODY = 'Nunito, system-ui, sans-serif';

export class Binder {
  constructor(ctx) {
    Object.assign(this, ctx);
    const THREE = this.THREE;
    this.root = new THREE.Group();        // positioned and scaled to fit
    this.book = new THREE.Group();        // tilts a little with the pointer
    this.root.add(this.book);
    this.root.visible = false;
    this.scene.add(this.root);
    this.spread = 0; this.sheets = new Map(); this.list = []; this.turning = null; this.dimmed = 0; this.hover = null;
    this.tilt = new THREE.Vector2();
    this.mats = this.makeMaterials();
    this.buildCover();
  }
  makeMaterials() {
    const THREE = this.THREE;
    const tex = (w, h, paint, color = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (color) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    // leatherette cover with stitching
    const leather = tex(512, 512, (g, w, h) => {
      g.fillStyle = '#2b2350'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    });
    leather.wrapS = leather.wrapT = THREE.RepeatWrapping; leather.repeat.set(3, 4);
    // a sheet: black backing, pocket seams, ring holes along the spine edge
    const sheetTex = tex(512, Math.round(512 * SHEET_H / SHEET_W), (g, w, h) => {
      const sx = w / SHEET_W, sy = h / SHEET_H;
      g.fillStyle = '#16141d'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .025})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const x = (SPINE_M + c * (POCKET_W + GAP)) * sx, y = (TOP_M + r * (POCKET_H + GAP)) * sy;
        g.fillStyle = 'rgba(255,255,255,.035)'; g.beginPath(); g.roundRect(x, y, POCKET_W * sx, POCKET_H * sy, 6); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 2; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.08)'; g.setLineDash([6, 6]); g.beginPath(); g.roundRect(x + 8, y + 8, POCKET_W * sx - 16, POCKET_H * sy - 16, 5); g.stroke(); g.setLineDash([]);
        g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.ellipse(x + POCKET_W * sx / 2, y + 3, POCKET_W * sx * .18, 5, 0, 0, Math.PI); g.fill();
      }
      for (const fy of [.18, .5, .82]) { g.fillStyle = '#050407'; g.beginPath(); g.arc(SPINE_M * .45 * sx, h * fy, 9, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 2; g.stroke(); }
    });
    // clear plastic over the cards: nearly invisible, but it catches the light
    const sleeveTex = tex(256, Math.round(256 * SHEET_H / SHEET_W), (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      const sx = w / SHEET_W, sy = h / SHEET_H;
      g.strokeStyle = '#fff'; g.lineWidth = 3;
      for (let r = 0; r <= ROWS; r++) { const y = (TOP_M + r * (POCKET_H + GAP) - GAP / 2) * sy; g.beginPath(); g.moveTo(SPINE_M * sx * .8, y); g.lineTo(w, y); g.stroke(); }
      for (let c = 0; c <= COLS; c++) { const x = (SPINE_M + c * (POCKET_W + GAP) - GAP / 2) * sx; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    }, false);
    return {
      cover: new THREE.MeshStandardMaterial({ map: leather, color: 0xffffff, roughness: .75, metalness: 0 }),
      edge: new THREE.MeshStandardMaterial({ color: 0x1c1738, roughness: .8 }),
      sheet: new THREE.MeshStandardMaterial({ map: sheetTex, roughness: .9, side: THREE.DoubleSide }),
      sleeve: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .06, roughness: .18, clearcoat: 1, clearcoatRoughness: .1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.2, alphaMap: sleeveTex, alphaTest: 0 }),
      seams: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .12, alphaMap: sleeveTex, depthWrite: false, side: THREE.DoubleSide }),
      ring: new THREE.MeshStandardMaterial({ color: 0xe8ecf2, metalness: 1, roughness: .2 }),
    };
  }
  buildCover() {
    const THREE = this.THREE, m = this.mats;
    const cw = SHEET_W + COVER_PAD, ch = SHEET_H + COVER_PAD * 2, t = .35;
    const board = new THREE.BoxGeometry(cw, ch, t);
    this.leftCover = new THREE.Mesh(board, [m.edge, m.edge, m.edge, m.edge, m.cover, m.cover]);
    this.leftCover.position.set(-SPINE / 2 - cw / 2, 0, -t / 2 - .3);
    this.rightCover = new THREE.Mesh(board, [m.edge, m.edge, m.edge, m.edge, m.cover, m.cover]);
    this.rightCover.position.set(SPINE / 2 + cw / 2, 0, -t / 2 - .3);
    this.spineMesh = new THREE.Mesh(new THREE.BoxGeometry(SPINE + .2, ch, t), m.cover);
    this.spineMesh.position.set(0, 0, -t / 2 - .45);
    this.book.add(this.leftCover, this.rightCover, this.spineMesh);
    // rings, half above the sheets
    for (const fy of [.32, 0, -.32]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.62, .09, 12, 32, Math.PI), m.ring);
      ring.rotation.set(0, Math.PI / 2, 0); ring.position.set(0, fy * SHEET_H, -.1);
      this.book.add(ring);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(.5, SHEET_H * .8, .12), m.ring);
    bar.position.set(0, 0, -.22); this.book.add(bar);
    // the inside of the front cover: a title page
    this.titleTex = null;
    this.titleMesh = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W - .4, SHEET_H - .4), new THREE.MeshStandardMaterial({ roughness: .9 }));
    this.titleMesh.position.set(-SPINE / 2 - SHEET_W / 2 - .1, 0, -.1);
    this.book.add(this.titleMesh);
  }
  paintTitle() {
    const THREE = this.THREE, w = 512, h = Math.round(512 * SHEET_H / SHEET_W);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#221b44'); gr.addColorStop(1, '#161229'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,215,106,.55)'; g.lineWidth = 3; g.strokeRect(24, 24, w - 48, h - 48);
    g.textAlign = 'center'; g.fillStyle = '#ffd76a'; g.font = `700 46px ${FONT}`; g.fillText('ODDS & ENDS', w / 2, 150);
    g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `800 17px ${BODY}`; g.fillText('M Y   C O L L E C T I O N', w / 2, 185);
    const st = this.store.collectionStats();
    let y = 270;
    for (const p of st.perSet) {
      g.fillStyle = '#fff'; g.font = `600 26px ${FONT}`; g.fillText(p.set.name, w / 2, y);
      g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `600 19px ${BODY}`; g.fillText(`${p.found} of ${p.total} found · ${p.variants} of ${p.totalVariants} with every finish`, w / 2, y + 30);
      const bw = w - 140, fr = p.found / p.total;
      g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.roundRect(70, y + 48, bw, 12, 6); g.fill();
      g.fillStyle = '#ffd76a'; g.beginPath(); g.roundRect(70, y + 48, Math.max(12, bw * fr), 12, 6); g.fill();
      y += 120;
    }
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `600 19px ${BODY}`;
    g.fillText(`${st.count.toLocaleString('en-US')} cards · worth $${Math.round(st.value / 100).toLocaleString('en-US')}`, w / 2, h - 120);
    g.font = `italic 600 17px ${BODY}`; g.fillStyle = 'rgba(255,255,255,.5)'; g.fillText('Tap a card to take it out of its sleeve.', w / 2, h - 80);
    this.titleTex?.dispose();
    this.titleTex = new THREE.CanvasTexture(c); this.titleTex.colorSpace = THREE.SRGBColorSpace;
    this.titleMesh.material.map = this.titleTex; this.titleMesh.material.needsUpdate = true;
  }
  get sheetCount() { return Math.max(1, Math.ceil(this.list.length / PER_SHEET)) + 1; }
  get maxSpread() { return this.sheetCount - 1; }
  pageLabel() {
    const s = this.spread;
    if (this.view.portrait) { const p = this.side === 'left' ? s * 2 : s * 2 + 1; return p === 0 ? 'Inside cover' : `Page ${p} of ${this.sheetCount * 2 - 1}`; }
    return s === 0 ? `Page 1 of ${this.sheetCount * 2 - 1}` : `Pages ${s * 2}–${s * 2 + 1} of ${this.sheetCount * 2 - 1}`;
  }
  canPrev() { return this.view.portrait ? !(this.spread === 0 && this.side === 'left') : this.spread > 0; }
  canNext() { return this.view.portrait ? !(this.spread >= this.maxSpread && this.side === 'right') : this.spread < this.maxSpread; }
  // area: { y, h } — the free band of screen for the binder, in world units (set by the page, from its toolbars)
  layout() {
    const cw = SHEET_W + COVER_PAD, spreadW = cw * 2 + SPINE, h = SHEET_H + COVER_PAD * 2;
    const portrait = this.view.portrait, area = this.area ?? { y: -.4, h: this.VIEW_H * .72 };
    const s = portrait ? Math.min(area.h * .98 / h, this.view.W * .96 / cw) : Math.min(area.h * .98 / h, this.view.W * .95 / spreadW);
    this.scale = s;
    this.root.scale.setScalar(s);
    const x = portrait ? (this.side === 'left' ? 1 : -1) * (SPINE / 2 + cw / 2) * s : 0;
    this.root.position.set(x, area.y, 0);
  }
  // Build the list from the store and put the sheets for the open spread in place.
  load() {
    this.list = this.store.sortedCollection(undefined, this.filter || null);
    this.spread = Math.min(this.spread, this.maxSpread);
    this.paintTitle();
  }
  async open() {
    this.side = this.side ?? 'right';
    this.load();
    this.layout();
    this.root.visible = true;
    this.showSpread();
    const target = this.root.position.clone();
    this.root.position.y -= this.VIEW_H;
    await this.moveTo(this.root, { p: target.toArray() }, .55, this.ease.out);
  }
  async close() {
    await this.moveTo(this.root, { p: [this.root.position.x, this.root.position.y - this.VIEW_H * 1.1, 0] }, .45, this.ease.in);
    this.root.visible = false;
    for (const s of this.sheets.values()) this.disposeSheet(s);
    this.sheets.clear();
  }
  async refresh(toStart = false) {
    if (toStart) this.spread = 0;
    for (const s of this.sheets.values()) this.disposeSheet(s);
    this.sheets.clear();
    this.load();
    this.showSpread();
  }
  // A sheet: a group pivoting on the spine; its front faces +z when it lies on the right.
  sheet(i) {
    if (this.sheets.has(i)) return this.sheets.get(i);
    const THREE = this.THREE, m = this.mats;
    const g = new THREE.Group();
    g.position.set(SPINE / 2 - .15, 0, 0);
    const base = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W, SHEET_H), m.sheet);
    base.position.set(SHEET_W / 2, 0, 0);
    g.add(base);
    for (const side of [1, -1]) {
      const sleeve = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W, SHEET_H), m.sleeve);
      sleeve.position.set(SHEET_W / 2, 0, side * .09); sleeve.renderOrder = 2;
      const seams = new THREE.Mesh(sleeve.geometry, m.seams); seams.position.copy(sleeve.position); seams.renderOrder = 3;
      if (side < 0) { sleeve.rotation.y = Math.PI; seams.rotation.y = Math.PI; }
      g.add(sleeve, seams);
    }
    const sheet = { i, group: g, cards: [] };
    for (let k = 0; k < PER_SHEET; k++) {
      const idx = i * PER_SHEET + k, e = this.list[idx];
      if (!e) break;
      const back = k >= PER_SIDE, slot = k % PER_SIDE, col = slot % COLS, row = Math.floor(slot / COLS);
      const card = this.makeCard(e.card, this.faces.get(e.card, LO));
      card.entryAt = e.at;
      // on the back of a sheet the columns run the other way, so once it's turned over they still read left to right
      const c = back ? COLS - 1 - col : col;
      const cx = SPINE_M + c * (POCKET_W + GAP) + POCKET_W / 2, cy = SHEET_H / 2 - TOP_M - row * (POCKET_H + GAP) - POCKET_H / 2;
      card.holder.position.set(cx, cy, back ? -.045 : .045);
      if (back) card.holder.rotation.y = Math.PI;
      card.holder.scale.setScalar(.985);
      g.add(card.holder);
      sheet.cards.push(card);
    }
    this.book.add(g);
    this.sheets.set(i, sheet);
    return sheet;
  }
  disposeSheet(s) {
    for (const c of s.cards) this.disposeCard(c);
    s.group.traverse(o => { if (o.geometry && o.isMesh && !o.userData.card) o.geometry.dispose(); });
    s.group.removeFromParent();
  }
  // Sheets 0 … spread−1 are turned over to the left; the rest lie on the right.
  showSpread() {
    const keep = new Set([this.spread - 1, this.spread].filter(i => i >= 0 && i < this.sheetCount));
    for (const [i, s] of this.sheets) if (!keep.has(i)) { this.disposeSheet(s); this.sheets.delete(i); }
    for (const i of keep) {
      const s = this.sheet(i);
      s.group.rotation.y = i < this.spread ? -Math.PI : 0;
      s.group.position.z = i < this.spread ? .02 : 0;
    }
    this.titleMesh.visible = this.spread === 0;
  }
  async turn(dir) {
    if (this.turning) return this.turning;
    const portrait = this.view.portrait;
    if (portrait) {
      // on a phone the camera looks at one page at a time: left page, right page, then turn
      if (dir > 0 && this.side === 'left') { this.side = 'right'; return this.pan(); }
      if (dir < 0 && this.side === 'right') { this.side = 'left'; if (this.spread === 0) { this.side = 'left'; } return this.pan(); }
    }
    const next = this.spread + dir;
    if (next < 0 || next > this.maxSpread) { this.sound.denied?.(); return; }
    this.sound.page();
    const turning = dir > 0 ? this.sheet(this.spread) : this.sheet(this.spread - 1);
    // make sure what's underneath exists
    if (dir > 0 && next < this.sheetCount) this.sheet(next);
    if (dir < 0 && next - 1 >= 0) this.sheet(next - 1);
    if (dir < 0 && next === 0) this.titleMesh.visible = true;
    const from = turning.group.rotation.y, to = dir > 0 ? -Math.PI : 0;
    this.turning = this.anim(.62, (x, k) => {
      turning.group.rotation.y = from + (to - from) * x;
      turning.group.position.z = .02 + Math.sin(k * Math.PI) * 1.2;
      turning.group.rotation.x = Math.sin(k * Math.PI) * .05;
    }, this.ease.inOut);
    if (portrait) { this.side = dir > 0 ? 'left' : 'right'; this.pan(.62); }
    await this.turning;
    this.turning = null;
    this.spread = next;
    this.showSpread();
  }
  pan(dur = .4) {
    const cw = SHEET_W + COVER_PAD, x = (this.side === 'left' ? 1 : -1) * (SPINE / 2 + cw / 2) * this.scale;
    return this.moveTo(this.root, { p: [x, this.root.position.y, 0] }, dur, this.ease.inOut);
  }
  visibleCards() {
    const out = [];
    for (const s of this.sheets.values()) {
      const onLeft = s.group.rotation.y < -Math.PI / 2;
      for (const c of s.cards) { const back = c.holder.rotation.y !== 0; if (back === onLeft && c.holder.visible) out.push(c); }
    }
    return out;
  }
  handler({ onPick, onPage }) {
    let start = null;
    const pick = () => {
      this.raycaster.setFromCamera(this.pointer.ndc, this.camera);
      const hits = this.raycaster.intersectObjects(this.visibleCards().map(c => c.mesh), false);
      return hits.length ? hits[0].object.userData.card : null;
    };
    return {
      cursor: () => this.hover ? 'point' : (this.pointer.down ? 'grabbing' : ''),
      hover: () => { this.hover = pick(); },
      down: () => { start = { x: this.pointer.x, y: this.pointer.y }; },
      move: () => {},
      up: async (e, tap) => {
        if (!start) return;
        const dx = this.pointer.x - start.x; start = null;
        if (tap) { const c = pick(); if (c) { this.hover = null; this.sound.whoosh?.(.4); await onPick(c, c.entryAt); } return; }
        if (Math.abs(dx) > 40) { await this.turn(dx < 0 ? 1 : -1); onPage(); }
      },
      key: e => {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') { this.turn(1).then(onPage); return true; }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') { this.turn(-1).then(onPage); return true; }
        if (e.key === 'Escape') { document.getElementById('closeBinder').click(); return true; }
      },
    };
  }
  dim(on) { this.dimTarget = on ? 1 : 0; }
  update(dt, T) {
    if (!this.root.visible) return;
    const p = this.pointer;
    const tx = p.over && !this.view.portrait ? p.ndc.x * .06 : 0, ty = p.over && !this.view.portrait ? -p.ndc.y * .05 : 0;
    this.tilt.x += (ty - .1 - this.tilt.x) * Math.min(1, dt * 4); this.tilt.y += (tx - this.tilt.y) * Math.min(1, dt * 4);
    this.book.rotation.set(this.tilt.x, this.tilt.y, 0);
    this.dimmed += ((this.dimTarget ?? 0) - this.dimmed) * Math.min(1, dt * 8);
    for (const s of this.sheets.values()) for (const c of s.cards) {
      if (c.inspecting) continue;
      const on = c === this.hover ? 1 : 0;
      c.hov = (c.hov ?? 0) + (on - (c.hov ?? 0)) * Math.min(1, dt * 12);
      c.mesh.position.z = c.hov * .5;
      c.dim = 1 - this.dimmed * .6;
    }
  }
}
