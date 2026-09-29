// A development view, not part of the toy: ?film=Aa!7 lays out a filmstrip of each character's scene (a row per
// character, a frame at evenly spaced moments), drawn as if typed, so uppercase shows the exaggerated version.
//   ?film=Bb&n=8    eight frames each        &cols=4   frames per row        &at=1.2   one frame at that time (seconds)
//   &from=2.2&to=2.8   spread the frames over just that stretch, to look at an exit
//   ?film=glyphs    every letter in the stroke font
import { GLYPHS } from './font.js';
import { glyph, glyphOf, bind, K } from './kit.js';
import { Anim, LOUD } from './anim.js';
import { sceneFor, LIGHT, TABLE } from './scenes.js';

export async function start({ cv, ctx, W, H, RS, params }) {
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  bind(ctx);
  document.getElementById('ui').style.display = 'none';
  ctx.fillStyle = '#222'; ctx.fillRect(0, 0, W, H);
  for (const f of (params.get('extra') || '').split(',').filter(Boolean)) {   // &extra=letters-b.js tries a scene file that isn't in the toy yet
    const m = await import('./' + f);
    Object.assign(TABLE, m.SCENES || m.default || Object.values(m)[0]);
  }
  let spec = params.get('film') || 'A';
  if (spec === 'all') spec = Object.keys(TABLE).join('');
  if (spec === 'glyphs') return sheet(ctx, W, H);
  const chars = [...spec], n = Number(params.get('n')) || 6, at = params.get('at');
  const frames = at ? 1 : n, cols = Number(params.get('cols')) || (chars.length > 1 ? frames : Math.max(1, Math.round(Math.sqrt(frames * W / H))));
  const per = Math.ceil(frames / cols), rows = per * chars.length, cw = W / cols, chh = H / rows;
  chars.forEach((ch, ci) => {
    const light = ch === ' ' ? LIGHT.space : ch === '\n' ? LIGHT.nl : null;
    const def = light || sceneFor(ch), X = ch !== ch.toLowerCase() && ch === ch.toUpperCase() ? LOUD : 1;
    for (let f = 0; f < frames; f++) {
      const x = (f % cols) * cw, y = (ci * per + Math.floor(f / cols)) * chh;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, cw, chh); ctx.clip(); ctx.translate(x, y);
      ctx.fillStyle = def.bg; ctx.fillRect(0, 0, cw, chh);
      const a = new Anim(def, { ch, X, w: cw * 0.94, h: chh * 0.9, u: Math.min(chh * 0.5, cw * 0.62), cx: cw / 2, cy: chh * 0.46, seed: 777 + ci, fx: 1, flip: def.flip || 1, slot: { x: cw / 2, y: chh * 0.86, h: chh * 0.13 } });
      const from = params.get('from'), to = params.get('to');            // &from=2.2&to=2.8: frames spread over just that stretch (seconds)
      a.t = at ? Number(at) : from && to ? Number(from) + (Number(to) - Number(from)) * (frames > 1 ? f / (frames - 1) : 0.5) : (0.03 + 0.97 * (frames > 1 ? f / (frames - 1) : 0.5)) * (a.exitAt + 0.3);
      try { a.drawBack(ctx); a.draw(ctx); } catch (err) { console.error(`scene ${ch} at t=${a.t.toFixed(2)}:`, err.stack || err); }
      ctx.font = '600 11px system-ui'; ctx.fillStyle = '#000a'; ctx.fillRect(2, 2, 78, 15); ctx.fillStyle = '#fff'; ctx.fillText(`${ch === ' ' ? '␣' : ch} t=${a.t.toFixed(2)}/${a.exitAt.toFixed(1)}`, 5, 13);
      ctx.restore();
    }
  });
}

function sheet(ctx, W, H) {
  const keys = Object.keys(GLYPHS), cols = Math.ceil(Math.sqrt(keys.length * W / H)), rows = Math.ceil(keys.length / cols), cw = W / cols, chh = H / rows;
  ctx.fillStyle = '#2f5cff'; ctx.fillRect(0, 0, W, H);
  keys.forEach((ch, i) => {
    const x = (i % cols) * cw + cw / 2, y = Math.floor(i / cols) * chh + chh / 2, k = Math.min(chh * 0.62, cw * 0.75) / 100;
    ctx.save(); ctx.translate(x, y); glyph(glyphOf(ch), k, { color: K.yellow }); ctx.restore();
    ctx.font = '600 11px system-ui'; ctx.fillStyle = '#fff'; ctx.fillText(ch, x - cw / 2 + 5, y - chh / 2 + 13);
  });
}
