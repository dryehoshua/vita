// Read-only legacy input. Never deletes/replaces the SQLite source.
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {openStore} from '../server/dynamo/store.mjs';
const source=new DatabaseSync('.local-data/vita.sqlite',{readOnly:true}),target=await openStore();
const tables=source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name);
const supported=['users','profiles','sessions','tokens','global_roles','organizations','memberships','access_requests','favorites','point_entries','factors','audit_log','page_views'];
for(const t of tables)if(!supported.includes(t)&&source.prepare(`SELECT count(*) n FROM "${t}"`).get().n)throw Error('Migration needed for nonempty legacy table: '+t);
if(await target.get('Migration','sqlite-v1'))throw Error('Migration already recorded; will not overwrite target');
if((await target.list('Users')).length)throw Error('Target already contains users; will not merge automatically');
mkdirSync('.local-data/backups',{recursive:true,mode:0o700});const file='.local-data/backups/pre-dynamo-'+Date.now()+'.sqlite';await backup(source,file);chmodSync(file,0o600);
const rows=t=>tables.includes(t)?source.prepare(`SELECT * FROM "${t}"`).all():[];
const roles=rows('global_roles');let count=0;
for(const u of rows('users')){await target.transaction(async tx=>{if(await tx.get('Emails',u.email)||await tx.get('Users',u.id))throw Error('User conflict');await tx.put('Users',u.id,{...u,verified:!!u.verified,status:u.status||'active',roles:roles.filter(r=>r.user_id===u.id).map(r=>r.role),session_version:0});await tx.put('Emails',u.email,{id:u.id});});count++;}
for(const p of rows('profiles'))await target.put('Profiles',p.id,p);
for(const s of rows('sessions'))await target.put('Sessions',s.hash,{...s,session_version:0});
for(const t of rows('tokens'))await target.put('Tokens',t.hash,t);
for(const o of rows('organizations'))await target.put('Organizations',o.id,o);
for(const m of rows('memberships'))await target.put('Memberships',m.organization_id+':'+m.user_id,{...m,active:!!m.active});
for(const r of rows('access_requests')){await target.put('Requests',r.id,r);if(r.status==='pending')await target.put('Pending',r.user_id+':'+r.kind,{id:r.id});}
for(const f of rows('favorites'))await target.put('Favorites#'+f.user_id,f.path,f);
// No monetary assumptions: preserve ledgers exactly; do not convert demo points.
for(const p of rows('point_entries')){await target.put('Ledger#'+p.user_id,p.id,p);await target.transaction(async tx=>{const w=await tx.get('Wallets#'+p.user_id,p.program)||{program:p.program,program_id:p.program,balance:0};await tx.put('Wallets#'+p.user_id,p.program,{...w,balance:w.balance+p.delta});});}
for(const f of rows('factors'))await target.put('Factors',f.user_id,{...f,verified:!!f.verified});
for(const a of rows('audit_log'))await target.put('Audit',String(a.id),a);
for(const v of rows('page_views'))await target.put('PageViews',v.day+':'+v.path,v);
await target.put('Migration','sqlite-v1',{at:new Date().toISOString(),users:count,backup:file});
source.close();target.close();console.log('Migrated accounts:',count,'; original retained; backup:',file);
