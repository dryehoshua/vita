import {test} from 'node:test';import assert from 'node:assert/strict';import worker from '../infra/cloudflare/worker.mjs';
test('static requests stay on assets and developer mailbox never proxies',async()=>{let assets=0;const env={ASSETS:{fetch:()=>{assets++;return new Response('asset');}}};assert.equal(await(await worker.fetch(new Request('https://roma-condesa.app/'),env)).text(),'asset');assert.equal((await worker.fetch(new Request('https://roma-condesa.app/dev/mail'),env)).status,404);assert.equal(assets,1);});
test('unconfigured bridge fails closed without revealing secrets',async()=>assert.equal((await worker.fetch(new Request('https://roma-condesa.app/api/auth/me'),{})).status,503));
test('account config stays importable during outages without claiming accounts are online',async()=>{
 const request=new Request('https://roma-condesa.app/account-config.js');
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response('Tunnel unavailable',{status:503});
 try{
  for(const env of [{},{BACKEND_ORIGIN:'https://example.test',VITA_GATEWAY_KEY:'test-only-secret'}]){
   const response=await worker.fetch(request,env);
   assert.equal(response.status,200);
   assert.match(response.headers.get('Content-Type'),/^text\/javascript/);
   assert.equal(response.headers.get('Cache-Control'),'no-store');
   assert.equal(await response.text(),'export const accountConfig={enabled:false};');
  }
 }finally{globalThis.fetch=original;}
});
test('bridge replaces attacker gateway header and disables caching',async()=>{const original=globalThis.fetch;let seen;globalThis.fetch=async r=>{seen=r;return new Response('{"ok":true}');};try{const res=await worker.fetch(new Request('https://roma-condesa.app/api/health',{headers:{'x-vita-gateway':'forged'}}),{BACKEND_ORIGIN:'https://example.trycloudflare.com',VITA_GATEWAY_KEY:'test-only-secret'});assert.equal(seen.headers.get('x-vita-gateway'),'test-only-secret');assert.equal(new URL(seen.url).pathname,'/api/health');assert.equal(res.headers.get('Cache-Control'),'no-store');assert.equal(res.headers.has('x-vita-gateway'),false);}finally{globalThis.fetch=original;}});
test('the Worker records HTML navigation privately and redirects analytics to the account',async()=>{
 const original=globalThis.fetch;
 let event;
 globalThis.fetch=async(url,options)=>{event={url,options};return new Response(null,{status:204});};
 try{
  const env={BACKEND_ORIGIN:'https://example.test',VITA_GATEWAY_KEY:'test-only-secret',ASSETS:{fetch:()=>new Response('<html>',{headers:{'content-type':'text/html'}})}};
  let tracking;
  assert.equal((await worker.fetch(new Request('https://roma-condesa.app/guias'),env,{waitUntil(p){tracking=p;}})).status,200);
  await tracking;
  assert.equal(event.url.pathname,'/api/internal/page-view');
  assert.deepEqual(JSON.parse(event.options.body),{path:'/guias'});
  assert.equal((await worker.fetch(new Request('https://roma-condesa.app/api/internal/page-view'),env)).status,404);
  assert.equal((await worker.fetch(new Request('https://analytics.roma-condesa.app/'),env)).headers.get('Location'),'https://roma-condesa.app/cuenta?view=analytics');
 }finally{globalThis.fetch=original;}
});
