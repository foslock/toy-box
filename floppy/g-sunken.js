// 1996-97: THE SUNKEN KING, chapter 1 (of 7). VGA tiles, one fight, and then the map runs out.
import { spr, wrap } from './screen.js';

const VIL = [
  'tttttttttttttttttt',
  'tggfgggggggggggfgg',
  'tgrrrrggggggrrrrgg',
  'tghhdhggpgggghdhhg',
  'tgggpgggpgggggpggg',
  'tggppppppppppppppp',
  'tgggfgggpggggfgggg',
  'tggggggggggggggggk',
  'ssssssssssssssssss',
  'ssssssssssssssssss',
  'wwwwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwwwww',
];
const PASS = ['ttttt', 'ttttt', 'ttttt', 'ttttt', 'kkkkk', 'ppppp', 'kkkkk', 'kkkkk', 'kkkkk', 'kkkkk', 'wwwww', 'wwwww'];
const BRIDGE = (y) => (y === 5 ? 'bbbbbbb' : 'wwwwwww');
const MISS = (y) => (y >= 2 && y <= 9 ? 'xxxxx' : 'XXXXX');
const VOID = 'vvvvv';
export const MAP = VIL.map((r, y) => r + PASS[y] + BRIDGE(y) + MISS(y) + VOID);
const MW = MAP[0].length, MH = MAP.length;
const SOLID = new Set(['t', 'h', 'r', 'w', 'k', 'X']);

const NPCS = [
  { x: 6, y: 8, kind: 'old', name: 'OLD FISHER', say: ['THE SUNKEN KING CAME UP OUT OF THE SEA AND TOOK THE TIDE BELL.', "NOW THE TIDE DOESN'T KNOW WHEN TO TURN. I'VE BEEN WAITING NINE DAYS FOR IT TO GO OUT.", 'THE CASTLE IS EAST, PAST THE CRAB.'] },
  { x: 10, y: 4, kind: 'kid', name: 'SMALL KID', say: ['ARE YOU THE HERO?', 'YOU LOOK QUITE SHORT FOR A HERO.'] },
  { x: 15, y: 4, kind: 'witch', name: 'PRIA THE WITCH', say: ['I AM PRIA THE WITCH.', 'I WILL HAVE LOTS OF USEFUL AND MYSTERIOUS THINGS TO SAY ONCE PRIYA WRITES MY LINES.', '(PRIYA WRITE MY LINES)'] },
  { x: 3, y: 4, kind: 'mum', name: 'MUM', say: ['BE BACK FOR TEA.', "AND DON'T GO NEAR THE CRAB."] },
];
const SIGNS = [{ x: 17, y: 4, say: ['EAST: THE CASTLE OF THE SUNKEN KING', '(KEEP OFF THE CRAB)'] }, { x: 31, y: 4, say: ['TODO: CASTLE', 'TODO: CASTLE TILES', "TODO: PRIYA DOES THE KING'S SPEECH"] }];
const CRAB = { x: 20, y: 5 };

const P = { o: '#1a1020', s: '#f0c090', h: '#6a3a1a', b: '#3070d0', B: '#1c4a9a', r: '#c03030', y: '#f0d040', w: '#ffffff', g: '#909090', G: '#505050', p: '#a040c0', P: '#6a2090', k: '#202020', e: '#e04040', c: '#e06030', C: '#a03818', t: '#40a040', T: '#286028' };
const HERO = [
  '.....oooooo.....',
  '....ohhhhhho....',
  '...ohhhhhhhho...',
  '...ohsssssshho..',
  '...osskssksso...',
  '...ossssssss o..',
  '....osssssso....',
  '...oobbrrbboo...',
  '..obbbbrrbbbbo..',
  '..osobbbbbbos o.',
  '..oso bbbbbosso.',
  '...o.oyyyyyo....',
  '.....oBBoBBo....',
  '.....oBBoBBo....',
  '.....ohhohho....',
  '......oo.oo.....',
];
const HERO2 = HERO.slice(0, 12).concat(['.....oBBoBBo....', '....oBBo.oBBo...', '....ohho.ohho...', '.....oo...oo....']);
const NPCSPR = {
  old: ['....oooooo....', '...ogggggggo...', '..ogsssssso...', '..osskssksso..', '..oswwwwwwso..', '...owwwwwwo...', '..oTTTTTTTTo..', '.oTTTTTTTTTTo.', '.osTTTTTTTTso.', '..oTTTTTTTTo..', '..oGGGooGGGo..', '..oGGo..oGGo..', '..okko..okko..'],
  kid: ['..............', '....oooooo....', '...ohhhhhho...', '...osskksso...', '...ossssss o..', '....oyyyyo....', '...oyyyyyyo...', '...osyyyyso...', '....oBBBBo....', '....oBooBo....', '....oko.oko...'],
  witch: ['......oo......', '.....oPPo.....', '....oPPPPo....', '...oPPPPPPo...', '.ooooooooooo..', '...osskssks o.', '...ossssssso..', '..opppppppppo.', '..oppppppppppo', '..osppppppspo.', '..opppppppppo.', '..opppppppppo.', '...ok....ko...'],
  mum: ['....oooooo....', '...ocCCCCco...', '..ocCsssssCo..', '..oCsksksCo...', '..oCssssssCo..', '...osssssso...', '..orrrrrrrro..', '.orrrrrrrrrro.', '.osrrrrrrrrso.', '..orrrrrrrro..', '..orrrrrrrro..', '...oko..oko...'],
};
const CRABSPR = ['..oo......oo..', '.occo....occo.', '.occco..occco.', '..occo..occo..', '...oo.ww.oo...', '..ocowkkwoco..', '.occcccccccco.', 'occcccccccccco', 'oCcccccccccCo.', '.oCCCCCCCCCo..', 'o.o.o..o.o.o..'];

function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }

export function sunken(api) {
  let hx = 2, hy = 5, fx = 2, fy = 5, face = 1, moveT = 0, t = 0, rep = 0;
  let dlg = null;        // { lines, i, who }
  let battle = null;     // { hp, chp, sel, log, heals, phase, t }
  let crabAlive = true, ending = 0, tilesCache = null, demoT = 0;
  const walkable = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && !SOLID.has(MAP[y][x]) && !NPCS.some((n) => n.x === x && n.y === y) && !SIGNS.some((s) => s.x === x && s.y === y) && !(crabAlive && x === CRAB.x && y === CRAB.y);
  function talk(lines, who) { dlg = { lines, i: 0, who }; api.sfx.beep(700, 0.03); }
  function facing() { return [hx + (face === 0 ? -1 : face === 1 ? 1 : 0), hy + (face === 2 ? -1 : face === 3 ? 1 : 0)]; }
  function interact() {
    const [x, y] = facing();
    const n = NPCS.find((q) => q.x === x && q.y === y); if (n) return talk(n.say, n.name);
    const s = SIGNS.find((q) => q.x === x && q.y === y); if (s) return talk(s.say, 'SIGN');
    if (crabAlive && x === CRAB.x && y === CRAB.y) return startBattle();
  }
  function startBattle() {
    battle = { hp: 24, chp: 16, sel: 0, log: ['A CRAB SCUTTLES OUT!'], heals: 2, phase: 'menu', t: 0 };
    api.sfx.tune([220, 0, 220, 330], 0.08);
  }
  function step(dx, dy, dir) {
    if (moveT > 0 || dlg || battle || ending) return;
    face = dir;
    const nx = hx + dx, ny = hy + dy;
    if (crabAlive && nx === CRAB.x && ny === CRAB.y) { startBattle(); return; }
    if (!walkable(nx, ny)) return;
    fx = hx; fy = hy; hx = nx; hy = ny; moveT = 0.16;
    if (hx >= MW - 3 && !ending) { ending = 0.01; api.sfx.tune([392, 0, 330, 0, 262, 0, 196], 0.22, 'triangle', 0.05); }
  }
  const DIR = { left: [-1, 0, 0], right: [1, 0, 1], up: [0, -1, 2], down: [0, 1, 3] };
  function battleAct(i) {
    const b = battle; if (b.phase !== 'menu') return;
    api.sfx.key();
    if (i === 0) { const d = 3 + Math.floor(Math.random() * 4); b.chp -= d; b.log = [`YOU HIT THE CRAB FOR ${d}!`]; api.sfx.beep(220, 0.08); }
    else if (i === 1) { if (b.heals > 0) { b.heals--; b.hp = Math.min(24, b.hp + 10); b.log = ['YOU EAT A SANDWICH. +10 HP']; api.sfx.tune([523, 784], 0.08); } else { b.log = ['NO SANDWICHES LEFT!']; return; } }
    else { b.log = ["YOU CAN'T RUN. THE CRAB IS IN THE WAY OF THE WHOLE GAME."]; }
    b.phase = 'crab'; b.t = 0.9;
  }
  function battleTick(dt) {
    const b = battle; b.t -= dt;
    if (b.phase === 'crab' && b.t <= 0) {
      if (b.chp <= 0) { b.phase = 'won'; b.log = ['THE CRAB SCUTTLES OFF SIDEWAYS.', '+12 XP (XP DOES NOTHING YET)']; api.sfx.win(); b.t = 0; return; }
      const d = 2 + Math.floor(Math.random() * 4); b.hp -= d; b.log = [`THE CRAB PINCHES YOU FOR ${d}!`]; api.sfx.crash();
      if (b.hp <= 0) { b.phase = 'lost'; b.log = ['YOU FAINTED.', 'THE OLD FISHER DRAGS YOU HOME.']; } else b.phase = 'menu';
    }
  }
  function battleEnter() {
    const b = battle;
    if (b.phase === 'menu') battleAct(b.sel);
    else if (b.phase === 'won') { crabAlive = false; battle = null; }
    else if (b.phase === 'lost') { battle = null; hx = fx = 7; hy = fy = 7; face = 3; }
  }
  function dlgNext() { dlg.i++; api.sfx.beep(700, 0.02); if (dlg.i >= dlg.lines.length) dlg = null; }

  function paintTiles() {
    const c = document.createElement('canvas'); c.width = MW * 16; c.height = MH * 16; const g = c.getContext('2d');
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const ch = MAP[y][x], X = x * 16, Y = y * 16, r = hash(x, y);
      const base = { g: '#3c9a3c', f: '#3c9a3c', t: '#2f7d32', s: '#e8cf8a', p: '#c49a5a', h: '#d9c7a0', r: '#a8402f', d: '#d9c7a0', k: '#3c9a3c', w: '#2a5ab8', b: '#2a5ab8', x: '#ff00ff', X: '#ff00ff', v: '#000000' }[ch];
      g.fillStyle = base; g.fillRect(X, Y, 16, 16);
      if (ch === 'g' || ch === 'f' || ch === 'k' || ch === 't') { for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#2d8030' : '#58b84a'; g.fillRect(X + ((r * 97 + i * 5) % 15 | 0), Y + ((r * 53 + i * 7) % 15 | 0), 1, 2); } }
      if (ch === 'f') { for (let i = 0; i < 3; i++) { g.fillStyle = ['#f05080', '#f0e040', '#ffffff'][i]; const a = (r * 13 + i * 5) % 12 | 0, b = (r * 29 + i * 4) % 12 | 0; g.fillRect(X + 2 + a, Y + 2 + b, 2, 2); } }
      if (ch === 's') { for (let i = 0; i < 4; i++) { g.fillStyle = '#c8ae6a'; g.fillRect(X + ((r * 71 + i * 9) % 15 | 0), Y + ((r * 37 + i * 5) % 15 | 0), 1, 1); } }
      if (ch === 'p') { g.fillStyle = '#a8804a'; g.fillRect(X + (r * 12 | 0), Y + 4, 3, 2); g.fillRect(X + 3, Y + 11, 4, 2); }
      if (ch === 't') {
        g.fillStyle = '#5a3a1a'; g.fillRect(X + 6, Y + 10, 4, 6);
        g.fillStyle = '#14501e'; g.beginPath(); g.arc(X + 8, Y + 7, 7.5, 0, 7); g.fill();
        g.fillStyle = '#237a2e'; g.beginPath(); g.arc(X + 7, Y + 6, 5.5, 0, 7); g.fill();
        g.fillStyle = '#3aa040'; g.fillRect(X + 4, Y + 3, 3, 2);
      }
      if (ch === 'k') { g.fillStyle = '#5a5a66'; g.beginPath(); g.ellipse(X + 8, Y + 10, 7, 5.5, 0, 0, 7); g.fill(); g.fillStyle = '#8a8a96'; g.fillRect(X + 4, Y + 6, 5, 2); }
      if (ch === 'h' || ch === 'd') { g.fillStyle = '#b8a47e'; for (let j = 0; j < 4; j++) g.fillRect(X, Y + j * 4 + 3, 16, 1); if (ch === 'h' && x % 3 === 1) { g.fillStyle = '#5a3a1a'; g.fillRect(X + 4, Y + 3, 8, 7); g.fillStyle = '#80c0f0'; g.fillRect(X + 5, Y + 4, 6, 5); } }
      if (ch === 'd') { g.fillStyle = '#6a3a1a'; g.fillRect(X + 3, Y + 2, 10, 14); g.fillStyle = '#f0d040'; g.fillRect(X + 10, Y + 9, 2, 2); }
      if (ch === 'r') { g.fillStyle = '#7a2a20'; for (let j = 0; j < 4; j++) g.fillRect(X, Y + j * 4, 16, 1); g.fillRect(X + (y % 2) * 8, Y, 1, 16); }
      if (ch === 'b') { g.fillStyle = '#8a5a2a'; g.fillRect(X, Y + 1, 16, 14); g.fillStyle = '#5a3a1a'; for (let j = 0; j < 4; j++) g.fillRect(X + j * 4, Y + 1, 1, 14); g.fillRect(X, Y + 1, 16, 1); g.fillRect(X, Y + 14, 16, 1); }
      if (ch === 'x' || ch === 'X') { g.fillStyle = '#000'; g.fillRect(X, Y, 8, 8); g.fillRect(X + 8, Y + 8, 8, 8); }
    }
    tilesCache = c;
  }
  function water(g, cam) {
    for (let y = 0; y < MH; y++) for (let x = Math.floor(cam / 16); x < Math.floor(cam / 16) + 21 && x < MW; x++) {
      const ch = MAP[y][x]; if (ch !== 'w') continue;
      const X = x * 16 - cam, Y = y * 16 + 8, ph = Math.sin(t * 2 + x * 0.9 + y * 1.7);
      g.fillStyle = ph > 0.3 ? '#a8d0ff' : '#5a8ae0'; g.fillRect(X + 2 + (ph * 3 | 0) + 3, Y + 3, 5, 1);
      g.fillStyle = '#5a8ae0'; g.fillRect(X + 8 - (ph * 2 | 0), Y + 10, 4, 1);
    }
  }
  return {
    pad: () => (battle ? 'battle' : 'arrows'), swipe: false,
    key(k) {
      if (ending > 2.5) { if (k === 'enter' || k === 'space') api.exit(); return; }
      if (dlg) { if (k === 'enter' || k === 'space') dlgNext(); return; }
      if (battle) {
        if (k === 'up') battle.sel = (battle.sel + 2) % 3; else if (k === 'down') battle.sel = (battle.sel + 1) % 3;
        else if (k === 'enter' || k === 'space') battleEnter(); else if (/^[1-3]$/.test(k)) { battle.sel = +k - 1; battleEnter(); }
        return;
      }
      if (DIR[k]) { step(...DIR[k]); rep = 0.2; }
      else if (k === 'enter' || k === 'space') interact();
    },
    tap(x, y) {
      if (ending > 2.5) { api.exit(); return; }
      if (dlg) { dlgNext(); return; }
      if (battle) {
        if (battle.phase === 'menu' && y > 270) { const i = Math.floor((y - 280) / 36); if (i >= 0 && i < 3 && x < 300) { battle.sel = i; battleEnter(); } }
        else if (battle.phase !== 'menu') battleEnter();
        return;
      }
      // tap: step toward the tap, or talk if tapping who you face
      const cam = camX();
      const tx = Math.floor((x / 2 + cam) / 16), ty = Math.floor(y / 2 / 16);
      const dx = tx - hx, dy = ty - hy;
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        const d = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
        face = DIR[d][2];
        if (NPCS.some((n) => n.x === tx && n.y === ty) || SIGNS.some((s) => s.x === tx && s.y === ty) || (crabAlive && tx === CRAB.x && ty === CRAB.y)) { interact(); return; }
      }
      const target = NPCS.some((n) => n.x === tx && n.y === ty) || SIGNS.some((q) => q.x === tx && q.y === ty) || (crabAlive && tx === CRAB.x && ty === CRAB.y);
      walkTo = [tx, ty]; talkTo = target ? [tx, ty] : null;
    },
    tick(dt) {
      t += dt; if (moveT > 0) moveT = Math.max(0, moveT - dt);
      if (battle) { battleTick(dt); return; }
      if (ending) { ending += dt; if (ending > 2.5 && !this._done) { this._done = true; api.done(); } return; }
      if (api.demo && !dlg) { demoT += dt; if (moveT <= 0 && demoT > 0.5) { if (hx < 9) step(1, 0, 1); else if (hx === 9 && hy > 4) { face = 2; } } if (demoT > 2.6 && !this._talked) { this._talked = true; hx = 9; hy = 5; face = 1; talk(['ARE YOU THE HERO?', 'YOU LOOK QUITE SHORT FOR A HERO.'], 'SMALL KID'); } return; }
      const k = ['left', 'right', 'up', 'down'].find((d) => api.held.has(d));
      if (k && !dlg) { rep -= dt; if (rep <= 0 && moveT <= 0) { step(...DIR[k]); rep = 0; } }
      else if (walkTo && moveT <= 0 && !dlg) {
        const [tx, ty] = walkTo; const dx = Math.sign(tx - hx), dy = Math.sign(ty - hy);
        let moved = false;
        if (dx && walkable(hx + dx, hy)) { step(dx, 0, dx < 0 ? 0 : 1); moved = true; }
        else if (dy && walkable(hx, hy + dy)) { step(0, dy, dy < 0 ? 2 : 3); moved = true; }
        else if (dx && crabAlive && hx + dx === CRAB.x && hy === CRAB.y) { step(dx, 0, 1); }
        if (!moved || (hx === tx && hy === ty)) walkTo = null;
      }
      if (talkTo && moveT <= 0 && !dlg && !battle) {
        const dx = talkTo[0] - hx, dy = talkTo[1] - hy;
        if (Math.abs(dx) + Math.abs(dy) === 1) { face = dx < 0 ? 0 : dx > 0 ? 1 : dy < 0 ? 2 : 3; talkTo = null; walkTo = null; interact(); }
        else if (!walkTo) talkTo = null;
      }
    },
    draw(scr) {
      const g = scr.lx;
      if (!tilesCache) paintTiles();
      if (battle) return drawBattle(scr);
      const cam = camX();
      g.fillStyle = '#000'; g.fillRect(0, 0, 320, 200);
      g.drawImage(tilesCache, -cam, 0);
      water(g, cam);
      const k = moveT / 0.16, px = (hx + (fx - hx) * k) * 16 - cam, py = (hy + (fy - hy) * k) * 16;
      for (const n of NPCS) spr(g, n.x * 16 - cam + 1, n.y * 16 + 2 + (n.kind === 'kid' ? 3 : 0) + (((t * 2 + n.x) | 0) % 2), NPCSPR[n.kind], P, n.x > hx);
      for (const s of SIGNS) { const X = s.x * 16 - cam, Y = s.y * 16; g.fillStyle = '#5a3a1a'; g.fillRect(X + 7, Y + 8, 2, 8); g.fillStyle = '#a8784a'; g.fillRect(X + 2, Y + 2, 12, 8); g.fillStyle = '#5a3a1a'; g.fillRect(X + 4, Y + 4, 8, 1); g.fillRect(X + 4, Y + 7, 6, 1); }
      if (crabAlive) spr(g, CRAB.x * 16 - cam + 1, CRAB.y * 16 + 4 + (((t * 3) | 0) % 2), CRABSPR, P, ((t | 0) % 2) === 0);
      spr(g, Math.round(px), Math.round(py) - 1, moveT > 0 && ((t * 8) | 0) % 2 ? HERO2 : HERO, P, face === 0);
      if (ending) { g.fillStyle = `rgba(0,0,0,${Math.min(1, ending / 1.5)})`; g.fillRect(0, 0, 320, 200); }
      scr.blit();
      if (!ending) {
        scr.text(0, 0, ' THE SUNKEN KING ', 15, '#2a1a4a');
        scr.text(22, 0, ` HP 24/24  LV 1 `, 14, '#2a1a4a');
      }
      if (ending > 1.2) {
        scr.text(12, 6, 'THE SUNKEN KING', 15);
        scr.text(11, 8, 'END OF CHAPTER 1', 13);
        if (ending > 2) { scr.text(7, 11, 'CHAPTER 2 COMING SOON!!!!', 14); scr.text(13, 12, '(SUMMER 1997)', 7); }
        if (ending > 2.5) scr.text(12, 17, 'PRESS ENTER', 8);
      }
      if (dlg) {
        const ctx = scr.ctx;
        ctx.fillStyle = '#10103a'; ctx.fillRect(16, 268, 608, 120); ctx.strokeStyle = '#e0e0ff'; ctx.lineWidth = 4; ctx.strokeRect(18, 270, 604, 116);
        scr.text(2, 14, dlg.who, 14);
        wrap(dlg.lines[dlg.i], 34).slice(0, 3).forEach((l, i) => scr.text(2, 15 + i, l, 15));
        if (((t * 2) | 0) % 2) scr.text(36, 18, '▼', 15);
      }
    },
  };
  var walkTo = null, talkTo = null;
  function camX() { const k = moveT / 0.16; const px = (hx + (fx - hx) * k) * 16; return Math.max(0, Math.min(MW * 16 - 320, px - 152)); }
  function drawBattle(scr) {
    const g = scr.lx, b = battle;
    const grad = g.createLinearGradient(0, 0, 0, 130); grad.addColorStop(0, '#203070'); grad.addColorStop(1, '#e8cf8a');
    g.fillStyle = grad; g.fillRect(0, 0, 320, 200);
    g.fillStyle = '#e8cf8a'; g.fillRect(0, 100, 320, 100);
    g.fillStyle = '#2a5ab8'; g.fillRect(0, 84, 320, 16);
    g.save(); g.translate(200, 50 + Math.sin(t * 3) * 2); g.scale(5, 5); spr(g, 0, 0, CRABSPR, P, ((t * 2) | 0) % 2 === 0); g.restore();
    if (b.phase === 'crab' && b.t > 0.4) { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(190, 40, 90, 70); }
    g.save(); g.translate(50, 90); g.scale(2, 2); spr(g, 0, 0, HERO, P); g.restore();
    scr.blit();
    const ctx = scr.ctx;
    ctx.fillStyle = '#10103a'; ctx.fillRect(12, 262, 616, 130); ctx.strokeStyle = '#e0e0ff'; ctx.lineWidth = 4; ctx.strokeRect(14, 264, 612, 126);
    scr.text(1, 1, ` HERO  HP ${String(Math.max(0, b.hp)).padStart(2)}/24 `, 15, '#10103a');
    scr.text(23, 1, ` CRAB HP ${String(Math.max(0, b.chp)).padStart(2)} `, 15, '#3a1010');
    if (b.phase === 'menu') {
      ['ATTACK', `SANDWICH (${b.heals})`, 'RUN'].forEach((s, i) => { scr.text(2, 14 + i * 1.8, (i === b.sel ? '▶ ' : '  ') + s, i === b.sel ? 14 : 15); });
      wrap(b.log[0], 18).forEach((l, i) => scr.text(20, 14 + i, l, 11));
    } else {
      b.log.forEach((l, i) => wrap(l, 36).forEach((w, j) => scr.text(2, 14 + i * 2 + j, w, 15)));
      if (b.phase !== 'crab' && ((t * 2) | 0) % 2) scr.text(36, 18, '▼', 15);
    }
  }
}
