// Horde: drawing the night. WebGL2, built for crowds: every sprite, particle and digit on screen is one instance in
// one buffer, drawn from one texture atlas in a single instanced call, so thousands of monsters cost about what a
// hundred do. The canvas is the game's own low resolution, scaled up by whole device pixels, so nothing smears.
//
// Light is worked out per pixel in the shader: each lamp (the hero's lantern, candles, fireballs, lightning) adds a
// pool with a dithered rim, and any pixel outside every pool is redrawn in moonlight, a cold ramp by brightness. The
// monsters' eyes are marked in the atlas and keep their colour in the dark.
import { NIGHT_LEN } from './data.js';
import { bakeAll, hex } from './art.js';
import { makeField } from './ground.js';

const FL = 15, MAX = 32768, MAXL = 48, GROUND_LIFT = 0.95;
const TAU = Math.PI * 2;
const rgb = h => hex(h).map(v => v / 255);
const C = {
  ink: rgb('#0d0812'), white: rgb('#fff6e8'), gold: rgb('#ffd65a'), gold2: rgb('#f2a63a'), red: rgb('#ff4a3a'), blood: rgb('#b0182a'),
  violet: rgb('#b77cff'), violet2: rgb('#7b4dd8'), lilac: rgb('#e6c8ff'), blue: rgb('#8fd8ff'), blue2: rgb('#4a8ad8'), ice: rgb('#dff6ff'),
  fire: rgb('#ff8a2a'), fire2: rgb('#ffd24a'), smoke: rgb('#3a3036'), dirt: rgb('#4a3a2a'), dirt2: rgb('#6a543a'), green: rgb('#c8ff6a'), mend: rgb('#9fffb0'),
  steel: rgb('#c9ccd8'), bone: rgb('#e2d6b8'),
};
const GIBS = {
  imp: ['#74203f', '#a4405c', '#3f1230'], bat: ['#4c2058', '#74357c', '#2a1236'], brute: ['#465a35', '#6b8148', '#28331f', '#5b3a20'],
  bloat: ['#9fbb5a', '#cfe08a', '#6e8a3c', '#b85a6a'], shield: ['#e2d6b8', '#a8987a', '#4e4f66', '#9a1e2c'], hag: ['#5a3a62', '#7a5280', '#c0cc94'],
};
for (const k in GIBS) GIBS[k] = GIBS[k].map(rgb);
const ANIM = { imp: 8, bat: 11, brute: 4, bloat: 3, shield: 5, hag: 4 };
const SHADOW = { imp: 7, bat: 5, brute: 13, bloat: 11, shield: 9, hag: 9 };
const WCOL = { whip: C.white, books: C.white, knife: C.steel, fire: C.fire2, axe: C.white, garlic: rgb('#f4efc0'), water: C.blue, bolt: C.ice };

const VS = `#version 300 es
layout(location=0) in vec2 aC;
layout(location=1) in vec4 aR;
layout(location=2) in vec4 aU;
layout(location=3) in vec4 aT;
layout(location=4) in vec3 aF;
uniform vec2 uView, uTex;
out vec2 vUV; out vec4 vT; out vec3 vF;
void main() {
  vec2 c = aF.z > 0.5 ? vec2(1.0 - aC.x, aC.y) : aC;
  vUV = (aU.xy + c * aU.zw) / uTex;
  vT = aT; vF = aF;
  vec2 p = aR.xy + aC * aR.zw;
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
in vec2 vUV; in vec4 vT; in vec3 vF;
uniform sampler2D uS, uRamp;
uniform vec4 uL[${MAXL}];
uniform int uN;
uniform float uAmb, uLift, uKeep, uBand, uGlow;
uniform vec2 uView;
out vec4 o;
const int B[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
float bayer(ivec2 p) { return (float(B[(p.y & 3) * 4 + (p.x & 3)]) + 0.5) / 16.0; }
vec3 moon(vec3 c) {
  float L = dot(c, vec3(0.3, 0.59, 0.11));
  float f = clamp(pow(L, 0.85) * 6.88 + uLift, 0.0, 7.99);
  return mix(texture(uRamp, vec2((f + 0.5) / 9.0, 0.5)).rgb, c, uKeep);
}
void main() {
  vec4 t = texture(uS, vUV);
  if (t.a < 0.02) discard;
  bool glow = t.a > 0.95 && t.a < 0.995;
  vec3 c = t.rgb * vT.rgb;
  float a = (glow ? 1.0 : t.a) * vT.a;
  vec2 p = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y);
  ivec2 ip = ivec2(p);
  if (vF.x < 0.5) {
    if (!glow) {
      float acc = uAmb;
      for (int i = 0; i < ${MAXL}; i++) {
        if (i >= uN) break;
        vec4 L = uL[i];
        acc += L.w * clamp((L.z - length((p - L.xy) * vec2(1.0, 1.22))) / (L.z * 0.42), 0.0, 1.0);
      }
      if (acc <= bayer(ip)) c = moon(c);
    }
    // the rim of the field, where you raise things: a dithered dark, violet while you're aiming there
    float e = min(min(p.x, uView.x - p.x), min(p.y, uView.y - p.y));
    if (e < uBand) {
      float k = 1.0 - e / uBand;
      if (bayer(ip + ivec2(2, 1)) < k * 0.6) c *= 0.55;
      c = mix(c, vec3(0.45, 0.25, 0.75), uGlow * k * k * 0.35);
    }
  }
  c = mix(c, vec3(1.0, 0.96, 0.9), vF.y);
  o = vec4(c * a, a);
}`;

class Parts {
  constructor(n) {
    this.cap = n; this.n = 0;
    for (const k of ['x', 'y', 'vx', 'vy', 'life', 'max', 'g', 'r', 'gg', 'b', 'z', 'vz']) this[k] = new Float32Array(n);
    this.size = new Uint8Array(n); this.mode = new Uint8Array(n); this.kind = new Uint8Array(n);
  }
  // kind 0: a mote (drifts, fades by dithering out); 1: a chunk (hops on the ground and lies there)
  add(x, y, vx, vy, life, col, size = 1, mode = 1, kind = 0, vz = 0, g = 0) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy; this.life[i] = life; this.max[i] = life; this.g[i] = g;
    this.r[i] = col[0]; this.gg[i] = col[1]; this.b[i] = col[2]; this.size[i] = size; this.mode[i] = mode; this.kind[i] = kind; this.z[i] = 0; this.vz[i] = vz;
  }
  update(dt) {
    let j = 0;
    for (let i = 0; i < this.n; i++) {
      const life = this.life[i] - dt;
      if (life <= 0) continue;
      if (j !== i) for (const k of ['x', 'y', 'vx', 'vy', 'max', 'g', 'r', 'gg', 'b', 'z', 'vz', 'size', 'mode', 'kind']) this[k][j] = this[k][i];
      this.life[j] = life;
      if (this.kind[j] === 1) {
        // a chunk: thrown up, falls back, skids to a stop
        this.vz[j] -= 260 * dt; this.z[j] += this.vz[j] * dt;
        if (this.z[j] <= 0) { this.z[j] = 0; this.vz[j] = 0; this.vx[j] *= 0.7; this.vy[j] *= 0.7; }
      } else { this.vy[j] += this.g[j] * dt; this.vx[j] *= 0.985; this.vy[j] *= 0.985; }
      this.x[j] += this.vx[j] * dt; this.y[j] += this.vy[j] * dt;
      j++;
    }
    this.n = j;
  }
}

export class View {
  constructor(canvas) {
    this.cv = canvas;
    this.S = bakeAll();
    const gl = this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: true, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no webgl2');
    this.inst = new Float32Array(MAX * FL); this.n = 0;
    this.lights = new Float32Array(MAXL * 4); this.nl = 0;
    this.parts = new Parts(9000); this.nums = []; this.fx = [];
    this.t = 0; this.shake = 0; this.flash = 0; this.W = 0; this.H = 0; this.field = null; this.band = 16;
    this.order = new Int32Array(8192); this.keys = new Int32Array(8192);
    // a little variety in a crowd: each monster a shade lighter or darker
    this.tones = Array.from({ length: 11 }, (_, i) => { const v = 0.8 + i * 0.02; return [v, v * 0.97, v]; });
    this.hot = [1, 0.62, 0.58];
    this.init();
    canvas.addEventListener('webglcontextlost', e => e.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => { this.init(); if (this.field) this.uploadGround(); });
  }
  init() {
    const gl = this.gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = this.prog = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.u = {};
    for (const k of ['uView', 'uTex', 'uS', 'uRamp', 'uL', 'uN', 'uAmb', 'uLift', 'uKeep', 'uBand', 'uGlow']) this.u[k] = gl.getUniformLocation(p, k);
    const corner = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, corner); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const vao = (buf) => {
      const v = gl.createVertexArray(); gl.bindVertexArray(v);
      gl.bindBuffer(gl.ARRAY_BUFFER, corner); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const st = FL * 4;
      [[1, 4, 0], [2, 4, 4], [3, 4, 8], [4, 3, 12]].forEach(([loc, n, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, st, off * 4); gl.vertexAttribDivisor(loc, 1); });
      gl.bindVertexArray(null);
      return v;
    };
    this.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, this.inst.byteLength, gl.DYNAMIC_DRAW);
    this.gbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.gbuf); gl.bufferData(gl.ARRAY_BUFFER, FL * 4, gl.DYNAMIC_DRAW);
    this.vao = vao(this.buf); this.gvao = vao(this.gbuf);
    const tex = (w, h, data, filter, fmt = gl.RGBA) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, fmt === gl.RGB ? gl.RGB8 : gl.RGBA8, w, h, 0, fmt, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.tex = tex;
    const A = this.S.atlas;
    this.atlas = tex(A.w, A.h, A.d, gl.NEAREST);
    const ramp = ['#05050b', '#0a0b17', '#111324', '#191c31', '#22273f', '#2e3550', '#3d4664', '#525d7c', '#6b7795'].flatMap(hex);
    this.ramp = tex(9, 1, new Uint8Array(ramp), gl.LINEAR, gl.RGB);
    this.gtex = null;
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  /* ------------------------------------------------------------------------------------------- the field */
  resize(W, H) { this.W = W; this.H = H; this.cv.width = W; this.cv.height = H; }
  setField(setting, seed) {
    this.field = makeField(setting, this.W, this.H, seed, this.S);
    this.fieldKey = setting + seed + 'x' + this.W + 'x' + this.H;
    this.uploadGround();
  }
  uploadGround() {
    const gl = this.gl, f = this.field.img;
    if (this.gtex) gl.deleteTexture(this.gtex);
    this.gtex = this.tex(f.w, f.h, f.d, gl.NEAREST);
  }

  /* ------------------------------------------------------------------------------------------- instances */
  q(x, y, w, h, u, v, uw, vh, c, a, mode, flash, flip) {
    if (this.n >= MAX) return;
    const o = this.n++ * FL, I = this.inst;
    I[o] = x; I[o + 1] = y; I[o + 2] = w; I[o + 3] = h; I[o + 4] = u; I[o + 5] = v; I[o + 6] = uw; I[o + 7] = vh;
    I[o + 8] = c ? c[0] : 1; I[o + 9] = c ? c[1] : 1; I[o + 10] = c ? c[2] : 1; I[o + 11] = a; I[o + 12] = mode; I[o + 13] = flash; I[o + 14] = flip;
  }
  spr(r, x, y, mode = 0, flip = 0, flash = 0, c = null, a = 1) { this.q(Math.round(x), Math.round(y), r.w, r.h, r.u, r.v, r.w, r.h, c, a, mode, flash, flip); }
  px(x, y, c, a = 1, s = 1, mode = 1) { const p = this.S.px; this.q(Math.round(x), Math.round(y), s, s, p.u, p.v, 1, 1, c, a, mode, 0, 0); }
  rect(x, y, w, h, c, a = 1, mode = 1) { const p = this.S.px; this.q(Math.round(x), Math.round(y), w, h, p.u, p.v, 1, 1, c, a, mode, 0, 0); }
  text(str, x, y, c = C.white, s = 1, a = 1) {
    const F = this.S.font; let cx = Math.round(x);
    for (const ch of String(str).toUpperCase()) { const g = F[ch] || F[' ']; this.q(cx, Math.round(y), 5 * s, 7 * s, g.u, g.v, 5, 7, c, a, 1, 0, 0); cx += 4 * s; }
  }
  light(x, y, r, i = 1) { if (this.nl >= MAXL || r <= 0) return; const o = this.nl++ * 4; this.lights[o] = x; this.lights[o + 1] = y; this.lights[o + 2] = r; this.lights[o + 3] = i; }
  // a dotted ellipse of pixels, for rings and auras
  ring(x, y, r, c, a = 1, step = 1, sq = 0.8, phase = 0) {
    const n = Math.max(8, Math.floor(TAU * r / step));
    for (let i = 0; i < n; i++) { const t = i / n * TAU + phase; this.px(x + Math.cos(t) * r, y + Math.sin(t) * r * sq, c, a); }
  }
  line(x0, y0, x1, y1, c, a = 1, w = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, guard = 0;
    for (;;) { this.px(x0, y0, c, a, w); if ((x0 === x1 && y0 === y1) || ++guard > 2000) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }

  /* ------------------------------------------------------------------------------------------- what just happened */
  events(evs, g) {
    const P = this.parts, R = Math.random;
    for (const e of evs) {
      switch (e.k) {
        case 'spawn': {
          this.fx.push({ k: 'rift', x: e.x, y: e.y, side: e.side, t: 0, life: 0.9, n: e.n });
          for (let i = 0; i < 5; i++) P.add(e.x + (R() - 0.5) * 16, e.y + (R() - 0.5) * 4, (R() - 0.5) * 10, -10 - R() * 12, 0.4 + R() * 0.4, R() < 0.5 ? C.violet : C.lilac, 1, 1, 0, 0, -6);
          break;
        }
        case 'die': {
          const G = GIBS[e.type], n = e.type === 'brute' ? 12 : e.type === 'imp' || e.type === 'bat' ? 4 : 7;
          for (let i = 0; i < n; i++) { const a = R() * TAU, s = 10 + R() * 30; P.add(e.x, e.y, Math.cos(a) * s, Math.sin(a) * s * 0.6, 0.5 + R() * 0.9, G[(R() * G.length) | 0], R() < 0.3 ? 2 : 1, 0, 1, 40 + R() * 50); }
          if (R() < (e.type === 'imp' || e.type === 'bat' ? 0.25 : 1)) P.add(e.x, e.y - 3, (R() - 0.5) * 4, -22 - R() * 8, 0.45 + R() * 0.25, C.violet, 1, 1, 0, 0, -10);
          break;
        }
        case 'dmg': this.num(e.x, e.y, e.n, WCOL[e.w] || C.white, 1); break;
        case 'miss': this.word('MISS', e.x, e.y, C.steel); break;
        case 'clang': for (let i = 0; i < 4; i++) P.add(e.x, e.y, (R() - 0.5) * 50, -R() * 40, 0.25, C.steel, 1, 1, 0, 0, 120); break;
        case 'block': for (let i = 0; i < 5; i++) P.add(e.x, e.y, (R() - 0.5) * 60, -R() * 50, 0.25 + R() * 0.15, R() < 0.5 ? C.white : C.gold, 1, 1, 0, 0, 140); break;
        case 'hurt': {
          this.num(e.x, e.y - 4, e.n, C.red, e.big ? 2 : 1, true);
          for (let i = 0; i < 3 + Math.min(10, e.n); i++) { const a = R() * TAU, s = 15 + R() * 30; P.add(g.hero.x, g.hero.y - 4, Math.cos(a) * s, Math.sin(a) * s * 0.6, 0.6 + R() * 0.6, C.blood, 1, 0, 1, 40 + R() * 40); }
          this.shake = Math.max(this.shake, e.big ? 2.2 : 0.8);
          break;
        }
        case 'boom': {
          this.fx.push({ k: 'boom', x: e.x, y: e.y, r: e.r, t: 0, life: 0.45 });
          for (let i = 0; i < 26; i++) { const a = R() * TAU, s = 20 + R() * 70; P.add(e.x, e.y, Math.cos(a) * s, Math.sin(a) * s * 0.7, 0.4 + R() * 0.8, [C.green, GIBS.bloat[0], GIBS.bloat[3], C.fire2][(R() * 4) | 0], R() < 0.4 ? 2 : 1, i < 14 ? 1 : 0, i < 14 ? 0 : 1, 60 + R() * 60); }
          this.shake = Math.max(this.shake, 2.5);
          break;
        }
        case 'whip': this.fx.push({ k: 'whip', x: e.x, y: e.y, side: e.side, len: e.len, h: e.h, t: 0, life: 0.2 }); break;
        case 'bolt': {
          this.fx.push({ k: 'bolt', x: e.x, y: e.y, r: e.r, t: 0, life: 0.22, seed: R() * 1000 });
          this.flash = Math.max(this.flash, 0.45);
          for (let i = 0; i < 12; i++) { const a = R() * TAU, s = 20 + R() * 50; P.add(e.x, e.y, Math.cos(a) * s, Math.sin(a) * s * 0.6, 0.3 + R() * 0.3, R() < 0.5 ? C.ice : C.blue, 1, 1, 0, 0, 0); }
          break;
        }
        case 'splash': for (let i = 0; i < 10; i++) { const a = R() * TAU; P.add(e.x, e.y, Math.cos(a) * 30, Math.sin(a) * 20 - 20, 0.4, C.blue, 1, 1, 0, 0, 120); } break;
        case 'fireburst': {
          this.fx.push({ k: 'glow', x: e.x, y: e.y, r: 22, t: 0, life: 0.3 });
          for (let i = 0; i < 14; i++) { const a = R() * TAU, s = 15 + R() * 45; P.add(e.x, e.y, Math.cos(a) * s, Math.sin(a) * s * 0.7, 0.3 + R() * 0.4, [C.fire, C.fire2, C.white][(R() * 3) | 0], 1, 1, 0, 0, -30); }
          break;
        }
        case 'gem': { this.fx.push({ k: 'spark', x: e.x, y: e.y, t: 0, life: 0.3 }); break; }
        case 'sink': for (let i = 0; i < 3; i++) P.add(e.x + (R() - 0.5) * 4, e.y, 0, 6, 0.5, C.blue2, 1, 1); break;
        case 'level': {
          this.fx.push({ k: 'level', t: 0, life: 1.1, lv: e.lv });
          for (let i = 0; i < 40; i++) { const a = R() * TAU, s = 30 + R() * 60; P.add(g.hero.x, g.hero.y - 6, Math.cos(a) * s, Math.sin(a) * s * 0.7, 0.5 + R() * 0.5, R() < 0.5 ? C.gold : C.white, 1, 1, 0, 0, -20); }
          break;
        }
        case 'ash': for (let i = 0; i < 5; i++) P.add(e.x + (R() - 0.5) * 6, e.y - R() * 6, (R() - 0.5) * 8, -10 - R() * 14, 0.6 + R() * 0.8, R() < 0.25 ? C.fire : R() < 0.5 ? C.smoke : [0.35, 0.33, 0.36], 1, 1, 0, 0, -8); break;
        case 'hunt': if (e.surge) { this.word('CHARGE', e.x, e.y - 14, C.red); this.shake = Math.max(this.shake, 1.2); } break;
        case 'mend': this.fx.push({ k: 'mend', x: e.x, y: e.y, r: e.r, t: 0, life: 0.5 }); break;
        case 'garlic': this.fx.push({ k: 'garlic', t: 0, life: 0.25, r: e.r }); break;
        case 'flag': for (let i = 0; i < 6; i++) P.add(e.x + (R() - 0.5) * 6, e.y, (R() - 0.5) * 20, -R() * 10, 0.5, C.violet, 1, 1, 0, 0, 20); break;
        case 'win': this.fx.push({ k: 'fall', t: 0, life: 99 }); this.shake = 3; break;
        case 'lose': this.fx.push({ k: e.why === 'dawn' ? 'dawn' : 'ascend', t: 0, life: 99 }); break;
      }
    }
  }
  num(x, y, n, c, s = 1, hero = false) {
    // numbers near each other in space and time add up into one, so a crowd stays legible
    for (const d of this.nums) if (d.c === c && d.s === s && d.t < 0.3 && Math.abs(d.x - x) < 12 && Math.abs(d.y0 - y) < 9) { d.n += n; d.str = String(Math.max(1, Math.round(d.n))); d.t = Math.min(d.t, 0.1); return; }
    if (this.nums.length > (hero ? 70 : 45)) { if (!hero) return; this.nums.shift(); }
    this.nums.push({ x, y, y0: y, n, str: String(Math.max(1, Math.round(n))), c, s, t: 0, life: hero ? 0.9 : 0.55, vx: (Math.random() - 0.5) * 8 });
  }
  word(w, x, y, c, life = 0.5) { if (this.nums.length > 90) return; this.nums.push({ x, y, y0: y, n: 0, str: w, c, s: 1, t: 0, life: w === 'CHARGE' ? 1 : life, vx: 0, word: true }); }

  /* ------------------------------------------------------------------------------------------- a frame */
  frame(g, dt, ui = {}) {
    const gl = this.gl, S = this.S, W = this.W, H = this.H, h = g.hero, t = (this.t += dt);
    this.n = 0; this.nl = 0;
    this.parts.update(dt);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < f.life);
    this.flash = Math.max(0, this.flash - dt * 6);
    this.shake = Math.max(0, this.shake - dt * 10);
    const won = g.state === 'won', lost = g.state === 'lost', endT = g.endT;
    const fall = this.fx.find(f => f.k === 'fall'), dawn = this.fx.find(f => f.k === 'dawn'), asc = this.fx.find(f => f.k === 'ascend');

    /* lights */
    let lr = h.light * (1 + 0.022 * Math.sin(t * 9.1) + 0.014 * Math.sin(t * 23.7));
    if (asc) lr = h.light + asc.t * 260;
    if (won) {
      // the lantern drops and gutters on the ground beside the hero, then goes out
      const lx = h.x + 7 * h.face, ly = h.y + 3;
      lr = endT < 0.4 ? h.light * (1 - endT / 0.4 * 0.75) : endT < 3 ? 14 + Math.sin(t * 17) * 2 + (Math.sin(t * 41) > 0.7 ? -5 : 0) : Math.max(0, 14 * (1 - (endT - 3) / 0.8));
      this.light(lx, ly, lr, 1.3);
      if (lr > 2) { this.rect(lx - 1, ly - 3, 3, 4, C.gold2, 1); this.px(lx, ly - 2, Math.sin(t * 23) > 0 ? C.white : C.gold, 1); }
    } else this.light(h.x, h.y - 4, lr, 1.35);
    for (const s of g.shots) if (s.k === 'fire') this.light(s.x, s.y, 15, 1);
    for (const p of g.puddles) this.light(p.x, p.y, p.r + 7, 0.9);
    for (const f of this.fx) {
      if (f.k === 'bolt') this.light(f.x, f.y, 44 * (1 - f.t / f.life), 1.4);
      else if (f.k === 'boom') this.light(f.x, f.y, f.r * 1.4 * (1 - f.t / f.life), 1.2);
      else if (f.k === 'glow') this.light(f.x, f.y, f.r * (1 - f.t / f.life), 1);
      else if (f.k === 'rift' && f.t < 0.6) this.light(f.x, f.y, 13, 0.9);
      else if (f.k === 'level') this.light(h.x, h.y - 6, 90 * (1 - f.t / f.life), 1);
    }
    for (const p of this.field.stand) {
      if (p.k === 'candle') this.light(p.x, p.y - 4, 10 + Math.sin(t * 11 + p.ph) * 0.8, 1);
      else if (p.k === 'ember') this.light(p.x, p.y - 2, 13 + Math.sin(t * 5 + p.ph) * 1.5, 0.9);
      else if (p.k === 'shrine') this.light(p.x, p.y - 7, 12 + Math.sin(t * 9 + p.ph), 0.9);
      else if (p.k === 'beam') this.light(p.x + 4, p.y - 2, 11 + Math.sin(t * 6 + p.ph) * 1.5, 0.8);
    }
    let amb = this.flash;
    const left = NIGHT_LEN - g.t;
    if (left < 40) amb += 0.3 * ((40 - left) / 40) ** 2;
    if (dawn) amb += Math.min(1.3, dawn.t * 0.9);

    /* ground and the things lying on it */
    const sm = (k, i = 0) => S.mob[k].f[i];
    for (const p of g.puddles) {
      // holy fire on the ground: a dithered pool, a bright rim, and tongues of flame licking up off it
      const k = Math.min(1, p.t / 0.15, (p.dur - p.t) / 0.4), rr = Math.max(1, p.r * k), ry = rr * 0.6, fr = Math.floor(t * 12);
      for (let y = -Math.floor(ry); y <= ry; y++) for (let x = -Math.floor(rr); x <= rr; x++) {
        const e = (x / rr) ** 2 + (y / ry) ** 2;
        if (e > 1) continue;
        const X = Math.round(p.x) + x, Y = Math.round(p.y) + y;
        if (e > 0.72) { if (((X + Y + fr) & 3) !== 0) this.px(X, Y, e > 0.88 ? C.blue : C.ice, 1); }
        else if (((X ^ Y) & 1) === 0) this.px(X, Y, C.blue2, 0.55);
      }
      const R = mulberryLite(Math.floor(p.x * 7 + p.y * 13) + fr);
      for (let i = 0; i < rr * 1.6; i++) {
        const a = R() * TAU, x = p.x + Math.cos(a) * rr * (0.4 + R() * 0.6), y = p.y + Math.sin(a) * ry * (0.4 + R() * 0.6), h = 1 + Math.floor(R() * 3 * k);
        for (let j = 0; j < h; j++) this.px(x, y - 1 - j, j === h - 1 ? C.white : j ? C.ice : C.blue, 1);
      }
    }
    for (const f of this.fx) if (f.k === 'rift') {
      const k = Math.min(1, f.t / 0.15) * (1 - Math.max(0, (f.t - 0.6) / 0.3)), len = (4 + f.n * 2.2) * k;
      const along = f.side === 'l' || f.side === 'r';
      for (let i = -len; i <= len; i++) {
        const j = Math.round(Math.sin(i * 1.7 + f.x) * 1.2);
        const x = f.x + (along ? j : i), y = f.y + (along ? i : j);
        this.px(x, y, Math.abs(i) < len * 0.5 ? C.lilac : C.violet, 1);
        if (Math.abs(i) < len * 0.4) this.px(x + (along ? 1 : 0), y + (along ? 0 : 1), C.violet2, 1);
      }
    }
    // rally point: a violet ring on the ground under the flag
    if (!g.flag.hunt && g.state === 'play') this.ring(g.flag.x, g.flag.y, 7 + Math.sin(t * 4) * 0.6, C.violet2, 0.9, 2, 0.6, t);
    // shadows
    const shadow = (x, y, w, a = 0.5) => { const r = S.shadow[w] || S.shadow[7]; this.spr(r, x - r.w / 2, y - r.h / 2, 0, 0, 0, C.ink, a); };
    for (const p of this.field.stand) if (p.k !== 'candle' && p.k !== 'ember') { const sp = S.prop[p.k]; shadow(p.x, p.y, sp.w > 12 ? 13 : sp.w > 8 ? 9 : 7, 0.35); }
    const mobs = g.mobs, surge = g.surge > 0.4 && g.state === 'play';
    for (const m of mobs) { if (m.dead) continue; const w = SHADOW[m.type]; shadow(m.x, m.y + m.r * 0.6 + (m.type === 'bat' ? 3 : 0), w, m.rise > 0 ? 0.25 : 0.45); }
    shadow(h.x, h.y + 3, 9, 0.55);
    // gems
    for (const gm of g.gems) {
      if (gm.t > 14 && Math.floor(gm.t * 8) % 2) continue;
      const sp = S.kit[gm.v < 2 ? 'gem1' : gm.v < 6 ? 'gem2' : 'gem3'].f[0];
      const bob = gm.pull ? 0 : Math.round(Math.sin(t * 3 + gm.x * 0.3) * 0.8);
      this.spr(sp, gm.x - sp.w / 2, gm.y - sp.h + 1 + bob, 1);
      if (((t * 1.3 + gm.x * 0.07) % 2.4) < 0.12) this.px(gm.x - 1, gm.y - sp.h + bob + 1, C.white);
    }

    /* everything standing, nearest the bottom drawn last */
    const nStand = this.field.stand.length, total = nStand + mobs.length + 1;
    if (this.order.length < total) { this.order = new Int32Array(total * 2); this.keys = new Int32Array(total * 2); }
    const keys = this.keys, order = this.order, OFF = 40, NB = H + 120;
    if (!this.counts || this.counts.length < NB + 1) this.counts = new Int32Array(NB + 1);
    const cnt = this.counts; cnt.fill(0);
    let k = 0;
    for (let i = 0; i < nStand; i++) keys[k++] = Math.max(0, Math.min(NB - 1, Math.round(this.field.stand[i].y) + OFF));
    for (let i = 0; i < mobs.length; i++) keys[k++] = mobs[i].dead ? -1 : Math.max(0, Math.min(NB - 1, Math.round(mobs[i].y + mobs[i].r * 0.7) + OFF));
    keys[k++] = Math.max(0, Math.min(NB - 1, Math.round(h.y + 4) + OFF));
    for (let i = 0; i < k; i++) if (keys[i] >= 0) cnt[keys[i] + 1]++;
    for (let i = 1; i <= NB; i++) cnt[i] += cnt[i - 1];
    let nOrd = 0;
    for (let i = 0; i < k; i++) if (keys[i] >= 0) { order[cnt[keys[i]]++] = i; nOrd++; }
    for (let oi = 0; oi < nOrd; oi++) {
      const i = order[oi];
      if (i < nStand) { const p = this.field.stand[i], sp = S.prop[p.k]; this.spr(sp.f[0], p.x - sp.w / 2, p.y - sp.h + 1, 0, p.f); if (p.k === 'candle' && Math.sin(t * 13 + p.ph) > 0.6) this.px(p.x, p.y - sp.h + 1, C.white, 1); continue; }
      if (i === k - 1) { this.drawHero(g, t, fall, asc); continue; }
      const m = mobs[i - nStand], M = S.mob[m.type];
      const moving = Math.abs(m.vx) + Math.abs(m.vy) > 3 || m.type === 'bat';
      const fi = moving ? Math.floor(t * ANIM[m.type] + m.ph * 3) % M.f.length : (m.type === 'bloat' ? Math.floor(t * 2 + m.ph) % 2 : 0);
      const fr = M.f[fi];
      let x = Math.round(m.x - fr.w / 2), y = Math.round(m.y + m.r * 0.7 - fr.h);
      if (m.type === 'bat') y -= 4 + Math.round(Math.sin(t * 6 + m.ph));
      if (dawn && Math.random() < dt * 4) this.parts.add(m.x + (Math.random() - 0.5) * 4, m.y - 4, 0, -12, 0.5, Math.random() < 0.3 ? C.fire : C.smoke, 1, 1);
      if (m.rise > 0) {
        // coming up out of the ground: only the top shows, and earth flies
        const p = 1 - m.rise / m.rise0, vis = Math.max(1, Math.round(fr.h * Math.min(1, p * 1.3)));
        this.q(x, y + fr.h - vis, fr.w, vis, fr.u, fr.v, fr.w, vis, null, 1, 0, 0, m.face < 0 ? 1 : 0);
        if (Math.random() < dt * 20) this.parts.add(m.x + (Math.random() - 0.5) * fr.w, m.y + 1, (Math.random() - 0.5) * 30, 0, 0.5, Math.random() < 0.5 ? C.dirt : C.dirt2, 1, 0, 1, 30 + Math.random() * 30);
        continue;
      }
      const fl = m.flash > 0 ? 1 : 0;
      // a charge: the whole horde runs hot
      const tn = surge ? this.hot : this.tones[Math.round((m.tone - 0.8) * 50)] || null;
      if (surge && Math.random() < dt * 6) this.parts.add(m.x - m.vx * 0.08, m.y + 1, 0, 0, 0.25, C.dirt2, 1, 0);
      this.q(x, y, fr.w, fr.h, fr.u, fr.v, fr.w, fr.h, tn, 1, 0, fl, m.face < 0 ? 1 : 0);
      // a shieldbearer's shield faces the hero: it's on the hero's side of the sprite already, by the flip
    }

    /* the hero's kit, in the air */
    if (g.state === 'play') this.drawKit(g, t);
    for (const s of g.shots) {
      if (s.k === 'knife') { const sp = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / sp, uy = s.vy / sp; for (let i = 0; i < 4; i++) this.px(s.x - ux * i, s.y - uy * i, i === 0 ? C.white : C.steel, 1); }
      else if (s.k === 'fire') { this.px(s.x - 1, s.y - 1, C.fire, 1, 3); this.px(s.x, s.y, C.fire2); if (Math.random() < 0.6) this.parts.add(s.x, s.y, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 0.3, Math.random() < 0.5 ? C.fire : C.smoke, 1, 1); }
      else if (s.k === 'axe') { const ax = S.kit.axe, fr = ax.f[Math.floor(s.spin) & 3]; this.spr(fr, s.x - fr.w / 2, s.y - fr.h / 2, 0); }
    }
    for (const f of g.flasks) {
      const p = f.t / f.T, x = f.x0 + (f.x - f.x0) * p, y = f.y0 + (f.y - f.y0) * p - Math.sin(p * Math.PI) * 26;
      const sp = S.kit.flask.f[0]; this.spr(sp, x - 2, y - 3, 0);
    }
    for (const f of this.fx) this.drawFx(f, g, t);

    /* motes and chunks */
    const P = this.parts, px = S.px;
    for (let i = 0; i < P.n; i++) {
      const life = P.life[i] / P.max[i];
      if (P.kind[i] === 0 && life < 0.35 && ((i + Math.floor(t * 30)) & 1)) continue;   // dither out
      const s = P.size[i], a = P.kind[i] === 1 && life < 0.25 ? life * 4 : 1;
      this.q(Math.round(P.x[i]), Math.round(P.y[i] - P.z[i]), s, s, px.u, px.v, 1, 1, [P.r[i], P.gg[i], P.b[i]], a, P.mode[i], 0, 0);
    }

    /* yours: the flag, or the mark over the hero when everything's hunting */
    if (g.state === 'play') {
      if (!g.flag.hunt) { const fl = S.kit.flag.f[0]; this.spr(fl, g.flag.x - 1, g.flag.y - fl.h + 1, 1); }
      else { const sk = S.kit.skull.f[0]; this.spr(sk, h.x - sk.w / 2, h.y - 27 + Math.round(Math.sin(t * 5)), 1, 0, 0, null, 0.9); }
      // the hero's health, under its feet
      const bw = 14, fill = Math.max(0, Math.round((bw - 2) * h.hp / h.maxhp));
      this.rect(h.x - bw / 2, h.y + 6, bw, 3, C.ink, 1); this.rect(h.x - bw / 2 + 1, h.y + 7, bw - 2, 1, [0.3, 0.05, 0.08], 1); this.rect(h.x - bw / 2 + 1, h.y + 7, fill, 1, C.red, 1);
    }
    if (ui.aim) this.drawAim(g, ui.aim, t);

    /* numbers on top of everything */
    for (const d of this.nums) {
      d.t += dt;
      const p = d.t / d.life;
      if (p > 0.7 && Math.floor(d.t * 30) % 2) continue;
      const y = d.y0 - Math.min(1, p * 3) * (d.s > 1 ? 9 : 6) - p * 3, w = d.str.length * 4 * d.s + d.s;
      this.text(d.str, d.x - w / 2 + d.vx * p, y - 7 * d.s, d.c, d.s);
    }
    this.nums = this.nums.filter(d => d.t < d.life);

    /* draw: the ground, then everything else in one go */
    gl.viewport(0, 0, W, H);
    gl.clearColor(0.02, 0.02, 0.04, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniform2f(this.u.uView, W, H);
    gl.uniform4fv(this.u.uL, this.lights); gl.uniform1i(this.u.uN, this.nl);
    gl.uniform1f(this.u.uAmb, amb); gl.uniform1f(this.u.uBand, this.band); gl.uniform1f(this.u.uGlow, ui.bandGlow || 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.ramp); gl.uniform1i(this.u.uRamp, 1);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(this.u.uS, 0);
    // the ground: one quad
    const G = new Float32Array([0, 0, W, H, 0, 0, W, H, 1, 1, 1, 1, 0, 0, 0]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gbuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, G);
    gl.bindTexture(gl.TEXTURE_2D, this.gtex); gl.uniform2f(this.u.uTex, this.field.img.w, this.field.img.h);
    gl.uniform1f(this.u.uLift, GROUND_LIFT); gl.uniform1f(this.u.uKeep, 0.12);
    gl.bindVertexArray(this.gvao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
    // the rest
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.inst, 0, this.n * FL);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas); gl.uniform2f(this.u.uTex, S.atlas.w, S.atlas.h);
    gl.uniform1f(this.u.uLift, 0.0); gl.uniform1f(this.u.uKeep, 0.13);
    gl.bindVertexArray(this.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
    gl.bindVertexArray(null);
    this.lastCount = this.n;
  }

  drawHero(g, t, fall, asc) {
    const S = this.S, h = g.hero, hs = S.hero[g.H0.id];
    if (fall) { const r = hs.fallen; this.spr(r, h.x - r.w / 2, h.y + 4 - r.h, 0); return; }
    const moving = Math.hypot(h.vx, h.vy) > 6 && g.state === 'play';
    const fr = hs.f[moving ? Math.floor(t * 7) % 2 : 0];
    const bob = moving ? 0 : Math.round(Math.sin(t * 2.5) * 0.5 + 0.5) - 1;
    const fl = (h.hurtT > 0 && Math.floor(h.hurtT * 30) % 2 === 0) ? 1 : asc ? 0.4 + 0.4 * Math.sin(t * 20) : 0;
    this.q(Math.round(h.x - fr.w / 2), Math.round(h.y + 4 - fr.h) + bob, fr.w, fr.h, fr.u, fr.v, fr.w, fr.h, null, 1, 0, fl, h.face < 0 ? 1 : 0);
  }
  drawKit(g, t) {
    const S = this.S, h = g.hero;
    const books = h.weapons.find(w => w.id === 'books');
    if (books && h.booksOn) {
      const s = h.ws.books, n = s.n + h.amount, R = s.rad * h.area, b = S.kit.book.f[0];
      for (let k = 0; k < n; k++) {
        const a = h.books + k / n * TAU, bx = h.x + Math.cos(a) * R, by = h.y - 3 + Math.sin(a) * R * 0.8;
        for (let j = 1; j <= 3; j++) { const aa = a - j * 0.13; this.px(h.x + Math.cos(aa) * R, h.y - 3 + Math.sin(aa) * R * 0.8, j === 1 ? C.gold : C.gold2, 1 - j * 0.25); }
        this.spr(b, bx - b.w / 2, by - b.h / 2, 1);
      }
    }
    const gar = h.weapons.find(w => w.id === 'garlic');
    if (gar) {
      const R = h.ws.garlic.r * h.area, pulse = this.fx.some(f => f.k === 'garlic');
      this.ring(h.x, h.y, R, WCOL.garlic, pulse ? 0.8 : 0.32, pulse ? 1.5 : 3, 0.8, t * 0.6);
      if (Math.random() < 0.3) { const a = Math.random() * TAU, d = Math.random() * R; this.parts.add(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d * 0.8, 0, -8, 0.5, WCOL.garlic, 1, 1); }
    }
  }
  drawFx(f, g, t) {
    const h = g.hero, p = f.t / f.life;
    switch (f.k) {
      case 'whip': {
        // the lash: a white crack that cools to gold and comes apart
        const n = Math.round(f.len), cut = Math.round(p * n * 0.9);
        for (let i = cut; i < n; i++) {
          const q = i / n, x = h.x + f.side * (4 + i), y = f.y - Math.sin(q * Math.PI) * f.h * 0.55 * (1 - p * 0.4) + q * 3;
          const c = p < 0.35 ? C.white : q > 0.7 ? C.gold2 : C.gold;
          this.px(x, y, c, 1); if (q > 0.15 && q < 0.85 && p < 0.6) this.px(x, y + 1, p < 0.3 ? C.gold : C.gold2, 1);
        }
        break;
      }
      case 'bolt': {
        const R = mulberryLite(f.seed + Math.floor(f.t * 30));
        let x = f.x + (R() - 0.5) * 20, y = -4;
        const c = p < 0.4 ? C.white : C.ice;
        while (y < f.y) { const ny = Math.min(f.y, y + 6 + R() * 10), nx = (ny === f.y) ? f.x : f.x + (x - f.x) * 0.6 + (R() - 0.5) * 12; this.line(x, y, nx, ny, c, 1); if (p < 0.5) this.line(x + 1, y, nx + 1, ny, C.blue, 1); x = nx; y = ny; }
        this.ring(f.x, f.y, f.r * (0.4 + p), C.ice, 1 - p, 1.5);
        break;
      }
      case 'boom': this.ring(f.x, f.y, f.r * (0.3 + p * 0.9), p < 0.3 ? C.white : C.green, 1 - p * 0.7, 1, 0.75); this.ring(f.x, f.y, f.r * p * 0.7, C.fire2, 1 - p, 2, 0.75); break;
      case 'spark': { const r = 1 + p * 4; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.px(f.x + dx * r, f.y + dy * r, p < 0.5 ? C.white : C.blue, 1); this.px(f.x, f.y, C.white, 1 - p); break; }
      case 'mend': this.ring(f.x, f.y, f.r * (0.3 + 0.7 * p), C.mend, 0.8 * (1 - p), 3, 0.75, t); break;
      case 'level': {
        // a pillar of gold and a ring, and the new level over its head
        const hh = 60 * Math.min(1, p * 4);
        for (let i = 0; i < hh; i += 1) if (((i + Math.floor(t * 40)) % 3) && Math.random() < 1 - p) { this.px(h.x - 1 + Math.round((Math.random() - 0.5) * 6 * (1 - i / hh)), h.y - 4 - i, i % 4 ? C.gold : C.white, 1); }
        this.ring(h.x, h.y, 10 + p * 34, C.gold, 1 - p, 1.5, 0.8);
        if (p < 0.85 || Math.floor(t * 30) % 2) this.text('LV ' + f.lv, h.x - 12, h.y - 34 - p * 6, C.gold, 1);
        break;
      }
      case 'ascend': {
        for (let i = 0; i < 80; i++) this.px(h.x - 3 + Math.random() * 6, h.y - Math.random() * 200, Math.random() < 0.5 ? C.white : C.gold, 1);
        this.ring(h.x, h.y, (f.t * 160) % 220, C.gold, 1, 1.2, 0.8);
        break;
      }
    }
  }
  // the edge you're aiming at: a rift outline and a ghost of what comes up, or a red cross where you can't
  drawAim(g, aim, t) {
    if (aim.kind === 'spawn') {
      const along = aim.side === 'l' || aim.side === 'r', ok = aim.ok, c = ok ? C.violet : C.red, n = 7;
      for (let i = -n; i <= n; i++) if ((i + Math.floor(t * 12)) % 3) this.px(aim.x + (along ? 0 : i), aim.y + (along ? i : 0), c, 0.9);
      if (ok && aim.type) { const fr = this.S.mob[aim.type].f[0], inn = { l: [6, 0], r: [-6, 0], t: [0, 6], b: [0, -6] }[aim.side]; this.spr(fr, aim.x + inn[0] - fr.w / 2, aim.y + inn[1] - fr.h / 2, 1, 0, 0, C.lilac, 0.45 + 0.15 * Math.sin(t * 8)); }
      if (!ok) for (let i = -3; i <= 3; i++) { this.px(aim.x + i, aim.y + i, C.red); this.px(aim.x + i, aim.y - i, C.red); }
    } else if (aim.kind === 'flag') {
      const fl = this.S.kit.flag.f[0]; this.spr(fl, aim.x - 1, aim.y - fl.h + 1, 1, 0, 0, null, 0.4);
    }
  }
}

function mulberryLite(seed) { let a = (seed * 9301 + 49297) | 0; return () => { a = (a * 1103515245 + 12345) | 0; return ((a >>> 8) & 0xffff) / 65536; }; }
