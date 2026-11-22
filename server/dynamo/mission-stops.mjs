import {missionVenues} from '../../dist/mission-venues.js';
const normalize=value=>value?.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');

export async function availableMissionStops(store){
 return listMissionStops(...await Promise.all([store.list('Documents'),store.list('Programs')]));
}

export function listMissionStops(docs,programs){
 const active=programs.filter(program=>program.active&&!program.test&&!program.event_id);
 const partners=[];
 const seen=new Set();
 for(const doc of docs){
  const place=doc.published;
  if(doc.kind!=='business'||!doc.publishedActive||!place||!doc.organization_id||seen.has(doc.organization_id))continue;
  const program=active.find(program=>program.organization_id===doc.organization_id);
  if(!program)continue;
  seen.add(doc.organization_id);
  partners.push({id:doc.organization_id,name:place.title,address:place.address,website:place.website,category:place.category,
   coffee:place.category==='cafe'||(place.visitTags||[]).includes('cafe'),programId:program.id,points:program.points_per_visit,
   discount:program.mission_discount,perk:program.mission_perk});
 }
 return [...partners,...missionVenues.filter(s=>!partners.some(p=>normalize(p.address)===normalize(s.address)||normalize(p.name)===normalize(s.name)))];
}

export function routeSize(id){return id==='coffee-trail'?3:id==='mix-it-up'?2:1;}
export function eligibleMissionStop(id,stop){
 if(id==='coffee-trail')return stop.coffee;
 if(id==='mix-it-up')return Boolean(stop.category&&stop.category!=='other');
 return true;
}
export function validMissionRoute(id,stops){
 return stops.length===routeSize(id)&&stops.every(stop=>stop&&eligibleMissionStop(id,stop))
  &&new Set(stops.map(stop=>id==='mix-it-up'?stop.category:stop.id)).size===stops.length;
}

export function stopForRoute(stop){
 const {id,name,address,website,category,coffee}=stop;
 return {id,name,address,website,category,coffee,partner:Boolean(stop.programId||stop.partner)};
}
