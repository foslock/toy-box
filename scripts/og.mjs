// Draws the link-preview images (Open Graph) that iMessage, Slack and social sites show for a shared link, with your
// installed Chrome: site/og.png is the home page's TOY BOX label on the pegboard, and each toy gets og.jpg, its
// preview screenshot with its name label stuck on it. They're drawn with the home page's own stylesheet, so the
// labels match the board. Run locally and commit the images, like the previews; the build adds the tags.
//
//   npm run og            → the home page and every toy
//   npm run og -- cave    → just these toys (after `npm run shots -- cave`, say)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadToys } from './lib/toys.mjs';
import { serve } from './lib/serve.mjs';
import { findChrome, launchChrome } from './lib/chrome.mjs';
import { tape, tapeColor } from './lib/tape.mjs';

// 1200×630, the size every preview expects, drawn at 2× so the board's holes and the tape match the site's scale.
const W = 600, H = 315, SCALE = 2;
const CSS = `
  body.og { width: ${W}px; height: ${H}px; margin: 0; overflow: hidden; position: relative; }
  /* the home page: its header label alone on the pegboard, the rows of holes set evenly top and bottom */
  body.og-home { display: grid; place-items: center; background-position: 0 ${(H % 30) / 2}px, 0 ${(H % 30) / 2 + 1.5}px; }
  body.og-home h1 { margin: 0; }
  body.og-home .tape--xl { font-size: 72px; }
  /* a toy: its screenshot filling the frame, its name label stuck on the lower left like on its card */
  body.og-toy { background: #0b0c10; }
  .og-shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .og-label { position: absolute; left: 24px; bottom: 26px; margin: 0; font-size: inherit; }
  .og-label .tape { font-size: 26px; font-weight: 800; transform: rotate(-2.2deg); padding: .34em .55em .3em calc(.55em + .14em); }
`;

// Runs in the page: puts one image's markup in the body, waits for its picture and the label font, and shrinks a
// label too long for the frame.
const draw = async ({ cls, html, text }) => {
  document.body.className = cls;
  document.body.innerHTML = html;
  await document.fonts.load('800 40px "Martian Mono"', text);
  await document.fonts.ready;
  await Promise.all([...document.images].map(i => i.decode()));
  const label = document.querySelector('.og-label .tape'), room = innerWidth - 48;
  if (label && label.offsetWidth > room) label.style.fontSize = `${parseFloat(getComputedStyle(label).fontSize) * room / label.offsetWidth}px`;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
};

const named = process.argv.slice(2).filter(a => !a.startsWith('--'));
const { toys, problems } = loadToys();
if (problems.length) console.warn('Heads up:\n' + problems.map(p => '  • ' + p).join('\n'));
const unknown = named.filter(n => !toys.some(t => t.slug === n));
if (unknown.length) { console.error(`No toy folder with a toy.json named: ${unknown.join(', ')}`); process.exit(1); }

const jobs = [];
if (!named.length) jobs.push({ name: 'site/og.png', out: join(ROOT, 'site', 'og.png'), format: 'png', cls: 'og og-home', text: 'Toy Box', html: `<h1>${tape('Toy Box', 'tape--xl')}</h1>` });
toys.forEach((t, i) => {
  if (named.length && !named.includes(t.slug)) return;
  if (!t.hasPreview) { console.warn(`– ${t.slug}: no preview image yet, so no share image. Run \`npm run shots -- ${t.slug}\` first.`); return; }
  const y = t.share?.y ?? 50;   // how far down the screenshot the 1.91:1 crop sits, in percent
  jobs.push({
    name: `${t.slug}/og.jpg`, out: join(t.dir, 'og.jpg'), format: 'jpeg', cls: 'og og-toy', text: t.title,
    html: `<img class="og-shot" src="/${encodeURIComponent(t.slug)}/${encodeURI(t.preview)}" alt="" style="object-position: 50% ${y}%">`
      + `<p class="og-label">${tape(t.title).replace('class="tape"', `class="tape" style="--tape:${tapeColor(t, i)}"`)}</p>`,
  });
});

const bin = findChrome();
if (!bin) { console.error('Chrome not found. Install Google Chrome or set CHROME_PATH.'); process.exit(1); }

const { server, url } = await serve(ROOT);
const chrome = await launchChrome(bin);
let failed = 0;
const { targetId } = await chrome.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await chrome.send('Target.attachToTarget', { targetId, flatten: true });
const s = (method, params) => chrome.send(method, params, sessionId);
try {
  await s('Page.enable');
  await s('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
  await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  // The home page source carries the stylesheet and fonts; each image then swaps in its own body.
  const loaded = chrome.once('Page.loadEventFired', sessionId);
  await s('Page.navigate', { url: `${url}/site/index.html` });
  await loaded;
  await s('Runtime.evaluate', { expression: `document.head.insertAdjacentHTML('beforeend', ${JSON.stringify(`<style>${CSS}</style>`)})` });
  for (const job of jobs) {
    try {
      const { exceptionDetails } = await s('Runtime.evaluate', { awaitPromise: true, expression: `(${draw})(${JSON.stringify(job)})` });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
      const { data } = await s('Page.captureScreenshot', { format: job.format, ...(job.format === 'jpeg' && { quality: 86 }) });
      writeFileSync(job.out, Buffer.from(data, 'base64'));
      console.log(`✓ ${job.name}`);
    } catch (e) {
      failed++; console.error(`✗ ${job.name}: ${e.message}`);
    }
  }
} finally {
  chrome.close(); server.close();
}
process.exit(failed ? 1 : 0);
