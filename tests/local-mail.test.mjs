import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.mjs';
test('local mailbox is hidden behind proxies and non-loopback origins',async()=>{
 for(const origin of ['http://127.0.0.1:18944','https://preview.example.test']){
  const dir=mkdtempSync(join(tmpdir(),'vita-mail-')),x=createApp({dataDir:dir,origin});const server=x.app.listen(18944,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try{const headers={Host:new URL(origin).host,Connection:'close'};const direct=await fetch('http://127.0.0.1:18944/dev/mail',{headers});assert.equal(direct.status,origin.startsWith('http:')?200:403);const forwarded=await fetch('http://127.0.0.1:18944/dev/mail',{headers:{...headers,'cf-ray':'test'}});assert.ok([403,404].includes(forwarded.status));}finally{await new Promise(r=>server.close(r));x.db.close();rmSync(dir,{recursive:true,force:true});}
 }
});
