import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { renderHome } from './access-components.mjs';
const root = path.resolve(import.meta.dirname, '..');
const html = renderHome(await readFile(path.join(root, 'index.html'), 'utf8'));
test('âncoras institucionais têm destinos reais', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  for (const [,id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(id), `Âncora ausente: ${id}`);
  for (const id of ['empresa','sistemas','contato']) assert.ok(ids.has(id));
  assert.equal(ids.size, [...html.matchAll(/\bid="/g)].length, 'IDs devem ser únicos');
});
test('NavalhaHub/BarberHub mantém institucional e login separados', () => {
  for (const match of html.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/g)) {
    const href = match[1].match(/href="([^"]+)"/)?.[1];
    const label = match[1] + match[2];
    if (/Entrar no (NavalhaHub|BarberHub)|>Entrar$/.test(label)) assert.match(href, /(navalhahub|barberhub)/);
    if (/Conhecer (NavalhaHub|BarberHub)/.test(label)) assert.match(href, /(navalhahub|barberhub)/);
    assert.notEqual(href, '#');
  }
});
test('produtos somente em Nossos Sistemas; futuros sem navegação', () => {
  const hero = html.split('<section class="hero"')[1].split('</section>')[0];
  assert.doesNotMatch(hero, /mini-card|hero-products|hero-proof/);
  assert.match(hero, /Conheça nossas soluções/);
  for (const className of ['solution-card']) {
    const cards = [...html.matchAll(new RegExp(`<article class="${className}[^\"]*"[^>]*>([\\s\\S]*?)<\\/article>`, 'g'))];
    assert.equal(cards.length, 6);
    for (const [index, card] of cards.entries()) {
      if (index === 0) assert.match(card[1], /(navalhahub|barberhub)/);
      else { assert.match(card[1], /Em breve/); assert.doesNotMatch(card[1], /<a\b/); }
    }
  }
});
test('recursos locais referenciados existem', async () => {
  for (const [,url] of html.matchAll(/(?:src|href|srcset)="(\/[^"#]*)(?:#[^"]*)?"/g)) {
    if (url !== '/') await access(path.join(root, url === '/acessar' ? '/acessar.html' : url));
  }
});
test('página independente de scripts remotos e integrações privadas', async () => {
  const js = await readFile(path.join(root, 'main.js'), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|localStorage|supabase|stripe|gsap/);
  assert.match(js, /prefers-reduced-motion/);
  assert.match(html, /<dialog[^>]+aria-label=/);
});
