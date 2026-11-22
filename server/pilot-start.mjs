import {readFileSync,statSync} from 'node:fs';
import {createDelivery} from './delivery.mjs';
import {createDynamoApp} from './dynamo/app.mjs';
const gatewayKey=readFileSync('.local-data/pilot-gateway.key','utf8').trim();
if(gatewayKey.length<40)throw Error('Invalid gateway key');
let delivery=null;
const mailConfig='.local-data/transactional-mail.json';
try{
 if(statSync(mailConfig).mode&0o077)throw Error('Mail config must be private');
 delivery=createDelivery(JSON.parse(readFileSync(mailConfig,'utf8')));
}catch(error){
 if(error.code!=='ENOENT')console.error('Invalid transactional email configuration. Public sign-up is disabled.');
}
let runtime;
for (let attempt = 0; !runtime; attempt++) {
  try {
    runtime = await createDynamoApp({origin:'https://roma-condesa.app',gatewayKey,delivery});
  } catch (error) {
    if (attempt === 19) throw error;
    await new Promise(resolve => setTimeout(resolve,3000));
  }
}
const {app,store}=runtime;
const server=app.listen(4175,'127.0.0.1',()=>console.log('Pilot origin ready on loopback:4175; private gateway required'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{store.close();process.exit(0);}));
