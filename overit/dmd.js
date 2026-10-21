// A dot panel: an intensity bitmap drawn as round amber dots on black glass.
import { drawText, textWidth, wrap } from './font.js';

export const AMBER = [255, 122, 26];

export class DotPanel {
  constructor(cols, rows) {
    this.cols = cols; this.rows = rows;
    this.bm = new Float32Array(cols * rows);
    this.cv = document.createElement('canvas');
    this.cv.width = cols; this.cv.height = rows;
    this.cx = this.cv.getContext('2d');
    this.img = this.cx.createImageData(cols, rows);
    this.mask = null; this.maskKey = '';
  }
  clear() { this.bm.fill(0); }
  text(str, x, y, scale = 1, v = 1) { return drawText(this.bm, this.cols, this.rows, str, x, y, scale, v); }
  center(str, y, scale = 1, v = 1) { return this.text(str, Math.floor((this.cols - textWidth(str, scale)) / 2), y, scale, v); }
  dot(x, y, v = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) this.bm[y * this.cols + x] = Math.max(this.bm[y * this.cols + x], v);
  }
  rect(x, y, w, h, v = 1, fill = false) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (fill || j === 0 || i === 0 || j === h - 1 || i === w - 1) this.dot(x + i, y + j, v);
    }
  }
  // Wrapped, centred block of text, vertically centred in [y0, y1).
  block(str, y0, y1, scale = 1, v = 1, pad = 2) {
    const lines = wrap(str, this.cols - pad * 2, scale);
    const lh = 8 * scale;
    let y = Math.floor(y0 + (y1 - y0 - lines.length * lh + scale) / 2);
    for (const l of lines) { this.center(l, y, scale, v); y += lh; }
    return lines.length;
  }

  // Draws the panel into ctx at (x, y, w, h) in device pixels.
  render(ctx, x, y, w, h, glow = true) {
    const { cols, rows, bm, img } = this;
    const d = img.data;
    for (let i = 0; i < cols * rows; i++) {
      const v = Math.min(1, bm[i]);
      // unlit dots still show faintly, as on a real plasma display
      const k = 0.07 + v * 0.93;
      d[i * 4] = AMBER[0] * k; d[i * 4 + 1] = AMBER[1] * k * (0.75 + 0.25 * v); d[i * 4 + 2] = AMBER[2] * k * v;
      d[i * 4 + 3] = 255;
    }
    this.cx.putImageData(img, 0, 0);
    ctx.save();
    ctx.fillStyle = '#050302';
    ctx.fillRect(x, y, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.cv, x, y, w, h);
    if (glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.cv, x - w / cols, y - h / rows, w + 2 * w / cols, h + 2 * h / rows);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(this.getMask(w, h), x, y);
    ctx.restore();
  }
  getMask(w, h) {
    w = Math.round(w); h = Math.round(h);
    const key = w + 'x' + h;
    if (this.maskKey === key) return this.mask;
    const m = this.mask || document.createElement('canvas');
    m.width = w; m.height = h;
    const c = m.getContext('2d');
    c.fillStyle = '#050302';
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'destination-out';
    const dx = w / this.cols, dy = h / this.rows, r = Math.min(dx, dy) * 0.4;
    c.beginPath();
    for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) {
      c.moveTo((i + 0.5) * dx + r, (j + 0.5) * dy);
      c.arc((i + 0.5) * dx, (j + 0.5) * dy, r, 0, Math.PI * 2);
    }
    c.fill();
    this.mask = m; this.maskKey = key;
    return m;
  }
}
