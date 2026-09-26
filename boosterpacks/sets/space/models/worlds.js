// Outer Space models: worlds. Eight globes floating in space, each with a feature of its own: Pluto's pale heart (and
// Charon), potato-shaped Phobos with its grooves and giant crater, Neptune's dark storm and faint rings, the Moon's
// famous face, Mars with its canyon and polar cap (and two tiny moons), Jupiter's bands and Great Red Spot (with Io
// casting its shadow), the blue marble Earth with clouds, air and its Moon, and Saturn in its rings.
// Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.
//
// Every globe is a sphere wearing an equirectangular map painted in degrees: longitude 0 faces the front (+z), east is
// to the right and latitude 90 is the north pole. orient() spins it to show the right face, tilts its axis and turns
// it toward the camera.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mulC = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const hex = c => '#' + c.map(v => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');
// Painted maps are cached between renders, so painting draws on its own seeded random numbers, never k.rand()
// (or the geometry would come out different the second time).
const rng = seed => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash3 = (i, j, s) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// Seeded 3D gradient noise (about -1..1), and a few octaves of it.
function makeNoise(seed) {
  const R = rng(seed), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const P = new Uint8Array(512); for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
  const n3 = (x, y, z) => {
    let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    x -= X; y -= Y; z -= Z; X &= 255; Y &= 255; Z &= 255;
    const u = fade(x), v = fade(y), w = fade(z);
    const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
    const g0 = grad(P[AA], x, y, z), g1 = grad(P[BA], x - 1, y, z), g2 = grad(P[AB], x, y - 1, z), g3 = grad(P[BB], x - 1, y - 1, z);
    const g4 = grad(P[AA + 1], x, y, z - 1), g5 = grad(P[BA + 1], x - 1, y, z - 1), g6 = grad(P[AB + 1], x, y - 1, z - 1), g7 = grad(P[BB + 1], x - 1, y - 1, z - 1);
    const a = g0 + u * (g1 - g0), b = g2 + u * (g3 - g2), c = g4 + u * (g5 - g4), d = g6 + u * (g7 - g6);
    const e = a + v * (b - a), f = c + v * (d - c);
    return e + w * (f - e);
  };
  const fbm = (x, y, z, oct = 4) => { let s = 0, a = 1, t = 0; for (let i = 0; i < oct; i++) { s += a * n3(x, y, z); t += a; a *= .5; x *= 2.02; y *= 2.02; z *= 2.02; } return s / t; };
  return { n3, fbm };
}
// How far from the nearest cell wall of a jittered grid (0 on a wall): cracked ice, polygon plains.
function cells(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y); let d1 = 9, d2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i + .12 + .76 * hash3(xi + i, yi + j, s), cy = yi + j + .12 + .76 * hash3(xi + i, yi + j, s + 91), d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return Math.sqrt(d2) - Math.sqrt(d1);
}
// Signed distance to a heart (Inigo Quilez's): tip at (0, 0), lobes up to y ≈ 1.1, x within ±0.6.
function sdHeart(x, y) {
  x = Math.abs(x);
  if (y + x > 1) return Math.hypot(x - .25, y - .75) - Math.SQRT2 / 4;
  const a = x * x + (y - 1) ** 2, t = .5 * Math.max(x + y, 0), b = (x - t) ** 2 + (y - t) ** 2;
  return Math.sqrt(Math.min(a, b)) * Math.sign(x - y);
}
// A colour ramp: stops [[t, '#hex'], ...], eased from one to the next, looked up from a table.
function ramp(stops, n = 1024) {
  const S = stops.map(([t, c]) => [t, rgb(c)]), lo = S[0][0], hi = S[S.length - 1][0], tab = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = lo + (hi - lo) * i / (n - 1); let j = 1;
    while (j < S.length - 1 && S[j][0] < t) j++;
    tab.set(mixC(S[j - 1][1], S[j][1], smooth(S[j - 1][0], S[j][0], t)), i * 3);
  }
  return t => { const i = Math.round(clamp((t - lo) / (hi - lo)) * (n - 1)) * 3; return [tab[i], tab[i + 1], tab[i + 2]]; };
}

/* ---------- the globe's map, painted in degrees ---------- */
// The point on the unit globe at a longitude and latitude (degrees).
const sph = (lon, lat) => { const a = lon * DEG, b = lat * DEG; return [Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b)]; };
// A spot to measure from; local(f, x, y, z) gives [east, north] from it in degrees of arc (azimuthal equidistant),
// so round things painted with it stay round on the globe however far north they are.
const spot = (lon, lat) => { const a = lon * DEG, b = lat * DEG, sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b); return { c: [sa * cb, sb, ca * cb], e: [ca, 0, -sa], n: [-sb * sa, cb, -sb * ca] }; };
const local = (f, x, y, z) => {
  const d = x * f.c[0] + y * f.c[1] + z * f.c[2], e = x * f.e[0] + z * f.e[2], n = x * f.n[0] + y * f.n[1] + z * f.n[2], s = Math.hypot(e, n);
  if (s < 1e-9) return [0, 0];
  const ang = Math.acos(clamp(d, -1, 1)) / DEG; return [e / s * ang, n / s * ang];
};
// Where you get to going s degrees from (lon, lat) along a great circle, heading az (radians, 0 = north, clockwise).
function gc(lon, lat, az, s) {
  const p1 = lat * DEG, l1 = lon * DEG, d = s * DEG, p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(az));
  const l2 = l1 + Math.atan2(Math.sin(az) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [((l2 / DEG + 540) % 360) - 180, p2 / DEG];
}
// Painting tools for an equirectangular map W × H.
function painter(c, W, H) {
  const X = lon => (lon + 180) / 360 * W, Y = lat => (90 - lat) / 180 * H;
  const P = { c, W, H, X, Y };
  // Draw round a spot in degrees of arc (x east, y south), stretched east-west as the map needs this far north, and
  // repeated across the seam at ±180°.
  P.at = (lon, lat, reach, draw) => {
    const x = X(lon), y = Y(lat), sx = W / 360 / Math.max(.06, Math.cos(lat * DEG)), sy = H / 180, span = reach * sx;
    for (const dx of [0, -W, W]) {
      if (x + dx + span < 0 || x + dx - span > W) continue;
      c.save(); c.translate(x + dx, y); c.scale(sx, sy); draw(c); c.restore();
    }
  };
  P.ellipse = (lon, lat, rx, ry = rx, rot = 0) => P.at(lon, lat, Math.max(rx, ry) * 1.1, g => { g.rotate(-rot); g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill(); });
  // A soft round spot fading out to its edge: colour as 'r,g,b'.
  P.soft = (lon, lat, r, color, a = 1, inner = 0) => P.at(lon, lat, r, g => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, `rgba(${color},${a})`); gr.addColorStop(clamp(inner, 0, .99), `rgba(${color},${a})`); gr.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  });
  // A closed outline through [lon, lat, lon, lat, ...], rounded off between the points.
  P.path = (flat, dx = 0) => {
    const q = []; for (let i = 0; i < flat.length; i += 2) q.push([X(flat[i]) + dx, Y(flat[i + 1])]);
    const n = q.length, mid = i => [(q[i % n][0] + q[(i + 1) % n][0]) / 2, (q[i % n][1] + q[(i + 1) % n][1]) / 2], p = new Path2D();
    const m0 = mid(n - 1); p.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const m = mid(i); p.quadraticCurveTo(q[i][0], q[i][1], m[0], m[1]); }
    p.closePath(); return p;
  };
  P.poly = flat => { for (const dx of [0, -W, W]) c.fill(P.path(flat, dx)); };
  // Per pixel: fn(q, x, y, z, lon, lat, i), q = [r, g, b, a] (0–1, read from the canvas and written back),
  // (x, y, z) the point on the unit globe, i the pixel's index (to look up masks).
  P.pixels = fn => {
    const img = c.getImageData(0, 0, W, H), d = img.data, q = [0, 0, 0, 1], sL = new Float32Array(W), cL = new Float32Array(W), lons = new Float32Array(W);
    for (let i = 0; i < W; i++) { lons[i] = (i + .5) / W * 360 - 180; sL[i] = Math.sin(lons[i] * DEG); cL[i] = Math.cos(lons[i] * DEG); }
    for (let j = 0; j < H; j++) {
      const lat = 90 - (j + .5) / H * 180, cb = Math.cos(lat * DEG), sb = Math.sin(lat * DEG);
      for (let i = 0; i < W; i++) {
        const n = (j * W + i) * 4;
        q[0] = d[n] / 255; q[1] = d[n + 1] / 255; q[2] = d[n + 2] / 255; q[3] = d[n + 3] / 255;
        fn(q, sL[i] * cb, sb, cL[i] * cb, lons[i], lat, j * W + i);
        d[n] = q[0] * 255; d[n + 1] = q[1] * 255; d[n + 2] = q[2] * 255; d[n + 3] = q[3] * 255;
      }
    }
    c.putImageData(img, 0, 0);
  };
  // Draw with draw(P2) on a layer of its own, then lay it over the map blurred (one blur for the lot, which is much
  // quicker than blurring shape by shape). Blur radii are in pixels of a 2048-wide map, and scale with the map.
  P.layer = (draw, blur = 0, op = 'source-over') => {
    const m = document.createElement('canvas'); m.width = W; m.height = H;
    draw(painter(m.getContext('2d'), W, H));
    c.save(); c.globalCompositeOperation = op; if (blur) c.filter = `blur(${blur * W / 2048}px)`; c.drawImage(m, 0, 0); c.restore();
  };
  // A 0–1 mask the size of the map: white shapes drawn by draw(P2) on black (or `back`), blurred a little if asked.
  P.mask = (draw, blur = 0, back = '#000') => {
    const m = document.createElement('canvas'); m.width = W; m.height = H;
    const g = m.getContext('2d', { willReadFrequently: true }); g.fillStyle = back; g.fillRect(0, 0, W, H);
    painter(g, W, H).layer(Q => { Q.c.fillStyle = '#fff'; Q.c.strokeStyle = '#fff'; draw(Q); }, blur);
    const d = g.getImageData(0, 0, W, H).data, out = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) out[i] = d[i * 4] / 255;
    return out;
  };
  return P;
}
const mapTex = (k, W, H, paint, o = {}) => k.tex(W, H, (c, w, h) => {
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);          // opaque to start with: pixels() keeps whatever alpha it finds
  paint(c, painter(c, w, h));
}, o);

/* ---------- light, shading and glow ---------- */
// The camera's frame for a view (az, el in degrees, as the studio uses them): right, up, and back toward the viewer.
function camBasis(k, v = {}) {
  const T = k.THREE, az = k.deg(v.az ?? 30), el = k.deg(v.el ?? 16);
  const back = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const right = new T.Vector3(0, 1, 0).cross(back).normalize(), up = back.clone().cross(right);
  return { right, up, back };
}

// The light for a scene of globes: a sun from `sunCam` (a direction in the camera's frame: x right, y up, z toward
// the viewer), so the night side and terminator fall where they look best, and a faint cool light from behind on the
// right to keep dark limbs off the black of space. Directions come out in the model's own frame (sunW, fillW) and the
// camera's (sunV).
function lighting(k, view = {}, sunCam = [-.78, .42, .46]) {
  const T = k.THREE, { right, up, back } = camBasis(k, view), sunV = new T.Vector3(...sunCam).normalize();
  const toW = v => right.clone().multiplyScalar(v.x).addScaledVector(up, v.y).addScaledVector(back, v.z).normalize();
  return { sunV, sunW: toW(sunV), fillW: toW(new T.Vector3(.8, .05, -.6)) };
}
// A globe's material, lit like something in space: our own sun and back light in place of the studio's lights, much
// less of the studio's soft fill (so the night side falls dark), an optional coloured glow round the limb (air seen
// edge-on, brighter on the day side), and optional extra shader code: o.decl (uniform declarations), o.frag (runs
// after the lights, with vObj = the object-space position).
function planetMat(k, params, o = {}) {
  const T = k.THREE, m = k.mat({ roughness: 1, metalness: 0, ...params }), L = o.light;
  const U = { uAmb: { value: o.amb ?? .3 }, uRim: { value: k.color(o.rim ?? '#000000') }, uRimPow: { value: o.rimPow ?? 3.5 },
    uSunW: { value: L.sunW.clone() }, uSunC: { value: k.color(o.sunColor ?? '#fff3e6').multiplyScalar(o.sun ?? 3) },
    uFillW: { value: L.fillW.clone() }, uFillC: { value: k.color(o.fillColor ?? '#a9c2ff').multiplyScalar(o.fill ?? .35) }, ...o.uniforms };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vObj;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvObj = transformed;');
    sh.fragmentShader = 'uniform float uAmb;\nuniform vec3 uRim;\nuniform float uRimPow;\nuniform vec3 uSunW;\nuniform vec3 uSunC;\nuniform vec3 uFillW;\nuniform vec3 uFillC;\nvarying vec3 vObj;\n' + (o.decl ?? '') + '\n' +
      sh.fragmentShader.replace('#include <lights_fragment_end>', `vec3 sunV = normalize((viewMatrix * vec4(uSunW, 0.0)).xyz);
	reflectedLight.directDiffuse = vec3(0.0); reflectedLight.directSpecular = vec3(0.0);
	{
		IncidentLight sl; sl.visible = true;
		sl.direction = sunV; sl.color = uSunC;
		RE_Direct(sl, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
		sl.direction = normalize((viewMatrix * vec4(uFillW, 0.0)).xyz); sl.color = uFillC;
		RE_Direct(sl, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
	}
	irradiance *= uAmb; iblIrradiance *= uAmb;
	#include <lights_fragment_end>
	{
		vec3 gN = normalize(vNormal);
		float fr = 1.0 - clamp(dot(gN, normalize(vViewPosition)), 0.0, 1.0);
		totalEmissiveRadiance += uRim * pow(fr, uRimPow) * clamp(dot(gN, sunV) * 1.2 + .3, 0.0, 1.0);
	}
	${o.frag ?? ''}`);
  };
  m.customProgramCacheKey = () => `worlds-planet|${o.decl ?? ''}|${o.frag ?? ''}`;
  return m;
}
// A thin shell of air round a globe: adds a glow that brightens toward the limb, more on the day side.
function atmosphere(k, r, color, o = {}) {
  const T = k.THREE, m = new T.MeshBasicMaterial({ color: k.color(color), transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  const U = { uPow: { value: o.pow ?? 3 }, uStr: { value: o.strength ?? 1 }, uDay: { value: o.day ?? .8 }, uSunW: { value: o.light.sunW.clone() } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vRN;\nvarying vec3 vRV;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tvRN = normalize(normalMatrix * normal); vRV = -mvPosition.xyz;');
    sh.fragmentShader = 'uniform float uPow;\nuniform float uStr;\nuniform float uDay;\nuniform vec3 uSunW;\nvarying vec3 vRN;\nvarying vec3 vRV;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `{
		vec3 rn = normalize(vRN), sv = normalize((viewMatrix * vec4(uSunW, 0.0)).xyz);
		float fr = 1.0 - abs(dot(rn, normalize(vRV)));
		float lit = mix(1.0, clamp(dot(rn, sv) * 1.3 + .35, 0.0, 1.0), uDay);
		diffuseColor.a *= pow(fr, uPow) * lit * uStr;
	}
	#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'worlds-atmosphere';
  const mesh = k.mesh(k.sphere(r, { w: 96, h: 64 }), m, { shadow: false });
  mesh.renderOrder = o.order ?? 3;
  return mesh;
}
// A soft glow round a globe of radius r: a camera-facing sprite (it doesn't count when the studio frames the model),
// brightest just off the limb and on the side the light comes from.
function halo(k, r, color, o = {}) {
  const T = k.THREE, S = o.spread ?? 1.16, kv = o.kv ?? new T.Vector3(-.54, .64, .55), l = Math.hypot(kv.x, kv.y) || 1, lx = kv.x / l, ly = kv.y / l, side = o.side ?? .6, fall = o.fall ?? 10;
  const tex = k.tex(256, 256, (c, w, h) => {
    const img = c.createImageData(w, h), d = img.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = ((i + .5) / w * 2 - 1) * S, y = (1 - (j + .5) / h * 2) * S, rr = Math.hypot(x, y);
      let a = rr < 1 ? smooth(.92, 1, rr) : Math.exp(-(rr - 1) * fall);
      a *= smooth(S, S * .8, rr) * (1 - side + side * clamp(.45 + .65 * (rr > 1e-6 ? (x * lx + y * ly) / rr : 0)));
      const n = (j * w + i) * 4; d[n] = d[n + 1] = d[n + 2] = 255; d[n + 3] = a * 255;
    }
    c.putImageData(img, 0, 0);
  }, { cache: `worlds:halo:${S}:${side}:${fall}:${lx.toFixed(2)}:${ly.toFixed(2)}` });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, opacity: o.opacity ?? .5, blending: T.AdditiveBlending, depthWrite: false }));
  s.scale.set(r * S * 2, r * S * 2, 1);
  if (o.p) s.position.set(...o.p);
  s.renderOrder = 4;
  return s;
}
// Turn a globe: spin longitude `face` round to the front, roll its axis (degrees, + leans the north pole left), tip
// the north pole toward the viewer (pitch, degrees), then turn it to face the camera at azimuth az.
function orient(k, obj, o = {}) {
  const T = k.THREE;
  obj.quaternion.setFromEuler(new T.Euler(k.deg(o.pitch ?? 0), k.deg(o.az ?? 30), k.deg(o.roll ?? 0), 'YXZ'))
    .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), k.deg(-(o.face ?? 0))));
  return obj;
}
// A sphere whose map puts longitude 0 at the front (+z) and east to the right; flat < 1 squashes it at the poles.
function globe(k, r, seg = 128, flat = 1) {
  const geo = k.sphere(r, { w: seg, h: Math.round(seg * .6) });
  geo.rotateY(-Math.PI / 2);
  if (flat !== 1) geo.scale(1, flat, 1);
  return geo;
}
// A flat ring in the xz plane whose uv runs u: inner → outer edge, v: once round.
function ringGeo(k, rIn, rOut, seg = 256, rs = 8) {
  const geo = new k.THREE.RingGeometry(rIn, rOut, seg, rs), uv = geo.attributes.uv;
  for (let j = 0, n = 0; j <= rs; j++) for (let i = 0; i <= seg; i++, n++) uv.setXY(n, j / rs, i / seg);
  geo.rotateX(-Math.PI / 2);
  return geo;
}
// Give vertices that share a position one shared normal, so seams on displaced spheres don't show.
function weld(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, groups = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${Math.round(p.getX(i) * 1e4)}|${Math.round(p.getY(i) * 1e4)}|${Math.round(p.getZ(i) * 1e4)}`;
    const a = groups.get(key); a ? a.push(i) : groups.set(key, [i]);
  }
  for (const a of groups.values()) {
    if (a.length < 2) continue;
    let x = 0, y = 0, z = 0;
    for (const i of a) { x += n.getX(i); y += n.getY(i); z += n.getZ(i); }
    const l = Math.hypot(x, y, z) || 1;
    for (const i of a) n.setXYZ(i, x / l, y / l, z / l);
  }
  return geo;
}
// A crater's height profile across t = distance / radius: a bowl, a raised rim, and ejecta fading outside.
const craterH = (t, rim = .25) => t < 1 ? (t * t - 1) + rim * t ** 4 : rim * Math.exp(-(((t - 1) / .32) ** 2));
// A lumpy little moon (Phobos and Deimos seen from afar): a squashed, dented grey-brown ball.
function lumpy(k, r, axes, seed, colors = ['#6d6158', '#9a8b7e']) {
  const T = k.THREE, N = makeNoise(seed), R = rng(seed + 1), geo = new T.SphereGeometry(1, 40, 28), p = geo.attributes.position, col = [], c = new T.Color();
  const dents = Array.from({ length: 7 }, () => { const z = R() * 2 - 1, a = R() * TAU, s = Math.sqrt(1 - z * z); return [s * Math.cos(a), z, s * Math.sin(a), .25 + R() * .3]; });
  const lo = rgb(colors[0]), hi = rgb(colors[1]);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let h = .12 * N.fbm(x * 1.6, y * 1.6, z * 1.6, 3);
    for (const [dx, dy, dz, dr] of dents) { const t = Math.acos(clamp(x * dx + y * dy + z * dz, -1, 1)) / dr; if (t < 2) h += craterH(t) * dr * .25; }
    p.setXYZ(i, x * axes[0] * r * (1 + h), y * axes[1] * r * (1 + h), z * axes[2] * r * (1 + h));
    const q = mixC(lo, hi, smooth(-.5, .5, N.fbm(x * 3 + 9, y * 3, z * 3, 3) + h * 2));
    c.setRGB(q[0], q[1], q[2], T.SRGBColorSpace); col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return weld(geo);
}

/* ---------- the Moon's face (for the Moon, and the Earth's little Moon) ---------- */
// [lon, lat, rx, ry, rot, shade]: overlapping soft ellipses make each sea; shade 0 is the darkest.
const MARIA = [
  [-56, 30, 13, 11, .4, .62], [-60, 14, 13, 12, 0, .6], [-50, 2, 12, 9, -.3, .58], [-42, 40, 9, 7, .5, .6], [-64, -6, 8, 9, 0, .58], [-46, 18, 11, 9, 0, .62], [-36, 28, 8, 6, 0, .6], [-70, 25, 6, 11, 0, .6], // Oceanus Procellarum
  [-28, 8, 9, 6, 0, .56],                                          // Mare Insularum
  [-16, 34, 17, 14, 0, .42], [-26, 42, 9, 6, .2, .45], [-5, 28, 8, 7, 0, .45], // Mare Imbrium
  [17.5, 28, 10, 9.5, 0, .55],                                     // Mare Serenitatis
  [30, 9, 11, 8, .3, .25], [22, 4, 7, 5, 0, .3], [38, 15, 7, 6, 0, .28], [26, 14, 6, 5, 0, .3], // Mare Tranquillitatis
  [59, 17, 8, 6.5, 0, .22],                                        // Mare Crisium
  [51, -6, 7, 11, -.15, .38], [46, -14, 5, 5, 0, .4],              // Mare Fecunditatis
  [35, -15, 5, 5, 0, .34],                                         // Mare Nectaris
  [-17, -20, 11, 8, 0, .58], [-10, -15, 6, 5, 0, .6], [-24, -10, 6, 5, 0, .56], // Mare Nubium, Mare Cognitum
  [-39, -24, 6, 6, 0, .42],                                        // Mare Humorum
  [4, 13, 4.5, 3.5, 0, .5], [2, 2, 3.5, 2.5, 0, .55],              // Mare Vaporum, Sinus Medii
  [-35, 57, 9, 2.4, .1, .72], [-15, 58, 10, 2.2, 0, .72], [5, 57, 10, 2.2, -.05, .72], [25, 56, 9, 2.2, -.1, .72], // Mare Frigoris
  [30, 37, 5, 3.5, 0, .55], [0, 27, 4, 3, 0, .5],                  // Lacus Somniorum, Palus Putredinis
  [85, 1, 5, 5, 0, .4], [86, 13, 5, 4, 0, .45], [84, -40, 6, 5, 0, .5], // Smythii, Marginis, Australe
];
// Named craters: [lon, lat, radius (deg), rays, brightness, dark floor]
const CRATERS = [
  [-11.2, -43.3, 1.6, 1, 1.25, 0],   // Tycho, with its great rays
  [-20.1, 9.6, 1.55, .7, .8, 0],   // Copernicus
  [-38, 8.1, .6, .45, .8, 0],      // Kepler
  [-47.4, 23.7, .65, .3, 1, 0],    // Aristarchus, the brightest spot
  [46.8, 16.1, .5, .35, .8, 0],    // Proclus
  [-9.4, 51.6, 1.7, 0, 0, 1],      // Plato, dark-floored
  [-68.6, -5.2, 2.9, 0, 0, 1],     // Grimaldi
  [-14.4, -58.4, 3.8, 0, 0, 0],    // Clavius
  [-1.9, -9.3, 2.5, 0, 0, 0], [-2.9, -13.4, 1.9, 0, 0, 0], [-1.9, -18.2, 1.6, 0, 0, 0], // Ptolemaeus, Alphonsus, Arzachel
  [26.4, -11.4, 1.7, 0, .2, 0], [24, -13.2, 1.6, 0, 0, 0], [23.4, -18, 1.7, 0, 0, 0],  // Theophilus, Cyrillus, Catharina
  [61.1, -8.9, 2.2, 0, .3, 0], [60.4, -25.3, 2.9, 0, 0, 0],     // Langrenus, Petavius
  [-4, 29.7, 1.35, 0, 0, .4], [-11.3, 14.5, .95, 0, .2, 0],     // Archimedes, Eratosthenes
  [5.2, -43.4, 1.6, 0, 0, 0], [-6.2, -34, 1.4, 0, 0, 0], [9, -28, 1.3, 0, 0, 0], [-27, -55, 1.8, 0, 0, 0], [28, -48, 1.6, 0, 0, 0],
];
function moonMaps(k, W = 1536) {
  const N = makeNoise(707), R = rng(708);
  // scattered craters, mostly in the bright highlands
  const inSea = (lon, lat) => { const [x, y, z] = sph(lon, lat); return MARIA.some(([ml, mb, rx, ry]) => { const [u, v] = local(spot(ml, mb), x, y, z); return (u / rx) ** 2 + (v / ry) ** 2 < 1; }); };
  const small = [];
  for (let i = 0; small.length < 420 && i < 4000; i++) {
    const lon = R() * 360 - 180, lat = Math.asin(R() * 2 - 1) / DEG, r = .25 + Math.pow(R(), 3.2) * 2.6;
    if (inSea(lon, lat) && (r > .6 || R() < .75)) continue;
    small.push([lon, lat, r]);
  }
  const seaMask = P => { for (const [lon, lat, rx, ry, rot] of MARIA) P.ellipse(lon, lat, rx, ry, rot); };
  const map = mapTex(k, W, W / 2, (c, P) => {
    const sea = P.mask(seaMask, 16);
    const shade = P.mask(Q => { for (const [lon, lat, rx, ry, rot, s] of MARIA) { Q.c.fillStyle = hex([s, s, s]); Q.ellipse(lon, lat, rx * 1.2, ry * 1.2, rot); } }, 16, '#999999');
    P.pixels((q, x, y, z, lon, lat, i) => {
      const n = N.fbm(x * 4, y * 4, z * 4, 4), f = N.fbm(x * 26, y * 26, z * 26, 3), e = N.fbm(x * 11 + 8, y * 11, z * 11, 3);
      const m = smooth(.12, .66, sea[i] + .2 * n + .1 * e);
      const hi = mixC(rgb('#b0aba2'), rgb('#d6d1c8'), smooth(-.45, .5, n + .6 * f));
      const lo = mixC(rgb('#6d7077'), rgb('#9c9993'), clamp(shade[i] + .25 * n + .12 * e));
      const col = mulC(mixC(hi, lo, m), .95 + .1 * f);
      q[0] = col[0]; q[1] = col[1]; q[2] = col[2];
    });
    // craters: a faint dark floor and a pale rim; the fresh ones splash bright ejecta round them
    for (const [lon, lat, r] of small) P.at(lon, lat, r * 1.3, g => {
      g.fillStyle = 'rgba(70,68,64,.07)'; g.beginPath(); g.arc(0, 0, r * .8, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(236,232,222,.1)'; g.lineWidth = r * .25; g.beginPath(); g.arc(0, 0, r * .9, 0, TAU); g.stroke();
    });
    for (const [lon, lat, r, , bright, dark] of CRATERS) P.at(lon, lat, r * 2.8, g => {
      if (bright) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 2.8); gr.addColorStop(0, `rgba(252,250,244,${.9 * bright})`); gr.addColorStop(.3, `rgba(244,242,234,${.45 * bright})`); gr.addColorStop(1, 'rgba(240,238,230,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 2.8, 0, TAU); g.fill(); }
      g.fillStyle = dark ? `rgba(70,72,78,${.8 * dark})` : 'rgba(80,78,74,.14)'; g.beginPath(); g.arc(0, 0, r * .82, 0, TAU); g.fill();
      g.strokeStyle = `rgba(240,237,228,${bright ? .75 : .25})`; g.lineWidth = r * .22; g.beginPath(); g.arc(0, 0, r * .9, 0, TAU); g.stroke();
    });
    // rays: Tycho throws long bright streaks along great circles; the other fresh craters splash softer, shorter ones
    c.fillStyle = '#f4f1e8';
    for (const [lon, lat, r, rays] of CRATERS) {
      if (!rays) continue;
      const long = rays >= 1, n = Math.round((long ? 40 : 60) * Math.max(.5, rays)), Rr = rng(Math.round(lon * 100 + lat));
      for (let i = 0; i < n; i++) {
        const az = Rr() * TAU;
        const L = long ? (18 + Rr() * 42) * (Rr() < .2 ? 1.5 : 1) : r * (3 + Rr() * 9) * (.6 + rays), w = long ? .6 + Rr() * 1 : r * (.5 + Rr() * .8), a = long ? .13 + Rr() * .12 : .05 + Rr() * .05;
        for (let s = r * 1.2; s < L; s += w * .45) {
          const f = 1 - s / L, [lo, la] = gc(lon, lat, az + (Rr() - .5) * (long ? .02 : .2), s);
          c.globalAlpha = a * f * (.6 + .4 * Rr()); P.ellipse(lo, la, w * (.4 + .6 * f), w * (.4 + .6 * f));
        }
      }
    }
    c.globalAlpha = 1;
  }, { cache: `worlds:moon:map:${W}` });
  const bump = mapTex(k, W, W / 2, (c, P) => {
    const sea = P.mask(seaMask, 12);
    P.pixels((q, x, y, z, lon, lat, i) => {
      const n = N.fbm(x * 9 + 4, y * 9, z * 9, 4), m = smooth(.25, .55, sea[i]);
      q[0] = q[1] = q[2] = .55 + lerp(.18, .04, m) * n - .05 * m;
    });
    const crater = (lon, lat, r, depth = 1) => P.at(lon, lat, r * 1.5, g => {
      let gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, `rgba(0,0,0,${.5 * depth})`); gr.addColorStop(.7, `rgba(0,0,0,${.35 * depth})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      gr = g.createRadialGradient(0, 0, r * .72, 0, 0, r * 1.45);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.33, `rgba(255,255,255,${.3 * depth})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 1.45, 0, TAU); g.fill();
    });
    const Rd = rng(31);
    for (const [lon, lat, r] of small) crater(lon, lat, r, .25 + .45 * Rd());
    for (const [lon, lat, r] of CRATERS) crater(lon, lat, r, 1);
  }, { cache: `worlds:moon:bump:${W}`, data: true });
  return { map, bump };
}

/* ---------- the Earth's continents, [lon, lat, ...] ---------- */
const LAND = [
  // North and Central America
  [-168, 65.6, -165, 68.2, -163, 69.8, -157, 71.2, -150, 70.4, -141, 69.7, -134, 69.4, -128, 70.1, -120, 69.4, -114, 68.4, -106, 68.3, -99, 67.6, -95, 68.2, -94.5, 64, -94.2, 60.5, -92.8, 58.5, -89, 56.8, -85, 55.2, -82.3, 53.5, -80, 51.3, -79, 52.5, -78.8, 54.5, -77, 56.5, -77, 59.5, -78, 62.3, -74, 62.3, -70, 61, -69.5, 59, -67, 58.5, -64.5, 60.2, -62, 57.5, -60.5, 55.5, -57.5, 54, -56, 52, -59.5, 50.3, -64, 50.2, -66.5, 50, -64.3, 48.9, -65, 47.8, -64.8, 46.6, -63, 45.7, -61, 45.5, -61.5, 44.9, -63.5, 44.5, -65.8, 43.6, -67.2, 44.6, -70.2, 43.7, -70.8, 42.5, -70, 41.8, -71.4, 41.4, -73.9, 40.5, -74.2, 39.5, -75.2, 38.7, -76.1, 37, -75.6, 35.3, -77, 34.5, -78.6, 33.8, -80.3, 32.3, -81.3, 31, -81.3, 29.5, -80.5, 28, -80.1, 26.3, -80.4, 25.2, -81.1, 25.1, -81.8, 26.3, -82.6, 27.8, -82.8, 29.1, -84, 30.1, -85.4, 29.7, -87, 30.4, -88.5, 30.3, -89.5, 30.2, -89.3, 29.1, -90.5, 29.1, -92.2, 29.6, -94, 29.6, -95.5, 28.8, -97.1, 27.7, -97.4, 26, -97.7, 24, -97.7, 22.2, -97.2, 20.7, -96.2, 19.2, -94.7, 18.2, -92.3, 18.6, -91, 19.2, -90.4, 20.9, -88.3, 21.5, -86.9, 21.4, -87.4, 19.8, -88.1, 18.5, -88.3, 16.2, -86.5, 15.8, -84, 15.8, -83.2, 15, -83.7, 12.5, -83.6, 10.9, -82.3, 9.5, -81, 8.9, -79.6, 9.5, -78, 9.2, -77.3, 8.6, -78.3, 7.2, -80.3, 7.4, -80.6, 8.2, -82.3, 8.2, -83.7, 8.6, -85.7, 9.9, -85.8, 11.3, -87.4, 12.9, -89.2, 13.4, -91.4, 13.9, -93.8, 15.8, -95, 16.1, -96.6, 15.7, -98.8, 16.5, -101, 17.4, -103.5, 18.3, -105.3, 20, -105.4, 21.7, -106.4, 23.2, -108.2, 25.2, -109.4, 26.6, -111, 27.9, -112.3, 29.2, -113.3, 31, -114.8, 31.8, -114.3, 29.9, -113, 28.5, -112.1, 26.5, -110.6, 24.2, -109.5, 23.1, -110.2, 23.4, -112.1, 24.8, -112.4, 26.4, -114.1, 27.8, -114.9, 29.6, -116.3, 31, -117.1, 32.5, -118.4, 33.8, -120.6, 34.6, -121.9, 36.5, -122.5, 37.7, -123.8, 39.8, -124.3, 40.4, -124.1, 42.5, -124, 46.2, -124.7, 48.3, -123.2, 49, -125.5, 50.2, -127.9, 51.8, -130.2, 54.6, -132.5, 56.5, -135.5, 58.5, -139.5, 59.7, -144, 60.1, -147.5, 60.8, -150, 61.2, -151.8, 59.6, -154, 57.6, -157.5, 56.4, -161.5, 55.2, -163.8, 54.8, -160, 58.2, -162, 59.8, -164.9, 60.6, -165.4, 62.3, -164.3, 63.3, -161.2, 64.4, -165.5, 64.6],
  // South America
  [-77.3, 8.6, -75.6, 10.6, -74.2, 11.3, -71.7, 12.4, -71.2, 11.7, -70, 12.2, -68.2, 10.6, -65, 10.2, -62.3, 10.7, -61.6, 10.1, -60.5, 8.6, -59.2, 7.5, -57.5, 6.2, -55, 5.9, -52.5, 5.2, -51, 4.2, -50, 1.8, -49.4, 0.1, -48.3, -1, -46.5, -0.9, -44.5, -2.5, -41.5, -2.9, -39.3, -3.4, -37.2, -4.8, -35.4, -5.3, -34.8, -7.6, -35.2, -9.3, -37, -11.3, -38.7, -13.2, -39, -15.6, -39.2, -17.8, -40.4, -20.5, -41, -22, -42.2, -22.9, -44.6, -23.3, -46.7, -24.1, -48.2, -25.6, -48.7, -28.5, -50.2, -30.7, -52.2, -32.5, -53.4, -33.8, -54.9, -34.9, -56.3, -34.9, -57.3, -35.2, -57.1, -36.4, -57.7, -38.2, -59.5, -38.8, -62.1, -38.9, -62.4, -40.5, -65, -41, -64.5, -42.4, -63.7, -42.8, -65.1, -43.6, -65.6, -45.1, -67.5, -46.3, -66.2, -47.6, -65.8, -48.2, -67.8, -49.9, -69, -51.6, -68.4, -52.4, -69.5, -52.3, -68.6, -53.1, -67.3, -54.6, -65.1, -54.9, -66.7, -55.2, -68.6, -55.5, -71, -55, -72.6, -53.5, -74.5, -52, -75.2, -48.5, -74.6, -46.5, -74, -44, -73.4, -42.5, -73.8, -40.5, -73.3, -37.2, -72.5, -35, -71.6, -32.7, -71.5, -29.2, -70.8, -26.4, -70.4, -23.6, -70.1, -19.8, -70.4, -18.4, -71.7, -17.3, -75.2, -15.3, -76.3, -13.5, -77.2, -12, -78.4, -9.6, -79.6, -7.5, -81.2, -6.1, -80.9, -4.8, -80.2, -3.3, -80.9, -2.2, -80.4, -0.5, -79.9, 0.9, -78.8, 1.5, -77.8, 2.6, -77.4, 4.1, -77.4, 6.2, -77.9, 7.2],
  // Africa
  [-17.3, 14.7, -16.9, 13.2, -16.7, 12.4, -15.3, 11.1, -14.5, 10.2, -13.2, 9.2, -12.5, 7.9, -11.2, 6.8, -9.3, 5.2, -7.5, 4.4, -5.5, 5.1, -3, 5.1, -1.5, 5, 1, 5.9, 2.8, 6.4, 4.5, 6.3, 5.6, 5.1, 6.2, 4.3, 7.6, 4.5, 8.9, 4.3, 9.6, 3.3, 9.8, 1.8, 9.4, 0.5, 9.3, -0.9, 10.8, -2.6, 11.9, -4.4, 12.3, -6.1, 13.3, -8.6, 13.2, -10.5, 13.8, -12, 12.5, -13.5, 11.8, -16.8, 12.5, -18.6, 14, -21.5, 14.5, -23, 14.9, -26.3, 15.6, -27.9, 16.5, -28.6, 17.3, -30.5, 18.2, -31.9, 18.3, -34.1, 19.5, -34.7, 20.1, -34.8, 22.3, -34, 25.6, -34, 27, -33.6, 28.5, -32.4, 30.1, -31.1, 31.3, -29.3, 32.4, -28.6, 32.9, -26, 32.6, -25.3, 35.4, -24.1, 35.5, -22.1, 34.7, -19.9, 36.3, -18.8, 39.1, -17.1, 40.6, -15.5, 40.5, -11.3, 39.5, -8.4, 39.3, -6.8, 38.9, -5.1, 39.8, -3.6, 40.9, -2.2, 41.6, -1.6, 43.5, 0.6, 45.4, 2.1, 47.5, 4.4, 49, 6.6, 50.5, 9.5, 51.3, 11.8, 49, 11.3, 45.7, 10.4, 44, 10.4, 43.3, 11.7, 42.4, 13.2, 41, 14.7, 39.5, 15.6, 38.5, 17.8, 37.4, 19.8, 37.2, 21.2, 36.7, 22.5, 35.6, 23.9, 34.9, 25.9, 33.9, 27.4, 32.6, 29.9, 32.3, 31.2, 30.5, 31.5, 29, 30.9, 25.2, 31.6, 23.2, 32.2, 21.5, 32.9, 20.1, 32.2, 19.9, 31, 18.3, 30.6, 15.9, 31.5, 15.2, 32.3, 13.2, 32.9, 11.5, 33.2, 10.3, 33.8, 11, 35.3, 10.2, 37.2, 8.6, 36.9, 5.2, 36.7, 1.5, 36.6, -1.4, 35.3, -2.9, 35.3, -5.3, 35.9, -6.2, 35.5, -6.9, 34, -8.6, 33.2, -9.8, 31.5, -9.7, 30, -11.3, 28.2, -13.2, 27.6, -14.6, 25.5, -16.1, 23.8, -17, 21.2, -16.2, 19.5, -16.4, 18, -16.5, 16.1],
  // Eurasia: Iberia round the Atlantic coast and the Baltic, Scandinavia, the Arctic, the Pacific, south Asia, Arabia and back through the Mediterranean
  [-5.6, 36, -6.4, 36.8, -7.4, 37.2, -8.9, 37, -8.8, 38.5, -9.5, 38.8, -8.9, 40.2, -8.8, 42, -9.3, 43, -8, 43.7, -4, 43.4, -1.6, 43.4, -1.2, 44.7, -1.2, 46.2, -2.2, 47.1, -4.4, 47.9, -4.6, 48.6, -1.5, 48.7, -1.9, 49.7, 0.2, 49.5, 1.6, 50.2, 2.5, 51.1, 4.2, 51.9, 4.8, 53, 6.8, 53.5, 8.5, 53.9, 8.6, 55.5, 8.2, 56.8, 10.5, 57.7, 10.5, 56.2, 10.8, 55, 9.8, 54.5, 11.2, 54.2, 13.5, 54.2, 14.4, 53.9, 18.5, 54.8, 21.2, 55.2, 21, 56.8, 23.5, 57.2, 24.2, 58.3, 23.4, 59.3, 28, 59.5, 30.2, 59.9, 29, 60.3, 22.8, 59.9, 21.4, 60.8, 21.5, 62.5, 25.2, 65, 25.4, 65.6, 23.5, 65.8, 21.5, 64.5, 19, 63.4, 17.5, 62.3, 17.3, 60.6, 18.8, 59.7, 16.5, 57.3, 16, 56.2, 14.2, 55.4, 12.8, 55.8, 12.3, 56.9, 11.2, 58.9, 10.5, 59.6, 8.2, 58.1, 5.6, 58.8, 5, 60.5, 5.2, 62, 8, 63.3, 11, 64.9, 13.5, 67.4, 16, 68.6, 19, 69.8, 23.5, 70.8, 26, 71.1, 28.5, 70.9, 31, 70.3, 33, 69.5, 36.5, 69.1, 41, 67.5, 40.5, 66, 35, 66.3, 34.8, 64.5, 37.5, 64, 40.5, 64.5, 44, 66.2, 44.2, 68.4, 46.5, 68, 53.5, 68.5, 58.5, 68.8, 60.5, 69.8, 66, 69.5, 68.5, 68.2, 68, 70, 66.8, 71.2, 69, 73, 73, 72.7, 72.5, 71, 74.5, 68, 76, 72, 80, 72.8, 86, 74.5, 90, 75.6, 97, 76, 104, 77.7, 112, 76.6, 113, 73.8, 118, 73.5, 126, 73.4, 131, 71, 140, 72.5, 150, 71.5, 160, 69.7, 170, 70, 180, 69, 180, 65, 177, 62.5, 170, 60, 163, 58, 162, 56, 156.7, 51, 156, 57, 160, 61.5, 155, 59.3, 151, 59.2, 143, 59.3, 138, 56, 135.5, 54, 141, 52.5, 140.5, 48.5, 138, 46, 135, 43.5, 131.5, 42.8, 129.8, 41, 129.4, 36, 126.5, 34.4, 126.2, 37.4, 125, 39.5, 121.2, 40.8, 118.5, 39.2, 117.8, 38.5, 119, 37.2, 122.5, 37, 120.3, 36, 119.2, 34.5, 121.9, 31.4, 122, 29.5, 119.8, 26, 117.5, 23.5, 114.3, 22.3, 110.5, 21, 108.5, 21.6, 106.5, 20.2, 105.8, 19, 108.8, 15.4, 109.2, 12, 107, 10.5, 104.8, 8.6, 105, 10.4, 102.6, 12.2, 100.9, 13.5, 99.9, 12, 99.2, 10, 100.3, 8.3, 101.3, 6.9, 102.2, 6.1, 103.3, 3.8, 104.2, 1.5, 103.4, 1.3, 102.2, 2.2, 101.4, 3, 100.3, 5.4, 100.1, 6.5, 98.4, 8, 98.6, 10, 98.5, 12.5, 97.7, 16.3, 96.2, 16.8, 94.5, 16, 94.3, 18.8, 92.5, 20.8, 91.8, 22.4, 90.5, 22, 88.2, 21.6, 87, 21.4, 86, 20, 84.3, 18.3, 82.3, 16.6, 80.3, 15.5, 80.2, 13, 79.8, 10.3, 77.5, 8.1, 76.3, 9.9, 74.8, 12.9, 73.4, 16, 72.8, 19, 72.6, 21.4, 70.3, 20.9, 68.9, 22.4, 67.5, 24, 66.5, 25.4, 61.5, 25.2, 57.3, 25.8, 56.3, 27.2, 54.5, 26.6, 51.5, 27.9, 50.2, 30.1, 48, 30, 48, 29.3, 50.2, 26.2, 51.6, 25.3, 51.7, 24.2, 54.5, 24.2, 56, 26.1, 56.4, 24.6, 58.8, 22.8, 59.8, 22.4, 58.7, 20.5, 57.8, 19, 55.5, 17.8, 52.2, 15.7, 48.8, 14, 45, 12.8, 43.4, 12.7, 42.8, 14.5, 42.6, 16.5, 41, 19.6, 39, 22, 37.2, 25, 35.2, 28, 34.9, 29.5, 34.2, 31.3, 35, 32.8, 35.9, 35.3, 36.1, 36.6, 34.6, 36.8, 32.5, 36.1, 30.5, 36.3, 29, 36.6, 27.3, 37.2, 26.3, 38.5, 26.5, 39.5, 26.2, 40.1, 26, 40.8, 24, 40.8, 22.9, 40.5, 23.8, 39.2, 22.9, 38.2, 23.2, 37.6, 22.5, 36.4, 21.7, 36.8, 21.1, 37.8, 21.3, 39, 20.1, 39.7, 19.4, 40.4, 19.5, 41.8, 18.5, 42.5, 16, 43.5, 15.2, 44.5, 14.2, 45.2, 13.7, 45.7, 12.3, 45.3, 12.4, 44.2, 13.6, 43.5, 14.5, 42.2, 16.2, 41.4, 18.5, 40.1, 17.2, 40.4, 16.5, 39.7, 17.1, 39, 16.1, 38, 15.6, 38.2, 15.9, 39.5, 15, 40.2, 14, 40.8, 12.2, 41.8, 11, 42.5, 10.3, 43.5, 8.8, 44.4, 7.5, 43.8, 6.2, 43.1, 4.8, 43.4, 3.2, 43.2, 3.2, 41.9, 1, 41, 0.2, 40.1, -0.3, 39.5, 0.2, 38.8, -0.8, 37.6, -2.1, 36.7, -4.4, 36.7],
  // Australia, and the big islands
  [113.4, -22.1, 114.2, -26.3, 115, -29.5, 115.7, -33.5, 116.8, -35.1, 118, -35, 121.5, -33.8, 124, -33, 126.2, -32.2, 129, -31.6, 131.5, -31.5, 134.2, -32.8, 135.8, -34.8, 137.5, -33, 137.8, -35.6, 139.6, -37.1, 141, -38.1, 143.5, -38.8, 146.3, -39.1, 147.9, -37.8, 150, -37.5, 150.9, -34.2, 151.7, -32.8, 153.6, -28.5, 153.1, -25.4, 150.8, -22.6, 149.2, -21.1, 146.3, -19, 145.4, -16, 144.4, -14.3, 143.5, -12.5, 142.5, -10.7, 141.6, -12.7, 141.5, -15.5, 140.8, -17.4, 139.3, -17.4, 137.8, -16, 135.9, -15.1, 136.8, -12.2, 134.4, -11.9, 132.6, -11.5, 130.5, -12.4, 129.5, -14.9, 127.6, -14.2, 125.9, -14.6, 124.4, -16.3, 122.2, -17.9, 121.5, -19.5, 118.8, -20.3, 116.8, -20.6, 114.6, -21.9],
  [-73, 78.2, -66, 80.5, -60, 82, -45, 82.8, -30, 83.5, -22, 82.5, -18, 81.5, -12.5, 81.4, -18.5, 79.5, -19, 77, -18.5, 75, -21.5, 72.5, -22.5, 70.3, -26, 68.5, -32, 68.2, -35.5, 66, -40, 65, -42, 62.5, -43.5, 60, -46, 60.8, -48.5, 61.5, -50.5, 63.8, -52.2, 65.5, -53.5, 67, -53.5, 69, -52, 70, -54.5, 71, -55, 72.8, -58.5, 75.7, -62, 76.2, -68, 76.3, -72, 77.5], // Greenland
  [-90, 71.5, -85, 73.5, -78, 73.3, -71, 71, -66.5, 68.5, -62, 66.8, -64, 65, -65.5, 63, -68, 62.5, -72, 64, -75.5, 64.5, -78, 66.5, -80.5, 69.5, -86, 70], // Baffin Island
  [-118, 69, -112, 68.7, -104, 68.8, -101, 70, -104, 71.5, -107.5, 73.2, -114, 73.3, -118.5, 72.3, -119, 70.5], // Victoria Island
  [-96, 74.5, -89, 76.5, -80, 76.3, -78, 78.5, -72, 79.5, -63, 81.5, -70, 82.8, -85, 82.3, -95, 80.5, -98, 78.5, -94, 77, -92, 75.5], // Ellesmere and Devon
  [-125.5, 71.8, -123, 74.3, -117.5, 74.2, -115.5, 73, -120, 71.5], [-99, 73.5, -92, 74, -90, 72, -97, 71.5],
  [-24, 65.5, -22, 66.4, -18, 66.2, -15, 66.3, -13.5, 65.2, -14.5, 64.4, -18.5, 63.4, -22.5, 63.8, -24, 64.8], // Iceland
  [-5.7, 50.1, -3.5, 50.3, 1.4, 51.2, 1.7, 52.7, 0.3, 53.5, -0.2, 54.1, -1.6, 55.6, -2.2, 56.3, -1.8, 57.6, -3.2, 58.6, -5, 58.6, -5.8, 57.6, -6.2, 56.7, -5.6, 55.4, -4.9, 54.8, -3.2, 54.3, -3.1, 53.5, -4.6, 53.3, -4.2, 52.3, -5.3, 51.8, -3.3, 51.4], // Great Britain
  [-6, 52.2, -6.1, 54, -5.9, 55.2, -8.2, 55.2, -10, 54.2, -10.2, 51.8, -9.5, 51.5, -6.4, 52.1], // Ireland
  [-59.3, 47.6, -56, 49.5, -55.5, 51.6, -53.5, 49.3, -52.7, 47.5, -53.9, 46.8, -55.8, 47.1], // Newfoundland
  [-85, 21.9, -82, 23.2, -80, 23.1, -77.5, 21.8, -75.7, 20.7, -74.2, 20.2, -77.7, 19.9, -78.5, 21.5, -81.8, 22.2], // Cuba
  [-74.4, 18.5, -72.8, 19.9, -69.9, 19.7, -68.4, 18.6, -70.1, 18.2, -71.4, 17.6, -74.2, 18.2], // Hispaniola
  [-78.3, 18.4, -76.2, 18.1, -76.9, 17.8, -78.2, 18.2], [-67.2, 18.5, -65.6, 18.4, -65.7, 18, -67.2, 18],
  [12.4, 37.9, 13.3, 38.2, 15.6, 38.3, 15.1, 37.2, 15.1, 36.7, 14.3, 37, 12.5, 37.6], [8.4, 41, 9.8, 41, 9.6, 39.2, 9, 39, 8.4, 39.1, 8.4, 40.5], [9.4, 43, 9.5, 42, 9.2, 41.4, 8.6, 41.7, 8.7, 42.6],
  [23.5, 35.6, 26.3, 35.3, 26, 35, 23.6, 35.2], [32.3, 35, 34.5, 35.6, 34, 34.8, 32.5, 34.7], [32.4, 31.2, 34.2, 31.3, 34.9, 29.5, 34.3, 27.8, 32.6, 29.9],
  [49.3, -12, 50.4, -15.4, 49.7, -17.5, 48.5, -20.5, 47.1, -24.9, 45.2, -25.5, 44, -24.5, 43.3, -22, 44.4, -19.5, 44.1, -17, 46.2, -15.8, 47.8, -13.9], // Madagascar
  [79.8, 9.8, 81.8, 7.5, 81.2, 6.1, 80, 6],
  [130.9, 34.3, 132.5, 35.5, 135.9, 35.8, 136.9, 37.1, 139.5, 38.3, 140, 40.5, 141.4, 41.4, 142, 39.5, 140.9, 36.9, 140.9, 35.7, 139, 34.8, 137.2, 34.6, 135.2, 33.7, 132.5, 33.6, 131, 31.4, 129.7, 33.2], [140.2, 41.5, 141.5, 45.4, 145.4, 43.4, 143.3, 42],
  [120.1, 23, 121.5, 25.2, 121.9, 24.5, 120.8, 21.9], [108.7, 19.2, 110.5, 20.1, 111, 19.6, 109.6, 18.2], [142, 54.2, 143.2, 51.5, 143.5, 49, 142.5, 46, 141.8, 48.5, 142.2, 52],
  [120, 16, 120.6, 18.5, 122.2, 18.5, 122, 16.8, 121.6, 15.8, 122, 14, 124, 13, 121.5, 13.8, 120.6, 14.2], [122, 7, 123.5, 8.7, 125.5, 9.8, 126.6, 7.3, 125.4, 5.6, 123.7, 7.6],
  [109.6, 1.6, 111, 1.4, 114, 4.6, 116.8, 7, 119.2, 5.3, 118, 1, 117.5, -0.5, 116.4, -3.8, 114.5, -3.5, 111.7, -2.9, 110.2, -1.7, 109, 0], // Borneo
  [95.3, 5.6, 97.5, 5.2, 100.4, 2.2, 104, -1, 106, -3.2, 105.8, -5.8, 104.5, -5.9, 102.3, -4, 100.3, -1, 98.7, 1.7], // Sumatra
  [105.2, -6.8, 108.3, -6.3, 111, -6.4, 114.4, -7.8, 111, -8.2, 106.4, -7.4], [119.4, -5.5, 120.4, -5.5, 120.4, -2.8, 121.3, -1.9, 123.3, -0.9, 125, 1.5, 124, 0.4, 120.9, 1.3, 119.8, 0, 119.4, -2.5],
  [131, -1.3, 134.2, -1, 137.8, -1.5, 141, -2.6, 144.5, -3.8, 147.5, -6, 150.8, -10.3, 147, -10, 144, -7.8, 141, -9, 138, -8.3, 137.6, -5.5, 134.5, -4.2, 132, -2.9], // New Guinea
  [144.6, -40.7, 148.3, -40.9, 148, -43.2, 146.8, -43.6, 145.2, -42.2], [172.7, -34.4, 174.8, -36.9, 178.5, -37.7, 177.9, -39.2, 176.2, -40.6, 174.8, -41.3, 175.2, -39.9, 173.8, -39.3, 174.6, -37.2],
  [172.7, -40.5, 174.3, -41.6, 173.3, -43, 171.2, -44.5, 169.3, -46.6, 166.5, -46, 166.8, -45.2, 168.4, -44, 170.8, -42.8, 172.1, -41.2],
  [11, 78.5, 16, 80, 22, 80.5, 27, 79.5, 22, 77.5, 17, 76.6, 13, 77.5], [52, 71, 56, 73.5, 60, 76, 68, 76.8, 64, 75, 58, 72.8, 56, 71, 53, 70.7], // Svalbard, Novaya Zemlya
  [-180, 69, -176, 69.8, -171, 67.5, -169.7, 66, -173, 64.5, -178, 65, -180, 64.8], // Chukotka, across the date line
];
const SEAS = [
  [47, 44.5, 49, 46.5, 53, 47, 53.5, 45, 51, 44.2, 52.8, 41.5, 54, 38, 53.9, 37, 50.5, 37, 49, 38.2, 49.5, 40.5, 47.5, 43], // Caspian
  [28, 41.5, 28.5, 43.5, 30, 45.5, 31.5, 46.6, 33.5, 46, 33, 44.6, 35, 45, 36.5, 45.3, 38, 47, 39, 46.5, 37.5, 45.2, 39.5, 44.5, 41.6, 41.6, 38, 41, 35, 42, 31.5, 41.2], // Black Sea
];
// [colour, lon, lat, rx, ry, rot]: soft patches of forest, grassland, desert and mountain laid over the green.
const BIOMES = [
  ['#3b6a39', -100, 56, 38, 8, 0], ['#3b6a39', 90, 60, 60, 9, 0], ['#3e6d3b', 25, 62, 18, 6, 0], ['#878a6c', -110, 67, 35, 4, 0], ['#878a6c', 100, 71, 60, 4, 0],
  ['#4f8a3d', -82, 38, 10, 7, 0], ['#58913f', 10, 49, 14, 5, 0], ['#4d8a3e', 115, 33, 10, 7, 0],
  ['#a9a55b', 5, 12, 30, 3.5, 0], ['#a2a45a', 32, -8, 8, 12, 0], ['#a6a25a', 25, -17, 10, 5, 0], ['#9fa75c', -48, -14, 9, 7, 0], ['#a8a35c', 78, 20, 7, 7, 0], ['#a79d5a', 134, -16, 10, 3.5, 0], ['#9aa45b', -100, 45, 8, 6, 0],
  ['#dfbd7c', 8, 23, 26, 8, 0], ['#dcb676', 45, 22, 10, 8, -.3], ['#d2ab6d', 20, -24, 8, 6, 0], ['#d0a86c', -111, 32, 7, 6, 0], ['#cfa86f', 62, 30, 9, 6, 0],
  ['#cbb383', 100, 42, 18, 6, 0], ['#cb8f54', 128, -25, 14, 8, 0], ['#c4aa7b', -68, -45, 4, 7, 0], ['#c9ad7a', -70, -22, 2.5, 8, 0], ['#c9af82', 58, 42, 12, 5, 0],
  ['#2c692b', -62, -4, 13, 7, 0], ['#2f6b2d', 20, 0, 8, 5, 0], ['#2f6b2d', 110, 0, 12, 6, 0], ['#356f30', -85, 12, 5, 4, -.5], ['#346d2f', -3, 6, 8, 2, 0],
  ['#8b8374', 88, 33, 14, 4, 0], ['#7d7058', -110, 42, 5, 9, -.2], ['#7c6f58', -70, -25, 2, 18, 0],
];

export default {
  // Pluto: beige and peach, with its famous pale heart facing us (the smooth icy left lobe crazed with faint cells),
  // the dark whale of Cthulhu along the equator beside it, a faint blue haze round the edge, and grey Charon with its
  // rusty red cap floating alongside.
  pluto(k) {
    const T = k.THREE, g = k.group(), N = makeNoise(1930), view = {}, L = lighting(k, view, [-.76, .44, .48]);
    const C = { tan: rgb('#bb8e68'), light: rgb('#e6cdb0'), peach: rgb('#dca37a'), pole: rgb('#cbbb9c'), dark: rgb('#3e2217'), dark2: rgb('#673424'),
      ice: rgb('#fdfaf4'), cream: rgb('#efdfc6'), mottle: rgb('#d9c2a2'), cell: rgb('#e2d6c6'), edge: rgb('#ecdcc6') };
    // the heart as seen from the front (x right, y up, in globe radii), right of the middle with its tip to the lower
    // left: [signed distance, across it (the left lobe < 0)]
    const heartAt = (x, y) => {
      const s = .74, a = -.26, px = x - .2, py = y - .04;
      let hx = (px * Math.cos(a) + py * Math.sin(a)) / s, hy = (-px * Math.sin(a) + py * Math.cos(a)) / s + .55;
      if (hx < 0) hx *= .84;                                  // the left lobe (Sputnik Planitia) a little bigger
      return [sdHeart(hx, hy) * s, hx];
    };
    // Cthulhu: a long dark whale along the equator west of the heart; and a string of dark spots to the east
    const BELT = [[-12, -17, 9, 8, .4], [-28, -13, 13, 12, .2], [-50, -9, 15, 14, .05], [-74, -8, 15, 13, 0], [-98, -7, 13, 11, -.1], [-120, -5, 10, 8, -.1], [-140, -4, 8, 6, 0],
      [50, -10, 6, 5, 0], [66, -7, 7, 6, .2], [82, -10, 6, 5, 0], [98, -6, 7, 5, 0], [116, -9, 6, 5, 0], [134, -5, 8, 5, 0], [156, -6, 7, 4, 0]];
    const map = mapTex(k, 1024, 512, (c, P) => {
      const belt = P.mask(Q => { for (const e of BELT) Q.ellipse(...e); }, 12);
      P.pixels((q, x, y, z, lon, lat, i) => {
        const n = N.fbm(x * 2.2, y * 2.2, z * 2.2, 4), n2 = N.fbm(x * 7 + 3, y * 7, z * 7, 3), n3 = N.fbm(x * 18, y * 18, z * 18, 2);
        let col = mixC(C.tan, C.light, smooth(-.35, .4, n + .3 * n3));
        col = mixC(col, C.peach, smooth(0, .5, n2) * .5);
        col = mixC(col, C.pole, smooth(40, 75, lat + 8 * n) * .75);
        const dm = smooth(.3, .6, belt[i] + .3 * n2 + .22 * n3);
        col = mixC(col, mixC(C.dark, C.dark2, smooth(-.5, .5, n2 + n3)), dm);
        if (z > 0) {
          const [d0, hx] = heartAt(x, y), right = smooth(-.05, .25, hx), d = d0 + .015 * n2 + .01 * n3 + right * (.05 * n + .02 * n3);
          if (d < .14) {
            const inside = smooth(.008 + .03 * right, -.008 - .03 * right, d), left = 1 - right;
            let hc = mixC(mixC(C.cream, C.mottle, smooth(.05, .5, n2 + .4 * n3) * .7), C.ice, left);
            hc = mixC(hc, C.cell, (1 - smooth(.01, .05, cells(x / .05, y / .05, 7))) * left * smooth(.02, -.03, d) * .6);
            col = mixC(col, C.edge, smooth(.13, 0, d) * (1 - inside) * .4);        // frost spilling over its edge
            col = mixC(col, hc, inside);
          }
        }
        q[0] = col[0]; q[1] = col[1]; q[2] = col[2];
      });
    }, { cache: 'worlds:pluto:map' });
    const bump = mapTex(k, 1024, 512, (c, P) => P.pixels((q, x, y, z) => {
      let h = .5 + .14 * N.fbm(x * 9 + 5, y * 9, z * 9, 4);
      if (z > 0) {
        const [d, hx] = heartAt(x, y), inside = smooth(.02, -.02, d), left = smooth(.2, -.05, hx);
        h = lerp(h, .5 - .08 * (1 - smooth(.01, .05, cells(x / .05, y / .05, 7))), inside * left);
        h += .3 * smooth(.07, 0, Math.abs(d + .01)) * left * smooth(-.2, .4, N.n3(x * 20, y * 20, z * 20));  // mountains round the icy plain
      }
      q[0] = q[1] = q[2] = h;
    }), { cache: 'worlds:pluto:bump', data: true });
    const body = k.group(); g.add(body);
    k.add(body, globe(k, 1, 128), planetMat(k, { map, bumpMap: bump, bumpScale: 1.6, roughness: .95 }, { amb: .25, rim: '#4c7fe0', rimPow: 3, light: L }), { shadow: false });
    orient(k, body, { roll: -8, pitch: -4 });
    g.add(halo(k, 1, '#8ab8ff', { opacity: .35, spread: 1.12, kv: L.sunV }));
    // Charon: grey and battered, with Mordor, its rusty north cap, and a belt of canyons
    const N2 = makeNoise(1978);
    const cmap = mapTex(k, 512, 256, (c, P) => P.pixels((q, x, y, z, lon, lat) => {
      const n = N2.fbm(x * 3, y * 3, z * 3, 4), n2 = N2.fbm(x * 10, y * 10, z * 10, 3);
      let col = mixC(rgb('#8a8580'), rgb('#b3aea8'), smooth(-.4, .45, n));
      col = mixC(col, rgb('#6f6a66'), smooth(.15, .55, n2) * .5);
      col = mixC(col, rgb('#6a3526'), smooth(48, 70, lat + 9 * n) * .85);
      col = mixC(col, rgb('#65605c'), smooth(5, 0, Math.abs(lat - 8 + 4 * n2)) * .45);
      q[0] = col[0]; q[1] = col[1]; q[2] = col[2];
    }), { cache: 'worlds:charon' });
    const ch = k.group([], { p: [1.5, .78, -.95] }); g.add(ch);
    k.add(ch, globe(k, .34, 64), planetMat(k, { map: cmap, roughness: 1 }, { amb: .25, light: L }), { shadow: false });
    orient(k, ch, { roll: 14, pitch: 32 });
    Object.assign(g.userData, { floating: true, noHero: true, view });
    return g;
  },

  // Phobos: Mars's little potato of a moon, lumpy and grey-brown, scored by rows of parallel grooves, with the huge
  // bowl of Stickney crater (and little Limtoc inside it) on its face, tumbling as it goes.
  phobos(k) {
    const T = k.THREE, g = k.group(), N = makeNoise(4242), R = rng(77), view = {}, L = lighting(k, view, [-.7, .5, .5]), cam = camBasis(k, view);
    const V3 = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const body = k.group(); g.add(body);
    body.rotation.set(.22, .5, .4);
    body.updateMatrixWorld(true);
    const inv = body.quaternion.clone().invert();
    // a direction given in the view (x right, y up, z toward the viewer), in the body's own frame
    const inBody = (x, y, z) => { const v = cam.right.clone().multiplyScalar(x).addScaledVector(cam.up, y).addScaledVector(cam.back, z).applyQuaternion(inv).normalize(); return [v.x, v.y, v.z]; };
    const onFace = (x, y) => inBody(x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y)));
    const AX = [1.48, 1.02, 1.14];
    const stick = { d: onFace(-.34, .1), r: .42, depth: .26, rim: .16 };
    const craters = [stick, { d: onFace(-.4, .04), r: .07, depth: .035, rim: .3 }];   // Stickney, and little Limtoc on its floor
    for (let i = 0; i < 34; i++) {
      const zz = R() * 2 - 1, a = R() * TAU, s = Math.sqrt(1 - zz * zz), d = [s * Math.cos(a), zz, s * Math.sin(a)];
      const r = .045 + Math.pow(R(), 2.3) * .17;
      if (Math.acos(clamp(dot(d, stick.d), -1, 1)) < stick.r + r * .6) continue;
      craters.push({ d, r, depth: r * (.5 + R() * .3), rim: .24 });
    }
    // two families of long parallel grooves (chains of pits), running across the body away from Stickney
    const grooves = [{ n: inBody(.12, 1, .25), sp: .09, w: .009, depth: .014, s: 3 }, { n: inBody(-.42, 1, -.05), sp: .13, w: .008, depth: .01, s: 11 }];
    const e1 = V3(...[stick.d[1], -stick.d[0], 0].map((v, i) => v + (i === 2 ? .001 : 0))), e2 = [stick.d[1] * e1[2] - stick.d[2] * e1[1], stick.d[2] * e1[0] - stick.d[0] * e1[2], stick.d[0] * e1[1] - stick.d[1] * e1[0]];
    const geo = new T.SphereGeometry(1, 220, 150), pos = geo.attributes.position, cols = [], cc = new T.Color();
    const C = { lo: rgb('#5a5550'), hi: rgb('#8e867e'), rust: rgb('#836452'), wall: rgb('#a5a29e'), blue: rgb('#8e96a2'), rim: rgb('#a39a91'), groove: rgb('#4d4641') };
    for (let i = 0; i < pos.count; i++) {
      const u = V3(pos.getX(i), pos.getY(i), pos.getZ(i));
      let h = .085 * N.fbm(u[0] * 1.2, u[1] * 1.2, u[2] * 1.2, 3) + .025 * N.fbm(u[0] * 4 + 3, u[1] * 4, u[2] * 4, 3), fresh = 0, wall = 0;
      const ts = Math.acos(clamp(dot(u, stick.d), -1, 1)) / stick.r;
      for (const c of craters) {
        const t = c === stick ? ts : Math.acos(clamp(dot(u, c.d), -1, 1)) / c.r;
        if (t > 2.2) continue;
        h += craterH(t, c.rim) * c.depth;
        if (c !== stick) fresh = Math.max(fresh, smooth(1.4, 1, t) * smooth(.65, .95, t));
      }
      wall = smooth(.35, .75, ts) * smooth(1.08, .9, ts);
      const away = smooth(1.05, 1.5, ts);
      let gv = 0;
      for (const gr of grooves) {
        const along = dot(u, gr.n), f = (along / gr.sp - Math.round(along / gr.sp)) * gr.sp;
        const pits = .5 + .5 * smooth(-.35, .3, N.n3(u[0] * 13 + gr.s, u[1] * 13, u[2] * 13));
        const g1 = Math.exp(-((f / gr.w) ** 2)) * away * smooth(.8, .62, Math.abs(along)) * smooth(-.2, .25, N.n3(u[0] * 2 + gr.s, u[1] * 2, u[2] * 2)) * pits;
        h -= gr.depth * g1; gv = Math.max(gv, g1);
      }
      const r = 1 + h;
      pos.setXYZ(i, u[0] * AX[0] * r, u[1] * AX[1] * r, u[2] * AX[2] * r);
      const n1 = N.fbm(u[0] * 3 + 7, u[1] * 3, u[2] * 3, 4), n2 = N.fbm(u[0] * 12, u[1] * 12, u[2] * 12, 2);
      let col = mixC(C.lo, C.hi, smooth(-.45, .45, n1 + .5 * n2 + 2 * h));
      col = mixC(col, C.rust, smooth(.05, .45, N.n3(u[0] * 1.4 + 20, u[1] * 1.4, u[2] * 1.4)) * .35);
      // streaks of pale, bluish material running down Stickney's walls
      const az = Math.atan2(dot(u, e2), dot(u, e1)), streak = smooth(.05, .5, N.fbm(Math.cos(az) * 5 + 40, Math.sin(az) * 5, ts * 2.5, 3));
      col = mixC(col, mixC(C.wall, C.blue, streak), wall * (.2 + .35 * streak));
      col = mixC(col, C.rim, fresh * .15);
      col = mixC(col, C.groove, gv * .5);
      cc.setRGB(col[0], col[1], col[2], T.SRGBColorSpace); cols.push(cc.r, cc.g, cc.b);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals(); weld(geo);
    // fine grit and tiny craters, painted as bumps
    const bump = mapTex(k, 1024, 512, (c, P) => {
      P.pixels((q, x, y, z) => { q[0] = q[1] = q[2] = .5 + .12 * N.fbm(x * 30, y * 30, z * 30, 3); });
      const Rb = rng(99);
      for (let i = 0; i < 260; i++) {
        const lon = Rb() * 360 - 180, lat = Math.asin(Rb() * 2 - 1) / DEG, r = .8 + Rb() * Rb() * 4;
        P.at(lon, lat, r * 1.5, gg => {
          let gr = gg.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); gg.fillStyle = gr; gg.beginPath(); gg.arc(0, 0, r, 0, TAU); gg.fill();
          gr = gg.createRadialGradient(0, 0, r * .7, 0, 0, r * 1.4); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); gg.fillStyle = gr; gg.beginPath(); gg.arc(0, 0, r * 1.4, 0, TAU); gg.fill();
        });
      }
    }, { cache: 'worlds:phobos:bump', data: true });
    k.add(body, geo, planetMat(k, { vertexColors: true, bumpMap: bump, bumpScale: 1.4, roughness: .92 }, { amb: .35, fill: .2, light: L }), { shadow: false });
    Object.assign(g.userData, { floating: true, noHero: true, view });
    return g;
  },

  // Neptune: deep azure with soft bands and wisps of white cloud, the Great Dark Spot with its bright companion
  // clouds, a glow of blue air round the edge, and faint thin rings (the outer one clumped into bright arcs).
  neptune(k) {
    const T = k.THREE, g = k.group(), N = makeNoise(846), view = {}, L = lighting(k, view, [-.76, .44, .48]);
    const band = ramp([[-90, '#24449a'], [-76, '#2c52b2'], [-66, '#5a8fe6'], [-58, '#3563cc'], [-48, '#2a56c0'], [-38, '#3f76de'], [-27, '#5d96f0'], [-17, '#3b72df'],
      [0, '#3367d6'], [14, '#3b70dd'], [26, '#528bec'], [37, '#3464cf'], [50, '#4a80e6'], [62, '#3a69d2'], [75, '#2e55b6'], [90, '#26479c']]);
    const GDS = spot(-6, -7), SCOOT = spot(-40, -24), D2 = spot(30, -36);
    const map = mapTex(k, 1024, 512, (c, P) => P.pixels((q, x, y, z, lon, lat) => {
      const w = N.fbm(x * 2, y * 7, z * 2, 3);
      let col = band(lat + 4 * w);
      const s = N.fbm(x * 3 + 7, y * 16, z * 3, 3);
      col = mixC(col, [.8, .92, 1], smooth(.3, .6, s) * .45 * smooth(62, 16, Math.abs(lat)) * smooth(-.2, .3, N.n3(x * 2 + 30, y * 3, z * 2)));   // wisps of white cloud
      // the Great Dark Spot, with bright clouds hugging its south side and a streak off its east end
      const [u, v] = local(GDS, x, y, z), e = Math.hypot(u / 15, v / 7.5), sw = N.fbm(u * .25 + 3, v * .5, 2, 3);
      col = mixC(col, mixC(rgb('#132766'), rgb('#20409c'), smooth(.2, 1, e + .3 * sw)), smooth(1.05, .75, e + .15 * sw) * .95);
      const comp = Math.hypot((u + 1) / 15, (v + 7.6) / 2.6), streak = Math.hypot((u - 15) / 10, (v - 3.5) / 1.8);
      col = mixC(col, rgb('#f2f8ff'), smooth(1, .35, comp + .35 * sw) * .95);
      col = mixC(col, rgb('#e6f1ff'), smooth(1, .3, streak + .3 * sw) * .8);
      // Scooter, a small bright cloud, and the small dark spot D2 with its bright core
      const [su, sv] = local(SCOOT, x, y, z), [du, dv] = local(D2, x, y, z);
      col = mixC(col, rgb('#eef6ff'), smooth(1, .4, Math.hypot(su / 4.5, sv / 2.2)) * .9);
      const de = Math.hypot(du / 5, dv / 3.2);
      col = mixC(col, rgb('#1a3380'), smooth(1, .6, de) * .85);
      col = mixC(col, rgb('#dbeaff'), smooth(.45, .1, de) * .8);
      q[0] = col[0]; q[1] = col[1]; q[2] = col[2];
    }), { cache: 'worlds:neptune:map' });
    const body = k.group(); g.add(body);
    k.add(body, globe(k, 1, 128), planetMat(k, { map, roughness: .85 }, { amb: .28, rim: '#5fa6ff', rimPow: 2.6, light: L }), { shadow: false });
    // faint rings: a dusty sheet, Le Verrier, and Adams with its three bright arcs
    const rIn = 1.3, rOut = 1.86, profile = r => .12 * smooth(1.3, 1.36, r) * smooth(1.52, 1.46, r) + .8 * Math.exp(-(((r - 1.56) / .007) ** 2)) + .08 * smooth(1.58, 1.62, r) * smooth(1.76, 1.7, r) + .9 * Math.exp(-(((r - 1.8) / .007) ** 2));
    const ringA = k.tex(1024, 256, (c, w, h) => {
      const img = c.createImageData(w, h), d = img.data;
      for (let j = 0; j < h; j++) {
        const ang = j / h * 360, arcs = Math.max(smooth(8, 3, Math.abs(ang - 40)), smooth(6, 2, Math.abs(ang - 58)), smooth(9, 4, Math.abs(ang - 78)));
        for (let i = 0; i < w; i++) {
          const r = lerp(rIn, rOut, (i + .5) / w); let a = profile(r);
          a += .9 * arcs * Math.exp(-(((r - 1.8) / .009) ** 2));
          const n = (j * w + i) * 4; d[n] = d[n + 1] = d[n + 2] = clamp(a) * 255; d[n + 3] = 255;
        }
      }
      c.putImageData(img, 0, 0);
    }, { cache: 'worlds:neptune:rings', data: true });
    const ring = k.mesh(ringGeo(k, rIn, rOut, 256, 6), new T.MeshBasicMaterial({ color: k.color('#d6dcef'), alphaMap: ringA, transparent: true, depthWrite: false, side: T.DoubleSide }), { shadow: false });
    ring.renderOrder = 2; body.add(ring);
    orient(k, body, { face: 0, roll: -20, pitch: 12 });
    g.add(halo(k, 1, '#62a4ff', { opacity: .5, spread: 1.14, kv: L.sunV }));
    Object.assign(g.userData, { floating: true, noHero: true, view });
    return g;
  },

  // The Moon: the face we always see, the dark seas making the man in the Moon, bright rayed Tycho and Copernicus,
  // crater rims catching the light along a soft terminator, and a moonlit glow round it.
  moon(k) {
    const g = k.group(), view = {}, L = lighting(k, view, [-.9, .3, .32]), { map, bump } = moonMaps(k);
    const body = k.group(); g.add(body);
    k.add(body, globe(k, 1, 160), planetMat(k, { map, bumpMap: bump, bumpScale: 2, roughness: 1 }, { amb: .14, light: L }), { shadow: false });
    orient(k, body, { roll: 5, pitch: -14 });
    g.add(halo(k, 1, '#e4ecff', { opacity: .22, spread: 1.14, kv: L.sunV, side: .75 }));
    Object.assign(g.userData, { floating: true, noHero: true, view });
    return g;
  },

  // Mars: rusty red-orange, with the dark markings of the south, Valles Marineris slashed across its face, the Tharsis
  // volcanoes on the limb, a swirled white polar cap on top, a thin dusty glow, and Phobos and Deimos alongside.
  mars(k) {
    const T = k.THREE, g = k.group(), N = makeNoise(4004), R = rng(4005), view = {}, L = lighting(k, view, [-.76, .44, .48]);
    // [lon, lat, rx, ry, rot, strength]: the dark markings (Acidalium, the Sinus bays, Erythraeum, Syrtis, the Eye of
    // Mars...) and the bright deserts (Tharsis, Arabia, Amazonis, the frosty basins of Hellas and Argyre)
    const DARK = [[-30, 49, 18, 8, .2, .5], [-12, 57, 14, 5, 0, .45], [-46, 42, 10, 5, -.3, .45], [-27, 33, 5, 4, 0, .5], [-20, 22, 3.5, 6, .3, .4],
      [-23, -7, 6, 8, .2, .9], [-45, -15, 9, 5, .1, .9], [-33, -10, 5, 4, .3, .7], [-38, -27, 18, 9, .1, .8], [-17, -23, 10, 7, 0, .7], [-60, -30, 10, 5, 0, .6], [-30, -40, 15, 5, 0, .55],
      [0, -3, 7, 3.5, 0, .9], [17, -8, 14, 4, -.05, .85], [37, -10, 12, 4, -.1, .8], [68, 10, 7, 12, -.2, .9], [100, -18, 18, 7, 0, .7], [145, -25, 18, 7, 0, .7],
      [-155, -32, 16, 7, 0, .7], [-122, -40, 14, 6, 0, .55], [-87, -26, 6, 3.6, 0, 1], [-72, -23, 8, 2, .15, .6], [-98, -22, 7, 2.2, -.3, .5], [110, 48, 18, 8, 0, .6]];
    const BRIGHT = [[-115, 5, 30, 25, 0, .7], [-150, 10, 20, 15, 0, .6], [15, 20, 30, 15, 0, .6], [-45, 20, 12, 10, 0, .5], [70, -42, 14, 10, 0, .9], [-43, -50, 8, 6, 0, .9], [150, 25, 18, 12, 0, .5], [-82, -37, 11, 8, 0, .45]];
    // Valles Marineris: [lon, lat, half-width] down the canyon, widest where its troughs run side by side
    const VM = [[-107, -6, .7], [-101, -6.3, 1.1], [-95, -6.7, 1.6], [-89, -7.2, 2.3], [-83, -7.4, 3.2], [-77, -7.8, 4.2], [-72, -8.6, 4.5], [-67, -9.8, 3.8], [-62, -11.4, 2.8], [-56, -12.4, 2.2], [-50, -12.8, 2], [-45, -12.2, 2.4], [-41, -10.8, 2], [-37, -9, 1.4]];
    const vmAt = t => { const f = t * (VM.length - 1), i = Math.min(VM.length - 2, Math.floor(f)), u = f - i; return VM[i].map((v, j) => lerp(v, VM[i + 1][j], u)); };
    const SCAP = spot(-40, -86.5);
    const VOLC = [[-134, 18.4, 5.4], [-104.5, 11.8, 2.9], [-112.9, 1.5, 3.1], [-120.1, -8.3, 3.2]];   // Olympus, Ascraeus, Pavonis, Arsia
    const craters = [];
    for (let i = 0; i < 140; i++) { const lon = R() * 360 - 180, lat = Math.asin(R() * 2 - 1) / DEG; if (lat > 10 && R() < .85) continue; craters.push([lon, lat, .8 + Math.pow(R(), 3) * 5]); }
    craters.push([70, -42, 14, 1], [-43, -50, 7, 1], [17, -3, 3.8], [55, -14, 3.8]);   // Hellas, Argyre, Schiaparelli, Huygens
    const noctis = []; { const Rn = rng(12); for (let i = 0; i < 16; i++) { const lo = -110 + Rn() * 10, la = -10 + Rn() * 8, a = Rn() * TAU, l = 1.5 + Rn() * 2.5; noctis.push([lo, la, a, l]); } }
    const canyon = Q => {
      for (let t = 0; t <= 1; t += .002) { const [lo, la, w] = vmAt(t), j = Math.sin(t * 57) * .25 + Math.sin(t * 23) * .2; Q.ellipse(lo, la + j * w * .3, w, w * (.5 + .12 * j)); }
      for (const [lo, la, a, l] of noctis) for (let s = 0; s <= l; s += .3) Q.ellipse(lo + Math.cos(a) * s, la + Math.sin(a) * s, .35, .35);
    };
    const map = mapTex(k, 1536, 768, (c, P) => {
      const dark = P.mask(Q => { for (const [lon, lat, rx, ry, rot, a] of DARK) { Q.c.globalAlpha = a; Q.ellipse(lon, lat, rx, ry, rot); } }, 10);
      const bright = P.mask(Q => { for (const [lon, lat, rx, ry, rot, a] of BRIGHT) { Q.c.globalAlpha = a; Q.ellipse(lon, lat, rx, ry, rot); } }, 20);
      const vm = P.mask(canyon, 3), floor = P.mask(Q => { for (let t = .15; t <= .85; t += .003) { const [lo, la, w] = vmAt(t); Q.ellipse(lo, la + w * .1, w * .35, w * .16); } }, 2);
      P.pixels((q, x, y, z, lon, lat, i) => {
        const n = N.fbm(x * 5, y * 5, z * 5, 4), f = N.fbm(x * 24, y * 24, z * 24, 3), e = N.fbm(x * 12 + 3, y * 12, z * 12, 3);
        let col = mixC(rgb('#b35833'), rgb('#d18152'), smooth(-.45, .5, n + .4 * f));
        col = mixC(col, rgb('#e2a06c'), smooth(.1, .8, bright[i] + .2 * e) * .6);
        col = mixC(col, rgb('#9a4c32'), smooth(-5, -45, lat) * .25);                                   // the older, darker south
        col = mixC(col, mixC(rgb('#56301f'), rgb('#7c4630'), smooth(-.4, .5, e + f)), smooth(.18, .62, dark[i] + .28 * e + .1 * f) * .85);
        // the canyon: dark walls with a paler, streaky floor
        const v = smooth(.3, .62, vm[i] + .18 * f + .08 * e);
        col = mixC(col, mixC(rgb('#4c2419'), rgb('#6e3524'), smooth(-.3, .5, f)), v * .95);
        col = mixC(col, rgb('#a45f40'), smooth(.3, .7, floor[i] + .2 * f) * v * .8);
        // the north polar cap, swirled with dark troughs, a notch cut into it (Chasma Boreale), and a frosty fringe
        const r = 90 - lat;
        if (r < 26) {
          const th = lon * DEG, edge = 14.5 + 2.2 * N.n3(Math.cos(th) * 1.8, Math.sin(th) * 1.8, 3.3) + .9 * f;
          const cap = smooth(edge + .7, edge - .7, r), notch = smooth(1.1, .4, Math.abs(((lon + 45 + (r - 4) * 4 + 540) % 360) - 180) * Math.sin(r * DEG)) * smooth(2.5, 5, r) * smooth(edge, edge - 3, r);
          const trough = smooth(.8, .96, Math.sin(3 * th + r * .5 + 1.4 * n)) * smooth(1.5, 3.5, r);
          col = mixC(col, rgb('#ecc1a4'), smooth(edge + 6, edge + .5, r) * .55 * smooth(-.3, .3, e));    // frosty fringe
          col = mixC(col, rgb('#f8f6f2'), cap * (1 - .85 * notch));
          col = mixC(col, rgb('#caa899'), cap * trough * .6);
        }
        // the small south cap, a little off the pole
        if (lat < -78) { const [su, sv] = local(SCAP, x, y, z); col = mixC(col, rgb('#f4f1ec'), smooth(4.5, 3, Math.hypot(su, sv) + 1.2 * f)); }
        q[0] = col[0]; q[1] = col[1]; q[2] = col[2];
      });
      // the volcanoes: great shields with a dark caldera on top (Olympus ringed by its cliff), trailing a wisp of cloud
      for (const [lon, lat, r] of VOLC) {
        P.soft(lon, lat, r * 1.4, '206,124,82', .55);
        P.soft(lon, lat, r * .3, '92,50,36', .85, .5);
        P.at(lon, lat, r * 1.3, gg => { gg.strokeStyle = 'rgba(96,48,32,.4)'; gg.lineWidth = r * .14; gg.beginPath(); gg.arc(0, 0, r, 0, TAU); gg.stroke(); });
        P.at(lon - r * 1.3, lat + r * .25, r * 2.2, gg => { gg.fillStyle = 'rgba(255,252,248,.35)'; gg.beginPath(); gg.ellipse(0, 0, r * 1.5, r * .32, -.2, 0, TAU); gg.fill(); });
      }
      for (const [lon, lat, r, basin] of craters) if (!basin) P.at(lon, lat, r * 1.2, gg => { gg.strokeStyle = 'rgba(232,170,128,.1)'; gg.lineWidth = r * .18; gg.beginPath(); gg.arc(0, 0, r * .9, 0, TAU); gg.stroke(); });
    }, { cache: 'worlds:mars:map' });
    const bump = mapTex(k, 1024, 512, (c, P) => {
      const vm = P.mask(canyon, 3);
      P.pixels((q, x, y, z, lon, lat, i) => { q[0] = q[1] = q[2] = .56 + .08 * N.fbm(x * 12 + 3, y * 12, z * 12, 4) * (lat < 15 ? 1 : .5) - .45 * smooth(.25, .7, vm[i]); });
      for (const [lon, lat, r, basin] of craters) P.at(lon, lat, r * 1.5, gg => {
        let gr = gg.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, `rgba(0,0,0,${basin ? .25 : .3})`); gr.addColorStop(.7, `rgba(0,0,0,${basin ? .2 : .22})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); gg.fillStyle = gr; gg.beginPath(); gg.arc(0, 0, r, 0, TAU); gg.fill();
        gr = gg.createRadialGradient(0, 0, r * .72, 0, 0, r * 1.45); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.33, 'rgba(255,255,255,.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); gg.fillStyle = gr; gg.beginPath(); gg.arc(0, 0, r * 1.45, 0, TAU); gg.fill();
      });
      for (const [lon, lat, r] of VOLC) { P.soft(lon, lat, r * 1.35, '255,255,255', .9, .15); P.soft(lon, lat, r * .28, '0,0,0', .9, .4); }
    }, { cache: 'worlds:mars:bump', data: true });
    const body = k.group(); g.add(body);
    k.add(body, globe(k, 1, 144), planetMat(k, { map, bumpMap: bump, bumpScale: 2, roughness: .95 }, { amb: .25, rim: '#ffa27c', rimPow: 3.2, light: L }), { shadow: false });
    orient(k, body, { face: -64, roll: 24, pitch: 2 });
    g.add(halo(k, 1, '#ffa585', { opacity: .28, spread: 1.12, kv: L.sunV }));
    // Phobos and Deimos, two little grey potatoes
    const moonM = planetMat(k, { vertexColors: true, roughness: 1 }, { amb: .35, light: L });
    k.add(g, lumpy(k, .085, [1.35, 1, 1.1], 31), moonM, { p: [1.28, .56, .42], r: [.4, .3, .6], shadow: false });
    k.add(g, lumpy(k, .055, [1.2, 1, 1.05], 37, ['#7a6c60', '#a4968a']), moonM, { p: [-1.18, -.36, .56], r: [.2, 1, .3], shadow: false });
    Object.assign(g.userData, { floating: true, noHero: true, view });
    return g;
  },

  // Jupiter: creamy zones and tan belts churned into swirls and festoons, the Great Red Spot in its pale hollow, a
  // string of white ovals, and Io floating alongside with its black shadow dot on the cloud tops.
  jupiter(k) {
    const T = k.THREE, g = k.group(), N = makeNoise(5150), view = {}, L = lighting(k, view, [-.72, .48, .5]), cam = camBasis(k, view), FLAT = .935;
    const band = ramp([[-90, '#8b8479'], [-65, '#9c9181'], [-55, '#b2a087'], [-48, '#d7c6a8'], [-44, '#c7a37b'], [-40, '#e5d7bc'], [-36, '#d8c29f'], [-32, '#bd926b'],
      [-28, '#ebdec5'], [-24, '#efe4cf'], [-20, '#c68f68'], [-15, '#b07650'], [-11, '#d6ae88'], [-8, '#b77e56'], [-5, '#e9dbbf'], [0, '#efe1c3'], [4, '#e7d3ad'],
      [7, '#c9a17a'], [10, '#9c6243'], [14, '#a66c4a'], [17, '#bf8a63'], [20, '#eee1c9'], [24, '#f1e7d3'], [27, '#c69b74'], [30, '#d8be9b'], [34, '#eadbc1'],
      [38, '#c6a17e'], [43, '#dbc9af'], [50, '#baa289'], [60, '#a49483'], [90, '#8e867c']]);
    const turb = lat => .45 + .55 * (smooth(-23, -18, lat) * smooth(-5, -9, lat) + smooth(6, 9, lat) * smooth(19, 16, lat)) + .3 * smooth(40, 60, Math.abs(lat));
    const GRS = spot(0, -22), BA = spot(48, -33);
    const pearls = [20, 48, 76, 108, 140, 172, -150, -118].map(l => spot(l, -40.5));
    const festoons = [-168, -131, -104, -62, -30, 18, 57, 94, 139].map(l => spot(l, 7.4)), barges = Array.from({ length: 8 }, (_, i) => spot(-160 + i * 45, 14.5));
    const map = mapTex(k, 1536, 768, (c, P) => P.pixels((q, x, y, z, lon, lat) => {
      const w1 = N.fbm(x * 1.2, y * 5, z * 1.2, 4), qx = x + .25 * w1, qy = y + .05 * w1, qz = z - .25 * w1, a = turb(lat);
      const w2 = N.fbm(qx * 3.5 + 7, qy * 15, qz * 3.5, 4), w3 = N.fbm(qx * 10 + 2, qy * 36 + .5 * w2, qz * 10, 3);
      const [gu, gv] = lat > -40 && lat < -4 ? local(GRS, x, y, z) : [99, 99], wake = smooth(-40, -15, gu) * smooth(-4, -15, gu) * smooth(-2, -10, gv) * smooth(-29, -18, gv);
      let col = band(lat + 2.4 * w1 * a + 1.7 * w2 * (a + wake) + .8 * w3 * (a + .25));
      col = mulC(col, 1 + .07 * w3 + .05 * w2);
      col = mixC(col, rgb('#fbf3e6'), smooth(.12, .42, w2 + .3 * w3 + .2 * w1) * wake * .75);             // white turbulence in the Red Spot's wake
      if (Math.abs(lat) > 42) col = mulC(col, 1 + .12 * N.fbm(x * 14, y * 14, z * 14, 2) * smooth(45, 62, Math.abs(lat)));   // mottled poles
      // festoons: soft blue-grey plumes trailing off the north belt's edge
      if (lat > -2 && lat < 13) for (const f of festoons) {
        const [u, v] = local(f, x, y, z); if (Math.abs(u) > 16 || Math.abs(v) > 7) continue;
        const ru = u * .85 + v * .52, rv = -u * .52 + v * .85, bend = rv + .05 * ru * ru;
        col = mixC(col, rgb('#8e98a6'), smooth(1, .1, Math.hypot((ru + 6) / 8, bend / 1.6)) * (.22 + .2 * smooth(-.3, .4, w3)));
      }
      if (Math.abs(lat - 14.5) < 3) for (const b of barges) { const [u, v] = local(b, x, y, z); col = mixC(col, rgb('#6f3b27'), smooth(1, .5, Math.hypot(u / 3.2, v / 1.2)) * .75); }
      if (Math.abs(lat + 40.5) < 4) for (const p of pearls) { const [u, v] = local(p, x, y, z), e = Math.hypot(u / 2.4, v / 1.7); col = mixC(col, rgb('#a0795e'), smooth(1.35, 1.05, e) * smooth(.8, 1.05, e) * .5); col = mixC(col, rgb('#fbf6ec'), smooth(1, .7, e)); }
      if (Math.abs(lat + 33) < 5) { const [u, v] = local(BA, x, y, z), e = Math.hypot(u / 3.6, v / 2.6); col = mixC(col, rgb('#f7efe2'), smooth(1.25, .95, e)); col = mixC(col, rgb('#c8876a'), smooth(.85, .3, e) * .85); }
      // the Great Red Spot: a swirl of brick and salmon in a pale collar
      const e = Math.hypot(gu / 10.5, gv / 6.6);
      if (e < 1.9) {
        const ang = Math.atan2(gv / 6.6, gu / 10.5) + 2.8 * (1 - e), sw = N.fbm(Math.cos(ang) * e * 2.4 + 20, Math.sin(ang) * e * 2.4, e * 1.3, 3);
        const inside = smooth(1.02, .9, e + .06 * sw);
        col = mixC(col, rgb('#f5e8d6'), smooth(1.6, 1.08, e + .1 * sw) * (1 - inside) * .9);
        col = mixC(col, mixC(mixC(rgb('#a8391f'), rgb('#cc6038'), smooth(.05, .6, e + .3 * sw)), rgb('#e3946c'), smooth(.55, 1, e + .2 * sw)), inside);
        col = mixC(col, rgb('#9a3820'), smooth(.1, 0, Math.abs(e - .93 + .04 * sw)) * .4);
      }
      q[0] = col[0]; q[1] = col[1]; q[2] = col[2];
    }), { cache: 'worlds:jupiter:map' });
    const body = k.group(); g.add(body);
    orient(k, body, { face: 12, roll: -6, pitch: -12 });
    body.updateMatrixWorld(true);
    // Io: up the light from where its shadow should land on the disc (upper left of the middle)
    const Lw = L.sunW.clone(), sx = -.36, sy = .34, S = cam.right.clone().multiplyScalar(sx).addScaledVector(cam.up, sy).addScaledVector(cam.back, Math.sqrt(1 - sx * sx - sy * sy));
    const ioR = .085, M = S.clone().addScaledVector(Lw, .62);
    const inv = body.quaternion.clone().invert();
    const Mo = M.clone().applyQuaternion(inv), Lo = Lw.clone().applyQuaternion(inv);
    k.add(body, globe(k, 1, 144, FLAT), planetMat(k, { map, roughness: .9 }, { amb: .28, rim: '#f3dcb4', rimPow: 3.2, light: L,
      uniforms: { uMoonP: { value: Mo }, uMoonL: { value: Lo }, uMoonR: { value: ioR } },
      decl: 'uniform vec3 uMoonP;\nuniform vec3 uMoonL;\nuniform float uMoonR;',
      frag: `{
		vec3 w = uMoonP - vObj; float al = dot(w, uMoonL); float pr = length(w - uMoonL * al);
		float sh = al > 0.0 ? 1.0 - smoothstep(uMoonR * .86, uMoonR * 1.12, pr) : 0.0;
		reflectedLight.directDiffuse *= 1.0 - sh; reflectedLight.directSpecular *= 1.0 - sh; reflectedLight.indirectDiffuse *= 1.0 - .92 * sh;
		reflectedLight.indirectSpecular *= 1.0 - sh; totalEmissiveRadiance *= 1.0 - sh;
	}` }), { shadow: false });
    const N2 = makeNoise(5160);
    const iomap = mapTex(k, 512, 256, (c, P) => P.pixels((q, x, y, z, lon, lat) => {
      const n = N2.fbm(x * 3, y * 3, z * 3, 4), n2 = N2.fbm(x * 9, y * 9, z * 9, 3);
      let col = mixC(rgb('#e3cf6e'), rgb('#f0e6b0'), smooth(-.3, .4, n));
      col = mixC(col, rgb('#d68d3e'), smooth(.1, .5, n2) * .6);
      col = mixC(col, rgb('#b8a17e'), smooth(50, 70, Math.abs(lat)) * .6);
      col = mixC(col, rgb('#2e2218'), smooth(.55, .7, N2.n3(x * 8 + 5, y * 8, z * 8) + .2 * n) * .9);   // black volcanic calderas
      const [u, v] = local(spot(-20, -15), x, y, z), pr = Math.hypot(u, v);
      col = mixC(col, rgb('#c2512a'), smooth(4, 1, Math.abs(pr - 16 + 3 * n)) * .7);                  // the red ring round Pele
      q[0] = col[0]; q[1] = col[1]; q[2] = col[2];
    }), { cache: 'worlds:io' });
    const io = k.group([], { p: M.toArray() }); g.add(io);
    k.add(io, globe(k, ioR, 48), planetMat(k, { map: iomap, roughness: 1 }, { amb: .3, light: L }), { shadow: false });
    orient(k, io, { pitch: 10 });
    g.add(halo(k, 1, '#ffe2b8', { opacity: .22, spread: 1.1, kv: L.sunV }));
    Object.assign(g.userData, { floating: true, noHero: true, view });
    return g;
  },

  // Earth: the blue marble. Deep blue oceans with a sun glint, green and tan continents (the Americas, Africa and
  // Europe round the Atlantic), swirling white clouds on a shell of their own with a hurricane spinning off Africa,
  // a glowing blue rim of air, and the Moon small in the distance.
  earth(k) {
    const T = k.THREE, g = k.group(), N = makeNoise(3003), view = {}, L = lighting(k, view, [-.72, .45, .53]);
    const antCoast = lon => { const w = d => ((d + 540) % 360) - 180; return -68.5 + 1.5 * Math.sin(lon * DEG * 3) - 7 * Math.exp(-((w(lon + 42) / 16) ** 2)) - 9 * Math.exp(-((w(lon - 180) / 22) ** 2)) + 5.5 * Math.exp(-((w(lon + 62) / 5) ** 2)); };
    const BAHAMAS = spot(-77, 24.5);
    const drawLand = Q => { for (const p of LAND) Q.poly(p); Q.c.fillStyle = '#000'; for (const s of SEAS) Q.poly(s); };
    const map = mapTex(k, 1536, 768, (c, P) => {
      const land = P.mask(drawLand, 1), shelf = P.mask(drawLand, 10);
      const ice = P.mask(Q => Q.poly(LAND[5]), 2);
      // biome colours: soft patches over a base green
      c.fillStyle = '#5a8d42'; c.fillRect(0, 0, P.W, P.H);
      P.layer(Q => { for (const [col, lon, lat, rx, ry, rot] of BIOMES) { Q.c.fillStyle = col; Q.ellipse(lon, lat, rx, ry, rot); } }, 14);
      P.pixels((q, x, y, z, lon, lat, i) => {
        const n = N.fbm(x * 6, y * 6, z * 6, 4), f = N.fbm(x * 30, y * 30, z * 30, 2);
        const L = smooth(.35, .65, land[i] + .08 * f), ant = lat < -58 ? smooth(1.2, -1.2, lat - antCoast(lon) + 1.5 * n) : 0;
        let lc = mulC(q, .88 + .2 * n + .08 * f);
        lc = mixC(lc, rgb('#f2f5f8'), clamp(smooth(.3, .7, ice[i]) + ant) * (.9 + .1 * f));
        lc = mixC(lc, rgb('#ecf0f2'), smooth(70, 76, Math.abs(lat)) * .7);
        // oceans: deep blue, paler over the shelves, with a turquoise shallows round the Bahamas
        const sh = smooth(.05, .5, shelf[i]);
        let oc = mixC(rgb('#0b2f74'), rgb('#123f92'), smooth(-.4, .4, n));
        oc = mixC(oc, rgb('#1d62ab'), sh * .7);
        if (lat > 18 && lat < 31 && lon > -84 && lon < -70) { const [bu, bv] = local(BAHAMAS, x, y, z); oc = mixC(oc, rgb('#35a6c9'), smooth(4, 1, Math.hypot(bu / 1.6, bv)) * .7); }
        oc = mixC(oc, rgb('#e9eef2'), smooth(79, 83, lat + 2 * n) * .85);                               // Arctic sea ice
        const col = mixC(oc, lc, Math.max(L, ant));
        q[0] = col[0]; q[1] = col[1]; q[2] = col[2];
      });
    }, { cache: 'worlds:earth:map' });
    const rough = mapTex(k, 1024, 512, (c, P) => {
      const land = P.mask(drawLand, 1);
      P.pixels((q, x, y, z, lon, lat, i) => { const L = Math.max(smooth(.3, .7, land[i]), lat < -58 ? smooth(1, -1, lat - antCoast(lon)) : 0); q[0] = q[1] = q[2] = lerp(.5, .92, L); });
    }, { cache: 'worlds:earth:rough', data: true });
    // clouds: swirled noise, thick in the storm belts and thin over the deserts, with spiralling storms
    const storms = [[-54, 19, 10, 4.2, 1], [-28, 55, 16, 2.6, 1], [-8, -47, 18, 2.6, -1], [-58, 45, 12, 2, 1], [30, -42, 15, 2.2, -1], [-150, 45, 16, 2.4, 1], [150, 40, 14, 2, 1], [80, -50, 16, 2.4, -1], [-120, -48, 16, 2.4, -1]]
      .map(([lon, lat, r, str, dir]) => ({ c: sph(lon, lat), r: r * DEG, a: str * dir }));
    const clouds = mapTex(k, 1536, 768, (c, P) => P.pixels((q, x, y, z, lon, lat) => {
      let px = x, py = y, pz = z, eye = 1, core = 0;
      for (const s of storms) {
        const d = px * s.c[0] + py * s.c[1] + pz * s.c[2], ang = Math.acos(clamp(d, -1, 1));
        if (ang > s.r) continue;
        const t = 1 - ang / s.r, th = s.a * t * t, ct = Math.cos(th), st = Math.sin(th);
        const cx = s.c[1] * pz - s.c[2] * py, cy = s.c[2] * px - s.c[0] * pz, cz = s.c[0] * py - s.c[1] * px;
        px = px * ct + cx * st + s.c[0] * d * (1 - ct); py = py * ct + cy * st + s.c[1] * d * (1 - ct); pz = pz * ct + cz * st + s.c[2] * d * (1 - ct);
        if (s.a > 4) { eye = smooth(.005, .011, ang); core = smooth(.1, .035, ang); }
      }
      // warp the lookup twice for curling, streaky clouds, stretched east-west away from the tropics
      const w1 = N.fbm(px * 1.7 + 11, py * 1.7, pz * 1.7, 2), w2 = N.fbm(px * 1.7, py * 1.7 + 5, pz * 1.7 - 3, 2);
      const al = Math.abs(lat), stretch = 1 + 1.3 * smooth(15, 42, al);
      const n = N.fbm((px + .5 * w1) * 3.2, (py + .3 * w2) * 3.2 * stretch, (pz - .5 * w1) * 3.2, 5), f = N.fbm(px * 13, py * 20, pz * 13, 2);
      const desert = smooth(20, 6, Math.hypot(lon - 15, (lat - 23) * 1.4)) + smooth(12, 4, Math.hypot(lon - 45, lat - 22));
      const cov = -.02 + .15 * smooth(12, 3, Math.abs(lat - 6)) - .16 * smooth(12, 20, al) * smooth(35, 27, al) + .18 * smooth(36, 50, al) * smooth(75, 62, al) - .3 * desert;
      const a = Math.max(smooth(-.04, .34, n + cov + .1 * f), core) * eye;
      q[0] = q[1] = q[2] = clamp(a * (.8 + .2 * smooth(-.2, .4, f)));
    }), { cache: 'worlds:earth:clouds', data: true });
    const body = k.group(); g.add(body);
    k.add(body, globe(k, 1, 160), planetMat(k, { map, roughnessMap: rough, roughness: 1, metalness: 0, specularIntensity: .55 }, { amb: .25, rim: '#3a86ff', rimPow: 2.4, light: L }), { shadow: false });
    const cl = k.add(body, globe(k, 1.012, 144), planetMat(k, { color: '#ffffff', alphaMap: clouds, transparent: true, depthWrite: false, roughness: 1 }, { amb: .3, light: L }), { shadow: false });
    cl.renderOrder = 1;
    orient(k, body, { face: -30, roll: -20, pitch: -4 });
    g.add(atmosphere(k, 1.03, '#5aa8ff', { pow: 2.4, strength: 1.1, light: L }));
    g.add(halo(k, 1.02, '#4d9bff', { opacity: .75, spread: 1.2, kv: L.sunV }));
    // the Moon, small in the distance
    const { map: mmap, bump: mbump } = moonMaps(k, 512);
    const moon = k.group([], { p: [1.25, .78, -.95] }); g.add(moon);
    k.add(moon, globe(k, .23, 72), planetMat(k, { map: mmap, bumpMap: mbump, bumpScale: 1, roughness: 1 }, { amb: .15, light: L }), { shadow: false });
    orient(k, moon, { pitch: -10 });
    Object.assign(g.userData, { floating: true, noHero: true, view });
    return g;
  },

  // Saturn: a butterscotch globe with soft bands and the hexagon round its north pole, in its magnificent rings: the
  // dusky C ring, the bright B ring, the dark Cassini Division, the A ring with the Encke Gap and the thin F ring.
  // The rings throw their shadow across the globe and the globe throws its shadow across the rings behind it.
  saturn(k) {
    const T = k.THREE, g = k.group(), N = makeNoise(6600), view = {}, L = lighting(k, view, [-.7, .5, .5]), FLAT = .9;
    const band = ramp([[-90, '#8d7d62'], [-72, '#b39a70'], [-60, '#c9a870'], [-50, '#dcbc84'], [-42, '#c99e62'], [-34, '#e4c68c'], [-27, '#d1a767'], [-20, '#e8cb92'],
      [-13, '#d8b273'], [-6, '#f1dca6'], [0, '#f6e5b3'], [6, '#f0daa3'], [13, '#dcb373'], [20, '#eacb8f'], [27, '#d3a766'], [34, '#e4c486'], [42, '#cfa265'],
      [50, '#ddbb82'], [58, '#c8a674'], [66, '#b8a07c'], [74, '#a0957f'], [82, '#8e8f8c'], [90, '#7f8589']]);
    const map = mapTex(k, 1536, 768, (c, P) => P.pixels((q, x, y, z, lon, lat) => {
      const w1 = N.fbm(x * 1.3, y * 6, z * 1.3, 4), w2 = N.fbm(x * 4 + 5, y * 18, z * 4, 3);
      let col = band(lat + 1.3 * w1 + .5 * w2);
      col = mulC(col, 1 + .05 * N.fbm(x * 4 + 9, y * 30, z * 4, 3));
      // the hexagon: a six-sided jet stream round the north pole, with a dark vortex in the middle
      const r = 90 - lat;
      if (r < 22) {
        const th = lon * DEG + .35, sec = ((th % (TAU / 6)) + TAU / 6) % (TAU / 6) - TAU / 12, hr = 12.5 / Math.cos(sec);
        col = mixC(col, rgb('#a4a49c'), smooth(hr + 1.2, hr - 1.2, r) * .3);
        col = mixC(col, rgb('#e6dcc8'), smooth(1, .2, Math.abs(r - hr)) * .15);
        col = mixC(col, rgb('#7a7c7c'), smooth(2.5, 0, r) * .45);
      }
      q[0] = col[0]; q[1] = col[1]; q[2] = col[2];
    }), { cache: 'worlds:saturn:map' });
    // the rings, from the inside out: [inner, outer, opacity, colour]
    const rIn = 1.22, rOut = 2.36;
    const RINGS = [[1.239, 1.527, .28, '#9a8a74'], [1.527, 1.64, .8, '#dcc6a0'], [1.64, 1.951, .98, '#f6e4bb'], [1.951, 2.025, .08, '#4f463c'], [2.025, 2.27, .88, '#d8c7a3'], [2.32, 2.328, .55, '#ece2cc']];
    const Nr = makeNoise(6601), ringAt = r => {
      let a = 0, col = rgb('#8e8172');
      for (const [r0, r1, op, c] of RINGS) { const m = smooth(r0 - .004, r0 + .004, r) * smooth(r1 + .004, r1 - .004, r); if (m > 0) { a = lerp(a, op, m); col = mixC(col, rgb(c), m); } }
      const fine = Nr.fbm(r * 60, .5, .5, 4), grain = Nr.n3(r * 400, .3, .7), thick = smooth(.6, .9, a);   // the thick rings stay nearly opaque
      a *= lerp(.78 + .34 * fine + .12 * grain, .95 + .06 * fine, thick);
      col = mulC(col, .88 + .2 * fine + .06 * grain + (.07 * Math.sin(r * 55) + .05 * Math.sin(r * 140)) * smooth(1.53, 1.6, r) * smooth(1.95, 1.9, r));
      col = mixC(col, rgb('#fff6e0'), smooth(1.75, 1.88, r) * smooth(1.95, 1.9, r) * .35);   // the brightest part of the B ring
      a *= 1 - .9 * Math.exp(-(((r - 2.214) / .004) ** 2)) - .6 * Math.exp(-(((r - 2.264) / .0015) ** 2)) - .5 * Math.exp(-(((r - 1.47) / .003) ** 2));   // the Encke, Keeler and Maxwell gaps
      a += .12 * Math.exp(-(((r - 1.99) / .004) ** 2));                                                                                   // a faint ringlet in the Cassini Division
      a *= 1 - .2 * smooth(2.2, 2.27, r);
      return [col, clamp(a)];
    };
    const ringMap = k.tex(2048, 4, (c, w, h) => { const img = c.createImageData(w, h); for (let i = 0; i < w; i++) { const [col] = ringAt(lerp(rIn, rOut, (i + .5) / w)); for (let j = 0; j < h; j++) img.data.set([col[0] * 255, col[1] * 255, col[2] * 255, 255], (j * w + i) * 4); } c.putImageData(img, 0, 0); }, { cache: 'worlds:saturn:ringmap' });
    const ringA = k.tex(2048, 4, (c, w, h) => { const img = c.createImageData(w, h); for (let i = 0; i < w; i++) { const [, a] = ringAt(lerp(rIn, rOut, (i + .5) / w)); for (let j = 0; j < h; j++) img.data.set([a * 255, a * 255, a * 255, 255], (j * w + i) * 4); } c.putImageData(img, 0, 0); }, { cache: 'worlds:saturn:ringalpha', data: true });
    const body = k.group(); g.add(body);
    orient(k, body, { roll: -20, pitch: 12 });
    body.updateMatrixWorld(true);
    const Lo = L.sunW.clone().applyQuaternion(body.quaternion.clone().invert());
    // the globe, with the rings' shadow falling across it
    k.add(body, globe(k, 1, 160, FLAT), planetMat(k, { map, roughness: .9 }, { amb: .28, rim: '#f5dca6', rimPow: 3, light: L,
      uniforms: { uRingA: { value: ringA }, uL: { value: Lo }, uRin: { value: rIn }, uRout: { value: rOut } },
      decl: 'uniform sampler2D uRingA;\nuniform vec3 uL;\nuniform float uRin;\nuniform float uRout;',
      frag: `{
		float sh = 0.0;
		if (vObj.y * uL.y < 0.0) {
			vec2 X = vObj.xz + uL.xz * (-vObj.y / uL.y);
			float u = (length(X) - uRin) / (uRout - uRin);
			if (u > 0.0 && u < 1.0) sh = texture2D(uRingA, vec2(u, .5)).g * .88;
		}
		reflectedLight.directDiffuse *= 1.0 - sh; reflectedLight.directSpecular *= 1.0 - sh;
	}` }), { shadow: false });
    // the rings, darkened where the globe blocks the light
    const ring = k.mesh(ringGeo(k, rIn, rOut, 320, 8), planetMat(k, { map: ringMap, alphaMap: ringA, transparent: true, depthWrite: false, side: T.DoubleSide, roughness: .8 }, { amb: .5, light: L,
      uniforms: { uL: { value: Lo }, uFlat: { value: FLAT }, uGlow: { value: .5 } },
      decl: 'uniform vec3 uL;\nuniform float uFlat;\nuniform float uGlow;',
      frag: `{
		vec3 Pp = vec3(vObj.x, vObj.y / uFlat, vObj.z), Lf = vec3(uL.x, uL.y / uFlat, uL.z);
		float b = dot(Pp, Lf), dd = dot(Pp, Pp) - b * b / dot(Lf, Lf);
		float sh = b < 0.0 ? 1.0 - smoothstep(.97, 1.03, dd) : 0.0;
		reflectedLight.directDiffuse *= 1.0 - .96 * sh; reflectedLight.directSpecular *= 1.0 - sh; reflectedLight.indirectDiffuse *= 1.0 - .6 * sh;
		totalEmissiveRadiance += diffuseColor.rgb * uGlow * (1.0 - sh);
	}` }), { shadow: false });
    ring.renderOrder = 2; body.add(ring);
    g.add(halo(k, 1, '#ffe6b0', { opacity: .18, spread: 1.1, kv: L.sunV }));
    // Titan, hazy and orange, riding in the corner above the rings
    const N3 = makeNoise(6602), cam = camBasis(k, view);
    const tmap = mapTex(k, 256, 128, (c, P) => P.pixels((q, x, y, z, lon, lat) => {
      const col = mixC(rgb('#c4853a'), rgb('#e6b263'), smooth(-.4, .4, N3.fbm(x * 3, y * 3, z * 3, 3) + lat / 150));
      q[0] = col[0]; q[1] = col[1]; q[2] = col[2];
    }), { cache: 'worlds:titan' });
    const ti = k.group([], { p: cam.right.clone().multiplyScalar(1.62).addScaledVector(cam.up, .78).addScaledVector(cam.back, .4).toArray() }); g.add(ti);
    k.add(ti, globe(k, .085, 40), planetMat(k, { map: tmap, roughness: 1 }, { amb: .3, rim: '#ffcf7a', rimPow: 2, light: L }), { shadow: false });
    Object.assign(g.userData, { floating: true, noHero: true, view });
    return g;
  },
};
