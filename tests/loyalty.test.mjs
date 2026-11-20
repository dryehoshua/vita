import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createApp} from '../server/app.mjs';
const origin='http://127.0.0.1:18948',digest=s=>createHash('sha256').update(s).digest('hex');
let server,db,dir;const users={},cookies={};
const run=(sql,...args)=>db.prepare(sql).run(...args),get=(sql,...args)=>db.prepare(sql).get(...args);
async function request(path,body,user='admin',method='POST'){
 const response=await fetch(origin+'/api/loyalty'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookies[user]||''},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};
}
let org,otherOrg,program,reward;
before(async()=>{
 dir=mkdtempSync(join(tmpdir(),'vita-loyalty-'));const x=createApp({dataDir:dir,origin});db=x.db;
 for(const name of ['admin','noMfa','customer','other','staff','foreignStaff']){const id=randomUUID();users[name]=id;run('INSERT INTO users(id,email,password,verified) VALUES(?,?,?,1)',id,name+'@example.test','not-used');run('INSERT INTO profiles(id,display_name) VALUES(?,?)',id,name);const raw=randomUUID();cookies[name]='vita_session='+raw;run('INSERT INTO sessions VALUES(?,?,?,?)',digest(raw),id,Date.now()+3600000,name==='admin'?Date.now()+3600000:0);}
 for(const name of ['admin','noMfa'])run("INSERT INTO global_roles VALUES(?,'admin')",users[name]);
 org=randomUUID();otherOrg=randomUUID();run('INSERT INTO organizations VALUES(?,?)',org,'Test shop');run('INSERT INTO organizations VALUES(?,?)',otherOrg,'Other shop');run("INSERT INTO memberships VALUES(?,?,'staff',1)",org,users.staff);run("INSERT INTO memberships VALUES(?,?,'staff',1)",otherOrg,users.foreignStaff);
 server=x.app.listen(18948,'127.0.0.1');await new Promise(r=>server.once('listening',r));
});
after(async()=>{if(server)await new Promise(r=>server.close(r));db?.close();if(dir)rmSync(dir,{recursive:true,force:true});});
const programInput=()=>({organization_id:org,name:'Test program',points_per_visit:10,daily_earn_limit:3,conditions:'Test-only terms. No commercial offer.'});
const code=async(kind='earn',user='customer')=>request('/codes',{program_id:program,kind,...(kind==='redeem'?{reward_id:reward}:{})},user);
const validate=(raw,reference,user='staff',organization_id=org)=>request('/validate',{organization_id,code:raw,reference},user);
test('program creation and activation require admin MFA; defaults never activate economics',async()=>{
 assert.equal((await request('/programs',programInput(),'staff')).status,403);assert.equal((await request('/programs',programInput(),'noMfa')).status,403);
 const p=await request('/programs',programInput());assert.equal(p.status,201);program=p.body.data.id;assert.equal(p.body.data.active,false);
 assert.deepEqual((await request('/programs',null,'customer','GET')).body.data,[]);assert.equal((await code()).status,409);
 assert.equal((await request('/programs/'+program,{active:true},'staff','PATCH')).status,403);assert.equal((await request('/programs/'+program,{active:true},'admin','PATCH')).status,200);
 const r=await request('/programs/'+program+'/rewards',{title:'Test reward',cost:10,stock:1,conditions:'Test only'});assert.equal(r.status,201);reward=r.body.data.id;assert.equal(r.body.data.active,false);await request('/rewards/'+reward,{active:true},'admin','PATCH');
});
test('code is opaque and earning uses server rule, not client balance',async()=>{
 const c=await code();assert.equal(c.status,201);assert.match(c.body.data.code,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(c.body).includes(users.customer),false);
 assert.equal((await request('/validate',{organization_id:org,code:c.body.data.code,reference:'forged',points:999},'staff')).status,400);
 const r=await validate(c.body.data.code,'visit-1');assert.equal(r.status,200);assert.equal(r.body.data.delta,10);assert.equal(r.body.data.balance,10);
 const retry=await validate(c.body.data.code,'visit-1');assert.deepEqual(retry.body,r.body);assert.equal((await validate(c.body.data.code,'visit-new')).status,409);
 assert.equal(get('SELECT count(*) n FROM point_entries WHERE user_id=?',users.customer).n,1);
});
test('merchant references cannot be reused for another code',async()=>{const c=await code();assert.equal((await validate(c.body.data.code,'visit-1')).status,409);assert.equal(get('SELECT consumed_at FROM loyalty_codes WHERE hash=?',digest(c.body.data.code)).consumed_at,null);});
test('code and operation visibility stay within an active business team',async()=>{
 const c=await code();assert.equal((await request('/inspect',{organization_id:org,code:c.body.data.code},'customer')).status,403);
 assert.equal((await validate(c.body.data.code,'wrong-business','foreignStaff',otherOrg)).status,403);
 assert.equal((await request('/operations?organization_id='+org,null,'foreignStaff','GET')).status,403);
 run('UPDATE memberships SET active=0 WHERE user_id=?',users.staff);assert.equal((await validate(c.body.data.code,'revoked')).status,403);run('UPDATE memberships SET active=1 WHERE user_id=?',users.staff);
 assert.equal((await request('/inspect',{organization_id:org,code:c.body.data.code},'staff')).body.data.display_name,'customer');
});
test('expired codes and program edits invalidate earlier promises',async()=>{
 const c=await code();run('UPDATE loyalty_codes SET expires=? WHERE hash=?',Date.now()-1,digest(c.body.data.code));assert.equal((await validate(c.body.data.code,'expired')).status,410);
 const fresh=await code();await request('/programs/'+program,{conditions:'Updated test conditions'},'admin','PATCH');assert.equal((await validate(fresh.body.data.code,'stale')).status,409);
});
test('simultaneous reward redemptions cannot overspend or overdraw stock',async()=>{
 // All still-pending earn codes are expired to allow a clean independent operation window.
 run('UPDATE loyalty_codes SET expires=? WHERE consumed_at IS NULL',Date.now()-1);
 const one=await code('redeem'),two=await code('redeem');assert.equal(one.status,201);assert.equal(two.status,201);
 assert.equal(get('SELECT sum(delta) n FROM point_entries WHERE user_id=?',users.customer).n,10);
 const results=await Promise.all([validate(one.body.data.code,'redeem-a'),validate(two.body.data.code,'redeem-b')]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 assert.equal(get('SELECT stock FROM loyalty_rewards WHERE id=?',reward).stock,0);assert.equal(get('SELECT sum(delta) n FROM point_entries WHERE user_id=?',users.customer).n,0);
 assert.equal((await code('redeem')).status,409);
});
test('customer wallet is private, immutable, and reversed with compensating entries',async()=>{
 const wallet=await request('/wallet',null,'customer','GET');assert.equal(wallet.body.data.balances[0].balance,0);assert.equal(wallet.body.data.ledger.length,2);
 assert.equal((await request('/wallet',null,'other','GET')).body.data.ledger.length,0);
 assert.throws(()=>run('UPDATE point_entries SET delta=999'));assert.throws(()=>run('DELETE FROM point_entries'));
 const op=get("SELECT id FROM loyalty_operations WHERE kind='redeem'").id;
 assert.equal((await request('/operations/'+op+'/reverse',{reason:'Test delivery cancellation'},'staff')).status,403);
 const reversed=await request('/operations/'+op+'/reverse',{reason:'Test delivery cancellation'});assert.equal(reversed.status,200);assert.equal(reversed.body.data.delta,10);
 assert.equal(get('SELECT stock FROM loyalty_rewards WHERE id=?',reward).stock,1);assert.equal((await request('/operations/'+op+'/reverse',{reason:'Repeated'})).status,409);
 assert.equal(get('SELECT count(*) n FROM point_entries WHERE user_id=?',users.customer).n,3);
});
test('daily visit limits cannot be bypassed with new codes or references',async()=>{
 run('UPDATE loyalty_codes SET expires=? WHERE consumed_at IS NULL',Date.now()-1);
 for(const reference of ['visit-2','visit-3']){const c=await code();assert.equal((await validate(c.body.data.code,reference)).status,200);}
 const c=await code();assert.equal((await validate(c.body.data.code,'visit-4')).status,409);
 assert.equal(get("SELECT count(*) n FROM loyalty_operations WHERE user_id=? AND kind='earn'",users.customer).n,3);
});
