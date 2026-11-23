import {avatarPreview,avatarAccept,encodeAvatar,photoFeedback,saveAvatar} from './avatar.js';
import {createClient} from './local-client.js';
import {safePath,escapeHTML as esc,validConfig,totals,spaces} from './core.js';
// Loaded at runtime so deployment configuration never requires rebuilding vendor code.
const {accountConfig:config={}}=await import('/account-config.js').catch(()=>({}));
const $=s=>document.querySelector(s),app=$('#account-app');
let lang='es';try{lang=sessionStorage.getItem('lavita-language')==='en'?'en':'es';}catch{}
const t=(es,en)=>lang==='en'?en:es;
const client=validConfig(config)?createClient():null;
let verificationEmail='',verificationPassword='',chosenRegistration=null;
let user=null,profile=null,roles=[],members=[],view='login',recovery=false,activeFactor=null;
const labels={admin:['Administrador','Administrator'],editor:['Editor','Editor'],writer:['Escritora / autor','Writer'],guide:['Guía turístico','Tour guide'],owner:['Mi negocio','My business'],staff:['Equipo humano','Team'],tourist:['Soy turista','I’m visiting'],cdmx:['Vivo en CDMX','I live in Mexico City'],'roma-condesa':['Vivo en Roma–Condesa','I live in Roma–Condesa'],unspecified:['Prefiero indicarlo después','I’ll choose later'],business:['Negocio','Business'],pending:['Pendiente','Pending'],approved:['Aprobado','Approved'],rejected:['No aprobado','Not approved']};
const registrationTypes={
 visitor:['Visitante','Visitor'],business:['Negocio','Business'],guide:['Guía turístico','Tour guide'],writer:['Periodista de Socialité','Socialité journalist'],
};
const businessTypes={
 bar:['Bar','Bar'],restaurant:['Restaurante','Restaurant'],cafe:['Cafetería','Café'],stay:['Hotel, hostal o alojamiento','Hotel, hostel or stay'],
 wellness:['Spa o bienestar','Spa or wellness'],store:['Tienda','Shop'],other:['Otro','Other'],
};
const label=k=>labels[k]?t(...labels[k]):k;
const requestLabel=r=>[label(r.kind),businessTypes[r.business_type]&&t(...businessTypes[r.business_type])].filter(Boolean).join(' · ');
const button=(txt,action,extra='')=>`<button type="button" data-action="${action}" ${extra}>${txt}</button>`;
const input=(name,title,type='text',extra='')=>`<label>${title}<input name="${name}" type="${type}" ${extra}></label>`;
function say(es,en,error=false){$('#notice').textContent=t(es,en);$('#notice').classList.toggle('error',error);}
function check(result){if(result.error)throw result.error;return result.data;}
function message(error){const code=error?.code;const msg=String(error?.message||'');if(code==='23505')say('Ya existe una solicitud pendiente o un favorito guardado.','A pending request or saved favorite already exists.',true);else if(msg.includes('Invalid login'))say('Correo o contraseña incorrectos.','Incorrect email or password.',true);else if(msg.includes('Invalid or expired verification code'))say('El código no coincide o venció. Puedes pedir otro.','The code is incorrect or expired. You can request another.',true);else if(msg.includes('Email not confirmed'))say('Confirma tu correo antes de entrar.','Confirm your email before signing in.',true);else if(msg.includes('Verified account required'))say('El integrante necesita crear y verificar su cuenta primero.','The team member must create and verify their account first.',true);else say('No se pudo completar. Revisa tu conexión y vuelve a intentar.','Could not complete. Check your connection and try again.',true);}
function registrationSelect(name,title,options){
 return `<label>${title}<select name="${name}" required><option value="">${t('Selecciona una opción','Choose an option')}</option>${Object.entries(options).map(([value,words])=>`<option value="${value}">${t(...words)}</option>`).join('')}</select></label>`;
}
function registrationPicker(){
 return registrationSelect('registration_type',t('Tipo de usuario','Account type'),registrationTypes);
}
function authView(){
 const signup=view==='signup',reset=view==='reset',verify=view==='verify';
 const canRegister=Boolean(client)&&config.registrationEnabled!==false;
 const registrationTab=signup||verify;
 const unavailable=signup&&!canRegister;
 const mailLink=config.localMailbox?`<a href="/dev/mail" target="_blank" rel="noreferrer">${t('Abrir buzón de pruebas','Open test mailbox')}</a>`:'';
 const title=recovery?t('Nueva contraseña','New password'):signup?t('Crea tu cuenta','Create your account'):verify?t('Verifica tu correo','Verify your email'):reset?t('Recuperar acceso','Recover access'):t('Qué gusto verte','Welcome back');
 const info=verify&&!config.localMailbox?t('Revisa tu correo e introduce los 6 dígitos. El código vence en 10 minutos.','Check your email and enter the 6-digit code. It expires in 10 minutes.'):verify?t('Escribe los 6 dígitos. El código vence en 10 minutos.','Enter the 6 digits. The code expires in 10 minutes.'):signup&&config.localMailbox?t('Al verificar tu cuenta puedes reclamar 10 puntos de bienvenida en el programa de prueba.','Verify your account to claim 10 welcome points in the test program.'):t('Guarda tus lugares y lleva tu cuenta contigo.','Save your places and keep your account with you.');
 const action=verify?t('Verificar código','Verify code'):signup?t('Crear cuenta','Sign up'):reset?t('Enviar enlace','Send link'):recovery?t('Guardar contraseña','Save password'):t('Entrar','Sign in');
 app.innerHTML=`<section class="panel auth">
 ${!recovery?`<nav class="auth-switch" aria-label="${t('Acceso a La Vita','La Vita account')}">
 ${button(t('Regístrate','Sign up'),'signup',registrationTab?'aria-current="page"':'')}
 ${button('Login','login',!registrationTab&&!reset?'aria-current="page"':'')}
 </nav>`:''}
 <h1>${title}</h1><p class="muted">${unavailable?t('El registro en línea aún no está disponible.','Online registration isn’t available yet.'):info}</p>
 ${!client?`<p class="badge">${t('Servidor local no conectado','Local server not connected')}</p>`:''}
 ${unavailable?registrationPicker():`<form id="auth-form"><fieldset ${!client?'disabled':''}>
 ${signup?`${registrationPicker()}<div id="registration-business" hidden><fieldset disabled>
 ${registrationSelect('business_type',t('Tipo de negocio','Business type'),businessTypes)}
 ${input('business_name',t('Nombre del negocio','Business name'),'text','required maxlength="120" autocomplete="organization"')}
 </fieldset></div><p id="registration-role-note" class="muted" hidden>${t('Te pediremos verificar tu correo antes de enviar la solicitud de acceso.','We’ll verify your email before sending your access request.')}</p>`:''}
 ${signup?input('name',t('Nombre','Name'),'text','required maxlength="60" autocomplete="given-name"'):''}
 ${!recovery?input('email',t('Correo','Email'),'email','required autocomplete="email" maxlength="254" value="'+esc(verificationEmail)+'"'):''}
 ${verify?input('code',t('Código de verificación','Verification code'),'text','required inputmode="numeric" autocomplete="one-time-code" minlength="6" maxlength="6" pattern="[0-9]{6}"'):''}
 ${!reset&&!verify?input('password',t('Contraseña','Password'),'password','required '+(signup||recovery?'minlength="12" autocomplete="new-password"':'autocomplete="current-password"')):''}
 ${signup||recovery?`<small>${t('Mínimo 12 caracteres.','At least 12 characters.')}</small>`:''}
 <button class="primary">${action}</button></fieldset></form>`}
 ${verify?`<p>${mailLink}</p>${button(t('Reenviar código','Resend code'),'resend-otp')} ${button(t('Volver a entrar','Back to sign in'),'login')}`:''}
 ${view==='login'&&!recovery&&canRegister?`<div class="auth-alternatives">${button(t('Olvidé mi contraseña','Forgot password'),'reset')}</div>`:''}
 ${reset&&mailLink?`<p>${mailLink}</p>`:''}</section>`;
 const authForm=$('#auth-form');
 if(!authForm)return;
 if(signup){
  const pick=authForm.elements.registration_type;
  pick.onchange=()=>{
   const isBusiness=pick.value==='business';
   $('#registration-business').hidden=!isBusiness;
   $('#registration-business fieldset').disabled=!isBusiness;
   $('#registration-role-note').hidden=!pick.value||pick.value==='visitor';
  };
 }
 authForm.onsubmit=e=>run(e,async()=>{
  const f=new FormData(e.target),email=String(f.get('email')||'').trim(),password=String(f.get('password')||'');
  if(recovery){check(await client.auth.updateUser({password}));recovery=false;await load();say('Contraseña actualizada.','Password updated.');}
  else if(reset){check(await client.auth.resetPasswordForEmail(email,{redirectTo:config.siteUrl+'/cuenta?flow=recovery'}));say(config.localMailbox?'Revisa el buzón de pruebas para recuperar el acceso.':'Revisa tu correo si la cuenta existe.',config.localMailbox?'Check the test mailbox to recover access.':'Check your email if the account exists.');}
  else if(signup){
   const type=f.get('registration_type');
   const registration={type,...(type==='business'?{businessType:f.get('business_type'),businessName:String(f.get('business_name')).trim()}:{} )};
   check(await client.auth.signUp({email,password,options:{data:{display_name:String(f.get('name')).trim(),registration}}}));
   verificationEmail=email;verificationPassword=password;chosenRegistration=registration;view='verify';authView();
  }
  else if(verify){
   const chosen=verificationPassword;
   const verified=check(await client.auth.verifyRegistrationCode({email,code:String(f.get('code')).trim(),password:chosen,...(chosenRegistration?{registration:chosenRegistration}:{})}));
   verificationPassword='';chosenRegistration=null;
   verificationEmail=email;view='login';
   const login=await client.auth.signInWithPassword({email,password:chosen});
   if(!login.error)location.assign(verified.pending?'/cuenta?solicitud=1':'/perfil');
   else {authView();say('Correo verificado. Entra para reclamar tu bienvenida.','Email verified. Sign in to claim your welcome offer.');}
  }else{
   const result=await client.auth.signInWithPassword({email,password});
   if(result.error?.message==='Email not confirmed'&&config.registrationEnabled!==false){
    verificationEmail=email;verificationPassword=password;view='verify';authView();return;
   }
   check(result);await load();
   if(user&&!roles.some(r=>r.role)&&!members.some(m=>m.active)&&(!location.search||new URLSearchParams(location.search).get('view')==='registro'))location.assign('/perfil');
  }
 });

}
async function run(event,fn){event?.preventDefault();const form=event?.target?.closest('form'),buttons=form?.querySelectorAll('button');buttons?.forEach(b=>b.disabled=true);try{await fn();}catch(e){message(e);}finally{buttons?.forEach(b=>b.disabled=false);}}
async function load(){
 if(!client){authView();return;}
 user=check(await client.auth.getUser()).user;
 if(!user){authView();return;}
 [profile,roles,members]=await Promise.all([client.from('profiles').select('*').eq('id',user.id).single().then(check),client.from('global_roles').select('role').then(check),client.from('memberships').select('organization_id,role,active,organizations(name)').eq('user_id',user.id).then(check)]);
 if(recovery){authView();return;}
 const route=new URLSearchParams(location.search);
 if(profile.onboarded===false&&!roles.length&&!members.some(m=>m.active)&&(!location.search||route.get('view')==='registro')){
  location.replace('/perfil');return;
 }
 await dashboard();
 if(new URLSearchParams(location.search).get('solicitud')==='1')say('Tu solicitud de acceso está en revisión.','Your access request is under review.');
 if(new URLSearchParams(location.search).get('view')==='analytics'&&roles.some(r=>r.role==='admin')){await adminPanel();$('#admin-panel').scrollIntoView();}
}
async function dashboard(){
 const [favorites,entries,requests]=await Promise.all([client.from('favorites').select('*').order('created_at',{ascending:false}).then(check),client.from('point_entries').select('program,delta,created_at,reason').then(check),client.from('access_requests').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).then(check)]);
 const access=spaces(roles,members);
 app.innerHTML=`<div class="row spread"><h1>${t('Mi cuenta','My account')}</h1><a class="button" href="/perfil">${t('Mi perfil y recompensas','My profile & rewards')}</a><a class="button" href="/panel">${t('Mis espacios y QR','My workspaces & QR')}</a>${button(t('Cerrar sesión','Sign out'),'logout')}</div><div class="tabs">${access.map(r=>`<span class="badge">${esc(label(r))}</span>`).join('')}</div><div class="grid"><section class="panel"><h2>${t('Mi perfil','My profile')}</h2><div class="row"><img class="avatar" id="avatar" src="/assets/la-vita-logo-512.png" alt="${t('Foto de perfil','Profile photo')}"><span>${esc(user.email)}</span></div><form id="profile-form">${input('name',t('Nombre','Name'),'text',`required maxlength="60" value="${esc(profile.display_name)}"`)}<label>${t('¿Desde dónde nos visitas?','Where are you joining us from?')}<select name="residence">${['unspecified','tourist','cdmx','roma-condesa'].map(v=>`<option value="${v}" ${profile.residence===v?'selected':''}>${label(v)}</option>`).join('')}</select></label><button class="primary">${t('Guardar','Save')}</button></form><form id="avatar-form">${input('photo',t('Cambiar foto','Change photo'),'file',`accept="${avatarAccept}"`)}<p id="avatar-status" class="photo-feedback" role="status"></p><p id="avatar-error" class="photo-feedback error" role="alert"></p><button type="submit" disabled>${t('Guardar foto','Save photo')}</button>${button(t('Quitar foto','Remove photo'),'remove-avatar')}</form></section><section class="panel"><h2>${t('Mis puntos','My points')}</h2>${Object.keys(totals(entries)).length?Object.entries(totals(entries)).map(([k,v])=>`<p>${esc(k)} <b>${v} pts</b></p>`).join(''):`<p class="metric">0 <small>pts</small></p>`}<p>${t('Los puntos reales se activarán con los programas de cada negocio. Los puntos demo no se transfieren.','Real points will activate with each business’s program. Demo points do not transfer.')}</p><a class="button" href="/perfil">${t('Mi perfil y recompensas','My profile & rewards')}</a><a class="button" href="/panel">${t('Mi QR y recompensas','My QR & rewards')}</a><h2 style="margin-top:24px">${t('Guardados','Saved places')}</h2>${favorites.length?favorites.map(f=>`<div class="item row spread"><a href="${esc(safePath(f.path))}">${esc(f.title)}</a>${button(t('Quitar','Remove'),'remove-favorite',`data-path="${esc(f.path)}"`)}</div>`).join(''):`<p>${t('Aún no guardas lugares.','No saved places yet.')}</p>`}<a href="/lugares/la-galleteria">La Galletería ↗</a></section></div><section class="panel"><h2>${t('Participa en La Vita','Join La Vita')}</h2><p>${t('Tu cuenta es la misma. Solicita un espacio de trabajo; nuestro equipo revisa cada solicitud.','Keep the same account. Request a workspace; our team reviews every request.')}</p><form id="request-form"><label>${t('Quiero participar como','I want to join as')}<select name="kind">${['business','guide','writer'].map(v=>`<option value="${v}">${label(v)}</option>`).join('')}</select></label>${input('name',t('Nombre del negocio o nombre profesional','Business or professional name'),'text','required maxlength="120"')}<button>${t('Enviar solicitud','Submit request')}</button></form>${requests.map(r=>`<p>${esc(requestLabel(r))} · ${esc(r.name)} <span class="badge">${label(r.status)}</span></p>`).join('')}</section>${members.filter(m=>m.active&&m.role==='owner').map(m=>`<section class="panel"><h2>${esc(m.organizations?.name||label('owner'))} · ${t('Equipo humano','Team')}</h2><p>${t('Añade una cuenta con correo verificado. El equipo no puede cambiar propietarios ni permisos.','Add an account with verified email. Team members cannot change owners or permissions.')}</p><form class="team-form" data-org="${m.organization_id}">${input('email',t('Correo del integrante','Team member email'),'email','required')}<label>${t('Acceso','Access')}<select name="enabled"><option value="true">${t('Dar acceso de equipo','Enable team access')}</option><option value="false">${t('Suspender acceso de equipo','Suspend team access')}</option></select></label><button>${t('Actualizar equipo','Update team')}</button></form></section>`).join('')}${access.some(r=>['guide','writer','editor','staff'].includes(r))?`<section class="panel"><h2>${t('Mis espacios','My workspaces')}</h2><p>${t('Tu acceso está registrado. Abre Mis espacios para gestionar contenido y operaciones según tus permisos.','Your access is registered. Open My workspaces to manage content and operations according to your permissions.')}</p></section>`:''}${access.includes('admin')?`<section class="panel"><h2>${t('Administración','Administration')}</h2>${button(t('Abrir analítica y solicitudes','Open analytics and requests'),'admin')}<div id="admin-panel"></div></section>`:''}`;
 $('#profile-form').onsubmit=e=>run(e,async()=>{const f=new FormData(e.target);check(await client.from('profiles').update({display_name:String(f.get('name')).trim(),residence:f.get('residence'),language:lang}).eq('id',user.id));say('Perfil guardado.','Profile saved.');});
 $('#request-form').onsubmit=e=>run(e,async()=>{const f=new FormData(e.target);check(await client.from('access_requests').insert({user_id:user.id,kind:f.get('kind'),name:String(f.get('name')).trim()}));await load();say('Solicitud enviada a revisión.','Request sent for review.');});
 document.querySelectorAll('.team-form').forEach(form=>form.onsubmit=e=>run(e,async()=>{const f=new FormData(form);check(await client.rpc('set_team_member',{org:form.dataset.org,member_email:f.get('email'),enabled:f.get('enabled')==='true'}));say('Acceso del equipo actualizado.','Team access updated.');}));
 const avatar=$('#avatar');
 if(profile.avatar_path){const signed=check(await client.storage.from('avatars').createSignedUrl(profile.avatar_path,300));avatar.src=signed.signedUrl;}
 bindAvatarForm($('#avatar-form'),avatar,user.id);
 const params=new URLSearchParams(location.search),save=params.get('save');if(save){history.replaceState({},'',location.pathname);const path=safePath(save);if(path!=='/'){check(await client.from('favorites').upsert({user_id:user.id,path,title:(params.get('title')||path).slice(0,150)},{onConflict:'user_id,path',ignoreDuplicates:true}));await dashboard();}}
}
function bindAvatarForm(form,avatar,userId){
 const picker=form.elements.photo,submit=form.querySelector('[type=submit]');
 const remove=form.querySelector('[data-action=remove-avatar]');
 const status=form.querySelector('#avatar-status'),error=form.querySelector('#avatar-error');
 let pendingPhoto, savedSrc=avatar.src;
 const lock=busy=>{picker.disabled=remove.disabled=busy;submit.disabled=busy||!pendingPhoto;};
 const show=(state,problem)=>{status.textContent=state?t(...photoFeedback[state]):'';error.textContent=problem?t(...photoFeedback[problem]):'';};
 picker.onchange=async()=>{
  const file=picker.files?.[0];
  if(!file)return;
  picker.value='';
  pendingPhoto=undefined;
  avatar.src=savedSrc;
  show('preparing');lock(true);
  try{
   const photo=await encodeAvatar(file);
   avatar.src=await avatarPreview(photo);
   pendingPhoto=photo;
   show('ready');
  }catch{show(null,'readError');}
  finally{lock(false);}
 };
 form.onsubmit=async e=>{
  e.preventDefault();
  if(!pendingPhoto||submit.disabled)return;
  show('uploading');lock(true);
  try{
   await saveAvatar(client,userId,pendingPhoto);
   pendingPhoto=undefined;
   savedSrc='/api/avatar?v='+Date.now();
   show('saved');
  }catch{show(null,'uploadError');}
  finally{lock(false);}
 };
}
async function adminPanel(){
 const box=$('#admin-panel');const assurance=check(await client.auth.mfa.getAuthenticatorAssuranceLevel());
 if(assurance.currentLevel!=='aal2'){
  const factors=check(await client.auth.mfa.listFactors());activeFactor=factors.totp.find(f=>f.status==='verified')?.id||null;
  box.innerHTML=`<p>${t('Confirma con tu aplicación de autenticación para continuar.','Confirm with your authenticator app to continue.')}</p>${!activeFactor?button(t('Configurar autenticador','Set up authenticator'),'enroll'):''}<div id="mfa-setup"></div><form id="mfa-form">${input('code',t('Código de 6 dígitos','6-digit code'),'text','required pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code"')}<button>${t('Verificar','Verify')}</button></form>`;
  $('#mfa-form').onsubmit=e=>run(e,async()=>{if(!activeFactor)throw Error('Enroll required');check(await client.auth.mfa.challengeAndVerify({factorId:activeFactor,code:new FormData(e.target).get('code')}));await adminPanel();});return;
 }
 const [metrics,requests]=await Promise.all([client.rpc('account_metrics').then(check),client.from('access_requests').select('*').eq('status','pending').order('created_at').then(check)]);
 box.innerHTML=`<div class="grid"><div><p class="metric">${metrics.pageViews||0}</p><p>${t('Cargas de página','Page views')}</p></div><div><p class="metric">${metrics.accounts}</p><p>${t('Cuentas verificadas','Verified accounts')}</p></div><div><p class="metric">${metrics.pending}</p><p>${t('Solicitudes pendientes','Pending requests')}</p></div></div><h3>${t('Usuarios por rol','Users by role')}</h3><p>${t('Una persona puede tener varios roles.','One person can have several roles.')}</p>${Object.entries(metrics.roles).map(([k,v])=>`<p>${esc(label(k))}: <b>${v}</b></p>`).join('')||`<p>${t('Sin roles adicionales.','No additional roles.')}</p>`}<h3>${t('Preferencias declaradas','Declared preferences')}</h3>${Object.entries(metrics.residence).map(([k,v])=>`<p>${esc(label(k))}: ${v}</p>`).join('')}<h3>${t('Visitas','Visits')}</h3><p>${t(`${metrics.pageViews ?? 0} páginas vistas en este servidor local. Incluye recargas y pruebas; no son visitantes únicos.`,`${metrics.pageViews ?? 0} page views on this local server. Includes reloads and tests; not unique visitors.`)}</p><h3>${t('Solicitudes','Requests')}</h3>${requests.map(r=>`<div class="item"><b>${esc(r.name)}</b> · ${esc(requestLabel(r))}<div class="row">${button(t('Aprobar','Approve'),'approve',`data-id="${r.id}"`)}${button(t('Rechazar','Reject'),'reject',`data-id="${r.id}"`)}</div></div>`).join('')||`<p>${t('Todo al día.','You’re up to date.')}</p>`}<small>${t('Actualizado','Updated')}: ${esc(new Date(metrics.generated_at).toLocaleString(lang))}</small>`;
 const accountsResponse=await fetch('/api/admin/accounts');
 if(accountsResponse.ok){
  const {data:accounts}=await accountsResponse.json();
  const list=document.createElement('section');
  list.innerHTML=`<h3>${t('Gestionar cuentas','Manage accounts')}</h3>`+accounts.filter(a=>a.id!==user.id).map(account=>`<form class="row status-form" data-id="${esc(account.id)}" data-status="${account.status==='active'?'suspended':'active'}"><span>${esc(account.email)}</span><input name="reason" required maxlength="400" aria-label="${t('Motivo','Reason')}" placeholder="${t('Motivo','Reason')}"><button>${account.status==='active'?t('Suspender','Suspend'):t('Reactivar','Reactivate')}</button></form>`).join('');
  box.append(list);
  list.querySelectorAll('form').forEach(form=>form.onsubmit=e=>run(e,async()=>{
   const response=await fetch('/api/admin/accounts/'+encodeURIComponent(form.dataset.id)+'/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:form.dataset.status,reason:new FormData(form).get('reason')})});
   if(!response.ok)throw Error('Could not change account status');
   await adminPanel();
  }));
 }

}
app.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;run(null,async()=>{b.disabled=true;try{const a=b.dataset.action;
 if(['login','signup','reset'].includes(a)){verificationPassword='';chosenRegistration=null;view=a;say('','');authView();}
 if(a==='resend-otp'){
  const form=$('#auth-form'),email=form.elements.email.value.trim();
  if(!form.elements.email.reportValidity())return;
  check(await client.auth.resendRegistrationCode(email));
  verificationEmail=email;
  say(config.localMailbox?'Revisa el buzón. Puedes pedir un código por minuto.':'Si falta verificar la cuenta, revisa tu correo.',config.localMailbox?'Check the mailbox. You can request one code per minute.':'If your account needs verification, check your email.');
 }
 if(a==='logout'){check(await client.auth.signOut());user=null;view='login';authView();}
 if(a==='remove-favorite'){check(await client.from('favorites').delete().eq('path',b.dataset.path).eq('user_id',user.id));await dashboard();}
 if(a==='remove-avatar'){check(await client.storage.from('avatars').remove([user.id+'/avatar.webp']));check(await client.from('profiles').update({avatar_path:null}).eq('id',user.id));await load();}
 if(a==='admin')await adminPanel();
 if(a==='approve'||a==='reject'){check(await client.rpc('decide_request',{request_id:b.dataset.id,approve:a==='approve'}));await adminPanel();}
 if(a==='enroll'){const existing=check(await client.auth.mfa.listFactors());for(const factor of existing.all.filter(f=>f.factor_type==='totp'&&f.status==='unverified'))check(await client.auth.mfa.unenroll({factorId:factor.id}));const data=check(await client.auth.mfa.enroll({factorType:'totp',friendlyName:'La Vita',issuer:'La Vita Roma Condesa'}));activeFactor=data.id;$('#mfa-setup').innerHTML=`<p>${t('Añade esta clave a tu autenticador y escribe el código.','Add this key to your authenticator and enter the code.')}</p><code>${esc(data.totp.secret)}</code>`;}
 }finally{b.disabled=false;}});});
$('#account-language').value=lang;$('#account-language').onchange=async e=>{lang=e.target.value;try{sessionStorage.setItem('lavita-language',lang);}catch{}document.documentElement.lang=lang;$('#explore').textContent=t('Explorar','Explore');$('#notice').textContent='';try{if(user&&!recovery)await dashboard();else authView();}catch(e){message(e);}};
document.documentElement.lang=lang;$('#explore').textContent=t('Explorar','Explore');
if(client){
 client.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY'){recovery=true;authView();}if(event==='SIGNED_OUT'){user=null;authView();}});
 // Recovery callbacks can arrive before the listener; URL intention is not authorization.
 const accountParams=new URLSearchParams(location.search);
 recovery=accountParams.get('flow')==='recovery';
 if(accountParams.get('view')==='registro')view='signup';
 try{const session=check(await client.auth.getSession()).session;if(session)await load();else authView();}catch(e){authView();message(e);}
}else authView();
app.setAttribute('aria-busy','false');
