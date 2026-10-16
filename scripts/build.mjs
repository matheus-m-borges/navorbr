import { cp, mkdir, readdir, stat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderHome, renderAccess } from './access-components.mjs';
const root = path.resolve(import.meta.dirname, '..');
const files = ['styles.css', 'access.css', 'navigation.js', 'access.js', 'main.js', 'globe.js', 'assets', 'favicon.ico', 'favicon.png', 'navorbr-icon.svg', 'navorbr-logo-dark.svg', 'navorbr-logo-light.svg', 'robots.txt', 'navalhahub.html'];
await mkdir(path.join(root, 'dist'), { recursive: true });
for (const file of files) await cp(path.join(root, file), path.join(root, 'dist', file), { recursive: true });
const home = await readFile(path.join(root, 'index.html'), 'utf8');
const access = await readFile(path.join(root, 'acessar.html'), 'utf8');
await writeFile(path.join(root, 'dist/index.html'), renderHome(home));
await writeFile(path.join(root, 'dist/acessar.html'), renderAccess(home, access));
async function size(dir) {
  let total = 0;
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, file.name);
    total += file.isDirectory() ? await size(target) : (await stat(target)).size;
  }
  return total;
}
console.log(`Build estático concluído: dist/ (${Math.round(await size(path.join(root, 'dist')) / 1024)} KB). Nenhuma publicação executada.`);
