import {createDynamoApp} from './dynamo/app.mjs';
const port=Number(process.env.PORT||4173),origin=process.env.APP_ORIGIN||`http://localhost:${port}`;
const {app,store}=await createDynamoApp({origin,gatewayKey:process.env.VITA_GATEWAY_KEY||'',endpoint:process.env.DYNAMODB_ENDPOINT||'http://127.0.0.1:8000',table:process.env.DYNAMODB_TABLE||'LaVitaLocal',...(process.env.DATA_DIR?{dataDir:process.env.DATA_DIR}:{})});
const server=app.listen(port,process.env.BIND_HOST||'127.0.0.1',()=>console.log(`La Vita / DynamoDB Local: ${origin}/cuenta`));
function stop(){server.close(()=>{store.close();process.exit(0);});}process.on('SIGINT',stop);process.on('SIGTERM',stop);
