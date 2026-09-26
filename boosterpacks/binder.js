// The binder: an open ring binder whose sheets have nine sleeves a side (three across, three down). It never runs out
// of sheets. Only the sheets near the open spread are built; cards load their faces as they come into view.
import { LO } from './faces.js';
import { CARD_W, CARD_H, CARD_T, CARD_R } from './card.js';
import { SETS } from './sets/index.js';

const COLS = 3, ROWS = 3, PER_SIDE = COLS * ROWS, PER_SHEET = PER_SIDE * 2;
const POCKET_W = CARD_W + .34, POCKET_H = CARD_H + .34, GAP = .14;
const SPINE_M = 1.35, OUTER_M = .45, TOP_M = .55;
const SHEET_W = SPINE_M + COLS * POCKET_W + (COLS - 1) * GAP + OUTER_M;
const SHEET_H = TOP_M * 2 + ROWS * POCKET_H + (ROWS - 1) * GAP;
const SPINE = 1.1, COVER_PAD = .7;
const HOLE = SPINE_M * .45;                // from a sheet's inner edge to its ring holes
const RING_R = HOLE + .4;                  // ring radius: a sheet lying flat has its holes on a ring's foot
const BEND = .45;                          // how far a turning page's top outer corner leads the rest of it (radians)
const LAYER = .2;                          // stacked sheets sit this far apart: a sheet's own thickness, sleeves and all
const SEE = .4;                            // how much shows through a sheet's pockets: a card's back, or the page below
const FONT = 'Fredoka, system-ui, sans-serif', BODY = 'Nunito, system-ui, sans-serif';

// A card's front, back and rim as a fine grid, shaped like the real card (same size, corners and texture mapping), so a
// card can bend along with its page while the page turns. The real card geometry is one flat slab.
let GRID = null;
function gridCard(THREE) {
  if (GRID) return GRID;
  const nx = 12, ny = 16, W = CARD_W, H = CARD_H, R = CARD_R, t = CARD_T / 2;
  const face = new THREE.PlaneGeometry(W, H, nx, ny), fp = face.attributes.position;
  for (let i = 0; i < fp.count; i++) {   // round the corners: pull corner points in onto the curve
    let x = fp.getX(i), y = fp.getY(i);
    const ex = Math.abs(x) - (W / 2 - R), ey = Math.abs(y) - (H / 2 - R), d = Math.hypot(ex, ey);
    if (ex > 0 && ey > 0 && d > R) { x = Math.sign(x) * (W / 2 - R + ex / d * R); y = Math.sign(y) * (H / 2 - R + ey / d * R); }
    fp.setXY(i, x, y);
  }
  const P = [], U = [], I = [];
  const n = fp.count, faceIdx = face.index.array;
  for (const side of [1, -1]) {   // front (+z), then the back, turned over so it reads right from behind
    const o = P.length / 3;
    for (let i = 0; i < n; i++) { const x = fp.getX(i), y = fp.getY(i); P.push(side * x, y, side * t); U.push(x / W + .5, y / H + .5); }
    for (const k of faceIdx) I.push(o + k);
  }
  const at = (ix, iy) => iy * (nx + 1) + ix, outline = [];   // the outline, counter-clockwise from the bottom left
  for (let ix = 0; ix < nx; ix++) outline.push(at(ix, ny));
  for (let iy = ny; iy > 0; iy--) outline.push(at(nx, iy));
  for (let ix = nx; ix > 0; ix--) outline.push(at(ix, 0));
  for (let iy = 0; iy < ny; iy++) outline.push(at(0, iy));
  const rim = P.length / 3;
  for (const k of outline) { const x = fp.getX(k), y = fp.getY(k); P.push(x, y, t, x, y, -t); U.push(0, 0, 0, 0); }
  const m = outline.length;
  for (let j = 0; j < m; j++) { const a = rim + j * 2, b = rim + ((j + 1) % m) * 2; I.push(a, a + 1, b + 1, a, b + 1, b); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geo.setIndex(I);
  const fi = faceIdx.length;
  geo.addGroup(0, fi, 0); geo.addGroup(fi, fi, 1); geo.addGroup(fi * 2, m * 6, 2);
  geo.computeVertexNormals();
  face.dispose();
  return (GRID = geo);
}

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
    // while the binder dims behind a card being looked at, the sheets' see-through backings close up (veil 0 → 1), so
    // whatever shows through dims along with the fronts
    const veil = this.veil = { value: 0 };
    this.veilShader = sh => {
      sh.uniforms.uVeil = veil;
      sh.fragmentShader = 'uniform float uVeil;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', 'diffuseColor.a *= mix(texture2D(alphaMap, vAlphaMapUv).g, 1., uVeil);');
    };
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
    // Where the cards sit, the backing is see-through: from one side of a sheet you make out the back of a card on the
    // other side, or through a pocket that's empty on both, the page underneath. (Just inside a card's outline, so
    // around a card the backing stays solid.)
    const pocketsTex = tex(512, Math.round(512 * SHEET_H / SHEET_W), (g, w, h) => {
      const sx = w / SHEET_W, sy = h / SHEET_H, a = Math.round(255 * (1 - SEE)), cw = CARD_W * .985 - .1, ch = CARD_H * .985 - .1;
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
      g.fillStyle = `rgb(${a},${a},${a})`;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const x = SPINE_M + c * (POCKET_W + GAP) + POCKET_W / 2, y = TOP_M + r * (POCKET_H + GAP) + POCKET_H / 2;
        g.beginPath(); g.roundRect((x - cw / 2) * sx, (y - ch / 2) * sy, cw * sx, ch * sy, CARD_R * sx); g.fill();
      }
    }, false);
    // clear plastic over the cards: nearly invisible, but it catches the light
    const sleeveTex = tex(256, Math.round(256 * SHEET_H / SHEET_W), (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      const sx = w / SHEET_W, sy = h / SHEET_H;
      g.strokeStyle = '#fff'; g.lineWidth = 3;
      for (let r = 0; r <= ROWS; r++) { const y = (TOP_M + r * (POCKET_H + GAP) - GAP / 2) * sy; g.beginPath(); g.moveTo(SPINE_M * sx * .8, y); g.lineTo(w, y); g.stroke(); }
      for (let c = 0; c <= COLS; c++) { const x = (SPINE_M + c * (POCKET_W + GAP) - GAP / 2) * sx; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    }, false);
    const sheet = new THREE.MeshStandardMaterial({ map: sheetTex, alphaMap: pocketsTex, transparent: true, roughness: .9, side: THREE.DoubleSide });
    sheet.onBeforeCompile = this.veilShader;
    return {
      cover: new THREE.MeshStandardMaterial({ map: leather, color: 0xffffff, roughness: .75, metalness: 0 }),
      edge: new THREE.MeshStandardMaterial({ color: 0x1c1738, roughness: .8 }),
      sheet,
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
    // rings: an arch standing up over the spine at each row of holes, dipping into the mechanism at both ends
    for (const fy of [.32, 0, -.32]) {
      const geo = new THREE.TorusGeometry(RING_R, .085, 12, 48, Math.PI + .5); geo.rotateZ(-.25);
      const ring = new THREE.Mesh(geo, m.ring);
      ring.rotation.set(Math.PI / 2, 0, 0); ring.position.set(0, fy * SHEET_H, 0);
      this.book.add(ring);
    }
    // the ring mechanism: a metal plate along the spine, under the pages
    // (a shallow arch of a wide cylinder running up the spine; its edges sink under the covers)
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, SHEET_H * .86, 40, 1, true, -.75, 1.5), m.ring);
    plate.position.set(0, 0, -.2 - 1.8);
    this.book.add(plate);
    // the inside of the front cover: a title page
    this.titleTex = null;
    this.titleMesh = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W - .4, SHEET_H - .4), new THREE.MeshStandardMaterial({ roughness: .9 }));
    this.titleMesh.position.set(-SPINE / 2 - SHEET_W / 2 - .1, 0, -.285);   // on the cover, under every sheet on the left
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
    // Centred lines of coloured parts ([text, colour]), laid out the first of the given ways that fits well inside the
    // frame (each way is a list of lines). Returns the last line's y.
    const say = (ways, y, lh) => {
      const width = parts => g.measureText(parts.map(p => p[0]).join(' ')).width, space = g.measureText(' ').width;
      const lines = ways.find(ls => ls.every(l => width(l) <= w - 104)) ?? ways[ways.length - 1];
      g.textAlign = 'left';
      lines.forEach((parts, i) => {
        let x = (w - width(parts)) / 2;
        for (const [t, col] of parts) { g.fillStyle = col; g.fillText(t, x, y + i * lh); x += g.measureText(t).width + space; }
      });
      g.textAlign = 'center';
      return y + (lines.length - 1) * lh;
    };
    // each set: how many of its cards you've found (gold), and how many with every finish too (blue)
    const FOUND = '#ffd76a', EVERY = '#8fd0ff', DIM = 'rgba(255,255,255,.7)';
    const bar = (x, y, bw, fr, col) => { if (fr > 0) { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, Math.max(12, bw * Math.min(1, fr)), 12, 6); g.fill(); } };
    const st = this.store.collectionStats();
    let y = 270;
    for (const p of st.perSet) {
      const locked = !this.store.isUnlocked(p.set), u = locked ? this.store.unlockProgress(p.set) : null;
      g.fillStyle = locked ? 'rgba(255,255,255,.55)' : '#fff'; g.font = `600 26px ${FONT}`; g.fillText((locked ? '🔒 ' : '') + p.set.name, w / 2, y);
      g.font = `600 19px ${BODY}`;
      let end;
      if (locked) {
        const a = [`Unlocks with ${u.need} different`, DIM], b = [`${u.from.name} cards · ${u.have} so far`, DIM];
        end = say([[[a, b]], [[a], [b]]], y + 30, 24);
      } else {
        const a = [`${p.found} of ${p.total} found`, FOUND], b = [`${p.variants} of ${p.totalVariants} with every finish`, EVERY];
        end = say([[[a, ['·', DIM], b]], [[a], [b]]], y + 30, 24);
      }
      const by = end + 18, bw = w - 140;
      g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.roundRect(70, by, bw, 12, 6); g.fill();
      if (locked) bar(70, by, bw, u.have / u.need, 'rgba(255,255,255,.5)');
      else { bar(70, by, bw, p.found / p.total, FOUND); bar(70, by, bw, p.variants / p.totalVariants, EVERY); }   // every finish is never ahead of found
      y = by + 72;
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
  // A sheet: a group whose origin sits on the rings at its holes; the page runs out along its +x, and its front faces +z
  // when it lies on the right. Its page and sleeves are finely divided so they can bend as the sheet turns.
  sheet(i) {
    if (this.sheets.has(i)) return this.sheets.get(i);
    const THREE = this.THREE, m = this.mats;
    const g = new THREE.Group();
    const page = (z, flip) => {
      const geo = new THREE.PlaneGeometry(SHEET_W, SHEET_H, 24, 6);
      if (flip) {   // turned to face the back, with its texture mirrored back so the seams still run between the pockets
        geo.rotateY(Math.PI);
        const uv = geo.attributes.uv;
        for (let j = 0; j < uv.count; j++) uv.setX(j, 1 - uv.getX(j));
      }
      geo.translate(SHEET_W / 2 - HOLE, 0, z);
      geo.userData.rest = geo.attributes.position.array.slice();
      return geo;
    };
    const base = new THREE.Mesh(page(0), m.sheet);
    g.add(base);
    const bendGeos = [base.geometry];
    for (const side of [1, -1]) {
      const geo = page(side * .09, side < 0);
      const sleeve = new THREE.Mesh(geo, m.sleeve); sleeve.renderOrder = 2;
      const seams = new THREE.Mesh(geo, m.seams); seams.renderOrder = 3;
      g.add(sleeve, seams);
      bendGeos.push(geo);
    }
    const sheet = { i, group: g, cards: [], bendGeos, bent: false, clear: g.children.filter(o => o.renderOrder) };
    for (let k = 0; k < PER_SHEET; k++) {
      const idx = i * PER_SHEET + k, e = this.list[idx];
      if (!e) break;
      const back = k >= PER_SIDE, slot = k % PER_SIDE, col = slot % COLS, row = Math.floor(slot / COLS);
      const card = this.makeCard(e.card, this.faces.get(e.card, LO));
      card.entryAt = e.at;
      // on the back of a sheet the columns run the other way, so once it's turned over they still read left to right
      const c = back ? COLS - 1 - col : col;
      const cx = SPINE_M + c * (POCKET_W + GAP) + POCKET_W / 2 - HOLE, cy = SHEET_H / 2 - TOP_M - row * (POCKET_H + GAP) - POCKET_H / 2;
      card.rest = { x: cx, y: cy, z: back ? -.045 : .045, ry: back ? Math.PI : 0 };
      card.holder.position.set(cx, cy, card.rest.z);
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
  // Sheets 0 … spread−1 are turned over to the left; the rest lie on the right. The open sheets are built, and the one
  // under each, which shows through their empty pockets (the open ones first, so their faces load first).
  showSpread() {
    const keep = new Set([this.spread, this.spread - 1, this.spread + 1, this.spread - 2].filter(i => i >= 0 && i < this.sheetCount));
    for (const [i, s] of this.sheets) if (!keep.has(i)) { this.disposeSheet(s); this.sheets.delete(i); }
    for (const i of keep) { const s = this.sheet(i); this.bend(s, 0); this.place(s, i < this.spread ? Math.PI : 0, this.restZ(i, this.spread)); }
    this.titleMesh.visible = this.spread <= 1;   // it shows through the first sheet's empty pockets too
  }
  // How high sheet i rests with the binder open at a spread: the top sheet of each side on top, each one under it a
  // layer down. Two layers down is under the covers, out of sight.
  restZ(i, spread) { return i < spread ? .02 - (spread - 1 - i) * LAYER : -(i - spread) * LAYER; }
  // The see-through sleeves of the sheet that's turning draw after everyone else's (they're on top).
  setLayer(s, top) { for (const o of s.clear) o.renderOrder = (top ? 4 : 2) + (o.material === this.mats.seams ? 1 : 0); }
  // A sheet turned by phi (0 lying on the right, π on the left) hangs on the rings by its holes: they sit on the
  // rings' arc, and the page runs straight out from the rings' centre.
  place(s, phi, z = 0) {
    s.group.position.set(RING_R * Math.cos(phi), 0, RING_R * Math.sin(phi) + z);
    s.group.rotation.set(0, -phi, 0);
  }
  // Curl a sheet as it turns, as if pulled by its top outer corner: that corner leads by a (radians) and the rest of the
  // page follows, less and less toward the rings and the bottom edge. a = 0 lays it flat again.
  bend(s, a) {
    if (!a && !s.bent) return;
    s.bent = !!a;
    const L = SHEET_W - HOLE, out = [0, 0, 0];
    // Where a point of the flat page (x along it from the holes, height y, z off its face) goes when curled. The page
    // turns by w·(x/L)² at x, w bigger toward the top; x and z below are that bend integrated (as short series).
    const curl = (x, y, z) => {
      if (x <= 0 || !a) { out[0] = x; out[1] = y; out[2] = z; return out; }
      const w = a * (.45 + .55 * (y / SHEET_H + .5)), u = x / L, u2 = u * u, w2 = w * w, ang = w * u2;
      const X = L * u * (1 - w2 * u2 * u2 / 10 + w2 * w2 * u2 * u2 * u2 * u2 / 216), Z = L * w * u * u2 * (1 / 3 - w2 * u2 * u2 / 42);
      out[0] = X - Math.sin(ang) * z; out[1] = y; out[2] = Z + Math.cos(ang) * z;
      return out;
    };
    for (const geo of s.bendGeos) {
      const p = geo.attributes.position, r = geo.userData.rest;
      for (let j = 0; j < p.count; j++) { curl(r[j * 3], r[j * 3 + 1], r[j * 3 + 2]); p.setXYZ(j, out[0], out[1], out[2]); }
      p.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
    }
    // cards bend with it: each one's grid, carried into the sheet's space, curled, and carried back
    const THREE = this.THREE, M = this._m ??= new THREE.Matrix4(), Mi = this._mi ??= new THREE.Matrix4(), v = this._v ??= new THREE.Vector3();
    for (const c of s.cards) {
      if (c.inspecting) continue;
      if (!a) { if (c.flatGeo) { c.bendGeo.dispose(); c.mesh.geometry = c.flatGeo; c.flatGeo = c.bendGeo = null; } continue; }
      if (!c.flatGeo) { c.flatGeo = c.mesh.geometry; c.bendGeo = gridCard(THREE).clone(); c.mesh.geometry = c.bendGeo; }
      c.holder.updateMatrix(); c.mesh.updateMatrix();
      M.multiplyMatrices(c.holder.matrix, c.mesh.matrix); Mi.copy(M).invert();
      const rest = GRID.attributes.position, p = c.bendGeo.attributes.position;
      for (let j = 0; j < rest.count; j++) {
        v.fromBufferAttribute(rest, j).applyMatrix4(M);
        curl(v.x, v.y, v.z); v.set(out[0], out[1], out[2]).applyMatrix4(Mi);
        p.setXYZ(j, v.x, v.y, v.z);
      }
      p.needsUpdate = true; c.bendGeo.computeBoundingSphere();
    }
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
    // make sure what's underneath exists: the sheet it uncovers, and the one under that (it'll show through)
    for (const j of dir > 0 ? [next, next + 1] : [next - 1, next - 2]) if (j >= 0 && j < this.sheetCount) this.sheet(j);
    if (next <= 1) this.titleMesh.visible = true;
    // It swings over on the rings, curling as if pulled by its top outer corner. Every other sheet shifts a layer: on
    // the side it leaves they rise once it has lifted clear, and on the side it lands they sink first, so no two pages
    // ever share a depth.
    const from = dir > 0 ? 0 : Math.PI, to = dir > 0 ? Math.PI : 0, i = turning.i;
    const z0 = this.restZ(i, this.spread), z1 = this.restZ(i, next);
    const others = [...this.sheets.values()].filter(s => s !== turning)
      .map(s => ({ s, phi: s.i < this.spread ? Math.PI : 0, a: this.restZ(s.i, this.spread), b: this.restZ(s.i, next) }));
    for (const o of others) this.place(o.s, o.phi, o.a);
    this.hover = null;
    this.setLayer(turning, true);
    const ramp = (k, a, b) => Math.min(1, Math.max(0, (k - a) / (b - a)));
    this.turning = this.anim(.7, (x, k) => {
      const phi = from + (to - from) * x;
      this.place(turning, phi, z0 + (z1 - z0) * x);
      // the corner leads, but never past lying flat: coming down, it settles onto the page below instead of through it
      this.bend(turning, dir * Math.min(BEND * Math.sin(k * Math.PI), (dir > 0 ? Math.PI - phi : phi) * .85));
      for (const o of others) this.place(o.s, o.phi, o.a + (o.b - o.a) * (o.b > o.a ? ramp(k, .25, .6) : ramp(k, .3, .65)));
    }, this.ease.inOut);
    if (portrait) { this.side = dir > 0 ? 'left' : 'right'; this.pan(.7); }
    await this.turning;
    this.bend(turning, 0);
    this.setLayer(turning, false);
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
      if (s.i !== this.spread && s.i !== this.spread - 1) continue;   // the sheets underneath only show through
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
    this.veil.value = this.dimmed * .6;
    for (const s of this.sheets.values()) for (const c of s.cards) {
      if (c.inspecting) continue;
      const on = c === this.hover ? 1 : 0;
      c.hov = (c.hov ?? 0) + (on - (c.hov ?? 0)) * Math.min(1, dt * 12);
      c.mesh.position.z = c.hov * .5;
      c.dim = 1 - this.dimmed * .6;
    }
  }
}
