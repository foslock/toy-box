// The CRT: one 640x400 canvas. Text mode is 40 columns x 20 rows of 16x20 cells
// (VT323 drawn double-wide, like real 40-column mode). Graphics games draw into a
// 320x200 buffer that is blown up 2x with no smoothing.
export const W = 640, H = 400, COLS = 40, ROWS = 20, CW = 16, CH = 20;

// The 16 colours of the PC (CGA/EGA text palette).
export const PAL = ['#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
  '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff'];

export function makeScreen(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  const lo = document.createElement('canvas'); lo.width = 320; lo.height = 200;
  const lx = lo.getContext('2d');
  let adv = 8;
  const scr = {
    ctx, lo, lx,
    measure() { ctx.font = '20px VT323'; adv = ctx.measureText('M').width || 8; },
    clear(c = '#000') { ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); },
    // text at a cell; fg/bg are colours or palette indexes
    text(col, row, s, fg = 7, bg = null) {
      s = String(s);
      const f = typeof fg === 'number' ? PAL[fg] : fg;
      if (bg != null) { ctx.fillStyle = typeof bg === 'number' ? PAL[bg] : bg; ctx.fillRect(col * CW, row * CH, s.length * CW, CH); }
      ctx.save(); ctx.font = '20px VT323'; ctx.fillStyle = f; ctx.textBaseline = 'alphabetic';
      ctx.translate(col * CW, row * CH + 15); ctx.scale(CW / adv, 1);
      for (let i = 0; i < s.length; i++) ctx.fillText(s[i], i * adv + 0.5, 0);
      ctx.restore();
    },
    // single-width text at pixel coordinates (for HUDs over graphics)
    small(x, y, s, fg = '#fff', size = 20) {
      ctx.save(); ctx.font = `${size}px VT323`; ctx.fillStyle = fg; ctx.fillText(String(s), x, y); ctx.restore();
    },
    fill(col, row, w, h, c) { ctx.fillStyle = typeof c === 'number' ? PAL[c] : c; ctx.fillRect(col * CW, row * CH, w * CW, h * CH); },
    blit() { ctx.imageSmoothingEnabled = false; ctx.drawImage(lo, 0, 0, W, H); },
  };
  return scr;
}

// Word-wrap to a width in characters. Keeps blank lines.
export function wrap(s, w = COLS) {
  const out = [];
  for (const para of String(s).split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(' ')) {
      if (!line) line = word;
      else if ((line + ' ' + word).length <= w) line += ' ' + word;
      else { out.push(line); line = word; }
      while (line.length > w) { out.push(line.slice(0, w)); line = line.slice(w); }
    }
    out.push(line);
  }
  return out;
}

// Pixel sprites from strings: each char indexes a palette object; '.' is clear.
export function spr(ctx, px, py, rows, pal, flip = false) {
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) {
      const ch = r[flip ? r.length - 1 - i : i];
      if (ch === '.' || ch === ' ') continue;
      ctx.fillStyle = pal[ch]; ctx.fillRect(px + i, py + j, 1, 1);
    }
  }
}
