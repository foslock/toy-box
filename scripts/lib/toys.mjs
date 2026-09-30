// Finds every toy in the repo: a top-level folder that contains a toy.json.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const DEFAULTS = { entry: 'index.html', preview: 'preview.webp', tags: [], loader: false };
export const CAPTURE_DEFAULTS = { width: 1200, height: 900, scale: 1, wait: 2500, selector: null, query: '' };
// The home page's filters, in the order their pills appear. A toy picks one with "category".
export const CATEGORIES = { games: 'Games', ambient: 'Ambient', interactive: 'Interactive' };

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
    if (toy.position !== undefined && !(Number.isInteger(toy.position) && toy.position >= 1)) problems.push(`${d.name}/toy.json "position" should be a whole number from 1`);
    if (typeof toy.loader !== 'boolean') problems.push(`${d.name}/toy.json "loader" should be true or false`);
    if (toy.category !== undefined && !Object.hasOwn(CATEGORIES, toy.category)) problems.push(`${d.name}/toy.json "category" should be one of ${Object.keys(CATEGORIES).join(', ')}`);
    if (!existsSync(join(toy.dir, toy.entry))) problems.push(`${d.name}/${toy.entry} not found (set "entry" in toy.json if the page has another name)`);
    toy.hasPreview = existsSync(join(toy.dir, toy.preview));
    toys.push(toy);
  }
  // Newest first, then alphabetical.
  toys.sort((a, b) => String(b.added || '').localeCompare(String(a.added || '')) || String(a.title).localeCompare(String(b.title)));
  // Then any toy with a "position" is moved to that spot on the board (1 is the first card).
  const pinned = toys.filter(t => Number.isInteger(t.position) && t.position >= 1).sort((a, b) => a.position - b.position);
  for (const t of pinned) toys.splice(toys.indexOf(t), 1);
  for (const t of pinned) toys.splice(Math.min(t.position - 1, toys.length), 0, t);
  return { toys, problems };
}
