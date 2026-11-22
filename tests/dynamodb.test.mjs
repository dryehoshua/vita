import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DynamoDBClient,DeleteTableCommand} from '@aws-sdk/client-dynamodb';
import {openStore} from '../server/dynamo/store.mjs';
import {createDynamoApp} from '../server/dynamo/app.mjs';
import {digest,otp} from '../server/security.mjs';
let store,server,dir,alice,bob,admin;const origin='http://127.0.0.1:18945',table='VitaTest'+Date.now(),password='test-only-long-password';
async function api(path,body,cookie,method='POST'){const r=await fetch(origin+path,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function signup(email){await api('/api/auth/signup',{email,password,name:email});const m=readdirSync(join(dir,'mail')).map(f=>JSON.parse(readFileSync(join(dir,'mail',f)))).find(m=>m.to===email);assert.equal((await api('/api/auth/verify-code',{email,code:m.code,password})).status,200);return (await api('/api/auth/login',{email,password})).cookie;}
const uid=async e=>(await store.get('Emails',e)).id;
before(async()=>{dir=mkdtempSync(join(tmpdir(),'vita-ddb-'));store=await openStore({table});const x=await createDynamoApp({store,origin,dataDir:dir});server=x.app.listen(18945,'127.0.0.1');await new Promise(r=>server.once('listening',r));alice=await signup('alice@example.test');bob=await signup('bob@example.test');admin=await signup('support@roma-condesa.app');const id=await uid('support@roma-condesa.app');await store.transaction(async tx=>{const u=await tx.get('Users',id);await tx.put('Users',id,{...u,roles:['admin']});});const f=(await api('/api/mfa/enroll',{},admin)).body.data;await api('/api/mfa/verify',{factorId:f.id,code:otp(f.totp.secret,Math.floor(Date.now()/30000))},admin);});
after(async()=>{if(server)await new Promise(r=>server.close(r));store?.close();if(table.startsWith('VitaTest')){const c=new DynamoDBClient({endpoint:'http://127.0.0.1:8000',region:'us-east-1',credentials:{accessKeyId:'LOCALONLY',secretAccessKey:'LOCALONLY'}});await c.send(new DeleteTableCommand({TableName:table}));c.destroy();}if(dir)rmSync(dir,{recursive:true,force:true});});
test('actual DynamoDB transactions prevent lost update',async()=>{await store.put('Test','counter',{n:0});const work=()=>store.transaction(async tx=>{const v=await tx.get('Test','counter');await new Promise(r=>setTimeout(r,50));await tx.put('Test','counter',{n:v.n+1});});const results=await Promise.allSettled([work(),work()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await store.get('Test','counter')).n,1);});
test('identity and role separation enforced',async()=>{assert.equal((await api('/api/query',{table:'profiles'})).status,401);assert.equal((await api('/api/query',{table:'global_roles',action:'insert',values:{role:'admin'}},alice)).status,403);assert.equal((await api('/api/query',{table:'profiles',filters:{id:await uid('bob@example.test')}},alice)).body.data.length,0);assert.equal((await api('/api/rpc',{name:'account_metrics'},alice)).status,403);assert.equal((await api('/api/rpc',{name:'account_metrics'},admin)).body.data.accounts,3);});
test('only verified support can exercise the admin role with MFA',async()=>{
 const id=await uid('bob@example.test'), user=await store.get('Users',id);
 const bobSessionKey=digest(bob.split('=')[1]), adminSessionKey=digest(admin.split('=')[1]);
 const bobSession=await store.get('Sessions',bobSessionKey);
 const adminSession=await store.get('Sessions',adminSessionKey);
 await store.put('Users',id,{...user,roles:['admin']});
 try{
  await store.put('Sessions',bobSessionKey,{...bobSession,aal2:adminSession.aal2});
  assert.deepEqual((await api('/api/query',{table:'global_roles'},bob)).body.data,[]);
  assert.equal((await api('/api/admin/accounts',undefined,bob,'GET')).status,403);
  await store.put('Sessions',adminSessionKey,{...adminSession,aal2:0});
  assert.equal((await api('/api/admin/accounts',undefined,admin,'GET')).status,403);
  await store.put('Sessions',adminSessionKey,adminSession);
  assert.equal((await api('/api/admin/accounts',undefined,admin,'GET')).status,200);
 }finally{
  await store.put('Users',id,user);
  await store.put('Sessions',bobSessionKey,bobSession);
  await store.put('Sessions',adminSessionKey,adminSession);
 }
});
test('approved request creates business once',async()=>{await api('/api/query',{table:'access_requests',action:'insert',values:{user_id:await uid('alice@example.test'),kind:'business',name:'Test cafe'}},alice);const r=(await store.list('Requests'))[0];assert.equal((await api('/api/rpc',{name:'decide_request',args:{request_id:r.id,approve:true}},admin)).status,200);assert.equal((await api('/api/rpc',{name:'decide_request',args:{request_id:r.id,approve:true}},admin)).status,409);assert.equal((await store.list('Organizations')).length,1);});
test('drafts stay private, cross-owner denied, publication preserved',async()=>{const org=(await store.list('Organizations'))[0].id,d={title:'Cafe',summary:'A real test description',language:'es',category:'cafe',address:'Test address',photos:[]};const r=await api('/api/workspaces',{kind:'business',organization_id:org,document:d},alice);assert.equal(r.status,201);let doc=r.body.data;assert.equal((await api('/api/workspaces/'+doc.id,undefined,bob,'GET')).status,403);assert.equal((await api('/api/public/content',undefined,undefined,'GET')).body.data.length,0);doc=(await api('/api/workspaces/'+doc.id+'/submit',{version:doc.version},alice)).body.data;doc=(await api('/api/workspaces/'+doc.id+'/review',{version:doc.version,action:'publish',reason:'Reviewed'},admin)).body.data;assert.equal((await api('/api/workspaces/'+doc.id,{version:doc.version,document:{...d,title:'Unapproved'}},alice,'PUT')).status,200);assert.equal((await api('/api/public/content/'+doc.id,undefined,undefined,'GET')).body.data.document.title,'Cafe');});
test('DynamoDB earn and redeem are atomic and reference-idempotent',async()=>{const org=(await store.list('Organizations'))[0].id;let p=(await api('/api/loyalty/programs',{organization_id:org,name:'Test only',points_per_visit:10,daily_earn_limit:2,conditions:'Test only'},admin)).body.data;assert.equal((await api('/api/loyalty/codes',{program_id:p.id,kind:'earn'},bob)).status,409);await api('/api/loyalty/programs/'+p.id,{active:true},admin,'PATCH');const code=(await api('/api/loyalty/codes',{program_id:p.id,kind:'earn'},bob)).body.data.code;const b={organization_id:org,code,reference:'ticket1'};assert.equal((await api('/api/loyalty/validate',b,bob)).status,403);assert.equal((await api('/api/loyalty/validate',b,alice)).status,200);assert.equal((await api('/api/loyalty/validate',b,alice)).status,200);assert.equal((await api('/api/loyalty/validate',{...b,reference:'ticket2'},alice)).status,409);let reward=(await api('/api/loyalty/programs/'+p.id+'/rewards',{title:'Test gift',cost:10,stock:1,conditions:'Test only'},admin)).body.data;await api('/api/loyalty/rewards/'+reward.id,{active:true},admin,'PATCH');const c1=(await api('/api/loyalty/codes',{program_id:p.id,kind:'redeem',reward_id:reward.id},bob)).body.data.code,c2=(await api('/api/loyalty/codes',{program_id:p.id,kind:'redeem',reward_id:reward.id},bob)).body.data.code;const both=await Promise.all([api('/api/loyalty/validate',{organization_id:org,code:c1,reference:'redeem1'},alice),api('/api/loyalty/validate',{organization_id:org,code:c2,reference:'redeem2'},alice)]);assert.equal(both.filter(x=>x.status===200).length,1);assert.equal((await store.get('Wallets#'+await uid('bob@example.test'),p.id)).balance,0);assert.equal((await store.get('Rewards',reward.id)).stock,0);});
test('reset invalidates all existing sessions; token consumed once',async()=>{await api('/api/auth/reset',{email:'bob@example.test'});const m=readdirSync(join(dir,'mail')).map(f=>JSON.parse(readFileSync(join(dir,'mail',f)))).find(m=>m.to==='bob@example.test'&&m.purpose==='recovery'),token=new URL(m.url).searchParams.get('token');assert.equal((await api('/api/auth/password',{token,password:'new-test-password'})).status,200);assert.equal((await api('/api/query',{table:'profiles'},bob)).status,401);assert.equal((await api('/api/auth/password',{token,password})).status,400);});
test('event and promotion snapshots require another reviewer and validated CDMX dates',async()=>{
 const writerId=await uid('alice@example.test');
 const writer=await store.get('Users',writerId);
 await store.put('Users',writerId,{...writer,roles:[...writer.roles,'writer','editor']});
 const document={title:'Test event',summary:'Confirmed with host',language:'es',photos:[],category:'music',
  day:'2026-11-28',startTime:'18:00',endTime:'20:00',venue:'Test location',address:'Test address',website:'https://example.test/event'};
 assert.equal((await api('/api/workspaces',{kind:'event',document:{...document,day:'2026-02-30'}},alice)).status,400);
 let result=await api('/api/workspaces',{kind:'event',document},alice);
 assert.equal(result.status,201);
 let saved=result.body.data;
 assert.equal((await api('/api/public/content/'+saved.id,undefined,undefined,'GET')).status,404);
 saved=(await api('/api/workspaces/'+saved.id+'/submit',{version:saved.version},alice)).body.data;
 const review={version:saved.version,action:'publish',reason:'Verified source'};
 assert.equal((await api('/api/workspaces/'+saved.id+'/review',review,alice)).status,403);
 assert.equal((await api('/api/workspaces/'+saved.id+'/review',review,admin)).status,200);
 const live=(await api('/api/public/content?kind=event',undefined,undefined,'GET')).body.data;
 assert.equal(live[0].document.startTime,'18:00');
});
test('suspension requires MFA and expires the active session',async()=>{
 const path='/api/admin/accounts/'+await uid('alice@example.test')+'/status';
 assert.equal((await api(path,{status:'suspended',reason:'Test'},alice,'PATCH')).status,403);
 assert.equal((await api(path,{status:'suspended',reason:'Test'},admin,'PATCH')).status,200);
 assert.equal((await api('/api/query',{table:'profiles'},alice)).status,401);
 assert.equal((await api(path,{status:'active',reason:'Test complete'},admin,'PATCH')).status,200);
 assert.equal((await api('/api/query',{table:'profiles'},alice)).status,401);
});
test('profile onboarding, verified visits and transfers remain separate',async()=>{
 const sender=await signup('sender@example.test');
 const receiver=await signup('receiver@example.test');
 const from=await uid('sender@example.test'),to=await uid('receiver@example.test');
 const organization=(await store.list('Organizations'))[0].id;
 const program='profile-test';
 await store.put('Programs',program,{id:program,name:'Profile test',organization_id:organization,active:true,test:true,version:1,points_per_visit:10,daily_earn_limit:1});
 await store.put('Wallets#'+from,program,{program_id:program,program,name:'Profile test',balance:20});
 assert.equal((await api('/api/client/profile',undefined,null,'GET')).status,401);
 assert.equal((await api('/api/client/onboarding',{residence:'tourist',interests:['coffee','music']},sender,'PUT')).status,200);
 assert.equal((await api('/api/client/recipient',{id:to},sender)).body.data.name,'receiver@example.test');
 const reference='77777777-7777-4777-8777-777777777777',payload={to,programId:program,amount:10,reference};
 const first=await api('/api/client/transfers',payload,sender);
 assert.equal(first.status,200);
 assert.equal(first.body.data.balance,5);
 assert.deepEqual((await api('/api/client/transfers',payload,sender)).body.data,first.body.data);
 assert.equal((await api('/api/client/transfers',{...payload,amount:11},sender)).status,409);
 assert.equal((await api('/api/client/transfers/'+reference,undefined,receiver,'GET')).status,404);
 const profile=(await api('/api/client/profile',undefined,receiver,'GET')).body.data;
 assert.equal(profile.programs.find(p=>p.id===program).balance,10);
 assert.equal(profile.badges.find(b=>b.kind==='foot').count,0);
 assert.equal(profile.total,0);
 const owner=(await api('/api/auth/login',{email:'alice@example.test',password})).cookie;
 const qr=(await api('/api/loyalty/codes',{program_id:program,kind:'earn'},receiver)).body.data;
 assert.equal((await api('/api/loyalty/code-status',{code:qr.code},sender)).status,404);
 assert.equal((await api('/api/loyalty/validate',{organization_id:organization,code:qr.code,reference:'client-profile-visit'},owner)).status,200);
 assert.equal((await api('/api/loyalty/code-status',{code:qr.code},receiver)).body.data.status,'confirmed');
 assert.equal((await api('/api/client/profile',undefined,receiver,'GET')).body.data.badges.find(b=>b.kind==='foot').state,'unlocked');
 const profile2=(await api('/api/client/profile',undefined,sender,'GET')).body.data;
 assert.deepEqual(profile2.profile.interests,['coffee','music']);
});

test('fifty medals include ten combos that count distinct verified places',async()=>{
 const {awardBadges}=await import('../server/dynamo/adventure-badges.mjs');
 const options={total:0,categories:0,dateKey:date=>date};
 const initial=awardBadges([],options);
 assert.equal(initial.length,50);
 assert.equal(new Set(initial.map(m=>m.kind)).size,50);
 assert.equal(initial.filter(m=>m.group==='exclusive').length,10);
 assert.ok(initial.every(m=>m.state==='locked'));
 const bar=i=>({venue:'bar'+i,created_at:'2026-11-20',tags:['bar','nightlife']});
 const taco=i=>({venue:'taco'+i,created_at:'2026-11-20',tags:['taco','restaurant']});
 const find=(rows,id)=>rows.find(m=>m.kind===id);
 const partial=awardBadges([...Array.from({length:5},(_,i)=>bar(i)),...Array.from({length:10},()=>taco(0))],{...options,total:6,categories:2});
 assert.equal(find(partial,'knight').state,'unlocked');
 assert.equal(find(partial,'taco').count,1);
 assert.equal(find(partial,'taco-after-dark').state,'progress');
 assert.deepEqual(find(partial,'taco-after-dark').requirements.map(m=>m.unlocked),[false,true]);
 const completed=awardBadges([...Array.from({length:5},(_,i)=>bar(i)),...Array.from({length:5},(_,i)=>taco(i))],{...options,total:10,categories:2});
 assert.equal(find(completed,'taco-after-dark').state,'unlocked');
 assert.equal(find(completed,'hall-of-vita').state,'locked');
});

test('signup OTP is one-use and unlocks one welcome bonus without visit credit',async()=>{
 const email='welcome@example.test';
 const proposed='a-new-test-password-123';
 assert.equal((await api('/api/auth/signup',{email,password,name:'Welcome test'})).status,200);
 const id=await uid(email);
 const mail=readdirSync(join(dir,'mail')).map(f=>JSON.parse(readFileSync(join(dir,'mail',f)))).find(m=>m.to===email);
 assert.match(mail.code,/^\d{6}$/);
 const bad=mail.code==='000000'?'000001':'000000';
 assert.equal((await api('/api/auth/verify-code',{email,code:bad,password:proposed})).status,400);
 assert.equal((await store.get('RegistrationCodes',id)).failures,1);
 assert.equal((await api('/api/auth/verify-code',{email,code:mail.code,password:proposed})).status,200);
 assert.equal((await api('/api/auth/verify-code',{email,code:mail.code,password:proposed})).status,400);
 const login=await api('/api/auth/login',{email,password:proposed});
 assert.equal(login.status,200);
 const first=await api('/api/client/welcome',{},login.cookie);
 assert.equal(first.status,200);
 assert.equal(first.body.data.points,10);
 assert.equal((await api('/api/client/welcome',{},login.cookie)).body.data.claimed,true);
 const data=(await api('/api/client/profile',undefined,login.cookie,'GET')).body.data;
 assert.equal(data.programs.find(p=>p.id===first.body.data.programId).balance,10);
 assert.equal(data.activity.filter(row=>row.type==='welcome').length,1);
 assert.equal(data.total,0);
});

test('mission progress counts only visits after starting and distinguishes places',async()=>{
 const {missionProgress}=await import('../server/dynamo/neighborhood-missions.mjs');
 const before='2026-11-01T12:00:00.000Z',start='2026-11-02T12:00:00.000Z',after='2026-11-03T12:00:00.000Z';
 const visit=(venue,created_at,category)=>({venue,created_at,category,tags:[category]});
 const record={startedAt:{'coffee-trail':start,'mix-it-up':start},active:'mix-it-up'};
 const visits=[visit('old',before,'cafe'),visit('cafe1',after,'cafe'),visit('cafe1',after,'cafe')];
 const first=missionProgress(visits,record,['coffee']);
 assert.equal(first.find(m=>m.id==='coffee-trail').count,1);
 assert.equal(first.find(m=>m.id==='coffee-trail').suggested,true);
 assert.equal(first.find(m=>m.id==='first-stamp').count,0);
 assert.equal(first.find(m=>m.id==='mix-it-up').active,true);
 const next=missionProgress([...visits,visit('cafe2',after,'cafe'),visit('store',after,'store')],{...record,active:'coffee-trail'},[]);
 assert.equal(next.find(m=>m.id==='coffee-trail').complete,true);
 assert.equal(next.find(m=>m.id==='mix-it-up').complete,true);
 assert.equal(next.find(m=>m.id==='mix-it-up').active,false);
});

test('registration type requests business access only after OTP and never grants privilege',async()=>{
 const email='new-hotel@example.test';
 assert.equal((await api('/api/auth/signup',{name:'Host',email,password,registration:{type:'admin'}})).status,400);
 const registration={type:'business',businessType:'stay',businessName:'Hotel de prueba'};
 assert.equal((await api('/api/auth/signup',{name:'Host',email,password,registration})).status,200);
 const id=await uid(email);
 assert.ok(!(await store.list('Requests')).some(item=>item.user_id===id));
 const {code}=readdirSync(join(dir,'mail')).map(f=>JSON.parse(readFileSync(join(dir,'mail',f)))).find(m=>m.to===email);
 const verified=await api('/api/auth/verify-code',{email,code,password,registration});
 assert.equal(verified.status,200);
 assert.equal(verified.body.pending,true);
 const request=(await store.list('Requests')).find(item=>item.user_id===id);
 assert.equal(request.status,'pending');
 assert.equal(request.business_type,'stay');
 assert.deepEqual((await store.get('Users',id)).roles,[]);
 assert.ok(!(await store.list('Memberships')).some(item=>item.user_id===id));
 assert.equal((await api('/api/rpc',{name:'decide_request',args:{request_id:request.id,approve:true}},admin)).status,200);
 assert.ok((await store.list('Organizations')).some(org=>org.name===registration.businessName&&org.business_type==='stay'));
});

test('hosted registration sends the branded OTP through configured delivery',async()=>{
 const {request}=await import('node:http');
 const {accountEmail}=await import('../server/account-email.mjs');
 const site='https://roma-condesa.app';
 const gateway='integration-test-gateway';
 const deliveries=[];
 const hosted=await createDynamoApp({store,origin:site,dataDir:dir,gatewayKey:gateway,delivery:{
  async send(message){deliveries.push({...message,render:accountEmail(message)});}
 }});
 const listener=await new Promise(resolve=>{
  const bound=hosted.app.listen(0,'127.0.0.1',()=>resolve(bound));
 });
 function call(path,body){
  return new Promise((resolve,reject)=>{
   const req=request({host:'127.0.0.1',port:listener.address().port,path,
    method:body?'POST':'GET',headers:{Host:'roma-condesa.app',Origin:site,
     'x-vita-gateway':gateway,'Content-Type':'application/json'}},res=>{
     let text='';
     res.setEncoding('utf8');
     res.on('data',chunk=>{text+=chunk;});
     res.on('end',()=>resolve({status:res.statusCode,text,cookie:res.headers['set-cookie']?.[0]}));
   });
   req.on('error',reject);
   req.end(body?JSON.stringify(body):undefined);
  });
 }
 try{
  const config=await call('/account-config.js');
  assert.match(config.text,/"registrationEnabled":true/);
  assert.match(config.text,/"localMailbox":false/);
  const email='hosted-signup@example.test',registration={type:'writer'};
  assert.equal((await call('/api/auth/signup',{email,password,name:'Autora',registration})).status,200);
  assert.equal(deliveries.length,1);
  const [message]=deliveries;
  assert.equal(message.to,email);
  assert.match(message.otpCode,/^\d{6}$/);
  assert.ok(message.render.html.includes(message.otpCode));
  assert.match(message.render.html,/cid:lavita-logo/);
  assert.equal((await call('/dev/mail')).status,404);
  const verified=await call('/api/auth/verify-code',{email,password,code:message.otpCode});
  assert.equal(verified.status,200);
  assert.equal(JSON.parse(verified.text).pending,true);
  const login=await call('/api/auth/login',{email,password});
  assert.equal(login.status,200);
  assert.match(login.cookie,/Secure/);
  assert.match(login.cookie,/HttpOnly/);
 }finally{await new Promise(resolve=>listener.close(resolve));}
});
