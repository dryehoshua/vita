import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sharp from 'sharp';
import {createApp} from '../server/app.mjs';
import {digest} from '../server/security.mjs';
let db,server,dir;const origin='http://127.0.0.1:20117';const identities={};
function seed(name,roles=[],mfa=false){const id=randomUUID(),session=randomUUID();db.prepare('INSERT INTO users(id,email,password,verified) VALUES(?,?,?,1)').run(id,name+'@example.test','test-not-used');db.prepare('INSERT INTO profiles(id,display_name) VALUES(?,?)').run(id,name);for(const role of roles)db.prepare('INSERT INTO global_roles VALUES(?,?)').run(id,role);db.prepare('INSERT INTO sessions(hash,user_id,expires,aal2) VALUES(?,?,?,?)').run(digest(session),id,Date.now()+3600000,mfa?Date.now()+900000:0);return {id,cookie:'vita_session='+session};}
async function api(path,body,user,method=body?'POST':'GET'){
 const r=await fetch(origin+path,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(user?{Cookie:identities[user].cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};
}
const article=(title='Article test')=>({title,summary:'A short introduction.',language:'es',photos:[],body:'Original article body.',category:'Community',sources:[{title:'Official source',url:'https://example.com/article'}]});
async function create(kind,document,user='writer',organization_id){const r=await api('/api/workspaces',{kind,document,...(organization_id?{organization_id}:{})},user);assert.equal(r.status,201,JSON.stringify(r.body));return r.body.data;}
async function submit(item,user='writer'){const r=await api('/api/workspaces/'+item.id+'/submit',{version:item.version},user);assert.equal(r.status,200,JSON.stringify(r.body));return r.body.data;}
async function publish(item,user='editor'){const r=await api('/api/workspaces/'+item.id+'/review',{version:item.version,action:'publish'},user);assert.equal(r.status,200,JSON.stringify(r.body));return r.body.data;}
before(async()=>{dir=mkdtempSync(join(tmpdir(),'vita-workspaces-'));const x=createApp({dataDir:dir,origin});db=x.db;server=x.app.listen(20117,'127.0.0.1');await new Promise(r=>server.once('listening',r));identities.writer=seed('writer',['writer']);identities.editor=seed('editor',['editor']);identities.guide=seed('guide',['guide']);identities.other=seed('other',[]);identities.owner=seed('owner',[]);identities.staff=seed('staff',[]);identities.admin=seed('admin',['admin'],true);identities.adminWeak=seed('adminWeak',['admin']);db.prepare('INSERT INTO organizations VALUES(?,?)').run('org-a','Organization A');db.prepare('INSERT INTO organizations VALUES(?,?)').run('org-b','Organization B');db.prepare("INSERT INTO memberships VALUES('org-a',?,'owner',1)").run(identities.owner.id);db.prepare("INSERT INTO memberships VALUES('org-a',?,'staff',1)").run(identities.staff.id);});
after(async()=>{await new Promise(r=>server.close(r));db.close();rmSync(dir,{recursive:true,force:true});});
test('workspace roles cannot be self-selected and business stays organization-scoped',async()=>{
 assert.equal((await api('/api/workspaces',{kind:'article',document:article()},'other')).status,403);
 assert.equal((await api('/api/workspaces',{kind:'business',organization_id:'org-b',document:{title:'Other cafe'}},'owner')).status,403);
 assert.equal((await api('/api/workspaces',{kind:'business',organization_id:'org-a',document:{title:'Cafe'}},'staff')).status,403);
 assert.equal((await api('/api/workspaces',undefined,undefined)).status,401);
});
test('private drafts absent from public API and not visible to another writer',async()=>{
 const item=await create('article',article());assert.equal((await api('/api/public/content/'+item.id)).status,404);
 assert.equal((await api('/api/workspaces/'+item.id,undefined,'guide')).status,404);
 const publicList=(await api('/api/public/content')).body.data;assert.equal(publicList.some(x=>x.id===item.id),false);
});
test('review workflow locks submission, requires independent review and preserves old live version',async()=>{
 let item=await create('article',article('Version one'));item=await submit(item);
 assert.equal((await api('/api/workspaces/'+item.id,{version:item.version,document:article('Sneaky edit')},'writer','PUT')).status,409);
 assert.equal((await api('/api/workspaces/'+item.id+'/review',{version:item.version,action:'publish'},'writer')).status,403);
 item=await publish(item);let publicItem=(await api('/api/public/content/'+item.id)).body.data;assert.equal(publicItem.document.title,'Version one');assert.equal(publicItem.author_id,undefined);assert.equal(publicItem.draft,undefined);
 const saved=await api('/api/workspaces/'+item.id,{version:item.version,document:article('Unapproved version two')},'writer','PUT');assert.equal(saved.status,200);item=saved.body.data;
 assert.equal((await api('/api/public/content/'+item.id)).body.data.document.title,'Version one');
 assert.equal((await api('/api/workspaces/'+item.id,{version:1,document:article('Stale tab')},'writer','PUT')).status,409);
 item=await submit(item);const changes=await api('/api/workspaces/'+item.id+'/review',{version:item.version,action:'changes',reason:'Add a factual source.'},'editor');assert.equal(changes.status,200);assert.equal(changes.body.data.status,'changes');assert.equal((await api('/api/public/content/'+item.id)).body.data.document.title,'Version one');
 item=await submit(changes.body.data);item=await publish(item);assert.equal((await api('/api/public/content/'+item.id)).body.data.document.title,'Unapproved version two');
 assert.equal(db.prepare("SELECT count(*) n FROM workspace_revisions WHERE document_id=? AND action='publish'").get(item.id).n,2);
});
test('editor cannot review their own article even with editor role',async()=>{const item=await submit(await create('article',article('Self review'),'editor'),'editor');assert.equal((await api('/api/workspaces/'+item.id+'/review',{version:item.version,action:'publish'},'editor')).status,403);});
test('business menus accept cents, owner scope and MFA-approved publication',async()=>{
 const doc={title:'Cafe A',summary:'Coffee and cookies.',category:'cafe',address:'Public business address',menu:[{name:'Americano',priceCents:5000,currency:'MXN',available:true}],services:[]};
 let item=await create('business',doc,'owner','org-a');
 assert.equal((await api('/api/workspaces/'+item.id,{version:1,document:doc},'staff','PUT')).status,403);
 item=await submit(item,'owner');assert.equal((await api('/api/workspaces/'+item.id+'/review',{version:1,action:'publish'},'adminWeak')).status,403);assert.equal((await api('/api/workspaces/'+item.id+'/review',{version:1,action:'publish'},'editor')).status,403);
 item=await publish(item,'admin');assert.equal((await api('/api/public/content/'+item.id)).body.data.document.menu[0].priceCents,5000);
 assert.equal((await api('/api/workspaces/'+item.id+'/pause',{version:item.version,reason:'Temporary closure'},'admin')).status,200);assert.equal((await api('/api/public/content/'+item.id)).status,404);
});
test('guide/tour service area limited to CDMX, metropolitan area and Teotihuacan',async()=>{
 assert.equal((await api('/api/workspaces',{kind:'tour',document:{title:'Outside scope',areas:['oaxaca']}},'guide')).status,400);
 const g=await create('guide',{title:'Guide name',summary:'Local guide.',bio:'Guide biography.',languages:['es','en'],areas:['cdmx'],hourlyRateCents:50000,minHours:2},'guide');
 await publish(await submit(g,'guide'),'admin');const tour=await create('tour',{title:'Teotihuacán',summary:'Day trip.',languages:['es'],areas:['teotihuacan'],itinerary:'Visit public archaeological areas.',meetingPoint:'Public meeting point',durationMinutes:360,maxGroup:6,priceCents:150000},'guide');
 const item=await publish(await submit(tour,'guide'),'admin');const publicItem=(await api('/api/public/content/'+item.id)).body.data;assert.equal(publicItem.guide_id,g.id);assert.equal(publicItem.document.areas[0],'teotihuacan');
});
test('HTML, executable URLs and extra privilege fields rejected',async()=>{
 assert.equal((await api('/api/workspaces',{kind:'article',document:{...article(),title:'<script>alert(1)</script>'}},'writer')).status,400);
 assert.equal((await api('/api/workspaces',{kind:'article',document:{...article(),sources:[{title:'Unsafe',url:'javascript:alert(1)'}]}},'writer')).status,400);
 assert.equal((await api('/api/workspaces',{kind:'article',document:article(),author_id:identities.admin.id},'writer')).status,400);
});
test('photos are private drafts, converted safely, and public only while referenced by approved content',async()=>{
 const png=await sharp({create:{width:30,height:20,channels:3,background:'#c88'}}).png().toBuffer();
 const upload=await fetch(origin+'/api/workspaces/media',{method:'POST',headers:{Origin:origin,Cookie:identities.writer.cookie,'Content-Type':'image/png'},body:png});assert.equal(upload.status,201);const media=(await upload.json()).data;
 assert.equal((await fetch(origin+media.url)).status,404);assert.equal((await fetch(origin+media.url,{headers:{Cookie:identities.writer.cookie}})).status,200);
 const forged=await api('/api/workspaces',{kind:'tour',document:{title:'Forged photo',photos:[{url:media.url}]}},'guide');assert.equal(forged.status,403);
 let item=await create('article',{...article('Article with a photo'),photos:[{url:media.url,caption:'Our image',credit:'Test photographer',rights:'Owned test image'}]});item=await submit(item);
 assert.equal((await fetch(origin+media.url,{headers:{Cookie:identities.editor.cookie}})).status,200);
 item=await publish(item);const publishedImage=await fetch(origin+media.url);assert.equal(publishedImage.status,200);assert.match(publishedImage.headers.get('content-type'),/image\/webp/);
 await api('/api/workspaces/'+item.id+'/pause',{version:item.version,reason:'Image review'},'editor');assert.equal((await fetch(origin+media.url)).status,404);
 const fake=await fetch(origin+'/api/workspaces/media',{method:'POST',headers:{Origin:origin,Cookie:identities.writer.cookie,'Content-Type':'image/png'},body:'not an image'});assert.equal(fake.status,400);
});
