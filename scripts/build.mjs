import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const files = ['index.html', 'styles.css', 'main.js', 'globe.js', 'assets', 'favicon.ico', 'favicon.png', 'navorbr-icon.svg', 'navorbr-logo-dark.svg', 'navorbr-logo-light.svg', 'robots.txt'];
await mkdir(path.join(root, 'dist'), { recursive: true });
for (const file of files) await cp(path.join(root, file), path.join(root, 'dist', file), { recursive: true });
async function size(dir) {
  let total = 0;
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, file.name);
    total += file.isDirectory() ? await size(target) : (await stat(target)).size;
  }
  return total;
}
console.log(`Build estático concluído: dist/ (${Math.round(await size(path.join(root, 'dist')) / 1024)} KB). Nenhuma publicação executada.`);
