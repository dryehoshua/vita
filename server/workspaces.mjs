import {randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import express from 'express';
import sharp from 'sharp';

const kinds=['business','guide','tour','article'];
const areas=['cdmx','metropolitan','teotihuacan'];
const plain=(value,max=200,required=false)=>{
 if(value===undefined||value===null)value='';
 if(typeof value!=='string'||value.length>max||/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)||(required&&!value.trim()))throw Object.assign(Error('Invalid text field'),{status:400});
 return value.trim();
};
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
function https(value){if(!value)return '';let u;try{u=new URL(value);}catch{fail(400,'Use a valid HTTPS URL');}if(u.protocol!=='https:'||u.username||u.password||u.href.length>2048)fail(400,'Use a valid HTTPS URL');return u.href;}
function integer(value,min,max,fallback=0){if(value===undefined)value=fallback;if(!Number.isSafeInteger(value)||value<min||value>max)fail(400,'Invalid numeric field');return value;}
function list(value,max,convert){if(value===undefined)return [];if(!Array.isArray(value)||value.length>max)fail(400,'Invalid list');return value.map(convert);}
function object(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail(400,'Unsupported document fields');return value;}

export function mountWorkspaces(app,{db,authenticated,isAdmin,dataDir=resolve('.local-data')}){
 const dir=join(dataDir,'workspace-media');mkdirSync(dir,{recursive:true,mode:0o700});
 db.exec(`CREATE TABLE IF NOT EXISTS workspace_documents(
 id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('business','guide','tour','article')),
 author_id TEXT NOT NULL REFERENCES users(id),organization_id TEXT REFERENCES organizations(id),
 version INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','changes','published','paused')),
 draft TEXT NOT NULL,published_document TEXT,published_version INTEGER,published_at TEXT,published_active INTEGER NOT NULL DEFAULT 0,
 feedback TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE UNIQUE INDEX IF NOT EXISTS one_guide_profile ON workspace_documents(author_id) WHERE kind='guide';
 CREATE TABLE IF NOT EXISTS workspace_revisions(id INTEGER PRIMARY KEY,document_id TEXT NOT NULL REFERENCES workspace_documents(id),version INTEGER NOT NULL,
 action TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),document TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS workspace_media(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),filename TEXT NOT NULL UNIQUE,width INTEGER NOT NULL,height INTEGER NOT NULL,bytes INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE INDEX IF NOT EXISTS workspace_kind_status ON workspace_documents(kind,status);`);
 const get=(sql,...args)=>db.prepare(sql).get(...args),all=(sql,...args)=>db.prepare(sql).all(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const out=fn();db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}};
 const role=(u,r)=>!!get('SELECT 1 FROM global_roles WHERE user_id=? AND role=?',u,r);
 const owner=(u,o)=>!!get("SELECT 1 FROM memberships WHERE user_id=? AND organization_id=? AND role='owner' AND active=1",u,o);
 const author=req=>req.user?.id;
 const canEdit=(req,item)=>item.kind==='business'?(owner(author(req),item.organization_id)||isAdmin(req)):((item.author_id===author(req)&&(role(author(req),item.kind==='article'?'writer':'guide')||(item.kind==='article'&&role(author(req),'editor'))))||isAdmin(req));
 const canReview=(req,item)=>item.kind==='article'?item.author_id!==author(req)&&(role(author(req),'editor')||isAdmin(req)):isAdmin(req);
 const visible=(req,item)=>canEdit(req,item)||canReview(req,item);
 const serialize=item=>({id:item.id,kind:item.kind,author_id:item.author_id,organization_id:item.organization_id,version:item.version,status:item.status,draft:JSON.parse(item.draft),publishedVersion:item.published_version,publishedAt:item.published_at,hasPublished:!!item.published_document,publishedActive:!!item.published_active,feedback:item.feedback,updatedAt:item.updated_at});
 const load=id=>{const item=get('SELECT * FROM workspace_documents WHERE id=?',id);if(!item)fail(404,'Document not found');return item;};
 const checkVersion=(item,version)=>{if(!Number.isSafeInteger(version)||item.version!==version)fail(409,'This draft changed. Reload before saving.');};
 const record=(req,item,action,reason='')=>{run('INSERT INTO workspace_revisions(document_id,version,action,actor_id,document,reason) VALUES(?,?,?,?,?,?)',item.id,item.version,action,author(req),item.draft,reason);run('INSERT INTO audit_log(actor,action,subject) VALUES(?,?,?)',author(req),'content_'+action,item.id);};
 function mediaUrl(req,url,item){
  if(typeof url!=='string')fail(400,'Invalid image path');
  if(/^\/assets\/[a-zA-Z0-9/_-]+\.(?:jpg|jpeg|png|webp)$/i.test(url))return url;
  const match=/^\/api\/workspaces\/media\/([a-f0-9-]{36})$/.exec(url);if(!match)fail(400,'Upload a photo to your library first');
  const media=get('SELECT * FROM workspace_media WHERE id=?',match[1]);if(!media)fail(400,'Photo not found');
  if(media.owner_id!==author(req)&&!(item&&JSON.parse(item.draft).photos?.some(p=>p.url===url))&&!isAdmin(req))fail(403,'Photo belongs to another account');
  return url;
 }
 function normalize(req,kind,input,item=null,submit=false){
  const common=['title','summary','language','photos'];
  const specific={article:['body','category','tags','sources'],business:['category','address','phone','website','hours','specialty','menu','services'],guide:['bio','languages','areas','hourlyRateCents','minHours','contactUrl'],tour:['itinerary','meetingPoint','durationMinutes','maxGroup','priceCents','includes','excludes','accessibility','conditions','areas','languages']};
  const v=object(input,[...common,...specific[kind]]);
  const doc={title:plain(v.title,160,true),summary:plain(v.summary,600,submit),language:v.language||'es',photos:list(v.photos,12,p=>{object(p,['url','caption','credit','rights']);return {url:mediaUrl(req,p.url,item),caption:plain(p.caption,240),credit:plain(p.credit,200,submit),rights:plain(p.rights,300,submit)};})};
  if(!['es','en'].includes(doc.language))fail(400,'Use es or en');
  if(kind==='article')Object.assign(doc,{body:plain(v.body,50000,submit),category:plain(v.category,60),tags:list(v.tags,12,t=>plain(t,40,true)),sources:list(v.sources,20,s=>{object(s,['title','url']);return {title:plain(s.title,200,true),url:https(plain(s.url,2048,true))};})});
  if(kind==='business'){
   const category=v.category||'other';if(!['restaurant','bar','cafe','store','stay','wellness','other'].includes(category))fail(400,'Invalid business category');
   const entry=e=>{object(e,['name','category','description','priceCents','currency','available','durationMinutes']);if(e.available!==undefined&&typeof e.available!=='boolean')fail(400,'Invalid availability');if(e.currency!==undefined&&e.currency!=='MXN')fail(400,'Use MXN');return {name:plain(e.name,120,true),category:plain(e.category,80),description:plain(e.description,600),priceCents:integer(e.priceCents,0,100000000),currency:'MXN',available:e.available!==false,...(e.durationMinutes!==undefined?{durationMinutes:integer(e.durationMinutes,1,1440)}:{})};};
   Object.assign(doc,{category,address:plain(v.address,500,submit),phone:plain(v.phone,50),website:https(v.website),hours:plain(v.hours,1200),specialty:plain(v.specialty,600),menu:list(v.menu,200,entry),services:list(v.services,100,entry)});
  }
  if(kind==='guide'||kind==='tour'){
   const selected=list(v.areas,3,a=>{if(!areas.includes(a))fail(400,'Only CDMX, metropolitan area and Teotihuacán');return a;});
   const langs=list(v.languages,10,l=>plain(l,40,true));if(submit&&(!selected.length||!langs.length))fail(400,'Specify service areas and languages');Object.assign(doc,{areas:[...new Set(selected)],languages:[...new Set(langs)]});
  }
  if(kind==='guide')Object.assign(doc,{bio:plain(v.bio,5000,submit),hourlyRateCents:integer(v.hourlyRateCents,0,100000000),minHours:integer(v.minHours,1,24,1),contactUrl:https(v.contactUrl)});
  if(kind==='tour')Object.assign(doc,{itinerary:plain(v.itinerary,10000,submit),meetingPoint:plain(v.meetingPoint,500,submit),durationMinutes:integer(v.durationMinutes,1,1440,60),maxGroup:integer(v.maxGroup,1,100,10),priceCents:integer(v.priceCents,0,100000000),includes:plain(v.includes,2000),excludes:plain(v.excludes,2000),accessibility:plain(v.accessibility,2000),conditions:plain(v.conditions,3000)});
  return doc;
 }
 const publicShape=item=>({id:item.id,kind:item.kind,organization_id:item.kind==='business'?item.organization_id:null,guide_id:item.kind==='tour'?get("SELECT id FROM workspace_documents WHERE author_id=? AND kind='guide' AND published_active=1",item.author_id)?.id||null:null,version:item.published_version,publishedAt:item.published_at,document:JSON.parse(item.published_document)});
 app.get('/api/public/content',(req,res)=>{if(req.query.kind&&!kinds.includes(req.query.kind))fail(400,'Invalid content kind');const rows=req.query.kind?all('SELECT * FROM workspace_documents WHERE published_active=1 AND kind=? ORDER BY published_at DESC LIMIT 200',req.query.kind):all('SELECT * FROM workspace_documents WHERE published_active=1 ORDER BY published_at DESC LIMIT 200');res.json({data:rows.map(publicShape)});});
 app.get('/api/public/content/:id',(req,res)=>{const item=get('SELECT * FROM workspace_documents WHERE id=? AND published_active=1',req.params.id);if(!item)fail(404,'Published content not found');res.json({data:publicShape(item)});});
 app.get('/api/workspaces/media',authenticated,(req,res)=>res.json({data:all('SELECT id,width,height,bytes,created_at FROM workspace_media WHERE owner_id=? ORDER BY created_at DESC LIMIT 100',author(req)).map(m=>({...m,url:'/api/workspaces/media/'+m.id}))}));
 app.post('/api/workspaces/media',authenticated,express.raw({type:['image/jpeg','image/png','image/webp'],limit:'5mb'}),async(req,res)=>{
  if(!['writer','editor','guide'].some(r=>role(author(req),r))&&!get("SELECT 1 FROM memberships WHERE user_id=? AND role='owner' AND active=1",author(req))&&!isAdmin(req))fail(403,'Workspace access required');
  if(!Buffer.isBuffer(req.body)||!req.body.length)fail(400,'Upload a JPEG, PNG or WebP image');
  if(get('SELECT count(*) n FROM workspace_media WHERE owner_id=?',author(req)).n>=100)fail(409,'Photo library limit reached');
  let converted;try{converted=await sharp(req.body,{limitInputPixels:20000000,animated:false}).rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});}catch{fail(400,'Invalid or oversized image');}
  const id=randomUUID(),filename=id+'.webp';writeFileSync(join(dir,filename),converted.data,{mode:0o600});
  try{run('INSERT INTO workspace_media(id,owner_id,filename,width,height,bytes) VALUES(?,?,?,?,?,?)',id,author(req),filename,converted.info.width,converted.info.height,converted.data.length);}catch(e){unlinkSync(join(dir,filename));throw e;}
  res.status(201).json({data:{id,url:'/api/workspaces/media/'+id,width:converted.info.width,height:converted.info.height,bytes:converted.data.length}});
 });
 app.get('/api/workspaces/media/:id',(req,res)=>{const m=get('SELECT * FROM workspace_media WHERE id=?',req.params.id);if(!m)fail(404,'Photo not found');const path='/api/workspaces/media/'+m.id;const published=all('SELECT published_document FROM workspace_documents WHERE published_active=1').some(d=>JSON.parse(d.published_document).photos?.some(p=>p.url===path));const privateAccess=req.user&&(m.owner_id===author(req)||isAdmin(req)||all('SELECT * FROM workspace_documents WHERE status=\'submitted\'').some(d=>canReview(req,d)&&JSON.parse(d.draft).photos?.some(p=>p.url===path)));if(!published&&!privateAccess)fail(404,'Photo not found');const file=join(dir,m.filename);if(!existsSync(file))fail(404,'Photo not found');res.type('webp').send(readFileSync(file));});
 app.get('/api/workspaces/review',authenticated,(req,res)=>res.json({data:all("SELECT * FROM workspace_documents WHERE status='submitted' ORDER BY updated_at").filter(item=>canReview(req,item)).map(serialize)}));
 app.get('/api/workspaces',authenticated,(req,res)=>res.json({data:{items:all('SELECT * FROM workspace_documents ORDER BY updated_at DESC').filter(item=>visible(req,item)).map(serialize),roles:all('SELECT role FROM global_roles WHERE user_id=?',author(req)).map(r=>r.role),organizations:all("SELECT o.id,o.name FROM organizations o JOIN memberships m ON m.organization_id=o.id WHERE m.user_id=? AND m.active=1 AND m.role='owner'",author(req))}}));
 app.post('/api/workspaces',authenticated,(req,res)=>{
  const {kind,organization_id=null,document}=object(req.body,['kind','organization_id','document']);if(!kinds.includes(kind))fail(400,'Invalid content kind');
  if(kind==='business'){if(!organization_id||!get('SELECT 1 FROM organizations WHERE id=?',organization_id))fail(400,'Organization required');if(!owner(author(req),organization_id)&&!isAdmin(req))fail(403,'Business owner required');}
  else{if(organization_id!==null)fail(400,'Only businesses belong to an organization');if(!role(author(req),kind==='article'?'writer':'guide')&&!(kind==='article'&&role(author(req),'editor'))&&!isAdmin(req))fail(403,'Workspace role required');}
  const draft=normalize(req,kind,document),id=randomUUID();transaction(()=>{run('INSERT INTO workspace_documents(id,kind,author_id,organization_id,draft) VALUES(?,?,?,?,?)',id,kind,author(req),organization_id,JSON.stringify(draft));record(req,load(id),'create');});res.status(201).json({data:serialize(load(id))});
 });
 app.get('/api/workspaces/:id',authenticated,(req,res)=>{const item=load(req.params.id);if(!visible(req,item))fail(404,'Document not found');res.json({data:serialize(item)});});
 app.put('/api/workspaces/:id',authenticated,(req,res)=>{
  object(req.body,['version','document']);transaction(()=>{const item=load(req.params.id);if(!canEdit(req,item))fail(403,'Editing not permitted');checkVersion(item,req.body.version);if(item.status==='submitted')fail(409,'Submitted content is locked during review');const draft=normalize(req,item.kind,req.body.document,item);run("UPDATE workspace_documents SET draft=?,version=version+1,status='draft',feedback='',updated_at=CURRENT_TIMESTAMP WHERE id=?",JSON.stringify(draft),item.id);record(req,load(item.id),'save');});res.json({data:serialize(load(req.params.id))});
 });
 app.post('/api/workspaces/:id/submit',authenticated,(req,res)=>{
  object(req.body,['version']);transaction(()=>{const item=load(req.params.id);if(!canEdit(req,item))fail(403,'Submission not permitted');checkVersion(item,req.body.version);if(!['draft','changes','paused'].includes(item.status))fail(409,'Draft is not ready to submit');normalize(req,item.kind,JSON.parse(item.draft),item,true);run("UPDATE workspace_documents SET status='submitted',feedback='',updated_at=CURRENT_TIMESTAMP WHERE id=?",item.id);record(req,item,'submit');});res.json({data:serialize(load(req.params.id))});
 });
 app.post('/api/workspaces/:id/review',authenticated,(req,res)=>{
  object(req.body,['version','action','reason']);const {action}=req.body;if(!['publish','changes'].includes(action))fail(400,'Invalid review action');const reason=plain(req.body.reason,2000,action==='changes');transaction(()=>{const item=load(req.params.id);if(!canReview(req,item))fail(403,'Review not permitted; authors cannot approve themselves');checkVersion(item,req.body.version);if(item.status!=='submitted')fail(409,'Content is not awaiting review');if(action==='publish'){normalize(req,item.kind,JSON.parse(item.draft),item,true);run("UPDATE workspace_documents SET published_document=draft,published_version=version,published_at=CURRENT_TIMESTAMP,published_active=1,status='published',feedback=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",reason,item.id);}else run("UPDATE workspace_documents SET status='changes',feedback=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",reason,item.id);record(req,item,action,reason);});res.json({data:serialize(load(req.params.id))});
 });
 app.post('/api/workspaces/:id/pause',authenticated,(req,res)=>{
  object(req.body,['version','reason']);const reason=plain(req.body.reason,2000,true);transaction(()=>{const item=load(req.params.id);if(!canReview(req,item))fail(403,'Pause not permitted');checkVersion(item,req.body.version);if(!item.published_active)fail(409,'No active publication');run("UPDATE workspace_documents SET published_active=0,status='paused',feedback=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",reason,item.id);record(req,item,'pause',reason);});res.json({data:serialize(load(req.params.id))});
 });
}
