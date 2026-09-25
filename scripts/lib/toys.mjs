// Finds every toy in the repo: a top-level folder that contains a toy.json.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const DEFAULTS = { entry: 'index.html', preview: 'preview.webp', tags: [], loader: false };
export const CAPTURE_DEFAULTS = { width: 1200, height: 900, scale: 1, wait: 2500, selector: null, query: '' };

export function loadToys() {
  const toys = [], problems = [];
  for (const d of readdirSync(ROOT, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.')) continue;
    const manifest = join(ROOT, d.name, 'toy.json');
    if (!existsSync(manifest)) continue;

    let m;
    try { m = JSON.parse(readFileSync(manifest, 'utf8')); }
    catch (e) { problems.push(`${d.name}/toy.json is not valid JSON: ${e.message}`); continue; }

    const toy = { ...DEFAULTS, ...m, slug: d.name, dir: join(ROOT, d.name) };
    toy.capture = { ...CAPTURE_DEFAULTS, ...m.capture };
    if (!toy.title) problems.push(`${d.name}/toy.json needs a "title"`);
    if (!toy.blurb) problems.push(`${d.name}/toy.json needs a "blurb"`);
    if (toy.added && !/^\d{4}-\d{2}-\d{2}$/.test(toy.added)) problems.push(`${d.name}/toy.json "added" should look like 2026-09-23`);
    if (typeof toy.loader !== 'boolean') problems.push(`${d.name}/toy.json "loader" should be true or false`);
    if (!existsSync(join(toy.dir, toy.entry))) problems.push(`${d.name}/${toy.entry} not found (set "entry" in toy.json if the page has another name)`);
    toy.hasPreview = existsSync(join(toy.dir, toy.preview));
    toys.push(toy);
  }
  // Newest first, then alphabetical.
  toys.sort((a, b) => String(b.added || '').localeCompare(String(a.added || '')) || String(a.title).localeCompare(String(b.title)));
  return { toys, problems };
}
