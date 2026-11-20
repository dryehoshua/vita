export const TIME_ZONE='America/Mexico_City';
export function localDate(now=new Date()) {const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
export function stamp(day,time){return Date.parse(`${day}T${time}:00-06:00`);}
export function occursOn(e,day){if(!e.through)return e.date===day;if(day<e.date||day>e.through)return false;return !e.weekdays||e.weekdays.includes(new Date(day+'T12:00:00-06:00').getUTCDay());}
export function inMonth(e,month){const last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();return e.date<=`${month}-${last}`&&(e.through||e.date)>=`${month}-01`;}
export function eventState(e,now=new Date()){
 if(e.status==='postponed')return 'postponed';
 const day=localDate(now),n=now.getTime();
 if(!occursOn(e,day))return (e.through||e.date)<day?'past':e.date>day?'future':'season';
 const start=e.startTime?stamp(day,e.startTime):null,doors=e.doorsTime?stamp(day,e.doorsTime):null;
 let end=e.endTime?stamp(day,e.endTime):null;if(end&&start&&end<=start)end+=86400000;
 if(start&&end&&n>=start&&n<end)return e.usualHours?'usual':e.endApproximate?'approx':'window';
 if(doors&&start&&n>=doors&&n<start)return 'doors';
 if(start&&n<start)return 'upcoming';
 if(end&&n>=end)return 'ended';
 if(start&&n>=start)return 'started';
 if(doors&&n<doors)return 'upcoming';
 if(doors&&n>=doors)return 'door-announcement';
 return 'unknown';
}
export const isNow=(e,now=new Date())=>['window','approx','usual','doors'].includes(eventState(e,now));
