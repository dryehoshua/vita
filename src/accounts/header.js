import {validConfig,totals} from './core.js';
const {accountConfig:config}=await import('/account-config.js');
export const accountsEnabled=validConfig(config);
let member=null,failed=false;
const english=()=>document.documentElement.lang==='en';
export function refreshAccountHeader(){
 if(!accountsEnabled)return;
 const name=member?.name||(english()?'Sign in':'Entrar');
 const points=member?Object.entries(member.wallets).map(([k,v])=>`${v} pts · ${k}`).join(' / ')||'0 pts':failed?(english()?'Retry':'Reintentar'):(english()?'My account':'Mi cuenta');
 const n=document.querySelector('#profile-name'),p=document.querySelector('#profile-points'),b=document.querySelector('#profile-button'),a=b?.querySelector('.avatar'),shop=document.querySelector('#shop-profile');
 if(b?.tagName==='A'){
  const label=english()?'My profile':'Mi perfil';
  const entry=english()?'Sign in':'Iniciar sesión';
  const balances=Object.values(member?.wallets||{});
  b.href=member?'/perfil':'/cuenta';
  b.setAttribute('aria-label',member?label:`${label}: ${entry}`);
  if(n)n.textContent=label;
  if(p)p.textContent=member?(balances.length>1?(english()?'My points':'Mis puntos'):`${balances[0]||0} pts`):entry;
 }else{
  if(n)n.textContent=name;
  if(p)p.textContent=points;
  if(b)b.setAttribute('aria-label',english()?'Open my account':'Abrir mi cuenta');
 }
 if(a)a.textContent=member?.name?.slice(0,1).toUpperCase()||'♡';
 if(shop){shop.textContent='';const link=document.createElement('a');link.href=member?'/perfil':'/cuenta';link.textContent=name+' · '+points;shop.append(link);}
}
if(accountsEnabled){
 refreshAccountHeader();
 document.addEventListener('change',e=>{if(e.target.matches('#language,#shop-language'))queueMicrotask(refreshAccountHeader);});
 document.addEventListener('click',e=>{if(e.target.closest('button#profile-button,[data-demo]')){e.preventDefault();e.stopImmediatePropagation();location.assign(member&&e.target.closest('#profile-button')?'/perfil':'/cuenta');}if(e.target.closest('#save-shop')){e.preventDefault();e.stopImmediatePropagation();location.assign('/cuenta?save=%2Flugares%2Fla-galleteria&title=La%20Galleter%C3%ADa');}},true);
 void (async()=>{
 const {createClient}=await import('./local-client.js');
 const client=createClient();
 try{
  const {data:{session},error}=await client.auth.getSession();if(error)throw error;
  if(session){const {data,error:identityError}=await client.auth.getUser();if(identityError)throw identityError;
   const [profile,entries]=await Promise.all([client.from('profiles').select('display_name,onboarded').eq('id',data.user.id).single(),client.from('point_entries').select('program,delta')]);
   if(profile.error||entries.error)throw profile.error||entries.error;
   if(location.pathname==='/'&&profile.data.onboarded===false){location.replace('/perfil');return;}
   member={name:profile.data.display_name|| (english()?'My account':'Mi cuenta'),wallets:totals(entries.data)};
  }
 }catch{failed=true;}
 refreshAccountHeader();
 })();
}
