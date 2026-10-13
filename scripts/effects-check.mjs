import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const output=process.env.QA_OUTPUT || 'artifacts/hero-revision';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
const results=[];
const errors=[];
const hash=data=>createHash('sha256').update(data).digest('hex');
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
try {
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.state==='running');
  await page.waitForTimeout(1600);
  const sample=()=>page.locator('canvas').evaluate(c=>({...c.dataset,time:performance.now(),width:c.width,hidden:document.hidden}));
  const first=await sample();
  const clip={x:650,y:100,width:730,height:530};
  const before=await page.screenshot({path:`${output}/rotation-before.png`,clip});
  await page.waitForTimeout(6000);
  const second=await sample();
  const after=await page.screenshot({path:`${output}/rotation-after.png`,clip});
  const delta=(Number(second.angle)-Number(first.angle)+Math.PI*2)%(Math.PI*2);
  const expected=(second.time-first.time)*Math.PI*2/105000;
  assert.ok(Math.abs(delta-expected)<.015,'Velocidade de rotação divergente');
  assert.notEqual(hash(before),hash(after),'Pixels do globo não mudaram');
  assert.ok(second.width<=1000,'DPR/resolução não limitada');
  results.push({test:'rotacao-esferica-real-pixels-e-tempo',passed:true,seconds:(second.time-first.time)/1000,radians:delta,expectedRadians:expected,canvasWidth:second.width});

  await page.mouse.move(1400,610);await page.waitForTimeout(800);
  const tilt=(await sample()).tilt.split(',').map(Number);
  assert.ok(tilt.some(x=>Math.abs(x)>.02),'Mouse não inclinou o globo');
  assert.ok(tilt.every(x=>Math.abs(x)<=Math.PI/60+.00001),'Tilt acima de 3 graus');
  await page.mouse.move(700,850);await page.waitForTimeout(1200);
  assert.ok((await sample()).tilt.split(',').map(Number).every(x=>Math.abs(x)<.001),'Não retornou ao neutro');
  results.push({test:'mouse-3-graus-retorno-suave',passed:true,tilt});

  await page.getByRole('button',{name:'Pausar movimento'}).click();
  const paused=await sample();await page.waitForTimeout(400);
  assert.equal((await sample()).frames,paused.frames);
  await page.getByRole('button',{name:'Retomar movimento'}).click();await page.waitForTimeout(150);
  assert.ok(Number((await sample()).frames)>Number(paused.frames));
  results.push({test:'controle-pausa',passed:true});

  await page.locator('#empresa').scrollIntoViewIfNeeded();await page.waitForTimeout(250);
  const offscreen=await sample();await page.waitForTimeout(400);
  assert.equal(offscreen.state,'paused');assert.equal((await sample()).frames,offscreen.frames);
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(200);
  assert.equal((await sample()).state,'running');
  // Explicit simulation of the Page Visibility event to exercise the handler.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  const hidden=await sample();await page.waitForTimeout(300);
  assert.equal(hidden.state,'paused');assert.equal((await sample()).frames,hidden.frames);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(150);assert.equal((await sample()).state,'running');
  results.push({test:'pausa-fora-da-tela-e-visibilidade-simulada',passed:true});

  await page.evaluate(()=>{window.__oldCanvas=document.querySelector('canvas');});
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>window.__oldCanvas.dataset.state),'disposed');
  assert.equal(await page.locator('.hero').evaluate(el=>el.classList.contains('webgl-ready')),false);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.state==='running');
  assert.ok(await page.evaluate(()=>window.__oldCanvas!==document.querySelector('canvas')));
  assert.equal(await page.evaluate(()=>window.__oldCanvas.dataset.state),'disposed');
  results.push({test:'liberacao-recursos-e-reinicializacao',passed:true});

  await page.locator('#sistemas').scrollIntoViewIfNeeded();await page.waitForTimeout(1200);
  const card=page.locator('.solution-card').first();const bounds=await card.boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.8,bounds.y+bounds.height*.25);await page.waitForTimeout(300);
  const hover=await card.evaluate(el=>({transform:getComputedStyle(el).transform,x:el.style.getPropertyValue('--tilt-x'),y:el.style.getPropertyValue('--tilt-y'),spotlight:getComputedStyle(el,'::before').opacity}));
  assert.ok(hover.transform.startsWith('matrix3d('));assert.ok(Math.abs(parseFloat(hover.x))<=3);assert.ok(Math.abs(parseFloat(hover.y))<=3);assert.equal(hover.spotlight,'1');
  await page.screenshot({path:`${output}/cards-hover.png`});
  await page.mouse.move(10,850);await page.waitForTimeout(300);
  assert.equal(await card.evaluate(el=>getComputedStyle(el).transform),'none');
  assert.equal(await page.locator('.site-header').evaluate(el=>el.classList.contains('scrolled')),true);
  results.push({test:'hover-3d-spotlight-retorno-cabecalho',passed:true,hover});

  await page.goto(base);
  await page.waitForTimeout(1300);
  assert.equal(await page.locator('.solution-card.reveal-pending').count(),6);
  await page.evaluate(()=>scrollTo(0,450));await page.waitForTimeout(100);
  assert.ok(await page.locator('.solution-card.revealing').count()>0);
  const animation=await card.evaluate(el=>({name:getComputedStyle(el).animationName,duration:getComputedStyle(el).animationDuration}));
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('.solution-card.reveal-pending').count(),0);
  results.push({test:'scroll-reveal-cards',passed:true,animation});

  for (const mode of ['mobile','reduce','no-webgl','low-memory','save-data','texture-error']) {
    const ctx=await browser.newContext({viewport:{width:mode==='mobile'?390:1440,height:900},reducedMotion:mode==='reduce'?'reduce':'no-preference',hasTouch:mode==='mobile',isMobile:mode==='mobile'});
    if(mode==='no-webgl') await ctx.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:original.call(this,type,...args);};});
    if(mode==='low-memory') await ctx.addInitScript(()=>Object.defineProperty(navigator,'deviceMemory',{value:2}));
    if(mode==='save-data') await ctx.addInitScript(()=>Object.defineProperty(navigator.connection,'saveData',{value:true}));
    if(mode==='texture-error') await ctx.route('**/earth-night.webp',route=>route.abort());
    const p=await ctx.newPage();let requested3D=false;p.on('request',r=>{if(r.url().endsWith('/globe.js'))requested3D=true;});
    await p.goto(base);await p.waitForTimeout(1800);
    assert.ok(await p.locator('h1').isVisible());
    assert.ok(!await p.locator('.hero').evaluate(el=>el.classList.contains('webgl-ready')));
    assert.ok(await p.locator('.globe-fallback img').evaluate(el=>el.complete&&el.naturalWidth>0));
    if(['mobile','reduce','low-memory','save-data'].includes(mode))assert.equal(requested3D,false);
    if(mode==='mobile')await p.screenshot({path:`${output}/mobile-static.png`});
    results.push({test:`fallback-${mode}`,passed:true,requested3D});await ctx.close();
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify(results,null,2));
} finally {
  await writeFile(`${output}/effects-results.json`,JSON.stringify({results,errors},null,2));
  await browser.close();
}
