import {mountLoyalty} from './loyalty.mjs';
import sharp from 'sharp';
import {mountOperations} from './operations.mjs';
import express from 'express';
import {rateLimit} from 'express-rate-limit';
import {randomUUID,randomBytes} from 'node:crypto';
import {join,resolve} from 'node:path';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,existsSync,unlinkSync} from 'node:fs';
import {openDatabase} from './database.mjs';
import {token,digest,hashPassword,verifyPassword,base32,verifyOtp} from './security.mjs';
import {safePath,escapeHTML} from '../src/accounts/core.js';
export function createApp({dataDir=resolve('.local-data'),dbPath=join(dataDir,'vita.sqlite'),origin='http://localhost:4173',dist=resolve('dist'),delivery=null,privacyUrl='/privacidad-local',gatewayKey=''}={}){
 const app=express(),db=openDatabase(dbPath);mkdirSync(join(dataDir,'mail'),{recursive:true,mode:0o700});mkdirSync(join(dataDir,'avatars'),{recursive:true,mode:0o700});
 const get=(sql,...args)=>db.prepare(sql).get(...args),all=(sql,...args)=>db.prepare(sql).all(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
 const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
 const text=(x,max=120)=>{if(typeof x!=='string'||!x.trim()||x.length>max)fail(400,'Invalid input');return x.trim();};
 const email=x=>{x=text(x,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))fail(400,'Invalid email');return x;};
 const password=x=>{if(typeof x!=='string'||x.length<12||x.length>128)fail(400,'Password requires 12–128 characters');return x;};
 const audit=(u,a,s)=>run('INSERT INTO audit_log(actor,action,subject) VALUES(?,?,?)',u,a,s);
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const out=fn();db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}};
 const mail=async(u,purpose,{code:providedCode}={})=>{const code=providedCode||token();if(purpose!=='invite')run('INSERT INTO tokens VALUES(?,?,?,?)',digest(code),u.id,purpose,Date.now()+30*60*1000);const url=purpose==='verify'?`${origin}/api/auth/verify?token=${code}`:purpose==='invite'?`${origin}/cuenta?invite=${code}`:`${origin}/cuenta?flow=recovery&token=${code}`;if(delivery){await delivery.send({to:u.email,purpose,url});return;}if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))fail(503,'Email delivery is not configured');writeFileSync(join(dataDir,'mail',`${Date.now()}-${randomUUID()}.json`),JSON.stringify({to:u.email,purpose,url,expiresInMinutes:30},null,2),{mode:0o600});};
 const cookieOptions={httpOnly:true,sameSite:'strict',secure:origin.startsWith('https:'),path:'/'};
 app.disable('x-powered-by');
 app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Cache-Control':'no-store'});if(![new URL(origin).host,'127.0.0.1:'+new URL(origin).port].includes(req.headers.host))return res.status(403).json({error:'Invalid host'});next();});
 app.use('/api',(req,res,next)=>{if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin)return res.status(403).json({error:'Invalid origin'});next();});
 app.use('/api',rateLimit({windowMs:60000,limit:150,standardHeaders:true,legacyHeaders:false}));
 app.use(express.json({limit:'3mb'}));
 app.use((req,res,next)=>{const raw=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('vita_session='))?.slice(13);const s=raw?get('SELECT * FROM sessions WHERE hash=? AND expires>?',digest(raw),Date.now()):null;if(s){req.session=s;req.user=get("SELECT id,email,verified,status FROM users WHERE id=? AND status='active'",s.user_id);}next();});
 const authenticated=(req,res,next)=>{if(!req.user)return res.status(401).json({error:'Sign in required'});next();};
 const isAdmin=req=>req.session?.aal2>Date.now()&&!!get("SELECT 1 FROM global_roles WHERE user_id=? AND role='admin'",req.user.id);
 const mustAdmin=req=>{if(!isAdmin(req))fail(403,'Administrator and MFA required');};
 const owns=(u,o)=>!!get("SELECT 1 FROM memberships WHERE user_id=? AND organization_id=? AND role='owner' AND active=1",u,o);
 const authLimit=rateLimit({windowMs:15*60000,limit:20,standardHeaders:true,legacyHeaders:false});
 app.post('/api/auth/signup',authLimit,async(req,res)=>{const e=email(req.body.email),p=password(req.body.password),name=text(req.body.name,60);const hash=await hashPassword(p);if(!get('SELECT id FROM users WHERE email=?',e)){const id=randomUUID();transaction(()=>{run('INSERT INTO users(id,email,password) VALUES(?,?,?)',id,e,hash);run('INSERT INTO profiles(id,display_name) VALUES(?,?)',id,name);});await mail({id,email:e},'verify');}res.json({ok:true});});
 app.get('/api/auth/verify',(req,res)=>{const h=digest(String(req.query.token||'')),t=get("SELECT * FROM tokens WHERE hash=? AND purpose='verify' AND expires>?",h,Date.now());if(!t)fail(400,'Invalid or expired verification link');transaction(()=>{run('UPDATE users SET verified=1 WHERE id=?',t.user_id);run('DELETE FROM tokens WHERE hash=?',h);});res.redirect('/cuenta?verified=1');});
 app.post('/api/auth/login',authLimit,async(req,res)=>{const e=email(req.body.email),p=password(req.body.password),u=get('SELECT * FROM users WHERE email=?',e);const valid=await verifyPassword(p,u?.password||'00000000000000000000000000000000:'+ '0'.repeat(128));if(!u||!valid)fail(401,'Invalid login');if(u.status!=='active')fail(403,'Account unavailable');if(!u.verified)fail(403,'Email not confirmed');const raw=token();if(req.session)run('DELETE FROM sessions WHERE hash=?',req.session.hash);run('INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)',digest(raw),u.id,Date.now()+8*3600000);res.cookie('vita_session',raw,{...cookieOptions,maxAge:8*3600000});res.json({user:{id:u.id,email:u.email}});});
 app.post('/api/auth/logout',(req,res)=>{if(req.session)run('DELETE FROM sessions WHERE hash=?',req.session.hash);res.clearCookie('vita_session',cookieOptions).json({ok:true});});
 app.get('/api/auth/me',(req,res)=>res.json({user:req.user||null}));
 app.post('/api/auth/reset',authLimit,async(req,res)=>{const u=get('SELECT id,email FROM users WHERE email=?',email(req.body.email));if(u)await mail(u,'recovery');res.json({ok:true});});
 app.post('/api/auth/password',authLimit,async(req,res)=>{const p=password(req.body.password),h=digest(String(req.body.token||''));const t=get("SELECT * FROM tokens WHERE hash=? AND purpose='recovery' AND expires>?",h,Date.now());if(!t)fail(400,'Invalid or expired recovery link');const hash=await hashPassword(p);transaction(()=>{if(!get('SELECT 1 FROM tokens WHERE hash=? AND expires>?',h,Date.now()))fail(400,'Expired link');run('UPDATE users SET password=? WHERE id=?',hash,t.user_id);run('DELETE FROM tokens WHERE user_id=?',t.user_id);run('DELETE FROM sessions WHERE user_id=?',t.user_id);});res.clearCookie('vita_session',cookieOptions).json({ok:true});});
 app.post('/api/query',authenticated,(req,res)=>{
  const {table,action='select',values={},filters={}}=req.body,u=req.user.id;let data;
  if(action==='select'){
   if(table==='profiles')data=all('SELECT * FROM profiles WHERE id=?',u);
   else if(table==='global_roles')data=all('SELECT role FROM global_roles WHERE user_id=?',u);
   else if(table==='memberships')data=all('SELECT m.*,o.name FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE user_id=?',u).map(m=>({...m,active:!!m.active,organizations:{name:m.name}}));
   else if(table==='access_requests')data=isAdmin(req)&&!filters.user_id?all('SELECT * FROM access_requests ORDER BY created_at DESC'):all('SELECT * FROM access_requests WHERE user_id=? ORDER BY created_at DESC',u);
   else if(['favorites','point_entries'].includes(table))data=all(`SELECT * FROM ${table} WHERE user_id=? ORDER BY created_at DESC`,u);
   else fail(403,'Forbidden table');
   for(const [k,v] of Object.entries(filters)){if(!['id','user_id','status','path'].includes(k))fail(400,'Invalid filter');data=data.filter(r=>r[k]===v);}
  }else if(table==='profiles'&&action==='update'){
   if(filters.id!==u||Object.keys(values).some(k=>!['display_name','residence','language','avatar_path'].includes(k)))fail(403,'Forbidden fields');
   const p=get('SELECT * FROM profiles WHERE id=?',u),v={...p,...values};text(v.display_name,60);if(!['unspecified','tourist','cdmx','roma-condesa'].includes(v.residence)||!['es','en'].includes(v.language)||!(v.avatar_path===null||v.avatar_path===u+'/avatar.webp'))fail(400,'Invalid profile');
   run('UPDATE profiles SET display_name=?,residence=?,language=?,avatar_path=? WHERE id=?',v.display_name,v.residence,v.language,v.avatar_path,u);data=[];
  }else if(table==='access_requests'&&action==='insert'){
   if(values.user_id!==u||Object.keys(values).some(k=>!['user_id','kind','name'].includes(k)))fail(403,'Forbidden fields');if(!['business','writer','guide'].includes(values.kind))fail(400,'Invalid kind');run('INSERT INTO access_requests(id,user_id,kind,name) VALUES(?,?,?,?)',randomUUID(),u,values.kind,text(values.name));data=[];
  }else if(table==='favorites'&&['insert','upsert','delete'].includes(action)){
   if(action==='delete'){if(filters.user_id!==u)fail(403,'Forbidden');run('DELETE FROM favorites WHERE user_id=? AND path=?',u,filters.path);}else{if(values.user_id!==u||safePath(values.path)!==values.path||values.path==='/')fail(400,'Invalid favorite');run('INSERT OR IGNORE INTO favorites(user_id,path,title) VALUES(?,?,?)',u,values.path,text(values.title,150));}data=[];
  }else fail(403,'Operation not allowed');
  res.json({data:req.body.single?data[0]||null:data});
 });
 app.post('/api/rpc',authenticated,(req,res)=>{const {name,args:a={}}=req.body,u=req.user.id;let data=null;
  if(name==='account_metrics'){mustAdmin(req);const roleCounts=all('SELECT role,count(DISTINCT user_id) n FROM (SELECT role,user_id FROM global_roles UNION ALL SELECT role,user_id FROM memberships WHERE active=1) GROUP BY role');data={accounts:get('SELECT count(*) n FROM users WHERE verified=1').n,profiles:get('SELECT count(*) n FROM profiles').n,roles:Object.fromEntries(roleCounts.map(r=>[r.role,r.n])),residence:Object.fromEntries(all('SELECT residence,count(*) n FROM profiles GROUP BY residence').map(r=>[r.residence,r.n])),pending:get("SELECT count(*) n FROM access_requests WHERE status='pending'").n,pageViews:get('SELECT coalesce(sum(count),0) n FROM page_views').n,generated_at:new Date().toISOString()};}
  else if(name==='decide_request'){mustAdmin(req);if(typeof a.approve!=='boolean')fail(400,'Invalid decision');transaction(()=>{const r=get("SELECT * FROM access_requests WHERE id=? AND status='pending'",a.request_id);if(!r)fail(409,'Request is not pending');if(a.approve){if(r.kind==='business'){const id=randomUUID();run('INSERT INTO organizations VALUES(?,?)',id,r.name);run("INSERT INTO memberships VALUES(?,?,'owner',1)",id,r.user_id);}else run('INSERT OR IGNORE INTO global_roles VALUES(?,?)',r.user_id,r.kind);}run('UPDATE access_requests SET status=? WHERE id=?',a.approve?'approved':'rejected',r.id);audit(u,a.approve?'approve_request':'reject_request',r.id);});}
  else if(name==='set_team_member'){if(!owns(u,a.org)&&!isAdmin(req))fail(403,'Forbidden');if(typeof a.enabled!=='boolean')fail(400,'Invalid state');const target=get('SELECT id FROM users WHERE email=? AND verified=1',email(a.member_email));if(!target)fail(400,'Verified account required');if(get("SELECT 1 FROM memberships WHERE organization_id=? AND user_id=? AND role='owner'",a.org,target.id))fail(403,'Cannot modify owner');transaction(()=>{run("INSERT INTO memberships VALUES(?,?,'staff',?) ON CONFLICT(organization_id,user_id) DO UPDATE SET active=excluded.active",a.org,target.id,Number(a.enabled));audit(u,'set_staff',a.org+':'+target.id+':'+a.enabled);});}
  else fail(403,'Unknown action');res.json({data});
 });
 app.post('/api/mfa/:action',authenticated,authLimit,(req,res)=>{const u=req.user.id,action=req.params.action;let f=get('SELECT * FROM factors WHERE user_id=?',u),data;
  if(action==='level')data={currentLevel:req.session.aal2>Date.now()?'aal2':'aal1'};
  else if(action==='list'){const factors=f?[{id:f.id,status:f.verified?'verified':'unverified',factor_type:'totp'}]:[];data={totp:factors,all:factors};}
  else if(action==='enroll'){if(f?.verified)fail(409,'Already enrolled');const id=randomUUID(),secret=base32(randomBytes(20));run('INSERT INTO factors(id,user_id,secret) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET id=excluded.id,secret=excluded.secret,verified=0,last_step=-1',id,u,secret);data={id,totp:{secret}};}
  else if(action==='unenroll'){if(f?.verified)fail(403,'Verified factor requires operator recovery');run('DELETE FROM factors WHERE user_id=? AND verified=0',u);data={};}
  else if(action==='verify'){if(!f||f.id!==req.body.factorId)fail(400,'Invalid factor');const step=verifyOtp(f.secret,req.body.code,f.last_step);if(step===null)fail(403,'Invalid code');transaction(()=>{run('UPDATE factors SET verified=1,last_step=? WHERE user_id=?',step,u);run('UPDATE sessions SET aal2=? WHERE hash=?',Date.now()+15*60000,req.session.hash);});data={};}
  else fail(400,'Invalid MFA action');res.json({data});
 });
 app.put('/api/avatar',authenticated,express.raw({type:'image/webp',limit:'2mb'}),async(req,res)=>{const b=req.body;if(!Buffer.isBuffer(b)||b.subarray(0,4).toString()!=='RIFF'||b.subarray(8,12).toString()!=='WEBP')fail(400,'Invalid WebP');let safe;try{safe=await sharp(b,{limitInputPixels:4000000}).resize(512,512,{fit:'cover'}).webp({quality:85}).toBuffer();}catch{fail(400,'Invalid image');}writeFileSync(join(dataDir,'avatars',req.user.id+'.webp'),safe,{mode:0o600});res.json({data:{path:req.user.id+'/avatar.webp'}});});
 app.get('/api/avatar',authenticated,(req,res)=>{const p=join(dataDir,'avatars',req.user.id+'.webp');if(!existsSync(p))return res.sendStatus(404);res.type('webp').send(readFileSync(p));});
 app.delete('/api/avatar',authenticated,(req,res)=>{const p=join(dataDir,'avatars',req.user.id+'.webp');if(existsSync(p))unlinkSync(p);res.json({data:{}});});
 // Development mailbox is accessible only through a loopback origin, never through a proxy/tunnel.
 const localMailbox=['localhost','127.0.0.1'].includes(new URL(origin).hostname);
 app.get('/dev/mail',(req,res)=>{
  if(!localMailbox||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||['forwarded','x-forwarded-for','cf-ray','cf-connecting-ip'].some(h=>req.headers[h]))return res.sendStatus(404);
  const messages=readdirSync(join(dataDir,'mail')).sort().reverse().slice(0,20).map(f=>JSON.parse(readFileSync(join(dataDir,'mail',f),'utf8')));
  res.set('Content-Security-Policy',"default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  res.type('html').send('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Buzón local · La Vita</title><link rel="stylesheet" href="/account.css"><main><h1>Buzón local / Local mailbox</h1><p>Solo pruebas en esta computadora. No se envían correos externos.</p>'+messages.map(m=>'<section class="panel"><b>'+escapeHTML(m.to)+'</b><p>'+escapeHTML(m.purpose)+'</p><a href="'+escapeHTML(m.url)+'">Abrir enlace / Open link</a></section>').join('')+'<a href="/cuenta">Volver / Back</a></main></html>');
 });
 mountOperations(app,{db,authenticated,isAdmin,mail});
 mountLoyalty(app,{db,authenticated,isAdmin});
 app.get('/api/health',(req,res)=>res.json({ok:true,mode:'local'}));
 app.get('/account-config.js',(req,res)=>res.type('js').send(`export const accountConfig=Object.freeze(${JSON.stringify({enabled:true,provider:'local',siteUrl:origin,privacyUrl,localMailbox})});`));
 app.get('/privacidad-local',(req,res)=>res.type('html').send('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><title>Prueba local · La Vita</title><h1>Entorno local de pruebas / Local test environment</h1><p>Nombre, correo, preferencias, foto y actividad de cuenta se guardan en esta computadora. Las contraseñas se guardan con hash. No se envían correos: las verificaciones y recuperaciones se guardan en un buzón local. Usa datos de prueba. Este texto no sustituye el aviso de privacidad para una apertura pública.</p><p>Account data stays on this computer. Verification and recovery messages are saved to a local mailbox. Use test data. A production privacy notice is required before public launch.</p><a href="/cuenta">Volver / Back</a></html>'));
 app.use((req,res,next)=>{res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'");if(req.method==='GET'&&(req.path==='/'||req.path==='/cuenta'||req.path==='/guias'||req.path==='/alojamientos'||req.path==='/ahora'||req.path==='/socialite')){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());run('INSERT INTO page_views VALUES(?,?,1) ON CONFLICT(day,path) DO UPDATE SET count=count+1',day,req.path);}next();});
 app.use(express.static(dist,{extensions:['html'],index:'index.html',dotfiles:'deny'}));
 app.use((err,req,res,next)=>{const conflict=String(err.message).includes('UNIQUE constraint');res.status(err.status|| (conflict?409:500)).json({error:err.status?err.message:conflict?'Already exists':'Request failed',code:conflict?'23505':undefined});});
 return {app,db};
}
