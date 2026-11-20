const kinds=['business','guide','tour','article'];
const areas=['cdmx','metropolitan','teotihuacan'];
const plain=(value,max=200,required=false)=>{
 if(value===undefined||value===null)value='';
 if(typeof value!=='string'||value.length>max||/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)||(required&&!value.trim()))throw Object.assign(Error('Invalid text field'),{status:400});
 return value.trim();
};
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
function https(value){if(!value)return '';let u;try{u=new URL(value);}catch{fail(400,'Use a valid HTTPS URL');}if(u.protocol!=='https:'||u.username||u.password||u.href.length>2048)fail(400,'Use a valid HTTPS URL');return u.href;}
function integer(value,min,max,fallback=0){if(value===undefined)value=fallback;if(!Number.isSafeInteger(value)||value<min||value>max)fail(400,'Invalid numeric field');return value;}
function list(value,max,convert){if(value===undefined)return [];if(!Array.isArray(value)||value.length>max)fail(400,'Invalid list');return value.map(convert);}
function object(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail(400,'Unsupported document fields');return value;}

 function normalize(kind,input,submit=false){
  const common=['title','summary','language','photos'];
  const specific={article:['body','category','tags','sources'],business:['category','address','phone','website','hours','specialty','menu','services'],guide:['bio','languages','areas','hourlyRateCents','minHours','contactUrl'],tour:['itinerary','meetingPoint','durationMinutes','maxGroup','priceCents','includes','excludes','accessibility','conditions','areas','languages']};
  const v=object(input,[...common,...specific[kind]]);
  const doc={title:plain(v.title,160,true),summary:plain(v.summary,600,submit),language:v.language||'es',photos:list(v.photos,12,p=>{object(p,['url','caption','credit','rights']);return {url:plain(p.url,500,true),caption:plain(p.caption,240),credit:plain(p.credit,200,submit),rights:plain(p.rights,300,submit)};})};
  if(!['es','en'].includes(doc.language))fail(400,'Use es or en');
  if(kind==='article')Object.assign(doc,{body:plain(v.body,50000,submit),category:plain(v.category,60),tags:list(v.tags,12,t=>plain(t,40,true)),sources:list(v.sources,20,s=>{object(s,['title','url']);return {title:plain(s.title,200,true),url:https(plain(s.url,2048,true))};})});
  if(kind==='business'){
   const category=v.category||'other';if(!['restaurant','bar','cafe','store','stay','wellness','other'].includes(category))fail(400,'Invalid business category');
   const entry=e=>{object(e,['name','category','description','priceCents','currency','available','durationMinutes']);if(e.available!==undefined&&typeof e.available!=='boolean')fail(400,'Invalid availability');if(e.currency!==undefined&&e.currency!=='MXN')fail(400,'Use MXN');return {name:plain(e.name,120,true),category:plain(e.category,80),description:plain(e.description,600),priceCents:integer(e.priceCents,0,100000000),currency:'MXN',available:e.available!==false,...(e.durationMinutes!==undefined?{durationMinutes:integer(e.durationMinutes,1,1440)}:{})};};
   Object.assign(doc,{category,address:plain(v.address,500,submit),phone:plain(v.phone,50),website:https(v.website),hours:plain(v.hours,1200),specialty:plain(v.specialty,600),menu:list(v.menu,200,entry),services:list(v.services,100,entry)});
  }
  if(kind==='guide'||kind==='tour'){
   const selected=list(v.areas,3,a=>{if(!areas.includes(a))fail(400,'Only CDMX, metropolitan area and Teotihuacán');return a;});
   const langs=list(v.languages,10,l=>plain(l,40,true));if(submit&&(!selected.length||!langs.length))fail(400,'Specify service areas and languages');Object.assign(doc,{areas:[...new Set(selected)],languages:[...new Set(langs)]});
  }
  if(kind==='guide')Object.assign(doc,{bio:plain(v.bio,5000,submit),hourlyRateCents:integer(v.hourlyRateCents,0,100000000),minHours:integer(v.minHours,1,24,1),contactUrl:https(v.contactUrl)});
  if(kind==='tour')Object.assign(doc,{itinerary:plain(v.itinerary,10000,submit),meetingPoint:plain(v.meetingPoint,500,submit),durationMinutes:integer(v.durationMinutes,1,1440,60),maxGroup:integer(v.maxGroup,1,100,10),priceCents:integer(v.priceCents,0,100000000),includes:plain(v.includes,2000),excludes:plain(v.excludes,2000),accessibility:plain(v.accessibility,2000),conditions:plain(v.conditions,3000)});
  return doc;
 }

export {normalize,kinds,fail};
