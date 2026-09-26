// Models for the office cards. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

// Handwriting for notes and doodles (falls back to the page fonts).
const HAND = '"Marker Felt", "Noteworthy", "Comic Sans MS", "Chalkboard SE", Nunito, cursive';

// A 2D path made of straight runs and arcs, sampled densely (for bent wire and outlines).
function path2d() {
  const pts = [];
  const api = {
    pts,
    line(a, b, step = .08) { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let i = 0; i < n; i++) { const t = i / n; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } return api; },
    arc(cx, cy, r, a0, a1, step = .12) { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step)); for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return api; },
    end(p) { pts.push(p); return api; },
  };
  return api;
}

// A regular hexagon with softened corners, corners at angles 0, 60, … (x = sin a, y = -cos a), for extrude().
function hexShape(k, R, cr) {
  const s = new k.THREE.Shape(), C = [];
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; C.push([Math.sin(a) * R, -Math.cos(a) * R]); }
  const t = cr / R;
  for (let i = 0; i < 6; i++) {
    const c = C[i], p = C[(i + 5) % 6], n = C[(i + 1) % 6];
    const a = [c[0] + (p[0] - c[0]) * t, c[1] + (p[1] - c[1]) * t], b = [c[0] + (n[0] - c[0]) * t, c[1] + (n[1] - c[1]) * t];
    i ? s.lineTo(a[0], a[1]) : s.moveTo(a[0], a[1]);
    s.quadraticCurveTo(c[0], c[1], b[0], b[1]);
  }
  s.closePath();
  return s;
}

// A round rod from a to b ([x, y, z] points).
function strut(k, a, b, r, mat, seg = 16) {
  const T = k.THREE, A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A);
  const m = k.mesh(k.cyl(r, r, d.length(), { seg }), mat);
  m.position.copy(A).add(B).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  return m;
}

// A coil spring from a to b: coil radius R, wire radius r.
function helix(k, a, b, R, turns, r, mat) {
  const T = k.THREE, A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length(); d.normalize();
  const u = new T.Vector3(0, 0, 1).cross(d); if (u.lengthSq() < 1e-6) u.set(1, 0, 0); u.normalize();
  const v = d.clone().cross(u), pts = [], n = Math.ceil(turns * 14);
  for (let i = 0; i <= n; i++) {
    const t = i / n, an = t * turns * Math.PI * 2;
    const q = A.clone().addScaledVector(d, t * L).addScaledVector(u, Math.cos(an) * R).addScaledVector(v, Math.sin(an) * R);
    pts.push([q.x, q.y, q.z]);
  }
  return k.mesh(k.tube(pts, r, { seg: n * 2, rs: 6, caps: true }), mat);
}

// Rough continent outlines for the desk globe, as flat [lon, lat, lon, lat, …] lists.
const LAND = [
  // North America
  [-168,66,-162,70,-156,71.5,-140,69.8,-128,70,-115,68.5,-100,68,-95,71.5,-87,68,-82,66,-86,63,-93,61,-94,58.5,-91,57,-85,55.3,-82,52.5,-79,54.5,-77,58,-77.5,60.5,-74,62,-70,61,-65,60.3,-62,57.5,-58,54.5,-56,52,-59,48,-65,48.8,-64.5,46.2,-61,45.2,-66,44.5,-70,43.7,-70,41.7,-74,40.5,-76,38.5,-75.8,35.5,-78,33.8,-81,31.5,-80.2,27,-80.4,25.2,-81.7,25.9,-82.8,28.2,-84,30,-86.5,30.4,-89.5,30.2,-90,29.2,-94,29.6,-97.2,27.8,-97.8,24,-97.3,21.5,-96,19,-94.5,18.2,-91,18.6,-90.4,21,-87.2,21.4,-87.6,18.5,-88.3,16,-85,15.9,-83.3,14.9,-83.6,11.2,-81.8,9,-79.5,9.4,-77.4,8.6,-78.2,7.2,-80.5,7.3,-82.5,8.2,-85.8,10.3,-87.5,13,-91.5,14,-94.5,16,-97.5,16,-101,17.5,-105.5,20.5,-105.3,23,-107.5,24.5,-109.3,26.5,-112.2,29,-113,31.2,-114.7,31.5,-114.2,29.5,-112.5,27,-110,23.5,-112,24.5,-114.5,27.8,-115.7,30,-117.1,32.5,-118.5,34,-120.6,34.6,-122.4,37.5,-123.7,39.8,-124.2,42,-124,46,-124.7,48.4,-123,49,-125,50,-127.5,51,-130,54.5,-133,57,-136.5,58.5,-140,59.8,-144,60,-147,61,-150,59.5,-152,58,-154,57.5,-157,57,-159,55.8,-163,54.8,-164.5,54.4,-161,56,-158,58.3,-157,58.8,-161.8,58.6,-162,60,-164.5,60.8,-165.5,62.5,-164.5,63.2,-161,64.2,-163.5,64.6,-166,64.7],
  // Arctic islands, Greenland, Iceland
  [-125,72,-118,73.5,-112,75,-105,76.5,-96,77.5,-88,78.5,-80,79.5,-72,82,-62,82.5,-68,80,-76,78,-79,76,-80,74,-77,72.5,-72,71,-68,69,-62,67,-66,64,-73,64.5,-80,68,-86,69.5,-92,70,-97,70,-104,70,-113,70,-120,71],
  [-73,78,-66,80.5,-60,82,-45,83,-30,83.5,-22,82.2,-18,79.5,-19,75,-21.5,71,-24,69.3,-32,68,-38,65.5,-40.5,63,-43,60,-46,60.8,-49,62,-51,64,-53,66.5,-54,69.5,-56,72.5,-59,75.5,-66,76.5],
  [-24,65.5,-22,66.4,-18,66.2,-14.5,66.1,-13.5,65,-15,64.3,-18.5,63.4,-22.5,63.8],
  // Caribbean
  [-85,21.8,-82.5,23.1,-80,23,-77,21.7,-74.2,20.2,-77.5,19.9,-78.5,21.4,-81.5,21.9,-84,21.2],
  [-74.4,18.4,-72.8,19.9,-70,19.7,-68.4,18.6,-70,18.2,-71.6,17.8],
  // South America
  [-77,8.5,-75.5,10.8,-72,12,-71,12.4,-68,10.8,-64,10.6,-61.5,10.5,-60,8.5,-57.5,6.5,-54,5.8,-51.5,4.3,-50,1.8,-50,0,-48.5,-1,-44.5,-2.4,-41,-2.9,-38,-4,-35.2,-5.5,-34.8,-7.5,-35.3,-9.5,-37,-11,-38.8,-13,-39.2,-17.5,-40.2,-20.3,-41.5,-22.5,-44.5,-23.2,-46.5,-24,-48.5,-26,-48.6,-28.5,-50.5,-31,-52.5,-33.5,-54,-34.8,-56.5,-34.7,-58.4,-34.3,-57.3,-36,-57.5,-38.2,-62,-38.8,-62.2,-40.5,-65,-41,-63.8,-42.5,-65.3,-45,-67.5,-46.3,-65.8,-48,-68.5,-50.5,-69,-52,-68.4,-53,-70,-54.5,-72,-54,-74,-52.5,-75.3,-50,-74.5,-46.5,-73.5,-43.5,-73.7,-40,-73.3,-37,-71.6,-33,-71.5,-30,-70.5,-25,-70.2,-19.5,-71.5,-17.2,-75,-15.3,-76.3,-13.5,-78,-10.5,-79.7,-7.5,-81.2,-5.8,-80.3,-3.5,-80,-2.3,-80.9,-1,-80,1,-78.8,1.8,-78,3.5,-77.3,4,-77.5,6.5,-77.9,7.3],
  // Africa, Madagascar
  [-17,21,-16,24,-13,27.5,-9.5,30,-9,32.5,-6,35.8,-2,35.2,3,36.8,10,37.2,11,35,10.5,33.5,15,32.3,20,31,20,32.5,25,31.8,29,31,32,31.2,34,29.5,34.5,27,35.5,24,37,21,38.5,18,39.5,15.5,42,13,43.3,11.8,44.5,10.5,51,11.8,51,10,48,5,44,1,41,-2,39.5,-5,39,-8,40.5,-11,40.5,-15,37,-17.5,35,-20,35.5,-23,33,-25.5,32.5,-28.5,30,-31,27.5,-33.5,25,-34,22,-34.5,20,-34.8,18.5,-34,18,-31.5,16.5,-28.5,15,-26.5,14.5,-22,12,-18,11.8,-15,13.5,-11,13,-8,12,-5,9.5,-2,9.5,1,9.5,4,7,4.5,4.5,6.2,1,5.8,-2,4.8,-4.5,5.2,-7.5,4.4,-9.5,5.5,-12,7.4,-13.5,9.5,-15,11,-16.8,12.5,-17.2,14.7,-16.5,16.5,-16.2,19.5],
  [44,-25,47,-25.2,49,-18,50.3,-15.5,49.4,-12,48,-13.5,44.3,-16.5,43.3,-22],
  // Eurasia
  [-5.6,36,-6.3,36.8,-7.4,37.2,-8.9,37,-8.8,38.7,-9.4,39.4,-8.8,41.2,-9.3,43,-8,43.7,-4.5,43.4,-1.8,43.4,-1.3,44.8,-1.2,46.2,-2.2,47.1,-4.6,48.4,-3,48.8,-1.6,48.6,-1.4,49.7,0.2,49.7,1.6,50.9,3.2,51.3,4.4,52.2,4.8,53,7,53.5,8.6,53.9,8.2,55.5,8.1,56.7,9.5,57.2,10.6,57.7,10.4,56.5,10.9,56.3,9.8,55.3,11.1,54,13.6,54.1,14.4,53.9,16.5,54.5,18.6,54.5,19.8,54.4,21.2,55.2,21.1,56.8,21.8,57.5,23.9,57,24.4,58.4,23.5,59.2,26,59.5,28.1,59.5,29.9,59.9,28,60.5,26,60.4,23,59.9,21.4,60.7,21.4,62,22.5,63.5,24.7,64.9,25.4,65.4,24.6,65.8,22.3,65.8,21.2,64.8,20.5,63.8,18.8,63.2,17.6,62.4,17.3,61.5,17.2,60.6,18.5,60.2,18.9,59.3,18,59,16.8,58.4,16.5,57.3,15.9,56.1,14.3,55.6,12.9,55.4,12.5,56.5,11.9,57.6,11.2,58.4,10.5,59.8,9.5,59,8,58.1,6.6,58.1,5.5,58.8,5,60.2,5,61.8,6,62.6,8.5,63.5,10.4,64.4,12.4,65.8,13.5,66.9,14.7,67.8,16,68.6,18,69.6,20,70.1,23,70.7,25.8,71.1,28.3,71,31,70.3,33,69.4,36.5,69,40.8,67.7,40,66.2,38.3,66,35,66.2,34.7,64.7,37,63.8,40.5,64.6,44,66.3,44.2,68.3,48.5,67.6,53.5,68.3,58,68.9,61,69.6,65,69.3,68,68.3,68.5,71.5,72.8,72.8,80,73.5,87,75,95,76,100,77,104,77.7,107,76.5,113,73.7,120,73,128,72.5,131,71,140,72.5,150,71.5,160,70,170,70,180,69,180,65,177,62.5,173,61,170,60,164,59.8,163.5,56,162,54.5,160,53,156.5,51,156,57,155,59.3,150,59.5,143,59.3,137.5,54,141,52.5,140.5,48.5,135,43.3,131,42.7,129.5,40.5,129.5,35.2,126.5,34.4,126.2,37.7,125,39.6,121.5,40.8,121.8,39,121,38.8,122.5,37.4,119.2,37.1,120.5,34.3,121.9,31.5,121.7,28.5,119.5,25.5,116.5,23,113.5,22.3,110.5,21.3,108,21.5,106.5,19.8,105.8,18.5,108.8,15.3,109.3,11.6,107,10.4,105,8.7,104.8,10.4,103,11.5,101,12.7,100,13.4,99.2,10.5,99.8,9.2,100.3,7.2,101.3,6.8,103.5,4.5,104.2,1.4,103.4,1.3,101.3,2.8,100.4,5.2,98.3,8.2,98.5,11.3,97.7,16,96.2,16.8,94.4,16,94.5,18.5,92.5,20.8,91.8,22.4,90.2,21.8,88.5,21.6,86.9,20.8,84.5,19,80.3,15.8,80.1,13.2,79.8,10.2,77.5,8.1,76.3,9.7,74.7,13.6,73.4,16.2,72.8,19.2,72.6,21.4,70.5,20.8,69,22.4,68.2,23.7,66.8,25.4,64,25.4,61.6,25.2,57.3,25.8,56.4,27.1,54.5,26.6,51.4,27.9,50.1,30.1,48.4,29.9,48.5,28.2,49.6,26.9,50.5,25.6,50.8,24.8,51.6,24.2,54.2,24.2,56.3,26.3,56.4,24.8,58.8,23.5,59.8,22.4,58.5,20.6,57.8,19,55.3,17.6,52.2,15.8,48.7,14,45,12.8,43.5,12.6,42.8,15.2,41.8,17,40.5,19.7,39.1,21.5,38.4,23.8,36.7,26,35.2,28,34.6,29.5,34.2,31.3,35,33,35.9,35,36.2,36.6,34.5,36.8,32.5,36.1,30.5,36.4,29,36.6,27.3,37.2,26.8,38.6,26.4,39.5,26.2,40.1,25,40.9,23.8,40.5,22.7,40.5,23.3,39.3,22.9,38.2,22.4,36.5,21.6,36.9,21.2,38.2,20.3,39.5,19.4,41.8,18.5,42.5,16,43.5,15.2,44.3,13.7,45.1,13.6,45.7,12.3,45.3,12.4,44.2,13.6,43.5,14.7,42.1,16,41.5,17.5,40.8,18.5,40.1,17.2,40.4,16.5,39.6,17.1,38.9,16.1,38,15.7,38.3,15.7,40,14.9,40.3,14,40.8,12.4,41.8,11,42.6,10.4,43.6,9,44.4,7.6,43.8,6.2,43.1,4.5,43.4,3.1,43.1,3.2,41.9,1,41,0,40,-0.3,38.8,-0.8,37.6,-2.2,36.7,-4.4,36.7],
  // Britain, Ireland, Japan, islands of Asia
  [-5.7,50,-3,50.6,1.4,51.2,1.7,52.7,0.3,53.4,-0.4,54.5,-1.6,55.6,-2.1,56.3,-1.8,57.6,-3.3,58.6,-5,58.6,-5.6,57.5,-6.2,56.4,-5,55.2,-3.2,54.6,-4.6,53.3,-4.3,52.3,-5.2,51.7,-3.4,51.4],
  [-6,52.2,-6.1,53.9,-5.6,54.6,-7.3,55.3,-8.6,54.8,-10,54.2,-9.6,53,-10.4,52,-9.8,51.6,-8,51.7],
  [130,31,131.5,33.5,135,33.5,137,34.6,139.8,35,140.8,36.8,141.5,39,141.4,41.4,140,41.4,140,40,139.8,38.5,138.5,37.5,136.8,37.2,136,35.8,133,35.5,130.8,34.3,129.8,33.3],
  [140,41.8,141.3,41.5,143.3,42,145.5,43.3,144.3,44,141.8,45.4,141.5,43.5,140.3,43],
  [120,18.5,122.3,18.5,124,13,126.5,7,125.5,6,122,7,123.5,10,120,14.5],
  [95.3,5.6,97.5,5.2,100.4,2.2,104,-1,106,-3.2,105.8,-5.8,104.5,-5.8,102.2,-4,100.5,-1.5,98.7,1.7,96.4,3.8],
  [105.2,-6.8,106.5,-6,110.5,-6.9,114.5,-7.7,114.4,-8.7,110,-8.2,106.5,-7.5],
  [109,1.5,109.7,-1,110.2,-2.9,114.5,-4,116.5,-3,117.8,.8,119,5,117.2,6.9,116,6,115.4,5,113,3.2,111.2,2.5],
  [131,-1.2,134,-.8,138,-1.6,141,-2.6,145,-4.2,147.5,-6.2,150.5,-10.5,147,-10.2,143.5,-9.2,141,-9.1,138.7,-8.3,137.7,-5.2,135,-4.3,132.8,-4,132,-2.8],
  // Australia, New Zealand
  [113.5,-22,114,-26,115,-34,118,-35,123,-34,126,-32.2,131,-31.5,135.5,-34.8,138,-35.5,140,-38,146,-39,150,-37.5,153,-32,153.5,-28,153,-25,150.5,-22.5,146,-19,145.5,-15,143.5,-14,142.5,-10.7,141.5,-13,141.5,-16.5,139.5,-17.5,136,-15,137,-12,132.5,-11.5,130,-13,129.5,-15,126,-14,122.5,-17,121,-19.5,117,-20.7,114.5,-21.5],
  [172.7,-34.5,174.6,-36,176,-37.6,178.5,-37.7,177,-39.5,176.3,-40.5,174.8,-41.5,174.6,-39.8,173.8,-39.2,174.6,-37.5,172.7,-35],
  [172.7,-40.5,174.3,-41.7,173.4,-43,171.2,-44.5,169,-46.5,166.5,-46,166.8,-45,168.4,-44,170.6,-42.8,172,-41.5],
];
const ICE = [
  [-180,-78,-160,-77.5,-150,-76.5,-140,-75,-130,-74,-120,-73.8,-110,-74,-100,-73.2,-90,-72.8,-80,-73,-75,-71,-68,-68,-63,-65,-58,-63.3,-57,-64,-62,-66.5,-64,-69,-62,-73,-60,-75,-50,-77.8,-40,-78,-30,-77,-20,-74,-10,-71,0,-70,10,-70,20,-69.8,30,-69.5,40,-69,50,-67,60,-67,70,-68.5,75,-69.5,80,-67.5,90,-66.5,100,-66,110,-66,120,-66.8,130,-66,140,-66.5,150,-68.5,160,-70,165,-72,170,-72.5,168,-75.5,170,-78,180,-78,180,-90,-180,-90],
  [-73,78,-66,80.5,-60,82,-45,83,-30,83.5,-22,82.2,-18,79.5,-19,75,-21.5,71,-24,69.3,-32,68,-38,65.5,-40.5,63,-43,60,-46,60.8,-49,62,-51,64,-53,66.5,-54,69.5,-56,72.5,-59,75.5,-66,76.5],
];
const LAKES = [
  [47,45,49,46.7,53,46.8,54,44.5,51.5,41.5,53,40.5,54,37.5,50,37,49,38.5,49.5,40.5,47.5,42.5],                          // Caspian
  [28,41.2,27.8,43,29.5,45.2,31,46.6,33.5,44.5,36.5,45.3,38.5,44.3,41.5,42,41.5,41.5,38,40.9,35,42,31.5,41.2],           // Black Sea
];

export default {
  // A yellow No. 2 pencil, freshly sharpened, lying on the desk: hexagonal barrel, scalloped paint at the cone, pink eraser.
  pencil(k) {
    const g = k.group(), p = k.group();
    const R = .3, rin = R * Math.cos(Math.PI / 6), bodyL = 4.4, coneL = 1.1, lead = .075;
    const y0 = .95 + bodyL;                                                        // where the sharpened cone starts
    const dHex = th => { const a = ((th % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3); return rin / Math.cos(a - Math.PI / 6); };
    // built standing along +y (eraser at the bottom), laid down at the end
    k.add(p, k.lathe([[0, 0], [.14, .004], [.2, .018], [.24, .045], [.262, .09], [.27, .15], [.27, .5]]), k.matte('#f28aa0', .72));
    k.add(p, k.lathe([[.27, .4], [.3, .41], [.3, .5], [.314, .53], [.3, .56], [.3, .62], [.314, .65], [.3, .68], [.3, .86], [.314, .89], [.3, .92], [.3, 1.0], [.27, 1.02]]), k.metal('#d9dde3', .22));
    const body = k.extrude(hexShape(k, R, .035), bodyL + .1, { bevel: 0, curve: 6 });
    body.rotateX(-Math.PI / 2);
    k.add(p, body, k.plastic('#dca200', { rough: .45, coat: .3, coatRough: .3 }), { p: [0, .9 + (bodyL + .1) / 2, 0] });
    // The sharpened end: a cone clipped to the hexagon, painted where it still lies on a face (the scallops), wood, then graphite.
    const cone = k.cyl(1, 1, coneL, { seg: 72, hseg: 40, open: true }), pos = cone.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), th = Math.atan2(x, z), len = Math.hypot(x, z) || 1;
      const r = Math.min(R * (1 - (y + coneL / 2) / coneL), dHex(th));
      pos.setXYZ(i, x / len * r, y, z / len * r);
    }
    cone.computeVertexNormals();
    const coneMat = k.painted(256, 256, (c, w, h) => {
      const img = c.createImageData(w, h), d = img.data;
      for (let yy = 0; yy < h; yy++) {
        const rho = R * ((yy + .5) / h);
        for (let xx = 0; xx < w; xx++) {
          const th = (xx + .5) / w * Math.PI * 2, i = (yy * w + xx) * 4;
          let col;
          if (rho >= dHex(th) - .002) col = [220, 162, 0];
          else if (rho > lead) { const s = .94 + .06 * Math.sin(xx * 1.7) * Math.sin(xx * .37); col = [236 * s, 196 * s, 146 * s]; }
          else col = [58, 58, 64];
          d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
        }
      }
      c.putImageData(img, 0, 0);
    }, { rough: .45, coat: .3 });
    k.add(p, cone, coneMat, { p: [0, y0 + coneL / 2, 0] });
    // the stamp, on the upper front face
    const stamp = k.decal(1.7, .19, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      k.text(c, 'No. 2  ·  HB  ·  SCHOOL', w / 2, h * .54, { size: h * .62, weight: 700, color: '#20301f', font: 'Nunito, sans-serif' });
    }, { px: 512 });
    stamp.position.set(-.5 * rin * 1.004, 2.4, .866 * rin * 1.004);
    stamp.rotation.set(0, -Math.PI / 6, Math.PI / 2);
    p.add(stamp);
    p.rotation.z = -Math.PI / 2;
    p.position.set(-(y0 + coneL) / 2, .314, 0);
    g.add(p);
    g.rotation.y = -.16;
    g.userData.view = { el: 34 };
    return g;
  },

  // A plain steel paper clip lying flat: three bends of one wire.
  paperclip(k) {
    const g = k.group(), r = .058;
    const P = path2d()
      .line([.5, 2.3], [.5, .5]).arc(0, .5, .5, 0, -Math.PI)
      .line([-.5, .5], [-.5, 2.82]).arc(-.12, 2.82, .38, Math.PI, 0)
      .line([.26, 2.82], [.26, .56]).arc(0, .56, .26, 0, -Math.PI)
      .line([-.26, .56], [-.26, 2.0]).end([-.26, 2.0]);
    const geo = k.tube(P.pts.map(([u, v]) => [v - 1.6, r, u]), r, { caps: true, seg: P.pts.length * 3, rs: 12 });   // long side along x
    k.add(g, geo, k.metal('#e2e6ec', .16));
    g.userData.view = { az: -6, el: 64 };
    return g;
  },

  // A pad of yellow sticky notes; the top one has a mystery phone number and its corner curls up.
  stickynotes(k) {
    const g = k.group(), T = k.THREE, S = 3, H = .34, yellow = '#ffdf3d';
    const edge = k.painted(64, 256, (c, w, h) => {
      c.fillStyle = yellow; c.fillRect(0, 0, w, h);
      for (let y = 1; y < h; y += 4) { c.fillStyle = 'rgba(150,110,0,.22)'; c.fillRect(0, y, w, 1); }
    }, { rough: .9 });
    const paper = k.matte(yellow, .9);
    k.add(g, k.box(S, H, S, .025, 2), [edge, edge, paper, paper, edge, edge], { p: [0, H / 2, 0] });
    const note = k.painted(512, 512, (c, w, h) => {
      c.fillStyle = '#ffe24a'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(0, 0, w, h * .16);          // the glue strip
      const ink = '#2346b0';
      k.text(c, '555-0147', w / 2, h * .44, { size: 104, weight: 400, font: HAND, color: ink });
      k.text(c, 'call back??', w * .47, h * .7, { size: 64, weight: 400, font: HAND, color: ink });
      c.strokeStyle = ink; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(w * .16, h * .54); c.quadraticCurveTo(w * .5, h * .58, w * .84, h * .53); c.stroke();
      c.beginPath(); c.arc(w * .82, h * .8, 22, 0, Math.PI * 2); c.stroke();          // a little doodle
      c.beginPath(); c.moveTo(w * .15, h * .86); for (let i = 0; i < 6; i++) c.lineTo(w * (.17 + i * .03), h * (i % 2 ? .82 : .88)); c.stroke();
    }, { rough: .85, side: T.DoubleSide });
    const sheet = new T.PlaneGeometry(S - .01, S - .01, 30, 30);
    sheet.rotateX(-Math.PI / 2);
    // the front edge lifts a little, and the front-right corner rolls up around a diagonal fold (no stretching)
    const pos = sheet.attributes.position, rc = .42, c0 = 1.75;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), front = Math.max(0, (z - .3) / (S / 2 - .3));
      const s = (x + z - c0) / Math.SQRT2;
      let y = .07 * front * front, nx = x, nz = z;
      if (s > 0) { const f = s / rc, along = rc * Math.sin(f); y += rc * (1 - Math.cos(f)); nx += (along - s) / Math.SQRT2; nz += (along - s) / Math.SQRT2; }
      pos.setXYZ(i, nx, y, nz);
    }
    sheet.computeVertexNormals();
    k.add(g, sheet, note, { p: [0, H + .004, 0] });
    g.rotation.y = .2;
    g.userData.view = { el: 46 };
    g.userData.fullView = { el: 36 };                         // square, so no hero pose: just look down on it more
    return g;
  },

  // A red push pin lying on its side, the needle glinting.
  pushpin(k) {
    const g = k.group(), pin = k.group();
    k.add(pin, k.lathe([[0, 0], [.014, .025], [.046, .2], [.046, 1.0], [0, 1.0]]), k.metal('#d7dce3', .12));   // the steel pin
    const prof = [[0, .8], [.25, .8], [.3, .82], [.315, .86], [.31, .9], [.28, .94], [.24, .99], [.215, 1.06], [.205, 1.25], [.205, 1.45], [.215, 1.58], [.25, 1.66],
      [.31, 1.71], [.38, 1.75], [.41, 1.79], [.42, 1.85], [.415, 1.9], [.395, 1.94], [.34, 1.97], [.2, 1.985], [0, 1.99]];
    k.add(pin, k.lathe(prof), k.gloss('#d9142b'));
    const a = Math.atan((.42 - .315) / (1.85 - .86));       // rests on the base collar and the rim of the cap
    pin.rotation.z = a - Math.PI / 2;
    g.add(pin);
    g.rotation.y = Math.PI;                                    // cap on the left, needle to the right
    g.userData.view = { az: 4, el: 48 };
    return g;
  },

  // Office scissors lying a little open: polished steel blades, blue plastic loops (a big one for fingers, a round one for the thumb).
  scissors(k) {
    const g = k.group(), T = k.THREE, sc = k.group();
    const steel = k.metal('#e2e6ec', .12), blue = k.plastic('#1f6fe8', { rough: .3 });
    const blade = new T.Shape();
    blade.moveTo(-.3, 0); blade.lineTo(3.9, 0); blade.quadraticCurveTo(4.14, 0, 4.06, .1);
    blade.bezierCurveTo(3.2, .32, 1.4, .52, .3, .48); blade.quadraticCurveTo(-.1, .46, -.3, .3); blade.closePath();
    const bladeGeo = k.extrude(blade, .04, { bevel: .012 }), boss = k.extrude(k.circle(.3), .04, { bevel: .012 });
    const arm = new T.Shape();
    arm.moveTo(-.18, .26); arm.quadraticCurveTo(-.95, .12, -1.5, -.42); arm.lineTo(-1.5, -1.12);
    arm.quadraticCurveTo(-.85, -.62, -.12, -.24); arm.quadraticCurveTo(.12, 0, -.18, .26);
    const armGeo = k.extrude(arm, .16, { bevel: .05 });
    const loop = (cx, cy, rx, ry, t) => {
      const s = new T.Shape(); s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false);
      const h = new T.Path(); h.absellipse(cx, cy, rx - t, ry - t, 0, Math.PI * 2, true);
      return k.extrude(s, .16, { bevel: .05, holes: [h] });
    };
    const open = k.deg(9);
    // top half: blade edge along +x from the pivot, big finger loop behind on the -y side
    const A = k.group([], { r: [0, 0, open] });
    k.add(A, bladeGeo, steel, { p: [0, 0, .19] });
    k.add(A, boss, steel, { p: [0, 0, .19] });
    k.add(A, armGeo, blue, { p: [0, 0, .13] });
    k.add(A, loop(-2.2, -.8, .82, .56, .22), blue, { p: [0, 0, .13] });
    // bottom half: the mirror image, with a smaller round thumb loop
    const B = k.group([], { r: [0, 0, -open], s: [1, -1, 1] });
    k.add(B, bladeGeo, steel, { p: [0, 0, .12] });
    k.add(B, armGeo, blue, { p: [0, 0, .13] });
    k.add(B, loop(-2.05, -.72, .6, .52, .2), blue, { p: [0, 0, .13] });
    k.add(sc, k.rcyl(.15, .06, .02, { seg: 32 }), k.chrome(), { p: [0, 0, .22], r: [Math.PI / 2, 0, 0] });   // pivot screw
    k.add(sc, k.box(.2, .025, .03), k.iron(), { p: [0, 0, .29], r: [0, 0, .6] });
    sc.add(A, B);
    sc.rotation.x = -Math.PI / 2;
    g.add(sc);
    g.userData.view = { az: 2, el: 54 };
    return g;
  },

  // The red stapler: glossy red top and base, a chrome magazine and anvil, the arm sprung a little open.
  stapler(k) {
    const g = k.group(), T = k.THREE;
    const red = k.gloss('#d61f26'), chrome = k.chrome(), black = k.plastic('#1b1c20', { rough: .55 });
    const flat = geo => { geo.rotateX(-Math.PI / 2); return geo; };
    k.add(g, flat(k.slab(7.0, 1.36, .08, .62, .03)), k.rubber(), { p: [0, .04, 0] });
    k.add(g, flat(k.slab(7.2, 1.5, .36, .72, .1)), red, { p: [0, .25, 0] });
    k.add(g, k.box(1.15, .04, .6, .015), chrome, { p: [2.8, .43, 0] });                 // anvil
    k.add(g, k.box(.62, .012, .07, .005), k.matte('#6d7178', .4), { p: [2.8, .452, 0] });
    // the arm, hinged at the back
    const hinge = [-3.15, .62];
    const arm = k.group([], { p: [hinge[0], hinge[1], 0], r: [0, 0, .035] }), at = (x, y) => [x - hinge[0], y - hinge[1]];
    const s = new T.Shape(), P = (x, y) => at(x, y);
    s.moveTo(...P(-3.3, .74)); s.lineTo(...P(3.0, .74)); s.quadraticCurveTo(...P(3.4, .74), ...P(3.4, 1.02));
    s.bezierCurveTo(...P(3.4, 1.36), ...P(2.9, 1.52), ...P(2.2, 1.54)); s.bezierCurveTo(...P(.6, 1.58), ...P(-1.8, 1.43), ...P(-2.95, 1.2));
    s.quadraticCurveTo(...P(-3.38, 1.1), ...P(-3.3, .74));
    k.add(arm, k.extrude(s, .98, { bevel: .14 }), red);
    k.add(arm, k.box(6.3, .24, .92, .05), chrome, { p: [...at(.05, .58), 0] });            // magazine
    k.add(arm, k.box(.1, .2, .8, .03), k.steel(), { p: [...at(3.22, .6), 0] });           // driver plate at the nose
    k.add(arm, k.slab(1.3, .26, .03, .1, .01), chrome, { p: [...at(.9, 1.14), .64] });    // plate, no name on it
    g.add(arm);
    k.add(g, k.box(.9, .5, 1.12, .16), black, { p: [-3.12, .6, 0] });                     // hinge block
    k.add(g, k.cyl(.09, .09, 1.18, { seg: 20 }), chrome, { p: [-3.15, .64, 0], r: [Math.PI / 2, 0, 0] });
    g.userData.view = { az: 28, el: 20 };
    return g;
  },

  // An articulated desk lamp in glossy teal: weighted base, sprung arms, a metal shade with the bulb lit inside.
  desklamp(k) {
    const g = k.group(), T = k.THREE;
    const paint = k.gloss('#12918a'), chrome = k.chrome(), dark = k.plastic('#24272c', { rough: .5 });
    k.add(g, k.rcyl(1.2, .28, .11), paint);
    k.add(g, k.rcyl(.36, .34, .08), paint, { p: [0, .24, 0] });                       // turret
    k.add(g, k.rcyl(.12, .07, .03, { seg: 24 }), dark, { p: [.62, .26, .6] });        // switch
    const P0 = [0, .82, 0], P1 = [-.78, 3.3, 0], P2 = [1.72, 3.98, 0];
    k.add(g, k.box(.3, .5, .06, .02), paint, { p: [0, .68, .15] });                   // base yoke
    k.add(g, k.box(.3, .5, .06, .02), paint, { p: [0, .68, -.15] });
    for (const [P, len] of [[P0, .42], [P1, .44]]) {
      k.add(g, k.cyl(.11, .11, len, { seg: 24 }), chrome, { p: P, r: [Math.PI / 2, 0, 0] });
      for (const z of [-1, 1]) k.add(g, k.cyl(.15, .15, .06, { seg: 24 }), dark, { p: [P[0], P[1], z * (len / 2 + .03)], r: [Math.PI / 2, 0, 0] });
    }
    for (const z of [-.12, .12]) {
      g.add(strut(k, [P0[0], P0[1], z], [P1[0], P1[1], z], .055, paint));
      g.add(strut(k, [P1[0], P1[1], z * .8], [P2[0], P2[1], z * .8], .05, paint));
    }
    g.add(helix(k, [.26, .5, 0], [-.3, 2.2, 0], .07, 16, .016, chrome));              // springs
    g.add(helix(k, [-.42, 3.4, 0], [.62, 3.68, 0], .06, 12, .014, chrome));                // between the upper rods
    // the head: knuckle, then a shade turned down toward the viewer
    k.add(g, k.sphere(.13), chrome, { p: P2 });
    const head = k.group([], { p: P2 });
    head.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(.38, -.78, .5).normalize());
    const prof = [[.16, -.1], [.2, 0], [.26, .1], [.33, .26], [.5, .58], [.74, .9], [.88, 1.08], [.92, 1.14]];
    k.add(head, k.lathe(prof), paint);
    k.add(head, k.lathe(prof.map(([r, y]) => [r * .96, y + .01])), k.matte('#fff4dc', .5, { side: T.BackSide, emissive: '#ffd98a', emissiveIntensity: .45 }));
    k.add(head, k.torus(.92, .03, { rs: 10 }), chrome, { p: [0, 1.14, 0], r: [Math.PI / 2, 0, 0] });
    k.add(head, k.sphere(.3), k.glow('#fff1cf', 2.4), { p: [0, .72, 0] });
    k.add(head, k.cyl(.12, .12, .3, { seg: 20 }), dark, { p: [0, -.08, 0] });
    g.add(head);
    g.add(k.cord([[-.35, .12, -1.0], [-.5, .04, -1.5], [-.1, .04, -2.0], [.5, .04, -2.2]], .045));
    g.rotation.y = .12;
    return g;
  },

  // Over-ear headphones standing on their cushions: purple cups, padded band, aluminium sliders.
  headphones(k) {
    const g = k.group(), T = k.THREE;
    const shell = k.gloss('#6b4ce2'), pad = k.plastic('#26252c', { rough: .7, coat: .15 }), alu = k.aluminum(), dark = k.plastic('#1d1d22', { rough: .5 });
    const yc = .98, cx = 1.5;
    const cupProf = [[0, -.02], [.72, -.02], [.8, .03], [.84, .14], [.84, .32], [.8, .45], [.7, .53], [.5, .58], [0, .6]];
    for (const side of [-1, 1]) {
      const cup = k.group([], { p: [side * (cx - .28), yc, 0], r: [0, 0, -side * Math.PI / 2] });   // local +y points outward
      k.add(cup, k.lathe(cupProf), shell, { s: [1.13, 1, 1] });
      k.add(cup, k.rcyl(.48, .06, .03), alu, { p: [0, .56, 0], s: [1.13, 1, 1] });                  // outer plate
      k.add(cup, k.torus(.6, .21, { rs: 16, ts: 48 }), pad, { p: [0, -.1, 0], r: [Math.PI / 2, 0, 0], s: [1.13, 1, .85] });
      k.add(cup, k.disc(.5), k.fabric('#18181d', { scale: .4 }), { p: [0, -.12, 0], r: [Math.PI / 2, 0, 0], s: [1.13, 1, 1] });
      g.add(cup);
      // yoke around the cup, slider and band end
      k.add(g, k.torus(1.0, .05, { arc: Math.PI, rs: 10 }), dark, { p: [side * (cx - .02), yc, 0], r: [0, Math.PI / 2, 0], s: [1, 1.08, 1] });
      for (const z of [-1, 1]) k.add(g, k.cyl(.09, .09, .1, { seg: 20 }), alu, { p: [side * (cx - .02), yc, z * 1.02], r: [Math.PI / 2, 0, 0] });
      k.add(g, k.cyl(.05, .05, .5, { seg: 16 }), alu, { p: [side * cx, 2.33, 0], s: [1, 1, 2] });
      k.add(g, k.box(.16, .14, .3, .05), dark, { p: [side * cx, 2.1, 0] });
    }
    const band = [], cush = [];
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI; band.push([Math.cos(a) * cx, 2.55 + Math.sin(a) * 1.3, 0]); }
    for (let i = 0; i <= 30; i++) { const a = .5 + i / 30 * (Math.PI - 1); cush.push([Math.cos(a) * (cx - .16), 2.55 + Math.sin(a) * 1.14, 0]); }
    k.add(g, k.tube(band, .1, { caps: true, seg: 120 }), shell, { s: [1, 1, 2.3] });
    k.add(g, k.tube(cush, .11, { caps: true, seg: 90 }), pad, { s: [1, 1, 1.9] });
    k.add(g, k.sphere(.035), k.glow('#5ff3ff', 2.5), { p: [cx + .34, yc - .5, .45] });   // status light
    return g;
  },

  // A desk globe: continents on a tilted sphere, a brass half-meridian and a turned walnut base.
  globe(k) {
    const g = k.group(), T = k.THREE;
    const brass = k.brass(), t = k.deg(23.5), Rg = 1.3, Rm = 1.44;
    const n = [Math.sin(t), Math.cos(t)], C = [Rm * n[0], 1.24 + Rm * n[1], 0];     // south bearing sits right over the stem
    const wood = k.wood('walnut', { varnish: .9, rough: .4 });
    wood.map.center.set(.5, .5); wood.map.rotation = Math.PI / 2; wood.map.repeat.set(1, 3);              // turned rings, not rays
    k.add(g, k.lathe([[0, 0], [1.05, 0], [1.09, .05], [1.07, .15], [.96, .21], [.9, .28], [.66, .34], [.4, .39], [.3, .45], [0, .46]]), wood);
    k.add(g, k.lathe([[0, .44], [.15, .44], [.13, .5], [.08, .56], [.065, .8], [.09, .9], [.1, .95], [.07, 1.02], [.06, 1.18], [.09, 1.22], [0, 1.26]]), brass);
    // the half meridian, from the south pole round the upper left to the north pole
    const band = new T.Shape();
    band.absarc(0, 0, Rm + .075, 0, Math.PI, false); band.absarc(0, 0, Rm - .075, Math.PI, 0, true); band.closePath();
    k.add(g, k.extrude(band, .045, { bevel: .015, curve: 64 }), brass, { p: C, r: [0, 0, Math.PI / 2 - t] });
    for (const s of [-1, 1]) {
      k.add(g, k.sphere(.085, { w: 20, h: 14 }), brass, { p: [C[0] + s * Rm * n[0], C[1] + s * Rm * n[1], 0] });
      g.add(strut(k, [C[0] + s * Rg * .98 * n[0], C[1] + s * Rg * .98 * n[1], 0], [C[0] + s * Rm * n[0], C[1] + s * Rm * n[1], 0], .03, brass, 10));
    }
    k.add(g, k.sphere(.07, { w: 16, h: 12 }), brass, { p: [C[0] + (Rm + .12) * n[0], C[1] + (Rm + .12) * n[1], 0] });   // finial
    // the map
    const map = k.painted(1024, 512, (c, w, h) => {
      const X = lon => (lon + 180) / 360 * w, Y = lat => (90 - lat) / 180 * h;
      const sea = c.createLinearGradient(0, 0, 0, h);
      sea.addColorStop(0, '#2d6fbf'); sea.addColorStop(.5, '#4a9ae3'); sea.addColorStop(1, '#2d6fbf');
      c.fillStyle = sea; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 1.5;
      for (let lon = -180; lon <= 180; lon += 30) { c.beginPath(); c.moveTo(X(lon), 0); c.lineTo(X(lon), h); c.stroke(); }
      for (let lat = -60; lat <= 60; lat += 30) { c.beginPath(); c.moveTo(0, Y(lat)); c.lineTo(w, Y(lat)); c.stroke(); }
      const trace = L => { c.moveTo(X(L[0]), Y(L[1])); for (let i = 2; i < L.length; i += 2) c.lineTo(X(L[i]), Y(L[i + 1])); c.closePath(); };
      const fill = (list, col, edge) => { for (const L of list) { c.beginPath(); trace(L); c.fillStyle = col; c.fill(); if (edge) { c.strokeStyle = edge; c.lineWidth = 2; c.stroke(); } } };
      fill(LAND, '#8ccf62', '#5d9c43');
      c.save(); c.beginPath(); for (const L of LAND) trace(L); c.clip();
      const blob = (lon, lat, rx, ry, col) => {
        c.save(); c.translate(X(lon), Y(lat)); c.scale(rx / ry, 1);
        const r = ry / 180 * h, gr = c.createRadialGradient(0, 0, 0, 0, 0, r);
        gr.addColorStop(0, col); gr.addColorStop(.6, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
        c.fillStyle = gr; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.restore();
      };
      const sand = 'rgba(232,205,130,.95)', forest = 'rgba(70,150,62,.8)';
      for (const b of [[2, 23, 20, 8], [22, 24, 13, 7], [46, 22, 8, 7], [60, 30, 8, 4], [105, 43, 13, 5], [128, -25, 13, 8], [20, -24, 5, 4], [-112, 34, 6, 5]]) blob(...b, sand);
      for (const b of [[-60, -6, 14, 9], [22, -1, 9, 6], [95, 60, 30, 8], [-100, 55, 18, 6], [102, 18, 7, 7]]) blob(...b, forest);
      c.restore();
      fill(ICE, '#f3f7fa', '#c9d6e0');
      fill(LAKES, '#3f8bd8');
      c.strokeStyle = 'rgba(255,240,200,.55)'; c.lineWidth = 2.5; c.setLineDash([10, 8]);
      c.beginPath(); c.moveTo(0, Y(0)); c.lineTo(w, Y(0)); c.stroke();
    }, { rough: .38, coat: .7 });
    const ax = k.group([], { p: C, r: [0, 0, -t] });
    k.add(ax, k.sphere(Rg, { w: 72, h: 48 }), map, { r: [0, k.deg(-52), 0] });      // the Atlantic faces the camera
    g.add(ax);
    g.rotation.y = k.deg(30);                                                         // meridian square to the camera
    return g;
  },

  // An open silver laptop: a lit, colourful desktop with a browser of forty-seven tabs (one playing music), dark keys, a glass trackpad.
  laptop(k) {
    const g = k.group(), T = k.THREE;
    const alu = k.metal('#bfc4cb', .32), keyMat = k.plastic('#26282d', { rough: .55, coat: .2 });
    const W = 4.4, D = 3.0, flat = geo => { geo.rotateX(-Math.PI / 2); return geo; };
    k.add(g, flat(k.slab(W, D, .16, .2, .05)), alu, { p: [0, .08, 0] });
    k.add(g, k.box(3.86, .02, 1.5, .01), k.matte('#3a3d43', .6), { p: [0, .158, -.66] });            // keyboard well
    const keys = [], pitch = .285;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 13; c++) {
      if (r === 4 && c > 3 && c < 9) continue;                                                     // room for the space bar
      keys.push({ p: [(c - 6) * pitch + (r % 2) * .05, .18, -1.24 + r * .29] });
    }
    for (let c = 0; c < 14; c++) keys.push({ p: [(c - 6.5) * .265, .18, -1.47], s: [.9, 1, .45] }); // function row
    g.add(k.instances(k.box(.24, .05, .24, .035), keyMat, keys));
    k.add(g, k.box(1.35, .05, .24, .035), keyMat, { p: [0, .18, -.08] });                          // space bar
    k.add(g, flat(k.slab(1.75, 1.05, .02, .09, .006)), k.metal('#aeb3ba', .22), { p: [0, .163, .82] });   // trackpad
    k.add(g, k.cyl(.075, .075, 3.5, { seg: 20 }), k.metal('#6e737b', .4), { p: [0, .17, -1.45], r: [0, 0, Math.PI / 2] });  // hinge
    // the lid, opened a little past upright
    const lid = k.group([], { p: [0, .2, -1.46], r: [k.deg(-16), 0, 0] });
    k.add(lid, k.slab(W, 2.9, .1, .2, .035), alu, { p: [0, 1.45, -.05] });
    k.add(lid, k.slab(W - .08, 2.82, .02, .16, .008), k.gloss('#0c0d11'), { p: [0, 1.46, .006] });
    const screen = k.painted(1024, 640, (c, w, h) => {
      const bg = c.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#3b1c8c'); bg.addColorStop(.45, '#c2338f'); bg.addColorStop(1, '#ff9a3c');
      c.fillStyle = bg; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) {                                                                  // soft waves
        c.fillStyle = `rgba(255,255,255,${.06 + i * .03})`; c.beginPath(); c.moveTo(0, h * (.55 + i * .1));
        for (let x = 0; x <= w; x += 16) c.lineTo(x, h * (.55 + i * .1) + Math.sin(x / w * 6 + i) * h * .05);
        c.lineTo(w, h); c.lineTo(0, h); c.fill();
      }
      const rr = (x, y, ww, hh, r, col) => { c.fillStyle = col; c.beginPath(); c.roundRect(x, y, ww, hh, r); c.fill(); };
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, w, 22);                                     // menu bar
      // the browser window
      const bx = 110, by = 70, bw = 700, bh = 450;
      rr(bx + 8, by + 12, bw, bh, 16, 'rgba(0,0,0,.25)');
      rr(bx, by, bw, bh, 16, '#f4f5f8');
      rr(bx, by, bw, 62, 16, '#dfe2ea'); c.fillStyle = '#dfe2ea'; c.fillRect(bx, by + 40, bw, 22);
      for (const [i, col] of ['#ff5f57', '#febc2e', '#28c840'].entries()) { c.fillStyle = col; c.beginPath(); c.arc(bx + 20 + i * 18, by + 18, 6, 0, 7); c.fill(); }
      const hues = ['#4285f4', '#ea4335', '#fbbc05', '#34a853', '#a142f4', '#00acc1', '#ff7043'];
      for (let i = 0; i < 47; i++) {                                                                 // forty-seven tabs
        const tx = bx + 78 + i * 13.2;
        rr(tx, by + 8, 12, 24, 4, i === 12 ? '#ffffff' : '#eef0f5');
        c.fillStyle = hues[i % hues.length]; c.beginPath(); c.arc(tx + 6, by + 20, 3.5, 0, 7); c.fill();
      }
      c.fillStyle = '#e64a8a'; c.font = 'bold 26px Nunito, sans-serif'; c.fillText('♪', bx + 78 + 12 * 13.2 - 2, by + 60);  // the one playing music
      rr(bx + 16, by + 40, bw - 32, 16, 8, '#ffffff');
      rr(bx + 24, by + 80, bw - 48, 150, 12, '#6f5cf0');                                            // page: a banner and text
      c.fillStyle = '#ffd35a'; c.beginPath(); c.arc(bx + 110, by + 155, 44, 0, 7); c.fill();
      k.text(c, 'Re: Re: Re: printer', bx + 410, by + 150, { size: 38, weight: 800, color: '#ffffff', font: 'Nunito, sans-serif' });
      for (let i = 0; i < 6; i++) rr(bx + 24, by + 250 + i * 30, (i % 3 === 2 ? .55 : .9) * (bw - 48), 12, 6, '#c9cdd8');
      // a music player widget and the dock
      rr(840, 90, 160, 190, 18, 'rgba(255,255,255,.82)');
      rr(858, 108, 124, 100, 12, '#23c4b0');
      k.text(c, '♫', 920, 158, { size: 56, color: '#ffffff' });
      rr(858, 222, 124, 8, 4, '#d0d4de'); rr(858, 222, 70, 8, 4, '#e64a8a');
      rr(300, 560, 424, 64, 20, 'rgba(255,255,255,.35)');
      hues.forEach((col, i) => rr(318 + i * 58, 570, 44, 44, 11, col));
    }, { glow: .95, rough: .25 });
    k.add(lid, k.plane(3.98, 2.46), screen, { p: [0, 1.52, .018], shadow: false });
    k.add(lid, k.sphere(.025, { w: 12, h: 8 }), k.gloss('#22252c'), { p: [0, 2.83, .02] });        // camera
    g.add(lid);
    g.userData.view = { az: 26, el: 22 };
    return g;
  },

  // A gaming PC tower: black frame, glass front and side, RGB fans, a glowing pump, rainbow RAM, a big graphics card.
  gamingpc(k) {
    const g = k.group(), T = k.THREE;
    const W = 2.3, H = 4.8, D = 4.6;
    const black = k.metal('#1b1c21', .42), plastic = k.plastic('#16171b', { rough: .5 }), pcb = k.matte('#1d2026', .7);
    const glass = k.glass('#8e98ad', { opacity: .1, env: 1.3 });
    const rainbow = (a0, glow = 1.7) => k.painted(128, 128, (c, w, h) => {
      const gr = c.createConicGradient(a0, w / 2, h / 2);
      ['#ff2d55', '#ff9f0a', '#ffe14d', '#32d74b', '#1ad6ff', '#3d6bff', '#bf5af2', '#ff2d55'].forEach((col, i, a) => gr.addColorStop(i / (a.length - 1), col));
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }, { glow });
    const stripe = (vertical, glow = 1.6) => k.painted(vertical ? 8 : 128, vertical ? 128 : 8, (c, w, h) => {
      const gr = vertical ? c.createLinearGradient(0, 0, 0, h) : c.createLinearGradient(0, 0, w, 0);
      ['#ff2d55', '#ff9f0a', '#ffe14d', '#32d74b', '#1ad6ff', '#3d6bff', '#bf5af2'].forEach((col, i, a) => gr.addColorStop(i / (a.length - 1), col));
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }, { glow });
    // the frame
    k.add(g, k.box(W, .18, D, .05), black, { p: [0, .19, 0] });
    k.add(g, k.box(W, .2, D, .06), black, { p: [0, H - .1, 0] });
    k.add(g, k.box(.1, H - .3, D - .02), black, { p: [-W / 2 + .05, H / 2, 0] });
    k.add(g, k.box(W - .02, H - .3, .1), black, { p: [0, H / 2, -D / 2 + .05] });
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1]]) k.add(g, k.box(.12, H - .3, .12, .03), black, { p: [x * (W / 2 - .06), H / 2, z * (D / 2 - .06)] });
    for (const z of [-1, 1]) k.add(g, k.box(W - .3, .1, .4, .04), k.rubber(), { p: [0, .05, z * (D / 2 - .5)] });
    // inside: board, pump, RAM, graphics card, PSU cover
    const bx = -W / 2 + .1;
    k.add(g, k.box(.05, 3.2, 3.3), pcb, { p: [bx + .03, 3.0, -.45] });
    k.add(g, k.box(.14, .32, 1.2, .04), k.metal('#3b3f47', .35), { p: [bx + .12, 4.15, -.8] });
    k.add(g, k.box(.14, 1.1, .32, .04), k.metal('#3b3f47', .35), { p: [bx + .12, 3.35, -1.5] });
    k.add(g, k.box(.3, 1.0, .4, .05), plastic, { p: [bx + .18, 3.85, -1.95] });
    k.add(g, k.cyl(.42, .42, .3, { seg: 40 }), plastic, { p: [bx + .2, 3.35, -.72], r: [0, 0, Math.PI / 2] });
    k.add(g, k.ring(.28, .4, 48), rainbow(0, 2), { p: [bx + .356, 3.35, -.72], r: [0, Math.PI / 2, 0], shadow: false });
    k.add(g, k.disc(.28, 32), k.gloss('#0e0f13'), { p: [bx + .355, 3.35, -.72], r: [0, Math.PI / 2, 0] });
    const ramX = bx + .06 + .27;
    g.add(k.instances(k.box(.54, 1.3, .08, .02), k.metal('#2c2f36', .4), [0, 1, 2, 3].map(i => ({ p: [ramX, 3.3, .08 + i * .16] }))));
    const ramLight = stripe(true, 1.8);
    for (let i = 0; i < 4; i++) k.add(g, k.box(.1, 1.26, .09), ramLight, { p: [ramX + .3, 3.3, .08 + i * .16], shadow: false });
    const gpuX = bx + .06 + .64;
    k.add(g, k.box(1.26, .5, 2.95, .05), k.metal('#2a2d34', .38), { p: [gpuX, 2.05, -.15] });
    k.add(g, k.box(1.22, .05, 2.9, .02), k.metal('#454a54', .3), { p: [gpuX, 2.33, -.15] });
    k.add(g, k.box(.02, .07, 2.5, .01), stripe(false, 1.9), { p: [gpuX + .64, 2.14, -.15], shadow: false });
    k.add(g, k.slab(.7, .16, .02, .05, .006), k.metal('#9aa2ae', .25), { p: [gpuX + .64, 1.96, .5], r: [0, Math.PI / 2, 0] });
    k.add(g, k.box(W - .22, .95, 3.75, .04), plastic, { p: [0, .755, -.4] });
    k.add(g, k.box(.02, .035, 3.5), k.glow('#bff6ff', 1.4), { p: [W / 2 - .12, 1.2, -.4], shadow: false });
    k.add(g, k.tube([[bx + .35, 3.55, -.6], [-.4, 3.95, .1], [0, 3.95, 1.1], [.15, 3.7, 1.75]], .06, { caps: true }), plastic);   // cooler hoses
    k.add(g, k.tube([[bx + .35, 3.2, -.55], [-.35, 3.7, .2], [-.05, 3.7, 1.1], [.1, 3.3, 1.75]], .06, { caps: true }), plastic);
    k.add(g, k.box(1.3, 3.9, .22, .04), plastic, { p: [.1, 2.35, 1.82] });                       // radiator behind the front fans
    // fans: three up the front, one at the back
    const blade = k.box(.34, .15, .018, .008), bladeMat = k.plastic('#3a3f49', { rough: .35 });
    const frame = k.extrude(k.roundRect(1.2, 1.2, .12), .2, { bevel: .02, holes: [k.circle(.57)] });
    const fan = (p, a0) => {
      const f = k.group([], { p });
      k.add(f, frame, plastic);
      k.add(f, k.ring(.5, .58, 64), rainbow(a0), { p: [0, 0, .125], shadow: false });
      f.add(k.instances(blade, bladeMat, [0, 1, 2, 3, 4, 5, 6].map(i => { const a = i / 7 * Math.PI * 2; return { p: [Math.cos(a) * .32, Math.sin(a) * .32, 0], r: [.5, 0, a], order: 'ZYX' }; })));
      k.add(f, k.cyl(.16, .16, .1, { seg: 32 }), plastic, { r: [Math.PI / 2, 0, 0] });
      k.add(f, k.disc(.07, 24), k.glow('#ffffff', 1.2), { p: [0, 0, .052] });
      g.add(f);
    };
    [1.05, 2.35, 3.65].forEach((y, i) => fan([.1, y, D / 2 - .3], i * 2.1));
    fan([.12, 3.55, -D / 2 + .24], 1);
    // glass, power button, a nameless plate
    k.add(g, k.box(.03, H - .36, D - .2), glass, { p: [W / 2 - .03, H / 2, 0], shadow: false });
    k.add(g, k.box(W - .2, H - .36, .03), glass, { p: [0, H / 2, D / 2 - .03], shadow: false });
    k.add(g, k.torus(.09, .022, { rs: 8, ts: 32 }), k.glow('#bff6ff', 1.8), { p: [.65, H + .005, D / 2 - .45], r: [Math.PI / 2, 0, 0] });
    for (const x of [-.1, .15]) k.add(g, k.box(.16, .02, .07, .01), k.matte('#050506', .5), { p: [x, H + .002, D / 2 - .45] });
    k.add(g, k.box(.03, .05, D - .5), stripe(false, 1.8), { p: [W / 2 - .16, H - .26, 0], shadow: false });   // light strip under the roof
    g.userData.view = { az: 44, el: 15 };
    return g;
  },

  // A vintage portable typewriter in seafoam green: round glass-top keys on stalks, the typebar fan, ribbon spools, a platen with a typed sheet.
  typewriter(k) {
    const g = k.group(), T = k.THREE;
    const body = k.gloss('#6cc9ad'), chrome = k.chrome(), black = k.plastic('#141518', { rough: .45 }), rubber = k.plastic('#111214', { rough: .6, coat: .1 });
    // the body: a side profile (z, y) pushed out across the width
    const prof = new T.Shape();
    prof.moveTo(1.1, .15); prof.lineTo(1.1, .5); prof.quadraticCurveTo(1.06, .7, .86, .86); prof.lineTo(.45, 1.2);
    prof.quadraticCurveTo(.34, 1.32, .15, 1.34); prof.lineTo(-1.45, 1.34); prof.quadraticCurveTo(-1.76, 1.34, -1.78, 1.05); prof.lineTo(-1.8, .15); prof.closePath();
    const shell = k.extrude(prof, 4.0, { bevel: .14 }); shell.rotateY(-Math.PI / 2);
    k.add(g, shell, body);
    const flat = geo => { geo.rotateX(-Math.PI / 2); return geo; };
    k.add(g, flat(k.slab(4.2, 1.7, .12, .3, .04)), body, { p: [0, .06, 1.95] });                  // keyboard base plate
    k.add(g, k.slab(1.3, .2, .03, .06, .01), chrome, { p: [0, 1.13, .74], r: [k.deg(-48.8), 0, 0] });   // nameplate, blank
    // keys: four raked rows of round keys, stalks running back into the machine
    const rows = ['ZXCVBNM,.?', 'ASDFGHJKL;:', 'QWERTYUIOP½', '234567890-='];
    const atlas = k.painted(512, 384, (c, w, h) => {
      c.fillStyle = '#17181c'; c.fillRect(0, 0, w, h);
      rows.join('').split('').forEach((ch, i) => k.text(c, ch, (i % 8) * 64 + 32, Math.floor(i / 8) * 64 + 34, { size: 34, weight: 700, color: '#f4efe2', font: 'Nunito, sans-serif' }));
    }, { rough: .15, coat: 1 });
    const caps = [], rims = [], stalks = [], faces = [];
    let n = 0;
    rows.forEach((row, i) => {
      const z = 2.3 - i * .3, y = .52 + i * .14, off = -(row.length - 1) / 2 * .37 + (i % 2 ? .08 : -.04);
      row.split('').forEach((ch, j) => {
        const x = off + j * .37;
        caps.push({ p: [x, y - .06, z] }); rims.push({ p: [x, y - .005, z], r: [Math.PI / 2, 0, 0] });
        const a = new T.Vector3(x, y - .06, z), b = new T.Vector3(x * .96, .3 + i * .06, 1.2), d = b.clone().sub(a);
        const e = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize()));
        stalks.push({ p: a.clone().add(b).multiplyScalar(.5).toArray(), r: [e.x, e.y, e.z], s: [1, d.length(), 1] });
        const f = new T.CircleGeometry(.118, 20), uv = f.attributes.uv, col = n % 8, rw = Math.floor(n / 8);
        for (let q = 0; q < uv.count; q++) uv.setXY(q, (col + uv.getX(q)) / 8, 1 - (rw + 1) / 6 + uv.getY(q) / 6);
        f.rotateX(-Math.PI / 2); f.translate(x, y + .013, z); faces.push(f); n++;
      });
    });
    g.add(k.instances(k.cyl(.022, .022, 1, { seg: 8 }), k.metal('#2b2d31', .4), stalks));
    g.add(k.instances(k.rcyl(.14, .07, .025, { seg: 24 }), black, caps));
    g.add(k.instances(k.torus(.145, .024, { rs: 8, ts: 28 }), chrome, rims));
    k.add(g, k.merge(faces), atlas, { shadow: false });
    k.add(g, k.box(2.7, .07, .15, .03), chrome, { p: [0, .38, 2.62] });                         // space bar
    for (const x of [-1.15, 1.15]) g.add(strut(k, [x, .36, 2.58], [x, .28, 1.25], .03, k.metal('#2b2d31', .4), 8));
    // on the deck: the typebar fan and two ribbon spools
    const fanC = [0, 1.5, -.72];
    k.add(g, k.disc(.95, 40), k.matte('#1a1b1f', .6), { p: [fanC[0], 1.485, fanC[2]], r: [-Math.PI / 2, 0, 0], s: [1, 1, 1] });
    g.add(k.instances(k.box(.62, .03, .04, .01), k.metal('#9aa0a8', .3), Array.from({ length: 25 }, (_, i) => {
      const a = k.deg(12 + i * 6.5); return { p: [Math.cos(a) * .58, 1.52, fanC[2] + Math.sin(a) * .58], r: [0, -a, 0] };
    })));
    for (const x of [-1.45, 1.45]) {
      k.add(g, k.rcyl(.37, .08, .03), chrome, { p: [x, 1.46, -.4] });
      k.add(g, k.rcyl(.31, .06, .01), k.matte('#c92a2a', .6), { p: [x, 1.52, -.4] });
      k.add(g, k.rcyl(.31, .07, .02), k.matte('#1c1c20', .55), { p: [x, 1.57, -.4] });
      k.add(g, k.rcyl(.09, .1, .03, { seg: 20 }), chrome, { p: [x, 1.6, -.4] });
    }
    // the carriage: platen, knobs, bail, return lever, paper table
    const pc = [1.95, -1.05], pr = .33;
    k.add(g, k.box(4.4, .26, .7, .08), body, { p: [0, 1.58, -1.25] });
    k.add(g, k.cyl(pr, pr, 3.9, { seg: 40 }), rubber, { p: [0, pc[0], pc[1]], r: [0, 0, Math.PI / 2] });
    for (const sgn of [-1, 1]) {
      k.add(g, k.box(.14, .75, .95, .06), body, { p: [sgn * 2.02, 1.9, -1.15] });
      k.add(g, k.cyl(.3, .3, .26, { seg: 22 }), k.plastic('#141518', { rough: .45, flatShading: true }), { p: [sgn * 2.24, pc[0], pc[1]], r: [0, 0, Math.PI / 2] });
      k.add(g, k.cyl(.12, .12, .02, { seg: 24 }), chrome, { p: [sgn * 2.38, pc[0], pc[1]], r: [0, 0, Math.PI / 2] });
      k.add(g, k.cyl(.045, .045, .1, { seg: 12 }), rubber, { p: [sgn * .95, 2.2, -.86], r: [0, 0, Math.PI / 2] });
    }
    k.add(g, k.cyl(.02, .02, 3.5, { seg: 10 }), chrome, { p: [0, 2.2, -.86], r: [0, 0, Math.PI / 2] });     // paper bail
    k.add(g, k.box(.5, .1, .03, .01), chrome, { p: [0, 1.92, -.69] });                                      // line guide
    k.add(g, k.tube([[-2.05, 2.1, -1.0], [-2.2, 2.25, -.62], [-2.36, 2.36, -.22]], .035, { caps: true }), chrome);
    k.add(g, k.box(.12, .05, .36, .02), chrome, { p: [-2.4, 2.38, -.08], r: [0, .25, 0] });
    k.add(g, k.slab(3.8, 1.6, .05, .1, .015), body, { p: [0, 2.97, -1.15], r: [k.deg(-20), 0, 0] });
    // the sheet: wraps the front of the platen, then rises and leans back on the paper table
    const lean = k.deg(20), a0 = k.deg(-35), R = pr + .012, straight = 2.2, arcL = R * (lean - a0), Lp = arcL + straight;
    const sheet = new T.PlaneGeometry(2.5, 1, 1, 40), pos = sheet.attributes.position, uvs = sheet.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const v = uvs.getY(i), sL = v * Lp;
      let y, z;
      if (sL < arcL) { const th = a0 + sL / R; y = pc[0] + R * Math.sin(th); z = pc[1] + R * Math.cos(th); }
      else { const e = sL - arcL; y = pc[0] + R * Math.sin(lean) + e * Math.cos(lean); z = pc[1] + R * Math.cos(lean) - e * Math.sin(lean); }
      pos.setXYZ(i, pos.getX(i) - .15, y, z);
    }
    sheet.computeVertexNormals();
    const paper = k.painted(512, 512, (c, w, h) => {
      c.fillStyle = '#fdfcf7'; c.fillRect(0, 0, w, h);
      const lines = ['Dear reader,', 'No spell check.', 'No backspace.', 'No fear.'];              // the carriage has just returned
      lines.forEach((t, i) => k.text(c, t, 60, 262 + i * 32, { size: 27, weight: 700, color: '#232329', font: '"Courier New", Courier, monospace', align: 'left' }));
    }, { rough: .9, side: T.DoubleSide });
    k.add(g, sheet, paper);
    g.userData.view = { az: 28, el: 22 };
    return g;
  },
};
