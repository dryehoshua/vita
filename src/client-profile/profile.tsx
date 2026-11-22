import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import QRCode from 'qrcode';
import {avatarTypes,encodeAvatar,saveAvatar} from '../accounts/avatar.js';
import {createClient} from '../accounts/local-client.js';
import {Brand,Icon,Progress,BadgeArt} from './art';
type Lang='es'|'en';
type Screen='profile'|'points'|'adventures'|'exclusive'|'qr';
type Reward={id:string,title:string,cost:number,stock:number};
type Program={id:string,name:string,balance:number,active:boolean,test:boolean,transferEnabled:boolean,rewards:Reward[]};
type Badge={kind:string,art?:string,group?:string,name:string,count:number,required:number,es:string,en:string,state:string,progress:number,categories?:number,requirements?:{kind:string,name:string,unlocked:boolean}[]};
type Offer={id:string,title:string,summary:string,venue:string,minGrade:string,eligible:boolean,endDay:string,photos?:{url:string}[],conditions?:string,website?:string};
type Data={
 profile:{id:string,name:string,avatar:string|null,residence:string,interests:string[],onboarded:boolean},
 programs:Program[],fee:number,activity:{id:string,date:string,delta:number,reason:string,type?:string,programId:string,program:string}[],
 welcome?:{points:number,programId:string,program:string,claimed:boolean},
 total:number,categories:number,grade:string,nextGrade:string|null,target:number,badges:Badge[],
 challenges:{id:string,es:string,en:string,count:number,target:number,complete:boolean,month:string,interests:string[]}[],offers:Offer[],missions?:Mission[],
};
type Mission={id:string,es:string,en:string,detailEs:string,detailEn:string,count:number,target:number,complete:boolean,active:boolean,startedAt:string|null,suggested:boolean};
type Receipt={amount:number,fee:number,balance:number,recipient:string,reference:string};
const grades:Record<string,[string,string]>={explorer:['Explorador','Explorer'],regular:['Rostro conocido','Local Favorite'],insider:['Insider','Insider'],legend:['Leyenda del barrio','Neighborhood Legend']};
const activities:Record<string,[string,string]>={food:['Comida','Food'],coffee:['Café','Coffee'],music:['Música','Music'],art:['Arte y cultura','Art & culture'],nightlife:['Vida nocturna','Nightlife'],walks:['Paseos','Walks'],wellness:['Bienestar','Wellness']};
const visits:Record<string,[string,string]>={tourist:['Estoy de visita','I’m visiting'],cdmx:['Vivo en CDMX','I live in Mexico City'],'roma-condesa':['Vivo en Roma-Condesa','I live in Roma-Condesa'],unspecified:['Prefiero no decir','Prefer not to say']};
const medalGroups:Record<string,[string,string]>={
 all:['Todas las colecciones','All collections'],exclusive:['Combinaciones exclusivas','Exclusive combos'],
 exploration:['Exploración','Exploration'],flavors:['Sabores','Flavors'],nightlife:['Vida nocturna','Nightlife'],
 culture:['Cultura','Culture'],variety:['Variedad','Variety'],
};
const signed=(n:number)=>(n>0?'+':'')+n;
const choice=(lang:Lang,pair:[string,string])=>pair[lang==='en'?1:0];
async function api(path:string,body?:unknown,method=body===undefined?'GET':'POST'){
 const r=await fetch(path,{method,cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!r.ok)throw Object.assign(new Error('Request failed'),{status:r.status});
 const parsed=await r.json();return parsed.data??parsed;
}
const initLang=():Lang=>sessionStorage.getItem('lavita-language')==='en'?'en':'es';
const alertCopy=(lang:Lang,error:{status?:number})=>error.status===409
 ? choice(lang,['El saldo o la operación cambió. Revisa tus datos e inténtalo de nuevo.','The balance or transaction changed. Review your details and retry.'])
 : choice(lang,['No se pudo completar. Revisa tu conexión.','Could not complete. Check your connection.']);
function App(){
 const [lang,setLang]=useState<Lang>(initLang);
 const [state,setState]=useState<Data>();
 const [error,setError]=useState<number>();
 const [screen,setScreen]=useState<Screen>('profile');
 const [programId,setProgramId]=useState('');
 const [onboarding,setOnboarding]=useState(false);
 const [transfer,setTransfer]=useState(false);
 const [badge,setBadge]=useState<Badge>();
 const [medalGroup,setMedalGroup]=useState('all');
 const [earnedOnly,setEarnedOnly]=useState(false);
 const [claiming,setClaiming]=useState(false);
 const [welcomeNotice,setWelcomeNotice]=useState('');
 const [offer,setOffer]=useState<Offer>();
 const t=(es:string,en:string)=>choice(lang,[es,en]);
 async function refresh(){const data:Data=await api('/api/client/profile');setState(data);setError(undefined);return data;}
 function open(){refresh().catch(e=>setError(e.status||503));}
 useEffect(open,[]);
 useEffect(()=>{document.documentElement.lang=lang;sessionStorage.setItem('lavita-language',lang);},[lang]);
 function go(next:Screen){setScreen(next);setTransfer(false);window.scrollTo({top:0});}
 const program=state?.programs.find(p=>p.id===programId)||state?.programs.find(p=>p.active)||state?.programs[0];
 const grade=(key:string)=>choice(lang,grades[key]||grades.explorer);
 const header=(back?:()=>void)=><header className="topbar">{back?<button className="icon-btn" aria-label={t('Volver','Back')} onClick={back}><Icon name="arrow"/></button>:<a href="/" aria-label={t('Explorar La Vita','Explore La Vita')}><Brand/></a>}<div className="profile-header-actions"><a href="/cuenta" aria-label={t('Ajustes de cuenta','Account settings')}>⚙</a><button className="language" onClick={()=>setLang(lang==='es'?'en':'es')}>{lang.toUpperCase()} <span>/ {lang==='es'?'EN':'ES'}</span></button></div></header>;
 if(!state)return <div className="app-shell"><main className="page">{header()}<h1>{t('Mi perfil','My profile')}</h1>{error===401?<a className="btn primary" href="/cuenta">{t('Iniciar sesión','Sign in')}</a>:error?<><p role="alert">{t('El perfil no está disponible.','Your profile is unavailable.')}</p><button className="btn primary" onClick={open}>{t('Reintentar','Retry')}</button></>:<p role="status">{t('Cargando…','Loading…')}</p>}</main></div>;
 const unlocked=state.badges.filter(b=>b.state==='unlocked');
 const visibleBadges=state.badges.filter(b=>(medalGroup==='all'||b.group===medalGroup)&&(!earnedOnly||b.state==='unlocked'));
 const featured=state.offers.find(o=>o.eligible)||state.offers[0];
 const next=state.badges.filter(x=>x.state!=='unlocked').sort((a,b)=>b.progress-a.progress)[0];
 const gradeText=state.nextGrade
  ? state.total>=state.target?t('Explora más categorías para subir de grado.','Explore more categories to rank up.')
  :t(`${state.target-state.total} lugares para llegar a ${grade(state.nextGrade)}`,`${state.target-state.total} places to reach ${grade(state.nextGrade)}`)
  :t('Has alcanzado el grado más alto.','You reached the highest rank.');
 const gradePill=<span className="grade-pill"><span className="grade-dot"/>{grade(state.grade)}</span>;
 const selectProgram=<select aria-label={t('Programa activo','Active program')} value={program?.id||''} onChange={e=>{setProgramId(e.target.value);setTransfer(false);}}>{!program&&<option value="">{t('Sin programas activos','No active programs')}</option>}{state.programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>;
 if(screen==='qr'&&program?.active)return <div className="app-shell"><main className="qr-screen">{header(()=>go('profile'))}<Pass program={program} lang={lang} refresh={refresh}/></main></div>;
 return <div className="app-shell"><main className="page">{header()}
 {screen==='profile'&&<>
  <section className="profile-identity">{state.profile.avatar?<img alt="" src={state.profile.avatar}/>:<span className="profile-initial">{Array.from(state.profile.name)[0]?.toUpperCase()}</span>}<div className="identity-copy"><strong>{t('Hola','Hi')}, {state.profile.name}</strong>{gradePill}<span className="next-grade">{gradeText}</span></div><div className="mini-progress">{state.total}<span>/{state.target}</span></div></section>
  <section className="balance-card"><div className="balance-top"><div><span className="eyebrow light">{t('Saldo disponible','Available balance')}</span><strong className="balance-number">{program?.balance||0} <small>pts</small></strong></div><div className="seal">LV</div></div><div className="program-select">{selectProgram}</div></section>
  <button className="btn primary qr-cta" disabled={!program?.active} onClick={()=>go('qr')}><Icon name="qr"/>{t('Mostrar QR','Show QR')}<Icon name="arrow"/></button>
  <div className="split-actions"><button className="btn secondary" disabled={!program?.transferEnabled} onClick={()=>{go('points');setTransfer(true);}}><Icon name="swap"/>{t('Transferir puntos','Transfer points')}</button><button className="btn secondary" onClick={()=>go('points')}><Icon name="receipt"/>{t('Movimientos','Activity')}</button></div>
  {state.welcome&&!state.welcome.claimed&&<section className="module welcome-offer">
   <div><span className="eyebrow">{t('Promoción de bienvenida','Welcome offer')}</span><h2>{state.welcome.points} pts {t('de regalo','on us')}</h2><p>{t('Para el programa de prueba. Sin valor comercial.','For the test program. No commercial value.')}</p></div>
   <button className="btn secondary" disabled={claiming} onClick={async()=>{
    setClaiming(true);setWelcomeNotice('');
    try{
     const claimed=await api('/api/client/welcome',{});
     setProgramId(claimed.programId);
     await refresh();
     setWelcomeNotice(t('¡Tus puntos de bienvenida ya están en tu saldo!','Your welcome points are in your balance.'));
    }catch(e){setWelcomeNotice(alertCopy(lang,e));}finally{setClaiming(false);}
   }}>{t('Reclamar','Claim')}</button>
  </section>}
  {welcomeNotice&&<p role="status">{welcomeNotice}</p>}
  <section className="module"><div className="section-heading"><h2>My Adventures</h2><button className="text-link" onClick={()=>go('adventures')}>{t('Ver colección','See collection')}</button></div><div className="badge-preview">{(unlocked.length?unlocked:state.badges).slice(0,3).map(b=><button key={b.kind} onClick={()=>setBadge(b)}><BadgeArt kind={b.art||b.kind} state={b.state} collectible={b.kind} exclusive={Boolean(b.requirements)} compact/><span>{b.name}</span></button>)}{next&&<button className="next-badge" onClick={()=>setBadge(next)}><strong>{next.name}</strong><span>{next.count} / {next.required}</span></button>}</div></section>
  <section className="module promo-mini"><div className="section-heading"><h2>Exclusive</h2><button className="text-link" onClick={()=>go('exclusive')}>{t('Ver promociones','See offers')}</button></div>{featured?<button className="promo-strip" onClick={()=>setOffer(featured)}><img src={featured.photos?.[0]?.url||'/assets/la-vita-cafe.png'} alt=""/><span><small>{featured.eligible?t('Disponible','Available'):grade(featured.minGrade)}</small><strong>{featured.title}</strong></span><Icon name="chevron"/></button>:<p className="collection-note">{t('Todavía no hay promociones exclusivas vigentes.','No exclusive offers are currently available.')}</p>}</section>
  <section className="module"><button className="text-link" onClick={()=>setOnboarding(true)}>{t('Mis preferencias','My preferences')}</button></section>
 </>}
 {screen==='points'&&<><div className="title-block"><h1>{t('Puntos','Points')}</h1><p>{selectProgram}</p></div>
  <div className="split-actions"><button className="btn secondary" onClick={()=>setTransfer(false)}>{t('Movimientos','Activity')}</button><button className="btn secondary" disabled={!program?.transferEnabled} onClick={()=>setTransfer(true)}>{t('Transferir','Transfer')}</button></div>
  {transfer&&program?.transferEnabled?<Transfer key={program.id} lang={lang} program={program} profile={state.profile} fee={state.fee} onComplete={refresh}/>:<section className="module"><h2>{t('Movimientos','Activity')}</h2><button className="text-link" onClick={()=>navigator.clipboard.writeText(state.profile.id).then(e=>{},()=>window.prompt(t('Copia tu identificador','Copy your member ID'),state.profile.id))}>{t('Copiar mi ID para recibir puntos','Copy my ID to receive points')}</button>{!state.activity.some(row=>row.programId===program?.id)&&<p>{t('Aún no hay movimientos.','No transactions yet.')}</p>}{state.activity.filter(row=>row.programId===program?.id).map(row=><div className="movement-row" key={row.id}><span className="movement-icon"><Icon name="receipt"/></span><div><strong>{row.type==='welcome'?t('Bienvenida de prueba','Test welcome bonus'):row.type==='fee'?t('Comisión','Fee'):row.type==='sent'?t('Puntos enviados','Points sent'):row.type==='received'?t('Puntos recibidos','Points received'):row.delta>0?t('Visita validada','Visit verified'):t('Canje o ajuste','Redemption or adjustment')}</strong><small>{new Date(row.date).toLocaleDateString(lang==='es'?'es-MX':'en-US')}</small></div><b className={row.delta>0?'positive':''}>{signed(row.delta)} pts</b></div>)}</section>}
 </>}
 {screen==='adventures'&&<><div className="title-block"><h1>My Adventures</h1><p>{t('Cada visita verificada deja una huella.','Every verified visit leaves a mark.')}</p></div><section className="grade-card">{gradePill}<Progress value={Math.min(100,state.total/state.target*100)} label={gradeText}/></section>
  <MissionBoard missions={state.missions||[]} lang={lang} refresh={refresh}/>
  <div className="collection-heading"><h2>{t('Tu vitrina','Your collection')}</h2><span>{unlocked.length} / {state.badges.length}</span></div>
  <div className="medal-filters">
   <select aria-label={t('Colección','Collection')} value={medalGroup} onChange={e=>setMedalGroup(e.target.value)}>
    {Object.entries(medalGroups).map(([key,value])=><option key={key} value={key}>{choice(lang,value)}</option>)}
   </select>
   <button className="btn secondary" aria-pressed={earnedOnly} onClick={()=>setEarnedOnly(!earnedOnly)}>{t('Obtenidas','Earned')}</button>
  </div>
  {!visibleBadges.length&&<p className="collection-note">{t('Todavía no hay medallas obtenidas en esta colección.','No medals earned in this collection yet.')}</p>}
  <div className="badge-grid">{visibleBadges.map(b=><button key={b.kind} className={`badge-card ${b.state} ${b.requirements?'badge-combo':''}`} onClick={()=>setBadge(b)}><BadgeArt kind={b.art||b.kind} state={b.state} collectible={b.kind} exclusive={Boolean(b.requirements)}/><strong>{b.name}</strong>{b.requirements&&<small>{t('Exclusiva','Exclusive')}</small>}<span className="state-label">{b.state==='unlocked'?t('Obtenida','Unlocked'):`${Math.min(b.count,b.required)} / ${b.required}`}</span></button>)}</div>
  <section className="module"><h2>{t('Retos del mes','Monthly challenges')}</h2>{[...state.challenges].sort((a,b)=>Number(b.interests.some(k=>state.profile.interests.includes(k)))-Number(a.interests.some(k=>state.profile.interests.includes(k)))).map(c=><div className="challenge-card" key={c.id}><strong>{c[lang]}</strong><p>{c.id==='cafe'?t('Visita dos cafeterías distintas.','Visit two different cafés.'):c.id==='night'?t('Visita dos lugares nocturnos distintos.','Visit two different nightlife spots.'):t('Visita tres lugares distintos.','Visit three different places.')}</p><Progress value={Math.min(100,c.count/c.target*100)} label={c.complete?t('Completado','Complete'):`${c.count} / ${c.target} · ${c.month}`}/></div>)}</section>
 </>}
 {screen==='exclusive'&&<><div className="title-block"><h1>Exclusive</h1>{gradePill}</div>{[true,false].map(eligible=><section className="module" key={String(eligible)}><h2>{eligible?t('Disponibles','Available'):t('Por desbloquear','To unlock')}</h2>{state.offers.filter(o=>o.eligible===eligible).map(o=><button key={o.id} className="promo-strip" onClick={()=>setOffer(o)}><img alt="" src={o.photos?.[0]?.url||'/assets/la-vita-cafe.png'}/><span><small>{grade(o.minGrade)}</small><strong>{o.title}</strong><em>{o.venue}</em></span><Icon name={eligible?'chevron':'lock'}/></button>)}{!state.offers.some(o=>o.eligible===eligible)&&<p>{t('Sin promociones en esta sección.','No offers in this section.')}</p>}</section>)}</>}
 </main>
 <nav className="bottom-nav" aria-label={t('Perfil y recompensas','Profile and rewards')}>{(['profile','points','adventures','exclusive'] as const).map((x,i)=><button key={x} aria-current={x===screen?'page':undefined} className={x===screen?'active':''} onClick={()=>go(x)}><Icon name={(['home','swap','medal','spark'] as const)[i]}/><span>{[t('Perfil','Profile'),t('Puntos','Points'),'Adventures','Exclusive'][i]}</span></button>)}</nav>
 {(!state.profile.onboarded||onboarding)&&<Preferences key={String(onboarding)} tour={!state.profile.onboarded} lang={lang} profile={state.profile} close={async()=>{await refresh();setOnboarding(false);}}/>}
 {badge&&<Sheet close={()=>setBadge(undefined)} lang={lang}>
  <BadgeArt kind={badge.art||badge.kind} state={badge.state} collectible={badge.kind} exclusive={Boolean(badge.requirements)}/>
  {badge.requirements&&<span className="state-label">{t('Combinación exclusiva','Exclusive combination')}</span>}
  <h2>{badge.name}</h2><p>{badge[lang]}</p>
  <Progress value={badge.progress} label={`${Math.min(badge.count,badge.required)} / ${badge.required}`}/>
  {badge.kind==='legend'&&<p>{Math.min(badge.categories||0,5)} / 5 {t('categorías','categories')}</p>}
  {badge.requirements&&<ul className="badge-requirements">{badge.requirements.map(r=><li key={r.kind}>
   <button type="button" className="text-link" onClick={()=>setBadge(state.badges.find(b=>b.kind===r.kind))}>{r.name}</button>
   <span>{r.unlocked?t('Obtenida','Earned'):t('Pendiente','Not earned')}</span>
  </li>)}</ul>}
 </Sheet>}
 {offer&&<Sheet close={()=>setOffer(undefined)} lang={lang}><h2>{offer.title}</h2><p>{offer.venue} · {grade(offer.minGrade)}</p><p>{offer.summary}</p><p>{t('Vigente hasta','Available through')} {offer.endDay}</p>{offer.eligible?<><p>{offer.conditions}</p>{offer.website&&<a className="btn secondary" href={offer.website} target="_blank" rel="noreferrer">{t('Ver condiciones oficiales','See official terms')}</a>}</>:<p>{t('Desbloquea este beneficio al alcanzar','Unlock this offer when you reach')} {grade(offer.minGrade)}.</p>}</Sheet>}
 </div>;
}
function MissionBoard({missions,lang,refresh}:{missions:Mission[],lang:Lang,refresh:()=>Promise<Data>}){
 const [expanded,setExpanded]=useState(false);
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const t=(es:string,en:string)=>choice(lang,[es,en]);
 const active=missions.find(m=>m.active&&!m.complete);
 const completed=missions.filter(m=>m.complete).length;
 const ordered=missions.slice().sort((a,b)=>Number(b.active)-Number(a.active)||Number(b.suggested)-Number(a.suggested));
 if(!missions.length)return null;
 async function select(id:string|null){
  setError('');setPending(true);
  try{await api('/api/client/missions',{id},'PUT');await refresh();}
  catch(e){setError(alertCopy(lang,e));}finally{setPending(false);}
 }
 return <section className="module missions-board" aria-label={t('Misiones de barrio','Neighborhood missions')}>
  <div className="section-heading">
   <div className="mission-preview">
    <span aria-hidden className="mission-animal mission-animal-mini" data-mission={(active||ordered[0]).id}/>
    <div><h2>{t('Misiones de barrio','Neighborhood missions')}</h2>
    <p>{active?`${active[lang]} · ${active.count}/${active.target}`:t(`${completed} de ${missions.length} completadas`,`${completed} of ${missions.length} completed`)}</p></div></div>
   <button className="text-link" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?t('Ocultar','Hide'):t('Ver misiones','See missions')}</button>
  </div>
  {expanded&&<div className="missions-list">
   <p>{t('Elige un plan sin fecha límite. Cuenta desde que lo inicias.','Choose a plan with no deadline. Visits count from when you start.')}</p>
   {ordered.map(m=><article className="challenge-card" key={m.id}>
    <div className="mission-card-intro">
     <div><strong>{m[lang]}</strong>
      {!m.startedAt&&m.suggested&&<span className="mission-label">{t('Para ti','For you')}</span>}
      <p>{lang==='es'?m.detailEs:m.detailEn}</p>
     </div>
     <span aria-hidden className="mission-animal" data-mission={m.id}/>
    </div>
    <Progress value={m.count/m.target*100} label={m.complete?t('Completada','Completed'):`${m.count} / ${m.target}`}/>
    {!m.complete&&(m.active
     ?<button className="text-link" disabled={pending} onClick={()=>select(null)}>{t('Quitar del resumen','Unpin')}</button>
     :<button className="btn secondary" disabled={pending} onClick={()=>select(m.id)}>{m.startedAt?t('Fijar misión','Pin mission'):t('Iniciar misión','Start mission')}</button>)}
   </article>)}
   {error&&<p role="alert">{error}</p>}
  </div>}
 </section>;
}
function Sheet({close,lang,children}:{close:()=>void,lang:Lang,children:React.ReactNode}){
 const ref=React.useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog ref={ref} className="vita-sheet" onCancel={close}><section className="detail-sheet"><button className="sheet-close" onClick={close} aria-label={choice(lang,['Cerrar','Close'])}><Icon name="close"/></button>{children}</section></dialog>;
}
const tourSections=[
 {icon:'home',title:['Explorar y cuponera','Explore & coupons'],detail:['Busca lugares y experiencias. Abre la cuponera para ver promociones.','Find places and experiences. Open the coupon carousel for deals.']},
 {icon:'clock',title:['Sucediendo ahora','Happening now'],detail:['Consulta qué eventos están en curso y cuáles vienen después.','See what’s on now and what’s coming up.']},
 {icon:'search',title:['Guías y alojamientos','Guides & stays'],detail:['Encuentra un guía para recorrer CDMX o un lugar para hospedarte.','Find a guide to explore Mexico City or a place to stay.']},
 {icon:'receipt',title:['Socialité','Socialité'],detail:['Lee historias y perfiles de la comunidad.','Read stories and profiles from the local community.']},
 {icon:'qr',title:['Mi QR y puntos','My QR & points'],detail:['Muestra tu QR en un lugar participante para sumar puntos o canjear. También puedes transferir puntos desde tu perfil.','Show your QR at participating venues to earn or redeem points. You can also transfer points from your profile.']},
 {icon:'medal',title:['My Adventures y Exclusive','My Adventures & Exclusive'],detail:['Completa retos, gana medallas y desbloquea promociones según tu grado.','Complete challenges, earn medals and unlock offers as you rank up.']},
] as const;

function Preferences({lang,profile,close,tour}:{lang:Lang,profile:Data['profile'],close:()=>Promise<void>,tour:boolean}){
 const [step,setStep]=useState(tour?0:1);
 const [residence,setResidence]=useState(profile.residence);
 const [interests,setInterests]=useState(profile.interests);
 const [photo,setPhoto]=useState<Blob>();
 const [preview,setPreview]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const t=(es:string,en:string)=>choice(lang,[es,en]);
 const ref=React.useRef<HTMLDialogElement>(null);
 const heading=React.useRef<HTMLHeadingElement>(null);
 useEffect(()=>{ref.current?.showModal();},[]);
 useEffect(()=>{heading.current?.focus();},[step]);
 useEffect(()=>{
  if(!photo)return;
  const url=URL.createObjectURL(photo);
  setPreview(url);
  return ()=>URL.revokeObjectURL(url);
 },[photo]);
 function move(next:number){setError('');setStep(next);}
 async function selectPhoto(file:File){
  setBusy(true);setError('');
  try{setPhoto(await encodeAvatar(file));}
  catch{setError(t('Elige una imagen JPG, PNG o WebP de hasta 5 MB.','Choose a JPG, PNG or WebP image up to 5 MB.'));}
  finally{setBusy(false);}
 }
 async function next(){
  setBusy(true);setError('');
  try{
   if(step===0){
    if(photo)await saveAvatar(createClient(),profile.id,photo);
    move(1);
    return;
   }
   await api('/api/client/onboarding',{residence,interests},'PUT');
   await close();
  }catch(e){setError(alertCopy(lang,e));}finally{setBusy(false);}
 }
 const title=step===0?t('Ponle cara a tu perfil','Make it your profile'):step===1?t('¿Qué plan se te antoja?','What are you in the mood for?'):t('Tu guía rápida de La Vita','Your quick guide to La Vita');
 return <dialog ref={ref} className="vita-sheet" onCancel={e=>{e.preventDefault();if(!tour&&!busy)void close();}} aria-labelledby="onboarding-title">
  <section className="detail-sheet preference-sheet onboarding-sheet">
   {tour&&<p className="onboarding-count">{t('Paso','Step')} {step+1}/3</p>}
   <h2 id="onboarding-title" ref={heading} tabIndex={-1}>{title}</h2>
   {step===0&&<>
    <p>{t('Agrega una foto para personalizar tu cuenta. Puedes cambiarla después.','Add a photo to personalize your account. You can change it later.')}</p>
    <div className="onboarding-avatar">{preview||profile.avatar?<img src={preview||profile.avatar||''} alt={t('Vista previa de tu foto','Preview of your photo')}/>:<span aria-hidden>{Array.from(profile.name)[0]?.toUpperCase()}</span>}</div>
    <label className="onboarding-upload">
     <span>{t('Elegir foto','Choose a photo')}</span>
     <input type="file" accept={avatarTypes.join(',')} disabled={busy} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void selectPhoto(file);}}/>
    </label>
   </>}
   {step===1&&<>
    <label>{t('¿De dónde nos visitas?','Where are you visiting from?')}<select value={residence} onChange={e=>setResidence(e.target.value)}>{Object.entries(visits).map(([key,name])=><option key={key} value={key}>{choice(lang,name)}</option>)}</select></label>
    <p>{t('Elige hasta cuatro intereses para personalizar tus retos.','Pick up to four interests to personalize your challenges.')}</p>
    <div className="interest-grid">{Object.entries(activities).map(([key,name])=><button key={key} type="button" className="btn secondary" aria-pressed={interests.includes(key)} disabled={!interests.includes(key)&&interests.length>=4} onClick={()=>setInterests(pre=>pre.includes(key)?pre.filter(x=>x!==key):[...pre,key])}>{choice(lang,name)}</button>)}</div>
   </>}
   {step===2&&<ul className="onboarding-guide">{tourSections.map(item=><li key={item.icon}><span className="onboarding-icon"><Icon name={item.icon}/></span><div><strong>{t(...item.title)}</strong><p>{t(...item.detail)}</p></div></li>)}</ul>}
   {error&&<p role="alert">{error}</p>}
   <button className="btn primary" disabled={busy} onClick={()=>tour&&step===1?move(2):void next()}>
    {busy?t('Un momento…','One moment…'):step===0?(photo?t('Guardar foto y continuar','Save photo and continue'):profile.avatar?t('Conservar mi foto','Keep my photo'):t('Continuar sin foto','Continue without a photo')):step===2?t('Ir a mi perfil','Go to my profile'):tour?t('Continuar','Continue'):t('Guardar preferencias','Save preferences')}
   </button>
   {tour&&step>0&&<button className="text-link" disabled={busy} onClick={()=>move(step-1)}>{t('Atrás','Back')}</button>}
   {!tour&&<button className="text-link" disabled={busy} onClick={()=>void close()}>{t('Cancelar','Cancel')}</button>}
  </section>
 </dialog>;
}
function Pass({program,lang,refresh}:{program:Program,lang:Lang,refresh:()=>Promise<Data>}){
 const [mode,setMode]=useState<'earn'|'redeem'>('earn');
 const [reward,setReward]=useState('');
 const [pass,setPass]=useState<{code:string,expires_at:number,image:string}>();
 const [now,setNow]=useState(Date.now);
 const [result,setResult]=useState<{balance:number,delta:number}>();
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const t=(es:string,en:string)=>choice(lang,[es,en]);
 const available=program.rewards.filter(r=>r.stock>0&&r.cost<=program.balance);
 const seconds=Math.max(0,Math.ceil(((pass?.expires_at||0)-now)/1000));
 async function generate(nextMode=mode,nextReward=reward){
  setBusy(true);setNotice('');setError('');setPass(undefined);setResult(undefined);
  try{
   const value=await api('/api/loyalty/codes',{program_id:program.id,kind:nextMode,...(nextMode==='redeem'?{reward_id:nextReward}:{})});
   const image=await QRCode.toDataURL(value.code,{width:320,margin:4});
   setPass({...value,image});setNow(Date.now());
  }catch(e){setError(alertCopy(lang,e));}finally{setBusy(false);}
 }
 useEffect(()=>{void generate('earn');},[]);
 useEffect(()=>{
  if(!pass||result)return;
  let stopped=false,checking=false;
  const clock=setInterval(()=>setNow(Date.now()),1000);
  const status=setInterval(async()=>{
   if(checking)return;checking=true;
   try{
    const current=await api('/api/loyalty/code-status',{code:pass.code});
    if(!stopped&&current.status==='confirmed'){setResult(current);void refresh().catch(()=>{});}
   }catch{/* Keep checking after a network failure. */}finally{checking=false;}
  },5000);
  return()=>{stopped=true;clearInterval(clock);clearInterval(status);};
 },[pass,result]);
 return <><div className="qr-tabs"><button className={mode==='earn'?'active':''} disabled={busy} onClick={()=>{setMode('earn');void generate('earn');}}>{t('Acumular puntos','Earn points')}</button><button className={mode==='redeem'?'active':''} disabled={busy} onClick={()=>{setMode('redeem');setPass(undefined);setResult(undefined);setError('');setNotice('');}}>{t('Canjear','Redeem')}</button></div>
 <div className="qr-main"><span className="eyebrow">{program.name}</span><h1>{mode==='earn'?t('Tu pase La Vita','Your La Vita pass'):t('Canjear recompensa','Redeem a reward')}</h1>
 {mode==='redeem'&&!pass&&<>{available.length?<><select aria-label={t('Recompensa','Reward')} value={reward} onChange={e=>setReward(e.target.value)}><option value="">{t('Elige una recompensa','Choose a reward')}</option>{available.map(r=><option value={r.id} key={r.id}>{r.title} · {r.cost} pts</option>)}</select><button className="btn primary" disabled={!reward||busy} onClick={()=>generate()}>{t('Generar código','Generate code')}</button></>:<p>{t('No tienes recompensas disponibles para canjear.','You have no rewards available to redeem.')}</p>}</>}
 {result?<div className="status-panel success"><Icon name="check"/><h2>{t('Operación confirmada','Transaction confirmed')}</h2><p>{signed(result.delta)} pts</p><strong>{t('Saldo','Balance')} · {result.balance} pts</strong></div>:pass&&seconds>0?<><div className="qr-frame"><img src={pass.image} alt={t('Código QR de La Vita','La Vita QR code')}/></div><p className="timer">{t('Vence en','Expires in')} {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</p><button className="btn secondary copy-btn" onClick={()=>navigator.clipboard.writeText(pass.code).then(()=>setNotice(t('Código copiado','Code copied')),()=>setNotice(pass.code))}>{t('Copiar código','Copy code')}</button><p role="status">{notice}</p></>:pass?<div className="status-panel"><p>{t('Código vencido','Code expired')}</p><button className="btn primary" onClick={()=>generate()}>{t('Generar otro','Generate another')}</button></div>:mode==='earn'&&!busy&&<button className="btn primary" onClick={()=>generate()}>{t('Generar código','Generate code')}</button>}
 {busy&&<p role="status">{t('Generando código…','Generating code…')}</p>}{error&&<p role="alert">{error}</p>}
 </div></>;
}
function Transfer({lang,program,fee,profile,onComplete}:{lang:Lang,program:Program,fee:number,profile:Data['profile'],onComplete:()=>Promise<Data>}){
 const [id,setId]=useState('');
 const [amount,setAmount]=useState('');
 const [recipient,setRecipient]=useState<{id:string,name:string}>();
 const [confirmation,setConfirmation]=useState<{reference:string,to:string,programId:string,amount:number}>();
 const [receipt,setReceipt]=useState<Receipt>();
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const key='lavita-transfer:'+profile.id+':'+program.id;
 const [sent,setSent]=useState(false);
 const t=(es:string,en:string)=>choice(lang,[es,en]);
 useEffect(()=>{
  const raw=sessionStorage.getItem(key);if(!raw)return;
  try{const value=JSON.parse(raw);setConfirmation(value.payload);setRecipient(value.recipient);setSent(true);}catch{}
 },[key]);
 async function work(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();}catch(e){setError(alertCopy(lang,e));}finally{setBusy(false);}}
 async function finish(row:Receipt){setReceipt(row);sessionStorage.removeItem(key);void onComplete().catch(()=>{});}
 if(receipt)return <section className="receipt-card"><h2>{t('Transferencia confirmada','Transfer confirmed')}</h2><p>{receipt.recipient} · {receipt.amount} pts</p><p>{t('Comisión','Fee')}: {receipt.fee} pts</p><p>{t('Saldo restante','Remaining balance')}: {receipt.balance} pts</p><small>{receipt.reference}</small></section>;
 if(confirmation&&recipient)return <section className="transfer-card">
  <h2>{t('Confirmar transferencia','Confirm transfer')}</h2>
  <p>{recipient.name} · {confirmation.amount} pts</p><p>{t('Comisión','Fee')}: {fee} pts</p>
  <strong>{t('Total a descontar','Total debit')}: {confirmation.amount+fee} pts</strong>
  {!sent&&<p>{t('Saldo restante','Remaining balance')}: {program.balance-confirmation.amount-fee} pts</p>}
  {sent&&<button disabled={busy} className="btn secondary" onClick={()=>work(async()=>{try{await finish(await api('/api/client/transfers/'+confirmation.reference));}catch(e){if(e.status!==404)throw e;setError(t('Aún no encontramos la operación. Puedes reintentar con la misma referencia.','We haven’t found the transfer yet. You can retry with the same reference.'));}})}>{t('Consultar estado','Check status')}</button>}
  <button disabled={busy} className="btn primary" onClick={()=>work(async()=>{sessionStorage.setItem(key,JSON.stringify({payload:confirmation,recipient}));setSent(true);await finish(await api('/api/client/transfers',confirmation));})}>{sent?t('Reintentar misma transferencia','Retry same transfer'):t('Confirmar transferencia','Confirm transfer')}</button>
  {!sent&&<button className="text-link" onClick={()=>setConfirmation(undefined)}>{t('Volver','Back')}</button>}
  {error&&<p role="alert">{error}</p>}
 </section>;
 return <form className="transfer-card" onSubmit={e=>{e.preventDefault();void work(async()=>{
  const value=Number(amount);
  if(!Number.isSafeInteger(value)||value<1||value+fee>program.balance){setError(t('Revisa la cantidad y el saldo disponible.','Check the amount and available balance.'));return;}
  let person;
  try{person=await api('/api/client/recipient',{id:id.trim()});}catch(e){if(e.status!==404&&e.status!==400)throw e;setError(t('No encontramos ese destinatario. Revisa su ID.','Recipient not found. Check their ID.'));return;}
  setRecipient(person);setConfirmation({reference:crypto.randomUUID(),to:person.id,programId:program.id,amount:value});
 });}}>
 <h2>{t('Transferir puntos','Transfer points')}</h2><p>{program.name} · {program.balance} pts</p>
 <label>{t('ID de La Vita del destinatario','Recipient’s La Vita ID')}<input value={id} required maxLength={36} onChange={e=>setId(e.target.value)}/></label>
 <label>{t('Cantidad','Amount')}<input value={amount} required type="number" min="1" step="1" onChange={e=>setAmount(e.target.value)}/></label>
 <p>{t('Comisión','Fee')}: {fee} pts</p><button className="btn primary" disabled={busy}>{t('Revisar transferencia','Review transfer')}</button>{error&&<p role="alert">{error}</p>}
 </form>;
}
createRoot(document.getElementById('client-profile')!).render(<App/>);
