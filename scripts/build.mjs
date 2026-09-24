// Builds the static site into dist/: copies every toy folder and writes the home page.
// Usage: node scripts/build.mjs
import { rmSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadToys } from './lib/toys.mjs';

const DIST = join(ROOT, 'dist');
const SITE = join(ROOT, 'site');

// Label-maker tape colors. A toy picks one with "tape"; otherwise they rotate.
const TAPES = { red: '#c8323c', blue: '#2a4d9b', green: '#2f7a4f', teal: '#17736f', purple: '#5b3a9a', orange: '#b8501a', black: '#1d1d22' };
const ROTATION = ['red', 'blue', 'green', 'purple', 'teal', 'orange', 'black'];

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Embossed letters never sit perfectly straight, so each gets a small, repeatable wobble.
function tapeLetters(text) {
  let h = 0;
  return [...String(text)].map(ch => {
    if (ch === ' ') return ' ';
    h = (h * 31 + ch.charCodeAt(0) + 7) % 997;
    const j = (h % 5) - 2;
    return `<span style="--j:${j}">${esc(ch)}</span>`;
  }).join('');
}
const tape = (text, cls = '') => `<span class="tape${cls ? ' ' + cls : ''}"><span class="tape-text" aria-hidden="true">${tapeLetters(text)}</span><span class="sr">${esc(text)}</span></span>`;

const month = iso => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const initials = title => String(title).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

// Every toy page gets a small Home button in its top-left corner, added here so toys don't each carry one.
// Toys keep that corner clear (their titles start 60px in).
const homeButton = href => `
<a class="toybox-home" href="${href}" aria-label="Home" title="Back to the Toy Box">
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h4.5v-5.5h3V20H18V9.5"/></svg>
</a>
<style>
  .toybox-home { position: fixed; z-index: 1000; top: max(15px, env(safe-area-inset-top)); left: max(14px, env(safe-area-inset-left));
    display: grid; place-items: center; width: 34px; height: 34px; box-sizing: border-box; border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, .3); background: rgba(16, 12, 20, .38); color: rgba(255, 255, 255, .88);
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); text-decoration: none; transition: background-color .15s, border-color .15s, color .15s; }
  .toybox-home:hover { background: rgba(16, 12, 20, .6); border-color: rgba(255, 255, 255, .65); color: #fff; }
  .toybox-home:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
  .toybox-home svg { width: 17px; height: 17px; }
</style>
`;
function addHomeButton(file, depth) {
  const html = readFileSync(file, 'utf8'), snippet = homeButton('../'.repeat(depth)), at = html.search(/<\/body>/i);
  writeFileSync(file, at < 0 ? html + snippet : html.slice(0, at) + snippet + html.slice(at));
}

function card(t, i) {
  const color = TAPES[t.tape] || (/^#[0-9a-f]{6}$/i.test(t.tape || '') ? t.tape : TAPES[ROTATION[i % ROTATION.length]]);
  const href = encodeURIComponent(t.slug) + '/' + (t.entry === 'index.html' ? '' : encodeURI(t.entry));
  const shot = t.hasPreview
    ? `<div class="shot"><img src="${encodeURIComponent(t.slug)}/${encodeURI(t.preview)}" alt="Screenshot of ${esc(t.title)}" loading="${i < 6 ? 'eager' : 'lazy'}" decoding="async"></div>`
    : `<div class="shot shot--blank" aria-hidden="true"><span>${esc(initials(t.title))}</span></div>`;
  const meta = [t.added ? `<time datetime="${esc(t.added)}">${month(t.added)}</time>` : '', ...t.tags.map(x => `<span>${esc(x)}</span>`)].filter(Boolean).join('');
  return `
      <li class="toy" style="--tape:${color}">
        <a href="${href}">
          ${shot}
          <div class="card-body">
            <h2>${tape(t.title)}</h2>
            <p class="blurb">${esc(t.blurb)}</p>
            ${meta ? `<p class="meta">${meta}</p>` : ''}
          </div>
        </a>
      </li>`;
}

const { toys, problems } = loadToys();
if (problems.length) {
  console.error('Build stopped — fix these first:\n' + problems.map(p => '  • ' + p).join('\n'));
  process.exit(1);
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
for (const t of toys) {
  cpSync(t.dir, join(DIST, t.slug), { recursive: true, filter: src => !src.endsWith('toy.json') });
  addHomeButton(join(DIST, t.slug, t.entry), t.entry.split('/').length);
}
for (const f of readdirSync(SITE)) if (f !== 'index.html') cpSync(join(SITE, f), join(DIST, f), { recursive: true });

const count = `${toys.length} ${toys.length === 1 ? 'toy' : 'toys'} on the board`;
const html = readFileSync(join(SITE, 'index.html'), 'utf8')
  .replace('<!--HEADER_TAPE-->', tape('Toy Box', 'tape--xl'))
  .replace('<!--COUNT-->', count)
  .replace('<!--TOYS-->', toys.map(card).join('') || '\n      <li class="empty">No toys yet — add a folder with a toy.json.</li>');
writeFileSync(join(DIST, 'index.html'), html);

const missing = toys.filter(t => !t.hasPreview).map(t => t.slug);
console.log(`Built ${count} → dist/`);
if (missing.length) console.log(`No preview image yet for: ${missing.join(', ')} — run \`npm run shots\`.`);
