// The dancers: what each animal does, and how it's printed. Every token is a disc of one ink
// with its face knocked out to bare paper and a second ink laid over, slightly off register.

export const PAPER = '#f6efdc';
export const BLUE = '#3255a4';
export const PINK = '#ff48b0';
export const YELLOW = '#ffe33a';

// {A} and {H} are swapped for the attack and heart marks wherever the text is shown.
export const SPECIES = {
  capy:      { name: 'Capybara',    atk: 2, hp: 8, tier: 0, text: () => 'Your leader. Everyone follows the capybara. If it\'s knocked out, you lose the song.' },
  frog:      { name: 'Frog',        atk: 2, hp: 2, tier: 1, text: L => `Hype: each time it clashes, the dancer behind it gets +${L}{A} for the rest of the song.` },
  bee:       { name: 'Bee',         atk: 1, hp: 2, tier: 1, text: L => `Sting: +${2 * L}{A} while it's in the first three places behind the leader.` },
  tortoise:  { name: 'Tortoise',    atk: 1, hp: 4, tier: 1, text: L => `Shell: at the very back, every dancer in the line takes ${L} less damage (never under 1).` },
  humming:   { name: 'Hummingbird', atk: 1, hp: 1, tier: 1, text: L => `Zip: the whole line dances ${8 * L}% faster.` },
  parrot:    { name: 'Parrot',      atk: 1, hp: 3, tier: 2, text: () => 'Copycat: does whatever the dancer right in front of it does.' },
  skunk:     { name: 'Skunk',       atk: 1, hp: 3, tier: 2, text: L => `Stink: when it's knocked out, every rival within 3 steps takes ${2 * L} damage.` },
  flamingo:  { name: 'Flamingo',    atk: 1, hp: 3, tier: 2, text: L => `Sway: every bar, heals the dancers either side of it by ${L}{H}.` },
  armadillo: { name: 'Armadillo',   atk: 2, hp: 3, tier: 2, text: L => `Roll up: shrugs off the first ${L === 1 ? 'hit' : L + ' hits'} it takes each song.` },
  bull:      { name: 'Bull',        atk: 3, hp: 3, tier: 3, text: L => `Stampede: each clash also hits the rival behind the one it struck, for ${L} damage.` },
  llama:     { name: 'Llama',       atk: 2, hp: 2, tier: 3, text: L => `Spit: every bar, spits ${L} damage at the nearest rival within 4 steps.` },
  monkey:    { name: 'Monkey',      atk: 1, hp: 3, tier: 3, text: L => `Cheer: each time a dancer in its line is knocked out, it gets +1{A} +${L}{H} for the song.` },
  sloth:     { name: 'Sloth',       atk: 1, hp: 6, tier: 3, text: L => `Hug: a rival line it clashes with slows to half speed for ${2 * L} beats.` },
  peacock:   { name: 'Peacock',     atk: 4, hp: 30, tier: 9, text: () => 'The drum major of the parade.' },
};

export const TREATS = {
  mango:   { name: 'Mango',   cost: 3, text: 'Gives +1{A} +1{H} to the dancer at the back of your line, for good.' },
  maracas: { name: 'Maracas', cost: 4, text: 'Gives your capybara +1{A} +2{H}, for good.' },
};

export const TEAM_INKS = {
  you:  { body: BLUE,   line: BLUE, accent: PINK },
  foe:  { body: PINK,   line: BLUE, accent: YELLOW },
  wild: { body: YELLOW, line: BLUE, accent: PINK },
  mine: { body: YELLOW, line: BLUE, accent: BLUE },
};

// misregistration: the pink and yellow drums sit a hair off the blue one
const OFF = { [PINK]: [0.9, -0.6], [YELLOW]: [-0.7, 0.8] };

function ink(g, col, R, fn) {
  g.save();
  const o = OFF[col], k = Math.max(0.6, R / 16);
  if (o) g.translate(o[0] * k, o[1] * k);
  g.globalCompositeOperation = col === PAPER ? 'source-over' : 'multiply';
  g.fillStyle = g.strokeStyle = col;
  g.lineCap = g.lineJoin = 'round';
  fn();
  g.restore();
}
const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); };
function eye(g, P, line, x, y, r, R) {
  ink(g, PAPER, R, () => circ(g, x, y, r));
  ink(g, line, R, () => circ(g, x + r * 0.15, y + r * 0.1, r * 0.5));
}

// Draws one dancer centred on 0,0 with disc radius R (in pixels).
export function drawAnimal(g, sp, R, team, opts = {}) {
  const I = TEAM_INKS[team] || TEAM_INKS.you;
  const u = R, b = I.body, L = I.line, A = I.accent;
  // bits that stick out behind the disc
  ink(g, b, R, () => {
    switch (sp) {
      case 'capy': circ(g, -0.62 * u, -0.72 * u, 0.24 * u); circ(g, 0.62 * u, -0.72 * u, 0.24 * u); break;
      case 'frog': circ(g, -0.45 * u, -0.72 * u, 0.36 * u); circ(g, 0.45 * u, -0.72 * u, 0.36 * u); break;
      case 'tortoise': circ(g, 0, -0.98 * u, 0.36 * u); for (const s of [-1, 1]) { circ(g, s * 0.85 * u, -0.55 * u, 0.2 * u); circ(g, s * 0.85 * u, 0.6 * u, 0.2 * u); } break;
      case 'parrot': for (const k of [-1, 0, 1]) ell(g, k * 0.22 * u, -0.95 * u, 0.13 * u, 0.32 * u, k * 0.45); break;
      case 'skunk': circ(g, 0.86 * u, -0.5 * u, 0.48 * u); break;
      case 'armadillo': for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.25 * u, -0.8 * u); g.lineTo(s * 0.55 * u, -1.2 * u); g.lineTo(s * 0.62 * u, -0.62 * u); g.fill(); } circ(g, 0, 0.95 * u, 0.28 * u); break;
      case 'llama': ell(g, -0.36 * u, -1.0 * u, 0.15 * u, 0.42 * u, -0.2); ell(g, 0.36 * u, -1.0 * u, 0.15 * u, 0.42 * u, 0.2); break;
      case 'monkey': circ(g, -0.95 * u, -0.05 * u, 0.32 * u); circ(g, 0.95 * u, -0.05 * u, 0.32 * u); break;
      case 'peacock':
        for (let k = -3; k <= 3; k++) { const a = -Math.PI / 2 + k * 0.36; ell(g, Math.cos(a) * 1.05 * u, Math.sin(a) * 1.05 * u, 0.24 * u, 0.62 * u, a + Math.PI / 2); }
        break;
    }
  });
  if (sp === 'humming') ink(g, A, R, () => { ell(g, -0.75 * u, -0.45 * u, 0.5 * u, 0.2 * u, -0.6); ell(g, 0.55 * u, -0.75 * u, 0.42 * u, 0.17 * u, 0.9); });
  if (sp === 'bee') ink(g, PAPER, R, () => { ell(g, -0.88 * u, -0.38 * u, 0.36 * u, 0.22 * u, 0.4); ell(g, 0.88 * u, -0.38 * u, 0.36 * u, 0.22 * u, -0.4); });
  if (sp === 'bee') ink(g, L, R, () => { g.lineWidth = Math.max(1, 0.07 * u); for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 0.88 * u, -0.38 * u, 0.36 * u, 0.22 * u, -s * 0.4, 0, 7); g.stroke(); } });
  if (sp === 'bull') {
    ink(g, PAPER, R, () => { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.5 * u, -0.6 * u); g.quadraticCurveTo(s * 1.25 * u, -0.7 * u, s * 1.15 * u, -1.25 * u); g.quadraticCurveTo(s * 0.95 * u, -0.85 * u, s * 0.35 * u, -0.85 * u); g.fill(); } });
    ink(g, L, R, () => { g.lineWidth = Math.max(1, 0.07 * u); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.5 * u, -0.6 * u); g.quadraticCurveTo(s * 1.25 * u, -0.7 * u, s * 1.15 * u, -1.25 * u); g.quadraticCurveTo(s * 0.95 * u, -0.85 * u, s * 0.35 * u, -0.85 * u); g.stroke(); } });
  }
  if (sp === 'peacock') ink(g, PAPER, R, () => { for (let k = -3; k <= 3; k++) { const a = -Math.PI / 2 + k * 0.36; circ(g, Math.cos(a) * 1.4 * u, Math.sin(a) * 1.4 * u, 0.13 * u); } });
  if (sp === 'peacock') ink(g, L, R, () => { for (let k = -3; k <= 3; k++) { const a = -Math.PI / 2 + k * 0.36; circ(g, Math.cos(a) * 1.4 * u, Math.sin(a) * 1.4 * u, 0.07 * u); } });

  // the disc
  ink(g, b, R, () => circ(g, 0, 0, u));

  // the face, knocked out and overprinted
  const lw = Math.max(1, 0.1 * u);
  switch (sp) {
    case 'capy':
      ink(g, PAPER, R, () => { g.beginPath(); g.roundRect(-0.5 * u, 0.02 * u, u, 0.58 * u, 0.26 * u); g.fill(); });
      ink(g, L, R, () => { circ(g, -0.17 * u, 0.2 * u, 0.07 * u); circ(g, 0.17 * u, 0.2 * u, 0.07 * u); g.lineWidth = lw * 0.8; g.beginPath(); g.moveTo(-0.15 * u, 0.42 * u); g.quadraticCurveTo(0, 0.5 * u, 0.15 * u, 0.42 * u); g.stroke(); });
      eye(g, PAPER, L, -0.38 * u, -0.28 * u, 0.15 * u, R); eye(g, PAPER, L, 0.38 * u, -0.28 * u, 0.15 * u, R);
      break;
    case 'frog':
      eye(g, PAPER, L, -0.45 * u, -0.72 * u, 0.22 * u, R); eye(g, PAPER, L, 0.45 * u, -0.72 * u, 0.22 * u, R);
      ink(g, PAPER, R, () => { g.lineWidth = lw * 1.4; g.beginPath(); g.arc(0, 0, 0.55 * u, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); });
      ink(g, A, R, () => { circ(g, -0.6 * u, 0.15 * u, 0.13 * u); circ(g, 0.6 * u, 0.15 * u, 0.13 * u); });
      break;
    case 'bee':
      g.save(); g.beginPath(); g.arc(0, 0, u, 0, 7); g.clip();
      ink(g, PAPER, R, () => { g.fillRect(-u, -0.05 * u, 2 * u, 0.24 * u); g.fillRect(-u, 0.45 * u, 2 * u, 0.24 * u); });
      g.restore();
      ink(g, L, R, () => { g.lineWidth = lw * 0.8; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.2 * u, -0.9 * u); g.quadraticCurveTo(s * 0.3 * u, -1.25 * u, s * 0.5 * u, -1.3 * u); g.stroke(); circ(g, s * 0.5 * u, -1.3 * u, 0.09 * u); } });
      eye(g, PAPER, L, -0.32 * u, -0.42 * u, 0.15 * u, R); eye(g, PAPER, L, 0.32 * u, -0.42 * u, 0.15 * u, R);
      break;
    case 'tortoise':
      ink(g, PAPER, R, () => {
        g.lineWidth = lw; g.beginPath();
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; const x = Math.cos(a) * 0.4 * u, y = Math.sin(a) * 0.4 * u; k ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.closePath(); g.stroke();
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; g.beginPath(); g.moveTo(Math.cos(a) * 0.4 * u, Math.sin(a) * 0.4 * u); g.lineTo(Math.cos(a) * 0.95 * u, Math.sin(a) * 0.95 * u); g.stroke(); }
      });
      ink(g, PAPER, R, () => { circ(g, -0.13 * u, -1.02 * u, 0.08 * u); circ(g, 0.13 * u, -1.02 * u, 0.08 * u); });
      break;
    case 'humming':
      ink(g, L, R, () => { g.lineWidth = lw * 1.1; g.beginPath(); g.moveTo(0.55 * u, 0.0); g.lineTo(1.55 * u, 0.12 * u); g.stroke(); });
      ink(g, PAPER, R, () => { g.beginPath(); g.moveTo(0.55 * u, -0.12 * u); g.lineTo(0.98 * u, 0.02 * u); g.lineTo(0.55 * u, 0.14 * u); g.fill(); });
      ink(g, A, R, () => ell(g, 0.1 * u, 0.45 * u, 0.42 * u, 0.25 * u));
      eye(g, PAPER, L, 0.18 * u, -0.25 * u, 0.18 * u, R);
      break;
    case 'parrot': {
      const beak = () => { g.beginPath(); g.moveTo(0.05 * u, -0.25 * u); g.quadraticCurveTo(0.95 * u, -0.4 * u, 0.62 * u, 0.55 * u); g.quadraticCurveTo(0.45 * u, 0.12 * u, 0.05 * u, 0.25 * u); g.closePath(); };
      ink(g, PAPER, R, () => { beak(); g.fill(); });
      ink(g, L, R, () => { g.lineWidth = lw * 0.8; beak(); g.stroke(); });
      ink(g, A, R, () => circ(g, -0.45 * u, 0.3 * u, 0.15 * u));
      eye(g, PAPER, L, -0.3 * u, -0.3 * u, 0.17 * u, R);
      break;
    }
    case 'skunk':
      g.save(); g.beginPath(); g.arc(0, 0, u, 0, 7); g.clip();
      ink(g, PAPER, R, () => { g.beginPath(); g.roundRect(-0.15 * u, -1.1 * u, 0.3 * u, 1.45 * u, 0.15 * u); g.fill(); });
      g.restore();
      ink(g, PAPER, R, () => { g.lineWidth = lw * 1.2; g.beginPath(); g.arc(0.86 * u, -0.5 * u, 0.3 * u, Math.PI * 0.9, Math.PI * 1.9); g.stroke(); });
      ink(g, L, R, () => circ(g, 0, 0.38 * u, 0.1 * u));
      eye(g, PAPER, L, -0.42 * u, -0.08 * u, 0.15 * u, R); eye(g, PAPER, L, 0.42 * u, -0.08 * u, 0.15 * u, R);
      break;
    case 'flamingo': {
      const beak = () => { g.beginPath(); g.moveTo(0.05 * u, -0.12 * u); g.quadraticCurveTo(0.8 * u, -0.25 * u, 0.82 * u, 0.15 * u); g.quadraticCurveTo(0.82 * u, 0.5 * u, 0.62 * u, 0.7 * u); g.quadraticCurveTo(0.55 * u, 0.3 * u, 0.05 * u, 0.22 * u); g.closePath(); };
      ink(g, PAPER, R, () => { beak(); g.fill(); });
      ink(g, L, R, () => { g.save(); beak(); g.clip(); g.fillRect(0.5 * u, 0.25 * u, 0.5 * u, 0.6 * u); g.restore(); g.lineWidth = lw * 0.7; beak(); g.stroke(); });
      ink(g, A, R, () => { g.lineWidth = lw; g.beginPath(); g.moveTo(-0.3 * u, -0.95 * u); g.quadraticCurveTo(-0.1 * u, -1.25 * u, 0.1 * u, -1.0 * u); g.stroke(); });
      eye(g, PAPER, L, -0.28 * u, -0.32 * u, 0.17 * u, R);
      break;
    }
    case 'armadillo':
      g.save(); g.beginPath(); g.arc(0, 0, u, 0, 7); g.clip();
      ink(g, PAPER, R, () => { g.lineWidth = lw * 0.9; for (const r of [0.75, 1.15, 1.55]) { g.beginPath(); g.arc(0, 1.25 * u, r * u, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); } });
      g.restore();
      ink(g, L, R, () => circ(g, 0, 1.08 * u, 0.09 * u));
      eye(g, PAPER, L, -0.4 * u, -0.45 * u, 0.14 * u, R); eye(g, PAPER, L, 0.4 * u, -0.45 * u, 0.14 * u, R);
      break;
    case 'bull':
      ink(g, PAPER, R, () => ell(g, 0, 0.42 * u, 0.55 * u, 0.36 * u));
      ink(g, L, R, () => { circ(g, -0.2 * u, 0.4 * u, 0.08 * u); circ(g, 0.2 * u, 0.4 * u, 0.08 * u); });
      ink(g, A === YELLOW ? BLUE : YELLOW, R, () => { g.lineWidth = lw; g.beginPath(); g.arc(0, 0.68 * u, 0.17 * u, 0, Math.PI * 2); g.stroke(); });
      eye(g, PAPER, L, -0.38 * u, -0.25 * u, 0.15 * u, R); eye(g, PAPER, L, 0.38 * u, -0.25 * u, 0.15 * u, R);
      break;
    case 'llama':
      ink(g, PAPER, R, () => { circ(g, -0.3 * u, -0.78 * u, 0.2 * u); circ(g, 0, -0.85 * u, 0.22 * u); circ(g, 0.3 * u, -0.78 * u, 0.2 * u); ell(g, 0, 0.42 * u, 0.4 * u, 0.32 * u); });
      ink(g, L, R, () => { g.lineWidth = lw * 0.7; g.beginPath(); g.moveTo(-0.12 * u, 0.5 * u); g.lineTo(0, 0.6 * u); g.lineTo(0.12 * u, 0.5 * u); g.moveTo(0, 0.6 * u); g.lineTo(0, 0.4 * u); g.stroke(); });
      eye(g, PAPER, L, -0.36 * u, -0.18 * u, 0.15 * u, R); eye(g, PAPER, L, 0.36 * u, -0.18 * u, 0.15 * u, R);
      break;
    case 'monkey':
      ink(g, PAPER, R, () => { circ(g, -0.95 * u, -0.05 * u, 0.17 * u); circ(g, 0.95 * u, -0.05 * u, 0.17 * u); circ(g, -0.26 * u, -0.18 * u, 0.33 * u); circ(g, 0.26 * u, -0.18 * u, 0.33 * u); ell(g, 0, 0.32 * u, 0.55 * u, 0.36 * u); });
      ink(g, L, R, () => { circ(g, -0.24 * u, -0.18 * u, 0.1 * u); circ(g, 0.24 * u, -0.18 * u, 0.1 * u); g.lineWidth = lw * 0.8; g.beginPath(); g.arc(0, 0.25 * u, 0.25 * u, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); });
      break;
    case 'sloth':
      ink(g, PAPER, R, () => ell(g, 0, 0.05 * u, 0.74 * u, 0.56 * u));
      ink(g, b, R, () => { ell(g, -0.34 * u, -0.02 * u, 0.26 * u, 0.15 * u, 0.5); ell(g, 0.34 * u, -0.02 * u, 0.26 * u, 0.15 * u, -0.5); });
      ink(g, PAPER, R, () => { circ(g, -0.34 * u, -0.04 * u, 0.07 * u); circ(g, 0.34 * u, -0.04 * u, 0.07 * u); });
      ink(g, L, R, () => { circ(g, 0, 0.18 * u, 0.08 * u); g.lineWidth = lw * 0.7; g.beginPath(); g.arc(0, 0.25 * u, 0.2 * u, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke(); });
      break;
    case 'peacock':
      ink(g, L, R, () => { g.lineWidth = lw * 0.6; for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(k * 0.12 * u, -0.9 * u); g.lineTo(k * 0.25 * u, -1.25 * u); g.stroke(); circ(g, k * 0.25 * u, -1.25 * u, 0.08 * u); } });
      ink(g, PAPER, R, () => { g.beginPath(); g.moveTo(-0.12 * u, 0.12 * u); g.lineTo(0.12 * u, 0.12 * u); g.lineTo(0, 0.42 * u); g.fill(); });
      eye(g, PAPER, L, -0.34 * u, -0.22 * u, 0.16 * u, R); eye(g, PAPER, L, 0.34 * u, -0.22 * u, 0.16 * u, R);
      break;
  }
  if (opts.hat) drawHat(g, R, opts.hat === true ? (team === 'foe' ? BLUE : PINK) : opts.hat);
}

export function drawHat(g, R, col) {
  const u = R;
  ink(g, YELLOW, R, () => { g.beginPath(); g.moveTo(-0.42 * u, -0.78 * u); g.lineTo(0.08 * u, -1.75 * u); g.lineTo(0.48 * u, -0.72 * u); g.closePath(); g.fill(); });
  ink(g, col, R, () => {
    g.lineWidth = Math.max(1, 0.12 * u);
    g.beginPath(); g.moveTo(-0.3 * u, -1.0 * u); g.lineTo(0.38 * u, -0.95 * u); g.moveTo(-0.12 * u, -1.32 * u); g.lineTo(0.28 * u, -1.3 * u); g.stroke();
    circ(g, 0.08 * u, -1.78 * u, 0.16 * u);
  });
}

// a cache of little printed tokens for the DOM (shop, rules, results)
const thumbs = new Map();
export function thumb(sp, team = 'you', size = 64, hat = false) {
  const k = sp + team + size + hat;
  if (thumbs.has(k)) return thumbs.get(k);
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(size * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.translate(size / 2, size * (hat ? 0.6 : 0.56));
  drawAnimal(g, sp, size * (sp === 'peacock' ? 0.24 : 0.3), team, { hat });
  const url = c.toDataURL();
  thumbs.set(k, url);
  return url;
}
