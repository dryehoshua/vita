// Permanent medals use verified visits. Points and monthly challenges have their own rules.
const place=(n)=>['places',n];
const tagged=(n,tag)=>['tags',n,tag];
const events=(n)=>['events',n];
const kinds=(n)=>['categories',n];
const days=(n)=>['days',n];

// id, art, name, requirement, Spanish, English.
export const collections=[
 {id:'exploration',medals:[
  ['foot','foot','First Footprint',place(1),'Verifica tu primera visita.','Verify your first visit.'],
  ['corner','foot','Corner Hopper',place(3),'Visita 3 lugares distintos.','Visit 3 different places.'],
  ['local','legend','Local in Training',place(5),'Visita 5 lugares distintos.','Visit 5 different places.'],
  ['curious','foot','Curiosity Club',place(10),'Visita 10 lugares distintos.','Visit 10 different places.'],
  ['side-street','legend','Side Street Sleuth',place(15),'Visita 15 lugares distintos.','Visit 15 different places.'],
  ['legend','legend','Neighborhood Legend',['legend',25],'Visita 25 lugares en al menos 5 categorías.','Visit 25 places across at least 5 categories.'],
  ['atlas','legend','Pocket Atlas',place(40),'Visita 40 lugares distintos.','Visit 40 different places.'],
  ['fifty','legend','Fifty Shades of Condesa',place(50),'Visita 50 lugares distintos.','Visit 50 different places.'],
 ]},
 {id:'flavors',medals:[
  ['taco','taco','Taco Tactician',tagged(5,'taco'),'Visita 5 taquerías distintas.','Visit 5 different taco spots.'],
  ['coffee','coffee','Espresso Express',tagged(4,'cafe'),'Visita 4 cafeterías distintas.','Visit 4 different cafés.'],
  ['brunch','brunch','Brunch Bandit',tagged(3,'brunch'),'Visita 3 lugares de brunch dentro de su horario.','Visit 3 brunch spots during their brunch hours.'],
  ['taco-duo','taco','Double Tortilla',tagged(2,'taco'),'Visita 2 taquerías distintas.','Visit 2 different taco spots.'],
  ['taco-eight','taco','Salsa Sorcerer',tagged(8,'taco'),'Visita 8 taquerías distintas.','Visit 8 different taco spots.'],
  ['coffee-duo','coffee','The Daily Grind',tagged(2,'cafe'),'Visita 2 cafeterías distintas.','Visit 2 different cafés.'],
  ['coffee-eight','coffee','Bean Baron',tagged(8,'cafe'),'Visita 8 cafeterías distintas.','Visit 8 different cafés.'],
  ['restaurant-three','taco','Table for Three',tagged(3,'restaurant'),'Visita 3 restaurantes distintos.','Visit 3 different restaurants.'],
  ['restaurant-eight','taco','Menu Archaeologist',tagged(8,'restaurant'),'Visita 8 restaurantes distintos.','Visit 8 different restaurants.'],
  ['brunch-five','brunch','Late Breakfast Club',tagged(5,'brunch'),'Visita 5 lugares de brunch dentro de su horario.','Visit 5 brunch spots during their brunch hours.'],
 ]},
 {id:'nightlife',medals:[
  ['knight','knight','Beer Knight',tagged(5,'bar'),'Visita 5 bares distintos. No hace falta consumir alcohol.','Visit 5 different bars. No alcohol purchase required.'],
  ['night','night','Lord of the Night',tagged(10,'nightlife'),'Visita 10 lugares nocturnos distintos.','Visit 10 different nightlife spots.'],
  ['bar-duo','knight','Bar Scout',tagged(2,'bar'),'Visita 2 bares distintos.','Visit 2 different bars.'],
  ['bar-eight','knight','Bar Cartographer',tagged(8,'bar'),'Visita 8 bares distintos.','Visit 8 different bars.'],
  ['night-duo','night','Neon Rookie',tagged(2,'nightlife'),'Visita 2 lugares nocturnos distintos.','Visit 2 different nightlife spots.'],
  ['night-five','night','Moonlight Regular',tagged(5,'nightlife'),'Visita 5 lugares nocturnos distintos.','Visit 5 different nightlife spots.'],
  ['night-fifteen','night','Midnight Mayor',tagged(15,'nightlife'),'Visita 15 lugares nocturnos distintos.','Visit 15 different nightlife spots.'],
 ]},
 {id:'culture',medals:[
  ['culture','culture','Culture Vulture',events(3),'Verifica tu entrada en 3 eventos culturales distintos.','Check in at 3 different cultural events.'],
  ['ticket','culture','Ticket Tamer',events(1),'Verifica tu entrada en un evento cultural.','Check in at one cultural event.'],
  ['culture-five','culture','Gallery Gremlin',events(5),'Verifica tu entrada en 5 eventos culturales distintos.','Check in at 5 different cultural events.'],
  ['culture-eight','culture','Curator on the Loose',events(8),'Verifica tu entrada en 8 eventos culturales distintos.','Check in at 8 different cultural events.'],
  ['culture-ten','culture','Front Row Phantom',events(10),'Verifica tu entrada en 10 eventos culturales distintos.','Check in at 10 different cultural events.'],
 ]},
 {id:'variety',medals:[
  ['kinds-two','legend','Two Moods',kinds(2),'Visita establecimientos de 2 categorías distintas.','Visit places in 2 different categories.'],
  ['kinds-three','legend','Plot Twist',kinds(3),'Visita establecimientos de 3 categorías distintas.','Visit places in 3 different categories.'],
  ['kinds-four','legend','Plan Collector',kinds(4),'Visita establecimientos de 4 categorías distintas.','Visit places in 4 different categories.'],
  ['kinds-five','legend','Mood Jukebox',kinds(5),'Visita establecimientos de 5 categorías distintas.','Visit places in 5 different categories.'],
  ['kinds-six','legend','All-Terrain Neighbor',kinds(6),'Visita establecimientos de 6 categorías distintas.','Visit places in 6 different categories.'],
  ['stay-two','foot','Cozy Check-In',tagged(2,'stay'),'Verifica visitas en 2 alojamientos distintos.','Verify visits at 2 different stays.'],
  ['wellness-two','brunch','Zen Tourist',tagged(2,'wellness'),'Visita 2 espacios de bienestar distintos.','Visit 2 different wellness spots.'],
  ['shop-three','foot','Shop Sleuth',tagged(3,'store'),'Visita 3 tiendas distintas.','Visit 3 different shops.'],
  ['days-three','foot','Out and About',days(3),'Verifica visitas en 3 días distintos de Ciudad de México.','Verify visits on 3 different Mexico City dates.'],
  ['days-ten','foot','Calendar Crasher',days(10),'Verifica visitas en 10 días distintos de Ciudad de México.','Verify visits on 10 different Mexico City dates.'],
 ]},
];

// Combinations can include earlier combinations. Keep prerequisites before dependants.
export const combinations=[
 ['sunrise-sunset','night','Sunrise to Sunset',['coffee','night-five']],
 ['taco-after-dark','taco','Taco After Dark',['taco','knight']],
 ['morning-plot','brunch','Morning Plot Twist',['brunch','coffee']],
 ['culture-shot','culture','Culture Shot',['culture','coffee']],
 ['night-royalty','night','Night Royalty',['knight','night','bar-eight']],
 ['brunch-art','brunch','Brunch & Brush',['brunch','culture']],
 ['passport-pair','legend','Passport With Benefits',['stay-two','shop-three','wellness-two']],
 ['connoisseur','taco','Condesa Connoisseur',['taco-eight','coffee-eight','restaurant-eight']],
 ['neighborhood-trio','legend','The Barrio Trifecta',['legend','culture','night']],
 ['hall-of-vita','legend','Hall of Vita',['neighborhood-trio','connoisseur','passport-pair','fifty']],
];

export function awardBadges(visits,{total,categories,dateKey}){
 const taggedPlaces=new Map();
 for(const visit of visits){
  for(const tag of visit.tags||[]){
   if(!taggedPlaces.has(tag))taggedPlaces.set(tag,new Set());
   taggedPlaces.get(tag).add(visit.venue);
  }
 }
 const counts={places:total,legend:total,categories,
  events:new Set(visits.map(v=>v.eventId).filter(Boolean)).size,
  days:new Set(visits.map(v=>dateKey(v.created_at))).size};
 const results=new Map();
 function add(id,art,name,group,es,en,count,required,extra={}){
  const unlocked=count>=required&&(id!=='legend'||categories>=5);
  const progress=id==='legend'?Math.min(count/required,categories/5):count/required;
  results.set(id,{kind:id,art,name,group,es,en,count,required,
   state:unlocked?'unlocked':count?'progress':'locked',
   progress:Math.min(100,Math.round(100*progress)),...extra});
 }
 for(const {id:group,medals} of collections){
  for(const [id,art,name,[metric,required,tag],es,en] of medals){
   const count=metric==='tags'?taggedPlaces.get(tag)?.size||0:counts[metric];
   add(id,art,name,group,es,en,count,required,id==='legend'?{categories}:{});
  }
 }
 for(const [id,art,name,prerequisites] of combinations){
  const requirements=prerequisites.map(key=>{
   const badge=results.get(key);
   return {kind:key,name:badge.name,unlocked:badge.state==='unlocked'};
  });
  add(id,art,name,'exclusive','Reúne estas condecoraciones.','Collect these medals.',
   requirements.filter(b=>b.unlocked).length,requirements.length,{requirements});
 }
 return [...results.values()];
}
