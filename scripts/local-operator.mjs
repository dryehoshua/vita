import {readdirSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openStore} from '../server/dynamo/store.mjs';
const dir=resolve(process.env.DATA_DIR||'.local-data'),action=process.argv[2];
if(action==='mail'){
 for(const f of readdirSync(join(dir,'mail')).sort().slice(-10)){const m=JSON.parse(readFileSync(join(dir,'mail',f),'utf8'));console.log(`${m.to} — ${m.purpose}\n${m.code?'Código: '+m.code:m.url}\n`);}
}else if(action==='admin'){
 const email=process.argv[3]?.toLowerCase();if(!email)throw Error('Usage: npm run admin:local -- email@example.test');
 const store=await openStore({table:process.env.DYNAMODB_TABLE||'LaVitaLocal'});
 try{await store.transaction(async tx=>{const i=await tx.get('Emails',email),u=i?await tx.get('Users',i.id):null;if(!u?.verified)throw Error('Create and verify this local account first');await tx.put('Users',u.id,{...u,roles:[...new Set([...u.roles,'admin'])]});const id=randomUUID();await tx.put('Audit',id,{id,actor:'local-operator',action:'grant_admin',subject:u.id,created_at:new Date().toISOString()});});console.log('Local administrator assigned in DynamoDB. TOTP required in the app.');}finally{store.close();}
}else throw Error('Use mail or admin');
