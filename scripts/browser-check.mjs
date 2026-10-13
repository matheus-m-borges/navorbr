// Optional QA tool. Uses a locally available Playwright; no production dependency.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const results = [];
const errors = [];
const output = process.env.QA_OUTPUT || 'artifacts/hero-revision';
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  for (const [width, height] of [[360,800],[390,844],[768,1024],[1024,900],[1440,900],[1920,1080]]) {
    await page.setViewportSize({ width, height });
    await page.goto(base);
    await page.waitForTimeout(1250);
    const initial = await page.evaluate(() => ({
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      heroCards: document.querySelectorAll('.hero article').length,
      cards: [...document.querySelectorAll('.solution-card')].map(element => ({ name: element.querySelector('h3').textContent })),
      headingVisible: getComputedStyle(document.querySelector('h1')).opacity === '1'
    }));
    assert.ok(initial.scrollWidth <= width, `Overflow horizontal em ${width}px`);
    assert.ok(initial.headingVisible);
    assert.equal(initial.cards.length, 6);
    assert.equal(initial.heroCards,0,'Produtos duplicados no hero');
    await page.screenshot({ path: `${output}/hero-${width}.png` });
    for (let y = 0; y < await page.evaluate(() => document.body.scrollHeight); y += height * .7) {
      await page.evaluate(value => scrollTo(0, value), y);
      await page.waitForTimeout(100);
    }
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
    await page.waitForTimeout(700);
    assert.equal(await page.locator('img').evaluateAll(imgs => imgs.filter(img => !img.complete || !img.naturalWidth).length), 0, 'Imagens não carregadas');
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${output}/page-${width}.png`, fullPage: true });
    results.push({ test: `layout-${width}`, passed: true, ...initial });
  }

  await page.setViewportSize({ width:390,height:844 });
  await page.goto(base);
  const toggle = page.getByRole('button', { name:'Abrir menu' });
  const menu = page.getByRole('dialog');
  await toggle.click();
  assert.ok(await menu.isVisible());
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), 'Foco saiu do menu modal');
  }
  await page.screenshot({ path:`${output}/menu-mobile.png` });
  await page.keyboard.press('Escape');
  // The native dialog queues its close event; wait for the handler to finish.
  await page.waitForFunction(() => document.querySelector('.menu-toggle').getAttribute('aria-expanded') === 'false');
  assert.ok(!await menu.isVisible());
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.ok(await toggle.evaluate(el => el === document.activeElement));
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  await toggle.click();
  await page.getByRole('button', { name:'Fechar menu' }).click();
  await page.waitForFunction(() => document.querySelector('.menu-toggle').getAttribute('aria-expanded') === 'false');
  assert.ok(!await menu.isVisible());
  for (const [name,id] of [['Sistemas','sistemas'],['Empresa','empresa'],['Contato','contato']]) {
    await toggle.click();
    await menu.getByRole('link', { name, exact:true }).click();
    await page.waitForTimeout(250);
    assert.ok(!await menu.isVisible());
    assert.equal(new URL(page.url()).hash, `#${id}`);
    assert.ok(await page.locator(`#${id}`).evaluate(el => el === document.activeElement), `Foco não chegou a ${id}`);
  }
  await toggle.click();
  await page.setViewportSize({ width:1440,height:900 });
  await page.waitForTimeout(100);
  assert.ok(!await menu.isVisible(), 'Menu não fechou na mudança para desktop');
  results.push({ test:'menu-foco-escape-botao-ancoras-resize', passed:true });

  await page.goto(base);
  await page.locator('.desktop-nav').getByRole('link', { name:'Empresa',exact:true }).click();
  await page.waitForTimeout(700);
  assert.equal(await page.locator('.desktop-nav [aria-current]').textContent(), 'Empresa');
  assert.ok(await page.locator('.site-header').evaluate(el => el.classList.contains('scrolled')));
  await page.locator('.desktop-nav').getByRole('link', { name:'Início',exact:true }).click();
  assert.equal(new URL(page.url()).pathname, '/');
  results.push({ test:'navegacao-desktop-cabecalho', passed:true });

  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.reload();
  assert.equal(await page.locator('h1').evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.mouse.move(1200,350);
  assert.ok(!await page.locator('.hero').evaluate(el => el.classList.contains('webgl-ready')));
  results.push({ test:'movimento-reduzido', passed:true });

  const noJs = await browser.newContext({ javaScriptEnabled:false, viewport:{width:360,height:800} });
  const fallback = await noJs.newPage();
  await fallback.goto(base);
  await fallback.waitForTimeout(1250);
  assert.ok(await fallback.locator('h1').isVisible());
  assert.ok(await fallback.locator('.no-js-nav').isVisible());
  await fallback.locator('.no-js-nav').getByRole('link', { name:'Sistemas' }).click();
  assert.equal(new URL(fallback.url()).hash, '#sistemas');
  assert.equal(await fallback.locator('.solution-card:visible').count(), 6);
  assert.ok(await fallback.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await noJs.close();
  results.push({ test:'sem-javascript', passed:true });

  // Read-only navigation: do not submit credentials or alter external applications.
  const external = await browser.newPage();
  for (const url of ['https://barberhub.navorbr.com','https://barberhub.navorbr.com/entrar','https://sis.navorbr.com']) {
    const response = await external.goto(url, { waitUntil:'domcontentloaded', timeout:45000 });
    assert.ok(response.ok(), `Link externo indisponível: ${url} (${response.status()})`);
    results.push({ test:'external-navigation', requested:url, final:external.url(), status:response.status(), title:await external.title() });
  }
  await external.close();
  assert.deepEqual(errors, [], 'Console ou recursos com erros');
  results.push({ test:'console-sem-erros', passed:true });
  console.log(JSON.stringify(results,null,2));
} finally {
  await writeFile(`${output}/browser-results.json`, JSON.stringify({ results, errors },null,2));
  await browser.close();
}
