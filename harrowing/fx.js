// Hits and spells in the 3D scene: slashes, claw marks, shields, holy fire, beams. Each is a flat glowing sprite
// that grows and fades by itself.
import * as THREE from 'three';
import { canvas, rad, lin, TAU } from './paint.js';

const TEX = {};
function tex(name, draw, w = 256, h = 256) {
  if (TEX[name]) return TEX[name];
  const c = canvas(w, h), g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (TEX[name] = t);
}
// crisp shapes of cut light, to sit with the paper: a crescent blade, three tapered tears, a thin ring
function crescent(g, r, w, a0, a1) {
  g.beginPath(); g.arc(0, 0, r, a0, a1);
  const m = (a0 + a1) / 2;
  g.quadraticCurveTo(Math.cos(m) * (r - w * 2), Math.sin(m) * (r - w * 2), Math.cos(a0) * r, Math.sin(a0) * r);
  g.fill();
}
const slashTex = () => tex('slash', (g, w, h) => {
  g.translate(w / 2, h / 2 + 40); g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 6;
  crescent(g, 100, 16, Math.PI * 1.08, Math.PI * 1.92);
  g.globalAlpha = .45; crescent(g, 82, 7, Math.PI * 1.18, Math.PI * 1.8);
});
const clawTex = () => tex('claw', (g, w, h) => {
  g.translate(w / 2, h / 2); g.rotate(-.5); g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 5;
  for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * 34 - 12, -96); g.quadraticCurveTo(i * 34 + 22, 0, i * 34 - 2, 96); g.quadraticCurveTo(i * 34 + 6, 0, i * 34 - 12, -96); g.fill(); }
});
const ringTex = () => tex('ring', (g, w, h) => {
  g.fillStyle = rad(g, w / 2, h / 2, w * .2, w * .48, [[0, 'rgba(255,255,255,0)'], [.85, 'rgba(255,255,255,.18)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, w, h);
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.shadowColor = '#fff'; g.shadowBlur = 6; g.beginPath(); g.arc(w / 2, h / 2, w * .44, 0, TAU); g.stroke();
  g.lineWidth = 2; g.globalAlpha = .6; g.beginPath(); g.arc(w / 2, h / 2, w * .38, 0, TAU); g.stroke();
});
const glowTex = () => tex('glow', (g, w, h) => { g.fillStyle = rad(g, w / 2, h / 2, 0, w / 2, [[0, 'rgba(255,255,255,1)'], [.3, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, w, h); });
const shieldTex = () => tex('shield', (g, w, h) => {
  g.translate(w / 2, h / 2);
  const p = new Path2D('M0 -100 C40 -84 70 -84 90 -88 C90 -10 60 60 0 104 C-60 60 -90 -10 -90 -88 C-70 -84 -40 -84 0 -100 Z');
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fill(p);
  g.strokeStyle = '#fff'; g.lineWidth = 5; g.shadowColor = '#fff'; g.shadowBlur = 6; g.stroke(p);
  g.scale(.82, .82); g.lineWidth = 2; g.globalAlpha = .6; g.stroke(p);
});
const beamTex = () => tex('beam', (g, w, h) => { g.fillStyle = lin(g, 0, 0, w, 0, [[0, 'rgba(255,255,255,0)'], [.5, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, w, h); const v = lin(g, 0, 0, 0, h, [[0, 'rgba(0,0,0,1)'], [.15, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]); g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0, 0, w, h); }, 64, 256);

export class FX {
  constructor(stage) { this.stage = stage; this.list = []; }
  sprite(t, pos, o) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, color: new THREE.Color(o.color ?? '#ffffff') }));
    m.position.copy(pos); m.position.z += .6; m.renderOrder = 50;
    m.rotation.z = o.rot ?? 0;
    this.stage.scene.add(m);
    this.list.push({ m, t: 0, dur: o.dur ?? .4, s0: o.s0 ?? 1, s1: o.s1 ?? 1.6, a0: o.a0 ?? 1, sx: o.sx ?? 1, rotV: o.rotV ?? 0, rise: o.rise ?? 0 });
    return m;
  }
  slash(pos, color = '#ffe8a0', dir = 1) { this.sprite(slashTex(), pos, { color, dur: .32, s0: 1.6, s1: 2.6, rot: dir > 0 ? -.6 : .6 + Math.PI, sx: dir }); }
  claw(pos, color = '#ff5a3a') { this.sprite(clawTex(), pos, { color, dur: .38, s0: 1.4, s1: 2.2 }); }
  ring(pos, color = '#ffd36a', size = 2.4) { this.sprite(ringTex(), pos, { color, dur: .5, s0: size * .3, s1: size }); }
  glow(pos, color = '#ffd36a', size = 3, dur = .6) { this.sprite(glowTex(), pos, { color, dur, s0: size * .6, s1: size, a0: .9 }); }
  shield(pos, color = '#8fd0ff', size = 2.6) { this.sprite(shieldTex(), pos, { color, dur: .55, s0: size * .9, s1: size * 1.1 }); }
  beam(pos, color = '#fff2b0', h = 9) { const m = this.sprite(beamTex(), pos.clone().add(new THREE.Vector3(0, h / 2 - 1, 0)), { color, dur: .6, s0: 1, s1: 1 }); m.scale.set(1.4, h, 1); this.list[this.list.length - 1].beam = h; }
  update(dt) {
    for (const f of this.list) {
      f.t += dt;
      const u = Math.min(1, f.t / f.dur), e = 1 - Math.pow(1 - u, 3);
      if (f.beam) { f.m.scale.set(1.4 * (1 - u * .7), f.beam, 1); }
      else { const s = f.s0 + (f.s1 - f.s0) * e; f.m.scale.set(s * f.sx, s, 1); }
      f.m.rotation.z += f.rotV * dt;
      f.m.position.y += f.rise * dt;
      f.m.material.opacity = f.a0 * (1 - u) * Math.min(1, u * 8);
      if (u >= 1) { f.m.removeFromParent(); f.m.geometry.dispose(); f.m.material.dispose(); f.done = true; }
    }
    this.list = this.list.filter(f => !f.done);
  }
}
