// Captures each toy's preview image with your installed Chrome (headless, via the DevTools protocol).
// Run locally and commit the images; the Render build never needs a browser.
//
//   npm run shots            → toys that don't have a preview yet
//   npm run shots -- cave    → just these toys (re-captures)
//   npm run shots -- --all   → every toy
//
// Set CHROME_PATH if Chrome lives somewhere unusual. Needs Node 22+ (built-in WebSocket).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, loadToys } from './lib/toys.mjs';
import { serve } from './lib/serve.mjs';

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
];

async function launchChrome(bin) {
  const profile = mkdtempSync(join(tmpdir(), 'toy-box-chrome-'));
  const proc = spawn(bin, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not start within 15s')), 15000);
    proc.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
    proc.on('exit', code => reject(new Error(`Chrome exited early (code ${code})`)));
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('Could not connect to Chrome')); });

  let nextId = 0;
  const pending = new Map(), listeners = new Set();
  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else for (const l of listeners) l(msg);
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const once = (method, sessionId) => new Promise(resolve => {
    const l = m => { if (m.method === method && m.sessionId === sessionId) { listeners.delete(l); resolve(m.params); } };
    listeners.add(l);
  });
  const close = () => { try { ws.close(); } catch {} proc.kill(); setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500); };
  return { send, once, close };
}

async function capture(chrome, url, cap, out) {
  const { targetId } = await chrome.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await chrome.send('Target.attachToTarget', { targetId, flatten: true });
  const s = (method, params) => chrome.send(method, params, sessionId);
  try {
    await s('Page.enable');
    await s('Emulation.setDeviceMetricsOverride', { width: cap.width, height: cap.height, deviceScaleFactor: cap.scale, mobile: false });
    const loaded = chrome.once('Page.loadEventFired', sessionId);
    await s('Page.navigate', { url });
    await loaded;
    await new Promise(r => setTimeout(r, cap.wait));
    let clip;
    if (cap.selector) {
      const { result } = await s('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => { const el = document.querySelector(${JSON.stringify(cap.selector)}); if (!el) return null;
          const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; })()`,
      });
      if (!result.value) throw new Error(`nothing matches capture.selector "${cap.selector}"`);
      clip = { ...result.value, scale: 1 };
    }
    const { data } = await s('Page.captureScreenshot', { format: 'webp', quality: 88, ...(clip && { clip }) });
    writeFileSync(out, Buffer.from(data, 'base64'));
  } finally {
    await chrome.send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

const args = process.argv.slice(2);
const all = args.includes('--all');
const named = args.filter(a => !a.startsWith('--'));
const { toys, problems } = loadToys();
if (problems.length) console.warn('Heads up:\n' + problems.map(p => '  • ' + p).join('\n'));

const unknown = named.filter(n => !toys.some(t => t.slug === n));
if (unknown.length) { console.error(`No toy folder with a toy.json named: ${unknown.join(', ')}`); process.exit(1); }
const todo = toys.filter(t => all || (named.length ? named.includes(t.slug) : !t.hasPreview));
if (!todo.length) { console.log('Every toy already has a preview. Name toys or pass --all to re-capture.'); process.exit(0); }

const bin = process.env.CHROME_PATH || CHROME_CANDIDATES.find(p => existsSync(p));
if (!bin) { console.error('Chrome not found. Install Google Chrome or set CHROME_PATH.'); process.exit(1); }

const { server, url } = await serve(ROOT);
const chrome = await launchChrome(bin);
let failed = 0;
for (const t of todo) {
  const page = `${url}/${encodeURIComponent(t.slug)}/${encodeURI(t.entry)}${t.capture.query || ''}`;
  const out = join(t.dir, t.preview);
  try {
    await capture(chrome, page, t.capture, out);
    console.log(`✓ ${t.slug}/${t.preview}`);
  } catch (e) {
    failed++; console.error(`✗ ${t.slug}: ${e.message}`);
  }
}
chrome.close(); server.close();
process.exit(failed ? 1 : 0);
