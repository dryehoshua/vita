import {businessVisit} from './visit-context.mjs';
import {digest} from '../security.mjs';

const interests=['food','coffee','music','art','nightlife','walks','wellness'];
const residences=['unspecified','tourist','cdmx','roma-condesa'];
const gradeNames=['explorer','regular','insider','legend'];
const formatDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City'});
const fee=5;
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

const definitions=[
 ['foot','First Footprint',1,'Verifica tu primera visita.','Verify your first visit.'],
 ['knight','Beer Knight',5,'Visita 5 bares distintos.','Visit 5 different bars.','bar'],
 ['night','Lord of the Night',10,'Visita 10 lugares nocturnos distintos.','Visit 10 different nightlife spots.','nightlife'],
 ['taco','Taco Tactician',5,'Visita 5 taquerías distintas.','Visit 5 different taco spots.','taco'],
 ['coffee','Espresso Express',4,'Visita 4 cafeterías distintas.','Visit 4 different cafés.','cafe'],
 ['culture','Culture Vulture',3,'Asiste a 3 eventos culturales distintos.','Attend 3 different cultural events.','culture'],
 ['brunch','Brunch Bandit',3,'Visita 3 lugares de brunch en su horario.','Visit 3 brunch spots during brunch hours.','brunch'],
 ['legend','Neighborhood Legend',25,'Visita 25 lugares en 5 categorías.','Visit 25 places across 5 categories.'],
];
function progress(visits,filter=()=>true){
 const unique=new Set(visits.filter(filter).map(v=>v.venue));
 return unique.size;
}
function summary(visits,now){
 const total=progress(visits);
 const categories=new Set(visits.map(v=>v.category).filter(Boolean)).size;
 const grade=total>=25&&categories>=5?3:total>=10?2:total>=5?1:0;
 const target=[5,10,25,25][grade];
 const badges=definitions.map(([kind,name,required,es,en,tag])=>{
  const matches=visits.filter(v=>!tag||v.tags.includes(tag));
  const count=kind==='culture'?new Set(visits.map(v=>v.eventId).filter(Boolean)).size:progress(matches);
  const unlocked=count>=required&&(kind!=='legend'||categories>=5);
  return {kind,name,required,es,en,count,state:unlocked?'unlocked':count?'progress':'locked',
   progress:Math.min(100,Math.round(100*count/required)),
   ...(kind==='legend'?{categories}:{}),
   pendingVerification:false};
 });
 const month=formatDay.format(now).slice(0,7);
 const current=visits.filter(v=>formatDay.format(new Date(v.created_at)).startsWith(month));
 const challenges=[
  {id:'cafe',es:'Café pendiente',en:'Coffee Run',target:2,count:progress(current,v=>v.tags.includes('cafe')),interests:['coffee']},
  {id:'discovery',es:'Tres nuevas paradas',en:'Three Stops',target:3,count:progress(current),interests:['walks','food']},
  {id:'night',es:'Luces del barrio',en:'After Dark',target:2,count:progress(current,v=>v.tags.includes('nightlife')),interests:['music','nightlife']},
 ].map(r=>({...r,complete:r.count>=r.target,month}));
 return {total,categories,grade:gradeNames[grade],nextGrade:gradeNames[grade+1]||null,target,badges,challenges};
}
async function getVisits(store,id,ledger){
 const operations=await Promise.all(ledger.filter(row=>row.delta>0&&!row.type&&row.id&&!String(row.reference||'').startsWith('reverse:')).map(row=>store.get('Operations',row.id)));
 const documents=(await store.list('Documents')).filter(row=>row.kind==='business'&&row.publishedActive);
 return operations.filter(row=>row?.user_id===id&&row.kind==='earn'&&!row.reversed&&row.created_at)
  .map(row=>{
   const doc=documents.find(d=>d.organization_id===row.organization_id)?.published;
   const visit=row.visit||businessVisit(doc?{category:doc.category,visitTags:doc.visitTags}:null,new Date(row.created_at));
   return {venue:row.organization_id,created_at:row.created_at,...visit};
  });
}
export function mountAdventures(app,{store,authenticated}){
 app.get('/api/client/profile',authenticated,async(req,res)=>{
  const id=req.user.id;
  const [profile,ledger,wallets,programs,rewards]=await Promise.all([
   store.get('Profiles',id),store.list('Ledger#'+id),store.list('Wallets#'+id),store.list('Programs'),store.list('Rewards'),
  ]);
  const places=summary(await getVisits(store,id,ledger),new Date());
  const grade=gradeNames.indexOf(places.grade);
  const day=formatDay.format(new Date());
  const docs=await store.list('Documents');
  const offers=docs.filter(d=>d.kind==='promotion'&&d.publishedActive&&gradeNames.includes(d.published?.minGrade))
   .filter(d=>d.published.day<=day&&day<=d.published.endDay)
   .map(d=>({id:d.id,...d.published,eligible:grade>=gradeNames.indexOf(d.published.minGrade)}))
   .map(d=>{if(d.eligible)return d;const {conditions,website,...publicPreview}=d;return publicPreview;});
  const names=new Map(programs.map(p=>[p.id,p.name]));
  res.json({data:{
   profile:{name:profile.display_name,avatar:profile.avatar_path?'/api/avatar':null,
    id,residence:profile.residence,interests:profile.interests||[],onboarded:Boolean(profile.onboarded)},
   programs:programs.filter(p=>p.active||wallets.some(w=>w.program_id===p.id)).map(p=>({
    id:p.id,name:p.name,active:p.active,balance:wallets.find(w=>w.program_id===p.id)?.balance||0,
    test:Boolean(p.test),transferEnabled:p.active&&Boolean(p.test||p.transfer_enabled),
    rewards:rewards.filter(r=>p.active&&r.active&&r.program_id===p.id).map(({id,title,cost,stock})=>({id,title,cost,stock})),
   })),
   fee,activity:ledger.map(r=>({id:r.id,date:r.created_at,delta:r.delta,reason:r.reason,type:r.type,programId:r.program,program:names.get(r.program)||'La Vita'})).sort((a,b)=>b.date.localeCompare(a.date)),
   ...places,offers,
  }});
 });
 app.put('/api/client/onboarding',authenticated,async(req,res)=>{
  const {residence,interests:selected}=req.body;
  if(!residences.includes(residence)||!Array.isArray(selected)||selected.length>4||selected.some(k=>!interests.includes(k)))fail(400,'Invalid preferences');
  await store.transaction(async tx=>{
   const p=await tx.get('Profiles',req.user.id);
   await tx.put('Profiles',p.id,{...p,residence,interests:[...new Set(selected)],onboarded:true});
  });
  res.json({ok:true});
 });
 async function recipient(id,from,tx=store){
  if(!uuid(id)||id===from)fail(400,'Invalid recipient');
  const u=await tx.get('Users',id),p=await tx.get('Profiles',id);
  if(!u?.verified||u.status!=='active'||!p)fail(404,'Recipient not found');
  return {id,name:p.display_name};
 }
 app.post('/api/client/recipient',authenticated,async(req,res)=>{
  res.json({data:await recipient(req.body.id?.trim(),req.user.id)});
 });
 app.post('/api/client/transfers',authenticated,async(req,res)=>{
  const {to,programId,amount,reference}=req.body;
  if(!uuid(reference)||!Number.isSafeInteger(amount)||amount<1||amount>100000||typeof programId!=='string'||programId.length>80)fail(400,'Invalid transfer');
  const from=req.user.id,key=digest(from+':'+reference);
  const record=await store.transaction(async tx=>{
   const previous=await tx.get('Transfers',key);
   if(previous){
    if(previous.to!==to||previous.programId!==programId||previous.amount!==amount)fail(409,'Reference already used');
    return previous;
   }
   const sender=await tx.get('Users',from);
   if(!sender?.verified||sender.status!=='active')fail(403,'Account unavailable');
   const person=await recipient(to,from,tx);
   const program=await tx.get('Programs',programId);
   if(!program?.active||!(program.test||program.transfer_enabled))fail(403,'Transfer unavailable');
   const makeWallet=()=>({program:program.id,program_id:program.id,name:program.name,balance:0});
   const source=await tx.get('Wallets#'+from,programId)||makeWallet();
   const target=await tx.get('Wallets#'+to,programId)||makeWallet();
   const debit=amount+fee;
   if(source.balance<debit)fail(409,'Insufficient balance');
   const balance=source.balance-debit,created_at=new Date().toISOString();
   const result={to,recipient:person.name,programId,amount,fee,balance,reference,created_at};
   await tx.put('Transfers',key,result);
   await tx.put('Wallets#'+from,programId,{...source,balance});
   await tx.put('Wallets#'+to,programId,{...target,balance:target.balance+amount});
   for(const [id,delta,type,reason] of [[from,-amount,'sent','Puntos enviados'],[from,-fee,'fee','Comisión'],[to,amount,'received','Puntos recibidos']]){
    const ledgerId=key+':'+type;
    await tx.put('Ledger#'+id,ledgerId,{id:ledgerId,user_id:id,program:programId,delta,type,reason,created_at});
   }
   return result;
  });
  res.json({data:record});
 });
 app.get('/api/client/transfers/:reference',authenticated,async(req,res)=>{
  const record=await store.get('Transfers',digest(req.user.id+':'+req.params.reference));
  if(!record)fail(404,'Transfer not found');
  res.json({data:record});
 });
}
