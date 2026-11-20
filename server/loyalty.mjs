import {randomBytes,randomUUID,createHash} from 'node:crypto';

/** Transactional loyalty. No defaults create or activate commercial obligations. */
export function mountLoyalty(app,{db,authenticated,isAdmin}) {
 const get=(sql,...args)=>db.prepare(sql).get(...args),all=(sql,...args)=>db.prepare(sql).all(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
 const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
 const hash=s=>createHash('sha256').update(s).digest('hex');
 const text=(v,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail(400,'Invalid text');return v.trim();};
 const integer=(v,min,max)=>{if(!Number.isSafeInteger(v)||v<min||v>max)fail(400,'Invalid integer');return v;};
 const fields=(obj,names)=>{if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).some(k=>!names.includes(k)))fail(400,'Invalid fields');};
 const flag=v=>{if(typeof v!=='boolean')fail(400,'Invalid state');return Number(v);};
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}};
 const requireAdmin=req=>{if(!isAdmin(req))fail(403,'Administrator and MFA required');};
 const requireTeam=(req,org)=>{if(!get("SELECT 1 FROM memberships WHERE user_id=? AND organization_id=? AND active=1 AND role IN ('owner','staff')",req.user.id,org))fail(403,'Active business team required');};
 const audit=(req,action,subject)=>run('INSERT INTO audit_log(actor,action,subject) VALUES(?,?,?)',req.user.id,action,subject);
 const date=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const balance=(user,program)=>get('SELECT coalesce(sum(delta),0) amount FROM point_entries WHERE user_id=? AND program=?',user,program).amount;
 db.exec(`
 CREATE TABLE IF NOT EXISTS loyalty_programs (
  id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organizations(id),name TEXT NOT NULL,
  points_per_visit INTEGER NOT NULL CHECK(points_per_visit BETWEEN 1 AND 100000),
  daily_earn_limit INTEGER NOT NULL CHECK(daily_earn_limit BETWEEN 1 AND 100),conditions TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 );
 CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id TEXT PRIMARY KEY,program_id TEXT NOT NULL REFERENCES loyalty_programs(id),title TEXT NOT NULL,
  cost INTEGER NOT NULL CHECK(cost BETWEEN 1 AND 100000000),stock INTEGER NOT NULL CHECK(stock BETWEEN 0 AND 1000000),
  conditions TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),version INTEGER NOT NULL DEFAULT 1
 );
 CREATE TABLE IF NOT EXISTS loyalty_codes (
  hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),program_id TEXT NOT NULL REFERENCES loyalty_programs(id),
  program_version INTEGER NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('earn','redeem')),
  reward_id TEXT REFERENCES loyalty_rewards(id),reward_version INTEGER,points INTEGER NOT NULL,
  expires INTEGER NOT NULL,consumed_at TEXT,operation_id TEXT
 );
 CREATE TABLE IF NOT EXISTS loyalty_operations (
  id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organizations(id),program_id TEXT NOT NULL REFERENCES loyalty_programs(id),
  user_id TEXT NOT NULL REFERENCES users(id),actor_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('earn','redeem','reversal')),
  delta INTEGER NOT NULL,balance INTEGER NOT NULL,reference TEXT NOT NULL,code_hash TEXT,reward_id TEXT REFERENCES loyalty_rewards(id),
  day TEXT NOT NULL,created_at TEXT NOT NULL,reason TEXT NOT NULL,reverses_id TEXT UNIQUE REFERENCES loyalty_operations(id),
  UNIQUE(organization_id,reference)
 );
 CREATE INDEX IF NOT EXISTS loyalty_user_program_day ON loyalty_operations(user_id,program_id,day,kind);
 CREATE INDEX IF NOT EXISTS loyalty_code_expiry ON loyalty_codes(user_id,expires);
 CREATE TRIGGER IF NOT EXISTS point_entries_immutable_update BEFORE UPDATE ON point_entries BEGIN SELECT RAISE(ABORT,'Point ledger is immutable'); END;
 CREATE TRIGGER IF NOT EXISTS point_entries_immutable_delete BEFORE DELETE ON point_entries BEGIN SELECT RAISE(ABORT,'Point ledger is immutable'); END;
 `);
 const program=id=>{const p=get('SELECT p.*,o.name organization_name FROM loyalty_programs p JOIN organizations o ON o.id=p.organization_id WHERE p.id=?',id);if(!p)fail(404,'Program not found');return p;};
 const reward=id=>{const r=get('SELECT * FROM loyalty_rewards WHERE id=?',id);if(!r)fail(404,'Reward not found');return r;};
 const serializeProgram=(p,admin=false)=>({...p,active:!!p.active,rewards:all('SELECT * FROM loyalty_rewards WHERE program_id=?'+(admin?'':' AND active=1'),p.id).map(r=>({...r,active:!!r.active}))});
 const serializeOperation=o=>{const {code_hash,actor_id,...safe}=o;return safe;};
 const validCode=(raw,org)=>{
  if(typeof raw!=='string'||!/^[a-f0-9]{64}$/.test(raw))fail(400,'Invalid code');
  const c=get('SELECT * FROM loyalty_codes WHERE hash=?',hash(raw));if(!c)fail(404,'Code not found');
  const p=program(c.program_id);if(p.organization_id!==org)fail(403,'Code belongs to another business');
  if(c.consumed_at)fail(409,'Code already used');if(c.expires<=Date.now())fail(410,'Code expired');
  if(!p.active)fail(409,'Program is paused');if(c.program_version!==p.version)fail(409,'Program changed; generate a new code');
  let r=null;if(c.kind==='redeem'){r=reward(c.reward_id);if(!r.active||r.program_id!==p.id||r.stock<1)fail(409,'Reward unavailable');if(r.version!==c.reward_version||r.cost!==c.points)fail(409,'Reward changed; generate a new code');}
  return {c,p,r};
 };
 app.get('/api/loyalty/programs',authenticated,(req,res)=>{const admin=!!isAdmin(req);res.json({data:all('SELECT p.*,o.name organization_name FROM loyalty_programs p JOIN organizations o ON o.id=p.organization_id'+(admin?'':' WHERE p.active=1')+' ORDER BY p.created_at DESC').map(p=>serializeProgram(p,admin))});});
 app.post('/api/loyalty/programs',authenticated,(req,res)=>{
  requireAdmin(req);fields(req.body,['organization_id','name','points_per_visit','daily_earn_limit','conditions']);const v=req.body,id=randomUUID();
  if(!get('SELECT 1 FROM organizations WHERE id=?',text(v.organization_id)))fail(404,'Business not found');
  transaction(()=>{run('INSERT INTO loyalty_programs(id,organization_id,name,points_per_visit,daily_earn_limit,conditions) VALUES(?,?,?,?,?,?)',id,v.organization_id,text(v.name,120),integer(v.points_per_visit,1,100000),integer(v.daily_earn_limit,1,100),text(v.conditions,3000));audit(req,'loyalty_program_created',id);});
  res.status(201).json({data:serializeProgram(program(id),true)});
 });
 app.patch('/api/loyalty/programs/:id',authenticated,(req,res)=>{
  requireAdmin(req);fields(req.body,['name','points_per_visit','daily_earn_limit','conditions','active']);const p=program(req.params.id),v={...p,...req.body};
  const active=Object.hasOwn(req.body,'active')?flag(req.body.active):p.active;
  transaction(()=>{run('UPDATE loyalty_programs SET name=?,points_per_visit=?,daily_earn_limit=?,conditions=?,active=?,version=version+1 WHERE id=?',text(v.name,120),integer(v.points_per_visit,1,100000),integer(v.daily_earn_limit,1,100),text(v.conditions,3000),active,p.id);audit(req,'loyalty_program_updated',p.id);});res.json({data:serializeProgram(program(p.id),true)});
 });
 app.post('/api/loyalty/programs/:id/rewards',authenticated,(req,res)=>{
  requireAdmin(req);fields(req.body,['title','cost','stock','conditions']);const p=program(req.params.id),v=req.body,id=randomUUID();
  transaction(()=>{run('INSERT INTO loyalty_rewards(id,program_id,title,cost,stock,conditions) VALUES(?,?,?,?,?,?)',id,p.id,text(v.title,120),integer(v.cost,1,100000000),integer(v.stock,0,1000000),text(v.conditions,3000));audit(req,'loyalty_reward_created',id);});res.status(201).json({data:{...reward(id),active:false}});
 });
 app.patch('/api/loyalty/rewards/:id',authenticated,(req,res)=>{
  requireAdmin(req);fields(req.body,['title','cost','stock','conditions','active']);const r=reward(req.params.id),v={...r,...req.body};const active=Object.hasOwn(req.body,'active')?flag(req.body.active):r.active;
  transaction(()=>{run('UPDATE loyalty_rewards SET title=?,cost=?,stock=?,conditions=?,active=?,version=version+1 WHERE id=?',text(v.title,120),integer(v.cost,1,100000000),integer(v.stock,0,1000000),text(v.conditions,3000),active,r.id);audit(req,'loyalty_reward_updated',r.id);});res.json({data:{...reward(r.id),active:!!active}});
 });
 app.get('/api/loyalty/wallet',authenticated,(req,res)=>{
  const balances=all('SELECT e.program program_id,coalesce(p.name,e.program) program_name,o.name organization_name,sum(e.delta) balance FROM point_entries e LEFT JOIN loyalty_programs p ON p.id=e.program LEFT JOIN organizations o ON o.id=p.organization_id WHERE e.user_id=? GROUP BY e.program ORDER BY program_name',req.user.id);
  const ledger=all('SELECT e.id,e.program program_id,p.name program_name,e.delta,e.reason,e.created_at FROM point_entries e LEFT JOIN loyalty_programs p ON p.id=e.program WHERE e.user_id=? ORDER BY e.created_at DESC,e.rowid DESC LIMIT 200',req.user.id);res.json({data:{balances,ledger}});
 });
 app.post('/api/loyalty/codes',authenticated,(req,res)=>{
  fields(req.body,['program_id','kind','reward_id']);const p=program(text(req.body.program_id)),kind=req.body.kind;if(!p.active)fail(409,'Program is paused');if(!['earn','redeem'].includes(kind))fail(400,'Invalid operation');
  let r=null,points=p.points_per_visit;
  if(kind==='redeem'){r=reward(text(req.body.reward_id));if(r.program_id!==p.id||!r.active||r.stock<1)fail(409,'Reward unavailable');points=r.cost;if(balance(req.user.id,p.id)<points)fail(409,'Insufficient points');}
  else if(req.body.reward_id)fail(400,'Earn code cannot contain a reward');
  if(get('SELECT count(*) n FROM loyalty_codes WHERE user_id=? AND consumed_at IS NULL AND expires>?',req.user.id,Date.now()).n>=5)fail(429,'Too many pending codes; wait for expiry');
  const code=randomBytes(32).toString('hex'),expires=Date.now()+300000;
  run('INSERT INTO loyalty_codes(hash,user_id,program_id,program_version,kind,reward_id,reward_version,points,expires) VALUES(?,?,?,?,?,?,?,?,?)',hash(code),req.user.id,p.id,p.version,kind,r?.id??null,r?.version??null,points,expires);
  res.status(201).json({data:{code,expires_at:new Date(expires).toISOString(),kind,program_id:p.id,reward_id:r?.id??null,points}});
 });
 app.post('/api/loyalty/inspect',authenticated,(req,res)=>{
  fields(req.body,['organization_id','code']);const org=text(req.body.organization_id);requireTeam(req,org);const {c,p,r}=validCode(req.body.code,org);
  res.json({data:{program_id:p.id,program_name:p.name,kind:c.kind,points:c.points,reward_title:r?.title??null,display_name:get('SELECT display_name FROM profiles WHERE id=?',c.user_id)?.display_name||'',expires_at:new Date(c.expires).toISOString(),conditions:r?.conditions||p.conditions}});
 });
 app.post('/api/loyalty/validate',authenticated,(req,res)=>{
  fields(req.body,['organization_id','code','reference']);const org=text(req.body.organization_id),reference=text(req.body.reference,120);if(reference.startsWith('reversal:'))fail(400,'Reserved reference');requireTeam(req,org);
  if(typeof req.body.code!=='string'||!/^[a-f0-9]{64}$/.test(req.body.code))fail(400,'Invalid code');const codeHash=hash(req.body.code);
  const result=transaction(()=>{
   const prior=get('SELECT * FROM loyalty_operations WHERE organization_id=? AND reference=?',org,reference);
   if(prior){if(prior.code_hash!==codeHash)fail(409,'Reference already belongs to another operation');return prior;}
   const {c,p,r}=validCode(req.body.code,org),day=date();
   if(c.kind==='earn'&&get("SELECT count(*) n FROM loyalty_operations WHERE user_id=? AND program_id=? AND day=? AND kind='earn'",c.user_id,p.id,day).n>=p.daily_earn_limit)fail(409,'Daily earning limit reached');
   const before=balance(c.user_id,p.id),delta=c.kind==='earn'?p.points_per_visit:-r.cost;
   if(before+delta<0)fail(409,'Insufficient points');
   if(!Number.isSafeInteger(before+delta))fail(409,'Balance limit reached');
   const id=randomUUID(),created=new Date().toISOString(),reason=c.kind==='earn'?'Visita validada manualmente por el negocio':`Recompensa: ${r.title}`;
   run('INSERT INTO point_entries(id,user_id,program,delta,reason,reference,created_at) VALUES(?,?,?,?,?,?,?)',randomUUID(),c.user_id,p.id,delta,reason,'loyalty:'+id,created);
   if(r)run('UPDATE loyalty_rewards SET stock=stock-1 WHERE id=? AND stock>0',r.id);
   run('INSERT INTO loyalty_operations(id,organization_id,program_id,user_id,actor_id,kind,delta,balance,reference,code_hash,reward_id,day,created_at,reason) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,org,p.id,c.user_id,req.user.id,c.kind,delta,before+delta,reference,codeHash,r?.id??null,day,created,reason);
   run('UPDATE loyalty_codes SET consumed_at=?,operation_id=? WHERE hash=?',created,id,c.hash);audit(req,'loyalty_'+c.kind,id);
   return get('SELECT * FROM loyalty_operations WHERE id=?',id);
  });res.json({data:serializeOperation(result)});
 });
 app.get('/api/loyalty/operations',authenticated,(req,res)=>{const org=text(req.query.organization_id);requireTeam(req,org);res.json({data:all('SELECT * FROM loyalty_operations WHERE organization_id=? ORDER BY created_at DESC,rowid DESC LIMIT 200',org).map(serializeOperation)});});
 app.post('/api/loyalty/operations/:id/reverse',authenticated,(req,res)=>{
  requireAdmin(req);fields(req.body,['reason']);const reason=text(req.body.reason,1000);
  const result=transaction(()=>{const previous=get('SELECT * FROM loyalty_operations WHERE id=?',req.params.id);if(!previous)fail(404,'Operation not found');if(previous.kind==='reversal')fail(409,'Cannot reverse a reversal');if(get('SELECT 1 FROM loyalty_operations WHERE reverses_id=?',previous.id))fail(409,'Operation already reversed');
   const b=balance(previous.user_id,previous.program_id),delta=-previous.delta;if(!Number.isSafeInteger(b+delta))fail(409,'Balance limit reached');if(b+delta<0)fail(409,'Insufficient points to reverse earning');const id=randomUUID(),created=new Date().toISOString();
   run('INSERT INTO point_entries(id,user_id,program,delta,reason,reference,created_at) VALUES(?,?,?,?,?,?,?)',randomUUID(),previous.user_id,previous.program_id,delta,'Reversión: '+reason,'loyalty:'+id,created);
   if(previous.kind==='redeem')run('UPDATE loyalty_rewards SET stock=stock+1 WHERE id=?',previous.reward_id);
   run("INSERT INTO loyalty_operations(id,organization_id,program_id,user_id,actor_id,kind,delta,balance,reference,reward_id,day,created_at,reason,reverses_id) VALUES(?,?,?,?,?,'reversal',?,?,?,?,?,?,?,?)",id,previous.organization_id,previous.program_id,previous.user_id,req.user.id,delta,b+delta,'reversal:'+previous.id,previous.reward_id,date(),created,reason,previous.id);audit(req,'loyalty_reversal',id);return get('SELECT * FROM loyalty_operations WHERE id=?',id);
  });res.json({data:serializeOperation(result)});
 });
}
