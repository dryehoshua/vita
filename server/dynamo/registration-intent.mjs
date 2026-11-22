import {randomUUID} from 'node:crypto';

const accountTypes=new Set(['visitor','business','guide','writer']);
const businessTypes=new Set(['bar','restaurant','cafe','stay','wellness','store','other']);
const invalid=()=>Object.assign(new Error('Invalid account type'),{status:400});

export function registrationIntent(input){
 if(input===undefined)return null;
 if(!input||!accountTypes.has(input.type))throw invalid();
 if(input.type!=='business')return {type:input.type};
 const name=typeof input.businessName==='string'?input.businessName.trim():'';
 if(!businessTypes.has(input.businessType)||!name||name.length>120)throw invalid();
 return {type:'business',businessType:input.businessType,businessName:name};
}

export async function requestRegistrationAccess(tx,user,intent){
 if(!intent||intent.type==='visitor')return false;
 const key=user.id+':'+intent.type;
 if(await tx.get('Pending',key))return true;
 const profile=await tx.get('Profiles',user.id);
 const id=randomUUID();
 const request={id,user_id:user.id,kind:intent.type,name:intent.businessName||profile.display_name,
  status:'pending',created_at:new Date().toISOString()};
 if(intent.businessType)request.business_type=intent.businessType;
 await tx.put('Pending',key,{id});
 await tx.put('Requests',id,request);
 return true;
}
