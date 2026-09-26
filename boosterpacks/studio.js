// The photo studio: renders item models, off screen, into transparent pictures for card art and pack wrappers.
// One small WebGL canvas does all of it; each picture is copied out to a 2D canvas and cached.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createKit, disposeObject } from './kit.js';

const DEFAULT_VIEW = { az: 30, el: 16, fov: 24, zoom: 1 };

function radialTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.45, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class Studio {
  constructor() {
    this.canvas = document.createElement('canvas');
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(1);
    this.size = [768, 1072]; r.setSize(768, 1072, false);
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.02;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.VSMShadowMap;
    const s = this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    s.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
    s.environmentIntensity = .85;
    pm.dispose();
    this.hemi = new THREE.HemisphereLight(0xf4f1ff, 0x8a7f74, .55);
    this.key = new THREE.DirectionalLight(0xfff1de, 2.3);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.radius = 9; this.key.shadow.blurSamples = 16;
    this.key.shadow.bias = -.0006;
    Object.assign(this.key.shadow.camera, { left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: .1, far: 40 });
    this.rim = new THREE.DirectionalLight(0xdfeaff, 1.6);
    this.fill = new THREE.DirectionalLight(0xffffff, .35);
    s.add(this.hemi, this.key, this.key.target, this.rim, this.rim.target, this.fill, this.fill.target);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: .26 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.receiveShadow = true;
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, opacity: .42, depthWrite: false, color: 0x000000 }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = .002; this.blob.renderOrder = -1;
    s.add(this.ground, this.blob);
    this.camera = new THREE.PerspectiveCamera(24, 1, .05, 200);
    this.kit = createKit();
    this.cache = new Map();
    this.cacheMax = 24; this.smallMax = 240;
  }

  // build: (kit) => Object3D. o: { w, h, box: [x0, y0, x1, y1] (0–1, y down: where the item should fit),
  //   align: 'bottom' | 'center', view: { az, el, fov, zoom, lift }, seed, shadow: true }
  // The model's own userData.view (and userData.fullView when o.full) is layered over the defaults.
  render(build, o = {}) {
    const k = this.kit, w = o.w ?? 512, h = o.h ?? 384;
    k.seed(o.seed ?? 1);
    const model = build(k);
    // precedence: defaults < the model's view < this kind of picture's framing < the model's full-art view
    const view = { ...DEFAULT_VIEW, ...model.userData.view, ...o.view, ...(o.full ? model.userData.fullView : null) };
    const pivot = new THREE.Group(), root = new THREE.Group();
    pivot.add(model); root.add(pivot);
    this.scene.add(root);
    root.updateMatrixWorld(true);
    // Scale so the biggest side is 2 units, stand it on the floor, centre it.
    const bb = new THREE.Box3().setFromObject(pivot, true), size = bb.getSize(new THREE.Vector3());
    const sc = 2 / Math.max(size.x, size.y, size.z, 1e-6);
    pivot.scale.setScalar(sc);
    pivot.position.set(-(bb.min.x + bb.max.x) / 2 * sc, -bb.min.y * sc, -(bb.min.z + bb.max.z) / 2 * sc);
    root.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(root, true), dim = box.getSize(new THREE.Vector3());
    const az = THREE.MathUtils.degToRad(view.az), el = THREE.MathUtils.degToRad(view.el);
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    // Hero pose for full art: something long and flat (a pencil, a paper clip, a remote) would be a sliver seen from
    // this low camera, so stand it up to face the camera, on a diagonal, floating over its shadow.
    // how long and how wide it is along its own long axis on the floor (it may lie at an angle)
    let axis = null, long = Math.max(dim.x, dim.z), wide = Math.min(dim.x, dim.z);
    if (o.full && !model.userData.fullView && !model.userData.noHero) {
      const P = collectPoints(root); let mx = 0, mz = 0, xx = 0, zz = 0, xz = 0;
      for (const p of P) { mx += p.x; mz += p.z; } mx /= P.length; mz /= P.length;
      for (const p of P) { const a = p.x - mx, b = p.z - mz; xx += a * a; zz += b * b; xz += a * b; }
      const t = .5 * Math.atan2(2 * xz, xx - zz), c = Math.cos(t), sn = Math.sin(t);
      let lo = Infinity, hi = -Infinity, lo2 = Infinity, hi2 = -Infinity;
      for (const p of P) { const u = p.x * c + p.z * sn, v = -p.x * sn + p.z * c; lo = Math.min(lo, u); hi = Math.max(hi, u); lo2 = Math.min(lo2, v); hi2 = Math.max(hi2, v); }
      long = hi - lo; wide = hi2 - lo2; axis = new THREE.Vector3(c, 0, sn);
      if (wide > long) { [long, wide] = [wide, long]; axis.set(-sn, 0, c); }
    }
    const hero = !!axis && dim.y < .45 * long && dim.y <= wide * 1.05 && long > 1.7 * wide;
    if (hero) {
      pivot.position.y -= dim.y / 2;                                                    // spin about its middle
      const face = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      // turn it about the view so its long side runs up to the right at about 38°
      const seen = axis.clone().applyQuaternion(face), right = new THREE.Vector3(0, 1, 0).cross(dir).normalize(), up = dir.clone().cross(right).normalize();
      const now = Math.atan2(seen.dot(up), seen.dot(right)), want = THREE.MathUtils.degToRad(38);
      let turn = want - now; if (Math.abs(turn) > Math.PI / 2) turn += turn > 0 ? -Math.PI : Math.PI;
      root.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(dir, turn).multiply(face));
      root.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(root, true);
      root.position.y = -box.min.y + (box.max.y - box.min.y) * .16;                     // float a little
      root.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(root, true); dim = box.getSize(new THREE.Vector3());
    }

    const pts = collectPoints(root);
    if (hero) for (const [x, z] of [[box.min.x, box.min.z], [box.max.x, box.min.z], [box.min.x, box.max.z], [box.max.x, box.max.z]]) pts.push(new THREE.Vector3(x, 0, z));
    const cam = this.camera;
    cam.fov = view.fov; cam.aspect = w / h; cam.updateProjectionMatrix();
    const target = new THREE.Vector3(0, box.min.y + dim.y / 2, 0);
    let dist = 7;
    const [x0, y0, x1, y1] = o.box ?? [.1, .1, .9, .9];
    const fx0 = x0 * 2 - 1, fx1 = x1 * 2 - 1, fyTop = 1 - y0 * 2, fyBot = 1 - y1 * 2;
    const right = new THREE.Vector3(), up = new THREE.Vector3(), v = new THREE.Vector3();
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), tanH = tanV * cam.aspect;
    for (let it = 0; it < 6; it++) {
      cam.position.copy(target).addScaledVector(dir, dist);
      cam.lookAt(target); cam.updateMatrixWorld();
      let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
      for (const p of pts) { v.copy(p).project(cam); if (v.x < bx0) bx0 = v.x; if (v.x > bx1) bx1 = v.x; if (v.y < by0) by0 = v.y; if (v.y > by1) by1 = v.y; }
      const s = Math.min((fx1 - fx0) / (bx1 - bx0), (fyTop - fyBot) / (by1 - by0)) * view.zoom;
      // pan so the picture sits where it should (centred across, on the floor line or centred up and down)
      const cx = (bx0 + bx1) / 2, wantX = (fx0 + fx1) / 2;
      const scaledH = (by1 - by0) * s, wantBottom = o.align === 'center' ? (fyTop + fyBot) / 2 - scaledH / 2 : fyBot;
      const cyBottom = by0 + (view.lift ?? 0);
      right.setFromMatrixColumn(cam.matrixWorld, 0); up.setFromMatrixColumn(cam.matrixWorld, 1);
      // NDC offsets measured at the current distance, applied after the zoom
      const dx = (cx - wantX / s) * dist * tanH, dy = (cyBottom - wantBottom / s) * dist * tanV;
      target.addScaledVector(right, dx).addScaledVector(up, dy);
      dist /= s;
    }
    cam.position.copy(target).addScaledVector(dir, dist);
    cam.lookAt(target); cam.updateMatrixWorld();

    // Light from the viewer's upper left, a cool rim from behind on the right.
    const sph = (a, e, r) => new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(r);
    const mid = new THREE.Vector3(0, box.min.y + dim.y * .45, 0);
    this.key.position.copy(mid).add(sph(az - 1.0, THREE.MathUtils.degToRad(view.keyEl ?? 50), 12)); this.key.target.position.copy(mid);
    this.rim.position.copy(mid).add(sph(az + 2.7, .5, 12)); this.rim.target.position.copy(mid);
    this.fill.position.copy(mid).add(sph(az + .9, .15, 12)); this.fill.target.position.copy(mid);
    this.key.intensity = view.key ?? 2.3; this.rim.intensity = view.rim ?? 1.6;
    const floorShadow = o.shadow !== false && !model.userData.floating;
    this.ground.visible = floorShadow; this.blob.visible = floorShadow;
    this.blob.scale.set(dim.x * 1.15 + .1, dim.z * 1.15 + .1, 1);
    this.blob.material.opacity = hero ? .22 : .42;
    this.key.castShadow = floorShadow;

    // The canvas keeps one size (resizing it reallocates its buffers, which is slow); each picture uses a corner of it.
    const r = this.renderer, W = Math.max(this.size[0], w), H = Math.max(this.size[1], h);
    if (W !== this.size[0] || H !== this.size[1]) { this.size = [W, H]; r.setSize(W, H, false); }
    r.setViewport(0, 0, w, h); r.setScissor(0, 0, w, h); r.setScissorTest(true);
    r.render(this.scene, cam);
    r.setScissorTest(false);
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    out.getContext('2d').drawImage(this.canvas, 0, H - h, w, h, 0, 0, w, h);
    this.scene.remove(root);
    disposeObject(root, true);
    return out;
  }

  // Cached render of one item of a set. kind: 'art' (the card's picture window), 'full' (full-art card), 'hero' (pack wrapper).
  // A smaller picture is scaled down from a bigger one already made, when there is one.
  art(set, item, kind, w, h) {
    const key = `${set.id}:${item.id}:${kind}:${w}x${h}`;
    let c = this.cache.get(key);
    if (c) { this.cache.delete(key); this.cache.set(key, c); return c; }
    const prefix = `${set.id}:${item.id}:${kind}:`;
    for (const [k2, big] of this.cache) {
      if (!k2.startsWith(prefix) || big.width < w || Math.abs(big.width / big.height - w / h) > .02) continue;
      c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(big, 0, 0, w, h);
      break;
    }
    if (!c) {
      const build = set.models[item.id] || placeholderModel;
      const opts = kind === 'full' ? { w, h, full: true, box: [.06, .24, .94, .77], view: { fov: 30, el: 12 } }
        : kind === 'hero' ? { w, h, full: true, box: [.08, .14, .92, .9], view: { fov: 28, el: 14 } }
        : { w, h, box: [.13, .1, .87, .86] };
      try { c = this.render(build, { ...opts, seed: item.id }); }
      catch (e) { console.error(`Couldn't render ${set.id}/${item.id}:`, e); c = this.render(placeholderModel, { ...opts, seed: item.id }); }
    }
    this.cache.set(key, c);
    // keep plenty of small pictures (they're cheap) but only a few big ones
    const small = w <= 400, limit = small ? this.smallMax : this.cacheMax;
    const same = [...this.cache.keys()].filter(k2 => { const cc = this.cache.get(k2); return (cc.width <= 400) === small; });
    for (let i = 0; i < same.length - limit; i++) this.cache.delete(same[i]);
    return c;
  }
  has(set, item, kind, w, h) { return this.cache.has(`${set.id}:${item.id}:${kind}:${w}x${h}`); }
}

// Vertices to frame by: every vertex (thinned out on big meshes), in world space.
function collectPoints(root) {
  const pts = [], v = new THREE.Vector3(), m = new THREE.Matrix4();
  root.traverse(o => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes.position) return;
    const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 1500));
    if (o.isInstancedMesh) {
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m); m.premultiply(o.matrixWorld);
        for (let c = 0; c < 8; c++) pts.push(new THREE.Vector3(c & 1 ? b.max.x : b.min.x, c & 2 ? b.max.y : b.min.y, c & 4 ? b.max.z : b.min.z).applyMatrix4(m));
      }
      return;
    }
    for (let i = 0; i < pos.count; i += step) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
  });
  return pts;
}

// Stand-in for an item whose model isn't written yet: a gift box with a bow.
export function placeholderModel(k) {
  const g = k.group();
  k.add(g, k.box(1.6, 1.2, 1.6, .08), k.gloss('#e9e2ff'), { p: [0, .6, 0] });
  k.add(g, k.box(1.66, .26, 1.66, .04), k.gloss('#8e6bf2'), { p: [0, 1.1, 0] });
  k.add(g, k.box(.26, 1.24, 1.64, .02), k.gloss('#8e6bf2'), { p: [0, .62, 0] });
  k.add(g, k.torus(.28, .09), k.gloss('#8e6bf2'), { p: [-.28, 1.34, 0], r: [0, 0, .5] });
  k.add(g, k.torus(.28, .09), k.gloss('#8e6bf2'), { p: [.28, 1.34, 0], r: [0, 0, -.5] });
  return g;
}
