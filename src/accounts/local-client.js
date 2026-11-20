// Same-origin transport. No credentials, session tokens or database access in browser storage.
async function request(path,body,method='POST'){
 try{const response=await fetch('/api'+path,{method,credentials:'same-origin',headers:body instanceof Blob?{'Content-Type':body.type}:body?{'Content-Type':'application/json'}:{},...(body?{body:body instanceof Blob?body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok)return {data:null,error:{message:value.error||'Request failed',code:value.code}};return {data:value.data??value,error:null};}catch{return {data:null,error:{message:'Local server unavailable'}};}
}
export function createClient(){
 const listeners=new Set();
 const auth={
  onAuthStateChange(fn){listeners.add(fn);return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}};},
  getUser:()=>request('/auth/me',null,'GET'),
  async getSession(){const r=await auth.getUser();return {data:{session:r.data?.user?{user:r.data.user}:null},error:r.error};},
  signUp:({email,password,options})=>request('/auth/signup',{email,password,name:options.data.display_name}),
  verifyRegistrationCode:body=>request('/auth/verify-code',body),
  resendRegistrationCode:email=>request('/auth/resend-code',{email}),
  signInWithPassword:body=>request('/auth/login',body),
  async signOut(){const r=await request('/auth/logout',{});if(!r.error)listeners.forEach(fn=>fn('SIGNED_OUT'));return r;},
  resetPasswordForEmail:email=>request('/auth/reset',{email}),
  async updateUser({password}){const token=new URLSearchParams(location.search).get('token');const r=await request('/auth/password',{password,token});if(!r.error)history.replaceState({},'',location.pathname);return r;},
  mfa:{getAuthenticatorAssuranceLevel:()=>request('/mfa/level',{}),listFactors:()=>request('/mfa/list',{}),enroll:()=>request('/mfa/enroll',{}),unenroll:body=>request('/mfa/unenroll',body),challengeAndVerify:body=>request('/mfa/verify',body)}
 };
 function from(table){const query={table,action:'select',filters:{}};const chain={select:()=>chain,eq:(k,v)=>{query.filters[k]=v;return chain;},order:()=>chain,single:()=>{query.single=true;return chain;},then:(resolve,reject)=>request('/query',query).then(resolve,reject)};for(const action of ['insert','update','upsert','delete'])chain[action]=values=>{query.action=action;query.values=values;return chain;};return chain;}
 return {auth,from,rpc:(name,args={})=>request('/rpc',{name,args}),storage:{from:()=>({upload:(path,blob)=>request('/avatar',blob,'PUT'),remove:()=>request('/avatar',{},'DELETE'),createSignedUrl:async()=>({data:{signedUrl:'/api/avatar?v='+Date.now()},error:null})})}};
}
