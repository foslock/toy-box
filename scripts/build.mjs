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
for (const t of toys) cpSync(t.dir, join(DIST, t.slug), { recursive: true, filter: src => !src.endsWith('toy.json') });
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
