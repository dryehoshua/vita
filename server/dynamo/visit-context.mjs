const localTime=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Mexico_City',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const calendarDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City'});
const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export function businessVisit(document,at){
 const category=document?.category&&document.category!=='other'?document.category:null;
 const tags=new Set(category?[category]:[]);
 for(const tag of document?.visitTags||[])tags.add(tag);
 const brunch=document?.brunch;
 if(brunch){
  const pieces=Object.fromEntries(localTime.formatToParts(at).map(({type,value})=>[type,value]));
  const time=pieces.hour+':'+pieces.minute;
  if(brunch.days.includes(weekdays.indexOf(pieces.weekday))&&time>=brunch.start&&time<brunch.end)tags.add('brunch');
 }
 return {category,tags:[...tags]};
}

export function eligibleCulture(document,at){
 if(!document||!['art','entertainment'].includes(document.category))return false;
 const start=Date.parse(document.day+'T'+document.startTime+':00-06:00');
 let end=Date.parse(document.day+'T'+document.endTime+':00-06:00');
 if(end<=start)end+=86400000;
 return +at>=start&&+at<end;
}

export {calendarDay};
