// Toast and conversation presentation with intercepted services and synthetic text.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin=process.env.TEST_ORIGIN || 'http://localhost:3000';
const backend='https://feedback-check.supabase.co';
const shots=process.env.SCREENSHOT_DIR;
if(shots)mkdirSync(shots,{recursive:true});
const browser=await chromium.launch({executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox']});
try{
 for(const width of [1440,390])for(const role of ['admin','client']){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:width<600,reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];let calls=0;
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin===origin&&url.pathname==='/__feedback_test')return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    ${['tailwind','fa.min','osas','agent','hallmark/tokens','hallmark/surfaces','hallmark/motion','hallmark/loading','hallmark/feedback'].map(name=>`<link rel="stylesheet" href="/css/${name}.css">`).join('')}
    </head><body><main style="padding:24px">OSAS feedback preview</main><div id="toast-root" class="fixed bottom-6 right-6 z-[70]"></div>
    <script>window.OSAS={SUPABASE_URL:'${backend}',SUPABASE_ANON_KEY:'test-key'};</script>
    <script type="module">import {toast} from '/js/ui.js';import {mountAgentChat} from '/js/agent.js';window.showToast=toast;mountAgentChat();window.feedbackReady=true;</script></body></html>`});
   if(url.origin===origin&&url.pathname==='/js/auth.js')return route.fulfill({contentType:'text/javascript',body:`const user={id:'feedback-${role}',name:'Preview ${role}',role:'${role}'};export const currentUser=()=>user;export const isAdmin=()=>user.role==='admin';export const isSignedIn=()=>true;export const currentAccessToken=async()=>'test-token';`});
   if(url.origin===backend){
    assert.equal(role,'admin');assert.equal(url.pathname,'/functions/v1/agent-chat');calls++;
    if(request.postDataJSON().message.includes('unavailable'))return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'The assistant is temporarily unavailable. Please try again.'})});
    return route.fulfill({contentType:'application/json',body:JSON.stringify({reply:'## School update\n\n**Two reports** are ready for review.\n\n- Check the description.\n- Review the evidence.\n\n| Status | Count |\n| --- | --- |\n| Open | 2 |\n\n```text\nA long example record: '+ 'x'.repeat(120)+'\n```'})});
   }
   if(url.origin===origin)return route.continue();return route.abort();
  });
  await page.goto(origin+'/__feedback_test');await page.waitForFunction(()=>window.feedbackReady);
  await page.evaluate(()=>{window.showToast('Your changes were saved.');window.showToast('The update could not be saved. Please retry.','error');});
  const success=page.locator('.osas-toast[data-tone="success"]'),failure=page.locator('.osas-toast[data-tone="error"]');
  assert.equal(await success.getAttribute('role'),'status');assert.equal(await failure.getAttribute('role'),'alert');
  assert.notEqual(await success.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(17, 24, 39)');
  assert.notEqual(await success.evaluate(el=>getComputedStyle(el).boxShadow),'none');
  for(const node of [success,failure]){const box=await node.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);}
  if(shots)await page.screenshot({path:`${shots}/${role}-${width}-toasts.png`});
  await success.getByRole('button',{name:'Dismiss notification',exact:true}).click();await failure.getByRole('button',{name:'Dismiss notification',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.osas-toast'));
  await page.getByRole('button',{name:role==='admin'?'Open OSAS desk':'Open Chatbot',exact:true}).click();
  const chat=page.getByRole('dialog',{name:role==='admin'?'OSAS desk':'Chatbot',exact:true});
  const message=role==='admin'?'Show the incident overview.':'Where can I report an incident?';
  await chat.getByRole('textbox').fill(message);await chat.getByRole('button',{name:'Send message',exact:true}).click();
  await chat.locator('.agent-row.is-assistant').waitFor();
  assert.equal(await chat.locator('.agent-message-sender').textContent(),'You');
  assert.equal(await chat.locator('.agent-reply-heading').count(),0,'Assistant replies should not have a branded header or divider');
  assert.notEqual(await chat.locator('.agent-bubble.is-user').evaluate(el=>getComputedStyle(el).boxShadow),'none');
  assert.notEqual(await chat.locator('.agent-bubble.is-assistant').evaluate(el=>getComputedStyle(el).boxShadow),'none');
  assert.equal(await chat.locator('.agent-messages').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  if(shots)await page.screenshot({path:`${shots}/${role}-${width}-conversation.png`});
  await chat.getByRole('button',{name:'Chat history',exact:true}).click();
  await chat.locator('.agent-history-item').waitFor();assert.equal(await chat.locator('.agent-history-count').textContent(),'2 messages');
  if(shots)await page.screenshot({path:`${shots}/${role}-${width}-history.png`});
  const before=Date.now();await chat.locator('.agent-history-open').click();
  await chat.locator('.agent-history-skeletons').waitFor();await chat.locator('.agent-row.is-user').waitFor();
  assert.ok(Date.now()-before>=1400,'Saved conversations keep the preview loading duration');
  assert.equal(await chat.locator('.agent-row').count(),2);assert.equal(calls,role==='admin'?1:0);
  if(role==='admin'){
   await chat.getByRole('textbox').fill('Test unavailable response');await chat.getByRole('button',{name:'Send message',exact:true}).click();
   await chat.locator('.agent-bubble.is-error').waitFor();assert.match(await chat.locator('.agent-bubble.is-error').textContent(),/temporarily unavailable/);
   if(shots)await page.screenshot({path:`${shots}/${role}-${width}-error.png`});
  }
  await chat.getByRole('button',{name:'Close assistant',exact:true}).click();
  await page.clock.install();await page.mouse.move(0,0);
  await page.evaluate(()=>{window.showToast('Read this update at your own pace.');});
  const paused=page.locator('.osas-toast');await paused.hover();await page.clock.fastForward(6000);assert.equal(await paused.count(),1);
  await paused.getByRole('button',{name:'Dismiss notification',exact:true}).focus();await page.mouse.move(0,0);await page.clock.fastForward(6000);assert.equal(await paused.count(),1,'Keyboard focus must pause dismissal');
  await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('.osas-toast'));
  await page.evaluate(()=>{window.showToast('Automatic dismissal works.');});await page.clock.fastForward(4501);await page.waitForFunction(()=>!document.querySelector('.osas-toast'));
  assert.deepEqual(errors,[]);console.log(`Feedback OK ${role} ${width}px: toast states/dismiss/pause, conversation formatting, history restoration, role boundaries and viewport fit.`);
  await context.close();
 }
}finally{await browser.close()}
