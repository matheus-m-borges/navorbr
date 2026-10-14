import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { renderHome, renderAccess } from './access-components.mjs';
const built = process.argv.includes('--dist');
const root = path.resolve(import.meta.dirname, '..', process.argv.includes('--dist') ? 'dist' : '.');
const port = Number(process.env.PORT || 4173);
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.ico':'image/x-icon', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8' };
http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const publicPath = pathname === '/' ? '/index.html' : /^\/acessar\/?$/.test(pathname) ? '/acessar.html' : pathname;
    const target = path.resolve(root, '.' + publicPath);
    const relative = path.relative(root, target);
    const allowed = ['index.html','acessar.html','styles.css','access.css','navigation.js','access.js','main.js','globe.js','robots.txt'].includes(relative) || /^(favicon|navorbr-)/.test(relative) || relative.startsWith('assets' + path.sep);
    if (!allowed || relative.startsWith('..') || !(await stat(target)).isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff' });
    if (!built && ['index.html','acessar.html'].includes(relative)) {
      const home = await readFile(path.join(root, 'index.html'), 'utf8');
      res.end(relative === 'index.html' ? renderHome(home) : renderAccess(home, await readFile(target, 'utf8')));
    } else res.end(await readFile(target));
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Prévia local: http://127.0.0.1:${port}`));
