// Spinner presentation, duration, result restoration, duplicate and cancelled actions.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin=process.env.TEST_ORIGIN || 'http://localhost:3000';
const browser=await chromium.launch({executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin!==origin)return route.abort();
  if(url.pathname!=='/__loading_test')return route.continue();
  return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/tailwind.css"><link rel="stylesheet" href="/css/osas.css"><link rel="stylesheet" href="/css/hallmark/loading.css"></head><body><div id="fixture"></div><script type="module">
   import {h} from '/js/ui.js';
   window.calls=0;window.mode='success';
   window.create=()=>{const button=h('button',{id:'check',type:'button',class:'btn-primary',onclick:async event=>{
     window.actor=event.currentTarget.id;window.calls++;
     try {if(window.mode==='long')await new Promise(resolve=>{window.finish=resolve});if(window.mode==='failure')throw Error('Synthetic failure');window.outcome='success';}
     catch(error){window.outcome=error.message;}
   }},h('span',{},'Run check'));document.getElementById('fixture').replaceChildren(button);};window.create();window.ready=true;
  </script></body></html>`});
 });
 await page.goto(origin+'/__loading_test');await page.waitForFunction(()=>window.ready);
 const button=page.locator('#check');const initial=await button.boundingBox();const started=Date.now();
 await button.click();
 assert.equal(await button.getAttribute('aria-busy'),'true');
 const appearance=await button.evaluate(el=>({text:getComputedStyle(el).color,children:getComputedStyle(el.firstElementChild).visibility,spinner:getComputedStyle(el,'::after').content}));
 assert.equal(appearance.children,'hidden');assert.match(appearance.text,/0\)/);assert.notEqual(appearance.spinner,'none');
 assert.equal(Math.round((await button.boundingBox()).width),Math.round(initial.width));
 await page.evaluate(()=>document.getElementById('check').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
 await page.waitForFunction(()=>window.outcome==='success'&&!document.getElementById('check').classList.contains('is-pending-action'));
 assert.ok(Date.now()-started>=1400 && Date.now()-started<2800, 'A quick action should use the 1.5-second default');assert.equal(await page.evaluate(()=>window.calls),1);assert.equal(await page.evaluate(()=>window.actor),'check');
 assert.equal(await button.innerText(),'Run check');assert.equal(await button.isEnabled(),true);assert.equal(await button.getAttribute('aria-busy'),null);
 await page.evaluate(()=>{window.create();window.mode='long';window.outcome='';});await button.click();
 await page.waitForFunction(()=>!!window.finish);assert.equal(await button.getAttribute('aria-busy'),'true');
 await page.evaluate(()=>window.finish());await page.waitForFunction(()=>!document.getElementById('check').classList.contains('is-pending-action'));
 await page.evaluate(()=>{window.create();window.mode='failure';window.outcome='';});await button.click();
 await page.waitForFunction(()=>window.outcome==='Synthetic failure'&&!document.getElementById('check').classList.contains('is-pending-action'));
 assert.equal(await button.innerText(),'Run check');assert.equal(await button.isEnabled(),true);
 await page.evaluate(()=>{window.create();window.beforeCancel=window.calls;});await button.click();await page.evaluate(()=>document.getElementById('check').remove());
 await page.waitForTimeout(1600);assert.equal(await page.evaluate(()=>window.calls===window.beforeCancel),true);
 await page.evaluate(async()=>{
  const {h,openModal}=await import('/js/ui.js');
  const ready=new Promise(resolve=>{window.resolveDialog=resolve});
  window.pendingDialog=openModal(h('div',{class:'p-6'},h('h3',{},'Pending image data')), {ready});
 });
 await page.locator('.osas-modal-loader').waitFor();
 await page.waitForTimeout(1600);
 assert.equal(await page.locator('.osas-modal-loader').count(),1,'Unfinished data must keep the skeleton beyond 1.5 seconds');
 await page.evaluate(()=>window.resolveDialog());
 await page.locator('.osas-modal-loader').waitFor({state:'detached'});
 await page.evaluate(()=>window.pendingDialog.close());
 console.log('Loading buttons OK: 1.5-second minimum, spinner-only contents, stable size, one action per click sequence, live-event target, slow/failure restoration and cancellation.');
} finally {await browser.close()}
