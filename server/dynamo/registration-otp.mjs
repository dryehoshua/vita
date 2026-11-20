import {randomInt,randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const cooldown=60_000;
const lifetime=10*60_000;
const maxFailures=5;
const invalid=()=>Object.assign(new Error('Invalid or expired verification code'),{status:400});

export function registrationOtp(store,directory){
 const path=join(directory,'registration-otp.key');
 let key;
 function sign(user,salt,code){
  if(!key){
   try{writeFileSync(path,randomBytes(32),{mode:0o600,flag:'wx'});}
   catch(error){if(error.code!=='EEXIST')throw error;}
   key=readFileSync(path);
  }
  return createHmac('sha256',key).update(user).update(salt).update(code).digest();
 }
 async function issue(userId){
  const code=String(randomInt(0,1000000)).padStart(6,'0');
  const now=Date.now(),salt=randomBytes(16).toString('hex');
  return store.transaction(async tx=>{
   const current=await tx.get('RegistrationCodes',userId);
   const user=await tx.get('Users',userId);
   if(!user||user.verified||user.status!=='active'||(current&&current.sentAt+cooldown>now))return null;
   await tx.put('RegistrationCodes',userId,{salt,hash:sign(userId,salt,code).toString('hex'),sentAt:now,expires:now+lifetime,failures:0});
   return code;
  });
 }
 async function verify(userId,code,passwordHash){
  if(!userId||typeof code!=='string'||!/^\d{6}$/.test(code))throw invalid();
  const verified=await store.transaction(async tx=>{
   const record=await tx.get('RegistrationCodes',userId);
   const user=await tx.get('Users',userId);
   if(!user||user.verified||user.status!=='active'||!record||record.expires<=Date.now()||record.failures>=maxFailures)return false;
   if(!timingSafeEqual(sign(userId,record.salt,code),Buffer.from(record.hash,'hex'))){
    await tx.put('RegistrationCodes',userId,{...record,failures:record.failures+1});return false;
   }
   await tx.put('Users',userId,{...user,password:passwordHash,verified:true});
   await tx.remove('RegistrationCodes',userId);
   return true;
  });
  if(!verified)throw invalid();
 }
 return {issue,verify};
}
