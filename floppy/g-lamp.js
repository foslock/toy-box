// 2000: LAMP v1.2. A Windows 98 window with a storm in it. Point the light; ships turn for home.
const GX = 12, GY = 34, GW = 616, GH = 330;       // game area inside the window
const LX = 548, LY = 112;                         // the lamp, in game coords
const NIGHT = 80;

export function lamp(api) {
  let t = 0, th = 2.6, ships = [], saved = 0, lost = 0, nextShip = 2, dawn = 0, intro = 4.5, flash = 0, ended = 0, ptrOn = false, demoAim = 0;
  const rain = Array.from({ length: 90 }, (_, i) => ({ x: (i * 137) % GW, y: (i * 71) % GH, s: 240 + (i % 7) * 30 }));
  function spawn() {
    const y = 236 + Math.random() * 90;
    ships.push({ x: -24, y, vx: 15 + Math.random() * 8 + Math.min(6, t / 14), vy: (Math.random() - 0.5) * 2, lit: 0, state: 'sail', k: 0, size: 0.8 + (y - 230) / 200 });
  }
  const clampTh = (a) => Math.max(1.72, Math.min(3.25, a));
  function aimAt(px, py) {
    const gx = px - GX, gy = py - GY;
    if (gy < LY - 20) return;
    th = clampTh(Math.atan2(gy - LY, gx - LX));
  }
  function update(dt) {
    t += dt; if (intro > 0) intro -= dt; if (flash > 0) flash -= dt;
    if (ended) { ended += dt; return; }
    const rot = (api.held.has('left') || api.held.has('up') ? 1 : 0) - (api.held.has('right') || api.held.has('down') ? 1 : 0);
    th = clampTh(th + rot * 0.95 * dt);
    if (api.demo) { const s = ships.find((q) => q.state === 'sail'); if (s) { const want = Math.atan2(s.y - LY, s.x - LX); th += Math.sign(want - th) * Math.min(Math.abs(want - th), 1.2 * dt); } }
    if (t > NIGHT && !dawn) { dawn = 0.01; api.sfx.chord([294, 370, 440, 587], 3, 0.025); }
    if (dawn) dawn += dt;
    if (!dawn) { nextShip -= dt; if (nextShip <= 0) { spawn(); nextShip = Math.max(3.6, 7.5 - t / 16) + Math.random() * 2; } }
    if (Math.random() < dt * 0.06) { flash = 0.18; api.sfx.wave(); }
    for (const s of ships) {
      if (s.state === 'sail') {
        s.x += s.vx * dt; s.y += s.vy * dt;
        const ang = Math.atan2(s.y - LY, s.x - LX), d = Math.hypot(s.x - LX, s.y - LY);
        const hit = Math.abs(ang - th) < 0.06 + 12 / d;
        if (hit) { s.lit += dt; if (s.lit > 0.65) { s.state = 'home'; saved++; api.sfx.horn(); } }
        else s.lit = Math.max(0, s.lit - dt * 0.5);
        if (dawn && s.state === 'sail') { s.state = 'home'; saved++; }
        if (s.state === 'sail' && s.x > 432 + (s.y - 240) * 0.35) { s.state = 'wreck'; lost++; api.sfx.crash(); }
      } else if (s.state === 'home') { s.k += dt; s.x -= 12 * dt; s.y += 6 * dt; }
      else if (s.state === 'wreck') s.k += dt;
    }
    ships = ships.filter((s) => !(s.k > 6));
    if (dawn > 6 && !ended) { ended = 0.01; api.done(); }
  }
  function drawShip(c, s) {
    const a = s.state === 'home' ? Math.max(0, 1 - s.k / 6) : s.state === 'wreck' ? Math.max(0, 1 - s.k / 3) : 1;
    if (a <= 0) return;
    c.save(); c.translate(GX + s.x, GY + s.y + Math.sin(t * 2 + s.x * 0.05) * 1.5); c.globalAlpha = a; c.scale(s.size, s.size);
    if (s.state === 'home') c.scale(-1, 1);
    if (s.state === 'wreck') c.rotate(Math.min(0.9, s.k * 0.6)), c.translate(0, s.k * 4);
    c.fillStyle = '#1a1a22'; c.beginPath(); c.moveTo(-16, -4); c.lineTo(16, -4); c.lineTo(11, 4); c.lineTo(-12, 4); c.closePath(); c.fill();
    c.fillRect(-6, -11, 10, 7); c.fillRect(-1, -24, 2, 14);
    c.fillStyle = s.lit > 0 || s.state === 'home' ? '#ffe9a0' : '#c89a3a'; c.fillRect(-3, -9, 2, 2); c.fillRect(1, -9, 2, 2);
    c.fillStyle = s.state === 'home' ? '#40ff70' : '#ff4040'; c.fillRect(-1, -26, 2, 2);
    if (s.state === 'sail' && s.lit > 0) { c.strokeStyle = `rgba(255,240,180,${s.lit})`; c.lineWidth = 1.5; c.beginPath(); c.arc(0, -8, 20, 0, 7); c.stroke(); }
    c.restore();
  }
  function draw(scr) {
    const c = scr.ctx;
    // desktop + window
    c.fillStyle = '#008080'; c.fillRect(0, 0, 640, 400);
    const bevel = (x, y, w, h, up = true) => { c.fillStyle = '#c0c0c0'; c.fillRect(x, y, w, h); c.fillStyle = up ? '#ffffff' : '#808080'; c.fillRect(x, y, w, 2); c.fillRect(x, y, 2, h); c.fillStyle = up ? '#808080' : '#ffffff'; c.fillRect(x, y + h - 2, w, 2); c.fillRect(x + w - 2, y, 2, h); };
    bevel(6, 6, 628, 388);
    const tg = c.createLinearGradient(10, 0, 630, 0); tg.addColorStop(0, '#000080'); tg.addColorStop(1, '#1084d0');
    c.fillStyle = tg; c.fillRect(10, 10, 620, 22);
    c.fillStyle = '#ffff60'; c.fillRect(15, 14, 10, 14); c.fillStyle = '#000080'; c.fillRect(17, 16, 6, 4);
    c.font = 'bold 15px Tahoma, Verdana, sans-serif'; c.fillStyle = '#fff'; c.fillText('Lamp', 32, 26);
    for (let i = 0; i < 3; i++) { bevel(574 + i * 18, 13, 16, 15); c.fillStyle = '#000'; c.font = 'bold 11px Tahoma, Verdana, sans-serif'; c.fillText(['_', '□', '×'][i], 578 + i * 18, 25); }
    // the night
    c.save(); c.beginPath(); c.rect(GX, GY, GW, GH); c.clip();
    const d = Math.min(1, dawn / 6);
    const sky = c.createLinearGradient(0, GY, 0, GY + 220);
    sky.addColorStop(0, mix('#05070f', '#3a5890', d)); sky.addColorStop(1, mix('#151a2a', '#f0b080', d));
    c.fillStyle = sky; c.fillRect(GX, GY, GW, GH);
    if (flash > 0) { c.fillStyle = `rgba(200,210,255,${flash * 2})`; c.fillRect(GX, GY, GW, GH); }
    // sea
    const sea = c.createLinearGradient(0, GY + 205, 0, GY + GH); sea.addColorStop(0, mix('#0b1424', '#5a6a8a', d)); sea.addColorStop(1, mix('#02050b', '#2a3550', d));
    c.fillStyle = sea; c.fillRect(GX, GY + 205, GW, GH - 205);
    c.strokeStyle = mix('#1c2a44', '#90a0c0', d); c.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) { const y = GY + 212 + i * 9 + i * i * 0.4; c.beginPath(); for (let x = 0; x <= GW; x += 16) { const yy = y + Math.sin(x * 0.03 + t * (1 + i * 0.1) + i) * 2; x ? c.lineTo(GX + x, yy) : c.moveTo(GX, yy); } c.stroke(); }
    // rocks
    c.fillStyle = mix('#0a0c12', '#3a3a44', d);
    for (const [x, y, w, h] of [[440, 240, 26, 14], [462, 262, 34, 18], [452, 292, 30, 16], [480, 318, 36, 20], [470, 228, 18, 10]]) { c.beginPath(); c.moveTo(GX + x - w / 2, GY + y + h / 2); c.lineTo(GX + x - w / 4, GY + y - h / 2); c.lineTo(GX + x + w / 5, GY + y - h / 3); c.lineTo(GX + x + w / 2, GY + y + h / 2); c.fill(); }
    // foam on rocks
    c.fillStyle = 'rgba(220,230,255,.25)'; for (let i = 0; i < 6; i++) c.fillRect(GX + 436 + i * 12, GY + 248 + Math.sin(t * 3 + i) * 3 + i * 12, 10, 2);
    // cliff and lighthouse
    c.fillStyle = mix('#0e1016', '#4a4038', d); c.beginPath(); c.moveTo(GX + 500, GY + GH); c.lineTo(GX + 512, GY + 220); c.lineTo(GX + 560, GY + 200); c.lineTo(GX + GW, GY + 196); c.lineTo(GX + GW, GY + GH); c.fill();
    c.fillStyle = mix('#c8c0b0', '#f0ece0', d); c.beginPath(); c.moveTo(GX + LX - 14, GY + 204); c.lineTo(GX + LX - 9, GY + LY + 10); c.lineTo(GX + LX + 9, GY + LY + 10); c.lineTo(GX + LX + 14, GY + 204); c.fill();
    c.fillStyle = '#b03030'; for (const y of [140, 170]) c.fillRect(GX + LX - 12 + (y - 140) * 0.06, GY + y, 24 - (y - 140) * 0.12, 10);
    c.fillStyle = '#202020'; c.fillRect(GX + LX - 12, GY + LY + 6, 24, 4); c.fillRect(GX + LX - 9, GY + LY - 14, 18, 3);
    c.fillStyle = '#ffeaa0'; c.fillRect(GX + LX - 7, GY + LY - 11, 14, 17);
    // the beam
    if (!ended || dawn < 5) {
      const fl = 0.85 + Math.sin(t * 13) * 0.05;
      c.save(); c.globalCompositeOperation = 'lighter';
      const bg = c.createRadialGradient(GX + LX, GY + LY, 4, GX + LX, GY + LY, 620);
      bg.addColorStop(0, `rgba(255,236,170,${0.55 * fl * (1 - d * 0.8)})`); bg.addColorStop(1, 'rgba(255,236,170,0)');
      c.fillStyle = bg; c.beginPath(); c.moveTo(GX + LX, GY + LY);
      c.lineTo(GX + LX + Math.cos(th - 0.07) * 700, GY + LY + Math.sin(th - 0.07) * 700);
      c.lineTo(GX + LX + Math.cos(th + 0.07) * 700, GY + LY + Math.sin(th + 0.07) * 700); c.fill();
      c.fillStyle = `rgba(255,240,190,${0.5 * (1 - d)})`; c.beginPath(); c.arc(GX + LX, GY + LY - 2, 14, 0, 7); c.fill();
      c.restore();
    }
    for (const s of ships) drawShip(c, s);
    // rain
    c.strokeStyle = `rgba(170,190,230,${0.35 * (1 - d)})`; c.lineWidth = 1; c.beginPath();
    for (const r of rain) { const y = (r.y + t * r.s) % GH, x = (r.x - t * r.s * 0.25 + GW * 10) % GW; c.moveTo(GX + x, GY + y); c.lineTo(GX + x - 3, GY + y + 10); }
    c.stroke();
    if (intro > 0) msg(c, ['Keep the ships off the rocks till morning.', api.demo ? '' : 'Drag on the sea, or ← →, to point the light.'], Math.min(1, intro));
    if (ended > 1) msg(c, [`Morning. ${saved} ship${saved === 1 ? '' : 's'} came home.`, lost ? `${lost} didn't. It's alright. It's morning.` : 'Every one of them.', '', 'LAMP v1.2 by Mags Hale', 'for Dr Amis, and for the squirt'], Math.min(1, (ended - 1) / 1.5));
    c.restore();
    // status bar
    bevel(10, 366, 620, 24, false);
    c.font = '14px Tahoma, Verdana, sans-serif'; c.fillStyle = '#000';
    const left = Math.max(0, NIGHT - t);
    c.fillText(`Ships home: ${saved}`, 18, 383); c.fillText(`Lost: ${lost}`, 160, 383);
    c.fillText(dawn ? 'Morning' : `Till morning: ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, 260, 383);
    if (ended > 3) c.fillText('Press Enter to close', 470, 383);
  }
  function msg(c, lines, a) {
    c.save(); c.globalAlpha = a; c.font = '17px Tahoma, Verdana, sans-serif'; c.textAlign = 'center';
    const w = 420, h = lines.length * 24 + 20, x = GX + GW / 2 - w / 2 - 60, y = GY + 40;
    c.fillStyle = 'rgba(10,12,20,.72)'; c.fillRect(x, y, w, h);
    lines.forEach((l, i) => { c.fillStyle = i >= 3 ? '#c0c8e0' : '#fff'; c.fillText(l, x + w / 2, y + 28 + i * 24); });
    c.restore();
  }
  return {
    pad: 'lr',
    _aim() { const s = ships.filter((q) => q.state === 'sail').sort((a, b) => b.x - a.x)[0]; return s ? [GX + s.x, GY + s.y] : null; },
    _ended: () => ended > 0, _res: () => ({ saved, lost }),
    key(k) { if (ended > 3 && (k === 'enter' || k === 'space')) api.exit(); },
    pointer(type, x, y) {
      if (type === 'up') { ptrOn = false; if (ended > 3) api.exit(); return; }
      ptrOn = true; aimAt(x, y);
    },
    tick: update, draw,
  };
}
function mix(a, b, k) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
}
