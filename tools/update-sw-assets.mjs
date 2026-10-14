// Entwicklungswerkzeug: aktualisiert die Liste der vorab gecachten Dateien in sw.js.
// Aufruf: node tools/update-sw-assets.mjs   (danach CACHE_VERSION erhöhen)
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INCLUDE = ['index.html', 'manifest.webmanifest', 'css', 'js', 'assets'];
const SKIP = /\.(txt|md)$/;

function walk(p, out) {
  if (statSync(p).isDirectory()) for (const f of readdirSync(p).sort()) walk(join(p, f), out);
  else if (!SKIP.test(p)) out.push(`./${relative(ROOT, p).split('\\').join('/')}`);
  return out;
}

const files = ['./', ...INCLUDE.flatMap(i => walk(join(ROOT, i), []))];
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const list = `const ASSETS = [\n${files.map(f => `  '${f}',`).join('\n')}\n];`;
writeFileSync(join(ROOT, 'sw.js'), sw.replace(/const ASSETS = \[[\s\S]*?\];/, list));
console.log(`${files.length} Dateien in sw.js eingetragen.`);
