// Tiny static file server for local preview and screenshots. Not used on Render.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, extname, normalize, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

export function serve(root, port = 0) {
  const base = normalize(root.endsWith(sep) ? root : root + sep);
  const server = createServer((req, res) => {
    const raw = new URL(req.url, 'http://localhost').pathname;
    let file = normalize(join(base, decodeURIComponent(raw)));
    if (!file.startsWith(base) && file + sep !== base) { res.writeHead(403).end(); return; }
    try {
      let st = statSync(file);
      if (st.isDirectory()) {
        if (!raw.endsWith('/')) { res.writeHead(301, { Location: raw + '/' }).end(); return; }
        file = join(file, 'index.html'); st = statSync(file);
      }
      res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}
