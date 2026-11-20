import {DynamoDBClient,CreateTableCommand,DescribeTableCommand,waitUntilTableExists} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,QueryCommand,TransactWriteCommand} from '@aws-sdk/lib-dynamodb';
export async function openStore({endpoint='http://127.0.0.1:8000',table='LaVitaLocal',cloud=false}={}){
 if(!cloud&&!(process.env.DYNAMODB_CONTAINER==='true'&&endpoint==='http://dynamodb:8000')&&!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(endpoint))throw Error('Local database endpoint must be loopback');
 const client=new DynamoDBClient({region:process.env.AWS_REGION||'us-east-1',...(cloud?{}:{endpoint,credentials:{accessKeyId:'LOCALONLY',secretAccessKey:'LOCALONLY'}})});
 try{await client.send(new DescribeTableCommand({TableName:table}));}catch(e){if(e.name!=='ResourceNotFoundException'||cloud)throw e;await client.send(new CreateTableCommand({TableName:table,KeySchema:[{AttributeName:'pk',KeyType:'HASH'},{AttributeName:'sk',KeyType:'RANGE'}],AttributeDefinitions:[{AttributeName:'pk',AttributeType:'S'},{AttributeName:'sk',AttributeType:'S'}],BillingMode:'PAY_PER_REQUEST'}));await waitUntilTableExists({client,maxWaitTime:20,minDelay:1,maxDelay:2},{TableName:table});}
 const doc=DynamoDBDocumentClient.from(client,{marshallOptions:{removeUndefinedValues:true}}),key=(kind,id)=>({pk:kind,sk:String(id)});
 async function raw(kind,id){return (await doc.send(new GetCommand({TableName:table,Key:key(kind,id),ConsistentRead:true}))).Item;}
 async function get(kind,id){return (await raw(kind,id))?.data||null;}
 async function list(kind){const result=[];let cursor;do{const page=await doc.send(new QueryCommand({TableName:table,KeyConditionExpression:'pk = :k',ExpressionAttributeValues:{':k':kind},ConsistentRead:true,ExclusiveStartKey:cursor}));result.push(...(page.Items||[]).map(x=>x.data));cursor=page.LastEvaluatedKey;if(result.length>20000)throw Error('Collection too large; use paginated reporting');}while(cursor);return result;}
 async function transaction(fn){const reads=new Map(),writes=new Map();const ident=(k,id)=>JSON.stringify([k,String(id)]);const tx={async get(k,id){const name=ident(k,id);if(writes.has(name))return structuredClone(writes.get(name).data);if(!reads.has(name))reads.set(name,{key:key(k,id),row:await raw(k,id)});return structuredClone(reads.get(name).row?.data||null);},async put(k,id,data){await tx.get(k,id);writes.set(ident(k,id),{key:key(k,id),data:structuredClone(data)});},async remove(k,id){await tx.get(k,id);writes.set(ident(k,id),{key:key(k,id),data:null});}};
 const output=await fn(tx);if(!writes.size)return output;
 if(reads.size>100)throw Error('Transaction exceeds DynamoDB item limit');
 const ops=[...reads].map(([name,{key:k,row}])=>{const common={TableName:table,ConditionExpression:row?'#v = :v':'attribute_not_exists(pk)',...(row?{ExpressionAttributeNames:{'#v':'version'},ExpressionAttributeValues:{':v':row.version}}:{})};const w=writes.get(name);if(!w)return {ConditionCheck:{...common,Key:k}};return w.data===null?{Delete:{...common,Key:k}}:{Put:{...common,Item:{...k,version:(row?.version||0)+1,data:w.data}}};});
 try{await doc.send(new TransactWriteCommand({TransactItems:ops}));}catch(e){if(['TransactionCanceledException','TransactionConflictException'].includes(e.name))throw Object.assign(Error('Concurrent change; refresh and retry'),{status:409});throw e;}return output;}
 const put=(k,id,data)=>transaction(tx=>tx.put(k,id,data));
 return {get,list,transaction,put,remove:(k,id)=>transaction(tx=>tx.remove(k,id)),close:()=>client.destroy(),table};
}
