// Builds the static site into dist/: copies every toy folder and writes the home page.
// Usage: node scripts/build.mjs
import { rmSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep, posix } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, CATEGORIES, loadToys } from './lib/toys.mjs';
import { esc, tape, tapeColor } from './lib/tape.mjs';

const DIST = join(ROOT, 'dist');
const SITE = join(ROOT, 'site');

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

// Toys that take a moment to start (three.js from the CDN, shader compiles) set "loader": true and get a small
// progress bar, added right after <body> so it paints before their scripts arrive. The toy calls
// window.toyboxReady?.() right after it queues its first frame, and the bar goes away with that frame.
// The bar creeps on the compositor, so it keeps moving while the page is blocked compiling shaders.
const loader = `
<div id="toybox-loader" class="toybox-loader" role="progressbar" aria-label="Loading">
  <span class="toybox-loader-label">Loading</span>
  <span class="toybox-loader-track"><span class="toybox-loader-bar"></span></span>
  <button type="button" class="toybox-loader-retry" hidden>Try again</button>
</div>
<style>
  .toybox-loader { position: fixed; z-index: 999; left: 50%; top: 50%; transform: translate(-50%, -50%); box-sizing: border-box;
    display: grid; justify-items: center; gap: 10px; padding: 14px 18px 16px; border-radius: 14px; pointer-events: none;
    border: 1px solid rgba(255, 255, 255, .3); background: rgba(16, 12, 20, .42); color: rgba(255, 255, 255, .88);
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
    font: 500 10.5px/1 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: .16em; text-transform: uppercase; }
  .toybox-loader-track { position: relative; overflow: hidden; width: 148px; height: 3px; border-radius: 2px; background: rgba(255, 255, 255, .18); }
  .toybox-loader-bar { position: absolute; inset: 0; border-radius: inherit; background: #fff; transform-origin: left;
    transform: scaleX(.04); animation: toybox-loader-creep 14s cubic-bezier(.1, .75, .25, 1) forwards; }
  .toybox-loader-track::after { content: ""; position: absolute; inset: 0; width: 40%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .5), transparent); animation: toybox-loader-sheen 1.5s ease-in-out infinite; }
  .toybox-loader-retry { pointer-events: auto; font: inherit; letter-spacing: .08em; color: #fff; cursor: pointer;
    padding: 7px 12px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, .5); background: rgba(255, 255, 255, .12); }
  .toybox-loader-retry:hover { background: rgba(255, 255, 255, .22); }
  .toybox-loader-retry:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
  .toybox-loader.is-failed { pointer-events: auto; text-transform: none; letter-spacing: .02em; font-size: 13px; }
  .toybox-loader.is-failed .toybox-loader-track { display: none; }
  @keyframes toybox-loader-creep { to { transform: scaleX(.92); } }
  @keyframes toybox-loader-sheen { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
  @media (prefers-reduced-motion: reduce) { .toybox-loader-track::after { display: none; } }
</style>
<script>
(() => {
  const el = document.getElementById('toybox-loader'), retry = el.querySelector('.toybox-loader-retry');
  let settled = false;
  // The toy has just queued its first frame. Removing the bar now means it leaves in the same paint that shows
  // that frame: until then the screen keeps the old picture, bar still creeping.
  window.toyboxReady = () => { if (!settled) { settled = true; el.remove(); } };
  // A script that fails to load, or throws while starting, would otherwise leave the bar creeping forever.
  addEventListener('error', e => {
    if (settled || !(e instanceof ErrorEvent || e.target instanceof HTMLScriptElement)) return;   // a missing font or image isn't fatal
    settled = true;
    el.classList.add('is-failed'); el.setAttribute('role', 'alert');
    el.querySelector('.toybox-loader-label').textContent = 'This toy didn’t load.';
    retry.hidden = false; retry.onclick = () => location.reload();
  }, true);
  // Safety net for a toy that never reports in.
  addEventListener('load', () => setTimeout(window.toyboxReady, 15000));
})();
</script>
`;
function addLoader(file) {
  const html = readFileSync(file, 'utf8'), body = html.match(/<body[^>]*>/i);
  if (!body) throw new Error(`${file} has no <body> tag for the loading bar`);
  const at = body.index + body[0].length;
  writeFileSync(file, html.slice(0, at) + loader + html.slice(at));
}

// Right after a deploy the CDN can still hand out the last deploy's copy of one file for a few minutes, and a toy
// that gets a new module beside an old one it imports fails to start. So a toy page asks for its scripts by content:
// each local <script src> gets ?v=<hash of that file>, and an import map sends every import of the toy's own modules
// (static or dynamic, from any of them) to the same address. A changed file has an address no cache has seen yet.
// The scripts themselves are copied as they are.
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]);
const dotted = p => p.startsWith('../') ? p : './' + p;
function versionScripts(dir, entry) {
  const file = join(dir, entry), at = {};
  for (const f of walk(dir)) {
    if (!/\.m?js$/.test(f)) continue;
    const rel = relative(dirname(file), f).split(sep).join('/');
    at[rel] = rel + '?v=' + createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 10);
  }
  let html = readFileSync(file, 'utf8');
  html = html.replace(/(<script\b[^>]*?\ssrc=)(["'])([^"']+)\2/gi, (m, pre, q, src) => {
    const v = at[posix.normalize(src)];
    return v ? pre + q + v + q : m;
  });
  const imports = Object.fromEntries(Object.entries(at).map(([k, v]) => [dotted(k), dotted(v)]));
  const map = html.match(/(<script\b[^>]*\btype=["']?importmap["']?[^>]*>)([\s\S]*?)(<\/script>)/i);
  if (map) {
    let json;
    try { json = JSON.parse(map[2]); } catch (e) { throw new Error(`${file} has an import map that isn't valid JSON: ${e.message}`); }
    json.imports = { ...imports, ...json.imports };   // the toy's own entries win
    html = html.slice(0, map.index) + map[1] + JSON.stringify(json, null, 2) + map[3] + html.slice(map.index + map[0].length);
  } else {
    const first = html.search(/<script\b[^>]*\btype=["']?module\b/i);
    if (first >= 0) html = html.slice(0, first) + `<script type="importmap">${JSON.stringify({ imports }, null, 2)}</script>\n` + html.slice(first);
  }
  writeFileSync(file, html);
}

// Link previews (iMessage, Slack, social sites): the home page and every toy page get Open Graph tags naming their
// share image, drawn by `npm run og`. A toy without one yet borrows the home page's. Previews need full addresses,
// so the tags name the live site, and the image's address changes with its content so a redrawn one isn't stale.
const SITE_URL = 'https://theboxof.toys';
const versioned = (file, path) => `${SITE_URL}/${path}?v=${createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10)}`;
const HOME_IMAGE = versioned(join(SITE, 'og.png'), 'og.png');
const shareTags = ({ title, description, path, image, alt }) => `
<meta property="og:type" content="website">
<meta property="og:site_name" content="Toy Box">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE_URL}/${path}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(alt)}">
<meta name="twitter:card" content="summary_large_image">`;
function toyShareTags(t) {
  const own = existsSync(join(t.dir, 'og.jpg'));
  return shareTags({
    title: t.title, description: t.blurb, path: encodeURIComponent(t.slug) + '/' + (t.entry === 'index.html' ? '' : encodeURI(t.entry)),
    image: own ? versioned(join(t.dir, 'og.jpg'), `${encodeURIComponent(t.slug)}/og.jpg`) : HOME_IMAGE,
    alt: own ? `A screenshot of ${t.title}, with its name on a label-maker tape` : 'TOY BOX on a red label-maker tape, stuck to a pegboard',
  });
}
// The tags go right after the page's <title>, or at the top of its <head>.
function addShareTags(file, tags) {
  const html = readFileSync(file, 'utf8'), title = html.match(/<\/title>/i), head = html.match(/<head[^>]*>/i), anchor = title || head;
  if (!anchor) throw new Error(`${file} has no <title> or <head> for the link-preview tags`);
  const at = anchor.index + anchor[0].length;
  writeFileSync(file, html.slice(0, at) + tags + html.slice(at));
}

function card(t, i) {
  const color = tapeColor(t, i);
  const href = encodeURIComponent(t.slug) + '/' + (t.entry === 'index.html' ? '' : encodeURI(t.entry));
  const shot = t.hasPreview
    ? `<div class="shot"><img src="${encodeURIComponent(t.slug)}/${encodeURI(t.preview)}" alt="Screenshot of ${esc(t.title)}" loading="${i < 6 ? 'eager' : 'lazy'}" decoding="async"></div>`
    : `<div class="shot shot--blank" aria-hidden="true"><span>${esc(initials(t.title))}</span></div>`;
  const meta = [t.added ? `<time datetime="${esc(t.added)}">${month(t.added)}</time>` : '', ...t.tags.map(x => `<span>${esc(x)}</span>`)].filter(Boolean).join('');
  return `
      <li class="toy"${t.category ? ` data-category="${t.category}"` : ''} data-search="${esc([t.title, ...t.tags].join(' ').toLowerCase())}" style="--tape:${color}">
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
  versionScripts(join(DIST, t.slug), t.entry);
  addHomeButton(join(DIST, t.slug, t.entry), t.entry.split('/').length);
  addShareTags(join(DIST, t.slug, t.entry), toyShareTags(t));
  if (t.loader) addLoader(join(DIST, t.slug, t.entry));
}
for (const f of readdirSync(SITE)) if (f !== 'index.html') cpSync(join(SITE, f), join(DIST, f), { recursive: true });

const count = `${toys.length} ${toys.length === 1 ? 'toy' : 'toys'} on the board`;
// A pill above the board for each category some toy is in; the page's own script does the filtering.
const cats = Object.keys(CATEGORIES).filter(c => toys.some(t => t.category === c));
const filters = cats.length ? `<div class="filters" role="group" aria-label="Show only">${cats.map(c =>
  `<button class="pill" type="button" data-category="${c}" aria-pressed="false">${esc(CATEGORIES[c])}</button>`).join('')}</div>` : '';
const html = readFileSync(join(SITE, 'index.html'), 'utf8')
  .replace('<!--SHARE_TAGS-->', shareTags({ title: 'Toy Box', description: 'A pegboard of small, self-contained browser experiments.', path: '', image: HOME_IMAGE, alt: 'TOY BOX on a red label-maker tape, stuck to a pegboard' }).trim())
  .replace('<!--HEADER_TAPE-->', tape('Toy Box', 'tape--xl'))
  .replace('<!--COUNT-->', count)
  .replace('<!--FILTERS-->', filters)
  .replace('<!--TOYS-->', toys.map(card).join('') || '\n      <li class="empty">No toys yet — add a folder with a toy.json.</li>');
writeFileSync(join(DIST, 'index.html'), html);

const missing = toys.filter(t => !t.hasPreview).map(t => t.slug), unshared = toys.filter(t => !existsSync(join(t.dir, 'og.jpg'))).map(t => t.slug), unsorted = toys.filter(t => !t.category).map(t => t.slug);
console.log(`Built ${count} → dist/`);
if (missing.length) console.log(`No preview image yet for: ${missing.join(', ')} — run \`npm run shots\`.`);
if (unshared.length) console.log(`No share image yet for: ${unshared.join(', ')} — run \`npm run og -- ${unshared.join(' ')}\`; their links show the home page's for now.`);
if (unsorted.length) console.log(`No category yet for: ${unsorted.join(', ')} — they only show with no filter on. Set "category" in toy.json.`);
