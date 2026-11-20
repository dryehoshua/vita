import {registrationOtp} from './registration-otp.mjs';
import {mountAdventures} from './adventures.mjs';
import {mountAnalytics} from './analytics.mjs';
import {mountLoyalty} from './loyalty.mjs';
import {mountContent} from './content.mjs';
import express from 'express';
import {rateLimit} from 'express-rate-limit';
import {randomUUID,randomBytes,timingSafeEqual} from 'node:crypto';
import {resolve,join} from 'node:path';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,existsSync,unlinkSync} from 'node:fs';
import sharp from 'sharp';
import {openStore} from './store.mjs';
import {token,digest,hashPassword,verifyPassword,base32,verifyOtp} from '../security.mjs';
import {safePath,escapeHTML} from '../../src/accounts/core.js';
export async function createDynamoApp({store:provided,table='LaVitaLocal',endpoint='http://127.0.0.1:8000',origin='http://localhost:4173',dataDir=resolve('.local-data'),dist=resolve('dist'),delivery=null,gatewayKey=''}={}){
 const store=provided||await openStore({endpoint,table}),app=express(),local=['localhost','127.0.0.1'].includes(new URL(origin).hostname),now=()=>new Date().toISOString();
 for(const dir of ['mail','avatars'])mkdirSync(join(dataDir,dir),{recursive:true,mode:0o700});
 const fail=(s,m)=>{throw Object.assign(Error(m),{status:s});},txt=(v,max=120)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail(400,'Invalid input');return v.trim();},email=v=>{v=txt(v,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))fail(400,'Invalid email');return v;},password=v=>{if(typeof v!=='string'||v.length<12||v.length>128)fail(400,'Password requires 12–128 characters');return v;};
 const audit=async(actor,action,subject)=>{const id=randomUUID();await store.put('Audit',id,{id,actor,action,subject,created_at:now()});};
 const otp=registrationOtp(store,dataDir);
 const mail=async(u,purpose)=>{
  let otpCode=null,url=null;
  if(purpose==='verify'){
   otpCode=await otp.issue(u.id);
   if(!otpCode)return;
  }else{
   const raw=token(),h=digest(raw);
   await store.put('Tokens',h,{hash:h,user_id:u.id,purpose,expires:Date.now()+1800000});
   url=`${origin}/cuenta?flow=recovery&token=${raw}`;
  }
  if(delivery)await delivery.send({to:u.email,purpose,url,otpCode});
  else if(local)writeFileSync(join(dataDir,'mail',Date.now()+'-'+randomUUID()+'.json'),JSON.stringify({to:u.email,purpose,url,code:otpCode}),{mode:0o600});
  else fail(503,'Email delivery unavailable');
 };
 const cookie={httpOnly:true,sameSite:'strict',secure:origin.startsWith('https:'),path:'/'};
 app.disable('x-powered-by');
 if(!local&&!gatewayKey)throw Error('Public-origin pilot requires a private gateway key');
 if(gatewayKey)app.use((req,res,next)=>{const got=digest(String(req.headers['x-vita-gateway']||''));if(!timingSafeEqual(Buffer.from(got),Buffer.from(digest(gatewayKey))))return res.sendStatus(403);next();});
 app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Cache-Control':'no-store'});if(![new URL(origin).host,'127.0.0.1:'+new URL(origin).port].includes(req.headers.host))return res.status(403).json({error:'Invalid host'});next();});
 app.use('/api',(req,res,next)=>{if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin)return res.status(403).json({error:'Invalid origin'});next();});
 app.use('/api',rateLimit({windowMs:60000,limit:200,standardHeaders:true,legacyHeaders:false}));app.use(express.json({limit:'1mb'}));
 app.use(async(req,res,next)=>{const raw=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('vita_session='))?.slice(13);if(raw){const s=await store.get('Sessions',digest(raw));if(s&&s.expires>Date.now()){const u=await store.get('Users',s.user_id);if(u?.status==='active'&&u.verified&&u.session_version===s.session_version){req.session=s;req.user=u;}}}next();});
 const authenticated=(req,res,next)=>req.user?next():res.status(401).json({error:'Sign in required'}),isAdmin=req=>!!req.user?.roles?.includes('admin')&&req.session.aal2>Date.now();
 const admin=req=>{if(!isAdmin(req))fail(403,'Administrator and MFA required');};
 const owns=async(req,org)=>{const m=await store.get('Memberships',org+':'+req.user.id);return m?.active&&m.role==='owner';};
 const authLimit=rateLimit({windowMs:900000,limit:30,standardHeaders:true,legacyHeaders:false});
 app.post('/api/auth/signup',authLimit,async(req,res)=>{if(!local&&!delivery)fail(503,'Registration not enabled');const e=email(req.body.email),p=password(req.body.password),name=txt(req.body.name,60),hash=await hashPassword(p),existing=await store.get('Emails',e);if(!existing){const id=randomUUID();await store.transaction(async tx=>{if(await tx.get('Emails',e))fail(409,'Account exists');await tx.put('Emails',e,{id});await tx.put('Users',id,{id,email:e,password:hash,verified:false,status:'active',roles:[],session_version:0,created_at:now()});await tx.put('Profiles',id,{id,display_name:name,residence:'unspecified',language:'es',avatar_path:null});});await mail({id,email:e},'verify');}else{const u=await store.get('Users',existing.id);if(u&&!u.verified&&u.status==='active')await mail(u,'verify');}res.json({ok:true});});
 app.post('/api/auth/resend-code',authLimit,async(req,res)=>{
  if(!local&&!delivery)fail(503,'Registration not enabled');
  const e=email(req.body.email),index=await store.get('Emails',e);
  const user=index&&await store.get('Users',index.id);
  if(user&&!user.verified&&user.status==='active')await mail(user,'verify');
  res.json({ok:true});
 });
 app.post('/api/auth/verify-code',authLimit,async(req,res)=>{
  if(!local&&!delivery)fail(503,'Registration not enabled');
  const e=email(req.body.email),index=await store.get('Emails',e);
  await otp.verify(index?.id,req.body.code,await hashPassword(password(req.body.password)));
  res.json({ok:true});
 });
 app.get('/api/auth/verify',async(req,res)=>{const h=digest(String(req.query.token||''));await store.transaction(async tx=>{const t=await tx.get('Tokens',h);if(!t||t.purpose!=='verify'||t.expires<Date.now())fail(400,'Invalid verification link');const u=await tx.get('Users',t.user_id);if(!u||u.verified||u.status!=='active')fail(400,'Invalid verification link');await tx.put('Users',u.id,{...u,verified:true});await tx.remove('RegistrationCodes',u.id);await tx.remove('Tokens',h);});res.redirect('/cuenta?verified=1');});
 app.post('/api/auth/login',authLimit,async(req,res)=>{const e=email(req.body.email),p=password(req.body.password),index=await store.get('Emails',e),u=index?await store.get('Users',index.id):null;const valid=await verifyPassword(p,u?.password||'0'.repeat(32)+':'+'0'.repeat(128));if(!u||!valid)fail(401,'Invalid login');if(!u.verified)fail(403,'Email not confirmed');if(u.status!=='active')fail(403,'Account unavailable');const raw=token(),h=digest(raw);await store.transaction(async tx=>{const current=await tx.get('Users',u.id);if(current.password!==u.password||current.status!=='active')fail(409,'Account changed');await tx.put('Sessions',h,{hash:h,user_id:u.id,session_version:u.session_version,expires:Date.now()+28800000,aal2:0});if(req.session)await tx.remove('Sessions',req.session.hash);});res.cookie('vita_session',raw,{...cookie,maxAge:28800000}).json({user:{id:u.id,email:u.email}});});
 app.post('/api/auth/logout',async(req,res)=>{if(req.session)await store.remove('Sessions',req.session.hash);res.clearCookie('vita_session',cookie).json({ok:true});});
 app.get('/api/auth/me',(req,res)=>res.json({user:req.user?{id:req.user.id,email:req.user.email,verified:req.user.verified}:null}));
 app.post('/api/auth/reset',authLimit,async(req,res)=>{if(!local&&!delivery)fail(503,'Recovery is available only in the local pilot');const i=await store.get('Emails',email(req.body.email));if(i){const u=await store.get('Users',i.id);await mail(u,'recovery');}res.json({ok:true});});
 app.post('/api/auth/password',authLimit,async(req,res)=>{const p=password(req.body.password),h=digest(String(req.body.token||'')),hash=await hashPassword(p);await store.transaction(async tx=>{const t=await tx.get('Tokens',h);if(!t||t.purpose!=='recovery'||t.expires<Date.now())fail(400,'Invalid recovery link');const u=await tx.get('Users',t.user_id);await tx.put('Users',u.id,{...u,password:hash,session_version:u.session_version+1});await tx.remove('Tokens',h);});res.clearCookie('vita_session',cookie).json({ok:true});});
 app.post('/api/query',authenticated,async(req,res)=>{const {table:t,action='select',values:v={},filters:f={}}=req.body,id=req.user.id;let data=[];
 if(action==='select'){
  if(t==='profiles')data=[await store.get('Profiles',id)];else if(t==='global_roles')data=req.user.roles.map(role=>({role}));else if(t==='memberships'){data=(await store.list('Memberships')).filter(m=>m.user_id===id);data=await Promise.all(data.map(async m=>({...m,organizations:{name:(await store.get('Organizations',m.organization_id))?.name}})));}
  else if(t==='access_requests')data=(await store.list('Requests')).filter(r=>isAdmin(req)&&!f.user_id||r.user_id===id);
  else if(t==='favorites')data=await store.list('Favorites#'+id);else if(t==='point_entries')data=await store.list('Ledger#'+id);else fail(403,'Forbidden table');
  for(const [k,v]of Object.entries(f)){if(!['id','user_id','status','path'].includes(k))fail(400,'Invalid filter');data=data.filter(r=>r?.[k]===v);}
 }else if(t==='profiles'&&action==='update'){
  if(f.id!==id||Object.keys(v).some(k=>!['display_name','residence','language','avatar_path'].includes(k)))fail(403,'Forbidden');await store.transaction(async tx=>{const p={...await tx.get('Profiles',id),...v};txt(p.display_name,60);if(!['es','en'].includes(p.language)||!['unspecified','tourist','cdmx','roma-condesa'].includes(p.residence)||p.avatar_path!==null&&p.avatar_path!==id+'/avatar.webp')fail(400,'Invalid profile');await tx.put('Profiles',id,p);});
 }else if(t==='access_requests'&&action==='insert'){
  if(v.user_id!==id||Object.keys(v).some(k=>!['user_id','kind','name'].includes(k))||!['business','guide','writer'].includes(v.kind))fail(403,'Forbidden request');const rid=randomUUID();await store.transaction(async tx=>{if(await tx.get('Pending',id+':'+v.kind))fail(409,'Already pending');await tx.put('Pending',id+':'+v.kind,{id:rid});await tx.put('Requests',rid,{id:rid,user_id:id,kind:v.kind,name:txt(v.name),status:'pending',created_at:now()});});
 }else if(t==='favorites'&&['insert','upsert','delete'].includes(action)){
  if(action==='delete'){if(f.user_id!==id)fail(403,'Forbidden');await store.remove('Favorites#'+id,txt(f.path,240));}else{if(v.user_id!==id||safePath(v.path)!==v.path||v.path==='/')fail(400,'Invalid favorite');await store.put('Favorites#'+id,v.path,{user_id:id,path:v.path,title:txt(v.title,150),created_at:now()});}
 }else fail(403,'Operation not allowed');res.json({data:req.body.single?data[0]||null:data});});
 app.post('/api/rpc',authenticated,async(req,res)=>{const {name,args:a={}}=req.body;let data=null;
 if(name==='account_metrics'){admin(req);const users=await store.list('Users'),profiles=await store.list('Profiles'),members=await store.list('Memberships'),roles={};for(const u of users)for(const r of new Set([...u.roles,...members.filter(m=>m.user_id===u.id&&m.active).map(m=>m.role)]))roles[r]=(roles[r]||0)+1;data={accounts:users.filter(u=>u.verified).length,profiles:profiles.length,roles,residence:profiles.reduce((o,p)=>(o[p.residence]=(o[p.residence]||0)+1,o),{}),pending:(await store.list('Requests')).filter(r=>r.status==='pending').length,pageViews:(await store.list('PageViews')).reduce((n,r)=>n+r.count,0),generated_at:now()};}
 else if(name==='decide_request'){admin(req);if(typeof a.approve!=='boolean')fail(400,'Invalid decision');await store.transaction(async tx=>{const r=await tx.get('Requests',a.request_id);if(!r||r.status!=='pending')fail(409,'Request not pending');const u=await tx.get('Users',r.user_id);if(a.approve){if(r.kind==='business'){const org=randomUUID();await tx.put('Organizations',org,{id:org,name:r.name});await tx.put('Memberships',org+':'+u.id,{organization_id:org,user_id:u.id,role:'owner',active:true});}else await tx.put('Users',u.id,{...u,roles:[...new Set([...u.roles,r.kind])]});}await tx.put('Requests',r.id,{...r,status:a.approve?'approved':'rejected'});await tx.remove('Pending',u.id+':'+r.kind);});await audit(req.user.id,'decide_request',a.request_id);}
 else if(name==='set_team_member'){if(!await owns(req,a.org)&&!isAdmin(req))fail(403,'Forbidden');if(typeof a.enabled!=='boolean')fail(400,'Invalid state');const i=await store.get('Emails',email(a.member_email)),u=i?await store.get('Users',i.id):null;if(!u?.verified)fail(400,'Verified account required');await store.transaction(async tx=>{const key=a.org+':'+u.id,m=await tx.get('Memberships',key);if(m?.role==='owner')fail(403,'Cannot modify owner');await tx.put('Memberships',key,{organization_id:a.org,user_id:u.id,role:'staff',active:a.enabled});});await audit(req.user.id,'set_staff',a.org+':'+u.id);}
 else fail(403,'Unknown action');res.json({data});});
 app.post('/api/mfa/:action',authenticated,authLimit,async(req,res)=>{const id=req.user.id,f=await store.get('Factors',id),a=req.params.action;let data;
 if(a==='level')data={currentLevel:req.session.aal2>Date.now()?'aal2':'aal1'};
 else if(a==='list'){const rows=f?[{id:f.id,status:f.verified?'verified':'unverified',factor_type:'totp'}]:[];data={totp:rows,all:rows};}
 else if(a==='enroll'){if(f?.verified)fail(409,'Already enrolled');const factor={id:randomUUID(),user_id:id,secret:base32(randomBytes(20)),verified:false,last_step:-1};await store.transaction(async tx=>{if((await tx.get('Factors',id))?.verified)fail(409,'Already enrolled');await tx.put('Factors',id,factor);});data={id:factor.id,totp:{secret:factor.secret}};}
 else if(a==='unenroll'){await store.transaction(async tx=>{if((await tx.get('Factors',id))?.verified)fail(403,'Operator recovery required');await tx.remove('Factors',id);});data={};}
 else if(a==='verify'){await store.transaction(async tx=>{const f=await tx.get('Factors',id);if(!f||f.id!==req.body.factorId)fail(400,'Invalid factor');const step=verifyOtp(f.secret,req.body.code,f.last_step);if(step===null)fail(403,'Invalid code');await tx.put('Factors',id,{...f,verified:true,last_step:step});const s=await tx.get('Sessions',req.session.hash);await tx.put('Sessions',s.hash,{...s,aal2:Date.now()+900000});});data={};}else fail(400,'Invalid action');res.json({data});});
 app.put('/api/avatar',authenticated,express.raw({type:'image/webp',limit:'2mb'}),async(req,res)=>{if(!Buffer.isBuffer(req.body))fail(400,'Image required');let bytes;try{bytes=await sharp(req.body,{limitInputPixels:4000000}).resize(512,512,{fit:'cover'}).webp().toBuffer();}catch{fail(400,'Invalid image');}writeFileSync(join(dataDir,'avatars',req.user.id+'.webp'),bytes,{mode:0o600});res.json({data:{path:req.user.id+'/avatar.webp'}});});
 app.get('/api/avatar',authenticated,(req,res)=>{const p=join(dataDir,'avatars',req.user.id+'.webp');if(!existsSync(p))return res.sendStatus(404);res.type('webp').send(readFileSync(p));});app.delete('/api/avatar',authenticated,(req,res)=>{const p=join(dataDir,'avatars',req.user.id+'.webp');if(existsSync(p))unlinkSync(p);res.json({data:{}});});
 app.get('/api/admin/accounts',authenticated,async(req,res)=>{
  admin(req);
  const accounts=(await store.list('Users')).filter(u=>u.verified).map(({id,email,status,roles})=>({id,email,status,roles}));
  res.json({data:accounts});
 });
 app.patch('/api/admin/accounts/:id/status',authenticated,async(req,res)=>{
  admin(req);
  const {status,reason}=req.body;
  if(!['active','suspended'].includes(status))fail(400,'Invalid status');
  if(req.params.id===req.user.id)fail(409,'Cannot change own status');
  const justification=txt(reason,400);
  await store.transaction(async tx=>{
   const operator=await tx.get('Users',req.user.id);
   const account=await tx.get('Users',req.params.id);
   if(operator?.status!=='active'||!operator.roles.includes('admin'))fail(403,'Administrator required');
   if(!account?.verified)fail(404,'Account not found');
   if(account.status===status)return;
   await tx.put('Users',account.id,{...account,status,session_version:account.session_version+1});
   const id=randomUUID();
   await tx.put('Audit',id,{id,actor:operator.id,action:'account_status',subject:account.id,status,reason:justification,created_at:now()});
  });
  res.json({ok:true});
 });
 app.get('/api/admin/organizations',authenticated,async(req,res)=>{admin(req);res.json({data:await store.list('Organizations')});});
 app.get('/dev/mail',(req,res)=>{if(!local||['cf-ray','cf-connecting-ip','forwarded','x-forwarded-for'].some(h=>req.headers[h]))return res.sendStatus(404);const mails=readdirSync(join(dataDir,'mail')).sort().reverse().slice(0,20).map(f=>JSON.parse(readFileSync(join(dataDir,'mail',f))));res.type('html').send('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/account.css"><main><h1>Buzón local / Local mailbox</h1>'+mails.map(m=>`<section class="panel"><b>${escapeHTML(m.to)}</b><p>${escapeHTML(m.purpose)}</p>${m.code?`<p>Código de verificación: <strong>${escapeHTML(m.code)}</strong></p>`:m.url?`<a href="${escapeHTML(m.url)}">Abrir / Open</a>`:''}</section>`).join('')+'<a href="/cuenta">Volver / Back</a></main></html>');});
 mountAnalytics(app,store,local);
 mountContent(app,{store,authenticated,isAdmin,dataDir});
 mountLoyalty(app,{store,authenticated,isAdmin});
 mountAdventures(app,{store,authenticated});
 app.get('/api/health',(req,res)=>res.json({ok:true,mode:local?'local':'hosted',database:'DynamoDB'}));
 app.get('/account-config.js',(req,res)=>res.type('js').send(`export const accountConfig=${JSON.stringify({enabled:true,provider:'local',database:'dynamodb',siteUrl:origin,privacyUrl:'/privacidad-local',localMailbox:local,registrationEnabled:local||!!delivery})};`));
 app.get('/privacidad-local',(req,res)=>res.type('html').send('<h1>La Vita · Prueba local</h1><p>Usa datos de prueba. Las cuentas se guardan en DynamoDB Local en esta computadora; las fotos en su almacenamiento local. No se envían correos externos. Este texto no sustituye el aviso para apertura pública.</p><a href="/cuenta">Volver</a>'));
 app.use((req,res,next)=>{res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'");next();});
 app.use(express.static(dist,{extensions:['html'],index:'index.html',dotfiles:'deny'}));
 app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.status?e.message:'Request failed',code:e.status===409?'23505':undefined}));
 return {app,store};
}
