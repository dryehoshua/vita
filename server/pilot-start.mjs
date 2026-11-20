import {readFileSync} from 'node:fs';
import {createDynamoApp} from './dynamo/app.mjs';
const gatewayKey=readFileSync('.local-data/pilot-gateway.key','utf8').trim();
if(gatewayKey.length<40)throw Error('Invalid gateway key');
const {app,store}=await createDynamoApp({origin:'https://roma-condesa.app',gatewayKey});
const server=app.listen(4175,'127.0.0.1',()=>console.log('Pilot origin ready on loopback:4175; private gateway required'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{store.close();process.exit(0);}));
