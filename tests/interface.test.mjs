import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const html=await readFile('dist/cuenta.html','utf8');
let current,store,calls;
function mockClient(){
 const ok=data=>Promise.resolve({data,error:null});
 return {auth:{onAuthStateChange:()=>{},getSession:()=>ok({session:current?{}:null}),getUser:()=>ok({user:current}),signUp:x=>{calls.push(['signup',x]);return ok({});},signInWithPassword:x=>{calls.push(['login',x]);current={id:'u1',email:x.email};return ok({});},resetPasswordForEmail:(...x)=>{calls.push(['reset',...x]);return ok({});},signOut:()=>{current=null;return ok({});},mfa:{getAuthenticatorAssuranceLevel:()=>ok({currentLevel:'aal1'}),listFactors:()=>ok({totp:[],all:[]})}},
 from:table=>{let single=false;const q={select:()=>q,eq:()=>q,order:()=>q,single:()=>{single=true;return q;},update:x=>{calls.push(['update',table,x]);return q;},insert:x=>{calls.push(['insert',table,x]);return q;},then:(resolve,reject)=>ok(single?store[table][0]:store[table]||[]).then(resolve,reject)};return q;}};
}
async function mount(enabled=false,loggedIn=false){
 const dom=new JSDOM(html,{url:'https://roma-condesa.app/cuenta'});
 for(const k of ['document','location','history','sessionStorage','FormData'])globalThis[k]=dom.window[k];
 current=loggedIn?{id:'u1',email:'test@example.test'}:null;calls=[];store={profiles:[{display_name:'Ana',residence:'cdmx'}],global_roles:[],memberships:[],favorites:[],point_entries:[],access_requests:[]};
 globalThis.vitaMock=mockClient;
 const dir=await mkdtemp(join(tmpdir(),'vita-test-'));const file=join(dir,'account.mjs');
 await build({entryPoints:['src/accounts/account.js'],bundle:true,format:'esm',outfile:file,plugins:[{name:'test-services',setup(b){b.onResolve({filter:/^(\.\/local-client\.js|\/account-config.js)$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path.includes('config')?`export const accountConfig={enabled:${enabled},provider:'local',siteUrl:'https://roma-condesa.app',privacyUrl:'/privacidad'};`:'export const createClient=globalThis.vitaMock;',loader:'js'}));}}]});
 await import(file);await rm(dir,{recursive:true});return dom;
}
const tick=()=>new Promise(r=>setTimeout(r,20));
test('unconfigured page fails closed and offers both languages',async()=>{await mount();assert.equal(document.querySelector('fieldset').disabled,true);assert.match(document.body.textContent,/Servidor local no conectado/);document.querySelector('#account-language').value='en';document.querySelector('#account-language').dispatchEvent(new document.defaultView.Event('change'));await tick();assert.match(document.body.textContent,/Local server not connected/);});
test('public registration has no privileged role selector',async()=>{await mount(true);document.querySelector('[data-action=signup]').click();await tick();assert.equal(document.querySelector('[name=role]'),null);assert.equal(document.querySelector('[name=password]').minLength,12);const f=document.querySelector('#auth-form');f.elements.name.value='Ana';f.elements.email.value='ana@example.test';f.elements.password.value='long-test-password';f.dispatchEvent(new document.defaultView.Event('submit',{cancelable:true}));await tick();assert.deepEqual(calls[0][1].options.data,{display_name:'Ana'});assert.match(document.querySelector('#notice').textContent,/Verificación guardada/);});
test('login displays actual profile and zero points, no demo balance',async()=>{await mount(true);const f=document.querySelector('#auth-form');f.elements.email.value='ana@example.test';f.elements.password.value='long-test-password';f.dispatchEvent(new document.defaultView.Event('submit',{cancelable:true}));await tick();assert.ok(document.querySelector('#profile-form'));assert.equal(document.querySelector('#profile-form [name=name]').value,'Ana');assert.match(document.querySelector('.metric').textContent,/0/);assert.doesNotMatch(document.body.textContent,/1,250|Sofía/);assert.equal(document.querySelector('[data-action=admin]'),null);});
test('password reset points to the correct return flow',async()=>{await mount(true);document.querySelector('[data-action=reset]').click();await tick();const f=document.querySelector('#auth-form');f.elements.email.value='ana@example.test';f.dispatchEvent(new document.defaultView.Event('submit',{cancelable:true}));await tick();assert.equal(calls[0][2].redirectTo,'https://roma-condesa.app/cuenta?flow=recovery');assert.match(document.querySelector('#notice').textContent,/Si la cuenta existe/);});
test('profile saves only allowed fields',async()=>{await mount(true,true);const f=document.querySelector('#profile-form');f.elements.name.value='Ana CDMX';f.elements.residence.value='tourist';f.dispatchEvent(new document.defaultView.Event('submit',{cancelable:true}));await tick();assert.deepEqual(calls[0],['update','profiles',{display_name:'Ana CDMX',residence:'tourist',language:'es'}]);});
test('request enters review, never grants role client-side',async()=>{await mount(true,true);const f=document.querySelector('#request-form');f.elements.name.value='Mi negocio';f.dispatchEvent(new document.defaultView.Event('submit',{cancelable:true}));await tick();assert.deepEqual(calls[0],['insert','access_requests',{user_id:'u1',kind:'business',name:'Mi negocio'}]);});
test('stored names are escaped and logout clears private dashboard',async()=>{await mount(true,true);store.profiles[0].display_name='<img src=x onerror=alert(1)>';document.querySelector('#account-language').dispatchEvent(new document.defaultView.Event('change'));await tick();assert.equal(document.querySelectorAll('img[onerror]').length,0);document.querySelector('[data-action=logout]').click();await tick();assert.equal(document.querySelector('#profile-form'),null);assert.ok(document.querySelector('#auth-form'));});
