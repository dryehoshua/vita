const catalog=[
 {id:'first-stamp',es:'Una primera parada',en:'One First Stop',detailEs:'Valida una visita en cualquier negocio participante.',detailEn:'Verify a visit at any participating business.',target:1,metric:'places',interests:['walks']},
 {id:'coffee-trail',es:'Ruta de café',en:'Coffee Trail',detailEs:'Visita dos cafeterías distintas y valida el QR en cada una.',detailEn:'Visit two different cafés and verify your QR at each one.',target:2,metric:'coffee',interests:['coffee']},
 {id:'mix-it-up',es:'Cambia de plan',en:'Mix It Up',detailEs:'Valida visitas en negocios de dos categorías diferentes.',detailEn:'Verify visits at businesses in two different categories.',target:2,metric:'categories',interests:['food','art','wellness','nightlife','music']},
];

export function missionProgress(visits,record,interests){
 return catalog.map(({metric,interests:tags,...mission})=>{
  const startedAt=record?.startedAt?.[mission.id]||null;
  const started=startedAt?visits.filter(visit=>visit.created_at>=startedAt):[];
  let steps;
  if(metric==='coffee')steps=started.filter(visit=>visit.tags.includes('cafe')).map(visit=>visit.venue);
  else if(metric==='categories'){
   const byPlace=new Map(started.filter(visit=>visit.category).map(visit=>[visit.venue,visit.category]));
   steps=[...byPlace.values()];
  }else steps=started.map(visit=>visit.venue);
  const count=Math.min(new Set(steps).size,mission.target);
  return {...mission,startedAt,count,complete:count===mission.target,active:record?.active===mission.id,
   suggested:tags.some(tag=>interests.includes(tag))};
 });
}

export function mountMissions(app,{store,authenticated}){
 app.put('/api/client/missions',authenticated,async(req,res)=>{
  const id=req.body.id;
  if(id!==null&&!catalog.some(mission=>mission.id===id))return res.status(400).json({error:'Invalid mission'});
  const now=new Date().toISOString();
  await store.transaction(async tx=>{
   const record=await tx.get('NeighborhoodMissions',req.user.id)||{startedAt:{}};
   const startedAt={...record.startedAt};
   if(id&&!startedAt[id])startedAt[id]=now;
   await tx.put('NeighborhoodMissions',req.user.id,{active:id,startedAt});
  });
  res.json({ok:true});
 });
}
