import {availableMissionStops,eligibleMissionStop,routeSize,stopForRoute,validMissionRoute} from './mission-stops.mjs';

const catalog=[
 {id:'first-stamp',es:'Una primera parada',en:'One First Stop',detailEs:'Elige dónde dar tu primera vuelta.',detailEn:'Pick where to make your first stop.',target:1,metric:'places',interests:['walks']},
 {id:'coffee-trail',es:'Ruta de café',en:'Coffee Trail',detailEs:'Arma una ruta de tres cafeterías.',detailEn:'Build a route with three cafés.',target:2,metric:'coffee',interests:['coffee']},
 {id:'mix-it-up',es:'Cambia de plan',en:'Mix It Up',detailEs:'Combina dos lugares de categorías distintas.',detailEn:'Pair two places from different categories.',target:2,metric:'categories',interests:['food','art','wellness','nightlife','music']},
];
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};

export function missionProgress(visits,record,interests,options=[]){
 return catalog.map(({metric,interests:tags,...mission})=>{
  const startedAt=record?.startedAt?.[mission.id]||null;
  const started=startedAt?visits.filter(visit=>visit.created_at>=startedAt):[];
  const route=record?.routes?.[mission.id];
  const stops=options.filter(stop=>eligibleMissionStop(mission.id,stop));
  let count,target=mission.target;
  let places=[];
  if(route){
   target=route.length;
   places=route.map(stop=>{
    const current=stops.find(candidate=>candidate.id===stop.id);
    const verified=started.some(visit=>visit.venue===stop.id);
    const visited=verified||record.checks?.[mission.id]?.[stop.id]===true;
    return {...stop,...current,visited,verified};
   });
   count=places.filter(place=>place.visited).length;
  }else{
   let steps;
   if(metric==='coffee')steps=started.filter(visit=>visit.tags.includes('cafe')).map(visit=>visit.venue);
   else if(metric==='categories'){
    const byPlace=new Map(started.filter(visit=>visit.category).map(visit=>[visit.venue,visit.category]));
    steps=[...byPlace.values()];
   }else steps=started.map(visit=>visit.venue);
   count=Math.min(new Set(steps).size,target);
  }
  return {...mission,target,routeSize:routeSize(mission.id),startedAt,count,complete:count===target,active:record?.active===mission.id,
   route:places,options:stops,suggested:tags.some(tag=>interests.includes(tag))};
 });
}

export function missionBenefit(record,program){
 if(program.test||program.event_id)return null;
 const id=record?.active;
 if(!record?.routes?.[id]?.some(stop=>stop.id===program.organization_id)||record.checks?.[id]?.[program.organization_id])return null;
 const mission=catalog.find(item=>item.id===id);
 return mission?{id,es:mission.es,en:mission.en,discount:program.mission_discount||null,perk:program.mission_perk||null}:null;
}

export async function checkMissionRoutes(tx,userId,org,operation){
 const record=await tx.get('NeighborhoodMissions',userId);
 const routeIds=Object.keys(record?.routes||{}).filter(id=>record.routes[id].some(stop=>stop.id===org));
 if(!routeIds.length)return;
 const checks={...record.checks};
 let changed=false;
 for(const id of routeIds){
  const row={...checks[id]};
  if(operation.reversed){
   if(row[org]!==operation.id)continue;
   delete row[org];
  }else{
   if(row[org])continue;
   row[org]=operation.id;
  }
  checks[id]=row;
  changed=true;
 }
 if(changed)await tx.put('NeighborhoodMissions',userId,{...record,checks});
}

export function mountMissions(app,{store,authenticated}){
 app.put('/api/client/missions',authenticated,async(req,res)=>{
  const {id,route,visit}=req.body;
  if(id!==null&&!catalog.some(mission=>mission.id===id))fail(400,'Invalid mission');
  if((route!==undefined||visit!==undefined)&&(!id||route!==undefined&&visit!==undefined))fail(400,'Invalid mission update');
  const options=route===undefined?[]:await availableMissionStops(store);
  if(route!==undefined&&(!Array.isArray(route)||route.length!==routeSize(id)))fail(400,'Invalid mission route');
  await store.transaction(async tx=>{
   const userId=req.user.id, record=await tx.get('NeighborhoodMissions',userId)||{startedAt:{}};
   const startedAt={...record.startedAt};
   if(visit!==undefined){
    const stop=record.routes?.[id]?.find(place=>place.id===visit);
    if(!stop||stop.partner)fail(400,'This stop requires a verified visit');
    const checks={...record.checks,[id]:{...record.checks?.[id],[visit]:true}};
    await tx.put('NeighborhoodMissions',userId,{...record,checks});
    return;
   }
   let routes=record.routes;
   if(route!==undefined){
    const previous=routes?.[id]||[];
    if(previous.some(stop=>record.checks?.[id]?.[stop.id]&&!route.includes(stop.id)))fail(409,'Keep visited stops in your route');
    const selected=route.map(key=>options.find(stop=>stop.id===key)||previous.find(stop=>stop.id===key));
    if(!validMissionRoute(id,selected))fail(400,'Invalid mission route');
    routes={...routes,[id]:selected.map(stopForRoute)};
   }
   if(id&&!startedAt[id])startedAt[id]=new Date().toISOString();
   await tx.put('NeighborhoodMissions',userId,{...record,active:id,startedAt,...(routes?{routes}:{})});
  });
  res.json({ok:true});
 });
}
